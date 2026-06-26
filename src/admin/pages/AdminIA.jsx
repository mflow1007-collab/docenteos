import { useState, useEffect } from "react";
import { AIConfig } from "../../services/ai/AIConfig";

const PROVIDERS = [
  { id: "openai",    displayName: "OpenAI",    model: "gpt-4o",            envVar: "OPENAI_API_KEY" },
  { id: "abacus",    displayName: "Abacus AI",  model: "route-llm",         envVar: "ABACUS_API_KEY" },
  { id: "anthropic", displayName: "Anthropic",  model: "claude-sonnet-4-6", envVar: "ANTHROPIC_API_KEY" },
];

export default function AdminIA() {
  const [status, setStatus]           = useState(null);
  const [loadingStatus, setLoadStatus] = useState(true);
  const [testResults, setTestResults] = useState({});
  const [testing, setTesting]         = useState({});

  useEffect(() => {
    fetch("/api/ai/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { setStatus(data); setLoadStatus(false); })
      .catch(() => setLoadStatus(false));
  }, []);

  const handleTest = async (providerId) => {
    setTesting((p) => ({ ...p, [providerId]: true }));
    setTestResults((p) => ({ ...p, [providerId]: null }));
    try {
      const res = await fetch("/api/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: providerId }),
      });
      const data = await res.json();
      setTestResults((p) => ({ ...p, [providerId]: data }));
    } catch {
      setTestResults((p) => ({ ...p, [providerId]: { ok: false, error: "Error de conexión" } }));
    }
    setTesting((p) => ({ ...p, [providerId]: false }));
  };

  const pInfo = (id) => status?.providers?.[id] ?? null;
  const priority = AIConfig.providerPriority;
  const configuredCount = status
    ? Object.values(status.providers || {}).filter((p) => p.configured).length
    : 0;
  const activeName = status?.primaryProvider
    ? (PROVIDERS.find((p) => p.id === status.primaryProvider)?.displayName ?? "—")
    : loadingStatus ? "—" : "Ninguno";

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div className="admin-page-header-text">
          <h2>IA — Gateway de Proveedores</h2>
          <p>
            Gestión centralizada de proveedores. Las API keys viven solo en el servidor
            — nunca en el navegador.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card green">
          <span className="admin-stat-icon">🔒</span>
          <strong className="admin-stat-valor" style={{ color: "var(--adm-success)" }}>
            Seguro
          </strong>
          <small className="admin-stat-label">API Keys en servidor</small>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-icon">🔀</span>
          <strong className="admin-stat-valor">
            {loadingStatus ? "—" : `${configuredCount} / ${PROVIDERS.length}`}
          </strong>
          <small className="admin-stat-label">Proveedores configurados</small>
        </div>
        <div className="admin-stat-card blue">
          <span className="admin-stat-icon">⚡</span>
          <strong className="admin-stat-valor">{activeName}</strong>
          <small className="admin-stat-label">Proveedor activo</small>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-icon">🔁</span>
          <strong className="admin-stat-valor">Automático</strong>
          <small className="admin-stat-label">Fallback entre proveedores</small>
        </div>
      </div>

      {/* Provider cards */}
      <h3 style={{ color: "var(--adm-text)", margin: "28px 0 14px", fontSize: 15, fontWeight: 600 }}>
        Estado de proveedores
      </h3>
      <div className="ai-provider-grid">
        {PROVIDERS.map((provider, idx) => {
          const info       = pInfo(provider.id);
          const configured = info?.configured ?? false;
          const result     = testResults[provider.id];
          const isTesting  = testing[provider.id] ?? false;
          const priorPos   = priority.indexOf(provider.id) + 1;

          /* Color / texto de estado */
          let dotColor = "var(--adm-dim)";
          let statusText = "No configurado";
          let glowing = false;
          if (configured && !result) { dotColor = "var(--adm-warning)"; statusText = "Configurado"; }
          if (result?.ok)            { dotColor = "var(--adm-success)"; statusText = "Disponible"; glowing = true; }
          if (result && !result.ok)  { dotColor = "var(--adm-danger)";  statusText = result.error || "Error"; }
          if (isTesting)             { statusText = "Probando…"; }

          return (
            <div
              key={provider.id}
              className={`ai-provider-card${!configured ? " ai-provider-card--off" : ""}${result?.ok ? " ai-provider-card--ok" : ""}`}
            >
              {/* Header */}
              <div className="ai-prov-header">
                <div>
                  <div className="ai-prov-name">
                    <span
                      className="ai-prov-dot"
                      style={{
                        background: dotColor,
                        boxShadow: glowing ? `0 0 7px ${dotColor}` : "none",
                      }}
                    />
                    {provider.displayName}
                  </div>
                  <div className="ai-prov-priority">Prioridad #{priorPos}</div>
                </div>
                {idx === 0 && configured && (
                  <span className="ai-prov-badge">Principal</span>
                )}
              </div>

              {/* Details */}
              <div className="ai-prov-rows">
                <div className="ai-prov-row">
                  <span className="ai-prov-label">Modelo activo</span>
                  <code className="ai-prov-val">{provider.model}</code>
                </div>
                <div className="ai-prov-row">
                  <span className="ai-prov-label">API configurada</span>
                  <span
                    className="ai-prov-val"
                    style={{ color: loadingStatus ? "var(--adm-dim)" : configured ? "var(--adm-success)" : "var(--adm-danger)" }}
                  >
                    {loadingStatus ? "—" : configured ? "Sí" : "No"}
                  </span>
                </div>
                <div className="ai-prov-row">
                  <span className="ai-prov-label">Estado</span>
                  <span className="ai-prov-val" style={{ color: dotColor }}>
                    {loadingStatus ? "—" : statusText}
                  </span>
                </div>
                {result?.ok && (
                  <div className="ai-prov-row">
                    <span className="ai-prov-label">Tiempo de respuesta</span>
                    <span className="ai-prov-val">{result.responseTime} ms</span>
                  </div>
                )}
              </div>

              {/* Test result */}
              {result?.ok && (
                <div className="ai-test-ok">✓ Conectado correctamente</div>
              )}
              {result && !result.ok && (
                <div className="ai-test-fail">✗ {result.error}</div>
              )}

              {/* Test button */}
              <button
                className="ai-test-btn"
                disabled={!configured || isTesting}
                onClick={() => handleTest(provider.id)}
              >
                {isTesting ? "Probando…" : "Probar conexión"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Fallback order */}
      <div className="admin-info-panel" style={{ marginTop: 24 }}>
        <h3>Orden de fallback automático</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
          {priority.map((id, i) => {
            const configured = pInfo(id)?.configured ?? false;
            const name = PROVIDERS.find((p) => p.id === id)?.displayName || id;
            return (
              <span key={id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    padding: "4px 14px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    background: configured ? "var(--adm-success-bg)" : "var(--adm-surface2)",
                    color: configured ? "var(--adm-success)" : "var(--adm-dim)",
                    border: `1px solid ${configured ? "var(--adm-success)" : "var(--adm-border)"}`,
                  }}
                >
                  {name}
                </span>
                {i < priority.length - 1 && (
                  <span style={{ color: "var(--adm-dim)", fontSize: 18 }}>→</span>
                )}
              </span>
            );
          })}
        </div>
        <p style={{ fontSize: 12, color: "var(--adm-dim)", marginTop: 10 }}>
          El Gateway prueba en este orden y usa el primero disponible. Si uno falla, pasa automáticamente al siguiente sin mostrar errores al usuario.
        </p>
      </div>

      {/* Architecture */}
      <div className="admin-info-panel" style={{ marginTop: 16 }}>
        <h3>Arquitectura del AI Gateway</h3>
        <ul className="admin-status-list">
          <li>
            <span className="status-dot green" />
            Endpoint unificado — <code>/api/ai/generate</code> (Vercel Edge Runtime)
          </li>
          <li>
            <span className="status-dot green" />
            Stream SSE normalizado — mismo formato para todos los proveedores
          </li>
          <li>
            <span className="status-dot green" />
            Cache de respuestas en Firestore (<code>aiCache/</code>) — ahorra tokens
          </li>
          <li>
            <span className="status-dot green" />
            Historial de uso en Firestore (<code>aiLogs/</code>) — proveedor, modelo, costo estimado
          </li>
          <li>
            <span className="status-dot green" />
            Fallback automático y silencioso entre proveedores
          </li>
        </ul>
        <p style={{ fontSize: 12, color: "var(--adm-dim)", marginTop: 8 }}>
          Agrega las API keys en <strong>Vercel Dashboard → Settings → Environment Variables</strong>.
          Nunca uses el prefijo <code>VITE_</code> para claves de IA.
        </p>
      </div>
    </div>
  );
}
