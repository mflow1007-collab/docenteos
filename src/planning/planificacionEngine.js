/**
 * planificacionEngine.js
 * Orquestador central que integra todos los módulos de planificación
 * Genera planificaciones completas y profesionales en formato MINERD
 */

import generarSituacion from "./generarSituacion.js";
import { generarSemanas } from "./generarSemanas.js";
import { generarMatrizEvaluacion } from "./generarEvaluacion.js";
import {
  FUENTE_ADECUACIONES_CURRICULARES,
  RESUMEN_ADECUACIONES_CURRICULARES,
} from "../data/adecuacionesCurriculares.js";

/**
 * Validar datos de entrada
 */
const validarEntrada = ({
  area,
  grado,
  competencia,
  indicadores,
  contenidos,
  duracion,
}) => {
  const errores = [];

  if (!area || area.trim() === "") {
    errores.push("El área es requerida");
  }

  if (!grado || grado.trim() === "") {
    errores.push("El grado es requerido");
  }

  if (!competencia || competencia.trim() === "") {
    errores.push("La competencia específica es requerida");
  }

  if (!indicadores || indicadores.length === 0) {
    errores.push("Al menos un indicador de logro es requerido");
  }

  if (!contenidos || contenidos.length === 0) {
    errores.push("Al menos un contenido es requerido");
  }

  if (!duracion || duracion < 1 || duracion > 12) {
    errores.push("La duración debe estar entre 1 y 12 semanas");
  }

  if (errores.length > 0) {
    throw new Error("Errores de validación:\n" + errores.join("\n"));
  }

  return true;
};

/**
 * Limpiar y procesar indicadores
 */
const procesarIndicadores = (indicadores) => {
  if (typeof indicadores === "string") {
    return indicadores
      .split("\n")
      .map((ind) => ind.trim())
      .filter((ind) => ind.length > 0);
  }
  if (Array.isArray(indicadores)) {
    return indicadores.map((ind) => {
      if (typeof ind === "object") return ind.descripcion || ind.name || "";
      return String(ind).trim();
    });
  }
  return [];
};

/**
 * Procesar contenidos en categorías
 */
const procesarContenidos = (contenidos) => {
  if (typeof contenidos === "string") {
    const items = contenidos
      .split("\n")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    return {
      conceptos: items.slice(0, Math.ceil(items.length / 3)),
      procedimientos: items.slice(
        Math.ceil(items.length / 3),
        Math.ceil((items.length * 2) / 3),
      ),
      actitudes: items.slice(Math.ceil((items.length * 2) / 3)),
    };
  }

  if (Array.isArray(contenidos)) {
    return {
      conceptos: contenidos.filter(
        (c) => c.tipo !== "procedimiento" && c.tipo !== "actitud",
      ),
      procedimientos: contenidos.filter((c) => c.tipo === "procedimiento"),
      actitudes: contenidos.filter((c) => c.tipo === "actitud"),
    };
  }

  return { conceptos: [], procedimientos: [], actitudes: [] };
};

/**
 * Calcular fecha final de la unidad
 */
const calcularFechaFin = (fechaInicio, duracion) => {
  const fecha = new Date(fechaInicio);
  fecha.setDate(fecha.getDate() + duracion * 7);
  return fecha.toISOString().split("T")[0];
};

/**
 * Generar descripción del producto final
 */
const generarProductoFinal = (area, _grado, tema) => {
  const productosArea = {
    "Lengua Española": `Texto coherente y cohesivo sobre ${tema}`,
    Matemática: `Análisis matemático aplicado a ${tema}`,
    "Ciencias de la Naturaleza": `Informe de investigación científica sobre ${tema}`,
    "Ciencias Sociales": `Análisis histórico-social de ${tema}`,
    Inglés: `Presentación en inglés sobre ${tema}`,
  };

  return {
    descripcion:
      productosArea[area] ||
      `Proyecto integrado sobre ${tema}`,
    criteriosEvaluacion: [
      "Calidad del contenido",
      "Organización y claridad",
      "Originalidad y creatividad",
      "Uso correcto de lenguaje",
      "Presentación profesional",
    ],
    formato: "Proyecto/Presentación/Documento",
    rubricaEvaluacion: {
      name: "Rúbrica del Producto Final",
      escala: "4 niveles (En Inicio, En Proceso, Logrado, Profundizado)",
    },
  };
};

/**
 * Generar cronograma de evaluación
 */
const generarCronogramaEvaluacion = (semanas) => {
  return semanas.map((sem) => ({
    semana: sem.n,
    tipoEval: sem.tipoEval,
    instrumentos: sem.resumenSemanal.instrumentos,
    momentos: sem.dias.length,
  }));
};

/**
 * Generar adecuaciones NEAE de la unidad
 */
const generarAdecuacionesNEAE = () => {
  return {
    titulo: "Adecuaciones curriculares para estudiantes con NEAE",
    descripcion:
      `Estrategias inclusivas alineadas a la Adecuación Curricular MINERD actualizada (${FUENTE_ADECUACIONES_CURRICULARES.actualizado}).`,
    fuenteOficial: FUENTE_ADECUACIONES_CURRICULARES,
    principios: RESUMEN_ADECUACIONES_CURRICULARES,
    nivelAcceso: {
      presentacion: "Presentar contenidos en formatos visuales, auditivos, manipulativos o digitales accesibles.",
      comunicacion: "Permitir sistemas alternativos o aumentativos de comunicación cuando aplique.",
      recursos: "Usar apoyos concretos, tecnológicos, letra ampliada, pictogramas, organizadores gráficos o material adaptado.",
      ambiente: "Ajustar ubicación, iluminación, ruido, movilidad y condiciones del aula para reducir barreras.",
    },
    nivelCurricular: {
      priorizar: "Priorizar aprendizajes esenciales e indicadores clave del grado.",
      graduar: "Graduar la complejidad de tareas manteniendo el propósito pedagógico.",
      flexibilizar: "Flexibilizar tiempos, secuencia, cantidad de ejercicios y formas de respuesta.",
      enriquecer: "Ofrecer profundización, retos abiertos y producción creativa para altas capacidades.",
    },
    estrategias: [
      "Diseño Universal para el Aprendizaje",
      "Instrucciones breves, modeladas y verificadas",
      "Agrupamientos flexibles y apoyo entre pares",
      "Andamiaje gradual y retroalimentación individualizada",
      "Evaluación formativa con evidencias variadas",
    ],
    recursosPersonales: [
      "Docente de educación especial",
      "Psicopedagogo",
      "Terapeuta (si aplica)",
      "Asistente educativo",
    ],
  };
};

/**
 * Motor principal: Generar planificación completa
 */
export const generarPlanificacion = async ({
  // Datos del curso
  area = "Lengua Española",
  grado = "2do",
  seccion = "A",
  centro = "",
  docente = "",
  anoEscolar = "2025-2026",
  periodo = "I",

  // Datos de la unidad
  competencia = "",
  indicadores = [],
  contenidos = [],
  tema = "",
  duracion = 4,
  fechaInicio = new Date().toISOString().split("T")[0],

  // Configuración
  diasPorSemana = 4,
  estrategia = "Aprendizaje cooperativo",
  incluirADM = true,
  formatoPDF = "profesional",
} = {}) => {
  try {
    // Validar entrada
    validarEntrada({
      area,
      grado,
      competencia,
      indicadores,
      contenidos,
      duracion,
    });

    // Procesar datos
    const indicadoresArray = procesarIndicadores(indicadores);
    const contenidosProcessados = procesarContenidos(contenidos);
    const temaNormalizado = tema || competencia.substring(0, 50);

    console.log("🎯 Iniciando generación de planificación...");
    console.log(`   Área: ${area}, Grado: ${grado}`);
    console.log(`   Competencia: ${competencia}`);
    console.log(`   Duración: ${duracion} semanas`);

    // 1. GENERAR SITUACIÓN DE APRENDIZAJE
    console.log("📝 Generando situación de aprendizaje...");
    const situacion = generarSituacion({
      area,
      grado,
      competencia,
      tema: temaNormalizado,
      duracion,
    });

    // 2. GENERAR SEMANAS COMPLETAS
    console.log(`📅 Generando ${duracion} semanas de desarrollo...`);
    const semanas = generarSemanas({
      numSemanas: duracion,
      tema: temaNormalizado,
      competencia,
      contenidos: indicadoresArray,
      grado,
      diasPorSemana,
      estrategia,
    });

    // 3. GENERAR MATRIZ DE EVALUACIÓN
    console.log("📊 Generando matriz de evaluación...");
    const matrizEvaluacion = generarMatrizEvaluacion({
      tema: temaNormalizado,
      semanas: duracion,
      competencias: [competencia],
    });

    // 4. DEFINIR PRODUCTO FINAL
    const productoFinal = generarProductoFinal(area, grado, temaNormalizado);

    // 5. GENERAR ADECUACIONES NEAE (si está habilitado)
    const adecuacionesNEAE = incluirADM
      ? generarAdecuacionesNEAE()
      : null;

    // 6. COMPILAR PLANIFICACIÓN COMPLETA
    const planificacion = {
      id: `plan-${Date.now()}`,
      version: "1.0",
      formato: formatoPDF,
      createdAt: new Date().toISOString(),
      estado: "generada",
      metadata: {
        centro,
        docente,
        anoEscolar,
        periodo,
        area,
        grado,
        seccion,
        tema: temaNormalizado,
        competencia,
        duracion,
        fechaInicio,
        fechaFin: calcularFechaFin(fechaInicio, duracion),
      },
      datosUnidad: {
        titulo: `Unidad: ${temaNormalizado}`,
        competenciaEspecifica: competencia,
        indicadoresOficiales: indicadoresArray,
        contenidos: contenidosProcessados,
        proposito: situacion.proposito,
        justificacion: situacion.narrativa,
      },
      situacionAprendizaje: {
        titulo: situacion.titulo,
        narrativa: situacion.narrativa,
        ambiente: situacion.ambienteExpandido,
        problema: situacion.problema,
        preguntasDetonantes: situacion.preguntasDetonantes,
        actores: situacion.actoresPrincipales,
        recursosNecesarios: situacion.recursosNecesarios,
      },
      desarrolloSemanal: semanas,
      evaluacion: {
        matriz: matrizEvaluacion,
        tiposEvaluacion: ["Diagnóstica", "Formativa", "Sumativa"],
        tecnicasFormativos: [
          "Observación sistemática",
          "Trabajos prácticos",
          "Participación",
          "Reflexión",
        ],
        cronograma: generarCronogramaEvaluacion(semanas),
      },
      productoFinal,
      recursosGenerales: {
        humanos: [
          "Docente facilitador",
          "Estudiantes",
          "Especialistas según tema",
        ],
        didacticos: [
          "Libros de texto",
          "Materiales concretos",
          "Guías de trabajo",
          "Rúbricas",
        ],
        tecnologicos: [
          "Computadoras",
          "Proyector",
          "Internet",
          "Plataformas educativas",
        ],
      },
      bibliografia: {
        basica: [
          "Currículo Nacional vigente",
          "Libros de texto autorizados",
          "Recursos educativos abiertos",
        ],
        complementaria: [
          "Artículos de investigación",
          "Documentos de organismos educativos",
          "Recursos digitales",
        ],
      },
      notas: {
        consideracionesPedagogicas:
          "Esta planificación está diseñada siguiendo estándares MINERD con enfoque constructivista y atención a la diversidad.",
        flexibilidad:
          "Las actividades pueden adaptarse según el ritmo y necesidades del grupo",
        seguimiento:
          "Se recomienda evaluación continua y ajustes según avance del grupo",
      },
    };

    // Agregar adecuaciones NEAE si está habilitado
    if (incluirADM && adecuacionesNEAE) {
      planificacion.adecuacionesNEAE = adecuacionesNEAE;
    }

    console.log("✅ Planificación generada exitosamente");
    return planificacion;
  } catch (error) {
    console.error("❌ Error generando planificación:", error.message);
    throw error;
  }
};

export const engines = {
  generarPlanificacion,
  validarEntrada,
};

export default generarPlanificacion;
