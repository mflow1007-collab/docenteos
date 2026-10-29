/**
 * vistaPreviaPlanMaestroService — Puente entre el formulario de unidad y el
 * plan maestro (Etapa 3 de docs/DISENO_CORAZON_DOCENTEOS.md).
 *
 * Convierte los datos del formulario + la malla oficial (curricularContent) en
 * la entrada de construirPlanMaestro, y ofrece las operaciones de ajuste que
 * usa la vista previa (unir, subdividir, sesiones, competencias, indicadores,
 * aspectos). Sin IA ni Firebase: la malla la lee el formulario.
 *
 * Los ajustes del docente viven en `datos.planMaestro` (solo las entradas; el
 * plan se recalcula). Desde la Etapa 5 el generador lo consume
 * (prepararPlanMaestroGeneracion) y la vista previa es obligatoria donde existe.
 * Fail-closed: si falta algo, error visible; nunca contenidos generales en
 * lugar de los del tema.
 * Verificación: scripts/test-vista-previa-plan-maestro.mjs
 */

import { construirPlanMaestro } from "./planMaestroService.js";
import { _extraerContenidosMallaCorpus } from "./unidadAprendizajeService.js";
import { INDICADORES_INGLES_2DO_ESTRUCTURADOS } from "../data/indicadoresIngles2doEstructurados.js";
import { INDICADORES_INGLES_1RO_ESTRUCTURADOS } from "../data/indicadoresIngles1roEstructurados.js";
import { validarSituacion } from "./situacionAprendizajeService.js";

// Mallas con indicadores estructurados (Etapa 1). `clave` une la malla con sus
// situaciones semilla (situacionAprendizajeService.js).
const ESTRUCTURADOS_DISPONIBLES = [
  { clave: "ingles-1ro", etiqueta: "Inglés 1ro de Secundaria", indicadores: INDICADORES_INGLES_1RO_ESTRUCTURADOS },
  { clave: "ingles-2do", etiqueta: "Inglés 2do de Secundaria", indicadores: INDICADORES_INGLES_2DO_ESTRUCTURADOS },
];

export const PLAN_MAESTRO_INICIAL = {
  estrategia: "",
  competenciasElegidas: [],
  indicadoresElegidos: [],
  aspectosElegidos: {},
  unir: [],
  subdividir: {},
  sesionesPorFase: null,
  // Etapa 4 (situacionAprendizajeService.js): situación por elementos y
  // secciones del producto.
  situacion: null,
  secciones: [],
};

const error = (msg) => new Error(`Vista previa: ${msg}`);

const indicadoresDeMalla = (payload) => {
  if (Array.isArray(payload?.indicadoresLogro) && payload.indicadoresLogro.length) return payload.indicadoresLogro;
  return Array.isArray(payload?.indicadores) ? payload.indicadores : [];
};

/**
 * Indicadores estructurados que corresponden a la malla, comparando ids y
 * competencias. null si la malla no tiene estructura todavía; error si
 * coincide a medias (malla y estructura desalineadas).
 */
export const resolverIndicadoresEstructurados = (mallaPayload) => {
  const porId = new Map(indicadoresDeMalla(mallaPayload).map((ind) => [ind?.id, ind]));
  for (const { clave, etiqueta, indicadores } of ESTRUCTURADOS_DISPONIBLES) {
    const presentes = indicadores.filter((ind) => porId.has(ind.id));
    if (!presentes.length) continue;
    const faltan = indicadores.filter((ind) => !porId.has(ind.id)).map((ind) => ind.id);
    if (faltan.length) throw error(`la malla cargada no trae ${faltan.join(", ")} de ${etiqueta}. Reimporta la malla oficial.`);
    const distintos = indicadores
      .filter((ind) => porId.get(ind.id).competenciaId && porId.get(ind.id).competenciaId !== ind.competenciaId)
      .map((ind) => ind.id);
    if (distintos.length) throw error(`en la malla cargada, ${distintos.join(", ")} pertenecen a otra competencia que en ${etiqueta}.`);
    return { clave, etiqueta, indicadores };
  }
  return null;
};

/** Competencias de la malla que tienen indicadores estructurados, con su nombre. */
export const competenciasDeMalla = (mallaPayload, indicadores) => {
  const ids = [...new Set(indicadores.map((ind) => ind.competenciaId))];
  const comps = Array.isArray(mallaPayload?.competencias) ? mallaPayload.competencias : [];
  return ids.map((id) => {
    const c = comps.find((x) => x?.id === id);
    return { id, nombre: c?.fundamental || c?.competenciaFundamental || id };
  });
};

/** Temas de la unidad: los combinados o, si no hay, el título (igual que el generador). */
export const temasDeLaUnidad = ({ temasSeleccionados = [], titulo = "", tema = "" } = {}) => {
  const lista = (temasSeleccionados || []).map((t) => String(t || "").trim()).filter(Boolean);
  if (lista.length) return lista;
  const unico = String(tema || titulo || "").trim();
  return unico ? [unico] : [];
};

/** Contenidos de cada tema, solo del bloque contenidosPorTema de la malla. */
export const contenidosDeTemas = (mallaPayload, temas) => {
  if (!temas.length) throw error("escribe o elige el tema de la unidad.");
  return temas.map((tema) => {
    const c = _extraerContenidosMallaCorpus(mallaPayload, tema);
    if (c.fuenteContenido !== "contenidosPorTema") {
      throw error(`"${tema}" no tiene contenidos propios en la malla oficial (contenidosPorTema). Elige un tema oficial.`);
    }
    return { tema, vocabulario: c.vocabulario, gramatica: c.gramatica, expresiones: c.expresiones, funcionales: c.funcionales };
  });
};

/**
 * Entrada de construirPlanMaestro a partir del formulario y la malla.
 * @returns {{entrada: object|null, estructura: {etiqueta, indicadores}|null}}
 */
export const armarEntradaPlanMaestro = ({ datos = {}, mallaPayload } = {}) => {
  if (!mallaPayload) throw error("no hay malla oficial cargada para este grado y asignatura.");
  const estructura = resolverIndicadoresEstructurados(mallaPayload);
  if (!estructura) return { entrada: null, estructura: null };
  const pm = { ...PLAN_MAESTRO_INICIAL, ...(datos.planMaestro || {}) };
  if (!pm.estrategia) throw error("elige la estrategia de la unidad.");
  const entrada = {
    estrategia: pm.estrategia,
    horario: {
      semanas: Number(datos.numSemanas),
      diasClase: Array.isArray(datos.diasClase) ? datos.diasClase : [],
      horasPorDia: Number(datos.horasPorDia),
    },
    producto: datos.productoFinalTexto,
    indicadoresEstructurados: estructura.indicadores,
    competenciasElegidas: pm.competenciasElegidas,
    indicadoresElegidos: pm.indicadoresElegidos,
    aspectosElegidos: pm.aspectosElegidos,
    contenidosPorTema: contenidosDeTemas(mallaPayload, temasDeLaUnidad(datos)),
    secciones: pm.secciones || [],
    ajustes: {
      unir: pm.unir,
      subdividir: pm.subdividir,
      ...(pm.sesionesPorFase ? { sesionesPorFase: pm.sesionesPorFase } : {}),
    },
  };
  return { entrada, estructura };
};

/** Arma la entrada y construye el plan; los errores se devuelven, no se ocultan. */
export const calcularVistaPrevia = ({ datos, mallaPayload }) => {
  try {
    const { entrada, estructura } = armarEntradaPlanMaestro({ datos, mallaPayload });
    if (!entrada) return { plan: null, estructura: null, error: null, noDisponible: true };
    return { plan: construirPlanMaestro(entrada), estructura, error: null, noDisponible: false };
  } catch (e) {
    return { plan: null, estructura: null, error: e.message, noDisponible: false };
  }
};

/**
 * Etapa 5: la vista previa es obligatoria antes de generar donde existe
 * (asignaturas con indicadores estructurados). Lanza error visible si falta
 * algo. `horario` es el que usará el generador (semanas, días, horas).
 * @returns {{aplica:false}|{aplica:true, plan, estructura, situacionTexto}}
 */
export const prepararPlanMaestroGeneracion = ({ datos = {}, mallaPayload, horario }) => {
  const estructura = resolverIndicadoresEstructurados(mallaPayload);
  if (!estructura) return { aplica: false };
  const datosPlan = {
    ...datos,
    numSemanas: horario.semanas,
    diasClase: horario.diasClase,
    horasPorDia: horario.horasPorDia,
  };
  const vista = calcularVistaPrevia({ datos: datosPlan, mallaPayload });
  if (vista.error) {
    throw error(`completa la «Vista previa del plan maestro» antes de generar. ${vista.error}`);
  }
  const pm = { ...PLAN_MAESTRO_INICIAL, ...(datos.planMaestro || {}) };
  const { texto, errores } = validarSituacion({
    situacion: pm.situacion, producto: datos.productoFinalTexto, estrategia: pm.estrategia,
  });
  if (errores.length) {
    throw error(`la situación de aprendizaje no está lista: ${errores.join(" ")}`);
  }
  return { aplica: true, plan: vista.plan, estructura, situacionTexto: texto };
};

/** Versión que no lanza, para habilitar el botón Generar en el formulario. */
export const estadoPlanMaestroParaGenerar = (args) => {
  try {
    const r = prepararPlanMaestroGeneracion(args);
    return { aplica: r.aplica, listo: true, motivo: "" };
  } catch (e) {
    return { aplica: true, listo: false, motivo: e.message };
  }
};

// ── Ajustes (puros: reciben planMaestro y devuelven uno nuevo) ──────────────
// Cambiar la forma de las fases invalida las sesiones fijadas: se reparten de nuevo.

export const elegirEstrategia = (pm, estrategia) => ({
  ...pm, estrategia, unir: [], subdividir: {}, sesionesPorFase: null,
});

/** Une o separa la fase `num` de la siguiente (números de la Guía). */
export const alternarUnionConSiguiente = (pm, num) => {
  const grupos = (pm.unir || []).map((g) => [...g]);
  const g = grupos.findIndex((grupo) => grupo.includes(num) && grupo.includes(num + 1));
  let nuevos;
  if (g >= 0) {
    const grupo = grupos[g];
    const corte = grupo.indexOf(num) + 1;
    const partes = [grupo.slice(0, corte), grupo.slice(corte)].filter((p) => p.length >= 2);
    nuevos = [...grupos.slice(0, g), ...partes, ...grupos.slice(g + 1)];
  } else {
    const a = grupos.find((grupo) => grupo.includes(num)) || [num];
    const b = grupos.find((grupo) => grupo.includes(num + 1)) || [num + 1];
    nuevos = [...grupos.filter((grupo) => grupo !== a && grupo !== b), [...a, ...b]].sort((x, y) => x[0] - y[0]);
  }
  const subdividir = { ...(pm.subdividir || {}) };
  nuevos.flat().forEach((n) => { delete subdividir[n]; });
  return { ...pm, unir: nuevos, subdividir, sesionesPorFase: null };
};

export const fijarPartes = (pm, num, partes) => {
  const subdividir = { ...(pm.subdividir || {}) };
  if (partes > 1) subdividir[num] = partes; else delete subdividir[num];
  return { ...pm, subdividir, sesionesPorFase: null };
};

/** Fija las sesiones de una fase del plan; las demás quedan como están ahora. */
export const fijarSesiones = (pm, plan, indiceFase, sesiones) => {
  const base = pm.sesionesPorFase || plan.fases.map((f) => f.sesiones);
  const siguiente = [...base];
  siguiente[indiceFase] = sesiones;
  return { ...pm, sesionesPorFase: siguiente };
};

export const repartirDeNuevo = (pm) => ({ ...pm, sesionesPorFase: null });

/** Marca o desmarca una competencia; al marcarla entran todos sus indicadores. */
export const alternarCompetencia = (pm, competenciaId, indicadores) => {
  const ids = indicadores.filter((ind) => ind.competenciaId === competenciaId).map((ind) => ind.id);
  if (pm.competenciasElegidas.includes(competenciaId)) {
    const aspectos = { ...pm.aspectosElegidos };
    ids.forEach((id) => { delete aspectos[id]; });
    return {
      ...pm,
      competenciasElegidas: pm.competenciasElegidas.filter((c) => c !== competenciaId),
      indicadoresElegidos: pm.indicadoresElegidos.filter((id) => !ids.includes(id)),
      aspectosElegidos: aspectos,
    };
  }
  return {
    ...pm,
    competenciasElegidas: [...pm.competenciasElegidas, competenciaId],
    indicadoresElegidos: [...pm.indicadoresElegidos, ...ids.filter((id) => !pm.indicadoresElegidos.includes(id))],
  };
};

export const alternarIndicador = (pm, id) => {
  if (pm.indicadoresElegidos.includes(id)) {
    const aspectos = { ...pm.aspectosElegidos };
    delete aspectos[id];
    return { ...pm, indicadoresElegidos: pm.indicadoresElegidos.filter((x) => x !== id), aspectosElegidos: aspectos };
  }
  return { ...pm, indicadoresElegidos: [...pm.indicadoresElegidos, id] };
};

/** Marca o desmarca un aspecto literal de la lista `l` del indicador. */
export const alternarAspecto = (pm, indicador, l, aspecto) => {
  const actuales = pm.aspectosElegidos[indicador.id] || indicador.listas.map(() => []);
  const lista = actuales[l] || [];
  const nueva = lista.includes(aspecto)
    ? lista.filter((a) => a !== aspecto)
    // Orden literal de la malla, no el del clic.
    : indicador.listas[l].aspectos.filter((a) => a === aspecto || lista.includes(a));
  const marcados = actuales.map((x, i) => (i === l ? nueva : x));
  const aspectos = { ...pm.aspectosElegidos };
  if (marcados.every((x) => !x.length)) delete aspectos[indicador.id];
  else aspectos[indicador.id] = marcados;
  return { ...pm, aspectosElegidos: aspectos };
};
