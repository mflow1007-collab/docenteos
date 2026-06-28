/**
 * useContextoDocente — Carga automáticamente el contexto completo del docente
 * (perfil + planificación activa + currículo oficial MINERD) y lo formatea
 * como string listo para inyectar en el system prompt de la IA.
 *
 * Flujo:
 *   1. Lee perfil institucional desde AuthContext (sin red extra)
 *   2. Fetches planificaciones del docente (Firestore)
 *   3. Deriva nivel / grado / área de la planificación activa
 *   4. Fetches el documento diseñoCurricular correspondiente (Firestore)
 *   5. Combina todo en un bloque de contexto < 1 500 tokens
 *
 * Uso:
 *   const { contexto, cargando } = useContextoDocente();
 *   await llamarIALab(prompt, callbacks, contexto);
 */

import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { obtenerPlanificacionesDetalladas } from "../firebase.js";
import { consultarCurriculo } from "../services/curriculumService.js";
import { buildTeacherContext, buildCurriculumContext } from "../services/ai/contextResolver.js";

export function useContextoDocente() {
  const { user, perfil } = useAuth();
  const [contexto,  setContexto]  = useState("");
  const [cargando,  setCargando]  = useState(false);
  const [datosCurriculares, setDatosCurriculares] = useState(null);

  useEffect(() => {
    if (!user?.uid) {
      setContexto("");
      setDatosCurriculares(null);
      return;
    }

    let activo = true;
    setCargando(true);

    (async () => {
      try {
        // ── 1. Planificaciones ──────────────────────────────────────────────────
        const result = await obtenerPlanificacionesDetalladas();
        if (!activo) return;

        const planes = Array.isArray(result?.data) ? result.data : [];
        const teacherCtx = buildTeacherContext(perfil, planes);

        // ── 2. Currículo oficial de la planificación activa ─────────────────────
        let curriculumCtx = "";

        const planActiva =
          planes.find((p) => p.estado !== "archivada") ?? planes[0] ?? null;

        let datos = null;

        if (planActiva) {
          const m = planActiva.metadatos    || {};
          const d = planActiva.datosGenerales || {};

          const nivel =
            m.nivelEducativo ||
            m.nivel ||
            (Array.isArray(perfil?.nivelesDocente)
              ? perfil.nivelesDocente[0]
              : perfil?.nivel) ||
            "";

          const grado      = m.grado      || "";
          const area       = m.area       || d.area       || "";
          const asignatura = m.asignatura || d.asignatura || area;
          const tema       = m.tema       || m.tituloTema || d.tema || "";

          datos = { nivel, grado, area, asignatura, tema };

          if (nivel && grado && area) {
            const curriculoDoc = await consultarCurriculo(nivel, grado, area);
            if (!activo) return;

            const compActiva =
              m.competenciaSeleccionada || d.competencia || "";

            curriculumCtx = buildCurriculumContext(curriculoDoc, compActiva);
          }
        }

        if (activo) {
          setContexto(teacherCtx + curriculumCtx);
          setDatosCurriculares(datos);
        }
      } catch {
        if (activo) {
          setContexto(buildTeacherContext(perfil, []));
          setDatosCurriculares(null);
        }
      } finally {
        if (activo) setCargando(false);
      }
    })();

    return () => { activo = false; };
  }, [user?.uid]);

  return { contexto, cargando, datosCurriculares };
}
