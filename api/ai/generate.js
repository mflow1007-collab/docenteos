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
 *   NVIDIA_API_KEY
 *
 * Variables de autenticación:
 *   FIREBASE_PROJECT_ID  — ID del proyecto Firebase (requerido para verificar tokens)
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

// ─── Verificación de Firebase ID Token ───────────────────────────────────────
// Implementada con Web Crypto API (disponible en Edge Runtime).
// Firebase publica sus claves públicas en formato JWK, lo que permite importarlas
// directamente sin parsear certificados X.509.

let _jwkCache = null;
let _jwkCacheTime = 0;
const JWK_CACHE_MS = 6 * 60 * 60 * 1000; // 6 horas

async function getFirebasePublicKeys() {
  const now = Date.now();
  if (_jwkCache && now - _jwkCacheTime < JWK_CACHE_MS) return _jwkCache;

  const res = await fetch(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
  );
  const { keys } = await res.json();

  const keyMap = {};
  for (const key of keys) {
    keyMap[key.kid] = await crypto.subtle.importKey(
      "jwk",
      key,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
  }

  _jwkCache = keyMap;
  _jwkCacheTime = now;
  return keyMap;
}

function b64urlToBytes(str) {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

/**
 * Verifica un Firebase ID Token.
 * @returns {{ uid: string, email: string } | null}
 */
async function verifyFirebaseToken(token) {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    if (!projectId) return null;

    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const decoder = new TextDecoder();
    const header  = JSON.parse(decoder.decode(b64urlToBytes(parts[0])));
    const payload = JSON.parse(decoder.decode(b64urlToBytes(parts[1])));

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;
    if (payload.iat > now + 300) return null;
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null;
    if (payload.aud !== projectId) return null;
    if (!payload.sub) return null;

    const keys = await getFirebasePublicKeys();
    const key  = keys[header.kid];
    if (!key) return null;

    const signingInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const signature    = b64urlToBytes(parts[2]);

    const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, signingInput);
    if (!valid) return null;

    return { uid: payload.sub, email: payload.email || "" };
  } catch {
    return null;
  }
}

// ─── Configuración por defecto ────────────────────────────────────────────────

const DEFAULT_ORDER = ["openai", "abacus", "anthropic", "nvidia"];

const DEFAULT_MODELS = {
  openai:    "gpt-4o",
  abacus:    "route-llm",
  anthropic: "claude-sonnet-4-6",
  nvidia:    "nvidia/nemotron-3-ultra-550b-a55b",
};

const PROVIDER_BASE_URLS = {
  openai:  "https://api.openai.com/v1",
  abacus:  "https://routellm.abacus.ai/v1",
  nvidia:  "https://integrate.api.nvidia.com/v1",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getApiKey(provider) {
  switch (provider) {
    case "openai":    return process.env.OPENAI_API_KEY    || null;
    case "anthropic": return process.env.ANTHROPIC_API_KEY || null;
    case "abacus":    return process.env.ABACUS_API_KEY    || null;
    case "nvidia":    return process.env.NVIDIA_API_KEY    || null;
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

  // ─── Autenticación ────────────────────────────────────────────────────────
  const authHeader = request.headers.get("Authorization");
  const idToken    = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!idToken) {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const authedUser = await verifyFirebaseToken(idToken);
  if (!authedUser) {
    return new Response(JSON.stringify({ error: "Token inválido o expirado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
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
    console.error("[AI Gateway] No hay proveedores configurados (OPENAI_API_KEY / ABACUS_API_KEY / ANTHROPIC_API_KEY / NVIDIA_API_KEY)");
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
