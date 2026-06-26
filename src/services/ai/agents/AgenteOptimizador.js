/**
 * AgenteOptimizador — Mantenimiento y mejora continua del BIC.
 *
 * Responsabilidades:
 *   - Detectar duplicados en el BIC (similitud > 95%) y fusionarlos
 *   - Incorporar mejoras de versiones docentes al ítem canónico del BIC
 *   - Archivar ítems de baja calidad que no mejoran con el tiempo
 *   - Recalcular índices de calidad periódicamente
 *   - Producir un "ítem dorado" fusionando las mejores versiones de un mismo tema
 *
 * Se ejecuta bajo demanda desde el panel admin (api/ai/optimize.js)
 * o periódicamente vía cron.
 */

import { AIService } from "../AIService.js";
import { buscarCandidatos, obtener, actualizarContenido, archivar, guardar } from "../learning/KnowledgeBank.js";
import { obtenerVersiones } from "../learning/VersionManager.js";
import { calcularCalidad } from "../learning/QualityIndex.js";
import { calcSimilarity } from "../learning/SimilarityEngine.js";

const SYSTEM = `Eres el Agente Optimizador de DocenteOS. Tu rol es mejorar la calidad del Banco Inteligente de Conocimiento (BIC).

Tienes acceso a múltiples versiones de planificaciones y puedes:
- Identificar cuál versión es pedagógicamente superior
- Fusionar las mejores partes de versiones diferentes
- Detectar contenido redundante o desactualizado
- Crear un "ítem dorado" que represente lo mejor de cada versión

Prioriza: claridad pedagógica > alineación curricular > variedad de actividades > completitud.`;

/**
 * Detecta duplicados dentro de un conjunto de candidatos del BIC.
 * @param {Object[]} items - Lista de ítems del BIC con sus metadatos
 * @param {number} [umbral=0.95] - Similitud mínima para considerar duplicado
 * @returns {{ pares: Array<[string, string, number]> }} Pares de IDs y su similitud
 */
export function detectarDuplicados(items, umbral = 0.95) {
  const pares = [];

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const score = calcSimilarity(items[i], items[j]);
      if (score >= umbral) {
        pares.push([items[i].id, items[j].id, score]);
      }
    }
  }

  return { pares };
}

/**
 * Fusiona dos ítems del BIC en un "ítem dorado" usando IA.
 * Archiva el de menor calidad y actualiza el de mayor calidad.
 *
 * @param {string} idA - ID del primer ítem
 * @param {string} idB - ID del segundo ítem
 * @param {"planes"|"actividades"|"instrumentos"} tipo
 * @returns {Promise<{ idResultante: string, calidad: number }>}
 */
export async function fusionar(idA, idB, tipo = "planes") {
  const [itemA, itemB] = await Promise.all([obtener(tipo, idA), obtener(tipo, idB)]);

  if (!itemA || !itemB) throw new Error("[Optimizador] No se encontraron los ítems para fusionar.");

  // El ítem de mayor calidad es el canónico
  const [canonico, secundario] = itemA.calidad >= itemB.calidad
    ? [itemA, itemB]
    : [itemB, itemA];

  const fusionado = await _fusionarConIA(canonico, secundario);

  // Actualizar canónico con el contenido fusionado
  const nuevaCalidad = calcularCalidad({
    vecesUsada:      (canonico.vecesUsada ?? 0) + (secundario.vecesUsada ?? 0),
    vecesModificada: (canonico.vecesModificada ?? 0) + (secundario.vecesModificada ?? 0),
    contenido:       fusionado,
  });

  await actualizarContenido(tipo, canonico.id, fusionado, { calidad: nuevaCalidad });
  await archivar(tipo, secundario.id);

  if (import.meta.env.DEV) {
    console.debug(`[Optimizador] Fusión: ${secundario.id} → ${canonico.id} | calidad: ${nuevaCalidad}`);
  }

  return { idResultante: canonico.id, calidad: nuevaCalidad };
}

/**
 * Incorpora las mejoras de versiones docentes al ítem canónico del BIC.
 * Analiza todas las versiones de un plan y genera un contenido mejorado.
 *
 * @param {string} planId - ID del ítem en el BIC
 * @param {string} tipo
 * @returns {Promise<Object>} Contenido mejorado
 */
export async function incorporarMejoras(planId, tipo = "planes") {
  const [item, versiones] = await Promise.all([
    obtener(tipo, planId),
    obtenerVersiones(planId),
  ]);

  if (!item) throw new Error(`[Optimizador] Ítem ${planId} no encontrado.`);
  if (versiones.length === 0) return item.contenido;

  return new Promise((resolve, reject) => {
    let acumulado = "";

    const versionesStr = versiones
      .slice(-5) // últimas 5 versiones
      .map((v, i) => `Versión ${v.version ?? i + 2} [${v.motivoEstimado ?? "cambio"}]: ${JSON.stringify(v.cambios?.modificado?.slice(0, 3) ?? []).slice(0, 200)}`)
      .join("\n");

    AIService.generate({
      module: "planificacion-ia",
      system: SYSTEM,
      prompt: `Mejora este ítem del BIC incorporando las correcciones que los docentes han realizado.

CONTENIDO ACTUAL:
${JSON.stringify(item.contenido, null, 2).slice(0, 2000)}

HISTORIAL DE MEJORAS DE DOCENTES:
${versionesStr}

Genera el contenido mejorado incorporando los cambios más recurrentes y pedagógicamente valiosos.
Mantén la estructura original. Responde SOLO con el JSON mejorado.`,
      maxTokens: 2500,
      onChunk: t => { acumulado += t; },
      onFinish: () => {
        try {
          const json = acumulado.match(/\{[\s\S]*\}/)?.[0];
          resolve(json ? JSON.parse(json) : item.contenido);
        } catch { resolve(item.contenido); }
      },
      onError: err => reject(new Error(err)),
    });
  });
}

/**
 * Ciclo de optimización completo para un tipo de ítem del BIC.
 * Detecta duplicados, los fusiona y archiva ítems de calidad < 50.
 *
 * @param {"planes"|"actividades"|"instrumentos"} tipo
 * @param {{ grado, area }} filtros - Para limitar el alcance
 * @returns {Promise<{ fusionados: number, archivados: number, procesados: number }>}
 */
export async function cicloOptimizacion(tipo, filtros = {}) {
  const candidatos = await buscarCandidatos(tipo, filtros, 100);

  let fusionados = 0;
  let archivados = 0;

  // Archivar ítems de muy baja calidad que no mejoran
  for (const item of candidatos) {
    if ((item.calidad ?? 70) < 50 && (item.vecesUsada ?? 0) === 0) {
      await archivar(tipo, item.id);
      archivados++;
    }
  }

  // Detectar y fusionar duplicados
  const activos = candidatos.filter(c => !c.archivado && (c.calidad ?? 70) >= 50);
  const { pares } = detectarDuplicados(activos, 0.95);

  const procesados = new Set();
  for (const [idA, idB] of pares) {
    if (procesados.has(idA) || procesados.has(idB)) continue;
    try {
      await fusionar(idA, idB, tipo);
      procesados.add(idA);
      procesados.add(idB);
      fusionados++;
    } catch {
      // No fatal — continuar con el siguiente par
    }
  }

  const resultado = { fusionados, archivados, procesados: activos.length };

  if (import.meta.env.DEV) {
    console.table({ "[Optimizador]": tipo, ...resultado });
  }

  return resultado;
}

// ── Privadas ────────────────────────────────────────────────────────────────────

async function _fusionarConIA(canonico, secundario) {
  return new Promise(resolve => {
    let acumulado = "";

    AIService.generate({
      module: "planificacion-ia",
      system: SYSTEM,
      prompt: `Fusiona estos dos ítems del BIC en uno solo de mayor calidad pedagógica.

ÍTEM A (calidad: ${canonico.calidad ?? 70}):
${JSON.stringify(canonico.contenido, null, 2).slice(0, 1500)}

ÍTEM B (calidad: ${secundario.calidad ?? 70}):
${JSON.stringify(secundario.contenido, null, 2).slice(0, 1500)}

Toma lo mejor de cada uno. Mantén la estructura del Ítem A.
Responde SOLO con el JSON fusionado.`,
      maxTokens: 2500,
      onChunk: t => { acumulado += t; },
      onFinish: () => {
        try {
          const json = acumulado.match(/\{[\s\S]*\}/)?.[0];
          resolve(json ? JSON.parse(json) : canonico.contenido);
        } catch { resolve(canonico.contenido); }
      },
      onError: () => resolve(canonico.contenido),
    });
  });
}
