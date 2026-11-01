/**
 * Prueba de la identidad única del estudiante (src/utils/idEstudiante.js).
 *
 * Ejecutar:  node scripts/test-id-estudiante.mjs
 */

import assert from "node:assert/strict";
import {
  avisoCedula,
  conIdsEstudiantes,
  formatearCedula,
  idEstudiante,
  idsLegadoEstudiante,
  slugEstudiante,
} from "../src/utils/idEstudiante.js";

// 1. El id real manda; sin id, la regla del Registro de calificaciones
assert.equal(idEstudiante({ id: "est-123", nombre: "Ana García" }, 0), "est-123");
assert.equal(idEstudiante({ id: 7, nombre: "Ana" }, 0), "7");
assert.equal(idEstudiante({ nombre: "Ana García" }, 0), "est-ana-garcia-0");
assert.equal(idEstudiante({ nombre: "José  Núñez" }, 3), "est-jose-nunez-3");
assert.equal(idEstudiante("Pedro Díaz", 2), "est-pedro-diaz-2");
assert.equal(slugEstudiante("", 1), "est-sin-nombre-1");
console.log("✓ id real primero; sin id, est-{nombre}-{posición}");

// 2. IDs viejos para leer datos guardados antes de la regla única
const legado = idsLegadoEstudiante({ nombre: "Ana García" }, 0, { cursoId: "curso-1" });
assert.deepEqual(legado, ["curso-1-0-Ana García", "est-1", "est-0", "0-Ana García"]);
assert.deepEqual(idsLegadoEstudiante({ id: "est-9", nombre: "Ana" }, 4, { cursoId: "c" }), ["c-4-Ana"]);
assert.ok(!legado.includes(idEstudiante({ nombre: "Ana García" }, 0)));
// Tras fijar el ID permanente (conIdsEstudiantes), los IDs viejos se siguen leyendo
assert.deepEqual(
  idsLegadoEstudiante({ id: "est-ana-garcia-0", nombre: "Ana García" }, 0, { cursoId: "curso-1" }),
  legado
);
console.log("✓ IDs viejos de cada módulo, sin repetir el actual");

// 3. Al guardar el curso, el ID queda fijo en quien no lo tenía (sin tocar a los demás)
const curso = { id: "c", estudiantesDetalle: [{ id: "est-1", nombre: "Ana" }, { nombre: "Luis Pérez", cedula: "" }] };
const fijado = conIdsEstudiantes(curso);
assert.deepEqual(fijado.estudiantesDetalle.map((e) => e.id), ["est-1", "est-luis-perez-1"]);
assert.equal(fijado.estudiantesDetalle[1].cedula, "");
assert.equal(conIdsEstudiantes(fijado), fijado, "si todos tienen id, devuelve el mismo objeto");
assert.equal(conIdsEstudiantes({ id: "x" }).id, "x");
console.log("✓ conIdsEstudiantes fija el ID permanente sin pisar datos");

// 4. Cédula opcional: solo avisa, nunca bloquea
assert.equal(avisoCedula(""), "");
assert.equal(avisoCedula("001-1234567-8"), "");
assert.match(avisoCedula("12345"), /11 dígitos/);
assert.equal(formatearCedula("00112345678"), "001-1234567-8");
assert.equal(formatearCedula("12345"), "12345");
console.log("✓ cédula opcional: aviso si no tiene 11 dígitos, formato 000-0000000-0");

console.log("\nID de estudiante: 4/4 pruebas en verde");
