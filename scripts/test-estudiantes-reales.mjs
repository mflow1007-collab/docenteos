/**
 * Etapa 1 — la app no inventa estudiantes y avisa de los que ya están guardados.
 *
 * Ejecutar:  node scripts/test-estudiantes-reales.mjs
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { aplicarRegistroACurso, enriquecerCursoInicial } from "../src/utils/cursoUtils.js";
import { agregarNombresAlCurso, nombresDeEjemplo, revisarListaEstudiantes } from "../src/utils/listaEstudiantes.js";

// 1. Sin lista no se crea nadie, aunque el curso diga cuántos son
for (const curso of [
  { id: "c1", nivel: "Secundaria", estudiantes: 30, promedio: 82 },
  { id: "c2", nivel: "Secundaria", estudiantes: 2, estudiantesDetalle: [] },
  { id: "c3", nivel: "Primaria" },
]) {
  assert.deepEqual(enriquecerCursoInicial(curso).estudiantesDetalle, []);
  const conRegistro = aplicarRegistroACurso(curso, { notasEstudiantes: {} });
  assert.deepEqual(conRegistro.estudiantesDetalle, []);
  assert.equal(conRegistro.estudiantes, curso.estudiantes, "la cantidad declarada se conserva");
}
console.log("✓ sin lista no se inventan estudiantes");

// 2. La lista real pasa intacta (mismos objetos, sin promedios añadidos)
const real = [{ id: "e1", nombre: "Yokasta Peralta" }, { id: "e2", nombre: "Wilkin Then", promedio: null }];
assert.deepEqual(enriquecerCursoInicial({ id: "c4", nivel: "Secundaria", estudiantesDetalle: real }).estudiantesDetalle, real);
assert.deepEqual(revisarListaEstudiantes({ estudiantesDetalle: real }), { estado: "real", ejemplos: [], mensaje: "" });
console.log("✓ la lista real no cambia ni da aviso");

// 3. Se detectan las listas de los dos generadores retirados
const perfil = ["María García", "Juan Pérez", "Carmen López", "José Rodríguez"].map((nombre) => ({ nombre }));
const cursos = ["Ana García", "Carlos Pérez", "María López"].map((nombre) => ({ nombre, promedio: 82 }));
assert.equal(revisarListaEstudiantes({ estudiantesDetalle: perfil }).estado, "ejemplo");
assert.equal(revisarListaEstudiantes({ estudiantesDetalle: cursos }).estado, "ejemplo");
assert.equal(revisarListaEstudiantes({ estudiantesDetalle: [{ nombre: "Ana García" }], estudiantesFuente: "demo" }).estado, "ejemplo");
console.log("✓ listas de ejemplo detectadas");

// 4. Mezcla marcada «oficial»: también se avisa, y con la cuenta correcta
const mezcla = revisarListaEstudiantes({ estudiantesDetalle: [...perfil, ...real], estudiantesFuente: "oficial", matriculaOficial: true });
assert.equal(mezcla.estado, "mezclada");
assert.deepEqual(mezcla.ejemplos, perfil.map((e) => e.nombre));
assert.match(mezcla.mensaje, /4 estudiantes de ejemplo/);
console.log("✓ lista mezclada detectada aunque diga oficial");

// 5. Un nombre común no acusa a un estudiante real
assert.deepEqual(nombresDeEjemplo([{ nombre: "Ana García" }, { nombre: "Yokasta Peralta" }, { nombre: "Wilkin Then" }]), []);
assert.deepEqual(nombresDeEjemplo([{ nombre: "Luis Santos" }, { nombre: "Ana García" }, { nombre: "Rosa Reyes" }, { nombre: "Pedro Díaz" }]), [], "fuera de posición no cuenta");
console.log("✓ nombres comunes sin falso aviso");

// 6. Revisar nunca modifica el curso (no se borra nada)
const guardado = { id: "c5", estudiantesFuente: "demo", estudiantesDetalle: perfil.map((e) => ({ ...e })) };
const antes = JSON.stringify(guardado);
revisarListaEstudiantes(guardado);
enriquecerCursoInicial(guardado);
assert.equal(JSON.stringify(guardado), antes);
assert.equal(enriquecerCursoInicial(guardado).estudiantesDetalle.length, perfil.length, "los ya guardados se conservan");
console.log("✓ lo guardado se conserva");

// 7. Vacía, nula o rara: aviso, nunca excepción
for (const curso of [undefined, null, {}, { estudiantesDetalle: null }, { estudiantesDetalle: [] }]) {
  assert.equal(revisarListaEstudiantes(curso || undefined).estado, "vacia");
}
assert.equal(revisarListaEstudiantes({ estudiantesDetalle: [null, "Pedro", {}] }).estado, "real");
console.log("✓ entradas vacías o raras");

// 8. Ningún archivo vuelve a traer un generador o una lista de respaldo
const archivos = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((f) =>
  f.isDirectory() ? archivos(`${dir}/${f.name}`) : /\.(js|jsx)$/.test(f.name) ? [`${dir}/${f.name}`] : []);
for (const archivo of archivos(new URL("../src", import.meta.url).pathname)) {
  assert.doesNotMatch(readFileSync(archivo, "utf8"),
    /generarEstudiantes(Detalle|Ejemplo)|ESTUDIANTES_FALLBACK|estudiantesFallback|NOMBRES_(DEMO|EJEMPLO)/, archivo);
}
console.log("✓ sin generadores en src");
// 9. Lista pegada y foto: los nombres quedan en el curso, con ID y sin perder a nadie
const cursoFoto = { id: "c6", nombre: "2do A", estudiantes: 2, estudiantesDetalle: real };
const { curso: conFoto, nuevos } = agregarNombresAlCurso(cursoFoto, ["Yudelka Mota", "  Starlin Féliz ", "", null]);
assert.deepEqual(conFoto.estudiantesDetalle.map((e) => e.nombre), ["Yokasta Peralta", "Wilkin Then", "Yudelka Mota", "Starlin Féliz"]);
assert.equal(conFoto.estudiantes, 4);
assert.equal(conFoto.estudiantesFuente, "oficial");
assert.deepEqual(conFoto.estudiantesDetalle.slice(2), nuevos, "el curso y la subcolección reciben el mismo ID");
assert.equal(new Set(conFoto.estudiantesDetalle.map((e) => e.id)).size, 4);
assert.equal(cursoFoto.estudiantesDetalle.length, 2, "no modifica el curso original");
assert.equal(agregarNombresAlCurso({ id: "c7" }, ["Ana"]).curso.estudiantesDetalle.length, 1);
const pagina = readFileSync(new URL("../src/pages/EstudiantesPage.jsx", import.meta.url), "utf8");
const foto = pagina.slice(pagina.indexOf("const confirmarNombresFoto"), pagina.indexOf("const confirmarNombresLista"));
assert.match(foto, /guardarNombresEnCurso\(/);
assert.doesNotMatch(foto, /setEstudiantesExtra/, "la foto no puede quedarse solo en pantalla");
console.log("✓ foto y lista pegada se guardan en el curso");

console.log("\nEstudiantes reales: todo en orden");
