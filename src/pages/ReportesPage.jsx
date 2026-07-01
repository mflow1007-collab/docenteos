import { useMemo, useState } from "react";
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

export default function ReportesPage({ cursos = [] }) {
  const [cursoId, setCursoId] = useState("todos");

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
    () => cursosFiltrados.reduce((acc, c) => acc + (c.enRiesgo?.length ?? 0), 0),
    [cursosFiltrados]
  );

  const globalDestacados = useMemo(
    () =>
      cursosFiltrados.reduce(
        (acc, c) => acc + (c.destacados?.filter((e) => (e.promedio ?? 0) >= 90).length ?? 0),
        0
      ),
    [cursosFiltrados]
  );

  const maxPromedio = useMemo(
    () => Math.max(...cursosFiltrados.map((c) => c.promedio ?? 0), 1),
    [cursosFiltrados]
  );

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
              (c.enRiesgo ?? []).map((est, i) => (
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
              (c.destacados ?? [])
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
