/**
 * PlanificacionInteligente — Función de entrada para generación de planificaciones.
 *
 * Implementa el orden de resolución aprobado:
 *   1. ke_estilos relacionados
 *   2. ke_ejemplos tipo caso_exito
 *   3. ke_memoria filtradas por topicId
 *   4. ke_memoria generales del agente
 *   5. bic_planes (reutilizar Nivel 1 / adaptar Nivel 2)
 *   6. Currículo oficial MINERD (integrado en generarPlanificacion local)
 *   7. IA externa — disponible en acciones posteriores (mejorar, auditar, regenerar)
 *
 * PlanificacionPage llama a esta función en lugar de llamar a generarPlanificacion
 * o checkBIC directamente.
 */

import { run as orchestratorRun, checkBIC } from "./agents/AgentOrchestrator.js";
import { generarPlanificacion } from "../planificacionService.js";
import { EventTracker } from "./learning/EventTracker.js";
import { LEARNING_EVENTS, AGENT_IDS } from "./knowledge/KnowledgeTypes.js";

/**
 * Genera una planificación usando el flujo inteligente completo de DocenteOS.
 *
 * Si BIC tiene coincidencia → devuelve { tipo: "bic_hit", bicHit, fuentes }
 *   para que PlanificacionPage muestre el banner de decisión al docente.
 *
 * Si no → genera con templates locales enriquecidos con contexto KE y devuelve
 *   { tipo: "generado", resultado, fuentes }
 *
 * @param {Object} payload - datosValidados de PlanificacionPage (el mismo objeto
 *   que antes se pasaba directamente a generarPlanificacion)
 *
 * @returns {Promise<PlanificacionInteligenteResult>}
 */
export async function generarPlanificacionInteligente(payload) {
  const {
    grado, area, asignatura, tema, competencia,
    indicadoresOficiales, tipoPlanificacion, nivelEducativo,
  } = payload;

  // Pasos 1-4: Consultar Knowledge Engine (paralelo con BIC en el siguiente bloque)
  const [ke, bicHit] = await Promise.all([
    orchestratorRun({
      action:     "generar_planificacion",
      agentId:    AGENT_IDS.PLANIFICADOR,
      topic:      tema,
      area,
      asignatura,
      grado,
      context:    payload,
    }),
    // Paso 5: BIC
    checkBIC("planes", {
      nivel: nivelEducativo,
      grado,
      area,
      asignatura,
      competencia,
      indicadores: indicadoresOficiales
        ? indicadoresOficiales.split("\n").filter(Boolean)
        : [],
      tema,
      tipo: tipoPlanificacion,
    }).catch(() => null),
  ]);

  const fuentes = {
    estiloUsado:       ke.estilosEncontrados,
    casoExitoUsado:    ke.casosExitoEncontrados,
    memoriaUsada:      ke.memoriasEncontradas,
    topicsUsados:      ke.topicsEncontrados,
    totalItemsKE:      ke.totalItemsKE,
    bicNivel:          null,
    iaExterna:         false,
    knowledgeContext:  ke.knowledgeContext,
  };

  // BIC tiene coincidencia → delegar decisión al docente (banner)
  if (bicHit) {
    fuentes.bicNivel = bicHit.nivel;
    _trackKEUsage(fuentes, { area, asignatura, grado, tema });
    return { tipo: "bic_hit", bicHit, fuentes };
  }

  // Pasos 6-7: templates locales con KE adjunto para acciones IA posteriores
  const resultado = await generarPlanificacion({
    ...payload,
    _knowledgeContext: ke.knowledgeContext,
  });

  _trackKEUsage(fuentes, { area, asignatura, grado, tema });

  return { tipo: "generado", resultado, fuentes };
}

// ── Internos ───────────────────────────────────────────────────────────────────

function _trackKEUsage(fuentes, { area, asignatura, grado, tema }) {
  if (fuentes.estiloUsado) {
    EventTracker.track(LEARNING_EVENTS.PLANTILLA_USADA, {
      agentId: AGENT_IDS.PLANIFICADOR,
      area, asignatura, grado, tema,
      metadata: { fuente: "ke_estilo" },
    });
  }

  if (fuentes.casoExitoUsado) {
    EventTracker.track(LEARNING_EVENTS.PLANTILLA_USADA, {
      agentId: AGENT_IDS.PLANIFICADOR,
      area, asignatura, grado, tema,
      metadata: { fuente: "ke_caso_exito" },
    });
  }
}

/**
 * @typedef {Object} PlanificacionInteligenteResult
 * @property {"bic_hit"|"generado"} tipo
 * @property {Object} [bicHit]   - Solo si tipo === "bic_hit": { nivel, mejor, score }
 * @property {Object} [resultado] - Solo si tipo === "generado": planificación completa
 * @property {FuentesPlan} fuentes
 */

/**
 * @typedef {Object} FuentesPlan
 * @property {boolean} estiloUsado      - KE encontró plantilla de estilo
 * @property {boolean} casoExitoUsado   - KE encontró caso de éxito
 * @property {boolean} memoriaUsada     - KE encontró memorias del agente
 * @property {boolean} topicsUsados     - KE encontró topics pedagógicos
 * @property {number}  totalItemsKE     - Total de ítems KE encontrados
 * @property {number|null} bicNivel     - Nivel BIC si hubo hit (1 o 2)
 * @property {boolean} iaExterna        - true si se llamó a IA externa
 * @property {string}  knowledgeContext - Contexto KE para usar en acciones posteriores
 */
