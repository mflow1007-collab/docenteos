/**
 * Cuota diaria de IA por docente (Etapa S+), contada en el servidor.
 *
 * El prefijo "_" hace que Vercel NO publique este archivo como función.
 *
 * El contador vive en aiCuotas/{uid}_{AAAA-MM-DD} y solo lo escribe el
 * servidor con una cuenta de servicio dedicada (las reglas cierran la
 * colección a los clientes). Un único `commit` de la API REST de Firestore
 * incrementa y devuelve el valor nuevo: atómico, sin transacción aparte.
 *
 * Funciona en Edge y en Node (≥18): solo usa fetch, crypto.subtle y atob.
 * Requiere en el servidor:
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL  — client_email de la cuenta de servicio
 *   FIREBASE_PRIVATE_KEY   — private_key (PEM; los saltos de línea pueden venir como \n)
 */

export const CUOTA_DIARIA_DEFECTO = 200;
export const CODIGO_CUOTA_AGOTADA = "CUOTA_IA_AGOTADA";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/datastore";
const DIAS_RETENCION = 7; // expiraEn: para una política TTL opcional en la consola

let _token = null;
let _tokenExpira = 0;

/** Solo para pruebas: olvida el token OAuth en memoria. */
export function invalidarTokenServicio() {
  _token = null;
  _tokenExpira = 0;
}

/** Límite efectivo: config/ia-gateway.cuotaDiariaIA si es un entero > 0. */
export function limiteDiario(config) {
  const n = Number(config?.cuotaDiariaIA);
  return Number.isInteger(n) && n > 0 ? n : CUOTA_DIARIA_DEFECTO;
}

/** Fecha AAAA-MM-DD en hora de República Dominicana (UTC−4, sin horario de verano). */
export function fechaRD(ahora = Date.now()) {
  return new Date(ahora - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const b64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64urlTexto = (texto) => b64url(new TextEncoder().encode(texto));

async function importarClavePrivada(pem) {
  const cuerpo = String(pem)
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(cuerpo), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"],
  );
}

/** Token OAuth de la cuenta de servicio (en memoria hasta ~5 min antes de expirar). */
async function tokenServicio() {
  const now = Date.now();
  if (_token && now < _tokenExpira) return _token;

  const email = process.env.FIREBASE_CLIENT_EMAIL;
  const pem = process.env.FIREBASE_PRIVATE_KEY;
  if (!email || !pem) throw new Error("FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY no están configuradas");

  const iat = Math.floor(now / 1000);
  const header = b64urlTexto(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64urlTexto(JSON.stringify({ iss: email, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600 }));
  const clave = await importarClavePrivada(pem);
  const firma = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", clave, new TextEncoder().encode(`${header}.${claims}`));

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${b64url(firma)}`,
    }).toString(),
  });
  if (!res.ok) throw new Error(`Canje del token de servicio: HTTP ${res.status}`);
  const { access_token: accessToken, expires_in: expiresIn } = await res.json();
  if (!accessToken) throw new Error("Canje del token de servicio sin access_token");

  _token = accessToken;
  _tokenExpira = now + Math.max(60, (Number(expiresIn) || 3600) - 300) * 1000;
  return _token;
}

/**
 * Suma 1 al contador del día y devuelve el total usado (incluida esta petición).
 * LANZA si falta la cuenta de servicio o Firestore falla: el llamador responde
 * 503 (fail-closed).
 */
export async function incrementarCuota(uid, ahora = Date.now()) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("FIREBASE_PROJECT_ID no está configurado");
  if (!uid) throw new Error("uid requerido para la cuota");

  const fecha = fechaRD(ahora);
  const base = `projects/${projectId}/databases/(default)`;
  const nombre = `${base}/documents/aiCuotas/${uid}_${fecha}`;
  const expiraEn = new Date(ahora + DIAS_RETENCION * 24 * 60 * 60 * 1000).toISOString();

  const res = await fetch(`https://firestore.googleapis.com/v1/${base}/documents:commit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await tokenServicio()}` },
    body: JSON.stringify({
      writes: [{
        update: {
          name: nombre,
          fields: {
            uid:      { stringValue: uid },
            fecha:    { stringValue: fecha },
            expiraEn: { timestampValue: expiraEn },
          },
        },
        updateMask: { fieldPaths: ["uid", "fecha", "expiraEn"] },
        updateTransforms: [
          { fieldPath: "usadas", increment: { integerValue: "1" } },
          { fieldPath: "actualizadoEn", setToServerValue: "REQUEST_TIME" },
        ],
      }],
    }),
  });
  if (!res.ok) throw new Error(`Contador de cuota: Firestore respondió HTTP ${res.status}`);

  const data = await res.json();
  const usadas = Number(data?.writeResults?.[0]?.transformResults?.[0]?.integerValue);
  if (!Number.isFinite(usadas)) throw new Error("Contador de cuota: respuesta sin valor");
  return usadas;
}
