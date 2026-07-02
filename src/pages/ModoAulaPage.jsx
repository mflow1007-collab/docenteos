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
import { sincronizarEvaluacionPedagogica } from '../services/nucleoPedagogicoService.js'

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

const TIPO_INSTRUMENTO_VALOR = {
  'Rúbrica': 100,
  'Lista de cotejo': 100,
  'Escala de estimación': 100,
}

function nombreEstudiante(estudiante = {}) {
  if (typeof estudiante === 'string') return estudiante
  return estudiante.nombre || estudiante.nombreCompleto || estudiante.name || estudiante.fullName || estudiante.apellidos || ''
}

function normalizarTipoInstrumento(valor = '') {
  const texto = String(valor).toLowerCase()
  if (texto.includes('rúbrica') || texto.includes('rubrica')) return 'Rúbrica'
  if (texto.includes('cotejo')) return 'Lista de cotejo'
  if (texto.includes('escala')) return 'Escala de estimación'
  return valor || 'Instrumento'
}

function valorInstrumento(tipo) {
  return TIPO_INSTRUMENTO_VALOR[normalizarTipoInstrumento(tipo)] || 100
}

function normalizarPeriodoRegistro(valor = '') {
  const numero = String(valor || '').match(/[1-4]/)?.[0]
  return `Periodo ${numero || 1}`
}

function normalizarClave(valor = '') {
  return String(valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function gradoCompatible(curso, gradoPlan = '') {
  const cursoTxt = normalizarClave([curso?.grado, curso?.nombre, curso?.name].filter(Boolean).join(' '))
  const planTxt = normalizarClave(gradoPlan)
  if (!cursoTxt || !planTxt) return false
  const numeroCurso = cursoTxt.match(/\b[1-6]\b|\b[1-6](ro|do|to)\b/)?.[0]?.match(/[1-6]/)?.[0]
  const numeroPlan = planTxt.match(/\b[1-6]\b|\b[1-6](ro|do|to)\b/)?.[0]?.match(/[1-6]/)?.[0]
  const nivelOk = !planTxt.includes('secundaria') || cursoTxt.includes('secundaria')
  return Boolean(numeroCurso && numeroPlan && numeroCurso === numeroPlan && nivelOk)
}

function areaCompatible(curso, areaPlan = '') {
  const planTxt = normalizarClave(areaPlan)
  if (!planTxt) return false
  const cursoTxt = normalizarClave([curso?.area, curso?.asignatura, curso?.materia, curso?.nombre, curso?.name].filter(Boolean).join(' '))
  if (!cursoTxt) return false
  return cursoTxt.includes(planTxt) || planTxt.includes(cursoTxt)
}

function resolverCursoParaPlan(cursos = [], cursoActivo = null, claseNorm = null) {
  const gradoPlan = claseNorm?.grado || ''
  const areaPlan = claseNorm?.area || ''
  const candidatos = cursos.map((curso) => {
    let puntaje = 0
    if (cursoActivo?.id && curso.id === cursoActivo.id) puntaje += 1
    if (gradoCompatible(curso, gradoPlan)) puntaje += 4
    if (areaCompatible(curso, areaPlan)) puntaje += 5
    return { curso, puntaje }
  }).sort((a, b) => b.puntaje - a.puntaje)

  return candidatos[0]?.puntaje >= 5 ? candidatos[0].curso : (cursoActivo || cursos[0] || null)
}

function textoCriterio(criterio, fallback) {
  if (!criterio) return fallback
  if (typeof criterio === 'string') return criterio
  return criterio.criterio || criterio.indicador || criterio.descripcion || criterio.nombre || fallback
}

function crearInstrumentosDesdeRaw(raw = {}, contexto = {}) {
  const base = {
    planificacionId: contexto.planId || '',
    cursoId: contexto.cursoId || '',
    curso: contexto.curso || '',
    grado: contexto.grado || '',
    seccion: contexto.seccion || '',
    area: contexto.area || '',
    periodo: contexto.periodo || 'Periodo 1',
    competencia: contexto.competencia || '',
    actividad: contexto.tema || '',
    unidad: contexto.unidad || contexto.tema || '',
  }
  const instrumentos = []
  const listas = [
    {
      key: 'criteriosCotejo',
      tipo: 'Lista de cotejo',
      nombre: 'Lista de cotejo - Actividades',
      momento: 'Desarrollo',
      estructuraKey: 'indicadores',
    },
    {
      key: 'criteriosRubrica',
      tipo: 'Rúbrica',
      nombre: `Rúbrica analítica - ${contexto.tema || 'Desempeño'}`,
      momento: 'Desarrollo',
      estructuraKey: 'criterios',
    },
    {
      key: 'criteriosEscala',
      tipo: 'Escala de estimación',
      nombre: 'Escala de valoración - Desempeño',
      momento: 'Cierre',
      estructuraKey: 'indicadores',
    },
  ]

  listas.forEach((def) => {
    const criterios = Array.isArray(raw?.[def.key]) ? raw[def.key] : []
    if (!criterios.length) return
    const indicadores = criterios.map((criterio, index) => textoCriterio(criterio, `Criterio ${index + 1}`)).filter(Boolean)
    const valorMaximo = Number(raw?.puntajes?.[def.key])
      || Number(raw?.distribucion?.find((item) => item.key === def.key)?.puntajeMaximo)
      || valorInstrumento(def.tipo)
    const distribucion = raw?.distribucion?.find((item) => item.key === def.key)
    instrumentos.push({
      ...base,
      id: `${base.planificacionId || 'plan'}-${def.key}`,
      tipo: def.tipo,
      nombre: distribucion?.nombre ? `${distribucion.nombre}${def.tipo === 'Rúbrica' && contexto.tema ? ` - ${contexto.tema}` : ''}` : def.nombre,
      momento: def.momento,
      puntos: valorMaximo,
      valorMaximo,
      orden: distribucion?.orden || instrumentos.length + 1,
      importancia: distribucion?.importancia || '',
      indicadores,
      estructura: {
        [def.estructuraKey]: criterios.map((criterio, index) => ({
          id: `${def.key}-${index + 1}`,
          indicador: textoCriterio(criterio, `Criterio ${index + 1}`),
          ...((typeof criterio === 'object' && criterio) ? criterio : {}),
        })),
      },
    })
  })

  return instrumentos
}

function extraerInstrumentos(dia, contexto = {}) {
  if (!dia) return []
  const seen = new Map()
  ;(dia.momentos || []).forEach(mom => {
    const ev = mom.evaluacion
    const tipo = normalizarTipoInstrumento(ev?.instrumento || ev?.tecnica)
    if (ev?.instrumento && !seen.has(`${tipo}-${ev.instrumento}`)) {
      const valorMaximo = valorInstrumento(tipo)
      seen.set(`${tipo}-${ev.instrumento}`, {
        planificacionId: contexto.planId || '',
        cursoId: contexto.cursoId || '',
        curso: contexto.curso || '',
        grado: contexto.grado || '',
        seccion: contexto.seccion || '',
        area: contexto.area || '',
        periodo: contexto.periodo || 'Periodo 1',
        competencia: contexto.competencia || '',
        actividad: contexto.tema || '',
        unidad: contexto.unidad || contexto.tema || '',
        id: `${contexto.planId || 'plan'}-${tipo}-${ev.instrumento}`.replace(/\s+/g, '-').toLowerCase(),
        nombre: ev.instrumento,
        tipo,
        agente: ev.agente || 'Docente',
        momento: mom.nombre,
        puntos: valorMaximo,
        valorMaximo,
        indicadores: mom.evidencias || [],
      })
    }
  })
  crearInstrumentosDesdeRaw(contexto.instrumentosRaw, contexto).forEach((inst) => {
    const key = `${inst.tipo}-${inst.nombre}`
    if (!seen.has(key)) seen.set(key, inst)
  })
  return [...seen.values()]
    .sort((a, b) => (Number(a.orden) || 99) - (Number(b.orden) || 99))
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
  Inicio:     { bg:'#f5f3ff', borde:'#4f46e5', txt:'#4338ca', badge:'#4f46e5', icon:'▶', light:'#ede9fe' },
  Desarrollo: { bg:'#f0fdf4', borde:'#16a34a', txt:'#15803d', badge:'#16a34a', icon:'♻', light:'#dcfce7' },
  Cierre:     { bg:'#fff7ed', borde:'#f97316', txt:'#ea580c', badge:'#f97316', icon:'⌂', light:'#ffedd5' },
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
      background:c.bg,
      border:`1px solid ${c.borde}77`,
      borderRadius:10,
      padding:'14px 14px',
      marginBottom:12,
    }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:900, fontSize:14, color:c.txt, lineHeight:1.3, marginBottom:8 }}>
            {inst.nombre}
          </div>
          <div style={{ fontSize:12, color:'#0f172a', marginBottom:6 }}>
            Evalúa la actividad en el momento {inst.momento}.
          </div>
          <div style={{ fontSize:12, color:'#475569', lineHeight:1.6 }}>
            <div>Tipo: {inst.tipo}</div>
            <div>Puntaje máx.: {inst.puntos}</div>
          </div>
        </div>
        <div style={{
          flexShrink:0,
          borderRadius:8,
          border:`1px solid ${c.borde}`,
          background:'#fff',
          color:c.txt,
          padding:'5px 9px',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:12, fontWeight:900,
        }}>{inst.puntos} pts</div>
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:10 }}>
        <button onClick={onAplicar} style={{
          background:'#fff',
          color:c.txt,
          border:`1px solid ${c.borde}`,
          borderRadius:8,
          padding:'7px 12px',
          fontSize:12,
          fontWeight:900,
          cursor:'pointer',
        }}>Aplicar</button>
        <button style={{
          background:'#fff', color:c.txt, border:`1px solid ${c.borde}`, borderRadius:8,
          padding:'7px 12px', fontSize:12, fontWeight:900, cursor:'pointer',
        }}>Ver</button>
      </div>
    </div>
  )
}

function RecursoItem({ tipo, item }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:8,
      padding:'10px 12px', background:'#fff', borderRadius:8,
      border:'1px solid #e5e7eb', marginBottom:0,
      boxShadow:'0 1px 0 rgba(15,23,42,.02)',
    }}>
      <span style={{
        width:28,
        height:28,
        borderRadius:6,
        display:'grid',
        placeItems:'center',
        background:'#eff6ff',
        color:'#2563eb',
        fontSize:15,
        flexShrink:0,
      }}>{tipo.slice(0,2)}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, color:'#0f172a', fontWeight:900, lineHeight:1.2 }}>{item}</div>
        <div style={{ fontSize:11, color:'#64748b', fontWeight:600, marginTop:2 }}>{tipo.replace(/^..\s/, '')}</div>
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

export default function ModoAulaPage({ cursos = [], cursoActivo = null, onIrA }) {
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

  // ── Aplicación de instrumentos
  const [instrumentoModal, setInstrumentoModal] = useState(null)
  const [notasInstrumento, setNotasInstrumento] = useState({})
  const [puntajeInstrumento, setPuntajeInstrumento] = useState(100)
  const [obsInstrumento,   setObsInstrumento]   = useState('')
  const [guardandoInstrumento, setGuardandoInstrumento] = useState(false)
  const [mensajeInstrumento,   setMensajeInstrumento]   = useState(null)

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
  const cursoParaAula = useMemo(
    () => resolverCursoParaPlan(cursos, cursoActivo, claseNorm),
    [cursos, cursoActivo, claseNorm]
  )
  const periodoRegistro = normalizarPeriodoRegistro(cursoParaAula?.periodo || cursoParaAula?.periodoActivo || 'Periodo 1')
  const estudiantesAula = useMemo(() => {
    const fuente = cursoParaAula?.estudiantesDetalle || cursoParaAula?.estudiantesLista || cursoParaAula?.estudiantesNombres || []
    return fuente
      .map((estudiante, index) => ({
        id: estudiante?.id || estudiante?.matricula || `est-${index + 1}`,
        nombre: nombreEstudiante(estudiante) || `Estudiante ${index + 1}`,
      }))
      .filter((estudiante) => estudiante.nombre)
  }, [cursoParaAula])
  const instrumentos = useMemo(() => extraerInstrumentos(diaActivo, {
    planId: planActivo?.id,
    cursoId: cursoParaAula?.id,
    curso: cursoParaAula?.nombre || cursoParaAula?.name || cursoParaAula?.grado || '',
    grado: claseNorm?.grado || cursoParaAula?.grado || '',
    seccion: cursoParaAula?.seccion || '',
    area: claseNorm?.area,
    tema: diaActivo?.titulo || claseNorm?.tituloUnidad,
    unidad: claseNorm?.tituloUnidad,
    periodo: periodoRegistro,
    competencia: planActivo?.contenido?.competenciasEIndicadores?.competenciaEspecifica
      || planActivo?.contenido?.competenciaEspecifica
      || '',
    instrumentosRaw: claseNorm?.instrumentosRaw,
    maximoInstrumentosPorDia: claseNorm?.resumenEval?.maximoInstrumentosPorDia || claseNorm?.instrumentosRaw?.maximoInstrumentosPorDia || 3,
  }), [diaActivo, planActivo, claseNorm, cursoParaAula, periodoRegistro])
  const recursos     = useMemo(() => extraerRecursos(diaActivo), [diaActivo])
  const momentos     = diaActivo?.momentos || []
  const totalActs    = momentos.reduce((s, m) => s + (m.actividades?.length || 0), 0)
  const hechas       = Object.values(actChecks).reduce((s, set) => s + set.size, 0)
  const pctClase     = totalActs > 0 ? Math.round(hechas / totalActs * 100) : 0
  const momActual    = momentos[momentoOpen] || {}
  const checksActual = actChecks[momActual.nombre] || new Set()
  const primerNombre = (formulario?.nombreDocente || '').split(' ')[0] || 'Docente'

  const abrirInstrumento = (inst) => {
    const baseNotas = Object.fromEntries(estudiantesAula.map((estudiante) => [estudiante.id, '']))
    setNotasInstrumento(baseNotas)
    setPuntajeInstrumento(Math.min(100, Math.max(1, Number(inst.valorMaximo || inst.puntos || 100))))
    setObsInstrumento('')
    setMensajeInstrumento(null)
    setInstrumentoModal(inst)
  }

  const actualizarPuntajeInstrumento = (valor) => {
    const numero = Math.min(100, Math.max(1, Number(valor) || 1))
    setPuntajeInstrumento(numero)
    setNotasInstrumento(prev => Object.fromEntries(
      Object.entries(prev).map(([id, nota]) => {
        if (nota === '' || nota == null) return [id, nota]
        return [id, String(Math.min(numero, Math.max(0, Number(nota) || 0)))]
      })
    ))
  }

  const actualizarNotaInstrumento = (estudianteId, valor) => {
    const max = Number(puntajeInstrumento || instrumentoModal?.valorMaximo || instrumentoModal?.puntos || 100)
    const limpio = String(valor)
    if (limpio === '') {
      setNotasInstrumento(prev => ({ ...prev, [estudianteId]: '' }))
      return
    }
    const numero = Math.min(max, Math.max(0, Number(limpio)))
    setNotasInstrumento(prev => ({ ...prev, [estudianteId]: Number.isFinite(numero) ? String(numero) : '' }))
  }

  const guardarNotasInstrumento = async () => {
    if (!instrumentoModal || guardandoInstrumento) return
    const aplicaciones = estudiantesAula
      .map((estudiante) => {
        const raw = notasInstrumento[estudiante.id]
        if (raw === '' || raw == null) return null
        const valorMaximo = Number(puntajeInstrumento || instrumentoModal.valorMaximo || instrumentoModal.puntos || 100)
        const puntos = Math.min(valorMaximo, Math.max(0, Number(raw)))
        if (!Number.isFinite(puntos)) return null
        return { estudiante, puntos, valorMaximo }
      })
      .filter(Boolean)

    if (!aplicaciones.length) {
      setMensajeInstrumento({ tipo:'error', texto:'Coloca al menos una nota para guardar el instrumento.' })
      return
    }

    setGuardandoInstrumento(true)
    setMensajeInstrumento(null)
    const fecha = new Date().toISOString()
    try {
      await Promise.all(aplicaciones.map(({ estudiante, puntos, valorMaximo }) => sincronizarEvaluacionPedagogica({
        instrumento: {
          ...instrumentoModal,
          cursoId: cursoParaAula?.id || instrumentoModal.cursoId,
          curso: cursoParaAula?.nombre || cursoParaAula?.name || instrumentoModal.curso || '',
          valorMaximo,
          puntos: valorMaximo,
        },
        cursoId: cursoParaAula?.id || instrumentoModal.cursoId,
        aplicacion: {
          estudianteId: estudiante.id,
          estudiante: estudiante.nombre,
          fecha,
          periodo: instrumentoModal.periodo || periodoRegistro,
          competenciaEvaluada: instrumentoModal.competencia || '',
          indicadorEvaluado: instrumentoModal.indicadores?.[0] || '',
          indicadoresEvaluados: instrumentoModal.indicadores || [],
          calificacionObtenida: puntos,
          puntosObtenidos: puntos,
          valorMaximo,
          porcentajeObtenido: valorMaximo > 0 ? Math.round((puntos / valorMaximo) * 100) : 0,
          observacion: obsInstrumento,
          detalle: {
            fuente: 'modo-aula',
            momento: instrumentoModal.momento,
            actividad: diaActivo?.titulo || '',
          },
        },
      })))

      const ev = {
        id: Date.now(),
        texto: `${instrumentoModal.nombre}: ${aplicaciones.length} estudiante(s) evaluado(s).`,
        categoria: instrumentoModal.tipo || 'Instrumento aplicado',
        hora: new Date().toLocaleTimeString('es-DO', { hour:'2-digit', minute:'2-digit' }),
        momento: instrumentoModal.momento || momActual.nombre || '',
      }
      if (planActivo?.id && diaActivo?.diaNum != null) {
        const arr = [ev, ...evidencias]
        setEvidencias(arr)
        guardarEvidenciasLocal(planActivo.id, diaActivo.diaNum, arr)
      }
      setMensajeInstrumento({ tipo:'ok', texto:'Instrumento guardado y enviado al registro.' })
    } catch (error) {
      setMensajeInstrumento({ tipo:'error', texto:'No se pudo guardar ahora. Revisa la conexión e intenta otra vez.' })
    } finally {
      setGuardandoInstrumento(false)
    }
  }

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

  const InstrumentoModal = instrumentoModal && (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position:'fixed', inset:0, background:'rgba(15,23,42,.56)', zIndex:260,
        display:'flex', alignItems:'center', justifyContent:'center', padding:18,
      }}
      onClick={() => !guardandoInstrumento && setInstrumentoModal(null)}
    >
      <div
        style={{
          background:'#fff',
          width:'100%',
          maxWidth:880,
          maxHeight:'88vh',
          overflow:'hidden',
          borderRadius:18,
          boxShadow:'0 28px 80px rgba(15,23,42,.32)',
          border:'1px solid #e5e7eb',
          display:'flex',
          flexDirection:'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          padding:'18px 20px',
          borderBottom:'1px solid #e5e7eb',
          display:'flex',
          alignItems:'flex-start',
          justifyContent:'space-between',
          gap:14,
          background:'#fbfcff',
        }}>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:11, fontWeight:900, color:'#4f46e5', textTransform:'uppercase', letterSpacing:'.35px', marginBottom:5 }}>
              Aplicar instrumento
            </div>
            <h3 style={{ margin:0, color:'#0f172a', fontSize:19, lineHeight:1.25, fontWeight:900 }}>
              {instrumentoModal.nombre}
            </h3>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:10 }}>
              <Pill color="#4f46e5" bg="#eef2ff">{instrumentoModal.tipo}</Pill>
              <Pill color="#15803d" bg="#ecfdf5">{instrumentoModal.momento || 'Momento del día'}</Pill>
              <Pill color="#b45309" bg="#fffbeb">Máx. {puntajeInstrumento} pts</Pill>
            </div>
          </div>
          <button
            onClick={() => setInstrumentoModal(null)}
            disabled={guardandoInstrumento}
            aria-label="Cerrar instrumento"
            style={{
              width:36, height:36, borderRadius:10, border:'1px solid #e2e8f0',
              background:'#fff', color:'#64748b', cursor:guardandoInstrumento ? 'default' : 'pointer',
              fontSize:22, lineHeight:1, display:'grid', placeItems:'center', flexShrink:0,
            }}
          >×</button>
        </div>

        <div style={{ padding:'16px 20px', overflow:'auto' }}>
          <div style={{
            display:'grid',
            gridTemplateColumns:'minmax(0,1fr) 160px',
            alignItems:'end',
            gap:14,
            background:'#fff7ed',
            border:'1px solid #fed7aa',
            borderRadius:12,
            padding:'12px 14px',
            marginBottom:14,
          }}>
            <div>
              <div style={{ fontSize:12.5, fontWeight:900, color:'#9a3412', marginBottom:3 }}>
                Puntuación definida por el docente
              </div>
              <div style={{ fontSize:12, color:'#7c2d12', lineHeight:1.45 }}>
                Puedes usar este instrumento solo o combinarlo con otros. El máximo de cada instrumento lo decides según la complejidad del tema.
              </div>
            </div>
            <label style={{ display:'block' }}>
              <span style={{ display:'block', fontSize:10.5, color:'#9a3412', fontWeight:900, textTransform:'uppercase', marginBottom:5 }}>
                Puntaje máximo
              </span>
              <input
                type="number"
                min="1"
                max="100"
                value={puntajeInstrumento}
                onChange={e => actualizarPuntajeInstrumento(e.target.value)}
                style={{
                  width:'100%',
                  border:'1px solid #fdba74',
                  borderRadius:8,
                  padding:'9px 10px',
                  fontSize:14,
                  fontWeight:900,
                  color:'#0f172a',
                  outline:'none',
                  boxSizing:'border-box',
                  background:'#fff',
                }}
              />
            </label>
          </div>

          {instrumentoModal.indicadores?.length > 0 && (
            <div style={{
              background:'#f8fafc',
              border:'1px solid #e2e8f0',
              borderRadius:12,
              padding:'12px 14px',
              marginBottom:14,
            }}>
              <div style={{ fontSize:11, fontWeight:900, color:'#334155', textTransform:'uppercase', marginBottom:8 }}>
                Criterios del instrumento
              </div>
              <div style={{ display:'grid', gap:5 }}>
                {instrumentoModal.indicadores.slice(0, 6).map((indicador, index) => (
                  <div key={index} style={{ display:'flex', gap:8, fontSize:12.5, color:'#475569', lineHeight:1.45 }}>
                    <span style={{ color:'#4f46e5', fontWeight:900 }}>{index + 1}.</span>
                    <span>{indicador}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {estudiantesAula.length === 0 ? (
            <div style={{
              textAlign:'center',
              padding:'28px 18px',
              border:'1px dashed #cbd5e1',
              borderRadius:12,
              background:'#f8fafc',
              color:'#64748b',
              fontSize:13,
            }}>
              Este curso no tiene estudiantes cargados todavía. Agrega estudiantes al curso para aplicar el instrumento.
            </div>
          ) : (
            <div style={{ display:'grid', gap:9 }}>
              {estudiantesAula.map((estudiante, index) => {
                const max = Number(puntajeInstrumento || instrumentoModal.valorMaximo || instrumentoModal.puntos || 100)
                return (
                  <div key={estudiante.id} style={{
                    display:'grid',
                    gridTemplateColumns:'minmax(0,1fr) 126px auto',
                    gap:10,
                    alignItems:'center',
                    padding:'10px 12px',
                    border:'1px solid #e5e7eb',
                    borderRadius:10,
                    background:'#fff',
                  }}>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:13.5, fontWeight:900, color:'#0f172a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {index + 1}. {estudiante.nombre}
                      </div>
                      <div style={{ fontSize:11.5, color:'#64748b', marginTop:2 }}>Puntaje obtenido</div>
                    </div>
                    <input
                      type="number"
                      min="0"
                      max={max}
                      value={notasInstrumento[estudiante.id] ?? ''}
                      onChange={e => actualizarNotaInstrumento(estudiante.id, e.target.value)}
                      placeholder={`0-${max}`}
                      style={{
                        width:'100%',
                        border:'1px solid #cbd5e1',
                        borderRadius:8,
                        padding:'9px 10px',
                        fontSize:13,
                        fontWeight:800,
                        color:'#0f172a',
                        outline:'none',
                        boxSizing:'border-box',
                      }}
                    />
                    <div style={{ display:'flex', gap:5, justifyContent:'flex-end' }}>
                      {[0, Math.round(max / 2), max].map((valor) => (
                        <button
                          key={valor}
                          onClick={() => actualizarNotaInstrumento(estudiante.id, valor)}
                          style={{
                            minWidth:34,
                            border:'1px solid #e2e8f0',
                            background:'#f8fafc',
                            color:'#334155',
                            borderRadius:7,
                            padding:'7px 8px',
                            fontSize:11,
                            fontWeight:900,
                            cursor:'pointer',
                          }}
                        >
                          {valor}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <label style={{ display:'block', marginTop:14 }}>
            <span style={{ display:'block', fontSize:11, fontWeight:900, color:'#334155', textTransform:'uppercase', marginBottom:6 }}>
              Observación general
            </span>
            <textarea
              value={obsInstrumento}
              onChange={e => setObsInstrumento(e.target.value)}
              rows={3}
              placeholder="Comentario breve para acompañar esta aplicación..."
              style={{
                width:'100%',
                border:'1px solid #cbd5e1',
                borderRadius:10,
                padding:'10px 12px',
                resize:'vertical',
                boxSizing:'border-box',
                fontFamily:'inherit',
                fontSize:13,
                lineHeight:1.5,
                color:'#0f172a',
                outline:'none',
              }}
            />
          </label>

          {mensajeInstrumento && (
            <div style={{
              marginTop:12,
              padding:'10px 12px',
              borderRadius:10,
              border:`1px solid ${mensajeInstrumento.tipo === 'ok' ? '#86efac' : '#fecaca'}`,
              background: mensajeInstrumento.tipo === 'ok' ? '#f0fdf4' : '#fef2f2',
              color: mensajeInstrumento.tipo === 'ok' ? '#15803d' : '#b91c1c',
              fontSize:12.5,
              fontWeight:800,
            }}>
              {mensajeInstrumento.texto}
            </div>
          )}
        </div>

        <div style={{
          padding:'14px 20px',
          borderTop:'1px solid #e5e7eb',
          background:'#fff',
          display:'flex',
          justifyContent:'space-between',
          alignItems:'center',
          gap:12,
        }}>
          <div style={{ fontSize:12, color:'#64748b', fontWeight:700 }}>
            {estudiantesAula.length} estudiante(s) disponibles
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button
              onClick={() => setInstrumentoModal(null)}
              disabled={guardandoInstrumento}
              style={{
                background:'#fff',
                color:'#334155',
                border:'1px solid #cbd5e1',
                borderRadius:9,
                padding:'10px 14px',
                fontSize:13,
                fontWeight:900,
                cursor:guardandoInstrumento ? 'default' : 'pointer',
              }}
            >
              Cerrar
            </button>
            <button
              onClick={guardarNotasInstrumento}
              disabled={guardandoInstrumento || estudiantesAula.length === 0}
              style={{
                background: guardandoInstrumento || estudiantesAula.length === 0 ? '#cbd5e1' : 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                color:'#fff',
                border:0,
                borderRadius:9,
                padding:'10px 16px',
                fontSize:13,
                fontWeight:900,
                cursor: guardandoInstrumento || estudiantesAula.length === 0 ? 'default' : 'pointer',
                boxShadow: guardandoInstrumento || estudiantesAula.length === 0 ? 'none' : '0 10px 22px rgba(79,70,229,.25)',
              }}
            >
              {guardandoInstrumento ? 'Guardando...' : 'Guardar en registro'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  // ══════════════════════════════════════════════════════════════════════════
  // WORKSPACE PRINCIPAL
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{
      display:'flex',
      flexDirection:'column',
      minHeight:'calc(100vh - 92px)',
      overflow:'auto',
      background:'#f7f8fc',
      color:'#0f172a',
    }}>
      {SelectorModal}
      {InstrumentoModal}

      {/* ══ RESUMEN DE LA CLASE ══ */}
      <div style={{
        background:'#fff',
        margin:'16px 24px 0',
        padding:'20px 22px',
        display:'grid',
        gridTemplateColumns:'repeat(4, minmax(0, 1fr)) auto',
        alignItems:'center',
        gap:18,
        border:'1px solid #e5e7eb',
        borderRadius:'18px 18px 0 0',
        borderBottom:0,
        boxShadow:'0 12px 30px rgba(15,23,42,.07)',
        zIndex:50,
        flexShrink:0,
      }}>
        {[
          { icon:'📚', label:'Asignatura', value:claseNorm?.area || '—', color:'#4f46e5', bg:'#eef2ff' },
          { icon:'🗂️', label:'Tema de la unidad', value:claseNorm?.tituloUnidad || '—', color:'#059669', bg:'#ecfdf5' },
          { icon:'📅', label:'Semana y día', value:`${diaActivo?.semana ? `Semana ${diaActivo.semana} · ` : ''}Día ${diaActivo?.diaNum || '—'}`, color:'#2563eb', bg:'#eff6ff' },
          { icon:'📌', label:'Título del día', value:diaActivo?.titulo || '—', color:'#b45309', bg:'#fffbeb' },
        ].map((item) => (
          <div key={item.label} style={{ display:'flex', alignItems:'center', gap:12, minWidth:0 }}>
            <div style={{
              width:38,
              height:38,
              display:'grid',
              placeItems:'center',
              borderRadius:'50%',
              background:item.bg,
              color:item.color,
              fontSize:18,
              flexShrink:0,
            }}>{item.icon}</div>
            <div style={{ minWidth:0 }}>
              <div style={{
                color:'#334155',
                fontSize:10,
                fontWeight:900,
                textTransform:'uppercase',
                letterSpacing:'.35px',
                marginBottom:4,
              }}>{item.label}</div>
              <div style={{
                color:'#0f172a',
                fontSize:14,
                fontWeight:900,
                lineHeight:1.25,
                overflow:'hidden',
                textOverflow:'ellipsis',
                whiteSpace:'nowrap',
              }}>{item.value}</div>
            </div>
          </div>
        ))}

        <div style={{
          display:'flex', alignItems:'center', gap:5,
          background:'#f8fafc',
          color:'#334155',
          border:'1px solid #e2e8f0',
          borderRadius:12,
          padding:'9px 13px',
          fontSize:12,
          fontWeight:800,
        }}>
          <div style={{ width:7, height:7, borderRadius:'50%', background:estadoBadge.dot }} />
          {estadoBadge.label}
        </div>
        <button onClick={() => setMostrarSelector(true)} style={{
          gridColumn:'1 / -1',
          justifySelf:'end',
          marginTop:-8,
          background:'#fff',
          color:'#4f46e5',
          border:'1px solid #c7d2fe',
          borderRadius:10,
          padding:'8px 12px',
          fontSize:12,
          fontWeight:900,
          cursor:'pointer',
        }}>⇄ Cambiar planificación</button>
      </div>

      {/* ══ TIMELINE MOMENTOS ══ */}
      <div style={{
        background:'#fff',
        border:'1px solid #e5e7eb',
        borderRadius:'0 0 18px 18px',
        margin:'0 24px 14px',
        padding:'16px 18px 18px',
        display:'flex',
        alignItems:'center',
        flexShrink:0,
        overflowX:'auto',
        gap:0,
        boxShadow:'0 14px 30px rgba(15,23,42,.07)',
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
                minWidth:210,
                padding:'13px 24px',
                borderRadius:999,
                border:`1px solid ${activo ? c.borde : '#e5e7eb'}`,
                cursor:'pointer',
                background: activo ? `linear-gradient(135deg,${c.borde},${c.txt})` : '#fff',
                boxShadow: activo ? `0 14px 24px ${c.borde}30` : 'inset 0 0 0 1px rgba(15,23,42,.02)',
                transition:'all .15s',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{
                    width:34,
                    height:34,
                    borderRadius:'50%',
                    display:'grid',
                    placeItems:'center',
                    background: activo ? 'rgba(255,255,255,.22)' : c.light,
                    color: activo ? '#fff' : c.txt,
                    fontSize:15,
                  }}>{c.icon}</span>
                  <span style={{
                    fontSize:13, fontWeight: activo ? 900 : 700,
                    color: activo ? '#fff' : pasado ? '#94a3b8' : '#0f172a',
                  }}>{mom.nombre}</span>
                  <span style={{ fontSize:11, color: activo ? 'rgba(255,255,255,.86)' : '#64748b' }}>{mom.tiempo}</span>
                </div>
                {mom.actividades.length > 0 && (
                  <div style={{ marginTop:7, width:118, height:4, background: activo ? 'rgba(255,255,255,.24)' : '#e2e8f0', borderRadius:2, overflow:'hidden' }}>
                    <div style={{ width:`${pct}%`, height:'100%', background: activo ? '#fff' : c.badge, transition:'width .3s' }} />
                  </div>
                )}
              </button>
              {i < momentos.length - 1 && (
                <div style={{ width:54, height:2, background: pasado ? '#4f46e5' : '#cbd5e1', borderRadius:1, flexShrink:0 }} />
              )}
            </div>
          )
        })}
        <div style={{ width:54, height:2, background:'#cbd5e1', flexShrink:0 }} />
        <div style={{
          display:'flex',
          alignItems:'center',
          gap:8,
          padding:'13px 22px',
          color:'#4f46e5',
          border:'1px solid #e5e7eb',
          borderRadius:999,
          background:'#fafaff',
          fontSize:12,
          fontWeight:800,
          minWidth:180,
          justifyContent:'center',
        }}>
          🏁 Finalizar
        </div>
      </div>

      {/* ══ WORKSPACE 3 COLUMNAS ══ */}
      <div style={{
        flex:1,
        overflow:'visible',
        display:'grid',
        gridTemplateColumns:'minmax(0,1.25fr) minmax(300px,.85fr) minmax(280px,.7fr)',
        gap:16,
        minHeight:0,
        padding:'0 24px 18px',
      }}>

        {/* ╔═══════════════════════╗
            ║   PLAN DE CLASE       ║
            ╚═══════════════════════╝ */}
        <div style={{
          overflow:'auto',
          padding:'18px 18px 16px',
          background:'#fff',
          border:'1px solid #e5e7eb',
          borderRadius:12,
          boxShadow:'0 10px 24px rgba(15,23,42,.06)',
        }}>

          {/* Cabecera */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:24, height:24, borderRadius:5, background:'#eef2ff', color:'#2563eb', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13 }}>▣</div>
              <div>
                <div style={{ fontSize:13, fontWeight:900, color:'#0f172a', textTransform:'uppercase', letterSpacing:'.25px' }}>Plan de clase</div>
              </div>
            </div>
            <button onClick={() => onIrA?.('planificacion')} style={{
              background:'#fff', border:'1px solid #cbd5e1', color:'#4f46e5',
              borderRadius:8, padding:'8px 13px', fontSize:12, fontWeight:900, cursor:'pointer',
            }}>↔ Ver planificación completa</button>
          </div>

          {/* Intención pedagógica */}
          {diaActivo?.intencionPedagogica && (
            <div style={{
              background:'#fff',
              border:'0',
              borderRadius:0,
              padding:'0 4px',
              marginBottom:16,
            }}>
              <div style={{ fontSize:14, fontWeight:900, color:'#0f172a', marginBottom:8 }}>
                Intención pedagógica del día
              </div>
              <div style={{ fontSize:13.5, color:'#0f172a', lineHeight:1.65 }}>
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
                border:`1px solid ${abierto ? `${c.borde}55` : '#e5e7eb'}`,
                borderRadius:9,
                marginBottom:12,
                overflow:'hidden',
                background: abierto ? c.bg : '#fff',
                transition:'border-color .15s',
              }}>
                <button
                  onClick={() => setMomentoOpen(i)}
                  style={{
                    width:'100%', display:'flex', alignItems:'center', gap:10,
                    padding:'12px 14px',
                    background: abierto ? c.bg : '#fff',
                    border:0,
                    cursor:'pointer', textAlign:'left',
                  }}
                >
                  <span style={{
                    width:22, height:22, borderRadius:6, background:abierto ? c.light : '#f8fafc', color:c.txt,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:13, flexShrink:0,
                  }}>{c.icon}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{
                        fontSize:13,
                        fontWeight:900,
                        color:c.txt,
                        textTransform:'uppercase',
                      }}>{mom.nombre} - {String(mom.tiempo || '').toUpperCase()}</span>
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
                  <span style={{ color:c.txt, fontSize:13, transform: abierto ? 'rotate(180deg)' : 'none', transition:'transform .2s' }}>⌄</span>
                </button>

                {abierto && (
                  <div style={{ padding:'10px 14px 16px', background:'#fff' }}>

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
                        {mom.actividades.map((act, idx) => {
                          const done = checks.has(idx)
                          return (
                            <button key={idx} onClick={() => toggleAct(mom.nombre, idx)} style={{
                              display:'flex', alignItems:'flex-start', gap:10, width:'100%',
                              textAlign:'left', cursor:'pointer',
                              padding:'6px 8px',
                              marginBottom:4,
                              borderRadius:9,
                              background: done ? c.bg : '#fff',
                              border:'0',
                              transition:'all .12s',
                            }}>
                              <span style={{
                                flexShrink:0,
                                width:22,
                                height:22,
                                borderRadius:'50%',
                                border:'0',
                                background:c.badge,
                                display:'flex', alignItems:'center', justifyContent:'center',
                                color:'#fff',
                                fontSize:12,
                                fontWeight:900,
                                marginTop:0,
                                transition:'all .1s',
                              }}>{done ? '✓' : idx + 1}</span>
                              <span style={{
                                fontSize:13.5,
                                lineHeight:1.55,
                                color:'#0f172a',
                                textDecoration:'none',
                              }}>
                                {act}
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
            <div style={{
              display:'grid',
              gridTemplateColumns:'1fr 1fr 1fr',
              gap:10,
              marginTop:14,
            }}>
              <div style={{
                minHeight:50,
                border:'1px solid #e5e7eb',
                borderRadius:8,
                background:'#fff',
                display:'flex',
                alignItems:'center',
                gap:10,
                padding:'0 12px',
              }}>
                <span style={{ width:28, height:28, borderRadius:'50%', background:'#eef2ff', color:'#4f46e5', display:'grid', placeItems:'center' }}>⏱</span>
                <div>
                  <div style={{ fontSize:18, fontWeight:900, color:'#0f172a', lineHeight:1 }}>00:00</div>
                  <div style={{ fontSize:11, color:'#64748b' }}>Tiempo de clase</div>
                </div>
              </div>
              <button onClick={iniciarClase} style={{
                minHeight:50,
                background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
                color:'#fff',
                border:0,
                borderRadius:8,
                padding:'0 14px',
                fontSize:14,
                fontWeight:900,
                cursor:'pointer',
                boxShadow:'0 10px 24px rgba(79,70,229,.28)',
              }}>▶ Iniciar clase</button>
              <button onClick={() => {
                const nextIdx = (momActual.actividades || []).findIndex((_, idx) => !checksActual.has(idx))
                if (nextIdx >= 0) toggleAct(momActual.nombre, nextIdx)
              }} style={{
                minHeight:50,
                background:'#fff',
                color:'#2563eb',
                border:'1px solid #cbd5e1',
                borderRadius:8,
                padding:'0 14px',
                fontSize:13,
                fontWeight:900,
                cursor:'pointer',
              }}>✓ Marcar actividad</button>
            </div>
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
        <div style={{
          overflow:'auto',
          padding:'18px',
          background:'#fff',
          border:'1px solid #e5e7eb',
          borderRadius:12,
          boxShadow:'0 10px 28px rgba(15,23,42,.06)',
          display:'flex',
          flexDirection:'column',
          gap:14,
        }}>

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
                <InstrCard key={inst.id || i} inst={inst} onAplicar={() => abrirInstrumento(inst)} />
              ))
            )}

            {instrumentos.length > 0 && (
              <div style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                background:'#f0fdf4', border:'1px solid #86efac', borderRadius:10, padding:'10px 14px',
              }}>
                <span style={{ fontSize:13, fontWeight:700, color:'#15803d' }}>Puntuación</span>
                <span style={{ fontSize:12, fontWeight:900, color:'#15803d', textAlign:'right' }}>
                  El docente la define al aplicar
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
        <div style={{
          overflow:'auto',
          padding:0,
          background:'transparent',
          border:0,
          borderRadius:0,
          boxShadow:'none',
          display:'flex',
          flexDirection:'column',
          gap:16,
        }}>

          {/* Recursos */}
          <div style={{
            background:'#fff',
            border:'1px solid #e5e7eb',
            borderRadius:12,
            padding:16,
            boxShadow:'0 10px 24px rgba(15,23,42,.06)',
          }}>
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
              <div style={{ display:'grid', gap:8 }}>
                {recursos.map((r, i) => <RecursoItem key={i} tipo={r.tipo} item={r.item} />)}
              </div>
            )}
          </div>

          {/* Banco de Evidencias */}
          <div style={{
            flex:1,
            background:'#fff',
            border:'1px solid #e5e7eb',
            borderRadius:12,
            padding:16,
            boxShadow:'0 10px 24px rgba(15,23,42,.06)',
          }}>
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
        background:'#fff',
        margin:'0 24px 18px',
        border:'1px solid #e5e7eb',
        borderRadius:18,
        padding:'12px 18px',
        display:'flex',
        alignItems:'center',
        gap:18,
        flexShrink:0,
        flexWrap:'wrap',
        boxShadow:'0 10px 28px rgba(15,23,42,.06)',
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
          <div style={{ width:120, height:6, background:'#e5e7eb', borderRadius:3, overflow:'hidden' }}>
            <div style={{
              width:`${pctClase}%`, height:'100%',
              background:'linear-gradient(90deg,#4f46e5,#7c3aed)',
              transition:'width .5s', borderRadius:3,
            }} />
          </div>
          <span style={{ fontSize:13, fontWeight:800, color:'#4f46e5', minWidth:30 }}>{pctClase}%</span>
        </div>

        <div style={{ fontSize:13, color:'#0f172a', fontWeight:800 }}>⏱ {formatTime(timerSeg)}</div>
      </div>
    </div>
  )
}
