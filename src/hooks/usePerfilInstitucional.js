import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase.js'
import {
  obtenerPerfilInstitucional,
  guardarPerfilInstitucional,
  normalizarPerfilParaFormulario,
} from '../services/perfilInstitucionalService.js'

/**
 * Hook global de perfil institucional.
 *
 * Uso:
 *   const { perfil, formulario, cargando, error, guardar } = usePerfilInstitucional()
 *
 * - perfil     → objeto raw guardado en Firestore (perfilInstitucional)
 * - formulario → objeto plano listo para inicializar cualquier formulario
 * - cargando   → true mientras obtiene el perfil
 * - error      → Error si falló la lectura
 * - guardar(datos) → llama a guardarPerfilInstitucional y actualiza el estado local
 */
export function usePerfilInstitucional() {
  const [perfil,    setPerfil]    = useState(null)
  const [cargando,  setCargando]  = useState(true)
  const [error,     setError]     = useState(null)

  useEffect(() => {
    if (!auth) {
      setCargando(false)
      return
    }

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setPerfil(null)
        setCargando(false)
        return
      }
      try {
        const datos = await obtenerPerfilInstitucional(user.uid)
        setPerfil(datos)
      } catch (err) {
        console.error('[usePerfilInstitucional] Error al cargar perfil:', err)
        setError(err)
      } finally {
        setCargando(false)
      }
    })

    return unsub
  }, [])

  const guardar = async (datos) => {
    const user = auth?.currentUser
    if (!user) throw new Error('No hay sesión activa.')
    await guardarPerfilInstitucional(user.uid, datos)
    setPerfil({ ...datos, perfilCompletado: true })
  }

  return {
    perfil,
    formulario: normalizarPerfilParaFormulario(perfil),
    cargando,
    error,
    guardar,
  }
}
