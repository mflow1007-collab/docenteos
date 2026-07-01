import http from "node:http";
import https from "node:https";

const BASE_URL = "https://educando.edu.do";
const PORTAL_URL = `${BASE_URL}/portal/`;

const SEED_URLS = [
  `${PORTAL_URL}adecuaciones-curriculares-del-nivel-primario-y-secundario/`,
  `${PORTAL_URL}diseno-curricular/`,
  `${PORTAL_URL}curriculo/`,
  `${PORTAL_URL}nivel-inicial/`,
  `${PORTAL_URL}nivel-primario/`,
  `${PORTAL_URL}nivel-secundario/`,
  `${PORTAL_URL}registros-del-nivel-primario-version-preliminar/`,
  `${PORTAL_URL}libros-de-registros-del-nivel-secundario-2023-2024/`,
  `${PORTAL_URL}fasciculos-educativos/`,
  `${PORTAL_URL}secuencias-didacticas-del-nivel-primario/`,
  `${PORTAL_URL}informes-de-aprendizajes-del-nivel-primario/`,
];

const DOCUMENT_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "ppt",
  "pptx",
  "xls",
  "xlsx",
  "zip",
];

function decodeHtml(value = "") {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8211;/g, "-")
    .replace(/&#8212;/g, "-")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripHtml(value = "") {
  return decodeHtml(String(value).replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(url = "", base = PORTAL_URL) {
  const clean = decodeHtml(url).trim();
  if (!clean || clean.startsWith("#") || clean.startsWith("mailto:") || clean.startsWith("tel:")) return "";
  try {
    return new URL(clean, base).href.replace("/portal//", "/portal/");
  } catch {
    return "";
  }
}

function getTitle(html = "") {
  const title = String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return stripHtml(title || "Educando");
}

function currentYear() {
  return new Date().getFullYear();
}

function getExtension(url = "") {
  const pathname = (() => {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  })();
  const match = pathname.match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : "";
}

function isDocumentUrl(url = "") {
  return DOCUMENT_EXTENSIONS.includes(getExtension(url));
}

function isEducandoUrl(url = "") {
  try {
    return new URL(url).hostname.replace(/^www\./, "") === "educando.edu.do";
  } catch {
    return false;
  }
}

function isNavigationUrl(url = "") {
  try {
    const path = new URL(url).pathname;
    return /\/(tag|category)\//i.test(path);
  } catch {
    return false;
  }
}

function inferNivel(text = "") {
  const value = text.toLowerCase();
  if (/inicial|pre.?primario|pre-kinder|kinder/.test(value)) return "Inicial";
  if (/primario|primaria|primer ciclo|segundo ciclo/.test(value)) return "Primario";
  if (/secundario|secundaria/.test(value)) return "Secundario";
  return "";
}

function inferTipo(text = "", url = "") {
  const value = `${text} ${url}`.toLowerCase();
  if (/adecuaci[oó]n/.test(value)) return "adecuacion_curricular";
  if (/dise[nñ]o-curricular|dise[nñ]o curricular|curriculo|curr[ií]culo/.test(value)) return "diseno_curricular";
  if (/registro/.test(value)) return "registro";
  if (/ordenanza/.test(value)) return "ordenanza";
  if (/secuencia/.test(value)) return "secuencia_didactica";
  if (/fasc[ií]culo/.test(value)) return "fasciculo";
  if (/informe/.test(value)) return "informe";
  if (/calendario/.test(value)) return "calendario";
  if (/gu[ií]a|orientaci[oó]n/.test(value)) return "guia";
  return isDocumentUrl(url) ? "documento" : "recurso_web";
}

function inferAsignatura(text = "") {
  const value = text.toLowerCase();
  const areas = [
    "Lengua Española",
    "Matemática",
    "Ciencias Sociales",
    "Ciencias de la Naturaleza",
    "Educación Artística",
    "Educación Física",
    "Formación Integral Humana y Religiosa",
    "Inglés",
    "Francés",
  ];
  return areas.find((area) => value.includes(area.toLowerCase())) || "";
}

function extractAnchors(html = "", pageUrl = PORTAL_URL) {
  const anchors = [];
  const regex = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(html))) {
    const attrs = match[1] || "";
    const href = attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1] || "";
    const url = absoluteUrl(href, pageUrl);
    if (!url || !isEducandoUrl(url)) continue;

    const imgAlt = match[2]?.match(/<img\b[^>]*\balt\s*=\s*["']([^"']+)["']/i)?.[1] || "";
    const titleAttr = attrs.match(/\btitle\s*=\s*["']([^"']+)["']/i)?.[1] || "";
    const ariaLabel = attrs.match(/\baria-label\s*=\s*["']([^"']+)["']/i)?.[1] || "";
    const label = stripHtml(match[2] || "") || stripHtml(imgAlt || titleAttr || ariaLabel);
    const portadaUrl = extractImageFromHtml(match[2] || "", pageUrl);
    anchors.push({ url, label, portadaUrl });
  }
  return anchors;
}

function extractAttr(html = "", attr = "") {
  const escaped = attr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.match(new RegExp(`\\b${escaped}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1] || "";
}

function pickBestSrcset(srcset = "") {
  const candidates = decodeHtml(srcset)
    .split(",")
    .map((entry) => {
      const [url = "", descriptor = ""] = entry.trim().split(/\s+/);
      const width = Number(descriptor.match(/^(\d+)w$/i)?.[1] || 0);
      const density = Number(descriptor.match(/^(\d+(?:\.\d+)?)x$/i)?.[1] || 0);
      return { url, score: width || density * 1000 || 1 };
    })
    .filter((item) => item.url);

  return candidates.sort((a, b) => b.score - a.score)[0]?.url || "";
}

function extractImageFromTag(imgTag = "", pageUrl = PORTAL_URL) {
  const srcset = extractAttr(imgTag, "srcset") ||
    extractAttr(imgTag, "data-srcset") ||
    extractAttr(imgTag, "data-lazy-srcset");
  const direct = extractAttr(imgTag, "data-full-url") ||
    extractAttr(imgTag, "data-large-file") ||
    extractAttr(imgTag, "data-src") ||
    extractAttr(imgTag, "data-lazy-src") ||
    extractAttr(imgTag, "data-original") ||
    extractAttr(imgTag, "src");
  return absoluteUrl(pickBestSrcset(srcset) || direct, pageUrl);
}

function extractImageFromHtml(html = "", pageUrl = PORTAL_URL) {
  const tags = String(html).match(/<img\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const image = extractImageFromTag(tag, pageUrl);
    if (image) return image;
  }
  return "";
}

function extractMetaContent(html = "", property = "") {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escaped}["'][^>]*>`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtml(match[1]);
  }
  return "";
}

function extractSourceDate({ text = "", url = "", html = "" } = {}) {
  const values = [];
  const combined = `${text} ${url}`;
  const metaDate = extractMetaContent(html, "article:modified_time") ||
    extractMetaContent(html, "article:published_time") ||
    extractMetaContent(html, "dateModified") ||
    extractMetaContent(html, "datePublished");
  const metaTimestamp = Date.parse(metaDate);
  if (!Number.isNaN(metaTimestamp)) {
    const date = new Date(metaTimestamp);
    values.push({
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      source: "meta",
    });
  }

  for (const match of combined.matchAll(/(?:^|[^\d])((?:19|20)\d{2})(?:[/-]((?:19|20)\d{2}))?(?=$|[^\d])/g)) {
    const years = [match[1], match[2]].filter(Boolean).map(Number);
    years.forEach((year) => {
      if (year >= 1990 && year <= currentYear() + 1) {
        values.push({ year, month: 12, day: 31, source: "text" });
      }
    });
  }

  const uploadMatch = url.match(/\/wp-content\/uploads\/((?:19|20)\d{2})\/(\d{2})\//i);
  if (uploadMatch) {
    values.push({
      year: Number(uploadMatch[1]),
      month: Number(uploadMatch[2]),
      day: 1,
      source: "upload",
    });
  }

  const latest = values
    .filter((item) => Number.isFinite(item.year) && item.year >= 1990 && item.year <= currentYear() + 1)
    .sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year;
      if (b.month !== a.month) return b.month - a.month;
      return b.day - a.day;
    })[0];

  if (!latest) return { value: "", label: "", year: 0 };
  const month = String(latest.month || 12).padStart(2, "0");
  const day = String(latest.day || 31).padStart(2, "0");
  return {
    value: `${latest.year}-${month}-${day}`,
    label: String(latest.year),
    year: latest.year,
    source: latest.source,
  };
}

function extractFeaturedImage(html = "", pageUrl = PORTAL_URL) {
  const featuredTags = [
    ...String(html).matchAll(/<img\b[^>]*class=["'][^"']*(?:wp-post-image|attachment-large|attachment-full|size-large|size-full)[^"']*["'][^>]*>/gi),
    ...String(html).matchAll(/<img\b[^>]*>/gi),
  ];

  const candidates = [
    extractMetaContent(html, "og:image"),
    extractMetaContent(html, "twitter:image"),
    ...featuredTags.map((match) => extractImageFromTag(match[0], pageUrl)),
  ];
  return candidates.map((item) => absoluteUrl(item, pageUrl)).find(Boolean) || "";
}

function canonicalResourceKey(url = "") {
  try {
    const parsed = new URL(url);
    parsed.hostname = parsed.hostname.replace(/^www\./, "");
    parsed.hash = "";
    parsed.search = "";
    parsed.pathname = parsed.pathname.replace(/^\/portal\/wp-content\//, "/wp-content/");
    return parsed.href;
  } catch {
    return url;
  }
}

function uniqueByUrl(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const key = canonicalResourceKey(item.archivoUrl || item.idOrigen || item.origen);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function titleFromUrl(url = "") {
  try {
    const parsed = new URL(url);
    const last = decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() || "");
    return last.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
}

function normalizeMaterial({ anchor, pageTitle, pageUrl }) {
  const titulo = anchor.label || titleFromUrl(anchor.url) || pageTitle;
  const text = `${titulo} ${pageTitle}`;
  const extension = getExtension(anchor.url);
  const isDoc = isDocumentUrl(anchor.url);
  const sourceDate = extractSourceDate({ text, url: `${anchor.url} ${pageUrl}` });

  return {
    fuente: "Educando",
    fuenteId: "educando-documentos",
    origen: pageUrl,
    idOrigen: anchor.url,
    titulo,
    descripcion: pageTitle,
    nivel: inferNivel(titulo) || inferNivel(pageTitle),
    grado: "",
    gradoEtiqueta: "",
    asignatura: inferAsignatura(text),
    tipo: inferTipo(text, anchor.url),
    formato: extension ? extension.toUpperCase() : "WEB",
    lectorUrl: anchor.url,
    archivoUrl: isDoc ? anchor.url : "",
    portadaUrl: anchor.portadaUrl || "",
    portadaGenerada: !anchor.portadaUrl,
    actualizadoEnFuente: sourceDate.value,
    actualizadoEtiqueta: sourceDate.label,
    raw: {
      pageTitle,
      pageUrl,
      url: anchor.url,
      label: anchor.label,
      extension,
      fechaDetectada: sourceDate,
    },
  };
}

function isHtmlResource(material = {}) {
  return material.formato === "WEB" && material.lectorUrl && isEducandoUrl(material.lectorUrl);
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await mapper(items[current], current);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );
  return results;
}

async function enriquecerPortadasDesdePaginas(materiales = []) {
  const pageCache = new Map();
  const getPage = async (url) => {
    if (!url) return null;
    if (!pageCache.has(url)) {
      pageCache.set(url, fetchHtml(url).catch(() => null));
    }
    return pageCache.get(url);
  };

  return mapWithConcurrency(materiales, 5, async (material) => {
    let portadaUrl = material.portadaUrl || "";
    let titulo = material.titulo || "";
    let descripcion = material.descripcion || "";
    let sourceDate = extractSourceDate({
      text: `${titulo} ${descripcion}`,
      url: `${material.lectorUrl || ""} ${material.archivoUrl || ""} ${material.origen || ""}`,
    });

    if (isHtmlResource(material)) {
      const detail = await getPage(material.lectorUrl);
      if (detail?.html) {
        portadaUrl = extractFeaturedImage(detail.html, detail.url) || portadaUrl;
        titulo = titulo || getTitle(detail.html) || titleFromUrl(material.lectorUrl);
        descripcion = getTitle(detail.html) || descripcion;
        const detailDate = extractSourceDate({
          text: `${titulo} ${descripcion}`,
          url: detail.url,
          html: detail.html,
        });
        if ((detailDate.year || 0) > (sourceDate.year || 0)) {
          sourceDate = detailDate;
        }
      }
    }

    if ((!portadaUrl || !sourceDate.value) && material.origen && isEducandoUrl(material.origen)) {
      const origin = await getPage(material.origen);
      if (origin?.html) {
        if (!portadaUrl) {
          portadaUrl = findNearbyImageForUrl(origin.html, material.idOrigen, origin.url) ||
            extractFeaturedImage(origin.html, origin.url) ||
            "";
        }
        const originDate = extractSourceDate({
          text: `${titulo} ${descripcion}`,
          url: `${material.idOrigen || ""} ${origin.url}`,
          html: origin.html,
        });
        if ((originDate.year || 0) > (sourceDate.year || 0)) {
          sourceDate = originDate;
        }
      }
    }

    if (!sourceDate.value) {
      sourceDate = extractSourceDate({
        text: `${titulo} ${descripcion}`,
        url: `${material.idOrigen || ""} ${material.origen || ""}`,
      });
    }

    return {
      ...material,
      titulo,
      descripcion,
      portadaUrl,
      portadaGenerada: !portadaUrl,
      actualizadoEnFuente: sourceDate.value || material.actualizadoEnFuente || "",
      actualizadoEtiqueta: sourceDate.label || material.actualizadoEtiqueta || "",
      raw: {
        ...(material.raw || {}),
        portadaDetectada: Boolean(portadaUrl),
        fechaDetectada: sourceDate.value ? sourceDate : material.raw?.fechaDetectada,
      },
    };
  });
}

function materialDateScore(material = {}) {
  const timestamp = Date.parse(material.actualizadoEnFuente || "");
  if (!Number.isNaN(timestamp)) return timestamp;
  const year = Number(material.actualizadoEtiqueta || material.raw?.fechaDetectada?.year || 0);
  return year ? Date.UTC(year, 11, 31) : 0;
}

function findNearbyImageForUrl(html = "", targetUrl = "", pageUrl = PORTAL_URL) {
  const anchors = extractAnchors(html, pageUrl);
  const targetKey = canonicalResourceKey(targetUrl);
  const match = anchors.find((anchor) => canonicalResourceKey(anchor.url) === targetKey);
  return match?.portadaUrl || "";
}

async function fetchHtml(url) {
  const headers = {
    "User-Agent": "DocenteOS-Monitor/1.0 (+https://docenteos.com)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
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
      html: await response.text(),
    };
  } catch (error) {
    if (error?.cause?.code !== "UNABLE_TO_VERIFY_LEAF_SIGNATURE") throw error;
    result = await requestHtml(url, headers);
  }

  if (!result.ok) {
    throw new Error(`${url} respondió ${result.status}`);
  }
  return { html: result.html, url: result.url || url };
}

function requestHtml(url, headers = {}, redirects = 0) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === "http:" ? http : https;
    const req = client.request(
      parsed,
      {
        method: "GET",
        headers,
        rejectUnauthorized: parsed.hostname.replace(/^www\./, "") !== "educando.edu.do",
      },
      (response) => {
        const location = response.headers.location ? absoluteUrl(response.headers.location, url) : "";
        if ([301, 302, 303, 307, 308].includes(response.statusCode) && location && redirects < 5) {
          response.resume();
          requestHtml(location, headers, redirects + 1).then(resolve, reject);
          return;
        }

        let data = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          data += chunk;
        });
        response.on("end", () => {
          resolve({
            ok: response.statusCode >= 200 && response.statusCode < 300,
            status: response.statusCode,
            url,
            html: data,
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

async function collectFromPage(url) {
  const { html, url: finalUrl } = await fetchHtml(url);
  const pageTitle = getTitle(html);
  const anchors = extractAnchors(html, finalUrl);
  return anchors
    .filter((anchor) => !isNavigationUrl(anchor.url))
    .filter((anchor) => isDocumentUrl(anchor.url) || /curricular|registro|ordenanza|fasciculo|secuencia|informe/i.test(anchor.url))
    .map((anchor) => normalizeMaterial({ anchor, pageTitle, pageUrl: finalUrl }));
}

function resumenMateriales(materiales = []) {
  const porTipo = {};
  const porNivel = {};
  materiales.forEach((material) => {
    porTipo[material.tipo || "sin_tipo"] = (porTipo[material.tipo || "sin_tipo"] || 0) + 1;
    porNivel[material.nivel || "Sin nivel"] = (porNivel[material.nivel || "Sin nivel"] || 0) + 1;
  });
  return { porTipo, porNivel };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const sourceUrl = absoluteUrl(req.body?.url || "");
    const seeds = sourceUrl ? [sourceUrl, ...SEED_URLS] : SEED_URLS;
    const uniqueSeeds = [...new Set(seeds)].filter(Boolean);
    const results = await Promise.allSettled(uniqueSeeds.map(collectFromPage));
    const materialesBase = uniqueByUrl(results.flatMap((result) => result.status === "fulfilled" ? result.value : []));
    const materiales = (await enriquecerPortadasDesdePaginas(materialesBase))
      .sort((a, b) => {
        const dateDiff = materialDateScore(b) - materialDateScore(a);
        if (dateDiff !== 0) return dateDiff;
        return String(a.titulo || "").localeCompare(String(b.titulo || ""), "es");
      });

    return res.status(200).json({
      success: true,
      fuente: "Educando",
      fuenteId: "educando-documentos",
      total: materiales.length,
      materiales,
      resumen: resumenMateriales(materiales),
      errores: results
        .map((result, index) => result.status === "rejected" ? { url: uniqueSeeds[index], error: result.reason?.message || String(result.reason) } : null)
        .filter(Boolean),
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      error: "No fue posible importar documentos de Educando",
      detail: error?.message || String(error),
    });
  }
}
