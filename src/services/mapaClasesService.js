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
import { TIPO_TRABAJO_FASES_POR_ESTRATEGIA, MODALIDAD_VISITA_POR_DEFECTO } from "../data/rolesFasesEstrategias.js";
import {
  TAREAS_POR_TIPO, TAREAS_UNIDAD, TAREA_COMENTAR, TAREA_CORREGIR,
  SECCIONES_POR_COMENTAR, SECCIONES_POR_CORREGIR, TIPO_APROBADO_POR_SECCION,
} from "../data/tareasPorTipoTrabajo.js";

export const CLASES_MINIMAS = 3;
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
const listarTareas = ({ fases, tiposFase, secciones, tipos, partenDe }) => {
  const orden = ordenarSecciones(secciones, tipos, partenDe);
  const items = [];
  const push = (t, seccionesT, bloque, orden1, orden2, faseForzada) => items.push({
    t, secciones: seccionesT, bloque, orden1, orden2, faseForzada, fase: null,
  });
  orden.forEach((seccion, s) => {
    TAREAS_POR_TIPO[tipos[seccion]].forEach((t, p) => push(t, [seccion], 1, s, p));
  });
  const comentables = orden.filter((s) => !["aplicar", "proponer"].includes(tipos[s]));
  trozos(comentables, SECCIONES_POR_COMENTAR).forEach((grupo, g) => push(TAREA_COMENTAR, grupo, 2, 0, g));
  const corregibles = orden.filter((s) => tipos[s] !== "aplicar");
  const tempranas = corregibles.filter((s) => ["visitar", "describir", "socializar"].includes(tipos[s]));
  const tardias = corregibles.filter((s) => !tempranas.includes(s));
  trozos(tempranas, SECCIONES_POR_CORREGIR).forEach((grupo, g) => push({ ...TAREA_CORREGIR, faseInsercion: "socializar" }, grupo, 2, 1, g));
  trozos(tardias, SECCIONES_POR_CORREGIR).forEach((grupo, g) => push({ ...TAREA_CORREGIR, faseInsercion: "proponer" }, grupo, 2, 2, g));
  const u = TAREAS_UNIDAD;
  push(u.acordar, [...orden], 0, 0, 0);
  push(u.glosario, [...orden], 3, 0, 0);
  push(u.integrar, [...orden], 3, 1, 0);
  push(u.presentar, [...orden], 3, 2, 0);
  push(u.audienciaSecundaria, [...orden], 3, 3, 0);
  push(u.evaluarComentarios, [...orden], 3, 4, 0);
  push(u.evaluarProceso, [...orden], 3, 5, 0);

  // Fase de cada tarea, contando por papel para repartir entre fases iguales.
  const porRol = {};
  items.forEach((it) => { porRol[it.t.rol] = (porRol[it.t.rol] || 0) + 1; });
  const visto = {};
  items.forEach((it) => {
    const k = visto[it.t.rol] || 0;
    visto[it.t.rol] = k + 1;
    it.fase = buscarFase(fases, tiposFase, it.t, k, porRol[it.t.rol]);
  });
  // Cerrar la unidad en orden aunque la Guía ponga Evaluación antes de Socialización:
  // comprender los comentarios de la audiencia va con o después de presentar.
  const presentar = items.find((it) => it.t.clave === "presentar");
  items.filter((it) => it.t.clave === "evaluar_comentarios").forEach((it) => { it.fase = Math.max(it.fase, presentar.fase); });
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
    if (actual && usado + it.minutos <= capacidad && (cruzar || actual[actual.length - 1].fase === it.fase)) actual.push(it);
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
    { tareas: unidad("acordar"), peso: 15 },
    { tareas: bloqueDe("C"), peso: pesoBloque(bloqueDe("C")), paralelo: true },
    { tareas: bloqueDe("P"), peso: pesoBloque(bloqueDe("P")), paralelo: true },
    { tareas: bloqueDe("M"), peso: pesoBloque(bloqueDe("M")), paralelo: true },
    { tareas: unidad("integrar"), peso: 9 },
    { tareas: unidad("presentar"), peso: 15 },
    { tareas: [...unidad("evaluar_comentarios"), ...unidad("evaluar_proceso")], peso: 17 },
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
  const poner = (fila, cat, texto) => { fila.contenidos.push({ categoria: cat, texto }); };
  const enOrden = (lista, cat, destinos) => lista.forEach((t, i) => poner(destinos[Math.floor((i * destinos.length) / lista.length)], cat, t));
  const conUso = candidatas((f) => hay(f, "P") || hay(f, "I"));
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
  return Object.values(items).flat().length;
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
        if (!t.indicadores.includes(id)) t.indicadores.push(id);
        if (!fila.indicadores.includes(id)) fila.indicadores.push(id);
      });
    });
  });
  // Más indicadores que tareas de su acción: comparten tarea, en rotación.
  Object.entries(porAccion).forEach(([accion, lista]) => {
    const letra = Object.keys(ACCION_DE).find((l) => ACCION_DE[l] === accion);
    const destinos = filas.filter((f) => f.tareas.some((t) => [].concat(t.demuestra).includes(letra)));
    lista.filter((id) => !filas.some((f) => f.indicadores.includes(id))).forEach((id, i) => {
      if (!destinos.length) return;
      const fila = destinos[i % destinos.length];
      fila.indicadores.push(id);
      fila.tareas.find((t) => [].concat(t.demuestra).includes(letra)).indicadores.push(id);
    });
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
      else if (t.clave === "presentar" || t.clave === "audiencia_secundaria" || t.clave === "glosario" || t.clave.startsWith("evaluar")) {
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
      else if (["integrar", "presentar", "audiencia_secundaria", "evaluar_comentarios", "evaluar_proceso", "glosario"].includes(t.clave)) producto = entrega;
      else t.secciones.forEach((s) => { ultima[s] = entrega; });
    });
    fila.recibe = fila.tareas.flatMap((t) => t.recibe).filter((r) => r.clase !== fila.clase)
      .filter((r, i, l) => l.findIndex((x) => x.texto === r.texto && x.clase === r.clase) === i);
  });
};

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
  const items = listarTareas({ fases: plan.fases, tiposFase, secciones: plan.secciones, tipos, partenDe: plan.partenDeSecciones });
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
  const filas = clases.map((tareas, c) => {
    const lista = tareas.map(({ t, secciones, minutos, fase, paralelo }) => ({
      clave: t.clave, nombre: t.nombre, secciones: [...secciones], minutos, fase, paralelo: Boolean(paralelo),
      demuestra: t.demuestra, evidencia: t.evidencia, condicion: t.condicion, organizacion: t.organizacion,
      entrega: t.entrega, individual: Boolean(t.individual), sumativa: Boolean(t.sumativa), cierraSeccion: Boolean(t.cierraSeccion),
      llegaAudiencia: Boolean(t.llegaAudiencia), ampliacion: Boolean(t.ampliacion), recursos: t.recursos,
      modalidad: t.usaModalidad ? modalidad : null, recibe: [], indicadores: [],
    }));
    const usados = lista.some((t) => t.paralelo)
      ? [...new Set(lista.map((t) => t.secciones[0]))].reduce((m, s) => Math.max(m, lista.filter((t) => t.secciones[0] === s).reduce((a, t) => a + t.minutos, 0)), 0)
      : lista.reduce((s, t) => s + t.minutos, 0);
    return {
      clase: c + 1, flexible: false, tareas: lista,
      secciones: [...new Set(lista.flatMap((t) => t.secciones))],
      fases: [...new Set(lista.map((t) => t.fase))].sort((a, b) => a - b).map(faseInfo),
      minutos: usados, minutosLibres: Math.max(0, capacidad - usados),
      indicadores: [], contenidos: [], recibe: [],
      entregas: lista.map((t) => t.entrega),
      evidencias: lista.map((t) => ({ tipo: t.evidencia, condicion: t.condicion, individual: t.individual, sumativa: t.sumativa })),
      modalidad: lista.find((t) => t.modalidad)?.modalidad || null,
    };
  });

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
    const destino = filas.find((f) => f.fases.some((x) => x.numero > i + 1)) || filas[filas.length - 1];
    destino.fases = [...destino.fases, faseInfo(i)].sort((a, b) => a.numero - b.numero);
    avisos.push(`La fase «${plan.fases[i].nombre}» no tiene tarea propia y se une a la clase ${destino.clase}.`);
  });

  filas.forEach((f, i) => { f.semana = Math.ceil((i + 1) / (diasClase.length * horasPorDia)); });
  encadenar(filas, plan.partenDeSecciones);
  const indicadoresElegidos = plan.fases.flatMap((f) => f.indicadores);
  const sinTarea = ubicarIndicadores(filas, indicadoresElegidos);
  sinTarea.forEach((id) => avisos.push(`El indicador ${id} no tiene tarea de su acción en este mapa.`));
  ubicarContenidos(filas, plan, contenidosSeleccionados);
  return {
    filas, modo, total, capacidad, tipos, seccionesSupuestas: supuestas, avisos, breve,
    estrategia: clave, secciones: plan.secciones, indicadores: indicadoresElegidos.map((i) => i.id),
    contenidos: CATEGORIAS.flatMap((cat) => [...new Set(plan.fases.flatMap((f) => (f.contenidos?.[cat] || []).map((c) => `${cat}:${c.texto}`)))]),
    seleccionados: contenidosSeleccionados, fases: plan.fases.map((f) => f.numero),
    ajustesPlan: ajustesParaPlan(filas, plan.fases),
  };
};

/** Reglas de calidad del diseño. Devuelve la lista de incumplimientos (vacía = cumple). */
export const verificarMapa = (mapa) => {
  const fallos = [];
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
    t.recibe.forEach((r) => { if (r.clase !== null && r.clase > t.clase) fallos.push(`clase ${t.clase} recibe de una clase posterior (${r.clase})`); });
    if (!t.recibe.length) fallos.push(`clase ${t.clase}: «${t.nombre}» no tiene origen`);
  });
  mapa.indicadores.forEach((id) => { if (!reales.some((f) => f.indicadores.includes(id))) fallos.push(`el indicador ${id} no tiene tarea`); });
  const puestos = new Set(reales.flatMap((f) => f.contenidos.map((c) => `${c.categoria}:${c.texto}`)));
  mapa.contenidos.filter((c) => !mapa.seleccionados || mapa.seleccionados.includes(c.slice(c.indexOf(":") + 1)))
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
