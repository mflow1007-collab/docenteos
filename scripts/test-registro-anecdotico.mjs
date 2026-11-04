/**
 * Prueba del núcleo puro del Registro anecdótico (src/utils/registroAnecdotico.js).
 *
 * Ejecutar:  node scripts/test-registro-anecdotico.mjs
 *
 * Lo que NO cubre: el guardado en Firestore (usa guardarEvidenciaEstudiante, ya existente).
 */

import assert from "node:assert/strict";
import {
  TIPO_REGISTRO_ANECDOTICO,
  construirAnotacion,
  esRegistroAnecdotico,
  fechaHoyISO,
  ordenarAnotaciones,
  validarAnotacion,
} from "../src/utils/registroAnecdotico.js";

const base = {
  estudianteId: "est-7",
  estudianteNombre: "Ana Pérez",
  cursoId: "curso-2do-A",
  fecha: "2026-10-30",
  contexto: "  Clase de Inglés, trabajo en parejas ",
  hecho: " Ayudó a su compañero a corregir el diálogo. ",
  interpretacion: "Muestra liderazgo en el trabajo colaborativo.",
  accion: "Proponerla como monitora en la próxima actividad.",
  compromisos: "",
};

// 1. Construye la evidencia con tipo, campos limpios y sin indicadores
const ahora = new Date("2026-10-30T15:00:00Z");
const anotacion = construirAnotacion(base, { ahora });
assert.equal(anotacion.tipo, TIPO_REGISTRO_ANECDOTICO);
assert.equal(anotacion.evidenciaId, `anec-est-7-${ahora.getTime()}`);
assert.equal(anotacion.id, anotacion.evidenciaId);
assert.equal(anotacion.contexto, "Clase de Inglés, trabajo en parejas");
assert.equal(anotacion.hecho, "Ayudó a su compañero a corregir el diálogo.");
assert.equal(anotacion.texto, anotacion.hecho);
assert.equal(anotacion.compromisos, "");
assert.equal(anotacion.origen, "ficha_estudiante");
assert.deepEqual(anotacion.indicadorIds, []);
assert.ok(esRegistroAnecdotico(anotacion));
assert.ok(!esRegistroAnecdotico({ tipo: "Observación" }));
console.log("✓ construye la anotación como evidencia registro_anecdotico");

// 2. Falla con error visible si falta el hecho, el estudiante, el curso o la fecha
assert.deepEqual(validarAnotacion(base), []);
assert.throws(() => construirAnotacion({ ...base, hecho: "   " }), /hecho observado/);
assert.throws(() => construirAnotacion({ ...base, cursoId: "" }), /curso/);
assert.throws(() => construirAnotacion({ ...base, estudianteId: "" }), /estudiante/);
assert.throws(() => construirAnotacion({ ...base, fecha: "30/10/2026" }), /fecha/);
console.log("✓ falla de forma visible sin hecho, estudiante, curso o fecha");

// 3. Orden: la más reciente primero
const ordenadas = ordenarAnotaciones([
  { fecha: "2026-09-01", creadoEn: "a" },
  { fecha: "2026-10-30", creadoEn: "1" },
  { fecha: "2026-10-30", creadoEn: "2" },
]);
assert.deepEqual(ordenadas.map((a) => `${a.fecha}/${a.creadoEn}`), ["2026-10-30/2", "2026-10-30/1", "2026-09-01/a"]);
console.log("✓ ordena de la más reciente a la más antigua");

// 4. Fecha de hoy en formato local AAAA-MM-DD
assert.equal(fechaHoyISO(new Date(2026, 0, 5)), "2026-01-05");
console.log("✓ fecha de hoy en AAAA-MM-DD");

console.log("\nRegistro anecdótico: 4/4 pruebas en verde");
