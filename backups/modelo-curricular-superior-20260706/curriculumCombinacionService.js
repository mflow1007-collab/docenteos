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

  // Buscar TODOS los criterios que incluyen el tema seleccionado.
  // El primero (grupo principal del currículo) se propone por defecto;
  // el resto se ofrece como combinaciones alternativas para que el
  // docente elija con qué otros temas quiere integrar.
  const temaLower = temaSeleccionado.toLowerCase().trim();
  const criteriosMatch = criterios.filter(
    (c) => Array.isArray(c.temas) && c.temas.some((t) => t.toLowerCase().trim() === temaLower)
  );

  if (criteriosMatch.length === 0) {
    return { necesitaCombinacion: false, combinacionSugerida: null };
  }

  const aCombinacion = (criterio) => ({
    nombre: criterio.nombre,
    temas: criterio.temas,
    justificacion: criterio.razon,
    duracionSugerida: criterio.duracionSugerida,
    tipo: criterio.tipo || "principal",
    tituloSugerido: criterio.tituloSugerido || "",
    distribucion: distribuirTemasEnSemanas(criterio.temas, duracionSemanas),
  });

  const [principal, ...resto] = criteriosMatch;

  return {
    necesitaCombinacion: true,
    combinacionSugerida: {
      ...aCombinacion(principal),
      alternativas: resto.map(aCombinacion),
    },
  };
};

// ── Sugerencia de tema oficial desde texto libre (2026-07-06) ────────────────
// El docente escribe el tema como quiere ("Parts of the House") y el sistema
// le sugiere el tema curricular oficial que corresponde y sus temas afines
// (criteriosCombinacionTematica) para impartirlos juntos.

const _norm = (s) => String(s || "")
  .toLowerCase()
  .normalize("NFD")
  .replace(/[̀-ͯ]/g, "")
  .replace(/\s+/g, " ")
  .trim();

const textoTema = (tema) => {
  if (typeof tema === "string") return tema;
  if (!tema || typeof tema !== "object") return "";
  return tema.nombre || tema.tema || tema.titulo || tema.title || tema.descripcion || tema.texto || "";
};

const claveTema = (tema) => {
  const normalizado = _norm(textoTema(tema));
  return Object.keys(TEMA_KEYWORDS).find(
    (key) => normalizado === key || normalizado.includes(key) || key.includes(normalizado)
  ) || categoriaPorVocabulario(normalizado);
};

/** Normaliza un tema para comparaciones (minúsculas, sin acentos ni espacios dobles) */
export const normalizarTema = _norm;

// Vocabulario ES/EN por tema oficial (Lenguas Extranjeras 1ro-3ro; las claves
// funcionan igual si otras áreas comparten nombres de tema)
const TEMA_KEYWORDS = {
  "identificacion personal": ["identificacion personal", "personal information", "introductions", "introduce myself", "about me", "greetings", "saludos", "my name", "nationality", "nacionalidad"],
  "relaciones humanas y sociales": ["family", "familia", "friends", "amigos", "relationships", "relaciones", "people", "personas", "community", "comunidad", "social"],
  "actividades de la vida diaria": ["routine", "routines", "rutina", "rutinas", "daily", "everyday", "dia a dia", "habits", "habitos", "my life", "schedule", "mi dia"],
  "vivienda, entorno y ciudad": ["house", "home", "casa", "vivienda", "hogar", "rooms", "habitaciones", "parts of the house", "furniture", "muebles", "city", "ciudad", "neighborhood", "neighbourhood", "barrio", "apartment", "apartamento", "entorno", "places in town", "town"],
  "escuela y educacion": ["school", "escuela", "education", "educacion", "classroom", "aula", "subjects", "asignaturas", "clases", "teachers"],
  "deporte, tiempo libre y recreacion": ["sports", "sport", "deporte", "deportes", "hobbies", "hobby", "free time", "tiempo libre", "games", "juegos", "recreation", "recreacion", "leisure"],
  "alimentacion": ["food", "comida", "alimentos", "alimentacion", "meals", "breakfast", "lunch", "dinner", "restaurant", "restaurante", "fruits", "frutas", "vegetables", "drinks", "bebidas", "recipes", "recetas", "healthy eating"],
  "salud y cuidados fisicos": ["health", "salud", "body", "cuerpo", "doctor", "illness", "enfermedad", "sick", "exercise", "ejercicio", "hygiene", "higiene", "healthy habits", "habitos saludables", "wellness"],
  "ciencia y tecnologia": ["technology", "tecnologia", "science", "ciencia", "computer", "computadora", "internet", "devices", "dispositivos", "gadgets", "phone", "celular", "apps"],
  "lengua y comunicacion": ["language", "languages", "lengua", "idiomas", "communication", "comunicacion", "media", "medios de comunicacion"],
  "clima, condiciones atmosfericas y medioambiente": ["weather", "clima", "climate", "seasons", "estaciones", "rain", "lluvia", "environment", "medioambiente", "medio ambiente", "nature", "naturaleza", "temperature", "temperatura"],
  // 1ro y 3ro escriben "medio ambiente" separado
  "clima, condiciones atmosfericas y medio ambiente": ["weather", "clima", "climate", "seasons", "estaciones", "rain", "lluvia", "environment", "medioambiente", "medio ambiente", "nature", "naturaleza", "temperature", "temperatura"],
  "medio ambiente y problematicas sociales": ["environment", "medio ambiente", "medioambiente", "pollution", "contaminacion", "recycling", "reciclaje", "social problems", "problemas sociales", "climate change", "cambio climatico", "planet", "planeta"],
  "bienes y servicios": ["shopping", "compras", "store", "shop", "tienda", "money", "dinero", "prices", "precios", "services", "servicios", "buy", "comprar", "market", "mercado", "clothes", "ropa"],
  "actividades sociales y culturales": ["culture", "cultura", "celebrations", "celebraciones", "festivals", "festivales", "fiestas", "traditions", "tradiciones", "party", "holidays", "costumbres", "customs"],
  "viajes y turismo": ["travel", "viaje", "viajes", "trip", "tourism", "turismo", "vacation", "vacaciones", "transport", "transporte", "directions", "direcciones", "airport", "aeropuerto", "hotel"],
};

const TEMA_CANONICO = {
  "identificacion personal": "Identificación personal",
  "relaciones humanas y sociales": "Relaciones humanas y sociales",
  "actividades de la vida diaria": "Actividades de la vida diaria",
  "vivienda, entorno y ciudad": "Vivienda, entorno y ciudad",
  "escuela y educacion": "Escuela y educación",
  "deporte, tiempo libre y recreacion": "Deporte, tiempo libre y recreación",
  "alimentacion": "Alimentación",
  "salud y cuidados fisicos": "Salud y cuidados físicos",
  "ciencia y tecnologia": "Ciencia y tecnología",
  "lengua y comunicacion": "Lengua y comunicación",
  "clima, condiciones atmosfericas y medioambiente": "Clima, condiciones atmosféricas y medioambiente",
  "clima, condiciones atmosfericas y medio ambiente": "Clima, condiciones atmosféricas y medio ambiente",
  "medio ambiente y problematicas sociales": "Medio ambiente y problemáticas sociales",
  "bienes y servicios": "Bienes y servicios",
  "actividades sociales y culturales": "Actividades sociales y culturales",
  "viajes y turismo": "Viajes y turismo",
};

const categoriaPorVocabulario = (textoNormalizado) =>
  Object.entries(TEMA_KEYWORDS).find(([, claves]) =>
    claves.some((k) => textoNormalizado.includes(_norm(k)))
  )?.[0] || "";

/**
 * Resuelve un tema escrito libremente al tema curricular oficial más parecido.
 * 1º intenta match por nombre oficial; 2º por vocabulario ES/EN del tema.
 *
 * @returns {{ tema: string, confianza: "alta"|"media", motivo: string } | null}
 */
export const sugerirTemaOficial = (temaLibre, temasCurriculares = []) => {
  const texto = _norm(temaLibre);
  const temas = (Array.isArray(temasCurriculares) ? temasCurriculares : [])
    .map(textoTema)
    .map((tema) => String(tema || "").trim())
    .filter(Boolean);
  if (!texto || texto.length < 3 || !temas.length) return null;

  const categoriaEntrada = categoriaPorVocabulario(texto);
  if (categoriaEntrada) {
    const oficialEnMalla = temas.find((tema) =>
      claveTema(tema) === categoriaEntrada && _norm(tema).includes(categoriaEntrada)
    );
    return {
      tema: oficialEnMalla || TEMA_CANONICO[categoriaEntrada] || categoriaEntrada,
      confianza: "alta",
      motivo: "Coincidencia por el vocabulario del tema",
    };
  }

  const directo = temas.find(
    (t) => texto.includes(_norm(t)) || _norm(t).includes(texto)
  );
  if (directo) {
    return { tema: directo, confianza: "alta", motivo: "Coincide con el nombre oficial del tema" };
  }

  let mejor = null;
  for (const tema of temas) {
    const claves = TEMA_KEYWORDS[claveTema(tema)] || [];
    const aciertos = claves.filter((k) => texto.includes(_norm(k))).length;
    if (aciertos > (mejor?.aciertos || 0)) mejor = { tema, aciertos };
  }
  if (mejor) {
    return {
      tema: mejor.tema,
      confianza: mejor.aciertos > 1 ? "alta" : "media",
      motivo: "Coincidencia por el vocabulario del tema",
    };
  }
  return null;
};

/**
 * Dado el doc curricular y el tema libre del docente, devuelve el tema oficial
 * detectado y los temas afines para trabajar juntos (grupo oficial de
 * combinación temática).
 *
 * @returns {{
 *   temaOficial: string, confianza: string, motivo: string,
 *   grupo: { nombre, temas, razon, duracionSugerida } | null,
 *   afines: string[]
 * } | null}
 */
export const sugerirTemasATrabajar = (curriculoData, temaLibre) => {
  const temas = curriculoData?.temasCurriculares || [];
  const sugerencia = sugerirTemaOficial(temaLibre, temas);
  if (!sugerencia) return null;

  const criterios = curriculoData?.criteriosCombinacionTematica || [];
  const opciones = criterios
    .filter((c) => Array.isArray(c.temas) && c.temas.some((t) => _norm(t) === _norm(sugerencia.tema)))
    .map((c) => ({
      nombre: c.nombre,
      temas: c.temas,
      razon: c.razon,
      duracionSugerida: c.duracionSugerida,
      tipo: c.tipo || "principal",
      tituloSugerido: c.tituloSugerido || "",
      afines: c.temas.filter((t) => _norm(t) !== _norm(sugerencia.tema)),
    }));
  const grupo = opciones[0] || null;

  return {
    temaOficial: sugerencia.tema,
    confianza: sugerencia.confianza,
    motivo: sugerencia.motivo,
    grupo,
    afines: grupo ? grupo.afines : [],
    opciones,
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
  sugerirTemaOficial,
  sugerirTemasATrabajar,
};
