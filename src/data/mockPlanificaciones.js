// Mock data de planificaciones por materia y nivel
// Esta estructura sirve como base para la IA antes de conectar con OpenAI

export const mockPlanificaciones = {
  // INGLÉS - SECUNDARIA
  "2do Secundaria-Inglés-Daily Routines": {
    competencia:
      "Comprende y se expresa sobre actividades cotidianas en inglés con fluidez.",
    indicadores: [
      "Identifica vocabulario relacionado con rutinas diarias",
      "Construye oraciones sobre sus actividades diarias",
      "Participa en conversaciones sobre rutinas",
      "Produce textos cortos describiendo su rutina",
      "Utiliza presente simple correctamente"
    ],
    contenidos: {
      conceptuales: [
        "Vocabulario de actividades diarias (wake up, breakfast, work, etc.)",
        "Presente simple: estructura y uso",
        "Adverbios de frecuencia (always, usually, sometimes, never)",
        "Conectores de secuencia (first, then, finally)"
      ],
      procedimentales: [
        "Pronunciación correcta del vocabulario",
        "Construcción de oraciones con presente simple",
        "Lectura de textos sobre rutinas",
        "Producción oral de diálogos"
      ],
      actitudinales: [
        "Respeto por diversas rutinas culturales",
        "Confianza al expresarse en inglés",
        "Valoración de la comunicación clara"
      ]
    },
    estrategias: [
      "Enseñanza basada en diálogos auténticos",
      "Aprendizaje cooperativo con juegos de rol",
      "Pensamiento crítico: comparar rutinas de diferentes culturas",
      "Diferenciación: actividades según nivel de competencia"
    ],
    actividades: [
      "Presentación oral: describe tu rutina diaria",
      "Diálogos en parejas: preguntar y responder sobre rutinas",
      "Lectura comprensiva: texto sobre rutina de un personaje famoso",
      "Escritura: redacta tu rutina ideal",
      "Proyecto: crea un folleto con rutina de una celebridad"
    ],
    evidencias: [
      "Participación en diálogos orales",
      "Textos escritos coherentes",
      "Presentación oral sin apoyo visual",
      "Proyecto colaborativo completado"
    ],
    evaluacion:
      "Rúbrica analítica: fluidez (20%), precisión gramatical (30%), vocabulario (20%), participación (30%)"
  },

  // FRANCÉS - SECUNDARIA
  "2do Secundaria-Francés-Viajes y Turismo": {
    competencia:
      "Comprende y se expresa sobre destinos turísticos en francés de manera efectiva.",
    indicadores: [
      "Identifica vocabulario de viajes y hoteles",
      "Reserva servicios turísticos usando expresiones adecuadas",
      "Lee folletos turísticos en francés",
      "Describe un viaje de forma oral y escrita",
      "Utiliza tiempo pasado (passé composé) correctamente"
    ],
    contenidos: {
      conceptuales: [
        "Vocabulario: transporte, hospedaje, atracciones turísticas",
        "Passé composé: formación y uso",
        "Futuro próximo (aller + infinitivo)",
        "Adjetivos descriptivos para lugares"
      ],
      procedimentales: [
        "Pronunciación de nombres de destinos",
        "Lectura de descripciones de viajes",
        "Escritura de postales desde un viaje",
        "Presentación oral: itinerario de viaje"
      ],
      actitudinales: [
        "Valoración de la diversidad de destinos",
        "Interés por culturas francófonas",
        "Confianza en planificación de viajes"
      ]
    },
    estrategias: [
      "Aprendizaje basado en proyectos: planificar un viaje virtual",
      "Uso de materiales auténticos: folletos, mapas",
      "Juego de rol: agente de viajes",
      "Diferenciación: viajes nacionales e internacionales"
    ],
    actividades: [
      "Investigación: destinos francófonos más visitados",
      "Juego: agente de viajes - reserva un hotel",
      "Lectura: análisis de página web de turismo",
      "Escritura: narración de un viaje imaginario",
      "Proyecto: crear brochure de destino francófono"
    ],
    evidencias: [
      "Diálogos de reservación grabados",
      "Postales y textos escritos",
      "Presentación del proyecto de viaje",
      "Participación en juegos de rol"
    ],
    evaluacion:
      "Rúbrica: comprensión (25%), expresión oral (25%), escritura (25%), proyecto (25%)"
  },

  // PRIMARIA - INGLÉS
  "6to Primaria-Inglés-Family Members": {
    competencia:
      "Identifica y nombra miembros de la familia en inglés de forma clara.",
    indicadores: [
      "Reconoce vocabulario de la familia",
      "Describe a miembros de su familia",
      "Crea frases sobre relaciones familiares",
      "Participa en actividades sobre familia",
      "Comprende textos cortos sobre familias"
    ],
    contenidos: {
      conceptuales: [
        "Vocabulario: family members (mother, father, sister, etc.)",
        "Adjetivos posesivos (my, your, his, her)",
        "Verbo 'to be' con pronombres",
        "Números para edades"
      ],
      procedimentales: [
        "Pronunciación correcta de miembros de la familia",
        "Elaboración de árboles genealógicos",
        "Descripción oral de fotos familiares",
        "Escritura de oraciones simples"
      ],
      actitudinales: [
        "Valoración de la familia",
        "Respeto por diferentes tipos de familia",
        "Confianza al hablar del tema"
      ]
    },
    estrategias: [
      "Enseñanza multisensorial: canciones, movimientos",
      "Aprendizaje colaborativo: pares",
      "Juegos educativos: memory, bingo",
      "Diferenciación: tarjetas de colores"
    ],
    actividades: [
      "Canción: 'The Family Song' con movimientos",
      "Juego: bingo de miembros de la familia",
      "Actividad: dibujar y etiquetar familia",
      "Presentación: presenta tu familia a la clase",
      "Proyecto: árbol genealógico decorado"
    ],
    evidencias: [
      "Participación en canción y juegos",
      "Trabajo práctico: árbol genealógico",
      "Presentación oral",
      "Fichas de trabajo completadas"
    ],
    evaluacion:
      "Observación directa, lista de cotejo, autoevaluación de participación"
  },

  // RELACIONES HUMANAS - PRIMARIA
  "6to Primaria-Relaciones Humanas-Emociones": {
    competencia:
      "Identifica, expresa y gestiona emociones de manera saludable en contextos sociales.",
    indicadores: [
      "Reconoce emociones básicas en sí mismo y otros",
      "Expresa emociones con palabras adecuadas",
      "Utiliza estrategias para manejar emociones",
      "Identifica causas de emociones",
      "Muestra empatía hacia los demás"
    ],
    contenidos: {
      conceptuales: [
        "Emociones básicas: alegría, tristeza, miedo, ira",
        "Causas de las emociones",
        "Expresiones faciales y corporales",
        "Diferencia entre emoción y acción"
      ],
      procedimentales: [
        "Identificación de emociones en imágenes",
        "Expresión corporal de emociones",
        "Técnicas de relajación: respiración profunda",
        "Comunicación asertiva"
      ],
      actitudinales: [
        "Aceptación de propias emociones",
        "Empatía hacia otros",
        "Responsabilidad sobre acciones",
        "Apertura a diferentes perspectivas"
      ]
    },
    estrategias: [
      "Educación socioemocional: círculos de diálogo",
      "Aprendizaje experiencial: dramatizaciones",
      "Mindfulness: meditación guiada",
      "Diferenciación: historias según contexto"
    ],
    actividades: [
      "Juego: adivina mi emoción con gestos",
      "Círculo: comparte una emoción que sentiste hoy",
      "Lectura: cuento sobre gestión emocional",
      "Técnica: ejercicio de respiración y relajación",
      "Proyecto: diario emocional de una semana"
    ],
    evidencias: [
      "Participación en círculos de diálogo",
      "Dramatizaciones realizadas",
      "Diario emocional completado",
      "Uso de técnicas de relajación"
    ],
    evaluacion:
      "Observación participante, rúbrica de participación, autoevaluación reflexiva"
  }
};

/**
 * Función para obtener mock data según parámetros
 * @param {string} curso - "2do Secundaria", "6to Primaria", etc.
 * @param {string} materia - "Inglés", "Francés", "Relaciones Humanas", etc.
 * @param {string} tema - Tema específico
 * @returns {object} Datos de planificación o generación genérica
 */
export const obtenerMockPlanificacion = (curso, materia, tema) => {
  const clave = `${curso}-${materia}-${tema}`;
  
  // Si existe la combinación exacta, devolverla
  if (mockPlanificaciones[clave]) {
    return mockPlanificaciones[clave];
  }

  // Si no, generar una planificación genérica
  return generarPlanificacionGenerica(curso, materia, tema);
};

/**
 * Genera una planificación genérica para cualquier curso/materia/tema
 */
function generarPlanificacionGenerica(curso, materia, tema) {
  const esPrimaria = curso.includes("Primaria");
  const esIdioma = materia.includes("Inglés") || materia.includes("Francés");

  return {
    competencia: `Comprende y aplica conceptos de ${tema} en contextos significativos de ${materia}.`,
    indicadores: [
      `Identifica información clave sobre ${tema}`,
      `Expresa ideas claras relacionadas con ${tema}`,
      `Aplica aprendizajes de ${tema} en situaciones reales`,
      `Colabora efectivamente en actividades sobre ${tema}`,
      esPrimaria
        ? "Participa activamente en todas las actividades"
        : `Demuestra pensamiento crítico sobre ${tema}`
    ],
    contenidos: {
      conceptuales: [
        `Conceptos fundamentales de ${tema}`,
        `Características principales de ${tema}`,
        `Conexiones con conocimientos previos`
      ],
      procedimentales: [
        `Identificación de elementos de ${tema}`,
        esIdioma
          ? `Práctica de comunicación sobre ${tema}`
          : `Análisis y síntesis de información`,
        `Producción de materiales sobre ${tema}`
      ],
      actitudinales: [
        `Interés por aprender sobre ${tema}`,
        `Respeto por diferentes perspectivas`,
        `Compromiso con la calidad del trabajo`
      ]
    },
    estrategias: [
      esPrimaria
        ? "Enseñanza lúdica: juegos y actividades prácticas"
        : "Enseñanza basada en proyectos",
      "Aprendizaje colaborativo",
      esIdioma
        ? "Inmersión en contextos auténticos"
        : "Pensamiento crítico y reflexivo",
      "Diferenciación según ritmo de aprendizaje"
    ],
    actividades: [
      "Presentación interactiva del tema",
      esPrimaria
        ? "Juego educativo sobre el tema"
        : "Debate o discusión sobre el tema",
      esIdioma
        ? `Diálogos sobre ${tema}`
        : `Lectura y análisis de textos`,
      esPrimaria
        ? `Actividad práctica sobre ${tema}`
        : `Proyecto colaborativo sobre ${tema}`,
      "Reflexión y metacognición"
    ],
    evidencias: [
      "Participación en actividades",
      esIdioma ? "Diálogos grabados" : "Trabajos escritos",
      "Proyecto completado",
      "Autoevaluación reflexiva"
    ],
    evaluacion: esPrimaria
      ? "Observación directa, lista de cotejo, autoevaluación"
      : "Rúbrica analítica, evaluación por pares, autoevaluación"
  };
}
