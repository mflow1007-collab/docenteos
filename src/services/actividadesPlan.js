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

// ─── F3 — Entregas por estudiante ────────────────────────────────────────────
// Decisión 2: Pendiente / Entregó / No entregó / Excusa (sin «Entregó tarde»).
// Decisión 3: la entrega NO es nota: marcar aquí no escribe resultados ni
// Registro; «No entregó» queda sin número hasta que el docente evalúe.

export const ETIQUETAS_ENTREGA = {
  pendiente: "Pendiente", entrego: "Entregó", no_entrego: "No entregó", excusa: "Excusa",
};

/** Pulsar la marca que ya tiene el estudiante la quita (vuelve a pendiente). */
export const alternarEstadoEntrega = (actual, pulsado) => (actual === pulsado ? "pendiente" : pulsado);

const ENLACE = /^https?:\/\/\S+$/i;

/**
 * Nueva entrega de un estudiante. Conserva el nombre y el enlace previos;
 * `enlace` = undefined no lo toca, "" lo quita. Fail-closed con estado o
 * enlace inválidos.
 */
export const aplicarEntrega = (previa = {}, { estado, enlace, ahora = new Date().toISOString() } = {}) => {
  const nuevoEstado = estado ?? previa.estado ?? "pendiente";
  if (!ESTADOS_ENTREGA.includes(nuevoEstado)) {
    throw new Error(`Estado de entrega inválido "${nuevoEstado}". Usa: ${ESTADOS_ENTREGA.join(", ")}`);
  }
  const limpio = enlace === undefined ? (previa.enlace || "") : String(enlace).trim();
  if (limpio && !ENLACE.test(limpio)) throw new Error("El enlace de la evidencia debe empezar por http:// o https://");
  return {
    estado: nuevoEstado,
    nombre: previa.nombre || "",
    marcadaEn: nuevoEstado === "pendiente" ? null : (estado !== undefined && estado !== previa.estado ? ahora : previa.marcadaEn || ahora),
    enlace: limpio,
  };
};

/** Conteo por estado (las entregas sin estado conocido cuentan como pendientes). */
export const resumenEntregas = (entregas = {}) => {
  const resumen = { pendiente: 0, entrego: 0, no_entrego: 0, excusa: 0, total: 0 };
  for (const e of Object.values(entregas || {})) {
    resumen[ESTADOS_ENTREGA.includes(e?.estado) ? e.estado : "pendiente"] += 1;
    resumen.total += 1;
  }
  return resumen;
};

export const crearEvidenciaEntregaId = (actividadId, estudianteId) => `evi-act-${actividadId}__${estudianteId}`;

/**
 * Evidencia (enlace) de una entrega: UNA por actividad + estudiante, con ID
 * determinista para que volver a guardar actualice la misma y no duplique.
 * null si la entrega no tiene enlace.
 */
export const construirEvidenciaDeEntrega = (actividad, estudianteId, entrega, { ahora = new Date().toISOString() } = {}) => {
  if (!entrega?.enlace) return null;
  if (!actividad?.id || !actividad?.cursoId || !estudianteId) {
    throw new Error("La evidencia de la entrega necesita actividad, curso y estudiante");
  }
  const evidenciaId = crearEvidenciaEntregaId(actividad.id, estudianteId);
  const titulo = `Entrega fase ${actividad.faseNumero} · ${actividad.faseNombre || ""}`.trim();
  return {
    evidenciaId,
    id: evidenciaId,
    tipo: "entrega_actividad",
    origen: "actividad",
    titulo,
    descripcion: `${entrega.nombre || "El estudiante"}: ${actividad.entrega?.texto || titulo} (${ETIQUETAS_ENTREGA[entrega.estado] || entrega.estado}).`,
    enlace: entrega.enlace,
    estudianteId: String(estudianteId),
    estudianteNombre: entrega.nombre || "",
    cursoId: String(actividad.cursoId),
    planificacionId: actividad.planificacionId || "",
    claseId: actividad.claseId || "",
    actividadId: actividad.id,
    instrumentoId: actividad.instrumentoId || "",
    indicadorId: actividad.indicadorIds?.[0] || "",
    indicadorIds: actividad.indicadorIds || [],
    fecha: ahora,
    metadata: { estadoEntrega: entrega.estado },
  };
};

/**
 * Para la ficha: las actividades activas del curso en las que aparece el
 * estudiante (por su ID o un ID legado), ordenadas por fecha.
 */
export const actividadesDeEstudiante = (actividades = [], ids = []) => {
  const buscados = new Set(ids.filter(Boolean).map(String));
  return actividades
    .filter((a) => a?.activa !== false)
    .map((a) => {
      const clave = Object.keys(a.entregas || {}).find((k) => buscados.has(k));
      if (!clave) return null;
      const entrega = a.entregas[clave];
      return {
        actividadId: a.id,
        faseNumero: a.faseNumero,
        faseNombre: a.faseNombre || "",
        entregaTexto: a.entrega?.texto || "",
        fecha: fechaDeActividad(a),
        estado: ESTADOS_ENTREGA.includes(entrega?.estado) ? entrega.estado : "pendiente",
        enlace: entrega?.enlace || "",
      };
    })
    .filter(Boolean)
    .sort((x, y) => String(x.fecha).localeCompare(String(y.fecha)) || x.faseNumero - y.faseNumero);
};

// ─── F4 — Evaluar desde la actividad ─────────────────────────────────────────
// La nota sale de la rúbrica de la actividad (filas del Anexo A) y va por
// evaluarYRegistrar al resultado → aspectos por indicador → Registro.
// Decisión 3: solo se evalúa a quien entregó; «No entregó» espera la decisión
// del docente (0, otra oportunidad o Excusa). Decisión 4: el docente puede
// excluir la actividad del cálculo (excluidaDeNota / excluidoDeNota).

/**
 * Puntúa la rúbrica con el nivel elegido en cada criterio. Fail-closed: si
 * falta un nivel o no existe, error visible (no se guarda una nota a medias).
 * @param {object} estructura - estructura de la rúbrica (construirRubricaActividad)
 * @param {Record<string,string>} nivelesPorCriterio - { criterioId: "nivel1".."nivel4" }
 * @returns {{ puntaje: number, puntajeMaximo: number, detalleCriterios: object[] }}
 */
export const puntuarRubrica = (estructura, nivelesPorCriterio = {}) => {
  const criterios = estructura?.criterios || [];
  if (!criterios.length) throw new Error("La rúbrica de la actividad no tiene criterios");
  const detalleCriterios = criterios.map((c) => {
    const nivel = nivelesPorCriterio[c.id];
    if (!nivel) throw new Error(`Falta el nivel de «${c.criterio || c.id}»`);
    const puntos = c.puntajesNiveles?.[nivel];
    if (!Number.isFinite(Number(puntos))) throw new Error(`Nivel «${nivel}» inválido en «${c.criterio || c.id}»`);
    return { criterioId: c.id, indicadorId: c.indicadorId || "", nivel, puntos: Number(puntos), puntajeMaximo: Number(c.puntajeMaximo) || 0 };
  });
  const suma = (k) => Number(detalleCriterios.reduce((s, d) => s + d[k], 0).toFixed(2));
  return { puntaje: suma("puntos"), puntajeMaximo: suma("puntajeMaximo"), detalleCriterios };
};

/** Niveles ya guardados en un resultado, para precargar la rúbrica. */
export const nivelesDeResultado = (resultado) =>
  Object.fromEntries((resultado?.detalleCriterios || []).map((d) => [d.criterioId, d.nivel]));

/**
 * Quién se evalúa en la actividad: entregó → rúbrica; no entregó → decisión
 * del docente; pendiente y excusa → no se evalúan, salvo que ya tengan nota
 * (`conNota`: IDs con resultado evaluado), que se muestran para poder
 * quitarla. Orden alfabético.
 */
export const estudiantesParaEvaluar = (entregas = {}, conNota = []) => {
  const evaluados = new Set([...conNota].map(String));
  const grupos = { entrego: [], no_entrego: [], conNota: [], sinEvaluar: [] };
  Object.entries(entregas || {})
    .sort(([, a], [, b]) => String(a?.nombre).localeCompare(String(b?.nombre), "es"))
    .forEach(([id, e]) => {
      const fila = { id, nombre: e?.nombre || id, estado: ESTADOS_ENTREGA.includes(e?.estado) ? e.estado : "pendiente" };
      const grupo = grupos[fila.estado] || (evaluados.has(id) ? grupos.conNota : grupos.sinEvaluar);
      grupo.push(fila);
    });
  return grupos;
};

/**
 * Decisión 3: «Otra oportunidad» (vuelve a Pendiente) o «Excusa» no dejan
 * una nota ya puesta contando en el Registro.
 */
export const debeQuitarNota = (nuevoEstado, resultado) =>
  ["pendiente", "excusa"].includes(nuevoEstado) && resultado?.estado === "evaluado";

/** Lista de instrumentos del plan con la exclusión de uno ya aplicada (para recalcular). */
export const aplicarExclusion = (instrumentos = [], instrumentoId, excluido) =>
  instrumentos.map((ins) => (String(ins.id || ins.instrumentoId) === String(instrumentoId)
    ? { ...ins, excluidoDeNota: Boolean(excluido) }
    : ins));
