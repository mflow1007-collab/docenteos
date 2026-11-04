/**
 * Guardado del Registro en Firestore (src/utils/registroGuardado.js).
 *
 * Ejecutar:  node scripts/test-registro-guardado.mjs
 *
 * Desde v0.6.0 la página mandaba resumenEvaluacionesInstrumentos = undefined y
 * Firestore rechazaba todo el documento. Cubre: limpieza de undefined sin tocar
 * centinelas/Timestamps, y que la página no sube evaluacionesInstrumentos. Lo
 * que NO cubre: la escritura real (se verifica en el navegador).
 */

import { payloadRemotoDePagina, sinIndefinidos } from "../src/utils/registroGuardado.js";

let pasos = 0, fallos = 0;
const check = (n, fn) => { try { fn(); pasos += 1; console.log(`  ✓ ${n}`); } catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); } };
const assert = (c, m) => { if (!c) throw new Error(m); };
const igual = (a, b, m) => assert(JSON.stringify(a) === JSON.stringify(b), `${m}\n      esperado: ${JSON.stringify(b)}\n      obtenido: ${JSON.stringify(a)}`);

console.log("\nGuardado del Registro en Firestore\n");

check("el campo vacío de la página se omite (con merge se conserva lo que había)", () => {
  const limpio = sinIndefinidos({ cursoId: "c", resumenEvaluacionesInstrumentos: undefined, area: "" });
  igual(Object.keys(limpio), ["cursoId", "area"], "sin la clave undefined; el texto vacío se queda");
});

check("anidados: mapas sin undefined, listas con null", () => {
  const limpio = sinIndefinidos({ notasEstudiantes: { ana: { competencias: [{ periodos: [{ p: 70, valorCalculado: undefined }] }], extra: [1, undefined] } } });
  igual(limpio, { notasEstudiantes: { ana: { competencias: [{ periodos: [{ p: 70 }] }], extra: [1, null] } } }, "limpieza profunda");
});

check("no toca Timestamps ni centinelas (objetos con clase)", () => {
  class Centinela { constructor() { this.x = undefined; } }
  const c = new Centinela();
  assert(sinIndefinidos({ updatedAt: c }).updatedAt === c, "misma instancia");
});

check("la página no sube evaluacionesInstrumentos (solo las escribe el puente)", () => {
  const remoto = payloadRemotoDePagina({ cursoId: "c", notasEstudiantes: {}, evaluacionesInstrumentos: { e1: {} } });
  igual(Object.keys(remoto), ["cursoId", "notasEstudiantes"], "sin evaluacionesInstrumentos");
});

console.log(`\n${pasos} ok, ${fallos} fallos\n`);
if (fallos) process.exit(1);
