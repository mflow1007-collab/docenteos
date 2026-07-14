/**
 * Registro de uso del AI Gateway — colección aiLogs/
 *
 * Guarda: usuario, fecha, módulo, proveedor, modelo, tokens,
 * costo estimado, tiempo de respuesta y si vino del cache.
 */

import { db } from "../../firebase.js";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Tarifas aproximadas en USD por 1M tokens (actualizar según cambien)
const COST_RATES = {
  "claude-sonnet-5":                         { in: 3.0,  out: 15.0 },
  "claude-fable-5":                          { in: 0.80, out: 4.0  },
  "claude-opus-4-8":                         { in: 15.0, out: 75.0 },
  "claude-haiku-4-5-20251001":               { in: 0.80, out: 4.0  },
  "claude-sonnet-4-6":                       { in: 3.0,  out: 15.0 },
  "gpt-4o":                                  { in: 2.5,  out: 10.0 },
  "route-llm":                               { in: 1.0,  out: 3.0  },
  // NVIDIA NIM — Free Endpoint disponible en build.nvidia.com (dentro del free tier: $0)
  "nvidia/nemotron-3-ultra-550b-a55b": { in: 2.0,  out: 8.0  },
  "moonshotai/kimi-k2.6":              { in: 2.0,  out: 6.0  },
  "deepseek-ai/deepseek-v4-pro":       { in: 1.5,  out: 6.0  },
  "z-ai/glm5.1":                       { in: 1.0,  out: 4.0  },
  "meta/llama-3.3-70b-instruct":       { in: 0.80, out: 0.80 },
  "meta/llama-3.1-8b-instruct":        { in: 0.20, out: 0.20 },
};

function estimateCost(model, tokensIn, tokensOut) {
  const rate = COST_RATES[model] || { in: 2.0, out: 8.0 };
  return ((tokensIn * rate.in + tokensOut * rate.out) / 1_000_000).toFixed(6);
}

/**
 * Registra una llamada al AI Gateway en Firestore (aiLogs/).
 *
 * @param {Object} opts
 * @param {string} opts.module          - Módulo que hizo la llamada
 * @param {string} opts.provider        - Proveedor usado ('anthropic' | 'openai' | 'abacus' | 'cache')
 * @param {string} opts.model           - Modelo usado
 * @param {number} [opts.tokensIn]      - Tokens de entrada (estimado)
 * @param {number} [opts.tokensOut]     - Tokens de salida (estimado)
 * @param {number} [opts.ms]            - Tiempo de respuesta en ms
 * @param {boolean} [opts.fromCache]    - Si la respuesta vino del cache
 * @param {string|null} [opts.error]    - Mensaje de error si falló
 */
export async function logUsage({
  module,
  provider,
  model,
  tokensIn  = 0,
  tokensOut = 0,
  ms        = 0,
  fromCache = false,
  exact     = false, // true = tokens EXACTOS reportados por el proveedor
  error     = null,
}) {
  try {
    const uid = getAuth().currentUser?.uid || null;

    await addDoc(collection(db, "aiLogs"), {
      uid,
      fecha:           serverTimestamp(),
      modulo:          module,
      proveedor:       provider,
      modelo:          model,
      tokensEntrada:   tokensIn,
      tokensSalida:    tokensOut,
      costoEstimado:   fromCache ? "0.000000" : estimateCost(model, tokensIn, tokensOut),
      tiempoRespuesta: ms,
      cache:           fromCache,
      tokensExactos:   exact,
      error:           error || null,
    });
  } catch {
    // logging no-fatal — nunca romper la experiencia de usuario
  }
}
