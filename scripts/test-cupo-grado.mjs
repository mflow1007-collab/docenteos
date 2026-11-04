/**
 * test-cupo-grado.mjs — Etapa E: límite de planes por grado + asignatura.
 *
 *  - Clave del cupo: nivel__grado__asignatura; fail-closed si falta algo.
 *  - La expresión de src/utils/cupoGrado.js es la MISMA que la de
 *    firestore.rules, y acepta todas las combinaciones del formulario.
 *  - Desbloqueo: penúltima semana desde máx(generación, inicio), con piso de
 *    14 días desde la generación.
 *  - Estado: libre / bloqueado / reintento (mismo tema < 24 h) / ilimitado.
 *  - Descuento de crédito: solo campos numéricos, en el orden del resolver.
 *  - Gateway: verificarCupoUnidad acepta el permiso válido y rechaza el
 *    inexistente, el de otro plan y el vencido (sin red: fetch simulado).
 *
 * Ejecutar: node scripts/test-cupo-grado.mjs
 */
import { readFileSync } from "node:fs";
import {
  claveCupoGrado, calcularDesbloqueo, evaluarCupo, parcheDescuentoCredito,
  REGEX_CLAVE_CUPO, SEMANA_MS,
} from "../src/utils/cupoGrado.js";
import { AREA_ASIGNATURAS } from "../src/planning/areaAsignaturaMap.js";

process.env.FIREBASE_PROJECT_ID = "docenteos-test";
const { verificarCupoUnidad } = await import("../api/ai/generate.js");

let pasos = 0, fallos = 0;
const check = async (n, fn) => {
  try { await fn(); pasos += 1; console.log(`  ✓ ${n}`); }
  catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); }
};
const igual = (a, b, msg = "") => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} esperado ${JSON.stringify(b)}, llegó ${JSON.stringify(a)}`);
};
const DIA = 24 * 60 * 60 * 1000;

console.log("Clave del cupo");
await check("Secundaria · 2do Secundaria · Inglés", () =>
  igual(claveCupoGrado({ nivel: "Secundaria", grado: "2do Secundaria", asignatura: "Inglés" }).clave, "secundaria__2do-secundaria__ingles"));
await check("las secciones no cambian la clave (comparten cupo)", () => {
  const a = claveCupoGrado({ nivel: "Primaria", grado: "3ro Primaria", asignatura: "Matemática", seccion: "A" });
  const b = claveCupoGrado({ nivel: "Primaria", grado: "3ro Primaria", asignatura: "Matemática", seccion: "B" });
  igual(a.clave, b.clave);
});
await check("asignaturas distintas del mismo grado = cupos distintos", () => {
  const a = claveCupoGrado({ nivel: "Primaria", grado: "3ro Primaria", asignatura: "Matemática" }).clave;
  const b = claveCupoGrado({ nivel: "Primaria", grado: "3ro Primaria", asignatura: "Lengua Española" }).clave;
  if (a === b) throw new Error("misma clave");
});
await check("sin asignatura → error visible", () => {
  const r = claveCupoGrado({ nivel: "Secundaria", grado: "2do Secundaria", asignatura: "" });
  igual(r.ok, false);
  if (!/asignatura/.test(r.error)) throw new Error(r.error);
});
await check("asignatura fuera de la lista → error visible", () =>
  igual(claveCupoGrado({ nivel: "Secundaria", grado: "2do Secundaria", asignatura: "Robótica" }).ok, false));

await check("la expresión de cupoGrado.js es la de firestore.rules", () => {
  const reglas = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
  const m = /return clave\.matches\('([^']+)'\)/.exec(reglas);
  if (!m) throw new Error("no se encontró claveCupoValida en firestore.rules");
  igual(m[1], REGEX_CLAVE_CUPO.source);
});
await check("todas las combinaciones del formulario producen clave válida", () => {
  const form = readFileSync(new URL("../src/components/FormularioUnidadAprendizaje.jsx", import.meta.url), "utf8");
  const grados = [...form.matchAll(/\{ grado: "([^"]+)", nivel: "([^"]+)" \}/g)].map((x) => ({ grado: x[1], nivel: x[2] }));
  if (grados.length < 15) throw new Error(`solo ${grados.length} grados leídos`);
  const asignaturas = Object.values(AREA_ASIGNATURAS).flat();
  const malas = [];
  for (const g of grados) for (const asignatura of asignaturas) {
    const r = claveCupoGrado({ ...g, asignatura });
    if (!r.ok) malas.push(`${g.grado}/${asignatura}`);
  }
  igual(malas, []);
});

console.log("\nDesbloqueo");
const gen = new Date(2026, 10, 2, 8, 0); // lunes 2 nov 2026
await check("4 semanas desde hoy → piso de 14 días (penúltima = semana 3)", () =>
  igual(calcularDesbloqueo({ generadoEn: gen, fechaInicio: "2026-11-02", numSemanas: 4 }).getTime(), gen.getTime() + 14 * DIA));
await check("6 semanas → inicio de la semana 5 (28 días)", () =>
  igual(calcularDesbloqueo({ generadoEn: gen, fechaInicio: "2026-11-02", numSemanas: 6 }).getTime(), gen.getTime() + 4 * SEMANA_MS));
await check("1 o 2 semanas → nunca antes de 14 días", () => {
  igual(calcularDesbloqueo({ generadoEn: gen, numSemanas: 1 }).getTime(), gen.getTime() + 14 * DIA);
  igual(calcularDesbloqueo({ generadoEn: gen, numSemanas: 2 }).getTime(), gen.getTime() + 14 * DIA);
});
await check("inicio futuro: se cuenta desde el inicio", () => {
  const d = calcularDesbloqueo({ generadoEn: gen, fechaInicio: "2026-11-16", numSemanas: 4 });
  igual(d.getTime(), new Date(2026, 10, 16).getTime() + 2 * SEMANA_MS);
});
await check("inicio pasado: se cuenta desde la generación", () =>
  igual(calcularDesbloqueo({ generadoEn: gen, fechaInicio: "2026-10-01", numSemanas: 6 }).getTime(), gen.getTime() + 4 * SEMANA_MS));
await check("sin fecha de generación → lanza", () => {
  let lanzo = false;
  try { calcularDesbloqueo({ numSemanas: 4 }); } catch { lanzo = true; }
  igual(lanzo, true);
});

console.log("\nEstado del cupo");
const ahora = new Date(2026, 10, 10);
const cupoActivo = { planId: "p1", tituloNormalizado: "my family", generadoEn: new Date(2026, 10, 2), desbloqueoEn: new Date(2026, 10, 16) };
await check("sin cupo → libre", () => igual(evaluarCupo({ cupo: null, ahora }).estado, "libre"));
await check("antes del desbloqueo → bloqueado", () => igual(evaluarCupo({ cupo: cupoActivo, ahora, tituloNormalizado: "otro" }).estado, "bloqueado"));
await check("después del desbloqueo → libre", () =>
  igual(evaluarCupo({ cupo: cupoActivo, ahora: new Date(2026, 10, 16, 1), tituloNormalizado: "otro" }).estado, "libre"));
await check("ilimitado manda", () => igual(evaluarCupo({ cupo: cupoActivo, ahora, ilimitado: true }).estado, "ilimitado"));
await check("mismo tema < 24 h → reintento con el mismo planId", () => {
  const r = evaluarCupo({ cupo: cupoActivo, ahora: new Date(2026, 10, 2, 20), tituloNormalizado: "my family" });
  igual([r.estado, r.planId], ["reintento", "p1"]);
});
await check("mismo tema > 24 h → bloqueado", () =>
  igual(evaluarCupo({ cupo: cupoActivo, ahora: new Date(2026, 10, 4), tituloNormalizado: "my family" }).estado, "bloqueado"));
await check("acepta Timestamp de Firestore (toDate)", () => {
  const ts = (d) => ({ toDate: () => d });
  igual(evaluarCupo({ cupo: { ...cupoActivo, generadoEn: ts(cupoActivo.generadoEn), desbloqueoEn: ts(cupoActivo.desbloqueoEn) }, ahora, tituloNormalizado: "x" }).estado, "bloqueado");
});

console.log("\nDescuento de crédito");
await check("descuenta del primer campo numérico", () =>
  igual(parcheDescuentoCredito({ creditosPlanificacionDisponibles: 3, creditos: 9 }), { creditosPlanificacionDisponibles: 2 }));
await check("usa creditos si es el único", () => igual(parcheDescuentoCredito({ creditos: 1 }), { creditos: 0 }));
await check("sin créditos → null", () => {
  igual(parcheDescuentoCredito({}), null);
  igual(parcheDescuentoCredito({ creditosPlanificacionDisponibles: 0, creditos: 4 }), null);
});

console.log("\nGateway: permiso del cupo");
const fetchOriginal = globalThis.fetch;
const conFirestore = (respuesta) => {
  globalThis.fetch = async (url) => {
    if (!String(url).includes("/usuarios/u1/cuposGrado/secundaria__2do-secundaria__ingles")) throw new Error(`URL inesperada ${url}`);
    return respuesta;
  };
};
const docCupo = (planId, generadoEn) => new Response(JSON.stringify({
  fields: { planId: { stringValue: planId }, generadoEn: { timestampValue: generadoEn } },
}), { status: 200 });
const permiso = { planId: "p1", clave: "secundaria__2do-secundaria__ingles" };
const t0 = Date.parse("2026-11-02T12:00:00Z");
await check("permiso válido → null", async () => {
  conFirestore(docCupo("p1", "2026-11-02T10:00:00Z"));
  igual(await verificarCupoUnidad(permiso, "u1", "tok", t0), null);
});
await check("sin cupo → 403", async () => {
  conFirestore(new Response("{}", { status: 404 }));
  igual((await verificarCupoUnidad(permiso, "u1", "tok", t0))?.status, 403);
});
await check("cupo de otro plan → 403", async () => {
  conFirestore(docCupo("p2", "2026-11-02T10:00:00Z"));
  igual((await verificarCupoUnidad(permiso, "u1", "tok", t0))?.status, 403);
});
await check("permiso vencido (> 24 h) → 403", async () => {
  conFirestore(docCupo("p1", "2026-10-31T10:00:00Z"));
  igual((await verificarCupoUnidad(permiso, "u1", "tok", t0))?.status, 403);
});
await check("Firestore caído → 503 (pasajero, no 403)", async () => {
  conFirestore(new Response("{}", { status: 500 }));
  igual((await verificarCupoUnidad(permiso, "u1", "tok", t0))?.status, 503);
});
await check("clave con ruta inyectada → 400 sin llamar a Firestore", async () => {
  globalThis.fetch = async () => { throw new Error("no debía llamar"); };
  igual((await verificarCupoUnidad({ planId: "p1", clave: "../../config/x" }, "u1", "tok", t0))?.status, 400);
});
globalThis.fetch = fetchOriginal;

console.log(`\n${pasos} ok, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
