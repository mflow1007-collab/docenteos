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
  updateDoc,
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
  if (!evidencia) { // resultado pendiente (nota quitada): su evidencia se retira, no se borra
    await retirarEvidenciaDeResultado(resultado);
    return null;
  }

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

/**
 * F7 — Al quitar una nota, la evidencia `evi-{resultadoId}` queda `retirada`
 * (reversible: re-evaluar la devuelve). Si nunca existió, no hay nada que hacer.
 */
export const retirarEvidenciaDeResultado = async (resultado) => {
  if (!disponible() || !resultado?.resultadoId) return;
  const evidenciaId = `evi-${resultado.resultadoId}`;
  const cambios = { retirada: true, retiradaEn: serverTimestamp(), actualizadoEn: serverTimestamp() };
  const refs = [doc(db, "usuarios", uid(), "evidenciasPedagogicas", evidenciaId)];
  if (resultado.cursoId && resultado.estudianteId) {
    refs.push(doc(db, "usuarios", uid(), "cursos", String(resultado.cursoId), "estudiantes", String(resultado.estudianteId), "evidencias", evidenciaId));
  }
  await Promise.all(refs.map((ref) => updateDoc(ref, cambios).catch((error) => {
    if (error?.code !== "not-found") throw error;
  })));
};

/**
 * Banco completo de un estudiante (con filtro opcional por curso).
 * `idsLegado`: IDs con los que se guardaron evidencias antes de la regla única
 * (utils/idEstudiante.js); se leen también para no perderlas.
 */
export const obtenerEvidenciasPorEstudiante = async (estudianteId, { cursoId = "", idsLegado = [] } = {}) => {
  if (!disponible()) return [];
  const ids = [...new Set([estudianteId, ...idsLegado].filter(Boolean).map(String))].slice(0, 30); // límite de "in"
  const snap = await getDocs(query(
    colEvidencias(),
    ids.length > 1 ? where("estudianteId", "in", ids) : where("estudianteId", "==", String(estudianteId)),
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
