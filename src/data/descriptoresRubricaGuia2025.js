/**
 * descriptoresRubricaGuia2025 — rúbrica del producto (Anexo A) con la plantilla
 * de la Guía de planificación integral 2025 (pp. 40-42): niveles de la
 * taxonomía socioformativa con su porcentaje y descriptores que empiezan por
 * un verbo del nivel, sin adjetivos valorativos.
 *
 * Los 12 descriptores (acción del indicador × nivel) los aprobó César el
 * 2026-10-30. La acción de cada indicador (responde / produce / interactúa)
 * viene de los indicadores estructurados (p. ej. indicadoresIngles2doEstructurados).
 */

export const NIVELES_RUBRICA_GUIA = [
  { clave: "receptivo", nombre: "Receptivo", porcentaje: 55 },
  { clave: "resolutivo", nombre: "Resolutivo", porcentaje: 70 },
  { clave: "autonomo", nombre: "Autónomo", porcentaje: 85 },
  { clave: "estrategico", nombre: "Estratégico", porcentaje: 100 },
];

export const DESCRIPTORES_RUBRICA_POR_ACCION = {
  responde: {
    receptivo: "Identifica la información que se le pide, con apoyo del docente o de imágenes.",
    resolutivo: "Aplica el vocabulario y las estructuras de la unidad para responder a preguntas e indicaciones.",
    autonomo: "Infiere la información que no aparece de forma explícita y responde sin apoyo.",
    estrategico: "Transfiere la información comprendida a una sección del producto o a una situación nueva.",
  },
  produce: {
    receptivo: "Reproduce frases del modelo trabajado, con apoyo del docente.",
    resolutivo: "Elabora un texto oral o escrito siguiendo el modelo trabajado.",
    autonomo: "Integra en su texto el vocabulario y las estructuras de la unidad sin depender del modelo.",
    estrategico: "Crea un texto propio para la audiencia del producto y lo mejora con la retroalimentación.",
  },
  interactua: {
    receptivo: "Reconoce las preguntas de su interlocutor y contesta con palabras o frases aprendidas, con apoyo.",
    resolutivo: "Emplea las expresiones trabajadas para preguntar y responder en un intercambio.",
    autonomo: "Formula y responde preguntas sin apoyo y retoma la conversación cuando se interrumpe.",
    estrategico: "Adapta lo que dice a su interlocutor y a la situación, y resuelve los malentendidos.",
  },
};
