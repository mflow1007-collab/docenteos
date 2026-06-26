/**
 * Cache de respuestas AI en Firestore — colección aiCache/
 *
 * Antes de llamar a cualquier proveedor, AIService busca aquí.
 * Si hay un hit válido (dentro del TTL), devuelve la respuesta cacheada
 * sin consumir tokens ni tiempo de API.
 *
 * La clave es un hash SHA-256 del prompt (primeros 2000 chars) + módulo.
 */

import { db } from "../../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

/** Hash SHA-256 del texto (usa primeros 2000 chars para rendimiento) */
async function hashKey(text) {
  try {
    const data = new TextEncoder().encode(text.slice(0, 2000));
    const buf  = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 32);
  } catch {
    // Fallback djb2 si crypto.subtle no está disponible
    let hash = 5381;
    for (let i = 0; i < Math.min(text.length, 500); i++) {
      hash = ((hash << 5) + hash) ^ text.charCodeAt(i);
    }
    return (hash >>> 0).toString(36);
  }
}

/**
 * Busca una respuesta cacheada.
 * @returns {string|null} La respuesta cacheada, o null si no existe / expiró.
 */
export async function getCached(module, prompt) {
  try {
    const key  = `${module}:${await hashKey(prompt)}`;
    const snap = await getDoc(doc(db, "aiCache", key));
    if (!snap.exists()) return null;

    const data = snap.data();
    // Verificar TTL
    if (data.expiresAt && data.expiresAt.toMillis() < Date.now()) return null;

    return data.response || null;
  } catch {
    return null; // errores de cache son no-fatales
  }
}

/**
 * Guarda una respuesta en cache.
 * @param {number} ttlHours - Horas de validez del cache (default 24h)
 */
export async function setCached(module, prompt, response, ttlHours = 24) {
  try {
    const key      = `${module}:${await hashKey(prompt)}`;
    const expiresAt = new Date(Date.now() + ttlHours * 3_600_000);

    await setDoc(doc(db, "aiCache", key), {
      module,
      response,
      createdAt:  serverTimestamp(),
      expiresAt,
      ttlHours,
    }, { merge: true });
  } catch {
    // errores de cache son no-fatales
  }
}
