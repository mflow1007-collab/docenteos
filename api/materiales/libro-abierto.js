const BASE_URL = "https://libroabierto-be.azurewebsites.net";
const NIVELES_LIBRO_ABIERTO = [
  { id: 1, nombre: "Inicial" },
  { id: 2, nombre: "Primaria" },
  { id: 3, nombre: "Secundaria" },
];

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

function asArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.books)) return data.books;
  return [];
}

const GRADO_ORDINAL = {
  "Pre-Kinder": "Pre-Kinder",
  Kinder: "Kinder",
  "Pre-Primario": "Pre-Primario",
  Primero: "1ro",
  Segundo: "2do",
  Tercero: "3ro",
  Cuarto: "4to",
  Quinto: "5to",
  Sexto: "6to",
};

function buildGradoEtiqueta(grado, nivel) {
  const gradoBase = GRADO_ORDINAL[grado] || grado || "";
  if (!gradoBase) return "";
  if (!nivel || ["Inicial"].includes(nivel)) return gradoBase;
  return `${gradoBase} ${nivel}`;
}

function buildLectorUrl({ nivel, grado, asignatura, idOrigen }) {
  if (!nivel || !grado || !asignatura || !idOrigen) return "";
  return `https://libroabierto.minerd.gob.do/${encodeURIComponent(nivel)}/${encodeURIComponent(grado)}/${encodeURIComponent(asignatura)}/${encodeURIComponent(idOrigen)}/lector`;
}

function escapeSvgText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function splitCoverLines(value, maxLines = 3, maxChars = 22) {
  const words = String(value || "Material")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  const lines = [];
  let current = "";

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });
  if (current) lines.push(current);

  const limited = lines.slice(0, maxLines);
  if (lines.length > maxLines && limited.length) {
    limited[limited.length - 1] = `${limited[limited.length - 1].replace(/\.+$/, "")}...`;
  }
  return limited.length ? limited : ["Material"];
}

function colorForCover(material = {}) {
  const palette = [
    ["#1d4ed8", "#14b8a6"],
    ["#7c3aed", "#db2777"],
    ["#0f766e", "#84cc16"],
    ["#b45309", "#ef4444"],
    ["#4338ca", "#0284c7"],
    ["#be123c", "#f97316"],
  ];
  const seed = `${material.asignatura || ""}${material.grado || ""}${material.titulo || ""}`;
  const index = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palette.length;
  return palette[index];
}

function buildGeneratedCoverUrl(material = {}) {
  const [start, end] = colorForCover(material);
  const titleLines = splitCoverLines(material.titulo || "Libro Abierto");
  const grado = material.gradoEtiqueta || buildGradoEtiqueta(material.grado, material.nivel) || material.grado || material.nivel || "Recurso oficial";
  const asignatura = material.asignatura || "Libro Abierto MINERD";
  const titleSvg = titleLines
    .map((line, index) => `<text x="42" y="${178 + index * 34}" class="title">${escapeSvgText(line)}</text>`)
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="640" viewBox="0 0 480 640">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${start}"/>
      <stop offset="1" stop-color="${end}"/>
    </linearGradient>
    <style>
      .kicker{font:700 22px Arial,sans-serif;letter-spacing:1.5px;text-transform:uppercase;fill:rgba(255,255,255,.78)}
      .title{font:800 31px Arial,sans-serif;fill:#fff}
      .meta{font:700 21px Arial,sans-serif;fill:rgba(255,255,255,.86)}
      .brand{font:800 24px Arial,sans-serif;fill:#fff}
    </style>
  </defs>
  <rect width="480" height="640" rx="0" fill="url(#bg)"/>
  <rect x="24" y="24" width="432" height="592" rx="26" fill="none" stroke="rgba(255,255,255,.34)" stroke-width="3"/>
  <circle cx="398" cy="112" r="54" fill="rgba(255,255,255,.16)"/>
  <circle cx="72" cy="526" r="88" fill="rgba(255,255,255,.12)"/>
  <text x="42" y="88" class="kicker">Libro Abierto</text>
  ${titleSvg}
  <text x="42" y="382" class="meta">${escapeSvgText(grado)}</text>
  <text x="42" y="416" class="meta">${escapeSvgText(asignatura)}</text>
  <text x="42" y="566" class="brand">MINERD</text>
</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function ensureCover(material) {
  if (material?.portadaUrl) return material;
  return {
    ...material,
    portadaUrl: buildGeneratedCoverUrl(material),
    portadaGenerada: true,
  };
}

function normalizeBook(node, contexto = {}) {
  if (!node?.id || !(node.title || node.name)) return null;
  const nivel = node.levelName || contexto.nivel || "";
  const grado = node.gradeName || contexto.grado || node.libraryName || "";
  const asignatura = node.subjectName || contexto.asignatura || "";
  const idOrigen = String(node.id);
  return {
    fuente: "Libro Abierto MINERD",
    fuenteId: "minerd-libro-abierto",
    origen: "https://libroabierto.minerd.gob.do/",
    idOrigen,
    titulo: node.title || node.name,
    descripcion: node.description || node.summary || "",
    nivel,
    grado,
    gradoEtiqueta: buildGradoEtiqueta(grado, nivel),
    asignatura,
    tipo: "libro",
    lectorUrl: buildLectorUrl({ nivel, grado, asignatura, idOrigen }),
    portadaUrl: node.coverImageUrl || node.coverUrl || node.cover || node.imageUrl || node.thumbnail || "",
    archivoUrl: node.pdfUrl || node.fileUrl || node.url || "",
    autor: node.autor || node.author || "",
    editorial: node.publisher || "",
    raw: node,
  };
}

function mergeBookDetail(material, detail) {
  const data = detail?.data && typeof detail.data === "object" ? detail.data : detail;
  if (!data || typeof data !== "object") return material;
  const officialCover =
    data.coverImageUrl ||
    data.coverUrl ||
    data.cover ||
    data.imageUrl ||
    data.thumbnail ||
    "";

  return {
    ...material,
    descripcion: material.descripcion || data.description || data.summary || "",
    portadaUrl: officialCover || material.portadaUrl || "",
    portadaGenerada: officialCover ? false : material.portadaGenerada,
    archivoUrl:
      material.archivoUrl ||
      data.pdfCode ||
      data.pdfUrl ||
      data.fileUrl ||
      data.bookUrl ||
      data.documentUrl ||
      data.url ||
      "",
    autor: material.autor || data.autor || data.author || "",
    editorial: material.editorial || data.publisher || "",
    paginas: material.paginas || data.pagesNumber || null,
    isbn: material.isbn || data.isbn || "",
  };
}

function flattenBooks(data, contextoBase = {}) {
  const materiales = [];

  const walk = (node, contexto = {}) => {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach((item) => walk(item, contexto));
      return;
    }
    if (typeof node !== "object") return;

    const nuevoContexto = {
      ...contexto,
      nivel: node.levelName || node.level || contexto.nivel || null,
      grado: node.gradeName || node.grade || node.name || contexto.grado || null,
      asignatura: node.subjectName || node.subject || contexto.asignatura || null,
    };

    if (Array.isArray(node.books)) {
      node.books.forEach((book) => walk(book, nuevoContexto));
    }

    const material = normalizeBook(node, nuevoContexto);
    if (material && !Array.isArray(node.books)) materiales.push(material);
  };

  walk(data, contextoBase);

  return uniqueMateriales(materiales);
}

function uniqueMateriales(materiales) {
  const vistos = new Set();
  return materiales.filter((item) => {
    const key = item.idOrigen || `${item.titulo}-${item.grado}-${item.asignatura}`;
    if (vistos.has(key)) return false;
    vistos.add(key);
    return true;
  });
}

function normalizeComparable(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[°º]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]+/g, "")
    .trim();
}

function materialLogicalKey(material = {}) {
  return [
    normalizeComparable(material.nivel),
    normalizeComparable(material.gradoEtiqueta || buildGradoEtiqueta(material.grado, material.nivel) || material.grado),
    normalizeComparable(material.asignatura),
    normalizeComparable(material.titulo),
  ].join("|");
}

function hasOfficialCover(material = {}) {
  return Boolean(material.portadaUrl && !material.portadaGenerada && !String(material.portadaUrl).startsWith("data:"));
}

function materialScore(material = {}) {
  return [
    hasOfficialCover(material) ? 100 : 0,
    material.archivoUrl ? 20 : 0,
    material.paginas ? 5 : 0,
    material.isbn ? 3 : 0,
    material.autor ? 2 : 0,
  ].reduce((sum, value) => sum + value, 0);
}

function mergePreferredMaterial(current, next) {
  if (!current) return next;
  const preferred = materialScore(next) > materialScore(current) ? next : current;
  const fallback = preferred === next ? current : next;
  return {
    ...fallback,
    ...preferred,
    portadaUrl: hasOfficialCover(preferred) ? preferred.portadaUrl : (fallback.portadaUrl || preferred.portadaUrl),
    portadaGenerada: hasOfficialCover(preferred) ? false : (preferred.portadaGenerada || fallback.portadaGenerada),
    archivoUrl: preferred.archivoUrl || fallback.archivoUrl || "",
    lectorUrl: preferred.lectorUrl || fallback.lectorUrl || "",
  };
}

function preferirMaterialesConPortadaOficial(materiales) {
  const porClave = new Map();
  materiales.forEach((material) => {
    const key = materialLogicalKey(material) || material.idOrigen || material.titulo;
    porClave.set(key, mergePreferredMaterial(porClave.get(key), material));
  });
  return Array.from(porClave.values());
}

function resumirPorGrado(materiales) {
  return materiales.reduce((acc, material) => {
    const key = material.gradoEtiqueta || buildGradoEtiqueta(material.grado, material.nivel) || material.grado || "Sin grado";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

async function fetchJson(path, token, label, options = {}) {
  const controller = new AbortController();
  const timeout = options.timeoutMs
    ? setTimeout(() => controller.abort(), options.timeoutMs)
    : null;

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${token}`,
        "Origin": "https://libroabierto.minerd.gob.do",
      },
      signal: controller.signal,
    });
    const data = await readJson(response, label);
    if (!response.ok) {
      throw new Error(`${label}: ${data?.message || data?.data || response.status}`);
    }
    return data?.data ?? data;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function fetchBookDetail(bookId, token) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await fetchJson(`/api/Book/${bookId}`, token, `Detalle libro ${bookId}`, { timeoutMs: 12000 });
    } catch {
      if (attempt === 1) return null;
    }
  }
  return null;
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

async function enriquecerMaterialesConDetalle(materiales, token) {
  const enriquecidos = await mapWithConcurrency(materiales, 6, async (material) => {
    if (!material.idOrigen) return ensureCover(material);
    const detail = await fetchBookDetail(material.idOrigen, token);
    if (!detail && !material.portadaUrl && !material.archivoUrl) return null;
    return ensureCover(detail ? mergeBookDetail(material, detail) : material);
  });
  return enriquecidos.filter(Boolean);
}

async function recolectarCatalogoGeneral(token) {
  const booksData = await fetchJson("/api/Library/Books", token, "Catálogo Libro Abierto");
  const materiales = flattenBooks(booksData);
  return {
    materiales,
    resumen: {
      fuente: "api/Library/Books",
      total: materiales.length,
    },
  };
}

async function recolectarPorNiveles(token) {
  const materiales = [];
  const resumen = [];

  for (const nivel of NIVELES_LIBRO_ABIERTO) {
    let grados;
    try {
      grados = asArray(await fetchJson(`/api/Grade/Level?level=${nivel.id}`, token, `Grados ${nivel.nombre}`));
    } catch (error) {
      resumen.push({ nivel: nivel.nombre, error: error.message });
      continue;
    }

    const resumenNivel = {
      nivel: nivel.nombre,
      grados: grados.length,
      asignaturas: 0,
      libros: 0,
    };

    for (const grado of grados) {
      let asignaturas;
      try {
        asignaturas = asArray(await fetchJson(`/api/Subject/Books/Grade/${grado.id}`, token, `Asignaturas ${grado.name || grado.title}`));
      } catch (error) {
        resumen.push({ nivel: nivel.nombre, grado: grado.name || grado.title, error: error.message });
        continue;
      }

      resumenNivel.asignaturas += asignaturas.length;

      for (const asignatura of asignaturas) {
        let libros;
        try {
          const params = new URLSearchParams({
            gradeId: String(grado.id),
            subjectId: String(asignatura.id),
          });
          libros = asArray(await fetchJson(`/api/Book/Grade/Subject?${params}`, token, `Libros ${grado.name || grado.title} ${asignatura.name || asignatura.title}`));
        } catch (error) {
          resumen.push({
            nivel: nivel.nombre,
            grado: grado.name || grado.title,
            asignatura: asignatura.name || asignatura.title,
            error: error.message,
          });
          continue;
        }

        resumenNivel.libros += libros.length;
        libros.forEach((book) => {
          const material = normalizeBook(book, {
            nivel: nivel.nombre,
            grado: grado.name || grado.title || "",
            asignatura: asignatura.name || asignatura.title || "",
          });
          if (material) materiales.push(material);
        });
      }
    }

    resumen.push(resumenNivel);
  }

  return { materiales: uniqueMateriales(materiales), resumen };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const auth = req.body?.auth || {};
    const username = getCredential(auth.usernameEnv || "LIBRO_ABIERTO_USER");
    const password = getCredential(auth.passwordEnv || "LIBRO_ABIERTO_PASSWORD");

    if (!username || !password) {
      return res.status(400).json({
        error: "Faltan credenciales de Libro Abierto",
        detail: "Configura LIBRO_ABIERTO_USER y LIBRO_ABIERTO_PASSWORD en variables de entorno del servidor.",
      });
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
      return res.status(loginResponse.status).json({
        error: "No fue posible iniciar sesión en Libro Abierto",
        detail: loginData?.message || loginData?.data || "Credenciales rechazadas",
      });
    }

    const token = extractToken(loginData);
    if (!token) {
      return res.status(502).json({
        error: "Libro Abierto no devolvió token",
        detail: "La respuesta de login no contiene token reconocible.",
      });
    }

    const [catalogoGeneral, catalogoPorNiveles] = await Promise.all([
      recolectarCatalogoGeneral(token),
      recolectarPorNiveles(token),
    ]);
    const materiales = uniqueMateriales([
      ...catalogoGeneral.materiales,
      ...catalogoPorNiveles.materiales,
    ]);
    const materialesEnriquecidos = preferirMaterialesConPortadaOficial(
      await enriquecerMaterialesConDetalle(materiales, token)
    );

    return res.status(200).json({
      success: true,
      total: materialesEnriquecidos.length,
      materiales: materialesEnriquecidos,
      resumen: {
        catalogoGeneral: catalogoGeneral.resumen,
        porNiveles: catalogoPorNiveles.resumen,
        porGrado: resumirPorGrado(materialesEnriquecidos),
        portadas: {
          conPortada: materialesEnriquecidos.filter((material) => Boolean(material.portadaUrl)).length,
          sinPortada: materialesEnriquecidos.filter((material) => !material.portadaUrl).length,
        },
      },
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      error: "No fue posible importar Libro Abierto",
      detail: error?.message || String(error),
    });
  }
}
