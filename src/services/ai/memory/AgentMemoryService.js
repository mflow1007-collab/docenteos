/**
 * AgentMemoryService — CRUD de memorias de agentes con flujo de aprobación.
 *
 * Colección: ke_agentes/{agentId}/ke_memoria/{memoryId}
 * Snapshots de config: ke_agentes/{agentId}/ke_versiones/{versionId}
 *
 * Solo memorias con estado "activo" se inyectan en producción
 * (el filtrado lo hace KnowledgeEngine, no este servicio).
 */

import { db } from "../../../firebase.js";
import { getAuth } from "firebase/auth";
import {
  collection, doc, addDoc, setDoc, getDoc, getDocs,
  query, where, orderBy, serverTimestamp,
} from "firebase/firestore";
import { COLLECTIONS, STATES } from "../knowledge/KnowledgeTypes.js";

// ── Helpers ────────────────────────────────────────────────────────────────────

function _uid() {
  return getAuth().currentUser?.uid ?? null;
}

function _memoriaRef(agentId) {
  return collection(db, COLLECTIONS.KE_AGENTES, agentId, COLLECTIONS.KE_MEMORIA);
}

function _memDocRef(agentId, memoryId) {
  return doc(db, COLLECTIONS.KE_AGENTES, agentId, COLLECTIONS.KE_MEMORIA, memoryId);
}

function _versionRef(agentId) {
  return collection(db, COLLECTIONS.KE_AGENTES, agentId, COLLECTIONS.KE_VERSIONES);
}

// ── API pública ────────────────────────────────────────────────────────────────

/**
 * Crea una nueva memoria en estado "pendiente".
 *
 * @param {string} agentId
 * @param {Object} data - Campos de la memoria (tipo, contenido, prioridad, etc.)
 * @returns {Promise<string>} ID del documento creado
 */
export async function crearMemoria(agentId, data) {
  if (!db) throw new Error("[AgentMemoryService] Firestore no disponible");

  const payload = {
    agentId,
    tipo:                 data.tipo               ?? null,
    contenido:            data.contenido          ?? "",
    areaAplicable:        data.areaAplicable       ?? null,
    asignaturaAplicable:  data.asignaturaAplicable ?? null,
    gradoAplicable:       data.gradoAplicable      ?? null,
    temaAplicable:        data.temaAplicable       ?? null,
    prioridad:            data.prioridad           ?? 5,
    topicId:              data.topicId             ?? null,
    estado:               data.estado              ?? STATES.PENDING,
    version:              1,
    creadoPor:            data.creadoPor           ?? _uid(),
    creadoEn:             serverTimestamp(),
    actualizadoEn:        serverTimestamp(),
    fuente:               data.fuente              ?? "admin",
    // Trazabilidad desde Learning Engine
    insightId:            data.insightId           ?? null,
    aprobadoPor:          data.aprobadoPor         ?? null,
    aprobadoEn:           data.aprobadoEn          ?? null,
  };

  const ref = await addDoc(_memoriaRef(agentId), payload);

  if (import.meta.env.DEV) {
    console.debug("[AgentMemoryService] crearMemoria", { agentId, id: ref.id, tipo: payload.tipo });
  }

  return ref.id;
}

/**
 * Aprueba una memoria pendiente → estado "activo".
 *
 * @param {string} agentId
 * @param {string} memoryId
 */
export async function aprobarMemoria(agentId, memoryId) {
  if (!db) return;
  await setDoc(_memDocRef(agentId, memoryId), {
    estado:        STATES.ACTIVE,
    actualizadoEn: serverTimestamp(),
  }, { merge: true });

  if (import.meta.env.DEV) {
    console.debug("[AgentMemoryService] aprobarMemoria", { agentId, memoryId });
  }
}

/**
 * Desactiva una memoria → estado "inactivo".
 *
 * @param {string} agentId
 * @param {string} memoryId
 */
export async function desactivarMemoria(agentId, memoryId) {
  if (!db) return;
  await setDoc(_memDocRef(agentId, memoryId), {
    estado:        STATES.INACTIVE,
    actualizadoEn: serverTimestamp(),
  }, { merge: true });
}

/**
 * Edita campos de una memoria e incrementa su versión.
 *
 * @param {string} agentId
 * @param {string} memoryId
 * @param {Object} cambios - Campos a actualizar
 */
export async function editarMemoria(agentId, memoryId, cambios) {
  if (!db) return;

  const snap = await getDoc(_memDocRef(agentId, memoryId));
  const versionActual = snap.exists() ? (snap.data().version ?? 1) : 1;

  await setDoc(_memDocRef(agentId, memoryId), {
    ...cambios,
    version:       versionActual + 1,
    actualizadoEn: serverTimestamp(),
  }, { merge: true });

  if (import.meta.env.DEV) {
    console.debug("[AgentMemoryService] editarMemoria", { agentId, memoryId, nuevaVersion: versionActual + 1 });
  }
}

/**
 * Archiva una memoria → estado "archivado".
 *
 * @param {string} agentId
 * @param {string} memoryId
 */
export async function archivarMemoria(agentId, memoryId) {
  if (!db) return;
  await setDoc(_memDocRef(agentId, memoryId), {
    estado:        STATES.ARCHIVED,
    actualizadoEn: serverTimestamp(),
  }, { merge: true });
}

/**
 * Lista memorias de un agente con filtros opcionales.
 *
 * @param {string} agentId
 * @param {Object} [filtros]
 * @param {string} [filtros.estado]       - Filtrar por estado
 * @param {string} [filtros.tipo]         - Filtrar por tipo de memoria
 * @param {string} [filtros.asignatura]   - Filtrar por asignatura aplicable
 * @returns {Promise<Object[]>}
 */
export async function obtenerMemorias(agentId, filtros = {}) {
  if (!db) return [];

  try {
    const conditions = [];
    if (filtros.estado)     conditions.push(where("estado",              "==", filtros.estado));
    if (filtros.tipo)       conditions.push(where("tipo",                "==", filtros.tipo));
    if (filtros.asignatura) conditions.push(where("asignaturaAplicable", "==", filtros.asignatura));
    if (filtros.topicId)    conditions.push(where("topicId",             "==", filtros.topicId));

    const q = query(
      _memoriaRef(agentId),
      ...conditions,
      orderBy("prioridad", "desc"),
    );

    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

/**
 * Guarda un snapshot de la config activa del agente en ke_versiones.
 * Útil para auditoría y rollback.
 *
 * @param {string} agentId
 * @param {Object} metadata - Descripción del snapshot (razón, responsable, etc.)
 * @returns {Promise<string>} ID del documento creado
 */
export async function crearVersionAgente(agentId, metadata = {}) {
  if (!db) throw new Error("[AgentMemoryService] Firestore no disponible");

  const memoriasActivas = await obtenerMemorias(agentId, { estado: STATES.ACTIVE });

  const payload = {
    agentId,
    memorias:     memoriasActivas,
    totalActivas: memoriasActivas.length,
    creadoPor:    _uid(),
    creadoEn:     serverTimestamp(),
    ...metadata,
  };

  const ref = await addDoc(_versionRef(agentId), payload);

  if (import.meta.env.DEV) {
    console.debug("[AgentMemoryService] crearVersionAgente", { agentId, id: ref.id, totalActivas: memoriasActivas.length });
  }

  return ref.id;
}
