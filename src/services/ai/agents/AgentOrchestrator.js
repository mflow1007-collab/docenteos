/**
 * AgentOrchestrator — Coordinador del sistema multi-agente de DocenteOS.
 *
 * Implementa el flujo de decisión de 3 niveles del BIC:
 *
 *   Nivel 1 (≥ 90% similitud): Reutilización directa — sin IA, 0 tokens
 *   Nivel 2 (70-90%):          Adaptación — IA mínima para ajustar contexto
 *   Nivel 3 (< 70%):           Generación nueva + indexación automática en BIC
 *
 * Punto de entrada único para planificaciones, actividades e instrumentos.
 * Los componentes React NO deben llamar directamente a KnowledgeBank ni a agentes
 * individuales — siempre pasan por aquí.
 *
 * Flujo completo:
 *   1. buscarEnBIC(tipo, query) → candidatos rankeados
 *   2. determinarNivel(bestScore) → 1 | 2 | 3
 *   3a. Nivel 1: registrarUso() → devolver contenido
 *   3b. Nivel 2: AgentePlanificador.adaptar() → devolver adaptado
 *   3c. Nivel 3: [agente correspondiente].generar() → guardar en BIC → devolver
 *   4. crearVersion() si el docente modifica después
 */

import { buscarCandidatos, guardar, registrarUso } from "../learning/KnowledgeBank.js";
import { determinarNivel, UMBRALES } from "../learning/SimilarityEngine.js";
import { crearVersion } from "../learning/VersionManager.js";
import { calcularCalidad } from "../learning/QualityIndex.js";
import { adaptar as planificadorAdaptar, ajustarTiempo, adaptarNEAE } from "./AgentePlanificador.js";
import { adaptarInstrumento } from "./AgenteEvaluador.js";

// ── API principal ──────────────────────────────────────────────────────────────

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
 * Motor interno del flujo de 3 niveles.
 */
async function _resolver(tipo, query, opciones, adaptarFn) {
  const resultado = _resultadoVacio();

  // 1. Buscar candidatos en el BIC
  let candidatos = [];
  try {
    candidatos = await buscarCandidatos(tipo, query, 5);
  } catch {
    // BIC no disponible — ir a generación directamente
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

  // Nivel 1: Reutilización directa
  if (nivel === 1) {
    const candidato = candidatos[0];
    resultado.fuente = "reutilizado";
    resultado.contenido = candidato.contenido;
    resultado.guardadoEnBIC = true;

    // Registrar uso en background (no bloquea el return)
    registrarUso(tipo, candidato.id).catch(() => {});

    _logDecision(tipo, query, 1, bestScore, `reutilizando ${candidato.id}`);
    return resultado;
  }

  // Nivel 2: Adaptación
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

  // Nivel 3: Generación nueva
  resultado.fuente = "generado";
  resultado.guardadoEnBIC = false;
  _logDecision(tipo, query, 3, bestScore, "sin candidatos suficientes");
  return resultado;
}

function _resultadoVacio() {
  return {
    nivelDecision: 3,
    fuente: "generado",
    contenido: null,
    candidatoId: null,
    score: null,
    guardadoEnBIC: false,
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
 * @property {1|2|3} nivelDecision - Nivel del flujo de decisión aplicado
 * @property {"reutilizado"|"adaptado"|"generado"|"generado_sin_bic"|"generado_fallback"} fuente
 * @property {Object|null} contenido - Contenido resuelto (null si Nivel 3 → generar externamente)
 * @property {string|null} candidatoId - ID del candidato del BIC usado (si aplica)
 * @property {number|null} score - Similitud del mejor candidato (0.0–1.0)
 * @property {boolean} guardadoEnBIC - Si el resultado ya está indexado en el BIC
 */
