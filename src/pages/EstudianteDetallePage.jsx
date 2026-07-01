import { useState, useEffect, useRef, useMemo } from "react";
import { AIService } from "../services/ai/AIService.js";
import { buildAIContext } from "../services/ai/ContextBuilder.js";
import { EventTracker } from "../services/ai/learning/EventTracker.js";
import { LEARNING_EVENTS, AGENT_IDS } from "../services/ai/knowledge/KnowledgeTypes.js";
import { guardarEstadoDetalleEstudiante, obtenerEstadoDetalleEstudiante } from "../firebase.js";

const EVALUACIONES_BASE_DETALLE = [];

const PLAN_APOYO_BASE_DETALLE = [];

function EstudianteDetallePage({ estudiante, onVolver = () => {}, initialTab = "Resumen", onTabChange = () => {} }) {
  const tabs = ["Resumen", "Rendimiento", "Evaluaciones", "Evidencias", "Asistencia", "Intervenciones", "Informe IA"];
  const [tabActiva, setTabActiva] = useState(initialTab);
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

  const nombreBase = estudiante?.nombre || "Juan Perez Rodriguez";
  const nombre = nombreBase === "Ana Belén Reyes" ? "Katherin Romero" : nombreBase;
  const estado = estudiante?.estado?.label || "En riesgo";
  const curso = estudiante?.cursoNombre || "2do Secundaria A";
  const edad = estudiante?.edad || 15;
  const fechaNacimiento = estudiante?.fechaNacimiento || "03/04/2011";
  const tutorBase = estudiante?.tutor || "Katherin Romero";
  const tutor = tutorBase
    .replaceAll("Ana Belén Reyes", "Katherin Romero")
    .replaceAll("Ana Rodriguez", "Katherin Romero")
    .replaceAll("Tutor de Ana", "Tutor de Katherin");
  const telefono = estudiante?.telefono || "829-123-4567";
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

  const informeIaBase = "El estudiante presenta una combinacion de fortalezas en Ciencias y oportunidades de mejora en Matematica. Se recomienda andamiaje por objetivos semanales y acompanamiento familiar continuo.";
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
          setTabActiva(remotoData.tabActiva || "Resumen");
          setEstadoPlan(remotoData.estadoPlan || "Pendiente de iniciar");
          setUltimoEnvio(remotoData.ultimoEnvio || null);
          setMensajeAccion(remotoData.mensajeAccion || "");
          setEvaluaciones(Array.isArray(remotoData.evaluaciones) ? remotoData.evaluaciones : EVALUACIONES_BASE_DETALLE);
          setPlanApoyo(Array.isArray(remotoData.planApoyo) ? remotoData.planApoyo : PLAN_APOYO_BASE_DETALLE);
          setInformeIa(remotoData.informeIa || informeIaBase);
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
          setStorageListo(true);
          return;
        }
        const parsed = JSON.parse(raw);
        setTabActiva(parsed.tabActiva || "Resumen");
        setEstadoPlan(parsed.estadoPlan || "Pendiente de iniciar");
        setUltimoEnvio(parsed.ultimoEnvio || null);
        setMensajeAccion(parsed.mensajeAccion || "");
        setEvaluaciones(Array.isArray(parsed.evaluaciones) ? parsed.evaluaciones : EVALUACIONES_BASE_DETALLE);
        setPlanApoyo(Array.isArray(parsed.planApoyo) ? parsed.planApoyo : PLAN_APOYO_BASE_DETALLE);
        setInformeIa(parsed.informeIa || informeIaBase);
        setStorageListo(true);
      } catch {
        setTabActiva("Resumen");
        setEstadoPlan("Pendiente de iniciar");
        setUltimoEnvio(null);
        setMensajeAccion("");
        setEvaluaciones(EVALUACIONES_BASE_DETALLE);
        setPlanApoyo(PLAN_APOYO_BASE_DETALLE);
        setInformeIa(informeIaBase);
        setStorageListo(true);
      }
    };

    cargar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, detalleId]);

  useEffect(() => {
    setTabActiva(initialTab || "Resumen");
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
    };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
    guardarEstadoDetalleEstudiante({ estudianteId: detalleId, payload }).catch(() => {
      // Fallback local ya aplicado.
    });
  }, [storageKey, detalleId, storageListo, tabActiva, estadoPlan, ultimoEnvio, mensajeAccion, evaluaciones, planApoyo, informeIa]);

  const manejarGenerarInformeIA = async () => {
    setInformeIa("");
    setInformeIaGenerando(true);
    setTabActiva("Informe IA");

    const areaActiva = areas[0]?.area || "";

    let ctx;
    try {
      ctx = await buildAIContext("sugerir_apoyo", {
        area:  areaActiva,
        grado: curso || "",
        estudiantesEnRiesgo: [{
          nombre,
          cf:          promedio,
          asistencia,
          observacion: `Estado: ${estado}. Plan de apoyo: ${planApoyo.slice(0, 2).join("; ")}`,
          competenciasDebiles: evaluaciones
            .filter((ev) => parseInt(ev.calificacion) < 70)
            .slice(0, 3)
            .map((ev) => ev.area),
        }],
        promedioGrupo: promedio,
      });
    } catch {
      setInformeIa("Error al construir el contexto IA.");
      setInformeIaGenerando(false);
      return;
    }

    AIService.generate({
      module:    "registro-apoyo",
      prompt:    ctx.prompt,
      system:    ctx.system,
      maxTokens: 2000,
      onChunk: (chunk) => {
        setInformeIa((prev) => prev + chunk);
        setTimeout(() => informeIaRef.current?.scrollTo({ top: informeIaRef.current.scrollHeight, behavior: "smooth" }), 50);
      },
      onFinish: () => {
        setInformeIaGenerando(false);
        setMensajeAccion("Informe IA generado en la pestaña Informe IA.");
        EventTracker.track(LEARNING_EVENTS.INFORME_ESTUDIANTE_GENERADO, {
          agentId: AGENT_IDS.GENERADOR_REPORTES,
          area:    areaActiva,
          grado:   curso || "",
        });
      },
      onError: (err) => {
        setInformeIa(`Error al generar el informe: ${err}`);
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
    setMensajeAccion(`Reporte enviado a familia (${tutor}) el ${envio}.`);
  };

  const contenidoTab = {
    "Resumen": (
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
    ),
    "Rendimiento": (
      <div className="detalle-tab-lista">
        <p>Matematica: reforzar operaciones y resolucion de problemas.</p>
        <p>Lengua: mejorar argumentacion en textos cortos.</p>
        <p>Ciencias: mantener desempeno con proyectos practicos.</p>
        <p>Ingles: fortalecer comprension lectora con ejercicios guiados.</p>
      </div>
    ),
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
    "Evidencias": (
      <div className="detalle-tab-lista">
        <p><strong>Total de evidencias:</strong> {evidenciasExpediente.length}</p>
        {evidenciasExpediente.length === 0 ? (
          <p className="detalle-sin-datos">Sin evidencias registradas todavía. Al calificar instrumentos, DocenteOS creará evidencias automáticamente.</p>
        ) : (
          evidenciasExpediente.slice(0, 8).map((evidencia) => (
            <p key={evidencia.id || evidencia.evidenciaId}>
              {new Date(evidencia.fecha || evidencia.creadoEn || "2026-01-01").toLocaleDateString("es-DO")} ·
              {" "}{evidencia.actividad || evidencia.titulo || evidencia.instrumento || "Evidencia"} ·
              {" "}{evidencia.calificacion?.obtenida ?? evidencia.calificacion ?? "—"}/{evidencia.calificacion?.valorMaximo ?? evidencia.puntajeMaximo ?? "—"}
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
    ),
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
    "Informe IA": (
      <div className="detalle-tab-lista">
        {informeIaGenerando && (
          <p style={{ color: "#7c3aed", fontSize: "0.85rem", marginBottom: 8 }}>⏳ Generando informe con IA...</p>
        )}
        {!informeIa && !informeIaGenerando && (
          <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>Haz clic en "Generar Informe Individual IA" para crear un análisis completo con IA.</p>
        )}
        <div ref={informeIaRef} style={{ maxHeight: 420, overflowY: "auto" }}>
          {informeIa.split("\n").map((line, i) => {
            if (line.startsWith("## ")) return <h4 key={i} style={{ color: "#4f46e5", margin: "14px 0 4px", fontSize: "0.92rem", fontWeight: 800, borderBottom: "2px solid #e0e7ff", paddingBottom: 3 }}>{line.slice(3)}</h4>;
            if (line.startsWith("- ")) return <li key={i} style={{ marginLeft: 14, marginBottom: 2, fontSize: "0.85rem" }}>{line.slice(2)}</li>;
            if (line.trim() === "") return <br key={i} />;
            return <p key={i} style={{ margin: "3px 0", fontSize: "0.85rem" }}>{line}</p>;
          })}
          {informeIaGenerando && <span style={{ color: "#7c3aed", fontWeight: 900, animation: "plan-ia-blink 0.8s step-end infinite" }}>▋</span>}
        </div>
        {ultimoEnvio && <p style={{ marginTop: 12, fontSize: "0.8rem", color: "#64748b" }}>Ultimo envio familiar: {ultimoEnvio}</p>}
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
          onClick={manejarGenerarInformeIA}
          disabled={informeIaGenerando}
        >
          {informeIaGenerando ? "⏳ Generando..." : "Ver informe IA completo"}
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
        <button type="button" onClick={manejarGenerarInformeIA}>Generar Informe Individual IA</button>
        <button type="button" onClick={manejarCrearPlanApoyo}>Crear Plan de Apoyo</button>
        <button type="button" onClick={abrirModalRegistroEvaluacion}>Registrar Evaluacion</button>
        <button type="button" onClick={manejarEnviarReporte}>Enviar Reporte a Familia</button>
      </section>
    </div>
  );
}

export default EstudianteDetallePage;
