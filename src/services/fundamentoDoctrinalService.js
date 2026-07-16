/**
 * fundamentoDoctrinalService — resolución del fundamento doctrinal (B1).
 *
 * Orden de resolución:
 *   1. Firestore config/fundamento-doctrinal → campo del nivel (editable por
 *      el admin SIN deploy; la colección config ya permite lectura a todo
 *      usuario autenticado y escritura solo admin)
 *   2. Fallback local (src/data/fundamentoDoctrinalMINERD.js) — SIEMPRE
 *      disponible: la generación jamás se bloquea por falta del doc.
 *
 * La INYECCIÓN en los prompts (Fase A, ContextBuilder, agentes BIC) es B3 y
 * está bloqueada hasta la generación de referencia validada del dueño (A2).
 */

import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase.js";
import { fundamentoLocal, nivelCanonico, FUNDAMENTO_BASE } from "../data/fundamentoDoctrinalMINERD.js";

export const FUNDAMENTO_CONFIG_DOC = "fundamento-doctrinal";

// Caché de sesión: la doctrina cambia rara vez; 5 min evita releer config
// en cada generación sin esconder ediciones del admin por mucho tiempo.
const CACHE_TTL_MS = 5 * 60_000;
let _cache = { en: 0, data: null };

const leerConfig = async () => {
  if (!db) return null;
  const ahora = Date.now();
  if (_cache.data !== null && ahora - _cache.en < CACHE_TTL_MS) return _cache.data;
  try {
    const snap = await getDoc(doc(db, "config", FUNDAMENTO_CONFIG_DOC));
    const data = snap.exists() ? snap.data() : {};
    _cache = { en: ahora, data };
    return data;
  } catch {
    return _cache.data; // sin red: lo último conocido (o null → fallback local)
  }
};

export const invalidarCacheFundamento = () => { _cache = { en: 0, data: null }; };

/**
 * Fundamento COMPLETO para un nivel: base + bloque del nivel.
 * Override de Firestore cuando exista texto para ese nivel; si no, local.
 * NUNCA lanza y NUNCA devuelve vacío.
 * @returns {Promise<{ nivel, nivelAsumido, texto, fuente: "config"|"local" }>}
 */
export const getFundamentoDoctrinal = async (nivel = "") => {
  const local = fundamentoLocal(nivel);
  try {
    const cfg = await leerConfig();
    // Interruptor sin deploy: config.activo === false apaga la inyección
    // (B3) en todas las mentes sin perder los textos guardados.
    const activo = cfg?.activo !== false;
    const clave = nivelCanonico(nivel) || local.nivel;
    const base = String(cfg?.base || "").trim() || FUNDAMENTO_BASE;
    const bloque = String(cfg?.[clave] || "").trim();
    if (bloque) {
      return { nivel: clave, nivelAsumido: local.nivelAsumido, texto: `${base}\n\n${bloque}`, fuente: "config", activo };
    }
    return { ...local, activo };
  } catch {
    return { ...local, activo: true };
  }
};
