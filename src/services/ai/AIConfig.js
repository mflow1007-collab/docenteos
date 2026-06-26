/**
 * Configuración central del AI Gateway de DocenteOS.
 *
 * Para cambiar el proveedor por defecto: cambia `providerPriority[0]`.
 * Para agregar un nuevo proveedor: agrégalo a `providerPriority` y crea
 * su archivo en providers/. No hay que tocar nada más.
 */

export const AIConfig = {
  // Orden de prioridad de proveedores. El primero disponible (con API key) gana.
  // Para cambiar el default: mueve el nombre deseado a la primera posición.
  providerPriority: ["openai", "abacus", "anthropic"],

  // Configuración por módulo
  modules: {
    "auditoria-ia": {
      maxTokens: 8000,
      cache: true,
      cacheTTLHours: 168, // 7 días — la unidad no cambia seguido
    },
    "centro-ia": {
      maxTokens: 4096,
      cache: false, // prompts del usuario — no cachear
    },
    planificacion: {
      maxTokens: 4096,
      cache: true,
      cacheTTLHours: 24,
    },
    instrumentos: {
      maxTokens: 4096,
      cache: true,
      cacheTTLHours: 24,
    },
    registro: {
      maxTokens: 2048,
      cache: false,
    },
    reportes: {
      maxTokens: 4096,
      cache: true,
      cacheTTLHours: 12,
    },
    curriculo: {
      maxTokens: 4096,
      cache: true,
      cacheTTLHours: 720, // 30 días — currículo muy estable
    },
    chat: {
      maxTokens: 2048,
      cache: false,
    },
    auditoria: {
      maxTokens: 4096,
      cache: false,
    },
  },

  // Valores por defecto para módulos no listados
  defaults: {
    maxTokens: 4096,
    cache: false,
    cacheTTLHours: 24,
  },

  logging: true, // guardar en aiLogs/
};

/** Devuelve la configuración efectiva de un módulo (con defaults aplicados). */
export function getModuleConfig(module) {
  return { ...AIConfig.defaults, ...(AIConfig.modules[module] || {}) };
}
