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
  periodoDeFecha, rangoPeriodo,
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

// ─── Informe de coordinación por período (P1–P4) ────────────────────────────
// Cortes de Secundaria 2026-2027: P1 ≤ 30-oct, P2 ≤ 29-ene, P3 ≤ 29-mar, P4 ≤ 1-jun.

check("período de una fecha: misma regla que F7; sin fecha → null", () => {
  igual([periodoDeFecha("Secundaria", "2026-10-30"), periodoDeFecha("Secundaria", "2026-10-31T10:00:00Z"),
    periodoDeFecha("Secundaria", "2027-03-29"), periodoDeFecha("Secundaria", ""), periodoDeFecha("", "2026-11-02")],
  [1, 2, 3, null, null], "períodos");
  igual(rangoPeriodo("Secundaria", 2, "2026-11-20"), { numero: 2, etiqueta: "P2", desde: "2026-10-31", hasta: "2027-01-29" }, "rango P2");
  igual(rangoPeriodo("Secundaria", 1, "2026-11-20").desde, "", "P1 sin «desde», como F7");
});

const periodoCaso = () => {
  const act = (n, fecha, entregas) => ({ id: `act-${n}`, faseNumero: n, faseNombre: `Fase ${n}`, activa: true, fechaPrevista: fecha, entregas });
  const resultado = (ins, est, pts, fecha) => ({
    instrumentoId: ins, estudianteId: est, estado: "evaluado", puntajeObtenido: pts, puntajeMaximo: 100, porcentaje: pts,
    indicadorIds: ["ING-2-I01"], fechaEvaluacion: fecha,
  });
  return {
    cursoNombre: "2do A", asignatura: "Inglés", nivel: "Secundaria", hoy: HOY,
    estudiantes: [{ id: ANA, nombre: "Ana García" }, { id: RIC, nombre: "Ricardo Flores" }],
    actividades: [
      act(1, "2026-10-20", { [ANA]: { estado: "entrego" }, [RIC]: { estado: "no_entrego" } }),
      act(2, "2026-11-12", { [ANA]: { estado: "entrego" }, [RIC]: { estado: "no_entrego" } }),
      { ...act(3, "", { [ANA]: { estado: "pendiente" }, [RIC]: { estado: "pendiente" } }), fechaAjustada: "" },
    ],
    instrumentos: [
      { id: "ins-p1", aspectoRegistroIds: ["p_ING-2-I01"], ponderacion: 50 },
      { id: "ins-p2", aspectoRegistroIds: ["p_ING-2-I01"], ponderacion: 50 },
      { id: "ins-man", aspectoRegistroIds: ["p_ING-2-I02"], ponderacion: 100 },
    ],
    resultados: [
      resultado("ins-p1", ANA, 60, "2026-10-15T14:00:00Z"),
      resultado("ins-p2", ANA, 90, "2026-11-10T14:00:00Z"),
      resultado("ins-p2", RIC, 50, "2026-11-11T14:00:00Z"),
      resultado("ins-p1", RIC, 40, ""), // sin fecha: se avisa, no se reparte
      { ...resultado("ins-man", ANA, 80, "2026-11-05T14:00:00Z"), indicadorIds: ["ING-2-I02"] },
    ],
    aspectos: [
      { aspectoId: "p_ING-2-I01", indicadorId: "ING-2-I01", aspectoVisible: "Saluda", puntajeMaximo: 100 },
      { aspectoId: "p_ING-2-I02", indicadorId: "ING-2-I02", aspectoVisible: "Describe", puntajeMaximo: 50 },
    ],
    notas: [
      // Registro del año: Ana 75 (P1+P2). Ajuste manual de Ana en I02, todo en P2 → vale 45/50 = 90
      { aspectoId: "p_ING-2-I01", estudianteId: ANA, valorObtenido: 75, puntajeMaximo: 100, porcentaje: 75 },
      { aspectoId: "p_ING-2-I01", estudianteId: RIC, valorObtenido: 45, puntajeMaximo: 100, porcentaje: 45 },
      { aspectoId: "p_ING-2-I02", estudianteId: ANA, valorObtenido: 45, puntajeMaximo: 50, porcentaje: 90, ajusteManual: true },
    ],
    asistencia: [
      { fecha: "2026-10-20", marcas: { [ANA]: "ausente", [RIC]: "presente" } },
      { fecha: "2026-11-16", marcas: { [ANA]: "presente", [RIC]: "ausente" } },
      { fecha: "2026-11-17", marcas: { [ANA]: "presente", [RIC]: "ausente" } },
      { fecha: "2026-11-18", marcas: { [ANA]: "presente", [RIC]: "ausente" } },
    ],
  };
};

check("coordinación P2: entregas, indicador desde resultados, apoyo y asistencia del período", () => {
  const c = construirInformeCurso({ ...periodoCaso(), periodo: 2 });
  igual(c.periodo.etiqueta, "P2", "período");
  igual(c.entregas.map((e) => [e.faseNumero, e.entrego, e.no_entrego]), [[2, 1, 1]], "solo la fase de noviembre");
  igual(c.sinFecha, { actividades: ["Fase 3 · Fase 3"], resultados: 1, asistencia: 0 }, "lo sin fecha se avisa");
  // I01: Ana 90 (P2), Ricardo 50 (P2) → 70; I02: ajuste manual de Ana (todo en P2) → 90
  igual(c.indicadores.map((i) => [i.codigo, i.evaluados, i.promedio]), [["ING-2-I01", 2, 70], ["ING-2-I02", 1, 90]], "promedio del período");
  // Ricardo: 1 «No entregó» en P2 (no 2) → sin señal de entregas; indicador 50 y 3 ausencias → apoyo
  igual(c.apoyo.map((a) => a.nombre), ["Ricardo Flores"], "solo Ricardo");
  assert(!c.apoyo[0].motivos.some((m) => m.includes("No entregó")), "la entrega de P1 no cuenta en P2");
  assert(c.apoyo[0].motivos.some((m) => m.includes("ausencias")), "ausencias del período");
  igual([c.asistencia.diasRegistrados, c.asistencia.ausencias.map((a) => [a.nombre, a.ausente])], [3, [["Ricardo Flores", 3]]], "asistencia de P2");
  const html = htmlInformeCurso(c);
  assert(html.includes("P2 (2026-10-31 → 2027-01-29)") && html.includes("Sin fecha, no incluidas en P2: Fase 3"), "HTML con período y avisos");
});

check("coordinación P1: el ajuste manual repartido no vale; la ventana de ausencias cierra el 30-oct", () => {
  const caso = periodoCaso();
  // Ajuste manual de Ana en I01 con resultados en P1 y P2 → se usa el cálculo de P1 (60)
  caso.notas[0] = { ...caso.notas[0], ajusteManual: true };
  const c = construirInformeCurso({ ...caso, periodo: 1 });
  igual(c.entregas.map((e) => e.faseNumero), [1], "fase de octubre");
  igual(c.indicadores.map((i) => [i.codigo, i.promedio]), [["ING-2-I01", 60]], "cálculo de P1, no el ajuste");
  igual(c.asistencia.ausencias.map((a) => a.nombre), ["Ana García"], "ausencia de octubre");
  igual(c.apoyo.map((a) => a.nombre), ["Ana García"], "Ana: indicador 60 en P1");
});

check("coordinación año completo: sin cambios (registroNotas) y sin avisos de período", () => {
  const c = construirInformeCurso(periodoCaso());
  igual([c.periodo, c.sinFecha], [null, null], "año completo");
  igual(c.entregas.length, 3, "todas las actividades");
  igual(c.indicadores.map((i) => [i.codigo, i.promedio]), [["ING-2-I01", 60], ["ING-2-I02", 90]], "Registro del año: (75 + 45) / 2");
  assert(htmlInformeCurso(c).includes("Año completo"), "título");
});

check("coordinación por período: sin nota en el Registro no cuenta (como la C.F. de F7)", () => {
  const caso = periodoCaso();
  caso.notas = caso.notas.filter((n) => n.estudianteId !== RIC);
  const c = construirInformeCurso({ ...caso, periodo: 2 });
  igual(c.indicadores.map((i) => [i.codigo, i.evaluados, i.promedio]), [["ING-2-I01", 1, 90], ["ING-2-I02", 1, 90]], "solo Ana");
});

check("coordinación por período: falla visible sin nivel o sin instrumentos", () => {
  let error = "";
  try { construirInformeCurso({ ...periodoCaso(), nivel: "", periodo: 2 }); } catch (e) { error = e.message; }
  assert(error.includes("No se puede separar por período"), "sin nivel → error");
  const c = construirInformeCurso({ ...periodoCaso(), periodo: 2, errores: { instrumentos: "x" } });
  igual([c.indicadores.length, c.sinComprobar], [0, ["promedio por indicador"]], "sin instrumentos: sin comprobar, no el año");
});

console.log(`\n${pasos} ok, ${fallos} fallos\n`);
if (fallos) process.exit(1);
