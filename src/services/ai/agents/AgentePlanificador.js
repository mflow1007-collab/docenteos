/**
 * AgentePlanificador — Generación y adaptación de planificaciones didácticas.
 *
 * Responsabilidades:
 *   - Generar planificaciones nuevas (Nivel 3 del flujo BIC)
 *   - Adaptar planificaciones existentes del BIC (Nivel 2)
 *   - Aplicar modificaciones dirigidas: tiempo, contexto, enfoque pedagógico
 *
 * Nota: Este agente NO valida el currículo — eso es responsabilidad del
 * AgenteCurricular. Asume que los datos de entrada ya fueron verificados.
 */

import { AIService } from "../AIService.js";
import { conFundamento } from "../../fundamentoDoctrinalService.js";
import { getReferenciaAdecuacionesCurriculares } from "../../../data/adecuacionesCurriculares.js";

const SYSTEM = `Eres el Agente Planificador de DocenteOS, experto en diseño didáctico para escuelas dominicanas (currículo MINERD).

Diseñas planificaciones semanales y diarias usando el enfoque por competencias. Tus planificaciones incluyen:
- Intención pedagógica clara
- Momentos: Inicio / Desarrollo / Cierre
- Actividades activas y participativas (no dictado)
- Recursos accesibles en escuelas dominicanas
- Estrategias de evaluación formativa
- Espacio para metacognición

Formato de salida: JSON estructurado con semanas → días → momentos.
Responde SIEMPRE con JSON válido, sin texto adicional.`;

/**
 * Adapta una planificación existente del BIC para una consulta nueva.
 * Nivel 2 del flujo de decisión (70-90% similitud).
 *
 * @param {Object} candidato  - Ítem BIC con { contenido, grado, area, tema, ... }
 * @param {Object} query      - Parámetros de la nueva consulta
 * @param {Object} opciones   - { ajustarFechas, ajustarContexto, nuevasSemanas }
 * @returns {Promise<Object>} Contenido adaptado
 */
export async function adaptar(candidato, query, opciones = {}) {
  const system = await conFundamento(SYSTEM, query.grado ?? candidato.grado ?? '');
  return new Promise((resolve, reject) => {
    let acumulado = "";

    const cambios = [];
    if (query.tema && query.tema !== candidato.tema)
      cambios.push(`- Nuevo tema: "${query.tema}" (antes: "${candidato.tema}")`);
    if (query.grado && query.grado !== candidato.grado)
      cambios.push(`- Nuevo grado: ${query.grado} (antes: ${candidato.grado})`);
    if (opciones.ajustarFechas)
      cambios.push("- Actualizar fechas al periodo actual");
    if (opciones.nuevasSemanas)
      cambios.push(`- Ajustar a ${opciones.nuevasSemanas} semanas`);

    const prompt = `Adapta la siguiente planificación del BIC aplicando estos cambios:
${cambios.length ? cambios.join("\n") : "- Actualizar contexto al nuevo docente"}

=== PLANIFICACIÓN BASE (del BIC) ===
${JSON.stringify(candidato.contenido, null, 2).slice(0, 3000)}

=== NUEVA CONSULTA ===
Grado: ${query.grado ?? candidato.grado}
Área: ${query.area ?? candidato.area}
Tema: ${query.tema ?? candidato.tema}
Competencia: ${query.competencia ?? candidato.competencia}
${query.indicadores ? `Indicadores: ${Array.isArray(query.indicadores) ? query.indicadores.join(", ") : query.indicadores}` : ""}

Retorna el JSON de la planificación adaptada. Mantén la estructura original. Solo modifica lo necesario.`;

    AIService.generate({
      module: "planificacion-ia",
      system,
      prompt,
      maxTokens: 3000,
      onChunk: t => { acumulado += t; },
      onFinish: () => {
        try {
          const json = acumulado.match(/\{[\s\S]*\}/)?.[0]
            ?? acumulado.match(/\[[\s\S]*\]/)?.[0];
          resolve(json ? JSON.parse(json) : { _raw: acumulado, _base: candidato.contenido });
        } catch {
          resolve({ _raw: acumulado, _base: candidato.contenido });
        }
      },
      onError: err => reject(new Error(err)),
    });
  });
}

/**
 * Aplica una adaptación de tiempo a una planificación existente.
 * @param {Object} contenido   - Planificación a ajustar
 * @param {number} minutos     - Nueva duración de clase en minutos
 * @returns {Promise<Object>}
 */
export async function ajustarTiempo(contenido, minutos) {
  const system = await conFundamento(SYSTEM, '');
  return new Promise((resolve, reject) => {
    let acumulado = "";
    AIService.generate({
      module: "planificacion-ia",
      system,
      prompt: `Ajusta los tiempos de esta planificación para clases de ${minutos} minutos.
Redistribuye los momentos (Inicio/Desarrollo/Cierre) de forma proporcional.
Elimina o condensa actividades si es necesario. NO agregues contenido nuevo.

PLANIFICACIÓN:
${JSON.stringify(contenido, null, 2).slice(0, 2500)}

Retorna el JSON con los tiempos ajustados.`,
      maxTokens: 2500,
      onChunk: t => { acumulado += t; },
      onFinish: () => {
        try {
          const json = acumulado.match(/\{[\s\S]*\}/)?.[0];
          resolve(json ? JSON.parse(json) : contenido);
        } catch { resolve(contenido); }
      },
      onError: () => resolve(contenido),
    });
  });
}

/**
 * Aplica adecuaciones NEAE a una planificación.
 * @param {Object} contenido
 * @param {string[]} tiposNEAE - ["TEA", "discapacidad visual", "hipoacusia", ...]
 * @returns {Promise<Object>}
 */
export async function adaptarNEAE(contenido, tiposNEAE = []) {
  const system = await conFundamento(SYSTEM, '');
  return new Promise((resolve, reject) => {
    let acumulado = "";
    const neaeLista = tiposNEAE.length
      ? tiposNEAE.join(", ")
      : "necesidades educativas especiales generales";
    const referenciaAdecuaciones = getReferenciaAdecuacionesCurriculares();

    AIService.generate({
      module: "planificacion-ia",
      system,
      prompt: `Incorpora adecuaciones curriculares para estudiantes con ${neaeLista} en esta planificación.

Usa como referente la ${referenciaAdecuaciones}

Para cada actividad, agrega una versión adaptada. Incluye adecuaciones de acceso, metodológicas y de evaluación apropiadas para el contexto dominicano.

PLANIFICACIÓN:
${JSON.stringify(contenido, null, 2).slice(0, 2000)}

Retorna el JSON con las adecuaciones integradas.`,
      maxTokens: 2800,
      onChunk: t => { acumulado += t; },
      onFinish: () => {
        try {
          const json = acumulado.match(/\{[\s\S]*\}/)?.[0];
          resolve(json ? JSON.parse(json) : contenido);
        } catch { resolve(contenido); }
      },
      onError: () => resolve(contenido),
    });
  });
}
