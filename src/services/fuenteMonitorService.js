import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../firebase.js";
import { FUENTE_ADECUACIONES_CURRICULARES } from "../data/adecuacionesCurriculares.js";

const FUENTES_KEY = "docenteos_monitor_fuentes";
const CAMBIOS_KEY = "docenteos_monitor_cambios";
const MATERIALES_KEY = "docenteos_materiales";

export const FUENTES_OFICIALES_BASE = [
  {
    id: "minerd-home",
    nombre: "MINERD - Portal oficial",
    url: "https://www.ministeriodeeducacion.gob.do/",
    categoria: "MINERD",
    destino: "Noticias institucionales",
    activa: true,
  },
  {
    id: "minerd-calendario",
    nombre: "MINERD - Calendario escolar",
    url: "https://www.ministeriodeeducacion.gob.do/",
    categoria: "Calendario",
    destino: "Calendario escolar",
    activa: true,
  },
  {
    id: "minerd-curriculo",
    nombre: "MINERD - Currículo",
    url: "https://www.ministeriodeeducacion.gob.do/",
    categoria: "Currículo",
    destino: "Banco curricular",
    activa: true,
  },
  {
    id: "educando-adecuacion-curricular",
    nombre: "Educando - Adecuación Curricular",
    url: FUENTE_ADECUACIONES_CURRICULARES.url,
    categoria: "Currículo",
    destino: "Adecuaciones curriculares actualizadas",
    activa: true,
    auth: {
      type: "none",
    },
  },
  {
    id: "minerd-libro-abierto",
    nombre: "MINERD - Libro Abierto",
    url: "https://libroabierto.minerd.gob.do/",
    categoria: "Recursos educativos",
    destino: "Biblioteca de libros y materiales",
    activa: true,
    auth: {
      type: "none",
      usernameEnv: "LIBRO_ABIERTO_USER",
      passwordEnv: "LIBRO_ABIERTO_PASSWORD",
    },
  },
];

const leerLocal = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const guardarLocal = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const normalizarUrlSimple = (url = "") => String(url).trim().replace(/\/+$/, "");

const esEducandoGenerico = (fuente = {}) =>
  fuente.nombre === "Educando" &&
  normalizarUrlSimple(fuente.url) === "https://educando.edu.do" &&
  (!fuente.destino || fuente.destino === "Revisión manual");

const normalizarFuenteMonitor = (fuente = {}) => {
  if (!esEducandoGenerico(fuente)) return fuente;

  return {
    ...fuente,
    nombre: "Educando - Adecuación Curricular",
    url: FUENTE_ADECUACIONES_CURRICULARES.url,
    categoria: "Currículo",
    destino: "Adecuaciones curriculares actualizadas",
    auth: {
      type: "none",
    },
    lastHash: "",
    lastTitle: "",
    lastExcerpt: "",
    lastCheckedAt: "",
    lastStatus: "",
  };
};

const mezclarFuentesBase = (fuentes = []) => {
  const normalizadas = fuentes.map(normalizarFuenteMonitor);
  const idsExistentes = new Set(normalizadas.map((fuente) => fuente.id));
  const urlsExistentes = new Set(normalizadas.map((fuente) => normalizarUrlSimple(fuente.url)));
  const faltantes = FUENTES_OFICIALES_BASE.filter(
    (fuente) => !idsExistentes.has(fuente.id) && !urlsExistentes.has(normalizarUrlSimple(fuente.url))
  );
  return [...normalizadas, ...faltantes];
};

const nowIso = () => new Date().toISOString();

const puedeUsarFirebase = () => Boolean(db && auth?.currentUser);

const leerRespuestaJson = async (response) => {
  const text = await response.text();
  if (!text.trim()) {
    const status = response.status ? ` (${response.status})` : "";
    throw new Error(
      `El endpoint respondió vacío${status}. En local, reinicia npm run dev para cargar las rutas API de Vite, o usa npm run dev:vercel si quieres probar el entorno Vercel completo.`
    );
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`El endpoint /api/fuentes/check no devolvió JSON válido. Respuesta: ${text.slice(0, 160)}`, {
      cause: error,
    });
  }
};

const slugMaterial = (value) =>
  String(value || "material")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || "material";

const prepararMaterialParaGuardar = (material = {}) => {
  const persistible = { ...material };
  delete persistible.raw;
  return persistible;
};

const escapeSvgText = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const splitCoverLines = (value, maxLines = 3, maxChars = 22) => {
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
};

const colorForCover = (material = {}) => {
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
};

const buildGeneratedCoverUrl = (material = {}) => {
  const [start, end] = colorForCover(material);
  const fuente = material.fuente || "Recurso oficial";
  const titleLines = splitCoverLines(material.titulo || fuente);
  const grado = material.gradoEtiqueta || material.grado || material.nivel || "Recurso oficial";
  const asignatura = material.asignatura || material.tipo || fuente;
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
  <text x="42" y="88" class="kicker">${escapeSvgText(fuente)}</text>
  ${titleSvg}
  <text x="42" y="382" class="meta">${escapeSvgText(grado)}</text>
  <text x="42" y="416" class="meta">${escapeSvgText(asignatura)}</text>
  <text x="42" y="566" class="brand">MINERD</text>
</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const normalizeComparable = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[°º]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]+/g, "")
    .trim();

const materialLogicalKey = (material = {}) =>
  [
    normalizeComparable(material.nivel),
    normalizeComparable(material.gradoEtiqueta || material.grado),
    normalizeComparable(material.asignatura),
    normalizeComparable(material.titulo),
  ].join("|");

const hasOfficialCover = (material = {}) =>
  Boolean(material.portadaUrl && !material.portadaGenerada && !String(material.portadaUrl).startsWith("data:"));

const materialUpdatedScore = (material = {}) => {
  const timestamp = Date.parse(material.actualizadoEnFuente || material.fuenteActualizadaEn || "");
  if (!Number.isNaN(timestamp)) return Math.floor(timestamp / 1000);
  const year = Number(material.actualizadoEtiqueta || material.raw?.fechaDetectada?.year || 0);
  return year ? Math.floor(Date.UTC(year, 11, 31) / 1000) : 0;
};

const materialScore = (material = {}) =>
  [
    materialUpdatedScore(material),
    hasOfficialCover(material) ? 100 : 0,
    material.archivoUrl ? 20 : 0,
    material.paginas ? 5 : 0,
    material.isbn ? 3 : 0,
    material.autor ? 2 : 0,
  ].reduce((sum, value) => sum + value, 0);

const mergePreferredMaterial = (current, next) => {
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
};

const preferirMaterialesConPortadaOficial = (materiales = []) => {
  const porClave = new Map();
  materiales.forEach((material) => {
    const normalizado = normalizarMaterialBiblioteca(material);
    const key = materialLogicalKey(normalizado) || normalizado.idOrigen || normalizado.id || normalizado.titulo;
    porClave.set(key, mergePreferredMaterial(porClave.get(key), normalizado));
  });
  return Array.from(porClave.values());
};

const normalizarMaterialBiblioteca = (material = {}) => {
  const id = String(material.id || "").trim();
  const idOrigen = material.idOrigen || (id.startsWith("libro-abierto-") ? id.replace(/^libro-abierto-/, "") : "");
  const normalizado = idOrigen ? { ...material, idOrigen } : material;
  if (normalizado.portadaUrl) return normalizado;
  return {
    ...normalizado,
    portadaUrl: buildGeneratedCoverUrl(normalizado),
    portadaGenerada: true,
  };
};

export async function listarFuentesMonitor() {
  const locales = mezclarFuentesBase(leerLocal(FUENTES_KEY, FUENTES_OFICIALES_BASE));

  if (!puedeUsarFirebase()) return locales;

  try {
    const snap = await getDocs(query(collection(db, "fuentesOficiales"), orderBy("nombre", "asc")));
    const remotas = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
    return remotas.length ? mezclarFuentesBase(remotas) : locales;
  } catch {
    return locales;
  }
}

export async function listarCambiosMonitor() {
  const locales = leerLocal(CAMBIOS_KEY, []);

  if (!puedeUsarFirebase()) return locales;

  try {
    const snap = await getDocs(query(collection(db, "fuentesCambios"), orderBy("detectadoEn", "desc")));
    return snap.docs.map((item) => ({ id: item.id, ...item.data() }));
  } catch {
    return locales;
  }
}

export async function guardarFuenteMonitor(fuente) {
  const payload = {
    ...fuente,
    activa: fuente.activa !== false,
    updatedAt: nowIso(),
  };

  const locales = leerLocal(FUENTES_KEY, FUENTES_OFICIALES_BASE);
  const id = payload.id || `fuente-${Date.now()}`;
  const siguiente = [...locales.filter((item) => item.id !== id), { ...payload, id }];
  guardarLocal(FUENTES_KEY, siguiente);

  if (puedeUsarFirebase()) {
    await setDoc(
      doc(db, "fuentesOficiales", id),
      {
        ...payload,
        updatedAt: serverTimestamp(),
        creadoPor: auth.currentUser.uid,
      },
      { merge: true }
    );
  }

  return { ...payload, id };
}

export async function eliminarFuenteMonitor(fuenteId) {
  const locales = leerLocal(FUENTES_KEY, FUENTES_OFICIALES_BASE);
  guardarLocal(FUENTES_KEY, locales.filter((item) => item.id !== fuenteId));

  if (puedeUsarFirebase()) {
    await deleteDoc(doc(db, "fuentesOficiales", fuenteId));
  }
}

export async function verificarFuenteMonitor(fuente) {
  let response;
  try {
    response = await fetch("/api/fuentes/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: fuente.url, auth: fuente.auth || { type: "none" } }),
    });
  } catch (error) {
    throw new Error(`No fue posible conectar con /api/fuentes/check: ${error.message}`, {
      cause: error,
    });
  }

  const revision = await leerRespuestaJson(response);
  if (!response.ok) {
    throw new Error(revision.detail || revision.error || "No fue posible revisar la fuente");
  }

  if (!fuente.lastHash) {
    await guardarFuenteMonitor({
      ...fuente,
      lastHash: revision.hash,
      lastTitle: revision.title,
      lastExcerpt: revision.excerpt,
      lastCheckedAt: revision.checkedAt,
      lastStatus: revision.status,
    });
    return { tipo: "baseline", revision };
  }

  if (fuente.lastHash === revision.hash) {
    await guardarFuenteMonitor({
      ...fuente,
      lastCheckedAt: revision.checkedAt,
      lastStatus: revision.status,
      lastTitle: revision.title || fuente.lastTitle || "",
    });
    return { tipo: "sin-cambios", revision };
  }

  const cambio = {
    fuenteId: fuente.id,
    fuenteNombre: fuente.nombre,
    categoria: fuente.categoria || "General",
    destino: fuente.destino || "Revisión manual",
    url: revision.url || fuente.url,
    estado: "pendiente",
    hashAnterior: fuente.lastHash,
    hashNuevo: revision.hash,
    titulo: revision.title || fuente.nombre,
    extractoAnterior: fuente.lastExcerpt || "",
    extractoNuevo: revision.excerpt || "",
    detectadoEn: revision.checkedAt || nowIso(),
    creadoPor: auth?.currentUser?.email || "local-admin",
  };

  const locales = leerLocal(CAMBIOS_KEY, []);
  const id = `cambio-${Date.now()}`;
  guardarLocal(CAMBIOS_KEY, [{ ...cambio, id }, ...locales]);

  if (puedeUsarFirebase()) {
    const ref = await addDoc(collection(db, "fuentesCambios"), {
      ...cambio,
      detectadoEn: serverTimestamp(),
      creadoPorUid: auth.currentUser.uid,
    });
    return { tipo: "cambio", revision, cambio: { ...cambio, id: ref.id } };
  }

  return { tipo: "cambio", revision, cambio: { ...cambio, id } };
}

export async function obtenerLibroAbiertoMateriales(fuente = {}) {
  let response;
  try {
    response = await fetch("/api/materiales/libro-abierto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auth: fuente.auth || {} }),
    });
  } catch (error) {
    throw new Error(`No fue posible conectar con /api/materiales/libro-abierto: ${error.message}`, {
      cause: error,
    });
  }

  const resultado = await leerRespuestaJson(response);
  if (!response.ok) {
    throw new Error(resultado.detail || resultado.error || "No fue posible importar Libro Abierto");
  }

  return resultado;
}

export async function obtenerEducandoMateriales(fuente = {}) {
  let response;
  try {
    response = await fetch("/api/materiales/educando", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: fuente.url, auth: { type: "none" } }),
    });
  } catch (error) {
    throw new Error(`No fue posible conectar con /api/materiales/educando: ${error.message}`, {
      cause: error,
    });
  }

  const resultado = await leerRespuestaJson(response);
  if (!response.ok) {
    throw new Error(resultado.detail || resultado.error || "No fue posible importar documentos de Educando");
  }

  return {
    ...resultado,
    materiales: Array.isArray(resultado.materiales)
      ? resultado.materiales.map(normalizarMaterialBiblioteca)
      : [],
  };
}

export async function guardarMaterialesLibroAbierto(resultado = {}) {
  const materiales = Array.isArray(resultado.materiales) ? resultado.materiales : [];
  const fecha = new Date().toISOString();
  const locales = leerLocal(MATERIALES_KEY, []);
  const porId = new Map(locales.map((item) => [item.id, item]));

  materiales.forEach((material) => {
    const id = `libro-abierto-${slugMaterial(material.idOrigen || material.titulo)}`;
    const persistible = prepararMaterialParaGuardar(material);
    porId.set(id, {
      ...porId.get(id),
      ...persistible,
      id,
      estado: "activo",
      actualizadoEn: fecha,
      importadoEn: porId.get(id)?.importadoEn || fecha,
    });
  });
  guardarLocal(MATERIALES_KEY, Array.from(porId.values()));

  if (puedeUsarFirebase() && materiales.length) {
    const chunks = [];
    for (let i = 0; i < materiales.length; i += 400) {
      chunks.push(materiales.slice(i, i + 400));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach((material) => {
        const id = `libro-abierto-${slugMaterial(material.idOrigen || material.titulo)}`;
        const persistible = prepararMaterialParaGuardar(material);
        batch.set(
          doc(db, "materiales", id),
          {
            ...persistible,
            id,
            estado: "activo",
            actualizadoEn: serverTimestamp(),
            importadoPor: auth.currentUser.uid,
            importadoPorEmail: auth.currentUser.email,
            fuenteActualizadaEn: resultado.checkedAt || fecha,
          },
          { merge: true }
        );
      });
      await batch.commit();
    }
  }

  return {
    ...resultado,
    guardados: materiales.length,
  };
}

export async function guardarMaterialesEducando(resultado = {}) {
  const materiales = Array.isArray(resultado.materiales)
    ? resultado.materiales.map(normalizarMaterialBiblioteca)
    : [];
  const fecha = new Date().toISOString();
  const locales = leerLocal(MATERIALES_KEY, []);
  const porId = new Map(locales.map((item) => [item.id, item]));

  materiales.forEach((material) => {
    const id = `educando-${slugMaterial(material.idOrigen || material.archivoUrl || material.origen || material.titulo)}`;
    const persistible = prepararMaterialParaGuardar(material);
    porId.set(id, {
      ...porId.get(id),
      ...persistible,
      id,
      estado: "activo",
      actualizadoEn: fecha,
      importadoEn: porId.get(id)?.importadoEn || fecha,
    });
  });
  guardarLocal(MATERIALES_KEY, Array.from(porId.values()));

  if (puedeUsarFirebase() && materiales.length) {
    const chunks = [];
    for (let i = 0; i < materiales.length; i += 400) {
      chunks.push(materiales.slice(i, i + 400));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach((material) => {
        const id = `educando-${slugMaterial(material.idOrigen || material.archivoUrl || material.origen || material.titulo)}`;
        const persistible = prepararMaterialParaGuardar(material);
        batch.set(
          doc(db, "materiales", id),
          {
            ...persistible,
            id,
            estado: "activo",
            actualizadoEn: serverTimestamp(),
            importadoPor: auth.currentUser.uid,
            importadoPorEmail: auth.currentUser.email,
            fuenteActualizadaEn: resultado.checkedAt || fecha,
          },
          { merge: true }
        );
      });
      await batch.commit();
    }
  }

  return {
    ...resultado,
    guardados: materiales.length,
  };
}

export async function importarLibroAbiertoMateriales(fuente = {}) {
  const resultado = await obtenerLibroAbiertoMateriales(fuente);
  return guardarMaterialesLibroAbierto(resultado);
}

export async function listarMaterialesBiblioteca() {
  const locales = leerLocal(MATERIALES_KEY, []);

  if (!puedeUsarFirebase()) {
    return preferirMaterialesConPortadaOficial(
      locales.filter((material) => material.estado !== "inactivo")
    );
  }

  try {
    const snap = await getDocs(query(collection(db, "materiales"), orderBy("titulo", "asc")));
    const remotos = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
    const porId = new Map();
    locales.forEach((material) => porId.set(material.id || material.idOrigen || material.titulo, material));
    remotos.forEach((material) => porId.set(material.id || material.idOrigen || material.titulo, material));
    return preferirMaterialesConPortadaOficial(
      Array.from(porId.values()).filter((material) => material.estado !== "inactivo")
    ).sort((a, b) => String(a.titulo || "").localeCompare(String(b.titulo || ""), "es"));
  } catch {
    return preferirMaterialesConPortadaOficial(
      locales.filter((material) => material.estado !== "inactivo")
    );
  }
}

export async function eliminarMaterialBiblioteca(materialId) {
  if (!materialId) {
    throw new Error("Falta el ID del material.");
  }

  const fecha = nowIso();
  const locales = leerLocal(MATERIALES_KEY, []);
  const existeLocal = locales.some((material) => material.id === materialId);
  const siguiente = existeLocal
    ? locales.map((material) =>
        material.id === materialId
          ? { ...material, estado: "inactivo", eliminadoEn: fecha }
          : material
      )
    : [...locales, { id: materialId, estado: "inactivo", eliminadoEn: fecha }];
  guardarLocal(MATERIALES_KEY, siguiente);

  if (puedeUsarFirebase()) {
    await updateDoc(doc(db, "materiales", materialId), {
      estado: "inactivo",
      eliminadoEn: serverTimestamp(),
      eliminadoPor: auth.currentUser.uid,
      eliminadoPorEmail: auth.currentUser.email,
    });
  }

  return { success: true, id: materialId };
}

export async function aprobarCambioMonitor(cambio, adminEmail) {
  const aprobadoEn = nowIso();
  const actualizado = {
    ...cambio,
    estado: "aprobado",
    aprobadoPor: adminEmail || auth?.currentUser?.email || "admin",
    aprobadoEn,
  };

  const fuentes = leerLocal(FUENTES_KEY, FUENTES_OFICIALES_BASE);
  guardarLocal(
    FUENTES_KEY,
    fuentes.map((fuente) =>
      fuente.id === cambio.fuenteId
        ? {
            ...fuente,
            lastHash: cambio.hashNuevo,
            lastExcerpt: cambio.extractoNuevo,
            lastTitle: cambio.titulo,
            lastCheckedAt: aprobadoEn,
            lastApprovedAt: aprobadoEn,
          }
        : fuente
    )
  );

  const cambios = leerLocal(CAMBIOS_KEY, []);
  guardarLocal(CAMBIOS_KEY, cambios.map((item) => (item.id === cambio.id ? actualizado : item)));

  if (puedeUsarFirebase()) {
    await updateDoc(doc(db, "fuentesCambios", cambio.id), {
      estado: "aprobado",
      aprobadoPor: adminEmail || auth.currentUser.email,
      aprobadoEn: serverTimestamp(),
    });
    await setDoc(
      doc(db, "fuentesOficiales", cambio.fuenteId),
      {
        lastHash: cambio.hashNuevo,
        lastExcerpt: cambio.extractoNuevo,
        lastTitle: cambio.titulo,
        lastCheckedAt: serverTimestamp(),
        lastApprovedAt: serverTimestamp(),
      },
      { merge: true }
    );
    await setDoc(
      doc(db, "fuentesAprobadas", cambio.id),
      {
        ...actualizado,
        aprobadoEn: serverTimestamp(),
      },
      { merge: true }
    );
  }

  return actualizado;
}

export async function rechazarCambioMonitor(cambio, adminEmail) {
  const rechazado = {
    ...cambio,
    estado: "rechazado",
    rechazadoPor: adminEmail || auth?.currentUser?.email || "admin",
    rechazadoEn: nowIso(),
  };

  const cambios = leerLocal(CAMBIOS_KEY, []);
  guardarLocal(CAMBIOS_KEY, cambios.map((item) => (item.id === cambio.id ? rechazado : item)));

  if (puedeUsarFirebase()) {
    await updateDoc(doc(db, "fuentesCambios", cambio.id), {
      estado: "rechazado",
      rechazadoPor: rechazado.rechazadoPor,
      rechazadoEn: serverTimestamp(),
    });
  }

  return rechazado;
}
