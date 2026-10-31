/**
 * actividadesService.js — F2: actividades del plan (entregas de fase).
 *
 * Colección: usuarios/{uid}/actividades/{act-<planId>-f<n>} (decisión A1).
 * Las entregas por estudiante van dentro del doc (17 estudiantes ≈ 3–8 KB,
 * lejos de 1 MiB). La lógica vive en actividadesPlan.js (puro).
 * Escrituras parciales con merge: nunca destructivo.
 */

import { collection, doc, FieldPath, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { db, auth, obtenerCursos } from "../firebase.js";
import { obtenerEstudiantesPorCurso } from "./estudiantesService.js";
import { idEstudiante, nombreDeEstudiante } from "../utils/idEstudiante.js";
import { crearEvidencia } from "./evidenciasService.js";
import {
  aplicarEntrega, construirActividadesDesdePlan, construirEvidenciaDeEntrega, fusionarActividad, unidadDePlan,
} from "./actividadesPlan.js";

const uid = () => auth?.currentUser?.uid;
const refActividad = (id) => doc(db, "usuarios", uid(), "actividades", String(id));
const refInstrumento = (id) => doc(db, "usuarios", uid(), "instrumentos", String(id));

// Misma fuente y mismo ID que Modo Aula: lista embebida del curso o, si no
// hay, la subcolección de estudiantes.
const estudiantesDelCurso = async (cursoId) => {
  const cursos = await obtenerCursos();
  const curso = (cursos?.data || []).find((c) => String(c.id) === String(cursoId));
  const embebidos = curso?.estudiantesDetalle?.length ? curso.estudiantesDetalle
    : curso?.estudiantesLista?.length ? curso.estudiantesLista
    : curso?.estudiantesNombres?.length ? curso.estudiantesNombres
    : null;
  const fuente = embebidos || await obtenerEstudiantesPorCurso(String(cursoId));
  return fuente
    .map((est, i) => ({ id: idEstudiante(est, i), nombre: nombreDeEstudiante(est) }))
    .filter((est) => est.nombre);
};

/**
 * Crea (o actualiza sin pisar lo del docente) las actividades de un plan con
 * plan maestro y curso, y la rúbrica de cada una.
 * @returns {{ actividades, avisos, omitido?: string }}
 */
export const guardarActividadesDePlan = async (registroPlan) => {
  const unidad = unidadDePlan(registroPlan);
  if (!unidad?.planMaestro?.fases?.length) return { actividades: [], avisos: [], omitido: "sin plan maestro" };
  if (!db || !uid()) throw new Error("Necesitas iniciar sesión para crear las actividades del plan");
  const capa = registroPlan?.capaCurricular || registroPlan?.contenido?.capaCurricular;
  const cursoId = String(registroPlan?.cursoId || capa?.cursoId || "");
  const planificacionId = String(registroPlan?.id || "");

  const estudiantes = await estudiantesDelCurso(cursoId);
  const { actividades, instrumentos, avisos } = construirActividadesDesdePlan({
    planificacionId, cursoId, capa, unidad, estudiantes,
  });

  for (const instrumento of instrumentos) {
    await setDoc(refInstrumento(instrumento.id), { ...instrumento, uid: uid(), updatedAt: serverTimestamp() }, { merge: true });
  }
  const guardadas = [];
  for (const actividad of actividades) {
    const previa = await getDoc(refActividad(actividad.id));
    const final = fusionarActividad(actividad, previa.exists() ? previa.data() : null);
    // merge:true añade claves nuevas en `entregas`; las ya marcadas vienen de `previa`.
    await setDoc(refActividad(final.id), { ...final, uid: uid(), updatedAt: serverTimestamp() }, { merge: true });
    guardadas.push(final);
  }
  return { actividades: guardadas, avisos };
};

export const obtenerActividadesPorPlanificacion = async (planificacionId) => {
  if (!db || !uid() || !planificacionId) return [];
  const snap = await getDocs(query(
    collection(db, "usuarios", uid(), "actividades"),
    where("planificacionId", "==", String(planificacionId)),
  ));
  return snap.docs.map((d) => ({ ...d.data(), id: d.id })).sort((a, b) => a.faseNumero - b.faseNumero);
};

/** El docente cambia la fecha o desactiva/reactiva (reversible). */
export const actualizarActividad = async (actividadId, { fechaAjustada, activa } = {}) => {
  if (!db || !uid()) throw new Error("Necesitas iniciar sesión para cambiar la actividad");
  const cambios = { updatedAt: serverTimestamp() };
  if (fechaAjustada !== undefined) cambios.fechaAjustada = fechaAjustada || null;
  if (activa !== undefined) cambios.activa = Boolean(activa);
  await updateDoc(refActividad(actividadId), cambios);
};

/** Actividades de un curso (ficha del estudiante: sus entregas y pendientes). */
export const obtenerActividadesPorCurso = async (cursoId) => {
  if (!db || !uid() || !cursoId) return [];
  const snap = await getDocs(query(
    collection(db, "usuarios", uid(), "actividades"),
    where("cursoId", "==", String(cursoId)),
  ));
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
};

/**
 * F3 — Marca la entrega de UN estudiante (y su enlace opcional). Solo escribe
 * `entregas.<estId>` de la actividad: no toca resultados ni Registro
 * (decisión 3). Con enlace, crea/actualiza UNA evidencia en el banco con ID
 * determinista (actividad + estudiante).
 * @returns {{ entrega, avisoEvidencia: string }} — la entrega ya guardada y,
 *          si el enlace no llegó al banco, el motivo (visible en pantalla).
 */
export const marcarEntrega = async (actividad, estudianteId, { estado, enlace } = {}) => {
  if (!db || !uid()) throw new Error("Necesitas iniciar sesión para marcar entregas");
  if (!actividad?.id || !estudianteId) throw new Error("Falta la actividad o el estudiante");
  const previa = actividad.entregas?.[estudianteId] || {};
  const entrega = aplicarEntrega(previa, { estado, enlace });
  const evidencia = construirEvidenciaDeEntrega(actividad, estudianteId, entrega);
  if (evidencia) entrega.evidenciaId = evidencia.evidenciaId;
  else if (previa.evidenciaId) entrega.evidenciaId = previa.evidenciaId; // la evidencia ya guardada se conserva

  // FieldPath: el ID del estudiante puede traer puntos u otros caracteres.
  await updateDoc(refActividad(actividad.id), new FieldPath("entregas", String(estudianteId)), entrega, "updatedAt", serverTimestamp());
  let avisoEvidencia = "";
  if (evidencia) {
    try {
      await crearEvidencia(evidencia);
    } catch (e) {
      avisoEvidencia = `La entrega quedó marcada, pero el enlace no se guardó como evidencia: ${e.message}`;
    }
  }
  return { entrega, avisoEvidencia };
};
