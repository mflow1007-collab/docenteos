/**
 * F5 — Seguimiento del estudiante en su ficha. PURO (sin Firestore).
 *
 * 1. construirLineaDeTiempo: UNA línea con entregas y notas de cada actividad,
 *    evidencias, asistencia y registro anecdótico (más reciente primero).
 * 2. senalesNecesitaApoyo: decisión 5 de César — basta UNA de tres señales,
 *    cada una con su motivo visible. Solo avisa: no cambia notas ni envía nada.
 *    Fail-loud: una fuente que no se pudo leer sale como «sin comprobar».
 */

import { actividadesDeEstudiante, ETIQUETAS_ENTREGA } from "./actividadesPlan.js";
import { agregarResultadosPorIndicador, indicadoresDebilesDeAvance } from "./hiloPedagogico.js";
import { esRegistroAnecdotico } from "../utils/registroAnecdotico.js";

// Mismas etiquetas que asistenciaService (que importa Firebase y no es puro)
const ETIQUETA_ASISTENCIA = { presente: "Presente", tarde: "Tardanza", excusa: "Excusa", ausente: "Ausente" };

export const UMBRAL_INDICADOR = 70;
export const MIN_NO_ENTREGO = 2;
export const MIN_AUSENCIAS = 3;
export const DIAS_VENTANA_AUSENCIAS = 14;

const dos = (n) => String(n).padStart(2, "0");
const isoLocal = (d) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;

/** AAAA-MM-DD desde string ISO, Timestamp de Firestore o Date. "" si no hay. */
export const fechaDia = (valor) => {
  if (!valor) return "";
  if (typeof valor === "string") return /^\d{4}-\d{2}-\d{2}/.test(valor) ? valor.slice(0, 10) : "";
  const d = typeof valor.toDate === "function" ? valor.toDate() : valor instanceof Date ? valor : null;
  return d && !Number.isNaN(d.getTime()) ? isoLocal(d) : "";
};

/** Fecha AAAA-MM-DD de hace `dias` días (hora local, sin saltos por UTC). */
export const restarDias = (hoy, dias) => {
  const d = new Date(`${hoy}T12:00:00`);
  d.setDate(d.getDate() - dias);
  return isoLocal(d);
};

const conjuntoIds = (ids = []) => new Set(ids.filter(Boolean).map(String));

/** Resultado evaluado de un instrumento para el estudiante (o null). */
const resultadoEvaluado = (resultados, instrumentoId, ids) =>
  instrumentoId
    ? resultados.find((r) => r?.estado === "evaluado"
        && String(r.instrumentoId || "") === String(instrumentoId)
        && ids.has(String(r.estudianteId || ""))) || null
    : null;

/** Actividades del estudiante con su nota (si está evaluada) y la exclusión. */
export const actividadesConNota = ({ actividades = [], resultados = [], ids = [] } = {}) => {
  const buscados = conjuntoIds(ids);
  const porId = new Map(actividades.map((a) => [a.id, a]));
  return actividadesDeEstudiante(actividades, [...buscados]).map((a) => {
    const original = porId.get(a.actividadId) || {};
    const r = resultadoEvaluado(resultados, original.instrumentoId, buscados);
    return {
      ...a,
      instrumentoId: original.instrumentoId || "",
      excluidaDeNota: original.excluidaDeNota === true,
      nota: r ? { obtenido: r.puntajeObtenido, maximo: r.puntajeMaximo, porcentaje: r.porcentaje } : null,
    };
  });
};

/**
 * Línea de tiempo única. Las evidencias de entrega y de resultado de una
 * actividad NO se repiten: ya están en la línea de la actividad. Las
 * actividades pendientes con fecha futura se omiten (están en «Actividades»).
 * Asistencia: solo los días con ausencia, tardanza o excusa.
 */
export const construirLineaDeTiempo = ({
  actividades = [], resultados = [], evidencias = [], asistencia = [], ids = [], hoy,
} = {}) => {
  const buscados = conjuntoIds(ids);
  const eventos = [];
  const conNota = actividadesConNota({ actividades, resultados, ids: [...buscados] });
  const instrumentosActividad = new Set(conNota.map((a) => a.instrumentoId).filter(Boolean));

  for (const a of conNota) {
    if (a.estado === "pendiente" && (!a.fecha || (hoy && a.fecha > hoy))) continue;
    const partes = [ETIQUETAS_ENTREGA[a.estado] || a.estado];
    if (a.nota) partes.push(`Nota ${a.nota.obtenido}/${a.nota.maximo}`);
    if (a.excluidaDeNota) partes.push("excluida de la nota");
    eventos.push({
      id: `actividad-${a.actividadId}`, tipo: "actividad", fecha: a.fecha, estado: a.estado,
      titulo: `Fase ${a.faseNumero}${a.faseNombre ? ` · ${a.faseNombre}` : ""}`,
      detalle: partes.join(" · "), enlace: a.enlace || "",
    });
  }

  for (const e of evidencias) {
    if (!e || e.tipo === "entrega_actividad") continue;
    if (e.tipo === "resultado_instrumento" && instrumentosActividad.has(String(e.instrumentoId || ""))) continue;
    const anecdotico = esRegistroAnecdotico(e);
    eventos.push({
      id: `evidencia-${e.id || e.evidenciaId}`, tipo: anecdotico ? "anecdotico" : "evidencia",
      fecha: fechaDia(e.fecha),
      titulo: anecdotico ? "Registro anecdótico" : (e.titulo || e.categoria || "Evidencia"),
      detalle: anecdotico ? (e.hecho || e.texto || "") : (e.descripcion || ""),
      enlace: e.enlace || "",
    });
  }

  for (const dia of asistencia) {
    const marca = Object.entries(dia?.marcas || {}).find(([k]) => buscados.has(String(k)))?.[1];
    if (!marca || marca === "presente") continue;
    eventos.push({
      id: `asistencia-${dia.fecha}`, tipo: "asistencia", fecha: fechaDia(dia.fecha), estado: marca,
      titulo: "Asistencia", detalle: ETIQUETA_ASISTENCIA[marca] || marca,
    });
  }

  return eventos.sort((x, y) => String(y.fecha).localeCompare(String(x.fecha)) || x.id.localeCompare(y.id));
};

/**
 * Decisión 5: «Necesita apoyo» si se cumple CUALQUIERA de:
 *  - ≥2 actividades en «No entregó» sin resolver (sin nota puesta);
 *  - algún indicador del estudiante por debajo de 70 (indicadoresDebilesDeAvance);
 *  - ≥3 ausencias sin excusa en las últimas 2 semanas (14 días hasta hoy).
 * `errores` = { actividades, resultados, asistencia } → la fuente que falló
 * sale en `sinComprobar` (nunca se da por buena en silencio).
 */
export const senalesNecesitaApoyo = ({
  actividades = [], resultados = [], asistencia = [], ids = [], hoy, errores = {},
} = {}) => {
  const buscados = conjuntoIds(ids);
  const motivos = [];
  const sinComprobar = [];

  if (errores.actividades || errores.resultados) {
    sinComprobar.push("entregas");
  } else {
    const sinResolver = actividadesConNota({ actividades, resultados, ids: [...buscados] })
      .filter((a) => a.estado === "no_entrego" && !a.nota);
    if (sinResolver.length >= MIN_NO_ENTREGO) {
      motivos.push({
        senal: "entregas",
        texto: `${sinResolver.length} actividades en «No entregó» sin resolver (${sinResolver.map((a) => `fase ${a.faseNumero}`).join(", ")}).`,
      });
    }
  }

  if (errores.resultados) {
    sinComprobar.push("indicadores");
  } else {
    const propios = resultados.filter((r) => buscados.has(String(r?.estudianteId || "")));
    const avance = agregarResultadosPorIndicador(propios);
    const debiles = new Set(indicadoresDebilesDeAvance(avance, { umbral: UMBRAL_INDICADOR }));
    const lista = avance.filter((i) => debiles.has(i.codigo));
    if (lista.length) {
      motivos.push({
        senal: "indicadores",
        texto: `Indicador${lista.length > 1 ? "es" : ""} por debajo de ${UMBRAL_INDICADOR}: ${lista.map((i) => `${i.codigo} (${i.promedio})`).join(", ")}.`,
      });
    }
  }

  if (errores.asistencia) {
    sinComprobar.push("asistencia");
  } else if (hoy) {
    const desde = restarDias(hoy, DIAS_VENTANA_AUSENCIAS - 1);
    const ausencias = asistencia
      .filter((dia) => {
        const f = fechaDia(dia?.fecha);
        if (!f || f < desde || f > hoy) return false;
        return Object.entries(dia.marcas || {}).some(([k, v]) => buscados.has(String(k)) && v === "ausente");
      })
      .map((dia) => fechaDia(dia.fecha))
      .sort();
    if (ausencias.length >= MIN_AUSENCIAS) {
      motivos.push({
        senal: "asistencia",
        texto: `${ausencias.length} ausencias sin excusa en las últimas 2 semanas (${ausencias.join(", ")}).`,
      });
    }
  }

  return { necesitaApoyo: motivos.length > 0, motivos, sinComprobar };
};
