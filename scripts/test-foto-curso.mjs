/**
 * Foto de la lista al crear el curso: un solo lector, mismos IDs en el curso y
 * en el registro de cada estudiante, y aviso si el registro falla.
 *
 * Ejecutar:  node scripts/test-foto-curso.mjs
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { enriquecerCursoInicial } from "../src/utils/cursoUtils.js";
import { conIdsEstudiantes } from "../src/utils/idEstudiante.js";
import { agregarNombresAlCurso, revisarListaEstudiantes } from "../src/utils/listaEstudiantes.js";
import { guardarNuevosConAviso } from "../src/utils/guardarNuevosConAviso.js";

const base = { id: "curso-1", nombre: "1ro Secundaria A", nivel: "Secundaria", seccion: "A", estudiantes: 12, estudiantesDetalle: [], estudiantesFuente: "", matriculaOficial: false };
const fuente = (ruta) => readFileSync(new URL(`../src/${ruta}`, import.meta.url), "utf8");
const errorOriginal = console.error;

// 1. Curso con lista: nace completo, oficial y con los mismos IDs que su registro
const { curso, nuevos } = agregarNombresAlCurso(base, ["Yokasta Peralta", " Wilkin Then "]);
const final = conIdsEstudiantes(enriquecerCursoInicial(curso));
assert.deepEqual(final.estudiantesDetalle.map((e) => e.nombre), ["Yokasta Peralta", "Wilkin Then"]);
assert.equal(final.estudiantes, 2, "la cantidad sale de la lista");
assert.equal(revisarListaEstudiantes(final).estado, "real");
const guardados = [];
let preguntas = [];
const sinGuardar = await guardarNuevosConAviso(final.id, nuevos, async (cursoId, nombre, id) => { guardados.push({ cursoId, nombre, id }); }, (m) => { preguntas.push(m); return false; });
assert.deepEqual(guardados.map((g) => g.id), final.estudiantesDetalle.map((e) => e.id));
assert.ok(guardados.every((g) => g.cursoId === "curso-1"));
assert.deepEqual([sinGuardar, preguntas], [[], []], "si todo va bien no pregunta nada");
console.log("✓ curso con lista: mismos IDs en el curso y en el registro");

// 2. Curso sin lista: igual que antes
assert.deepEqual(enriquecerCursoInicial(base).estudiantesDetalle, []);
assert.equal(enriquecerCursoInicial(base).estudiantes, 12);
assert.deepEqual(await guardarNuevosConAviso("curso-1", [], () => { throw new Error("no debe llamarse"); }), []);
console.log("✓ curso sin lista: no cambia y no guarda a nadie");

// 3. Falla uno: se avisa con la cuenta y el reintento repite solo ese, con su ID
console.error = () => {};
let intentos = [];
preguntas = [];
const falla1vez = async (_c, nombre, id) => {
  intentos.push(id);
  if (nombre === "Wilkin Then" && intentos.filter((x) => x === id).length === 1) throw new Error("sin red");
};
assert.deepEqual(await guardarNuevosConAviso("curso-1", nuevos, falla1vez, (m) => { preguntas.push(m); return true; }), []);
assert.equal(preguntas.length, 1);
assert.match(preguntas[0], /1 de 2 estudiantes/);
assert.deepEqual(intentos, [nuevos[0].id, nuevos[1].id, nuevos[1].id]);
console.log("✓ fallo parcial: avisa y reintenta solo el que falta");

// 4. El docente no reintenta: se devuelven los pendientes, sin bucle
assert.deepEqual(await guardarNuevosConAviso("curso-1", nuevos, async () => { throw new Error("sin red"); }, () => false), nuevos);
console.error = errorOriginal;
console.log("✓ sin reintento: devuelve los pendientes");

// 5. Un solo lector: nadie más llama a la IA de visión, y ambos lo usan
for (const ruta of ["pages/EstudiantesPage.jsx", "components/Cursos.jsx"]) {
  assert.match(fuente(ruta), /<LectorFotoLista /, ruta);
  assert.match(fuente(ruta), /guardarNuevosConAviso\(/, ruta);
  assert.doesNotMatch(fuente(ruta), /vision-estudiantes/, ruta);
}
assert.match(fuente("components/LectorFotoLista.jsx"), /vision-estudiantes/);
console.log("✓ un solo lector de fotos");

console.log("\nFoto al crear curso: todo en orden");
