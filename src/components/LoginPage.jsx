import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import {
  Brain,
  BarChart3,
  BookOpen,
  ClipboardList,
  Eye,
  EyeOff,
  LogIn,
  Loader2,
  AtSign,
  Lock,
  ArrowRight,
  Shield,
  Sparkles,
} from 'lucide-react'
import { auth, db } from '../firebase.js'
import './LoginPage.css'

// ── Routing por rol ──────────────────────────────────────────────────────────
const ROL_PATHS = {
  docente:       '/dashboard/docente',
  coordinador:   '/dashboard/coordinador',
  director:      '/dashboard/director',
  administrador: '/dashboard/admin',
}
const getRolPath = (rol) => ROL_PATHS[rol] ?? '/dashboard/docente'

// ── Mensajes de error legibles ───────────────────────────────────────────────
const ERRORES_FIREBASE = {
  'auth/wrong-password':         'Contraseña incorrecta. Verifique e intente de nuevo.',
  'auth/invalid-credential':     'Contraseña incorrecta. Verifique e intente de nuevo.',
  'auth/user-not-found':         'No existe una cuenta con este correo.',
  'auth/invalid-email':          'El formato del correo no es válido.',
  'auth/user-disabled':          'Esta cuenta está deshabilitada. Contacte al administrador.',
  'auth/too-many-requests':      'Demasiados intentos fallidos. Intente nuevamente más tarde.',
  'auth/network-request-failed': 'Problema de conexión. Verifique su internet e intente de nuevo.',
}
const getMensajeError = (code) => ERRORES_FIREBASE[code] ?? 'No fue posible iniciar sesión. Intente más tarde.'

// ── Validación de correo ─────────────────────────────────────────────────────
const DOMINIO_INSTITUCIONAL = '@docente.edu.do'
const CORREO_ADMIN          = 'admin@docenteos.com'

function validarCorreo(correo) {
  const c = correo.trim().toLowerCase()
  if (!c)                                    return 'Debe ingresar un correo electrónico.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) return 'Correo electrónico inválido.'
  if (!c.endsWith(DOMINIO_INSTITUCIONAL) && c !== CORREO_ADMIN) {
    return 'Solo se permiten cuentas institucionales del MINERD o cuenta administrativa autorizada.'
  }
  return null
}

// ── Panel izquierdo — características ───────────────────────────────────────
const FEATURES = [
  { icon: Brain,         label: 'Planificación inteligente',  color: '#818CF8', delay: '0ms' },
  { icon: ClipboardList, label: 'Instrumentos automáticos',   color: '#34D399', delay: '60ms' },
  { icon: BookOpen,      label: 'Registro de calificaciones', color: '#FBBF24', delay: '120ms' },
  { icon: BarChart3,     label: 'Reportes pedagógicos',       color: '#F472B6', delay: '180ms' },
]

// ─────────────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const navigate = useNavigate()

  const [correo,        setCorreo]        = useState('')
  const [contrasena,    setContrasena]    = useState('')
  const [verContrasena, setVerContrasena] = useState(false)
  const [recordarme,    setRecordarme]    = useState(false)
  const [cargando,      setCargando]      = useState(false)
  const [error,         setError]         = useState('')

  const limpiarError = () => { if (error) setError('') }

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')

    const errorCorreo = validarCorreo(correo)
    if (errorCorreo)  { setError(errorCorreo); return }
    if (!contrasena)  { setError('Debe ingresar su contraseña.'); return }
    if (!auth)        { setError('El servicio de autenticación no está disponible.'); return }

    setCargando(true)
    try {
      const { user } = await signInWithEmailAndPassword(auth, correo.trim(), contrasena)

      let rol = 'docente'
      if (db) {
        const snap = await getDoc(doc(db, 'usuarios', user.uid))
        if (snap.exists()) rol = snap.data().rol ?? 'docente'
      }

      navigate(getRolPath(rol), { replace: true })
    } catch (err) {
      setError(getMensajeError(err.code))
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="lp-shell">

      {/* ══ PANEL IZQUIERDO ══════════════════════════════════════ */}
      <aside className="lp-left" aria-label="DocenteOS — Plataforma educativa">
        {/* Orbes decorativos */}
        <div className="lp-orb lp-orb-1" aria-hidden="true" />
        <div className="lp-orb lp-orb-2" aria-hidden="true" />
        <div className="lp-orb lp-orb-3" aria-hidden="true" />

        <div className="lp-left-inner">

          {/* Marca */}
          <div className="lp-brand">
            <div className="lp-logo-wrap">
              <img
                src="/logo-docenteos.png"
                alt="Logo DocenteOS"
                className="lp-logo-img"
                height={72}
                onError={(e) => {
                  e.target.style.display = 'none'
                  e.target.nextElementSibling.style.display = 'flex'
                }}
              />
              <div className="lp-logo-fallback" aria-hidden="true">🎓</div>
            </div>
            <h1 className="lp-brand-name">
              Docente<span className="lp-brand-os">OS</span>
            </h1>
          </div>

          {/* Frase principal */}
          <div className="lp-hero-phrase">
            <Sparkles size={18} className="lp-sparkle" aria-hidden="true" />
            <h2 className="lp-hero-title">
              Planifica, evalúa y da seguimiento con inteligencia pedagógica.
            </h2>
          </div>

          {/* Grid de características */}
          <ul className="lp-features-grid" aria-label="Características de la plataforma">
            {FEATURES.map(({ icon: Icon, label, color, delay }) => (
              <li
                key={label}
                className="lp-feature-tile"
                style={{ animationDelay: delay }}
              >
                <span className="lp-tile-icon" style={{ background: `${color}22`, color }} aria-hidden="true">
                  <Icon size={18} strokeWidth={1.8} />
                </span>
                <span className="lp-tile-label">{label}</span>
              </li>
            ))}
          </ul>

          {/* Pie de panel */}
          <div className="lp-left-footer">
            <Shield size={13} aria-hidden="true" />
            <span>Plataforma oficial del MINERD · República Dominicana · v1.0 Beta</span>
          </div>
        </div>
      </aside>

      {/* ══ PANEL DERECHO ════════════════════════════════════════ */}
      <main className="lp-right">
        <div className="lp-card">
          <div className="lp-card-accent" aria-hidden="true" />

          {/* Encabezado */}
          <div className="lp-card-header">
            <h2 className="lp-card-title">Iniciar sesión</h2>
            <p className="lp-card-subtitle">Ingrese sus credenciales institucionales</p>
          </div>

          {/* Formulario */}
          <form className="lp-form" onSubmit={handleLogin} noValidate>

            {/* Campo: correo */}
            <div className="lp-field">
              <label htmlFor="lp-correo" className="lp-label">Correo institucional</label>
              <div className="lp-input-wrap">
                <AtSign size={16} className="lp-input-icon" aria-hidden="true" />
                <input
                  id="lp-correo"
                  type="email"
                  className="lp-input"
                  placeholder={`usuario${DOMINIO_INSTITUCIONAL}`}
                  value={correo}
                  onChange={(e) => { setCorreo(e.target.value); limpiarError() }}
                  autoComplete="email"
                  autoFocus
                  disabled={cargando}
                  aria-label="Correo institucional"
                  aria-describedby={error ? 'lp-error' : undefined}
                  tabIndex={1}
                />
              </div>
            </div>

            {/* Campo: contraseña */}
            <div className="lp-field">
              <label htmlFor="lp-pass" className="lp-label">Contraseña</label>
              <div className="lp-input-wrap">
                <Lock size={16} className="lp-input-icon" aria-hidden="true" />
                <input
                  id="lp-pass"
                  type={verContrasena ? 'text' : 'password'}
                  className="lp-input lp-input-pass"
                  placeholder="••••••••"
                  value={contrasena}
                  onChange={(e) => { setContrasena(e.target.value); limpiarError() }}
                  autoComplete="current-password"
                  disabled={cargando}
                  aria-label="Contraseña"
                  tabIndex={2}
                />
                <button
                  type="button"
                  className="lp-eye-btn"
                  onClick={() => setVerContrasena((v) => !v)}
                  aria-label={verContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  tabIndex={-1}
                >
                  {verContrasena ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Recordarme + ¿Olvidó? */}
            <div className="lp-options-row">
              <label className="lp-check-label">
                <input
                  type="checkbox"
                  className="lp-checkbox"
                  checked={recordarme}
                  onChange={(e) => setRecordarme(e.target.checked)}
                  disabled={cargando}
                  tabIndex={3}
                />
                <span>Recordarme</span>
              </label>
              <button
                type="button"
                className="lp-link"
                tabIndex={4}
                onClick={() => setError('Para restablecer su contraseña, contacte al administrador de su centro educativo.')}
              >
                ¿Olvidó su contraseña?
              </button>
            </div>

            {/* Error */}
            {error && (
              <div id="lp-error" className="lp-error" role="alert" aria-live="polite">
                <span className="lp-error-icon" aria-hidden="true">⚠</span>
                <span>{error}</span>
              </div>
            )}

            {/* Botón Entrar */}
            <button
              type="submit"
              className="lp-btn-primary"
              disabled={cargando}
              tabIndex={5}
              aria-label="Entrar a DocenteOS"
            >
              {cargando ? (
                <>
                  <Loader2 size={18} className="lp-spinner" aria-hidden="true" />
                  Verificando…
                </>
              ) : (
                <>
                  <LogIn size={17} aria-hidden="true" />
                  Entrar
                  <ArrowRight size={16} className="lp-btn-arrow" aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          {/* Pie de tarjeta */}
          <div className="lp-card-footer">
            <Shield size={12} aria-hidden="true" />
            <span>
              Acceso seguro · Solo cuentas <strong>@docente.edu.do</strong>
            </span>
          </div>
        </div>
      </main>
    </div>
  )
}
