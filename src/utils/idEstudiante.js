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
