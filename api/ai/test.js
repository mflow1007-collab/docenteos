/**
 * AI Gateway — Prueba de conexión por proveedor
 * POST /api/ai/test  { provider: "openai" | "abacus" | "anthropic", model?: string }
 *
 * Hace una llamada mínima (max_tokens=5) para verificar que la API key
 * funciona correctamente. Nunca expone errores técnicos al usuario.
 */

export const config = { runtime: "edge" };

const PROVIDER_CONFIG = {
  openai: {
    model: "gpt-4o",
    baseURL: "https://api.openai.com/v1",
    type: "openai",
    envVar: "OPENAI_API_KEY",
  },
  abacus: {
    model: "gpt-4o-mini",
    baseURL: process.env.ABACUS_BASE_URL || "https://routellm.abacus.ai/v1",
    type: "openai",
    envVar: "ABACUS_API_KEY",
  },
  anthropic: {
    model: "claude-sonnet-4-6",
    type: "anthropic",
    envVar: "ANTHROPIC_API_KEY",
  },
  nvidia: {
    model: "nvidia/nemotron-3-ultra-550b-a55b",
    baseURL: "https://integrate.api.nvidia.com/v1",
    type: "openai",
    envVar: "NVIDIA_API_KEY",
  },
  gemini: {
    model: "gemini-2.5-flash",
    // Endpoint OpenAI-compatible oficial de Google AI Studio
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    type: "openai",
    envVar: "GEMINI_API_KEY",
    envVarAlt: "GOOGLE_API_KEY",
  },
};

/** Convierte errores técnicos en mensajes amigables para el administrador */
function sanitizeError(status, rawMessage = "") {
  if (!status)                          return "Tiempo de espera agotado";
  if (status === 401 || status === 403) return "API Key inválida o sin permisos";
  if (status === 429)                   return "Límite de llamadas excedido";
  if (status === 404)                   return "Modelo no encontrado";
  if (status >= 500)                    return "Error del servidor del proveedor";
  if (rawMessage.toLowerCase().includes("model")) return "Modelo no disponible";
  return `Error de conexión (${status})`;
}

function safeDetail(rawMessage = "") {
  return String(rawMessage || "")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [oculto]")
    .replace(/sk-[A-Za-z0-9_-]+/gi, "sk-[oculto]")
    .slice(0, 220);
}

function modelsToTry(provider, selectedModel, defaultModel) {
  const base = [selectedModel, defaultModel].filter(Boolean);
  if (provider === "abacus") {
    base.push("gpt-4o-mini", "gpt-4o");
  }
  return [...new Set(base)];
}

export default async function handler(request) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let provider;
  let requestedModel;
  try {
    ({ provider, model: requestedModel } = await request.json());
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Parámetro inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const cfg = PROVIDER_CONFIG[provider];
  if (!cfg) {
    return new Response(JSON.stringify({ ok: false, error: "Proveedor desconocido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env[cfg.envVar] || (cfg.envVarAlt ? process.env[cfg.envVarAlt] : undefined);
  if (!apiKey || apiKey.length <= 10) {
    return new Response(
      JSON.stringify({ ok: false, provider, model: cfg.model, responseTime: 0, error: "No configurado" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const start = Date.now();
  const candidates = modelsToTry(provider, requestedModel, cfg.model);
  let lastFailure = null;

  for (const model of candidates) {
    try {
    let response;

    if (cfg.type === "anthropic") {
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 5,
          messages: [{ role: "user", content: "Responde solo: OK" }],
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } else {
      response = await fetch(`${cfg.baseURL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: 5,
          messages: [{ role: "user", content: "Responde solo: OK" }],
        }),
        signal: AbortSignal.timeout(15_000),
      });
    }

    const responseTime = Date.now() - start;

    if (response.ok) {
      return new Response(
        JSON.stringify({ ok: true, provider, model, responseTime, error: null }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const errText = await response.text().catch(() => "");
    lastFailure = {
      status: response.status,
      model,
      raw: errText,
      message: sanitizeError(response.status, errText),
    };
    console.error(`[AI Test] ${provider}/${model} HTTP ${response.status}: ${errText.slice(0, 200)}`);

  } catch (err) {
    console.error(`[AI Test] ${provider}/${model} error:`, err.message);
    const isTimeout = err.name === "TimeoutError" || err.name === "AbortError";
    lastFailure = {
      status: null,
      model,
      raw: err.message,
      message: isTimeout ? "Tiempo de espera agotado" : "Error de conexión",
    };
  }
  }

  return new Response(
    JSON.stringify({
      ok: false,
      provider,
      model: lastFailure?.model || requestedModel || cfg.model,
      responseTime: 0,
      error: lastFailure?.message || "Error de conexión",
      detail: safeDetail(lastFailure?.raw),
      triedModels: candidates,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}
