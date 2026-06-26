/**
 * Motor de acciones aplicables de la Auditoría Pedagógica IA.
 *
 * La auditoría devuelve, además del informe en texto, un bloque JSON con
 * "accionesAplicables". Este módulo:
 *   1. Separa el informe legible del bloque JSON  → parseAuditoria()
 *   2. Aplica una acción concreta sobre la unidad → applyAuditAction()
 *
 * Aplicar una acción NO llama a la IA: trabaja en memoria sobre el objeto
 * unidad y devuelve una copia modificada (0 tokens). El docente luego guarda
 * la unidad con el flujo normal.
 */

const DELIM_INICIO = "===ACCIONES_JSON===";
const DELIM_FIN = "===FIN_ACCIONES===";

// Secciones soportadas por el motor. Cada una declara si su valor es texto
// (string) o lista (array), y qué localizador necesita.
const SECCIONES = {
  "metadatos.productoFinal":      { tipoValor: "string", etiqueta: "Producto final" },
  "situacionAprendizaje":         { tipoValor: "string", etiqueta: "Situación de aprendizaje" },
  "ambienteAprendizaje":          { tipoValor: "string", etiqueta: "Ambiente de aprendizaje" },
  "competencias.especifica":      { tipoValor: "string", etiqueta: "Competencia específica" },
  "competencias.indicadores":     { tipoValor: "array",  etiqueta: "Indicadores de logro" },
  "contenidos.conceptuales":      { tipoValor: "array",  etiqueta: "Contenidos conceptuales" },
  "contenidos.procedimentales":   { tipoValor: "array",  etiqueta: "Contenidos procedimentales" },
  "contenidos.actitudinales":     { tipoValor: "array",  etiqueta: "Contenidos actitudinales" },
  "momento.actividades":          { tipoValor: "array",  etiqueta: "Actividades de un momento", localizador: ["faseNumero", "diaGlobal", "momentoNombre"] },
  "dia.adaptacionesNEAE":         { tipoValor: "neae",   etiqueta: "Adaptaciones NEAE", localizador: ["faseNumero", "diaGlobal"] },
  "fase.posiblesDificultades":    { tipoValor: "string", etiqueta: "Posibles dificultades", localizador: ["faseNumero"] },
};

/** Lista de claves de sección válidas (para construir el prompt y validar). */
export const SECCIONES_VALIDAS = Object.keys(SECCIONES);

/** Etiqueta legible de una acción para mostrar en la interfaz. */
export const etiquetaSeccion = (seccion) =>
  SECCIONES[seccion]?.etiqueta || seccion || "Sección";

/** Clona la unidad de forma segura (datos planos). */
const clonar = (obj) => JSON.parse(JSON.stringify(obj));

/** Normaliza el contenido nuevo a array de strings cuando la sección es lista. */
const aLista = (valor) => {
  if (Array.isArray(valor)) return valor.map((v) => String(v));
  if (valor === undefined || valor === null) return [];
  return [String(valor)];
};

/**
 * Separa el informe legible del bloque JSON de acciones.
 * @param {string} texto - Respuesta completa de la auditoría.
 * @returns {{ informe: string, acciones: Array }}
 */
export const parseAuditoria = (texto = "") => {
  const idx = texto.indexOf(DELIM_INICIO);
  if (idx === -1) {
    return { informe: texto.trim(), acciones: [] };
  }

  const informe = texto.slice(0, idx).trim();
  let bloque = texto.slice(idx + DELIM_INICIO.length);

  const finIdx = bloque.indexOf(DELIM_FIN);
  if (finIdx !== -1) bloque = bloque.slice(0, finIdx);

  // Quitar posibles cercas de código markdown.
  bloque = bloque.replace(/```json/gi, "").replace(/```/g, "").trim();

  // Extraer desde el primer "{" hasta el último "}".
  const primero = bloque.indexOf("{");
  const ultimo = bloque.lastIndexOf("}");
  if (primero === -1 || ultimo === -1 || ultimo <= primero) {
    return { informe, acciones: [] };
  }

  let acciones = [];
  try {
    const data = JSON.parse(bloque.slice(primero, ultimo + 1));
    const lista = Array.isArray(data) ? data : data.accionesAplicables;
    if (Array.isArray(lista)) {
      acciones = lista.filter((a) => a && SECCIONES[a.seccion]);
    }
  } catch {
    acciones = [];
  }

  return { informe, acciones };
};

/** Indica si una respuesta ya contiene el inicio del bloque de acciones. */
export const tieneBloqueAcciones = (texto = "") => texto.includes(DELIM_INICIO);

/** Devuelve solo la parte del informe (útil durante el streaming). */
export const soloInforme = (texto = "") => {
  const idx = texto.indexOf(DELIM_INICIO);
  return idx === -1 ? texto : texto.slice(0, idx);
};

/**
 * Aplica una acción sobre la unidad y devuelve una copia modificada.
 * No muta la unidad original ni llama a la IA.
 *
 * @param {Object} unidad - Unidad de aprendizaje actual.
 * @param {Object} accion - Acción aplicable de la auditoría.
 * @returns {{ ok: boolean, unidad?: Object, error?: string }}
 */
export const applyAuditAction = (unidad, accion) => {
  if (!unidad) return { ok: false, error: "No hay unidad cargada." };
  if (!accion || !SECCIONES[accion.seccion]) {
    return { ok: false, error: "Sección no soportada." };
  }

  const meta = SECCIONES[accion.seccion];
  const tipo = accion.tipo === "insertar" ? "insertar" : "reemplazar";
  const u = clonar(unidad);

  try {
    switch (accion.seccion) {
      case "metadatos.productoFinal":
        u.metadatos = u.metadatos || {};
        u.metadatos.productoFinal = String(accion.contenidoNuevo ?? "");
        break;

      case "situacionAprendizaje":
        u.situacionAprendizaje = String(accion.contenidoNuevo ?? "");
        break;

      case "ambienteAprendizaje":
        u.ambienteAprendizaje = String(accion.contenidoNuevo ?? "");
        break;

      case "competencias.especifica":
        u.competencias = u.competencias || {};
        u.competencias.especifica = String(accion.contenidoNuevo ?? "");
        break;

      case "competencias.indicadores": {
        u.competencias = u.competencias || {};
        const previos = Array.isArray(u.competencias.indicadores) ? u.competencias.indicadores : [];
        const nuevos = aLista(accion.contenidoNuevo);
        u.competencias.indicadores = tipo === "insertar" ? [...previos, ...nuevos] : nuevos;
        break;
      }

      case "contenidos.conceptuales":
      case "contenidos.procedimentales":
      case "contenidos.actitudinales": {
        const clave = accion.seccion.split(".")[1];
        u.contenidos = u.contenidos || {};
        const previos = Array.isArray(u.contenidos[clave]) ? u.contenidos[clave] : [];
        const nuevos = aLista(accion.contenidoNuevo);
        u.contenidos[clave] = tipo === "insertar" ? [...previos, ...nuevos] : nuevos;
        break;
      }

      case "momento.actividades": {
        const { momento } = localizar(u, accion.locator, meta);
        const previas = Array.isArray(momento.actividades) ? momento.actividades : [];
        const nuevas = aLista(accion.contenidoNuevo);
        momento.actividades = tipo === "insertar" ? [...previas, ...nuevas] : nuevas;
        break;
      }

      case "dia.adaptacionesNEAE": {
        const { dia } = localizar(u, accion.locator, meta);
        const cn = accion.contenidoNuevo;
        if (cn && typeof cn === "object" && !Array.isArray(cn)) {
          dia.adaptacionesNEAE = {
            acceso:        cn.acceso        ?? dia.adaptacionesNEAE?.acceso        ?? "",
            metodologicas: cn.metodologicas ?? dia.adaptacionesNEAE?.metodologicas ?? "",
            evaluacion:    cn.evaluacion    ?? dia.adaptacionesNEAE?.evaluacion    ?? "",
          };
        } else {
          dia.adaptacionesNEAE = {
            ...(dia.adaptacionesNEAE || {}),
            metodologicas: String(cn ?? ""),
          };
        }
        break;
      }

      case "fase.posiblesDificultades": {
        const { fase } = localizar(u, accion.locator, meta);
        fase.posiblesDificultades = String(accion.contenidoNuevo ?? "");
        break;
      }

      default:
        return { ok: false, error: "Sección no soportada." };
    }
  } catch (err) {
    return { ok: false, error: err.message || "No se pudo aplicar la acción." };
  }

  return { ok: true, unidad: u };
};

/**
 * Resuelve fase / día / momento dentro de la unidad a partir del localizador.
 * Lanza un Error descriptivo si no encuentra el objetivo.
 */
function localizar(u, locator = {}, meta) {
  const requeridos = meta.localizador || [];
  for (const campo of requeridos) {
    if (locator?.[campo] === undefined || locator?.[campo] === null) {
      throw new Error(`Falta el localizador "${campo}" para aplicar la acción.`);
    }
  }

  const resultado = {};

  if (requeridos.includes("faseNumero")) {
    const fase = (u.fasesSemanales || []).find(
      (f) => String(f.numero) === String(locator.faseNumero)
    );
    if (!fase) throw new Error(`No se encontró la fase ${locator.faseNumero}.`);
    resultado.fase = fase;

    if (requeridos.includes("diaGlobal")) {
      const dia = (fase.dias || []).find(
        (d) => String(d.numeroGlobal) === String(locator.diaGlobal)
      );
      if (!dia) throw new Error(`No se encontró la clase ${locator.diaGlobal} en la fase ${locator.faseNumero}.`);
      resultado.dia = dia;

      if (requeridos.includes("momentoNombre")) {
        const objetivo = String(locator.momentoNombre).toLowerCase();
        const momento = (dia.momentos || []).find(
          (m) => String(m.nombre).toLowerCase() === objetivo
        );
        if (!momento) throw new Error(`No se encontró el momento "${locator.momentoNombre}" en la clase ${locator.diaGlobal}.`);
        resultado.momento = momento;
      }
    }
  }

  return resultado;
}
