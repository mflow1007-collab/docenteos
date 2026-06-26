import { useEffect, useState } from 'react'
import { collection, getCountFromServer, query, where, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '../../firebase.js'

export default function AdminHome() {
  const [stats, setStats]           = useState(null)
  const [recientes, setRecientes]   = useState([])
  const [cargando, setCargando]     = useState(true)

  useEffect(() => {
    const cargar = async () => {
      try {
        const colUsuarios = collection(db, 'usuarios')
        const [
          snapTotal,
          snapActivos,
          snapPendientes,
          snapSuspendidos,
          snapCentros,
          snapCurriculos,
        ] = await Promise.all([
          getCountFromServer(colUsuarios),
          getCountFromServer(query(colUsuarios, where('estado', '==', 'activo'))),
          getCountFromServer(query(colUsuarios, where('estado', '==', 'pendiente'))),
          getCountFromServer(query(colUsuarios, where('estado', '==', 'suspendido'))),
          getCountFromServer(collection(db, 'centros')).catch(() => ({ data: () => ({ count: 0 }) })),
          getCountFromServer(collection(db, 'curriculos')).catch(() => ({ data: () => ({ count: 0 }) })),
        ])
        setStats({
          total:      snapTotal.data().count,
          activos:    snapActivos.data().count,
          pendientes: snapPendientes.data().count,
          suspendidos: snapSuspendidos.data().count,
          centros:    snapCentros.data().count,
          curriculos: snapCurriculos.data().count,
        })
        try {
          const q = query(colUsuarios, orderBy('fechaCreacion', 'desc'), limit(5))
          const snap = await getDocs(q)
          setRecientes(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        } catch { /* orderBy may need index */ }
      } catch (err) {
        console.error('[AdminHome]', err)
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [])

  const fmt = (n) => (n === null || n === undefined ? '…' : String(n))
  const fmtFecha = (ts) => {
    if (!ts?.toDate) return '—'
    return ts.toDate().toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const tarjetas = [
    { icon: '👥', label: 'Usuarios totales',    valor: fmt(stats?.total),      color: 'accent' },
    { icon: '✅', label: 'Activos',              valor: fmt(stats?.activos),    color: 'green'  },
    { icon: '⏳', label: 'Pendientes',           valor: fmt(stats?.pendientes), color: 'yellow' },
    { icon: '🚫', label: 'Suspendidos',          valor: fmt(stats?.suspendidos),color: 'red'    },
    { icon: '🏫', label: 'Centros educativos',   valor: fmt(stats?.centros),    color: 'blue'   },
    { icon: '📚', label: 'Currículo registrado', valor: fmt(stats?.curriculos), color: 'accent' },
  ]

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div className="admin-page-header-text">
          <h2>Resumen General</h2>
          <p>Estado en tiempo real de DocenteOS.</p>
        </div>
      </div>

      {cargando ? (
        <div className="admin-loading"><div className="admin-spinner" />Calculando estadísticas…</div>
      ) : (
        <div className="admin-stats-grid">
          {tarjetas.map((t) => (
            <div key={t.label} className={`admin-stat-card ${t.color}`}>
              <span className="admin-stat-icon">{t.icon}</span>
              <strong className="admin-stat-valor">{t.valor}</strong>
              <small className="admin-stat-label">{t.label}</small>
            </div>
          ))}
        </div>
      )}

      <div className="admin-info-panel">
        <h3>Estado de servicios</h3>
        <ul className="admin-status-list">
          <li><span className="status-dot green" />Firebase Auth — Operativo</li>
          <li><span className="status-dot green" />Firestore — Operativo</li>
          <li><span className="status-dot green" />Currículo MINERD — Cargado</li>
          <li><span className="status-dot yellow" />Anthropic API — Depende de clave del usuario</li>
        </ul>
      </div>

      {recientes.length > 0 && (
        <div className="admin-info-panel" style={{ marginTop: 16 }}>
          <h3>Últimos registros</h3>
          <div className="admin-table-wrap" style={{ marginTop: 8 }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {recientes.map((u) => (
                  <tr key={u.id}>
                    <td><strong>{u.nombre || '—'}</strong></td>
                    <td><small>{u.email}</small></td>
                    <td>
                      <span className={`admin-badge badge-${u.estado || 'pendiente'}`}>
                        {u.estado || 'pendiente'}
                      </span>
                    </td>
                    <td><small>{fmtFecha(u.fechaCreacion)}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
