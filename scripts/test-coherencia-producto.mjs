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
import { validarCoherenciaProducto } from "../src/services/unidadAprendizajeService.js";

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

console.log(`\nCoherencia del producto: ${pasos} pasos, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
