const EDUCANDO_BASE_URL = "https://educando.edu.do";

const normalizarUrlEducando = (path) =>
  path.startsWith("http")
    ? path
    : `${EDUCANDO_BASE_URL}${path.replace(/^\/+portal\/\//, "/portal/")}`;

export const FUENTE_ADECUACIONES_CURRICULARES = {
  titulo: "Adecuación Curricular del Nivel Inicial, Primario y Secundario",
  institucion: "MINERD / Educando",
  url: "https://educando.edu.do/portal/adecuaciones-curriculares-del-nivel-primario-y-secundario/",
  postId: 134098,
  publicado: "2023-08-21",
  actualizado: "2026-02-26",
  descripcion:
    "Adecuación curricular y ajustes de coherenciación para los niveles Inicial, Primario y Secundario, en cumplimiento de las Ordenanzas 4-2021, 03-2023, 04-2023 y 05-2023.",
  ordenanzas: ["4-2021", "03-2023", "04-2023", "05-2023"],
};

export const DOCUMENTOS_ADECUACIONES_CURRICULARES = [
  {
    nivel: "Inicial",
    tipo: "diseño_curricular",
    titulo: "Adecuación Nivel Inicial - octubre 2023",
    url: normalizarUrlEducando(
      "/portal/wp-content/uploads/2023/10/1.-Adecuacion-Nivel-Inicial-Oct-2023-.-Final.pdf"
    ),
  },
  {
    nivel: "Primario",
    tipo: "diseño_curricular",
    titulo: "Diseño Curricular Nivel Primario por ciclo y áreas curriculares",
    url: normalizarUrlEducando(
      "/portal/diseno-curricular-nivel-primario-por-ciclo-y-areas-curriculares/"
    ),
  },
  {
    nivel: "Secundario",
    tipo: "diseño_curricular",
    titulo: "Diseño Curricular Nivel Secundario por ciclo y áreas curriculares",
    url: normalizarUrlEducando(
      "/portal/diseno-curricular-nivel-secundario-por-ciclo-y-areas-curriculares/"
    ),
  },
  {
    nivel: "Inicial",
    tipo: "registro",
    titulo: "Registros del Segundo Ciclo Nivel Inicial 2025",
    url: normalizarUrlEducando("/portal/registros-del-segundo-ciclo-nivel-inicial-2025/"),
  },
  {
    nivel: "Primario",
    tipo: "registro",
    titulo: "Registros del Nivel Primario - versión preliminar",
    url: normalizarUrlEducando("/portal/registros-del-nivel-primario-version-preliminar/"),
  },
  {
    nivel: "Secundario",
    tipo: "registro",
    titulo: "Libros de Registros del Nivel Secundario 2023-2024",
    url: normalizarUrlEducando("/portal/libros-de-registros-del-nivel-secundario-2023-2024/"),
  },
];

export const RESUMEN_ADECUACIONES_CURRICULARES = [
  "Ajustar acceso, metodología y evaluación según barreras identificadas, sin perder el referente curricular del grado cuando sea posible.",
  "Priorizar aprendizajes esenciales y evidencias observables para estudiantes que requieren apoyo intensivo.",
  "Flexibilizar tiempos, agrupamientos, recursos y formas de respuesta para sostener participación y progreso.",
  "Usar apoyos visuales, auditivos, manipulativos, tecnológicos o comunicativos de acuerdo con la necesidad educativa.",
  "Registrar las adecuaciones aplicadas y valorar el avance con criterios claros, formativos y contextualizados.",
];

export const getReferenciaAdecuacionesCurriculares = () =>
  `${FUENTE_ADECUACIONES_CURRICULARES.titulo} (${FUENTE_ADECUACIONES_CURRICULARES.institucion}, actualizada ${FUENTE_ADECUACIONES_CURRICULARES.actualizado}). Fuente: ${FUENTE_ADECUACIONES_CURRICULARES.url}`;
