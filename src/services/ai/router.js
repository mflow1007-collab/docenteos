/**
 * Router del AI Gateway.
 *
 * Resuelve qué proveedor y configuración usar para cada módulo.
 * Si un módulo no tiene override, el servidor usará la prioridad global
 * definida en AIConfig.providerPriority.
 *
 * Para forzar un proveedor específico en un módulo:
 *   "auditoria-ia": { preferredProvider: "anthropic" }
 */

import { getModuleConfig } from "./AIConfig.js";

// Override de proveedor por módulo (null = usar prioridad global del servidor)
const MODULE_PROVIDER_OVERRIDES = {
  "auditoria-ia": null,
  "centro-ia":    null,
  planificacion:  null,
  instrumentos:   null,
  registro:       null,
  reportes:       null,
  curriculo:      null,
  chat:           null,
  auditoria:      null,
};

/**
 * Devuelve el proveedor preferido para un módulo (o null para usar el global).
 */
export function resolveProvider(module) {
  return MODULE_PROVIDER_OVERRIDES[module] ?? null;
}

/**
 * Devuelve la configuración completa de un módulo para el gateway.
 */
export function resolveModuleOptions(module) {
  const config = getModuleConfig(module);
  return {
    maxTokens: config.maxTokens,
    cache: config.cache,
    cacheTTLHours: config.cacheTTLHours,
    preferredProvider: resolveProvider(module),
  };
}
