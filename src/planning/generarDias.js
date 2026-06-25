/**
 * generarDias.js
 * Genera planes diarios completos con momentos pedagógicos, actividades y estrategias
 */

import {
  MOMENTOS_PEDAGOGICOS,
  ESTRATEGIAS_ENSENANZA,
  TIPO_EVAL,
  AGENTE_EVAL,
} from "./catalogs.js";

/**
 * Actividades por tipo de momento (Inicio, Desarrollo, Cierre)
 */
const ACTIVIDADES_POR_MOMENTO = {
  Inicio: [
    "Lluvia de ideas sobre el tema",
    "Preguntas provocadoras para activar conocimientos previos",
    "Visualización o presentación de un escenario/problema",
    "Dinámicas o juegos para enganchar la atención",
    "Presentación del propósito de la clase",
    "Vinculación con aprendizajes anteriores",
  ],
  Desarrollo: [
    "Exposición participativa de conceptos",
    "Trabajo colaborativo en pequeños grupos",
    "Investigación o indagación guiada",
    "Resolución de problemas prácticos",
    "Análisis de casos o ejemplos",
    "Construcción de modelos o prototipos",
    "Aplicación de procedimientos o técnicas",
    "Lectura y análisis de textos",
    "Experimentación o demostración",
    "Uso de tecnología educativa",
  ],
  Cierre: [
    "Síntesis colaborativa de aprendizajes",
    "Preguntas de reflexión metacognitiva",
    "Socialización de productos o resultados",
    "Clarificación de dudas",
    "Establecimiento de compromisos para mejorar",
    "Anticipación de la próxima clase",
    "Recolección de evidencias de aprendizaje",
  ],
};

// Estrategias específicas por tipo de contenido (disponibles en ESTRATEGIAS_ENSENANZA)

/**
 * Recursos por momento pedagógico
 */
const RECURSOS_POR_MOMENTO = {
  Inicio: {
    humanos: ["Docente facilitador", "Estudiantes"],
    didacticos: ["Presentación visual", "Preguntas guía", "Materiales motivadores"],
    tecnologicos: ["Proyector/pantalla", "Audio/vídeo introductorio"],
  },
  Desarrollo: {
    humanos: [
      "Docente",
      "Estudiantes (individual y colaborativo)",
      "Expertos/asesores según contenido",
    ],
    didacticos: [
      "Textos de referencia",
      "Guías de trabajo",
      "Materiales concretos",
      "Fichas de actividades",
    ],
    tecnologicos: [
      "Computadoras/tablets",
      "Software educativo",
      "Plataformas digitales",
      "Recursos en línea",
    ],
  },
  Cierre: {
    humanos: ["Docente", "Estudiantes", "Posibles invitados"],
    didacticos: ["Formato de reflexión", "Rúbrica", "Portafolio"],
    tecnologicos: ["Registro digital", "Presentación"],
  },
};

/**
 * Generar un momento pedagógico completo
 */
const generarMomento = ({
  tipo = "Inicio",
  dia = 1,  semana = 1,  tema = "",
  tipoEval = TIPO_EVAL.FORMATIVA,
  instrumento = null,
  intencion = "",
}) => {
  const moment = MOMENTOS_PEDAGOGICOS[tipo.toUpperCase()];
  if (!moment) return null;

  // Seleccionar actividades aleatorias del tipo
  const actividadesDisponibles = ACTIVIDADES_POR_MOMENTO[tipo] || [];
  const numActividades = tipo === "Inicio" ? 2 : tipo === "Desarrollo" ? 4 : 2;
  const actividades = seleccionarAleatorios(actividadesDisponibles, numActividades);

  // Generar descripción contextualizada
  const descripcionActividades = actividades.map((act, idx) => ({
    orden: idx + 1,
    descripcion: act,
    duracion: `${Math.floor(moment.tiempo / numActividades)} min`,
    materiales: generarMateriales(act),
  }));

  // Evalución específica del momento
  const evaluacion = {
    tipo: tipoEval,
    agente: AGENTE_EVAL.HETERO,
    tecnica: generarTecnicaPorMomento(tipo),
    instrumento: instrumento || `observacion_${tipo.toLowerCase()}`,
    criterios: generarCriteriosMomento(tipo),
    evidencia: generarEvidenciaMomento(tipo, tema),
  };

  return {
    id: `mom-${Date.now()}-${tipo}`,
    tipo,
    numero: tipo === "Inicio" ? 1 : tipo === "Desarrollo" ? 2 : 3,
    semana,
    dia,
    tiempo: moment.tiempo,
    proposito: moment.proposito,
    intencion: intencion || generarIntencionMomento(tipo),

    // Actividades
    actividades: descripcionActividades,

    // Evaluación
    evaluacion,

    // Recursos
    recursos: {
      humanos: RECURSOS_POR_MOMENTO[tipo]?.humanos || [],
      didacticos: RECURSOS_POR_MOMENTO[tipo]?.didacticos || [],
      tecnologicos: RECURSOS_POR_MOMENTO[tipo]?.tecnologicos || [],
    },

    // Metacognición específica del momento
    metacognicion: [
      generarPreguntaMeta(tipo, 1),
      generarPreguntaMeta(tipo, 2),
      generarPreguntaMeta(tipo, 3),
    ],

    // Notas para el docente
    notasDocente: generarNotasDocente(tipo, tema),

    // Adecuaciones NEAE
    adecuacionesNEAE: generarAdecuacionesMomento(tipo),
  };
};

/**
 * Seleccionar elementos aleatorios de un array
 */
const seleccionarAleatorios = (array, cantidad) => {
  const copia = [...array];
  const resultado = [];
  for (let i = 0; i < Math.min(cantidad, array.length); i++) {
    const idx = Math.floor(Math.random() * copia.length);
    resultado.push(copia[idx]);
    copia.splice(idx, 1);
  }
  return resultado;
};

/**
 * Generar intención contextualizada al momento
 */
const generarIntencionMomento = (tipo) => {
  const intenciones = {
    Inicio: [
      "Activar conocimientos previos",
      "Generar curiosidad e interés",
      "Establecer propósito claro",
      "Crear ambiente colaborativo",
    ],
    Desarrollo: [
      "Construir nuevos conocimientos",
      "Desarrollar habilidades específicas",
      "Facilitar experiencias prácticas",
      "Promover pensamiento crítico",
    ],
    Cierre: [
      "Sintetizar aprendizajes",
      "Promover reflexión profunda",
      "Generar transferencia",
      "Evaluar desempeño",
    ],
  };

  const opcionesLocal = intenciones[tipo] || intenciones.Inicio;
  return opcionesLocal[Math.floor(Math.random() * opcionesLocal.length)];
};

/**
 * Generar materiales necesarios para una actividad
 */
const generarMateriales = (actividad) => {
  const materialesPorActividad = {
    lluvia: ["Pizarrón", "Marcadores", "Papelógrafos"],
    preguntas: ["Guía de preguntas", "Tarjetas"],
    presentación: ["Proyector", "Computadora", "Presentación digital"],
    dinámicas: ["Espacio amplio", "Materiales lúdicos"],
    exposición: ["Presentación", "Recursos visuales"],
    colaborativo: ["Guías de trabajo", "Materiales de referencia"],
    investigación: ["Textos", "Internet", "Materiales de laboratorio"],
    problemas: ["Enunciados de problemas", "Materiales concretos"],
    análisis: ["Textos", "Casos de estudio"],
    construcción: ["Materiales concretos", "Herramientas"],
    aplicación: ["Procedimientos", "Herramientas específicas"],
    lectura: ["Textos", "Guías de lectura"],
    experimentación: ["Equipamiento", "Materiales de laboratorio"],
    tecnología: ["Computadoras", "Software", "Internet"],
    síntesis: ["Formatos de síntesis", "Papelógrafos"],
    reflexión: ["Cuestionarios", "Diarios"],
    socialización: ["Formato de presentación"],
    dudas: ["Apoyo docente"],
    compromiso: ["Registro de compromisos"],
    anticipación: ["Vista previa de próxima sesión"],
    recolección: ["Portafolio", "Rúbrica"],
  };

  for (const [clave, materiales] of Object.entries(materialesPorActividad)) {
    if (actividad.toLowerCase().includes(clave)) {
      return materiales;
    }
  }

  return ["Materiales de referencia"];
};

/**
 * Generar técnica de evaluación para el momento
 */
const generarTecnicaPorMomento = (tipo) => {
  const tecnicas = {
    Inicio: "Observación inicial",
    Desarrollo: "Observación sistemática y trabajos prácticos",
    Cierre: "Presentación de evidencias",
  };
  return tecnicas[tipo] || "Observación";
};

/**
 * Generar criterios específicos del momento
 */
const generarCriteriosMomento = (tipo) => {
  const criterios = {
    Inicio: [
      "Participa en actividades iniciales",
      "Expresa conocimientos previos",
      "Muestra disponibilidad para aprender",
    ],
    Desarrollo: [
      "Trabaja colaborativamente",
      "Comprende conceptos",
      "Aplica procedimientos",
      "Propone soluciones",
    ],
    Cierre: [
      "Sintetiza aprendizajes",
      "Reflexiona sobre proceso",
      "Identifica progresos",
      "Propone mejoras",
    ],
  };
  return criterios[tipo] || [];
};

/**
 * Generar tipo de evidencia para el momento
 */
const generarEvidenciaMomento = (tipo, tema) => {
  const evidencias = {
    Inicio: `Respuestas iniciales sobre ${tema}`,
    Desarrollo: `Trabajos prácticos que demuestren comprensión de ${tema}`,
    Cierre: `Síntesis y reflexión sobre ${tema}`,
  };
  return evidencias[tipo] || "Participación";
};

/**
 * Generar pregunta metacognitiva para el momento
 */
const generarPreguntaMeta = (tipo, numero) => {
  const preguntas = {
    Inicio: [
      "¿Qué sé ya sobre este tema?",
      "¿Qué me interesa aprender?",
      "¿Cómo se relaciona con mis experiencias?",
    ],
    Desarrollo: [
      "¿Cómo estoy construyendo nuevos conocimientos?",
      "¿Qué estrategias estoy usando?",
      "¿Dónde tengo dudas?",
    ],
    Cierre: [
      "¿Qué aprendí hoy?",
      "¿Cómo usaré esto en el futuro?",
      "¿Qué debo mejorar?",
    ],
  };

  const opcionesLocal = preguntas[tipo] || preguntas.Inicio;
  return opcionesLocal[numero - 1] || opcionesLocal[0];
};

/**
 * Generar notas para el docente
 */
const generarNotasDocente = (tipo) => {
  const notas = {
    Inicio:
      "Mantener un clima de confianza. Escuchar activamente las respuestas de los estudiantes.",
    Desarrollo:
      "Circular por el aula observando el trabajo. Proporcionar andamiaje según necesidades. Hacer preguntas que promuevan pensamiento crítico.",
    Cierre:
      "Permitir que varios estudiantes compartan. Conectar síntesis con propósito inicial. Enfatizar aprendizajes clave.",
  };

  return notas[tipo] || "Observar y apoyar a los estudiantes según necesidades";
};

/**
 * Generar adecuaciones NEAE para el momento
 */
const generarAdecuacionesMomento = (tipo) => {
  return {
    tiempoAdicional: tipo === "Desarrollo" ? "15-20 min adicionales" : "5-10 min adicionales",
    apoyoAdicional: "Asignación de tutor par o apoyo docente",
    formatoAlternativo: "Permitir respuestas orales vs. escritas",
    ambiente: "Ubicación estratégica en el aula, distracciones mínimas",
    materiales: "Versiones simplificadas de guías y materiales",
  };
};

/**
 * Generar un día completo de clase
 */
export const generarDia = ({
  n = 1,
  semana = 1,
  tema = "",
  competencia = "",
  tipoEval = TIPO_EVAL.FORMATIVA,
  estrategia = ESTRATEGIAS_ENSENANZA.COOPERATIVA,
  conMomentos = false,
  horario = "8:00 AM - 3:00 PM",
  grado = "2do",
}) => {
  // Generar intención pedagógica del día
  const intencionDia = generarIntencionDia(semana, n, tema);

  // Generar estrategia contextualizada
  const estrategiaAdecuada = estrategia || ESTRATEGIAS_ENSENANZA.COOPERATIVA;

  // Crear momentos si se requiere
  let momentos = undefined;
  if (conMomentos) {
    momentos = [
      generarMomento({
        tipo: "Inicio",
        dia: n,
        semana,
        tema,
        tipoEval,
        intencion: intencionDia,
      }),
      generarMomento({
        tipo: "Desarrollo",
        dia: n,
        semana,
        tema,
        tipoEval,
        intencion: intencionDia,
      }),
      generarMomento({
        tipo: "Cierre",
        dia: n,
        semana,
        tema,
        tipoEval,
        intencion: intencionDia,
      }),
    ];
  }

  const dia = {
    id: `dia-${Date.now()}-${n}`,
    n,
    semana,
    tema,
    competencia,
    horario,
    grado,

    // Identificación
    titulo: `Día ${n}: ${intencionDia}`,
    gramatica: generarGramatica(tema),
    estrategia: estrategiaAdecuada,
    intencion: intencionDia,

    // Evaluación
    tipoEval,
    instrumentos: generarInstrumentosDia(tipoEval),
    evidencia: generarEvidenciaDia(tema),

    // Momentos pedagógicos (si aplica)
    momentos,

    // Estructura alternativa si no hay momentos
    ...(
      !conMomentos && {
        duracion: 45,
        actividades: generarActividadesDia(estrategiaAdecuada, tema),
        recursos: {
          humanos: ["Docente", "Estudiantes"],
          didacticos: ["Materiales de referencia", "Guías de trabajo"],
          tecnologicos: ["Computadora", "Proyector"],
        },
      }
    ),

    // Metacognición
    metacognicion: [
      "¿Qué aprendí hoy?",
      "¿Cómo lo aprendí?",
      "¿Cómo usaré esto en el futuro?",
    ],

    // Seguimiento
    observaciones: "",
    ajustesParaProxima: "",
  };

  return dia;
};

/**
 * Generar intención del día según semana y contexto
 */
const generarIntencionDia = (semana, _dia, tema) => {
  const frases = {
    1: `Explorar ${tema} a través de experiencias iniciales`,
    2: `Analizar aspectos clave de ${tema}`,
    3: `Profundizar en la comprensión de ${tema}`,
    4: `Aplicar y practicar ${tema}`,
    5: `Sintetizar y transferir lo aprendido sobre ${tema}`,
    6: `Evaluar y reflexionar sobre ${tema}`,
  };

  return frases[semana] || `Desarrollar competencias en ${tema}`;
};

/**
 * Generar gramática/contenido específico
 */
const generarGramatica = (tema) => {
  // Esto podría expandirse según el tema específico
  return `Contenido relacionado a: ${tema}`;
};

/**
 * Generar instrumentos para el día
 */
const generarInstrumentosDia = (tipoEval) => {
  const instrumentos = {
    diagnostica: ["Preguntas exploratorias", "Observación inicial"],
    formativa: ["Lista de cotejo", "Registro de participación"],
    sumativa: ["Rúbrica", "Prueba escrita"],
  };

  return instrumentos[tipoEval] || ["Observación"];
};

/**
 * Generar evidencia esperada del día
 */
const generarEvidenciaDia = (tema) => {
  return `Registros de participación, trabajos prácticos, y reflexiones sobre ${tema}`;
};

/**
 * Generar actividades del día (versión compacta)
 */
const generarActividadesDia = (estrategia, tema) => {
  return [
    `1. Actividad inicial para activar conocimientos sobre ${tema}`,
    `2. Explicación/presentación con participación activa`,
    `3. Trabajo colaborativo aplicando ${estrategia.toLowerCase()}`,
    `4. Práctica independiente o en pares`,
    `5. Cierre reflexivo y anticipación`,
  ];
};

export default {
  generarDia,
  generarMomento,
};
