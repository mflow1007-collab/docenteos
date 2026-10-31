/**
 * F1 — Plan ↔ curso: puntuación con la que un plan guardado se ata a su curso
 * (src/services/hiloPedagogico.js → puntuarCursoParaPlan).
 *
 * Ejecutar:  node scripts/test-plan-curso.mjs
 *
 * Lo que NO cubre: la escritura en Firestore (vincularPlanificacionACurso) ni
 * la pantalla de Modo Aula; se comprueban en el navegador.
 */

import assert from "node:assert/strict";
import { puntuarCursoParaPlan, UMBRAL_CURSO_PLAN } from "../src/services/hiloPedagogico.js";

// Datos reales de la cuenta de César (2026-10-30): el curso no trae `grado`,
// el grado va en el nombre.
const curso2doA = { id: "curso-1785775747248", nombre: "2do Secundaria A", area: "Inglés", seccion: "A" };
const meta2doA = { grado: "2do Secundaria", seccion: "A", area: "Lenguas Extranjeras", asignatura: "Inglés" };
const meta1roB = { grado: "1ro Secundaria", seccion: "B", area: "Lenguas Extranjeras", asignatura: "Inglés" };

// 1. El plan de 2do A encaja con el curso 2do A
assert.equal(puntuarCursoParaPlan(meta2doA, curso2doA), 11);
assert.ok(puntuarCursoParaPlan(meta2doA, curso2doA) >= UMBRAL_CURSO_PLAN);
console.log("✓ el plan de 2do A se ata al curso 2do A (grado + asignatura + sección)");

// 2. El plan de 1ro B NO se ata al curso 2do A (antes Modo Aula lo mostraba)
assert.ok(puntuarCursoParaPlan(meta1roB, curso2doA) < UMBRAL_CURSO_PLAN);
console.log("✓ el plan de 1ro B no se ata al curso 2do A");

// 2b. Misma asignatura y misma sección, otro grado: tampoco (antes 5 + 2 = 7 bastaba)
assert.ok(puntuarCursoParaPlan({ ...meta1roB, seccion: "A" }, curso2doA) < UMBRAL_CURSO_PLAN);
console.log("✓ el plan de 1ro A no se ata al curso 2do A aunque coincida la sección");

// 3. Otra sección del mismo grado y asignatura sí encaja (comparten cupo y plan)
assert.ok(puntuarCursoParaPlan({ ...meta2doA, seccion: "B" }, curso2doA) >= UMBRAL_CURSO_PLAN);
console.log("✓ otra sección del mismo grado y asignatura encaja");

// 4. Mismo grado, otra asignatura: no se ata
assert.ok(puntuarCursoParaPlan({ ...meta2doA, asignatura: "Matemática", area: "Matemática" }, curso2doA) < UMBRAL_CURSO_PLAN);
assert.equal(puntuarCursoParaPlan({}, curso2doA), 0);
console.log("✓ otra asignatura o metadatos vacíos no se atan");

console.log("\nPlan ↔ curso: 5/5 pruebas en verde");
