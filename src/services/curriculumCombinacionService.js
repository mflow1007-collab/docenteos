/**
 * curriculumCombinacionService.js
 *
 * Implementa la REGLA DE COMBINACIÓN CURRICULAR:
 *
 * Cuando la duración solicitada es de 5 semanas o más, la IA debe analizar
 * los temas del currículo y determinar cuáles pueden integrarse
 * pedagógicamente en una misma unidad.
 *
 * REGLA OBLIGATORIA ANTES DE GENERAR:
 *   ¿Este tema por sí solo puede sostener pedagógicamente la cantidad de
 *   semanas solicitadas?
 *   Si NO → identificar temas relacionados del currículo y proponer integración.
 *
 * CRITERIO DE COMBINACIÓN (solo cuando existe relación):
 *   - Comunicativa: los temas comparten funciones comunicativas clave
 *   - Funcional: el vocabulario y estructuras se refuerzan mutuamente
 *   - Curricular: el currículo oficial los asocia en la misma malla
 *   - Contextual: pertenecen al mismo contexto de vida del estudiante
 *   - Con el producto final: el producto integra naturalmente todos los temas
 *
 * NO combinar por proximidad en la lista curricular.
 */

// Máximo de semanas que un solo tema puede sostener pedagógicamente
// en Lenguas Extranjeras nivel A1-A2 sin volverse repetitivo
const SEMANAS_MAX_TEMA_INDIVIDUAL = 4;

// ── Distribución de temas en semanas ────────────────────────────────────────

/**
 * Distribuye N temas en S semanas de forma equilibrada.
 * Cada tema recibe al menos 2 semanas. Las semanas sobrantes se asignan
 * a los primeros temas (mayor peso al inicio de la unidad).
 *
 * Ejemplo: 3 temas, 7 semanas → [3, 2, 2]
 *
 * @param {string[]} temas
 * @param {number} semanas
 * @returns {{ tema: string, semanaInicio: number, semanaFin: number }[]}
 */
export const distribuirTemasEnSemanas = (temas, semanas) => {
  if (!Array.isArray(temas) || temas.length === 0) return [];

  const base = Math.floor(semanas / temas.length);
  const sobrante = semanas % temas.length;

  let semanaActual = 1;
  return temas.map((tema, i) => {
    const duracion = base + (i < sobrante ? 1 : 0);
    const bloque = {
      tema,
      semanaInicio: semanaActual,
      semanaFin: semanaActual + duracion - 1,
    };
    semanaActual += duracion;
    return bloque;
  });
};

// ── Análisis de combinación ──────────────────────────────────────────────────

/**
 * Dado el documento curricular de Firestore, el tema seleccionado y la
 * duración en semanas, determina si se requiere combinación de temas
 * y qué criterio del currículo oficial aplicar.
 *
 * @param {object|null} curriculoData - Documento de Firestore (diseñoCurricular)
 * @param {string} temaSeleccionado - Tema elegido por el docente
 * @param {number} duracionSemanas - Número de semanas de la unidad
 * @returns {{
 *   necesitaCombinacion: boolean,
 *   combinacionSugerida: {
 *     nombre: string,
 *     temas: string[],
 *     justificacion: string,
 *     duracionSugerida: string,
 *     distribucion: { tema: string, semanaInicio: number, semanaFin: number }[]
 *   } | null
 * }}
 */
export const analizarCombinacionTematica = (curriculoData, temaSeleccionado, duracionSemanas) => {
  if (!curriculoData || !temaSeleccionado?.trim() || !(duracionSemanas >= 5)) {
    return { necesitaCombinacion: false, combinacionSugerida: null };
  }

  const criterios = curriculoData.criteriosCombinacionTematica;
  if (!Array.isArray(criterios) || criterios.length === 0) {
    return { necesitaCombinacion: false, combinacionSugerida: null };
  }

  // El tema individual puede sostener ≤4 semanas; a partir de 5 necesita combinación
  if (duracionSemanas <= SEMANAS_MAX_TEMA_INDIVIDUAL) {
    return { necesitaCombinacion: false, combinacionSugerida: null };
  }

  // Buscar el criterio oficial que incluye el tema seleccionado
  const temaLower = temaSeleccionado.toLowerCase().trim();
  const criterioMatch = criterios.find(
    (c) => Array.isArray(c.temas) && c.temas.some((t) => t.toLowerCase().trim() === temaLower)
  );

  if (!criterioMatch) {
    return { necesitaCombinacion: false, combinacionSugerida: null };
  }

  const distribucion = distribuirTemasEnSemanas(criterioMatch.temas, duracionSemanas);

  return {
    necesitaCombinacion: true,
    combinacionSugerida: {
      nombre: criterioMatch.nombre,
      temas: criterioMatch.temas,
      justificacion: criterioMatch.razon,
      duracionSugerida: criterioMatch.duracionSugerida,
      distribucion,
    },
  };
};

// ── Consulta por semana ──────────────────────────────────────────────────────

/**
 * Retorna el tema curricular correspondiente a una semana específica,
 * según la distribución calculada.
 *
 * @param {number} semanaNum
 * @param {{ tema: string, semanaInicio: number, semanaFin: number }[]} distribucion
 * @returns {string|null}
 */
export const obtenerTemaSemana = (semanaNum, distribucion) => {
  if (!Array.isArray(distribucion) || distribucion.length === 0) return null;
  const bloque = distribucion.find(
    (d) => semanaNum >= d.semanaInicio && semanaNum <= d.semanaFin
  );
  return bloque?.tema ?? null;
};

// ── Validación pedagógica ────────────────────────────────────────────────────

/**
 * Verifica si un tema individual puede sostener pedagógicamente
 * la duración solicitada.
 * La heurística: un tema de Lenguas Extranjeras nivel A1-A2 puede
 * desarrollarse en máximo 4 semanas antes de volverse redundante.
 *
 * @param {number} duracionSemanas
 * @returns {boolean}
 */
export const temaNecesitaCombinacion = (duracionSemanas) =>
  duracionSemanas > SEMANAS_MAX_TEMA_INDIVIDUAL;

export default {
  distribuirTemasEnSemanas,
  analizarCombinacionTematica,
  obtenerTemaSemana,
  temaNecesitaCombinacion,
};
