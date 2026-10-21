/**
 * test-coherencia-producto.mjs — Regresión del control de pertinencia del
 * producto final (validarCoherenciaProducto).
 *
 * Verificado contra el PDF real "Escuela y educación" (2do Sec. Inglés): las
 * fases finales derivaban a "rutinas/hábitos" (Habit Tracker, Routine Snapshot,
 * listas de hábitos) desconectadas del producto "Our School Survival Guide".
 * El validador debe ALERTAR en ese caso (sin bloquear) y NO molestar cuando la
 * secuencia está alineada.
 *
 * Ejecutar: node scripts/test-coherencia-producto.mjs
 */
import { validarCoherenciaProducto, esTemaLateral } from "../src/services/unidadAprendizajeService.js";

let pasos = 0, fallos = 0;
const check = (n, fn) => { try { fn(); pasos += 1; console.log(`  ✓ ${n}`); } catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); } };
const assert = (c, m) => { if (!c) throw new Error(m); };

console.log("Coherencia del producto final (regresión):");

// ── Caso REAL del PDF: "Escuela y educación" deriva a rutinas/hábitos ─────────
const aportesDesalineados = [
  { semana: 1, texto: "Mapa inicial de ideas sobre la unidad para Our School Survival Guide" },
  { semana: 1, texto: "Bosquejo inicial de conceptos high school, seventh grade, freshman" },
  { semana: 2, texto: "Hoja descriptiva del entorno escolar usando high school, seventh grade" },
  { semana: 3, texto: "Habit tracker con descripciones en presente simple y adverbios de frecuencia" },
  { semana: 3, texto: "Routine snapshot visual con texto descriptivo" },
  { semana: 4, texto: "Lista de hábitos diarios con adverbios de frecuencia" },
  { semana: 4, texto: "Lista revisada de hábitos cotidianos y su impacto en la salud" },
];

check("alerta cuando la secuencia deriva a rutinas/hábitos (PDF real)", () => {
  const avisos = validarCoherenciaProducto({
    producto: "Our School Survival Guide — guía bilingüe para orientar dentro del centro educativo",
    temaCentral: "Escuela y educación",
    aportesProducto: aportesDesalineados,
    numSemanas: 5,
  });
  assert(avisos.length > 0, "no emitió ninguna alerta");
  assert(avisos.some((a) => /desalineaci/i.test(a)), `alerta inesperada: ${JSON.stringify(avisos)}`);
});

check("nombra 'Habit tracker' como relleno típico", () => {
  const avisos = validarCoherenciaProducto({
    producto: "Our School Survival Guide",
    temaCentral: "Escuela y educación",
    aportesProducto: [
      { semana: 1, texto: "Mapa de la escuela para Our School Survival Guide" },
      { semana: 3, texto: "Habit tracker con mis rutinas matutinas" },
    ],
    numSemanas: 4,
  });
  assert(avisos.some((a) => /desalineaci/i.test(a)), "no detectó el Habit tracker como relleno");
});

// ── Caso SANO: todas las piezas se vinculan al producto escolar ───────────────
check("NO alerta cuando todas las piezas apuntan al producto", () => {
  const avisos = validarCoherenciaProducto({
    producto: "Our School Survival Guide — guía para orientar en el centro educativo",
    temaCentral: "Escuela y educación",
    aportesProducto: [
      { semana: 1, texto: "Mapa inicial de la escuela para Our School Survival Guide" },
      { semana: 2, texto: "Sección de orientación del centro educativo para la guía escolar" },
      { semana: 3, texto: "Guía de lugares importantes del centro educativo" },
      { semana: 4, texto: "Borrador de la guía escolar con recomendaciones del centro" },
      { semana: 5, texto: "Presentación final de la guía escolar ante estudiantes nuevos" },
    ],
    numSemanas: 5,
  });
  assert(avisos.every((a) => !/desalineaci/i.test(a)), `falsa alerta de desalineación: ${JSON.stringify(avisos)}`);
});

// ── PASO 5: el producto no debe construirse desde cero en la última semana ────
check("alerta si la última semana concentra las piezas nuevas", () => {
  const avisos = validarCoherenciaProducto({
    producto: "Guía escolar del centro educativo",
    temaCentral: "Escuela y educación",
    aportesProducto: [
      { semana: 1, texto: "Idea inicial de la guía escolar del centro" },
      { semana: 5, texto: "Sección 1 de la guía escolar del centro" },
      { semana: 5, texto: "Sección 2 de la guía escolar del centro" },
      { semana: 5, texto: "Sección 3 de la guía escolar del centro" },
    ],
    numSemanas: 5,
  });
  assert(avisos.some((a) => /progresi[oó]n del producto/i.test(a)), `no alertó sobre la progresión: ${JSON.stringify(avisos)}`);
});

check("sin aportes, no alerta (entrada vacía es válida)", () => {
  const avisos = validarCoherenciaProducto({ producto: "X", temaCentral: "Y", aportesProducto: [], numSemanas: 4 });
  assert(avisos.length === 0, "alertó con entrada vacía");
});

// ── PDF v8: los nombres genéricos de la Fase 3 deben disparar la alerta + pista
check("detecta 'Daily Routine Script' / 'Lista personal de hábitos' y da la pista accionable", () => {
  const avisos = validarCoherenciaProducto({
    producto: "Our School Survival Guide — guía bilingüe para orientar estudiantes nuevos",
    temaCentral: "Escuela y educación",
    aportesProducto: [
      { semana: 1, texto: "Mapa de la escuela para Our School Survival Guide" },
      { semana: 2, texto: "Guía de orientación escolar para la guía" },
      { semana: 3, texto: "Daily Routine Script" },
      { semana: 3, texto: "Lista personal de hábitos escolares con adverbios de frecuencia" },
      { semana: 4, texto: "Descripción de una rutina diaria en inglés" },
    ],
    numSemanas: 5,
  });
  assert(avisos.some((a) => /desalineaci/i.test(a)), "no detectó los nombres genéricos de rutina del PDF v8");
  assert(avisos.some((a) => /antes.*durante.*despu[eé]s/i.test(a)), "no dio la pista accionable (antes/durante/después)");
});

// ── esTemaLateral: detecta cuándo el tema de la semana difiere del central ────
// (gobierna el re-enmarque de la pieza del producto en piezaDelDia).
check("esTemaLateral: 'actividades de la vida diaria' ≠ 'Escuela y educación'", () => {
  assert(esTemaLateral("actividades de la vida diaria", "Escuela y educación"), "no lo marcó como lateral");
});
check("esTemaLateral: el mismo tema NO es lateral (sin falso positivo)", () => {
  assert(!esTemaLateral("Escuela y educación", "Escuela y educación"), "falso positivo con el mismo tema");
});
check("esTemaLateral: inclusión (un tema contiene al otro) NO es lateral", () => {
  assert(!esTemaLateral("escuela", "Escuela y educación"), "trató inclusión como lateral");
});
check("esTemaLateral: tolerante a acentos/mayúsculas", () => {
  assert(!esTemaLateral("LENGUA Y COMUNICACION", "lengua y comunicación"), "no normalizó acentos/mayúsculas");
});

// ── R5 — Enseñado ↔ evaluado: cada fase debe tocar ≥1 indicador de la rúbrica ──
const rubricaDemo = [
  "IL-LEI-1-1 — Responde a preguntas sencillas sobre su entorno.",
  "IL-LEI-1-2 — Identifica vocabulario de la casa en textos orales.",
];

check("R5: alerta cuando una fase no trabaja ningún indicador de la rúbrica (huérfana)", () => {
  const avisos = validarCoherenciaProducto({
    producto: "School Survival Guide",
    indicadoresRubrica: rubricaDemo,
    indicadoresPorFase: [
      { numero: 1, nombre: "Exploración", indicadores: ["IL-LEI-1-1 — Responde a preguntas."] },
      { numero: 2, nombre: "Desarrollo", indicadores: ["IL-ZZ-9-9 — Indicador que NO está en la rúbrica."] },
    ],
  });
  assert(avisos.some((a) => /Enseñado ≠ evaluado/.test(a)), `no detectó la fase huérfana: ${JSON.stringify(avisos)}`);
  assert(avisos.some((a) => /"2"/.test(a)), "no nombró la fase 2 como huérfana");
});

check("R5: NO alerta cuando cada fase toca al menos un indicador de la rúbrica", () => {
  const avisos = validarCoherenciaProducto({
    producto: "School Survival Guide",
    indicadoresRubrica: rubricaDemo,
    indicadoresPorFase: [
      { numero: 1, nombre: "Exploración", indicadores: ["IL-LEI-1-1 — Responde."] },
      { numero: 2, nombre: "Desarrollo", indicadores: ["IL-LEI-1-2 — Identifica.", "IL-OTRO-1 — extra."] },
    ],
  });
  assert(!avisos.some((a) => /Enseñado ≠ evaluado/.test(a)), `falsa alerta de enseñado≠evaluado: ${JSON.stringify(avisos)}`);
});

check("R5: compara por CÓDIGO tolerando corchetes/mayúsculas/espacios", () => {
  const avisos = validarCoherenciaProducto({
    producto: "X",
    indicadoresRubrica: ["[IL-LEI-1-1] — Responde."],
    indicadoresPorFase: [{ numero: 1, nombre: "F1", indicadores: ["il-lei-1-1 — misma, otro formato"] }],
  });
  assert(!avisos.some((a) => /Enseñado ≠ evaluado/.test(a)), "no normalizó el código al comparar");
});

check("R5: fase sin indicadores reportados NO se juzga (la cubre otra validación)", () => {
  const avisos = validarCoherenciaProducto({
    producto: "X",
    indicadoresRubrica: rubricaDemo,
    indicadoresPorFase: [{ numero: 1, nombre: "F1", indicadores: [] }],
  });
  assert(!avisos.some((a) => /Enseñado ≠ evaluado/.test(a)), "juzgó una fase sin indicadores");
});

check("R5: compat. hacia atrás — sin indicadoresRubrica/PorFase no corre", () => {
  const avisos = validarCoherenciaProducto({ producto: "X", temaCentral: "Y", aportesProducto: [], numSemanas: 4 });
  assert(!avisos.some((a) => /Enseñado ≠ evaluado/.test(a)), "corrió R5 sin datos (debería ser no-op)");
});

// ── R7 — Honestidad de la transversalidad: no fingir interdisciplina mono-área ─
check("R7: alerta si la situación pretende interdisciplina sin áreas vinculadas", () => {
  const avisos = validarCoherenciaProducto({
    producto: "X",
    textoSituacion: "Una propuesta interdisciplinaria que integra varias áreas del conocimiento.",
    asignaturasVinculadas: [],
  });
  assert(avisos.some((a) => /Transversalidad declarada sin áreas/.test(a)), `no detectó la pretensión: ${JSON.stringify(avisos)}`);
});

check("R7: NO alerta si DE VERDAD hay asignaturas vinculadas declaradas", () => {
  const avisos = validarCoherenciaProducto({
    producto: "X",
    textoSituacion: "Una propuesta interdisciplinaria que integra varias áreas.",
    asignaturasVinculadas: ["Ciencias Sociales", "Lengua Española"],
  });
  assert(!avisos.some((a) => /Transversalidad declarada/.test(a)), `falsa alerta con áreas reales: ${JSON.stringify(avisos)}`);
});

check("R7: NO alerta en unidad mono-área honesta (sin pretender interdisciplina)", () => {
  const avisos = validarCoherenciaProducto({
    producto: "X",
    textoSituacion: "Los estudiantes producen una guía escolar usando el eje transversal de Ciudadanía.",
    asignaturasVinculadas: [],
  });
  assert(!avisos.some((a) => /Transversalidad declarada/.test(a)), `falsa alerta en mono-área honesta: ${JSON.stringify(avisos)}`);
});

check("R7: compat. hacia atrás — sin textoSituacion no corre", () => {
  const avisos = validarCoherenciaProducto({ producto: "X", temaCentral: "Y", aportesProducto: [], numSemanas: 4 });
  assert(!avisos.some((a) => /Transversalidad declarada/.test(a)), "corrió R7 sin datos (debería ser no-op)");
});

console.log(`\nCoherencia del producto: ${pasos} pasos, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
