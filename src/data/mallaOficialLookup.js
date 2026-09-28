// Búsqueda de la malla OFICIAL (MINERD 2023) por idioma+grado, para que el
// importador de PDF la use como fuente de verdad / llave de respuestas.
//
// Estrategia en cascada (usada por AdminBancoConocimiento al convertir un PDF):
//   1. hayMallaOficial()      → ¿este grado ya está cubierto? (usar directo)
//   2. completarConOficial()  → rellena lo que la extracción del PDF dejó incompleto
//   3. compararConOficial()   → reporta diferencias para que el docente decida
//
// Las 12 mallas viven en src/data/curriculo/mallas/ (generadas por
// scripts/convertir_curriculo_lenguas.mjs y ya validadas por validateJsonSobre).
// Se cargan BAJO DEMANDA con import.meta.glob (Vite hace code-splitting: solo baja
// el JSON del grado pedido, no los 12).

const mallasGlob = import.meta.glob("./curriculo/mallas/*.json");

const TABLA_GRADO = {
  "1ro": "1ro", primero: "1ro", first: "1ro", "1": "1ro",
  "2do": "2do", segundo: "2do", second: "2do", "2": "2do",
  "3ro": "3ro", tercero: "3ro", third: "3ro", "3": "3ro",
  "4to": "4to", cuarto: "4to", fourth: "4to", "4": "4to",
  "5to": "5to", quinto: "5to", fifth: "5to", "5": "5to",
  "6to": "6to", sexto: "6to", sixth: "6to", "6": "6to",
};
const normGrado = (g = "") => TABLA_GRADO[String(g).toLowerCase().trim().split(/\s+/)[0]] || "";
const idiomaKey = (asignatura = "") => (/fran|french/i.test(asignatura) ? "frances" : /ingl|english/i.test(asignatura) ? "ingles" : "");
const esSecundaria = (nivel = "") => /secundar/i.test(nivel);

const rutaMalla = (idioma, grado) => `./curriculo/mallas/malla_${idioma}_${grado}_secundaria_2023.json`;

/** ¿Existe malla oficial para este contexto? (idiomas + secundaria + grado cubierto) */
export const hayMallaOficial = ({ area, subject, grade, level } = {}) => {
  if (!esSecundaria(level)) return false;
  const esIdioma = /lenguas extranjeras/i.test(area || "") || idiomaKey(subject);
  if (!esIdioma) return false;
  const idioma = idiomaKey(subject);
  const grado = normGrado(grade);
  return Boolean(idioma && grado && mallasGlob[rutaMalla(idioma, grado)]);
};

/** Carga (async) la malla oficial completa para el contexto, o null si no hay. */
export const cargarMallaOficial = async ({ subject, grade, level, area } = {}) => {
  if (!hayMallaOficial({ area, subject, grade, level })) return null;
  const idioma = idiomaKey(subject);
  const grado = normGrado(grade);
  const mod = await mallasGlob[rutaMalla(idioma, grado)]();
  return mod?.default || mod || null;
};

// Cuenta indicadores/competencias/criterios de un sobre (tolerante a su forma).
const contarSobre = (sobre = {}) => {
  const comps = Array.isArray(sobre.competencias) ? sobre.competencias : [];
  const indic = (Array.isArray(sobre.indicadoresLogro) && sobre.indicadoresLogro.length
    ? sobre.indicadoresLogro
    : Array.isArray(sobre.indicadores) ? sobre.indicadores : []);
  const critRaiz = Array.isArray(sobre.criteriosEvaluacion) ? sobre.criteriosEvaluacion : [];
  const critComp = comps.flatMap((c) => (Array.isArray(c?.criteriosEvaluacion) ? c.criteriosEvaluacion : []));
  const criterios = new Set([...critRaiz, ...critComp].map((c) => String(c).trim().toLowerCase()).filter(Boolean));
  return { competencias: comps.length, indicadores: indic.length, criterios: criterios.size };
};

/**
 * PRIORIDAD 3 — Compara el sobre extraído del PDF contra la malla oficial.
 * NO altera datos: solo devuelve un reporte de diferencias.
 */
export const compararConOficial = (sobreExtraido, mallaOficial) => {
  if (!mallaOficial) return null;
  const ext = contarSobre(sobreExtraido);
  const ofi = contarSobre(mallaOficial);
  const dif = [];
  if (ext.competencias < ofi.competencias) dif.push(`Competencias: extraídas ${ext.competencias} de ${ofi.competencias} oficiales.`);
  if (ext.indicadores < ofi.indicadores) dif.push(`Indicadores: extraídos ${ext.indicadores} de ${ofi.indicadores} oficiales.`);
  if (ext.criterios < ofi.criterios) dif.push(`Criterios de evaluación: extraídos ${ext.criterios} de ${ofi.criterios} oficiales.`);
  return {
    coincide: dif.length === 0,
    diferencias: dif,
    conteos: { extraido: ext, oficial: ofi },
  };
};

/**
 * PRIORIDAD 2 — Completa el sobre extraído del PDF con lo que la malla oficial
 * tiene y a la extracción le faltó. Solo RELLENA huecos (no pisa lo que el PDF sí
 * trajo bien): si la extracción tiene menos indicadores/criterios que la oficial,
 * adopta los de la oficial. Devuelve un sobre nuevo (no muta el original).
 */
export const completarConOficial = (sobreExtraido = {}, mallaOficial) => {
  if (!mallaOficial) return { sobre: sobreExtraido, completado: false, cambios: [] };
  const ext = contarSobre(sobreExtraido);
  const ofi = contarSobre(mallaOficial);
  const cambios = [];
  const sobre = { ...sobreExtraido };

  if (ext.competencias < ofi.competencias) {
    sobre.competencias = mallaOficial.competencias;
    sobre.competenciasFundamentales = mallaOficial.competenciasFundamentales;
    cambios.push(`competencias (${ext.competencias}→${ofi.competencias})`);
  }
  if (ext.indicadores < ofi.indicadores) {
    sobre.indicadoresLogro = mallaOficial.indicadoresLogro;
    sobre.indicadores = mallaOficial.indicadores || mallaOficial.indicadoresLogro;
    cambios.push(`indicadores (${ext.indicadores}→${ofi.indicadores})`);
  }
  if (ext.criterios < ofi.criterios) {
    sobre.criteriosEvaluacion = mallaOficial.criteriosEvaluacion;
    // Si se adoptaron competencias oficiales, ya traen sus criterios anidados.
    cambios.push(`criterios (${ext.criterios}→${ofi.criterios})`);
  }
  return { sobre, completado: cambios.length > 0, cambios };
};
