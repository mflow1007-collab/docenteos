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
 *   GEMINI_API_KEY   (Google AI Studio — endpoint OpenAI-compatible)
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
 *   strictProvider   boolean — si true, no agrega fallbacks fuera del providerOrder
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
    if (!projectId) {
      console.error("[Auth] FIREBASE_PROJECT_ID no está configurado en las variables de entorno del servidor");
      return null;
    }

    const parts = token.split(".");
    if (parts.length !== 3) {
      console.error("[Auth] Token JWT malformado — no tiene 3 partes");
      return null;
    }

    const decoder = new TextDecoder();
    const header  = JSON.parse(decoder.decode(b64urlToBytes(parts[0])));
    const payload = JSON.parse(decoder.decode(b64urlToBytes(parts[1])));

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      console.error("[Auth] Token expirado — exp:", payload.exp, "now:", now);
      return null;
    }
    if (payload.iat > now + 300) {
      console.error("[Auth] Token iat en el futuro — iat:", payload.iat, "now:", now);
      return null;
    }
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
      console.error("[Auth] iss no coincide — iss del token:", payload.iss, "| esperado:", `https://securetoken.google.com/${projectId}`);
      return null;
    }
    if (payload.aud !== projectId) {
      console.error("[Auth] aud no coincide — aud del token:", payload.aud, "| esperado:", projectId);
      return null;
    }
    if (!payload.sub) {
      console.error("[Auth] Token sin sub (uid)");
      return null;
    }

    const keys = await getFirebasePublicKeys();
    const key  = keys[header.kid];
    if (!key) {
      console.error("[Auth] kid del token no encontrado en JWK — kid:", header.kid, "| kids disponibles:", Object.keys(keys));
      return null;
    }

    const signingInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const signature    = b64urlToBytes(parts[2]);

    const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, signingInput);
    if (!valid) {
      console.error("[Auth] Firma del token inválida");
      return null;
    }

    return {
      uid: payload.sub,
      email: payload.email || "",
      emailVerified: payload.email_verified === true,
    };
  } catch (err) {
    console.error("[Auth] Excepción en verifyFirebaseToken:", err?.message || err);
    return null;
  }
}

// ─── Fix auditoría 2026-07-04: control de módulos y tokens en el servidor ────
// La restricción "solo admin" del convertidor PDF→JSON era solo de UI:
// cualquier usuario autenticado podía invocar el módulo con 12K tokens.
const ADMIN_ONLY_MODULES = new Set(["planificacion.curriculo_pdf_json"]);
const MAX_TOKENS_CAP = 24000; // techo del edge; el reintento de Fase A pide hasta 20000 tras truncamiento con modelos verbosos

// Cuenta administradora principal: acceso completo por email EXACTO, sin
// exigir verificación (la cuenta ya existe en Firebase Auth — nadie más puede
// registrar ese correo). El requisito email_verified aplica solo al resto
// del dominio, que es donde estaba el hueco de la auditoría.
const ADMIN_EMAILS = new Set(["admin@docenteos.com"]);

function isAdminUser(authedUser) {
  const email = (authedUser?.email || "").toLowerCase();
  if (ADMIN_EMAILS.has(email)) return true;
  return /@docenteos\.com$/.test(email) && authedUser?.emailVerified === true;
}

// ─── Configuración por defecto ────────────────────────────────────────────────

const DEFAULT_ORDER = ["openai", "anthropic", "gemini", "nvidia", "abacus"];

const DEFAULT_MODELS = {
  openai:    "gpt-4o",
  abacus:    "gpt-4o-mini",
  anthropic: "claude-sonnet-4-6",
  nvidia:    "nvidia/nemotron-3-ultra-550b-a55b",
  gemini:    "gemini-2.5-flash",
};

const PROVIDER_BASE_URLS = {
  openai:  "https://api.openai.com/v1",
  abacus:  process.env.ABACUS_BASE_URL || "https://routellm.abacus.ai/v1",
  nvidia:  "https://integrate.api.nvidia.com/v1",
  // Endpoint OpenAI-compatible oficial de Google AI Studio
  gemini:  "https://generativelanguage.googleapis.com/v1beta/openai",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getApiKey(provider) {
  switch (provider) {
    case "openai":    return process.env.OPENAI_API_KEY    || null;
    case "anthropic": return process.env.ANTHROPIC_API_KEY || null;
    case "abacus":    return process.env.ABACUS_API_KEY    || null;
    case "nvidia":    return process.env.NVIDIA_API_KEY    || null;
    case "gemini":    return process.env.GEMINI_API_KEY    || process.env.GOOGLE_API_KEY || null;
    default:          return null;
  }
}

function getModel(provider, modelOverrides) {
  return (modelOverrides?.[provider]) || DEFAULT_MODELS[provider] || provider;
}

function getProviderTimeoutMs(provider, mod) {
  // La extracción de PDF curricular es más pesada (fragmento largo + JSON
  // grande): se le da más margen que a una generación normal, porque un
  // corte a mitad pierde los indicadores del fragmento entero.
  const esExtraccionPdf = typeof mod === "string" && mod.includes("curriculo_pdf_json");
  // Timeouts de generación subidos: el contrato de Fase A es largo y los modelos
  // verbosos (deepseek, etc.) se truncaban al agotar el tiempo antes que los
  // tokens. Un lote completo de 2 clases con evidencias/metacognición/recursos
  // puede tardar >18s en modelos lentos.
  // El runtime Edge de Vercel corta la respuesta ~25s: si nuestro timeout
  // interno es MAYOR, Vercel devuelve 504 (gateway) antes de que podamos abortar
  // limpio y reintentar. Por eso la generación normal se mantiene POR DEBAJO de
  // ese muro (24s) — así un lote lento aborta con TimeoutError nuestro y se
  // reintenta, en vez de morir con 504. La extracción de PDF no pasa por este
  // muro del mismo modo (respuesta en streaming distinto), conserva su margen.
  switch (provider) {
    case "abacus":    return esExtraccionPdf ? 30_000 : 20_000;
    case "nvidia":    return esExtraccionPdf ? 35_000 : 24_000;
    case "gemini":    return esExtraccionPdf ? 40_000 : 24_000;
    case "openai":    return esExtraccionPdf ? 45_000 : 24_000;
    case "anthropic": return esExtraccionPdf ? 45_000 : 24_000;
    default:          return esExtraccionPdf ? 35_000 : 24_000;
  }
}

function timeoutSignal(ms) {
  return typeof AbortSignal !== "undefined" && AbortSignal.timeout
    ? AbortSignal.timeout(ms)
    : undefined;
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
function getProviderQueue(preferredProvider, providerOrder, strictProvider = false, providersDisabled = []) {
  // Proveedores APAGADOS por el admin: se excluyen SIEMPRE — del orden, de los
  // fallbacks y del default. Apagado ≠ "al final de la cola": apagado no se usa.
  const apagados = new Set(Array.isArray(providersDisabled) ? providersDisabled : []);
  const disponible = (p) => !apagados.has(p) && getApiKey(p);
  let queue;

  if (providerOrder && Array.isArray(providerOrder) && providerOrder.length > 0) {
    // Usar el orden de Firestore, filtrando solo los que tienen key
    const ordered = providerOrder.filter(disponible);
    if (strictProvider) return ordered;
    // Añadir cualquier proveedor de DEFAULT_ORDER que no esté en el order del admin
    const extras  = DEFAULT_ORDER.filter((p) => !providerOrder.includes(p) && disponible(p));
    queue = [...ordered, ...extras];
  } else {
    queue = DEFAULT_ORDER.filter(disponible);
    if (preferredProvider && queue.includes(preferredProvider)) {
      queue = [preferredProvider, ...queue.filter((p) => p !== preferredProvider)];
    }
  }

  return queue;
}

// ─── Llamadas a proveedores ────────────────────────────────────────────────────

async function callAnthropic(apiKey, { system, prompt, maxTokens, model, imageBase64, imageMediaType, signal }) {
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
    signal,
  });
}

async function callOpenAICompatible(apiKey, baseURL, { system, prompt, maxTokens, model, jsonMode, signal }) {
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
      // Usage REAL en el último chunk del stream (tokens exactos facturables).
      // Solo en endpoints que lo soportan documentadamente — los demás
      // proveedores pueden adjuntar usage igual y también se captura.
      ...(baseURL === "https://api.openai.com/v1"
        || baseURL === "https://generativelanguage.googleapis.com/v1beta/openai"
        ? { stream_options: { include_usage: true } }
        : {}),
      // response_format JSON solo para api.openai.com — evita errores en Abacus/NVIDIA
      ...(jsonMode && baseURL === "https://api.openai.com/v1"
        ? { response_format: { type: "json_object" } }
        : {}),
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: prompt },
      ],
    }),
    signal,
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

      // Tokens EXACTOS reportados por el proveedor (facturables), si los envía
      let usageIn  = 0;
      let usageOut = 0;

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
                // Anthropic: input en message_start, output acumulado en message_delta
                if (parsed.type === "message_start" && parsed.message?.usage?.input_tokens) {
                  usageIn = parsed.message.usage.input_tokens;
                }
                if (parsed.usage?.output_tokens) {
                  usageOut = parsed.usage.output_tokens;
                }
              } else {
                text = parsed.choices?.[0]?.delta?.content ?? null;
                // OpenAI-compatible: chunk final con usage (stream_options
                // include_usage) o usage adjunto que envían algunos proveedores
                if (parsed.usage) {
                  if (parsed.usage.prompt_tokens)     usageIn  = parsed.usage.prompt_tokens;
                  if (parsed.usage.completion_tokens) usageOut = parsed.usage.completion_tokens;
                }
              }

              if (text) send({ text });
            } catch {
              // línea SSE no parseable — ignorar
            }
          }
        }

        if (usageIn || usageOut) {
          send({ usage: { in: usageIn, out: usageOut, exact: true } });
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
    providersDisabled, // string[] — proveedores APAGADOS por el admin (jamás se usan, ni como fallback)
    strictProvider = false,
    imageBase64,       // base64 image for vision (Anthropic only)
    imageMediaType,    // e.g. "image/jpeg"
  } = body;

  if (!prompt) {
    return new Response(JSON.stringify({ error: "prompt es requerido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Módulos administrativos: verificados en servidor, no solo en la UI
  if (ADMIN_ONLY_MODULES.has(mod) && !isAdminUser(authedUser)) {
    return new Response(
      JSON.stringify({ error: "Este módulo es exclusivo de administradores." }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  // Tope de tokens de salida: el cliente no decide costos ilimitados
  const tokensSalida = Math.min(Math.max(parseInt(maxTokens, 10) || 4096, 1), MAX_TOKENS_CAP);

  const queue = getProviderQueue(preferredProvider, providerOrder, strictProvider, providersDisabled);

  if (queue.length === 0) {
    const hayApagados = Array.isArray(providersDisabled) && providersDisabled.length > 0;
    console.error(`[AI Gateway] Cola vacía — apagados por admin: [${(providersDisabled || []).join(", ")}]`);
    return new Response(
      JSON.stringify({
        error: hayApagados
          ? "Todos los proveedores de IA disponibles están desactivados por el administrador. Enciende al menos uno en Administración → Motor de IA."
          : "No hay ningún servicio de Inteligencia Artificial disponible en este momento. Verifica la configuración del administrador o intenta nuevamente más tarde.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  let lastError = null;

  // Activa JSON mode nativo (response_format) cuando el módulo es de planificación
  const jsonMode = typeof mod === "string" && mod.startsWith("planificacion");

  for (const provider of queue) {
    const apiKey = getApiKey(provider);
    const model  = getModel(provider, modelOverrides);
    const signal = timeoutSignal(getProviderTimeoutMs(provider, mod));

    try {
      let providerResponse;

      if (provider === "anthropic") {
        providerResponse = await callAnthropic(apiKey, { system, prompt, maxTokens: tokensSalida, model, imageBase64, imageMediaType, signal });
      } else {
        const baseURL = PROVIDER_BASE_URLS[provider];
        providerResponse = await callOpenAICompatible(apiKey, baseURL, {
          system, prompt, maxTokens: tokensSalida, model, jsonMode, signal,
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
      const isTimeout = err?.name === "TimeoutError" || err?.name === "AbortError";
      lastError = isTimeout
        ? `${provider}: tiempo de espera agotado`
        : `${provider}: ${err.message}`;
      console.error(`[AI Gateway] Proveedor ${provider} falló:`, err);
      continue;
    }
  }

  console.error(`[AI Gateway] Todos los proveedores fallaron. Último error: ${lastError}`);
  return new Response(
    JSON.stringify({
      error: `No hay ningún servicio de Inteligencia Artificial disponible en este momento. Último error: ${lastError || "sin detalle del proveedor"}. Verifica la configuración del administrador o intenta nuevamente más tarde.`,
    }),
    { status: 503, headers: { "Content-Type": "application/json" } }
  );
}
