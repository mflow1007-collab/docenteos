/**
 * asistenciaService — Pase de lista real (HITO 3.1 del roadmap).
 *
 * Antes: usuarios/{uid}/estudiantes/{estId}.asistencia era un campo muerto
 * (null desde la creación). Ahora:
 *   usuarios/{uid}/cursos/{cursoId}/asistencia/{fecha}  ← un doc por día
 *     { cursoId, fecha, marcas: { estId: estado }, resumen, updatedAt }
 * ID determinista = fecha (YYYY-MM-DD): re-marcar el mismo día actualiza el
 * mismo doc (idempotente, patrón del hilo). Tras guardar, se recalcula el %
 * de asistencia por estudiante y se actualiza SU campo existente con
 * merge/updateDoc parcial — las vistas que ya leen `asistencia` (Estudiantes,
 * expediente) se encienden solas sin tocarlas.
 */

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../firebase.js";

const uid = () => auth?.currentUser?.uid ?? null;

export const ESTADOS_ASISTENCIA = ["presente", "tarde", "excusa", "ausente"];
export const ETIQUETA_ASISTENCIA = {
  presente: "Presente", tarde: "Tardanza", excusa: "Excusa", ausente: "Ausente",
};

export const hoyISO = () => new Date().toISOString().slice(0, 10);

// Presente y tardanza cuentan como asistencia; excusa y ausente no.
const CUENTA_COMO_PRESENTE = new Set(["presente", "tarde"]);

export const resumenDeMarcas = (marcas = {}) => {
  const resumen = { presente: 0, tarde: 0, excusa: 0, ausente: 0, total: 0 };
  for (const estado of Object.values(marcas)) {
    if (resumen[estado] === undefined) continue;
    resumen[estado] += 1;
    resumen.total += 1;
  }
  return resumen;
};

const colAsistencia = (cursoId) =>
  collection(db, "usuarios", uid(), "cursos", String(cursoId), "asistencia");

/** Pase de lista de un día. null si no se ha pasado lista esa fecha. */
export const obtenerPaseLista = async (cursoId, fecha = hoyISO()) => {
  if (!db || !uid() || !cursoId) return null;
  try {
    const snap = await getDoc(doc(colAsistencia(cursoId), fecha));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
};

/**
 * Guarda el pase de lista del día (merge:true — regla de producción) y
 * actualiza el % de asistencia de cada estudiante marcado. La actualización
 * de porcentajes es best-effort: su fallo nunca pierde el pase de lista.
 */
export const guardarPaseLista = async ({ cursoId, fecha = hoyISO(), marcas = {} }) => {
  if (!db || !uid()) throw new Error("Usuario no autenticado");
  if (!cursoId) throw new Error("cursoId es obligatorio");
  const marcasValidas = Object.fromEntries(
    Object.entries(marcas).filter(([, v]) => ESTADOS_ASISTENCIA.includes(v))
  );
  if (!Object.keys(marcasValidas).length) throw new Error("No hay estudiantes marcados");

  await setDoc(doc(colAsistencia(cursoId), fecha), {
    cursoId: String(cursoId),
    fecha,
    marcas: marcasValidas,
    resumen: resumenDeMarcas(marcasValidas),
    updatedAt: serverTimestamp(),
  }, { merge: true });

  let porcentajes = {};
  try {
    porcentajes = await _actualizarPorcentajes(cursoId);
  } catch { /* best-effort */ }
  return { fecha, resumen: resumenDeMarcas(marcasValidas), porcentajes };
};

/** % por estudiante sobre TODOS los días con lista pasada en el curso. */
const _actualizarPorcentajes = async (cursoId) => {
  const dias = (await getDocs(colAsistencia(cursoId))).docs.map((d) => d.data());
  if (!dias.length) return {};
  const porEstudiante = new Map(); // estId → { presentes, dias }
  for (const dia of dias) {
    for (const [estId, estado] of Object.entries(dia.marcas || {})) {
      const acc = porEstudiante.get(estId) || { presentes: 0, dias: 0 };
      acc.dias += 1;
      if (CUENTA_COMO_PRESENTE.has(estado)) acc.presentes += 1;
      porEstudiante.set(estId, acc);
    }
  }
  // Solo estudiantes con doc REAL en usuarios/{uid}/estudiantes: los ids
  // sintéticos del aula (est-1…) no deben crear documentos fantasma.
  const existentes = new Set(
    (await getDocs(collection(db, "usuarios", uid(), "estudiantes"))).docs.map((d) => d.id)
  );
  const porcentajes = {};
  for (const [estId, { presentes, dias: n }] of porEstudiante) {
    const pct = Math.round((presentes / n) * 100);
    porcentajes[estId] = pct;
    if (!existentes.has(estId)) continue;
    try {
      // updateDoc parcial: solo el campo asistencia — jamás pisa notas u otros
      await updateDoc(doc(db, "usuarios", uid(), "estudiantes", estId), {
        asistencia: pct, updatedAt: serverTimestamp(),
      });
    } catch { /* no-fatal por estudiante */ }
  }
  return porcentajes;
};
