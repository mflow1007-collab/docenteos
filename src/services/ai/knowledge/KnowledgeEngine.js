/**
 * KnowledgeEngine — Motor de conocimiento unificado de DocenteOS.
 *
 * Punto de entrada único para todos los motores:
 *   - Memory Engine: reglas y criterios de agentes
 *   - Style Engine: plantillas de estilo pedagógico
 *   - Learning Engine: consume eventos, produce insights
 *   - ContextBuilder: llama a query() antes de cada prompt
 *
 * Regla de oro: solo se inyectan entradas con estado "activo".
 * La memoria pertenece a DocenteOS, no al proveedor de IA.
 *
 * Flujo de inyección (orden del punto 8, doc Memory Engine):
 *   1. Reglas globales del agente
 *   2. Reglas por área
 *   3. Reglas por asignatura
 *   4. Reglas por tema
 *   5. Ejemplos aprobados relevantes
 */

import { db } from "../../../firebase.js";
import {
  collection, getDocs, query as fsQuery,
  where, orderBy, limit,
} from "firebase/firestore";
import {
  COLLECTIONS, STATES, CONTEXT_LIMITS, ACTION_TO_AGENT, EXAMPLE_TYPES,
} from "./KnowledgeTypes.js";

// ── API pública ────────────────────────────────────────────────────────────────

/**
 * Consulta el banco de conocimiento para un contexto dado.
 * Devuelve solo lo relevante — nunca toda la memoria.
 *
 * @param {Object} params
 * @param {string}   params.agentId      - ID del agente (ver AGENT_IDS)
 * @param {string}   [params.action]     - Acción del ContextBuilder (alternativa a agentId)
 * @param {string}   [params.area]       - Área curricular
 * @param {string}   [params.asignatura] - Asignatura
 * @param {string}   [params.grado]      - Grado
 * @param {string}   [params.tema]       - Tema de la planificación
 * @param {string}   [params.topicId]    - ID del topic en ke_topics (filtra memorias por topic)
 *
 * @returns {Promise<KnowledgeContext>}
 */
export async function query(params = {}) {
  if (!db) return _empty();

  const agentId = params.agentId ?? ACTION_TO_AGENT[params.action] ?? null;
  const { area, asignatura, grado, tema, topicId } = params;

  const [memories, topics, casosExito, estilos] = await Promise.all([
    agentId ? _fetchMemories(agentId, { area, asignatura, grado, tema, topicId }) : [],
    tema    ? _fetchTopics(tema, asignatura) : [],
    agentId ? _fetchCasosExito(agentId, { asignatura, tema }) : [],
    _fetchEstilos({ asignatura, grado }),
  ]);

  return {
    memories,
    topics,
    examples: casosExito,   // alias para compatibilidad con código existente
    casosExito,
    estilos,
    contextText: _buildContextText(memories, topics, casosExito, estilos),
    totalItems: memories.length + topics.length + casosExito.length + estilos.length,
    agentId,
  };
}

/**
 * Versión conveniente: recibe la acción del ContextBuilder y los datos del builder.
 * Devuelve el contextText listo para inyectar antes de la solicitud del usuario.
 *
 * @param {string} action   - Acción del ContextBuilder
 * @param {Object} data     - Datos del builder (grado, area, asignatura, tema, ...)
 * @returns {Promise<string>} Texto para inyectar (puede ser vacío)
 */
export async function resolveForAction(action, data = {}) {
  if (!db) return "";
  try {
    const result = await query({
      action,
      area:       data.area       || data.asignatura,
      asignatura: data.asignatura,
      grado:      data.grado,
      tema:       data.tema,
    });
    return result.contextText;
  } catch {
    return "";
  }
}

// ── Internos ───────────────────────────────────────────────────────────────────

async function _fetchMemories(agentId, filters = {}) {
  try {
    const ref = collection(db, COLLECTIONS.KE_AGENTES, agentId, COLLECTIONS.KE_MEMORIA);
    const q = fsQuery(
      ref,
      where("estado", "==", STATES.ACTIVE),
      orderBy("prioridad", "desc"),
      limit(CONTEXT_LIMITS.MAX_MEMORIES * 2),
    );
    const snap = await getDocs(q);
    const all  = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return all.filter(m => _isRelevant(m, filters)).slice(0, CONTEXT_LIMITS.MAX_MEMORIES);
  } catch {
    return [];
  }
}

async function _fetchCasosExito(agentId, filters = {}) {
  try {
    const conditions = [
      where("agentId", "==", agentId),
      where("estado",  "==", STATES.ACTIVE),
      where("tipo",    "==", EXAMPLE_TYPES.CASO_EXITO),
    ];
    if (filters.asignatura) conditions.push(where("asignatura", "==", filters.asignatura));

    const q = fsQuery(
      collection(db, COLLECTIONS.KE_EJEMPLOS),
      ...conditions,
      orderBy("calidad", "desc"),
      limit(CONTEXT_LIMITS.MAX_EXAMPLES),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

async function _fetchEstilos({ asignatura, grado } = {}) {
  try {
    const conditions = [
      where("estado", "in", [STATES.ACTIVE]),
      where("visibilidad", "in", ["global", "centro"]),
    ];
    if (asignatura) conditions.push(where("asignatura", "==", asignatura));
    if (grado)      conditions.push(where("grado",      "==", grado));

    const q = fsQuery(
      collection(db, COLLECTIONS.KE_ESTILOS),
      ...conditions,
      limit(2),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

async function _fetchTopics(tema, asignatura) {
  try {
    const normalizado = _normalizeTema(tema);
    const conditions  = [
      where("estado",          "==", STATES.ACTIVE),
      where("temaNormalizado", "==", normalizado),
    ];
    if (asignatura) conditions.push(where("asignatura", "==", asignatura));

    const q = fsQuery(
      collection(db, COLLECTIONS.KE_TOPICS),
      ...conditions,
      limit(CONTEXT_LIMITS.MAX_TOPICS),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

async function _fetchExamples(agentId, filters = {}) {
  try {
    const conditions = [
      where("agentId", "==", agentId),
      where("estado",  "==", STATES.ACTIVE),
    ];
    if (filters.asignatura) conditions.push(where("asignatura", "==", filters.asignatura));

    const q = fsQuery(
      collection(db, COLLECTIONS.KE_EJEMPLOS),
      ...conditions,
      orderBy("calidad", "desc"),
      limit(CONTEXT_LIMITS.MAX_EXAMPLES),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

// ── Construcción del texto de contexto ────────────────────────────────────────

function _buildContextText(memories, topics, casosExito, estilos) {
  const parts = [];

  // 1. Modelos de estilo relevantes
  if (estilos.length > 0) {
    const e = estilos[0];
    const lineas = [];
    if (e.estilo?.estructuraDetectada)   lineas.push(`  Estructura: ${e.estilo.estructuraDetectada}`);
    if (e.estilo?.patronesActividades)   lineas.push(`  Actividades: ${e.estilo.patronesActividades}`);
    if (e.estilo?.patronesEvaluacion)    lineas.push(`  Evaluación: ${e.estilo.patronesEvaluacion}`);
    if (lineas.length > 0) {
      parts.push(`MODELO DE ESTILO DISPONIBLE (${e.nombre ?? e.id}):\n${lineas.join("\n")}`);
    }
  }

  // 2. Casos de éxito
  if (casosExito.length > 0) {
    const ex = casosExito[0];
    const output = String(ex.output ?? "").slice(0, 500);
    if (output) {
      parts.push(`CASO DE ÉXITO (referencia de calidad):\n${output}`);
    }
  }

  // 3. Conocimiento del tema
  for (const t of topics) {
    const lines = [];
    if (t.reglas?.length)                 lines.push(`  Reglas: ${t.reglas.join(" · ")}`);
    if (t.vocabulario?.length)            lines.push(`  Vocabulario: ${t.vocabulario.join(", ")}`);
    if (t.gramatica?.length)              lines.push(`  Gramática: ${t.gramatica.join(", ")}`);
    if (t.funcionesComunicativas?.length) lines.push(`  Funciones comunicativas: ${t.funcionesComunicativas.join(", ")}`);
    if (t.pronunciacion)                  lines.push(`  Pronunciación: ${t.pronunciacion}`);
    if (lines.length > 0) {
      parts.push(`CONOCIMIENTO DEL TEMA "${t.temaNormalizado.replace(/_/g, " ")}":\n${lines.join("\n")}`);
    }
  }

  // 4. Reglas y criterios del agente
  if (memories.length > 0) {
    const lines = memories.map(m => `- [${m.tipo}] ${m.contenido}`).join("\n");
    parts.push(`REGLAS Y CRITERIOS ACTIVOS:\n${lines}`);
  }

  return parts.join("\n\n");
}

// ── Utilidades ─────────────────────────────────────────────────────────────────

/**
 * Una memoria es relevante si ninguno de sus filtros de ámbito contradice el contexto.
 * Sin filtros de ámbito = global → siempre relevante.
 */
function _isRelevant(memory, { area, asignatura, grado, tema }) {
  if (!memory.areaAplicable && !memory.asignaturaAplicable &&
      !memory.gradoAplicable && !memory.temaAplicable) return true;

  if (memory.areaAplicable       && area       && memory.areaAplicable       !== area)       return false;
  if (memory.asignaturaAplicable && asignatura && memory.asignaturaAplicable !== asignatura) return false;
  if (memory.gradoAplicable      && grado      && memory.gradoAplicable      !== grado)      return false;

  if (memory.temaAplicable && tema) {
    const a = memory.temaAplicable.toLowerCase();
    const b = tema.toLowerCase();
    if (!a.includes(b) && !b.includes(a)) return false;
  }

  return true;
}

function _normalizeTema(tema) {
  return String(tema || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .trim()
    .replace(/\s+/g, "_");
}

function _empty() {
  return { memories: [], topics: [], examples: [], contextText: "", totalItems: 0, agentId: null };
}

/**
 * @typedef {Object} KnowledgeContext
 * @property {Object[]} memories     - Reglas/criterios activos del agente
 * @property {Object[]} topics       - Conocimiento del tema específico
 * @property {Object[]} examples     - Ejemplos aprobados relevantes
 * @property {string}   contextText  - Texto listo para inyectar en el prompt
 * @property {number}   totalItems   - Total de ítems encontrados
 * @property {string|null} agentId   - ID del agente resuelto
 */
