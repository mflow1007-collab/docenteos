const BASE_URL = "https://libroabierto-be.azurewebsites.net";
const PDF_URL_TTL_MS = 60 * 60 * 1000;
const PDF_RANGE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const PDF_RANGE_CACHE_MAX_BYTES = 64 * 1024 * 1024;
const PDF_RANGE_CACHE_MAX_CHUNK_BYTES = 2 * 1024 * 1024;
const pdfUrlCache = new Map();
const pdfRangeCache = new Map();
let pdfRangeCacheBytes = 0;

function getCredential(name) {
  if (!name || !/^[A-Z0-9_]+$/i.test(name)) return null;
  return process.env[name] || null;
}

async function readJson(response, label) {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(`${label} respondió vacío (${response.status})`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} no devolvió JSON válido: ${text.slice(0, 160)}`, { cause: error });
  }
}

function extractToken(loginData) {
  return (
    loginData?.data?.token ||
    loginData?.token ||
    loginData?.accessToken ||
    loginData?.data?.accessToken ||
    null
  );
}

function isValidBookId(value) {
  return /^[a-z0-9-]{12,}$/i.test(String(value || ""));
}

function normalizeBookId(value) {
  return String(value || "").trim().replace(/^libro-abierto-/i, "");
}

async function loginLibroAbierto() {
  const username = getCredential("LIBRO_ABIERTO_USER");
  const password = getCredential("LIBRO_ABIERTO_PASSWORD");

  if (!username || !password) {
    throw new Error("Configura LIBRO_ABIERTO_USER y LIBRO_ABIERTO_PASSWORD en el servidor.");
  }

  const loginResponse = await fetch(`${BASE_URL}/api/Auth/Login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Origin": "https://libroabierto.minerd.gob.do",
    },
    body: JSON.stringify({ email: username, password }),
  });
  const loginData = await readJson(loginResponse, "Login Libro Abierto");
  if (!loginResponse.ok) {
    throw new Error(loginData?.message || loginData?.data || "Credenciales rechazadas por Libro Abierto.");
  }

  const token = extractToken(loginData);
  if (!token) {
    throw new Error("Libro Abierto no devolvió token.");
  }
  return token;
}

async function getBookDetail(bookId, token) {
  const response = await fetch(`${BASE_URL}/api/Book/${bookId}`, {
    headers: {
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
      "Origin": "https://libroabierto.minerd.gob.do",
    },
  });
  const data = await readJson(response, "Detalle Libro Abierto");
  if (!response.ok) {
    throw new Error(data?.message || data?.data || `Libro Abierto respondió ${response.status}`);
  }
  return data?.data || data;
}

function getPdfUrl(detail) {
  return detail?.pdfCode || detail?.pdfUrl || detail?.fileUrl || detail?.bookUrl || detail?.documentUrl || "";
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

function getCachedPdfUrl(bookId) {
  const cached = pdfUrlCache.get(bookId);
  if (!cached) return "";
  if (cached.expiresAt <= Date.now()) {
    pdfUrlCache.delete(bookId);
    return "";
  }
  return cached.url;
}

function setCachedPdfUrl(bookId, url) {
  pdfUrlCache.set(bookId, {
    url,
    expiresAt: Date.now() + PDF_URL_TTL_MS,
  });
}

function getRangeCacheKey(pdfUrl, range) {
  return `${pdfUrl}::${range || "full"}`;
}

function getCachedRange(pdfUrl, range) {
  const key = getRangeCacheKey(pdfUrl, range);
  const cached = pdfRangeCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    pdfRangeCache.delete(key);
    pdfRangeCacheBytes -= cached.size;
    return null;
  }
  pdfRangeCache.delete(key);
  pdfRangeCache.set(key, cached);
  return cached;
}

function trimRangeCache() {
  while (pdfRangeCacheBytes > PDF_RANGE_CACHE_MAX_BYTES && pdfRangeCache.size) {
    const [oldestKey, oldest] = pdfRangeCache.entries().next().value;
    pdfRangeCache.delete(oldestKey);
    pdfRangeCacheBytes -= oldest.size;
  }
}

function setCachedRange(pdfUrl, range, payload) {
  if (!range || !payload?.body || payload.body.length > PDF_RANGE_CACHE_MAX_CHUNK_BYTES) return;
  const key = getRangeCacheKey(pdfUrl, range);
  const previous = pdfRangeCache.get(key);
  if (previous) {
    pdfRangeCacheBytes -= previous.size;
    pdfRangeCache.delete(key);
  }
  const cached = {
    ...payload,
    size: payload.body.length,
    expiresAt: Date.now() + PDF_RANGE_CACHE_TTL_MS,
  };
  pdfRangeCache.set(key, cached);
  pdfRangeCacheBytes += cached.size;
  trimRangeCache();
}

async function resolvePdfUrl(bookId) {
  const cachedUrl = getCachedPdfUrl(bookId);
  if (cachedUrl) return cachedUrl;

  const token = await loginLibroAbierto();
  const detail = await getBookDetail(bookId, token);
  const pdfUrl = getPdfUrl(detail);

  if (!pdfUrl) {
    const error = new Error("Libro Abierto no devolvió una URL de PDF para este libro.");
    error.statusCode = 404;
    throw error;
  }

  if (!isHttpUrl(pdfUrl)) {
    const error = new Error("Libro Abierto devolvió una URL de PDF inválida.");
    error.statusCode = 502;
    throw error;
  }

  setCachedPdfUrl(bookId, pdfUrl);
  return pdfUrl;
}

function redirectToPdf(pdfUrl, res) {
  res.statusCode = 302;
  res.setHeader("Location", pdfUrl);
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.setHeader("X-DocenteOS-Source", "Libro Abierto MINERD");
  return res.end();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseContentRange(value) {
  const match = String(value || "").match(/\/(\d+)\s*$/);
  return match ? Number(match[1]) : 0;
}

async function getPdfLength(pdfUrl) {
  const rangeResponse = await fetch(pdfUrl, {
    headers: {
      "Accept": "application/pdf,*/*",
      "Range": "bytes=0-0",
      "User-Agent": "DocenteOS-Lector/1.0",
    },
  });
  const rangeLength = parseContentRange(rangeResponse.headers.get("content-range"));
  if (rangeLength > 0) return rangeLength;

  const headResponse = await fetch(pdfUrl, {
    method: "HEAD",
    headers: {
      "Accept": "application/pdf,*/*",
      "User-Agent": "DocenteOS-Lector/1.0",
    },
  });
  const headLength = Number(headResponse.headers.get("content-length") || 0);
  if (headResponse.ok && headLength > 0) return headLength;

  throw new Error("No fue posible determinar el tamaño del PDF.");
}

function renderViewer({ fallbackUrl, pdfLength, title }, res) {
  const pdfSource = JSON.stringify(fallbackUrl);
  const pdfSize = Number(pdfLength || 0);
  const viewerTitle = escapeHtml(title || "Libro Abierto MINERD");
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "private, max-age=3600");
  return res.end(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${viewerTitle}</title>
  <style>
    html, body { min-height: 100%; margin: 0; background: #e5e7eb; color: #111827; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { display: grid; grid-template-rows: auto 1fr; }
    .toolbar { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px; background: #0f172a; color: #ffffff; box-shadow: 0 2px 12px rgba(15, 23, 42, 0.24); }
    .toolbar strong { max-width: 38vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
    button, a { min-height: 34px; border: 1px solid #334155; border-radius: 8px; padding: 0 10px; background: #ffffff; color: #0f172a; font: inherit; font-size: 13px; font-weight: 800; text-decoration: none; cursor: pointer; }
    button:disabled { opacity: 0.45; cursor: default; }
    .page-label { min-width: 92px; text-align: center; font-size: 13px; font-weight: 800; }
    .stage { min-height: 0; overflow: auto; padding: 18px; text-align: center; }
    canvas { max-width: 100%; height: auto; background: #ffffff; box-shadow: 0 10px 26px rgba(15, 23, 42, 0.2); }
    .status { margin: 64px auto; max-width: 420px; color: #475569; font-weight: 800; }
    @media (max-width: 700px) {
      .toolbar { flex-wrap: wrap; }
      .toolbar strong { order: -1; flex-basis: 100%; max-width: 100%; text-align: center; }
      .stage { padding: 10px; }
    }
  </style>
</head>
<body>
  <header class="toolbar">
    <strong>${viewerTitle}</strong>
    <button id="prev" type="button">Anterior</button>
    <span class="page-label"><span id="pageNum">1</span> / <span id="pageCount">...</span></span>
    <button id="next" type="button">Siguiente</button>
    <button id="zoomOut" type="button">-</button>
    <button id="zoomIn" type="button">+</button>
  </header>
  <main class="stage">
    <p id="status" class="status">Cargando lector...</p>
    <canvas id="pageCanvas"></canvas>
  </main>
  <script type="module">
    import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs";
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";

    const source = ${pdfSource};
    const canvas = document.getElementById("pageCanvas");
    const context = canvas.getContext("2d");
    const status = document.getElementById("status");
    const pageNum = document.getElementById("pageNum");
    const pageCount = document.getElementById("pageCount");
    const prev = document.getElementById("prev");
    const next = document.getElementById("next");
    const zoomOut = document.getElementById("zoomOut");
    const zoomIn = document.getElementById("zoomIn");

    let pdf = null;
    let currentPage = 1;
    let scale = Math.min(1.15, Math.max(0.72, (window.innerWidth - 48) / 900));
    let rendering = false;
    let pendingPage = null;

    function updateButtons() {
      prev.disabled = !pdf || currentPage <= 1 || rendering;
      next.disabled = !pdf || currentPage >= pdf.numPages || rendering;
      zoomOut.disabled = rendering || scale <= 0.55;
      zoomIn.disabled = rendering || scale >= 1.8;
    }

    async function renderPage(number) {
      rendering = true;
      updateButtons();
      status.textContent = "Cargando pagina " + number + "...";
      status.hidden = false;

      const page = await pdf.getPage(number);
      const viewport = page.getViewport({ scale });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await page.render({ canvasContext: context, viewport }).promise;

      currentPage = number;
      pageNum.textContent = String(currentPage);
      status.hidden = true;
      rendering = false;
      updateButtons();

      if (pendingPage !== null) {
        const nextPage = pendingPage;
        pendingPage = null;
        renderPage(nextPage);
      }
    }

    function queueRender(number) {
      const bounded = Math.min(Math.max(number, 1), pdf.numPages);
      if (rendering) {
        pendingPage = bounded;
        return;
      }
      renderPage(bounded).catch(showError);
    }

    function showError(error) {
      rendering = false;
      updateButtons();
      status.hidden = false;
      status.textContent = "No fue posible mostrar este libro. " + (error?.message || error?.name || "");
      console.error(error);
    }

    prev.addEventListener("click", () => queueRender(currentPage - 1));
    next.addEventListener("click", () => queueRender(currentPage + 1));
    zoomOut.addEventListener("click", () => {
      scale = Math.max(0.55, scale - 0.1);
      queueRender(currentPage);
    });
    zoomIn.addEventListener("click", () => {
      scale = Math.min(1.8, scale + 0.1);
      queueRender(currentPage);
    });

    class DocenteOSRangeTransport extends pdfjsLib.PDFDataRangeTransport {
      requestDataRange(begin, end) {
        fetch(source, {
          headers: { Range: "bytes=" + begin + "-" + (end - 1) },
        })
          .then((response) => {
            if (!response.ok && response.status !== 206) {
              throw new Error("Rango no disponible: " + response.status);
            }
            return response.arrayBuffer();
          })
          .then((buffer) => this.onDataRange(begin, new Uint8Array(buffer)))
          .catch(showError);
      }
    }

    const transport = new DocenteOSRangeTransport(${pdfSize}, null);
    transport.transportReady();

    pdfjsLib.getDocument({
      range: transport,
      disableAutoFetch: true,
      disableStream: true,
      disableWorker: true,
      rangeChunkSize: 65536,
    }).promise.then((loadedPdf) => {
      pdf = loadedPdf;
      pageCount.textContent = String(pdf.numPages);
      queueRender(1);
    }).catch(showError);
  </script>
</body>
</html>`);
}

async function streamPdf(pdfUrl, req, res, options = {}) {
  const range = req.headers?.range || (options.forceRange ? "bytes=0-65535" : "");
  const cached = getCachedRange(pdfUrl, range);

  if (cached) {
    res.statusCode = cached.statusCode;
    Object.entries(cached.headers).forEach(([name, value]) => {
      if (value) res.setHeader(name, value);
    });
    res.setHeader("X-DocenteOS-Cache", "HIT");
    if (req.method === "HEAD") return res.end();
    return res.end(cached.body);
  }

  const response = await fetch(pdfUrl, {
    headers: {
      "Accept": "application/pdf,*/*",
      "User-Agent": "DocenteOS-Lector/1.0",
      ...(range ? { Range: range } : {}),
    },
  });

  if (!response.ok && response.status !== 206) {
    throw new Error(`No fue posible descargar el PDF (${response.status}).`);
  }

  res.statusCode = response.status === 206 ? 206 : 200;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "inline");
  res.setHeader("Cache-Control", "private, max-age=21600");
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("X-DocenteOS-Source", "Libro Abierto MINERD");
  res.setHeader("X-DocenteOS-Cache", "MISS");

  if (response.headers.get("content-length")) {
    res.setHeader("Content-Length", response.headers.get("content-length"));
  }
  if (response.headers.get("content-range")) {
    res.setHeader("Content-Range", response.headers.get("content-range"));
  }
  if (response.headers.get("etag")) {
    res.setHeader("ETag", response.headers.get("etag"));
  }
  if (response.headers.get("last-modified")) {
    res.setHeader("Last-Modified", response.headers.get("last-modified"));
  }

  if (req.method === "HEAD") {
    return res.end();
  }

  const cacheHeaders = {
    "Content-Type": "application/pdf",
    "Content-Disposition": "inline",
    "Cache-Control": "private, max-age=21600",
    "Accept-Ranges": "bytes",
    "X-DocenteOS-Source": "Libro Abierto MINERD",
    "Content-Length": response.headers.get("content-length") || "",
    "Content-Range": response.headers.get("content-range") || "",
    "ETag": response.headers.get("etag") || "",
    "Last-Modified": response.headers.get("last-modified") || "",
  };

  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer());
    setCachedRange(pdfUrl, range, {
      statusCode: res.statusCode,
      headers: cacheHeaders,
      body: buffer,
    });
    return res.end(buffer);
  }

  if (range) {
    const buffer = Buffer.from(await response.arrayBuffer());
    setCachedRange(pdfUrl, range, {
      statusCode: res.statusCode,
      headers: cacheHeaders,
      body: buffer,
    });
    return res.end(buffer);
  }

  const { Readable } = await import("node:stream");
  return Readable.fromWeb(response.body).pipe(res);
}

export default async function handler(req, res) {
  if (!["GET", "HEAD"].includes(req.method)) {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const reqUrl = new URL(req.url || "", "http://localhost");
    const bookId = normalizeBookId(req.query?.id || reqUrl.searchParams.get("id"));

    if (!isValidBookId(bookId)) {
      return res.status(400).json({ error: "ID de libro inválido" });
    }

    const stream = req.query?.stream === "1" || reqUrl.searchParams.get("stream") === "1";
    const viewer = req.query?.viewer === "1" || reqUrl.searchParams.get("viewer") === "1";
    const rangeMode = req.query?.range === "1" || reqUrl.searchParams.get("range") === "1";
    const pdfUrl = await resolvePdfUrl(bookId);

    if (viewer) {
      const fallbackUrl = `/api/materiales/libro-abierto-pdf?id=${encodeURIComponent(bookId)}&stream=1`;
      const pdfLength = await getPdfLength(pdfUrl);
      return renderViewer({ fallbackUrl, pdfLength, title: req.query?.title || reqUrl.searchParams.get("title") }, res);
    }
    if (stream) {
      return streamPdf(pdfUrl, req, res, { forceRange: rangeMode });
    }
    return redirectToPdf(pdfUrl, res);
  } catch (error) {
    const statusCode = error?.statusCode || 500;
    return res.status(statusCode).json({
      error: "No fue posible abrir el libro en DocenteOS",
      detail: error?.message || String(error),
    });
  }
}
