export default function AdminIA() {
  const keyConfigured = !!import.meta.env.VITE_ANTHROPIC_API_KEY

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2>Módulo de IA</h2>
        <p>Configuración y estado del Centro IA Docente.</p>
      </div>

      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <span className="admin-stat-icon">🔑</span>
          <strong className="admin-stat-valor" style={{ color: keyConfigured ? '#16a34a' : '#dc2626' }}>
            {keyConfigured ? 'Configurada' : 'No configurada'}
          </strong>
          <small className="admin-stat-label">Anthropic API Key</small>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-icon">🤖</span>
          <strong className="admin-stat-valor">claude-sonnet-4-6</strong>
          <small className="admin-stat-label">Modelo activo</small>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-icon">📚</span>
          <strong className="admin-stat-valor">12</strong>
          <small className="admin-stat-label">Secciones del Centro IA</small>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-icon">💡</span>
          <strong className="admin-stat-valor">29</strong>
          <small className="admin-stat-label">Prompts en el banco</small>
        </div>
      </div>

      <div className="admin-info-panel">
        <h3>Información del módulo</h3>
        <ul className="admin-status-list">
          <li><span className="status-dot green" />Streaming SSE activo</li>
          <li><span className="status-dot green" />Banco de prompts MINERD disponible</li>
          <li><span className="status-dot green" />Laboratorio IA operativo</li>
          <li><span className={`status-dot ${keyConfigured ? 'green' : 'red'}`} />API Key: {keyConfigured ? 'OK' : 'Faltante — revisa .env'}</li>
        </ul>
      </div>
    </div>
  )
}
