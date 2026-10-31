/**
 * actividadesPlan.js — F2 del recorrido «actividad → informe»
 * (docs/RECORRIDO_ACTIVIDAD_A_INFORME.md, paso 2).
 *
 * Módulo PURO (sin Firebase): de un plan con plan maestro arma sus
 * ACTIVIDADES, una por cada entrega de fase (decisión 1 de César, 2026-10-30:
 * solo entregas de fase, sin tareas sueltas). Cada actividad lleva qué se
 * entrega y qué secciones avanza, su clase y fecha prevista, los indicadores
 * de la fase, su rúbrica (filas del Anexo A de esos indicadores) y los
 * estudiantes del curso en «pendiente». Decisiones de César (2026-10-30):
 * - A1: colección propia usuarios/{uid}/actividades, entregas dentro del doc.
 * - B1: rúbrica propia de la actividad que alimenta los aspectos por
 *   indicador; la clase de entrega no crea su instrumento genérico.
 * - C1: fase sin indicadores → actividad sin instrumento, no cuenta en la nota.
 * Fail-closed: si la entrega no se puede ubicar en las clases, error visible.
 *
 * Verificación: scripts/test-actividades-plan.mjs
 */

import {
  calcularFechaSugerida,
  construirInstrumentoDesdePlan,
  crearAspectoId,
} from "./hiloPedagogico.js";

/** Estados de entrega (decisión 2): F3 los usa; F2 solo crea «pendiente». */
export const ESTADOS_ENTREGA = ["pendiente", "entrego", "no_entrego", "excusa"];

const NIVELES = ["nivel1", "nivel2", "nivel3", "nivel4"];
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export const crearActividadId = (planificacionId, faseNumero) => `act-${planificacionId}-f${faseNumero}`;
export const crearInstrumentoActividadId = (planificacionId, faseNumero) => `ins-${planificacionId}-actividad-f${faseNumero}`;

/** La unidad guardada vive en `contenido` (guardarPlanificacionDetallada). */
export const unidadDePlan = (registroPlan) =>
  registroPlan?.contenido?.unidad || registroPlan?.contenido || registroPlan?.unidad || null;

/**
 * Ubica la clase de entrega de cada fase: la última clase de la fase. La capa
 * numera las clases en el orden de fasesSemanales; si no cuadra, error.
 * @returns {{ fase, faseUnidad, dia, clase }[]} vacío si el plan no tiene plan maestro
 */
export const ubicarEntregas = (unidad, capa) => {
  const fasesPlan = unidad?.planMaestro?.fases;
  if (!Array.isArray(fasesPlan) || !fasesPlan.length) return [];
  const fasesUnidad = Array.isArray(unidad.fasesSemanales) ? unidad.fasesSemanales : [];
  if (fasesUnidad.length !== fasesPlan.length) {
    throw new Error(`Actividades: el plan maestro tiene ${fasesPlan.length} fases y la unidad ${fasesUnidad.length}.`);
  }
  const clases = Array.isArray(capa?.clases) ? capa.clases : [];
  let desde = 0;
  return fasesPlan.map((fase, i) => {
    const dias = fasesUnidad[i].dias || [];
    if (!dias.length) throw new Error(`Actividades: la fase ${i + 1} (${fase.nombre}) no tiene clases.`);
    desde += dias.length;
    const clase = clases[desde - 1];
    const dia = dias[dias.length - 1];
    if (!clase || clase.numeroClase !== desde || clase.semana !== (dia.semana || clase.semana)) {
      throw new Error(`Actividades: la entrega de la fase ${i + 1} (${fase.nombre}) no se encuentra en la clase ${desde} del plan.`);
    }
    return { fase, faseUnidad: fasesUnidad[i], dia, clase };
  });
};

/**
 * numeroClase de las clases de entrega (para no crearles instrumento genérico,
 * B1). Por número y no por claseId: numeroClase es único en el plan; el
 * claseId depende de dia.n (clase-s{semana}-d{n}), que no lo garantiza.
 */
export const clasesDeEntrega = (unidad, capa) =>
  new Set(ubicarEntregas(unidad, capa).map(({ clase }) => clase.numeroClase));

/** Lista del curso con el mismo ID que Modo Aula y el Registro. */
const entregasPendientes = (estudiantes = []) => Object.fromEntries(
  estudiantes
    .filter((est) => est?.id)
    .map((est) => [String(est.id), { estado: "pendiente", nombre: est.nombre || "" }])
);

// Reparto entero de 100 puntos entre las filas (como construirRubricaPlan).
const repartirCien = (n) => {
  const base = n ? Math.floor(100 / n) : 0;
  const resto = 100 - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < resto ? 1 : 0));
};

/** Rúbrica de la actividad: las filas del Anexo A de sus indicadores. */
export const construirRubricaActividad = (filas = []) => {
  const puntos = repartirCien(filas.length);
  return {
    modelo: "rubrica_guia_2025",
    totalPuntos: 100,
    niveles: (filas[0]?.niveles || []).map((nivel, i) => ({ key: NIVELES[i], label: nivel.nombre, factor: nivel.porcentaje / 100 })),
    criterios: filas.map((fila, i) => ({
      id: `crit-${fila.indicadorCodigo}`,
      indicadorId: fila.indicadorCodigo,
      criterio: fila.indicador,
      criterioReferencia: fila.criterioReferencia || "",
      puntajeMaximo: puntos[i],
      ...Object.fromEntries((fila.niveles || []).map((nivel, n) => [NIVELES[n], nivel.descriptor])),
      puntajesNiveles: Object.fromEntries((fila.niveles || []).map((nivel, n) => [
        NIVELES[n], Number(((puntos[i] * nivel.porcentaje) / 100).toFixed(2)),
      ])),
    })),
  };
};

/**
 * @param {object} p
 * @param {string} p.planificacionId
 * @param {string} p.cursoId
 * @param {object} p.capa - capaCurricular del plan
 * @param {object} p.unidad - contenido guardado (planMaestro, fasesSemanales, anexos)
 * @param {{id:string, nombre?:string}[]} p.estudiantes - lista del curso
 * @returns {{ actividades: object[], instrumentos: object[], avisos: string[] }}
 */
export const construirActividadesDesdePlan = ({
  planificacionId, cursoId, capa, unidad, estudiantes = [], ahora = new Date().toISOString(),
}) => {
  if (!planificacionId || !cursoId) throw new Error("Actividades: hacen falta el plan guardado y su curso.");
  if (!unidad?.planMaestro?.fases?.length) throw new Error("Actividades: el plan no tiene plan maestro (las actividades son sus entregas de fase).");
  const avisos = [];
  const fechaInicio = unidad.metadatos?.fechaInicio || "";
  const filasAnexoA = Array.isArray(unidad.anexos?.rubricaPlan) ? unidad.anexos.rubricaPlan : [];
  const textoIndicador = new Map((capa?.indicadoresSeleccionados || []).map((ind) => [ind.id, ind.descripcion]));
  if (!estudiantes.length) avisos.push("El curso no tiene estudiantes: las actividades se crearon sin lista de entregas.");

  const actividades = [];
  const instrumentos = [];
  ubicarEntregas(unidad, capa).forEach(({ fase, dia, clase }, i) => {
    const numero = i + 1;
    const etiqueta = `Fase ${numero} (${fase.nombre})`;
    const fechaPrevista = FECHA_ISO.test(clase.fechaSugerida || "")
      ? clase.fechaSugerida
      : calcularFechaSugerida(fechaInicio, clase.semana, dia.diaCalendario || clase.nombreDia || "");
    if (!fechaPrevista) avisos.push(`${etiqueta}: sin fecha prevista (el plan no tiene fecha de inicio); ponla a mano.`);

    const indicadorIds = (fase.indicadores || []).map((ind) => ind.id);
    const filas = filasAnexoA.filter((fila) => indicadorIds.includes(fila.indicadorCodigo));
    const sinFila = indicadorIds.filter((id) => !filas.some((fila) => fila.indicadorCodigo === id));
    if (indicadorIds.length && sinFila.length) {
      avisos.push(`${etiqueta}: el Anexo A no tiene ${sinFila.join(", ")}; ${filas.length ? "la rúbrica va sin esos indicadores" : "la actividad queda sin rúbrica"}.`);
    }
    const sinCapa = indicadorIds.filter((id) => !textoIndicador.has(id));
    if (sinCapa.length) avisos.push(`${etiqueta}: ${sinCapa.join(", ")} no está en los indicadores del plan; no alimenta el Registro.`);

    let instrumentoId = "";
    if (filas.length) {
      instrumentoId = crearInstrumentoActividadId(planificacionId, numero);
      const evaluados = filas.map((fila) => fila.indicadorCodigo).filter((id) => textoIndicador.has(id));
      const base = construirInstrumentoDesdePlan({
        planificacionId,
        capa,
        tipo: "rubrica",
        claseId: clase.claseId,
        titulo: `Rúbrica — ${fase.entrega.texto}`,
        descripcion: `Rúbrica de la entrega de la fase ${numero} (${fase.nombre}), con las filas del Anexo A de sus indicadores.`,
        valorMaximo: 100,
        estructura: construirRubricaActividad(filas),
        origenGeneracion: "actividad_fase",
        evidenciaTipo: "producto",
        ahora,
      });
      const indicadores = evaluados.map((id) => textoIndicador.get(id));
      instrumentos.push({
        ...base,
        id: instrumentoId,
        instrumentoId,
        actividadId: crearActividadId(planificacionId, numero),
        indicadorIds: evaluados,
        aspectoRegistroIds: evaluados.map((id) => crearAspectoId(planificacionId, id)),
        indicador: indicadores[0] || "",
        indicadores,
        vinculacion: { ...base.vinculacion, indicadorIds: evaluados, indicadorLogro: indicadores[0] || "", indicadoresLogro: indicadores },
      });
    }

    actividades.push({
      id: crearActividadId(planificacionId, numero),
      planificacionId: String(planificacionId),
      cursoId: String(cursoId),
      faseNumero: numero,
      faseNombre: fase.nombre,
      entrega: { estado: fase.entrega.estado, texto: fase.entrega.texto, secciones: [...(fase.entrega.secciones || [])] },
      entregaRedactada: String(dia.entregaFase || "").trim(),
      claseId: clase.claseId,
      numeroClase: clase.numeroClase,
      claseTitulo: clase.titulo || "",
      fechaPrevista: fechaPrevista || "",
      fechaAjustada: null,
      activa: true,
      indicadorIds,
      instrumentoId,
      // C1: sin indicadores (o sin rúbrica) la entrega se sigue, pero no da nota.
      cuentaEnNota: Boolean(instrumentoId),
      entregas: entregasPendientes(estudiantes),
      creadaEn: ahora,
    });
  });
  return { actividades, instrumentos, avisos };
};

/**
 * Re-guardar el plan nunca pisa lo que decidió el docente: fecha ajustada,
 * activa/desactivada y los estados de entrega ya marcados. Los estudiantes
 * nuevos del curso entran como «pendiente»; los que ya no están se conservan.
 */
export const fusionarActividad = (nueva, existente) => {
  if (!existente) return nueva;
  return {
    ...nueva,
    fechaAjustada: existente.fechaAjustada ?? null,
    activa: existente.activa !== false,
    entregas: { ...nueva.entregas, ...(existente.entregas || {}) },
    creadaEn: existente.creadaEn || nueva.creadaEn,
  };
};

/** Fecha que vale: la que puso el docente o, si no, la prevista. */
export const fechaDeActividad = (actividad) => actividad?.fechaAjustada || actividad?.fechaPrevista || "";
