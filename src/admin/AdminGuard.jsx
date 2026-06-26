import { Navigate } from 'react-router-dom'
import { useAdmin } from '../context/AdminContext.jsx'

export default function AdminGuard({ children }) {
  const { esAdmin, cargando } = useAdmin()

  if (cargando) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111827' }}>
        <p style={{ color: '#9ca3af', fontSize: 14 }}>Verificando acceso…</p>
      </div>
    )
  }

  if (!esAdmin) return <Navigate to="/dashboard" replace />

  return children
}
