/**
 * curriculumService.js
 *
 * Consulta bajo demanda el Diseño Curricular oficial almacenado en Firestore.
 * NUNCA carga el currículo completo en memoria; solo extrae lo que el docente
 * necesita en el momento en que selecciona Nivel / Grado / Área.
 *
 * Colección Firestore: "diseñoCurricular"
 * ID de documento: slugCurriculo(nivel, grado, area)
 */

import { db } from "../firebase.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

const COLECCION = "diseñoCurricular";

// ── Helpers ────────────────────────────────────────────────────────────────────

export const slugCurriculo = (nivel, grado, area) =>
  [nivel, grado, area]
    .map((s) =>
      String(s || "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "")
    )
    .join("__");

const estaDisponible = () => Boolean(db);

// ── Consulta base ──────────────────────────────────────────────────────────────

/**
 * Obtiene el documento curricular completo para un Nivel + Grado + Área.
 * Retorna null si no existe o si Firebase no está configurado.
 */
export const consultarCurriculo = async (nivel, grado, area) => {
  if (!estaDisponible()) return null;
  if (!nivel || !grado || !area) return null;

  try {
    const id = slugCurriculo(nivel, grado, area);
    const ref = doc(db, COLECCION, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  } catch (error) {
    console.error("[curriculumService] consultarCurriculo:", error);
    return null;
  }
};

// ── Consultas específicas ──────────────────────────────────────────────────────

/**
 * Retorna el array de competencias específicas para Nivel + Grado + Área.
 * Cada elemento: { id, descripcion, indicadoresLogro, contenidos, competenciaFundamental }
 */
export const obtenerCompetencias = async (nivel, grado, area) => {
  const data = await consultarCurriculo(nivel, grado, area);
  return data?.competencias ?? [];
};

/**
 * Retorna los indicadores de logro de una competencia específica.
 */
export const obtenerIndicadoresPorCompetencia = async (
  nivel,
  grado,
  area,
  competenciaId
) => {
  const competencias = await obtenerCompetencias(nivel, grado, area);
  const competencia = competencias.find((c) => c.id === competenciaId);
  return competencia?.indicadoresLogro ?? [];
};

/**
 * Retorna los contenidos (conceptuales, procedimentales, actitudinales)
 * de una competencia específica.
 */
export const obtenerContenidosPorCompetencia = async (
  nivel,
  grado,
  area,
  competenciaId
) => {
  const competencias = await obtenerCompetencias(nivel, grado, area);
  const competencia = competencias.find((c) => c.id === competenciaId);
  return (
    competencia?.contenidos ?? {
      conceptuales: [],
      procedimentales: [],
      actitudinales: [],
    }
  );
};

/**
 * Retorna los temas curriculares oficiales de la asignatura.
 */
export const obtenerTemasCurriculares = async (nivel, grado, area) => {
  const data = await consultarCurriculo(nivel, grado, area);
  return data?.temasCurriculares ?? [];
};

/**
 * Retorna los criterios de combinación temática para planificación de unidades largas (5+ semanas).
 * Cada elemento: { nombre, temas[], duracionSugerida, razon }
 */
export const obtenerCriteriosCombinacion = async (nivel, grado, area) => {
  const data = await consultarCurriculo(nivel, grado, area);
  return data?.criteriosCombinacionTematica ?? [];
};

/**
 * Retorna los contenidos generales de la asignatura (nivel, no por competencia).
 * { conceptuales[], procedimentales[], actitudinales[] }
 */
export const obtenerContenidosGenerales = async (nivel, grado, area) => {
  const data = await consultarCurriculo(nivel, grado, area);
  return (
    data?.contenidosGenerales ?? {
      conceptuales: [],
      procedimentales: [],
      actitudinales: [],
    }
  );
};

/**
 * Retorna las orientaciones metodológicas para la asignatura.
 */
export const obtenerOrientacionesMetodologicas = async (nivel, grado, area) => {
  const data = await consultarCurriculo(nivel, grado, area);
  return data?.orientacionesMetodologicas ?? [];
};

/**
 * Retorna el nivel de dominio MCER (A1, A2, B1, B2…) para la asignatura.
 */
export const obtenerNivelDominio = async (nivel, grado, area) => {
  const data = await consultarCurriculo(nivel, grado, area);
  return data?.nivelDominio ?? "";
};

/**
 * Retorna los posibles productos finales sugeridos para unidades de esta asignatura.
 */
export const obtenerProductosFinales = async (nivel, grado, area) => {
  const data = await consultarCurriculo(nivel, grado, area);
  return data?.posiblesProductosFinales ?? [];
};

/**
 * Retorna las competencias fundamentales asociadas a la asignatura.
 */
export const obtenerCompetenciasFundamentales = async (nivel, grado, area) => {
  const data = await consultarCurriculo(nivel, grado, area);
  return data?.competenciasFundamentales ?? [];
};

// ── Listas ─────────────────────────────────────────────────────────────────────

/**
 * Lista los grados que tienen currículo importado para un nivel dado.
 */
export const listarGradosDisponibles = async (nivel) => {
  if (!estaDisponible() || !nivel) return [];
  try {
    const q = query(
      collection(db, COLECCION),
      where("nivel", "==", nivel)
    );
    const snap = await getDocs(q);
    const grados = new Set();
    snap.forEach((d) => {
      const g = d.data()?.grado;
      if (g) grados.add(g);
    });
    return Array.from(grados).sort();
  } catch (error) {
    console.error("[curriculumService] listarGradosDisponibles:", error);
    return [];
  }
};

/**
 * Lista las áreas/asignaturas disponibles para un nivel + grado.
 */
export const listarAreasDisponibles = async (nivel, grado) => {
  if (!estaDisponible() || !nivel || !grado) return [];
  try {
    const q = query(
      collection(db, COLECCION),
      where("nivel", "==", nivel),
      where("grado", "==", grado)
    );
    const snap = await getDocs(q);
    const areas = [];
    snap.forEach((d) => {
      const a = d.data()?.area;
      if (a) areas.push(a);
    });
    return areas.sort();
  } catch (error) {
    console.error("[curriculumService] listarAreasDisponibles:", error);
    return [];
  }
};

/**
 * Verifica si existe currículo importado para Nivel + Grado + Área.
 */
export const tieneCurriculo = async (nivel, grado, area) => {
  const resultado = await consultarCurriculo(nivel, grado, area);
  return resultado !== null;
};

export default {
  consultarCurriculo,
  obtenerCompetencias,
  obtenerIndicadoresPorCompetencia,
  obtenerContenidosPorCompetencia,
  obtenerTemasCurriculares,
  obtenerCriteriosCombinacion,
  obtenerContenidosGenerales,
  obtenerOrientacionesMetodologicas,
  obtenerNivelDominio,
  obtenerProductosFinales,
  obtenerCompetenciasFundamentales,
  listarGradosDisponibles,
  listarAreasDisponibles,
  tieneCurriculo,
  slugCurriculo,
};
