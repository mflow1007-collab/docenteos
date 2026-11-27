/**
 * E2d-1 (auditoría 2026-11-27): el expediente se escribe en transacción.
 *
 * Ejecutar:  node scripts/test-expediente-transaccion.mjs
 *
 * Dos servicios hacen leer → fusionar → escribir sobre el MISMO documento de
 * expediente: escribirExpedienteDesdeRegistro (Registro) y
 * actualizarExpedienteConEvidencia (evidencias). Sin transacción, el último
 * borraba lo que agregó el otro; y si la lectura de evidencias fallaba, se
 * "recreaba el expediente mínimo" y se perdían evidencias e historial.
 * Cubre, con un Firestore en memoria que confirma con control de versión y
 * reintenta como el SDK: lectura fallida no escribe; dos escritores conservan
 * ambas entradas; topes únicos (timeline 80, evidencias 120).
 * Lo que NO cubre: Firestore real ni el caso real sin conexión.
 */

import assert from "node:assert/strict";
import { registerHooks } from "node:module";

let pasos = 0, fallos = 0;
const check = async (n, fn) => { try { await fn(); pasos += 1; console.log(`  ✓ ${n}`); } catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); } };

// ── Firestore en memoria con versiones (transacción optimista, 5 intentos) ───
globalThis.__store = new Map();
globalThis.__version = new Map();
globalThis.__lecturaFalla = new Set();
globalThis.__antesDeConfirmar = null; // simula otro escritor entre leer y confirmar
const FIRESTORE = `
  const store = globalThis.__store, version = globalThis.__version;
  export const doc = (_db, ...p) => ({ r: p.join("/"), id: p[p.length - 1] });
  export const serverTimestamp = () => "ahora";
  export const getDoc = async (d) => {
    if (globalThis.__lecturaFalla.has(d.id)) throw Object.assign(new Error("client is offline"), { code: "unavailable" });
    const v = store.get(d.r);
    return { exists: () => Boolean(v), data: () => v };
  };
  export const setDoc = async (d, v, o) => {
    store.set(d.r, o?.merge ? { ...(store.get(d.r) || {}), ...v } : v);
    version.set(d.r, (version.get(d.r) || 0) + 1);
  };
  export const runTransaction = async (_db, fn) => {
    for (let intento = 0; intento < 5; intento++) {
      const leidos = new Map(), sets = [];
      const tx = {
        get: async (d) => { const s = await getDoc(d); leidos.set(d.r, version.get(d.r) || 0); return s; },
        set: (d, v, o) => { sets.push([d, v, o]); return tx; },
      };
      const r = await fn(tx);
      const otro = globalThis.__antesDeConfirmar; globalThis.__antesDeConfirmar = null;
      if (otro) await otro();
      if ([...leidos].some(([ruta, ver]) => (version.get(ruta) || 0) !== ver)) continue; // conflicto: repetir
      for (const [d, v, o] of sets) await setDoc(d, v, o);
      return r;
    }
    throw Object.assign(new Error("transacción abortada"), { code: "aborted" });
  };
`;
const FIREBASE = `
  export const auth = { currentUser: { uid: "u" } };
  export const db = {};
  const nada = async () => ({});
  export const crearAspectoIdDesdeInstrumento = () => "a1";
  export const guardarEvidenciaEstudiante = nada, guardarRegistroAspectoDesdeInstrumento = nada,
    guardarRegistroCalificaciones = nada, guardarRegistroNota = nada, obtenerRegistroCalificaciones = nada;
`;
const FALSOS = { "firebase/firestore": FIRESTORE, "../firebase": FIREBASE, "../firebase.js": FIREBASE };
registerHooks({
  resolve: (esp, ctx, sig) => {
    if (FALSOS[esp] && /\/src\/services\//.test(ctx.parentURL || "")) return { url: `falso:${esp}`, shortCircuit: true };
    // Vite resuelve "./x" sin extensión; Node no. Solo para los módulos de src/.
    if (/^\.\.?\/[^.]*$/.test(esp) && /\/src\//.test(ctx.parentURL || "")) return sig(`${esp}.js`, ctx);
    return sig(esp, ctx);
  },
  load: (url, ctx, sig) => (url.startsWith("falso:")
    ? { format: "module", source: FALSOS[url.slice(6)], shortCircuit: true } : sig(url, ctx)),
});

const { escribirExpedienteDesdeRegistro, TOPE_TIMELINE_EXPEDIENTE, TOPE_EVIDENCIAS_EXPEDIENTE } =
  await import("../src/services/expedienteEstudianteService.js");
const { actualizarExpedienteConEvidencia } = await import("../src/services/nucleoPedagogicoService.js");

const RUTA = "usuarios/u/expedientesEstudiantes/c1_e1";
const reiniciar = (previo) => {
  globalThis.__store.clear(); globalThis.__version.clear(); globalThis.__lecturaFalla.clear();
  globalThis.__antesDeConfirmar = null;
  if (previo) { globalThis.__store.set(RUTA, previo); globalThis.__version.set(RUTA, 1); }
};
const evidencia = (id) => ({
  id, fecha: "2026-11-27",
  referencias: { cursoId: "c1", estudianteId: "e1" },
  contexto: { actividad: `Actividad ${id}`, estrategia: "", instrumento: "Rúbrica", indicadores: [] },
  calificacion: { obtenida: 8, valorMaximo: 10, porcentaje: 80 },
  retroalimentacion: "", adjuntos: [], estudiante: { nombre: "Ana" },
});
const conEvidencia = (id) => actualizarExpedienteConEvidencia({
  evidencia: evidencia(id), instrumento: { tipo: "Rúbrica", curso: "2do A", area: "Inglés", grado: "2do" }, registroResumen: { porcentaje: 80 },
});
const desdeRegistro = () => escribirExpedienteDesdeRegistro({
  estudiantes: [{ id: "e1", nombre: "Ana" }], notasEstudiantes: {}, asistencia: [], observaciones: {},
  cursoId: "c1", cursoNombre: "2do A", area: "Inglés", grado: "2do", estudiantesModificados: ["e1"],
});
const actual = () => globalThis.__store.get(RUTA);

console.log("\nE2d-1: expediente en transacción\n");

await check("topes únicos exportados: timeline 80, evidencias 120", () => {
  assert.equal(TOPE_TIMELINE_EXPEDIENTE, 80);
  assert.equal(TOPE_EVIDENCIAS_EXPEDIENTE, 120);
});

await check("evidencias: lectura fallida → rechaza y NO escribe (no se pierde nada)", async () => {
  const previo = { evidencias: [{ id: "ev-vieja" }], timeline: [{ id: "tl-viejo" }] };
  reiniciar(previo);
  globalThis.__lecturaFalla.add("c1_e1");
  await assert.rejects(conEvidencia("ev-nueva"), /offline/);
  assert.deepEqual(actual(), previo, "el expediente queda intacto");
});

await check("dos escritores a la vez: se conservan las entradas de ambos", async () => {
  reiniciar({ evidencias: [], timeline: [{ id: "tl-viejo" }] });
  // Mientras se confirma la evidencia A, otra pestaña escribe la evidencia B
  globalThis.__antesDeConfirmar = () => conEvidencia("ev-B");
  await conEvidencia("ev-A");
  const ids = actual().evidencias.map((e) => e.id);
  assert.ok(ids.includes("ev-A") && ids.includes("ev-B"), `evidencias: ${ids}`);
  const tl = actual().timeline.map((e) => e.id);
  assert.ok(tl.includes("ev-A") && tl.includes("ev-B") && tl.includes("tl-viejo"), `timeline: ${tl}`);
});

await check("Registro y evidencias a la vez: el Registro no borra la evidencia", async () => {
  reiniciar({ evidencias: [], timeline: [{ id: "tl-viejo" }] });
  globalThis.__antesDeConfirmar = () => conEvidencia("ev-C");
  const r = await desdeRegistro();
  assert.deepEqual(r.fallidos, []);
  assert.ok(actual().timeline.some((e) => e.id === "ev-C"), "la entrada de la evidencia sigue");
  assert.ok(actual().evidencias.some((e) => e.id === "ev-C"));
});

await check("topes: timeline 80 y evidencias 120 en el escritor de evidencias", async () => {
  reiniciar({
    evidencias: Array.from({ length: 130 }, (_, i) => ({ id: `ev${i}` })),
    timeline: Array.from({ length: 90 }, (_, i) => ({ id: `tl${i}` })),
  });
  await conEvidencia("ev-nueva");
  assert.equal(actual().evidencias.length, 120);
  assert.equal(actual().timeline.length, 80);
  assert.equal(actual().evidencias[0].id, "ev-nueva");
});

await check("tope 80 en el escritor del Registro (antes 60)", async () => {
  reiniciar({ timeline: Array.from({ length: 90 }, (_, i) => ({ id: `tl${i}` })) });
  await desdeRegistro();
  assert.equal(actual().timeline.length, 80);
});

console.log(`\n${pasos} pasos, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
