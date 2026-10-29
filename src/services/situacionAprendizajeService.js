/**
 * situacionAprendizajeService — Situación de aprendizaje de la unidad (Etapa 4
 * de docs/DISENO_CORAZON_DOCENTEOS.md, reglas 4.1 y 4.7).
 *
 * Código determinista, sin IA ni Firebase:
 * - La situación se guarda por elementos (Guía 1.2.2): problema · contexto ·
 *   estrategia + rol del estudiante · producto · punto de llegada. El texto se
 *   compone a partir de ellos (uno o dos párrafos, máx. 8 líneas ≈ 800
 *   caracteres) y el validador comprueba los cinco.
 * - La estrategia la elige el docente; DocenteOS la recomienda con los
 *   criterios de la Guía 1.2.4 (naturaleza, contexto, producto y su alcance,
 *   punto de llegada), explica por qué y da 1-2 alternativas.
 * - Si el docente cambia la estrategia, la situación se realinea (rol del
 *   estudiante y alcance del producto) y el docente ve antes y después antes
 *   de aceptarlo.
 * - Secciones del producto (4.7): las propone la situación semilla y el
 *   docente las ajusta.
 *
 * Estado en datos.planMaestro (solo en la sesión): `situacion` y `secciones`.
 * El nombre del producto es datos.productoFinalTexto (se escribe una vez).
 * Desde la Etapa 5 el generador usa esta situación (componerSituacion) en lugar
 * de construirSituacionNarrativa donde hay vista previa.
 * Verificación: scripts/test-situacion-aprendizaje.mjs
 */

import { ESTRATEGIAS_FASES_GUIA_2025 } from "../data/estrategiasFasesGuia2025.js";
import { ROLES_FASES_POR_ESTRATEGIA } from "../data/rolesFasesEstrategias.js";
import { SITUACIONES_SEMILLA_INGLES_2DO } from "../data/situacionesSemillaIngles2do.js";

// Guía 1.2.2: "máximo ocho líneas". Una línea impresa ≈ 100 caracteres.
export const MAX_CARACTERES_SITUACION = 800;

// Guía 1.2.2: el punto de llegada se orienta a estas competencias.
export const COMPETENCIAS_LLEGADA = {
  etica_ciudadana: "Ética y Ciudadana",
  desarrollo_personal: "Desarrollo Personal y Espiritual",
  ambiental_salud: "Ambiental y de la Salud",
};

// Criterios de la Guía 1.2.4 para elegir la estrategia. Las opciones y los
// puntos son la interpretación de DocenteOS (pendiente de aprobación de César).
export const CRITERIOS_ESTRATEGIA = {
  naturaleza: {
    etiqueta: "Naturaleza de la situación",
    opciones: {
      necesidad: { texto: "una necesidad concreta que los estudiantes pueden resolver", puntos: { proyectos: 3, insercion_entorno: 1, problemas: 1 } },
      problema_abierto: { texto: "un problema abierto que hay que investigar antes de proponer", puntos: { problemas: 3, estudio_caso: 1, insercion_entorno: 1 } },
      caso: { texto: "un caso concreto que hay que analizar para decidir", puntos: { estudio_caso: 3, problemas: 1 } },
      fenomeno: { texto: "una pregunta o fenómeno que hay que comprender a partir de fuentes", puntos: { indagacion_dialogica: 3, expositiva: 1 } },
      saberes: { texto: "un tema cercano sobre el que los estudiantes ya saben algo", puntos: { conocimientos_previos: 3, indagacion_dialogica: 1, expositiva: 1 } },
    },
  },
  contexto: {
    etiqueta: "Contexto",
    opciones: {
      aula: { texto: "se trabaja dentro del aula", puntos: { conocimientos_previos: 1, expositiva: 1, indagacion_dialogica: 1 } },
      escuela: { texto: "ocurre en la escuela, donde los estudiantes pueden actuar", puntos: { proyectos: 1, problemas: 1 } },
      comunidad: { texto: "exige salir a la comunidad a observar, entrevistar o recoger datos", puntos: { insercion_entorno: 3 } },
    },
  },
  alcance: {
    etiqueta: "Producto y su alcance",
    opciones: {
      resuelve: { texto: "el producto se usa de verdad y resuelve la necesidad", puntos: { proyectos: 3 } },
      propone: { texto: "el producto es una propuesta que se presenta a quienes pueden ponerla en marcha", puntos: { problemas: 3, insercion_entorno: 1 } },
      concluye: { texto: "el producto recoge conclusiones o una decisión sobre el caso", puntos: { estudio_caso: 3 } },
      presenta: { texto: "el producto presenta los resultados de una indagación", puntos: { indagacion_dialogica: 3 } },
      expone: { texto: "el producto es una exposición de conocimientos elaborados", puntos: { expositiva: 3 } },
      comparte: { texto: "el producto reúne y comparte lo que el grupo sabía y aprendió", puntos: { conocimientos_previos: 3 } },
    },
  },
  llegada: {
    etiqueta: "Punto de llegada",
    opciones: {
      actuar: { texto: "los estudiantes actúan y sirven a otros", puntos: { proyectos: 1, insercion_entorno: 1 } },
      participar: { texto: "los estudiantes participan y proponen ante otros", puntos: { problemas: 1, indagacion_dialogica: 1 } },
      reflexionar: { texto: "los estudiantes reflexionan y valoran", puntos: { estudio_caso: 1, conocimientos_previos: 1, expositiva: 1 } },
    },
  },
};

// Qué es cada estrategia, para la explicación. ABProyecto y ABProblemas, según
// la Guía 1.2.4; las demás, según sus fases (Guía, p. 22).
const SENTIDO_ESTRATEGIA = {
  proyectos: "En ABProyecto los estudiantes resuelven un problema real (Guía 1.2.4).",
  problemas: "En ABProblemas el problema real o simulado se investiga y queda como propuesta socializada con los actores (Guía 1.2.4).",
  estudio_caso: "El Estudio de caso indaga un caso concreto, lo socializa y cierra con conclusiones (fases de la Guía, p. 22).",
  indagacion_dialogica: "La Indagación dialógica valida fuentes, organiza la información y presenta resultados (fases de la Guía, p. 22).",
  insercion_entorno: "La Inserción en el entorno visita el entorno, recoge y analiza datos y elabora propuestas que se aplican (fases de la Guía, p. 22).",
  conocimientos_previos: "La Exploración de conocimientos previos recupera y contrasta lo que ya se sabe antes del nuevo conocimiento (fases de la Guía, p. 22).",
  expositiva: "La Expositiva busca y analiza información y la expone (fases de la Guía, p. 22).",
};

// Cómo entra cada estrategia en la situación: rol del estudiante y alcance del
// producto. Es lo que se realinea al cambiar de estrategia.
const ESTRATEGIA_EN_SITUACION = {
  proyectos: {
    rol: "asumen el rol de gestores de un proyecto: planifican, reúnen la información y elaboran por entregas",
    producto: (p) => `${p.nombre}, ${p.descripcion}, que pondrán en uso con ${p.audiencia}`,
  },
  problemas: {
    rol: "asumen el rol de investigadores del problema: definen sus causas, formulan objetivos y analizan alternativas para elaborar",
    producto: (p) => `como propuesta ${p.nombre}, ${p.descripcion}, que socializarán con ${p.audiencia}`,
  },
  estudio_caso: {
    rol: "asumen el rol de analistas de un caso: lo indagan, lo socializan y recogen sus conclusiones en",
    producto: (p) => `${p.nombre}, ${p.descripcion}, que compartirán con ${p.audiencia}`,
  },
  indagacion_dialogica: {
    rol: "asumen el rol de indagadores: recogen lo que saben, validan fuentes, organizan la información y construyen",
    producto: (p) => `${p.nombre}, ${p.descripcion}, cuyos resultados presentarán a ${p.audiencia}`,
  },
  insercion_entorno: {
    rol: "asumen el rol de investigadores de campo: visitan el entorno, recogen datos con sus propios instrumentos, los analizan y elaboran",
    producto: (p) => `${p.nombre}, ${p.descripcion}, con propuestas que aplicarán y socializarán con ${p.audiencia}`,
  },
  conocimientos_previos: {
    rol: "asumen el rol de exploradores de sus saberes: recuperan y contrastan lo que ya saben, incorporan el nuevo conocimiento y lo plasman en",
    producto: (p) => `${p.nombre}, ${p.descripcion}, que compartirán con ${p.audiencia}`,
  },
  expositiva: {
    rol: "asumen el rol de expositores: buscan y analizan información y producen",
    producto: (p) => `${p.nombre}, ${p.descripcion}, que expondrán ante ${p.audiencia}`,
  },
};

// Regla 4.1: el problema no es "no saben inglés".
// También el molde anterior: "presentan dificultades para … en inglés".
const RE_PROBLEMA_IDIOMA = /\bno (saben|hablan|dominan|entienden|manejan) (bien )?(hablar )?(el |en )?(ingl[eé]s|franc[eé]s|idioma)\b|\bdificultad(es)? (para|con|en) (el )?(ingl[eé]s|franc[eé]s|idioma)\b|\bdificultades para [^.]*\ben (ingl[eé]s|franc[eé]s)\b/i;

const error = (msg) => new Error(`Situación: ${msg}`);
const limpio = (t) => String(t || "").trim();
const sinPuntoFinal = (t) => limpio(t).replace(/[.\s]+$/, "");
const conPuntoFinal = (t) => (limpio(t) ? `${sinPuntoFinal(t)}.` : "");
const datosEstrategia = (clave) => ESTRATEGIAS_FASES_GUIA_2025.find((e) => e.clave === clave);
export const estrategiaDisponible = (clave) => Boolean(ROLES_FASES_POR_ESTRATEGIA[clave]);

// ── Situaciones propuestas ──────────────────────────────────────────────────

/** Situaciones semilla para los temas de la unidad (vacío si no hay). */
export const propuestasParaTemas = (temas = []) =>
  SITUACIONES_SEMILLA_INGLES_2DO.filter((s) => temas.includes(s.tema));

export const situacionVacia = () => ({
  origen: "real",
  semillaId: null,
  contexto: "",
  problema: "",
  productoDescripcion: "",
  audiencia: "",
  puntoDeLlegada: "",
  competenciasLlegada: [],
  rasgos: { naturaleza: "", contexto: "", alcance: "", llegada: "" },
  rolPropio: "",
  estrategiaAlineada: null,
});

// Artículo según la primera palabra del nombre del centro; si no se reconoce,
// "el centro <nombre>".
const ARTICULO_CENTRO = { centro: "el", liceo: "el", politecnico: "el", instituto: "el", colegio: "el", complejo: "el", escuela: "la", unidad: "la", academia: "la" };

/**
 * Lugar de la situación a partir del centro del formulario ("Centro X - Comunidad").
 * Regla de César: se nombra el centro; la comunidad, solo si la situación
 * ocurre fuera del centro. Sin dato, un genérico (nunca se inventa).
 */
export const lugaresDelCentro = (centro = "") => {
  const texto = limpio(centro);
  const corte = texto.lastIndexOf(" - ") >= 0 ? texto.lastIndexOf(" - ") : texto.lastIndexOf("-");
  const nombre = limpio(corte >= 0 ? texto.slice(0, corte) : texto);
  const comunidad = limpio(corte >= 0 ? texto.slice(corte + 1).replace(/^-\s*/, "") : "");
  const primera = nombre.split(/\s+/)[0].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const articulo = ARTICULO_CENTRO[primera];
  return {
    centro: !nombre ? "el centro" : articulo ? `${articulo} ${nombre}` : `el centro ${nombre}`,
    comunidad: comunidad || "la comunidad",
  };
};

const ponerLugar = (texto, lugares) => texto.replace(/\{(centro|comunidad)\}/g, (_, k) => lugares[k]);

export const situacionDesdeSemilla = (semilla, { centro = "" } = {}) => ({
  ...situacionVacia(),
  origen: "simulada",
  semillaId: semilla.id,
  contexto: ponerLugar(semilla.contexto, lugaresDelCentro(centro)),
  problema: semilla.problema,
  productoDescripcion: semilla.producto.descripcion,
  audiencia: semilla.producto.audiencia,
  puntoDeLlegada: semilla.puntoDeLlegada,
  competenciasLlegada: [...semilla.competenciasLlegada],
  rasgos: { ...semilla.rasgos },
});

// ── Texto y validación ─────────────────────────────────────────────────────

/** Los cinco elementos de la Guía 1.2.2, con la estrategia `estrategia`. */
export const elementosSituacion = ({ situacion, producto, estrategia }) => {
  const s = situacion || situacionVacia();
  const e = datosEstrategia(estrategia);
  const enSituacion = ESTRATEGIA_EN_SITUACION[estrategia];
  const p = { nombre: sinPuntoFinal(producto), descripcion: limpio(s.productoDescripcion), audiencia: sinPuntoFinal(s.audiencia) };
  return {
    problema: limpio(s.problema),
    contexto: limpio(s.contexto),
    estrategia: e?.nombre || "",
    rolEstudiante: sinPuntoFinal(s.rolPropio) || enSituacion?.rol || "",
    producto: enSituacion && p.nombre && p.descripcion && p.audiencia ? enSituacion.producto(p) : "",
    puntoDeLlegada: limpio(s.puntoDeLlegada),
  };
};

/** Uno o dos párrafos: contexto y problema → estrategia, rol y producto → punto de llegada. */
export const componerSituacion = (args) => {
  const el = elementosSituacion(args);
  const accion = el.estrategia && el.rolEstudiante
    ? `Mediante la estrategia ${el.estrategia}, los estudiantes ${el.rolEstudiante}${el.producto ? ` ${el.producto}` : ""}.`
    : "";
  return [conPuntoFinal(el.contexto), conPuntoFinal(el.problema), accion, conPuntoFinal(el.puntoDeLlegada)]
    .filter(Boolean).join(" ");
};

/**
 * Valida la situación para la estrategia elegida.
 * @returns {{texto: string, errores: string[]}}
 */
export const validarSituacion = ({ situacion, producto, estrategia }) => {
  if (!situacion) return { texto: "", errores: ["elige una situación propuesta o escribe la tuya."] };
  const errores = [];
  const alineada = situacion.estrategiaAlineada || estrategia;
  const el = elementosSituacion({ situacion, producto, estrategia: alineada });
  if (!el.problema) errores.push("falta el problema o la necesidad.");
  else if (RE_PROBLEMA_IDIOMA.test(el.problema)) errores.push("el problema no puede ser que no saben el idioma: describe una necesidad que el idioma ayuda a resolver.");
  if (!el.contexto) errores.push("falta el contexto.");
  if (!estrategia) errores.push("elige la estrategia de la unidad.");
  else if (!datosEstrategia(estrategia)) errores.push(`la estrategia "${estrategia}" no está en la Guía 2025.`);
  else if (situacion.estrategiaAlineada && situacion.estrategiaAlineada !== estrategia) {
    errores.push("cambiaste la estrategia: revisa la situación realineada y acéptala o vuelve a la anterior.");
  }
  if (!limpio(producto)) errores.push("falta el nombre del producto.");
  if (!limpio(situacion.productoDescripcion)) errores.push("falta qué es el producto (p. ej. una guía bilingüe de la escuela).");
  if (!limpio(situacion.audiencia)) errores.push("falta a quién va dirigido el producto.");
  if (!el.puntoDeLlegada) errores.push("falta el punto de llegada.");
  const comps = situacion.competenciasLlegada || [];
  if (!comps.length) errores.push(`marca a qué competencia se orienta el punto de llegada (${Object.values(COMPETENCIAS_LLEGADA).join(", ")}).`);
  comps.forEach((c) => { if (!COMPETENCIAS_LLEGADA[c]) errores.push(`"${c}" no es una competencia del punto de llegada.`); });
  const texto = componerSituacion({ situacion, producto, estrategia: alineada });
  if (texto.length > MAX_CARACTERES_SITUACION) {
    errores.push(`la situación tiene ${texto.length} caracteres; el máximo es ${MAX_CARACTERES_SITUACION} (unas 8 líneas). Acorta algún elemento.`);
  }
  return { texto, errores };
};

// ── Recomendación de estrategia (Guía 1.2.4) ───────────────────────────────

const ORDEN_GUIA = ESTRATEGIAS_FASES_GUIA_2025.map((e) => e.clave);

/**
 * Puntúa las 7 estrategias con los rasgos de la situación. En empate gana la
 * que ya tiene fases disponibles y después el orden de la Guía.
 * @returns {{recomendada, alternativas, mejorDisponible, ranking}} cada una
 *   {clave, nombre, puntos, disponible, porque: string[], sentido}
 */
export const recomendarEstrategia = (rasgos = {}) => {
  const faltan = Object.entries(CRITERIOS_ESTRATEGIA)
    .filter(([criterio, def]) => !def.opciones[rasgos[criterio]])
    .map(([, def]) => def.etiqueta.toLowerCase());
  if (faltan.length) throw error(`para recomendar la estrategia falta: ${faltan.join(", ")}.`);
  const ranking = ORDEN_GUIA.map((clave) => {
    const porque = [];
    let puntos = 0;
    Object.entries(CRITERIOS_ESTRATEGIA).forEach(([criterio, def]) => {
      const opcion = def.opciones[rasgos[criterio]];
      const p = opcion.puntos[clave] || 0;
      puntos += p;
      if (p > 0) porque.push(`${def.etiqueta}: ${opcion.texto}.`);
    });
    return {
      clave, nombre: datosEstrategia(clave).nombre, puntos, porque,
      disponible: estrategiaDisponible(clave), sentido: SENTIDO_ESTRATEGIA[clave],
    };
  }).sort((a, b) => b.puntos - a.puntos || Number(b.disponible) - Number(a.disponible)
    || ORDEN_GUIA.indexOf(a.clave) - ORDEN_GUIA.indexOf(b.clave));
  const [recomendada, ...resto] = ranking;
  return {
    recomendada,
    alternativas: resto.filter((e) => e.puntos > 0).slice(0, 2),
    mejorDisponible: ranking.find((e) => e.disponible) || null,
    ranking,
  };
};

// ── Realineación ───────────────────────────────────────────────────────────

/** Antes y después si la estrategia elegida no es con la que se compuso la situación. */
export const compararRealineacion = ({ situacion, producto, estrategia }) => {
  if (!situacion?.estrategiaAlineada || !estrategia || situacion.estrategiaAlineada === estrategia) return null;
  return {
    desde: datosEstrategia(situacion.estrategiaAlineada)?.nombre || situacion.estrategiaAlineada,
    hacia: datosEstrategia(estrategia)?.nombre || estrategia,
    antes: componerSituacion({ situacion, producto, estrategia: situacion.estrategiaAlineada }),
    despues: componerSituacion({ situacion: { ...situacion, rolPropio: "" }, producto, estrategia }),
  };
};

// ── Ajustes (puros: reciben planMaestro y devuelven uno nuevo) ──────────────

/** La primera estrategia que se elige alinea la situación sin preguntar (no había texto que cambiar). */
export const alinearSiNoHay = (pm) => (pm.situacion && !pm.situacion.estrategiaAlineada && pm.estrategia
  ? { ...pm, situacion: { ...pm.situacion, estrategiaAlineada: pm.estrategia } }
  : pm);

export const usarSemilla = (pm, semilla, { centro = "" } = {}) => alinearSiNoHay({
  ...pm, situacion: situacionDesdeSemilla(semilla, { centro }), secciones: [...semilla.secciones],
});

export const escribirSituacionPropia = (pm) => alinearSiNoHay({ ...pm, situacion: situacionVacia(), secciones: [] });

export const aceptarRealineacion = (pm) => ({
  ...pm, situacion: { ...pm.situacion, estrategiaAlineada: pm.estrategia, rolPropio: "" },
});

export const fijarCampoSituacion = (pm, campo, valor) => ({ ...pm, situacion: { ...pm.situacion, [campo]: valor } });

export const fijarRasgo = (pm, criterio, valor) => ({
  ...pm, situacion: { ...pm.situacion, rasgos: { ...pm.situacion.rasgos, [criterio]: valor } },
});

export const alternarCompetenciaLlegada = (pm, clave) => {
  const actuales = pm.situacion.competenciasLlegada || [];
  const siguientes = actuales.includes(clave)
    ? actuales.filter((c) => c !== clave)
    : Object.keys(COMPETENCIAS_LLEGADA).filter((c) => c === clave || actuales.includes(c));
  return fijarCampoSituacion(pm, "competenciasLlegada", siguientes);
};

// ── Secciones del producto (4.7) ────────────────────────────────────────────

export const validarSecciones = (secciones = []) => {
  const errores = [];
  const nombres = secciones.map(limpio);
  if (nombres.length < 2) errores.push("el producto necesita al menos 2 secciones.");
  if (nombres.some((n) => !n)) errores.push("hay una sección sin nombre.");
  const repetidas = [...new Set(nombres.filter((n, i) => n && nombres.indexOf(n) !== i))];
  if (repetidas.length) errores.push(`secciones repetidas: ${repetidas.join(", ")}.`);
  return errores;
};

export const agregarSeccion = (pm, nombre = "") => ({ ...pm, secciones: [...(pm.secciones || []), nombre] });

export const renombrarSeccion = (pm, i, nombre) => ({
  ...pm, secciones: pm.secciones.map((s, k) => (k === i ? nombre : s)),
});

export const quitarSeccion = (pm, i) => ({ ...pm, secciones: pm.secciones.filter((_, k) => k !== i) });

export const moverSeccion = (pm, i, delta) => {
  const j = i + delta;
  if (j < 0 || j >= pm.secciones.length) return pm;
  const secciones = [...pm.secciones];
  [secciones[i], secciones[j]] = [secciones[j], secciones[i]];
  return { ...pm, secciones };
};
