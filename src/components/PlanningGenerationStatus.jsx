import { useEffect, useMemo, useState } from "react";
import { clearGenerationJob, subscribeGenerationJobs } from "../services/planificacionBackgroundJobs.js";

export default function PlanningGenerationStatus() {
  const [jobs, setJobs] = useState([]);

  useEffect(() => subscribeGenerationJobs(setJobs), []);

  const job = useMemo(() => {
    const ordenados = [...jobs].sort((a, b) => Date.parse(b.updatedAt || b.startedAt || 0) - Date.parse(a.updatedAt || a.startedAt || 0));
    return ordenados.find((item) => item.status === "running")
      || ordenados.find((item) => item.status === "success" || item.status === "error")
      || null;
  }, [jobs]);

  if (!job) return null;

  const irPlanificacion = () => {
    window.dispatchEvent(new CustomEvent("irA", { detail: "planificacion" }));
  };

  return (
    <div className={`planning-bg-job planning-bg-job--${job.status}`} role="status" aria-live="polite">
      <div className="planning-bg-job__pulse" />
      <div className="planning-bg-job__copy">
        <span>{job.status === "running" ? "DocenteOS sigue generando" : job.status === "success" ? "Generación completada" : "Generación detenida"}</span>
        <strong>{job.mensaje || job.titulo}</strong>
      </div>
      <button type="button" onClick={irPlanificacion}>
        Ver
      </button>
      {job.status !== "running" && (
        <button type="button" className="planning-bg-job__close" onClick={() => clearGenerationJob(job.id)} aria-label="Ocultar aviso">
          ×
        </button>
      )}
    </div>
  );
}
