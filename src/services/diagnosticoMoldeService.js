/**
 * diagnosticoMoldeService.js — "Molde" estructural de la prueba diagnóstica
 *
 * El banco de pruebas oficiales del MINERD (Fase 1) deja de ser lo que el docente
 * aplica directo: pasa a ser el MOLDE/referencia. Este servicio deriva, de una
 * prueba oficial, su PERFIL ESTRUCTURAL (nº de ítems, cuántos abiertos, tipos de
 * estímulo típicos, nº de opciones, tiempo). Es la "receta" de forma y estilo que
 * la IA debe imitar al GENERAR una prueba contextualizada — sin copiar el
 * contenido oficial.
 *
 * Para idiomas (Inglés/Francés), que no tienen prueba oficial en el banco, hay un
 * molde por defecto derivado del área de lenguaje + las destrezas del idioma.
 */

import { cargarPruebaOficial, hayPruebaOficial } from "../data/diagnostico/pruebasOficialesLookup.js";

const _arr = (v) => (Array.isArray(v) ? v : []);
const ES_IDIOMA = (area, asignatura) =>
  /lenguas extranjeras|ingl[eé]s|franc[eé]s/i.test(`${area || ""} ${asignatura || ""}`);
const NOMBRE_IDIOMA = (area, asignatura) =>
  /franc/i.test(`${area || ""} ${asignatura || ""}`) ? "francés" : "inglés";

// Molde por defecto para idiomas: mismo tamaño que las básicas (15 ítems/90 min),
// distribuido por las 4 destrezas comunicativas. Reading/Listening traen estímulo.
const MOLDE_IDIOMA = (area, asignatura) => ({
  origen: "idioma_por_defecto",
  totalItems: 15,
  itemsAbiertos: 3,                 // 1 writing + 2 producción breve
  tiempoMinutos: 90,
  opcionesPorItem: 4,
  tiposEstimulo: ["dialogo", "texto", "infografia"],
  destrezas: ["reading", "listening", "speaking", "writing"], // propio de idiomas
  idioma: NOMBRE_IDIOMA(area, asignatura),
  nota: "Los textos/guiones que trabaja el estudiante van en el idioma meta; las instrucciones pueden ir en español. El listening es un GUION para leer en voz alta (no audio grabado).",
});

// Deriva el perfil estructural de una prueba oficial ya estructurada.
export const derivarMoldeDePrueba = (prueba) => {
  const items = _arr(prueba?.items);
  const estimulos = _arr(prueba?.estimulos);
  const abiertos = items.filter((i) => i.tipo === "abierta").length;
  const tiposEstimulo = [...new Set(estimulos.map((e) => e.tipo).filter(Boolean))];
  const opciones = items
    .filter((i) => i.tipo === "opcion_multiple")
    .map((i) => _arr(i.opciones).length);
  const opcionesPorItem = opciones.length
    ? Math.round(opciones.reduce((a, b) => a + b, 0) / opciones.length)
    : 4;
  return {
    origen: "prueba_oficial",
    totalItems: items.length || 15,
    itemsAbiertos: abiertos,
    tiempoMinutos: prueba?.metadatos?.tiempoMinutos || 90,
    opcionesPorItem,
    tiposEstimulo: tiposEstimulo.length ? tiposEstimulo : ["texto"],
    destrezas: null,                 // las básicas no se organizan por destreza
    idioma: null,
  };
};

// ─── API pública ──────────────────────────────────────────────────────────────
// Obtiene el molde para (área, grado): el de la prueba oficial si existe; si no
// (idiomas, o área sin prueba), el molde por defecto adecuado.
export const obtenerMolde = async ({ area, asignatura, grado, nivel } = {}) => {
  if (ES_IDIOMA(area, asignatura)) {
    return MOLDE_IDIOMA(area, asignatura);
  }
  if (hayPruebaOficial({ area, grado, nivel })) {
    const prueba = await cargarPruebaOficial({ area, grado, nivel });
    if (prueba) return derivarMoldeDePrueba(prueba);
  }
  // Área básica sin prueba oficial para ese grado: molde genérico tipo MINERD.
  return {
    origen: "generico",
    totalItems: 15, itemsAbiertos: 2, tiempoMinutos: 90, opcionesPorItem: 4,
    tiposEstimulo: ["texto", "situacion"], destrezas: null, idioma: null,
  };
};

// Describe el molde en prosa breve para inyectarlo en el prompt de generación.
export const describirMolde = (molde = {}) => {
  const partes = [
    `${molde.totalItems} ítems en total (${molde.itemsAbiertos} de respuesta abierta, el resto de opción múltiple con ${molde.opcionesPorItem} opciones a–d)`,
    `tiempo ${molde.tiempoMinutos} minutos`,
    molde.tiposEstimulo?.length ? `estímulos del tipo: ${molde.tiposEstimulo.join(", ")}` : "",
    molde.destrezas?.length ? `distribuidos por destrezas: ${molde.destrezas.join(", ")}` : "",
    molde.nota || "",
  ].filter(Boolean);
  return partes.join("; ") + ".";
};
