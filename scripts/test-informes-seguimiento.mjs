/**
 * F6 — Informes desde los datos registrados (src/services/informesSeguimiento.js).
 *
 * Ejecutar:  node scripts/test-informes-seguimiento.mjs
 *
 * Cubre la lógica pura con el caso de Ana (2do A): nota por indicador del
 * Registro (29/34), C.F. por competencias (75) con aviso de que no coinciden,
 * resultados legacy aparte, pendientes, asistencia, texto WhatsApp y la tabla
 * de coordinación. Lo que NO cubre: lecturas de Firestore ni la ficha.
 */

import {
  construirInformeFamilia, textoInformeFamilia, textoWhatsApp, htmlDocumento,
  construirInformeCurso, htmlInformeCurso, cfDelRegistro, asistenciaDe,
} from "../src/services/informesSeguimiento.js";

let pasos = 0, fallos = 0;
const check = (n, fn) => { try { fn(); pasos += 1; console.log(`  ✓ ${n}`); } catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); } };
const assert = (c, m) => { if (!c) throw new Error(m); };
const igual = (a, b, m) => assert(JSON.stringify(a) === JSON.stringify(b), `${m}\n      esperado: ${JSON.stringify(b)}\n      obtenido: ${JSON.stringify(a)}`);

const HOY = "2026-11-20";
const ANA = "est-ana";
const RIC = "est-ricardo";

const actividad = (n, entregas, extra = {}) => ({
  id: `act-p-f${n}`, faseNumero: n, faseNombre: `Fase ${n}`, activa: true,
  instrumentoId: `ins-p-actividad-f${n}`, fechaPrevista: `2026-11-${String(10 + n).padStart(2, "0")}`,
  entregas, ...extra,
});
const actividades = [
  actividad(1, { [ANA]: { estado: "entrego" }, [RIC]: { estado: "no_entrego" } }),
  actividad(2, { [ANA]: { estado: "pendiente" }, [RIC]: { estado: "no_entrego" } }),
  actividad(3, { [ANA]: { estado: "entrego" }, [RIC]: { estado: "pendiente" } }),
];
const resultados = [
  { instrumentoId: "ins-p-actividad-f3", estudianteId: ANA, estado: "evaluado", puntajeObtenido: 85, puntajeMaximo: 100, porcentaje: 85, indicadorIds: ["ING-2-I01"] },
  // Legacy: lista de cotejo con código de 1ro guardada en el curso de 2do
  { instrumentoId: "ins-lista", estudianteId: ANA, estado: "evaluado", puntajeObtenido: 50, puntajeMaximo: 100, porcentaje: 50, indicadorIds: ["ING-1-I01"] },
];
const aspectos = [
  { aspectoId: "p_ING-2-I01", indicadorId: "ING-2-I01", aspectoVisible: "Saluda y se presenta", puntajeMaximo: 34 },
  { aspectoId: "p_ING-2-I02", indicadorId: "ING-2-I02", aspectoVisible: "Describe su escuela", puntajeMaximo: 33 },
  // Columna legacy inactiva: el Registro no la muestra, el informe tampoco
  { aspectoId: "lista-vieja", nombre: "Lista de cotejo", puntajeMaximo: 100, estado: "inactivo" },
];
const notas = [
  { aspectoId: "p_ING-2-I01", estudianteId: ANA, valorObtenido: 29, puntajeMaximo: 34, porcentaje: 85, esParcial: true },
  { aspectoId: "p_ING-2-I02", estudianteId: RIC, valorObtenido: "", puntajeMaximo: 33 },
  { aspectoId: "lista-vieja", estudianteId: ANA, valorObtenido: 50, puntajeMaximo: 100, porcentaje: 50 },
];
// Registro › Calificaciones: dos competencias con P1 = 70 y 80 → C.F. 75
const registroCalificaciones = {
  notasEstudiantes: {
    [ANA]: { competencias: [{ periodos: [{ p: "70", rp: "" }] }, { periodos: [{ p: "80", rp: "" }] }], ceCompletiva: "", ceExtraordinaria: "" },
  },
};
const asistencia = [
  { fecha: "2026-11-18", marcas: { [ANA]: "presente", [RIC]: "ausente" } },
  { fecha: "2026-11-19", marcas: { [ANA]: "tarde", [RIC]: "ausente" } },
  { fecha: "2026-11-20", marcas: { [ANA]: "ausente", [RIC]: "ausente" } },
];

console.log("\nF6 — informes desde los datos registrados\n");

const inf = construirInformeFamilia({
  estudiante: { id: ANA, nombre: "Ana García" }, cursoNombre: "2do A", asignatura: "Inglés",
  actividades, resultados, aspectos, notas, registroCalificaciones, asistencia,
  anotacionesElegidas: [{ fecha: "2026-11-15", hecho: "Ayudó a un compañero.", compromisos: "" }],
  ids: [ANA], hoy: HOY,
});

check("nota por indicador = columnas activas del Registro (29/34, 85 %); la inactiva no sale", () => {
  igual(inf.indicadores.map((i) => [i.codigo, i.obtenido, i.maximo, i.porcentaje, i.nivel, i.esParcial]),
    [["ING-2-I01", 29, 34, 85, "Logrado", true]], "solo el aspecto con nota de Ana");
});

check("C.F. por competencias con el cálculo del Registro (75) y aviso de que no coincide", () => {
  igual(inf.cf, { cf: 75, porCompetencia: [70, 80], situacion: "Aprobado" }, "C.F.");
  assert(inf.notasNoCoinciden, "85 % por indicador ≠ 75 C.F. debe avisar");
  assert(textoInformeFamilia(inf).includes("no coincide"), "el aviso sale en el texto");
});

check("resultados legacy (ING-1) aparte, con su origen, no mezclados con el Registro", () => {
  igual(inf.otrosResultados.map((o) => [o.codigo, o.promedio]), [["ING-1-I01", 50]], "otros resultados");
});

check("pendientes: pendiente con fecha pasada sí; actividad con nota no", () => {
  igual(inf.pendientes.map((p) => [p.faseNumero, p.estado]), [[2, "pendiente"]], "pendientes de Ana");
});

check("asistencia del pase de lista: tardanza cuenta como asistió", () => {
  igual(inf.asistencia, { dias: 3, presente: 1, tarde: 1, excusa: 0, ausente: 1, porcentaje: 67 }, "asistencia");
  igual(asistenciaDe({ asistencia: [], ids: [ANA] }).porcentaje, null, "sin pase de lista = null, no 0");
});

check("Ana necesita apoyo por el indicador legacy (mismo criterio que la ficha)", () => {
  assert(inf.apoyo.necesitaApoyo, "debe salir la alerta");
  assert(inf.apoyo.motivos[0].texto.includes("ING-1-I01 (50)"), inf.apoyo.motivos[0].texto);
});

check("texto WhatsApp corto: logros, pendientes y asistencia", () => {
  const t = textoWhatsApp(inf);
  assert(t.includes("Saluda y se presenta: lo ha logrado (85 %)"), t);
  assert(t.includes("Fase 2 (Fase 2): Pendiente"), t);
  assert(t.includes("67 %"), t);
  assert(t.split("\n").length === 4, "4 líneas");
});

check("fuente fallida = «sin comprobar», nunca vacío callado", () => {
  const malo = construirInformeFamilia({ estudiante: { nombre: "Ana" }, ids: [ANA], hoy: HOY,
    errores: { registro: "x", calificaciones: "y", asistencia: "z" } });
  igual(malo.sinComprobar, ["notas por indicador", "C.F. por competencias", "asistencia"], "sinComprobar");
  igual(malo.asistencia, null, "asistencia no comprobada = null");
  assert(textoInformeFamilia(malo).includes("Sin comprobar"), "aviso en el texto");
});

check("sin C.F. registrada: null y sin aviso de discrepancia", () => {
  igual(cfDelRegistro({ registroCalificaciones: { notasEstudiantes: {} }, ids: [ANA] }), null, "sin notas");
  const sinCf = construirInformeFamilia({ estudiante: { nombre: "Ana" }, aspectos, notas, ids: [ANA], hoy: HOY });
  assert(!sinCf.notasNoCoinciden, "no avisa sin C.F.");
});

check("PDF escapa el HTML del texto", () => {
  const h = htmlDocumento("Informe <Ana>", "## Logros\n- <b>x</b>");
  assert(h.includes("Informe &lt;Ana&gt;") && h.includes("&lt;b&gt;x&lt;/b&gt;") && !h.includes("<b>x"), "escape");
});

check("coordinación: % de entregas, promedio por indicador, apoyo y asistencia", () => {
  const c = construirInformeCurso({
    cursoNombre: "2do A", asignatura: "Inglés",
    estudiantes: [{ id: ANA, nombre: "Ana García" }, { id: RIC, nombre: "Ricardo Flores" }],
    actividades, resultados, aspectos, notas, asistencia, hoy: HOY,
  });
  igual(c.entregas.map((e) => [e.faseNumero, e.entrego, e.no_entrego, e.pendiente, e.porcentaje]),
    [[1, 1, 1, 0, 50], [2, 0, 1, 1, 0], [3, 1, 0, 1, 50]], "entregas");
  igual(c.indicadores.map((i) => [i.codigo, i.evaluados, i.promedio]), [["ING-2-I01", 1, 85]], "nota vacía de Ricardo no cuenta");
  igual(c.apoyo.map((a) => a.nombre), ["Ana García", "Ricardo Flores"], "ambos con señal");
  assert(c.apoyo[1].motivos.some((m) => m.includes("No entregó")), "motivo de Ricardo visible");
  igual(c.asistencia.promedio, 34, "promedio (67 + 0) / 2");
  assert(htmlInformeCurso(c).includes("Entregas por actividad"), "HTML");
});

console.log(`\n${pasos} ok, ${fallos} fallos\n`);
if (fallos) process.exit(1);
