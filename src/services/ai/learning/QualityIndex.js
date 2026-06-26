/**
 * QualityIndex — Índice de calidad del Banco Inteligente de Conocimiento.
 *
 * Escala 0-95. Ningún contenido llega a 100 (siempre hay margen de mejora).
 *
 * Pesos:
 *   Base IA generada:         70
 *   Por uso (max +15):        +3 por uso, tope +15
 *   Por edición docente:      +5 primera edición, +3 c/u siguiente (max +15)
 *   Eliminación rápida (<7d): -10
 *   Completitud de campos:    0-5 puntos extra
 */

const BASE_IA       = 70;
const MAX_SCORE     = 95;
const PTS_POR_USO   = 3;
const MAX_PTS_USOS  = 15;
const PTS_PRIMER_ED = 5;
const PTS_OTRAS_ED  = 3;
const MAX_PTS_EDS   = 15;
const PEN_BORRADO   = 10;

/**
 * Calcula el índice de calidad a partir de los metadatos de un ítem BIC.
 * @param {Object} meta
 * @param {number} meta.vecesUsada        - Cuántas veces fue reutilizado
 * @param {number} meta.vecesModificada   - Cuántas veces fue editado por docentes
 * @param {boolean} meta.eliminadoRapido  - Si fue archivado antes de 7 días
 * @param {Object} [meta.contenido]       - Contenido del ítem para evaluar completitud
 * @returns {number} 0-95
 */
export function calcularCalidad({ vecesUsada = 0, vecesModificada = 0, eliminadoRapido = false, contenido = null }) {
  let score = BASE_IA;

  // Bonus por usos
  score += Math.min(vecesUsada * PTS_POR_USO, MAX_PTS_USOS);

  // Bonus por ediciones
  if (vecesModificada > 0) {
    score += PTS_PRIMER_ED;
    score += Math.min((vecesModificada - 1) * PTS_OTRAS_ED, MAX_PTS_EDS - PTS_PRIMER_ED);
  }

  // Penalización por eliminación rápida
  if (eliminadoRapido) score -= PEN_BORRADO;

  // Bonus por completitud
  if (contenido) score += _calcCompletitud(contenido);

  return Math.max(0, Math.min(MAX_SCORE, Math.round(score)));
}

/**
 * Calcula delta de calidad cuando cambia un solo factor.
 * Útil para actualizaciones incrementales sin recalcular todo.
 */
export function deltaCalidad(evento) {
  switch (evento) {
    case "uso":        return PTS_POR_USO;
    case "primera_edicion": return PTS_PRIMER_ED;
    case "edicion":    return PTS_OTRAS_ED;
    case "borrado_rapido": return -PEN_BORRADO;
    default: return 0;
  }
}

/**
 * Etiqueta textual del nivel de calidad (para UI).
 */
export function etiquetaCalidad(score) {
  if (score >= 90) return { label: "Excelente", color: "#10b981" };
  if (score >= 80) return { label: "Muy bueno", color: "#3b82f6" };
  if (score >= 70) return { label: "Bueno",     color: "#8b5cf6" };
  if (score >= 60) return { label: "Regular",   color: "#f59e0b" };
  return                  { label: "Básico",    color: "#6b7280" };
}

// ── Privadas ───────────────────────────────────────────────────────────────────

function _calcCompletitud(contenido) {
  if (typeof contenido !== "object" || !contenido) return 0;

  const campos = [
    "semanas", "actividades", "recursos", "evaluacion",
    "intencionPedagogica", "metacognicion", "evidencias",
  ];
  const presentes = campos.filter(c => {
    const v = contenido[c];
    if (Array.isArray(v)) return v.length > 0;
    return v != null && v !== "";
  });

  return Math.round((presentes.length / campos.length) * 5);
}
