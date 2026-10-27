/**
 * rolesFasesEstrategias — Papel de cada fase literal de la Guía 2025 dentro del
 * plan maestro (Etapa 2 de docs/DISENO_CORAZON_DOCENTEOS.md).
 *
 * Esto NO es texto oficial: es la interpretación de DocenteOS, aprobada por
 * César el 2026-10-26. Las fases literales viven en estrategiasFasesGuia2025.js;
 * aquí va un papel por fase, en el mismo orden.
 * - ABProyecto: sale del documento de diseño (4.3 y 4.4).
 * - ABProblemas: propuesta de la Etapa 2, aprobada.
 * - Las otras 5 estrategias todavía no tienen papeles aprobados: el plan maestro
 *   falla con error visible si se eligen (decisión 7.2).
 *
 * Módulo PURO. Lo consume planMaestroService.js.
 */

export const ROLES_FASE = ["apertura", "conocimiento", "modelado", "aplicacion", "evaluacion", "socializacion"];

// Fase donde se trabaja cada acción del indicador (regla 4.3):
// responde → gestión del conocimiento; produce → metodología y ejemplificación;
// interactúa → aplicación.
export const ROL_POR_ACCION = {
  responde: "conocimiento",
  produce: "modelado",
  interactua: "aplicacion",
};

// Peso de cada papel al repartir las sesiones del horario.
export const PESO_SESIONES_POR_ROL = {
  apertura: 1,
  conocimiento: 2,
  modelado: 2,
  aplicacion: 3,
  evaluacion: 1,
  socializacion: 1,
};

// Estado del producto que deja cada papel (una entrega del MISMO producto por fase).
export const ENTREGA_POR_ROL = {
  apertura: "Acuerdo y plan",
  conocimiento: "Insumos recopilados",
  modelado: "Borrador",
  aplicacion: "Versión final",
  evaluacion: "Versión revisada",
  socializacion: "Presentación",
};

// Papeles que reciben contenidos de la malla. Apertura, evaluación y
// socialización no llevan contenido nuevo.
export const ROLES_CON_CONTENIDO = ["conocimiento", "modelado", "aplicacion"];

export const ROLES_FASES_POR_ESTRATEGIA = {
  proyectos: [
    "apertura",       // Visión compartida
    "apertura",       // Análisis de saberes previos.
    "conocimiento",   // Gestión del conocimiento
    "modelado",       // Metodología y ejemplificación
    "aplicacion",     // Aplicación
    "evaluacion",     // Evaluación
    "socializacion",  // Socialización y cierre
  ],
  problemas: [
    "apertura",       // Selección y análisis del problema
    "apertura",       // Definición del problema
    "apertura",       // Formulación de objetivos
    "conocimiento",   // Análisis e investigación
    "modelado",       // Reestructuración del problema
    "aplicacion",     // Aprendizaje individual
    "socializacion",  // Puesta en común
  ],
};
