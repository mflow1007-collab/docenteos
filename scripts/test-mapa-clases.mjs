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
import { conErratasCorregidas, conReemplazos, tituloEnIngles, focoDeFila, sinLugaresEnEjemplos, sinLugaresEnClase, conGuiaEnFemenino, TOPE_GRAMATICA_POR_CLASE, minutosInicioPresentacion, diagnosticoDeActividades, diagnosticoDeFases, titulosParecidos, tituloDeClase, pruebaDelProducto, inicioPresentacion, conTitulosCorregidos, ponerSecuencias, pasosConFrases, sinEquipos, sinGrabado, minutosPorTarea, minutosConDiagnostico, ENGANCHE_SIN_EQUIPOS } from "../src/services/mapaClasesService.js";
import { construirAnexosUnidad } from "../src/services/unidadAprendizajeService.js";
import { vincularInstrumentosConClases, armarMapaClases, verificarMapa, fallosQueDetienen, TOPE_INDICADORES_POR_CLASE, tiposDeSecciones, minutosDesarrollo } from "../src/services/mapaClasesService.js";
import { construirPlanMaestro } from "../src/services/planMaestroService.js";
import { armarEntradaPlanMaestro, prellenarPlanMaestro, resolverIndicadoresEstructurados, competenciasDeMalla } from "../src/services/vistaPreviaPlanMaestroService.js";
import { TAREAS_POR_TIPO, DETALLE_TAREA, ALCANCE_POR_SEMILLA } from "../src/data/tareasPorTipoTrabajo.js";
import { componerSituacion, audienciasDeSituacion } from "../src/services/situacionAprendizajeService.js";
import { didacticosDeFila, conFirmas, INICIO_PRIMERA_CLASE, checklistDesdeMapa as checklistCorto, organizadorDesdeMapa as organizadorCorto } from "../src/services/mapaClasesService.js";
import { hojaDeRuta, planDesdeMapa, aporteDeFila, TOPE_CONTENIDOS_POR_CLASE, conFichaDeUnidad, ambienteDeMapa, evaluacionDeFila, humanosDeFila, organizadorDesdeMapa, checklistDesdeMapa } from "../src/services/mapaClasesService.js";
import { contenidosNoVistosEnUnidad, aplicarSecuencias, motivosTareaId, motivosTextoClase, hechosDeClase, libretaDeHechos, revisarUnidadConMapa, obligacionIncumplida, datosSinRecoger, grabacionProhibida, motivosFidelidad, construirContratoFase, aplicarFilasMapa, contenidosSinUsar, validarLoteContrato, validarFaseCompleta, validarUnidadPlanMaestro } from "../src/services/redaccionFaseService.js";
import { buildFasePrompt, normalizarVozBatch } from "../src/services/phaseAService.js";
import { SECUENCIAS_POR_TAREA } from "../src/data/secuenciasTareas.js";
import { validarVozActividad } from "../src/services/phaseAService.js";
import { debeUsarMapaClases, prepararMapaClases } from "../src/services/unidadAprendizajeService.js";
import { extraerCriteriosEvaluacionCanonicos } from "../src/services/curriculumBrainService.js";

const normalizaTexto = (t) => String(t).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
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
  [8, TODAS, ["presentar", "probar_audiencia"], ["ING-2-I02", "ING-2-I03"]],
  [9, TODAS, ["evaluar_comentarios", "corregir_final", "evaluar_proceso"], ["ING-2-I01"]],
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

check("Proyectos: la clase 1 lleva las dos primeras fases y la revisión del docente va antes de corregir y de la sumativa", () => {
  [["Escuela y educación", 4], ["Alimentación", 6]].forEach(([titulo, semanas]) => {
    const m = mapaDe(titulo, semanas, HORARIOS["3x1"], { planMaestro: { estrategia: "proyectos" } });
    assert(m.modo !== "breve" && !m.filas.some((f) => f.flexible), `${titulo}: ${m.modo}`);
    assert(m.filas.some((f) => f.tareas.some((t) => t.clave === "saberes_previos" && t.fase === 1)), `${titulo}: sin tarea en Análisis de saberes previos`);
    assert(!m.avisos.some((a) => /no cabe en este tiempo/.test(a)), `${titulo}: tarea descartada`);
    const ordenDe = (clave) => m.filas.findIndex((f) => f.tareas.some((t) => t.clave === clave));
    const rev = ordenDe("revision_docente");
    assert(ordenDe("corregir") <= ordenDe("revision_nivel") && ordenDe("revision_nivel") < ordenDe("presentar"), `${titulo}: segunda revisión`);
    assert(rev >= 0 && rev <= ordenDe("corregir") && ordenDe("corregir") < ordenDe("presentar"), `${titulo}: orden de la revisión`);
    const filaRev = m.filas[rev];
    assert(!filaRev.tareas.some((t) => t.sumativa) && /Formativa/.test(evaluacionDeFila(filaRev).tipo), `${titulo}: la revisión es formativa`);
    assert(m.filas.filter((f) => f.fases.some((x) => x.numero === 6)).some((f) => f.tareas.some((t) => ["corregir", "integrar"].includes(t.clave))), `${titulo}: corregir/integrar en Evaluación`);
  });
});
check("Anexo J: la clase 1 de Proyectos diagnostica las cuatro habilidades y el anexo promete solo lo que la clase hace", () => {
  [["Escuela y educación", 4, "ing2-escuela-guia"], ["Alimentación", 6, "ing2-alimentacion-menu"]].forEach(([titulo, semanas]) => {
    const m = mapaDe(titulo, semanas, HORARIOS["3x1"], { planMaestro: { estrategia: "proyectos" } });
    ponerSecuencias(m, { producto: "Our Guide — una guía", tema: titulo, asunto: "cómo orientarse en un centro nuevo", audiencia: "los estudiantes de 6.º", invitado: "el invitado", semilla: "x" });
    const textos = m.filas[0].secuencia.map((x) => x.texto);
    const d = diagnosticoDeActividades(textos);
    igual(d.habilidades.sort(), ["listening", "reading", "speaking", "writing"], `${titulo}: habilidades de la clase 1`);
    assert(/orientarse/.test(d.asunto), `${titulo}: asunto de la lectura: ${d.asunto}`);
    const anexo = construirAnexosUnidad({ area: "Inglés", tema: titulo, producto: "Our Guide", diagnosticoClase1: d });
    igual(anexo.diagnostica.length, 4, `${titulo}: ítems del Anexo J`);
    assert(!anexo.diagnostica.some((x) => x.tarea.includes(`"${titulo}"`)), `${titulo}: el Anexo J nombra el tema`);
    const cuantas = d.oracionesEscritura;
    assert(cuantas > 0 && new RegExp(`escribe ${["", "una oración", "dos oraciones", "tres oraciones", "cuatro oraciones", "cinco oraciones"][cuantas]}`).test(anexo.diagnostica.find((x) => /Writing/.test(x.habilidad)).tarea), `${titulo}: la cantidad de oraciones del Anexo J no es la de la clase 1 (${cuantas})`);
  });
  // La unidad ya redactada (sin marcas del mapa): el diagnóstico sale de las actividades de la clase 1, y sin mapa no hay.
  const fasesRedactadas = [{ dias: [{ momentos: [{ nombre: "Inicio", actividades: ["x"] }, { nombre: "Desarrollo", actividades: [
    "Escuchan (individual) al docente leer cinco oraciones y marcan la imagen de cada una.",
    "Leen (en parejas) un texto breve sobre cómo orientarse en un centro nuevo y subrayan lo que entienden.",
    "Escriben (individual) dos oraciones y luego se hacen una pregunta en parejas." ] }] }] }];
  const dd = diagnosticoDeFases(fasesRedactadas, true);
  igual(dd.habilidades.sort(), ["listening", "reading", "speaking", "writing"], "diagnóstico de la unidad redactada");
  assert(/orientarse/.test(dd.asunto) && diagnosticoDeFases(fasesRedactadas, false) === null, "asunto o plantilla sin mapa");
  // Un asunto con comas no se corta en la primera.
  const conComas = diagnosticoDeActividades(["Leen (en parejas) un texto breve sobre cómo organizar el día entre la escuela, la casa y sus responsabilidades y subrayan lo que entienden."]);
  igual(conComas.asunto, "cómo organizar el día entre la escuela, la casa y sus responsabilidades", "asunto con comas");
  // Sin lectura en la clase 1, el anexo no la promete.
  const sinLectura = construirAnexosUnidad({ area: "Inglés", tema: "T", producto: "P", diagnosticoClase1: { habilidades: ["listening", "speaking", "writing"], asunto: "" } });
  assert(!sinLectura.diagnostica.some((x) => /Reading/.test(x.habilidad)) && sinLectura.diagnostica.length === 3, "promete lectura sin hacerla");
});

check("Problemas con 15 clases o más: revisión del docente → mejora → nivel satisfactorio → sumativa, en «Puesta en común»", () => {
  [["Escuela y educación", 5], ["Alimentación", 6]].forEach(([titulo, semanas]) => {
    const m = mapaDe(titulo, semanas, HORARIOS["3x1"], { planMaestro: { estrategia: "problemas" } });
    const ord = (c) => m.filas.findIndex((f) => f.tareas.some((t) => t.clave === c));
    assert(ord("revision_docente") >= 0 && ord("revision_docente") <= ord("corregir") && ord("corregir") <= ord("revision_nivel") && ord("revision_nivel") < ord("presentar"), `${titulo}: orden de la ronda de mejora`);
    assert(!m.avisos.some((a) => /no cabe en este tiempo/.test(a)), `${titulo}: tarea descartada`);
  });
});
check("Problemas: Escuela a 4 semanas cabe en 12 clases sin versión breve y la revisión del docente va antes de la sumativa", () => {
  const m = mapaDe("Escuela y educación", 4, HORARIOS["3x1"], { planMaestro: { estrategia: "problemas" } });
  assert(m.modo !== "breve" && !m.filas.some((f) => f.flexible), `modo ${m.modo}`);
  assert(!m.avisos.some((a) => /no cabe en este tiempo/.test(a)), "tarea descartada");
  const ordenDe = (clave) => m.filas.findIndex((f) => f.tareas.some((t) => t.clave === clave));
  assert(ordenDe("revision_docente") >= 0 && ordenDe("revision_docente") <= ordenDe("presentar"), "la revisión no va antes de la sumativa");
  assert(m.filas.every((f) => didacticosDeFila(f)), "una clase sin recursos didácticos");
});
check("Problemas: con 13 clases o más cada fase lleva su tarea (selección, definición y objetivos incluidas), y con 12 no se pasa a versión breve", () => {
  [["Alimentación", 6], ["Escuela y educación", 5]].forEach(([titulo, semanas]) => {
    const m = mapaDe(titulo, semanas, HORARIOS["3x1"], { planMaestro: { estrategia: "problemas" } });
    const tareas = m.filas.flatMap((f) => f.tareas);
    const sin = [1, 2, 3, 4, 5, 6, 7].filter((n) => !tareas.some((t) => t.fase === n - 1));
    igual(sin, [], `${titulo} ${semanas} sem: fases sin su tarea`);
    ["problema_analizar", "problema_definir", "problema_objetivos"].forEach((c) => assert(tareas.some((t) => t.clave === c), `${titulo}: falta ${c}`));
  });
  const doce = mapaDe("Escuela y educación", 4, HORARIOS["3x1"], { planMaestro: { estrategia: "problemas" } });
  assert(doce.modo !== "breve" && !doce.filas.some((f) => f.flexible), `12 clases: ${doce.modo}`);
});
check("recoger datos se parametriza por estrategia: hábitos en Indagación, el problema o el caso en las demás", () => {
  const textos = (estrategia, semanas = 5) => {
    const m = mapaDe("Escuela y educación", semanas, HORARIOS["3x1"], { planMaestro: { estrategia } });
    ponerSecuencias(m, { producto: "Our Guide — una guía", tema: "Escuela", asunto: "cómo orientarse", audiencia: "los estudiantes de 6.º", semilla: "x", fuente: "una fuente" });
    return m.filas.filter((f) => f.tareas.some((t) => /^indagar_(disenar|aplicar)$/.test(t.clave))).flatMap((f) => (f.secuencia || []).map((x) => x.texto)).join(" ");
  };
  // La estructura del día de las clases de encuesta (sin gramática propia) también sigue a la estrategia.
  const filaEncuesta = (estrategia) => { const m = mapaDe("Escuela y educación", 5, HORARIOS["3x1"], { planMaestro: { estrategia } }); const t = m.filas.flatMap((f) => f.tareas).find((x) => x.clave === "indagar_aplicar"); return { clase: 3, tareas: [t], contenidos: [] }; };
  assert(/Did you…/.test(focoDeFila(filaEncuesta("problemas"), [])) && !/How often/.test(focoDeFila(filaEncuesta("problemas"), [])), `estructura en Problemas: ${focoDeFila(filaEncuesta("problemas"), [])}`);
  assert(/What happened/.test(focoDeFila(filaEncuesta("estudio_caso"), [])), "estructura en Estudio de caso");
  assert(/How often do you/.test(focoDeFila({ clase: 3, tareas: [{ clave: "indagar_aplicar", secciones: [] }], contenidos: [] }, [])), "estructura en Indagación");
  assert(SECUENCIAS_POR_TAREA["presentar:defender"]?.length >= 2 && !SECUENCIAS_POR_TAREA["presentar:defender"].some((v) => /cómo se usa/.test(v.map((x) => x.texto).join(" "))), "presentar de una propuesta no dice «cómo se usa»");
  const ind = textos("indagacion_dialogica", 6), prob = textos("problemas"), caso = textos("estudio_caso");
  assert(/How often do you/.test(ind) && /compañeros/.test(ind), "Indagación pregunta por hábitos a sus compañeros");
  assert(/Did you…/.test(prob) && /Where…/.test(prob) && /otro grupo a quienes afecta el problema/.test(prob) && !/How often|8 of 30/.test(prob), `Problemas: ${prob.slice(0, 200)}`);
  assert(/What happened…/.test(caso) && /conocen el caso/.test(caso) && !/How often/.test(caso), "Estudio de caso");
});
check("recoger datos se reutiliza en la fase de investigación de Problemas y Estudio de caso, desde 15 clases", () => {
  [["problemas", /^Análisis e investigación/], ["estudio_caso", /^Indagación o estudio/]].forEach(([estrategia, fase]) => {
    [["Escuela y educación", 5], ["Alimentación", 6]].forEach(([titulo, semanas]) => {
      const m = mapaDe(titulo, semanas, HORARIOS["3x1"], { planMaestro: { estrategia } });
      const idx = ["indagar_disenar", "indagar_aplicar", "indagar_contrastar"].map((c) => m.filas.flatMap((f) => f.tareas).find((t) => t.clave === c));
      assert(idx.every(Boolean), `${estrategia} ${semanas} sem: faltan tareas de recoger datos`);
      assert(idx.every((t) => fase.test(t.faseNombre)), `${estrategia}: fuera de su fase: ${idx.map((t) => t.faseNombre)}`);
    });
    const doce = mapaDe("Escuela y educación", 4, HORARIOS["3x1"], { planMaestro: { estrategia } });
    assert(doce.modo !== "breve" && !doce.filas.some((f) => f.flexible), `${estrategia} 12 clases: ${doce.modo}`);
  });
});
check("la prueba con la audiencia depende del tipo de producto: una propuesta se defiende, no se usa", () => {
  igual(pruebaDelProducto("Our Welcome Proposal — una propuesta bilingüe a la dirección", ["Causes", "Goals"]).tipo, "defender", "propuesta");
  igual(pruebaDelProducto("Our School Survival Guide", ["School Directions"]).tipo, "guia", "guía con su sección");
  igual(pruebaDelProducto("Our Menu", ["Welcome"]), null, "producto sin tipo conocido");
  // La estructura del día de la presentación de una propuesta justifica la recomendación, no «explica para qué sirve».
  const fp = (tipo) => ({ clase: 14, tareas: [{ clave: "presentar", tipoPrueba: tipo, secciones: [] }, { clave: "probar_audiencia", tipoPrueba: tipo, secciones: [] }], contenidos: [] });
  assert(/Defender una recomendación/.test(focoDeFila(fp("defender"), [])) && !/Defender/.test(focoDeFila(fp("guia"), [])), "estructura de la presentación de una propuesta");
  assert(SECUENCIAS_POR_TAREA["probar_audiencia:defender"]?.length >= 2 && SECUENCIAS_POR_TAREA["probar_audiencia:defender"].every((v) => /por qué|recomend|defiend/i.test(v.map((x) => x.texto).join(" "))), "secuencia de defender");
});
check("títulos de clase del código: acción y sección, nunca el nombre interno de la tarea", () => {
  [["Escuela y educación", 4, "proyectos"], ["Alimentación", 6, "insercion_entorno"], ["Actividades de la vida diaria", 4, "indagacion_dialogica"], ["Escuela y educación", 4, "problemas"]].forEach(([titulo, semanas, estrategia]) => {
    const m = mapaDe(titulo, semanas, HORARIOS[semanas === 6 ? "3x1" : "3x1"], { planMaestro: { estrategia } });
    m.filas.filter((f) => !f.flexible && f.tareas.length).forEach((f) => {
      const t = tituloDeClase(f, "Our Guide — una guía");
      assert(t && t.toLowerCase() !== f.tareas[0].nombre.toLowerCase() && !t.toLowerCase().startsWith(f.tareas[0].nombre.toLowerCase()), `${estrategia} C${f.clase}: ${t}`);
    });
    igual(new Set(m.filas.filter((f) => !f.flexible && f.tareas.length).map((f) => tituloDeClase(f, "P"))).size > 6, true, `${estrategia}: títulos variados`);
  });
  const f = { tareas: [{ clave: "corregir", nombre: "corregir, probar y verificar datos", secciones: ["Ordering Food"] }] };
  igual(tituloDeClase(f, "X"), "Corrigiendo: Ordering Food", "corregir con su sección");
  igual(tituloDeClase({ tareas: [{ clave: "acordar", nombre: "acordar el plan y hacer el diagnóstico", secciones: ["A"] }] }, "Our Guide — una guía"), "Acordando el plan de Our Guide", "acordar con el producto");
});
check("títulos casi iguales: se detectan los de la C1 y C2 de Rutinas, no los distintos ni los idénticos", () => {
  const t = ["Planificando Nuestro Plan de Rutinas Saludables", "Planificando Nuestro Plan de Rutinas Saludables Juntos", "Explorando el entorno escolar", "Planificando Nuestro Plan de Rutinas Saludables"];
  igual(titulosParecidos(t), [[1, 2], [2, 4]], "pares");
  igual(titulosParecidos(["Ensayando indicaciones", "Presentación de la guía"]), [], "distintos");
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
  assert(ref.contenidosSinLugar.every((x) => /ordinales|lugares|interaccion|interacción|fechas|indiferencia|why don|condicional|mostrar inter|hora/i.test(x)), `la referencia no recorta lo que tiene uso: ${ref.contenidosSinLugar}`);
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
  ["MAPA DE ESTAS CLASES", "Clase 4 (Semana 2)", "entrevistar (30 min)", "Tabla común con respuestas y datos", "ING-2-I03", "un invitado viene al aula", "«falta dato»", "contenidosEnClase", "ENTRE 4 Y 5 pasos", "Cierre: 2 actividades"]
    .forEach((t) => assert(p.includes(t), `falta: ${t}`));
  ["copia la lista EXACTA", "cada clase trabaja AL MENOS UNO", "Cierre: 3 actividades", ].forEach((t) => assert(!p.includes(t), `sobra: ${t}`));
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
  igual(validarLoteContrato(data, c, 1, 1, { esIdioma: true, redaccionConAviso: true }).length, 1, "pasa el contrato");
  validarFaseCompleta(data.clases, c);
});
check("el tipo de evidencia del Desarrollo lo dice la tarea", () => {
  const c = contratoDe(1);
  const data = { clases: [claseFalsa(c.mapaClases[0], { momentos: [{ nombre: "Desarrollo", actividades: ["x"], evidencias: { conocimientos: [], desempeno: ["Lista de datos"], producto: [] } }] })] };
  aplicarFilasMapa(data, c, 1);
  igual(data.clases[0].momentos[0].evidencias, { conocimientos: ["Lista de datos"], desempeno: [], producto: [] }, "conocimiento");
});
check("un contenido del mapa que no se ve en la unidad da aviso, no rechazo", () => {
  // Desde la fase 4: las anteriores tienen además sus propias obligaciones (diagnóstico, datos).
  const i = filasPorFase.findIndex((fs, n) => n >= 3 && fs.some((f) => f.contenidos.length));
  const c = contratoDe(i);
  const k = c.mapaClases.findIndex((f) => f.contenidos.length);
  const fila = c.mapaClases[k];
  const sinNada = claseFalsa(fila, { contenidosEnClase: [], textoModelo: { lineas: [] } });
  igual(contenidosSinUsar(sinNada, fila).length, fila.contenidos.length, "debía faltar todo");
  igual(contenidosSinUsar(claseFalsa(fila), fila), [], "con frase real cumple");
  const clases = Array.from({ length: k + 1 }, (_, n) => (n === k ? sinNada : claseFalsa(c.mapaClases[n])));
  const motivos = validarLoteContrato(aplicarFilasMapa({ clases }, c, 1), c, k + 1, 1, { esIdioma: true, redaccionConAviso: true });
  assert(!motivos[k].some((m) => /contenidos/.test(m)), "ya no se avisa por clase");
  const conFuncion = { clase: 9, contenidos: [{ texto: "Disculparse: I’m sorry; I apologize…", porFuncion: true }, { texto: "Mostrar nada: zzz", porFuncion: false }, { texto: "Funcional: Comprar", porFuncion: true }] };
  const dia = (t) => ({ momentos: [{ nombre: "Inicio", actividades: [t] }] });
  assert(/I’m sorry/.test(contenidosNoVistosEnUnidad([dia("Saludan.")], [conFuncion])[0]), "por función y no se ve");
  igual(contenidosNoVistosEnUnidad([dia("Saludan."), dia("Dicen _I apologize_.")], [conFuncion]), [], "en otra clase cuenta; sin función y funcional no se reclaman");
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
  assert(/no usa el producto/.test(obligacionIncumplida(clase("Presentan (en equipos) todas las secciones."), ref.filas[16])), "clase 17 sin pedidos");
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
  noUsa[6] = dia("Ordenan (en grupos) sus apuntes.");
  noUsa[7] = dia("Conversan (en grupos) sobre su clase.");
  assert(revisarUnidadConMapa(noUsa, ref.filas).some((a) => /clase 8: no se ve que use/.test(a)), "no usa lo recibido");
  // Lo que no nació en su clase se avisa allí, no en la que lo necesita.
  noUsa[6] = dia("Conversan (en grupos) sobre su clase.");
  assert(!revisarUnidadConMapa(noUsa, ref.filas).some((a) => /clase 8: no se ve que use/.test(a)), "se atribuye al origen");
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
    // Proyectos (César, 2026-11-07): acuerdo y diagnóstico en 22 minutos y, si cabe en la clase 1, el SQA de saberes previos.
    const claves = mapa.filas[0].tareas.map((t) => t.clave);
    assert(claves[0] === "acordar" && claves.every((c) => ["acordar", "saberes_previos"].includes(c)), `${semanas} semanas: ${claves}`);
    igual(mapa.filas[0].tareas[0].minutos, mapa.estrategia === "proyectos" ? 22 : 30, `${semanas} semanas, minutos`);
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
check("tareaId: los minutos de cada actividad son los de su tarea", () => {
  const tareas = [{ clave: "a", minutos: 8 }, { clave: "b", minutos: 22 }];
  igual(minutosPorTarea(tareas, ["T1", "T2", "T2"]), [8, 11, 11], "dos actividades en T2");
  igual(minutosPorTarea([{ clave: "a", minutos: 31 }], ["T1", "T1"]), [16, 15], "el resto va al inicio");
  igual(minutosPorTarea(tareas, ["T1", "T1"]), null, "tarea sin actividad");
  igual(minutosPorTarea(tareas, ["T1", "T3"]), null, "código inventado");
  igual(minutosPorTarea(tareas, ["T1", ""]), null, "código vacío");
  igual(minutosPorTarea(tareas, []), null, "sin códigos");
});
check("tareaId: la firma va en la tarea que la promete; sin códigos, como antes", () => {
  const con = conFirmas(["Analizan.", "Redactan.", "Revisan."], [{ clave: "describir_modelo" }, { clave: "describir_redactar" }], ["T1", "T2", "T2"]);
  assert(!/firma/.test(con[1]) && /firma su pieza/.test(con[2]), JSON.stringify(con));
  assert(/firma su pieza/.test(conFirmas(["Observan.", "Redactan su pieza."], [{ clave: "describir_redactar" }])[1]), "sin códigos");
});
check("tareaId: sale de la respuesta antes de unir la frase y no entra al texto", () => {
  const data = { clases: [{ momentos: [{ nombre: "Desarrollo", actividades: [{ tareaId: "T1", accion: "Escriben (en parejas) el guion", producto: "un guion", destino: "lo guardan" }, { tareaId: "T1", accion: "Definen (en grupos) turnos", producto: "una lista", destino: "la pegan" }] }] }] };
  normalizarVozBatch(data);
  igual(data.clases[0].tareaIdsDesarrollo, ["T1", "T1"], "códigos");
  assert(data.clases[0].momentos[0].actividades.every((a) => typeof a === "string" && !/T1/.test(a)), "se coló en el texto");
});
check("tareaId: lo que no encaja solo avisa", () => {
  const fila = ref.filas[5];
  const clase = (ids, n = ids.length) => ({ tareaIdsDesarrollo: ids, momentos: [{ nombre: "Desarrollo", actividades: Array(n).fill("x") }] });
  igual(motivosTareaId(clase(["T1", "T2"]), fila), [], "cumple");
  assert(/no trae/.test(motivosTareaId(clase([], 2), fila)[0]), "sin códigos");
  assert(motivosTareaId(clase(["T1", "T9"]), fila).some((m) => /T9/.test(m)), "inventado");
  igual(motivosTareaId(clase(["T1", "T1", "T2", "T2", "T2"]), fila), [], "varios pasos por tarea no es relleno");
});
check("presentar y usar el producto son dos tareas, y su clase no mezcla otras", () => {
  const f17 = ref.filas[16];
  igual(f17.tareas.map((t) => [t.clave, t.minutos, t.sumativa]), [["presentar", 15, true], ["probar_audiencia", 15, true]], "Alimentación");
  igual(f17.tareas[0].indicadores, ["ING-2-I02"], "presentar demuestra producir");
  igual(f17.tareas[1].indicadores, ["ING-2-I03"], "probar demuestra interactuar");
  assert(/pedidos reales/.test(f17.tareas[1].instruccion) && !/pedidos/.test(f17.tareas[0].instruccion), "cada una con lo suyo");
  igual(evaluacionDeFila(f17).tipo, "Sumativa", "tipo");
  igual(fallosQueDetienen(ref), [], "V6");
  const escuela = mapaDe("Escuela y educación", 4, HORARIOS["3x1"]);
  const fila = escuela.filas.find((f) => f.tareas.some((t) => t.clave === "presentar"));
  igual(fila.tareas.map((t) => t.clave), ["presentar", "probar_audiencia"], "la sumativa de Escuela va sola");
  igual(fila.tareas[1].tipoPrueba, "guia", "en Escuela, guiar");
  assert(fila.tareas[1].indicadores.includes("ING-2-I03") || fila.indicadores.includes("ING-2-I03"), "I03 en la sumativa");
  assert(escuela.filas.some((f) => f.tareas.some((t) => t.clave === "recorrer_lugares")), "sin ficha, hay recorrido");
  assert(new Set(escuela.filas.flatMap((f) => f.fases.map((x) => x.numero))).size >= 5, `fases de Escuela: ${JSON.stringify(escuela.ajustesPlan)}`);
});
check("tareaId: el esquema del prompt muestra el código y cuatro pasos", () => {
  const p = promptDe(1);
  const des = String(p).match(/"nombre":"Desarrollo"[^\]]*\]/)?.[0] || "";
  assert(/"tareaId":"T1"/.test(des) && (des.match(/"accion"/g) || []).length === 4, des.slice(0, 300) || String(p).slice(0, 200));
});
check("tareaId: el prompt nombra las tareas y pide el código", () => {
  const fuente = readFileSync(new URL("../src/services/phaseAService.js", import.meta.url), "utf8");
  assert(/\[T\$\{k \+ 1\}\]/.test(fuente) && /Cada paso lleva en "tareaId" el código de su tarea/.test(fuente) && /\{"tareaId":"T1","accion":"…","producto":"","destino":""\}/.test(fuente), "prompt");
});
check("banco de secuencias: cada tarea da 4 o 5 pasos sola, tiene esenciales y voz correcta", () => {
  Object.entries(SECUENCIAS_POR_TAREA).forEach(([clave, versiones]) => {
    assert(versiones.length >= 2, `${clave}: versiones`);
    versiones.forEach((pasos, v) => {
      assert(pasos.length >= 4 && pasos.length <= 5, `${clave} v${v}: ${pasos.length} pasos`);
      assert(pasos.some((x) => x.e), `${clave} v${v}: sin esenciales`);
      pasos.forEach((x) => {
        const voz = validarVozActividad(x.texto.replaceAll(/\{[a-z]+\}/g, "algo"));
        assert(voz.ok, `${clave} v${v}: ${voz.motivo} — ${x.texto}`);
      });
    });
  });
});
check("secuencias: la fila trae los datos de la unidad y solo un hueco para la IA", () => {
  const m = mapaDe("Alimentación", 6, HORARIOS["3x1"]);
  ponerSecuencias(m, { producto: "Our Guide — una guía", tema: "Alimentación", audiencia: "el dueño invitado y los visitantes", invitado: "el dueño invitado", semilla: "x" });
  igual(m.filas.filter((f) => f.secuencia).map((f) => f.clase), [1, 4, 17, 18], "clases con secuencia");
  m.filas.filter((f) => f.secuencia).forEach((f) => assert(f.secuencia.length >= 4 && f.secuencia.length <= 5, `C${f.clase}: ${f.secuencia.length} pasos`));
  m.filas.filter((f) => f.secuencia).forEach((f) => {
    igual(f.secuencia.reduce((s, x) => s + x.minutos, 0), 30, `C${f.clase} minutos`);
    f.tareas.forEach((t, k) => igual(f.secuencia.filter((x) => x.tarea === k).reduce((s, x) => s + x.minutos, 0), t.minutos, `C${f.clase} T${k + 1}`));
    f.secuencia.forEach((x) => assert(!/\{(producto|tema|audiencia|invitado|datos)\}/.test(x.texto) && !/\ba el\b|\bde el\b/.test(x.texto), x.texto));
  });
  assert(m.filas[3].secuencia.some((x) => /una pregunta por estudiante|su propia pregunta/.test(x.texto) && /al dueño invitado/.test(x.texto)), "entrevista");
  assert(m.filas[16].secuencia.some((x) => /pedido/.test(x.texto) && /audiencia|visitantes/.test(x.texto)), "pedidos con la audiencia");
  assert(m.filas[17].secuencia.some((x) => /^Corrigen/.test(x.texto)) && !m.filas[17].secuencia.some((x) => /para presentaci/.test(x.texto)), "corrige y entrega");
  igual(pasosConFrases([{ texto: "Hacen algo ({frases}), y sigue." }, { texto: "Otro ({frases})." }], [{ paso: 1, frases: "_Can I have…?_" }, { paso: 2, frases: "" }]), ["Hacen algo (_Can I have…?_), y sigue.", "Otro."], "huecos");
  igual(pasosConFrases([{ texto: "Escuchan cinco oraciones ({frases}) y marcan." }], [{ frases: "Escuchan al docente leer oraciones (_The library is open._; _The gym is big._)" }]), ["Escuchan cinco oraciones (_The library is open._, _The gym is big._) y marcan."], "el hueco no repite el paso");
  igual(pasosConFrases([{ texto: "Otro ({frases})." }], [{ frases: "sin cursiva" }]), ["Otro."], "sin cursiva, sin hueco");
});
check("la audiencia se nombra completa una vez por clase", () => {
  const m = mapaDe("Alimentación", 6, HORARIOS["3x1"]);
  ponerSecuencias(m, { producto: "G", tema: "T", audiencia: "el dueño invitado y los visitantes", invitado: "el dueño invitado", semilla: "x" });
  const t = m.filas[16].secuencia.map((x) => x.texto).join(" ");
  igual((t.match(/el dueño invitado y los visitantes|al dueño invitado y los visitantes/g) || []).length, 1, t);
  assert(/la audiencia/.test(t), t);
});
check("títulos: concordancia con guía y modelo sin «simulada»", () => {
  const d = conTitulosCorregidos({ titulo: "Revisión de Nuestro Guía", textoModelo: { titulo: "Entrevista Simulada con un Dueño" }, momentos: [{ actividades: ["Reúnan (en parejas) todo."] }] });
  igual(d.titulo, "Revisión de Nuestra Guía", "título");
  igual(d.textoModelo.titulo, "Entrevista modelo con un Dueño", "modelo");
  igual(d.momentos[0].actividades[0], "Reúnen (en parejas) todo.", "voz");
});
check("Escuela: audiencia de 6.º, sin «la persona invitada», aunque no sea Inserción", () => {
  const pm = { estrategia: "proyectos", situacion: { semillaId: "ing2-escuela-guia", audiencia: "nuevo ingreso", audienciaDetalle: { de: "nuevo ingreso" } } };
  assert(/6\.º de primaria/.test(conFichaDeUnidad({ planMaestro: pm }).planMaestro.situacion.audiencia), "audiencia");
  const delDocente = { ...pm, situacion: { ...pm.situacion, audiencia: "mi audiencia" } };
  igual(conFichaDeUnidad({ planMaestro: delDocente }).planMaestro.situacion.audiencia, "mi audiencia", "manda el docente");
  const fila = ref.filas[16];
  assert(!/persona invitada/.test(humanosDeFila(fila, null)), humanosDeFila(fila, null));
  assert(/6\.º/.test(humanosDeFila(fila, ALCANCE_POR_SEMILLA["ing2-escuela-guia"].conInvitado)), "humanos");
});
check("la situación de Escuela con su audiencia cabe en el máximo de 800 caracteres", () => {
  const base = { grado: "2do Secundaria", asignatura: "Inglés", centro: "Centro Hector Francisco Lopez - Hato Nuevo", numSemanas: 4, diasClase: ["l", "m", "x"], horasPorDia: 1, titulo: "Escuela y educación" };
  const d = conFichaDeUnidad({ ...base, ...prellenarPlanMaestro({ datos: base, indicadores: estructura.indicadores, competencias }) });
const texto = componerSituacion({ situacion: d.planMaestro.situacion, producto: d.productoFinalTexto, estrategia: d.planMaestro.estrategia });
  assert(/6\.º de primaria/.test(texto) && !/nuevo ingreso|cafeter/i.test(texto), texto.slice(0, 300));
  assert(texto.length <= 800, `${texto.length} caracteres`);
});
check("el Inicio de C1 conserva sus funciones orientadas a presentar la unidad", () => {
  const i = inicioPresentacion(["Saludo."], { producto: "Our Guide — una guía", secciones: ["A", "B"], semillaId: "ing2-alimentacion-menu" });
  igual(i.length, 5, "posiciones");
  igual(i[0], "Saludo.", "saludo");
  assert(/^Recuperación de experiencias/.test(i[1]) && /^Recuperación de saberes previos/.test(i[2]) && /Our Guide/.test(i[3]) && !/una guía/.test(i[3]) && /A, B/.test(i[3]), JSON.stringify(i));
  assert(/^Escuchan la intención pedagógica/.test(i[4]) && /conocer la unidad/.test(i[4]), i[4]);
  i.slice(1).forEach((a) => assert(validarVozActividad(a).ok, a));
});
check("C1: se lee la situación con ejemplos del problema, con pregunta por semilla y 4 minutos", () => {
  const de = (semillaId) => inicioPresentacion(["Saludo."], { producto: "P", semillaId })[2];
  assert(/escuchan la situación de aprendizaje, leída por el docente o un compañero/.test(de("ing2-escuela-guia")) && /ejemplos del problema/.test(de("ing2-escuela-guia")), de("ing2-escuela-guia"));
  assert(/menú de un comedor/.test(de("ing2-alimentacion-menu")), "Alimentación");
  assert(/primer día/.test(de("ing2-escuela-guia")), "Escuela");
  assert(/tiempo no les alcanza/.test(de("ing2-rutinas-plan")), "Rutinas");
  assert(/algo parecido/.test(de("")), "sin semilla");
  igual(minutosInicioPresentacion(10).join(), "1,2,4,2,1", "10 min");
  [5, 8, 10, 15].forEach((t) => igual(minutosInicioPresentacion(t).reduce((s, m) => s + m, 0), t, `total ${t}`));
  igual(minutosInicioPresentacion(4), null, "sin minutos para repartir");
});
check("I-11: la estructura del día y las actividades no nombran lugares; Model School sí", () => {
  igual(sinLugaresEnEjemplos("Revisar y consolidar: presente simple (_The library is next to the cafeteria_…)"), "Revisar y consolidar: presente simple", "estructura");
  igual(sinLugaresEnEjemplos("Redactan una ficha para describir un lugar del centro (_The library is next to..._)."), "Redactan una ficha para describir un lugar del centro.", "ejemplo");
  igual(sinLugaresEnEjemplos("Retroalimentación de los lugares importantes del centro. Where is the library located?"), "Retroalimentación de los lugares importantes del centro.", "pregunta");
  igual(sinLugaresEnEjemplos("Analizan el modelo de Model School: the gym is next to the library."), "Analizan el modelo de Model School: the gym is next to the library.", "ficticio");
  igual(sinLugaresEnEjemplos("Leen la tabla común y escriben dos frases."), "Leen la tabla común y escriben dos frases.", "sin lugar");
  const dia = { focoLinguistico: "Comentar: presente simple (_The library is next to the gym_...).", momentos: [{ nombre: "Desarrollo", actividades: ["Visitan la biblioteca y anotan"], metacognicion: [], evidencias: {} }] };
  const restantes = sinLugaresEnClase(dia);
  assert(!/library|gym/.test(dia.focoLinguistico), dia.focoLinguistico);
  igual(restantes.length, 0, "la frase entera pasa a un lugar genérico");
  igual(dia.momentos[0].actividades[0], "Visitan un lugar del centro y anotan", "lugar genérico");
});
check("«guía» concuerda en femenino en todo el texto de la clase", () => {
  igual(conGuiaEnFemenino("discuten mejoras para el guía y del guía; nuestro guía, El guía"), "discuten mejoras para la guía y de la guía; nuestra guía, La guía", "concordancia");
  igual(conGuiaEnFemenino("habla con el guía turístico"), "habla con el guía turístico", "la persona");
  const dia = conTitulosCorregidos({ titulo: "Nuestro guía", momentos: [{ actividades: ["Evalúan mejoras para el guía."], evidencias: { saber: ["lista para el guía"] } }] });
  assert(dia.titulo === "Nuestra guía" && /para la guía/.test(dia.momentos[0].actividades[0]) && /para la guía/.test(dia.momentos[0].evidencias.saber[0]), JSON.stringify(dia));
});
check("gramática: máximo 3 estructuras por clase y consejos en las clases de proponer", () => {
  [mapaDe("Escuela y educación", 4, HORARIOS["3x1"]), mapaDe("Alimentación", 6, HORARIOS["3x1"])].forEach((m) => {
    m.filas.forEach((f) => assert(f.contenidos.filter((c) => c.categoria === "gramatica").length <= TOPE_GRAMATICA_POR_CLASE, `C${f.clase}`));
    ["condicional", "why don"].forEach((t) => {
      const fila = m.filas.find((f) => f.contenidos.some((c) => normalizaTexto(c.texto).startsWith(t)));
      assert(fila?.tareas.some((x) => /^proponer_/.test(x.clave)), `${t}: ${fila?.clase}`);
    });
  });
});
check("la estructura del día sale de la fila y corresponde a la tarea", () => {
  const fila = (clave, contenidos = []) => ({ tareas: [{ clave }], contenidos });
  igual(focoDeFila(fila("presentar")), "Explicar para qué sirve cada sección: presente simple (_This section shows…_)", "presentar");
  igual(focoDeFila(fila("evaluar_comentarios")), "Responder a los comentarios (_They ask for…_, _We should change…_)", "responder");
  igual(focoDeFila(fila("corregir_final")), "Corregir y mejorar lo escrito: presente simple", "por tipo");
  igual(focoDeFila(fila("proponer_elegir", [{ categoria: "gramatica", texto: "Should para pedir y dar consejos y sugerencias: You should drink more. Other." }])), "Pedir y dar consejos y sugerencias: should", "gramática");
  igual(focoDeFila(fila("aplicar_modelo", [{ categoria: "funcionales", texto: "Funcional: Solicitar y ofrecer ayuda" }])), "Solicitar y ofrecer ayuda (_Could you…?_)", "función sin gramática");
});
check("cada función va a una tarea donde se usa; Escuela no pide «reunir» en Welcome", () => {
  const e = mapaDe("Escuela y educación", 4, HORARIOS["3x1"]);
  const donde = (t) => e.filas.find((f) => f.contenidos.some((c) => normalizaTexto(c.texto).includes(t)));
  assert(donde("sostener una conversacion")?.tareas.some((x) => ["visitar_entrevistar", "aplicar_ensayar", "comentar", "probar_audiencia"].includes(x.clave)), `sostener: C${donde("sostener una conversacion")?.clase}`);
  assert(donde("solicitar y ofrecer ayuda")?.tareas.some((x) => ["aplicar_modelo", "orientar_probar", "probar_audiencia"].includes(x.clave)), `ayuda: C${donde("solicitar y ofrecer ayuda")?.clase}`);
  assert(!e.filas.some((f) => f.tareas.some((x) => x.clave === "socializar_reunir")), "reunir sigue en Escuela");
  assert(ref.filas.length === 18, "Alimentación conserva sus clases");
});
check("el modelo se declara ejemplo, el título en inglés se cambia y el plural se corrige", () => {
  const d = conTitulosCorregidos({ titulo: "Exploring and Sharing Findings", textoModelo: { titulo: "Entrevista al dueño", lineas: ["A: Hi"] } }, { nombreModelo: "Comedor modelo", tituloTarea: "Comentar por estaciones" });
  igual(d.titulo, "Comentar por estaciones", "título");
  igual(d.textoModelo.titulo, "Comedor modelo — Entrevista al dueño", "modelo");
  igual(conTitulosCorregidos({ textoModelo: { titulo: "Entrevista modelo", lineas: ["A"] } }, { nombreModelo: "Comedor modelo" }).textoModelo.titulo, "Entrevista modelo", "ya declarado");
  assert(!tituloEnIngles("Presentación de Our Community Food Guide"), "español con nombre del producto");
  const alimentacion = ALCANCE_POR_SEMILLA["ing2-alimentacion-menu"].conInvitado.reemplazos;
  igual(conReemplazos({ titulo: "El guion para los dueños de comedores", momentos: [] }, alimentacion).titulo, "El guion para el dueño del comedor", "plural");
});
check("erratas, comedor local y estructura de la clase que reúne el producto", () => {
  igual(conErratasCorregidas("Presentamos nuesros platos y Nuestos menús"), "Presentamos nuestros platos y Nuestros menús", "errata");
  igual(conErratasCorregidas("Nuestra unidad y clases"), "Nuestra unidad y clases", "sin errata");
  const alimentacion = ALCANCE_POR_SEMILLA["ing2-alimentacion-menu"].conInvitado.reemplazos;
  const dia = conReemplazos({ textoModelo: { titulo: "Ordering Food at a Café", lineas: ["A: Welcome to the local diner.", "B: Un café con leche."] } }, alimentacion);
  igual(dia.textoModelo.titulo, "Ordering Food at the comedor", "título");
  igual(dia.textoModelo.lineas.join(" "), "A: Welcome to the comedor. B: Un café con leche.", "líneas");
  igual(focoDeFila({ tareas: [{ clave: "aplicar_corregir" }, { clave: "integrar" }], contenidos: [] }), "Revisar el conjunto: presente simple (_This section shows…_)", "reúne");
  igual(focoDeFila({ tareas: [{ clave: "aplicar_corregir" }], contenidos: [] }), "Corregir y mejorar lo escrito: presente simple", "corrige");
});
check("el video se quita también con «our video»", () => {
  const m = [{ nombre: "Inicio", actividades: [], metacognicion: ["What do you remember from our video?"] }];
  sinEquipos(m, "Hojas");
  assert(!/video/.test(m[0].metacognicion[0]), m[0].metacognicion[0]);
});
check("frases por paso: el hueco toma las expresiones de la malla y, si no hay, una pista", () => {
  const m = mapaDe("Alimentación", 6, HORARIOS["3x1"]);
  ponerSecuencias(m, { producto: "G", tema: "T", invitado: "el dueño invitado", semilla: "x" });
  const c4 = m.filas[3].secuencia;
  assert(c4.some((x) => /cortes|welcome|Pardon/i.test(x.pista)), JSON.stringify(c4.map((x) => x.pista)));
  assert(c4.every((x) => !/\{frases\}/.test(x.texto) || x.pista), "hueco sin pista");
  assert(m.filas[16].secuencia.some((x) => /I’ll have/.test(x.texto) && /Could you repeat that/.test(x.texto)), "pedidos con frases fijas");
  assert(m.filas[16].secuencia.some((x) => /tarjetas/.test(x.texto) && /I wish/.test(x.texto)), "comentarios con frases fijas");
  assert(/tomados de lo que indica cada hueco/.test(readFileSync(new URL("../src/services/phaseAService.js", import.meta.url), "utf8")), "regla");
});
check("secuencias: la versión varía por unidad, y sin invitado la entrevista sigue con la IA", () => {
  const una = (semilla) => { const m = mapaDe("Alimentación", 6, HORARIOS["3x1"]); ponerSecuencias(m, { producto: "G", tema: "T", semilla }); return m.filas[3].secuencia[0].texto; };
  assert(["a", "b", "c", "d", "e"].map(una).some((t, _, l) => t !== l[0]), "siempre la misma versión");
  const m = mapaDe("Alimentación", 6, HORARIOS["3x1"], { mapa: { modalidadVisita: "entre_sesiones" } });
  ponerSecuencias(m, { producto: "G", tema: "T", semilla: "x" });
  assert(!m.filas[3].secuencia, "no debe usar secuencia sin invitado");
});
check("secuencias: el código escribe los pasos antes de unir frases y pasan el contrato", () => {
  const c = contratoDe(0);
  ponerSecuencias({ filas: c.mapaClases }, { producto: "Our Guide", tema: "Alimentación", semilla: "x" });
  const data = { clases: [claseFalsa(c.mapaClases[0], { momentos: [{ nombre: "Desarrollo", actividades: [{ paso: 1, frases: "" }, { paso: 2, frases: "" }, { paso: 3, frases: "_I eat rice…_" }] }] })] };
  aplicarSecuencias(data, c, 1);
  normalizarVozBatch(data);
  const a = data.clases[0].momentos[0].actividades;
  igual(a.length, c.mapaClases[0].secuencia.length, "todos los pasos");
  assert(a.every((x) => typeof x === "string" && x.length > 20 && !/\{frases\}/.test(x)), JSON.stringify(a).slice(0, 200));
  assert(/_I eat rice…_/.test(a[2]), a[2]);
  igual(data.clases[0].minutosSecuencia.reduce((s, x) => s + x, 0), 30, "minutos");
  validarLoteContrato(aplicarFilasMapa(data, c, 1), c, 1, 1, { esIdioma: true, redaccionConAviso: true });
});
check("cada contenido va a la tarea que lo usa; lo que no encaja queda sin lugar", () => {
  const donde = (t) => ref.filas.filter((f) => f.contenidos.some((c) => normalizaTexto(c.texto).startsWith(t))).map((f) => f.tareas.map((x) => x.clave).join("+"));
  assert(donde("voz pasiva").some((x) => /describir_redactar|analizar_borrador/.test(x)), `pasiva: ${donde("voz pasiva")}`);
  assert(donde("cortesia").some((x) => /visitar_entrevistar/.test(x)), `cortesía: ${donde("cortesia")}`);
  assert(donde("will para").some((x) => /aplicar/.test(x)), `will: ${donde("will para")}`);
  assert(donde("should para").some((x) => /proponer/.test(x)), `should: ${donde("should para")}`);
  ["numeros ordinales", "lugares", "formas de interaccion", "fechas"].forEach((t) => {
    igual(donde(t), [], t);
    assert(ref.contenidosSinLugar.some((x) => normalizaTexto(x.slice(x.indexOf(":") + 1)).startsWith(t)), `${t} sin declarar`);
  });
  assert(ref.filas.every((f) => f.contenidos.length <= TOPE_CONTENIDOS_POR_CLASE), "tope");
});
check("el diagnóstico se reconoce por sus partes, aunque lleven organización", () => {
  igual(minutosConDiagnostico(["Socializan (en plenaria) la importancia.", "Escuchan (en grupos) oraciones y marcan imágenes.", "Leen (en pares) un menú y escriben dos oraciones.", "Responden (en parejas) a una pregunta."], 30), [10, 8, 6, 6], "clase 1 real");
});
check("lo «grabado» pasa a observado y anotado, sin tocar la negación ni otras palabras", () => {
  const m = [{ nombre: "Desarrollo", actividades: ["Ejecutan pedidos: interacción oral, grabada para revisión; lo guardan.", "Retroalimentación de las entrevistas grabadas.", "Hablan, sin grabado alguno.", "Usan un grabador."], actividadesDetalle: [{ texto: "Oral, grabada." }], evidencias: { desempeno: ["Diálogo grabado"] } }];
  sinGrabado(m);
  igual(m[0].actividadesDetalle[0].texto, "Oral, observada y anotada.", "detalle");
  igual(m[0].actividades, ["Ejecutan pedidos: interacción oral, observada y anotada para revisión; lo guardan.", "Retroalimentación de las entrevistas observadas y anotadas.", "Hablan, sin grabado alguno.", "Usan un grabador."], "actividades");
  igual(m[0].evidencias.desempeno, ["Diálogo observado y anotado"], "evidencias");
});
check("al reintentar una fase, la memoria vuelve a como estaba antes de la fase", () => {
  const fuente = readFileSync(new URL("../src/services/unidadAprendizajeService.js", import.meta.url), "utf8");
  assert(/const memoriaAntesDeFase = memoriaAcumulada\.length;\s+for \(let intento = 1; !weekPlan; intento\+\+\) \{[\s\S]{0,260}memoriaAcumulada\.length = memoriaAntesDeFase;\s+try \{\s+weekPlan = await generateWeekPlan/.test(fuente), "falta restaurar la memoria");
});

check("I-20: los instrumentos traen criterios de comprensión y de las secciones; cada clase dice cuáles evalúa", () => {
  const ax = construirAnexosUnidad({ area: "Inglés", tema: "T", producto: "Our Plan", secciones: ["Our Daily Routines", "What We Found"] });
  igual(ax.listaCotejoOral.length, 7, "la lista de cotejo oral tiene un ítem de comprensión");
  assert(/Responde a preguntas e indicaciones/.test(ax.listaCotejoOral[6].criterio), "ítem de comprensión de la lista");
  igual(ax.escalaValoracion.length, 5, "la escala tiene un ítem de comprensión");
  assert(/Our Daily Routines, What We Found/.test(ax.rubricaProducto[2].n4), "la rúbrica nombra las secciones del plan");
  assert(!/Our Daily Routines/.test(construirAnexosUnidad({ area: "Inglés", tema: "T", producto: "P" }).rubricaProducto[2].n4), "sin secciones, como antes");
  const dias = [{ indicadoresTrabajados: [{ id: "ING-2-I02" }, { id: "ING-2-I03" }], momentos: [
    { evaluacion: { instrumento: "Lista de cotejo oral (Anexo B) y Escala de valoración (Anexo E.2)" } },
    { evaluacion: { instrumento: "Evaluación diagnóstica (Anexo J)" } },
  ] }, { indicadoresTrabajados: [{ id: "ING-2-I01" }], momentos: [{ evaluacion: { instrumento: "Lista de cotejo" } }] }];
  vincularInstrumentosConClases(dias, {
    listaCotejoOral: [{ indicadorCodigo: "ING-2-I03" }, { indicadorCodigo: "ING-2-I02" }, { indicadorCodigo: "ING-2-I02" }, { indicadorCodigo: "ING-2-I01" }],
    escalaValoracion: [{ indicadorCodigo: "ING-2-I02" }],
  });
  igual(dias[0].momentos[0].evaluacion.criterios, "Anexo B, criterios 1, 2 y 3; Anexo E.2, criterio 1", "criterios de la clase 1");
  assert(!dias[0].momentos[1].evaluacion.criterios, "el diagnóstico (Anexo J) no se vincula");
  igual(dias[1].momentos[0].evaluacion.criterios, "Anexo B, criterio 4", "una clase de comprensión evalúa el ítem de comprensión");
  // Con lo que la clase hace, cita solo los criterios de esa dimensión.
  const d2 = [{ indicadoresTrabajados: [{ id: "ING-2-I02" }, { id: "ING-2-I03" }], momentos: [{ evaluacion: { instrumento: "Lista de cotejo oral (Anexo B)" } }] }];
  vincularInstrumentosConClases(d2, { listaCotejoOral: [{ indicadorCodigo: "ING-2-I03", exige: "interaccion" }, { indicadorCodigo: "ING-2-I02", exige: "produccion" }, { indicadorCodigo: "ING-2-I02", exige: "produccion" }, { indicadorCodigo: "ING-2-I03", exige: "interaccion" }] }, () => ["interaccion"]);
  igual(d2[0].momentos[0].evaluacion.criterios, "Anexo B, criterios 1 y 4", "solo los de interacción");
  const d3 = [{ indicadoresTrabajados: [{ id: "ING-2-I02" }], momentos: [{ evaluacion: { instrumento: "Lista de cotejo" } }] }];
  vincularInstrumentosConClases(d3, { listaCotejoOral: [{ indicadorCodigo: "ING-2-I02", exige: "produccion" }] }, () => ["comprension"]);
  igual(d3[0].momentos[0].evaluacion.criterios, "Anexo B, criterio 1", "si la dimensión no coincide con ninguno, valen los del indicador");
  // La sumativa cita los criterios de todos los indicadores de su clase, aunque sus verbos sean de producción.
  const d4 = [{ indicadoresTrabajados: [{ id: "ING-2-I02" }, { id: "ING-2-I03" }], momentos: [{ evaluacion: { tipo: "Sumativa", instrumento: "Rúbrica analítica (Anexo A) y lista de cotejo oral (Anexo B)" } }] }];
  vincularInstrumentosConClases(d4, { rubricaProducto: [{ indicadorCodigo: "ING-2-I02", exige: "produccion" }, { indicadorCodigo: "ING-2-I03", exige: "interaccion" }], listaCotejoOral: [{ indicadorCodigo: "ING-2-I03", exige: "interaccion" }, { indicadorCodigo: "ING-2-I02", exige: "produccion" }] }, () => ["produccion"]);
  igual(d4[0].momentos[0].evaluacion.criterios, "Anexo A, criterios 1 y 2; Anexo B, criterios 1 y 2", "sumativa: todos los indicadores");
});

console.log(`\nResultado: ${pasos} pasan, ${fallos} fallan.`);
if (fallos) process.exit(1);
