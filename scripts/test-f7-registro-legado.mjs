/**
 * F7 — C.F. desde las notas por indicador, evidencias vigentes e id legado
 * ambiguo («est-1»).
 *
 * Ejecutar:  node scripts/test-f7-registro-legado.mjs
 *
 * Casos de 2do A: Ana tiene I01 = 29/34 (85 %) evaluado el 31-oct (P2 según el
 * calendario MINERD de Secundaria) y celdas de C.F. puestas a mano; Ricardo tiene
 * una evidencia «0/100» de una nota que se quitó; «est-1» es Ana en Modo Aula y
 * Carlos en Instrumentos. Lo que NO cubre: lecturas/escrituras de Firestore ni
 * las páginas.
 */

import {
  aplicarCeldasIndicadores, celdasDesdeIndicadores, notasConCalculoAceptado,
} from "../src/utils/resumenCalificaciones.js";
import { cfDelRegistro, construirInformeFamilia, construirInformeCurso, textoInformeFamilia } from "../src/services/informesSeguimiento.js";
import { construirEvidenciaDesdeResultado, evidenciasVigentes } from "../src/services/hiloPedagogico.js";
import {
  asistenciaDelEstudiante, depurarDatosLegado, esDelEstudiante, idsAmbiguosEstudiante, idsLegadoEstudiante,
} from "../src/utils/idEstudiante.js";

let pasos = 0, fallos = 0;
const check = (n, fn) => { try { fn(); pasos += 1; console.log(`  ✓ ${n}`); } catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); } };
const assert = (c, m) => { if (!c) throw new Error(m); };
const igual = (a, b, m) => assert(JSON.stringify(a) === JSON.stringify(b), `${m}\n      esperado: ${JSON.stringify(b)}\n      obtenido: ${JSON.stringify(a)}`);

const ANA = "est-ana-garcia-0";
const competencias = [
  { id: "ING-2-C01", indicadoresLogro: [{ id: "ING-2-I01" }, { id: "ING-2-I02" }, { id: "ING-2-I03" }] },
  { id: "ING-2-C02", indicadoresLogro: [{ id: "ING-2-I04" }] },
];
const aspectos = [
  { aspectoId: "p_ING-2-I01", indicadorId: "ING-2-I01", puntajeMaximo: 34, estado: "activo" },
  { aspectoId: "p_ING-2-I04", indicadorId: "ING-2-I04", puntajeMaximo: 33, estado: "activo" },
  { aspectoId: "p_ING-9-I99", indicadorId: "ING-9-I99", puntajeMaximo: 10, estado: "activo" },
];
const instrumentos = [
  { id: "ins-f3", aspectoRegistroIds: ["p_ING-2-I01"], valorMaximo: 100 },
  { id: "ins-f4", aspectoRegistroIds: ["p_ING-2-I04"], valorMaximo: 100 },
  { id: "ins-x", aspectoRegistroIds: ["p_ING-9-I99"], valorMaximo: 100 },
];
const resAna = (instrumentoId, puntaje, fecha, extra = {}) => ({
  resultadoId: `${instrumentoId}__${ANA}`, instrumentoId, estudianteId: ANA, estado: "evaluado",
  puntajeObtenido: puntaje, puntajeMaximo: 100, fechaEvaluacion: fecha, ...extra,
});
const resultados = [
  resAna("ins-f3", 85, "2026-10-31T15:00:00.000Z"), // P2 (P1 cierra el 30-oct)
  resAna("ins-f4", 60, "2026-10-20T15:00:00.000Z"), // P1
  resAna("ins-x", 100, "2026-10-20T15:00:00.000Z"), // indicador fuera de la malla
];
const notaDe = (aspectoId, valorObtenido, extra = {}) => ({ aspectoId, estudianteId: ANA, valorObtenido, ...extra });
const notasAna = [notaDe("p_ING-2-I01", 29), notaDe("p_ING-2-I04", 20), notaDe("p_ING-9-I99", 10)];
const base = { competencias, aspectos, instrumentos, resultados, notas: notasAna, ids: [ANA], nivel: "Secundaria" };

console.log("\nF7 — C.F. desde los indicadores, evidencias y id legado\n");

check("celda = competencia de la malla × período por fecha; fuera de la malla, visible", () => {
  const r = celdasDesdeIndicadores(base);
  igual(r.celdas, { "0|1": 85, "1|0": 61 }, "I01 85 % → C01 P2; I04 60 % (20/33) → C02 P1");
  igual(r.sinCompetencia, ["ING-9-I99"], "indicador sin competencia en la malla");
  igual(r.sinPeriodo, 0, "todas con fecha");
});

check("sin fecha → no cuenta y se avisa; pendientes y otros estudiantes no cuentan", () => {
  const r = celdasDesdeIndicadores({ ...base, resultados: [
    resAna("ins-f3", 85, ""),
    resAna("ins-f4", 0, "2026-10-20", { estado: "pendiente" }),
    { ...resAna("ins-f4", 10, "2026-10-20"), estudianteId: "otro" },
  ] });
  igual(r.celdas, {}, "nada evaluado con fecha");
  igual(r.sinPeriodo, 1, "un resultado sin fecha");
});

check("ajuste manual del indicador vale si todo cae en un período", () => {
  const notas = [notaDe("p_ING-2-I01", 34, { ajusteManual: true })];
  igual(celdasDesdeIndicadores({ ...base, notas }).celdas["0|1"], 100, "34/34 del ajuste manual");
});

check("sin nota por indicador en el Registro, el resultado no cuenta (p. ej. una lista vieja)", () => {
  const r = celdasDesdeIndicadores({ ...base, notas: [notaDe("p_ING-2-I01", 29), notaDe("p_ING-2-I04", "")] });
  igual(r.celdas, { "0|1": 85 }, "I04 sin nota en el Registro no entra");
});

check("regla 12: celda a mano no se pisa (⚠ nuevo cálculo); vacía se llena; la calculada sin datos se vacía", () => {
  const notas = { competencias: [{ periodos: [{ p: "60", rp: "70" }, { p: "70", rp: "" }] }] };
  const { notas: n, cambios } = aplicarCeldasIndicadores(notas, { "0|1": 85, "1|0": 61 }, 2);
  const p2 = n.competencias[0].periodos[1];
  igual([p2.p, p2.ajusteManual, p2.desactualizado, p2.valorCalculado], ["70", true, true, 85], "P2 a mano conservada");
  const c2 = n.competencias[1].periodos[0];
  igual([c2.p, c2.fuente, c2.origenCelda], [61, "instrumentos", "indicadores"], "celda vacía llenada");
  igual(cambios, 2, "dos celdas tocadas");
  const sinDatos = aplicarCeldasIndicadores(n, { "0|1": 85 }, 2).notas.competencias[1].periodos[0];
  igual(sinDatos.p, "", "calculada que se quedó sin nota evaluada");
  igual(notasConCalculoAceptado(n).competencias[0].periodos[1].p, 85, "aceptar = usar el cálculo");
});

check("informe a la familia: C.F. con origen de cada celda y diferencia explicada", () => {
  const registroCalificaciones = { notasEstudiantes: {
    [ANA]: { competencias: [{ periodos: [{ p: "60", rp: "70" }, { p: "70", rp: "" }, { p: "65", rp: "70" }, { p: "90", rp: "" }] }] },
    "est-1": { competencias: [{ periodos: [{ p: "10", rp: "" }] }] }, // id legado: no es la fila del Registro
  } };
  const notas = [{ aspectoId: "p_ING-2-I01", estudianteId: ANA, valorObtenido: 29, puntajeMaximo: 34, porcentaje: 85 }];
  const inf = construirInformeFamilia({
    estudiante: { id: ANA, nombre: "Ana García" }, aspectos: aspectos.slice(0, 1), notas,
    resultados: resultados.slice(0, 1), registroCalificaciones, competencias, instrumentos, nivel: "Secundaria",
    ids: [ANA, "est-1"], hoy: "2026-10-31",
  });
  igual(inf.cf.cf, 75, "C.F. del Registro (las 4 celdas a mano)");
  igual(inf.cf.distintas, [{ celda: "ING-2-C01 P2", aMano: 70, calculo: 85 }], "P2 a mano ≠ cálculo");
  igual(inf.cf.cfConCalculo, 79, "70, 85, 70, 90 → 79");
  const texto = textoInformeFamilia(inf);
  assert(texto.includes("ING-2-C01 P2: a mano 70; según los indicadores 85"), "celda explicada");
  assert(texto.includes("Con el cálculo desde los indicadores, la C.F. sería 79."), "C.F. con el cálculo");
  assert(texto.includes("Por qué no es igual al promedio por indicador (85 %)"), "diferencia con el 85 % explicada");
  assert(!texto.includes("Son dos registros distintos"), "ya no es un aviso sin explicación");
  igual(cfDelRegistro({ registroCalificaciones, ids: ["est-carlos-perez-1", "est-1"] }), null, "Carlos no toma la fila «est-1»");
});

check("informe sin malla: aviso como antes, sin cálculo", () => {
  const inf = construirInformeFamilia({
    estudiante: { id: ANA }, aspectos: aspectos.slice(0, 1),
    notas: [{ aspectoId: "p_ING-2-I01", estudianteId: ANA, valorObtenido: 29, puntajeMaximo: 34, porcentaje: 85 }],
    registroCalificaciones: { notasEstudiantes: { [ANA]: { competencias: [{ periodos: [{ p: "75", rp: "" }] }] } } },
    ids: [ANA], hoy: "2026-10-31",
  });
  assert(inf.cfSinMalla && textoInformeFamilia(inf).includes("Sin malla oficial"), "aviso visible");
});

check("evidencias: retirada, nota quitada y copia del puente legacy no se muestran", () => {
  const evid = [
    { id: "evi-ins-f3__est-ricardo-flores-16", tipo: "resultado_instrumento", resultadoId: "ins-f3__est-ricardo-flores-16", instrumentoId: "ins-f3", estudianteId: "est-ricardo-flores-16" },
    { id: "evi-ins-f4__ana", tipo: "resultado_instrumento", resultadoId: "ins-f4__ana", instrumentoId: "ins-f4", estudianteId: "ana", retirada: true },
    { id: "evi-ins-f5__ana", tipo: "resultado_instrumento", resultadoId: "ins-f5__ana", instrumentoId: "ins-f5", estudianteId: "ana" },
    { id: "eval-plan-P1_ins-f5_ana", tipo: "otro", instrumentoId: "ins-f5", estudianteId: "ana" },
    { id: "eval-plan-P1_ins-viejo_ana", tipo: "otro", instrumentoId: "ins-viejo", estudianteId: "ana" },
  ];
  const resultadosR = [{ resultadoId: "ins-f3__est-ricardo-flores-16", estado: "pendiente" }];
  igual(evidenciasVigentes(evid, resultadosR).map((e) => e.id), ["evi-ins-f5__ana", "eval-plan-P1_ins-viejo_ana"], "vigentes");
  igual(evidenciasVigentes(evid).length, 3, "sin resultados: solo retirada y copia fuera");
  const ev = construirEvidenciaDesdeResultado({ resultadoId: "r", estado: "evaluado", estudianteId: "a", cursoId: "c", instrumentoId: "i", puntajeObtenido: 1, puntajeMaximo: 1 });
  igual(ev.retirada, false, "re-evaluar devuelve la evidencia");
});

const lista = [{ nombre: "Ana García", id: ANA }, { nombre: "Carlos Pérez", id: "est-carlos-perez-1" }];
check("«est-1»: ambiguo para Ana (Modo Aula) y Carlos (Instrumentos)", () => {
  igual(idsAmbiguosEstudiante(lista[0], 0), { nombre: "Ana García", ambiguos: ["est-1"], sinNombre: "est-1" }, "Ana");
  igual(idsAmbiguosEstudiante(lista[1], 1), { nombre: "Carlos Pérez", ambiguos: ["est-2", "est-1"], sinNombre: "est-2" }, "Carlos");
  assert(idsLegadoEstudiante(lista[1], 1).includes("est-1"), "la lectura sigue trayendo est-1 (no se pierde nada)");
});

check("se decide por el nombre guardado; sin nombre, la numeración de Modo Aula", () => {
  const carlos = idsAmbiguosEstudiante(lista[1], 1);
  const ana = idsAmbiguosEstudiante(lista[0], 0);
  const r = { estudianteId: "est-1", estudianteNombre: "Ana García" };
  assert(esDelEstudiante(r, ana) && !esDelEstudiante(r, carlos), "resultado de Ana");
  assert(esDelEstudiante({ estudianteId: "est-1", estudianteNombre: "carlos perez" }, carlos), "nombre sin tildes/mayúsculas");
  assert(!esDelEstudiante({ estudianteId: "est-1" }, carlos) && esDelEstudiante({ estudianteId: "est-2" }, carlos), "sin nombre");
  assert(esDelEstudiante({ estudianteId: "est-carlos-perez-1" }, carlos), "id real siempre");
  const dias = asistenciaDelEstudiante([{ fecha: "x", marcas: { "est-1": "ausente", "est-2": "presente" } }], carlos);
  igual(dias[0].marcas, { "est-2": "presente" }, "pase de lista: solo su marca de Modo Aula");
});

check("depurar: la evidencia sin nombre toma el de su resultado", () => {
  const datos = {
    resultados: [{ resultadoId: "lista__est-1", estudianteId: "est-1", estudianteNombre: "Ana García", estado: "evaluado" }],
    evidencias: [{ id: "evi-lista__est-1", resultadoId: "lista__est-1", estudianteId: "est-1" }],
  };
  const carlos = depurarDatosLegado(datos, idsAmbiguosEstudiante(lista[1], 1));
  igual([carlos.resultados.length, carlos.evidencias.length], [0, 0], "nada de Ana para Carlos");
  const ana = depurarDatosLegado(datos, idsAmbiguosEstudiante(lista[0], 0));
  igual([ana.resultados.length, ana.evidencias.length], [1, 1], "Ana conserva lo suyo");
});

check("coordinación: Carlos no hereda la alerta de los ING-1 de Ana", () => {
  const estudiantes = lista.map((e, i) => ({ ...e, idsLegado: idsLegadoEstudiante(e, i, { cursoId: "c" }), legadoAmbiguo: idsAmbiguosEstudiante(e, i) }));
  const c = construirInformeCurso({
    estudiantes, actividades: [], aspectos: [], notas: [], asistencia: [], hoy: "2026-10-31",
    resultados: [{ instrumentoId: "lista", estudianteId: "est-1", estudianteNombre: "Ana García", estado: "evaluado", puntajeObtenido: 50, puntajeMaximo: 100, porcentaje: 50, indicadorIds: ["ING-1-I01"] }],
  });
  igual(c.apoyo.map((a) => a.nombre), ["Ana García"], "solo Ana");
});

console.log(`\n${pasos} ok, ${fallos} fallos\n`);
if (fallos) process.exit(1);
