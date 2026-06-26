import { createContext, useContext } from 'react'
import { useAuth } from './AuthContext.jsx'
import { esUsuarioDocenteOS, tieneAcceso } from '../utils/permisos.js'

const AdminContext = createContext(null)

/**
 * Proveedor de contexto administrativo.
 * Deriva el estado de admin directamente de AuthContext.
 * No abre conexiones adicionales a Firebase.
 */
export function AdminProvider({ children }) {
  const { user, cargando } = useAuth()

  const esAdmin = esUsuarioDocenteOS(user?.email)

  const valor = {
    esAdmin,
    cargando,
    user,
    tieneAcceso: (modulo) => tieneAcceso(user?.email, modulo),
  }

  return <AdminContext.Provider value={valor}>{children}</AdminContext.Provider>
}

export function useAdmin() {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error('useAdmin debe usarse dentro de <AdminProvider>')
  return ctx
}
