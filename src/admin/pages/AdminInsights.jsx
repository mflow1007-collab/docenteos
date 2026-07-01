import { useState, useEffect, useCallback } from 'react'
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore'
import { db } from '../../firebase.js'
import { COLLECTIONS, INSIGHT_STATES } from '../../services/ai/knowledge/KnowledgeTypes.js'
import { resolveInsight, analyzePatterns } from '../../services/ai/learning/InsightAnalyzer.js'

// ── Helpers ────────────────────────────────────────────────────────────────────

const TIPO_META = {
  patron_regeneracion:  { label: 'Regeneración',  color: '#7c3aed', bg: '#faf5ff', icono: '🔄' },
  patron_modificacion:  { label: 'Modificación',  color: '#2563eb', bg: '#eff6ff', icono: '✏️' },
  patron_exito:         { label: 'Éxito',         color: '#059669', bg: '#dcfce7', icono: '✅' },
  patron_riesgo:        { label: 'Riesgo NEAE',   color: '#dc2626', bg: '#fee2e2', icono: '⚠️' },
  patron_instrumento:   { label: 'Instrumento',   color: '#d97706', bg: '#fef9c3', icono: '📋' },
  patron_auditoria:     { label: 'Auditoría',     color: '#0891b2', bg: '#ecfeff', icono: '🔍' },
  patron_plantilla:     { label: 'Plantilla',     color: '#7c3aed', bg: '#faf5ff', icono: '📄' },
  patron_detectado:     { label: 'Detectado',     color: '#64748b', bg: '#f8fafc', icono: '📊' },
}

const ESTADO_META = {
  [INSIGHT_STATES.PENDING]:  { label: 'Pendiente', color: '#854d0e', bg: '#fef9c3' },
  [INSIGHT_STATES.APPROVED]: { label: 'Aprobado',  color: '#166534', bg: '#dcfce7' },
  [INSIGHT_STATES.REJECTED]: { label: 'Rechazado', color: '#991b1b', bg: '#fee2e2' },
  [INSIGHT_STATES.REVIEWED]: { label: 'Revisado',  color: '#475569', bg: '#f1f5f9' },
}

function TipoBadge({ tipo }) {
  const c = TIPO_META[tipo] || TIPO_META.patron_detectado
  return (
    <span style={{ background: c.bg, color: c.color, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>
      {c.icono} {c.label}
    </span>
  )
}

function EstadoBadge({ estado }) {
  const c = ESTADO_META[estado] || { label: estado, color: '#64748b', bg: '#f1f5f9' }
  return (
    <span style={{ background: c.bg, color: c.color, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
      {c.label}
    </span>
  )
}

function formatFecha(ts) {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })
}

const TABS = [
  { value: 'todos',                    label: 'Todos' },
  { value: INSIGHT_STATES.PENDING,     label: 'Pendientes' },
  { value: INSIGHT_STATES.APPROVED,    label: 'Aprobados' },
  { value: INSIGHT_STATES.REJECTED,    label: 'Rechazados' },
]

// ── Componente principal ──────────────────────────────────────────────────────

export default function AdminInsights() {
  const [insights, setInsights]       = useState([])
  const [cargando, setCargando]       = useState(true)
  const [error, setError]             = useState('')
  const [tabActiva, setTab]           = useState('todos')
  const [analizando, setAnalizando]   = useState(false)
  const [msgAnalisis, setMsgAnalisis] = useState('')
  const [resolviendo, setResolviendo] = useState(null)

  const cargar = useCallback(async () => {
    if (!db) { setCargando(false); return }
    setCargando(true); setError('')
    try {
      const q = query(
        collection(db, COLLECTIONS.LE_INSIGHTS),
        orderBy('creadoEn', 'desc'),
        limit(200)
      )
      const snap = await getDocs(q)
      setInsights(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (e) {
      setError('Error cargando insights: ' + (e.message || e))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const ejecutarAnalisis = async () => {
    setAnalizando(true); setMsgAnalisis(''); setError('')
    try {
      const ids = await analyzePatterns({ limite: 200 })
      setMsgAnalisis(
        ids.length > 0
          ? `✅ Análisis completado. ${ids.length} insight${ids.length > 1 ? 's' : ''} generado${ids.length > 1 ? 's' : ''}.`
          : '✅ Análisis completado. Sin patrones nuevos detectados.'
      )
      if (ids.length > 0) await cargar()
    } catch (e) {
      setError('Error en análisis: ' + (e.message || e))
    } finally {
      setAnalizando(false)
    }
  }

  const resolver = async (id, decision) => {
    setResolviendo(id)
    try {
      await resolveInsight(id, decision)
      setInsights(prev => prev.map(ins =>
        ins.id === id
          ? { ...ins, estado: decision === 'aprobado' ? INSIGHT_STATES.APPROVED : INSIGHT_STATES.REJECTED }
          : ins
      ))
    } catch (e) {
      setError('Error: ' + (e.message || e))
    } finally {
      setResolviendo(null)
    }
  }

  const visibles = tabActiva === 'todos'
    ? insights
    : insights.filter(i => i.estado === tabActiva)

  const pendientes = insights.filter(i => i.estado === INSIGHT_STATES.PENDING).length
  const aprobados  = insights.filter(i => i.estado === INSIGHT_STATES.APPROVED).length

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h2>Insights del Learning Engine</h2>
          <p>Patrones detectados en el comportamiento de los docentes. Apruébalos para convertirlos en memorias del Knowledge Engine.</p>
        </div>
        <button
          className="admin-btn admin-btn-primary"
          onClick={ejecutarAnalisis}
          disabled={analizando}
        >
          {analizando ? 'Analizando…' : '⚡ Ejecutar análisis'}
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total insights',  valor: insights.length,  color: '#2563eb' },
          { label: 'Pendientes',      valor: pendientes,       color: '#d97706' },
          { label: 'Aprobados',       valor: aprobados,        color: '#059669' },
        ].map(({ label, valor, color }) => (
          <div key={label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 18px', borderTop: `3px solid ${color}` }}>
            <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{valor}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', color: '#dc2626', marginBottom: 16, fontSize: 14 }}>
          ⚠️ {error}
        </div>
      )}
      {msgAnalisis && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '12px 16px', color: '#166534', marginBottom: 16, fontSize: 14 }}>
          {msgAnalisis}
        </div>
      )}

      {/* Flujo explicativo */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#475569' }}>
        <strong>Flujo:</strong> Insight pendiente → Admin aprueba → se convierte en memoria activa en el agente correspondiente → se inyecta en futuros prompts. Rechazar descarta el insight sin crear memoria.
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '2px solid #f1f5f9' }}>
        {TABS.map(t => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 600,
              background: 'none', border: 'none', cursor: 'pointer',
              color: tabActiva === t.value ? '#6366f1' : '#64748b',
              borderBottom: tabActiva === t.value ? '2px solid #6366f1' : '2px solid transparent',
              marginBottom: -2,
            }}
          >
            {t.label}
            {t.value === INSIGHT_STATES.PENDING && pendientes > 0 && (
              <span style={{ marginLeft: 6, background: '#f97316', color: '#fff', fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 20 }}>
                {pendientes}
              </span>
            )}
          </button>
        ))}
      </div>

      {cargando ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Cargando insights…</div>
      ) : visibles.length === 0 ? (
        <div className="admin-table-empty">
          {tabActiva === INSIGHT_STATES.PENDING
            ? 'Sin insights pendientes. Ejecuta el análisis para detectar patrones nuevos.'
            : 'Sin insights para este filtro.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {visibles.map(ins => (
            <div key={ins.id} style={{
              background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
              padding: '16px 20px',
              borderLeft: `4px solid ${TIPO_META[ins.tipo]?.color || '#94a3b8'}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                    <TipoBadge tipo={ins.tipo} />
                    <EstadoBadge estado={ins.estado} />
                    {ins.convertidoEnMemoria && (
                      <span style={{ background: '#eff6ff', color: '#2563eb', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
                        🧠 En memoria
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>{ins.umbralPct}% de eventos</span>
                  </div>

                  <p style={{ margin: '0 0 8px', fontSize: 14, color: '#1e293b', lineHeight: 1.5 }}>
                    {ins.descripcion || '—'}
                  </p>

                  {ins.accionSugerida && (
                    <div style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#334155', marginBottom: 8 }}>
                      <strong>Acción sugerida:</strong> {ins.accionSugerida}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#64748b', flexWrap: 'wrap' }}>
                    {ins.area       && <span>Área: <strong>{ins.area}</strong></span>}
                    {ins.asignatura && <span>Asignatura: <strong>{ins.asignatura}</strong></span>}
                    {ins.grado      && <span>Grado: <strong>{ins.grado}</strong></span>}
                    {ins.tema       && <span>Tema: <strong>{ins.tema}</strong></span>}
                    <span>{ins.evidencias?.length ?? 0} eventos base</span>
                    <span>{formatFecha(ins.creadoEn)}</span>
                  </div>
                </div>

                {/* Acciones */}
                {ins.estado === INSIGHT_STATES.PENDING && (
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button
                      className="admin-btn-sm green"
                      disabled={resolviendo === ins.id}
                      onClick={() => resolver(ins.id, 'aprobado')}
                      style={{ padding: '6px 14px' }}
                    >
                      {resolviendo === ins.id ? '…' : '✓ Aprobar'}
                    </button>
                    <button
                      className="admin-btn-sm red"
                      disabled={resolviendo === ins.id}
                      onClick={() => resolver(ins.id, 'rechazado')}
                      style={{ padding: '6px 14px' }}
                    >
                      ✕ Rechazar
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p style={{ color: '#94a3b8', fontSize: 12, textAlign: 'right', marginTop: 16 }}>
        {visibles.length} insights mostrados de {insights.length} total · colección <code>le_insights</code>
      </p>
    </div>
  )
}
