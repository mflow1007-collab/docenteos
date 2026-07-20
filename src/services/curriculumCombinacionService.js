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

  const segundaLinea = [temaOficial, ...relacionados.slice(2, 5)]
    .filter((tema, index, lista) => lista.findIndex((t) => _norm(t) === _norm(tema)) === index);
  if (segundaLinea.length >= 2) {
    opciones.push({
      nombre: `Ampliación curricular de ${temaOficial}`,
      temas: segundaLinea,
      razon: "Esta opción amplía el tema con otros contenidos oficiales de la malla cuando la unidad requiere más semanas o un producto final más riguroso.",
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
export const sugerirTemasATrabajar = (curriculoData, temaLibre) => {
  const temas = curriculoData?.temasCurriculares || [];
  const sugerencia = sugerirTemaOficial(temaLibre, temas);
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

const productoInicialPorRuta = (temas = [], { area = "", asignatura = "" } = {}) => {
  const texto = _norm(temas.join(" "));
  const esIdioma = /ingles|frances|lenguas extranjeras|english|french/.test(_norm(`${area} ${asignatura}`));
  if (esIdioma) {
    if (/identificacion|personal|relaciones|social|familia|amigos|people|friends/.test(texto)) {
      return "People Around Me: Social Interaction Portfolio";
    }
    if (/rutina|vida diaria|daily|routine|habitos/.test(texto)) {
      return "My Daily Routine and Healthy Habits Portfolio";
    }
    if (/vivienda|entorno|ciudad|house|home|city/.test(texto)) {
      return "My Home and Community Tour Portfolio";
    }
    return "My Learning Portfolio";
  }
  return `Portafolio de evidencias sobre ${temas[0] || "la unidad"}`;
};

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

/**
 * Sugiere rutas iniciales cuando el docente todavía no ha escrito tema.
 * La fuente es la malla: se priorizan los primeros temas oficiales porque
 * normalmente abren el año y permiten construir identidad, diagnóstico y
 * lenguaje base antes de avanzar a contextos más complejos.
 */
export const sugerirRutasInicialesAsesor = (curriculoData, contexto = {}) => {
  const temas = (curriculoData?.temasCurriculares || [])
    .map(textoTema)
    .map((tema) => String(tema || "").trim())
    .filter(Boolean)
    .filter((tema, index, lista) => lista.findIndex((t) => _norm(t) === _norm(tema)) === index);
  if (!temas.length) return [];

  const primeras = temas.slice(0, 3);
  const rutas = [];

  if (primeras.length >= 2) {
    const temasRuta = primeras.slice(0, Math.min(3, primeras.length));
    rutas.push({
      id: "inicio_anio",
      etiqueta: "Recomendación inicial",
      titulo: tituloInicialPorRuta(temasRuta, contexto),
      temas: temasRuta,
      semanas: Math.min(6, Math.max(4, temasRuta.length * 2)),
      productoFinal: productoInicialPorRuta(temasRuta, contexto),
      razon: "Conviene iniciar con los primeros temas de la malla porque permiten diagnosticar saberes previos, construir vocabulario base y avanzar con una secuencia natural hacia un producto integrador.",
      focoSemanal: temasRuta.map((tema, index) => ({
        semana: index + 1,
        tema,
        aporte: index === 0
          ? "Presentar la situación de aprendizaje, activar saberes previos y construir la primera pieza del producto."
          : "Ampliar el contenido anterior y añadir una nueva pieza conectada al producto final.",
      })),
    });
  }

  const alternativas = [
    {
      id: "alternativa_siguiente_bloque",
      etiqueta: "Alternativa",
      temas: temas.slice(1, 4),
      razon: "Esta ruta funciona si el docente prefiere avanzar hacia el siguiente bloque de la malla, manteniendo una progresión contextual sin empezar necesariamente por el primer tema.",
    },
    {
      id: "alternativa_integrada",
      etiqueta: "Alternativa integradora",
      temas: [temas[0], temas[2], temas[3]].filter(Boolean),
      razon: "Esta opción integra el tema inicial con contenidos posteriores para construir un producto más amplio, útil cuando el curso tiene buen diagnóstico inicial o más tiempo disponible.",
    },
  ];

  alternativas.forEach((alt) => {
    const temasAlt = alt.temas
      .filter(Boolean)
      .filter((tema, index, lista) => lista.findIndex((t) => _norm(t) === _norm(tema)) === index);
    if (temasAlt.length < 2) return;
    rutas.push({
      id: alt.id,
      etiqueta: alt.etiqueta,
      titulo: tituloInicialPorRuta(temasAlt, contexto),
      temas: temasAlt,
      semanas: Math.min(6, Math.max(4, temasAlt.length * 2)),
      productoFinal: productoInicialPorRuta(temasAlt, contexto),
      razon: alt.razon,
      focoSemanal: temasAlt.map((tema, index) => ({
        semana: index + 1,
        tema,
        aporte: index === 0
          ? "Abrir la unidad desde este foco, diagnosticar saberes y definir la primera pieza del producto."
          : "Conectar este contenido con lo anterior y agregar una nueva evidencia al producto final.",
      })),
    });
  });

  if (temas.length) {
    const tema = temas[0];
    rutas.push({
      id: "primer_tema",
      etiqueta: "Ruta corta",
      titulo: tituloInicialPorRuta([tema], contexto),
      temas: [tema],
      semanas: 4,
      productoFinal: productoInicialPorRuta([tema], contexto),
      razon: "Si quieres empezar con una unidad más concentrada, el primer tema oficial funciona bien para diagnóstico, nivelación y producción inicial sin mezclar demasiados contenidos.",
      focoSemanal: [
        { semana: 1, tema, aporte: "Explorar la situación y acordar el producto." },
        { semana: 2, tema, aporte: "Construir vocabulario, conceptos o procedimientos base." },
        { semana: 3, tema, aporte: "Aplicar el aprendizaje en una tarea guiada." },
        { semana: 4, tema, aporte: "Mejorar, socializar y cerrar el producto." },
      ],
    });
  }

  return rutas;
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
