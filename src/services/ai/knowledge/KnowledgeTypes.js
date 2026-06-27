/**
 * KnowledgeTypes — Constantes compartidas del Knowledge Engine.
 *
 * Todos los motores (Memory, Style, Learning) importan desde aquí.
 * Nunca hardcodear strings de tipo, estado o colección en los engines.
 */

// ── IDs de agentes ──────────────────────────────────────────────────────────────
export const AGENT_IDS = {
  AUDITOR:               "auditor-pedagogico",
  PLANIFICADOR:          "planificador",
  MEJORADOR_ACTIVIDADES: "mejorador-actividades",
  GENERADOR_INSTRUMENTOS:"generador-instrumentos",
  GENERADOR_REPORTES:    "generador-reportes",
  CHAT_DOCENTE:          "chat-docente",
};

// Mapeo acción ContextBuilder → agentId
export const ACTION_TO_AGENT = {
  generar_planificacion:  AGENT_IDS.PLANIFICADOR,
  mejorar_actividades:    AGENT_IDS.MEJORADOR_ACTIVIDADES,
  auditar_planificacion:  AGENT_IDS.AUDITOR,
  generar_instrumento:    AGENT_IDS.GENERADOR_INSTRUMENTOS,
  sugerir_apoyo:          AGENT_IDS.GENERADOR_REPORTES,
  chat_docente:           AGENT_IDS.CHAT_DOCENTE,
  replicar_con_estilo:    AGENT_IDS.PLANIFICADOR,
};

// ── Tipos de memoria ────────────────────────────────────────────────────────────
export const MEMORY_TYPES = {
  REGLA:          "regla",
  CRITERIO:       "criterio",
  EJEMPLO:        "ejemplo",
  PROHIBICION:    "prohibicion",
  PREFERENCIA:    "preferencia",
  PATRON:         "patron",         // patrón detectado por el Learning Engine
  RECOMENDACION:  "recomendacion",  // recomendación derivada de uso real
};

// ── Estados (memoria, estilo, insight, ejemplo) ─────────────────────────────────
export const STATES = {
  PENDING:  "pendiente",
  ACTIVE:   "activo",
  INACTIVE: "inactivo",
  ARCHIVED: "archivado",
  REJECTED: "rechazado",
};

// ── Fuentes de aprendizaje ──────────────────────────────────────────────────────
export const MEMORY_SOURCES = {
  CHAT:    "chat",
  ADMIN:   "admin",
  LEARNING:"aprendizaje",
  EXAMPLE: "ejemplo_aprobado",
};

// ── Visibilidad de plantillas de estilo ─────────────────────────────────────────
export const STYLE_VISIBILITY = {
  PRIVATE:        "privada",
  CENTER:         "centro",
  PENDING_REVIEW: "pendiente_revision",
  GLOBAL:         "global",
};

// ── Tipos de ejemplos ──────────────────────────────────────────────────────────
export const EXAMPLE_TYPES = {
  CASO_EXITO: "caso_exito",
  GENERAL:    "aprobado",
};

// ── Tipos de eventos del Learning Engine ────────────────────────────────────────
export const LEARNING_EVENTS = {
  PLANIFICACION_ACEPTADA:   "planificacion_aceptada",
  PLANIFICACION_REGENERADA: "planificacion_regenerada",
  ACTIVIDAD_MODIFICADA:     "actividad_modificada",
  AUDITORIA_APLICADA:       "auditoria_aplicada",
  MEJORA_ACEPTADA:          "mejora_aceptada",
  PLANTILLA_USADA:          "plantilla_usada",
  INSTRUMENTO_ACEPTADO:     "instrumento_aceptado",
  APOYO_GENERADO:           "apoyo_generado",
};

// ── Estados de insights ─────────────────────────────────────────────────────────
export const INSIGHT_STATES = {
  PENDING:  "pendiente",
  REVIEWED: "revisado",
  APPROVED: "aprobado",
  REJECTED: "rechazado",
};

// ── Nombres de colecciones Firestore ───────────────────────────────────────────
export const COLLECTIONS = {
  // BIC existente (sin cambios)
  BIC_PLANES:      "bic_planes",
  BIC_VERSIONES:   "bic_versiones",
  BIC_ACTIVIDADES: "bic_actividades",
  BIC_INSTRUMENTOS:"bic_instrumentos",
  BIC_AUDITORIAS:  "bic_auditorias",

  // Knowledge Engine — reglas, temas, estilos, ejemplos
  KE_AGENTES:  "ke_agentes",
  KE_MEMORIA:  "ke_memoria",    // subcolección de ke_agentes/{agentId}
  KE_VERSIONES:"ke_versiones",  // subcolección de ke_agentes/{agentId}
  KE_TOPICS:   "ke_topics",
  KE_ESTILOS:  "ke_estilos",
  KE_EJEMPLOS: "ke_ejemplos",

  // Learning Engine — eventos y sugerencias
  LE_EVENTOS:  "le_eventos",
  LE_INSIGHTS: "le_insights",
};

// ── Límites de inyección al prompt ─────────────────────────────────────────────
export const CONTEXT_LIMITS = {
  MAX_MEMORIES: 10,   // máximo de reglas/criterios inyectados
  MAX_TOPICS:   3,    // máximo de entradas de tema
  MAX_EXAMPLES: 2,    // máximo de ejemplos aprobados
};
