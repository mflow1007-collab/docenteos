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

import { formatearUnidadHTML, validarUnidadRenderizada, construirInicioCanonico, construirCompetenciasDetalle, resolverTemaEnriquecido, _extraerContenidosMallaCorpus } from "../src/services/unidadAprendizajeService.js";
import { validarVozActividad, normalizarVozActividadMINERD, nombreCortoEstructura } from "../src/services/phaseAService.js";
import { seleccionarMallaParaUnidad, temasOficialesDeMalla, localizarPlaceholdersProhibidos, hasActiveMallaSource } from "../src/services/bancoConocimientoService.js";
import { coincideContextoTemaTrabajado } from "../src/services/curriculumCombinacionService.js";
import { validateCurricularDoc, SCHEMA_VERSION_CANONICA, localizarPlaceholdersProhibidos as locSchema } from "../src/services/curricularSchema.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));

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

// Actividades en la VOZ oficial MINERD: verbo en tercera persona plural del
// presente; el Inicio con sus 5 posiciones canónicas.
const ACTIVIDADES_POR_MOMENTO = {
  Inicio: (n) => construirInicioCanonico({
    saludoInicial: `Good morning! How are you today? Are you ready for class ${n}?`,
    retroalimentacionPrevia: "Retroalimentación del vocabulario trabajado en la clase anterior. (Do you remember the parts of the house? What rooms can you name?)",
    saberesPrevios: "Recuperación o exploración de saberes previos sobre las partes de la casa y los muebles de cada habitación.",
    actividadEnganche: "Observan imágenes de diferentes casas de la comunidad e identifican en inglés las partes que reconocen (lobby, entrance, bedroom).",
  }),
  Desarrollo: (n) => [
    `Practican en parejas un diálogo corto describiendo su habitación con there is / there are. (Clase ${n})`,
    "Elaboran cinco oraciones sencillas sobre los muebles de su casa (chair, desk, bed) y las registran en el cuaderno.",
  ],
  Cierre: (n) => [
    `Socializan algunas de las oraciones elaboradas durante la clase ${n}.`,
    "Reflexionan sobre cómo describir su casa en inglés fortalece la comunicación con otras personas.",
    "Guardan la producción escrita como Entrada 1 del Portafolio.",
  ],
};

const momento = (nombre, tiempo, evaluacion, n) => ({
  nombre,
  tiempo,
  actividades: ACTIVIDADES_POR_MOMENTO[nombre](n),
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

check("resumen semanal al CIERRE de cada semana (documento modelo)", () => {
  if (!html.includes("RESUMEN DE EVALUACIÓN — SEMANA 1")) throw new Error("falta el resumen de la semana 1");
  if (!html.includes("Boceto del plano de la casa")) throw new Error("el resumen no lista los aportes al producto");
  if (!html.includes("Observaciones de la semana:")) throw new Error("falta la fila de observaciones en la última semana de la fase");
  if (html.includes("RESUMEN DE EVALUACIÓN Y OBSERVACIONES")) throw new Error("con datos por semana, el bloque legacy por fase no debe emitirse");
});

check("el HTML nunca serializa un objeto como texto ('[object Object]')", () => {
  // Regresión G2: tomarIndicadoresBase pasaba objetos a tomarVentana (que hace
  // String(x)), y el resumen semanal imprimía "[object Object]" o quedaba en
  // "—". Cualquier objeto mal serializado en el documento es un bug de render.
  if (html.includes("[object Object]")) throw new Error("hay un objeto serializado como texto en el HTML");
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

console.log("Contrato de estilo MINERD — voz e Inicio canónico:");

check("validarVozActividad acepta verbos oficiales y las dos excepciones canónicas", () => {
  const validas = [
    "Responden al saludo e indicaciones iniciales. (Good morning!)",
    "Observan imágenes de diferentes casas de la comunidad.",
    "Elaboran un mapa de ideas sobre su rutina diaria.",
    "Socializan sus respuestas explicando por qué son importantes.",
    "Guardan la producción escrita como Entrada 2 del Portafolio.",
    "Retroalimentación del vocabulario trabajado en la clase anterior. (Do you remember?)",
    "Recuperación o exploración de saberes previos sobre las partes de la casa.",
  ];
  for (const a of validas) {
    const v = validarVozActividad(a);
    if (!v.ok) throw new Error(`rechazó una válida: "${a.slice(0, 40)}" — ${v.motivo}`);
  }
});

check("validarVozActividad rechaza los arranques prohibidos", () => {
  const prohibidas = [
    "Los estudiantes practican el vocabulario en parejas.",
    "El docente presenta la unidad y sus criterios.",
    "La docente modela la pronunciación de los verbos.",
    "Se realiza una dinámica de activación oral.",
    "Practica el vocabulario con su compañero.",
  ];
  for (const a of prohibidas) {
    if (validarVozActividad(a).ok) throw new Error(`aceptó una prohibida: "${a.slice(0, 40)}"`);
  }
});

check("normalizarVozActividadMINERD repara arranques nominales comunes", () => {
  const casos = [
    ["Ticket final sobre las partes de la casa.", "Completan un ticket de salida"],
    ["Reflexión sobre lo aprendido durante la clase.", "Reflexionan"],
    ["Portafolio: evidencia escrita individual.", "Guardan la evidencia en el portafolio"],
    ["Práctica guiada con tarjetas de vocabulario.", "Practican"],
    ["Producción oral sobre los espacios del hogar.", "Elaboran una producción"],
    ["Modelado de una descripción breve de la casa.", "Observan un modelado"],
    ["Los estudiantes practican el vocabulario en parejas.", "Practican"],
  ];
  for (const [entrada, esperado] of casos) {
    const salida = normalizarVozActividadMINERD(entrada);
    if (!salida.startsWith(esperado)) throw new Error(`no reparó "${entrada}" → "${salida}"`);
    const v = validarVozActividad(salida);
    if (!v.ok) throw new Error(`reparación inválida: "${salida}" — ${v.motivo}`);
  }
});

check("normalizarVozActividadMINERD no disfraza arranques desconocidos con Realizan", () => {
  const casos = [
    "Los estudiantes juegan bingo de vocabulario.",
    "El docente entrega las fichas de trabajo.",
    "Se realiza una dinámica de activación oral.",
  ];
  for (const entrada of casos) {
    const salida = normalizarVozActividadMINERD(entrada);
    if (salida.startsWith("Realizan ")) {
      throw new Error(`maquilló una actividad insegura: "${entrada}" → "${salida}"`);
    }
    const v = validarVozActividad(salida);
    if (v.ok) throw new Error(`dejó pasar una actividad insegura: "${entrada}" → "${salida}"`);
  }
});

check("construirInicioCanonico arma las 5 posiciones fijas", () => {
  const acts = construirInicioCanonico({
    saludoInicial: "Good morning! What time did you wake up today?",
    retroalimentacionPrevia: "Retroalimentación de la clase anterior. (What rooms do you remember?)",
    saberesPrevios: "Recuperación o exploración de saberes previos sobre los muebles de la casa.",
    actividadEnganche: "Observan un plano de una casa e identifican sus partes en inglés.",
  });
  if (acts.length !== 5) throw new Error(`esperaba 5 posiciones, hay ${acts.length}`);
  if (!acts[0].startsWith("Responden al saludo")) throw new Error("posición 1 incorrecta");
  if (!acts[0].includes("Good morning! What time did you wake up today?")) throw new Error("saludo no incrustado");
  if (!acts[1].startsWith("Retroalimentación")) throw new Error("posición 2 no es la retroalimentación");
  if (!acts[2].startsWith("Recuperación")) throw new Error("posición 3 no es saberes previos");
  if (!acts[4].startsWith("Escuchan la intención pedagógica")) throw new Error("posición 5 incorrecta");
});

check("Inicio sin las 5 posiciones canónicas → error", () => {
  const u = clonar();
  u.fasesSemanales[0].dias[0].momentos[0].actividades.pop();
  esperaError(() => validarUnidadRenderizada(u, formatearUnidadHTML(u, "")), "5 posiciones canónicas");
});

check("actividad con voz incorrecta en el documento → error", () => {
  const u = clonar();
  u.fasesSemanales[0].dias[1].momentos[1].actividades[0] = "Los estudiantes practican el diálogo en parejas.";
  esperaError(() => validarUnidadRenderizada(u, formatearUnidadHTML(u, "")), "voz —");
});

check("el render pone en negrita la primera palabra de cada actividad (incl. fórmulas fijas)", () => {
  for (const esperado of [
    "<strong>Responden</strong> al saludo e indicaciones iniciales.",
    "<strong>Retroalimentación</strong> del vocabulario trabajado",
    "<strong>Recuperación</strong> o exploración de saberes previos",
    "<strong>Practican</strong> en parejas",
    "<strong>Socializan</strong> algunas de las oraciones",
    "<strong>Escuchan</strong> la intención pedagógica",
  ]) {
    if (!html.includes(esperado)) throw new Error(`falta negrita inicial: "${esperado.slice(0, 50)}"`);
  }
});

check("actividad legacy con negrita markdown propia no se duplica", () => {
  const u = clonar();
  u.fasesSemanales[0].dias[1].momentos[2].actividades.push(
    "**Comparten** sus respuestas con el grupo. **Reciben** retroalimentación sobre su producción."
  );
  const h = formatearUnidadHTML(u, "");
  if (h.includes("<strong><strong>")) throw new Error("negrita duplicada en actividad legacy");
  if (!h.includes("<strong>Comparten</strong> sus respuestas")) throw new Error("markdown legacy no convertido");
});

check("la retroalimentación vive en el Inicio (posición 2), no en el Cierre", () => {
  const u = clonar();
  const inicio = u.fasesSemanales[0].dias[0].momentos[0].actividades;
  const cierre = u.fasesSemanales[0].dias[0].momentos[2].actividades;
  if (!String(inicio[1]).startsWith("Retroalimentación")) throw new Error("posición 2 del Inicio sin retroalimentación");
  if (cierre.some((a) => String(a).trim().startsWith("Retroalimentación"))) {
    throw new Error("el Cierre no debe abrir con retroalimentación de la clase");
  }
});

// ─── Regresión del error real de generación (2026-07-08) ─────────────────────
// "R1: competencia 1 sin indicadores; placeholder legacy detectado"

console.log("Regresión — corpus v1.2 con indicadores planos y placeholders:");

check("competenciasDetalle resuelve indicadores PLANOS por competenciaId (corpus v1.2)", () => {
  const comps = [
    { id: "ING-1-C01", competenciaFundamental: "Comunicativa", especifica: "Comprende y expresa ideas..." },
    { id: "ING-1-C02", competenciaFundamental: "Pensamiento Lógico", especifica: "Interactúa empleando estrategias..." },
  ];
  const indsPlanos = [
    { id: "ING-1-I01", descripcion: "Responde de forma adecuada a preguntas e indicaciones.", competenciaId: "ING-1-C01" },
    { id: "ING-1-I02", descripcion: "Se expresa mediante frases breves y sencillas.", competenciaId: "ING-1-C01" },
    { id: "ING-1-I04", descripcion: "Responde utilizando el pensamiento lógico verbal.", competenciaId: "ING-1-C02" },
  ];
  const detalle = construirCompetenciasDetalle(comps, indsPlanos, ["Comunicativa"]);
  if (detalle[0].indicadores.length !== 2) throw new Error(`C01 esperaba 2 indicadores, tiene ${detalle[0].indicadores.length}`);
  if (detalle[1].indicadores.length !== 1) throw new Error(`C02 esperaba 1 indicador, tiene ${detalle[1].indicadores.length}`);
  if (detalle[0].indicadores[0].codigo !== "ING-1-I01") throw new Error("perdió el código oficial del indicador");
});

check("indicadores ANIDADOS como STRINGS planos (corpus antiguos) → también resuelven", () => {
  const comps = [{
    id: "ING-1-C01", especifica: "Comprende y expresa ideas...",
    indicadoresLogro: [
      "Responde de forma adecuada a preguntas e indicaciones.",
      "Se expresa mediante frases y oraciones breves y sencillas.",
    ],
  }];
  const detalle = construirCompetenciasDetalle(comps, [], ["Comunicativa"]);
  if (detalle[0].indicadores.length !== 2) throw new Error(`esperaba 2, hay ${detalle[0].indicadores.length}`);
  if (!detalle[0].indicadores[0].descripcion.startsWith("Responde")) throw new Error("perdió el texto del string");
});

check("indicadores PLANOS como strings + división exacta → bloques secuenciales", () => {
  const comps = [{ id: "C1", especifica: "Comp 1" }, { id: "C2", especifica: "Comp 2" }];
  const inds = ["Indicador uno.", "Indicador dos.", "Indicador tres.", "Indicador cuatro."];
  const detalle = construirCompetenciasDetalle(comps, inds, []);
  if (detalle[0].indicadores.length !== 2 || detalle[1].indicadores.length !== 2) {
    throw new Error("no repartió los strings planos en bloques");
  }
  if (detalle[1].indicadores[0].descripcion !== "Indicador tres.") throw new Error("bloques desordenados");
});

check("indicadores: del tema en NEGRITA, previos TACHADOS, resto NORMAL — la tabla muestra los 3", () => {
  const u = structuredClone(unidadFixture);
  // Tres indicadores en la misma competencia, uno por estado.
  u.competenciasDetalle = [{
    competenciaFundamental: "Comunicativa",
    codigo: "ING-2-C01",
    especifica: "Comprende y expresa ideas...",
    indicadores: [
      { codigo: "ING-2-I01", descripcion: "DEL_TEMA_marca", aplicaTemaActual: true,  trabajadoAntes: false },
      { codigo: "ING-2-I02", descripcion: "YA_TRABAJADO_marca", aplicaTemaActual: false, trabajadoAntes: true },
      { codigo: "ING-2-I03", descripcion: "NO_APLICA_marca", aplicaTemaActual: false, trabajadoAntes: false },
    ],
  }];
  const out = formatearUnidadHTML(u, "");
  // Los tres SÍ aparecen (la tabla muestra los 21 completos).
  for (const m of ["DEL_TEMA_marca", "YA_TRABAJADO_marca", "NO_APLICA_marca"]) {
    if (!out.includes(m)) throw new Error(`la tabla no muestra el indicador ${m}`);
  }
  // Del tema → negrita (font-weight:700 envolviendo su código+texto).
  if (!/font-weight:700[^>]*>\s*<strong>ING-2-I01<\/strong>/.test(out)
      && !new RegExp('font-weight:700[\\s\\S]{0,40}ING-2-I01').test(out)) {
    throw new Error("el indicador del tema no salió en negrita");
  }
  // Ya trabajado → tachado (line-through).
  if (!new RegExp('line-through[\\s\\S]{0,60}ING-2-I02').test(out)) {
    throw new Error("el indicador ya trabajado no salió tachado");
  }
  // No aplica → sin <strong> en su código y sin negrita/tachado envolviéndolo.
  if (/<strong>ING-2-I03<\/strong>/.test(out)) {
    throw new Error("el indicador que NO aplica salió con código en negrita");
  }
});

check("competenciasDetalle sigue soportando indicadores ANIDADOS (v1.3)", () => {
  const comps = [{
    id: "CE-LEI-1", especifica: "Comprensión oral...",
    indicadoresLogro: [{ id: "IL-1", descripcion: "Responde de forma adecuada." }],
  }];
  const detalle = construirCompetenciasDetalle(comps, [], ["Comunicativa"]);
  if (detalle[0].indicadores.length !== 1) throw new Error("no leyó los anidados");
});

check("una competencia puntual sin indicadores en la malla NO bloquea (nota honesta)", () => {
  const u = clonar();
  u.competenciasDetalle.push({
    codigo: "CE-LEI-9", competenciaFundamental: "Ambiental y de la Salud",
    especifica: "Muestra preferencias por opciones saludables...", indicadores: [],
  });
  validarUnidadRenderizada(u, formatearUnidadHTML(u, ""));
});

check("TODAS las competencias sin indicadores → sí bloquea", () => {
  const u = clonar();
  u.competenciasDetalle = u.competenciasDetalle.map((c) => ({ ...c, indicadores: [] }));
  esperaError(() => validarUnidadRenderizada(u, formatearUnidadHTML(u, "")), "ninguna competencia tiene indicadores");
});

check("texto de la IA con 'Estructuras gramaticales básicas' NO bloquea (lenguaje pedagógico normal)", () => {
  const u = clonar();
  u.fasesSemanales[0].dias[0].momentos[1].evidencias = "• Identifica las Estructuras gramaticales básicas del tema en contexto.";
  u.fasesSemanales[0].dias[0].momentos[1].actividades.push("Practican las Estructuras gramaticales básicas trabajadas con there is / there are.");
  validarUnidadRenderizada(u, formatearUnidadHTML(u, ""));
});

check("placeholder en CONTENIDOS (corpus) → sí bloquea con la RUTA exacta", () => {
  const u = clonar();
  u.contenidos.conceptuales.push("Estructuras gramaticales básicas");
  esperaError(
    () => validarUnidadRenderizada(u, formatearUnidadHTML(u, "")),
    `CONTENIDOS.conceptuales[${u.contenidos.conceptuales.length - 1}]`
  );
});

check("placeholder en contenidosSintesis (NO renderizado) → no bloquea", () => {
  const u = clonar();
  u.modeloCurricularSuperior = {
    ejes: [{ nombre: "Alfabetización Imprescindible", descripcion: "Comprensión y expresión en inglés." }],
    progresion: [],
    contenidosSintesis: { conceptuales: ["Estructuras gramaticales básicas", "There + be"] },
  };
  validarUnidadRenderizada(u, formatearUnidadHTML(u, ""));
});

check("localizarPlaceholdersProhibidos devuelve la ruta exacta dentro del JSON", () => {
  const payload = {
    contenidosGenerales: { conceptuales: ["There + be en presente simple", "Estructuras gramaticales básicas"] },
    competencias: [{ descripcion: "Vocabulario clave relacionado con el tema" }],
  };
  const hallazgos = localizarPlaceholdersProhibidos(payload);
  if (hallazgos.length !== 2) throw new Error(`esperaba 2 hallazgos, hay ${hallazgos.length}`);
  if (!hallazgos.some((h) => h.ruta === "contenidosGenerales.conceptuales[1]")) throw new Error("no localizó la ruta del conceptual");
  if (!hallazgos.some((h) => h.ruta === "competencias[0].descripcion")) throw new Error("no localizó la ruta de la competencia");
});

// ─── Candado por nivel: la malla se resuelve por (level, grade, subject) ─────

console.log("Candado por nivel — resolución estricta de malla:");

// Escenario real del síntoma: SOLO la malla de Inglés 1ro SECUNDARIA cargada
const docsBanco = [
  {
    id: "ing-1ro-secundaria",
    contentType: "malla_curricular",
    level: "Secundario",
    grade: "1ro",
    subject: "Inglés",
    area: "Lenguas Extranjeras",
    payload: {},
  },
  // Distractor: un registro del mismo grado/asignatura NUNCA sirve de malla
  {
    id: "registro-1ro-secundaria",
    contentType: "registro_minerd",
    level: "Secundario",
    grade: "1ro",
    subject: "Inglés",
    payload: {},
  },
];

check("(a) primaria (cualquier grado) con solo ING-1 secundaria → DETIENE (null)", () => {
  for (const grado of ["1ro Primaria", "4to Primaria", "6to Primaria"]) {
    const doc = seleccionarMallaParaUnidad(docsBanco, { nivel: "Primaria", grado });
    if (doc) throw new Error(`resolvió "${doc.id}" para ${grado} de Primaria — cruzó niveles`);
  }
});

check("(b) secundaria 2do/3ro sin malla cargada → DETIENE (null)", () => {
  for (const grado of ["2do Secundaria", "3ro Secundaria"]) {
    const doc = seleccionarMallaParaUnidad(docsBanco, { nivel: "Secundaria", grado });
    if (doc) throw new Error(`resolvió "${doc.id}" para ${grado} — grado sin malla`);
  }
});

check("(c) secundaria 1ro → procede con la malla correcta", () => {
  const doc = seleccionarMallaParaUnidad(docsBanco, { nivel: "Secundaria", grado: "1ro Secundaria" });
  if (!doc) throw new Error("no resolvió la malla existente de 1ro Secundaria");
  if (doc.id !== "ing-1ro-secundaria") throw new Error(`resolvió el doc equivocado: ${doc.id}`);
});

check("el nivel se deriva del grado cuando no viene aparte (\"1ro Secundaria\")", () => {
  const doc = seleccionarMallaParaUnidad(docsBanco, { grado: "1ro Secundaria" });
  if (!doc || doc.id !== "ing-1ro-secundaria") throw new Error("no derivó el nivel desde el grado");
  const cruzado = seleccionarMallaParaUnidad(docsBanco, { grado: "1ro Primaria" });
  if (cruzado) throw new Error("derivando desde el grado también cruzó niveles");
});

check("clave incompleta (sin nivel resoluble) → fail closed (null)", () => {
  const doc = seleccionarMallaParaUnidad(docsBanco, { grado: "1ro" });
  if (doc) throw new Error("resolvió malla sin conocer el nivel — debe detenerse");
});

check("contentType distinto de malla_curricular nunca se selecciona", () => {
  const soloRegistro = docsBanco.filter((d) => d.contentType === "registro_minerd");
  const doc = seleccionarMallaParaUnidad(soloRegistro, { nivel: "Secundaria", grado: "1ro Secundaria" });
  if (doc) throw new Error(`seleccionó un ${doc.contentType} como malla`);
});

// ─── Selector de temas: FUENTE ÚNICA (payload.temas de la malla resuelta) ────

console.log("Selector de temas — fuente única:");

const TEMAS_ING1 = [
  "Identificación personal", "Relaciones humanas y sociales", "Actividades de la vida diaria",
  "Vivienda, entorno y ciudad", "Escuela y educación", "Deporte, tiempo libre y recreación",
  "Alimentación", "Salud y cuidados físicos", "Lengua y comunicación", "Ciencia y tecnología",
  "Clima, condiciones atmosféricas y medio ambiente", "Bienes y servicios", "Actividades sociales y culturales",
];

check("temasOficialesDeMalla devuelve SOLO temas oficiales — jamás contenidos", () => {
  const payload = {
    temas: TEMAS_ING1,
    contenidosGenerales: { conceptuales: ["Verb Be en presente simple", "Estructuras gramaticales básicas"] },
    contenidos: { conceptos: { items: ["There + be para describir lugares"] } },
  };
  const temas = temasOficialesDeMalla(payload);
  if (temas.length !== 13) throw new Error(`esperaba 13 temas, hay ${temas.length}`);
  if (temas.some((t) => t.includes("Verb Be") || t.includes("Estructuras") || t.includes("There + be"))) {
    throw new Error("mezcló contenidos como temas");
  }
});

check("con solo ING-1 Secundaria: el selector lista los 13 temas en 1ro Secundaria y candado en el resto", () => {
  const banco = [{
    id: "ING-1", contentType: "malla_curricular", level: "Secundario", grade: "1ro",
    subject: "Inglés", area: "Lenguas Extranjeras", payload: { temas: TEMAS_ING1 },
  }];
  const malla = seleccionarMallaParaUnidad(banco, { nivel: "Secundaria", grado: "1ro Secundaria" });
  if (!malla || temasOficialesDeMalla(malla).length !== 13) throw new Error("1ro Secundaria no listó los 13 temas oficiales");
  for (const caso of [
    { nivel: "Primaria", grado: "1ro Primaria" },
    { nivel: "Secundaria", grado: "2do Secundaria" },
    { nivel: "Secundaria", grado: "3ro Secundaria" },
  ]) {
    if (seleccionarMallaParaUnidad(banco, caso)) throw new Error(`${caso.grado} debía mostrar el candado, no temas`);
  }
});

check("fallbacks secuenciales (temasCurriculares / conceptos.temas), nunca mezcla", () => {
  const t1 = temasOficialesDeMalla({ temasCurriculares: ["Alimentación"] });
  if (t1.length !== 1 || t1[0] !== "Alimentación") throw new Error("no usó temasCurriculares");
  const t2 = temasOficialesDeMalla({ contenidos: { conceptos: { temas: ["Vivienda, entorno y ciudad"] } } });
  if (t2.length !== 1) throw new Error("no usó conceptos.temas");
  if (temasOficialesDeMalla({ contenidosGenerales: { conceptuales: ["Verb Be"] } }).length !== 0) {
    throw new Error("inventó temas desde contenidos");
  }
});

check("indicadores sin competenciaId → mapeo por bloques secuenciales (21/7 = 3 por competencia)", () => {
  const comps = Array.from({ length: 7 }, (_, i) => ({ id: `ING-1-C0${i + 1}`, especifica: `Competencia ${i + 1}` }));
  const inds = Array.from({ length: 21 }, (_, i) => ({ id: `ING-1-I${String(i + 1).padStart(2, "0")}`, descripcion: `Indicador ${i + 1}` }));
  const detalle = construirCompetenciasDetalle(comps, inds, ["Comunicativa"]);
  if (detalle.length !== 7) throw new Error("perdió competencias");
  for (let i = 0; i < 7; i++) {
    if (detalle[i].indicadores.length !== 3) throw new Error(`C0${i + 1} esperaba 3 indicadores, tiene ${detalle[i].indicadores.length}`);
  }
  if (detalle[0].indicadores[0].codigo !== "ING-1-I01") throw new Error("bloque 1 desordenado");
  if (detalle[6].indicadores[2].codigo !== "ING-1-I21") throw new Error("bloque 7 desordenado");
});

check("CASO REAL doc ayDm2…: 8 competencias (1 basura sin específica) + 21 indicadores planos → 7 bloques de 3", () => {
  const comps = [
    ...Array.from({ length: 7 }, (_, i) => ({ id: `ING-1-C0${i + 1}`, especifica: `Competencia específica ${i + 1}` })),
    { id: "ING-1-C08", especifica: "" }, // fila basura de la conversión
  ];
  const inds = Array.from({ length: 21 }, (_, i) => ({ id: `ING-1-I${String(i + 1).padStart(2, "0")}`, descripcion: `Indicador ${i + 1}` }));
  const detalle = construirCompetenciasDetalle(comps, inds, ["Comunicativa"]);
  if (detalle.length !== 7) throw new Error(`esperaba 7 competencias válidas, hay ${detalle.length}`);
  for (const c of detalle) {
    if (c.indicadores.length !== 3) throw new Error(`${c.codigo} esperaba 3 indicadores, tiene ${c.indicadores.length}`);
  }
  if (detalle[6].indicadores[2].codigo !== "ING-1-I21") throw new Error("bloques desalineados tras filtrar la basura");
});

check("CASO REAL doc 39Jn…: 8 competencias por CF duplicada + 21 indicadores planos → dedupe prudente a 7 bloques", () => {
  const comps = [
    { id: "", competenciaFundamental: "Comunicativa", especifica: "Competencia específica 1" },
    { id: "", competenciaFundamental: "Pensamiento Lógico, Creativo y Crítico", especifica: "Competencia específica 2" },
    { id: "", competenciaFundamental: "Resolución de Problemas", especifica: "Competencia específica 3" },
    { id: "", competenciaFundamental: "Ética y Ciudadana", especifica: "Competencia específica 4" },
    { id: "", competenciaFundamental: "Científica y Tecnológica", especifica: "Competencia específica 5" },
    { id: "", competenciaFundamental: "Ambiental y de la Salud", especifica: "Competencia específica 6" },
    { id: "", competenciaFundamental: "Desarrollo Personal y Espiritual", especifica: "Competencia específica 7" },
    { id: "CE-pensamiento-logico-cre", competenciaFundamental: "Pensamiento Lógico, Creativo y Crítico", especifica: "Competencia específica duplicada" },
  ];
  const inds = Array.from({ length: 21 }, (_, i) => ({ id: `IL-${String(i + 1).padStart(2, "0")}`, descripcion: `Indicador ${i + 1}` }));
  const detalle = construirCompetenciasDetalle(comps, inds, []);
  if (detalle.length !== 7) throw new Error(`esperaba dedupe a 7 competencias, hay ${detalle.length}`);
  for (const c of detalle) {
    if (c.indicadores.length !== 3) throw new Error(`${c.competenciaFundamental} esperaba 3 indicadores, tiene ${c.indicadores.length}`);
  }
  if (detalle[1].competenciaFundamental !== "Pensamiento Lógico, Creativo y Crítico") throw new Error("eliminó la competencia original en vez de la duplicada");
  if (detalle[6].indicadores[2].codigo !== "IL-21") throw new Error("bloques desalineados tras dedupe por CF");
});

check("fallback por Competencia Fundamental: indicadores con CF textual se asocian por nombre", () => {
  const comps = [
    { id: "C1", competenciaFundamental: "Comunicativa", especifica: "CE comunicativa" },
    { id: "C2", competenciaFundamental: "Ética y Ciudadana", especifica: "CE ética" },
  ];
  const inds = [
    { id: "I1", descripcion: "Responde adecuadamente.", competenciaFundamental: "Comunicativa" },
    { id: "I2", descripcion: "Se expresa con frases breves.", competenciaFundamental: "comunicativa" },
    { id: "I3", descripcion: "Interactúa con cortesía.", competenciaFundamental: "Ética y ciudadana" },
  ];
  const detalle = construirCompetenciasDetalle(comps, inds, []);
  if (detalle[0].indicadores.length !== 2) throw new Error("no asoció por CF (comunicativa)");
  if (detalle[1].indicadores.length !== 1) throw new Error("no asoció por CF (ética)");
});

check("división inexacta sin vínculos → NO inventa asociación (indicadores vacíos)", () => {
  const comps = [{ id: "C1", especifica: "Comp 1" }, { id: "C2", especifica: "Comp 2" }];
  const inds = [{ id: "I1", descripcion: "Ind 1" }, { id: "I2", descripcion: "Ind 2" }, { id: "I3", descripcion: "Ind 3" }];
  const detalle = construirCompetenciasDetalle(comps, inds, []);
  if (detalle.some((c) => c.indicadores.length)) throw new Error("asoció indicadores adivinando (3/2 no es exacto)");
});

// ─── Cirugía del Banco: bypass de nivel, guards y temas trabajados ───────────

console.log("Cirugía del Banco — bypass, guards y contexto:");

check("BYPASS cerrado: nivel rancio 'Secundaria' + grado '1ro Primaria' → candado (el grado manda)", () => {
  const banco = [{
    id: "ING-1", contentType: "malla_curricular", level: "Secundario", grade: "1ro",
    subject: "Inglés", area: "Lenguas Extranjeras", payload: { temas: TEMAS_ING1 },
  }];
  const doc = seleccionarMallaParaUnidad(banco, { nivel: "Secundaria", grado: "1ro Primaria" });
  if (doc) throw new Error("resolvió Secundaria para un grado de Primaria con nivel rancio");
  const ok = seleccionarMallaParaUnidad(banco, { nivel: "Secundaria", grado: "1ro Secundaria" });
  if (!ok) throw new Error("dejó de resolver el caso legítimo");
});

check("guards: backlink correcto pasa; huérfano con sourceId hacia fuente-malla activa RESCATADO", () => {
  const guards = {
    sourceIds: new Set(["src-A", "src-B"]),
    contentIds: new Set(["content-1"]),
    contentToSource: new Map([["content-1", "src-A"]]),
  };
  if (!hasActiveMallaSource({ id: "content-1", sourceId: "src-A" }, guards)) throw new Error("backlink correcto rechazado");
  if (hasActiveMallaSource({ id: "content-1", sourceId: "src-X" }, guards)) throw new Error("backlink a otra fuente aceptado");
  if (!hasActiveMallaSource({ id: "content-2", sourceId: "src-B" }, guards)) throw new Error("huérfano con sourceId válido no rescatado");
  if (hasActiveMallaSource({ id: "content-3", sourceId: "src-Z" }, guards)) throw new Error("contenido cuya fuente fue ARCHIVADA (src-Z) debe ocultarse");
  // Malla activa SIN sourceId registrado (creada por conversión de PDF cuyo
  // backlink no quedó en guards): fail-open, es utilizable — nunca se oculta
  // una malla activa por plomería interna.
  if (!hasActiveMallaSource({ id: "content-4", sourceId: "" }, guards)) throw new Error("malla activa sin sourceId fue ocultada (falso bloqueo)");
});

check("guards null (fuentes ilegibles) → no filtra, nunca bloquea", () => {
  if (!hasActiveMallaSource({ id: "x", sourceId: "" }, null)) throw new Error("guards null bloqueó contenido");
});

check("tema trabajado en 1ro Secundaria NO marca 1ro Primaria (ni 2do, ni otra asignatura)", () => {
  const registro = { texto: "Parts of the House", nivel: "Secundaria", grado: "1ro Secundaria", asignatura: "Inglés", area: "Lenguas Extranjeras" };
  if (!coincideContextoTemaTrabajado(registro, { nivel: "Secundaria", grado: "1ro Secundaria", asignatura: "Inglés" })) {
    throw new Error("no coincidió en su propio contexto");
  }
  if (coincideContextoTemaTrabajado(registro, { nivel: "Primaria", grado: "1ro Primaria", asignatura: "Inglés" })) {
    throw new Error("marcó trabajado en Primaria");
  }
  if (coincideContextoTemaTrabajado(registro, { nivel: "Secundaria", grado: "2do Secundaria", asignatura: "Inglés" })) {
    throw new Error("marcó trabajado en otro grado");
  }
  if (coincideContextoTemaTrabajado(registro, { nivel: "Secundaria", grado: "1ro Secundaria", asignatura: "Francés" })) {
    throw new Error("marcó trabajado en otra asignatura");
  }
});

check("contexto: nivel derivado del grado cuando falta; irresoluble → no coincide", () => {
  const registro = { texto: "Daily Routine", grado: "1ro Secundaria", asignatura: "Inglés" };
  if (!coincideContextoTemaTrabajado(registro, { grado: "1ro Secundaria", asignatura: "Inglés" })) {
    throw new Error("no derivó el nivel del grado");
  }
  const sinNivel = { texto: "Daily Routine", grado: "1ro", asignatura: "Inglés" };
  if (coincideContextoTemaTrabajado(sinNivel, { grado: "1ro Primaria", asignatura: "Inglés" })) {
    throw new Error("coincidió con contexto irresoluble (grado sin nivel)");
  }
});

// ─── Capa 2: enriquecimiento_tema (tema oficial → subconjunto de la malla) ───

console.log("Capa 2 — enriquecimiento_tema:");

// Fixture fiel al JSON real (enriquecimiento_tema_ING1.json, tema Vivienda)
const enriquecimientoING1 = {
  contentType: "enriquecimiento_tema",
  payload: {
    derivedFrom: "ING-1",
    temas: [{
      temaOficial: "Vivienda, entorno y ciudad",
      vocabularioCategorias: ["Lugares de un edificio", "Mobiliario del hogar y de la oficina", "Tareas del hogar"],
      gramaticaEstructuras: ["There + be en presente simple para describir lugares", "Preposiciones de tiempo (in, on, at) y de lugar (in, on, at)"],
      funcionales: ["Describir y comparar lugares y objetos", "Dar y pedir indicaciones e instrucciones"],
      expresiones: ["Expresar aprobación o acuerdo", "Atraer la atención"],
    }],
  },
};

const corpusV13 = {
  contenidos: {
    conceptos: {
      vocabulario: [
        { categoria: "Lugares de un edificio", ejemplos: ["lobby", "entrance", "exit"] },
        { categoria: "Mobiliario del hogar y de la oficina", ejemplos: ["chair", "desk"] },
        { categoria: "Alimentos", ejemplos: ["rice", "beans"] },
      ],
      gramatica: [
        { estructura: "There + be en presente simple para describir lugares" },
        { estructura: "Presente perfecto para narrar experiencias personales" },
      ],
      expresiones: [
        { categoria: "Expresar aprobación o acuerdo", ejemplos: ["That's right!"] },
        { categoria: "Despedidas", ejemplos: ["Goodbye!"] },
      ],
    },
    procedimientos: { funcionales: ["Funcional genérica del grado completo"] },
  },
};

check("resolverTemaEnriquecido encuentra el tema oficial (acentos/mayúsculas indiferentes)", () => {
  const t = resolverTemaEnriquecido(enriquecimientoING1, "vivienda, entorno y ciudad");
  if (!t || t.temaOficial !== "Vivienda, entorno y ciudad") throw new Error("no resolvió el tema");
  if (resolverTemaEnriquecido(enriquecimientoING1, "Alimentación")) throw new Error("resolvió un tema inexistente");
});

check("con Capa 2: vocabulario SOLO de las categorías del tema (sin rice/beans)", () => {
  const t = resolverTemaEnriquecido(enriquecimientoING1, "Vivienda, entorno y ciudad");
  const mc = _extraerContenidosMallaCorpus(corpusV13, "Vivienda, entorno y ciudad", t);
  for (const palabra of ["lobby", "entrance", "chair", "desk"]) {
    if (!mc.vocabulario.includes(palabra)) throw new Error(`falta "${palabra}"`);
  }
  if (mc.vocabulario.includes("rice") || mc.vocabulario.includes("beans")) {
    throw new Error("incluyó vocabulario de otra categoría (Alimentos)");
  }
});

check("con Capa 2: gramática por igualdad EXACTA de estructura", () => {
  const t = resolverTemaEnriquecido(enriquecimientoING1, "Vivienda, entorno y ciudad");
  const mc = _extraerContenidosMallaCorpus(corpusV13, "Vivienda, entorno y ciudad", t);
  if (!mc.gramatica.includes("There + be en presente simple para describir lugares")) throw new Error("falta la estructura del tema");
  if (mc.gramatica.some((g) => g.includes("Presente perfecto"))) throw new Error("incluyó una estructura de otro tema");
});

check("con Capa 2: funcionales del tema pasan a la spec; expresiones filtradas por categoría", () => {
  const t = resolverTemaEnriquecido(enriquecimientoING1, "Vivienda, entorno y ciudad");
  const mc = _extraerContenidosMallaCorpus(corpusV13, "Vivienda, entorno y ciudad", t);
  // Los funcionales llegan etiquetados para el prompt ("Funcional: …")
  if (!mc.funcionales.some((f) => f.includes("Describir y comparar lugares y objetos"))) throw new Error("no pasó los funcionales del tema");
  if (mc.funcionales.some((f) => f.includes("Funcional genérica del grado completo"))) throw new Error("mezcló funcionales del grado");
  if (!mc.expresiones.includes("That's right!")) throw new Error("no filtró expresiones por categoría");
  if (mc.expresiones.includes("Goodbye!")) throw new Error("incluyó expresiones de otra categoría");
});

check("sin Capa 2 (ausente): comportamiento actual — nivel-grado completo, nunca bloquea", () => {
  const mc = _extraerContenidosMallaCorpus(corpusV13, "Vivienda, entorno y ciudad", null);
  if (!mc.vocabulario.includes("rice")) throw new Error("sin Capa 2 debía traer el grado completo");
  if (!mc.funcionales.some((f) => f.includes("Funcional genérica del grado completo"))) throw new Error("perdió los funcionales del grado");
});

check("corpus sin campo categoria + Capa 2 → fallback al grado (expresiones = etiquetas del tema)", () => {
  const corpusSinCategorias = {
    contenidos: {
      conceptos: {
        vocabulario: [{ ejemplos: ["window", "door"] }],
        gramatica: [{ estructura: "Otra estructura cualquiera" }],
        expresiones: [],
      },
      procedimientos: { funcionales: [] },
    },
  };
  const t = resolverTemaEnriquecido(enriquecimientoING1, "Vivienda, entorno y ciudad");
  const mc = _extraerContenidosMallaCorpus(corpusSinCategorias, "Vivienda, entorno y ciudad", t);
  if (!mc.vocabulario.includes("window")) throw new Error("el fallback no conservó el vocabulario del grado");
  if (!mc.expresiones.includes("Expresar aprobación o acuerdo")) throw new Error("no pasó las etiquetas de expresiones del tema");
});

// ─── Contrato canónico (curricularSchema.js) — caso real v2.0 como fixture ───

const casoRealV2 = JSON.parse(readFileSync(join(__dir, "fixtures", "caso-real-v2.json"), "utf8"));

check("caso real v2.0: el contrato lo RECHAZA por la versión desconocida", () => {
  const r = validateCurricularDoc(casoRealV2);
  if (r.ok) throw new Error("aceptó el doc v2.0 que rompió la generación real");
  // La violación dura es la versión: el código nunca acepta un schemaVersion
  // que no conoce. (El código de competencia ya NO es obligatorio — el diseño
  // MINERD real no lo trae; se deriva del nombre.)
  if (!r.violaciones.some((h) => h.ruta === "schemaVersion" && h.mensaje.includes('"2.0"'))) {
    throw new Error("no marcó schemaVersion 2.0 como versión desconocida");
  }
});

check("competencias con NOMBRE pero sin código ING-1-C0x → válidas (diseño MINERD real)", () => {
  const nombresCF = [
    "Comunicativa", "Ética y Ciudadana", "Pensamiento Lógico, Creativo y Crítico",
    "Resolución de Problemas", "Científica y Tecnológica", "Ambiental y de la Salud",
    "Desarrollo Personal y Espiritual",
  ];
  const doc = {
    schemaVersion: SCHEMA_VERSION_CANONICA, level: "Secundaria", grade: "1ro",
    area: "Lenguas Extranjeras", subject: "Inglés", contentType: "malla_curricular",
    temas: ["Vivienda, entorno y ciudad"],
    // Cardinalidad canónica (7/21) sin códigos: lo que trae el diseño real
    competencias: nombresCF.map((nombre) => ({
      competenciaFundamental: nombre, especificaGrado: `Específica de ${nombre}…`,
    })),
    indicadoresLogro: Array.from({ length: 21 }, (_, j) => ({
      id: `IL-${j + 1}`, descripcion: `Indicador de logro número ${j + 1}.`,
    })),
    contenidos: {
      conceptos: { vocabulario: [{ categoria: "Vivienda", ejemplos: ["lobby"] }], gramatica: [{ estructura: "There + be" }] },
      procedimientos: { funcionales: ["Describir lugares"] },
      actitudinales: ["Valoración del hogar"],
    },
  };
  const r = validateCurricularDoc(doc);
  const compViol = r.violaciones.filter((h) => h.ruta.startsWith("competencias"));
  if (compViol.length) throw new Error(`rechazó competencias sin código: ${JSON.stringify(compViol)}`);
  const indViol = r.violaciones.filter((h) => h.ruta.startsWith("indicadoresLogro"));
  if (indViol.length) throw new Error(`rechazó indicadores anidables sin competenciaId: ${JSON.stringify(indViol)}`);
});

check("caso real v2.0 con 8 competencias → rechazo por CARDINALIDAD (aunque la versión se corrija)", () => {
  const doc = JSON.parse(JSON.stringify(casoRealV2));
  doc.schemaVersion = SCHEMA_VERSION_CANONICA; // aislar la cardinalidad de la versión
  const r = validateCurricularDoc(doc);
  if (r.ok) throw new Error("aceptó un doc con 8 competencias");
  if (!r.violaciones.some((h) => h.ruta === "competencias" && h.mensaje.includes("trae 8"))) {
    throw new Error(`no señaló la cardinalidad de competencias: ${JSON.stringify(r.violaciones)}`);
  }
});

check("20 indicadores en vez de 21 → rechazo por cardinalidad", () => {
  const doc = JSON.parse(JSON.stringify(casoRealV2));
  doc.schemaVersion = SCHEMA_VERSION_CANONICA;
  doc.competencias = doc.competencias.slice(0, 7);
  doc.indicadoresLogro = doc.indicadoresLogro.slice(0, 20);
  const r = validateCurricularDoc(doc);
  if (!r.violaciones.some((h) => h.ruta === "indicadoresLogro" && h.mensaje.includes("trae 20"))) {
    throw new Error(`no señaló la cardinalidad de indicadores: ${JSON.stringify(r.violaciones)}`);
  }
});

check("el MISMO doc corregido (lo que Potente IA debe lograr) → contrato ok", () => {
  const reparado = JSON.parse(JSON.stringify(casoRealV2));
  reparado.schemaVersion = SCHEMA_VERSION_CANONICA;
  reparado.competencias = reparado.competencias.slice(0, 7); // fuera la fila basura
  reparado.indicadoresLogro = reparado.indicadoresLogro.map((texto, j) => ({
    id: `ING-1-I${String(j + 1).padStart(2, "0")}`,
    descripcion: texto,
    competenciaId: `ING-1-C${String((j % 7) + 1).padStart(2, "0")}`,
  }));
  const r = validateCurricularDoc(reparado);
  if (!r.ok) throw new Error(`sigue violando: ${r.violaciones.map((h) => `${h.ruta}: ${h.mensaje}`).join(" · ")}`);
});

check("indicador plano con competenciaId inexistente → violación con el código exacto", () => {
  const doc = JSON.parse(JSON.stringify(casoRealV2));
  doc.schemaVersion = SCHEMA_VERSION_CANONICA;
  doc.competencias = doc.competencias.slice(0, 7);
  doc.indicadoresLogro = [{ id: "I1", descripcion: "Algo", competenciaId: "ING-9-C99" }];
  const r = validateCurricularDoc(doc);
  if (!r.violaciones.some((h) => h.ruta === "indicadoresLogro[0].competenciaId" && h.mensaje.includes("ING-9-C99"))) {
    throw new Error("no señaló el competenciaId huérfano");
  }
});

check("placeholder prohibido dentro del payload → violación con ruta exacta", () => {
  const doc = JSON.parse(JSON.stringify(casoRealV2));
  doc.schemaVersion = SCHEMA_VERSION_CANONICA;
  doc.competencias = doc.competencias.slice(0, 7);
  doc.indicadoresLogro = [{ id: "I1", descripcion: "Algo", competenciaId: "ING-1-C01" }];
  doc.contenidos.conceptos.gramatica = [{ estructura: "Estructuras gramaticales básicas" }];
  const r = validateCurricularDoc(doc);
  if (!r.violaciones.some((h) => h.ruta === "contenidos.conceptos.gramatica[0].estructura" && h.mensaje.includes("placeholder"))) {
    throw new Error(`no localizó el placeholder: ${JSON.stringify(r.violaciones)}`);
  }
});

check("enriquecimiento_tema: exige derivedFrom y temas; no exige competencias", () => {
  const r1 = validateCurricularDoc({
    schemaVersion: "1.0", level: "Secundaria", grade: "1ro", area: "Lenguas Extranjeras",
    subject: "Inglés", contentType: "enriquecimiento_tema",
    payload: { contentType: "enriquecimiento_tema", schemaVersion: "1.0", level: "Secundaria", grade: "1ro", area: "Lenguas Extranjeras", subject: "Inglés", temas: [{ temaOficial: "Vivienda, entorno y ciudad" }] },
  });
  if (!r1.violaciones.some((h) => h.ruta === "payload.derivedFrom")) throw new Error("no exigió derivedFrom");
  if (r1.violaciones.some((h) => h.ruta === "competencias")) throw new Error("exigió competencias a un enriquecimiento");
});

check("re-export de compat: el Banco y curricularSchema comparten el MISMO walker", () => {
  if (localizarPlaceholdersProhibidos !== locSchema) throw new Error("el Banco no re-exporta la fuente única");
});

// ─── Semanas calendario en el render (fase ≠ semana) ─────────────────────────

console.log("\nSemanas calendario:");

check("una fase de 8 días con 4 clases/semana se muestra como SEMANA 2 y SEMANA 3, jamás '(8 días)'", () => {
  const u = JSON.parse(JSON.stringify(unidadFixture));
  const dias = Array.from({ length: 8 }, (_, i) => {
    const d = JSON.parse(JSON.stringify(unidadFixture.fasesSemanales[0].dias[0]));
    d.numero = i + 1;
    d.numeroGlobal = i + 3;
    d.semana = i < 4 ? 2 : 3;
    d.numeroEnSemana = (i % 4) + 1;
    d.tituloSemana = d.semana === 2 ? "Explorando la casa" : "Describiendo mi casa";
    return d;
  });
  u.fasesSemanales.push({
    numero: 2, nombre: "Desarrollo y exploración", estrategia: "Enfoque comunicativo",
    indicadoresAvance: ["Responde de forma adecuada a preguntas sencillas sobre su entorno."],
    dias,
  });
  const h = formatearUnidadHTML(u, "");
  if (!h.includes("SEMANA 2 (4 días)")) throw new Error("no agrupó la primera semana calendario");
  if (!h.includes("SEMANA 3 (4 días)")) throw new Error("no agrupó la segunda semana calendario");
  if (h.includes("(8 días)")) throw new Error("sigue rotulando la fase completa como una semana de 8 días");
  if (!h.includes('"Explorando la casa"') || !h.includes('"Describiendo mi casa"')) {
    throw new Error("las bandas no usan el título de SU semana");
  }
});

check("la banda de semana NO duplica el número: SEMANA N lo pone una sola vez, el título es solo la frase", () => {
  const u = JSON.parse(JSON.stringify(unidadFixture));
  // Título de semana SIN prefijo "Semana N:" (así lo produce el generador tras
  // el fix): la banda antepone SEMANA N; embeder el número aquí daba
  // "SEMANA 2: 'Semana 1: …'" — duplicado y desincronizado.
  u.fasesSemanales[0].dias.forEach((d) => { d.tituloSemana = "Exploración de estructuras de permiso"; });
  const h = formatearUnidadHTML(u, "");
  if (/SEMANA \d+ \([^)]*\):\s*"Semana \d+:/.test(h)) {
    throw new Error("la banda duplica el número de semana (SEMANA N: 'Semana M: …')");
  }
  if (!h.includes('"Exploración de estructuras de permiso"')) {
    throw new Error("la banda no muestra la frase descriptiva del título de semana");
  }
});

check("el Día N se cuenta dentro de su semana (numeroEnSemana manda)", () => {
  const u = JSON.parse(JSON.stringify(unidadFixture));
  u.fasesSemanales[0].dias[1].numeroEnSemana = 2;
  u.fasesSemanales[0].dias[1].numero = 7; // número de fase ≠ número en semana
  const h = formatearUnidadHTML(u, "");
  if (!h.includes(`Día 2: "${u.fasesSemanales[0].dias[1].titulo}"`)) {
    throw new Error("el encabezado del día no usa numeroEnSemana");
  }
});

check("nombreCortoEstructura extrae el nombre de la estructura oficial", () => {
  const casos = [
    ["Presente simple para hablar sobre rutinas diarias (I wake up at 6:00 a.m.)", "Presente simple"],
    ["Adverbios de frecuencia para describir hábitos (always, usually)", "Adverbios de frecuencia"],
    ["There + be en presente simple para describir lugares", "There + be en presente simple"],
  ];
  for (const [entrada, esperado] of casos) {
    const r = nombreCortoEstructura(entrada);
    if (r !== esperado) throw new Error(`"${entrada}" → "${r}" (esperado "${esperado}")`);
  }
});

// ─── Checkpoint único + Anexo H desde aportes reales ─────────────────────────

console.log("\nCheckpoint y Anexo H:");

check("el checkpoint de mitad se imprime UNA sola vez aunque dos fases compartan la semana de frontera", () => {
  const u = JSON.parse(JSON.stringify(unidadFixture));
  const mkDia = (glob, sem) => {
    const d = JSON.parse(JSON.stringify(unidadFixture.fasesSemanales[0].dias[0]));
    d.numeroGlobal = glob; d.semana = sem; d.numeroEnSemana = ((glob - 1) % 4) + 1;
    return d;
  };
  // Fase A cubre semanas 2-3, Fase B cubre semanas 3-4 → ambas contienen la 3
  u.fasesSemanales = [
    { numero: 1, nombre: "Fase A", estrategia: "x", indicadoresAvance: ["ok"], dias: [mkDia(1, 2), mkDia(2, 3)] },
    { numero: 2, nombre: "Fase B", estrategia: "x", indicadoresAvance: ["ok"], dias: [mkDia(3, 3), mkDia(4, 4)] },
  ];
  u.checkpointFormativo = { semana: 3, indicador: "Ind CP", evidencia: "Evi CP", accion: "Acc CP" };
  const h = formatearUnidadHTML(u, "");
  const veces = (h.match(/CHECKPOINT FORMATIVO/g) || []).length;
  if (veces !== 1) throw new Error(`el checkpoint aparece ${veces} veces (debe ser 1)`);
});

check("Anexo H usa los aporteProducto reales por semana calendario", () => {
  const u = JSON.parse(JSON.stringify(unidadFixture));
  u.anexos = {
    checklistProducto: [
      { paso: "Inventario del espacio favorito con posesivos", semana: "Semana 2" },
      { paso: "Presentación final: My House Map & Tour", semana: "Semana 5" },
    ],
  };
  const h = formatearUnidadHTML(u, "");
  if (!h.includes("Inventario del espacio favorito con posesivos")) {
    throw new Error("el Anexo H no muestra el aporte real de la clase");
  }
});

check("evidencias etiquetadas (Conocimientos/Desempeño/Producto) se renderizan en la celda", () => {
  const u = JSON.parse(JSON.stringify(unidadFixture));
  // Simula el resultado del merge: evidencias ya formateadas con etiquetas
  u.fasesSemanales[0].dias[0].momentos[1].evidencias =
    "**Desempeño:**\n1. Construye oraciones en presente simple.\n**Producto:**\n1. Cinco oraciones escritas.";
  const h = formatearUnidadHTML(u, "");
  if (!h.includes("<strong>Desempeño:</strong>")) throw new Error("no renderizó la etiqueta Desempeño");
  if (!h.includes("Cinco oraciones escritas")) throw new Error("no renderizó el ítem de producto");
});

// ─── Banco de Aprendizaje: refs exactas contra la malla ACTIVA ────────────────

const { verificarRefsContraMalla, construirSecuenciaCosechada, cosecharSecuenciaDeUnidad } =
  await import("../src/services/bancoAprendizajeService.js");

const mallaActiva = {
  id: "malla-abc",
  contentId: "ING-1",
  payload: {
    temas: ["Vivienda, entorno y ciudad", "Rutinas diarias"],
    competencias: [{ id: "ING-1-C01", indicadoresLogro: [{ id: "ING-1-I01" }, { id: "ING-1-I02" }] }],
    contenidos: {
      conceptos: {
        vocabulario: [{ categoria: "Vivienda", ejemplos: ["lobby"] }],
        gramatica: [{ estructura: "There + be en presente simple para describir lugares" }],
      },
    },
  },
};
const refsValidas = {
  mallaId: "malla-abc",
  temaOficial: "Vivienda, entorno y ciudad",
  codigosIndicadores: ["ING-1-I01", "ING-1-I02"],
  estructurasGramaticales: ["There + be en presente simple para describir lugares"],
  vocabularioCategorias: ["Vivienda"],
};

console.log("\nBanco de Aprendizaje — verificación de refs:");

check("refs exactas contra la malla activa → servible", () => {
  const r = verificarRefsContraMalla(refsValidas, mallaActiva);
  if (!r.servible) throw new Error(`no servible: ${r.motivos.join(" · ")}`);
});

check("un solo indicador inexistente → NO se sirve, motivo con el código exacto", () => {
  const r = verificarRefsContraMalla({ ...refsValidas, codigosIndicadores: ["ING-1-I01", "ING-1-I99"] }, mallaActiva);
  if (r.servible) throw new Error("sirvió una secuencia con indicador roto");
  if (!r.motivos.some((m) => m.includes("ING-1-I99"))) throw new Error("el motivo no nombra el código roto");
});

check("estructura gramatical parecida pero NO exacta → no servible (sin fuzzy)", () => {
  const r = verificarRefsContraMalla({ ...refsValidas, estructurasGramaticales: ["There + be en presente simple"] }, mallaActiva);
  if (r.servible) throw new Error("aceptó una coincidencia parcial de estructura");
});

check("secuencia de OTRA malla (mallaId distinto) → no servible", () => {
  const r = verificarRefsContraMalla({ ...refsValidas, mallaId: "malla-vieja" }, mallaActiva);
  if (r.servible) throw new Error("sirvió una secuencia anclada a otra malla");
});

check("tema que ya no existe en la malla → no servible", () => {
  const r = verificarRefsContraMalla({ ...refsValidas, temaOficial: "Alimentación" }, mallaActiva);
  if (r.servible) throw new Error("sirvió con tema inexistente");
});

check("construirSecuenciaCosechada exige spec + mallaId y ancla los códigos", () => {
  esperaError(() => construirSecuenciaCosechada({ unidad: {}, mallaId: "malla-abc" }), "especificacionCurricular");
  const sec = construirSecuenciaCosechada({
    unidad: {
      id: "u1",
      especificacionCurricular: {
        temaOficial: "Vivienda, entorno y ciudad", area: "Inglés", grado: "1ro Secundaria",
        ces: [{ codigoOficial: "ING-1-C01" }],
        indicadores: [{ codigoOficial: "ING-1-I01" }],
        contenidosClaves: { gramatica: ["There + be en presente simple para describir lugares"] },
        outputSchemaVersion: "1.2",
      },
      semanas: [{ semana: 1 }],
    },
    mallaId: "malla-abc", mallaContentId: "ING-1", docenteUid: "uid-1",
  });
  if (sec.estado !== "cosechada") throw new Error("no nace en estado cosechada");
  if (sec.curricularRefs.codigosIndicadores[0] !== "ING-1-I01") throw new Error("no ancló los códigos");
  if (!verificarRefsContraMalla(sec.curricularRefs, mallaActiva).servible) throw new Error("la cosecha no pasa su propia verificación");
});

const cosechaSinConsentimiento = await cosecharSecuenciaDeUnidad({ unidad: {}, mallaId: "x", consentimiento: false });
check("cosecha SIN consentimiento explícito → null (opt-in, jamás por defecto)", () => {
  if (cosechaSinConsentimiento !== null) throw new Error("cosechó sin consentimiento");
});

// ─── Resultado ────────────────────────────────────────────────────────────────

console.log(`\n${pasadas} ✓ · ${falladas} ✗`);
if (falladas > 0) process.exit(1);
