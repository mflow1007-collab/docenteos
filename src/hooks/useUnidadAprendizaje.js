import { useEffect, useRef, useState } from "react";
import { generarUnidadAprendizaje, formatearUnidadHTML } from "../services/unidadAprendizajeService";
import { leerSesion, guardarSesion } from "../services/planificacionSesionCache.js";
import { verificarTemaAntesDeGenerar, registrarUsoTemaPlanificacion } from "../firebase";
import { guardarPlanificacionConHilo, obtenerIndicadoresTrabajadosPrevios } from "../services/planificacionDataService.js";
import { applyAuditAction } from "../services/auditAcciones.js";
import { EventTracker } from "../services/ai/learning/EventTracker.js";
import { LEARNING_EVENTS, AGENT_IDS } from "../services/ai/knowledge/KnowledgeTypes.js";

const hoyISO = new Date().toISOString().slice(0, 10);

const DATOS_INICIALES = {
  grado: "", seccion: "", area: "", asignatura: "",
  titulo: "", numSemanas: 4, diasPorSemana: 5,
  estrategiaTexto: "", situacionTexto: "", productoFinalTexto: "",
  contextoComunitario: "",
  asignaturasVinculadasTexto: "",
  nombreDocente: "", regional: "", distrito: "",
  centro: "", codigoCentro: "",
  nivel: "", ciclo: "", modalidad: "", jornada: "",
  periodo: "", fechaInicio: hoyISO,
  competenciasFundamentalesSeleccionadas: [],
};

export function useUnidadAprendizaje() {
  const depsRef = useRef({ estadoTemas: {}, setDialogoTema: () => {}, cargarHistorial: async () => {} });

  const syncDeps = (deps) => { depsRef.current = deps; };

  // Estado inicial desde el cache de sesión: si el docente generó una unidad
  // y navegó a otro menú, al volver la encuentra intacta para consultarla.
  const [unidadDatos, setUnidadDatos] = useState(() => leerSesion("unidad:datos", DATOS_INICIALES));
  const [unidad, setUnidad] = useState(() => leerSesion("unidad:resultado", null));
  const [cargandoUnidad, setCargandoUnidad] = useState(false);
  const [guardandoUnidad, setGuardandoUnidad] = useState(false);
  const [mensajeUnidad, setMensajeUnidad] = useState(null);

  useEffect(() => { guardarSesion("unidad:datos", unidadDatos); }, [unidadDatos]);
  useEffect(() => { guardarSesion("unidad:resultado", unidad); }, [unidad]);

  const manejarGenerarUnidad = async () => {
    const { estadoTemas, setDialogoTema } = depsRef.current;
    const temaUnidad = (unidadDatos.tema || unidadDatos.titulo)?.trim();
    setCargandoUnidad(true);
    setMensajeUnidad({
      tipo: "loading",
      texto: "🔍 Verificando malla oficial, tema y permisos de generación...",
    });
    try {
      if (temaUnidad) {
        const verificacion = await verificarTemaAntesDeGenerar({ tituloTema: temaUnidad, contexto: "generacion" });
        if (!verificacion?.permitido || verificacion?.requiereCredito) {
          setDialogoTema({
            abierto: true,
            contexto: "unidad",
            payload: {
              ...verificacion,
              temaIngresado: temaUnidad,
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
        await registrarUsoTemaPlanificacion({ tituloTema: temaUnidad, forzarNuevoTema: false, contexto: "generacion" });
      }
      // Indicadores ya trabajados en planes anteriores del mismo grado +
      // asignatura → se muestran TACHADOS en el nuevo plan (el docente igual
      // puede re-elegirlos). No es fatal si falla la lectura del historial.
      let indicadoresTrabajadosAntes = [];
      try {
        indicadoresTrabajadosAntes = await obtenerIndicadoresTrabajadosPrevios(
          unidadDatos.grado, unidadDatos.asignatura,
        );
      } catch { /* sin historial, se genera sin tachados */ }

      const resultado = await generarUnidadAprendizaje({
        ...unidadDatos,
        indicadoresTrabajadosAntes,
        // Rótulo del documento según el tipo elegido en la página
        // ("Unidad de Aprendizaje" o "Secuencia Didáctica"); mismo esquema
        tipoPlanificacion: depsRef.current.tipoPlanificacion || "Unidad de Aprendizaje",
        onProgress: (msg) => setMensajeUnidad({ tipo: "loading", texto: msg }),
      });
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
    const { cargarHistorial } = depsRef.current;
    if (!unidad) return;
    setGuardandoUnidad(true);
    try {
      const payload = {
        ...unidad,
        metadatos: { ...unidad.metadatos, tema: unidad.metadatos?.titulo },
      };
      const resultadoGuardado = await guardarPlanificacionConHilo(payload);
      EventTracker.track(LEARNING_EVENTS.PLANIFICACION_ACEPTADA, {
        agentId: AGENT_IDS.PLANIFICADOR,
        area:       unidadDatos.area ?? null,
        asignatura: unidadDatos.asignatura ?? null,
        grado:      unidadDatos.grado ?? null,
        tema:       unidad.metadatos?.titulo ?? unidadDatos.tema ?? null,
        metadata:   { tipo: "unidad" },
      });
      await cargarHistorial({ mostrarMensajeRecuperacion: false });
      const advertenciaUnidad = resultadoGuardado?.advertencias?.[0];
      setMensajeUnidad(advertenciaUnidad
        ? { tipo: "warning", texto: `✅ Unidad guardada · ⚠️ ${advertenciaUnidad}` }
        : { tipo: "success", texto: "✅ Unidad de aprendizaje guardada" });
    } catch (error) {
      setMensajeUnidad({ tipo: "error", texto: `❌ ${error.message}` });
    } finally {
      setGuardandoUnidad(false);
      setTimeout(() => setMensajeUnidad(null), 5000);
    }
  };

  const manejarDescargarUnidad = () => {
    if (!unidad) return;
    try {
      const logoUrl = `${window.location.origin}/logo-minerd.svg`;
      const html = formatearUnidadHTML(unidad, logoUrl);
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;border:0;visibility:hidden";
      document.body.appendChild(iframe);
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) throw new Error("No se pudo preparar el documento");
      doc.open();
      doc.write(html);
      doc.close();
      iframe.contentWindow.focus();
      const dispararImpresion = () => {
        iframe.contentWindow?.print();
        setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 10000);
      };
      const imgs = Array.from(doc.querySelectorAll("img"));
      if (imgs.length === 0) {
        setTimeout(dispararImpresion, 300);
      } else {
        let pendientes = imgs.length;
        const onDone = () => { if (--pendientes === 0) dispararImpresion(); };
        imgs.forEach((img) => { img.onload = onDone; img.onerror = onDone; });
        setTimeout(dispararImpresion, 1800);
      }
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
      const logoUrl = `${window.location.origin}/logo-minerd.svg`;
      const html = formatearUnidadHTML(unidad, logoUrl);
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      if (!win) {
        setMensajeUnidad({ tipo: "error", texto: "❌ Bloqueado por el navegador. Permite ventanas emergentes." });
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

  const manejarGenerarUnidadForzado = async (temaIngresado) => {
    setCargandoUnidad(true);
    setMensajeUnidad({
      tipo: "loading",
      texto: `🔍 Preparando malla oficial y tema "${temaIngresado || unidadDatos.titulo || "seleccionado"}"...`,
    });
    try {
      await registrarUsoTemaPlanificacion({ tituloTema: temaIngresado, forzarNuevoTema: true, contexto: "generacion" });
      const resultado = await generarUnidadAprendizaje({
        ...unidadDatos,
        tipoPlanificacion: depsRef.current.tipoPlanificacion || "Unidad de Aprendizaje",
        onProgress: (msg) => setMensajeUnidad({ tipo: "loading", texto: msg }),
      });
      setUnidad(resultado);
      setTimeout(() => document.querySelector(".ua-resultado")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (error) {
      setMensajeUnidad({ tipo: "error", texto: `❌ ${error.message}` });
    } finally {
      setCargandoUnidad(false);
    }
  };

  const manejarAplicarAcciones = (accionesAplicar) => {
    if (!unidad || !Array.isArray(accionesAplicar) || accionesAplicar.length === 0) {
      return { ok: false, error: "No hay acciones para aplicar." };
    }
    let actual = unidad;
    let aplicadas = 0;
    let ultimoError = null;
    for (const accion of accionesAplicar) {
      const res = applyAuditAction(actual, accion);
      if (res.ok) { actual = res.unidad; aplicadas += 1; }
      else { ultimoError = res.error; }
    }
    if (aplicadas === 0) return { ok: false, error: ultimoError || "No se pudo aplicar la acción." };
    setUnidad(actual);
    setMensajeUnidad({
      tipo: "success",
      texto: `✅ ${aplicadas} mejora${aplicadas > 1 ? "s" : ""} aplicada${aplicadas > 1 ? "s" : ""}. Recuerda guardar la unidad.`,
    });
    return { ok: true, aplicadas, error: ultimoError };
  };

  return {
    syncDeps,
    unidadDatos, setUnidadDatos,
    unidad, setUnidad,
    cargandoUnidad, guardandoUnidad, mensajeUnidad, setMensajeUnidad,
    manejarGenerarUnidad, manejarGenerarUnidadForzado,
    manejarGuardarUnidad, manejarDescargarUnidad,
    manejarVerUnidad, manejarNuevaUnidad, manejarAplicarAcciones,
  };
}
