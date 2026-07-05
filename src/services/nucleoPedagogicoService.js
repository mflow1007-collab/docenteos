import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import {
  auth,
  db,
  crearAspectoIdDesdeInstrumento,
  guardarEvidenciaEstudiante,
  guardarRegistroAspectoDesdeInstrumento,
  guardarRegistroCalificaciones,
  guardarRegistroNota,
  obtenerRegistroCalificaciones,
} from "../firebase";
import { estudianteDocId } from "./expedienteEstudianteService";
import { aplicarNotaEnCelda } from "./hiloPedagogico.js";

const VALOR_INSTRUMENTO = {
  "Rúbrica": 100,
  "Lista de cotejo": 100,
  "Escala de estimación": 100,
};

const EVIDENCIAS_KEY_PREFIX = "docenteos_evidencias_";

const normalizarId = (valor, fallback) => String(valor || fallback || "sin-id").trim();

const crearNotasRegistroVacias = (cantidadCompetencias = 4) => ({
  competencias: Array.from({ length: Math.max(1, cantidadCompetencias) }, () => ({
    periodos: Array.from({ length: 4 }, () => ({ p: "", rp: "" })),
  })),
  ceCompletiva: "",
  ceExtraordinaria: "",
  fuenteInstrumentos: {},
});

const indicePeriodoRegistro = (periodo = "") => {
  const numero = String(periodo).match(/\d+/)?.[0];
  const indice = Number(numero || 1) - 1;
  return Math.min(3, Math.max(0, indice));
};

const consolidarEvaluacionInstrumentos = (evaluacion) => {
  const instrumentos = Object.values(evaluacion.instrumentos || {});
  const valorTotal = instrumentos.reduce((total, instrumento) => total + (Number(instrumento.valorMaximo) || 0), 0);
  const estudiantes = Object.fromEntries(
    Object.entries(evaluacion.estudiantes || {}).map(([estudianteId, estudiante]) => {
      const aplicaciones = Object.values(estudiante.instrumentos || {});
      const obtenido = aplicaciones.reduce((total, aplicacion) => total + (Number(aplicacion.puntosObtenidos) || 0), 0);
      const porcentaje = valorTotal > 0 ? Math.round((obtenido / valorTotal) * 100) : 0;
      return [
        estudianteId,
        {
          ...estudiante,
          totalObtenido: obtenido,
          totalMaximo: valorTotal,
          porcentaje,
        },
      ];
    })
  );

  return {
    ...evaluacion,
    valorTotal,
    estudiantes,
  };
};

export const crearEvaluacionIdPedagogica = (instrumento = {}) => (
  instrumento.evaluacionId
  || `eval-${normalizarId(instrumento.planificacionId || instrumento.curriculoId, "plan")}-${normalizarId(instrumento.periodo, "periodo-1")}`
);

export const crearReferenciasPedagogicas = ({ instrumento, aplicacion, cursoIdRegistro }) => {
  const evaluacionId = crearEvaluacionIdPedagogica(instrumento);
  return {
    evaluacionId,
    aspectoId: instrumento.aspectoId || crearAspectoIdDesdeInstrumento(instrumento),
    planificacionId: instrumento.planificacionId || instrumento.curriculoId || "",
    estrategiaId: instrumento.estrategiaId || instrumento.vinculacion?.estrategiaId || "",
    actividadId: instrumento.actividadId || instrumento.vinculacion?.actividadId || "",
    instrumentoId: instrumento.id,
    cursoId: cursoIdRegistro,
    estudianteId: aplicacion.estudianteId,
    periodo: instrumento.periodo || aplicacion.periodo || "",
  };
};

const crearEvidenciaDesdeEvaluacion = ({ instrumento, aplicacion, cursoIdRegistro }) => {
  const referencias = crearReferenciasPedagogicas({ instrumento, aplicacion, cursoIdRegistro });
  const evidenciaId = [
    referencias.evaluacionId,
    referencias.instrumentoId,
    referencias.estudianteId,
  ].filter(Boolean).join("_");

  const valorMaximo = Number(aplicacion.valorMaximo) || Number(instrumento.valorMaximo) || VALOR_INSTRUMENTO[instrumento.tipo] || 100;
  const valorObtenido = Number(aplicacion.puntosObtenidos) || 0;

  return {
    id: evidenciaId,
    evidenciaId,
    estudianteId: aplicacion.estudianteId,
    cursoId: cursoIdRegistro,
    planificacionId: referencias.planificacionId,
    instrumentoId: referencias.instrumentoId,
    aspectoId: referencias.aspectoId,
    titulo: instrumento.nombre || instrumento.tipo || "Evidencia evaluada",
    descripcion: aplicacion.observacion || `Evidencia generada desde ${instrumento.nombre || instrumento.tipo || "instrumento"}.`,
    tipo: "otro",
    fuente: "planificacion",
    origen: "instrumento",
    referencias,
    estudiante: {
      id: aplicacion.estudianteId,
      nombre: aplicacion.estudiante,
    },
    calificacion: {
      obtenida: valorObtenido,
      valorObtenido,
      valorMaximo,
      puntajeMaximo: valorMaximo,
      porcentaje: Number(aplicacion.porcentajeObtenido) || 0,
    },
    puntajeMaximo: valorMaximo,
    indicadores: instrumento.indicadores || instrumento.vinculacion?.indicadoresLogro || [instrumento.indicador].filter(Boolean),
    competencia: instrumento.competencia || instrumento.vinculacion?.competenciaEspecifica || "",
    periodo: instrumento.periodo || aplicacion.periodo || "",
    unidad: instrumento.unidad || "",
    tema: instrumento.actividad || instrumento.nombre || "",
    observacionDocente: aplicacion.observacion || aplicacion.retroalimentacion || "",
    retroalimentacion: aplicacion.observacion || aplicacion.retroalimentacion || "",
    adjuntos: aplicacion.adjuntos || [],
    detalleAplicacion: aplicacion.detalle || {},
    contexto: {
      actividad: instrumento.actividad || instrumento.vinculacion?.actividad || "",
      estrategia: instrumento.estrategia || instrumento.vinculacion?.estrategia || "",
      instrumento: instrumento.nombre || instrumento.tipo || "",
      tipoInstrumento: instrumento.tipo || "",
      competencia: instrumento.competencia || instrumento.vinculacion?.competenciaEspecifica || "",
      indicadores: instrumento.indicadores || instrumento.vinculacion?.indicadoresLogro || [instrumento.indicador].filter(Boolean),
      productoEsperado: instrumento.productoEsperado || instrumento.vinculacion?.productoEsperado || "",
      evidenciasEsperadas: instrumento.evidenciasEsperadas || instrumento.vinculacion?.evidenciasEsperadas || [
        "Rúbrica aplicada",
        "Observaciones",
        "Archivo presentado",
      ],
    },
    fecha: aplicacion.fecha || new Date().toISOString(),
    creadoEn: aplicacion.fecha || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

const guardarEvidenciaLocal = (cursoId, evidencia) => {
  try {
    const key = `${EVIDENCIAS_KEY_PREFIX}${cursoId}`;
    const actuales = JSON.parse(localStorage.getItem(key) || "{}");
    localStorage.setItem(key, JSON.stringify({ ...actuales, [evidencia.id]: evidencia }));
  } catch {
    // El almacenamiento local es respaldo; no debe bloquear el flujo de evaluación.
  }
};

const guardarEvidenciaFirestore = async (evidencia) => {
  if (!auth?.currentUser || !db) return;
  const uid = auth.currentUser.uid;
  const evidenciaRef = doc(db, "usuarios", uid, "evidenciasPedagogicas", evidencia.id);
  await setDoc(
    evidenciaRef,
    {
      ...evidencia,
      docenteId: uid,
      updatedAt: serverTimestamp(),
      actualizadoEn: serverTimestamp(),
    },
    { merge: true }
  );
};

const actualizarExpedienteConEvidencia = async ({ evidencia, instrumento, registroResumen }) => {
  if (!auth?.currentUser || !db) return;
  const uid = auth.currentUser.uid;
  const cursoId = evidencia.referencias.cursoId;
  const estudianteId = evidencia.referencias.estudianteId;
  const expedienteRef = doc(db, "usuarios", uid, "expedientesEstudiantes", estudianteDocId(cursoId, estudianteId));

  let evidenciaPrevias = [];
  let timelinePrevio = [];
  try {
    const snap = await getDoc(expedienteRef);
    if (snap.exists()) {
      evidenciaPrevias = snap.data().evidencias || [];
      timelinePrevio = snap.data().timeline || [];
    }
  } catch {
    // Si no puede leerse, se recrea el expediente mínimo desde la evidencia actual.
  }

  const evidenciaResumen = {
    id: evidencia.id,
    referencias: evidencia.referencias,
    actividad: evidencia.contexto.actividad,
    estrategia: evidencia.contexto.estrategia,
    instrumento: evidencia.contexto.instrumento,
    indicadores: evidencia.contexto.indicadores,
    calificacion: evidencia.calificacion,
    retroalimentacion: evidencia.retroalimentacion,
    adjuntos: evidencia.adjuntos,
    fecha: evidencia.fecha,
  };
  const evidenciaIds = new Set([evidencia.id]);
  const evidencias = [
    evidenciaResumen,
    ...evidenciaPrevias.filter((item) => !evidenciaIds.has(item.id)),
  ].slice(0, 120);

  const timelineEntry = {
    id: evidencia.id,
    fecha: evidencia.fecha,
    tipo: "evidencia",
    titulo: evidencia.contexto.actividad || evidencia.contexto.instrumento || "Evidencia evaluada",
    subtitulo: `${instrumento.tipo || "Instrumento"} · ${evidencia.calificacion.obtenida}/${evidencia.calificacion.valorMaximo}`,
    valor: evidencia.calificacion.porcentaje,
    icono: "evaluacion",
    referencias: evidencia.referencias,
  };
  const timeline = [
    timelineEntry,
    ...timelinePrevio.filter((item) => item.id !== evidencia.id),
  ].slice(0, 80);

  await setDoc(
    expedienteRef,
    {
      id: estudianteDocId(cursoId, estudianteId),
      nombre: evidencia.estudiante.nombre,
      cursoId,
      cursoNombre: instrumento.curso || "",
      area: instrumento.area || "",
      grado: instrumento.grado || "",
      promedio: registroResumen?.porcentaje ?? null,
      evidencias,
      timeline,
      actualizadoEn: serverTimestamp(),
    },
    { merge: true }
  );
};

export const sincronizarEvaluacionPedagogica = async ({ instrumento, aplicacion, cursoId }) => {
  const cursoIdRegistro = cursoId || instrumento.cursoId || "registro-general";
  const resultado = await obtenerRegistroCalificaciones(cursoIdRegistro).catch(() => ({ data: null }));
  const registroActual = resultado?.data || {};
  const evaluacionesActuales = registroActual.evaluacionesInstrumentos || {};
  const evaluacionId = crearEvaluacionIdPedagogica(instrumento);
  const referencias = crearReferenciasPedagogicas({ instrumento, aplicacion, cursoIdRegistro });
  const evidencia = crearEvidenciaDesdeEvaluacion({ instrumento, aplicacion, cursoIdRegistro });
  const aspectoId = evidencia.aspectoId;

  const evaluacionBase = evaluacionesActuales[evaluacionId] || {
    id: evaluacionId,
    referencias: {
      planificacionId: referencias.planificacionId,
      cursoId: cursoIdRegistro,
      periodo: referencias.periodo,
    },
    planificacionId: referencias.planificacionId,
    cursoId: cursoIdRegistro,
    curso: instrumento.curso,
    seccion: instrumento.seccion || "",
    periodo: instrumento.periodo,
    competencia: instrumento.competencia,
    indicadores: instrumento.indicadores || [instrumento.indicador].filter(Boolean),
    estrategia: instrumento.estrategia || instrumento.vinculacion?.estrategia || "",
    actividad: instrumento.actividad || instrumento.vinculacion?.actividad || "",
    instrumentos: {},
    estudiantes: {},
    evidencias: {},
    updatedAt: new Date().toISOString(),
  };

  const instrumentoResumen = {
    id: instrumento.id,
    referencia: referencias.instrumentoId,
    tipo: instrumento.tipo,
    nombre: instrumento.nombre,
    valorMaximo: Number(instrumento.valorMaximo) || VALOR_INSTRUMENTO[instrumento.tipo] || 100,
    indicadores: instrumento.indicadores || [instrumento.indicador].filter(Boolean),
  };

  const estudiantePrevio = evaluacionBase.estudiantes?.[aplicacion.estudianteId] || {
    id: aplicacion.estudianteId,
    nombre: aplicacion.estudiante,
    instrumentos: {},
  };

  const evaluacionConAplicacion = consolidarEvaluacionInstrumentos({
    ...evaluacionBase,
    referencias: {
      ...(evaluacionBase.referencias || {}),
      planificacionId: referencias.planificacionId,
      cursoId: cursoIdRegistro,
      periodo: referencias.periodo,
    },
    instrumentos: {
      ...(evaluacionBase.instrumentos || {}),
      [instrumento.id]: instrumentoResumen,
    },
    estudiantes: {
      ...(evaluacionBase.estudiantes || {}),
      [aplicacion.estudianteId]: {
        ...estudiantePrevio,
        id: aplicacion.estudianteId,
        nombre: aplicacion.estudiante,
        instrumentos: {
          ...(estudiantePrevio.instrumentos || {}),
        [instrumento.id]: {
          ...aplicacion,
          aspectoId,
          evidenciaId: evidencia.id,
          referencias,
          },
        },
      },
    },
    evidencias: {
      ...(evaluacionBase.evidencias || {}),
      [evidencia.id]: {
        id: evidencia.id,
        estudianteId: aplicacion.estudianteId,
        instrumentoId: instrumento.id,
        fecha: evidencia.fecha,
      },
    },
    updatedAt: new Date().toISOString(),
  });

  const estudianteConsolidado = evaluacionConAplicacion.estudiantes[aplicacion.estudianteId];
  const notasEstudiantes = { ...(registroActual.notasEstudiantes || {}) };
  const periodoIdx     = indicePeriodoRegistro(instrumento.periodo);
  const competenciaIdx = Math.max(0, Number(instrumento.competenciaIndex ?? 0));
  const cantidadCompetencias = Math.max(
    4,
    competenciaIdx + 1,
    Number(instrumento.totalCompetencias || 0),
    registroActual.competenciasCantidad || 0,
    registroActual.codigosCompetencias?.length || 0
  );
  const notasPrevias = notasEstudiantes[aplicacion.estudianteId] || crearNotasRegistroVacias(cantidadCompetencias);
  const competencias = Array.from({ length: cantidadCompetencias }, (_, ci) => {
    const comp = notasPrevias.competencias?.[ci] || { periodos: [] };
    return {
      ...comp,
      periodos: Array.from({ length: 4 }, (_, pi) => comp.periodos?.[pi] || { p: "", rp: "" }),
    };
  });
  // Regla 12: nunca pisar una celda ajustada/manual — solo actualizar el
  // cálculo y marcarla desactualizada para que el docente decida.
  competencias[competenciaIdx].periodos[periodoIdx] = aplicarNotaEnCelda(
    competencias[competenciaIdx].periodos[periodoIdx],
    estudianteConsolidado.porcentaje,
    { evaluacionId, evidenciaId: evidencia.id }
  );

  notasEstudiantes[aplicacion.estudianteId] = {
    ...notasPrevias,
    competencias,
    fuenteInstrumentos: {
      ...(notasPrevias.fuenteInstrumentos || {}),
      [evaluacionId]: {
        totalObtenido: estudianteConsolidado.totalObtenido,
        totalMaximo: estudianteConsolidado.totalMaximo,
        porcentaje: estudianteConsolidado.porcentaje,
        instrumentos: estudianteConsolidado.instrumentos,
        evidencias: evaluacionConAplicacion.evidencias,
      },
    },
  };

  const evaluacionesInstrumentos = {
    ...evaluacionesActuales,
    [evaluacionId]: evaluacionConAplicacion,
  };

  await guardarRegistroCalificaciones({
    cursoId: cursoIdRegistro,
    area: instrumento.area || registroActual.area || "",
    grado: instrumento.grado || registroActual.grado || "",
    seccion: instrumento.seccion || registroActual.seccion || "",
    anioEscolar: registroActual.anioEscolar || new Date().getFullYear().toString(),
    nivel: registroActual.nivel || "secundaria",
    notasEstudiantes,
    asistencia: registroActual.asistencia || [],
    observaciones: registroActual.observaciones || {},
    evaluacionesInstrumentos,
    resumenEvaluacionesInstrumentos: {
      fuente: "planificacion",
      totalEvaluaciones: Object.keys(evaluacionesInstrumentos).length,
      totalEvidencias: Object.values(evaluacionesInstrumentos).reduce(
        (total, evaluacion) => total + Object.keys(evaluacion.evidencias || {}).length,
        0
      ),
      updatedAt: new Date().toISOString(),
    },
  });

  guardarEvidenciaLocal(cursoIdRegistro, evidencia);

  // Regla 12 sobre la nota por aspecto: si el docente la ajustó manualmente,
  // se respeta valorObtenido y solo se actualiza el cálculo + desactualizado.
  const notaAspecto = {
    cursoId: cursoIdRegistro,
    estudianteId: aplicacion.estudianteId,
    aspectoId,
    instrumentoId: instrumento.id,
    valorObtenido: aplicacion.puntosObtenidos,
    valorCalculado: aplicacion.puntosObtenidos,
    desactualizado: false,
    puntajeMaximo: Number(aplicacion.valorMaximo) || Number(instrumento.valorMaximo) || VALOR_INSTRUMENTO[instrumento.tipo] || 100,
    porcentaje: aplicacion.porcentajeObtenido,
    observacion: aplicacion.observacion || "",
    fechaActualizacion: aplicacion.fecha || new Date().toISOString(),
  };
  try {
    if (auth?.currentUser && db) {
      const notaRef = doc(
        db, "usuarios", auth.currentUser.uid, "cursos", String(cursoIdRegistro),
        "registroNotas", `${aplicacion.estudianteId}_${aspectoId}`
      );
      const notaSnap = await getDoc(notaRef);
      if (notaSnap.exists() && notaSnap.data().ajusteManual) {
        const previa = notaSnap.data();
        notaAspecto.valorObtenido = previa.valorObtenido;      // ajuste respetado
        notaAspecto.ajusteManual = true;
        notaAspecto.motivoAjuste = previa.motivoAjuste || "";
        notaAspecto.desactualizado = Number(previa.valorObtenido) !== Number(aplicacion.puntosObtenidos);
      }
    }
  } catch {
    // Si no se puede leer la nota previa, se procede con la escritura estándar.
  }

  await Promise.allSettled([
    guardarRegistroAspectoDesdeInstrumento({ ...instrumento, aspectoId }),
    guardarRegistroNota(notaAspecto),
    guardarEvidenciaEstudiante(evidencia),
  ]);
  await Promise.allSettled([
    guardarEvidenciaFirestore(evidencia),
    actualizarExpedienteConEvidencia({
      evidencia,
      instrumento,
      registroResumen: estudianteConsolidado,
    }),
  ]);

  return {
    evaluacion: evaluacionConAplicacion,
    evidencia,
    registro: notasEstudiantes[aplicacion.estudianteId],
  };
};
