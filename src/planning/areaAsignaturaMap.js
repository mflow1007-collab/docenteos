/**
 * areaAsignaturaMap.js
 *
 * Mapa centralizado de áreas curriculares → asignaturas del MINERD.
 * - Áreas con UNA asignatura: la asignatura se asigna automáticamente.
 * - Áreas con VARIAS asignaturas: el docente debe elegir desde un selector.
 *
 * Para agregar nuevas áreas o asignaturas, editar solo este archivo.
 */

export const AREA_ASIGNATURAS = {
  "Lengua Española":                    ["Lengua Española"],
  "Matemática":                         ["Matemática"],
  "Ciencias Sociales":                  ["Historia", "Geografía"],
  "Ciencias de la Naturaleza":          ["Biología", "Química", "Física"],
  "Lenguas Extranjeras":                ["Inglés", "Francés"],
  "Educación Física":                   ["Educación Física"],
  "Educación Artística":                ["Educación Artística"],
  "Formación Integral Humana y Religiosa": ["Formación Integral Humana y Religiosa"],
  "Tecnología":                         ["Tecnología"],
};

export const getAreas = () => Object.keys(AREA_ASIGNATURAS);

export const getAsignaturas = (area) => AREA_ASIGNATURAS[area] ?? [];

export const tieneMultiplesAsignaturas = (area) => getAsignaturas(area).length > 1;

/**
 * Retorna la asignatura cuando el área tiene una sola, o null si hay varias.
 * Usar para auto-asignación.
 */
export const getAsignaturaAutomatica = (area) => {
  const lista = getAsignaturas(area);
  return lista.length === 1 ? lista[0] : null;
};

/**
 * Resuelve la clave para lookups en diccionarios de contenido de los servicios.
 * Prioriza la asignatura específica si existe como clave en `mapa`;
 * si no, usa el área como fallback.
 */
export const resolverClave = (asignatura, area, mapa) => {
  if (asignatura && Object.prototype.hasOwnProperty.call(mapa, asignatura)) {
    return asignatura;
  }
  return area;
};
