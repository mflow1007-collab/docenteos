/**
 * estrategiasFasesGuia2025 — Las 7 estrategias de enseñanza-aprendizaje con sus
 * fases LITERALES (Etapa 1 de docs/DISENO_CORAZON_DOCENTEOS.md).
 * Fuente: Guía de planificación integral para docentes de Secundaria (MINERD,
 * Jornada 2025), p. 22, tabla "Fases de las estrategias de enseñanza-aprendizaje"
 * (la Guía dice que la matriz viene de la Adecuación Curricular del Nivel
 * Secundario). Texto tal como está impreso, incluidos los puntos finales de
 * "Análisis de saberes previos.", "Recogida de conocimientos previos." y
 * "Búsqueda y análisis.". Orden de las columnas = orden impreso.
 *
 * Módulo PURO. Todavía no lo consume nada: el generador sigue usando
 * FASES_POR_ESTRATEGIA (unidadAprendizajeService.js). Las claves coinciden con
 * las de ese objeto para el cambio de la Etapa 2.
 * Verificación: scripts/test-datos-oficiales.mjs
 */

export const FUENTE_FASES_ESTRATEGIAS = "Guía de planificación integral para docentes de Secundaria (MINERD, 2025), p. 22";

export const ESTRATEGIAS_FASES_GUIA_2025 = [
  {
    clave: "indagacion_dialogica",
    nombre: "Indagación dialógica",
    fases: [
      "Recogida de conocimientos previos",
      "Validación de las fuentes",
      "Análisis y organización de la información",
      "Diseño y construcción",
      "Presentación de resultados",
      "Evaluación",
    ],
  },
  {
    clave: "insercion_entorno",
    nombre: "Inserción de los docentes y estudiantes en el entorno",
    fases: [
      "Recolección de información previa",
      "Elaboración de instrumentos de recolección",
      "Visita-recolección de los datos",
      "Descripción y reflexión",
      "Análisis de los datos e información",
      "Socialización del conocimiento",
      "Elaboración de propuestas",
      "Aplicación de los conocimientos",
      "Evaluación y reconocimiento del proceso",
    ],
  },
  {
    clave: "proyectos",
    nombre: "Aprendizaje Basado en Proyecto",
    fases: [
      "Visión compartida",
      "Análisis de saberes previos.",
      "Gestión del conocimiento",
      "Metodología y ejemplificación",
      "Aplicación",
      "Evaluación",
      "Socialización y cierre",
    ],
  },
  {
    clave: "problemas",
    nombre: "Aprendizaje Basado en Problemas (ABP)",
    fases: [
      "Selección y análisis del problema",
      "Definición del problema",
      "Formulación de objetivos",
      "Análisis e investigación",
      "Reestructuración del problema",
      "Aprendizaje individual",
      "Puesta en común",
    ],
  },
  {
    clave: "estudio_caso",
    nombre: "Estudio de caso",
    fases: [
      "Conocimiento o saberes previos del caso",
      "Indagación o estudio del caso",
      "Socialización del caso",
      "Elaboración de conclusiones",
      "Evaluación",
    ],
  },
  {
    clave: "conocimientos_previos",
    nombre: "Exploración de conocimientos previos",
    fases: [
      "Presentación de la situación de aprendizaje",
      "Recogida de saberes recuperados",
      "Socialización reflexiva y crítica",
      "Introducción del nuevo conocimiento",
      "Evaluación",
    ],
  },
  {
    clave: "expositiva",
    nombre: "Expositiva de conocimientos elaborados",
    fases: [
      "Recogida de conocimientos previos.",
      "Búsqueda y análisis.",
      "Producción de la exposición",
      "Exposición de producciones",
      "Reflexión metacognitiva",
      "Sistematización",
      "Evaluación",
    ],
  },
];
