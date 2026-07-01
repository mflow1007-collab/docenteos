import { useState, useEffect, useRef, useCallback } from 'react'
import { obtenerPlanificacionesDetalladas, guardarSesionAula, obtenerSesionesPlan } from '../firebase.js'
import { useAuth } from '../context/AuthContext.jsx'

// Pre-carga sincrónica desde localStorage (igual que Inicio.jsx) para no depender de Firestore en el render inicial
function cargarPlanesLocales() {
  try {
    const raw = localStorage.getItem('docenteos_planificaciones_guardadas')
    const arr = JSON.parse(raw || '[]')
    return Array.isArray(arr) ? arr : []
  } catch { return [] }
}

function cargarSesionesLocales() {
  try {
    return JSON.parse(localStorage.getItem('docenteos_sesiones_aula') || '[]')
  } catch { return [] }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parsearActividades(texto = '') {
  if (!texto) return []
  if (Array.isArray(texto)) return texto.map(String).filter(Boolean)
  return texto
    .split(/\n|•|·|\d+\.\s/)
    .map(s => s.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean)
}

function formatMin(s) {
  const m = Math.floor(s / 60), ss = s % 60
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

function parsearMin(texto = '0') {
  const n = parseInt(String(texto).replace(/[^0-9]/g, ''), 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

const COLORES_MOMENTO = {
  inicio:    { bg: '#eff6ff', borde: '#3b82f6', texto: '#1d4ed8', badge: '#3b82f6' },
  desarrollo:{ bg: '#f5f3ff', borde: '#7c3aed', texto: '#5b21b6', badge: '#7c3aed' },
  cierre:    { bg: '#f0fdf4', borde: '#16a34a', texto: '#15803d', badge: '#16a34a' },
}

const MOMENTOS_INFO = [
  { key: 'inicio',     label: 'Inicio',      icon: '🚀', num: 1 },
  { key: 'desarrollo', label: 'Desarrollo',  icon: '📚', num: 2 },
  { key: 'cierre',     label: 'Cierre',      icon: '✅', num: 3 },
]

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function TarjetaPlan({ plan, seleccionado, sesiones, onClick }) {
  const meta = plan.contenido?.metadatos || {}
  const grado = [meta.grado, meta.seccion].filter(Boolean).join(' ') || plan.curso || 'Curso'
  const area = meta.area || plan.area || 'Área'
  const tema = meta.tema || plan.tema || 'Sin tema'
  const sesionesCount = sesiones.filter(s => s.planId === plan.id).length
  const diaLabel = sesionesCount === 0 ? 'Primera clase' : `Día ${sesionesCount + 1}`

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', cursor: 'pointer',
        padding: '14px 16px',
        border: `2px solid ${seleccionado ? '#7c3aed' : '#e2e8f0'}`,
        borderRadius: 12, background: seleccionado ? '#f5f3ff' : '#fff',
        boxShadow: seleccionado ? '0 0 0 4px rgba(124,58,237,.15)' : '0 1px 4px rgba(0,0,0,.06)',
        transition: 'all .15s', marginBottom: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{
          fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
          letterSpacing: '.4px', color: '#7c3aed',
        }}>{area} · {grado}</span>
        <span style={{
          fontSize: 10.5, fontWeight: 700,
          color: sesionesCount === 0 ? '#16a34a' : '#7c3aed',
          background: sesionesCount === 0 ? '#dcfce7' : '#ede9fe',
          padding: '2px 8px', borderRadius: 20,
        }}>{diaLabel}</span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>{tema}</div>
      <div style={{ fontSize: 12, color: '#94a3b8' }}>
        {meta.tipoPlanificacion || 'Plan de clase'} · {plan.fecha
          ? new Date(plan.fecha?.seconds ? plan.fecha.seconds * 1000 : plan.fecha).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })
          : plan.createdAt
            ? new Date(plan.createdAt?.seconds ? plan.createdAt.seconds * 1000 : plan.createdAt).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })
            : 'Reciente'
        }
      </div>
    </button>
  )
}

function BarraProgreso({ momentoActivo, completados }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {MOMENTOS_INFO.map(({ key, label, icon, num }) => {
        const esCurrent = momentoActivo === key
        const esHecho = completados.has(key)
        const col = COLORES_MOMENTO[key]
        return (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 11px', borderRadius: 20,
              background: esHecho ? col.badge : esCurrent ? col.bg : '#f1f5f9',
              border: `1.5px solid ${esCurrent ? col.borde : esHecho ? col.badge : '#e2e8f0'}`,
              color: esHecho ? '#fff' : esCurrent ? col.texto : '#94a3b8',
              fontSize: 12, fontWeight: 700, transition: 'all .2s',
            }}>
              <span>{esHecho ? '✓' : icon}</span>
              <span>{label}</span>
            </div>
            {num < 3 && (
              <div style={{
                height: 2, width: 20,
                background: completados.has(key) ? '#7c3aed' : '#e2e8f0',
                borderRadius: 1,
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ModoAulaPage({ cursos = [], onIrA }) {
  const { formulario } = useAuth()

  // ── Fases: 'seleccion' | 'clase' | 'cierre'
  const [fase, setFase]                         = useState('seleccion')
  const [planes, setPlanes]                     = useState(() => cargarPlanesLocales())
  const [cargando, setCargando]                 = useState(false)
  const [sesiones, setSesiones]                 = useState(() => cargarSesionesLocales())
  const [planSeleccionado, setPlanSeleccionado] = useState(null)
  const [diaActual, setDiaActual]               = useState(1)

  // ── Estado de clase
  const [momentoActivo, setMomentoActivo]       = useState('inicio')
  const [completados, setCompletados]           = useState(new Set())
  const [actividadesCheck, setActividadesCheck] = useState({})  // { key: Set<index> }
  const [segundos, setSegundos]                 = useState(0)
  const [timerActivo, setTimerActivo]           = useState(false)
  const [guardando, setGuardando]               = useState(false)
  const [notas, setNotas]                       = useState('')
  const [guardadoOk, setGuardadoOk]             = useState(false)
  const intervalRef                             = useRef(null)

  // ── Cargar planes y sesiones (actualiza sobre el estado local inicial)
  useEffect(() => {
    // Los planes locales ya están en el estado; aquí actualizamos con Firestore si está disponible
    obtenerPlanificacionesDetalladas()
      .then(res => {
        if (res.success && Array.isArray(res.data) && res.data.length > 0)
          setPlanes(res.data)
      })
      .catch(() => {})
      .finally(() => setCargando(false))

    obtenerSesionesPlan()
      .then(res => { if (res.success && Array.isArray(res.data)) setSesiones(res.data) })
      .catch(() => setCargando(false))
  }, [])

  // ── Timer
  useEffect(() => {
    if (timerActivo) {
      intervalRef.current = setInterval(() => setSegundos(s => s + 1), 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [timerActivo])

  const resetTimer = useCallback(() => {
    clearInterval(intervalRef.current)
    setTimerActivo(false)
    setSegundos(0)
  }, [])

  // ── Extraer contenido del plan
  const contenido = planSeleccionado?.contenido || {}
  const meta = contenido.metadatos || {}
  const ip = contenido.intencionPedagogica || {}
  const dc = contenido.desarrolloClase || {}
  const ci = contenido.competenciasEIndicadores || {}

  const momentoData = dc[momentoActivo] || {}
  const totalMinutos = parsearMin(momentoData.tiempo)
  const totalSegundos = totalMinutos * 60
  const sobrepasado = totalSegundos > 0 && segundos > totalSegundos
  const pct = totalSegundos > 0 ? Math.min((segundos / totalSegundos) * 100, 100) : 0
  const col = COLORES_MOMENTO[momentoActivo]

  const actividadesDelMomento = parsearActividades(momentoData.actividades)
  const checkeadas = actividadesCheck[momentoActivo] || new Set()

  const sesionesDelPlan = sesiones.filter(s => s.planId === planSeleccionado?.id)

  const grado = [meta.grado, meta.seccion].filter(Boolean).join(' ') || planSeleccionado?.curso || 'Curso'
  const area = meta.area || planSeleccionado?.area || 'Área'
  const tema = meta.tema || planSeleccionado?.tema || 'Clase'

  // ── Handlers
  const iniciarClase = () => {
    const sesionesCount = sesiones.filter(s => s.planId === planSeleccionado?.id).length
    setDiaActual(sesionesCount + 1)
    setMomentoActivo('inicio')
    setCompletados(new Set())
    setActividadesCheck({})
    resetTimer()
    setNotas('')
    setFase('clase')
    setTimerActivo(true)
  }

  const toggleActividad = (idx) => {
    setActividadesCheck(prev => {
      const prevSet = new Set(prev[momentoActivo] || [])
      if (prevSet.has(idx)) prevSet.delete(idx)
      else prevSet.add(idx)
      return { ...prev, [momentoActivo]: prevSet }
    })
  }

  const siguienteMomento = () => {
    const orden = ['inicio', 'desarrollo', 'cierre']
    const idx = orden.indexOf(momentoActivo)
    setCompletados(prev => new Set([...prev, momentoActivo]))
    resetTimer()
    if (idx < orden.length - 1) {
      setMomentoActivo(orden[idx + 1])
      setTimerActivo(true)
    } else {
      // Último momento → ir a cierre
      setFase('cierre')
    }
  }

  const finalizarClase = async () => {
    setGuardando(true)
    const actividadesCompletadas = {}
    const actividadesPendientes  = {}
    ;['inicio', 'desarrollo', 'cierre'].forEach(key => {
      const lista = parsearActividades(dc[key]?.actividades)
      const check = actividadesCheck[key] || new Set()
      actividadesCompletadas[key] = lista.filter((_, i) => check.has(i))
      actividadesPendientes[key]  = lista.filter((_, i) => !check.has(i))
    })

    await guardarSesionAula({
      planId:      planSeleccionado?.id,
      planTema:    tema,
      planArea:    area,
      planGrado:   grado,
      dia:         diaActual,
      momentosCompletados: [...completados, momentoActivo],
      actividadesCompletadas,
      actividadesPendientes,
      observaciones: notas,
      duracionTotal: segundos + [...completados, momentoActivo].length * 10, // approx
    }).catch(() => {})

    setGuardando(false)
    setGuardadoOk(true)
  }

  // ── Actividades pendientes para sugerencia
  const pendientesTotales = ['inicio', 'desarrollo', 'cierre'].flatMap(key => {
    const lista = parsearActividades(dc[key]?.actividades)
    const check = actividadesCheck[key] || new Set()
    return lista.filter((_, i) => !check.has(i)).map(a => ({ momento: key, actividad: a }))
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER FASE: SELECCION
  // ═══════════════════════════════════════════════════════════════════════════
  if (fase === 'seleccion') {
    const primerNombre = (formulario.nombreDocente || '').split(' ')[0] || 'Docente'
    return (
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 8px 40px' }}>

        {/* ── Hero ────────────────────────────────────────────────────── */}
        <div style={{
          background: 'linear-gradient(135deg,#0e1a3a 0%,#1b2c5c 50%,#312e81 100%)',
          borderRadius: 18, padding: '32px 28px', marginBottom: 28,
          boxShadow: '0 20px 50px rgba(14,26,58,.35)',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', right: -20, top: -20,
            width: 160, height: 160, borderRadius: '50%',
            background: 'rgba(255,255,255,.04)',
          }} />
          <div style={{
            position: 'absolute', right: 30, bottom: -30,
            width: 100, height: 100, borderRadius: '50%',
            background: 'rgba(255,255,255,.05)',
          }} />
          <div style={{ position: 'relative' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.2)',
              borderRadius: 20, padding: '4px 12px', marginBottom: 14,
              fontSize: 11, fontWeight: 700, color: '#c4b5fd',
              textTransform: 'uppercase', letterSpacing: '.5px',
            }}>
              🏫 Modo Aula · DocenteOS
            </div>
            <h1 style={{
              fontSize: 26, fontWeight: 900, color: '#fff',
              marginBottom: 8, lineHeight: 1.2,
            }}>
              Hola, {primerNombre}
            </h1>
            <p style={{
              fontSize: 14.5, color: '#a5b4fc', lineHeight: 1.6,
              marginBottom: 0, maxWidth: 420,
            }}>
              Selecciona la planificación de hoy y convierte tu plan en una guía interactiva para la clase.
            </p>
          </div>
        </div>

        {/* ── Lista de planes ─────────────────────────────────────────── */}
        <div style={{ marginBottom: 10 }}>
          <h2 style={{
            fontSize: 13, fontWeight: 800, textTransform: 'uppercase',
            letterSpacing: '.5px', color: '#8a96ab', marginBottom: 14,
          }}>
            Tus planificaciones recientes
          </h2>

          {cargando && (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 14 }}>
              Cargando planificaciones…
            </div>
          )}

          {!cargando && planes.length === 0 && (
            <div style={{
              textAlign: 'center', padding: 40,
              background: '#f8fafc', borderRadius: 12, border: '1px dashed #e2e8f0',
            }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📝</div>
              <p style={{ color: '#64748b', marginBottom: 14, fontSize: 14 }}>
                Aún no tienes planificaciones guardadas.
              </p>
              <button
                onClick={() => onIrA?.('planificacion')}
                style={{
                  background: '#7c3aed', color: '#fff', border: 0,
                  borderRadius: 9, padding: '9px 18px',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Crear mi primera planificación
              </button>
            </div>
          )}

          {!cargando && planes.slice(0, 10).map(plan => (
            <TarjetaPlan
              key={plan.id}
              plan={plan}
              seleccionado={planSeleccionado?.id === plan.id}
              sesiones={sesiones}
              onClick={() => setPlanSeleccionado(plan)}
            />
          ))}
        </div>

        {/* ── CTA ─────────────────────────────────────────────────────── */}
        {planSeleccionado && (
          <div style={{
            position: 'sticky', bottom: 16,
            background: 'rgba(255,255,255,.95)',
            backdropFilter: 'blur(8px)',
            border: '1px solid #e2e8f0',
            borderRadius: 14, padding: '14px 18px',
            boxShadow: '0 8px 24px rgba(0,0,0,.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>
                {tema}
              </div>
              <div style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600 }}>
                {area} · {grado} · Día {sesionesDelPlan.length + 1}
              </div>
            </div>
            <button
              onClick={iniciarClase}
              style={{
                background: 'linear-gradient(135deg,#7c3aed,#6d28d9)',
                color: '#fff', border: 0, borderRadius: 10,
                padding: '10px 20px', fontSize: 14, fontWeight: 800,
                cursor: 'pointer', whiteSpace: 'nowrap',
                boxShadow: '0 6px 16px rgba(124,58,237,.4)',
              }}
            >
              🏫 Iniciar Clase
            </button>
          </div>
        )}
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER FASE: CLASE EN PROGRESO
  // ═══════════════════════════════════════════════════════════════════════════
  if (fase === 'clase') {
    const momentoInfo = MOMENTOS_INFO.find(m => m.key === momentoActivo)
    const esUltimoMomento = momentoActivo === 'cierre'

    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 8px 60px' }}>

        {/* ── Header de clase ─────────────────────────────────────────── */}
        <div style={{
          background: '#fff', border: '1px solid #e2e8f0',
          borderRadius: 14, padding: '14px 18px', marginBottom: 16,
          boxShadow: '0 2px 8px rgba(0,0,0,.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>{tema}</div>
              <div style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600, marginTop: 2 }}>
                {area} · {grado} · Día {diaActual}
              </div>
            </div>
            <div style={{
              background: '#f0fdf4', border: '1px solid #86efac',
              borderRadius: 20, padding: '4px 12px',
              fontSize: 12, fontWeight: 700, color: '#15803d',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: '#16a34a', display: 'inline-block',
                animation: 'pulse 1.5s infinite',
              }} />
              Clase en curso
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <BarraProgreso momentoActivo={momentoActivo} completados={completados} />
          </div>
        </div>

        {/* ── Card del momento activo ──────────────────────────────────── */}
        <div style={{
          background: col.bg, border: `2px solid ${col.borde}`,
          borderRadius: 16, padding: '20px 20px',
          boxShadow: `0 8px 24px ${col.borde}22`,
          marginBottom: 16,
        }}>
          {/* Momento header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: col.badge, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20,
              }}>{momentoInfo?.icon}</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: col.texto }}>
                  {momentoInfo?.label}
                </div>
                {totalMinutos > 0 && (
                  <div style={{ fontSize: 12, color: col.texto, opacity: .7 }}>
                    {totalMinutos} minutos asignados
                  </div>
                )}
              </div>
            </div>

            {/* Temporizador */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: 32, fontWeight: 800,
                color: sobrepasado ? '#ef4444' : col.texto,
                fontVariantNumeric: 'tabular-nums', lineHeight: 1,
              }}>{formatMin(segundos)}</div>
              {totalSegundos > 0 && (
                <div style={{
                  height: 4, width: 100, background: '#ffffff55', borderRadius: 2,
                  overflow: 'hidden', marginTop: 5,
                }}>
                  <div style={{
                    height: '100%', width: `${pct}%`,
                    background: sobrepasado ? '#ef4444' : col.badge,
                    transition: 'width .5s linear',
                  }} />
                </div>
              )}
              <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 6 }}>
                <button onClick={() => setTimerActivo(v => !v)} style={{
                  background: '#fff', border: `1px solid ${col.borde}`,
                  color: col.texto, borderRadius: 6, padding: '3px 8px',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}>{timerActivo ? '⏸' : '▶'}</button>
                <button onClick={resetTimer} style={{
                  background: '#fff', border: `1px solid ${col.borde}`,
                  color: col.texto, borderRadius: 6, padding: '3px 8px',
                  fontSize: 11, cursor: 'pointer',
                }}>↺</button>
              </div>
            </div>
          </div>

          {/* Intención (solo en inicio) */}
          {momentoActivo === 'inicio' && ip.intencionDelDia && (
            <div style={{
              background: '#fff', borderRadius: 10, padding: '10px 14px',
              marginBottom: 12, border: `1px solid ${col.borde}44`,
            }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: col.texto, textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 4 }}>
                🎯 Intención del día
              </div>
              <div style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.55 }}>
                {ip.intencionDelDia}
              </div>
            </div>
          )}

          {/* Estrategia (solo en desarrollo) */}
          {momentoActivo === 'desarrollo' && ip.estrategia && (
            <div style={{
              background: '#fff', borderRadius: 10, padding: '10px 14px',
              marginBottom: 12, border: `1px solid ${col.borde}44`,
            }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: col.texto, textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 4 }}>
                📐 Estrategia
              </div>
              <div style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.55 }}>
                {ip.estrategia}
              </div>
            </div>
          )}

          {/* Actividades (checklist) */}
          {actividadesDelMomento.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: col.texto, textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 8 }}>
                📋 Actividades
              </div>
              {actividadesDelMomento.map((act, i) => (
                <button
                  key={i}
                  onClick={() => toggleActividad(i)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    width: '100%', textAlign: 'left', cursor: 'pointer',
                    background: checkeadas.has(i) ? '#fff' : 'transparent',
                    border: `1px solid ${checkeadas.has(i) ? col.borde : 'transparent'}`,
                    borderRadius: 8, padding: '8px 10px', marginBottom: 4,
                    transition: 'all .12s',
                  }}
                >
                  <span style={{
                    flexShrink: 0, width: 18, height: 18, borderRadius: 5,
                    border: `2px solid ${col.badge}`,
                    background: checkeadas.has(i) ? col.badge : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 11, marginTop: 1,
                  }}>{checkeadas.has(i) ? '✓' : ''}</span>
                  <span style={{
                    fontSize: 13.5, color: checkeadas.has(i) ? '#9ca3af' : '#374151',
                    textDecoration: checkeadas.has(i) ? 'line-through' : 'none',
                    lineHeight: 1.5,
                  }}>{act}</span>
                </button>
              ))}
            </div>
          )}

          {/* Evidencia / Instrumento */}
          {(momentoData.evaluacion?.instrumento || momentoData.materiales) && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {momentoData.evaluacion?.instrumento && (
                <div style={{
                  flex: 1, minWidth: 160,
                  background: '#fff', borderRadius: 10, padding: '10px 12px',
                  border: `1px solid ${col.borde}44`,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: col.texto, textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 4 }}>
                    📊 Evidencia / Instrumento
                  </div>
                  <div style={{ fontSize: 13, color: '#374151' }}>
                    {momentoData.evaluacion.instrumento}
                  </div>
                </div>
              )}
              {momentoData.materiales && (
                <div style={{
                  flex: 1, minWidth: 160,
                  background: '#fff', borderRadius: 10, padding: '10px 12px',
                  border: `1px solid ${col.borde}44`,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: col.texto, textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 4 }}>
                    🎒 Recursos
                  </div>
                  <div style={{ fontSize: 13, color: '#374151' }}>
                    {momentoData.materiales}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Metacognición (solo en cierre) */}
          {momentoActivo === 'cierre' && momentoData.metacognicion && (
            <div style={{
              background: '#fff8', borderRadius: 10, padding: '10px 14px',
              marginTop: 10, border: `1px solid ${col.borde}44`,
            }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: col.texto, textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 4 }}>
                🪞 Metacognición
              </div>
              <div style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.55 }}>
                {momentoData.metacognicion}
              </div>
            </div>
          )}
        </div>

        {/* ── Indicadores clave ────────────────────────────────────────── */}
        {Array.isArray(ci.indicadoresLogro) && ci.indicadoresLogro.length > 0 && (
          <div style={{
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
            padding: '12px 16px', marginBottom: 16,
          }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#8a96ab', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>
              🎯 Indicadores de logro
            </div>
            {ci.indicadoresLogro.slice(0, 3).map((ind, i) => (
              <div key={i} style={{
                display: 'flex', gap: 8, marginBottom: 5, alignItems: 'flex-start',
              }}>
                <span style={{
                  flexShrink: 0, fontSize: 11, fontWeight: 800,
                  color: '#7c3aed', background: '#ede9fe',
                  borderRadius: 4, padding: '1px 5px', marginTop: 2,
                }}>{i + 1}</span>
                <span style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.5 }}>{ind}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Botones de acción ────────────────────────────────────────── */}
        <div style={{
          position: 'sticky', bottom: 16,
          display: 'flex', gap: 10, justifyContent: 'flex-end',
          background: 'rgba(255,255,255,.95)', backdropFilter: 'blur(8px)',
          border: '1px solid #e2e8f0', borderRadius: 14, padding: '12px 16px',
          boxShadow: '0 8px 24px rgba(0,0,0,.1)',
        }}>
          <button
            onClick={() => { setTimerActivo(false); setFase('seleccion') }}
            style={{
              background: 'transparent', border: '1px solid #e2e8f0',
              color: '#64748b', borderRadius: 9, padding: '9px 14px',
              fontSize: 13, cursor: 'pointer',
            }}
          >← Volver</button>
          <div style={{ flex: 1 }} />
          <button
            onClick={siguienteMomento}
            style={{
              background: esUltimoMomento
                ? 'linear-gradient(135deg,#16a34a,#15803d)'
                : `linear-gradient(135deg,${col.badge},${col.badge}dd)`,
              color: '#fff', border: 0, borderRadius: 9, padding: '9px 18px',
              fontSize: 14, fontWeight: 800, cursor: 'pointer',
              boxShadow: `0 6px 16px ${col.badge}44`,
            }}
          >
            {esUltimoMomento ? '✅ Finalizar clase' : `Pasar a ${MOMENTOS_INFO[MOMENTOS_INFO.findIndex(m => m.key === momentoActivo) + 1]?.label || ''} →`}
          </button>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER FASE: CIERRE
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 8px 60px' }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg,#15803d,#166534)',
        borderRadius: 16, padding: '24px 24px', marginBottom: 20,
        boxShadow: '0 12px 32px rgba(21,128,61,.3)',
      }}>
        <div style={{ fontSize: 32, marginBottom: 6 }}>🏁</div>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 4 }}>
          ¡Clase finalizada!
        </h2>
        <p style={{ fontSize: 14, color: '#bbf7d0', margin: 0 }}>
          {tema} · {area} · {grado} · Día {diaActual}
        </p>
      </div>

      {/* Resumen */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {['inicio','desarrollo','cierre'].map(key => {
          const lista = parsearActividades(dc[key]?.actividades)
          const check = actividadesCheck[key] || new Set()
          const hechas = lista.filter((_,i) => check.has(i)).length
          const c = COLORES_MOMENTO[key]
          const info = MOMENTOS_INFO.find(m => m.key === key)
          return (
            <div key={key} style={{
              flex: '1 1 180px',
              background: '#fff', border: `1px solid ${c.borde}`,
              borderRadius: 12, padding: '12px 14px',
            }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{info?.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: c.texto, marginBottom: 4 }}>{info?.label}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>{hechas}<span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 400 }}>/{lista.length}</span></div>
              <div style={{ fontSize: 11.5, color: '#64748b' }}>actividades completadas</div>
            </div>
          )
        })}
      </div>

      {/* Pendientes */}
      {pendientesTotales.length > 0 && (
        <div style={{
          background: '#fffbeb', border: '1px solid #fde68a',
          borderRadius: 12, padding: '14px 16px', marginBottom: 20,
        }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 10 }}>
            ⏭ {pendientesTotales.length} actividad(es) pendiente(s) — sugerencia para la próxima clase
          </div>
          {pendientesTotales.slice(0, 5).map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 5, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#d97706', background: '#fef9c3', borderRadius: 4, padding: '1px 5px', flexShrink: 0, marginTop: 2 }}>
                {p.momento === 'inicio' ? 'INICIO' : p.momento === 'desarrollo' ? 'DES.' : 'CIERRE'}
              </span>
              <span style={{ fontSize: 13, color: '#78350f', lineHeight: 1.5 }}>{p.actividad}</span>
            </div>
          ))}
        </div>
      )}

      {/* Observaciones del docente */}
      <div style={{
        background: '#fff', border: '1px solid #e2e8f0',
        borderRadius: 12, padding: '16px', marginBottom: 20,
      }}>
        <label style={{
          fontSize: 12, fontWeight: 800, color: '#475569',
          textTransform: 'uppercase', letterSpacing: '.3px',
          display: 'block', marginBottom: 8,
        }}>
          📝 Observaciones del docente (opcional)
        </label>
        <textarea
          value={notas}
          onChange={e => setNotas(e.target.value)}
          rows={4}
          placeholder="¿Qué funcionó bien? ¿Qué ajustarías? ¿Algún estudiante que necesite atención especial?"
          style={{
            width: '100%', border: '1px solid #e2e8f0', borderRadius: 9,
            padding: '10px 12px', fontSize: 13.5, color: '#374151',
            resize: 'vertical', outline: 'none', boxSizing: 'border-box',
            fontFamily: 'inherit', lineHeight: 1.6,
          }}
        />
      </div>

      {/* Botones */}
      {!guardadoOk ? (
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setFase('clase')}
            style={{
              flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0',
              color: '#64748b', borderRadius: 10, padding: '12px',
              fontSize: 14, cursor: 'pointer',
            }}
          >← Continuar clase</button>
          <button
            onClick={finalizarClase}
            disabled={guardando}
            style={{
              flex: 2,
              background: guardando
                ? '#86efac'
                : 'linear-gradient(135deg,#16a34a,#15803d)',
              color: '#fff', border: 0, borderRadius: 10, padding: '12px',
              fontSize: 14, fontWeight: 800, cursor: guardando ? 'default' : 'pointer',
              boxShadow: guardando ? 'none' : '0 6px 16px rgba(21,128,61,.35)',
            }}
          >
            {guardando ? '⏳ Guardando…' : '✅ Guardar y cerrar clase'}
          </button>
        </div>
      ) : (
        <div style={{
          textAlign: 'center', padding: '28px 20px',
          background: '#f0fdf4', border: '1px solid #86efac',
          borderRadius: 14,
        }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🎉</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#15803d', marginBottom: 6 }}>
            Clase registrada correctamente
          </div>
          <div style={{ fontSize: 13.5, color: '#16a34a', marginBottom: 20 }}>
            El resumen quedó guardado en tu historial de sesiones.
          </div>
          <button
            onClick={() => { setFase('seleccion'); setPlanSeleccionado(null) }}
            style={{
              background: '#7c3aed', color: '#fff', border: 0,
              borderRadius: 10, padding: '10px 22px',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >Volver al inicio</button>
        </div>
      )}
    </div>
  )
}
