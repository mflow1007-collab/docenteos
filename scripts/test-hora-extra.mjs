/**
 * Hora extra en Modo Aula (src/utils/horaExtra.js).
 *
 * Ejecutar:  node scripts/test-hora-extra.mjs
 *
 * Una hora de hoy fuera del horario, la clase que se adelanta y que no se repita
 * en su fecha. NO cubre la escritura en Firestore ni la pantalla.
 */

import {
  aplicarListaACurso, claseParaMostrar, clasesPendientes, fechaLegible, horaExtraVigente, horasOcupadasHoy, mapaClasesDadas,
} from "../src/utils/horaExtra.js";
import { claseDeAhora, proximaClase } from "../src/utils/horarioSemanal.js";
import { obtenerClaseDeHoy } from "../src/services/hiloPedagogico.js";
import { enriquecerCursoInicial } from "../src/utils/cursoUtils.js";

let pasos = 0, fallos = 0;
const check = (n, fn) => { try { fn(); pasos += 1; console.log(`  ✓ ${n}`); } catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); } };
const assert = (c, m) => { if (!c) throw new Error(m); };
const igual = (a, b, m = "") => assert(JSON.stringify(a) === JSON.stringify(b), `${m}\n      esperado: ${JSON.stringify(b)}\n      obtenido: ${JSON.stringify(a)}`);

// Lunes 23 a viernes 27 de noviembre de 2026 (hora local)
const momento = (dia, h, m = 0) => new Date(2026, 10, dia, h, m);
const curso = (id, area, extra = {}) =>
  enriquecerCursoInicial({ id, nombre: "2do Secundaria A", area, nivel: "Secundaria", estudiantes: 0, ...extra });
const FIJO = [{ dia: "Lunes", hora: 3 }, { dia: "Jueves", hora: 3 }];
const ingles = curso("ing", "Inglés", { horarioSemanal: FIJO });
const frances = curso("fra", "Francés", { horarioSemanal: [{ dia: "Miércoles", hora: 6 }] });
const capa = {
  clases: [
    { claseId: "c1", numeroClase: 1, titulo: "Uno", fechaSugerida: "2026-11-23" },
    { claseId: "c2", numeroClase: 2, titulo: "Dos", fechaSugerida: "2026-11-26" },
    { claseId: "c3", numeroClase: 3, titulo: "Tres", fechaSugerida: "2026-11-30" },
    { claseId: "c4", numeroClase: 4, titulo: "Cuatro", fechaSugerida: "2026-12-03" },
  ],
};
// Miércoles 25: hora extra en la 4.ª, adelantando c2 (prevista para el jueves 26)
const EXTRA = { fecha: "2026-11-25", hora: 4, planId: "p", claseId: "c2" };
const conExtra = { ...ingles, horasExtra: [EXTRA] };
const DADA = { planId: "p", claseId: "c2", fecha: "2026-11-25", extra: true };
const adelantado = { ...conExtra, clasesDadas: [DADA] };
const mostrar = (c, ahora) => { const r = claseParaMostrar(capa, c, "p", ahora); return [r.clase?.claseId, r.motivo]; };

console.log("\nHora extra en Modo Aula\n");

check("las horas de hoy ya ocupadas, fijas o extra, se reconocen", () => {
  const o = horasOcupadasHoy([conExtra, frances], momento(25, 8));
  igual(Object.entries(o).map(([h, c]) => [h, c.materia]), [["4", "Inglés"], ["6", "Francés"]]);
});

check("la hora extra es la clase de ahora solo en su fecha", () => {
  igual([claseDeAhora([conExtra], momento(25, 11, 5))?.hora, claseDeAhora([conExtra], momento(25, 11, 5))?.extra], [4, true]);
  igual(claseDeAhora([conExtra], momento(26, 11, 5)), null, "mañana ya no");
  igual(claseDeAhora([conExtra], new Date(2026, 11, 2, 11, 5)), null, "el miércoles siguiente tampoco");
});

check("próxima clase la anuncia como extra y el horario fijo no cambia", () => {
  igual(proximaClase([conExtra], momento(25, 8))?.texto, "Hoy, 4.ª hora extra · 11:00 a. m.");
  igual(proximaClase([conExtra], momento(25, 12))?.cuando, "Mañana");
  igual(conExtra.horarioSemanal, FIJO);
});

check("si la hora extra coincide con una fija no se duplica", () => {
  const c = { ...ingles, horasExtra: [{ fecha: "2026-11-26", hora: 3 }] };
  igual(claseDeAhora([c], momento(26, 9, 45))?.extra, undefined);
});

check("clases pendientes: siguientes y atrasadas, sin las ya dadas", () => {
  const ids = (...x) => { const r = clasesPendientes(...x); return [r.siguientes.map((c) => c.claseId), r.atrasadas.map((c) => c.claseId)]; };
  igual(ids(capa, ingles, "p", momento(25, 8)), [["c2", "c3", "c4"], ["c1"]]);
  igual(ids(capa, adelantado, "p", momento(25, 8)), [["c3", "c4"], ["c1"]]);
  igual(ids(capa, adelantado, "p", new Date(2027, 0, 10)), [[], ["c1", "c3", "c4"]], "plan con las fechas pasadas");
  igual(ids({ clases: [{ claseId: "a" }] }, ingles, "p"), [["a"], []], "sin fecha cuenta como siguiente");
  igual(ids(undefined, ingles, "p"), [[], []], "curso sin plan");
});

check("una clase atrasada tomada como hora extra se muestra y al darla sale de la lista", () => {
  const c = { ...ingles, horasExtra: [{ fecha: "2026-11-25", hora: 4, planId: "p", claseId: "c1" }] };
  igual(mostrar(c, momento(25, 11, 5)), ["c1", "extra"]);
  const dada = { ...c, clasesDadas: [{ planId: "p", claseId: "c1", fecha: "2026-11-25", extra: true }] };
  igual(clasesPendientes(capa, dada, "p", momento(25, 12)).atrasadas, []);
  igual(mostrar(dada, momento(26, 9, 45)), ["c2", "hoy"], "no corre las demás");
});

check("durante la hora extra se muestra la clase elegida", () => {
  igual(mostrar(conExtra, momento(25, 11, 5)), ["c2", "extra"]);
  igual(mostrar(conExtra, momento(25, 12)), ["c2", "extra"], "al terminar la hora, si no se finalizó");
});

check("una clase fija en curso manda sobre la hora extra sin finalizar", () => {
  const c = { ...ingles, horarioSemanal: [...FIJO, { dia: "Miércoles", hora: 5 }], horasExtra: [EXTRA] };
  igual(horaExtraVigente(c, momento(25, 13)), null);
  igual(horaExtraVigente(c, momento(25, 11, 5))?.claseId, "c2");
});

check("la hora extra de otro plan no cambia la clase de este", () => {
  const c = { ...ingles, horasExtra: [{ ...EXTRA, planId: "otro" }] };
  igual(mostrar(c, momento(25, 11, 5)), ["c2", "proxima"]);
});

check("clase adelantada: en su fecha sale la siguiente y se dice cuál se saltó", () => {
  const r = claseParaMostrar(capa, adelantado, "p", momento(26, 9, 45));
  igual([r.clase.claseId, r.motivo, r.saltada.claseId], ["c3", "adelantada", "c2"]);
});

check("la cadena sigue: dada c3 el jueves, el lunes sale c4", () => {
  const c = { ...adelantado, clasesDadas: [DADA, { planId: "p", claseId: "c3", fecha: "2026-11-26", extra: false }] };
  igual(mostrar(c, momento(26, 10, 20)), ["c3", "adelantada"], "el mismo jueves, ya finalizada, sigue c3");
  igual(mostrar(c, momento(30, 9, 45)), ["c4", "adelantada"]);
});

check("después de finalizar la extra, el mismo día muestra la próxima", () => {
  igual(mostrar(adelantado, momento(25, 12)), ["c3", "proxima"]);
});

check("finalizar hoy en la hora normal no cambia la clase de hoy", () => {
  const c = { ...ingles, clasesDadas: [{ planId: "p", claseId: "c2", fecha: "2026-11-26", extra: false }] };
  igual(mostrar(c, momento(26, 12)), ["c2", "hoy"]);
});

check("quitar la marca devuelve la clase a su fecha", () => {
  const [c] = aplicarListaACurso([adelantado], "ing", "clasesDadas", { quitar: { extra: true, fecha: "2026-11-25", claseId: "c2", planId: "p" } });
  igual(c.clasesDadas, []);
  igual(mostrar(c, momento(26, 9, 45)), ["c2", "hoy"]);
});

check("fecha legible en hora local", () => {
  assert(/jueves.*26.*noviembre/.test(fechaLegible("2026-11-26")), fechaLegible("2026-11-26"));
  igual(fechaLegible(""), "");
});

check("sin nada registrado, la clase de hoy es la de siempre", () => {
  ["2026-11-23", "2026-11-24", "2026-11-26", "2027-01-10"].forEach((f) => {
    const r = claseParaMostrar(capa, ingles, "p", new Date(`${f}T09:00:00`));
    igual(r, obtenerClaseDeHoy(capa, f), f);
  });
  igual(claseParaMostrar(null, null, "p").clase, null);
});

check("plan sin fechas: avanza a la primera que falta", () => {
  const sinFechas = { clases: [{ claseId: "a", numeroClase: 1 }, { claseId: "b", numeroClase: 2 }] };
  const c = { ...ingles, clasesDadas: [{ planId: "p", claseId: "a", fecha: "2026-11-20", extra: false }] };
  igual(claseParaMostrar(sinFechas, c, "p", momento(25, 8)).clase.claseId, "b");
});

check("otra sección con el mismo plan no hereda lo dado", () => {
  igual(mapaClasesDadas(frances, "p").size, 0);
  igual(mapaClasesDadas(adelantado, "otro").size, 0);
});

check("poner dos veces no duplica y los demás cursos no cambian", () => {
  const una = aplicarListaACurso([ingles, frances], "ing", "horasExtra", { agregar: EXTRA });
  const dos = aplicarListaACurso(una, "ing", "horasExtra", { agregar: { ...EXTRA } });
  igual(dos[0].horasExtra, [EXTRA]);
  assert(dos[1] === frances, "Francés intacto");
  igual({ ...una[0], horasExtra: 0 }, { ...ingles, horasExtra: 0 }, "el resto del curso igual");
});

console.log(`\n${pasos} correctas, ${fallos} fallidas\n`);
if (fallos) process.exit(1);
