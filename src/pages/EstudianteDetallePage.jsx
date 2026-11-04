import { useState, useEffect, useRef, useMemo } from "react";
import { AIService } from "../services/ai/AIService.js";
import { conFundamento } from "../services/fundamentoDoctrinalService.js";
import { EventTracker } from "../services/ai/learning/EventTracker.js";
import { LEARNING_EVENTS, AGENT_IDS } from "../services/ai/knowledge/KnowledgeTypes.js";
import { guardarEstadoDetalleEstudiante, obtenerEstadoDetalleEstudiante, obtenerInstrumentosFirestore, obtenerRegistroAspectos, obtenerRegistroNotas, obtenerRegistroCalificaciones } from "../firebase.js";
import { obtenerCompetenciasMallaCurso } from "../services/mallaCursoService.js";
import { obtenerEvidenciasPorEstudiante } from "../services/evidenciasService.js";
import { obtenerAvanceEstudiante, obtenerResultadosEstudiante } from "../services/avanceCurricularService.js";
import { obtenerActividadesPorCurso } from "../services/actividadesService.js";
import { obtenerAsistenciaCurso } from "../services/asistenciaService.js";
import { construirLineaDeTiempo, senalesNecesitaApoyo } from "../services/seguimientoEstudiante.js";
import { construirInformeFamilia, textoInformeFamilia, textoWhatsApp, htmlDocumento } from "../services/informesSeguimiento.js";
import { evidenciasVigentes, fechaLocalISO } from "../services/hiloPedagogico.js";
import { actividadesDeEstudiante, ETIQUETAS_ENTREGA } from "../services/actividadesPlan.js";
import { RegistroAnecdoticoPanel } from "../components/RegistroAnecdotico.jsx";
import { esRegistroAnecdotico } from "../utils/registroAnecdotico.js";
import { avisoCedula, depurarDatosLegado, formatearCedula } from "../utils/idEstudiante.js";

const EVALUACIONES_BASE_DETALLE = [];

// F6: la pestaña «Informe IA» pasa a ser el informe a la familia (nombre viejo aceptado)
const TAB_INFORME = "Informe a la familia";
const tabValida = (tab) => (tab === "Informe IA" ? TAB_INFORME : tab);

const PLAN_APOYO_BASE_DETALLE = [];

// Cédula opcional (acta de nacimiento): nunca bloquea; solo avisa si no tiene 11 dígitos.
function CedulaEditable({ estudiante, onGuardar }) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(estudiante?.cedula || "");
  const [error, setError] = useState("");
  const guardar = () => {
    try {
      onGuardar(estudiante, formatearCedula(valor));
      setEditando(false);
      setError("");
    } catch (err) {
      setError(err?.message || "No se pudo guardar la cédula.");
    }
  };
  if (!editando) {
    return (
      <>
        Cédula: {estudiante?.cedula || "Pendiente de completar"}{" "}
        {onGuardar && <button type="button" onClick={() => { setValor(estudiante?.cedula || ""); setEditando(true); }}>Editar</button>}
        {error && <small role="alert" style={{ color: "#b91c1c", display: "block" }}>{error}</small>}
      </>
    );
  }
  return (
    <>
      Cédula:{" "}
      <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="numeric" placeholder="000-0000000-0" aria-label="Cédula del estudiante" />{" "}
      <button type="button" onClick={guardar}>Guardar</button>{" "}
      <button type="button" onClick={() => { setEditando(false); setError(""); }}>Cancelar</button>
      {avisoCedula(valor) && <small style={{ color: "#92400e", display: "block" }}>{avisoCedula(valor)}</small>}
      {error && <small role="alert" style={{ color: "#b91c1c", display: "block" }}>{error}</small>}
    </>
  );
}

function EstudianteDetallePage({ estudiante, onVolver = () => {}, initialTab = "Resumen", onTabChange = () => {}, onGuardarCedula = null }) {
  const tabs = ["Resumen", "Rendimiento", "Evaluaciones", "Actividades", "Evidencias", "Registro anecdótico", "Asistencia", "Intervenciones", TAB_INFORME];
  const [tabActiva, setTabActiva] = useState(tabValida(initialTab));
  const [periodoActual, setPeriodoActual] = useState(2);
  const [estadoPlan, setEstadoPlan] = useState("Pendiente de iniciar");
  const [ultimoEnvio, setUltimoEnvio] = useState(null);
  const [mensajeAccion, setMensajeAccion] = useState("");
  const [storageListo, setStorageListo] = useState(false);
  const [modalEvaluacionAbierto, setModalEvaluacionAbierto] = useState(false);
  const [formEvaluacion, setFormEvaluacion] = useState({
    actividad: "",
    area: "Matematica",
    calificacion: "",
    estado: "En progreso",
    observacion: "",
  });
  const [expediente, setExpediente] = useState(null);

  // Banco de Evidencias completo (hilo pedagógico) + filtros
  const [bancoEvidencias, setBancoEvidencias] = useState(null); // null = aún no cargado
  const [filtroEvPeriodo, setFiltroEvPeriodo] = useState("Todos");
  const [filtroEvTipo, setFiltroEvTipo] = useState("Todos");
  const [filtroEvIndicador, setFiltroEvIndicador] = useState("Todos");

  // Cargar expediente real desde Firestore si existe
  useEffect(() => {
    const cursoId = estudiante?.cursoId;
    const estId   = estudiante?.id;
    if (!cursoId || !estId) return;
    import("../services/expedienteEstudianteService.js")
      .then(({ obtenerExpedienteEstudiante }) => obtenerExpedienteEstudiante(cursoId, estId))
      .then((data) => { if (data) setExpediente(data); })
      .catch(() => {});
  }, [estudiante?.cursoId, estudiante?.id]);

  // F3 — actividades del plan con la entrega de este estudiante (lazy)
  const [actividadesEst, setActividadesEst] = useState(null); // null = aún no cargado
  const [errorActividades, setErrorActividades] = useState("");
  useEffect(() => {
    if (tabActiva !== "Actividades" || actividadesEst !== null) return;
    if (!estudiante?.id || !estudiante?.cursoId) { setActividadesEst([]); return; }
    obtenerActividadesPorCurso(estudiante.cursoId)
      .then((lista) => setActividadesEst(actividadesDeEstudiante(lista, [estudiante.id, ...(estudiante.idsLegado || [])])))
      .catch((e) => { setErrorActividades(`No se pudieron leer las actividades: ${e.message}`); setActividadesEst([]); });
  }, [tabActiva, actividadesEst, estudiante?.id, estudiante?.cursoId]);

  // Cargar el banco de evidencias al abrir la pestaña (lazy)
  useEffect(() => {
    if (tabActiva !== "Evidencias" || bancoEvidencias !== null) return;
    const estId = estudiante?.id;
    if (!estId) { setBancoEvidencias([]); return; }
    obtenerEvidenciasPorEstudiante(estId, { cursoId: estudiante?.cursoId || "", idsLegado: estudiante?.idsLegado || [] })
      // El registro anecdótico se muestra aparte, en su propia pestaña
      .then((datos) => setBancoEvidencias(depurarDatosLegado({ evidencias: datos }, estudiante?.legadoAmbiguo).evidencias.filter((e) => !esRegistroAnecdotico(e))))
      .catch(() => setBancoEvidencias([]));
  }, [tabActiva, bancoEvidencias, estudiante?.id, estudiante?.cursoId]);

  // F5 — línea de tiempo + «Necesita apoyo»: se leen al abrir la ficha (la
  // alerta va arriba). Cada fuente que falla queda en `errores`, nunca callada.
  const [seguimiento, setSeguimiento] = useState(null); // null = cargando
  // Clave estable: un array nuevo en cada render del padre no relee Firestore
  const idsLegadoClave = (estudiante?.idsLegado || []).join("|");
  const legadoAmbiguo = estudiante?.legadoAmbiguo || null;
  const legadoAmbiguoClave = JSON.stringify(legadoAmbiguo);
  useEffect(() => {
    const estId = estudiante?.id;
    const cursoId = estudiante?.cursoId;
    if (!estId || !cursoId) { setSeguimiento({ datos: {}, errores: { curso: true } }); return; }
    let vigente = true;
    setSeguimiento(null);
    const idsLegado = idsLegadoClave ? idsLegadoClave.split("|") : [];
    const fuentes = {
      actividades: obtenerActividadesPorCurso(cursoId),
      resultados: obtenerResultadosEstudiante(estId, { cursoId, idsLegado }),
      evidencias: obtenerEvidenciasPorEstudiante(estId, { cursoId, idsLegado }),
      asistencia: obtenerAsistenciaCurso(cursoId, { estricto: true }),
    };
    Promise.allSettled(Object.values(fuentes)).then((res) => {
      if (!vigente) return;
      const datos = {}, errores = {};
      Object.keys(fuentes).forEach((clave, i) => {
        if (res[i].status === "fulfilled") datos[clave] = res[i].value || [];
        else { datos[clave] = []; errores[clave] = res[i].reason?.message || "error de lectura"; }
      });
      // F7: «est-1» de Ana no es de Carlos (se decide por el nombre guardado)
      const propios = depurarDatosLegado(datos, legadoAmbiguo);
      // F7: sin evidencias retiradas, de notas quitadas ni copias del puente legacy
      setSeguimiento({ datos: { ...propios, evidencias: evidenciasVigentes(propios.evidencias, errores.resultados ? null : propios.resultados) }, errores });
    });
    return () => { vigente = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- legadoAmbiguo va por su clave estable
  }, [estudiante?.id, estudiante?.cursoId, idsLegadoClave, legadoAmbiguoClave]);

  const { lineaDeTiempo, alertaApoyo } = useMemo(() => {
    if (!seguimiento) return { lineaDeTiempo: null, alertaApoyo: null };
    const base = { ...seguimiento.datos, ids: [estudiante?.id, ...idsLegadoClave.split("|")], hoy: fechaLocalISO() };
    return {
      lineaDeTiempo: construirLineaDeTiempo(base),
      alertaApoyo: seguimiento.errores.curso
        ? { necesitaApoyo: false, motivos: [], sinComprobar: ["entregas", "indicadores", "asistencia"] }
        : senalesNecesitaApoyo({ ...base, errores: seguimiento.errores }),
    };
  }, [seguimiento, estudiante?.id, idsLegadoClave]);

  // Fase 9.4 — avance curricular del estudiante (sus resultados por indicador),
  // lazy al abrir Rendimiento. null = cargando; {porIndicador: []} = sin datos.
  const [avanceEstudiante, setAvanceEstudiante] = useState(null);
  useEffect(() => {
    if (tabActiva !== "Rendimiento" || avanceEstudiante !== null) return;
    obtenerAvanceEstudiante(estudiante?.id, { cursoId: estudiante?.cursoId || "" })
      .then((av) => setAvanceEstudiante(av))
      .catch(() => setAvanceEstudiante({ porIndicador: [], necesitaApoyo: [], totalResultados: 0 }));
  }, [tabActiva, avanceEstudiante, estudiante?.id, estudiante?.cursoId]);

  const nombre = estudiante?.nombre || "—";
  const estado = estudiante?.estado?.label || "Sin estado";
  const curso = estudiante?.cursoNombre || "—";
  const edad = estudiante?.edad || null;
  const fechaNacimiento = estudiante?.fechaNacimiento || null;
  const tutor = estudiante?.tutor || "—";
  const telefono = estudiante?.telefono || "—";
  const promedio = estudiante?.promedio ?? null;
  const sinNotas = promedio === null || promedio === undefined;
  const promedioNum = sinNotas ? 0 : promedio;
  const asistencia = estudiante?.asistencia ?? null;
  const sinAsistencia = asistencia === null || asistencia === undefined;
  const asistenciaNum = sinAsistencia ? 0 : asistencia;
  const faltas = sinAsistencia ? 0 : Math.max(0, 100 - asistenciaNum);

  const evolucion = sinNotas ? [] : [
    { mes: "Ene", valor: Math.max(40, Math.min(100, promedioNum - 8)) },
    { mes: "Feb", valor: Math.max(40, Math.min(100, promedioNum - 5)) },
    { mes: "Mar", valor: Math.max(40, Math.min(100, promedioNum - 10)) },
    { mes: "Abr", valor: Math.max(40, Math.min(100, promedioNum - 4)) },
    { mes: "May", valor: Math.max(40, Math.min(100, promedioNum - 2)) },
    { mes: "Jun", valor: promedioNum },
  ];

  const areas = sinNotas ? [] : [
    { area: "Matematica", valor: Math.max(40, Math.min(100, promedioNum - 8)) },
    { area: "Lengua",     valor: Math.max(40, Math.min(100, promedioNum + 7)) },
    { area: "Ciencias",   valor: Math.max(40, Math.min(100, promedioNum + 10)) },
    { area: "Ingles",     valor: Math.max(40, Math.min(100, promedioNum - 4)) },
  ];

  const periodosEstudiante = [
    { numero: 1, nombre: "Período 1", rango: "Ene-Mar", promedio: sinNotas ? null : Math.max(45, promedioNum - 8), competencias: sinNotas ? null : 12, indicadores: sinNotas ? null : 18 },
    { numero: 2, nombre: "Período 2", rango: "Abr-Jun", promedio: sinNotas ? null : Math.max(50, promedioNum - 4), competencias: sinNotas ? null : 16, indicadores: sinNotas ? null : 32 },
    { numero: 3, nombre: "Período 3", rango: "Jul-Sep", promedio: sinNotas ? null : promedioNum, competencias: sinNotas ? null : 18, indicadores: sinNotas ? null : 42 },
    { numero: 4, nombre: "Período 4", rango: "Oct-Dic", promedio: null, competencias: null, indicadores: null },
  ];
  const periodoSeleccionado = periodosEstudiante[periodoActual] || periodosEstudiante[2];

  // F6: antes había aquí un texto fijo inventado («fortalezas en Ciencias…»);
  // si quedó guardado en el estado de la ficha, se descarta al cargar.
  const informeIaBase = "";
  const TEXTO_INVENTADO_VIEJO = "El estudiante presenta una combinacion de fortalezas en Ciencias";
  const informeGuardado = (t) => (typeof t === "string" && !t.startsWith(TEXTO_INVENTADO_VIEJO) ? t : informeIaBase);
  // Usar evaluaciones del expediente Firestore si existen, si no el estado local vacío
  const evaluacionesExpediente = expediente?.evaluaciones ?? [];
  const evidenciasExpediente = useMemo(() => expediente?.evidencias ?? [], [expediente?.evidencias]);
  const indicadoresEvidencias = useMemo(() => {
    const conteo = new Map();
    evidenciasExpediente.forEach((evidencia) => {
      (evidencia.indicadores || evidencia.contexto?.indicadores || []).forEach((indicador) => {
        conteo.set(indicador, (conteo.get(indicador) || 0) + 1);
      });
    });
    return Array.from(conteo.entries()).sort((a, b) => b[1] - a[1]);
  }, [evidenciasExpediente]);
  const [evaluacionesLocales, setEvaluacionesLocales] = useState(EVALUACIONES_BASE_DETALLE);
  const evaluaciones = evaluacionesExpediente.length > 0 ? evaluacionesExpediente : evaluacionesLocales;
  const setEvaluaciones = setEvaluacionesLocales;
  const [planApoyo, setPlanApoyo] = useState(PLAN_APOYO_BASE_DETALLE);
  const [informeIa, setInformeIa] = useState(informeIaBase);
  const [informeIaGenerando, setInformeIaGenerando] = useState(false);
  const [informeIaAprobado, setInformeIaAprobado] = useState(null); // fecha de aprobación del docente
  const informeIaRef = useRef(null);

  const totalCirc = 276;
  const pctAsis = asistenciaNum;
  const pctFaltas = 100 - asistenciaNum;
  const dashAsis = (totalCirc * pctAsis) / 100;
  const dashFaltas = (totalCirc * pctFaltas) / 100;
  const tienePromedioPeriodo = periodoSeleccionado.promedio !== null;
  const pctPeriodo = tienePromedioPeriodo ? periodoSeleccionado.promedio : 0;
  const dashPeriodo = (totalCirc * pctPeriodo) / 100;
  const storageKey = useMemo(() => {
    const identificador = `${nombre}-${curso}`.replace(/\s+/g, "-").toLowerCase();
    return `docenteos.detalle-estudiante.${identificador}`;
  }, [nombre, curso]);
  const detalleId = useMemo(() => storageKey.replace("docenteos.detalle-estudiante.", ""), [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setStorageListo(false);
    const cargar = async () => {
      try {
        const remoto = await obtenerEstadoDetalleEstudiante(detalleId);
        const remotoData = remoto?.data && typeof remoto.data === "object" ? remoto.data : null;
        if (remotoData) {
          setTabActiva(tabValida(remotoData.tabActiva) || "Resumen");
          setEstadoPlan(remotoData.estadoPlan || "Pendiente de iniciar");
          setUltimoEnvio(remotoData.ultimoEnvio || null);
          setMensajeAccion(remotoData.mensajeAccion || "");
          setEvaluaciones(Array.isArray(remotoData.evaluaciones) ? remotoData.evaluaciones : EVALUACIONES_BASE_DETALLE);
          setPlanApoyo(Array.isArray(remotoData.planApoyo) ? remotoData.planApoyo : PLAN_APOYO_BASE_DETALLE);
          setInformeIa(informeGuardado(remotoData.informeIa));
          setInformeIaAprobado(remotoData.informeIaAprobado || null);
          setStorageListo(true);
          return;
        }

        const raw = window.localStorage.getItem(storageKey);
        if (!raw) {
          setTabActiva("Resumen");
          setEstadoPlan("Pendiente de iniciar");
          setUltimoEnvio(null);
          setMensajeAccion("");
          setEvaluaciones(EVALUACIONES_BASE_DETALLE);
          setPlanApoyo(PLAN_APOYO_BASE_DETALLE);
          setInformeIa(informeIaBase);
          setInformeIaAprobado(null);
          setStorageListo(true);
          return;
        }
        const parsed = JSON.parse(raw);
        setTabActiva(tabValida(parsed.tabActiva) || "Resumen");
        setEstadoPlan(parsed.estadoPlan || "Pendiente de iniciar");
        setUltimoEnvio(parsed.ultimoEnvio || null);
        setMensajeAccion(parsed.mensajeAccion || "");
        setEvaluaciones(Array.isArray(parsed.evaluaciones) ? parsed.evaluaciones : EVALUACIONES_BASE_DETALLE);
        setPlanApoyo(Array.isArray(parsed.planApoyo) ? parsed.planApoyo : PLAN_APOYO_BASE_DETALLE);
        setInformeIa(informeGuardado(parsed.informeIa));
        setInformeIaAprobado(parsed.informeIaAprobado || null);
        setStorageListo(true);
      } catch {
        setTabActiva("Resumen");
        setEstadoPlan("Pendiente de iniciar");
        setUltimoEnvio(null);
        setMensajeAccion("");
        setEvaluaciones(EVALUACIONES_BASE_DETALLE);
        setPlanApoyo(PLAN_APOYO_BASE_DETALLE);
        setInformeIa(informeIaBase);
        setInformeIaAprobado(null);
        setStorageListo(true);
      }
    };

    cargar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, detalleId]);

  useEffect(() => {
    setTabActiva(tabValida(initialTab) || "Resumen");
  }, [initialTab]);

  useEffect(() => {
    onTabChange(tabActiva);
  }, [tabActiva, onTabChange]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!storageListo) return;
    const payload = {
      tabActiva,
      estadoPlan,
      ultimoEnvio,
      mensajeAccion,
      evaluaciones,
      planApoyo,
      informeIa,
      informeIaAprobado,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
    guardarEstadoDetalleEstudiante({ estudianteId: detalleId, payload }).catch(() => {
      // Fallback local ya aplicado.
    });
  }, [storageKey, detalleId, storageListo, tabActiva, estadoPlan, ultimoEnvio, mensajeAccion, evaluaciones, planApoyo, informeIa, informeIaAprobado]);

  // F6 — Informe a la familia: plantilla con los datos registrados (sin
  // créditos). Lee las dos notas del Registro con los mismos servicios que la
  // página Registro; el resto (actividades, resultados, asistencia) ya lo leyó
  // F5. Una fuente que falla sale como «sin comprobar».
  const [registroInforme, setRegistroInforme] = useState(null); // null = sin cargar
  const [anotacionesElegidas, setAnotacionesElegidas] = useState([]); // ids
  useEffect(() => {
    if (tabActiva !== TAB_INFORME || registroInforme !== null) return;
    const cursoId = estudiante?.cursoId;
    if (!cursoId) { setRegistroInforme({ datos: {}, errores: { registro: "sin curso", calificaciones: "sin curso" } }); return; }
    Promise.allSettled([
      Promise.all([obtenerRegistroAspectos(cursoId), obtenerRegistroNotas(cursoId)]).then(([a, n]) => {
        if (a.success === false || n.success === false) throw new Error("No se pudo leer el Registro por indicador");
        return { aspectos: a.data || [], notas: n.data || [] };
      }),
      obtenerRegistroCalificaciones(cursoId).then((r) => r?.data || null),
      // F7: malla del curso + instrumentos para calcular la C.F. desde los indicadores
      obtenerCompetenciasMallaCurso({ nombre: estudiante?.cursoNombre, grado: estudiante?.grado, nivel: estudiante?.nivel, area: estudiante?.area }),
      obtenerInstrumentosFirestore().then((r) => {
        if (r?.success === false) throw new Error("No se pudieron leer los instrumentos");
        return (r?.data || []).filter((ins) => String(ins.cursoId || ins.vinculacion?.cursoId || "") === String(cursoId));
      }),
    ]).then(([reg, cal, malla, ins]) => {
      setRegistroInforme({
        datos: {
          ...(reg.status === "fulfilled" ? reg.value : {}),
          registroCalificaciones: cal.status === "fulfilled" ? cal.value : null,
          competencias: malla.status === "fulfilled" ? malla.value.competencias : [],
          instrumentos: ins.status === "fulfilled" ? ins.value : [],
          nivel: estudiante?.nivel || "Secundaria",
        },
        errores: {
          ...(reg.status === "rejected" ? { registro: reg.reason?.message || "error de lectura" } : {}),
          ...(cal.status === "rejected" ? { calificaciones: cal.reason?.message || "error de lectura" } : {}),
          ...(ins.status === "rejected" ? { instrumentos: ins.reason?.message || "error de lectura" } : {}),
          ...(malla.status === "rejected" ? { malla: malla.reason?.message || "error de lectura" } : {}),
        },
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- el resto del estudiante cambia junto con cursoId
  }, [tabActiva, registroInforme, estudiante?.cursoId]);

  const anotacionesAnecdoticas = useMemo(
    () => (seguimiento?.datos?.evidencias || []).filter(esRegistroAnecdotico),
    [seguimiento],
  );

  const informeFamilia = useMemo(() => {
    if (!seguimiento || !registroInforme) return null;
    return construirInformeFamilia({
      estudiante: { id: estudiante?.id, nombre },
      cursoNombre: curso === "—" ? "" : curso,
      ...seguimiento.datos,
      ...registroInforme.datos,
      anotacionesElegidas: anotacionesAnecdoticas.filter((a) => anotacionesElegidas.includes(a.id || a.evidenciaId)),
      ids: [estudiante?.id, ...idsLegadoClave.split("|")],
      hoy: fechaLocalISO(),
      errores: { ...seguimiento.errores, ...registroInforme.errores },
    });
  }, [seguimiento, registroInforme, anotacionesAnecdoticas, anotacionesElegidas, estudiante?.id, nombre, curso, idsLegadoClave]);
  const textoPlantilla = informeFamilia ? textoInformeFamilia(informeFamilia) : "";

  const imprimirInforme = () => {
    // El PDF lleva la redacción con IA solo si el docente la aprobó
    const texto = informeIa && informeIaAprobado ? informeIa : textoPlantilla;
    const win = window.open("", "_blank");
    if (!win) { setMensajeAccion("Permite ventanas emergentes para imprimir el informe."); return; }
    win.document.write(htmlDocumento(`Informe para la familia · ${nombre}`, texto));
    win.document.close();
  };

  const copiarWhatsApp = async () => {
    if (!informeFamilia) return;
    try {
      await navigator.clipboard.writeText(textoWhatsApp(informeFamilia));
      setMensajeAccion("Texto copiado. Pégalo en WhatsApp y decide a quién enviarlo.");
    } catch {
      setMensajeAccion("No se pudo copiar al portapapeles. Selecciona el texto del informe y cópialo a mano.");
    }
  };

  // «Redactar con IA»: gasta créditos SOLO al pulsarlo y usa SOLO la plantilla
  // (datos registrados). El texto queda como borrador hasta que el docente lo aprueba.
  const manejarGenerarInformeIA = async () => {
    if (!textoPlantilla) return;
    setInformeIa("");
    setInformeIaAprobado(null);
    setInformeIaGenerando(true);
    setTabActiva(TAB_INFORME);

    const system = await conFundamento("Eres un docente dominicano que escribe a la familia de un estudiante. Usa SOLO los datos del informe que se te da: no inventes logros, notas, fechas ni hechos. Lenguaje claro, cálido y breve, en español. Mantén los avisos que traiga el informe (notas que no coinciden, datos sin comprobar). Usa títulos con «## » y viñetas con «- ».", estudiante?.nivel || "");
    AIService.generate({
      module:    "registro-apoyo",
      system,
      prompt:    `Redacta este informe para la familia, sin añadir datos:\n\n${textoPlantilla}`,
      maxTokens: 1200,
      onChunk: (chunk) => {
        setInformeIa((prev) => prev + chunk);
        setTimeout(() => informeIaRef.current?.scrollTo({ top: informeIaRef.current.scrollHeight, behavior: "smooth" }), 50);
      },
      onFinish: () => {
        setInformeIaGenerando(false);
        setMensajeAccion("Borrador redactado con IA: revísalo y apruébalo antes de usarlo.");
        EventTracker.track(LEARNING_EVENTS.INFORME_ESTUDIANTE_GENERADO, {
          agentId: AGENT_IDS.GENERADOR_REPORTES,
          grado:   curso || "",
        });
      },
      onError: (err) => {
        setInformeIa("");
        setMensajeAccion(`Error al redactar con IA: ${err}`);
        setInformeIaGenerando(false);
      },
    });
  };

  const manejarCrearPlanApoyo = () => {
    setEstadoPlan("Activo");
    setPlanApoyo((prev) => {
      if (prev.some((p) => p.includes("Sesion de tutoria personalizada"))) return prev;
      return [...prev, "Sesion de tutoria personalizada los viernes."];
    });
    setTabActiva("Intervenciones");
    setMensajeAccion("Plan de apoyo activado con nueva accion de tutoria.");
  };

  const abrirModalRegistroEvaluacion = () => {
    setFormEvaluacion({
      actividad: "",
      area: "Matematica",
      calificacion: `${Math.max(50, Math.min(100, promedio + 4))}`,
      estado: "En progreso",
      observacion: "",
    });
    setModalEvaluacionAbierto(true);
  };

  const cerrarModalRegistroEvaluacion = () => {
    setModalEvaluacionAbierto(false);
  };

  const manejarRegistrarEvaluacion = (ev) => {
    ev.preventDefault();
    const actividad = formEvaluacion.actividad.trim();
    const nota = Number(formEvaluacion.calificacion);
    if (!actividad) {
      setMensajeAccion("Completa el nombre de la actividad para registrar la evaluacion.");
      return;
    }
    if (Number.isNaN(nota) || nota < 0 || nota > 100) {
      setMensajeAccion("La calificacion debe estar entre 0 y 100.");
      return;
    }
    const nueva = {
      fecha: new Date().toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" }),
      actividad,
      area: formEvaluacion.area,
      calificacion: `${Math.round(nota)}%`,
      estado: formEvaluacion.estado,
      observacion: formEvaluacion.observacion.trim() || "Registro manual desde dashboard",
    };
    setEvaluaciones((prev) => [nueva, ...prev].slice(0, 6));
    setTabActiva("Evaluaciones");
    setMensajeAccion("Nueva evaluacion registrada correctamente.");
    setModalEvaluacionAbierto(false);
  };

  const manejarEnviarReporte = () => {
    const envio = new Date().toLocaleString("es-DO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    setUltimoEnvio(envio);
    // DocenteOS no envía nada (decisión 7): solo anota que el docente lo entregó
    setMensajeAccion(`Informe marcado como entregado a la familia (${tutor}) el ${envio}.`);
  };

  const contenidoTab = {
    "Resumen": (
      <>
      <div className="detalle-tab-lista" style={{ marginBottom: 16 }}>
        <h4>Línea de tiempo</h4>
        {lineaDeTiempo === null ? (
          <p className="detalle-sin-datos">Cargando seguimiento…</p>
        ) : (
          <>
            {seguimiento.errores.curso && <p role="alert" style={{ color: "#b91c1c", fontWeight: 700 }}>⚠️ El estudiante no tiene curso: no se puede leer su seguimiento.</p>}
            {Object.entries(seguimiento.errores).filter(([k]) => k !== "curso").map(([k, msg]) => (
              <p key={k} role="alert" style={{ color: "#b91c1c", fontWeight: 700 }}>⚠️ No se pudo leer {k}: {msg}</p>
            ))}
            {lineaDeTiempo.length === 0
              ? <p className="detalle-sin-datos">Sin entregas, notas, evidencias, ausencias ni anotaciones todavía.</p>
              : lineaDeTiempo.map((e) => (
                  <p key={e.id}>
                    {{ actividad: "📝", evidencia: "📎", asistencia: "📅", anecdotico: "🗒️" }[e.tipo]}{" "}
                    {e.fecha || "sin fecha"} · <strong>{e.titulo}</strong>{e.detalle ? ` · ${e.detalle}` : ""}
                    {e.enlace && <> · <a href={e.enlace} target="_blank" rel="noreferrer">enlace</a></>}
                  </p>
                ))}
          </>
        )}
      </div>
      <div className="detalle-tab-panel-grid">
        <article>
          <h4>Panorama actual</h4>
          <p>
            Rendimiento actual de {promedio}% con una asistencia de {asistencia}%. El foco inmediato es consolidar habitos de estudio
            y reducir inasistencias durante el proximo mes.
          </p>
        </article>
        <article>
          <h4>Objetivo de 30 dias</h4>
          <p>Incrementar el promedio a {Math.min(100, promedio + 6)}% y mantener asistencia por encima de 92%.</p>
        </article>
      </div>
      </>
    ),
    "Rendimiento": (() => {
      // Fase 9.4 — avance real por indicador oficial (antes: texto de relleno)
      if (avanceEstudiante === null) {
        return <div className="detalle-tab-lista"><p className="detalle-sin-datos">Cargando avance curricular…</p></div>;
      }
      const { porIndicador, necesitaApoyo } = avanceEstudiante;
      if (!porIndicador.length) {
        return (
          <div className="detalle-tab-lista">
            <p className="detalle-sin-datos">
              Sin evaluaciones de instrumentos registradas para este estudiante.
              Evalúa desde Modo Aula o Instrumentos y su avance por indicador aparecerá aquí.
            </p>
          </div>
        );
      }
      return (
        <div className="detalle-tab-lista">
          {necesitaApoyo.length > 0 && (
            <p style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px" }}>
              <strong>⚠️ Necesita apoyo en:</strong>{" "}
              {necesitaApoyo.map((i) => `${i.codigo} (${i.promedio}%)`).join(" · ")}
            </p>
          )}
          {porIndicador.map((ind) => (
            <p key={ind.codigo}>
              {ind.nivel === "Logrado" ? "🟢" : ind.nivel === "En proceso" ? "🟡" : "🔴"}{" "}
              <strong>{ind.codigo}</strong> — {ind.promedio}% · {ind.nivel} · {ind.evaluaciones} evaluación{ind.evaluaciones === 1 ? "" : "es"}
            </p>
          ))}
        </div>
      );
    })(),
    "Evaluaciones": (
      <div className="detalle-tab-lista">
        {evaluaciones.length === 0
          ? <p className="detalle-sin-datos">Sin evaluaciones registradas. Usa el botón "Registrar evaluación" para agregar una.</p>
          : evaluaciones.slice(0, 3).map((ev, idx) => (
              <p key={idx}>{ev.fecha} · {ev.actividad} · {ev.calificacion}</p>
            ))
        }
      </div>
    ),
    "Actividades": (() => {
      if (actividadesEst === null) {
        return <div className="detalle-tab-lista"><p className="detalle-sin-datos">Cargando actividades…</p></div>;
      }
      const pendientes = actividadesEst.filter((a) => a.estado === "pendiente" || a.estado === "no_entrego");
      return (
        <div className="detalle-tab-lista">
          {errorActividades && <p role="alert" style={{ color: "#b91c1c", fontWeight: 700 }}>⚠️ {errorActividades}</p>}
          {actividadesEst.length === 0 ? (
            <p className="detalle-sin-datos">Sin actividades del plan para este estudiante. Se crean en Modo Aula desde el plan maestro de la unidad.</p>
          ) : (
            <>
              <p><strong>{pendientes.length} pendiente{pendientes.length === 1 ? "" : "s"}</strong> de {actividadesEst.length} actividad{actividadesEst.length === 1 ? "" : "es"} (sin entregar o «No entregó»).</p>
              {actividadesEst.map((a) => (
                <p key={a.actividadId} style={a.estado === "pendiente" || a.estado === "no_entrego" ? { fontWeight: 600 } : undefined}>
                  {a.estado === "entrego" ? "🟢" : a.estado === "excusa" ? "🟡" : a.estado === "no_entrego" ? "🔴" : "⚪"}{" "}
                  {a.fecha || "sin fecha"} · Fase {a.faseNumero} · {a.faseNombre} · <strong>{ETIQUETAS_ENTREGA[a.estado]}</strong>
                  {a.enlace && <> · <a href={a.enlace} target="_blank" rel="noreferrer">evidencia</a></>}
                </p>
              ))}
            </>
          )}
        </div>
      );
    })(),
    "Evidencias": (() => {
      // Banco completo del hilo pedagógico; el expediente queda como respaldo
      // F7: sin retiradas, sin la de una nota quitada y sin la copia del puente legacy
      const vigentes = bancoEvidencias?.length ? evidenciasVigentes(bancoEvidencias, seguimiento?.datos?.resultados || null) : null;
      const banco = (bancoEvidencias?.length ? vigentes : evidenciasExpediente) || [];
      const periodos = [...new Set(banco.map((e) => e.periodo || e.periodoId).filter(Boolean))];
      const tipos = [...new Set(banco.map((e) => e.tipo).filter(Boolean))];
      const indicadores = [...new Set(banco.flatMap((e) => e.indicadorIds || e.indicadores || []))].filter(Boolean);
      const filtradas = banco.filter((e) =>
        (filtroEvPeriodo === "Todos" || (e.periodo || e.periodoId) === filtroEvPeriodo) &&
        (filtroEvTipo === "Todos" || e.tipo === filtroEvTipo) &&
        (filtroEvIndicador === "Todos" || (e.indicadorIds || e.indicadores || []).includes(filtroEvIndicador))
      );
      return (
        <div className="detalle-tab-lista">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
            <strong>Banco de evidencias: {filtradas.length}/{banco.length}</strong>
            {bancoEvidencias === null && <small style={{ color: "#94a3b8" }}>Cargando banco…</small>}
            {[
              { valor: filtroEvPeriodo, setValor: setFiltroEvPeriodo, opciones: periodos, etiqueta: "Período" },
              { valor: filtroEvTipo, setValor: setFiltroEvTipo, opciones: tipos, etiqueta: "Tipo" },
              { valor: filtroEvIndicador, setValor: setFiltroEvIndicador, opciones: indicadores, etiqueta: "Indicador" },
            ].map(({ valor, setValor, opciones, etiqueta }) => (
              <select
                key={etiqueta}
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                style={{ fontSize: "0.78rem", padding: "3px 6px", borderRadius: 6, border: "1px solid #e2e8f0" }}
                aria-label={`Filtrar por ${etiqueta}`}
              >
                <option value="Todos">{etiqueta}: Todos</option>
                {opciones.map((op) => (
                  <option key={op} value={op}>{String(op).length > 40 ? `${String(op).slice(0, 38)}…` : op}</option>
                ))}
              </select>
            ))}
          </div>
          {filtradas.length === 0 ? (
            <p className="detalle-sin-datos">Sin evidencias registradas todavía. Al calificar instrumentos, DocenteOS creará evidencias automáticamente.</p>
          ) : (
            filtradas.slice(0, 30).map((evidencia) => (
              <p key={evidencia.id || evidencia.evidenciaId}>
                {new Date(evidencia.fecha || evidencia.creadoEn || "2026-01-01").toLocaleDateString("es-DO")} ·
                {" "}{evidencia.actividad || evidencia.titulo || evidencia.instrumento || "Evidencia"} ·
                {/* La entrega de una actividad no es nota (decisión 3) */}
                {evidencia.tipo === "entrega_actividad"
                  ? ` ${ETIQUETAS_ENTREGA[evidencia.metadata?.estadoEntrega] || "Entrega"}`
                  : <>{" "}{evidencia.calificacion?.obtenida ?? evidencia.calificacionAsociada ?? evidencia.calificacion ?? "—"}/{evidencia.calificacion?.valorMaximo ?? evidencia.puntajeMaximo ?? "—"}</>}
                {evidencia.nivelLogro ? ` · ${evidencia.nivelLogro}` : ""}
                {evidencia.indicadorId ? ` · ${evidencia.indicadorId}` : ""}
                {evidencia.enlace && <> · <a href={evidencia.enlace} target="_blank" rel="noreferrer">abrir enlace</a></>}
              </p>
            ))
          )}
          {indicadoresEvidencias.length > 0 && (
            <div>
              <h4>Indicadores más trabajados</h4>
              {indicadoresEvidencias.slice(0, 5).map(([indicador, total]) => (
                <p key={indicador}>{indicador} · {total} evidencia(s)</p>
              ))}
            </div>
          )}
        </div>
      );
    })(),
    "Registro anecdótico": <RegistroAnecdoticoPanel estudiante={estudiante} />,
    "Asistencia": (
      <div className="detalle-tab-lista">
        {sinAsistencia && !expediente
          ? <p className="detalle-sin-datos">Sin registros de asistencia aún. El registro se lleva desde el módulo Registro.</p>
          : <>
              <p>Asistencia acumulada: {expediente?.asistenciaPct ?? asistenciaNum}%</p>
              {expediente?.timeline?.filter((e) => e.tipo === "asistencia").map((e) => (
                <p key={e.id}>📅 {e.titulo} — {e.subtitulo}</p>
              ))}
              {!expediente && <p>Faltas estimadas: {faltas}%</p>}
            </>
        }
      </div>
    ),
    "Intervenciones": (
      <div className="detalle-tab-lista">
        {planApoyo.length === 0
          ? <p className="detalle-sin-datos">Sin plan de apoyo registrado. Usa "Crear plan de intervención" para agregar uno.</p>
          : planApoyo.map((linea, idx) => (
              <p key={idx}>• {linea}</p>
            ))
        }
      </div>
    ),
    [TAB_INFORME]: (
      <div className="detalle-tab-lista">
        {!informeFamilia ? (
          <p className="detalle-sin-datos">Cargando los datos registrados…</p>
        ) : (
          <>
            <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "0 0 8px" }}>
              Plantilla llenada con los datos registrados (sin créditos). Revísala antes de usarla: DocenteOS no envía nada.
            </p>
            {informeFamilia.sinComprobar.length > 0 && (
              <p role="alert" style={{ color: "#b91c1c", fontWeight: 700 }}>⚠️ Sin comprobar (no se pudo leer): {informeFamilia.sinComprobar.join(", ")}.</p>
            )}
            {anotacionesAnecdoticas.length > 0 && (
              <fieldset style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px", margin: "0 0 10px" }}>
                <legend style={{ fontSize: "0.8rem", fontWeight: 700 }}>Anotaciones del registro anecdótico que se comparten</legend>
                {anotacionesAnecdoticas.map((a) => {
                  const id = a.id || a.evidenciaId;
                  return (
                    <label key={id} style={{ display: "block", fontSize: "0.82rem" }}>
                      <input
                        type="checkbox"
                        checked={anotacionesElegidas.includes(id)}
                        onChange={(e) => setAnotacionesElegidas((prev) => (e.target.checked ? [...prev, id] : prev.filter((x) => x !== id)))}
                      />{" "}
                      {a.fecha}: {a.hecho || a.texto}
                    </label>
                  );
                })}
              </fieldset>
            )}
            {[{ titulo: "Plantilla con los datos", texto: textoPlantilla }, ...(informeIa || informeIaGenerando ? [{ titulo: informeIaAprobado ? `Redacción con IA · aprobada el ${informeIaAprobado}` : "Redacción con IA · BORRADOR sin aprobar", texto: informeIa, ia: true }] : [])].map((bloque) => (
              <div key={bloque.titulo} ref={bloque.ia ? informeIaRef : null} style={{ maxHeight: 420, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>
                <p style={{ fontSize: "0.75rem", fontWeight: 800, color: bloque.ia && !informeIaAprobado ? "#b45309" : "#475569", margin: 0 }}>{bloque.titulo}</p>
                {bloque.texto.split("\n").map((line, i) => {
                  if (line.startsWith("## ")) return <h4 key={i} style={{ color: "#4f46e5", margin: "14px 0 4px", fontSize: "0.92rem", fontWeight: 800, borderBottom: "2px solid #e0e7ff", paddingBottom: 3 }}>{line.slice(3)}</h4>;
                  if (line.startsWith("- ")) return <li key={i} style={{ marginLeft: 14, marginBottom: 2, fontSize: "0.85rem" }}>{line.slice(2)}</li>;
                  if (line.trim() === "") return <br key={i} />;
                  return <p key={i} style={{ margin: "3px 0", fontSize: "0.85rem" }}>{line}</p>;
                })}
                {bloque.ia && informeIaGenerando && <span style={{ color: "#7c3aed", fontWeight: 900, animation: "plan-ia-blink 0.8s step-end infinite" }}>▋</span>}
              </div>
            ))}
            {informeIa && !informeIaGenerando && (
              <textarea
                aria-label="Editar la redacción con IA"
                rows={8}
                value={informeIa}
                onChange={(e) => { setInformeIa(e.target.value); setInformeIaAprobado(null); }}
                style={{ width: "100%", fontSize: "0.85rem", marginBottom: 8 }}
              />
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button type="button" onClick={imprimirInforme}>🖨 Imprimir / PDF{informeIa && informeIaAprobado ? " (redacción aprobada)" : ""}</button>
              <button type="button" onClick={copiarWhatsApp}>📋 Copiar para WhatsApp</button>
              <button type="button" className="secundario" onClick={manejarGenerarInformeIA} disabled={informeIaGenerando}>
                {informeIaGenerando ? "⏳ Redactando…" : "✨ Redactar con IA (gasta créditos)"}
              </button>
              {informeIa && !informeIaGenerando && !informeIaAprobado && (
                <button type="button" onClick={() => setInformeIaAprobado(new Date().toLocaleDateString("es-DO"))}>✅ Aprobar redacción</button>
              )}
              {informeIa && !informeIaGenerando && (
                <button type="button" className="secundario" onClick={() => { setInformeIa(""); setInformeIaAprobado(null); }}>Descartar redacción</button>
              )}
            </div>
          </>
        )}
        {ultimoEnvio && <p style={{ marginTop: 12, fontSize: "0.8rem", color: "#64748b" }}>Entregado a la familia: {ultimoEnvio}</p>}
      </div>
    ),
  };

  return (
    <div className="detalle-estudiante-page">
      <section className="detalle-header-card">
        <button type="button" className="detalle-volver-btn" onClick={onVolver}>
          ← Volver a la lista
        </button>
        <h1>Perfil del Estudiante</h1>
        <p>Seguimiento academico individual</p>
      </section>

      {/* F5 — «Necesita apoyo» (decisión 5): solo avisa, con su motivo */}
      {alertaApoyo && (alertaApoyo.necesitaApoyo || alertaApoyo.sinComprobar.length > 0) && (
        <section role="alert" className="detalle-card" style={{ borderLeft: `4px solid ${alertaApoyo.necesitaApoyo ? "#dc2626" : "#d97706"}`, marginBottom: 16 }}>
          {alertaApoyo.necesitaApoyo && (
            <>
              <h3 style={{ color: "#b91c1c", margin: "0 0 6px" }}>Necesita apoyo</h3>
              {alertaApoyo.motivos.map((m) => <p key={m.senal} style={{ margin: "2px 0" }}>• {m.texto}</p>)}
            </>
          )}
          {alertaApoyo.sinComprobar.length > 0 && (
            <p style={{ color: "#92400e", margin: "6px 0 0" }}>⚠️ Sin comprobar ({alertaApoyo.sinComprobar.join(", ")}): no se pudieron leer los datos.</p>
          )}
        </section>
      )}

      <section className="detalle-main-grid">
        <article className="detalle-card detalle-identidad">
          <div className="detalle-avatar-grande">{(nombre.split(" ")[0][0] || "J") + (nombre.split(" ")[1]?.[0] || "P")}</div>
          <div>
            <h2>{nombre}</h2>
            <span className={"detalle-badge " + (estado.toLowerCase().includes("riesgo") ? "riesgo" : "ok")}>{estado}</span>
            <ul>
              <li>Curso: {curso}</li>
              <li>Edad: {edad} anos</li>
              <li>Fecha de nacimiento: {fechaNacimiento}</li>
              <li><CedulaEditable estudiante={estudiante} onGuardar={onGuardarCedula} /></li>
              <li>Madre / Tutor: {tutor}</li>
              <li>Telefono: {telefono}</li>
            </ul>
          </div>
        </article>

        <article className="detalle-card detalle-card-compacta detalle-card-periodo detalle-kpis">
          <h3>Notas del período</h3>
          <p className="detalle-periodo-chip">{periodoSeleccionado.nombre}</p>
          <div className="detalle-periodo-metricas">
            <div>
              <span>Promedio actual</span>
              <strong>{periodoSeleccionado.promedio !== null ? `${periodoSeleccionado.promedio}%` : "Sin datos"}</strong>
            </div>
            <div>
              <span>Competencias logradas</span>
              <strong>{periodoSeleccionado.competencias !== null ? `${periodoSeleccionado.competencias} / 20` : "Sin datos"}</strong>
            </div>
            <div>
              <span>Indicadores de logros alcanzados</span>
              <strong>{periodoSeleccionado.indicadores !== null ? `${periodoSeleccionado.indicadores} / 50` : "Sin datos"}</strong>
            </div>
          </div>
        </article>

      </section>

      <section className="detalle-chart-grid">
        <article className="detalle-card detalle-chart-principal">
          <div className="detalle-chart-header">
            <h3>Evolucion del promedio</h3>
          </div>
          {sinNotas ? (
            <p className="detalle-sin-datos">Sin calificaciones registradas aún.</p>
          ) : (
            <div className="detalle-line-chart">
              {evolucion.map((p) => (
                <div key={p.mes} className="detalle-line-col">
                  <span style={{ height: `${p.valor}%` }} />
                  <strong>{p.valor}</strong>
                  <small>{p.mes}</small>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="detalle-card detalle-card-compacta detalle-card-periodo detalle-card-periodo-actual">
          <h3>Periodo actual</h3>
          <div className="periodo-navegacion detalle-periodo-navegacion-card">
            <button type="button" onClick={() => setPeriodoActual(Math.max(0, periodoActual - 1))} disabled={periodoActual === 0}>◀</button>
            <span>{periodoSeleccionado.nombre}</span>
            <button type="button" onClick={() => setPeriodoActual(Math.min(3, periodoActual + 1))} disabled={periodoActual === 3}>▶</button>
          </div>
          <div className="detalle-donut-wrap detalle-donut-wrap-compacto detalle-donut-periodo">
            <div className="detalle-donut-centro-wrap">
              <svg viewBox="0 0 120 120" width="132" height="132" aria-hidden="true">
                <circle cx="60" cy="60" r="44" fill="none" stroke="#e2e8f0" strokeWidth="14" />
                <circle cx="60" cy="60" r="44" fill="none" stroke="#2563eb" strokeWidth="14" strokeDasharray={`${dashPeriodo} ${totalCirc}`} strokeDashoffset="0" transform="rotate(-90 60 60)" />
              </svg>
              <div className="detalle-donut-centro-texto">
                <strong>{tienePromedioPeriodo ? `${periodoSeleccionado.promedio}%` : "0%"}</strong>
                <span>Promedio</span>
              </div>
            </div>
            <p>{tienePromedioPeriodo ? "Promedio del período actual" : "Sin evaluaciones registradas"}</p>
          </div>
        </article>

        <article className="detalle-card detalle-card-compacta detalle-card-asistencia">
          <h3>Asistencia vs faltas</h3>
          {sinAsistencia ? (
            <p className="detalle-sin-datos">Sin registros de asistencia aún.</p>
          ) : (
            <div className="detalle-donut-wrap detalle-donut-wrap-compacto">
              <svg viewBox="0 0 120 120" width="132" height="132" aria-hidden="true">
                <circle cx="60" cy="60" r="44" fill="none" stroke="#e2e8f0" strokeWidth="14" />
                <circle cx="60" cy="60" r="44" fill="none" stroke="#2563eb" strokeWidth="14" strokeDasharray={`${dashAsis} ${totalCirc}`} strokeDashoffset="0" transform="rotate(-90 60 60)" />
                <circle cx="60" cy="60" r="44" fill="none" stroke="#ef4444" strokeWidth="14" strokeDasharray={`${dashFaltas} ${totalCirc}`} strokeDashoffset={`-${dashAsis}`} transform="rotate(-90 60 60)" />
              </svg>
              <div>
                <p>Asistencia: {asistenciaNum}%</p>
                <p>Faltas: {faltas}%</p>
              </div>
            </div>
          )}
        </article>

        <article className="detalle-card detalle-card-compacta detalle-card-rendimiento">
          <h3>Rendimiento por area</h3>
          {sinNotas ? (
            <p className="detalle-sin-datos">Sin calificaciones por área aún.</p>
          ) : (
            <div className="detalle-bars">
              {areas.map((a) => (
                <div key={a.area}>
                  <span>{a.area}</span>
                  <div className="detalle-bar-track"><i style={{ width: `${a.valor}%` }} /></div>
                  <strong>{a.valor}%</strong>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="detalle-tabs-card">
        <div className="detalle-tabs">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              className={tabActiva === tab ? "activo" : ""}
              onClick={() => setTabActiva(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="detalle-tab-panel">{contenidoTab[tabActiva]}</div>
      </section>

      <section className="detalle-card">
        <h3>Evaluaciones recientes</h3>
        <div className="detalle-table-wrap">
          <table className="detalle-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Actividad</th>
                <th>Area</th>
                <th>Calificacion</th>
                <th>Estado</th>
                <th>Observacion</th>
              </tr>
            </thead>
            <tbody>
              {evaluaciones.length === 0
                ? <tr><td colSpan={6} style={{ textAlign: "center", color: "#94a3b8", padding: "20px", fontStyle: "italic" }}>Sin evaluaciones registradas aún.</td></tr>
                : evaluaciones.map((ev, idx) => (
                    <tr key={idx}>
                      <td>{ev.fecha}</td>
                      <td>{ev.actividad}</td>
                      <td>{ev.area}</td>
                      <td>{ev.calificacion}</td>
                      <td>{ev.estado}</td>
                      <td>{ev.observacion}</td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </section>

      <section className="detalle-card detalle-ia-alerta">
        <h3>🤖 Alertas DOCENTEOS AI</h3>
        {sinNotas && sinAsistencia && <p className="detalle-sin-datos">Sin calificaciones ni asistencia registradas aún para este estudiante.</p>}
        {!sinNotas && promedioNum < 70 && <p>Promedio actual ({promedioNum}%) está por debajo del mínimo de aprobación. Requiere intervención pedagógica.</p>}
        {!sinAsistencia && asistenciaNum < 85 && <p>Asistencia ({asistenciaNum}%) puede afectar el rendimiento académico. Se recomienda contactar a la familia.</p>}
        {!sinNotas && promedioNum >= 70 && !sinAsistencia && asistenciaNum >= 85 && <p>{nombre} mantiene un desempeño académico dentro del rango esperado.</p>}
        <button
          type="button"
          className="secundario"
          onClick={() => setTabActiva(TAB_INFORME)}
        >
          Ver informe a la familia
        </button>
      </section>

      <section className="detalle-card">
        <h3>Plan de apoyo</h3>
        {planApoyo.length === 0
          ? <p className="detalle-sin-datos">Sin plan de apoyo creado aún.</p>
          : <ul className="detalle-plan-lista">{planApoyo.map((item, idx) => <li key={idx}>{item}</li>)}</ul>
        }
        <p className="detalle-plan-estado">Estado: {estadoPlan}</p>
        <button type="button" onClick={manejarCrearPlanApoyo}>Crear plan de intervencion</button>
      </section>

      {mensajeAccion && <section className="detalle-card detalle-feedback"><p>{mensajeAccion}</p></section>}

      {modalEvaluacionAbierto && (
        <section className="detalle-modal-overlay" role="dialog" aria-modal="true">
          <article className="detalle-modal-card">
            <header>
              <h3>Registrar evaluacion</h3>
              <button type="button" className="detalle-modal-cerrar" onClick={cerrarModalRegistroEvaluacion}>×</button>
            </header>
            <form className="detalle-modal-form" onSubmit={manejarRegistrarEvaluacion}>
              <label>
                Actividad
                <input
                  type="text"
                  value={formEvaluacion.actividad}
                  onChange={(e) => setFormEvaluacion((prev) => ({ ...prev, actividad: e.target.value }))}
                  placeholder="Ej: Prueba de fracciones"
                />
              </label>
              <label>
                Area
                <select
                  value={formEvaluacion.area}
                  onChange={(e) => setFormEvaluacion((prev) => ({ ...prev, area: e.target.value }))}
                >
                  <option>Matematica</option>
                  <option>Lengua</option>
                  <option>Ciencias</option>
                  <option>Ingles</option>
                </select>
              </label>
              <label>
                Calificacion (0-100)
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formEvaluacion.calificacion}
                  onChange={(e) => setFormEvaluacion((prev) => ({ ...prev, calificacion: e.target.value }))}
                />
              </label>
              <label>
                Estado
                <select
                  value={formEvaluacion.estado}
                  onChange={(e) => setFormEvaluacion((prev) => ({ ...prev, estado: e.target.value }))}
                >
                  <option>Excelente</option>
                  <option>Regular</option>
                  <option>En progreso</option>
                  <option>Bajo</option>
                </select>
              </label>
              <label className="detalle-modal-col-full">
                Observacion
                <textarea
                  rows="3"
                  value={formEvaluacion.observacion}
                  onChange={(e) => setFormEvaluacion((prev) => ({ ...prev, observacion: e.target.value }))}
                  placeholder="Notas para seguimiento"
                />
              </label>
              <div className="detalle-modal-acciones detalle-modal-col-full">
                <button type="button" className="secundario" onClick={cerrarModalRegistroEvaluacion}>Cancelar</button>
                <button type="submit">Guardar evaluacion</button>
              </div>
            </form>
          </article>
        </section>
      )}

      <section className="detalle-acciones-principales">
        <button type="button" onClick={() => setTabActiva(TAB_INFORME)}>Informe a la familia</button>
        <button type="button" onClick={manejarCrearPlanApoyo}>Crear Plan de Apoyo</button>
        <button type="button" onClick={abrirModalRegistroEvaluacion}>Registrar Evaluacion</button>
        <button type="button" onClick={manejarEnviarReporte}>Marcar como entregado a la familia</button>
      </section>
    </div>
  );
}

export default EstudianteDetallePage;
