/**
 * E1 (auditoría 2026-11-27): guardar el grupo académico no se traga el error.
 *
 * Ejecutar:  node scripts/test-grupo-academico-nube.mjs
 *
 * Antes, setDoc(...).catch(() => {}) dejaba al docente creyendo que la lista
 * estaba en la nube. Cubre, con Firestore simulado: si setDoc falla se llama a
 * onErrorNube con el mensaje para el docente (sin detalle técnico), la función
 * no lanza y el grupo queda en localStorage; si setDoc funciona no hay aviso y
 * no se escribe createdAt. Lo que NO cubre: el aviso en pantalla (App.jsx).
 */

import assert from "node:assert/strict";
import { registerHooks } from "node:module";

let pasos = 0, fallos = 0;
const check = async (n, fn) => { try { await fn(); pasos += 1; console.log(`  ✓ ${n}`); } catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); } };

// localStorage en memoria (el servicio guarda ahí la copia local)
const almacen = new Map();
globalThis.localStorage = {
  getItem: (k) => (almacen.has(k) ? almacen.get(k) : null),
  setItem: (k, v) => almacen.set(k, String(v)),
  removeItem: (k) => almacen.delete(k),
};

// Firestore simulado: setDoc falla o escribe según globalThis.__falloSetDoc
const escritos = globalThis.__escritosGrupo = [];
const FIRESTORE = `
  export const doc = (_db, ...p) => ({ r: p.join("/") });
  export const serverTimestamp = () => "ahora";
  export const getDoc = async () => ({ exists: () => false, data: () => ({}) });
  export const setDoc = async (d, v) => {
    if (globalThis.__falloSetDoc) throw globalThis.__falloSetDoc;
    globalThis.__escritosGrupo.push({ ruta: d.r, datos: v });
  };
`;
const FALSOS = { "firebase/firestore": FIRESTORE, "../firebase.js": `export const auth = { currentUser: { uid: "u" } }; export const db = {};` };
registerHooks({
  resolve: (esp, ctx, sig) => (FALSOS[esp] && ctx.parentURL?.endsWith("/gruposAcademicosService.js")
    ? { url: `falso:${esp}`, shortCircuit: true } : sig(esp, ctx)),
  load: (url, ctx, sig) => (url.startsWith("falso:")
    ? { format: "module", source: FALSOS[url.slice(6)], shortCircuit: true } : sig(url, ctx)),
});
const { sincronizarCursoConGrupoAcademico, sincronizarCursosConGruposAcademicos } =
  await import("../src/services/gruposAcademicosService.js");

const curso = (extra = {}) => ({
  id: "c1", nombre: "2do Secundaria A", nivel: "Secundaria", grado: "2do", seccion: "A",
  matriculaOficial: true, estudiantesDetalle: [{ nombre: "Ana Pérez" }, { nombre: "Luis Gómez" }], ...extra,
});

// El servicio escribe el detalle técnico en console.error: se captura para que
// no ensucie la salida y para comprobar que el detalle va ahí y no al docente.
const errorOriginal = console.error;
const errores = [];
console.error = (...a) => errores.push(a);

console.log("\nE1: grupo académico en la nube\n");

await check("si setDoc falla: llama a onErrorNube, no lanza y deja la copia local", async () => {
  globalThis.__falloSetDoc = Object.assign(new Error("Missing or insufficient permissions."), { code: "permission-denied" });
  almacen.clear(); errores.length = 0;
  const avisos = [];
  const res = await sincronizarCursoConGrupoAcademico(curso(), { onErrorNube: (m) => avisos.push(m) });
  assert.equal(avisos.length, 1, "un aviso");
  assert.equal(avisos[0], "No se guardó en la nube la lista de estudiantes de 2do Secundaria A. Quedó en este equipo y se reintentará automáticamente.");
  assert.ok(!avisos[0].includes("permissions"), "sin detalle técnico para el docente");
  assert.ok(errores.some((a) => a.some((x) => x?.code === "permission-denied")), "detalle técnico en console.error");
  assert.equal(res.estudiantesDetalle.length, 2, "el curso sigue con su lista");
  const local = JSON.parse(almacen.get("docenteos_grupos_academicos_v1"));
  assert.equal(Object.values(local)[0].estudiantes.length, 2, "copia local guardada");
});

await check("si setDoc falla sin onErrorNube: tampoco lanza", async () => {
  globalThis.__falloSetDoc = new Error("red caída");
  await sincronizarCursoConGrupoAcademico(curso());
});

await check("lote (carga de la app): un fallo no corta los demás cursos", async () => {
  globalThis.__falloSetDoc = new Error("red caída");
  const avisos = [];
  const res = await sincronizarCursosConGruposAcademicos(
    [curso(), curso({ id: "c2", nombre: "2do Secundaria B", seccion: "B" })],
    { onErrorNube: (m) => avisos.push(m) });
  assert.equal(res.length, 2);
  assert.equal(avisos.length, 2);
});

await check("si setDoc funciona: sin aviso y sin createdAt", async () => {
  globalThis.__falloSetDoc = null;
  escritos.length = 0;
  const avisos = [];
  await sincronizarCursoConGrupoAcademico(curso(), { onErrorNube: (m) => avisos.push(m) });
  assert.equal(avisos.length, 0);
  assert.equal(escritos.length, 1);
  assert.ok(escritos[0].ruta.startsWith("usuarios/u/gruposAcademicos/"));
  assert.ok(!("createdAt" in escritos[0].datos), "createdAt no se reescribe");
  assert.equal(escritos[0].datos.updatedAt, "ahora");
});

console.error = errorOriginal;
console.log(`\n${pasos} pasos, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
