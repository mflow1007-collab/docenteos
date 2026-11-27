/**
 * E1b2 (auditoría 2026-11-27): vigilarEscritura avisa si una escritura tarda.
 *
 * Ejecutar:  node scripts/test-vigilar-escritura.mjs
 *
 * Sin persistencia offline, setDoc queda pendiente sin rechazar mientras no
 * hay conexión. Cubre la utilidad (src/utils/vigilarEscritura.js) con esperas
 * cortas, y en el código fuente de App.jsx que solo crearCurso y
 * actualizarCurso la usan (la carga no) y que hay beforeunload con contador.
 * Lo que NO cubre: el aviso en pantalla ni la pregunta real del navegador.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { vigilarEscritura, esperarOFallar } from "../src/utils/vigilarEscritura.js";

let pasos = 0, fallos = 0;
const check = async (n, fn) => { try { await fn(); pasos += 1; console.log(`  ✓ ${n}`); } catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); } };
const esperar = (ms, valor) => new Promise((r) => setTimeout(() => r(valor), ms));

const registro = () => {
  const ev = [];
  return { ev, opciones: {
    esperaMs: 20,
    alEmpezar: () => ev.push("empieza"),
    alTardar: () => ev.push("tarda"),
    alTerminar: ({ tardo }) => ev.push(`termina:${tardo}`),
  } };
};

console.log("\nE1b2: vigilar escrituras pendientes\n");

await check("escritura lenta: avisa y luego termina con tardo=true", async () => {
  const { ev, opciones } = registro();
  const res = await vigilarEscritura(esperar(60, "ok"), opciones);
  assert.equal(res, "ok", "devuelve el resultado de la escritura");
  assert.deepEqual(ev, ["empieza", "tarda", "termina:true"]);
});

await check("escritura rápida: no avisa", async () => {
  const { ev, opciones } = registro();
  await vigilarEscritura(esperar(1), opciones);
  await esperar(40); // pasado el plazo: el temporizador se limpió
  assert.deepEqual(ev, ["empieza", "termina:false"]);
});

await check("escritura que falla: termina y deja pasar el error", async () => {
  const { ev, opciones } = registro();
  await assert.rejects(vigilarEscritura(Promise.reject(new Error("permiso")), opciones), /permiso/);
  await esperar(40);
  assert.deepEqual(ev, ["empieza", "termina:false"]);
});

await check("sin callbacks: no falla", async () => {
  assert.equal(await vigilarEscritura(Promise.resolve(1)), 1);
});

// E2b: esperarOFallar (guardado del registro con tiempo límite)
await check("E2b: promesa que NUNCA termina → rechaza en el plazo con code tiempo-agotado", async () => {
  const t0 = Date.now();
  await assert.rejects(esperarOFallar(new Promise(() => {}), 20, "sin confirmar"),
    (e) => e.code === "tiempo-agotado" && e.message === "sin confirmar");
  assert.ok(Date.now() - t0 < 1000);
});
await check("E2b: promesa rápida → devuelve el valor", async () => {
  assert.deepEqual(await esperarOFallar(Promise.resolve({ mode: "firebase" }), 50), { mode: "firebase" });
});
await check("E2b: promesa que rechaza → deja pasar el error original", async () => {
  await assert.rejects(esperarOFallar(Promise.reject(new Error("permiso")), 50), /permiso/);
});

// ── Código fuente de App.jsx ────────────────────────────────────────────────
const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const cuerpo = (nombre) => {
  const inicio = app.indexOf(`const ${nombre} = (`);
  assert.ok(inicio >= 0, `no se encontró ${nombre}`);
  return app.slice(inicio, app.indexOf("\n  };", inicio));
};

for (const fn of ["crearCurso", "actualizarCurso"]) {
  await check(`${fn} pasa por vigilarGuardadoCurso (cadena completa)`, () => {
    assert.match(cuerpo(fn), /vigilarGuardadoCurso\(\w+, sincronizarCursoConGrupoAcademico\(/);
    assert.match(cuerpo(fn), /return guardarCursoFS\(/, "el reintento se devuelve para que la vigilancia lo cubra");
  });
}

await check("la carga y el refresco NO vigilan (sin falsas alarmas)", () => {
  const usos = app.match(/vigilarGuardadoCurso\(/g) || [];
  assert.equal(usos.length, 2, "solo las llamadas de crearCurso y actualizarCurso");
  for (const linea of app.split("\n").filter((l) => l.includes("sincronizarCursosConGruposAcademicos("))) {
    assert.ok(!linea.includes("vigilar"), linea.trim());
  }
});

await check("beforeunload solo con escrituras pendientes, y se quita", () => {
  assert.match(app, /if \(!hayEscriturasCursoPendientes\) return undefined;/);
  assert.match(app, /window\.addEventListener\("beforeunload", preguntar\)/);
  assert.match(app, /window\.removeEventListener\("beforeunload", preguntar\)/);
});

await check("el aviso dice qué hacer y se quita solo al confirmarse", () => {
  const c = cuerpo("vigilarGuardadoCurso");
  assert.match(c, /No cierres ni recargues la página hasta que vuelva la conexión\./);
  assert.match(c, /actual === aviso \? null : actual/);
});

console.log(`\n${pasos} pasos, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
