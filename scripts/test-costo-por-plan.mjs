/**
 * test-costo-por-plan.mjs — Etapa D: costo de IA por plan (aiLogs.planId).
 *
 *  - camposCupo: solo escribe planId/claveCupo cuando hay planId; nunca
 *    inventa campos (los demás módulos siguen igual).
 *  - costoPorPlan: suma solo llamadas pagadas, cuenta rechazos pagados y fases
 *    fallidas, agrupa reintentos del mismo planId y da mín/mediana/media/máx.
 *  - Los registros de planificación sin planId quedan aparte (no se mezclan).
 *  - Las llamadas al registro de la unidad pasan el cupo (lectura del código).
 *
 * Ejecutar: node scripts/test-costo-por-plan.mjs
 */
import { readFileSync } from "node:fs";
import { camposCupo, costoPorPlan } from "../src/utils/costoPorPlan.js";

let pasos = 0, fallos = 0;
const check = (n, fn) => {
  try { fn(); pasos += 1; console.log(`  ✓ ${n}`); }
  catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); }
};
const igual = (a, b, msg = "") => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} esperado ${JSON.stringify(b)}, llegó ${JSON.stringify(a)}`);
};
const cerca = (a, b, msg = "") => {
  if (Math.abs(a - b) > 1e-9) throw new Error(`${msg} esperado ${b}, llegó ${a}`);
};

console.log("\n── camposCupo ──");
check("sin cupo → sin campos", () => {
  igual(camposCupo(null), {});
  igual(camposCupo(undefined), {});
  igual(camposCupo({}), {});
  igual(camposCupo({ planId: "" , clave: "x" }), {});
  igual(camposCupo({ planId: 123 }), {});
});
check("con cupo → planId y claveCupo", () => {
  igual(camposCupo({ planId: "p1", clave: "secundaria__2do__ingles" }), { planId: "p1", claveCupo: "secundaria__2do__ingles" });
  igual(camposCupo({ planId: "p1" }), { planId: "p1" });
});
check("recorta valores largos", () => {
  const r = camposCupo({ planId: "x".repeat(500), clave: "y".repeat(500) });
  igual([r.planId.length, r.claveCupo.length], [80, 200]);
});

console.log("\n── costoPorPlan ──");
const t = (min) => new Date(Date.UTC(2026, 10, 1, 15, min)).toISOString();
const logs = [
  // Plan A: 3 pagadas, 1 rechazo pagado, 1 "sin servicio" ($0), 1 fase fallida
  { planId: "A", claveCupo: "secundaria__2do__ingles", modulo: "planificacion", fecha: t(0), tokensEntrada: 1000, tokensSalida: 500, costoEstimado: "0.100000" },
  { planId: "A", modulo: "planificacion", fecha: t(1), etiqueta: "fase_a_parse_error", tokensSalida: 600, costoEstimado: "0.000000", error: "Redacción 4.4" },
  { planId: "A", modulo: "planificacion", fecha: t(1), etiqueta: "fase_a_parse_error", tokensSalida: 0, costoEstimado: "0.000000", error: "No hay ningún servicio" },
  { planId: "A", modulo: "planificacion", fecha: t(2), tokensEntrada: 1000, tokensSalida: 500, costoEstimado: "0.200000" },
  { planId: "A", modulo: "planificacion", fecha: t(3), etiqueta: "fase_redaccion_fallida", costoEstimado: "0.000000", error: "Fase sin redactar" },
  // Reanudación del mismo plan (mismo planId) más tarde
  { planId: "A", modulo: "planificacion", fecha: t(9), tokensEntrada: 1000, tokensSalida: 500, costoEstimado: "0.300000" },
  // Plan B: 1 pagada; un error del proveedor no cuenta
  { planId: "B", claveCupo: "secundaria__1ro__ingles", modulo: "planificacion", fecha: t(20), tokensEntrada: 10, tokensSalida: 10, costoEstimado: "0.050000" },
  { planId: "B", modulo: "planificacion", fecha: t(21), tokensEntrada: 0, tokensSalida: 0, costoEstimado: "0.000000", error: "HTTP 500" },
  // Plan C: solo una fase fallida (sin llamadas pagadas) → no entra al resumen
  { planId: "C", modulo: "planificacion", fecha: t(30), etiqueta: "fase_redaccion_fallida", costoEstimado: "0.000000", error: "x" },
  // Sin planId: planificación antigua y otro módulo
  { modulo: "planificacion", fecha: t(40), tokensEntrada: 5, tokensSalida: 5, costoEstimado: "0.700000" },
  { modulo: "planificacion-ia", fecha: t(41), tokensEntrada: 5, tokensSalida: 5, costoEstimado: "0.020000" },
  { modulo: "planificacion", fecha: t(42), cache: true, costoEstimado: "0.000000" },
];
const r = costoPorPlan(logs);
const A = r.planes.find((p) => p.planId === "A");
const B = r.planes.find((p) => p.planId === "B");
check("plan A: suma sus 3 llamadas pagadas (incluye la reanudación)", () => {
  igual(A.llamadas, 3);
  cerca(A.costo, 0.6);
  igual([A.tokensEntrada, A.tokensSalida], [3000, 1500]);
});
check("plan A: cuenta el rechazo pagado y la fase fallida, no el «sin servicio»", () => {
  igual([A.rechazadas, A.fasesFallidas], [1, 1]);
});
check("plan A: ventana de inicio a fin y clave del cupo", () => {
  igual([new Date(A.inicio).toISOString(), new Date(A.fin).toISOString()], [t(0), t(9)]);
  igual(A.claveCupo, "secundaria__2do__ingles");
});
check("plan B: el error del proveedor no se suma", () => {
  igual(B.llamadas, 1);
  cerca(B.costo, 0.05);
});
check("orden: del más reciente al más antiguo", () => {
  igual(r.planes.map((p) => p.planId), ["C", "B", "A"]);
});
check("resumen: solo planes con llamadas pagadas", () => {
  igual(r.resumen.planes, 2);
  cerca(r.resumen.minimo, 0.05);
  cerca(r.resumen.maximo, 0.6);
  cerca(r.resumen.mediana, 0.325);
  cerca(r.resumen.media, 0.325);
});
check("sin planId: solo llamadas pagadas de «planificacion», aparte", () => {
  igual(r.sinPlan.llamadas, 1);
  cerca(r.sinPlan.costo, 0.7);
});
check("acepta Timestamp de Firestore (toMillis/toDate)", () => {
  const ms = Date.UTC(2026, 10, 1);
  const x = costoPorPlan([
    { planId: "T", modulo: "planificacion", fecha: { toMillis: () => ms }, costoEstimado: "0.1" },
    { planId: "T", modulo: "planificacion", fecha: { toDate: () => new Date(ms + 60000) }, costoEstimado: "0.1" },
  ]);
  igual([x.planes[0].inicio, x.planes[0].fin], [ms, ms + 60000]);
});
check("lista vacía → resumen null", () => {
  const x = costoPorPlan([]);
  igual([x.planes.length, x.resumen, x.sinPlan.llamadas], [0, null, 0]);
});

console.log("\n── Cableado (lectura del código) ──");
const fase = readFileSync(new URL("../src/services/phaseAService.js", import.meta.url), "utf8");
const unidad = readFileSync(new URL("../src/services/unidadAprendizajeService.js", import.meta.url), "utf8");
const usage = readFileSync(new URL("../src/services/ai/usage.js", import.meta.url), "utf8");
check("phaseAService: todo logParseError y el logUsage de la unidad pasan el cupo", () => {
  const llamadas = fase.match(/await logParseError\(\{[\s\S]*?\}\);/g) || [];
  if (llamadas.length < 6) throw new Error(`solo ${llamadas.length} llamadas a logParseError`);
  const sin = llamadas.filter((c) => !c.includes("cupo: spec.cupoGeneracion"));
  if (sin.length) throw new Error(`${sin.length} logParseError sin cupo`);
  if (!/logUsage\(\{[\s\S]*?cupo: spec\.cupoGeneracion,[\s\S]*?\}\);/.test(fase)) throw new Error("logUsage sin cupo");
});
check("unidadAprendizajeService: caída a base curricular y fase fallida pasan el cupo", () => {
  if (!/logCaidaBaseCurricular\(\{[\s\S]*?cupo: contexto\.cupoGeneracion,[\s\S]*?\}\);/.test(unidad)) throw new Error("logCaidaBaseCurricular sin cupo");
  if (!/logFaseRedaccionFallida\(\{[^}]*cupo: contexto\.cupoGeneracion/.test(unidad)) throw new Error("logFaseRedaccionFallida sin cupo");
});
check("usage.js: los tres registros escriben camposCupo(cupo)", () => {
  const n = (usage.match(/\.\.\.camposCupo\(cupo\),/g) || []).length;
  igual(n, 3, "camposCupo en usage.js:");
});

console.log(`\n${pasos} pasos, ${fallos} fallos`);
if (fallos) process.exit(1);
