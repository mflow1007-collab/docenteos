import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import {
  Brain, BarChart3, BookOpen, ClipboardList,
  AtSign, Lock, Eye, EyeOff,
  LogIn, Loader2, UserPlus, ShieldCheck, ArrowRight,
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

// ── Mensajes de error ────────────────────────────────────────────────────────
const ERRORES = {
  'auth/wrong-password':         'Contraseña incorrecta. Verifique e intente de nuevo.',
  'auth/invalid-credential':     'Contraseña incorrecta. Verifique e intente de nuevo.',
  'auth/user-not-found':         'No existe una cuenta con este correo.',
  'auth/invalid-email':          'El formato del correo no es válido.',
  'auth/user-disabled':          'Esta cuenta está deshabilitada. Contacte al administrador.',
  'auth/too-many-requests':      'Demasiados intentos fallidos. Intente nuevamente más tarde.',
  'auth/network-request-failed': 'Problema de conexión. Verifique su internet.',
}
const getError = (code) => ERRORES[code] ?? 'No fue posible iniciar sesión. Intente más tarde.'

// ── Validación de correo ─────────────────────────────────────────────────────
const DOMINIO = '@docente.edu.do'
const ADMIN   = 'admin@docenteos.com'

function validarCorreo(correo) {
  const c = correo.trim().toLowerCase()
  if (!c)                                      return 'Debe ingresar un correo electrónico.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) return 'Correo electrónico inválido.'
  if (!c.endsWith(DOMINIO) && c !== ADMIN)
    return 'Solo se permiten cuentas institucionales del MINERD o cuenta administrativa autorizada.'
  return null
}

// ── Beneficios del panel izquierdo ───────────────────────────────────────────
const BENEFICIOS = [
  {
    icon: Brain,
    color: '#818CF8',
    bg: 'rgba(129,140,248,0.15)',
    title: 'Planificación Inteligente',
    desc:  'Genera unidades y secuencias alineadas al currículo del MINERD con IA.',
  },
  {
    icon: ClipboardList,
    color: '#34D399',
    bg: 'rgba(52,211,153,0.15)',
    title: 'Instrumentos Automáticos',
    desc:  'Crea rúbricas, listas de cotejo y exámenes en segundos.',
  },
  {
    icon: BookOpen,
    color: '#FBBF24',
    bg: 'rgba(251,191,36,0.15)',
    title: 'Registro de Calificaciones',
    desc:  'Gestiona notas, asistencia y reportes de manera centralizada.',
  },
  {
    icon: BarChart3,
    color: '#F472B6',
    bg: 'rgba(244,114,182,0.15)',
    title: 'Reportes Pedagógicos',
    desc:  'Obtén reportes claros para tomar mejores decisiones.',
  },
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

  const limpiar = () => { if (error) setError('') }

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')

    const errCorreo = validarCorreo(correo)
    if (errCorreo)  { setError(errCorreo); return }
    if (!contrasena){ setError('Debe ingresar su contraseña.'); return }
    if (!auth)      { setError('El servicio de autenticación no está disponible.'); return }

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
      setError(getError(err.code))
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="lp-shell">

      {/* ════════ PANEL IZQUIERDO ════════════════════════════════════════════ */}
      <aside className="lp-left" aria-label="Información de DocenteOS">

        {/* Capas decorativas */}
        <div className="lp-deco" aria-hidden="true">
          <div className="lp-deco-grid" />
          <div className="lp-deco-glow lp-glow-top" />
          <div className="lp-deco-glow lp-glow-bottom" />
          <div className="lp-deco-circle lp-circle-1" />
          <div className="lp-deco-circle lp-circle-2" />
          <div className="lp-deco-circle lp-circle-3" />
        </div>

        <div className="lp-left-content">

          {/* Marca */}
          <div className="lp-left-brand">
            <div className="lp-left-logo-wrap">
              <img
                src="/logo-docenteos.png"
                alt="DocenteOS"
                className="lp-left-logo"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
              <span className="lp-left-logo-fallback" aria-hidden="true">🎓</span>
            </div>
            <div>
              <h1 className="lp-left-name">Docente<span>OS</span></h1>
              <p className="lp-left-tagline">Plataforma Inteligente para la Gestión Docente</p>
            </div>
          </div>

          {/* Hero */}
          <div className="lp-hero">
            <h2 className="lp-hero-title">
              Planifica, evalúa y transforma la educación
            </h2>
            <p className="lp-hero-desc">
              Herramientas inteligentes que facilitan tu trabajo y potencian
              el aprendizaje de tus estudiantes.
            </p>
          </div>

          {/* Beneficios */}
          <ul className="lp-benefits" aria-label="Características de la plataforma">
            {BENEFICIOS.map(({ icon: Icon, color, bg, title, desc }, i) => (
              <li
                key={title}
                className="lp-benefit-card"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="lp-benefit-icon" style={{ background: bg, color }}>
                  <Icon size={18} strokeWidth={1.8} />
                </div>
                <div className="lp-benefit-text">
                  <strong>{title}</strong>
                  <span>{desc}</span>
                </div>
              </li>
            ))}
          </ul>

          {/* Tarjeta de confianza */}
          <div className="lp-trust-card">
            <ShieldCheck size={18} className="lp-trust-icon" aria-hidden="true" />
            <div>
              <strong>Plataforma oficial del MINERD</strong>
              <span>Segura · Confiable · Hecha para docentes</span>
            </div>
          </div>

          {/* Footer del panel */}
          <p className="lp-left-footer">
            República Dominicana | MINERD — Versión Beta v1.0
          </p>
        </div>
      </aside>

      {/* ════════ PANEL DERECHO ══════════════════════════════════════════════ */}
      <main className="lp-right">
        <div className="lp-card">

          {/* Franja superior degradada */}
          <div className="lp-card-stripe" aria-hidden="true" />

          <div className="lp-card-body">

            {/* Logo + marca en la tarjeta */}
            <div className="lp-card-brand">
              <div className="lp-card-logo-wrap">
                <img
                  src="/logo-docenteos.png"
                  alt="DocenteOS"
                  className="lp-card-logo"
                  onError={(e) => { e.currentTarget.style.display = 'none' }}
                />
                <span className="lp-card-logo-fallback" aria-hidden="true">🎓</span>
              </div>
              <span className="lp-card-brand-name">Docente<b>OS</b></span>
            </div>

            {/* Encabezado */}
            <div className="lp-card-header">
              <h2 className="lp-card-title">Iniciar sesión</h2>
              <p className="lp-card-subtitle">Ingresa tus credenciales institucionales</p>
            </div>

            {/* Formulario */}
            <form className="lp-form" onSubmit={handleLogin} noValidate>

              {/* Correo */}
              <div className="lp-field">
                <label htmlFor="lp-correo" className="lp-label">Correo institucional</label>
                <div className="lp-input-wrap">
                  <AtSign size={16} className="lp-input-icon" aria-hidden="true" />
                  <input
                    id="lp-correo"
                    type="email"
                    className="lp-input"
                    placeholder={`usuario${DOMINIO}`}
                    value={correo}
                    onChange={(e) => { setCorreo(e.target.value); limpiar() }}
                    autoComplete="email"
                    autoFocus
                    disabled={cargando}
                    aria-label="Correo institucional"
                    aria-describedby={error ? 'lp-error' : undefined}
                    tabIndex={1}
                  />
                </div>
              </div>

              {/* Contraseña */}
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
                    onChange={(e) => { setContrasena(e.target.value); limpiar() }}
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

              {/* Recordarme + Olvidó */}
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
                  onClick={() => setError(
                    'Para restablecer su contraseña, contacte al administrador de su centro educativo.'
                  )}
                >
                  ¿Olvidó su contraseña?
                </button>
              </div>

              {/* Error */}
              {error && (
                <div id="lp-error" className="lp-error" role="alert" aria-live="polite">
                  <span className="lp-error-pip" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              {/* Botón principal */}
              <button
                type="submit"
                className="lp-btn-primary"
                disabled={cargando}
                tabIndex={5}
                aria-label="Iniciar sesión en DocenteOS"
              >
                {cargando ? (
                  <>
                    <Loader2 size={18} className="lp-spin" aria-hidden="true" />
                    Verificando…
                  </>
                ) : (
                  <>
                    <LogIn size={17} aria-hidden="true" />
                    Iniciar sesión
                    <ArrowRight size={16} className="lp-btn-arrow" aria-hidden="true" />
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="lp-divider" aria-hidden="true"><span>o</span></div>

              {/* Botón secundario */}
              <Link to="/registro" className="lp-btn-secondary" tabIndex={6}>
                <UserPlus size={17} aria-hidden="true" />
                Crear cuenta
              </Link>

              {/* Texto de ayuda */}
              <p className="lp-help-text">
                Solo se permiten cuentas institucionales del MINERD{' '}
                <strong>(@docente.edu.do)</strong> o cuenta administrativa autorizada.
              </p>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}
