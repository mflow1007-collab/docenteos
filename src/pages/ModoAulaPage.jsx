/**
 * ModoAulaPage — Escritorio de trabajo del docente durante la clase.
 *
 * Carga automáticamente la planificación activa del día y presenta
 * un workspace de 3 columnas con el plan interactivo, instrumentos,
 * recursos, banco de evidencias y Coach IA contextual.
 *
 * Soporta Plan Diario y Plan Unidad sin modificar ningún servicio existente.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { obtenerPlanificacionesDetalladas, guardarSesionAula } from '../firebase.js'
import { useAuth } from '../context/AuthContext.jsx'

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN 1 — ADAPTADORES Y UTILIDADES DE DATOS
// ═══════════════════════════════════════════════════════════════════════════════

function toStrArr(v) {
  if (!v) return []
  if (Array.isArray(v)) {
    return v.flatMap(x => String(x).split('\n').map(s => s.replace(/^[-•*\d.]\s*/, '').trim()).filter(Boolean))
  }
  return String(v).split('\n').map(s => s.replace(/^[-•*\d.]\s*/, '').trim()).filter(Boolean)
}

function parseMinutos(texto = '0') {
  return parseInt(String(texto).replace(/[^0-9]/g, ''), 10) || 0
}

function normalizarMomento(mom) {
  return {
    nombre:      mom.nombre || '',
    tiempo:      mom.tiempo || '30 min',
    minutos:     parseMinutos(mom.tiempo || '30 min'),
    actividades: toStrArr(mom.actividades),
    evidencias:  toStrArr(mom.evidencias || mom.evaluacion?.evidencias),
    evaluacion: {
      tipo:        mom.evaluacion?.tipo || '',
      agente:      mom.evaluacion?.agente || '',
      tecnica:     mom.evaluacion?.tecnica || '',
      instrumento: mom.evaluacion?.instrumento || '',
    },
    recursos: {
      humanos:      mom.recursos?.humanos || '',
      didacticos:   mom.recursos?.didacticos || '',
      tecnologicos: mom.recursos?.tecnologicos || '',
    },
    metacognicion: toStrArr(mom.metacognicion),
  }
}

function normMomentoDiario(key, dc) {
  const m = dc[key] || {}
  const nombres = { inicio: 'Inicio', desarrollo: 'Desarrollo', cierre: 'Cierre' }
  const tiemposDefault = { inicio: '10 min', desarrollo: '30 min', cierre: '10 min' }
  return normalizarMomento({ ...m, nombre: nombres[key], tiempo: m.tiempo || tiemposDefault[key] })
}

function normalizarClase(contenido) {
  if (!contenido) return null
  const meta = contenido.metadatos || {}
  const grado  = [meta.grado, meta.seccion].filter(Boolean).join(' ')
  const area   = meta.area || meta.asignatura || ''

  if (Array.isArray(contenido.fases) && contenido.fases.length > 0) {
    const dias = []
    contenido.fases.forEach(fase => {
      ;(fase.dias || []).forEach(dia => {
        dias.push({
          semana:             dia.semana || null,
          diaNum:             dia.numeroGlobal || dias.length + 1,
          diaCalendario:      dia.diaCalendario || null,
          titulo:             dia.titulo || `Clase ${dias.length + 1}`,
          intencionPedagogica: dia.intencionPedagogica || '',
          criteriosExito:     toStrArr(dia.criteriosExito),
          momentos:           (dia.momentos || []).map(normalizarMomento),
        })
      })
    })
    return {
      tipo: 'unidad',
      tituloUnidad: meta.titulo || meta.tema || '',
      grado, area, dias,
      instrumentosRaw: contenido.instrumentosEvaluacion || {},
      resumenEval:     contenido.resumenEvaluacion || {},
    }
  }

  const dc = contenido.desarrolloClase || {}
  const ip = contenido.intencionPedagogica || {}
  return {
    tipo: 'diario',
    tituloUnidad: meta.tema || '',
    grado, area,
    dias: [{
      semana: null,
      diaNum: 1,
      diaCalendario: meta.fecha || null,
      titulo: meta.tema || 'Clase',
      intencionPedagogica: ip.intencionDelDia || '',
      criteriosExito: [],
      momentos: ['inicio', 'desarrollo', 'cierre'].map(k => normMomentoDiario(k, dc)),
    }],
    instrumentosRaw: contenido.instrumentosEvaluacion || {},
    resumenEval:     contenido.resumenEvaluacion || {},
  }
}

function extraerInstrumentos(dia) {
  if (!dia) return []
  const seen = new Map()
  ;(dia.momentos || []).forEach(mom => {
    const ev = mom.evaluacion
    if (ev?.instrumento && !seen.has(ev.instrumento)) {
      seen.set(ev.instrumento, {
        nombre: ev.instrumento,
        tipo:   ev.tecnica || 'Evaluación',
        agente: ev.agente || 'Docente',
        momento: mom.nombre,
      })
    }
  })
  const arr = [...seen.values()]
  const pts = arr.length === 0 ? [] : arr.length === 1 ? [100]
    : arr.length === 2 ? [60, 40] : arr.length === 3 ? [50, 30, 20]
    : arr.map(() => Math.floor(100 / arr.length))
  return arr.map((inst, i) => ({ ...inst, puntos: pts[i] || 0 }))
}

function extraerRecursos(dia) {
  if (!dia) return []
  const seen = new Set()
  const resultado = []
  ;(dia.momentos || []).forEach(mom => {
    const r = mom.recursos || {}
    ;[
      { tipo: '👥 Humanos',      val: r.humanos },
      { tipo: '📦 Didácticos',   val: r.didacticos },
      { tipo: '💻 Tecnológicos', val: r.tecnologicos },
    ].forEach(({ tipo, val }) => {
      if (!val) return
      String(val).split(/[,;]/).map(s => s.trim()).filter(Boolean).forEach(item => {
        if (!seen.has(item.toLowerCase())) {
          seen.add(item.toLowerCase())
          resultado.push({ tipo, item })
        }
      })
    })
  })
  return resultado
}

function detectarPlanHoy(planes) {
  if (!planes.length) return null
  const hoy = new Date()
  const hoyStr = hoy.toISOString().slice(0, 10)
  const diasSemana = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
  const diaSemanaHoy = diasSemana[hoy.getDay()]

  for (const plan of planes) {
    const meta = plan.contenido?.metadatos || {}
    if (meta.fecha && String(meta.fecha).includes(hoyStr)) {
      const norm = normalizarClase(plan.contenido)
      return { plan, dia: norm?.dias[0] || null, norm }
    }
  }
  for (const plan of planes) {
    const fases = plan.contenido?.fases || []
    for (const fase of fases) {
      const dia = (fase.dias || []).find(d => d.diaCalendario === diaSemanaHoy)
      if (dia) {
        const norm = normalizarClase(plan.contenido)
        const diaFound = norm?.dias.find(d => d.diaNum === (dia.numeroGlobal || dia.numero)) || norm?.dias[0]
        return { plan, dia: diaFound, norm }
      }
    }
  }
  const plan = planes[0]
  const norm = normalizarClase(plan.contenido)
  return { plan, dia: norm?.dias[0] || null, norm }
}

function cargarPlanesLocales() {
  try { return JSON.parse(localStorage.getItem('docenteos_planificaciones_guardadas') || '[]') || [] }
  catch { return [] }
}

function leerProgresoLocal(planId, diaNum) {
  try { return JSON.parse(localStorage.getItem(`docenteos_modo_aula_${planId}_${diaNum}`) || 'null') }
  catch { return null }
}

function guardarProgresoLocal(planId, diaNum, data) {
  try { localStorage.setItem(`docenteos_modo_aula_${planId}_${diaNum}`, JSON.stringify({ ...data, ts: Date.now() })) }
  catch {}
}

function leerEvidenciasLocal(planId, diaNum) {
  try { return JSON.parse(localStorage.getItem(`docenteos_evidencias_${planId}_${diaNum}`) || '[]') }
  catch { return [] }
}

function guardarEvidenciasLocal(planId, diaNum, arr) {
  try { localStorage.setItem(`docenteos_evidencias_${planId}_${diaNum}`, JSON.stringify(arr)) }
  catch {}
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN 2 — CONSTANTES DE DISEÑO
// ═══════════════════════════════════════════════════════════════════════════════

const C_MOM = {
  Inicio:     { bg:'#eff6ff', borde:'#3b82f6', txt:'#1d4ed8', badge:'#3b82f6', icon:'🚀', light:'#dbeafe' },
  Desarrollo: { bg:'#f5f3ff', borde:'#7c3aed', txt:'#5b21b6', badge:'#7c3aed', icon:'📚', light:'#ede9fe' },
  Cierre:     { bg:'#f0fdf4', borde:'#16a34a', txt:'#15803d', badge:'#16a34a', icon:'✅', light:'#dcfce7' },
}
const C_DEF = { bg:'#f8fafc', borde:'#94a3b8', txt:'#475569', badge:'#64748b', icon:'📌', light:'#f1f5f9' }
const cm = n => C_MOM[n] || C_DEF

const COACH_ACCIONES = [
  { id:'metacog',  label:'🪞 Metacognición' },
  { id:'neae',     label:'♿ Adaptar NEAE'  },
  { id:'rapida',   label:'⚡ Act. rápida'   },
  { id:'oral',     label:'🎙 Eval. oral'    },
  { id:'refuerzo', label:'🔁 Refuerzo'      },
  { id:'pausa',    label:'☕ Pausa activa'  },
]

function genCoach(id, tema = 'el tema') {
  const t = tema.toLowerCase()
  const map = {
    metacog:  `"¿Qué aprendiste hoy sobre ${t}? ¿En qué situación de tu vida podrías aplicarlo? Compártelo con un compañero."`,
    neae:     `Para estudiantes con NEAE: simplifica la instrucción de ${t} a un solo paso, ofrece apoyo visual y permite respuesta oral en lugar de escrita.`,
    rapida:   `Actividad rápida (3-5 min): Cada estudiante escribe 3 palabras relacionadas con ${t}. Se socializan en voz alta. Sin evaluación formal.`,
    oral:     `Evaluación oral (5 min): Selecciona 4 estudiantes al azar y pídeles que expliquen un aspecto de ${t} con sus propias palabras. Usa la rúbrica de participación.`,
    refuerzo: `Refuerzo: Antes de continuar, resume los 3 conceptos clave de ${t} usando el esquema "Primero… luego… finalmente…". Pregunta quién necesita más práctica.`,
    pausa:    `Pausa activa (2 min): Todos de pie. 3 respiraciones profundas. Luego cada uno comparte: "Una cosa que entendí es…" con el compañero más cercano.`,
  }
  return map[id] || null
}

function formatTime(s) {
  return `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN 3 — SUBCOMPONENTES
// ═══════════════════════════════════════════════════════════════════════════════

function Pill({ children, color = '#7c3aed', bg = '#f5f3ff', icon }) {
  return (
    <div style={{
      display:'inline-flex', alignItems:'center', gap:5,
      background:bg, borderRadius:20, padding:'4px 12px',
      fontSize:12, fontWeight:700, color, lineHeight:1.3, flexShrink:0,
    }}>
      {icon && <span style={{ fontSize:14 }}>{icon}</span>}
      {children}
    </div>
  )
}

function InstrCard({ inst, onAplicar }) {
  const colores = {
    'Rúbrica':           { bg:'#faf5ff', borde:'#a78bfa', txt:'#6d28d9' },
    'Lista de cotejo':   { bg:'#eff6ff', borde:'#60a5fa', txt:'#1d4ed8' },
    'Escala estimativa': { bg:'#fef9c3', borde:'#fbbf24', txt:'#92400e' },
    'Portafolio':        { bg:'#f0fdf4', borde:'#4ade80', txt:'#15803d' },
    'Observación':       { bg:'#fff7ed', borde:'#fb923c', txt:'#c2410c' },
  }
  const c = colores[inst.tipo] || colores[inst.nombre] || { bg:'#f8fafc', borde:'#cbd5e1', txt:'#475569' }
  return (
    <div style={{
      background:c.bg, border:`1.5px solid ${c.borde}`, borderRadius:12, padding:'12px 14px', marginBottom:8,
    }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:800, fontSize:13.5, color:c.txt, lineHeight:1.3, marginBottom:3 }}>
            {inst.nombre}
          </div>
          <div style={{ fontSize:11.5, color:'#6b7280' }}>
            {inst.tipo} · {inst.agente} · {inst.momento}
          </div>
        </div>
        <div style={{
          flexShrink:0, width:44, height:44, borderRadius:10,
          background:c.borde, color:'#fff',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:14, fontWeight:900,
        }}>{inst.puntos}pt</div>
      </div>
      <div style={{ display:'flex', gap:6, marginTop:10 }}>
        <button onClick={onAplicar} style={{
          flex:1, background:c.borde, color:'#fff', border:0, borderRadius:7,
          padding:'6px 0', fontSize:12, fontWeight:700, cursor:'pointer',
        }}>Aplicar</button>
        <button style={{
          background:'#fff', color:c.txt, border:`1px solid ${c.borde}`, borderRadius:7,
          padding:'6px 12px', fontSize:12, fontWeight:700, cursor:'pointer',
        }}>Ver</button>
      </div>
    </div>
  )
}

function RecursoItem({ tipo, item }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:8,
      padding:'7px 10px', background:'#f8fafc', borderRadius:8,
      border:'1px solid #e2e8f0', marginBottom:5,
    }}>
      <span style={{ fontSize:15, flexShrink:0 }}>{tipo.slice(0,2)}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:10.5, color:'#94a3b8', fontWeight:700 }}>{tipo.replace(/^..\s/, '')}</div>
        <div style={{ fontSize:12.5, color:'#374151', fontWeight:600, lineHeight:1.2 }}>{item}</div>
      </div>
    </div>
  )
}

function TimerCircle({ segundos, total, on, onToggle, onReset, nombre }) {
  const pct = total > 0 ? Math.min(segundos / total, 1) : 0
  const sob = total > 0 && segundos > total
  const R = 28, cir = 2 * Math.PI * R
  const dash = cir * (1 - pct)
  const c = cm(nombre)
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
      <svg width={72} height={72} style={{ flexShrink:0 }}>
        <circle cx={36} cy={36} r={R} fill="none" stroke="#e2e8f0" strokeWidth={5} />
        <circle cx={36} cy={36} r={R} fill="none"
          stroke={sob ? '#ef4444' : c.badge}
          strokeWidth={5} strokeDasharray={cir} strokeDashoffset={dash}
          strokeLinecap="round" transform="rotate(-90 36 36)"
          style={{ transition:'stroke-dashoffset .5s linear' }}
        />
        <text x={36} y={41} textAnchor="middle"
          style={{ fontSize:12, fontWeight:800, fill: sob ? '#ef4444' : '#374151', fontFamily:'inherit' }}>
          {formatTime(segundos)}
        </text>
      </svg>
      <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
        <button onClick={onToggle} style={{
          background: on ? '#fef2f2' : '#f0fdf4',
          border:`1px solid ${on ? '#fca5a5' : '#86efac'}`,
          color: on ? '#dc2626' : '#16a34a',
          borderRadius:7, padding:'5px 10px', fontSize:12, fontWeight:700, cursor:'pointer',
        }}>{on ? '⏸ Pausar' : '▶ Iniciar'}</button>
        <button onClick={onReset} style={{
          background:'#f8fafc', border:'1px solid #e2e8f0', color:'#64748b',
          borderRadius:7, padding:'5px 10px', fontSize:12, cursor:'pointer',
        }}>↺ Reiniciar</button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN 4 — COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export default function ModoAulaPage({ cursos = [], onIrA }) {
  const { formulario } = useAuth()

  // ── Estado global
  const [cargando,   setCargando]   = useState(true)
  const [planes,     setPlanes]     = useState(() => cargarPlanesLocales())
  const [planActivo, setPlanActivo] = useState(null)
  const [diaActivo,  setDiaActivo]  = useState(null)
  const [claseNorm,  setClaseNorm]  = useState(null)
  const [mostrarSelector, setMostrarSelector] = useState(false)

  // ── Estado de clase
  const [estadoClase, setEstadoClase] = useState('pendiente') // pendiente | iniciada | finalizada
  const [momentoOpen, setMomentoOpen] = useState(0)
  const [actChecks,   setActChecks]   = useState({})

  // ── Timer por momento
  const [timerSeg,  setTimerSeg]  = useState(0)
  const [timerOn,   setTimerOn]   = useState(false)
  const [totalSeg,  setTotalSeg]  = useState(0)
  const timerRef = useRef(null)

  // ── Banco de evidencias
  const [evidencias,     setEvidencias]     = useState([])
  const [inputEvidencia, setInputEvidencia] = useState('')
  const [categoriaEv,    setCategoriaEv]    = useState('Observación')
  const [agregandoEv,    setAgregandoEv]    = useState(false)

  // ── Coach IA
  const [coachSug, setCoachSug] = useState(null)
  const [coachAct, setCoachAct] = useState(null)

  // ── Cierre
  const [notasDocente, setNotasDocente] = useState('')
  const [guardandoFin, setGuardandoFin] = useState(false)
  const [finOk,        setFinOk]        = useState(false)

  // ─── Cargar desde Firestore (actualiza sobre localStorage)
  useEffect(() => {
    obtenerPlanificacionesDetalladas()
      .then(res => { if (res.success && Array.isArray(res.data) && res.data.length > 0) setPlanes(res.data) })
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [])

  // ─── Auto-detección del plan del día
  useEffect(() => {
    if (!planes.length) { setCargando(false); return }
    const det = detectarPlanHoy(planes)
    if (!det) return
    setPlanActivo(det.plan)
    setClaseNorm(det.norm)
    setDiaActivo(det.dia)

    if (det.plan?.id && det.dia?.diaNum != null) {
      const prev = leerProgresoLocal(det.plan.id, det.dia.diaNum)
      if (prev) {
        setActChecks(Object.fromEntries(Object.entries(prev.actChecks || {}).map(([k,v]) => [k, new Set(v)])))
        setEstadoClase(prev.estadoClase || 'pendiente')
        setMomentoOpen(prev.momentoOpen || 0)
        setNotasDocente(prev.notas || '')
      }
      setEvidencias(leerEvidenciasLocal(det.plan.id, det.dia.diaNum))
    }
  }, [planes])

  // ─── Timer interval
  useEffect(() => {
    if (timerOn) {
      timerRef.current = setInterval(() => setTimerSeg(s => s + 1), 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [timerOn])

  // ─── Resetear timer cuando cambia el momento
  useEffect(() => {
    const mom = diaActivo?.momentos?.[momentoOpen]
    if (mom) {
      setTotalSeg(parseMinutos(mom.tiempo || '30 min') * 60)
      setTimerSeg(0)
      setTimerOn(false)
    }
  }, [momentoOpen, diaActivo])

  // ─── Guardar progreso
  const persistir = useCallback((extra = {}) => {
    if (!planActivo?.id || diaActivo?.diaNum == null) return
    const serialChecks = Object.fromEntries(Object.entries(actChecks).map(([k,v]) => [k,[...v]]))
    guardarProgresoLocal(planActivo.id, diaActivo.diaNum, {
      actChecks: serialChecks,
      estadoClase,
      momentoOpen,
      notas: notasDocente,
      ...extra,
    })
  }, [planActivo, diaActivo, actChecks, estadoClase, momentoOpen, notasDocente])

  // ─── Seleccionar plan/día desde modal
  const seleccionar = (plan, dia) => {
    const norm = normalizarClase(plan.contenido)
    setPlanActivo(plan)
    setClaseNorm(norm)
    const diaOk = norm?.dias.find(d => d.diaNum === dia.diaNum) || norm?.dias[0]
    setDiaActivo(diaOk)
    const prev = leerProgresoLocal(plan.id, diaOk?.diaNum)
    if (prev) {
      setActChecks(Object.fromEntries(Object.entries(prev.actChecks || {}).map(([k,v]) => [k, new Set(v)])))
      setEstadoClase(prev.estadoClase || 'pendiente')
      setMomentoOpen(prev.momentoOpen || 0)
      setNotasDocente(prev.notas || '')
    } else {
      setActChecks({}); setEstadoClase('pendiente'); setMomentoOpen(0); setNotasDocente('')
    }
    setEvidencias(leerEvidenciasLocal(plan.id, diaOk?.diaNum || 1))
    setMostrarSelector(false)
  }

  // ─── Toggle actividad
  const toggleAct = (momentoNombre, idx) => {
    setActChecks(prev => {
      const s = new Set(prev[momentoNombre] || [])
      if (s.has(idx)) s.delete(idx); else s.add(idx)
      const next = { ...prev, [momentoNombre]: s }
      setTimeout(() => persistir({ actChecks: Object.fromEntries(Object.entries(next).map(([k,v]) => [k,[...v]])) }), 0)
      return next
    })
  }

  // ─── Agregar evidencia
  const agregarEvidencia = () => {
    if (!inputEvidencia.trim() || !planActivo || diaActivo?.diaNum == null) return
    const ev = {
      id: Date.now(),
      texto: inputEvidencia.trim(),
      categoria: categoriaEv,
      hora: new Date().toLocaleTimeString('es-DO', { hour:'2-digit', minute:'2-digit' }),
      momento: diaActivo.momentos?.[momentoOpen]?.nombre || '',
    }
    const arr = [ev, ...evidencias]
    setEvidencias(arr)
    guardarEvidenciasLocal(planActivo.id, diaActivo.diaNum, arr)
    setInputEvidencia('')
    setAgregandoEv(false)
  }

  // ─── Iniciar clase
  const iniciarClase = () => {
    setEstadoClase('iniciada')
    setTimerOn(true)
    persistir({ estadoClase: 'iniciada' })
  }

  // ─── Finalizar clase
  const finalizarClase = async () => {
    setGuardandoFin(true)
    const resumen = {}
    ;(diaActivo?.momentos || []).forEach(mom => {
      const checks = actChecks[mom.nombre] || new Set()
      resumen[mom.nombre] = {
        completadas: mom.actividades.filter((_, i) => checks.has(i)),
        pendientes:  mom.actividades.filter((_, i) => !checks.has(i)),
      }
    })
    await guardarSesionAula({
      planId: planActivo?.id, planTema: diaActivo?.titulo,
      planArea: claseNorm?.area, planGrado: claseNorm?.grado,
      diaNum: diaActivo?.diaNum, semana: diaActivo?.semana,
      observaciones: notasDocente,
      resumenActividades: resumen,
      evidencias: evidencias.map(e => ({ texto: e.texto, categoria: e.categoria, hora: e.hora })),
      estadoClase: 'finalizada',
    }).catch(() => {})
    persistir({ estadoClase: 'finalizada' })
    setEstadoClase('finalizada')
    setTimerOn(false)
    setGuardandoFin(false)
    setFinOk(true)
  }

  // ═══ DATOS DERIVADOS
  const instrumentos = useMemo(() => extraerInstrumentos(diaActivo), [diaActivo])
  const recursos     = useMemo(() => extraerRecursos(diaActivo), [diaActivo])
  const momentos     = diaActivo?.momentos || []
  const totalActs    = momentos.reduce((s, m) => s + (m.actividades?.length || 0), 0)
  const hechas       = Object.values(actChecks).reduce((s, set) => s + set.size, 0)
  const pctClase     = totalActs > 0 ? Math.round(hechas / totalActs * 100) : 0
  const momActual    = momentos[momentoOpen] || {}
  const checksActual = actChecks[momActual.nombre] || new Set()
  const primerNombre = (formulario?.nombreDocente || '').split(' ')[0] || 'Docente'

  const estadoBadge = {
    pendiente:  { bg:'rgba(148,163,184,.15)', txt:'#94a3b8', dot:'#64748b', label:'Pendiente' },
    iniciada:   { bg:'rgba(134,239,172,.15)', txt:'#86efac', dot:'#4ade80', label:'En curso'  },
    finalizada: { bg:'rgba(96,165,250,.15)',  txt:'#93c5fd', dot:'#60a5fa', label:'Finalizada' },
  }[estadoClase] || { bg:'rgba(148,163,184,.15)', txt:'#94a3b8', dot:'#64748b', label:'—' }

  // ══════════════════════════════════════════════════════════════════════════
  // PANTALLA: SIN DATOS
  // ══════════════════════════════════════════════════════════════════════════
  if (!cargando && !planes.length) {
    return (
      <div style={{ maxWidth:480, margin:'60px auto', textAlign:'center', padding:'0 20px' }}>
        <div style={{ fontSize:56, marginBottom:16 }}>📝</div>
        <h2 style={{ fontSize:22, fontWeight:800, color:'#0f172a', marginBottom:8 }}>Sin planificaciones guardadas</h2>
        <p style={{ fontSize:14, color:'#64748b', marginBottom:24, lineHeight:1.6 }}>
          Genera tu primera planificación y aparecerá aquí automáticamente cada vez que entres al Modo Aula.
        </p>
        <button onClick={() => onIrA?.('planificacion')} style={{
          background:'linear-gradient(135deg,#7c3aed,#6d28d9)', color:'#fff',
          border:0, borderRadius:12, padding:'14px 28px', fontSize:15, fontWeight:800,
          cursor:'pointer', boxShadow:'0 8px 24px rgba(124,58,237,.4)',
        }}>Crear mi primera planificación ↗</button>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MODAL SELECTOR
  // ══════════════════════════════════════════════════════════════════════════
  const SelectorModal = mostrarSelector && (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:200,
      display:'flex', alignItems:'center', justifyContent:'center', padding:16,
    }} onClick={() => setMostrarSelector(false)}>
      <div style={{
        background:'#fff', borderRadius:18, padding:24, width:'100%', maxWidth:540,
        maxHeight:'80vh', overflow:'auto', boxShadow:'0 24px 64px rgba(0,0,0,.25)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
          <h3 style={{ fontSize:17, fontWeight:800, color:'#0f172a', margin:0 }}>Cambiar planificación</h3>
          <button onClick={() => setMostrarSelector(false)} style={{ background:'none', border:0, fontSize:22, cursor:'pointer', color:'#94a3b8', lineHeight:1 }}>×</button>
        </div>
        {planes.map(plan => {
          const norm2 = (() => { try { return normalizarClase(plan.contenido) } catch { return null } })()
          const meta  = plan.contenido?.metadatos || {}
          const titulo = meta.titulo || meta.tema || 'Sin título'
          const grado  = [meta.grado, meta.seccion].filter(Boolean).join(' ')
          const area   = meta.area || ''
          return (
            <div key={plan.id} style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#7c3aed', marginBottom:4, textTransform:'uppercase' }}>
                {area}{grado ? ` · ${grado}` : ''}
              </div>
              <div style={{ fontWeight:700, fontSize:14, color:'#0f172a', marginBottom:6 }}>{titulo}</div>
              {(norm2?.dias || []).map(dia => {
                const activo2 = planActivo?.id === plan.id && diaActivo?.diaNum === dia.diaNum
                return (
                  <button key={dia.diaNum} onClick={() => seleccionar(plan, dia)} style={{
                    display:'block', width:'100%', textAlign:'left', background: activo2 ? '#f5f3ff' : '#f8fafc',
                    border:`1.5px solid ${activo2 ? '#7c3aed' : '#e2e8f0'}`,
                    borderRadius:9, padding:'9px 12px', marginBottom:5, cursor:'pointer',
                    color: activo2 ? '#7c3aed' : '#374151',
                    fontWeight: activo2 ? 700 : 500, fontSize:13,
                  }}>
                    {dia.semana ? `Sem. ${dia.semana} · ` : ''}Día {dia.diaNum}
                    {dia.diaCalendario ? ` · ${dia.diaCalendario}` : ''} — {dia.titulo}
                  </button>
                )
              })}
              <div style={{ height:1, background:'#f1f5f9', margin:'10px 0 0' }} />
            </div>
          )
        })}
      </div>
    </div>
  )

  // ══════════════════════════════════════════════════════════════════════════
  // WORKSPACE PRINCIPAL
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 0px)', overflow:'hidden' }}>
      {SelectorModal}

      {/* ══ ENCABEZADO OSCURO ══ */}
      <div style={{
        background:'#0f172a', padding:'9px 16px',
        display:'flex', alignItems:'center', gap:8, flexWrap:'wrap',
        boxShadow:'0 2px 16px rgba(0,0,0,.3)', zIndex:50, flexShrink:0,
      }}>
        <span style={{ fontSize:18 }}>🏫</span>

        {claseNorm?.area && (
          <Pill color="#a78bfa" bg="rgba(167,139,250,.12)" icon="📚">{claseNorm.area}</Pill>
        )}
        {claseNorm?.tituloUnidad && (
          <Pill color="#67e8f9" bg="rgba(103,232,249,.08)" icon="🗂️">
            <span style={{ maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block' }}>
              {claseNorm.tituloUnidad}
            </span>
          </Pill>
        )}
        {(diaActivo?.semana || diaActivo?.diaNum) && (
          <Pill color="#86efac" bg="rgba(134,239,172,.1)" icon="📅">
            {diaActivo.semana ? `Sem. ${diaActivo.semana} · ` : ''}Día {diaActivo.diaNum}
          </Pill>
        )}
        {diaActivo?.titulo && (
          <Pill color="#fcd34d" bg="rgba(252,211,77,.1)" icon="📌">
            <span style={{ maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block' }}>
              {diaActivo.titulo}
            </span>
          </Pill>
        )}

        <div style={{ flex:1 }} />

        {/* Estado */}
        <div style={{
          display:'flex', alignItems:'center', gap:5,
          background:estadoBadge.bg, color:estadoBadge.txt,
          borderRadius:20, padding:'4px 12px', fontSize:12, fontWeight:700,
        }}>
          <div style={{ width:7, height:7, borderRadius:'50%', background:estadoBadge.dot }} />
          {estadoBadge.label}
        </div>

        {claseNorm?.grado && (
          <div style={{
            background:'rgba(255,255,255,.1)', color:'#cbd5e1', borderRadius:8,
            padding:'5px 12px', fontSize:12, fontWeight:700,
          }}>{claseNorm.grado}</div>
        )}

        <button onClick={() => setMostrarSelector(true)} style={{
          background:'rgba(255,255,255,.07)', color:'#94a3b8',
          border:'1px solid rgba(255,255,255,.1)', borderRadius:8,
          padding:'5px 10px', fontSize:12, cursor:'pointer',
        }}>⇄ Cambiar</button>
      </div>

      {/* ══ TIMELINE MOMENTOS ══ */}
      <div style={{
        background:'#fff', borderBottom:'1px solid #e2e8f0',
        padding:'8px 16px', display:'flex', alignItems:'center',
        flexShrink:0, overflowX:'auto', gap:0,
      }}>
        {momentos.map((mom, i) => {
          const c = cm(mom.nombre)
          const activo = i === momentoOpen
          const pasado = i < momentoOpen
          const checks = actChecks[mom.nombre] || new Set()
          const pct = mom.actividades.length > 0 ? Math.round(checks.size / mom.actividades.length * 100) : 0
          return (
            <div key={mom.nombre} style={{ display:'flex', alignItems:'center', flexShrink:0 }}>
              <button onClick={() => setMomentoOpen(i)} style={{
                display:'flex', flexDirection:'column', alignItems:'center',
                padding:'6px 14px', borderRadius:10, border:0, cursor:'pointer',
                background: activo ? c.light : 'transparent', transition:'all .15s',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:15 }}>{c.icon}</span>
                  <span style={{
                    fontSize:13, fontWeight: activo ? 800 : 600,
                    color: activo ? c.txt : pasado ? '#94a3b8' : '#475569',
                  }}>{mom.nombre}</span>
                  <span style={{ fontSize:11, color:'#94a3b8' }}>{mom.tiempo}</span>
                </div>
                {mom.actividades.length > 0 && (
                  <div style={{ marginTop:4, width:72, height:3, background:'#e2e8f0', borderRadius:2, overflow:'hidden' }}>
                    <div style={{ width:`${pct}%`, height:'100%', background:c.badge, transition:'width .3s' }} />
                  </div>
                )}
              </button>
              {i < momentos.length - 1 && (
                <div style={{ width:24, height:2, background: pasado ? '#7c3aed' : '#e2e8f0', borderRadius:1, flexShrink:0 }} />
              )}
            </div>
          )
        })}
        <div style={{ width:24, height:2, background:'#e2e8f0', flexShrink:0 }} />
        <div style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', color:'#94a3b8', fontSize:12, fontWeight:600 }}>
          🏁 Finalizar
        </div>
      </div>

      {/* ══ WORKSPACE 3 COLUMNAS ══ */}
      <div style={{
        flex:1, overflow:'hidden',
        display:'grid', gridTemplateColumns:'1fr 290px 270px', gap:0, minHeight:0,
      }}>

        {/* ╔═══════════════════════╗
            ║   PLAN DE CLASE       ║
            ╚═══════════════════════╝ */}
        <div style={{ overflow:'auto', padding:'14px 16px', borderRight:'1px solid #e2e8f0' }}>

          {/* Cabecera */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:28, height:28, borderRadius:7, background:'#f5f3ff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>📋</div>
              <div>
                <div style={{ fontSize:10, fontWeight:800, color:'#7c3aed', textTransform:'uppercase', letterSpacing:'.4px' }}>Plan de clase</div>
                <div style={{ fontSize:13, fontWeight:700, color:'#0f172a' }}>{diaActivo?.titulo || '—'}</div>
              </div>
            </div>
            <button onClick={() => onIrA?.('planificacion')} style={{
              background:'#f5f3ff', border:'1px solid #ede9fe', color:'#7c3aed',
              borderRadius:8, padding:'5px 10px', fontSize:11, fontWeight:700, cursor:'pointer',
            }}>Ver planificación ↗</button>
          </div>

          {/* Intención pedagógica */}
          {diaActivo?.intencionPedagogica && (
            <div style={{
              background:'linear-gradient(135deg,#faf9ff,#f5f3ff)',
              border:'1px solid #ddd6fe', borderRadius:12, padding:'12px 16px', marginBottom:14,
            }}>
              <div style={{ fontSize:10, fontWeight:800, color:'#7c3aed', textTransform:'uppercase', letterSpacing:'.3px', marginBottom:6 }}>
                🎯 Intención pedagógica
              </div>
              <div style={{ fontSize:13.5, color:'#374151', lineHeight:1.7 }}>
                {diaActivo.intencionPedagogica}
              </div>
            </div>
          )}

          {/* Acordeón de momentos */}
          {momentos.map((mom, i) => {
            const abierto = i === momentoOpen
            const c = cm(mom.nombre)
            const checks = actChecks[mom.nombre] || new Set()
            const hechasM = checks.size
            const totalM  = mom.actividades.length
            return (
              <div key={mom.nombre} style={{
                border:`2px solid ${abierto ? c.borde : '#e2e8f0'}`,
                borderRadius:12, marginBottom:10, overflow:'hidden',
                background: abierto ? c.bg : '#fff', transition:'border-color .15s',
              }}>
                <button
                  onClick={() => setMomentoOpen(i)}
                  style={{
                    width:'100%', display:'flex', alignItems:'center', gap:10,
                    padding:'12px 16px', background:'transparent', border:0,
                    cursor:'pointer', textAlign:'left',
                  }}
                >
                  <span style={{
                    width:30, height:30, borderRadius:8, background:c.badge, color:'#fff',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:15, flexShrink:0,
                  }}>{c.icon}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:14, fontWeight:800, color:c.txt }}>{mom.nombre}</span>
                      <span style={{ fontSize:11, color:'#94a3b8', fontWeight:600 }}>{mom.tiempo}</span>
                    </div>
                    {totalM > 0 && (
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:2 }}>
                        <div style={{ flex:1, height:3, background:'rgba(0,0,0,.08)', borderRadius:2, overflow:'hidden' }}>
                          <div style={{ width:`${Math.round(hechasM/totalM*100)}%`, height:'100%', background:c.badge, transition:'width .3s' }} />
                        </div>
                        <span style={{ fontSize:10.5, color:c.txt, fontWeight:700 }}>{hechasM}/{totalM}</span>
                      </div>
                    )}
                  </div>
                  <span style={{ color:'#94a3b8', fontSize:13, transform: abierto ? 'rotate(180deg)' : 'none', transition:'transform .2s' }}>▼</span>
                </button>

                {abierto && (
                  <div style={{ padding:'0 16px 16px' }}>

                    {/* Mini timer inline */}
                    {estadoClase === 'iniciada' && (
                      <div style={{
                        display:'flex', alignItems:'center', justifyContent:'space-between',
                        background:'#fff', border:`1px solid ${c.borde}44`, borderRadius:10,
                        padding:'10px 14px', marginBottom:12,
                      }}>
                        <TimerCircle
                          segundos={timerSeg} total={totalSeg} on={timerOn}
                          onToggle={() => setTimerOn(v => !v)}
                          onReset={() => { clearInterval(timerRef.current); setTimerSeg(0); setTimerOn(false) }}
                          nombre={mom.nombre}
                        />
                        <div style={{ textAlign:'right' }}>
                          <div style={{ fontSize:10.5, color:'#94a3b8' }}>Tiempo planificado</div>
                          <div style={{ fontSize:14, fontWeight:700, color:'#374151' }}>{mom.tiempo}</div>
                        </div>
                      </div>
                    )}

                    {/* Actividades checklist */}
                    {mom.actividades.length > 0 && (
                      <div style={{ marginBottom:12 }}>
                        <div style={{ fontSize:10, fontWeight:800, color:c.txt, textTransform:'uppercase', letterSpacing:'.3px', marginBottom:8 }}>
                          📋 Actividades
                        </div>
                        {mom.actividades.map((act, idx) => {
                          const done = checks.has(idx)
                          return (
                            <button key={idx} onClick={() => toggleAct(mom.nombre, idx)} style={{
                              display:'flex', alignItems:'flex-start', gap:10, width:'100%',
                              textAlign:'left', cursor:'pointer',
                              padding:'8px 10px', marginBottom:4, borderRadius:9,
                              background: done ? '#fff' : 'transparent',
                              border:`1px solid ${done ? c.borde : 'transparent'}`,
                              transition:'all .12s',
                            }}>
                              <span style={{
                                flexShrink:0, width:20, height:20, borderRadius:5,
                                border:`2px solid ${c.badge}`,
                                background: done ? c.badge : 'transparent',
                                display:'flex', alignItems:'center', justifyContent:'center',
                                color:'#fff', fontSize:11, marginTop:1, transition:'all .1s',
                              }}>{done ? '✓' : ''}</span>
                              <span style={{
                                fontSize:13.5, lineHeight:1.55,
                                color: done ? '#9ca3af' : '#374151',
                                textDecoration: done ? 'line-through' : 'none',
                              }}>
                                <strong style={{ color: done ? '#9ca3af' : c.txt }}>{idx + 1}.</strong> {act}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {/* Evidencias */}
                    {mom.evidencias.length > 0 && (
                      <div style={{ background:'#fff', borderRadius:9, padding:'10px 12px', marginBottom:10, border:`1px solid ${c.borde}33` }}>
                        <div style={{ fontSize:10, fontWeight:800, color:c.txt, textTransform:'uppercase', letterSpacing:'.3px', marginBottom:6 }}>🔍 Evidencias</div>
                        {mom.evidencias.map((ev, i) => (
                          <div key={i} style={{ fontSize:13, color:'#475569', marginBottom:3, display:'flex', gap:7 }}>
                            <span style={{ color:c.badge, fontWeight:700 }}>•</span>{ev}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Evaluación */}
                    {(mom.evaluacion.tipo || mom.evaluacion.instrumento) && (
                      <div style={{ background:'#fff', borderRadius:9, padding:'10px 12px', marginBottom:10, border:`1px solid ${c.borde}33` }}>
                        <div style={{ fontSize:10, fontWeight:800, color:c.txt, textTransform:'uppercase', letterSpacing:'.3px', marginBottom:6 }}>📊 Evaluación</div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                          {[['Tipo',mom.evaluacion.tipo],['Técnica',mom.evaluacion.tecnica],['Instrumento',mom.evaluacion.instrumento],['Agente',mom.evaluacion.agente]]
                            .filter(([,v]) => v)
                            .map(([l,v]) => (
                              <span key={l} style={{ fontSize:12, color:'#374151' }}>
                                <span style={{ color:'#94a3b8', fontWeight:700 }}>{l}: </span>{v}
                              </span>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Metacognición */}
                    {mom.metacognicion.length > 0 && (
                      <div style={{ background:'rgba(124,58,237,.05)', borderRadius:9, padding:'10px 12px', border:'1px solid #ede9fe' }}>
                        <div style={{ fontSize:10, fontWeight:800, color:'#7c3aed', textTransform:'uppercase', letterSpacing:'.3px', marginBottom:6 }}>🪞 Metacognición</div>
                        {mom.metacognicion.map((q, i) => (
                          <div key={i} style={{ fontSize:13, color:'#5b21b6', fontStyle:'italic', marginBottom:4 }}>"{q}"</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* CTA */}
          {estadoClase === 'pendiente' && (
            <button onClick={iniciarClase} style={{
              width:'100%', marginTop:8,
              background:'linear-gradient(135deg,#7c3aed,#6d28d9)', color:'#fff',
              border:0, borderRadius:12, padding:'14px',
              fontSize:15, fontWeight:800, cursor:'pointer',
              boxShadow:'0 8px 24px rgba(124,58,237,.4)',
            }}>▶ Iniciar clase</button>
          )}

          {estadoClase === 'iniciada' && (
            <button onClick={finalizarClase} disabled={guardandoFin} style={{
              width:'100%', marginTop:8,
              background: guardandoFin ? '#e2e8f0' : 'linear-gradient(135deg,#16a34a,#15803d)',
              color: guardandoFin ? '#94a3b8' : '#fff', border:0, borderRadius:12, padding:'14px',
              fontSize:15, fontWeight:800, cursor: guardandoFin ? 'default' : 'pointer',
              boxShadow: guardandoFin ? 'none' : '0 8px 24px rgba(21,128,61,.35)',
            }}>
              {guardandoFin ? '⏳ Guardando…' : '🏁 Finalizar y guardar clase'}
            </button>
          )}

          {estadoClase === 'finalizada' && finOk && (
            <div style={{
              background:'#f0fdf4', border:'1px solid #86efac', borderRadius:12,
              padding:'14px', marginTop:8, textAlign:'center',
            }}>
              <div style={{ fontSize:24, marginBottom:6 }}>🎉</div>
              <div style={{ fontWeight:800, color:'#15803d', fontSize:14 }}>Clase registrada exitosamente</div>
              <button onClick={() => { setEstadoClase('pendiente'); setFinOk(false); setActChecks({}); setMomentoOpen(0) }} style={{
                marginTop:10, background:'transparent', border:'1px solid #86efac',
                color:'#15803d', borderRadius:8, padding:'6px 14px', fontSize:12, fontWeight:700, cursor:'pointer',
              }}>Nueva clase</button>
            </div>
          )}

          {/* Observaciones */}
          {estadoClase !== 'pendiente' && (
            <div style={{ marginTop:16 }}>
              <label style={{ fontSize:10, fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'.3px', display:'block', marginBottom:6 }}>
                📝 Observaciones del docente
              </label>
              <textarea value={notasDocente}
                onChange={e => { setNotasDocente(e.target.value); persistir({ notas: e.target.value }) }}
                rows={3} placeholder="Ajustes, estudiantes que requieren atención especial…"
                style={{
                  width:'100%', border:'1px solid #e2e8f0', borderRadius:9,
                  padding:'10px 12px', fontSize:13, color:'#374151', resize:'vertical',
                  outline:'none', boxSizing:'border-box', fontFamily:'inherit', lineHeight:1.6,
                }}
              />
            </div>
          )}
        </div>

        {/* ╔═══════════════════════════╗
            ║  INSTRUMENTOS + COACH IA  ║
            ╚═══════════════════════════╝ */}
        <div style={{ overflow:'auto', padding:'14px', borderRight:'1px solid #e2e8f0', display:'flex', flexDirection:'column', gap:14 }}>

          {/* Instrumentos */}
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                <div style={{ width:28, height:28, borderRadius:7, background:'#fef9c3', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>📊</div>
                <div>
                  <div style={{ fontSize:10, fontWeight:800, color:'#92400e', textTransform:'uppercase', letterSpacing:'.4px' }}>Instrumentos</div>
                  <div style={{ fontSize:11, color:'#64748b' }}>del día</div>
                </div>
              </div>
              <button onClick={() => onIrA?.('instrumentos')} style={{
                background:'transparent', border:0, color:'#7c3aed', fontSize:20, cursor:'pointer', lineHeight:1,
              }}>+</button>
            </div>

            {instrumentos.length === 0 ? (
              <div style={{ textAlign:'center', padding:'20px 0', color:'#94a3b8', fontSize:12 }}>
                <div style={{ fontSize:28, marginBottom:8 }}>📊</div>
                Sin instrumentos definidos
              </div>
            ) : (
              instrumentos.map((inst, i) => (
                <InstrCard key={i} inst={inst} onAplicar={() => onIrA?.('registro')} />
              ))
            )}

            {instrumentos.length > 0 && (
              <div style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                background:'#f0fdf4', border:'1px solid #86efac', borderRadius:10, padding:'10px 14px',
              }}>
                <span style={{ fontSize:13, fontWeight:700, color:'#15803d' }}>Total evaluación</span>
                <span style={{ fontSize:18, fontWeight:900, color:'#15803d' }}>
                  {instrumentos.reduce((s, i) => s + (i.puntos || 0), 0)} pts
                </span>
              </div>
            )}
          </div>

          {/* Timer */}
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:'14px' }}>
            <div style={{ fontSize:10, fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'.3px', marginBottom:10 }}>
              ⏱ Temporizador
            </div>
            <TimerCircle
              segundos={timerSeg} total={totalSeg} on={timerOn}
              onToggle={() => setTimerOn(v => !v)}
              onReset={() => { clearInterval(timerRef.current); setTimerSeg(0); setTimerOn(false) }}
              nombre={momActual.nombre}
            />
            <div style={{ marginTop:10, fontSize:12, color:'#64748b', lineHeight:1.7 }}>
              <div><strong>Momento:</strong> {momActual.nombre || '—'} · {momActual.tiempo || '—'}</div>
              <div><strong>Duración total:</strong> {momentos.reduce((s, m) => s + parseMinutos(m.tiempo || '0'), 0)} min</div>
            </div>
          </div>

          {/* Coach IA */}
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:'14px', flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:12 }}>
              <div style={{
                width:28, height:28, borderRadius:7,
                background:'linear-gradient(135deg,#7c3aed,#6d28d9)',
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:13,
              }}>🤖</div>
              <div>
                <div style={{ fontSize:10, fontWeight:800, color:'#7c3aed', textTransform:'uppercase', letterSpacing:'.4px' }}>Coach Pedagógico IA</div>
                <div style={{ fontSize:11, color:'#94a3b8' }}>Sugerencias del contexto</div>
              </div>
            </div>

            <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:12 }}>
              {COACH_ACCIONES.map(ac => (
                <button key={ac.id} onClick={() => {
                  setCoachAct(ac.id)
                  setCoachSug(genCoach(ac.id, diaActivo?.titulo))
                }} style={{
                  background: coachAct === ac.id ? '#f5f3ff' : '#f8fafc',
                  border:`1px solid ${coachAct === ac.id ? '#7c3aed' : '#e2e8f0'}`,
                  color: coachAct === ac.id ? '#7c3aed' : '#374151',
                  borderRadius:20, padding:'4px 10px', fontSize:11.5, fontWeight:700, cursor:'pointer',
                }}>{ac.label}</button>
              ))}
            </div>

            {coachSug ? (
              <div style={{ background:'#faf9ff', border:'1px solid #ddd6fe', borderRadius:10, padding:'12px', position:'relative' }}>
                <button onClick={() => { setCoachSug(null); setCoachAct(null) }} style={{
                  position:'absolute', top:6, right:8, background:'none', border:0,
                  color:'#94a3b8', cursor:'pointer', fontSize:16, lineHeight:1,
                }}>×</button>
                <div style={{ fontSize:13, color:'#374151', lineHeight:1.6 }}>{coachSug}</div>
              </div>
            ) : (
              <div style={{ textAlign:'center', padding:'10px 0', color:'#94a3b8', fontSize:11.5 }}>
                Selecciona una acción
              </div>
            )}

            <button onClick={() => onIrA?.('asistente-personal')} style={{
              width:'100%', marginTop:12, background:'#f5f3ff', border:'1px solid #ede9fe',
              color:'#7c3aed', borderRadius:9, padding:'8px', fontSize:12, fontWeight:700, cursor:'pointer',
            }}>💬 Asistente IA completo ↗</button>
          </div>
        </div>

        {/* ╔═══════════════════════════╗
            ║  RECURSOS + EVIDENCIAS    ║
            ╚═══════════════════════════╝ */}
        <div style={{ overflow:'auto', padding:'14px', display:'flex', flexDirection:'column', gap:14 }}>

          {/* Recursos */}
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:10 }}>
              <div style={{ width:28, height:28, borderRadius:7, background:'#f0fdf4', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>🎒</div>
              <div>
                <div style={{ fontSize:10, fontWeight:800, color:'#15803d', textTransform:'uppercase', letterSpacing:'.4px' }}>Recursos</div>
                <div style={{ fontSize:11, color:'#64748b' }}>para la clase</div>
              </div>
            </div>
            {recursos.length === 0 ? (
              <div style={{ textAlign:'center', padding:'14px 0', color:'#94a3b8', fontSize:11.5 }}>Sin recursos definidos</div>
            ) : (
              recursos.map((r, i) => <RecursoItem key={i} tipo={r.tipo} item={r.item} />)
            )}
          </div>

          {/* Banco de Evidencias */}
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                <div style={{ width:28, height:28, borderRadius:7, background:'#fff7ed', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>📸</div>
                <div>
                  <div style={{ fontSize:10, fontWeight:800, color:'#c2410c', textTransform:'uppercase', letterSpacing:'.4px' }}>Banco de Evidencias</div>
                  <div style={{ fontSize:11, color:'#64748b' }}>{evidencias.length} registros</div>
                </div>
              </div>
              <button onClick={() => setAgregandoEv(v => !v)} style={{
                background: agregandoEv ? '#fef3c7' : '#fff7ed',
                border:`1px solid ${agregandoEv ? '#fbbf24' : '#fed7aa'}`,
                color: agregandoEv ? '#92400e' : '#c2410c',
                borderRadius:8, padding:'4px 9px', fontSize:11.5, fontWeight:700, cursor:'pointer',
              }}>{agregandoEv ? '✕' : '+ Agregar'}</button>
            </div>

            {agregandoEv && (
              <div style={{
                background:'#fffbeb', border:'1px solid #fde68a',
                borderRadius:10, padding:'12px', marginBottom:12,
              }}>
                <select value={categoriaEv} onChange={e => setCategoriaEv(e.target.value)} style={{
                  width:'100%', border:'1px solid #e2e8f0', borderRadius:7,
                  padding:'6px 10px', fontSize:12, marginBottom:8, color:'#374151',
                  background:'#fff', outline:'none',
                }}>
                  {['Observación','Trabajo escrito','Participación oral','Foto/Video','Lista de cotejo','Rúbrica aplicada','Otro'].map(c => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <textarea value={inputEvidencia} onChange={e => setInputEvidencia(e.target.value)}
                  rows={2} placeholder="Describe la evidencia…"
                  style={{
                    width:'100%', border:'1px solid #e2e8f0', borderRadius:7,
                    padding:'8px 10px', fontSize:12.5, color:'#374151', resize:'none',
                    outline:'none', boxSizing:'border-box', fontFamily:'inherit',
                  }}
                />
                <button onClick={agregarEvidencia} disabled={!inputEvidencia.trim()} style={{
                  width:'100%', marginTop:8, background:'#c2410c', color:'#fff',
                  border:0, borderRadius:7, padding:'8px', fontSize:12, fontWeight:700,
                  cursor: inputEvidencia.trim() ? 'pointer' : 'default',
                  opacity: inputEvidencia.trim() ? 1 : .5,
                }}>Guardar evidencia</button>
              </div>
            )}

            {/* Línea de tiempo */}
            {evidencias.length === 0 ? (
              <div style={{ textAlign:'center', padding:'20px 0', color:'#94a3b8', fontSize:11.5 }}>
                <div style={{ fontSize:24, marginBottom:8 }}>📸</div>
                Sin evidencias aún
              </div>
            ) : (
              <div style={{ position:'relative' }}>
                <div style={{ position:'absolute', left:19, top:0, bottom:0, width:2, background:'#fee2e2', borderRadius:1 }} />
                {evidencias.map(ev => (
                  <div key={ev.id} style={{ display:'flex', gap:10, marginBottom:10, position:'relative' }}>
                    <div style={{
                      flexShrink:0, width:38, height:38, borderRadius:'50%',
                      background:'#fff7ed', border:'2px solid #fed7aa',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:15, zIndex:1,
                    }}>
                      {ev.categoria === 'Foto/Video' ? '📸' : ev.categoria === 'Participación oral' ? '🎙️' : ev.categoria === 'Trabajo escrito' ? '📝' : '📌'}
                    </div>
                    <div style={{ flex:1, background:'#fff', border:'1px solid #fee2e2', borderRadius:9, padding:'7px 10px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                        <span style={{ fontSize:10.5, fontWeight:700, color:'#c2410c' }}>{ev.hora}</span>
                        <span style={{ fontSize:10.5, color:'#94a3b8' }}>{ev.momento}</span>
                      </div>
                      <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:2 }}>{ev.categoria}</div>
                      <div style={{ fontSize:11.5, color:'#6b7280', lineHeight:1.4 }}>{ev.texto}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button onClick={() => onIrA?.('banco-evidencias')} style={{
              width:'100%', marginTop:8, background:'#fff7ed', border:'1px solid #fed7aa',
              color:'#c2410c', borderRadius:9, padding:'7px', fontSize:11.5, fontWeight:700, cursor:'pointer',
            }}>Ver banco de evidencias ↗</button>
          </div>
        </div>
      </div>

      {/* ══ BARRA INFERIOR ══ */}
      <div style={{
        background:'#0f172a', padding:'7px 16px',
        display:'flex', alignItems:'center', gap:14, flexShrink:0,
        flexWrap:'wrap', boxShadow:'0 -2px 16px rgba(0,0,0,.2)',
      }}>
        {[
          { label:'Actividades', val:`${hechas}/${totalActs}`, icon:'✅', color:'#86efac' },
          { label:'Instrumentos', val:instrumentos.length, icon:'📊', color:'#fde68a' },
          { label:'Evidencias', val:evidencias.length, icon:'📸', color:'#fdba74' },
        ].map(({ label, val, icon, color }) => (
          <div key={label} style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:14 }}>{icon}</span>
            <div>
              <div style={{ fontSize:10, color:'#64748b', lineHeight:1 }}>{label}</div>
              <div style={{ fontSize:14, fontWeight:800, color }}>{val}</div>
            </div>
          </div>
        ))}

        <div style={{ flex:1 }} />

        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:11, color:'#64748b', fontWeight:600 }}>Progreso</span>
          <div style={{ width:100, height:5, background:'rgba(255,255,255,.08)', borderRadius:3, overflow:'hidden' }}>
            <div style={{
              width:`${pctClase}%`, height:'100%',
              background:'linear-gradient(90deg,#7c3aed,#a78bfa)',
              transition:'width .5s', borderRadius:3,
            }} />
          </div>
          <span style={{ fontSize:13, fontWeight:800, color:'#a78bfa', minWidth:30 }}>{pctClase}%</span>
        </div>

        <div style={{ fontSize:13, color:'#475569', fontWeight:700 }}>⏱ {formatTime(timerSeg)}</div>
      </div>
    </div>
  )
}
