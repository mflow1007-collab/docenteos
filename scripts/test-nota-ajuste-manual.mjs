/**
 * E2e (auditoría 2026-11-27): la nota ajustada a mano no se pisa.
 *
 * Ejecutar:  node scripts/test-nota-ajuste-manual.mjs
 *
 * Antes, la ruta legacy de sincronizarEvaluacionPedagogica leía la nota previa
 * con catch {} y, si la lectura fallaba, escribía el cálculo automático encima
 * del ajuste manual del docente (regla 12). Cubre: la regla pura (con guarda
 * contra NaN), la transacción con Firestore en memoria (lectura fallida no
 * escribe; ajuste respetado; ajuste hecho mientras se evalúa), fallosNube y el
 * texto del aviso; y que construirPayloadNota da el mismo payload que el
 * código anterior de guardarRegistroNota. Lo que NO cubre: Firestore real.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";

let pasos = 0, fallos = 0;
const check = async (n, fn) => { try { await fn(); pasos += 1; console.log(`  ✓ ${n}`); } catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); } };

const almacen = new Map();
globalThis.localStorage = { getItem: (k) => almacen.get(k) ?? null, setItem: (k, v) => almacen.set(k, String(v)), removeItem: (k) => almacen.delete(k) };

// Firestore en memoria con versiones; la transacción se repite si hubo cambio.
globalThis.__store = new Map();
globalThis.__version = new Map();
globalThis.__lecturaFalla = () => false;
globalThis.__antesDeConfirmar = null;
globalThis.__notasLocales = [];
const FIRESTORE = `
  const store = globalThis.__store, version = globalThis.__version;
  export const doc = (_db, ...p) => ({ r: p.join("/"), id: p[p.length - 1] });
  export const serverTimestamp = () => "ahora";
  export const getDoc = async (d) => {
    if (globalThis.__lecturaFalla(d.r)) throw Object.assign(new Error("client is offline"), { code: "unavailable" });
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
      if ([...leidos].some(([ruta, ver]) => (version.get(ruta) || 0) !== ver)) continue;
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
    guardarRegistroCalificaciones = nada, guardarRegistroNota = nada;
  export const guardarRegistroNotaLocal = (p) => { globalThis.__notasLocales.push(p); };
  export const obtenerRegistroCalificaciones = async () => ({ success: true, mode: "firebase", data: {} });
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

const { aplicarAjusteManual, construirPayloadNota } = await import("../src/utils/notaRegistro.js");
const { guardarNotaDesdeInstrumento, sincronizarEvaluacionPedagogica } = await import("../src/services/nucleoPedagogicoService.js");
const { mensajeAvisosExpediente } = await import("../src/utils/avisosExpediente.js");

const RUTA = "usuarios/u/cursos/c1/registroNotas/e1_a1";
const reiniciar = (previa) => {
  globalThis.__store.clear(); globalThis.__version.clear(); globalThis.__notasLocales = [];
  globalThis.__lecturaFalla = () => false; globalThis.__antesDeConfirmar = null;
  if (previa) { globalThis.__store.set(RUTA, previa); globalThis.__version.set(RUTA, 1); }
};
const notaCalculada = (valor) => ({
  cursoId: "c1", estudianteId: "e1", aspectoId: "a1", instrumentoId: "ins1",
  valorObtenido: valor, valorCalculado: valor, desactualizado: false, puntajeMaximo: 40,
  porcentaje: null, observacion: "", fechaActualizacion: "2026-11-27",
});
const MANUAL = { valorObtenido: 32, valorCalculado: 35, ajusteManual: true, motivoAjuste: "Trabajo extra", desactualizado: false };
const errorOriginal = console.error; console.error = () => {};

console.log("\nE2e: nota ajustada a mano\n");

// ── Regla pura ──────────────────────────────────────────────────────────────
await check("regla: con ajusteManual la nota manual se conserva aunque cambie el cálculo", () => {
  const r = construirPayloadNota(aplicarAjusteManual(notaCalculada(29), MANUAL));
  assert.equal(r.valorObtenido, 32);
  assert.equal(r.valorCalculado, 29);
  assert.equal(r.ajusteManual, true);
  assert.equal(r.motivoAjuste, "Trabajo extra");
  assert.equal(r.desactualizado, true);
  assert.equal(r.porcentaje, 80, "porcentaje de la nota manual (32/40)");
});
await check("regla: sin ajuste manual entra el cálculo", () => {
  assert.equal(aplicarAjusteManual(notaCalculada(29), { valorObtenido: 30 }).valorObtenido, 29);
  assert.equal(aplicarAjusteManual(notaCalculada(29), null).valorObtenido, 29);
});
await check("regla: sin valorCalculado válido no marca desactualizado por NaN", () => {
  for (const malo of ["", null, undefined, "abc"]) {
    const r = aplicarAjusteManual({ ...notaCalculada(malo), valorCalculado: malo }, MANUAL);
    assert.equal(r.desactualizado, false, `valorCalculado=${String(malo)}`);
    assert.equal(r.valorObtenido, 32);
  }
  const yaDesact = aplicarAjusteManual({ ...notaCalculada(""), valorCalculado: "" }, { ...MANUAL, desactualizado: true });
  assert.equal(yaDesact.desactualizado, true, "se conserva lo que había");
});

// ── Transacción ─────────────────────────────────────────────────────────────
await check("lectura fallida → rechaza, NO escribe y no guarda copia local", async () => {
  reiniciar(MANUAL);
  globalThis.__lecturaFalla = (r) => r === RUTA;
  await assert.rejects(guardarNotaDesdeInstrumento(notaCalculada(29)), /offline/);
  assert.deepEqual(globalThis.__store.get(RUTA), MANUAL, "la nota manual sigue intacta");
  assert.equal(globalThis.__notasLocales.length, 0);
});
await check("con ajusteManual en la nube: valorObtenido 32 intacto, cálculo actualizado", async () => {
  reiniciar(MANUAL);
  await guardarNotaDesdeInstrumento(notaCalculada(29));
  const n = globalThis.__store.get(RUTA);
  assert.equal(n.valorObtenido, 32);
  assert.equal(n.valorCalculado, 29);
  assert.equal(n.desactualizado, true);
  assert.equal(globalThis.__notasLocales.at(-1).valorObtenido, 32, "copia local con la nota manual");
});
await check("el docente ajusta a mano MIENTRAS se evalúa: se repite y respeta el ajuste", async () => {
  reiniciar({ valorObtenido: 35, valorCalculado: 35 });
  globalThis.__antesDeConfirmar = async () => {
    globalThis.__store.set(RUTA, { ...globalThis.__store.get(RUTA), valorObtenido: 30, ajusteManual: true });
    globalThis.__version.set(RUTA, (globalThis.__version.get(RUTA) || 0) + 1);
  };
  await guardarNotaDesdeInstrumento(notaCalculada(29));
  assert.equal(globalThis.__store.get(RUTA).valorObtenido, 30);
  assert.equal(globalThis.__store.get(RUTA).ajusteManual, true);
});
await check("sincronizar (ruta legacy): nota con lectura fallida → fallosNube incluye 'nota'", async () => {
  reiniciar(MANUAL);
  globalThis.__lecturaFalla = (r) => r.includes("/registroNotas/");
  const r = await sincronizarEvaluacionPedagogica({
    instrumento: { id: "ins1", tipo: "Rúbrica", nombre: "Rúbrica", cursoId: "c1", area: "Inglés", grado: "2do", periodo: "P1", valorMaximo: 40 },
    aplicacion: { estudianteId: "e1", estudiante: "Ana", fecha: "2026-11-27", periodo: "P1", puntosObtenidos: 29, calificacionObtenida: 29, valorMaximo: 40, porcentajeObtenido: 73, observacion: "", indicadoresEvaluados: [] },
    cursoId: "c1",
  });
  assert.ok(r.fallosNube.includes("nota"), JSON.stringify(r.fallosNube));
  assert.equal(globalThis.__store.get(RUTA).valorObtenido, 32, "nota manual intacta");
});
await check("aviso: si falló la nota NO dice «Mi Registro actualizado»", () => {
  const m = mensajeAvisosExpediente([{ nombre: "Ana", fallosNube: ["nota"] }]);
  assert.ok(!m.includes("Mi Registro actualizado"), m);
  assert.match(m, /no se actualizó la nota en Mi Registro de Ana\./);
  assert.match(mensajeAvisosExpediente([{ nombre: "Ana", fallosNube: ["nota", "expediente"] }]), /la nota en Mi Registro ni el expediente de Ana/);
  assert.match(mensajeAvisosExpediente([{ nombre: "Ana", fallosNube: ["expediente"] }]), /Mi Registro actualizado, pero no se actualizó el expediente/);
});

console.error = errorOriginal;

// ── Equivalencia: construirPayloadNota = código anterior de guardarRegistroNota ──
// Copia literal del cálculo que había en src/firebase.js (guardarRegistroNota) antes de E2e.
const payloadAnterior = (nota) => {
  const notaId = String(nota.notaId || `${nota.estudianteId}_${nota.aspectoId}`);
  const puntajeMaximo = Number(nota.puntajeMaximo) || 0;
  const valorObtenido = nota.valorObtenido === "" || nota.valorObtenido === null || nota.valorObtenido === undefined
    ? ""
    : Number(nota.valorObtenido);
  const porcentaje = puntajeMaximo > 0 && valorObtenido !== "" ? Math.round((Number(valorObtenido) / puntajeMaximo) * 100) : null;
  return { ...nota, notaId, id: notaId, valorObtenido, puntajeMaximo, porcentaje, fechaActualizacion: new Date().toISOString() };
};
const sinFecha = ({ fechaActualizacion, ...resto }) => resto;
await check("equivalencia: mismo payload que antes (salvo fechaActualizacion)", () => {
  const casos = [
    notaCalculada(29),
    { ...notaCalculada("33"), notaId: "propio" },
    { ...notaCalculada(""), puntajeMaximo: "40" },
    { ...notaCalculada(null), puntajeMaximo: 0 },
    { ...notaCalculada(undefined), puntajeMaximo: "x" },
    { cursoId: "c", estudianteId: "e", aspectoId: "a", valorObtenido: 7.5, puntajeMaximo: 10, ajusteManual: true, extra: { a: 1 } },
  ];
  for (const c of casos) assert.deepEqual(sinFecha(construirPayloadNota(c)), sinFecha(payloadAnterior(c)), JSON.stringify(c));
});
await check("guardarRegistroNota usa construirPayloadNota y sigue guardando local + nube", () => {
  const f = readFileSync(new URL("../src/firebase.js", import.meta.url), "utf8");
  const i = f.indexOf("export const guardarRegistroNota = async");
  const cuerpo = f.slice(i, f.indexOf("\n};", i));
  assert.match(cuerpo, /const payload = construirPayloadNota\(nota\);/);
  assert.match(cuerpo, /guardarRegistroNotaLocal\(payload\);/);
  assert.match(cuerpo, /await setDoc\(/);
});

console.log(`\n${pasos} pasos, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
