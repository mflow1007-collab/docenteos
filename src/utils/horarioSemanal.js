/**
 * Horario semanal por selección: cada curso (grado + sección + materia) guarda
 * en `horarioSemanal` las horas clase que el docente marcó: [{ dia, hora }].
 * El grado y la materia salen del curso y las horas de inicio/fin del timbre
 * (`curso.horario`); aquí no se copia ninguna de las dos. Todo es PURO.
 */

import { crearHorarioPorJornada, normalizarHorarioCurso } from "./horarioCurso.js";

export const DIAS_HORARIO = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

const DIAS_POR_GETDAY = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const simple = (texto) =>
  String(texto || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

const enMinutos = (hhmm) => {
  const [h, m] = String(hhmm || "").split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};

/** 1 → «1.ª», que es como la nombra el docente. */
export const nombreHora = (hora) => `${hora}.ª`;

/** «13:40» → «1:40 p. m.» */
export const hora12 = (hhmm) => {
  const minutos = enMinutos(hhmm);
  if (minutos === null) return "";
  const h = Math.floor(minutos / 60);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(minutos % 60).padStart(2, "0")} ${h >= 12 ? "p. m." : "a. m."}`;
};

/** «2do Secundaria A · Inglés» */
export const etiquetaCurso = (curso) =>
  [curso?.nombre || "Curso", curso?.area].filter(Boolean).join(" · ");

const numeroDeHora = (texto) => {
  const n = Number(String(texto || "").match(/\d+/)?.[0]);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/**
 * Horas clase del timbre del curso: [{ hora, inicio, fin }]. Manda el número
 * del nombre («3ra Hora»); si falta o se repite, manda la posición en el día.
 */
export const horasDelCurso = (curso) => {
  const timbre = Array.isArray(curso?.horario) && curso.horario.length
    ? normalizarHorarioCurso(curso.horario)
    : crearHorarioPorJornada(curso?.jornadaTipo || curso?.nivel, curso?.nivel);
  const vistas = new Set();
  const clases = timbre
    .filter((b) => b.tipo === "clase")
    .sort((a, b) => (enMinutos(a.inicio) ?? 0) - (enMinutos(b.inicio) ?? 0))
    .filter((b) => !vistas.has(b.inicio) && vistas.add(b.inicio));
  const numeros = clases.map((b) => numeroDeHora(b.nombre));
  const confiables = numeros.every((n, i) => n !== null && (i === 0 || n > numeros[i - 1]));
  return clases.map((b, i) => ({ hora: confiables ? numeros[i] : i + 1, inicio: b.inicio, fin: b.fin }));
};

const ordenar = (marcas) =>
  [...marcas].sort((a, b) => DIAS_HORARIO.indexOf(a.dia) - DIAS_HORARIO.indexOf(b.dia) || a.hora - b.hora);

const limpiar = (marcas) => {
  const vistas = new Set();
  return ordenar((marcas || [])
    .map((m) => ({ dia: m?.dia, hora: Number(m?.hora) }))
    .filter(({ dia, hora }) => {
      const clave = `${dia}-${hora}`;
      if (!DIAS_HORARIO.includes(dia) || !Number.isInteger(hora) || hora < 1 || vistas.has(clave)) return false;
      vistas.add(clave);
      return true;
    }));
};

const textoEsDeEsteCurso = (texto, curso) => {
  const t = simple(texto);
  const area = simple(curso?.area);
  const gradoTexto = t.match(/\d+/)?.[0];
  const gradoCurso = simple(curso?.nombre).match(/\d+/)?.[0];
  return Boolean(area) && t.includes(area) && (!gradoTexto || gradoTexto === gradoCurso);
};

/**
 * Horario anterior (`horarioClase`). Sus filas nacían todas en «Lunes», así que
 * solo cuentan las que el docente cambió. Las que nombran otra materia u otro
 * grado, o no dicen qué hora son, se devuelven aparte: no se adivinan.
 */
export const leerHorarioAnterior = (curso) => {
  const marcas = [];
  const sinUbicar = [];
  (Array.isArray(curso?.horarioClase) ? curso.horarioClase : []).forEach((fila) => {
    if (!fila || fila.tipo !== "clase") return;
    const aulaInicial = `Aula ${100 + Number(String(fila.id || "").replace("hc-", ""))}`;
    const tocada = fila.dia !== "Lunes" || fila.bloque || fila.cursoAsignatura
      || (fila.aula && fila.aula !== aulaInicial);
    if (!tocada) return;
    const hora = numeroDeHora(fila.bloque || fila.horaAcademica);
    const ajena = fila.cursoAsignatura && !textoEsDeEsteCurso(fila.cursoAsignatura, curso);
    if (!hora || ajena || !DIAS_HORARIO.includes(fila.dia)) {
      sinUbicar.push([fila.dia, fila.bloque || fila.horaAcademica, fila.cursoAsignatura].filter(Boolean).join(" · "));
    } else {
      marcas.push({ dia: fila.dia, hora });
    }
  });
  return { marcas: limpiar(marcas), sinUbicar };
};

const tieneHorarioNuevo = (curso) => Array.isArray(curso?.horarioSemanal);

/** Horas marcadas del curso; si nunca usó la cuadrícula, las de su horario anterior. */
export const leerHorarioSemanal = (curso) =>
  tieneHorarioNuevo(curso) ? limpiar(curso.horarioSemanal) : leerHorarioAnterior(curso).marcas;

const esMisma = (a, b) => a.dia === b.dia && a.hora === b.hora;

/** Borrador de la cuadrícula: { [cursoId]: marcas } con lo editado encima de lo guardado. */
export const construirBorrador = (cursos = [], ediciones = {}) =>
  Object.fromEntries(cursos.map((c) => [c.id, ediciones[c.id] || leerHorarioSemanal(c)]));

/** Cursos que ocupan esa hora de ese día. */
export const cursosEnHora = (borrador, dia, hora) =>
  Object.keys(borrador).filter((id) => borrador[id].some((m) => esMisma(m, { dia, hora })));

/**
 * Toca una celda con el curso elegido: si es suya la quita; si está libre la
 * pone; si es de otro curso NO cambia nada y devuelve el choque, salvo que se
 * pida reemplazar.
 * @returns {{ cambios: Object, choque: string[] }} cambios por cursoId
 */
export const tocarHora = (borrador, cursoId, dia, hora, { reemplazar = false } = {}) => {
  const id = String(cursoId);
  const marca = { dia, hora };
  const propias = borrador[id] || [];
  if (propias.some((m) => esMisma(m, marca))) {
    return { cambios: { [id]: propias.filter((m) => !esMisma(m, marca)) }, choque: [] };
  }
  const otros = cursosEnHora(borrador, dia, hora).filter((otro) => otro !== id);
  if (otros.length && !reemplazar) return { cambios: {}, choque: otros };
  const cambios = { [id]: limpiar([...propias, marca]) };
  otros.forEach((otro) => { cambios[otro] = borrador[otro].filter((m) => !esMisma(m, marca)); });
  return { cambios, choque: [] };
};

/** Lo que hay que guardar: [{ cursoId, horarioSemanal }]. Confirma también el horario anterior que se ve. */
export const cambiosPorGuardar = (cursos = [], borrador = {}) =>
  cursos
    .filter((c) => {
      const marcas = borrador[c.id] || [];
      if (!tieneHorarioNuevo(c) && marcas.length) return true;
      return JSON.stringify(marcas) !== JSON.stringify(leerHorarioSemanal(c));
    })
    .map((c) => ({ cursoId: c.id, horarioSemanal: borrador[c.id] || [] }));

/** Clases de un día, en orden, con la materia de cada hora. */
export const clasesDelDia = (cursos = [], dia) =>
  cursos
    .flatMap((curso) => {
      const horas = horasDelCurso(curso);
      return leerHorarioSemanal(curso)
        .filter((m) => m.dia === dia)
        .map((m) => {
          const bloque = horas.find((h) => h.hora === m.hora);
          return {
            cursoId: curso.id, curso: curso.nombre || "Curso", materia: curso.area || "",
            etiqueta: etiquetaCurso(curso), dia, hora: m.hora,
            inicio: bloque?.inicio || "", fin: bloque?.fin || "",
          };
        });
    })
    .sort((a, b) => (enMinutos(a.inicio) ?? 1440) - (enMinutos(b.inicio) ?? 1440) || a.hora - b.hora);

const conTexto = (clase, cuando) => ({
  ...clase,
  cuando,
  texto: [`${cuando}, ${nombreHora(clase.hora)} hora`, hora12(clase.inicio)].filter(Boolean).join(" · "),
});

/** La clase que el docente está dando en este momento, o null. */
export const claseDeAhora = (cursos = [], ahora = new Date()) => {
  const minutos = ahora.getHours() * 60 + ahora.getMinutes();
  const clase = clasesDelDia(cursos, DIAS_POR_GETDAY[ahora.getDay()]).find((c) => {
    const inicio = enMinutos(c.inicio);
    const fin = enMinutos(c.fin);
    return inicio !== null && fin !== null && minutos >= inicio && minutos < fin;
  });
  return clase ? conTexto(clase, "Ahora") : null;
};

/** La próxima clase que aún no empieza (hasta una semana adelante), o null si no hay horario. */
export const proximaClase = (cursos = [], ahora = new Date()) => {
  const minutos = ahora.getHours() * 60 + ahora.getMinutes();
  for (let salto = 0; salto <= 7; salto += 1) {
    const dia = DIAS_POR_GETDAY[(ahora.getDay() + salto) % 7];
    const clase = clasesDelDia(cursos, dia)
      .find((c) => (salto > 0 ? true : enMinutos(c.inicio) !== null && enMinutos(c.inicio) > minutos));
    if (clase) return conTexto(clase, salto === 0 ? "Hoy" : salto === 1 ? "Mañana" : salto === 7 ? `El próximo ${dia.toLowerCase()}` : dia);
  }
  return null;
};
