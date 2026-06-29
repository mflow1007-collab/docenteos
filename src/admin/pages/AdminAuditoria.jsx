import { useCallback, useEffect, useRef, useState } from 'react'
import { collection, query, orderBy, limit, getDocs, startAfter } from 'firebase/firestore'
import { db } from '../../firebase.js'

const PAGE_SIZE = 50

const ETIQUETAS_TIPO = {
  planificacion_aceptada:       { label: 'Plan aceptado',      color: '#059669', bg: '#dcfce7' },
  planificacion_regenerada:     { label: 'Plan regenerado',    color: '#d97706', bg: '#fef9c3' },
  mejora_aceptada:              { label: 'Mejora aceptada',    color: '#7c3aed', bg: '#faf5ff' },
  actividad_modificada:         { label: 'Act. modificada',    color: '#2563eb', bg: '#eff6ff' },
  instrumento_aceptado:         { label: 'Instrumento',        color: '#0891b2', bg: '#e0f2fe' },
  chat_consultado:              { label: 'Chat IA',            color: '#64748b', bg: '#f1f5f9' },
  apoyo_generado:               { label: 'Apoyo NEAE',         color: '#be185d', bg: '#fce7f3' },
  informe_estudiante_generado:  { label: 'Informe',            color: '#0369a1', bg: '#e0f2fe' },
  ia_recomendacion_generada:    { label: 'Recomendación',      color: '#15803d', bg: '#dcfce7' },
  plantilla_usada:              { label: 'Plantilla',          color: '#92400e', bg: '#fef3c7' },
  auditoria_aplicada:           { label: 'Auditoría IA',       color: '#dc2626', bg: '#fee2e2' },
  apoyo_curso_generado:         { label: 'Apoyo de curso',     color: '#4f46e5', bg: '#ede9fe' },
}

function fmt(ts) {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' })
}

function TipoBadge({ tipo }) {
  const meta = ETIQUETAS_TIPO[tipo]
  if (!meta) return <span style={{ fontSize: 12, color: '#94a3b8' }}>{tipo || '—'}</span>
  return (
    <span style={{
      background: meta.bg, color: meta.color,
      borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700,
    }}>
      {meta.label}
    </span>
  )
}

export default function AdminAuditoria() {
  const [eventos,    setEventos]    = useState([])
  const [cargando,   setCargando]   = useState(true)
  const [hayMas,     setHayMas]     = useState(false)
  const [busqueda,   setBusqueda]   = useState('')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [error,      setError]      = useState('')

  const lastDocRef = useRef(null)

  const cargar = useCallback(async (siguiente = false) => {
    if (!siguiente) { setCargando(true); setError('') }
    try {
      const col = collection(db, 'le_eventos')
      const q = siguiente && lastDocRef.current
        ? query(col, orderBy('timestamp', 'desc'), startAfter(lastDocRef.current), limit(PAGE_SIZE))
        : query(col, orderBy('timestamp', 'desc'), limit(PAGE_SIZE))

      const snap = await getDocs(q)
      const nuevos = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      setEventos((prev) => siguiente ? [...prev, ...nuevos] : nuevos)
      lastDocRef.current = snap.docs[snap.docs.length - 1] ?? null
      setHayMas(snap.docs.length === PAGE_SIZE)
    } catch (err) {
      setError('Error al cargar: ' + (err.message || err))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const tipos = ['todos', ...new Set(eventos.map((e) => e.tipo).filter(Boolean))].sort()

  const filtrados = eventos.filter((e) => {
    if (filtroTipo !== 'todos' && e.tipo !== filtroTipo) return false
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      return (
        (e.userId || '').toLowerCase().includes(q) ||
        (e.tipo   || '').toLowerCase().includes(q) ||
        (e.area   || '').toLowerCase().includes(q) ||
        (e.tema   || '').toLowerCase().includes(q) ||
        (e.grado  || '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const exportarCSV = () => {
    const header = 'Fecha,Usuario,Tipo,Área,Grado,Tema\n'
    const rows = filtrados.map((e) =>
      [fmt(e.timestamp), e.userId, e.tipo, e.area, e.grado, e.tema]
        .map((v) => `"${(v || '').replace(/"/g, '""')}"`)
        .join(',')
    ).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `auditoria_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div className="admin-page-header-text">
          <h2>Auditoría del Sistema</h2>
          <p>Registro de acciones de los docentes en DocenteOS — planificaciones, instrumentos, mejoras y más.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="admin-btn admin-btn-secondary" onClick={exportarCSV} disabled={filtrados.length === 0}>
            ⬇ CSV
          </button>
          <button className="admin-btn admin-btn-secondary" onClick={() => { lastDocRef.current = null; cargar(false) }}>
            ↻ Actualizar
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="admin-toolbar" style={{ flexWrap: 'wrap', gap: 8 }}>
        <input
          className="admin-search"
          placeholder="Buscar por usuario, tipo, área o tema…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
        >
          <option value="todos">Todos los eventos</option>
          {tipos.filter((t) => t !== 'todos').map((t) => (
            <option key={t} value={t}>{ETIQUETAS_TIPO[t]?.label || t}</option>
          ))}
        </select>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', color: '#dc2626', margin: '0 0 16px', fontSize: 14 }}>
          ⚠️ {error}
        </div>
      )}

      {cargando ? (
        <div className="admin-loading"><div className="admin-spinner" />Cargando auditoría…</div>
      ) : filtrados.length === 0 ? (
        <div className="admin-empty">
          <span className="admin-empty-icon">📋</span>
          <h3>Sin registros</h3>
          <p>Los eventos del sistema se registran en <code>le_eventos</code> cuando los docentes usan la plataforma.</p>
        </div>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Evento</th>
                  <th>Área</th>
                  <th>Grado</th>
                  <th>Tema</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((e) => (
                  <tr key={e.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{fmt(e.timestamp)}</td>
                    <td>
                      <code style={{ fontSize: 11, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>
                        {e.userId ? e.userId.slice(0, 10) + '…' : '—'}
                      </code>
                    </td>
                    <td><TipoBadge tipo={e.tipo} /></td>
                    <td style={{ fontSize: 13, color: '#334155' }}>{e.area || '—'}</td>
                    <td style={{ fontSize: 13, color: '#334155' }}>{e.grado || '—'}</td>
                    <td style={{ fontSize: 13, color: '#64748b', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.tema || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>
              {filtrados.length} eventos mostrados · fuente: <code>le_eventos</code>
            </p>
            {hayMas && (
              <button className="admin-btn admin-btn-secondary" onClick={() => cargar(true)}>
                Cargar más
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
