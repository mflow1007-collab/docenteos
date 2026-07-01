/**
 * AI Gateway — Status de proveedores
 * GET /api/ai/status
 *
 * Devuelve qué proveedores tienen API key configurada (solo verifica env vars,
 * no hace llamadas reales). Para probar la conexión real usa /api/ai/test.
 */

export const config = { runtime: "edge" };

const PROVIDERS = [
  { id: "openai",    displayName: "OpenAI",      model: "gpt-4o",                                  envVar: "OPENAI_API_KEY"    },
  { id: "abacus",    displayName: "Abacus AI",   model: "route-llm",                               envVar: "ABACUS_API_KEY"    },
  { id: "anthropic", displayName: "Anthropic",   model: "claude-sonnet-4-6",                       envVar: "ANTHROPIC_API_KEY" },
  { id: "nvidia",    displayName: "NVIDIA NIM",  model: "nvidia/llama-3.1-nemotron-70b-instruct",  envVar: "NVIDIA_API_KEY"    },
];

const PRIORITY_ORDER = ["openai", "abacus", "anthropic", "nvidia"];

export default function handler() {
  const providers = {};

  for (const p of PROVIDERS) {
    const key = process.env[p.envVar];
    providers[p.id] = {
      configured: !!(key && key.length > 10),
      displayName: p.displayName,
      model: p.model,
      priority: PRIORITY_ORDER.indexOf(p.id) + 1,
    };
  }

  const primaryProvider = PRIORITY_ORDER.find((id) => providers[id]?.configured) || null;

  return new Response(
    JSON.stringify({ providers, primaryProvider, order: PRIORITY_ORDER }),
    { headers: { "Content-Type": "application/json" } }
  );
}
