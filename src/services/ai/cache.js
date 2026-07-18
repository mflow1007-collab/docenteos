/**
 * Cache de respuestas AI en Firestore — colección aiCache/
 *
 * Antes de llamar a cualquier proveedor, AIService busca aquí.
 * Si hay un hit válido (dentro del TTL), devuelve la respuesta cacheada
 * sin consumir tokens ni tiempo de API.
 *
 * Estrategia de clave:
 *   - Por defecto: hash SHA-256 del prompt completo + módulo
 *   - Con semanticKey: hash de la clave semántica (nivel+grado+área+tema) + módulo
 *     Esto permite cache hits entre docentes distintos con el mismo contexto pedagógico.
 */

import { db } from "../../firebase.js";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

/** Hash SHA-256 del texto COMPLETO (SHA-256 sobre decenas de KB es trivial;
 * truncar la entrada causaba colisiones entre prompts largos) */
async function hashKey(text) {
  try {
    const data = new TextEncoder().encode(text);
    const buf  = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 32);
  } catch {
    // Fallback djb2 si crypto.subtle no está disponible
    let hash = 5381;
    for (let i = 0; i < Math.min(text.length, 4000); i++) {
      hash = ((hash << 5) + hash) ^ text.charCodeAt(i);
    }
    return (hash >>> 0).toString(36);
  }
}

/**
 * Clave compuesta system+texto: cada parte se hashea POR SEPARADO.
 * Antes se hasheaba `${sys}§${texto}` truncado a 2000 chars: con un system
 * largo (doctrina B3 sola mide ~2350) el texto NUNCA entraba a la clave y
 * todas las peticiones del módulo colisionaban en UNA entrada compartida
 * entre docentes. G0.1 del Roadmap 6.
 */
async function claveCompuesta(sys, texto) {
  const [hSys, hTexto] = await Promise.all([hashKey(sys), hashKey(texto)]);
  return `${hSys}.${hTexto}`;
}

/**
 * Extrae los campos pedagógicamente estables del prompt y devuelve una
 * clave semántica normalizada. Sólo funciona si el prompt contiene las
 * marcas "Nivel:", "Grado:", "Área:" y "Tema:".
 *
 * Si no puede extraer todos los campos, retorna null (=> usar hash completo).
 */
function extractSemanticKey(prompt) {
  const lower = prompt.toLowerCase();
  const get = (label) => {
    const idx = lower.indexOf(`${label}:`);
    if (idx === -1) return null;
    const rest = prompt.slice(idx + label.length + 1).split("\n")[0].trim();
    return rest.toLowerCase().replace(/\s+/g, " ").slice(0, 80);
  };

  const nivel      = get("nivel");
  const grado      = get("grado");
  const area       = get("área") || get("area");
  const asignatura = get("asignatura");
  const tema       = get("tema");

  // Necesitamos al menos nivel+grado+tema para una clave útil
  if (!nivel || !grado || !tema) return null;

  const parts = [nivel, grado, area, asignatura, tema].filter(Boolean);
  return parts.join("|");
}

/**
 * Busca una respuesta cacheada.
 * Intenta primero clave semántica (si el módulo la soporta), luego clave completa.
 *
 * @param {string} module
 * @param {string} prompt
 * @param {{ semantic?: boolean }} [opts]
 * @returns {Promise<string|null>}
 */
export async function getCached(module, prompt, opts = {}) {
  try {
    const useSemantic = opts.semantic !== false;
    // F2.2 — el SYSTEM participa en la clave: editar la doctrina invalida lo
    // cacheado (antes podían servirse respuestas pre-doctrina hasta 7 días)
    const sys = String(opts.system || "");
    const semanticPart = useSemantic ? extractSemanticKey(prompt) : null;
    const rawPart = await claveCompuesta(sys, prompt);

    // Intentar con clave semántica primero (mayor hit rate entre docentes)
    if (semanticPart) {
      const semKey  = `${module}:sem:${await claveCompuesta(sys, semanticPart)}`;
      const semSnap = await getDoc(doc(db, "aiCache", semKey));
      if (semSnap.exists()) {
        const semData = semSnap.data();
        if (!semData.expiresAt || semData.expiresAt.toMillis() >= Date.now()) {
          return semData.response || null;
        }
      }
    }

    // Fallback: clave por hash completo del prompt
    const key  = `${module}:${rawPart}`;
    const snap = await getDoc(doc(db, "aiCache", key));
    if (!snap.exists()) return null;

    const data = snap.data();
    if (data.expiresAt && data.expiresAt.toMillis() < Date.now()) return null;

    return data.response || null;
  } catch {
    return null;
  }
}

/**
 * Guarda una respuesta en cache.
 * Escribe AMBAS claves (semántica + hash completo) cuando aplica,
 * para que futuras búsquedas encuentren la semántica primero.
 *
 * @param {string} module
 * @param {string} prompt
 * @param {string} response
 * @param {number} [ttlHours=24]
 */
export async function setCached(module, prompt, response, ttlHours = 24, system = "") {
  try {
    const sys = String(system || "");
    const expiresAt   = new Date(Date.now() + ttlHours * 3_600_000);
    const basePayload = { module, response, createdAt: serverTimestamp(), expiresAt, ttlHours };

    const writes = [];

    // Clave hash completo (siempre)
    const rawKey = `${module}:${await claveCompuesta(sys, prompt)}`;
    writes.push(setDoc(doc(db, "aiCache", rawKey), basePayload, { merge: true }));

    // Clave semántica (cuando aplica)
    const semanticPart = extractSemanticKey(prompt);
    if (semanticPart) {
      const semKey = `${module}:sem:${await claveCompuesta(sys, semanticPart)}`;
      writes.push(setDoc(doc(db, "aiCache", semKey), { ...basePayload, semanticKey: semanticPart }, { merge: true }));
    }

    await Promise.all(writes);
  } catch {
    // errores de cache son no-fatales
  }
}
