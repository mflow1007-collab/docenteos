/**
 * KnowledgeBank — Banco Inteligente de Conocimiento (BIC).
 *
 * Repositorio Firestore compartido (no por UID) de planificaciones, actividades
 * e instrumentos pedagógicos aprobados. Sirve al SimilarityEngine como fuente
 * de candidatos para Nivel 1 (reutilizar) y Nivel 2 (adaptar).
 *
 * Colecciones:
 *   bic_planes         — planificaciones indexadas
 *   bic_versiones      — historial de cambios (por docentes)
 *   bic_actividades    — actividades indexadas independientemente
 *   bic_instrumentos   — instrumentos de evaluación
 *   bic_auditorias     — resultados de auditoría IA
 *
 * Reglas de escritura:
 *   - Solo se indexa contenido generado por IA (no borrador manual).
 *   - El campo `calidad` lo calcula QualityIndex.
 *   - Nunca se exponen datos sensibles del docente (solo uid anonimizado).
 */

import { db } from "../../../firebase.js";
import { getAuth } from "firebase/auth";
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, setDoc,
  query, where, orderBy, limit, serverTimestamp, increment, writeBatch,
} from "firebase/firestore";
import { calcularCalidad, deltaCalidad } from "./QualityIndex.js";
import { rankearCandidatos, fingerprint } from "./SimilarityEngine.js";

// ── Nombres de colecciones ─────────────────────────────────────────────────────
const COL = {
  planes:      "bic_planes",
  versiones:   "bic_versiones",
  actividades: "bic_actividades",
  instrumentos:"bic_instrumentos",
  auditorias:  "bic_auditorias",
};

const MAX_CANDIDATOS_QUERY = 60; // límite de lectura por búsqueda

// ── CRUD básico ────────────────────────────────────────────────────────────────

/**
 * Guarda un nuevo ítem en el BIC.
 * @param {"planes"|"actividades"|"instrumentos"} tipo
 * @param {Object} meta   - Campos de indexación (nivel, grado, area, competencia, tema, tipo…)
 * @param {Object} contenido - El objeto de contenido completo (planificación, actividad, etc.)
 * @returns {string} ID del nuevo documento
 */
export async function guardar(tipo, meta, contenido) {
  if (!db) return null;
  const col = COL[tipo];
  if (!col) throw new Error(`[BIC] Tipo desconocido: ${tipo}`);

  const uid = getAuth().currentUser?.uid ?? "anon";

  const payload = {
    ...meta,
    contenido,
    fingerprint: fingerprint(meta),
    calidad: calcularCalidad({ vecesUsada: 0, vecesModificada: 0, contenido }),
    vecesUsada: 0,
    vecesModificada: 0,
    eliminadoRapido: false,
    origen: "ia",
    creadoPor: uid,
    fechaCreacion: serverTimestamp(),
    fechaActualizacion: serverTimestamp(),
    archivado: false,
  };

  const ref = await addDoc(collection(db, col), payload);
  _log("guardar", tipo, ref.id, meta);
  return ref.id;
}

/**
 * Obtiene un ítem del BIC por ID.
 */
export async function obtener(tipo, id) {
  if (!db || !id) return null;
  const snap = await getDoc(doc(db, COL[tipo], id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Busca candidatos en el BIC filtrando primero por grado+area (Firestore)
 * y luego rankeando por similitud semántica en memoria.
 *
 * @param {"planes"|"actividades"|"instrumentos"} tipo
 * @param {Object} queryParams  - Campos de búsqueda
 * @param {number} [topN=5]
 * @returns {{ id, score, contenido, calidad, ... }[]}
 */
export async function buscarCandidatos(tipo, queryParams, topN = 5) {
  if (!db) return [];

  const col = COL[tipo];
  const q = _buildQuery(col, queryParams);

  let docs = [];
  try {
    const snap = await getDocs(q);
    snap.forEach(d => docs.push({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }

  return rankearCandidatos(docs, queryParams, topN);
}

/**
 * Registra que un ítem fue reutilizado (Nivel 1).
 * Incrementa vecesUsada y recalcula calidad.
 */
export async function registrarUso(tipo, id) {
  if (!db || !id) return;
  const ref = doc(db, COL[tipo], id);
  await updateDoc(ref, {
    vecesUsada: increment(1),
    calidad: increment(deltaCalidad("uso")),
    fechaActualizacion: serverTimestamp(),
  });
}

/**
 * Registra que un docente modificó el contenido (dispara aprendizaje).
 */
export async function registrarModificacion(tipo, id, uid) {
  if (!db || !id) return;
  const ref = doc(db, COL[tipo], id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data();
  const esPresmeraMod = (data.vecesModificada ?? 0) === 0;

  await updateDoc(ref, {
    vecesModificada: increment(1),
    calidad: increment(deltaCalidad(esPresmeraMod ? "primera_edicion" : "edicion")),
    fechaActualizacion: serverTimestamp(),
  });
}

/**
 * Actualiza el contenido de un ítem (versión nueva luego de adaptación o mejora).
 */
export async function actualizarContenido(tipo, id, nuevoContenido, meta = {}) {
  if (!db || !id) return;
  await updateDoc(doc(db, COL[tipo], id), {
    contenido: nuevoContenido,
    ...meta,
    fechaActualizacion: serverTimestamp(),
  });
}

/**
 * Archiva un ítem (no lo elimina para preservar el historial).
 * Si se archiva antes de 7 días de creación, aplica penalización de calidad.
 */
export async function archivar(tipo, id) {
  if (!db || !id) return;
  const snap = await getDoc(doc(db, COL[tipo], id));
  if (!snap.exists()) return;

  const data = snap.data();
  const creacion = data.fechaCreacion?.toDate?.() ?? new Date();
  const diasVida = (Date.now() - creacion.getTime()) / 86_400_000;
  const rapido = diasVida < 7;

  await updateDoc(doc(db, COL[tipo], id), {
    archivado: true,
    eliminadoRapido: rapido,
    calidad: rapido
      ? Math.max(0, (data.calidad ?? 70) + deltaCalidad("borrado_rapido"))
      : data.calidad,
    fechaActualizacion: serverTimestamp(),
  });
}

// ── Auditorías ─────────────────────────────────────────────────────────────────

/**
 * Guarda el resultado de una auditoría IA sobre un plan.
 */
export async function guardarAuditoria(planId, resultado, calidad = 70) {
  if (!db) return null;
  const uid = getAuth().currentUser?.uid ?? "anon";
  const ref = await addDoc(collection(db, COL.auditorias), {
    planId,
    resultado,
    calidad,
    auditadoPor: uid,
    fecha: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Obtiene la última auditoría de un plan.
 */
export async function obtenerUltimaAuditoria(planId) {
  if (!db || !planId) return null;
  const q = query(
    collection(db, COL.auditorias),
    where("planId", "==", planId),
    orderBy("fecha", "desc"),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

// ── Estadísticas ───────────────────────────────────────────────────────────────

/**
 * Retorna estadísticas de uso del BIC (para panel admin).
 */
export async function estadisticas() {
  if (!db) return {};
  const stats = {};
  for (const [key, col] of Object.entries(COL)) {
    const snap = await getDocs(query(collection(db, col), limit(500)));
    stats[key] = snap.size;
  }
  return stats;
}

// ── Construcción de query Firestore ───────────────────────────────────────────

function _buildQuery(col, params) {
  const filtros = [];

  if (params.grado) filtros.push(where("grado", "==", params.grado));
  if (params.area)  filtros.push(where("area",  "==", params.area));
  if (params.nivel) filtros.push(where("nivel", "==", params.nivel));

  // Solo ítems no archivados y con calidad mínima
  filtros.push(where("archivado", "==", false));

  return query(
    collection(db, col),
    ...filtros,
    orderBy("calidad", "desc"),
    limit(MAX_CANDIDATOS_QUERY)
  );
}

function _log(op, tipo, id, meta) {
  if (import.meta.env.DEV) {
    console.debug(`[BIC] ${op} ${tipo}/${id}`, { grado: meta.grado, area: meta.area, tema: meta.tema });
  }
}

export const BIC_COLECCIONES = COL;
