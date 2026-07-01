import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase.js';

// ─── ID determinístico por estudiante dentro de un curso ──────────────────────
export function estudianteDocId(cursoId, estId) {
  return `${cursoId}_${estId}`;
}

// ─── Calcula promedio final a partir de las notas del Registro ────────────────
function calcularPromedioDesdeNotas(notas) {
  if (!notas?.competencias) return null;
  const compAvgs = notas.competencias.map((comp) => {
    const finals = comp.periodos.map((per) => {
      const p = Number(per.p) || 0;
      const rp = Number(per.rp) || 0;
      return p >= 70 ? p : rp > 0 ? rp : p;
    });
    const validos = finals.filter((v) => v > 0);
    return validos.length
      ? Math.round((validos.reduce((a, b) => a + b, 0) / validos.length) * 10) / 10
      : 0;
  });
  const cfValidos = compAvgs.filter((v) => v > 0);
  return cfValidos.length
    ? Math.round((cfValidos.reduce((a, b) => a + b, 0) / cfValidos.length) * 10) / 10
    : null;
}

// ─── Calcula % de asistencia de un estudiante ─────────────────────────────────
function calcularAsistenciaDesdeRegistro(asistenciaRegistro, estId) {
  if (!Array.isArray(asistenciaRegistro)) return null;
  const reg = asistenciaRegistro.find((a) => a.id === estId);
  if (!reg?.meses) return null;
  const todos = Object.values(reg.meses).flatMap((s) => s.flat());
  const total = todos.filter((x) => x !== '').length;
  if (!total) return null;
  const presentes =
    todos.filter((x) => x === 'P').length +
    Math.floor(todos.filter((x) => x === 'E').length / 2);
  return Math.round((presentes / total) * 100);
}

// ─── Construye lista de evaluaciones legibles desde las notas ─────────────────
function buildEvaluaciones(notas, area) {
  if (!notas?.competencias) return [];
  const hoy = new Date().toLocaleDateString('es-DO', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  const items = [];
  notas.competencias.forEach((comp, ci) => {
    comp.periodos.forEach((per, pi) => {
      const p = Number(per.p);
      const rp = Number(per.rp);
      if (p > 0) {
        items.push({
          fecha: hoy,
          actividad: `Período ${pi + 1} — Competencia ${ci + 1}`,
          area,
          calificacion: `${p}%`,
          estado: p >= 70 ? 'Aprobado' : 'En riesgo',
          observacion: rp > 0 ? `Recuperación: ${rp}%` : '',
        });
      }
    });
  });
  return items;
}

// ─── Construye entradas de timeline para el estudiante ────────────────────────
function buildTimeline({ est, notas, asistenciaRegistro, cursoNombre, area }) {
  const entries = [];
  const hoy = new Date().toLocaleDateString('es-DO', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  const ts = Date.now();

  // Evaluaciones por período
  notas?.competencias?.forEach((comp, ci) => {
    comp.periodos.forEach((per, pi) => {
      const valor = Number(per.p) || 0;
      if (valor > 0) {
        entries.push({
          id: `eval_c${ci}_p${pi}_${ts}`,
          fecha: hoy,
          tipo: 'evaluacion',
          titulo: `Período ${pi + 1} · Competencia ${ci + 1}`,
          subtitulo: `${area} · ${valor}%`,
          valor,
          icono: '📝',
          area,
          cursoNombre,
        });
      }
    });
  });

  // Asistencia por mes
  const reg = Array.isArray(asistenciaRegistro)
    ? asistenciaRegistro.find((a) => a.id === est.id)
    : null;
  if (reg?.meses) {
    Object.entries(reg.meses).forEach(([mes, semanas]) => {
      const flat = semanas.flat();
      const total = flat.filter((x) => x !== '').length;
      if (!total) return;
      const presentes =
        flat.filter((x) => x === 'P').length +
        Math.floor(flat.filter((x) => x === 'E').length / 2);
      const pct = Math.round((presentes / total) * 100);
      entries.push({
        id: `asis_${mes}_${ts}`,
        fecha: hoy,
        tipo: 'asistencia',
        titulo: `Asistencia ${mes}`,
        subtitulo: `${pct}% — ${presentes} de ${total} días`,
        valor: pct,
        icono: '📅',
        area,
        cursoNombre,
      });
    });
  }

  return entries;
}

// ─── Escribe el expediente de todos los estudiantes (fire-and-forget) ─────────
export async function escribirExpedienteDesdeRegistro({
  estudiantes,
  notasEstudiantes,
  asistencia: asistenciaRegistro,
  observaciones,
  cursoId,
  cursoNombre,
  area,
  grado,
  estudiantesModificados = null,
}) {
  if (!auth?.currentUser || !db) return;
  const uid = auth.currentUser.uid;

  // Si se pasa una lista de IDs modificados, solo actualizar esos estudiantes
  const filtro = estudiantesModificados ? new Set(estudiantesModificados) : null;
  const estudiantesAActualizar = filtro
    ? estudiantes.filter((est) => filtro.has(est.id))
    : estudiantes;

  if (estudiantesAActualizar.length === 0) return;

  const writes = estudiantesAActualizar.map(async (est) => {
    const docId = estudianteDocId(cursoId, est.id);
    const notas = notasEstudiantes?.[est.id] ?? null;
    const promedio = calcularPromedioDesdeNotas(notas) ?? est.promedio ?? null;
    const asistenciaPct =
      calcularAsistenciaDesdeRegistro(asistenciaRegistro, est.id) ??
      est.asistencia ??
      null;
    const evaluaciones = buildEvaluaciones(notas, area);
    const nuevoTimeline = buildTimeline({
      est, notas, asistenciaRegistro, cursoNombre, area,
    });

    const ref = doc(db, 'usuarios', uid, 'expedientesEstudiantes', docId);

    // Leer timeline existente para hacer merge (max 60 entradas)
    let timelinePrevio = [];
    try {
      const snap = await getDoc(ref);
      if (snap.exists()) timelinePrevio = snap.data().timeline ?? [];
    } catch { /* sin acceso previo, empezar limpio */ }

    // Deduplicar por id y truncar
    const idsNuevos = new Set(nuevoTimeline.map((e) => e.id));
    const merged = [
      ...nuevoTimeline,
      ...timelinePrevio.filter((e) => !idsNuevos.has(e.id)),
    ].slice(0, 60);

    await setDoc(
      ref,
      {
        id: docId,
        nombre: est.nombre,
        cursoId,
        cursoNombre,
        area,
        grado,
        promedio,
        asistenciaPct,
        evaluaciones,
        observacion: observaciones?.[est.id] ?? '',
        timeline: merged,
        actualizadoEn: serverTimestamp(),
      },
      { merge: true }
    );
  });

  await Promise.allSettled(writes);
}

// ─── Lee el expediente de un estudiante ──────────────────────────────────────
export async function obtenerExpedienteEstudiante(cursoId, estId) {
  if (!auth?.currentUser || !db) return null;
  const uid = auth.currentUser.uid;
  const ref = doc(db, 'usuarios', uid, 'expedientesEstudiantes', estudianteDocId(cursoId, estId));
  try {
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}
