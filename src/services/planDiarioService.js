/* Servicio: Plan Diario MINERD */

// ─── Constantes curriculares ─────────────────────────────────────────────────

const COMPETENCIAS_FUNDAMENTALES = [
  "Comunicativa",
  "Pensamiento Lógico, Creativo y Crítico",
  "Científica y Tecnológica",
  "Desarrollo Personal y Espiritual",
  "Ética y Ciudadana",
];

const COMP_FUND_POR_AREA = {
  "Inglés":                                 ["Comunicativa", "Científica y Tecnológica"],
  "Lengua Española":                        ["Comunicativa", "Pensamiento Lógico, Creativo y Crítico"],
  "Matemática":                             ["Pensamiento Lógico, Creativo y Crítico", "Científica y Tecnológica"],
  "Ciencias de la Naturaleza":              ["Científica y Tecnológica", "Pensamiento Lógico, Creativo y Crítico"],
  "Ciencias Sociales":                      ["Ética y Ciudadana", "Pensamiento Lógico, Creativo y Crítico"],
  "Educación Física":                       ["Desarrollo Personal y Espiritual", "Ética y Ciudadana"],
  "Educación Artística":                    ["Comunicativa", "Desarrollo Personal y Espiritual"],
  "Formación Integral Humana y Religiosa":  ["Desarrollo Personal y Espiritual", "Ética y Ciudadana"],
  "Francés":                                ["Comunicativa", "Científica y Tecnológica"],
};

const ASIGNATURA_POR_AREA = {
  "Inglés":                                 "Inglés",
  "Lengua Española":                        "Lengua Española",
  "Matemática":                             "Matemática",
  "Ciencias de la Naturaleza":              "Ciencias de la Naturaleza",
  "Ciencias Sociales":                      "Ciencias Sociales",
  "Educación Física":                       "Educación Física",
  "Educación Artística":                    "Educación Artística",
  "Formación Integral Humana y Religiosa":  "F.I.H.R.",
  "Francés":                                "Francés",
};

// ─── Generadores de contenido ────────────────────────────────────────────────

const generarCompetenciaEspecifica = (area, grado) => {
  const mapa = {
    "Inglés":
      `Comprende y expresa ideas, sentimientos y valores culturales en distintas situaciones de comunicación, utilizando el idioma inglés de forma breve y sencilla con la finalidad de informar, describir y narrar experiencias, con relación a necesidades concretas y temas cotidianos.`,
    "Lengua Española":
      `Produce e interpreta textos orales y escritos con claridad, coherencia y pertinencia, reconociendo las funciones comunicativas del lenguaje en diferentes contextos sociales e interculturales, valorando la lengua española como vehículo de identidad y expresión cultural.`,
    "Matemática":
      `Resuelve problemas del entorno aplicando conceptos matemáticos con razonamiento lógico, creatividad y pensamiento crítico, comunicando sus procesos y resultados de manera clara y utilizando el lenguaje matemático apropiado.`,
    "Ciencias de la Naturaleza":
      `Investiga e interpreta fenómenos naturales utilizando el método científico, desarrollando pensamiento crítico y actitudes responsables hacia el cuidado del entorno, reconociendo la relación entre ciencia, tecnología, sociedad y ambiente.`,
    "Ciencias Sociales":
      `Analiza críticamente procesos históricos, geográficos y culturales de su entorno y del mundo, ejerciendo una ciudadanía activa, responsable y comprometida con la democracia, la equidad y el desarrollo sostenible.`,
    "Educación Física":
      `Desarrolla habilidades motrices, hábitos saludables y valores de convivencia mediante la práctica de actividades físicas y deportivas, promoviendo el bienestar físico, mental y social en contextos individuales y colectivos.`,
    "Educación Artística":
      `Crea, interpreta y aprecia expresiones artísticas diversas, desarrollando la sensibilidad estética, la creatividad y el pensamiento simbólico como medios de comunicación y construcción de identidad cultural.`,
    "Formación Integral Humana y Religiosa":
      `Desarrolla su identidad personal y espiritual mediante la reflexión ética, el diálogo intercultural y el compromiso con valores humanos universales que promueven la convivencia armónica y el bien común.`,
    "Francés":
      `Comprende y produce textos orales y escritos en francés con propósitos comunicativos concretos, valorando la diversidad lingüística y cultural como recurso para la comunicación intercultural y el enriquecimiento personal.`,
  };
  return mapa[area] || `Desarrolla competencias específicas del área de ${area} aplicadas a situaciones concretas del entorno, promoviendo el pensamiento crítico, la creatividad y los valores ciudadanos en el contexto de ${grado}.`;
};

const generarSituacionAprendizaje = (area, grado, tema, centro = "la escuela") => {
  const mapa = {
    "Inglés":
      `Los estudiantes de ${grado} del ${centro} participarán en actividades comunicativas auténticas en inglés relacionadas con "${tema}", donde interactuarán oralmente y por escrito en situaciones del entorno cotidiano. Mediante el aprendizaje colaborativo y el uso de recursos audiovisuales, elaborarán producciones sencillas que reflejen comprensión y uso funcional del idioma en contextos reales.`,
    "Lengua Española":
      `Los estudiantes de ${grado} explorarán la temática de "${tema}" mediante la lectura, el análisis y la producción de textos orales y escritos. A través del trabajo colaborativo y la reflexión crítica, desarrollarán competencias comunicativas que les permitan expresarse con claridad y creatividad en diferentes situaciones de su vida cotidiana.`,
    "Matemática":
      `Los estudiantes de ${grado} enfrentarán situaciones problemáticas del entorno vinculadas a "${tema}", utilizando estrategias de razonamiento matemático para resolverlas. A través de actividades prácticas y el trabajo en equipo, construirán comprensión conceptual y procedimental que podrán aplicar en su vida diaria.`,
    "Ciencias de la Naturaleza":
      `Los estudiantes de ${grado} investigarán y explorarán el tema "${tema}" mediante la observación, la experimentación y el análisis científico. A través del trabajo colaborativo y el uso de recursos del entorno, desarrollarán actitudes científicas y comprensión de los fenómenos naturales que les rodean.`,
    "Ciencias Sociales":
      `Los estudiantes de ${grado} analizarán el tema "${tema}" desde una perspectiva crítica e histórica, relacionándolo con su realidad inmediata. A través del estudio, el diálogo y la reflexión, construirán conciencia ciudadana y comprensión del mundo social en el que participan activamente.`,
  };
  return mapa[area] ||
    `Los estudiantes de ${grado} explorarán "${tema}" a través de experiencias significativas y contextualizadas, desarrollando competencias mediante actividades que conectan con su realidad cotidiana y promueven el pensamiento crítico, la creatividad y los valores de convivencia.`;
};

const generarEstrategia = (area) => {
  const mapa = {
    "Inglés":
      "Recuperación de saberes previos mediante preguntas y observación de imágenes. Aprendizaje colaborativo en parejas y socialización grupal. Descubrimiento guiado de estructuras gramaticales a través del análisis y comparación. Uso de materiales audiovisuales y situaciones contextualizadas del entorno inmediato.",
    "Lengua Española":
      "Activación de conocimientos previos mediante lluvia de ideas y lectura exploratoria. Lectura guiada con estrategias de anticipación, inferencia y verificación. Producción textual colaborativa con revisión entre pares. Socialización de producciones y retroalimentación docente.",
    "Matemática":
      "Resolución de problemas contextualizados como punto de partida. Descubrimiento guiado mediante manipulación de materiales concretos. Trabajo colaborativo en grupos pequeños. Socialización de estrategias y validación colectiva de resultados.",
    "Ciencias de la Naturaleza":
      "Exploración del entorno natural mediante observación directa y preguntas científicas. Experimentación guiada con materiales accesibles. Registro y análisis de datos en equipos. Sistematización del aprendizaje mediante organizadores gráficos.",
    "Ciencias Sociales":
      "Problematización con situaciones del entorno cercano. Análisis de fuentes primarias y secundarias. Trabajo colaborativo en grupos para investigar y debatir. Exposición y síntesis colectiva de conclusiones.",
  };
  return mapa[area] ||
    "Activación de saberes previos, aprendizaje colaborativo en grupos, descubrimiento guiado mediante recursos audiovisuales y materiales didácticos, socialización de producciones y retroalimentación formativa continua.";
};

const generarIntencionPedagogica = (area, tema, grado) => {
  const mapa = {
    "Inglés":
      `Desde el inicio hasta el final de la clase, los estudiantes identificarán y utilizarán vocabulario y estructuras gramaticales relacionadas con "${tema}" en ${grado}, demostrando comprensión oral y producción escrita básica en situaciones del entorno inmediato.`,
    "Lengua Española":
      `Desde el inicio hasta el final de la clase, los estudiantes de ${grado} leerán, comprenderán y producirán textos relacionados con "${tema}", desarrollando habilidades de comprensión lectora y expresión escrita coherente y cohesionada.`,
    "Matemática":
      `Desde el inicio hasta el final de la clase, los estudiantes de ${grado} comprenderán y aplicarán los conceptos de "${tema}" para resolver situaciones problemáticas del entorno, demostrando dominio procedimental y razonamiento matemático.`,
    "Ciencias de la Naturaleza":
      `Desde el inicio hasta el final de la clase, los estudiantes de ${grado} investigarán y explicarán los fenómenos relacionados con "${tema}", desarrollando el pensamiento científico a través de la observación, el análisis y la síntesis.`,
    "Ciencias Sociales":
      `Desde el inicio hasta el final de la clase, los estudiantes de ${grado} analizarán y valorarán los aspectos fundamentales de "${tema}", desarrollando pensamiento crítico y conciencia ciudadana aplicados a su contexto cotidiano.`,
  };
  return mapa[area] ||
    `Desde el inicio hasta el final de la clase, los estudiantes de ${grado} comprenderán los conceptos esenciales de "${tema}", aplicándolos en actividades prácticas que demuestren el logro de las competencias e indicadores propuestos.`;
};

const generarContenidos = (area, tema) => {
  const bases = {
    "Inglés": {
      conceptuales: [
        `Vocabulario esencial: "${tema}"`,
        "Estructuras gramaticales básicas del tema",
        "Expresiones y frases comunicativas del contexto",
        "Reglas de pronunciación y entonación básicas",
      ],
      procedimentales: [
        "Comprensión oral: Anticipación del contenido",
        "Producción oral: Descripción de situaciones",
        `Producción escrita: Construcción de oraciones sobre "${tema}"`,
        "Interacción comunicativa en parejas y grupos",
      ],
      actitudinales: [
        "Motivación para aprender inglés",
        "Cortesía y asertividad en la comunicación",
        "Respeto por las diferencias culturales",
        "Perseverancia en la práctica del idioma",
      ],
    },
    "Lengua Española": {
      conceptuales: [
        `Características del texto relacionado con "${tema}"`,
        "Estructura y propósito comunicativo",
        "Recursos lingüísticos: cohesión y coherencia",
        `Vocabulario específico de "${tema}"`,
      ],
      procedimentales: [
        "Lectura comprensiva con estrategias de anticipación",
        "Producción de textos con coherencia y cohesión",
        "Participación en situaciones de comunicación oral",
        "Revisión y corrección ortográfica y gramatical",
      ],
      actitudinales: [
        "Valoración de la lectura como fuente de conocimiento",
        "Responsabilidad en la comunicación efectiva",
        "Respeto por la diversidad lingüística",
        "Creatividad en la expresión personal",
      ],
    },
    "Matemática": {
      conceptuales: [
        `Conceptos matemáticos de "${tema}"`,
        "Propiedades y relaciones del contenido",
        "Terminología matemática específica",
        "Algoritmos y procedimientos formales",
      ],
      procedimentales: [
        "Resolución de problemas del entorno cotidiano",
        "Aplicación de algoritmos y estrategias de cálculo",
        "Representación gráfica de datos y resultados",
        "Verificación de resultados mediante estimación",
      ],
      actitudinales: [
        "Confianza en las propias capacidades matemáticas",
        "Perseverancia ante problemas desafiantes",
        "Valoración de la matemática en la vida cotidiana",
        "Respeto por los aportes ajenos en el trabajo colaborativo",
      ],
    },
    "Ciencias de la Naturaleza": {
      conceptuales: [
        `Conceptos científicos de "${tema}"`,
        "Procesos y fenómenos naturales del contenido",
        "Terminología científica específica",
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
        "Valoración del método científico",
      ],
    },
    "Ciencias Sociales": {
      conceptuales: [
        `Conceptos históricos y sociales de "${tema}"`,
        "Procesos culturales y políticos del contenido",
        "Cronología y ubicación espacio-temporal",
        "Relaciones causa-efecto en los procesos sociales",
      ],
      procedimentales: [
        "Análisis e interpretación de fuentes históricas",
        "Construcción de líneas de tiempo y mapas",
        "Debate y argumentación sobre temas sociales",
        "Investigación y síntesis de información",
      ],
      actitudinales: [
        "Valoración de la identidad cultural y nacional",
        "Respeto por la diversidad cultural y social",
        "Compromiso con la ciudadanía activa y responsable",
        "Pensamiento crítico ante los procesos históricos",
      ],
    },
  };
  const base = bases[area] || {
    conceptuales: [`Conceptos principales de "${tema}"`, "Definiciones y términos del contenido", "Teorías y principios aplicables", "Relaciones entre conceptos"],
    procedimentales: [`Aplicación práctica de "${tema}"`, "Análisis y síntesis de información", "Resolución de situaciones concretas", "Producción de evidencias de aprendizaje"],
    actitudinales: ["Interés y participación activa", "Responsabilidad en el trabajo", "Respeto por los compañeros", "Valoración del aprendizaje colectivo"],
  };
  return base;
};

const generarIndicadoresLogro = (area, tema, grado) => {
  const mapa = {
    "Inglés": [
      `Responde de forma adecuada a preguntas e indicaciones relacionadas con "${tema}", a partir de la escucha o lectura de textos breves y sencillos sobre su entorno inmediato.`,
      `Produce textos breves y sencillos mediante frases y oraciones enlazadas para describir situaciones relacionadas con "${tema}", utilizando vocabulario y conectores básicos.`,
    ],
    "Lengua Española": [
      `Comprende e interpreta textos sobre "${tema}" identificando ideas principales, secundarias y el propósito comunicativo del autor.`,
      `Produce textos escritos coherentes y cohesionados relacionados con "${tema}", utilizando correctamente las normas ortográficas y gramaticales del español.`,
    ],
    "Matemática": [
      `Identifica y comprende los conceptos matemáticos de "${tema}" aplicándolos en la resolución de problemas del entorno cotidiano.`,
      `Utiliza estrategias y procedimientos matemáticos adecuados para resolver situaciones problemáticas relacionadas con "${tema}", justificando su proceso de solución.`,
    ],
    "Ciencias de la Naturaleza": [
      `Explica los fenómenos y procesos naturales relacionados con "${tema}" utilizando el vocabulario científico apropiado.`,
      `Aplica el método científico para investigar situaciones concretas de "${tema}", registrando observaciones y analizando resultados.`,
    ],
    "Ciencias Sociales": [
      `Analiza los procesos históricos, geográficos y culturales relacionados con "${tema}" reconociendo sus causas, consecuencias y relación con el presente.`,
      `Argumenta de forma crítica y reflexiva sobre aspectos de "${tema}", valorando la identidad cultural y el ejercicio ciudadano responsable.`,
    ],
  };
  return mapa[area] || [
    `Identifica y comprende los aspectos fundamentales de "${tema}" en el contexto de ${grado}.`,
    `Aplica los conocimientos sobre "${tema}" en situaciones concretas, demostrando el logro de las competencias propuestas.`,
  ];
};

const generarActividades = (area, tema, grado) => {
  const mapas = {
    "Inglés": {
      inicio: [
        "Responden al saludo e indicaciones iniciales del docente en inglés.",
        `Retroalimentación de la clase anterior: "Do you remember the last class? What vocabulary do you remember about ${tema}?"`,
        `Recuperación de saberes previos: Se presenta una imagen o situación relacionada con "${tema}". Los estudiantes expresan lo que saben en inglés.`,
        `Expresan ideas sobre su entorno inmediato relacionando el contenido con su vida diaria. `,
        "Escuchan la intención pedagógica y el propósito de la clase.",
      ],
      desarrollo: [
        `Observan y/o escuchan un material audiovisual relacionado con "${tema}" e identifican vocabulario clave.`,
        `Analizan una presentación visual sobre "${tema}". Diferencian estructuras gramaticales mediante ejemplos contextualizados.`,
        `Describen oralmente y redactan oraciones sencillas sobre "${tema}" mediante trabajo colaborativo en parejas.`,
        "Socializan sus producciones e interactúan con sus compañeros realizando y respondiendo preguntas sencillas.",
        "Reciben retroalimentación del docente y compañeros para corregir errores de vocabulario, pronunciación y gramática.",
      ],
      cierre: [
        `Comparten información sencilla sobre "${tema}" y responden preguntas de reflexión en inglés.`,
        "Expresan opiniones breves sobre la utilidad del contenido en situaciones reales.",
        "Integran la retroalimentación recibida sobre participación, pronunciación y construcción de oraciones.",
        'Despiden la sesión de manera motivacional: "Goodbye teacher! See you next class!"',
      ],
    },
  };

  const defaultActividades = {
    inicio: [
      "Responden al saludo e indicaciones iniciales del docente.",
      `Retroalimentación de la clase anterior: ¿Qué recuerdan del tema anterior relacionado con "${tema}"?`,
      "Recuperación de saberes previos mediante preguntas generadoras y lluvia de ideas.",
      `Observan imágenes o situaciones problemáticas relacionadas con "${tema}" y expresan sus ideas.`,
      "Escuchan la intención pedagógica y el propósito de la clase.",
    ],
    desarrollo: [
      `Observan y analizan material de apoyo (visual, audiovisual o impreso) relacionado con "${tema}".`,
      "Identifican conceptos clave, los clasifican y los relacionan con su experiencia previa.",
      `Realizan actividades prácticas o ejercicios de aplicación relacionados con "${tema}" en grupos colaborativos.`,
      "Socializan sus producciones e interactúan con sus compañeros, compartiendo respuestas y estrategias.",
      "Reciben retroalimentación del docente para corregir errores y reforzar comprensión.",
    ],
    cierre: [
      `Comparten una síntesis oral o escrita de lo aprendido sobre "${tema}".`,
      "Responden preguntas de reflexión metacognitiva sobre su propio proceso de aprendizaje.",
      "Expresan la utilidad del contenido en situaciones de su vida cotidiana.",
      "Se despiden motivados e identifican qué seguirán practicando o investigando.",
    ],
  };

  const base = mapas[area] || defaultActividades;
  return base;
};

const generarMetacognicion = (area, tema) => ({
  inicio: [
    `¿Por qué es importante aprender sobre "${tema}"?`,
    "¿Qué sabes sobre este tema? ¿Qué esperas aprender hoy?",
  ],
  desarrollo: [
    `¿Qué estrategias usaste para comprender "${tema}"?`,
    "¿Qué parte te resultó más difícil? ¿Cómo la resolviste?",
    "¿Cómo te ayudó el trabajo en grupo durante la actividad?",
  ],
  cierre: [
    "¿Qué aprendiste hoy? ¿Cómo lo explicarías a un compañero?",
    `¿Cómo puedes aplicar lo aprendido sobre "${tema}" en tu vida cotidiana?`,
    "¿Qué fue lo que más te gustó de la clase? ¿Qué te generó dudas?",
  ],
});

const generarRecursos = (area) => {
  const tecnologicosPorArea = {
    "Inglés":           "TV o Proyector, bocinas, computadora",
    "Lengua Española":  "TV o Proyector, computadora",
    "Matemática":       "TV o Proyector, calculadora, computadora",
    "Ciencias de la Naturaleza": "TV o Proyector, computadora, microscopio (si disponible)",
    "Ciencias Sociales": "TV o Proyector, mapas digitales, computadora",
  };
  return {
    inicio: {
      humanos: "Docente, estudiantes",
      didacticos: "Pizarra, marcadores, cuaderno",
      tecnologicos: tecnologicosPorArea[area] || "TV o Proyector, computadora",
    },
    desarrollo: {
      humanos: "Docente, estudiantes en grupos",
      didacticos: "Hojas impresas, fichas, cuadernos, lápices",
      tecnologicos: tecnologicosPorArea[area] || "TV o Proyector, computadora",
    },
    cierre: {
      humanos: "Docente, estudiantes",
      didacticos: "Pizarra, cuaderno",
      tecnologicos: tecnologicosPorArea[area] || "TV o Proyector, computadora",
    },
  };
};

const generarEvaluacion = (area, tema) => ({
  inicio: {
    evidencias: [
      "Conocimientos previos sobre el tema",
      "Experiencias relacionadas con el contenido",
      "Respuestas orales a preguntas generadoras",
    ],
    tipo: "Diagnóstica",
    agente: "Heteroevaluación",
    tecnica: "Observación directa",
    instrumento: "Lista de cotejo",
  },
  desarrollo: {
    evidencias: [
      "Participación oral e interacción",
      "Producciones escritas y ejercicios completados",
      "Aplicación de conceptos y estructuras del tema",
    ],
    tipo: "Formativa",
    agente: "Coevaluación / Heteroevaluación",
    tecnica: "Análisis de producciones y desempeño",
    instrumento: "Rúbrica analítica",
  },
  cierre: {
    evidencias: [
      "Síntesis oral del aprendizaje",
      "Respuestas finales y participación en reflexión",
      "Metacognición y autovaloración del aprendizaje",
    ],
    tipo: "Formativa",
    agente: "Autoevaluación",
    tecnica: "Análisis del registro",
    instrumento: "Escala de valoración",
  },
});

const generarAdaptacionesNEAE = (area) => ({
  acceso:
    "Uso de apoyo visual, imágenes y ejemplos escritos para facilitar la comprensión de estudiantes con ritmo de aprendizaje más lento y dificultades en la expresión oral.",
  metodologicas:
    "Participación guiada mediante preguntas sencillas, repetición oral e instrucciones fragmentadas para estudiantes con timidez o dificultades en la expresión.",
  evaluacion:
    "Tiempo adicional, acompañamiento del docente y ejemplos modelo durante la realización de actividades para estudiantes con ritmo de aprendizaje más lento.",
});

const generarInstrumentos = (area, tema) => {
  const criteriosCotejo = [
    { criterio: `Identifica conceptos clave de "${tema}"`, tipo: "si_no" },
    { criterio: "Participa activamente en las actividades", tipo: "si_no" },
    { criterio: "Expresa ideas previas relacionadas con el tema", tipo: "si_no" },
  ];

  const criteriosRubrica = [
    {
      criterio: `Identifica los conceptos de "${tema}"`,
      nivel3: "Identifica correctamente todos los conceptos",
      nivel2: "Identifica algunos conceptos",
      nivel1: "Presenta dificultad para identificarlos",
    },
    {
      criterio: "Aplica el contenido en situaciones concretas",
      nivel3: "Aplica con precisión y autonomía",
      nivel2: "Aplica con alguna ayuda",
      nivel1: "No aplica correctamente",
    },
    {
      criterio: "Produce evidencias del aprendizaje",
      nivel3: "Produce evidencias claras y completas",
      nivel2: "Produce evidencias parciales",
      nivel1: "Presenta dificultad para producir evidencias",
    },
    {
      criterio: "Responde preguntas sobre el tema",
      nivel3: "Participa activamente y responde correctamente",
      nivel2: "Participa algunas veces",
      nivel1: "Participa poco",
    },
    {
      criterio: "Trabajo en grupo",
      nivel3: "Coopera y trabaja activamente",
      nivel2: "Coopera parcialmente",
      nivel1: "Presenta poca participación",
    },
  ];

  const criteriosEscala = [
    { criterio: `Describe o aplica "${tema}" utilizando vocabulario básico`, tipo: "siempre_aveces_nunca" },
    { criterio: "Utiliza correctamente los conceptos y estructuras del tema", tipo: "siempre_aveces_nunca" },
    { criterio: "Participa en la reflexión y metacognición final", tipo: "siempre_aveces_nunca" },
  ];

  return { criteriosCotejo, criteriosRubrica, criteriosEscala };
};

// ─── Constructor principal ───────────────────────────────────────────────────

export const generarPlanDiario = (datos) => {
  const {
    grado = "",
    seccion = "",
    area = "",
    asignatura = "",
    fecha = "",
    duracion = "50 min",
    tema = "",
    competenciaEspecificaCustom = "",
    indicadoresCustom = [],
    situacionCustom = "",
    nombreDocente = "César Jonás Baéz Jiménez",
    cedula = "012-0107808-4",
    regional = "02 San Juan Oeste",
    distrito = "06",
    centro = "Héctor Fco. López Romero- Hato Nuevo",
    codigoCentro = "03313",
    nivel = "Secundaria",
    ciclo = "Primer Ciclo",
    modalidad = "Académica",
    competenciasFundamentalesSeleccionadas = null,
  } = datos;

  if (!tema.trim()) throw new Error("El tema es obligatorio");
  if (!grado.trim()) throw new Error("El grado es obligatorio");
  if (!area.trim()) throw new Error("El área es obligatoria");

  // Para lookups usa la asignatura si existe en el diccionario; si no, usa el área como fallback
  const claveArea = (asignatura && Object.prototype.hasOwnProperty.call(COMP_FUND_POR_AREA, asignatura))
    ? asignatura
    : area;
  const compFund = competenciasFundamentalesSeleccionadas || COMP_FUND_POR_AREA[claveArea] || ["Comunicativa"];
  const asignaturaFinal = asignatura || ASIGNATURA_POR_AREA[claveArea] || "";

  const contenidos = generarContenidos(claveArea, tema);
  const actividades = generarActividades(claveArea, tema, grado);
  const metacognicion = generarMetacognicion(claveArea, tema);
  const recursos = generarRecursos(claveArea);
  const evaluacion = generarEvaluacion(claveArea, tema);
  const instrumentos = generarInstrumentos(claveArea, tema);
  const indicadores = indicadoresCustom.length > 0
    ? indicadoresCustom
    : generarIndicadoresLogro(claveArea, tema, grado);

  return {
    metadatos: {
      tipoPlanificacion: "Planificación Diaria",
      nombreDocente,
      cedula,
      regional,
      distrito,
      centro,
      codigoCentro,
      nivel,
      ciclo,
      grado,
      seccion,
      modalidad,
      area,
      asignatura: asignaturaFinal,
      fecha,
      duracion,
      tema,
    },
    competenciasEIndicadores: {
      competenciasFundamentales: COMPETENCIAS_FUNDAMENTALES.map((c) => ({
        nombre: c,
        seleccionada: compFund.includes(c),
      })),
      indicadoresLogro: indicadores,
      competenciaEspecifica: competenciaEspecificaCustom || generarCompetenciaEspecifica(claveArea, grado),
      situacionAprendizaje: situacionCustom || generarSituacionAprendizaje(claveArea, grado, tema, centro),
    },
    intencionPedagogica: {
      estrategia: generarEstrategia(claveArea),
      intencionDelDia: generarIntencionPedagogica(claveArea, tema, grado),
    },
    contenidos,
    desarrolloClase: {
      inicio:     { tiempo: "10 min", actividades: actividades.inicio,     evaluacion: evaluacion.inicio,     metacognicion: metacognicion.inicio,     recursos: recursos.inicio },
      desarrollo: { tiempo: "30 min", actividades: actividades.desarrollo, evaluacion: evaluacion.desarrollo, metacognicion: metacognicion.desarrollo, recursos: recursos.desarrollo },
      cierre:     { tiempo: "10 min", actividades: actividades.cierre,     evaluacion: evaluacion.cierre,     metacognicion: metacognicion.cierre,     recursos: recursos.cierre },
    },
    adaptacionesNEAE: generarAdaptacionesNEAE(claveArea),
    resumenEvaluacion: {
      tecnicas:     ["Observación directa", "Análisis de producciones", "Pregunta y respuesta"],
      instrumentos: ["Lista de cotejo", "Rúbrica analítica", "Escala de valoración"],
      observaciones: [
        "Nivel de participación de los estudiantes",
        `Dificultades en la aplicación del contenido (${tema})`,
        "Estudiantes que requieren refuerzo pedagógico",
      ],
    },
    instrumentosEvaluacion: instrumentos,
  };
};

// ─── Exportar a HTML (MINERD format) ────────────────────────────────────────

export const formatearPlanDiarioHTML = (plan) => {
  if (!plan) return "";
  const { metadatos: m, competenciasEIndicadores: ci, intencionPedagogica: ip,
          contenidos, desarrolloClase: dc, adaptacionesNEAE: neae,
          resumenEvaluacion: re, instrumentosEvaluacion: ie } = plan;

  const celda = (txt) => `<td>${txt || ""}</td>`;
  const th = (txt, attrs = "") => `<th ${attrs}>${txt}</th>`;

  const compFundHTML = (ci.competenciasFundamentales || [])
    .map((c) => `<span class="comp-cb">${c.seleccionada ? "☑" : "☐"} ${c.nombre}</span>`)
    .join(" &nbsp; ");

  const indHTML = (ci.indicadoresLogro || [])
    .map((i) => `<li>${i}</li>`).join("");

  const contHTML = (arr) => (arr || []).map((i) => `<li>${i}</li>`).join("");

  const actHTML = (arr) => (arr || [])
    .map((a, i) => `<p><strong>${i + 1})</strong> ${a}</p>`).join("");

  const metaHTML = (arr) => (arr || [])
    .map((q) => `<p><em>${q}</em></p>`).join("");

  const recurHTML = (r) =>
    `<p><strong>Humanos:</strong> ${r.humanos}</p><p><strong>Didácticos:</strong> ${r.didacticos}</p><p><strong>Tecnológicos:</strong> ${r.tecnologicos}</p>`;

  const evalHTML = (e) =>
    `<p><strong>Evidencias:</strong></p><ul>${(e.evidencias || []).map((x) => `<li>${x}</li>`).join("")}</ul>
     <p><strong>Tipo:</strong> ${e.tipo}</p>
     <p><strong>Agente:</strong> ${e.agente}</p>
     <p><strong>Técnica:</strong> ${e.tecnica}</p>
     <p><strong>Instrumento:</strong> ${e.instrumento}</p>`;

  const buildMomentoRow = (label, mom) =>
    `<tr>
      <td class="momento-cell"><strong>${label}</strong></td>
      <td class="tiempo-cell">${mom.tiempo}</td>
      <td>${actHTML(mom.actividades)}</td>
      <td>${evalHTML(mom.evaluacion)}</td>
      <td>${metaHTML(mom.metacognicion)}</td>
      <td>${recurHTML(mom.recursos)}</td>
    </tr>`;

  const cotejoCols = (crit) => `<td class="cb-cell">☐ Sí &nbsp; ☐ No</td>`.repeat(crit.length > 0 ? 1 : 0);

  const css = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 9.5px; color: #111; padding: 10mm; }
    h1 { text-align: center; font-size: 12px; color: #1d4ed8; margin-bottom: 4px; }
    h2 { text-align: center; font-size: 10px; color: #374151; margin-bottom: 10px; }
    h3 { font-size: 10px; background: #dbeafe; color: #1e40af; padding: 4px 6px; margin: 12px 0 4px; border-left: 4px solid #2563eb; }
    h4 { font-size: 9px; background: #e0f2fe; padding: 3px 6px; margin: 8px 0 3px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    th, td { border: 1px solid #94a3b8; padding: 4px 6px; vertical-align: top; font-size: 8.5px; }
    th { background: #1d4ed8; color: #fff; text-align: center; font-size: 8px; }
    .sec-header { background: #1e3a8a; color: #fff; text-align: center; font-size: 9px; font-weight: bold; }
    .lbl { background: #dbeafe; color: #1e40af; font-weight: bold; width: 120px; }
    .momento-cell { background: #eff6ff; font-size: 9px; width: 55px; text-align: center; }
    .tiempo-cell { text-align: center; width: 45px; }
    .cb-cell { text-align: center; }
    .comp-cb { display: inline-block; margin: 2px; }
    ul { margin: 3px 0 3px 14px; }
    li { margin: 1px 0; }
    p { margin: 2px 0; }
    em { font-style: italic; color: #374151; }
    .firma { display: flex; justify-content: space-between; margin-top: 24px; }
    .firma-line { text-align: center; width: 200px; }
    .firma-line hr { margin: 32px 0 4px; border: none; border-top: 1px solid #111; }
    .nivel3 { background: #dcfce7; } .nivel2 { background: #fef9c3; } .nivel1 { background: #fee2e2; }
    @page { size: A4 portrait; margin: 10mm; }
    @media print { body { padding: 0; } }
  `;

  const rubricaHTML = (ie.criteriosRubrica || []).map((c) =>
    `<tr>
      <td><strong>${c.criterio}</strong></td>
      <td class="nivel3">${c.nivel3}</td>
      <td class="nivel2">${c.nivel2}</td>
      <td class="nivel1">${c.nivel1}</td>
    </tr>`
  ).join("");

  const cotejoCriteriosHTML = (ie.criteriosCotejo || []).map((c) =>
    `<tr>
      <td style="width:20px;text-align:center">—</td>
      <td>${c.criterio}</td>
      <td class="cb-cell">☐ Sí &nbsp; ☐ No</td>
      <td class="cb-cell">☐ Sí &nbsp; ☐ No</td>
      <td class="cb-cell">☐ Sí &nbsp; ☐ No</td>
      <td></td>
    </tr>`
  ).join("");

  const escalaCriteriosHTML = (ie.criteriosEscala || []).map((c) =>
    `<tr>
      <td style="width:20px;text-align:center">—</td>
      <td>${c.criterio}</td>
      <td class="cb-cell">☐ Siempre &nbsp; ☐ A veces &nbsp; ☐ Nunca</td>
      <td class="cb-cell">☐ Siempre &nbsp; ☐ A veces &nbsp; ☐ Nunca</td>
      <td class="cb-cell">☐ Siempre &nbsp; ☐ A veces &nbsp; ☐ Nunca</td>
      <td></td>
    </tr>`
  ).join("");

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Plan Diario · ${m.area} · ${m.grado} ${m.seccion}</title>
<style>${css}</style></head>
<body>
<h1>MINISTERIO DE EDUCACIÓN DE LA REPÚBLICA DOMINICANA</h1>
<h2>PLAN DIARIO</h2>

<h3>DATOS GENERALES</h3>
<table>
  <tr><td class="lbl">Nombre completo</td><td>${m.nombreDocente}</td><td class="lbl">Cédula</td><td>${m.cedula}</td></tr>
  <tr><td class="lbl">Regional</td><td>${m.regional}</td><td class="lbl">Distrito</td><td>${m.distrito}</td></tr>
  <tr><td class="lbl">Centro Educativo</td><td>${m.centro}</td><td class="lbl">Código del Centro</td><td>${m.codigoCentro}</td></tr>
  <tr><td class="lbl">Nivel / Subsistema</td><td>${m.nivel}</td><td class="lbl">Ciclo</td><td>${m.ciclo}</td></tr>
  <tr><td class="lbl">Grado y Sección</td><td>${m.grado} ${m.seccion}</td><td class="lbl">Modalidad</td><td>${m.modalidad}</td></tr>
  <tr><td class="lbl">Área</td><td>${m.area}</td><td class="lbl">Asignatura</td><td>${m.asignatura}</td></tr>
  <tr><td class="lbl">Fecha</td><td>${m.fecha}</td><td class="lbl">Duración</td><td>${m.duracion}</td></tr>
</table>

<h3>COMPETENCIAS E INDICADORES DE LOGRO</h3>
<table>
  <tr><td class="lbl">Competencias Fundamentales</td><td>${compFundHTML}</td></tr>
  <tr><td class="lbl">Indicadores de logros</td><td><ul>${indHTML}</ul></td></tr>
  <tr><td class="lbl">Competencias específicas</td><td>${ci.competenciaEspecifica}</td></tr>
  <tr><td class="lbl">Situación de Aprendizaje</td><td>${ci.situacionAprendizaje}</td></tr>
</table>

<h3>INTENCIÓN PEDAGÓGICA Y ESTRATEGIA</h3>
<table>
  <tr><td class="lbl">Estrategia de enseñanza y aprendizaje</td><td>${ip.estrategia}</td></tr>
  <tr><td class="lbl">Intención pedagógica del día</td><td>${ip.intencionDelDia}</td></tr>
</table>

<h3>CONTENIDOS</h3>
<table>
  <tr>${th("Conceptuales")}${th("Procedimentales")}${th("Actitudinales")}</tr>
  <tr>
    <td><ul>${contHTML(contenidos.conceptuales)}</ul></td>
    <td><ul>${contHTML(contenidos.procedimentales)}</ul></td>
    <td><ul>${contHTML(contenidos.actitudinales)}</ul></td>
  </tr>
</table>

<h3>DESARROLLO DE LA CLASE</h3>
<table>
  <tr>
    ${th("Momento")}${th("Tiempo")}${th("Actividades")}
    <th>Evaluación<br><small>(Evidencias · Técnicas e Instrumentos)</small></th>
    ${th("Metacognición")}${th("Recursos")}
  </tr>
  ${buildMomentoRow("Inicio", dc.inicio)}
  ${buildMomentoRow("Desarrollo", dc.desarrollo)}
  ${buildMomentoRow("Cierre", dc.cierre)}
</table>

<h3>ADAPTACIONES (Para estudiantes con NEAE — si aplica)</h3>
<table>
  <tr>${th("De acceso")}${th("Metodológicas")}${th("De evaluación")}</tr>
  <tr><td>${neae.acceso}</td><td>${neae.metodologicas}</td><td>${neae.evaluacion}</td></tr>
</table>

<h3>RESUMEN DE EVALUACIÓN Y OBSERVACIONES</h3>
<table>
  <tr>${th("Técnicas")}${th("Instrumentos")}${th("Observaciones")}</tr>
  <tr>
    <td><ul>${(re.tecnicas || []).map((t) => `<li>${t}</li>`).join("")}</ul></td>
    <td><ul>${(re.instrumentos || []).map((t) => `<li>${t}</li>`).join("")}</ul></td>
    <td><ul>${(re.observaciones || []).map((t) => `<li>${t}</li>`).join("")}</ul></td>
  </tr>
</table>

<h3>INSTRUMENTOS DE EVALUACIÓN</h3>

<h4>1. LISTA DE COTEJO (Diagnóstica – Inicio) · Tema: ${m.tema}</h4>
<table>
  <tr>${th("N.º")}${th("Nombre del estudiante")}
    ${(ie.criteriosCotejo || []).map((c) => th(c.criterio)).join("")}
    ${th("Observaciones")}
  </tr>
  ${cotejoCriteriosHTML}
</table>

<h4>2. RÚBRICA ANALÍTICA (Formativa – Desarrollo) · Actividad: ${m.tema}</h4>
<table>
  <tr>${th("Criterio")}${th("Nivel 3 (Logrado)")}${th("Nivel 2 (En proceso)")}${th("Nivel 1 (Inicial)")}</tr>
  ${rubricaHTML}
</table>
<p style="font-size:8px;margin:4px 0"><strong>Escala:</strong> 13–15 pts: Logro destacado · 10–12 pts: Logro esperado · 7–9 pts: En proceso · 1–6 pts: Inicio</p>

<h4>3. ESCALA DE VALORACIÓN (Formativa – Cierre) · Actividad: Reflexión oral</h4>
<table>
  <tr>${th("N.º")}${th("Nombre del estudiante")}
    ${(ie.criteriosEscala || []).map((c) => th(c.criterio)).join("")}
    ${th("Observaciones")}
  </tr>
  ${escalaCriteriosHTML}
</table>

<script>window.onload = () => window.print();</script>
</body></html>`;
};
