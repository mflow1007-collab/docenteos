import { useCallback, useEffect, useState } from 'react'
import { collection, query, orderBy, limit, getDocs, startAfter } from 'firebase/firestore'
import { db } from '../../firebase.js'

const PAGE_SIZE = 25

export default function AdminHistorialIA() {
  const [registros,  setRegistros]  = useState([])
  const [cargando,   setCargando]   = useState(true)
  const [lastDoc,    setLastDoc]    = useState(null)
  const [hayMas,     setHayMas]     = useState(false)
  const [busqueda,   setBusqueda]   = useState('')
  const [filtroMod,  setFiltroMod]  = useState('todos')

  const cargar = useCallback(async (siguiente = false) => {
    if (!siguiente) setCargando(true)
    try {
      const col = collection(db, 'historialIA')
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
      setRegistros((prev) => siguiente ? [...prev, ...nuevos] : nuevos)
      setLastDoc(snap.docs[snap.docs.length - 1] || null)
      setHayMas(snap.docs.length === PAGE_SIZE)
    } catch (err) {
      console.error('[AdminHistorialIA]', err)
    } finally {
      setCargando(false)
    }
  }, [lastDoc])

  useEffect(() => { cargar() }, [cargar])

  const modulos = ['todos', ...new Set(registros.map((r) => r.modulo).filter(Boolean))]

  const filtrados = registros.filter((r) => {
    const q = busqueda.toLowerCase()
    return (
      (!q || r.usuario?.toLowerCase().includes(q) || r.accion?.toLowerCase().includes(q)) &&
      (filtroMod === 'todos' || r.modulo === filtroMod)
    )
  })

  const fmtFecha = (ts) => {
    if (!ts) return '—'
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' })
  }

  const ESTADO_BADGE = { exito: 'badge-activo', error: 'badge-rechazado', pendiente: 'badge-pendiente' }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div className="admin-page-header-text">
          <h2>Historial de IA</h2>
          <p>Registro de interacciones con inteligencia artificial en DocenteOS.</p>
        </div>
        <button className="admin-btn admin-btn-secondary" onClick={() => cargar(false)}>↻ Actualizar</button>
      </div>

      <div className="admin-toolbar">
        <input
          className="admin-search"
          placeholder="Buscar por usuario o acción…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <div className="admin-filter-btns">
          {modulos.map((m) => (
            <button
              key={m}
              className={`admin-filter-btn${filtroMod === m ? ' active' : ''}`}
              onClick={() => setFiltroMod(m)}
            >
              {m === 'todos' ? 'Todos' : m}
            </button>
          ))}
        </div>
      </div>

      {cargando ? (
        <div className="admin-loading"><div className="admin-spinner" />Cargando historial…</div>
      ) : filtrados.length === 0 ? (
        <div className="admin-empty">
          <span className="admin-empty-icon">🕒</span>
          <h3>Sin historial disponible</h3>
          <p>Las interacciones con IA se registrarán aquí cuando los docentes usen el módulo de inteligencia artificial.</p>
        </div>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Acción</th>
                  <th>Módulo</th>
                  <th>Tokens</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((r) => (
                  <tr key={r.id}>
                    <td><small>{r.usuario || '—'}</small></td>
                    <td><strong>{r.accion || '—'}</strong></td>
                    <td><span className="admin-tag">{r.modulo || '—'}</span></td>
                    <td><small>{r.tokens ?? '—'}</small></td>
                    <td>
                      <span className={`admin-badge ${ESTADO_BADGE[r.estado] || 'badge-inactivo'}`}>
                        {r.estado || 'desconocido'}
                      </span>
                    </td>
                    <td><small>{fmtFecha(r.fecha)}</small></td>
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
