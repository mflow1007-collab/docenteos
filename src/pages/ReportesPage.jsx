import { useEffect, useMemo, useRef, useState } from "react";
import { AIService } from "../services/ai/AIService.js";
import "./ReportesPage.css";

function barWidth(valor, max) {
  if (!max || !valor) return "0%";
  return `${Math.round((valor / max) * 100)}%`;
}

function clasificarPromedio(p) {
  if (p >= 90) return { label: "Excelente", cls: "nivel-excelente" };
  if (p >= 75) return { label: "Bueno",     cls: "nivel-bueno"     };
  if (p >= 60) return { label: "Regular",   cls: "nivel-regular"   };
  return          { label: "En riesgo",  cls: "nivel-riesgo"    };
}

export default function ReportesPage({
  cursos = [],
  accionIAActiva = null,
  onConsumirAccionIA = () => {},
}) {
  const [cursoId, setCursoId] = useState("todos");
  const [reporteAccion, setReporteAccion] = useState(null);
  const [reportePrompt, setReportePrompt] = useState("");
  const [reporteTexto, setReporteTexto] = useState("");
  const [reporteGenerando, setReporteGenerando] = useState(false);
  const [reporteError, setReporteError] = useState(null);
  const [reporteGuardado, setReporteGuardado] = useState("");
  const [historialReportes, setHistorialReportes] = useState(() => {
    try {
      const raw = localStorage.getItem("docenteos_reportes_ia_v1");
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const reporteRef = useRef(null);

  const cursosFiltrados = useMemo(
    () => (cursoId === "todos" ? cursos : cursos.filter((c) => String(c.id) === cursoId)),
    [cursos, cursoId]
  );

  const globalPromedio = useMemo(() => {
    if (!cursosFiltrados.length) return 0;
    const suma = cursosFiltrados.reduce((acc, c) => acc + (c.promedio ?? 0), 0);
    return Math.round(suma / cursosFiltrados.length);
  }, [cursosFiltrados]);

  const globalEstudiantes = useMemo(
    () => cursosFiltrados.reduce((acc, c) => acc + (c.estudiantes ?? 0), 0),
    [cursosFiltrados]
  );

  const globalEnRiesgo = useMemo(
    () => cursosFiltrados.reduce(
      (acc, c) => acc + (c.estudiantesDetalle ?? []).filter((e) => (e.promedio ?? 100) < 70).length,
      0
    ),
    [cursosFiltrados]
  );

  const globalDestacados = useMemo(
    () => cursosFiltrados.reduce(
      (acc, c) => acc + (c.estudiantesDetalle ?? []).filter((e) => (e.promedio ?? 0) >= 90).length,
      0
    ),
    [cursosFiltrados]
  );

  const maxPromedio = useMemo(
    () => Math.max(...cursosFiltrados.map((c) => c.promedio ?? 0), 1),
    [cursosFiltrados]
  );

  const resumenCursos = useMemo(() => (
    cursosFiltrados.map((curso) => {
      const estudiantes = curso.estudiantesDetalle ?? [];
      const enRiesgo = estudiantes.filter((est) => (est.promedio ?? 100) < 70);
      const destacados = estudiantes.filter((est) => (est.promedio ?? 0) >= 90);
      return [
        `Curso: ${curso.nombre}`,
        `Área: ${curso.area || "General"}`,
        `Promedio: ${curso.promedio ?? "sin datos"}`,
        `Estudiantes: ${curso.estudiantes ?? estudiantes.length ?? 0}`,
        `En riesgo: ${enRiesgo.map((est) => `${est.nombre} (${est.promedio ?? "s/n"})`).join(", ") || "ninguno"}`,
        `Destacados: ${destacados.map((est) => `${est.nombre} (${est.promedio ?? "s/n"})`).join(", ") || "ninguno"}`,
      ].join("\n");
    }).join("\n\n")
  ), [cursosFiltrados]);

  const generarReporteIA = async (accion = reporteAccion, solicitud = reportePrompt) => {
    if (!solicitud?.trim()) return;
    setReporteTexto("");
    setReporteError(null);
    setReporteGuardado("");
    setReporteGenerando(true);
    window.setTimeout(() => reporteRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);

    await AIService.generate({
      module: "reportes",
      system: "Eres DocenteOS AI PRO. Redactas reportes pedagógicos claros, accionables y respetuosos para docentes dominicanos. Usa solo los datos proporcionados y distingue datos reales de recomendaciones.",
      prompt: [
        `Acción solicitada: ${accion?.titulo || "Reporte pedagógico"}`,
        `Solicitud del docente: ${solicitud}`,
        "",
        "Datos reales disponibles:",
        resumenCursos || "No hay datos de cursos filtrados.",
        "",
        "Entrega un borrador editable con: título, contexto, hallazgos, acciones recomendadas y próximos pasos.",
      ].join("\n"),
      maxTokens: 1800,
      onChunk: (chunk) => setReporteTexto((prev) => prev + chunk),
      onFinish: () => setReporteGenerando(false),
      onError: (err) => {
        setReporteError(err);
        setReporteGenerando(false);
      },
    });
  };

  useEffect(() => {
    try {
      localStorage.setItem("docenteos_reportes_ia_v1", JSON.stringify(historialReportes));
    } catch {
      // No bloquear el flujo si el navegador no permite storage.
    }
  }, [historialReportes]);

  const guardarReporteActual = () => {
    if (!reporteTexto.trim()) return;
    const cursoActivo = cursoId === "todos"
      ? "Todos los cursos"
      : cursos.find((curso) => String(curso.id) === cursoId)?.nombre || "Curso";
    const nuevo = {
      id: `rep-ia-${Date.now()}`,
      accionIAId: reporteAccion?.id || "",
      accionTitulo: reporteAccion?.titulo || "Reporte IA",
      cursoId,
      curso: cursoActivo,
      prompt: reportePrompt,
      texto: reporteTexto,
      fecha: new Date().toISOString(),
      origen: "centro-ia",
      modulo: "reportes",
    };
    setHistorialReportes((prev) => [nuevo, ...prev].slice(0, 20));
    setReporteGuardado("Reporte guardado en el historial.");
  };

  useEffect(() => {
    if (!accionIAActiva || accionIAActiva.destino !== "reportes") return;
    const primerCurso = cursos[0];
    if (cursoId === "todos" && primerCurso?.id) {
      setCursoId(String(primerCurso.id));
    }
    setReporteAccion(accionIAActiva);
    setReportePrompt(accionIAActiva.prompt || accionIAActiva.descripcion || "");
    generarReporteIA(accionIAActiva, accionIAActiva.prompt || accionIAActiva.descripcion || "");
    onConsumirAccionIA();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accionIAActiva]);

  if (!cursos.length) {
    return (
      <div className="rep-empty">
        <p>No hay cursos registrados. Crea un curso para ver los reportes.</p>
      </div>
    );
  }

  return (
    <div className="rep-root">
      <header className="rep-header">
        <div>
          <h1>Reportes</h1>
          <p className="rep-sub">Desempeño académico, indicadores y alertas por curso</p>
        </div>
        <select
          className="rep-filtro"
          value={cursoId}
          onChange={(e) => setCursoId(e.target.value)}
        >
          <option value="todos">Todos los cursos</option>
          {cursos.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.nombre} · {c.area}
            </option>
          ))}
        </select>
      </header>

      {(reporteAccion || reporteTexto || reporteGenerando) && (
        <section className="rep-ia-panel" ref={reporteRef}>
          <div className="rep-ia-head">
            <div>
              <span>DocenteOS AI PRO</span>
              <h2>{reporteAccion?.titulo || "Borrador de reporte"}</h2>
            </div>
            <div className="rep-ia-actions">
              <button
                type="button"
                className="rep-ia-btn"
                onClick={() => generarReporteIA()}
                disabled={reporteGenerando || !reportePrompt.trim()}
              >
                {reporteGenerando ? "Generando..." : "Regenerar"}
              </button>
              <button
                type="button"
                className="rep-ia-btn secondary"
                onClick={guardarReporteActual}
                disabled={reporteGenerando || !reporteTexto.trim()}
              >
                Guardar
              </button>
            </div>
          </div>
          <label className="rep-ia-label">
            Solicitud
            <textarea
              value={reportePrompt}
              onChange={(e) => setReportePrompt(e.target.value)}
              disabled={reporteGenerando}
            />
          </label>
          {reporteError && <p className="rep-ia-error">{reporteError}</p>}
          <label className="rep-ia-label">
            Borrador editable
            <textarea
              className="rep-ia-output"
              value={reporteTexto}
              onChange={(e) => setReporteTexto(e.target.value)}
              placeholder={reporteGenerando ? "Generando reporte..." : "El resultado aparecerá aquí."}
            />
          </label>
          {reporteGuardado && <p className="rep-ia-ok">{reporteGuardado}</p>}
        </section>
      )}

      {historialReportes.length > 0 && (
        <section className="rep-seccion">
          <h2>Reportes IA guardados</h2>
          <div className="rep-historial">
            {historialReportes.slice(0, 5).map((reporte) => (
              <article key={reporte.id} className="rep-historial-card">
                <div>
                  <strong>{reporte.accionTitulo}</strong>
                  <span>{reporte.curso} · {new Date(reporte.fecha).toLocaleString("es-DO")}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setReporteAccion({ id: reporte.accionIAId, titulo: reporte.accionTitulo });
                    setReportePrompt(reporte.prompt || "");
                    setReporteTexto(reporte.texto || "");
                    setReporteGuardado("");
                    window.setTimeout(() => reporteRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
                  }}
                >
                  Abrir
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Tarjetas resumen */}
      <section className="rep-kpis">
        <div className="rep-kpi">
          <span className="rep-kpi-valor">{globalEstudiantes}</span>
          <span className="rep-kpi-label">Estudiantes</span>
        </div>
        <div className={`rep-kpi ${clasificarPromedio(globalPromedio).cls}`}>
          <span className="rep-kpi-valor">{globalPromedio}</span>
          <span className="rep-kpi-label">Promedio general</span>
        </div>
        <div className="rep-kpi nivel-excelente">
          <span className="rep-kpi-valor">{globalDestacados}</span>
          <span className="rep-kpi-label">Destacados</span>
        </div>
        <div className={`rep-kpi ${globalEnRiesgo > 0 ? "nivel-riesgo" : "nivel-excelente"}`}>
          <span className="rep-kpi-valor">{globalEnRiesgo}</span>
          <span className="rep-kpi-label">En riesgo</span>
        </div>
      </section>

      {/* Tabla de cursos */}
      <section className="rep-seccion">
        <h2>Promedio por curso</h2>
        <div className="rep-tabla">
          {cursosFiltrados.map((c) => {
            const { label, cls } = clasificarPromedio(c.promedio ?? 0);
            return (
              <div key={c.id} className="rep-fila">
                <div className="rep-fila-info">
                  <span className="rep-fila-nombre">{c.nombre}</span>
                  <span className="rep-fila-area">{c.area}</span>
                </div>
                <div className="rep-barra-wrap">
                  <div
                    className={`rep-barra ${cls}`}
                    style={{ width: barWidth(c.promedio, maxPromedio) }}
                  />
                </div>
                <span className={`rep-badge ${cls}`}>{c.promedio ?? 0} · {label}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Estudiantes en riesgo */}
      {globalEnRiesgo > 0 && (
        <section className="rep-seccion">
          <h2>Estudiantes en riesgo</h2>
          <div className="rep-riesgo-grid">
            {cursosFiltrados.flatMap((c) =>
              (c.estudiantesDetalle ?? [])
                .filter((e) => (e.promedio ?? 100) < 70)
                .map((est, i) => (
                  <div key={`${c.id}-${i}`} className="rep-riesgo-card">
                    <strong>{est.nombre ?? "Estudiante"}</strong>
                    <span>{c.nombre}</span>
                    {est.promedio != null && (
                      <span className="rep-badge nivel-riesgo">{est.promedio}</span>
                    )}
                  </div>
                ))
            )}
          </div>
        </section>
      )}

      {/* Estudiantes destacados */}
      {globalDestacados > 0 && (
        <section className="rep-seccion">
          <h2>Estudiantes destacados</h2>
          <div className="rep-dest-grid">
            {cursosFiltrados.flatMap((c) =>
              (c.estudiantesDetalle ?? [])
                .filter((e) => (e.promedio ?? 0) >= 90)
                .map((est, i) => (
                  <div key={`${c.id}-${i}`} className="rep-dest-card">
                    <strong>{est.nombre ?? "Estudiante"}</strong>
                    <span>{c.nombre}</span>
                    <span className="rep-badge nivel-excelente">{est.promedio}</span>
                  </div>
                ))
            )}
          </div>
        </section>
      )}
    </div>
  );
}
