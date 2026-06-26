import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import {
  User, AtSign, Lock, Eye, EyeOff,
  UserPlus, Loader2, ArrowLeft, Briefcase,
} from 'lucide-react'
import { auth, db } from '../firebase.js'
import './RegistroPage.css'

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

// ── Mensajes de error de Firebase ───────────────────────────────────────────
const ERRORES = {
  'auth/email-already-in-use':    'Ya existe una cuenta con este correo.',
  'auth/invalid-email':           'El correo electrónico no es válido.',
  'auth/weak-password':           'La contraseña debe tener al menos 6 caracteres.',
  'auth/network-request-failed':  'Problema de conexión. Verifique su internet.',
  'auth/too-many-requests':       'Demasiados intentos. Intente nuevamente más tarde.',
  'auth/operation-not-allowed':   'El registro por correo no está habilitado. Active Email/Password en la consola de Firebase.',
  'auth/internal-error':          'Error interno de Firebase. Intente nuevamente.',
  'auth/admin-restricted-operation': 'Operación restringida. Contacte al administrador.',
  'permission-denied':            'Sin permiso para guardar en la base de datos. Revise las reglas de Firestore.',
}
const getError = (code) => {
  console.error('[RegistroPage] Firebase error code:', code)
  return ERRORES[code] ?? `No fue posible crear la cuenta. (código: ${code})`
}

// ── Opciones de cargo ────────────────────────────────────────────────────────
const CARGOS = [
  { value: 'docente',      label: 'Docente' },
  { value: 'coordinador',  label: 'Coordinador Pedagógico' },
  { value: 'director',     label: 'Director' },
  { value: 'orientador',   label: 'Orientador(a) Escolar' },
  { value: 'psicologo',    label: 'Psicólogo(a) Escolar' },
]

// ─────────────────────────────────────────────────────────────────────────────
export default function RegistroPage() {
  const navigate = useNavigate()

  const [nombre,          setNombre]          = useState('')
  const [correo,          setCorreo]          = useState('')
  const [cargo,           setCargo]           = useState('docente')
  const [contrasena,      setContrasena]      = useState('')
  const [confirmar,       setConfirmar]       = useState('')
  const [verContrasena,   setVerContrasena]   = useState(false)
  const [verConfirmar,    setVerConfirmar]    = useState(false)
  const [cargando,        setCargando]        = useState(false)
  const [error,           setError]           = useState('')

  const limpiar = () => { if (error) setError('') }

  const handleRegistro = async (e) => {
    e.preventDefault()
    setError('')

    // Validaciones
    if (!nombre.trim())         { setError('Debe ingresar su nombre completo.'); return }
    if (nombre.trim().length < 3){ setError('El nombre debe tener al menos 3 caracteres.'); return }

    const errCorreo = validarCorreo(correo)
    if (errCorreo)              { setError(errCorreo); return }

    if (!contrasena)            { setError('Debe crear una contraseña.'); return }
    if (contrasena.length < 6)  { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    if (contrasena !== confirmar){ setError('Las contraseñas no coinciden.'); return }

    if (!auth)  { setError('El servicio de autenticación no está disponible.'); return }
    if (!db)    { setError('El servicio de base de datos no está disponible.'); return }

    setCargando(true)
    try {
      // Crear cuenta en Firebase Auth
      const { user } = await createUserWithEmailAndPassword(auth, correo.trim(), contrasena)

      // Guardar en Firestore con estado pendiente (fallo no bloquea el acceso)
      if (db) {
        try {
          const cargoSeleccionado = CARGOS.find((c) => c.value === cargo)
          await setDoc(doc(db, 'usuarios', user.uid), {
            uid:           user.uid,
            nombre:        nombre.trim(),
            email:         correo.trim().toLowerCase(),
            rol:           cargo,
            cargo:         cargoSeleccionado?.label ?? cargo,
            estado:        'pendiente',
            fechaCreacion: serverTimestamp(),
            actualizadoEn: serverTimestamp(),
            suscripcion: 'Pendiente de completar',
            temaActivo: 'Pendiente de completar',
            usoMensual: 'Pendiente de completar',
          }, { merge: true })
        } catch (fsErr) {
          console.error('[RegistroPage] Firestore error:', fsErr.code, fsErr.message)
        }
      }

      // Redirigir al dashboard (el router detecta el auth state)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(getError(err.code))
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="rp-shell">

      {/* Fondo decorativo */}
      <div className="rp-bg" aria-hidden="true">
        <div className="rp-bg-glow rp-glow-1" />
        <div className="rp-bg-glow rp-glow-2" />
        <div className="rp-bg-grid" />
      </div>

      <div className="rp-card">

        {/* Franja superior */}
        <div className="rp-stripe" aria-hidden="true" />

        <div className="rp-card-body">

          {/* Encabezado */}
          <div className="rp-header">
            <div className="rp-logo-wrap">
              <img
                src="/logo-docenteos.png"
                alt="DocenteOS"
                className="rp-logo"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
              <span className="rp-logo-fallback" aria-hidden="true">🎓</span>
            </div>
            <div>
              <h1 className="rp-brand">Docente<b>OS</b></h1>
              <p className="rp-tagline">Plataforma Inteligente para la Gestión Docente</p>
            </div>
          </div>

          <div className="rp-titles">
            <h2 className="rp-title">Crear cuenta</h2>
            <p className="rp-subtitle">Completa el formulario para solicitar tu acceso</p>
          </div>

          {/* Formulario */}
          <form className="rp-form" onSubmit={handleRegistro} noValidate>

            {/* Nombre */}
            <div className="rp-field">
              <label htmlFor="rp-nombre" className="rp-label">Nombre completo</label>
              <div className="rp-input-wrap">
                <User size={16} className="rp-icon" aria-hidden="true" />
                <input
                  id="rp-nombre"
                  type="text"
                  className="rp-input"
                  placeholder="Tu nombre completo"
                  value={nombre}
                  onChange={(e) => { setNombre(e.target.value); limpiar() }}
                  autoComplete="name"
                  autoFocus
                  disabled={cargando}
                  aria-label="Nombre completo"
                  tabIndex={1}
                />
              </div>
            </div>

            {/* Correo */}
            <div className="rp-field">
              <label htmlFor="rp-correo" className="rp-label">Correo institucional</label>
              <div className="rp-input-wrap">
                <AtSign size={16} className="rp-icon" aria-hidden="true" />
                <input
                  id="rp-correo"
                  type="email"
                  className="rp-input"
                  placeholder={`usuario${DOMINIO}`}
                  value={correo}
                  onChange={(e) => { setCorreo(e.target.value); limpiar() }}
                  autoComplete="email"
                  disabled={cargando}
                  aria-label="Correo institucional"
                  tabIndex={2}
                />
              </div>
            </div>

            {/* Cargo */}
            <div className="rp-field">
              <label htmlFor="rp-cargo" className="rp-label">Cargo</label>
              <div className="rp-input-wrap">
                <Briefcase size={16} className="rp-icon" aria-hidden="true" />
                <select
                  id="rp-cargo"
                  className="rp-input rp-select"
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  disabled={cargando}
                  aria-label="Cargo"
                  tabIndex={3}
                >
                  {CARGOS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Contraseña */}
            <div className="rp-field">
              <label htmlFor="rp-pass" className="rp-label">Contraseña</label>
              <div className="rp-input-wrap">
                <Lock size={16} className="rp-icon" aria-hidden="true" />
                <input
                  id="rp-pass"
                  type={verContrasena ? 'text' : 'password'}
                  className="rp-input rp-input-pass"
                  placeholder="Mínimo 6 caracteres"
                  value={contrasena}
                  onChange={(e) => { setContrasena(e.target.value); limpiar() }}
                  autoComplete="new-password"
                  disabled={cargando}
                  aria-label="Contraseña"
                  tabIndex={4}
                />
                <button
                  type="button"
                  className="rp-eye-btn"
                  onClick={() => setVerContrasena((v) => !v)}
                  aria-label={verContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  tabIndex={-1}
                >
                  {verContrasena ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Confirmar contraseña */}
            <div className="rp-field">
              <label htmlFor="rp-confirm" className="rp-label">Confirmar contraseña</label>
              <div className="rp-input-wrap">
                <Lock size={16} className="rp-icon" aria-hidden="true" />
                <input
                  id="rp-confirm"
                  type={verConfirmar ? 'text' : 'password'}
                  className="rp-input rp-input-pass"
                  placeholder="Repite tu contraseña"
                  value={confirmar}
                  onChange={(e) => { setConfirmar(e.target.value); limpiar() }}
                  autoComplete="new-password"
                  disabled={cargando}
                  aria-label="Confirmar contraseña"
                  tabIndex={5}
                />
                <button
                  type="button"
                  className="rp-eye-btn"
                  onClick={() => setVerConfirmar((v) => !v)}
                  aria-label={verConfirmar ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  tabIndex={-1}
                >
                  {verConfirmar ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Aviso de estado pendiente */}
            <div className="rp-notice">
              <span className="rp-notice-icon" aria-hidden="true">ℹ</span>
              <span>
                Tu cuenta quedará en estado <strong>pendiente</strong> hasta que un administrador
                apruebe tu acceso.
              </span>
            </div>

            {/* Error */}
            {error && (
              <div className="rp-error" role="alert" aria-live="polite">
                <span className="rp-error-pip" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            {/* Botón crear cuenta */}
            <button
              type="submit"
              className="rp-btn-primary"
              disabled={cargando}
              tabIndex={6}
              aria-label="Crear cuenta en DocenteOS"
            >
              {cargando ? (
                <>
                  <Loader2 size={18} className="rp-spin" aria-hidden="true" />
                  Creando cuenta…
                </>
              ) : (
                <>
                  <UserPlus size={17} aria-hidden="true" />
                  Crear cuenta
                </>
              )}
            </button>

            {/* Volver */}
            <Link to="/login" className="rp-btn-back" tabIndex={7}>
              <ArrowLeft size={16} aria-hidden="true" />
              Volver a iniciar sesión
            </Link>
          </form>
        </div>
      </div>
    </div>
  )
}
