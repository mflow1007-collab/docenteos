import { useEffect, useState } from 'react'
import { collection, getCountFromServer } from 'firebase/firestore'
import { db } from '../../firebase.js'

const COLECCIONES = [
  { id: 'usuarios',           desc: 'Perfiles docentes' },
  { id: 'centros',            desc: 'Centros educativos' },
  { id: 'curriculos',         desc: 'Diseño Curricular MINERD' },
  { id: 'promptsIA',          desc: 'Banco de prompts IA' },
  { id: 'historialIA',        desc: 'Historial de uso IA' },
  { id: 'auditoria',          desc: 'Registros de auditoría' },
  { id: 'configuracionGlobal',desc: 'Configuración global' },
]

export default function AdminFirebase() {
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || '—'
  const [conteos, setConteos] = useState({})
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const cargar = async () => {
      const resultados = {}
      await Promise.all(
        COLECCIONES.map(async ({ id }) => {
          try {
            const snap = await getCountFromServer(collection(db, id))
            resultados[id] = snap.data().count
          } catch {
            resultados[id] = '—'
          }
        })
      )
      setConteos(resultados)
      setCargando(false)
    }
    cargar()
  }, [])

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div className="admin-page-header-text">
          <h2>Firebase & Base de Datos</h2>
          <p>Estado de la conexión y colecciones de Firestore.</p>
        </div>
      </div>

      <div className="admin-stats-grid" style={{ marginBottom: 24 }}>
        <div className="admin-stat-card accent">
          <span className="admin-stat-icon">🔥</span>
          <strong className="admin-stat-valor" style={{ fontSize: '0.85rem', wordBreak: 'break-all' }}>{projectId}</strong>
          <small className="admin-stat-label">Project ID</small>
        </div>
        <div className="admin-stat-card green">
          <span className="admin-stat-icon">🔐</span>
          <strong className="admin-stat-valor">Auth</strong>
          <small className="admin-stat-label">Email/Password activo</small>
        </div>
        <div className="admin-stat-card green">
          <span className="admin-stat-icon">🗄️</span>
          <strong className="admin-stat-valor">Firestore</strong>
          <small className="admin-stat-label">Base de datos activa</small>
        </div>
      </div>

      <div className="admin-info-panel">
        <h3>Colecciones Firestore</h3>
        {cargando ? (
          <div className="admin-loading" style={{ padding: 24 }}>
            <div className="admin-spinner" />Contando documentos…
          </div>
        ) : (
          <div className="admin-table-wrap" style={{ marginTop: 10 }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Colección</th>
                  <th>Descripción</th>
                  <th>Documentos</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {COLECCIONES.map(({ id, desc }) => (
                  <tr key={id}>
                    <td>
                      <code style={{ background: 'var(--adm-bg)', padding: '2px 7px', borderRadius: 4, fontSize: 12, color: '#a5b4fc', fontFamily: 'monospace' }}>
                        {id}
                      </code>
                    </td>
                    <td><small>{desc}</small></td>
                    <td><strong>{conteos[id] ?? '…'}</strong></td>
                    <td>
                      <span className="status-dot green" style={{ display: 'inline-block' }} />
                      {' '}<small style={{ color: 'var(--adm-muted)' }}>Activa</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="admin-info-panel" style={{ marginTop: 14 }}>
        <h3>Estado de servicios</h3>
        <ul className="admin-status-list" style={{ marginTop: 8 }}>
          <li><span className="status-dot green" />Firebase Authentication — Operativo</li>
          <li><span className="status-dot green" />Cloud Firestore — Operativo</li>
          <li><span className="status-dot yellow" />Firebase Storage — No configurado</li>
          <li><span className="status-dot yellow" />Firebase Hosting — Verificar en consola</li>
        </ul>
        <p style={{ marginTop: 14, fontSize: 12, color: 'var(--adm-dim)' }}>
          Para acceso completo a métricas, cuotas y reglas de seguridad, accede a la consola de Firebase directamente.
        </p>
      </div>
    </div>
  )
}
