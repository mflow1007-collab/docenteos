/**
 * indicadoresDesdeMallaService — Indicadores estructurados (tronco / aspectos / cierre) sacados de la malla
 * oficial de cualquier grado, para que el plan maestro y el mapa de clases funcionen en todos los grados
 * (César, 2026-11-11: «ese motor debe ser para todos los grados»). Inglés 2do conserva su versión hecha a mano.
 *
 * Reglas (las mismas de indicadoresIngles2doEstructurados.js):
 * - `accion` sale de la posición del indicador en la tríada de su competencia (1.º responde · 2.º produce ·
 *   3.º interactúa). Una competencia que no tenga exactamente 3 indicadores no se estructura: error visible.
 * - La lista de aspectos solo se separa si el texto oficial se recompone LETRA POR LETRA
 *   (recomponerIndicador). Si no, el indicador va entero en `tronco`, sin aspectos que recortar.
 *   Nunca se cambia una palabra del texto oficial.
 *
 * Módulo PURO. Verificación: scripts/test-indicadores-desde-malla.mjs
 */

import { recomponerIndicador } from "../data/indicadoresIngles2doEstructurados.js";

const ACCIONES = ["responde", "produce", "interactua"];

// Dónde empieza la lista de aspectos en los indicadores MINERD de Lenguas Extranjeras y dónde termina.
const INICIOS = [
  "cuya finalidad es ", "con la intención de ", "con el fin de ", "con la finalidad de ", "para ",
  "tales como ", "información sobre ", "informaciones sobre ", "relacionados con ", "sobre ",
];
const FINALES = [", siempre que", ", aunque", ", utilizando", ", usando", ", con ", ", en ", ", a partir de", ", mediante", ", respetando"];

/** Separa «a, b, c y d» en aspectos con sus enlaces literales; null si no hay al menos 3 aspectos. */
const partirLista = (texto) => {
  const partes = texto.split(", ");
  const ultima = partes.pop();
  const corte = ultima.lastIndexOf(" y ");
  if (corte < 0) return null;
  const aspectos = [...partes, ultima.slice(0, corte), ultima.slice(corte + 3)];
  if (aspectos.length < 3 || aspectos.some((a) => !a.trim() || a.length > 90)) return null;
  const enlaces = aspectos.map((_, i) => (i === aspectos.length - 1 ? "" : i === aspectos.length - 2 ? " y " : ", "));
  return { aspectos, enlaces };
};

/** Tronco, lista y cierre de un texto oficial; sin lista si no se recompone exacto. */
export const estructurarTexto = (texto) => {
  const t = String(texto || "");
  for (const inicio of INICIOS) {
    const i = t.indexOf(inicio);
    if (i < 0) continue;
    const desde = i + inicio.length;
    const resto = t.slice(desde);
    const fin = FINALES.map((f) => resto.indexOf(f)).filter((k) => k > 0).sort((a, b) => a - b)[0]
      ?? (resto.endsWith(".") ? resto.length - 1 : resto.length);
    const lista = partirLista(resto.slice(0, fin));
    if (!lista) continue;
    const e = { tronco: t.slice(0, desde), listas: [lista], entre: [], cierre: resto.slice(fin) };
    if (recomponerIndicador(e) === t) return e;
  }
  return { tronco: t, listas: [], entre: [], cierre: "" };
};

/**
 * Indicadores estructurados de una malla (payload de curricularContent). null si la malla no trae indicadores
 * con competencia. Error visible si alguna competencia no tiene su tríada completa (fail-closed).
 */
export const indicadoresEstructuradosDeMalla = (payload) => {
  const lista = (Array.isArray(payload?.indicadoresLogro) && payload.indicadoresLogro.length ? payload.indicadoresLogro : payload?.indicadores) || [];
  const conCompetencia = lista.filter((ind) => ind?.id && ind?.competenciaId && String(ind.descripcion || ind.texto || "").trim());
  if (!conCompetencia.length) return null;
  const porCompetencia = new Map();
  conCompetencia.forEach((ind) => porCompetencia.set(ind.competenciaId, [...(porCompetencia.get(ind.competenciaId) || []), ind]));
  const incompletas = [...porCompetencia].filter(([, inds]) => inds.length !== ACCIONES.length).map(([id, inds]) => `${id} (${inds.length})`);
  if (incompletas.length) {
    throw new Error(`Vista previa: la malla no trae 3 indicadores por competencia (${incompletas.join(", ")}). Reimporta la malla oficial.`);
  }
  return [...porCompetencia.values()].flatMap((inds) => inds.map((ind, k) => ({
    id: ind.id, competenciaId: ind.competenciaId, accion: ACCIONES[k],
    ...estructurarTexto(ind.descripcion || ind.texto),
  })));
};
