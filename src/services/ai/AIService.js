/**
 * AIService — Punto único de acceso a la IA en DocenteOS.
 *
 * TODA la app llama únicamente a:
 *   AIService.generate({ module, prompt, system, onChunk, onFinish, onError })
 *
 * Nunca llamar directamente a OpenAI, Anthropic, Abacus, etc.
 * Las API keys viven en el servidor (api/ai/generate.js), nunca aquí.
 *
 * Flujo interno:
 *   1. Verificar cache en Firebase
 *   2. Cargar configuración de Firestore (prioridad + modelos del admin)
 *   3. POST /api/ai/generate (Edge Function del servidor)
 *   4. Leer stream SSE normalizado
 *   5. Guardar en cache si aplica
 *   6. Registrar uso en aiLogs/
 *   7. Llamar onFinish(textoCompleto)
 */

import { AIConfig, getModuleConfig } from "./AIConfig";
import { resolveModuleOptions } from "./router";
import { getCached, setCached } from "./cache";
import { logUsage } from "./usage";
import { db } from "../../firebase.js";
import { doc, getDoc } from "firebase/firestore";

// ─── Config cache (Firestore config/ia-gateway) ───────────────────────────────
// Se carga una vez y se refresca cada 5 minutos.
// Así el admin puede cambiar la prioridad/modelo y se aplica sin recargar.

let _gwConfig    = null;
let _gwLoadedAt  = 0;
const GW_TTL_MS  = 5 * 60 * 1000; // 5 minutos

async function loadGatewayConfig() {
  const now = Date.now();
  if (_gwConfig !== null && now - _gwLoadedAt < GW_TTL_MS) return _gwConfig;

  try {
    if (!db) { _gwConfig = {}; _gwLoadedAt = now; return _gwConfig; }
    const snap = await getDoc(doc(db, "config", "ia-gateway"));
    _gwConfig   = snap.exists() ? snap.data() : {};
    _gwLoadedAt = now;
  } catch {
    // No fatal — sin config usaremos el orden por defecto del servidor
    if (_gwConfig === null) _gwConfig = {};
  }

  return _gwConfig;
}

/** Invalida el cache local para que la próxima llamada cargue config fresca. */
export function invalidateGatewayConfig() {
  _gwLoadedAt = 0;
}

export const AIService = {
  /**
   * Genera una respuesta de IA con streaming.
   *
   * @param {Object} opts
   * @param {string}   opts.module         - Identificador del módulo
   * @param {string}   opts.prompt         - Prompt del usuario
   * @param {string}   [opts.system]       - System prompt
   * @param {number}   [opts.maxTokens]    - Máximo de tokens
   * @param {Function} opts.onChunk        - Llamado por cada fragmento de texto
   * @param {Function} opts.onFinish       - Llamado al finalizar con el texto completo
   * @param {Function} opts.onError        - Llamado con mensaje de error amigable
   */
  async generate({ module, prompt, system, maxTokens, onChunk, onFinish, onError, _contextMeta }) {
    const moduleConfig      = getModuleConfig(module);
    const routerOpts        = resolveModuleOptions(module);
    const resolvedMaxTokens = maxTokens ?? routerOpts.maxTokens;
    const startTime         = Date.now();
    let accumulated  = "";
    let usedProvider = "unknown";
    let usedModel    = "unknown";

    // ── Log de contexto (si no viene del ContextBuilder, estimar aquí) ───────
    if (import.meta.env.DEV && !_contextMeta) {
      const chars  = (prompt || "").length + (system || "").length;
      const tokens = Math.ceil(chars / 3.8);
      console.debug(`[DocenteOS AI] generate — módulo: ${module} | tokens estimados: ${tokens} | chars: ${chars}`);
    }

    // ── 1. Buscar en cache ───────────────────────────────────────────────────
    if (moduleConfig.cache) {
      try {
        const cached = await getCached(module, prompt);
        if (cached) {
          onChunk(cached);
          onFinish(cached);
          logUsage({ module, provider: "cache", model: "cache", ms: Date.now() - startTime, fromCache: true });
          return;
        }
      } catch {
        // no-fatal
      }
    }

    // ── 2. Cargar config dinámica de Firestore ───────────────────────────────
    //    priority:      orden de proveedores guardado por el admin
    //    modelOverrides: modelo seleccionado por el admin por proveedor
    let providerOrder  = null;
    let modelOverrides = null;
    try {
      const gwConfig  = await loadGatewayConfig();
      providerOrder   = gwConfig.priority || null;
      modelOverrides  = gwConfig.models   || null;
    } catch {
      // no-fatal — el gateway usará su orden por defecto
    }

    // ── 3. Llamar al Gateway (servidor) ──────────────────────────────────────
    let response;
    try {
      response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module,
          prompt,
          system,
          maxTokens:         resolvedMaxTokens,
          preferredProvider: routerOpts.preferredProvider,
          providerOrder,    // orden del admin desde Firestore
          modelOverrides,   // modelos del admin desde Firestore
        }),
      });
    } catch (err) {
      const msg = `Error de red al conectar con el servidor de IA: ${err.message}`;
      onError(msg);
      logUsage({ module, provider: "unknown", model: "unknown", ms: Date.now() - startTime, error: msg });
      return;
    }

    if (!response.ok) {
      let msg = `El servidor de IA respondió con error ${response.status}.`;
      try {
        const body = await response.json();
        msg = body.error || msg;
      } catch { /* usar msg default */ }
      onError(msg);
      logUsage({ module, provider: "unknown", model: "unknown", ms: Date.now() - startTime, error: msg });
      return;
    }

    // Proveedor y modelo usados — informados por el servidor en headers
    usedProvider = response.headers.get("X-AI-Provider") || "unknown";
    usedModel    = response.headers.get("X-AI-Model")    || "unknown";

    // ── 4. Leer el stream SSE normalizado ────────────────────────────────────
    try {
      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
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
            if (parsed.text) {
              accumulated += parsed.text;
              onChunk(parsed.text);
            } else if (parsed.error) {
              onError(parsed.error);
              return;
            }
          } catch { /* línea malformada — ignorar */ }
        }
      }
    } catch (err) {
      const msg = `Error al leer la respuesta de IA: ${err.message}`;
      onError(msg);
      logUsage({ module, provider: usedProvider, model: usedModel, ms: Date.now() - startTime, error: msg });
      return;
    }

    const ms = Date.now() - startTime;

    // ── 5. Guardar en cache ──────────────────────────────────────────────────
    if (moduleConfig.cache && accumulated) {
      setCached(module, prompt, accumulated, moduleConfig.cacheTTLHours);
    }

    // ── 6. Registrar uso ─────────────────────────────────────────────────────
    if (AIConfig.logging) {
      logUsage({
        module,
        provider: usedProvider,
        model:    usedModel,
        tokensOut: Math.ceil(accumulated.length / 4),
        ms,
        fromCache: false,
      });
    }

    // ── 7. Finalizar ─────────────────────────────────────────────────────────
    onFinish(accumulated);
  },
};
