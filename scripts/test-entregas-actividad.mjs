/**
 * F3 — Entregas por actividad (src/services/actividadesPlan.js).
 *
 * Ejecutar:  node scripts/test-entregas-actividad.mjs
 *
 * Cubre la lógica pura: estados (decisión 2), alternar la marca, enlace como
 * evidencia única por actividad + estudiante, resumen y lo que ve la ficha.
 * Lo que NO cubre: la escritura en Firestore (marcarEntrega) ni las pantallas;
 * se comprueban en el navegador.
 */

import {
  actividadesDeEstudiante, alternarEstadoEntrega, aplicarEntrega, construirEvidenciaDeEntrega,
  crearEvidenciaEntregaId, resumenEntregas,
} from "../src/services/actividadesPlan.js";

let pasos = 0, fallos = 0;
const check = (n, fn) => { try { fn(); pasos += 1; console.log(`  ✓ ${n}`); } catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); } };
const assert = (c, m) => { if (!c) throw new Error(m); };
const igual = (a, b, m) => assert(JSON.stringify(a) === JSON.stringify(b), `${m}\n      esperado: ${JSON.stringify(b)}\n      obtenido: ${JSON.stringify(a)}`);
const lanza = (fn, patron, m) => {
  try { fn(); } catch (e) { assert(patron.test(e.message), `${m}: mensaje inesperado "${e.message}"`); return; }
  throw new Error(`${m}: no lanzó error`);
};

const AHORA = "2026-11-05T14:00:00.000Z";
const actividad = {
  id: "act-plan1-f3", planificacionId: "plan1", cursoId: "curso-2do-a", faseNumero: 3, faseNombre: "Investigación",
  claseId: "clase-s2-d1", instrumentoId: "ins-plan1-actividad-f3", indicadorIds: ["ING-2-I01", "ING-2-I02"],
  entrega: { texto: "Mapa de la escuela con rótulos" }, fechaPrevista: "2026-11-10", fechaAjustada: null, activa: true,
  entregas: {
    "est-ana-0": { estado: "pendiente", nombre: "Ana" },
    "est-ricardo-1": { estado: "pendiente", nombre: "Ricardo" },
  },
};

console.log("\nF3 — Entregas por actividad");

check("marcar Entregó guarda estado, nombre y hora; Pendiente borra la hora", () => {
  const e = aplicarEntrega(actividad.entregas["est-ana-0"], { estado: "entrego", ahora: AHORA });
  igual(e, { estado: "entrego", nombre: "Ana", marcadaEn: AHORA, enlace: "" }, "entrega de Ana");
  igual(aplicarEntrega(e, { estado: "pendiente", ahora: AHORA }).marcadaEn, null, "pendiente sin hora");
});

check("pulsar la marca que ya tiene la quita (vuelve a pendiente); otra la cambia", () => {
  igual(alternarEstadoEntrega("entrego", "entrego"), "pendiente", "misma marca");
  igual(alternarEstadoEntrega("entrego", "excusa"), "excusa", "otra marca");
  igual(alternarEstadoEntrega("pendiente", "no_entrego"), "no_entrego", "desde pendiente");
});

check("solo estados de la decisión 2: «Entregó tarde» u otro inventado falla visible", () => {
  lanza(() => aplicarEntrega({}, { estado: "entrego_tarde" }), /inválido/, "estado inventado");
});

check("el enlace se valida, se conserva al cambiar el estado y \"\" lo quita", () => {
  lanza(() => aplicarEntrega({}, { enlace: "drive/archivo" }), /http/, "enlace sin http");
  const conEnlace = aplicarEntrega({ estado: "entrego", nombre: "Ana" }, { enlace: " https://drive.google.com/x ", ahora: AHORA });
  igual(conEnlace.enlace, "https://drive.google.com/x", "enlace limpio");
  igual(conEnlace.estado, "entrego", "guardar enlace no cambia el estado");
  igual(aplicarEntrega(conEnlace, { estado: "excusa", ahora: AHORA }).enlace, "https://drive.google.com/x", "se conserva");
  igual(aplicarEntrega(conEnlace, { enlace: "" }).enlace, "", "se quita");
});

check("guardar solo el enlace no mueve la hora de la marca", () => {
  const marcada = aplicarEntrega({ nombre: "Ana" }, { estado: "entrego", ahora: "2026-11-05T10:00:00.000Z" });
  igual(aplicarEntrega(marcada, { enlace: "https://x.org/a", ahora: AHORA }).marcadaEn, "2026-11-05T10:00:00.000Z", "hora original");
});

check("evidencia: UNA por actividad + estudiante (ID determinista), vinculada a plan, clase e indicadores", () => {
  const entrega = aplicarEntrega(actividad.entregas["est-ana-0"], { estado: "entrego", enlace: "https://x.org/ana", ahora: AHORA });
  const ev = construirEvidenciaDeEntrega(actividad, "est-ana-0", entrega, { ahora: AHORA });
  igual(ev.id, crearEvidenciaEntregaId("act-plan1-f3", "est-ana-0"), "ID determinista");
  igual(ev.id, "evi-act-act-plan1-f3__est-ana-0", "formato del ID");
  igual([ev.tipo, ev.cursoId, ev.planificacionId, ev.claseId, ev.actividadId], ["entrega_actividad", "curso-2do-a", "plan1", "clase-s2-d1", "act-plan1-f3"], "vínculos");
  igual(ev.indicadorIds, ["ING-2-I01", "ING-2-I02"], "indicadores de la fase");
  igual(ev.enlace, "https://x.org/ana", "enlace");
  assert(!("calificacion" in ev) && !("calificacionAsociada" in ev), "la entrega no es nota (decisión 3)");
  const otra = construirEvidenciaDeEntrega(actividad, "est-ana-0", { ...entrega, enlace: "https://x.org/ana2" });
  igual(otra.id, ev.id, "volver a guardar actualiza la misma evidencia");
});

check("sin enlace no hay evidencia", () => {
  igual(construirEvidenciaDeEntrega(actividad, "est-ana-0", { estado: "entrego", enlace: "" }), null, "sin enlace");
});

check("resumen por estado (sin estado conocido = pendiente)", () => {
  igual(resumenEntregas({
    a: { estado: "entrego" }, b: { estado: "no_entrego" }, c: { estado: "excusa" }, d: { estado: "pendiente" }, e: {},
  }), { pendiente: 2, entrego: 1, no_entrego: 1, excusa: 1, total: 5 }, "resumen");
});

check("ficha: el estudiante ve sus actividades activas por fecha, también con ID legado", () => {
  const f1 = { ...actividad, id: "act-plan1-f1", faseNumero: 1, faseNombre: "Lanzamiento", fechaPrevista: "2026-11-03",
    entregas: { "est-ana-0": { estado: "entrego", nombre: "Ana", enlace: "https://x.org/a" }, "est-ricardo-1": { estado: "pendiente", nombre: "Ricardo" } } };
  const f2 = { ...actividad, id: "act-plan1-f2", faseNumero: 2, activa: false };
  const f3 = { ...actividad, fechaAjustada: "2026-11-12" };
  const ana = actividadesDeEstudiante([f3, f2, f1], ["est-ana-0"]);
  igual(ana.map((a) => [a.faseNumero, a.fecha, a.estado, a.enlace]), [[1, "2026-11-03", "entrego", "https://x.org/a"], [3, "2026-11-12", "pendiente", ""]], "Ana");
  const legado = actividadesDeEstudiante([f1], ["est-ricardo-1-nuevo", "est-ricardo-1"]);
  igual(legado.map((a) => a.estado), ["pendiente"], "Ricardo por ID legado");
  igual(actividadesDeEstudiante([f1], ["otro"]), [], "estudiante de otro curso");
});

console.log(`\n${fallos ? "❌" : "✅"} ${pasos}/${pasos + fallos} pruebas de entregas`);
if (fallos) process.exit(1);
