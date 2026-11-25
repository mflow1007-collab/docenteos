/**
 * Hora extra en Modo Aula: una hora de HOY fuera del horario fijo (p. ej. faltó
 * un maestro). Vive en el curso, aparte de `horarioSemanal`:
 *   horasExtra:  [{ fecha, hora, planId?, claseId? }]   solo cuenta en su fecha
 *   clasesDadas: [{ planId, claseId, fecha, extra }]     clases finalizadas
 * Con `clasesDadas`, una clase adelantada no vuelve a salir en su fecha. No se
 * mueven las fechas ni se toca la planificación. Todo es PURO.
 */

import { claseDeAhora, clasesDelDia, nombreDia } from "./horarioSemanal.js";
import { fechaLocalISO, obtenerClaseDeHoy } from "../services/hiloPedagogico.js";

const lista = (valor) => (Array.isArray(valor) ? valor : []);

/** «2026-11-26» → «jueves, 26 de noviembre» (en hora local). */
export const fechaLegible = (iso) => {
  const [a, m, d] = String(iso || "").split("-").map(Number);
  return a && m && d ? new Date(a, m - 1, d).toLocaleDateString("es-DO", { weekday: "long", day: "numeric", month: "long" }) : "";
};

/** Horas de hoy ya ocupadas (fijas o extra) en todos los cursos: { [hora]: clase }. */
export const horasOcupadasHoy = (cursos = [], ahora = new Date()) =>
  Object.fromEntries(clasesDelDia(cursos, nombreDia(ahora), { fecha: fechaLocalISO(ahora) }).map((c) => [c.hora, c]));

/** Clases de un plan ya finalizadas en ese curso: Map claseId → { fecha, extra }. */
export const mapaClasesDadas = (curso, planId) =>
  new Map(lista(curso?.clasesDadas)
    .filter((d) => d?.claseId && String(d.planId) === String(planId))
    .map((d) => [d.claseId, d]));

/**
 * Clases del plan que faltan por dar: `siguientes` (de hoy en adelante o sin
 * fecha) y `atrasadas` (su fecha pasó y no figuran como dadas).
 */
export const clasesPendientes = (capa, curso, planId, ahora = new Date()) => {
  const dadas = mapaClasesDadas(curso, planId);
  const hoy = fechaLocalISO(ahora);
  const faltan = lista(capa?.clases)
    .filter((c) => c?.claseId && !dadas.has(c.claseId))
    .sort((a, b) => (a.numeroClase || 0) - (b.numeroClase || 0));
  const atrasada = (c) => Boolean(c.fechaSugerida) && c.fechaSugerida < hoy;
  return { siguientes: faltan.filter((c) => !atrasada(c)), atrasadas: faltan.filter(atrasada) };
};

/**
 * Hora extra de hoy en curso. Si ahora corre una clase del horario, manda esa;
 * si no, la última hora extra de hoy cuya clase no se ha finalizado.
 */
export const horaExtraVigente = (curso, ahora = new Date()) => {
  if (!curso) return null;
  const hoy = fechaLocalISO(ahora);
  const abiertas = lista(curso.horasExtra).filter((x) =>
    x?.fecha === hoy && !(x.claseId && mapaClasesDadas(curso, x.planId).has(x.claseId)));
  const enCurso = claseDeAhora([curso], ahora);
  if (enCurso) return enCurso.extra ? abiertas.find((x) => x.hora === enCurso.hora) || null : null;
  return abiertas.at(-1) || null;
};

/** Clase que Modo Aula debe mostrar: la de la hora extra o la de hoy según el plan. */
export const claseParaMostrar = (capa, curso, planId, ahora = new Date()) => {
  const extra = horaExtraVigente(curso, ahora);
  if (extra?.claseId && String(extra.planId) === String(planId)) {
    const clase = lista(capa?.clases).find((c) => c.claseId === extra.claseId);
    if (clase) return { clase, esHoy: false, motivo: "extra", hora: extra.hora };
  }
  return obtenerClaseDeHoy(capa, fechaLocalISO(ahora), { dadas: mapaClasesDadas(curso, planId) });
};

const mismoRegistro = (a, b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

/** Pone o quita un registro de una lista del curso (igual que arrayUnion/arrayRemove). */
export const aplicarListaACurso = (cursos = [], cursoId, campo, { agregar, quitar } = {}) =>
  cursos.map((curso) => {
    if (String(curso.id) !== String(cursoId)) return curso;
    const actual = lista(curso[campo]);
    if (quitar) return { ...curso, [campo]: actual.filter((x) => !mismoRegistro(x, quitar)) };
    return actual.some((x) => mismoRegistro(x, agregar)) ? curso : { ...curso, [campo]: [...actual, agregar] };
  });
