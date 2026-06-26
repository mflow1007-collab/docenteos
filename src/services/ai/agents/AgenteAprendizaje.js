/**
 * AgenteAprendizaje — Aprende de las modificaciones de los docentes.
 *
 * Responsabilidades:
 *   - Analizar las versiones del BIC para identificar patrones de mejora recurrentes
 *   - Detectar qué campos modifican más los docentes (tiempo, recursos, actividades...)
 *   - Generar "lecciones aprendidas" que mejoran las plantillas del BIC
 *   - Producir reportes de tendencias para el equipo DocenteOS
 *
 * Este agente opera en modo batch (no en tiempo real) — es invocado periódicamente
 * por AgenteOptimizador o desde el panel de administración.
 */

import { AIService } from "../AIService.js";
import { obtenerVersionesRecientes } from "../learning/VersionManager.js";

const SYSTEM = `Eres el Agente de Aprendizaje de DocenteOS. Analizas cómo los docentes dominicanos modifican las planificaciones generadas por IA para aprender de sus correcciones.

Tu objetivo es identificar:
- Patrones recurrentes de modificación (qué cambian más los docentes)
- Razones probables de cada tipo de cambio
- Mejoras que deberían aplicarse automáticamente en futuras generaciones
- Insights sobre la brecha entre lo que genera la IA y lo que los docentes realmente necesitan

Eres analítico, empático con los docentes y orientado a mejora continua.`;

/**
 * Analiza un conjunto de versiones recientes y extrae patrones de aprendizaje.
 * @param {number} [limite=100] - Cantidad de versiones a analizar
 * @param {{ onChunk, onFinish, onError }} callbacks
 */
export async function analizarPatrones(limite = 100, { onChunk, onFinish, onError }) {
  let versiones = [];
  try {
    versiones = await obtenerVersionesRecientes(limite);
  } catch {
    onError("No se pudieron cargar las versiones del BIC.");
    return;
  }

  if (versiones.length === 0) {
    onFinish("No hay versiones suficientes para analizar patrones aún.");
    return;
  }

  const resumen = _resumirVersiones(versiones);

  await AIService.generate({
    module: "auditoria",
    system: SYSTEM,
    prompt: `Analiza estos ${versiones.length} registros de modificaciones que docentes dominicanos hicieron a planificaciones generadas por IA:

${resumen}

Identifica:

## Patrones principales de modificación
(¿Qué campos cambian más? ¿Con qué frecuencia?)

## Razones probables
(¿Por qué los docentes modifican cada campo?)

## Mejoras para el sistema
(¿Qué debería cambiar en la generación IA para reducir estas ediciones?)

## Insights clave
(Hallazgos sorprendentes o importantes sobre las necesidades reales de los docentes)

## Recomendaciones de acción
(Cambios concretos para el próximo sprint de mejoras)`,
    maxTokens: 1600,
    onChunk, onFinish, onError,
  });
}

/**
 * Analiza una sola versión (modificación de un docente) e infiere la lección aprendida.
 * @param {Object} version - Objeto de versión del BIC
 * @returns {Promise<{ leccion: string, categoria: string, impacto: "alto"|"medio"|"bajo" }>}
 */
export async function inferirLeccion(version) {
  return new Promise(resolve => {
    let acumulado = "";

    const cambiosStr = JSON.stringify(version.cambios ?? {}, null, 2).slice(0, 600);

    AIService.generate({
      module: "auditoria",
      system: SYSTEM,
      prompt: `Un docente dominicano modificó una planificación generada por IA.

Cambios realizados:
${cambiosStr}

Categoría inferida: ${version.motivoEstimado ?? "desconocida"}

Responde en JSON:
{
  "leccion": "string — qué debería mejorar el sistema de IA para evitar este cambio",
  "categoria": "tiempo|recursos|actividades|competencias|contexto|neae|otro",
  "impacto": "alto|medio|bajo",
  "accionSugerida": "string — cambio concreto en el prompt o lógica de generación"
}`,
      maxTokens: 250,
      onChunk: t => { acumulado += t; },
      onFinish: () => {
        try {
          const json = acumulado.match(/\{[\s\S]*\}/)?.[0];
          resolve(json ? JSON.parse(json) : { leccion: "", categoria: "otro", impacto: "bajo" });
        } catch {
          resolve({ leccion: "", categoria: "otro", impacto: "bajo" });
        }
      },
      onError: () => resolve({ leccion: "", categoria: "otro", impacto: "bajo" }),
    });
  });
}

/**
 * Genera un reporte de tendencias para el panel de administración.
 * @param {{ periodo: "semana"|"mes"|"trimestre" }} opciones
 * @param {{ onChunk, onFinish, onError }} callbacks
 */
export async function reporteTendencias({ periodo = "mes" } = {}, { onChunk, onFinish, onError }) {
  let versiones = [];
  const limites = { semana: 50, mes: 200, trimestre: 500 };

  try {
    versiones = await obtenerVersionesRecientes(limites[periodo] ?? 100);
  } catch {
    onError("No se pudieron cargar datos para el reporte.");
    return;
  }

  const categorias = _contarCategorias(versiones);
  const resumen = _resumirVersiones(versiones.slice(0, 50));

  await AIService.generate({
    module: "auditoria",
    system: SYSTEM,
    prompt: `Genera un reporte de tendencias de aprendizaje para el equipo DocenteOS.

Periodo: ${periodo}
Total de ediciones analizadas: ${versiones.length}

Distribución por categoría de cambio:
${Object.entries(categorias).map(([k, v]) => `- ${k}: ${v} ediciones`).join("\n")}

Muestra de cambios:
${resumen}

Presenta un reporte ejecutivo con:
## Resumen del periodo
## Tendencias principales
## Qué está funcionando bien
## Oportunidades de mejora críticas
## Métricas clave (% de planificaciones modificadas, campos más editados)`,
    maxTokens: 1200,
    onChunk, onFinish, onError,
  });
}

// ── Privadas ────────────────────────────────────────────────────────────────────

function _resumirVersiones(versiones) {
  return versiones.slice(0, 30).map((v, i) => {
    const mods = (v.cambios?.modificado ?? []).map(c => c.campo).join(", ");
    return `${i + 1}. [${v.motivoEstimado ?? "otro"}] campos: ${mods || "—"}`;
  }).join("\n");
}

function _contarCategorias(versiones) {
  const conteo = {};
  for (const v of versiones) {
    const cat = v.motivoEstimado ?? "otro";
    conteo[cat] = (conteo[cat] ?? 0) + 1;
  }
  return conteo;
}
