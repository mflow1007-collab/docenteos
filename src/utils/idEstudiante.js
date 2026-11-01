/**
 * idEstudiante.js — identidad única del estudiante en toda la app.
 *
 * Antes cada módulo inventaba su propio ID cuando el estudiante no traía `id`
 * (lista/ficha, Modo Aula, Instrumentos, Registro, Diagnóstico, grupos), y los
 * datos de un módulo no se veían en otro. Regla única (César, 2026-10-30):
 *   1. el `id` del estudiante, si existe;
 *   2. si no, la regla del Registro de calificaciones (`est-{nombre}-{posición}`),
 *      para que las notas y la asistencia ya guardadas sigan enlazadas.
 * Al guardar un curso, los estudiantes sin `id` reciben este ID de forma
 * permanente (conIdsEstudiantes), así deja de depender del nombre y la posición.
 *
 * La cédula es un dato OPCIONAL: nunca bloquea ni se usa como ID.
 */

export const nombreDeEstudiante = (estudiante) => {
  if (typeof estudiante === "string") return estudiante;
  return estudiante?.nombre || estudiante?.nombreCompleto || estudiante?.name || "";
};

export const slugEstudiante = (nombre, indice) => `est-${String(nombre || "sin-nombre")
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "") || "sin-nombre"}-${indice}`;

const tieneId = (estudiante) =>
  estudiante && typeof estudiante === "object" && estudiante.id !== undefined && estudiante.id !== null && estudiante.id !== "";

/** ID único del estudiante en la posición `indice` de estudiantesDetalle. */
export const idEstudiante = (estudiante, indice) =>
  tieneId(estudiante) ? String(estudiante.id) : slugEstudiante(nombreDeEstudiante(estudiante), indice);

/**
 * IDs con los que los módulos guardaron datos ANTES de la regla única. Solo para
 * leer datos viejos (p. ej. evidencias en la ficha); nunca para escribir.
 */
export const idsLegadoEstudiante = (estudiante, indice, { cursoId = "", grupoId = "" } = {}) => {
  const nombre = nombreDeEstudiante(estudiante);
  const ids = [`${cursoId}-${indice}-${nombre}`]; // lista/ficha: ignoraba el id real
  // Sin id, o con el id que fijó conIdsEstudiantes: antes cada módulo inventaba el suyo
  if (!tieneId(estudiante) || String(estudiante.id) === slugEstudiante(nombre, indice)) {
    if (estudiante?.matricula) ids.push(String(estudiante.matricula)); // Modo Aula y grupos
    ids.push(`est-${indice + 1}`); // Modo Aula
    ids.push(`est-${indice}`); // Instrumentos
    ids.push(`${indice}-${nombre}`); // Diagnóstico
    if (grupoId) ids.push(`${grupoId}-est-${indice + 1}`); // grupos académicos
  }
  const actual = idEstudiante(estudiante, indice);
  return [...new Set(ids)].filter((id) => id && id !== actual);
};

/**
 * «est-N» lo usaban dos módulos con numeración distinta: Modo Aula (posición N-1)
 * e Instrumentos (posición N). Así «est-1» puede ser de Ana (Modo Aula) o de
 * Carlos (Instrumentos). Devuelve los ids de este estudiante que otro también
 * podría reclamar y cuál le toca cuando el dato no trae nombre: el de Modo Aula,
 * que es quien guardaba asistencia y resultados sin nombre (F7).
 */
export const idsAmbiguosEstudiante = (estudiante, indice) => {
  const legado = idsLegadoEstudiante(estudiante, indice);
  const candidatos = [`est-${indice + 1}`, ...(indice >= 1 ? [`est-${indice}`] : [])];
  const ambiguos = candidatos.filter((id) => legado.includes(id));
  return { nombre: nombreDeEstudiante(estudiante), ambiguos, sinNombre: ambiguos.includes(`est-${indice + 1}`) ? `est-${indice + 1}` : "" };
};

const claveNombre = (texto) => String(texto || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");

/** Nombre del estudiante guardado junto al dato (resultados, evidencias, anecdóticos). */
export const nombreGuardado = (registro) =>
  registro?.estudianteNombre || registro?.estudiante?.nombre || registro?.nombreEstudiante || "";

/**
 * ¿El dato es de este estudiante? Un id ambiguo solo cuenta si el nombre guardado
 * coincide; sin nombre, solo el id que le toca (sinNombre). No borra nada.
 */
export const esDelEstudiante = (registro, { nombre = "", ambiguos = [], sinNombre = "" } = {}, nombreDe = nombreGuardado) => {
  const id = String(registro?.estudianteId ?? "");
  if (!ambiguos.includes(id)) return true;
  const guardado = nombreDe(registro);
  return guardado ? claveNombre(guardado) === claveNombre(nombre) : id === sinNombre;
};

/** Pase de lista sin las marcas de ids ambiguos que no le tocan (no traen nombre). */
export const asistenciaDelEstudiante = (dias = [], { ambiguos = [], sinNombre = "" } = {}) => {
  const fuera = new Set(ambiguos.filter((id) => id !== sinNombre));
  if (!fuera.size) return dias;
  return dias.map((dia) => ({
    ...dia,
    marcas: Object.fromEntries(Object.entries(dia?.marcas || {}).filter(([id]) => !fuera.has(String(id)))),
  }));
};

/**
 * Resultados, evidencias y pase de lista de UN estudiante sin lo que es de otro
 * por un id ambiguo. La evidencia de un resultado sin nombre toma el nombre de su
 * resultado (`evi-{resultadoId}`). Si `legado` no trae ambiguos, todo queda igual.
 */
export const depurarDatosLegado = (datos = {}, legado = null) => {
  if (!legado?.ambiguos?.length) return datos;
  const nombrePorResultado = new Map((datos.resultados || []).map((r) => [String(r.resultadoId || r.id || ""), nombreGuardado(r)]));
  const nombreDe = (r) => nombreGuardado(r) || nombrePorResultado.get(String(r?.resultadoId || "")) || "";
  const salida = { ...datos };
  if (datos.resultados) salida.resultados = datos.resultados.filter((r) => esDelEstudiante(r, legado));
  if (datos.evidencias) salida.evidencias = datos.evidencias.filter((e) => esDelEstudiante(e, legado, nombreDe));
  if (datos.asistencia) salida.asistencia = asistenciaDelEstudiante(datos.asistencia, legado);
  return salida;
};

/** Devuelve el curso con un `id` permanente en cada estudiante que no lo tenga. */
export const conIdsEstudiantes = (curso) => {
  const lista = curso?.estudiantesDetalle;
  if (!Array.isArray(lista) || lista.every((e) => typeof e !== "object" || tieneId(e))) return curso;
  return {
    ...curso,
    estudiantesDetalle: lista.map((e, i) => (e && typeof e === "object" && !tieneId(e) ? { ...e, id: idEstudiante(e, i) } : e)),
  };
};

/** Aviso (no error) si la cédula no tiene 11 dígitos. Vacía = sin aviso. */
export const avisoCedula = (cedula) => {
  const texto = String(cedula ?? "").trim();
  if (!texto) return "";
  return texto.replace(/\D/g, "").length === 11 ? "" : "La cédula suele tener 11 dígitos (000-0000000-0). Se guardará igual.";
};

/** Formato 000-0000000-0 si trae 11 dígitos; si no, el texto tal cual. */
export const formatearCedula = (cedula) => {
  const texto = String(cedula ?? "").trim();
  const digitos = texto.replace(/\D/g, "");
  return digitos.length === 11 ? `${digitos.slice(0, 3)}-${digitos.slice(3, 10)}-${digitos.slice(10)}` : texto;
};
