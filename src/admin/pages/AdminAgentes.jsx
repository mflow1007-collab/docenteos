import { useState, useEffect } from 'react'
import {
  collection, getDocs, query, orderBy, doc, updateDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../firebase.js'
import { COLLECTIONS, STATES, AGENT_IDS, MEMORY_TYPES } from '../../services/ai/knowledge/KnowledgeTypes.js'

// ── Config de agentes conocidos ───────────────────────────────────────────────

const AGENTES_META = {
  [AGENT_IDS.PLANIFICADOR]:           { nombre: 'Planificador',          icono: '📝', desc: 'Genera planificaciones curriculares semanales y de unidad' },
  [AGENT_IDS.AUDITOR]:                { nombre: 'Auditor Pedagógico',    icono: '🔍', desc: 'Revisa y retroalimenta la calidad pedagógica de planificaciones' },
  [AGENT_IDS.MEJORADOR_ACTIVIDADES]:  { nombre: 'Mejorador de Actividades', icono: '✏️', desc: 'Sugiere mejoras a actividades de aprendizaje' },
  [AGENT_IDS.GENERADOR_INSTRUMENTOS]: { nombre: 'Generador de Instrumentos', icono: '📋', desc: 'Crea rúbricas, listas de cotejo y escalas de estimación' },
  [AGENT_IDS.GENERADOR_REPORTES]:     { nombre: 'Generador de Reportes',  icono: '📊', desc: 'Crea informes de apoyo y planes de intervención' },
  [AGENT_IDS.CHAT_DOCENTE]:           { nombre: 'Asistente Personal',    icono: '💬', desc: 'Asistente conversacional del docente' },
}

const ESTADO_COLORS = {
  [STATES.ACTIVE]:   { bg: '#dcfce7', color: '#166534', label: 'Activa' },
  [STATES.PENDING]:  { bg: '#fef9c3', color: '#854d0e', label: 'Pendiente' },
  [STATES.INACTIVE]: { bg: '#f1f5f9', color: '#475569', label: 'Inactiva' },
  [STATES.REJECTED]: { bg: '#fee2e2', color: '#991b1b', label: 'Rechazada' },
  [STATES.ARCHIVED]: { bg: '#f1f5f9', color: '#64748b', label: 'Archivada' },
}

function EstadoBadge({ estado }) {
  const cfg = ESTADO_COLORS[estado] || { bg: '#f1f5f9', color: '#64748b', label: estado }
  return (
    <span style={{
      background: cfg.bg, color: cfg.color,
      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
    }}>
      {cfg.label}
    </span>
  )
}

function tipoLabel(tipo) {
  return {
    [MEMORY_TYPES.REGLA]:         'Regla',
    [MEMORY_TYPES.CRITERIO]:      'Criterio',
    [MEMORY_TYPES.EJEMPLO]:       'Ejemplo',
    [MEMORY_TYPES.PROHIBICION]:   'Prohibición',
    [MEMORY_TYPES.PREFERENCIA]:   'Preferencia',
    [MEMORY_TYPES.PATRON]:        'Patrón',
    [MEMORY_TYPES.RECOMENDACION]: 'Recomendación',
  }[tipo] || tipo || '—'
}

function formatFecha(ts) {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Componente de panel de un agente ─────────────────────────────────────────

function PanelAgente({ agentId, meta }) {
  const [memorias, setMemorias]     = useState([])
  const [cargando, setCargando]     = useState(true)
  const [expandido, setExpandido]   = useState(false)
  const [filtroEstado, setFiltro]   = useState('todos')
  const [actualizando, setActualizando] = useState(null)

  useEffect(() => {
    if (!db) { setCargando(false); return }
    const q = query(
      collection(db, COLLECTIONS.KE_AGENTES, agentId, COLLECTIONS.KE_MEMORIA),
      orderBy('creadoEn', 'desc')
    )
    getDocs(q)
      .then(snap => setMemorias(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [agentId])

  const cambiarEstado = async (memId, nuevoEstado) => {
    setActualizando(memId)
    try {
      await updateDoc(
        doc(db, COLLECTIONS.KE_AGENTES, agentId, COLLECTIONS.KE_MEMORIA, memId),
        { estado: nuevoEstado, updatedAt: serverTimestamp() }
      )
      setMemorias(prev => prev.map(m => m.id === memId ? { ...m, estado: nuevoEstado } : m))
    } catch (e) {
      console.error(e)
    } finally {
      setActualizando(null)
    }
  }

  const total   = memorias.length
  const activas = memorias.filter(m => m.estado === STATES.ACTIVE).length
  const pend    = memorias.filter(m => m.estado === STATES.PENDING).length

  const visibles = filtroEstado === 'todos'
    ? memorias
    : memorias.filter(m => m.estado === filtroEstado)

  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14,
      overflow: 'hidden', marginBottom: 12,
    }}>
      {/* Cabecera del agente */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', cursor: 'pointer' }}
        onClick={() => setExpandido(e => !e)}
      >
        <div style={{ fontSize: 28 }}>{meta.icono}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 15 }}>{meta.nombre}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{agentId}</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>{meta.desc}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {cargando ? (
            <span style={{ fontSize: 12, color: '#94a3b8' }}>Cargando…</span>
          ) : (
            <>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b' }}>{total}</div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>total</div>
              </div>
              <div style={{ width: 1, height: 32, background: '#e2e8f0' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#059669' }}>{activas}</div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>activas</div>
              </div>
              {pend > 0 && (
                <>
                  <div style={{ width: 1, height: 32, background: '#e2e8f0' }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#d97706' }}>{pend}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>pend.</div>
                  </div>
                </>
              )}
            </>
          )}
          <div style={{ fontSize: 16, color: '#94a3b8', marginLeft: 8 }}>
            {expandido ? '▲' : '▼'}
          </div>
        </div>
      </div>

      {/* Panel expandido — lista de memorias */}
      {expandido && (
        <div style={{ borderTop: '1px solid #f1f5f9', padding: '0 20px 20px' }}>
          {/* Filtro */}
          <div style={{ display: 'flex', gap: 6, padding: '12px 0', flexWrap: 'wrap' }}>
            {['todos', STATES.ACTIVE, STATES.PENDING, STATES.REJECTED].map(e => (
              <button
                key={e}
                onClick={() => setFiltro(e)}
                style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  border: '1px solid',
                  borderColor: filtroEstado === e ? '#6366f1' : '#e2e8f0',
                  background:  filtroEstado === e ? '#6366f1' : '#fff',
                  color:       filtroEstado === e ? '#fff'    : '#64748b',
                  cursor: 'pointer',
                }}
              >
                {e === 'todos' ? 'Todas' : (ESTADO_COLORS[e]?.label ?? e)}
              </button>
            ))}
          </div>

          {visibles.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
              {total === 0 ? 'Sin memorias registradas.' : 'Sin resultados para este filtro.'}
            </p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>Tipo</th>
                    <th>Contenido</th>
                    <th style={{ width: 100 }}>Área</th>
                    <th style={{ width: 80 }}>Estado</th>
                    <th style={{ width: 70 }}>Prior.</th>
                    <th style={{ width: 90 }}>Fecha</th>
                    <th style={{ width: 130 }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map(m => (
                    <tr key={m.id}>
                      <td><span style={{ fontSize: 11, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, color: '#475569', fontWeight: 600 }}>{tipoLabel(m.tipo)}</span></td>
                      <td style={{ maxWidth: 360 }}>
                        <span style={{ fontSize: 13, color: '#1e293b', lineHeight: 1.4 }}>{m.contenido || '—'}</span>
                        {m.asignaturaAplicable && <small style={{ display: 'block', color: '#94a3b8' }}>{m.asignaturaAplicable}{m.temaAplicable ? ` — ${m.temaAplicable}` : ''}</small>}
                      </td>
                      <td><small>{m.areaAplicable || '—'}</small></td>
                      <td><EstadoBadge estado={m.estado} /></td>
                      <td style={{ textAlign: 'center', color: '#64748b' }}>{m.prioridad ?? '—'}</td>
                      <td><small>{formatFecha(m.creadoEn)}</small></td>
                      <td>
                        {m.estado === STATES.PENDING && (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              className="admin-btn-sm green"
                              disabled={actualizando === m.id}
                              onClick={() => cambiarEstado(m.id, STATES.ACTIVE)}
                            >Activar</button>
                            <button
                              className="admin-btn-sm red"
                              disabled={actualizando === m.id}
                              onClick={() => cambiarEstado(m.id, STATES.REJECTED)}
                            >Rechazar</button>
                          </div>
                        )}
                        {m.estado === STATES.ACTIVE && (
                          <button
                            className="admin-btn-sm yellow"
                            disabled={actualizando === m.id}
                            onClick={() => cambiarEstado(m.id, STATES.INACTIVE)}
                          >Desactivar</button>
                        )}
                        {m.estado === STATES.INACTIVE && (
                          <button
                            className="admin-btn-sm green"
                            disabled={actualizando === m.id}
                            onClick={() => cambiarEstado(m.id, STATES.ACTIVE)}
                          >Reactivar</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function AdminAgentes() {
  const agentes = Object.entries(AGENTES_META)

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h2>Agentes IA</h2>
          <p>Memorias activas de cada agente del Knowledge Engine. Solo entradas con estado "activa" se inyectan en producción.</p>
        </div>
      </div>

      <div style={{ marginBottom: 20, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#475569' }}>
        <strong>Flujo de memorias:</strong> el Learning Engine detecta patrones → genera Insights → el admin aprueba → la memoria queda activa aquí → se inyecta en cada prompt del agente correspondiente.
      </div>

      {agentes.map(([agentId, meta]) => (
        <PanelAgente key={agentId} agentId={agentId} meta={meta} />
      ))}
    </div>
  )
}
