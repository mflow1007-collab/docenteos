import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '../firebase.js'
import { normalizarPerfilParaFormulario } from '../services/perfilInstitucionalService.js'
import { checkAndSyncExpiration } from '../services/subscriptionService.js'

// ── Context ───────────────────────────────────────────────────────────────────
const AuthContext = createContext(null)

/**
 * Proveedor global de autenticación y perfil docente.
 *
 * Expone:
 *   user              → FirebaseUser | null
 *   perfil            → objeto raw de Firestore (perfilInstitucional)
 *   formulario        → objeto normalizado listo para formularios
 *   perfilCompleto     → boolean
 *   cargando          → boolean
 *   suscripcion       → { status, plan, endAt, graceEndsAt, nextPaymentDueAt, lastPaymentAt, trialEndsAt }
 */
export function AuthProvider({ children }) {
  const [user,           setUser]           = useState(undefined)
  const [perfil,         setPerfil]         = useState(null)
  const [usuarioMeta,    setUsuarioMeta]    = useState({
    suscripcion: 'Pendiente de completar',
    temaActivo:  'Pendiente de completar',
    usoMensual:  'Pendiente de completar',
  })
  const [suscripcion,    setSuscripcion]    = useState(null)
  const [perfilCompleto, setPerfilCompleto] = useState(undefined)

  useEffect(() => {
    if (!auth) {
      setUser(null)
      setPerfilCompleto(false)
      return
    }

    let unsubFirestore = null

    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)

      if (unsubFirestore) {
        unsubFirestore()
        unsubFirestore = null
      }

      if (!firebaseUser) {
        setPerfil(null)
        setSuscripcion(null)
        setUsuarioMeta({
          suscripcion: 'Pendiente de completar',
          temaActivo:  'Pendiente de completar',
          usoMensual:  'Pendiente de completar',
        })
        setPerfilCompleto(false)
        return
      }

      if (!db) {
        setPerfilCompleto(true)
        return
      }

      unsubFirestore = onSnapshot(
        doc(db, 'usuarios', firebaseUser.uid),
        (snap) => {
          const datos = snap.data() || {}

          setPerfil(datos?.perfilInstitucional ?? null)
          setUsuarioMeta({
            suscripcion: datos?.suscripcion ?? 'Pendiente de completar',
            temaActivo:  datos?.temaActivo  ?? 'Pendiente de completar',
            usoMensual:  datos?.usoMensual  ?? 'Pendiente de completar',
          })
          setPerfilCompleto(datos?.perfilInstitucionalCompleto === true)

          // Leer campos de suscripción
          const sub = {
            status:           datos?.subscriptionStatus ?? null,
            plan:             datos?.plan               ?? null,
            endAt:            datos?.subscriptionEndAt  ?? null,
            startAt:          datos?.subscriptionStartAt?? null,
            graceEndsAt:      datos?.graceEndsAt        ?? null,
            nextPaymentDueAt: datos?.nextPaymentDueAt   ?? null,
            lastPaymentAt:    datos?.lastPaymentAt      ?? null,
            trialEndsAt:      datos?.trialEndsAt        ?? null,
            paymentMethod:    datos?.paymentMethod      ?? null,
            notes:            datos?.notes              ?? '',
          }
          setSuscripcion(sub)

          // Verificar vencimiento sin bloquear el render
          checkAndSyncExpiration(firebaseUser.uid, datos).catch(() => {})
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

  const cargando =
    user === undefined ||
    (user !== null && perfilCompleto === undefined)

  const valor = {
    user,
    perfil,
    usuarioMeta,
    suscripcion,
    formulario:    normalizarPerfilParaFormulario(perfil),
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
