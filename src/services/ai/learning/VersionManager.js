/**
 * VersionManager — Control de versiones para el BIC.
 *
 * Registra cada modificación que un docente hace a una planificación generada
 * por IA. Estas versiones alimentan al AgenteAprendizaje para identificar
 * patrones de mejora recurrentes.
 *
 * Colección: bic_versiones
 * Estructura de cada versión:
 *   planId       — referencia al ítem en bic_planes
 *   tipo         — "planes" | "actividades" | "instrumentos"
 *   version      — número incremental
 *   cambios      — { agregado, eliminado, modificado }  (diff textual)
 *   motivoEstimado — categoría inferida del cambio
 *   creadoPor    — uid del docente
 *   fecha        — serverTimestamp
 */

import { db } from "../../../firebase.js";
import { getAuth } from "firebase/auth";
import {
  collection, addDoc, getDocs, query,
  where, orderBy, serverTimestamp,
} from "firebase/firestore";

const COL_VERSIONES = "bic_versiones";

const CATEGORIAS_CAMBIO = {
  TIEMPO:      "ajuste_tiempo",
  RECURSOS:    "cambio_recursos",
  ACTIVIDADES: "modificacion_actividades",
  COMPETENCIA: "ajuste_competencias",
  CONTEXTO:    "adaptacion_contexto",
  NEAE:        "adecuacion_neae",
  OTRO:        "otro",
};

// ── API pública ────────────────────────────────────────────────────────────────

/**
 * Crea una versión nueva cuando un docente modifica un ítem del BIC.
 *
 * @param {string} planId      - ID del documento en bic_planes / bic_actividades
 * @param {string} tipo        - "planes" | "actividades" | "instrumentos"
 * @param {Object} anterior    - Contenido antes de la edición
 * @param {Object} nuevo       - Contenido después de la edición
 * @param {number} versionActual - Número de versión actual del ítem
 * @returns {string|null} ID de la versión creada
 */
export async function crearVersion(planId, tipo, anterior, nuevo, versionActual = 1) {
  if (!db || !planId) return null;
  const uid = getAuth().currentUser?.uid ?? "anon";

  const cambios = diffContenido(anterior, nuevo);
  const motivoEstimado = inferirCategoria(cambios);

  const ref = await addDoc(collection(db, COL_VERSIONES), {
    planId,
    tipo,
    version: versionActual + 1,
    cambios,
    motivoEstimado,
    creadoPor: uid,
    fecha: serverTimestamp(),
  });

  if (import.meta.env.DEV) {
    console.debug(`[VersionManager] versión ${versionActual + 1} → ${planId}`, { motivoEstimado, cambios });
  }

  return ref.id;
}

/**
 * Obtiene todas las versiones de un ítem, ordenadas cronológicamente.
 * @param {string} planId
 * @returns {Object[]}
 */
export async function obtenerVersiones(planId) {
  if (!db || !planId) return [];

  const q = query(
    collection(db, COL_VERSIONES),
    where("planId", "==", planId),
    orderBy("fecha", "asc")
  );

  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Retorna las versiones más recientes de todos los planes (para AgenteAprendizaje).
 * @param {number} [limite=100]
 */
export async function obtenerVersionesRecientes(limite = 100) {
  if (!db) return [];

  const { getDocs: _gd, limit, orderBy: _ob } = await import("firebase/firestore");
  const q = query(
    collection(db, COL_VERSIONES),
    orderBy("fecha", "desc"),
    limit(limite)
  );

  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Diff y categorización ──────────────────────────────────────────────────────

/**
 * Calcula las diferencias entre dos objetos de contenido.
 * Compara a nivel de claves de primer nivel y texto.
 */
export function diffContenido(anterior, nuevo) {
  if (!anterior || !nuevo) return { agregado: [], eliminado: [], modificado: [] };

  const keys = new Set([...Object.keys(anterior), ...Object.keys(nuevo)]);
  const agregado   = [];
  const eliminado  = [];
  const modificado = [];

  for (const key of keys) {
    const valA = anterior[key];
    const valN = nuevo[key];

    if (valA === undefined && valN !== undefined) {
      agregado.push({ campo: key, valor: _resumir(valN) });
      continue;
    }
    if (valN === undefined && valA !== undefined) {
      eliminado.push({ campo: key, valorAnterior: _resumir(valA) });
      continue;
    }

    const strA = JSON.stringify(valA);
    const strN = JSON.stringify(valN);
    if (strA !== strN) {
      modificado.push({
        campo: key,
        anterior: _resumir(valA),
        nuevo:    _resumir(valN),
      });
    }
  }

  return { agregado, eliminado, modificado };
}

/**
 * Infiere la categoría del cambio basándose en los campos modificados.
 */
export function inferirCategoria(cambios) {
  const campos = [
    ...cambios.modificado.map(c => c.campo),
    ...cambios.agregado.map(c => c.campo),
    ...cambios.eliminado.map(c => c.campo),
  ];

  if (campos.some(c => /tiempo|duracion|minutos/i.test(c)))      return CATEGORIAS_CAMBIO.TIEMPO;
  if (campos.some(c => /recurso/i.test(c)))                       return CATEGORIAS_CAMBIO.RECURSOS;
  if (campos.some(c => /actividad/i.test(c)))                     return CATEGORIAS_CAMBIO.ACTIVIDADES;
  if (campos.some(c => /competencia|indicador/i.test(c)))         return CATEGORIAS_CAMBIO.COMPETENCIA;
  if (campos.some(c => /neae|adecuacion|inclusion/i.test(c)))     return CATEGORIAS_CAMBIO.NEAE;
  if (campos.some(c => /semana|fecha|calendario/i.test(c)))       return CATEGORIAS_CAMBIO.CONTEXTO;
  return CATEGORIAS_CAMBIO.OTRO;
}

export const CAMBIO_CATEGORIAS = CATEGORIAS_CAMBIO;

// ── Privadas ───────────────────────────────────────────────────────────────────

function _resumir(val) {
  if (typeof val === "string") return val.slice(0, 120);
  if (Array.isArray(val)) return `[${val.length} ítems]`;
  if (typeof val === "object" && val !== null) return `{${Object.keys(val).join(", ")}}`;
  return String(val ?? "");
}
