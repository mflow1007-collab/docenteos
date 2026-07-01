/**
 * Registro de uso del AI Gateway — colección aiLogs/
 *
 * Guarda: usuario, fecha, módulo, proveedor, modelo, tokens,
 * costo estimado, tiempo de respuesta y si vino del cache.
 */

import { db } from "../../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Tarifas aproximadas en USD por 1M tokens (actualizar según cambien)
const COST_RATES = {
  "claude-sonnet-4-6":                       { in: 3.0,  out: 15.0 },
  "gpt-4o":                                  { in: 2.5,  out: 10.0 },
  "route-llm":                               { in: 1.0,  out: 3.0  },
  // NVIDIA NIM — https://build.nvidia.com/pricing
  "nvidia/llama-3.1-nemotron-70b-instruct":  { in: 1.25, out: 5.0  },
  "meta/llama-3.1-8b-instruct":              { in: 0.20, out: 0.20 },
  "mistralai/mixtral-8x7b-instruct-v0.1":   { in: 0.60, out: 0.60 },
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
      error:           error || null,
    });
  } catch {
    // logging no-fatal — nunca romper la experiencia de usuario
  }
}
