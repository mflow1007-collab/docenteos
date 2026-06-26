/**
 * AI Gateway — Vercel Edge Runtime
 *
 * Punto único de salida hacia todos los proveedores de IA.
 * Las API keys NUNCA llegan al browser: solo existen aquí como
 * variables de entorno del servidor (Vercel Dashboard).
 *
 * Variables requeridas (al menos una):
 *   ANTHROPIC_API_KEY
 *   OPENAI_API_KEY
 *   ABACUS_API_KEY
 */

export const config = { runtime: "edge" };

// ─── Modelos por proveedor ─────────────────────────────────────────────────────

const PROVIDER_MODELS = {
  openai: "gpt-4o",
  abacus: "route-llm",
  anthropic: "claude-sonnet-4-6",
};

const PROVIDER_BASE_URLS = {
  openai: "https://api.openai.com/v1",
  abacus: "https://routellm.abacus.ai/v1",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getApiKey(provider) {
  switch (provider) {
    case "openai":    return process.env.OPENAI_API_KEY    || null;
    case "anthropic": return process.env.ANTHROPIC_API_KEY || null;
    case "abacus":    return process.env.ABACUS_API_KEY    || null;
    default:          return null;
  }
}

/** Devuelve proveedores disponibles en orden de prioridad: openai → abacus → anthropic */
function getAvailableProviders(preferred) {
  const order = ["openai", "abacus", "anthropic"];
  const available = order.filter((p) => getApiKey(p));

  // Si el caller pide un proveedor específico y está disponible, va primero
  if (preferred && available.includes(preferred)) {
    return [preferred, ...available.filter((p) => p !== preferred)];
  }
  return available;
}

// ─── Llamadas a proveedores ────────────────────────────────────────────────────

async function callAnthropic(apiKey, { system, prompt, maxTokens, model }) {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: model || PROVIDER_MODELS.anthropic,
      max_tokens: maxTokens || 4096,
      stream: true,
      system: system || "",
      messages: [{ role: "user", content: prompt }],
    }),
  });
}

async function callOpenAICompatible(apiKey, baseURL, { system, prompt, maxTokens, model }) {
  return fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens || 4096,
      stream: true,
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: prompt },
      ],
    }),
  });
}

// ─── Normalización del stream ──────────────────────────────────────────────────
// Convierte el formato SSE de cada proveedor en un formato unificado:
//   data: {"text":"chunk"}\n\n
//   data: {"meta":{"provider":"...","model":"..."}}\n\n
//   data: [DONE]\n\n

function buildNormalizedStream(providerResponse, provider, model) {
  const reader = providerResponse.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      const send = (payload) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

      try {
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (raw === "[DONE]") continue;

            try {
              const parsed = JSON.parse(raw);
              let text = null;

              if (provider === "anthropic") {
                // Anthropic SSE: content_block_delta → delta.text
                if (
                  parsed.type === "content_block_delta" &&
                  parsed.delta?.type === "text_delta"
                ) {
                  text = parsed.delta.text;
                }
              } else {
                // OpenAI-compatible (openai, abacus)
                text = parsed.choices?.[0]?.delta?.content ?? null;
              }

              if (text) send({ text });
            } catch {
              // línea SSE no parseable — ignorar
            }
          }
        }

        send({ meta: { provider, model } });
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        send({ error: err.message });
        controller.close();
      }
    },
  });
}

// ─── Handler principal ────────────────────────────────────────────────────────

export default async function handler(request) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const {
    module: mod = "general",
    prompt,
    system,
    maxTokens = 4096,
    preferredProvider,
  } = body;

  if (!prompt) {
    return new Response(JSON.stringify({ error: "prompt es requerido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const providers = getAvailableProviders(preferredProvider);

  if (providers.length === 0) {
    console.error("[AI Gateway] No hay proveedores de IA configurados (OPENAI_API_KEY / ABACUS_API_KEY / ANTHROPIC_API_KEY)");
    return new Response(
      JSON.stringify({
        error: "No hay ningún servicio de Inteligencia Artificial disponible en este momento. Verifica la configuración del administrador o intenta nuevamente más tarde.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  let lastError = null;

  for (const provider of providers) {
    const apiKey = getApiKey(provider);
    const model = PROVIDER_MODELS[provider];

    try {
      let providerResponse;

      if (provider === "anthropic") {
        providerResponse = await callAnthropic(apiKey, { system, prompt, maxTokens, model });
      } else {
        const baseURL = PROVIDER_BASE_URLS[provider];
        providerResponse = await callOpenAICompatible(apiKey, baseURL, {
          system, prompt, maxTokens, model,
        });
      }

      if (!providerResponse.ok) {
        const errText = await providerResponse.text();
        lastError = `${provider} HTTP ${providerResponse.status}: ${errText.slice(0, 300)}`;
        console.error(`[AI Gateway] ${lastError}`);
        continue; // intentar siguiente proveedor
      }

      const stream = buildNormalizedStream(providerResponse, provider, model);

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "X-AI-Provider": provider,
          "X-AI-Model": model,
          "X-AI-Module": mod,
        },
      });
    } catch (err) {
      lastError = `${provider}: ${err.message}`;
      console.error(`[AI Gateway] Proveedor ${provider} falló:`, err);
      continue;
    }
  }

  // Todos los proveedores fallaron — solo log interno, mensaje amigable al usuario
  console.error(`[AI Gateway] Todos los proveedores fallaron. Último error: ${lastError}`);
  return new Response(
    JSON.stringify({
      error: "No hay ningún servicio de Inteligencia Artificial disponible en este momento. Verifica la configuración del administrador o intenta nuevamente más tarde.",
    }),
    { status: 503, headers: { "Content-Type": "application/json" } }
  );
}
