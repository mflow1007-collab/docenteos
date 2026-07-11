import { useEffect, useMemo, useState } from "react";
import { obtenerEvidenciasCurso } from "../firebase.js";

const fechaLegible = (valor) => {
  if (!valor) return "Sin fecha";
  const fecha = valor?.toDate?.() || new Date(valor);
  if (Number.isNaN(fecha.getTime())) return "Sin fecha";
  return fecha.toLocaleDateString("es-DO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const iconoCategoria = (categoria = "") => {
  const texto = String(categoria).toLowerCase();
  if (texto.includes("foto") || texto.includes("video")) return "📸";
  if (texto.includes("oral")) return "🎙️";
  if (texto.includes("rúbrica") || texto.includes("rubrica")) return "📊";
  if (texto.includes("cotejo")) return "☑️";
  if (texto.includes("escrito")) return "📝";
  return "📌";
};

function normalizar(valor = "") {
  return String(valor || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export default function BancoEvidenciasPage({ cursos = [], cursoActivo = null, onIrA, onAbrirPerfil }) {
  const [cursoId, setCursoId] = useState(() => String(cursoActivo?.id || cursos[0]?.id || ""));
  const [evidencias, setEvidencias] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    if (!cursoId && cursos[0]?.id) setCursoId(String(cursos[0].id));
  }, [cursoId, cursos]);

  const curso = useMemo(
    () => cursos.find((item) => String(item.id) === String(cursoId)) || cursoActivo || cursos[0] || null,
    [cursos, cursoActivo, cursoId]
  );

  useEffect(() => {
    let vigente = true;
    if (!cursoId) {
      setEvidencias([]);
      return () => { vigente = false; };
    }
    setCargando(true);
    setError("");
    obtenerEvidenciasCurso(cursoId)
      .then((res) => {
        if (!vigente) return;
        const datos = Array.isArray(res?.data) ? res.data : [];
        datos.sort((a, b) => String(b.fecha || b.creadoEn || "").localeCompare(String(a.fecha || a.creadoEn || "")));
        setEvidencias(datos);
      })
      .catch((err) => {
        if (!vigente) return;
        setError(err?.message || "No se pudieron cargar las evidencias.");
        setEvidencias([]);
      })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [cursoId]);

  const estudiantesCurso = curso?.estudiantesDetalle || [];
  const evidenciasFiltradas = useMemo(() => {
    const q = normalizar(busqueda);
    if (!q) return evidencias;
    return evidencias.filter((ev) => normalizar([
      ev.estudianteNombre,
      ev.texto,
      ev.descripcion,
      ev.categoria,
      ev.momento,
      ev.claseTitulo,
      ev.temaUnidad,
    ].filter(Boolean).join(" ")).includes(q));
  }, [busqueda, evidencias]);

  const grupos = useMemo(() => {
    const map = new Map();
    evidenciasFiltradas.forEach((ev) => {
      const key = ev.estudianteId || ev.estudianteNombre || "sin-estudiante";
      if (!map.has(key)) {
        map.set(key, {
          estudianteId: ev.estudianteId || "",
          estudianteNombre: ev.estudianteNombre || "Sin estudiante vinculado",
          evidencias: [],
        });
      }
      map.get(key).evidencias.push(ev);
    });
    return [...map.values()].sort((a, b) => a.estudianteNombre.localeCompare(b.estudianteNombre, "es"));
  }, [evidenciasFiltradas]);

  const abrirPerfil = (grupo) => {
    const estudiante = estudiantesCurso.find((item) => String(item.id) === String(grupo.estudianteId))
      || estudiantesCurso.find((item) => normalizar(item.nombre) === normalizar(grupo.estudianteNombre));
    if (estudiante) {
      onAbrirPerfil?.({
        ...estudiante,
        cursoId: curso?.id,
        cursoNombre: curso?.nombre,
        area: curso?.area,
        grado: curso?.grado || curso?.nombre,
        seccion: curso?.seccion,
      });
    }
  };

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#c2410c", textTransform: "uppercase", letterSpacing: ".5px" }}>
            Banco de Evidencias
          </div>
          <h1 style={{ margin: "4px 0 6px", color: "#0f172a", fontSize: 28 }}>Evidencias pedagógicas</h1>
          <p style={{ margin: 0, color: "#64748b", maxWidth: 680 }}>
            Evidencias vinculadas a estudiantes, curso, planificación, clase, momento e indicadores.
          </p>
        </div>
        <button
          onClick={() => onIrA?.("modo-aula")}
          style={{
            background: "#fff7ed",
            color: "#c2410c",
            border: "1px solid #fed7aa",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 13,
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Volver a Modo Aula
        </button>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(220px, 320px) minmax(220px, 1fr)",
        gap: 12,
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        padding: 14,
        boxShadow: "0 10px 24px rgba(15,23,42,.06)",
        marginBottom: 16,
      }}>
        <label>
          <span style={{ display: "block", fontSize: 11, fontWeight: 900, color: "#334155", textTransform: "uppercase", marginBottom: 6 }}>
            Curso
          </span>
          <select
            value={cursoId}
            onChange={(e) => setCursoId(e.target.value)}
            style={{
              width: "100%",
              border: "1px solid #cbd5e1",
              borderRadius: 9,
              padding: "10px 12px",
              fontSize: 13,
              color: "#0f172a",
              background: "#fff",
            }}
          >
            {cursos.length === 0 && <option value="">Sin cursos</option>}
            {cursos.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.nombre || item.grado} · {item.area || "Área"}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span style={{ display: "block", fontSize: 11, fontWeight: 900, color: "#334155", textTransform: "uppercase", marginBottom: 6 }}>
            Buscar
          </span>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Estudiante, evidencia, momento, clase..."
            style={{
              width: "100%",
              boxSizing: "border-box",
              border: "1px solid #cbd5e1",
              borderRadius: 9,
              padding: "10px 12px",
              fontSize: 13,
              color: "#0f172a",
            }}
          />
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginBottom: 16 }}>
        {[
          ["Evidencias", evidencias.length],
          ["Estudiantes con evidencia", grupos.length],
          ["Estudiantes del curso", estudiantesCurso.length || curso?.estudiantes || 0],
        ].map(([label, value]) => (
          <div key={label} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 950, color: "#0f172a", marginTop: 4 }}>{value}</div>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 12, padding: 14, fontWeight: 800 }}>
          {error}
        </div>
      )}

      {cargando ? (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: 28, color: "#64748b", textAlign: "center" }}>
          Cargando evidencias...
        </div>
      ) : grupos.length === 0 ? (
        <div style={{ background: "#fff", border: "1px dashed #cbd5e1", borderRadius: 14, padding: 34, textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📸</div>
          <h2 style={{ margin: "0 0 6px", color: "#0f172a" }}>Aún no hay evidencias en este curso</h2>
          <p style={{ margin: 0, color: "#64748b" }}>
            Registra evidencias desde Modo Aula para que aparezcan aquí y en el expediente del estudiante.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {grupos.map((grupo) => (
            <section key={grupo.estudianteId || grupo.estudianteNombre} style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              boxShadow: "0 10px 24px rgba(15,23,42,.05)",
              overflow: "hidden",
            }}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                padding: "14px 16px",
                borderBottom: "1px solid #f1f5f9",
                background: "#fff7ed",
              }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 17, color: "#111827" }}>{grupo.estudianteNombre}</h2>
                  <div style={{ fontSize: 12, color: "#9a3412", fontWeight: 800 }}>{grupo.evidencias.length} evidencia(s)</div>
                </div>
                <button
                  onClick={() => abrirPerfil(grupo)}
                  disabled={!grupo.estudianteId}
                  style={{
                    background: grupo.estudianteId ? "#c2410c" : "#fed7aa",
                    color: "#fff",
                    border: 0,
                    borderRadius: 9,
                    padding: "8px 12px",
                    fontSize: 12,
                    fontWeight: 900,
                    cursor: grupo.estudianteId ? "pointer" : "default",
                  }}
                >
                  Abrir expediente
                </button>
              </div>
              <div style={{ display: "grid", gap: 10, padding: 14 }}>
                {grupo.evidencias.map((ev) => (
                  <article key={ev.evidenciaId || ev.id} style={{
                    border: "1px solid #fee2e2",
                    borderRadius: 11,
                    padding: 12,
                    display: "grid",
                    gridTemplateColumns: "38px minmax(0, 1fr)",
                    gap: 10,
                  }}>
                    <div style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      background: "#fff7ed",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 18,
                    }}>
                      {iconoCategoria(ev.categoria || ev.tipo)}
                    </div>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
                        <strong style={{ color: "#0f172a", fontSize: 13 }}>{ev.categoria || ev.tipo || "Evidencia"}</strong>
                        <span style={{ color: "#94a3b8", fontSize: 11, whiteSpace: "nowrap" }}>{fechaLegible(ev.fecha || ev.creadoEn)}</span>
                      </div>
                      <p style={{ margin: "0 0 8px", color: "#475569", fontSize: 13, lineHeight: 1.5 }}>
                        {ev.texto || ev.descripcion || "Sin descripción"}
                      </p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {[ev.momento, ev.claseTitulo, ev.temaUnidad].filter(Boolean).map((item) => (
                          <span key={item} style={{
                            background: "#f8fafc",
                            border: "1px solid #e2e8f0",
                            color: "#475569",
                            borderRadius: 999,
                            padding: "4px 8px",
                            fontSize: 11,
                            fontWeight: 800,
                          }}>
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
