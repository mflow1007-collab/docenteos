/**
 * Página: Planificación Inteligente
 * Ubicación: src/pages/PlanificacionPage.jsx
 * 
 * Responsabilidades:
 * - Gestionar estado de la página
 * - Integrar componentes
 * - Orquestar lógica de generación
 * - Manejar guardado local (Firebase pendiente)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { leerSesion, guardarSesion } from "../services/planificacionSesionCache.js";
import { clearGenerationJob, startGenerationJob, subscribeGenerationJobs } from "../services/planificacionBackgroundJobs.js";
import CentroDecisionesKE from "../components/CentroDecisionesKE.jsx";
import { AIService } from "../services/ai/AIService.js";
import { buildAIContext } from "../services/ai/ContextBuilder.js";
import { indexarEnBIC } from "../services/ai/agents/AgentOrchestrator.js";
import { adaptar as bicAdaptar } from "../services/ai/agents/AgentePlanificador.js";
import { registrarUso as bicRegistrarUso } from "../services/ai/learning/KnowledgeBank.js";
import { EventTracker } from "../services/ai/learning/EventTracker.js";
import { LEARNING_EVENTS, AGENT_IDS } from "../services/ai/knowledge/KnowledgeTypes.js";
import { generarPlanificacionInteligente } from "../services/ai/PlanificacionInteligente.js";
import { extractStyle } from "../services/ai/style/StyleEngine.js";
import { crearCasoExito } from "../services/ai/CasosExitoService.js";
import { usePerfilInstitucional } from "../hooks/usePerfilInstitucional.js";
import { useAuth } from "../context/AuthContext.jsx";
import { esUsuarioDocenteOS } from "../utils/permisos.js";
import ModalConfirmacion from "../components/ModalConfirmacion.jsx";
import { usePlanDiario } from "../hooks/usePlanDiario.js";
import { useUnidadAprendizaje } from "../hooks/useUnidadAprendizaje.js";
import FormularioPlanificacion from "../components/FormularioPlanificacion";
import ResultadoPlanificacion from "../components/ResultadoPlanificacion";
import FormularioPlanDiario from "../components/FormularioPlanDiario";
import ResultadoPlanDiario from "../components/ResultadoPlanDiario";
import FormularioUnidadAprendizaje from "../components/FormularioUnidadAprendizaje";
import ResultadoUnidadAprendizaje from "../components/ResultadoUnidadAprendizaje";
import {
  generarPlanificacion,
  formatearParaPDFHtml
} from "../services/planificacionService";
import { obtenerCompetencias, consultarCurriculo } from "../services/curriculumService.js";
import { getAreas, getAsignaturaAutomatica } from "../planning/areaAsignaturaMap.js";
import { analizarCombinacionTematica } from "../services/curriculumCombinacionService.js";
import { getReferenciaAdecuacionesCurriculares } from "../data/adecuacionesCurriculares.js";
import {
  eliminarPlanificacionDetallada,
  obtenerPlanificacionesDetalladas,
  guardarPreferenciaUsuario,
  obtenerPreferenciaUsuario,
  verificarTemaAntesDeGenerar,
  registrarUsoTemaPlanificacion,
  registrarUsoPDFTema,
  suscribirseEstadoTemasPlanificacion,
  subirImagenPlanificacion,
} from "../firebase";
import { guardarPlanificacionConHilo } from "../services/planificacionDataService.js";

const LIMITE_HISTORIAL_DOCENTE = 3;
const PLAN_JOB_ID = "planificacion-inteligente";
const ES_TIPO_UNIDAD = (t) =>
  t === "Unidad de Aprendizaje" || t === "Secuencia Didáctica";

const textoUI = (valor, fallback = "") => {
  if (typeof valor === "string" || typeof valor === "number") return String(valor).trim();
  if (!valor || typeof valor !== "object") return fallback;
  return [
    valor.organismo || valor.ministerio || valor.entidad,
    valor.documento || valor.titulo || valor.nombre || valor.tema || valor.title,
    valor.anio || valor.year,
  ].map((item) => textoUI(item)).filter(Boolean).join(" · ") || fallback;
};

export default function PlanificacionPage({
  planificacionPreCargada = null,
  onConsumirPreCargada = () => {},
  accionIAActiva = null,
  onConsumirAccionIA = () => {},
  onIrA,
}) {
  const hoyISO = new Date().toISOString().slice(0, 10);
  const STORAGE_USO_TIPOS = "docenteos_planificacion_uso_tipos_v1";

  // ── Perfil institucional global ───────────────────────────────────────────
  const { formulario: perfilForm } = usePerfilInstitucional();
  const { user } = useAuth();
  const puedeVerCentroDecisiones = esUsuarioDocenteOS(user?.email);

  // ── Estado curricular oficial (Firestore) ─────────────────────────────────
  const [competenciasCurriculares, setCompetenciasCurriculares] = useState([]);
  const [cargandoCurriculo, setCargandoCurriculo] = useState(false);
  const [tieneCurriculoOficial, setTieneCurriculoOficial] = useState(false);
  const [curriculoCompleto, setCurriculoCompleto] = useState(null);
  const [temasCurriculares, setTemasCurriculares] = useState([]);
  // Integración curricular (Regla de Combinación)
  const [combinacionSugerida, setCombinacionSugerida] = useState(null);
  const [temasIntegrados, setTemasIntegrados] = useState([]);

  // Estado del formulario
  const [grado, setGrado] = useState("");
  const [seccion, setSeccion] = useState("");
  const [area, setArea] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [fechaInicio, setFechaInicio] = useState(hoyISO);
  const [duracion, setDuracion] = useState("");
  const [tipoPlanificacion, setTipoPlanificacion] = useState(() => leerSesion("tipo", ""));
  const [diasClase, setDiasClase] = useState(["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"]);
  const [asignatura, setAsignatura] = useState("");
  const [tema, setTema] = useState("");
  const [competencia, setCompetencia] = useState("");
  const [indicadoresOficiales, setIndicadoresOficiales] = useState("");
  const [imagenTematicaSrc, setImagenTematicaSrc] = useState("");
  const [imagenTematicaNombre, setImagenTematicaNombre] = useState("");
  const [imagenSubiendo, setImagenSubiendo] = useState(false);
  const [ejesTematicos, setEjesTematicos] = useState([]);
  const [asignaturasVinculadas, setAsignaturasVinculadas] = useState("");
  const [situacionAprendizaje, setSituacionAprendizaje] = useState("");
  const [minutosHoraClase, setMinutosHoraClase] = useState(45);
  const [periodosClasePorDia, setPeriodosClasePorDia] = useState({});
  const [materialPlanificacion, setMaterialPlanificacion] = useState(null);
  const [confirmMensaje, setConfirmMensaje] = useState(null);
  const confirmResolveRef = useRef(null);

  // ── Plan Diario y Unidad (custom hooks) ──
  const planDiarioHook = usePlanDiario();
  const {
    planDiarioDatos, setPlanDiarioDatos,
    planDiario, cargandoDiario, guardandoDiario, mensajeDiario,
    manejarGenerarDiario, manejarGenerarDiarioForzado,
    manejarGuardarDiario, manejarDescargarDiario, manejarNuevoDiario,
  } = planDiarioHook;

  const unidadHook = useUnidadAprendizaje();
  const {
    unidadDatos, setUnidadDatos,
    unidad, setUnidad,
    cargandoUnidad, guardandoUnidad, mensajeUnidad, setMensajeUnidad,
    manejarGenerarUnidad, manejarGenerarUnidadForzado,
    manejarGuardarUnidad, manejarDescargarUnidad,
    manejarVerUnidad, manejarNuevaUnidad, manejarAplicarAcciones,
  } = unidadHook;

  // ── IA sobre planificación generada ───────────────────────────────────────
  const [iaAccion, setIaAccion] = useState(null);
  const [iaTexto, setIaTexto] = useState("");
  const [iaGenerando, setIaGenerando] = useState(false);
  const [iaError, setIaError] = useState(null);
  const [iaMinutos, setIaMinutos] = useState(45);
  const iaRef = useRef(null);

  // ── Banco Inteligente de Conocimiento (BIC) ───────────────────────────────
  const [bicBanner, setBicBanner] = useState({ abierto: false, nivel: null, candidato: null, score: null });
  const [bicDatosValidados, setBicDatosValidados] = useState(null);
  const [bicAdaptando, setBicAdaptando] = useState(false);
  const [bicFuente, setBicFuente] = useState(null); // "reutilizado"|"adaptado"|"generado"|"indexado"
  const [bicId, setBicId] = useState(null);

  // ── Entrenar IA ───────────────────────────────────────────────────────────
  const [guardandoEstilo,    setGuardandoEstilo]    = useState(false);
  const [guardandoCasoExito, setGuardandoCasoExito] = useState(false);
  const [mensajeEntrenar,    setMensajeEntrenar]    = useState(null);
  const [bannerEntrenar,     setBannerEntrenar]     = useState(false);

  const _mostrarBannerEntrenar = useCallback(() => {
    if (localStorage.getItem("doe_entrenar_visto")) return;
    setBannerEntrenar(true);
    localStorage.setItem("doe_entrenar_visto", "1");
  }, []);

  useEffect(() => {
    try {
      const guardado = localStorage.getItem("docenteos_material_planificacion_activo");
      setMaterialPlanificacion(guardado ? JSON.parse(guardado) : null);
    } catch {
      setMaterialPlanificacion(null);
    }
  }, []);

  const quitarMaterialPlanificacion = () => {
    try {
      localStorage.removeItem("docenteos_material_planificacion_activo");
    } catch {
      // No bloquea la edición de planificación.
    }
    setMaterialPlanificacion(null);
  };



  const perfilNombreDocente = perfilForm?.nombreDocente || "";
  const perfilRegional = perfilForm?.regional || "";
  const perfilDistrito = perfilForm?.distrito || "";
  const perfilCentro = perfilForm?.centro || "";
  const perfilCodigoCentro = perfilForm?.codigoCentro || "";
  const perfilNivel = perfilForm?.nivel || "";
  const perfilModalidad = perfilForm?.modalidad || "";
  const perfilCiclo = perfilForm?.ciclo || "";
  const perfilJornada = perfilForm?.jornada || "";
  const perfilPeriodo = perfilForm?.periodo || "";
  const perfilContextoComunitario = perfilForm?.contextoComunitario || "";

  // ── Auto-completar formularios desde el perfil institucional ─────────────
  useEffect(() => {
    if (!perfilNombreDocente) return;
    const campos = {
      nombreDocente: perfilNombreDocente,
      regional:      perfilRegional,
      distrito:      perfilDistrito,
      centro:        perfilCentro,
      codigoCentro:  perfilCodigoCentro,
      nivel:         perfilNivel,
      modalidad:     perfilModalidad,
      ciclo:         perfilCiclo,
      jornada:       perfilJornada,
    };
    setPlanDiarioDatos((prev) => ({ ...prev, ...campos }));
    setUnidadDatos((prev) => ({
      ...prev,
      ...campos,
      periodo: perfilPeriodo || prev.periodo,
      // Prellenar el contexto comunitario del perfil solo si el docente aún
      // no escribió uno en esta unidad (no sobreescribir lo que ya editó)
      contextoComunitario: prev.contextoComunitario || perfilContextoComunitario,
    }));
  }, [perfilNombreDocente, perfilRegional, perfilDistrito, perfilCentro, perfilCodigoCentro, perfilNivel, perfilModalidad, perfilCiclo, perfilJornada, perfilPeriodo, perfilContextoComunitario]);

  // ── Estado de generación (planificación general) ──
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  // Resultado inicial desde el cache de sesión: sobrevive al cambio de menú
  const [planificacion, setPlanificacion] = useState(() => leerSesion("plan:resultado", null));
  const [mensaje, setMensaje] = useState(null);
  const [historialPlanificaciones, setHistorialPlanificaciones] = useState([]);
  const [usoTiposPlanificacion, setUsoTiposPlanificacion] = useState({});
  const [estadoTemas, setEstadoTemas] = useState({
    temaActivo: null,
    temaSecundario: null,
    temaTercero: null,
    temaCuarto: null,
    suscripcion: "Pendiente de completar",
    usoMensual: "Pendiente de completar",
    creditosDisponibles: 0,
  });
  const [dialogoTema, setDialogoTema] = useState({ abierto: false, payload: null, contexto: "planificacion" });

  // Persistir en el cache de sesión: al volver desde otro menú, el docente
  // encuentra su planificación generada y el tipo que estaba trabajando.
  useEffect(() => { guardarSesion("plan:resultado", planificacion); }, [planificacion]);
  useEffect(() => { guardarSesion("tipo", tipoPlanificacion); }, [tipoPlanificacion]);

  useEffect(() => subscribeGenerationJobs((jobs) => {
    const job = jobs.find((item) => item.id === PLAN_JOB_ID);
    if (!job) return;
    if (job.status === "running") {
      setCargando(true);
      setMensaje({ tipo: "loading", texto: job.mensaje });
      return;
    }
    if (job.status === "success") {
      setCargando(false);
      const respuesta = job.result;
      if (respuesta?.tipo === "bic_hit") {
        setBicDatosValidados(respuesta.datosValidados || null);
        setBicBanner({
          abierto: true,
          nivel: respuesta.bicHit?.nivel,
          candidato: respuesta.bicHit?.mejor,
          score: respuesta.bicHit?.score,
        });
      } else if (respuesta?.resultado) {
        setPlanificacion(respuesta.resultado);
        setBicFuente("generado");
        setBicId(null);
        _mostrarBannerEntrenar();
      }
      setMensaje({ tipo: "success", texto: "✅ Planificación generada. Puedes revisarla completa." });
      setTimeout(() => document.querySelector(".resultado")?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
      return;
    }
    if (job.status === "error") {
      setCargando(false);
      setMensaje({ tipo: "error", texto: job.mensaje });
    }
  }), [_mostrarBannerEntrenar]);

  // Temas ya trabajados por el docente (según su historial guardado).
  // Se usan para marcar visualmente — nunca para bloquear.
  // Registros de temas trabajados CON CONTEXTO: un tema trabajado en 1ro
  // Secundaria no está "trabajado" en 1ro Primaria. Los formularios filtran
  // con coincideContextoTemaTrabajado (nivel+grado+asignatura).
  const temasTrabajados = useMemo(() => {
    const lista = [];
    const vistos = new Set();
    historialPlanificaciones.forEach((item) => {
      const contenido = item?.contenido || item;
      const meta = contenido?.metadatos || {};
      const contexto = {
        nivel: meta.nivel || meta.nivelEducativo || "",
        grado: meta.grado || item?.grado || "",
        asignatura: meta.asignatura || "",
        area: meta.area || item?.area || "",
      };
      const candidatos = [
        meta.titulo, meta.tema, item?.tema,
        ...(Array.isArray(meta.temasIntegrados) ? meta.temasIntegrados : []),
      ];
      candidatos.forEach((t) => {
        const texto = String(t || "").trim();
        if (!texto) return;
        const clave = `${texto}|${contexto.nivel}|${contexto.grado}|${contexto.asignatura}|${contexto.area}`.toLowerCase();
        if (vistos.has(clave)) return;
        vistos.add(clave);
        lista.push({ texto, ...contexto });
      });
    });
    return lista;
  }, [historialPlanificaciones]);

  const historialVisibleDocente = useMemo(
    () => historialPlanificaciones.slice(0, LIMITE_HISTORIAL_DOCENTE),
    [historialPlanificaciones]
  );

  const formatearFechaRegistro = (fecha) => {
    if (!fecha) return "Sin fecha";
    const normalizada = fecha?.toDate
      ? fecha.toDate()
      : typeof fecha === "string"
        ? new Date(fecha)
        : fecha;
    if (Number.isNaN(normalizada.getTime())) return "Sin fecha";
    return normalizada.toLocaleString("es-DO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const cargarHistorial = async ({ mostrarMensajeRecuperacion = false } = {}) => {
    try {
      const resultado = await obtenerPlanificacionesDetalladas();
      const lista = (resultado.data || []).filter((item) => {
        const contenido = item?.contenido || item;
        return contenido?.metadatos || item?.tema || item?.area || item?.curso;
      });
      setHistorialPlanificaciones(lista);

      if (!lista.length) {
        return { lista: [], mode: resultado.mode || "local" };
      }

      if (mostrarMensajeRecuperacion) {
        setMensaje({
          tipo: "success",
          texto: resultado.mode === "firebase"
            ? "☁️ Historial actualizado desde Firebase"
            : "💾 Historial actualizado localmente",
        });
        setTimeout(() => setMensaje(null), 2500);
      }

      return { lista, mode: resultado.mode || "local" };
    } catch {
      // Si falla la recuperación no bloqueamos la página.
      return { lista: [], mode: "local" };
    }
  };

  // Sync latest deps into hooks on every render (avoids stale closures via depsRef pattern)
  planDiarioHook.syncDeps({ estadoTemas, setDialogoTema, cargarHistorial });
  unidadHook.syncDeps({ estadoTemas, setDialogoTema, cargarHistorial, tipoPlanificacion });

  useEffect(() => {
    const timer = setTimeout(() => {
      cargarHistorial({ mostrarMensajeRecuperacion: false });
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const cargarFormularioDesdeHistorial = (contenido, { duplicar = false } = {}) => {
    if (!contenido) return;

    const contenidoNormalizado = contenido.contenido || contenido;
    const meta = contenidoNormalizado.metadatos || contenido.metadatos || {};
    const tipoGuardado = meta.tipoPlanificacion || contenidoNormalizado.tipoPlanificacion || "";
    const esUnidadGuardada = ES_TIPO_UNIDAD(tipoGuardado)
      || Array.isArray(contenidoNormalizado.fasesSemanales)
      || Boolean(contenidoNormalizado.modeloCurricularSuperior);
    const temaGuardado = meta.tema || meta.titulo || contenidoNormalizado?.metadatos?.titulo || "";

    if (esUnidadGuardada) {
      if (!duplicar) {
        setUnidad(contenidoNormalizado);
        setPlanificacion(null);
      } else {
        setUnidad(null);
        setPlanificacion(null);
      }
      setMensajeUnidad({
        tipo: "success",
        texto: duplicar
          ? "🧬 Configuración de unidad duplicada en el formulario"
          : "📂 Unidad cargada completa desde historial",
      });
      setTimeout(() => setMensajeUnidad(null), 2500);
    } else if (!duplicar) {
      setPlanificacion(contenidoNormalizado);
      setUnidad(null);
    } else {
      setPlanificacion(null);
      setUnidad(null);
    }

    setGrado(meta.grado || "");
    setSeccion(meta.seccion || "");
    setArea(meta.area || "");
    setAsignatura(meta.asignatura || "");
    setPeriodo(meta.periodo || "");
    setFechaInicio(meta.fechaInicio || hoyISO);
    setDuracion(meta.duracion || "");
    setTipoPlanificacion(tipoGuardado);
    setDiasClase(Array.isArray(meta.diasClase) && meta.diasClase.length ? meta.diasClase : ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"]);
    setTema(temaGuardado);
    setCompetencia(meta.competenciaSeleccionada || "");
    setIndicadoresOficiales((meta.indicadoresOficiales || []).join("\n"));
    setImagenTematicaSrc(meta.imagenTematicaSrc || "");
    setImagenTematicaNombre(meta.imagenTematicaNombre || "");
    setEjesTematicos(Array.isArray(meta.ejesTematicos) ? meta.ejesTematicos : []);
    setAsignaturasVinculadas(Array.isArray(meta.asignaturasVinculadas) ? meta.asignaturasVinculadas.join(", ") : (meta.asignaturasVinculadas || ""));
    setSituacionAprendizaje(meta.situacionAprendizaje || "");
    setMinutosHoraClase(meta.minutosHoraClase || 45);
    setPeriodosClasePorDia(meta.periodosClasePorDia && typeof meta.periodosClasePorDia === "object" ? meta.periodosClasePorDia : {});
    setTemasIntegrados(Array.isArray(meta.temasIntegrados) && meta.temasIntegrados.length > 1 ? meta.temasIntegrados : []);
    setCombinacionSugerida(null);

    if (esUnidadGuardada) {
      const semanasDetectadas = Number(String(meta.duracion || "").match(/(\d+)\s*seman/i)?.[1] || 0);
      setUnidadDatos((prev) => ({
        ...prev,
        grado: meta.grado || prev.grado || "",
        seccion: meta.seccion || prev.seccion || "",
        area: meta.area || prev.area || "",
        asignatura: meta.asignatura || prev.asignatura || "",
        titulo: temaGuardado || prev.titulo || "",
        periodo: meta.periodo || prev.periodo || "",
        fechaInicio: meta.fechaInicio || prev.fechaInicio || hoyISO,
        numSemanas: semanasDetectadas || prev.numSemanas || 4,
        nombreDocente: meta.nombreDocente || prev.nombreDocente || "",
        cedula: meta.cedula || prev.cedula || "",
        regional: meta.regional || prev.regional || "",
        distrito: meta.distrito || prev.distrito || "",
        centro: meta.centro || prev.centro || "",
        codigoCentro: meta.codigoCentro || prev.codigoCentro || "",
        nivel: meta.nivel || prev.nivel || "",
        ciclo: meta.ciclo || prev.ciclo || "",
        modalidad: meta.modalidad || prev.modalidad || "",
        jornada: meta.jornada || prev.jornada || "",
        productoFinalTexto: meta.productoFinal || prev.productoFinalTexto || "",
        situacionTexto: contenidoNormalizado.situacionAprendizaje || prev.situacionTexto || "",
        temasSeleccionados: Array.isArray(meta.temasIntegrados) ? meta.temasIntegrados : [],
      }));
    }

    const texto = duplicar
      ? "🧬 Configuración duplicada en el formulario"
      : "📂 Planificación cargada desde historial";

    if (!esUnidadGuardada) {
      setMensaje({ tipo: "success", texto });
      setTimeout(() => setMensaje(null), 2000);
    }
  };

  // Carga una planificación desde el historial reciente del Dashboard
  useEffect(() => {
    if (!planificacionPreCargada?.contenido) return;
    cargarFormularioDesdeHistorial(planificacionPreCargada.contenido, {
      duplicar: planificacionPreCargada.accion === "duplicar",
    });
    onConsumirPreCargada();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planificacionPreCargada]);

  useEffect(() => {
    if (!accionIAActiva || accionIAActiva.destino !== "planificacion") return;

    const prompt = accionIAActiva.prompt || accionIAActiva.descripcion || "";
    const tipoPorAccion = {
      "situacion-aprendizaje": "Situación de Aprendizaje",
      "secuencia-semanal": "Planificación Semanal",
      "actividad-multinivel": "Planificación Diaria",
      "actividad-competencial": "Planificación Diaria",
      dua: "Planificación Diaria",
    };
    const tipoSugerido = tipoPorAccion[accionIAActiva.id] || "Planificación Diaria";
    setTipoPlanificacion(tipoSugerido);

    if (tipoSugerido === "Planificación Diaria") {
      setPlanDiarioDatos((prev) => ({
        ...prev,
        grado: prev.grado || grado || "",
        area: prev.area || area || "",
        asignatura: prev.asignatura || asignatura || "",
        tema: prev.tema || tema || accionIAActiva.titulo || "",
        situacionAprendizajeTexto: prompt,
      }));
    } else if (ES_TIPO_UNIDAD(tipoSugerido)) {
      setUnidadDatos((prev) => ({
        ...prev,
        grado: prev.grado || grado || "",
        seccion: prev.seccion || seccion || "",
        area: prev.area || area || "",
        asignatura: prev.asignatura || asignatura || "",
        titulo: prev.titulo || tema || accionIAActiva.titulo || "",
        situacionTexto: prompt,
      }));
      setUnidad(null);
      setMensajeUnidad(null);
    } else {
      setTema((prev) => prev || accionIAActiva.titulo || "");
      setSituacionAprendizaje(prompt);
    }

    setMensaje({
      tipo: "success",
      texto: `${tipoSugerido} preparada desde Centro IA. Revisa los datos y pulsa Generar.`,
    });
    window.setTimeout(() => setMensaje(null), 3500);
    onConsumirAccionIA();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accionIAActiva]);

  useEffect(() => {
    const unsub = suscribirseEstadoTemasPlanificacion(
      (data) => {
        setEstadoTemas({
          temaActivo: data?.temaActivo || null,
          temaSecundario: data?.temaSecundario || null,
          temaTercero: data?.temaTercero || null,
          temaCuarto: data?.temaCuarto || null,
          suscripcion: data?.suscripcion ?? "Pendiente de completar",
          usoMensual: data?.usoMensual ?? "Pendiente de completar",
          creditosDisponibles: Number(data?.creditosDisponibles || 0),
        });
      },
      () => {
        // En error mantenemos última foto de estado.
      }
    );

    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  // ── Consulta curricular oficial al cambiar Grado o Área ───────────────────
  const consultarCurriculoOficial = useCallback(async (gradoActual, areaActual) => {
    if (!gradoActual || !areaActual) {
      setCompetenciasCurriculares([]);
      setTieneCurriculoOficial(false);
      setCurriculoCompleto(null);
      setTemasCurriculares([]);
      return;
    }

    // Inferir nivel desde el grado y normalizar el grado (quitar sufijo de nivel)
    const nivelGrado =
      gradoActual.toLowerCase().includes("secundaria") ? "Secundaria" :
      gradoActual.toLowerCase().includes("primaria") ? "Primaria" : "Secundaria";
    const gradoBase = gradoActual
      .replace(/\s*(secundaria|primaria|inicial)\s*/gi, "")
      .trim();

    setCargandoCurriculo(true);
    try {
      const [competenciasOficiales, docCurriculo] = await Promise.all([
        obtenerCompetencias(nivelGrado, gradoBase, areaActual),
        consultarCurriculo(nivelGrado, gradoBase, areaActual),
      ]);
      if (competenciasOficiales.length > 0) {
        setCompetenciasCurriculares(competenciasOficiales);
        setTieneCurriculoOficial(true);
      } else {
        setCompetenciasCurriculares([]);
        setTieneCurriculoOficial(false);
      }
      setCurriculoCompleto(docCurriculo);
      setTemasCurriculares(docCurriculo?.temasCurriculares ?? []);
    } catch {
      setCompetenciasCurriculares([]);
      setTieneCurriculoOficial(false);
      setCurriculoCompleto(null);
      setTemasCurriculares([]);
    } finally {
      setCargandoCurriculo(false);
    }
  }, []);

  useEffect(() => {
    if (grado && area) {
      consultarCurriculoOficial(grado, area);
      // Auto-asignar asignatura si el área tiene solo una, o limpiar si hay varias
      setAsignatura(getAsignaturaAutomatica(area) || "");
      setCompetencia("");
      setIndicadoresOficiales("");
      setTema("");
      setCombinacionSugerida(null);
      setTemasIntegrados([]);
    }
  }, [grado, area, consultarCurriculoOficial]);

  useEffect(() => {
    let activo = true;
    const cargarUsoTipos = async () => {
      try {
        const preferencia = await obtenerPreferenciaUsuario(STORAGE_USO_TIPOS);
        if (!activo) return;
        const remoto = preferencia?.data;
        if (remoto && typeof remoto === "object") {
          setUsoTiposPlanificacion(remoto);
          return;
        }

        const guardado = localStorage.getItem(STORAGE_USO_TIPOS);
        if (!guardado) return;
        const parsed = JSON.parse(guardado);
        if (parsed && typeof parsed === "object") {
          setUsoTiposPlanificacion(parsed);
        }
      } catch {
        // Si storage falla, usamos el orden base por defecto.
      }
    };

    cargarUsoTipos();
    return () => {
      activo = false;
    };
  }, []);

  // Opciones de grados (sin áreas)
  const grados = [
    // Inicial
    { grado: "Pre-Kínder", nivel: "Inicial" },
    { grado: "Kínder", nivel: "Inicial" },
    { grado: "Preprimario", nivel: "Inicial" },
    // Primaria
    { grado: "1ro Primaria", nivel: "Primaria" },
    { grado: "2do Primaria", nivel: "Primaria" },
    { grado: "3ro Primaria", nivel: "Primaria" },
    { grado: "4to Primaria", nivel: "Primaria" },
    { grado: "5to Primaria", nivel: "Primaria" },
    { grado: "6to Primaria", nivel: "Primaria" },
    // Secundaria
    { grado: "1ro Secundaria", nivel: "Secundaria" },
    { grado: "2do Secundaria", nivel: "Secundaria" },
    { grado: "3ro Secundaria", nivel: "Secundaria" },
    { grado: "4to Secundaria", nivel: "Secundaria" },
    { grado: "5to Secundaria", nivel: "Secundaria" },
    { grado: "6to Secundaria", nivel: "Secundaria" },
  ];

  const secciones = ["A", "B", "C", "D", "E", "F", "G"];

  const areas = getAreas();

  const periodos = [
    "Primer período",
    "Segundo período",
    "Tercer período",
    "Cuarto período",
  ];

  const duraciones = [
    "2 semanas",
    "3 semanas",
    "4 semanas",
    "5 semanas",
    "6 semanas",
    "7 semanas",
    "8 semanas",
    "9 semanas",
  ];

  const tiposPlanificacion = [
    { value: "Plan Anual", icono: "🗂️", tono: "azul", descripcion: "Visión completa del año escolar" },
    { value: "Planificación por Período", icono: "📚", tono: "verde", descripcion: "Organiza metas por período" },
    { value: "Unidad de Aprendizaje", icono: "🧩", tono: "rosado", descripcion: "Bloque curricular integrado" },
    { value: "Secuencia Didáctica", icono: "🧠", tono: "naranja", descripcion: "Pasos pedagógicos progresivos" },
    { value: "Planificación por Proyecto de Aula", icono: "🏫", tono: "amarillo", descripcion: "Diseño por proyecto contextualizado del aula" },
    { value: "Situación de Aprendizaje", icono: "🌍", tono: "teal", descripcion: "Problema real del entorno" },
    { value: "Planificación por Competencias Específicas", icono: "🎯", tono: "morado", descripcion: "Enfoque directo en logro de competencias" },
    { value: "Planificación Semanal", icono: "📅", tono: "morado", descripcion: "Plan operativo de la semana" },
    { value: "Planificación Diaria", icono: "🕒", tono: "cian", descripcion: "Clase lista para ejecutar" },
  ];

  const tiposRecomendados = tiposPlanificacion
    .map((tipo, index) => ({
      value: tipo.value,
      index,
      usos: usoTiposPlanificacion[tipo.value] || 0,
    }))
    .sort((a, b) => {
      if (b.usos !== a.usos) return b.usos - a.usos;
      return a.index - b.index;
    })
    .slice(0, 2)
    .map((item) => item.value);

  const seleccionarTipoPlanificacion = (tipo) => {
    setTipoPlanificacion(tipo);

    // Al cambiar a Unidad/Secuencia: pre-llenar desde los campos generales si están vacíos
    if (ES_TIPO_UNIDAD(tipo)) {
      setUnidadDatos((prev) => ({
        ...prev,
        grado:   prev.grado   || grado   || "",
        seccion: prev.seccion || seccion || "",
        area:    prev.area    || area    || "",
        titulo:  prev.titulo  || tema    || "",
      }));
      // Limpiar resultado anterior para no confundir con datos nuevos
      setUnidad(null);
      setMensajeUnidad(null);
    }

    setUsoTiposPlanificacion((prev) => {
      const next = {
        ...prev,
        [tipo]: (prev[tipo] || 0) + 1,
      };
      try {
        localStorage.setItem(STORAGE_USO_TIPOS, JSON.stringify(next));
        guardarPreferenciaUsuario({ clave: STORAGE_USO_TIPOS, valor: next }).catch(() => {
          // fallback local ya aplicado
        });
      } catch {
        // Si no se puede persistir, no bloqueamos la selección.
      }
      return next;
    });
  };

  const restablecerRecomendaciones = () => {
    setUsoTiposPlanificacion({});
    try {
      localStorage.removeItem(STORAGE_USO_TIPOS);
      guardarPreferenciaUsuario({ clave: STORAGE_USO_TIPOS, valor: {} }).catch(() => {
        // fallback local ya aplicado
      });
    } catch {
      // Si falla storage, mantenemos el estado en memoria.
    }
  };

  const diasClaseOpciones = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

  const obtenerConfiguracionTipo = (tipo) => {
    const base = {
      mostrarPeriodo: true,
      mostrarFechaInicio: true,
      mostrarSemanas: true,
      mostrarDiasClase: true,
    };

    if (tipo === "Plan Anual") {
      return {
        ...base,
        mostrarPeriodo: false,
        mostrarFechaInicio: false,
        mostrarSemanas: false,
      };
    }

    if (tipo === "Planificación por Período") {
      return {
        ...base,
        mostrarFechaInicio: false,
        mostrarDiasClase: false,
      };
    }

    if (tipo === "Planificación Semanal") {
      return {
        ...base,
        mostrarSemanas: false,
      };
    }

    if (tipo === "Planificación Diaria") {
      return {
        ...base,
        mostrarSemanas: false,
        mostrarDiasClase: false,
      };
    }

    if (tipo === "Situación de Aprendizaje") {
      return {
        ...base,
        mostrarFechaInicio: false,
      };
    }

    return base;
  };

  const configuracionTipo = obtenerConfiguracionTipo(tipoPlanificacion);

  // Competencias oficiales del currículo (Firestore) o fallback genérico
  const competencias =
    competenciasCurriculares.length > 0
      ? competenciasCurriculares.map((c) => c.descripcion)
      : [
          "Comunicación oral",
          "Comunicación escrita",
          "Pensamiento crítico",
          "Resolución de problemas",
          "Trabajo colaborativo",
          "Pensamiento creativo",
          "Aprendizaje autónomo",
        ];

  const parsearSemanas = useCallback((valor) => {
    const numero = parseInt(String(valor || "").match(/\d+/)?.[0] || "", 10);
    return Number.isFinite(numero) && numero > 0 ? numero : 0;
  }, []);

  // ── Regla de Combinación Curricular ─────────────────────────────────────────
  // Cuando tema o duración cambian, re-evalúa si se necesita integración curricular.
  // Resetea cualquier integración previa para forzar al docente a re-confirmar.
  useEffect(() => {
    if (!curriculoCompleto || !tema || !duracion) {
      setCombinacionSugerida(null);
      setTemasIntegrados([]);
      return;
    }
    const numSemanas = parsearSemanas(duracion);
    const { necesitaCombinacion, combinacionSugerida: sugerencia } =
      analizarCombinacionTematica(curriculoCompleto, tema, numSemanas);
    setCombinacionSugerida(necesitaCombinacion ? sugerencia : null);
    setTemasIntegrados([]);
  }, [tema, duracion, curriculoCompleto, parsearSemanas]);

  // Acepta la combinación principal o una alternativa elegida por el docente
  const manejarAceptarCombinacion = (combinacion) => {
    const elegida = combinacion?.temas ? combinacion : combinacionSugerida;
    if (!elegida) return;
    setTemasIntegrados(elegida.temas);
    setCombinacionSugerida(null);
    EventTracker.track(LEARNING_EVENTS.PLANIFICACION_ACEPTADA, {
      agentId: AGENT_IDS.PLANIFICADOR,
      area:       area ?? null,
      asignatura: asignatura ?? null,
      grado:      grado ?? null,
      tema:       tema ?? null,
      metadata:   { tipo: 'combinacion', combinacion: elegida.nombre ?? null }
    });
  };

  const manejarIgnorarCombinacion = () => {
    setCombinacionSugerida(null);
    // temasIntegrados stays [] — single-theme mode
  };

  /**
   * Maneja la generación de planificación
   */
  const manejarGenerar = async () => {
    setCargando(true);
    setMensaje({
      tipo: "loading",
      texto: "🔍 Verificando tema, grado y malla curricular antes de generar...",
    });

    try {
      const verificacionTema = await verificarTemaAntesDeGenerar({ tituloTema: tema, contexto: "generacion" });
      if (!verificacionTema?.permitido) {
        if (verificacionTema?.motivo === "tercer_tema_sin_credito") {
          setDialogoTema({
            abierto: true,
            payload: {
              ...verificacionTema,
              temaIngresado: tema,
            },
          });
          setCargando(false);
          return;
        }
        throw new Error(verificacionTema?.mensaje || "No se pudo validar el tema actual");
      }

      if (verificacionTema?.requiereCredito) {
        setDialogoTema({
          abierto: true,
          payload: {
            ...verificacionTema,
            temaIngresado: tema,
            mensaje:
              "Ya tienes dos temas activos. Puedes seguir editándolos sin límites. Para iniciar un nuevo tema debes usar un nuevo crédito de planificación o una suscripción compatible.",
            temas: {
              temaActivo: estadoTemas.temaActivo,
              temaSecundario: estadoTemas.temaSecundario,
              temaTercero: estadoTemas.temaTercero,
              temaCuarto: estadoTemas.temaCuarto,
            },
          },
        });
        setCargando(false);
        return;
      }

      await registrarUsoTemaPlanificacion({
        tituloTema: tema,
        forzarNuevoTema: false,
        contexto: "generacion",
      });

      const gradoData = grados.find((item) => item.grado === grado);
      const curso = [grado, seccion].filter(Boolean).join(" ").trim();
      const totalSemanas = configuracionTipo.mostrarSemanas
        ? parsearSemanas(duracion)
        : tipoPlanificacion === "Plan Anual"
          ? 40
          : 1;

      const diasActivos = configuracionTipo.mostrarDiasClase ? diasClase : [];
      const encuentrosSemana = diasActivos.length || 1;
      const encuentrosEstimados = totalSemanas * encuentrosSemana;
      const rangoInicial = encuentrosEstimados > 1
        ? `las clases 1 y ${Math.min(2, encuentrosEstimados)} de ${encuentrosEstimados}`
        : "la clase 1 de 1";
      setMensaje({
        tipo: "loading",
        texto: `✍️ Semana 1 de ${totalSemanas} — escribiendo ${rangoInicial} · Trabajando: ${tema?.trim() || "tema seleccionado"}`,
      });

      // Minutos reales: cada día puede tener 1 ó 2 períodos
      const minutosSemanales = diasActivos.length > 0
        ? diasActivos.reduce((acc, dia) => acc + (periodosClasePorDia[dia] || 1) * minutosHoraClase, 0)
        : minutosHoraClase;
      const tiempoTotalMinutos = totalSemanas * minutosSemanales;

      const datosValidados = {
        curso,
        grado,
        seccion,
        area,
        asignatura,
        periodo: configuracionTipo.mostrarPeriodo ? periodo : "",
        fechaInicio: configuracionTipo.mostrarFechaInicio ? fechaInicio : "",
        duracion: configuracionTipo.mostrarSemanas ? duracion : `${totalSemanas} semanas`,
        tema,
        competencia,
        indicadoresOficiales,
        imagenTematicaSrc,
        imagenTematicaNombre,
        tipoPlanificacion,
        diasClase: diasActivos,
        ejesTematicos,
        asignaturasVinculadas,
        situacionAprendizaje,
        minutosHoraClase,
        periodosClasePorDia,
        temasIntegrados,
        curriculoOficial: curriculoCompleto,
        competenciasCurriculares,
        nivelEducativo: gradoData?.nivel || "Primaria",
        jornadaTipo: gradoData?.nivel === "Secundaria" ? "Secundaria" : "Primaria",
        resumenHorario: {
          encuentrosPorSemana: encuentrosSemana,
          minutosPorHoraClase: minutosHoraClase,
          periodosClasePorDia,
          minutosSemanales,
          totalSemanas,
          encuentrosEstimados,
          tiempoTotalMinutos,
        },
      };

      // ── KE + BIC: flujo inteligente completo en segundo plano ───────────
      startGenerationJob({
        id: PLAN_JOB_ID,
        tipo: "planificacion",
        titulo: tema?.trim() || "Planificación inteligente",
        initialMessage: `✍️ Semana 1 de ${totalSemanas} — preparando ${rangoInicial} · Trabajando: ${tema?.trim() || "tema seleccionado"}`,
        run: async () => {
          const respuesta = await generarPlanificacionInteligente(datosValidados);
          return { ...respuesta, datosValidados };
        },
        onSuccess: (respuesta) => {
          if (respuesta?.resultado) guardarSesion("plan:resultado", respuesta.resultado);
        },
      });
      setMensaje({
        tipo: "loading",
        texto: "✍️ DocenteOS seguirá generando aunque cambies de módulo.",
      });
    } catch (error) {
      setMensaje({
        tipo: "error",
        texto: `❌ ${error.message}`
      });
      setCargando(false);
    }
  };

  /**
   * Guardado local temporal (sin Firebase por ahora)
   */
  const manejarGuardar = async () => {
    if (!planificacion) return;

    const temaParaControl = planificacion?.metadatos?.tema || tema;

    if (temaParaControl) {
      const verificacion = await verificarTemaAntesDeGenerar({ tituloTema: temaParaControl, contexto: "edicion" });
      if (!verificacion?.permitido) {
        setDialogoTema({
          abierto: true,
          contexto: "guardar",
          payload: {
            ...verificacion,
            temaIngresado: temaParaControl,
            temas: {
              temaActivo: estadoTemas.temaActivo,
              temaSecundario: estadoTemas.temaSecundario,
              temaTercero: estadoTemas.temaTercero,
              temaCuarto: estadoTemas.temaCuarto,
            },
          },
        });
        return;
      }
      if (verificacion?.requiereCredito) {
        setDialogoTema({
          abierto: true,
          contexto: "guardar",
          payload: {
            ...verificacion,
            temaIngresado: temaParaControl,
            temas: {
              temaActivo: estadoTemas.temaActivo,
              temaSecundario: estadoTemas.temaSecundario,
              temaTercero: estadoTemas.temaTercero,
              temaCuarto: estadoTemas.temaCuarto,
            },
          },
        });
        return;
      }
    }

    setGuardando(true);
    try {
      if (temaParaControl) {
        await registrarUsoTemaPlanificacion({
          tituloTema: temaParaControl,
          forzarNuevoTema: false,
          contexto: "edicion",
        });
      }
      // Hilo pedagógico: guarda el plan (siempre) + capa curricular + aspectos
      // del registro + instrumentos planeados (IDs deterministas — reemplaza
      // al bridge legacy que duplicaba instrumentos en cada guardado).
      const resultado = await guardarPlanificacionConHilo(planificacion);
      EventTracker.track(LEARNING_EVENTS.PLANIFICACION_ACEPTADA, {
        agentId: AGENT_IDS.PLANIFICADOR,
        area:       planificacion?.metadatos?.area ?? area ?? null,
        asignatura: asignatura ?? null,
        grado:      planificacion?.metadatos?.grado ?? grado ?? null,
        tema:       planificacion?.metadatos?.tema ?? tema ?? null,
        metadata:   { tipo: 'semanal' }
      });

      // Indexar en BIC en segundo plano solo si aún no está indexada
      if (bicFuente !== "indexado") {
        const meta  = planificacion.metadatos     ?? {};
        const datos = planificacion.datosGenerales ?? {};
        const gradoData = grados.find(g => g.grado === (meta.grado || grado));
        indexarEnBIC("planes", {
          nivel:       gradoData?.nivel ?? "Primaria",
          grado:       meta.grado       || grado,
          area:        meta.area        || area,
          asignatura,
          competencia: datos.competencia || competencia,
          indicadores: datos.indicadoresOficiales || [],
          tema:        meta.tema        || tema,
          tipo:        meta.tipoPlanificacion || tipoPlanificacion,
        }, planificacion).then(id => {
          if (id) { setBicId(id); setBicFuente("indexado"); }
        }).catch(() => {});
      }

      await cargarHistorial({ mostrarMensajeRecuperacion: false });
      const aspectosCreados = resultado.aspectos?.creados?.length || 0;
      const instrumentosCreados = resultado.instrumentos?.instrumentos?.length || 0;
      const advertencias = resultado.advertencias || [];
      const textoBase = resultado.mode === "firebase"
        ? "✅ Planificación guardada en Firebase"
        : "✅ Planificación guardada localmente";
      const textoAspectos = aspectosCreados > 0
        ? ` · ${aspectosCreados} aspecto(s) creados en Mi Registro`
        : "";
      const textoInstrumentos = instrumentosCreados > 0
        ? ` · ${instrumentosCreados} instrumento(s) borrador creados`
        : "";
      setMensaje({
        tipo: advertencias.length ? "warning" : "success",
        texto: advertencias.length
          ? `${textoBase}${textoAspectos}${textoInstrumentos} · ⚠️ ${advertencias[0]}`
          : `${textoBase}${textoAspectos}${textoInstrumentos}`,
      });
    } catch (error) {
      setMensaje({
        tipo: "error",
        texto: `❌ ${error.message || "Error al guardar planificación"}`,
      });
    } finally {
      setGuardando(false);
      setTimeout(() => setMensaje(null), 6000);
    }
  };


  const manejarCargarHistorial = (id) => {
    const encontrado = historialPlanificaciones.find((item) => String(item.id) === String(id));
    const contenido = encontrado?.contenido || encontrado;
    if (!contenido) return;
    cargarFormularioDesdeHistorial(contenido, { duplicar: false });
  };

  const manejarDuplicarHistorial = (id) => {
    const encontrado = historialPlanificaciones.find((item) => String(item.id) === String(id));
    const contenido = encontrado?.contenido || encontrado;
    if (!contenido) return;
    cargarFormularioDesdeHistorial(contenido, { duplicar: true });
  };

  const manejarEliminarHistorial = async (id) => {
    const encontrado = historialPlanificaciones.find((item) => String(item.id) === String(id));
    if (!encontrado) return;
    const meta = (encontrado?.contenido || encontrado)?.metadatos || {};
    const gradoSeccion = [meta.grado, meta.seccion].filter(Boolean).join(" ").trim() || encontrado?.curso || "Curso";
    const areaActual = meta.area || encontrado?.area || "Área";
    const etiqueta = `${gradoSeccion} - ${areaActual}`;

    const confirmar = await new Promise((resolve) => {
      confirmResolveRef.current = resolve;
      setConfirmMensaje(`¿Deseas eliminar esta planificación del historial?\n\n${etiqueta}`);
    });
    if (!confirmar) return;

    setEliminando(true);

    try {
      const resultadoEliminacion = await eliminarPlanificacionDetallada(id);
      await cargarHistorial({ mostrarMensajeRecuperacion: false });

      setMensaje({
        tipo: "success",
        texto: resultadoEliminacion.mode === "firebase"
          ? "🗑️ Planificación eliminada de Firebase"
          : "🗑️ Planificación eliminada del historial local",
      });
    } catch (error) {
      setMensaje({
        tipo: "error",
        texto: `❌ ${error.message || "No se pudo eliminar la planificación"}`,
      });
    } finally {
      setEliminando(false);
      setTimeout(() => setMensaje(null), 2500);
    }
  };

  /**
   * Maneja la descarga de PDF
   */
  const manejarDescargar = () => {
    if (!planificacion) return;

    try {
      const contenidoHtml = formatearParaPDFHtml(planificacion);
      const ventanaImpresion = window.open("", "_blank", "noopener,noreferrer");

      if (!ventanaImpresion) {
        throw new Error("Habilita ventanas emergentes para exportar a PDF");
      }

      ventanaImpresion.document.open();
      ventanaImpresion.document.write(contenidoHtml);
      ventanaImpresion.document.close();
      ventanaImpresion.focus();

      const temaParaMetricas = planificacion?.metadatos?.tema || tema;
      if (temaParaMetricas) {
        registrarUsoPDFTema({ tituloTema: temaParaMetricas }).catch(() => {
          // No bloquear exportación por métricas.
        });
      }

      setMensaje({
        tipo: "success",
        texto: "✅ Documento listo para guardar en PDF"
      });
      setTimeout(() => setMensaje(null), 2000);
    } catch (error) {
      setMensaje({
        tipo: "error",
        texto: `❌ ${error.message || "Error al exportar PDF"}`
      });
    }
  };

  const manejarDialogoTemaCancelar = () => {
    setDialogoTema({ abierto: false, payload: null, contexto: "planificacion" });
  };

  const manejarDialogoTemaSeguirEditando = () => {
    setDialogoTema({ abierto: false, payload: null, contexto: "planificacion" });
    setMensaje({
      tipo: "info",
      texto: "Puedes seguir editando tu Tema Activo o Tema Secundario sin límites.",
    });
    setTimeout(() => setMensaje(null), 3000);
  };

  const manejarComprarCreditos = () => {
    setDialogoTema({ abierto: false, payload: null, contexto: "planificacion" });
    setMensaje({
      tipo: "warning",
      texto: "No tienes créditos disponibles para iniciar otro tema. Compra un crédito o reutiliza una planificación guardada.",
    });
    window.dispatchEvent(new CustomEvent("irA", { detail: "suscripcion" }));
    setTimeout(() => setMensaje(null), 7000);
  };

  const manejarDialogoTemaUsarCredito = async () => {
    const temaIngresado = dialogoTema?.payload?.temaIngresado;
    const contextoDialogo = dialogoTema?.contexto || "planificacion";
    const creditosDisponibles = Number(dialogoTema?.payload?.creditosDisponibles || 0);
    if (!temaIngresado) {
      setDialogoTema({ abierto: false, payload: null, contexto: "planificacion" });
      return;
    }
    if (creditosDisponibles <= 0) {
      manejarComprarCreditos();
      return;
    }

    setDialogoTema({ abierto: false, payload: null, contexto: "planificacion" });

    // Para diario/unidad: registrar crédito y generar sin el flujo de planificación semanal
    if (contextoDialogo === "diario") {
      await manejarGenerarDiarioForzado(temaIngresado);
      return;
    }

    if (contextoDialogo === "unidad") {
      await manejarGenerarUnidadForzado(temaIngresado);
      return;
    }

    if (contextoDialogo === "guardar") {
      setGuardando(true);
      try {
        await registrarUsoTemaPlanificacion({ tituloTema: temaIngresado, forzarNuevoTema: true, contexto: "edicion" });
        const resultado = await guardarPlanificacionConHilo(planificacion);
        await cargarHistorial({ mostrarMensajeRecuperacion: false });
        const advertencia = resultado.advertencias?.[0];
        setMensaje({
          tipo: advertencia ? "warning" : "success",
          texto: `${resultado.mode === "firebase" ? "✅ Guardado en Firebase" : "✅ Guardado localmente"}${advertencia ? ` · ⚠️ ${advertencia}` : ""}`,
        });
        setTimeout(() => setMensaje(null), 6000);
      } catch (error) {
        setMensaje({ tipo: "error", texto: `❌ ${error.message}` });
        setTimeout(() => setMensaje(null), 3000);
      } finally {
        setGuardando(false);
      }
      return;
    }

    // contexto: "planificacion" (flujo original)
    setCargando(true);
    setMensaje(null);

    try {
      await registrarUsoTemaPlanificacion({
        tituloTema: temaIngresado,
        forzarNuevoTema: true,
        contexto: "generacion",
      });

      const gradoData = grados.find((item) => item.grado === grado);
      const curso = [grado, seccion].filter(Boolean).join(" ").trim();
      const totalSemanas = configuracionTipo.mostrarSemanas
        ? parsearSemanas(duracion)
        : tipoPlanificacion === "Plan Anual"
          ? 40
          : 1;

      const diasActivos = configuracionTipo.mostrarDiasClase ? diasClase : [];
      const encuentrosSemana = diasActivos.length || 1;
      const encuentrosEstimados = totalSemanas * encuentrosSemana;

      const minutosSemanales = diasActivos.length > 0
        ? diasActivos.reduce((acc, dia) => acc + (periodosClasePorDia[dia] || 1) * minutosHoraClase, 0)
        : minutosHoraClase;
      const tiempoTotalMinutos = totalSemanas * minutosSemanales;

      const datosValidados = {
        curso,
        grado,
        seccion,
        area,
        asignatura,
        periodo: configuracionTipo.mostrarPeriodo ? periodo : "",
        fechaInicio: configuracionTipo.mostrarFechaInicio ? fechaInicio : "",
        duracion: configuracionTipo.mostrarSemanas ? duracion : `${totalSemanas} semanas`,
        tema,
        competencia,
        indicadoresOficiales,
        imagenTematicaSrc,
        imagenTematicaNombre,
        tipoPlanificacion,
        diasClase: diasActivos,
        ejesTematicos,
        asignaturasVinculadas,
        situacionAprendizaje,
        minutosHoraClase,
        periodosClasePorDia,
        temasIntegrados,
        curriculoOficial: curriculoCompleto,
        competenciasCurriculares,
        nivelEducativo: gradoData?.nivel || "Primaria",
        jornadaTipo: gradoData?.nivel === "Secundaria" ? "Secundaria" : "Primaria",
        resumenHorario: {
          encuentrosPorSemana: encuentrosSemana,
          minutosPorHoraClase: minutosHoraClase,
          periodosClasePorDia,
          minutosSemanales,
          totalSemanas,
          encuentrosEstimados,
          tiempoTotalMinutos,
        },
      };

      startGenerationJob({
        id: PLAN_JOB_ID,
        tipo: "planificacion",
        titulo: temaIngresado || tema || "Planificación inteligente",
        initialMessage: `✍️ Generando nuevo tema: ${temaIngresado || tema || "tema seleccionado"}`,
        run: async () => {
          const respuesta = await generarPlanificacionInteligente(datosValidados);
          return { ...respuesta, datosValidados };
        },
        onSuccess: (respuesta) => {
          if (respuesta?.resultado) guardarSesion("plan:resultado", respuesta.resultado);
        },
      });
      setMensaje({
        tipo: "loading",
        texto: "✍️ DocenteOS seguirá generando aunque cambies de módulo.",
      });
    } catch (error) {
      setMensaje({
        tipo: "error",
        texto: `❌ ${error.message || "No fue posible crear el nuevo tema"}`,
      });
      setCargando(false);
    }
  };

  const manejarSeleccionImagenTematica = async (archivo) => {
    if (!archivo) {
      setImagenTematicaSrc("");
      setImagenTematicaNombre("");
      return;
    }
    setImagenSubiendo(true);
    try {
      const uid = user?.uid;
      const url = uid ? await subirImagenPlanificacion(uid, archivo) : null;
      if (url) {
        setImagenTematicaSrc(url);
      } else {
        // Fallback local si Storage no está disponible
        const lector = new FileReader();
        lector.onload = () => {
          setImagenTematicaSrc(typeof lector.result === "string" ? lector.result : "");
        };
        lector.readAsDataURL(archivo);
      }
      setImagenTematicaNombre(archivo.name || "imagen-tematica");
    } catch {
      // Fallback a base64 si falla la subida
      const lector = new FileReader();
      lector.onload = () => {
        setImagenTematicaSrc(typeof lector.result === "string" ? lector.result : "");
      };
      lector.readAsDataURL(archivo);
      setImagenTematicaNombre(archivo.name || "imagen-tematica");
    } finally {
      setImagenSubiendo(false);
    }
  };

  const limpiarImagenTematica = () => {
    setImagenTematicaSrc("");
    setImagenTematicaNombre("");
  };

  const ejecutarAccionIA = async (accion, opciones = {}) => {
    if (!planificacion) return;
    setIaAccion(accion);
    setIaTexto("");
    setIaError(null);
    setIaGenerando(true);

    const meta    = planificacion.metadatos       || {};
    const datos   = planificacion.datosGenerales  || {};
    const semanas = planificacion.desarrolloSemanal || [];

    const temaActual        = meta.tema        || datos.tema        || "";
    const areaActual        = meta.area        || datos.area        || "";
    const gradoActual       = meta.grado       || "";
    const competenciaActual = datos.competencia || meta.competenciaSeleccionada || "";
    const indicadoresActual = datos.indicadoresOficiales || [];
    const tipoPlan          = meta.tipoPlanificacion || "";
    const duracionActual    = meta.duracion    || "";
    const minClase          = meta.minutosHoraClase || minutosHoraClase || 50;

    // ── Auditoría → usa ContextBuilder (mínimo necesario) ──────────────────
    if (accion === "mejorar" || accion === "corregir") {
      const ctxAction = accion === "corregir" ? "auditar_planificacion" : "auditar_planificacion";

      // Para "mejorar" reusamos auditar pero con prompt de sugerencias
      const ctx = await buildAIContext("auditar_planificacion", {
        grado: gradoActual,
        area: areaActual,
        tema: temaActual,
        competencia: competenciaActual,
        indicadores: indicadoresActual,
        semanas,
        tipo: tipoPlan,
        periodo: meta.periodo || "",
      });

      const systemMejorar = accion === "mejorar"
        ? "Eres DocenteOS, asistente pedagógico del MINERD. Identifica fortalezas y sugiere mejoras pedagógicas concretas. Usa ## para secciones. Responde en español."
        : "Eres DocenteOS, experto auditor pedagógico del MINERD. Identifica problemas de coherencia curricular y proporciona correcciones precisas. Usa ## para secciones. Responde en español.";

      const extraPrompt = accion === "mejorar"
        ? "\n\n## Fortalezas identificadas\n## Áreas de mejora\n## Sugerencias por semana\n## Recursos adicionales\n## Evaluación formativa sugerida"
        : "\n\n## Verificación de coherencia curricular\n## Correcciones necesarias\n## Alineación competencia–indicadores–actividades\n## Ajustes recomendados por semana";

      AIService.generate({
        module: "planificacion-ia",
        prompt: ctx.prompt + extraPrompt,
        system: systemMejorar,
        maxTokens: 2000,
        _contextMeta: ctx.meta,
        onChunk: (chunk) => {
          setIaTexto((prev) => prev + chunk);
          setTimeout(() => iaRef.current?.scrollTo({ top: iaRef.current.scrollHeight, behavior: "smooth" }), 50);
        },
        onFinish: () => {
          setIaGenerando(false);
          EventTracker.track(LEARNING_EVENTS.MEJORA_ACEPTADA, {
            agentId: AGENT_IDS.AUDITOR,
            area:       areaActual ?? null,
            asignatura: areaActual ?? null,
            grado:      gradoActual ?? null,
            tema:       temaActual ?? null,
            metadata:   { accion }
          });
        },
        onError:  (err) => { setIaError(err); setIaGenerando(false); },
      });
      return;
    }

    // ── Regenerar actividades → mejorar_actividades con contexto semana 1 ──
    if (accion === "regenerar-actividades") {
      // Enviar semanas resumidas (solo títulos) — sin JSON completo
      const actividadesResumen = semanas.slice(0, 6).flatMap((sem, si) =>
        (sem.actividades || []).slice(0, 3).map((a) => `[S${si + 1}] ${a.titulo || a.nombre || "Actividad"}`)
      );

      const ctx = await buildAIContext("mejorar_actividades", {
        grado: gradoActual,
        asignatura: areaActual,
        tema: temaActual,
        fase: "Todas las fases",
        semana: `1 a ${semanas.length}`,
        dia: "Todos los días",
        momento: "Todos los momentos",
        tiempo: `${minClase} min por clase`,
        intencionPedagogica: competenciaActual,
        actividades: actividadesResumen,
        sugerencia: `Genera actividades NUEVAS y diferentes para las ${semanas.length} semanas. Más dinámicas y contextualizadas para República Dominicana.`,
      });

      AIService.generate({
        module: "planificacion-ia",
        prompt: ctx.prompt,
        system: ctx.system,
        maxTokens: 2500,
        _contextMeta: ctx.meta,
        onChunk: (chunk) => {
          setIaTexto((prev) => prev + chunk);
          setTimeout(() => iaRef.current?.scrollTo({ top: iaRef.current.scrollHeight, behavior: "smooth" }), 50);
        },
        onFinish: () => {
          setIaGenerando(false);
          EventTracker.track(LEARNING_EVENTS.PLANIFICACION_REGENERADA, {
            agentId: AGENT_IDS.PLANIFICADOR,
            area:       areaActual ?? null,
            asignatura: areaActual ?? null,
            grado:      gradoActual ?? null,
            tema:       temaActual ?? null,
            metadata:   { accion: 'regenerar-actividades' }
          });
        },
        onError:  (err) => { setIaError(err); setIaGenerando(false); },
      });
      return;
    }

    // ── NEAE y adaptar-tiempo → prompts específicos compactos ──────────────
    const semanasCompacto = semanas.slice(0, 6).map((sem, i) => {
      const acts = (sem.actividades || []).slice(0, 3)
        .map((a) => `  · ${a.titulo || a.nombre || "Actividad"}`)
        .join("\n");
      return `Semana ${i + 1}:\n${acts || "  Sin actividades"}`;
    }).join("\n\n");

    const baseCtx = `Tema: ${temaActual} | Área: ${areaActual} | Grado: ${gradoActual}\n\nActividades actuales:\n${semanasCompacto}`;

    const referenciaAdecuaciones = getReferenciaAdecuacionesCurriculares();

    const PROMPTS_EXTRA = {
      neae: `${baseCtx}

Genera adecuaciones curriculares NEAE para este contenido:

Referencia oficial actualizada: ${referenciaAdecuaciones}

Organiza la respuesta en adecuaciones de acceso, metodológicas y de evaluación. Mantén el referente curricular del grado siempre que sea posible y prioriza aprendizajes esenciales cuando existan barreras significativas.

## Discapacidad visual
## Discapacidad auditiva
## Discapacidad intelectual
## Dificultades de aprendizaje (dislexia, TDAH, discalculia)
## Altas capacidades`,

      "adaptar-tiempo": `${baseCtx}

Las actividades están planificadas para ${minClase} min. Adapta para clases de ${opciones.minutos || iaMinutos} min.

## Ajuste de tiempos por semana
## Actividades a eliminar o acortar
## Extensiones si sobra tiempo
## Consideraciones pedagógicas`,
    };

    const system = "Eres DocenteOS, asistente pedagógico MINERD. Responde en español con ## para secciones y listas con -.";

    AIService.generate({
      module: "planificacion-ia",
      prompt:  PROMPTS_EXTRA[accion] || PROMPTS_EXTRA.neae,
      system,
      maxTokens: 2000,
      onChunk:  (chunk) => {
        setIaTexto((prev) => prev + chunk);
        setTimeout(() => iaRef.current?.scrollTo({ top: iaRef.current.scrollHeight, behavior: "smooth" }), 50);
      },
      onFinish: () => {
        setIaGenerando(false);
        EventTracker.track(LEARNING_EVENTS.ACTIVIDAD_MODIFICADA, {
          agentId:    AGENT_IDS.MEJORADOR_ACTIVIDADES,
          area:       areaActual  ?? null,
          asignatura: areaActual  ?? null,
          grado:      gradoActual ?? null,
          tema:       temaActual  ?? null,
          metadata:   { accion },
        });
      },
      onError:  (err) => { setIaError(err); setIaGenerando(false); },
    });
  };

  // ── BIC handlers ─────────────────────────────────────────────────────────

  const manejarBICReutilizar = () => {
    const candidato = bicBanner.candidato;
    if (!candidato?.contenido) { setBicBanner({ abierto: false }); return; }
    setPlanificacion(candidato.contenido);
    setBicFuente("reutilizado");
    setBicId(candidato.id);
    setBicBanner({ abierto: false });
    bicRegistrarUso("planes", candidato.id).catch(() => {});
    setTimeout(() => document.querySelector(".resultado")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  const manejarBICAdaptar = async () => {
    const candidato = bicBanner.candidato;
    if (!candidato) return;
    setBicAdaptando(true);
    setBicBanner({ abierto: false });
    try {
      const adaptado = await bicAdaptar(candidato, { grado, area, tema, competencia });
      setPlanificacion({ ...(candidato.contenido ?? {}), ...(adaptado ?? {}) });
      setBicFuente("adaptado");
      setBicId(candidato.id);
      setTimeout(() => document.querySelector(".resultado")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch {
      manejarBICGenerarDesde();
    } finally {
      setBicAdaptando(false);
    }
  };

  const manejarBICGenerarDesde = async () => {
    setBicBanner({ abierto: false });
    if (!bicDatosValidados) return;
    setCargando(true);
    try {
      const resultado = await generarPlanificacion(bicDatosValidados);
      setPlanificacion(resultado);
      setBicFuente("generado");
      setBicId(null);
      setTimeout(() => document.querySelector(".resultado")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (error) {
      setMensaje({ tipo: "error", texto: `❌ ${error.message}` });
    } finally {
      setCargando(false);
    }
  };

  const manejarBICGuardar = async () => {
    if (!planificacion || bicFuente !== "generado") return;
    const meta  = planificacion.metadatos     ?? {};
    const datos = planificacion.datosGenerales ?? {};
    const gradoData = grados.find(g => g.grado === (meta.grado || grado));
    const id = await indexarEnBIC("planes", {
      nivel:       gradoData?.nivel ?? "Primaria",
      grado:       meta.grado       || grado,
      area:        meta.area        || area,
      asignatura,
      competencia: datos.competencia || competencia,
      indicadores: datos.indicadoresOficiales || [],
      tema:        meta.tema        || tema,
      tipo:        meta.tipoPlanificacion || tipoPlanificacion,
    }, planificacion).catch(() => null);
    if (id) {
      setBicId(id);
      setBicFuente("indexado");
      setMensaje({ tipo: "success", texto: "✅ Guardado en el Banco Pedagógico" });
      setTimeout(() => setMensaje(null), 3000);
    }
  };

  // ── Handlers: Entrenar IA ─────────────────────────────────────────────────

  const flashEntrenar = (texto, tipo = "success") => {
    setMensajeEntrenar({ texto, tipo });
    setTimeout(() => setMensajeEntrenar(null), 3500);
  };

  const manejarGuardarEstilo = async () => {
    if (!planificacion) return;
    setGuardandoEstilo(true);
    try {
      const meta  = planificacion.metadatos    || {};
      const datos = planificacion.datosGenerales || {};
      const temaActual = meta.tema || tema || "Sin tema";
      const areaActual = meta.area || area || "";
      const gradoActual = meta.grado || grado || "";

      // Serializar planificacion a texto para que IA extraiga el estilo
      const lineas = [
        `TEMA: ${temaActual}`,
        `ÁREA: ${areaActual}`,
        `GRADO: ${gradoActual}`,
        `COMPETENCIA: ${datos.competencia || ""}`,
        "",
        ...((planificacion.desarrolloSemanal || []).slice(0, 4).flatMap((sem, i) => [
          `SEMANA ${i + 1} (${sem.fase || ""})`,
          ...(sem.actividades || []).slice(0, 3).map(a =>
            `  [${a.momento || ""}] ${a.titulo || a.nombre || "Actividad"}`
          ),
        ])),
      ];

      await extractStyle(lineas.join("\n"), {
        nombre:       `${temaActual} — ${areaActual} — ${gradoActual}`,
        asignatura:   areaActual,
        grado:        gradoActual,
        temaOriginal: temaActual,
      });

      flashEntrenar("Estilo guardado correctamente.");
    } catch (err) {
      flashEntrenar(`Error al guardar estilo: ${err.message}`, "error");
    } finally {
      setGuardandoEstilo(false);
    }
  };

  const manejarConvertirCasoExito = async () => {
    if (!planificacion) return;
    setGuardandoCasoExito(true);
    try {
      await crearCasoExito({
        planificacion,
        planificacionId: bicId ?? null,
        topicId:         null,
        calificacion:    null,
      });
      flashEntrenar("Enviado para revisión. El administrador lo aprobará.");
    } catch (err) {
      flashEntrenar(`Error al convertir: ${err.message}`, "error");
    } finally {
      setGuardandoCasoExito(false);
    }
  };

  /**
   * Maneja la creación de nueva planificación
   */
  const manejarNueva = () => {
    clearGenerationJob(PLAN_JOB_ID);
    setGrado("");
    setSeccion("");
    setArea("");
    setPeriodo("");
    setFechaInicio(hoyISO);
    setDuracion("");
    setTipoPlanificacion("");
    setDiasClase(["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"]);
    setTema("");
    setCompetencia("");
    setIndicadoresOficiales("");
    setImagenTematicaSrc("");
    setImagenTematicaNombre("");
    setEjesTematicos([]);
    setAsignaturasVinculadas("");
    setSituacionAprendizaje("");
    setMinutosHoraClase(45);
    setPeriodosClasePorDia({});
    setCombinacionSugerida(null);
    setTemasIntegrados([]);
    setPlanificacion(null);
    setMensaje(null);

    // Scroll al formulario
    document.querySelector(".planning-form-card")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  };

  const progresoGeneracionActivo =
    cargandoDiario && mensajeDiario?.tipo === "loading" ? mensajeDiario.texto :
    cargandoUnidad && mensajeUnidad?.tipo === "loading" ? mensajeUnidad.texto :
    cargando && mensaje?.tipo === "loading" ? mensaje.texto :
    "";

  const temasDialogoActivos = dialogoTema?.payload?.temas
    ? [
        dialogoTema.payload.temas.temaActivo,
        dialogoTema.payload.temas.temaSecundario,
        dialogoTema.payload.temas.temaTercero,
        dialogoTema.payload.temas.temaCuarto,
      ].filter(Boolean)
    : [];
  const esBloqueoTemaRepetido = dialogoTema?.payload?.motivo === "tema_repetido_reusar_banco";
  const creditosDialogo = Number(dialogoTema?.payload?.creditosDisponibles || 0);
  const puedeUsarCreditoDialogo = dialogoTema?.payload?.puedeCrearNuevoTema !== false && creditosDialogo > 0;
  const tituloDialogoTema = esBloqueoTemaRepetido
    ? "Tema ya generado"
    : temasDialogoActivos.length >= 4
      ? "Ya tienes cuatro temas activos"
      : "Ya tienes dos temas activos";

  return (
    <>
      <h1>✨ Planificación Inteligente</h1>
      <p style={{ color: "#64748b", marginBottom: "24px" }}>
        Genera planificaciones didácticas completas con IA en segundos
      </p>

      {dialogoTema.abierto && (
        <div className="tema-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="tema-modal-titulo">
          <div className="tema-modal">
            <h2 id="tema-modal-titulo">{textoUI(tituloDialogoTema, "Tema en uso")}</h2>
            <p>
              {dialogoTema?.payload?.mensaje || "Puedes seguir editándolos sin límites. Para iniciar un nuevo tema debes usar un nuevo crédito de planificación o disponer de una suscripción que lo permita."}
            </p>
            <div className="tema-modal-temas">
              {temasDialogoActivos.length ? temasDialogoActivos.map((temaItem, index) => (
                  <span key={`${textoUI(temaItem?.titulo, "tema")}-${index}`}>
                    <strong>Tema {index + 1}:</strong> {textoUI(temaItem?.titulo, "No definido")}
                  </span>
              )) : (
                <>
                  <span><strong>Tema 1:</strong> {textoUI(dialogoTema?.payload?.temas?.temaActivo?.titulo, "No definido")}</span>
                  <span><strong>Tema 2:</strong> {textoUI(dialogoTema?.payload?.temas?.temaSecundario?.titulo, "No definido")}</span>
                </>
              )}
              <span className="tema-modal-creditos">
                Créditos disponibles: <strong>{Number(dialogoTema?.payload?.creditosDisponibles || 0)}</strong>
              </span>
            </div>
            <div className="tema-modal-acciones">
              <button type="button" className="tema-modal-btn-seguir" onClick={manejarDialogoTemaSeguirEditando}>
                Seguir editando
              </button>
              <button type="button" className="tema-modal-btn-cancelar" onClick={manejarDialogoTemaCancelar}>
                Cancelar
              </button>
              {!esBloqueoTemaRepetido && (
                <button
                  type="button"
                  className="tema-modal-btn-credito"
                  onClick={puedeUsarCreditoDialogo ? manejarDialogoTemaUsarCredito : manejarComprarCreditos}
                >
                  {puedeUsarCreditoDialogo ? "Usar 1 crédito" : "Comprar créditos"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="planning-container">
        {progresoGeneracionActivo && (
          <div className="generation-progress-banner generation-progress-banner--sticky" role="status" aria-live="polite">
            <span className="generation-progress-dot" />
            <div className="generation-progress-copy">
              <span>DocenteOS está trabajando</span>
              <strong>{textoUI(progresoGeneracionActivo)}</strong>
            </div>
          </div>
        )}

        {materialPlanificacion && (
          <section className="planning-resource-card">
            <div>
              <span className="planning-resource-label">Recurso activo</span>
              <h2>{textoUI(materialPlanificacion.titulo, "Material seleccionado")}</h2>
              <p>
                {[materialPlanificacion.nivel, materialPlanificacion.grado, materialPlanificacion.asignatura]
                  .map((item) => textoUI(item))
                  .filter(Boolean)
                  .join(" · ") || "Libro Abierto MINERD"}
              </p>
            </div>
            <div className="planning-resource-actions">
              <a
                href={materialPlanificacion.archivoUrl || materialPlanificacion.origen}
                target="_blank"
                rel="noreferrer"
              >
                Ver libro
              </a>
              <button type="button" onClick={quitarMaterialPlanificacion}>
                Quitar
              </button>
            </div>
          </section>
        )}

        <section className="planning-type-card">
          <div className="planning-type-head">
            <h2>🧭 TIPO DE PLANIFICACIÓN</h2>
            <button
              type="button"
              className="planning-type-reset-btn"
              onClick={restablecerRecomendaciones}
            >
              Restablecer recomendaciones
            </button>
          </div>
          <p>Selecciona primero el formato MINERD para cargar el formulario correspondiente.</p>
          <div className="planning-type-grid">
            {tiposPlanificacion.map((tipo) => {
              const activo = tipoPlanificacion === tipo.value;
              const recomendado = tiposRecomendados.includes(tipo.value);
              return (
                <button
                  key={tipo.value}
                  type="button"
                  className={`planning-type-option tone-${tipo.tono} ${activo ? "active" : ""} ${recomendado ? "recommended" : ""}`}
                  onClick={() => seleccionarTipoPlanificacion(tipo.value)}
                  aria-pressed={activo}
                >
                  {recomendado ? <span className="planning-type-badge">Recomendado</span> : null}
                  <span className="planning-type-icon" aria-hidden="true">{tipo.icono}</span>
                  <span className="planning-type-text">
                    <strong>{tipo.value}</strong>
                    <small>{tipo.descripcion}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="planning-history-card">
          <h2>Planificaciones guardadas</h2>
          <p>
            Mostramos tus últimas 3 planificaciones. Las demás permanecen guardadas para aprendizaje,
            recuperación interna y mejora del sistema.
          </p>

          {historialVisibleDocente.length > 0 ? (
            <div className="history-cards">
              {historialVisibleDocente.map((item) => {
                const contenido = item?.contenido || item;
                const meta = contenido?.metadatos || {};
                const titulo = textoUI(meta.tema || meta.titulo || item.tema, "Planificación sin tema");
                const cursoResumen = [meta.grado, meta.seccion].map((v) => textoUI(v)).filter(Boolean).join(" ").trim() || textoUI(item.curso, "Curso");
                const areaResumen = textoUI(meta.area || item.area, "Área");
                const tipoResumen = textoUI(meta.tipoPlanificacion || contenido?.tipoPlanificacion, "Planificación");
                const fechaResumen = formatearFechaRegistro(item.createdAt || item.fecha || meta.fechaGeneracion);

                return (
                  <article key={item.id} className="history-item-card">
                    <div className="history-item-head">
                      <strong>{titulo}</strong>
                      <span>{fechaResumen}</span>
                    </div>
                    <div className="history-item-meta">
                      <span>{cursoResumen}</span>
                      <span>{areaResumen}</span>
                      <span>{tipoResumen}</span>
                    </div>
                    <div className="history-item-actions">
                      <button type="button" onClick={() => manejarCargarHistorial(item.id)}>
                        Cargar
                      </button>
                      <button type="button" onClick={() => manejarDuplicarHistorial(item.id)}>
                        Duplicar
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => manejarEliminarHistorial(item.id)}
                        disabled={eliminando}
                      >
                        Eliminar
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="history-empty">Aún no tienes planificaciones guardadas.</p>
          )}
        </section>

        {tipoPlanificacion === "Planificación Diaria" ? (
          <FormularioPlanDiario
            datos={planDiarioDatos}
            onChange={setPlanDiarioDatos}
            onGenerar={manejarGenerarDiario}
            cargando={cargandoDiario}
          />
        ) : (tipoPlanificacion === "Unidad de Aprendizaje" || tipoPlanificacion === "Secuencia Didáctica") ? (
          <FormularioUnidadAprendizaje
            datos={unidadDatos}
            onChange={setUnidadDatos}
            onGenerar={manejarGenerarUnidad}
            cargando={cargandoUnidad}
            temasTrabajados={temasTrabajados}
          />
        ) : tipoPlanificacion ? (
          <FormularioPlanificacion
            tipoPlanificacion={tipoPlanificacion}
            configuracionTipo={configuracionTipo}
            grado={grado}
            setGrado={setGrado}
            seccion={seccion}
            setSeccion={setSeccion}
            area={area}
            setArea={setArea}
            periodo={periodo}
            setPeriodo={setPeriodo}
            fechaInicio={fechaInicio}
            setFechaInicio={setFechaInicio}
            duracion={duracion}
            setDuracion={setDuracion}
            diasClase={diasClase}
            setDiasClase={setDiasClase}
            tema={tema}
            setTema={setTema}
            competencia={competencia}
            setCompetencia={setCompetencia}
            indicadoresOficiales={indicadoresOficiales}
            setIndicadoresOficiales={setIndicadoresOficiales}
            imagenTematicaNombre={imagenTematicaNombre}
            imagenSubiendo={imagenSubiendo}
            onSeleccionarImagenTematica={manejarSeleccionImagenTematica}
            onLimpiarImagenTematica={limpiarImagenTematica}
            onGenerar={manejarGenerar}
            cargando={cargando}
            grados={grados}
            secciones={secciones}
            areas={areas}
            asignatura={asignatura}
            setAsignatura={setAsignatura}
            periodos={periodos}
            duraciones={duraciones}
            diasClaseOpciones={diasClaseOpciones}
            competencias={competencias}
            competenciasCurriculares={competenciasCurriculares}
            tieneCurriculoOficial={tieneCurriculoOficial}
            cargandoCurriculo={cargandoCurriculo}
            temasCurriculares={temasCurriculares}
            combinacionSugerida={combinacionSugerida}
            onAceptarCombinacion={manejarAceptarCombinacion}
            onIgnorarCombinacion={manejarIgnorarCombinacion}
            temasIntegrados={temasIntegrados}
            temasTrabajados={temasTrabajados}
            ejesTematicos={ejesTematicos}
            setEjesTematicos={setEjesTematicos}
            asignaturasVinculadas={asignaturasVinculadas}
            setAsignaturasVinculadas={setAsignaturasVinculadas}
            situacionAprendizaje={situacionAprendizaje}
            setSituacionAprendizaje={setSituacionAprendizaje}
            minutosHoraClase={minutosHoraClase}
            setMinutosHoraClase={setMinutosHoraClase}
            periodosClasePorDia={periodosClasePorDia}
            setPeriodosClasePorDia={setPeriodosClasePorDia}
          />
        ) : (
          <section className="planning-form-card">
            <h2>Selecciona el tipo de planificación para comenzar</h2>
            <p style={{ color: "#64748b", margin: 0 }}>
              El formulario se adapta automáticamente al formato seleccionado.
            </p>
          </section>
        )}

        {/* Resultado según tipo */}
        {tipoPlanificacion === "Planificación Diaria" ? (
          <ResultadoPlanDiario
            plan={planDiario}
            onGuardar={manejarGuardarDiario}
            onDescargar={manejarDescargarDiario}
            onNueva={manejarNuevoDiario}
            guardando={guardandoDiario}
            mensaje={mensajeDiario}
            onIrAModoAula={() => onIrA?.('modo-aula')}
          />
        ) : ES_TIPO_UNIDAD(tipoPlanificacion) ? (
          <>
            {/* Mensaje de error visible incluso antes de generar */}
            {mensajeUnidad && mensajeUnidad.tipo !== "loading" && !unidad && (
              <div className={`mensaje ${mensajeUnidad.tipo}`} style={{ marginTop: 0 }}>
                {mensajeUnidad.texto}
              </div>
            )}
            <ResultadoUnidadAprendizaje
              unidad={unidad}
              onGuardar={manejarGuardarUnidad}
              onDescargar={manejarDescargarUnidad}
              onVer={manejarVerUnidad}
              onNueva={manejarNuevaUnidad}
              onAplicarAcciones={manejarAplicarAcciones}
              onEditarUnidad={setUnidad}
              guardando={guardandoUnidad}
              mensaje={mensajeUnidad}
              onIrAModoAula={() => onIrA?.('modo-aula')}
            />
          </>
        ) : (
          /* Resultado Plan Semanal / resto */
          <>
            {bicBanner.abierto && (
              <div className="bic-banner" role="dialog" aria-live="polite">
                <div className="bic-banner-icon">
                  {bicBanner.nivel === 1 ? "✅" : "🔄"}
                </div>
                <div className="bic-banner-body">
                  <p className="bic-banner-titulo">
                    {bicBanner.nivel === 1
                      ? "Encontré una planificación casi idéntica en el Banco Pedagógico"
                      : "Encontré una planificación similar en el Banco Pedagógico"}
                  </p>
                  <p className="bic-banner-sub">
                    {bicBanner.candidato?.area ?? area} · {bicBanner.candidato?.grado ?? grado}
                    {" "}
                    <span className="bic-score-badge">
                      {Math.round((bicBanner.score ?? 0) * 100)}% similitud
                    </span>
                  </p>
                </div>
                <div className="bic-banner-acciones">
                  {bicBanner.nivel === 1 ? (
                    <>
                      <button type="button" className="bic-btn-primary" onClick={manejarBICReutilizar}>
                        Usar directamente · 0 tokens
                      </button>
                      <button type="button" className="bic-btn-secondary" onClick={manejarBICGenerarDesde}>
                        Generar nueva igual
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="bic-btn-primary" onClick={manejarBICAdaptar}>
                        Adaptar · rápido
                      </button>
                      <button type="button" className="bic-btn-secondary" onClick={manejarBICGenerarDesde}>
                        Generar desde cero
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {bicAdaptando && (
              <div className="bic-adaptando">
                <span className="bic-spinner" />
                Adaptando desde el Banco Pedagógico...
              </div>
            )}

            {planificacion && bicFuente && (
              <div className="bic-status">
                {bicFuente === "reutilizado" && (
                  <span className="bic-badge bic-badge-green">✅ Del Banco Pedagógico · 0 tokens</span>
                )}
                {bicFuente === "adaptado" && (
                  <span className="bic-badge bic-badge-blue">🔄 Adaptado del Banco Pedagógico</span>
                )}
                {bicFuente === "generado" && (
                  <>
                    <span className="bic-badge bic-badge-gray">✨ Generado por IA</span>
                    <button type="button" className="bic-guardar-btn" onClick={manejarBICGuardar}>
                      Guardar en Banco Pedagógico
                    </button>
                  </>
                )}
                {bicFuente === "indexado" && (
                  <span className="bic-badge bic-badge-green">✅ Guardado en el Banco Pedagógico · ID: {bicId?.slice(0, 8)}</span>
                )}
              </div>
            )}

          {bannerEntrenar && (
            <div className="doe-entrenar-banner">
              <span className="doe-entrenar-banner-icon">🧠</span>
              <div className="doe-entrenar-banner-body">
                <strong>¿Quieres ayudar a mejorar DocenteOS?</strong>
                <span>
                  {" "}Guarda tu estilo pedagógico o convierte esta planificación en un caso de éxito.
                  Los ejemplos aprobados entrenan la IA para todos los docentes.
                </span>
              </div>
              <button
                className="doe-entrenar-banner-close"
                onClick={() => setBannerEntrenar(false)}
                title="Cerrar"
              >
                ✕
              </button>
            </div>
          )}

          <ResultadoPlanificacion
            planificacion={planificacion}
            onGuardar={manejarGuardar}
            onDescargar={manejarDescargar}
            onNueva={manejarNueva}
            guardando={guardando}
            canGuardar={true}
            mensaje={mensaje}
            onAccionIA={ejecutarAccionIA}
            iaAccion={iaAccion}
            iaTexto={iaTexto}
            iaGenerando={iaGenerando}
            iaError={iaError}
            iaMinutos={iaMinutos}
            setIaMinutos={setIaMinutos}
            iaRef={iaRef}
            onLimpiarIA={() => { setIaTexto(""); setIaError(null); setIaAccion(null); }}
            onGuardarEstilo={manejarGuardarEstilo}
            onConvertirCasoExito={manejarConvertirCasoExito}
            guardandoEstilo={guardandoEstilo}
            guardandoCasoExito={guardandoCasoExito}
            mensajeEntrenar={mensajeEntrenar}
            onIrAModoAula={() => onIrA?.('modo-aula')}
          />
          </>
        )}

        {puedeVerCentroDecisiones && (
          <CentroDecisionesKE
            estadoTemas={estadoTemas}
            historialPlanificaciones={historialPlanificaciones}
            tieneCurriculoOficial={tieneCurriculoOficial}
            area={area}
            asignatura={asignatura}
            grado={grado}
            nivel={perfilNivel}
          />
        )}
      </div>

      {confirmMensaje && (
        <ModalConfirmacion
          mensaje={confirmMensaje}
          onConfirmar={() => { setConfirmMensaje(null); confirmResolveRef.current?.(true); }}
          onCancelar={() => { setConfirmMensaje(null); confirmResolveRef.current?.(false); }}
        />
      )}
    </>
  );
}
