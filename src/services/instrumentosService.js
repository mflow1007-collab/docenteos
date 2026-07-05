/**
 * instrumentosService.js — Fases 3 y 4 del hilo pedagógico
 *
 * Fase 3: instrumentos que NACEN vinculados a la planificación (y opcionalmente
 * a una clase concreta), sabiendo qué indicadores evalúan y qué aspectos del
 * registro alimentan.
 *
 * Fase 4: resultados de evaluación POR ESTUDIANTE. No se escribe directo en
 * Mi Registro: primero se guarda el resultado del instrumento; Mi Registro
 * (Fase 5, Bloque B) se consolidará desde aquí.
 *
 * Colecciones reales:
 *   usuarios/{uid}/instrumentos/{instrumentoId}            (existente, extendida)
 *   usuarios/{uid}/instrumentoResultados/{resultadoId}     (nueva)
 *
 * Idempotencia:
 *   instrumentoId = ins-{planificacionId}-{tipo}-{claseId|global}
 *   resultadoId   = {instrumentoId}__{estudianteId}  (re-evaluar sobreescribe)
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
import { db, auth, guardarRegistroAspectoDesdeInstrumento } from "../firebase.js";
import {
  construirInstrumentoDesdePlan,
  construirResultadoInstrumento,
  validarPonderacion,
  consolidarNotaEstudiante,
  normalizarTipoInstrumento,
  ETIQUETA_TIPO_INSTRUMENTO,
} from "./hiloPedagogico.js";
import { sincronizarPuntajesAspectos } from "./registroService.js";

const uid = () => auth?.currentUser?.uid;
const disponible = () => Boolean(db && uid());

const refInstrumento = (id) => doc(db, "usuarios", uid(), "instrumentos", String(id));
const colInstrumentos = () => collection(db, "usuarios", uid(), "instrumentos");
const refResultado = (id) => doc(db, "usuarios", uid(), "instrumentoResultados", String(id));
const colResultados = () => collection(db, "usuarios", uid(), "instrumentoResultados");

// ─── Fase 3 — Instrumentos ───────────────────────────────────────────────────

/**
 * Crea (o actualiza, mismo ID determinista) un instrumento desde una
 * planificación con capa curricular. También registra el vínculo
 * instrumento → aspecto del registro (bridge ya existente en firebase.js).
 *
 * @param {object} registroPlan  Doc de `planificaciones` con id y capaCurricular
 * @param {object} definicion    { tipo, titulo?, descripcion?, valorMaximo, ponderacion?, claseId? }
 */
export const crearInstrumentoDesdePlanificacion = async (registroPlan, definicion = {}) => {
  if (!disponible()) throw new Error("Necesitas iniciar sesión para crear instrumentos");
  const planificacionId = String(registroPlan?.id || registroPlan?.planificacionId || "");
  const capa = registroPlan?.capaCurricular || registroPlan?.contenido?.capaCurricular;
  if (!planificacionId || !capa) {
    throw new Error("La planificación necesita id y capa curricular para crear instrumentos vinculados");
  }

  const instrumento = construirInstrumentoDesdePlan({
    planificacionId,
    capa,
    docenteId: uid(),
    ...definicion,
  });

  await setDoc(refInstrumento(instrumento.id), {
    ...instrumento,
    uid: uid(),
    updatedAt: serverTimestamp(),
  }, { merge: true });

  // Vincular con el aspecto del registro (no bloquea si falla; se reporta)
  try {
    await guardarRegistroAspectoDesdeInstrumento(instrumento);
  } catch (error) {
    console.warn("[instrumentosService] Instrumento guardado, pero falló el vínculo con el aspecto:", error);
  }

  return instrumento;
};

/**
 * Crea en lote los instrumentos de una evaluación (p. ej. Rúbrica 50 +
 * Lista de cotejo 25 + Escala 25) y valida la ponderación (regla 10).
 *
 * @returns {{ instrumentos, ponderacion: { total, esCompleta, advertencia } }}
 */
export const crearInstrumentosDeEvaluacion = async (registroPlan, definiciones = []) => {
  const instrumentos = [];
  for (const definicion of definiciones) {
    instrumentos.push(await crearInstrumentoDesdePlanificacion(registroPlan, definicion));
  }
  const ponderacion = validarPonderacion(instrumentos);

  // Decisión de producto: los puntajes de los aspectos del registro se
  // derivan de la ponderación real de los instrumentos (editables después).
  const capa = registroPlan?.capaCurricular || registroPlan?.contenido?.capaCurricular;
  if (capa?.cursoId && instrumentos.length) {
    try {
      await sincronizarPuntajesAspectos({
        cursoId: capa.cursoId,
        planificacionId: String(registroPlan.id || registroPlan.planificacionId),
        instrumentos,
      });
    } catch (error) {
      console.warn("[instrumentosService] No se pudieron sincronizar los puntajes de aspectos:", error);
    }
  }

  return { instrumentos, ponderacion };
};

/**
 * FASE 10 — Reemplazo del puente legacy crearInstrumentosDesdePlan.
 *
 * Crea instrumentos esqueleto (status draft) desde los tipos planificados en
 * la capa curricular, con IDs DETERMINISTAS: re-guardar el plan no duplica
 * (el bridge viejo usaba Date.now() y creaba duplicados en cada guardado).
 * Los instrumentos ya creados con el formato viejo siguen siendo legibles:
 * la lectura (obtenerInstrumentosFirestore / por planificación) no cambia.
 */
export const crearInstrumentosPlaneadosDesdePlan = async (registroPlan) => {
  const capa = registroPlan?.capaCurricular || registroPlan?.contenido?.capaCurricular;
  const planificacionId = String(registroPlan?.id || registroPlan?.planificacionId || "");
  if (!capa || !planificacionId) return { instrumentos: [], tipos: [] };

  const tiposPlaneados = capa.evaluacionPlanificada?.instrumentosPlaneadosGlobales || [];
  // Deduplicar por tipo normalizado (varios nombres crudos → un instrumento)
  const tipos = [...new Set(tiposPlaneados.map((t) => normalizarTipoInstrumento(t)))]
    .filter((t) => t !== "otro" || tiposPlaneados.length === 0);
  if (!tipos.length) tipos.push("lista_cotejo");

  const instrumentos = [];
  for (const tipo of tipos) {
    instrumentos.push(await crearInstrumentoDesdePlanificacion(registroPlan, {
      tipo,
      titulo: `${ETIQUETA_TIPO_INSTRUMENTO[tipo] || "Instrumento"} — ${capa.secuencia || "Plan"}`,
    }));
  }
  return { instrumentos, tipos };
};

export const obtenerInstrumentosPorPlanificacion = async (planificacionId) => {
  if (!disponible()) return [];
  const snap = await getDocs(
    query(colInstrumentos(), where("planificacionId", "==", String(planificacionId)))
  );
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
};

export const obtenerInstrumentosPorClase = async (planificacionId, claseId) => {
  const instrumentos = await obtenerInstrumentosPorPlanificacion(planificacionId);
  // Instrumentos de la clase + los globales de la secuencia (claseId vacío)
  return instrumentos.filter((ins) => !ins.claseId || ins.claseId === claseId);
};

// ─── Fase 4 — Resultados por estudiante ──────────────────────────────────────

/**
 * Guarda el resultado de un instrumento para un estudiante.
 * Estados: "evaluado" (con puntaje), "pendiente" (sin puntaje, NO cuenta 0),
 * "no_entrego" (0 explícito decidido por el docente).
 *
 * Escribe además una marca de aplicación mínima en el instrumento (usos,
 * status activo) en el MISMO batch para no dejar estados a medias.
 */
export const guardarResultadoInstrumento = async ({
  instrumento,
  estudianteId,
  estudianteNombre = "",
  puntajeObtenido = null,
  estado = "evaluado",
  observacionDocente = "",
  evidenciasIds = [],
  fechaEvaluacion = new Date().toISOString(),
}) => {
  if (!disponible()) throw new Error("Necesitas iniciar sesión para guardar resultados");

  const resultado = construirResultadoInstrumento({
    instrumento,
    estudianteId,
    estudianteNombre,
    puntajeObtenido,
    estado,
    observacionDocente,
    evidenciasIds,
    docenteId: uid(),
  });
  resultado.fechaEvaluacion = fechaEvaluacion;

  const batch = writeBatch(db);
  batch.set(refResultado(resultado.resultadoId), {
    ...resultado,
    uid: uid(),
    actualizadoEn: serverTimestamp(),
  }, { merge: true });

  const instrumentoId = String(instrumento.id || instrumento.instrumentoId);
  batch.set(refInstrumento(instrumentoId), {
    // Identidad mínima: si el instrumento venía del plan (efímero, Modo Aula)
    // el doc queda completo y visible en la página de Instrumentos.
    id: instrumentoId,
    nombre: instrumento.nombre || instrumento.titulo || "Instrumento",
    tipo: instrumento.tipo || "Otro",
    cursoId: String(instrumento.cursoId || ""),
    planificacionId: instrumento.planificacionId || "",
    claseId: instrumento.claseId || "",
    periodo: instrumento.periodo || "",
    competencia: instrumento.competencia || "",
    indicadores: instrumento.indicadores || [],
    indicadorIds: instrumento.indicadorIds || [],
    aspectoRegistroIds: instrumento.aspectoRegistroIds || [],
    valorMaximo: Number(instrumento.valorMaximo) || 100,
    usos: (Number(instrumento.usos) || 0) + (estado === "evaluado" ? 1 : 0),
    status: "activo",
    estado: instrumento.estado === "Borrador" || !instrumento.estado ? "Activo" : instrumento.estado,
    registroIntegracion: {
      ...(instrumento.registroIntegracion || {}),
      calificacionObtenida: resultado.puntajeObtenido,
      fecha: resultado.fechaEvaluacion,
      periodo: resultado.periodo,
    },
    updatedAt: serverTimestamp(),
  }, { merge: true });

  await batch.commit();
  return resultado;
};

export const obtenerResultadosPorInstrumento = async (instrumentoId) => {
  if (!disponible()) return [];
  const snap = await getDocs(
    query(colResultados(), where("instrumentoId", "==", String(instrumentoId)))
  );
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
};

export const obtenerResultadosPorEstudiante = async (estudianteId, { cursoId = "" } = {}) => {
  if (!disponible()) return [];
  const snap = await getDocs(
    query(colResultados(), where("estudianteId", "==", String(estudianteId)))
  );
  const datos = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
  return cursoId ? datos.filter((r) => r.cursoId === String(cursoId)) : datos;
};

export const obtenerResultadosPorPlanificacion = async (planificacionId) => {
  if (!disponible()) return [];
  const snap = await getDocs(
    query(colResultados(), where("planificacionId", "==", String(planificacionId)))
  );
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
};

export const obtenerResultado = async (resultadoId) => {
  if (!disponible()) return null;
  const snap = await getDoc(refResultado(resultadoId));
  return snap.exists() ? { ...snap.data(), id: snap.id } : null;
};

/**
 * Consolidación de la nota de un estudiante para una planificación
 * (reglas 10-11). Solo LECTURA + cálculo: la escritura en Mi Registro
 * (registroCalificaciones) es Fase 5 / Bloque B.
 */
export const calcularNotaConsolidadaEstudiante = async ({ planificacionId, estudianteId }) => {
  const [instrumentos, resultados] = await Promise.all([
    obtenerInstrumentosPorPlanificacion(planificacionId),
    obtenerResultadosPorPlanificacion(planificacionId),
  ]);
  return consolidarNotaEstudiante({
    instrumentos,
    resultados: resultados.filter((r) => String(r.estudianteId) === String(estudianteId)),
  });
};
