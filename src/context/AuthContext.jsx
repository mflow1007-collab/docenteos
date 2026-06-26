import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '../firebase.js'
import { normalizarPerfilParaFormulario } from '../services/perfilInstitucionalService.js'

// ── Context ───────────────────────────────────────────────────────────────────
const AuthContext = createContext(null)

/**
 * Proveedor global de autenticación y perfil docente.
 *
 * Expone:
 *   user          → FirebaseUser | null
 *   perfil        → objeto raw de Firestore (perfilInstitucional)
 *   formulario    → objeto normalizado listo para formularios
 *   perfilCompleto → boolean
 *   cargando      → boolean (true mientras resuelve auth + Firestore)
 */
export function AuthProvider({ children }) {
  const [user,           setUser]           = useState(undefined)  // undefined = resolviendo
  const [perfil,         setPerfil]         = useState(null)
  const [usuarioMeta,    setUsuarioMeta]    = useState({
    suscripcion: 'Pendiente de completar',
    temaActivo: 'Pendiente de completar',
    usoMensual: 'Pendiente de completar',
  })
  const [perfilCompleto, setPerfilCompleto] = useState(undefined)  // undefined = resolviendo

  useEffect(() => {
    // Sin Firebase configurado: modo desarrollo sin auth
    if (!auth) {
      setUser(null)
      setPerfilCompleto(false)
      return
    }

    let unsubFirestore = null

    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)

      // Cancelar suscripción Firestore del usuario anterior
      if (unsubFirestore) {
        unsubFirestore()
        unsubFirestore = null
      }

      if (!firebaseUser) {
        setPerfil(null)
        setUsuarioMeta({
          suscripcion: 'Pendiente de completar',
          temaActivo: 'Pendiente de completar',
          usoMensual: 'Pendiente de completar',
        })
        setPerfilCompleto(false)
        return
      }

      // Sin Firestore: saltar directamente al dashboard
      if (!db) {
        setPerfilCompleto(true)
        return
      }

      // Suscripción en tiempo real al documento del docente
      unsubFirestore = onSnapshot(
        doc(db, 'usuarios', firebaseUser.uid),
        (snap) => {
          const datos = snap.data() || {}
          setPerfil(datos?.perfilInstitucional ?? null)
          setUsuarioMeta({
            suscripcion: datos?.suscripcion ?? 'Pendiente de completar',
            temaActivo: datos?.temaActivo ?? 'Pendiente de completar',
            usoMensual: datos?.usoMensual ?? 'Pendiente de completar',
          })
          setPerfilCompleto(datos?.perfilInstitucionalCompleto === true)
        },
        (err) => {
          console.error('[AuthContext] Error en snapshot de Firestore:', err)
          setPerfilCompleto(false)
        },
      )
    })

    return () => {
      unsubAuth()
      if (unsubFirestore) unsubFirestore()
    }
  }, [])

  // true mientras no se resuelva auth o el perfil de Firestore
  const cargando =
    user === undefined ||
    (user !== null && perfilCompleto === undefined)

  const valor = {
    user,
    perfil,
    usuarioMeta,
    formulario: normalizarPerfilParaFormulario(perfil),
    perfilCompleto: perfilCompleto ?? false,
    cargando,
  }

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

// ── Hook público ──────────────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
