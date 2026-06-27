/**
 * StyleQuery — Consultas de plantillas de estilo pedagógico.
 *
 * Para uso en el panel del docente (plantillas propias, del centro, globales)
 * y en el panel de administración (aprobación de plantillas).
 */

import { db } from "../../../firebase.js";
import {
  collection, doc, getDocs, setDoc,
  query, where, orderBy, limit, serverTimestamp,
} from "firebase/firestore";
import { COLLECTIONS, STATES, STYLE_VISIBILITY } from "../knowledge/KnowledgeTypes.js";
import { getAuth } from "firebase/auth";

// ── API pública ────────────────────────────────────────────────────────────────

/**
 * Retorna las plantillas accesibles para un docente:
 * sus propias plantillas privadas + plantillas de centro + plantillas globales.
 *
 * @param {string} uid              - UID del docente
 * @param {Object} [filtros]
 * @param {string} [filtros.asignatura]
 * @param {string} [filtros.grado]
 * @returns {Promise<Object[]>}
 */
export async function getStyleTemplatesForUser(uid, filtros = {}) {
  if (!db || !uid) return [];

  try {
    const col = collection(db, COLLECTIONS.KE_ESTILOS);
    const results = [];

    // Plantillas propias del docente (privadas + pendientes)
    const propias = [
      where("uid", "==", uid),
    ];
    if (filtros.asignatura) propias.push(where("asignatura", "==", filtros.asignatura));
    if (filtros.grado)      propias.push(where("grado",      "==", filtros.grado));

    const qPropias = query(col, ...propias, orderBy("creadoEn", "desc"));
    const snapPropias = await getDocs(qPropias);
    snapPropias.docs.forEach(d => results.push({ id: d.id, ...d.data() }));

    // Plantillas globales activas (pueden ser de cualquier docente)
    const globalesConditions = [
      where("visibilidad", "==", STYLE_VISIBILITY.GLOBAL),
      where("estado",      "==", STATES.ACTIVE),
    ];
    if (filtros.asignatura) globalesConditions.push(where("asignatura", "==", filtros.asignatura));
    if (filtros.grado)      globalesConditions.push(where("grado",      "==", filtros.grado));

    const qGlobales = query(col, ...globalesConditions, orderBy("creadoEn", "desc"));
    const snapGlobales = await getDocs(qGlobales);
    snapGlobales.docs.forEach(d => {
      // No duplicar si la plantilla global también es del mismo docente
      if (!results.find(r => r.id === d.id)) {
        results.push({ id: d.id, ...d.data() });
      }
    });

    return results;
  } catch {
    return [];
  }
}

/**
 * Retorna únicamente las plantillas con visibilidad "global" y estado "activo".
 *
 * @param {Object} [filtros]
 * @param {string} [filtros.asignatura]
 * @param {string} [filtros.grado]
 * @returns {Promise<Object[]>}
 */
export async function getGlobalStyleTemplates(filtros = {}) {
  if (!db) return [];

  try {
    const conditions = [
      where("visibilidad", "==", STYLE_VISIBILITY.GLOBAL),
      where("estado",      "==", STATES.ACTIVE),
    ];
    if (filtros.asignatura) conditions.push(where("asignatura", "==", filtros.asignatura));
    if (filtros.grado)      conditions.push(where("grado",      "==", filtros.grado));

    const q = query(
      collection(db, COLLECTIONS.KE_ESTILOS),
      ...conditions,
      orderBy("creadoEn", "desc"),
    );

    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

/**
 * Lista plantillas de estilo con filtros opcionales (para admin).
 *
 * @param {Object} [filtros]
 * @param {string} [filtros.estado]      - "pendiente" | "activo" | "inactivo"
 * @param {string} [filtros.visibilidad] - "privada" | "centro" | "global"
 * @param {string} [filtros.asignatura]
 * @param {string} [filtros.grado]
 * @returns {Promise<Object[]>}
 */
export async function getEstilos(filtros = {}) {
  if (!db) return [];
  try {
    const conditions = [];
    if (filtros.estado)      conditions.push(where("estado",      "==", filtros.estado));
    if (filtros.visibilidad) conditions.push(where("visibilidad", "==", filtros.visibilidad));
    if (filtros.asignatura)  conditions.push(where("asignatura",  "==", filtros.asignatura));
    if (filtros.grado)       conditions.push(where("grado",       "==", filtros.grado));

    const q = query(
      collection(db, COLLECTIONS.KE_ESTILOS),
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
 * Rechaza una plantilla → estado inactivo.
 */
export async function rechazarPlantilla(templateId) {
  if (!db) return;
  const uid = getAuth().currentUser?.uid ?? "anon";
  await setDoc(doc(db, COLLECTIONS.KE_ESTILOS, templateId), {
    estado:        STATES.INACTIVE,
    aprobadoPor:   uid,
    aprobadoEn:    serverTimestamp(),
    actualizadoEn: serverTimestamp(),
  }, { merge: true });
}

/**
 * Cambia la visibilidad de una plantilla activa.
 *
 * @param {string} templateId
 * @param {"privada"|"centro"|"global"} visibilidad
 */
export async function cambiarVisibilidad(templateId, visibilidad) {
  if (!db) return;
  await setDoc(doc(db, COLLECTIONS.KE_ESTILOS, templateId), {
    visibilidad,
    actualizadoEn: serverTimestamp(),
  }, { merge: true });
}

/**
 * Aprueba una plantilla de estilo y la publica como global.
 *
 * Solo admins deben llamar esta función (la autorización debe verificarse
 * en el caller o en reglas de Firestore).
 *
 * @param {string} templateId
 * @param {string} adminUid
 */
export async function aprobarPlantilla(templateId, adminUid) {
  if (!db) return;

  await setDoc(doc(db, COLLECTIONS.KE_ESTILOS, templateId), {
    visibilidad:   STYLE_VISIBILITY.GLOBAL,
    estado:        STATES.ACTIVE,
    aprobadoPor:   adminUid,
    aprobadoEn:    serverTimestamp(),
    actualizadoEn: serverTimestamp(),
  }, { merge: true });

  if (import.meta.env.DEV) {
    console.debug("[StyleQuery] aprobarPlantilla", { templateId, adminUid });
  }
}
