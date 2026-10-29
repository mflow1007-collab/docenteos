/**
 * planMaestroService — Plan maestro de la unidad (Etapa 2 de
 * docs/DISENO_CORAZON_DOCENTEOS.md, capa 3 de la arquitectura).
 *
 * Código determinista, sin IA ni Firebase: estrategia → fases → sesiones;
 * una entrega del mismo producto por fase; competencias e indicadores/aspectos
 * por fase; contenidos de la malla por fase (los temas se mezclan, no tienen
 * semana propia). Reglas aprobadas por César el 2026-10-26:
 * - Sesiones = semanas × días de clase × horas por día (igual que generarFases).
 *   Reparto proporcional al peso del papel de la fase, restos mayores, mínimo 1.
 *   Si el docente fija las sesiones por fase, deben sumar el total.
 * - Se pueden unir fases contiguas o subdividir una fase en N partes. Una fase
 *   de la Guía con varios papeles se divide sola, una parte por papel, y no se
 *   une ni se subdivide (Etapa 6+, aprobado por César el 2026-10-29).
 * - Cada indicador va a la PRIMERA fase cuyo papel coincide con su acción.
 * - El plan reparte los contenidos que recibe (no los selecciona): intercalados
 *   por tema y en orden entre las fases con contenido.
 * - Aspectos: los marca el docente; sin marcar quedan vacíos (sin sugerencia).
 * - Secciones del producto (regla 4.7, Etapa 4): cada entrega dice qué
 *   secciones avanza; los avances seguidos de una fase con contenido se las
 *   reparten en orden.
 * Fail-closed: cualquier dato que falte o no cuadre lanza un error visible.
 *
 * Módulo PURO. Desde la Etapa 5 el generador redacta cada fase de este plan
 * (redaccionFaseService.js); FASES_POR_ESTRATEGIA queda para el motor anterior.
 * Verificación: scripts/test-plan-maestro.mjs
 */

import { ESTRATEGIAS_FASES_GUIA_2025 } from "../data/estrategiasFasesGuia2025.js";
import {
  ROLES_FASES_POR_ESTRATEGIA, ROL_POR_ACCION, PESO_SESIONES_POR_ROL,
  ENTREGA_POR_ROL, ROLES_CON_CONTENIDO, rolesDeFaseGuia,
} from "../data/rolesFasesEstrategias.js";

const CATEGORIAS_CONTENIDO = ["vocabulario", "gramatica", "expresiones", "funcionales"];

const error = (msg) => new Error(`Plan maestro: ${msg}`);
const esEnteroPositivo = (n) => Number.isInteger(n) && n > 0;

// "Visión compartida" + "Análisis de saberes previos." → "Visión compartida y
// análisis de saberes previos" (como hace el Referente, p. 30).
const nombreUnido = (nombres) => {
  const limpios = nombres.map((n, i) => {
    const sinPunto = n.replace(/\.$/, "");
    return i === 0 ? sinPunto : sinPunto.charAt(0).toLowerCase() + sinPunto.slice(1);
  });
  return limpios.length === 1
    ? limpios[0]
    : `${limpios.slice(0, -1).join(", ")} y ${limpios[limpios.length - 1]}`;
};

// 1. Fases: las literales de la Guía, con uniones y subdivisiones.
const armarFases = (fasesGuia, roles, { unir = [], subdividir = {} }) => {
  const papelesDe = (num) => rolesDeFaseGuia(roles, num);
  const conVariosPapeles = (num) => papelesDe(num).length > 1;
  const grupoDe = new Map();
  unir.forEach((grupo, g) => {
    if (!Array.isArray(grupo) || grupo.length < 2) throw error(`la unión ${JSON.stringify(grupo)} debe tener al menos 2 fases.`);
    grupo.forEach((num, i) => {
      if (!esEnteroPositivo(num) || num > fasesGuia.length) throw error(`la fase ${num} no existe en la estrategia (tiene ${fasesGuia.length}).`);
      if (i > 0 && num !== grupo[i - 1] + 1) throw error(`solo se unen fases contiguas: ${JSON.stringify(grupo)}.`);
      if (grupoDe.has(num)) throw error(`la fase ${num} está en más de una unión.`);
      if (conVariosPapeles(num)) throw error(`la fase ${num} se divide sola en ${papelesDe(num).length} partes (una por papel): no se puede unir.`);
      grupoDe.set(num, g);
    });
  });
  for (const [clave, partes] of Object.entries(subdividir)) {
    const num = Number(clave);
    if (!esEnteroPositivo(num) || num > fasesGuia.length) throw error(`la fase ${clave} no existe en la estrategia (tiene ${fasesGuia.length}).`);
    if (!Number.isInteger(partes) || partes < 2) throw error(`la fase ${num} se subdivide en al menos 2 partes (recibido ${partes}).`);
    if (grupoDe.has(num)) throw error(`la fase ${num} está unida a otra: no se puede subdividir.`);
    if (conVariosPapeles(num)) throw error(`la fase ${num} ya se divide sola en ${papelesDe(num).length} partes (una por papel).`);
  }

  const bloques = [];
  fasesGuia.forEach((nombre, i) => {
    const num = i + 1;
    const g = grupoDe.get(num);
    const previo = bloques[bloques.length - 1];
    if (g !== undefined && previo && previo.grupo === g) {
      previo.numerosGuia.push(num);
    } else {
      bloques.push({ grupo: g, numerosGuia: [num] });
    }
  });

  const fases = [];
  bloques.forEach(({ numerosGuia }) => {
    const nombres = numerosGuia.map((n) => fasesGuia[n - 1]);
    if (conVariosPapeles(numerosGuia[0])) {
      const papeles = papelesDe(numerosGuia[0]);
      papeles.forEach((rol, p) => fases.push({
        nombre: `${nombreUnido(nombres)} (${p + 1}/${papeles.length})`,
        fasesGuia: nombres,
        parte: { n: p + 1, de: papeles.length },
        roles: [rol],
        _peso: PESO_SESIONES_POR_ROL[rol],
      }));
      return;
    }
    const rolesBloque = [...new Set(numerosGuia.map((n) => roles[n - 1]))];
    const peso = numerosGuia.reduce((s, n) => s + PESO_SESIONES_POR_ROL[roles[n - 1]], 0);
    const partes = subdividir[numerosGuia[0]] || 1;
    for (let p = 1; p <= partes; p += 1) {
      fases.push({
        nombre: partes > 1 ? `${nombreUnido(nombres)} (${p}/${partes})` : nombreUnido(nombres),
        fasesGuia: nombres,
        parte: partes > 1 ? { n: p, de: partes } : null,
        roles: rolesBloque,
        _peso: peso / partes,
      });
    }
  });
  return fases.map((f, i) => ({ numero: i + 1, ...f }));
};

// 2. Sesiones: proporcional al peso, restos mayores (desempate por orden),
// mínimo 1 por fase quitando a la fase con más sesiones.
const repartirSesiones = (fases, total, fijadas) => {
  if (fijadas) {
    if (!Array.isArray(fijadas) || fijadas.length !== fases.length) {
      throw error(`las sesiones fijadas por fase deben ser ${fases.length} (una por fase); recibidas ${Array.isArray(fijadas) ? fijadas.length : 0}.`);
    }
    if (!fijadas.every(esEnteroPositivo)) throw error("cada fase necesita al menos 1 sesión (enteros positivos).");
    const suma = fijadas.reduce((s, n) => s + n, 0);
    if (suma !== total) throw error(`las sesiones fijadas suman ${suma} y el horario da ${total}.`);
    return [...fijadas];
  }
  if (total < fases.length) {
    throw error(`el horario da ${total} sesiones y la estrategia tiene ${fases.length} fases. Une fases o amplía el horario.`);
  }
  const pesoTotal = fases.reduce((s, f) => s + f._peso, 0);
  const exactos = fases.map((f) => (total * f._peso) / pesoTotal);
  const sesiones = exactos.map(Math.floor);
  let faltan = total - sesiones.reduce((s, n) => s + n, 0);
  const orden = exactos
    .map((x, i) => ({ i, resto: x - Math.floor(x) }))
    .sort((a, b) => b.resto - a.resto || a.i - b.i);
  for (let k = 0; faltan > 0; k += 1, faltan -= 1) sesiones[orden[k].i] += 1;
  for (let i = 0; i < sesiones.length; i += 1) {
    while (sesiones[i] < 1) {
      const mayor = sesiones.indexOf(Math.max(...sesiones));
      sesiones[mayor] -= 1;
      sesiones[i] += 1;
    }
  }
  return sesiones;
};

// 3. Entregas: el estado del producto que deja la fase (el de su último papel);
// si el mismo estado se repite seguido, se numeran los avances.
// Secciones (regla 4.7): cada entrega avanza todas las secciones a su estado;
// los avances seguidos de una fase con contenido se reparten las secciones en
// orden (avance 1: Welcome, Important Places; avance 2: …).
const asignarEntregas = (fases, producto, secciones, avisos) => {
  const roles = fases.map((f) => f.roles[f.roles.length - 1]);
  const estados = roles.map((rol) => ENTREGA_POR_ROL[rol]);
  return estados.map((estado, i) => {
    let ini = i; while (ini > 0 && estados[ini - 1] === estado) ini -= 1;
    let fin = i; while (fin < estados.length - 1 && estados[fin + 1] === estado) fin += 1;
    const avance = fin > ini ? ` (avance ${i - ini + 1} de ${fin - ini + 1})` : "";
    let suyas = secciones;
    if (fin > ini && ROLES_CON_CONTENIDO.includes(roles[i])) {
      const n = fin - ini + 1;
      const k = i - ini;
      suyas = secciones.slice(Math.floor((k * secciones.length) / n), Math.floor(((k + 1) * secciones.length) / n));
      if (secciones.length && !suyas.length) avisos.push(`${estado} (avance ${k + 1} de ${n}): hay más avances que secciones; este avance no tiene sección propia.`);
    }
    return { estado, texto: `${estado} de ${producto}${avance}`, secciones: [...suyas] };
  });
};

const validarSecciones = (secciones) => {
  if (!Array.isArray(secciones)) throw error("las secciones del producto deben ser una lista.");
  const nombres = secciones.map((s) => String(s ?? "").trim());
  if (nombres.some((s) => !s)) throw error("hay una sección del producto sin nombre.");
  const repetida = nombres.find((s, i) => nombres.indexOf(s) !== i);
  if (repetida) throw error(`la sección "${repetida}" está repetida.`);
  return nombres;
};

// 4. Competencias e indicadores elegidos, con sus aspectos marcados.
const resolverIndicadores = ({ indicadoresEstructurados, competenciasElegidas, indicadoresElegidos, aspectosElegidos }) => {
  if (!Array.isArray(indicadoresEstructurados) || !indicadoresEstructurados.length) {
    throw error("faltan los indicadores estructurados de la malla (tronco / aspectos / cierre).");
  }
  const competenciasMalla = [...new Set(indicadoresEstructurados.map((ind) => ind.competenciaId))];
  if (!Array.isArray(competenciasElegidas) || !competenciasElegidas.length) {
    throw error("el docente no ha elegido ninguna competencia.");
  }
  competenciasElegidas.forEach((id) => {
    if (!competenciasMalla.includes(id)) throw error(`la competencia ${id} no está en la malla.`);
  });
  const porId = new Map(indicadoresEstructurados.map((ind) => [ind.id, ind]));
  const ids = indicadoresElegidos
    ? indicadoresElegidos
    : indicadoresEstructurados.filter((ind) => competenciasElegidas.includes(ind.competenciaId)).map((ind) => ind.id);
  const elegidos = ids.map((id) => {
    const ind = porId.get(id);
    if (!ind) throw error(`el indicador ${id} no está en la malla.`);
    if (!competenciasElegidas.includes(ind.competenciaId)) throw error(`el indicador ${id} es de la competencia ${ind.competenciaId}, que no está elegida.`);
    if (!ROL_POR_ACCION[ind.accion]) throw error(`el indicador ${id} tiene una acción desconocida: "${ind.accion}".`);
    const marcados = aspectosElegidos?.[id] || ind.listas.map(() => []);
    if (!Array.isArray(marcados) || marcados.length !== ind.listas.length) {
      throw error(`el indicador ${id} tiene ${ind.listas.length} lista(s) de aspectos; se recibieron ${Array.isArray(marcados) ? marcados.length : 0}.`);
    }
    marcados.forEach((lista, l) => lista.forEach((a) => {
      if (!ind.listas[l].aspectos.includes(a)) throw error(`"${a}" no es un aspecto literal de la lista ${l + 1} del indicador ${id}.`);
    }));
    return { id, competenciaId: ind.competenciaId, accion: ind.accion, aspectosElegidos: marcados.map((lista) => [...lista]) };
  });
  Object.keys(aspectosElegidos || {}).forEach((id) => {
    if (!ids.includes(id)) throw error(`hay aspectos marcados para ${id}, que no es un indicador elegido.`);
  });
  const competencias = competenciasMalla.map((id) => ({
    id,
    elegida: competenciasElegidas.includes(id),
    indicadores: elegidos.filter((ind) => ind.competenciaId === id).map((ind) => ind.id),
  }));
  return { elegidos, competencias };
};

// 5. Contenidos: cada categoría se intercala por tema (A1, B1, A2, B2…), se
// quitan repetidos (guardando de qué temas viene) y se reparte en trozos
// seguidos entre las fases con contenido. Si hay menos elementos que fases,
// cada elemento se repite en fases seguidas.
const repartirContenidos = (contenidosPorTema, numFasesContenido) => {
  if (!Array.isArray(contenidosPorTema) || !contenidosPorTema.length) {
    throw error("faltan los contenidos de la malla para los temas de la unidad.");
  }
  contenidosPorTema.forEach((c) => {
    if (!c?.tema) throw error("cada bloque de contenidos necesita su tema.");
  });
  const avisos = [];
  const porCategoria = {};
  CATEGORIAS_CONTENIDO.forEach((cat) => {
    const listas = contenidosPorTema.map((c) => (Array.isArray(c[cat]) ? c[cat] : []));
    const largo = Math.max(0, ...listas.map((l) => l.length));
    const items = [];
    const indice = new Map();
    for (let k = 0; k < largo; k += 1) {
      listas.forEach((lista, t) => {
        const texto = String(lista[k] ?? "").trim();
        if (!texto) return;
        const tema = contenidosPorTema[t].tema;
        if (indice.has(texto)) {
          const item = items[indice.get(texto)];
          if (!item.temas.includes(tema)) item.temas.push(tema);
        } else {
          indice.set(texto, items.length);
          items.push({ texto, temas: [tema] });
        }
      });
    }
    const trozos = [];
    if (items.length && items.length < numFasesContenido) {
      // Pocos elementos (Etapa 6+, aprobado por César): cada uno se repite en
      // fases seguidas para que ninguna fase con contenido quede sin semilla (4.6).
      avisos.push(`${cat}: ${items.length} elemento(s) para ${numFasesContenido} fases con contenido; cada uno se repite en fases seguidas.`);
      for (let f = 0; f < numFasesContenido; f += 1) {
        const item = items[Math.floor((f * items.length) / numFasesContenido)];
        trozos.push([{ texto: item.texto, temas: [...item.temas] }]);
      }
      porCategoria[cat] = trozos;
      return;
    }
    for (let f = 0; f < numFasesContenido; f += 1) {
      const desde = Math.floor((f * items.length) / numFasesContenido);
      const hasta = Math.floor(((f + 1) * items.length) / numFasesContenido);
      trozos.push(items.slice(desde, hasta));
    }
    porCategoria[cat] = trozos;
  });
  return { porCategoria, avisos };
};

/**
 * @param {object} entrada
 * @param {string} entrada.estrategia - clave de ESTRATEGIAS_FASES_GUIA_2025.
 * @param {{semanas:number, diasClase:string[], horasPorDia:number}} entrada.horario
 * @param {string} entrada.producto - producto central de la unidad.
 * @param {object[]} entrada.indicadoresEstructurados - p. ej. INDICADORES_INGLES_2DO_ESTRUCTURADOS.
 * @param {string[]} entrada.competenciasElegidas - ids de competencia que eligió el docente.
 * @param {string[]} [entrada.indicadoresElegidos] - por defecto, todos los de las competencias elegidas.
 * @param {Object<string,string[][]>} [entrada.aspectosElegidos] - id → aspectos marcados por lista.
 * @param {{tema:string, vocabulario?:string[], gramatica?:string[], expresiones?:string[], funcionales?:string[]}[]} entrada.contenidosPorTema
 * @param {string[]} [entrada.secciones] - secciones del producto (regla 4.7); sin ellas, las entregas no nombran secciones.
 * @param {{unir?:number[][], subdividir?:Object<number,number>, sesionesPorFase?:number[]}} [entrada.ajustes]
 *   Números de fase = posición en la Guía (1 = primera fase impresa).
 */
export const construirPlanMaestro = ({
  estrategia,
  horario,
  producto,
  indicadoresEstructurados,
  competenciasElegidas,
  indicadoresElegidos,
  aspectosElegidos,
  contenidosPorTema,
  secciones = [],
  ajustes = {},
} = {}) => {
  const datosEstrategia = ESTRATEGIAS_FASES_GUIA_2025.find((e) => e.clave === estrategia);
  if (!datosEstrategia) throw error(`la estrategia "${estrategia}" no está en la Guía 2025.`);
  const roles = ROLES_FASES_POR_ESTRATEGIA[estrategia];
  if (!roles) throw error(`la estrategia "${datosEstrategia.nombre}" todavía no tiene papeles de fase aprobados.`);
  if (roles.length !== datosEstrategia.fases.length) {
    throw error(`los papeles de "${datosEstrategia.nombre}" (${roles.length}) no cuadran con sus fases (${datosEstrategia.fases.length}).`);
  }
  const productoLimpio = String(producto || "").trim();
  if (!productoLimpio) throw error("falta el producto de la unidad.");
  const { semanas, diasClase, horasPorDia } = horario || {};
  if (!esEnteroPositivo(semanas) || !Array.isArray(diasClase) || !diasClase.length || !esEnteroPositivo(horasPorDia)) {
    throw error("el horario necesita semanas, días de clase y horas por día.");
  }
  const totalSesiones = semanas * diasClase.length * horasPorDia;

  const fases = armarFases(datosEstrategia.fases, roles, ajustes);
  const sesiones = repartirSesiones(fases, totalSesiones, ajustes.sesionesPorFase);
  const avisosSecciones = [];
  const seccionesLimpias = validarSecciones(secciones);
  const entregas = asignarEntregas(fases, productoLimpio, seccionesLimpias, avisosSecciones);
  const { elegidos, competencias } = resolverIndicadores({
    indicadoresEstructurados, competenciasElegidas, indicadoresElegidos, aspectosElegidos,
  });

  const indicadoresPorFase = fases.map(() => []);
  elegidos.forEach((ind) => {
    const rol = ROL_POR_ACCION[ind.accion];
    const f = fases.findIndex((fase) => fase.roles.includes(rol));
    if (f < 0) throw error(`ninguna fase de "${datosEstrategia.nombre}" trabaja la acción "${ind.accion}" del indicador ${ind.id}.`);
    indicadoresPorFase[f].push(ind);
  });

  const conContenido = fases.map((f) => f.roles.some((r) => ROLES_CON_CONTENIDO.includes(r)));
  const numFasesContenido = conContenido.filter(Boolean).length;
  if (!numFasesContenido) throw error(`ninguna fase de "${datosEstrategia.nombre}" recibe contenidos.`);
  const { porCategoria, avisos } = repartirContenidos(contenidosPorTema, numFasesContenido);

  let sesionInicial = 1;
  let k = 0;
  const fasesPlan = fases.map(({ _peso, ...fase }, i) => {
    const desde = sesionInicial;
    sesionInicial += sesiones[i];
    const contenidos = Object.fromEntries(CATEGORIAS_CONTENIDO.map((cat) => [cat, conContenido[i] ? porCategoria[cat][k] : []]));
    if (conContenido[i]) k += 1;
    return {
      ...fase,
      sesiones: sesiones[i],
      rangoSesiones: { desde, hasta: sesionInicial - 1 },
      entrega: entregas[i],
      indicadores: indicadoresPorFase[i],
      contenidos,
    };
  });

  return {
    version: 1,
    estrategia: { clave: datosEstrategia.clave, nombre: datosEstrategia.nombre },
    producto: productoLimpio,
    secciones: seccionesLimpias,
    temas: contenidosPorTema.map((c) => c.tema),
    horario: { semanas, diasClase: [...diasClase], horasPorDia, totalSesiones },
    fases: fasesPlan,
    competencias,
    avisos: [...avisos, ...avisosSecciones],
  };
};
