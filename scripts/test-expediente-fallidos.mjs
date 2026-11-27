/**
 * E2 (auditoría 2026-11-27): el expediente de los estudiantes no falla en silencio.
 *
 * Ejecutar:  node scripts/test-expediente-fallidos.mjs
 *
 * Antes, escribirExpedienteDesdeRegistro terminaba en Promise.allSettled (nunca
 * rechaza) y la página además hacía .catch(() => {}): el docente veía
 * "guardado" aunque ningún expediente se actualizara. Cubre, con Firestore
 * simulado: fallidos por estudiante, tiempo límite con una escritura que nunca
 * termina (sin conexión), y en el código fuente de la página el orden y los
 * mensajes. Lo que NO cubre: la pantalla (se verifica en el navegador).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";

let pasos = 0, fallos = 0;
const check = async (n, fn) => { try { await fn(); pasos += 1; console.log(`  ✓ ${n}`); } catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); } };

// Firestore simulado. globalThis.__setDocModo: id de documento → "falla" | "nunca"
globalThis.__setDocModo = {};
globalThis.__escritosExp = [];
globalThis.__sesion = true;
const FIRESTORE = `
  export const doc = (_db, ...p) => ({ r: p.join("/"), id: p[p.length - 1] });
  export const serverTimestamp = () => "ahora";
  export const getDoc = async () => ({ exists: () => false, data: () => ({}) });
  export const setDoc = (d, v) => {
    const modo = globalThis.__setDocModo[d.id];
    if (modo === "nunca") return new Promise(() => {});
    if (modo === "falla") return Promise.reject(Object.assign(new Error("permiso"), { code: "permission-denied" }));
    globalThis.__escritosExp.push(d.id);
    return Promise.resolve();
  };
`;
const FIREBASE = `
  export const auth = { get currentUser() { return globalThis.__sesion ? { uid: "u" } : null; } };
  export const db = {};
`;
const FALSOS = { "firebase/firestore": FIRESTORE, "../firebase.js": FIREBASE };
registerHooks({
  resolve: (esp, ctx, sig) => (FALSOS[esp] && ctx.parentURL?.endsWith("/expedienteEstudianteService.js")
    ? { url: `falso:${esp}`, shortCircuit: true } : sig(esp, ctx)),
  load: (url, ctx, sig) => (url.startsWith("falso:")
    ? { format: "module", source: FALSOS[url.slice(6)], shortCircuit: true } : sig(url, ctx)),
});
const { escribirExpedienteDesdeRegistro, escribirExpedienteConLimite } =
  await import("../src/services/expedienteEstudianteService.js");
const { conTiempoLimite } = await import("../src/utils/vigilarEscritura.js");

const ESTUDIANTES = [{ id: "e1", nombre: "Ana" }, { id: "e2", nombre: "Luis" }, { id: "e3", nombre: "Rosa" }];
const params = (extra = {}) => ({
  estudiantes: ESTUDIANTES, notasEstudiantes: {}, asistencia: [], observaciones: {},
  cursoId: "c1", cursoNombre: "2do A", area: "Inglés", grado: "2do", estudiantesModificados: null, ...extra,
});
// El docId del expediente incluye el id del estudiante; se busca por sufijo.
const idDoc = (estId) => `c1_${estId}`;
const reiniciar = (modos = {}) => {
  globalThis.__setDocModo = Object.fromEntries(Object.entries(modos).map(([e, m]) => [idDoc(e), m]));
  globalThis.__escritosExp = [];
  globalThis.__sesion = true;
};

const errorOriginal = console.error, avisoOriginal = console.warn;
console.error = () => {}; console.warn = () => {};

console.log("\nE2: expediente de estudiantes\n");

await check("docId del expediente = cursoId_estId (base de esta prueba)", async () => {
  reiniciar();
  await escribirExpedienteDesdeRegistro(params({ estudiantesModificados: ["e1"] }));
  assert.deepEqual(globalThis.__escritosExp, [idDoc("e1")]);
});

await check("2 de 3 fallan: devuelve esos 2 y escribe el tercero", async () => {
  reiniciar({ e1: "falla", e3: "falla" });
  const r = await escribirExpedienteDesdeRegistro(params());
  assert.deepEqual(r.fallidos.sort(), ["e1", "e3"]);
  assert.deepEqual(globalThis.__escritosExp, [idDoc("e2")]);
});

await check("con límite: parcial y pendientes = fallidos", async () => {
  reiniciar({ e2: "falla" });
  const r = await escribirExpedienteConLimite(params(), { esperaMs: 200 });
  assert.equal(r.estado, "parcial");
  assert.deepEqual(r.pendientes, ["e2"]);
});

await check("con límite: todo bien → ok, sin pendientes", async () => {
  reiniciar();
  const r = await escribirExpedienteConLimite(params(), { esperaMs: 200 });
  assert.deepEqual(r, { estado: "ok", pendientes: [] });
});

await check("escritura que NUNCA termina: libera dentro del plazo y re-marca los modificados", async () => {
  reiniciar({ e1: "nunca" });
  const t0 = Date.now();
  const r = await escribirExpedienteConLimite(params({ estudiantesModificados: ["e1", "e2"] }), { esperaMs: 30 });
  assert.ok(Date.now() - t0 < 1000, "no se queda esperando");
  assert.equal(r.estado, "sin_conexion");
  assert.deepEqual(r.pendientes, ["e1", "e2"], "todos los modificados, no solo el colgado");
});

await check("NUNCA termina sin lista de modificados: re-marca a todos los estudiantes", async () => {
  reiniciar({ e3: "nunca" });
  const r = await escribirExpedienteConLimite(params(), { esperaMs: 30 });
  assert.equal(r.estado, "sin_conexion");
  assert.deepEqual(r.pendientes, ["e1", "e2", "e3"]);
});

await check("error antes de escribir: estado error, todos pendientes, no lanza", async () => {
  reiniciar();
  const r = await escribirExpedienteConLimite(params({ estudiantes: null, estudiantesModificados: ["e1"] }), { esperaMs: 200 });
  assert.equal(r.estado, "error");
  assert.deepEqual(r.pendientes, ["e1"]);
});

await check("sin sesión: no escribe y no hay pendientes", async () => {
  reiniciar(); globalThis.__sesion = false;
  assert.deepEqual(await escribirExpedienteDesdeRegistro(params()), { fallidos: [] });
});

await check("conTiempoLimite: valor a tiempo, vencido si no, y deja pasar el rechazo", async () => {
  assert.deepEqual(await conTiempoLimite(Promise.resolve(7), 50), { vencido: false, valor: 7 });
  assert.deepEqual(await conTiempoLimite(new Promise(() => {}), 10), { vencido: true });
  await assert.rejects(conTiempoLimite(Promise.reject(new Error("x")), 50), /x/);
});

console.error = errorOriginal; console.warn = avisoOriginal;

// ── Código fuente de la página ──────────────────────────────────────────────
const pagina = readFileSync(new URL("../src/pages/RegistroCalificacionesPage.jsx", import.meta.url), "utf8");
const inicio = pagina.indexOf("const handleGuardar = async () => {");
const guardar = pagina.slice(inicio, pagina.indexOf("\n  };", inicio));

await check("E2b página: el registro se espera con tiempo límite dentro del try", () => {
  const iTry = guardar.indexOf("try {");
  const iEspera = guardar.indexOf("await esperarOFallar(guardarRegistroCalificaciones(");
  assert.ok(iEspera > iTry && iTry >= 0, "esperarOFallar(guardarRegistroCalificaciones(...)) dentro del try");
  assert.ok(iEspera < guardar.indexOf("} catch (error) {"), "antes del catch que muestra «No se guardó»");
});

await check("página: el expediente ya no se traga el error", () => {
  assert.ok(!/escribirExpediente\w*\([\s\S]*?\)\.catch\(\(\) => \{\}\)/.test(guardar));
  assert.match(guardar, /await escribirExpedienteConLimite\(/);
});

await check("página: onActualizarCurso va antes del modo local y del expediente", () => {
  const iCurso = guardar.indexOf("onActualizarCurso({");
  assert.ok(iCurso > 0 && iCurso < guardar.indexOf('if (mode !== "firebase")'), "antes del return de modo local");
  assert.ok(iCurso < guardar.indexOf("escribirExpedienteConLimite("), "antes del expediente");
});

await check("página: los pendientes vuelven a marcarse", () => {
  assert.match(guardar, /expediente\.pendientes\.forEach\(\(id\) => estudiantesModificadosRef\.current\.add\(id\)\)/);
});

await check("página: en modo local no dice «en la nube» como éxito", () => {
  const local = guardar.slice(guardar.indexOf('if (mode !== "firebase")'), guardar.indexOf("return;", guardar.indexOf('if (mode !== "firebase")')));
  assert.match(local, /solo en este equipo, no en la nube/);
});

await check("página: el error del registro no muestra error.message", () => {
  const c = guardar.slice(guardar.indexOf("} catch (error) {"));
  assert.match(c, /❌ No se guardó en la nube\. Quedó en este equipo; revisa la conexión y pulsa «Guardar» de nuevo\./);
  assert.ok(!/texto:[^\n]*error\?\.message/.test(c), "sin detalle técnico en el texto");
  assert.match(c, /console\.error\(/);
});

await check("página: solo el éxito desaparece solo; el error tiene botón para cerrar", () => {
  assert.match(guardar, /if \(mensajeFinal\?\.tipo === "ok"\) \{\s*setTimeout/);
  assert.match(pagina, /mensajeGuardado\.tipo === "error" && \(\s*<button[^>]*aria-label="Cerrar aviso"/);
});

console.log(`\n${pasos} pasos, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
