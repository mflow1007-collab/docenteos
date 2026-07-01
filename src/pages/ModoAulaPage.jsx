/**
 * ModoAulaPage — Guía interactiva de clase desde la planificación guardada.
 *
 * Soporta dos formatos de plan:
 *   - Plan Diario:  contenido.desarrolloClase.{ inicio, desarrollo, cierre }
 *   - Plan Unidad:  contenido.fases[].dias[].momentos[]
 *
 * No modifica la planificación, el registro, ni ningún otro módulo.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { obtenerPlanificacionesDetalladas, guardarSesionAula } from '../firebase.js'
import { useAuth } from '../context/AuthContext.jsx'

// ─── Adaptador universal ───────────────────────────────────────────────────────
// Recibe plan.contenido y devuelve { tipo, titulo, grado, area, dias[] }
// Cada dia: { semana, diaNum, titulo, intencionPedagogica, momentos[] }
// Cada momento: { nombre, tiempo, actividades: string[], evidencias: string[],
//                 evaluacion: {tipo, agente, tecnica, instrumento, evidencias},
//                 recursos: {humanos, didacticos, tecnologicos}, metacognicion: string[] }

function toStrArr(v) {
  if (!v) return []
  if (Array.isArray(v)) return v.flatMap(x => String(x).split('\n').map(s => s.replace(/^[-•*]\s*/, '').trim()).filter(Boolean))
  return String(v).split('\n').map(s => s.replace(/^[-•*\d.]\s*/, '').trim()).filter(Boolean)
}

function normalizarMomentoUnidad(mom) {
  return {
    nombre:    mom.nombre || '',
    tiempo:    mom.tiempo || '30 min',
    actividades:  toStrArr(mom.actividades),
    evidencias:   toStrArr(mom.evidencias),
    evaluacion: {
      tipo:       mom.evaluacion?.tipo       || '',
      agente:     mom.evaluacion?.agente     || '',
      tecnica:    mom.evaluacion?.tecnica    || '',
      instrumento: mom.evaluacion?.instrumento || '',
      evidencias:  toStrArr(mom.evaluacion?.evidencias),
    },
    recursos: {
      humanos:      mom.recursos?.humanos      || '',
      didacticos:   mom.recursos?.didacticos   || '',
      tecnologicos: mom.recursos?.tecnologicos || '',
    },
    metacognicion: toStrArr(mom.metacognicion),
  }
}

function normalizarMomentoDiario(key, dc) {
  const m = dc[key] || {}
  const nombres = { inicio: 'Inicio', desarrollo: 'Desarrollo', cierre: 'Cierre' }
  const tiemposDefault = { inicio: '10 min', desarrollo: '30 min', cierre: '10 min' }
  return {
    nombre:     nombres[key],
    tiempo:     m.tiempo || tiemposDefault[key],
    actividades: toStrArr(m.actividades),
    evidencias:  toStrArr(m.evaluacion?.evidencias),
    evaluacion: {
      tipo:       m.evaluacion?.tipo       || '',
      agente:     m.evaluacion?.agente     || '',
      tecnica:    m.evaluacion?.tecnica    || '',
      instrumento: m.evaluacion?.instrumento || '',
      evidencias:  toStrArr(m.evaluacion?.evidencias),
    },
    recursos: {
      humanos:      m.recursos?.humanos      || '',
      didacticos:   m.recursos?.didacticos   || '',
      tecnologicos: m.recursos?.tecnologicos || '',
    },
    metacognicion: toStrArr(m.metacognicion),
  }
}

export function normalizarClaseParaModoAula(contenido) {
  if (!contenido) return null

  const meta = contenido.metadatos || {}
  const tituloUnidad = meta.titulo || meta.tema || ''
  const grado = [meta.grado, meta.seccion].filter(Boolean).join(' ')
  const area  = meta.area || meta.asignatura || ''
  const tipoPlan = meta.tipoPlanificacion || ''

  // ── Plan Unidad (tiene fases[].dias[])
  const tieneUnidad = Array.isArray(contenido.fases) && contenido.fases.length > 0
  if (tieneUnidad || tipoPlan.includes('Unidad') || tipoPlan.includes('Proyecto')) {
    const dias = []
    ;(contenido.fases || []).forEach(fase => {
      ;(fase.dias || []).forEach(dia => {
        dias.push({
          semana:            dia.semana    || null,
          diaNum:            dia.numeroGlobal || dias.length + 1,
          diaCalendario:     dia.diaCalendario || null,
          titulo:            dia.titulo || `Clase ${dia.numeroGlobal || dias.length + 1}`,
          intencionPedagogica: dia.intencionPedagogica || '',
          criteriosExito:    toStrArr(dia.criteriosExito),
          momentos:          (dia.momentos || []).map(normalizarMomentoUnidad),
        })
      })
    })
    return { tipo: 'unidad', tituloUnidad, grado, area, dias }
  }

  // ── Plan Diario (tiene desarrolloClase)
  const dc = contenido.desarrolloClase || {}
  const ip = contenido.intencionPedagogica || {}
  const dias = [{
    semana:            null,
    diaNum:            1,
    diaCalendario:     meta.fecha || null,
    titulo:            meta.tema || 'Clase',
    intencionPedagogica: ip.intencionDelDia || '',
    criteriosExito:    [],
    momentos:          ['inicio','desarrollo','cierre'].map(k => normalizarMomentoDiario(k, dc)),
  }]
  return { tipo: 'diario', tituloUnidad: meta.tema || '', grado, area, dias }
}

// ─── Helpers UI ───────────────────────────────────────────────────────────────

function formatMin(s) {
  const m = Math.floor(s / 60), ss = s % 60
  return `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`
}

function parseMinutos(texto = '0') {
  return parseInt(String(texto).replace(/[^0-9]/g,''), 10) || 0
}

const COL = {
  Inicio:     { bg:'#eff6ff', borde:'#3b82f6', texto:'#1d4ed8', badge:'#3b82f6', icon:'🚀' },
  Desarrollo: { bg:'#f5f3ff', borde:'#7c3aed', texto:'#5b21b6', badge:'#7c3aed', icon:'📚' },
  Cierre:     { bg:'#f0fdf4', borde:'#16a34a', texto:'#15803d', badge:'#16a34a', icon:'✅' },
}
const COL_DEFAULT = { bg:'#f8fafc', borde:'#94a3b8', texto:'#475569', badge:'#64748b', icon:'📌' }

function colores(nombreMomento) {
  return COL[nombreMomento] || COL_DEFAULT
}

// ─── Pre-carga sincrónica desde localStorage ──────────────────────────────────

function cargarPlanesLocales() {
  try {
    const raw = localStorage.getItem('docenteos_planificaciones_guardadas')
    const arr = JSON.parse(raw || '[]')
    return Array.isArray(arr) ? arr : []
  } catch { return [] }
}

function leerProgreso(planId, diaNum) {
  try {
    const key = `docenteos_modo_aula_progreso_${planId}_${diaNum}`
    return JSON.parse(localStorage.getItem(key) || 'null')
  } catch { return null }
}

function guardarProgreso(planId, diaNum, datos) {
  try {
    const key = `docenteos_modo_aula_progreso_${planId}_${diaNum}`
    localStorage.setItem(key, JSON.stringify({ ...datos, updatedAt: new Date().toISOString() }))
  } catch {}
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export default function ModoAulaPage({ onIrA }) {
  const { formulario } = useAuth()

  // ── Fases
  const [fase, setFase] = useState('seleccion') // 'seleccion' | 'clase' | 'cierre'

  // ── Lista de planes
  const [planes, setPlanes] = useState(() => cargarPlanesLocales())
  const [cargando, setCargando] = useState(false)

  // ── Plan y día seleccionados
  const [planSeleccionado, setPlanSeleccionado]   = useState(null)
  const [claseNorm, setClaseNorm]                 = useState(null)  // resultado del adaptador
  const [diaSeleccionado, setDiaSeleccionado]     = useState(null)  // objeto dia normalizado
  const [progresoExistente, setProgresoExistente] = useState(null)

  // ── Estado de clase
  const [momentoIdx, setMomentoIdx]               = useState(0)
  const [actChecks, setActChecks]                 = useState({})    // { momentoNombre: Set<i> }
  const [momentosOk, setMomentosOk]               = useState(new Set())
  const [segundos, setSegundos]                   = useState(0)
  const [timerOn, setTimerOn]                     = useState(false)
  const [notas, setNotas]                         = useState('')
  const [guardando, setGuardando]                 = useState(false)
  const [guardadoOk, setGuardadoOk]               = useState(false)

  const intervalRef = useRef(null)

  // ── Cargar planes desde Firestore (actualiza sobre el estado local inicial)
  useEffect(() => {
    obtenerPlanificacionesDetalladas()
      .then(res => {
        if (res.success && Array.isArray(res.data) && res.data.length > 0)
          setPlanes(res.data)
      })
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [])

  // ── Timer
  useEffect(() => {
    if (timerOn) {
      intervalRef.current = setInterval(() => setSegundos(s => s + 1), 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [timerOn])

  const resetTimer = useCallback(() => {
    clearInterval(intervalRef.current)
    setTimerOn(false)
    setSegundos(0)
  }, [])

  // ── Al seleccionar plan: normalizar y detectar progreso previo
  const seleccionarPlan = (plan) => {
    setPlanSeleccionado(plan)
    const norm = normalizarClaseParaModoAula(plan.contenido || plan)
    setClaseNorm(norm)
    // Auto-seleccionar el único día para planes diarios
    if (norm && norm.dias.length === 1) {
      const dia = norm.dias[0]
      setDiaSeleccionado(dia)
      const prev = leerProgreso(plan.id, dia.diaNum)
      setProgresoExistente(prev && prev.estadoClase !== 'finalizada' ? prev : null)
    } else {
      setDiaSeleccionado(null)
      setProgresoExistente(null)
    }
  }

  const seleccionarDia = (dia) => {
    setDiaSeleccionado(dia)
    const prev = leerProgreso(planSeleccionado.id, dia.diaNum)
    setProgresoExistente(prev && prev.estadoClase !== 'finalizada' ? prev : null)
  }

  // ── Iniciar clase nueva o continuar
  const iniciarClase = (continuar = false) => {
    if (!diaSeleccionado) return
    const momentos = diaSeleccionado.momentos || []

    if (continuar && progresoExistente) {
      setMomentoIdx(progresoExistente.momentoIdx || 0)
      setActChecks((() => {
        const restored = {}
        Object.entries(progresoExistente.actChecks || {}).forEach(([k, arr]) => {
          restored[k] = new Set(arr)
        })
        return restored
      })())
      setMomentosOk(new Set(progresoExistente.momentosOk || []))
      setNotas(progresoExistente.notas || '')
    } else {
      setMomentoIdx(0)
      setActChecks({})
      setMomentosOk(new Set())
      setNotas('')
    }
    resetTimer()
    setFase('clase')
    setTimeout(() => setTimerOn(true), 300)
  }

  // ── Guardar progreso automático
  const persistirProgreso = useCallback((overrides = {}) => {
    if (!planSeleccionado || !diaSeleccionado) return
    const serialChecks = {}
    Object.entries(actChecks).forEach(([k, s]) => { serialChecks[k] = [...s] })
    guardarProgreso(planSeleccionado.id, diaSeleccionado.diaNum, {
      momentoIdx,
      actChecks: serialChecks,
      momentosOk: [...momentosOk],
      notas,
      estadoClase: 'en_curso',
      ...overrides,
    })
  }, [planSeleccionado, diaSeleccionado, momentoIdx, actChecks, momentosOk, notas])

  // ── Toggle actividad
  const toggleAct = (momentoNombre, idx) => {
    setActChecks(prev => {
      const s = new Set(prev[momentoNombre] || [])
      if (s.has(idx)) s.delete(idx); else s.add(idx)
      return { ...prev, [momentoNombre]: s }
    })
  }

  // ── Pasar al siguiente momento
  const siguienteMomento = () => {
    if (!diaSeleccionado) return
    const momentos = diaSeleccionado.momentos || []
    const nombreActual = momentos[momentoIdx]?.nombre
    setMomentosOk(prev => new Set([...prev, nombreActual]))
    resetTimer()
    if (momentoIdx < momentos.length - 1) {
      setMomentoIdx(i => i + 1)
      setTimeout(() => setTimerOn(true), 200)
      persistirProgreso({ momentoIdx: momentoIdx + 1 })
    } else {
      persistirProgreso({ estadoClase: 'en_cierre' })
      setFase('cierre')
    }
  }

  // ── Finalizar clase
  const finalizarClase = async () => {
    if (!planSeleccionado || !diaSeleccionado) return
    setGuardando(true)
    const resumen = {}
    ;(diaSeleccionado.momentos || []).forEach(mom => {
      const checks = actChecks[mom.nombre] || new Set()
      resumen[mom.nombre] = {
        completadas: mom.actividades.filter((_, i) => checks.has(i)),
        pendientes:  mom.actividades.filter((_, i) => !checks.has(i)),
      }
    })
    const normMeta = claseNorm || {}
    await guardarSesionAula({
      planId:      planSeleccionado.id,
      planTema:    diaSeleccionado.titulo,
      planArea:    normMeta.area,
      planGrado:   normMeta.grado,
      diaNum:      diaSeleccionado.diaNum,
      semana:      diaSeleccionado.semana,
      observaciones: notas,
      resumenActividades: resumen,
      estadoClase: 'finalizada',
    }).catch(() => {})
    guardarProgreso(planSeleccionado.id, diaSeleccionado.diaNum, { estadoClase: 'finalizada' })
    setGuardando(false)
    setGuardadoOk(true)
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DATOS DEL MOMENTO ACTIVO
  // ─────────────────────────────────────────────────────────────────────────────
  const momentos       = diaSeleccionado?.momentos || []
  const momentoActual  = momentos[momentoIdx] || {}
  const c              = colores(momentoActual.nombre)
  const totalSeg       = parseMinutos(momentoActual.tiempo) * 60
  const pct            = totalSeg > 0 ? Math.min(segundos / totalSeg * 100, 100) : 0
  const sobrepasado    = totalSeg > 0 && segundos > totalSeg
  const checksActual   = actChecks[momentoActual.nombre] || new Set()
  const actTotal       = momentoActual.actividades?.length || 0
  const actHechas      = checksActual.size

  const primerNombre = (formulario.nombreDocente || '').split(' ')[0] || 'Docente'
  const diasOpciones = claseNorm?.dias || []

  // ─────────────────────────────────────────────────────────────────────────────
  // ── FASE: SELECCIÓN
  // ─────────────────────────────────────────────────────────────────────────────
  if (fase === 'seleccion') {
    return (
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 8px 60px' }}>

        {/* Hero */}
        <div style={{
          background: 'linear-gradient(135deg,#0e1a3a 0%,#1b2c5c 60%,#312e81 100%)',
          borderRadius: 18, padding: '30px 26px', marginBottom: 24,
          boxShadow: '0 20px 50px rgba(14,26,58,.35)', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position:'absolute', right:-20, top:-20, width:160, height:160, borderRadius:'50%', background:'rgba(255,255,255,.04)' }} />
          <div style={{ position: 'relative' }}>
            <div style={{
              display:'inline-flex', alignItems:'center', gap:7,
              background:'rgba(255,255,255,.12)', border:'1px solid rgba(255,255,255,.2)',
              borderRadius:20, padding:'4px 14px', marginBottom:14,
              fontSize:11, fontWeight:700, color:'#c4b5fd', letterSpacing:'.5px', textTransform:'uppercase',
            }}>🏫 Modo Aula · DocenteOS</div>
            <h1 style={{ fontSize:24, fontWeight:900, color:'#fff', marginBottom:6, lineHeight:1.2 }}>
              Buenos días, {primerNombre}
            </h1>
            <p style={{ fontSize:14, color:'#a5b4fc', lineHeight:1.6, margin:0, maxWidth:420 }}>
              Selecciona tu planificación del día y conviértela en una guía interactiva para impartir la clase.
            </p>
          </div>
        </div>

        {/* Lista de planes */}
        <h2 style={{ fontSize:12, fontWeight:800, textTransform:'uppercase', letterSpacing:'.5px', color:'#8a96ab', marginBottom:14 }}>
          Tus planificaciones guardadas
        </h2>

        {cargando && <div style={{ textAlign:'center', padding:40, color:'#94a3b8' }}>Cargando…</div>}

        {!cargando && planes.length === 0 && (
          <div style={{ textAlign:'center', padding:40, background:'#f8fafc', borderRadius:12, border:'1px dashed #e2e8f0' }}>
            <div style={{ fontSize:36, marginBottom:10 }}>📝</div>
            <p style={{ color:'#64748b', marginBottom:14, fontSize:14 }}>Aún no tienes planificaciones guardadas.</p>
            <button onClick={() => onIrA?.('planificacion')} style={{
              background:'#7c3aed', color:'#fff', border:0, borderRadius:9, padding:'9px 18px',
              fontSize:13, fontWeight:700, cursor:'pointer',
            }}>Crear mi primera planificación</button>
          </div>
        )}

        {planes.map(plan => {
          const norm = (() => { try { return normalizarClaseParaModoAula(plan.contenido || plan) } catch { return null } })()
          const meta = plan.contenido?.metadatos || {}
          const titulo = meta.titulo || meta.tema || plan.tema || 'Sin título'
          const grado  = [meta.grado, meta.seccion].filter(Boolean).join(' ') || plan.curso || ''
          const area   = meta.area || plan.area || ''
          const tipo   = meta.tipoPlanificacion || plan.tipo || ''
          const numDias = norm?.dias.length || 1
          const sel = planSeleccionado?.id === plan.id

          return (
            <div
              key={plan.id}
              onClick={() => seleccionarPlan(plan)}
              style={{
                cursor:'pointer', padding:'14px 16px', marginBottom:10,
                border:`2px solid ${sel ? '#7c3aed' : '#e2e8f0'}`,
                borderRadius:12, background: sel ? '#f5f3ff' : '#fff',
                boxShadow: sel ? '0 0 0 4px rgba(124,58,237,.12)' : '0 1px 4px rgba(0,0,0,.06)',
                transition:'all .14s',
              }}
            >
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:5, flexWrap:'wrap', gap:6 }}>
                <span style={{ fontSize:10.5, fontWeight:800, textTransform:'uppercase', letterSpacing:'.3px', color:'#7c3aed' }}>
                  {area}{grado ? ` · ${grado}` : ''}
                </span>
                <div style={{ display:'flex', gap:6 }}>
                  {numDias > 1 && (
                    <span style={{ fontSize:10.5, fontWeight:700, background:'#ede9fe', color:'#6d28d9', borderRadius:20, padding:'2px 8px' }}>
                      {numDias} clases
                    </span>
                  )}
                  <span style={{ fontSize:10.5, fontWeight:700, background:'#f1f5f9', color:'#64748b', borderRadius:20, padding:'2px 8px' }}>
                    {tipo || 'Plan de clase'}
                  </span>
                </div>
              </div>
              <div style={{ fontSize:15, fontWeight:800, color:'#0f172a', lineHeight:1.3 }}>{titulo}</div>
              {norm && numDias > 1 && (
                <div style={{ fontSize:11.5, color:'#7c3aed', marginTop:4, fontWeight:600 }}>
                  {norm.dias.slice(0,3).map(d => `Sem.${d.semana} D${d.diaNum}: ${d.titulo}`).join(' · ')}{numDias > 3 ? ` · +${numDias-3} más` : ''}
                </div>
              )}
            </div>
          )
        })}

        {/* Selector de día (para planes con múltiples días) */}
        {planSeleccionado && diasOpciones.length > 1 && (
          <div style={{
            background:'#fff', border:'1px solid #e2e8f0', borderRadius:12,
            padding:'14px 16px', marginBottom:16,
          }}>
            <div style={{ fontSize:12, fontWeight:800, color:'#374151', marginBottom:10 }}>
              Selecciona la clase de hoy
            </div>
            {diasOpciones.map(dia => {
              const prog = leerProgreso(planSeleccionado.id, dia.diaNum)
              const selDia = diaSeleccionado?.diaNum === dia.diaNum
              return (
                <button
                  key={dia.diaNum}
                  onClick={() => seleccionarDia(dia)}
                  style={{
                    display:'flex', alignItems:'center', gap:12, width:'100%',
                    textAlign:'left', cursor:'pointer',
                    padding:'10px 12px', marginBottom:6, borderRadius:9,
                    border:`1.5px solid ${selDia ? '#7c3aed' : '#e2e8f0'}`,
                    background: prog?.estadoClase === 'finalizada' ? '#f0fdf4'
                               : selDia ? '#f5f3ff' : '#fafbfc',
                    transition:'all .12s',
                  }}
                >
                  <div style={{
                    flexShrink:0, width:36, height:36, borderRadius:9,
                    background: prog?.estadoClase === 'finalizada' ? '#dcfce7'
                               : selDia ? '#ede9fe' : '#f1f5f9',
                    color: prog?.estadoClase === 'finalizada' ? '#15803d'
                           : selDia ? '#6d28d9' : '#64748b',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:14, fontWeight:900,
                  }}>
                    {prog?.estadoClase === 'finalizada' ? '✓' : `D${dia.diaNum}`}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12.5, fontWeight:700, color:'#0f172a' }}>
                      {dia.semana ? `Semana ${dia.semana} · ` : ''}Día {dia.diaNum}
                      {dia.diaCalendario ? ` · ${dia.diaCalendario}` : ''}
                    </div>
                    <div style={{ fontSize:12, color:'#64748b', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {dia.titulo}
                    </div>
                  </div>
                  {prog?.estadoClase === 'en_curso' && (
                    <span style={{ fontSize:10.5, fontWeight:700, color:'#d97706', background:'#fef9c3', borderRadius:20, padding:'2px 8px', flexShrink:0 }}>
                      En curso
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* CTA sticky */}
        {planSeleccionado && diaSeleccionado && (
          <div style={{
            position:'sticky', bottom:16,
            background:'rgba(255,255,255,.96)', backdropFilter:'blur(8px)',
            border:'1px solid #e2e8f0', borderRadius:14, padding:'14px 18px',
            boxShadow:'0 8px 24px rgba(0,0,0,.12)',
          }}>
            <div style={{ marginBottom:10 }}>
              {claseNorm?.tituloUnidad && (
                <div style={{ fontSize:11, color:'#7c3aed', fontWeight:700, marginBottom:2 }}>
                  {claseNorm.tituloUnidad}
                </div>
              )}
              <div style={{ fontWeight:800, fontSize:15, color:'#0f172a', lineHeight:1.2 }}>
                {diaSeleccionado.semana ? `Semana ${diaSeleccionado.semana} · ` : ''}Día {diaSeleccionado.diaNum} · {diaSeleccionado.titulo}
              </div>
              <div style={{ fontSize:12, color:'#7c3aed', fontWeight:600, marginTop:2 }}>
                {claseNorm?.area} · {claseNorm?.grado}
              </div>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              {progresoExistente && (
                <button
                  onClick={() => iniciarClase(true)}
                  style={{
                    flex:1, background:'#fff7ed', border:'1px solid #fed7aa',
                    color:'#c2410c', borderRadius:10, padding:'10px 14px',
                    fontSize:13, fontWeight:700, cursor:'pointer',
                  }}
                >⏭ Continuar clase</button>
              )}
              <button
                onClick={() => iniciarClase(false)}
                style={{
                  flex:2,
                  background:'linear-gradient(135deg,#7c3aed,#6d28d9)',
                  color:'#fff', border:0, borderRadius:10, padding:'11px 20px',
                  fontSize:14, fontWeight:800, cursor:'pointer',
                  boxShadow:'0 6px 16px rgba(124,58,237,.4)',
                }}
              >🏫 {progresoExistente ? 'Nueva clase' : 'Iniciar clase'}</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ── FASE: CLASE EN CURSO
  // ─────────────────────────────────────────────────────────────────────────────
  if (fase === 'clase') {
    const esUltimo = momentoIdx === momentos.length - 1

    return (
      <div style={{ maxWidth: 740, margin: '0 auto', padding: '0 8px 80px' }}>

        {/* Header */}
        <div style={{
          background:'#fff', border:'1px solid #e2e8f0', borderRadius:14,
          padding:'14px 18px', marginBottom:14,
          boxShadow:'0 2px 8px rgba(0,0,0,.06)',
        }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
            <div style={{ flex:1, minWidth:0 }}>
              {claseNorm?.tituloUnidad && (
                <div style={{ fontSize:11, color:'#7c3aed', fontWeight:700, marginBottom:2 }}>
                  {claseNorm.tituloUnidad}
                </div>
              )}
              <div style={{ fontSize:11, color:'#94a3b8', fontWeight:600, marginBottom:3 }}>
                {claseNorm?.area} · {claseNorm?.grado}
                {diaSeleccionado?.semana ? ` · Semana ${diaSeleccionado.semana} · Día ${diaSeleccionado.diaNum}` : ''}
              </div>
              <div style={{ fontWeight:800, fontSize:16, color:'#0f172a', lineHeight:1.3 }}>
                {diaSeleccionado?.titulo}
              </div>
            </div>
            <div style={{
              background:'#f0fdf4', border:'1px solid #86efac', borderRadius:20,
              padding:'4px 12px', fontSize:12, fontWeight:700, color:'#15803d',
              display:'flex', alignItems:'center', gap:6, flexShrink:0,
            }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:'#16a34a', display:'inline-block' }} />
              En curso
            </div>
          </div>

          {/* Barra de progreso de momentos */}
          <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:14, flexWrap:'wrap' }}>
            {momentos.map((mom, i) => {
              const c2 = colores(mom.nombre)
              const hecho = momentosOk.has(mom.nombre)
              const actual = i === momentoIdx
              return (
                <div key={mom.nombre} style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <div style={{
                    display:'flex', alignItems:'center', gap:5,
                    padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:700,
                    background: hecho ? c2.badge : actual ? c2.bg : '#f1f5f9',
                    border:`1.5px solid ${actual ? c2.borde : hecho ? c2.badge : '#e2e8f0'}`,
                    color: hecho ? '#fff' : actual ? c2.texto : '#94a3b8',
                    transition:'all .2s',
                  }}>
                    {hecho ? '✓' : c2.icon} {mom.nombre}
                  </div>
                  {i < momentos.length - 1 && (
                    <div style={{ width:18, height:2, background: hecho ? '#7c3aed' : '#e2e8f0', borderRadius:1 }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Intención pedagógica */}
        {diaSeleccionado?.intencionPedagogica && (
          <div style={{
            background:'#faf9ff', border:'1px solid #ddd6fe', borderRadius:12,
            padding:'12px 16px', marginBottom:14,
          }}>
            <div style={{ fontSize:10.5, fontWeight:800, color:'#6d28d9', textTransform:'uppercase', letterSpacing:'.3px', marginBottom:5 }}>
              🎯 Intención pedagógica del día
            </div>
            <div style={{ fontSize:13.5, color:'#374151', lineHeight:1.6 }}>
              {diaSeleccionado.intencionPedagogica}
            </div>
          </div>
        )}

        {/* Card del momento activo */}
        <div style={{
          background:c.bg, border:`2px solid ${c.borde}`, borderRadius:16,
          padding:'18px 20px', boxShadow:`0 8px 24px ${c.borde}22`, marginBottom:14,
        }}>
          {/* Cabecera del momento */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{
                width:44, height:44, borderRadius:12, flexShrink:0,
                background:c.badge, color:'#fff',
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:22,
              }}>{c.icon}</div>
              <div>
                <div style={{ fontSize:19, fontWeight:900, color:c.texto }}>{momentoActual.nombre}</div>
                <div style={{ fontSize:12, color:c.texto, opacity:.7 }}>{momentoActual.tiempo}</div>
              </div>
            </div>

            {/* Temporizador */}
            <div style={{ textAlign:'center' }}>
              <div style={{
                fontSize:34, fontWeight:800, color: sobrepasado ? '#ef4444' : c.texto,
                fontVariantNumeric:'tabular-nums', lineHeight:1,
              }}>{formatMin(segundos)}</div>
              {totalSeg > 0 && (
                <div style={{ height:4, width:100, background:'rgba(0,0,0,.1)', borderRadius:2, overflow:'hidden', marginTop:5 }}>
                  <div style={{ height:'100%', width:`${pct}%`, background: sobrepasado ? '#ef4444' : c.badge, transition:'width .5s linear' }} />
                </div>
              )}
              <div style={{ display:'flex', gap:4, justifyContent:'center', marginTop:6 }}>
                <button onClick={() => setTimerOn(v=>!v)} style={{
                  background:'#fff', border:`1px solid ${c.borde}`, color:c.texto,
                  borderRadius:6, padding:'3px 9px', fontSize:12, fontWeight:700, cursor:'pointer',
                }}>{timerOn ? '⏸' : '▶'}</button>
                <button onClick={resetTimer} style={{
                  background:'#fff', border:`1px solid ${c.borde}`, color:c.texto,
                  borderRadius:6, padding:'3px 8px', fontSize:12, cursor:'pointer',
                }}>↺</button>
              </div>
            </div>
          </div>

          {/* ── Actividades */}
          {momentoActual.actividades?.length > 0 && (
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10.5, fontWeight:800, color:c.texto, textTransform:'uppercase', letterSpacing:'.3px', marginBottom:8 }}>
                📋 Actividades ({actHechas}/{actTotal})
              </div>
              {momentoActual.actividades.map((act, i) => (
                <button
                  key={i}
                  onClick={() => toggleAct(momentoActual.nombre, i)}
                  style={{
                    display:'flex', alignItems:'flex-start', gap:10, width:'100%',
                    textAlign:'left', cursor:'pointer',
                    background: checksActual.has(i) ? '#fff' : 'transparent',
                    border:`1px solid ${checksActual.has(i) ? c.borde : 'transparent'}`,
                    borderRadius:8, padding:'8px 10px', marginBottom:4, transition:'all .12s',
                  }}
                >
                  <span style={{
                    flexShrink:0, width:20, height:20, borderRadius:5,
                    border:`2px solid ${c.badge}`,
                    background: checksActual.has(i) ? c.badge : 'transparent',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    color:'#fff', fontSize:11, marginTop:1,
                  }}>{checksActual.has(i) ? '✓' : ''}</span>
                  <span style={{
                    fontSize:13.5, color: checksActual.has(i) ? '#9ca3af' : '#374151',
                    textDecoration: checksActual.has(i) ? 'line-through' : 'none',
                    lineHeight:1.5,
                  }}>
                    <strong style={{ color: checksActual.has(i) ? '#9ca3af' : c.texto }}>{i + 1}.</strong> {act}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* ── Evidencias */}
          {(momentoActual.evidencias?.length > 0 || momentoActual.evaluacion?.evidencias?.length > 0) && (
            <div style={{
              background:'#fff', borderRadius:10, padding:'10px 14px',
              marginBottom:10, border:`1px solid ${c.borde}44`,
            }}>
              <div style={{ fontSize:10.5, fontWeight:800, color:c.texto, textTransform:'uppercase', letterSpacing:'.3px', marginBottom:6 }}>
                🔍 Evidencias a recoger
              </div>
              {(momentoActual.evidencias.length > 0 ? momentoActual.evidencias : momentoActual.evaluacion?.evidencias || []).map((ev, i) => (
                <div key={i} style={{ fontSize:13, color:'#475569', marginBottom:3, display:'flex', gap:6 }}>
                  <span style={{ color:c.badge, fontWeight:700, flexShrink:0 }}>•</span> {ev}
                </div>
              ))}
            </div>
          )}

          {/* ── Evaluación */}
          {(momentoActual.evaluacion?.tipo || momentoActual.evaluacion?.instrumento) && (
            <div style={{
              background:'#fff', borderRadius:10, padding:'10px 14px',
              marginBottom:10, border:`1px solid ${c.borde}44`,
            }}>
              <div style={{ fontSize:10.5, fontWeight:800, color:c.texto, textTransform:'uppercase', letterSpacing:'.3px', marginBottom:6 }}>
                📊 Evaluación
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {[
                  ['Tipo', momentoActual.evaluacion.tipo],
                  ['Técnica', momentoActual.evaluacion.tecnica],
                  ['Instrumento', momentoActual.evaluacion.instrumento],
                  ['Agente', momentoActual.evaluacion.agente],
                ].filter(([,v]) => v).map(([label, val]) => (
                  <div key={label} style={{ fontSize:12, color:'#374151' }}>
                    <span style={{ color:'#94a3b8', fontWeight:700 }}>{label}: </span>{val}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Recursos */}
          {(momentoActual.recursos?.humanos || momentoActual.recursos?.didacticos || momentoActual.recursos?.tecnologicos) && (
            <div style={{
              background:'#fff', borderRadius:10, padding:'10px 14px',
              marginBottom:10, border:`1px solid ${c.borde}44`,
            }}>
              <div style={{ fontSize:10.5, fontWeight:800, color:c.texto, textTransform:'uppercase', letterSpacing:'.3px', marginBottom:6 }}>
                🎒 Recursos
              </div>
              {[
                ['Humanos', momentoActual.recursos.humanos],
                ['Didácticos', momentoActual.recursos.didacticos],
                ['Tecnológicos', momentoActual.recursos.tecnologicos],
              ].filter(([,v]) => v).map(([label, val]) => (
                <div key={label} style={{ fontSize:12.5, color:'#374151', marginBottom:3 }}>
                  <span style={{ color:'#94a3b8', fontWeight:700 }}>{label}: </span>{val}
                </div>
              ))}
            </div>
          )}

          {/* ── Metacognición */}
          {momentoActual.metacognicion?.length > 0 && (
            <div style={{
              background:'rgba(255,255,255,.7)', borderRadius:10, padding:'10px 14px',
              border:`1px solid ${c.borde}44`,
            }}>
              <div style={{ fontSize:10.5, fontWeight:800, color:c.texto, textTransform:'uppercase', letterSpacing:'.3px', marginBottom:6 }}>
                🪞 Metacognición
              </div>
              {momentoActual.metacognicion.map((q, i) => (
                <div key={i} style={{ fontSize:13, color:'#475569', marginBottom:4, fontStyle:'italic' }}>
                  "{q}"
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Criterios de éxito (si los hay) */}
        {diaSeleccionado?.criteriosExito?.length > 0 && (
          <div style={{
            background:'#fff', border:'1px solid #e2e8f0', borderRadius:12,
            padding:'12px 16px', marginBottom:14,
          }}>
            <div style={{ fontSize:10.5, fontWeight:800, color:'#8a96ab', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:8 }}>
              ✅ Criterios de éxito del día
            </div>
            {diaSeleccionado.criteriosExito.map((c2, i) => (
              <div key={i} style={{ fontSize:12.5, color:'#475569', marginBottom:4, display:'flex', gap:8 }}>
                <span style={{ color:'#7c3aed', fontWeight:700 }}>•</span> {c2}
              </div>
            ))}
          </div>
        )}

        {/* Botones acción — sticky */}
        <div style={{
          position:'sticky', bottom:16,
          display:'flex', gap:10, flexWrap:'wrap',
          background:'rgba(255,255,255,.96)', backdropFilter:'blur(8px)',
          border:'1px solid #e2e8f0', borderRadius:14, padding:'12px 16px',
          boxShadow:'0 8px 24px rgba(0,0,0,.1)',
        }}>
          <button
            onClick={() => { setTimerOn(false); persistirProgreso(); setFase('seleccion') }}
            style={{
              background:'transparent', border:'1px solid #e2e8f0', color:'#64748b',
              borderRadius:9, padding:'9px 14px', fontSize:13, cursor:'pointer',
            }}
          >← Volver</button>
          <div style={{ flex:1 }} />
          <button
            onClick={siguienteMomento}
            style={{
              background: esUltimo
                ? 'linear-gradient(135deg,#16a34a,#15803d)'
                : `linear-gradient(135deg,${c.badge},${c.badge}dd)`,
              color:'#fff', border:0, borderRadius:9, padding:'9px 20px',
              fontSize:14, fontWeight:800, cursor:'pointer',
              boxShadow:`0 6px 16px ${c.badge}44`,
            }}
          >
            {esUltimo ? '✅ Finalizar clase' : `Pasar a ${momentos[momentoIdx + 1]?.nombre || ''} →`}
          </button>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ── FASE: CIERRE
  // ─────────────────────────────────────────────────────────────────────────────
  const pendientes = momentos.flatMap(mom => {
    const checks = actChecks[mom.nombre] || new Set()
    return mom.actividades
      .filter((_, i) => !checks.has(i))
      .map(a => ({ momento: mom.nombre, actividad: a }))
  })

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 8px 60px' }}>

      {/* Header cierre */}
      <div style={{
        background:'linear-gradient(135deg,#15803d,#166534)',
        borderRadius:16, padding:'24px', marginBottom:20,
        boxShadow:'0 12px 32px rgba(21,128,61,.3)',
      }}>
        <div style={{ fontSize:32, marginBottom:8 }}>🏁</div>
        <h2 style={{ fontSize:22, fontWeight:900, color:'#fff', marginBottom:4 }}>¡Clase finalizada!</h2>
        <p style={{ fontSize:14, color:'#bbf7d0', margin:0 }}>
          {diaSeleccionado?.titulo}
          {diaSeleccionado?.semana ? ` · Semana ${diaSeleccionado.semana} · Día ${diaSeleccionado.diaNum}` : ''}
        </p>
      </div>

      {/* Resumen por momento */}
      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        {momentos.map(mom => {
          const checks = actChecks[mom.nombre] || new Set()
          const hechas = mom.actividades.filter((_, i) => checks.has(i)).length
          const c2 = colores(mom.nombre)
          return (
            <div key={mom.nombre} style={{
              flex:'1 1 160px', background:'#fff',
              border:`1px solid ${c2.borde}`, borderRadius:12, padding:'12px 14px',
            }}>
              <div style={{ fontSize:18, marginBottom:4 }}>{c2.icon}</div>
              <div style={{ fontSize:13, fontWeight:800, color:c2.texto, marginBottom:4 }}>{mom.nombre}</div>
              <div style={{ fontSize:22, fontWeight:900, color:'#0f172a' }}>
                {hechas}<span style={{ fontSize:13, color:'#94a3b8', fontWeight:400 }}>/{mom.actividades.length}</span>
              </div>
              <div style={{ fontSize:11.5, color:'#64748b' }}>actividades realizadas</div>
            </div>
          )
        })}
      </div>

      {/* Pendientes */}
      {pendientes.length > 0 && (
        <div style={{
          background:'#fffbeb', border:'1px solid #fde68a', borderRadius:12,
          padding:'14px 16px', marginBottom:20,
        }}>
          <div style={{ fontSize:12, fontWeight:800, color:'#92400e', textTransform:'uppercase', letterSpacing:'.3px', marginBottom:10 }}>
            ⏭ {pendientes.length} actividad(es) pendiente(s) — sugerencia para la próxima clase
          </div>
          {pendientes.slice(0, 6).map((p, i) => (
            <div key={i} style={{ display:'flex', gap:8, marginBottom:5, alignItems:'flex-start' }}>
              <span style={{
                fontSize:10, fontWeight:700, color:'#d97706', background:'#fef3c7',
                borderRadius:4, padding:'1px 5px', flexShrink:0, marginTop:2,
              }}>{p.momento.slice(0,3).toUpperCase()}</span>
              <span style={{ fontSize:13, color:'#78350f', lineHeight:1.5 }}>{p.actividad}</span>
            </div>
          ))}
        </div>
      )}

      {/* Observaciones */}
      <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:'16px', marginBottom:20 }}>
        <label style={{
          fontSize:12, fontWeight:800, color:'#475569', textTransform:'uppercase',
          letterSpacing:'.3px', display:'block', marginBottom:8,
        }}>📝 Observaciones del docente</label>
        <textarea
          value={notas}
          onChange={e => setNotas(e.target.value)}
          rows={4}
          placeholder="¿Qué funcionó bien? ¿Qué ajustarías? ¿Algún estudiante que necesite atención especial?"
          style={{
            width:'100%', border:'1px solid #e2e8f0', borderRadius:9,
            padding:'10px 12px', fontSize:13.5, color:'#374151', resize:'vertical',
            outline:'none', boxSizing:'border-box', fontFamily:'inherit', lineHeight:1.6,
          }}
        />
      </div>

      {!guardadoOk ? (
        <div style={{ display:'flex', gap:10 }}>
          <button
            onClick={() => setFase('clase')}
            style={{
              flex:1, background:'#f8fafc', border:'1px solid #e2e8f0',
              color:'#64748b', borderRadius:10, padding:'12px',
              fontSize:14, cursor:'pointer',
            }}
          >← Continuar clase</button>
          <button
            onClick={finalizarClase}
            disabled={guardando}
            style={{
              flex:2,
              background: guardando ? '#86efac' : 'linear-gradient(135deg,#16a34a,#15803d)',
              color:'#fff', border:0, borderRadius:10, padding:'12px',
              fontSize:14, fontWeight:800, cursor: guardando ? 'default' : 'pointer',
              boxShadow: guardando ? 'none' : '0 6px 16px rgba(21,128,61,.35)',
            }}
          >{guardando ? '⏳ Guardando…' : '✅ Guardar y cerrar clase'}</button>
        </div>
      ) : (
        <div style={{
          textAlign:'center', padding:'28px 20px',
          background:'#f0fdf4', border:'1px solid #86efac', borderRadius:14,
        }}>
          <div style={{ fontSize:40, marginBottom:10 }}>🎉</div>
          <div style={{ fontSize:17, fontWeight:800, color:'#15803d', marginBottom:6 }}>Clase registrada</div>
          <div style={{ fontSize:13.5, color:'#16a34a', marginBottom:20 }}>El resumen quedó guardado correctamente.</div>
          <button
            onClick={() => { setFase('seleccion'); setPlanSeleccionado(null); setDiaSeleccionado(null); setGuardadoOk(false) }}
            style={{
              background:'#7c3aed', color:'#fff', border:0, borderRadius:10,
              padding:'10px 22px', fontSize:14, fontWeight:700, cursor:'pointer',
            }}
          >Volver al inicio</button>
        </div>
      )}
    </div>
  )
}
