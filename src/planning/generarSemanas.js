/**
 * generarSemanas.js
 * Genera estructura completa de semanas con progresión pedagógica
 */

import { generarDia } from "./generarDias.js";
import { TIPO_EVAL } from "./catalogs.js";

/**
 * Propósitos pedagógicos por fase de la unidad
 */
const PROPOSITOS_POR_FASE = {
  diagnostica: "Explorar conocimientos previos, detectar necesidades de aprendizaje",
  inicial: "Presentar el tema y generar interés en los estudiantes",
  desarrollo: "Construir conocimientos y desarrollar competencias específicas",
  profundizacion: "Aplicar y profundizar en los aprendizajes construidos",
  integracion: "Integrar y transferir aprendizajes a nuevos contextos",
  final: "Evaluar desempeño y reflexionar sobre la trayectoria de aprendizaje",
};

/**
 * Técnicas específicas por fase
 */
const TECNICAS_POR_FASE = {
  diagnostica: [
    "Preguntas exploratorias",
    "Mapa conceptual inicial",
    "Lluvia de ideas",
  ],
  inicial: [
    "Presentación contextualizada",
    "Dinámicas motivadoras",
    "Establecimiento de propósito",
  ],
  desarrollo: [
    "Trabajo colaborativo",
    "Investigación guiada",
    "Resolución de problemas",
    "Aprendizaje por proyectos",
  ],
  profundizacion: [
    "Análisis crítico",
    "Aplicación práctica",
    "Construcción de prototipos",
    "Estudio de casos",
  ],
  integracion: [
    "Proyectos integradores",
    "Simulaciones",
    "Presentaciones públicas",
    "Defensa de ideas",
  ],
  final: [
    "Presentación final",
    "Examen comprensivo",
    "Portafolio reflexivo",
    "Autoevaluación",
  ],
};

/**
 * Determinar la fase de cada semana
 */
const determinarFase = (semana, totalSemanas) => {
  if (semana === 1) return "diagnostica";
  if (semana === 2) return "inicial";
  if (semana <= totalSemanas - 2) return "desarrollo";
  if (semana === totalSemanas - 1) return "profundizacion";
  if (semana === totalSemanas) return "final";
  return "integracion";
};

/**
 * Determinar tipo de evaluación para la semana
 */
const determinarTipoEval = (semana, totalSemanas) => {
  if (semana === 1) return TIPO_EVAL.DIAGNOSTICA;
  if (semana === totalSemanas) return TIPO_EVAL.SUMATIVA;
  return TIPO_EVAL.FORMATIVA;
};

/**
 * Generar una semana completa
 */
export const generarSemana = ({
  n = 1,
  totalSemanas = 4,
  tema = "",
  competencia = "",
  contenidos = [],
  grado = "2do",
  dias = 4,
  estrategia = "Aprendizaje cooperativo",
}) => {
  const fase = determinarFase(n, totalSemanas);
  const tipoEval = determinarTipoEval(n, totalSemanas);
  const proposito = PROPOSITOS_POR_FASE[fase];

  // Determinar cuáles días tendrán momentos pedagógicos completos
  const diasConMomentos =
    fase === "diagnostica" ? [1] : fase === "final" ? [dias] : [];

  // Generar días de la semana
  const diasSemana = [];
  for (let d = 1; d <= dias; d++) {
    const dia = generarDia({
      n: d,
      semana: n,
      tema,
      competencia,
      tipoEval,
      estrategia,
      conMomentos: diasConMomentos.includes(d),
      grado,
    });
    diasSemana.push(dia);
  }

  // Generar estructura de semana
  const semana = {
    id: `sem-${Date.now()}-${n}`,
    n,
    titulo: `Semana ${n}: ${generarTituloSemana(n, tema, totalSemanas)}`,
    fase,
    tipoEval,
    proposito,
    tema,
    competencia,
    grado,
    duracion: dias,
    dias: diasSemana,

    // Indicadores específicos de la semana
    indicadoresTrabajadasSemana: generarIndicadores(competencia, n, totalSemanas),

    // Contenidos priorizados para la semana
    contenidosSemana: seleccionarContenidosPorFase(contenidos, fase, n, totalSemanas),

    // Técnicas a enfatizar
    tecnicasFormativas: TECNICAS_POR_FASE[fase],

    // Instrumento principal
    instrumentoSemanal: generarInstrumentoSemanal(fase, tema),

    // Producto semanal
    productoSemanal: generarProductoSemanal(fase, n, totalSemanas, tema),

    // Resumen pedagógico
    resumenSemanal: {
      tecnicas: TECNICAS_POR_FASE[fase],
      instrumentos: generarInstrumentosSemanal(tipoEval),
      observacionesPedagogicas: generarObservacionesSemana(fase),
    },

    // Adecuaciones por semana
    adecuacionesSemana: generarAdecuacionesSemana(),

    // Notas para la siguiente semana
    comentariosParaProxima: generarComentariosParaProxima(n, totalSemanas),
  };

  return semana;
};

/**
 * Generar título contextualizado para la semana
 */
const generarTituloSemana = (semana, tema, totalSemanas) => {
  const titulos = {
    1: "Exploración inicial",
    2: "Presentación y motivación",
  };

  if (semana === totalSemanas) return "Cierre y reflexión final";
  if (semana === totalSemanas - 1) return "Profundización e integración";

  return titulos[semana] || `Desarrollo: ${tema}`;
};

/**
 * Seleccionar contenidos según la fase
 */
const seleccionarContenidosPorFase = (
  contenidos,
  fase,
  _semana,
  totalSemanas,
) => {
  // Distribuir contenidos a lo largo de las semanas
  const contenidosPorFase = {
    diagnostica: contenidos.slice(0, 1),
    inicial: contenidos.slice(0, 2),
    desarrollo: contenidos.slice(
      1,
      Math.ceil((totalSemanas - 2) / (totalSemanas - 2)) * contenidos.length,
    ),
    profundizacion: contenidos.slice(
      Math.ceil(contenidos.length * 0.7),
      contenidos.length,
    ),
    integracion: contenidos,
    final: contenidos,
  };

  return contenidosPorFase[fase] || contenidos;
};

/**
 * Generar indicadores de logro para la semana
 */
const generarIndicadores = (competencia, semana, totalSemanas) => {
  const indicadores = [
    "Demuestra comprensión de conceptos clave",
    "Aplica procedimientos correctamente",
    "Colabora efectivamente con pares",
    "Reflexiona sobre su aprendizaje",
    "Propone soluciones creativas",
  ];

  // Filtrar según avance de semanas
  const progressPercentage = (semana - 1) / (totalSemanas - 1);
  const numIndicadores = Math.ceil(2 + progressPercentage * 3);

  return indicadores.slice(0, numIndicadores);
};

/**
 * Generar instrumento principal de la semana
 */
const generarInstrumentoSemanal = (fase) => {
  const instrumentos = {
    diagnostica: "Prueba diagnóstica / Observación",
    inicial: "Lista de participación",
    desarrollo: "Rúbrica de trabajo colaborativo",
    profundizacion: "Rúbrica de aplicación práctica",
    integracion: "Rúbrica de integración",
    final: "Rúbrica sumativa / Portafolio",
  };

  return instrumentos[fase] || "Observación del desempeño";
};

/**
 * Generar productos esperados de la semana
 */
const generarProductoSemanal = (fase, semana, totalSemanas, tema) => {
  const productos = {
    diagnostica: `Diagnóstico inicial sobre ${tema}`,
    inicial: `Mapas mentales/conceptuales sobre ${tema}`,
    desarrollo: `Trabajos colaborativos avanzando en ${tema}`,
    profundizacion: `Proyectos/aplicaciones prácticas de ${tema}`,
    integracion: `Integración de conceptos y habilidades`,
    final: `Producto final: ${tema}`,
  };

  return productos[fase] || `Trabajos sobre ${tema}`;
};

/**
 * Generar instrumentos de evaluación para la semana
 */
const generarInstrumentosSemanal = (tipoEval) => {
  const instrumentos = {
    diagnostica: [
      "Preguntas exploratorias",
      "Observación inicial",
      "Mapa conceptual",
    ],
    formativa: [
      "Lista de cotejo",
      "Registro anecdótico",
      "Trabajo práctico",
      "Participación",
    ],
    sumativa: ["Rúbrica", "Portafolio", "Presentación final"],
  };

  return instrumentos[tipoEval] || instrumentos.formativa;
};

/**
 * Generar observaciones pedagógicas para la semana
 */
const generarObservacionesSemana = (fase) => {
  const observaciones = {
    diagnostica:
      "Observar necesidades individuales y grupales para ajustar estrategias",
    inicial: "Monitorear el nivel de compromiso e interés de los estudiantes",
    desarrollo:
      "Registrar avances en comprensión y aplicación de conceptos",
    profundizacion:
      "Evaluar capacidad de análisis crítico y aplicación práctica",
    integracion: "Observar transferencia de aprendizajes a nuevos contextos",
    final: "Evaluar logro de competencias y reflexión metacognitiva",
  };

  return observaciones[fase] || "Monitoreo continuo del aprendizaje";
};

/**
 * Generar adecuaciones por semana
 */
const generarAdecuacionesSemana = () => {
  return {
    acceso: "Proporcionar materiales en múltiples formatos",
    tiempo: "Flexible según necesidades individuales",
    agrupamiento: "Flexible: individual, parejas, pequeños grupos",
    apoyo: "Refuerzo según áreas de dificultad identificadas",
    evaluacion: "Múltiples formas de demostrar aprendizaje",
  };
};

/**
 * Generar comentarios para la próxima semana
 */
const generarComentariosParaProxima = (semana, totalSemanas) => {
  if (semana === totalSemanas) return "Proceso de planificación completado";

  return `Continuaremos profundizando en los conceptos y habilidades desarrolladas. Prepararse para semana ${semana + 1}.`;
};

/**
 * Generar estructura completa de semanas (4-6 semanas típicamente)
 */
export const generarSemanas = ({
  numSemanas = 4,
  tema = "",
  competencia = "",
  contenidos = [],
  grado = "2do",
  diasPorSemana = 4,
  estrategia = "Aprendizaje cooperativo",
}) => {
  const semanas = [];

  for (let s = 1; s <= numSemanas; s++) {
    const semana = generarSemana({
      n: s,
      totalSemanas: numSemanas,
      tema,
      competencia,
      contenidos,
      grado,
      dias: diasPorSemana,
      estrategia,
    });

    semanas.push(semana);
  }

  return semanas;
};

export default {
  generarSemana,
  generarSemanas,
};
