import { useCallback, useEffect, useState } from "react";
import { collection, query, orderBy, limit, getDocs, where } from "firebase/firestore";
import { db } from "../../firebase.js";

const TIPOS = [
  "todos",
  "chat_consultado",
  "planificacion_generada",
  "memoria_creada",
  "caso_registrado",
  "estilo_detectado",
  "evaluacion_aplicada",
  "registro_guardado",
];

function formatTs(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("es-DO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function shortId(id) {
  if (!id) return "—";
  return id.length > 10 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
}

export default function AdminLogs() {
  const [eventos, setEventos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [busqueda, setBusqueda] = useState("");

  const cargarEventos = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const q = query(
        collection(db, "le_eventos"),
        orderBy("timestamp", "desc"),
        limit(150)
      );
      const snap = await getDocs(q);
      setEventos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      setError("Error cargando eventos: " + (e.message || e));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargarEventos(); }, [cargarEventos]);

  const filtrados = eventos.filter((e) => {
    if (filtroTipo !== "todos" && e.tipo !== filtroTipo) return false;
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      return (
        (e.tipo || "").toLowerCase().includes(q) ||
        (e.agentId || "").toLowerCase().includes(q) ||
        (e.area || "").toLowerCase().includes(q) ||
        (e.asignatura || "").toLowerCase().includes(q) ||
        (e.tema || "").toLowerCase().includes(q) ||
        (e.userId || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h2>Logs del Sistema</h2>
          <p>Eventos del Learning Engine registrados en <code>le_eventos</code>.</p>
        </div>
        <button className="admin-btn" onClick={cargarEventos} disabled={cargando}>
          {cargando ? "Cargando…" : "↺ Actualizar"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Buscar por tipo, agente, área, tema, userId…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{ flex: "1 1 240px", padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }}
        />
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }}
        >
          {TIPOS.map((t) => (
            <option key={t} value={t}>{t === "todos" ? "Todos los tipos" : t}</option>
          ))}
        </select>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "12px 16px", color: "#dc2626", marginBottom: 16, fontSize: 14 }}>
          ⚠️ {error}
        </div>
      )}

      {cargando ? (
        <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>Cargando eventos…</div>
      ) : filtrados.length === 0 ? (
        <div className="admin-placeholder">
          <span className="admin-placeholder-icon">📋</span>
          <h3>{eventos.length === 0 ? "Sin eventos registrados" : "Sin resultados"}</h3>
          <p>{eventos.length === 0 ? "Los eventos del Learning Engine aparecerán aquí en cuanto se registren." : "Prueba cambiando el filtro o la búsqueda."}</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                {["Timestamp", "Tipo", "Agente", "Área / Asig.", "Tema", "Usuario", "Grado"].map((h) => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#64748b", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((e) => (
                <tr key={e.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "8px 12px", color: "#64748b", whiteSpace: "nowrap" }}>{formatTs(e.timestamp)}</td>
                  <td style={{ padding: "8px 12px" }}>
                    <span style={{ background: "#eff6ff", color: "#1d4ed8", borderRadius: 6, padding: "2px 8px", fontWeight: 600, fontSize: 12 }}>
                      {e.tipo || "—"}
                    </span>
                  </td>
                  <td style={{ padding: "8px 12px", color: "#475569" }}>{e.agentId || "—"}</td>
                  <td style={{ padding: "8px 12px", color: "#475569" }}>{[e.area, e.asignatura].filter(Boolean).join(" / ") || "—"}</td>
                  <td style={{ padding: "8px 12px", color: "#334155", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.tema || "—"}</td>
                  <td style={{ padding: "8px 12px", color: "#64748b", fontFamily: "monospace", fontSize: 12 }}>{shortId(e.userId)}</td>
                  <td style={{ padding: "8px 12px", color: "#64748b" }}>{e.grado || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 12, textAlign: "right" }}>
            Mostrando {filtrados.length} de {eventos.length} eventos (últimos 150)
          </p>
        </div>
      )}
    </div>
  );
}
