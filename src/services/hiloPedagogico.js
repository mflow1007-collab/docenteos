/**
 * hiloPedagogico.js — Núcleo puro del hilo pedagógico DocenteOS
 *
 * PLANIFICACIÓN → INSTRUMENTOS → MODO AULA → MI REGISTRO → BANCO DE EVIDENCIAS
 *
 * Este módulo NO importa Firebase: solo construye y calcula estructuras de
 * datos deterministas. Los servicios con I/O (planificacionDataService,
 * registroService, instrumentosService) consumen estas funciones y escriben
 * en las colecciones reales del proyecto:
 *
 *   planificaciones/{id}                                    (+ capaCurricular)
 *   usuarios/{uid}/cursos/{cursoId}/registroAspectos/{aspectoId}
 *   usuarios/{uid}/instrumentos/{instrumentoId}
 *   usuarios/{uid}/instrumentoResultados/{resultadoId}      (nueva)
 *
 * El átomo del sistema es el indicador de logro oficial (diseñoCurricular):
 *   competencias[].indicadoresLogro[] → { id: "IL-ING-1-COM-1", descripcion }
 */

// ─── Utilidades base ─────────────────────────────────────────────────────────

export const normalizarTexto = (texto = "") =>
  String(texto || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const slug = (texto = "") => normalizarTexto(texto).replace(/\s+/g, "-");

// Hash estable (djb2) para IDs locales de indicadores sin match oficial.
const hashEstable = (texto = "") => {
  let h = 5381;
  const s = normalizarTexto(texto);
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
};

// ─── Indicadores: texto ↔ ID oficial ─────────────────────────────────────────

/**
 * Aplana los indicadores de un documento de diseñoCurricular:
 * [{ id, descripcion, competenciaId }]
 */
export const indicadoresDelCurriculo = (curriculo) => {
  const competencias = Array.isArray(curriculo?.competencias) ? curriculo.competencias : [];
  return competencias.flatMap((comp) =>
    (comp.indicadoresLogro || []).map((ind) => ({
      id: ind.id || "",
      descripcion: ind.descripcion || ind.texto || "",
      competenciaId: comp.id || "",
    }))
  ).filter((ind) => ind.descripcion);
};

/**
 * Resuelve el texto de un indicador contra el currículo oficial.
 * Devuelve { id, descripcion, competenciaId, origenId: "oficial" | "local" }.
 * Si no hay match, genera un ID local ESTABLE (mismo texto → mismo ID) para
 * no perder nunca el vínculo ni duplicar aspectos en regeneraciones.
 */
export const resolverIndicador = (textoIndicador, indicadoresOficiales = []) => {
  const clave = normalizarTexto(textoIndicador);
  if (!clave) return null;

  const exacto = indicadoresOficiales.find((ind) => normalizarTexto(ind.descripcion) === clave);
  if (exacto) return { ...exacto, descripcion: textoIndicador.trim(), origenId: "oficial" };

  // Match por contención (el docente puede pegar el indicador recortado)
  const contenido = indicadoresOficiales.find((ind) => {
    const oficial = normalizarTexto(ind.descripcion);
    return (clave.length > 30 && oficial.includes(clave)) || (oficial.length > 30 && clave.includes(oficial));
  });
  if (contenido) return { ...contenido, descripcion: textoIndicador.trim(), origenId: "oficial" };

  return {
    id: `IL-LOCAL-${hashEstable(textoIndicador)}`,
    descripcion: textoIndicador.trim(),
    competenciaId: "",
    origenId: "local",
  };
};

// ─── Fase 1 — Capa curricular de la planificación ────────────────────────────

const MAPA_DIAS_SEMANA = {
  lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6, domingo: 0,
};

const calcularFechaSugerida = (fechaInicio, numeroSemana, nombreDia) => {
  if (!fechaInicio) return "";
  const base = new Date(`${fechaInicio}T12:00:00`);
  if (Number.isNaN(base.getTime())) return "";
  const objetivo = MAPA_DIAS_SEMANA[normalizarTexto(nombreDia)];
  if (objetivo === undefined) return "";
  // Lunes de la semana de inicio + (n-1) semanas + offset del día
  const lunesBase = new Date(base);
  lunesBase.setDate(base.getDate() - ((base.getDay() + 6) % 7));
  const fecha = new Date(lunesBase);
  fecha.setDate(lunesBase.getDate() + (numeroSemana - 1) * 7 + ((objetivo + 6) % 7));
  return fecha.toISOString().slice(0, 10);
};

const momentosAActividades = (momentos = []) => {
  const buscar = (nombre) =>
    momentos.find((m) => normalizarTexto(m.tipo || m.nombre) === nombre) || {};
  return {
    inicio: buscar("inicio").actividades || [],
    desarrollo: buscar("desarrollo").actividades || [],
    cierre: buscar("cierre").actividades || [],
  };
};

const instrumentosDeMomentos = (momentos = []) => {
  const tipos = new Set();
  for (const m of momentos) {
    const tipo = m.instrumento || m.evaluacion?.instrumento;
    if (tipo && typeof tipo === "string") tipos.add(tipo.trim());
  }
  return [...tipos];
};

const instrumentoPorTipoEvidencia = (evidencias = {}) => {
  const conocimiento = evidencias.conocimiento || [];
  const desempeno = evidencias.desempeno || [];
  const producto = evidencias.producto || [];

  if (producto.length) {
    return {
      tipo: "rubrica",
      etiqueta: "Rúbrica analítica",
      tecnica: "Revisión de producciones y observación del desempeño",
      agente: "Heteroevaluación / Coevaluación",
      momento: "Formativa o sumativa según la fase",
      valorSugerido: 50,
      razon: "La evidencia principal es un producto evaluable con criterios de calidad.",
    };
  }
  if (desempeno.length) {
    return {
      tipo: "escala_estimativa",
      etiqueta: "Escala de estimación",
      tecnica: "Observación directa del desempeño",
      agente: "Heteroevaluación",
      momento: "Formativa",
      valorSugerido: 25,
      razon: "La evidencia principal es un desempeño observable durante la actividad.",
    };
  }
  if (conocimiento.length) {
    return {
      tipo: "lista_cotejo",
      etiqueta: "Lista de cotejo",
      tecnica: "Preguntas orales, revisión breve y observación",
      agente: "Heteroevaluación",
      momento: "Diagnóstica o formativa",
      valorSugerido: 25,
      razon: "La evidencia principal permite verificar conocimientos puntuales.",
    };
  }
  return {
    tipo: "guia_observacion",
    etiqueta: "Guía de observación",
    tecnica: "Observación directa",
    agente: "Heteroevaluación",
    momento: "Formativa",
    valorSugerido: 25,
    razon: "No hay producto clasificado; se observa el proceso de aprendizaje.",
  };
};

export const construirMapaEvaluacionClase = ({
  claseId = "",
  indicadores = [],
  evidencias = {},
  evidenciasEsperadas = [],
  actividades = {},
  focoCurricular = "",
  criteriosExito = [],
} = {}) => {
  const instrumento = instrumentoPorTipoEvidencia(evidencias);
  const indicadorIds = indicadores.map((ind) => ind.id).filter(Boolean);
  const indicadorTextos = indicadores.map((ind) => ind.descripcion).filter(Boolean);
  const evidenciasClasificadas = {
    conocimiento: [...new Set(evidencias.conocimiento || [])],
    desempeno: [...new Set(evidencias.desempeno || [])],
    producto: [...new Set(evidencias.producto || [])],
  };

  return {
    version: 1,
    claseId,
    focoCurricular,
    indicadorIds,
    indicadores: indicadorTextos,
    evidencias: evidenciasClasificadas,
    evidenciasEsperadas,
    actividadBase: {
      inicio: actividades.inicio?.[0] || "",
      desarrollo: actividades.desarrollo?.[0] || "",
      cierre: actividades.cierre?.[0] || "",
    },
    instrumentoSugerido: instrumento,
    criteriosExito: criteriosExito.length
      ? criteriosExito
      : [...evidenciasClasificadas.producto, ...evidenciasClasificadas.desempeno, ...evidenciasClasificadas.conocimiento]
        .slice(0, 4)
        .map((ev) => `Evidencia: ${ev}`),
    registro: {
      origen: "indicadores_de_logro",
      aspectoIdsPendientes: indicadorIds,
      actualizaRegistro: indicadorIds.length > 0,
      regla: "El instrumento califica evidencias de la clase y consolida los aspectos vinculados a sus indicadores.",
    },
    modoAula: {
      mostrarInstrumento: true,
      capturarEvidencia: true,
      tipoEvidenciaPrincipal: evidenciasClasificadas.producto.length
        ? "producto"
        : evidenciasClasificadas.desempeno.length
          ? "desempeno"
          : evidenciasClasificadas.conocimiento.length
            ? "conocimiento"
            : "observacion",
    },
  };
};

const aplanarRecursos = (materialesSemana) => {
  if (!materialesSemana) return [];
  if (Array.isArray(materialesSemana)) return materialesSemana;
  return [
    ...(materialesSemana.impresos || []),
    ...(materialesSemana.digitales || []),
    ...(materialesSemana.otros || []),
  ];
};

const aplanarNEAE = (neae) => {
  if (!neae) return [];
  if (Array.isArray(neae)) return neae;
  return [
    ...(neae.acceso || []),
    ...(neae.curricular || []),
    ...(neae.evaluacion || []),
  ];
};

/**
 * A5.1 — Normaliza evidencias a la clasificación MINERD
 * { conocimiento, desempeno, producto }.
 *
 * - Objeto de evidenciasSemana (generador semanal): conocimientosPrevios →
 *   conocimiento, desempenoEsperado → desempeno, productoElaborar → producto.
 * - Los momentos nuevos traen evidenciasDetalle { conocimientos, desempeno,
 *   producto } por momento: se unen si la semana no trae la clave.
 * - Lista plana (planes viejos/unidad): NO se inventa clasificación — las
 *   tres listas quedan vacías y la lista plana solo vive en el campo
 *   derivado evidenciasEsperadas.
 */
export const clasificarEvidencias = (fuente, momentos = []) => {
  const evidencias = { conocimiento: [], desempeno: [], producto: [] };
  let planas = [];

  if (Array.isArray(fuente)) {
    planas = fuente.filter(Boolean);
  } else if (fuente && typeof fuente === "object") {
    evidencias.conocimiento = [...(fuente.conocimientosPrevios || fuente.conocimiento || [])];
    evidencias.desempeno = [...(fuente.desempenoEsperado || fuente.desempeno || [])];
    evidencias.producto = [...(fuente.productoElaborar || fuente.producto || [])];
  }

  // Completar desde los momentos (evidenciasDetalle del generador nuevo)
  for (const m of momentos) {
    const det = m?.evidenciasDetalle;
    if (!det) continue;
    if (!evidencias.conocimiento.length) evidencias.conocimiento.push(...(det.conocimientos || det.conocimiento || []));
    if (!evidencias.desempeno.length) evidencias.desempeno.push(...(det.desempeno || []));
    if (!evidencias.producto.length) evidencias.producto.push(...(det.producto || []));
  }

  const clasificadas = [...evidencias.conocimiento, ...evidencias.desempeno, ...evidencias.producto];
  return {
    evidencias,
    // Compatibilidad Bloque B: campo derivado (concatenación de las 3, o la
    // lista plana original si no hubo clasificación posible).
    evidenciasEsperadas: clasificadas.length ? clasificadas : planas,
  };
};

/**
 * Construye una clase normalizada (estructura C de la Fase 1).
 * claseId es determinista dentro de la planificación: "clase-s{semana}-d{dia}".
 */
const construirClase = ({
  semana, dia, numeroClase, indicadores, fechaInicio, criteriosExito = [],
  recursos = [], fuenteEvidencias = null, neae = [],
}) => {
  const momentos = dia.momentos || [];
  const actividades = momentosAActividades(momentos);
  const indicadoresDiaIds = Array.isArray(dia.indicadoresTrabajados)
    ? dia.indicadoresTrabajados.map((id) => String(id || "").trim()).filter(Boolean)
    : [];
  const indicadoresClase = indicadoresDiaIds.length
    ? indicadores.filter((ind) => indicadoresDiaIds.includes(ind.id))
    : indicadores;
  const indicadoresParaClase = indicadoresClase.length ? indicadoresClase : indicadores;
  const indicadorPrincipal = indicadoresParaClase.length
    ? indicadoresParaClase[(numeroClase - 1) % indicadoresParaClase.length]
    : null;
  const { evidencias, evidenciasEsperadas } = clasificarEvidencias(fuenteEvidencias, momentos);
  const claseId = `clase-s${semana}-d${dia.n || dia.numeroGlobal || numeroClase}`;
  const focoCurricular = dia.focoLinguistico || dia.focoCurricular || dia.etapaProgresion || "";
  const mapaEvaluacion = construirMapaEvaluacionClase({
    claseId,
    indicadores: indicadoresParaClase,
    evidencias,
    evidenciasEsperadas,
    actividades,
    focoCurricular,
    criteriosExito: Array.isArray(dia.criteriosExito) ? dia.criteriosExito : criteriosExito,
  });

  return {
    claseId,
    numeroClase,
    semana,
    nombreDia: dia.nombre || "",
    fechaSugerida: dia.diaCalendario || calcularFechaSugerida(fechaInicio, semana, dia.nombre || ""),
    titulo: dia.tituloDia || dia.titulo || `Clase ${numeroClase}`,
    intencionPedagogica: dia.intencionPedagogica || "",
    actividades,
    momentoInicio: (actividades.inicio || []).join(" · "),
    momentoDesarrollo: (actividades.desarrollo || []).join(" · "),
    momentoCierre: (actividades.cierre || []).join(" · "),
    recursos,
    evidencias,           // A5.1: clasificación MINERD { conocimiento, desempeno, producto }
    evidenciasEsperadas,  // derivado (compatibilidad con consumidores del Bloque B)
    mapaEvaluacion,
    instrumentosPlaneados: [mapaEvaluacion.instrumentoSugerido.etiqueta],
    instrumentosReferenciaMomentos: instrumentosDeMomentos(momentos),
    indicadorPrincipalId: indicadorPrincipal?.id || "",
    indicadoresTrabajados: indicadoresParaClase.map((ind) => ind.id),
    criteriosExito: Array.isArray(dia.criteriosExito) && dia.criteriosExito.length
      ? dia.criteriosExito
      : criteriosExito,
    metacognicion: momentos.flatMap((m) => m.metacognicion || []),
    neae,
  };
};

/**
 * FASE 1 — Construye la capa curricular normalizada de una planificación.
 *
 * Soporta las TRES formas reales de plan del proyecto:
 *  - Semanal   → contenido.desarrolloSemanal[] (planificacionService.generarPlanificacion)
 *  - Unidad    → contenido.fasesSemanales[] | contenido.fases[] (unidadAprendizajeService)
 *  - Diario    → contenido.desarrolloClase{} (planDiarioService)
 *
 * @param {object} planificacion  Contenido del plan (lo que va en el campo `contenido`)
 * @param {object} opciones
 *   - curriculo: doc de diseñoCurricular (o null si no hay currículo importado)
 *   - cursoId, docenteId: contexto de guardado
 * @returns capaCurricular normalizada (apartados A-D de la Fase 1)
 */
export const construirCapaCurricular = (planificacion, { curriculo = null, cursoId = "", docenteId = "" } = {}) => {
  const meta = planificacion?.metadatos || {};
  const datos = planificacion?.datosGenerales || {};
  const oficiales = indicadoresDelCurriculo(curriculo);

  // — Textos de indicadores según la forma del plan —
  const textosIndicadores = (
    Array.isArray(meta.indicadoresOficiales) && meta.indicadoresOficiales.length
      ? meta.indicadoresOficiales
      : Array.isArray(datos.indicadoresOficiales) && datos.indicadoresOficiales.length
        ? datos.indicadoresOficiales
        : Array.isArray(planificacion?.competencias?.indicadores)
          ? planificacion.competencias.indicadores
          : []
  ).filter(Boolean);

  // Unidad de Aprendizaje: la especificación curricular ya trae IDs oficiales
  const especificacion = planificacion?.especificacionCurricular || null;
  let indicadoresSeleccionados;
  if (especificacion?.indicadores?.length) {
    indicadoresSeleccionados = especificacion.indicadores.map((ind) => ({
      id: ind.id || `IL-LOCAL-${hashEstable(ind.descripcion)}`,
      descripcion: ind.descripcion || "",
      competenciaId: "",
      origenId: ind.id ? "oficial" : "local",
    })).filter((ind) => ind.descripcion);
  } else {
    indicadoresSeleccionados = textosIndicadores
      .map((texto) => resolverIndicador(texto, oficiales))
      .filter(Boolean);
  }

  // — Competencias seleccionadas —
  const competenciasCurriculo = Array.isArray(curriculo?.competencias) ? curriculo.competencias : [];
  const textoCompetencia = datos.competencia || meta.competenciaSeleccionada || "";
  let competenciasSeleccionadas = [];
  if (especificacion?.ces?.length) {
    competenciasSeleccionadas = especificacion.ces
      .map((c) => ({ id: c.id || "", descripcion: c.descripcion || "", competenciaFundamental: "" }))
      .filter((c) => c.descripcion);
  } else if (textoCompetencia) {
    const match = competenciasCurriculo.find(
      (c) => normalizarTexto(c.descripcion) === normalizarTexto(textoCompetencia)
    );
    competenciasSeleccionadas = [{
      id: match?.id || `CE-LOCAL-${hashEstable(textoCompetencia)}`,
      descripcion: textoCompetencia,
      competenciaFundamental: match?.competenciaFundamental || "",
    }];
  }
  // Completar con las competencias de los indicadores oficiales usados
  const idsComp = new Set(competenciasSeleccionadas.map((c) => c.id));
  for (const ind of indicadoresSeleccionados) {
    if (ind.competenciaId && !idsComp.has(ind.competenciaId)) {
      const comp = competenciasCurriculo.find((c) => c.id === ind.competenciaId);
      if (comp) {
        competenciasSeleccionadas.push({
          id: comp.id,
          descripcion: comp.descripcion || "",
          competenciaFundamental: comp.competenciaFundamental || "",
        });
        idsComp.add(comp.id);
      }
    }
  }

  // — Clases por semana/día —
  const fechaInicio = meta.fechaInicio || "";
  const clases = [];
  let numeroClase = 0;

  const semanasSemanal = Array.isArray(planificacion?.desarrolloSemanal) ? planificacion.desarrolloSemanal : [];
  const fasesUnidad = Array.isArray(planificacion?.fasesSemanales)
    ? planificacion.fasesSemanales
    : Array.isArray(planificacion?.fases) ? planificacion.fases : [];

  if (semanasSemanal.length) {
    for (const semana of semanasSemanal) {
      const criteriosSemana = semana.evaluacionSemana?.criterios || [];
      const recursosSemana = aplanarRecursos(semana.materialesSemana);
      const neaeSemana = aplanarNEAE(semana.adecuacionesNEAE);
      for (const dia of semana.dias || []) {
        numeroClase += 1;
        clases.push(construirClase({
          semana: semana.n || 1,
          dia,
          numeroClase,
          indicadores: indicadoresSeleccionados,
          fechaInicio,
          criteriosExito: criteriosSemana,
          recursos: recursosSemana,
          // A5.1: el objeto completo (conocimientosPrevios / desempenoEsperado
          // / productoElaborar) — la clasificación la hace clasificarEvidencias
          fuenteEvidencias: semana.evidenciasSemana || null,
          neae: neaeSemana,
        }));
      }
    }
  } else if (fasesUnidad.length) {
    for (const fase of fasesUnidad) {
      for (const dia of fase.dias || []) {
        numeroClase += 1;
        clases.push(construirClase({
          semana: dia.semana || fase.semana || 1,
          dia,
          numeroClase,
          indicadores: indicadoresSeleccionados,
          fechaInicio,
          recursos: aplanarRecursos(dia.recursos || fase.recursos),
          fuenteEvidencias: dia.evidencias || fase.evidencias || null,
          neae: aplanarNEAE(fase.adecuacionesNEAE || dia.neae),
        }));
      }
    }
  } else if (planificacion?.desarrolloClase) {
    // Plan Diario: una sola clase
    const dc = planificacion.desarrolloClase;
    const momentos = ["inicio", "desarrollo", "cierre"].map((k) => ({
      tipo: k.charAt(0).toUpperCase() + k.slice(1),
      actividades: dc[k]?.actividades || [],
      instrumento: dc[k]?.evaluacion?.instrumento || dc[k]?.evaluacion?.tipo || "",
      metacognicion: dc[k]?.metacognicion || [],
    }));
    clases.push(construirClase({
      semana: 1,
      dia: { n: 1, nombre: "", titulo: meta.tema || "Clase", intencionPedagogica: planificacion.intencionPedagogica?.intencionDelDia || "", momentos },
      numeroClase: 1,
      indicadores: indicadoresSeleccionados,
      fechaInicio,
    }));
  }

  // — Evaluación planificada (apartado D) —
  const instrumentosGlobales = [...new Set(clases.flatMap((c) => c.instrumentosPlaneados))];
  const evidenciasGlobales = [...new Set(clases.flatMap((c) => c.evidenciasEsperadas))];
  const mapasEvaluacion = clases.map((c) => c.mapaEvaluacion).filter(Boolean);
  // A5.1: globales clasificados MINERD (unión sin duplicados por categoría)
  const evidenciasGlobalesClasificadas = {
    conocimiento: [...new Set(clases.flatMap((c) => c.evidencias?.conocimiento || []))],
    desempeno: [...new Set(clases.flatMap((c) => c.evidencias?.desempeno || []))],
    producto: [...new Set(clases.flatMap((c) => c.evidencias?.producto || []))],
  };

  return {
    version: 1,
    curriculumSourceId: curriculo?.id || planificacion?.curricularContentId || null,
    cursoId: cursoId || meta.cursoId || "",
    docenteId: docenteId || "",
    nivel: meta.nivelEducativo || curriculo?.nivel || "",
    grado: meta.grado || "",
    seccion: meta.seccion || "",
    area: meta.area || datos.area || "",
    asignatura: meta.asignatura || curriculo?.asignatura || "",
    periodo: meta.periodo || "",
    secuencia: meta.tema || meta.titulo || "",
    estado: "activa",
    competenciasSeleccionadas,
    indicadoresSeleccionados,
    contenidosSeleccionados: datos.contenidos || planificacion?.contenidos || {
      conceptuales: [], procedimentales: [], actitudinales: [],
    },
    temasSeleccionados: Array.isArray(meta.temasIntegrados) && meta.temasIntegrados.length
      ? meta.temasIntegrados
      : [meta.tema || meta.titulo].filter(Boolean),
    estrategiasSeleccionadas: planificacion?.estrategias || [],
    clases,
    evaluacionPlanificada: {
      instrumentosPlaneadosGlobales: instrumentosGlobales,
      // Un aspecto evaluable por indicador; el aspectoId definitivo se forma
      // con planificacionId_indicadorId al guardar (ver crearAspectoId).
      aspectosEvaluables: indicadoresSeleccionados.map((ind) => ind.id),
      ponderacionGlobal: null, // se completa al vincular instrumentos con ponderación
      evidencias: evidenciasGlobalesClasificadas, // A5.1: { conocimiento, desempeno, producto }
      evidenciasEsperadasGlobales: evidenciasGlobales, // derivado (compatibilidad)
      mapaEvaluacion: {
        version: 1,
        clases: mapasEvaluacion,
        instrumentosSugeridos: [...new Set(mapasEvaluacion.map((m) => m.instrumentoSugerido?.etiqueta).filter(Boolean))],
        regla: "Cada clase vincula indicadores, evidencias MINERD, instrumento sugerido, aspecto de registro y captura en Modo Aula.",
      },
    },
  };
};

// ─── Fase 2 — Aspectos del Registro desde los indicadores ────────────────────

/** ID determinista del aspecto: garantiza idempotencia por planificación+indicador. */
export const crearAspectoId = (planificacionId, indicadorId) =>
  [planificacionId, indicadorId].filter(Boolean).join("_") || `aspecto-${Date.now()}`;

/**
 * Versión corta y legible del indicador para la columna del registro.
 * Determinista: corta en la primera coma o en límite de palabra (~70 chars).
 */
export const acortarIndicador = (texto = "", maximo = 70) => {
  const limpio = String(texto || "").trim().replace(/\s+/g, " ");
  if (!limpio) return "";
  const primeraClausula = limpio.split(/[,;]/)[0].trim();
  const candidato = primeraClausula.length >= 20 ? primeraClausula : limpio;
  if (candidato.length <= maximo) return candidato.replace(/[.]$/, "") + ".";
  const corte = candidato.slice(0, maximo).replace(/\s+\S*$/, "");
  return `${corte}…`;
};

/** Reparte 100 puntos entre n aspectos (34/33/33 para n=3). */
export const repartirPuntaje = (n, total = 100) => {
  if (!n || n < 1) return [];
  const base = Math.floor(total / n);
  const resto = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < resto ? 1 : 0));
};

/**
 * FASE 2 — Genera los documentos de aspectos del registro desde la capa
 * curricular. PURO: no escribe; el registroService compara contra lo existente
 * y persiste solo lo nuevo (idempotencia por ID determinista).
 *
 * Mantiene los campos legacy que ya lee RegistroCalificacionesPage
 * (nombre, puntajeMaximo, indicadores, origen, estado, orden, editable)
 * y añade los campos del hilo (indicadorId, textoIndicadorOriginal,
 * aspectoVisible, planificacionId, periodoId, activo).
 */
export const generarAspectosDesdeCapa = (capa, { planificacionId, cursoId, ahora = new Date().toISOString() }) => {
  const indicadores = capa?.indicadoresSeleccionados || [];
  const puntajes = repartirPuntaje(indicadores.length);
  return indicadores.map((ind, i) => {
    const aspectoVisible = acortarIndicador(ind.descripcion);
    return {
      aspectoId: crearAspectoId(planificacionId, ind.id),
      cursoId: String(cursoId || capa.cursoId || ""),
      periodoId: capa.periodo || "",
      periodo: capa.periodo || "",
      planificacionId: String(planificacionId || ""),
      indicadorId: ind.id,
      competenciaId: ind.competenciaId || "",
      textoIndicadorOriginal: ind.descripcion,
      aspectoVisible,
      // Campos legacy usados hoy por la pestaña "Aspectos" del Registro
      nombre: aspectoVisible,
      puntajeMaximo: puntajes[i],
      tipoInstrumento: "indicador",
      instrumentoId: "",
      indicadores: [ind.descripcion],
      competencia: capa.competenciasSeleccionadas?.[0]?.descripcion || "",
      area: capa.area || "",
      asignatura: capa.asignatura || "",
      grado: capa.grado || "",
      secuencia: capa.secuencia || "",
      orden: i + 1,
      activo: true,
      estado: "activo",
      origen: "planificacion",
      editable: true,
      modificadoManual: false,
      fechaCreacion: ahora,
      fechaActualizacion: ahora,
    };
  });
};

// ─── Fase 3 — Instrumentos ligados a la planificación ────────────────────────

export const TIPOS_INSTRUMENTO = [
  "rubrica", "lista_cotejo", "escala_estimativa", "registro_anecdotico", "guia_observacion", "otro",
];

// Mapeo tipo nuevo ↔ etiqueta legacy usada por InstrumentosPage / Modo Aula
export const ETIQUETA_TIPO_INSTRUMENTO = {
  rubrica: "Rúbrica",
  lista_cotejo: "Lista de cotejo",
  escala_estimativa: "Escala de estimación",
  registro_anecdotico: "Registro anecdótico",
  guia_observacion: "Guía de observación",
  otro: "Otro",
};

export const normalizarTipoInstrumento = (valor = "") => {
  const texto = normalizarTexto(valor);
  if (texto.includes("rubrica")) return "rubrica";
  if (texto.includes("cotejo")) return "lista_cotejo";
  if (texto.includes("escala") || texto.includes("valoracion") || texto.includes("estimacion")) return "escala_estimativa";
  if (texto.includes("anecdot")) return "registro_anecdotico";
  if (texto.includes("guia") && texto.includes("observacion")) return "guia_observacion";
  return TIPOS_INSTRUMENTO.includes(texto) ? texto : "otro";
};

/** ID determinista: re-crear instrumentos desde el plan no duplica. */
export const crearInstrumentoId = ({ planificacionId, tipo, claseId = "" }) =>
  ["ins", planificacionId, normalizarTipoInstrumento(tipo), claseId || "global"]
    .filter(Boolean).join("-");

/**
 * FASE 3 — Construye el documento de instrumento vinculado a la planificación.
 * Conserva la forma legacy (vinculacion, estructura, aplicaciones, estado
 * "Borrador"/"Activo") que consumen InstrumentosPage, Modo Aula y los bridges,
 * y añade los campos del hilo (claseId, indicadorIds, aspectoRegistroIds,
 * ponderacion, status).
 */
export const construirInstrumentoDesdePlan = ({
  planificacionId,
  capa,
  tipo,
  titulo = "",
  descripcion = "",
  valorMaximo = 100,
  ponderacion = null,
  claseId = "",
  docenteId = "",
  estructura = null,
  origenGeneracion = "",
  evidenciaTipo = "",
  ahora = new Date().toISOString(),
}) => {
  if (!planificacionId) throw new Error("planificacionId es obligatorio para crear el instrumento");
  if (!capa) throw new Error("La planificación no tiene capa curricular; genera la capa antes de crear instrumentos");

  const tipoNorm = normalizarTipoInstrumento(tipo);
  const etiqueta = ETIQUETA_TIPO_INSTRUMENTO[tipoNorm] || "Otro";
  const clase = claseId ? (capa.clases || []).find((c) => c.claseId === claseId) : null;
  const indicadorIds = clase?.indicadoresTrabajados?.length
    ? clase.indicadoresTrabajados
    : (capa.indicadoresSeleccionados || []).map((ind) => ind.id);
  const indicadoresTexto = (capa.indicadoresSeleccionados || [])
    .filter((ind) => indicadorIds.includes(ind.id))
    .map((ind) => ind.descripcion);
  const aspectoRegistroIds = indicadorIds.map((id) => crearAspectoId(planificacionId, id));
  const id = crearInstrumentoId({ planificacionId, tipo: tipoNorm, claseId });
  const nombre = titulo || `${etiqueta} — ${clase?.titulo || capa.secuencia || "Evaluación"}`;

  return {
    id,
    instrumentoId: id,
    evaluacionId: `eval-${planificacionId}-${slug(capa.periodo || "periodo-1")}`,
    planificacionId: String(planificacionId),
    claseId: claseId || "",
    cursoId: String(capa.cursoId || "registro-general"),
    docenteId,
    tipo: etiqueta,               // legacy (UI actual)
    tipoInstrumento: tipoNorm,    // hilo (nuevo)
    nombre,
    titulo: nombre,
    descripcion: descripcion || `Instrumento vinculado a la planificación "${capa.secuencia}".`,
    curso: [capa.grado, capa.seccion].filter(Boolean).join(" "),
    area: capa.area || "",
    asignatura: capa.asignatura || capa.area || "",
    grado: capa.grado || "",
    seccion: capa.seccion || "",
    periodo: capa.periodo || "Periodo 1",
    competencia: capa.competenciasSeleccionadas?.[0]?.descripcion || "",
    competenciaIds: (capa.competenciasSeleccionadas || []).map((c) => c.id),
    indicador: indicadoresTexto[0] || "",
    indicadores: indicadoresTexto,
    indicadorIds,
    aspectoRegistroIds,
    evidenciasEsperadas: clase?.evidenciasEsperadas || capa.evaluacionPlanificada?.evidenciasEsperadasGlobales || [],
    criterios: [],
    recursosRelacionados: clase?.recursos || [],
    valorMaximo: Number(valorMaximo) || 100,
    ponderacion: ponderacion === null || ponderacion === undefined ? null : Number(ponderacion),
    status: "draft",              // hilo: draft | activo | cerrado
    estado: "Borrador",           // legacy: Borrador | Activo | Inactivo
    usos: 0,
    aplicaciones: [],
    estructura: estructura || { criterios: [], indicadores: [] },
    origenGeneracion,
    evidenciaTipo,
    vinculacion: {
      area: capa.area || "",
      asignatura: capa.asignatura || "",
      grado: capa.grado || "",
      seccion: capa.seccion || "",
      curso: [capa.grado, capa.seccion].filter(Boolean).join(" "),
      cursoId: String(capa.cursoId || ""),
      planificacionId: String(planificacionId),
      claseId: claseId || "",
      competenciaEspecifica: capa.competenciasSeleccionadas?.[0]?.descripcion || "",
      indicadorLogro: indicadoresTexto[0] || "",
      indicadoresLogro: indicadoresTexto,
      indicadorIds,
      periodo: capa.periodo || "",
    },
    registroIntegracion: {
      competenciaEvaluada: capa.competenciasSeleccionadas?.[0]?.descripcion || "",
      indicadorEvaluado: indicadoresTexto[0] || "",
      calificacionObtenida: null,
      fecha: null,
      periodo: capa.periodo || "",
    },
    fechaCreacion: ahora,
    createdAt: ahora,
    updatedAt: ahora,
  };
};

// ─── Regla 10 — Ponderación de instrumentos de un período ────────────────────

/**
 * Valida la ponderación de un conjunto de instrumentos. Si no suman 100,
 * calcula la normalización proporcional y produce la advertencia para el
 * docente. Nunca falla silenciosamente.
 */
export const validarPonderacion = (instrumentos = []) => {
  const conPonderacion = instrumentos.map((ins) => ({
    ...ins,
    ponderacion: Number(ins.ponderacion ?? ins.valorMaximo) || 0,
  }));
  const total = conPonderacion.reduce((s, ins) => s + ins.ponderacion, 0);
  const esCompleta = total === 100;
  const factor = total > 0 ? 100 / total : 0;
  return {
    total,
    esCompleta,
    factorNormalizacion: factor,
    advertencia: esCompleta ? null : `Tus instrumentos suman ${total}/100`,
    instrumentosNormalizados: conPonderacion.map((ins) => ({
      ...ins,
      ponderacionNormalizada: Math.round(ins.ponderacion * factor * 100) / 100,
    })),
  };
};

// ─── Fase 4 — Resultados de instrumento por estudiante ───────────────────────

export const ESTADOS_RESULTADO = ["evaluado", "pendiente", "no_entrego"];

/** ID determinista: un resultado por estudiante por instrumento (re-evaluar sobreescribe). */
export const crearResultadoId = (instrumentoId, estudianteId) =>
  `${instrumentoId}__${estudianteId}`;

export const nivelLogroDesdePorcentaje = (pct) => {
  if (pct === null || pct === undefined || Number.isNaN(Number(pct))) return "";
  const n = Number(pct);
  if (n >= 85) return "Logrado";
  if (n >= 70) return "En proceso";
  return "Necesita apoyo";
};

/**
 * FASE 4 — Construye el documento de instrumentoResultados.
 * Reglas:
 *  - estado "pendiente" → puntaje null (NO cuenta como 0)
 *  - estado "no_entrego" → puntaje 0 explícito (decisión del docente)
 *  - estado "evaluado" → requiere puntajeObtenido y puntajeMaximo válidos
 */
export const construirResultadoInstrumento = ({
  instrumento,
  estudianteId,
  estudianteNombre = "",
  puntajeObtenido = null,
  estado = "evaluado",
  observacionDocente = "",
  evidenciasIds = [],
  docenteId = "",
  fechaEvaluacion = new Date().toISOString(),
  ahora = new Date().toISOString(),
}) => {
  if (!instrumento?.id && !instrumento?.instrumentoId) throw new Error("El instrumento es obligatorio");
  if (!estudianteId) throw new Error("estudianteId es obligatorio");
  if (!ESTADOS_RESULTADO.includes(estado)) {
    throw new Error(`Estado inválido "${estado}". Usa: ${ESTADOS_RESULTADO.join(", ")}`);
  }

  const instrumentoId = String(instrumento.id || instrumento.instrumentoId);
  const puntajeMaximo = Number(instrumento.valorMaximo ?? instrumento.puntajeMaximo) || 100;

  let puntaje = null;
  if (estado === "evaluado") {
    puntaje = Number(puntajeObtenido);
    if (!Number.isFinite(puntaje)) throw new Error("puntajeObtenido es obligatorio cuando estado = evaluado");
    puntaje = Math.min(puntajeMaximo, Math.max(0, puntaje));
  } else if (estado === "no_entrego") {
    puntaje = 0;
  }

  const porcentaje = puntaje === null ? null : Math.round((puntaje / puntajeMaximo) * 100);

  return {
    resultadoId: crearResultadoId(instrumentoId, estudianteId),
    cursoId: String(instrumento.cursoId || ""),
    estudianteId: String(estudianteId),
    estudianteNombre,
    docenteId,
    planificacionId: instrumento.planificacionId || "",
    claseId: instrumento.claseId || "",
    instrumentoId,
    tipoInstrumento: instrumento.tipoInstrumento || normalizarTipoInstrumento(instrumento.tipo),
    indicadorIds: instrumento.indicadorIds || [],
    aspectoRegistroIds: instrumento.aspectoRegistroIds || [],
    puntajeObtenido: puntaje,
    puntajeMaximo,
    porcentaje,
    ponderacion: instrumento.ponderacion ?? null,
    nivelLogro: nivelLogroDesdePorcentaje(porcentaje),
    estado,
    observacionDocente,
    evidenciasIds,
    fechaEvaluacion,
    periodo: instrumento.periodo || "",
    origen: "instrumento",
    createdAt: ahora,
    updatedAt: ahora,
  };
};

// ─── Fase 8 — Evidencia desde un resultado de instrumento ────────────────────

/**
 * Construye el documento de evidencia del banco a partir de un resultado
 * (Fase 4). PURO. ID determinista `evi-{resultadoId}`: re-evaluar actualiza
 * la misma evidencia. Devuelve null si el resultado está pendiente.
 */
export const construirEvidenciaDesdeResultado = (resultado, { instrumento = null, claseTitulo = "", docenteId = "" } = {}) => {
  if (!resultado?.resultadoId) throw new Error("El resultado es obligatorio para crear la evidencia");
  if (resultado.estado === "pendiente") return null;

  const evidenciaId = `evi-${resultado.resultadoId}`;
  const titulo = instrumento?.nombre || `Evaluación ${resultado.tipoInstrumento || "instrumento"}`;
  const descripcion = resultado.estado === "no_entrego"
    ? `${resultado.estudianteNombre || "El estudiante"} no entregó ${titulo}.`
    : `${resultado.estudianteNombre || "El estudiante"} obtuvo ${resultado.puntajeObtenido}/${resultado.puntajeMaximo} en ${titulo}.`;

  return {
    evidenciaId,
    id: evidenciaId,
    estudianteId: resultado.estudianteId,
    cursoId: resultado.cursoId,
    docenteId: resultado.docenteId || docenteId || "",
    planificacionId: resultado.planificacionId || "",
    claseId: resultado.claseId || "",
    instrumentoId: resultado.instrumentoId,
    resultadoId: resultado.resultadoId,
    indicadorId: resultado.indicadorIds?.[0] || "",
    indicadorIds: resultado.indicadorIds || [],
    aspectoId: resultado.aspectoRegistroIds?.[0] || "",
    aspectoIds: resultado.aspectoRegistroIds || [],
    tipo: "resultado_instrumento",
    titulo,
    descripcion,
    tema: claseTitulo || instrumento?.actividad || "",
    periodo: resultado.periodo || "",
    periodoId: resultado.periodo || "",
    fecha: resultado.fechaEvaluacion || new Date().toISOString(),
    calificacionAsociada: resultado.puntajeObtenido,
    calificacion: resultado.puntajeObtenido,
    puntajeMaximo: resultado.puntajeMaximo,
    porcentaje: resultado.porcentaje,
    nivelLogro: resultado.nivelLogro || nivelLogroDesdePorcentaje(resultado.porcentaje),
    observacionDocente: resultado.observacionDocente || "",
    indicadores: resultado.indicadorIds || [],
    origen: "instrumento",
    metadata: { estadoResultado: resultado.estado, tipoInstrumento: resultado.tipoInstrumento || "" },
  };
};

// ─── Reglas 10-12 — Consolidación de nota (base de Mi Registro, Fase 5) ──────

/**
 * Consolida la nota de UN estudiante a partir de los resultados de los
 * instrumentos del período (reglas 10 y 11).
 *
 * - Instrumentos sin resultado o con estado "pendiente" NO cuentan como 0:
 *   se excluyen y la nota queda marcada como parcial.
 * - "no_entrego" cuenta como 0 (decisión explícita del docente).
 * - Si las ponderaciones no suman 100, se normalizan proporcionalmente y se
 *   arrastra la advertencia de validarPonderacion.
 *
 * @returns {{ valorCalculado, esParcial, pendientes[], evaluados[], advertenciaPonderacion, origenResultados[] }}
 */
export const consolidarNotaEstudiante = ({ instrumentos = [], resultados = [] }) => {
  const { instrumentosNormalizados, advertencia } = validarPonderacion(instrumentos);
  const porInstrumento = new Map(
    resultados.map((r) => [String(r.instrumentoId), r])
  );

  const evaluados = [];
  const pendientes = [];
  let puntosPonderados = 0;
  let ponderacionEvaluada = 0;

  for (const ins of instrumentosNormalizados) {
    const insId = String(ins.id || ins.instrumentoId);
    const resultado = porInstrumento.get(insId);
    const cuentaComoEvaluado = resultado && (resultado.estado === "evaluado" || resultado.estado === "no_entrego");

    if (!cuentaComoEvaluado) {
      pendientes.push(insId);
      continue;
    }

    const maximo = Number(resultado.puntajeMaximo) || Number(ins.valorMaximo) || 100;
    const obtenido = Number(resultado.puntajeObtenido) || 0;
    const proporcion = maximo > 0 ? obtenido / maximo : 0;
    puntosPonderados += proporcion * ins.ponderacionNormalizada;
    ponderacionEvaluada += ins.ponderacionNormalizada;
    evaluados.push(resultado.resultadoId || insId);
  }

  const esParcial = pendientes.length > 0 && evaluados.length > 0;
  // Nota sobre lo evaluado (los pendientes no bajan la nota — regla 11)
  const valorCalculado = ponderacionEvaluada > 0
    ? Math.round((puntosPonderados / ponderacionEvaluada) * 100)
    : null;

  return {
    valorCalculado,
    esParcial,
    pendientes,
    evaluados,
    ponderacionEvaluada: Math.round(ponderacionEvaluada * 100) / 100,
    advertenciaPonderacion: advertencia,
    origenResultados: evaluados,
  };
};

/**
 * Deriva el puntaje de cada aspecto del registro desde la ponderación de los
 * instrumentos que lo alimentan (decisión de producto: derivado por defecto,
 * editable por el docente).
 *
 * Peso de un aspecto = Σ sobre los instrumentos que lo alimentan de
 * (ponderaciónNormalizada del instrumento / cantidad de aspectos que alimenta).
 * El total se re-escala a 100 puntos enteros conservando la suma.
 *
 * @returns Map<aspectoId, puntaje>  (vacío si no hay instrumentos con vínculo)
 */
export const derivarPuntajesAspectos = (instrumentos = [], aspectoIds = []) => {
  const { instrumentosNormalizados } = validarPonderacion(instrumentos);
  const pesos = new Map(aspectoIds.map((id) => [id, 0]));
  let hayVinculos = false;

  for (const ins of instrumentosNormalizados) {
    const destinos = (ins.aspectoRegistroIds || []).filter((id) => pesos.has(id));
    if (!destinos.length) continue;
    hayVinculos = true;
    const cuota = ins.ponderacionNormalizada / destinos.length;
    for (const id of destinos) pesos.set(id, pesos.get(id) + cuota);
  }
  if (!hayVinculos) return new Map();

  // Re-escalar a enteros que suman 100 (método de mayores restos)
  const totalPesos = [...pesos.values()].reduce((s, v) => s + v, 0) || 1;
  const exactos = [...pesos.entries()].map(([id, peso]) => [id, (peso / totalPesos) * 100]);
  const enteros = new Map(exactos.map(([id, v]) => [id, Math.floor(v)]));
  let faltante = 100 - [...enteros.values()].reduce((s, v) => s + v, 0);
  const porResto = exactos
    .map(([id, v]) => [id, v - Math.floor(v)])
    .sort((a, b) => b[1] - a[1]);
  for (const [id] of porResto) {
    if (faltante <= 0) break;
    enteros.set(id, enteros.get(id) + 1);
    faltante -= 1;
  }
  return enteros;
};

/**
 * Consolida la nota de UN estudiante para UN aspecto del registro, usando
 * solo los instrumentos que alimentan ese aspecto (reglas 10-11) y
 * expresándola en los puntos del aspecto.
 */
export const consolidarNotaAspecto = ({ aspecto, instrumentos = [], resultados = [] }) => {
  const aspectoId = aspecto?.aspectoId || aspecto?.id;
  const delAspecto = instrumentos.filter((ins) => (ins.aspectoRegistroIds || []).includes(aspectoId));
  const consolidado = consolidarNotaEstudiante({
    instrumentos: delAspecto,
    resultados: resultados.filter((r) =>
      delAspecto.some((ins) => String(ins.id || ins.instrumentoId) === String(r.instrumentoId))
    ),
  });
  const puntajeMaximo = Number(aspecto?.puntajeMaximo) || 100;
  return {
    ...consolidado,
    puntajeMaximo,
    valorCalculadoPuntos: consolidado.valorCalculado === null
      ? null
      : Math.round((consolidado.valorCalculado / 100) * puntajeMaximo),
  };
};

/**
 * Regla 12 — Aplica un nuevo cálculo sobre un registro que puede tener
 * ajuste manual. PURO: devuelve el registro resultante; nunca sobreescribe
 * un valorFinal ajustado sin acción del docente.
 */
export const aplicarRecalculoRegistro = (registroPrevio, consolidado, ahora = new Date().toISOString()) => {
  const base = registroPrevio || {};
  const nuevoCalculado = consolidado.valorCalculado;

  if (base.ajusteManual) {
    return {
      ...base,
      valorCalculado: nuevoCalculado,
      esParcial: consolidado.esParcial,
      origenResultados: consolidado.origenResultados,
      desactualizado: base.valorFinal !== nuevoCalculado,
      notificarDocente: base.valorFinal !== nuevoCalculado,
      ultimaActualizacionAutomatica: ahora,
      updatedAt: ahora,
    };
  }

  return {
    ...base,
    valorCalculado: nuevoCalculado,
    valorFinal: nuevoCalculado,
    esParcial: consolidado.esParcial,
    origenResultados: consolidado.origenResultados,
    ajusteManual: false,
    motivoAjuste: base.motivoAjuste || "",
    desactualizado: false,
    notificarDocente: false,
    ultimaActualizacionAutomatica: ahora,
    updatedAt: ahora,
  };
};

/**
 * Regla 12 sobre una CELDA del registro legacy
 * (registrosCalificaciones.notasEstudiantes[est].competencias[ci].periodos[pi]).
 *
 * Una celda se considera ajuste manual del docente cuando tiene valor y no
 * proviene de instrumentos (fuente distinta de "instrumentos") o cuando ya
 * está marcada con ajusteManual. En ese caso NUNCA se pisa `p`: solo se
 * actualiza valorCalculado y se marca desactualizado para notificar.
 */
export const aplicarNotaEnCelda = (celdaPrevia = {}, nuevaNota, meta = {}) => {
  const celda = celdaPrevia || {};
  const tieneValor = celda.p !== "" && celda.p !== null && celda.p !== undefined;
  const esManual = Boolean(celda.ajusteManual) || (tieneValor && celda.fuente !== "instrumentos");

  if (esManual && Number(celda.p) !== Number(nuevaNota)) {
    return {
      ...celda,
      ajusteManual: true,
      valorCalculado: nuevaNota,
      desactualizado: true,
      ...meta,
    };
  }

  return {
    ...celda,
    p: nuevaNota,
    fuente: "instrumentos",
    ajusteManual: false,
    valorCalculado: nuevaNota,
    desactualizado: false,
    ...meta,
  };
};

// ─── Fase 6 — Clase de hoy / próxima clase (Modo Aula) ───────────────────────

/**
 * Devuelve la clase del día desde la capa curricular. Si hoy no hay clase
 * planificada, devuelve la PRÓXIMA clase pendiente (nunca "pantalla vacía").
 *
 * @returns {{ clase, esHoy: boolean, motivo: "hoy"|"proxima"|"sin-fechas"|null }}
 */
export const obtenerClaseDeHoy = (capa, fechaISO = new Date().toISOString().slice(0, 10)) => {
  const clases = capa?.clases || [];
  if (!clases.length) return { clase: null, esHoy: false, motivo: null };

  const conFecha = clases.filter((c) => c.fechaSugerida);
  const deHoy = conFecha.find((c) => c.fechaSugerida === fechaISO);
  if (deHoy) return { clase: deHoy, esHoy: true, motivo: "hoy" };

  const proxima = conFecha
    .filter((c) => c.fechaSugerida > fechaISO)
    .sort((a, b) => a.fechaSugerida.localeCompare(b.fechaSugerida))[0];
  if (proxima) return { clase: proxima, esHoy: false, motivo: "proxima" };

  // Sin fechas: primera clase; todas pasadas: última clase dictada
  const ultima = conFecha[conFecha.length - 1] || clases[0];
  return { clase: ultima, esHoy: false, motivo: conFecha.length ? "ultima" : "sin-fechas" };
};

// ─── Fase 9 — Cierre del ciclo: logro por indicador ──────────────────────────
// Los resultados de la Fase 4 se escribían y nadie los leía: el sistema sabía
// qué se ENSEÑÓ pero no qué se APRENDIÓ. Esta fase los agrega en logro por
// indicador oficial para el mapa de avance del curso y para que la SIGUIENTE
// unidad reciba los indicadores débiles (marcado REFORZAR, junto al tachado).

const _normCodigoAvance = (c) => String(c || "").trim().toUpperCase().replace(/\s+/g, "");

/**
 * Agrega resultados de instrumento (Fase 4) en logro por indicador. PURO.
 * Reglas de conteo (las de la Fase 4):
 *   - "evaluado"   → cuenta con su porcentaje
 *   - "no_entrego" → cuenta como 0 (porcentaje ya viene en 0)
 *   - "pendiente"  → NO cuenta (porcentaje null)
 * Cada resultado aporta su porcentaje a TODOS los indicadorIds del instrumento.
 *
 * @param {Array} resultados  Docs de instrumentoResultados
 * @returns {Array<{codigo, evaluaciones, estudiantes, promedio, nivel, estudiantesApoyo}>}
 *          ordenado por código; estudiantesApoyo = estudiantes cuyo promedio
 *          personal en ese indicador queda bajo 70 (corte "En proceso").
 */
export const agregarResultadosPorIndicador = (resultados = []) => {
  const mapa = new Map();
  for (const r of resultados) {
    const pct = Number(r?.porcentaje);
    if (r?.porcentaje === null || r?.porcentaje === undefined || !Number.isFinite(pct)) continue;
    for (const cod of (r.indicadorIds || [])) {
      const codigo = _normCodigoAvance(cod);
      if (!codigo) continue;
      const acc = mapa.get(codigo) || {
        codigo, evaluaciones: 0, sumaPorcentaje: 0, porEstudiante: new Map(),
      };
      acc.evaluaciones += 1;
      acc.sumaPorcentaje += pct;
      const estId = String(r.estudianteId || "");
      if (estId) {
        const est = acc.porEstudiante.get(estId) || { suma: 0, n: 0 };
        est.suma += pct;
        est.n += 1;
        acc.porEstudiante.set(estId, est);
      }
      mapa.set(codigo, acc);
    }
  }
  return [...mapa.values()]
    .map((acc) => {
      const promedio = Math.round(acc.sumaPorcentaje / acc.evaluaciones);
      const estudiantesApoyo = [...acc.porEstudiante.values()]
        .filter((e) => e.n > 0 && (e.suma / e.n) < 70).length;
      return {
        codigo: acc.codigo,
        evaluaciones: acc.evaluaciones,
        estudiantes: acc.porEstudiante.size,
        promedio,
        nivel: nivelLogroDesdePorcentaje(promedio),
        estudiantesApoyo,
      };
    })
    .sort((a, b) => a.codigo.localeCompare(b.codigo, "es", { numeric: true }));
};

/**
 * Indicadores DÉBILES del avance: promedio bajo el umbral con evidencia
 * suficiente. PURO. Son los que la siguiente unidad marca como (REFORZAR).
 */
export const indicadoresDebilesDeAvance = (avance = [], { umbral = 70, minEvaluaciones = 1 } = {}) =>
  (avance || [])
    .filter((i) => i && i.evaluaciones >= minEvaluaciones && i.promedio < umbral)
    .map((i) => i.codigo);
