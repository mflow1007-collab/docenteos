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
 *
 * Body acepta:
 *   module           string
 *   prompt           string  (requerido)
 *   system           string
 *   maxTokens        number
 *   preferredProvider string  — mueve este proveedor al frente si está disponible
 *   providerOrder    string[] — orden completo enviado desde Firestore (sobrescribe default)
 *   modelOverrides   object  — { openai: "gpt-4o-mini", anthropic: "claude-opus-4-8" }
 */

export const config = { runtime: "edge" };
console.log("=== VARIABLES ===");
console.log("OPENAI:", !!process.env.OPENAI_API_KEY);
console.log("ABACUS:", !!process.env.ABACUS_API_KEY);
console.log("ANTHROPIC:", !!process.env.ANTHROPIC_API_KEY);
console.log("=================");

// ─── Configuración por defecto ────────────────────────────────────────────────

const DEFAULT_ORDER = ["openai", "abacus", "anthropic"];

const DEFAULT_MODELS = {
  openai:    "gpt-4o",
  abacus:    "route-llm",
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

function getModel(provider, modelOverrides) {
  return (modelOverrides?.[provider]) || DEFAULT_MODELS[provider] || provider;
}

/**
 * Construye la lista de proveedores a intentar, en orden.
 *
 * Prioridad de resolución:
 *   1. Si llega `providerOrder` (desde Firestore admin), úsalo filtrado a los
 *      que tienen API key. Añade fallbacks de DEFAULT_ORDER al final.
 *   2. Si llega `preferredProvider`, muévelo al frente del DEFAULT_ORDER.
 *   3. Si no llega nada, usa DEFAULT_ORDER.
 */
function getProviderQueue(preferredProvider, providerOrder) {
  let queue;

  if (providerOrder && Array.isArray(providerOrder) && providerOrder.length > 0) {
    // Usar el orden de Firestore, filtrando solo los que tienen key
    const ordered = providerOrder.filter((p) => getApiKey(p));
    // Añadir cualquier proveedor de DEFAULT_ORDER que no esté en el order del admin
    const extras  = DEFAULT_ORDER.filter((p) => !providerOrder.includes(p) && getApiKey(p));
    queue = [...ordered, ...extras];
  } else {
    queue = DEFAULT_ORDER.filter((p) => getApiKey(p));
    if (preferredProvider && queue.includes(preferredProvider)) {
      queue = [preferredProvider, ...queue.filter((p) => p !== preferredProvider)];
    }
  }

  return queue;
}

// ─── Llamadas a proveedores ────────────────────────────────────────────────────

async function callAnthropic(apiKey, { system, prompt, maxTokens, model, imageBase64, imageMediaType }) {
  const userContent = imageBase64
    ? [
        { type: "image", source: { type: "base64", media_type: imageMediaType || "image/jpeg", data: imageBase64 } },
        { type: "text", text: prompt },
      ]
    : prompt;

  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: model || DEFAULT_MODELS.anthropic,
      max_tokens: maxTokens || 4096,
      stream: true,
      system: system || "",
      messages: [{ role: "user", content: userContent }],
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
// Formato unificado:
//   data: {"text":"chunk"}\n\n
//   data: {"meta":{"provider":"...","model":"..."}}\n\n
//   data: [DONE]\n\n

function buildNormalizedStream(providerResponse, provider, model) {
  const reader  = providerResponse.body.getReader();
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
                if (
                  parsed.type === "content_block_delta" &&
                  parsed.delta?.type === "text_delta"
                ) {
                  text = parsed.delta.text;
                }
              } else {
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
    module: mod        = "general",
    prompt,
    system,
    maxTokens          = 4096,
    preferredProvider,
    providerOrder,     // string[] desde Firestore vía AIService
    modelOverrides,    // { openai: "gpt-4.1", ... } desde Firestore vía AIService
    imageBase64,       // base64 image for vision (Anthropic only)
    imageMediaType,    // e.g. "image/jpeg"
  } = body;

  if (!prompt) {
    return new Response(JSON.stringify({ error: "prompt es requerido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const queue = getProviderQueue(preferredProvider, providerOrder);

  if (queue.length === 0) {
    console.error("[AI Gateway] No hay proveedores configurados (OPENAI_API_KEY / ABACUS_API_KEY / ANTHROPIC_API_KEY)");
    return new Response(
      JSON.stringify({
        error: "No hay ningún servicio de Inteligencia Artificial disponible en este momento. Verifica la configuración del administrador o intenta nuevamente más tarde.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  let lastError = null;

  for (const provider of queue) {
    const apiKey = getApiKey(provider);
    const model  = getModel(provider, modelOverrides);

    try {
      let providerResponse;

      if (provider === "anthropic") {
        providerResponse = await callAnthropic(apiKey, { system, prompt, maxTokens, model, imageBase64, imageMediaType });
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
          "Connection":    "keep-alive",
          "X-AI-Provider": provider,
          "X-AI-Model":    model,
          "X-AI-Module":   mod,
        },
      });
    } catch (err) {
      lastError = `${provider}: ${err.message}`;
      console.error(`[AI Gateway] Proveedor ${provider} falló:`, err);
      continue;
    }
  }

  console.error(`[AI Gateway] Todos los proveedores fallaron. Último error: ${lastError}`);
  return new Response(
    JSON.stringify({
      error: "No hay ningún servicio de Inteligencia Artificial disponible en este momento. Verifica la configuración del administrador o intenta nuevamente más tarde.",
    }),
    { status: 503, headers: { "Content-Type": "application/json" } }
  );
}
