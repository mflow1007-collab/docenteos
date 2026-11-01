/**
 * test-plan-maestro-rapido.mjs — Modo rápido del plan maestro (2026-11-01).
 *
 * Con solo el título, DocenteOS prellena el plan maestro sin IA y la unidad se
 * puede generar: situación propuesta del tema (o un borrador marcado), la
 * estrategia que recomienda la Guía 1.2.4, la competencia Comunicativa con sus
 * indicadores, producto y secciones. Nunca pisa lo que el docente cambió.
 * Malla REAL de Inglés 2do.
 *
 * Ejecutar: node scripts/test-plan-maestro-rapido.mjs
 */
import { readFileSync } from "node:fs";
import {
  prellenarPlanMaestro, debePrellenarPlanMaestro, planMaestroSinTocar, estadoPlanMaestroParaGenerar,
  resolverIndicadoresEstructurados, competenciasDeMalla, PLAN_MAESTRO_INICIAL,
} from "../src/services/vistaPreviaPlanMaestroService.js";
import {
  fijarCampoSituacion, seccionesSugeridas, productoSugerido, borradorSituacion, validarSituacion,
} from "../src/services/situacionAprendizajeService.js";

let pasos = 0, fallos = 0;
const check = (n, fn) => { try { fn(); pasos += 1; console.log(`  ✓ ${n}`); } catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); } };
const assert = (c, m) => { if (!c) throw new Error(m); };
const igual = (a, b, m) => assert(JSON.stringify(a) === JSON.stringify(b), `${m}\n      esperado: ${JSON.stringify(b)}\n      obtenido: ${JSON.stringify(a)}`);

const malla = JSON.parse(readFileSync(new URL("../src/data/curriculo/mallas/malla_ingles_2do_secundaria_2023.json", import.meta.url), "utf8"));
const estructura = resolverIndicadoresEstructurados(malla);
const competencias = competenciasDeMalla(malla, estructura.indicadores);
const horario = { semanas: 4, diasClase: ["lunes", "martes", "miercoles"], horasPorDia: 1 };
const base = {
  grado: "2do Secundaria", asignatura: "Inglés", centro: "Centro Hector Francisco Lopez - Hato Nuevo",
  numSemanas: 4, diasClase: horario.diasClase, horasPorDia: 1,
};
const prellenar = (datos) => {
  const r = prellenarPlanMaestro({ datos, indicadores: estructura.indicadores, competencias });
  return { ...datos, ...r };
};
const estado = (datos) => estadoPlanMaestroParaGenerar({ datos, mallaPayload: malla, horario });

console.log("\n[Plan maestro — modo rápido]");

check("solo con el título la unidad queda lista para generar (tema sin situación propuesta)", () => {
  const d = prellenar({ ...base, titulo: "My family and friends" });
  const e = estado(d);
  assert(e.listo, `no quedó lista: ${e.falta}`);
  igual(d.productoFinalTexto, "My family and friends Booklet", "producto sugerido");
  igual(d.planMaestro.secciones, ["My family", "Friends"], "secciones desde el título");
  igual(d.planMaestro.estrategia, "proyectos", "estrategia recomendada por la Guía");
  assert(d.planMaestro.situacion.borrador, "la situación va marcada como borrador");
});

check("se elige la competencia Comunicativa con todos sus indicadores", () => {
  const d = prellenar({ ...base, titulo: "My family and friends" });
  const comunicativa = competencias.find((c) => /comunicativa/i.test(c.nombre));
  igual(d.planMaestro.competenciasElegidas, [comunicativa.id], "competencia");
  const suyos = estructura.indicadores.filter((i) => i.competenciaId === comunicativa.id).map((i) => i.id);
  igual(d.planMaestro.indicadoresElegidos, suyos, "indicadores de la competencia");
});

check("tema con situación propuesta: usa la semilla, su producto y sus secciones", () => {
  const d = prellenar({ ...base, titulo: "Escuela y educación" });
  assert(estado(d).listo, "no quedó lista");
  igual(d.productoFinalTexto, "Our School Survival Guide", "producto de la semilla");
  igual(d.planMaestro.situacion.semillaId, "ing2-escuela-guia", "semilla");
  assert(!d.planMaestro.situacion.borrador, "la semilla no es borrador");
});

check("el producto que escribió el docente se respeta", () => {
  const d = prellenar({ ...base, titulo: "My family and friends", productoFinalTexto: "My Family and Friends Album" });
  igual(d.productoFinalTexto, "My Family and Friends Album", "producto del docente");
  assert(estado(d).listo, "no quedó lista");
});

check("el borrador cumple la Guía 1.2.2 y nunca dice «no saben el idioma»", () => {
  const s = borradorSituacion({ ...base, titulo: "Daily routines" });
  const { errores } = validarSituacion({ situacion: s, producto: productoSugerido({ ...base, titulo: "Daily routines" }), estrategia: "proyectos" });
  igual(errores, [], "errores del borrador");
  assert(/en inglés/.test(s.problema) && !/no saben/i.test(s.problema), "problema como necesidad");
  assert(/el Centro Hector Francisco Lopez/.test(s.contexto), "nombra el centro del formulario");
});

check("secciones sugeridas: partes del título o presentación · tema · cierre", () => {
  igual(seccionesSugeridas({ titulo: "Food, drinks and health", asignatura: "Inglés" }), ["Food", "Drinks", "Health"], "varias partes");
  igual(seccionesSugeridas({ titulo: "Daily routines", asignatura: "Inglés" }), ["Introduction", "Daily routines", "Final Message"], "una idea, inglés");
  igual(seccionesSugeridas({ titulo: "La famille", asignatura: "Francés" }), ["Introduction", "La famille", "Message final"], "una idea, francés");
});

check("cuándo prellenar: sin tocar y con título; nunca sin título", () => {
  assert(planMaestroSinTocar(undefined) && planMaestroSinTocar(PLAN_MAESTRO_INICIAL), "sin tocar");
  assert(debePrellenarPlanMaestro({ planMaestro: undefined, titulo: "My family" }), "con título");
  assert(!debePrellenarPlanMaestro({ planMaestro: undefined, titulo: "  " }), "sin título");
});

check("mientras el docente escribe el título, el prellenado se rehace (incluido el producto sugerido)", () => {
  const d1 = prellenar({ ...base, titulo: "My fam" });
  assert(!debePrellenarPlanMaestro({ ...d1, titulo: "My fam" }), "mismo título: no se rehace");
  const d2 = { ...d1, titulo: "My family and friends" };
  assert(debePrellenarPlanMaestro(d2), "título nuevo y nada tocado: se rehace");
  const d3 = prellenar(d2);
  igual(d3.productoFinalTexto, "My family and friends Booklet", "el producto sugerido viejo no se queda");
  igual(d3.planMaestro.secciones, ["My family", "Friends"], "secciones del título nuevo");
});

check("nunca pisa lo que el docente cambió", () => {
  const d1 = prellenar({ ...base, titulo: "My family" });
  const editado = { ...d1, titulo: "My family and friends", planMaestro: fijarCampoSituacion(d1.planMaestro, "problema", "Mi problema real.") };
  assert(!debePrellenarPlanMaestro(editado), "situación editada");
  assert(!editado.planMaestro.situacion.borrador, "lo editado deja de ser borrador");
  const otroProducto = { ...d1, titulo: "My family and friends", productoFinalTexto: "Mi álbum" };
  assert(!debePrellenarPlanMaestro(otroProducto), "producto cambiado");
});

console.log(`\nModo rápido del plan maestro: ${pasos} pasos, ${fallos} fallos`);
if (fallos) process.exit(1);
