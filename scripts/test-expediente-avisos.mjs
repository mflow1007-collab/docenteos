/**
 * E2d-2 (auditoría 2026-11-27): el fallo del expediente se informa, no se traga.
 *
 * Ejecutar:  node scripts/test-expediente-avisos.mjs
 *
 * Antes, sincronizarEvaluacionPedagogica descartaba el fallo del expediente
 * (allSettled en la ruta legacy; y en la ruta F7 el error lo tragaba
 * evaluarYRegistrar con console.warn). Cubre, con Firestore en memoria:
 * fallosNube en las dos rutas; el texto del aviso; y en el código fuente que
 * evaluarYRegistrar devuelve avisos y que Modo Aula e Instrumentos los muestran.
 * Lo que NO cubre: la pantalla real (se verifica en el navegador).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";

let pasos = 0, fallos = 0;
const check = async (n, fn) => { try { await fn(); pasos += 1; console.log(`  ✓ ${n}`); } catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); } };

const almacen = new Map();
globalThis.localStorage = { getItem: (k) => almacen.get(k) ?? null, setItem: (k, v) => almacen.set(k, String(v)), removeItem: (k) => almacen.delete(k) };

globalThis.__store = new Map();
globalThis.__lecturaFalla = new Set();
const FIRESTORE = `
  const store = globalThis.__store;
  export const doc = (_db, ...p) => ({ r: p.join("/"), id: p[p.length - 1] });
  export const serverTimestamp = () => "ahora";
  export const getDoc = async (d) => {
    if (globalThis.__lecturaFalla.has(d.id)) throw Object.assign(new Error("client is offline"), { code: "unavailable" });
    const v = store.get(d.r);
    return { exists: () => Boolean(v), data: () => v };
  };
  export const setDoc = async (d, v, o) => { store.set(d.r, o?.merge ? { ...(store.get(d.r) || {}), ...v } : v); };
  export const runTransaction = async (_db, fn) => {
    const sets = [];
    const r = await fn({ get: (d) => getDoc(d), set: (d, v, o) => { sets.push([d, v, o]); } });
    for (const [d, v, o] of sets) await setDoc(d, v, o);
    return r;
  };
`;
const FIREBASE = `
  export const auth = { currentUser: { uid: "u" } };
  export const db = {};
  const nada = async () => ({});
  export const crearAspectoIdDesdeInstrumento = () => "a1";
  export const guardarEvidenciaEstudiante = nada, guardarRegistroAspectoDesdeInstrumento = nada,
    guardarRegistroCalificaciones = nada, guardarRegistroNota = nada;
  export const guardarRegistroNotaLocal = () => {};
  export const obtenerRegistroCalificaciones = async () => ({ data: {} });
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

const instrumento = { id: "ins1", tipo: "Rúbrica", nombre: "Rúbrica", cursoId: "c1", area: "Inglés", grado: "2do", periodo: "P1", valorMaximo: 10 };
const aplicacion = {
  estudianteId: "e1", estudiante: "Ana", fecha: "2026-11-27", periodo: "P1",
  puntosObtenidos: 8, calificacionObtenida: 8, valorMaximo: 10, porcentajeObtenido: 80,
  observacion: "", indicadoresEvaluados: [],
};
const expedienteId = "c1_e1";
const errorOriginal = console.error; console.error = () => {};

console.log("\nE2d-2: avisos del expediente\n");

await check("ruta F7: expediente con lectura fallida → fallosNube ['expediente'], no lanza", async () => {
  globalThis.__store.clear(); globalThis.__lecturaFalla.clear(); globalThis.__lecturaFalla.add(expedienteId);
  const r = await sincronizarEvaluacionPedagogica({ instrumento, aplicacion, cursoId: "c1", evidenciaDelResultado: "evi-r1" });
  assert.deepEqual(r.fallosNube, ["expediente"]);
});

await check("ruta F7: todo bien → fallosNube vacío", async () => {
  globalThis.__store.clear(); globalThis.__lecturaFalla.clear();
  const r = await sincronizarEvaluacionPedagogica({ instrumento, aplicacion, cursoId: "c1", evidenciaDelResultado: "evi-r1" });
  assert.deepEqual(r.fallosNube, []);
});

await check("ruta legacy: expediente con lectura fallida → fallosNube incluye 'expediente'", async () => {
  globalThis.__store.clear(); globalThis.__lecturaFalla.clear(); globalThis.__lecturaFalla.add(expedienteId);
  const r = await sincronizarEvaluacionPedagogica({ instrumento, aplicacion, cursoId: "c1" });
  assert.ok(r.fallosNube.includes("expediente"), JSON.stringify(r.fallosNube));
});

await check("mensaje: nombra a los estudiantes, dice qué hacer y no trae detalle técnico", () => {
  const uno = mensajeAvisosExpediente([{ nombre: "Ana" }]);
  assert.match(uno, /no se actualizó el expediente de Ana\./);
  assert.match(uno, /vuelve a guardar la evaluación de ese estudiante/);
  assert.match(mensajeAvisosExpediente([{ nombre: "Ana" }, { nombre: "Luis" }]), /de Ana, Luis\..*esos estudiantes/);
  assert.equal(mensajeAvisosExpediente([]), "");
});

console.error = errorOriginal;

// ── Código fuente ───────────────────────────────────────────────────────────
const leer = (r) => readFileSync(new URL(`../src/${r}`, import.meta.url), "utf8");
const modoAula = leer("services/modoAulaService.js");
const inicioEyR = modoAula.indexOf("export const evaluarYRegistrar");
const eyr = modoAula.slice(inicioEyR, modoAula.indexOf("\n};", inicioEyR));

await check("evaluarYRegistrar: el puente ya no se traga el error y devuelve avisos", () => {
  assert.doesNotMatch(eyr, /console\.warn\(`\[evaluarYRegistrar\] Puente legacy/);
  assert.match(eyr, /return \{ fallosNube: \["puente"\] \}/);
  assert.match(eyr, /avisos\.push\(/);
  assert.match(eyr, /return \{ exitosos, errores, avisos \};/);
});

await check("Modo Aula: con avisos muestra el mensaje de error, no el de éxito", () => {
  const p = leer("pages/ModoAulaPage.jsx");
  assert.match(p, /const \{ exitosos, errores, avisos = \[\] \} = await evaluarYRegistrar\(/);
  assert.match(p, /avisos\.length\s*\? \{ tipo:'error', texto: mensajeAvisosExpediente\(avisos\) \}/);
});

await check("Instrumentos: muestra el aviso en las dos rutas y no lo borra solo", () => {
  const p = leer("pages/InstrumentosPage.jsx");
  assert.match(p, /const puente = await sincronizarEvaluacionPedagogica\(/);
  assert.match(p, /texto: mensajeAvisosExpediente\(avisosHilo\)/);
  assert.match(p, /if \(!avisosHilo\.length\) setTimeout\(\(\) => setMensaje\(null\), 2500\);/);
  assert.match(p, /aria-label="Cerrar aviso"/);
});

console.log(`\n${pasos} pasos, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
