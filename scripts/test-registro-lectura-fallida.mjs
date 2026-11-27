/**
 * E2f (auditoría 2026-11-27): si falla la lectura del registro, no se escribe.
 *
 * Ejecutar:  node scripts/test-registro-lectura-fallida.mjs
 *
 * Antes, sincronizarEvaluacionPedagogica hacía
 * obtenerRegistroCalificaciones(...).catch(() => ({ data: null })) y seguía con
 * un registro vacío: guardarRegistroCalificaciones (merge) escribía
 * asistencia: [] y observaciones: {} y borraba las del curso. Cubre, con el
 * registro en memoria: lectura fallida (rutas F7 y legacy) → no se llama a
 * guardarRegistroCalificaciones, nada se escribe y fallosNube = ["registro"];
 * curso sin registro (mode "local") → sí se escribe. Lo que NO cubre:
 * Firestore real ni la carrera Registro/Modo Aula (E2g).
 */

import assert from "node:assert/strict";
import { registerHooks } from "node:module";

let pasos = 0, fallos = 0;
const check = async (n, fn) => { try { await fn(); pasos += 1; console.log(`  ✓ ${n}`); } catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); } };

const almacen = new Map();
globalThis.localStorage = { getItem: (k) => almacen.get(k) ?? null, setItem: (k, v) => almacen.set(k, String(v)), removeItem: (k) => almacen.delete(k) };

// Registro en memoria + espías de todas las escrituras
globalThis.__registro = null;          // documento del registro del curso
globalThis.__lecturaRegistro = "ok";   // "ok" | "falla" | "sin-documento"
globalThis.__llamadas = [];
globalThis.__store = new Map();
const FIRESTORE = `
  const store = globalThis.__store;
  export const doc = (_db, ...p) => ({ r: p.join("/"), id: p[p.length - 1] });
  export const serverTimestamp = () => "ahora";
  export const getDoc = async (d) => { const v = store.get(d.r); return { exists: () => Boolean(v), data: () => v }; };
  export const setDoc = async (d, v) => { globalThis.__llamadas.push("setDoc:" + d.r); store.set(d.r, v); };
  export const runTransaction = async (_db, fn) => {
    const sets = [];
    const r = await fn({ get: (d) => getDoc(d), set: (d, v) => { sets.push([d, v]); } });
    for (const [d, v] of sets) await setDoc(d, v);
    return r;
  };
`;
const FIREBASE = `
  export const auth = { currentUser: { uid: "u" } };
  export const db = {};
  const espia = (n) => async () => { globalThis.__llamadas.push(n); return {}; };
  export const crearAspectoIdDesdeInstrumento = () => "a1";
  export const guardarEvidenciaEstudiante = espia("guardarEvidenciaEstudiante");
  export const guardarRegistroAspectoDesdeInstrumento = espia("guardarRegistroAspectoDesdeInstrumento");
  export const guardarRegistroNota = espia("guardarRegistroNota");
  export const guardarRegistroNotaLocal = () => {};
  export const guardarRegistroCalificaciones = async (payload) => {
    globalThis.__llamadas.push("guardarRegistroCalificaciones");
    globalThis.__registro = { ...(globalThis.__registro || {}), ...payload };
    return { success: true, mode: "firebase" };
  };
  export const obtenerRegistroCalificaciones = async () => {
    if (globalThis.__lecturaRegistro === "falla") throw Object.assign(new Error("client is offline"), { code: "unavailable" });
    if (globalThis.__lecturaRegistro === "sin-documento") return { success: true, mode: "local", data: null };
    return { success: true, mode: "firebase", data: globalThis.__registro };
  };
`;
const FALSOS = { "firebase/firestore": FIRESTORE, "../firebase": FIREBASE, "../firebase.js": FIREBASE };
registerHooks({
  resolve: (esp, ctx, sig) => {
    if (FALSOS[esp] && /\/src\/services\//.test(ctx.parentURL || "")) return { url: `falso:${esp}`, shortCircuit: true };
    if (/^\.\.?\/[^.]*$/.test(esp) && /\/src\//.test(ctx.parentURL || "")) return sig(`${esp}.js`, ctx);
    return sig(esp, ctx);
  },
  load: (url, ctx, sig) => (url.startsWith("falso:")
    ? { format: "module", source: FALSOS[url.slice(6)], shortCircuit: true } : sig(url, ctx)),
});

const { sincronizarEvaluacionPedagogica } = await import("../src/services/nucleoPedagogicoService.js");
const { mensajeAvisosExpediente } = await import("../src/utils/avisosExpediente.js");

const PREVIO = {
  cursoId: "c1", area: "Inglés",
  asistencia: [{ id: "e1", dias: { "2026-11-20": "P", "2026-11-21": "A" } }],
  observaciones: { e1: "Participa mucho" },
  notasEstudiantes: {},
};
const instrumento = { id: "ins1", tipo: "Rúbrica", nombre: "Rúbrica", cursoId: "c1", area: "Inglés", grado: "2do", periodo: "P1", valorMaximo: 40 };
const aplicacion = { estudianteId: "e1", estudiante: "Ana", fecha: "2026-11-27", periodo: "P1", puntosObtenidos: 29, calificacionObtenida: 29, valorMaximo: 40, porcentajeObtenido: 73, observacion: "", indicadoresEvaluados: [] };
const reiniciar = (lectura) => {
  globalThis.__registro = structuredClone(PREVIO);
  globalThis.__lecturaRegistro = lectura;
  globalThis.__llamadas = [];
  globalThis.__store.clear();
};
const errorOriginal = console.error; console.error = () => {};

console.log("\nE2f: lectura del registro fallida\n");

for (const [ruta, extra] of [["F7", { evidenciaDelResultado: "evi-r1" }], ["legacy", {}]]) {
  await check(`ruta ${ruta}: lectura fallida → no escribe nada y fallosNube = ["registro"]`, async () => {
    reiniciar("falla");
    const r = await sincronizarEvaluacionPedagogica({ instrumento, aplicacion, cursoId: "c1", ...extra });
    assert.deepEqual(r.fallosNube, ["registro"]);
    assert.equal(globalThis.__llamadas.filter((l) => l === "guardarRegistroCalificaciones").length, 0, "sin guardarRegistroCalificaciones");
    assert.deepEqual(globalThis.__llamadas, [], `ninguna escritura: ${globalThis.__llamadas}`);
    assert.deepEqual(globalThis.__registro.asistencia, PREVIO.asistencia, "asistencia intacta");
    assert.deepEqual(globalThis.__registro.observaciones, PREVIO.observaciones, "observaciones intactas");
  });
}

await check("lectura correcta: sí escribe y conserva asistencia y observaciones previas", async () => {
  reiniciar("ok");
  const r = await sincronizarEvaluacionPedagogica({ instrumento, aplicacion, cursoId: "c1", evidenciaDelResultado: "evi-r1" });
  assert.ok(globalThis.__llamadas.includes("guardarRegistroCalificaciones"));
  assert.deepEqual(globalThis.__registro.asistencia, PREVIO.asistencia);
  assert.deepEqual(globalThis.__registro.observaciones, PREVIO.observaciones);
  assert.ok(!r.fallosNube.includes("registro"));
});

await check("curso sin registro todavía (mode local, data null): sí escribe el primero", async () => {
  reiniciar("sin-documento");
  globalThis.__registro = null;
  await sincronizarEvaluacionPedagogica({ instrumento, aplicacion, cursoId: "c1", evidenciaDelResultado: "evi-r1" });
  assert.ok(globalThis.__llamadas.includes("guardarRegistroCalificaciones"));
});

await check("aviso: fallo del registro no dice «Mi Registro actualizado»", () => {
  const m = mensajeAvisosExpediente([{ nombre: "Ana", fallosNube: ["registro"] }]);
  assert.ok(!m.includes("Mi Registro actualizado"), m);
  assert.match(m, /no se actualizó la nota en Mi Registro de Ana\./);
});

console.error = errorOriginal;
console.log(`\n${pasos} pasos, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
