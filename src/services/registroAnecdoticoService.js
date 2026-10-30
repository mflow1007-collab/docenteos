/**
 * registroAnecdoticoService.js — guarda y lee el Registro anecdótico.
 *
 * Usa el camino de evidencias (guardarEvidenciaEstudiante: merge, doble escritura)
 * con tipo "registro_anecdotico". La lógica pura está en utils/registroAnecdotico.js.
 */

import { crearEvidencia, obtenerEvidenciasPorEstudiante } from "./evidenciasService.js";
import { construirAnotacion, esRegistroAnecdotico, ordenarAnotaciones } from "../utils/registroAnecdotico.js";

/** Crea una anotación. Lanza un error visible si faltan datos o falla el guardado. */
export const crearAnotacionAnecdotica = async (datos) => crearEvidencia(construirAnotacion(datos));

/** Anotaciones de un estudiante (filtro opcional por curso), la más reciente primero. */
export const obtenerAnotacionesAnecdoticas = async (estudianteId, { cursoId = "" } = {}) => {
  const evidencias = await obtenerEvidenciasPorEstudiante(estudianteId, { cursoId });
  return ordenarAnotaciones(evidencias.filter(esRegistroAnecdotico));
};
