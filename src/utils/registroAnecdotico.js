/**
 * registroAnecdotico.js — núcleo puro del Registro anecdótico del estudiante.
 *
 * Cada anotación se guarda como una evidencia con tipo "registro_anecdotico"
 * (mismo camino que las evidencias: ficha y Modo Aula escriben en un solo sitio).
 * Se muestra APARTE: las vistas de evidencias la excluyen con esRegistroAnecdotico.
 * Sin vínculo a indicadores ni al Informe IA (decisión de César, 2026-10-30).
 */

export const TIPO_REGISTRO_ANECDOTICO = "registro_anecdotico";

export const CAMPOS_REGISTRO_ANECDOTICO = [
  { clave: "contexto", etiqueta: "Contexto", ayuda: "Dónde y en qué situación ocurrió (clase, recreo, actividad)." },
  { clave: "hecho", etiqueta: "Hecho observado", ayuda: "Lo que ocurrió, descrito de forma objetiva, sin juicios." },
  { clave: "interpretacion", etiqueta: "Interpretación", ayuda: "Lo que el docente cree que significa." },
  { clave: "accion", etiqueta: "Acción / seguimiento", ayuda: "Qué se hizo o qué se hará después." },
  { clave: "compromisos", etiqueta: "Compromisos o acuerdos", ayuda: "Acuerdos con el estudiante o la familia." },
];

const limpio = (valor) => String(valor ?? "").trim();

export const esRegistroAnecdotico = (evidencia) => evidencia?.tipo === TIPO_REGISTRO_ANECDOTICO;

/** Fecha local de hoy en formato AAAA-MM-DD (para el campo de fecha). */
export const fechaHoyISO = (ahora = new Date()) => {
  const dosDigitos = (n) => String(n).padStart(2, "0");
  return `${ahora.getFullYear()}-${dosDigitos(ahora.getMonth() + 1)}-${dosDigitos(ahora.getDate())}`;
};

/** Devuelve la lista de errores visibles; vacía si la anotación se puede guardar. */
export const validarAnotacion = (datos) => {
  const errores = [];
  if (!limpio(datos?.estudianteId)) errores.push("Falta el estudiante.");
  if (!limpio(datos?.cursoId)) errores.push("Falta el curso del estudiante.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(limpio(datos?.fecha))) errores.push("La fecha no es válida.");
  if (!limpio(datos?.hecho)) errores.push("Escribe el hecho observado.");
  return errores;
};

/**
 * Arma la evidencia que se guarda. Lanza un error si la anotación no es válida.
 * `ahora` permite fijar el ID en las pruebas.
 */
export const construirAnotacion = (datos, { ahora = new Date() } = {}) => {
  const errores = validarAnotacion(datos);
  if (errores.length) throw new Error(errores.join(" "));
  const evidenciaId = `anec-${limpio(datos.estudianteId)}-${ahora.getTime()}`;
  const campos = Object.fromEntries(CAMPOS_REGISTRO_ANECDOTICO.map(({ clave }) => [clave, limpio(datos[clave])]));
  return {
    id: evidenciaId,
    evidenciaId,
    tipo: TIPO_REGISTRO_ANECDOTICO,
    categoria: "Registro anecdótico",
    origen: limpio(datos.origen) || "ficha_estudiante",
    estudianteId: limpio(datos.estudianteId),
    estudianteNombre: limpio(datos.estudianteNombre),
    cursoId: limpio(datos.cursoId),
    fecha: limpio(datos.fecha),
    ...campos,
    texto: campos.hecho,
    descripcion: campos.hecho,
    claseTitulo: limpio(datos.claseTitulo),
    indicadorIds: [],
  };
};

/** Más reciente primero; a igual fecha, la creada después va antes. */
export const ordenarAnotaciones = (anotaciones = []) =>
  [...anotaciones].sort((a, b) =>
    String(b.fecha || "").localeCompare(String(a.fecha || ""))
    || String(b.creadoEn || "").localeCompare(String(a.creadoEn || "")));
