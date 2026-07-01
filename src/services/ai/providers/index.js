/**
 * Registro de proveedores del AI Gateway.
 *
 * Para agregar un nuevo proveedor (ej. Gemini):
 *   1. Crea src/services/ai/providers/gemini.js con su metadata
 *   2. Agrégalo aquí como export
 *   3. Agrega su lógica de llamada en api/ai/generate.js
 *   4. Agrega GEMINI_API_KEY en Vercel Dashboard
 *   Nada más cambia en el resto del sistema.
 */

export { anthropic } from "./anthropic";
export { openai } from "./openai";
export { abacus } from "./abacus";
export { nvidia } from "./nvidia";

export const PROVIDER_META = {
  openai:    { displayName: "OpenAI",      model: "gpt-4o",                                  icon: "🟢" },
  abacus:    { displayName: "Abacus AI",   model: "route-llm",                               icon: "🔵" },
  anthropic: { displayName: "Anthropic",   model: "claude-sonnet-4-6",                       icon: "🟠" },
  nvidia:    { displayName: "NVIDIA NIM",  model: "nvidia/nemotron-3-ultra-550b-a55b",        icon: "🟩" },
};

/** Proveedores futuros — agregar aquí cuando se implementen en el servidor */
export const FUTURE_PROVIDERS = [
  "gemini",
  "mistral",
  "deepseek",
  "llama",
  "grok",
  "azure-openai",
  "ollama",
];
