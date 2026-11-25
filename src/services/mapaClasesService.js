/**
 * mapaClasesService — Mapa de clases de la unidad (Etapa 1 del esqueleto aprobado
 * por César el 2026-11-04): una fila por clase, armada sin IA antes de redactar.
 * Etapa 2: la IA redactará su fila; Etapa 3: los anexos la leerán. Aún nadie lo consume.
 *
 * - Fijo: lo que trae el plan maestro (fases, indicadores, contenidos, secciones).
 * - Reparto por minutos, no una clase por paso. Normal: tareas esenciales en su
 *   tiempo; cuando sobra, ampliaciones y luego clases flexibles declaradas; cuando
 *   falta, tareas más breves y, si no alcanza, versión breve con grupos simultáneos.
 * - Mínimo: 3 clases (recoger, producir, presentar). Por debajo, error visible.
 * - Sección sin tipo: se supone por su posición y queda declarado.
 *
 * Módulo PURO. Verificación: scripts/test-mapa-clases.mjs
 */

import { construirPlanMaestro } from "./planMaestroService.js";
import { ESTRATEGIAS_FASES_GUIA_2025 } from "../data/estrategiasFasesGuia2025.js";
import { SECUENCIAS_POR_TAREA } from "../data/secuenciasTareas.js";
import { SITUACIONES_SEMILLA_INGLES_2DO } from "../data/situacionesSemillaIngles2do.js";
import { TIPO_TRABAJO_FASES_POR_ESTRATEGIA, MODALIDAD_VISITA_POR_DEFECTO } from "../data/rolesFasesEstrategias.js";
import {
  TAREAS_POR_TIPO, TAREAS_UNIDAD, TAREA_COMENTAR, TAREA_CORREGIR, TAREA_REVISION_DOCENTE, TAREA_REVISION_NIVEL,
  SECCIONES_POR_COMENTAR, SECCIONES_POR_CORREGIR, TIPO_APROBADO_POR_SECCION, DETALLE_TAREA,
  INVENTARIO_POR_SECCION, ALCANCE_POR_SEMILLA, USO_DE_CONTENIDOS, PRUEBA_POR_SECCION, LUGARES_NO_DECLARADOS,
  PREGUNTA_SITUACION_POR_SEMILLA, PREGUNTA_SITUACION_GENERAL, ESTRUCTURA_POR_TAREA, DATOS_ENCUESTA,
  ASUNTO_LECTURA_POR_SEMILLA, ASUNTO_LECTURA_GENERAL,
} from "../data/tareasPorTipoTrabajo.js";

export const CLASES_MINIMAS = 3;
// Más contenidos no caben con sentido en una clase: lo demás queda sin marcar en la tabla.
export const TOPE_CONTENIDOS_POR_CLASE = 6;
// Más estructuras en una clase no se llegan a enseñar: la IA deja fuera las que sobran.
export const TOPE_GRAMATICA_POR_CLASE = 3;
// Una clase nunca muestra menos indicadores de los que evalúa (César, 2026-11-04).
export const TOPE_INDICADORES_POR_CLASE = 3;
const ORDEN_TIPOS = ["visitar", "socializar", "describir", "analizar", "orientar", "proponer", "aplicar"];
const error = (msg) => new Error(`Mapa de clases: ${msg}`);
const ACCION_DE = { C: "responde", P: "produce", I: "interactua" };

/** Minutos del Desarrollo de una clase (misma regla que la plantilla: R7). */
export const minutosDesarrollo = (duracionMin = 45) => duracionMin - (duracionMin <= 50 ? 15 : 25);

/** Tipo de cada sección: aprobado > semilla > supuesto por posición (declarado). */
export const tiposDeSecciones = (secciones, tiposSemilla = {}) => {
  const supuestas = [];
  const tipos = {};
  secciones.forEach((seccion, i) => {
    const semilla = TIPO_APROBADO_POR_SECCION[seccion] || tiposSemilla[seccion];
    if (semilla) { tipos[seccion] = semilla; return; }
    supuestas.push(seccion);
    const n = secciones.length;
    if (i === n - 1) tipos[seccion] = "aplicar";
    else if (i === n - 2) tipos[seccion] = "proponer";
    else tipos[seccion] = i < (n - 2) / 2 ? "describir" : "analizar";
  });
  return { tipos, supuestas };
};

// Orden por tipo, pero una sección nunca va antes de aquellas de las que parte.
const ordenarSecciones = (secciones, tipos, partenDe = {}) => {
  const pendientes = [...secciones].sort((a, b) => ORDEN_TIPOS.indexOf(tipos[a]) - ORDEN_TIPOS.indexOf(tipos[b]));
  const orden = [];
  while (pendientes.length) {
    const lista = pendientes.findIndex((s) => (partenDe[s] || []).every((d) => orden.includes(d) || !secciones.includes(d)));
    orden.push(pendientes.splice(Math.max(0, lista), 1)[0]);
  }
  return orden;
};

// Fase de cada tarea. Inserción: por tipo de fase. Las demás: por papel, repartiendo
// en orden entre las fases con ese papel.
const buscarFase = (fases, tiposFase, t, k, cuantas) => {
  if (tiposFase && t.faseInsercion) {
    const i = tiposFase.indexOf(t.faseInsercion);
    if (i >= 0) return i;
  }
  const conRol = fases.map((f, i) => (f.roles.includes(t.rol) ? i : -1)).filter((i) => i >= 0);
  if (conRol.length) return conRol[Math.min(conRol.length - 1, Math.floor((k * conRol.length) / Math.max(1, cuantas)))];
  // Papel que la estrategia no tiene (p. ej. evaluación en ABProblemas): la última fase.
  return fases.length - 1;
};

const trozos = (lista, n) => Array.from({ length: Math.ceil(lista.length / n) }, (_, i) => lista.slice(i * n, (i + 1) * n));

// Lista completa de tareas de la unidad, sin minutos ni clases.
/**
 * Cómo se prueba el producto con la audiencia: por sus secciones conocidas o, si es una propuesta, defendiendo la
 * recomendación (una propuesta no se usa; Guía 2025, p. 21). Null: la prueba general.
 */
const PRUEBA_DEFENDER = { tipo: "defender", hace: "Defienden ante la audiencia su recomendación: explican por qué recomiendan esa alternativa y responden sus preguntas, y luego recogen sus comentarios en tarjetas." };
// Banco de frases o charla: se usa practicando con un grupo pequeño de invitados que pide algo con una tarjeta del banco
// (revisor de «Frases del aula», 2026-11-11; César: llevarla a 15). Se reconoce por el nombre o por qué es el producto.
const PRUEBA_FRASES = { tipo: "frases", hace: "Practican en parejas con un grupo pequeño de invitados: el invitado pide permiso o ayuda con una tarjeta del banco y la pareja lo guía y aclara; luego recogen sus comentarios en tarjetas." };
export const esBancoDeFrases = (texto = "") => /\b(phrases?|frases?|talk|charlas?)\b/i.test(String(texto));
// En ABProblemas el producto responde al problema y se defiende ante quien decide, cualquiera que sea el tema (g28: Rutinas con ABP usaba la prueba de Indagación).
// Prioridad: Problemas → sección conocida → banco de frases → propuesta.
export const pruebaDelProducto = (producto = "", secciones = [], estrategia = "", descripcion = "") => (estrategia === "problemas" ? PRUEBA_DEFENDER : null)
  || secciones.map((s) => PRUEBA_POR_SECCION[s]).find(Boolean)
  || (esBancoDeFrases(`${producto} ${descripcion}`) ? PRUEBA_FRASES : null)
  || (/\bpropos(al|uesta)\b/i.test(producto) ? PRUEBA_DEFENDER : null);

// Con la revisión de nivel en la misma clase, corregir cede su parte: el total de la clase no cambia ([15,30] = [10,20] + [5,10]).
const MINUTOS_CORREGIR_CON_REVISION = [10, 20];
const listarTareas = ({ fases, tiposFase, secciones, tipos, partenDe, tareasOmitidas: omitidas = [], estrategia, totalClases = 99, producto = "", descripcion = "", problemaDesde = 13, datosDesde = UMBRAL_RECOGER_DATOS, encuestaProyectos = true }) => {
  const tareasOmitidas = omitidas;
  const indagacion = estrategia === "indagacion_dialogica";
  const faseDe = (re) => fases.findIndex((f) => re.test(f.nombre));
  // Decisiones de César (2026-11-06). Indagación: la fase 3 organiza y prioriza lo ya validado (Referente 2025, p. 18).
  // Problemas: los cursos de acción se evalúan como contenido, en «Reestructuración», no se califican (Adecuación, p. 24).
  let ordenarIndagacion = false;
  const ajustePorEstrategia = (t, seccion = "") => {
    if (indagacion && t.clave === "analizar_ordenar") return { ...t, faseGuia: faseDe(/^Análisis y organización/), hace: "Organizan y priorizan los datos validados en una tabla de frecuencia o una matriz por categoría, y deciden qué problemas atenderá el plan. Aún no redactan la pieza." };
    if (estrategia === "problemas" && t.clave === "proponer_elegir") return { ...t, faseGuia: faseDe(/^Reestructuración/), hace: `Proponen 2 o 3 cursos de acción posibles${seccion ? ` para «${seccion}»` : ""}, comparan en una tabla sus pros y sus contras (ventajas, desventajas y si se puede hacer) y eligen uno con dos razones.` };
    return t;
  };
  const orden = ordenarSecciones(secciones, tipos, partenDe);
  const items = [];
  const push = (t, seccionesT, bloque, orden1, orden2, faseForzada) => items.push({
    t, secciones: seccionesT, bloque, orden1, orden2, faseForzada, fase: null,
  });
  orden.forEach((seccion, s) => {
    TAREAS_POR_TIPO[tipos[seccion]].filter((t) => !tareasOmitidas.includes(t.clave)).forEach((t, p) => {
      // En Indagación se organizan los datos una vez, para todas las secciones que los usan.
      if (indagacion && t.clave === "analizar_ordenar") {
        if (ordenarIndagacion) return;
        ordenarIndagacion = true;
      }
      push(ajustePorEstrategia(t, seccion), [seccion], 1, s, p);
    });
  });
  const comentables = orden.filter((s) => !["aplicar", "proponer"].includes(tipos[s]));
  trozos(comentables, SECCIONES_POR_COMENTAR).forEach((grupo, g) => push(TAREA_COMENTAR, grupo, 2, 0, g));
  const corregibles = orden.filter((s) => tipos[s] !== "aplicar");
  const tempranas = corregibles.filter((s) => ["visitar", "describir", "socializar"].includes(tipos[s]));
  const tardias = corregibles.filter((s) => !tempranas.includes(s));
  // Proyectos: la mejora y la revisión formativa del docente van en la fase «Evaluación» (Referente por proyecto
  // 2022, p. 35), antes de la sumativa. Interpretación DocenteOS, aprobada por César el 2026-11-06.
  const proyectos = estrategia === "proyectos";
  const enEvaluacion = proyectos && fases.findIndex((f) => f.nombre === "Evaluación") >= 0 ? { faseGuia: fases.findIndex((f) => f.nombre === "Evaluación") } : {};
  // Una sola revisión para todas las secciones: el docente pasa por cada grupo editor, sección por sección.
  if (proyectos) push({ ...TAREA_REVISION_DOCENTE, ...enEvaluacion }, corregibles, 2, 0.9, 0);
  // Problemas no tiene fase de evaluación: va en «Puesta en común», revisión formativa → sumativa → respuesta (decisión B).
  // Con 15 clases o más, Problemas lleva la ronda completa en «Puesta en común»: revisión del docente → mejora → comprobar el
  // nivel satisfactorio → sumativa (Referente por proyecto 2022, p. 35). Con menos, solo la revisión.
  const puesta = faseDe(/^Puesta en común/);
  const enPuesta = estrategia === "problemas" && totalClases >= 15 && puesta >= 0 ? { faseGuia: puesta } : {};
  const rondaCompleta = "faseGuia" in enPuesta;
  if (estrategia === "problemas") push({ ...TAREA_REVISION_DOCENTE, faseGuia: puesta }, corregibles, rondaCompleta ? 2 : 3, rondaCompleta ? 0.9 : 1.5, 0);
  // Proyectos: tras la revisión del docente, un solo ciclo de mejora para todas las secciones.
  // Con revisión del docente (Proyectos y Problemas) la mejora es un solo ciclo: Problemas a 4 semanas no cabía en 12 clases.
  const unCiclo = proyectos || estrategia === "problemas";
  // Problemas con menos de 15 clases no tiene la segunda ronda: la revisión hasta el nivel satisfactorio va en la
  // misma clase de corrección, como en Indagación (opción A de César, 2026-11-10; revisor g30: solo 1 «satisfactorio»).
  const nivelEnCorreccion = estrategia === "problemas" && !rondaCompleta;
  if (unCiclo) push({ ...TAREA_CORREGIR, faseInsercion: "proponer", ...enEvaluacion, ...enPuesta, ...(nivelEnCorreccion ? { minutos: MINUTOS_CORREGIR_CON_REVISION } : {}) }, corregibles, 2, 1, 0);
  else trozos(tempranas, SECCIONES_POR_CORREGIR).forEach((grupo, g) => {
    push({ ...TAREA_CORREGIR, minutos: MINUTOS_CORREGIR_CON_REVISION, faseInsercion: "socializar", ...enEvaluacion }, grupo, 2, 1, g);
    // Hasta el nivel satisfactorio (Referente por proyecto 2022, p. 35): en la misma clase, el docente comprueba lo corregido (opción A de César, 2026-11-10).
    push({ ...TAREA_REVISION_NIVEL, faseInsercion: "socializar", ...enEvaluacion }, grupo, 2, 1.5, g);
  });
  // Con «integrar», la comprobación del nivel es trabajo de grupo de «Puesta en común» (revisor g35, C10).
  if (nivelEnCorreccion) push({ ...TAREA_REVISION_NIVEL, faseInsercion: "proponer", ...(puesta >= 0 ? { faseGuia: puesta } : {}) }, corregibles, 2, 1.5, 0);
  if (!unCiclo) trozos(tardias, SECCIONES_POR_CORREGIR).forEach((grupo, g) => {
    push({ ...TAREA_CORREGIR, minutos: MINUTOS_CORREGIR_CON_REVISION, faseInsercion: "proponer", ...enEvaluacion }, grupo, 2, 2, g);
    push({ ...TAREA_REVISION_NIVEL, faseInsercion: "proponer", ...enEvaluacion }, grupo, 2, 2.5, g);
  });
  // Segunda ronda: el docente comprueba que las secciones corregidas llegaron al nivel satisfactorio.
  if (proyectos || rondaCompleta) push({ ...TAREA_REVISION_NIVEL, ...enEvaluacion, ...enPuesta }, corregibles, 2, 3, 0);
  const u = TAREAS_UNIDAD;
  // Proyectos: acuerdo y diagnóstico en 22 minutos, para que «Análisis de saberes previos» tenga su tarea en la clase 1
  // (SQA, Referente por proyecto 2022, p. 32). Interpretación DocenteOS, aprobada por César el 2026-11-07.
  push(proyectos ? { ...u.acordar, minutos: [22, 22] } : u.acordar, [...orden], 0, 0, 0);
  if (proyectos) push(u.saberesPrevios, [...orden], 0, 1, 0);
  // Problemas: las fases 1 a 3 (selección, definición y objetivos) cada una con su tarea.
  // «Recoger datos» (diseñar el instrumento, aplicarlo y resumir de forma agregada y anónima) se reutiliza en la fase de
  // investigación de cada estrategia que investiga (Referente 2025 p. 20 y 23: encuesta, entrevista, fuentes). Con poco tiempo no cabe.
  const FASE_DE_DATOS = { problemas: /^Análisis e investigación/, estudio_caso: /^Indagación o estudio/, proyectos: /^Gestión del conocimiento/ };
  // Proyectos: si el producto no depende de lugares, «Gestión del conocimiento» recoge datos con la encuesta en lugar del
  // recorrido; los datos salen de la audiencia, no solo de los modelos (revisor de «Frases del aula», 2026-11-11).
  const sinLugares = !orden.some((s) => INVENTARIO_POR_SECCION[s]?.necesita?.includes("lugares"));
  const recogeDatos = estrategia === "proyectos" ? encuestaProyectos && sinLugares : totalClases >= datosDesde;
  if (FASE_DE_DATOS[estrategia] && recogeDatos && faseDe(FASE_DE_DATOS[estrategia]) >= 0) {
    const corta = estrategia === "proyectos" || (estrategia === "problemas" && totalClases < UMBRAL_RECOGER_DATOS);
    (corta ? [u.indagarDisenar, u.indagarAplicar] : [u.indagarDisenar, u.indagarAplicar, u.indagarContrastar]).forEach((t, k) => push({ ...t, faseGuia: faseDe(FASE_DE_DATOS[estrategia]), estructura: DATOS_ENCUESTA[estrategia].estructura }, [...orden], 0, 2.5, k));
  }
  // ABP con menos de 15 clases y encuesta: la encuesta (aplicar y resumir en cifras) ya ordena los datos reales, así que
  // sustituye al «ordenar» suelto; sin «contrastar con una fuente», que es de Indagación. Así cabe en 12 clases (revisor g34).
  // Lo mismo en Proyectos con encuesta.
  if ((estrategia === "proyectos" || (estrategia === "problemas" && totalClases < UMBRAL_RECOGER_DATOS)) && items.some((it) => it.t.clave === "indagar_aplicar")) {
    for (let i = items.length - 1; i >= 0; i -= 1) if (items[i].t.clave === "analizar_ordenar") items.splice(i, 1);
  }
  // Con 12 clases no caben (la unidad entera ya llena el tiempo): ahí las fases 2 y 3 se unen a la 1 y queda por decidir qué
  // tarea sale (César). Desde 13 clases, cada fase lleva la suya.
  if (estrategia === "problemas" && totalClases >= problemaDesde) [u.problemaAnalizar, u.problemaDefinir, u.problemaObjetivos].forEach((t, k) => push(t, [...orden], 0, 1 + k, 0));
  push(u.glosario, [...orden], 3, 0, 0);
  // Problemas: reunir las secciones es trabajo de grupo de «Puesta en común», no de «Aprendizaje individual» (revisor g35).
  push({ ...u.integrar, ...enEvaluacion, ...(estrategia === "problemas" && totalClases < UMBRAL_RECOGER_DATOS && puesta >= 0 ? { faseGuia: puesta } : {}) }, [...orden], 3, 1, 0);
  if (orden.some((s) => INVENTARIO_POR_SECCION[s]?.necesita?.includes("lugares"))) push(u.recorrerLugares, [...orden], 0, 1, 0);
  // Cada estrategia hace lo suyo: la indagación valida sus fuentes, no solo ordena datos.
  if (estrategia === "indagacion_dialogica") [u.indagarDisenar, u.indagarAplicar, u.indagarContrastar].forEach((t, k) => push(t, [...orden], 0, 2, k));
  // Proyectos sin recorrido ni entrevista: los «datos recibidos» no vienen de nadie. En «Gestión del conocimiento» (Referente
  // por proyecto 2022, pp. 32–33: buscar, leer, sistematizar fuentes) se ordena lo reunido de la fuente que trae el docente
  // y de los modelos (revisión de g20, 2026-11-10). El tiempo no cambia: no se añade ninguna tarea.
  // Lo mismo en Problemas sin encuesta (revisor g30: «ordenan los datos de las encuestas» que nadie hizo).
  if (["proyectos", "problemas"].includes(estrategia) && !items.some((it) => /^(visitar|recorrer|indagar)/.test(it.t.clave))) {
    items.filter((it) => it.t.clave === "analizar_ordenar").forEach((it) => {
      it.t = { ...it.t, hace: "Ordenan en una tabla común lo reunido de la fuente que trae el docente y de los modelos analizados (ejemplos, frases o datos) y analizan un modelo para decidir el formato. Aún no redactan la pieza." };
    });
  }
  // Presentar y usar el producto con la audiencia son siempre dos tareas: la de usarlo cubre interactuar.
  const prueba = pruebaDelProducto(producto, orden, estrategia, descripcion);
  // Una propuesta se presenta completa y se defiende: no «se usa» (Guía 2025, p. 21).
  push(prueba?.tipo === "defender"
    ? { ...u.presentarSecciones, tipoPrueba: "defender", hace: "Presentan TODA la propuesta a la audiencia: las causas, los objetivos, las alternativas evaluadas y la recomendación. Luego recogen sus comentarios en tarjetas. Aquí no se corrige y no hay comentarios previos." }
    : u.presentarSecciones, [...orden], 3, 2, 0);
  push({ ...u.probarConAudiencia, tipoPrueba: prueba?.tipo || "general", hace: prueba?.hace || "Usan el producto con la audiencia para lo que fue hecho y luego recogen sus comentarios en tarjetas." }, [...orden], 3, 2, 1);
  push(u.audienciaSecundaria, [...orden], 3, 3, 0);
  push(u.evaluarComentarios, [...orden], 3, 4, 0);
  push(u.corregirFinal, [...orden], 3, 5, 0);
  push(u.evaluarProceso, [...orden], 3, 6, 0);

  // Fase de cada tarea, contando por papel para repartir entre fases iguales.
  const porRol = {};
  items.forEach((it) => { porRol[it.t.rol] = (porRol[it.t.rol] || 0) + 1; });
  const visto = {};
  items.forEach((it) => {
    const k = visto[it.t.rol] || 0;
    visto[it.t.rol] = k + 1;
    it.fase = it.t.faseGuia ?? buscarFase(fases, tiposFase, it.t, k, porRol[it.t.rol]);
  });
  // Cerrar la unidad en orden aunque la Guía ponga Evaluación antes de Socialización:
  // comprender los comentarios de la audiencia va con o después de presentar.
  const presentar = items.find((it) => it.t.clave === "presentar");
  const comentarios = items.find((it) => it.t.clave === "evaluar_comentarios");
  comentarios.fase = Math.max(comentarios.fase, presentar.fase);
  // La autoevaluación va después de la sumativa, aunque comparta clase (César, 2026-11-04).
  items.filter((it) => ["corregir_final", "evaluar_proceso"].includes(it.t.clave)).forEach((it) => { it.fase = Math.max(it.fase, comentarios.fase); });
  return items.sort((a, b) => a.fase - b.fase || a.bloque - b.bloque || a.orden1 - b.orden1 || a.orden2 - b.orden2);
};

const conMinutos = (items, f, ampliaciones) => items
  .filter((it) => !it.t.ampliacion || ampliaciones.has(it))
  .map((it) => ({ ...it, minutos: Math.round(it.t.minutos[0] + f * (it.t.minutos[1] - it.t.minutos[0])) }));

// Llena clases en orden sin partir tareas; `cruzar` permite compartir clase entre fases.
const empacar = (lista, capacidad, cruzar) => {
  const clases = [];
  lista.forEach((it) => {
    const actual = clases[clases.length - 1];
    const usado = actual ? actual.reduce((s, x) => s + x.minutos, 0) : 0;
    // Presentar y usar el producto ocupan su propia clase: la sumativa no se mezcla con otras tareas.
    const aparte = actual && Boolean(actual[actual.length - 1].t.claseAparte) !== Boolean(it.t.claseAparte);
    if (actual && !aparte && usado + it.minutos <= capacidad && (cruzar || actual[actual.length - 1].fase === it.fase)) actual.push(it);
    else clases.push([it]);
  });
  return clases;
};

// Mejor reparto secuencial: la mayor holgura de minutos que quepa en las clases.
const repartoSecuencial = (items, total, capacidad) => {
  const ampliaciones = new Set();
  const base = (f, cruzar) => empacar(conMinutos(items, f, ampliaciones), capacidad, cruzar);
  if (base(1, false).length <= total) {
    // Sobra: una ampliación tras otra mientras quepan.
    items.filter((it) => it.t.ampliacion).forEach((it) => {
      ampliaciones.add(it);
      if (base(1, false).length > total) ampliaciones.delete(it);
    });
    return { clases: base(1, false), modo: "normal", factor: 1 };
  }
  for (const cruzar of [false, true]) {
    for (let f = 0.98; f >= -0.001; f -= 0.02) {
      const clases = base(Math.max(0, f), cruzar);
      if (clases.length <= total) return { clases: aprovecharHolgura(clases, total, capacidad), modo: cruzar ? "ajustado_entre_fases" : "ajustado", factor: Math.max(0, f) };
    }
  }
  return null;
};

// Tiempo que queda al acortar: una clase con varias tareas se parte mientras sobren
// clases, y cada tarea recupera minutos hasta su tiempo normal. Así no quedan clases
// libres mientras haya tareas recortadas.
const aprovecharHolgura = (clases, total, capacidad) => {
  const lista = clases.map((c) => [...c]);
  while (lista.length < total) {
    let mayor = -1;
    lista.forEach((c, i) => { if (c.length > 1 && (mayor < 0 || c.length > lista[mayor].length)) mayor = i; });
    if (mayor < 0) break;
    const c = lista[mayor];
    const mitad = Math.ceil(c.length / 2);
    lista.splice(mayor, 1, c.slice(0, mitad), c.slice(mitad));
  }
  return lista.map((c) => {
    let libre = capacidad - c.reduce((s, it) => s + it.minutos, 0);
    return c.map((it) => {
      const extra = Math.min(Math.max(0, libre), Math.max(0, it.t.minutos[1] - it.minutos));
      libre -= extra;
      return { ...it, minutos: it.minutos + extra };
    });
  });
};

// Versión breve: las secciones trabajan a la vez por grupos, en tres bloques
// (recoger, producir, mejorar). Toda sección conserva su cadena en menos tiempo.
const repartoBreve = (items, total, capacidad) => {
  const esenciales = items.filter((it) => !it.t.ampliacion);
  const deSeccion = esenciales.filter((it) => it.bloque === 1 || it.t.clave === "corregir");
  const unidad = (clave) => esenciales.filter((it) => it.t.clave === clave);
  const bloqueDe = (etapa) => deSeccion.filter((it) => it.t.etapa === etapa);
  const pesoBloque = (lista) => {
    const porSeccion = {};
    lista.forEach((it) => it.secciones.forEach((s) => { porSeccion[s] = (porSeccion[s] || 0) + it.t.minutos[0]; }));
    return Math.max(0, ...Object.values(porSeccion));
  };
  const bloques = [
    { tareas: unidad("acordar"), peso: 30 },
    { tareas: bloqueDe("C"), peso: pesoBloque(bloqueDe("C")), paralelo: true },
    { tareas: bloqueDe("P"), peso: pesoBloque(bloqueDe("P")), paralelo: true },
    { tareas: bloqueDe("M"), peso: pesoBloque(bloqueDe("M")), paralelo: true },
    { tareas: unidad("integrar"), peso: 9 },
    { tareas: [...unidad("presentar"), ...unidad("probar_audiencia")], peso: 15 },
    { tareas: [...unidad("evaluar_comentarios"), ...unidad("corregir_final"), ...unidad("evaluar_proceso")], peso: 17 },
  ];
  const pesoTotal = bloques.reduce((s, b) => s + b.peso, 0);
  for (let e = (total * capacidad) / pesoTotal; e > 0.1; e -= 0.02) {
    const partes = bloques.flatMap((b) => {
      const largo = Math.max(3, Math.round(b.peso * e));
      const veces = Math.ceil(largo / capacidad);
      return Array.from({ length: veces }, (_, v) => ({
        ...b, largo: Math.floor(largo / veces), tareas: b.paralelo
          ? b.tareas.filter((it, i, todas) => {
            const propias = todas.filter((x) => x.secciones[0] === it.secciones[0]);
            return Math.floor((propias.indexOf(it) * veces) / propias.length) === v;
          })
          : (v === 0 ? b.tareas : []),
      })).filter((p) => p.tareas.length);
    });
    const clases = [];
    partes.forEach((p) => {
      const actual = clases[clases.length - 1];
      const usado = actual ? actual.reduce((s, x) => s + x.largo, 0) : 0;
      if (actual && usado + p.largo <= capacidad) actual.push(p);
      else clases.push([p]);
    });
    if (clases.length <= total) {
      // Sin clases libres mientras haya bloques recortados: se parte la clase más
      // cargada y cada bloque toma el tiempo que quede en su clase.
      while (clases.length < total) {
        let mayor = -1;
        clases.forEach((c, i) => { if (c.length > 1 && (mayor < 0 || c.length > clases[mayor].length)) mayor = i; });
        if (mayor < 0) break;
        const c = clases[mayor];
        clases.splice(mayor, 1, c.slice(0, Math.ceil(c.length / 2)), c.slice(Math.ceil(c.length / 2)));
      }
      const llenas = clases.map((c) => {
        const usado = c.reduce((s, x) => s + x.largo, 0);
        return c.map((x) => ({ ...x, largo: Math.floor((x.largo * capacidad) / usado) }));
      });
      return { bloquesPorClase: llenas };
    }
  }
  return null;
};

// Reparte minutos de un bloque entre las tareas de cada sección.
const tareasDeBloque = (p) => {
  const porSeccion = new Map();
  p.tareas.forEach((it) => {
    const clave = it.secciones[0];
    porSeccion.set(clave, [...(porSeccion.get(clave) || []), it]);
  });
  return p.tareas.map((it) => {
    const propias = porSeccion.get(it.secciones[0]);
    const peso = propias.reduce((s, x) => s + x.t.minutos[0], 0);
    return { ...it, minutos: Math.max(1, Math.floor((p.largo * it.t.minutos[0]) / peso)), paralelo: Boolean(p.paralelo) };
  });
};

const CATEGORIAS = ["funcionales", "gramatica", "vocabulario", "expresiones"];
const normal = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Contenidos seleccionados → clases. Parte de la función: la gramática va donde está
// la función a la que sirve; lo demás se reparte en orden, en clases donde tiene uso.
const ubicarContenidos = (filas, plan, seleccionados) => {
  const items = {};
  CATEGORIAS.forEach((cat) => {
    const textos = [...new Set(plan.fases.flatMap((f) => (f.contenidos?.[cat] || []).map((c) => c.texto)))];
    items[cat] = seleccionados ? textos.filter((t) => seleccionados.includes(t)) : textos;
  });
  const hay = (fila, letra) => fila.tareas.some((t) => [].concat(t.demuestra).includes(letra));
  const utiles = filas.filter((f) => !f.flexible);
  const candidatas = (fn) => { const l = utiles.filter(fn); return l.length ? l : utiles; };
  const sinLugar = [];
  // Lo que tiene un uso conocido va a la tarea que lo necesita; si esa tarea no está, queda
  // sin lugar. Hasta 4 por clase, 6 si tiene dos tareas, para que se pueda enseñar.
  const porUso = (cat, texto) => {
    const regla = USO_DE_CONTENIDOS.find(([re]) => re.test(normal(texto).trim()));
    if (!regla) return false;
    for (const clave of regla[1]) {
      const fila = utiles.find((f) => f.contenidos.length < (f.tareas.length > 1 ? TOPE_CONTENIDOS_POR_CLASE : 4)
        && (cat !== "gramatica" || f.contenidos.filter((c) => c.categoria === "gramatica").length < TOPE_GRAMATICA_POR_CLASE)
        && f.tareas.some((t) => t.clave === clave));
      if (fila) { fila.contenidos.push({ categoria: cat, texto, porFuncion: true }); return true; }
    }
    sinLugar.push(`${cat}:${texto}`);
    return true;
  };
  CATEGORIAS.forEach((cat) => { items[cat] = items[cat].filter((t) => !porUso(cat, t)); });
  // Prioridad = el orden en que se llama: funciones, su gramática, vocabulario, expresiones.
  // La gramática no cae en una clase cuya función no sirve («why don't» en la de pedir ayuda, g41a).
  const cabe = (f, cat, texto) => f.contenidos.length < TOPE_CONTENIDOS_POR_CLASE && (cat !== "gramatica" || gramaticaEncaja(f, texto));
  const poner = (fila, cat, texto) => {
    const destino = cabe(fila, cat, texto) ? fila : utiles.find((f) => cabe(f, cat, texto));
    if (destino) destino.contenidos.push({ categoria: cat, texto }); else sinLugar.push(`${cat}:${texto}`);
  };
  const enOrden = (lista, cat, destinos) => lista.forEach((t, i) => poner(destinos[Math.floor((i * destinos.length) / lista.length)], cat, t));
  // Las clases de la encuesta traen su lengua en los pasos: no reciben contenidos del reparto general.
  const conUso = candidatas((f) => (hay(f, "P") || hay(f, "I")) && !f.tareas.some((t) => /^indagar_/.test(t.clave)));
  const lugarFuncion = {};
  items.funcionales.forEach((t, i) => {
    const fila = conUso[Math.floor((i * conUso.length) / items.funcionales.length)];
    lugarFuncion[t] = fila;
    poner(fila, "funcionales", t);
  });
  const palabras = (t) => normal(t).replace(/^funcional:\s*/, "").split(/[^a-z]+/).filter((p) => p.length > 4);
  const sinFuncion = [];
  items.gramatica.forEach((t) => {
    const funcion = Object.keys(lugarFuncion).find((fn) => palabras(fn).some((p) => normal(t).includes(p.slice(0, 5))));
    if (funcion) poner(lugarFuncion[funcion], "gramatica", t); else sinFuncion.push(t);
  });
  enOrden(sinFuncion, "gramatica", conUso);
  // Lo que el uso puso antes de conocer la función de la clase («why don't» en la de pedir ayuda, g41a) se muda
  // a otra clase con la misma tarea que lo admita, o a cualquiera que lo admita; si ninguna, queda sin lugar.
  utiles.forEach((f) => {
    f.contenidos.filter((c) => c.categoria === "gramatica" && !gramaticaEncaja(f, c.texto)).forEach((c) => {
      f.contenidos.splice(f.contenidos.indexOf(c), 1);
      const claves = USO_DE_CONTENIDOS.find(([re]) => re.test(normal(c.texto).trim()))?.[1] || [];
      const otra = utiles.find((g) => g !== f && cabe(g, "gramatica", c.texto) && g.tareas.some((t) => claves.includes(t.clave)))
        || utiles.find((g) => g !== f && cabe(g, "gramatica", c.texto));
      if (otra) otra.contenidos.push(c); else sinLugar.push(`gramatica:${c.texto}`);
    });
  });
  // La clase cuya función pide una gramática (pedir ayuda → can/could/may) la recibe si el reparto no se la dio.
  utiles.forEach((f) => {
    const r = reglaDeFila(f);
    if (!r || f.contenidos.some((c) => c.categoria === "gramatica" && r[1].test(c.texto.split(":")[0]))) return;
    const todas = [...items.gramatica, ...utiles.flatMap((g) => g.contenidos).filter((c) => c.categoria === "gramatica").map((c) => c.texto)];
    const sirve = todas.find((t) => r[1].test(t.split(":")[0]));
    if (sirve && f.contenidos.length < TOPE_CONTENIDOS_POR_CLASE) f.contenidos.push({ categoria: "gramatica", texto: sirve });
  });
  enOrden(items.vocabulario, "vocabulario", candidatas((f) => hay(f, "C") || hay(f, "P")));
  enOrden(items.expresiones, "expresiones", candidatas((f) => hay(f, "I")));
  return sinLugar;
};

// Indicadores: la tarea que demuestra una acción lleva un indicador de esa acción,
// rotando para que todos los elegidos tengan su tarea.
const ubicarIndicadores = (filas, indicadores) => {
  const porAccion = {};
  indicadores.forEach((ind) => { (porAccion[ind.accion] = porAccion[ind.accion] || []).push(ind.id); });
  const siguiente = {};
  filas.forEach((fila) => {
    fila.tareas.forEach((t) => {
      [].concat(t.demuestra).filter(Boolean).forEach((letra) => {
        const accion = ACCION_DE[letra];
        const lista = porAccion[accion];
        if (!lista?.length) return;
        const id = lista[(siguiente[accion] = (siguiente[accion] ?? -1) + 1) % lista.length];
        if (!fila.indicadores.includes(id) && fila.indicadores.length >= TOPE_INDICADORES_POR_CLASE) return;
        if (!t.indicadores.includes(id)) t.indicadores.push(id);
        if (!fila.indicadores.includes(id)) fila.indicadores.push(id);
      });
    });
  });
  // Clase sumativa (V6): primero los indicadores de la acción de sus tareas sumativas, hasta
  // el tope. Lo que no quepa queda fuera de las sumativas y fallosQueDetienen lo reporta.
  filas.filter((f) => f.tareas.some((t) => t.sumativa)).forEach((fila) => {
    const sumativos = fila.tareas.filter((t) => t.sumativa).flatMap((t) => [].concat(t.demuestra).filter(Boolean)
      .flatMap((letra) => (porAccion[ACCION_DE[letra]] || []).map((id) => ({ t, id }))));
    fila.indicadores = [...new Set([...sumativos.map((s) => s.id), ...fila.indicadores])].slice(0, TOPE_INDICADORES_POR_CLASE);
    fila.tareas.forEach((t) => { t.indicadores = t.indicadores.filter((id) => fila.indicadores.includes(id)); });
    sumativos.filter((s) => fila.indicadores.includes(s.id) && !s.t.indicadores.includes(s.id)).forEach((s) => s.t.indicadores.push(s.id));
  });
  // Más indicadores que tareas de su acción: comparten tarea, en rotación.
  Object.entries(porAccion).forEach(([accion, lista]) => {
    const letra = Object.keys(ACCION_DE).find((l) => ACCION_DE[l] === accion);
    const destinos = filas.filter((f) => f.indicadores.length < TOPE_INDICADORES_POR_CLASE && f.tareas.some((t) => [].concat(t.demuestra).includes(letra)));
    lista.filter((id) => !filas.some((f) => f.indicadores.includes(id))).forEach((id, i) => {
      if (!destinos.length) return;
      const fila = [...destinos].sort((a, b) => a.indicadores.length - b.indicadores.length)[0] || destinos[i % destinos.length];
      fila.indicadores.push(id);
      fila.tareas.find((t) => [].concat(t.demuestra).includes(letra)).indicadores.push(id);
    });
  });
  // Clase sin tarea evaluable (autoevaluación sola, clase flexible): retoma el último
  // indicador trabajado, porque la plantilla exige al menos uno.
  let ultimo = null;
  filas.forEach((f) => {
    if (f.indicadores.length) { ultimo = f.indicadores[f.indicadores.length - 1]; return; }
    const previo = ultimo || indicadores[0]?.id;
    if (previo) { f.indicadores.push(previo); f.indicadorRetomado = true; }
  });
  // Elegidos sin tarea de su acción (la selección no cuadra con las tareas): se declaran.
  return indicadores.filter((ind) => !filas.some((f) => f.indicadores.includes(ind.id))).map((ind) => ind.id);
};

// Recibe: lo último que entregó la tarea anterior de la sección; la primera, lo
// último de las secciones de las que parte o, si nada ha salido, el acuerdo.
const encadenar = (filas, partenDe) => {
  const ultima = {};
  let acuerdo = null;
  let producto = null;
  const ref = (o) => ({ texto: o.texto, clase: o.clase });
  filas.forEach((fila) => {
    fila.tareas.forEach((t) => {
      const recibe = [];
      if (t.clave === "acordar") recibe.push({ texto: "Situación de aprendizaje", clase: null });
      else if (t.clave === "integrar") t.secciones.forEach((s) => { if (ultima[s]) recibe.push(ref(ultima[s])); });
      else if (t.clave === "presentar" || t.clave === "probar_audiencia" || t.clave === "audiencia_secundaria" || t.clave === "glosario" || t.clave.startsWith("evaluar")) {
        const previo = producto || t.secciones.map((s) => ultima[s]).find(Boolean);
        if (previo) recibe.push(ref(previo));
      } else {
        t.secciones.forEach((s) => {
          if (ultima[s]) recibe.push(ref(ultima[s]));
          else (partenDe[s] || []).forEach((d) => { if (ultima[d]) recibe.push(ref(ultima[d])); });
        });
        if (!recibe.length && acuerdo) recibe.push(ref(acuerdo));
      }
      t.recibe = recibe.filter((r, i, l) => l.findIndex((x) => x.texto === r.texto && x.clase === r.clase) === i);
      const entrega = { texto: t.secciones.length === 1 ? `${t.entrega}: ${t.secciones[0]}` : t.entrega, clase: fila.clase };
      if (t.clave === "acordar") acuerdo = entrega;
      else if (["integrar", "presentar", "probar_audiencia", "corregir_final", "audiencia_secundaria", "evaluar_comentarios", "evaluar_proceso", "glosario"].includes(t.clave)) producto = entrega;
      else t.secciones.forEach((s) => { ultima[s] = entrega; });
    });
    fila.recibe = fila.tareas.flatMap((t) => t.recibe).filter((r) => r.clase !== fila.clase)
      .filter((r, i, l) => l.findIndex((x) => x.texto === r.texto && x.clase === r.clase) === i);
  });
};

// Inventario: qué datos debe recoger cada clase. La entrevista recoge lo que necesitan
// las piezas posteriores; una sección que recoge, lo hace en su primera tarea.
const ponerDatosARecoger = (filas, secciones) => {
  const inv = (s) => INVENTARIO_POR_SECCION[s] || {};
  const recogidos = new Set();
  const empezadas = new Set();
  filas.forEach((fila) => {
    const datos = new Set();
    fila.tareas.forEach((t) => {
      if (t.secciones.length !== 1 || ["acordar", "comentar", "corregir"].includes(t.clave)) return;
      const primera = !empezadas.has(t.secciones[0]);
      empezadas.add(t.secciones[0]);
      if (!["visitar_guion", "visitar_entrevistar"].includes(t.clave) && !primera) return;
      t.secciones.forEach((s) => {
        (inv(s).recoge || []).filter((d) => t.clave.startsWith("visitar") || !recogidos.has(d)).forEach((d) => datos.add(d));
      });
    });
    fila.datosRecoge = [...datos];
    if (!fila.tareas.some((t) => t.clave === "visitar_guion")) datos.forEach((d) => recogidos.add(d));
  });
  return secciones;
};

// Evaluación de una clase: sale de sus tareas, la IA no la decide.
const AGENTE_TAREA = { revision_docente: "Heteroevaluación formativa", revision_nivel: "Heteroevaluación formativa", comentar: "Coevaluación", evaluar_proceso: "Autoevaluación y coevaluación", aplicar_ensayar: "Coevaluación" };
const TECNICA_EVIDENCIA = {
  conocimiento: ["Preguntas de comprensión", "Lista de cotejo"],
  desempeno: ["Observación directa", "Lista de cotejo oral (Anexo B)"],
  producto: ["Revisión de producciones", "Escala de valoración (Anexo E.2)"],
};
export const evaluacionDeFila = (fila) => {
  if (fila.flexible) return { tipo: "Formativa", agente: "Heteroevaluación", tecnica: "Observación directa", instrumento: "Registro anecdótico (Anexo C)" };
  const claves = fila.tareas.map((t) => t.clave);
  const sumativa = fila.tareas.some((t) => t.sumativa);
  // Qué se califica y qué no, con el nombre de cada parte de la clase (sale de sus tareas).
  const califica = fila.tareas.filter((t) => t.sumativa).map((t) => DETALLE_TAREA[t.clave]?.califica || t.nombre);
  const formativo = fila.tareas.flatMap((t) => DETALLE_TAREA[t.clave]?.formativo || (t.sumativa ? [] : [t.nombre]));
  const enFrase = (l) => l.join(", ").replace(/, ([^,]*)$/, " y $1");
  const tipo = claves.includes("acordar") ? "Diagnóstica" : sumativa
    ? (formativo.length ? `Sumativa: se ${califica.length > 1 ? "califican" : (/^las /.test(califica[0]) ? "califican" : "califica")} ${enFrase(califica)}. Formativa: ${enFrase(formativo)}` : "Sumativa") : "Formativa";
  // La actividad sumativa es solo heteroevaluación; los demás agentes son de la parte formativa.
  const otrosAgentes = [...new Set(fila.tareas.filter((t) => !t.sumativa).map((t) => AGENTE_TAREA[t.clave]).filter(Boolean))];
  const agente = sumativa
    ? `Heteroevaluación${otrosAgentes.length ? ` (sumativa); ${otrosAgentes.join(" y ").toLowerCase()} (formativa)` : ""}`
    : otrosAgentes.join(" y ") || "Heteroevaluación";
  const pares = [...new Set(fila.tareas.filter((t) => t.demuestra !== null).map((t) => t.evidencia))].map((e) => TECNICA_EVIDENCIA[e]);
  const lista = pares.length ? pares : [TECNICA_EVIDENCIA.desempeno];
  let instrumento = [...new Set(lista.map((p) => p[1]))].join(" y ");
  if (claves.includes("presentar")) instrumento = "Rúbrica analítica (Anexo A) y lista de cotejo oral (Anexo B)";
  else if (fila.tareas.some((t) => t.cierraSeccion || t.revisionFormativa) || claves.includes("integrar")) instrumento = "Rúbrica analítica (Anexo A)";
  else if (claves.includes("acordar")) instrumento = "Evaluación diagnóstica (Anexo J)";
  else if (claves.includes("evaluar_proceso")) instrumento = "Lista de cotejo; autoevaluación (Anexo E) y coevaluación (Anexo D)";
  return { tipo, agente, tecnica: [...new Set(lista.map((p) => p[0]))].join(" y "), instrumento };
};

// Cierre de una unidad con mapa: la reflexión de la clase se evalúa con los criterios de proceso de los Anexos E y D.
// Inicio de una unidad con mapa: se observa sin instrumento formal; el Registro anecdótico (Anexo C) solo si se anota algo (g23: «criterio 7» en 15 Inicios).
export const EVALUACION_INICIO_MAPA = { tipo: "Diagnóstica", agente: "Heteroevaluación", tecnica: "Observación directa", instrumento: "Sin instrumento formal; Registro anecdótico (Anexo C) solo si se anota algo" };
export const EVALUACION_CIERRE_MAPA = { tipo: "Formativa", agente: "Autoevaluación y coevaluación", tecnica: "Reflexión oral y ticket de salida", instrumento: "Autoevaluación (Anexo E) y coevaluación (Anexo D)" };

// Qué anexo es cada instrumento que nombra una clase y dónde están sus criterios.
const ANEXO_POR_INSTRUMENTO = [
  [/r[uú]brica/i, "A", "rubricaProducto"],
  [/lista de cotejo/i, "B", "listaCotejoOral"],
  [/coevaluaci/i, "D", "coevaluacion"],
  [/autoevaluaci/i, "E", "autoevaluacion"],
  [/escala de valoraci/i, "E.2", "escalaValoracion"],
];
/**
 * Cada clase dice qué criterios de sus instrumentos evalúa: los del indicador que trabaja (I-20).
 * Lo escribe el código a partir de los anexos ya construidos; la IA no interviene.
 */
export const vincularInstrumentosConClases = (dias = [], anexos = {}, dimensionesDe = null) => {
  const enLista = (l) => l.join(", ").replace(/, ([^,]*)$/, " y $1");
  dias.forEach((dia) => {
    const trabajados = new Set((dia?.indicadoresTrabajados || []).map((i) => String(i?.id || i?.codigo || i)));
    // Lo que la clase hace (comprender, producir, interactuar) acota los criterios; sin dato, valen todos los del indicador.
    const dims = new Set(typeof dimensionesDe === "function" ? dimensionesDe(dia) : []);
    // La sumativa valora todos los indicadores de su clase, sin acotar por lo que dicen los verbos de sus actividades.
    (dia?.momentos || []).forEach((m) => {
      const ev = m?.evaluacion;
      if (!ev?.instrumento) return;
      const partes = [];
      ANEXO_POR_INSTRUMENTO.forEach(([re, letra, clave]) => {
        if (!re.test(ev.instrumento)) return;
        const delIndicador = (anexos?.[clave] || []).map((it, i) => [it, i + 1]).filter(([it]) => it?.indicadorCodigo && trabajados.has(it.indicadorCodigo));
        const delaClase = /^sumativa/i.test(ev.tipo || "") ? delIndicador : delIndicador.filter(([it]) => !dims.size || !it.exige || dims.has(it.exige));
        const nums = (delaClase.length ? delaClase : delIndicador).map(([, n]) => n);
        if (nums.length) partes.push(`Anexo ${letra}, criterio${nums.length > 1 ? "s" : ""} ${enLista(nums)}`);
      });
      if (partes.length) ev.criterios = partes.join("; ");
    });
  });
  return dias;
};

/** Recursos humanos de una clase: el invitado cuenta si la tarea lo requiere. */
/**
 * Audiencia que no cabe en la clase sumativa (más de un curso o más de 15 personas): la configuración no cambia, pero la
 * clase invita a una muestra y cada pareja atiende a un grupo pequeño (revisor de «Frases del aula», 2026-11-11). Vacío si cabe.
 */
export const muestraDeAudiencia = (audiencia = "") => {
  const texto = String(audiencia || "");
  const cursos = [...new Set([...texto.matchAll(/\b(\d{1,2})\s*(?:\.\s*º|º|°|\.º|ro|do|to|vo|no|mo)(?![\p{L}])/gu)].map((m) => `${m[1]}.º`))];
  if (cursos.length > 1) return `2–3 estudiantes invitados de ${cursos.slice(0, -1).join(", ")} y ${cursos[cursos.length - 1]}`;
  const cuantos = Math.max(0, ...[...texto.matchAll(/\b(\d{2,4})\s+(?:personas|estudiantes|alumnos|familias|padres|madres|invitados|miembros)\b/gi)].map((m) => Number(m[1])));
  // Un grupo sin cifra que no cabe en el aula («las familias», «la comunidad»): también va por muestra (revisor de Rutinas 1.º, 2026-11-16).
  const grupoSinCifra = /\b(familias|padres|madres|representantes|comunidad|vecinos)\b/i.test(texto);
  if (cuantos > 15 || (!cuantos && grupoSinCifra)) return `un grupo pequeño de invitados (5 o 6) de ${texto.replace(/^\s*(los|las|el|la)\s+/i, "")}`;
  return "";
};

export const humanosDeFila = (fila, alcance = null, muestra = "", audiencia = "") => {
  const claves = fila.tareas.map((t) => t.clave);
  if (claves.includes("presentar") || claves.includes("probar_audiencia")) {
    if (muestra) return `Docente, estudiantes y ${muestra}`;
    // Sin ficha de invitado: la audiencia configurada, con su nombre; nunca «la audiencia» (I-12, I-23).
    if (!alcance?.invitado) return audiencia ? `Docente, estudiantes y ${String(audiencia).trim()}` : "Docente, estudiantes y la audiencia";
    return `Docente, estudiantes, ${alcance.invitado}${alcance.visitante ? ` y ${alcance.visitante}` : ""}`;
  }
  if (claves.includes("visitar_entrevistar") && fila.modalidad === "invitado") return `Docente, estudiantes y ${alcance?.invitado || "la persona entrevistada"}`;
  return "Docente y estudiantes";
};

/** Recursos didácticos de una clase: los de sus tareas, sin añadir equipos que la fila no prevé. */
export const didacticosDeFila = (fila) => {
  const vistos = new Map();
  fila.tareas.flatMap((t) => String(t.recursos?.didacticos || "").split(",")).map((r) => r.trim()).filter(Boolean)
    .forEach((r) => { if (!vistos.has(r.toLowerCase())) vistos.set(r.toLowerCase(), r); });
  return [...vistos.values()].join(", ");
};

/** La clase 1 no tiene clase anterior: la posición de retroalimentación mira hacia adelante. */
export const INICIO_PRIMERA_CLASE = "Recuperación de experiencias: comentan qué han vivido o visto sobre este tema. (What do you know about this topic?)";

// Equipos que el mapa no prevé: no se sabe si el centro los tiene.
// Por raíz y en todas sus formas (revisión g44): lo que queda tras limpiar se avisa al admin.
const EQUIPO = /\b(videos?|clips?|digital(es)?|(retro)?proyector(es)?|parlantes?|bocinas?|altavoz|grabadoras?|grabacion(es)?|computadoras?|laptops?|tablets?|internet|audiovisual(es)?|celular(es)?|audio\w*|grab(a|an|ar|en|ado|ada|ados|adas)|film\w*|proyect(a|an|ar|ado|ada|ados|adas)|reproduc\w+|pantallas?|tv|televis\w+|telefonos?|dispositivos?|foto(?!copia)\w*)\b/;
export const ENGANCHE_SIN_EQUIPOS = "Observan un ejemplo impreso relacionado con la clase y dicen qué les llama la atención.";

// Conserva la mayúscula inicial de lo que reemplaza («Del video» → «Del ejemplo»).
const conInicial = (original, nuevo) => (original[0] !== original[0].toLowerCase() ? `${nuevo[0].toUpperCase()}${nuevo.slice(1)}` : nuevo);
const sinVideoEs = (t) => (typeof t === "string" ? t
  // Destino con un equipo de grabación (revisor g34, C9: «se guarda en el dispositivo de grabación del aula»).
  .replace(/\bse (guarda|guardan|registra|registran|archiva|archivan) en (el|un) (dispositivo|equipo|aparato) de grabaci[oó]n( del aula)?/gi, (m) => conInicial(m, "se anota en el cuaderno del grupo"))
  .replace(/\b(el|un) (dispositivo|equipo|aparato) de grabaci[oó]n( del aula)?/gi, (m) => conInicial(m, "el cuaderno del grupo"))
  .replace(/\b(the|a|our|this) video\b/gi, (m) => conInicial(m, "the example"))
  .replace(/\b(el|un|nuestro|este) video\b/gi, (m) => conInicial(m, "el ejemplo"))
  .replace(/\bdel video\b/gi, (m) => conInicial(m, "del ejemplo"))
  .replace(/\b(los|unos|estos|nuestros) videos\b/gi, (m, art) => conInicial(m, `${art.toLowerCase()} ejemplos`))
  .replace(/\b(el|un|su) (retro)?proyector\b/gi, (m) => conInicial(m, "la pizarra"))
  .replace(/\b(en|con|del) (retro)?proyector\b/gi, (m, pre) => conInicial(m, `${pre.toLowerCase()} la pizarra`))
  .replace(/\bgrabaciones orales\b/gi, (m) => conInicial(m, "producciones orales"))
  .replace(/\b(un|el) audio modelo\b/gi, (m, art) => conInicial(m, `${art.toLowerCase()} diálogo modelo leído por el docente`))
  .replace(/\bvideos?\b/gi, (v) => conInicial(v, /s$/i.test(v) ? "ejemplos" : "ejemplo"))
  // Verbos de grabar o proyectar y «audio» en cualquier frase (revisor de g44, C11: «lo graban en la ficha de audio del grupo»).
  .replace(/\b(ficha|hoja|tarjeta|carpeta|cuaderno|registro) de audio\b/gi, (m, n) => conInicial(m, n.toLowerCase()))
  // Solo cuando graban lo que ya hicieron (un registro): «Graban un audio» no tiene reemplazo seguro y se avisa.
  .replace(/\b(lo|la|los|las|se) (grab|film)(an|amos|a|ar|en|e)\b/gi, (m, pron, _v, fin) => conInicial(m, `${pron.toLowerCase()} anot${fin.toLowerCase()}`))
  // Por raíz (revisión g44, C6: «el mapa escolar proyectado»): lo que se iba a proyectar o mostrar en pantalla va en la pizarra.
  .replace(/\s+proyectad[oa]s?\b/gi, " en la pizarra")
  .replace(/\b(en|con|de) (la|una) pantalla\b/gi, (m, pre) => conInicial(m, `${pre.toLowerCase()} la pizarra`))
  .replace(/\b(en|con|de) (la|el|un|una) (tv|televisi[oó]n|televisor)\b/gi, (m, pre) => conInicial(m, `${pre.toLowerCase()} la pizarra`))
  .replace(/\bgrabad([oa]s?)\b/gi, (m, fin) => conInicial(m, `anotad${fin.toLowerCase()}`))
  .replace(/\bproyect(an|amos|a|ar)\b/gi, (m, fin) => conInicial(m, { an: "muestran", amos: "mostramos", a: "muestra", ar: "mostrar" }[fin.toLowerCase()]))
  // «Digital» como adjetivo (revisor de g49: «en un único documento digital»): el documento es de papel.
  .replace(/\b(en|a) formato digital\b/gi, (m, pre) => conInicial(m, `${pre.toLowerCase()} papel`))
  .replace(/\b([a-záéíóúñ]+)\s+digital(es)?\b/gi, (m, n) => (/^(en|de|con|a|lo|el|la|los|las|un|una|y|o|formato|mundo|era)$/i.test(n) ? m : n))
  .replace(/\breproduc(en|imos|e|ir)\b(?!\s+(?:el|un|los)\s+(?:audio|video|clip))/gi, (m, fin) => conInicial(m, `le${{ en: "en", imos: "emos", e: "e", ir: "er" }[fin.toLowerCase()]} en voz alta`)) : t);

/**
 * Inicio y Cierre sin equipos: quita los que la IA puso en sus recursos y sustituye la
 * actividad de enganche que los usa (el Inicio tiene 5 posiciones fijas). Lo que quede
 * en otra actividad se devuelve para avisar al administrador.
 */
export const sinEquipos = (momentos = [], didacticosFila = "") => {
  const restantes = [];
  // El video también se nombra en las evidencias y en las preguntas, en cualquier momento.
  // También en las actividades de cualquier momento, incluido el Desarrollo (g23, Escuela guía C8: «las frases del video»).
  const sinVideo = sinVideoEs;
  momentos.forEach((m) => {
    if (Array.isArray(m?.actividadesDetalle)) m.actividadesDetalle.forEach((x) => { if (x && typeof x.texto === "string") x.texto = sinVideo(x.texto); });
    if (Array.isArray(m?.metacognicion)) m.metacognicion = m.metacognicion.map(sinVideo);
    Object.entries(m?.evidencias || {}).forEach(([k, l]) => { if (Array.isArray(l)) m.evidencias[k] = l.map(sinVideo); });
    // La evidencia suele ser un solo texto con formato, no una lista: también se limpia.
    if (typeof m?.evidencias === "string") m.evidencias = sinVideo(m.evidencias);
  });
  momentos.filter((m) => m?.nombre !== "Desarrollo").forEach((m) => {
    const lista = String(m.recursos?.didacticos || "").split(",").map((r) => r.trim()).filter(Boolean);
    const limpios = lista.filter((r) => !EQUIPO.test(normal(r)));
    m.recursos = { ...m.recursos, didacticos: limpios.join(", ") || didacticosFila, tecnologicos: "No requerido para esta actividad" };
    (m.actividades || []).forEach((a, i) => {
      if (typeof a !== "string" || !EQUIPO.test(normal(a))) return;
      if (m.nombre === "Inicio" && i === 3) { m.actividades[i] = ENGANCHE_SIN_EQUIPOS; return; }
      const limpia = sinVideo(a);
      m.actividades[i] = limpia;
      if (EQUIPO.test(normal(limpia))) restantes.push(`${m.nombre}: ${limpia.slice(0, 70)}`);
    });
  });
  // Desarrollo: el video y el proyector se cambian por el ejemplo y la pizarra; lo que no se resuelve (parlantes, grabadora…) se avisa.
  momentos.filter((m) => m?.nombre === "Desarrollo").forEach((m) => (m.actividades || []).forEach((a, i) => {
    if (typeof a !== "string" || !EQUIPO.test(normal(a))) return;
    const limpia = sinVideo(a);
    m.actividades[i] = limpia;
    if (EQUIPO.test(normal(limpia))) restantes.push(`Desarrollo: ${limpia.slice(0, 70)}`);
  }));
  return restantes;
};

// Equipos en el texto modelo (en inglés): el mapa no prevé tecnología, así que el modelo no puede suponerla (g22, C3: «use the projector»).
const EQUIPO_EN = /\b(videos?|clips?|projector|computers?|laptops?|tablets?|speakers?|microphone|internet|online|smartphones?)\b/i;
const CAMBIOS_EQUIPO_EN = [
  [/\bthe projector\b/gi, "the board"], [/\ba projector\b/gi, "the board"], [/\bprojector\b/gi, "board"],
  [/\b(the|a|our|this) videos?\b/gi, "$1 example"], [/\bvideos?\b/gi, "example"],
  [/\b(the|a|our|this) (computer|laptop|tablet)s?\b/gi, "$1 notebook"],
];
/**
 * Recorre TODO el texto generado (actividades, evidencias y su detalle, adaptaciones NEAE, observaciones, anexos) y quita el video
 * y el proyector. Devuelve cuántos textos cambió. No toca el texto modelo (en inglés, lo limpia sinEquiposEnModelo) ni valores internos.
 */
export const sinEquiposEnTodo = (nodo) => {
  let cambios = 0;
  const restantes = [];
  const recorrer = (n) => {
    Object.entries(n || {}).forEach(([k, v]) => {
      // El Anexo L declara la tecnología prevista: es el único lugar donde la tecnología se nombra (revisor de g49).
      if (CLAVES_SIN_TEXTO_DE_CLASE.has(k) || CLAVES_INTERNAS.has(k) || k === "recursosTecnologicosPrevistos") return;
      if (typeof v === "string") {
        const nuevo = sinVideoEs(v);
        if (nuevo !== v) { n[k] = nuevo; cambios += 1; }
        // Lo que no tiene un reemplazo seguro (audio, computadora, grabadora…) se avisa al administrador.
        if (EQUIPO.test(normal(nuevo)) && !/^no requerido/i.test(nuevo)) restantes.push(nuevo.slice(0, 90));
      } else if (v && typeof v === "object") recorrer(v);
    });
  };
  recorrer(nodo);
  return { cambios, restantes };
};

// Adaptaciones NEAE de la fase: sin tecnología declarada, alternativas físicas (g26: «audio», «grabar en audio», «grabadoras de voz»).
const CAMBIOS_NEAE_SIN_TECNOLOGIA = [
  [/formatos digitales ampliados o audio/gi, "material ampliado impreso o lectura en voz alta del docente"],
  [/material ampliado y audio/gi, "material ampliado y lectura en voz alta del docente"],
  [/grabar en audio (sus|las|los) respuestas/gi, "dar sus respuestas oralmente"],
  [/el uso de (grabadoras? de voz|grabaciones( de voz)?)/gi, "responder oralmente al docente"],
  [/grabaciones de voz/gi, "respuestas orales al docente"],
  [/\bformato digital( accesible)?\b/gi, "formato impreso"],
  [/grabaci[oó]n de (la )?lectura en voz alta( del docente)?/gi, "lectura en voz alta del docente"],
  [/grabadoras? de voz/gi, "respuestas orales al docente"],
  [/permitir grabaciones/gi, "permitir respuestas orales al docente"],
  [/\bformatos digitales\b/gi, "formatos impresos"],
  [/\bgrabaciones\b/gi, "respuestas orales"],
  [/\bgrabaci[oó]n\b/gi, "respuesta oral"],
  [/\baudios\b/gi, "lecturas en voz alta del docente"],
  [/\baudio\b/gi, "lectura en voz alta del docente"],
];
/** Cambia en las adaptaciones NEAE de una fase la tecnología por alternativas físicas. Devuelve cuántos textos cambió. */
export const adaptacionesNEAESinTecnologia = (fase = {}) => {
  const adaptaciones = fase?.adaptacionesNEAE;
  if (!adaptaciones || typeof adaptaciones !== "object") return 0;
  let cambios = 0;
  Object.entries(adaptaciones).forEach(([k, v]) => {
    if (typeof v !== "string") return;
    const nuevo = CAMBIOS_NEAE_SIN_TECNOLOGIA.reduce((t, [re, por]) => t.replace(re, por), v);
    if (nuevo !== v) { adaptaciones[k] = nuevo; cambios += 1; }
  });
  return cambios;
};

/**
 * Adaptaciones NEAE de la fase desde un menú fijo de adaptaciones físicas: las escribe el código, no la IA (revisor,
 * 2026-11-11: cuatro veces la IA coló tecnología con otra palabra — audio, grabación, digitales, audiovisual).
 * Las opciones con tecnología solo entran si el entorno la declara. Mismo enfoque que las observaciones de la fase.
 */
export const ADAPTACIONES_NEAE_MENU = {
  acceso: ["material impreso ampliado y con buen contraste", "lectura en voz alta del docente de las consignas y los textos", "pictogramas impresos de apoyo"],
  metodologicas: ["pareja de apoyo durante la tarea", "consignas en pasos cortos, una a la vez, con un ejemplo en la pizarra"],
  evaluacion: ["tiempo adicional", "respuesta oral al docente cuando escribir sea la barrera", "pareja de apoyo que lee la consigna, sin dar la respuesta"],
};
const ADAPTACIONES_NEAE_CON_TECNOLOGIA = {
  acceso: ["audio de las consignas en el equipo del aula"],
  evaluacion: ["respuesta grabada en el equipo del aula"],
};
const frase = (lista) => {
  const t = lista.length > 1 ? `${lista.slice(0, -1).join("; ")} y ${lista[lista.length - 1]}` : (lista[0] || "");
  return t ? `${t.charAt(0).toUpperCase()}${t.slice(1)}.` : "";
};
export const adaptacionesNEAEDelMenu = (fases = [], { conTecnologia = false } = {}) => {
  const texto = Object.fromEntries(Object.entries(ADAPTACIONES_NEAE_MENU).map(([k, lista]) => [
    k, frase([...lista, ...(conTecnologia ? ADAPTACIONES_NEAE_CON_TECNOLOGIA[k] || [] : [])]),
  ]));
  let cambios = 0;
  (fases || []).forEach((fase) => {
    if (!fase || typeof fase !== "object") return;
    const antes = JSON.stringify(fase.adaptacionesNEAE || null);
    fase.adaptacionesNEAE = { ...texto };
    if (JSON.stringify(fase.adaptacionesNEAE) !== antes) cambios += 1;
  });
  return cambios;
};

// Un plan se escribe antes de dar las clases: las observaciones de la fase no pueden afirmar resultados. Las escribe el código (g27).
/**
 * «Estrategias del día» sin estrategias ajenas a la unidad (revisor, g30: una unidad ABP etiquetaba 8 clases con
 * «Indagación dialógica»). Se quitan las otras estrategias de la Guía; las técnicas (colaborativo, socialización…)
 * quedan. Devuelve cuántas clases cambió.
 */
const sinTildes = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[.()]/g, " ").replace(/\s+/g, " ").trim();
export const sinEstrategiasAjenas = (fases = [], estrategiaUnidad = "") => {
  const propia = sinTildes(estrategiaUnidad);
  // Se reconoce cada estrategia por su forma corta: la primera palabra («inserción», «indagación», «exploración»…) o,
  // en las de «Aprendizaje Basado en…», las cuatro primeras (g36: la IA escribe «Inserción en el entorno»).
  const corta = (n) => { const p = n.replace(/\s*abp$/, "").trim().split(" "); return p[0] === "aprendizaje" ? p.slice(0, 4).join(" ") : (p[0] === "estudio" ? "estudio de caso" : p[0]); };
  const ajenas = ESTRATEGIAS_FASES_GUIA_2025.map((e) => sinTildes(e.nombre)).filter((n) => n && n !== propia).map(corta);
  let cambios = 0;
  (fases || []).forEach((fase) => (fase?.dias || []).forEach((dia) => {
    if (typeof dia?.estrategiasDia !== "string" || !dia.estrategiasDia.trim()) return;
    const partes = dia.estrategiasDia.split(/\s*[•·]\s*/).filter(Boolean);
    const quedan = partes.filter((p) => !ajenas.some((a) => sinTildes(p).startsWith(a)));
    if (quedan.length === partes.length) return;
    dia.estrategiasDia = (quedan.length ? quedan : [estrategiaUnidad]).join(" • ");
    cambios += 1;
  }));
  return cambios;
};

export const OBSERVACIONES_FASE = "Registrar el desempeño general del grupo e identificar estudiantes que requieren atención diferenciada o refuerzo.";
/** Pone en cada fase (y en el resumen de evaluación de sus clases) las observaciones fijas. Devuelve cuántas fases cambió. */
export const conObservacionesFijas = (fases = []) => {
  let cambios = 0;
  (fases || []).forEach((fase) => {
    if (fase && fase.observacionesSemana !== OBSERVACIONES_FASE) { fase.observacionesSemana = OBSERVACIONES_FASE; cambios += 1; }
    (fase?.dias || []).forEach((d) => { if (d?.resumenEvaluacion) d.resumenEvaluacion.observaciones = OBSERVACIONES_FASE; });
  });
  return cambios;
};

/** Anexo K: sin tecnología declarada, las adaptaciones no suponen grabaciones ni audios (g25). */
export const adaptacionSinTecnologia = (p = {}) => {
  const quitar = (t) => (typeof t === "string"
    ? t.replace(/permitir grabaciones/gi, "permitir respuestas orales al docente").replace(/cada audio o di[aá]logo/gi, "cada diálogo leído")
    : t);
  return { ...p, acceso: quitar(p.acceso), evaluacion: quitar(p.evaluacion) };
};

/** Quita del texto modelo los equipos que el mapa no prevé. Devuelve cuántas líneas cambió y las que aún nombran un equipo. */
export const sinEquiposEnModelo = (dia = {}) => {
  const lineas = dia?.textoModelo?.lineas;
  if (!Array.isArray(lineas)) return { cambios: 0, restantes: [] };
  let cambios = 0;
  dia.textoModelo.lineas = lineas.map((l) => {
    if (typeof l !== "string" || !EQUIPO_EN.test(l)) return l;
    const nuevo = CAMBIOS_EQUIPO_EN.reduce((t, [re, por]) => t.replace(re, por), l);
    if (nuevo !== l) cambios += 1;
    return nuevo;
  });
  return { cambios, restantes: dia.textoModelo.lineas.filter((l) => typeof l === "string" && EQUIPO_EN.test(l)).map((l) => l.slice(0, 70)) };
};

const OBSERVADO = { grabada: "observada y anotada", grabado: "observado y anotado", grabadas: "observadas y anotadas", grabados: "observados y anotados" };
const sinGrabadoEn = (t) => t.replace(/(?<![\p{L}])(?<!\b(?:sin|no) )(?<!\bsin ser )(grabad[oa]s?)(?![\p{L}])/giu, (g) => OBSERVADO[g.toLowerCase()]);

/** ¿Esta fila trabaja una sección que necesita lugares del centro? */
export const necesitaLugares = (fila) => Boolean(fila?.lugaresDelCentro) || (fila?.secciones || []).some((s) => INVENTARIO_POR_SECCION[s]?.necesita?.includes("lugares"));
/** ¿El tema de la unidad trata de lugares del centro aunque sus secciones no los pidan? (p. ej. una propuesta sobre cómo se orientan los nuevos.) */
export const TEMA_DE_LUGARES = /\b(se pierden|perdid[oa]s?|orient(?:ar|aci[oó]n|an)|lugares|ubicaci[oó]n|recorrido|nuevo ingreso|llegan nuevos|primeras semanas)\b/i;
/** La ampliación no propone lugares: salen de la tabla común del recorrido. */
export const ampliacionSinLugares = (ampliacion = []) => ampliacion.filter((a) => !LUGARES_NO_DECLARADOS.test(String(a?.texto || "")));

/**
 * Sin ficha del centro, ningún ejemplo nombra un lugar concreto. Se quita el ejemplo entre
 * paréntesis o la frase que lo nombra; si es toda la actividad, se deja y se avisa.
 * «Model School» es un centro ficticio declarado y puede nombrarlos.
 */
const nombraLugar = (t) => LUGARES_NO_DECLARADOS.test(String(t)) && !/model school/i.test(String(t));
export const sinLugaresEnEjemplos = (texto) => {
  if (typeof texto !== "string" || !nombraLugar(texto)) return texto;
  const sinParentesis = texto.replace(/\s*\([^()]*\)/g, (p) => (nombraLugar(p) ? "" : p));
  const quedan = sinParentesis.split(/(?<=[.?!…])\s+/).filter((f) => !nombraLugar(f));
  return quedan.length ? quedan.join(" ") : sinParentesis;
};

// Frase entera sobre un lugar, en Inicio, Desarrollo o Cierre: no se puede quitar sin dejar
// la actividad vacía, así que el lugar pasa a ser genérico (César, 2026-11-06).
const LUGAR_GLOBAL = new RegExp(LUGARES_NO_DECLARADOS.source, "giu");
const conLugarGenerico = (texto) => {
  if (!nombraLugar(texto)) return texto;
  const nombre = LUGAR_GLOBAL.source;
  return texto
    .replace(new RegExp(`\\b(del|de la|de el)\\s+${nombre}`, "giu"), "de un lugar del centro")
    .replace(new RegExp(`\\b(al|a la|a el)\\s+${nombre}`, "giu"), "a un lugar del centro")
    .replace(new RegExp(`\\b(el|la|los|las|un|una|su|sus|nuestro|nuestra)\\s+${nombre}`, "giu"), "un lugar del centro")
    .replace(new RegExp(`\\b(the|a|an|our|your)\\s+${nombre}`, "giu"), "this place")
    .replace(LUGAR_GLOBAL, "this place");
};

/** Cita corta de un texto, alrededor de lo que provoca el aviso: cortar por delante escondía la causa. */
export const citaTexto = (texto, re = null, ancho = 90) => {
  const t = String(texto ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= ancho) return t;
  const i = re ? t.search(re) : 0;
  const desde = Math.max(0, Math.min(i - Math.floor(ancho / 3), t.length - ancho));
  return `${desde > 0 ? "…" : ""}${t.slice(desde, desde + ancho).trim()}${desde + ancho < t.length ? "…" : ""}`;
};

// Aplica `fn` a todos los textos de la clase, salvo el modelo en inglés y lo fijo del mapa.
const CLAVES_SIN_TEXTO_DE_CLASE = new Set(["textoModelo", "tareasMapa", "fijoDelMapa", "ampliacion"]);
/** Concordancia con «guía» en textos fuera de las clases, como los anexos. */
export const conGuiaEnTextos = (nodo) => {
  Object.entries(nodo || {}).forEach(([k, v]) => {
    if (typeof v === "string") nodo[k] = conGuiaEnFemenino(v);
    else if (v && typeof v === "object") conGuiaEnTextos(v);
  });
  return nodo;
};

const mapearTextos = (nodo, fn, omitir = null) => {
  Object.entries(nodo || {}).forEach(([k, v]) => {
    if (CLAVES_SIN_TEXTO_DE_CLASE.has(k) || omitir?.has(k)) return;
    if (typeof v === "string") nodo[k] = fn(v);
    else if (v && typeof v === "object") mapearTextos(v, fn, omitir);
  });
};
// Valores internos que no lee el docente: no se corrigen («confianza: "revision"»).
const CLAVES_INTERNAS = new Set(["estado", "confianza", "tipo", "id", "clave", "codigo", "criterioId", "indicadorId"]);

/**
 * Aplica la regla a todo el texto de la clase. Devuelve lo que no pudo limpiar;
 * lo que sí limpió va a `corregidos` (el administrador lo ve como corrección automática).
 */
export const sinLugaresEnClase = (dia = {}, corregidos = []) => {
  const restantes = [];
  if (dia.focoLinguistico) dia.focoLinguistico = sinLugaresEnEjemplos(dia.focoLinguistico);
  // Todo el texto de la clase, línea a línea para no aplanar las evidencias con formato.
  mapearTextos(dia, (t) => t.split("\n").map((linea) => {
    const limpio = conLugarGenerico(sinLugaresEnEjemplos(linea));
    if (limpio !== linea) corregidos.push(citaTexto(linea, LUGARES_NO_DECLARADOS));
    return limpio;
  }).join("\n"));
  const revisar = (t) => { if (typeof t === "string" && nombraLugar(t)) restantes.push(citaTexto(t, LUGARES_NO_DECLARADOS)); };
  revisar(dia.focoLinguistico);
  (dia.momentos || []).forEach((m) => {
    [...(m?.actividades || []), ...(m?.metacognicion || []), ...Object.values(m?.evidencias || {}).flat()].forEach(revisar);
  });
  return [...new Set(restantes)];
};

const conMayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);

const UMBRAL_RECOGER_DATOS = 15;
// Verbo de la etiqueta cuando la clase tiene sección principal y la función de la fila es de otra sección.
const ETIQUETA_DE_SECCION = { aplicar: "Practicar", proponer_comparar: "Comparar con un texto la sección", proponer_elegir: "Elegir y justificar para",
  proponer_elaborar: "Escribir el borrador de", proponer: "Elaborar", corregir: "Corregir", visitar: "Preparar", socializar: "Dar a conocer",
  orientar: "Dar indicaciones para", describir: "Analizar un modelo de", analizar: "Organizar lo reunido para", revision: "Mejorar" };
const ETIQUETA_POR_TAREA = { describir_modelo: "Analizar un modelo de", describir_redactar: "Redactar", analizar_ordenar: "Organizar lo reunido para", analizar_borrador: "Escribir el borrador de", analizar_verificar: "Comprobar los datos de" };
// «acordar»: la clase 1 presenta la unidad; la función de la malla puede ser de otro tema («actividades cotidianas» en Frases del aula, revisor de g40a).
const TAREAS_CON_FUNCION_PROPIA = new Set(["acordar", "analizar_ordenar", "problema_analizar", "problema_definir", "problema_objetivos", "saberes_previos"]);
// Gramática que sirve a cada función: pedir ayuda no se hace con «why don't» (que es para sugerir). Revisor de g40a.
// Tercer elemento: estructura que delata la función de otra clase (sugerir con «why don't» en una clase de pedir ayuda).
export const GRAMATICA_DE_FUNCION = [[/ayuda/i, /\b(can|could|may)\b/i, /\bwhy (don['’]?t|not)\b/i], [/consejos|sugerencias/i, /\b(should|let|why don|imperativo|condicional)/i, null]];
const reglaDeFila = (fila) => {
  const funcion = (fila?.contenidos || []).find((c) => c.categoria === "funcionales")?.texto || "";
  return GRAMATICA_DE_FUNCION.find(([f]) => f.test(funcion)) || null;
};
/** Una gramática que no sirve a la función de la clase no va en ella (revisor de g41a). */
export const gramaticaEncaja = (fila, texto) => { const r = reglaDeFila(fila); return !r || r[1].test(String(texto).split(":")[0]); };
/**
 * Lo que la clase escribe con la estructura de otra función: intención, texto modelo, metacognición y actividades.
 * La etiqueta dice «can, may y could» y el modelo pregunta «Why don't we…?» (revisor de g41a). Devuelve la frase o "".
 */
export const estructuraAjenaEnClase = (clase = {}, fila = {}) => {
  const r = reglaDeFila(fila);
  if (!r?.[2]) return "";
  const textos = [clase?.intencionPedagogica, ...(clase?.textoModelo?.lineas || []),
    ...(clase?.momentos || []).flatMap((m) => [...[].concat(m?.metacognicion || []), ...(m?.actividades || []).map((a) => (typeof a === "string" ? a : a?.texto || ""))])];
  return String(textos.find((t) => r[2].test(String(t || ""))) || "");
};

/**
 * Estructura del día: la escribe el código, para que corresponda a la tarea de la clase.
 * Función de la fila y su gramática; sin gramática, la frase fija de la tarea principal.
 */
export const focoDeFila = (fila = {}, filas = [], { heredada = false } = {}) => {
  // Aplicar: nombra la estructura de la clase anterior de la misma sección, no una etiqueta genérica
  // (revisión de g6 y g7, 2026-11-06) ni la función que el reparto le dejó a la clase («why don't» al practicar
  // «Asking for Help», Escuela 3.º, 2026-11-16). Sin clase anterior de esa sección, la suya.
  // Una sola sección: la principal, la misma del título y del modelo (revisor de g49).
  const principal = seccionPrincipal(fila);
  const tareaP = tareaPrincipal(fila);
  const primera = tareaP?.clave || "";
  if (/^aplicar_/.test(primera) && primera !== "aplicar_corregir") {
    const previa = [...filas].reverse().find((f) => f.clase < fila.clase && !f.flexible
      && (principal ? seccionPrincipal(f) === principal && /^aplicar_/.test(tareaPrincipal(f)?.clave || "")
        : f.tareas?.some((t) => /^aplicar_/.test(t.clave) && t.secciones?.some((s) => tareaP.secciones?.includes(s))))
      && (f.contenidos || []).some((c) => ["gramatica", "funcionales"].includes(c.categoria)));
    if (previa) return focoDeFila(previa, filas, { heredada: true });
  }
  // Si la clase reúne el producto, esa es su tarea principal; si tiene sección principal, la tarea de esa sección.
  const clave = primera;
  // Una propuesta se presenta y se defiende: su estructura es justificar la recomendación, no explicar para qué sirve.
  const defiende = ["presentar", "probar_audiencia"].includes(clave) && (fila.tareas || []).some((t) => t.tipoPrueba === "defender");
  const estructuraDeTarea = (fila.tareas || []).find((t) => t.clave === clave)?.estructura || null;
  const fija = defiende ? ["Defender una recomendación", "(_We recommend… because…_)"] : (estructuraDeTarea || ESTRUCTURA_POR_TAREA[clave] || ESTRUCTURA_POR_TAREA[clave.split("_")[0]] || null);
  const textos = (cat) => (fila.contenidos || []).filter((c) => c.categoria === cat).map((c) => c.texto);
  // Tareas cuya acción no la sirve la gramática que el reparto le dio a la clase (organizar datos, entender un problema):
  // su estructura es la de la tarea, no la de otro tema de la malla (Rutinas C8, Problemas C5).
  // La tarea que trae su propia estructura (la encuesta) la usa aunque el reparto le dé gramática de otro tema (revisor de g40a).
  const propia = TAREAS_CON_FUNCION_PROPIA.has(clave) || Boolean(estructuraDeTarea);
  const todasFunciones = propia ? [] : textos("funcionales").map((t) => t.replace(/^Funcional:\s*/i, "").trim());
  // La función de otra sección no va en la etiqueta («Solicitar y ofrecer ayuda» en «Greetings and Goodbyes», g49),
  // ni la gramática que el reparto le dio por esa función (can, may y could).
  const funciones = principal ? todasFunciones.filter((f) => funcionEsDeSeccion(f, principal)) : todasFunciones;
  const reglasAjenas = todasFunciones.filter((f) => !funciones.includes(f)).map((f) => GRAMATICA_DE_FUNCION.find(([r]) => r.test(f))).filter(Boolean);
  let gramatica = (propia ? [] : textos("gramatica")).filter((g) => !reglasAjenas.some((r) => r[1].test(g.split(":")[0])));
  // Si la gramática de la clase no sirve a su función, la de la malla del tema que sí sirve; si no hay, la función sola.
  const regla = GRAMATICA_DE_FUNCION.find(([f]) => f.test(funciones[0] || ""));
  if (regla && !gramatica.some((g) => regla[1].test(g.split(":")[0]))) {
    const otra = filas.flatMap((f) => f.contenidos || []).find((c) => c.categoria === "gramatica" && regla[1].test(c.texto.split(":")[0]));
    if (!otra && gramatica.length) return funciones.slice(0, 2).join("; ");
    if (otra) gramatica = [otra.texto];
  }
  const delTexto = gramatica.map((t) => t.split(":")[0].match(/\bpara (.+)$/)?.[1]).find(Boolean);
  // «Comprar» solo tiene sentido si la unidad pide: en otro tema, will expresa planes.
  const hayPedido = filas.some((f) => f.secciones?.some((x) => PRUEBA_POR_SECCION[x]?.tipo === "pedido"));
  const funcionDelTextoBruta = delTexto && filas.length && !hayPedido && /comprar/i.test(delTexto) ? "Expresar planes" : delTexto;
  const funcionDelTexto = principal && funcionDelTextoBruta && !funcionEsDeSeccion(funcionDelTextoBruta, principal) ? "" : funcionDelTextoBruta;
  // Describir y analizar sin función propia en la malla: la etiqueta nombra la sección que la clase trabaja, no una función
  // de otro tema («actividades cotidianas» en una unidad de frases del aula). Formato aprobado por César, 2026-11-10.
  const secsDeLaTarea = principal ? [principal] : (tareaP?.secciones || []);
  const verboDeSeccion = ETIQUETA_POR_TAREA[clave] || (principal ? ETIQUETA_DE_SECCION[clave] || ETIQUETA_DE_SECCION[clave.split("_")[0]] || "Trabajar" : "");
  const deSeccion = verboDeSeccion && secsDeLaTarea.length >= 1 && secsDeLaTarea.length <= 2
    ? `${verboDeSeccion} ${secsDeLaTarea.map((x) => `«${x}»`).join(" y ")}` : "";
  // Elaborar la pieza de una sección es escribir su borrador: la etiqueta nombra la sección, no la función que el reparto
  // dejó en la clase («Sostener una conversación» en Teacher Instructions); unas instrucciones se escriben en imperativo (revisor de g43).
  if (!heredada && clave === "proponer_elaborar" && secsDeLaTarea.length === 1 && !funciones.length) {
    const seccion = secsDeLaTarea[0];
    const imperativo = /instruc|direction|indicaci|steps|rules|reglas/i.test(seccion)
      && filas.flatMap((f) => f.contenidos || []).some((c) => c.categoria === "gramatica" && /imperativo/i.test(c.texto.split(":")[0]));
    const nombresG = gramatica.map((t) => t.split(":")[0].replace(/\s+(para|en contexto)\b.*$/, "").trim().toLowerCase());
    const estructura = imperativo ? "modo imperativo" : [...new Set(nombresG)].join(", ") || "presente simple";
    return `Escribir el borrador de «${seccion}»: ${estructura}`;
  }
  const funcion = funciones.slice(0, 2).join("; ") || (principal && funcionDelTexto ? conMayuscula(funcionDelTexto.trim()) : "")
    || deSeccion || (funcionDelTexto ? conMayuscula(funcionDelTexto.trim()) : fija?.[0] || "");
  // Unas instrucciones o indicaciones se escriben en imperativo si la malla lo trae (revisor de g43 y g49).
  const imperativoDeSeccion = principal && /instruc|direction|indicaci|steps|rules|reglas/i.test(principal) && !funciones.length
    && filas.flatMap((f) => f.contenidos || []).some((c) => c.categoria === "gramatica" && /imperativo/i.test(c.texto.split(":")[0]));
  if (imperativoDeSeccion) return `${funcion}: modo imperativo`;
  if (!gramatica.length) {
    if (!fija) return funcion;
    // Etiqueta de la sección principal: los ejemplos de la tarea («It has…», «Could you…?») no son de esa sección (g49);
    // la gramática de la malla que sirve a la sección, si la hay (pedir ayuda: can, may y could).
    if (principal && funcion === deSeccion) {
      const regla = SECCION_Y_GRAMATICA.find(([sec]) => sec.test(normal(principal)));
      const gramaticas = filas.flatMap((f) => f.contenidos || []).filter((c) => c.categoria === "gramatica");
      // Hasta dos estructuras de la malla que sirven a la sección (un consejo: should o imperativo, g54a).
      const suyas = regla ? [...new Set(regla[1].map((r) => gramaticas.find((c) => r.test(c.texto.split(":")[0]))).filter(Boolean))].slice(0, 2) : [];
      const nombre = suyas.length ? suyas.map((g) => g.texto.split(":")[0].replace(/\s+(para|en contexto)\b.*$/, "").replace(/\s*\/\s*/g, " / ").trim().toLowerCase()).join(", ") : "presente simple";
      return `${funcion}: ${nombre}`;
    }
    // Describir u ordenar datos usa el presente simple que la malla da para este tema, no el ejemplo de otro.
    if (/^(describir|analizar)/.test(clave)) {
      const delTema = filas.flatMap((f) => f.contenidos || []).find((c) => c.categoria === "gramatica" && /^presente simple/i.test(c.texto));
      // Sin el «para …» de la malla: dice la función de otro tema («referirse a actividades cotidianas» en una unidad de frases del aula).
      if (delTema) return `${funcion || fija[0]}: ${delTema.texto.split(":")[0].replace(/\s+(para|en contexto)\b.*$/, "").trim().toLowerCase()}`;
    }
    return `${funcion || fija[0]}${fija[1].startsWith("(") ? " " : ": "}${fija[1]}`;
  }
  // Sin el ejemplo de la malla: suele ser de otro tema («a pair of boots» en un menú).
  const nombres = gramatica.map((t) => t.split(":")[0].replace(/\s+(para|en contexto)\b.*$/, "").replace(/\s*\/\s*/g, " / ").trim().toLowerCase());
  return `${funcion}: ${nombres.join(", ")}`;
};

// «Explorando…» solo describe clases que exploran: modelos, saberes previos, recorridos (g25: C10 comentar y C14 comprar se titulaban «Explorando…»).
const TAREAS_QUE_EXPLORAN = new Set(["acordar", "saberes_previos", "recorrer_lugares", "visitar_modelo", "describir_modelo", "aplicar_modelo", "problema_analizar", "indagar_contrastar"]);
// Títulos que prometen una acción que la clase no hace (g26/g27: «Probar Platos» en una clase que escribe diálogos de pedidos).
const TITULOS_Y_SUS_TAREAS = [
  [/\b(prueba|probar|probando|probemos|probamos)\b/, ["probar_audiencia", "aplicar_ensayar", "aplicar_corregir", "corregir", "corregir_final", "analizar_verificar", "visitar_entrevistar"]],
  [/\bpresent(a|ar|ando|acion|amos)/, ["presentar", "probar_audiencia", "audiencia_secundaria"]],
];
/** Cambia por el título de la tarea el que no corresponde a la función de la clase. Devuelve si lo cambió. */
export const tituloConLaFuncion = (dia = {}, tituloTarea = "") => {
  const claves = (dia?.tareasMapa || []).map((t) => t.clave);
  const titulo = String(dia?.titulo || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (!tituloTarea || !claves.length || !titulo) return false;
  const muyCorto = String(dia?.titulo || "").trim().split(/\s+/).filter(Boolean).length < 3;
  const exploraSinExplorar = /^explor/.test(titulo) && !TAREAS_QUE_EXPLORAN.has(claves[0]);
  const prometeLoQueNoHace = TITULOS_Y_SUS_TAREAS.some(([re, tareas]) => re.test(titulo) && !claves.some((c) => tareas.includes(c)));
  if (!muyCorto && !exploraSinExplorar && !prometeLoQueNoHace) return false;
  dia.titulo = tituloTarea;
  return true;
};

/** «ayudar al nuevo estudiantes» (g28, Problemas C2): el artículo y «nuevo» van en plural con un sustantivo de personas en plural. Solo este patrón. */
export const conConcordanciaEnTitulo = (titulo = "") => String(titulo).replace(/\b(al|del|el|un) nuev[oa] (estudiantes|alumnos|docentes|maestros|compañeros|visitantes)\b/gi,
  (m, art, nombre) => ({ al: "a los nuevos", del: "de los nuevos", el: "los nuevos", un: "unos nuevos" }[art.toLowerCase()] + " " + nombre));

/** Fases de cada actividad, solo si la clase lleva más de una: su nombre, no su número (César, 2026-11-06). */
export const fasesDeActividades = (fila = {}, tareaIds = []) => {
  const nombres = [...new Set([...(fila.tareas || []).map((t) => t.faseNombre), ...(fila.fases || []).map((f) => f.nombre)])].filter(Boolean);
  if (nombres.length < 2) return null;
  const desarrollo = tareaIds.map((id) => fila.tareas?.[Number(String(id).slice(1)) - 1]?.faseNombre || "");
  return { nombres, Desarrollo: desarrollo, Inicio: {} };
};

/**
 * Qué habilidades diagnostica de verdad la clase 1, leído de sus actividades: el Anexo J no puede prometer
 * lo que la clase no hace. Null si no hay actividades (el anexo usa entonces su plantilla).
 */
export const diagnosticoDeActividades = (actividades = []) => {
  const textos = (actividades || []).map((a) => (typeof a === "string" ? a : Object.values(a || {}).filter((v) => typeof v === "string").join(" "))).filter(Boolean);
  if (!textos.length) return null;
  const hay = (re) => textos.some((t) => re.test(t));
  const habilidades = [
    hay(/escuch\w*[^.]*\b(oraciones|frases)\b|marcan[^.]*\bimagen/i) ? "listening" : "",
    hay(/pregunta[^.]*(\bpareja|voz alta)|(\bpareja|voz alta)[^.]*pregunta|responden[^.]*\b(oral|voz alta)/i) ? "speaking" : "",
    hay(/\bleen\b[^.]*\btexto/i) ? "reading" : "",
    hay(/\bescriben\b[^.]*\boraciones?\b/i) ? "writing" : "",
  ].filter(Boolean);
  // El asunto puede llevar comas («cómo organizar el día entre la escuela, la casa y…»): termina en el verbo que sigue, no en la coma.
  const lectura = textos.map((t) => t.match(/\btexto breve sobre (.+?)(?: y [a-záéíóúñ]{4,}(?:an|en)\b| mientras|:|\.|$)/i)).find(Boolean);
  const NUMEROS = { una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5 };
  const cuantas = textos.map((t) => t.match(/\bescriben\b[^.]*?\b(una|dos|tres|cuatro|cinco)\s+oraciones?\b/i)).find(Boolean);
  return { habilidades, asunto: lectura ? lectura[1].trim() : "", oracionesEscritura: cuantas ? NUMEROS[cuantas[1].toLowerCase()] : 0 };
};

/**
 * Diagnóstico de la clase 1 de una unidad ya redactada (sus fases semanales). Sin mapa de clases, null: el anexo usa su plantilla.
 * No depende de marcas temporales de la clase (`fijoDelMapa` se borra antes de armar los anexos).
 */
export const diagnosticoDeFases = (fases = [], hayMapa = false) => {
  if (!hayMapa) return null;
  const dia = (fases || [])[0]?.dias?.[0];
  return diagnosticoDeActividades((dia?.momentos || []).find((m) => m?.nombre === "Desarrollo")?.actividades);
};

/**
 * Pares de clases cuyos títulos son casi iguales (comparten la mayoría de sus palabras): el docente no distingue
 * una clase de otra. Los iguales del todo ya los trata el control de títulos repetidos.
 */
// Raíz de 6 letras: «Exploración» y «Explorando», «gastronomía» y «gastronómica» cuentan como la misma palabra (g25).
// Verbos de mejora: «Perfeccionando…» y «Refinando…» son el mismo título para el docente (revisor de g40a).
const raizDeTitulo = (w) => (/^(perfecc|refin|mejor|puli|afin|refuer|reforz)/.test(w) ? "mejora" : w.slice(0, 6));
const palabrasDeTitulo = (t) => new Set(String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length > 2).map(raizDeTitulo));
// Palabras que no distinguen un título de otro.
const PALABRAS_GENERICAS = new Set(["nuestr", "entre", "sobre", "para", "desde", "juntos", "juntas"]);
const significativas = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length > 3).map(raizDeTitulo).filter((w) => !PALABRAS_GENERICAS.has(w));
/** Dos títulos casi iguales: mismas palabras (por su raíz) con otro orden, mayúsculas o una preposición distinta (Jaccard ≥ umbral), o que abren con la misma palabra y comparten otra (g26: «Investigadores en acción…» / «Analizando una pieza modelo» y «Analizando un modelo»). */
export const titulosSimilares = (a0, b0, umbral = 0.6, producto = "") => {
  // El nombre del producto no distingue una clase de otra: se quita antes de comparar (revisor de g41a).
  const sinProducto = (t) => (producto && String(producto).trim().length > 3 ? String(t || "").replace(new RegExp(`[«“"‘']?${String(producto).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[»”"’']?`, "ig"), " ") : String(t || ""));
  // Misma función con otra sección («Escribiendo el borrador: «Requesting Assistance»» / «…: «Materials and Work»»): distintos por construcción.
  const citadas = (t) => [...String(t || "").matchAll(/«([^»]+)»/g)].map((m) => m[1].toLowerCase()).filter((x) => !producto || x !== String(producto).trim().toLowerCase()).sort().join("|");
  if (citadas(a0) && citadas(b0) && citadas(a0) !== citadas(b0)) return false;
  const a = sinProducto(a0);
  const b = sinProducto(b0);
  const x = palabrasDeTitulo(a);
  const y = palabrasDeTitulo(b);
  if (!x.size || !y.size) return false;
  if (String(a0).trim().toLowerCase() === String(b0).trim().toLowerCase()) return true;
  const comunes = [...x].filter((w) => y.has(w)).length;
  if (comunes / (x.size + y.size - comunes) >= umbral) return true;
  const sa = significativas(a);
  const sb = significativas(b);
  if (sa.length && sb.length && sa[0] === sb[0] && sa.slice(1).some((w) => sb.slice(1).includes(w))) return true;
  // Con otro verbo al inicio y el resto igual («Perfeccionamiento de frases útiles…» / «Refuerzo de Frases Útiles…»), es el mismo título (revisor de g40a).
  const resto = (l) => new Set(l.slice(1).filter((w) => w !== "mejora"));
  const ra = resto(sa);
  const rb = resto(sb);
  return ra.size >= 2 && ra.size === rb.size && [...ra].every((w) => rb.has(w));
};
/** Título de más de 10 palabras: la parte antes de los dos puntos si tiene de 3 a 10; si no, el de la tarea (revisor de g40a). */
export const tituloCorto = (titulo = "", tituloTarea = "", max = 10) => {
  const palabras = (t) => String(t || "").trim().split(/\s+/).filter(Boolean).length;
  if (palabras(titulo) <= max) return titulo;
  const antes = String(titulo).split(":")[0].trim();
  if (antes !== String(titulo).trim() && palabras(antes) >= 3 && palabras(antes) <= max) return antes;
  return tituloTarea || titulo;
};
/**
 * El texto modelo es de una sección que la clase trabaja (revisión g44, C7: «Welcome» con un modelo de «Asking for
 * Help»). Devuelve la sección que debería nombrar si no nombra ninguna de las de sus tareas, o "".
 */
export const modeloDeOtraSeccion = (clase = {}, fila = {}) => {
  const tm = clase?.textoModelo;
  if (!tm || !(tm.lineas || []).length) return "";
  const seccion = seccionDelModelo(fila);
  if (!seccion) return "";
  // El CONTENIDO del modelo, no su título (revisión g48b: «Asking for Directions» en la clase de «Welcome»).
  return modeloNombraSeccion(seccion, normal((tm.lineas || []).join(" "))) ? "" : seccion;
};
// Función de la malla ↔ sección del producto, por la acción: las secciones del docente no tienen inventario
// («Requesting Assistance» ↔ «Solicitar y ofrecer ayuda»).
const FUNCION_Y_SECCION = [[/ayuda/, /help|assist/], [/permiso/, /permission/], [/salud|despedi|bienvenid/, /greet|goodbye|welcome/],
  [/instruc|indicaci|direcci/, /instruction|direction/], [/consejo|sugerenc|recomend/, /tips?\b|advice|recommend/], [/cortes|anim|elogi/, /polite|encourag/],
  [/opini|comentar/, /comment|opinion/], [/lugar/, /places?\b/], [/material/, /material/]];
// Sección del producto ↔ gramática de la malla que la sirve.
// En orden de preferencia: un consejo se da con «should» antes que con el imperativo (g52a).
const SECCION_Y_GRAMATICA = [[/help|assist|permission/, [/\b(can|could|may)\b/i]], [/tips?\b|advice|recommend/, [/\bshould\b/i, /\blet/i, /\bwhy don/i, /condicional/i, /imperativo/i]]];
const funcionDeFila = (fila = {}) => String((fila.contenidos || []).find((c) => c.categoria === "funcionales")?.texto || "").replace(/^Funcional:\s*/i, "").trim();
/** ¿La función (o la etiqueta) es de la sección? Por su nombre, su inventario o la acción. */
export const funcionEsDeSeccion = (funcion = "", seccion = "") => {
  const f = normal(funcion);
  if (!f || normal(seccion).length < 4) return false;
  return f.includes(normal(seccion)) || seccionNombrada(seccion, f) || FUNCION_Y_SECCION.some(([a, b]) => a.test(f) && b.test(normal(seccion)));
};
const tareaConSeccion = (t) => t && !SIN_SECCION.has(t.clave) && (t.secciones || []).length >= 1 && (t.secciones || []).length <= 3;
/**
 * Sección principal de la clase: una sola, la fija el mapa (revisor de g49). De ella salen el título, la etiqueta,
 * el modelo y la tarea principal. Es la de la tarea principal (la que reúne el producto, o la primera); si la función
 * de la fila es de otra sección que la clase trabaja («Solicitar y ofrecer ayuda» y «Asking for Help»), esa.
 * "" si la clase trabaja el producto entero o no tiene sección.
 */
export const seccionPrincipal = (fila = {}) => {
  // La fija el mapa con el reparto de toda la unidad (asignarPrincipales); sin reparto, se calcula aquí.
  if (typeof fila.seccionPrincipal === "string" && (!fila.seccionPrincipal
    || (fila.tareas || []).some((x) => tareaConSeccion(x) && x.secciones.includes(fila.seccionPrincipal)))) return fila.seccionPrincipal;
  return opcionesPrincipales(fila)[0] || "";
};
/**
 * Secciones que pueden ser la principal de la clase, de la dominante a la menor: la que más minutos ocupa (el título
 * dice lo que la clase hace, revisor de g50: C5 comparaba 23 min «Final Recommendation» y se titulaba «Asking for Help»);
 * empate: la de la función de la fila, luego el orden de las tareas. Vacío si la clase reúne el producto o empieza
 * con una tarea de todo el producto.
 */
export const opcionesPrincipales = (fila = {}) => {
  const t = (fila.tareas || []).find((x) => x.clave === "integrar") || fila.tareas?.[0];
  if (!t || SIN_SECCION.has(t.clave)) return [];
  const funcion = funcionDeFila(fila);
  const minutos = new Map();
  (fila.tareas || []).filter(tareaConSeccion).forEach((x) => x.secciones.forEach((sec) => minutos.set(sec, (minutos.get(sec) || 0) + (Number(x.minutos) || 0) / x.secciones.length)));
  const orden = [...minutos.keys()];
  return orden.sort((a, b) => (minutos.get(b) - minutos.get(a)) || (Number(funcionEsDeSeccion(funcion, b)) - Number(funcionEsDeSeccion(funcion, a))) || (orden.indexOf(a) - orden.indexOf(b)));
};
/**
 * Reparto de las secciones principales en toda la unidad (revisor de g50): cada sección es principal al menos una vez,
 * de preferencia en la clase de su borrador. Primero la de cada clase (función o tarea principal); luego, cada sección que
 * no es principal en ninguna toma una clase donde trabaja y cuya principal ya lo es en otra. Empate: el orden de las clases.
 */
export const asignarPrincipales = (filas = [], secciones = []) => {
  const reales = filas.filter((f) => !f.flexible);
  reales.forEach((f) => { delete f.seccionPrincipal; });
  const opciones = new Map(reales.map((f) => [f, opcionesPrincipales(f)]));
  // Emparejamiento sección → clase (caminos de aumento): cada sección toma una clase donde trabaja, de preferencia
  // donde domina y luego la de su borrador; una clase ya tomada cede si su sección tiene otra.
  const deBorrador = (f, s) => (f.tareas || []).some((t) => tareaConSeccion(t) && t.secciones.includes(s) && [].concat(t.demuestra).includes("P"));
  const dueno = new Map();
  const candidatas = (s) => reales.filter((f) => opciones.get(f).includes(s))
    .sort((a, b) => (opciones.get(a).indexOf(s) - opciones.get(b).indexOf(s)) || (Number(deBorrador(b, s)) - Number(deBorrador(a, s))) || a.clase - b.clase);
  const tomar = (s, vistas) => candidatas(s).some((f) => {
    if (vistas.has(f)) return false;
    vistas.add(f);
    if (!dueno.has(f) || tomar(dueno.get(f), vistas)) { dueno.set(f, s); return true; }
    return false;
  });
  secciones.forEach((s) => tomar(s, new Set()));
  reales.forEach((f) => {
    f.seccionPrincipal = dueno.get(f) || opciones.get(f)[0] || "";
    // Las tareas de la principal van primero, para que las actividades 1 y 2 sean de la sección del título (g52a, C8);
    // solo entre tareas de una sección, y sin cambiar el orden dentro de cada sección.
    const p = f.seccionPrincipal;
    if (p && f.tareas.every(tareaConSeccion) && !f.tareas[0].secciones.includes(p)) {
      f.tareas = [...f.tareas.filter((t) => t.secciones.includes(p)), ...f.tareas.filter((t) => !t.secciones.includes(p))];
      f.entregas = [...new Set(f.tareas.map((t) => t.entrega))];
      f.evidencias = f.tareas.map((t) => ({ tipo: t.evidencia, condicion: t.condicion, individual: t.individual, sumativa: t.sumativa }));
    }
  });
  return filas;
};
/** Secciones secundarias de la clase con actividad propia: las de sus tareas, sin la principal ni las del producto entero. */
export const seccionesSecundarias = (fila = {}, total = 0) => {
  const principal = seccionPrincipal(fila);
  // Las tareas de casi todo el producto (revisar con la rúbrica 5 de 6 secciones) trabajan el conjunto, no una secundaria.
  return [...new Set((fila.tareas || []).filter((t) => (t.secciones || []).length && t.secciones.length <= 3 && (!total || t.secciones.length < total) && !TAREAS_COMPARTIDAS.test(t.clave))
    .flatMap((t) => t.secciones))].filter((s) => s !== principal);
};
export const TOPE_SECUNDARIAS = 2;
// Comentar y revisar con la rúbrica se hacen por estaciones: cada sección con su entregable, sin tope (revisor de g55, opción a).
export const TAREAS_POR_ESTACIONES = new Set(["comentar", "revision_docente"]);
/**
 * Tareas de las secciones secundarias (revisor de g57): las escribe el código, no la IA. Son las de una sección que no es
 * la principal (no las de toda la clase: recorrido, encuesta, acuerdo, revisión). Sin principal, ninguna.
 */
export const tareasSecundarias = (fila = {}) => {
  const principal = seccionPrincipal(fila);
  if (!principal) return [];
  return (fila.tareas || []).filter((t) => (t.secciones || []).length && !t.secciones.includes(principal) && !TAREAS_COMPARTIDAS.test(t.clave)
    && (t.secciones.length <= 3 || TAREAS_POR_ESTACIONES.has(t.clave)));
};
/** Tareas que redacta la IA: las de la principal y las de toda la clase. */
export const tareasDeLaIA = (fila = {}) => { const sec = new Set(tareasSecundarias(fila)); return (fila.tareas || []).filter((t) => !sec.has(t)); };
/**
 * Presupuesto del Desarrollo (revisor de g57): cada secundaria del código entre 5 y 8 min, todas juntas como máximo la mitad;
 * la principal, el resto (al menos la mitad). Devuelve { secundaria, principal } en minutos.
 */
export const presupuestoDesarrollo = (total = 0, secundarias = 0) => {
  if (!secundarias) return { secundaria: 0, principal: total };
  const porSecundaria = Math.max(5, Math.min(8, Math.floor(total / 2 / secundarias)));
  return { secundaria: porSecundaria, principal: total - porSecundaria * secundarias };
};
export const MINUTOS_MINIMOS_ACTIVIDAD = 4;
/**
 * Reparte `minutos` entre `n` actividades de la IA con al menos 4 min cada una (revisor de g57). Si no alcanza, indica
 * cuántas hay que fusionar. Devuelve { minutos: [...], fusionar }.
 */
export const repartoConMinimo = (pesos = [], total = 0, minimo = MINUTOS_MINIMOS_ACTIVIDAD) => {
  const n = pesos.length;
  if (!n) return { minutos: [], fusionar: 0 };
  const caben = Math.max(1, Math.floor(total / minimo));
  if (n > caben) return { minutos: [], fusionar: n - caben };
  const suma = pesos.reduce((a, b) => a + (b > 0 ? b : 1), 0) || n;
  let out = pesos.map((p) => Math.max(minimo, Math.floor(((p > 0 ? p : 1) * total) / suma)));
  let diferencia = total - out.reduce((a, b) => a + b, 0);
  for (let k = 0; diferencia !== 0 && k < 1000; k += 1) {
    const i = diferencia > 0 ? out.indexOf(Math.min(...out)) : out.indexOf(Math.max(...out));
    if (diferencia < 0 && out[i] <= minimo) break;
    out[i] += Math.sign(diferencia); diferencia -= Math.sign(diferencia);
  }
  return { minutos: out, fusionar: 0 };
};
/** Secciones que necesitan actividad propia en la clase: las secundarias y las de comentar o revisar por estaciones. */
export const seccionesConActividad = (fila = {}, total = 0) => {
  const principal = seccionPrincipal(fila);
  return [...new Set([...seccionesSecundarias(fila, total),
    ...(fila.tareas || []).filter((t) => TAREAS_POR_ESTACIONES.has(t.clave)).flatMap((t) => t.secciones || [])])].filter((x) => x !== principal);
};
// Tareas de toda la clase (recorrido, encuesta, acuerdo, saberes previos, revisión): no son de una sección secundaria.
export const TAREAS_COMPARTIDAS = /^(recorrer_|indagar_|acordar|saberes_|revision_|problema_)/;
/**
 * Como máximo 2 secundarias con actividad propia por clase (revisor de g50: Frases C8 comentaba tres secciones además de la
 * suya). Las que sobran pasan a la misma tarea de otra clase de la misma fase con sitio; si no hay, las cubre la clase que
 * revisa el conjunto. Devuelve los movimientos, para avisar.
 */
export const limitarSecundarias = (filas = [], secciones = []) => {
  const movidas = [];
  const reales = filas.filter((f) => !f.flexible);
  const fasesDe = (f) => new Set((f.tareas || []).map((t) => t.fase));
  reales.forEach((f) => {
    let sobran = seccionesSecundarias(f, secciones.length).length - TOPE_SECUNDARIAS;
    while (sobran > 0) {
      const tarea = [...f.tareas].filter((t) => t.secciones.length > 1 && t.secciones.length < secciones.length && !t.secciones.includes(seccionPrincipal(f)))
        .sort((a, b) => b.secciones.length - a.secciones.length)[0];
      if (!tarea) break;
      const seccion = tarea.secciones[tarea.secciones.length - 1];
      // Otra clase de la misma fase, o la siguiente con la misma tarea antes de que la sección se corrija.
      const corregida = reales.find((g) => g.clase > f.clase && g.tareas.some((t) => /corregir|revision/.test(t.clave) && t.secciones.includes(seccion)))?.clase || Infinity;
      const destino = reales.find((g) => g !== f && ([...fasesDe(g)].some((x) => fasesDe(f).has(x)) || (g.clase > f.clase && g.clase <= corregida))
        && g.tareas.some((t) => t.clave === tarea.clave && !t.secciones.includes(seccion))
        && seccionesSecundarias(g, secciones.length).length < TOPE_SECUNDARIAS);
      // Sin clase con sitio, se queda: nunca se pierde el ciclo de una sección.
      if (!destino) break;
      tarea.secciones = tarea.secciones.slice(0, -1);
      destino.tareas.find((t) => t.clave === tarea.clave).secciones.push(seccion);
      movidas.push(`«${seccion}» (${tarea.nombre}): de la clase ${f.clase} a la clase ${destino.clase}`);
      [f, destino].forEach((g) => { g.secciones = [...new Set(g.tareas.flatMap((t) => t.secciones))]; });
      sobran -= 1;
    }
  });
  return movidas;
};
/** La tarea de la sección principal (o la principal de la fila si no hay sección). */
export const tareaPrincipal = (fila = {}) => {
  const s = seccionPrincipal(fila);
  return (s && (fila.tareas || []).find((x) => tareaConSeccion(x) && x.secciones.includes(s)))
    || (fila.tareas || []).find((x) => x.clave === "integrar") || fila.tareas?.[0] || null;
};
/** La sección del título de la clase: la principal. */
export const seccionDelModelo = (fila = {}) => seccionPrincipal(fila);
/**
 * Clase sin sección propia (revisar el conjunto, presentar, responder comentarios): su modelo muestra la estructura del
 * día («This section shows…», «They ask for…»), no un diálogo genérico de pedir ayuda (revisión g48b, C14 y C16).
 * Devuelve la etiqueta si el modelo no usa ninguno de sus ejemplos, o "".
 */
export const modeloSinLaEstructura = (clase = {}, fila = {}, filas = []) => {
  // En toda clase, no solo en las que no tienen sección (revisor de g49: C7 «Teacher Instructions» en imperativo
  // con un modelo de «Could you pass me…?»; C10 «Commenting on Work» sin «I agree…»).
  const tm = clase?.textoModelo;
  if (!tm || !(tm.lineas || []).length) return "";
  const etiqueta = focoDeFila(fila, filas);
  const pruebas = patronesDeEtiqueta(etiqueta);
  if (!pruebas.length) return "";
  return pruebas.some((p) => p(tm.lineas)) ? "" : etiqueta;
};
const VERBOS_IMPERATIVO = /^((please|always|never|just|first|then|now|next|finally),?\s+)?(open|close|take|go|turn|walk|cross|follow|keep|continue|stop|write|read|listen|look|sit|stand|put|give|pass|raise|work|check|use|bring|come|try|let'?s|don'?t|do not|answer|repeat|copy|underline|circle|match|complete|share|ask|tell|show|find|choose|wait|line|clean|pick|hand|start|finish|remember|be|get|move|help|say|talk|practice|draw|label|fill|join|enter|leave|return|visit|make|form|prepare|review|switch|discuss|compare|count|speak|whisper|build|focus|stay|plan|organize|do|eat|sleep|study|arrive|respect|meet|learn|note|pay|drink|wash|smile|greet|thank)\b/;
const lineaSinHablante = (l) => normal(String(l || "").replace(/[’‘]/g, "'")).replace(/^[^:]{1,30}:\s*/, "").replace(/^[^a-z0-9]+/, "");
// Estructuras con nombre en la etiqueta y cómo se reconocen en el modelo.
const ESTRUCTURAS_DE_ETIQUETA = [
  [/imperativo/, null], [/\b(can|could|may)\b/, /\b(can|could|may)\b/], [/\bshould\b/, /\bshould\b/], [/let'?s/, /\blet'?s\b/],
  [/why don'?t|why not/, /\bwhy (don'?t|not)\b/], [/condicional/, /\bif\b|\bwould\b/], [/\bwill\b|futuro/, /\bwill\b|'ll\b/], [/going to/, /\bgoing to\b/],
  [/pasado simple/, /\b(was|were|did)\b|\b[a-z]{3,}ed\b/], [/presente (continuo|progresivo)/, /\b(am|is|are|'m|'re|'s) [a-z]+ing\b/],
];
/**
 * Pruebas de que un modelo usa la estructura de la etiqueta: los ejemplos del paréntesis (sus dos primeras palabras)
 * o las estructuras que nombra (imperativo, can/may/could…). Sin ninguna (solo «presente simple»), no hay prueba.
 */
export const patronesDeEtiqueta = (etiqueta = "") => {
  const e = normal(String(etiqueta).replace(/[’‘]/g, "'"));
  const pruebas = [];
  const ejemplos = (e.match(/_[^_]+_/g) || []).map((x) => x.replace(/[_….?!,]/g, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 2).join(" ")).filter(Boolean);
  ejemplos.forEach((x) => { const r = new RegExp(`\\b${x.replace(/\d+/g, "__N__").replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/__N__/g, "\\d+")}\\b`); pruebas.push((lineas) => r.test(lineas.map(lineaSinHablante).join(" "))); });
  const sinEjemplos = e.replace(/_[^_]+_/g, " ");
  // La estructura va después de los dos puntos; una función de pedir ayuda sin gramática pide can/could/may.
  const estructura = sinEjemplos.includes(":") ? sinEjemplos.split(":").slice(1).join(":") : "";
  ESTRUCTURAS_DE_ETIQUETA.forEach(([nombre, patron]) => {
    if (!nombre.test(estructura)) return;
    // Cada oración de la línea («First, go straight… Then, turn left»), no solo su comienzo.
    if (!patron) pruebas.push((lineas) => lineas.some((l) => lineaSinHablante(l).split(/(?<=[.!?;])\s+/).some((o) => VERBOS_IMPERATIVO.test(o.replace(/^[^a-z0-9]+/, "")))));
    else pruebas.push((lineas) => patron.test(lineas.map(lineaSinHablante).join(" ")));
  });
  if (!pruebas.length && /\bayuda\b/.test(sinEjemplos)) pruebas.push((lineas) => /\b(can|could|may)\b/.test(lineas.map(lineaSinHablante).join(" ")));
  return pruebas;
};
const lineasDeModelo = (lineas = []) => lineas.map((l) => lineaSinHablante(l).replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim()).filter((l) => l.split(" ").length >= 4);
/**
 * Ninguna pareja de clases con el mismo texto modelo (revisor de g49: C11 = C5, C3 = C4): una línea de 4 palabras o más
 * igual a la de otra clase. Devuelve { clase, linea } de la primera repetida, o null.
 */
export const modeloRepetido = (clase = {}, previos = []) => {
  const propias = lineasDeModelo(clase?.textoModelo?.lineas || []);
  if (!propias.length) return null;
  for (const p of previos) {
    const otras = new Set(lineasDeModelo(p?.lineas || []));
    const linea = propias.find((l) => otras.has(l));
    if (linea) return { clase: p.clase, linea };
  }
  return null;
};
/** La apertura de bienvenida («Welcome to Model School!») va solo en la clase 1 y en las de la sección de bienvenida o saludos. */
export const bienvenidaFueraDeLugar = (clase = {}, fila = {}) => {
  if (fila.clase === 1 || /welcome|greet|bienven|salud/i.test(seccionPrincipal(fila))) return "";
  // También el título del modelo (revisor de g55: «Final Recommendation: Welcome to Model School»).
  return (clase?.textoModelo?.lineas || []).find((l) => /\bwelcome to\b/.test(lineaSinHablante(l)))
    || (/\bwelcome to\b/i.test(String(clase?.textoModelo?.titulo || "")) ? String(clase.textoModelo.titulo) : "");
};
/** Título del modelo sin la bienvenida: «Final Recommendation: Welcome to Model School» → «Final Recommendation». */
export const tituloSinBienvenida = (titulo = "", nombreModelo = "Model School") => {
  const limpio = String(titulo).replace(/\s*[:—–-]?\s*welcome to [^:—–]*/i, "").replace(/\s*[:—–-]\s*$/, "").trim();
  return limpio || nombreModelo;
};
// El modelo está en inglés: la sección se reconoce por sus palabras propias o por pistas de su función.
const PISTAS_MODELO = {
  "Asking for Help": "help|could you|can you|may i ask",
  "School Success Tips": "tips?|advice|should|succeed|success|important to|always|never|helps? you|if you",
  "School Directions": "directions?|go straight|turn (left|right)|next to|how do i get",
  "Important Places": "places?|library|cafeteria|office|room|lab|where|is (next to|near)",
  "Final Recommendation": "recommend\\w*|suggest\\w*|should|the best|why don'?t we|if we|we think",
  "Welcome": "welcome",
};
const PALABRAS_COMUNES_SECCION = new Set(["school", "with", "your", "from", "their", "about", "work"]);
/** ¿El texto (normalizado, en inglés) del modelo es de la sección? Nombre, palabras propias (≥ 4 letras), inventario o pistas. */
// Secciones del docente sin pistas propias: se reconocen por la palabra de su nombre (Frases del aula, g50).
const PISTAS_POR_PALABRA = [[/greet|goodbye|welcome/, "hello|hi|good (morning|afternoon|evening)|goodbye|bye|see you|how are you|nice to meet"],
  [/permission/, "(may|can|could) i (go|leave|use|borrow|have|open|close|sit|come|take|get|drink|turn|work|change)|is it ok|permiso"], [/help|assist/, "help|can you|could you|i don'?t understand"],
  [/material/, "pencils?|pens?|books?|notebooks?|erasers?|rulers?|scissors|glue|paper|materials?"],
  [/instruction/, "please (sit|open|close|take|listen|write|read|work)|sit down|open your|close your|listen|raise your hand|work in"],
  [/polite|encourag/, "please|thank|sorry|excuse me|great job|well done|good job|you can do it"], [/comment|feedback/, "i agree|i think|sorry to interrupt|good idea"]];
export const modeloNombraSeccion = (seccion, textoNormal) => {
  if (seccionNombrada(seccion, textoNormal)) return true;
  const porPalabra = PISTAS_POR_PALABRA.find(([r]) => r.test(normal(seccion)));
  if (porPalabra && new RegExp(`\\b(${porPalabra[1]})\\b`).test(String(textoNormal || "").replace(/[’‘]/g, "'").replace(/_/g, " "))) return true;
  const propias = normal(seccion).split(/[^a-z]+/).filter((w) => w.length >= 4 && !PALABRAS_COMUNES_SECCION.has(w));
  if (propias.some((w) => new RegExp(`\\b${w.slice(0, Math.max(4, w.length - 2))}`).test(textoNormal))) return true;
  return PISTAS_MODELO[seccion] ? new RegExp(`\\b(${PISTAS_MODELO[seccion]})\\b`).test(textoNormal) : false;
};
// Un ejemplo en inglés de lo que dice cada sección, por la palabra de su nombre (actividad que escribe el código, g55).
const EJEMPLO_POR_PALABRA = [[/greet|goodbye/, "Good morning!"], [/welcome/, "Welcome to our school!"], [/permission/, "May I go out?"],
  [/help|assist/, "Could you help me, please?"], [/material/, "Can I borrow a pencil?"], [/instruction/, "Open your books, please."],
  [/polite|encourag/, "Great job! Thank you."], [/direction/, "Go straight and turn left."], [/places?\b/, "This is the library."],
  [/tips?\b|advice/, "You should ask questions."], [/recommend/, "We recommend…"], [/comment|feedback/, "I agree…"]];
export const ejemploDeSeccion = (seccion = "") => EJEMPLO_POR_PALABRA.find(([r]) => r.test(normal(seccion)))?.[1] || "";
/**
 * ¿La actividad (texto normalizado) trabaja la sección? Por su nombre, por cómo la llama en español o por sus pistas en
 * inglés (revisor de g55: «frases para pedir permiso» ya es Asking for Permission; no se añade otra actividad).
 */
// Alternativas de nivel superior de una expresión («a|b (c|d)» → «a», «b (c|d)»), para ver qué pista concreta encaja.
const alternativas = (fuente = "") => {
  const partes = []; let nivel = 0; let actual = "";
  for (const ch of String(fuente)) {
    if (ch === "(") nivel += 1; else if (ch === ")") nivel -= 1;
    if (ch === "|" && nivel === 0) { partes.push(actual); actual = ""; } else actual += ch;
  }
  partes.push(actual);
  return partes.filter(Boolean);
};
/** Pistas de una sección, una por una: nombres en español, acción, pistas en inglés y palabras propias del nombre. */
const pistasDeSeccion = (seccion = "") => {
  const n = normal(seccion);
  const fuentes = [
    ...(INVENTARIO_POR_SECCION[seccion]?.nombres ? alternativas(INVENTARIO_POR_SECCION[seccion].nombres) : []),
    ...FUNCION_Y_SECCION.filter(([, b]) => b.test(n)).flatMap(([a]) => alternativas(a.source)),
    ...(PISTAS_MODELO[seccion] ? alternativas(PISTAS_MODELO[seccion]) : []),
    ...PISTAS_POR_PALABRA.filter(([r]) => r.test(n)).flatMap(([, p]) => alternativas(p)),
    ...n.split(/[^a-z]+/).filter((w) => w.length >= 4 && !PALABRAS_COMUNES_SECCION.has(w)).map((w) => w.slice(0, Math.max(4, w.length - 2))),
  ];
  return [...new Set(fuentes)].map((f) => { try { return new RegExp(`\\b(${f})`); } catch { return null; } }).filter(Boolean);
};
/**
 * ¿La actividad (texto normalizado) trabaja la sección? Por su nombre exacto, o por una pista EXCLUSIVA de ella entre las
 * secciones del producto (revisor de g56: «consejos» es de School Success Tips y de Final Recommendation, y «May I…?»
 * de Asking for Permission y de Politeness: no cuentan para ninguna). Sin la lista de secciones, todas sus pistas.
 */
export const seccionCubierta = (seccion, textoNormal, secciones = []) => {
  const t = String(textoNormal || "").replace(/_/g, " ").replace(/[’‘]/g, "'");
  if (t.includes(normal(seccion))) return true;
  const otras = secciones.filter((x) => x !== seccion).map(pistasDeSeccion);
  return pistasDeSeccion(seccion).some((r) => {
    const m = t.match(r);
    return m && !otras.some((ps) => ps.some((r2) => r2.test(m[0])));
  });
};
// Tareas cuyo estado es el borrador: la actividad que las cubre redacta (elegir o justificar no es borrador, g56a C7).
// Las que escriben una pieza (no corregir ni revisar el nivel, que también demuestran producto).
const TAREAS_DE_BORRADOR = /^(describir_redactar|analizar_borrador|proponer_elaborar|socializar_redactar|aplicar_escribir|orientar_instrucciones|visitar_guion)$/;
const VERBO_DE_BORRADOR = /\b(redact|escrib|elabor|reescrib|complet|corrig)/;
/** ¿La actividad hace la tarea de esa sección? La sección (pista exclusiva) y el verbo o la entrega de su estado. */
export const actividadCubreTarea = (textoNormal, t = {}, seccion = "", secciones = []) => {
  const a = String(textoNormal || "");
  if (!seccionCubierta(seccion, a, secciones)) return false;
  if (TAREAS_DE_BORRADOR.test(t.clave || "")) return VERBO_DE_BORRADOR.test(a);
  // Palabras propias de la entrega: «sección», «versión» o «borrador» están en casi todas y no prueban nada.
  const entrega = normal(t.entrega || "").split(/[^a-z]+/).filter((w) => w.length >= 6 && !/^(seccion|secciones|version|borrador|producto|piezas?|carpeta|grupos?)$/.test(w)).map((w) => w.slice(0, 5));
  return (t.senal ? new RegExp(t.senal).test(a) : false) || entrega.some((w) => a.includes(w)) || (!t.senal && !entrega.length);
};
/** Un ejemplo literal de la gramática de la malla copiado en la clase («May I speak to Rosa, please?»). Devuelve la frase o "". */
export const ejemploDeMallaCopiado = (clase = {}, filas = []) => {
  const ejemplos = [...new Set(filas.flatMap((f) => f.contenidos || []).filter((c) => c.categoria === "gramatica")
    .flatMap((c) => String(c.texto).split(":").slice(1).join(":").split(/(?<=[.?!])\s+/))
    .map((e) => normal(e).replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim())
    .filter((e) => e.split(" ").length >= 4))];
  if (!ejemplos.length) return "";
  const textos = [...(clase?.momentos || []).flatMap((m) => m?.actividades || []).map((a) => (typeof a === "string" ? a : a?.texto || "")), ...(clase?.textoModelo?.lineas || [])];
  for (const t of textos) {
    const n = normal(t).replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ");
    const copiado = ejemplos.find((e) => n.includes(e));
    if (copiado) return copiado;
  }
  return "";
};
/** ¿El texto (normalizado) nombra la sección, por su nombre o por su inventario? */
export const seccionNombrada = (seccion, textoNormal) => String(textoNormal || "").includes(normal(seccion))
  || (INVENTARIO_POR_SECCION[seccion]?.nombres ? new RegExp(INVENTARIO_POR_SECCION[seccion].nombres).test(String(textoNormal || "")) : false)
  // Por la acción en español («saludos», «pidiendo ayuda», «cortesía»), como la función (g50, g52a).
  || FUNCION_Y_SECCION.some(([a, b]) => b.test(normal(seccion)) && a.test(String(textoNormal || "")));
/**
 * El título nombra la sección que la clase trabaja: si la de su tarea no aparece en las actividades y la de otra
 * tarea de la clase sí, se toma el título de esa tarea (revisor de g44, C5: «Final Recommendation» en una clase
 * de «Asking for Help»). Sin sección en el título, o si ninguna aparece, el título no cambia.
 */
export const tituloConSeccionTrabajada = (titulo = "", titulosTareas = [], textoActividades = "", producto = "") => {
  const prod = String(nombreCorto(producto) || "").toLowerCase();
  const seccionesDe = (t) => [...String(t || "").matchAll(/«([^»]+)»/g)].map((m) => m[1]).filter((x) => x.toLowerCase() !== prod);
  // Por su nombre o por cómo la llama la clase en español (inventario: «pedir ayuda», «lugares importantes»…).
  const texto = normal(textoActividades);
  const aparece = (t) => seccionesDe(t).some((sec) => seccionNombrada(sec, texto));
  if (!seccionesDe(titulo).length || aparece(titulo)) return titulo;
  return titulosTareas.find((t) => t !== titulo && seccionesDe(t).length && aparece(t)) || titulo;
};
export const titulosParecidos = (titulos = [], umbral = 0.6) => {
  const pares = [];
  titulos.forEach((a, i) => titulos.slice(i + 1).forEach((b, k) => {
    // Los iguales (sin distinguir mayúsculas) los resuelve el generador por su cuenta.
    if (String(a).trim().toLowerCase() !== String(b).trim().toLowerCase() && titulosSimilares(a, b, umbral)) pares.push([i + 1, i + 2 + k]);
  }));
  return pares;
};

// Título de la clase cuando la IA no lo devuelve o se repite: lo escribe el código desde la acción y la sección,
// no con el nombre interno de la tarea. `{p}` = producto; la sección se añade sola si la tarea es de una sección.
const TITULO_POR_TAREA = {
  acordar: "Conociendo el proyecto: {p}", problema_analizar: "Entendiendo el problema y sus causas", problema_definir: "Definiendo el problema", problema_objetivos: "Fijando nuestros objetivos", saberes_previos: "Lo que sabemos y queremos saber", recorrer_lugares: "Recorriendo el centro",
  visitar_modelo: "Conociendo una entrevista modelo", visitar_guion: "Escribiendo el guion", visitar_entrevistar: "Entrevistando",
  visitar_registrar: "Registrando lo que dijeron", visitar_segunda: "Completando los datos que faltan",
  describir_modelo: "Analizando una pieza modelo", describir_redactar: "Redactando la pieza", analizar_ordenar: "Ordenando los datos",
  analizar_borrador: "Escribiendo el borrador", analizar_verificar: "Comprobando los datos", proponer_comparar: "Comparando con un texto",
  proponer_elegir: "Eligiendo y justificando", proponer_elaborar: "Elaborando la pieza", aplicar_modelo: "Usando el modelo",
  aplicar_escribir: "Escribiendo", aplicar_ensayar: "Practicando en parejas", aplicar_anotar: "Practicando y anotando la mejora", aplicar_segundo: "Practicando otra vez en parejas",
  aplicar_corregir: "Corrigiendo lo ensayado", socializar_reunir: "Reuniendo lo hecho", socializar_redactar: "Redactando el mensaje",
  socializar_leer: "Leyendo el mensaje a otro grupo", orientar_recorrido: "Haciendo el recorrido", orientar_instrucciones: "Escribiendo las instrucciones",
  orientar_probar: "Probando las instrucciones", comentar: "Comentando las piezas de los compañeros", corregir: "Corrigiendo", revision_docente: "Revisando con la rúbrica",
  revision_nivel: "Comprobando el nivel satisfactorio", indagar_disenar: "Diseñando la encuesta", indagar_aplicar: "Aplicando la encuesta",
  indagar_contrastar: "Contrastando con una fuente", glosario: "Armando el glosario", integrar: "Revisando el conjunto de {p}", presentar: "Presentando {p} a la audiencia",
  probar_audiencia: "Probando {p} con la audiencia", audiencia_secundaria: "Mostrando {p} a otra audiencia", evaluar_comentarios: "Respondiendo a los comentarios",
  corregir_final: "Corrigiendo {p}", evaluar_proceso: "Reflexionando sobre lo aprendido",
};
const SIN_SECCION = new Set(["comentar", "acordar", "problema_analizar", "problema_definir", "problema_objetivos", "saberes_previos", "recorrer_lugares", "glosario", "integrar", "presentar", "probar_audiencia", "audiencia_secundaria", "evaluar_comentarios", "corregir_final", "evaluar_proceso", "indagar_disenar", "indagar_aplicar", "indagar_contrastar", "revision_docente", "revision_nivel"]);
/** Títulos posibles de la clase, uno por tarea (la primera manda): para reemplazar un título que se parece a otro. */
export const titulosDeTareas = (fila = {}, producto = "") => {
  // Con sección principal, solo las tareas de esa sección: el título nunca cambia de sección (revisor de g49).
  const s = seccionPrincipal(fila);
  const tareas = s ? (fila.tareas || []).filter((t) => tareaConSeccion(t) && t.secciones.includes(s)) : (fila.tareas || []);
  return [...new Set(tareas.map((t) => tituloDeClase({ ...fila, tareas: [t] }, producto, s)).filter(Boolean))];
};

/**
 * Título de la clase: lo escribe el código desde la función de la tarea principal y su sección (revisor de g42a),
 * como las observaciones y las adaptaciones. Si la clase reúne el producto, esa es su tarea principal (como en focoDeFila).
 */
export const tituloDeClase = (fila = {}, producto = "", seccion = "") => {
  // Una sola sección en el título: la principal (revisor de g49: «Final Recommendation» con etiqueta de pedir ayuda).
  const s = seccion || seccionPrincipal(fila);
  const t = (s && (fila.tareas || []).find((x) => tareaConSeccion(x) && x.secciones.includes(s))) || tareaPrincipal(fila);
  if (!t) return "";
  const corto = nombreCorto(producto);
  const p = corto ? `«${corto}»` : "el producto";
  const base = (TITULO_POR_TAREA[t.clave] || `${t.nombre.charAt(0).toUpperCase()}${t.nombre.slice(1)}`).replace("{p}", p);
  const secs = t.secciones || [];
  if (s && tareaConSeccion(t)) return `${base}: «${s}»`;
  // Muchas secciones y un título de una palabra («Corrigiendo»): nombra que trabaja las secciones (g47, C17).
  return !SIN_SECCION.has(t.clave) && secs.length > 3 && !/\s/.test(base) ? `${base} las secciones de ${p}` : base;
};

const ADJETIVOS_DE_GUIA = "alimentari|complet|nuev|corregid|revisad|terminad|escrit|propuest|impres|comunitari|bilingüe|práctic|rápid|sencill|clar|list";
/** Concordancia con «guía» cuando es el producto, no una persona. */
export const conGuiaEnFemenino = (t) => String(t)
  .replace(/\b([Nn])uestro ([Gg]u[ií]a)\b/g, "$1uestra $2")
  .replace(/\b([Ee])ste ([Gg]u[ií]a)\b/g, "$1sta $2")
  .replace(/\bdel ([Gg]u[ií]a)\b(?! tur)/g, "de la $1")
  .replace(/\bal ([Gg]u[ií]a)\b(?! tur)/g, "a la $1")
  .replace(/\bEl ([Gg]u[ií]a)\b(?! tur)/g, "La $1")
  .replace(/\bel ([Gg]u[ií]a)\b(?! tur)/g, "la $1")
  // Lleva «la guía»: el adjetivo también concuerda. Lista cerrada: «guía modelo» o «guía como» no cambian.
  // También con mayúscula inicial («Nuestra Guía Alimentario») y con varios adjetivos seguidos («Guía Alimentaria Comunitario»).
  .replace(new RegExp(`\\b((?:la|nuestra|esta|una) gu[ií]a(?: (?:${ADJETIVOS_DE_GUIA})a)*) (${ADJETIVOS_DE_GUIA})o\\b`, "gi"), "$1 $2a")
  .replace(new RegExp(`\\b((?:la|nuestra|esta|una) gu[ií]a(?: (?:${ADJETIVOS_DE_GUIA})a)*) (${ADJETIVOS_DE_GUIA})o\\b`, "gi"), "$1 $2a");

// Palabras frecuentes en títulos e intenciones; no es un corrector completo, que pediría un diccionario.
const PALABRAS_FRECUENTES = ["nuestro", "nuestra", "nuestros", "nuestras", "clase", "unidad", "sección", "secciones", "entrevista", "presentación", "corrección", "redacción", "revisión", "comunidad", "comunitario", "comunitaria", "estudiantes", "planificación"];
const faltaUnaLetra = (corta, larga) => larga.length === corta.length + 1 && [...larga].some((_, i) => larga.slice(0, i) + larga.slice(i + 1) === corta);
/** Corrige la errata de una letra de menos en esas palabras («nuesros» → «nuestros»). */
const sinTilde = (p) => p.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const TILDES = new Map(["diálogo", "diálogos", "sección", "presentación", "corrección", "redacción", "revisión", "planificación", "información", "evaluación", "análisis", "también", "además", "organización", "retroalimentación", "creación", "acción", "adecuación", "interacción", "comunicación", "orientación", "construcción", "producción", "comprensión", "expresión", "reflexión", "discusión", "decisión", "versión", "sesión", "atención", "observación", "conclusión", "recomendación", "instrucción", "instrucciones", "ejecución", "situación", "intención", "articulación", "participación", "investigación", "población"].map((p) => [sinTilde(p), p]));
/** Tilde mal puesta o que falta en palabras frecuentes («Dialógo» → «Diálogo»). No es un diccionario. */
// Errores que el modelo repite y que no son una letra de menos («corrigida», del portugués): se cambian palabra por palabra.
const ERRATAS_CONOCIDAS = new Map([["corrigida", "corregida"], ["corrigido", "corregido"], ["corrigidas", "corregidas"], ["corrigidos", "corregidos"]]);
export const conTildesCorregidas = (t = "") => String(t).replace(/(?<![\p{L}\d_-])\p{L}{4,}(?![\p{L}\d_-])/gu, (palabra) => {
  const correcta = TILDES.get(sinTilde(palabra)) || ERRATAS_CONOCIDAS.get(sinTilde(palabra));
  if (!correcta || palabra.toLowerCase() === correcta) return palabra;
  return palabra[0] === palabra[0].toUpperCase() ? correcta[0].toUpperCase() + correcta.slice(1) : correcta;
});
// Erratas fijas que no son de una letra (revisión g44: «pisarrón»).
const ERRATAS_FIJAS = [[/\bpisarr[oó]n(es)?\b/gi, (m, pl) => `${m[0] === "P" ? "P" : "p"}izarr${pl ? "ones" : "ón"}`]];
export const conErratasCorregidas = (t = "") => ERRATAS_FIJAS.reduce((acc, [re, f]) => acc.replace(re, f), String(t)).replace(/\p{L}{4,}/gu, (palabra) => {
  const baja = palabra.toLowerCase();
  const correcta = PALABRAS_FRECUENTES.find((p) => faltaUnaLetra(baja, p));
  if (!correcta || PALABRAS_FRECUENTES.includes(baja)) return palabra;
  return palabra[0] === palabra[0].toUpperCase() ? correcta[0].toUpperCase() + correcta.slice(1) : correcta;
});

/** Título en inglés: sin palabras del español y con palabras del inglés. */
/** Portugués: la IA a veces cambia de idioma. Letras que el español no usa. */
export const textoEnPortugues = (t = "") => /[ãõçÃÕÇ]|\b(escolh|saud[aá]ve|voc[eê]\b|n[aã]o\b)/i.test(t);
export const tituloEnIngles = (t = "") => !/\b(de|del|la|las|el|los|y|con|para|en|un|una|al|por|sobre|nuestro|nuestra|nuestros|nuestras)\b/i.test(t) && /\b(and|the|of|with|for|to|our|choices?|made|easy|better|healthy|healthier|tips|how|why|what|new|good|best)\b|\b[a-z]+ing\b/i.test(t);

/** Correcciones de una unidad (por ejemplo, el plural cuando la fuente es una sola persona). */
export const conReemplazos = (dia = {}, reemplazos = []) => {
  const aplicar = (t) => (typeof t === "string" ? reemplazos.reduce((s, [re, nuevo]) => s.replace(re, nuevo), t) : t);
  if (dia.titulo) dia.titulo = aplicar(dia.titulo);
  if (dia.textoModelo?.titulo) dia.textoModelo.titulo = aplicar(dia.textoModelo.titulo);
  if (Array.isArray(dia.textoModelo?.lineas)) dia.textoModelo.lineas = dia.textoModelo.lineas.map(aplicar);
  (dia.momentos || []).forEach((m) => {
    if (Array.isArray(m?.actividades)) m.actividades = m.actividades.map(aplicar);
    if (Array.isArray(m?.metacognicion)) m.metacognicion = m.metacognicion.map(aplicar);
    Object.entries(m?.evidencias || {}).forEach(([k, l]) => { if (Array.isArray(l)) m.evidencias[k] = l.map(aplicar); });
  });
  return dia;
};

/** Títulos de la clase: concordancia con «guía» y un texto modelo no se llama «simulado». */
export const conTitulosCorregidos = (dia = {}, { modeloFicticio = false, nombreModelo = "", tituloTarea = "", corregidos = [] } = {}) => {
  const guia = conGuiaEnFemenino;
  if (dia.titulo && tituloTarea && (tituloEnIngles(dia.titulo.split(":")[0]) || textoEnPortugues(dia.titulo))) {
    if (textoEnPortugues(dia.titulo)) corregidos.push(`título fuera de español: «${citaTexto(dia.titulo, null, 60)}»`);
    dia.titulo = tituloTarea;
  }
  // Todo el texto de la clase: las evidencias y su trazabilidad repetían «del guía».
  let concordancias = 0;
  mapearTextos(dia, (t) => {
    const nuevo = guia(t);
    if (nuevo !== t) concordancias += 1;
    return nuevo;
  });
  if (concordancias) corregidos.push(`concordancia de «guía» (${concordancias} texto${concordancias > 1 ? "s" : ""})`);
  // Todo el texto que lee el docente (menos los modelos en inglés): los valores internos («requiere_revision») no se tocan.
  let tildes = 0;
  mapearTextos(dia, (t) => {
    const nuevo = conTildesCorregidas(t);
    if (nuevo !== t) tildes += 1;
    return nuevo;
  }, CLAVES_INTERNAS);
  if (tildes) corregidos.push(`tildes (${tildes} texto${tildes > 1 ? "s" : ""})`);
  // La IA marca el nombre del producto con acentos graves (`Useful Classroom Phrases Talk`): en el título van comillas.
  // El título ya se muestra entre comillas: las internas pasan a « » (g24, C10: «Revisión y Corrección Final de "Our School Survival Guide"»).
  if (typeof dia.titulo === "string" && /["“”]/.test(dia.titulo)) {
    dia.titulo = dia.titulo.replace(/["“”]([^"“”]+)["“”]/g, "«$1»").replace(/["“”]/g, "");
    corregidos.push("título con comillas dobles: se pasaron a « »");
  }
  if (typeof dia.titulo === "string" && dia.titulo.includes("`")) {
    dia.titulo = dia.titulo.replace(/`([^`]+)`/g, "«$1»").replace(/`/g, "");
    corregidos.push("título con acento grave: se pasó a comillas");
  }
  if (dia.titulo) dia.titulo = conErratasCorregidas(dia.titulo);
  if (dia.intencionPedagogica) dia.intencionPedagogica = conErratasCorregidas(dia.intencionPedagogica);
  if (dia.textoModelo?.titulo) dia.textoModelo.titulo = conTildesCorregidas(guia(dia.textoModelo.titulo)).replace(/\b[Ee]ntrevista simulada\b/gi, "Entrevista modelo");
  // Sin ficha, el modelo declara que su centro es ficticio.
  if (modeloFicticio && dia.textoModelo?.lineas?.length && !/model school/i.test(dia.textoModelo.titulo || "")) {
    dia.textoModelo.titulo = `Model School${dia.textoModelo.titulo ? ` — ${dia.textoModelo.titulo}` : ""}`;
  }
  // Fuera de esos casos, el modelo también se declara ejemplo: la clase aún no tiene los datos reales.
  if (!modeloFicticio && nombreModelo && dia.textoModelo?.lineas?.length && !/\bmodelo?\b/i.test(dia.textoModelo.titulo || "")) {
    dia.textoModelo.titulo = `${nombreModelo}${dia.textoModelo.titulo ? ` — ${dia.textoModelo.titulo}` : ""}`;
  }
  (dia.momentos || []).forEach((m) => {
    if (Array.isArray(m?.actividades)) m.actividades = m.actividades.map((a) => (typeof a === "string" ? a.replace(/^Reúnan\b/, "Reúnen") : a));
  });
  // «$RD200» o «RD 200» es pesos con el formato cambiado.
  const conMoneda = (t) => String(t).replace(/\$\s?RD\s?(?=\d)|\bRD\s?\$\s(?=\d)/g, "RD$");
  if (Array.isArray(dia.textoModelo?.lineas)) dia.textoModelo.lineas = dia.textoModelo.lineas.map(conMoneda);
  mapearTextos(dia, conMoneda);
  return dia;
};

/** Nadie graba (César, 2026-11-04): lo «grabado» que dejó la IA pasa a observado y anotado. */
export const sinGrabado = (momentos = []) => {
  momentos.forEach((m) => {
    if (Array.isArray(m?.actividades)) m.actividades = m.actividades.map((a) => (typeof a === "string" ? sinGrabadoEn(a) : a));
    (m?.actividadesDetalle || []).forEach((d) => { if (typeof d?.texto === "string") d.texto = sinGrabadoEn(d.texto); });
    Object.entries(m?.evidencias || {}).forEach(([k, l]) => {
      if (Array.isArray(l)) m.evidencias[k] = l.map((e) => (typeof e === "string" ? sinGrabadoEn(e) : e));
    });
  });
};

// El diagnóstico tiene cuatro partes: ocupa dos tercios del tiempo (criterio de DocenteOS, sin medir).
// Se reconoce por sus partes (Anexo J), sin contar la organización entre paréntesis.
const DIAGNOSTICO = /diagnostic|^(escuchan|leen|escriben|responden)\b/;

/** Minutos de la clase que solo acuerda y diagnostica. Null si no se distingue el diagnóstico. */
export const minutosConDiagnostico = (actividades = [], total = 0) => {
  const esDiagnostico = actividades.map((a) => DIAGNOSTICO.test(normal(typeof a === "string" ? a : Object.values(a || {}).join(" ")).replace(/\([^)]*\)/g, " ").trim()));
  const cuantos = esDiagnostico.filter(Boolean).length;
  const otras = actividades.length - cuantos;
  if (!cuantos || !otras) return null;
  const paraDiagnostico = Math.round((total * 2) / 3);
  const minutos = esDiagnostico.map((d) => Math.floor(d ? paraDiagnostico / cuantos : (total - paraDiagnostico) / otras));
  minutos[esDiagnostico.indexOf(true)] += total - minutos.reduce((s, m) => s + m, 0);
  return minutos;
};

/**
 * Inicio de la clase 1: las mismas 5 posiciones de siempre, orientadas a presentar la
 * unidad (César, 2026-11-05). La presentación continúa en el Desarrollo. Lo escribe el código.
 */
export const inicioPresentacion = (inicio = [], { producto = "", secciones = [], semillaId = "" } = {}) => {
  const nombre = nombreCorto(producto) || "el producto";
  return [
    inicio[0],
    INICIO_PRIMERA_CLASE,
    `Recuperación de saberes previos: escuchan la situación de aprendizaje, leída por el docente o un compañero, y dan ejemplos del problema que conocen. (${PREGUNTA_SITUACION_POR_SEMILLA[semillaId] || PREGUNTA_SITUACION_GENERAL})`,
    `Observan cómo será ${nombre}${secciones.length ? ` y sus secciones (${secciones.join(", ")})` : ""}, y dicen para qué creen que servirá.`,
    "Escuchan la intención pedagógica y el propósito de la clase: conocer la unidad, acordar cómo trabajarán y cómo se evaluará, y hacer el diagnóstico.",
  ];
};

/** Minutos del Inicio de la clase 1: la lectura lleva 4 sin aumentar el total del momento. */
export const minutosInicioPresentacion = (total = 0) => {
  if (total < 5) return null;
  const lectura = Math.min(4, Math.max(1, total - 4));
  const resto = total - lectura;
  const minutos = [0, 1, 3, 4].reduce((m, i) => ({ ...m, [i]: Math.floor(resto / 4) }), { 2: lectura });
  [1, 3, 0, 4].slice(0, resto % 4).forEach((i) => { minutos[i] += 1; });
  return [0, 1, 2, 3, 4].map((i) => minutos[i]);
};

/** La firma que promete la tarea la escribe el código, en la actividad de esa tarea. */
export const conFirmas = (actividades, tareasMapa = [], tareaIds = []) => {
  const lista = [...actividades];
  tareasMapa.forEach((t, i) => {
    const { firma, senal } = DETALLE_TAREA[t.clave] || {};
    if (!firma || !lista.length) return;
    const texto = (a) => normal(typeof a === "string" ? a : Object.values(a || {}).join(" "));
    const porSenal = lista.findIndex((a) => new RegExp(senal).test(texto(a)));
    // Con tareaId, la última actividad de esa tarea; sin él, como antes.
    const porTarea = tareaIds.length === lista.length ? tareaIds.lastIndexOf(`T${i + 1}`) : -1;
    const donde = porTarea >= 0 ? porTarea : (lista.length === tareasMapa.length ? i : (porSenal >= 0 ? porSenal : lista.length - 1));
    if (/\bfirm/.test(texto(lista[donde])) || typeof lista[donde] !== "string") return;
    lista[donde] = `${lista[donde].trim()} ${firma}`;
  });
  return lista;
};

const semillaVersion = (t) => [...String(t)].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
const enLista = (l) => l.join(", ").replace(/, ([^,]*)$/, " y $1");
const conContraccion = (t) => t.replace(/\b([Aa]) el\b/g, "$1l").replace(/\b([Dd])e el\b/g, "$1el");

/** Reparte los minutos de cada tarea entre sus pasos, respetando el peso de cada uno. */
const minutosDePasos = (pasos, tareas) => {
  const minutos = pasos.map(() => 0);
  tareas.forEach((tarea, k) => {
    const suyos = pasos.map((x, i) => ({ x, i })).filter(({ x }) => x.t === k);
    const peso = suyos.reduce((s, { x }) => s + x.m, 0);
    let usados = 0;
    suyos.forEach(({ x, i }, n) => {
      const valor = n === suyos.length - 1 ? tarea.minutos - usados : Math.round((x.m * tarea.minutos) / peso);
      minutos[i] = valor;
      usados += valor;
    });
  });
  return minutos;
};

/**
 * Pone en cada fila su secuencia del banco, si todas sus tareas la tienen: una tarea sola
 * da todos sus pasos; varias, los esenciales de cada una. La versión varía por unidad y
 * clase. Sin secuencia, o si la entrevista no es con invitado, la clase sigue con la IA.
 */
export const ponerSecuencias = (mapa, { producto = "", tema = "", asunto = "", fuente = "", audiencia = "", invitado = "", entrega = "", semilla = "" } = {}) => {
  // La fuente que se contrasta se nombra en los pasos y en los recursos de su clase.
  const nombreFuente = fuente || `una fuente sobre ${asunto || tema}`;
  const datosEncuesta = DATOS_ENCUESTA[mapa.estrategia] || DATOS_ENCUESTA.indagacion_dialogica;
  // Banco de frases: la encuesta pregunta qué frases les cuesta usar, no cómo usar el producto (revisor de «Frases del aula»).
  const frases = mapa.filas.some((f) => f.tareas.some((t) => t.tipoPrueba === "frases"));
  const asuntoEncuesta = frases ? "qué frases les cuesta usar en clase" : (asunto || tema);
  mapa.filas.forEach((fila) => fila.tareas.filter((t) => t.clave === "indagar_contrastar").forEach((t) => {
    t.recursos = { ...t.recursos, didacticos: String(t.recursos?.didacticos || "").replace("Fuente impresa que trae el docente", `Fuente impresa: ${nombreFuente}`) };
  }));
  const claveBanco = (t) => {
    if (t.clave === "probar_audiencia") return `probar_audiencia:${t.tipoPrueba || "general"}`;
    if (t.clave === "presentar" && t.tipoPrueba === "defender") return "presentar:defender";
    if (t.clave === "proponer_elegir" && mapa.estrategia === "problemas") return "proponer_elegir:problemas";
    if (t.clave === "acordar" && mapa.estrategia === "proyectos") return "acordar:proyectos";
    return t.clave;
  };
  mapa.filas.forEach((fila) => {
    if (!fila.tareas.length || fila.tareas.some((t) => t.paralelo || !SECUENCIAS_POR_TAREA[claveBanco(t)])) return;
    if (fila.tareas.some((t) => t.clave === "visitar_entrevistar") && fila.modalidad !== "invitado") return;
    const pasos = fila.tareas.flatMap((t, k) => {
      const versiones = SECUENCIAS_POR_TAREA[claveBanco(t)];
      const version = versiones[(semillaVersion(semilla) + fila.clase) % versiones.length];
      return (fila.tareas.length > 1 ? version.filter((x) => x.e) : version).map((x) => ({ ...x, t: k }));
    });
    const minutos = minutosDePasos(pasos, fila.tareas);
    const datos = enLista(fila.datosRecoge || []) || "lo que falta";
    const expresiones = fila.contenidos.map((c) => c.texto);
    // La audiencia se nombra completa una vez por clase; después, «la audiencia».
    let audienciaDicha = false;
    fila.secuencia = pasos.map((x, i) => ({
      tarea: x.t,
      minutos: minutos[i],
      pista: (x.usa && expresiones.filter((t) => x.usa.test(normal(t))).slice(0, 2).join(" · ")) || x.pista,
      texto: conContraccion(x.texto
        .replaceAll("{producto}", nombreCorto(producto))
        .replaceAll("{tema}", tema)
        .replaceAll("{asunto}", fila.tareas.some((t) => t.clave.startsWith("indagar_")) ? asuntoEncuesta : (asunto || tema))
        .replaceAll("{fuente}", nombreFuente)
        .replaceAll("{poblacion}", datosEncuesta.poblacion)
        .replaceAll("{preguntas}", datosEncuesta.preguntas)
        .replaceAll("{pregunta}", datosEncuesta.pregunta)
        .replaceAll("{respuestas}", datosEncuesta.respuestas)
        .replaceAll("{cifras}", datosEncuesta.cifras)
        .replaceAll("{cuantas}", datosEncuesta.cuantas || "4 o 5")
        .replaceAll("{decide}", String(datosEncuesta.decide || "").replaceAll("{producto}", nombreCorto(producto)))
        .replace(/\{audiencia\}/g, () => {
          if (audienciaDicha || !audiencia) return "la audiencia";
          audienciaDicha = true;
          return audiencia;
        })
        .replaceAll("{invitado}", invitado || "la persona entrevistada")
        .replaceAll("{entrega}", entrega)
        .replaceAll("{datos}", datos)),
    }));
  });
  return mapa;
};

// El nombre del producto o de una sección no es una frase de ejemplo: rellenaba el hueco.
const esNombreDelProducto = (frase, nombres) => {
  const limpia = normal(frase).replace(/[^a-z0-9]+/g, " ").trim();
  return nombres.some((n) => normal(nombreCorto(n)).replace(/[^a-z0-9]+/g, " ").trim() === limpia);
};

/** Los pasos del banco con lo que puso la IA en {frases}. Sin frase, el hueco desaparece. */
export const pasosConFrases = (secuencia = [], respuesta = [], { sinLugares = false, nombres = [], ejemplosEtiqueta = [], tareaEtiqueta = null } = {}) => secuencia.map((paso, i) => {
  const r = respuesta[i];
  // Solo lo que está en cursiva: a veces la IA repite el paso entero en el hueco.
  const crudo = String((typeof r === "string" ? r : r?.frases) || "");
  // Si la etiqueta del día trae ejemplos, el paréntesis usa su estructura (revisión g44, C16: «Excuse me, could you
  // tell me…?» con la etiqueta «They ask for…, We should change…»): la frase empieza como alguno de ellos.
  const inicio = (f) => normal(String(f).replace(/_/g, "")).trim().split(/\s+/)[0] || "";
  // Solo en los pasos de la tarea que da la etiqueta: los demás tienen su propia lengua (el diagnóstico, la encuesta).
  const delaEtiqueta = tareaEtiqueta === null || paso.tarea === tareaEtiqueta;
  const inicios = new Set((delaEtiqueta ? ejemplosEtiqueta || [] : []).map(inicio).filter(Boolean));
  // Guiar a alguien: el ejemplo es una indicación (imperativo de dirección), no una descripción (revisión g48b, C15).
  const guia = /indican el camino|dan indicaciones|gu[ií]an .* de un lugar a otro/i.test(paso.texto);
  const esIndicacion = (f) => /^(go|turn|walk|take|cross|follow|keep|continue|stop)\b/i.test(String(f).replace(/_/g, "").trim());
  const frases = (crudo.match(/_[^_]{2,80}_/g) || []).filter((f) => /\p{L}{2}/u.test(f) && (!sinLugares || !LUGARES_NO_DECLARADOS.test(f)) && !esNombreDelProducto(f, nombres)
    && (!inicios.size || inicios.has(inicio(f))) && (!guia || esIndicacion(f))).slice(0, 2).join(", ");
  return frases ? paso.texto.replace("{frases}", frases) : paso.texto.replace(/\s*\(\{frases\}\)/, "");
});

// Solo redactar la pieza o la prueba con la audiencia pueden pasar del tope (revisión g48b); leer, comparar, comentar o
// elaborar una lista no (revisor de g49: 18 min para «Elaboran una lista de fortalezas y una mejora»).
const ACTIVIDAD_LARGA = /^(redactan|presentan|acompa[nñ]an|gu[ií]an)\b|borrador|con la audiencia|invitados|versi[oó]n final/i;
/**
 * Ajusta los minutos del Desarrollo al total y a un tope por actividad (revisión g48b: «Escriben dos preguntas» 18 min).
 * La diferencia con el total se reparte en proporción, no se carga a la última; ninguna actividad pasa de `tope`
 * salvo las de producción extensa o de prueba con la audiencia, y el sobrante va en proporción a las demás.
 */
export const minutosConTope = (minutos = [], actividades = [], total = 0, tope = 12) => {
  if (!minutos.length) return minutos;
  const texto = (a) => String(typeof a === "string" ? a : a?.texto || "");
  const larga = minutos.map((_, i) => ACTIVIDAD_LARGA.test(texto(actividades[i])));
  // Reparte `cantidad` entre los índices `donde`, en proporción a `peso`, con enteros que suman exacto.
  const repartir = (base, cantidad, donde, peso) => {
    const suma = donde.reduce((s, i) => s + (peso[i] || 1), 0) || 1;
    const partes = donde.map((i) => ({ i, v: (cantidad * (peso[i] || 1)) / suma }));
    const out = [...base];
    let resto = cantidad;
    partes.forEach((p) => { const e = Math.trunc(p.v); out[p.i] += e; resto -= e; });
    partes.sort((a, b) => Math.abs(b.v - Math.trunc(b.v)) - Math.abs(a.v - Math.trunc(a.v)));
    for (let k = 0; resto !== 0 && partes.length; k += 1) { const p = partes[k % partes.length]; const paso = Math.sign(resto); if (out[p.i] + paso >= 1) { out[p.i] += paso; resto -= paso; } }
    return out;
  };
  let out = [...minutos];
  const diferencia = (total || out.reduce((s, m) => s + m, 0)) - out.reduce((s, m) => s + m, 0);
  if (diferencia) out = repartir(out, diferencia, out.map((_, i) => i), out);
  for (let vuelta = 0; vuelta < 4; vuelta += 1) {
    const sobra = out.reduce((s, m, i) => s + (!larga[i] && m > tope ? m - tope : 0), 0);
    if (!sobra) break;
    out = out.map((m, i) => (!larga[i] && m > tope ? tope : m));
    let destino = out.map((_, i) => i).filter((i) => larga[i] || out[i] < tope);
    if (!destino.length) destino = out.map((_, i) => i);
    out = repartir(out, sobra, destino, out);
  }
  return out;
};

/**
 * Minutos de cada actividad según su tarea: los de la tarea, repartidos entre sus
 * actividades. Null si algún código falta o no existe, o si una tarea no tiene actividad.
 */
export const minutosPorTarea = (tareasMapa = [], tareaIds = []) => {
  if (!tareasMapa.length || !tareaIds.length) return null;
  const indice = tareaIds.map((id) => Number(String(id).match(/^T(\d+)$/)?.[1]) - 1);
  if (indice.some((k) => !tareasMapa[k])) return null;
  if (tareasMapa.some((_, k) => !indice.includes(k))) return null;
  const vistas = {};
  return indice.map((k) => {
    const total = indice.filter((x) => x === k).length;
    const orden = (vistas[k] = (vistas[k] ?? -1) + 1);
    const base = Math.floor(tareasMapa[k].minutos / total);
    return base + (orden < tareasMapa[k].minutos - base * total ? 1 : 0);
  });
};

/**
 * Alcance de la semilla (invitado, entrega, recursos humanos), salvo que el docente haya cambiado la audiencia:
 * lo que escribió él nunca lo pisa la semilla (unidad de frases del aula, g19: «estudiantes de 6.º» en Recursos).
 */
/**
 * La semilla de la situación, salvo que el docente haya escrito su propia situación con otro producto: entonces los textos que dependen de la
 * semilla (asunto de la lectura, fuente, modelo, pregunta de la clase 1) no valen y se usan los generales
 * (unidad de frases del aula, g21: el diagnóstico hablaba de «cómo orientarse en un centro nuevo»).
 */
export const semillaVigente = (situacion = {}) => {
  const id = situacion?.semillaId || "";
  const semilla = SITUACIONES_SEMILLA_INGLES_2DO.find((x) => x.id === id);
  if (!id || !semilla) return id;
  // `borrador: false` solo lo pone la app cuando el docente escribe un campo de la situación.
  const propio = situacion.productoDescripcion;
  const delaSemilla = [semilla.producto?.descripcion, ALCANCE_POR_SEMILLA[id]?.conInvitado?.productoDescripcion].filter(Boolean);
  return situacion.borrador === false && propio && !delaSemilla.includes(propio) ? "" : id;
};

/**
 * Sobre qué es el texto de la clase 1 y el diagnóstico: el de la semilla si vale; si no, lo que trata el producto
 * («cómo usar «X»», o «qué recomienda «X»» si es una propuesta); sin producto, el general (César, 2026-11-10).
 */
export const asuntoDeLectura = (situacion = {}, producto = "") => {
  const delaSemilla = ASUNTO_LECTURA_POR_SEMILLA[semillaVigente(situacion)];
  if (delaSemilla) return delaSemilla;
  const nombre = String(producto || "").trim();
  if (!nombre) return ASUNTO_LECTURA_GENERAL;
  return /\bpropos(al|uesta)\b/i.test(nombre) ? `qué recomienda «${nombre}»` : `cómo usar «${nombre}»`;
};

/**
 * Aviso para el docente cuando la audiencia configurada abarca más de un curso: la prueba con la audiencia puede no caber
 * en una clase. No cambia el plan (César, 2026-11-10); solo lo señala.
 */
export const avisoAudienciaMultiple = (audiencia = "", minutos = 45) => {
  const texto = String(audiencia || "");
  const cursos = new Set((texto.match(/\b\d+\.º/g) || []));
  if (cursos.size < 2 && !/\b(cursos|grados)\b/i.test(texto)) return "";
  return `La audiencia configurada («${texto.trim()}») abarca más de un curso: puede no caber en ${minutos} min; considera invitar una muestra de cada curso.`;
};

export const alcanceDeSituacion = (situacion = {}) => {
  const alcance = ALCANCE_POR_SEMILLA[situacion?.semillaId]?.conInvitado || null;
  const de = situacion?.audienciaDetalle?.de;
  return alcance && de && de !== situacion?.audiencia ? null : alcance;
};

/**
 * Ficha de la unidad: una sola decisión de modalidad y alcance, que leen la situación,
 * el producto y el ambiente (César, 2026-11-04). Devuelve los datos con la situación ya
 * ajustada. Nunca pisa lo que escribió el docente.
 */
export const conFichaDeUnidad = (datos) => {
  const pm = datos.planMaestro || {};
  const s = pm.situacion;
  if (!s) return datos;
  const alcancePropio = ALCANCE_POR_SEMILLA[s.semillaId]?.conInvitado;
  if (pm.estrategia !== "insercion_entorno") {
    // Otras estrategias no tienen visita, pero la audiencia sigue siendo la decidida.
    if (!alcancePropio?.sinModalidad || s.audienciaDetalle?.de !== s.audiencia) return datos;
    const [patron, nuevo] = alcancePropio.contextoCambio || [];
    return { ...datos, planMaestro: { ...pm,
      propositosSecciones: { ...pm.propositosSecciones, ...alcancePropio.propositosSecciones },
      situacion: { ...s,
        contexto: patron ? String(s.contexto || "").replace(patron, nuevo) : s.contexto,
        problema: alcancePropio.problema || s.problema,
        productoDescripcion: alcancePropio.productoDescripcion, audiencia: alcancePropio.audiencia,
        audienciaDetalle: { ...alcancePropio.audienciaDetalle, de: alcancePropio.audiencia } } } };
  }
  // Mismos valores por defecto que el generador: el formulario puede no enviarlos.
  const total = Number(datos.numSemanas || 4) * (datos.diasClase?.length || 3) * Number(datos.horasPorDia || 1);
  const modalidad = total <= CLASES_MINIMAS ? "simulada" : (pm.modalidadVisita || MODALIDAD_VISITA_POR_DEFECTO);
  if (modalidad === "entre_sesiones" || s.rolPropio) return { ...datos, planMaestro: { ...pm, modalidadVisita: modalidad } };
  const alcance = ALCANCE_POR_SEMILLA[s.semillaId]?.conInvitado;
  const audienciaDelDocente = s.audienciaDetalle?.de !== s.audiencia;
  const situacion = {
    ...s,
    rolPropio: modalidad === "simulada"
      ? "asumen el rol de investigadores: con una entrevista simulada en clase, usan sus propios instrumentos, analizan los datos y elaboran"
      : "asumen el rol de investigadores: traen el entorno al aula, entrevistan a un invitado con sus propios instrumentos, analizan los datos y elaboran",
    ...(alcance && !audienciaDelDocente ? {
      productoDescripcion: alcance.productoDescripcion,
      audiencia: alcance.audiencia,
      audienciaDetalle: { ...alcance.audienciaDetalle, de: alcance.audiencia },
    } : {}),
  };
  const piezasSecciones = alcance?.piezasSecciones && !audienciaDelDocente && modalidad !== "simulada"
    ? { ...pm.piezasSecciones, ...alcance.piezasSecciones }
    : pm.piezasSecciones;
  return { ...datos, planMaestro: { ...pm, modalidadVisita: modalidad, situacion, ...(piezasSecciones ? { piezasSecciones } : {}) } };
};

/**
 * Semillas escritas para una estrategia con encuesta (Rutinas: «What We Found» = resultados de la encuesta). Si la
 * unidad no tiene clases de encuesta (p. ej. ABP a 12 clases), sus propósitos y piezas nombran la fuente real: la que
 * trae el docente (revisor g32/g33: la IA seguía la semilla y ordenaba «encuestas» que nadie hizo). Devuelve cuántos cambió.
 */
const SIN_ENCUESTA = [
  [/\((?:la |una )?encuestas?:/gi, "(datos de la fuente que trae el docente:"],
  [/\b(?:la|una|las|unas|sus|su) encuestas?\b/gi, "la fuente que trae el docente"],
  [/\bencuestas?\b/gi, "fuente que trae el docente"],
];
export const sinEncuestaSiNoHay = (plan = {}, mapa = {}) => {
  const hayEncuesta = (mapa.filas || []).some((f) => (f.tareas || []).some((t) => /^indagar_(disenar|aplicar)$/.test(t.clave)));
  if (hayEncuesta) return 0;
  let cambios = 0;
  ["propositosSecciones", "piezasSecciones"].forEach((campo) => {
    if (!plan[campo] || typeof plan[campo] !== "object") return;
    plan[campo] = Object.fromEntries(Object.entries(plan[campo]).map(([sec, texto]) => {
      if (typeof texto !== "string" || !/encuesta/i.test(texto)) return [sec, texto];
      cambios += 1;
      return [sec, SIN_ENCUESTA.reduce((t, [re, por]) => t.replace(re, por), texto)];
    }));
  });
  return cambios;
};

/**
 * Recursos de la clase sin restos truncados de la IA (revisor g35, C4: «Tex... `, Gráf...»). Quita los elementos con
 * «...», «…» o acentos graves sueltos; si no queda ninguno, pone los recursos didácticos de la fila. Devuelve cuántos cambió.
 */
export const recursosSinTruncar = (dias = [], didacticosPorDia = []) => {
  let cambios = 0;
  (dias || []).forEach((dia, i) => (dia?.momentos || []).forEach((m) => {
    const r = m?.recursos;
    if (!r || typeof r.didacticos !== "string") return;
    const partes = r.didacticos.split(",").map((x) => x.trim()).filter(Boolean);
    const sanas = partes.filter((x) => !/\.\.\.|…|`/.test(x));
    if (sanas.length === partes.length) return;
    r.didacticos = sanas.length ? sanas.join(", ") : (didacticosPorDia[i] || "Pizarra y materiales impresos de la clase");
    cambios += 1;
  }));
  return cambios;
};

/** Actividad fija del nivel satisfactorio (secuencia de `revision_nivel`, aprobada por César el 2026-11-07). */
export const ACTIVIDAD_NIVEL_SATISFACTORIO = "Entregan (en grupos) cada sección corregida y el docente la revisa con la rúbrica: si llega al nivel satisfactorio, queda aprobada; si no, la devuelve con una mejora concreta que el grupo anota: sección aprobada o con una mejora pendiente; queda en la carpeta.";

/**
 * La clase con `revision_nivel` comprueba el nivel satisfactorio aunque la IA lo omita en todos sus intentos (revisor
 * g35 y g37, A1; César, 2026-11-11: lo escribe el código). Se inserta como segunda actividad del Desarrollo, sin pasar
 * de 6 actividades, y los minutos del Desarrollo se reparten de nuevo. Devuelve los números de clase cambiados.
 */
export const conNivelSatisfactorio = (dias = []) => {
  const cambiadas = [];
  (dias || []).forEach((dia, i) => {
    if (!(dia?.tareasMapa || []).some((t) => t?.clave === "revision_nivel")) return;
    const des = (dia.momentos || []).find((m) => m?.nombre === "Desarrollo");
    if (!des || !Array.isArray(des.actividades)) return;
    const textos = [...des.actividades, ...(des.actividadesDetalle || []).map((x) => x?.texto)].map((a) => String(typeof a === "string" ? a : a?.texto || ""));
    if (textos.some((a) => /satisfactori/i.test(a))) return;
    const n = des.actividades.length;
    if (n >= 6) {
      const extra = ` Después, el docente revisa cada sección corregida con la rúbrica: si llega al nivel satisfactorio, queda aprobada; si no, la devuelve con una mejora concreta.`;
      if (typeof des.actividades[0] === "string") des.actividades[0] = `${des.actividades[0]}${extra}`;
      if (typeof des.actividadesDetalle?.[0]?.texto === "string") des.actividadesDetalle[0].texto = `${des.actividadesDetalle[0].texto}${extra}`;
    } else {
      const pos = Math.min(1, n);
      des.actividades.splice(pos, 0, ACTIVIDAD_NIVEL_SATISFACTORIO);
      if (Array.isArray(des.actividadesDetalle) && des.actividadesDetalle.length === n) {
        const base = String(des.actividadesDetalle[0]?.id || "").replace(/-A\d+$/, "");
        des.actividadesDetalle.splice(pos, 0, { id: `${base}-A${pos + 1}`, texto: ACTIVIDAD_NIVEL_SATISFACTORIO, tipo: "actividad" });
        des.actividadesDetalle.forEach((x, k) => { if (x && base && /-A\d+$/.test(String(x.id || ""))) x.id = `${base}-A${k + 1}`; });
      }
      if (Array.isArray(des.minutosActividad) && des.minutosActividad.length === n) {
        const total = des.minutosActividad.reduce((s, x) => s + (Number(x) || 0), 0);
        const cada = Math.floor(total / (n + 1));
        des.minutosActividad = Array.from({ length: n + 1 }, (_, k) => cada + (k < total - cada * (n + 1) ? 1 : 0));
      }
    }
    cambiadas.push(dia.numeroGlobal || i + 1);
  });
  return cambiadas;
};

/** Ambiente: solo lo que las tareas usan; ninguna clase depende de tecnología. */
export const ambienteDeMapa = (mapa) => {
  const conInvitado = mapa.filas.some((f) => f.modalidad === "invitado");
  return `Aula ordinaria organizada por grupos editores, con la tabla común, el cartel del acuerdo y las secciones del producto a la vista. Se usan pizarra, cartulinas y materiales impresos; ninguna clase depende de electricidad o internet.${conInvitado ? " El entorno entra al aula por medio de la persona invitada." : ""}`;
};

// Probar o ensayar lo que ya tiene borrador no lo devuelve a «insumos recopilados» (revisión g44, C10).
const TAREAS_EN_PRUEBA = new Set(["orientar_probar", "socializar_leer", "aplicar_ensayar", "aplicar_anotar", "aplicar_segundo"]);
const estadoDeTarea = (t) => {
  if (t.cierraSeccion) return "versión final";
  if ([].concat(t.demuestra).includes("P")) return "borrador";
  if (TAREAS_EN_PRUEBA.has(t.clave)) return "en prueba";
  return "insumos recopilados";
};
const RANGO_ESTADO = { "insumos recopilados": 1, borrador: 2, "en prueba": 3, "versión final": 4 };
/** Estados de una sección en orden, sin retroceder: uno anterior al último ya alcanzado no se repite. */
export const estadosMonotonos = (estados = []) => estados.reduce((acc, e) => {
  const ultimo = acc.length ? RANGO_ESTADO[acc[acc.length - 1]] || 0 : 0;
  if ((RANGO_ESTADO[e] || 0) > ultimo) acc.push(e);
  return acc;
}, []);

// Los anexos nombran el producto; su descripción ya está en la situación.
const nombreCorto = (producto) => String(producto || "").split(/\s+[—–]\s+/)[0].trim();

/** Anexo I desde el mapa: cada sección con su propio proceso, estados y evidencia. */
export const organizadorDesdeMapa = (mapa, { producto = "", piezas = {}, propositos = {} } = {}) => {
  const filas = mapa.filas.filter((f) => !f.flexible);
  const COMPARTIDAS = ["acordar", "saberes_previos", "problema_analizar", "problema_definir", "problema_objetivos", "revision_docente", "revision_nivel", "recorrer_lugares", "indagar_disenar", "indagar_aplicar", "indagar_contrastar", "comentar", "glosario", "integrar", "presentar", "probar_audiencia", "corregir_final", "audiencia_secundaria", "evaluar_comentarios", "evaluar_proceso"];
  return [
    { seccion: "Título", incluye: `Mi nombre y el título del producto (${nombreCorto(producto)}).`, fases: "" },
    ...mapa.secciones.map((seccion) => {
      const suyas = filas.flatMap((f) => f.tareas.filter((t) => t.secciones.includes(seccion) && !COMPARTIDAS.includes(t.clave)).map((t) => ({ ...t, clase: f.clase })));
      const estados = estadosMonotonos(suyas.map(estadoDeTarea));
      const seCierraEn = suyas.find((t) => t.cierraSeccion);
      const comentada = filas.find((f) => f.tareas.some((t) => t.clave === "comentar" && t.secciones.includes(seccion)));
      const operaciones = suyas.map((t) => `${t.nombre} (C${t.clase})`);
      if (comentada) operaciones.splice(Math.max(0, operaciones.length - (seCierraEn ? 1 : 0)), 0, `comentar (C${comentada.clase})`);
      const produce = [...suyas].reverse().find((t) => t.demuestra === "P" && !t.cierraSeccion) || suyas[suyas.length - 1];
      return {
        seccion,
        fases: estados.map((e) => e.charAt(0).toUpperCase() + e.slice(1)).join(" → "),
        operaciones,
        evidencia: INVENTARIO_POR_SECCION[seccion]?.evidencia || String(produce?.entrega || "").replace(/\s*\(borrador\)/i, ""),
        incluye: piezas[seccion] || propositos[seccion] || `Lo trabajado en la sección «${seccion}».`,
      };
    }),
  ];
};

/** Anexo H desde el mapa: una fila por clase. */
export const checklistDesdeMapa = (mapa, producto = "") => mapa.filas.filter((f) => !f.flexible)
  .map((f) => ({
    paso: `Clase ${f.clase}. ${aporteDeFila(f, nombreCorto(producto), mapa.secciones)}`,
    semana: `Semana ${f.semana}`,
    recibe: f.recibe.map((r) => `${r.texto}${r.clase ? ` (C${r.clase})` : ""}`).join("; "),
  }));

// Ajustes para el plan maestro: las fases que comparten clase se unen; el resto
// recibe tantas sesiones como filas. Null si la estrategia tiene fases con partes.
const ajustesParaPlan = (filas, fases) => {
  if (fases.some((f) => f.parte)) return null;
  const grupo = fases.map((_, i) => i);
  const raiz = (i) => (grupo[i] === i ? i : raiz(grupo[i]));
  filas.forEach((fila) => {
    const nums = fila.fases.map((f) => f.numero - 1);
    for (let i = Math.min(...nums); i < Math.max(...nums); i += 1) grupo[raiz(i + 1)] = raiz(i);
  });
  const grupos = new Map();
  fases.forEach((_, i) => grupos.set(raiz(i), [...(grupos.get(raiz(i)) || []), i + 1]));
  const lista = [...grupos.values()];
  return {
    unir: lista.filter((g) => g.length > 1),
    sesionesPorFase: lista.map((g) => filas.filter((fila) => fila.fases.some((f) => g.includes(f.numero))).length),
  };
};

/**
 * @param {object} entrada - la de construirPlanMaestro (armarEntradaPlanMaestro).
 * @param {number} [entrada.duracionMin=45] - minutos por clase.
 * @param {string} [entrada.modalidadVisita] - clave de MODALIDADES_VISITA.
 * @param {string[]} [entrada.contenidosSeleccionados] - sin ella, todos los del tema.
 * @returns {{filas:object[], modo:string, total:number, avisos:string[], tipos:object, seccionesSupuestas:string[], ajustesPlan:object|null}}
 */
// Qué es el producto («una charla bilingüe con un banco de frases…»): viene en la situación del plan maestro.
const descripcionDelProducto = (textoSituacion = "") => {
  try { return String(JSON.parse(textoSituacion || "{}")?.productoDescripcion || ""); } catch { return ""; }
};

const armarMapaClasesBase = ({ duracionMin = 45, modalidadVisita = "", contenidosSeleccionados = null, problemaDesde = 13, datosDesde = UMBRAL_RECOGER_DATOS, encuestaProyectos = true, ...entrada } = {}) => {
  const { semanas, diasClase, horasPorDia } = entrada.horario || {};
  const total = semanas * (diasClase?.length || 0) * horasPorDia;
  if (!Number.isInteger(total) || total <= 0) throw error("el horario necesita semanas, días de clase y horas por día.");
  if (total < CLASES_MINIMAS) throw error(`el horario da ${total} clase(s) y la unidad necesita al menos ${CLASES_MINIMAS}: recoger, producir y presentar. Amplía el horario.`);
  if (!entrada.secciones?.length) throw error("el plan maestro no tiene secciones del producto.");

  // El plan aporta lo fijo; sus sesiones no se usan aquí, el mapa las reparte por minutos.
  const plan = construirPlanMaestro({ ...entrada, ajustes: {}, horario: { semanas: 60, diasClase, horasPorDia: 1 } });
  const clave = plan.estrategia.clave;
  const tiposFase = TIPO_TRABAJO_FASES_POR_ESTRATEGIA[clave] || null;
  const { tipos, supuestas } = tiposDeSecciones(plan.secciones, entrada.tiposTrabajoSecciones || {});
  const items = listarTareas({ estrategia: clave, fases: plan.fases, tiposFase, secciones: plan.secciones, tipos, partenDe: plan.partenDeSecciones, tareasOmitidas: entrada.tareasOmitidas || [], totalClases: total, producto: plan.producto, descripcion: descripcionDelProducto(entrada.textoSituacion), problemaDesde, datosDesde, encuestaProyectos });
  const capacidad = minutosDesarrollo(duracionMin);
  const avisos = [];
  if (supuestas.length) avisos.push(`Tipo de trabajo supuesto por la posición de la sección: ${supuestas.join(", ")}. El docente puede cambiarlo.`);

  const secuencial = repartoSecuencial(items, total, capacidad);
  let clases; let modo; let breve = false;
  if (secuencial) {
    clases = secuencial.clases;
    modo = secuencial.modo;
  } else {
    const r = repartoBreve(items, total, capacidad);
    if (!r) throw error(`no se pudo repartir la unidad en ${total} clases de ${capacidad} minutos de Desarrollo.`);
    clases = r.bloquesPorClase.map((partes) => partes.flatMap(tareasDeBloque));
    modo = "breve";
    breve = true;
    avisos.push("Versión breve: por el tiempo disponible, las secciones se trabajan a la vez por grupos y las fases contiguas comparten clase.");
  }
  const sobran = total - clases.length;
  const modalidad = breve && total <= 3 ? "simulada" : (modalidadVisita || MODALIDAD_VISITA_POR_DEFECTO);
  if (breve && total <= 3 && items.some((it) => it.t.usaModalidad)) avisos.push("Con este tiempo no cabe una visita real: la entrevista es simulada y así lo declara el plan.");

  const faseInfo = (i) => ({ numero: plan.fases[i].numero, nombre: plan.fases[i].nombre });
  const lugaresDelCentro = TEMA_DE_LUGARES.test(`${entrada.producto || ""} ${entrada.textoSituacion || ""}`);
  const filas = clases.map((tareas, c) => {
    const lista = tareas.map(({ t, secciones, minutos, fase, paralelo }) => ({
      clave: t.clave, tipoPrueba: t.tipoPrueba || "", estructura: t.estructura || null, nombre: t.nombre, secciones: [...secciones], minutos, fase, faseNombre: plan.fases[fase]?.nombre || "", paralelo: Boolean(paralelo),
      demuestra: t.demuestra, evidencia: t.evidencia, condicion: t.condicion, organizacion: t.organizacion,
      entrega: t.entrega, individual: Boolean(t.individual), sumativa: Boolean(t.sumativa), cierraSeccion: Boolean(t.cierraSeccion),
      llegaAudiencia: Boolean(t.llegaAudiencia), ampliacion: Boolean(t.ampliacion), recursos: t.recursos,
      modalidad: t.usaModalidad ? modalidad : null, recibe: [], indicadores: [],
      instruccion: t.hace || DETALLE_TAREA[t.clave]?.hace || "", senal: DETALLE_TAREA[t.clave]?.senal || "",
      soloComprender: Boolean(DETALLE_TAREA[t.clave]?.soloComprender),
    }));
    const usados = lista.some((t) => t.paralelo)
      ? [...new Set(lista.map((t) => t.secciones[0]))].reduce((m, s) => Math.max(m, lista.filter((t) => t.secciones[0] === s).reduce((a, t) => a + t.minutos, 0)), 0)
      : lista.reduce((s, t) => s + t.minutos, 0);
    return {
      clase: c + 1, flexible: false, tareas: lista, lugaresDelCentro,
      secciones: [...new Set(lista.flatMap((t) => t.secciones))],
      fases: [...new Set(lista.map((t) => t.fase))].sort((a, b) => a - b).map(faseInfo),
      minutos: usados, minutosLibres: Math.max(0, capacidad - usados),
      indicadores: [], contenidos: [], recibe: [],
      entregas: [...new Set(lista.map((t) => t.entrega))],
      evidencias: lista.map((t) => ({ tipo: t.evidencia, condicion: t.condicion, individual: t.individual, sumativa: t.sumativa })),
      modalidad: lista.find((t) => t.modalidad)?.modalidad || null,
    };
  });

  // Una clase que cruza fases cuenta en la de su tarea más larga: si se unieran, 4 semanas
  // dejarían una sola fase con la mitad de la unidad (revisión de Escuela, 2026-11-05).
  if (modo === "ajustado_entre_fases") {
    let previa = 0;
    filas.forEach((f) => {
      const larga = f.tareas.reduce((a, b) => (b.minutos > a.minutos ? b : a), f.tareas[0]);
      previa = Math.max(previa, larga.fase);
      f.fases = [faseInfo(previa)];
    });
  }

  // Versión breve: los grupos avanzan a la vez, así que las fases se reparten en
  // orden y por igual entre las clases (fases contiguas comparten clase).
  if (breve) {
    const m = plan.fases.length;
    const n = filas.length;
    filas.forEach((f, i) => {
      const desde = Math.floor((i * m) / n);
      const hasta = Math.max(desde, Math.floor(((i + 1) * m) / n) - 1);
      f.fases = Array.from({ length: hasta - desde + 1 }, (_, k) => faseInfo(desde + k));
    });
  }

  // Clases que sobran: tiempo flexible declarado, antes de presentar.
  if (sobran > 0) {
    const antes = Math.max(0, filas.findIndex((f) => f.tareas.some((t) => t.clave === "presentar")));
    const faseAntes = filas[Math.max(0, antes - 1)].fases;
    filas.splice(antes, 0, ...Array.from({ length: sobran }, () => ({
      clase: 0, flexible: true, tareas: [], secciones: [], fases: faseAntes.slice(-1), minutos: 0, minutosLibres: capacidad,
      indicadores: [], contenidos: [], recibe: [], entregas: [], evidencias: [], modalidad: null,
    })));
    avisos.push(`${sobran} clase(s) flexible(s) del docente, para refuerzo, ritmos o imprevistos.`);
    filas.forEach((f, i) => { f.clase = i + 1; });
  }

  // Fases sin tarea: se unen a la clase de la fase siguiente con tarea (o a la última).
  plan.fases.forEach((_, i) => {
    if (filas.some((f) => f.fases.some((x) => x.numero === i + 1))) return;
    // Una clase puede llevar varias fases (César, 2026-11-06): la fase sin clase propia va con la que hace su tarea.
    const conSuTarea = filas.find((f) => f.tareas.some((t) => t.fase === i));
    if (conSuTarea && !breve) {
      conSuTarea.fases = [...conSuTarea.fases, faseInfo(i)].sort((a, b) => a.numero - b.numero);
      return;
    }
    const destino = filas.find((f) => f.fases.some((x) => x.numero > i + 1)) || filas[filas.length - 1];
    destino.fases = [...destino.fases, faseInfo(i)].sort((a, b) => a.numero - b.numero);
    avisos.push(`La fase «${plan.fases[i].nombre}» no tiene tarea propia y se une a la clase ${destino.clase}.`);
  });

  // Una tarea de la estrategia que no cabe se avisa: nunca se descarta en silencio (César, 2026-11-07).
  const colocadas = new Set(filas.flatMap((f) => f.tareas.map((t) => t.clave)));
  [...new Map(items.map((it) => [it.t.clave, it.t])).values()].filter((t) => !colocadas.has(t.clave) && !t.ampliacion)
    .forEach((t) => avisos.push(`La tarea «${t.nombre}» no cabe en este tiempo y no está en el mapa.`));

  filas.forEach((f, i) => { f.semana = Math.ceil((i + 1) / (diasClase.length * horasPorDia)); });
  // Tope de secundarias con actividad propia, antes de encadenar lo que cada clase recibe (revisor de g50).
  limitarSecundarias(filas, plan.secciones).forEach((m) => avisos.push(`ℹ Sección secundaria movida: ${m}.`));
  ponerDatosARecoger(filas, plan.secciones);
  encadenar(filas, plan.partenDeSecciones);
  const indicadoresElegidos = plan.fases.flatMap((f) => f.indicadores);
  const sinTarea = ubicarIndicadores(filas, indicadoresElegidos);
  sinTarea.forEach((id) => avisos.push(`El indicador ${id} no tiene tarea de su acción en este mapa.`));
  const contenidosSinLugar = ubicarContenidos(filas, plan, contenidosSeleccionados);
  if (contenidosSinLugar.length) avisos.push(`${contenidosSinLugar.length} contenido(s) del tema quedan sin marcar: no caben con sentido en este tiempo.`);
  // La sección principal de cada clase, con la función ya ubicada y cada sección principal al menos una vez.
  asignarPrincipales(filas, plan.secciones);
  return {
    contenidosSinLugar,
    filas, modo, total, capacidad, tipos, seccionesSupuestas: supuestas, avisos, breve,
    estrategia: clave, secciones: plan.secciones, indicadores: indicadoresElegidos.map((i) => i.id),
    contenidos: CATEGORIAS.flatMap((cat) => [...new Set(plan.fases.flatMap((f) => (f.contenidos?.[cat] || []).map((c) => `${cat}:${c.texto}`)))]),
    seleccionados: contenidosSeleccionados, fases: plan.fases.map((f) => f.numero),
    ajustesPlan: ajustesParaPlan(filas, plan.fases),
  };
};

/**
 * ABProblemas con 12 clases: intenta darle a cada fase su tarea (selección, definición y objetivos) y, si el mapa no cabe
 * así (versión breve, clases flexibles o tareas descartadas), vuelve a unir las fases como antes. Con 13 clases o más, siempre.
 * Un solo número no sirve: depende de cuántas tareas lleve el producto (g28: Rutinas cabe, Escuela no).
 */
const cabeMapa = (m) => m.modo !== "breve" && !m.breve && !m.filas.some((f) => f.flexible)
  && !m.avisos.some((a) => /no cabe en este tiempo/.test(String(a?.texto ?? a)));

export const armarMapaClases = (args = {}) => {
  const base = armarMapaClasesBase(args);
  // Proyectos con encuesta: si así no cabe, se arma sin ella (y «ordenar» vuelve a trabajar con la fuente del docente).
  if (base.estrategia === "proyectos") {
    if (!base.filas.some((f) => f.tareas.some((t) => t.clave === "indagar_aplicar")) || cabeMapa(base)) return base;
    const sin = armarMapaClasesBase({ ...args, encuestaProyectos: false });
    return { ...sin, avisos: [...sin.avisos, "La encuesta no cabe en este tiempo: los datos salen de la fuente que trae el docente y de los modelos."] };
  }
  if (base.estrategia !== "problemas" || base.total < 12 || base.total >= UMBRAL_RECOGER_DATOS) return base;
  // De más completo a menos: tareas de las fases 1–3 y recogida de datos (encuesta), luego solo las fases 1–3
  // (revisor g30: «recoger datos» es tarea característica de la investigación en ABP). Gana el primero que cabe.
  const cabe = cabeMapa;
  for (const intento of [{ problemaDesde: 12, datosDesde: 12 }, { problemaDesde: 12 }]) {
    try {
      const m = armarMapaClasesBase({ ...args, ...intento });
      if (cabe(m)) return m;
    } catch { /* este intento no cabe: se prueba el siguiente */ }
  }
  return base;
};

// Estado que deja la clase, para el «aporte al producto» que escribe el código.
export const estadoDeFila = (fila) => {
  const claves = fila.tareas.map((t) => t.clave);
  if (claves.includes("acordar")) return "acuerdo y plan";
  if (claves.some((c) => c.startsWith("evaluar"))) return "versión revisada";
  if (claves.includes("presentar") || claves.includes("audiencia_secundaria")) return "presentación";
  if (fila.tareas.some((t) => t.cierraSeccion) || claves.includes("integrar")) return "versión final";
  if (claves.includes("comentar")) return "comentarios";
  // Diseñar o aplicar la encuesta recoge datos: no es el borrador de una sección (revisor de g50, Frases C2).
  if (claves.length && claves.every((c) => /^(indagar_|recorrer_|visitar_|saberes_)/.test(c))) return "insumos recopilados";
  if (fila.tareas.some((t) => [].concat(t.demuestra).includes("P"))) return "borrador";
  if (fila.tareas.length && fila.tareas.every((t) => TAREAS_EN_PRUEBA.has(t.clave))) return "en prueba";
  return "insumos recopilados";
};

/** «Aporte al producto» de una fila: lo escribe el código, no la IA. */
export const aporteDeFila = (fila, producto, secciones = []) => {
  if (fila.flexible) return `«${producto}» (refuerzo): clase flexible del docente, sin pieza nueva`;
  const estado = estadoDeFila(fila);
  // Sin piezas repetidas (revisión g44, C8: «Pieza propuesta (borrador)» dos veces).
  const pieza = [...new Set(fila.entregas.map((e) => String(e).trim()))].join("; ");
  if (fila.secciones.length === secciones.length && secciones.length > 1) return `«${producto}» (${estado}): ${pieza}`;
  if (fila.secciones.length === 1) return `Sección «${fila.secciones[0]}» (${estado}): ${pieza}`;
  return `Secciones ${fila.secciones.map((s) => `«${s}»`).join(" · ")} (${estado}): ${pieza}`;
};

/**
 * Plan maestro ajustado al mapa: sesiones y uniones por minutos, y en cada fase
 * sus indicadores y las secciones que de verdad avanza. Null si la estrategia
 * tiene fases con partes, que no se pueden unir.
 */
export const planDesdeMapa = (entrada, mapa) => {
  if (!mapa.ajustesPlan) return null;
  const plan = construirPlanMaestro({ ...entrada, ajustes: mapa.ajustesPlan });
  // Las fases que comparten clase se muestran por separado, no con un nombre fusionado (César, 2026-11-06).
  plan.fases.forEach((f) => { if ((f.fasesGuia || []).length > 1 && !f.parte) f.nombre = f.fasesGuia.map((n) => n.replace(/\.$/, "")).join(" → "); });
  const porId = new Map(plan.fases.flatMap((f) => f.indicadores).map((ind) => [ind.id, ind]));
  let desde = 0;
  const filasPorFase = plan.fases.map((fase) => {
    const filas = mapa.filas.slice(desde, desde + fase.sesiones);
    desde += fase.sesiones;
    fase.indicadores = [...new Set(filas.flatMap((f) => f.indicadores))].map((id) => porId.get(id)).filter(Boolean);
    const secciones = plan.secciones.filter((s) => filas.some((f) => f.flexible || f.secciones.includes(s)));
    const parcial = secciones.length && secciones.length < plan.secciones.length;
    fase.entrega = {
      ...fase.entrega, secciones,
      texto: `${fase.entrega.estado} de ${parcial ? secciones.join(", ") : plan.producto}`,
    };
    return filas;
  });
  if (desde !== mapa.filas.length) throw error(`las fases del plan suman ${desde} clases y el mapa tiene ${mapa.filas.length}.`);
  return { plan, filasPorFase };
};

/**
 * Hoja de ruta: la unidad completa en una línea por clase, para que cada lote sepa
 * qué viene antes y después (César, 2026-11-04). La clase actual se marca con ►.
 */
export const hojaDeRuta = (filas = [], clasesActuales = []) => filas.map((f) => {
  const marca = clasesActuales.includes(f.clase) ? "► " : "";
  if (f.flexible) return `${marca}C${f.clase} clase flexible del docente`;
  const secciones = f.secciones.length > 2 ? "todo el producto" : f.secciones.join(" · ");
  return `${marca}C${f.clase} ${secciones}: ${f.tareas.map((t) => t.nombre).join(" + ")} → entrega: ${f.entregas.join("; ")}`;
});

/**
 * Fallos del mapa que detienen la generación antes de llamar a la IA (César, 2026-11-04):
 * indicador sin lugar en las clases sumativas (V6) y entrega o dato sin origen.
 * V6 cuenta solo los indicadores que cada clase muestra.
 */
export const fallosQueDetienen = (mapa) => {
  const fallos = [];
  // Inventario: ningún dato sin origen en una clase anterior o en la misma.
  const recogidoEn = {};
  mapa.filas.forEach((f) => (f.datosRecoge || []).forEach((d) => { recogidoEn[d] = recogidoEn[d] ?? f.clase; }));
  mapa.filas.forEach((f) => f.tareas.forEach((t) => {
    if (!["P"].some((l) => [].concat(t.demuestra).includes(l)) || t.secciones.length !== 1) return;
    (INVENTARIO_POR_SECCION[t.secciones[0]]?.necesita || []).forEach((d) => {
      if (recogidoEn[d] === undefined && mapa.modo !== "breve") fallos.push(`«${t.secciones[0]}» necesita «${d}» y ninguna clase lo recoge`);
      else if (recogidoEn[d] > f.clase && mapa.modo !== "breve") fallos.push(`«${t.secciones[0]}» necesita «${d}» en la clase ${f.clase}, antes de recogerlo en la ${recogidoEn[d]}`);
    });
  }));
  const reales = mapa.filas.filter((f) => !f.flexible);
  const tareas = reales.flatMap((f) => f.tareas.map((t) => ({ ...t, clase: f.clase })));
  tareas.forEach((t) => {
    t.recibe.forEach((r) => { if (r.clase !== null && r.clase > t.clase) fallos.push(`clase ${t.clase} recibe de una clase posterior (${r.clase})`); });
    if (!t.recibe.length) fallos.push(`clase ${t.clase}: «${t.nombre}» no tiene origen`);
  });
  const muestra = (f) => f.indicadores.slice(0, TOPE_INDICADORES_POR_CLASE);
  reales.filter((f) => f.indicadores.length > TOPE_INDICADORES_POR_CLASE).forEach((f) => fallos.push(`la clase ${f.clase} evalúa ${f.indicadores.length} indicadores y solo muestra ${TOPE_INDICADORES_POR_CLASE}`));
  const sumativos = new Set(reales.flatMap((f) => f.tareas.filter((t) => t.sumativa).flatMap((t) => t.indicadores.filter((id) => muestra(f).includes(id)))));
  const sinLugar = mapa.indicadores.filter((id) => !sumativos.has(id));
  if (sinLugar.length) fallos.push(`los indicadores ${sinLugar.join(", ")} no caben en las clases sumativas de la unidad: cada clase evalúa como máximo ${TOPE_INDICADORES_POR_CLASE}, y comprender va en una tarea sumativa, producir e interactuar en otra. Elige menos indicadores`);
  return [...new Set(fallos)];
};

/** Reglas de calidad del diseño. Devuelve la lista de incumplimientos (vacía = cumple). */
export const verificarMapa = (mapa) => {
  const fallos = fallosQueDetienen(mapa);
  const reales = mapa.filas.filter((f) => !f.flexible);
  const tareas = reales.flatMap((f) => f.tareas.map((t) => ({ ...t, clase: f.clase })));
  if (mapa.filas.length !== mapa.total) fallos.push(`hay ${mapa.filas.length} filas para ${mapa.total} clases`);
  mapa.secciones.forEach((s) => {
    const suyas = tareas.filter((t) => t.secciones.includes(s));
    if (!suyas.some((t) => [].concat(t.demuestra).includes("P"))) fallos.push(`«${s}» no produce nada`);
    const cierre = suyas.findIndex((t) => t.cierraSeccion);
    if (cierre < 0) fallos.push(`«${s}» no cierra su ciclo`);
    else if (!suyas.slice(0, cierre).some((t) => t.clave !== "acordar")) fallos.push(`«${s}» cierra sin trabajar antes`);
  });
  const vistas = new Set();
  tareas.forEach((t) => {
    const k = `${t.clave}|${t.secciones.join()}`;
    if (vistas.has(k)) fallos.push(`se repite sin avance: ${t.nombre} (${t.secciones.join(", ")})`);
    vistas.add(k);
  });
  mapa.indicadores.forEach((id) => { if (!reales.some((f) => f.indicadores.includes(id))) fallos.push(`el indicador ${id} no tiene tarea`); });
  const puestos = new Set(reales.flatMap((f) => f.contenidos.map((c) => `${c.categoria}:${c.texto}`)));
  mapa.contenidos.filter((c) => !mapa.seleccionados || mapa.seleccionados.includes(c.slice(c.indexOf(":") + 1)))
    .filter((c) => !mapa.contenidosSinLugar.includes(c))
    .forEach((c) => { if (!puestos.has(c)) fallos.push(`el contenido «${c}» no tiene lugar`); });
  if (!tareas.some((t) => t.llegaAudiencia)) fallos.push("el producto no llega a su audiencia");
  const presentar = tareas.find((t) => t.llegaAudiencia);
  if (presentar) mapa.secciones.forEach((s) => {
    const cierre = tareas.find((t) => t.cierraSeccion && t.secciones.includes(s));
    if (cierre && cierre.clase > presentar.clase) fallos.push(`«${s}» se cierra después de presentar`);
  });
  mapa.filas.forEach((f) => { if (f.minutos > mapa.capacidad) fallos.push(`clase ${f.clase}: ${f.minutos} min no caben en ${mapa.capacidad}`); });
  mapa.fases.forEach((n) => { if (!mapa.filas.some((f) => f.fases.some((x) => x.numero === n))) fallos.push(`la fase ${n} no tiene clase`); });
  let previa = 0;
  mapa.filas.forEach((f) => {
    const menor = Math.min(...f.fases.map((x) => x.numero));
    if (menor < previa) fallos.push(`clase ${f.clase}: la fase retrocede`);
    previa = Math.max(previa, menor);
  });
  const conVisita = tareas.filter((t) => t.modalidad);
  if (new Set(conVisita.map((t) => t.modalidad)).size > 1) fallos.push("la visita tiene más de una modalidad");
  return [...new Set(fallos)];
};
