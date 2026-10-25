import http from "node:http";
import https from "node:https";
import { verificarAdmin } from "../_firebaseAuth.js";

const MAX_CHARS = 600000;

// Credenciales que este endpoint puede usar y los ÚNICOS dominios a los que
// puede enviarlas. Antes el cliente elegía el NOMBRE de cualquier variable de
// entorno (p. ej. ANTHROPIC_API_KEY) y el servidor la mandaba a cualquier URL.
const CREDENCIALES_PERMITIDAS = {
  LIBRO_ABIERTO_USER: ["libroabierto.minerd.gob.do"],
  LIBRO_ABIERTO_PASSWORD: ["libroabierto.minerd.gob.do"],
};

const normalizarHost = (hostname = "") => String(hostname).toLowerCase().replace(/^www\./, "");

// Defensa básica contra SSRF: no consultar el propio servidor ni redes privadas.
export function esHostPublico(hostname = "") {
  const host = normalizarHost(hostname).replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (host === "::1" || host === "::" || /^f[cd][0-9a-f]{2}:/.test(host) || /^fe80:/.test(host)) return false;
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 0 || a === 10 || a === 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
  }
  return true;
}

function normalizeText(input) {
  return String(input || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_CHARS);
}

function getTitle(html) {
  const match = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? normalizeText(match[1]).slice(0, 180) : "";
}

function hashText(text) {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function isValidUrl(url) {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) && esHostPublico(parsed.hostname);
  } catch {
    return false;
  }
}

function getCredential(name, hostname) {
  const dominios = CREDENCIALES_PERMITIDAS[name];
  if (!dominios) throw new Error(`Credencial no permitida: ${String(name || "").slice(0, 60)}`);
  if (!dominios.includes(normalizarHost(hostname))) {
    throw new Error("Esa credencial solo puede enviarse a su dominio oficial");
  }
  return process.env[name] || null;
}

// Exportadas solo para scripts/test-seguridad-api.mjs (Vercel usa el default).
export function buildAuthHeaders(auth = {}, hostname = "") {
  if (!auth || auth.type === "none") return {};

  if (auth.type === "basic") {
    const username = getCredential(auth.usernameEnv, hostname);
    const password = getCredential(auth.passwordEnv, hostname);
    if (!username || !password) {
      throw new Error("Credenciales Basic Auth no configuradas en variables de entorno");
    }
    const encoded = Buffer.from(`${username}:${password}`).toString("base64");
    return { Authorization: `Basic ${encoded}` };
  }

  if (auth.type === "bearer") {
    const token = getCredential(auth.tokenEnv, hostname);
    if (!token) {
      throw new Error("Token Bearer no configurado en variables de entorno");
    }
    return { Authorization: `Bearer ${token}` };
  }

  throw new Error(`Tipo de autenticación no soportado: ${auth.type}`);
}

function absoluteUrl(url = "", base = "") {
  try {
    return new URL(url, base || undefined).href;
  } catch {
    return "";
  }
}

function shouldAllowEducandoTlsFallback(url = "") {
  try {
    return new URL(url).hostname.replace(/^www\./, "") === "educando.edu.do";
  } catch {
    return false;
  }
}

function requestText(url, headers = {}, redirects = 0) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === "http:" ? http : https;
    const req = client.request(
      parsed,
      {
        method: "GET",
        headers,
        rejectUnauthorized: !shouldAllowEducandoTlsFallback(url),
      },
      (response) => {
        const location = response.headers.location ? absoluteUrl(response.headers.location, url) : "";
        if ([301, 302, 303, 307, 308].includes(response.statusCode) && location && redirects < 5) {
          response.resume();
          requestText(location, headers, redirects + 1).then(resolve, reject);
          return;
        }

        let text = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          text += chunk;
        });
        response.on("end", () => {
          resolve({
            ok: response.statusCode >= 200 && response.statusCode < 300,
            status: response.statusCode,
            url,
            text,
          });
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(20000, () => {
      req.destroy(new Error(`Timeout al consultar ${url}`));
    });
    req.end();
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido" });
  }

  const acceso = await verificarAdmin(req.headers?.authorization);
  if (!acceso.ok) {
    return res.status(acceso.status).json({ error: acceso.error });
  }

  try {
    const { url, auth } = req.body || {};
    if (!isValidUrl(url)) {
      return res.status(400).json({ error: "URL inválida" });
    }

    let authHeaders;
    try {
      authHeaders = buildAuthHeaders(auth, new URL(url).hostname);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }

    const headers = {
      "User-Agent": "DocenteOS-Monitor/1.0 (+https://docenteos.com)",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5",
      ...authHeaders,
    };
    let result;
    try {
      const response = await fetch(url, {
        headers,
        redirect: "follow",
      });
      result = {
        ok: response.ok,
        status: response.status,
        url: response.url || url,
        text: await response.text(),
      };
    } catch (error) {
      if (error?.cause?.code !== "UNABLE_TO_VERIFY_LEAF_SIGNATURE" || !shouldAllowEducandoTlsFallback(url)) {
        throw error;
      }
      result = await requestText(url, headers);
    }

    const raw = result.text;
    const title = getTitle(raw);
    const normalized = normalizeText(raw);
    const hash = hashText(normalized);

    return res.status(200).json({
      ok: result.ok,
      status: result.status,
      url: result.url || url,
      title,
      hash,
      excerpt: normalized.slice(0, 1200),
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      error: "No fue posible revisar la fuente",
      detail: error?.message || String(error),
    });
  }
}
