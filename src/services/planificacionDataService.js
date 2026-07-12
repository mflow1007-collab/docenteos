/**
 * planificacionDataService.js — Fase 1 del hilo pedagógico
 *
 * La planificación como FUENTE DE VERDAD pedagógica: al guardar, el plan
 * queda enriquecido con una capa curricular normalizada (capaCurricular)
 * construida desde la malla MINERD activa del Banco de Conocimiento
 * (curricularContent),
 * con IDs oficiales de competencias e indicadores.
 *
 * No rompe nada: guardarPlanificacionDetallada sigue funcionando igual para
 * los callers actuales; este servicio la envuelve y añade la capa. Los planes
 * ya guardados se pueden enriquecer con backfillCapaCurricular (migración
 * gradual, Fase 13).
 */

import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import {
  db,
  auth,
  guardarPlanificacionDetallada,
  obtenerPlanificacionesDetalladas,
  obtenerCursos,
} from "../firebase.js";
import { getCurricularContentForUnit } from "./bancoConocimientoService.js";
import { construirCapaCurricular, normalizarTexto } from "./hiloPedagogico.js";
import { generarAspectosRegistroDesdePlanificacion } from "./registroService.js";
import { crearInstrumentosPlaneadosDesdePlan } from "./instrumentosService.js";
import { cosecharSecuenciaDeUnidad } from "./bancoAprendizajeService.js";

const AREA_CURRICULO_POR_ASIGNATURA = {
  // El currículo de Inglés/Francés vive bajo el área "Lenguas Extranjeras"
  "Inglés": "Lenguas Extranjeras",
  "Francés": "Lenguas Extranjeras",
};

const resolverNivel = (meta = {}) => {
  const nivel = meta.nivelEducativo || meta.nivel || "";
  if (nivel) return nivel;
  const texto = `${meta.grado || ""} ${meta.curso || ""}`.toLowerCase();
  if (texto.includes("secundaria")) return "Secundaria";
  if (texto.includes("primaria")) return "Primaria";
  return "";
};

const adaptarCurricularContentParaHilo = (docCurricular) => {
  if (!docCurricular) return null;
  const payload = docCurricular.payload || docCurricular;
  return {
    ...payload,
    id: docCurricular.id || payload.id || payload.contentId || null,
    nivel: payload.nivel || payload.level || docCurricular.level || "",
    level: payload.level || payload.nivel || docCurricular.level || "",
    grado: payload.grado || payload.grade || docCurricular.grade || "",
    grade: payload.grade || payload.grado || docCurricular.grade || "",
    area: payload.area || docCurricular.area || "",
    asignatura: payload.asignatura || payload.subject || docCurricular.subject || "",
    subject: payload.subject || payload.asignatura || docCurricular.subject || "",
    competencias: Array.isArray(payload.competencias) ? payload.competencias : [],
    indicadoresLogro: Array.isArray(payload.indicadoresLogro)
      ? payload.indicadoresLogro
      : Array.isArray(payload.indicadores) ? payload.indicadores : [],
  };
};

/**
 * Busca la malla activa del Banco de Conocimiento que corresponde al plan.
 * Prueba asignatura y área curricular, pero siempre respetando nivel+grado.
 * Devuelve null si no hay malla activa; no consulta archivos ni bancos legacy.
 */
export const consultarCurriculoParaPlan = async (planificacion) => {
  const meta = planificacion?.metadatos || {};
  const nivel = resolverNivel(meta);
  const grado = (meta.grado || "").split(" ")[0]; // "1ro Secundaria" → "1ro"
  const candidatas = [
    meta.asignatura,
    meta.area,
    AREA_CURRICULO_POR_ASIGNATURA[meta.asignatura],
    AREA_CURRICULO_POR_ASIGNATURA[meta.area],
  ].filter(Boolean);

  for (const subject of candidatas) {
    const docCurriculo = await getCurricularContentForUnit(subject, grado, nivel);
    if (docCurriculo) return adaptarCurricularContentParaHilo(docCurriculo);
  }
  return null;
};

/**
 * Construye la capa curricular de un plan consultando el currículo oficial.
 */
export const construirCapaCurricularParaPlan = async (planificacion, { cursoId = "" } = {}) => {
  const curriculo = await consultarCurriculoParaPlan(planificacion);
  return construirCapaCurricular(planificacion, {
    curriculo,
    cursoId,
    docenteId: auth?.currentUser?.uid || "",
  });
};

/**
 * Resuelve el curso del docente que corresponde a un plan por grado + sección
 * + área (los planes legacy no guardan cursoId). Devuelve null si no hay
 * un match razonable — mejor sin curso que con el curso equivocado.
 */
export const resolverCursoParaPlanificacion = async (planificacion) => {
  const meta = planificacion?.metadatos || {};
  let cursos;
  try {
    cursos = await obtenerCursos();
  } catch {
    return null;
  }
  if (!cursos?.length) return null;

  const gradoPlan = normalizarTexto(meta.grado || "");
  const seccionPlan = normalizarTexto(meta.seccion || "");
  const areaPlan = normalizarTexto(meta.asignatura || meta.area || "");

  const puntuados = cursos.map((curso) => {
    const gradoCurso = normalizarTexto([curso.grado, curso.nombre].filter(Boolean).join(" "));
    const areaCurso = normalizarTexto([curso.area, curso.asignatura].filter(Boolean).join(" "));
    const seccionCurso = normalizarTexto(curso.seccion || "");
    let puntaje = 0;
    if (gradoPlan && gradoCurso.includes(gradoPlan)) puntaje += 4;
    if (areaPlan && (areaCurso.includes(areaPlan) || areaPlan.includes(areaCurso)) && areaCurso) puntaje += 5;
    if (seccionPlan && seccionCurso === seccionPlan) puntaje += 2;
    return { curso, puntaje };
  }).sort((a, b) => b.puntaje - a.puntaje);

  return puntuados[0]?.puntaje >= 7 ? puntuados[0].curso : null;
};

/**
 * FASE 1 — Guarda una planificación con su capa curricular normalizada.
 * Envuelve guardarPlanificacionDetallada (colección real: planificaciones).
 *
 * ROBUSTA: si la capa curricular no puede construirse, el plan se guarda
 * igual (sin capa) y se devuelve la advertencia — el guardado nunca se
 * bloquea por el hilo pedagógico.
 *
 * @returns {{ success, id, mode, capaCurricular|null, advertencias: string[] }}
 */
export const crearPlanificacion = async (planificacion, { cursoId = "" } = {}) => {
  const advertencias = [];
  let capaCurricular;
  let cursoResuelto = cursoId;

  try {
    if (!cursoResuelto) {
      const curso = await resolverCursoParaPlanificacion(planificacion);
      cursoResuelto = curso?.id ? String(curso.id) : "";
      if (!cursoResuelto) {
        advertencias.push("No se encontró un curso que coincida con el plan; los aspectos del registro se generarán al vincular el curso.");
      }
    }
    capaCurricular = await construirCapaCurricularParaPlan(planificacion, { cursoId: cursoResuelto });
    if (!capaCurricular.curriculumSourceId) {
      advertencias.push("No hay currículo oficial importado para este grado/área: los indicadores quedaron con ID local (se re-vinculan al importar el currículo).");
    }
  } catch (error) {
    capaCurricular = null;
    advertencias.push(`El plan se guardó, pero sin capa curricular: ${error.message}`);
  }

  const resultado = await guardarPlanificacionDetallada(
    planificacion,
    capaCurricular ? { capaCurricular, cursoId: capaCurricular.cursoId } : {}
  );
  return { ...resultado, capaCurricular, advertencias };
};

/**
 * Guardado orquestado para la UI (Fase 1 + Fase 2 en un paso):
 * guarda el plan (SIEMPRE) y luego genera los aspectos del registro
 * best-effort. Si los aspectos fallan, el plan ya quedó guardado y las
 * advertencias se devuelven para avisar al docente — nunca se bloquea.
 *
 * @returns {{ success, id, mode, capaCurricular, aspectos|null, advertencias: string[] }}
 */
export const guardarPlanificacionConHilo = async (planificacion, { cursoId = "", cosecharSecuencia = false } = {}) => {
  const resultado = await crearPlanificacion(planificacion, { cursoId });
  const advertencias = [...(resultado.advertencias || [])];
  let aspectos = null;
  let instrumentos = null;

  // Banco de Aprendizaje — cosecha OPT-IN (apagada por defecto): solo si el
  // docente lo consintió y la unidad trae su especificación y su malla de
  // origen. Best-effort: jamás bloquea ni afecta el guardado del plan.
  if (cosecharSecuencia === true && resultado?.id) {
    try {
      const unidad = planificacion?.contenido?.unidad || planificacion?.unidad || planificacion?.contenido || planificacion;
      if (unidad?.especificacionCurricular && unidad?.mallaRef?.id) {
        await cosecharSecuenciaDeUnidad({
          unidad: { ...unidad, id: resultado.id },
          mallaId: unidad.mallaRef.id,
          mallaContentId: unidad.mallaRef.contentId || "",
          consentimiento: true,
        });
      }
    } catch (error) {
      advertencias.push(`El plan se guardó, pero la secuencia no se cosechó al Banco de Aprendizaje: ${error.message}`);
    }
  }

  if (resultado?.id && resultado.capaCurricular?.cursoId) {
    try {
      aspectos = await generarAspectosRegistroDesdePlanificacion({
        id: resultado.id,
        capaCurricular: resultado.capaCurricular,
      });
    } catch (error) {
      advertencias.push(`El plan se guardó, pero los aspectos del registro no se generaron: ${error.message}`);
    }
    // Fase 10: instrumentos planeados con IDs deterministas (reemplaza al
    // bridge legacy crearInstrumentosDesdePlan, que duplicaba en cada guardado)
    try {
      instrumentos = await crearInstrumentosPlaneadosDesdePlan({
        id: resultado.id,
        capaCurricular: resultado.capaCurricular,
      });
    } catch (error) {
      advertencias.push(`El plan se guardó, pero los instrumentos planeados no se crearon: ${error.message}`);
    }
  }

  return { ...resultado, aspectos, instrumentos, advertencias };
};

/**
 * Devuelve los indicadores (con ID) usados por una planificación guardada.
 * Acepta el registro completo de Firestore o solo su contenido.
 */
export const obtenerIndicadoresDePlanificacion = (registroPlan) => {
  const capa = registroPlan?.capaCurricular || registroPlan?.contenido?.capaCurricular;
  if (capa?.indicadoresSeleccionados?.length) return capa.indicadoresSeleccionados;
  // Fallback legacy: solo textos (sin ID oficial)
  const contenido = registroPlan?.contenido || registroPlan || {};
  const textos = contenido?.metadatos?.indicadoresOficiales
    || contenido?.datosGenerales?.indicadoresOficiales
    || [];
  return (Array.isArray(textos) ? textos : []).map((descripcion) => ({
    id: "", descripcion, competenciaId: "", origenId: "legacy",
  }));
};

/**
 * Migración gradual (Fase 13): añade capaCurricular a un plan ya guardado
 * sin tocar su contenido. Actualización parcial con merge (regla del proyecto:
 * nunca destructivo con datos de docentes reales).
 */
export const backfillCapaCurricular = async (registroPlan, { cursoId = "" } = {}) => {
  if (!registroPlan?.id) throw new Error("El registro del plan necesita id de Firestore");
  if (!db || !auth?.currentUser) throw new Error("Firebase no disponible para el backfill");
  const contenido = registroPlan.contenido || {};
  const capaCurricular = await construirCapaCurricularParaPlan(contenido, {
    cursoId: cursoId || registroPlan.cursoId || "",
  });
  const ref = doc(db, "planificaciones", String(registroPlan.id));
  await setDoc(ref, {
    capaCurricular,
    cursoId: capaCurricular.cursoId || registroPlan.cursoId || "",
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return capaCurricular;
};

/**
 * Lista los planes del docente que aún no tienen capa curricular
 * (candidatos a backfill).
 */
export const listarPlanesSinCapa = async () => {
  const { data } = await obtenerPlanificacionesDetalladas();
  return (data || []).filter((plan) => !plan.capaCurricular);
};

/**
 * FASE 10 — Planificación activa de un curso: la más reciente con capa
 * curricular del curso indicado; si no hay del curso, la más reciente con
 * capa; si no, la más reciente a secas (planes legacy).
 *
 * @param {string} cursoId
 * @param {object} opciones  { planes } para reusar una lista ya cargada
 */
export const obtenerPlanificacionActiva = async (cursoId = "", { planes = null } = {}) => {
  const lista = Array.isArray(planes)
    ? planes
    : (await obtenerPlanificacionesDetalladas()).data || [];
  if (!lista.length) return null;

  const activas = lista.filter((p) => (p.capaCurricular?.estado || "activa") === "activa");
  const delCurso = cursoId
    ? activas.filter((p) => String(p.cursoId || p.capaCurricular?.cursoId || "") === String(cursoId))
    : [];
  return delCurso.find((p) => p.capaCurricular)
    || activas.find((p) => p.capaCurricular)
    || lista[0]
    || null;
};

// ─── Indicadores ya trabajados en planes anteriores (para tachar) ─────────────
// Recolecta los CÓDIGOS de indicadores que planes PREVIOS del mismo grado +
// asignatura ya trabajaron. El generador los usa como "trabajadosAntes" para
// mostrarlos tachados en el nuevo plan (el docente igual puede re-elegirlos).
// Fuentes por plan: (a) competenciasDetalle[].indicadores[] con aplicaTemaActual,
// (b) fasesSemanales[].dias[].indicadoresTrabajados[] (códigos reportados por IA).

const _normCodInd = (c) =>
  String(c || "").replaceAll("[", "").replaceAll("]", "").replace(/\s/g, "").toUpperCase().trim();

export const obtenerIndicadoresTrabajadosPrevios = async (grado = "", asignatura = "", { planes = null, excluirId = "" } = {}) => {
  const lista = Array.isArray(planes)
    ? planes
    : (await obtenerPlanificacionesDetalladas()).data || [];
  const g = normalizarTexto(grado).split(" ")[0]; // "1ro Secundaria" → "1ro"
  const a = normalizarTexto(asignatura);
  const codigos = new Set();

  for (const plan of lista) {
    if (excluirId && String(plan.id || "") === String(excluirId)) continue;
    const meta = plan.metadatos || plan;
    const pg = normalizarTexto(meta.grado || meta.grade || "").split(" ")[0];
    const pa = normalizarTexto(meta.asignatura || meta.subject || meta.area || "");
    // Mismo grado y misma asignatura (o área) — no mezclar entre asignaturas
    if (g && pg && g !== pg) continue;
    if (a && pa && a !== pa && !pa.includes(a) && !a.includes(pa)) continue;

    // (a) competenciasDetalle con aplicaTemaActual
    for (const comp of (plan.competenciasDetalle || [])) {
      for (const ind of (comp.indicadores || [])) {
        if (ind?.aplicaTemaActual) {
          const cod = _normCodInd(ind.codigo || ind.id || ind.codigoOficial);
          if (cod) codigos.add(cod);
        }
      }
    }
    // (b) indicadoresTrabajados reportados en cada clase
    for (const fase of (plan.fasesSemanales || [])) {
      for (const dia of (fase.dias || [])) {
        for (const cod of (dia.indicadoresTrabajados || [])) {
          const n = _normCodInd(cod);
          if (n) codigos.add(n);
        }
      }
    }
  }
  return Array.from(codigos);
};
