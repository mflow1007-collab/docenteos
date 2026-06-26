/**
 * AgenteAuditor — Control de calidad pedagógica y alineación curricular.
 *
 * Responsabilidades:
 *   - Auditar planificaciones completas contra el currículo MINERD
 *   - Generar un score de calidad 0-100 con desglose por dimensión
 *   - Identificar brechas pedagógicas (sin cierre, sin evaluación, sin metacognición)
 *   - Validar coherencia interna (competencia ↔ actividades ↔ evaluación)
 *   - Guardar resultados de auditoría en el BIC para análisis posterior
 */

import { AIService } from "../AIService.js";

const SYSTEM = `Eres el Agente Auditor de DocenteOS. Evalúas la calidad pedagógica de planificaciones didácticas según:

DIMENSIONES (cada una de 0-20 puntos):
1. Alineación curricular — competencias e indicadores corresponden al MINERD para ese grado/área
2. Coherencia interna — las actividades desarrollan la competencia; la evaluación mide los indicadores
3. Calidad pedagógica — variedad de estrategias, actividades activas, diferenciación
4. Completitud — todos los momentos presentes (inicio/desarrollo/cierre), recursos y tiempos definidos
5. Contextualización — adaptada a la realidad dominicana, recursos accesibles, lenguaje apropiado

Score total = suma de las 5 dimensiones (0-100).`;

const DIM_LABELS = [
  "Alineación curricular",
  "Coherencia interna",
  "Calidad pedagógica",
  "Completitud",
  "Contextualización",
];

/**
 * Audita una planificación completa. Retorna análisis vía streaming.
 *
 * @param {Object} planificacion - Objeto completo de la planificación
 * @param {{ onChunk, onFinish, onError }} callbacks
 */
export async function auditarPlanificacion(planificacion, { onChunk, onFinish, onError }) {
  const resumen = _resumirPlan(planificacion);

  await AIService.generate({
    module: "auditoria",
    system: SYSTEM,
    prompt: `Audita la siguiente planificación didáctica dominicana.

${resumen}

Presenta tu auditoría organizada así:

## Puntuación por dimensión
| Dimensión | Puntos (0-20) | Observación |
|---|---|---|
(tabla con las 5 dimensiones)

## Score total: XX/100

## Fortalezas
- (2-3 aspectos positivos concretos)

## Áreas de mejora críticas
- (issues que bajan el score significativamente, con solución)

## Recomendaciones pedagógicas
- (sugerencias concretas y accionables)

## Alineación MINERD
(¿competencias e indicadores corresponden al grado y área declarados?)`,
    maxTokens: 1600,
    onChunk, onFinish, onError,
  });
}

/**
 * Calcula un score numérico de calidad sin texto largo (para indexación rápida).
 * @param {Object} planificacion
 * @returns {Promise<{ score: number, dimensiones: Object, resumen: string }>}
 */
export async function calcularScore(planificacion) {
  return new Promise(resolve => {
    let acumulado = "";
    const resumen = _resumirPlan(planificacion);

    AIService.generate({
      module: "auditoria",
      system: SYSTEM,
      prompt: `Evalúa rápidamente esta planificación y responde en JSON:

${resumen}

JSON:
{
  "score": 0-100,
  "dimensiones": {
    "alineacion_curricular": 0-20,
    "coherencia_interna": 0-20,
    "calidad_pedagogica": 0-20,
    "completitud": 0-20,
    "contextualizacion": 0-20
  },
  "resumen": "una oración sobre el aspecto más crítico a mejorar"
}

Solo el JSON, sin texto adicional.`,
      maxTokens: 300,
      onChunk: t => { acumulado += t; },
      onFinish: () => {
        try {
          const json = acumulado.match(/\{[\s\S]*\}/)?.[0];
          const parsed = json ? JSON.parse(json) : null;
          resolve(parsed ?? { score: 70, dimensiones: {}, resumen: "" });
        } catch {
          resolve({ score: 70, dimensiones: {}, resumen: "" });
        }
      },
      onError: () => resolve({ score: 70, dimensiones: {}, resumen: "" }),
    });
  });
}

/**
 * Genera sugerencias de mejora en formato streaming para el botón "Mejorar" de PlanificacionPage.
 */
export async function sugerirMejoras(planificacion, { onChunk, onFinish, onError }) {
  const resumen = _resumirPlan(planificacion);

  await AIService.generate({
    module: "auditoria",
    system: SYSTEM,
    prompt: `Analiza esta planificación y ofrece sugerencias pedagógicas concretas para mejorarla.

${resumen}

Organiza tu respuesta en:

## Mejoras de alto impacto
(cambios que elevarían significativamente la calidad)

## Actividades sugeridas
(2-3 actividades nuevas que complementarían bien la unidad)

## Recursos adicionales recomendados
(materiales accesibles en escuelas dominicanas)

## Estrategias de diferenciación
(para estudiantes avanzados y con dificultades)`,
    maxTokens: 1400,
    onChunk, onFinish, onError,
  });
}

/**
 * Alinea una planificación al currículo MINERD si hay desajustes.
 */
export async function alinearAlCurriculo(planificacion, { onChunk, onFinish, onError }) {
  const resumen = _resumirPlan(planificacion);

  await AIService.generate({
    module: "auditoria",
    system: SYSTEM,
    prompt: `Revisa esta planificación y corrige cualquier desalineación con el currículo MINERD.

${resumen}

Analiza y corrige:
1. ¿Las competencias e indicadores son correctos para ${planificacion.grado ?? "el grado"} en ${planificacion.area ?? "el área"}?
2. ¿Las actividades desarrollan efectivamente las competencias declaradas?
3. ¿Los instrumentos de evaluación miden los indicadores correctos?

Para cada problema encontrado, da la corrección específica con la fuente curricular.

Si todo está correcto, confirma la alineación y sugiere un enriquecimiento menor.`,
    maxTokens: 1200,
    onChunk, onFinish, onError,
  });
}

// ── Privadas ────────────────────────────────────────────────────────────────────

function _resumirPlan(plan) {
  if (!plan) return "(plan vacío)";

  const semanas = Array.isArray(plan.semanas) ? plan.semanas : [];
  const semanasResumen = semanas.slice(0, 4).map((s, i) => {
    const acts = (s.actividades ?? s.dias ?? [])
      .slice(0, 3)
      .map(a => String(a?.actividad ?? a?.descripcion ?? a ?? "").slice(0, 70))
      .join("; ");
    return `Semana ${i + 1}: ${acts}`;
  }).join("\n");

  return `Grado: ${plan.grado ?? "—"} | Área: ${plan.area ?? "—"} | Tema: ${plan.tema ?? "—"}
Competencia: ${String(plan.competencia ?? "—").slice(0, 150)}
Indicadores: ${Array.isArray(plan.indicadores) ? plan.indicadores.slice(0, 3).join("; ") : String(plan.indicadores ?? "—").slice(0, 150)}
Semanas: ${semanas.length}
${semanasResumen}
Recursos: ${String(plan.recursos ?? "—").slice(0, 100)}
Evaluación: ${String(plan.evaluacion ?? "—").slice(0, 100)}`;
}
