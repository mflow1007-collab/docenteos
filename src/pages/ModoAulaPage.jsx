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
import { actualizarPlanificacionDetallada, obtenerPlanificacionesDetalladas, guardarSesionAula } from '../firebase.js'
import { asegurarCapaCurricular, evaluarYRegistrar, obtenerContextoModoAula, obtenerInstrumentosDelDia } from '../services/modoAulaService.js'
import { obtenerClaseDeHoy, crearAspectoId } from '../services/hiloPedagogico.js'
import {
  guardarPaseLista, obtenerAsistenciaCurso, hoyISO, ESTADOS_ASISTENCIA, ETIQUETA_ASISTENCIA,
  guardarSuspension, obtenerSuspensiones, CATEGORIAS_SUSPENSION,
} from '../services/asistenciaService.js'
import { obtenerEstudiantesPorCurso } from '../services/estudiantesService.js'
import { estadoDocencia, diasDocenciaPrevios } from '../data/calendarioEscolarMINERD.js'
import { crearEvidencia } from '../services/evidenciasService.js'

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

function obtenerFasesUnidad(contenido = {}) {
  if (Array.isArray(contenido.fasesSemanales) && contenido.fasesSemanales.length > 0) {
    return contenido.fasesSemanales
  }
  if (Array.isArray(contenido.fases) && contenido.fases.length > 0) {
    return contenido.fases
  }
  return []
}

function obtenerNumeroDia(dia = {}, fallback = 1) {
  return dia.numeroGlobal || dia.dia || dia.numero || dia.numeroDia || fallback
}

function normalizarClase(contenido) {
  if (!contenido) return null
  const meta = contenido.metadatos || {}
  const grado  = [meta.grado, meta.seccion].filter(Boolean).join(' ')
  const area   = meta.area || meta.asignatura || ''
  const fasesUnidad = obtenerFasesUnidad(contenido)

  if (fasesUnidad.length > 0) {
    const dias = []
    fasesUnidad.forEach(fase => {
      ;(fase.dias || []).forEach(dia => {
        const diaNum = obtenerNumeroDia(dia, dias.length + 1)
        dias.push({
          semana:             dia.semana || null,
          diaNum,
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
  'Guía de observación': 100,
  'Registro anecdótico': 100,
}

function nombreEstudiante(estudiante = {}) {
  if (typeof estudiante === 'string') return estudiante
  return estudiante.nombre || estudiante.nombreCompleto || estudiante.name || estudiante.fullName || estudiante.apellidos || ''
}

function detalleEstudiante(estudiante = {}) {
  return [
    estudiante.matricula ? `Matrícula ${estudiante.matricula}` : '',
    estudiante.grado,
    estudiante.seccion ? `Sección ${estudiante.seccion}` : '',
  ].filter(Boolean).join(' · ')
}

function normalizarTipoInstrumento(valor = '') {
  const texto = String(valor).toLowerCase()
  if (texto.includes('rúbrica') || texto.includes('rubrica')) return 'Rúbrica'
  if (texto.includes('cotejo')) return 'Lista de cotejo'
  if (texto.includes('escala') || texto.includes('valoración') || texto.includes('valoracion')) return 'Escala de estimación'
  if (texto.includes('guía') || texto.includes('guia')) return 'Guía de observación'
  if (texto.includes('anecd')) return 'Registro anecdótico'
  return valor || 'Instrumento'
}

function valorInstrumento(tipo) {
  return TIPO_INSTRUMENTO_VALOR[normalizarTipoInstrumento(tipo)] || 100
}

function valorMaximoInstrumento(inst = {}) {
  return Number(inst.valorMaximo || inst.puntos || inst.puntajeMaximo || valorInstrumento(inst.tipo)) || 100
}

function claseCapaDelDia(planActivo, diaActivo) {
  const capa = planActivo?.capaCurricular || null
  if (!capa || diaActivo?.diaNum == null) return null
  return (capa.clases || []).find(c => Number(c.numeroClase) === Number(diaActivo.diaNum)) || null
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

function normalizarInstrumentoAula(inst = {}, contexto = {}) {
  const tipo = normalizarTipoInstrumento(inst.tipo || inst.tipoInstrumento || inst.nombre)
  const valorMaximo = valorMaximoInstrumento({ ...inst, tipo })
  return {
    ...inst,
    planificacionId: inst.planificacionId || contexto.planId || '',
    cursoId: inst.cursoId || contexto.cursoId || '',
    curso: inst.curso || contexto.curso || '',
    grado: inst.grado || contexto.grado || '',
    seccion: inst.seccion || contexto.seccion || '',
    area: inst.area || contexto.area || '',
    periodo: inst.periodo || contexto.periodo || 'Periodo 1',
    competencia: inst.competencia || contexto.competencia || '',
    actividad: inst.actividad || contexto.tema || '',
    unidad: inst.unidad || contexto.unidad || contexto.tema || '',
    tipo,
    nombre: inst.nombre || inst.titulo || `${tipo} - ${contexto.tema || 'Clase'}`,
    puntos: valorMaximo,
    valorMaximo,
    momento: inst.momento || (inst.claseId ? 'Clase actual' : 'Día'),
    indicadores: inst.indicadores?.length
      ? inst.indicadores
      : (inst.estructura?.indicadores || inst.estructura?.criterios || [])
        .map((item, index) => textoCriterio(item, `Criterio ${index + 1}`))
        .filter(Boolean),
  }
}

function combinarInstrumentosAula(instrumentosGuardados = [], instrumentosInferidos = [], contexto = {}) {
  const vistos = new Set()
  const combinados = []
  const agregar = (inst, origen) => {
    const normalizado = normalizarInstrumentoAula({ ...inst, origenAula: origen }, contexto)
    const key = String(normalizado.id || `${normalizado.tipo}-${normalizado.nombre}-${normalizado.claseId || ''}`).toLowerCase()
    if (vistos.has(key)) return
    vistos.add(key)
    combinados.push(normalizado)
  }
  instrumentosGuardados.forEach((inst) => agregar(inst, 'guardado'))
  instrumentosInferidos.forEach((inst) => agregar(inst, 'inferido'))
  return combinados.sort((a, b) => {
    if (a.origenAula !== b.origenAula) return a.origenAula === 'guardado' ? -1 : 1
    return (Number(a.orden) || 99) - (Number(b.orden) || 99)
  })
}

function limpiarTemaRecurso(valor = '') {
  return String(valor || '')
    .replace(/["“”]/g, '')
    .replace(/^exploraci[oó]n del tema:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extraerDetalleVisual(texto = '') {
  const clean = limpiarTemaRecurso(texto)
  const match = clean.match(/(?:de|del|sobre|relacionad[ao]s? con)\s+([^.,;:]+)/i)
  return limpiarTemaRecurso(match?.[1] || clean).slice(0, 90)
}

function recursoInferidoDesdeActividad(texto = '', tema = '') {
  const t = String(texto || '').toLowerCase()
  const contexto = limpiarTemaRecurso(tema) || 'el tema de la clase'
  const detalle = extraerDetalleVisual(texto)
  const busquedaBase = limpiarTemaRecurso([contexto, detalle && detalle !== contexto ? detalle : ''].filter(Boolean).join(' '))
  if (/\b(video|audiovisual|youtube)\b/.test(t)) {
    return {
      tipo: '💻 Tecnológicos',
      item: `Video en YouTube: ${busquedaBase}`,
      accion: 'video',
      busqueda: `${busquedaBase} video educativo corto para clase`,
    }
  }
  if (/\b(imagen|imagenes|lámina|lamina|fotografía|fotografia|ilustración|ilustracion)\b/.test(t)) {
    return {
      tipo: '📦 Didácticos',
      item: `Imágenes específicas: ${busquedaBase}`,
      accion: 'imagenes',
      busqueda: `${busquedaBase} imagenes educativas claras`,
    }
  }
  if (/\b(audio|canción|cancion|escuchan)\b/.test(t)) {
    return {
      tipo: '💻 Tecnológicos',
      item: `Audio específico: ${busquedaBase}`,
      accion: 'audio',
      busqueda: `${busquedaBase} audio educativo`,
    }
  }
  if (/\b(flashcard|tarjeta|tarjetas)\b/.test(t)) {
    return {
      tipo: '📦 Didácticos',
      item: `Tarjetas didácticas: ${busquedaBase}`,
      accion: 'material',
      busqueda: `${busquedaBase} flashcards classroom`,
    }
  }
  return null
}

function extraerRecursos(dia, tema = '') {
  if (!dia) return []
  const seen = new Set()
  const resultado = []
  const push = (tipo, item, extra = {}) => {
    if (!item) return
    const key = `${tipo}-${item}`.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    resultado.push({ tipo, item, ...extra })
  }
  ;(dia.momentos || []).forEach(mom => {
    const r = mom.recursos || {}
    ;[
      { tipo: '👥 Humanos',      val: r.humanos },
      { tipo: '📦 Didácticos',   val: r.didacticos },
      { tipo: '💻 Tecnológicos', val: r.tecnologicos },
    ].forEach(({ tipo, val }) => {
      if (!val) return
      String(val).split(/[,;]/).map(s => s.trim()).filter(Boolean).forEach(item => {
        push(tipo, item)
      })
    })
    ;(mom.actividades || []).forEach((actividad) => {
      const inferido = recursoInferidoDesdeActividad(actividad, tema || dia.titulo)
      if (inferido) push(inferido.tipo, inferido.item, inferido)
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
    const fases = obtenerFasesUnidad(plan.contenido || {})
    for (const fase of fases) {
      const dia = (fase.dias || []).find(d => d.diaCalendario === diaSemanaHoy)
      if (dia) {
        const norm = normalizarClase(plan.contenido)
        const diaFound = norm?.dias.find(d => d.diaNum === obtenerNumeroDia(dia)) || norm?.dias[0]
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

function textoRecursoPreparado(recurso = {}) {
  return [recurso.item, recurso.url ? `(${recurso.url})` : ''].filter(Boolean).join(' ').trim()
}

function recursosPreparadosComoBloque(recursos = []) {
  const didacticos = []
  const tecnologicos = []
  recursos.forEach((recurso) => {
    const texto = textoRecursoPreparado(recurso)
    if (!texto) return
    if (String(recurso.tipo || '').includes('💻') || recurso.accion === 'video' || recurso.accion === 'audio') {
      tecnologicos.push(texto)
      return
    }
    if (!String(recurso.tipo || '').includes('👥')) didacticos.push(texto)
  })
  return {
    didacticos: [...new Set(didacticos)].join(', '),
    tecnologicos: [...new Set(tecnologicos)].join(', '),
  }
}

function aplicarRecursosPreparadosAlDia(contenido = {}, diaNum, recursos = []) {
  const bloque = recursosPreparadosComoBloque(recursos)
  const aplicarMomento = (momento = {}) => ({
    ...momento,
    recursos: {
      ...(momento.recursos || {}),
      humanos: momento.recursos?.humanos || 'Docente y estudiantes',
      didacticos: bloque.didacticos || momento.recursos?.didacticos || '',
      tecnologicos: bloque.tecnologicos || momento.recursos?.tecnologicos || '',
    },
  })
  const actualizarDias = (fase) => ({
    ...fase,
    dias: (fase.dias || []).map((dia) => {
      if (String(obtenerNumeroDia(dia)) !== String(diaNum)) return dia
      return {
        ...dia,
        recursosPreparados: recursos,
        momentos: (dia.momentos || []).map(aplicarMomento),
      }
    }),
  })
  const siguiente = { ...contenido }
  if (Array.isArray(siguiente.fasesSemanales)) {
    siguiente.fasesSemanales = siguiente.fasesSemanales.map(actualizarDias)
  }
  if (Array.isArray(siguiente.fases)) {
    siguiente.fases = siguiente.fases.map(actualizarDias)
  }
  if (siguiente.desarrolloClase && Number(diaNum) === 1) {
    siguiente.desarrolloClase = Object.fromEntries(
      Object.entries(siguiente.desarrolloClase).map(([key, momento]) => [key, aplicarMomento(momento)])
    )
  }
  return siguiente
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
    'Escala de estimación': { bg:'#fef9c3', borde:'#fbbf24', txt:'#92400e' },
    'Guía de observación': { bg:'#fff7ed', borde:'#fb923c', txt:'#c2410c' },
    'Registro anecdótico': { bg:'#f0fdf4', borde:'#4ade80', txt:'#15803d' },
    'Portafolio':        { bg:'#f0fdf4', borde:'#4ade80', txt:'#15803d' },
    'Observación':       { bg:'#fff7ed', borde:'#fb923c', txt:'#c2410c' },
  }
  const c = colores[inst.tipo] || colores[inst.nombre] || { bg:'#f8fafc', borde:'#cbd5e1', txt:'#475569' }
  const maximo = valorMaximoInstrumento(inst)
  const esGuardado = inst.origenAula === 'guardado'
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
            {esGuardado ? 'Instrumento vinculado a esta clase.' : `Evalúa la actividad en el momento ${inst.momento}.`}
          </div>
          <div style={{ fontSize:12, color:'#475569', lineHeight:1.6 }}>
            <div>Tipo: {inst.tipo}</div>
            <div>Puntaje máx.: {maximo}</div>
            {inst.claseId && <div>Clase: {inst.claseId}</div>}
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
        }}>{maximo} pts</div>
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

function RecursoItem({ tipo, item, busqueda, accion, url, onGuardar }) {
  const [editando, setEditando] = useState(false)
  const [tituloLocal, setTituloLocal] = useState(item || '')
  const [busquedaLocal, setBusquedaLocal] = useState(busqueda || '')
  const [urlLocal, setUrlLocal] = useState(url || '')
  const puedePreparar = !tipo.includes('👥')
  const abrirBusquedaRecurso = () => {
    if (urlLocal && /^https?:\/\//i.test(urlLocal)) {
      window.open(urlLocal, '_blank', 'noopener,noreferrer')
      return
    }
    const query = encodeURIComponent(busquedaLocal || tituloLocal || item)
    let url = `https://www.google.com/search?q=${query}`
    if (accion === 'video' || (tipo.includes('💻') && /video/i.test(tituloLocal || item))) {
      url = `https://www.youtube.com/results?search_query=${query}`
    }
    if (accion === 'imagenes' || /imagen/i.test(tituloLocal || item)) {
      url = `https://www.google.com/search?tbm=isch&q=${query}`
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }
  const guardar = () => {
    onGuardar?.({
      tipo,
      item: tituloLocal.trim() || item,
      busqueda: busquedaLocal.trim(),
      accion,
      url: urlLocal.trim(),
      ajustadoPorDocente: true,
      actualizadoEn: new Date().toISOString(),
    })
    setEditando(false)
  }

  return (
    <div style={{
      display:'grid',
      gridTemplateColumns:'auto minmax(0,1fr) auto',
      alignItems:'center',
      gap:8,
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
        {editando ? (
          <div style={{ display:'grid', gap:6 }}>
            <input
              value={tituloLocal}
              onChange={(e) => setTituloLocal(e.target.value)}
              placeholder="Nombre del recurso"
              style={{ width:'100%', border:'1px solid #dbeafe', borderRadius:7, padding:'7px 8px', fontSize:12.5, fontWeight:800 }}
            />
            <input
              value={busquedaLocal}
              onChange={(e) => setBusquedaLocal(e.target.value)}
              placeholder="Búsqueda específica"
              style={{ width:'100%', border:'1px solid #e2e8f0', borderRadius:7, padding:'7px 8px', fontSize:12 }}
            />
            <input
              value={urlLocal}
              onChange={(e) => setUrlLocal(e.target.value)}
              placeholder="URL pegada por el docente, opcional"
              style={{ width:'100%', border:'1px solid #e2e8f0', borderRadius:7, padding:'7px 8px', fontSize:12 }}
            />
          </div>
        ) : (
          <>
            <div style={{ fontSize:13, color:'#0f172a', fontWeight:900, lineHeight:1.2 }}>{tituloLocal || item}</div>
            <div style={{ fontSize:11, color:'#64748b', fontWeight:600, marginTop:2 }}>
              {tipo.replace(/^..\s/, '')}{busquedaLocal ? ` · ${busquedaLocal}` : ''}{urlLocal ? ' · enlace listo' : ''}
            </div>
          </>
        )}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:5, alignItems:'stretch' }}>
        {puedePreparar && (
          <button
            onClick={abrirBusquedaRecurso}
            title="Buscar/preparar este recurso"
            style={{
              flexShrink:0,
              border:'1px solid #bbf7d0',
              background:'#f0fdf4',
              color:'#15803d',
              borderRadius:7,
              padding:'6px 8px',
              fontSize:11,
              fontWeight:900,
              cursor:'pointer',
            }}
          >
            Preparar
          </button>
        )}
        {onGuardar && (
          <button
            onClick={editando ? guardar : () => setEditando(true)}
            title={editando ? 'Guardar recurso en la planificación' : 'Ajustar este recurso'}
            style={{
              flexShrink:0,
              border:'1px solid #c7d2fe',
              background: editando ? '#eef2ff' : '#fff',
              color:'#4f46e5',
              borderRadius:7,
              padding:'6px 8px',
              fontSize:11,
              fontWeight:900,
              cursor:'pointer',
            }}
          >
            {editando ? 'Guardar' : 'Ajustar'}
          </button>
        )}
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

export default function ModoAulaPage({ cursos = [], cursoActivo = null, onIrA, onVerPlanCompleto }) {
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
  const [busquedaEstudianteEv, setBusquedaEstudianteEv] = useState('')
  const [estudianteEv, setEstudianteEv] = useState(null)
  const [guardandoEv, setGuardandoEv] = useState(false)
  const [errorEv, setErrorEv] = useState('')

  // ── Coach IA
  const [coachSug, setCoachSug] = useState(null)
  const [coachAct, setCoachAct] = useState(null)

  // ── Cierre
  const [notasDocente, setNotasDocente] = useState('')
  const [guardandoFin, setGuardandoFin] = useState(false)
  const [finOk,        setFinOk]        = useState(false)
  const [guardandoRecursos, setGuardandoRecursos] = useState(false)

  // ── Aplicación de instrumentos
  const [instrumentosGuardadosDia, setInstrumentosGuardadosDia] = useState([])
  const [cargandoInstrumentosDia, setCargandoInstrumentosDia] = useState(false)
  const [instrumentoModal, setInstrumentoModal] = useState(null)
  const [notasInstrumento, setNotasInstrumento] = useState({})
  const [puntajeInstrumento, setPuntajeInstrumento] = useState(100)
  const [obsInstrumento,   setObsInstrumento]   = useState('')
  const [guardandoInstrumento, setGuardandoInstrumento] = useState(false)
  const [mensajeInstrumento,   setMensajeInstrumento]   = useState(null)

  // ── Hilo pedagógico: clase de hoy / próxima desde la capa curricular
  const [avisoClase, setAvisoClase] = useState(null)

  // ─── Cargar desde Firestore (actualiza sobre localStorage)
  useEffect(() => {
    obtenerPlanificacionesDetalladas()
      .then(res => { if (res.success && Array.isArray(res.data) && res.data.length > 0) setPlanes(res.data) })
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [])

  // ─── Auto-detección del plan del día.
  // Fase 10: el camino PRINCIPAL es obtenerContextoModoAula (planificación
  // activa + capa curricular + clase de hoy/próxima). La detección propia
  // legacy (detectarPlanHoy) queda solo como fallback para planes sin capa.
  useEffect(() => {
    if (!planes.length) { setCargando(false); return }
    let vigente = true
    ;(async () => {
      let det = null
      try {
        const ctx = await obtenerContextoModoAula(cursoActivo?.id || '', undefined, { planes })
        if (ctx?.plan && ctx?.clase && ctx.plan.capaCurricular) {
          const norm = normalizarClase(ctx.plan.contenido)
          const dia = norm?.dias.find(d => d.diaNum === ctx.clase.numeroClase) || norm?.dias[0]
          det = { plan: ctx.plan, norm, dia }
          setInstrumentosGuardadosDia(Array.isArray(ctx.instrumentos) ? ctx.instrumentos : [])
          setAvisoClase(ctx.esHoy ? null : {
            motivo: ctx.motivo,
            fecha: ctx.clase.fechaSugerida || '',
            titulo: ctx.clase.titulo || `Clase ${ctx.clase.numeroClase}`,
          })
        }
      } catch (error) {
        console.warn('[ModoAula] Contexto del hilo no disponible, usando detección legacy:', error)
      }
      if (!det) det = detectarPlanHoy(planes)
      if (!vigente || !det) return
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
    })()
    return () => { vigente = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planes])

  // ─── Hilo pedagógico: backfill lazy de la capa curricular + clase de hoy.
  // Si hoy no hay clase planificada se muestra la PRÓXIMA pendiente con aviso
  // (caso borde Fase 6: nunca pantalla vacía).
  useEffect(() => {
    let vigente = true
    const plan = planActivo
    if (!plan?.id || String(plan.id).startsWith('local_')) return
    ;(async () => {
      const conCapa = plan.capaCurricular ? plan : await asegurarCapaCurricular(plan)
      if (!vigente) return
      const capa = conCapa?.capaCurricular
      if (!capa) { setAvisoClase(null); return }
      if (!plan.capaCurricular) setPlanActivo(conCapa)

      const { clase, esHoy, motivo } = obtenerClaseDeHoy(capa)
      if (!clase) { setAvisoClase(null); return }
      setAvisoClase(esHoy ? null : {
        motivo,
        fecha: clase.fechaSugerida || '',
        titulo: clase.titulo || `Clase ${clase.numeroClase}`,
      })
      // Alinear el día mostrado con la clase de hoy / próxima (si difiere)
      if (claseNorm?.dias?.length && diaActivo?.diaNum !== clase.numeroClase) {
        const diaObjetivo = claseNorm.dias.find(d => d.diaNum === clase.numeroClase)
        if (diaObjetivo) setDiaActivo(diaObjetivo)
      }
    })()
    return () => { vigente = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planActivo?.id])

  useEffect(() => {
    let vigente = true
    const claseCapa = claseCapaDelDia(planActivo, diaActivo)
    if (!planActivo?.id || !claseCapa?.claseId || String(planActivo.id).startsWith('local_')) {
      setInstrumentosGuardadosDia([])
      setCargandoInstrumentosDia(false)
      return () => { vigente = false }
    }
    setCargandoInstrumentosDia(true)
    obtenerInstrumentosDelDia(planActivo.id, claseCapa.claseId)
      .then((items) => {
        if (vigente) setInstrumentosGuardadosDia(Array.isArray(items) ? items : [])
      })
      .catch((error) => {
        console.warn('[ModoAula] No se pudieron cargar instrumentos de la clase:', error)
        if (vigente) setInstrumentosGuardadosDia([])
      })
      .finally(() => {
        if (vigente) setCargandoInstrumentosDia(false)
      })
    return () => { vigente = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planActivo?.id, planActivo?.capaCurricular, diaActivo?.diaNum])

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
    setInstrumentosGuardadosDia([])
    setInstrumentoModal(null)
    setMensajeInstrumento(null)
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
  const agregarEvidencia = async () => {
    if (!inputEvidencia.trim() || !planActivo || diaActivo?.diaNum == null || guardandoEv) return
    if (!estudianteEv?.id) {
      setErrorEv('Selecciona un estudiante del curso actual antes de guardar la evidencia.')
      return
    }
    const cursoId = cursoParaAula?.id || ''
    if (!cursoId) {
      setErrorEv('No pude identificar el curso activo. Cambia o abre la planificación desde su curso.')
      return
    }
    setGuardandoEv(true)
    setErrorEv('')
    const ahora = new Date()
    const capa = planActivo?.capaCurricular || null
    const claseCapa = capa?.clases?.find(c => c.numeroClase === diaActivo?.diaNum) || null
    const indicadorIds = claseCapa?.indicadoresTrabajados
      || (capa?.indicadoresSeleccionados || []).map(ind => ind.id).filter(Boolean)
    const evidenciaId = `modo-aula-${ahora.getTime()}`
    const ev = {
      id: evidenciaId,
      evidenciaId,
      texto: inputEvidencia.trim(),
      descripcion: inputEvidencia.trim(),
      categoria: categoriaEv,
      tipo: categoriaEv,
      origen: 'modo_aula',
      estudianteId: estudianteEv.id,
      estudianteNombre: estudianteEv.nombre,
      estudianteMatricula: estudianteEv.matricula || '',
      cursoId,
      curso: cursoParaAula?.nombre || cursoParaAula?.name || cursoParaAula?.grado || '',
      grado: claseNorm?.grado || cursoParaAula?.grado || estudianteEv.grado || '',
      seccion: cursoParaAula?.seccion || estudianteEv.seccion || '',
      area: claseNorm?.area || '',
      planificacionId: planActivo.id,
      planId: planActivo.id,
      claseId: claseCapa?.claseId || `${planActivo.id}-dia-${diaActivo.diaNum}`,
      claseTitulo: diaActivo?.titulo || '',
      temaUnidad: claseNorm?.tituloUnidad || '',
      diaNum: diaActivo.diaNum,
      semana: diaActivo.semana || null,
      fecha: ahora.toISOString(),
      hora: ahora.toLocaleTimeString('es-DO', { hour:'2-digit', minute:'2-digit' }),
      momento: diaActivo.momentos?.[momentoOpen]?.nombre || '',
      indicadorIds,
      indicadoresRelacionados: diaActivo?.criteriosExito || [],
    }
    try {
      const guardada = await crearEvidencia(ev)
      const arr = [guardada || ev, ...evidencias]
      setEvidencias(arr)
      guardarEvidenciasLocal(planActivo.id, diaActivo.diaNum, arr)
      setInputEvidencia('')
      setBusquedaEstudianteEv('')
      setEstudianteEv(null)
      setAgregandoEv(false)
    } catch (error) {
      console.error('[ModoAula] No se pudo guardar la evidencia:', error)
      const arr = [{ ...ev, pendienteSync: true }, ...evidencias]
      setEvidencias(arr)
      guardarEvidenciasLocal(planActivo.id, diaActivo.diaNum, arr)
      setInputEvidencia('')
      setBusquedaEstudianteEv('')
      setEstudianteEv(null)
      setErrorEv('La evidencia quedó guardada localmente, pero no pude sincronizarla con Firestore todavía.')
    } finally {
      setGuardandoEv(false)
    }
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
      evidencias: evidencias.map(e => ({
        texto: e.texto,
        categoria: e.categoria,
        hora: e.hora,
        estudianteId: e.estudianteId || '',
        estudianteNombre: e.estudianteNombre || '',
      })),
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
  // Los estudiantes REALES viven en usuarios/{uid}/estudiantes (subcolección);
  // el curso solo a veces los trae embebidos. Sin este fallback, el pase de
  // lista no aparecía para cursos sin estudiantesDetalle.
  const [estudiantesSub, setEstudiantesSub] = useState([])
  useEffect(() => {
    let vigente = true
    setEstudiantesSub([])
    const embebidos = (cursoParaAula?.estudiantesDetalle?.length || 0)
      + (cursoParaAula?.estudiantesLista?.length || 0)
      + (cursoParaAula?.estudiantesNombres?.length || 0)
    if (!cursoParaAula?.id || embebidos > 0) return undefined
    obtenerEstudiantesPorCurso(cursoParaAula.id)
      .then((lista) => { if (vigente) setEstudiantesSub(Array.isArray(lista) ? lista : []) })
      .catch(() => {})
    return () => { vigente = false }
  }, [cursoParaAula?.id, cursoParaAula?.estudiantesDetalle?.length, cursoParaAula?.estudiantesLista?.length, cursoParaAula?.estudiantesNombres?.length])

  const estudiantesAula = useMemo(() => {
    // Chequeo por LONGITUD: un array vacío embebido no debe tapar la subcolección
    const fuente = cursoParaAula?.estudiantesDetalle?.length ? cursoParaAula.estudiantesDetalle
      : cursoParaAula?.estudiantesLista?.length ? cursoParaAula.estudiantesLista
      : cursoParaAula?.estudiantesNombres?.length ? cursoParaAula.estudiantesNombres
      : estudiantesSub
    return fuente
      .map((estudiante, index) => ({
        id: estudiante?.id || estudiante?.matricula || `est-${index + 1}`,
        nombre: nombreEstudiante(estudiante) || `Estudiante ${index + 1}`,
        matricula: estudiante?.matricula || estudiante?.codigo || estudiante?.codigoEstudiante || '',
        grado: estudiante?.grado || claseNorm?.grado || cursoParaAula?.grado || '',
        seccion: estudiante?.seccion || cursoParaAula?.seccion || '',
      }))
      .filter((estudiante) => estudiante.nombre)
  }, [cursoParaAula, claseNorm?.grado, estudiantesSub])

  // ═══ PASE DE LISTA (HITO 3.1) — asistencia real del día, por curso.
  // Consciente del calendario escolar: solo invita a pasar lista en días de
  // docencia, alerta si hoy falta, y recuerda días recientes sin lista.
  const [paseLista, setPaseLista] = useState({})              // estId → estado
  const [paseListaAbierto, setPaseListaAbierto] = useState(false)
  const [paseListaGuardando, setPaseListaGuardando] = useState(false)
  const [paseListaMsg, setPaseListaMsg] = useState('')
  const [listaFaltantes, setListaFaltantes] = useState([])    // días de docencia recientes sin lista
  const docenciaHoy = useMemo(() => estadoDocencia(hoyISO()), [])
  // Nivel del curso: define el MODO del pase de lista según la norma MINERD —
  // Primaria/Inicial: registro GENERAL del día, una sola vez en la primera
  // hora (docente de aula). Secundaria: cada docente pasa lista en SU clase.
  const nivelCursoAula = useMemo(() => {
    const txt = normalizarClave([cursoParaAula?.nivel, cursoParaAula?.grado, cursoParaAula?.nombre, cursoParaAula?.name].filter(Boolean).join(' '))
    if (txt.includes('primaria')) return 'Primaria'
    if (txt.includes('secundaria')) return 'Secundaria'
    if (txt.includes('inicial') || txt.includes('kinder') || txt.includes('preprimario')) return 'Inicial'
    return ''
  }, [cursoParaAula])
  const notaNivelPaseLista = nivelCursoAula === 'Primaria' || nivelCursoAula === 'Inicial'
    ? 'Registro general del día — se pasa una sola vez, en la primera hora'
    : nivelCursoAula === 'Secundaria'
      ? 'En Secundaria cada docente pasa la lista de su clase'
      : 'Se registra una lista por curso cada día de docencia'
  // Suspensiones de docencia (ADP, cooperativa, fenómeno atmosférico): del día
  // del docente, cubren todos sus cursos. Marcables hoy o retroactivamente.
  const [suspensiones, setSuspensiones] = useState([])
  const [suspForm, setSuspForm] = useState(null)              // { fecha, categoria, motivo } | null
  const [suspGuardando, setSuspGuardando] = useState(false)
  const suspensionHoy = useMemo(
    () => suspensiones.find((s) => s.fecha === hoyISO()) || null,
    [suspensiones]
  )
  useEffect(() => {
    let vigente = true
    setPaseLista({})
    setPaseListaMsg('')
    setListaFaltantes([])
    if (!cursoParaAula?.id) return undefined
    Promise.all([obtenerAsistenciaCurso(cursoParaAula.id), obtenerSuspensiones()]).then(([dias, susp]) => {
      if (!vigente) return
      setSuspensiones(susp)
      const hoy = hoyISO()
      const deHoy = dias.find((d) => d.fecha === hoy)
      if (deHoy?.marcas) {
        setPaseLista(deHoy.marcas)
        setPaseListaMsg(`Lista de hoy ya guardada (${Object.keys(deHoy.marcas).length} estudiantes) — puedes corregirla.`)
      }
      // Recordatorio de olvidos: solo si el docente YA usa el pase de lista
      // (sin historial no se le reclama nada), solo días de docencia reales,
      // y sin contar los días marcados como suspendidos (ADP, ciclón…).
      if (dias.length) {
        const cubiertos = new Set([...dias.map((d) => d.fecha), ...susp.map((s) => s.fecha)])
        setListaFaltantes(diasDocenciaPrevios(hoy, 7).filter((f) => !cubiertos.has(f)))
      }
    })
    return () => { vigente = false }
  }, [cursoParaAula?.id])

  const guardarSuspensionDia = async () => {
    if (!suspForm?.fecha || suspGuardando) return
    setSuspGuardando(true)
    try {
      const guardada = await guardarSuspension(suspForm)
      setSuspensiones((prev) => [guardada, ...prev.filter((s) => s.fecha !== guardada.fecha)])
      setListaFaltantes((prev) => prev.filter((f) => f !== guardada.fecha))
      setPaseListaMsg(`✓ ${guardada.fecha === hoyISO() ? 'Hoy quedó' : `El ${guardada.fecha} quedó`} marcado sin docencia: ${guardada.etiqueta}.`)
      setSuspForm(null)
    } catch (e) {
      setPaseListaMsg(`❌ ${e.message}`)
    } finally {
      setSuspGuardando(false)
    }
  }

  const guardarListaDeHoy = async () => {
    if (!cursoParaAula?.id || paseListaGuardando) return
    setPaseListaGuardando(true)
    setPaseListaMsg('')
    try {
      const r = await guardarPaseLista({ cursoId: cursoParaAula.id, marcas: paseLista })
      setPaseListaMsg(`✓ Guardada: ${r.resumen.presente} presente(s) · ${r.resumen.tarde} tardanza(s) · ${r.resumen.excusa} excusa(s) · ${r.resumen.ausente} ausente(s).`)
    } catch (e) {
      setPaseListaMsg(`❌ ${e.message}`)
    } finally {
      setPaseListaGuardando(false)
    }
  }

  const sugerenciasEstudiantesEv = useMemo(() => {
    const q = normalizarClave(busquedaEstudianteEv)
    if (!q) return estudiantesAula.slice(0, 6)
    return estudiantesAula
      .filter((estudiante) => {
        const nombre = normalizarClave(estudiante.nombre)
        const tokens = nombre.split(' ').filter(Boolean)
        const detalle = normalizarClave([estudiante.nombre, estudiante.matricula, estudiante.grado, estudiante.seccion].filter(Boolean).join(' '))
        return nombre.startsWith(q) || tokens.some(token => token.startsWith(q)) || detalle.includes(q)
      })
      .slice(0, 8)
  }, [busquedaEstudianteEv, estudiantesAula])
  const contextoInstrumentos = useMemo(() => ({
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
  }), [diaActivo?.titulo, planActivo, claseNorm, cursoParaAula, periodoRegistro])
  const instrumentos = useMemo(() => {
    const inferidos = extraerInstrumentos(diaActivo, contextoInstrumentos)
    return combinarInstrumentosAula(instrumentosGuardadosDia, inferidos, contextoInstrumentos)
  }, [diaActivo, contextoInstrumentos, instrumentosGuardadosDia])
  const recursos     = useMemo(() => {
    const diaKey = String(diaActivo?.diaNum || 1)
    const ajustados = planActivo?.contenido?.recursosModoAula?.[diaKey]
    if (Array.isArray(ajustados) && ajustados.length) return ajustados
    return extraerRecursos(diaActivo, diaActivo?.titulo || claseNorm?.tituloUnidad || '')
  }, [diaActivo, claseNorm?.tituloUnidad, planActivo?.contenido?.recursosModoAula])
  const momentos     = diaActivo?.momentos || []
  const totalActs    = momentos.reduce((s, m) => s + (m.actividades?.length || 0), 0)
  const hechas       = Object.values(actChecks).reduce((s, set) => s + set.size, 0)
  const pctClase     = totalActs > 0 ? Math.round(hechas / totalActs * 100) : 0
  const momActual    = momentos[momentoOpen] || {}
  const checksActual = actChecks[momActual.nombre] || new Set()
  const abrirInstrumento = (inst) => {
    const baseNotas = Object.fromEntries(estudiantesAula.map((estudiante) => [estudiante.id, '']))
    setNotasInstrumento(baseNotas)
    setPuntajeInstrumento(Math.min(100, Math.max(1, Number(inst.valorMaximo || inst.puntos || 100))))
    setObsInstrumento('')
    setMensajeInstrumento(null)
    setInstrumentoModal(inst)
  }

  const guardarRecursoPlan = async (index, recursoActualizado) => {
    if (!planActivo?.id || diaActivo?.diaNum == null || guardandoRecursos) return
    const diaKey = String(diaActivo.diaNum)
    const nuevosRecursos = recursos.map((recurso, i) => (i === index ? { ...recurso, ...recursoActualizado } : recurso))
    const contenidoConRecursos = aplicarRecursosPreparadosAlDia(planActivo.contenido || {}, diaActivo.diaNum, nuevosRecursos)
    const contenidoActualizado = {
      ...contenidoConRecursos,
      recursosModoAula: {
        ...(contenidoConRecursos.recursosModoAula || {}),
        [diaKey]: nuevosRecursos,
      },
    }
    const planActualizado = { ...planActivo, contenido: contenidoActualizado }
    setGuardandoRecursos(true)
    setPlanActivo(planActualizado)
    setPlanes(prev => prev.map((plan) => String(plan.id) === String(planActivo.id) ? planActualizado : plan))
    try {
      await actualizarPlanificacionDetallada(planActivo.id, { contenido: contenidoActualizado })
    } catch (error) {
      console.error('[ModoAula] No se pudo actualizar el recurso en la planificación:', error)
    } finally {
      setGuardandoRecursos(false)
    }
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
    try {
      // Enriquecer el instrumento del día con el vínculo curricular del plan
      // (indicadores y aspectos del registro) para el hilo pedagógico completo.
      const capa = planActivo?.capaCurricular || null
      const claseCapa = claseCapaDelDia(planActivo, diaActivo)
      const indicadorIds = claseCapa?.indicadoresTrabajados
        || (capa?.indicadoresSeleccionados || []).map(ind => ind.id)
      const valorMaximoModal = Number(puntajeInstrumento || instrumentoModal.valorMaximo || instrumentoModal.puntos || 100)
      const instrumentoHilo = {
        ...instrumentoModal,
        cursoId: cursoParaAula?.id || instrumentoModal.cursoId,
        curso: cursoParaAula?.nombre || cursoParaAula?.name || instrumentoModal.curso || '',
        planificacionId: planActivo?.id || instrumentoModal.planificacionId || '',
        claseId: instrumentoModal.claseId || claseCapa?.claseId || '',
        periodo: instrumentoModal.periodo || periodoRegistro,
        valorMaximo: valorMaximoModal,
        indicadorIds,
        aspectoRegistroIds: planActivo?.id
          ? indicadorIds.map(id => crearAspectoId(planActivo.id, id))
          : [],
        indicadores: instrumentoModal.indicadores?.length
          ? instrumentoModal.indicadores
          : (capa?.indicadoresSeleccionados || []).map(ind => ind.descripcion),
      }

      const { exitosos, errores } = await evaluarYRegistrar({
        instrumento: instrumentoHilo,
        claseTitulo: diaActivo?.titulo || '',
        aplicaciones: aplicaciones.map(({ estudiante, puntos }) => ({
          estudianteId: estudiante.id,
          estudianteNombre: estudiante.nombre,
          puntajeObtenido: puntos,
          estado: 'evaluado',
          observacionDocente: obsInstrumento,
        })),
      })

      if (errores.length) {
        setMensajeInstrumento({
          tipo: 'error',
          texto: `${exitosos.length} guardado(s), ${errores.length} con error: ${errores[0].mensaje}`,
        })
        setGuardandoInstrumento(false)
        return
      }

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
      setMensajeInstrumento({ tipo:'ok', texto:'Evaluación registrada: resultado guardado, Mi Registro actualizado y evidencias creadas.' })
    } catch (error) {
      console.error('[ModoAula] Error en evaluar y registrar:', error)
      setMensajeInstrumento({ tipo:'error', texto:`No se pudo guardar: ${error.message || 'revisa la conexión e intenta otra vez.'}` })
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
              <Pill color="#0369a1" bg="#e0f2fe">{diaActivo?.semana ? `Semana ${diaActivo.semana} · ` : ''}Clase {diaActivo?.diaNum || '—'}</Pill>
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
    <div className="modo-aula-workspace" style={{
      display:'flex',
      flexDirection:'column',
      minHeight:'calc(100vh - 92px)',
      overflow:'auto',
      background:'#f7f8fc',
      color:'#0f172a',
    }}>
      {SelectorModal}
      {InstrumentoModal}

      {/* ══ AVISO: hoy no hay clase planificada → se muestra la próxima ══ */}
      {avisoClase && (
        <div className="modo-aula-aviso" style={{
          margin:'16px 24px 0',
          padding:'10px 18px',
          background:'#fffbeb',
          border:'1px solid #fcd34d',
          borderRadius:12,
          color:'#92400e',
          fontSize:13,
          fontWeight:700,
          display:'flex',
          alignItems:'center',
          gap:8,
        }}>
          <span>📅</span>
          <span>
            {avisoClase.motivo === 'proxima' && `Hoy no hay clase planificada en este plan. Mostrando la próxima clase pendiente: "${avisoClase.titulo}"${avisoClase.fecha ? ` (${avisoClase.fecha})` : ''}.`}
            {avisoClase.motivo === 'ultima' && `Este plan ya no tiene clases pendientes. Mostrando la última clase: "${avisoClase.titulo}"${avisoClase.fecha ? ` (${avisoClase.fecha})` : ''}.`}
            {avisoClase.motivo === 'sin-fechas' && `El plan no tiene fechas asignadas. Mostrando la primera clase: "${avisoClase.titulo}".`}
          </span>
        </div>
      )}

      {/* ══ RESUMEN DE LA CLASE ══ */}
      <div className="modo-aula-resumen-clase" style={{
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
      </div>

      {/* ══ TIMELINE MOMENTOS ══ */}
      <div className="modo-aula-timeline" style={{
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
        <div style={{ width:36, height:2, background:'#cbd5e1', flexShrink:0 }} />
        <button
          type="button"
          onClick={estadoClase !== 'finalizada' ? finalizarClase : undefined}
          disabled={estadoClase === 'finalizada' || guardandoFin}
          title={estadoClase === 'finalizada' ? 'Clase finalizada' : 'Finalizar y guardar clase'}
          style={{
          display:'flex',
          alignItems:'center',
          gap:8,
          padding:'13px 22px',
          color: estadoClase === 'finalizada' ? '#15803d' : '#fff',
          border: estadoClase === 'finalizada' ? '1px solid #86efac' : '1px solid #e5e7eb',
          borderRadius:999,
          background: estadoClase === 'finalizada'
              ? '#f0fdf4'
              : 'linear-gradient(135deg,#16a34a,#15803d)',
          fontSize:12,
          fontWeight:800,
          minWidth:180,
          justifyContent:'center',
          cursor: estadoClase !== 'finalizada' && !guardandoFin ? 'pointer' : 'default',
          boxShadow: estadoClase !== 'finalizada' ? '0 8px 20px rgba(21,128,61,.22)' : 'none',
        }}
        >
          {guardandoFin ? '⏳ Guardando…' : estadoClase === 'finalizada' ? '✓ Finalizada' : '🏁 Finalizar'}
        </button>
        <button
          type="button"
          onClick={() => setMostrarSelector(true)}
          title="Cambiar planificación"
          style={{
            display:'flex',
            alignItems:'center',
            justifyContent:'center',
            gap:8,
            padding:'13px 20px',
            color:'#4f46e5',
            border:'1px solid #c7d2fe',
            borderRadius:999,
            background:'#fff',
            fontSize:12,
            fontWeight:900,
            minWidth:190,
            cursor:'pointer',
            boxShadow:'inset 0 0 0 1px rgba(79,70,229,.04)',
            marginLeft:10,
            flexShrink:0,
          }}
        >
          ⇄ Cambiar planificación
        </button>
      </div>

      {/* ══ PASE DE LISTA (HITO 3.1) ══ */}
      {estudiantesAula.length > 0 && (
        <div className="modo-aula-pase-lista" style={{ background:'#eff6ff', border:'1px solid #93c5fd', borderRadius:12, margin:'0 24px 14px', boxShadow:'0 10px 24px rgba(37,99,235,.12)', flexShrink:0 }}>
          <button
            type="button"
            onClick={() => setPaseListaAbierto((v) => !v)}
            style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, padding:'12px 18px', background:'transparent', border:0, cursor:'pointer', fontSize:13, fontWeight:900, color:'#1e3a8a', textAlign:'left' }}
          >
            <span style={{ display:'flex', flexDirection:'column', gap:2 }}>
              <span>🙋 Pase de lista — {new Date().toLocaleDateString('es-DO', { weekday:'long', day:'numeric', month:'long' })}</span>
              <small style={{ fontSize:11, fontWeight:600, color:'#3b82f6' }}>{notaNivelPaseLista}</small>
            </span>
            <span style={{
              fontSize:12, fontWeight:800,
              color: !docenciaHoy.docencia || suspensionHoy ? '#64748b'
                : Object.keys(paseLista).length === estudiantesAula.length ? '#15803d'
                : Object.keys(paseLista).length ? '#64748b' : '#dc2626',
            }}>
              {suspensionHoy ? '🚫 Docencia suspendida hoy'
                : !docenciaHoy.docencia ? '📅 Hoy no hay docencia'
                : Object.keys(paseLista).length ? `${Object.keys(paseLista).length}/${estudiantesAula.length} marcados`
                : '⚠️ Falta pasar lista hoy'} {paseListaAbierto ? '▲' : '▼'}
            </span>
          </button>
          {listaFaltantes.length > 0 && (
            <div style={{ margin:'0 18px 10px', padding:'8px 12px', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:8, fontSize:12, fontWeight:600, color:'#92400e' }}>
              📌 Falta pasar lista de días de docencia recientes:{' '}
              {listaFaltantes.map((f) => (
                <span key={f} style={{ display:'inline-flex', alignItems:'center', gap:4, marginRight:8 }}>
                  {new Date(`${f}T12:00:00`).toLocaleDateString('es-DO', { weekday:'short', day:'numeric', month:'short' })}
                  <button
                    type="button"
                    title="Ese día no hubo docencia (ADP, ciclón…): márcalo y queda como nota en el Registro"
                    onClick={() => setSuspForm({ fecha: f, categoria: 'asamblea_adp', motivo: '' })}
                    style={{ border:'1px solid #fcd34d', background:'#fff', color:'#92400e', borderRadius:6, fontSize:10.5, fontWeight:800, padding:'2px 7px', cursor:'pointer' }}
                  >
                    🚫 sin docencia
                  </button>
                </span>
              ))}
            </div>
          )}
          {suspForm && (
            <div style={{ margin:'0 18px 12px', padding:'10px 14px', background:'#fff', border:'1px solid #93c5fd', borderRadius:8, display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
              <strong style={{ fontSize:12, color:'#1e3a8a' }}>
                🚫 Sin docencia el {new Date(`${suspForm.fecha}T12:00:00`).toLocaleDateString('es-DO', { weekday:'long', day:'numeric', month:'long' })}:
              </strong>
              <select
                value={suspForm.categoria}
                onChange={(e) => setSuspForm((p) => ({ ...p, categoria: e.target.value }))}
                style={{ fontSize:12, padding:'6px 8px', borderRadius:6, border:'1px solid #cbd5e1' }}
              >
                {Object.entries(CATEGORIAS_SUSPENSION).map(([valor, etiqueta]) => (
                  <option key={valor} value={valor}>{etiqueta}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Detalle opcional (ej. huracán Melissa)"
                value={suspForm.motivo}
                onChange={(e) => setSuspForm((p) => ({ ...p, motivo: e.target.value }))}
                style={{ fontSize:12, padding:'6px 8px', borderRadius:6, border:'1px solid #cbd5e1', minWidth:200 }}
              />
              <button
                type="button"
                onClick={guardarSuspensionDia}
                disabled={suspGuardando}
                style={{ padding:'6px 14px', borderRadius:999, border:0, background:'#1e3a8a', color:'#fff', fontSize:12, fontWeight:800, cursor:'pointer' }}
              >
                {suspGuardando ? '⏳…' : 'Guardar'}
              </button>
              <button
                type="button"
                onClick={() => setSuspForm(null)}
                style={{ padding:'6px 10px', borderRadius:999, border:'1px solid #cbd5e1', background:'#fff', color:'#64748b', fontSize:12, fontWeight:700, cursor:'pointer' }}
              >
                Cancelar
              </button>
            </div>
          )}
          {paseListaAbierto && suspensionHoy && (
            <div style={{ margin:'0 18px 14px', padding:'10px 14px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:8, fontSize:12.5, color:'#475569' }}>
              🚫 Hoy no hubo docencia: <strong>{suspensionHoy.etiqueta}</strong>
              {suspensionHoy.motivo ? ` — ${suspensionHoy.motivo}` : ''}. Quedará como nota en el Registro de asistencia.
            </div>
          )}
          {paseListaAbierto && !docenciaHoy.docencia && !suspensionHoy && (
            <div style={{ margin:'0 18px 14px', padding:'10px 14px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:8, fontSize:12.5, color:'#475569' }}>
              📅 {docenciaHoy.motivo}{docenciaHoy.estimado ? ' (receso estimado — pendiente del calendario oficial)' : ''}. El pase de lista se activa los días de docencia.
            </div>
          )}
          {paseListaAbierto && docenciaHoy.docencia && !suspensionHoy && (
            <div style={{ padding:'0 18px 14px' }}>
              <div style={{ display:'flex', gap:8, marginBottom:10, flexWrap:'wrap', alignItems:'center' }}>
                <button
                  type="button"
                  onClick={() => setPaseLista(Object.fromEntries(estudiantesAula.map((e) => [e.id, 'presente'])))}
                  style={{ padding:'7px 14px', borderRadius:999, border:'1px solid #bbf7d0', background:'#f0fdf4', color:'#15803d', fontSize:12, fontWeight:800, cursor:'pointer' }}
                >
                  ✓ Todos presentes
                </button>
                <button
                  type="button"
                  onClick={guardarListaDeHoy}
                  disabled={paseListaGuardando || !Object.keys(paseLista).length}
                  style={{ padding:'7px 16px', borderRadius:999, border:'1px solid #c7d2fe', background: paseListaGuardando ? '#eef2ff' : 'linear-gradient(135deg,#4f46e5,#4338ca)', color: paseListaGuardando ? '#4f46e5' : '#fff', fontSize:12, fontWeight:800, cursor: paseListaGuardando ? 'default' : 'pointer' }}
                >
                  {paseListaGuardando ? '⏳ Guardando…' : '💾 Guardar lista'}
                </button>
                <button
                  type="button"
                  title="Asamblea/actividad ADP, cooperativa, fenómeno atmosférico… El día queda anotado en el Registro."
                  onClick={() => setSuspForm({ fecha: hoyISO(), categoria: 'asamblea_adp', motivo: '' })}
                  style={{ padding:'7px 14px', borderRadius:999, border:'1px solid #fecaca', background:'#fef2f2', color:'#b91c1c', fontSize:12, fontWeight:800, cursor:'pointer' }}
                >
                  🚫 Hoy no hubo docencia…
                </button>
                {paseListaMsg && <small style={{ fontSize:12, color: paseListaMsg.startsWith('❌') ? '#dc2626' : '#15803d', fontWeight:600 }}>{paseListaMsg}</small>}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(250px, 1fr))', gap:6 }}>
                {estudiantesAula.map((est) => (
                  <div key={est.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, background:'#fff', border:'1px solid #dbeafe', borderRadius:8, padding:'6px 10px' }}>
                    <span style={{ fontSize:12.5, fontWeight:600, color:'#0f172a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{est.nombre}</span>
                    <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                      {ESTADOS_ASISTENCIA.map((estado) => {
                        const activo = paseLista[est.id] === estado
                        const color = { presente:'#16a34a', tarde:'#d97706', excusa:'#2563eb', ausente:'#dc2626' }[estado]
                        return (
                          <button
                            key={estado}
                            type="button"
                            title={ETIQUETA_ASISTENCIA[estado]}
                            onClick={() => setPaseLista((prev) => ({ ...prev, [est.id]: estado }))}
                            style={{ width:26, height:26, borderRadius:6, border:`1px solid ${activo ? color : '#e2e8f0'}`, background: activo ? color : '#fff', color: activo ? '#fff' : '#64748b', fontSize:11, fontWeight:900, cursor:'pointer' }}
                          >
                            {ETIQUETA_ASISTENCIA[estado][0]}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ WORKSPACE 3 COLUMNAS ══ */}
      <div className="modo-aula-grid" style={{
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
        <div className="modo-aula-panel modo-aula-plan-panel" style={{
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
            <button onClick={() => onVerPlanCompleto ? onVerPlanCompleto(planActivo) : onIrA?.('planificacion')} style={{
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
        <div className="modo-aula-panel modo-aula-middle-panel" style={{
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

            {cargandoInstrumentosDia ? (
              <div style={{ textAlign:'center', padding:'20px 0', color:'#64748b', fontSize:12, fontWeight:800 }}>
                Cargando instrumentos de esta clase…
              </div>
            ) : instrumentos.length === 0 ? (
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
                  {instrumentosGuardadosDia.length ? 'Instrumentos de la clase actual' : 'El docente la define al aplicar'}
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
        <div className="modo-aula-side-panel" style={{
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
          <div className="modo-aula-card-panel" style={{
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
                <div style={{ fontSize:11, color:'#64748b' }}>{guardandoRecursos ? 'guardando ajustes...' : 'para la clase'}</div>
              </div>
            </div>
            {recursos.length === 0 ? (
              <div style={{ textAlign:'center', padding:'14px 0', color:'#94a3b8', fontSize:11.5 }}>Sin recursos definidos</div>
            ) : (
              <div style={{ display:'grid', gap:8 }}>
                {recursos.map((r, i) => (
                  <RecursoItem
                    key={`${r.tipo}-${r.item}-${i}`}
                    tipo={r.tipo}
                    item={r.item}
                    busqueda={r.busqueda}
                    accion={r.accion}
                    url={r.url}
                    onGuardar={(actualizado) => guardarRecursoPlan(i, actualizado)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Banco de Evidencias */}
          <div className="modo-aula-card-panel" style={{
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
                <div style={{ position:'relative', marginBottom:8 }}>
                  <label style={{ display:'block', fontSize:10.5, fontWeight:900, color:'#92400e', textTransform:'uppercase', marginBottom:5 }}>
                    Estudiante del curso
                  </label>
                  <input
                    value={busquedaEstudianteEv}
                    onChange={e => {
                      setBusquedaEstudianteEv(e.target.value)
                      setEstudianteEv(null)
                      setErrorEv('')
                    }}
                    placeholder="Escribe el nombre, ej. Pedro"
                    style={{
                      width:'100%', border:'1px solid #e2e8f0', borderRadius:7,
                      padding:'8px 10px', fontSize:12.5, color:'#374151',
                      background:'#fff', outline:'none', boxSizing:'border-box',
                    }}
                  />
                  {estudianteEv && (
                    <div style={{ marginTop:6, fontSize:11.5, color:'#15803d', fontWeight:800 }}>
                      ✓ Seleccionado: {estudianteEv.nombre}
                    </div>
                  )}
                  {!estudianteEv && busquedaEstudianteEv.trim() && (
                    <div style={{
                      position:'absolute',
                      left:0,
                      right:0,
                      top:'100%',
                      zIndex:5,
                      marginTop:4,
                      background:'#fff',
                      border:'1px solid #fde68a',
                      borderRadius:9,
                      boxShadow:'0 10px 24px rgba(15,23,42,.12)',
                      maxHeight:180,
                      overflow:'auto',
                    }}>
                      {sugerenciasEstudiantesEv.length === 0 ? (
                        <div style={{ padding:'10px 12px', fontSize:11.5, color:'#92400e' }}>
                          No hay estudiantes del curso actual con ese nombre.
                        </div>
                      ) : sugerenciasEstudiantesEv.map((estudiante) => (
                        <button
                          key={estudiante.id}
                          onClick={() => {
                            setEstudianteEv(estudiante)
                            setBusquedaEstudianteEv(estudiante.nombre)
                            setErrorEv('')
                          }}
                          style={{
                            display:'block',
                            width:'100%',
                            textAlign:'left',
                            background:'#fff',
                            border:0,
                            borderBottom:'1px solid #fef3c7',
                            padding:'9px 12px',
                            cursor:'pointer',
                          }}
                        >
                          <div style={{ fontSize:12.5, fontWeight:900, color:'#111827' }}>{estudiante.nombre}</div>
                          {detalleEstudiante(estudiante) && (
                            <div style={{ fontSize:10.5, color:'#64748b', marginTop:2 }}>{detalleEstudiante(estudiante)}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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
                {errorEv && (
                  <div style={{
                    marginTop:8,
                    padding:'8px 10px',
                    border:'1px solid #fecaca',
                    background:'#fef2f2',
                    color:'#b91c1c',
                    borderRadius:7,
                    fontSize:11.5,
                    fontWeight:800,
                    lineHeight:1.35,
                  }}>
                    {errorEv}
                  </div>
                )}
                <button onClick={agregarEvidencia} disabled={!inputEvidencia.trim() || !estudianteEv?.id || guardandoEv} style={{
                  width:'100%', marginTop:8, background:'#c2410c', color:'#fff',
                  border:0, borderRadius:7, padding:'8px', fontSize:12, fontWeight:700,
                  cursor: inputEvidencia.trim() && estudianteEv?.id && !guardandoEv ? 'pointer' : 'default',
                  opacity: inputEvidencia.trim() && estudianteEv?.id && !guardandoEv ? 1 : .5,
                }}>{guardandoEv ? 'Guardando...' : 'Guardar evidencia'}</button>
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
                      {ev.estudianteNombre && (
                        <div style={{ fontSize:11.5, fontWeight:900, color:'#111827', marginBottom:2 }}>
                          {ev.estudianteNombre}
                        </div>
                      )}
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
