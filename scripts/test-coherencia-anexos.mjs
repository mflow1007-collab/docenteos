/**
 * test-coherencia-anexos.mjs — Regresión de la auditoría de «Alimentación»
 * (2026-11-04): correspondencia tarea–criterio–indicador, selección curricular,
 * evidencias por etapa, adecuaciones por barrera, tiempo por actividad, audiencia
 * y proceso por sección. Usa la malla real y otra temática para no atarse a un tema.
 */
import fs from "node:fs";
import { construirArquitecturaUnidadMINERD, relacionarCriteriosConIndicadores, triadaOficial, extraerCriteriosEvaluacionCanonicos, seleccionarRelacionParaEvidencia } from "../src/services/curriculumBrainService.js";
import { construirAnexosUnidad, ajustarIndicadoresPorActividad, sinHechosInventados, seccionesSinFinal, minutosPorDemanda, operacionesDeSeccion, dimensionDeActividad, distribuirTiempoActividades } from "../src/services/unidadAprendizajeService.js";
import { motivoAdecuacionBarrera } from "../src/services/phaseAService.js";
import { audienciasDeSituacion, situacionDesdeSemilla } from "../src/services/situacionAprendizajeService.js";
import { SITUACIONES_SEMILLA_INGLES_2DO as SEMILLAS } from "../src/data/situacionesSemillaIngles2do.js";
import { construirContratoFase, motivoModalidadVisita } from "../src/services/redaccionFaseService.js";
import { resolverIndicadoresEstructurados, competenciasDeMalla, prellenarPlanMaestro, prepararPlanMaestroGeneracion } from "../src/services/vistaPreviaPlanMaestroService.js";

let pasos = 0, fallos = 0;
const check = (n, fn) => { try { fn(); pasos += 1; console.log(`  ✓ ${n}`); } catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); } };
const assert = (c, m) => { if (!c) throw new Error(m); };
const igual = (a, b, m) => assert(JSON.stringify(a) === JSON.stringify(b), `${m}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);

const malla = JSON.parse(fs.readFileSync("src/data/curriculo/mallas/malla_ingles_2do_secundaria_2023.json", "utf8"));
const original = JSON.stringify(malla);
const indicadores = malla.indicadoresLogro.map((i) => ({ ...i }));
const criterios = extraerCriteriosEvaluacionCanonicos(malla, {});
const triada = triadaOficial({ criterios, indicadores });
const relaciones = relacionarCriteriosConIndicadores({ criterios, indicadores, competencias: malla.competencias, triada });
const elegidos = indicadores.slice(0, 3); // I01–I03, competencia Comunicativa

const aportes = [
  { semana: 1, texto: "«Our Community Food Guide» (acuerdo y plan): estructura inicial", indicadores: ["ING-2-I01"], dimensiones: ["comprension"] },
  { semana: 1, texto: "Sección «Interviews with Owners» (insumos recopilados): cuestionario", indicadores: ["ING-2-I03"], dimensiones: ["interaccion"] },
  { semana: 2, texto: "Sección «Our Local Food» (borrador): fichas de platos", indicadores: ["ING-2-I02"], dimensiones: ["produccion"] },
  { semana: 2, texto: "Sección «Interviews with Owners» (versión final): transcripciones", indicadores: ["ING-2-I03"], dimensiones: ["interaccion"] },
  { semana: 3, texto: "Sección «Bilingual Menus» (versión final): menú bilingüe", indicadores: ["ING-2-I02"], dimensiones: ["produccion"] },
  { semana: 3, texto: "«Our Community Food Guide» (versión revisada): guía con comentarios", indicadores: ["ING-2-I02", "ING-2-I03"], dimensiones: ["produccion", "interaccion"] },
];
const anexosCon = (over = {}) => construirAnexosUnidad({
  area: "Inglés", tema: "Alimentación", producto: "Our Community Food Guide — menús, dirigida a los dueños.",
  vocabulario: ["x"], fases: [], numSemanas: 3, aportesProducto: aportes,
  indicadoresPriorizados: elegidos, relacionesCriterioIndicador: relaciones, ...over,
});
const filas = (ax) => [...ax.rubricaProducto, ...ax.listaCotejoOral, ...ax.autoevaluacion, ...ax.coevaluacion, ...ax.escalaValoracion, ...ax.diagnostica];

console.log("1. Correspondencia tarea → criterio → indicador:");
check("el par criterio–indicador sale de la tríada oficial, no del parecido de palabras", () => {
  const de = (id) => relaciones.find((r) => r.indicadorId === id);
  assert(/^Comprensión/.test(de("ING-2-I01").criterioTexto), "I01 comprensión");
  assert(/^Producción/.test(de("ING-2-I02").criterioTexto), "I02 producción");
  assert(/^Interacción/.test(de("ING-2-I03").criterioTexto), "I03 interacción");
  igual(relaciones.length, 21, "21 relaciones");
});
check("Listening y Reading = comprensión; Speaking = interacción; Writing = producción", () => {
  const d = anexosCon().diagnostica;
  igual(d.map((x) => x.indicadorCodigo), ["ING-2-I01", "ING-2-I03", "ING-2-I01", "ING-2-I02"], "diagnóstica");
  assert(/^Comprensión/.test(d[0].criterioOficialTexto), "criterio de Listening");
  assert(d.every((x) => x.estadoTrazabilidad === "relacionado"), "todas relacionadas");
});
check("la dimensión manda sobre las palabras: «oraciones» no vuelve producción una escucha", () => {
  const r = seleccionarRelacionParaEvidencia({ texto: "el estudiante marca en imágenes las oraciones sencillas", relaciones: relaciones.slice(0, 3), dimension: "comprension" });
  igual(r.indicadorId, "ING-2-I01", "indicador");
});
check("el verbo de una actividad dice su dimensión; un verbo fuera de las listas, ninguna", () => {
  igual(["Escuchan (en parejas) x", "Redactan x", "Entrevistan x", "Reflexionan x"].map(dimensionDeActividad), ["comprension", "produccion", "interaccion", ""], "dimensiones");
});

console.log("2. Selección curricular:");
check("las relaciones cubren lo que el docente eligió, no solo la selección automática", () => {
  const a = construirArquitecturaUnidadMINERD({
    mallaPayload: malla, titulo: "Alimentación", area: "Inglés", asignatura: "Inglés", grado: "2do", nivel: "Secundaria",
    competencias: malla.competencias, indicadores, indicadoresTrabajo: [indicadores[2], indicadores[5]],
  });
  igual(a.evaluacion.relacionesCriterioIndicador.length, 2, "selección automática");
  igual(a.evaluacion.relacionesMalla.length, 21, "toda la malla");
  const ax = anexosCon({ relacionesCriterioIndicador: a.evaluacion.relacionesMalla });
  igual(ax.diagnostica.map((x) => x.indicadorCodigo), ["ING-2-I01", "ING-2-I03", "ING-2-I01", "ING-2-I02"], "Anexo J");
  igual(ax.avisosSeleccion, [], "sin avisos si la selección cubre todo");
});
check("ningún instrumento usa un indicador no elegido", () => {
  const codigos = new Set(elegidos.map((i) => i.id));
  const ajenos = filas(anexosCon()).map((f) => f.indicadorCodigo).filter((c) => c && !codigos.has(c));
  igual(ajenos, [], "indicadores ajenos");
});
check("si falta una dimensión no se amplía la selección: sin indicador y con aviso", () => {
  const ax = anexosCon({ indicadoresPriorizados: [indicadores[0]] });
  const diag = ax.diagnostica[3]; // Writing pide producción
  igual([diag.estadoTrazabilidad, diag.indicadorCodigo], ["fuera_de_seleccion", ""], "Writing");
  assert(ax.avisosSeleccion.some((a) => /Writing/.test(a) && /producción/.test(a)), "aviso");
  assert(!filas(ax).some((f) => f.indicadorCodigo && f.indicadorCodigo !== "ING-2-I01"), "no amplió");
  assert(!filas(ax).some((f) => f.estadoTrazabilidad === "requiere_revision"), "no aumenta las filas de revisión");
});
check("otra área sin tríada: sigue el vínculo general, sin dimensiones", () => {
  const ax = construirAnexosUnidad({ area: "Matemática", tema: "Fracciones", producto: "Guía", vocabulario: [], fases: [], numSemanas: 2, aportesProducto: ["Ejercicios"], indicadoresPriorizados: [{ codigo: "MAT-1", descripcion: "Resuelve" }] });
  assert(ax.listaCotejoOral.every((f) => f.indicadorCodigo === "MAT-1"), "vínculo general");
  igual(ax.avisosSeleccion, [], "sin avisos");
});

console.log("3. Evidencias por etapa:");
check("«acuerdo y plan» no evidencia nada posterior", () => {
  const ax = anexosCon();
  const conPlan = filas(ax).filter((f) => /acuerdo y plan/i.test(f.piezaProducto));
  igual(conPlan.map((f) => f.criterio || f.item), [], "ítems con el plan inicial");
});
check("la rúbrica sumativa solo usa versiones finales o revisadas; la mejora, una que aún cambia", () => {
  const ax = anexosCon();
  assert(ax.rubricaProducto.every((f) => /versión (final|revisada)/i.test(f.piezaProducto)), "rúbrica");
  assert(/borrador|versión final/i.test(ax.coevaluacion[2].piezaProducto), "coevaluación de la mejora");
});
check("la pieza viene de una clase que trabajó ese indicador", () => {
  const ax = anexosCon();
  const interaccion = ax.listaCotejoOral[0];
  igual(interaccion.indicadorCodigo, "ING-2-I03", "indicador");
  assert(/Interviews/.test(interaccion.piezaProducto), `pieza: ${interaccion.piezaProducto}`);
});
check("diagnóstico sin calificación; formativo aparte; solo lo sumativo al Registro de calificaciones", () => {
  const ax = anexosCon();
  assert(ax.diagnostica.every((f) => f.momentoEvaluativo === "diagnostico" && /^No va al Registro/.test(f.destinoRegistro)), "diagnóstica");
  assert(ax.autoevaluacion.every((f) => f.momentoEvaluativo === "formativo" && /^Seguimiento formativo/.test(f.destinoRegistro)), "autoevaluación");
  assert(ax.rubricaProducto.every((f) => f.momentoEvaluativo === "sumativo" && /^Registro de calificaciones/.test(f.destinoRegistro)), "rúbrica");
});
check("una sola pieza del indicador no se repite en todas las filas", () => {
  const ax = anexosCon({ aportesProducto: [
    { semana: 2, texto: "Sección «A» (versión final): a", indicadores: ["ING-2-I02"], dimensiones: ["produccion"] },
    { semana: 3, texto: "Sección «B» (versión final): b", indicadores: ["ING-2-I01"], dimensiones: ["produccion"] },
    { semana: 3, texto: "Sección «C» (versión final): c", indicadores: ["ING-2-I01"], dimensiones: ["produccion"] },
  ] });
  assert(new Set(ax.rubricaProducto.map((f) => f.piezaProducto)).size > 1, "todas las filas con la misma pieza");
});
check("otro tema y producto: las mismas reglas", () => {
  const ax = anexosCon({ tema: "Escuela y educación", producto: "Our School Survival Guide", aportesProducto: [
    { semana: 1, texto: "«Our School Survival Guide» (acuerdo y plan): índice" },
    { semana: 2, texto: "Sección «School Directions» (borrador): plano" },
    { semana: 3, texto: "Sección «Welcome» (versión final): carta" },
  ] });
  assert(!filas(ax).some((f) => /acuerdo y plan/.test(f.piezaProducto)), "plan inicial");
});

check("interacción y presentación se evidencian con lo observado, no con un escrito", () => {
  const ax = anexosCon({ aportesProducto: [
    { semana: 1, texto: "Sección «Help» (versión final): una tarjeta", dimensiones: ["interaccion"], actividadInteraccion: "Intercambian (en parejas) preguntas" },
    { semana: 2, texto: "Sección «Welcome» (versión final): una carta", dimensiones: ["produccion"] },
    { semana: 3, texto: "«Guía» (versión revisada): guía", dimensiones: ["produccion"], actividadOral: "Presentan (en plenaria) la guía" },
  ] });
  const interaccion = ax.listaCotejoOral.find((f) => f.exige === "interaccion");
  assert(/^Intercambio observado o grabado: Intercambian/.test(interaccion.evidencia), interaccion.evidencia);
  const presenta = ax.autoevaluacion[ax.autoevaluacion.length - 1];
  assert(/^Presentación oral observada: Presentan/.test(presenta.evidencia), presenta.evidencia);
  igual(ax.avisosEvidencia, [], "sin avisos");
});
check("si ninguna clase presenta ni intercambia, no se inventa: se dice y se avisa", () => {
  const ax = anexosCon({ aportesProducto: [{ semana: 2, texto: "Sección «A» (versión final): una carta", dimensiones: ["produccion"] }] });
  const presenta = ax.autoevaluacion[ax.autoevaluacion.length - 1];
  assert(/falta planificar/.test(presenta.evidencia), presenta.evidencia);
  assert(ax.avisosEvidencia.some((a) => /presentación oral/.test(a)), "aviso");
});
check("una unidad sin etapas (motor anterior) conserva su evidencia", () => {
  const ax = anexosCon({ aportesProducto: ["Póster de rutinas", "Guion oral"] });
  assert(ax.listaCotejoOral.every((f) => /^Desempeño observable/.test(f.evidencia)), "evidencia");
});

console.log("3b. Indicadores por actividad:");
const claseDe = (actividades, indicadores = ["ING-2-I01"]) => ({ indicadoresTrabajados: indicadores, momentos: [{ nombre: "Desarrollo", actividades, evidenciasDetalle: {} }] });
const elegidosIds = ["ING-2-I01", "ING-2-I02", "ING-2-I03"];
check("entrevistar y transcribir ya no queda solo en I01", () => {
  const dia = claseDe(["Entrevistan (en parejas) al invitado.", "Redactan (en parejas) la transcripción."]);
  igual(ajustarIndicadoresPorActividad([{ dias: [dia] }], { relaciones, elegidos: elegidosIds }), 1, "cambiadas");
  igual(dia.indicadoresTrabajados, ["ING-2-I03", "ING-2-I02"], "indicadores");
  igual(dia.momentos[0].evidenciasDetalle.indicadores, ["ING-2-I03", "ING-2-I02"], "evidencias de la clase");
});
check("conserva el indicador que el plan fija a la fase y no sale de lo elegido", () => {
  const dia = claseDe(["Redactan x."], ["ING-2-I01"]);
  ajustarIndicadoresPorActividad([{ dias: [dia] }], { plan: { fases: [{ indicadores: [{ id: "ING-2-I01" }] }] }, relaciones, elegidos: elegidosIds });
  igual(dia.indicadoresTrabajados, ["ING-2-I01", "ING-2-I02"], "plan + actividad");
  const soloUno = claseDe(["Redactan x."], ["ING-2-I01"]);
  ajustarIndicadoresPorActividad([{ dias: [soloUno] }], { relaciones, elegidos: ["ING-2-I01"] });
  igual(soloUno.indicadoresTrabajados, ["ING-2-I01"], "sin elegidos de esa dimensión");
});
check("sin dimensión en sus actividades, la clase conserva lo declarado", () => {
  const dia = claseDe(["Analizan los datos.", "Reflexionan sobre x."]);
  ajustarIndicadoresPorActividad([{ dias: [dia] }], { relaciones, elegidos: elegidosIds });
  igual(dia.indicadoresTrabajados, ["ING-2-I01"], "declarado");
});
check("las observaciones no narran lo que aún no ha ocurrido", () => {
  const r = sinHechosInventados("Se observó que algunos no entienden. Conviene repasar el presente. Los estudiantes mostraron interés.");
  igual(r, { texto: "Conviene repasar el presente.", quitadas: 2 }, "observaciones");
  igual(sinHechosInventados("Observar si aplican las estructuras.").quitadas, 0, "previsión");
});
check("secciones sin pieza final se señalan", () => {
  igual(seccionesSinFinal([{ seccion: "Título", fases: "" }, { seccion: "A", fases: "Borrador" }, { seccion: "B", fases: "Borrador → Versión final" }, { seccion: "C", fases: "" }, { seccion: "Sin plan" }]), ["A", "C"], "secciones");
});

console.log("4. Adecuaciones según la barrera:");
check("una grabación sola no resuelve una barrera auditiva; con transcripción, sí", () => {
  assert(motivoAdecuacionBarrera("Utilización de grabaciones de las entrevistas para estudiantes con dificultades auditivas."), "debía rechazarla");
  igual(motivoAdecuacionBarrera("Grabaciones con transcripción escrita para estudiantes con dificultades auditivas."), "", "con transcripción");
  igual(motivoAdecuacionBarrera("Permitir grabaciones a quien tiene dificultad en la expresión oral."), "", "otra barrera");
  igual(motivoAdecuacionBarrera("Materiales impresos para dificultades auditivas. Grabaciones para quien falta."), "", "por oración");
});
check("imágenes solas no resuelven una barrera visual", () => {
  assert(motivoAdecuacionBarrera("Láminas e imágenes para estudiantes con baja visión."), "debía rechazarla");
  igual(motivoAdecuacionBarrera("Imágenes ampliadas y descripción en voz alta para baja visión."), "", "con acceso");
});
check("Anexo K: perfiles auditivo y visual que conservan el aprendizaje", () => {
  const perfiles = anexosCon().neaePorPerfil;
  const auditiva = perfiles.find((p) => /auditiva/.test(p.perfil));
  assert(/transcripción/.test(auditiva.acceso) && /escrito/.test(auditiva.acceso), "acceso");
  assert(/no la comprensión auditiva/.test(auditiva.evaluacion), "no afirma que mida lo mismo");
  igual(motivoAdecuacionBarrera(`${auditiva.perfil}: ${auditiva.acceso}`), "", "pasa su propio validador");
  assert(perfiles.some((p) => /visual/.test(p.perfil)), "visual");
});

console.log("5. Tiempo y visita:");
check("una entrevista recibe el tiempo que exige, vaya donde vaya", () => {
  const { minutos, necesarios } = minutosPorDemanda({ totalMinutos: 30, actividades: ["Entrevistan (en parejas) al invitado", "Escriben notas", "Comentan lo hallado", "Archivan la ficha"] });
  assert(minutos[0] >= 15, `entrevista: ${minutos}`);
  igual(minutos.reduce((s, m) => s + m, 0), 30, "suma");
  igual(necesarios, 30, "necesarios");
});
check("si no cabe se dice y nunca se pasa de la clase", () => {
  const { minutos, necesarios } = minutosPorDemanda({ totalMinutos: 30, actividades: ["Entrevistan x", "Presentan y", "Elaboran z", "Debaten w"] });
  assert(necesarios > 30, "necesarios");
  igual(minutos.reduce((s, m) => s + m, 0), 30, "suma");
});
check("unidades guardadas: el reparto anterior sigue igual", () => {
  igual(distribuirTiempoActividades({ totalMinutos: 30, cantidad: 4, momento: "Desarrollo" }), [5, 7, 10, 8], "reparto");
});
const estructura = resolverIndicadoresEstructurados(malla);
const horario = { semanas: 3, diasClase: ["lunes", "martes", "miercoles"], horasPorDia: 1 };
const datosPlan = { grado: "2do Secundaria", asignatura: "Inglés", centro: "Centro - Hato Nuevo", numSemanas: 3, diasClase: horario.diasClase, horasPorDia: 1, titulo: "Alimentación" };
const prellenado = { ...datosPlan, ...prellenarPlanMaestro({ datos: datosPlan, indicadores: estructura.indicadores, competencias: competenciasDeMalla(malla, estructura.indicadores) }) };
const { plan } = prepararPlanMaestroGeneracion({ datos: prellenado, mallaPayload: malla, horario });
check("el contrato declara la modalidad solo en la fase de visita", () => {
  const contratos = plan.fases.map((_, indice) => construirContratoFase({ plan, indice, estructura }));
  igual(contratos.map((c) => c.modalidadVisita || ""), ["", "", "invitado", "", "", "", "", "", ""], "fases");
  assert(/invitado/.test(contratos[2].instruccionVisita), "instrucción");
  igual(construirContratoFase({ plan, indice: 2, estructura, modalidadVisita: "simulada" }).modalidadVisita, "simulada", "elegida");
});
check("entrevistar en clase con visita entre sesiones se avisa; con invitado nombrado, no", () => {
  const clase = (act) => [{ momentos: [{ nombre: "Desarrollo", actividades: [act, "Escriben notas."] }] }];
  assert(motivoModalidadVisita(clase("Entrevistan (en parejas) a los dueños del barrio."), "entre_sesiones"), "entre sesiones");
  igual(motivoModalidadVisita(clase("Preparan la cita."), "entre_sesiones"), "", "solo prepara");
  igual(motivoModalidadVisita(clase("Entrevistan (en parejas) al invitado."), "invitado"), "", "invitado");
  assert(motivoModalidadVisita(clase("Entrevistan (en parejas) a los dueños."), "invitado"), "sin invitado");
  igual(motivoModalidadVisita(clase("Entrevistan (en parejas, simulación) a un compañero."), "simulada"), "", "simulada");
});

console.log("6. Audiencia:");
check("principal y secundarias con función, en las tres semillas", () => {
  for (const s of SEMILLAS) {
    const a = audienciasDeSituacion(situacionDesdeSemilla(s));
    assert(a.principal && a.secundarias.every((x) => x.quien && x.funcion), s.id);
    assert(a.frase.startsWith(a.principal) && a.frase.includes("también a"), s.id);
  }
});
check("si el docente cambia la audiencia, manda la suya", () => {
  const sit = { ...situacionDesdeSemilla(SEMILLAS[2]), audiencia: "las familias del curso" };
  igual(audienciasDeSituacion(sit), { principal: "las familias del curso", secundarias: [], frase: "las familias del curso" }, "docente");
});
check("la rúbrica nombra a la audiencia principal; los ítems, solo el nombre del producto", () => {
  const ax = anexosCon({ audienciaPrincipal: "los dueños de los comedores" });
  assert(ax.rubricaProducto[4].evidencia.includes("los dueños de los comedores"), "evidencia");
  assert(!JSON.stringify(ax.escalaValoracion.map((f) => f.criterio)).includes("dirigida"), "nombre corto");
});

console.log("7. Proceso por sección:");
const fasesProceso = [{ dias: [
  { aporteProducto: "Sección «Interviews» (insumos recopilados): preguntas", momentos: [{ nombre: "Desarrollo", actividades: ["Elaboran (en parejas, Interview) preguntas para los dueños: lista; la guardan.", "Guardan (individual) la lista.", "Revisan (en grupos) las preguntas."] }] },
  { aporteProducto: "Sección «Interviews» (versión final): transcripciones", momentos: [{ nombre: "Desarrollo", actividades: ["Entrevistan (en parejas) al invitado con el cuestionario.", "Escriben (en grupos) las respuestas."] }] },
  { aporteProducto: "Sección «Menus» (borrador): menú", momentos: [{ nombre: "Desarrollo", actividades: ["Comparan (en grupos) precios."] }] },
] }];
check("las operaciones salen de las actividades reales de la sección, sin gestión", () => {
  igual(operacionesDeSeccion(fasesProceso, "Interviews"), ["Elaboran preguntas", "Revisan las preguntas", "Entrevistan al invitado", "Escriben las respuestas"], "Interviews");
  igual(operacionesDeSeccion(fasesProceso, "Menus"), ["Comparan precios"], "Menus");
  igual(operacionesDeSeccion(fasesProceso, "Sin clase"), [], "sin actividad no hay paso");
  const etiqueta = (a) => operacionesDeSeccion([{ dias: [{ aporteProducto: "Sección «S» (borrador): x", momentos: [{ nombre: "Desarrollo", actividades: [a] }] }] }], "S")[0];
  igual(etiqueta("Elaboran (en equipos) fichas descriptivas de los platos discutidos."), "Elaboran fichas descriptivas", "sin cortar en «de los»");
  igual(etiqueta("Entrevistan (en parejas) al invitado simulando una compra."), "Entrevistan al invitado", "sin gerundio");
});
check("Anexo I: solo estados con pieza real", () => {
  const ax = construirAnexosUnidad({ area: "Inglés", tema: "Alimentación", producto: "Guía", vocabulario: [], fases: fasesProceso, numSemanas: 3, secciones: ["Interviews", "Menus"],
    fasesPlan: [{ entrega: { estado: "Acuerdo y plan", secciones: ["Interviews", "Menus"] } }, { entrega: { estado: "Versión final", secciones: ["Menus"] } }] });
  const menus = ax.organizadorProducto.find((o) => o.seccion === "Menus");
  igual(menus.fases, "Borrador", "Menus no declara estados sin pieza");
  igual(menus.operaciones, ["Comparan precios"], "operaciones");
});

console.log("Malla oficial:");
check("los cálculos no alteran la malla", () => igual(JSON.stringify(malla) === original, true, "malla"));

console.log(`\nCoherencia de anexos: ${pasos} pasos, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
