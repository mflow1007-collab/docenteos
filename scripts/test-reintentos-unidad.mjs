/**
 * test-reintentos-unidad.mjs — Etapa D: menos rechazos pagados en la unidad.
 *
 *  A) Regla 4.4: el verbo se compara sin tildes ni mayúsculas (la lista no
 *     cambia): «Evaluan» / «Coevaluan» pasan; «Guardan» sigue rechazado.
 *  C) R12: el ejemplo de formato del prompt ya no nombra «Role Play» y el
 *     prompt lista las técnicas ya usadas en el bloque como prohibidas.
 *  D) Gateway: Abacus corta a los 24 s como el resto (bajo el muro de ~25 s).
 *  Secciones: el prompt da las secciones de cada clase como lista JSON y el
 *     validador, la validación de fase y el guardado las separan si llegan
 *     unidas con « · » (12 rechazos pagados en producción).
 *
 * Ejecutar: node scripts/test-reintentos-unidad.mjs
 */
import { readFileSync } from "node:fs";
import { motivoRedaccionActividad, nivelVerbo } from "../src/services/redaccionFaseService.js";

let pasos = 0, fallos = 0;
const check = (n, fn) => {
  try { fn(); pasos += 1; console.log(`  ✓ ${n}`); }
  catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); }
};
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };

console.log("\n── A) Regla 4.4 sin tildes ni mayúsculas ──");
const cola = "el borrador de la sección con la lista de cotejo y lo archivan en el portafolio del equipo.";
check("«Evaluan» (sin tilde) pasa como «Evalúan» y conserva su nivel", () => {
  ok(motivoRedaccionActividad(`Evaluan ${cola}`) === "", "rechazado");
  ok(nivelVerbo(`Evaluan ${cola}`) === "autonomo", `nivel ${nivelVerbo(`Evaluan ${cola}`)}`);
});
check("«Coevaluan» y «Co-evalúan» pasan", () => {
  ok(motivoRedaccionActividad(`Coevaluan (en parejas) ${cola}`) === "", "Coevaluan");
  ok(motivoRedaccionActividad(`Co-evalúan (en parejas) ${cola}`) === "", "Co-evalúan");
});
check("verbo de idioma y de gestión sin tilde también pasan", () => {
  ok(motivoRedaccionActividad(`Senalan ${cola}`, { esIdioma: true }) === "", "Senalan");
  ok(motivoRedaccionActividad(`REVISAN ${cola}`) === "", "REVISAN");
});
check("un verbo fuera de la lista sigue rechazado (la lista no cambia)", () => {
  for (const v of ["Guardan", "Archivan", "Participan", "Realizan"]) {
    ok(/no está en la lista de verbos/.test(motivoRedaccionActividad(`${v} ${cola}`)), v);
  }
});
check("la regla de la organización sigue igual", () => {
  ok(/va entre paréntesis/.test(motivoRedaccionActividad(`Evaluan en parejas ${cola}`)), "no avisó");
});

console.log("\n── C) R12 en el prompt de la fase ──");
const fase = readFileSync(new URL("../src/services/phaseAService.js", import.meta.url), "utf8");
const regla9 = (fase.match(/\n9\. "actividadCLT"[^\n]*/) || [""])[0];
check("el ejemplo de formato ya no nombra «Role Play»", () => {
  ok(regla9, "no se encontró la regla 9");
  ok(!/\(en parejas, Role Play\)/.test(regla9), "sigue el ejemplo con Role Play");
  ok(/<nombre de la técnica>/.test(regla9), "falta el ejemplo neutro");
});
check("lista las técnicas ya usadas en el bloque como prohibidas", () => {
  ok(/PROHIBIDAS en este bloque/.test(regla9), "falta la lista de prohibidas");
  ok(/m\.semana === semanaNum && m\.actividadCLT/.test(fase), "no filtra por el bloque actual");
  ok(/cada clase de este lote usa una técnica distinta/.test(regla9), "falta la regla del lote");
});

console.log("\n── D) Corte de tiempo de Abacus ──");
const gateway = readFileSync(new URL("../api/ai/generate.js", import.meta.url), "utf8");
check("Abacus corta a los 24 s en generación (PDF sigue a 30 s)", () => {
  ok(/case "abacus":\s+return esExtraccionPdf \? 30_000 : 24_000;/.test(gateway), "abacus no está a 24 s");
});
check("ningún proveedor pasa de 24 s en generación (muro de ~25 s)", () => {
  const cortes = [...gateway.matchAll(/return esExtraccionPdf \? \d+_000 : (\d+)_000;/g)].map((m) => Number(m[1]));
  ok(cortes.length >= 6, `solo ${cortes.length} cortes`);
  ok(cortes.every((s) => s <= 24), `cortes: ${cortes.join(", ")}`);
});

console.log("\n── Secciones de la clase ──");
check("el prompt da las secciones de cada clase como lista JSON, no unidas con « · »", () => {
  ok(/Clase \$\{startDia \+ i\}: \$\{JSON\.stringify\(c\.seccionesPorClase/.test(fase), "no usa JSON.stringify");
  ok(!/seccionesPorClase\?\.\[startDia \+ i - 1\] \|\| \[\]\)\.join\(' · '\)/.test(fase), "sigue uniendo con « · »");
  ok(/una cadena por sección/.test(fase), "falta la instrucción");
});
const redaccion = readFileSync(new URL("../src/services/redaccionFaseService.js", import.meta.url), "utf8");
const unidad = readFileSync(new URL("../src/services/unidadAprendizajeService.js", import.meta.url), "utf8");
check("validador de lote, validación de fase y guardado usan seccionesDeClase", () => {
  ok(/const suyas = seccionesDeClase\(clase\?\.seccionesProducto, secciones\)/.test(redaccion), "lote");
  ok(/seccionesDeClase\(c\?\.seccionesProducto, contrato\.secciones\)/.test(redaccion), "fase completa");
  ok(/dia\.seccionesProducto = seccionesDeClase\(aiClase\.seccionesProducto, contratoFase\.secciones\)/.test(unidad), "guardado");
});

console.log(`\n${pasos} pasos, ${fallos} fallos`);
if (fallos) process.exit(1);
