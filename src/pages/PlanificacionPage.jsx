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

import { useCallback, useEffect, useState } from "react";
import { usePerfilInstitucional } from "../hooks/usePerfilInstitucional.js";
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
import {
  generarPlanDiario,
  formatearPlanDiarioHTML,
} from "../services/planDiarioService";
import {
  generarUnidadAprendizaje,
  formatearUnidadHTML,
} from "../services/unidadAprendizajeService";
import {
  eliminarPlanificacionDetallada,
  guardarPlanificacionDetallada,
  obtenerPlanificacionesDetalladas,
  guardarPreferenciaUsuario,
  obtenerPreferenciaUsuario,
  verificarTemaAntesDeGenerar,
  registrarUsoTemaPlanificacion,
  registrarUsoPDFTema,
  suscribirseEstadoTemasPlanificacion,
} from "../firebase";

export default function PlanificacionPage() {
  const hoyISO = new Date().toISOString().slice(0, 10);
  const STORAGE_USO_TIPOS = "docenteos_planificacion_uso_tipos_v1";

  // ── Perfil institucional global ───────────────────────────────────────────
  const { formulario: perfilForm } = usePerfilInstitucional();

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
  const [tipoPlanificacion, setTipoPlanificacion] = useState("");
  const [diasClase, setDiasClase] = useState(["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"]);
  const [asignatura, setAsignatura] = useState("");
  const [tema, setTema] = useState("");
  const [competencia, setCompetencia] = useState("");
  const [indicadoresOficiales, setIndicadoresOficiales] = useState("");
  const [imagenTematicaSrc, setImagenTematicaSrc] = useState("");
  const [imagenTematicaNombre, setImagenTematicaNombre] = useState("");
  const [ejesTematicos, setEjesTematicos] = useState([]);
  const [asignaturasVinculadas, setAsignaturasVinculadas] = useState("");
  const [situacionAprendizaje, setSituacionAprendizaje] = useState("");
  const [minutosHoraClase, setMinutosHoraClase] = useState(45);
  const [periodosClasePorDia, setPeriodosClasePorDia] = useState({});

  // ── Plan Diario ──
  const hoyISO2 = new Date().toISOString().slice(0, 10);
  const [planDiarioDatos, setPlanDiarioDatos] = useState({
    grado: "", seccion: "", area: "", asignatura: "",
    fecha: hoyISO2, duracion: "50 min", tema: "",
    nombreDocente: "", regional: "", distrito: "",
    centro: "", codigoCentro: "",
    nivel: "", ciclo: "", modalidad: "", jornada: "",
    indicadoresTexto: "", competenciaEspecificaTexto: "", situacionAprendizajeTexto: "",
    competenciasFundamentalesSeleccionadas: [],
  });
  const [planDiario, setPlanDiario] = useState(null);
  const [cargandoDiario, setCargandoDiario] = useState(false);
  const [guardandoDiario, setGuardandoDiario] = useState(false);
  const [mensajeDiario, setMensajeDiario] = useState(null);

  const ejecutarGenerarDiario = () => {
    const indicadoresCustom = planDiarioDatos.indicadoresTexto
      ? planDiarioDatos.indicadoresTexto.split("\n").map((l) => l.trim()).filter(Boolean)
      : [];
    const resultado = generarPlanDiario({
      ...planDiarioDatos,
      indicadoresCustom,
      competenciaEspecificaCustom: planDiarioDatos.competenciaEspecificaTexto || "",
      situacionCustom: planDiarioDatos.situacionAprendizajeTexto || "",
    });
    setPlanDiario(resultado);
    setTimeout(() => {
      document.querySelector(".pd-resultado")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const manejarGenerarDiario = async () => {
    const temaDiario = planDiarioDatos.tema?.trim();
    if (temaDiario) {
      const verificacion = await verificarTemaAntesDeGenerar({ tituloTema: temaDiario });
      if (!verificacion?.permitido) {
        setDialogoTema({
          abierto: true,
          contexto: "diario",
          payload: {
            ...verificacion,
            temaIngresado: temaDiario,
            temas: {
              temaActivo: estadoTemas.temaActivo,
              temaSecundario: estadoTemas.temaSecundario,
            },
          },
        });
        return;
      }
      if (verificacion?.requiereCredito) {
        setDialogoTema({
          abierto: true,
          contexto: "diario",
          payload: {
            ...verificacion,
            temaIngresado: temaDiario,
            temas: {
              temaActivo: estadoTemas.temaActivo,
              temaSecundario: estadoTemas.temaSecundario,
            },
          },
        });
        return;
      }
      await registrarUsoTemaPlanificacion({ tituloTema: temaDiario, forzarNuevoTema: false, contexto: "generacion" });
    }
    setCargandoDiario(true);
    setMensajeDiario(null);
    try {
      ejecutarGenerarDiario();
    } catch (error) {
      setMensajeDiario({ tipo: "error", texto: `❌ ${error.message}` });
    } finally {
      setCargandoDiario(false);
    }
  };

  const manejarGuardarDiario = async () => {
    if (!planDiario) return;
    setGuardandoDiario(true);
    try {
      await guardarPlanificacionDetallada(planDiario);
      setMensajeDiario({ tipo: "success", texto: "✅ Plan diario guardado" });
    } catch (error) {
      setMensajeDiario({ tipo: "error", texto: `❌ ${error.message}` });
    } finally {
      setGuardandoDiario(false);
      setTimeout(() => setMensajeDiario(null), 3000);
    }
  };

  const manejarDescargarDiario = () => {
    if (!planDiario) return;
    try {
      const html = formatearPlanDiarioHTML(planDiario);
      const win = window.open("", "_blank", "noopener,noreferrer");
      if (!win) { throw new Error("Habilita ventanas emergentes para exportar a PDF"); }
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
    } catch (error) {
      setMensajeDiario({ tipo: "error", texto: `❌ ${error.message}` });
    }
  };

  const manejarNuevoDiario = () => {
    setPlanDiario(null);
    setMensajeDiario(null);
    document.querySelector(".pd-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ── Unidad de Aprendizaje ──
  const [unidadDatos, setUnidadDatos] = useState({
    grado: "", seccion: "", area: "", asignatura: "",
    titulo: "", numSemanas: 4, diasPorSemana: 5,
    estrategiaTexto: "", situacionTexto: "", productoFinalTexto: "",
    asignaturasVinculadasTexto: "",
    nombreDocente: "", regional: "", distrito: "",
    centro: "", codigoCentro: "",
    nivel: "", ciclo: "", modalidad: "", jornada: "",
    periodo: "", fechaInicio: hoyISO,
    competenciasFundamentalesSeleccionadas: [],
  });
  const [unidad, setUnidad] = useState(null);
  const [cargandoUnidad, setCargandoUnidad] = useState(false);
  const [guardandoUnidad, setGuardandoUnidad] = useState(false);
  const [mensajeUnidad, setMensajeUnidad] = useState(null);

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
    }));
  }, [perfilNombreDocente, perfilRegional, perfilDistrito, perfilCentro, perfilCodigoCentro, perfilNivel, perfilModalidad, perfilCiclo, perfilJornada, perfilPeriodo]);

  const manejarGenerarUnidad = async () => {
    const temaUnidad = (unidadDatos.tema || unidadDatos.titulo)?.trim();
    if (temaUnidad) {
      const verificacion = await verificarTemaAntesDeGenerar({ tituloTema: temaUnidad });
      if (!verificacion?.permitido) {
        setDialogoTema({
          abierto: true,
          contexto: "unidad",
          payload: {
            ...verificacion,
            temaIngresado: temaUnidad,
            temas: {
              temaActivo: estadoTemas.temaActivo,
              temaSecundario: estadoTemas.temaSecundario,
            },
          },
        });
        return;
      }
      if (verificacion?.requiereCredito) {
        setDialogoTema({
          abierto: true,
          contexto: "unidad",
          payload: {
            ...verificacion,
            temaIngresado: temaUnidad,
            temas: {
              temaActivo: estadoTemas.temaActivo,
              temaSecundario: estadoTemas.temaSecundario,
            },
          },
        });
        return;
      }
      await registrarUsoTemaPlanificacion({ tituloTema: temaUnidad, forzarNuevoTema: false, contexto: "generacion" });
    }
    setCargandoUnidad(true);
    setMensajeUnidad(null);
    try {
      const resultado = generarUnidadAprendizaje(unidadDatos);
      setUnidad(resultado);
      setTimeout(() => {
        document.querySelector(".ua-resultado")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (error) {
      setMensajeUnidad({ tipo: "error", texto: `❌ ${error.message}` });
    } finally {
      setCargandoUnidad(false);
    }
  };

  const manejarGuardarUnidad = async () => {
    if (!unidad) return;
    setGuardandoUnidad(true);
    try {
      const payload = {
        ...unidad,
        metadatos: { ...unidad.metadatos, tema: unidad.metadatos?.titulo },
      };
      await guardarPlanificacionDetallada(payload);
      setMensajeUnidad({ tipo: "success", texto: "✅ Unidad de aprendizaje guardada" });
    } catch (error) {
      setMensajeUnidad({ tipo: "error", texto: `❌ ${error.message}` });
    } finally {
      setGuardandoUnidad(false);
      setTimeout(() => setMensajeUnidad(null), 3000);
    }
  };

  const manejarDescargarUnidad = () => {
    if (!unidad) return;
    try {
      const html = formatearUnidadHTML(unidad);
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;border:0;visibility:hidden";
      document.body.appendChild(iframe);
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) throw new Error("No se pudo preparar el documento");
      doc.open();
      doc.write(html);
      doc.close();
      iframe.contentWindow.focus();
      setTimeout(() => {
        iframe.contentWindow?.print();
        setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 10000);
      }, 400);
      setMensajeUnidad({
        tipo: "info",
        texto: "🖨️ Se abrirá el diálogo de impresión → en 'Destino' elige 'Guardar como PDF' → clic en Guardar.",
      });
      setTimeout(() => setMensajeUnidad(null), 12000);
    } catch (error) {
      setMensajeUnidad({ tipo: "error", texto: `❌ ${error.message}` });
    }
  };

  const manejarVerUnidad = () => {
    if (!unidad) return;
    try {
      const html = formatearUnidadHTML(unidad);
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      if (!win) {
        setMensajeUnidad({ tipo: "error", texto: "❌ Bloqueado por el navegador. Permite ventanas emergentes para ver el PDF." });
      }
    } catch (error) {
      setMensajeUnidad({ tipo: "error", texto: `❌ ${error.message}` });
    }
  };

  const manejarNuevaUnidad = () => {
    setUnidad(null);
    setMensajeUnidad(null);
    document.querySelector(".pd-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ── Estado de generación (planificación general) ──
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [planificacion, setPlanificacion] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [historialPlanificaciones, setHistorialPlanificaciones] = useState([]);
  const [historialMode, setHistorialMode] = useState("local");
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [usoTiposPlanificacion, setUsoTiposPlanificacion] = useState({});
  const [estadoTemas, setEstadoTemas] = useState({
    temaActivo: null,
    temaSecundario: null,
    suscripcion: "Pendiente de completar",
    usoMensual: "Pendiente de completar",
    creditosDisponibles: 0,
  });
  const [dialogoTema, setDialogoTema] = useState({ abierto: false, payload: null, contexto: "planificacion" });

  const formatearFechaRegistro = (fecha) => {
    if (!fecha) return "Sin fecha";
    const normalizada = typeof fecha === "string" ? new Date(fecha) : fecha;
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
      const lista = (resultado.data || []).filter((item) => item?.contenido?.metadatos);
      setHistorialPlanificaciones(lista);
      setHistorialMode(resultado.mode || "local");

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

  useEffect(() => {
    const timer = setTimeout(() => {
      cargarHistorial({ mostrarMensajeRecuperacion: false });
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const unsub = suscribirseEstadoTemasPlanificacion(
      (data) => {
        setEstadoTemas({
          temaActivo: data?.temaActivo || null,
          temaSecundario: data?.temaSecundario || null,
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

  const ES_TIPO_UNIDAD = (t) =>
    t === "Unidad de Aprendizaje" || t === "Secuencia Didáctica";

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

  const manejarAceptarCombinacion = () => {
    if (!combinacionSugerida) return;
    setTemasIntegrados(combinacionSugerida.temas);
    setCombinacionSugerida(null);
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
    setMensaje(null);

    try {
      const verificacionTema = await verificarTemaAntesDeGenerar({ tituloTema: tema });
      if (!verificacionTema?.permitido) {
        if (verificacionTema?.motivo === "tercer_tema_sin_credito") {
          setDialogoTema({
            abierto: true,
            payload: {
              ...verificacionTema,
              temaIngresado: tema,
            },
          });
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
            },
          },
        });
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

      const resultado = await generarPlanificacion(datosValidados);
      setPlanificacion(resultado);
      
      // Scroll al resultado
      setTimeout(() => {
        document.querySelector(".resultado")?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }, 100);
    } catch (error) {
      setMensaje({
        tipo: "error",
        texto: `❌ ${error.message}`
      });
    } finally {
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
      const verificacion = await verificarTemaAntesDeGenerar({ tituloTema: temaParaControl });
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
      const resultado = await guardarPlanificacionDetallada(planificacion);
      await cargarHistorial({ mostrarMensajeRecuperacion: false });
      setMensaje({
        tipo: "success",
        texto: resultado.mode === "firebase"
          ? "✅ Planificación guardada en Firebase"
          : "✅ Planificación guardada localmente",
      });
    } catch (error) {
      setMensaje({
        tipo: "error",
        texto: `❌ ${error.message || "Error al guardar planificación"}`,
      });
    } finally {
      setGuardando(false);
      setTimeout(() => setMensaje(null), 3000);
    }
  };

  const cargarFormularioDesdeHistorial = (contenido, { duplicar = false } = {}) => {
    if (!contenido) return;

    const meta = contenido.metadatos || {};

    if (!duplicar) {
      setPlanificacion(contenido);
    } else {
      setPlanificacion(null);
    }
    setGrado(meta.grado || "");
    setSeccion(meta.seccion || "");
    setArea(meta.area || "");
    setPeriodo(meta.periodo || "");
    setFechaInicio(meta.fechaInicio || hoyISO);
    setDuracion(meta.duracion || "");
    setTipoPlanificacion(meta.tipoPlanificacion || "");
    setDiasClase(Array.isArray(meta.diasClase) && meta.diasClase.length ? meta.diasClase : ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"]);
    setTema(meta.tema || "");
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

    const texto = duplicar
      ? "🧬 Configuración duplicada en el formulario"
      : "📂 Planificación cargada desde historial";

    setMensaje({ tipo: "success", texto });
    setTimeout(() => setMensaje(null), 2000);
  };

  const manejarCargarHistorial = (id) => {
    const encontrado = historialPlanificaciones.find((item) => String(item.id) === String(id));
    if (!encontrado?.contenido) return;
    cargarFormularioDesdeHistorial(encontrado.contenido, { duplicar: false });
  };

  const manejarDuplicarHistorial = (id) => {
    const encontrado = historialPlanificaciones.find((item) => String(item.id) === String(id));
    if (!encontrado?.contenido) return;
    cargarFormularioDesdeHistorial(encontrado.contenido, { duplicar: true });
  };

  const manejarEliminarHistorial = async (id) => {
    const encontrado = historialPlanificaciones.find((item) => String(item.id) === String(id));
    if (!encontrado) return;
    const meta = encontrado?.contenido?.metadatos || {};
    const gradoSeccion = [meta.grado, meta.seccion].filter(Boolean).join(" ").trim() || encontrado?.curso || "Curso";
    const areaActual = meta.area || encontrado?.area || "Área";
    const etiqueta = `${gradoSeccion} - ${areaActual}`;

    const confirmar = window.confirm(`¿Deseas eliminar esta planificación del historial?\n\n${etiqueta}`);
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
      ventanaImpresion.print();

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

  const manejarDialogoTemaUsarCredito = async () => {
    const temaIngresado = dialogoTema?.payload?.temaIngresado;
    const contextoDialogo = dialogoTema?.contexto || "planificacion";
    if (!temaIngresado) {
      setDialogoTema({ abierto: false, payload: null, contexto: "planificacion" });
      return;
    }

    setDialogoTema({ abierto: false, payload: null, contexto: "planificacion" });

    // Para diario/unidad: registrar crédito y generar sin el flujo de planificación semanal
    if (contextoDialogo === "diario") {
      setCargandoDiario(true);
      try {
        await registrarUsoTemaPlanificacion({ tituloTema: temaIngresado, forzarNuevoTema: true, contexto: "generacion" });
        ejecutarGenerarDiario();
      } catch (error) {
        setMensajeDiario({ tipo: "error", texto: `❌ ${error.message}` });
      } finally {
        setCargandoDiario(false);
      }
      return;
    }

    if (contextoDialogo === "unidad") {
      setCargandoUnidad(true);
      try {
        await registrarUsoTemaPlanificacion({ tituloTema: temaIngresado, forzarNuevoTema: true, contexto: "generacion" });
        const resultado = generarUnidadAprendizaje(unidadDatos);
        setUnidad(resultado);
        setTimeout(() => document.querySelector(".ua-resultado")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      } catch (error) {
        setMensajeUnidad({ tipo: "error", texto: `❌ ${error.message}` });
      } finally {
        setCargandoUnidad(false);
      }
      return;
    }

    if (contextoDialogo === "guardar") {
      setGuardando(true);
      try {
        await registrarUsoTemaPlanificacion({ tituloTema: temaIngresado, forzarNuevoTema: true, contexto: "edicion" });
        const resultado = await guardarPlanificacionDetallada(planificacion);
        await cargarHistorial({ mostrarMensajeRecuperacion: false });
        setMensaje({ tipo: "success", texto: resultado.mode === "firebase" ? "✅ Guardado en Firebase" : "✅ Guardado localmente" });
        setTimeout(() => setMensaje(null), 3000);
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

      const resultado = await generarPlanificacion(datosValidados);
      setPlanificacion(resultado);
      setMensaje({
        tipo: "success",
        texto: "✅ Nuevo tema registrado y planificación generada",
      });
      setTimeout(() => setMensaje(null), 2800);
      setTimeout(() => {
        document.querySelector(".resultado")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    } catch (error) {
      setMensaje({
        tipo: "error",
        texto: `❌ ${error.message || "No fue posible crear el nuevo tema"}`,
      });
    } finally {
      setCargando(false);
    }
  };

  const manejarSeleccionImagenTematica = (archivo) => {
    if (!archivo) {
      setImagenTematicaSrc("");
      setImagenTematicaNombre("");
      return;
    }

    const lector = new FileReader();
    lector.onload = () => {
      setImagenTematicaSrc(typeof lector.result === "string" ? lector.result : "");
      setImagenTematicaNombre(archivo.name || "imagen-tematica");
    };
    lector.readAsDataURL(archivo);
  };

  const limpiarImagenTematica = () => {
    setImagenTematicaSrc("");
    setImagenTematicaNombre("");
  };

  /**
   * Maneja la creación de nueva planificación
   */
  const manejarNueva = () => {
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

  return (
    <>
      <h1>✨ Planificación Inteligente</h1>
      <p style={{ color: "#64748b", marginBottom: "24px" }}>
        Genera planificaciones didácticas completas con IA en segundos
      </p>

      {dialogoTema.abierto && (
        <div className="tema-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="tema-modal-titulo">
          <div className="tema-modal">
            <h2 id="tema-modal-titulo">Ya tienes dos temas activos</h2>
            <p>
              {dialogoTema?.payload?.mensaje || "Puedes seguir editándolos sin límites. Para iniciar un nuevo tema debes usar un nuevo crédito de planificación o disponer de una suscripción que lo permita."}
            </p>
            <div className="tema-modal-temas">
              <span><strong>Tema 1:</strong> {dialogoTema?.payload?.temas?.temaActivo?.titulo || "No definido"}</span>
              <span><strong>Tema 2:</strong> {dialogoTema?.payload?.temas?.temaSecundario?.titulo || "No definido"}</span>
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
              <button
                type="button"
                className="tema-modal-btn-credito"
                onClick={manejarDialogoTemaUsarCredito}
                disabled={dialogoTema?.payload?.puedeCrearNuevoTema === false}
              >
                Usar nuevo crédito
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="planning-container">

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
          />
        ) : ES_TIPO_UNIDAD(tipoPlanificacion) ? (
          <>
            {/* Mensaje de error visible incluso antes de generar */}
            {mensajeUnidad && !unidad && (
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
              guardando={guardandoUnidad}
              mensaje={mensajeUnidad}
            />
          </>
        ) : (
          /* Resultado Plan Semanal / resto */
          <ResultadoPlanificacion
            planificacion={planificacion}
            onGuardar={manejarGuardar}
            onDescargar={manejarDescargar}
            onNueva={manejarNueva}
            guardando={guardando}
            canGuardar={true}
            mensaje={mensaje}
          />
        )}

        <section className="planning-history-card secondary">
          <p style={{ marginTop: 0 }}>
            <strong>Tema Activo:</strong> {estadoTemas?.temaActivo?.titulo || "Pendiente de completar"}
            {" · "}
            <strong>Tema Secundario:</strong> {estadoTemas?.temaSecundario?.titulo || "Pendiente de completar"}
          </p>
          <button
            className="history-collapse-btn"
            type="button"
            onClick={() => setHistorialAbierto((prev) => !prev)}
          >
            <span>🗂️ Historial reciente</span>
            <span>{historialAbierto ? "Ocultar" : "Mostrar"}</span>
          </button>

          {historialAbierto && (
            <>
              <p>
                Fuente actual: <strong>{historialMode === "firebase" ? "Firebase" : "Local"}</strong>
              </p>
              <div className="history-cards">
                {historialPlanificaciones.slice(0, 5).map((item) => {
                  const meta = item?.contenido?.metadatos || {};
                  const gradoSeccion = [meta.grado, meta.seccion].filter(Boolean).join(" ").trim() || item.curso || "Curso";
                  const areaActual = meta.area || item.area || "Área";
                  const tipo = meta.tipoPlanificacion || "No definido";

                  return (
                    <article key={item.id} className="history-item-card">
                      <div className="history-item-head">
                        <strong>{gradoSeccion}</strong>
                        <span>{areaActual}</span>
                      </div>
                      <div className="history-item-meta">
                        <span>Tipo: {tipo}</span>
                        <span>Creado: {formatearFechaRegistro(item.createdAt)}</span>
                      </div>
                      <div className="history-item-actions">
                        <button type="button" onClick={() => manejarCargarHistorial(item.id)}>Cargar</button>
                        <button type="button" onClick={() => manejarDuplicarHistorial(item.id)}>Duplicar</button>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => manejarEliminarHistorial(item.id)}
                          disabled={eliminando}
                        >
                          {eliminando ? "Eliminando..." : "Eliminar"}
                        </button>
                      </div>
                    </article>
                  );
                })}
                {historialPlanificaciones.length === 0 && (
                  <p className="history-empty">No hay planificaciones guardadas todavía.</p>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
