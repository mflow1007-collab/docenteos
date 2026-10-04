// Búsqueda de la PRUEBA DIAGNÓSTICA OFICIAL (MINERD, primer ciclo de Secundaria)
// por área + grado. El módulo de Evaluación Diagnóstica la usa como banco: el
// docente elige una prueba oficial, la aplica, captura resultados y el sistema
// analiza para alimentar la planificación.
//
// Las 12 pruebas viven en src/data/diagnostico/pruebas-oficiales/ (generadas por
// scripts/convertir_pruebas_diagnosticas.mjs a partir del PDF oficial). Se cargan
// BAJO DEMANDA con import.meta.glob (Vite hace code-splitting: solo baja la prueba
// del área+grado pedido, no las 12).

const pruebasGlob = import.meta.glob("./pruebas-oficiales/*.json");

// Área → slug del archivo (calca el slug() del script de conversión).
const slugArea = (area = "") => String(area).toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

const TABLA_GRADO = {
  "1ro": "1ro", primero: "1ro", "1er": "1ro", "1": "1ro",
  "2do": "2do", segundo: "2do", "2": "2do",
  "3ro": "3ro", tercero: "3ro", "3er": "3ro", "3": "3ro",
  "4to": "4to", cuarto: "4to", "4": "4to",
  "5to": "5to", quinto: "5to", "5": "5to",
  "6to": "6to", sexto: "6to", "6": "6to",
};
const normGrado = (g = "") => TABLA_GRADO[String(g).toLowerCase().trim().split(/\s+/)[0]] || "";
const esSecundaria = (nivel = "", grado = "") => /secundar/i.test(`${nivel} ${grado}`) || !nivel;

const ruta = (areaSlug, grado) => `./pruebas-oficiales/prueba_${areaSlug}_${grado}_secundaria.json`;

/** ¿Existe una prueba oficial para este contexto? (área cubierta + grado 1ro–3ro) */
export const hayPruebaOficial = ({ area, grado, grade, nivel, level } = {}) => {
  const g = normGrado(grado || grade);
  if (!g || !["1ro", "2do", "3ro"].includes(g)) return false; // solo primer ciclo
  if (!esSecundaria(nivel || level, grado || grade)) return false;
  return Boolean(pruebasGlob[ruta(slugArea(area), g)]);
};

/** Carga (async) la prueba oficial completa para el contexto, o null si no hay. */
export const cargarPruebaOficial = async ({ area, grado, grade, nivel, level } = {}) => {
  if (!hayPruebaOficial({ area, grado, grade, nivel, level })) return null;
  const g = normGrado(grado || grade);
  const mod = await pruebasGlob[ruta(slugArea(area), g)]();
  return mod?.default || mod || null;
};

/** Lista las pruebas disponibles: [{ area, grado }] derivado de los archivos. */
export const listarPruebasOficiales = () =>
  Object.keys(pruebasGlob)
    .map((k) => k.match(/prueba_(.+)_(\dro|\ddo|\dto)_secundaria\.json$/))
    .filter(Boolean)
    .map((m) => ({ areaSlug: m[1], grado: m[2] }));
