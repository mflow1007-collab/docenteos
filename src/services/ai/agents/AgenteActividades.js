/**
 * AgenteActividades — Diseño de actividades pedagógicas de alta calidad.
 *
 * Responsabilidades:
 *   - Generar actividades nuevas para un momento/tema dado
 *   - Regenerar actividades de baja calidad dentro de una planificación
 *   - Indexar actividades reutilizables en el BIC independientemente
 *   - Sugerir estrategias pedagógicas activas (ABP, gamificación, cooperativo)
 */

import { AIService } from "../AIService.js";
import { conFundamento } from "../../fundamentoDoctrinalService.js";

const SYSTEM = `Eres el Agente de Actividades de DocenteOS, experto en diseño de experiencias de aprendizaje activas para escuelas dominicanas.

Principios que guían tus actividades:
- Aprendizaje activo y participativo (NO dictado, NO copia)
- Contextualizado en la realidad dominicana (barrio, familia, cultura local)
- Inclusivo y adaptable a diferentes ritmos de aprendizaje
- Con recursos accesibles: cartulina, marcadores, objetos cotidianos, tecnología básica
- Alineado al enfoque por competencias del MINERD

Formatos válidos de actividad:
  juego, debate, proyecto, experimento, investigación, roleplay,
  trabajo cooperativo, galería, estudio de caso, creación artística,
  salida pedagógica, entrevista comunitaria, demostración práctica`;

/**
 * Genera actividades nuevas para un momento específico de una clase.
 *
 * @param {{ grado, area, tema, momento, competencia, tiempo, indicador }} params
 * @param {{ onChunk, onFinish, onError }} callbacks
 */
export async function generarActividades({ grado, area, tema, momento = "Desarrollo", competencia, tiempo = 30, indicador }, { onChunk, onFinish, onError }) {
  await AIService.generate({
    module: "planificacion-ia",
    system: await conFundamento(SYSTEM, grado),
    prompt: `Diseña 3 actividades para el momento de ${momento} de una clase de ${area} para ${grado}.

Tema: ${tema}
Competencia: ${competencia ?? "competencia del área"}
${indicador ? `Indicador: ${indicador}` : ""}
Tiempo disponible: ${tiempo} minutos

Para cada actividad incluye:
- Nombre atractivo
- Descripción paso a paso (máx 3 pasos claros)
- Recursos necesarios
- Cómo evalúas participación/logro
- Duración estimada

Formato: lista numerada clara, sin JSON.`,
    maxTokens: 1000,
    onChunk, onFinish, onError,
  });
}

/**
 * Regenera las actividades de una semana de planificación con nuevas ideas.
 *
 * @param {{ grado, area, tema, actividadesActuales, fase, semana }} params
 * @param {{ onChunk, onFinish, onError }} callbacks
 */
export async function regenerarSemana({ grado, area, tema, actividadesActuales = [], fase, semana }, { onChunk, onFinish, onError }) {
  const listaActuales = actividadesActuales
    .slice(0, 5)
    .map((a, i) => `${i + 1}. ${String(a).slice(0, 80)}`)
    .join("\n");

  await AIService.generate({
    module: "planificacion-ia",
    system: await conFundamento(SYSTEM, grado),
    prompt: `Genera actividades NUEVAS y DIFERENTES para la Semana ${semana ?? 1} de ${fase ?? "una unidad"} de ${area} para ${grado}.

Tema: ${tema}

Actividades actuales (EVITAR repetirlas):
${listaActuales || "Ninguna aún"}

Crea 4 actividades variadas: una para inicio de clase, dos para desarrollo y una de cierre.
Prioriza actividades prácticas, colaborativas y creativas apropiadas para el contexto escolar dominicano.`,
    maxTokens: 1200,
    onChunk, onFinish, onError,
  });
}

/**
 * Evalúa si una lista de actividades es variada y pedagógicamente sólida.
 * Retorna un análisis con sugerencias de mejora.
 *
 * @param {string[]} actividades
 * @param {{ grado, area }} meta
 * @returns {Promise<{ score: number, sugerencias: string[] }>}
 */
export async function evaluarVariedad(actividades, { grado, area }) {
  return new Promise(resolve => {
    let acumulado = "";
    const lista = actividades.slice(0, 10).map((a, i) => `${i + 1}. ${String(a).slice(0, 100)}`).join("\n");

    AIService.generate({
      module: "auditoria",
      system: await conFundamento(SYSTEM, grado),
      prompt: `Evalúa la variedad pedagógica de estas actividades para ${area} en ${grado}:

${lista}

Responde en JSON:
{
  "score": 0-100,
  "tiposDetectados": ["juego", "exposición", ...],
  "tiposFaltantes": ["proyecto", "debate", ...],
  "sugerencias": ["Agregar una actividad cooperativa", ...]
}`,
      maxTokens: 400,
      onChunk: t => { acumulado += t; },
      onFinish: () => {
        try {
          const json = acumulado.match(/\{[\s\S]*\}/)?.[0];
          resolve(json ? JSON.parse(json) : { score: 70, sugerencias: [] });
        } catch {
          resolve({ score: 70, sugerencias: [] });
        }
      },
      onError: () => resolve({ score: 70, sugerencias: [] }),
    });
  });
}

/**
 * Sugiere estrategias pedagógicas para un área/tema específico.
 */
export async function sugerirEstrategias({ area, tema, grado, cantidadEstudiantes = 30 }, { onChunk, onFinish, onError }) {
  await AIService.generate({
    module: "planificacion-ia",
    system: await conFundamento(SYSTEM, grado),
    prompt: `Sugiere 5 estrategias pedagógicas para enseñar "${tema}" en ${area} para ${grado} con ${cantidadEstudiantes} estudiantes.

Para cada estrategia:
- Nombre
- Por qué es efectiva para este tema
- Cómo implementarla en 45-90 minutos
- Recursos mínimos necesarios`,
    maxTokens: 900,
    onChunk, onFinish, onError,
  });
}
