/**
 * SimilarityEngine — Motor de similitud para el Banco Inteligente de Conocimiento.
 *
 * Implementa el flujo de decisión de 3 niveles:
 *   Nivel 1 (≥ 0.90): Reutilización directa — sin IA
 *   Nivel 2 (0.70-0.89): Adaptación — ajustar fechas/recursos/actividades
 *   Nivel 3 (< 0.70):  Generación — crear desde cero + guardar en BIC
 *
 * Similitud = suma ponderada de coincidencias por campo.
 * Texto: similitud Jaccard sobre tokens normalizados.
 * Campos exactos (nivel, grado, area, tipo): 1.0 o 0.0.
 */

// Pesos de cada campo. Suma = 1.00
const PESOS = {
  nivel:       0.08,
  grado:       0.18,
  area:        0.14,
  asignatura:  0.08,
  competencia: 0.22,
  indicadores: 0.12,
  tema:        0.13,
  tipo:        0.05,
};

const UMBRAL_REUTILIZAR = 0.90;
const UMBRAL_ADAPTAR    = 0.70;

// ── Normalización de texto ────────────────────────────────────────────────────

function tokenizar(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function jaccardSimilarity(a, b) {
  const sa = new Set(tokenizar(a));
  const sb = new Set(tokenizar(b));
  if (sa.size === 0 && sb.size === 0) return 1;
  if (sa.size === 0 || sb.size === 0) return 0;
  let interseccion = 0;
  for (const t of sa) { if (sb.has(t)) interseccion++; }
  return interseccion / (sa.size + sb.size - interseccion);
}

function exactMatch(a, b) {
  if (!a || !b) return 0;
  return tokenizar(a).join(" ") === tokenizar(b).join(" ") ? 1 : 0;
}

// ── Cálculo de similitud ──────────────────────────────────────────────────────

/**
 * Calcula la similitud entre un ítem del BIC y una consulta.
 * @param {Object} stored  - Ítem del BIC (campos de metadatos)
 * @param {Object} query   - Campos de la consulta nueva
 * @returns {number} 0.0 – 1.0
 */
export function calcSimilarity(stored, query) {
  let score = 0;

  score += PESOS.nivel       * exactMatch(stored.nivel,      query.nivel);
  score += PESOS.grado       * exactMatch(stored.grado,      query.grado);
  score += PESOS.area        * exactMatch(stored.area,       query.area);
  score += PESOS.asignatura  * exactMatch(stored.asignatura, query.asignatura);
  score += PESOS.tipo        * exactMatch(stored.tipo,       query.tipo);

  // Campos semánticos — Jaccard
  score += PESOS.competencia * jaccardSimilarity(stored.competencia, query.competencia);
  score += PESOS.tema        * jaccardSimilarity(stored.tema,        query.tema);

  // Indicadores: concatenar array o string
  const indA = Array.isArray(stored.indicadores)
    ? stored.indicadores.join(" ")
    : String(stored.indicadores || "");
  const indB = Array.isArray(query.indicadores)
    ? query.indicadores.join(" ")
    : String(query.indicadores || "");
  score += PESOS.indicadores * jaccardSimilarity(indA, indB);

  return Math.round(score * 1000) / 1000; // 3 decimales
}

/**
 * Ordena candidatos pre-cargados del BIC por similitud y retorna los mejores.
 * @param {Object[]} candidatos - Ítems del BIC con sus metadatos
 * @param {Object}   query      - Parámetros de búsqueda
 * @param {number}   [topN=5]   - Máximo de resultados
 * @returns {{ id, score, ...resto }[]} - Ordenados por score desc
 */
export function rankearCandidatos(candidatos, query, topN = 5) {
  return candidatos
    .map(c => ({ ...c, score: calcSimilarity(c, query) }))
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

/**
 * Determina el nivel de decisión para una consulta, dado el mejor candidato.
 * @param {number} bestScore - Mejor similitud encontrada (0.0–1.0) o null si no hay candidatos
 * @returns {{ nivel: 1|2|3, umbral: number }}
 */
export function determinarNivel(bestScore) {
  if (bestScore == null || bestScore < UMBRAL_ADAPTAR) {
    return { nivel: 3, umbral: UMBRAL_ADAPTAR };
  }
  if (bestScore >= UMBRAL_REUTILIZAR) {
    return { nivel: 1, umbral: UMBRAL_REUTILIZAR };
  }
  return { nivel: 2, umbral: UMBRAL_ADAPTAR };
}

/**
 * Genera un fingerprint rápido de una consulta (para cache/lookup exacto).
 * Combina campos clave en un string normalizado.
 */
export function fingerprint(query) {
  const campos = [
    query.nivel, query.grado, query.area, query.asignatura,
    query.tipo, query.competencia, query.tema,
  ];
  return campos
    .map(c => tokenizar(c).join("_"))
    .join("|");
}

export const UMBRALES = { REUTILIZAR: UMBRAL_REUTILIZAR, ADAPTAR: UMBRAL_ADAPTAR };
