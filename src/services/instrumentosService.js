/**
 * instrumentosService.js — Fases 3 y 4 del hilo pedagógico
 *
 * Fase 3: instrumentos que NACEN vinculados a la planificación (y opcionalmente
 * a una clase concreta), sabiendo qué indicadores evalúan y qué aspectos del
 * registro alimentan.
 *
 * Fase 4: resultados de evaluación POR ESTUDIANTE. No se escribe directo en
 * Mi Registro: primero se guarda el resultado del instrumento; Mi Registro
 * (Fase 5, Bloque B) se consolidará desde aquí.
 *
 * Colecciones reales:
 *   usuarios/{uid}/instrumentos/{instrumentoId}            (existente, extendida)
 *   usuarios/{uid}/instrumentoResultados/{resultadoId}     (nueva)
 *
 * Idempotencia:
 *   instrumentoId = ins-{planificacionId}-{tipo}-{claseId|global}
 *   resultadoId   = {instrumentoId}__{estudianteId}  (re-evaluar sobreescribe)
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db, auth, guardarRegistroAspectoDesdeInstrumento } from "../firebase.js";
import {
  construirInstrumentoDesdePlan,
  construirResultadoInstrumento,
  validarPonderacion,
  consolidarNotaEstudiante,
  normalizarTipoInstrumento,
  ETIQUETA_TIPO_INSTRUMENTO,
} from "./hiloPedagogico.js";
import { sincronizarPuntajesAspectos } from "./registroService.js";

const uid = () => auth?.currentUser?.uid;
const disponible = () => Boolean(db && uid());

const refInstrumento = (id) => doc(db, "usuarios", uid(), "instrumentos", String(id));
const colInstrumentos = () => collection(db, "usuarios", uid(), "instrumentos");
const refResultado = (id) => doc(db, "usuarios", uid(), "instrumentoResultados", String(id));
const colResultados = () => collection(db, "usuarios", uid(), "instrumentoResultados");

const NIVELES_RUBRICA_MINERD = [
  { key: "nivel1", label: "Receptivo", factor: 0.55 },
  { key: "nivel2", label: "Resolutivo", factor: 0.7 },
  { key: "nivel3", label: "Autónomo", factor: 0.85 },
  { key: "nivel4", label: "Estratégico", factor: 1 },
];

const puntajesPorNivel = (puntajeMaximo) => Object.fromEntries(
  NIVELES_RUBRICA_MINERD.map((nivel) => [nivel.key, Number((puntajeMaximo * nivel.factor).toFixed(2))])
);

const textoCorto = (texto = "", max = 90) => {
  const limpio = String(texto || "").replace(/\s+/g, " ").trim();
  if (limpio.length <= max) return limpio;
  return `${limpio.slice(0, max).replace(/\s+\S*$/, "")}…`;
};

const listaUnica = (items = []) => [...new Set(items.map((item) => String(item || "").trim()).filter(Boolean))];

const evidenciasDeClase = (clase = {}) => ({
  conocimiento: listaUnica([
    ...(clase.evidencias?.conocimiento || []),
    ...(clase.evidencias?.conocimientos || []),
    ...(clase.mapaEvaluacion?.evidencias?.conocimiento || []),
  ]),
  desempeno: listaUnica([
    ...(clase.evidencias?.desempeno || []),
    ...(clase.mapaEvaluacion?.evidencias?.desempeno || []),
  ]),
  producto: listaUnica([
    ...(clase.evidencias?.producto || []),
    ...(clase.mapaEvaluacion?.evidencias?.producto || []),
  ]),
  planas: listaUnica(clase.evidenciasEsperadas || []),
});

const tieneEvidenciaEvaluable = (clase = {}) => {
  const ev = evidenciasDeClase(clase);
  return Boolean(ev.conocimiento.length || ev.desempeno.length || ev.producto.length || ev.planas.length || clase.instrumentosPlaneados?.length);
};

const tipoSugeridoPorEvidencia = (clase = {}) => {
  const desdeMapa = clase.mapaEvaluacion?.instrumentoSugerido?.tipo;
  if (desdeMapa) return normalizarTipoInstrumento(desdeMapa);
  const explicit = clase.instrumentosPlaneados?.find(Boolean);
  if (explicit) return normalizarTipoInstrumento(explicit);
  const ev = evidenciasDeClase(clase);
  if (ev.producto.length) return "rubrica";
  if (ev.desempeno.length) return "escala_estimativa";
  if (ev.conocimiento.length) return "lista_cotejo";
  return "lista_cotejo";
};

const valorPorTipo = (tipoNorm) => {
  if (tipoNorm === "rubrica") return 50;
  if (tipoNorm === "lista_cotejo" || tipoNorm === "escala_estimativa" || tipoNorm === "guia_observacion") return 25;
  return 100;
};

const valorSugeridoClase = (clase = {}, tipoNorm) =>
  Number(clase.mapaEvaluacion?.instrumentoSugerido?.valorSugerido) || valorPorTipo(tipoNorm);

const indicadoresParaInstrumento = (clase = {}, capa = {}) => {
  const indicadorIds = clase.indicadoresTrabajados?.length
    ? clase.indicadoresTrabajados
    : (capa.indicadoresSeleccionados || []).map((ind) => ind.id);
  return (capa.indicadoresSeleccionados || [])
    .filter((ind) => indicadorIds.includes(ind.id))
    .map((ind) => ind.descripcion)
    .filter(Boolean);
};

const estructuraParaInstrumentoPlaneado = ({ tipoNorm, clase = {}, capa = {} }) => {
  const ev = evidenciasDeClase(clase);
  const evidencias = listaUnica([
    ...ev.producto,
    ...ev.desempeno,
    ...ev.conocimiento,
    ...ev.planas,
  ]);
  const indicadores = indicadoresParaInstrumento(clase, capa);
  const criteriosMapa = listaUnica(clase.mapaEvaluacion?.criteriosExito || []);
  const baseItems = listaUnica([...criteriosMapa, ...evidencias, ...indicadores]).slice(0, 6);

  if (tipoNorm === "rubrica") {
    const pesos = [15, 17, 18];
    const criteriosBase = [
      {
        criterio: textoCorto(ev.producto[0] || evidencias[0] || "Producto o desempeño esperado"),
        nivel1: "Presenta evidencias iniciales, incompletas o con apoyo constante.",
        nivel2: "Presenta evidencias básicas y responde a la consigna con apoyo parcial.",
        nivel3: "Presenta evidencias claras, organizadas y coherentes con el indicador trabajado.",
        nivel4: "Presenta evidencias completas, precisas y transferibles a una situación comunicativa o práctica.",
      },
      {
        criterio: textoCorto(ev.desempeno[0] || indicadores[0] || "Desempeño observable durante la actividad"),
        nivel1: "Realiza la actividad con dificultad y requiere guía frecuente.",
        nivel2: "Realiza parte de la actividad con apoyo y evidencia comprensión básica.",
        nivel3: "Realiza la actividad con autonomía, claridad y participación pertinente.",
        nivel4: "Realiza la actividad con autonomía, seguridad, creatividad y uso pertinente de los aprendizajes.",
      },
      {
        criterio: textoCorto(indicadores[1] || ev.conocimiento[0] || "Aplicación del indicador de logro"),
        nivel1: "Reconoce elementos aislados del contenido o indicador.",
        nivel2: "Aplica elementos básicos del contenido en situaciones guiadas.",
        nivel3: "Aplica el contenido de manera adecuada en la situación propuesta.",
        nivel4: "Integra el contenido con precisión, reflexión y pertinencia en nuevos contextos.",
      },
    ];
    return {
      modelo: "rubrica_minerd_ponderada",
      totalPuntos: 50,
      proporcionBase: pesos,
      niveles: NIVELES_RUBRICA_MINERD,
      criterios: criteriosBase.map((criterio, index) => ({
        id: `crit-${index + 1}`,
        ...criterio,
        puntajeMaximo: pesos[index],
        puntajesNiveles: puntajesPorNivel(pesos[index]),
      })),
    };
  }

  if (tipoNorm === "registro_anecdotico") {
    const criteriosBase = (baseItems.length ? baseItems : ["Conducta, desempeño o evidencia observada"]).slice(0, 4);
    return {
      criterios: criteriosBase.map((item, index) => ({
        id: `crit-anec-${index + 1}`,
        criterio: textoCorto(item, 120),
        puntajeMaximo: 0,
        nivel4: "Se observa de manera clara, autónoma y consistente.",
        nivel3: "Se observa de manera adecuada durante la actividad.",
        nivel2: "Se observa parcialmente o con apoyo.",
        nivel1: "Se observa de forma inicial o requiere seguimiento.",
        puntajesNiveles: null,
      })),
    };
  }

  if (tipoNorm === "escala_estimativa" || tipoNorm === "guia_observacion") {
    return {
      indicadores: (baseItems.length ? baseItems : ["Participa y evidencia el desempeño esperado"]).slice(0, 6).map((item, index) => ({
        id: `esc-${index + 1}`,
        indicador: textoCorto(item, 120),
        excelente: "Siempre y con precisión",
        bueno: "Casi siempre",
        regular: "Ocasionalmente",
        necesitaApoyo: "Requiere guía",
      })),
    };
  }

  return {
    indicadores: (baseItems.length ? baseItems : ["Evidencia el aprendizaje esperado"]).slice(0, 8).map((item, index) => ({
      id: `ind-${index + 1}`,
      indicador: textoCorto(item, 120),
      si: true,
      no: false,
    })),
  };
};

const descripcionInstrumentoClase = ({ clase = {}, capa = {}, tipoNorm }) => {
  const ev = evidenciasDeClase(clase);
  const partes = [
    `Borrador generado desde la planificación "${capa.secuencia || "Plan"}".`,
    clase.titulo ? `Clase: ${clase.titulo}.` : "",
    ev.producto.length ? `Producto: ${textoCorto(ev.producto.join("; "), 160)}.` : "",
    ev.desempeno.length ? `Desempeño: ${textoCorto(ev.desempeno.join("; "), 160)}.` : "",
    ev.conocimiento.length ? `Conocimiento: ${textoCorto(ev.conocimiento.join("; "), 160)}.` : "",
    tipoNorm === "rubrica" ? "Revisar criterios y ponderación antes de activar." : "Revisar indicadores antes de activar.",
  ];
  return partes.filter(Boolean).join(" ");
};

// ─── Fase 3 — Instrumentos ───────────────────────────────────────────────────

/**
 * Crea (o actualiza, mismo ID determinista) un instrumento desde una
 * planificación con capa curricular. También registra el vínculo
 * instrumento → aspecto del registro (bridge ya existente en firebase.js).
 *
 * @param {object} registroPlan  Doc de `planificaciones` con id y capaCurricular
 * @param {object} definicion    { tipo, titulo?, descripcion?, valorMaximo, ponderacion?, claseId? }
 */
export const crearInstrumentoDesdePlanificacion = async (registroPlan, definicion = {}) => {
  if (!disponible()) throw new Error("Necesitas iniciar sesión para crear instrumentos");
  const planificacionId = String(registroPlan?.id || registroPlan?.planificacionId || "");
  const capa = registroPlan?.capaCurricular || registroPlan?.contenido?.capaCurricular;
  if (!planificacionId || !capa) {
    throw new Error("La planificación necesita id y capa curricular para crear instrumentos vinculados");
  }

  const instrumento = construirInstrumentoDesdePlan({
    planificacionId,
    capa,
    docenteId: uid(),
    ...definicion,
  });

  await setDoc(refInstrumento(instrumento.id), {
    ...instrumento,
    uid: uid(),
    updatedAt: serverTimestamp(),
  }, { merge: true });

  // Vincular con el aspecto del registro (no bloquea si falla; se reporta)
  try {
    await guardarRegistroAspectoDesdeInstrumento(instrumento);
  } catch (error) {
    console.warn("[instrumentosService] Instrumento guardado, pero falló el vínculo con el aspecto:", error);
  }

  return instrumento;
};

/**
 * Crea en lote los instrumentos de una evaluación (p. ej. Rúbrica 50 +
 * Lista de cotejo 25 + Escala 25) y valida la ponderación (regla 10).
 *
 * @returns {{ instrumentos, ponderacion: { total, esCompleta, advertencia } }}
 */
export const crearInstrumentosDeEvaluacion = async (registroPlan, definiciones = []) => {
  const instrumentos = [];
  for (const definicion of definiciones) {
    instrumentos.push(await crearInstrumentoDesdePlanificacion(registroPlan, definicion));
  }
  const ponderacion = validarPonderacion(instrumentos);

  // Decisión de producto: los puntajes de los aspectos del registro se
  // derivan de la ponderación real de los instrumentos (editables después).
  const capa = registroPlan?.capaCurricular || registroPlan?.contenido?.capaCurricular;
  if (capa?.cursoId && instrumentos.length) {
    try {
      await sincronizarPuntajesAspectos({
        cursoId: capa.cursoId,
        planificacionId: String(registroPlan.id || registroPlan.planificacionId),
        instrumentos,
      });
    } catch (error) {
      console.warn("[instrumentosService] No se pudieron sincronizar los puntajes de aspectos:", error);
    }
  }

  return { instrumentos, ponderacion };
};

/**
 * FASE 10 — Reemplazo del puente legacy crearInstrumentosDesdePlan.
 *
 * Crea instrumentos esqueleto (status draft) desde los tipos planificados en
 * la capa curricular, con IDs DETERMINISTAS: re-guardar el plan no duplica
 * (el bridge viejo usaba Date.now() y creaba duplicados en cada guardado).
 * Los instrumentos ya creados con el formato viejo siguen siendo legibles:
 * la lectura (obtenerInstrumentosFirestore / por planificación) no cambia.
 */
export const crearInstrumentosPlaneadosDesdePlan = async (registroPlan) => {
  const capa = registroPlan?.capaCurricular || registroPlan?.contenido?.capaCurricular;
  const planificacionId = String(registroPlan?.id || registroPlan?.planificacionId || "");
  if (!capa || !planificacionId) return { instrumentos: [], tipos: [] };

  const instrumentos = [];
  const tipos = new Set();
  const clasesEvaluables = (capa.clases || []).filter(tieneEvidenciaEvaluable);

  for (const clase of clasesEvaluables) {
    const tipo = tipoSugeridoPorEvidencia(clase);
    tipos.add(tipo);
    const etiqueta = ETIQUETA_TIPO_INSTRUMENTO[tipo] || "Instrumento";
    const estructura = estructuraParaInstrumentoPlaneado({ tipoNorm: tipo, clase, capa });
    const evidenciaTipo = clase.evidencias?.producto?.length
      ? "producto"
      : clase.evidencias?.desempeno?.length
        ? "desempeno"
        : clase.evidencias?.conocimiento?.length
          ? "conocimiento"
          : "general";
    const instrumento = await crearInstrumentoDesdePlanificacion(registroPlan, {
      tipo,
      claseId: clase.claseId,
      titulo: `${etiqueta} — ${clase.titulo || capa.secuencia || "Clase"}`,
      descripcion: descripcionInstrumentoClase({ clase, capa, tipoNorm: tipo }),
      valorMaximo: valorSugeridoClase(clase, tipo),
      estructura,
      origenGeneracion: "planificacion_clase",
      evidenciaTipo,
    });
    instrumentos.push(instrumento);
  }

  if (!instrumentos.length) {
    const tiposPlaneados = capa.evaluacionPlanificada?.instrumentosPlaneadosGlobales || [];
    const tiposGlobales = [...new Set(tiposPlaneados.map((t) => normalizarTipoInstrumento(t)))]
      .filter((t) => t !== "otro" || tiposPlaneados.length === 0);
    if (!tiposGlobales.length) tiposGlobales.push("lista_cotejo");

    for (const tipo of tiposGlobales) {
      tipos.add(tipo);
      const instrumento = await crearInstrumentoDesdePlanificacion(registroPlan, {
        tipo,
        titulo: `${ETIQUETA_TIPO_INSTRUMENTO[tipo] || "Instrumento"} — ${capa.secuencia || "Plan"}`,
        valorMaximo: valorPorTipo(tipo),
        estructura: estructuraParaInstrumentoPlaneado({ tipoNorm: tipo, clase: {}, capa }),
        origenGeneracion: "planificacion_global",
      });
      instrumentos.push(instrumento);
    }
  }

  for (const instrumento of instrumentos) {
    await setDoc(refInstrumento(instrumento.id), {
      ...instrumento,
      uid: uid(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }

  return { instrumentos, tipos: [...tipos] };
};

export const obtenerInstrumentosPorPlanificacion = async (planificacionId) => {
  if (!disponible()) return [];
  const snap = await getDocs(
    query(colInstrumentos(), where("planificacionId", "==", String(planificacionId)))
  );
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
};

export const obtenerInstrumentosPorClase = async (planificacionId, claseId) => {
  const instrumentos = await obtenerInstrumentosPorPlanificacion(planificacionId);
  // Instrumentos de la clase + los globales de la secuencia (claseId vacío)
  return instrumentos.filter((ins) => !ins.claseId || ins.claseId === claseId);
};

// ─── Fase 4 — Resultados por estudiante ──────────────────────────────────────

/**
 * Guarda el resultado de un instrumento para un estudiante.
 * Estados: "evaluado" (con puntaje), "pendiente" (sin puntaje, NO cuenta 0),
 * "no_entrego" (0 explícito decidido por el docente).
 *
 * Escribe además una marca de aplicación mínima en el instrumento (usos,
 * status activo) en el MISMO batch para no dejar estados a medias.
 */
export const guardarResultadoInstrumento = async ({
  instrumento,
  estudianteId,
  estudianteNombre = "",
  puntajeObtenido = null,
  estado = "evaluado",
  observacionDocente = "",
  evidenciasIds = [],
  fechaEvaluacion = new Date().toISOString(),
}) => {
  if (!disponible()) throw new Error("Necesitas iniciar sesión para guardar resultados");

  const resultado = construirResultadoInstrumento({
    instrumento,
    estudianteId,
    estudianteNombre,
    puntajeObtenido,
    estado,
    observacionDocente,
    evidenciasIds,
    docenteId: uid(),
  });
  resultado.fechaEvaluacion = fechaEvaluacion;

  const batch = writeBatch(db);
  batch.set(refResultado(resultado.resultadoId), {
    ...resultado,
    uid: uid(),
    actualizadoEn: serverTimestamp(),
  }, { merge: true });

  const instrumentoId = String(instrumento.id || instrumento.instrumentoId);
  batch.set(refInstrumento(instrumentoId), {
    // Identidad mínima: si el instrumento venía del plan (efímero, Modo Aula)
    // el doc queda completo y visible en la página de Instrumentos.
    id: instrumentoId,
    nombre: instrumento.nombre || instrumento.titulo || "Instrumento",
    tipo: instrumento.tipo || "Otro",
    cursoId: String(instrumento.cursoId || ""),
    planificacionId: instrumento.planificacionId || "",
    claseId: instrumento.claseId || "",
    periodo: instrumento.periodo || "",
    competencia: instrumento.competencia || "",
    indicadores: instrumento.indicadores || [],
    indicadorIds: instrumento.indicadorIds || [],
    aspectoRegistroIds: instrumento.aspectoRegistroIds || [],
    valorMaximo: Number(instrumento.valorMaximo) || 100,
    usos: (Number(instrumento.usos) || 0) + (estado === "evaluado" ? 1 : 0),
    status: "activo",
    estado: instrumento.estado === "Borrador" || !instrumento.estado ? "Activo" : instrumento.estado,
    registroIntegracion: {
      ...(instrumento.registroIntegracion || {}),
      calificacionObtenida: resultado.puntajeObtenido,
      fecha: resultado.fechaEvaluacion,
      periodo: resultado.periodo,
    },
    updatedAt: serverTimestamp(),
  }, { merge: true });

  await batch.commit();
  return resultado;
};

export const obtenerResultadosPorInstrumento = async (instrumentoId) => {
  if (!disponible()) return [];
  const snap = await getDocs(
    query(colResultados(), where("instrumentoId", "==", String(instrumentoId)))
  );
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
};

export const obtenerResultadosPorEstudiante = async (estudianteId, { cursoId = "" } = {}) => {
  if (!disponible()) return [];
  const snap = await getDocs(
    query(colResultados(), where("estudianteId", "==", String(estudianteId)))
  );
  const datos = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
  return cursoId ? datos.filter((r) => r.cursoId === String(cursoId)) : datos;
};

export const obtenerResultadosPorPlanificacion = async (planificacionId) => {
  if (!disponible()) return [];
  const snap = await getDocs(
    query(colResultados(), where("planificacionId", "==", String(planificacionId)))
  );
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
};

export const obtenerResultado = async (resultadoId) => {
  if (!disponible()) return null;
  const snap = await getDoc(refResultado(resultadoId));
  return snap.exists() ? { ...snap.data(), id: snap.id } : null;
};

/**
 * Consolidación de la nota de un estudiante para una planificación
 * (reglas 10-11). Solo LECTURA + cálculo: la escritura en Mi Registro
 * (registroCalificaciones) es Fase 5 / Bloque B.
 */
export const calcularNotaConsolidadaEstudiante = async ({ planificacionId, estudianteId }) => {
  const [instrumentos, resultados] = await Promise.all([
    obtenerInstrumentosPorPlanificacion(planificacionId),
    obtenerResultadosPorPlanificacion(planificacionId),
  ]);
  return consolidarNotaEstudiante({
    instrumentos,
    resultados: resultados.filter((r) => String(r.estudianteId) === String(estudianteId)),
  });
};
