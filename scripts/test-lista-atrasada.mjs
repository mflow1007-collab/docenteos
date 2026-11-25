/**
 * Pase de lista de un día anterior (asistenciaService + Modo Aula).
 *
 * Ejecutar:  node scripts/test-lista-atrasada.mjs
 *
 * Modo Aula guardaba siempre con la fecha de hoy y los días pendientes solo
 * ofrecían «sin docencia». Cubre: el servicio real, con Firestore simulado,
 * guarda en la fecha elegida sin tocar otro día; y la página manda esa fecha.
 * Lo que NO cubre: la pantalla ni la escritura real (se verifican en el navegador).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";

let pasos = 0, fallos = 0;
const check = async (n, fn) => { try { await fn(); pasos += 1; console.log(`  ✓ ${n}`); } catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); } };

// Firestore en memoria: ruta → documento
const docs = globalThis.__docsLista = new Map();
const FIRESTORE = `
  const docs = globalThis.__docsLista;
  const ruta = (p) => p.join("/");
  export const collection = (_db, ...p) => ({ r: ruta(p) });
  export const doc = (base, ...p) => ({ r: base?.r ? ruta([base.r, ...p]) : ruta(p) });
  export const serverTimestamp = () => "ahora";
  export const getDoc = async (d) => ({ exists: () => docs.has(d.r), data: () => docs.get(d.r) });
  export const getDocs = async (c) => ({ docs: [...docs].filter(([k]) => k.startsWith(c.r + "/") && !k.slice(c.r.length + 1).includes("/"))
    .map(([k, v]) => ({ id: k.slice(c.r.length + 1), data: () => v })) });
  export const setDoc = async (d, v) => { const a = docs.get(d.r) || {}; docs.set(d.r, { ...a, ...v, ...(v.marcas ? { marcas: { ...a.marcas, ...v.marcas } } : {}) }); };
  export const updateDoc = async (d, v) => { docs.set(d.r, { ...docs.get(d.r), ...v }); };
`;
const FALSOS = { "firebase/firestore": FIRESTORE, "../firebase.js": `export const auth = { currentUser: { uid: "u" } }; export const db = {};` };
registerHooks({
  resolve: (esp, ctx, sig) => (FALSOS[esp] && ctx.parentURL?.endsWith("/asistenciaService.js")
    ? { url: `falso:${esp}`, shortCircuit: true } : sig(esp, ctx)),
  load: (url, ctx, sig) => (url.startsWith("falso:")
    ? { format: "module", source: FALSOS[url.slice(6)], shortCircuit: true } : sig(url, ctx)),
});
const { guardarPaseLista, hoyISO } = await import("../src/services/asistenciaService.js");
const { diasDocenciaPrevios } = await import("../src/data/calendarioEscolarMINERD.js");

const dia = (f) => docs.get(`usuarios/u/cursos/c1/asistencia/${f}`);
console.log("\nPase de lista de un día anterior\n");

await check("se guarda en el día elegido, no en el de hoy", async () => {
  docs.set("usuarios/u/estudiantes/e1", { nombre: "Uno", notas: 90 });
  const r = await guardarPaseLista({ cursoId: "c1", fecha: "2026-11-24", marcas: { e1: "presente", e2: "ausente" } });
  assert.equal(r.fecha, "2026-11-24");
  assert.deepEqual(dia("2026-11-24").marcas, { e1: "presente", e2: "ausente" });
  assert.equal(dia(hoyISO() === "2026-11-24" ? "x" : hoyISO()), undefined, "hoy no se toca");
});

await check("dos días distintos no se mezclan y el porcentaje los cuenta a los dos", async () => {
  await guardarPaseLista({ cursoId: "c1", fecha: "2026-11-23", marcas: { e1: "ausente" } });
  assert.deepEqual(dia("2026-11-23").marcas, { e1: "ausente" });
  assert.deepEqual(dia("2026-11-24").marcas, { e1: "presente", e2: "ausente" }, "el 24 queda igual");
  assert.deepEqual(docs.get("usuarios/u/estudiantes/e1"), { nombre: "Uno", notas: 90, asistencia: 50, updatedAt: "ahora" });
});

await check("el día guardado deja de estar pendiente", () => {
  const pendientes = diasDocenciaPrevios("2026-11-25", 7).filter((f) => !dia(f));
  assert.deepEqual(pendientes, ["2026-11-20", "2026-11-19", "2026-11-18", "2026-11-17", "2026-11-16"]);
});

const pagina = readFileSync(new URL("../src/pages/ModoAulaPage.jsx", import.meta.url), "utf8");
await check("Modo Aula manda la fecha elegida y ofrece «Pasar lista» en cada día pendiente", () => {
  assert.match(pagina, /const fecha = fechaAtrasada \|\| hoyISO\(\)/);
  assert.match(pagina, /guardarPaseLista\(\{ cursoId: cursoParaAula\.id, fecha, marcas: marcasLista \}\)/);
  assert.match(pagina, /onClick=\{\(\) => abrirListaAtrasada\(f\)\}/);
});

console.log(`\n${pasos} ok, ${fallos} fallos\n`);
if (fallos) process.exit(1);
