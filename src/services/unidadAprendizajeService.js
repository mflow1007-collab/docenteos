/**
 * Servicio: Generador de Unidad de Aprendizaje — formato MINERD
 */

import { resolverClave } from "../planning/areaAsignaturaMap.js";
import { obtenerActividadesBanco, withTema } from "../planning/bancoPedagogico.js";
import { inyectarExpresiones } from "../planning/bancoExpresionesIdiomas.js";
import { obtenerBPActs } from "./bpCache.js";
import { getCompetenciasIdiomas } from "../data/indicadoresIdiomas.js";
import { getCompetenciasArea } from "../data/indicadoresAreasMINERD.js";

// ─── Constantes ───────────────────────────────────────────────────────────────

const NOMBRES_FASES = [
  "Presentación de la Situación de Aprendizaje y apropiación de la unidad",
  "Desarrollo y exploración de los aprendizajes",
  "Profundización y aplicación de los aprendizajes",
  "Integración y consolidación de los saberes",
  "Síntesis y evaluación de los aprendizajes",
  "Cierre, socialización y evaluación sumativa",
];

const ESTRATEGIAS_POR_AREA = {
  "Inglés": "Enfoque Comunicativo (Communicative Language Teaching)",
  "Lengua Española": "Enfoque Comunicativo Funcional y Lectoescritura",
  "Matemática": "Resolución de Problemas y Aprendizaje Colaborativo",
  "Ciencias de la Naturaleza": "Indagación Científica y Aprendizaje Basado en Preguntas",
  "Ciencias Sociales": "Aprendizaje Basado en Proyectos y Análisis Crítico",
  "Educación Artística": "Aprendizaje Experiencial y Expresión Creativa",
  "Educación Física": "Aprendizaje Cooperativo y Desarrollo Motor",
  "Formación Integral Humana y Religiosa": "Diálogo de Saberes y Reflexión Ética",
  "Francés": "Enfoque Comunicativo y Aprendizaje Significativo",
};

const COMPETENCIAS_FUND_POR_AREA = {
  "Inglés":                               ["Comunicativa", "Científica y Tecnológica"],
  "Lengua Española":                      ["Comunicativa", "Pensamiento Lógico, Creativo y Crítico"],
  "Matemática":                           ["Pensamiento Lógico, Creativo y Crítico", "Resolución de Problemas"],
  "Ciencias de la Naturaleza":            ["Científica y Tecnológica", "Ambiental y de la Salud"],
  "Ciencias Sociales":                    ["Ética y Ciudadana", "Ambiental y de la Salud"],
  "Educación Física":                     ["Desarrollo Personal y Espiritual", "Ambiental y de la Salud"],
  "Educación Artística":                  ["Comunicativa", "Desarrollo Personal y Espiritual"],
  "Formación Integral Humana y Religiosa":["Desarrollo Personal y Espiritual", "Ética y Ciudadana"],
  "Francés":                              ["Comunicativa", "Científica y Tecnológica"],
};

// ─── Helpers de contenido por área ────────────────────────────────────────────

const getEstrategia = (area) =>
  ESTRATEGIAS_POR_AREA[area] || "Aprendizaje Colaborativo e Indagación Dialógica";

const getSituacion = (area, tema) => {
  const s = {
    "Inglés": `Los estudiantes interactúan con situaciones comunicativas reales relacionadas con "${tema}", desarrollando sus habilidades de escucha, habla, lectura y escritura en inglés para comunicarse de manera efectiva en contextos cotidianos.`,
    "Matemática": `Los estudiantes resuelven situaciones problemáticas del entorno relacionadas con "${tema}", aplicando el pensamiento lógico-matemático para encontrar soluciones creativas y justificar sus procedimientos.`,
    "Lengua Española": `Los estudiantes exploran textos y situaciones comunicativas vinculadas con "${tema}", desarrollando competencias lectoras y escritoras que les permitan expresarse con claridad y creatividad en diferentes contextos.`,
    "Ciencias de la Naturaleza": `Los estudiantes investigan fenómenos naturales relacionados con "${tema}", formulando hipótesis, realizando observaciones y construyendo explicaciones científicas basadas en evidencia.`,
    "Ciencias Sociales": `Los estudiantes analizan situaciones sociales e históricas vinculadas con "${tema}", desarrollando el pensamiento crítico y la conciencia ciudadana para comprender y transformar su entorno.`,
  };
  return s[area] || `Los estudiantes exploran situaciones del entorno relacionadas con "${tema}", desarrollando competencias clave para comprender y aplicar los saberes en su vida cotidiana y comunitaria.`;
};

const getAmbiente = (area) => {
  const a = {
    "Inglés": "Aula de clases acondicionada con rincón de lectura en inglés, proyector, parlantes y materiales audiovisuales. Entorno comunitario para actividades de uso del idioma.",
    "Matemática": "Aula de clases con espacio para trabajo colaborativo, área de materiales manipulativos y acceso a herramientas de cálculo. Contextos reales del entorno para aplicación de conceptos.",
    "Ciencias de la Naturaleza": "Aula de clases adaptada como laboratorio básico, espacio exterior (patio/jardín) para observación y experimentación. Acceso a materiales naturales del entorno.",
  };
  return a[area] || "Aula de clases organizada para trabajo colaborativo e individual. Entorno comunitario y familiar para extensión de los aprendizajes.";
};

const getContenidos = (area, tema) => {
  const c = {
    "Inglés": {
      conceptuales: [`Vocabulario clave relacionado con ${tema}`, "Estructuras gramaticales básicas", "Elementos de la comunicación oral y escrita", "Comprensión lectora y auditiva"],
      procedimentales: [`Identificación y uso de vocabulario de ${tema} en contexto`, "Práctica de diálogos y conversaciones", "Lectura comprensiva de textos cortos", "Producción escrita de oraciones y párrafos simples"],
      actitudinales: ["Disposición para comunicarse en inglés sin temor", "Valoración de la diversidad cultural anglosajona", "Colaboración y respeto en actividades grupales", "Perseverancia ante las dificultades del aprendizaje del idioma"],
    },
    "Matemática": {
      conceptuales: [`Conceptos y definiciones de ${tema}`, "Propiedades y relaciones matemáticas", "Representaciones gráficas y simbólicas", "Terminología matemática específica"],
      procedimentales: [`Resolución de ejercicios y problemas sobre ${tema}`, "Aplicación de algoritmos y procedimientos", "Representación gráfica de conceptos", "Verificación y justificación de resultados"],
      actitudinales: ["Gusto por la resolución de problemas", "Perseverancia ante situaciones desafiantes", "Trabajo en equipo y respeto a las estrategias de los compañeros", "Valoración de la matemática en la vida cotidiana"],
    },
    "Lengua Española": {
      conceptuales: [`Características del género/tipo de texto relacionado con ${tema}`, "Elementos gramaticales y ortográficos", "Vocabulario específico del área", "Estructura de la comunicación oral y escrita"],
      procedimentales: [`Lectura comprensiva y análisis de textos sobre ${tema}`, "Producción de textos escritos con coherencia y cohesión", "Participación en situaciones de comunicación oral", "Aplicación de normas ortográficas y gramaticales"],
      actitudinales: ["Valoración de la lengua española como herramienta de comunicación", "Gusto por la lectura y la escritura", "Respeto por las producciones orales y escritas de los compañeros", "Responsabilidad en las tareas comunicativas"],
    },
  };
  return c[area] || {
    conceptuales: [`Conceptos fundamentales de ${tema}`, "Principios y teorías relacionadas", "Terminología específica del área", "Relaciones entre los diferentes elementos del tema"],
    procedimentales: [`Aplicación práctica de los conceptos de ${tema}`, "Desarrollo de habilidades específicas del área", "Trabajo colaborativo e individual", "Producción y presentación de trabajos"],
    actitudinales: ["Interés y curiosidad por el aprendizaje", "Responsabilidad en el desarrollo de las actividades", "Respeto y colaboración con los compañeros", "Valoración del conocimiento y su aplicación práctica"],
  };
};

const getEjesTematicos = (area) => {
  const ejes = {
    "Inglés": ["Alfabetización Imprescindible", "Ciudadanía y Convivencia"],
    "Matemática": ["Alfabetización Imprescindible", "Desarrollo Sostenible"],
    "Ciencias de la Naturaleza": ["Desarrollo Sostenible", "Ciudadanía y Convivencia"],
    "Ciencias Sociales": ["Ciudadanía y Convivencia", "Desarrollo Sostenible"],
    "Educación Física": ["Salud y Bienestar", "Ciudadanía y Convivencia"],
    "Lengua Española": ["Alfabetización Imprescindible", "Ciudadanía y Convivencia"],
  };
  return ejes[area] || ["Alfabetización Imprescindible", "Ciudadanía y Convivencia"];
};

// ─── Generador de momentos por día ────────────────────────────────────────────

// ─── Banco temático para Inglés — Retroalimentación y Recuperación narrativa ──

const _BANCO_TEMAS_INGLES = [
  {
    test: /rutina|routine|daily life|vida diaria|daily routine|my life|actividades diarias/i,
    preguntas: [
      ["What time do you wake up?", "What do you do before going to school?"],
      ["What do you do after school?", "What time do you have lunch?"],
      ["What do you do in the evenings?", "What time do you go to bed?"],
      ["What do you do on weekends?", "Do you have a morning routine?"],
    ],
    vocabulario: [
      "wake up, brush teeth, have breakfast, go to school",
      "have lunch, do homework, have dinner, go to bed",
      "morning, afternoon, evening, always, usually, sometimes",
      "daily activities, parts of the day, time expressions, daily schedule",
    ],
    temaHoy: [
      "actividades cotidianas y vocabulario de rutinas diarias",
      "actividades diarias y partes del día",
      "expresiones de tiempo y la rutina del hogar",
      "la rutina completa y los elementos del producto final",
    ],
    temaAnterior: [
      "las actividades cotidianas exploradas en la clase anterior",
      "el vocabulario de rutinas y las actividades de la mañana",
      "las expresiones de tiempo y la rutina escolar",
      "las actividades del hogar y los fines de semana",
    ],
  },
  {
    test: /greet|salud|introduc|hello|hi\b|presentation|presentaci/i,
    preguntas: [
      ["How are you today?", "What's your name?"],
      ["Where are you from?", "How old are you?"],
      ["What do you like to do?", "Do you have brothers or sisters?"],
      ["What is your favorite subject?", "What do you want to be when you grow up?"],
    ],
    vocabulario: [
      "hello, good morning, my name is, nice to meet you",
      "I'm from, I'm _ years old, I live in",
      "I like, I don't like, my favorite is, pleased to meet you",
      "greetings, introductions, personal information, formal and informal expressions",
    ],
    temaHoy: [
      "saludos y presentaciones básicas en inglés",
      "información personal y expresiones de presentación",
      "descripciones personales y preferencias",
      "presentaciones formales e informales en inglés",
    ],
    temaAnterior: [
      "los saludos y expresiones básicas de presentación",
      "el vocabulario de información personal",
      "las descripciones y preferencias personales",
      "las presentaciones formales e informales",
    ],
  },
  {
    test: /famil|family|relatives|mi familia/i,
    preguntas: [
      ["How many people are in your family?", "Who is in your family?"],
      ["What does your mother or father do?", "How old is your grandmother?"],
      ["What do you do together as a family?", "Who lives in your house?"],
      ["What is your family like?", "What traditions does your family have?"],
    ],
    vocabulario: [
      "mother, father, brother, sister, grandmother, grandfather",
      "aunt, uncle, cousin, family members, relatives",
      "tall, short, young, old, kind, funny, hard-working",
      "family activities, traditions, household chores, roles",
    ],
    temaHoy: [
      "los miembros de la familia y el vocabulario familiar en inglés",
      "descripciones físicas y de personalidad de los familiares",
      "las actividades familiares y las rutinas del hogar",
      "la familia y las relaciones interpersonales",
    ],
    temaAnterior: [
      "el vocabulario básico de los miembros de la familia",
      "los nombres y roles de los familiares",
      "las descripciones de los miembros de la familia",
      "las actividades y rutinas familiares",
    ],
  },
  {
    test: /food|comida|nutrition|nutrici|healthy|saludable|eat|comer|meal|aliment/i,
    preguntas: [
      ["What did you have for breakfast today?", "What is your favorite food?"],
      ["What do you eat for lunch?", "Do you like vegetables?"],
      ["What is a healthy meal?", "How often do you eat fruit?"],
      ["What food is popular in your community?", "What are the benefits of healthy eating?"],
    ],
    vocabulario: [
      "fruit, vegetables, bread, rice, chicken, water, juice",
      "breakfast, lunch, dinner, snack, meal",
      "delicious, healthy, sweet, salty, fresh, tasty",
      "nutrition, balanced diet, food groups, healthy habits",
    ],
    temaHoy: [
      "el vocabulario de alimentos y comidas del día",
      "los grupos alimenticios y los hábitos saludables",
      "las preferencias alimenticias y las descripciones de comidas",
      "la nutrición y la alimentación equilibrada",
    ],
    temaAnterior: [
      "el vocabulario básico de alimentos y comidas",
      "los alimentos y las comidas del día",
      "los hábitos alimenticios y los grupos de alimentos",
      "las preferencias y descripciones de comidas",
    ],
  },
  {
    test: /weather|clima|season|estaci|temperature|temperatura/i,
    preguntas: [
      ["What's the weather like today?", "What is your favorite season?"],
      ["What do you wear when it rains?", "What do you do on a sunny day?"],
      ["How does the weather affect what you do?", "What is the weather usually like in your town?"],
      ["What season is it now?", "How has the weather changed recently?"],
    ],
    vocabulario: [
      "sunny, rainy, cloudy, windy, hot, cold, warm",
      "spring, summer, autumn, winter, season",
      "umbrella, raincoat, sweater, sunscreen, boots",
      "temperature, forecast, climate, natural events",
    ],
    temaHoy: [
      "el vocabulario del tiempo y las condiciones climáticas",
      "las estaciones del año y las actividades relacionadas",
      "las descripciones del tiempo y su impacto en la vida diaria",
      "el clima, el medio ambiente y los cambios estacionales",
    ],
    temaAnterior: [
      "el vocabulario básico del tiempo y las condiciones climáticas",
      "los tipos de tiempo y el vocabulario de las estaciones",
      "las estaciones y las actividades según el clima",
      "las condiciones climáticas y su impacto cotidiano",
    ],
  },
  {
    test: /body|cuerpo|body parts|partes del cuerpo/i,
    preguntas: [
      ["Can you name five parts of the body in English?", "What do you use your hands for?"],
      ["What do you do to keep your body healthy?", "How many times a day do you brush your teeth?"],
      ["What do you do when you feel sick?", "Why is it important to exercise?"],
      ["How do you take care of your body?", "What healthy habits do you practice every day?"],
    ],
    vocabulario: [
      "head, shoulders, arms, legs, hands, feet, eyes, nose, mouth",
      "healthy, sick, exercise, rest, hygiene, nutrition",
      "doctor, medicine, hospital, feelings, symptoms",
      "body systems, health habits, physical activity, well-being",
    ],
    temaHoy: [
      "las partes del cuerpo y el vocabulario de salud en inglés",
      "los hábitos de higiene y el cuidado personal",
      "la salud, el ejercicio y los hábitos saludables",
      "el cuerpo humano y la salud integral",
    ],
    temaAnterior: [
      "el vocabulario básico de las partes del cuerpo",
      "las partes del cuerpo y los hábitos de higiene",
      "los hábitos saludables y el cuidado físico",
      "la salud y los hábitos de vida saludable",
    ],
  },
  {
    test: /school|escuela|community|comunidad|classroom|aula|places|lugares/i,
    preguntas: [
      ["What is your school like?", "What is your favorite subject?"],
      ["What places are in your community?", "Where do you go after school?"],
      ["What do you like most about your school?", "What is special about your community?"],
      ["How do people help each other in your community?", "What places are important in your town?"],
    ],
    vocabulario: [
      "classroom, teacher, student, school, subjects, schedule",
      "library, cafeteria, gym, playground, office, hall",
      "community, neighborhood, park, market, church, town",
      "places, buildings, community helpers, local services",
    ],
    temaHoy: [
      "el vocabulario de la escuela y las aulas en inglés",
      "los lugares de la comunidad y su descripción",
      "la escuela, la comunidad y los servicios locales",
      "la comunidad y las personas que la conforman",
    ],
    temaAnterior: [
      "el vocabulario básico de la escuela y las materias",
      "los lugares de la escuela y la comunidad cercana",
      "los lugares y las personas de la comunidad",
      "la escuela y la comunidad local",
    ],
  },
];

const _getBancoTemaIngles = (tema) => {
  for (const banco of _BANCO_TEMAS_INGLES) {
    if (banco.test.test(tema)) return banco;
  }
  return null;
};

const _getActsInicioIngles = (tema, fasePos, diaNum) => {
  const banco = _getBancoTemaIngles(tema);
  const varIdx = Math.min(fasePos, 3);

  // Primera clase de la unidad — diagnóstico sin retroalimentación previa
  if (fasePos === 0 && diaNum === 0) {
    const vocabInicio = banco ? banco.vocabulario[0] : `palabras conocidas en inglés relacionadas con "${tema}"`;
    const temaHoy0   = banco ? banco.temaHoy[0]    : `el vocabulario básico de "${tema}"`;
    return [
      `El docente da la bienvenida a los estudiantes. "Good morning, everyone! How are you today? Are you ready to start our new unit?" Los estudiantes responden usando expresiones básicas en inglés.`,
      `Observan imágenes relacionadas con "${tema}" y expresan en inglés palabras o frases que ya conocen. El docente organiza el vocabulario aportado en la pizarra como banco inicial de la unidad.`,
      `Exploración diagnóstica de saberes previos: mencionando palabras conocidas en inglés relacionadas con ${temaHoy0}. Vocabulario esperado: ${vocabInicio}.`,
      `El docente presenta la intención pedagógica de la unidad, el producto final esperado y el propósito de aprender sobre "${tema}".`,
    ];
  }

  // Retroalimentación mira UN paso atrás; recuperación apunta a HOY
  const retroIdx = Math.max(0, varIdx - (fasePos > 0 ? 1 : 0));

  const pregsFase = banco
    ? banco.preguntas[Math.min(retroIdx, banco.preguntas.length - 1)]
    : [`What did we learn about "${tema}" last time?`, `Can you remember 3 words we studied about "${tema}"?`];
  const preguntasStr = (pregsFase || []).join(" ");

  const temaAnteriorStr = banco
    ? banco.temaAnterior[Math.min(retroIdx, banco.temaAnterior.length - 1)]
    : `el contenido trabajado en la clase anterior sobre "${tema}"`;

  const vocabHoy = banco
    ? banco.vocabulario[Math.min(varIdx, banco.vocabulario.length - 1)]
    : `vocabulario y expresiones relacionadas con "${tema}"`;

  const temaHoyStr = banco
    ? banco.temaHoy[Math.min(varIdx, banco.temaHoy.length - 1)]
    : `el contenido de hoy sobre "${tema}"`;

  return [
    `El docente saluda a los estudiantes en inglés. "Good morning! How are you today? Are you ready for today's class?" Los estudiantes responden usando las expresiones trabajadas.`,
    `Retroalimentación de experiencias relacionadas con ${temaAnteriorStr} mediante preguntas orales. (${preguntasStr})`,
    `Recuperación o exploración de saberes previos: mencionando palabras conocidas en inglés relacionadas con ${temaHoyStr}. Vocabulario esperado: ${vocabHoy}.`,
    `El docente presenta la intención pedagógica y el propósito de la clase de hoy.`,
  ];
};

const getActsInicio = (area, tema, fasePos, diaNum) => {
  if (area === "Inglés") return _getActsInicioIngles(tema, fasePos, diaNum);

  const variantes = {
    "Inglés": [
      // Variante 0 — Fase 1 (Presentación): LISTENING + SPEAKING diagnóstico
      [
        `Responden al saludo e indicaciones iniciales del docente en inglés. _({expr_saludo})_`,
        `Escuchan un audio corto o diálogo del docente sobre "${tema}". Identifican el tema general, palabras que reconocen y expresiones claves. _({expr_comprension_listening})_`,
        `Recuperan saberes previos oralmente: responden libremente las preguntas del docente sobre "${tema}". _(What do you already know about ${tema}? Have you seen or used this before?)_`,
        `Expresan en inglés qué saben y qué quisieran aprender sobre "${tema}" usando palabras simples, frases o gestos. _(I know... / I think... / I want to learn...)_`,
        `Escuchan el objetivo comunicativo de la sesión y el tipo de producción que realizarán al finalizar.`,
      ],
      // Variante 1 — Fase 2 (Desarrollo): READING + GRAMMAR awareness
      [
        `Responden al saludo e indicaciones del docente en inglés y retroalimentan la sesión anterior sobre "${tema}". _({expr_saludo})_`,
        `Leen un texto corto relacionado con "${tema}" en la pizarra, tarjeta o proyección. Identifican: palabras conocidas, palabras nuevas, e idea principal. _({expr_comprension_reading})_`,
        `Analizan las estructuras gramaticales presentes en el texto de "${tema}". _({expr_gramatica})_`,
        `Relacionan las estructuras del texto con situaciones reales del entorno. Formulan 1–2 oraciones propias usando el patrón identificado sobre "${tema}".`,
        `Escuchan el objetivo gramatical-comunicativo del día y se preparan para la práctica de la sesión.`,
      ],
      // Variante 2 — Fase 3 (Profundización): WRITING + VOCABULARY + Speaking
      [
        `Responden al saludo e indicaciones del docente en inglés. _({expr_saludo})_`,
        `Demuestran vocabulario de "${tema}" en un reto de activación rápida. _({expr_vocabulario})_`,
        `Revisan y amplían el vocabulario de "${tema}": el docente presenta palabras nuevas con definición en contexto. Los estudiantes las usan en oraciones propias orales y escritas.`,
        `Escriben individualmente 3–5 oraciones o un párrafo corto sobre "${tema}" aplicando estructuras y vocabulario trabajados. Utilizan modelos del docente como referencia.`,
        `Comparten su producción con un compañero para revisión rápida y preparan la actividad de escritura o producción oral principal de la sesión. _({expr_parejas})_`,
      ],
    ],
    "Matemática": [
      [
        `Responden al saludo e indicaciones iniciales del docente.`,
        `Retroalimentan la clase anterior compartiendo en parejas las respuestas de la tarea asignada.`,
        `Recuperan o exploran saberes previos: resuelven 2–3 ejercicios rápidos de cálculo mental vinculados a "${tema}".`,
        `Observan un problema de la vida real relacionado con "${tema}" presentado por el docente y expresan sus ideas iniciales oralmente.`,
        `Escuchan la intención pedagógica y el propósito de la sesión.`,
      ],
      [
        `Responden al saludo e indicaciones del docente y revisan brevemente la tarea anterior.`,
        `Retroalimentan los aprendizajes previos respondiendo preguntas del docente: _¿Qué recuerdan de ${tema}? ¿Dónde lo han visto en la vida cotidiana?_`,
        `Recuperan saberes previos participando en una dinámica de activación: reto matemático, adivinanza numérica o situación gráfica vinculada a "${tema}".`,
        `Expresan sus observaciones e hipótesis iniciales sobre el contenido del día de manera oral.`,
        `Escuchan el objetivo del día y la relevancia de "${tema}" en situaciones cotidianas.`,
      ],
      [
        `Responden al saludo e indicaciones iniciales.`,
        `Retroalimentan la clase anterior: tres voluntarios comparten algo aprendido sobre el tema trabajado previamente.`,
        `Recuperan saberes previos explorando una situación desafiante presentada por el docente. _¿Qué sabemos sobre ${tema}? ¿Cómo lo podemos aplicar?_`,
        `Expresan sus ideas, razonamientos y estrategias previas ante el problema o situación planteada.`,
        `Registran el objetivo del día en su cuaderno y escuchan la intención pedagógica de la sesión.`,
      ],
    ],
    "Lengua Española": [
      [
        `Responden al saludo e indicaciones iniciales del docente.`,
        `Retroalimentan la clase anterior compartiendo ideas o producciones relacionadas con "${tema}".`,
        `Recuperan o exploran saberes previos: observan un texto, imagen o situación comunicativa y expresan lo que saben sobre "${tema}".`,
        `Expresan oralmente sus experiencias e ideas relacionando el contenido con situaciones de su entorno cotidiano.`,
        `Escuchan la intención pedagógica y el propósito de la clase.`,
      ],
      [
        `Responden al saludo e indicaciones del docente y revisan brevemente la tarea anterior.`,
        `Retroalimentan los aprendizajes previos respondiendo preguntas del docente sobre "${tema}".`,
        `Recuperan saberes previos participando en una dinámica de activación: lluvia de ideas, asociación de palabras o lectura de una oración motivadora.`,
        `Expresan sus ideas y predicciones sobre el contenido del día de manera oral y/o escrita.`,
        `Escuchan el objetivo de la sesión y registran la intención pedagógica en su cuaderno.`,
      ],
      [
        `Responden al saludo e indicaciones iniciales.`,
        `Retroalimentan la clase anterior: voluntarios comparten algo que aprendieron o produjeron relacionado con "${tema}".`,
        `Recuperan saberes previos explorando un recurso textual o visual presentado por el docente y expresan sus observaciones.`,
        `Expresan con sus propias palabras qué saben sobre "${tema}" y formulan preguntas sobre lo que desean aprender.`,
        `Escuchan la intención pedagógica y el propósito de la sesión.`,
      ],
    ],
  };

  if (variantes[area]) {
    const acts = variantes[area][fasePos % variantes[area].length];
    // Inglés y Francés: inyectar expresiones del banco para variación diaria
    if (area === "Inglés") return inyectarExpresiones(acts, diaNum, "en");
    if (area === "Francés") return inyectarExpresiones(acts, diaNum, "fr");
    return acts;
  }

  // Banco Pedagógico Firestore (oficial) tiene prioridad
  const bpActsInicio = obtenerBPActs(area, "Inicio", diaNum);
  if (bpActsInicio) return withTema(bpActsInicio, tema);

  // Banco especializado estático como fallback
  const bankActs = obtenerActividadesBanco(area, "Inicio", fasePos, diaNum);
  if (bankActs) return withTema(bankActs, tema);

  // Fallback genérico
  const generic = [
    [
      `Responden al saludo e indicaciones iniciales del docente.`,
      `Recuperan saberes previos: el docente presenta una situación o pregunta diagnóstica sobre "${tema}" para explorar lo que saben y lo que necesitan aprender.`,
      `Expresan y clasifican sus conocimientos previos sobre "${tema}": _¿Qué sé? / ¿Qué creo? / ¿Qué no sé?_`,
      `Formulan preguntas o hipótesis iniciales que guiarán su aprendizaje durante la sesión.`,
      `Escuchan la intención pedagógica y el propósito de aprendizaje de la sesión.`,
    ],
    [
      `Responden al saludo e indicaciones del docente.`,
      `Retroalimentan los aprendizajes construidos en la sesión anterior sobre "${tema}" y los conectan con el nuevo contenido del día.`,
      `Participan en una dinámica de activación que prepara el pensamiento para la construcción de nuevos conocimientos sobre "${tema}".`,
      `Formulan hipótesis o predicciones sobre el contenido del día y se preparan para verificarlas durante el desarrollo.`,
      `Escuchan el objetivo del día y la conexión con la situación de aprendizaje de la unidad.`,
    ],
    [
      `Responden al saludo e indicaciones iniciales.`,
      `Demuestran sus aprendizajes sobre "${tema}" respondiendo preguntas de nivel aplicado: _¿Cómo usarías esto? ¿Dónde lo ves en la vida real?_`,
      `Relacionan lo aprendido en fases anteriores con el desafío de aplicación que abordarán hoy en "${tema}".`,
      `Establecen sus metas de desempeño para la sesión: _¿Qué quiero lograr hoy? ¿Cómo sabré que lo logré?_`,
      `Escuchan y registran la intención pedagógica y el propósito de la sesión.`,
    ],
  ];
  return generic[fasePos % generic.length];
};

const _getActsDesarrolloIngles = (tema, fasePos, diaNum) => {
  const banco = _getBancoTemaIngles(tema);
  const varIdx = Math.min(fasePos, 2);

  // Fase 0 — Presentación / Diagnóstico: vocabulario + speaking oral
  if (fasePos === 0) {
    const vocab = banco ? banco.vocabulario[0] : `vocabulario esencial de "${tema}"`;
    return [
      `Presentan vocabulario clave de "${tema}" con imágenes de personas realizando las actividades. Los estudiantes repiten cada palabra en coro y luego individualmente, cuidando la pronunciación.`,
      `Practican en parejas usando las imágenes: "Look at the picture. What is she/he doing?" Los compañeros responden con oraciones completas: "She/He is waking up / having breakfast / going to school."`,
      `Realizan actividad de asociación: relacionan el vocabulario de "${tema}" con las imágenes o descripciones correspondientes. Verifican respuestas con el compañero y corrigen juntos los errores.`,
      `El docente modela oraciones completas sobre "${tema}" usando el vocabulario presentado. Vocabulario trabajado: ${vocab}. Los estudiantes construyen sus propias oraciones siguiendo el modelo dado.`,
    ];
  }

  // Fase 1 — Desarrollo: lectura + gramática en contexto
  if (fasePos === 1) {
    const vocab = banco ? banco.vocabulario[1] : `estructuras y vocabulario de "${tema}"`;
    return [
      `Leen un texto corto sobre "${tema}" y responden preguntas de comprensión en tres niveles: literal (¿qué dice?), inferencial (¿qué significa?) e interpretativo (¿qué opinas?).`,
      `Analizan la estructura gramatical del texto: identifican el patrón, lo nombran y explican su función. El docente presenta la regla en la pizarra con ejemplos del contexto de "${tema}".`,
      `Practican la estructura en ejercicios contextualizados: completan oraciones, transforman ejemplos y construyen 3–5 oraciones propias sobre "${tema}". Vocabulario de apoyo: ${vocab}.`,
      `Comparten sus respuestas en parejas. El docente retroalimenta la precisión gramatical y corrige errores comunes frente a toda la clase de manera positiva y motivadora.`,
    ];
  }

  // Fase 2 — Profundización: escritura + revisión por pares
  const vocab2 = banco ? banco.vocabulario[2] : `vocabulario avanzado de "${tema}"`;
  return [
    `Amplían el vocabulario de "${tema}" con nuevas expresiones y colocaciones. Los estudiantes las registran en su glosario personal con definición y oración de ejemplo propia. Vocabulario: ${vocab2}.`,
    `Redactan un párrafo o diálogo sobre "${tema}" usando el vocabulario y las estructuras trabajadas. Utilizan el organizador gráfico de la unidad como guía de escritura.`,
    `Intercambian su producción para revisión por pares (peer editing): verifican vocabulario, gramática y claridad. Anotan dos aspectos positivos y una sugerencia concreta de mejora.`,
    `Incorporan las correcciones del peer editing y comparten oralmente un fragmento de su producción ante el grupo. El docente retroalimenta la expresión oral y escrita de manera formativa.`,
  ];
};

const getActsDesarrollo = (area, tema, fasePos, diaNum) => {
  if (area === "Inglés") return _getActsDesarrolloIngles(tema, fasePos, diaNum);

  const variantes = {
    "Inglés": [
      // Variante 0 — Fase 1 (Presentación): LISTENING + SPEAKING
      [
        `Realizan comprensión auditiva con propósito definido: _{expr_listening_nombre}_ sobre "${tema}". _({expr_listening_tarea})_ Progresión de tres escuchas: (1) tema general, (2) palabras clave, (3) detalles específicos.`,
        `Responden preguntas orales de comprensión auditiva sobre "${tema}". Usan oraciones completas y el vocabulario escuchado. _({expr_comprension_listening})_`,
        `Practican la pronunciación del vocabulario clave de "${tema}": el docente modela con énfasis en entonación y acento; los estudiantes repiten en coro y luego individualmente. _({expr_pronunciacion})_`,
        `Realizan speaking en parejas: un estudiante pregunta usando vocabulario del audio, el otro responde. _({expr_parejas})_ Reciben retroalimentación del docente sobre pronunciación y fluidez.`,
      ],
      // Variante 1 — Fase 2 (Desarrollo): READING + GRAMMAR in context
      [
        `Leen un texto de "${tema}" y realizan comprensión lectora en tres niveles: literal _(¿qué dice?)_, inferencial _(¿qué significa?)_ e interpretativo _(¿qué opinas?)_. _({expr_comprension_reading})_`,
        `Analizan las estructuras gramaticales del texto de "${tema}": identifican el patrón, lo nombran y explican su función. _({expr_gramatica})_`,
        `Practican la gramática de "${tema}" en ejercicios contextualizados: completan diálogos, transforman oraciones y construyen ejemplos propios. _({expr_instruccion})_`,
        `Comparten sus respuestas con el grupo. El docente retroalimenta precisión gramatical y comprensión lectora. _({expr_retroalimentacion})_`,
      ],
      // Variante 2 — Fase 3 (Profundización): WRITING + VOCABULARY + Speaking
      [
        `Amplían el vocabulario de "${tema}": sinónimos, expresiones idiomáticas y colocaciones. Registran en su glosario: definición en inglés + oración de ejemplo. _({expr_vocabulario})_`,
        `Redactan sobre "${tema}": párrafo, diálogo, historia o email usando vocabulario y estructuras aprendidas. Aplican reglas ortográficas del inglés. _({expr_writing})_`,
        `Intercambian su producción para revisión por pares _(peer editing)_: verifican vocabulario, gramática, coherencia y claridad. Devuelven con 2 elogios y 1 sugerencia de mejora. _({expr_parejas})_`,
        `Comparten oralmente un fragmento de su producción ante el grupo. El docente retroalimenta la expresión escrita y oral. _({expr_retroalimentacion})_`,
      ],
    ],
    "Matemática": [
      [
        `Observan la explicación del docente sobre "${tema}" con ejemplos paso a paso en la pizarra. Analizan el procedimiento e identifican los pasos esenciales.`,
        `Resuelven ejercicios guiados individualmente. El docente circula, verifica la comprensión y brinda retroalimentación inmediata.`,
        `Trabajan en parejas resolviendo 3–4 problemas aplicados sobre "${tema}". Explican oralmente su procedimiento al compañero (think-aloud).`,
        `Socializan las respuestas con el grupo. El docente aclara errores comunes y refuerza el procedimiento correcto. Registran en su cuaderno el proceso y los ejemplos claves.`,
      ],
      [
        `Analizan el nuevo concepto de "${tema}" mediante material concreto, representación gráfica o situación real presentada por el docente. Identifican sus características y propiedades.`,
        `Exploran y practican en estaciones de aprendizaje donde aplican diferentes aspectos de "${tema}". Argumentan oralmente sus estrategias ante sus compañeros.`,
        `Resuelven en grupos un problema desafiante sobre "${tema}" eligiendo la estrategia más adecuada. Representan el proceso de manera gráfica y/o numérica.`,
        `Ponen en común los resultados. El docente sistematiza los aprendizajes en la pizarra. Registran el procedimiento, propiedades y ejemplos del día en el cuaderno.`,
      ],
      [
        `Observan situaciones problemáticas con diferentes niveles de complejidad sobre "${tema}" y seleccionan la estrategia más adecuada para resolverlas.`,
        `Resuelven individualmente y luego comparan sus respuestas y estrategias en pequeños grupos. Identifican semejanzas y diferencias entre los procedimientos utilizados.`,
        `Representan el mismo problema de dos maneras diferentes: gráfica, numérica o concreta. Analizan y comparan las estrategias de sus compañeros.`,
        `Identifican y registran la propiedad o regla matemática aplicada en "${tema}". El docente consolida los aprendizajes destacando los procedimientos más eficientes.`,
      ],
    ],
    "Lengua Española": [
      [
        `Observan y leen el texto o recurso principal relacionado con "${tema}" presentado por el docente. Identifican sus características, estructura y elementos lingüísticos claves.`,
        `Analizan los elementos gramaticales, ortográficos y textuales relacionados con "${tema}" mediante ejemplos concretos. Diferencian usos y aplican reglas en contexto.`,
        `Describen oralmente y producen un texto escrito relacionado con "${tema}" siguiendo el modelo y las orientaciones del docente. Realizan trabajo colaborativo en parejas o grupos.`,
        `Socializan sus producciones con el grupo. Reciben retroalimentación del docente y los compañeros. Revisan y corrigen aspectos de coherencia, cohesión y ortografía.`,
      ],
      [
        `Observan un texto modelo relacionado con "${tema}" y analizan su estructura, propósito comunicativo y características lingüísticas. Relacionan el contenido con situaciones de la vida real.`,
        `Analizan y practican los elementos gramaticales u ortográficos vinculados a "${tema}" mediante ejercicios guiados y ejemplos del contexto cotidiano.`,
        `Producen un texto oral y/o escrito sobre "${tema}" aplicando los elementos trabajados. Utilizan organizadores gráficos, esquemas o borradores como apoyo al proceso de escritura.`,
        `Comparten sus producciones con el grupo. Interactúan dando y recibiendo retroalimentación constructiva. Revisan y mejoran sus textos incorporando las sugerencias recibidas.`,
      ],
      [
        `Leen y analizan un texto relacionado con "${tema}" respondiendo preguntas de comprensión literal, inferencial y crítica. Identifican vocabulario nuevo y lo registran en su cuaderno.`,
        `Analizan y aplican las normas gramaticales u ortográficas relacionadas con "${tema}" mediante situaciones comunicativas reales y ejemplos del entorno.`,
        `Producen textos orales y escritos relacionados con "${tema}" en parejas o grupos. Aplican el vocabulario y las normas trabajadas durante la sesión.`,
        `Presentan y socializan sus producciones. Integran la retroalimentación recibida para corregir y mejorar sus textos. El docente sistematiza los aprendizajes claves.`,
      ],
    ],
  };

  if (variantes[area]) {
    const acts = variantes[area][fasePos % variantes[area].length];
    if (area === "Inglés") return inyectarExpresiones(acts, diaNum, "en");
    if (area === "Francés") return inyectarExpresiones(acts, diaNum, "fr");
    return acts;
  }

  // Banco Pedagógico Firestore (oficial) tiene prioridad
  const bpActsDesarrollo = obtenerBPActs(area, "Desarrollo", diaNum);
  if (bpActsDesarrollo) return withTema(bpActsDesarrollo, tema);

  // Banco especializado estático como fallback
  const bankActs = obtenerActividadesBanco(area, "Desarrollo", fasePos, diaNum);
  if (bankActs) return withTema(bankActs, tema);

  // Fallback genérico
  const generic = [
    [
      `Observan el recurso principal de "${tema}" e identifican sus características. Expresan sus primeras observaciones e hipótesis sobre el contenido.`,
      `Exploran el contenido de "${tema}" mediante actividades guiadas: el docente modela, los estudiantes practican. Preguntas de verificación en cada paso.`,
      `Construyen en grupos una representación o explicación inicial de "${tema}": mapa, esquema, modelo o descripción con sus propias palabras.`,
      `Socializan sus representaciones. El docente sistematiza los aprendizajes y corrige concepciones erróneas. Registran en el cuaderno.`,
    ],
    [
      `Analizan el contenido de "${tema}" con mayor profundidad: causas, relaciones, propiedades, procedimientos o estructuras. Diferencian conceptos claves.`,
      `Practican en parejas o grupos aplicando lo analizado sobre "${tema}" en ejercicios o situaciones guiadas. El docente circula y provee retroalimentación.`,
      `Trabajan colaborativamente resolviendo una situación más compleja de "${tema}". Argumentan sus decisiones y estrategias de forma oral y escrita.`,
      `Ponen en común resultados. El docente consolida los aprendizajes esenciales, aclara dudas y conecta con el objetivo de la sesión.`,
    ],
    [
      `Aplican los conocimientos construidos sobre "${tema}" en situaciones de mayor complejidad o en contextos diferentes al de la explicación inicial.`,
      `Producen de forma autónoma o en grupos una solución, texto, representación o argumento relacionado con "${tema}" aplicando criterios de calidad.`,
      `Evalúan críticamente su producción o la de un compañero: _¿Cumple los criterios? ¿Es correcto? ¿Qué mejoraría?_`,
      `El docente retroalimenta las producciones destacando logros y señalando aspectos de mejora. Integran las sugerencias en una versión final.`,
    ],
  ];
  return generic[fasePos % generic.length];
};

const _getActsCierreIngles = (tema, fasePos, diaNum) => {
  const banco = _getBancoTemaIngles(tema);

  // Fase 0 — Presentación: síntesis de vocabulario + exit ticket
  if (fasePos === 0) {
    const vocab = banco ? banco.vocabulario[0] : `palabras de "${tema}"`;
    return [
      `Nombran en voz alta las palabras de "${tema}" que recuerdan de la sesión usando las imágenes o tarjetas de vocabulario. El docente retroalimenta la pronunciación de manera positiva.`,
      `Reflexionan oralmente: "Today I learned ___ words about ${tema}. I can say ___ in English now. I still need to practice ___."`,
      `Completan un exit ticket individual: escriben o dibujan 3 actividades relacionadas con "${tema}" que realizan cada día, indicando la hora aproximada. Vocabulario esperado: ${vocab}.`,
      `El docente orienta la tarea para el hogar y conecta con la próxima sesión. "For homework, write 5 sentences about your own daily routine. See you next class!"`,
    ];
  }

  // Fase 1 — Desarrollo: word wall + síntesis gramatical + tarea
  if (fasePos === 1) {
    const vocab = banco ? banco.vocabulario[1] : `vocabulario y estructuras de "${tema}"`;
    return [
      `Construyen colectivamente en la pizarra un Word Wall con vocabulario, expresiones de tiempo y estructuras gramaticales de "${tema}" aprendidas durante la sesión.`,
      `Reflexionan sobre lo aprendido: "What grammar structure did we practice today? When do we use it? Can you give me one example about ${tema}?"`,
      `Completan un exit ticket: escriben 3 oraciones sobre "${tema}" usando la estructura gramatical trabajada. Vocabulario de apoyo: ${vocab}.`,
      `El docente orienta la tarea relacionada con "${tema}" y anuncia el contenido de la próxima sesión. "Excellent work today! See you next class!"`,
    ];
  }

  // Fase 2 — Profundización: compartir producción + autoevaluación + portafolio
  return [
    `Leen en voz alta un fragmento de su producción escrita sobre "${tema}" ante el grupo o en parejas. Los compañeros escuchan y ofrecen retroalimentación positiva y constructiva.`,
    `Autoevalúan su producción respondiendo: "Is my vocabulary appropriate for ${tema}? Are my sentences correct? Is my paragraph clear and well-organized?"`,
    `Incorporan las correcciones finales en su producción y la archivan en su portafolio de la unidad como evidencia de avance hacia el producto final.`,
    `El docente cierra la sesión con reconocimiento al grupo: "Excellent work today! You're making great progress with ${tema}. See you next class!"`,
  ];
};

const getActsCierre = (area, tema, fasePos, diaNum) => {
  if (area === "Inglés") return _getActsCierreIngles(tema, fasePos, diaNum);

  const variantes = {
    "Inglés": [
      // Variante 0 — Fase 1 (Presentación): reflexión LISTENING + primer vocabulario
      [
        `Comparten oralmente 3 palabras o expresiones de "${tema}" que recuerdan del audio o diálogo de la sesión. _(What words did you catch? What was the main topic?)_`,
        `Reflexionan sobre su comprensión auditiva: _(Was it easy or hard to understand? What helped you? What will you practice at home?)_`,
        `Reciben retroalimentación del docente sobre pronunciación y vocabulario. Anotan 3–5 palabras clave de "${tema}" con su significado en el cuaderno.`,
        `Completan un exit ticket individual antes de cerrar: _{({expr_exit_ticket})}_`,
        `Despiden la sesión motivacionalmente en inglés. _({expr_despedida})_`,
      ],
      // Variante 1 — Fase 2 (Desarrollo): síntesis READING + GRAMMAR
      [
        `Construyen colectivamente en la pizarra un "Word Wall" con palabras, expresiones y estructuras clave de "${tema}" aprendidas en la sesión.`,
        `Completan un exit ticket individual sobre lectura y gramática del día: _{({expr_exit_ticket})}_`,
        `Reflexionan sobre su proceso de lectura y gramática: _({expr_comprension_reading})_`,
        `Reciben orientación sobre la tarea relacionada con reading o grammar de "${tema}". El docente conecta con la próxima sesión. _({expr_despedida})_`,
      ],
      // Variante 2 — Fase 3 (Profundización): síntesis WRITING + producción
      [
        `Leen en voz alta un fragmento de su producción escrita sobre "${tema}" ante el grupo o en parejas. Practican pronunciación, entonación y confianza oral.`,
        `Autoevalúan su producción escrita: _(Is the vocabulary appropriate? Are the structures correct? Is it clear and well-organized?)_`,
        `Completan un exit ticket sobre su proceso de escritura: _{({expr_exit_ticket})}_`,
        `Integran las correcciones del peer editing y del docente en una versión mejorada de su texto sobre "${tema}".`,
        `Despiden la sesión celebrando el progreso en escritura en inglés. _({expr_despedida})_`,
      ],
    ],
    "Matemática": [
      [
        `Resuelven individualmente 1–2 ejercicios de síntesis sobre "${tema}" como ticket de salida para verificar la comprensión.`,
        `Comparten y verifican sus respuestas con el grupo. Identifican errores y los corrigen con apoyo del docente.`,
        `Reflexionan sobre el aprendizaje del día respondiendo: _¿Qué aprendí? ¿Qué me resultó difícil? ¿Dónde puedo aplicar esto en mi vida cotidiana?_`,
        `Reciben orientación sobre la tarea para el hogar y el docente anuncia el próximo contenido de la unidad.`,
      ],
      [
        `Responden preguntas de verificación oral sobre "${tema}" planteadas por el docente.`,
        `Expresan con sus propias palabras el procedimiento o concepto aprendido. Tres voluntarios explican a sus compañeros cómo resolver un ejercicio de "${tema}".`,
        `Integran la retroalimentación recibida durante la sesión y corrigen los errores identificados en sus producciones.`,
        `Reciben y anotan la tarea para el hogar. El docente anuncia y conecta el próximo contenido con lo aprendido hoy.`,
      ],
      [
        `Sintetizan oralmente los aprendizajes claves de la sesión sobre "${tema}": propiedades, procedimientos y ejemplos.`,
        `Completan en el cuaderno un resumen o esquema de "${tema}" con los conceptos más importantes aprendidos.`,
        `Reflexionan sobre su desempeño y establecen metas personales de mejora para la próxima sesión.`,
        `Reciben orientación sobre la tarea, expresan sus dudas finales y el docente anuncia el próximo contenido de la unidad.`,
      ],
    ],
    "Lengua Española": [
      [
        `Comparten información sobre "${tema}" y responden preguntas de reflexión sobre los textos o contenidos trabajados.`,
        `Expresan opiniones breves sobre la utilidad del contenido aprendido y reconocen cómo aplicarlo en situaciones comunicativas reales de su entorno.`,
        `Integran la retroalimentación recibida sobre sus producciones orales y escritas para corregir aspectos de coherencia, cohesión y ortografía.`,
        `Reciben orientación sobre la tarea para el hogar y el docente anuncia el próximo contenido de la unidad.`,
      ],
      [
        `Leen en voz alta sus producciones finales del día y comparten con el grupo lo aprendido sobre "${tema}".`,
        `Reflexionan sobre el proceso de aprendizaje: _¿Qué aprendí hoy? ¿Qué me resultó difícil? ¿Cómo puedo mejorar mi expresión oral y escrita?_`,
        `Integran la retroalimentación recibida y realizan correcciones finales en sus producciones escritas.`,
        `Reciben la orientación de la tarea para el hogar y el docente anuncia el próximo contenido de la unidad.`,
      ],
      [
        `Sintetizan oralmente los aprendizajes claves de la sesión sobre "${tema}" destacando vocabulario, normas y elementos textuales trabajados.`,
        `Expresan en voz alta su producción final del día y reciben comentarios positivos del grupo y el docente.`,
        `Reflexionan sobre su desempeño comunicativo y establecen compromisos personales de mejora.`,
        `Reciben orientación sobre la tarea para el hogar y el docente anuncia y conecta el próximo contenido con lo aprendido hoy.`,
      ],
    ],
  };

  if (variantes[area]) {
    const acts = variantes[area][fasePos % variantes[area].length];
    if (area === "Inglés") return inyectarExpresiones(acts, diaNum, "en");
    if (area === "Francés") return inyectarExpresiones(acts, diaNum, "fr");
    return acts;
  }

  // Banco Pedagógico Firestore (oficial) tiene prioridad
  const bpActsCierre = obtenerBPActs(area, "Cierre", diaNum);
  if (bpActsCierre) return withTema(bpActsCierre, tema);

  // Banco especializado estático como fallback
  const bankActs = obtenerActividadesBanco(area, "Cierre", fasePos, diaNum);
  if (bankActs) return withTema(bankActs, tema);

  // Fallback genérico
  const generic = [
    [
      `Completan el organizador "Antes pensaba... Ahora sé que..." sobre "${tema}". Comparan sus hipótesis iniciales con lo que descubrieron.`,
      `Reflexionan en voz alta: _¿Confirmé mis hipótesis iniciales sobre {tema}? ¿Qué me sorprendió? ¿Qué nueva pregunta me genera?_`,
      `Integran la retroalimentación del docente y corrigen concepciones erróneas que surgieron durante la exploración.`,
      `Reciben orientación sobre la tarea para el hogar y el docente anuncia el próximo contenido de la unidad.`,
    ],
    [
      `Sintetizan los aprendizajes del día elaborando con sus propias palabras una explicación de "${tema}": concepto, proceso, regla o estructura.`,
      `Reflexionan sobre su proceso: _¿Qué estrategia me funcionó mejor para aprender {tema}? ¿Qué cambiaría para la próxima vez?_`,
      `Tres voluntarios comparten su síntesis o una producción del día. El docente retroalimenta y el grupo complementa.`,
      `Reciben la orientación de la tarea, la anotan en el cuaderno y el docente conecta con el próximo contenido.`,
    ],
    [
      `Autoevalúan su producción o desempeño del día usando los criterios de calidad establecidos para "${tema}".`,
      `Reflexionan sobre su nivel de dominio actual: _¿Puedo aplicar {tema} de manera autónoma? ¿Qué necesito seguir practicando?_`,
      `Establecen un compromiso personal de práctica o profundización relacionado con "${tema}" para el hogar o la próxima sesión.`,
      `El docente cierra destacando el avance del grupo, orienta la tarea y anuncia el próximo contenido de la unidad.`,
    ],
  ];
  return generic[fasePos % generic.length];
};

const getEvidencias = (area, momento, _fasePos) => {
  const types = {
    Inicio: {
      "Inglés": "Conocimientos previos:\n• Identifica palabras y expresiones básicas en inglés.\n• Relaciona el vocabulario con situaciones cotidianas conocidas.",
      "Matemática": "Conocimientos previos:\n• Recuerda conceptos y procedimientos previos relacionados con el tema.\n• Relaciona el nuevo contenido con aprendizajes anteriores.",
      default: "Conocimientos previos:\n• Demuestra saberes previos relacionados con el contenido.\n• Expresa ideas y preguntas sobre el tema con claridad.",
    },
    Desarrollo: {
      "Inglés": "Desempeños:\n• Usa vocabulario y estructuras gramaticales en contexto.\n• Produce oraciones y diálogos cortos de manera oral y/o escrita.\n• Comprende textos escritos o auditivos sencillos.",
      "Matemática": "Desempeños:\n• Resuelve ejercicios y problemas aplicando el procedimiento correcto.\n• Explica sus estrategias de resolución de manera clara.\n• Registra el proceso y resultado de forma organizada.",
      default: "Desempeños:\n• Aplica los conocimientos en actividades prácticas.\n• Participa activamente en las actividades colaborativas.\n• Produce evidencias concretas de los aprendizajes.",
    },
    Cierre: {
      "Inglés": "Desempeños de cierre:\n• Resume con sus propias palabras lo aprendido en la sesión.\n• Completa la tarea asignada de manera autónoma.\n• Identifica sus avances y áreas de mejora en el idioma.",
      "Matemática": "Desempeños de cierre:\n• Verifica la corrección de sus respuestas.\n• Expresa lo aprendido y lo que aún necesita reforzar.\n• Aplica el conocimiento en una situación de síntesis.",
      default: "Desempeños de cierre:\n• Expresa los aprendizajes alcanzados durante la sesión.\n• Refleja sobre su proceso de aprendizaje.\n• Identifica la aplicación del contenido en su contexto.",
    },
  };
  const byMom = types[momento] || types.Inicio;
  return byMom[area] || byMom.default;
};

const getEvaluacion = (momento, fasePos) => {
  const evals = {
    Inicio: {
      tipo: "Diagnóstica",
      agente: "Heteroevaluación",
      tecnica: "Observación directa",
      instrumento: "Lista de cotejo",
    },
    Desarrollo: {
      tipo: "Formativa",
      agente: "Heteroevaluación",
      tecnica: "Observación directa y revisión del trabajo",
      instrumento: "Rúbrica analítica",
    },
    Cierre: {
      tipo: "Formativa",
      agente: "Autoevaluación / Coevaluación",
      tecnica: "Reflexión oral / Ticket de salida",
      instrumento: "Escala de valoración",
    },
  };
  // Last phase adds summative evaluation
  if (fasePos === "final") {
    return {
      tipo: "Sumativa",
      agente: "Heteroevaluación",
      tecnica: "Revisión de producciones y observación",
      instrumento: "Rúbrica analítica / Lista de cotejo",
    };
  }
  return evals[momento] || evals.Inicio;
};

const getMetacognicion = (momento, area, tema) => {
  const metas = {
    Inicio: [
      `¿Qué sé sobre ${tema}? ¿Qué quisiera aprender hoy?`,
      "¿Cómo me siento al comenzar esta clase? ¿Estoy preparado para aprender?",
    ],
    Desarrollo: [
      `¿Qué estrategias estoy usando para aprender sobre ${tema}?`,
      "¿Qué parte del contenido me resulta más difícil? ¿Por qué?",
      "¿Cómo estoy participando en las actividades colaborativas?",
    ],
    Cierre: [
      `¿Qué aprendí hoy sobre ${tema}? ¿Cómo lo puedo aplicar?`,
      "¿Qué fue lo más interesante de la clase? ¿Qué aún necesito practicar?",
      "¿Cómo puedo mejorar mi aprendizaje en la próxima clase?",
    ],
  };
  return metas[momento] || metas.Cierre;
};

// ─── Recursos derivados de actividades ─────────────────────────────────────────

const derivarRecursos = (actividades, area, _faseNum) => {
  const txt = actividades.join(" ").toLowerCase();
  const tiene = (re) => re.test(txt);

  const did = new Set();
  const tec = new Set(["Pizarrón y marcadores"]);

  // Tecnológicos según actividades
  if (tiene(/video|clip|film|audiovisual/)) {
    tec.add("Proyector"); tec.add("Video / clip audiovisual"); tec.add("Parlantes");
  }
  if (tiene(/audio|podcast|grabaci[oó]n|comprens[ioó]n auditiva/) && !tiene(/video/)) {
    tec.add("Grabación de audio"); tec.add("Parlantes");
  }
  if (tiene(/presentaci[oó]n digital|diapositiv|canva|powerpoin/)) {
    tec.add("Proyector"); tec.add("Presentación digital");
  }
  if (tiene(/internet|plataforma|liveworksheet|kahoot|digital/)) {
    tec.add("Computadora o tableta"); tec.add("Acceso a internet");
  }
  if (tiene(/proyect/) && tec.size === 1) tec.add("Proyector");

  // Didácticos según actividades
  if (tiene(/role.play|tarjeta de rol|situaci[oó]n comunicativa/)) {
    did.add("Tarjetas de roles"); did.add("Guías de conversación");
  }
  if (tiene(/flashcard|vocabulario/)) did.add("Flashcards de vocabulario");
  if (tiene(/organizador|mapa conceptual|esquema/)) did.add("Organizadores gráficos");
  if (tiene(/plantilla|hoja de trabajo|ficha/)) did.add("Hojas de trabajo / Plantillas");
  if (tiene(/texto|lectura|p[aá]rrafo/)) did.add("Texto de lectura");
  if (tiene(/imagen|foto|l[aá]mina|ilustraci[oó]n/)) did.add("Imágenes / Láminas temáticas");
  if (tiene(/plano|dise[nñ]o|maqueta/)) { did.add("Planos / Imágenes de referencia"); did.add("Cartulinas y marcadores"); }
  if (tiene(/cartel|papelógrafo|mural/)) { did.add("Papelógrafo / Carteles"); did.add("Marcadores de colores"); }
  if (tiene(/portafolio|carpeta/)) did.add("Carpeta de portafolio");
  if (tiene(/r[uú]brica|criterio de evaluaci[oó]n/)) did.add("Rúbrica de evaluación");
  if (tiene(/aut[oe]evaluaci[oó]n|coevaluaci[oó]n/)) did.add("Instrumento de autoevaluación / coevaluación");
  if (tiene(/exposici[oó]n|presentaci[oó]n (oral|final)/)) did.add("Rúbrica de exposición oral");
  if (tiene(/redact|escrib|prod[uú]cc[ioó]n escrita/)) did.add("Guías de redacción / Plantillas de escritura");
  if (tiene(/manipulativo|regleta|geoplano|ficha/)) did.add("Material manipulativo (regletas, fichas)");
  if (tiene(/calculadora/)) did.add("Calculadora");
  if (tiene(/libro|texto de clase/)) did.add("Libro de texto del área");

  // Recursos base por área si detectamos poco
  if (did.size < 2) {
    const base = {
      "Inglés": ["Cuaderno de inglés", "Tarjetas de vocabulario"],
      "Matemática": ["Cuaderno de matemática", "Material manipulativo"],
      "Lengua Española": ["Cuaderno de lengua española", "Texto de lectura"],
      "Ciencias de la Naturaleza": ["Cuaderno de ciencias", "Láminas científicas"],
      "Ciencias Sociales": ["Cuaderno de sociales", "Mapas e imágenes históricas"],
    }[area] || ["Cuaderno de clase", "Material de apoyo del área"];
    base.forEach((r) => did.add(r));
  }
  did.add("Cuaderno de clase");

  return {
    humanos: "Docente y estudiantes",
    didacticos: [...did].slice(0, 5).join(", "),
    tecnologicos: [...tec].slice(0, 4).join(", "),
  };
};

// ─── Criterios de éxito por área y fase ──────────────────────────────────────

const CRITERIOS_EXITO = {
  "Inglés": [
    [`☐ Puedo identificar al menos 6 palabras de "{tema}" en inglés.`, `☐ Digo una oración simple sobre "{tema}" usando vocabulario nuevo.`, `☐ Completé el organizador diagnóstico con mis saberes previos.`, `☐ Participé al menos una vez en la actividad oral.`],
    [`☐ Usé la estructura gramatical trabajada en al menos 3 oraciones sobre "{tema}".`, `☐ Respondí correctamente al menos 2 preguntas de comprensión.`, `☐ Anoté 3 palabras nuevas en mi banco de vocabulario.`, `☐ Practiqué con mi compañero/a en inglés durante la actividad de pareja.`],
    [`☐ Produje un párrafo o diálogo completo sobre "{tema}" usando estructuras aprendidas.`, `☐ Revisé la producción de un compañero/a aplicando los criterios.`, `☐ Incorporé al menos una corrección en mi producción.`, `☐ Puedo explicar en inglés un aspecto relacionado con "{tema}".`],
    [`☐ Avancé una sección concreta de mi producto final sobre "{tema}".`, `☐ Mi producción cumple al menos 3 criterios de la rúbrica.`, `☐ Practiqué mi presentación oral con un compañero/a.`, `☐ Puedo presentar mi trabajo en inglés durante al menos 60 segundos.`],
  ],
  "Francés": [
    [`☐ Puedo identificar al menos 6 palabras de "{tema}" en francés.`, `☐ Digo una oración simple sobre "{tema}" usando vocabulario nuevo.`, `☐ Completé el organizador diagnóstico con mis saberes previos.`, `☐ Participé al menos una vez en la actividad oral.`],
    [`☐ Usé la estructura gramatical trabajada en al menos 3 oraciones sobre "{tema}".`, `☐ Respondí correctamente al menos 2 preguntas de comprensión.`, `☐ Anoté 3 palabras nuevas en mi banco de vocabulario.`, `☐ Practiqué con mi compañero/a en francés durante la actividad.`],
    [`☐ Produje un párrafo o diálogo completo sobre "{tema}" usando estructuras aprendidas.`, `☐ Revisé la producción de un compañero/a aplicando los criterios.`, `☐ Incorporé al menos una corrección en mi producción.`, `☐ Puedo explicar en francés un aspecto relacionado con "{tema}".`],
    [`☐ Avancé una sección concreta de mi producto final sobre "{tema}".`, `☐ Mi producción cumple al menos 3 criterios de la rúbrica.`, `☐ Practiqué mi presentación oral con un compañero/a.`, `☐ Puedo presentar mi trabajo en francés durante al menos 60 segundos.`],
  ],
  "Matemática": [
    [`☐ Puedo explicar con mis palabras qué es "{tema}" y para qué sirve.`, `☐ Resolví los ejercicios diagnósticos mostrando mi procedimiento.`, `☐ Identifiqué una situación real donde se aplica "{tema}".`, `☐ Formulé una pregunta sobre lo que quiero aprender.`],
    [`☐ Resolví los ejercicios de "{tema}" aplicando el procedimiento correcto.`, `☐ Expliqué a mi compañero/a cómo llegué a mi respuesta.`, `☐ Identifiqué y corregí al menos un error en mi procedimiento.`, `☐ Registré el procedimiento completo en mi cuaderno de manera organizada.`],
    [`☐ Resolví un problema aplicado de "{tema}" eligiendo la estrategia apropiada.`, `☐ Representé el problema de al menos dos formas diferentes.`, `☐ Justifiqué mis respuestas con argumentos matemáticos correctos.`, `☐ Evalué la razonabilidad de mi resultado.`],
    [`☐ Completé la sección asignada de mi producto matemático sobre "{tema}".`, `☐ Verifiqué que mi producción cumple los criterios de calidad.`, `☐ Expliqué mi procedimiento ante el grupo con claridad.`, `☐ Incorporé la retroalimentación recibida en mi trabajo.`],
  ],
  "Ciencias de la Naturaleza": [
    [`☐ Formulé una hipótesis sobre "{tema}".`, `☐ Identifiqué al menos 3 conceptos relacionados con "{tema}".`, `☐ Registré mis observaciones iniciales de manera organizada.`, `☐ Relacioné "{tema}" con un fenómeno del entorno natural.`],
    [`☐ Realicé la actividad de indagación siguiendo el procedimiento.`, `☐ Registré los datos de forma clara y completa.`, `☐ Identifiqué evidencia que apoya o refuta mi hipótesis.`, `☐ Expliqué el fenómeno de "{tema}" usando vocabulario científico.`],
    [`☐ Analicé los datos y construí una explicación científica de "{tema}".`, `☐ Relacioné "{tema}" con conceptos anteriores o situaciones reales.`, `☐ Usé vocabulario científico correctamente en mi producción.`, `☐ Evalué críticamente la evidencia disponible sobre "{tema}".`],
    [`☐ Aporté la sección asignada a mi informe científico de "{tema}".`, `☐ Presenté mis hallazgos usando evidencia y vocabulario científico.`, `☐ Respondí preguntas de compañeros sobre mi investigación.`, `☐ Reflexioné sobre la aplicación de "{tema}" en la vida y el ambiente.`],
  ],
  "Lengua Española": [
    [`☐ Identifiqué las características del tipo de texto de "{tema}".`, `☐ Participé en la actividad oral aportando al menos una idea.`, `☐ Completé el organizador diagnóstico con mis saberes previos.`, `☐ Formulé al menos una pregunta de aprendizaje.`],
    [`☐ Leí el texto de "{tema}" e identifiqué la idea principal.`, `☐ Apliqué la norma gramatical u ortográfica en mis producciones.`, `☐ Produje un texto breve con cohesión y coherencia básicas.`, `☐ Revisé mi producción y realicé al menos una corrección.`],
    [`☐ Produje un texto completo con estructura adecuada sobre "{tema}".`, `☐ Apliqué recursos lingüísticos (conectores, vocabulario) apropiados.`, `☐ Leí mi producción en voz alta con fluidez.`, `☐ Di retroalimentación constructiva a un compañero/a.`],
    [`☐ Completé la sección asignada de mi producción final sobre "{tema}".`, `☐ Mi producción cumple los criterios de calidad del tipo textual.`, `☐ Incorporé la retroalimentación en mi versión revisada.`, `☐ Puedo presentar mi producción oralmente con claridad.`],
  ],
  "Ciencias Sociales": [
    [`☐ Identifiqué los actores, el contexto y el período de "{tema}".`, `☐ Expresé mis conocimientos previos y formulé una pregunta de investigación.`, `☐ Clasifiqué las fuentes sobre "{tema}" por tipo y confiabilidad.`, `☐ Relacioné "{tema}" con situaciones actuales de la comunidad o el país.`],
    [`☐ Analicé al menos una fuente primaria o secundaria sobre "{tema}".`, `☐ Construí un organizador gráfico sobre "{tema}".`, `☐ Identifiqué causas y consecuencias del proceso de "{tema}".`, `☐ Formulé un argumento fundamentado en evidencia.`],
    [`☐ Elaboré una producción escrita sobre "{tema}" con argumentos sustentados.`, `☐ Relacioné "{tema}" con ciudadanía, derechos o responsabilidad social.`, `☐ Expresé oralmente mi posición con al menos 2 argumentos.`, `☐ Evalué críticamente la confiabilidad de las fuentes.`],
    [`☐ Completé la sección asignada de mi proyecto investigativo sobre "{tema}".`, `☐ Presenté mis hallazgos con evidencia histórica/social con claridad.`, `☐ Respondí preguntas del grupo con fundamentos.`, `☐ Reflexioné sobre la relevancia de "{tema}" para la vida ciudadana.`],
  ],
};

const getCriteriosExito = (area, faseIdx, tema) => {
  const banco = CRITERIOS_EXITO[area] || [
    [`☐ Comprendo los conceptos principales de "${tema}" trabajados hoy.`, `☐ Completé las actividades mostrando mi procedimiento o razonamiento.`, `☐ Participé activamente al menos en una actividad.`, `☐ Puedo explicar con mis palabras algo que aprendí sobre "${tema}".`],
    [`☐ Apliqué los procedimientos sobre "${tema}" en situaciones nuevas.`, `☐ Expliqué a un compañero/a cómo llegué a mis respuestas.`, `☐ Identifiqué y corregí mis errores con apoyo.`, `☐ Registré los aprendizajes del día de manera organizada.`],
    [`☐ Produje algo concreto que evidencia mi dominio de "${tema}".`, `☐ Evalué críticamente mi producción usando los criterios de calidad.`, `☐ Incorporé retroalimentación para mejorar mi trabajo.`, `☐ Puedo aplicar lo de "${tema}" en una situación real.`],
    [`☐ Completé mi aporte al producto final de la unidad.`, `☐ Mi producción cumple los criterios de la rúbrica.`, `☐ Presenté o compartí mi trabajo con claridad ante el grupo.`, `☐ Reflexioné sobre mis aprendizajes a lo largo de la unidad.`],
  ];
  const faseBank = banco[Math.min(faseIdx, banco.length - 1)];
  return faseBank.map((c) => c.replace(/\{tema\}/g, tema));
};

// ─── Indicadores de avance por fase ──────────────────────────────────────────

const INDICADORES_AVANCE = {
  "Inglés": [
    (t) => [`Identifica el vocabulario esencial de "${t}" y lo asocia con situaciones reales.`, `Comprende el sentido general de diálogos breves sobre "${t}".`, `Produce 3 oraciones simples sobre "${t}" con vocabulario nuevo.`, `Formula al menos 2 preguntas básicas sobre "${t}" en inglés.`],
    (t) => [`Usa la estructura gramatical trabajada en oraciones sobre "${t}".`, `Comprende textos breves sobre "${t}" en niveles literal e inferencial.`, `Produce un párrafo coherente sobre "${t}" usando conectores de secuencia.`, `Practica diálogos sobre "${t}" con pronunciación comprensible.`, `Registra y usa activamente al menos 10 palabras nuevas.`],
    (t) => [`Produce textos sobre "${t}" con vocabulario variado y estructuras apropiadas.`, `Identifica información específica en textos orales o escritos sobre "${t}".`, `Evalúa producciones propias y de compañeros con criterios acordados.`, `Desarrolla un componente concreto del producto final de la unidad.`],
    (t) => [`Presenta el producto final sobre "${t}" con fluidez básica y claridad.`, `Integra todos los contenidos de la unidad en su producción final.`, `Autoevalúa su desempeño con honestidad usando la rúbrica.`, `Coevalúa la producción de un compañero/a con retroalimentación constructiva.`],
  ],
  "Francés": [
    (t) => [`Identifica el vocabulario esencial de "${t}" y lo asocia con situaciones reales.`, `Comprende el sentido general de diálogos breves sobre "${t}".`, `Produce 3 oraciones simples sobre "${t}" con vocabulario nuevo.`, `Formula al menos 2 preguntas básicas sobre "${t}" en francés.`],
    (t) => [`Usa la estructura gramatical trabajada en oraciones sobre "${t}".`, `Comprende textos breves sobre "${t}" en nivel literal e inferencial.`, `Produce un párrafo coherente sobre "${t}" usando conectores de secuencia.`, `Practica diálogos sobre "${t}" con pronunciación comprensible.`],
    (t) => [`Produce textos sobre "${t}" con vocabulario variado y estructuras apropiadas.`, `Identifica información específica en textos orales o escritos sobre "${t}".`, `Evalúa producciones propias y de compañeros con criterios acordados.`, `Desarrolla un componente del producto final de la unidad.`],
    (t) => [`Presenta el producto final sobre "${t}" con fluidez básica y claridad.`, `Integra todos los contenidos de la unidad en su producción final.`, `Autoevalúa su desempeño con honestidad usando la rúbrica.`],
  ],
  "Matemática": [
    (t) => [`Identifica los conceptos y propiedades fundamentales de "${t}".`, `Resuelve ejercicios básicos de "${t}" mostrando el procedimiento ordenado.`, `Relaciona "${t}" con situaciones del entorno cotidiano.`, `Formula preguntas sobre los aspectos de "${t}" que quiere comprender mejor.`],
    (t) => [`Aplica los procedimientos de "${t}" en ejercicios de dificultad progresiva.`, `Explica con sus palabras el procedimiento usado para resolver problemas de "${t}".`, `Representa "${t}" de manera gráfica, numérica y/o algebraica según corresponda.`, `Resuelve problemas contextualizados de "${t}" con autonomía creciente.`],
    (t) => [`Selecciona la estrategia apropiada para resolver problemas complejos de "${t}".`, `Justifica matemáticamente sus procedimientos y resultados.`, `Conecta "${t}" con otros conceptos y con situaciones reales.`, `Produce una solución completa, organizada y argumentada.`],
    (t) => [`Integra los aprendizajes en un producto matemático coherente.`, `Presenta su producción de "${t}" con claridad ante el grupo.`, `Autoevalúa su dominio de "${t}" identificando logros y áreas de mejora.`],
  ],
  "Ciencias de la Naturaleza": [
    (t) => [`Formula hipótesis o preguntas de investigación sobre "${t}".`, `Identifica los conceptos científicos clave de "${t}".`, `Observa y registra fenómenos de "${t}" de manera sistemática.`, `Relaciona "${t}" con procesos naturales observables en el entorno local.`],
    (t) => [`Participa en actividades de indagación sobre "${t}" siguiendo el método científico.`, `Registra y organiza datos de manera precisa durante la exploración de "${t}".`, `Analiza la evidencia e identifica patrones relacionados con "${t}".`, `Usa vocabulario científico apropiado al explicar "${t}".`],
    (t) => [`Construye explicaciones científicas fundamentadas en evidencia sobre "${t}".`, `Relaciona "${t}" con otros conceptos del área y con el entorno real.`, `Evalúa críticamente la calidad de la evidencia sobre "${t}".`, `Produce un informe o representación que sintetice los hallazgos.`],
    (t) => [`Presenta los resultados de la indagación sobre "${t}" con claridad y fundamento.`, `Integra los aprendizajes científicos en el producto final.`, `Reflexiona sobre el impacto ambiental, social o tecnológico de "${t}".`],
  ],
  "Lengua Española": [
    (t) => [`Identifica las características del tipo de texto de "${t}" y su propósito.`, `Participa en situaciones orales sobre "${t}" con vocabulario adecuado.`, `Comprende textos sobre "${t}" en nivel literal e inferencial.`, `Formula preguntas sobre los aspectos lingüísticos de "${t}".`],
    (t) => [`Lee textos de "${t}" e identifica estructura, recursos lingüísticos e intención.`, `Aplica normas gramaticales y ortográficas en sus producciones.`, `Produce un texto escrito sobre "${t}" con cohesión y coherencia básicas.`, `Participa en intercambios orales sobre "${t}" con registro apropiado.`],
    (t) => [`Produce textos sobre "${t}" con mayor autonomía y dominio de recursos lingüísticos.`, `Analiza críticamente textos relacionados con "${t}".`, `Expone oralmente sobre "${t}" con organización y fluidez.`, `Evalúa y mejora sus producciones aplicando criterios de calidad textual.`],
    (t) => [`Produce una presentación final sobre "${t}" que integra los aprendizajes.`, `Coevalúa producciones de compañeros con criterios lingüísticos.`, `Reflexiona sobre su desarrollo como lector, escritor y comunicador.`],
  ],
  "Ciencias Sociales": [
    (t) => [`Identifica los actores, el período y el contexto relacionados con "${t}".`, `Clasifica fuentes históricas, geográficas o sociales por tipo y confiabilidad.`, `Relaciona "${t}" con procesos del presente dominicano.`, `Formula preguntas de investigación sobre "${t}".`],
    (t) => [`Analiza fuentes sobre "${t}" identificando perspectiva e intención.`, `Construye representaciones gráficas (línea de tiempo, mapa, cuadro) sobre "${t}".`, `Establece relaciones de causalidad en "${t}" y sus consecuencias.`, `Formula argumentos fundamentados en evidencia.`],
    (t) => [`Produce textos argumentativos sobre "${t}" con posición propia sustentada.`, `Evalúa críticamente diferentes perspectivas sobre "${t}".`, `Propone respuestas ciudadanas a problemas identificados en "${t}".`, `Conecta "${t}" con los retos actuales de la República Dominicana.`],
    (t) => [`Presenta su investigación de "${t}" con claridad y fundamento.`, `Integra perspectivas históricas, geográficas y sociales en el producto final.`, `Reflexiona sobre el rol ciudadano en relación con "${t}".`],
  ],
};

const getIndicadoresAvance = (area, faseIdx, tema) => {
  const banco = INDICADORES_AVANCE[area];
  if (!banco) {
    return [
      `Identifica los conceptos fundamentales de "${tema}".`,
      `Aplica los procedimientos del área en situaciones prácticas relacionadas con "${tema}".`,
      `Produce evidencias concretas del aprendizaje sobre "${tema}".`,
      `Reflexiona sobre el proceso de aprendizaje y establece metas de mejora.`,
    ];
  }
  const fn = banco[Math.min(faseIdx, banco.length - 1)];
  return fn(tema);
};

// ─── Posibles dificultades del área por fase ──────────────────────────────────

const POSIBLES_DIFICULTADES = {
  "Inglés": [
    "Timidez al hablar: usar Think-Pair-Share antes de exposición al grupo. Vocabulario escaso: proveer Word Wall y tarjetas individuales. Uso del español: señal visual 'English Zone' y reformular en inglés sin penalizar.",
    "Dificultades gramaticales: inducción antes de dar la regla. Bloqueo en la lectura: estrategia de lectura para la idea general en primera pasada. Pronunciación: modelar, repetir en coro, no corregir en público.",
    "Bloqueo al escribir: usar organizadores gráficos. Miedo al error oral: normalizar el error. Ritmos distintos: actividad de extensión para quienes terminan antes.",
    "Ansiedad ante la evaluación final: repasar criterios con anticipación y practicar la exposición en parejas. Presentación incompleta: permitir apoyo visual (poster, tarjetas) durante la exposición.",
  ],
  "Francés": [
    "Timidez al hablar: usar Think-Pair-Share. Vocabulario escaso: proveer banco de palabras visual. Interferencia del español: reformular en francés sin penalizar.",
    "Dificultades gramaticales: inducción antes de dar la regla. Bloqueo en la lectura: estrategia de lectura global antes del detalle.",
    "Bloqueo al escribir: usar organizadores. Miedo al error: normalizar el error como aprendizaje.",
    "Ansiedad ante la evaluación: repasar criterios con anticipación. Permitir apoyo visual durante la exposición.",
  ],
  "Matemática": [
    "Ansiedad matemática: comenzar con situaciones concretas, normalizar el error. Vacíos previos: diagnóstico e intervención inmediata. Lectura del enunciado: modelar comprensión del problema antes del cálculo.",
    "Errores de procedimiento: exigir mostrar el proceso completo. Abstracción prematura: usar material concreto antes de lo algebraico. Copia sin comprensión: implementar 'piensa primero, luego verifica'.",
    "Dificultad para elegir estrategia: protocolo ¿Qué me piden? / ¿Qué datos tengo? / ¿Qué estrategia conozco? Respuestas sin justificación: modelar el lenguaje matemático argumentativo.",
    "Presentación incompleta: revisar con lista de cotejo antes de la entrega. Errores no detectados: revisión por pares usando los criterios de la rúbrica.",
  ],
  "Ciencias de la Naturaleza": [
    "Vocabulario científico desconocido: construir glosario desde la primera clase. Dificultad para formular hipótesis: modelar 'Si... entonces... porque...'. Creencias previas incorrectas: validar sin ridiculizar, guiar hacia la evidencia.",
    "Procedimiento experimental: practicar en grupo antes individualmente. Registro incompleto: usar plantilla estructurada. Conexión teoría-práctica: señalar explícitamente en qué momento del experimento se ve el concepto.",
    "Explicaciones no científicas: usar protocolo CER (Afirmación-Evidencia-Razonamiento). Vocabulario impreciso: retroalimentar inmediatamente con el término correcto.",
    "Timidez en presentación: practicar en grupos pequeños antes del grupo completo. Informe incompleto: revisar con rúbrica antes de la entrega.",
  ],
  "Lengua Española": [
    "Dificultad para expresarse oralmente: vocabulario previo a la actividad oral. Lectura superficial: modelar estrategias de lectura activa. Resistencia a escribir: comenzar con producciones muy breves y andamiadas.",
    "Errores ortográficos: implementar 'revisar antes de entregar'. Textos sin cohesión: modelar conectores. Vocabulario limitado: banco de palabras del área y diccionario disponible.",
    "Pérdida del hilo temático: organizador gráfico previo a la escritura. Oral con muletillas: practicar en parejas antes del grupo. Resistencia a la revisión: co-revisión como práctica positiva.",
    "Ansiedad ante la producción final: repasar criterios y permitir borradores previos. Presentación oral insegura: permitir apoyo escrito visible durante la exposición.",
  ],
  "Ciencias Sociales": [
    "Confusión de fechas y nombres: usar líneas de tiempo y mapas visuales. Fuentes primarias/secundarias: modelar con ejemplos del contexto dominicano. Presentismo: contextualizar históricamente antes del análisis.",
    "Argumentos sin evidencia: modelar afirmación+evidencia+razonamiento. Confusión causa/consecuencia: usar flujogramas de causalidad. Dificultad con fuentes críticas: protocolo HAPP.",
    "Ensayo sin posición propia: modelar diferencia entre describir y argumentar. Fuentes digitales no confiables: enseñar criterios de evaluación de fuentes. Dificultad para conectar historia con presente: preguntas puente.",
    "Proyecto incompleto: revisar con rúbrica antes de la presentación. Exposición sin fundamentos: practicar responder preguntas del auditorio en simulacro previo.",
  ],
};

const getPosiblesDificultades = (area, faseIdx) => {
  const banco = POSIBLES_DIFICULTADES[area];
  if (!banco) return "Identificar dificultades individuales en el diagnóstico y ajustar el nivel de andamiaje. Proveer actividades diferenciadas por nivel de desempeño.";
  return banco[Math.min(faseIdx, banco.length - 1)] ?? banco[0];
};

// ─── Aporte al producto final por clase ──────────────────────────────────────

const APORTES_POR_AREA = {
  "Inglés":    [`Banco de vocabulario personal (5-8 palabras clave con pronunciación y ejemplo).`, `Borrador de 3 oraciones usando el patrón gramatical trabajado.`, `Párrafo inicial revisado por pares con conectores de secuencia.`, `Sección de vocabulario del producto: términos ilustrados y definidos.`, `Sección de recomendaciones o análisis usando la estructura modal trabajada.`, `Borrador completo del producto escrito revisado con correcciones incorporadas.`],
  "Francés":   [`Banco de vocabulaire personnel (5-8 mots-clés avec prononciation et exemple).`, `Brouillon de 3 phrases en utilisant la structure grammaticale travaillée.`, `Premier paragraphe révisé avec connecteurs de séquence.`, `Section vocabulaire du produit: termes illustrés et définis.`, `Section recommandations ou analyse avec la structure modale travaillée.`, `Brouillon complet du produit écrit révisé.`],
  "Matemática": [`Glosario matemático: 5 términos de "{tema}" con definición, propiedad y ejemplo.`, `Resolución de 3 ejercicios modelo con procedimiento completo y verificación.`, `Sección de procedimiento: problema resuelto con representación gráfica/numérica/algebraica.`, `Colección de 5 problemas aplicados resueltos con justificación matemática.`, `Análisis de errores: 2 errores comunes en "{tema}", causa y corrección.`, `Borrador completo del producto matemático con procedimientos verificados.`],
  "Ciencias de la Naturaleza": [`Glosario científico: 5 conceptos de "{tema}" con definición e imagen.`, `Hipótesis de investigación formulada con justificación científica.`, `Protocolo de indagación: materiales, procedimiento y tabla de registro.`, `Datos registrados e interpretación inicial de los resultados de la indagación.`, `Sección de conclusiones: explicación CER sobre "{tema}".`, `Borrador completo del informe científico con todas sus secciones.`],
  "Lengua Española": [`Mapa de ideas o esquema previo a la escritura del texto.`, `Primer párrafo del texto redactado con las normas gramaticales trabajadas.`, `Borrador del texto con estructura completa (introducción, desarrollo, cierre).`, `Versión revisada con correcciones de vocabulario, gramática y ortografía.`, `Texto completamente revisado y listo para su versión final.`, `Presentación oral preparada: notas de exposición y estructura del discurso.`],
  "Ciencias Sociales": [`Mapa de actores/períodos: representación visual del contexto de "{tema}".`, `Análisis de fuente primaria o secundaria sobre "{tema}" con protocolo completo.`, `Línea de tiempo o mapa histórico/geográfico con explicación de los hitos.`, `Sección argumentativa del proyecto: tesis con evidencias sobre "{tema}".`, `Borrador completo de la investigación o ensayo con fuentes citadas.`, `Presentación visual del proyecto preparada para la exposición.`],
};

const getAporteProducto = (area, faseIdx, diaNum, totalDias, tema) => {
  if (faseIdx === 0) {
    return diaNum >= totalDias
      ? `Diagnóstico completo de saberes previos sobre "${tema}". El docente registra fortalezas y vacíos para ajustar la secuencia didáctica.`
      : `Los estudiantes conocen el propósito de la unidad, el producto final esperado y la situación de aprendizaje de "${tema}".`;
  }
  if (faseIdx === 3) {
    if (diaNum >= totalDias) return `Presentación y evaluación del producto final de "${tema}". Autoevaluación y coevaluación. Cierre de la unidad.`;
    if (diaNum === totalDias - 1) return `Versión final del producto de "${tema}" revisada y lista para presentar. Ensayo de la exposición oral incorporando correcciones finales.`;
    return `Avance concreto del producto final de "${tema}": organización, estructuración y producción de componentes según criterios de calidad.`;
  }
  const aportes = (APORTES_POR_AREA[area] || [
    `Banco de conceptos clave de "${tema}" en el cuaderno.`,
    `Primer borrador de la producción sobre "${tema}".`,
    `Sección principal del producto final completada.`,
    `Revisión y mejora del producto sobre "${tema}".`,
    `Borrador completo del producto.`,
    `Versión final del producto lista para presentar.`,
  ]).map((a) => a.replace(/\{tema\}/g, tema));
  const pos = (diaNum - 1) / Math.max(totalDias, 1);
  return aportes[Math.min(Math.floor(pos * aportes.length), aportes.length - 1)];
};

// ─── Actividades específicas para Fase 4 (Integración / Producto final) ─────────

const getActsFase4Inicio = (area, tema, diaNum, totalDias) => {
  const esUltimo = diaNum >= totalDias;
  if (esUltimo) {
    return [
      `Responden al saludo e indicaciones del docente. Revisan brevemente el portafolio o las producciones elaboradas a lo largo de la unidad sobre "${tema}".`,
      `Retroalimentan el proceso completo de la unidad respondiendo preguntas de reflexión global: _¿Qué aprendí? ¿Cómo crecí? ¿Qué mejoré durante esta unidad?_`,
      `Observan la rúbrica o los criterios de evaluación final y se preparan para la evaluación sumativa y/o la exposición del producto final.`,
      `Escuchan la agenda del encuentro de cierre y la intención pedagógica del día.`,
    ];
  }
  return [
    `Responden al saludo e indicaciones del docente. Revisan brevemente los avances del producto final y los criterios de calidad establecidos.`,
    `Retroalimentan el trabajo de la sesión anterior: ¿qué quedó pendiente? ¿qué necesitan mejorar o completar hoy?`,
    `Observan ejemplos de producciones de calidad relacionadas con "${tema}" y los criterios que las caracterizan.`,
    `Escuchan la intención pedagógica del encuentro y organizan el trabajo del día para optimizar el tiempo disponible.`,
  ];
};

const getActsFase4Desarrollo = (area, tema, diaNum, totalDias) => {
  const esUltimo = diaNum >= totalDias;
  const esPenultimo = diaNum === totalDias - 1;
  if (esUltimo) {
    return [
      `Presentan su producto final ante el grupo aplicando los criterios de calidad trabajados durante la unidad. Demuestran dominio de los contenidos y competencias desarrolladas sobre "${tema}".`,
      `Coevalúan las producciones de sus compañeros utilizando la rúbrica o los criterios de evaluación acordados. Ofrecen retroalimentación constructiva y respetuosa.`,
      `Completan el instrumento de autoevaluación reflexionando honestamente sobre su desempeño, participación y aprendizaje a lo largo de la unidad.`,
      `Integran la retroalimentación recibida de parte del docente y los compañeros y la registran como aprendizaje para futuras producciones.`,
    ];
  }
  if (esPenultimo) {
    return [
      `Refinan y completan el producto final de la unidad sobre "${tema}" incorporando las sugerencias y correcciones recibidas en sesiones anteriores.`,
      `Ensayan su presentación oral (si aplica) practicando con un compañero o grupo pequeño. Aplican criterios de claridad, fluidez y organización del discurso.`,
      `Revisan la calidad visual y lingüística del producto final asegurándose de que cumple con los criterios establecidos en la rúbrica.`,
      `Reciben retroalimentación formativa final del docente y realizan los ajustes necesarios antes de la presentación o entrega definitiva.`,
    ];
  }
  return [
    `Desarrollan el producto final de la unidad sobre "${tema}" trabajando colaborativamente. Aplican los contenidos conceptuales, procedimentales y actitudinales construidos durante las fases anteriores.`,
    `Organizan, estructuran y producen los elementos del producto final siguiendo los criterios de calidad y el formato establecido.`,
    `Reciben retroalimentación formativa del docente mientras trabajan y realizan ajustes progresivos en su producción.`,
    `Avanzan en la preparación de la presentación o exposición del producto, distribuyendo responsabilidades y ensayando si aplica.`,
  ];
};

const getActsFase4Cierre = (area, tema, diaNum, totalDias) => {
  const esUltimo = diaNum >= totalDias;
  if (esUltimo) {
    return [
      `Comparten sus reflexiones finales sobre el aprendizaje construido durante toda la unidad: _¿Qué fue lo más significativo? ¿Cómo cambiaron mis ideas sobre "${tema}"?_`,
      `Expresan reconocimiento por el trabajo propio y el de sus compañeros. Identifican los logros colectivos e individuales más importantes de la unidad.`,
      `Integran los aprendizajes de la unidad reconociendo cómo los contenidos y habilidades desarrolladas sobre "${tema}" se aplican en su vida cotidiana y futura.`,
      `Despiden la unidad de aprendizaje de manera motivacional. El docente felicita al grupo y anuncia los próximos aprendizajes.`,
    ];
  }
  return [
    `Comparten brevemente el avance del producto final del día e identifican qué les falta completar para el encuentro siguiente.`,
    `Reflexionan sobre la calidad de su producción: _¿Cumple con los criterios establecidos? ¿Qué debo mejorar antes de la entrega final?_`,
    `Integran la retroalimentación recibida durante el encuentro y establecen compromisos concretos de mejora para la próxima sesión.`,
    `Reciben orientación sobre lo que deben traer o preparar para el próximo encuentro relacionado con el producto final.`,
  ];
};

// ─── Distribución de fases basada en complejidad pedagógica ──────────────────
//
// Las fases dependen de: complejidad del tema, competencias, indicadores,
// horas disponibles, nivel y ritmo esperado. No son porcentajes fijos.
//
// Pesos por nivel de complejidad:
//   baja:    más tiempo en Integración (producto sencillo, síntesis rápida)
//   media:   equilibrio entre Desarrollo y las demás fases
//   alta:    más tiempo en Desarrollo y Profundización (conocimiento complejo)
//   muyAlta: máximo en Desarrollo + Profundización (múltiples habilidades, análisis)

const PESOS_FASE = {
  baja:    { f2: 0.38, f3: 0.22, f4: 0.40 },
  media:   { f2: 0.44, f3: 0.26, f4: 0.30 },
  alta:    { f2: 0.46, f3: 0.30, f4: 0.24 },
  muyAlta: { f2: 0.46, f3: 0.34, f4: 0.20 },
};

const calcularDistribucion = (total, productoFinal = "", nivelComplejidad = "media") => {
  const tieneProductoComplejo = /exposici[oó]n|proyecto|portafolio|presentaci[oó]n|obra|debate|experimento|mural|informe|podcast|video\b/i.test(productoFinal);

  // Fase 1 siempre corta — solo diagnóstico y activación inicial
  const f1 = total <= 5 ? 1 : 2;
  const rem = total - f1;

  const peso = PESOS_FASE[nivelComplejidad] || PESOS_FASE.media;
  const f4Bonus = tieneProductoComplejo ? 0.06 : 0;

  let f2 = Math.max(2, Math.round(rem * peso.f2));
  let f4 = Math.max(2, Math.round(rem * (peso.f4 + f4Bonus)));
  let f3 = Math.max(2, rem - f2 - f4);

  // Corregir desbordamiento
  const suma = f2 + f3 + f4;
  if (suma > rem) f2 -= (suma - rem);
  if (suma < rem) f4 += (rem - suma);

  // Si hay producto complejo, f4 debe ser ≥ f3
  if (tieneProductoComplejo && f4 < f3) {
    const mueve = Math.ceil((f3 - f4) / 2);
    if (f3 - mueve >= 2) { f3 -= mueve; f4 += mueve; }
  }

  return [Math.max(1, f1), Math.max(2, f2), Math.max(2, f3), Math.max(2, f4)];
};

// ─── Progresión pedagógica de 11 etapas — MINERD ─────────────────────────────
//
// Cada clase debe representar un avance real. Las 11 etapas se distribuyen
// en las 4 fases de la unidad:
//   Fase 1 (Presentación):   Diagnóstico · Activación · Exploración
//   Fase 2 (Desarrollo):     Construcción · Práctica guiada · Consolidación
//   Fase 3 (Profundización): Aplicación · Producción
//   Fase 4 (Integración):    Integración · Evaluación · Metacognición

const ETAPAS_POR_FASE = [
  ["Diagnóstico", "Activación", "Exploración"],
  ["Construcción", "Práctica guiada", "Consolidación"],
  ["Aplicación", "Producción"],
  ["Integración", "Evaluación", "Metacognición"],
];

const getEtapaProgresion = (faseIdx, numDia, totalDias) => {
  const etapas = ETAPAS_POR_FASE[faseIdx] || ETAPAS_POR_FASE[1];
  const pos = Math.min(
    Math.floor(((numDia - 1) / Math.max(totalDias, 1)) * etapas.length),
    etapas.length - 1
  );
  return etapas[pos];
};

// ─── Títulos e intenciones pedagógicas por fase ───────────────────────────────

const TITULOS_FASE = [
  ["Diagnóstico y motivación: presentación de la situación de aprendizaje", "Exploración de saberes previos y apropiación de la unidad de aprendizaje"],
  ["Introducción de conceptos y vocabulario clave", "Comprensión y análisis del contenido", "Práctica guiada y trabajo colaborativo", "Profundización y consolidación de aprendizajes", "Ampliación y transferencia de contenidos"],
  ["Aplicación de aprendizajes en contextos reales", "Producción colaborativa y transferencia", "Desarrollo inicial del producto final", "Producción oral y escrita con autonomía"],
  ["Desarrollo y organización del producto final", "Refinamiento y preparación de la presentación", "Socialización y exposición de producciones", "Evaluación integral, metacognición y cierre de la unidad"],
];

const INTENCIONES_FASE = [
  [
    (tema) => `Diagnosticar los conocimientos previos de los estudiantes sobre "${tema}", presentar la situación de aprendizaje y generar motivación e interés genuino por los nuevos aprendizajes.`,
    (_tema) => `Profundizar en la exploración de saberes previos, presentar la estructura de la unidad y conectar el contenido con el contexto real y el producto final esperado.`,
  ],
  [
    (tema) => `Introducir los conceptos y vocabulario esenciales de "${tema}", estableciendo una base conceptual sólida mediante ejemplos del entorno cotidiano.`,
    (tema) => `Desarrollar la comprensión de "${tema}" mediante análisis de ejemplos, diferenciación de conceptos y práctica de estructuras en contexto real.`,
    (tema) => `Fortalecer la comprensión de "${tema}" mediante práctica guiada, trabajo colaborativo y retroalimentación formativa oportuna.`,
    (tema) => `Profundizar en el dominio de "${tema}" mediante actividades de mayor complejidad que promuevan el pensamiento crítico y la transferencia.`,
    (tema) => `Consolidar los aprendizajes de "${tema}" integrando contenidos conceptuales, procedimentales y actitudinales en situaciones auténticas.`,
  ],
  [
    (tema) => `Aplicar los aprendizajes sobre "${tema}" en situaciones comunicativas o contextos reales, promoviendo la producción con autonomía creciente.`,
    (tema) => `Desarrollar producciones colaborativas que evidencien la comprensión y aplicación de "${tema}" en situaciones significativas del entorno.`,
    (tema) => `Iniciar el desarrollo del producto final integrando los aprendizajes construidos durante las fases anteriores sobre "${tema}".`,
    (tema) => `Perfeccionar las producciones sobre "${tema}", incorporando la retroalimentación recibida y aplicando criterios de calidad establecidos.`,
  ],
  [
    (tema) => `Desarrollar y organizar el producto final que evidencie el dominio de los aprendizajes de la unidad sobre "${tema}".`,
    (_tema) => `Refinar el producto final e incorporar las correcciones necesarias para alcanzar los criterios de calidad de la exposición o entrega.`,
    (_tema) => `Socializar y exponer el producto final ante el grupo, desarrollando habilidades de comunicación y recibiendo retroalimentación de pares y docente.`,
    (_tema) => `Evaluar integralmente los aprendizajes construidos, promover la metacognición y celebrar los logros alcanzados a lo largo de la unidad.`,
  ],
];

// ─── Generador principal de días y fases ─────────────────────────────────────

const generarDia = (numDia, area, tema, faseIdx, totalDiasFase, _productoFinal = "") => {
  // Título e intención según fase y posición del día
  const titulosF = TITULOS_FASE[faseIdx] || TITULOS_FASE[1];
  const titulo = titulosF[Math.min(numDia - 1, titulosF.length - 1)];
  const intencionesF = INTENCIONES_FASE[faseIdx] || INTENCIONES_FASE[1];
  const intencionFn = intencionesF[Math.min(numDia - 1, intencionesF.length - 1)];
  const intencionPedagogica = intencionFn(tema);

  // Selección de actividades según fase (fase 4 usa generadores propios)
  const diaIdx = numDia - 1;
  const actsInicio   = faseIdx === 3 ? getActsFase4Inicio(area, tema, numDia, totalDiasFase)     : getActsInicio(area, tema, faseIdx, diaIdx);
  const actsDesarrollo = faseIdx === 3 ? getActsFase4Desarrollo(area, tema, numDia, totalDiasFase) : getActsDesarrollo(area, tema, faseIdx, diaIdx);
  const actsCierre   = faseIdx === 3 ? getActsFase4Cierre(area, tema, numDia, totalDiasFase)     : getActsCierre(area, tema, faseIdx, diaIdx);

  // Evaluación: última fase último día → sumativa
  const esUltimoDiaFase4 = faseIdx === 3 && numDia >= totalDiasFase;
  const evalOverride = esUltimoDiaFase4
    ? { tipo: "Sumativa", agente: "Hetero / Auto / Coevaluación", tecnica: "Exposición / Revisión de producciones / Reflexión", instrumento: "Rúbrica analítica / Instrumento de autoevaluación" }
    : null;

  // Evidencias de Fase 4 (más específicas)
  const evidF4 = {
    Inicio:    "Disposición y organización:\n• Muestra claridad sobre los criterios de calidad del producto final.\n• Organiza el trabajo del día con autonomía y propósito.",
    Desarrollo: "Producto final:\n• Desarrolla o perfecciona el producto final con calidad y coherencia.\n• Aplica los aprendizajes de la unidad en una producción auténtica.\n• Demuestra dominio de los contenidos trabajados.",
    Cierre:    "Metacognición y evaluación:\n• Autoevalúa su desempeño con criterio y honestidad.\n• Coevalúa las producciones de sus compañeros de manera constructiva.\n• Reflexiona sobre el proceso y los logros alcanzados en la unidad.",
  };

  const mkMomento = (nombre, tiempo, acts) => ({
    nombre,
    tiempo,
    actividades: acts,
    evidencias: faseIdx === 3 ? evidF4[nombre] : getEvidencias(area, nombre, faseIdx),
    evaluacion: evalOverride || getEvaluacion(nombre, faseIdx),
    recursos: derivarRecursos(acts, area, faseIdx + 1),
    metacognicion: getMetacognicion(nombre, area, tema),
  });

  const etapaProgresion = getEtapaProgresion(faseIdx, numDia, totalDiasFase);
  const criteriosExito = getCriteriosExito(area, faseIdx, tema);
  const aporteProducto = getAporteProducto(area, faseIdx, numDia, totalDiasFase, tema);

  return {
    numero: numDia,
    titulo,
    etapaProgresion,
    criteriosExito,
    aporteProducto,
    intencionPedagogica,
    momentos: [
      mkMomento("Inicio",     "10 min", actsInicio),
      mkMomento("Desarrollo", "35 min", actsDesarrollo),
      mkMomento("Cierre",     "15 min", actsCierre),
    ],
    adaptacionesNEAE: {
      acceso: "Ubicar a los estudiantes con NEAE cerca del docente y la pizarra. Proveer materiales con letra ampliada si aplica.",
      metodologicas: "Simplificar instrucciones, permitir tiempo adicional y ofrecer materiales concretos y visuales como apoyo.",
      evaluacion: "Evaluar los mismos criterios adaptando el nivel de complejidad y el tipo de respuesta esperado.",
    },
    resumenEvaluacion: {
      tecnicas: faseIdx === 3
        ? ["Exposición oral", "Revisión de producciones", "Autoevaluación / Coevaluación"]
        : ["Observación directa", "Revisión del cuaderno", "Interrogatorio oral"],
      instrumentos: faseIdx === 3
        ? ["Rúbrica analítica", "Lista de cotejo", "Autoevaluación / coevaluación"]
        : ["Lista de cotejo", "Rúbrica analítica", "Escala de valoración"],
      criterioPuntuacion: "El docente selecciona los instrumentos que aplicará ese día y define la puntuación según la complejidad del tema.",
      observaciones: faseIdx === 3
        ? "Registrar los logros del producto final, el nivel de participación en la exposición y el desempeño en la auto y coevaluación."
        : "Registrar el desempeño general del grupo e identificar estudiantes que requieren atención diferenciada o refuerzo.",
    },
  };
};

const DIAS_ORDEN = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

const generarFases = (numSemanas, schedule, area, tema, estrategia, productoFinal = "", contexto = {}) => {
  const { diasClase, horasPorDia, duracionHoraClase } = schedule;
  const horasSemanales = diasClase.length * horasPorDia;
  const totalHorasClase = numSemanas * horasSemanales;

  // Calcular complejidad del tema para distribuir las fases de forma pedagógicamente apropiada
  const compx = analizarComplejidad({
    area,
    titulo: tema,
    productoFinal,
    grado: contexto.grado || "",
    nivel: contexto.nivel || "Secundaria",
  });
  const distribucion = calcularDistribucion(totalHorasClase, productoFinal, compx.nivelClave);

  const fases = distribucion.map((numHoras, faseIdx) => ({
    numero: faseIdx + 1,
    nombre: NOMBRES_FASES[faseIdx],
    estrategia,
    indicadoresAvance: getIndicadoresAvance(area, faseIdx, tema),
    posiblesDificultades: getPosiblesDificultades(area, faseIdx),
    dias: Array.from({ length: numHoras }, (_, d) =>
      generarDia(d + 1, area, tema, faseIdx, numHoras, productoFinal)
    ),
  }));

  // Generar ranuras de calendario: semana → día → hora
  const slots = [];
  for (let sem = 1; sem <= numSemanas; sem++) {
    for (const diaCalendario of diasClase) {
      for (let hora = 1; hora <= horasPorDia; hora++) {
        slots.push({ semana: sem, diaCalendario, hora });
      }
    }
  }

  // Asignar ranura y número global de clase a cada día
  let slotIdx = 0;
  let claseGlobal = 0;
  fases.forEach((fase) => {
    fase.dias.forEach((dia) => {
      dia.numeroGlobal = ++claseGlobal;
      if (slotIdx < slots.length) {
        const s = slots[slotIdx++];
        dia.semana = s.semana;
        dia.diaCalendario = s.diaCalendario;
        dia.hora = s.hora;
        dia.mostrarHora = horasPorDia > 1;
        dia.duracionMin = duracionHoraClase;
      }
    });
  });

  return fases;
};

// ─── Análisis de complejidad curricular ──────────────────────────────────────

const _justificaciones = {
  baja: (tema) =>
    `El tema "${tema}" se centra en vocabulario y conceptos básicos que pueden desarrollarse en pocas sesiones con práctica repetida y contextos cotidianos. Los indicadores de logro pueden alcanzarse sin extender la unidad más allá de lo necesario, evitando redundancias pedagógicas.`,
  media: (tema) =>
    `El tema "${tema}" requiere trabajar vocabulario específico, estructuras procedimentales y producción oral/escrita. La complejidad curricular permite desarrollar las competencias e indicadores en un rango intermedio de encuentros sin generar actividades repetitivas.`,
  alta: (tema) =>
    `El tema "${tema}" integra múltiples habilidades (comprensión, producción, análisis crítico) y requiere un proceso progresivo para alcanzar los indicadores de logro. Un mayor número de encuentros garantiza una progresión sólida sin apresurar el proceso de aprendizaje.`,
  muyAlta: (tema) =>
    `El tema "${tema}" integra lectura, escritura, producción oral, investigación, pensamiento crítico, vocabulario especializado y presentación de productos complejos. Requiere una unidad extensa para garantizar el dominio real de las competencias sin sacrificar la calidad de los aprendizajes.`,
};

export const analizarComplejidad = ({ area = "", grado = "", nivel = "", titulo = "", productoFinal = "" }) => {
  const tema = titulo.trim();
  const txt = `${tema} ${productoFinal}`.toLowerCase();
  let score = 0;

  // ── Palabras clave del tema ──
  const temaSimple = /^(colors?|numbers?|greetings?|body parts?|parts of the house|classroom|family|pets|clothes|food|days|months|seasons|shapes|toys|weather|animals|colores?|números?|saludos?|partes del cuerpo|partes de la casa|familia|animales|ropa|comidas?|d[ií]as|meses|estaciones|figuras|juguetes|tiempo)\b/i.test(tema);
  const temaMuyComplejo = /proyecto integrador|investigaci[oó]n cient[ií]fica|producci[oó]n multimedia|portafolio integrado|integrated project|science.*technology|technology.*communication|ciencia.*tecnolog|tecnolog.*comunicaci[oó]n/i.test(txt);
  const temaComplejo = /tecnolog[ií]a|comunicaci[oó]n|ciencia|sociedad|cultura|historia|econom[ií]a|medio ambiente|salud|derechos|investigaci[oó]n|technology|communication|science|society|culture|history|economy|environment|health|rights|diversity|sustainability|globalizaci[oó]n|globalization/i.test(txt);

  if (temaMuyComplejo) score += 70;
  else if (temaComplejo) score += 45;
  else if (temaSimple) score += 8;
  else score += 22;

  // ── Longitud del título ──
  const palabras = tema.split(/\s+/).length;
  if (palabras >= 5) score += 18;
  else if (palabras >= 3) score += 10;
  else if (palabras >= 2) score += 5;

  // ── Grado / nivel ──
  if (/secundaria|secondary/i.test(nivel) || /[5-6]to|[5-6]th/i.test(grado)) score += 15;
  else if (/[3-4]ro|[3-4]th/i.test(grado)) score += 8;
  else if (/[1-2]ro|[1-2]st|[1-2]nd/i.test(grado)) score += 3;

  // ── Producto final ──
  if (/exposici[oó]n|proyecto|portafolio|investigaci[oó]n|obra|debate|experimento|mural|informe|podcast|video|book report|science fair|presentaci[oó]n (oral|final)/i.test(productoFinal)) score += 20;
  else if (/lista|tarjeta|ficha|oraci[oó]n|dibujo|p[aá]rrafo breve|cuadro sencillo/i.test(productoFinal)) score -= 8;
  else if (productoFinal) score += 8;

  // ── Área ──
  if (/ciencias sociales|historia|educaci[oó]n f[ií]sica/i.test(area)) score += 5;
  if (/ciencias de la naturaleza|matem[aá]tica/i.test(area)) score += 8;

  score = Math.max(0, Math.min(100, score));

  const CFG = {
    baja:    { emoji: "🟢", etiqueta: "Baja",     semanasMin: 1, semanasMax: 2, semanas: 2, encuentros: "4 – 8"   },
    media:   { emoji: "🟡", etiqueta: "Media",    semanasMin: 3, semanasMax: 4, semanas: 4, encuentros: "12 – 16" },
    alta:    { emoji: "🟠", etiqueta: "Alta",     semanasMin: 5, semanasMax: 6, semanas: 5, encuentros: "20 – 24" },
    muyAlta: { emoji: "🔴", etiqueta: "Muy alta", semanasMin: 7, semanasMax: 8, semanas: 7, encuentros: "28 – 32" },
  };

  const nivelClave = score < 26 ? "baja" : score < 56 ? "media" : score < 76 ? "alta" : "muyAlta";
  const cfg = CFG[nivelClave];

  return {
    nivelClave,
    emoji:             cfg.emoji,
    etiqueta:          cfg.etiqueta,
    semanasMin:        cfg.semanasMin,
    semanasMax:        cfg.semanasMax,
    semanasRecomendadas: cfg.semanas,
    encuentrosRango:   cfg.encuentros,
    justificacion:     _justificaciones[nivelClave](tema || "el tema seleccionado"),
    score,
  };
};

// ─── Exportación principal ────────────────────────────────────────────────────

export const generarUnidadAprendizaje = (datos) => {
  const {
    grado = "", seccion = "", area = "", asignatura = "",
    titulo = "", numSemanas = 4,
    diasClase = [], horasPorDia = 1, duracionHoraClase = 45,
    estrategiaTexto = "", situacionTexto = "", productoFinalTexto = "",
    nombreDocente = "", cedula = "", regional = "", distrito = "",
    centro = "", codigoCentro = "", nivel = "Secundaria", ciclo = "Primer Ciclo",
    modalidad = "Académica", periodo = "", fechaInicio = "",
    asignaturasVinculadasTexto = "",
    jornada = "Extendida",
    competenciasFundamentalesSeleccionadas = [],
  } = datos;

  // Normalizar horario
  const diasClaseEf = DIAS_ORDEN.filter((d) => (diasClase || []).includes(d));
  const diasClaseFinal = diasClaseEf.length > 0 ? diasClaseEf : ["Lunes", "Martes", "Miércoles"];
  const horasPorDiaEf = Math.max(1, horasPorDia || 1);
  const durMinEf = (nivel === "Primaria" || nivel === "Inicial") ? 45 : (duracionHoraClase || 45);
  const horasSemanales = diasClaseFinal.length * horasPorDiaEf;
  const schedule = { diasClase: diasClaseFinal, horasPorDia: horasPorDiaEf, duracionHoraClase: durMinEf };

  // Usa la asignatura si tiene entrada en los diccionarios; si no, usa el área como fallback
  const claveContenido = resolverClave(asignatura, area, ESTRATEGIAS_POR_AREA);
  const asignaturaEf = asignatura || area;
  const estrategiaEf = estrategiaTexto || getEstrategia(claveContenido);
  const situacion = situacionTexto || getSituacion(claveContenido, titulo);
  const ambiente = getAmbiente(claveContenido);
  const producto = productoFinalTexto || `Presentación/producción final sobre "${titulo}" que evidencie el dominio de los aprendizajes de la unidad.`;
  const ejes = getEjesTematicos(claveContenido);
  const contenidos = getContenidos(claveContenido, titulo);
  const compFundBase = COMPETENCIAS_FUND_POR_AREA[claveContenido] || ["Comunicativa", "Pensamiento Lógico, Creativo y Crítico"];
  const compFundEf = competenciasFundamentalesSeleccionadas.length > 0
    ? competenciasFundamentalesSeleccionadas
    : compFundBase;

  return {
    tipoPlanificacion: "Unidad de Aprendizaje",
    metadatos: {
      titulo, grado, seccion, area, asignatura: asignaturaEf,
      nivel, ciclo, modalidad, jornada,
      duracion: `${numSemanas} semanas / ${numSemanas * horasSemanales} horas clase (${durMinEf} min c/u)`,
      horario: `${diasClaseFinal.join(", ")} · ${horasPorDiaEf} hora${horasPorDiaEf > 1 ? "s" : ""}/día · ${horasSemanales} horas/semana`,
      periodo, fechaInicio, nombreDocente, cedula, regional, distrito,
      centro, codigoCentro,
      asignaturasVinculadas: asignaturasVinculadasTexto
        ? asignaturasVinculadasTexto.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      productoFinal: producto,
    },
    ejesTematicos: ejes,
    situacionAprendizaje: situacion,
    ambienteAprendizaje: ambiente,
    competencias: (() => {
      const esIdioma = claveContenido === "Inglés" || claveContenido === "Francés";
      if (esIdioma) {
        const oficial = getCompetenciasIdiomas(claveContenido, grado);
        return {
          fundamentales: compFundEf,
          especifica: oficial.especifica,
          nivelMCERL: oficial.nivelMCERL,
          indicadores: oficial.indicadores,
        };
      }
      // Motor Especializado para las demás áreas
      const oficial = getCompetenciasArea(claveContenido, grado);
      if (oficial) {
        return {
          fundamentales: compFundEf,
          especifica: oficial.especifica,
          indicadores: oficial.indicadores,
        };
      }
      // Fallback genérico (áreas sin módulo todavía)
      return {
        fundamentales: compFundEf,
        especifica: `Desarrollar competencias en ${area} relacionadas con "${titulo}", mediante el uso de estrategias activas que promuevan la comprensión, aplicación y reflexión crítica de los contenidos.`,
        indicadores: [
          `Demuestra comprensión del contenido "${titulo}" a través de producciones orales y escritas.`,
          `Aplica los procedimientos y estrategias propios de ${area} en situaciones prácticas relacionadas con el tema.`,
          `Valora la importancia de los aprendizajes adquiridos y los relaciona con situaciones de su entorno cotidiano.`,
        ],
      };
    })(),
    contenidos,
    fasesSemanales: generarFases(numSemanas, schedule, claveContenido, titulo, estrategiaEf, producto, { grado, nivel }),
  };
};

// ─── Formateador HTML para PDF ────────────────────────────────────────────────

export const formatearUnidadHTML = (unidad, logoUrl = "") => {
  if (!unidad) return "";
  const m = unidad.metadatos || {};

  const estilos = `
    body { font-family: 'Book Antiqua', Palatino, 'Palatino Linotype', serif; font-size: 12pt; line-height: 1.15; color: #111; margin: 0; }
    p { margin: 0 0 3pt; }
    .page { width: 100%; max-width: 1120px; margin: 0 auto; padding: 20px; box-sizing: border-box; }
    .header-minerd { text-align: center; margin-bottom: 14px; padding-bottom: 14px; border-bottom: 2px solid #1e3a8a; }
    .header-minerd img { display: block; margin: 0 auto 10px; width: 220px; max-width: 65mm; height: auto; }
    h1 { font-size: 16pt; font-weight: bold; text-align: center; color: #1e3a8a; margin: 0 0 3pt; }
    .sub { font-size: 14pt; font-weight: bold; text-align: center; color: #1d4ed8; margin: 0; }
    .datos-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    .datos-table td { border: 1px solid #93c5fd; padding: 4px 8px; font-size: 12pt; }
    .datos-table .lbl { background: #dbeafe; font-weight: bold; width: 160px; font-size: 11pt; }
    .section-head { background: #1d4ed8; color: white; padding: 5px 10px; font-weight: bold; font-size: 11pt; margin: 10px 0 0; }
    .contenidos { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0; margin-bottom: 12px; }
    .cont-col { border: 1px solid #93c5fd; }
    .cont-head { background: #bfdbfe; padding: 4px 8px; font-weight: bold; font-size: 11pt; }
    .cont-list { padding: 4px 8px 4px 18px; margin: 0; font-size: 12pt; }
    .fase-band { background: #1e3a5f; color: white; padding: 6px 10px; font-weight: bold; font-size: 11pt; margin-top: 18px; }
    .est-band { background: #2563eb; color: white; padding: 4px 10px; font-size: 10pt; }
    .semana-band { background: #3b82f6; color: white; padding: 5px 10px; font-weight: bold; font-size: 11pt; margin-top: 12px; }
    .intencion-band { background: #eff6ff; border: 1px solid #93c5fd; padding: 5px 10px; font-size: 12pt; margin-bottom: 6px; }
    .dia-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    .dia-table th { background: #1d4ed8; color: white; padding: 5px; font-size: 11pt; font-weight: bold; border: 1px solid #1e40af; text-align: left; }
    .dia-table td { border: 1px solid #93c5fd; padding: 4px 6px; font-size: 12pt; vertical-align: top; }
    .td-momento { background: #f0f9ff; font-weight: bold; text-align: center; width: 65px; }
    .td-tiempo { text-align: center; width: 55px; }
    .td-meta { background: #d1fae5; font-style: italic; }
    .meta-lbl { font-weight: bold; font-style: normal; color: #065f46; }
    .neae-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0; margin-bottom: 8px; }
    .neae-col { border: 1px solid #e2e8f0; }
    .neae-head { background: #f1f5f9; padding: 3px 8px; font-weight: bold; font-size: 11pt; }
    .neae-body { padding: 3px 8px; font-size: 10pt; }
    .texto-seccion { border: 1px solid #93c5fd; padding: 8px 10px; font-size: 12pt; font-weight: normal; line-height: 1.3; text-align: justify; height: auto; min-height: 40px; margin-bottom: 8px; }
    @page { size: A4 landscape; margin: 12mm; }
    @media print {
      .page { padding: 0; max-width: 100%; }
      .header-minerd { break-after: avoid; page-break-after: avoid; }
      button { display: none !important; }
      [style*="position:fixed"] { display: none !important; }
      thead { display: table-header-group; }
      thead tr { break-inside: avoid; page-break-inside: avoid; }
      tbody tr { break-inside: auto; page-break-inside: auto; }
      .dia-table { break-inside: auto; page-break-inside: auto; margin-bottom: 6px; }
      .semana-band { break-after: avoid; page-break-after: avoid; }
      .intencion-band { break-after: avoid; page-break-after: avoid; }
      .fase-band { break-before: auto; page-break-before: auto; break-after: avoid; page-break-after: avoid; }
      .section-head { break-after: avoid; page-break-after: avoid; }
      .neae-grid { break-inside: auto; page-break-inside: auto; }
      .neae-col { break-inside: auto; page-break-inside: auto; }
    }
  `;

  const fasesHtml = (unidad.fasesSemanales || []).map((fase) => {
    const diasHtml = (fase.dias || []).map((dia) => {
      const momentosHtml = (dia.momentos || []).map((mom) => {
        const actsHtml = (mom.actividades || []).map((a, i) => {
          const html = a.replace(/_([^_]+)_/g, "<em>$1</em>");
          return `<p style="margin:2px 0"><strong>${i + 1})</strong> ${html}</p>`;
        }).join("");
        const evalHtml = `<strong>Tipo:</strong> ${mom.evaluacion?.tipo}.<br><strong>Agente:</strong> ${mom.evaluacion?.agente}.<br><strong>Técnica:</strong> ${mom.evaluacion?.tecnica}.<br><strong>Instrumento:</strong> ${mom.evaluacion?.instrumento}.`;
        const recursos = mom.recursos || {};
        const recursosHtml = `<strong>Humanos:</strong> ${recursos.humanos}<br><strong>Didácticos:</strong> ${recursos.didacticos}<br><strong>Tecnológicos:</strong> ${recursos.tecnologicos}`;
        const metaHtml = (mom.metacognicion || []).join(" · ");
        return `
          <tr>
            <td class="td-momento" rowspan="2">${mom.nombre}</td>
            <td class="td-tiempo" rowspan="2">${mom.tiempo}</td>
            <td rowspan="2">${actsHtml}</td>
            <td style="white-space:pre-line">${mom.evidencias || ""}</td>
            <td>${evalHtml}</td>
            <td rowspan="2">${recursosHtml}</td>
          </tr>
          <tr>
            <td colspan="2" class="td-meta"><span class="meta-lbl">Metacognición: </span>${metaHtml}</td>
          </tr>`;
      }).join("");

      return `
        <div class="semana-band">FASE ${fase.numero} — CLASE ${dia.numeroGlobal} (Sem. ${dia.semana}, ${dia.diaCalendario}${dia.mostrarHora ? " H" + dia.hora : ""}): "${dia.titulo}"</div>
        <div class="intencion-band"><strong>Intención pedagógica del día:</strong> ${dia.intencionPedagogica}</div>
        <table class="dia-table">
          <colgroup>
            <col style="width:65px">
            <col style="width:50px">
            <col>
            <col style="width:15%">
            <col style="width:15%">
            <col style="width:13%">
          </colgroup>
          <thead>
            <tr>
              <th>Momento</th>
              <th>Tiempo</th>
              <th>Actividades</th>
              <th>Evidencias</th>
              <th>Evaluación</th>
              <th>Recursos</th>
            </tr>
          </thead>
          <tbody>${momentosHtml}</tbody>
        </table>`;
    }).join("");

    const neaeHtml = (fase.dias[0]?.adaptacionesNEAE) ? `
      <div class="section-head">ADAPTACIONES (NEAE — si aplica)</div>
      <div class="neae-grid">
        <div class="neae-col"><div class="neae-head">De acceso</div><div class="neae-body">${fase.dias[0].adaptacionesNEAE.acceso}</div></div>
        <div class="neae-col"><div class="neae-head">Metodológicas</div><div class="neae-body">${fase.dias[0].adaptacionesNEAE.metodologicas}</div></div>
        <div class="neae-col"><div class="neae-head">De evaluación</div><div class="neae-body">${fase.dias[0].adaptacionesNEAE.evaluacion}</div></div>
      </div>` : "";

    const resEv = fase.dias[0]?.resumenEvaluacion;
    const resumenHtml = resEv ? `
      <div class="section-head">RESUMEN DE EVALUACIÓN Y OBSERVACIONES</div>
      <div class="neae-grid">
        <div class="neae-col"><div class="neae-head">Técnicas</div><div class="neae-body">${(resEv.tecnicas || []).join(", ")}</div></div>
        <div class="neae-col"><div class="neae-head">Instrumentos</div><div class="neae-body">${(resEv.instrumentos || []).join(", ")}</div></div>
        <div class="neae-col"><div class="neae-head">Observaciones</div><div class="neae-body">${resEv.observaciones}</div></div>
      </div>` : "";

    return `
      <div class="fase-band">FASE ${fase.numero} — ${fase.nombre}</div>
      <div class="est-band">Estrategia de enseñanza y de aprendizaje: ${fase.estrategia}</div>
      ${diasHtml}
      ${neaeHtml}
      ${resumenHtml}`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Unidad de Aprendizaje — ${m.titulo}</title>
<style>${estilos}</style></head>
<body><div class="page">
  <div class="header-minerd">
    ${logoUrl ? `<img src="${logoUrl}" alt="Logo MINERD" onerror="this.style.display='none'">` : ""}
    <h1>MINISTERIO DE EDUCACIÓN DE LA REPÚBLICA DOMINICANA</h1>
    <div class="sub">PLANIFICACIÓN: UNIDAD DE APRENDIZAJE</div>
  </div>

  <div class="section-head">DATOS GENERALES</div>
  <table class="datos-table">
    <tr><td class="lbl">Nombre del docente</td><td>${m.nombreDocente}</td><td class="lbl">Cédula</td><td>${m.cedula}</td></tr>
    <tr><td class="lbl">Regional</td><td>${m.regional}</td><td class="lbl">Distrito</td><td>${m.distrito}</td></tr>
    <tr><td class="lbl">Centro Educativo</td><td>${m.centro}</td><td class="lbl">Código</td><td>${m.codigoCentro}</td></tr>
    <tr><td class="lbl">Nivel / Ciclo</td><td>${m.nivel} / ${m.ciclo}</td><td class="lbl">Modalidad</td><td>${m.modalidad}</td></tr>
    ${m.jornada ? `<tr><td class="lbl">Jornada</td><td colspan="3">${m.jornada === "Extendida" ? "Jornada Extendida (40h/sem.)" : m.jornada === "Regular" ? "Jornada Regular (30h/sem.)" : "Jornada de Transición (25h/sem.)"}</td></tr>` : ""}
    <tr><td class="lbl">Grado y Sección</td><td>${m.grado} ${m.seccion}</td><td class="lbl">Período</td><td>${m.periodo}</td></tr>
    <tr><td class="lbl">Área</td><td>${m.area}</td><td class="lbl">Asignatura</td><td>${m.asignatura}</td></tr>
    <tr><td class="lbl">Título de la Unidad</td><td colspan="3"><strong>${m.titulo}</strong></td></tr>
    <tr><td class="lbl">Duración</td><td>${m.duracion}</td><td class="lbl">Fecha inicio</td><td>${m.fechaInicio}</td></tr>
    <tr><td class="lbl">Horario</td><td colspan="3">${m.horario || ""}</td></tr>
    <tr><td class="lbl">Asignaturas vinculadas</td><td colspan="3">${(m.asignaturasVinculadas || []).join(", ") || "N/A"}</td></tr>
    <tr><td class="lbl">Producto final</td><td colspan="3">${m.productoFinal}</td></tr>
  </table>

  <div class="section-head">SITUACIÓN DE APRENDIZAJE</div>
  <div class="texto-seccion">${unidad.situacionAprendizaje}</div>
  <div class="section-head">AMBIENTE DE APRENDIZAJE</div>
  <div class="texto-seccion">${unidad.ambienteAprendizaje}</div>

  <div class="section-head">CONTENIDOS</div>
  <div class="contenidos">
    <div class="cont-col"><div class="cont-head">Conceptuales</div><ul class="cont-list">${(unidad.contenidos?.conceptuales || []).map((c) => `<li>${c}</li>`).join("")}</ul></div>
    <div class="cont-col"><div class="cont-head">Procedimentales</div><ul class="cont-list">${(unidad.contenidos?.procedimentales || []).map((c) => `<li>${c}</li>`).join("")}</ul></div>
    <div class="cont-col"><div class="cont-head">Actitudinales</div><ul class="cont-list">${(unidad.contenidos?.actitudinales || []).map((c) => `<li>${c}</li>`).join("")}</ul></div>
  </div>

  ${fasesHtml}
</div>
<div style="position:fixed;bottom:20px;right:20px;z-index:999;display:flex;gap:8px">
  <button onclick="window.print()" style="background:#1d4ed8;color:white;border:none;padding:10px 20px;border-radius:6px;font-size:13px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3)">🖨️ Guardar como PDF</button>
  <button onclick="window.close()" style="background:#64748b;color:white;border:none;padding:10px 16px;border-radius:6px;font-size:13px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3)">✕ Cerrar</button>
</div>
</body></html>`;
};
