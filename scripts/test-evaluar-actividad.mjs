/**
 * F4 — Evaluar desde la actividad (src/services/actividadesPlan.js +
 * consolidación en src/services/hiloPedagogico.js).
 *
 * Ejecutar:  node scripts/test-evaluar-actividad.mjs
 *
 * Cubre la lógica pura: puntuar la rúbrica por niveles (fail-closed), que cada
 * aspecto tome las filas de SU indicador (A1), excluir la actividad del cálculo
 * (B1), «No entregó» sin número (decisión 3) y quién se evalúa.
 * Lo que NO cubre: la escritura en Firestore (evaluarYRegistrar,
 * cambiarExclusionDeNota) ni la pantalla; se comprueban en el navegador.
 */

import {
  aplicarExclusion, construirRubricaActividad, debeQuitarNota, estudiantesParaEvaluar, nivelesDeResultado, puntuarRubrica,
} from "../src/services/actividadesPlan.js";
import {
  consolidarNotaAspecto, consolidarNotaEstudiante, construirResultadoInstrumento,
} from "../src/services/hiloPedagogico.js";
import { NIVELES_RUBRICA_GUIA } from "../src/data/descriptoresRubricaGuia2025.js";

let pasos = 0, fallos = 0;
const check = (n, fn) => { try { fn(); pasos += 1; console.log(`  ✓ ${n}`); } catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); } };
const assert = (c, m) => { if (!c) throw new Error(m); };
const igual = (a, b, m) => assert(JSON.stringify(a) === JSON.stringify(b), `${m}\n      esperado: ${JSON.stringify(b)}\n      obtenido: ${JSON.stringify(a)}`);
const lanza = (fn, patron, m) => {
  try { fn(); } catch (e) { assert(patron.test(e.message), `${m}: mensaje inesperado "${e.message}"`); return; }
  throw new Error(`${m}: no lanzó error`);
};

const fila = (id) => ({
  indicadorCodigo: id, indicador: `Indicador ${id}`,
  niveles: NIVELES_RUBRICA_GUIA.map((nivel) => ({ ...nivel, descriptor: `${nivel.nombre} en ${id}` })),
});
const estructura = construirRubricaActividad([fila("I01"), fila("I02")]); // 50 + 50 puntos
const rubrica = {
  id: "ins-plan1-actividad-f3", planificacionId: "plan1", cursoId: "curso-2do-a", valorMaximo: 100,
  indicadorIds: ["I01", "I02"], aspectoRegistroIds: ["plan1_I01", "plan1_I02"], estructura,
};
const claseI01 = { id: "ins-plan1-clase-2", valorMaximo: 100, aspectoRegistroIds: ["plan1_I01"] };
const aspecto = (ind) => ({ aspectoId: `plan1_${ind}`, indicadorId: ind, puntajeMaximo: 50 });

console.log("\nF4 — Evaluar desde la actividad");

check("puntuarRubrica: Autónomo en las dos filas = 85 con detalle por indicador", () => {
  const r = puntuarRubrica(estructura, { "crit-I01": "nivel3", "crit-I02": "nivel3" });
  igual([r.puntaje, r.puntajeMaximo], [85, 100], "total");
  igual(r.detalleCriterios.map((d) => [d.indicadorId, d.nivel, d.puntos, d.puntajeMaximo]),
    [["I01", "nivel3", 42.5, 50], ["I02", "nivel3", 42.5, 50]], "detalle");
});

check("puntuarRubrica es fail-closed: falta un nivel o el nivel no existe", () => {
  lanza(() => puntuarRubrica(estructura, { "crit-I01": "nivel3" }), /Falta el nivel/, "nivel faltante");
  lanza(() => puntuarRubrica(estructura, { "crit-I01": "nivel3", "crit-I02": "nivel9" }), /inválido/, "nivel inexistente");
  lanza(() => puntuarRubrica({ criterios: [] }, {}), /no tiene criterios/, "sin criterios");
});

check("el resultado guarda el detalle solo si está evaluado; No entregó sigue sin número", () => {
  const { puntaje, detalleCriterios } = puntuarRubrica(estructura, { "crit-I01": "nivel4", "crit-I02": "nivel2" });
  const evaluado = construirResultadoInstrumento({ instrumento: rubrica, estudianteId: "est-ana-0", puntajeObtenido: puntaje, detalleCriterios });
  igual([evaluado.puntajeObtenido, evaluado.detalleCriterios.length], [85, 2], "evaluado con detalle");
  igual(nivelesDeResultado(evaluado), { "crit-I01": "nivel4", "crit-I02": "nivel2" }, "precarga de niveles");
  const noEntrego = construirResultadoInstrumento({ instrumento: rubrica, estudianteId: "est-ricardo-1", estado: "no_entrego", detalleCriterios });
  igual([noEntrego.puntajeObtenido, noEntrego.detalleCriterios], [null, []], "no_entrego sin número ni detalle");
});

check("A1: cada aspecto toma las filas de su indicador (85 = 100 % en I01 y 70 % en I02)", () => {
  const { puntaje, detalleCriterios } = puntuarRubrica(estructura, { "crit-I01": "nivel4", "crit-I02": "nivel2" });
  const r = construirResultadoInstrumento({ instrumento: rubrica, estudianteId: "est-ana-0", puntajeObtenido: puntaje, detalleCriterios });
  const i01 = consolidarNotaAspecto({ aspecto: aspecto("I01"), instrumentos: [rubrica], resultados: [r] });
  const i02 = consolidarNotaAspecto({ aspecto: aspecto("I02"), instrumentos: [rubrica], resultados: [r] });
  igual([i01.valorCalculado, i01.valorCalculadoPuntos], [100, 50], "I01");
  igual([i02.valorCalculado, i02.valorCalculadoPuntos], [70, 35], "I02");
});

check("sin detalle (Modo Aula, ficha, Registro) el aspecto toma el resultado completo, como antes", () => {
  const r = construirResultadoInstrumento({ instrumento: rubrica, estudianteId: "est-ana-0", puntajeObtenido: 85 });
  const i02 = consolidarNotaAspecto({ aspecto: aspecto("I02"), instrumentos: [rubrica], resultados: [r] });
  igual(i02.valorCalculado, 85, "nota completa");
});

check("B1: la actividad excluida no cuenta ni queda pendiente; incluirla la devuelve", () => {
  const rAct = construirResultadoInstrumento({ instrumento: rubrica, estudianteId: "est-ana-0", puntajeObtenido: 40 });
  const rClase = construirResultadoInstrumento({ instrumento: claseI01, estudianteId: "est-ana-0", puntajeObtenido: 90 });
  const incluida = consolidarNotaEstudiante({ instrumentos: [rubrica, claseI01], resultados: [rAct, rClase] });
  igual(incluida.valorCalculado, 65, "con la actividad");
  const lista = aplicarExclusion([rubrica, claseI01], rubrica.id, true);
  const excluida = consolidarNotaEstudiante({ instrumentos: lista, resultados: [rAct, rClase] });
  igual([excluida.valorCalculado, excluida.pendientes, excluida.esParcial], [90, [], false], "sin la actividad");
  const deNuevo = aplicarExclusion(lista, rubrica.id, false);
  igual(consolidarNotaEstudiante({ instrumentos: deNuevo, resultados: [rAct, rClase] }).valorCalculado, 65, "reincluida");
});

check("B1: si el aspecto solo tenía la actividad excluida, queda sin valor calculado", () => {
  const r = construirResultadoInstrumento({ instrumento: rubrica, estudianteId: "est-ana-0", puntajeObtenido: 85 });
  const c = consolidarNotaAspecto({ aspecto: aspecto("I02"), instrumentos: aplicarExclusion([rubrica], rubrica.id, true), resultados: [r] });
  igual([c.valorCalculado, c.valorCalculadoPuntos], [null, null], "aspecto vacío");
});

check("estudiantesParaEvaluar: entregó → rúbrica; no entregó → decisión; pendiente y excusa aparte", () => {
  const g = estudiantesParaEvaluar({
    "est-ricardo-1": { estado: "no_entrego", nombre: "Ricardo" },
    "est-ana-0": { estado: "entrego", nombre: "Ana" },
    "est-luis-2": { estado: "excusa", nombre: "Luis" },
    "est-bea-3": { nombre: "Bea" },
  });
  igual([g.entrego.map((e) => e.id), g.no_entrego.map((e) => e.id), g.conNota.map((e) => e.id), g.sinEvaluar.map((e) => e.id)],
    [["est-ana-0"], ["est-ricardo-1"], [], ["est-bea-3", "est-luis-2"]], "grupos");
});

check("quien tiene nota y ya no figura como Entregó/No entregó sigue a la vista para quitarla", () => {
  const g = estudiantesParaEvaluar({
    "est-ricardo-1": { estado: "excusa", nombre: "Ricardo" },
    "est-luis-2": { estado: "excusa", nombre: "Luis" },
  }, ["est-ricardo-1"]);
  igual([g.conNota.map((e) => [e.id, e.estado]), g.sinEvaluar.map((e) => e.id)],
    [[["est-ricardo-1", "excusa"]], ["est-luis-2"]], "con nota aparte");
});

check("decisión 3: Otra oportunidad o Excusa quitan una nota puesta; nada más la toca", () => {
  const cero = construirResultadoInstrumento({ instrumento: rubrica, estudianteId: "est-ricardo-1", puntajeObtenido: 0 });
  igual([debeQuitarNota("pendiente", cero), debeQuitarNota("excusa", cero)], [true, true], "quita el 0");
  igual([debeQuitarNota("entrego", cero), debeQuitarNota("no_entrego", cero), debeQuitarNota("excusa", null)],
    [false, false, false], "no toca");
  const quitado = construirResultadoInstrumento({ instrumento: rubrica, estudianteId: "est-ricardo-1", estado: "pendiente" });
  const c = consolidarNotaEstudiante({ instrumentos: [rubrica], resultados: [quitado] });
  igual([quitado.puntajeObtenido, c.valorCalculado], [null, null], "sin número en el Registro");
});

console.log(`\n${pasos} ok, ${fallos} fallo(s)\n`);
if (fallos) process.exit(1);
