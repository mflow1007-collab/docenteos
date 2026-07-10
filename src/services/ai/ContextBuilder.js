/**
 * ContextBuilder — Constructor de contexto mínimo por acción.
 *
 * Objetivo: reducir consumo de tokens entre 50 % y 80 % enviando a la IA
 * únicamente los campos necesarios para cada tipo de acción.
 *
 * USO:
 *   import { buildAIContext } from "./ContextBuilder.js";
 *
 *   const ctx = await buildAIContext("mejorar_actividades", { grado, tema, actividades, ... });
 *   AIService.generate({ module: "planificacion-ia", ...ctx });
 *
 * ACCIONES DISPONIBLES:
 *   generar_planificacion  · mejorar_actividades  · auditar_planificacion
 *   generar_instrumento    · sugerir_apoyo        · chat_docente
 */

import { getAuth } from "firebase/auth";
import { resolveForAction } from "./knowledge/KnowledgeEngine.js";

// ─── Estimación de tokens ─────────────────────────────────────────────────────
// El español usa ~3.8 caracteres por token (vs ~4 en inglés).
// Esta función es una aproximación conservadora para el log.
const CHARS_PER_TOKEN = 3.8;

function estimateTokens(text) {
  return Math.ceil(String(text || "").length / CHARS_PER_TOKEN);
}

// ─── Utilidades de formateo ───────────────────────────────────────────────────

function trim(value, maxChars = 300) {
  const s = String(value || "").trim();
  return s.length > maxChars ? `${s.slice(0, maxChars)}…` : s;
}

function listStr(items, maxItems = 8, maxChars = 150) {
  if (!Array.isArray(items) || !items.length) return "—";
  return items
    .slice(0, maxItems)
    .map((item) => {
      const text = typeof item === "string" ? item : (item.descripcion || item.titulo || item.nombre || JSON.stringify(item));
      return `- ${trim(text, maxChars)}`;
    })
    .join("\n");
}

function field(label, value, maxChars = 200) {
  if (!value && value !== 0) return "";
  return `${label}: ${trim(String(value), maxChars)}`;
}

function compact(...lines) {
  return lines.filter(Boolean).join("\n");
}

// ─── System prompts reutilizables ─────────────────────────────────────────────

const SYSTEMS = {
  planificacion:
    "Eres DocenteOS, asistente pedagógico especializado en el Diseño Curricular Dominicano (MINERD). " +
    "Genera planificaciones precisas y contextualizadas para la República Dominicana. " +
    "Responde siempre en español. Sé concreto y práctico para docentes de aula.",

  auditoria:
    "Eres DocenteOS, experto auditor pedagógico del Diseño Curricular Dominicano (MINERD). " +
    "Analiza con rigor académico y proporciona retroalimentación constructiva y accionable. " +
    "Responde en español. No uses lenguaje vago — señala con precisión qué mejorar y por qué.",

  instrumentos:
    "Eres DocenteOS, experto en evaluación educativa del sistema dominicano (MINERD). " +
    "Diseñas instrumentos precisos, alineados al enfoque por competencias. " +
    "Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin markdown, sin explicaciones.",

  apoyo:
    "Eres DocenteOS, asistente pedagógico del sistema educativo dominicano (MINERD). " +
    "Genera planes de apoyo concretos, empáticos y accionables para docentes de aula dominicanos. " +
    "Prioriza intervenciones viables dentro del aula. Responde en español.",

  chat:
    "Eres DocenteOS, asistente pedagógico IA para docentes dominicanos. " +
    "Responde de forma concisa, práctica y siempre en español. " +
    "Conoces el Diseño Curricular Dominicano (MINERD) y el contexto educativo de la República Dominicana. " +
    "Si no tienes suficiente contexto, pregunta antes de asumir.",
};

// maxTokens recomendados por acción
const MAX_TOKENS = {
  generar_planificacion:  3000,
  mejorar_actividades:    1800,
  auditar_planificacion:  2000,
  generar_instrumento:    1200,
  sugerir_apoyo:          2000,
  chat_docente:           1000,
};

// ─── Constructores por acción ─────────────────────────────────────────────────

const BUILDERS = {

  // ── 1. generar_planificacion ────────────────────────────────────────────────
  // Solo lo que el motor necesita para crear la planificación desde cero.
  // NO incluye: historial, todos los indicadores del currículo, otras unidades.
  generar_planificacion(data) {
    const {
      grado, seccion, area, asignatura, tema,
      competencia, indicadores, tipo, duracion, periodo,
      diasClase, minutos, situacion, ejesTematicos, asignaturasVinculadas,
    } = data;

    const indicadoresTexto = Array.isArray(indicadores)
      ? indicadores.slice(0, 6).map((ind, i) => `${i + 1}. ${trim(typeof ind === "string" ? ind : (ind.descripcion || ind), 180)}`).join("\n")
      : trim(indicadores, 400);

    const ejesTexto = Array.isArray(ejesTematicos) && ejesTematicos.length
      ? `\nEjes temáticos: ${ejesTematicos.slice(0, 4).join(" · ")}`
      : "";

    const vinculadasTexto = asignaturasVinculadas
      ? `\nAsignaturas vinculadas: ${trim(asignaturasVinculadas, 100)}`
      : "";

    const prompt = compact(
      `Genera una planificación ${tipo || "semanal"} para:`,
      "",
      "CONTEXTO:",
      field("Grado/Sección", [grado, seccion].filter(Boolean).join(" ") || "—"),
      field("Área", area || asignatura || "—"),
      field("Tema", tema),
      field("Período", periodo),
      field("Duración", duracion),
      field("Días de clase", Array.isArray(diasClase) ? diasClase.join(", ") : diasClase || "Lun–Vie"),
      field("Minutos por clase", minutos || 45),
      ejesTexto,
      vinculadasTexto,
      "",
      "COMPETENCIA ESPECÍFICA:",
      trim(competencia, 250) || "—",
      "",
      "INDICADORES DE LOGRO (activos para esta planificación):",
      indicadoresTexto || "—",
      situacion ? `\nSITUACIÓN DE APRENDIZAJE:\n${trim(situacion, 300)}` : "",
      "",
      "Genera la planificación completa siguiendo el formato MINERD para República Dominicana.",
    );

    return { prompt, system: SYSTEMS.planificacion };
  },

  // ── 2. mejorar_actividades ──────────────────────────────────────────────────
  // Contexto mínimo: solo los campos de la sección a mejorar.
  // NO incluye: la planificación completa, otras semanas, otros momentos.
  mejorar_actividades(data) {
    const {
      grado,
      asignatura,
      tema,
      fase,
      semana,
      dia,
      momento,
      tiempo,
      intencionPedagogica,
      actividades,
      evidencias,
      evaluacion,
      recursos,
      metacognicion,
      sugerencia,
    } = data;

    const actividadesTexto = Array.isArray(actividades)
      ? actividades.map((a, i) => {
          const texto = typeof a === "string" ? a : (a.titulo || a.descripcion || a.nombre || "Actividad");
          const detalle = typeof a === "object" && a.descripcion && a.descripcion !== texto
            ? `: ${trim(a.descripcion, 100)}`
            : "";
          return `${i + 1}. ${trim(texto, 120)}${detalle}`;
        }).join("\n")
      : trim(actividades, 400) || "Sin actividades definidas";

    const evalTexto = evaluacion
      ? (typeof evaluacion === "string" ? evaluacion : (evaluacion.tipo || evaluacion.descripcion || JSON.stringify(evaluacion)))
      : null;

    const prompt = compact(
      "Mejora las siguientes actividades de aprendizaje:",
      "",
      "SESIÓN:",
      field("Grado", grado),
      field("Asignatura", asignatura),
      field("Tema", tema),
      field("Semana", semana !== undefined ? `Semana ${semana}` : null),
      field("Día", dia),
      field("Momento", momento ? `${momento}${tiempo ? ` (${tiempo})` : ""}` : null),
      field("Fase", fase),
      "",
      "INTENCIÓN PEDAGÓGICA:",
      trim(intencionPedagogica, 250) || "—",
      "",
      "ACTIVIDADES ACTUALES:",
      actividadesTexto,
      evidencias?.length    ? `\nEVIDENCIAS ESPERADAS:\n${listStr(evidencias, 5, 120)}`      : "",
      evalTexto             ? `\nEVALUACIÓN: ${trim(evalTexto, 150)}`                        : "",
      recursos?.length      ? `\nRECURSOS DISPONIBLES:\n${listStr(recursos, 6, 100)}`        : "",
      metacognicion         ? `\nMETACOGNICIÓN: ${trim(metacognicion, 150)}`                 : "",
      sugerencia            ? `\nSUGERENCIA DEL DOCENTE: ${trim(sugerencia, 200)}`           : "",
      "",
      `Mejora las actividades haciéndolas más dinámicas, contextualizadas para República Dominicana y alineadas con la intención pedagógica. Respeta el tiempo disponible${tiempo ? ` de ${tiempo}` : ""}.`,
    );

    return { prompt, system: SYSTEMS.planificacion };
  },

  // ── 3. auditar_planificacion ────────────────────────────────────────────────
  // Solo metadatos clave + actividades resumidas de cada semana.
  // NO incluye: evaluaciones detalladas, recursos, todos los campos JSON.
  auditar_planificacion(data) {
    const { grado, area, asignatura, tema, competencia, indicadores, semanas, tipo, periodo } = data;

    const indicadoresTexto = Array.isArray(indicadores)
      ? indicadores.slice(0, 4).map((ind) => trim(typeof ind === "string" ? ind : (ind.descripcion || ind), 130)).join(" · ")
      : trim(indicadores, 300);

    const semanasTexto = (Array.isArray(semanas) ? semanas : []).slice(0, 6).map((sem, i) => {
      const acts = (sem.actividades || []).slice(0, 3)
        .map((a) => `  · ${trim(typeof a === "string" ? a : (a.titulo || a.nombre || "Actividad"), 90)}`)
        .join("\n");
      const objetivo = sem.objetivo ? `  Objetivo: ${trim(sem.objetivo, 80)}\n` : "";
      return `Semana ${i + 1}:\n${objetivo}${acts || "  Sin actividades"}`;
    }).join("\n\n");

    const prompt = compact(
      `Audita pedagógicamente esta planificación ${tipo || ""} del sistema educativo dominicano (MINERD).`,
      "",
      "DATOS BÁSICOS:",
      field("Grado", grado),
      field("Área", area || asignatura),
      field("Tema", tema),
      field("Período", periodo),
      "",
      `COMPETENCIA: ${trim(competencia, 220) || "—"}`,
      indicadoresTexto ? `INDICADORES: ${indicadoresTexto}` : "",
      "",
      "DESARROLLO SEMANAL (actividades clave):",
      semanasTexto || "Sin semanas definidas",
      "",
      "Evalúa: coherencia curricular, diversidad metodológica, alineación competencia–indicadores–actividades, adecuación al nivel educativo, cumplimiento estándares MINERD. Sé específico y accionable.",
    );

    return { prompt, system: SYSTEMS.auditoria };
  },

  // ── 4. generar_instrumento ──────────────────────────────────────────────────
  // Solo tipo + tema + UNA competencia + UN indicador.
  // NO incluye: lista completa de indicadores, toda la planificación.
  generar_instrumento(data) {
    const { tipo = "Rúbrica", tema, area, grado, competencia, indicador } = data;

    const ctx = compact(
      field("Área", area),
      field("Grado", grado),
      field("Competencia", competencia, 200),
      field("Indicador", indicador, 150),
    );

    const SCHEMA_MAP = {
      "Rúbrica": `{"nombre":"...","descripcion":"...","criterios":[{"criterio":"...","nivel4":"Logro sobresaliente","nivel3":"Logro adecuado","nivel2":"Logro básico","nivel1":"En proceso"}]}\nIncluye 4 a 6 criterios específicos y observables.`,
      "Lista de cotejo": `{"nombre":"...","descripcion":"...","indicadores":[{"indicador":"Descripción observable"}]}\nIncluye 6 a 8 indicadores verificables.`,
      "Escala de estimación": `{"nombre":"...","descripcion":"...","indicadores":[{"indicador":"...","excelente":"Siempre","bueno":"Casi siempre","regular":"Ocasionalmente","necesitaApoyo":"Requiere guía"}]}\nIncluye 5 a 7 indicadores.`,
      "Registro anecdótico": `{"nombre":"...","descripcion":"...","criterios":[{"criterio":"Aspecto a observar","nivel4":"...","nivel3":"...","nivel2":"...","nivel1":"..."}]}\nIncluye 4 aspectos cualitativos clave.`,
      "Prueba escrita": `{"nombre":"...","descripcion":"Instrucciones generales","criterios":[{"criterio":"Ítem o pregunta","nivel4":"Respuesta completa (4 pts)","nivel3":"Adecuada (3 pts)","nivel2":"Parcial (2 pts)","nivel1":"Incompleta (1 pt)"}]}\nIncluye 5 a 8 ítems.`,
      "Autoevaluación": `{"nombre":"...","descripcion":"...","indicadores":[{"indicador":"¿Logré...? / ¿Pude...? / ¿Participé...?"}]}\nIncluye 6 a 8 preguntas reflexivas en primera persona.`,
      "Coevaluación": `{"nombre":"...","descripcion":"...","criterios":[{"criterio":"Aspecto a evaluar del compañero","nivel4":"Excelente","nivel3":"Muy bien","nivel2":"Bien","nivel1":"Necesita mejorar"}]}\nIncluye 4 a 6 criterios observables.`,
    };

    const schema = SCHEMA_MAP[tipo] || SCHEMA_MAP["Rúbrica"];

    const prompt = compact(
      `Genera un instrumento de tipo "${tipo}" para evaluar: "${trim(tema, 150)}"`,
      ctx ? `\n${ctx}` : "",
      "",
      `Responde ÚNICAMENTE con este JSON (sin texto extra, sin \`\`\`):`,
      schema,
    );

    return { prompt, system: SYSTEMS.instrumentos };
  },

  // ── 5. sugerir_apoyo ───────────────────────────────────────────────────────
  // Solo estudiantes en riesgo + estadísticas básicas del grupo.
  // NO incluye: estudiantes aprobados, datos de asistencia completos, notas por período.
  sugerir_apoyo(data) {
    const {
      area, grado, docente,
      estudiantesEnRiesgo = [],
      promedioGrupo, asistenciaGeneral,
      codigosCompetencias,
    } = data;

    const estudiantesTexto = estudiantesEnRiesgo.slice(0, 20).map((e) => {
      const partes = [`CF ${e.cf}`];
      if (e.competenciasDebiles?.length) partes.push(`Débil en: ${e.competenciasDebiles.join(", ")}`);
      if (e.asistencia) partes.push(`Asist: ${e.asistencia}%`);
      if (e.observacion) partes.push(trim(e.observacion, 60));
      return `- ${e.nombre}: ${partes.join(" | ")}`;
    }).join("\n");

    const prompt = compact(
      "Genera un diagnóstico pedagógico y plan de apoyo para los estudiantes en riesgo.",
      "",
      "CONTEXTO DEL CURSO:",
      field("Área", area),
      field("Grado", grado),
      field("Docente", docente),
      field("Promedio del grupo", promedioGrupo ? `${promedioGrupo}` : null),
      field("Asistencia general", asistenciaGeneral ? `${asistenciaGeneral}%` : null),
      codigosCompetencias?.length ? field("Competencias del área", codigosCompetencias.join(", "), 150) : "",
      "",
      `ESTUDIANTES EN RIESGO (CF < 70) — ${estudiantesEnRiesgo.length} estudiante(s):`,
      estudiantesTexto || "Sin datos de riesgo registrados.",
      "",
      "Genera el informe con EXACTAMENTE estas secciones (Markdown ##):",
      "## 1. Diagnóstico del grupo",
      "## 2. Estudiantes en riesgo",
      "## 3. Estrategias pedagógicas diferenciadas",
      "## 4. Actividades de recuperación",
      "## 5. Recomendaciones al docente",
      "## 6. Recomendaciones para familias",
      "## 7. Evidencias e instrumentos sugeridos",
    );

    return { prompt, system: SYSTEMS.apoyo };
  },

  // ── 6. chat_docente ─────────────────────────────────────────────────────────
  // Solo perfil mínimo del docente + últimos N mensajes + pregunta actual.
  // NO incluye: historial completo, todas las planificaciones, currículo.
  chat_docente(data) {
    const {
      pregunta,
      mensajes = [],
      perfilDocente,
      cursoActivo,
    } = data;

    const HISTORIAL_MAX = 6;

    const perfilTexto = compact(
      perfilDocente?.nombreDocente ? `Docente: ${perfilDocente.nombreDocente}` : "",
      perfilDocente?.centro ? `Centro: ${perfilDocente.centro}` : "",
      perfilDocente?.nivel ? `Nivel: ${perfilDocente.nivel}` : "",
    );

    const cursoTexto = cursoActivo
      ? compact(
          `Curso activo: ${cursoActivo.nombre || "—"}`,
          cursoActivo.area ? `Área: ${cursoActivo.area}` : "",
          cursoActivo.tema ? `Tema actual: ${trim(cursoActivo.tema, 80)}` : "",
        )
      : "";

    const historialTexto = mensajes
      .slice(-HISTORIAL_MAX)
      .map((m) => {
        const rol = m.rol === "user" ? "Docente" : "DocenteOS";
        return `${rol}: ${trim(m.contenido, 200)}`;
      })
      .join("\n");

    const prompt = compact(
      perfilTexto,
      cursoTexto,
      historialTexto ? `\nCONVERSACIÓN RECIENTE:\n${historialTexto}` : "",
      "",
      `Docente: ${trim(pregunta || "Hola", 500)}`,
    );

    return { prompt, system: SYSTEMS.chat };
  },
};

// ─── Logging ──────────────────────────────────────────────────────────────────

function buildLog({ action, uid, promptLength, systemLength, estimatedTokens, cacheHit }) {
  const log = {
    ts:              new Date().toISOString(),
    action,
    uid:             uid || "anonymous",
    promptChars:     promptLength,
    systemChars:     systemLength,
    totalChars:      promptLength + systemLength,
    estimatedTokens,
    cacheHit:        cacheHit ?? false,
  };

  if (import.meta.env.DEV) {
    console.group(`%c[DocenteOS AI] buildAIContext — ${action}`, "color:#7c3aed;font-weight:700");
    console.table({
      "Tokens estimados": estimatedTokens,
      "Prompt (chars)":   promptLength,
      "System (chars)":   systemLength,
      "Total (chars)":    promptLength + systemLength,
      "Usuario":          uid || "anonymous",
      "Cache":            cacheHit ? "✅ HIT" : "❌ MISS",
      "Acción":           action,
    });
    console.groupEnd();
  }

  return log;
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Construye el contexto mínimo necesario para la acción especificada.
 * Inyecta conocimiento activo del Knowledge Engine cuando hay memorias disponibles.
 *
 * @param {string} action  - Una de las 6 acciones disponibles
 * @param {Object} data    - Datos específicos de la acción
 * @returns {Promise<{
 *   prompt:            string,
 *   system:            string,
 *   estimatedTokens:   number,
 *   promptLength:      number,
 *   recommendedMaxTokens: number,
 *   action:            string,
 *   meta:              Object,
 * }>}
 */
export async function buildAIContext(action, data = {}) {
  const builder = BUILDERS[action];

  if (!builder) {
    const valid = Object.keys(BUILDERS).join(", ");
    throw new Error(`[ContextBuilder] Acción desconocida: "${action}". Válidas: ${valid}`);
  }

  // Resolución de conocimiento activo — no es fatal si falla
  let knowledgeContext = "";
  try {
    knowledgeContext = await resolveForAction(action, data);
  } catch {
    // KnowledgeEngine no disponible — continuar sin contexto
  }

  const { prompt: basePrompt, system } = builder(data);

  // Inyectar el contexto del Knowledge Engine justo antes de la instrucción final del builder
  const prompt = knowledgeContext
    ? basePrompt + `\n\nCONTEXTO DE CONOCIMIENTO ACTIVO:\n${knowledgeContext}\n`
    : basePrompt;

  const promptLength    = prompt.length;
  const systemLength    = (system || "").length;
  const estimatedTokens = estimateTokens(prompt + (system || ""));
  const uid             = data.uid || getAuth().currentUser?.uid || null;

  const meta = buildLog({
    action,
    uid,
    promptLength,
    systemLength,
    estimatedTokens,
    cacheHit: data._cacheHit ?? false,
  });

  return {
    prompt,
    system,
    estimatedTokens,
    promptLength,
    recommendedMaxTokens: MAX_TOKENS[action] ?? 2000,
    action,
    meta,
  };
}

/**
 * Retorna las acciones disponibles con su maxTokens recomendado.
 * Útil para validación y documentación.
 */
export const CONTEXT_ACTIONS = Object.fromEntries(
  Object.keys(BUILDERS).map((action) => [action, { maxTokens: MAX_TOKENS[action] }])
);
