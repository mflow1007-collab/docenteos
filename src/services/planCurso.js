/**
 * planCurso.js — Etapa 3: un plan guardado pertenece a UN curso.
 *
 * Módulo PURO (sin Firebase). Decisión de César (2026-11-25): cada sección
 * tiene su propia copia del plan, enlazada al original (`planOrigenId`), sin
 * gastar cupo ni IA, con sus fechas, instrumentos, actividades y notas.
 * En el aula manda el curso del plan, no el curso activo.
 *
 * Verificación: scripts/test-plan-curso.mjs
 */

import {
  advertenciaCalendario, calcularFechaSugerida, corregirFechasCapa, normalizarTexto, puntuarCursoParaPlan, seccionDeCurso, UMBRAL_CURSO_PLAN,
} from "./hiloPedagogico.js";

const ORDEN_DIAS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
const ES_ISO = /^\d{4}-\d{2}-\d{2}$/;
const metaDe = (plan) => plan?.contenido?.unidad?.metadatos || plan?.contenido?.metadatos || {};
const nombreCurso = (curso) => curso?.nombre || curso?.name || "este curso";
const activo = (plan) => (plan?.capaCurricular?.estado || "activa") === "activa";

/** id del curso al que pertenece el plan guardado ("" si aún no tiene). */
export const cursoIdDePlan = (plan) => String(plan?.cursoId || plan?.capaCurricular?.cursoId || "");

/** Mismo grado y asignatura, sin mirar la sección. */
export const mismaMateria = (plan, curso) =>
  puntuarCursoParaPlan({ ...metaDe(plan), seccion: "" }, curso) >= UMBRAL_CURSO_PLAN;

/**
 * Curso con el que se trabaja en el aula. Manda el del plan; sin curso, solo
 * uno que encaje (grado, asignatura y sección). Si no hay, null y el motivo:
 * nunca «el primero», porque ahí irían la lista y las notas.
 * @returns {{ curso: object|null, aviso: string }}
 */
export const resolverCursoDelAula = ({ plan = null, cursos = [], cursoActivo = null } = {}) => {
  if (!plan) return { curso: cursoActivo, aviso: "" };
  if (!cursos.length) return { curso: null, aviso: "" };
  const id = cursoIdDePlan(plan);
  if (id) {
    const curso = cursos.find((c) => String(c.id) === id) || null;
    if (!curso) return { curso: null, aviso: "El curso de esta planificación ya no existe. No se pasa lista ni se ponen notas hasta elegir otra." };
    const avisos = [];
    if (cursoActivo?.id && String(cursoActivo.id) !== id) {
      avisos.push(`Esta planificación es de ${nombreCurso(curso)}. Aunque tu curso activo es ${nombreCurso(cursoActivo)}, la lista, las evidencias y las notas van a ${nombreCurso(curso)}.`);
    }
    const seccionPlan = normalizarTexto(metaDe(plan).seccion);
    const seccionCurso = normalizarTexto(seccionDeCurso(curso));
    if (seccionPlan && seccionCurso && seccionPlan !== seccionCurso) {
      avisos.push(`La planificación dice sección ${metaDe(plan).seccion}, pero está atada a ${nombreCurso(curso)}. Revísala antes de poner notas.`);
    }
    return { curso, aviso: avisos.join(" ") };
  }
  const encaja = (c) => puntuarCursoParaPlan(metaDe(plan), c) >= UMBRAL_CURSO_PLAN;
  if (cursoActivo && encaja(cursoActivo)) return { curso: cursoActivo, aviso: "" };
  const candidatos = cursos.filter(encaja);
  if (candidatos.length === 1) return { curso: candidatos[0], aviso: "" };
  return {
    curso: null,
    aviso: candidatos.length
      ? "Esta planificación no tiene curso y encaja con varios. Elige uno como curso activo para pasar lista y poner notas."
      : "Esta planificación no tiene un curso que coincida en grado, asignatura y sección. No se pasa lista ni se ponen notas.",
  };
};

/**
 * Planes de OTRA sección que este curso puede copiar: mismo grado y asignatura,
 * atados a otro curso, originales y sin copia ya hecha para este curso.
 */
export const planesParaCopiar = (planes = [], curso = null) => {
  if (!curso?.id) return [];
  const yaCopiados = new Set(planes.filter((p) => cursoIdDePlan(p) === String(curso.id))
    .map((p) => String(p.capaCurricular?.planOrigenId || "")).filter(Boolean));
  return planes.filter((p) => p?.id && p.capaCurricular && activo(p)
    && !p.capaCurricular.planOrigenId
    && cursoIdDePlan(p) && cursoIdDePlan(p) !== String(curso.id)
    && !yaCopiados.has(String(p.id))
    && mismaMateria(p, curso));
};

/** Nombres de los días de clase del plan, en orden de semana. */
export const diasDelPlan = (plan) => {
  const capa = corregirFechasCapa(plan?.capaCurricular, metaDe(plan).fechaInicio);
  const nombres = new Map();
  for (const clase of capa?.clases || []) {
    const clave = normalizarTexto(clase?.nombreDia);
    if (ORDEN_DIAS.includes(clave) && !nombres.has(clave)) nombres.set(clave, clase.nombreDia);
  }
  return [...nombres].sort(([a], [b]) => ORDEN_DIAS.indexOf(a) - ORDEN_DIAS.indexOf(b)).map(([, nombre]) => nombre);
};

/** "" si los días elegidos sirven; si no, qué corregir. */
export const errorDeDias = (originales = [], elegidos = []) => {
  if (elegidos.length !== originales.length || elegidos.some((d) => !ORDEN_DIAS.includes(normalizarTexto(d)))) {
    return "Elige un día para cada clase de la semana.";
  }
  const orden = elegidos.map((d) => ORDEN_DIAS.indexOf(normalizarTexto(d)));
  return orden.some((n, i) => i > 0 && n <= orden[i - 1]) ? "Los días deben ser distintos y en orden: así las clases no se cruzan." : "";
};

const diferenciaDias = (desde, hasta) =>
  (ES_ISO.test(desde) && ES_ISO.test(hasta) ? Math.round((Date.parse(`${hasta}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`)) / 864e5) : null);
const sumarDias = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

/**
 * Copia del plan para otra sección. No toca el original ni el contenido
 * pedagógico: cambia sección, curso, fecha de inicio, días y fechas.
 * @returns {{ contenido, capaCurricular }} listo para guardarPlanificacionDetallada
 */
export const construirCopiaDePlan = ({ plan, curso, fechaInicio = "", dias = null }) => {
  if (!plan?.id || !plan?.contenido || !plan?.capaCurricular) throw new Error("El plan que se copia debe estar guardado y tener su capa curricular.");
  if (!curso?.id) throw new Error("Falta el curso de la copia.");
  if (cursoIdDePlan(plan) === String(curso.id)) throw new Error("Este plan ya pertenece a ese curso.");
  if (!mismaMateria(plan, curso)) throw new Error("El plan y el curso no son del mismo grado y asignatura.");
  const seccion = seccionDeCurso(curso);
  if (!seccion) throw new Error(`${nombreCurso(curso)} no tiene sección: edítalo y ponla antes de copiar.`);

  const originales = diasDelPlan(plan);
  const elegidos = dias || originales;
  const error = errorDeDias(originales, elegidos);
  if (error) throw new Error(error);
  const inicioAnterior = metaDe(plan).fechaInicio || "";
  const inicio = fechaInicio || inicioAnterior;
  if (inicio && !ES_ISO.test(inicio)) throw new Error("La fecha de inicio no es válida.");
  const mapa = new Map(originales.map((d, i) => [normalizarTexto(d), elegidos[i]]));
  const cambiarDia = (nombre) => mapa.get(normalizarTexto(nombre)) ?? nombre;
  const corrimiento = diferenciaDias(inicioAnterior, inicio);
  const correr = (iso) => (corrimiento === null ? iso : sumarDias(iso, corrimiento));

  const diaCopiado = (dia) => ({
    ...dia,
    ...(dia.diaCalendario ? { diaCalendario: ES_ISO.test(dia.diaCalendario) ? correr(dia.diaCalendario) : cambiarDia(dia.diaCalendario) } : {}),
    ...(dia.nombre ? { nombre: cambiarDia(dia.nombre) } : {}),
  });
  const conDias = (lista) => (Array.isArray(lista)
    ? lista.map((bloque) => (Array.isArray(bloque?.dias) ? { ...bloque, dias: bloque.dias.map(diaCopiado) } : bloque))
    : lista);
  const listaOriginal = originales.join(", ");
  const horario = metaDe(plan).horario;
  const copiarUnidad = (unidad) => ({
    ...unidad,
    ...(unidad.metadatos ? {
      metadatos: {
        ...unidad.metadatos,
        seccion,
        fechaInicio: inicio,
        ...(typeof horario === "string" && listaOriginal ? { horario: horario.replace(listaOriginal, elegidos.join(", ")) } : {}),
        ...(unidad.metadatos.cursoId ? { cursoId: String(curso.id) } : {}),
      },
    } : {}),
    ...(unidad.fasesSemanales ? { fasesSemanales: conDias(unidad.fasesSemanales) } : {}),
    ...(unidad.fases ? { fases: conDias(unidad.fases) } : {}),
    ...(unidad.desarrolloSemanal ? { desarrolloSemanal: conDias(unidad.desarrolloSemanal) } : {}),
  });
  const contenido = {
    ...copiarUnidad(plan.contenido),
    ...(plan.contenido.unidad ? { unidad: copiarUnidad(plan.contenido.unidad) } : {}),
  };

  const capa = corregirFechasCapa(plan.capaCurricular, inicioAnterior);
  return {
    contenido,
    capaCurricular: {
      ...capa,
      cursoId: String(curso.id),
      seccion,
      planOrigenId: String(plan.id),
      clases: (capa.clases || []).map((clase) => {
        const conNombre = mapa.has(normalizarTexto(clase.nombreDia));
        const nombreDia = conNombre ? cambiarDia(clase.nombreDia) : clase.nombreDia;
        const fechaSugerida = conNombre ? calcularFechaSugerida(inicio, clase.semana || 1, nombreDia)
          : ES_ISO.test(clase.fechaSugerida || "") ? correr(clase.fechaSugerida) : clase.fechaSugerida;
        return { ...clase, nombreDia, fechaSugerida, advertenciaCalendario: advertenciaCalendario(fechaSugerida) };
      }),
    },
  };
};
