/**
 * estrategiasOficialesMINERD — Estrategias de enseñanza-aprendizaje OFICIALES
 * (F1.3). Fuente: Adecuación Curricular Nivel Secundario 2023, pp. 23-28.
 * Módulo PURO. Uso: vocabulario PREFERIDO (no candado) para "estrategiasDia"
 * en el prompt del Motor — la IA puede combinarlas o precisarlas con la
 * misión del día, pero el nombre base sale de aquí, no se inventa jerga.
 */

export const ESTRATEGIAS_OFICIALES = [
  "Indagación dialógica (diálogo socrático)",
  "Aprendizaje Basado en Problemas (ABP)",
  "Estudio de Caso",
  "Aprendizaje Basado en Proyectos",
  "Debate",
  "Sociodrama o dramatización",
  "Recuperación de experiencias previas",
  "Exposición de conocimientos elaborados",
  "Descubrimiento e indagación",
  "Inserción en el entorno",
  "Socialización centrada en actividades grupales",
  "Aprendizaje colaborativo",
];

// Línea compacta para prompts (los 12 nombres, ~40 tokens)
export const ESTRATEGIAS_OFICIALES_TEXTO = ESTRATEGIAS_OFICIALES.join(" · ");
