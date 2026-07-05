/**
 * registroService.js — Fase 2 del hilo pedagógico
 *
 * Los aspectos de Mi Registro NACEN de los indicadores de logro usados en la
 * planificación. El docente no los escribe dos veces.
 *
 * Colección real (ya la lee la pestaña "Aspectos" del Registro):
 *   usuarios/{uid}/cursos/{cursoId}/registroAspectos/{aspectoId}
 *
 * Idempotencia: aspectoId = `${planificacionId}_${indicadorId}` (determinista).
 * Ejecutar dos veces la generación NO duplica; los aspectos con
 * modificadoManual = true no se sobreescriben (regla 7: los ajustes manuales
 * del docente no rompen la automatización).
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db, auth } from "../firebase.js";
import {
  generarAspectosDesdeCapa,
  derivarPuntajesAspectos,
  consolidarNotaAspecto,
  aplicarRecalculoRegistro,
} from "./hiloPedagogico.js";

const uid = () => auth?.currentUser?.uid;
const disponible = () => Boolean(db && uid());

const refAspecto = (cursoId, aspectoId) =>
  doc(db, "usuarios", uid(), "cursos", String(cursoId), "registroAspectos", String(aspectoId));

const colAspectos = (cursoId) =>
  collection(db, "usuarios", uid(), "cursos", String(cursoId), "registroAspectos");

/**
 * FASE 2 — Genera (o completa) los aspectos del registro desde la capa
 * curricular de una planificación guardada. IDEMPOTENTE.
 *
 * @param {object} registroPlan  Doc de `planificaciones` (necesita id y
 *   capaCurricular; acepta también { id, capaCurricular } directo).
 * @param {object} opciones      { cursoId } para forzar el curso destino.
 * @returns {{ creados: string[], existentes: string[], protegidos: string[], aspectos: object[] }}
 */
export const generarAspectosRegistroDesdePlanificacion = async (registroPlan, { cursoId = "" } = {}) => {
  if (!disponible()) throw new Error("Necesitas iniciar sesión para generar los aspectos del registro");

  const planificacionId = String(registroPlan?.id || registroPlan?.planificacionId || "");
  const capa = registroPlan?.capaCurricular || registroPlan?.contenido?.capaCurricular;
  if (!planificacionId) throw new Error("La planificación no tiene id de Firestore");
  if (!capa) {
    throw new Error(
      "La planificación no tiene capa curricular. Guarda el plan con crearPlanificacion() " +
      "o ejecútale backfillCapaCurricular() primero."
    );
  }

  const cursoDestino = String(cursoId || capa.cursoId || "");
  if (!cursoDestino) throw new Error("No se pudo determinar el curso destino de los aspectos (cursoId)");

  const candidatos = generarAspectosDesdeCapa(capa, { planificacionId, cursoId: cursoDestino });
  if (!candidatos.length) {
    return { creados: [], existentes: [], protegidos: [], aspectos: [] };
  }

  // Estado actual: idempotencia real contra Firestore, no contra memoria
  const existentesSnap = await getDocs(
    query(colAspectos(cursoDestino), where("planificacionId", "==", planificacionId))
  );
  const existentesMap = new Map(existentesSnap.docs.map((d) => [d.id, d.data()]));

  const batch = writeBatch(db);
  const creados = [];
  const existentes = [];
  const protegidos = [];

  for (const aspecto of candidatos) {
    const previo = existentesMap.get(aspecto.aspectoId);
    if (previo) {
      if (previo.modificadoManual) {
        protegidos.push(aspecto.aspectoId);
      } else {
        existentes.push(aspecto.aspectoId);
      }
      continue; // ya existe: no duplicar ni sobreescribir
    }
    batch.set(refAspecto(cursoDestino, aspecto.aspectoId), {
      ...aspecto,
      id: aspecto.aspectoId,
      uid: uid(),
      actualizadoEn: serverTimestamp(),
    }, { merge: true });
    creados.push(aspecto.aspectoId);
  }

  if (creados.length) await batch.commit();

  return { creados, existentes, protegidos, aspectos: candidatos };
};

/** Aspectos de un curso vinculados a una planificación concreta. */
export const obtenerAspectosPorPlanificacion = async (cursoId, planificacionId) => {
  if (!disponible()) return [];
  const snap = await getDocs(
    query(colAspectos(cursoId), where("planificacionId", "==", String(planificacionId)))
  );
  return snap.docs
    .map((d) => ({ ...d.data(), id: d.id, aspectoId: d.id }))
    .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));
};

/** Aspectos de un curso vinculados a un indicador oficial (avance por indicador). */
export const obtenerAspectosPorIndicador = async (cursoId, indicadorId) => {
  if (!disponible()) return [];
  const snap = await getDocs(
    query(colAspectos(cursoId), where("indicadorId", "==", String(indicadorId)))
  );
  return snap.docs.map((d) => ({ ...d.data(), id: d.id, aspectoId: d.id }));
};

// ─── Fase 5 — Mi Registro como vista consolidada ─────────────────────────────
//
// La "nota por aspecto" vive en la subcolección REAL que ya lee la pestaña
// Instrumentos del Registro:
//   usuarios/{uid}/cursos/{cursoId}/registroNotas/{estudianteId_aspectoId}
//
// Se extiende con los campos del hilo:
//   valorCalculado, valorFinal (= valorObtenido legacy), ajusteManual,
//   motivoAjuste, desactualizado, origenResultados, ultimaActualizacionAutomatica

const refNota = (cursoId, notaId) =>
  doc(db, "usuarios", uid(), "cursos", String(cursoId), "registroNotas", String(notaId));

export const crearNotaId = (estudianteId, aspectoId) => `${estudianteId}_${aspectoId}`;

/**
 * Sincroniza el puntaje de los aspectos con la ponderación de los instrumentos
 * vinculados (decisión de producto: derivado por defecto, editable).
 * Los aspectos con modificadoManual = true no se tocan.
 */
export const sincronizarPuntajesAspectos = async ({ cursoId, planificacionId, instrumentos }) => {
  if (!disponible()) return { actualizados: [] };
  const aspectos = await obtenerAspectosPorPlanificacion(cursoId, planificacionId);
  if (!aspectos.length || !instrumentos?.length) return { actualizados: [] };

  const puntajes = derivarPuntajesAspectos(instrumentos, aspectos.map((a) => a.aspectoId));
  if (!puntajes.size) return { actualizados: [] };

  const batch = writeBatch(db);
  const actualizados = [];
  for (const aspecto of aspectos) {
    const nuevo = puntajes.get(aspecto.aspectoId);
    if (nuevo === undefined || aspecto.modificadoManual || Number(aspecto.puntajeMaximo) === nuevo) continue;
    batch.set(refAspecto(cursoId, aspecto.aspectoId), {
      puntajeMaximo: nuevo,
      puntajeDerivadoDePonderacion: true,
      fechaActualizacion: new Date().toISOString(),
      actualizadoEn: serverTimestamp(),
    }, { merge: true });
    actualizados.push(aspecto.aspectoId);
  }
  if (actualizados.length) await batch.commit();
  return { actualizados };
};

/**
 * FASE 5 — Actualiza Mi Registro desde un resultado de instrumento.
 *
 * Para cada aspecto que alimenta el instrumento evaluado:
 *  1. consolida la nota del estudiante con TODOS los resultados del plan
 *     (reglas 10-11: pendiente ≠ 0, parcial, ponderación normalizada)
 *  2. aplica la regla 12 sobre la nota previa (ajuste manual respetado,
 *     desactualizado marcado, nunca pisar sin acción del docente)
 *
 * Todas las escrituras van en UN batch (sin estados a medias).
 *
 * @param {object} resultado    Doc de instrumentoResultados recién guardado
 * @param {object} contexto     { instrumentos, resultadosEstudiante } ya cargados
 *                              (los carga instrumentosService para evitar dobles lecturas)
 * @returns {{ notas: object[], desactualizadas: string[] }}
 */
export const actualizarRegistroDesdeResultadoInstrumento = async (resultado, { instrumentos, resultadosEstudiante }) => {
  if (!disponible()) throw new Error("Necesitas iniciar sesión para actualizar el registro");
  const cursoId = String(resultado.cursoId || "");
  if (!cursoId) throw new Error("El resultado no tiene cursoId; no se puede actualizar el registro");

  const aspectoIds = resultado.aspectoRegistroIds || [];
  if (!aspectoIds.length) return { notas: [], desactualizadas: [] };

  const aspectosPlan = await obtenerAspectosPorPlanificacion(cursoId, resultado.planificacionId);
  const ahora = new Date().toISOString();
  const batch = writeBatch(db);
  const notas = [];
  const desactualizadas = [];

  for (const aspectoId of aspectoIds) {
    const aspecto = aspectosPlan.find((a) => a.aspectoId === aspectoId);
    if (!aspecto) continue; // aspecto aún no generado: no inventar columnas

    const consolidado = consolidarNotaAspecto({
      aspecto,
      instrumentos,
      resultados: resultadosEstudiante,
    });
    if (consolidado.valorCalculadoPuntos === null) continue;

    const notaId = crearNotaId(resultado.estudianteId, aspectoId);
    const previoSnap = await getDoc(refNota(cursoId, notaId));
    const previo = previoSnap.exists() ? previoSnap.data() : null;

    // Regla 12 sobre la forma registro { valorCalculado, valorFinal, ajusteManual }
    const registroPrevio = previo ? {
      valorCalculado: previo.valorCalculado ?? null,
      valorFinal: previo.valorObtenido === "" || previo.valorObtenido === undefined ? null : Number(previo.valorObtenido),
      ajusteManual: Boolean(previo.ajusteManual),
      motivoAjuste: previo.motivoAjuste || "",
    } : null;

    const recalculado = aplicarRecalculoRegistro(registroPrevio, {
      valorCalculado: consolidado.valorCalculadoPuntos,
      esParcial: consolidado.esParcial,
      origenResultados: consolidado.origenResultados,
    }, ahora);

    const nota = {
      ...(previo || {}),
      notaId,
      id: notaId,
      cursoId,
      estudianteId: String(resultado.estudianteId),
      aspectoId,
      instrumentoId: resultado.instrumentoId,
      planificacionId: resultado.planificacionId || "",
      indicadorId: aspecto.indicadorId || "",
      puntajeMaximo: consolidado.puntajeMaximo,
      valorCalculado: recalculado.valorCalculado,
      valorObtenido: recalculado.ajusteManual ? recalculado.valorFinal : recalculado.valorCalculado,
      porcentaje: consolidado.puntajeMaximo > 0
        ? Math.round(((recalculado.ajusteManual ? recalculado.valorFinal : recalculado.valorCalculado) / consolidado.puntajeMaximo) * 100)
        : null,
      esParcial: consolidado.esParcial,
      pendientes: consolidado.pendientes,
      advertenciaPonderacion: consolidado.advertenciaPonderacion || "",
      ajusteManual: Boolean(recalculado.ajusteManual),
      motivoAjuste: recalculado.motivoAjuste || previo?.motivoAjuste || "",
      desactualizado: Boolean(recalculado.desactualizado),
      origenResultados: recalculado.origenResultados || [],
      origen: "instrumento",
      ultimaActualizacionAutomatica: ahora,
      fechaActualizacion: ahora,
    };

    batch.set(refNota(cursoId, notaId), { ...nota, uid: uid(), actualizadoEn: serverTimestamp() }, { merge: true });
    notas.push(nota);
    if (nota.desactualizado) desactualizadas.push(notaId);
  }

  if (notas.length) await batch.commit();
  return { notas, desactualizadas };
};

/**
 * FASE 5 — Ajuste manual del docente sobre una nota consolidada (regla 7/12).
 * Guarda valorFinal + motivo sin perder el valorCalculado automático.
 */
export const aplicarAjusteManualRegistro = async ({ cursoId, estudianteId, aspectoId, valorFinal, motivoAjuste = "" }) => {
  if (!disponible()) throw new Error("Necesitas iniciar sesión para ajustar notas");
  const notaId = crearNotaId(estudianteId, aspectoId);
  const ahora = new Date().toISOString();
  const valor = Number(valorFinal);
  if (!Number.isFinite(valor)) throw new Error("El valor del ajuste debe ser numérico");

  await setDoc(refNota(cursoId, notaId), {
    notaId,
    id: notaId,
    cursoId: String(cursoId),
    estudianteId: String(estudianteId),
    aspectoId: String(aspectoId),
    valorObtenido: valor,
    ajusteManual: true,
    motivoAjuste,
    desactualizado: false,
    origen: "manual",
    fechaActualizacion: ahora,
    uid: uid(),
    actualizadoEn: serverTimestamp(),
  }, { merge: true });

  return { notaId, valorFinal: valor };
};

/**
 * FASE 5 — El docente acepta el nuevo cálculo automático tras un
 * desactualizado (regla 12): valorFinal vuelve a seguir a valorCalculado.
 */
export const aceptarCalculoAutomatico = async ({ cursoId, estudianteId, aspectoId }) => {
  if (!disponible()) throw new Error("Necesitas iniciar sesión");
  const notaId = crearNotaId(estudianteId, aspectoId);
  const snap = await getDoc(refNota(cursoId, notaId));
  if (!snap.exists()) throw new Error("La nota no existe todavía");
  const previo = snap.data();
  const valorCalculado = previo.valorCalculado ?? previo.valorObtenido;

  await setDoc(refNota(cursoId, notaId), {
    valorObtenido: valorCalculado,
    ajusteManual: false,
    motivoAjuste: "",
    desactualizado: false,
    origen: "instrumento",
    fechaActualizacion: new Date().toISOString(),
    actualizadoEn: serverTimestamp(),
  }, { merge: true });

  return { notaId, valorObtenido: valorCalculado };
};

/** Registro consolidado de un curso (notas por aspecto de todos los estudiantes). */
export const obtenerRegistroPorCurso = async (cursoId) => {
  if (!disponible()) return { aspectos: [], notas: [] };
  const [aspectosSnap, notasSnap] = await Promise.all([
    getDocs(colAspectos(cursoId)),
    getDocs(collection(db, "usuarios", uid(), "cursos", String(cursoId), "registroNotas")),
  ]);
  return {
    aspectos: aspectosSnap.docs
      .map((d) => ({ ...d.data(), id: d.id, aspectoId: d.id }))
      .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0)),
    notas: notasSnap.docs.map((d) => ({ ...d.data(), id: d.id, notaId: d.id })),
  };
};
