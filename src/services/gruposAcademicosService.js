import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase.js";

const GRUPOS_KEY = "docenteos_grupos_academicos_v1";

function normalizarClave(valor = "") {
  return String(valor || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function leerGruposLocales() {
  try {
    const raw = localStorage.getItem(GRUPOS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function guardarGruposLocales(grupos) {
  try { localStorage.setItem(GRUPOS_KEY, JSON.stringify(grupos)); }
  catch { /* storage no disponible */ }
}

function resolverAnoEscolar(curso = {}) {
  return curso.anoEscolar || curso.añoEscolar || curso.periodoEscolar || curso.year || "actual";
}

function resolverGrado(curso = {}) {
  return curso.grado || String(curso.nombre || "").replace(/\s+[A-Z]$/, "").trim() || "grado";
}

function resolverSeccion(curso = {}) {
  return curso.seccion || String(curso.nombre || "").match(/\b([A-Z])$/)?.[1] || "A";
}

export function construirGrupoAcademicoId(curso = {}) {
  return [
    resolverAnoEscolar(curso),
    curso.nivel || "nivel",
    resolverGrado(curso),
    resolverSeccion(curso),
  ].map(normalizarClave).filter(Boolean).join("__");
}

function estudiantesNormalizados(curso = {}) {
  const grupoId = construirGrupoAcademicoId(curso);
  const grado = resolverGrado(curso);
  const seccion = resolverSeccion(curso);
  return (curso.estudiantesDetalle || [])
    .map((estudiante, index) => {
      const nombre = estudiante?.nombre || estudiante?.nombreCompleto || estudiante?.name || "";
      if (!nombre.trim()) return null;
      return {
        ...estudiante,
        id: estudiante.id || estudiante.matricula || `${grupoId}-est-${index + 1}`,
        nombre: nombre.trim(),
        grado: estudiante.grado || grado,
        seccion: estudiante.seccion || seccion,
        grupoAcademicoId: grupoId,
      };
    })
    .filter(Boolean);
}

function esMatriculaOficial(curso = {}) {
  return curso.estudiantesFuente === "oficial"
    || curso.estudiantesFuente === "grupo_academico"
    || curso.matriculaOficial === true
    || curso.origenEstudiantes === "registro_oficial";
}

async function obtenerGrupoAcademico(grupoId) {
  if (!grupoId) return null;
  const locales = leerGruposLocales();
  const local = locales[grupoId] || null;

  if (db && auth?.currentUser) {
    const uid = auth.currentUser.uid;
    const snap = await getDoc(doc(db, "usuarios", uid, "gruposAcademicos", grupoId)).catch(() => null);
    if (snap?.exists()) return { id: grupoId, ...snap.data() };
  }

  return local;
}

async function guardarGrupoAcademico(curso, estudiantes) {
  const grupoId = construirGrupoAcademicoId(curso);
  const payload = {
    id: grupoId,
    nivel: curso.nivel || "",
    grado: resolverGrado(curso),
    seccion: resolverSeccion(curso),
    anoEscolar: resolverAnoEscolar(curso),
    estudiantes,
    estudiantesCount: estudiantes.length,
    actualizadoEn: new Date().toISOString(),
  };

  const locales = leerGruposLocales();
  guardarGruposLocales({ ...locales, [grupoId]: payload });

  if (db && auth?.currentUser) {
    const uid = auth.currentUser.uid;
    await setDoc(doc(db, "usuarios", uid, "gruposAcademicos", grupoId), {
      ...payload,
      uid,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    }, { merge: true }).catch(() => {});
  }

  return payload;
}

export async function sincronizarCursoConGrupoAcademico(curso = {}) {
  const grupoAcademicoId = construirGrupoAcademicoId(curso);
  const base = { ...curso, grupoAcademicoId };
  const estudiantes = estudiantesNormalizados(base);

  if (esMatriculaOficial(base) && estudiantes.length > 0) {
    await guardarGrupoAcademico(base, estudiantes);
    return {
      ...base,
      estudiantesDetalle: estudiantes,
      estudiantes: estudiantes.length,
      estudiantesFuente: "oficial",
      matriculaOficial: true,
    };
  }

  const grupo = await obtenerGrupoAcademico(grupoAcademicoId);
  if (grupo?.estudiantes?.length) {
    return {
      ...base,
      estudiantesDetalle: grupo.estudiantes,
      estudiantes: grupo.estudiantes.length,
      estudiantesFuente: "grupo_academico",
      matriculaOficial: true,
    };
  }

  return base;
}

export async function sincronizarCursosConGruposAcademicos(cursos = []) {
  const salida = [];
  for (const curso of cursos) {
    salida.push(await sincronizarCursoConGrupoAcademico(curso));
  }
  return salida;
}
