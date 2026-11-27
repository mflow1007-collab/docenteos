/**
 * E1b (auditoría 2026-11-27): si el curso no llega a la nube, el docente lo ve.
 *
 * Ejecutar:  node scripts/test-curso-no-guardado.mjs
 *
 * Antes, crearCurso y actualizarCurso (src/App.jsx) terminaban en
 * guardarCursoFS(...).catch(console.error): el curso quedaba en pantalla como
 * guardado y se perdía al recargar. Es una comprobación del CÓDIGO FUENTE
 * (App.jsx no se puede montar aquí sin React). Lo que NO cubre: el aviso en
 * pantalla ni el caso sin conexión, donde setDoc queda pendiente y no rechaza
 * (ver E1c en la auditoría).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let pasos = 0, fallos = 0;
const check = (n, fn) => { try { fn(); pasos += 1; console.log(`  ✓ ${n}`); } catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); } };

const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

// Cuerpo de una función flecha de AppInner: desde "const nombre = (" hasta el
// primer cierre "\n  };" con la sangría de las funciones de AppInner.
const cuerpo = (nombre) => {
  const inicio = app.indexOf(`const ${nombre} = (`);
  assert.ok(inicio >= 0, `no se encontró ${nombre}`);
  const fin = app.indexOf("\n  };", inicio);
  assert.ok(fin > inicio, `no se encontró el final de ${nombre}`);
  return app.slice(inicio, fin);
};

// Último .catch de la función: el del reintento con guardarCursoFS
const ultimoCatch = (texto) => texto.slice(texto.lastIndexOf("guardarCursoFS("));

const mensaje = (() => {
  const c = cuerpo("avisarCursoNoGuardado");
  const m = c.match(/setErrorCarga\(`([^`]*)`\)/);
  assert.ok(m, "avisarCursoNoGuardado no llama a setErrorCarga con un texto");
  return m[1];
})();

console.log("\nE1b: curso no guardado en la nube\n");

for (const fn of ["crearCurso", "actualizarCurso"]) {
  check(`${fn}: el reintento fallido avisa al docente`, () => {
    const fin = ultimoCatch(cuerpo(fn));
    assert.match(fin, /\.catch\(\(error\) => avisarCursoNoGuardado\(/, "el .catch final debe llamar a avisarCursoNoGuardado");
  });
  check(`${fn}: el .catch final no termina solo en console.error`, () => {
    const fin = ultimoCatch(cuerpo(fn));
    assert.doesNotMatch(fin, /\.catch\(\(error\) => console\.error\(/);
  });
}

check("el aviso deja el detalle técnico en console.error", () => {
  assert.match(cuerpo("avisarCursoNoGuardado"), /console\.error\(/);
});

check("el mensaje dice la acción concreta («Editar curso» y «Guardar curso»)", () => {
  assert.ok(mensaje.includes("«Editar curso»"), mensaje);
  assert.ok(mensaje.includes("«Guardar curso»"), mensaje);
});

check("el mensaje avisa que se pierde al recargar", () => {
  assert.ok(/antes de recargar/.test(mensaje) && /se perderá/.test(mensaje), mensaje);
});

check("el mensaje no promete reintento automático", () => {
  assert.ok(!/reintentar/i.test(mensaje), mensaje);
});

check("el mensaje no incluye el detalle técnico del error", () => {
  assert.ok(!/error\.message|\$\{error/.test(mensaje), mensaje);
});

console.log(`\n${pasos} pasos, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
