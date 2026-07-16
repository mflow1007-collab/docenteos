/**
 * avanceCurricularService — Fase 9 del hilo pedagógico: CIERRE DEL CICLO.
 *
 * Lee usuarios/{uid}/instrumentoResultados (Fase 4, escritos por Modo Aula /
 * Instrumentos) y expone:
 *   1. obtenerAvanceCurricular(cursoId)      → mapa semáforo por indicador
 *   2. obtenerIndicadoresDebiles(grado, asig) → códigos bajo el umbral, para
 *      que la SIGUIENTE unidad los reciba como (REFORZAR)
 *
 * La agregación es PURA y vive en hiloPedagogico.js (Fase 9, testeable en
 * Node); aquí solo el fetch, el matching tolerante de cursos y el caché.
 */

import { collection, getDocs } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../firebase.js";
import {
  normalizarTexto,
  agregarResultadosPorIndicador,
  indicadoresDebilesDeAvance,
} from "./hiloPedagogico.js";

const uid = () => getAuth().currentUser?.uid || "";

// Caché de sesión: el avance cambia solo cuando el docente evalúa; 60s evita
// releer la colección completa en cada render sin esconder datos frescos.
const CACHE_TTL_MS = 60_000;
let _cache = { uid: "", en: 0, resultados: null };

const leerResultados = async () => {
  const u = uid();
  if (!db || !u) return [];
  const ahora = Date.now();
  if (_cache.resultados && _cache.uid === u && ahora - _cache.en < CACHE_TTL_MS) {
    return _cache.resultados;
  }
  try {
    const snap = await getDocs(collection(db, "usuarios", u, "instrumentoResultados"));
    const resultados = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    _cache = { uid: u, en: ahora, resultados };
    return resultados;
  } catch {
    return _cache.uid === u ? (_cache.resultados || []) : [];
  }
};

export const invalidarCacheAvance = () => { _cache = { uid: "", en: 0, resultados: null }; };

// ── Matching tolerante de cursos (mismo criterio que planificacionDataService:
//    grado por primer token, asignatura/área por inclusión en ambos sentidos) ──

const _cursoCoincide = (curso = {}, grado = "", asignatura = "") => {
  const g = normalizarTexto(grado).split(" ")[0];
  const cg = normalizarTexto(curso.grado || curso.nombre || curso.name || "").split(" ")[0];
  if (g && cg && g !== cg) return false;
  const a = normalizarTexto(asignatura);
  if (!a) return true;
  const ca = normalizarTexto(
    [curso.area, curso.asignatura, curso.materia, curso.nombre, curso.name].filter(Boolean).join(" ")
  );
  return !ca || ca.includes(a) || a.includes(ca);
};

const cursoIdsDe = async (grado = "", asignatura = "") => {
  const u = uid();
  if (!db || !u) return [];
  try {
    const snap = await getDocs(collection(db, "usuarios", u, "cursos"));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((c) => _cursoCoincide(c, grado, asignatura))
      .map((c) => String(c.id));
  } catch {
    return [];
  }
};

// ── API pública ────────────────────────────────────────────────────────────────

/**
 * Mapa de avance del curso: logro agregado por indicador oficial.
 * @returns {{ porIndicador: Array, totalResultados: number }}
 */
export const obtenerAvanceCurricular = async ({ cursoId = "" } = {}) => {
  const todos = await leerResultados();
  const delCurso = cursoId
    ? todos.filter((r) => String(r.cursoId || "") === String(cursoId))
    : todos;
  return {
    porIndicador: agregarResultadosPorIndicador(delCurso),
    totalResultados: delCurso.length,
  };
};

/**
 * Avance de UN estudiante: sus propios resultados agregados por indicador
 * (promedio personal, nivel del hilo). Para el expediente. Nunca lanza.
 * @returns {{ porIndicador: Array, necesitaApoyo: Array, totalResultados: number }}
 */
export const obtenerAvanceEstudiante = async (estudianteId, { cursoId = "" } = {}) => {
  try {
    const id = String(estudianteId || "");
    if (!id) return { porIndicador: [], necesitaApoyo: [], totalResultados: 0 };
    const propios = (await leerResultados()).filter((r) =>
      String(r.estudianteId || "") === id
      && (!cursoId || String(r.cursoId || "") === String(cursoId)));
    const porIndicador = agregarResultadosPorIndicador(propios);
    return {
      porIndicador,
      // Con un solo estudiante, el promedio del indicador ES su promedio personal
      necesitaApoyo: porIndicador.filter((i) => i.promedio < 70),
      totalResultados: propios.length,
    };
  } catch {
    return { porIndicador: [], necesitaApoyo: [], totalResultados: 0 };
  }
};

/**
 * Códigos de indicador DÉBILES para el grado+asignatura (todos sus cursos).
 * La siguiente unidad los marca (REFORZAR). Nunca lanza: sin datos → [].
 */
export const obtenerIndicadoresDebiles = async (
  grado = "", asignatura = "", { umbral = 70, minEvaluaciones = 1 } = {},
) => {
  try {
    const ids = new Set(await cursoIdsDe(grado, asignatura));
    if (!ids.size) return [];
    const resultados = (await leerResultados()).filter((r) => ids.has(String(r.cursoId || "")));
    const avance = agregarResultadosPorIndicador(resultados);
    return indicadoresDebilesDeAvance(avance, { umbral, minEvaluaciones });
  } catch {
    return [];
  }
};
