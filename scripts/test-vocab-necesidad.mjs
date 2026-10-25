/**
 * test-vocab-necesidad.mjs — FASE 5 · Frente 2.
 *
 * El vocabulario debe salir de la NECESIDAD del producto, no del tema en
 * abstracto. priorizarYEnriquecerVocabulario reordena el vocab de la malla
 * (afín al producto primero) y lo enriquece con un banco curado por campo
 * semántico, SIEMPRE con coherencia temática (nunca salta de tema).
 * La malla es el piso, no el techo (directriz del dueño 2026-10-21).
 *
 * Ejecutar: node scripts/test-vocab-necesidad.mjs
 */
import { priorizarYEnriquecerVocabulario } from "../src/services/phaseAService.js";

let pasos = 0, fallos = 0;
const check = (n, fn) => { try { fn(); pasos += 1; console.log(`  ✓ ${n}`); } catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); } };
const assert = (c, m) => { if (!c) throw new Error(m); };

// Vocab REAL de la malla 2do Inglés, tema "Escuela y educación" (orden de malla:
// Educación primero, orientación/interacción después — el bug que arreglamos).
const VOCAB_ESCUELA = [
  "Educación: high school, seventh grade, freshman …",
  "Asignaturas: English, geography, math, PE…",
  "Lugares: park, fire station, hospital, library, cafeteria…",
  "Formas de interacción: texting, voice calls, chat…",
  "Números cardinales: one, two…",
];

console.log("FASE 5 · Frente 2 — vocab desde la necesidad del producto:");

// ── Caso real del PDF: guía de orientación escolar ────────────────────────────
const prioriEscuela = priorizarYEnriquecerVocabulario({
  vocabMalla: VOCAB_ESCUELA,
  producto: "Our School Survival Guide — guía bilingüe para orientar a estudiantes nuevos",
  tema: "Escuela y educación",
});

check("el vocab de ORIENTACIÓN (Lugares) sube ANTES que 'Educación: freshman'", () => {
  const iLugares = prioriEscuela.findIndex((v) => /Lugares/.test(v));
  const iEducacion = prioriEscuela.findIndex((v) => /Educación: high school/.test(v));
  assert(iLugares !== -1, "perdió el bloque Lugares");
  assert(iLugares < iEducacion, `Lugares (${iLugares}) no quedó antes que Educación (${iEducacion})`);
});

check("ENRIQUECE con vocab de orientación que la malla NO trae (Where is…?)", () => {
  assert(prioriEscuela.some((v) => /Where is/i.test(v)), "no añadió 'Where is…?'");
  assert(prioriEscuela.some((v) => /help me|Could you/i.test(v)), "no añadió fórmulas de ayuda");
});

check("NO pierde nada de la malla (todo el vocab original sigue presente)", () => {
  for (const v of VOCAB_ESCUELA) {
    assert(prioriEscuela.includes(v), `perdió de la malla: ${v}`);
  }
});

check("respeta el límite (no explota con el enriquecimiento)", () => {
  const r = priorizarYEnriquecerVocabulario({ vocabMalla: VOCAB_ESCUELA, producto: "survival guide", tema: "escuela", limite: 6 });
  assert(r.length <= 6, `excedió el límite: ${r.length}`);
});

// ── COHERENCIA (línea roja): sin campo claro NO toca, no inventa ───────────────
check("tema sin campo semántico claro → devuelve la malla tal cual (no enriquece)", () => {
  const vocabMate = ["Números primos", "Fracciones", "Teorema de Pitágoras"];
  const r = priorizarYEnriquecerVocabulario({ vocabMalla: vocabMate, producto: "Informe estadístico", tema: "Estadística" });
  assert(r.length === vocabMate.length, "añadió vocab a un tema sin campo activo");
  assert(r.every((v) => vocabMate.includes(v)), "metió vocab ajeno a Matemática");
});

check("producto de orientación NO contamina un tema de rutinas con vocab de lugares", () => {
  // El campo 'rutina_habitos' se activa, no el de orientación.
  const r = priorizarYEnriquecerVocabulario({
    vocabMalla: ["Verbos: wake up, eat, sleep"],
    producto: "Poster de mi rutina diaria",
    tema: "Actividades de la vida diaria",
  });
  assert(r.some((v) => /frecuencia|always|usually/i.test(v)), "no activó el campo rutina");
  assert(!r.some((v) => /Where is the library/i.test(v)), "contaminó rutina con vocab de orientación");
});

// ── Robustez ──────────────────────────────────────────────────────────────────
check("sin producto ni tema → devuelve la malla sin tocar", () => {
  const r = priorizarYEnriquecerVocabulario({ vocabMalla: VOCAB_ESCUELA, producto: "", tema: "" });
  assert(r.length === VOCAB_ESCUELA.length && r[0] === VOCAB_ESCUELA[0], "alteró sin señal");
});

check("malla vacía → lista vacía (no rompe)", () => {
  const r = priorizarYEnriquecerVocabulario({ vocabMalla: [], producto: "survival guide", tema: "escuela" });
  assert(Array.isArray(r) && r.length === 0, "no devolvió lista vacía");
});

console.log(`\nVocab desde la necesidad: ${pasos} pasos, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
