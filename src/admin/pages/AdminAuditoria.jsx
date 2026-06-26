import { useCallback, useEffect, useState } from 'react'
import { collection, query, orderBy, limit, getDocs, startAfter } from 'firebase/firestore'
import { db } from '../../firebase.js'

const PAGE_SIZE = 30

const TIPO_BADGE = {
  login:    'badge-activo',
  logout:   'badge-inactivo',
  error:    'badge-rechazado',
  cambio:   'badge-warning',
  acceso:   'badge-info',
  admin:    'badge-oficial',
}

export default function AdminAuditoria() {
  const [eventos,   setEventos]   = useState([])
  const [cargando,  setCargando]  = useState(true)
  const [lastDoc,   setLastDoc]   = useState(null)
  const [hayMas,    setHayMas]    = useState(false)
  const [busqueda,  setBusqueda]  = useState('')
  const [filtroTipo,setFiltroTipo]= useState('todos')

  const cargar = useCallback(async (siguiente = false) => {
    if (!siguiente) setCargando(true)
    try {
      const col = collection(db, 'auditoria')
      let q
      try {
        q = siguiente && lastDoc
          ? query(col, orderBy('fecha', 'desc'), startAfter(lastDoc), limit(PAGE_SIZE))
          : query(col, orderBy('fecha', 'desc'), limit(PAGE_SIZE))
      } catch {
        q = query(col, limit(PAGE_SIZE))
      }
      const snap = await getDocs(q)
      const nuevos = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      setEventos((prev) => siguiente ? [...prev, ...nuevos] : nuevos)
      setLastDoc(snap.docs[snap.docs.length - 1] || null)
      setHayMas(snap.docs.length === PAGE_SIZE)
    } catch (err) {
      console.error('[AdminAuditoria]', err)
    } finally {
      setCargando(false)
    }
  }, [lastDoc])

  useEffect(() => { cargar() }, [cargar])

  const tipos = ['todos', ...new Set(eventos.map((e) => e.tipo).filter(Boolean))]

  const filtrados = eventos.filter((e) => {
    const q = busqueda.toLowerCase()
    return (
      (!q || e.usuario?.toLowerCase().includes(q) || e.evento?.toLowerCase().includes(q) || e.modulo?.toLowerCase().includes(q)) &&
      (filtroTipo === 'todos' || e.tipo === filtroTipo)
    )
  })

  const fmtFecha = (ts) => {
    if (!ts) return '—'
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' })
  }

  const exportarCSV = () => {
    const header = 'Evento,Usuario,Módulo,Tipo,Fecha\n'
    const rows = filtrados.map((e) =>
      [e.evento, e.usuario, e.modulo, e.tipo, fmtFecha(e.fecha)]
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
          <p>Registro de eventos relevantes en DocenteOS.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="admin-btn admin-btn-secondary" onClick={exportarCSV} disabled={filtrados.length === 0}>
            ⬇ CSV
          </button>
          <button className="admin-btn admin-btn-secondary" onClick={() => cargar(false)}>↻ Actualizar</button>
        </div>
      </div>

      <div className="admin-toolbar">
        <input
          className="admin-search"
          placeholder="Buscar por evento, usuario o módulo…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <div className="admin-filter-btns">
          {tipos.map((t) => (
            <button
              key={t}
              className={`admin-filter-btn${filtroTipo === t ? ' active' : ''}`}
              onClick={() => setFiltroTipo(t)}
            >
              {t === 'todos' ? 'Todos' : t}
            </button>
          ))}
        </div>
      </div>

      {cargando ? (
        <div className="admin-loading"><div className="admin-spinner" />Cargando auditoría…</div>
      ) : filtrados.length === 0 ? (
        <div className="admin-empty">
          <span className="admin-empty-icon">📋</span>
          <h3>Sin registros de auditoría</h3>
          <p>Los eventos del sistema (logins, cambios, errores) aparecerán aquí cuando se registren en la colección <code>auditoria</code> de Firestore.</p>
        </div>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Evento</th>
                  <th>Usuario</th>
                  <th>Módulo</th>
                  <th>Tipo</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((e) => (
                  <tr key={e.id}>
                    <td><strong>{e.evento || '—'}</strong></td>
                    <td><small>{e.usuario || '—'}</small></td>
                    <td><span className="admin-tag">{e.modulo || '—'}</span></td>
                    <td>
                      <span className={`admin-badge ${TIPO_BADGE[e.tipo] || 'badge-inactivo'}`}>
                        {e.tipo || '—'}
                      </span>
                    </td>
                    <td><small>{fmtFecha(e.fecha)}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hayMas && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button className="admin-btn admin-btn-secondary" onClick={() => cargar(true)}>
                Cargar más
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
