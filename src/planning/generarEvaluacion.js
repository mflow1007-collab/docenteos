/**
 * generarEvaluacion.js
 * Genera instrumentos y técnicas de evaluación contextualizadas
 * Soporta: Rúbricas, Listas de cotejo, Registros anecdóticos, Coevaluación, Autoevaluación
 */

import {
  TIPO_EVAL,
  TIPO_INSTRUMENTO,
  CRITERIOS_RUBRICA_STANDARD,
  NIVELES_DESEMPENIO,
} from "./catalogs.js";

/**
 * Técnicas de evaluación por tipo
 */
const TECNICAS_POR_TIPO_EVAL = {
  diagnostica: [
    "Preguntas exploratorias",
    "Observación inicial",
    "Prueba diagnóstica",
    "Lluvia de ideas",
    "Mapa conceptual inicial",
    "Conversación abierta",
  ],
  formativa: [
    "Observación sistemática",
    "Trabajos prácticos",
    "Participación en clase",
    "Diarios reflexivos",
    "Discusiones grupales",
    "Retroalimentación entre pares",
    "Autoevaluación continua",
    "Portafolios parciales",
  ],
  sumativa: [
    "Pruebas escritas/orales",
    "Proyectos finales",
    "Presentaciones",
    "Portafolio completo",
    "Rúbrica de desempeño",
    "Examen práctico",
    "Defensa de proyecto",
  ],
};

/**
 * Instrumentos específicos por técnica (referencia - no actualmente utilizado)
 */
// eslint-disable-next-line no-unused-vars
const INSTRUMENTOS_POR_TECNICA = {
  "Observación sistemática": {
    tipo: TIPO_INSTRUMENTO.LISTA_COTEJO,
    formato: "lista_cotejo",
    descripcion: "Lista de verificación del desempeño observado",
  },
  "Trabajos prácticos": {
    tipo: TIPO_INSTRUMENTO.RUBRICA,
    formato: "rubrica",
    descripcion: "Rúbrica analítica para evaluar la calidad del trabajo",
  },
  "Pruebas escritas/orales": {
    tipo: TIPO_INSTRUMENTO.RUBRICA,
    formato: "rubrica",
    descripcion: "Rúbrica para evaluación de comprensión",
  },
  "Presentaciones": {
    tipo: TIPO_INSTRUMENTO.RUBRICA,
    formato: "rubrica",
    descripcion: "Rúbrica de comunicación y presentación",
  },
  "Diarios reflexivos": {
    tipo: TIPO_INSTRUMENTO.REGISTRO_ANECDOTICO,
    formato: "registro_anecdotico",
    descripcion: "Registro de reflexiones y procesos metacognitivos",
  },
  "Portafolios parciales": {
    tipo: TIPO_INSTRUMENTO.RUBRICA,
    formato: "rubrica",
    descripcion: "Rúbrica para evaluar selección y justificación de evidencias",
  },
};

/**
 * Generar instrumento de evaluación (Rúbrica)
 */
export const generarRubrica = ({
  nombre = "Rúbrica de Evaluación",
  tema = "",
  criterios = null,
} = {}) => {
  // Si no se proporcionan criterios, usar los estándar
  const criteriosUsar = criterios || CRITERIOS_RUBRICA_STANDARD;

  const rubrica = {
    id: `rub-${Date.now()}`,
    nombre,
    tema,
    tipo: TIPO_INSTRUMENTO.RUBRICA,
    descripcion: `Rúbrica analítica para evaluar ${tema}`,
    fechaCreacion: new Date().toISOString(),

    // Encabezados
    encabezados: {
      estudiante: "Estudiante",
      criterio: "Criterio",
      inicial: "En Inicio",
      proceso: "En Proceso",
      logrado: "Logrado",
      profundizado: "Profundizado",
    },

    // Criterios con descriptores
    criterios: criteriosUsar.map((c) => ({
      id: c.id,
      nombre: c.criterio,
      descripcion: c.descripcion,
      descriptores: {
        [NIVELES_DESEMPENIO.INICIAL.nombre]: `Muestra iniciación en ${c.criterio.toLowerCase()}. Requiere apoyo constante.`,
        [NIVELES_DESEMPENIO.EN_PROCESO.nombre]: `Progresa hacia ${c.criterio.toLowerCase()}. Requiere apoyo ocasional.`,
        [NIVELES_DESEMPENIO.LOGRADO.nombre]: `Ha alcanzado ${c.criterio.toLowerCase()} de manera satisfactoria.`,
        [NIVELES_DESEMPENIO.PROFUNDIZADO.nombre]: `Ha profundizado en ${c.criterio.toLowerCase()} con originalidad y rigor.`,
      },
      pesos: {
        [NIVELES_DESEMPENIO.INICIAL.nombre]: 1,
        [NIVELES_DESEMPENIO.EN_PROCESO.nombre]: 2,
        [NIVELES_DESEMPENIO.LOGRADO.nombre]: 3,
        [NIVELES_DESEMPENIO.PROFUNDIZADO.nombre]: 4,
      },
    })),

    // Niveles de desempeño
    niveles: Object.values(NIVELES_DESEMPENIO),

    // Instrucciones de uso
    instrucciones: [
      "1. Revisar cada criterio cuidadosamente",
      "2. Observar el desempeño del estudiante en relación a cada criterio",
      "3. Seleccionar el nivel que mejor describe el desempeño actual",
      "4. Proporcionar comentarios específicos para mejora",
      "5. Usar como base para retroalimentación constructiva",
    ],

    // Escala de calificación
    escalaCalificacion: {
      "En Inicio": { rango: "1", porcentaje: "0-25%" },
      "En Proceso": { rango: "2", porcentaje: "26-75%" },
      Logrado: { rango: "3", porcentaje: "76-90%" },
      Profundizado: { rango: "4", porcentaje: "91-100%" },
    },
  };

  return rubrica;
};

/**
 * Generar lista de cotejo
 */
export const generarListaCotejo = ({
  nombre = "Lista de Cotejo",
  tema = "",
  indicadores = null,
} = {}) => {
  const indicadoresDefault = [
    { descripcion: "Cumple con los requisitos básicos", obligatorio: true },
    { descripcion: "Demuestra comprensión del concepto", obligatorio: true },
    { descripcion: "Usa recursos apropiados", obligatorio: false },
    { descripcion: "Comunica ideas claramente", obligatorio: false },
    { descripcion: "Colabora con compañeros", obligatorio: false },
    { descripcion: "Reflexiona sobre su aprendizaje", obligatorio: false },
  ];

  const indicadoresUsar = indicadores || indicadoresDefault;

  const listaCotejo = {
    id: `lco-${Date.now()}`,
    nombre,
    tema,
    tipo: TIPO_INSTRUMENTO.LISTA_COTEJO,
    descripcion: `Lista de cotejo para verificar ${tema}`,
    fechaCreacion: new Date().toISOString(),

    // Indicadores
    indicadores: indicadoresUsar.map((ind, idx) => ({
      id: idx + 1,
      descripcion: ind.descripcion,
      si: false,
      no: false,
      evidencia: "",
      obligatorio: ind.obligatorio || false,
    })),

    // Criterios de logro
    criterioLogro: {
      minimo: Math.ceil(indicadoresUsar.length * 0.7), // 70%
      esperado: Math.ceil(indicadoresUsar.length * 0.9), // 90%
    },

    // Instrucciones
    instrucciones: [
      "Marcar SÍ o NO para cada indicador",
      "Registrar evidencia observable",
      "Marcar como obligatorio cuando sea crítico para el logro",
      "Requiere al menos " + Math.ceil(indicadoresUsar.length * 0.7) + " indicadores cumplidos",
    ],
  };

  return listaCotejo;
};

/**
 * Generar registro anecdótico
 */
export const generarRegistroAnecdotico = ({
  nombre = "Registro Anecdótico",
  tema = "",
  aspectosAObservar = null,
} = {}) => {
  const aspectosDefault = [
    "Participación e interacción",
    "Comprensión de conceptos",
    "Aplicación práctica",
    "Trabajo colaborativo",
    "Expresión de ideas",
    "Reflexión metacognitiva",
  ];

  const aspectosUsar = aspectosAObservar || aspectosDefault;

  const registro = {
    id: `ran-${Date.now()}`,
    nombre,
    tema,
    tipo: TIPO_INSTRUMENTO.REGISTRO_ANECDOTICO,
    descripcion: `Registro anecdótico para documentar observaciones sobre ${tema}`,
    fechaCreacion: new Date().toISOString(),

    // Estructura de registro
    plantilla: {
      estudiante: "",
      fecha: new Date().toISOString().split("T")[0],
      hora: new Date().toTimeString().split(" ")[0],
      aspecto: aspectosUsar[0],
      situacion: "",
      comportamiento: "",
      interpretacion: "",
      acciones: "",
    },

    // Aspectos a observar
    aspectosAObservar: aspectosUsar.map((aspecto, idx) => ({
      id: idx + 1,
      nombre: aspecto,
    })),

    // Preguntas guía
    preguntasGuia: [
      "¿Qué situación específica observé?",
      "¿Cómo se comportó el estudiante?",
      "¿Qué puedo interpretar de este comportamiento?",
      "¿Qué acciones o intervenciones son necesarias?",
    ],

    // Instrucciones
    instrucciones: [
      "Registrar hechos observados, no interpretaciones",
      "Ser específico: quién, cuándo, dónde, qué",
      "Usar lenguaje objetivo y profesional",
      "Distinguir entre hechos e interpretaciones",
      "Proporcionar contexto para la comprensión",
    ],
  };

  return registro;
};

/**
 * Generar instrumento de autoevaluación
 */
export const generarAutoevaluacion = ({ tema = "", criterios = null } = {}) => {
  const criteriosDefault = [
    "Participé activamente en las actividades",
    "Comprendí los conceptos principales",
    "Trabajé colaborativamente con mis compañeros",
    "Entregué evidencias de calidad",
    "Reflexioné sobre mi aprendizaje",
    "Mejoré mis habilidades durante la unidad",
  ];

  const criteriosUsar = criterios || criteriosDefault;

  return {
    id: `aue-${Date.now()}`,
    nombre: "Autoevaluación del Estudiante",
    tema,
    tipo: TIPO_INSTRUMENTO.AUTOEVALUACION,
    descripcion: `Autoevaluación para que el estudiante reflexione sobre su aprendizaje en ${tema}`,
    fechaCreacion: new Date().toISOString(),

    instrucciones: [
      "Lee cada afirmación cuidadosamente",
      "Selecciona el nivel que mejor describe tu desempeño",
      "Sé honesto en tu evaluación",
      "Escribe comentarios adicionales si es necesario",
      "Identifica áreas para mejorar",
    ],

    criterios: criteriosUsar.map((criterio, idx) => ({
      id: idx + 1,
      descripcion: criterio,
      valoracion: null, // 1, 2, 3, 4
      comentarios: "",
    })),

    escala: {
      1: "Totalmente en desacuerdo",
      2: "Parcialmente en desacuerdo",
      3: "Parcialmente de acuerdo",
      4: "Totalmente de acuerdo",
    },

    reflexionesFinales: {
      pregunta1: "¿Cuál fue mi mayor logro en esta unidad?",
      pregunta2: "¿En qué necesito mejorar?",
      pregunta3: "¿Cómo utilizaré estos aprendizajes en el futuro?",
      respuestas: {
        pregunta1: "",
        pregunta2: "",
        pregunta3: "",
      },
    },
  };
};

/**
 * Generar coevaluación entre pares
 */
export const generarCoevaluacion = ({ tema = "", criterios = null } = {}) => {
  const criteriosDefault = [
    "Contribuyó ideas valiosas al grupo",
    "Escuchó y respetó las ideas de otros",
    "Completó sus tareas responsablemente",
    "Ayudó a otros miembros del grupo",
    "Participó en la toma de decisiones",
  ];

  const criteriosUsar = criterios || criteriosDefault;

  return {
    id: `coe-${Date.now()}`,
    nombre: "Coevaluación entre Pares",
    tema,
    tipo: TIPO_INSTRUMENTO.COEVALUACION,
    descripcion: `Coevaluación para que los estudiantes evalúen el desempeño de sus compañeros en ${tema}`,
    fechaCreacion: new Date().toISOString(),

    instrucciones: [
      "Evalúa con honestidad y respeto",
      "Usa criterios objetivos",
      "Proporciona retroalimentación constructiva",
      "Reconoce los aportes de cada compañero",
      "Sugiere mejoras de forma respetuosa",
    ],

    criterios: criteriosUsar.map((criterio, idx) => ({
      id: idx + 1,
      descripcion: criterio,
      fortalezas: "",
      areasParaMejorar: "",
    })),

    formatoEvaluacion: {
      evaluador: "",
      evaluado: "",
      fecha: new Date().toISOString().split("T")[0],
      aspectosPositivos: "",
      sugerenciasConstructivas: "",
    },
  };
};

/**
 * Generar matriz completa de evaluación para una unidad
 */
export const generarMatrizEvaluacion = ({
  tema = "",
  semanas = 4,
  competencias = [],
}) => {
  const matriz = {
    id: `mev-${Date.now()}`,
    tema,
    semanas,
    competencias,
    fechaCreacion: new Date().toISOString(),

    // Planificación de evaluación por semana
    cronograma: generarCronogramaEvaluacion(semanas),

    // Instrumentos por tipo de evaluación
    instrumentos: {
      diagnostica: generarRubrica({
        nombre: "Diagnóstico - " + tema,
        tema,
      }),
      formativa: [
        generarListaCotejo({
          nombre: "Progreso - " + tema,
          tema,
        }),
        generarRegistroAnecdotico({
          nombre: "Observación - " + tema,
          tema,
        }),
      ],
      sumativa: generarRubrica({
        nombre: "Final - " + tema,
        tema,
      }),
    },

    // Instrumentos de autoevaluación
    autoevaluacion: generarAutoevaluacion({ tema }),

    // Instrumentos de coevaluación
    coevaluacion: generarCoevaluacion({ tema }),

    // Rúbrica de integración de competencias
    rubricaCompetencias: generarRubricaCompetencias(competencias),
  };

  return matriz;
};

/**
 * Generar cronograma de evaluación
 */
const generarCronogramaEvaluacion = (semanas) => {
  const cronograma = [];

  for (let s = 1; s <= semanas; s++) {
    const tipoEvalSemana =
      s === 1
        ? TIPO_EVAL.DIAGNOSTICA
        : s === semanas
          ? TIPO_EVAL.SUMATIVA
          : TIPO_EVAL.FORMATIVA;

    cronograma.push({
      semana: s,
      tipoEval: tipoEvalSemana,
      momentos: [
        {
          dia: 1,
          tecnica: TECNICAS_POR_TIPO_EVAL[tipoEvalSemana]?.[0] || "Observación",
        },
        {
          dia: 3,
          tecnica: TECNICAS_POR_TIPO_EVAL[tipoEvalSemana]?.[1] || "Participación",
        },
        {
          dia: 5,
          tecnica: TECNICAS_POR_TIPO_EVAL[tipoEvalSemana]?.[2] || "Trabajo práctico",
        },
      ],
    });
  }

  return cronograma;
};

/**
 * Generar rúbrica de integración de competencias
 */
const generarRubricaCompetencias = (competencias) => {
  return {
    nombre: "Rúbrica de Competencias Integradas",
    competencias: competencias.map((comp) => ({
      id: comp,
      nombre: comp,
      descriptores: {
        inicial: `El estudiante muestra iniciación en el desarrollo de ${comp}`,
        proceso: `El estudiante progresa en el desarrollo de ${comp}`,
        logrado: `El estudiante ha logrado desarrollar ${comp}`,
        profundizado: `El estudiante ha profundizado en ${comp}`,
      },
    })),
  };
};

/**
 * Generar adecuaciones de evaluación para NEAE
 */
export const generarAdecuacionesEvaluacionNEAE = ({
  tipoNEAE = "general",
  area = "",
}) => {
  const adecuaciones = {
    id: `ane-${Date.now()}`,
    tipoNEAE,
    area,
    fechaCreacion: new Date().toISOString(),

    // Adecuaciones de acceso
    acceso: {
      tiempo: "Extender tiempo de evaluación en 25-50%",
      formato: "Proveer formatos alternativos (oral, escrito, práctico)",
      recursos: "Permitir uso de recursos de apoyo (calculadora, diccionario, etc.)",
      ambiente: "Evaluar en ambiente tranquilo con distracciones mínimas",
    },

    // Adecuaciones curriculares
    curricular: {
      contenidos: "Priorizar contenidos esenciales",
      complejidad: "Reducir complejidad manteniendo propósitos",
      cantidad: "Ajustar cantidad de tareas sin comprometer objetivos",
    },

    // Adecuaciones en instrumentos
    instrumentos: {
      rubrica: "Usar criterios simplificados pero significativos",
      listaCotejo: "Reducir indicadores a los esenciales",
      registroAnecdotico: "Documentar avances pequeños pero significativos",
    },

    // Acompañamiento
    acompañamiento: [
      "Retroalimentación frecuente y específica",
      "Modelo y demostración de procedimientos",
      "Apoyo de pares en evaluaciones colaborativas",
      "Refuerzo de conceptos antes de evaluar",
    ],
  };

  return adecuaciones;
};

export default {
  generarRubrica,
  generarListaCotejo,
  generarRegistroAnecdotico,
  generarAutoevaluacion,
  generarCoevaluacion,
  generarMatrizEvaluacion,
  generarAdecuacionesEvaluacionNEAE,
};
