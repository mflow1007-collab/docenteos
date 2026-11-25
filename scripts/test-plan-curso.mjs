/**
 * F1 — Plan ↔ curso: puntuación con la que un plan guardado se ata a su curso
 * (src/services/hiloPedagogico.js → puntuarCursoParaPlan).
 *
 * Ejecutar:  node scripts/test-plan-curso.mjs
 *
 * Etapa 3: curso del aula y copia por sección, con los servicios reales sobre un
 * Firestore en memoria. Lo que NO cubre: Firestore real ni la pantalla.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { puntuarCursoParaPlan, UMBRAL_CURSO_PLAN } from "../src/services/hiloPedagogico.js";

// Datos reales de la cuenta de César (2026-10-30): el curso no trae `grado`,
// el grado va en el nombre.
const curso2doA = { id: "curso-1785775747248", nombre: "2do Secundaria A", area: "Inglés", seccion: "A" };
const meta2doA = { grado: "2do Secundaria", seccion: "A", area: "Lenguas Extranjeras", asignatura: "Inglés" };
const meta1roB = { grado: "1ro Secundaria", seccion: "B", area: "Lenguas Extranjeras", asignatura: "Inglés" };

// 1. El plan de 2do A encaja con el curso 2do A
assert.equal(puntuarCursoParaPlan(meta2doA, curso2doA), 11);
assert.ok(puntuarCursoParaPlan(meta2doA, curso2doA) >= UMBRAL_CURSO_PLAN);
console.log("✓ el plan de 2do A se ata al curso 2do A (grado + asignatura + sección)");

// 2. El plan de 1ro B NO se ata al curso 2do A (antes Modo Aula lo mostraba)
assert.ok(puntuarCursoParaPlan(meta1roB, curso2doA) < UMBRAL_CURSO_PLAN);
console.log("✓ el plan de 1ro B no se ata al curso 2do A");

// 2b. Misma asignatura y misma sección, otro grado: tampoco (antes 5 + 2 = 7 bastaba)
assert.ok(puntuarCursoParaPlan({ ...meta1roB, seccion: "A" }, curso2doA) < UMBRAL_CURSO_PLAN);
console.log("✓ el plan de 1ro A no se ata al curso 2do A aunque coincida la sección");

// 3. Etapa 3 (César, 2026-11-25): otra sección NO encaja; usa su copia del plan
// (antes sí encajaba y la nota o la lista podía ir al curso equivocado).
assert.equal(puntuarCursoParaPlan({ ...meta2doA, seccion: "B" }, curso2doA), 0);
assert.equal(puntuarCursoParaPlan({ ...meta2doA, seccion: "B" }, { ...curso2doA, seccion: "" }), 0, "sección tomada del nombre");
assert.ok(puntuarCursoParaPlan({ ...meta2doA, seccion: "" }, curso2doA) >= UMBRAL_CURSO_PLAN, "plan sin sección: como antes");
assert.ok(puntuarCursoParaPlan(meta2doA, { ...curso2doA, nombre: "2do Secundaria", seccion: "" }) >= UMBRAL_CURSO_PLAN, "curso sin sección: como antes");
console.log("✓ otra sección del mismo grado y asignatura no encaja");

// 4. Mismo grado, otra asignatura: no se ata
assert.ok(puntuarCursoParaPlan({ ...meta2doA, asignatura: "Matemática", area: "Matemática" }, curso2doA) < UMBRAL_CURSO_PLAN);
assert.equal(puntuarCursoParaPlan({}, curso2doA), 0);
console.log("✓ otra asignatura o metadatos vacíos no se atan");

// ─── Etapa 3 — curso del aula ────────────────────────────────────────────────

const {
  construirCopiaDePlan, diasDelPlan, errorDeDias, planesParaCopiar, resolverCursoDelAula,
} = await import("../src/services/planCurso.js");
const { construirCapaCurricular } = await import("../src/services/hiloPedagogico.js");
const curso2doB = { id: "curso-b", nombre: "2do Secundaria B", area: "Inglés", seccion: "B", estudiantesDetalle: [{ id: "eb1", nombre: "Wilkin Then" }] };
const cursos = [curso2doA, curso2doB, { id: "curso-1", nombre: "1ro Secundaria A", area: "Inglés", seccion: "A" }];
const planDe = (meta, cursoId = "") => ({ id: "p", cursoId, contenido: { metadatos: meta }, capaCurricular: { clases: [] } });
const aula = (plan, cursoActivo, lista = cursos) => resolverCursoDelAula({ plan, cursos: lista, cursoActivo });

assert.equal(aula(planDe(meta2doA, curso2doA.id), curso2doB).curso.id, curso2doA.id);
assert.match(aula(planDe(meta2doA, curso2doA.id), curso2doB).aviso, /van a 2do Secundaria A/);
assert.deepEqual(aula(planDe(meta2doA, curso2doA.id), curso2doA), { curso: curso2doA, aviso: "" });
console.log("✓ manda el curso del plan aunque el activo sea otro, y se avisa");
assert.equal(aula(planDe(meta2doA, "borrado"), curso2doA).curso, null);
assert.match(aula(planDe(meta2doA, "borrado"), curso2doA).aviso, /ya no existe/);
console.log("✓ si el curso del plan ya no existe no se usa otro");
assert.equal(aula(planDe({ ...meta2doA, seccion: "B" }), curso2doA).curso.id, "curso-b", "sin curso: el único que encaja");
assert.equal(aula(planDe({ ...meta2doA, seccion: "" }), null).curso, null, "encaja con A y B: no adivina");
assert.match(aula(planDe({ ...meta2doA, seccion: "" }), null).aviso, /varios/);
assert.equal(aula(planDe({ ...meta2doA, seccion: "" }), curso2doB).curso.id, "curso-b", "el activo desempata");
assert.equal(aula(planDe({ grado: "5to Secundaria", asignatura: "Física" }), curso2doA).curso, null, "antes tomaba el activo o el primero");
console.log("✓ plan sin curso: solo uno que encaje, nunca el primero");
assert.match(aula(planDe({ ...meta2doA, seccion: "B" }, curso2doA.id), curso2doA).aviso, /dice sección B/);
assert.equal(aula(planDe({ ...meta2doA, seccion: "B" }, curso2doA.id), curso2doA).curso.id, curso2doA.id, "se reporta, no se autocorrige");
assert.deepEqual(aula(planDe(meta2doA, curso2doA.id), null, []), { curso: null, aviso: "" }, "cursos aún sin cargar");
console.log("✓ plan atado a otra sección: se reporta, no se autocorrige");

// Etapa 3 + hora extra: la clase que se muestra sale del curso DEL PLAN. Si A ya
// dio la clase 1, con B activo no vuelve a salir (antes miraba el curso activo).
const { claseParaMostrar } = await import("../src/utils/horaExtra.js");
const ahora = new Date(2026, 10, 25, 9);
const capaDos = { clases: [{ claseId: "c1", numeroClase: 1, fechaSugerida: "2026-11-25" }, { claseId: "c2", numeroClase: 2, fechaSugerida: "2026-11-27" }] };
const aConDada = { ...curso2doA, clasesDadas: [{ planId: "p", claseId: "c1", fecha: "2026-11-24", extra: true }] };
const planDeA = { ...planDe(meta2doA, curso2doA.id), capaCurricular: capaDos };
const cursoDelPlan = aula(planDeA, curso2doB, [aConDada, curso2doB]).curso;
assert.equal(claseParaMostrar(capaDos, cursoDelPlan, "p", ahora).clase.claseId, "c2");
assert.equal(claseParaMostrar(capaDos, curso2doB, "p", ahora).clase.claseId, "c1", "con el activo saldría la ya dada");
assert.equal(claseParaMostrar(capaDos, null, "p", ahora).clase.claseId, "c1", "sin curso claro no falla");
const pagina = readFileSync(new URL("../src/pages/ModoAulaPage.jsx", import.meta.url), "utf8");
assert.doesNotMatch(pagina, /resolverCursoParaPlan/, "el aula tiene un solo resolvedor de curso");
console.log("✓ la clase mostrada y la hora extra usan el curso del plan");

// ─── Etapa 3 — copia por sección ─────────────────────────────────────────────

const niveles = ["Receptivo", "Resolutivo", "Autónomo", "Estratégico"].map((nombre, i) => ({ nombre, porcentaje: [55, 70, 85, 100][i], descriptor: nombre }));
const dia = (n, semana, diaCalendario) => ({ n, semana, diaCalendario, titulo: `Clase ${n}`, indicadoresTrabajados: ["I1"], momentos: [{ tipo: "Desarrollo", actividades: ["Elaboran"], instrumento: "Lista de cotejo" }] });
const unidad = {
  metadatos: { ...meta2doA, titulo: "Alimentación", fechaInicio: "2026-11-02", horario: "Lunes, Miércoles · 1 hora/día · 2 horas/semana", indicadoresOficiales: ["Describe alimentos"] },
  situacionAprendizaje: "Texto que no cambia",
  fasesSemanales: [{ nombre: "F1", dias: [dia(1, 1, "Lunes"), dia(2, 1, "Miércoles")] }, { nombre: "F2", dias: [dia(3, 2, "Lunes"), dia(4, 2, "Miércoles")] }],
};
const capaA = construirCapaCurricular(unidad, { curriculo: null, cursoId: curso2doA.id, docenteId: "u1" });
const ind = capaA.indicadoresSeleccionados[0].id;
unidad.planMaestro = { fases: ["F1", "F2"].map((nombre) => ({ nombre, entrega: { estado: "borrador", texto: `Entrega ${nombre}`, secciones: [] }, indicadores: [{ id: ind }] })) };
unidad.anexos = { rubricaPlan: [{ indicadorCodigo: ind, indicador: "Describe", niveles }] };
const planA = { id: "planA", cursoId: curso2doA.id, contenido: unidad, capaCurricular: capaA };
const congelado = JSON.stringify(planA);
const fechas = (capa) => capa.clases.map((c) => c.fechaSugerida);
assert.deepEqual(fechas(capaA), ["2026-11-02", "2026-11-04", "2026-11-09", "2026-11-11"]);
assert.deepEqual(diasDelPlan(planA), ["Lunes", "Miércoles"]);

const igual = construirCopiaDePlan({ plan: planA, curso: curso2doB });
assert.deepEqual(fechas(igual.capaCurricular), fechas(capaA), "sin cambios: mismas fechas");
const copia = construirCopiaDePlan({ plan: planA, curso: curso2doB, fechaInicio: "2026-11-09", dias: ["Martes", "Jueves"] });
assert.deepEqual(fechas(copia.capaCurricular), ["2026-11-10", "2026-11-12", "2026-11-17", "2026-11-19"]);
assert.deepEqual(copia.contenido.fasesSemanales.flatMap((f) => f.dias.map((d) => d.diaCalendario)), ["Martes", "Jueves", "Martes", "Jueves"]);
assert.deepEqual([copia.contenido.metadatos.seccion, copia.contenido.metadatos.fechaInicio, copia.contenido.metadatos.horario], ["B", "2026-11-09", "Martes, Jueves · 1 hora/día · 2 horas/semana"]);
assert.deepEqual([copia.capaCurricular.cursoId, copia.capaCurricular.seccion, copia.capaCurricular.planOrigenId], ["curso-b", "B", "planA"]);
assert.equal(copia.contenido.situacionAprendizaje, unidad.situacionAprendizaje);
assert.deepEqual(copia.capaCurricular.clases.map((c) => c.claseId), capaA.clases.map((c) => c.claseId), "mismas clases");
assert.equal(JSON.stringify(planA), congelado, "el original no cambia");
console.log("✓ la copia lleva curso, sección, días y fechas propias; el original no cambia");

assert.match(errorDeDias(["Lunes", "Miércoles"], ["Jueves", "Martes"]), /en orden/);
assert.match(errorDeDias(["Lunes", "Miércoles"], ["Martes", "Martes"]), /distintos/);
assert.match(errorDeDias(["Lunes"], []), /Elige un día/);
assert.throws(() => construirCopiaDePlan({ plan: planA, curso: curso2doB, dias: ["Martes", "Martes"] }), /distintos/);
assert.throws(() => construirCopiaDePlan({ plan: planA, curso: curso2doA }), /ya pertenece/);
assert.throws(() => construirCopiaDePlan({ plan: planA, curso: cursos[2] }), /mismo grado/);
assert.throws(() => construirCopiaDePlan({ plan: planA, curso: { ...curso2doB, nombre: "2do Secundaria", seccion: "" } }), /no tiene sección/);
assert.throws(() => construirCopiaDePlan({ plan: planA, curso: curso2doB, fechaInicio: "mañana" }), /no es válida/);
console.log("✓ copia inválida: error claro (días, curso, grado, sección, fecha)");

const planB = { id: "planB", cursoId: "curso-b", ...copia };
assert.deepEqual(planesParaCopiar([planA], curso2doB).map((p) => p.id), ["planA"]);
assert.deepEqual(planesParaCopiar([planA, planB], curso2doB), [], "ya copiado");
assert.deepEqual(planesParaCopiar([planB], { ...curso2doB, id: "curso-c", nombre: "2do Secundaria C", seccion: "C" }), [], "se copia el original, no otra copia");
assert.deepEqual(planesParaCopiar([planA], cursos[2]), [], "otro grado");
console.log("✓ solo se ofrecen originales de la misma materia sin copia previa");

// El servicio real: guarda la copia y sus derivados sin mezclar secciones
const almacen = new Map();
globalThis.__e3 = { almacen, cursos, n: 0, fallaActividades: false };
const STUBS = {
  firestore: `
    const g = globalThis.__e3; const { almacen } = g;
    const ruta = (...p) => p.filter((x) => typeof x === "string" || x?.ruta).map((x) => x.ruta ?? x).join("/");
    export const doc = (...p) => ({ ruta: ruta(...p), id: String(p.at(-1)) });
    export const collection = (...p) => ({ ruta: ruta(...p) });
    export const where = (campo, op, valor) => ({ campo, valor });
    export const query = (col, ...w) => ({ ruta: col.ruta, w });
    export const serverTimestamp = () => "ahora"; export class FieldPath {}
    const poner = (ref, d) => { if (g.fallaActividades && ref.ruta.includes("/actividades/")) throw new Error("sin red"); almacen.set(ref.ruta, { ...(almacen.get(ref.ruta) || {}), ...structuredClone(d) }); };
    export const setDoc = async (ref, d) => poner(ref, d); export const updateDoc = setDoc;
    export const getDoc = async (ref) => ({ id: ref.id, exists: () => almacen.has(ref.ruta), data: () => structuredClone(almacen.get(ref.ruta)) });
    export const getDocs = async (q) => ({ docs: [...almacen].filter(([r, d]) => r.startsWith(q.ruta + "/") && !r.slice(q.ruta.length + 1).includes("/") && (q.w || []).every((f) => d[f.campo] === f.valor)).map(([r, d]) => ({ id: r.split("/").at(-1), data: () => structuredClone(d) })) });
    export const writeBatch = () => { const l = []; return { set: (r, d) => l.push([r, d]), commit: async () => l.forEach(([r, d]) => poner(r, d)) }; };`,
  firebase: `const g = globalThis.__e3;
    export const db = { ruta: "" }, auth = { currentUser: { uid: "u1" } };
    export const guardarRegistroAspectoDesdeInstrumento = async () => {};
    export const obtenerCursos = async () => ({ data: g.cursos });
    export const obtenerSesionesPlan = async () => ({ success: true, data: [] });
    export const guardarPlanificacionDetallada = async (contenido, extra) => { const id = "copia" + (++g.n); g.almacen.set("planificaciones/" + id, structuredClone({ contenido, ...extra })); return { id }; };
    export const obtenerPlanificacionesDetalladas = async () => ({ data: [...g.almacen].filter(([r]) => r.startsWith("planificaciones/")).map(([r, d]) => ({ id: r.split("/")[1], ...structuredClone(d) })) });`,
  nada: `export const getCurricularContentForUnit = 0, cosecharSecuenciaDeUnidad = 0, cosecharActividadesDeUnidad = 0, crearEvidencia = 0, obtenerEstudiantesPorCurso = async () => [];`,
};
const A_STUB = [
  [/^firebase\/firestore$/, "firestore"], [/\/firebase(\.js)?$/, "firebase"],
  [/(bancoConocimientoService|bancoAprendizajeService|cosechaActividadesService|evidenciasService|estudiantesService)\.js$/, "nada"],
];
registerHooks({
  resolve(especificador, contexto, siguiente) {
    const stub = A_STUB.find(([patron]) => patron.test(especificador));
    return stub ? { url: `data:text/javascript,${encodeURIComponent(STUBS[stub[1]])}`, shortCircuit: true } : siguiente(especificador, contexto);
  },
});
const { copiarPlanParaCurso, obtenerPlanificacionActiva } = await import("../src/services/planificacionDataService.js");
const { id: _id, ...datosA } = planA;
almacen.set("planificaciones/planA", structuredClone(datosA));
const r1 = await copiarPlanParaCurso(planA, curso2doB, { fechaInicio: "2026-11-09", dias: ["Martes", "Jueves"] });
const rutas = (parte) => [...almacen].filter(([r]) => r.includes(parte));
assert.deepEqual(r1.advertencias, []);
assert.equal(almacen.get("planificaciones/copia1").cursoId, "curso-b");
assert.ok(rutas("/registroAspectos/").length && rutas("/registroAspectos/").every(([r, d]) => r.includes("/cursos/curso-b/") && d.planificacionId === "copia1"));
assert.ok(rutas("/instrumentos/").length && rutas("/instrumentos/").every(([, d]) => d.planificacionId === "copia1" && d.cursoId === "curso-b"));
assert.deepEqual(rutas("/actividades/").map(([, d]) => [d.cursoId, d.fechaPrevista, Object.keys(d.entregas)]), [["curso-b", "2026-11-12", ["eb1"]], ["curso-b", "2026-11-19", ["eb1"]]]);
assert.deepEqual(almacen.get("planificaciones/planA"), structuredClone(datosA), "el original no se escribe");
assert.ok(!rutas("cuposGrado").length, "no toca el cupo");
console.log("✓ copiar crea columnas, instrumentos y actividades de 2do B, sin cupo ni tocar 2do A");

const antes = almacen.size;
const r2 = await copiarPlanParaCurso(planA, curso2doB);
assert.deepEqual([r2.existente, r2.plan.id, almacen.size], [true, "copia1", antes]);
console.log("✓ repetir no duplica");
assert.equal((await obtenerPlanificacionActiva("curso-b")).id, "copia1");
assert.equal((await obtenerPlanificacionActiva(curso2doA.id)).id, "planA");
console.log("✓ cada sección abre su propio plan");

almacen.clear(); almacen.set("planificaciones/planA", structuredClone(datosA)); globalThis.__e3.fallaActividades = true;
const r3 = await copiarPlanParaCurso(planA, curso2doB);
assert.match(r3.advertencias.join(), /La copia quedó guardada, pero sus actividades no se crearon: sin red/);
globalThis.__e3.fallaActividades = false;
const r4 = await copiarPlanParaCurso(planA, curso2doB);
assert.deepEqual([r4.existente, r4.advertencias, rutas("/actividades/").length], [true, [], 2], "reintentar completa lo que faltó");
console.log("✓ si algo falla se avisa y reintentar lo completa");

console.log("\nPlan ↔ curso: todo en verde");
