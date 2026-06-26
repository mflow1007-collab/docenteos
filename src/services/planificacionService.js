/* Servicio de Planificación — versión enriquecida MINERD */
import { distribuirTemasEnSemanas, obtenerTemaSemana } from "./curriculumCombinacionService.js";
import { resolverClave } from "../planning/areaAsignaturaMap.js";

// ─── Constantes ─────────────────────────────────────────────────────────────

const TIPO_EVAL = {
  DIAGNOSTICA: "diagnostica",
  FORMATIVA: "formativa",
  SUMATIVA: "sumativa",
};

const EJES_DEFAULT = {
  "Inglés":                             ["Alfabetización Imprescindible", "Ciudadanía y Convivencia"],
  "Lengua Española":                    ["Alfabetización Imprescindible", "Ciudadanía y Convivencia"],
  "Matemática":                         ["Desarrollo Sostenible", "Alfabetización Imprescindible"],
  "Ciencias de la Naturaleza":          ["Desarrollo Sostenible", "Salud y Bienestar"],
  "Ciencias Sociales":                  ["Ciudadanía y Convivencia", "Desarrollo Sostenible"],
  "Educación Artística":                ["Ciudadanía y Convivencia", "Alfabetización Imprescindible"],
  "Educación Física":                   ["Salud y Bienestar", "Ciudadanía y Convivencia"],
  "Formación Integral Humana y Religiosa": ["Ciudadanía y Convivencia", "Salud y Bienestar"],
  "Francés":                            ["Alfabetización Imprescindible", "Ciudadanía y Convivencia"],
};

const ASIGNATURAS_VINCULADAS_DEFAULT = {
  "Inglés":                  ["Lengua Española", "Tecnología de la Información"],
  "Lengua Española":         ["Ciencias Sociales", "Educación Artística", "Inglés"],
  "Matemática":              ["Ciencias de la Naturaleza", "Tecnología"],
  "Ciencias de la Naturaleza": ["Matemática", "Ciencias Sociales"],
  "Ciencias Sociales":       ["Lengua Española", "Ciencias de la Naturaleza"],
  "Educación Artística":     ["Lengua Española", "Ciencias Sociales"],
  "Educación Física":        ["Salud", "Ciencias de la Naturaleza"],
  "Francés":                 ["Lengua Española", "Inglés"],
};

// ─── Utilidades ─────────────────────────────────────────────────────────────

const normalizarDuracionSemanas = (duracion) => {
  if (typeof duracion === "number" && Number.isFinite(duracion) && duracion > 0) {
    return Math.floor(duracion);
  }
  const n = parseInt(String(duracion || "").match(/\d+/)?.[0] || "", 10);
  return Number.isFinite(n) && n > 0 ? n : 4;
};

const validarDatosPlanificacion = (datos) => {
  const tipo = datos.tipoPlanificacion || "";
  const requierePeriodo = tipo !== "Plan Anual";
  if (!datos.tema?.trim())               throw new Error("El tema es obligatorio");
  if (!datos.grado?.trim())              throw new Error("El grado es obligatorio");
  if (!datos.seccion?.trim())            throw new Error("La sección es obligatoria");
  if (!datos.area?.trim())               throw new Error("El área es obligatoria");
  if (requierePeriodo && !datos.periodo?.trim()) throw new Error("El período es obligatorio");
  if (!datos.indicadoresOficiales?.trim()) throw new Error("Los indicadores oficiales son obligatorios");
  return true;
};

// ─── Auto-generación de contexto curricular ─────────────────────────────────

const generarSituacionAprendizaje = (area, grado, tema, competencia) => {
  const mapa = {
    "Inglés":
      `En el contexto de nuestra comunidad educativa, los estudiantes de ${grado} exploran el idioma inglés para comunicarse en situaciones de la vida cotidiana relacionadas con "${tema}". A través de actividades auténticas y significativas, los aprendices desarrollan habilidades comunicativas orales y escritas que les permitirán interactuar con confianza en contextos reales e interculturales. Esta unidad conecta con la realidad del estudiante, promoviendo el uso del inglés como herramienta de expresión personal y social.`,
    "Lengua Española":
      `Los estudiantes de ${grado} se sumergen en el mundo de la comunicación oral y escrita a través del tema "${tema}", explorando textos, géneros literarios y situaciones comunicativas auténticas de su entorno. Mediante la lectura, la escritura y el diálogo crítico, los aprendices desarrollan la competencia lingüística necesaria para expresarse con efectividad, creatividad y propósito en diferentes contextos de su vida cotidiana.`,
    "Matemática":
      `En el aula de ${grado}, los estudiantes enfrentan situaciones problemáticas reales relacionadas con "${tema}" que requieren el uso del pensamiento matemático. A través de la investigación, el razonamiento lógico y la resolución de problemas, los aprendices construyen conceptos matemáticos significativos que pueden aplicar para comprender y transformar su entorno inmediato.`,
    "Ciencias de la Naturaleza":
      `Los estudiantes de ${grado} se convierten en exploradores científicos del tema "${tema}", investigando fenómenos naturales de su entorno inmediato. A través de la observación, la experimentación y el análisis crítico, los aprendices desarrollan el pensamiento científico y construyen comprensión profunda sobre cómo funciona el mundo natural que los rodea.`,
    "Ciencias Sociales":
      `Los estudiantes de ${grado} exploran el tema "${tema}" desde una perspectiva crítica e histórica, analizando cómo los procesos sociales, culturales y políticos han formado la realidad que conocen. Mediante el estudio, el diálogo y la reflexión, desarrollan conciencia ciudadana y comprensión del mundo social en el que participan activamente.`,
  };
  return mapa[area] ||
    `Los estudiantes de ${grado} exploran "${tema}" a través de experiencias significativas y contextualizadas, desarrollando la competencia de ${competencia} mediante actividades que conectan con su realidad cotidiana y promueven el pensamiento crítico y la creatividad.`;
};

const generarAmbienteAprendizaje = (area) => {
  const mapa = {
    "Inglés":
      "Aula con disposición flexible en semicírculo o grupos (4-5 estudiantes), espacio para dramatizaciones y role-plays, rincón multimedia con acceso a recursos auditivos. Se usará la biblioteca y/o sala de tecnología según disponibilidad.",
    "Lengua Española":
      "Aula organizada en grupos cooperativos, con rincón de lectura, biblioteca de aula y mural de producciones escritas. Espacios para exposición oral y galería de textos.",
    "Matemática":
      "Aula con materiales manipulativos disponibles organizados en rincones de trabajo. Espacio en pizarrón para resolución compartida. Acceso a sala de cómputo para uso de software matemático.",
    "Ciencias de la Naturaleza":
      "Aula con área de experimentación, laboratorio o espacio natural cercano al centro. Rincón de observación con lupas y materiales del entorno. Patio escolar o jardín para actividades de campo.",
    "Ciencias Sociales":
      "Aula con mapas, líneas de tiempo y recursos audiovisuales. Espacio para debates y mesas redondas. Uso de la biblioteca y recursos digitales para investigación.",
  };
  return mapa[area] ||
    "Aula con organización flexible (grupos de 4-5 estudiantes), espacio para exposiciones y trabajo colaborativo. Se habilitarán espacios fuera del aula (biblioteca, patio, sala de tecnología) según las necesidades de cada actividad.";
};

const generarContenidosClasificados = (area, tema) => {
  const bases = {
    "Inglés": {
      conceptuales: [
        `Vocabulario esencial de "${tema}"`,
        "Estructuras gramaticales básicas del tema",
        "Expresiones y frases comunicativas del contexto",
        "Reglas de pronunciación y entonación",
      ],
      procedimentales: [
        `Producción oral y escrita sobre "${tema}"`,
        "Comprensión auditiva de textos del tema",
        "Lectura e interpretación de materiales auténticos",
        "Participación en intercambios comunicativos reales",
      ],
      actitudinales: [
        "Valoración del inglés como herramienta comunicativa global",
        "Disposición para comunicarse con confianza y respeto",
        "Apreciación de la diversidad cultural e intercultural",
        "Perseverancia y esfuerzo en la práctica del idioma",
      ],
    },
    "Lengua Española": {
      conceptuales: [
        `Características del género textual relacionado con "${tema}"`,
        "Estructura y propósito comunicativo del texto",
        "Recursos lingüísticos: cohesión y coherencia",
        `Vocabulario específico de "${tema}"`,
      ],
      procedimentales: [
        "Planificación, redacción y revisión de textos",
        "Comprensión e interpretación de lecturas diversas",
        "Participación efectiva en situaciones de comunicación oral",
        "Uso correcto de normativa ortográfica y gramatical",
      ],
      actitudinales: [
        "Valoración de la lectura como fuente de conocimiento y placer",
        "Responsabilidad en la comunicación efectiva",
        "Respeto por la diversidad lingüística y cultural",
        "Creatividad en la expresión personal escrita y oral",
      ],
    },
    "Matemática": {
      conceptuales: [
        `Conceptos matemáticos de "${tema}"`,
        "Propiedades y relaciones numéricas del contenido",
        "Terminología matemática específica",
        "Algoritmos y procedimientos formales",
      ],
      procedimentales: [
        "Resolución de problemas del entorno cotidiano",
        "Aplicación de algoritmos y estrategias de cálculo",
        "Representación gráfica de datos y resultados",
        "Verificación de resultados usando estimación",
      ],
      actitudinales: [
        "Confianza en las propias capacidades matemáticas",
        "Perseverancia ante problemas desafiantes",
        "Valoración de la matemática en la vida cotidiana",
        "Trabajo colaborativo y respeto por los aportes ajenos",
      ],
    },
    "Ciencias de la Naturaleza": {
      conceptuales: [
        `Conceptos científicos de "${tema}"`,
        "Procesos y fenómenos naturales del contenido",
        "Terminología científica específica del área",
        "Teorías y modelos explicativos",
      ],
      procedimentales: [
        "Observación y registro de fenómenos naturales",
        "Diseño y realización de experimentos sencillos",
        "Análisis e interpretación de datos científicos",
        "Elaboración de informes de investigación",
      ],
      actitudinales: [
        "Curiosidad y asombro ante los fenómenos naturales",
        "Respeto y cuidado del medio ambiente",
        "Rigor y honestidad en el trabajo científico",
        "Valoración del método científico como herramienta de conocimiento",
      ],
    },
    "Ciencias Sociales": {
      conceptuales: [
        `Conceptos históricos y sociales de "${tema}"`,
        "Procesos culturales, políticos y económicos del contenido",
        "Cronología y ubicación espacio-temporal",
        "Relaciones causa-efecto en los procesos sociales",
      ],
      procedimentales: [
        "Análisis de fuentes primarias y secundarias",
        "Construcción de líneas de tiempo y mapas históricos",
        "Debate y argumentación sobre temas sociales",
        "Elaboración de informes y síntesis históricas",
      ],
      actitudinales: [
        "Valoración del patrimonio cultural y la identidad",
        "Respeto por la diversidad cultural y social",
        "Pensamiento crítico ante los hechos históricos",
        "Compromiso con los valores democráticos y la ciudadanía",
      ],
    },
  };
  if (bases[area]) return bases[area];
  return {
    conceptuales: [
      `Conceptos esenciales de "${tema}"`,
      `Principios y definiciones del área de ${area}`,
      "Vocabulario técnico y especializado del contenido",
    ],
    procedimentales: [
      `Aplicación de conocimientos sobre "${tema}"`,
      "Producción de trabajos y proyectos del área",
      "Investigación y organización de información",
    ],
    actitudinales: [
      `Valoración de la importancia de "${tema}" en la vida cotidiana`,
      "Responsabilidad en el cumplimiento de compromisos académicos",
      "Respeto y colaboración en actividades grupales",
    ],
  };
};

// ─── Título del día ──────────────────────────────────────────────────────────

const TITULOS_DIA = {
  diagnostica: [
    (t) => `Exploración inicial — ¿Qué sé sobre "${t}"?`,
    (t) => `Reconocimiento de vocabulario y conceptos clave de "${t}"`,
    (t) => `Activación de saberes previos sobre "${t}"`,
    (t) => `Contextualización y presentación de la unidad: "${t}"`,
    (t) => `Presentación de la situación de aprendizaje de "${t}"`,
  ],
  inicial: [
    (t) => `Introducción y presentación de "${t}"`,
    (t) => `Vocabulario y conceptos fundamentales de "${t}"`,
    (t) => `Exploración y modelado del tema "${t}"`,
    (t) => `Práctica inicial guiada sobre "${t}"`,
    (t) => `Primera producción sobre "${t}"`,
  ],
  desarrollo: [
    (t) => `Profundización en "${t}"`,
    (t) => `Práctica colaborativa sobre "${t}"`,
    (t) => `Construcción y aplicación de "${t}"`,
    (t) => `Producción y socialización sobre "${t}"`,
    (t) => `Integración de habilidades de "${t}"`,
  ],
  profundizacion: [
    (t) => `Aplicación avanzada de "${t}"`,
    (t) => `Producción autónoma sobre "${t}"`,
    (t) => `Avances y retroalimentación de "${t}"`,
    (t) => `Consolidación de aprendizajes de "${t}"`,
    (t) => `Preparación del producto final de "${t}"`,
  ],
  final: [
    (t) => `Presentación del producto final — "${t}"`,
    (t) => `Coevaluación y retroalimentación sobre "${t}"`,
    (t) => `Síntesis y reflexión final de "${t}"`,
    (t) => `Celebración de logros y cierre de "${t}"`,
    (t) => `Evaluación final y metacognición de "${t}"`,
  ],
};

const generarTituloDia = (diaNum, fase, tema) => {
  const variantes = TITULOS_DIA[fase] || TITULOS_DIA.desarrollo;
  return variantes[(diaNum - 1) % variantes.length](tema);
};

// ─── Intención pedagógica del día ────────────────────────────────────────────

const INTENCIONES_DIA = {
  diagnostica: [
    (t, _c) => `Desde el inicio hasta el final de la clase, los estudiantes explorarán sus conocimientos previos sobre "${t}" mediante observación de imágenes, preguntas diagnósticas y actividades de activación, identificando lo que saben y estableciendo la base para el aprendizaje de la unidad.`,
    (t, _c) => `Desde el inicio hasta el final de la clase, los estudiantes se familiarizarán con el vocabulario y los conceptos clave de "${t}" mediante lluvia de ideas, observación y clasificación de términos, conectando el contenido con sus experiencias cotidianas.`,
    (t, _c) => `Desde el inicio hasta el final de la clase, los estudiantes activarán sus saberes previos sobre "${t}" mediante diálogo guiado, exploración de materiales y respuesta a preguntas clave, identificando los puntos de partida para su proceso de aprendizaje.`,
    (t, _c) => `Desde el inicio hasta el final de la clase, los estudiantes conocerán la unidad de aprendizaje "${t}" mediante la presentación del contexto, la situación de aprendizaje y los criterios de evaluación que guiarán el proceso durante la unidad.`,
    (t, _c) => `Desde el inicio hasta el final de la clase, los estudiantes explorarán la situación de aprendizaje de "${t}" mediante análisis de imágenes, respuesta a preguntas motivadoras y producción oral inicial, estableciendo la intención y el propósito de la unidad.`,
  ],
  inicial: [
    (t, c) => `Desde el inicio hasta el final de la clase, los estudiantes se introducirán en "${t}" mediante presentación modelada del docente, trabajo en parejas y práctica guiada, desarrollando una comprensión inicial del tema y la competencia de ${c}.`,
    (t, _c) => `Desde el inicio hasta el final de la clase, los estudiantes explorarán el vocabulario y los conceptos fundamentales de "${t}" mediante observación, análisis de ejemplos y producción oral inicial, construyendo la base conceptual para las próximas sesiones.`,
    (t, c) => `Desde el inicio hasta el final de la clase, los estudiantes trabajarán con los elementos clave de "${t}" mediante modelado, práctica colaborativa y producción guiada, fortaleciendo su comprensión del contenido y la competencia de ${c}.`,
    (t, _c) => `Desde el inicio hasta el final de la clase, los estudiantes practicarán de forma guiada los contenidos de "${t}" mediante ejercicios progresivos, retroalimentación inmediata y producción inicial, consolidando el vocabulario y las estructuras trabajadas.`,
    (t, _c) => `Desde el inicio hasta el final de la clase, los estudiantes realizarán una primera producción sobre "${t}" mediante actividades de aplicación guiada y socialización oral, transfiriendo los aprendizajes iniciales a situaciones concretas.`,
  ],
  desarrollo: [
    (t, _c) => `Desde el inicio hasta el final de la clase, los estudiantes profundizarán en "${t}" mediante producción oral, interacción colaborativa y escritura guiada, utilizando los conceptos trabajados para comunicarse en situaciones concretas y significativas.`,
    (t, c) => `Desde el inicio hasta el final de la clase, los estudiantes aplicarán sus conocimientos sobre "${t}" mediante trabajo cooperativo, producción escrita y socialización oral, fortaleciendo la competencia de ${c} a través de actividades contextualizadas.`,
    (t, _c) => `Desde el inicio hasta el final de la clase, los estudiantes construirán conocimientos sobre "${t}" mediante comprensión oral, análisis de ejemplos y producción guiada, desarrollando habilidades que puedan aplicar en contextos reales.`,
    (t, _c) => `Desde el inicio hasta el final de la clase, los estudiantes integrarán habilidades sobre "${t}" mediante actividades de producción, retroalimentación entre pares y reflexión grupal, consolidando los aprendizajes y avanzando hacia el producto final.`,
    (t, c) => `Desde el inicio hasta el final de la clase, los estudiantes trabajarán de forma colaborativa sobre "${t}" mediante resolución de situaciones problema, producción grupal y presentación oral, demostrando avance en la competencia de ${c}.`,
  ],
  profundizacion: [
    (t, c) => `Desde el inicio hasta el final de la clase, los estudiantes aplicarán de forma autónoma sus aprendizajes sobre "${t}" mediante producción escrita, presentación oral y retroalimentación entre pares, demostrando dominio de la competencia de ${c}.`,
    (t, _c) => `Desde el inicio hasta el final de la clase, los estudiantes consolidarán sus aprendizajes sobre "${t}" mediante análisis crítico, producción avanzada y coevaluación, preparándose para la presentación del producto final de la unidad.`,
    (t, _c) => `Desde el inicio hasta el final de la clase, los estudiantes presentarán los avances de su producción sobre "${t}" mediante exposición oral, retroalimentación entre pares y ajuste de sus trabajos, acercándose al producto final.`,
    (t, _c) => `Desde el inicio hasta el final de la clase, los estudiantes profundizarán en los aspectos clave de "${t}" mediante discusión crítica, producción escrita y socialización, integrando todos los aprendizajes desarrollados durante la unidad.`,
    (t, _c) => `Desde el inicio hasta el final de la clase, los estudiantes prepararán el producto final sobre "${t}" mediante planificación, producción organizada y revisión entre pares, aplicando todos los conocimientos y habilidades desarrollados.`,
  ],
  final: [
    (t, _c) => `Desde el inicio hasta el final de la clase, los estudiantes presentarán el producto final de la unidad sobre "${t}" mediante exposición, coevaluación y reflexión metacognitiva, demostrando el logro de las competencias desarrolladas durante la unidad.`,
    (t, _c) => `Desde el inicio hasta el final de la clase, los estudiantes evaluarán y reflexionarán sobre sus aprendizajes de "${t}" mediante coevaluación, autoevaluación y retroalimentación del docente, identificando sus logros y áreas de mejora.`,
    (t, _c) => `Desde el inicio hasta el final de la clase, los estudiantes sintetizarán y socializarán sus aprendizajes sobre "${t}" mediante presentación oral, retroalimentación entre pares y reflexión final, cerrando el proceso de aprendizaje de la unidad.`,
    (t, _c) => `Desde el inicio hasta el final de la clase, los estudiantes celebrarán los logros alcanzados en la unidad sobre "${t}" mediante socialización de productos, reconocimiento del esfuerzo colectivo y reflexión metacognitiva sobre el proceso vivido.`,
    (t, _c) => `Desde el inicio hasta el final de la clase, los estudiantes completarán el proceso de evaluación de "${t}" mediante presentación, coevaluación y metacognición, reconociendo el valor de los aprendizajes en su desarrollo personal y académico.`,
  ],
};

const generarIntencionPedagogicaDia = (diaNum, fase, tema, competencia) => {
  const variantes = INTENCIONES_DIA[fase] || INTENCIONES_DIA.desarrollo;
  return variantes[(diaNum - 1) % variantes.length](tema, competencia);
};

// ─── Actividades por momento ─────────────────────────────────────────────────

const VARIACIONES_INICIO = [
  [
    "Participan en el saludo e indicaciones iniciales.",
    "Revisan brevemente los aprendizajes desarrollados en la sesión anterior.",
    "Responden preguntas diagnósticas para activar sus conocimientos previos sobre el tema.",
    "Conocen la intención pedagógica y el propósito de aprendizaje del día.",
  ],
  [
    "Participan en el saludo e indicaciones iniciales.",
    "Observan imágenes o situaciones relacionadas con el tema para contextualizar el contenido.",
    "Comparten ideas sobre lo que saben del tema mediante una lluvia de ideas colectiva.",
    "Conocen la intención pedagógica y el propósito de la clase.",
  ],
  [
    "Participan en el saludo e indicaciones iniciales.",
    "Observan un video corto, imagen o canción relacionada con el tema de la clase.",
    "Realizan activación o exploración de saberes previos respondiendo preguntas de sondeo.",
    "Conocen la intención pedagógica y el propósito de aprendizaje de la sesión.",
  ],
  [
    "Participan en el saludo e indicaciones iniciales.",
    "Revisan la tarea o el producto generado en la sesión anterior.",
    "Identifican colectivamente lo que ya saben y lo que necesitan aprender sobre el tema.",
    "Conocen la intención pedagógica y el propósito de aprendizaje de la clase.",
  ],
];

const VARIACIONES_DESARROLLO = [
  [
    "Observan y analizan el contenido presentado mediante recursos variados (imágenes, textos, videos).",
    "Trabajan en parejas para discutir y relacionar el material de apoyo.",
    "Construyen esquemas, mapas conceptuales o líneas de tiempo sobre el tema.",
    "Practican de forma guiada con retroalimentación inmediata del docente.",
    "Registran sus aprendizajes de manera organizada en el cuaderno de trabajo.",
  ],
  [
    "Participan en una actividad colaborativa organizada en grupos de 4 a 5 integrantes.",
    "Investigan y exploran el contenido utilizando materiales de apoyo disponibles en el aula.",
    "Producen un borrador o primer intento del producto de la sesión.",
    "Socializan sus avances parciales con los demás grupos del salón.",
    "Incorporan los ajustes sugeridos a partir de la retroalimentación recibida.",
  ],
  [
    "Leen, observan o experimentan directamente con el tema central de la clase.",
    "Analizan críticamente ejemplos y contraejemplos relacionados con el contenido.",
    "Producen de forma individual mientras reciben acompañamiento del docente.",
    "Intercambian sus producciones entre pares y se retroalimentan mutuamente.",
    "Incorporan mejoras a su trabajo a partir de los comentarios recibidos.",
  ],
  [
    "Aplican sus conocimientos en situaciones concretas tomadas de su entorno.",
    "Trabajan en equipo para resolver problemas o desafíos relacionados con el tema.",
    "Utilizan tecnología disponible o materiales manipulativos para enriquecer su aprendizaje.",
    "Presentan parcialmente sus resultados y producciones al resto del grupo.",
    "Documentan el proceso y los aprendizajes generados en el cuaderno de trabajo.",
  ],
];

const VARIACIONES_CIERRE = [
  [
    "Participan en una síntesis colectiva de los aprendizajes clave de la sesión.",
    "Socializan los productos o evidencias generadas durante el desarrollo de la clase.",
    "Ofrecen y reciben retroalimentación constructiva entre pares y con el docente.",
    "Registran compromisos o tareas relacionadas con el tema para la próxima sesión.",
  ],
  [
    "Reflexionan respondiendo: ¿Qué aprendimos hoy? ¿Cómo lo aprendimos?",
    "Revisan el logro del propósito planteado al inicio de la sesión.",
    "Responden preguntas de cierre para consolidar la comprensión del contenido.",
    "Anticipan los temas y actividades que se desarrollarán en la próxima clase.",
  ],
  [
    "Completan un organizador gráfico de síntesis del contenido trabajado en la sesión.",
    "Comparten en una frase lo más importante que aprendieron.",
    "Realizan una breve autoevaluación de su participación y desempeño en la clase.",
    "Anotan en el cuaderno los próximos pasos de su proceso de aprendizaje.",
  ],
  [
    "Reflexionan sobre lo aprendido: ¿Qué fue lo más interesante? ¿Qué necesitan repasar?",
    "Reciben retroalimentación oral del docente sobre el desempeño general del grupo.",
    "Conectan el aprendizaje con situaciones de la vida real: ¿Cómo pueden aplicar lo aprendido?",
    "Celebran los logros alcanzados y reconocen el esfuerzo colectivo del grupo.",
  ],
];

const elegirVariacion = (arreglo, semana, dia) =>
  arreglo[((semana - 1) * 5 + (dia - 1)) % arreglo.length];

const calcularTiemposMomento = (totalMin) => {
  if (totalMin >= 80) {
    // Doble período: más tiempo en todos los momentos
    const inicio    = 15;
    const cierre    = 15;
    const desarrollo = totalMin - inicio - cierre;
    return { Inicio: `${inicio} min`, Desarrollo: `${desarrollo} min`, Cierre: `${cierre} min` };
  }
  // Período simple (45 ó 50 min)
  const inicio    = 10;
  const cierre    = totalMin >= 50 ? 8 : 5;
  const desarrollo = totalMin - inicio - cierre;
  return { Inicio: `${inicio} min`, Desarrollo: `${desarrollo} min`, Cierre: `${cierre} min` };
};

const METACOGNICION_POR_MOMENTO = {
  Inicio: [
    "¿Qué sé sobre este tema? ¿Qué espero aprender hoy?",
    "¿Cómo se relaciona este contenido con algo que ya conozco?",
    "¿Por qué es importante lo que vamos a aprender en esta sesión?",
    "¿Qué preguntas tengo antes de comenzar la clase de hoy?",
  ],
  Desarrollo: [
    "¿Cómo estoy comprendiendo el tema? ¿Qué parte me resulta más difícil?",
    "¿Qué estrategia me está ayudando más a aprender este contenido?",
    "¿Puedo explicar con mis propias palabras lo que aprendí hasta ahora?",
    "¿Qué conexiones encuentro entre este contenido y mi vida cotidiana?",
  ],
  Cierre: [
    `¿Qué aprendimos hoy sobre ${""} el tema trabajado?`,
    "¿Qué estrategia me funcionó mejor para comprender el contenido?",
    "¿En qué situaciones de mi vida puedo aplicar lo que aprendí hoy?",
    "¿Qué necesito repasar o reforzar para la próxima clase?",
  ],
};

const construirMomento = (tipo, semana, dia, tema, tipoEval, totalMin = 45) => {
  const tiempos = calcularTiemposMomento(totalMin);
  const instrumentosMapa = {
    diagnostica: { Inicio: "Prueba diagnóstica", Desarrollo: "Observación sistemática", Cierre: "Lista de participación" },
    formativa:   { Inicio: "Lista de participación", Desarrollo: "Rúbrica analítica", Cierre: "Registro anecdótico" },
    sumativa:    { Inicio: "Lista de cotejo", Desarrollo: "Rúbrica sumativa", Cierre: "Portafolio / Presentación" },
  };
  const instrumento = instrumentosMapa[tipoEval]?.[tipo] || "Observación";
  let variaciones;
  if (tipo === "Inicio")          variaciones = VARIACIONES_INICIO;
  else if (tipo === "Desarrollo") variaciones = VARIACIONES_DESARROLLO;
  else                            variaciones = VARIACIONES_CIERRE;
  const actividades = elegirVariacion(variaciones, semana, dia);

  const metaVariantes = METACOGNICION_POR_MOMENTO[tipo] || METACOGNICION_POR_MOMENTO.Cierre;
  const metacognicion = tipo === "Cierre"
    ? [
        `Reflexionan: ¿Qué aprendimos hoy sobre "${tema.substring(0, 40)}"?`,
        "¿Qué estrategia les funcionó mejor para comprender el contenido?",
        "¿En qué situaciones de la vida cotidiana pueden aplicar lo aprendido?",
      ]
    : [metaVariantes[((semana - 1) * 5 + (dia - 1)) % metaVariantes.length]];

  return {
    tipo,
    tiempo: tiempos[tipo],
    actividades,
    instrumento,
    evaluacion: { tipo: tipoEval, tecnica: "Observación sistemática", instrumento },
    metacognicion,
  };
};

// ─── NEAE por semana ─────────────────────────────────────────────────────────

const generarNEAESemana = (semana, totalSemanas) => {
  const fase = semana === 1 ? "inicio" : semana === totalSemanas ? "final" : "desarrollo";
  const variantes = {
    inicio: {
      acceso: [
        "Proveer instrucciones orales y escritas simultáneamente.",
        "Ofrecer materiales en formatos alternativos (visual, auditivo).",
        "Sentar al estudiante en área de menor distracción.",
      ],
      curricular: [
        "Reducir cantidad de indicadores si es necesario.",
        "Priorizar contenidos esenciales del tema.",
        "Ofrecer activadores visuales previos a la clase.",
      ],
      evaluacion: [
        "Realizar evaluación diagnóstica diferenciada.",
        "Aceptar respuestas orales como alternativa a las escritas.",
        "Ampliar tiempo de la prueba en 25-50%.",
      ],
    },
    desarrollo: {
      acceso: [
        "Asignar compañero tutor para apoyo entre pares.",
        "Proveer organizadores gráficos y guías de apoyo.",
        "Permitir uso de diccionario u otros recursos autorizados.",
      ],
      curricular: [
        "Adaptar complejidad de las actividades manteniendo significatividad.",
        "Ofrecer opciones múltiples para demostrar aprendizajes.",
        "Reducir cantidad de ejercicios manteniendo la esencia del contenido.",
      ],
      evaluacion: [
        "Evaluar el proceso y no solo el producto final.",
        "Usar listas de cotejo con criterios claros y accesibles.",
        "Permitir tiempo adicional para completar tareas evaluativas.",
      ],
    },
    final: {
      acceso: [
        "Proveer el instrumento de evaluación con antelación.",
        "Permitir condiciones especiales (espacio tranquilo, tiempo extra).",
        "Usar formato de evaluación alternativo si es necesario.",
      ],
      curricular: [
        "Evaluar los indicadores mínimos esenciales.",
        "Ofrecer opción de presentación oral en lugar de escrita.",
        "Adaptar el producto final según necesidades individuales.",
      ],
      evaluacion: [
        "Coevaluar con el estudiante los criterios de logro.",
        "Registrar avances cualitativos además de cuantitativos.",
        "Planificar apoyo adicional para la siguiente unidad si es necesario.",
      ],
    },
  };
  return variantes[fase] || variantes.desarrollo;
};

// ─── Evidencias de aprendizaje por semana ────────────────────────────────────

const generarEvidenciasSemana = (area, tema, semana, totalSemanas) => {
  const fase = semana === 1 ? "diagnostica" : semana === totalSemanas ? "final" : "desarrollo";
  const mapa = {
    diagnostica: {
      conocimientosPrevios: [
        `Saberes previos relacionados con "${tema}" desde la experiencia cotidiana.`,
        "Vocabulario y conceptos ya conocidos por los estudiantes sobre el tema.",
        "Experiencias personales y familiares relacionadas con el contenido.",
      ],
      desempenoEsperado: [
        `Identifica y menciona elementos relacionados con "${tema}".`,
        "Expresa de forma oral o escrita lo que sabe sobre el contenido.",
        "Participa activamente en las actividades diagnósticas de la sesión.",
      ],
      productoElaborar: [
        `Registro escrito de conocimientos previos sobre "${tema}".`,
        "Mapa mental o lluvia de ideas inicial en el cuaderno.",
        "Diagnóstico inicial documentado por el docente.",
      ],
    },
    desarrollo: {
      conocimientosPrevios: [
        `Conceptos y vocabulario presentados en sesiones anteriores sobre "${tema}".`,
        "Habilidades desarrolladas en la fase inicial de la unidad.",
        "Comprensión básica de los contenidos conceptuales y procedimentales.",
      ],
      desempenoEsperado: [
        `Aplica los conceptos de "${tema}" en situaciones concretas.`,
        "Trabaja colaborativamente para construir y socializar evidencias.",
        "Demuestra comprensión mediante producción oral, escrita o gráfica.",
      ],
      productoElaborar: [
        `Producción escrita o gráfica relacionada con "${tema}".`,
        "Trabajo cooperativo grupal documentado y socializado.",
        "Cuaderno de trabajo con actividades completadas y organizadas.",
      ],
    },
    final: {
      conocimientosPrevios: [
        `Todos los conceptos y habilidades trabajados sobre "${tema}" en la unidad.`,
        "Estrategias y técnicas desarrolladas durante el proceso de aprendizaje.",
        "Producción acumulada y reflexión desarrollada en sesiones anteriores.",
      ],
      desempenoEsperado: [
        `Presenta el producto final demostrando dominio integral de "${tema}".`,
        "Evalúa crítica y respetuosamente su propio desempeño y el de sus pares.",
        "Sintetiza y comunica los aprendizajes clave de la unidad.",
      ],
      productoElaborar: [
        `Producto final de la unidad sobre "${tema}" presentado ante el grupo.`,
        "Portfolio o recopilación de evidencias del proceso completo.",
        "Autoevaluación y coevaluación documentadas.",
      ],
    },
  };
  return mapa[fase] || mapa.desarrollo;
};

// ─── Materiales y recursos por semana ────────────────────────────────────────

const generarMaterialesSemana = (area, fase) => {
  const basePorArea = {
    "Inglés":                    ["Flashcards de vocabulario", "Audios y videos auténticos", "Fichas de práctica comunicativa", "Diccionario bilingüe", "Cuaderno de trabajo"],
    "Lengua Española":           ["Textos impresos variados", "Cuaderno de escritura", "Diccionario RAE", "Fichas de comprensión lectora", "Material de biblioteca"],
    "Matemática":                ["Material manipulativo (fichas, bloques)", "Hoja cuadriculada", "Calculadora (si aplica)", "Reglas y compás", "Fichas de ejercicios"],
    "Ciencias de la Naturaleza": ["Materiales de experimento", "Cuaderno científico", "Láminas del entorno", "Lupa y materiales naturales", "Fichas de observación"],
    "Ciencias Sociales":         ["Mapa mural o impreso", "Línea de tiempo", "Textos históricos", "Fichas de investigación", "Material audiovisual"],
  };
  const generales = ["Marcadores de pizarrón", "Papel bond o cartulina", "Lápices de colores", "Tijeras y pegamento", "Cuaderno de trabajo"];
  return {
    impresos: basePorArea[area] || generales,
    digitales: ["Proyector o pizarrón digital", "Presentación en diapositivas", "Videos educativos seleccionados", "Recursos interactivos en línea"],
    otros: fase === "final"
      ? ["Espacio preparado para presentaciones", "Sillas organizadas para el público", "Mesa de exposición"]
      : ["Aula en disposición de grupos cooperativos (4-5 por grupo)", "Materiales disponibles en los rincones de trabajo"],
  };
};

// ─── Evaluación por semana ────────────────────────────────────────────────────

const generarEvaluacionSemana = (tipoEval, _fase) => {
  const tecnicas = {
    diagnostica: ["Preguntas exploratorias", "Lluvia de ideas", "Observación directa"],
    formativa:   ["Observación sistemática", "Trabajo práctico", "Participación activa"],
    sumativa:    ["Presentación del producto final", "Coevaluación", "Autoevaluación"],
  };
  const instrumentos = {
    diagnostica: ["Guía de preguntas diagnósticas", "Lista de cotejo inicial", "Registro anecdótico"],
    formativa:   ["Lista de cotejo", "Rúbrica analítica", "Registro de participación"],
    sumativa:    ["Rúbrica holística", "Lista de cotejo final", "Portafolio"],
  };
  const criterios = {
    diagnostica: [
      "Participa activamente en las actividades diagnósticas.",
      "Expresa conocimientos previos de forma oral o escrita.",
      "Muestra disposición y actitud positiva para el aprendizaje.",
    ],
    formativa: [
      "Comprende y aplica los conceptos trabajados en la sesión.",
      "Trabaja de forma colaborativa con respeto y responsabilidad.",
      "Produce evidencias de aprendizaje con calidad y organización.",
    ],
    sumativa: [
      "Demuestra dominio del contenido en el producto final presentado.",
      "Comunica sus aprendizajes con claridad, organización y seguridad.",
      "Reflexiona críticamente sobre su proceso y valora sus logros.",
    ],
  };
  return {
    tipo: tipoEval,
    tecnicas: tecnicas[tipoEval] || tecnicas.formativa,
    instrumentos: instrumentos[tipoEval] || instrumentos.formativa,
    criterios: criterios[tipoEval] || criterios.formativa,
  };
};

// ─── Fases de semana ─────────────────────────────────────────────────────────

const FASES = {
  diagnostica:    { titulo: "Exploración y saberes previos",            proposito: "Explorar conocimientos previos y detectar necesidades de aprendizaje" },
  inicial:        { titulo: "Presentación y motivación",                proposito: "Presentar el tema central y despertar el interés de los estudiantes" },
  desarrollo:     { titulo: "Construcción activa del conocimiento",     proposito: "Construir conocimientos y desarrollar competencias mediante actividades participativas" },
  profundizacion: { titulo: "Profundización e integración",             proposito: "Aplicar y profundizar los aprendizajes en situaciones más complejas" },
  final:          { titulo: "Evaluación, síntesis y cierre",            proposito: "Evaluar el desempeño, sintetizar aprendizajes y reflexionar sobre la trayectoria vivida" },
};

const determinarFase = (semana, total) => {
  if (semana === 1)           return "diagnostica";
  if (semana === 2)           return "inicial";
  if (semana === total)       return "final";
  if (semana === total - 1)   return "profundizacion";
  return "desarrollo";
};

const determinarTipoEval = (semana, total) => {
  if (semana === 1)     return TIPO_EVAL.DIAGNOSTICA;
  if (semana === total) return TIPO_EVAL.SUMATIVA;
  return TIPO_EVAL.FORMATIVA;
};

// ─── Generación del desarrollo semanal ───────────────────────────────────────

const generarDesarrolloSemanal = ({
  semanas,
  tema,
  area: _area = "",
  competencia,
  diasNombres,
  minutosHoraClase = 45,
  periodosClasePorDia = {},
  temasDistribuidos = [],   // [{ tema, semanaInicio, semanaFin }] — combinación curricular
}) => {
  const dias = diasNombres.length > 0
    ? diasNombres
    : ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

  const esCombinada = Array.isArray(temasDistribuidos) && temasDistribuidos.length > 1;

  return Array.from({ length: semanas }, (_, i) => {
    const n = i + 1;
    const fase = determinarFase(n, semanas);
    const tipoEval = determinarTipoEval(n, semanas);
    const faseInfo = FASES[fase] || FASES.desarrollo;

    // Tema específico de esta semana (si la unidad es combinada)
    const temaSemana = esCombinada
      ? (obtenerTemaSemana(n, temasDistribuidos) || tema)
      : tema;

    const diasSemana = dias.map((nombre, di) => {
      const diaNum  = di + 1;
      const periodos = periodosClasePorDia[nombre] || 1;
      const totalMin = minutosHoraClase * periodos;
      return {
        n: diaNum,
        nombre,
        periodos,
        totalMin,
        tipoEval,
        tituloDia: generarTituloDia(diaNum, fase, temaSemana),
        intencionPedagogica: generarIntencionPedagogicaDia(diaNum, fase, temaSemana, competencia),
        momentos: [
          construirMomento("Inicio",     n, diaNum, temaSemana, tipoEval, totalMin),
          construirMomento("Desarrollo", n, diaNum, temaSemana, tipoEval, totalMin),
          construirMomento("Cierre",     n, diaNum, temaSemana, tipoEval, totalMin),
        ],
      };
    });

    return {
      n,
      fase,
      tipoEval,
      temaSemana,  // tema curricular específico de esta semana
      titulo: esCombinada
        ? `Semana ${n}: ${faseInfo.titulo} — ${temaSemana}`
        : `Semana ${n}: ${faseInfo.titulo}`,
      proposito: `${faseInfo.proposito} sobre "${temaSemana}"`,
      competenciasTrabajadasSemana: competencia,
      dias: diasSemana,
      evidenciasSemana: null,
      materialesSemana: null,
      evaluacionSemana: null,
      adecuacionesNEAE: generarNEAESemana(n, semanas),
      productoSemanal: `Evidencia de ${faseInfo.titulo.toLowerCase()} — Semana ${n}`,
    };
  });
};

// ─── Función principal ───────────────────────────────────────────────────────

const generarPlanificacion = async (datos) => {
  validarDatosPlanificacion(datos);

  const {
    tema, grado, seccion, area, periodo,
    asignatura = "",
    indicadoresOficiales,
    imagenTematicaSrc = "",
    imagenTematicaNombre = "",
    ejesTematicos = [],
    asignaturasVinculadas = "",
    situacionAprendizaje = "",
    minutosHoraClase = 45,
    periodosClasePorDia = {},
  } = datos;

  // Para lookups de contenido usa la asignatura si existe en el diccionario; si no, usa el área
  const claveArea = resolverClave(asignatura, area, EJES_DEFAULT);

  const curso            = datos.curso || [grado, seccion].filter(Boolean).join(" ").trim();
  const duracionSemanas  = normalizarDuracionSemanas(datos.duracion);
  const competencia      = datos.competencia || "";
  const diasClase        = Array.isArray(datos.diasClase) && datos.diasClase.length > 0
    ? datos.diasClase
    : ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

  const indicadoresProcesados = indicadoresOficiales.split("\n").map(i => i.trim()).filter(Boolean);

  // Combinación curricular: distribuir temas integrados en semanas (regla 5+ semanas)
  const temasIntegrados  = Array.isArray(datos.temasIntegrados) ? datos.temasIntegrados : [];
  const temasDistribuidos = temasIntegrados.length > 1
    ? distribuirTemasEnSemanas(temasIntegrados, duracionSemanas)
    : [];

  // Auto-generación de campos contextuales
  const situacionFinal   = situacionAprendizaje.trim() || generarSituacionAprendizaje(claveArea, grado, tema, competencia);
  const ambienteFinal    = generarAmbienteAprendizaje(claveArea);
  const ejesFinal        = ejesTematicos.length > 0 ? ejesTematicos : (EJES_DEFAULT[claveArea] || ["Ciudadanía y Convivencia"]);
  const asignaturasFinal = asignaturasVinculadas.trim()
    ? asignaturasVinculadas.split(",").map(a => a.trim()).filter(Boolean)
    : (ASIGNATURAS_VINCULADAS_DEFAULT[claveArea] || ["Lengua Española"]);
  const contenidosFinal  = generarContenidosClasificados(claveArea, tema);

  const desarrollo = generarDesarrolloSemanal({ semanas: duracionSemanas, tema, area: claveArea, competencia, diasNombres: diasClase, minutosHoraClase, periodosClasePorDia, temasDistribuidos });

  desarrollo.forEach(sem => {
    sem.evidenciasSemana = generarEvidenciasSemana(claveArea, tema, sem.n, duracionSemanas);
    sem.materialesSemana = generarMaterialesSemana(claveArea, sem.fase);
    sem.evaluacionSemana = generarEvaluacionSemana(sem.tipoEval || "formativa", sem.fase);
  });

  return {
    id: Date.now().toString(),
    metadatos: {
      fechaGeneracion: new Date().toISOString(),
      tema,
      curso,
      grado,
      seccion,
      area,
      periodo,
      duracion: datos.duracion || `${duracionSemanas} semanas`,
      duracionSemanas,
      fechaInicio: datos.fechaInicio || "",
      competenciaSeleccionada: competencia,
      indicadoresOficiales: indicadoresProcesados,
      tipoPlanificacion: datos.tipoPlanificacion || "",
      diasClase,
      nivelEducativo: datos.nivelEducativo || "",
      jornadaTipo: datos.jornadaTipo || "",
      resumenHorario: datos.resumenHorario || null,
      // Integración curricular (si aplica)
      temasIntegrados,
      temasDistribuidos,
      // Contexto enriquecido
      ejesTematicos: ejesFinal,
      asignaturasVinculadas: asignaturasFinal,
      situacionAprendizaje: situacionFinal,
      ambienteAprendizaje: ambienteFinal,
      // Configuración de tiempo
      minutosHoraClase,
      periodosClasePorDia,
    },
    portadaInstitucional: { titulo: tema, curso, periodo },
    datosGenerales: {
      tema,
      area,
      competencia,
      indicadoresOficiales: indicadoresProcesados,
      imagenTematica: imagenTematicaSrc,
      imagenTematicaNombre,
      contenidos: contenidosFinal,
      ejesTematicos: ejesFinal,
      asignaturasVinculadas: asignaturasFinal,
      situacionAprendizaje: situacionFinal,
      ambienteAprendizaje: ambienteFinal,
    },
    desarrolloSemanal: desarrollo,
    estado: "generada",
  };
};

// ─── PDF (texto plano, para impresión) ──────────────────────────────────────

const formatearParaPDF = (plan) => {
  let t = "";
  const meta = plan.metadatos || {};
  const datos = plan.datosGenerales || {};
  t += "PLANIFICACIÓN DIDÁCTICA MINERD\n";
  t += "=".repeat(60) + "\n\n";
  t += `Tema: ${meta.tema}\nGrado: ${meta.grado} ${meta.seccion}\nÁrea: ${meta.area}\nPeríodo: ${meta.periodo}\nDuración: ${meta.duracion}\n\n`;
  if (datos.situacionAprendizaje) t += `SITUACIÓN DE APRENDIZAJE\n${datos.situacionAprendizaje}\n\n`;
  if (Array.isArray(datos.indicadoresOficiales)) {
    t += "INDICADORES DE LOGRO\n";
    datos.indicadoresOficiales.forEach((ind, i) => { t += `${i + 1}. ${ind}\n`; });
    t += "\n";
  }
  if (plan.desarrolloSemanal) {
    plan.desarrolloSemanal.forEach(sem => {
      t += `-`.repeat(40) + `\n${sem.titulo}\n${sem.proposito}\n`;
      (sem.dias || []).forEach(dia => {
        t += `  ${dia.nombre || `Día ${dia.n}`}\n`;
        (dia.momentos || []).forEach(m => {
          t += `    ${m.tipo} (${m.tiempo})\n`;
          (m.actividades || []).forEach(a => { t += `      · ${a}\n`; });
        });
      });
      t += "\n";
    });
  }
  return t;
};

// ─── PDF HTML ────────────────────────────────────────────────────────────────

const formatearParaPDFHtml = (plan) => {
  const meta  = plan.metadatos    || {};
  const datos = plan.datosGenerales || {};
  const semanas = plan.desarrolloSemanal || [];

  const css = `
    body{font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:32px;background:#f5f5f5;color:#1a1a2e}
    .wrap{max-width:960px;margin:0 auto;background:#fff;padding:40px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.12)}
    h1{color:#1d4ed8;border-bottom:3px solid #1d4ed8;padding-bottom:12px;margin-bottom:8px}
    h2{color:#2563eb;background:#eff6ff;padding:10px 14px;border-left:4px solid #2563eb;margin-top:28px}
    h3{color:#374151;margin:16px 0 8px}
    .meta-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0;padding:14px;background:#f8fafc;border-radius:8px}
    .meta-item span{font-size:12px;color:#64748b;display:block}
    .meta-item strong{font-size:15px;color:#1e293b}
    .eje{display:inline-block;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:700;margin:4px;color:#fff}
    .eje-0{background:#7c3aed} .eje-1{background:#0284c7} .eje-2{background:#059669} .eje-3{background:#d97706}
    .situacion{background:#fffbeb;border:1px solid #fde68a;padding:14px;border-radius:8px;font-style:italic;line-height:1.6}
    .contenidos-3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
    .col-c{background:#eff6ff;border-top:3px solid #2563eb;padding:12px;border-radius:6px}
    .col-p{background:#f0fdf4;border-top:3px solid #059669;padding:12px;border-radius:6px}
    .col-a{background:#fef3c7;border-top:3px solid #d97706;padding:12px;border-radius:6px}
    .col-c h4,.col-p h4,.col-a h4{margin:0 0 8px;font-size:13px}
    ul{margin:0;padding-left:18px} li{margin:4px 0;font-size:13px;line-height:1.5}
    .semana-box{border:1px solid #e2e8f0;border-radius:10px;margin-bottom:24px;page-break-inside:avoid}
    .semana-head{background:#1d4ed8;color:#fff;padding:12px 16px;border-radius:10px 10px 0 0}
    .semana-head h3{margin:0;font-size:16px} .semana-head p{margin:4px 0 0;font-size:13px;opacity:0.85}
    .dias-wrap{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:1px;background:#e2e8f0}
    .dia-col{background:#fff;padding:12px}
    .dia-nombre{font-weight:700;font-size:13px;color:#1d4ed8;margin-bottom:8px;border-bottom:1px solid #e2e8f0;padding-bottom:6px}
    .momento-blk{margin:8px 0}
    .momento-tag{font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;display:inline-block;margin-bottom:4px}
    .m-inicio{background:#dbeafe;color:#1d4ed8} .m-desarrollo{background:#dcfce7;color:#15803d} .m-cierre{background:#fef3c7;color:#92400e}
    .momento-blk ul{margin:2px 0 2px 14px;padding:0} .momento-blk li{font-size:11px;margin:2px 0}
    .evidencias{padding:12px 16px;background:#f0fdf4;border-top:1px solid #e2e8f0}
    .neae-box{padding:12px 16px;background:#faf5ff;border-top:1px solid #e2e8f0;font-size:12px}
    @media print{.semana-box{page-break-inside:avoid}}
  `;

  let html = `<html><head><meta charset="UTF-8"><style>${css}</style></head><body><div class="wrap">`;
  html += `<h1>${datos.tema || "Planificación Didáctica"}</h1>`;
  html += `<div class="meta-grid">`;
  [
    ["Grado / Sección", `${meta.grado} ${meta.seccion}`],
    ["Área", meta.area],
    ["Período", meta.periodo],
    ["Duración", meta.duracion],
    ["Fecha inicio", meta.fechaInicio || "—"],
    ["Tipo", meta.tipoPlanificacion || "—"],
  ].forEach(([k, v]) => {
    html += `<div class="meta-item"><span>${k}</span><strong>${v || "—"}</strong></div>`;
  });
  html += `</div>`;

  if (Array.isArray(datos.ejesTematicos) && datos.ejesTematicos.length) {
    html += `<h2>Ejes Temáticos Transversales</h2><div>`;
    datos.ejesTematicos.forEach((e, i) => { html += `<span class="eje eje-${i % 4}">${e}</span>`; });
    html += `</div>`;
  }

  if (datos.situacionAprendizaje) {
    html += `<h2>Situación de Aprendizaje</h2><p class="situacion">${datos.situacionAprendizaje}</p>`;
  }

  if (datos.ambienteAprendizaje) {
    html += `<h2>Ambiente de Aprendizaje</h2><p>${datos.ambienteAprendizaje}</p>`;
  }

  html += `<h2>Competencia e Indicadores de Logro</h2>`;
  html += `<p><strong>Competencia:</strong> ${datos.competencia || "—"}</p>`;
  if (Array.isArray(datos.indicadoresOficiales) && datos.indicadoresOficiales.length) {
    html += `<ul>`;
    datos.indicadoresOficiales.forEach(ind => { html += `<li>${ind}</li>`; });
    html += `</ul>`;
  }

  if (datos.contenidos) {
    const c = datos.contenidos;
    html += `<h2>Contenidos</h2><div class="contenidos-3">`;
    html += `<div class="col-c"><h4>Conceptuales</h4><ul>${(c.conceptuales||[]).map(x=>`<li>${x}</li>`).join("")}</ul></div>`;
    html += `<div class="col-p"><h4>Procedimentales</h4><ul>${(c.procedimentales||[]).map(x=>`<li>${x}</li>`).join("")}</ul></div>`;
    html += `<div class="col-a"><h4>Actitudinales</h4><ul>${(c.actitudinales||[]).map(x=>`<li>${x}</li>`).join("")}</ul></div>`;
    html += `</div>`;
  }

  html += `<h2>Desarrollo Semanal</h2>`;
  semanas.forEach(sem => {
    html += `<div class="semana-box">`;
    html += `<div class="semana-head"><h3>${sem.titulo}</h3><p>${sem.proposito}</p></div>`;
    html += `<div class="dias-wrap">`;
    (sem.dias || []).forEach(dia => {
      html += `<div class="dia-col"><div class="dia-nombre">${dia.nombre || `Día ${dia.n}`}</div>`;
      (dia.momentos || []).forEach(m => {
        const cls = `m-${m.tipo.toLowerCase()}`;
        html += `<div class="momento-blk"><span class="momento-tag ${cls}">${m.tipo} ${m.tiempo}</span><ul>`;
        (m.actividades || []).forEach(a => { html += `<li>${a}</li>`; });
        html += `</ul></div>`;
      });
      html += `</div>`;
    });
    html += `</div>`;
    if (sem.evidenciasSemana?.length) {
      html += `<div class="evidencias"><strong>Evidencias:</strong><ul>`;
      sem.evidenciasSemana.forEach(e => { html += `<li>${e}</li>`; });
      html += `</ul></div>`;
    }
    if (sem.adecuacionesNEAE) {
      const n = sem.adecuacionesNEAE;
      html += `<div class="neae-box"><strong>NEAE — Acceso:</strong> ${(n.acceso||[]).join(" · ")} <strong>Curricular:</strong> ${(n.curricular||[]).join(" · ")}</div>`;
    }
    html += `</div>`;
  });

  html += `</div></body></html>`;
  return html;
};

export {
  generarPlanificacion,
  generarDesarrolloSemanal,
  formatearParaPDF,
  formatearParaPDFHtml,
  validarDatosPlanificacion,
};
