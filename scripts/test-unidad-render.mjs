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

import { formatearUnidadHTML, validarUnidadRenderizada, construirInicioCanonico, construirCompetenciasDetalle } from "../src/services/unidadAprendizajeService.js";
import { validarVozActividad } from "../src/services/phaseAService.js";
import { seleccionarMallaParaUnidad } from "../src/services/bancoConocimientoService.js";

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

check("placeholder en CONTENIDOS (corpus) → sí bloquea con mensaje accionable", () => {
  const u = clonar();
  u.contenidos.conceptuales.push("Estructuras gramaticales básicas");
  esperaError(() => validarUnidadRenderizada(u, formatearUnidadHTML(u, "")), "Banco de Conocimiento");
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

// ─── Resultado ────────────────────────────────────────────────────────────────

console.log(`\n${pasadas} ✓ · ${falladas} ✗`);
if (falladas > 0) process.exit(1);
