import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db, guardarCurso } from '../firebase.js'
import { guardarPerfilInstitucional } from '../services/perfilInstitucionalService.js'
import './BienvenidaPage.css'

const NOMBRES_EJEMPLO = [
  "María García", "Juan Pérez", "Carmen López", "José Rodríguez",
  "Ana Martínez", "Luis Santos", "Rosa Reyes", "Pedro Díaz",
  "Isabel Fernández", "Carlos Moreno", "Lucía Jiménez", "Miguel Torres",
  "Sofía Ruiz", "Andrés Vargas", "Paula Romero", "Diego Castillo",
  "Valentina Cruz", "Ricardo Flores", "Daniela Mendoza", "Alejandro Herrera",
  "Natalia Suárez", "Fernando Medina", "Laura Guerrero", "Sebastián Molina",
  "Camila Morales", "Emilio Vega", "Diana Ramos", "Ernesto Silva",
  "Paola Cortés", "Manuel Ortega",
]

function generarEstudiantesEjemplo(total = 30) {
  const puntajes = [94, 91, 88, 86, 84, 82, 80, 78, 76, 74, 72, 70, 68, 65, 62, 58, 55, 52]
  return Array.from({ length: total }, (_, i) => ({
    nombre: NOMBRES_EJEMPLO[i % NOMBRES_EJEMPLO.length],
    promedio: puntajes[i % puntajes.length],
  }))
}

const REGIONALES = [
  'Regional 01 - Barahona',
  'Regional 02 - San Juan de la Maguana',
  'Regional 03 - Azua',
  'Regional 04 - San Cristóbal',
  'Regional 05 - San Pedro de Macorís',
  'Regional 06 - La Vega',
  'Regional 07 - San Francisco de Macorís',
  'Regional 08 - Santiago',
  'Regional 09 - Mao (Valverde y Santiago Rodríguez)',
  'Regional 10 - Santo Domingo II (Este, Norte y Boca Chica)',
  'Regional 11 - Puerto Plata',
  'Regional 12 - Higüey (La Altagracia)',
  'Regional 13 - Montecristi',
  'Regional 14 - Nagua',
  'Regional 15 - Santo Domingo III (Distrito Nacional y Oeste)',
  'Regional 16 - Cotuí',
  'Regional 17 - Monte Plata',
  'Regional 18 - Neyba',
]

const NIVELES = ['Inicial', 'Primaria', 'Secundaria']

const MODALIDADES = ['General', 'Académica', 'Técnico-Profesional', 'Artes', 'Especial']

const CICLOS_POR_NIVEL = {
  Inicial:    ['Primer Ciclo (0-3 años)', 'Segundo Ciclo (3-6 años)'],
  Primaria:   ['Primer Ciclo (1ro-3ro)',  'Segundo Ciclo (4to-6to)'],
  Secundaria: ['Primer Ciclo (1ro-3ro)',  'Segundo Ciclo (4to-6to)'],
}

// Genera opciones de ciclo con prefijo del nivel cuando hay más de uno
function buildCicloOptions(nivelesDocente) {
  if (nivelesDocente.length === 0) return []
  if (nivelesDocente.length === 1) {
    return (CICLOS_POR_NIVEL[nivelesDocente[0]] ?? []).map((c) => ({
      value: `${nivelesDocente[0]} - ${c}`,
      label: c,
    }))
  }
  return nivelesDocente.flatMap((n) =>
    (CICLOS_POR_NIVEL[n] ?? []).map((c) => ({
      value: `${n} - ${c}`,
      label: `${n} — ${c}`,
    }))
  )
}

// Grados disponibles por ciclo (value coincide con el formato de buildCicloOptions)
const GRADOS_CICLO = {
  'Secundaria - Primer Ciclo (1ro-3ro)':  { grados: ['1ro Secundaria', '2do Secundaria', '3ro Secundaria'], autoSelect: false },
  'Secundaria - Segundo Ciclo (4to-6to)': { grados: ['4to Secundaria', '5to Secundaria', '6to Secundaria'], autoSelect: false },
  'Primaria - Primer Ciclo (1ro-3ro)':    { grados: ['1ro Primaria', '2do Primaria', '3ro Primaria'],        autoSelect: false },
  'Primaria - Segundo Ciclo (4to-6to)':   { grados: ['4to Primaria', '5to Primaria', '6to Primaria'],        autoSelect: false },
  'Inicial - Primer Ciclo (0-3 años)':    { grados: ['Nivel 1 (0-1 año)', 'Nivel 2 (1-2 años)', 'Nivel 3 (2-3 años)'],             autoSelect: true },
  'Inicial - Segundo Ciclo (3-6 años)':   { grados: ['Pre-Kínder (3-4 años)', 'Kínder (4-5 años)', 'Preparatorio (5-6 años)'],    autoSelect: true },
}

const JORNADAS = ['Matutina', 'Vespertina', 'Nocturna', 'Extendida']

const PERIODOS = ['2024-2025', '2025-2026', '2026-2027']

export default function BienvenidaPage({ onPerfilGuardado }) {
  const user = auth?.currentUser

  const [nombre,          setNombre]          = useState('')
  const [regional,        setRegional]        = useState('')
  const [distrito,        setDistrito]        = useState('')
  const [centro,          setCentro]          = useState('')
  const [codigoCentro,    setCodigoCentro]    = useState('')
  const [nivelesCentro,   setNivelesCentro]   = useState([])   // multi-select
  const [nivelesDocente,  setNivelesDocente]  = useState([])   // multi-select
  const [modalidad,       setModalidad]       = useState('')
  const [ciclos,          setCiclos]          = useState([])   // multi-select
  const [gradosDocente,   setGradosDocente]   = useState([])   // grados seleccionados
  const [jornada,         setJornada]         = useState('')
  const [periodo,         setPeriodo]         = useState('')

  const [cargando,        setCargando]        = useState(false)
  const [error,           setError]           = useState('')
  const [iniciando,       setIniciando]       = useState(true)

  useEffect(() => {
    const precargar = async () => {
      if (!user || !db) { setIniciando(false); return }
      try {
        const snap = await getDoc(doc(db, 'usuarios', user.uid))
        const data = snap.data() ?? {}
        setNombre(data.nombre || user.displayName || '')
      } catch {
        setNombre(user.displayName || '')
      } finally {
        setIniciando(false)
      }
    }
    precargar()
  }, [user])

  // Limpiar ciclos si cambian los niveles que imparte
  useEffect(() => {
    setCiclos([])
  }, [nivelesDocente])

  // Auto-seleccionar grados para ciclos con autoSelect=true; limpiar grados de ciclos deseleccionados
  useEffect(() => {
    const autoGrados = ciclos.flatMap((c) => {
      const cfg = GRADOS_CICLO[c]
      return cfg?.autoSelect ? cfg.grados : []
    })
    const todosLosGrados = new Set(ciclos.flatMap((c) => GRADOS_CICLO[c]?.grados ?? []))
    setGradosDocente((prev) => {
      const manuales = prev.filter((g) => todosLosGrados.has(g) && !autoGrados.includes(g))
      return [...new Set([...manuales, ...autoGrados])]
    })
  }, [ciclos])

  // Si un nivel del docente ya no está en los del centro, quitarlo
  useEffect(() => {
    setNivelesDocente((prev) => prev.filter((n) => nivelesCentro.includes(n)))
  }, [nivelesCentro])

  if (iniciando) return null

  const primerNombre     = nombre.trim().split(' ')[0] || 'docente'
  const cicloOptions     = buildCicloOptions(nivelesDocente)
  const nivelesDocentes  = nivelesCentro.length > 0
    ? NIVELES.filter((n) => nivelesCentro.includes(n))
    : NIVELES

  const toggleNivelCentro = (nivel) => {
    setError('')
    setNivelesCentro((prev) =>
      prev.includes(nivel) ? prev.filter((n) => n !== nivel) : [...prev, nivel]
    )
  }

  const toggleNivelDocente = (nivel) => {
    setError('')
    setNivelesDocente((prev) =>
      prev.includes(nivel) ? prev.filter((n) => n !== nivel) : [...prev, nivel]
    )
  }

  const toggleCiclo = (value) => {
    setError('')
    setCiclos((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    )
  }

  const toggleGrado = (grado) => {
    setError('')
    setGradosDocente((prev) =>
      prev.includes(grado) ? prev.filter((g) => g !== grado) : [...prev, grado]
    )
  }

  const gradoOptions = ciclos.flatMap((c) => {
    const cfg = GRADOS_CICLO[c]
    if (!cfg) return []
    return cfg.grados.map((g) => ({ value: g, autoSelect: cfg.autoSelect, ciclo: c }))
  })

  const handleGuardar = async (e) => {
    e.preventDefault()
    setError('')

    if (!nombre.trim())            { setError('El nombre del docente es obligatorio.'); return }
    if (!regional)                 { setError('Seleccione una regional.'); return }
    if (!distrito.trim())          { setError('El distrito es obligatorio.'); return }
    if (!centro.trim())            { setError('El nombre del centro educativo es obligatorio.'); return }
    if (!codigoCentro.trim())      { setError('El código del centro es obligatorio.'); return }
    if (nivelesCentro.length === 0)  { setError('Seleccione al menos un nivel del centro.'); return }
    if (nivelesDocente.length === 0) { setError('Indique en qué nivel o niveles imparte clases.'); return }
    if (!modalidad)                  { setError('Seleccione la modalidad.'); return }
    if (ciclos.length === 0)         { setError('Seleccione al menos un ciclo.'); return }
    if (gradoOptions.length > 0 && gradosDocente.length === 0) { setError('Seleccione al menos un grado en el que imparte clases.'); return }
    if (!jornada)                  { setError('Seleccione la jornada escolar.'); return }
    if (!periodo)                  { setError('Seleccione el período escolar.'); return }
    if (!user)                     { setError('Sesión no encontrada. Recargue la página.'); return }
    if (!db)                       { setError('Sin conexión con el servidor.'); return }

    setCargando(true)
    try {
      await guardarPerfilInstitucional(user.uid, {
        nombreDocente:   nombre.trim(),
        regional,
        distrito:        distrito.trim(),
        centroEducativo: centro.trim(),
        codigoCentro:    codigoCentro.trim(),
        nivelesCentro,
        nivelesDocente,
        modalidad,
        ciclos,
        gradosDocente,
        jornadaEscolar:  jornada,
        periodoEscolar:  periodo,
      })

      // Auto-crear un curso por cada grado seleccionado
      for (let idx = 0; idx < gradosDocente.length; idx++) {
        const grado = gradosDocente[idx]
        const nivel = grado.includes('Secundaria') ? 'Secundaria' : grado.includes('Primaria') ? 'Primaria' : 'Inicial'
        const estudiantesDetalle = generarEstudiantesEjemplo(30)
        const promedioEjemplo = Math.round(estudiantesDetalle.reduce((s, e) => s + e.promedio, 0) / estudiantesDetalle.length)
        try {
          await guardarCurso({
            id: `auto-${Date.now()}-${idx}`,
            nombre: `${grado} A`,
            grado,
            nivel,
            area: 'General',
            seccion: 'A',
            estudiantes: 30,
            promedio: promedioEjemplo,
            pendientes: 0,
            icono: grado[0].toUpperCase(),
            acento: '#2563eb',
            temaActual: 'Tema por definir',
            estudiantesDetalle,
            esAutoGenerado: true,
            flujo: [],
            enRiesgo: [],
            destacados: [],
            historialPromedio: [72, 74, 76, 78, 79, 81, 83, 84],
            resumenRapido: { instrumentos: 0, evaluaciones: 0, enRiesgo: 0 },
            instrumentosRecientes: [],
            proximasAcciones: ['Configurar área/asignatura', 'Crear instrumento', 'Registrar primera clase'],
          })
        } catch {
          // No es fatal: el docente puede crear cursos manualmente
        }
      }

      onPerfilGuardado()
    } catch (err) {
      console.error('[BienvenidaPage] Error guardando perfil:', err)
      setError('No fue posible guardar la información. Intente nuevamente.')
      setCargando(false)
    }
  }

  return (
    <div className="bp-shell">

      <div className="bp-bg" aria-hidden="true">
        <div className="bp-bg-glow bp-glow-1" />
        <div className="bp-bg-glow bp-glow-2" />
        <div className="bp-bg-grid" />
      </div>

      <div className="bp-card">
        <div className="bp-stripe" aria-hidden="true" />

        <div className="bp-card-body">

          {/* Encabezado */}
          <div className="bp-header">
            <div className="bp-logo-wrap">
              <img
                src="/logo-docenteos.png"
                alt="DocenteOS"
                className="bp-logo"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
              <span className="bp-logo-fallback" aria-hidden="true">🎓</span>
            </div>
            <div>
              <h1 className="bp-brand">Docente<b>OS</b></h1>
              <p className="bp-tagline">Plataforma Inteligente para la Gestión Docente</p>
            </div>
          </div>

          {/* Bienvenida */}
          <div className="bp-welcome">
            <h2 className="bp-welcome-title">👋 ¡Bienvenido, {primerNombre}!</h2>
            <p className="bp-welcome-desc">
              Nos alegra tenerte en DocenteOS. Antes de comenzar, completa la información de tu
              centro educativo. Estos datos se utilizarán automáticamente en todas tus planificaciones.
            </p>
          </div>

          {/* Formulario */}
          <form className="bp-form" onSubmit={handleGuardar} noValidate>
            <h3 className="bp-section-title">Datos del docente y centro educativo</h3>

            <div className="bp-grid">

              {/* Nombre del docente */}
              <div className="bp-field bp-field-full">
                <label htmlFor="bp-nombre" className="bp-label">Nombre del docente</label>
                <input
                  id="bp-nombre"
                  type="text"
                  className="bp-input"
                  placeholder="Tu nombre completo"
                  value={nombre}
                  onChange={(e) => { setNombre(e.target.value); setError('') }}
                  autoComplete="name"
                  disabled={cargando}
                />
              </div>

              {/* Regional */}
              <div className="bp-field">
                <label htmlFor="bp-regional" className="bp-label">Regional</label>
                <select
                  id="bp-regional"
                  className="bp-input"
                  value={regional}
                  onChange={(e) => { setRegional(e.target.value); setError('') }}
                  disabled={cargando}
                >
                  <option value="">Seleccionar…</option>
                  {REGIONALES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              {/* Distrito */}
              <div className="bp-field">
                <label htmlFor="bp-distrito" className="bp-label">Distrito</label>
                <input
                  id="bp-distrito"
                  type="text"
                  className="bp-input"
                  placeholder="Ej: Distrito 10-03"
                  value={distrito}
                  onChange={(e) => { setDistrito(e.target.value); setError('') }}
                  disabled={cargando}
                />
              </div>

              {/* Centro educativo */}
              <div className="bp-field bp-field-full">
                <label htmlFor="bp-centro" className="bp-label">Centro educativo</label>
                <input
                  id="bp-centro"
                  type="text"
                  className="bp-input"
                  placeholder="Nombre completo del centro"
                  value={centro}
                  onChange={(e) => { setCentro(e.target.value); setError('') }}
                  disabled={cargando}
                />
              </div>

              {/* Código del centro */}
              <div className="bp-field">
                <label htmlFor="bp-codigo" className="bp-label">Código del centro</label>
                <input
                  id="bp-codigo"
                  type="text"
                  className="bp-input"
                  placeholder="Ej: 10-003-0012"
                  value={codigoCentro}
                  onChange={(e) => { setCodigoCentro(e.target.value); setError('') }}
                  disabled={cargando}
                />
              </div>

              {/* Modalidad */}
              <div className="bp-field">
                <label htmlFor="bp-modalidad" className="bp-label">Modalidad</label>
                <select
                  id="bp-modalidad"
                  className="bp-input"
                  value={modalidad}
                  onChange={(e) => { setModalidad(e.target.value); setError('') }}
                  disabled={cargando}
                >
                  <option value="">Seleccionar…</option>
                  {MODALIDADES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              {/* ── Niveles del centro (checkboxes) ── */}
              <div className="bp-field bp-field-full">
                <span className="bp-label">Niveles del centro</span>
                <p className="bp-field-hint">Marca todos los niveles que ofrece tu centro educativo.</p>
                <div className="bp-checkbox-group" role="group" aria-label="Niveles del centro">
                  {NIVELES.map((n) => (
                    <label key={n} className={`bp-checkbox-card ${nivelesCentro.includes(n) ? 'checked' : ''} ${cargando ? 'disabled' : ''}`}>
                      <input
                        type="checkbox"
                        checked={nivelesCentro.includes(n)}
                        onChange={() => toggleNivelCentro(n)}
                        disabled={cargando}
                        aria-label={n}
                      />
                      <span className="bp-checkbox-check" aria-hidden="true" />
                      <span className="bp-checkbox-label">{n}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* ── Nivel en que imparto (checkboxes, filtrado por niveles del centro) ── */}
              <div className="bp-field bp-field-full">
                <span className="bp-label">Nivel en que imparto clases</span>
                <p className="bp-field-hint">Marca todos los niveles en los que tú das clases.</p>
                <div className="bp-checkbox-group" role="group" aria-label="Nivel en que imparto">
                  {nivelesDocentes.map((n) => (
                    <label key={n} className={`bp-checkbox-card ${nivelesDocente.includes(n) ? 'checked' : ''} ${cargando ? 'disabled' : ''}`}>
                      <input
                        type="checkbox"
                        checked={nivelesDocente.includes(n)}
                        onChange={() => toggleNivelDocente(n)}
                        disabled={cargando}
                        aria-label={n}
                      />
                      <span className="bp-checkbox-check" aria-hidden="true" />
                      <span className="bp-checkbox-label">{n}</span>
                    </label>
                  ))}
                  {nivelesCentro.length === 0 && (
                    <p className="bp-field-placeholder">Selecciona primero los niveles del centro.</p>
                  )}
                </div>
              </div>

              {/* ── Ciclo (checkboxes, aparece cuando hay niveles docente seleccionados) ── */}
              {cicloOptions.length > 0 && (
                <div className="bp-field bp-field-full">
                  <span className="bp-label">Ciclo</span>
                  <p className="bp-field-hint">Marca los ciclos en los que impartes clases.</p>
                  <div className="bp-checkbox-group" role="group" aria-label="Ciclo">
                    {cicloOptions.map(({ value, label }) => (
                      <label key={value} className={`bp-checkbox-card ${ciclos.includes(value) ? 'checked' : ''} ${cargando ? 'disabled' : ''}`}>
                        <input
                          type="checkbox"
                          checked={ciclos.includes(value)}
                          onChange={() => toggleCiclo(value)}
                          disabled={cargando}
                          aria-label={label}
                        />
                        <span className="bp-checkbox-check" aria-hidden="true" />
                        <span className="bp-checkbox-label">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Grados que imparte ── */}
              {gradoOptions.length > 0 && (
                <div className="bp-field bp-field-full">
                  <span className="bp-label">Grados que impartes</span>
                  <p className="bp-field-hint">
                    Selecciona los grados específicos en los que das clases.
                    {ciclos.some((c) => GRADOS_CICLO[c]?.autoSelect) && (
                      <> Los marcados como <strong>Auto</strong> se agregan solos porque pertenecen al ciclo completo.</>
                    )}
                  </p>
                  <div className="bp-checkbox-group" role="group" aria-label="Grados">
                    {gradoOptions.map(({ value, autoSelect }) => (
                      autoSelect ? (
                        <div key={value} className="bp-checkbox-card checked" style={{ opacity: 0.8, cursor: 'default' }}>
                          <span className="bp-checkbox-check" aria-hidden="true" />
                          <span className="bp-checkbox-label">{value}</span>
                          <span style={{ fontSize: 10, background: '#2563eb', color: '#fff', borderRadius: 4, padding: '1px 5px', marginLeft: 6 }}>Auto</span>
                        </div>
                      ) : (
                        <label key={value} className={`bp-checkbox-card ${gradosDocente.includes(value) ? 'checked' : ''} ${cargando ? 'disabled' : ''}`}>
                          <input
                            type="checkbox"
                            checked={gradosDocente.includes(value)}
                            onChange={() => toggleGrado(value)}
                            disabled={cargando}
                            aria-label={value}
                          />
                          <span className="bp-checkbox-check" aria-hidden="true" />
                          <span className="bp-checkbox-label">{value}</span>
                        </label>
                      )
                    ))}
                  </div>
                </div>
              )}

              {/* Jornada escolar */}
              <div className="bp-field">
                <label htmlFor="bp-jornada" className="bp-label">Jornada escolar</label>
                <select
                  id="bp-jornada"
                  className="bp-input"
                  value={jornada}
                  onChange={(e) => { setJornada(e.target.value); setError('') }}
                  disabled={cargando}
                >
                  <option value="">Seleccionar…</option>
                  {JORNADAS.map((j) => <option key={j} value={j}>{j}</option>)}
                </select>
              </div>

              {/* Período escolar */}
              <div className="bp-field bp-field-full">
                <label htmlFor="bp-periodo" className="bp-label">Período escolar</label>
                <select
                  id="bp-periodo"
                  className="bp-input bp-input-period"
                  value={periodo}
                  onChange={(e) => { setPeriodo(e.target.value); setError('') }}
                  disabled={cargando}
                >
                  <option value="">Seleccionar…</option>
                  {PERIODOS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

            </div>

            {/* Error */}
            {error && (
              <div className="bp-error" role="alert" aria-live="polite">
                <span className="bp-error-pip" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            {/* Botón */}
            <button
              type="submit"
              className="bp-btn-primary"
              disabled={cargando}
              aria-label="Guardar datos institucionales y continuar al dashboard"
            >
              {cargando ? (
                <>
                  <Loader2 size={18} className="bp-spin" aria-hidden="true" />
                  Guardando…
                </>
              ) : (
                'Guardar y continuar →'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
