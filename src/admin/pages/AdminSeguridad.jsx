import { useEffect, useState } from 'react'
import {
  collection, query, where, getDocs, getCountFromServer,
} from 'firebase/firestore'
import { db } from '../../firebase.js'

export default function AdminSeguridad() {
  const [datos,    setDatos]    = useState(null)
  const [cargando, setCargando] = useState(true)
  const [correosSinPerfil, setCorreosSinPerfil] = useState([])

  useEffect(() => {
    const cargar = async () => {
      try {
        const col = collection(db, 'usuarios')
        const [snapSusp, snapRech, snapPend, snapTotal] = await Promise.all([
          getCountFromServer(query(col, where('estado', '==', 'suspendido'))),
          getCountFromServer(query(col, where('estado', '==', 'rechazado'))),
          getCountFromServer(query(col, where('estado', '==', 'pendiente'))),
          getCountFromServer(col),
        ])

        const snapTodos = await getDocs(query(col, where('estado', 'in', ['activo', 'pendiente'])))
        const sinPerfil = snapTodos.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((u) => !u.perfilInstitucional?.nombreDocente && !u.nombre)
          .slice(0, 20)

        setDatos({
          suspendidos: snapSusp.data().count,
          rechazados:  snapRech.data().count,
          pendientes:  snapPend.data().count,
          total:       snapTotal.data().count,
        })
        setCorreosSinPerfil(sinPerfil)
      } catch (err) {
        console.error('[AdminSeguridad]', err)
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [])

  if (cargando) {
    return <div className="admin-loading"><div className="admin-spinner" />Analizando seguridad…</div>
  }

  const alertas = []
  if (datos?.suspendidos > 0) alertas.push({ nivel: 'warning', msg: `${datos.suspendidos} usuario(s) suspendido(s).` })
  if (datos?.rechazados  > 0) alertas.push({ nivel: 'error',   msg: `${datos.rechazados} usuario(s) rechazado(s).` })
  if (datos?.pendientes  > 5) alertas.push({ nivel: 'warning', msg: `${datos.pendientes} solicitudes pendientes de aprobación.` })
  if (correosSinPerfil.length > 0) alertas.push({ nivel: 'warning', msg: `${correosSinPerfil.length} usuario(s) activos sin perfil institucional completo.` })

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div className="admin-page-header-text">
          <h2>Seguridad</h2>
          <p>Resumen de alertas y estado de seguridad del sistema.</p>
        </div>
      </div>

      {/* Alertas */}
      {alertas.length === 0 ? (
        <div className="admin-alert success">✓ No se detectaron alertas de seguridad activas.</div>
      ) : (
        <div style={{ marginBottom: 20 }}>
          {alertas.map((a, i) => (
            <div key={i} className={`admin-alert ${a.nivel}`} style={{ marginBottom: 8 }}>
              {a.nivel === 'warning' ? '⚠️' : '🚫'} {a.msg}
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="admin-stats-grid" style={{ marginBottom: 24 }}>
        <div className="admin-stat-card accent">
          <span className="admin-stat-icon">👥</span>
          <strong className="admin-stat-valor">{datos?.total ?? '—'}</strong>
          <small className="admin-stat-label">Usuarios totales</small>
        </div>
        <div className="admin-stat-card yellow">
          <span className="admin-stat-icon">⏳</span>
          <strong className="admin-stat-valor">{datos?.pendientes ?? '—'}</strong>
          <small className="admin-stat-label">Pendientes de aprobación</small>
        </div>
        <div className="admin-stat-card red">
          <span className="admin-stat-icon">🚫</span>
          <strong className="admin-stat-valor">{datos?.suspendidos ?? '—'}</strong>
          <small className="admin-stat-label">Suspendidos</small>
        </div>
        <div className="admin-stat-card red">
          <span className="admin-stat-icon">❌</span>
          <strong className="admin-stat-valor">{datos?.rechazados ?? '—'}</strong>
          <small className="admin-stat-label">Rechazados</small>
        </div>
      </div>

      {/* Usuarios sin perfil */}
      {correosSinPerfil.length > 0 && (
        <div className="admin-info-panel">
          <h3>Usuarios activos sin perfil institucional completo</h3>
          <div className="admin-table-wrap" style={{ marginTop: 8 }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Correo</th>
                  <th>Estado</th>
                  <th>Registro</th>
                </tr>
              </thead>
              <tbody>
                {correosSinPerfil.map((u) => {
                  const fmtFecha = (ts) => {
                    if (!ts?.toDate) return '—'
                    return ts.toDate().toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })
                  }
                  return (
                    <tr key={u.id}>
                      <td><small>{u.email || u.id}</small></td>
                      <td>
                        <span className={`admin-badge badge-${u.estado || 'pendiente'}`}>{u.estado || '—'}</span>
                      </td>
                      <td><small>{fmtFecha(u.fechaCreacion)}</small></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reglas de Firestore */}
      <div className="admin-info-panel" style={{ marginTop: 16 }}>
        <h3>Recomendaciones de reglas Firestore</h3>
        <ul className="admin-status-list" style={{ marginTop: 8 }}>
          <li>
            <span className="status-dot yellow" />
            Verificar que <code>usuarios/{'{uid}'}</code> sólo sea escribible por el propio usuario autenticado.
          </li>
          <li>
            <span className="status-dot yellow" />
            Restringir escritura a <code>configuracionGlobal</code> solo a correos <code>@docenteos.com</code>.
          </li>
          <li>
            <span className="status-dot yellow" />
            Colecciones <code>auditoria</code> e <code>historialIA</code> deben ser de solo lectura para usuarios normales.
          </li>
          <li>
            <span className="status-dot green" />
            Acceso al panel <code>/admin</code> protegido en el frontend por dominio <code>@docenteos.com</code>.
          </li>
        </ul>
        <div className="admin-prompt-preview" style={{ marginTop: 12 }}>
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Perfil propio
    match /usuarios/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    // Currículo: lectura autenticada, escritura solo admins
    match /curriculos/{doc} {
      allow read: if request.auth != null;
      allow write: if request.auth.token.email.matches('.*@docenteos\\.com');
    }
    // Config global: solo admins
    match /configuracionGlobal/{doc} {
      allow read: if request.auth != null;
      allow write: if request.auth.token.email.matches('.*@docenteos\\.com');
    }
    // Centros: lectura autenticada, escritura solo admins
    match /centros/{doc} {
      allow read: if request.auth != null;
      allow write: if request.auth.token.email.matches('.*@docenteos\\.com');
    }
  }
}`}
        </div>
      </div>
    </div>
  )
}
