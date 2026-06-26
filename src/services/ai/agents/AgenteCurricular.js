/**
 * AgenteCurricular — Especialista en el Diseño Curricular MINERD.
 *
 * Responsabilidades:
 *   - Verificar que competencias e indicadores corresponden al currículo oficial
 *   - Resolver ambigüedades en nomenclaturas (ej. "Lengua Española" vs "Español")
 *   - Proporcionar contexto curricular a otros agentes
 *   - Completar metadatos faltantes (área, nivel, ciclo) a partir de otros campos
 */

import { AIService } from "../AIService.js";

const SYSTEM = `Eres el Agente Curricular de DocenteOS, especialista en el Diseño Curricular del Nivel Primario y Secundario de la República Dominicana (MINERD).

Conoces con precisión:
- Las áreas curriculares y sus asignaturas por nivel/ciclo
- Las competencias específicas y fundamentales por área y grado
- Los indicadores de logro organizados por trimestre y bimestre
- La terminología oficial MINERD (Preprimario, Primario 1er ciclo, 2do ciclo, Secundario)

Responde siempre con información precisa del currículo dominicano. Si no tienes certeza, dilo explícitamente.`;

/**
 * Verifica si una competencia e indicadores corresponden al currículo oficial.
 * @param {{ grado, area, competencia, indicadores }} params
 * @param {Function} onChunk  - streaming callback
 * @param {Function} onFinish
 * @param {Function} onError
 */
export async function verificarAlineacionCurricular({ grado, area, competencia, indicadores }, { onChunk, onFinish, onError }) {
  const ind = Array.isArray(indicadores) ? indicadores.join("\n- ") : indicadores;

  await AIService.generate({
    module: "auditoria",
    system: SYSTEM,
    prompt: `Verifica si la siguiente competencia e indicadores corresponden fielmente al currículo MINERD para ${grado} en el área de ${area}.

Competencia: ${competencia}

Indicadores:
- ${ind}

Analiza:
1. ¿Esta competencia existe en el currículo oficial para ${grado}?
2. ¿Los indicadores corresponden a esa competencia y grado?
3. ¿Hay indicadores que pertenecen a otro grado o trimestre?
4. Correcciones sugeridas si aplica.

Sé preciso y cita el área y grado oficial cuando sea posible.`,
    maxTokens: 800,
    onChunk, onFinish, onError,
  });
}

/**
 * Completa metadatos curriculares a partir de información parcial.
 * @param {{ grado?, area?, competencia? }} datos
 * @returns {Promise<Object>} Metadatos completados
 */
export async function completarMetadatos(datos) {
  return new Promise(resolve => {
    let acumulado = "";
    AIService.generate({
      module: "auditoria",
      system: SYSTEM,
      prompt: `Dado estos datos parciales de una planificación dominicana:
${JSON.stringify(datos, null, 2)}

Infiere y completa en formato JSON los campos faltantes:
- nivel (Primario / Secundario)
- ciclo (Primer Ciclo / Segundo Ciclo)
- area (nombre oficial MINERD)
- asignatura (si difiere del área)
- grado (formato: "1ro de Primaria", "7mo de Secundaria", etc.)

Responde SOLO con el JSON completado, sin texto adicional.`,
      maxTokens: 300,
      onChunk: t => { acumulado += t; },
      onFinish: () => {
        try {
          const json = acumulado.match(/\{[\s\S]*\}/)?.[0];
          resolve(json ? JSON.parse(json) : datos);
        } catch {
          resolve(datos);
        }
      },
      onError: () => resolve(datos),
    });
  });
}

/**
 * Sugiere competencias e indicadores para un grado/área/tema dado.
 */
export async function sugerirCompetencias({ grado, area, tema }, { onChunk, onFinish, onError }) {
  await AIService.generate({
    module: "planificacion-ia",
    system: SYSTEM,
    prompt: `Para ${grado} en el área de ${area}, tema "${tema}", sugiere:

1. La competencia específica más apropiada según el currículo MINERD
2. 2-3 indicadores de logro relevantes para este tema
3. El trimestre/bimestre más común para abordar este tema

Usa la nomenclatura oficial del Diseño Curricular Dominicano.`,
    maxTokens: 500,
    onChunk, onFinish, onError,
  });
}
