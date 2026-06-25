/**
 * curriculumImportService.js
 *
 * Pipeline de importación del Diseño Curricular oficial al Firestore de DocenteOS.
 *
 * FLUJO:
 *   1. Recibe el documento (JSON estructurado o texto pegado)
 *   2. Valida la estructura (Nivel / Ciclo / Grado / Área / Competencias / Indicadores / Contenidos)
 *   3. Guarda cada asignatura como un documento individual en Firestore
 *
 * Formato JSON completo (con asignaturas[]):
 * {
 *   nivel, ciclo, version, fuente,
 *   asignaturas: [
 *     {
 *       grado, area, asignatura, nivelDominio,
 *       competenciasFundamentales: [...],
 *       temasCurriculares: [...],
 *       criteriosCombinacionTematica: [{ nombre, temas, duracionSugerida, razon }],
 *       contenidosGenerales: { conceptuales, procedimentales, actitudinales },
 *       orientacionesMetodologicas: [...],
 *       posiblesProductosFinales: [...],
 *       competencias: [
 *         {
 *           id, descripcion, competenciaFundamental,
 *           indicadoresLogro: [{ id, descripcion }],
 *           contenidos: { conceptuales, procedimentales, actitudinales }
 *         }
 *       ]
 *     }
 *   ]
 * }
 *
 * Formato JSON simple (asignatura individual, sin wrapper asignaturas[]):
 * { nivel, ciclo, version, fuente, grado, area, asignatura, ...mismos_campos_de_arriba }
 *
 * Colección Firestore: "diseñoCurricular"
 * ID de documento: slugCurriculo(nivel, grado, area)
 */

import { db } from "../firebase.js";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { slugCurriculo } from "./curriculumService.js";

// ── Validación ─────────────────────────────────────────────────────────────────

const CAMPOS_REQUERIDOS_RAIZ = ["nivel", "asignaturas"];
const CAMPOS_REQUERIDOS_ASIGNATURA = ["grado", "area", "competencias"];
const CAMPOS_REQUERIDOS_COMPETENCIA = ["id", "descripcion", "indicadoresLogro"];

const validarEstructuraRaiz = (datos) => {
  const errores = [];
  for (const campo of CAMPOS_REQUERIDOS_RAIZ) {
    if (!datos[campo]) errores.push(`Campo raíz requerido: "${campo}"`);
  }
  if (!Array.isArray(datos.asignaturas) || datos.asignaturas.length === 0) {
    errores.push("El campo 'asignaturas' debe ser un arreglo no vacío");
  }
  return errores;
};

const validarAsignatura = (asignatura, indice) => {
  const errores = [];
  for (const campo of CAMPOS_REQUERIDOS_ASIGNATURA) {
    if (!asignatura[campo]) {
      errores.push(`asignaturas[${indice}]: campo requerido "${campo}"`);
    }
  }
  if (!Array.isArray(asignatura.competencias) || asignatura.competencias.length === 0) {
    errores.push(`asignaturas[${indice}]: debe tener al menos una competencia`);
  }
  return errores;
};

const validarCompetencia = (competencia, asigIndice, compIndice) => {
  const errores = [];
  for (const campo of CAMPOS_REQUERIDOS_COMPETENCIA) {
    if (!competencia[campo]) {
      errores.push(
        `asignaturas[${asigIndice}].competencias[${compIndice}]: campo requerido "${campo}"`
      );
    }
  }
  if (!Array.isArray(competencia.indicadoresLogro) || competencia.indicadoresLogro.length === 0) {
    errores.push(
      `asignaturas[${asigIndice}].competencias[${compIndice}]: debe tener al menos un indicador de logro`
    );
  }
  return errores;
};

export const validarEstructuraCurriculo = (datos) => {
  const errores = [];

  errores.push(...validarEstructuraRaiz(datos));
  if (errores.length > 0) return { valido: false, errores };

  datos.asignaturas.forEach((asignatura, i) => {
    errores.push(...validarAsignatura(asignatura, i));

    if (Array.isArray(asignatura.competencias)) {
      asignatura.competencias.forEach((competencia, j) => {
        errores.push(...validarCompetencia(competencia, i, j));
      });
    }
  });

  return { valido: errores.length === 0, errores };
};

// ── Normalización ──────────────────────────────────────────────────────────────

const normalizarContenidos = (contenidos) => {
  if (!contenidos) return { conceptuales: [], procedimentales: [], actitudinales: [] };
  return {
    conceptuales: Array.isArray(contenidos.conceptuales) ? contenidos.conceptuales : [],
    procedimentales: Array.isArray(contenidos.procedimentales) ? contenidos.procedimentales : [],
    actitudinales: Array.isArray(contenidos.actitudinales) ? contenidos.actitudinales : [],
  };
};

const normalizarCriteriosCombinacion = (criterios) => {
  if (!Array.isArray(criterios)) return [];
  return criterios.map((c) => ({
    nombre: String(c.nombre || "").trim(),
    temas: Array.isArray(c.temas) ? c.temas.map(String) : [],
    duracionSugerida: String(c.duracionSugerida || "").trim(),
    razon: String(c.razon || "").trim(),
  }));
};

const normalizarCompetencia = (competencia) => ({
  id: String(competencia.id || "").trim(),
  descripcion: String(competencia.descripcion || "").trim(),
  competenciaFundamental: String(competencia.competenciaFundamental || "").trim(),
  indicadoresLogro: (competencia.indicadoresLogro || []).map((ind) =>
    typeof ind === "string"
      ? { id: `${competencia.id}-ind-${Math.random().toString(36).slice(2, 7)}`, descripcion: ind }
      : { id: String(ind.id || "").trim(), descripcion: String(ind.descripcion || "").trim() }
  ),
  contenidos: normalizarContenidos(competencia.contenidos),
  competenciasFundamentales: Array.isArray(competencia.competenciasFundamentales)
    ? competencia.competenciasFundamentales
    : [],
});

// ── Importación ────────────────────────────────────────────────────────────────

/**
 * Importa una asignatura individual a Firestore.
 * Sobreescribe el documento existente (upsert).
 */
const importarAsignatura = async (nivel, ciclo, version, fuente, asignatura) => {
  const { grado, area } = asignatura;
  const nombreAsignatura = asignatura.asignatura;
  const competencias = asignatura.competencias;

  const docId = slugCurriculo(nivel, grado, area);
  const ref = doc(db, "diseñoCurricular", docId);

  const payload = {
    nivel,
    ciclo: ciclo || "",
    grado,
    area,
    asignatura: nombreAsignatura || area,
    nivelDominio: String(asignatura.nivelDominio || "").trim(),
    competenciasFundamentales: Array.isArray(asignatura.competenciasFundamentales)
      ? asignatura.competenciasFundamentales
      : [],
    temasCurriculares: Array.isArray(asignatura.temasCurriculares)
      ? asignatura.temasCurriculares
      : [],
    criteriosCombinacionTematica: normalizarCriteriosCombinacion(
      asignatura.criteriosCombinacionTematica
    ),
    contenidosGenerales: normalizarContenidos(asignatura.contenidosGenerales),
    orientacionesMetodologicas: Array.isArray(asignatura.orientacionesMetodologicas)
      ? asignatura.orientacionesMetodologicas
      : [],
    posiblesProductosFinales: Array.isArray(asignatura.posiblesProductosFinales)
      ? asignatura.posiblesProductosFinales
      : [],
    competencias: competencias.map(normalizarCompetencia),
    version: version || "sin_version",
    fuente: fuente || "MINERD",
    importadoEn: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(ref, payload, { merge: false });
  return docId;
};

/**
 * Importa el currículo completo a Firestore (formato con asignaturas[]).
 * @param {object} datos - Objeto JSON con la estructura definida arriba.
 * @param {function} onProgreso - Callback(actual, total, docId) para reportar avance.
 * @returns {{ importados: string[], errores: string[] }}
 */
export const importarCurriculo = async (datos, onProgreso = null) => {
  if (!db) throw new Error("Firebase no está configurado.");

  const { valido, errores: erroresValidacion } = validarEstructuraCurriculo(datos);
  if (!valido) {
    throw new Error(
      `Estructura del currículo inválida:\n${erroresValidacion.join("\n")}`
    );
  }

  const { nivel, ciclo, version, fuente, asignaturas } = datos;
  const importados = [];
  const errores = [];
  const total = asignaturas.length;

  for (let i = 0; i < asignaturas.length; i++) {
    const asignatura = asignaturas[i];
    try {
      const docId = await importarAsignatura(nivel, ciclo, version, fuente, asignatura);
      importados.push(docId);
      if (onProgreso) onProgreso(i + 1, total, docId);
    } catch (error) {
      const msg = `Error en asignatura "${asignatura.grado} / ${asignatura.area}": ${error.message}`;
      errores.push(msg);
      console.error("[curriculumImportService]", msg);
    }
  }

  return { importados, errores };
};

/**
 * Importa una única asignatura desde un objeto plano (sin wrapper asignaturas[]).
 * Formato: { nivel, ciclo, version, fuente, grado, area, asignatura, competencias, ...nuevos_campos }
 */
export const importarAsignaturaSingle = async (datos, onProgreso = null) => {
  if (!db) throw new Error("Firebase no está configurado.");

  const camposRequeridos = ["nivel", "grado", "area", "competencias"];
  const faltantes = camposRequeridos.filter((f) => !datos[f]);
  if (faltantes.length > 0) {
    throw new Error(`Campos requeridos faltantes: ${faltantes.join(", ")}`);
  }
  if (!Array.isArray(datos.competencias) || datos.competencias.length === 0) {
    throw new Error("Debe incluir al menos una competencia.");
  }

  const { nivel, ciclo, version, fuente } = datos;
  const docId = await importarAsignatura(nivel, ciclo, version, fuente, datos);
  if (onProgreso) onProgreso(1, 1, docId);
  return { importados: [docId], errores: [] };
};

/**
 * Detecta el formato del JSON y llama a la función de importación correcta.
 * Soporta tanto el formato completo (asignaturas[]) como el formato simple (asignatura individual).
 */
export const importarAutodetectar = async (datos, onProgreso = null) => {
  if (Array.isArray(datos.asignaturas)) {
    return importarCurriculo(datos, onProgreso);
  }
  if (datos.grado && datos.area && datos.competencias) {
    return importarAsignaturaSingle(datos, onProgreso);
  }
  throw new Error(
    "Formato no reconocido. El JSON debe tener 'asignaturas[]' (formato completo) " +
    "o los campos 'grado', 'area', 'competencias' (formato de asignatura individual)."
  );
};

/**
 * Parsea un string JSON y llama a importarAutodetectar.
 */
export const importarDesdeJSON = async (jsonString, onProgreso = null) => {
  let datos;
  try {
    datos = JSON.parse(jsonString);
  } catch {
    throw new Error(
      "El texto no es un JSON válido. Revisa la estructura e intenta de nuevo."
    );
  }
  return importarAutodetectar(datos, onProgreso);
};

/**
 * Parsea el contenido de un File JSON y llama a importarAutodetectar.
 */
export const importarDesdeArchivo = (archivo, onProgreso = null) => {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = async (e) => {
      try {
        const resultado = await importarDesdeJSON(e.target.result, onProgreso);
        resolve(resultado);
      } catch (error) {
        reject(error);
      }
    };
    lector.onerror = () => reject(new Error("No se pudo leer el archivo."));
    lector.readAsText(archivo, "utf-8");
  });
};

export default {
  validarEstructuraCurriculo,
  importarCurriculo,
  importarAsignaturaSingle,
  importarAutodetectar,
  importarDesdeJSON,
  importarDesdeArchivo,
};
