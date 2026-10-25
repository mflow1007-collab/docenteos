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
 *   preferredProvider string  — pista: mueve este proveedor al frente (solo si el admin no fijó prioridad)
 *   providerOrder    string[] — pista: acota/reordena DENTRO de los proveedores habilitados
 *   providersDisabled string[] — pista: el cliente puede apagar más (nunca encender)
 *   strictProvider   boolean — si true, no agrega fallbacks fuera del providerOrder
 *
 * Modelos, prioridad y proveedores apagados los decide el SERVIDOR leyendo
 * config/ia-gateway (Etapa S+). El cliente no elige modelo: `modelOverrides`
 * se ignora. Sin correo verificado no se atiende (salvo la cuenta admin exacta).
 */

export const config = { runtime: "edge" };

import { verifyFirebaseToken, isAdminUser } from "../_firebaseAuth.js";

// ─── Fix auditoría 2026-07-04: control de módulos y tokens en el servidor ────
// La restricción "solo admin" del convertidor PDF→JSON era solo de UI:
// cualquier usuario autenticado podía invocar el módulo con 12K tokens.
const ADMIN_ONLY_MODULES = new Set(["planificacion.curriculo_pdf_json"]);
const MAX_TOKENS_CAP = 24000; // techo del edge; el reintento de Fase A pide hasta 20000 tras truncamiento con modelos verbosos

// ─── Configuración por defecto ────────────────────────────────────────────────

const DEFAULT_ORDER = ["openai", "anthropic", "gemini", "nvidia", "abacus"];

const DEFAULT_MODELS = {
  openai:    "gpt-4o",
  abacus:    "gpt-4o-mini",
  anthropic: "claude-sonnet-5",
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

// ─── Config del admin (config/ia-gateway), leída en el servidor ──────────────
// Se lee por la API REST de Firestore con el token del propio usuario (las
// reglas permiten leer config a cualquier autenticado): no hace falta otro
// secreto. Caché corta en memoria de la instancia.

const CONFIG_TTL_MS = 60 * 1000;
let _config   = null;
let _configAt = 0;

/** Solo para pruebas: fuerza a releer la config en la próxima petición. */
export function invalidarConfigGateway() {
  _config = null;
  _configAt = 0;
}

const LEGACY_MODEL_REPLACEMENTS = {
  anthropic: {
    "claude-sonnet-4-6": "claude-sonnet-5",
  },
};

function normalizarModelos(models) {
  const next = { ...(models && typeof models === "object" ? models : {}) };
  for (const [provider, replacements] of Object.entries(LEGACY_MODEL_REPLACEMENTS)) {
    const current = next[provider];
    if (current && replacements[current]) next[provider] = replacements[current];
  }
  return next;
}

// Valor tipado de la API REST de Firestore → valor JS
function valorFirestore(v) {
  if (!v || typeof v !== "object") return null;
  if ("stringValue" in v)    return v.stringValue;
  if ("booleanValue" in v)   return v.booleanValue;
  if ("integerValue" in v)   return Number(v.integerValue);
  if ("doubleValue" in v)    return v.doubleValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v)     return (v.arrayValue.values || []).map(valorFirestore);
  if ("mapValue" in v)       return camposFirestore(v.mapValue.fields);
  return null;
}

function camposFirestore(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields || {})) out[k] = valorFirestore(v);
  return out;
}

/**
 * Lee config/ia-gateway. Documento inexistente → {} (defaults del servidor).
 * Cualquier otro fallo LANZA: el handler responde 503 visible (no se cae a
 * defaults, que podrían usar un proveedor apagado por el admin).
 */
export async function leerConfigGateway(idToken) {
  const now = Date.now();
  if (_config && now - _configAt < CONFIG_TTL_MS) return _config;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("FIREBASE_PROJECT_ID no está configurado");

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/config/ia-gateway`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });

  let config;
  if (res.status === 404) {
    config = {};
  } else if (!res.ok) {
    throw new Error(`Firestore respondió HTTP ${res.status}`);
  } else {
    config = camposFirestore((await res.json())?.fields);
  }

  config.models = normalizarModelos(config.models);
  _config = config;
  _configAt = now;
  return config;
}

// ─── Modelo por proveedor (decide el servidor) ───────────────────────────────
// Módulos de composición larga (Fase A de la unidad): modelo fuerte. Si el
// admin configuró una variante débil, para estos módulos se usa la allowlist;
// sin modelo apto el proveedor no se usa. Antes vivía en phaseAService.js.
const MODULOS_COMPOSICION = new Set(["planificacion"]);
const MODELOS_COMPOSICION = {
  openai:    "gpt-4o",
  gemini:    "gemini-2.5-pro",
  anthropic: "claude-sonnet-5",
  abacus:    "gpt-4o",
};
const MODELO_DEBIL_RE = /flash|mini|lite|nano|tiny|small|haiku/i;

/** Modelo que usará el gateway; null = proveedor no apto para este módulo. */
export function resolverModelo(provider, mod, configModels = {}) {
  const admin = String(configModels?.[provider] || "").trim();
  if (MODULOS_COMPOSICION.has(mod)) {
    if (admin && !MODELO_DEBIL_RE.test(admin)) return admin;
    return MODELOS_COMPOSICION[provider] || null;
  }
  return admin || DEFAULT_MODELS[provider] || null;
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
 * 1. Habilitados = prioridad del admin (config.priority) + resto de
 *    DEFAULT_ORDER, sin los apagados por el admin, sin los que no tienen API
 *    key y sin los que no tienen modelo apto para el módulo.
 * 2. Las pistas del cliente solo ACOTAN o REORDENAN dentro de los habilitados:
 *    `providerOrder` (con `strictProvider` = solo esos), `providersDisabled`
 *    (apaga más, nunca enciende) y `preferredProvider` (al frente, solo si el
 *    admin no fijó prioridad).
 */
export function getProviderQueue(config, mod, { preferredProvider, providerOrder, strictProvider = false, providersDisabled } = {}) {
  // Apagado ≠ "al final de la cola": apagado no se usa, ni como fallback.
  const apagados = new Set([
    ...(Array.isArray(config?.disabled) ? config.disabled : []),
    ...(Array.isArray(providersDisabled) ? providersDisabled : []),
  ]);
  const prioridad = Array.isArray(config?.priority) && config.priority.length ? config.priority : null;
  const base = prioridad ? [...prioridad, ...DEFAULT_ORDER] : DEFAULT_ORDER;
  const habilitados = base
    .filter((p, i, arr) => arr.indexOf(p) === i)
    .filter((p) => DEFAULT_ORDER.includes(p) && !apagados.has(p) && getApiKey(p)
      && resolverModelo(p, mod, config?.models));

  if (Array.isArray(providerOrder) && providerOrder.length > 0) {
    const ordered = providerOrder.filter((p, i, arr) => arr.indexOf(p) === i && habilitados.includes(p));
    if (strictProvider) return ordered;
    return [...ordered, ...habilitados.filter((p) => !ordered.includes(p))];
  }
  if (!prioridad && preferredProvider && habilitados.includes(preferredProvider)) {
    return [preferredProvider, ...habilitados.filter((p) => p !== preferredProvider)];
  }
  return habilitados;
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
      // Motivo de parada declarado por el proveedor. Distingue truncado real
      // (max_tokens / length) de un corte por timeout de Edge (nunca llega
      // stop_reason → queda null y el cliente lo lee como ABORTO_POR_TIEMPO).
      let stopReason = null;

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
                // Anthropic: stop_reason y output_tokens finales en message_delta
                if (parsed.type === "message_delta") {
                  if (parsed.delta?.stop_reason) stopReason = parsed.delta.stop_reason;
                  if (parsed.usage?.output_tokens) usageOut = parsed.usage.output_tokens;
                }
              } else {
                text = parsed.choices?.[0]?.delta?.content ?? null;
                // OpenAI-compatible: chunk final con usage (stream_options
                // include_usage) o usage adjunto que envían algunos proveedores
                if (parsed.usage) {
                  if (parsed.usage.prompt_tokens)     usageIn  = parsed.usage.prompt_tokens;
                  if (parsed.usage.completion_tokens) usageOut = parsed.usage.completion_tokens;
                }
                // OpenAI-compatible: finish_reason "length" == truncado por tope
                if (parsed.choices?.[0]?.finish_reason) {
                  stopReason = parsed.choices[0].finish_reason;
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
        send({ meta: { provider, model, stopReason } });
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        send({ error: err.message });
        controller.close();
      }
    },
  });
}

async function collectNormalizedProviderText(providerResponse, provider) {
  const reader  = providerResponse.body?.getReader?.();
  if (!reader) return { text: "", usage: null, aborted: false };

  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let usageIn  = 0;
  let usageOut = 0;
  let stopReason = null;
  // Si el signal aborta a los 24s, reader.read() LANZA (AbortError): sin este
  // try el texto parcial ya acumulado se perdía y el modo de fallo nunca se
  // podía clasificar como ABORTO_POR_TIEMPO. Capturamos, devolvemos lo parcial
  // y marcamos aborted para que el llamador lo distinga de un fin limpio.
  let aborted = false;

  try {
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (!raw || raw === "[DONE]") continue;

      try {
        const parsed = JSON.parse(raw);

        if (provider === "anthropic") {
          if (
            parsed.type === "content_block_delta" &&
            parsed.delta?.type === "text_delta"
          ) {
            text += parsed.delta.text || "";
          }
          if (parsed.type === "message_start" && parsed.message?.usage?.input_tokens) {
            usageIn = parsed.message.usage.input_tokens;
          }
          if (parsed.usage?.output_tokens) {
            usageOut = parsed.usage.output_tokens;
          }
          // Anthropic: stop_reason y output_tokens finales en message_delta
          if (parsed.type === "message_delta") {
            if (parsed.delta?.stop_reason) stopReason = parsed.delta.stop_reason;
            if (parsed.usage?.output_tokens) usageOut = parsed.usage.output_tokens;
          }
        } else {
          text += parsed.choices?.[0]?.delta?.content || "";
          if (parsed.usage) {
            if (parsed.usage.prompt_tokens)     usageIn  = parsed.usage.prompt_tokens;
            if (parsed.usage.completion_tokens) usageOut = parsed.usage.completion_tokens;
          }
          // OpenAI-compatible: finish_reason "length" == truncado por tope
          if (parsed.choices?.[0]?.finish_reason) {
            stopReason = parsed.choices[0].finish_reason;
          }
        }
      } catch {
        // línea SSE no parseable — ignorar
      }
    }
  }
  } catch (err) {
    // Corte del stream (timeout de Edge / AbortError). Conservamos el texto
    // parcial ya leído; el llamador lo trata como ABORTO_POR_TIEMPO.
    if (err?.name === "AbortError" || err?.name === "TimeoutError") {
      aborted = true;
    } else {
      throw err;
    }
  }

  return {
    text,
    usage: usageIn || usageOut ? { in: usageIn, out: usageOut, exact: true } : null,
    stopReason,
    aborted,
  };
}

// Respuesta de tiempo agotado que CORTA el bucle de proveedores. El timeout
// interno (~24s) ya consumió casi todo el muro de Edge (~25s); rotar en la
// misma invocación produciría un 504 sin logs y cobraría una segunda
// generación. El mensaje conserva "tiempo de espera agotado" para que el
// cliente lo clasifique como ABORTO_POR_TIEMPO. Estado 504 (Gateway Timeout).
function respuestaTiempoAgotado(detalle) {
  return new Response(
    JSON.stringify({
      error: `${detalle}. El servicio de IA no respondió dentro del tiempo disponible; reintenta con menos carga (tiempo de espera agotado).`,
      timeout: true,
    }),
    { status: 504, headers: { "Content-Type": "application/json" } }
  );
}

function buildCollectedTextStream(text, provider, model, usage, stopReason = null) {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      if (text) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
      }
      if (usage) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ usage })}\n\n`));
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ meta: { provider, model, stopReason } })}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
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

  // Correo verificado: el registro es abierto, así que sin verificar no se
  // gasta IA. La cuenta admin exacta queda exenta (igual que isAdminUser).
  if (!authedUser.emailVerified && !isAdminUser(authedUser)) {
    return new Response(
      JSON.stringify({ error: "Verifica tu correo electrónico para usar la Inteligencia Artificial. Revisa tu bandeja de entrada y vuelve a iniciar sesión." }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
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
    preferredProvider, // pista del cliente (ver getProviderQueue)
    providerOrder,     // pista del cliente: acota/reordena dentro de los habilitados
    providersDisabled, // pista del cliente: apaga más (p. ej. sin crédito), nunca enciende
    strictProvider = false,
    requireNonEmpty = false,
    imageBase64,       // base64 image for vision (Anthropic only)
    imageMediaType,    // e.g. "image/jpeg"
  } = body;

  if (!prompt) {
    return new Response(JSON.stringify({ error: "prompt es requerido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Tope de tamaño de ENTRADA: evita que un cliente autenticado dispare el costo
  // de tokens enviando prompts/system gigantes. El límite es muy holgado frente a
  // los prompts legítimos (los contratos más grandes rondan ~16-20k tokens de
  // salida; la entrada real queda muy por debajo de esto), así que no rompe el
  // contrato con el frontend. ~200k caracteres ≈ 50k tokens.
  const MAX_INPUT_CHARS = 200_000;
  const tamanoEntrada = String(prompt).length + String(system || "").length;
  if (tamanoEntrada > MAX_INPUT_CHARS) {
    return new Response(
      JSON.stringify({ error: `La solicitud es demasiado grande (${tamanoEntrada} caracteres; máximo ${MAX_INPUT_CHARS}). Reduce el tamaño del contenido.` }),
      { status: 413, headers: { "Content-Type": "application/json" } }
    );
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

  let gwConfig;
  try {
    gwConfig = await leerConfigGateway(idToken);
  } catch (err) {
    console.error("[AI Gateway] No se pudo leer config/ia-gateway:", err?.message || err);
    return new Response(
      JSON.stringify({ error: "No se pudo leer la configuración de Inteligencia Artificial del administrador. Intenta de nuevo en unos minutos." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  const queue = getProviderQueue(gwConfig, mod, { preferredProvider, providerOrder, strictProvider, providersDisabled });

  if (queue.length === 0) {
    const apagadosAdmin = Array.isArray(gwConfig.disabled) ? gwConfig.disabled : [];
    const hayApagados = apagadosAdmin.length > 0;
    console.error(`[AI Gateway] Cola vacía — apagados por admin: [${apagadosAdmin.join(", ")}]`);
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
    const model  = resolverModelo(provider, mod, gwConfig.models);
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

      if (requireNonEmpty) {
        const collected = await collectNormalizedProviderText(providerResponse, provider);
        if (!collected.text.trim()) {
          // Aborto por timeout SIN texto: el timeout interno (~24s) ya consumió
          // casi todo el muro de Edge (~25s). Rotar a otro proveedor en la MISMA
          // invocación garantiza un 504 sin logs y cobra una segunda generación.
          // Se corta el bucle y se devuelve el error de tiempo de inmediato.
          if (collected.aborted) {
            lastError = `${provider}: tiempo de espera agotado`;
            console.error(`[AI Gateway] ${lastError} — se corta el bucle (sin rotar) para no agotar el muro de Edge`);
            return respuestaTiempoAgotado(lastError);
          }
          lastError = `${provider}: respuesta vacía`;
          console.error(`[AI Gateway] ${lastError}`);
          continue;
        }

        // Con texto parcial de un aborto (collected.aborted), stopReason viaja
        // null → el cliente lo clasifica ABORTO_POR_TIEMPO y no como truncado real.
        return new Response(buildCollectedTextStream(collected.text, provider, model, collected.usage, collected.stopReason), {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection":    "keep-alive",
            "X-AI-Provider": provider,
            "X-AI-Model":    model,
            "X-AI-Module":   mod,
          },
        });
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
      if (isTimeout) {
        // Igual que arriba: el timeout interno agotó el muro de Edge. NO rotar
        // en la misma invocación (504 sin logs + doble cobro). Cortar y devolver.
        lastError = `${provider}: tiempo de espera agotado`;
        console.error(`[AI Gateway] Proveedor ${provider} agotó el tiempo — se corta el bucle (sin rotar):`, err);
        return respuestaTiempoAgotado(lastError);
      }
      lastError = `${provider}: ${err.message}`;
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
