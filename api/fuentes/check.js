import http from "node:http";
import https from "node:https";

const MAX_CHARS = 600000;

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
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function getCredential(name) {
  if (!name || !/^[A-Z0-9_]+$/i.test(name)) return null;
  return process.env[name] || null;
}

function buildAuthHeaders(auth = {}) {
  if (!auth || auth.type === "none") return {};

  if (auth.type === "basic") {
    const username = getCredential(auth.usernameEnv);
    const password = getCredential(auth.passwordEnv);
    if (!username || !password) {
      throw new Error("Credenciales Basic Auth no configuradas en variables de entorno");
    }
    const encoded = Buffer.from(`${username}:${password}`).toString("base64");
    return { Authorization: `Basic ${encoded}` };
  }

  if (auth.type === "bearer") {
    const token = getCredential(auth.tokenEnv);
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

  try {
    const { url, auth } = req.body || {};
    if (!isValidUrl(url)) {
      return res.status(400).json({ error: "URL inválida" });
    }

    const authHeaders = buildAuthHeaders(auth);

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
