/**
 * AgentOrchestrator — Coordinador del sistema multi-agente de DocenteOS.
 *
 * Orden de resolución de contexto y contenido:
 *   1. ke_estilos relacionados (modelos de estilo del docente)
 *   2. ke_ejemplos tipo caso_exito (planificaciones exitosas validadas)
 *   3. ke_memoria filtradas por topicId (reglas específicas del tema)
 *   4. ke_memoria del agente (criterios generales del agente)
 *   5. bic_planes / bic_actividades / bic_instrumentos (banco de contenido)
 *      → Nivel 1 (≥90%): reutilizar directo, 0 tokens
 *      → Nivel 2 (70-89%): adaptar con IA mínima
 *   6. Currículo oficial MINERD en Firestore (inyectado por ContextBuilder)
 *   7. IA externa — solo cuando los pasos anteriores no son suficientes
 *
 * Punto de entrada único para planificaciones, actividades e instrumentos.
 * Los componentes React NO deben llamar directamente a KnowledgeBank ni a agentes
 * individuales — siempre pasan por aquí.
 */

import { buscarCandidatos, guardar, registrarUso } from "../learning/KnowledgeBank.js";
import { determinarNivel, UMBRALES } from "../learning/SimilarityEngine.js";
import { crearVersion } from "../learning/VersionManager.js";
import { calcularCalidad } from "../learning/QualityIndex.js";
import { adaptar as planificadorAdaptar, ajustarTiempo, adaptarNEAE } from "./AgentePlanificador.js";
import { adaptarInstrumento } from "./AgenteEvaluador.js";
import { query as keQuery } from "../knowledge/KnowledgeEngine.js";

// ── API principal ──────────────────────────────────────────────────────────────

/**
 * Consulta el Knowledge Engine para una acción dada y devuelve el contexto
 * enriquecido (estilos, casos de éxito, memorias, topics) sin tomar decisiones
 * sobre el BIC ni llamar a la IA externa.
 *
 * Punto de entrada para generarPlanificacionInteligente y otros callers
 * que necesitan el contexto KE antes de decidir qué camino tomar.
 *
 * @param {Object} params
 * @param {string}   params.action     - Acción del contexto (ej: "generar_planificacion")
 * @param {string}   [params.agentId]  - ID del agente (alternativo a action)
 * @param {string}   [params.topic]    - Tema de la planificación
 * @param {string}   [params.area]     - Área curricular
 * @param {string}   [params.asignatura]
 * @param {string}   [params.grado]
 * @param {string}   [params.nivel]
 * @param {string}   [params.topicId]  - ID del topic en ke_topics
 * @param {Object}   [params.context]  - Contexto adicional (payload original)
 *
 * @returns {Promise<KERunResult>}
 */
export async function run({ action, agentId, topic, area, asignatura, grado, topicId, context = {} }) {
  const keResult = await _fetchKE({
    agentId:    agentId    ?? null,
    action:     action     ?? null,
    area:       area       ?? asignatura ?? null,
    asignatura: asignatura ?? null,
    grado:      grado      ?? null,
    tema:       topic      ?? null,
    topicId:    topicId    ?? context.topicId ?? null,
  }).catch(() => ({ contextText: "", memories: [], topics: [], casosExito: [], estilos: [], totalItems: 0 }));

  return {
    knowledgeContext:      keResult.contextText    ?? "",
    estilosEncontrados:   (keResult.estilos        ?? []).length > 0,
    casosExitoEncontrados:(keResult.casosExito     ?? []).length > 0,
    memoriasEncontradas:  (keResult.memories       ?? []).length > 0,
    topicsEncontrados:    (keResult.topics         ?? []).length > 0,
    totalItemsKE:          keResult.totalItems     ?? 0,
    keResult,
  };
}

/**
 * @typedef {Object} KERunResult
 * @property {string}   knowledgeContext       - Texto listo para inyectar en el prompt
 * @property {boolean}  estilosEncontrados     - true si hay plantillas de estilo relevantes
 * @property {boolean}  casosExitoEncontrados  - true si hay casos de éxito disponibles
 * @property {boolean}  memoriasEncontradas    - true si hay memorias activas del agente
 * @property {boolean}  topicsEncontrados      - true si hay topics pedagógicos registrados
 * @property {number}   totalItemsKE           - Total de ítems KE encontrados
 * @property {Object}   keResult               - Resultado completo de KnowledgeEngine.query()
 */

/**
 * Resuelve una planificación usando el flujo BIC de 3 niveles.
 *
 * @param {Object} query - Parámetros de búsqueda
 *   { nivel, grado, area, asignatura, competencia, indicadores, tema, tipo }
 * @param {Object} [opciones]
 *   { ajustarFechas, nuevasSemanas, tiposNEAE, minutos, uid }
 *
 * @returns {Promise<DecisionResult>}
 *   { nivelDecision: 1|2|3, fuente: string, contenido: Object|null,
 *     candidatoId: string|null, score: number|null, guardadoEnBIC: boolean }
 */
export async function resolverPlanificacion(query, opciones = {}) {
  return _resolver("planes", query, opciones, async (candidato) => {
    return planificadorAdaptar(candidato, query, opciones);
  });
}

/**
 * Resuelve un instrumento de evaluación usando el flujo BIC de 3 niveles.
 */
export async function resolverInstrumento(query, opciones = {}) {
  return _resolver("instrumentos", query, opciones, async (candidato) => {
    return adaptarInstrumento(candidato.contenido, {
      tema:        query.tema,
      competencia: query.competencia,
      indicador:   query.indicador,
    });
  });
}

/**
 * Resuelve actividades usando el flujo BIC.
 */
export async function resolverActividades(query, opciones = {}) {
  return _resolver("actividades", query, opciones, async (candidato) => {
    return planificadorAdaptar(candidato, query, opciones);
  });
}

// ── Operaciones sobre ítems existentes ────────────────────────────────────────

/**
 * Indexa un contenido nuevo en el BIC (después de generación Nivel 3).
 * Llamar después de que el docente aprueba y guarda el contenido generado.
 *
 * @param {"planes"|"actividades"|"instrumentos"} tipo
 * @param {Object} meta   - Metadatos de indexación
 * @param {Object} contenido - Contenido a guardar
 * @returns {Promise<string|null>} ID del documento creado en el BIC
 */
export async function indexarEnBIC(tipo, meta, contenido) {
  try {
    const id = await guardar(tipo, meta, contenido);
    _log("indexed", tipo, id, meta);
    return id;
  } catch (err) {
    _logWarn("index_failed", err.message);
    return null;
  }
}

/**
 * Notifica que un docente modificó un ítem originado del BIC.
 * Crea una versión y actualiza el contador de modificaciones.
 *
 * @param {string} bicId - ID del ítem en el BIC
 * @param {"planes"|"actividades"|"instrumentos"} tipo
 * @param {Object} contenidoAnterior
 * @param {Object} contenidoNuevo
 * @param {number} [versionActual=1]
 * @returns {Promise<string|null>} ID de la versión creada
 */
export async function notificarModificacion(bicId, tipo, contenidoAnterior, contenidoNuevo, versionActual = 1) {
  try {
    const versionId = await crearVersion(bicId, tipo, contenidoAnterior, contenidoNuevo, versionActual);
    return versionId;
  } catch (err) {
    _logWarn("version_failed", err.message);
    return null;
  }
}

/**
 * Aplica una acción puntual de IA sobre un contenido existente.
 * No involucra el BIC — es una modificación directa del docente asistida por IA.
 *
 * @param {"ajustar_tiempo"|"adaptar_neae"} accion
 * @param {Object} contenido - Planificación o instrumento a modificar
 * @param {Object} parametros - Depende de la acción
 * @returns {Promise<Object>} Contenido modificado
 */
export async function aplicarAccion(accion, contenido, parametros = {}) {
  switch (accion) {
    case "ajustar_tiempo":
      return ajustarTiempo(contenido, parametros.minutos ?? 45);

    case "adaptar_neae":
      return adaptarNEAE(contenido, parametros.tiposNEAE ?? []);

    default:
      throw new Error(`[Orchestrator] Acción desconocida: "${accion}"`);
  }
}

// ── Diagnóstico y estadísticas ─────────────────────────────────────────────────

/**
 * Busca candidatos en el BIC sin tomar ninguna decisión.
 * Útil para la UI (mostrar "hay X planificaciones similares").
 *
 * @param {"planes"|"actividades"|"instrumentos"} tipo
 * @param {Object} query
 * @returns {Promise<{ candidatos: Object[], nivelEsperado: 1|2|3, bestScore: number|null }>}
 */
export async function previsualizarBIC(tipo, query) {
  const candidatos = await buscarCandidatos(tipo, query, 5);
  const bestScore  = candidatos[0]?.score ?? null;
  const { nivel }  = determinarNivel(bestScore);

  return { candidatos, nivelEsperado: nivel, bestScore };
}

/**
 * Verifica si el BIC tiene contenido relevante antes de llamar a la IA.
 * Retorna null si no hay nada (ir directo a generación).
 */
export async function checkBIC(tipo, query) {
  const { candidatos, nivelEsperado, bestScore } = await previsualizarBIC(tipo, query);
  if (nivelEsperado === 3 || candidatos.length === 0) return null;
  return { nivel: nivelEsperado, mejor: candidatos[0], score: bestScore };
}

// ── Privadas ────────────────────────────────────────────────────────────────────

/**
 * Motor interno del flujo de resolución completo.
 *
 * Orden:
 *   Pasos 1-4: KE (estilos, casos_exito, memorias topicId, memorias agente) — en paralelo con BIC
 *   Paso  5:   BIC (Nivel 1→reuso / Nivel 2→adaptar)
 *   Pasos 6-7: Currículo + IA externa — solo si Nivel 3
 */
async function _resolver(tipo, query, opciones, adaptarFn) {
  const resultado = _resultadoVacio();

  // Pasos 1-5 en paralelo: KE + BIC simultáneamente
  const [keResult, candidatos] = await Promise.all([
    _fetchKE(query).catch(() => ({ contextText: "" })),
    buscarCandidatos(tipo, query, 5).catch(() => null),
  ]);

  resultado.knowledgeContext = keResult.contextText;

  if (candidatos === null) {
    resultado.nivelDecision = 3;
    resultado.fuente = "generado_sin_bic";
    _logDecision(tipo, query, 3, null, "BIC no disponible");
    return resultado;
  }

  const bestScore = candidatos[0]?.score ?? null;
  const { nivel } = determinarNivel(bestScore);

  resultado.nivelDecision = nivel;
  resultado.score = bestScore;
  resultado.candidatoId = candidatos[0]?.id ?? null;

  // Nivel 1: Reutilización directa — sin IA, 0 tokens
  if (nivel === 1) {
    const candidato = candidatos[0];
    resultado.fuente = "reutilizado";
    resultado.contenido = candidato.contenido;
    resultado.guardadoEnBIC = true;

    registrarUso(tipo, candidato.id).catch(() => {});

    _logDecision(tipo, query, 1, bestScore, `reutilizando ${candidato.id}`);
    return resultado;
  }

  // Nivel 2: Adaptación con IA mínima
  if (nivel === 2) {
    const candidato = candidatos[0];
    resultado.fuente = "adaptado";
    resultado.guardadoEnBIC = false;

    try {
      resultado.contenido = await adaptarFn(candidato, query, opciones);
      _logDecision(tipo, query, 2, bestScore, `adaptando ${candidato.id}`);
    } catch {
      resultado.nivelDecision = 3;
      resultado.fuente = "generado_fallback";
      _logDecision(tipo, query, 3, bestScore, "adaptación falló — generando");
    }

    return resultado;
  }

  // Nivel 3: IA externa (currículo + KE ya inyectados por ContextBuilder)
  resultado.fuente = "generado";
  resultado.guardadoEnBIC = false;
  _logDecision(tipo, query, 3, bestScore, "sin candidatos suficientes");
  return resultado;
}

/**
 * Pasos 1-4: Consulta el KE en el orden aprobado.
 * El resultado (knowledgeContext) se pasa a ContextBuilder antes del prompt.
 *
 * Orden interno de KnowledgeEngine.query():
 *   1. ke_estilos (modelos de estilo)
 *   2. ke_ejemplos tipo caso_exito
 *   3. ke_memoria filtradas por topicId
 *   4. ke_memoria generales del agente
 */
async function _fetchKE(query) {
  return keQuery({
    agentId:    query.agentId    ?? null,
    action:     query.action     ?? null,
    area:       query.area       ?? query.asignatura ?? null,
    asignatura: query.asignatura ?? null,
    grado:      query.grado      ?? null,
    tema:       query.tema       ?? null,
    topicId:    query.topicId    ?? null,
  });
}

function _resultadoVacio() {
  return {
    nivelDecision:    3,
    fuente:           "generado",
    contenido:        null,
    candidatoId:      null,
    score:            null,
    guardadoEnBIC:    false,
    knowledgeContext: "", // contexto KE listo para inyectar (pasos 1-4)
  };
}

function _logDecision(tipo, query, nivel, score, motivo) {
  if (!import.meta.env.DEV) return;
  console.group(`%c[Orchestrator] ${tipo} → Nivel ${nivel}`, "color:#7c3aed;font-weight:700");
  console.table({
    Grado: query.grado, Área: query.area, Tema: query.tema?.slice(0, 40),
    "Mejor score": score != null ? `${(score * 100).toFixed(1)}%` : "—",
    Nivel: nivel, Motivo: motivo,
  });
  console.groupEnd();
}

function _log(op, tipo, id, meta) {
  if (import.meta.env.DEV) {
    console.debug(`[Orchestrator] ${op} ${tipo}/${id}`, { grado: meta.grado, tema: meta.tema });
  }
}

function _logWarn(op, msg) {
  if (import.meta.env.DEV) {
    console.warn(`[Orchestrator] ${op}:`, msg);
  }
}

export const DECISION_UMBRALES = UMBRALES;

/**
 * @typedef {Object} DecisionResult
 * @property {1|2|3}  nivelDecision    - Nivel del flujo de decisión aplicado
 * @property {"reutilizado"|"adaptado"|"generado"|"generado_sin_bic"|"generado_fallback"} fuente
 * @property {Object|null} contenido   - Contenido resuelto (null si Nivel 3 → generar externamente)
 * @property {string|null} candidatoId - ID del candidato del BIC usado (si aplica)
 * @property {number|null} score       - Similitud del mejor candidato (0.0–1.0)
 * @property {boolean} guardadoEnBIC   - Si el resultado ya está indexado en el BIC
 * @property {string}  knowledgeContext - Contexto KE listo para inyectar al prompt (pasos 1-4)
 */
