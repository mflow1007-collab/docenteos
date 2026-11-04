/**
 * test-mapa-clases.mjs — Mapa de clases (Etapa 1 del esqueleto). Sin IA.
 * Recorre las 3 semillas de Inglés 2do y temas sin semilla, de 1 a 8 semanas, con
 * varios horarios, y comprueba las reglas de calidad. Alimentación a 6 semanas debe
 * coincidir con la unidad de referencia fijada por César el 2026-11-04.
 *
 * Ejecutar: node scripts/test-mapa-clases.mjs            (pruebas)
 *           node scripts/test-mapa-clases.mjs --informe  (además, tabla por combinación)
 */
import { readFileSync } from "node:fs";
import { armarMapaClases, verificarMapa, tiposDeSecciones, minutosDesarrollo } from "../src/services/mapaClasesService.js";
import { construirPlanMaestro } from "../src/services/planMaestroService.js";
import { armarEntradaPlanMaestro, prellenarPlanMaestro, resolverIndicadoresEstructurados, competenciasDeMalla } from "../src/services/vistaPreviaPlanMaestroService.js";
import { TAREAS_POR_TIPO } from "../src/data/tareasPorTipoTrabajo.js";

let pasos = 0, fallos = 0;
const check = (n, fn) => { try { fn(); pasos += 1; console.log(`  ✓ ${n}`); } catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); } };
const assert = (c, m) => { if (!c) throw new Error(m); };
const igual = (a, b, m) => assert(JSON.stringify(a) === JSON.stringify(b), `${m}\n      esperado: ${JSON.stringify(b)}\n      obtenido: ${JSON.stringify(a)}`);

const malla = JSON.parse(readFileSync(new URL("../src/data/curriculo/mallas/malla_ingles_2do_secundaria_2023.json", import.meta.url), "utf8"));
const estructura = resolverIndicadoresEstructurados(malla);
const competencias = competenciasDeMalla(malla, estructura.indicadores);
const SEMILLAS = ["Escuela y educación", "Actividades de la vida diaria", "Alimentación"];
const SIN_SEMILLA = ["Salud y cuidados físicos", "Viajes y turismo", "Bienes y servicios"];
const HORARIOS = { "3x1": [["l", "m", "x"], 1], "2x1": [["l", "m"], 1], "5x1": [["l", "m", "x", "j", "v"], 1], "2x2": [["l", "m"], 2] };

const entrada = (titulo, semanas, dias, horas, extra = {}) => {
  const base = { grado: "2do Secundaria", asignatura: "Inglés", centro: "Centro de prueba - Hato Nuevo", numSemanas: semanas, diasClase: dias, horasPorDia: horas, titulo };
  const datos = { ...base, ...prellenarPlanMaestro({ datos: base, indicadores: estructura.indicadores, competencias }) };
  const planMaestro = { ...datos.planMaestro, ...(extra.planMaestro || {}) };
  return armarEntradaPlanMaestro({ datos: { ...datos, planMaestro }, mallaPayload: malla }).entrada;
};
const mapaDe = (titulo, semanas, [dias, horas], extra) => armarMapaClases({ ...entrada(titulo, semanas, dias, horas, extra), ...(extra?.mapa || {}) });

console.log("\n[Mapa de clases — unidad de referencia]");
const ref = mapaDe("Alimentación", 6, HORARIOS["3x1"]);
// Una fila por clase de la referencia v3: fase, secciones, tareas, indicadores.
const I = "Interviews with Owners", L = "Our Local Food", M = "Bilingual Menus", H = "Healthy Choices", O = "Ordering Food";
const TODAS = [I, L, M, H, O];
const REFERENCIA = [
  [1, TODAS, ["acordar"], ["ING-2-I01"]],
  [2, [I], ["visitar_modelo"], ["ING-2-I01"]],
  [2, [I], ["visitar_guion"], ["ING-2-I02"]],
  [3, [I], ["visitar_entrevistar"], ["ING-2-I03"]],
  [4, [I], ["visitar_registrar"], ["ING-2-I02"]],
  [4, [L], ["describir_modelo", "describir_redactar"], ["ING-2-I02"]],
  [5, [M], ["analizar_ordenar"], ["ING-2-I01"]],
  [5, [M], ["analizar_borrador"], ["ING-2-I02"]],
  [5, [H], ["proponer_comparar"], ["ING-2-I01"]],
  [6, [I, L, M], ["comentar"], ["ING-2-I03"]],
  [6, [I, L], ["corregir"], ["ING-2-I02"]],
  [7, [H], ["proponer_elegir", "proponer_elaborar"], ["ING-2-I03", "ING-2-I02"]],
  [7, [M, H], ["corregir"], ["ING-2-I02"]],
  [8, [O], ["aplicar_modelo", "aplicar_escribir"], ["ING-2-I01", "ING-2-I02"]],
  [8, [O], ["aplicar_ensayar", "aplicar_anotar"], ["ING-2-I03"]],
  [8, TODAS, ["aplicar_corregir", "integrar"], ["ING-2-I02"]],
  [8, TODAS, ["presentar"], ["ING-2-I02", "ING-2-I03"]],
  [9, TODAS, ["evaluar_comentarios", "evaluar_proceso"], ["ING-2-I01"]],
];
check("Alimentación a 6 semanas: 18 clases y modo normal, sin ampliaciones ni clases flexibles", () => {
  igual(ref.filas.length, 18, "filas");
  igual(ref.modo, "normal", "modo");
  assert(ref.filas.every((f) => !f.flexible && f.tareas.every((t) => !t.ampliacion)), "hay relleno o ampliación");
});
REFERENCIA.forEach(([fase, secciones, tareas, indicadores], i) => {
  check(`clase ${i + 1} coincide con la referencia (fase ${fase}: ${tareas.join(" + ")})`, () => {
    const f = ref.filas[i];
    igual(f.fases.map((x) => x.numero), [fase], "fase");
    igual([...f.secciones].sort(), [...secciones].sort(), "secciones");
    igual(f.tareas.map((t) => t.clave), tareas, "tareas");
    igual([...f.indicadores].sort(), [...indicadores].sort(), "indicadores");
    igual(f.minutos, 30, "minutos");
  });
});
check("la visita ocurre una sola vez, en la clase 4, con el invitado", () => {
  const conModalidad = ref.filas.filter((f) => f.modalidad);
  igual(conModalidad.map((f) => [f.clase, f.modalidad]), [[4, "invitado"]], "modalidad");
});
check("el reparto por fases es el de la referencia y el plan maestro lo acepta", () => {
  igual(ref.ajustesPlan.sesionesPorFase, [1, 2, 1, 2, 3, 2, 2, 4, 1], "sesiones");
  const e = entrada("Alimentación", 6, ...HORARIOS["3x1"]);
  const plan = construirPlanMaestro({ ...e, ajustes: ref.ajustesPlan });
  igual(plan.fases.map((f) => f.sesiones), [1, 2, 1, 2, 3, 2, 2, 4, 1], "plan");
});

console.log("\n[Mapa de clases — datos y casos límite]");
check("las tareas normales de cada tipo salen de una lista cerrada, con evidencia oficial", () => {
  Object.values(TAREAS_POR_TIPO).flat().forEach((t) => {
    assert(["conocimiento", "desempeno", "producto"].includes(t.evidencia), `${t.clave}: evidencia ${t.evidencia}`);
    assert(t.minutos[0] <= t.minutos[1], `${t.clave}: minutos`);
    assert(t.recursos?.didacticos, `${t.clave}: recursos`);
  });
});
check("menos de 3 clases: error visible, sin plantilla de relleno", () => {
  let msg = "";
  try { mapaDe("Alimentación", 1, [["l", "m"], 1]); } catch (e) { msg = e.message; }
  assert(/al menos 3/.test(msg), `mensaje: ${msg}`);
});
check("sin semilla: el tipo se supone por posición, se declara y nunca inventa una visita", () => {
  const { tipos, supuestas } = tiposDeSecciones(["A", "B", "C", "D"]);
  igual(tipos, { A: "describir", B: "analizar", C: "proponer", D: "aplicar" }, "tipos");
  igual(supuestas, ["A", "B", "C", "D"], "supuestas");
  const m = mapaDe("Viajes y turismo", 4, HORARIOS["3x1"]);
  assert(m.avisos.some((a) => /supuesto/.test(a)), "sin aviso");
  assert(!Object.values(m.tipos).includes("visitar"), "inventó una visita");
});
check("a 1 semana: versión breve, entrevista simulada y declarada", () => {
  const m = mapaDe("Alimentación", 1, HORARIOS["3x1"]);
  igual(m.modo, "breve", "modo");
  assert(m.filas.some((f) => f.modalidad === "simulada"), "no es simulada");
  assert(m.avisos.some((a) => /simulada/.test(a)) && m.avisos.some((a) => /breve/.test(a)), "no lo declara");
});
check("la selección de contenidos manda: lo no seleccionado no entra", () => {
  const e = entrada("Alimentación", 6, ...HORARIOS["3x1"]);
  const m = armarMapaClases({ ...e, contenidosSeleccionados: ["Funcional: Comprar"] });
  igual(m.filas.flatMap((f) => f.contenidos.map((c) => c.texto)), ["Funcional: Comprar"], "contenidos");
});
check("los minutos del Desarrollo siguen la duración de la clase", () => {
  igual([45, 60, 90].map(minutosDesarrollo), [30, 35, 65], "minutos");
  assert(verificarMapa(armarMapaClases({ ...entrada("Alimentación", 3, ...HORARIOS["3x1"]), duracionMin: 90 })).length === 0, "90 min no cumple");
});
check("todos los indicadores de todas las competencias tienen tarea", () => {
  const todos = { competenciasElegidas: competencias.map((c) => c.id), indicadoresElegidos: estructura.indicadores.map((i) => i.id) };
  const m = mapaDe("Alimentación", 6, HORARIOS["3x1"], { planMaestro: todos });
  igual(verificarMapa(m), [], "reglas");
  igual(m.indicadores.length, 21, "21 indicadores");
});
check("las siete estrategias cumplen las reglas a 6 semanas", () => {
  ["proyectos", "problemas", "indagacion_dialogica", "insercion_entorno", "estudio_caso", "conocimientos_previos", "expositiva"].forEach((estrategia) => {
    const m = mapaDe("Alimentación", 6, HORARIOS["3x1"], { planMaestro: { estrategia } });
    igual(verificarMapa(m), [], estrategia);
  });
});

console.log("\n[Mapa de clases — combinaciones]");
const filas = [];
for (const titulo of [...SEMILLAS, ...SIN_SEMILLA]) for (const [nombre, h] of Object.entries(HORARIOS)) for (let semanas = 1; semanas <= 8; semanas += 1) {
  const total = semanas * h[0].length * h[1];
  if (total < 3) { filas.push({ titulo, nombre, semanas, total, modo: "error visible", problemas: [] }); continue; }
  const m = mapaDe(titulo, semanas, h);
  const problemas = verificarMapa(m);
  if (m.ajustesPlan) {
    try { construirPlanMaestro({ ...entrada(titulo, semanas, ...h), ajustes: m.ajustesPlan }); }
    catch (e) { problemas.push(`el plan maestro rechaza el reparto: ${e.message}`); }
  }
  filas.push({
    titulo, nombre, semanas, total, modo: m.modo, problemas,
    flexibles: m.filas.filter((f) => f.flexible).length,
    ampliaciones: m.filas.flatMap((f) => f.tareas).filter((t) => t.ampliacion).length,
    libres: m.filas.filter((f) => !f.flexible).reduce((s, f) => s + f.minutosLibres, 0),
    maxContenidos: Math.max(...m.filas.map((f) => f.contenidos.length)),
    maxTareas: Math.max(...m.filas.map((f) => f.tareas.length)),
  });
}
const conProblema = filas.filter((f) => f.problemas.length);
check(`las ${filas.length} combinaciones cumplen las reglas de calidad`, () => {
  assert(!conProblema.length, `${conProblema.length} fallan; primera: ${conProblema[0]?.titulo} ${conProblema[0]?.nombre} ${conProblema[0]?.semanas} sem: ${conProblema[0]?.problemas[0]}`);
});
check("con 3 clases semanales de 45 min no hay clases flexibles hasta 6 semanas", () => {
  const malas = filas.filter((f) => f.nombre === "3x1" && f.semanas <= 6 && f.flexibles);
  assert(!malas.length, `${malas.map((f) => `${f.titulo} ${f.semanas}`).join("; ")}`);
});

check("la versión breve aprovecha el tiempo: sin minutos sobrantes de más", () => {
  const malas = filas.filter((f) => f.modo === "breve" && f.libres > f.total * 3);
  assert(!malas.length, `${malas.length}; primera: ${malas[0]?.titulo} ${malas[0]?.nombre} ${malas[0]?.semanas} sem, ${malas[0]?.libres} min libres`);
});

if (process.argv.includes("--informe")) {
  console.log("\nTema | horario | semanas | clases | modo | ampl. | flex. | min libres | máx. contenidos | máx. tareas | problemas");
  filas.forEach((f) => console.log([f.titulo, f.nombre, f.semanas, f.total, f.modo, f.ampliaciones ?? "", f.flexibles ?? "", f.libres ?? "", f.maxContenidos ?? "", f.maxTareas ?? "", f.problemas.length].join(" | ")));
}
console.log(`\nResultado: ${pasos} pasan, ${fallos} fallan.`);
if (fallos) process.exit(1);
