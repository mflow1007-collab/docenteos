/**
 * F7 — Competencias de la malla oficial de un curso (curricularContent), la
 * misma que usa el generador de planes. Son las columnas de la C.F. y dicen a
 * qué competencia pertenece cada indicador.
 * Devuelve { competencias, fuente }; competencias vacío = sin malla (el que
 * llama lo muestra, nunca se inventa una tabla). Un fallo de lectura lanza.
 */
import { getCurricularContentForUnit } from "./bancoConocimientoService.js";
import { resolverContextoCurricular } from "./diagnosticoCurricularService.js";

export const obtenerCompetenciasMallaCurso = async (curso = {}) => {
  const ctx = resolverContextoCurricular(curso);
  if (!ctx.valido) return { competencias: [], fuente: `falta ${ctx.faltan.join(" y ")}` };
  const malla = await getCurricularContentForUnit(ctx.materia, ctx.grado, ctx.nivel);
  const competencias = (malla?.payload || malla)?.competencias || [];
  return { competencias, fuente: competencias.length ? `${ctx.materia} ${ctx.grado}` : `${ctx.materia} ${ctx.grado} (${ctx.nivel})` };
};
