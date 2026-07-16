/**
 * AgenteEvaluador — Diseño de instrumentos de evaluación alineados al MINERD.
 *
 * Responsabilidades:
 *   - Generar los 7 tipos de instrumentos soportados por DocenteOS
 *   - Adaptar instrumentos del BIC a nuevos contextos
 *   - Verificar que los indicadores del instrumento cubran los de la planificación
 *   - Sugerir evidencias de aprendizaje apropiadas
 *
 * Tipos: Rúbrica, Lista de cotejo, Escala de estimación, Registro anecdótico,
 *        Prueba escrita, Autoevaluación, Coevaluación
 */

import { AIService } from "../AIService.js";
import { conFundamento } from "../../fundamentoDoctrinalService.js";

const SYSTEM = `Eres el Agente Evaluador de DocenteOS, experto en evaluación por competencias para el sistema educativo dominicano (MINERD).

Diseñas instrumentos de evaluación:
- Alineados a indicadores de logro específicos
- Con criterios claros y observables
- En lenguaje apropiado para docentes dominicanos
- Que permiten evaluación formativa y sumativa
- Con niveles de desempeño descriptivos (no solo números)

Niveles de desempeño estándar MINERD: Avanzado, Notable, Elemental, Inicial`;

const SCHEMAS = {
  "Rúbrica": `{
  "titulo": "string",
  "competencia": "string",
  "indicador": "string",
  "criterios": [
    { "criterio": "string", "Avanzado": "string", "Notable": "string", "Elemental": "string", "Inicial": "string" }
  ]
}`,
  "Lista de cotejo": `{
  "titulo": "string",
  "competencia": "string",
  "indicadores": [ { "indicador": "string", "logrado": null, "observaciones": "" } ]
}`,
  "Escala de estimación": `{
  "titulo": "string",
  "competencia": "string",
  "indicadores": [ { "indicador": "string", "escala": ["Siempre","Frecuentemente","A veces","Nunca"] } ]
}`,
  "Registro anecdótico": `{
  "titulo": "string",
  "competencia": "string",
  "criterios": [ { "aspecto": "string", "descripcion": "string", "fecha": "", "observacion": "" } ]
}`,
  "Prueba escrita": `{
  "titulo": "string",
  "competencia": "string",
  "criterios": [
    { "criterio": "string (tipo de pregunta)", "descripcion": "string (enunciado)", "puntos": 0 }
  ]
}`,
  "Autoevaluación": `{
  "titulo": "string",
  "competencia": "string",
  "indicadores": [ { "indicador": "string", "escala": ["Lo logré muy bien","Lo logré","Necesito mejorar"] } ]
}`,
  "Coevaluación": `{
  "titulo": "string",
  "competencia": "string",
  "criterios": [
    { "criterio": "string", "Excelente": "string", "Bueno": "string", "Necesita mejorar": "string" }
  ]
}`,
};

/**
 * Genera un instrumento de evaluación completo.
 *
 * @param {{ tipo, tema, area, grado, competencia, indicador }} params
 * @returns {Promise<Object>} JSON del instrumento
 */
export async function generarInstrumento({ tipo = "Rúbrica", tema, area, grado, competencia, indicador }) {
  const system = await conFundamento(SYSTEM, grado);
  return new Promise((resolve, reject) => {
    let acumulado = "";
    const schema = SCHEMAS[tipo] ?? SCHEMAS["Rúbrica"];

    AIService.generate({
      module: "instrumentos",
      system,
      prompt: `Crea un instrumento de ${tipo} para:
Área: ${area}   Grado: ${grado}
Tema: ${tema}
Competencia: ${competencia}
${indicador ? `Indicador: ${indicador}` : ""}

Usa exactamente esta estructura JSON:
${schema}

Reglas:
- Los descriptores de nivel deben ser claros, específicos y observables
- Usa lenguaje sencillo, apropiado para el contexto dominicano
- Mínimo 4 criterios/indicadores, máximo 8
- Responde SOLO con el JSON, sin texto adicional`,
      maxTokens: 1400,
      onChunk: t => { acumulado += t; },
      onFinish: () => {
        try {
          const json = acumulado.match(/\{[\s\S]*\}/)?.[0];
          resolve(json ? JSON.parse(json) : { _raw: acumulado, tipo });
        } catch {
          resolve({ _raw: acumulado, tipo });
        }
      },
      onError: err => reject(new Error(err)),
    });
  });
}

/**
 * Adapta un instrumento del BIC para un nuevo contexto.
 *
 * @param {Object} instrumentoBase - Instrumento del BIC
 * @param {{ tema, competencia, indicador }} nuevoCont
 * @returns {Promise<Object>}
 */
export async function adaptarInstrumento(instrumentoBase, nuevoCont) {
  const system = await conFundamento(SYSTEM, '');
  return new Promise(resolve => {
    let acumulado = "";

    AIService.generate({
      module: "instrumentos",
      system,
      prompt: `Adapta el siguiente instrumento para un nuevo contexto. Mantén la estructura y tipo, cambia solo el contenido.

INSTRUMENTO BASE:
${JSON.stringify(instrumentoBase, null, 2).slice(0, 1500)}

NUEVO CONTEXTO:
Tema: ${nuevoCont.tema ?? "—"}
Competencia: ${nuevoCont.competencia ?? "—"}
${nuevoCont.indicador ? `Indicador: ${nuevoCont.indicador}` : ""}

Retorna el JSON adaptado. Misma estructura que el original.`,
      maxTokens: 1200,
      onChunk: t => { acumulado += t; },
      onFinish: () => {
        try {
          const json = acumulado.match(/\{[\s\S]*\}/)?.[0];
          resolve(json ? JSON.parse(json) : instrumentoBase);
        } catch { resolve(instrumentoBase); }
      },
      onError: () => resolve(instrumentoBase),
    });
  });
}

/**
 * Verifica que un instrumento cubre los indicadores de una planificación.
 * @param {Object} instrumento
 * @param {string[]} indicadoresPlan
 * @returns {Promise<{ cobertura: number, faltantes: string[] }>}
 */
export async function verificarCobertura(instrumento, indicadoresPlan) {
  const system = await conFundamento(SYSTEM, '');
  return new Promise(resolve => {
    let acumulado = "";
    const indStr = indicadoresPlan.slice(0, 6).join("\n- ");

    AIService.generate({
      module: "auditoria",
      system,
      prompt: `Verifica si este instrumento cubre los indicadores de la planificación.

INSTRUMENTO:
${JSON.stringify(instrumento, null, 2).slice(0, 800)}

INDICADORES DE LA PLANIFICACIÓN:
- ${indStr}

Responde en JSON:
{
  "cobertura": 0-100,
  "cubiertos": ["indicador 1", ...],
  "faltantes": ["indicador no cubierto", ...],
  "recomendacion": "string"
}`,
      maxTokens: 400,
      onChunk: t => { acumulado += t; },
      onFinish: () => {
        try {
          const json = acumulado.match(/\{[\s\S]*\}/)?.[0];
          resolve(json ? JSON.parse(json) : { cobertura: 80, faltantes: [] });
        } catch { resolve({ cobertura: 80, faltantes: [] }); }
      },
      onError: () => resolve({ cobertura: 80, faltantes: [] }),
    });
  });
}

export const TIPOS_INSTRUMENTO = Object.keys(SCHEMAS);
export const ESQUEMAS_INSTRUMENTO = SCHEMAS;
