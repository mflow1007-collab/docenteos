/**
 * test-unidad-render.mjs — R1 sobre el documento renderizado (punto 7 del
 * cierre del cerebro de unidad).
 *
 * Renderiza una unidad de ejemplo completa (fixture con la forma real que
 * produce generarUnidadAprendizaje) y verifica que:
 *   1. El validador acepta un documento completo.
 *   2. Ningún campo del esquema MINERD queda vacío (momentos, evaluación,
 *      evidencias, metacognición, recursos, contenidos, competencias).
 *   3. Los códigos oficiales CE-LEI/IL y el vocabulario real de la malla
 *      aparecen en el HTML.
 *   4. Cualquier campo vaciado o placeholder legacy DETIENE la validación.
 *
 * Ejecutar: node scripts/test-unidad-render.mjs
 */

import { formatearUnidadHTML, validarUnidadRenderizada } from "../src/services/unidadAprendizajeService.js";

let pasadas = 0;
let falladas = 0;
const check = (nombre, fn) => {
  try {
    fn();
    console.log(`  ✓ ${nombre}`);
    pasadas++;
  } catch (e) {
    console.error(`  ✗ ${nombre}: ${e.message}`);
    falladas++;
  }
};
const esperaError = (fn, fragmento) => {
  try {
    fn();
  } catch (e) {
    if (e.message.includes(fragmento)) return;
    throw new Error(`error con mensaje inesperado: ${e.message}`);
  }
  throw new Error(`se esperaba error conteniendo "${fragmento}" y no se lanzó`);
};

// ─── Fixture: unidad completa con la forma real del generador ────────────────

const EVAL_INICIO = { tipo: "Diagnóstica", agente: "Heteroevaluación", tecnica: "Observación directa", instrumento: "Lista de cotejo" };
const EVAL_DESARROLLO = { tipo: "Formativa", agente: "Heteroevaluación", tecnica: "Observación directa y revisión del trabajo", instrumento: "Rúbrica analítica" };
const EVAL_CIERRE = { tipo: "Formativa", agente: "Autoevaluación / Coevaluación", tecnica: "Reflexión oral / Ticket de salida", instrumento: "Escala de valoración" };

const momento = (nombre, tiempo, evaluacion, n) => ({
  nombre,
  tiempo,
  actividades: [
    `Actividad ${n}.1 de ${nombre}: práctica oral con el vocabulario de la casa (lobby, entrance).`,
    `Actividad ${n}.2 de ${nombre}: trabajo en parejas describiendo habitaciones.`,
  ],
  evidencias: `• Identifica las partes de la casa en inglés.\n• Describe su habitación usando there is / there are.`,
  evaluacion,
  recursos: {
    humanos: "Docente y estudiantes",
    didacticos: "Flashcards de vocabulario, plano de una casa, cuaderno de inglés",
    tecnologicos: "Pizarrón y marcadores",
  },
  metacognicion: ["What did I learn about the house today?", "Which room words can I remember?"],
});

const dia = (numero, numeroGlobal, semana) => ({
  numero,
  numeroGlobal,
  semana,
  diaCalendario: "Lunes",
  hora: 1,
  mostrarHora: false,
  titulo: `Parts of the House — clase ${numeroGlobal}`,
  tituloIA: `My Home, Room by Room (${numeroGlobal})`,
  etapaProgresion: "Explorar",
  criteriosExito: [
    "☐ Identifica las partes de la casa en inglés.",
    "☐ Describe su habitación usando there is / there are.",
  ],
  aporteProducto: "Boceto del plano de la casa para el póster final.",
  intencionPedagogica: "Explorar el vocabulario de las partes de la casa en situaciones reales.",
  momentos: [
    momento("Inicio", "10 min", EVAL_INICIO, numero),
    momento("Desarrollo", "30 min", EVAL_DESARROLLO, numero),
    momento("Cierre", "5 min", EVAL_CIERRE, numero),
  ],
  adaptacionesNEAE: {
    acceso: "Ubicar a los estudiantes con NEAE cerca del docente.",
    metodologicas: "Instrucciones cortas con apoyos visuales.",
    evaluacion: "Mismos criterios adaptando la complejidad.",
  },
  resumenEvaluacion: {
    tecnicas: [EVAL_INICIO.tecnica, EVAL_DESARROLLO.tecnica, EVAL_CIERRE.tecnica],
    instrumentos: [EVAL_INICIO.instrumento, EVAL_DESARROLLO.instrumento, EVAL_CIERRE.instrumento],
    criterioPuntuacion: "El docente define la puntuación según la complejidad.",
    observaciones: "Registrar el desempeño general del grupo.",
  },
});

const unidadFixture = {
  tipoPlanificacion: "Unidad de Aprendizaje",
  curricularContentId: "test-fixture",
  curricularRefs: ["IL-LEI-1-1", "IL-LEI-1-2"],
  metadatos: {
    titulo: "Parts of the House",
    grado: "1ro", seccion: "A", area: "Lenguas Extranjeras", asignatura: "Inglés",
    nivel: "Secundaria", ciclo: "Primer Ciclo", modalidad: "Académica", jornada: "Extendida",
    duracion: "4 semanas / 12 horas clase (45 min c/u)",
    horario: "Lunes, Martes, Miércoles · 1 hora/día · 3 horas/semana",
    periodo: "2026-2027", fechaInicio: "2026-09-01",
    nombreDocente: "Docente de Prueba", cedula: "", regional: "02", distrito: "06",
    centro: "Centro de Prueba", codigoCentro: "00000",
    asignaturasVinculadas: [], productoFinal: "Póster de mi casa presentado oralmente en inglés.",
    temasIntegrados: [],
  },
  ejesTematicos: ["Alfabetización Imprescindible"],
  situacionAprendizaje: "Los estudiantes del centro observan que no pueden describir su hogar en inglés...",
  ambienteAprendizaje: "Aula de clases con rincón de lectura en inglés.",
  competencias: {
    fundamentales: ["Comunicativa"],
    especifica: "Comprensión oral: comprende el sentido general en textos orales sencillos.",
    nivelMCERL: "A2.1",
    indicadores: ["Responde de forma adecuada a preguntas sencillas."],
  },
  competenciasDetalle: [
    {
      codigo: "CE-LEI-1",
      competenciaFundamental: "Comunicativa",
      especifica: "Comprensión oral: comprende el sentido general y las ideas principales en textos orales sencillos.",
      indicadores: [
        { codigo: "IL-LEI-1-1", descripcion: "Responde de forma adecuada a preguntas sencillas sobre su entorno." },
        { codigo: "IL-LEI-1-2", descripcion: "Identifica el vocabulario de la casa en textos orales breves." },
      ],
    },
  ],
  contenidos: {
    conceptuales: ["lobby", "entrance", "chair", "desk", "do the laundry", "There is / There are"],
    procedimentales: ["Descripción oral de las partes de la casa", "Formulación de preguntas sobre el hogar"],
    actitudinales: ["Valoración del hogar y la familia", "Respeto por las producciones de los compañeros"],
  },
  fasesSemanales: [
    {
      numero: 1,
      nombre: "Exploración y saberes previos",
      estrategia: "Enfoque comunicativo",
      indicadoresAvance: ["Responde de forma adecuada a preguntas sencillas sobre su entorno."],
      posiblesDificultades: ["Vocabulario limitado al inicio de la unidad."],
      dias: [dia(1, 1, 1), dia(2, 2, 1)],
    },
  ],
  anexos: null,
  checkpointFormativo: null,
  notaInstitucional: "",
};

// ─── Checks ───────────────────────────────────────────────────────────────────

console.log("R1 render — documento completo:");

const html = formatearUnidadHTML(unidadFixture, "");

check("renderiza HTML no vacío", () => {
  if (!html || html.length < 2000) throw new Error(`HTML sospechosamente corto (${html.length})`);
});

check("unidad completa pasa la validación R1", () => {
  validarUnidadRenderizada(unidadFixture, html);
});

check("el HTML muestra el código oficial CE-LEI y los IL", () => {
  if (!html.includes("CE-LEI-1")) throw new Error("falta CE-LEI-1");
  if (!html.includes("IL-LEI-1-1")) throw new Error("falta IL-LEI-1-1");
});

check("el HTML contiene vocabulario real de la malla (lobby, entrance, do the laundry)", () => {
  for (const palabra of ["lobby", "entrance", "do the laundry"]) {
    if (!html.includes(palabra)) throw new Error(`falta "${palabra}"`);
  }
});

check("evaluación del documento y resumen provienen de la misma tabla", () => {
  const d = unidadFixture.fasesSemanales[0].dias[0];
  for (const mom of d.momentos) {
    if (!d.resumenEvaluacion.tecnicas.includes(mom.evaluacion.tecnica)) {
      throw new Error(`técnica "${mom.evaluacion.tecnica}" no está en el resumen`);
    }
    if (!d.resumenEvaluacion.instrumentos.includes(mom.evaluacion.instrumento)) {
      throw new Error(`instrumento "${mom.evaluacion.instrumento}" no está en el resumen`);
    }
  }
});

console.log("R1 render — campos vaciados DETIENEN la validación:");

const clonar = () => JSON.parse(JSON.stringify(unidadFixture));

check("momento sin actividades → error", () => {
  const u = clonar();
  u.fasesSemanales[0].dias[0].momentos[1].actividades = [];
  esperaError(() => validarUnidadRenderizada(u, formatearUnidadHTML(u, "")), "sin actividades");
});

check("momento sin evidencias → error", () => {
  const u = clonar();
  u.fasesSemanales[0].dias[1].momentos[2].evidencias = "";
  esperaError(() => validarUnidadRenderizada(u, formatearUnidadHTML(u, "")), "sin evidencias");
});

check("momento sin metacognición → error", () => {
  const u = clonar();
  u.fasesSemanales[0].dias[0].momentos[0].metacognicion = [];
  esperaError(() => validarUnidadRenderizada(u, formatearUnidadHTML(u, "")), "sin metacognición");
});

check("evaluación sin instrumento → error", () => {
  const u = clonar();
  u.fasesSemanales[0].dias[0].momentos[1].evaluacion = { ...EVAL_DESARROLLO, instrumento: "" };
  esperaError(() => validarUnidadRenderizada(u, formatearUnidadHTML(u, "")), "evaluación sin instrumento");
});

check("momento sin recursos didácticos → error", () => {
  const u = clonar();
  u.fasesSemanales[0].dias[1].momentos[0].recursos.didacticos = "";
  esperaError(() => validarUnidadRenderizada(u, formatearUnidadHTML(u, "")), "sin recursos didácticos");
});

check("clase sin criterios de éxito → error", () => {
  const u = clonar();
  u.fasesSemanales[0].dias[0].criteriosExito = [];
  esperaError(() => validarUnidadRenderizada(u, formatearUnidadHTML(u, "")), "sin criterios de éxito");
});

check("fase sin indicadores de avance → error", () => {
  const u = clonar();
  u.fasesSemanales[0].indicadoresAvance = [];
  esperaError(() => validarUnidadRenderizada(u, formatearUnidadHTML(u, "")), "sin indicadores de avance");
});

check("CONTENIDOS conceptuales vacíos → error", () => {
  const u = clonar();
  u.contenidos.conceptuales = [];
  esperaError(() => validarUnidadRenderizada(u, formatearUnidadHTML(u, "")), "CONTENIDOS conceptuales vacíos");
});

check("tabla de competencias vacía → error", () => {
  const u = clonar();
  u.competenciasDetalle = [];
  esperaError(() => validarUnidadRenderizada(u, formatearUnidadHTML(u, "")), "tabla de competencias");
});

check("placeholder legacy en cualquier campo → error", () => {
  const u = clonar();
  u.contenidos.conceptuales.push("Vocabulario clave relacionado con Parts of the House");
  esperaError(() => validarUnidadRenderizada(u, formatearUnidadHTML(u, "")), "placeholder legacy");
});

check("indicadores legacy como strings siguen siendo válidos (compatibilidad)", () => {
  const u = clonar();
  u.competenciasDetalle[0].indicadores = ["Responde de forma adecuada a preguntas sencillas."];
  validarUnidadRenderizada(u, formatearUnidadHTML(u, ""));
});

// ─── Resultado ────────────────────────────────────────────────────────────────

console.log(`\n${pasadas} ✓ · ${falladas} ✗`);
if (falladas > 0) process.exit(1);
