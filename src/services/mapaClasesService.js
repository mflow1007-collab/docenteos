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
export const pruebaDelProducto = (producto = "", secciones = []) => secciones.map((s) => PRUEBA_POR_SECCION[s]).find(Boolean)
  || (/\bpropos(al|uesta)\b/i.test(producto) ? { tipo: "defender", hace: "Defienden ante la audiencia su recomendación: explican por qué recomiendan esa alternativa y responden sus preguntas, y luego recogen sus comentarios en tarjetas." } : null);

const listarTareas = ({ fases, tiposFase, secciones, tipos, partenDe, tareasOmitidas: omitidas = [], estrategia, totalClases = 99, producto = "" }) => {
  const tareasOmitidas = omitidas;
  const indagacion = estrategia === "indagacion_dialogica";
  const faseDe = (re) => fases.findIndex((f) => re.test(f.nombre));
  // Decisiones de César (2026-11-06). Indagación: la fase 3 organiza y prioriza lo ya validado (Referente 2025, p. 18).
  // Problemas: los cursos de acción se evalúan como contenido, en «Reestructuración», no se califican (Adecuación, p. 24).
  let ordenarIndagacion = false;
  const ajustePorEstrategia = (t, seccion = "") => {
    if (indagacion && t.clave === "analizar_ordenar") return { ...t, faseGuia: faseDe(/^Análisis y organización/), hace: "Organizan y priorizan los datos validados en una tabla de frecuencia o una matriz por categoría, y deciden qué problemas atenderá el plan. Aún no redactan la pieza." };
    if (estrategia === "problemas" && t.clave === "proponer_elegir") return { ...t, faseGuia: faseDe(/^Reestructuración/), hace: `Evalúan los cursos de acción posibles${seccion ? ` para «${seccion}»` : ""} (ventajas, desventajas y viabilidad) y justifican cuál eligen con la tabla.` };
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
  if (unCiclo) push({ ...TAREA_CORREGIR, faseInsercion: "proponer", ...enEvaluacion, ...enPuesta }, corregibles, 2, 1, 0);
  else trozos(tempranas, SECCIONES_POR_CORREGIR).forEach((grupo, g) => push({ ...TAREA_CORREGIR, faseInsercion: "socializar", ...enEvaluacion }, grupo, 2, 1, g));
  if (!unCiclo) trozos(tardias, SECCIONES_POR_CORREGIR).forEach((grupo, g) => push({ ...TAREA_CORREGIR, faseInsercion: "proponer", ...enEvaluacion }, grupo, 2, 2, g));
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
  const FASE_DE_DATOS = { problemas: /^Análisis e investigación/, estudio_caso: /^Indagación o estudio/ };
  if (FASE_DE_DATOS[estrategia] && totalClases >= UMBRAL_RECOGER_DATOS && faseDe(FASE_DE_DATOS[estrategia]) >= 0) {
    [u.indagarDisenar, u.indagarAplicar, u.indagarContrastar].forEach((t, k) => push({ ...t, faseGuia: faseDe(FASE_DE_DATOS[estrategia]), estructura: DATOS_ENCUESTA[estrategia].estructura }, [...orden], 0, 2.5, k));
  }
  // Con 12 clases no caben (la unidad entera ya llena el tiempo): ahí las fases 2 y 3 se unen a la 1 y queda por decidir qué
  // tarea sale (César). Desde 13 clases, cada fase lleva la suya.
  if (estrategia === "problemas" && totalClases >= 13) [u.problemaAnalizar, u.problemaDefinir, u.problemaObjetivos].forEach((t, k) => push(t, [...orden], 0, 1 + k, 0));
  push(u.glosario, [...orden], 3, 0, 0);
  push({ ...u.integrar, ...enEvaluacion }, [...orden], 3, 1, 0);
  if (orden.some((s) => INVENTARIO_POR_SECCION[s]?.necesita?.includes("lugares"))) push(u.recorrerLugares, [...orden], 0, 1, 0);
  // Cada estrategia hace lo suyo: la indagación valida sus fuentes, no solo ordena datos.
  if (estrategia === "indagacion_dialogica") [u.indagarDisenar, u.indagarAplicar, u.indagarContrastar].forEach((t, k) => push(t, [...orden], 0, 2, k));
  // Proyectos sin recorrido ni entrevista: los «datos recibidos» no vienen de nadie. En «Gestión del conocimiento» (Referente
  // por proyecto 2022, pp. 32–33: buscar, leer, sistematizar fuentes) se ordena lo reunido de la fuente que trae el docente
  // y de los modelos (revisión de g20, 2026-11-10). El tiempo no cambia: no se añade ninguna tarea.
  if (estrategia === "proyectos" && !items.some((it) => /^(visitar|recorrer|indagar)/.test(it.t.clave))) {
    items.filter((it) => it.t.clave === "analizar_ordenar").forEach((it) => {
      it.t = { ...it.t, hace: "Ordenan en una tabla común lo reunido de la fuente que trae el docente y de los modelos analizados (ejemplos, frases o datos) y analizan un modelo para decidir el formato. Aún no redactan la pieza." };
    });
  }
  // Presentar y usar el producto con la audiencia son siempre dos tareas: la de usarlo cubre interactuar.
  const prueba = pruebaDelProducto(producto, orden);
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
  const poner = (fila, cat, texto) => {
    const destino = fila.contenidos.length < TOPE_CONTENIDOS_POR_CLASE ? fila : utiles.find((f) => f.contenidos.length < TOPE_CONTENIDOS_POR_CLASE);
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
export const humanosDeFila = (fila, alcance = null) => {
  const claves = fila.tareas.map((t) => t.clave);
  if (claves.includes("presentar") || claves.includes("probar_audiencia")) {
    if (!alcance?.invitado) return "Docente, estudiantes y la audiencia";
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
const EQUIPO = /\b(videos?|clips?|(retro)?proyector(es)?|parlantes?|bocinas?|altavoz|grabadoras?|grabacion(es)?|computadoras?|laptops?|tablets?|internet|audiovisual(es)?|celular(es)?|audio)\b/;
export const ENGANCHE_SIN_EQUIPOS = "Observan un ejemplo impreso relacionado con la clase y dicen qué les llama la atención.";

/**
 * Inicio y Cierre sin equipos: quita los que la IA puso en sus recursos y sustituye la
 * actividad de enganche que los usa (el Inicio tiene 5 posiciones fijas). Lo que quede
 * en otra actividad se devuelve para avisar al administrador.
 */
export const sinEquipos = (momentos = [], didacticosFila = "") => {
  const restantes = [];
  // El video también se nombra en las evidencias y en las preguntas, en cualquier momento.
  // También en las actividades de cualquier momento, incluido el Desarrollo (g23, Escuela guía C8: «las frases del video»).
  const sinVideo = (t) => (typeof t === "string" ? t
    .replace(/\b(the|a|our|this) video\b/gi, "the example")
    .replace(/\b(el|un|nuestro|este) video\b/gi, "el ejemplo")
    .replace(/\bdel video\b/gi, "del ejemplo")
    .replace(/\b(los|unos|estos|nuestros) videos\b/gi, "$1 ejemplos")
    .replace(/\b(el|un|su) (retro)?proyector\b/gi, "la pizarra")
    .replace(/\bvideos?\b/gi, (v) => (/s$/i.test(v) ? "ejemplos" : "ejemplo")) : t);
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
const ETIQUETA_POR_TAREA = { describir_modelo: "Analizar un modelo de", describir_redactar: "Redactar", analizar_ordenar: "Organizar lo reunido para", analizar_borrador: "Escribir el borrador de", analizar_verificar: "Comprobar los datos de" };
const TAREAS_CON_FUNCION_PROPIA = new Set(["analizar_ordenar", "problema_analizar", "problema_definir", "problema_objetivos", "saberes_previos"]);

/**
 * Estructura del día: la escribe el código, para que corresponda a la tarea de la clase.
 * Función de la fila y su gramática; sin gramática, la frase fija de la tarea principal.
 */
export const focoDeFila = (fila = {}, filas = []) => {
  // Aplicar sin contenido propio: nombra la estructura de la clase anterior de la misma
  // sección, no una etiqueta genérica (revisión de g6 y g7, 2026-11-06).
  const primera = fila.tareas?.[0]?.clave || "";
  if (/^aplicar_/.test(primera) && primera !== "aplicar_corregir" && !(fila.contenidos || []).some((c) => ["gramatica", "funcionales"].includes(c.categoria))) {
    const previa = [...filas].reverse().find((f) => f.clase < fila.clase && !f.flexible
      && f.tareas?.some((t) => /^aplicar_/.test(t.clave) && t.secciones?.some((s) => fila.tareas[0].secciones?.includes(s)))
      && (f.contenidos || []).some((c) => ["gramatica", "funcionales"].includes(c.categoria)));
    if (previa) return focoDeFila(previa);
  }
  // Si la clase reúne el producto, esa es su tarea principal.
  const clave = (fila.tareas || []).find((t) => t.clave === "integrar")?.clave || fila.tareas?.[0]?.clave || "";
  // Una propuesta se presenta y se defiende: su estructura es justificar la recomendación, no explicar para qué sirve.
  const defiende = ["presentar", "probar_audiencia"].includes(clave) && (fila.tareas || []).some((t) => t.tipoPrueba === "defender");
  const estructuraDeTarea = (fila.tareas || []).find((t) => t.clave === clave)?.estructura || null;
  const fija = defiende ? ["Defender una recomendación", "(_We recommend… because…_)"] : (estructuraDeTarea || ESTRUCTURA_POR_TAREA[clave] || ESTRUCTURA_POR_TAREA[clave.split("_")[0]] || null);
  const textos = (cat) => (fila.contenidos || []).filter((c) => c.categoria === cat).map((c) => c.texto);
  // Tareas cuya acción no la sirve la gramática que el reparto le dio a la clase (organizar datos, entender un problema):
  // su estructura es la de la tarea, no la de otro tema de la malla (Rutinas C8, Problemas C5).
  const propia = TAREAS_CON_FUNCION_PROPIA.has(clave);
  const funciones = propia ? [] : textos("funcionales").map((t) => t.replace(/^Funcional:\s*/i, "").trim());
  const gramatica = propia ? [] : textos("gramatica");
  const delTexto = gramatica.map((t) => t.split(":")[0].match(/\bpara (.+)$/)?.[1]).find(Boolean);
  // «Comprar» solo tiene sentido si la unidad pide: en otro tema, will expresa planes.
  const hayPedido = filas.some((f) => f.secciones?.some((x) => PRUEBA_POR_SECCION[x]?.tipo === "pedido"));
  const funcionDelTexto = delTexto && filas.length && !hayPedido && /comprar/i.test(delTexto) ? "Expresar planes" : delTexto;
  // Describir y analizar sin función propia en la malla: la etiqueta nombra la sección que la clase trabaja, no una función
  // de otro tema («actividades cotidianas» en una unidad de frases del aula). Formato aprobado por César, 2026-11-10.
  const secsDeLaTarea = (fila.tareas || []).find((t) => t.clave === clave)?.secciones || [];
  const deSeccion = ETIQUETA_POR_TAREA[clave] && secsDeLaTarea.length >= 1 && secsDeLaTarea.length <= 2
    ? `${ETIQUETA_POR_TAREA[clave]} ${secsDeLaTarea.map((x) => `«${x}»`).join(" y ")}` : "";
  const funcion = funciones.slice(0, 2).join("; ") || deSeccion || (funcionDelTexto ? conMayuscula(funcionDelTexto.trim()) : fija?.[0] || "");
  if (!gramatica.length) {
    if (!fija) return funcion;
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
const palabrasDeTitulo = (t) => new Set(String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length > 2));
/** Dos títulos casi iguales: mismas palabras con otro orden, mayúsculas o una preposición distinta (Jaccard ≥ umbral). */
export const titulosSimilares = (a, b, umbral = 0.7) => {
  const x = palabrasDeTitulo(a);
  const y = palabrasDeTitulo(b);
  if (!x.size || !y.size) return false;
  if (String(a).trim().toLowerCase() === String(b).trim().toLowerCase()) return true;
  const comunes = [...x].filter((w) => y.has(w)).length;
  return comunes / (x.size + y.size - comunes) >= umbral;
};
export const titulosParecidos = (titulos = [], umbral = 0.7) => {
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
  acordar: "Acordando el plan de {p}", problema_analizar: "Entendiendo el problema y sus causas", problema_definir: "Definiendo el problema", problema_objetivos: "Fijando nuestros objetivos", saberes_previos: "Lo que sabemos y queremos saber", recorrer_lugares: "Recorriendo el centro",
  visitar_modelo: "Conociendo una entrevista modelo", visitar_guion: "Escribiendo el guion", visitar_entrevistar: "Entrevistando",
  visitar_registrar: "Registrando lo que dijeron", visitar_segunda: "Completando los datos que faltan",
  describir_modelo: "Analizando una pieza modelo", describir_redactar: "Redactando la pieza", analizar_ordenar: "Ordenando los datos",
  analizar_borrador: "Escribiendo el borrador", analizar_verificar: "Comprobando los datos", proponer_comparar: "Comparando con un texto",
  proponer_elegir: "Eligiendo y justificando", proponer_elaborar: "Elaborando la pieza", aplicar_modelo: "Analizando un modelo",
  aplicar_escribir: "Escribiendo", aplicar_ensayar: "Ensayando", aplicar_anotar: "Anotando la mejora", aplicar_segundo: "Ensayando otra vez",
  aplicar_corregir: "Corrigiendo lo ensayado", socializar_reunir: "Reuniendo lo hecho", socializar_redactar: "Redactando el mensaje",
  socializar_leer: "Leyendo el mensaje a otro grupo", orientar_recorrido: "Haciendo el recorrido", orientar_instrucciones: "Escribiendo las instrucciones",
  orientar_probar: "Probando las instrucciones", comentar: "Comentando las piezas", corregir: "Corrigiendo", revision_docente: "Revisando con la rúbrica",
  revision_nivel: "Comprobando el nivel satisfactorio", indagar_disenar: "Diseñando la encuesta", indagar_aplicar: "Aplicando la encuesta",
  indagar_contrastar: "Contrastando con una fuente", glosario: "Armando el glosario", integrar: "Reuniendo {p}", presentar: "Presentando {p}",
  probar_audiencia: "Probando {p} con la audiencia", audiencia_secundaria: "Mostrando {p} a otra audiencia", evaluar_comentarios: "Respondiendo a los comentarios",
  corregir_final: "Corrigiendo {p}", evaluar_proceso: "Reflexionando sobre lo aprendido",
};
const SIN_SECCION = new Set(["acordar", "problema_analizar", "problema_definir", "problema_objetivos", "saberes_previos", "recorrer_lugares", "glosario", "integrar", "presentar", "probar_audiencia", "audiencia_secundaria", "evaluar_comentarios", "corregir_final", "evaluar_proceso", "indagar_disenar", "indagar_aplicar", "indagar_contrastar", "revision_docente", "revision_nivel"]);
export const tituloDeClase = (fila = {}, producto = "") => {
  const t = fila.tareas?.[0];
  if (!t) return "";
  const p = nombreCorto(producto) || "el producto";
  const base = (TITULO_POR_TAREA[t.clave] || `${t.nombre.charAt(0).toUpperCase()}${t.nombre.slice(1)}`).replace("{p}", p);
  const secs = t.secciones || [];
  return !SIN_SECCION.has(t.clave) && secs.length >= 1 && secs.length <= 3 ? `${base}: ${secs.join(", ")}` : base;
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
export const conErratasCorregidas = (t = "") => String(t).replace(/\p{L}{4,}/gu, (palabra) => {
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
  mapa.filas.forEach((fila) => fila.tareas.filter((t) => t.clave === "indagar_contrastar").forEach((t) => {
    t.recursos = { ...t.recursos, didacticos: String(t.recursos?.didacticos || "").replace("Fuente impresa que trae el docente", `Fuente impresa: ${nombreFuente}`) };
  }));
  const claveBanco = (t) => {
    if (t.clave === "probar_audiencia") return `probar_audiencia:${t.tipoPrueba || "general"}`;
    if (t.clave === "presentar" && t.tipoPrueba === "defender") return "presentar:defender";
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
        .replaceAll("{asunto}", asunto || tema)
        .replaceAll("{fuente}", nombreFuente)
        .replaceAll("{poblacion}", datosEncuesta.poblacion)
        .replaceAll("{preguntas}", datosEncuesta.preguntas)
        .replaceAll("{pregunta}", datosEncuesta.pregunta)
        .replaceAll("{respuestas}", datosEncuesta.respuestas)
        .replaceAll("{cifras}", datosEncuesta.cifras)
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
export const pasosConFrases = (secuencia = [], respuesta = [], { sinLugares = false, nombres = [] } = {}) => secuencia.map((paso, i) => {
  const r = respuesta[i];
  // Solo lo que está en cursiva: a veces la IA repite el paso entero en el hueco.
  const crudo = String((typeof r === "string" ? r : r?.frases) || "");
  const frases = (crudo.match(/_[^_]{2,80}_/g) || []).filter((f) => /\p{L}{2}/u.test(f) && (!sinLugares || !LUGARES_NO_DECLARADOS.test(f)) && !esNombreDelProducto(f, nombres)).slice(0, 2).join(", ");
  return frases ? paso.texto.replace("{frases}", frases) : paso.texto.replace(/\s*\(\{frases\}\)/, "");
});

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

/** Ambiente: solo lo que las tareas usan; ninguna clase depende de tecnología. */
export const ambienteDeMapa = (mapa) => {
  const conInvitado = mapa.filas.some((f) => f.modalidad === "invitado");
  return `Aula ordinaria organizada por grupos editores, con la tabla común, el cartel del acuerdo y las secciones del producto a la vista. Se usan pizarra, cartulinas y materiales impresos; ninguna clase depende de electricidad o internet.${conInvitado ? " El entorno entra al aula por medio de la persona invitada." : ""}`;
};

const estadoDeTarea = (t) => {
  if (t.cierraSeccion) return "versión final";
  if ([].concat(t.demuestra).includes("P")) return "borrador";
  return "insumos recopilados";
};

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
      const estados = [...new Set(suyas.map(estadoDeTarea))];
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
export const armarMapaClases = ({ duracionMin = 45, modalidadVisita = "", contenidosSeleccionados = null, ...entrada } = {}) => {
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
  const items = listarTareas({ estrategia: clave, fases: plan.fases, tiposFase, secciones: plan.secciones, tipos, partenDe: plan.partenDeSecciones, tareasOmitidas: entrada.tareasOmitidas || [], totalClases: total, producto: plan.producto });
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
      entregas: lista.map((t) => t.entrega),
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
  ponerDatosARecoger(filas, plan.secciones);
  encadenar(filas, plan.partenDeSecciones);
  const indicadoresElegidos = plan.fases.flatMap((f) => f.indicadores);
  const sinTarea = ubicarIndicadores(filas, indicadoresElegidos);
  sinTarea.forEach((id) => avisos.push(`El indicador ${id} no tiene tarea de su acción en este mapa.`));
  const contenidosSinLugar = ubicarContenidos(filas, plan, contenidosSeleccionados);
  if (contenidosSinLugar.length) avisos.push(`${contenidosSinLugar.length} contenido(s) del tema quedan sin marcar: no caben con sentido en este tiempo.`);
  return {
    contenidosSinLugar,
    filas, modo, total, capacidad, tipos, seccionesSupuestas: supuestas, avisos, breve,
    estrategia: clave, secciones: plan.secciones, indicadores: indicadoresElegidos.map((i) => i.id),
    contenidos: CATEGORIAS.flatMap((cat) => [...new Set(plan.fases.flatMap((f) => (f.contenidos?.[cat] || []).map((c) => `${cat}:${c.texto}`)))]),
    seleccionados: contenidosSeleccionados, fases: plan.fases.map((f) => f.numero),
    ajustesPlan: ajustesParaPlan(filas, plan.fases),
  };
};

// Estado que deja la clase, para el «aporte al producto» que escribe el código.
const estadoDeFila = (fila) => {
  const claves = fila.tareas.map((t) => t.clave);
  if (claves.includes("acordar")) return "acuerdo y plan";
  if (claves.some((c) => c.startsWith("evaluar"))) return "versión revisada";
  if (claves.includes("presentar") || claves.includes("audiencia_secundaria")) return "presentación";
  if (fila.tareas.some((t) => t.cierraSeccion) || claves.includes("integrar")) return "versión final";
  if (claves.includes("comentar")) return "comentarios";
  if (fila.tareas.some((t) => [].concat(t.demuestra).includes("P"))) return "borrador";
  return "insumos recopilados";
};

/** «Aporte al producto» de una fila: lo escribe el código, no la IA. */
export const aporteDeFila = (fila, producto, secciones = []) => {
  if (fila.flexible) return `«${producto}» (refuerzo): clase flexible del docente, sin pieza nueva`;
  const estado = estadoDeFila(fila);
  const pieza = fila.entregas.join("; ");
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
