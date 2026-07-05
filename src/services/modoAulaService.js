/**
 * modoAulaService.js — Fases 6 y 7 del hilo pedagógico
 *
 * Modo Aula NO crea planificación ni duplica datos: consume la planificación
 * ya generada (capaCurricular) y muestra la clase del día. Si el plan es
 * anterior al hilo, se le hace backfill LAZY de la capa al abrirlo.
 *
 * "Evaluar y registrar" dispara la cadena completa:
 *   instrumentoResultados (F4) → Mi Registro con regla 12 (F5) →
 *   Banco de Evidencias (F8) → expediente/registro legacy (puentes existentes)
 */

import { obtenerPlanificacionesDetalladas } from "../firebase.js";
import { backfillCapaCurricular, obtenerPlanificacionActiva } from "./planificacionDataService.js";
import { obtenerClaseDeHoy } from "./hiloPedagogico.js";
import {
  guardarResultadoInstrumento,
  obtenerInstrumentosPorPlanificacion,
  obtenerInstrumentosPorClase,
  obtenerResultadosPorPlanificacion,
} from "./instrumentosService.js";
import { actualizarRegistroDesdeResultadoInstrumento } from "./registroService.js";
import { crearEvidenciaDesdeResultado } from "./evidenciasService.js";
import { sincronizarEvaluacionPedagogica } from "./nucleoPedagogicoService.js";

/**
 * Garantiza que un plan guardado tenga capa curricular (backfill lazy,
 * decisión de producto: solo al abrirlo, nunca masivo). Best-effort: si el
 * backfill falla, devuelve el plan tal cual y Modo Aula sigue funcionando
 * con su normalización legacy.
 */
export const asegurarCapaCurricular = async (registroPlan, { cursoId = "" } = {}) => {
  if (!registroPlan) return null;
  if (registroPlan.capaCurricular) return registroPlan;
  try {
    const capa = await backfillCapaCurricular(registroPlan, { cursoId });
    return { ...registroPlan, capaCurricular: capa, cursoId: capa.cursoId || registroPlan.cursoId || "" };
  } catch (error) {
    console.warn("[modoAulaService] Backfill de capa curricular no disponible:", error.message);
    return registroPlan;
  }
};

/**
 * FASE 6 — Contexto completo de Modo Aula para un curso y una fecha:
 * planificación activa, clase de hoy (o PRÓXIMA pendiente, nunca vacío),
 * indicador principal, instrumentos del día y evidencias esperadas.
 */
export const obtenerContextoModoAula = async (cursoId, fecha = new Date().toISOString().slice(0, 10), { planes = null } = {}) => {
  const lista = Array.isArray(planes)
    ? planes
    : (await obtenerPlanificacionesDetalladas()).data || [];
  if (!lista.length) return { plan: null, clase: null, esHoy: false, motivo: "sin-planes", instrumentos: [] };

  // Fase 10: selección delegada a obtenerPlanificacionActiva (curso → capa → reciente)
  let plan = await obtenerPlanificacionActiva(cursoId, { planes: lista });

  plan = await asegurarCapaCurricular(plan, { cursoId });

  const capa = plan.capaCurricular || null;
  const { clase, esHoy, motivo } = capa
    ? obtenerClaseDeHoy(capa, fecha)
    : { clase: null, esHoy: false, motivo: "sin-capa" };

  const instrumentos = capa && clase
    ? await obtenerInstrumentosPorClase(plan.id, clase.claseId).catch(() => [])
    : [];

  const indicadorPrincipal = capa && clase
    ? capa.indicadoresSeleccionados.find((ind) => ind.id === clase.indicadorPrincipalId) || null
    : null;

  return {
    plan,
    capa,
    clase,
    esHoy,
    motivo, // "hoy" | "proxima" | "ultima" | "sin-fechas" | "sin-capa" | "sin-planes"
    indicadorPrincipal,
    instrumentos,
    evidenciasEsperadas: clase?.evidenciasEsperadas || [],
    recursos: clase?.recursos || [],
  };
};

/** Instrumentos del día para un plan/clase (atajo Fase 6.6). */
export const obtenerInstrumentosDelDia = (planificacionId, claseId) =>
  obtenerInstrumentosPorClase(planificacionId, claseId);

/**
 * FASE 7 — "Evaluar y registrar": califica uno o varios estudiantes con un
 * instrumento y dispara todo el hilo. Por estudiante:
 *
 *   1. guardarResultadoInstrumento      (F4 — fuente de verdad)
 *   2. actualizarRegistroDesdeResultado (F5 — regla 12, nunca pisa ajustes)
 *   3. crearEvidenciaDesdeResultado     (F8 — banco de evidencias)
 *   4. sincronizarEvaluacionPedagogica  (puente legacy: celda del registro
 *      por competencia/período + expediente; ya parcheado con regla 12)
 *
 * Nunca falla silenciosamente: devuelve { exitosos, errores } con mensajes
 * claros por estudiante.
 *
 * @param {object} params
 *   - instrumento: doc de usuarios/{uid}/instrumentos (con capa: indicadorIds…)
 *   - aplicaciones: [{ estudianteId, estudianteNombre, puntajeObtenido,
 *                      estado?, observacionDocente? }]
 *   - claseTitulo: para contextualizar la evidencia
 *   - sincronizarLegacy: mantener el puente al registro por competencias (default true)
 */
export const evaluarYRegistrar = async ({ instrumento, aplicaciones = [], claseTitulo = "", sincronizarLegacy = true }) => {
  if (!instrumento) throw new Error("Selecciona el instrumento del día antes de evaluar");
  if (!aplicaciones.length) throw new Error("Coloca al menos una calificación para registrar");

  const exitosos = [];
  const errores = [];

  // Cargar una sola vez el contexto del plan para las consolidaciones
  const planificacionId = instrumento.planificacionId || "";
  const [instrumentosPlan, resultadosPlan] = planificacionId
    ? await Promise.all([
        obtenerInstrumentosPorPlanificacion(planificacionId).catch(() => [instrumento]),
        obtenerResultadosPorPlanificacion(planificacionId).catch(() => []),
      ])
    : [[instrumento], []];

  for (const aplicacion of aplicaciones) {
    const nombre = aplicacion.estudianteNombre || aplicacion.estudianteId;
    try {
      // 1. Resultado (fuente de verdad)
      const resultado = await guardarResultadoInstrumento({
        instrumento,
        estudianteId: aplicacion.estudianteId,
        estudianteNombre: aplicacion.estudianteNombre || "",
        puntajeObtenido: aplicacion.puntajeObtenido,
        estado: aplicacion.estado || "evaluado",
        observacionDocente: aplicacion.observacionDocente || "",
      });

      // 2. Mi Registro (regla 12) — con los resultados del estudiante al día
      const resultadosEstudiante = [
        ...resultadosPlan.filter((r) =>
          String(r.estudianteId) === String(aplicacion.estudianteId) &&
          r.resultadoId !== resultado.resultadoId
        ),
        resultado,
      ];
      const registro = await actualizarRegistroDesdeResultadoInstrumento(resultado, {
        instrumentos: instrumentosPlan,
        resultadosEstudiante,
      });

      // 3. Evidencia vinculada (estudiante + curso + plan + clase + indicador + instrumento)
      const evidencia = await crearEvidenciaDesdeResultado(resultado, { instrumento, claseTitulo });

      // 4. Puente legacy (celda por competencia/período + expediente) — regla 12 aplicada dentro
      if (sincronizarLegacy && resultado.estado === "evaluado") {
        await sincronizarEvaluacionPedagogica({
          instrumento,
          cursoId: resultado.cursoId,
          aplicacion: {
            estudianteId: resultado.estudianteId,
            estudiante: resultado.estudianteNombre || nombre,
            fecha: resultado.fechaEvaluacion,
            periodo: resultado.periodo,
            puntosObtenidos: resultado.puntajeObtenido,
            calificacionObtenida: resultado.puntajeObtenido,
            valorMaximo: resultado.puntajeMaximo,
            porcentajeObtenido: resultado.porcentaje,
            observacion: resultado.observacionDocente,
            indicadoresEvaluados: instrumento.indicadores || [],
            detalle: { fuente: "evaluar-y-registrar", claseId: resultado.claseId },
          },
        }).catch((error) => {
          console.warn(`[evaluarYRegistrar] Puente legacy falló para ${nombre}:`, error);
        });
      }

      exitosos.push({ estudianteId: aplicacion.estudianteId, resultado, registro, evidencia });
    } catch (error) {
      errores.push({
        estudianteId: aplicacion.estudianteId,
        mensaje: `No se pudo registrar la evaluación de ${nombre}: ${error.message}`,
      });
    }
  }

  return { exitosos, errores };
};
