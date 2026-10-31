/**
 * F6 — Informes desde los datos registrados. PURO (sin Firestore).
 *
 * Decisión 6: plantilla fija llenada con datos (sin créditos); la IA es
 * opcional y solo redacta a partir de este informe. Decisión 7: familia =
 * PDF (ventana de impresión) + texto corto para WhatsApp; DocenteOS no envía.
 *
 * Notas: se muestran LAS DOS del Registro, cada una con su origen:
 *   - por indicador = registroNotas (aspectos que alimentan las actividades);
 *   - C.F. por competencias = registroCalificaciones (Registro › Calificaciones).
 * Si no coinciden, el informe lo dice; no corrige nada (unificarlas es F7).
 * Fail-loud: una fuente que no se pudo leer sale en `sinComprobar`.
 */

import { actividadesConNota, senalesNecesitaApoyo, fechaDia } from "./seguimientoEstudiante.js";
import { agregarResultadosPorIndicador, nivelLogroDesdePorcentaje } from "./hiloPedagogico.js";
import { ETIQUETAS_ENTREGA } from "./actividadesPlan.js";
import { calcularResumenEstudiante, normalizarNotasCompetencias } from "../utils/resumenCalificaciones.js";
import { escHtml } from "../utils/html.js";

const conjuntoIds = (ids = []) => new Set(ids.filter(Boolean).map(String));
const numero = (v) => (v === "" || v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v));
const codigoDe = (aspecto) => String(aspecto?.indicadorId || aspecto?.aspectoId || "");
// Misma regla que Registro › Instrumentos (aspectosActivos): los inactivos no son columnas
const activo = (aspecto) => (aspecto?.estado || "activo") === "activo";

// Lenguaje claro para la familia (mismos cortes que nivelLogroDesdePorcentaje)
const FRASE_NIVEL = {
  "Logrado": "lo ha logrado",
  "En proceso": "está en proceso",
  "Necesita apoyo": "necesita apoyo",
};

/** Notas por indicador del Registro (registroNotas) para el estudiante. */
export const notasPorIndicador = ({ aspectos = [], notas = [], ids = [] } = {}) => {
  const buscados = conjuntoIds(ids);
  return aspectos
    .filter(activo)
    .map((aspecto) => {
      const nota = notas.find((n) => String(n?.aspectoId || "") === String(aspecto.aspectoId || aspecto.id)
        && buscados.has(String(n?.estudianteId || "")));
      const obtenido = numero(nota?.valorObtenido);
      if (!nota || obtenido === null) return null;
      const maximo = numero(nota.puntajeMaximo) ?? numero(aspecto.puntajeMaximo);
      const porcentaje = numero(nota.porcentaje) ?? (maximo ? Math.round((obtenido / maximo) * 100) : null);
      const nivel = nivelLogroDesdePorcentaje(porcentaje);
      return {
        codigo: codigoDe(aspecto),
        texto: aspecto.aspectoVisible || aspecto.nombre || aspecto.textoIndicadorOriginal || "",
        obtenido, maximo, porcentaje, nivel,
        esParcial: nota.esParcial === true,
        ajusteManual: nota.ajusteManual === true,
      };
    })
    .filter(Boolean);
};

/** C.F. del Registro › Calificaciones con el mismo cálculo de esa página. */
export const cfDelRegistro = ({ registroCalificaciones = null, ids = [] } = {}) => {
  const porEst = registroCalificaciones?.notasEstudiantes || {};
  const clave = ids.filter(Boolean).map(String).find((id) => porEst[id]);
  if (!clave) return null;
  const notas = porEst[clave];
  const resumen = calcularResumenEstudiante(normalizarNotasCompetencias(notas, notas?.competencias?.length || 4));
  if (!(resumen.cf > 0)) return null;
  return { cf: resumen.cf, porCompetencia: resumen.compAvgs, situacion: resumen.situacion };
};

/** Totales de asistencia del pase de lista (Modo Aula) para el estudiante. */
export const asistenciaDe = ({ asistencia = [], ids = [] } = {}) => {
  const buscados = conjuntoIds(ids);
  const t = { dias: 0, presente: 0, tarde: 0, excusa: 0, ausente: 0 };
  for (const dia of asistencia) {
    const marca = Object.entries(dia?.marcas || {}).find(([k]) => buscados.has(String(k)))?.[1];
    if (!marca || !(marca in t)) continue;
    t.dias += 1;
    t[marca] += 1;
  }
  // Tardanza cuenta como asistió; la excusa no es falta
  t.porcentaje = t.dias ? Math.round(((t.presente + t.tarde + t.excusa) / t.dias) * 100) : null;
  return t;
};

/**
 * Informe a la familia de UN estudiante.
 * @param anotacionesElegidas  anotaciones anecdóticas que el docente marcó para compartir.
 */
export const construirInformeFamilia = ({
  estudiante = {}, cursoNombre = "", asignatura = "",
  actividades = [], resultados = [], aspectos = [], notas = [], registroCalificaciones = null,
  asistencia = [], anotacionesElegidas = [], ids = [], hoy = "", errores = {},
} = {}) => {
  const sinComprobar = [];
  if (errores.actividades || errores.resultados) sinComprobar.push("actividades");
  if (errores.registro) sinComprobar.push("notas por indicador");
  if (errores.calificaciones) sinComprobar.push("C.F. por competencias");
  if (errores.asistencia) sinComprobar.push("asistencia");

  const indicadores = errores.registro ? [] : notasPorIndicador({ aspectos, notas, ids });
  const codigosRegistro = new Set(indicadores.map((i) => i.codigo));
  // Resultados con indicadores que NO son columnas activas del Registro
  // (p. ej. listas de cotejo antiguas): se muestran aparte, con su origen.
  const buscados = conjuntoIds(ids);
  const otrosResultados = errores.resultados ? [] : agregarResultadosPorIndicador(
    resultados.filter((r) => buscados.has(String(r?.estudianteId || ""))),
  ).filter((i) => !codigosRegistro.has(i.codigo));

  const conNota = errores.actividades || errores.resultados ? [] : actividadesConNota({ actividades, resultados, ids });
  const pendientes = conNota.filter((a) =>
    (a.estado === "no_entrego" && !a.nota) || (a.estado === "pendiente" && a.fecha && hoy && a.fecha <= hoy));

  const cf = errores.calificaciones ? null : cfDelRegistro({ registroCalificaciones, ids });
  const promedioIndicadores = indicadores.length
    ? Math.round(indicadores.reduce((s, i) => s + (i.porcentaje ?? 0), 0) / indicadores.length)
    : null;

  return {
    estudiante: { nombre: estudiante.nombre || "", id: estudiante.id || "" },
    cursoNombre, asignatura, fecha: hoy,
    indicadores, otrosResultados,
    cf,
    // Aviso visible cuando las dos notas del Registro no dicen lo mismo
    notasNoCoinciden: Boolean(cf && promedioIndicadores !== null && Math.abs(cf.cf - promedioIndicadores) >= 1),
    promedioIndicadores,
    actividades: conNota,
    pendientes,
    asistencia: errores.asistencia ? null : asistenciaDe({ asistencia, ids }),
    apoyo: senalesNecesitaApoyo({ actividades, resultados, asistencia, ids, hoy, errores }),
    anotaciones: anotacionesElegidas.map((a) => ({
      fecha: fechaDia(a.fecha), hecho: a.hecho || a.texto || "", accion: a.accion || "", compromisos: a.compromisos || "",
    })),
    sinComprobar,
  };
};

const lineaAsistencia = (a) => (a && a.dias
  ? `${a.porcentaje} % (${a.dias} días: ${a.ausente} ausencia${a.ausente === 1 ? "" : "s"}, ${a.tarde} tardanza${a.tarde === 1 ? "" : "s"}, ${a.excusa} excusa${a.excusa === 1 ? "" : "s"})`
  : "sin pase de lista registrado");

const lineaPendiente = (a) => `Fase ${a.faseNumero}${a.faseNombre ? ` (${a.faseNombre})` : ""}: ${ETIQUETAS_ENTREGA[a.estado] || a.estado}`;

/** Texto de la plantilla (sin IA). Es también la única entrada de «Redactar con IA». */
export const textoInformeFamilia = (inf) => {
  const nombre = inf.estudiante.nombre || "El estudiante";
  const l = [];
  l.push(`Informe para la familia de ${nombre}${inf.cursoNombre ? ` · ${inf.cursoNombre}` : ""}${inf.asignatura ? ` · ${inf.asignatura}` : ""}${inf.fecha ? ` · ${inf.fecha}` : ""}`);
  l.push("");
  l.push("## Logros por indicador (Registro, desde las actividades)");
  if (!inf.indicadores.length) l.push("- Aún no hay indicadores evaluados.");
  for (const i of inf.indicadores) {
    l.push(`- ${i.texto || i.codigo}: ${FRASE_NIVEL[i.nivel] || "sin nivel"} (${i.obtenido}/${i.maximo} puntos, ${i.porcentaje} %${i.esParcial ? ", nota parcial" : ""}).`);
  }
  if (inf.otrosResultados.length) {
    l.push("");
    l.push("## Otros resultados de instrumentos (fuera de las columnas activas del Registro)");
    for (const o of inf.otrosResultados) l.push(`- ${o.codigo}: ${o.promedio} % (${o.evaluaciones} evaluación${o.evaluaciones === 1 ? "" : "es"}).`);
  }
  l.push("");
  l.push("## Calificación por competencias (Registro › Calificaciones)");
  l.push(inf.cf ? `- C.F.: ${inf.cf.cf} · ${inf.cf.situacion}.` : "- Sin calificación por competencias registrada.");
  if (inf.notasNoCoinciden) l.push(`- Aviso: la C.F. (${inf.cf.cf}) no coincide con el promedio por indicador (${inf.promedioIndicadores} %). Son dos registros distintos.`);
  l.push("");
  l.push("## Pendientes");
  if (!inf.pendientes.length) l.push("- No tiene actividades pendientes.");
  for (const p of inf.pendientes) l.push(`- ${lineaPendiente(p)}.`);
  l.push("");
  l.push("## Asistencia");
  l.push(`- ${lineaAsistencia(inf.asistencia)}.`);
  if (inf.apoyo.necesitaApoyo) {
    l.push("");
    l.push("## Necesita apoyo");
    for (const m of inf.apoyo.motivos) l.push(`- ${m.texto}`);
  }
  if (inf.anotaciones.length) {
    l.push("");
    l.push("## Observaciones del docente");
    for (const a of inf.anotaciones) l.push(`- ${a.fecha}: ${a.hecho}${a.compromisos ? ` Acuerdo: ${a.compromisos}` : ""}`);
  }
  if (inf.sinComprobar.length) {
    l.push("");
    l.push(`Sin comprobar (no se pudo leer): ${inf.sinComprobar.join(", ")}.`);
  }
  return l.join("\n");
};

/** Texto corto para pegar en WhatsApp: logros, pendientes y asistencia. */
export const textoWhatsApp = (inf) => {
  const nombre = inf.estudiante.nombre || "el estudiante";
  const l = [`Saludos. Informe de ${nombre}${inf.asignatura ? ` en ${inf.asignatura}` : ""}${inf.fecha ? ` (${inf.fecha})` : ""}:`];
  const logros = inf.indicadores.map((i) => `${i.texto || i.codigo}: ${FRASE_NIVEL[i.nivel] || "sin nivel"} (${i.porcentaje} %)`);
  l.push(`✅ Logros: ${logros.length ? logros.join("; ") : "aún sin indicadores evaluados"}.`);
  l.push(`📌 Pendientes: ${inf.pendientes.length ? inf.pendientes.map(lineaPendiente).join("; ") : "ninguno"}.`);
  l.push(`🗓 Asistencia: ${lineaAsistencia(inf.asistencia)}.`);
  return l.join("\n");
};

const ESTILO_PDF = `body{font-family:system-ui,sans-serif;color:#111827;margin:24px;font-size:12px}
h1{font-size:18px;margin:0 0 4px}h2{font-size:13px;margin:16px 0 6px;border-bottom:1px solid #d1d5db;padding-bottom:3px}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #d1d5db;padding:4px 6px;text-align:left;vertical-align:top}
th{background:#f3f4f6}.aviso{color:#92400e}.meta{color:#4b5563}`;

/** HTML imprimible (PDF) del texto del informe: la plantilla o la redacción aprobada. */
export const htmlDocumento = (titulo, texto) => {
  const cuerpo = String(texto || "").split("\n").map((linea) => {
    if (linea.startsWith("## ")) return `<h2>${escHtml(linea.slice(3))}</h2>`;
    if (linea.startsWith("- ")) return `<li>${escHtml(linea.slice(2))}</li>`;
    if (!linea.trim()) return "";
    return `<p>${escHtml(linea)}</p>`;
  }).join("\n");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escHtml(titulo)}</title><style>${ESTILO_PDF}</style></head>
<body><h1>${escHtml(titulo)}</h1>${cuerpo}<script>window.onload=()=>window.print()</script></body></html>`;
};

/**
 * Informe de coordinación de UN curso: % de entregas por actividad, promedio
 * por indicador (Registro), quién necesita apoyo y por qué, y asistencia.
 */
export const construirInformeCurso = ({
  cursoNombre = "", asignatura = "", estudiantes = [], actividades = [], resultados = [],
  aspectos = [], notas = [], asistencia = [], hoy = "", errores = {},
} = {}) => {
  const sinComprobar = [];
  if (errores.actividades) sinComprobar.push("entregas");
  if (errores.resultados) sinComprobar.push("resultados");
  if (errores.asistencia) sinComprobar.push("asistencia");
  if (errores.registro) sinComprobar.push("promedio por indicador");

  const entregas = errores.actividades ? [] : actividades
    .filter((a) => a?.activa !== false)
    .map((a) => {
      const c = { entrego: 0, no_entrego: 0, excusa: 0, pendiente: 0 };
      for (const e of Object.values(a.entregas || {})) {
        const estado = e?.estado in c ? e.estado : "pendiente";
        c[estado] += 1;
      }
      const total = c.entrego + c.no_entrego + c.excusa + c.pendiente;
      return {
        faseNumero: a.faseNumero, faseNombre: a.faseNombre || "", ...c, total,
        excluidaDeNota: a.excluidaDeNota === true,
        porcentaje: total ? Math.round((c.entrego / total) * 100) : null,
      };
    })
    .sort((x, y) => x.faseNumero - y.faseNumero);

  const indicadores = aspectos.filter(activo).map((aspecto) => {
    const valores = notas
      .filter((n) => String(n?.aspectoId || "") === String(aspecto.aspectoId || aspecto.id))
      .map((n) => numero(n.porcentaje) ?? (numero(n.valorObtenido) !== null && numero(n.puntajeMaximo)
        ? Math.round((numero(n.valorObtenido) / numero(n.puntajeMaximo)) * 100) : null))
      .filter((v) => v !== null);
    const promedio = valores.length ? Math.round(valores.reduce((s, v) => s + v, 0) / valores.length) : null;
    return {
      codigo: codigoDe(aspecto),
      texto: aspecto.aspectoVisible || aspecto.nombre || "",
      evaluados: valores.length,
      promedio,
      nivel: nivelLogroDesdePorcentaje(promedio),
    };
  }).filter((i) => i.evaluados > 0);

  const porEstudiante = estudiantes.map((est) => {
    const ids = [est.id, ...(est.idsLegado || [])];
    return {
      nombre: est.nombre || est.id,
      apoyo: senalesNecesitaApoyo({ actividades, resultados, asistencia, ids, hoy, errores }),
      asistencia: errores.asistencia ? null : asistenciaDe({ asistencia, ids }),
    };
  });
  const conAsistencia = porEstudiante.filter((e) => e.asistencia?.dias);
  return {
    cursoNombre, asignatura, fecha: hoy,
    entregas, indicadores,
    apoyo: porEstudiante.filter((e) => e.apoyo.necesitaApoyo).map((e) => ({ nombre: e.nombre, motivos: e.apoyo.motivos.map((m) => m.texto) })),
    asistencia: errores.asistencia ? null : {
      diasRegistrados: asistencia.length,
      promedio: conAsistencia.length
        ? Math.round(conAsistencia.reduce((s, e) => s + e.asistencia.porcentaje, 0) / conAsistencia.length) : null,
      ausencias: porEstudiante.filter((e) => e.asistencia?.ausente).map((e) => ({ nombre: e.nombre, ausente: e.asistencia.ausente })),
    },
    totalEstudiantes: estudiantes.length,
    sinComprobar,
  };
};

/** HTML imprimible (PDF) de la tabla de coordinación. */
export const htmlInformeCurso = (inf) => {
  const fila = (celdas) => `<tr>${celdas.map((c) => `<td>${escHtml(c)}</td>`).join("")}</tr>`;
  const cab = (celdas) => `<tr>${celdas.map((c) => `<th>${escHtml(c)}</th>`).join("")}</tr>`;
  const titulo = `Informe para coordinación · ${inf.cursoNombre}${inf.asignatura ? ` · ${inf.asignatura}` : ""}`;
  const partes = [];
  partes.push(`<p class="meta">${escHtml(`${inf.totalEstudiantes} estudiantes · datos registrados hasta ${inf.fecha}`)}</p>`);
  if (inf.sinComprobar.length) partes.push(`<p class="aviso">${escHtml(`Sin comprobar (no se pudo leer): ${inf.sinComprobar.join(", ")}.`)}</p>`);

  partes.push("<h2>Entregas por actividad</h2>");
  partes.push(inf.entregas.length
    ? `<table>${cab(["Fase", "Entregó", "No entregó", "Excusa", "Pendiente", "% entregas"])}${inf.entregas.map((e) => fila([
        `Fase ${e.faseNumero}${e.faseNombre ? ` · ${e.faseNombre}` : ""}${e.excluidaDeNota ? " (excluida de la nota)" : ""}`,
        e.entrego, e.no_entrego, e.excusa, e.pendiente, e.porcentaje === null ? "—" : `${e.porcentaje} %`,
      ])).join("")}</table>`
    : "<p>Sin actividades registradas.</p>");

  partes.push("<h2>Promedio por indicador (Registro)</h2>");
  partes.push(inf.indicadores.length
    ? `<table>${cab(["Indicador", "Aspecto", "Evaluados", "Promedio", "Nivel"])}${inf.indicadores.map((i) => fila([
        i.codigo, i.texto, i.evaluados, `${i.promedio} %`, i.nivel,
      ])).join("")}</table>`
    : "<p>Aún no hay indicadores evaluados.</p>");

  partes.push("<h2>Necesitan apoyo</h2>");
  partes.push(inf.apoyo.length
    ? `<table>${cab(["Estudiante", "Motivo"])}${inf.apoyo.map((a) => fila([a.nombre, a.motivos.join(" ")])).join("")}</table>`
    : "<p>Ningún estudiante con señales de apoyo.</p>");

  partes.push("<h2>Asistencia (pase de lista)</h2>");
  if (!inf.asistencia) partes.push("<p class=\"aviso\">Sin comprobar.</p>");
  else {
    partes.push(`<p>${escHtml(`${inf.asistencia.diasRegistrados} días con pase de lista · asistencia promedio ${inf.asistencia.promedio === null ? "—" : `${inf.asistencia.promedio} %`}`)}</p>`);
    if (inf.asistencia.ausencias.length) {
      partes.push(`<table>${cab(["Estudiante", "Ausencias"])}${inf.asistencia.ausencias.map((a) => fila([a.nombre, a.ausente])).join("")}</table>`);
    }
  }
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escHtml(titulo)}</title><style>${ESTILO_PDF}</style></head>
<body><h1>${escHtml(titulo)}</h1>${partes.join("\n")}<script>window.onload=()=>window.print()</script></body></html>`;
};
