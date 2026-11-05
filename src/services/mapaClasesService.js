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
  SECCIONES_POR_COMENTAR, SECCIONES_POR_CORREGIR, TIPO_APROBADO_POR_SECCION, DETALLE_TAREA,
  INVENTARIO_POR_SECCION, ALCANCE_POR_SEMILLA,
} from "../data/tareasPorTipoTrabajo.js";

export const CLASES_MINIMAS = 3;
// Más contenidos no caben con sentido en una clase: lo demás queda sin marcar en la tabla.
export const TOPE_CONTENIDOS_POR_CLASE = 6;
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
  const comentarios = items.find((it) => it.t.clave === "evaluar_comentarios");
  comentarios.fase = Math.max(comentarios.fase, presentar.fase);
  // La autoevaluación va después de la sumativa, aunque comparta clase (César, 2026-11-04).
  items.filter((it) => it.t.clave === "evaluar_proceso").forEach((it) => { it.fase = Math.max(it.fase, comentarios.fase); });
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
    { tareas: unidad("acordar"), peso: 30 },
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
  const sinLugar = [];
  // Prioridad = el orden en que se llama: funciones, su gramática, vocabulario, expresiones.
  const poner = (fila, cat, texto) => {
    const destino = fila.contenidos.length < TOPE_CONTENIDOS_POR_CLASE ? fila : utiles.find((f) => f.contenidos.length < TOPE_CONTENIDOS_POR_CLASE);
    if (destino) destino.contenidos.push({ categoria: cat, texto }); else sinLugar.push(`${cat}:${texto}`);
  };
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
const AGENTE_TAREA = { comentar: "Coevaluación", evaluar_proceso: "Autoevaluación y coevaluación", aplicar_ensayar: "Coevaluación" };
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
  else if (fila.tareas.some((t) => t.cierraSeccion) || claves.includes("integrar")) instrumento = "Rúbrica analítica (Anexo A)";
  else if (claves.includes("acordar")) instrumento = "Evaluación diagnóstica (Anexo J)";
  else if (claves.includes("evaluar_proceso")) instrumento = "Lista de cotejo; autoevaluación (Anexo E) y coevaluación (Anexo D)";
  return { tipo, agente, tecnica: [...new Set(lista.map((p) => p[0]))].join(" y "), instrumento };
};

/** Recursos humanos de una clase: el invitado cuenta si la tarea lo requiere. */
export const humanosDeFila = (fila, alcance = null) => {
  const claves = fila.tareas.map((t) => t.clave);
  const invitado = alcance?.invitado || "la persona invitada";
  if (claves.includes("presentar")) {
    return `Docente, estudiantes, ${invitado}${alcance?.visitante ? ` y ${alcance.visitante}` : ""}`;
  }
  if (claves.includes("visitar_entrevistar") && fila.modalidad === "invitado") return `Docente, estudiantes y ${invitado}`;
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

/** La firma que promete la tarea la escribe el código, en la actividad de esa tarea. */
export const conFirmas = (actividades, tareasMapa = []) => {
  const lista = [...actividades];
  tareasMapa.forEach((t, i) => {
    const { firma, senal } = DETALLE_TAREA[t.clave] || {};
    if (!firma || !lista.length) return;
    const texto = (a) => normal(typeof a === "string" ? a : Object.values(a || {}).join(" "));
    const porSenal = lista.findIndex((a) => new RegExp(senal).test(texto(a)));
    const donde = lista.length === tareasMapa.length ? i : (porSenal >= 0 ? porSenal : lista.length - 1);
    if (/\bfirm/.test(texto(lista[donde])) || typeof lista[donde] !== "string") return;
    lista[donde] = `${lista[donde].trim()} ${firma}`;
  });
  return lista;
};

/**
 * Ficha de la unidad: una sola decisión de modalidad y alcance, que leen la situación,
 * el producto y el ambiente (César, 2026-11-04). Devuelve los datos con la situación ya
 * ajustada. Nunca pisa lo que escribió el docente.
 */
export const conFichaDeUnidad = (datos) => {
  const pm = datos.planMaestro || {};
  const s = pm.situacion;
  if (!s || pm.estrategia !== "insercion_entorno") return datos;
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
  const COMPARTIDAS = ["acordar", "comentar", "glosario", "integrar", "presentar", "audiencia_secundaria", "evaluar_comentarios", "evaluar_proceso"];
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
      instruccion: DETALLE_TAREA[t.clave]?.hace || "", senal: DETALLE_TAREA[t.clave]?.senal || "",
      soloComprender: Boolean(DETALLE_TAREA[t.clave]?.soloComprender),
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
