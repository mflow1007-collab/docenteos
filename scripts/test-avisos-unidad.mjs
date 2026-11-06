/**
 * test-avisos-unidad.mjs — Los avisos del administrador: sin falsos positivos, con su corrección.
 * La unidad a mano de Alimentación da cero avisos. Casos reales del panel de Escuela (2026-11-06).
 * Sin IA: node scripts/test-avisos-unidad.mjs
 */
import { readFileSync } from "node:fs";
import { armarMapaClases, didacticosDeFila, conFichaDeUnidad, conTildesCorregidas, conTitulosCorregidos, focoDeFila, necesitaLugares, pasosConFrases, ponerSecuencias, sinLugaresEnClase } from "../src/services/mapaClasesService.js";
import { armarEntradaPlanMaestro, prellenarPlanMaestro, resolverIndicadoresEstructurados, competenciasDeMalla } from "../src/services/vistaPreviaPlanMaestroService.js";
import {
  avisosParaAdministrador, conOrganizacionEnParentesis, contenidosFaltantesEnClase, contenidosNoVistosEnUnidad, datosSinRecoger, pendientesDeClase, instruccionTareaFaltante, motivoRedaccionActividad, motivosClaseFinal, motivosFidelidad, motivosRedaccionClase,
  motivosTareaId, motivosTextoClase, obligacionIncumplida, revisarUnidadConMapa, tareasSinActividad,
} from "../src/services/redaccionFaseService.js";
import { ASUNTO_LECTURA_POR_SEMILLA, FUENTE_POR_SEMILLA, LUGARES_NO_DECLARADOS } from "../src/data/tareasPorTipoTrabajo.js";

const malla = JSON.parse(readFileSync(new URL("../src/data/curriculo/mallas/malla_ingles_2do_secundaria_2023.json", import.meta.url), "utf8"));
const estructura = resolverIndicadoresEstructurados(malla);
const competencias = competenciasDeMalla(malla, estructura.indicadores);
const mapaDe = (titulo, numSemanas) => {
  const base = { grado: "2do Secundaria", asignatura: "Inglés", centro: "C", numSemanas, diasClase: ["l", "m", "x"], horasPorDia: 1, titulo };
  const datos = conFichaDeUnidad({ ...base, ...prellenarPlanMaestro({ datos: base, indicadores: estructura.indicadores, competencias }) });
  const { entrada } = armarEntradaPlanMaestro({ datos, mallaPayload: malla });
  const mapa = armarMapaClases(entrada);
  return { mapa, semillaId: datos.planMaestro.situacion.semillaId, producto: entrada.producto };
};
const alimentacion = mapaDe("Alimentación", 6).mapa;
const { mapa: escuela, semillaId: semillaEscuela } = mapaDe("Escuela y educación", 4);
const claseDe = (clave, mapa = escuela) => mapa.filas.find((f) => f.tareas.some((t) => t.clave === clave));
const desarrollo = (...actividades) => ({ momentos: [{ nombre: "Desarrollo", actividades }] });

let fallos = 0;
const check = (nombre, fn) => {
  try { fn(); console.log(`  ✓ ${nombre}`); } catch (e) { fallos += 1; console.log(`  ✗ ${nombre}: ${e.message}`); }
};
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

// Los mismos avisos que da la generación, por clase y por unidad.
const avisosDeUnidad = (dias, filas) => [
  ...dias.flatMap((dia, i) => {
    const fila = filas[i];
    const faltan = tareasSinActividad(dia, fila);
    return [
      ...(faltan.length ? [instruccionTareaFaltante(faltan, filas, fila.clase)] : []),
      ...motivosFidelidad(dia, fila).filter((m) => !/^no se ve la tarea/.test(m)),
      ...motivosTextoClase(dia), ...datosSinRecoger(dia, fila), obligacionIncumplida(dia, fila),
      ...motivosRedaccionClase(dia, "c", { esIdioma: true, conMapa: true }),
      ...(necesitaLugares(fila) ? sinLugaresEnClase(structuredClone(dia)) : []),
      ...motivosClaseFinal(conTitulosCorregidos(structuredClone(dia), { nombreModelo: "Comedor modelo", tituloTarea: "Título de la tarea" })),
    ].filter(Boolean).map((m) => `C${i + 1} ${m}`);
  }),
  ...revisarUnidadConMapa(dias, filas), ...contenidosNoVistosEnUnidad(dias, filas),
];

console.log("\n[Avisos del administrador]");
check("unidad a mano de Alimentación: cero avisos", () => {
  const { dias } = JSON.parse(readFileSync(new URL("./fixtures/unidad-mano-alimentacion.json", import.meta.url), "utf8"));
  assert(dias.length === alimentacion.filas.length, "la unidad no cuadra con el mapa");
  const avisos = avisosDeUnidad(dias, alimentacion.filas);
  assert(!avisos.length, `${avisos.length}: ${avisos.slice(0, 6).join(" | ")}`);
});
check("tarea por acción y objeto: «Acompañan… e indican el camino» prueba el producto", () => {
  const fila = claseDe("probar_audiencia");
  const clase = desarrollo("Muestran (en grupos) las secciones y las presentan.", "Acompañan (en parejas) a los estudiantes de 6.º de primaria con la guía en la mano e indican el camino.");
  assert(!tareasSinActividad(clase, fila).some((t) => t.clave === "probar_audiencia"), "no la reconoce");
  assert(tareasSinActividad(desarrollo("Presentan (en grupos) las secciones."), fila).some((t) => t.clave === "probar_audiencia"), "debe faltar");
  assert(!tareasSinActividad({ ...desarrollo("x"), secuenciaAplicada: true }, fila).length, "el banco ya trae sus tareas");
});
check("C6: elegir y elaborar están; lo que falta es la pieza de la otra sección", () => {
  const fila = escuela.filas[5];
  const texto = desarrollo("Discuten (en grupos) las sugerencias y eligen las más relevantes.", "Elaboran (en grupos) una propuesta para _School Success Tips_.", "Redactan (en grupos) un borrador de _School Success Tips_.");
  const faltan = tareasSinActividad(texto, fila);
  assert(faltan.length === 1 && faltan[0].clave === "proponer_elaborar" && faltan[0].secciones[0] === "Final Recommendation", faltan.map((t) => t.nombre).join());
  assert(!tareasSinActividad({ momentos: [{ nombre: "Desarrollo", actividades: [...texto.momentos[0].actividades, "Redactan (en grupos) el borrador de «Final Recommendation»."] }] }, fila).length, "con la pieza cumple");
  const m = instruccionTareaFaltante(faltan, escuela.filas, fila.clase);
  assert(/Final Recommendation/.test(m) && /Conserva las demás/.test(m), m);
});
check("C2: «reunir lo hecho» no se reclama (revisión de Escuela v4)", () => {
  const fila = escuela.filas[1];
  assert(!tareasSinActividad(desarrollo("Recorren (en grupos) el centro.", "Analizan (en plenaria) el modelo.", "Hacen (en grupos) el mapa del recorrido."), fila).length, "no debe forzarla");
});
check("tareaId: sin ID o con otro ID es correspondencia, no tarea ausente", () => {
  const fila = escuela.filas[5];
  const clase = { tareaIdsDesarrollo: ["T1", "T1", "T2", "T2"], ...desarrollo("Discuten (en grupos) la tabla.", "Justifican su elección.", "Elaboran (en grupos) una propuesta de School Success Tips y de Final Recommendation.", "Redactan (en grupos) el borrador.") };
  const m = motivosTareaId(clase, fila);
  assert(m.length === 2 && m.every((x) => /correspondencia/.test(x) && /Final Recommendation/.test(x)), m.join(" | "));
  assert(/correspondencia/.test(motivosTareaId({ ...clase, tareaIdsDesarrollo: [] }, fila)[0]), "sin ID");
});
check("I-11: detecta gym, cafeteria, art room y floor; Model School se permite; C4 se cita bien", () => {
  ["gym", "cafetería", "cafeteria", "art room", "first floor", "library"].forEach((t) => assert(LUGARES_NO_DECLARADOS.test(`Next to the ${t}.`), t));
  ["the office", "the classroom", "platform", "Library's"].slice(0, 3).forEach((t) => assert(!LUGARES_NO_DECLARADOS.test(t), t));
  const dia = { focoLinguistico: "Comentar: (_The library is next to the gym_).", intencionPedagogica: "Usan el presente (_The art room is on the second floor_).", textoModelo: { titulo: "Model School", lineas: ["The gym is here."] },
    momentos: [{ nombre: "Desarrollo", actividades: ["Redactan de manera individual una ficha con dos frases: una para pedir ayuda en inglés y otra para describir un lugar del centro (_The library is next to..._)."], evidencias: { saber: ["Texto:\n1. Fichas."] } }] };
  const quitados = [];
  assert(!sinLugaresEnClase(dia, quitados).length, "debía limpiarlo todo");
  assert(!/gym|library|art room/.test(JSON.stringify({ ...dia, textoModelo: null })), JSON.stringify(dia));
  assert(/gym/.test(dia.textoModelo.lineas[0]), "el modelo declarado no se toca");
  assert(quitados.some((q) => /library/.test(q)), `la cita debe mostrar la causa: ${quitados}`);
  assert(/Fichas/.test(dia.momentos[0].evidencias.saber[0]) && /\n/.test(dia.momentos[0].evidencias.saber[0]), "aplana el formato");
  const conEnganche = { momentos: [{ nombre: "Inicio", actividades: ["a", "b", "c", "Observan la ubicación del auditorio y las áreas comunes.", "e"] }] };
  assert(!sinLugaresEnClase(conEnganche).length && !/auditorio/.test(conEnganche.momentos[0].actividades[3]), "el enganche se sustituye");
});
check("verbos nuevos y mensaje de organización con el texto real", () => {
  ["Recorren", "Firman", "Justifican", "Prueban", "Anotan", "Discuten", "Ensayan", "Clasifican", "Reúnen", "Acuerdan", "Recogen"].forEach((v) => assert(!/lista de verbos/.test(motivoRedaccionActividad(`${v} (en parejas) sus fichas.`, { esIdioma: true })), v));
  const m = motivoRedaccionActividad("Comparten sus fichas en grupo y las leen.");
  assert(/«en grupo»/.test(m) && /"Comparten \(en grupo\) …"/.test(m), m);
  assert(!motivoRedaccionActividad("Reflexionan sobre la ayuda: reflexiones orales; se comparten en grupo."), "el destino no es organización");
  assert(!motivoRedaccionActividad("Preguntan y responden (en parejas) _What do you eat?_", { esIdioma: true }), "dos verbos");
});
check("el paréntesis de la organización lo pone el código", () => {
  const igual = (a, b) => assert(a === b, a);
  igual(conOrganizacionEnParentesis("Socializan en plenaria sus fichas y eligen una."), "Socializan (en plenaria) sus fichas y eligen una.");
  igual(conOrganizacionEnParentesis("Elaboran (Gallery Walk) ideas en parejas: fichas; se guardan."), "Elaboran (en parejas, Gallery Walk) ideas: fichas; se guardan.");
  igual(conOrganizacionEnParentesis("Completan una tabla (en parejas) con las recomendaciones."), "Completan (en parejas) una tabla con las recomendaciones.");
  igual(conOrganizacionEnParentesis("Comparten (en parejas) sus fichas y luego en plenaria."), "Comparten (en parejas) sus fichas y luego en plenaria.");
  igual(conOrganizacionEnParentesis("Reflexionan sobre la ayuda: se comparten en grupo."), "Reflexionan sobre la ayuda: se comparten en grupo.");
});
check("lugares: la frase entera pasa a genérica en Inicio, Desarrollo y Cierre", () => {
  const dia = { momentos: ["Inicio", "Desarrollo", "Cierre"].map((nombre) => ({ nombre, actividades: ["Observan la ubicación del auditorio y las áreas comunes."], metacognicion: ["What is the function of the library?"] })) };
  const quitados = [];
  assert(!sinLugaresEnClase(dia, quitados).length && quitados.length, "debía corregirlo");
  dia.momentos.forEach((m) => { assert(m.actividades[0] === "Observan la ubicación de un lugar del centro y las áreas comunes.", m.actividades[0]); assert(m.metacognicion[0] === "What is the function of this place?", m.metacognicion[0]); });
});
check("corrección dirigida también por contenido; lo que no encaja no la pide", () => {
  const fila = { clase: 8, tareas: [], contenidos: [{ texto: "Disculparse: I’m sorry; I apologize…", porFuncion: true }, { texto: "Funcional: Comprar", porFuncion: true }, { texto: "Otro: zzz" }] };
  assert(contenidosFaltantesEnClase(desarrollo("Saludan."), fila).length === 1, "falta Disculparse");
  assert(!contenidosFaltantesEnClase(desarrollo("Dicen _I apologize_."), fila).length, "se ve");
  assert(/Disculparse/.test(pendientesDeClase(desarrollo("Saludan."), fila)[0]), "pendientes");
});
check("«Hora» solo va a la entrevista: Escuela no tiene y queda sin lugar", () => {
  assert(escuela.contenidosSinLugar.some((x) => /:Hora:/.test(x)), "Escuela: sin lugar");
  alimentacion.filas.filter((f) => f.contenidos.some((x) => /^Hora:/.test(x.texto))).forEach((f) => assert(f.tareas.some((t) => t.clave === "visitar_entrevistar"), `C${f.clase}`));
});
check("el nombre del producto o de una sección no rellena las frases de un paso", () => {
  const paso = [{ texto: "Muestran las secciones explicando para qué sirve cada una ({frases})." }];
  const nombres = ["Our School Survival Guide — una guía", "Welcome"];
  assert(!/\(/.test(pasosConFrases(paso, [{ frases: "_Our School Survival Guide_" }], { nombres })[0]), "producto");
  assert(/This section shows/.test(pasosConFrases(paso, [{ frases: "_This section shows…_" }], { nombres })[0]), "frase real");
});
check("revisión de Escuela: reunir lo hecho no adelanta la integración", () => {
  const dias = escuela.filas.map((f) => desarrollo(`Trabajan (en grupos) con ${f.recibe.map((r) => r.texto).join(" y ")}.`));
  dias[1] = desarrollo("Reúnen (en plenaria) las ideas y datos recopilados.");
  assert(!revisarUnidadConMapa(dias, escuela.filas).some((a) => /clase 2: adelanta/.test(a)), "su propia tarea");
});
check("revisión de Alimentación: presentar al grupo y datos recibidos no son fallos", () => {
  const dias = alimentacion.filas.map((f) => desarrollo(`Trabajan (en grupos) con ${f.recibe.map((r) => r.texto).join(" y ")}.`));
  dias[4] = desarrollo(...dias[4].momentos[0].actividades, "Presentan (en plenaria) su texto corregido al resto del grupo.");
  assert(!revisarUnidadConMapa(dias, alimentacion.filas).some((a) => /clase 5: adelanta/.test(a)), "al grupo no adelanta");
  dias[4] = desarrollo(...dias[4].momentos[0].actividades, "Presentan (en grupos) la guía al dueño invitado.");
  assert(revisarUnidadConMapa(dias, alimentacion.filas).some((a) => /clase 5: adelanta/.test(a)), "a la audiencia sí");
  const i = alimentacion.filas.findIndex((f) => f.tareas.some((t) => t.clave === "analizar_ordenar"));
  dias[i] = desarrollo("Ordenan (en grupos) los datos recibidos del comedor.");
  assert(!revisarUnidadConMapa(dias, alimentacion.filas).some((a) => new RegExp(`clase ${i + 1}: no se ve`).test(a)), "datos recibidos");
});
check("controles del panel: modelo sin declarar, hueco vacío y frase fuera de su función", () => {
  const modelo = (titulo) => ({ textoModelo: { titulo, lineas: ["A: Hi."] }, momentos: [] });
  assert(/sin declarar/.test(motivosClaseFinal(modelo("Ordering at a Restaurant"))[0]), "sin declarar");
  ["Comedor modelo — Ordering", "Model School — Asking"].forEach((t) => assert(!motivosClaseFinal(modelo(t)).length, t));
  assert(/hueco vacío/.test(motivosClaseFinal(desarrollo("Muestran las secciones, explicando para qué sirve cada una (_..._)."))[0]), "(...)");
  assert(/hueco vacío/.test(motivosClaseFinal(desarrollo("Comentan algo ({frases})."))[0]), "{frases}");
  assert(/no corresponde/.test(motivosClaseFinal(desarrollo("Usan el menú y aclaran lo que no entiendan (_I hope so!_)."))[0]), "aclarar");
  assert(/no corresponde/.test(motivosClaseFinal(desarrollo("Preguntan y reaccionan a lo que oyen (_You’re welcome…_)."))[0]), "reaccionar");
  assert(!motivosClaseFinal(desarrollo("Usan el menú y aclaran lo que no entiendan (_I’ll have…_, _Pardon?_).", "Preguntan y reaccionan a lo que oyen (_Really?_, _That’s great!_).", "Anotan en tarjetas los comentarios de la audiencia (_I like…_, _I wish…_).")).length, "frases correctas");
  assert(!/\(/.test(pasosConFrases([{ texto: "Muestran las secciones ({frases})." }], [{ frases: "_..._" }])[0]), "el hueco desaparece");
});
check("idioma y malla: título en portugués, intención y estructura fuera de la malla", () => {
  const corregidos = [];
  const dia = conTitulosCorregidos({ titulo: "Escolhendo Opções Saudáveis", momentos: [] }, { tituloTarea: "Elegir y justificar", corregidos });
  assert(dia.titulo === "Elegir y justificar" && corregidos.some((c) => /fuera de español/.test(c)), JSON.stringify(dia));
  assert(/intención pedagógica fuera de español/.test(motivosClaseFinal({ intencionPedagogica: "Os alunos escolhem opções.", momentos: [] })[0]), "intención");
  assert(/fuera de la malla/.test(motivosClaseFinal({ focoLinguistico: "Comparar: is more expensive than", momentos: [] })[0]), "than");
  assert(!motivosClaseFinal({ titulo: "Corregimos la guía para pedir", intencionPedagogica: "Los estudiantes corrigen.", focoLinguistico: "Pedir: presente simple", momentos: [] }).length, "español");
});
check("«Mostrar interés» no se fuerza y la clase del banco no pide regenerar por contenidos", () => {
  [alimentacion, escuela].forEach((m) => m.filas.filter((f) => f.tareas.some((t) => t.clave === "presentar")).forEach((f) => {
    assert(!f.contenidos.some((c) => /^Mostrar inter/.test(c.texto)), `C${f.clase}`);
    assert(!/Mostrar inter|Deseos/i.test(focoDeFila(f)), `foco C${f.clase}: ${focoDeFila(f)}`);
  }));
  const fila = { clase: 11, tareas: [], secuencia: [{}], contenidos: [{ texto: "Disculparse: I’m sorry", porFuncion: true }] };
  assert(!contenidosFaltantesEnClase(desarrollo("Saludan."), fila).length, "banco");
  assert(!contenidosNoVistosEnUnidad([desarrollo("Saludan.")], [fila]).length, "banco en la unidad");
});
check("revisión de g6 y g7: título en inglés, adjetivo de «guía» y estructura real al aplicar", () => {
  const corregidos = [];
  const dia = conTitulosCorregidos({ titulo: "Healthier Choices Made Easy", focoLinguistico: "x", momentos: [{ actividades: ["Reflexionan sobre nuestra guía alimentario."] }] }, { tituloTarea: "Elegir y justificar", corregidos });
  assert(dia.titulo === "Elegir y justificar", dia.titulo);
  assert(/nuestra guía alimentaria/.test(dia.momentos[0].actividades[0]), dia.momentos[0].actividades[0]);
  assert(/la guía modelo/.test(conTitulosCorregidos({ momentos: [{ actividades: ["Leen la guía modelo."] }] }).momentos[0].actividades[0]), "modelo no cambia");
  const filas = (m) => m.filas.filter((f) => f.tareas[0]?.clave.startsWith("aplicar_") && f.tareas[0].clave !== "aplicar_corregir");
  [alimentacion, escuela].forEach((m) => filas(m).forEach((f) => assert(!/Usar el modelo en una situación/.test(focoDeFila(f, m.filas)), `C${f.clase}: ${focoDeFila(f, m.filas)}`)));
  assert(focoDeFila({ tareas: [{ clave: "aplicar_ensayar", secciones: ["S"] }], contenidos: [] }, []).startsWith("Usar el modelo"), "sin clase anterior");
});
check("tercera unidad: Indagación valida sus fuentes, con datos anónimos y gramática de la malla", () => {
  const base = { grado: "2do Secundaria", asignatura: "Inglés", centro: "C", numSemanas: 4, diasClase: ["l", "m", "x"], horasPorDia: 1, titulo: "Actividades de la vida diaria" };
  const pre = conFichaDeUnidad({ ...base, ...prellenarPlanMaestro({ datos: base, indicadores: estructura.indicadores, competencias }) });
  const datos = { ...pre, planMaestro: { ...pre.planMaestro, estrategia: "indagacion_dialogica" } };
  const { entrada } = armarEntradaPlanMaestro({ datos, mallaPayload: malla });
  const m = armarMapaClases(entrada);
  ponerSecuencias(m, { producto: "Plan", tema: "Rutinas", asunto: ASUNTO_LECTURA_POR_SEMILLA["ing2-rutinas-plan"], fuente: FUENTE_POR_SEMILLA["ing2-rutinas-plan"], audiencia: "las familias", semilla: "x" });
  assert(m.ajustesPlan.unir.length === 0, `fases fusionadas: ${JSON.stringify(m.ajustesPlan.unir)}`);
  [1, 2, 3, 4, 5, 6].forEach((n) => assert(m.filas.some((f) => f.fases.some((x) => x.numero === n)), `la fase ${n} no tiene clase`));
  const fuenteEnPasos = (f) => f.secuencia.some((x) => /recomendación oficial de horas de sueño/.test(x.texto));
  assert(fuenteEnPasos(m.filas.find((f) => f.tareas.some((t) => t.clave === "indagar_contrastar"))), "la fuente no se nombra");
  assert(/recomendación oficial/.test(didacticosDeFila(m.filas.find((f) => f.tareas.some((t) => t.clave === "indagar_contrastar")))), "la fuente no está en los recursos");
  const con = (c) => m.filas.find((f) => f.tareas.some((t) => t.clave === c));
  ["indagar_disenar", "indagar_aplicar", "indagar_contrastar"].forEach((c) => {
    assert(con(c) && con(c).fases.some((x) => x.numero === 2), `${c} fuera de Validación de las fuentes`);
    assert(con(c).secuencia, `${c} sin secuencia`);
  });
  assert(con("indagar_contrastar").secuencia.some((x) => /fiable/.test(x.texto)), "no valida");
  assert(con("indagar_aplicar").secuencia.some((x) => /sin anotar nombres/.test(x.texto)) && con("indagar_aplicar").secuencia.some((x) => /nunca por nombre/.test(x.texto)), "privacidad");
  assert(con("indagar_aplicar").secuencia.some((x) => /never|sometimes|always/.test(x.texto)), "frecuencia en los pasos");
  assert(readFileSync(new URL("../src/services/phaseAService.js", import.meta.url), "utf8").includes("se presentan agregados"), "el prompt no lleva la regla de privacidad");
  const probar = con("probar_audiencia");
  assert(probar.secuencia.some((x) => /Explican|Muestran/.test(x.texto)) && !probar.secuencia.some((x) => /para lo que fue hecho/.test(x.texto)), "uso concreto");
  assert(!m.filas.some((f) => /comprar/i.test(focoDeFila(f, m.filas))), m.filas.map((f) => focoDeFila(f, m.filas)).join(" | "));
  assert(m.modo !== "breve", `modo ${m.modo}`);
  assert(/actividades cotidianas/i.test(focoDeFila(con("indagar_aplicar"), m.filas)), focoDeFila(con("indagar_aplicar"), m.filas));
  assert(/datos de compañeros/.test(motivosClaseFinal(desarrollo("Organizan los datos de sueño en una lista de nombres."))[0]), "control de privacidad");
  assert(!motivosClaseFinal(desarrollo("Cuentan las respuestas de la encuesta, sin anotar nombres.")).length, "sin falso");
});
check("cada fase con su clase en las tres estrategias, y tildes corregidas", () => {
  [alimentacion, escuela].forEach((m) => {
    // Única fusión aprobada (César, 2026-11-06): en Proyectos, la clase 1 lleva Visión compartida y Análisis de saberes previos.
    const unir = JSON.stringify(m.ajustesPlan.unir);
    assert(unir === "[]" || (unir === "[[1,2]]" && m.filas[0].fases.map((f) => f.numero).join() === "1,2"), `fases fusionadas: ${unir}`);
    let previa = 0;
    m.filas.forEach((f) => { assert(f.fases[0].numero >= previa, `C${f.clase} retrocede`); previa = f.fases[0].numero; });
  });
  assert(conTildesCorregidas("Dialógo sobre la seccion") === "Diálogo sobre la sección", conTildesCorregidas("Dialógo sobre la seccion"));
  assert(conTildesCorregidas("Students read the dialogue.") === "Students read the dialogue.", "inglés");
  assert(conTildesCorregidas("requiere_revision") === "requiere_revision", "valor interno");
  const conEstado = conTitulosCorregidos({ momentos: [{ actividades: ["Hacen la revision."], evidenciasDetalle: { trazabilidad: [{ estado: "requiere_revision", confianza: "revision" }] } }] });
  assert(conEstado.momentos[0].evidenciasDetalle.trazabilidad[0].estado === "requiere_revision" && conEstado.momentos[0].evidenciasDetalle.trazabilidad[0].confianza === "revision", "no toca valores internos");
  assert(/la revisión/.test(conEstado.momentos[0].actividades[0]), "corrige lo que lee el docente");
  const dia = conTitulosCorregidos({ titulo: "x", textoModelo: { titulo: "Familia modelo — Dialógo", lineas: ["A"] }, momentos: [] });
  assert(/Diálogo/.test(dia.textoModelo.titulo), dia.textoModelo.titulo);
  assert(/\.dia-table tbody tr \{ break-inside: avoid/.test(readFileSync(new URL("../src/services/unidadAprendizajeService.js", import.meta.url), "utf8")), "impresión");
});
check("concordancia de «guía» en todo el texto, como corrección automática", () => {
  const corregidos = [];
  const dia = conTitulosCorregidos({ titulo: "Nuestro guía", focoLinguistico: "Revisar el guía", textoModelo: { lineas: ["el guía"] }, momentos: [{ evidenciasDetalle: { items: [{ texto: "Creación del guía" }] } }] }, { corregidos });
  assert(dia.titulo === "Nuestra guía" && dia.focoLinguistico === "Revisar la guía" && /de la guía/.test(dia.momentos[0].evidenciasDetalle.items[0].texto), JSON.stringify(dia));
  assert(/concordancia/.test(corregidos[0]), "sin registro");
  const [linea] = avisosParaAdministrador([`clase 11: ℹ código: ${corregidos[0]}`]);
  assert(/^ℹ️/.test(linea) && /C11/.test(linea) && /Corregido por código/.test(linea), linea);
});
check("el aviso va a la clase donde nace, y la cadena se revisa sin repetirlo", () => {
  const dias = escuela.filas.map((f) => desarrollo(`Trabajan (en grupos) con ${f.recibe.map((r) => r.texto).join(" y ")}.`, ...f.tareas.map((t) => `${t.instruccion} ${t.secciones.join(" y ")}`)));
  const origen = escuela.filas.findIndex((f) => f.tareas.some((t) => t.clave === "proponer_elaborar" && t.secciones[0] === "Final Recommendation"));
  const usa = escuela.filas.find((f) => f.clase > origen + 1 && f.tareas.some((t) => t.recibe.some((r) => r.clase === origen + 1 && /Final Recommendation/.test(r.texto))));
  dias[usa.clase - 1] = desarrollo("Conversan (en grupos) sobre su clase.");
  assert(revisarUnidadConMapa(dias, escuela.filas).some((a) => new RegExp(`clase ${usa.clase}: no se ve`).test(a)), "con origen, avisa");
  dias[origen] = desarrollo(...dias[origen].momentos[0].actividades.filter((a) => !/^Elaboran .*Final Recommendation$/.test(a)));
  const faltan = tareasSinActividad(dias[origen], escuela.filas[origen]);
  assert(faltan.some((t) => t.secciones[0] === "Final Recommendation"), "debe faltar en el origen");
  assert(!revisarUnidadConMapa(dias, escuela.filas).some((a) => new RegExp(`clase ${usa.clase}: no se ve que use «[^»]*Final Recommendation`).test(a)), "se atribuye al origen");
  assert(new RegExp(`C${usa.clase}`).test(instruccionTareaFaltante(faltan, escuela.filas, origen + 1)), "dice quién lo necesita");
});
check("contenidos: lo que no encaja queda sin lugar y no se reclama", () => {
  ["asignaturas", "educacion", "formas de interaccion"].forEach((t) => {
    assert(escuela.contenidosSinLugar.some((x) => x.slice(x.indexOf(":") + 1).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").startsWith(t)), `${t} debe quedar sin lugar`);
    assert(!escuela.filas.some((f) => f.contenidos.some((c) => c.texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").startsWith(t))), `${t} no debe tener clase`);
  });
  assert(!contenidosNoVistosEnUnidad([desarrollo("Saludan.")], [{ clase: 1, contenidos: [{ texto: "Presente simple para referirse a actividades: She always…" }, { texto: "Funcional: Comprar", porFuncion: true }] }]).length, "sin función no se reclama");
  assert(!contenidosNoVistosEnUnidad([desarrollo("Dicen _It is made with rice_ y _Don’t eat fried food_.")], [{ clase: 1, contenidos: [{ texto: "Voz pasiva del presente: This device is made in…", porFuncion: true }, { texto: "Modo imperativo para consejos: Don’t eat junk food.", porFuncion: true }] }]).length, "por estructura");
});
check("C1: la lectura trata de la situación, no del nombre del tema", () => {
  ponerSecuencias(escuela, { producto: "Guía", tema: "Escuela y educación", asunto: ASUNTO_LECTURA_POR_SEMILLA[semillaEscuela], audiencia: "a", semilla: "x" });
  const pasos = escuela.filas[0].secuencia.map((x) => x.texto).join(" ");
  assert(/cómo orientarse en un centro nuevo/.test(pasos) && !/Escuela y educación/.test(pasos), pasos);
});
check("formato: cita, dueño, acción y orden cadena → contenido → estilo → correcciones", () => {
  const p = avisosParaAdministrador(["clase 4 — Cierre: «Cooperan» no está en la lista de verbos", "clase 1: ℹ regeneración: se rehízo la clase porque faltaba «x»", "Clase 3: el contenido «Dudar» no se ve en ninguna clase", "⚠️ Clase 6: falta la tarea «elaborar» de «FR» (entrega: Pieza). Añade una actividad del Desarrollo que la haga.", "⚠️ Diagnóstico: sin dato para Inglés."]);
  assert(/^⚠️ \[Rompe la cadena\] C6 · falta la tarea «elaborar» de «FR» \(entrega: Pieza\) · Dueño: IA · Pendiente$/.test(p[0]), p[0]);
  assert(/^⚠️ \[Contenido\] C3/.test(p[1]) && /^⚠️ \[Estilo\] C4/.test(p[2]), p.join(" | "));
  assert(/Dueño: configuración/.test(p[3]) && /^ℹ️/.test(p[4]) && /Corregido por regeneración/.test(p[4]), p.join(" | "));
  const [id] = avisosParaAdministrador(["Clase 6: fallo de correspondencia: ninguna actividad lleva el ID T3"]);
  assert(/^ℹ️/.test(id) && /Dueño: IA/.test(id) && /Corregido por código/.test(id), id);
  assert(/^ℹ️/.test(avisosParaAdministrador(["Fase 2: se quitó de las observaciones lo que narraba hechos"])[0]), "observaciones");
});
console.log(`\nAvisos: ${fallos} fallo(s)`);
process.exit(fallos ? 1 : 0);
