/**
 * generarSituacion.js
 * Genera situaciones de aprendizaje contextualizadas por área, grado y competencia
 * Basada en problemas reales del entorno del estudiante
 */

import {
  PROPOSITOS_POR_AREA,
} from "./catalogs.js";

/**
 * Contextos de aprendizaje por área
 * Cada área tiene ambientes y situaciones típicas
 */
const CONTEXTOS_POR_AREA = {
  LENGUA_ESPANIOL: {
    ambientes: [
      "aula escolar",
      "biblioteca",
      "periódico escolar",
      "red social educativa",
      "encuentro comunitario",
    ],
    situaciones: [
      "comunicación efectiva entre compañeros",
      "expresión de sentimientos e ideas",
      "análisis de noticias y eventos",
      "creación de historias y narrativas",
      "debate sobre temas sociales",
    ],
    contextos: [
      "familia y escuela",
      "amigos y comunidad",
      "trabajo y profesiones",
      "medios de comunicación",
      "tecnología y redes sociales",
    ],
  },
  MATEMATICA: {
    ambientes: [
      "aula de clase",
      "tienda o mercado",
      "laboratorio matemático",
      "jardín escolar",
      "campo o comunidad",
    ],
    situaciones: [
      "cálculos cotidianos y presupuestos",
      "medidas y proporciones",
      "resolución de problemas prácticos",
      "análisis de datos e información",
      "construcción y diseño",
    ],
    contextos: [
      "compras y gastos personales",
      "agricultura y economía",
      "salud y estadísticas",
      "construcción e ingeniería",
      "deporte y recreación",
    ],
  },
  CIENCIAS_NATURALES: {
    ambientes: [
      "laboratorio científico",
      "campo o naturaleza",
      "huerto escolar",
      "invernadero",
      "aula con equipamiento",
    ],
    situaciones: [
      "observación de fenómenos naturales",
      "experimentación e indagación",
      "cuidado del medio ambiente",
      "comprensión del cuerpo humano",
      "ciclos y procesos naturales",
    ],
    contextos: [
      "ecosistema local",
      "salud y bienestar",
      "sostenibilidad",
      "tecnología ambiental",
      "fenómenos atmosféricos",
    ],
  },
  CIENCIAS_SOCIALES: {
    ambientes: [
      "aula de clase",
      "museo local",
      "comunidad",
      "biblioteca",
      "espacios históricos",
    ],
    situaciones: [
      "análisis de cambios históricos",
      "comprensión de culturas",
      "participación ciudadana",
      "resolución de conflictos",
      "valoración del patrimonio",
    ],
    contextos: [
      "historia local y nacional",
      "diversidad cultural",
      "organización social",
      "valores y ética",
      "ciudadanía y derechos",
    ],
  },
  INGLES: {
    ambientes: [
      "aula de inglés",
      "zona de interacción",
      "plataforma virtual",
      "sala multimedia",
      "eventos interculturales",
    ],
    situaciones: [
      "interacción con hablantes de inglés",
      "comprensión de medios en inglés",
      "comunicación intercultural",
      "expresión de experiencias personales",
      "colaboración internacional",
    ],
    contextos: [
      "vida cotidiana del estudiante",
      "tecnología y redes sociales",
      "viajes y turismo",
      "educación y oportunidades",
      "entretenimiento y cultura",
    ],
  },
  FRANCES: {
    ambientes: [
      "aula de francés",
      "zona de interacción",
      "plataforma digital",
      "espacios de francophonía",
      "encuentros culturales",
    ],
    situaciones: [
      "interacción en francés",
      "conocimiento de culturas francófonas",
      "comunicación intercultural",
      "expresión de experiencias",
      "valoración de la francofonía",
    ],
    contextos: [
      "vida personal y familia",
      "comunidad global francófona",
      "arte y cultura francesa",
      "relaciones internacionales",
      "educación y oportunidades",
    ],
  },
};

/**
 * Templates de problemas contextuales por área y grado
 */
const PROBLEMAS_CONTEXTUALES = {
  PRIMARIA: {
    LENGUA_ESPANIOL: [
      "Mi escuela necesita crear un periódico que comunique las noticias más importantes a toda la comunidad",
      "Debo escribir una carta formal a una institución para solicitar información importante",
      "Necesito comprender y analizar las noticias para estar informado sobre lo que sucede en mi comunidad",
      "Queremos crear un banco de historias de nuestros abuelos para preservar la memoria familiar",
    ],
    MATEMATICA: [
      "Vamos a organizar un evento escolar y necesitamos calcular presupuestos, precios y ganancias",
      "Mi familia necesita ayuda para entender las facturas y presupuestos del hogar",
      "Debo medir y calcular para un proyecto de construcción en la escuela o comunidad",
      "Necesito analizar datos de mi entorno (temperaturas, estadísticas del barrio) para sacar conclusiones",
    ],
    CIENCIAS_NATURALES: [
      "Mi comunidad enfrenta problemas ambientales y necesitamos investigar cómo ayudar",
      "Queremos mejorar la salud de nuestras familias investigando hábitos saludables",
      "Vamos a crear un huerto escolar para producir alimentos y entender procesos naturales",
      "Necesitamos entender cómo funcionan los sistemas naturales de nuestro entorno",
    ],
    CIENCIAS_SOCIALES: [
      "Queremos documentar la historia de nuestra comunidad para valorar nuestras raíces",
      "Vamos a investigar cómo vivían nuestros antepasados y cómo ha cambiado la vida",
      "Mi familia tiene migrantes y queremos comprender diferentes culturas y contextos",
      "Necesitamos aprender sobre nuestros derechos y responsabilidades como ciudadanos",
    ],
  },
  SECUNDARIA: {
    LENGUA_ESPANIOL: [
      "Vamos a crear una campaña de sensibilización sobre un tema social importante usando textos persuasivos",
      "Debo analizar críticamente textos de medios para evaluar su veracidad y propósito",
      "Queremos producir un documental escrito sobre un problema local que afecta a mi comunidad",
      "Necesito comunicarme profesionalmente con instituciones para un proyecto de investigación",
    ],
    MATEMATICA: [
      "Debo analizar datos estadísticos sobre problemas socioeconómicos de mi zona y proponer soluciones",
      "Vamos a diseñar un plan financiero para un emprendimiento estudiantil",
      "Necesito aplicar funciones y modelos matemáticos para comprender fenómenos reales",
      "Queremos investigar relaciones matemáticas en arte, arquitectura o naturaleza",
    ],
    CIENCIAS_NATURALES: [
      "Mi comunidad necesita un plan de sostenibilidad ambiental que investiguemos científicamente",
      "Vamos a investigar una enfermedad o problema de salud que afecta a nuestro entorno",
      "Necesito entender procesos científicos complejos que expliquen el mundo natural",
      "Queremos desarrollar soluciones tecnológicas para problemas ambientales locales",
    ],
    CIENCIAS_SOCIALES: [
      "Vamos a investigar un evento histórico para comprender su impacto en la sociedad actual",
      "Necesito analizar conflictos sociales y proponer soluciones basadas en valores",
      "Queremos comprender la globalización y su impacto en nuestra comunidad",
      "Debo investigar cómo funcionan las instituciones políticas y económicas de mi país",
    ],
    INGLES: [
      "Vamos a comunicarnos con estudiantes de otros países para intercambiar experiencias en inglés",
      "Necesito comprender contenidos en inglés sobre temas de mi interés (tecnología, deporte, arte)",
      "Queremos crear un proyecto de difusión cultural donde compartimos nuestra identidad en inglés",
      "Voy a presentar mis logros y aspiraciones en inglés para oportunidades internacionales",
    ],
  },
};

/**
 * Actores relevantes por área
 */
const ACTORES_POR_AREA = {
  LENGUA_ESPANIOL: [
    "escritores",
    "periodistas",
    "editores",
    "comunidad local",
    "familia",
  ],
  MATEMATICA: ["comerciantes", "ingenieros", "analistas", "empresarios", "comunidad"],
  CIENCIAS_NATURALES: [
    "científicos",
    "ambientalistas",
    "médicos",
    "agricultores",
    "comunidad",
  ],
  CIENCIAS_SOCIALES: [
    "historiadores",
    "antropólogos",
    "líderes comunitarios",
    "políticos",
    "ciudadanía",
  ],
  INGLES: [
    "hablantes nativos",
    "estudiantes internacionales",
    "profesionales globales",
    "comunidad educativa",
  ],
};

/**
 * Generar una situación de aprendizaje completa y contextualizada
 * @param {Object} params - { area, grado, competencia, tema, duracion }
 * @returns {Object} Situación con descripción, ambiente, actores, problema, propósito
 */
export const generarSituacion = ({
  area = "Lengua Española",
  grado = "2do",
  competencia = "",
  tema = "",
  duracion = 4,
} = {}) => {
  // Determinar si es primaria o secundaria
  const gradoNum = parseInt(grado);
  const esPrimaria = gradoNum <= 6;
  const problemas = esPrimaria
    ? PROBLEMAS_CONTEXTUALES.PRIMARIA
    : PROBLEMAS_CONTEXTUALES.SECUNDARIA;

  // Obtener contextos
  const contextoArea = CONTEXTOS_POR_AREA[area] || CONTEXTOS_POR_AREA.LENGUA_ESPANIOL;
  const problemaPrincipal = problemas[area]?.[Math.floor(Math.random() * 4)] || problemas.LENGUA_ESPANIOL?.[0];

  // Seleccionar elementos aleatorios
  const ambiente = contextoArea.ambientes[Math.floor(Math.random() * contextoArea.ambientes.length)];
  const situacion = contextoArea.situaciones[Math.floor(Math.random() * contextoArea.situaciones.length)];
  const contexto = contextoArea.contextos[Math.floor(Math.random() * contextoArea.contextos.length)];
  const actores = ACTORES_POR_AREA[area] || [];
  const actorPrincipal = actores[Math.floor(Math.random() * actores.length)];

  // Obtener propósitos del área
  const propositos = PROPOSITOS_POR_AREA[area] || [];
  const proposito = propositos[Math.floor(Math.random() * propositos.length)];

  // Construir narrativa de la situación (3-5 párrafos)
  const narrativa = `
En el contexto de ${ambiente} y considerando la importancia de ${contexto}, surge la necesidad de abordar la siguiente situación: ${problemaPrincipal}

Esta situación requiere que ${grado === "1" || grado === "2" || grado === "3" ? "los estudiantes comprendan" : "los estudiantes analicen críticamente"} ${situacion.toLowerCase()} como parte fundamental de su desarrollo integral. ${competencia ? `La competencia "${competencia}" resulta esencial para` : "Es necesario"} enfrentar este desafío de manera reflexiva y contextualizada.

Los actores involucrados en esta situación incluyen a ${actorPrincipal}s de la comunidad, quienes aportarán perspectivas valiosas y experiencias concretas. La interacción con estos actores permitirá que los estudiantes comprendan la aplicabilidad real de los contenidos que aprenderán.

Durante estas ${duracion} semanas, los estudiantes desarrollarán habilidades de análisis, comunicación y resolución de problemas mientras trabajan en la producción de evidencias que demuestren su avance hacia la competencia establecida.

La reflexión metacognitiva será fundamental, permitiendo que cada estudiante comprenda cómo aprendió, qué estrategias fueron efectivas, y cómo puede transferir estos aprendizajes a nuevas situaciones.
  `.trim();

  // Ambiente expandido (2+ párrafos)
  const ambienteExpandido = `
El ${ambiente} funciona como espacio donde confluyen experiencias, perspectivas y materiales que enriquecen el aprendizaje. En este contexto, el estudiante no es un receptor pasivo, sino un participante activo en la construcción del conocimiento.

Los recursos disponibles en el ${ambiente}, tanto humanos como materiales, permiten experiencias auténticas de aprendizaje donde la teoría se articula con la práctica de manera significativa. Esta integración es crucial para desarrollar competencias que trascienda el aula.
  `.trim();

  return {
    id: `sit-${Date.now()}`,
    area,
    grado,
    tema,
    competencia,
    duracion,
    createdAt: new Date().toISOString(),
    
    // Estructura MINERD
    titulo: `Situación de Aprendizaje: ${tema || area}`,
    proposito,
    problema: problemaPrincipal,
    
    // Narrativa y contexto
    narrativa,
    ambienteExpandido,
    
    // Elementos estructurales
    ambiente,
    situacion,
    contexto,
    actoresPrincipales: actorPrincipal,
    
    // Preguntas detonantes
    preguntasDetonantes: generarPreguntasDetonantes(area, tema, grado),
    
    // Producto esperado inicial
    productoInicial: generarProductoEsperado(area, tema, duracion),
    
    // Recursos necesarios
    recursosNecesarios: generarRecursosNecesarios(),
  };
};

/**
 * Generar preguntas detonantes contextualizadas
 */
const generarPreguntasDetonantes = (area, tema) => {
  const preguntasBase = {
    LENGUA_ESPANIOL: [
      `¿Por qué es importante ${tema || "comunicarnos"} de manera clara y efectiva?`,
      "¿Cómo influye el lenguaje en nuestras relaciones y sociedad?",
      "¿Qué recursos lingüísticos podemos usar para persuadir o convencer?",
    ],
    MATEMATICA: [
      `¿Dónde encontramos ${tema || "las matemáticas"} en nuestro entorno?`,
      "¿Cómo nos ayudan los números y patrones a resolver problemas reales?",
      "¿Qué decisiones tomaríamos si no supiéramos interpretar datos?",
    ],
    CIENCIAS_NATURALES: [
      `¿Por qué es importante entender ${tema || "los procesos naturales"}?`,
      "¿Cómo podemos contribuir al cuidado del medio ambiente?",
      "¿Qué responsabilidad tenemos como ciudadanos del planeta?",
    ],
    CIENCIAS_SOCIALES: [
      `¿Cómo ha influido ${tema || "la historia"} en nuestro presente?`,
      "¿Qué nos enseña sobre valores y convivencia?",
      "¿Cómo podemos ser ciudadanos responsables y críticos?",
    ],
    INGLES: [
      `¿Por qué es importante ${tema || "aprender inglés"} en el mundo actual?`,
      "¿Cómo nos conecta con personas y culturas del mundo?",
      "¿Qué oportunidades se abren cuando hablamos inglés?",
    ],
  };

  return preguntasBase[area] || preguntasBase.LENGUA_ESPANIOL;
};

/**
 * Generar descripción del producto esperado
 */
const generarProductoEsperado = (area, tema, duracion) => {
  const productos = {
    LENGUA_ESPANIOL: `Texto ${duracion > 3 ? "completo y editado" : "inicial"} que comunique ${tema} de manera clara, con estructura coherente y elementos persuasivos cuando sea necesario`,
    MATEMATICA: `Análisis o reporte ${duracion > 3 ? "detallado" : "inicial"} que demuestre la aplicación de conceptos matemáticos a ${tema}`,
    CIENCIAS_NATURALES: `Investigación ${duracion > 3 ? "exhaustiva" : "inicial"} con observaciones, datos y propuestas sobre ${tema}`,
    CIENCIAS_SOCIALES: `Documento analítico ${duracion > 3 ? "profundo" : "inicial"} que examine aspectos sociales o históricos de ${tema}`,
    INGLES: `Presentación ${duracion > 3 ? "desarrollada" : "inicial"} en inglés sobre ${tema}, con comunicación clara y fluida`,
  };

  return productos[area] || productos.LENGUA_ESPANIOL;
};

/**
 * Generar lista de recursos necesarios
 */
const generarRecursosNecesarios = () => {
  return {
    humanos: [
      "Docente facilitador",
      "Estudiantes colaboradores",
      "Expertos/especialistas del tema",
    ],
    didacticos: [
      "Textos de referencia",
      "Materiales concretos",
      "Guías de trabajo",
      "Rúbricas de evaluación",
    ],
    tecnologicos: [
      "Computadoras/tablets",
      "Acceso a internet",
      "Plataformas educativas",
      "Herramientas de productividad",
    ],
  };
};

export default generarSituacion;
