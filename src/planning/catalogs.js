/**
 * Catálogos centralizados para todas las áreas y grados
 * Escalable para: Primaria, Secundaria, Inglés, Francés
 */

/* ======================== ENUMERACIONES GLOBALES ======================== */
export const MODO = {
  GUIA: "guia",
  PLANIFICACION: "planificacion",
};

export const TIPO_EVAL = {
  DIAGNOSTICA: "diagnostica",
  FORMATIVA: "formativa",
  SUMATIVA: "sumativa",
};

export const AGENTE_EVAL = {
  HETERO: "heteroevaluacion",
  AUTO: "autoevaluacion",
  CO: "coevaluacion",
};

export const TIPO_INSTRUMENTO = {
  RUBRICA: "Rúbrica analítica",
  LISTA_COTEJO: "Lista de cotejo",
  REGISTRO_ANECDOTICO: "Registro anecdótico",
  ESCALA: "Escala estimativa",
  COEVALUACION: "Coevaluación",
  AUTOEVALUACION: "Autoevaluación",
};

export const TIPO_RECURSO = {
  HUMANO: "humanos",
  DIDACTICO: "didacticos",
  TECNOLOGICO: "tecnologicos",
};

export const NIVEL_PRIMARIA = {
  PRIMERO: "1ro",
  SEGUNDO: "2do",
  TERCERO: "3ro",
  CUARTO: "4to",
  QUINTO: "5to",
  SEXTO: "6to",
};

export const NIVEL_SECUNDARIA = {
  PRIMERO: "1ro",
  SEGUNDO: "2do",
  TERCERO: "3ro",
  CUARTO: "4to",
};

/* ======================== ESTRATEGIAS DE ENSEÑANZA ======================== */
export const ESTRATEGIAS_ENSENANZA = {
  EXPOSITIVA: "Exposición de conceptos",
  DESCUBRIMIENTO: "Descubrimiento guiado",
  INDAGACION: "Indagación científica",
  RESOLUCION_PROBLEMAS: "Resolución de problemas",
  COOPERATIVA: "Aprendizaje cooperativo",
  BASADA_PROYECTOS: "Aprendizaje basado en proyectos",
  BASADA_CASOS: "Aprendizaje basado en casos",
  SOCIALIZANTE: "Técnica socializante",
  LUDO_PEDAGOGICA: "Estrategia lúdico-pedagógica",
  DIALOGO: "Diálogo reflexivo",
};

/* ======================== ADECUACIONES NEAE ======================== */
export const ADECUACIONES_NEAE = {
  ACCESO: {
    AUMENTATIVOS: "Materiales aumentativos",
    ALTERNATIVOS: "Sistemas alternativos",
    AUDIO_DESCRIPCION: "Audiodescripción",
    LENGUAJE_SIGNOS: "Lengua de signos",
    RECURSOS_ESPECIALIZADOS: "Recursos especializados",
  },
  CURRICULAR: {
    PRIORIZACION: "Priorización de contenidos",
    ELIMINACION: "Eliminación de contenidos",
    AMPLIACION: "Ampliación de contenidos",
    ADAPTACION_EVALUACION: "Adaptación en evaluación",
  },
  ORGANIZATIVA: {
    AGRUPAMIENTOS: "Agrupamientos específicos",
    ESPACIOS: "Adaptación de espacios",
    TIEMPOS: "Flexibilización de tiempos",
    APOYOS: "Refuerzo de apoyos",
  },
};

/* ======================== MOMENTOS PEDAGÓGICOS ======================== */
export const MOMENTOS_PEDAGOGICOS = {
  INICIO: {
    nombre: "Inicio",
    tiempo: 10,
    proposito: "Activación de conocimientos previos y presentación del tema",
    tecnicas: [
      "Lluvia de ideas",
      "Preguntas provocadoras",
      "Dinámicas motivadoras",
      "Presentación de situación",
    ],
  },
  DESARROLLO: {
    nombre: "Desarrollo",
    tiempo: 30,
    proposito: "Construcción de nuevos conocimientos y habilidades",
    tecnicas: [
      "Exposición con participación",
      "Trabajo colaborativo",
      "Investigación guiada",
      "Práctica supervisada",
      "Solución de problemas",
    ],
  },
  CIERRE: {
    nombre: "Cierre",
    tiempo: 5,
    proposito: "Síntesis, reflexión y preparación para transferencia",
    tecnicas: [
      "Resumen compartido",
      "Preguntas metacognitivas",
      "Compromiso de transferencia",
      "Clarificación de dudas",
      "Anticipación siguiente clase",
    ],
  },
};

/* ======================== CRITERIOS PARA RÚBRICA (11 criterios institucionales) ======================== */
export const CRITERIOS_RUBRICA_STANDARD = [
  {
    id: 1,
    criterio: "Comprensión del concepto",
    descripcion: "Demostración clara de la comprensión del concepto abordado",
  },
  {
    id: 2,
    criterio: "Aplicación práctica",
    descripcion: "Aplicación correcta del conocimiento en situaciones concretas",
  },
  {
    id: 3,
    criterio: "Análisis crítico",
    descripcion: "Capacidad de analizar y cuestionar información",
  },
  {
    id: 4,
    criterio: "Comunicación efectiva",
    descripcion: "Expresión clara y organizada de ideas",
  },
  {
    id: 5,
    criterio: "Colaboración",
    descripcion: "Trabajo efectivo en equipo y respeto a los demás",
  },
  {
    id: 6,
    criterio: "Creatividad",
    descripcion: "Originalidad y aporte de ideas innovadoras",
  },
  {
    id: 7,
    criterio: "Resolución de problemas",
    descripcion: "Identificación de estrategias y soluciones efectivas",
  },
  {
    id: 8,
    criterio: "Responsabilidad",
    descripcion: "Cumplimiento de tareas y compromisos",
  },
  {
    id: 9,
    criterio: "Reflexión metacognitiva",
    descripcion: "Análisis de su propio proceso de aprendizaje",
  },
  {
    id: 10,
    criterio: "Transferencia de conocimiento",
    descripcion: "Aplicación del aprendizaje en nuevos contextos",
  },
  {
    id: 11,
    criterio: "Ética y ciudadanía",
    descripcion: "Demostración de valores y actitudes responsables",
  },
];

/* ======================== NIVELES DE DESEMPEÑO ======================== */
export const NIVELES_DESEMPENIO = {
  INICIAL: {
    id: 1,
    nombre: "En Inicio",
    descripcion: "El estudiante muestra iniciación en el logro, requiere mayor apoyo",
    puntaje: 1,
  },
  EN_PROCESO: {
    id: 2,
    nombre: "En Proceso",
    descripcion: "El estudiante progresa hacia el logro, con apoyo ocasional",
    puntaje: 2,
  },
  LOGRADO: {
    id: 3,
    nombre: "Logrado",
    descripcion: "El estudiante ha alcanzado el logro esperado",
    puntaje: 3,
  },
  PROFUNDIZADO: {
    id: 4,
    nombre: "Profundizado",
    descripcion: "El estudiante ha profundizado en el logro con originalidad",
    puntaje: 4,
  },
};

/* ======================== ÁREAS POR GRADO ======================== */
export const AREAS_PRIMARIA = {
  LENGUA_ESPANIOL: "Lengua Española",
  MATEMATICA: "Matemática",
  CIENCIAS_NATURALES: "Ciencias de la Naturaleza",
  CIENCIAS_SOCIALES: "Ciencias Sociales",
  EDUCACION_ARTISTICA: "Educación Artística",
  EDUCACION_FISICA: "Educación Física",
  FORMACION_INTEGRAL: "Formación Integral Humana",
};

export const AREAS_SECUNDARIA = {
  LENGUA_ESPANIOL: "Lengua Española",
  MATEMATICA: "Matemática",
  CIENCIAS_NATURALES: "Ciencias de la Naturaleza",
  CIENCIAS_SOCIALES: "Ciencias Sociales",
  INGLES: "Inglés",
  FRANCES: "Francés",
  EDUCACION_ARTISTICA: "Educación Artística",
  EDUCACION_FISICA: "Educación Física",
  FORMACION_INTEGRAL: "Formación Integral Humana",
  TECNOLOGIA: "Tecnología",
};

export const AREAS_IDIOMAS = {
  INGLES: "Inglés",
  FRANCES: "Francés",
};

/* ======================== PREPOSICIONES POR ÁREA ======================== */
export const PROPOSITOS_POR_AREA = {
  LENGUA_ESPANIOL: [
    "Desarrollar habilidades comunicativas en expresión y comprensión oral",
    "Fortalecer la lectura comprensiva y análisis crítico de textos",
    "Mejorar la producción de textos escritos coherentes y cohesivos",
    "Desarrollar conciencia lingüística y metalingüística",
  ],
  MATEMATICA: [
    "Desarrollar pensamiento lógico-matemático",
    "Aplicar conceptos matemáticos en situaciones reales",
    "Fortalecer habilidades de cálculo y razonamiento",
    "Promover resolución de problemas matemáticos",
  ],
  CIENCIAS_NATURALES: [
    "Comprender fenómenos naturales y procesos científicos",
    "Desarrollar espíritu científico e indagación",
    "Aplicar método científico en investigaciones",
    "Entender relaciones de causa y efecto en la naturaleza",
  ],
  CIENCIAS_SOCIALES: [
    "Comprender sociedad, cultura e historia",
    "Desarrollar pensamiento crítico sobre realidades sociales",
    "Valorar diversidad cultural y ciudadanía",
    "Analizar cambios históricos y sociales",
  ],
  INGLES: [
    "Desarrollar competencia comunicativa en inglés",
    "Mejorar comprensión auditiva y producción oral",
    "Fortalecer lectura y escritura en inglés",
    "Valorar interculturalidad y diversidad",
  ],
};

export default {
  MODO,
  TIPO_EVAL,
  AGENTE_EVAL,
  TIPO_INSTRUMENTO,
  TIPO_RECURSO,
  NIVEL_PRIMARIA,
  NIVEL_SECUNDARIA,
  ESTRATEGIAS_ENSENANZA,
  ADECUACIONES_NEAE,
  MOMENTOS_PEDAGOGICOS,
  CRITERIOS_RUBRICA_STANDARD,
  NIVELES_DESEMPENIO,
  AREAS_PRIMARIA,
  AREAS_SECUNDARIA,
  AREAS_IDIOMAS,
  PROPOSITOS_POR_AREA,
};
