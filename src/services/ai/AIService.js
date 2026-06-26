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
 *   2. POST /api/ai/generate (Edge Function del servidor)
 *   3. Leer stream SSE normalizado
 *   4. Guardar en cache si aplica
 *   5. Registrar uso en aiLogs/
 *   6. Llamar onFinish(textoCompleto)
 */

import { AIConfig, getModuleConfig } from "./AIConfig";
import { resolveModuleOptions } from "./router";
import { getCached, setCached } from "./cache";
import { logUsage } from "./usage";

export const AIService = {
  /**
   * Genera una respuesta de IA con streaming.
   *
   * @param {Object} opts
   * @param {string}   opts.module         - Identificador del módulo ('auditoria-ia', 'centro-ia', etc.)
   * @param {string}   opts.prompt         - Prompt del usuario
   * @param {string}   [opts.system]       - System prompt (instrucciones del asistente)
   * @param {number}   [opts.maxTokens]    - Máximo de tokens (sobreescribe config del módulo)
   * @param {Function} opts.onChunk        - Llamado por cada fragmento de texto recibido
   * @param {Function} opts.onFinish       - Llamado al finalizar con el texto completo
   * @param {Function} opts.onError        - Llamado con un mensaje de error amigable
   */
  async generate({ module, prompt, system, maxTokens, onChunk, onFinish, onError }) {
    const moduleConfig      = getModuleConfig(module);
    const routerOpts        = resolveModuleOptions(module);
    const resolvedMaxTokens = maxTokens ?? routerOpts.maxTokens;
    const startTime         = Date.now();
    let accumulated  = "";
    let usedProvider = "unknown";
    let usedModel    = "unknown";

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

    // ── 2. Llamar al Gateway (servidor) ──────────────────────────────────────
    let response;
    try {
      response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module,
          prompt,
          system,
          maxTokens: resolvedMaxTokens,
          preferredProvider: routerOpts.preferredProvider,
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

    // ── 3. Leer el stream SSE normalizado ────────────────────────────────────
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

    // ── 4. Guardar en cache ──────────────────────────────────────────────────
    if (moduleConfig.cache && accumulated) {
      setCached(module, prompt, accumulated, moduleConfig.cacheTTLHours);
    }

    // ── 5. Registrar uso ─────────────────────────────────────────────────────
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

    // ── 6. Finalizar ─────────────────────────────────────────────────────────
    onFinish(accumulated);
  },
};
