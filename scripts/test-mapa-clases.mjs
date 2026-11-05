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
import { sinEquipos, minutosConDiagnostico, ENGANCHE_SIN_EQUIPOS } from "../src/services/mapaClasesService.js";
import { armarMapaClases, verificarMapa, fallosQueDetienen, TOPE_INDICADORES_POR_CLASE, tiposDeSecciones, minutosDesarrollo } from "../src/services/mapaClasesService.js";
import { construirPlanMaestro } from "../src/services/planMaestroService.js";
import { armarEntradaPlanMaestro, prellenarPlanMaestro, resolverIndicadoresEstructurados, competenciasDeMalla } from "../src/services/vistaPreviaPlanMaestroService.js";
import { TAREAS_POR_TIPO, DETALLE_TAREA, ALCANCE_POR_SEMILLA } from "../src/data/tareasPorTipoTrabajo.js";
import { componerSituacion, audienciasDeSituacion } from "../src/services/situacionAprendizajeService.js";
import { didacticosDeFila, conFirmas, INICIO_PRIMERA_CLASE, checklistDesdeMapa as checklistCorto, organizadorDesdeMapa as organizadorCorto } from "../src/services/mapaClasesService.js";
import { hojaDeRuta, planDesdeMapa, aporteDeFila, TOPE_CONTENIDOS_POR_CLASE, conFichaDeUnidad, ambienteDeMapa, evaluacionDeFila, humanosDeFila, organizadorDesdeMapa, checklistDesdeMapa } from "../src/services/mapaClasesService.js";
import { motivosTextoClase, hechosDeClase, libretaDeHechos, revisarUnidadConMapa, obligacionIncumplida, datosSinRecoger, grabacionProhibida, motivosFidelidad, construirContratoFase, aplicarFilasMapa, contenidosSinUsar, validarLoteContrato, validarFaseCompleta, validarUnidadPlanMaestro } from "../src/services/redaccionFaseService.js";
import { buildFasePrompt } from "../src/services/phaseAService.js";
import { debeUsarMapaClases, prepararMapaClases } from "../src/services/unidadAprendizajeService.js";
import { extraerCriteriosEvaluacionCanonicos } from "../src/services/curriculumBrainService.js";

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
check("con los 21 indicadores, ninguna clase pasa del tope y el mapa lo detiene con un mensaje claro", () => {
  const todos = { competenciasElegidas: competencias.map((c) => c.id), indicadoresElegidos: estructura.indicadores.map((i) => i.id) };
  const m = mapaDe("Alimentación", 6, HORARIOS["3x1"], { planMaestro: todos });
  igual(m.indicadores.length, 21, "21 indicadores");
  assert(m.filas.every((f) => f.indicadores.length <= TOPE_INDICADORES_POR_CLASE), "una clase pasa del tope");
  const fallos = fallosQueDetienen(m);
  igual(fallos.length, 1, "un solo fallo");
  assert(/no caben en las clases sumativas.*Elige menos/.test(fallos[0]), fallos[0]);
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

check("ningún mapa pasa del tope de contenidos ni deja una clase con más de 3 indicadores", () => {
  for (const titulo of [...SEMILLAS, ...SIN_SEMILLA]) for (let semanas = 1; semanas <= 8; semanas += 1) {
    const m = mapaDe(titulo, semanas, HORARIOS["3x1"]);
    m.filas.forEach((f) => {
      assert(f.contenidos.length <= TOPE_CONTENIDOS_POR_CLASE, `${titulo} ${semanas}: ${f.contenidos.length} contenidos`);
      assert(f.indicadores.length >= 1 && f.indicadores.length <= 3, `${titulo} ${semanas} clase ${f.clase}: ${f.indicadores.length} indicadores`);
    });
  }
  igual(ref.contenidosSinLugar, [], "la referencia no recorta");
  assert(mapaDe("Alimentación", 1, HORARIOS["3x1"]).contenidosSinLugar.length > 0, "a 1 semana debe recortar");
  assert(mapaDe("Alimentación", 1, HORARIOS["3x1"]).avisos.some((a) => /sin marcar/.test(a)), "no lo declara");
});

console.log("\n[Mapa de clases — conexión con la generación, sin IA]");
const eRef = entrada("Alimentación", 6, ...HORARIOS["3x1"]);
const { plan: planRef, filasPorFase } = planDesdeMapa(eRef, ref);
const contratoDe = (i) => construirContratoFase({ plan: planRef, indice: i, estructura, audiencia: "el dueño del comedor", modalidadVisita: "invitado", filasMapa: filasPorFase[i], filasUnidad: ref.filas });
const especie = (c) => ({ contratoFase: c, area: "Lenguas Extranjeras", grado: "2do Secundaria", nivel: "Secundaria", esIdioma: true, idiomaNombre: "inglés", asignatura: "Inglés" });
const promptDe = (i, inicio = 1, n = 1) => buildFasePrompt(especie(contratoDe(i)), i + 1, inicio, n, 45, 6, []);

check("apagado por defecto: sin la condición no se usa el mapa, y solo aplica a Inglés", () => {
  assert(!debeUsarMapaClases({ datos: {}, asignatura: "Inglés" }), "activo por defecto");
  assert(debeUsarMapaClases({ datos: { usarMapaClases: true }, asignatura: "Inglés" }), "no se activa");
  assert(!debeUsarMapaClases({ datos: { usarMapaClases: true }, asignatura: "Francés" }), "aplica a Francés");
  assert(!debeUsarMapaClases({ datos: { usarMapaClases: true, planMaestro: { sesionesPorFase: [1] } }, asignatura: "Inglés" }), "pisa lo que ajustó el docente");
});
check("sin mapa, el prompt de siempre: ni rastro del bloque nuevo", () => {
  const plan = construirPlanMaestro(eRef);
  const c = construirContratoFase({ plan, indice: 2, estructura, audiencia: "x", modalidadVisita: "invitado" });
  const p = buildFasePrompt(especie(c), 3, 1, 1, 45, 6, []);
  assert(!/MAPA DE ESTAS CLASES/.test(p) && /ENTRE 4 Y 5 actividades/.test(p) && /Cierre: 3 actividades/.test(p), "cambió el prompt sin mapa");
});
check("con mapa, el prompt lleva la fila de la clase y deja lo fijo al sistema", () => {
  const p = promptDe(2);
  ["MAPA DE ESTAS CLASES", "Clase 4 (Semana 2)", "entrevistar (30 min)", "Tabla común con respuestas y datos", "ING-2-I03", "un invitado viene al aula", "«falta dato»", "contenidosEnClase", "ENTRE 2 Y 5 actividades", "Cierre: 2 actividades"]
    .forEach((t) => assert(p.includes(t), `falta: ${t}`));
  ["copia la lista EXACTA", "cada clase trabaja AL MENOS UNO", "Cierre: 3 actividades", "ENTRE 4 Y 5"].forEach((t) => assert(!p.includes(t), `sobra: ${t}`));
});
check("el reparto del mapa cuadra con las fases del plan y sus entregas", () => {
  igual(planRef.fases.map((f) => f.sesiones), [1, 2, 1, 2, 3, 2, 2, 4, 1], "sesiones");
  igual(planRef.fases[3].entrega.secciones, [L, I].sort((a, b) => planRef.secciones.indexOf(a) - planRef.secciones.indexOf(b)), "fase 4 avanza sus dos secciones");
  igual(filasPorFase.flat().length, 18, "filas");
});

const mapaSecciones = (m) => m.secciones;
const claseFalsa = (fila, extra = {}) => ({
  dia: 1, tituloSemana: "x", titulo: "t", focoLinguistico: "Preguntar por precios: how much (_How much is it?_)",
  estrategiasDia: "a • b", intencionPedagogica: "Desde el inicio hasta el final de la clase, los estudiantes hacen algo mediante algo, utilizando algo, evidencia.",
  indicadoresTrabajados: [], seccionesProducto: [], semillaUsada: [], ampliacion: [], entregaFase: "", aporteProducto: "",
  contenidosEnClase: fila.contenidos.map((c, i) => ({ contenido: c.texto, frase: `frase numero ${i}` })),
  textoModelo: { titulo: "m", lineas: fila.contenidos.map((_, i) => `frase numero ${i}`) },
  momentos: [{ nombre: "Desarrollo", actividades: ["Entrevistan (en grupos) al dueño."] }, { nombre: "Cierre", actividades: ["Valoran (en plenaria) lo hecho."] }],
  ...extra,
});
check("lo fijo lo pone el código: secciones, indicadores, aporte y entrega salen de la fila", () => {
  const c = contratoDe(2);
  const data = { clases: [claseFalsa(c.mapaClases[0], { indicadoresTrabajados: ["OTRO"], seccionesProducto: ["Otra"], aporteProducto: "lo que sea", textoModelo: { lineas: ["What dishes do you sell? What ingredients? How much is it? When do you open? How many customers?"] } })] };
  aplicarFilasMapa(data, c, 1);
  igual(data.clases[0].indicadoresTrabajados, ["ING-2-I03"], "indicador");
  igual(data.clases[0].seccionesProducto, [I], "sección");
  assert(/«Interviews with Owners» \(insumos recopilados\): Tabla común/.test(data.clases[0].aporteProducto), data.clases[0].aporteProducto);
  assert(data.clases[0].entregaFase, "entrega de la última clase de la fase");
  igual(validarLoteContrato(data, c, 1, 1, { esIdioma: true }).length, 1, "pasa el contrato");
  validarFaseCompleta(data.clases, c);
});
check("el tipo de evidencia del Desarrollo lo dice la tarea", () => {
  const c = contratoDe(1);
  const data = { clases: [claseFalsa(c.mapaClases[0], { momentos: [{ nombre: "Desarrollo", actividades: ["x"], evidencias: { conocimientos: [], desempeno: ["Lista de datos"], producto: [] } }] })] };
  aplicarFilasMapa(data, c, 1);
  igual(data.clases[0].momentos[0].evidencias, { conocimientos: ["Lista de datos"], desempeno: [], producto: [] }, "conocimiento");
});
check("un contenido que no se ve en la clase da aviso, no rechazo", () => {
  // Desde la fase 4: las anteriores tienen además sus propias obligaciones (diagnóstico, datos).
  const i = filasPorFase.findIndex((fs, n) => n >= 3 && fs.some((f) => f.contenidos.length));
  const c = contratoDe(i);
  const k = c.mapaClases.findIndex((f) => f.contenidos.length);
  const fila = c.mapaClases[k];
  const sinNada = claseFalsa(fila, { contenidosEnClase: [], textoModelo: { lineas: [] } });
  igual(contenidosSinUsar(sinNada, fila).length, fila.contenidos.length, "debía faltar todo");
  igual(contenidosSinUsar(claseFalsa(fila), fila), [], "con frase real cumple");
  const clases = Array.from({ length: k + 1 }, (_, n) => (n === k ? sinNada : claseFalsa(c.mapaClases[n])));
  const motivos = validarLoteContrato(aplicarFilasMapa({ clases }, c, 1), c, k + 1, 1, { esIdioma: true });
  assert(motivos[k].some((m) => /no se ven estos contenidos/.test(m)), "sin aviso");
});
check("basta un ejemplo del contenido: no hace falta copiar la línea de la malla", () => {
  const fila = { contenidos: [{ texto: "Comidas y bebidas: bread, salad, juice, milk…" }] };
  const clase = { momentos: [{ nombre: "Desarrollo", actividades: ["Nombran (en parejas) platos con _salad_ y arroz."] }] };
  igual(contenidosSinUsar(clase, fila), [], "salad cuenta");
  igual(contenidosSinUsar({ momentos: [{ nombre: "Desarrollo", actividades: ["Nombran platos."] }] }, fila).length, 1, "sin ejemplo no cuenta");
});
check("nadie graba ni usa celulares: el lote se rechaza", () => {
  const clase = (a) => ({ momentos: [{ nombre: "Desarrollo", actividades: [a] }] });
  assert(grabacionProhibida(clase("Practican (en parejas) el diálogo: diálogo oral; lo graban en el celular.")), "debía detectar la grabación");
  assert(grabacionProhibida(clase("Comparten (en parejas) una foto en el móvil.")), "debía detectar el móvil");
  igual(grabacionProhibida(clase("Practican (en parejas) el diálogo, sin grabar: lo observa el docente.")), "", "«sin grabar» no cuenta");
  const c = contratoDe(2);
  let msg = "";
  try { validarLoteContrato(aplicarFilasMapa({ clases: [claseFalsa(c.mapaClases[0], { momentos: [{ nombre: "Desarrollo", actividades: ["Entrevistan (en grupos) y lo graban."] }] })] }, c, 1), c, 1, 1, { esIdioma: true }); } catch (e) { msg = e.message; }
  assert(/nadie graba/.test(msg), `mensaje: ${msg}`);
});
check("redacción con mapa: primero pide el reintento; después se entrega con aviso", () => {
  const c = contratoDe(2);
  const lote = () => aplicarFilasMapa({ clases: [claseFalsa(c.mapaClases[0], { momentos: [{ nombre: "Desarrollo", actividades: ["Entrevistan (en grupos) y lo graban."] }] })] }, c, 1);
  let err = null;
  try { validarLoteContrato(lote(), c, 1, 1, { esIdioma: true }); } catch (e) { err = e; }
  assert(err?.esRedaccionMapa === true, `sin marca de redacción: ${err?.message}`);
  const motivos = validarLoteContrato(lote(), c, 1, 1, { esIdioma: true, redaccionConAviso: true });
  assert(motivos[0].some((m) => /nadie graba/.test(m)), `sin aviso: ${JSON.stringify(motivos)}`);
});
check("el reintento de redacción se recuerda entre vueltas de la misma unidad", () => {
  const fuente = readFileSync(new URL("../src/services/phaseAService.js", import.meta.url), "utf8");
  assert(/const REDACCION_YA_REINTENTADA = new Set\(\)/.test(fuente), "fuera de la función");
  assert(/redaccionConAviso: REDACCION_YA_REINTENTADA\.has\(claveRedaccion\)/.test(fuente) && /esRedaccionMapa\) REDACCION_YA_REINTENTADA\.add\(claveRedaccion\)/.test(fuente), "sin conectar");
  assert(/claveRedaccion = `\$\{spec\.cupoGeneracion\?\.planId/.test(fuente), "la clave distingue la unidad");
});
check("si la clase se aleja de su fila, avisa al administrador sin rechazar", () => {
  const fila = ref.filas[15]; // corregir + reunir las secciones
  const clase = (acts) => ({ momentos: [{ nombre: "Desarrollo", actividades: acts }] });
  assert(motivosFidelidad(clase(["Corrigen (en parejas) la guía."]), fila).some((m) => /reunir las secciones/.test(m)), "debía avisar que no integra");
  igual(motivosFidelidad(clase(["Corrigen (en parejas) la guía.", "Reúnen (en grupos) las cinco secciones."]), fila), [], "cumple");
  assert(motivosFidelidad(clase(["Escriben (en parejas) preguntas nuevas."]), ref.filas[1]).some((m) => /adelantando otra tarea/.test(m)), "clase de comprender que escribe");
  assert(motivosFidelidad(clase(["Comparan (en parejas) las calorías de cada plato."]), ref.filas[8]).some((m) => /sin fuente/.test(m)), "dato sin fuente");
});
check("el prompt da la instrucción de cada tarea y no pide técnica de catálogo", () => {
  const p = promptDe(1);
  assert(p.includes("Aún no escriben el guion"), "falta la instrucción");
  assert(p.includes("no nombres técnicas de catálogo") && p.includes("Nadie graba"), "faltan reglas");
  assert(!/técnica concreta \(/.test(p), "sigue pidiendo técnica");
});
check("toda tarea de la lista tiene su instrucción y su señal", () => {
  Object.values(TAREAS_POR_TIPO).flat().forEach((t) => assert(DETALLE_TAREA[t.clave]?.hace && DETALLE_TAREA[t.clave]?.senal, t.clave));
  ["comentar", "corregir", "acordar", "glosario", "integrar", "presentar", "audiencia_secundaria", "evaluar_comentarios", "evaluar_proceso"].forEach((k) => assert(DETALLE_TAREA[k]?.hace, k));
});
check("inventario: la entrevista recoge lo que necesitan las piezas, y sin el dato se rechaza", () => {
  igual(ref.filas[3].datosRecoge, ["platos", "ingredientes", "precios", "horario", "clientes"], "clase 4");
  igual(ref.filas[4].datosRecoge, [], "clase 5 no recoge");
  const clase = (a) => ({ momentos: [{ nombre: "Desarrollo", actividades: [a] }] });
  igual(datosSinRecoger(clase("Entrevistan al dueño: What dishes do you sell? What ingredients? How much is it? When do you open? Who are your customers?"), ref.filas[3]), [], "completa");
  assert(datosSinRecoger(clase("Entrevistan al dueño sobre sus platos: What are your opening hours?"), ref.filas[3]).includes("precios"), "sin precios debía fallar");
  igual(datosSinRecoger(clase("Redactan el registro."), ref.filas[4]), [], "solo la entrevista rechaza");
  assert(promptDe(2).includes("DEBE preguntar y dejar anotados") && promptDe(2).includes("precios"), "el prompt no lo pide");
});
check("lo que rompe la cadena rechaza el lote: diagnóstico, pedidos, comentarios y datos sin recoger", () => {
  const clase = (...acts) => ({ momentos: [{ nombre: "Desarrollo", actividades: acts }] });
  assert(/diagnóstico/.test(obligacionIncumplida(clase("Acuerdan (en plenaria) el plan."), ref.filas[0])), "clase 1 sin diagnóstico");
  igual(obligacionIncumplida(clase("Escuchan (en parejas) oraciones y marcan imágenes.", "Escriben (individual) dos oraciones."), ref.filas[0]), "", "clase 1 con diagnóstico");
  assert(/pedidos/.test(obligacionIncumplida(clase("Presentan (en equipos) todas las secciones."), ref.filas[16])), "clase 17 sin pedidos");
  igual(obligacionIncumplida(clase("Presentan (en equipos) todas las secciones.", "Hacen pedidos reales con el menú (_Can I have…?_)."), ref.filas[16]), "", "clase 17 con pedidos");
  assert(/comentarios/.test(obligacionIncumplida(clase("Corrigen (en grupos) según los comentarios."), ref.filas[17])), "clase 18 sin leer");
  igual(obligacionIncumplida(clase("Leen (individual) los comentarios y responden qué piden cambiar."), ref.filas[17]), "", "clase 18 con lectura");
  assert(/ninguna clase recogió/.test(obligacionIncumplida(clase("Clasifican (en grupos) los platos altos en calorías."), ref.filas[6])), "dato sin fuente");
});
check("evaluación: el tipo, el agente y el instrumento salen de la fila", () => {
  igual(evaluacionDeFila(ref.filas[0]).tipo, "Diagnóstica", "clase 1");
  igual(evaluacionDeFila(ref.filas[1]).tipo, "Formativa", "clase 2");
  igual(evaluacionDeFila(ref.filas[16]).tipo, "Sumativa", "clase 17");
  assert(/Rúbrica/.test(evaluacionDeFila(ref.filas[16]).instrumento) && /Anexo B/.test(evaluacionDeFila(ref.filas[16]).instrumento), "instrumentos de la 17");
  igual(evaluacionDeFila(ref.filas[17]).tipo, "Sumativa: se califican las respuestas individuales. Formativa: la corrección, la autoevaluación, la coevaluación y la reflexión", "la 18 dice qué se califica");
  assert(/Coevaluación/.test(evaluacionDeFila(ref.filas[9]).agente), "comentar es coevaluación");
});
check("la actividad sumativa es solo heteroevaluación; los otros agentes son de lo formativo", () => {
  igual(evaluacionDeFila(ref.filas[16]).agente, "Heteroevaluación", "clase 17");
  igual(evaluacionDeFila(ref.filas[17]).agente, "Heteroevaluación (sumativa); autoevaluación y coevaluación (formativa)", "clase 18");
});
check("la autoevaluación va después de la sumativa, en todas las estrategias y duraciones", () => {
  ["proyectos", "problemas", "indagacion_dialogica", "insercion_entorno", "estudio_caso", "conocimientos_previos", "expositiva"].forEach((estrategia) => {
    [2, 4, 6].forEach((semanas) => {
      const tareas = mapaDe("Escuela y educación", semanas, HORARIOS["3x1"], { planMaestro: { estrategia } }).filas.flatMap((f) => f.tareas.map((t) => t.clave));
      assert(tareas.indexOf("evaluar_proceso") > tareas.lastIndexOf("presentar") && tareas.indexOf("evaluar_proceso") > tareas.indexOf("evaluar_comentarios"), `${estrategia}, ${semanas} sem: ${tareas.join(" ")}`);
    });
  });
});
check("V6: la cobertura se reparte entre las clases sumativas, como la referencia", () => {
  igual(fallosQueDetienen(ref), [], "referencia");
  igual([...ref.filas[16].indicadores].sort(), ["ING-2-I02", "ING-2-I03"], "clase 17");
  igual(ref.filas[17].indicadores, ["ING-2-I01"], "clase 18");
  const sinSumativa = { ...ref, filas: ref.filas.map((f) => ({ ...f, tareas: f.tareas.map((t) => ({ ...t, sumativa: false })) })) };
  assert(fallosQueDetienen(sinSumativa).some((m) => /no caben en las clases sumativas/.test(m)), "debía detenerse");
});
check("V6 cuenta solo lo que la clase muestra", () => {
  const f17 = ref.filas[16];
  const conOculto = { ...ref, filas: ref.filas.map((f) => (f === f17 ? { ...f, indicadores: ["A", "B", "C", ...f.indicadores] } : f)) };
  const fallos = fallosQueDetienen(conOculto);
  assert(fallos.some((m) => /clase 17 evalúa 5 indicadores y solo muestra 3/.test(m)), "debía avisar del recorte");
  assert(fallos.some((m) => /ING-2-I02.*no caben/.test(m)), "lo que no se muestra no cuenta");
});
check("indicadores que caben: dos de comprender en una clase y dos de producir e interactuar en otra", () => {
  const cuatro = ["responde", "responde", "produce", "interactua"].map((accion, i, l) => estructura.indicadores.filter((x) => x.accion === accion)[l.slice(0, i).filter((a) => a === accion).length].id);
  const m = mapaDe("Alimentación", 6, HORARIOS["3x1"], { planMaestro: { competenciasElegidas: competencias.map((c) => c.id), indicadoresElegidos: cuatro } });
  igual(fallosQueDetienen(m), [], "cabe");
  const sumativas = m.filas.filter((f) => f.tareas.some((t) => t.sumativa));
  igual(new Set(sumativas.flatMap((f) => f.indicadores)).size, 4, "cubre los cuatro");
});
check("un criterio, un código: Inglés 2do da 21 criterios y conserva el código con competencia", () => {
  const c = extraerCriteriosEvaluacionCanonicos(malla, { nivel: "Secundaria", grado: "2do Secundaria", area: "Inglés" });
  igual(c.length, 21, "criterios");
  assert(c.every((x) => x.competenciaFundamental), "sin competencia");
  assert(c.some((x) => x.id === "CR-INGLES-2DO-S-9MMWK4"), "cambió el código que ya usan los anexos");
});
check("entrega sin origen: el mapa se detiene antes de llamar a la IA", () => {
  const sinOrigen = { ...ref, filas: ref.filas.map((f) => (f.clase === 5 ? { ...f, tareas: f.tareas.map((t) => ({ ...t, recibe: [] })) } : f)) };
  assert(fallosQueDetienen(sinOrigen).some((m) => /clase 5: .*no tiene origen/.test(m)), "debía detenerse");
});
check("con invitado, el Anexo I habla de un comedor y una entrevista real, sin tocar lo del docente", () => {
  const base = { numSemanas: 6, diasClase: ["l", "m", "x"], horasPorDia: 1 };
  const pm = { estrategia: "insercion_entorno", modalidadVisita: "invitado", situacion: { semillaId: "ing2-alimentacion-menu", audiencia: "los dueños", audienciaDetalle: { de: "los dueños" } }, piezasSecciones: { "Bilingual Menus": "el menú bilingüe de cada comedor", "Our Local Food": "fichas" } };
  const r = conFichaDeUnidad({ ...base, planMaestro: pm }).planMaestro.piezasSecciones;
  assert(/comedor participante/.test(r["Bilingual Menus"]) && !/simulad/.test(r["Interviews with Owners"]), JSON.stringify(r));
  igual(r["Our Local Food"], "fichas", "lo demás no cambia");
  const propia = { ...pm, situacion: { ...pm.situacion, audiencia: "mi audiencia", audienciaDetalle: { de: "otra" } } };
  igual(conFichaDeUnidad({ ...base, planMaestro: propia }).planMaestro.piezasSecciones, pm.piezasSecciones, "audiencia del docente");
});
check("texto de la clase: «falta dato» en el modelo, dólares y equipos avisan; RD$ y la tabla no", () => {
  const motivos = (lineas, acts = [], ampliacion = []) => motivosTextoClase({ textoModelo: { lineas }, momentos: [{ nombre: "Inicio", actividades: acts }], ampliacion });
  assert(motivos(["B: The rice costs $falta dato."]).length === 2, "falta dato y $");
  assert(/pesos/.test(motivos(["It costs 8 dollars."])[0]), "dólares");
  assert(/pesos/.test(motivos([], [], [{ texto: "spicy, cost, dollar" }])[0]), "dólar en la ampliación");
  assert(/equipo/.test(motivos([], ["Retroalimentación de las entrevistas grabadas."])[0]), "grabadas");
  igual(motivos(["It costs RD$250."], ["Anotan los datos en la tabla."]), [], "sin aviso");
});
check("el prompt pide un ejemplo ficticio en pesos en el texto modelo", () => {
  const c = contratoDe(1);
  const fuente = readFileSync(new URL("../src/services/phaseAService.js", import.meta.url), "utf8");
  assert(/"textoModelo" es un ejemplo ficticio/.test(fuente) && /pesos dominicanos \(RD\$\), nunca en dólares/.test(fuente), "regla 2");
  assert(c.mapaClases, "contrato con mapa");
});
check("el invitado entra en los recursos humanos cuando la clase lo usa", () => {
  const a = ALCANCE_POR_SEMILLA["ing2-alimentacion-menu"].conInvitado;
  assert(/dueño invitado/.test(humanosDeFila(ref.filas[3], a)), "clase 4");
  assert(/dueño invitado/.test(humanosDeFila(ref.filas[16], a)) && /visitante/.test(humanosDeFila(ref.filas[16], a)), "clase 17");
  igual(humanosDeFila(ref.filas[4], a), "Docente y estudiantes", "clase 5");
});
check("ficha: situación, producto y audiencia dicen lo mismo que el mapa", () => {
  const base = { grado: "2do Secundaria", asignatura: "Inglés", centro: "Centro - Hato Nuevo", titulo: "Alimentación", numSemanas: 6, diasClase: ["l", "m", "x"], horasPorDia: 1 };
  const d = { ...base, ...prellenarPlanMaestro({ datos: base, indicadores: estructura.indicadores, competencias }) };
  const f = conFichaDeUnidad(d);
  const texto = componerSituacion({ situacion: f.planMaestro.situacion, producto: d.productoFinalTexto, estrategia: f.planMaestro.estrategia });
  assert(!/visitan el entorno/.test(texto) && /traen el entorno al aula/.test(texto), texto);
  assert(/comedor participante/.test(texto) && !/comedores del barrio/.test(texto), texto);
  igual(audienciasDeSituacion(f.planMaestro.situacion).principal, "el dueño del comedor participante", "audiencia");
  igual(conFichaDeUnidad({ ...d, numSemanas: 1 }).planMaestro.modalidadVisita, "simulada", "a 1 semana");
  const { diasClase: _d, horasPorDia: _h, ...sinHorario } = d;
  igual(conFichaDeUnidad(sinHorario).planMaestro.modalidadVisita, "invitado", "el formulario sin días no vuelve simulada la visita");
  assert(/simulada/.test(conFichaDeUnidad({ ...d, numSemanas: 1 }).planMaestro.situacion.rolPropio), "lo declara");
  const conVisita = { ...d, planMaestro: { ...d.planMaestro, modalidadVisita: "entre_sesiones" } };
  assert(!conFichaDeUnidad(conVisita).planMaestro.situacion.rolPropio, "visita real: no se toca");
  const delDocente = { ...d, planMaestro: { ...d.planMaestro, situacion: { ...d.planMaestro.situacion, audiencia: "las familias" } } };
  igual(conFichaDeUnidad(delDocente).planMaestro.situacion.audiencia, "las familias", "manda la audiencia del docente");
  assert(/ninguna clase depende/.test(ambienteDeMapa(ref)) && !/proyector|video/i.test(ambienteDeMapa(ref)), "ambiente");
});
check("Anexo I: cada sección con su proceso, sus estados y su cierre; Anexo H, una fila por clase", () => {
  const o = organizadorDesdeMapa(ref, { producto: "Guide", piezas: { "Our Local Food": "fichas" } });
  igual(o.length, 6, "filas");
  const de = (s) => o.find((x) => x.seccion === s);
  mapaSecciones(ref).forEach((s) => assert(/versión final$/i.test(de(s).fases), `${s}: ${de(s).fases}`));
  igual(de("Ordering Food").fases, "Insumos recopilados → Borrador → Versión final", "Ordering Food");
  assert(de("Interviews with Owners").operaciones.some((x) => x.startsWith("entrevistar (C4)")) && de("Interviews with Owners").operaciones.some((x) => x.startsWith("registrar por escrito (C5)")), "omite entrevistar o registrar");
  assert(!de("Our Local Food").operaciones.some((x) => /entrevistar|registrar/.test(x)), "mezcla secciones");
  igual(new Set(mapaSecciones(ref).map((s) => de(s).evidencia)).size, 5, "evidencia propia por sección");
  igual(checklistDesdeMapa(ref, "Guide").length, 18, "Anexo H");
  igual(de("Bilingual Menus").evidencia, "Menú bilingüe", "la evidencia se nombra por lo que es");
  assert(!o.some((x) => /^Pieza /.test(x.evidencia || "")), "evidencia genérica");
  const h = checklistDesdeMapa(ref, "Guide");
  igual(h[0].recibe, "Situación de aprendizaje", "la clase 1 recibe la situación");
  assert(/\(C2\)/.test(h[2].recibe), `el Anexo H declara lo que recibe: ${h[2].recibe}`);
});
check("hoja de ruta: cada lote ve toda la unidad y sabe cuál es su clase", () => {
  const h = hojaDeRuta(ref.filas, [4]);
  igual(h.length, 18, "una línea por clase");
  assert(h[3].startsWith("► C4") && !h[4].startsWith("►"), "marca solo la actual");
  assert(/C17 todo el producto: presentar/.test(h[16]), h[16]);
  const p = promptDe(2);
  assert(p.includes("LA UNIDAD COMPLETA") && p.includes("► C4") && p.includes("C17 todo el producto"), "no llega al prompt");
  assert(p.indexOf("LA UNIDAD COMPLETA") < p.indexOf("MAPA DE ESTAS CLASES"), "orden");
});
check("libreta: guarda frases y estructura, sin cifras, y llega a las clases siguientes", () => {
  const clase = { focoLinguistico: "Preguntar precios: how much", textoModelo: { lineas: ["The salad is 100 pesos.", "How much is the salad?"] }, momentos: [{ nombre: "Desarrollo", actividades: ["Escriben (en grupos) preguntas (_What dishes do you sell?_…)."] }] };
  const h = hechosDeClase(clase);
  igual(h.frases, ["What dishes do you sell?", "How much is the salad?"], "frases sin cifras");
  const memoria = [{ aporteProducto: "Sección «Interviews» (borrador): guion", hechos: h }];
  assert(/What dishes do you sell/.test(libretaDeHechos(memoria)) && /no lo contradigas/.test(libretaDeHechos(memoria)), "libreta");
  igual(libretaDeHechos([]), "", "vacía sin memoria");
  assert(buildFasePrompt(especie(contratoDe(3)), 4, 1, 1, 45, 6, memoria).includes("What dishes do you sell"), "no llega al prompt");
  igual(libretaDeHechos(Array.from({ length: 30 }, () => ({ hechos: { frases: ["a b c"], estructura: "x" } }))).split("\n").length, 15, "tope");
});
check("revisión de la unidad: detecta adelantos, repeticiones y lo que no se usa", () => {
  const dia = (...acts) => ({ momentos: [{ nombre: "Desarrollo", actividades: acts }] });
  const dias = ref.filas.map((f) => dia(`Trabajan (en grupos) con ${f.recibe.map((r) => r.texto.split(":")[0]).join(" y ")} en la clase ${f.clase}.`));
  igual(revisarUnidadConMapa(dias, ref.filas), [], "sin problemas");
  const adelanta = [...dias];
  adelanta[15] = dia("Presentan (en grupos) el diálogo a un dueño invitado.", "Reúnen (en grupos) las secciones de Secciones finales, Versión final, Observaciones.");
  assert(revisarUnidadConMapa(adelanta, ref.filas).some((a) => /clase 16: adelanta o repite «presentar»/.test(a)), "adelanto");
  const repite = [...dias];
  repite[2] = dias[1];
  assert(revisarUnidadConMapa(repite, ref.filas).some((a) => /repite una actividad/.test(a)), "repetición");
  const noUsa = [...dias];
  noUsa[7] = dia("Conversan (en grupos) sobre su clase.");
  assert(revisarUnidadConMapa(noUsa, ref.filas).some((a) => /clase 8: no se ve que use/.test(a)), "no usa lo recibido");
});
check("el aporte de la fila nombra lo que la plantilla espera", () => {
  igual(aporteDeFila(ref.filas[0], "Guide", ref.secciones).startsWith("«Guide» (acuerdo y plan)"), true, "unidad");
  igual(aporteDeFila(ref.filas[10], "Guide", ref.secciones).startsWith("Secciones «Interviews with Owners» · «Our Local Food» (versión final)"), true, "dos secciones");
});
check("la unidad completa con mapa pasa el validador global de plan maestro", () => {
  const fasesSemanales = planRef.fases.map((f, i) => ({ dias: filasPorFase[i].map((fila, k) => ({
    indicadoresTrabajados: fila.indicadores, seccionesProducto: fila.secciones,
    entregaFase: k === filasPorFase[i].length - 1 ? f.entrega.texto : "", momentos: [],
  })) }));
  const { errores } = validarUnidadPlanMaestro({ planMaestro: planRef, fasesSemanales });
  igual(errores, [], "errores");
});
check("el plan y los contratos se arman para todas las duraciones y temas", () => {
  for (const titulo of [...SEMILLAS, ...SIN_SEMILLA]) for (const [nombre, h] of Object.entries(HORARIOS)) for (let semanas = 1; semanas <= 8; semanas += 1) {
    if (semanas * h[0].length * h[1] < 3) continue;
    const e = entrada(titulo, semanas, ...h);
    const r = planDesdeMapa(e, armarMapaClases(e));
    r.plan.fases.forEach((_, i) => construirContratoFase({ plan: r.plan, indice: i, estructura, audiencia: "la audiencia", filasMapa: r.filasPorFase[i] }));
  }
});
check("la preparación real del generador devuelve el plan con mapa (malla real)", () => {
  const base = { grado: "2do Secundaria", asignatura: "Inglés", centro: "Centro - Hato Nuevo", titulo: "Alimentación", usarMapaClases: true };
  const datos = { ...base, ...prellenarPlanMaestro({ datos: base, indicadores: estructura.indicadores, competencias }) };
  const r = prepararMapaClases({ datos, mallaPayload: malla, asignatura: "Inglés", numSemanas: 4, diasClase: HORARIOS["3x1"][0], horasPorDia: 1, duracionMin: 45 });
  igual(r.plan.fases.reduce((s, f) => s + f.sesiones, 0), 12, "12 clases");
  igual(r.filasPorFase.flat().length, 12, "12 filas");
  igual(r.modalidad, "invitado", "modalidad");
});

if (process.argv.includes("--informe")) {
  console.log("\nTema | horario | semanas | clases | modo | ampl. | flex. | min libres | máx. contenidos | máx. tareas | problemas");
  filas.forEach((f) => console.log([f.titulo, f.nombre, f.semanas, f.total, f.modo, f.ampliaciones ?? "", f.flexibles ?? "", f.libres ?? "", f.maxContenidos ?? "", f.maxTareas ?? "", f.problemas.length].join(" | ")));
}

// Arreglos de la revisión de «Escuela», 4 semanas (2026-11-04).
const mapaEscuela4 = () => mapaDe("Escuela y educación", 4, HORARIOS["3x1"]);
check("el diagnóstico tiene su tiempo: la clase 1 solo acuerda y diagnostica, también en 4 semanas", () => {
  [1, 2, 3, 4, 6, 8].forEach((semanas) => {
    const mapa = mapaDe("Escuela y educación", semanas, HORARIOS["3x1"]);
    if (mapa.modo === "breve") return;
    igual(mapa.filas[0].tareas.map((t) => t.clave), ["acordar"], `${semanas} semanas`);
    igual(mapa.filas[0].tareas[0].minutos, 30, `${semanas} semanas, minutos`);
  });
});
check("los recursos didácticos son los de la fila, sin repetir y sin equipos", () => {
  mapaEscuela4().filas.forEach((f) => {
    const lista = didacticosDeFila(f).split(", ");
    assert(lista.length && lista[0], `clase ${f.clase} sin recursos`);
    igual(new Set(lista.map((r) => r.toLowerCase())).size, lista.length, `clase ${f.clase} repite`);
    assert(!/comput|proyector|internet|celular/i.test(lista.join(" ")), `clase ${f.clase}: ${lista}`);
  });
});
check("la firma prometida queda en la actividad de su tarea, una sola vez", () => {
  const tareas = [{ clave: "describir_redactar" }, { clave: "orientar_instrucciones" }];
  const salida = conFirmas(["Elaboran descripciones.", "Redactan indicaciones."], tareas);
  igual(salida, ["Elaboran descripciones. Cada estudiante firma su pieza.", "Redactan indicaciones."], "por posición");
  igual(conFirmas(salida, tareas), salida, "no la repite");
  igual(conFirmas(["Observan un modelo.", "Redactan su pieza.", "Comparten."], [{ clave: "describir_redactar" }])[1], "Redactan su pieza. Cada estudiante firma su pieza.", "por señal");
  igual(conFirmas(["Redactan."], [{ clave: "comentar" }]), ["Redactan."], "tarea sin firma");
});
check("el Inicio de la clase 1 no mira a una clase anterior y conserva la voz", () => {
  assert(/^Recuperación de experiencias\b/.test(INICIO_PRIMERA_CLASE) && !/anterior|ultima|última|retroaliment/i.test(INICIO_PRIMERA_CLASE), INICIO_PRIMERA_CLASE);
});
check("los anexos H e I usan el nombre del producto, sin su descripción", () => {
  const largo = "Our School Survival Guide — una guía bilingüe de la escuela, dirigida a los estudiantes.";
  const mapa = mapaEscuela4();
  const textos = [...checklistCorto(mapa, largo).map((c) => c.paso), organizadorCorto(mapa, { producto: largo })[0].incluye];
  assert(textos.every((t) => !/una guía bilingüe/.test(t)), "queda la descripción");
  assert(textos.some((t) => /Our School Survival Guide/.test(t)), "falta el nombre");
});

check("Inicio y Cierre quedan sin equipos que el mapa no prevé", () => {
  const momentos = [
    { nombre: "Inicio", actividades: ["Responden.", "Retroalimentación.", "Recuperación.", "Observan un breve video sobre consejos.", "Escuchan."], recursos: { didacticos: "Video sobre consejos, Tarjetas", tecnologicos: "Proyector, Parlantes" } },
    { nombre: "Desarrollo", actividades: ["Ven un video."], recursos: { didacticos: "Video", tecnologicos: "Proyector" } },
    { nombre: "Cierre", actividades: ["Comparten en plenaria.", "Graban un audio."], recursos: { didacticos: "Grabadora de audio", tecnologicos: "Grabación de audio" } },
  ];
  const restantes = sinEquipos(momentos, "Tarjetas de la fila");
  igual(momentos[0].actividades[3], ENGANCHE_SIN_EQUIPOS, "enganche sustituido");
  igual(momentos[0].actividades.length, 5, "posiciones del Inicio");
  igual(momentos[0].recursos, { didacticos: "Tarjetas", tecnologicos: "No requerido para esta actividad" }, "recursos del Inicio");
  igual(momentos[2].recursos.didacticos, "Tarjetas de la fila", "sin recursos, los de la fila");
  igual(momentos[1].recursos.tecnologicos, "Proyector", "el Desarrollo no se toca aquí");
  assert(restantes.length === 1 && /^Cierre: Graban/.test(restantes[0]), `aviso: ${restantes}`);
});
check("el diagnóstico ocupa dos tercios de la clase y los minutos suman el total", () => {
  igual(minutosConDiagnostico(["Socializan el plan.", "Definen los grupos.", "Aplican el diagnóstico: escuchan y escriben."], 30), [5, 5, 20], "30 min");
  igual(minutosConDiagnostico(["Aplican el diagnóstico.", "Definen los grupos."], 35), [23, 12], "35 min");
  igual(minutosConDiagnostico(["Definen los grupos."], 30), null, "sin diagnóstico");
  igual(minutosConDiagnostico(["Aplican el diagnóstico."], 30), null, "solo diagnóstico");
});
check("al reintentar una fase, la memoria vuelve a como estaba antes de la fase", () => {
  const fuente = readFileSync(new URL("../src/services/unidadAprendizajeService.js", import.meta.url), "utf8");
  assert(/const memoriaAntesDeFase = memoriaAcumulada\.length;\s+for \(let intento = 1; !weekPlan; intento\+\+\) \{[\s\S]{0,260}memoriaAcumulada\.length = memoriaAntesDeFase;\s+try \{\s+weekPlan = await generateWeekPlan/.test(fuente), "falta restaurar la memoria");
});

console.log(`\nResultado: ${pasos} pasan, ${fallos} fallan.`);
if (fallos) process.exit(1);
