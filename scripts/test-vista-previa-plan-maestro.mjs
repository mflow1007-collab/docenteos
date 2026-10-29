/**
 * test-vista-previa-plan-maestro.mjs — Etapa 3 (docs/DISENO_CORAZON_DOCENTEOS.md, sección 6).
 *
 * Con la malla REAL de Inglés 2do: el formulario de unidad + los ajustes del
 * docente se convierten en un plan maestro; cada ajuste (estrategia, unir,
 * subdividir, sesiones, competencias, indicadores, aspectos) llega al plan; y
 * lo que falta o no cuadra sale como error visible.
 *
 * Ejecutar: node scripts/test-vista-previa-plan-maestro.mjs
 */
import { readFileSync } from "node:fs";
import {
  PLAN_MAESTRO_INICIAL, calcularVistaPrevia, resolverIndicadoresEstructurados, competenciasDeMalla,
  temasDeLaUnidad, elegirEstrategia, alternarUnionConSiguiente, fijarPartes, fijarSesiones,
  repartirDeNuevo, alternarCompetencia, alternarIndicador, alternarAspecto,
} from "../src/services/vistaPreviaPlanMaestroService.js";
import { INDICADORES_INGLES_2DO_ESTRUCTURADOS as IND } from "../src/data/indicadoresIngles2doEstructurados.js";

let pasos = 0, fallos = 0;
const check = (n, fn) => { try { fn(); pasos += 1; console.log(`  ✓ ${n}`); } catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); } };
const assert = (c, m) => { if (!c) throw new Error(m); };
const igual = (a, b, m) => assert(JSON.stringify(a) === JSON.stringify(b), `${m}\n      esperado: ${JSON.stringify(b)}\n      obtenido: ${JSON.stringify(a)}`);

const malla = JSON.parse(readFileSync(new URL("../src/data/curriculo/mallas/malla_ingles_2do_secundaria_2023.json", import.meta.url), "utf8"));

const datosBase = (planMaestro) => ({
  titulo: "Escuela y educación",
  temasSeleccionados: ["Escuela y educación", "Vivienda, entorno y ciudad"],
  numSemanas: 4, diasClase: ["Lunes", "Martes", "Miércoles", "Jueves"], horasPorDia: 1,
  productoFinalTexto: "una guía de la escuela para estudiantes nuevos",
  planMaestro,
});
let pm = elegirEstrategia(PLAN_MAESTRO_INICIAL, "proyectos");
pm = alternarCompetencia(pm, "ING-2-C01", IND);
const vista = (p, extra = {}) => calcularVistaPrevia({ datos: { ...datosBase(p), ...extra }, mallaPayload: malla });

console.log("\n[Vista previa del plan maestro — Inglés 2do]");

check("la malla de Inglés 2do se reconoce y trae sus 7 competencias", () => {
  const e = resolverIndicadoresEstructurados(malla);
  assert(e && e.indicadores.length === 21, "esperaba los 21 indicadores estructurados");
  igual(competenciasDeMalla(malla, e.indicadores).map((c) => c.id), ["ING-2-C01", "ING-2-C02", "ING-2-C03", "ING-2-C04", "ING-2-C05", "ING-2-C06", "ING-2-C07"], "competencias");
});

check("plan con el formulario: 16 sesiones, 7 fases, temas de la unidad", () => {
  const { plan, error } = vista(pm);
  assert(!error, error);
  igual(plan.horario.totalSesiones, 16, "total");
  igual(plan.fases.length, 7, "fases");
  igual(plan.temas, ["Escuela y educación", "Vivienda, entorno y ciudad"], "temas");
  igual(plan.fases.reduce((s, f) => s + f.sesiones, 0), 16, "suma de sesiones");
});

check("sin temas combinados, el tema es el título", () => {
  igual(temasDeLaUnidad({ titulo: " Escuela y educación ", temasSeleccionados: [] }), ["Escuela y educación"], "tema");
});

check("al marcar una competencia entran todos sus indicadores; al quitarla salen con sus aspectos", () => {
  const ids = IND.filter((i) => i.competenciaId === "ING-2-C01").map((i) => i.id);
  igual(pm.indicadoresElegidos, ids, "indicadores de C01");
  const i01 = IND.find((i) => i.id === "ING-2-I01");
  const conAspecto = alternarAspecto(pm, i01, 0, "intereses");
  const sin = alternarCompetencia(conAspecto, "ING-2-C01", IND);
  igual(sin.competenciasElegidas, [], "competencias");
  igual(sin.indicadoresElegidos, [], "indicadores");
  igual(sin.aspectosElegidos, {}, "aspectos");
});

check("los aspectos se guardan en el orden literal de la malla y llegan al plan", () => {
  const i01 = IND.find((i) => i.id === "ING-2-I01");
  let p = alternarAspecto(pm, i01, 0, "planes");
  p = alternarAspecto(p, i01, 0, "actividades cotidianas");
  igual(p.aspectosElegidos["ING-2-I01"], [["actividades cotidianas", "planes"]], "orden literal");
  const { plan, error } = vista(p);
  assert(!error, error);
  const ind = plan.fases.flatMap((f) => f.indicadores).find((i) => i.id === "ING-2-I01");
  igual(ind.aspectosElegidos, [["actividades cotidianas", "planes"]], "aspectos en el plan");
  igual(alternarAspecto(p, i01, 0, "planes").aspectosElegidos["ING-2-I01"], [["actividades cotidianas"]], "desmarcar");
});

check("quitar un indicador lo saca del plan", () => {
  const p = alternarIndicador(pm, "ING-2-I02");
  const { plan, error } = vista(p);
  assert(!error, error);
  assert(!plan.fases.some((f) => f.indicadores.some((i) => i.id === "ING-2-I02")), "I02 sigue en el plan");
});

check("unir y separar fases contiguas", () => {
  let p = alternarUnionConSiguiente(pm, 1);
  igual(p.unir, [[1, 2]], "unir 1-2");
  p = alternarUnionConSiguiente(p, 2);
  igual(p.unir, [[1, 2, 3]], "unir 1-2-3");
  igual(alternarUnionConSiguiente(p, 1).unir, [[2, 3]], "separar 1 de 2");
  const { plan, error } = vista(alternarUnionConSiguiente(pm, 1));
  assert(!error, error);
  igual(plan.fases.length, 6, "6 fases tras unir 1-2");
  igual(plan.fases[0].nombre, "Visión compartida y análisis de saberes previos", "nombre unido");
});

check("subdividir una fase y, al unirla, se quita la subdivisión", () => {
  const p = fijarPartes(pm, 5, 2);
  const { plan, error } = vista(p);
  assert(!error, error);
  igual(plan.fases.length, 8, "8 fases");
  assert(plan.fases.some((f) => f.nombre === "Aplicación (2/2)"), "falta Aplicación (2/2)");
  igual(alternarUnionConSiguiente(p, 4).subdividir, {}, "subdivisión quitada");
});

check("sesiones fijadas: cuadran → se respetan; no cuadran → error visible", () => {
  const { plan } = vista(pm);
  const masUna = fijarSesiones(pm, plan, 0, plan.fases[0].sesiones + 1);
  const r = vista(masUna);
  assert(r.error && /suman 17 y el horario da 16/.test(r.error), `error esperado, recibido: ${r.error}`);
  let ajustado = fijarSesiones(masUna, plan, 4, plan.fases[4].sesiones - 1);
  const ok = vista(ajustado);
  assert(!ok.error, ok.error);
  igual(ok.plan.fases[0].sesiones, plan.fases[0].sesiones + 1, "fase 1 fijada");
  ajustado = repartirDeNuevo(ajustado);
  igual(vista(ajustado).plan.fases.map((f) => f.sesiones), plan.fases.map((f) => f.sesiones), "reparto de nuevo");
});

check("cambiar la estrategia reinicia la forma de las fases", () => {
  const p = elegirEstrategia(fijarPartes(alternarUnionConSiguiente(pm, 1), 5, 2), "problemas");
  igual([p.unir, p.subdividir, p.sesionesPorFase], [[], {}, null], "ajustes reiniciados");
  const { plan, error } = vista(p);
  assert(!error, error);
  igual(plan.estrategia.clave, "problemas", "estrategia");
});

check("errores visibles: sin estrategia, sin producto, sin competencia, estrategia sin papeles", () => {
  assert(/elige la estrategia/.test(vista({ ...pm, estrategia: "" }).error), "sin estrategia");
  assert(/falta el producto/.test(vista(pm, { productoFinalTexto: "  " }).error), "sin producto");
  assert(/ninguna competencia/.test(vista(alternarCompetencia(pm, "ING-2-C01", IND)).error), "sin competencia");
  assert(/papeles de fase aprobados/.test(vista(elegirEstrategia(pm, "estudio_caso")).error), "estrategia sin papeles");
});

check("tema que no es de la malla → error, nunca contenidos generales", () => {
  const r = vista(pm, { temasSeleccionados: [], titulo: "Tema inventado xyz" });
  assert(r.error && /no tiene contenidos propios/.test(r.error), `error esperado, recibido: ${r.error}`);
});

check("malla sin estructura → no disponible; malla incompleta → error", () => {
  const otra = { ...malla, indicadoresLogro: [{ id: "MAT-1-I01", descripcion: "x" }], indicadores: [] };
  igual(calcularVistaPrevia({ datos: datosBase(pm), mallaPayload: otra }).noDisponible, true, "no disponible");
  const incompleta = { ...malla, indicadoresLogro: malla.indicadoresLogro.slice(0, 20) };
  assert(/no trae ING-2-I21/.test(calcularVistaPrevia({ datos: datosBase(pm), mallaPayload: incompleta }).error), "incompleta");
  assert(/no hay malla/.test(calcularVistaPrevia({ datos: datosBase(pm), mallaPayload: null }).error), "sin malla");
});

console.log(`\n${pasos} pasaron · ${fallos} fallaron`);
if (fallos) process.exit(1);
