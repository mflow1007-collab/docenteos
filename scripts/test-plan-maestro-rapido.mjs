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
  resolverIndicadoresEstructurados, competenciasDeMalla, PLAN_MAESTRO_INICIAL, prepararPlanMaestroGeneracion,
} from "../src/services/vistaPreviaPlanMaestroService.js";
import { seccionesPrincipalesUnidad } from "../src/services/redaccionFaseService.js";
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
  igual(d.planMaestro.secciones, ["My family", "My Friends", "Past Experiences", "Future Plans"], "secciones desde el título y las funciones");
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

check("Etapa 1A: la semilla trae qué contiene cada sección; el borrador del título, ninguno", () => {
  const d = prellenar({ ...base, titulo: "Alimentación" });
  igual(d.planMaestro.situacion.semillaId, "ing2-alimentacion-menu", "semilla");
  igual(d.planMaestro.propositosSecciones["Healthy Choices"], "qué platos y alimentos recomendamos y por qué (alternativas más sanas)", "Healthy Choices");
  igual(d.planMaestro.propositosSecciones["Ordering Food"], "cómo pedir esos platos en inglés (diálogos de pedido entre cliente y dueño)", "Ordering Food");
  igual(d.planMaestro.piezasSecciones["Healthy Choices"], "etiquetas «Healthy pick» junto a los platos del menú, cada una con su razón y la alternativa más sana", "pieza de Healthy Choices");
  igual(prellenar({ ...base, titulo: "My family and friends" }).planMaestro.propositosSecciones, {}, "sin semilla, sin propósitos");
  igual(prellenar({ ...base, titulo: "My family and friends" }).planMaestro.piezasSecciones, {}, "sin semilla, sin piezas");
  igual(d.planMaestro.tiposTrabajoSecciones["Healthy Choices"], "proponer", "Etapa S2: tipo de Healthy Choices");
  igual(d.planMaestro.partenDeSecciones["Ordering Food"], ["Bilingual Menus", "Healthy Choices"], "Etapa S2: de qué parte Ordering Food");
  igual(prellenar({ ...base, titulo: "My family and friends" }).planMaestro.tiposTrabajoSecciones, {}, "sin semilla, sin tipos");
  igual(prellenar({ ...base, titulo: "My family and friends" }).planMaestro.partenDeSecciones, {}, "sin semilla, sin «parte de»");
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

check("un título largo sigue cabiendo en las 8 líneas de la situación (máx. 800 caracteres)", () => {
  const titulo = "Sports, hobbies, free time activities and healthy habits in my community and school";
  const d = prellenar({ ...base, titulo });
  const e = estado(d);
  assert(e.listo, `no quedó lista: ${e.falta}`);
  const { texto } = validarSituacion({ situacion: d.planMaestro.situacion, producto: d.productoFinalTexto, estrategia: d.planMaestro.estrategia });
  assert(texto.length <= 800, `${texto.length} caracteres`);
});

check("secciones sugeridas: cada parte del título + experiencias y planes (idiomas); fuera de idiomas, como antes", () => {
  igual(seccionesSugeridas({ titulo: "Hobbies and weekend activities", asignatura: "Inglés" }), ["My Hobbies", "My Weekend activities", "Past Experiences", "Future Plans"], "auditoría: más secciones visibles");
  igual(seccionesSugeridas({ titulo: "Food, drinks and health", asignatura: "Inglés" }), ["My Food", "My Drinks", "My Health", "Past Experiences", "Future Plans"], "varias partes");
  igual(seccionesSugeridas({ titulo: "Daily routines", asignatura: "Inglés" }), ["Introduction", "My Daily routines", "Past Experiences", "Future Plans"], "una idea, inglés");
  igual(seccionesSugeridas({ titulo: "La famille", asignatura: "Francés" }), ["Introduction", "La famille", "Mes expériences", "Mes projets"], "una idea con artículo, francés");
  igual(seccionesSugeridas({ titulo: "La célula y sus partes", asignatura: "Ciencias" }), ["La célula", "Sus partes"], "fuera de idiomas");
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
  igual(d3.planMaestro.secciones, ["My family", "My Friends", "Past Experiences", "Future Plans"], "secciones del título nuevo");
});

check("nunca pisa lo que el docente cambió", () => {
  const d1 = prellenar({ ...base, titulo: "My family" });
  const editado = { ...d1, titulo: "My family and friends", planMaestro: fijarCampoSituacion(d1.planMaestro, "problema", "Mi problema real.") };
  assert(!debePrellenarPlanMaestro(editado), "situación editada");
  assert(!editado.planMaestro.situacion.borrador, "lo editado deja de ser borrador");
  const otroProducto = { ...d1, titulo: "My family and friends", productoFinalTexto: "Mi álbum" };
  assert(!debePrellenarPlanMaestro(otroProducto), "producto cambiado");
});

// Etapa S3 (docs/DISENO_SECUENCIA_POR_FASES.md): con Inserción y secciones con
// tipo de trabajo, cada fase lleva las secciones que nacen en ella.
console.log("\n[Etapa S3 — secciones por fase de Inserción]");
const planDe = (titulo, semanas, cambios = {}) => {
  const h = { ...horario, semanas };
  // Centro corto: con el nombre largo, la situación de Escuela pasa de 800 caracteres.
  const d = prellenar({ ...base, centro: "Centro Hato Nuevo", numSemanas: semanas, titulo, temasSeleccionados: [titulo] });
  const pm = { ...d.planMaestro, estrategia: "insercion_entorno", situacion: { ...d.planMaestro.situacion, estrategiaAlineada: "insercion_entorno" }, ...cambios };
  return prepararPlanMaestroGeneracion({ datos: { ...d, planMaestro: pm }, mallaPayload: malla, horario: h }).plan;
};
const seccionesPorFase = (plan) => plan.fases.map((f) => (f.entrega.secciones.length === plan.secciones.length ? "todas" : f.entrega.secciones.join(", ")));
const I = "Interviews with Owners", L = "Our Local Food", M = "Bilingual Menus", H = "Healthy Choices", O = "Ordering Food";

check("«Alimentación» a 3 semanas reproduce la tabla aprobada", () => {
  const plan = planDe("Alimentación", 3);
  igual(seccionesPorFase(plan), ["todas", I, I, L, M, `${I}, ${L}`, `${H}, ${M}`, O, "todas"], "secciones por fase");
  igual(seccionesPrincipalesUnidad(plan).flat(), ["", I, I, L, M, I, H, O, ""], "principal de cada clase");
  igual(plan.fases.map((f) => f.entrega.estado), ["Acuerdo y plan", "Insumos recopilados", "Insumos recopilados", "Borrador", "Borrador",
    "Versión final", "Versión final", "Versión final", "Versión revisada"], "estados del producto, como hoy");
});
check("«Alimentación» a 4 semanas: Healthy Choices y Ordering Food en clases distintas", () => {
  const pr = seccionesPrincipalesUnidad(planDe("Alimentación", 4));
  igual(pr.slice(5, 8), [[I, L], [H, M], [O, O]], "versiones finales, una clase por sección");
});
check("las 3 semillas a 3 y 4 semanas: toda sección es principal de alguna clase", () => {
  for (const titulo of ["Alimentación", "Escuela y educación", "Actividades de la vida diaria"]) for (const semanas of [3, 4]) {
    const plan = planDe(titulo, semanas);
    const principales = seccionesPrincipalesUnidad(plan).flat();
    plan.secciones.forEach((sec) => assert(principales.includes(sec), `${titulo} · ${semanas} sem: ${sec} sin clase propia`));
  }
});
check("sin secciones de visita, instrumentos y visita reparten todas en orden (como hoy)", () => {
  igual(seccionesPorFase(planDe("Escuela y educación", 3)).slice(1, 3),
    ["Welcome, Important Places, School Directions", "Asking for Help, School Success Tips, Final Recommendation"], "fases 2 y 3");
});
check("respaldo: sin semilla, sección renombrada o estrategia sin mapa → reparto de hoy", () => {
  igual(seccionesPorFase(planDe("My family and friends", 3)), ["todas", "My family, My Friends", "Past Experiences, Future Plans",
    "My family, My Friends", "Past Experiences, Future Plans", "My family", "My Friends", "Past Experiences, Future Plans", "todas"], "sin semilla");
  const renombrada = [L, I, M, "Healthy Food", O];
  igual(seccionesPorFase(planDe("Alimentación", 3, { secciones: renombrada })),
    seccionesPorFase(planDe("Alimentación", 3, { secciones: renombrada, tiposTrabajoSecciones: {} })), "renombrada");
  const proyectos = (cambios) => {
    const d = prellenar({ ...base, numSemanas: 3, titulo: "Alimentación", temasSeleccionados: ["Alimentación"] });
    const pm = { ...d.planMaestro, estrategia: "proyectos", situacion: { ...d.planMaestro.situacion, estrategiaAlineada: "proyectos" }, ...cambios };
    return seccionesPorFase(prepararPlanMaestroGeneracion({ datos: { ...d, planMaestro: pm }, mallaPayload: malla, horario: { ...horario, semanas: 3 } }).plan);
  };
  igual(proyectos(), proyectos({ tiposTrabajoSecciones: {} }), "ABProyecto sin mapa");
});

console.log(`\nModo rápido del plan maestro: ${pasos} pasos, ${fallos} fallos`);
if (fallos) process.exit(1);
