/**
 * test-producto-fantasma.mjs — FASE 5 · Frente 1.
 *
 * El motor a veces nombra la pieza de una clase con un NOMBRE PROPIO suelto
 * ("Welcome Routine", "My School Exchange") que suena a entregable independiente.
 * subordinarAporteAlProducto lo reescribe como "Sección «X» de <producto>" para
 * que quede claro que es una sección del ÚNICO producto (Referente pág. 39).
 * Casos tomados del PDF real "Escuela y educación" que evaluó el revisor.
 *
 * Ejecutar: node scripts/test-producto-fantasma.mjs
 */
import { subordinarAporteAlProducto } from "../src/services/phaseAService.js";

let pasos = 0, fallos = 0;
const check = (n, fn) => { try { fn(); pasos += 1; console.log(`  ✓ ${n}`); } catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); } };
const assert = (c, m) => { if (!c) throw new Error(m); };

const PRODUCTO = "Our School Survival Guide — guía bilingüe para orientar a estudiantes nuevos";

console.log("FASE 5 · Frente 1 — subordinar productos-fantasma al producto:");

// ── Nombres-producto sueltos del PDF real → se subordinan ─────────────────────
check("'Welcome Routine' → Sección «Welcome Routine» de Our School Survival Guide", () => {
  const r = subordinarAporteAlProducto("Welcome Routine", PRODUCTO);
  assert(/^Sección «Welcome Routine» de Our School Survival Guide$/.test(r), `obtuvo: ${r}`);
});

check("'My School Exchange' se subordina", () => {
  const r = subordinarAporteAlProducto("My School Exchange", PRODUCTO);
  assert(/Sección «My School Exchange» de Our School Survival Guide/.test(r), `obtuvo: ${r}`);
});

check("'School Entry Map' se subordina (sustantivo Map)", () => {
  const r = subordinarAporteAlProducto("School Entry Map", PRODUCTO);
  assert(/Sección «School Entry Map» de/.test(r), `obtuvo: ${r}`);
});

check("nombre con comillas simples se subordina sin comillas colgando", () => {
  const r = subordinarAporteAlProducto("'Welcome Note'", PRODUCTO);
  assert(/Sección «Welcome Note» de/.test(r), `obtuvo: ${r}`);
  assert(!/«'|'»/.test(r), `comillas mal limpiadas: ${r}`);
});

// ── Descripciones NEUTRAS → se dejan igual (no son fantasmas) ─────────────────
check("descripción neutra 'mapa inicial de ideas…' NO se toca", () => {
  const a = "mapa inicial de ideas sobre la unidad";
  assert(subordinarAporteAlProducto(a, PRODUCTO) === a, "reescribió una descripción neutra");
});

check("'borrador de la sección Bienvenida' NO se re-subordina (ya dice sección)", () => {
  const a = "Borrador de sección 'Bienvenida a la escuela'";
  assert(subordinarAporteAlProducto(a, PRODUCTO) === a, "duplicó subordinación");
});

check("aporte que YA menciona el producto NO se toca", () => {
  const a = "Guion de presentación para Our School Survival Guide";
  assert(subordinarAporteAlProducto(a, PRODUCTO) === a, "reescribió un aporte ya vinculado");
});

// ── Robustez ──────────────────────────────────────────────────────────────────
check("sin producto declarado → devuelve el aporte igual", () => {
  assert(subordinarAporteAlProducto("Welcome Routine", "") === "Welcome Routine", "falló sin producto");
});

check("aporte vacío → cadena vacía", () => {
  assert(subordinarAporteAlProducto("", PRODUCTO) === "", "falló con aporte vacío");
});

check("usa el nombre CORTO del producto (antes del —)", () => {
  const r = subordinarAporteAlProducto("Daily Routine Section", PRODUCTO);
  assert(/de Our School Survival Guide$/.test(r), `no usó el nombre corto: ${r}`);
  assert(!/guía bilingüe/.test(r), `incluyó el nombre largo: ${r}`);
});

console.log(`\nProducto-fantasma: ${pasos} pasos, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
