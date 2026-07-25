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

import { efemeridesEnRango } from "../data/calendarioEscolarMINERD.js";

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

// Clave semántica para efectos/cachés: dos selecciones con arreglos distintos
// pero el mismo contenido curricular deben considerarse la misma selección.
export const claveSeleccionTematica = (temas = []) => (Array.isArray(temas) ? temas : [])
  .map((tema) => {
    if (typeof tema === "string" || typeof tema === "number") return _norm(String(tema));
    if (!tema || typeof tema !== "object") return "";
    return _norm(tema.tema || tema.nombre || tema.titulo || tema.title || "");
  })
  .filter(Boolean)
  .join("\u001f");

// ─── Temas trabajados: coincidencia por CONTEXTO (nivel+grado+asignatura) ────
// Un tema trabajado en 1ro SECUNDARIA no está "trabajado" en 1ro PRIMARIA.
// El nivel se toma del campo nivel o, si falta, del texto del grado
// ("1ro Secundaria"). Contexto irresoluble → NO coincide (nunca marca cruzado).

const _nivelDesdeTexto = (t) => {
  const n = _norm(t);
  if (n.includes("secundari")) return "secundaria";
  if (n.includes("primari")) return "primaria";
  if (n.includes("inicial") || n.includes("kinder") || n.includes("preprimari")) return "inicial";
  return "";
};

const _nivelDeContexto = (ctx = {}) =>
  _nivelDesdeTexto(ctx.nivel) || _nivelDesdeTexto(ctx.grado);

const _gradoCortoNorm = (g) => _norm(String(g || "").split(" ")[0]);

export const coincideContextoTemaTrabajado = (registro = {}, seleccion = {}) => {
  const nivelReg = _nivelDeContexto(registro);
  const nivelSel = _nivelDeContexto(seleccion);
  if (!nivelReg || !nivelSel || nivelReg !== nivelSel) return false;

  const gradoReg = _gradoCortoNorm(registro.grado);
  const gradoSel = _gradoCortoNorm(seleccion.grado);
  if (!gradoReg || !gradoSel || gradoReg !== gradoSel) return false;

  const asigsReg = [registro.asignatura, registro.area].map(_norm).filter(Boolean);
  const asigsSel = [seleccion.asignatura, seleccion.area].map(_norm).filter(Boolean);
  if (!asigsReg.length || !asigsSel.length) return false;
  return asigsReg.some((a) => asigsSel.includes(a));
};

// Vocabulario ES/EN por tema oficial (Lenguas Extranjeras 1ro-3ro; las claves
// funcionan igual si otras áreas comparten nombres de tema)
export const TEMA_KEYWORDS = {
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

const AFINIDAD_TEMATICA = {
  "identificacion personal": {
    nombre: "Identidad, relaciones y comunicación",
    relacionadas: ["relaciones humanas y sociales", "lengua y comunicacion", "escuela y educacion"],
    razon: "La identificación personal se fortalece al presentarse, interactuar con otras personas y usar funciones comunicativas básicas en contextos escolares y sociales.",
    tituloSugerido: "Who I Am and How I Connect",
  },
  "relaciones humanas y sociales": {
    nombre: "Identidad, familia y vida social",
    relacionadas: ["identificacion personal", "actividades sociales y culturales", "lengua y comunicacion"],
    razon: "Las relaciones humanas permiten integrar presentación personal, interacción social, normas de cortesía y participación en situaciones culturales cercanas al estudiante.",
    tituloSugerido: "People Around Me",
  },
  "actividades de la vida diaria": {
    nombre: "Rutinas, tiempo y bienestar",
    relacionadas: ["salud y cuidados fisicos", "escuela y educacion", "deporte, tiempo libre y recreacion"],
    razon: "Las rutinas se amplían naturalmente hacia hábitos saludables, vida escolar, horarios, frecuencia y actividades de recreación.",
    tituloSugerido: "My Daily Life and Healthy Habits",
  },
  "vivienda, entorno y ciudad": {
    nombre: "Entorno, clima y bienestar",
    relacionadas: ["clima, condiciones atmosfericas y medioambiente", "clima, condiciones atmosfericas y medio ambiente", "salud y cuidados fisicos", "bienes y servicios"],
    razon: "El hogar, la ciudad, el clima y el bienestar se conectan para describir lugares, condiciones del entorno, necesidades personales y recomendaciones en situaciones reales.",
    tituloSugerido: "My Home, My Environment and My Well-being",
  },
  "escuela y educacion": {
    nombre: "Escuela, identidad y rutina académica",
    relacionadas: ["actividades de la vida diaria", "identificacion personal", "lengua y comunicacion", "ciencia y tecnologia"],
    razon: "La vida escolar permite integrar horarios, asignaturas, instrucciones, comunicación en el aula y uso básico de recursos tecnológicos.",
    tituloSugerido: "My School Life",
  },
  "deporte, tiempo libre y recreacion": {
    nombre: "Tiempo libre, salud y vida diaria",
    relacionadas: ["salud y cuidados fisicos", "actividades de la vida diaria", "actividades sociales y culturales"],
    razon: "El deporte y la recreación se articulan con hábitos saludables, rutinas, preferencias y participación en actividades sociales.",
    tituloSugerido: "Free Time and Healthy Choices",
  },
  "alimentacion": {
    nombre: "Alimentación, salud y servicios",
    relacionadas: ["salud y cuidados fisicos", "bienes y servicios", "actividades de la vida diaria"],
    razon: "La alimentación se trabaja con hábitos saludables, rutinas, compras, preferencias y situaciones de intercambio en tiendas o restaurantes.",
    tituloSugerido: "Food, Health and Everyday Choices",
  },
  "salud y cuidados fisicos": {
    nombre: "Bienestar, hábitos y entorno",
    relacionadas: ["actividades de la vida diaria", "alimentacion", "deporte, tiempo libre y recreacion", "clima, condiciones atmosfericas y medioambiente"],
    razon: "La salud se desarrolla mejor al integrarla con rutinas, alimentación, actividad física y condiciones del entorno que afectan el bienestar.",
    tituloSugerido: "Healthy Life in My Environment",
  },
  "ciencia y tecnologia": {
    nombre: "Tecnología, escuela y comunicación",
    relacionadas: ["escuela y educacion", "lengua y comunicacion", "medio ambiente y problematicas sociales"],
    razon: "La ciencia y la tecnología permiten trabajar comunicación funcional, recursos escolares, solución de problemas y situaciones del entorno.",
    tituloSugerido: "Technology in My Learning World",
  },
  "lengua y comunicacion": {
    nombre: "Comunicación, identidad y vida social",
    relacionadas: ["identificacion personal", "relaciones humanas y sociales", "escuela y educacion", "ciencia y tecnologia"],
    razon: "La comunicación atraviesa la presentación personal, la interacción social, la vida escolar y el uso de medios o tecnologías.",
    tituloSugerido: "Communicating in Real Life",
  },
  "clima, condiciones atmosfericas y medioambiente": {
    nombre: "Clima, entorno y bienestar",
    relacionadas: ["vivienda, entorno y ciudad", "salud y cuidados fisicos", "medio ambiente y problematicas sociales"],
    razon: "El clima y el medioambiente se conectan con la descripción del entorno, la salud, el cuidado personal y problemas ambientales cercanos.",
    tituloSugerido: "Weather, Environment and Care",
  },
  "clima, condiciones atmosfericas y medio ambiente": {
    nombre: "Clima, entorno y bienestar",
    relacionadas: ["vivienda, entorno y ciudad", "salud y cuidados fisicos", "medio ambiente y problematicas sociales"],
    razon: "El clima y el medio ambiente se conectan con la descripción del entorno, la salud, el cuidado personal y problemas ambientales cercanos.",
    tituloSugerido: "Weather, Environment and Care",
  },
  "medio ambiente y problematicas sociales": {
    nombre: "Medioambiente, tecnología y ciudadanía",
    relacionadas: ["clima, condiciones atmosfericas y medioambiente", "ciencia y tecnologia", "bienes y servicios"],
    razon: "Las problemáticas ambientales y sociales permiten integrar descripciones, recomendaciones, soluciones, tecnología y consumo responsable.",
    tituloSugerido: "Taking Care of Our World",
  },
  "bienes y servicios": {
    nombre: "Servicios, ciudad y vida cotidiana",
    relacionadas: ["vivienda, entorno y ciudad", "alimentacion", "viajes y turismo", "medio ambiente y problematicas sociales"],
    razon: "Los bienes y servicios se trabajan en situaciones reales de la ciudad, compras, alimentación, transporte, turismo y consumo responsable.",
    tituloSugerido: "Services in My Community",
  },
  "actividades sociales y culturales": {
    nombre: "Vida social, cultura y relaciones",
    relacionadas: ["relaciones humanas y sociales", "deporte, tiempo libre y recreacion", "viajes y turismo"],
    razon: "Las actividades sociales y culturales se fortalecen con interacción, preferencias, tiempo libre, celebraciones y experiencias de viaje.",
    tituloSugerido: "Culture and Social Life",
  },
  "viajes y turismo": {
    nombre: "Turismo, ciudad y cultura",
    relacionadas: ["bienes y servicios", "vivienda, entorno y ciudad", "actividades sociales y culturales", "clima, condiciones atmosfericas y medioambiente"],
    razon: "Viajes y turismo integran orientación en la ciudad, servicios, clima, cultura, transporte y participación en situaciones comunicativas reales.",
    tituloSugerido: "Travel, Culture and Services",
  },
};

const categoriaPorVocabulario = (textoNormalizado) =>
  Object.entries(TEMA_KEYWORDS).find(([, claves]) =>
    claves.some((k) => textoNormalizado.includes(_norm(k)))
  )?.[0] || "";

const semanasParaCantidadTemas = (cantidad) => {
  if (cantidad <= 1) return "4 semanas";
  if (cantidad === 2) return "5 semanas";
  if (cantidad === 3) return "5-6 semanas";
  return "7-8 semanas";
};

const construirOpcionesDesdeMalla = (temaOficial, temasCurriculares = []) => {
  const temas = (Array.isArray(temasCurriculares) ? temasCurriculares : [])
    .map(textoTema)
    .map((tema) => String(tema || "").trim())
    .filter(Boolean);
  const claveBase = claveTema(temaOficial);
  if (!claveBase || !temas.length) return [];

  const afinidad = AFINIDAD_TEMATICA[claveBase];
  const porClave = new Map();
  temas.forEach((tema) => {
    const clave = claveTema(tema);
    if (clave && !porClave.has(clave)) porClave.set(clave, tema);
  });

  const relacionados = (afinidad?.relacionadas || [])
    .map((clave) => porClave.get(clave))
    .filter(Boolean)
    .filter((tema) => _norm(tema) !== _norm(temaOficial));

  const principal = [temaOficial, ...relacionados.slice(0, 2)]
    .filter((tema, index, lista) => lista.findIndex((t) => _norm(t) === _norm(tema)) === index);

  if (principal.length < 2) return [];

  const opciones = [{
    nombre: afinidad?.nombre || `Integración curricular de ${temaOficial}`,
    temas: principal,
    razon: afinidad?.razon || "Los temas comparten funciones comunicativas, vocabulario y contextos de uso dentro de la malla curricular oficial.",
    duracionSugerida: semanasParaCantidadTemas(principal.length),
    tipo: "sugerida",
    tituloSugerido: afinidad?.tituloSugerido || "",
    afines: principal.filter((tema) => _norm(tema) !== _norm(temaOficial)),
  }];

  // TOPE de 3 temas (tú + 2 afines): 2-3 temas = 5-6 semanas, que caben en el
  // trimestre escolar. Combinar más no cuadra con el calendario ni deja terminar
  // el tema. La 2da línea ofrece OTROS afines (no los mismos de la principal),
  // pero igual topada en 3.
  const segundaLinea = [temaOficial, ...relacionados.slice(2, 4)]
    .filter((tema, index, lista) => lista.findIndex((t) => _norm(t) === _norm(tema)) === index)
    .slice(0, 3);
  if (segundaLinea.length >= 2 && segundaLinea.length !== principal.length) {
    opciones.push({
      nombre: `Ampliación curricular de ${temaOficial}`,
      temas: segundaLinea,
      razon: "Esta opción combina el tema con otros contenidos afines de la malla (máximo 3 temas), manteniendo una duración que cabe en el trimestre escolar.",
      duracionSugerida: semanasParaCantidadTemas(segundaLinea.length),
      tipo: "alternativa",
      tituloSugerido: "",
      afines: segundaLinea.filter((tema) => _norm(tema) !== _norm(temaOficial)),
    });
  }

  return opciones;
};

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
      claveTema(tema) === categoriaEntrada
    );
    if (oficialEnMalla) return {
      tema: oficialEnMalla,
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
export const sugerirTemasATrabajar = (curriculoData, temaLibre, temasSeleccionados = []) => {
  const temas = curriculoData?.temasCurriculares || [];
  // Una ruta del Asesor puede tener un título pedagógico ("Vida y comunidad
  // escolar") distinto de los nombres literales de la malla. En ese caso los
  // temas oficiales elegidos son la fuente de verdad; el título libre queda
  // como respaldo para unidades escritas directamente por el docente.
  const seleccionOficial = (Array.isArray(temasSeleccionados) ? temasSeleccionados : [])
    .map((seleccionado) => temas.find((tema) => _norm(textoTema(tema)) === _norm(textoTema(seleccionado))))
    .find(Boolean);
  const sugerencia = seleccionOficial
    ? {
        tema: textoTema(seleccionOficial),
        confianza: "alta",
        motivo: "Tema seleccionado directamente desde la malla curricular oficial",
      }
    : sugerirTemaOficial(temaLibre, temas);
  if (!sugerencia) return null;

  const criterios = curriculoData?.criteriosCombinacionTematica || [];
  let opciones = criterios
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
  if (opciones.length === 0) {
    opciones = construirOpcionesDesdeMalla(sugerencia.tema, temas);
  }
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

const perfilProductoPorArea = ({ area = "", asignatura = "", tema = "" } = {}) => {
  const clave = _norm(`${asignatura} ${area}`);
  const temaNorm = _norm(tema);

  if (/frances|french/.test(clave)) {
    if (/escuela|educacion|ecole|education/.test(temaNorm)) {
      return { nombre: "Guide de survie scolaire", formato: "guide bilingue", proposito: "orientar dentro del centro educativo", audiencia: "estudiantes nuevos de la comunidad escolar", socializacion: "galerie orale en français" };
    }
    if (/identificacion|personal|relaciones|famili|amig/.test(temaNorm)) {
      return { nombre: "Les personnes autour de moi", formato: "présentation de profils", proposito: "presentarse y fortalecer la convivencia", audiencia: "compañeros y familias del curso", socializacion: "rencontre orale en français" };
    }
    return { nombre: `Notre projet: ${tema}`, formato: "affiche ou guide communicatif", proposito: `comunicar información útil sobre ${tema}`, audiencia: "la communauté scolaire", socializacion: "présentation en français" };
  }

  if (/ingles|english|lenguas extranjeras/.test(clave)) {
    if (/identificacion|personal|relaciones|social|familia|amigos|people|friends/.test(temaNorm)) {
      return { nombre: "People Around Me", formato: "presentación de perfiles", proposito: "conocerse y fortalecer la convivencia", audiencia: "compañeros y familias del curso", socializacion: "encuentro oral en inglés" };
    }
    if (/rutina|vida diaria|daily|routine|habitos/.test(temaNorm)) {
      return { nombre: "A Day in My Life", formato: "diario visual", proposito: "comparar rutinas y promover hábitos responsables", audiencia: "compañeros del curso", socializacion: "galería oral en inglés" };
    }
    if (/vivienda|entorno|ciudad|house|home|city/.test(temaNorm)) {
      return { nombre: "My Home and Community Tour", formato: "recorrido guiado", proposito: "describir y orientar en espacios cotidianos", audiencia: "visitantes y compañeros del curso", socializacion: "recorrido oral en inglés" };
    }
    if (/escuela|educacion|school|education/.test(temaNorm)) {
      return { nombre: "Our School Survival Guide", formato: "guía bilingüe", proposito: "orientar dentro del centro educativo", audiencia: "estudiantes nuevos de la comunidad escolar", socializacion: "galería oral en inglés" };
    }
    if (/alimentacion|comida|food|meal|nutrition/.test(temaNorm)) {
      return { nombre: "Our Healthy School Menu", formato: "menú comentado", proposito: "promover decisiones alimentarias saludables", audiencia: "estudiantes y familias de la comunidad escolar", socializacion: "feria oral en inglés" };
    }
    if (/salud|cuidados|health|care|wellness/.test(temaNorm)) {
      return { nombre: "Healthy Choices Campaign", formato: "campaña de recomendaciones", proposito: "promover el bienestar y el autocuidado", audiencia: "la comunidad escolar", socializacion: "campaña oral y visual en inglés" };
    }
    if (/deporte|tiempo libre|recreacion|sport|leisure|recreation/.test(temaNorm)) {
      return { nombre: "Active Break Guide", formato: "guía de actividades recreativas", proposito: "promover un uso saludable del tiempo libre", audiencia: "la comunidad escolar", socializacion: "demostración oral en inglés" };
    }
    if (/clima|atmosfer|medio ambiente|weather|climate|environment/.test(temaNorm)) {
      return { nombre: "Weather and Environment Bulletin", formato: "boletín de orientación", proposito: "informar y recomendar acciones ante condiciones ambientales", audiencia: "la comunidad escolar", socializacion: "noticiero oral en inglés" };
    }
    if (/viaje|turismo|travel|tourism/.test(temaNorm)) {
      return { nombre: "Visitor's Mini Guide", formato: "guía práctica", proposito: "orientar y recomendar experiencias de viaje", audiencia: "viajeros y visitantes", socializacion: "feria oral en inglés" };
    }
    return { nombre: `Communicating about ${tema}`, formato: "guía comunicativa", proposito: `informar e interactuar sobre ${tema}`, audiencia: "compañeros de la comunidad escolar", socializacion: "presentación oral en inglés" };
  }

  if (/matematica/.test(clave)) {
    return { nombre: `Matemática en acción: ${tema}`, formato: "informe de resolución y modelo aplicado", proposito: `resolver y justificar una situación cuantificable relacionada con ${tema}`, audiencia: "el curso y personas de la comunidad escolar interesadas", socializacion: "mesa de soluciones argumentadas" };
  }
  if (/ciencias de la naturaleza|biologia|quimica|fisica/.test(clave) && !/educacion fisica/.test(clave)) {
    return { nombre: `Laboratorio de ${tema}`, formato: "informe experimental o modelo científico", proposito: `explicar con evidencias un fenómeno relacionado con ${tema}`, audiencia: "estudiantes y familias de la comunidad escolar", socializacion: "feria científica" };
  }
  if (/ciencias sociales|geografia|historia|moral y civica/.test(clave)) {
    return { nombre: `Miradas sobre ${tema}`, formato: "mapa documental y propuesta ciudadana", proposito: `analizar fuentes y comunicar una interpretación fundamentada de ${tema}`, audiencia: "la comunidad educativa", socializacion: "foro o exposición documental" };
  }
  if (/lengua espanola/.test(clave)) {
    return { nombre: `Voces sobre ${tema}`, formato: "artículo, podcast o revista escolar", proposito: `comunicar ideas y producciones textuales relacionadas con ${tema}`, audiencia: "lectores y oyentes de la comunidad escolar", socializacion: "publicación y tertulia" };
  }
  if (/educacion fisica/.test(clave)) {
    return { nombre: `Movimiento y bienestar: ${tema}`, formato: "circuito o plan de actividad física", proposito: `demostrar y promover prácticas relacionadas con ${tema}`, audiencia: "compañeros y familias de la comunidad escolar", socializacion: "jornada práctica" };
  }
  if (/educacion artistica/.test(clave)) {
    return { nombre: `Creaciones sobre ${tema}`, formato: "obra y exposición artística", proposito: `expresar y comunicar una interpretación creativa de ${tema}`, audiencia: "la comunidad educativa", socializacion: "muestra artística" };
  }
  if (/formacion integral humana|religiosa/.test(clave)) {
    return { nombre: `Convivimos y actuamos: ${tema}`, formato: "acuerdo o campaña de convivencia", proposito: `reflexionar y promover acciones responsables relacionadas con ${tema}`, audiencia: "el curso y la comunidad educativa", socializacion: "foro y compromiso colectivo" };
  }
  if (/tecnologia/.test(clave)) {
    return { nombre: `Solución tecnológica: ${tema}`, formato: "prototipo y manual de uso", proposito: `diseñar una solución funcional relacionada con ${tema}`, audiencia: "usuarios de la comunidad escolar", socializacion: "demostración tecnológica" };
  }
  return { nombre: `Proyecto aplicado: ${tema}`, formato: "informe o producción aplicada", proposito: `comunicar y aplicar los aprendizajes de ${tema}`, audiencia: "la comunidad escolar", socializacion: "presentación pública" };
};

export const formatearProductoFinal = (producto = {}) => {
  if (typeof producto === "string") return String(producto).trim();
  const nombre = String(producto.nombre || "Producto final").trim();
  const formato = String(producto.formato || "producción aplicada").trim();
  const proposito = String(producto.proposito || "comunicar los aprendizajes").trim();
  const audiencia = String(producto.audiencia || "la comunidad escolar").trim();
  const socializacion = String(producto.socializacion || "presentación pública").trim();
  return `${nombre} — ${formato} para ${proposito}, dirigida a ${audiencia}; socialización: ${socializacion}.`;
};

export const construirProductoEstructurado = (
  temas = [],
  { area = "", asignatura = "", nombre = "", formato = "", proposito = "", audiencia = "", socializacion = "" } = {},
) => {
  const tema = (temas || []).map((t) => String(t || "").trim()).filter(Boolean).join(" + ") || "la unidad";
  const base = perfilProductoPorArea({ area, asignatura, tema });
  const textoNombre = String(nombre || "").trim();
  const estructuraPrevia = textoNombre.match(
    /^(.+?)\s+—\s+(.+?)\s+para\s+(.+?),\s+dirigida\s+a\s+(.+?);\s+socializaci[oó]n:\s+(.+?)\.?$/i
  );
  return {
    nombre: String(estructuraPrevia?.[1] || textoNombre || base.nombre).trim(),
    formato: String(formato || estructuraPrevia?.[2] || base.formato).trim(),
    proposito: String(proposito || estructuraPrevia?.[3] || base.proposito).trim(),
    audiencia: String(audiencia || estructuraPrevia?.[4] || base.audiencia).trim(),
    socializacion: String(socializacion || estructuraPrevia?.[5] || base.socializacion).trim(),
    temas: (temas || []).map((t) => String(t || "").trim()).filter(Boolean),
    area: String(area || "").trim(),
    asignatura: String(asignatura || "").trim(),
  };
};

export const construirProductoAutentico = (temas = [], contexto = {}) =>
  formatearProductoFinal(construirProductoEstructurado(temas, contexto));

const productoInicialPorRuta = construirProductoAutentico;

const tituloInicialPorRuta = (temas = [], { area = "", asignatura = "" } = {}) => {
  const texto = _norm(temas.join(" "));
  const esIdioma = /ingles|frances|lenguas extranjeras|english|french/.test(_norm(`${area} ${asignatura}`));
  if (esIdioma) {
    if (/identificacion|personal|relaciones|social|familia|amigos|people|friends/.test(texto)) {
      return "People Around Me";
    }
    if (/rutina|vida diaria|daily|routine|habitos/.test(texto)) return "My Daily Life";
    if (/vivienda|entorno|ciudad|house|home|city/.test(texto)) return "My Home and Community";
  }
  return temas[0] || "Unidad de aprendizaje";
};

const focoSemanalPorDistribucion = (temasRuta = [], semanas = 4, modo = "concentrada") => {
  const distribucion = distribuirTemasEnSemanas(temasRuta, semanas);
  const salida = [];
  distribucion.forEach((bloque, bloqueIndex) => {
    for (let semana = bloque.semanaInicio; semana <= bloque.semanaFin; semana += 1) {
      const posEnBloque = semana - bloque.semanaInicio;
      const totalBloque = bloque.semanaFin - bloque.semanaInicio + 1;
      let aporte;
      if (modo === "concentrada") {
        aporte = semana === 1
          ? "Explorar la situación auténtica, activar saberes previos y definir las secciones del producto."
          : semana === semanas
            ? "Revisar con los criterios acordados, socializar con la audiencia y cerrar el producto final."
            : posEnBloque <= Math.floor((totalBloque - 1) / 2)
              ? "Construir los conocimientos y recursos necesarios para elaborar la primera sección del producto."
              : "Aplicar lo aprendido en una situación auténtica y completar una sección funcional del producto.";
      } else {
        aporte = bloqueIndex === 0 && posEnBloque === 0
          ? "Presentar la situación de aprendizaje desde este tema y diseñar la primera pieza del producto."
          : posEnBloque === 0
            ? "Abrir este nuevo tema y conectarlo explícitamente con la situación de aprendizaje y el producto."
            : semana === semanas
              ? "Integrar las piezas, revisar el producto y socializarlo con su audiencia."
              : "Profundizar este tema mediante una producción parcial distinta y conectarla con las piezas anteriores.";
      }
      salida.push({ semana, tema: bloque.tema, aporte });
    }
  });
  return salida;
};

/**
 * Sugiere rutas iniciales cuando el docente todavía no ha escrito tema.
 *
 * Dos reglas que el docente pidió explícitamente:
 *   1) NO sugerir temas que el docente ya trabajó en este mismo contexto
 *      (se pasan normalizados en contexto.temasTrabajados, un Set o arreglo).
 *   2) Las combinaciones se arman por AFINIDAD real de la malla
 *      (criteriosCombinacionTematica), NO por proximidad en la lista.
 *
 * La fuente es la malla: se priorizan los primeros temas oficiales AÚN NO
 * trabajados porque normalmente abren el año y permiten diagnóstico y lenguaje
 * base antes de avanzar a contextos más complejos.
 */
export const sugerirRutasInicialesAsesor = (curriculoData, contexto = {}) => {
  // Set de temas ya trabajados (normalizados). Acepta Set o arreglo.
  const trabajados = contexto.temasTrabajados instanceof Set
    ? contexto.temasTrabajados
    : new Set((Array.isArray(contexto.temasTrabajados) ? contexto.temasTrabajados : []).map(_norm));
  const yaTrabajado = (t) => trabajados.has(_norm(t));

  const todos = (curriculoData?.temasCurriculares || [])
    .map(textoTema)
    .map((tema) => String(tema || "").trim())
    .filter(Boolean)
    .filter((tema, index, lista) => lista.findIndex((t) => _norm(t) === _norm(tema)) === index);
  if (!todos.length) return [];
  const temaOficialPorClave = new Map(todos.map((tema) => [_norm(tema), tema]));

  // Regla 1: quitar los temas que el docente ya trabajó. Si absolutamente todos
  // están trabajados (raro), caemos a la lista completa para no dejar el asesor
  // en blanco — pero conservamos el orden oficial de la malla.
  const disponibles = todos.filter((t) => !yaTrabajado(t));
  const temas = disponibles.length ? disponibles : todos;

  // Regla 2: combinaciones por afinidad de la malla. Buscamos el grupo de
  // criteriosCombinacionTematica que contiene el PRIMER tema disponible; sus
  // otros miembros (también no trabajados) son los afines reales.
  const criterios = Array.isArray(curriculoData?.criteriosCombinacionTematica)
    ? curriculoData.criteriosCombinacionTematica
    : [];
  const grupoAfinExplicitoDe = (tema) => {
    const grupo = criterios.find(
      (c) => Array.isArray(c.temas) && c.temas.some((t) => _norm(t) === _norm(tema))
    );
    if (!grupo) return null;
    const miembros = grupo.temas
      .map((t) => temaOficialPorClave.get(_norm(t)))
      .filter(Boolean)
      .filter((t) => !yaTrabajado(t))
      .filter((t, i, arr) => arr.findIndex((x) => _norm(x) === _norm(t)) === i);
    return miembros.length >= 2
      ? { nombre: grupo.nombre, razon: grupo.razon, duracionSugerida: grupo.duracionSugerida, miembros }
      : null;
  };

  // Respaldo pedagógico por disciplina cuando la malla conserva los temas
  // oficiales, pero no declara criteriosCombinacionTematica. Nunca combina por
  // proximidad: usa núcleos conceptuales/procedimentales y cruza sus miembros
  // contra la lista de temas de la malla activa.
  const claveArea = _norm(`${contexto.area || ""} ${contexto.asignatura || ""}`);
  const nucleosIdioma = [
    { nombre: "Identidad y convivencia", patrones: [/identificacion personal|personal identification/, /relaciones humanas|human relations|social relations/], razon: "Integra la presentación personal con la interacción respetuosa y el conocimiento de las personas del entorno." },
    { nombre: "Vida y comunidad escolar", patrones: [/actividades de la vida diaria|daily activities|daily life/, /escuela y educacion|school and education/], razon: "Conecta las rutinas, horarios y responsabilidades cotidianas con situaciones reales de comunicación en la escuela." },
    { nombre: "Bienestar y vida activa", patrones: [/alimentacion|food|nutrition/, /salud y cuidados|health|physical care/, /deporte|tiempo libre|recreacion|sport|leisure|recreation/], razon: "Permite comunicar hábitos, decisiones y recomendaciones relacionadas con alimentación, salud y actividad física." },
    { nombre: "Entorno y servicios de la comunidad", patrones: [/vivienda|entorno y ciudad|housing|home|city/, /bienes y servicios|goods and services/], razon: "Integra la orientación en el entorno con el acceso responsable a lugares, bienes y servicios de la comunidad." },
    { nombre: "Comunicación y tecnología", patrones: [/lengua y comunicacion|language and communication/, /ciencia y tecnologia|science and technology/], razon: "Relaciona los medios y prácticas de comunicación con usos cotidianos de la ciencia y la tecnología." },
    { nombre: "Clima, ambiente y movilidad", patrones: [/clima|condiciones atmosfericas|medio ambiente|weather|climate|environment/, /viajes y turismo|travel|tourism/], razon: "Conecta el clima y el ambiente con decisiones, recomendaciones y experiencias de viaje." },
  ];
  const nucleosPorArea = [
    {
      area: /matematica/,
      nucleos: [
        { nombre: "Números y resolución de problemas", patrones: [/numero|numeracion|operacion|calculo/, /problema|estimacion|patron/], razon: "Integra sentido numérico, estrategias de cálculo y resolución argumentada de situaciones del entorno." },
        { nombre: "Medición, geometría y espacio", patrones: [/medida|longitud|perimetro|area|volumen/, /geometr|figura|angulo|plano|espacio/], razon: "Relaciona la medición con la representación y el análisis de formas y espacios reales." },
        { nombre: "Datos, probabilidad y decisiones", patrones: [/estadistic|datos|grafico|tabla/, /probabilidad|azar|encuesta/], razon: "Conecta la recolección y representación de datos con la interpretación y toma de decisiones." },
      ],
    },
    {
      area: /ciencias de la naturaleza|biologia|quimica|fisica/,
      excluir: /educacion fisica/,
      nucleos: [
        { nombre: "Seres vivos, ecosistemas y ambiente", patrones: [/seres vivos|celula|organismo|biodiversidad/, /ecosistema|ambiente|cadena aliment|recursos naturales/], razon: "Integra estructuras y funciones de los seres vivos con sus relaciones ecológicas y el cuidado ambiental." },
        { nombre: "Materia, energía y transformaciones", patrones: [/materia|mezcla|sustancia|propiedad/, /energia|fuerza|movimiento|calor|electricidad/], razon: "Permite explicar transformaciones mediante observación, medición, experimentación y modelos científicos." },
        { nombre: "Salud, cuerpo y prevención", patrones: [/cuerpo|sistema|nutricion|reproduccion/, /salud|enfermedad|higiene|prevencion/], razon: "Relaciona el funcionamiento del organismo con decisiones de salud, prevención y bienestar." },
      ],
    },
    {
      area: /ciencias sociales|historia|geografia|moral y civica/,
      nucleos: [
        { nombre: "Territorio, población y comunidad", patrones: [/geografia|territorio|relieve|clima|mapa/, /poblacion|comunidad|migracion|economia/], razon: "Conecta las características del territorio con la organización, movilidad y actividades de la población." },
        { nombre: "Procesos históricos e identidad", patrones: [/historia|periodo|colonizacion|independencia/, /identidad|cultura|patrimonio|memoria/], razon: "Relaciona procesos históricos, fuentes e identidad para interpretar el presente de manera fundamentada." },
        { nombre: "Ciudadanía, derechos y convivencia", patrones: [/ciudadania|derecho|deber|democracia/, /convivencia|participacion|institucion|constitucion/], razon: "Integra derechos, responsabilidades y participación con problemas reales de convivencia y ciudadanía." },
      ],
    },
    {
      area: /lengua espanola/,
      nucleos: [
        { nombre: "Comprensión y producción de textos", patrones: [/comprension|lectura|texto/, /produccion|escritura|redaccion|borrador/], razon: "Articula lectura de modelos, planificación, producción, revisión y publicación con una audiencia auténtica." },
        { nombre: "Textos informativos y argumentativos", patrones: [/noticia|informe|articulo|expositivo/, /comentario|opinion|argument|debate/], razon: "Integra búsqueda de información, organización de ideas y sustentación de una postura comunicativa." },
        { nombre: "Literatura, oralidad y creación", patrones: [/cuento|poesia|novela|literatura/, /oralidad|recital|dramat|teatro/], razon: "Relaciona apreciación literaria, interpretación y creación oral o escrita para una socialización real." },
      ],
    },
    {
      area: /educacion fisica/,
      nucleos: [
        { nombre: "Capacidades físicas y vida saludable", patrones: [/capacidades? fisicas?|resistencia|fuerza|velocidad|flexibilidad/, /salud|habito|bienestar|condicion fisica/], razon: "Integra el desarrollo motor con autorregulación, seguridad y hábitos para una vida activa." },
        { nombre: "Coordinación, juegos y convivencia", patrones: [/coordinacion|equilibrio|habilidad motriz/, /juego|deporte|cooperacion|regla/], razon: "Relaciona habilidades motrices con reglas, cooperación, estrategia y convivencia respetuosa." },
      ],
    },
    {
      area: /educacion artistica/,
      nucleos: [
        { nombre: "Lenguajes, técnicas y creación artística", patrones: [/lenguaje artistico|elementos visuales|ritmo|sonido/, /tecnica|material|creacion|composicion/], razon: "Articula exploración de lenguajes y técnicas con un proceso intencional de creación y exposición." },
        { nombre: "Patrimonio, identidad y expresión", patrones: [/patrimonio|cultura|identidad|tradicion/, /expresion|obra|apreciacion|artista/], razon: "Relaciona referentes culturales e identidad con apreciación, interpretación y producción artística." },
      ],
    },
    {
      area: /formacion integral humana|religiosa|fihr/,
      nucleos: [
        { nombre: "Dignidad, valores y convivencia", patrones: [/dignidad|valor|persona|familia/, /convivencia|respeto|solidaridad|paz/], razon: "Conecta la reflexión sobre la dignidad y los valores con decisiones y compromisos de convivencia." },
        { nombre: "Fe, comunidad y compromiso", patrones: [/fe|jesus|biblia|espiritualidad/, /comunidad|servicio|compromiso|responsabilidad/], razon: "Relaciona referentes de fe y espiritualidad con acciones responsables al servicio de la comunidad." },
      ],
    },
    {
      area: /tecnologia|informatica/,
      nucleos: [
        { nombre: "Diseño, fabricación y solución de problemas", patrones: [/diseno|prototipo|fabricacion|material/, /problema|solucion|proceso tecnologico|prueba/], razon: "Integra identificación de necesidades, diseño, construcción, prueba y mejora de una solución funcional." },
        { nombre: "Información, comunicación y ciudadanía digital", patrones: [/informacion|datos|internet|red/, /comunicacion|seguridad|ciudadania digital|privacidad/], razon: "Relaciona el uso de información y medios digitales con comunicación segura, crítica y responsable." },
      ],
    },
  ];
  const perfilArea = /ingles|frances|lenguas extranjeras|english|french/.test(claveArea)
    ? { nucleos: nucleosIdioma }
    : nucleosPorArea.find((perfil) => perfil.area.test(claveArea) && !perfil.excluir?.test(claveArea));
  const grupoAfinTematicoDe = (tema) => {
    if (!perfilArea) return null;
    const clave = _norm(tema);
    const nucleo = perfilArea.nucleos.find((n) => n.patrones.some((p) => p.test(clave)));
    if (!nucleo) return null;
    const miembros = temas.filter((candidato) => {
      const c = _norm(candidato);
      return nucleo.patrones.some((p) => p.test(c));
    });
    return miembros.length >= 2 ? { ...nucleo, miembros } : null;
  };
  const grupoAfinDe = (tema) => grupoAfinExplicitoDe(tema) || grupoAfinTematicoDe(tema);
  const duracionTemaIndividual = (tema) => {
    const temaNorm = _norm(tema);
    if (/educacion fisica|educacion artistica/.test(claveArea)) return 3;
    if (/proyecto|investigacion|argument|ecosistema|energia|estadistic|geometr|historia|produccion de textos|tecnologia/.test(temaNorm)) return 4;
    return 3;
  };
  const duracionCombinada = (cantidad) => (cantidad >= 3 ? 6 : 4);

  const rutas = [];
  const primero = temas[0];
  const afin = grupoAfinDe(primero);
  const temasRecomendados = afin?.miembros?.length >= 2 ? afin.miembros.slice(0, 2) : [primero];
  const semanasRecomendadas = temasRecomendados.length >= 2 ? 4 : duracionTemaIndividual(primero);

  rutas.push({
    id: temasRecomendados.length >= 2 ? "recomendada_afin" : "primer_tema",
    etiqueta: "Recomendación inicial",
    titulo: temasRecomendados.length >= 2 ? (afin.nombre || tituloInicialPorRuta(temasRecomendados, contexto)) : tituloInicialPorRuta([primero], contexto),
    temas: temasRecomendados,
    semanas: semanasRecomendadas,
    productoFinal: productoInicialPorRuta(temasRecomendados, contexto),
    razon: temasRecomendados.length >= 2
      ? `${afin.razon} Cada tema construye una sección distinta del mismo producto.`
      : `Este tema no tiene otra afinidad disponible en la malla; se propone como unidad concentrada de ${semanasRecomendadas} semanas para evitar extenderlo artificialmente.`,
    focoSemanal: focoSemanalPorDistribucion(temasRecomendados, semanasRecomendadas, temasRecomendados.length >= 2 ? "combinada" : "concentrada"),
  });

  if (temasRecomendados.length >= 2) {
    const semanas = duracionTemaIndividual(primero);
    rutas.push({
      id: "ruta_corta",
      etiqueta: "Ruta corta",
      titulo: tituloInicialPorRuta([primero], contexto),
      temas: [primero],
      semanas,
      productoFinal: productoInicialPorRuta([primero], contexto),
      razon: `Trabaja únicamente el primer tema oficial durante ${semanas} semanas cuando el grupo necesita mayor concentración o nivelación.`,
      focoSemanal: focoSemanalPorDistribucion([primero], semanas, "concentrada"),
    });
  }

  if (afin?.miembros?.length >= 3) {
    const temasRuta = afin.miembros.slice(0, 3);
    const semanas = duracionCombinada(temasRuta.length);
    rutas.push({
      id: "ruta_ampliada_afin",
      etiqueta: "Ruta ampliada (temas afines)",
      titulo: afin.nombre || tituloInicialPorRuta(temasRuta, contexto),
      temas: temasRuta,
      semanas,
      productoFinal: productoInicialPorRuta(temasRuta, contexto),
      razon: `${afin.razon} Esta variante integra tres aportes temáticos distintos en un producto común.`,
      focoSemanal: focoSemanalPorDistribucion(temasRuta, semanas, "combinada"),
    });
  }

  const clavesUsadas = new Set(temasRecomendados.map(_norm));
  const alt = temas.find((tema) => !clavesUsadas.has(_norm(tema)));
  if (alt) {
    const afinAlt = grupoAfinDe(alt);
    const temasRuta = afinAlt?.miembros?.length >= 2 ? afinAlt.miembros.slice(0, 2) : [alt];
    const semanas = temasRuta.length >= 2 ? 4 : duracionTemaIndividual(alt);
    rutas.push({
      id: "alternativa_siguiente",
      etiqueta: "Alternativa",
      titulo: temasRuta.length >= 2 ? (afinAlt.nombre || tituloInicialPorRuta(temasRuta, contexto)) : tituloInicialPorRuta(temasRuta, contexto),
      temas: temasRuta,
      semanas,
      productoFinal: productoInicialPorRuta(temasRuta, contexto),
      razon: temasRuta.length >= 2
        ? `${afinAlt.razon} Es un punto de partida diferente con afinidad pedagógica propia.`
        : `Este siguiente tema oficial no tiene afinidad disponible; se propone como unidad corta de ${semanas} semanas.`,
      focoSemanal: focoSemanalPorDistribucion(temasRuta, semanas, temasRuta.length >= 2 ? "combinada" : "concentrada"),
    });
  }

  return rutas.slice(0, 4);
};

/**
 * SUGERENCIA de efeméride para una unidad. Es una pista discreta, NUNCA impone:
 * "en tu rango de fechas cae X; podrías apoyar el tema en ella".
 *
 * Lógica acordada con el dueño:
 *   - El docente ya eligió área + grado + fecha de inicio + duración.
 *   - Calculamos el rango (inicio → inicio + semanas) y buscamos efemérides
 *     temáticas que caigan DENTRO y apliquen al área.
 *   - Tomamos la MÁS CERCANA al inicio (si dos cruzan, esa deja terminar el
 *     tema sin choque) y buscamos en la malla el tema real que mejor casa con
 *     su clave temática, para que enlace con las rutas del asesor.
 *   - Aparece aunque el tema ya esté escrito: es información, no reemplazo.
 *
 * @param {object} opts
 * @param {string} opts.fechaInicio  ISO de inicio de la unidad
 * @param {number} opts.semanas      duración (default 6)
 * @param {string} opts.area         materia del docente
 * @param {string[]} opts.temasCurriculares  temas de la malla activa
 * @returns {{ efemeride, temaSugerido, gancho, coincideConTema } | null}
 */
export const sugerirEfemerideParaUnidad = ({
  fechaInicio,
  semanas = 6,
  area = "",
  temasCurriculares = [],
  temaActual = "",
} = {}) => {
  if (!fechaInicio) return null;
  const enRango = efemeridesEnRango(fechaInicio, semanas, area);
  if (!enRango.length) return null;

  const efem = enRango[0]; // la más cercana al inicio → no choca con la siguiente

  // Buscar en la malla el tema real que mejor casa con la clave de la efeméride.
  const temas = (Array.isArray(temasCurriculares) ? temasCurriculares : [])
    .map(textoTema)
    .map((t) => String(t || "").trim())
    .filter(Boolean);
  const claveEfem = _norm(efem.tema);
  const temaSugerido =
    temas.find((t) => claveTema(t) === claveEfem) ||
    temas.find((t) => _norm(t).includes(claveEfem) || claveEfem.includes(claveTema(t))) ||
    null;

  // ¿El docente ya venía trabajando ese mismo tema? Entonces la efeméride solo
  // confirma su elección (mensaje distinto: "refuerza tu tema" vs "podrías usar").
  const coincideConTema = temaActual
    ? _norm(temaActual).includes(claveEfem) || claveEfem.includes(_norm(temaActual)) ||
      (temaSugerido && _norm(temaActual) === _norm(temaSugerido))
    : false;

  return {
    efemeride: {
      fecha: efem.fecha,
      nombre: efem.nombre,
      diasDesdeInicio: efem.diasDesdeInicio,
      esLectivo: efem.esLectivo !== false, // por defecto lo tratamos como lectivo
    },
    temaSugerido,
    gancho: efem.gancho,
    coincideConTema: !!coincideConTema,
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
  sugerirRutasInicialesAsesor,
};
