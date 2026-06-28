/**
 * CasosExitoService — CRUD de casos de éxito en ke_ejemplos.
 *
 * Un caso de éxito es una planificación que el docente marcó como buena.
 * Flujo: docente pulsa "Convertir en caso de éxito" → estado pendiente →
 *        admin aprueba en panel → estado activo → KnowledgeEngine lo inyecta.
 *
 * Colección: ke_ejemplos
 */

import { db } from "../../firebase.js";
import { getAuth } from "firebase/auth";
import {
  collection, doc, addDoc, setDoc, getDocs,
  query, where, orderBy, limit, serverTimestamp,
} from "firebase/firestore";
import { COLLECTIONS, STATES, EXAMPLE_TYPES, AGENT_IDS } from "./knowledge/KnowledgeTypes.js";

function _uid() {
  return getAuth().currentUser?.uid ?? null;
}

// ── Serialización de planificación a texto ───────────────────────────────────
// El campo "output" en ke_ejemplos es texto plano — lo que KnowledgeEngine
// inyecta en el prompt de la IA cuando hay un caso de éxito relevante.

function _serializarPlanificacion(planificacion) {
  const meta  = planificacion.metadatos     || {};
  const datos = planificacion.datosGenerales || {};

  const header = [
    `TEMA: ${meta.tema || ""}`,
    `ÁREA: ${meta.area || ""}`,
    `GRADO: ${[meta.grado, meta.seccion].filter(Boolean).join(" ")}`,
    `TIPO: ${meta.tipoPlanificacion || ""}`,
    `COMPETENCIA: ${datos.competencia || ""}`,
    "",
    "SITUACIÓN DE APRENDIZAJE:",
    (datos.situacionAprendizaje || "—").slice(0, 300),
    "",
  ];

  // Planificación semanal / unidad
  const semanas = planificacion.desarrolloSemanal || planificacion.desarrolloUnidad || [];
  if (semanas.length > 0) {
    semanas.slice(0, 6).forEach((sem, i) => {
      header.push(`--- SEMANA ${i + 1} (${sem.fase || ""}) ---`);
      (sem.actividades || []).slice(0, 4).forEach((act) => {
        const titulo = act.titulo || act.nombre || "Actividad";
        const desc   = act.descripcion ? ` — ${act.descripcion.slice(0, 150)}` : "";
        header.push(`  [${act.momento || "—"}] ${titulo}${desc}`);
      });
      if (sem.evaluacionSemana?.instrumento) {
        header.push(`  Evaluación: ${sem.evaluacionSemana.instrumento}`);
      }
    });
    return header.join("\n");
  }

  // Plan diario
  const sesiones = planificacion.sesiones || planificacion.desarrolloDiario || [];
  if (sesiones.length > 0) {
    sesiones.slice(0, 3).forEach((ses, i) => {
      header.push(`--- SESIÓN ${i + 1} ---`);
      (ses.actividades || ses.momentos || []).slice(0, 4).forEach((act) => {
        const titulo = act.titulo || act.momento || act.nombre || "Actividad";
        const desc   = act.descripcion ? ` — ${act.descripcion.slice(0, 150)}` : "";
        header.push(`  ${titulo}${desc}`);
      });
    });
    return header.join("\n");
  }

  // Fallback: cualquier campo de texto libre
  const textoLibre = planificacion.contenido || planificacion.texto || "";
  if (textoLibre) header.push(String(textoLibre).slice(0, 600));

  return header.join("\n");
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Convierte una planificación guardada en un caso de éxito (estado: pendiente).
 *
 * @param {Object} opts
 * @param {Object}   opts.planificacion  - Objeto de planificación completo
 * @param {string}   [opts.planificacionId] - ID en Firebase (si ya fue guardada)
 * @param {string}   [opts.topicId]      - ID del topic relacionado en ke_topics
 * @param {number}   [opts.calificacion] - Calificación de auditoría si existe (0-10)
 * @returns {Promise<string>} ID del documento creado
 */
export async function crearCasoExito({ planificacion, planificacionId, topicId, calificacion }) {
  if (!db) throw new Error("[CasosExitoService] Firestore no disponible");

  const meta  = planificacion.metadatos    || {};
  const datos = planificacion.datosGenerales || {};
  const uid   = _uid();

  const payload = {
    tipo:             EXAMPLE_TYPES.CASO_EXITO,
    estado:           STATES.PENDING,
    agentId:          AGENT_IDS.PLANIFICADOR,
    uid,
    planificacionId:  planificacionId ?? null,
    topicId:          topicId         ?? null,
    area:             meta.area       ?? null,
    asignatura:       meta.asignatura ?? datos.asignatura ?? meta.area ?? null,
    grado:            meta.grado      ?? null,
    tema:             meta.tema       ?? null,
    tipoPlanificacion: meta.tipoPlanificacion ?? null,
    calificacion:     typeof calificacion === "number" ? calificacion : null,
    calidad:          typeof calificacion === "number" ? calificacion / 10 : 0.5,
    vecesUsado:       0,
    output:           _serializarPlanificacion(planificacion),
    descripcion:      `Planificación de ${meta.tema || "tema"} — ${meta.area || "área"} — ${meta.grado || "grado"}`,
    creadoPor:        uid,
    creadoEn:         serverTimestamp(),
    actualizadoEn:    serverTimestamp(),
  };

  const ref = await addDoc(collection(db, COLLECTIONS.KE_EJEMPLOS), payload);

  if (import.meta.env.DEV) {
    console.debug("[CasosExitoService] crearCasoExito", { id: ref.id, tema: meta.tema });
  }

  return ref.id;
}

/**
 * Lista casos de éxito con filtros opcionales.
 *
 * @param {Object} [filtros]
 * @param {string} [filtros.estado]     - "pendiente" | "activo" | "rechazado"
 * @param {string} [filtros.area]
 * @param {string} [filtros.asignatura]
 * @param {string} [filtros.grado]
 * @param {string} [filtros.topicId]
 * @returns {Promise<Object[]>}
 */
export async function getCasosExito(filtros = {}) {
  if (!db) return [];

  try {
    const conditions = [where("tipo", "==", EXAMPLE_TYPES.CASO_EXITO)];
    if (filtros.estado)     conditions.push(where("estado",     "==", filtros.estado));
    if (filtros.area)       conditions.push(where("area",       "==", filtros.area));
    if (filtros.asignatura) conditions.push(where("asignatura", "==", filtros.asignatura));
    if (filtros.grado)      conditions.push(where("grado",      "==", filtros.grado));
    if (filtros.topicId)    conditions.push(where("topicId",    "==", filtros.topicId));

    const q = query(
      collection(db, COLLECTIONS.KE_EJEMPLOS),
      ...conditions,
      orderBy("creadoEn", "desc"),
      limit(100),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

/**
 * Aprueba un caso de éxito → estado activo.
 */
export async function aprobarCasoExito(id) {
  if (!db) return;
  await setDoc(doc(db, COLLECTIONS.KE_EJEMPLOS, id), {
    estado:        STATES.ACTIVE,
    actualizadoEn: serverTimestamp(),
  }, { merge: true });
}

/**
 * Rechaza un caso de éxito → estado rechazado.
 */
export async function rechazarCasoExito(id) {
  if (!db) return;
  await setDoc(doc(db, COLLECTIONS.KE_EJEMPLOS, id), {
    estado:        STATES.REJECTED,
    actualizadoEn: serverTimestamp(),
  }, { merge: true });
}

/**
 * Edita descripción y otros campos libres de un caso de éxito.
 *
 * @param {string} id
 * @param {Object} cambios - { descripcion, calificacion, topicId, ... }
 */
export async function editarCasoExito(id, cambios) {
  if (!db) return;
  const updates = { ...cambios, actualizadoEn: serverTimestamp() };
  // Recalcular calidad si se edita calificacion
  if (typeof cambios.calificacion === "number") {
    updates.calidad = cambios.calificacion / 10;
  }
  await setDoc(doc(db, COLLECTIONS.KE_EJEMPLOS, id), updates, { merge: true });
}

/**
 * Marca un caso de éxito como global (disponible para todos los docentes).
 * Solo admin puede llamar esto — la regla de Firestore lo verifica.
 */
export async function marcarGlobal(id) {
  if (!db) return;
  await setDoc(doc(db, COLLECTIONS.KE_EJEMPLOS, id), {
    visibilidad:   "global",
    actualizadoEn: serverTimestamp(),
  }, { merge: true });
}
