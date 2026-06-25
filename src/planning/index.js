/**
 * Index del módulo de planificación
 * Exporta todos los componentes y funcionalidades del motor de planificación
 */

// Catálogos y enumeraciones
export {
  MODO,
  TIPO_EVAL,
  AGENTE_EVAL,
  TIPO_INSTRUMENTO,
  TIPO_RECURSO,
  ESTRATEGIAS_ENSENANZA,
  ADECUACIONES_NEAE,
  MOMENTOS_PEDAGOGICOS,
  CRITERIOS_RUBRICA_STANDARD,
  NIVELES_DESEMPENIO,
  AREAS_PRIMARIA,
  AREAS_SECUNDARIA,
  AREAS_IDIOMAS,
  PROPOSITOS_POR_AREA,
} from "./catalogs.js";

// Generadores de situaciones
export { generarSituacion } from "./generarSituacion.js";

// Generadores de días
export { generarDia, generarMomento } from "./generarDias.js";

// Generadores de semanas
export { generarSemana, generarSemanas } from "./generarSemanas.js";

// Generadores de evaluación
export {
  generarRubrica,
  generarListaCotejo,
  generarRegistroAnecdotico,
  generarAutoevaluacion,
  generarCoevaluacion,
  generarMatrizEvaluacion,
  generarAdecuacionesEvaluacionNEAE,
} from "./generarEvaluacion.js";

// Motor principal
export { generarPlanificacion, engines } from "./planificacionEngine.js";

// Generadores de PDF
export { generarPDFHTML, generarTextoPlano } from "./generarPDF.js";

/**
 * Función facade para generar planificación completa con PDF
 * Uso simplificado para el frontend
 */
export const generarPlanificacionCompleta = async (params) => {
  const { generarPlanificacion: engine } = await import(
    "./planificacionEngine.js"
  );
  const { generarPDFHTML } = await import("./generarPDF.js");

  // Generar planificación
  const planificacion = await engine(params);

  // Generar HTML para PDF
  const htmlPDF = generarPDFHTML(planificacion);

  return {
    planificacion,
    htmlPDF,
    exportarPDF: () => descargaPDF(htmlPDF, params.tema || "planificacion"),
  };
};

/**
 * Helper para descargar PDF (requiere html2pdf o similar en el navegador)
 */
const descargaPDF = (html, nombreArchivo = "planificacion") => {
  if (typeof window !== "undefined" && window.html2pdf) {
    const elemento = document.createElement("div");
    elemento.innerHTML = html;
    window.html2pdf().set({ margin: 10, filename: `${nombreArchivo}.pdf` }).save();
  } else {
    console.warn(
      "html2pdf no disponible. Asegúrate de cargar la librería en el HTML.",
    );
  }
};

export default {
  generarPlanificacionCompleta,
};
