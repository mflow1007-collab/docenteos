import { useAuth } from '../context/AuthContext.jsx'
import { guardarPerfilInstitucional } from '../services/perfilInstitucionalService.js'
import { auth } from '../firebase.js'

/**
 * Hook de perfil institucional.
 * Delega la lectura al AuthContext (única suscripción a Firestore).
 *
 * Interfaz compatible con la versión anterior para no romper consumidores.
 *   const { perfil, formulario, cargando, error, guardar } = usePerfilInstitucional()
 */
export function usePerfilInstitucional() {
  const { perfil, formulario, cargando } = useAuth()

  const guardar = async (datos) => {
    const user = auth?.currentUser
    if (!user) throw new Error('No hay sesión activa.')
    await guardarPerfilInstitucional(user.uid, datos)
    // AuthContext detecta el cambio automáticamente vía onSnapshot
  }

  return {
    perfil,
    formulario,
    cargando,
    error: null,
    guardar,
  }
}
