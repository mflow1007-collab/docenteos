/**
 * Verificación de Firebase ID Token compartida por los endpoints de /api.
 *
 * El prefijo "_" hace que Vercel NO publique este archivo como función
 * (docs: "Files that start with an underscore" no se convierten en funciones).
 *
 * Funciona en Edge y en Node (≥18): solo usa fetch, crypto.subtle y atob.
 * Requiere FIREBASE_PROJECT_ID en las variables de entorno del servidor.
 */

// ─── Verificación de Firebase ID Token ───────────────────────────────────────
// Implementada con Web Crypto API.
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
 * @returns {{ uid: string, email: string, emailVerified: boolean } | null}
 */
export async function verifyFirebaseToken(token) {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    if (!projectId) {
      console.error("[Auth] FIREBASE_PROJECT_ID no está configurado en las variables de entorno del servidor");
      return null;
    }

    const parts = String(token || "").split(".");
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

// Cuenta administradora principal: acceso completo por email EXACTO, sin
// exigir verificación (la cuenta ya existe en Firebase Auth — nadie más puede
// registrar ese correo). El requisito email_verified aplica solo al resto
// del dominio, que es donde estaba el hueco de la auditoría.
const ADMIN_EMAILS = new Set(["admin@docenteos.com"]);

export function isAdminUser(authedUser) {
  const email = (authedUser?.email || "").toLowerCase();
  if (ADMIN_EMAILS.has(email)) return true;
  return /@docenteos\.com$/.test(email) && authedUser?.emailVerified === true;
}

/**
 * Exige un token válido de administrador a partir del header Authorization.
 * Sirve para Edge (request.headers.get) y Node (req.headers.authorization).
 * @returns {Promise<{ ok: true, user: object } | { ok: false, status: number, error: string }>}
 */
export async function verificarAdmin(authHeader) {
  const header = String(authHeader || "");
  const idToken = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!idToken) return { ok: false, status: 401, error: "No autorizado" };

  const user = await verifyFirebaseToken(idToken);
  if (!user) return { ok: false, status: 401, error: "Token inválido o expirado" };
  if (!isAdminUser(user)) return { ok: false, status: 403, error: "Este recurso es exclusivo de administradores." };

  return { ok: true, user };
}
