import { useEffect, useRef, useState } from "react";
import { generarPlanDiario, formatearPlanDiarioHTML } from "../services/planDiarioService";
import { leerSesion, guardarSesion } from "../services/planificacionSesionCache.js";
import { verificarTemaAntesDeGenerar, registrarUsoTemaPlanificacion } from "../firebase";
import { guardarPlanificacionConHilo } from "../services/planificacionDataService.js";
import { EventTracker } from "../services/ai/learning/EventTracker.js";
import { LEARNING_EVENTS, AGENT_IDS } from "../services/ai/knowledge/KnowledgeTypes.js";

const hoyISO = new Date().toISOString().slice(0, 10);

const DATOS_INICIALES = {
  grado: "", seccion: "", area: "", asignatura: "",
  fecha: hoyISO, duracion: "50 min", tema: "",
  nombreDocente: "", regional: "", distrito: "",
  centro: "", codigoCentro: "",
  nivel: "", ciclo: "", modalidad: "", jornada: "",
  indicadoresTexto: "", competenciaEspecificaTexto: "", situacionAprendizajeTexto: "",
  competenciasFundamentalesSeleccionadas: [],
};

export function usePlanDiario() {
  const depsRef = useRef({ estadoTemas: {}, setDialogoTema: () => {}, cargarHistorial: async () => {} });

  // Llamar desde el componente padre en cada render para mantener deps actualizadas
  const syncDeps = (deps) => { depsRef.current = deps; };

  // Estado inicial desde el cache de sesión: el plan generado sobrevive
  // cuando el docente navega a otro menú y regresa.
  const [planDiarioDatos, setPlanDiarioDatos] = useState(() => leerSesion("diario:datos", DATOS_INICIALES));
  const [planDiario, setPlanDiario] = useState(() => leerSesion("diario:resultado", null));
  const [cargandoDiario, setCargandoDiario] = useState(false);
  const [guardandoDiario, setGuardandoDiario] = useState(false);
  const [mensajeDiario, setMensajeDiario] = useState(null);

  useEffect(() => { guardarSesion("diario:datos", planDiarioDatos); }, [planDiarioDatos]);
  useEffect(() => { guardarSesion("diario:resultado", planDiario); }, [planDiario]);

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
    const { estadoTemas, setDialogoTema, cargarHistorial } = depsRef.current;
    const temaDiario = planDiarioDatos.tema?.trim();
    if (temaDiario) {
      const verificacion = await verificarTemaAntesDeGenerar({ tituloTema: temaDiario });
      if (!verificacion?.permitido || verificacion?.requiereCredito) {
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
    const { cargarHistorial } = depsRef.current;
    if (!planDiario) return;
    setGuardandoDiario(true);
    try {
      const resultadoGuardado = await guardarPlanificacionConHilo(planDiario);
      EventTracker.track(LEARNING_EVENTS.PLANIFICACION_ACEPTADA, {
        agentId: AGENT_IDS.PLANIFICADOR,
        area:       planDiarioDatos.area ?? null,
        asignatura: planDiarioDatos.asignatura ?? null,
        grado:      planDiarioDatos.grado ?? null,
        tema:       planDiarioDatos.tema ?? null,
        metadata:   { tipo: "diario" },
      });
      await cargarHistorial({ mostrarMensajeRecuperacion: false });
      const advertenciaDiario = resultadoGuardado?.advertencias?.[0];
      setMensajeDiario(advertenciaDiario
        ? { tipo: "warning", texto: `✅ Plan diario guardado · ⚠️ ${advertenciaDiario}` }
        : { tipo: "success", texto: "✅ Plan diario guardado" });
    } catch (error) {
      setMensajeDiario({ tipo: "error", texto: `❌ ${error.message}` });
    } finally {
      setGuardandoDiario(false);
      setTimeout(() => setMensajeDiario(null), 5000);
    }
  };

  const manejarDescargarDiario = () => {
    if (!planDiario) return;
    try {
      const html = formatearPlanDiarioHTML(planDiario);
      const win = window.open("", "_blank", "noopener,noreferrer");
      if (!win) throw new Error("Habilita ventanas emergentes para exportar a PDF");
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
    } catch (error) {
      setMensajeDiario({ tipo: "error", texto: `❌ ${error.message}` });
    }
  };

  const manejarNuevoDiario = () => {
    setPlanDiario(null);
    setMensajeDiario(null);
    document.querySelector(".pd-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const manejarGenerarDiarioForzado = async (temaIngresado) => {
    setCargandoDiario(true);
    try {
      await registrarUsoTemaPlanificacion({ tituloTema: temaIngresado, forzarNuevoTema: true, contexto: "generacion" });
      ejecutarGenerarDiario();
    } catch (error) {
      setMensajeDiario({ tipo: "error", texto: `❌ ${error.message}` });
    } finally {
      setCargandoDiario(false);
    }
  };

  return {
    syncDeps,
    planDiarioDatos, setPlanDiarioDatos,
    planDiario,
    cargandoDiario, guardandoDiario, mensajeDiario,
    manejarGenerarDiario, manejarGenerarDiarioForzado,
    manejarGuardarDiario, manejarDescargarDiario, manejarNuevoDiario,
  };
}
