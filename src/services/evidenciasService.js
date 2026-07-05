/**
 * evidenciasService.js — Fase 8 del hilo pedagógico
 *
 * Banco de Evidencias del estudiante: toda evidencia queda vinculada a
 * estudiante + curso + planificación + clase + indicador (+ instrumento).
 *
 * Colecciones reales (doble escritura ya existente en firebase.js):
 *   usuarios/{uid}/cursos/{cursoId}/estudiantes/{estId}/evidencias/{evidenciaId}
 *   usuarios/{uid}/evidenciasPedagogicas/{evidenciaId}   (índice plano consultable)
 *
 * La vinculación bidireccional se completa escribiendo el evidenciaId en
 * instrumentoResultados.evidenciasIds.
 */

import {
  arrayUnion,
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db, auth, guardarEvidenciaEstudiante } from "../firebase.js";
import { construirEvidenciaDesdeResultado as construirEvidencia } from "./hiloPedagogico.js";

const uid = () => auth?.currentUser?.uid;
const disponible = () => Boolean(db && uid());

const colEvidencias = () => collection(db, "usuarios", uid(), "evidenciasPedagogicas");
const refResultado = (resultadoId) =>
  doc(db, "usuarios", uid(), "instrumentoResultados", String(resultadoId));

/** Crea/actualiza una evidencia genérica garantizando el contexto pedagógico. */
export const crearEvidencia = async (evidencia) => {
  if (!evidencia?.estudianteId || !evidencia?.cursoId) {
    throw new Error("Toda evidencia necesita estudianteId y cursoId");
  }
  const { data } = await guardarEvidenciaEstudiante({
    tipo: "otro",
    origen: "manual",
    ...evidencia,
    indicadorIds: evidencia.indicadorIds || [],
  });
  return data;
};

/**
 * FASE 8 — Evidencia automática desde un resultado de instrumento (Fase 4).
 * ID determinista `evi-{resultadoId}`: re-evaluar actualiza la misma evidencia.
 * Actualiza también resultado.evidenciasIds (vínculo bidireccional).
 */
export const crearEvidenciaDesdeResultado = async (resultado, { instrumento = null, claseTitulo = "" } = {}) => {
  const evidencia = construirEvidencia(resultado, { instrumento, claseTitulo, docenteId: uid() || "" });
  if (!evidencia) return null; // resultado pendiente: sin evaluación no hay evidencia

  const evidenciaId = evidencia.evidenciaId;
  const { data } = await guardarEvidenciaEstudiante(evidencia);

  // Vínculo bidireccional resultado ↔ evidencia (no bloquea si falla)
  if (disponible()) {
    try {
      await setDoc(refResultado(resultado.resultadoId), {
        evidenciasIds: arrayUnion(evidenciaId),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (error) {
      console.warn("[evidenciasService] Evidencia creada, pero no se pudo enlazar al resultado:", error);
    }
  }

  return data;
};

/** Banco completo de un estudiante (con filtro opcional por curso). */
export const obtenerEvidenciasPorEstudiante = async (estudianteId, { cursoId = "" } = {}) => {
  if (!disponible()) return [];
  const snap = await getDocs(query(
    colEvidencias(),
    where("estudianteId", "==", String(estudianteId)),
    limit(500)
  ));
  const datos = snap.docs.map((d) => ({ ...d.data(), id: d.id, evidenciaId: d.id }));
  const filtradas = cursoId ? datos.filter((e) => String(e.cursoId) === String(cursoId)) : datos;
  return filtradas.sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")));
};

/** Evidencias que trabajan un indicador oficial (avance por indicador). */
export const obtenerEvidenciasPorIndicador = async (indicadorId, { cursoId = "" } = {}) => {
  if (!disponible()) return [];
  const snap = await getDocs(query(
    colEvidencias(),
    where("indicadorIds", "array-contains", String(indicadorId)),
    limit(500)
  ));
  const datos = snap.docs.map((d) => ({ ...d.data(), id: d.id, evidenciaId: d.id }));
  return cursoId ? datos.filter((e) => String(e.cursoId) === String(cursoId)) : datos;
};

/** Evidencias de una planificación (vista por secuencia). */
export const obtenerEvidenciasPorPlanificacion = async (planificacionId) => {
  if (!disponible()) return [];
  const snap = await getDocs(query(
    colEvidencias(),
    where("planificacionId", "==", String(planificacionId)),
    limit(500)
  ));
  return snap.docs.map((d) => ({ ...d.data(), id: d.id, evidenciaId: d.id }));
};
