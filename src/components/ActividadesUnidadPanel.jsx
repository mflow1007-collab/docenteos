// F2 — «Actividades de la unidad» en Modo Aula: una por entrega de fase del
// plan maestro. El docente revisa, cambia la fecha o desactiva (reversible);
// no crea actividades fuera del plan (decisión 1 de César).
// F3: en cada actividad marca la entrega por estudiante (Entregó · No entregó ·
// Excusa; sin marca = Pendiente) con un enlace opcional como evidencia.
// F4: «Evaluar» con la rúbrica de la actividad → evaluarYRegistrar (resultado,
// aspectos por indicador, Registro) y «Excluir de la nota» (decisión 4).
import { useEffect, useState } from 'react'
import {
  actualizarActividad, cambiarExclusionDeNota, guardarActividadesDePlan, marcarEntrega,
  obtenerActividadesPorPlanificacion, obtenerInstrumentoDeActividad,
} from '../services/actividadesService.js'
import {
  alternarEstadoEntrega, estudiantesParaEvaluar, ETIQUETAS_ENTREGA, fechaDeActividad, nivelesDeResultado,
  puntuarRubrica, resumenEntregas, unidadDePlan,
} from '../services/actividadesPlan.js'
import { evaluarYRegistrar } from '../services/modoAulaService.js'
import { obtenerResultadosPorInstrumento } from '../services/instrumentosService.js'

const caja = { margin:'16px 24px 0', padding:'14px 18px', background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, fontSize:13 }
const boton = { padding:'6px 12px', borderRadius:8, border:'1px solid #c4b5fd', background:'#f5f3ff', color:'#4c1d95', fontWeight:700, cursor:'pointer', fontSize:12 }
const COLOR_ENTREGA = { entrego:'#15803d', no_entrego:'#b91c1c', excusa:'#b45309' }
const marca = (activo, estado) => ({
  ...boton, padding:'4px 9px', fontWeight:700,
  ...(activo ? { background: COLOR_ENTREGA[estado], borderColor: COLOR_ENTREGA[estado], color:'#fff' } : { background:'#fff', borderColor:'#d1d5db', color:'#374151' }),
})

// Lista del curso de UNA actividad: una fila por estudiante.
function EntregasActividad({ actividad, onCambio }) {
  const [enlaces, setEnlaces] = useState({})
  const [guardando, setGuardando] = useState('')
  const [error, setError] = useState('')
  const filas = Object.entries(actividad.entregas || {})
    .sort(([, a], [, b]) => String(a.nombre).localeCompare(String(b.nombre), 'es'))

  const guardar = async (estId, cambios) => {
    setGuardando(estId); setError('')
    try {
      const { entrega, avisoEvidencia } = await marcarEntrega(actividad, estId, cambios)
      onCambio(estId, entrega)
      if (avisoEvidencia) setError(avisoEvidencia)
    } catch (e) {
      setError(`No se guardó la entrega: ${e.message}`)
    } finally {
      setGuardando('')
    }
  }

  if (!filas.length) return <div style={{ marginTop:8, color:'#6b7280' }}>Esta actividad no tiene estudiantes en su lista.</div>
  return (
    <div style={{ marginTop:8, borderTop:'1px solid #f3f4f6', paddingTop:8 }}>
      {error && <div role="alert" style={{ marginBottom:8, color:'#b91c1c', fontWeight:700 }}>⚠️ {error}</div>}
      <div style={{ display:'grid', gap:6 }}>
        {filas.map(([estId, entrega]) => {
          const estado = entrega.estado || 'pendiente'
          const enlace = enlaces[estId] ?? entrega.enlace ?? ''
          const ocupado = guardando === estId
          return (
            <div key={estId} style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
              <span style={{ minWidth:170, fontWeight:600, color:'#1f2937' }}>{entrega.nombre || estId}</span>
              {['entrego', 'no_entrego', 'excusa'].map((e) => (
                <button key={e} type="button" style={marca(estado === e, e)} disabled={ocupado} aria-pressed={estado === e}
                  onClick={() => guardar(estId, { estado: alternarEstadoEntrega(estado, e) })}>
                  {ETIQUETAS_ENTREGA[e]}
                </button>
              ))}
              {estado === 'pendiente' && <span style={{ color:'#6b7280' }}>Pendiente</span>}
              <input type="url" placeholder="Enlace de evidencia (opcional)" value={enlace}
                aria-label={`Enlace de evidencia de ${entrega.nombre || estId}`}
                onChange={(ev) => setEnlaces((m) => ({ ...m, [estId]: ev.target.value }))}
                style={{ flex:'1 1 200px', minWidth:0, padding:'4px 8px', borderRadius:6, border:'1px solid #d1d5db', fontSize:12 }} />
              {enlace.trim() !== (entrega.enlace || '') && (
                <button type="button" style={boton} disabled={ocupado} onClick={() => guardar(estId, { enlace })}>
                  {ocupado ? 'Guardando…' : 'Guardar enlace'}
                </button>
              )}
              {entrega.enlace && enlace.trim() === entrega.enlace && (
                <a href={entrega.enlace} target="_blank" rel="noreferrer" style={{ color:'#4c1d95' }}>Abrir</a>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// F4 — Evaluar UNA actividad con su rúbrica. Solo quien entregó recibe nota;
// «No entregó» espera la decisión del docente (decisión 3).
function EvaluarActividad({ actividad, onCambioEntrega }) {
  const [instrumento, setInstrumento] = useState(null)
  const [resultados, setResultados] = useState({})
  const [niveles, setNiveles] = useState({})
  const [guardando, setGuardando] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let vigente = true
    Promise.all([obtenerInstrumentoDeActividad(actividad), obtenerResultadosPorInstrumento(actividad.instrumentoId)])
      .then(([ins, lista]) => {
        if (!vigente) return
        setInstrumento(ins)
        setResultados(Object.fromEntries(lista.map((r) => [String(r.estudianteId), r])))
        setNiveles(Object.fromEntries(lista.map((r) => [String(r.estudianteId), nivelesDeResultado(r)])))
      })
      .catch((e) => { if (vigente) setError(e.message) })
    return () => { vigente = false }
  }, [actividad.id, actividad.instrumentoId])

  if (error && !instrumento) return <div role="alert" style={{ marginTop:8, color:'#b91c1c', fontWeight:700 }}>⚠️ {error}</div>
  if (!instrumento) return <div style={{ marginTop:8, color:'#6b7280' }}>Cargando la rúbrica…</div>

  const criterios = instrumento.estructura?.criterios || []
  const opciones = instrumento.estructura?.niveles || []
  const grupos = estudiantesParaEvaluar(actividad.entregas)

  const registrar = async (est, aplicacion) => {
    setGuardando(est.id); setError('')
    try {
      const { exitosos, errores } = await evaluarYRegistrar({
        instrumento,
        claseTitulo: actividad.claseTitulo || '',
        // El puente legacy crearía otra columna y otra evidencia: aquí no (F7).
        sincronizarLegacy: false,
        aplicaciones: [{ estudianteId: est.id, estudianteNombre: est.nombre, estado: 'evaluado', ...aplicacion }],
      })
      if (errores.length) throw new Error(errores[0].mensaje)
      setResultados((m) => ({ ...m, [est.id]: exitosos[0].resultado }))
    } catch (e) {
      setError(e.message)
    } finally {
      setGuardando('')
    }
  }

  const guardarRubrica = (est) => {
    try {
      const { puntaje, detalleCriterios } = puntuarRubrica(instrumento.estructura, niveles[est.id])
      registrar(est, { puntajeObtenido: puntaje, detalleCriterios })
    } catch (e) {
      setError(`${est.nombre}: ${e.message}`)
    }
  }

  const cambiarEntrega = async (est, estado) => {
    setGuardando(est.id); setError('')
    try {
      const { entrega } = await marcarEntrega(actividad, est.id, { estado })
      onCambioEntrega(est.id, entrega)
    } catch (e) {
      setError(`No se guardó la entrega: ${e.message}`)
    } finally {
      setGuardando('')
    }
  }

  const nota = (est) => {
    const r = resultados[est.id]
    return r?.estado === 'evaluado'
      ? <span style={{ fontWeight:800, color:'#15803d' }}>Registrado: {r.puntajeObtenido}/{r.puntajeMaximo}</span>
      : null
  }

  return (
    <div style={{ marginTop:8, borderTop:'1px solid #f3f4f6', paddingTop:8 }}>
      {error && <div role="alert" style={{ marginBottom:8, color:'#b91c1c', fontWeight:700 }}>⚠️ {error}</div>}
      {actividad.excluidaDeNota && (
        <div style={{ marginBottom:8, color:'#92400e', fontWeight:600 }}>Actividad excluida de la nota: lo que guardes queda registrado, pero no cuenta en el período.</div>
      )}
      {!grupos.entrego.length && !grupos.no_entrego.length && (
        <div style={{ color:'#6b7280' }}>Nadie ha entregado todavía. Marca las entregas primero.</div>
      )}
      <div style={{ display:'grid', gap:10 }}>
        {grupos.entrego.map((est) => {
          const elegidos = niveles[est.id] || {}
          const completo = criterios.every((c) => elegidos[c.id])
          let total = null
          if (completo) { try { total = puntuarRubrica(instrumento.estructura, elegidos).puntaje } catch { total = null } }
          return (
            <div key={est.id} style={{ display:'grid', gap:4 }}>
              <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                <span style={{ minWidth:170, fontWeight:700, color:'#1f2937' }}>{est.nombre}</span>
                {nota(est)}
              </div>
              {criterios.map((c) => (
                <label key={c.id} style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', color:'#374151' }}>
                  <span style={{ flex:'1 1 260px', minWidth:0 }}><b>{c.indicadorId}</b> · {c.criterio} ({c.puntajeMaximo} pts)</span>
                  <select value={elegidos[c.id] || ''} disabled={guardando === est.id}
                    aria-label={`Nivel de ${est.nombre} en ${c.indicadorId}`}
                    onChange={(ev) => setNiveles((m) => ({ ...m, [est.id]: { ...(m[est.id] || {}), [c.id]: ev.target.value } }))}>
                    <option value="">Elige el nivel</option>
                    {opciones.map((n) => (
                      <option key={n.key} value={n.key}>{n.label} — {c.puntajesNiveles?.[n.key]} pts</option>
                    ))}
                  </select>
                </label>
              ))}
              <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                <span>Total: {total ?? '—'}/{instrumento.valorMaximo || 100}</span>
                <button type="button" style={boton} disabled={!completo || guardando === est.id} onClick={() => guardarRubrica(est)}>
                  {guardando === est.id ? 'Guardando…' : 'Guardar en el Registro'}
                </button>
              </div>
            </div>
          )
        })}
        {grupos.no_entrego.map((est) => (
          <div key={est.id} style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
            <span style={{ minWidth:170, fontWeight:700, color:'#1f2937' }}>{est.nombre}</span>
            <span style={{ color:'#b91c1c' }}>No entregó: sin nota hasta que decidas</span>
            {nota(est)}
            <button type="button" style={boton} disabled={guardando === est.id} onClick={() => registrar(est, { puntajeObtenido: 0 })}>Poner 0</button>
            <button type="button" style={boton} disabled={guardando === est.id} onClick={() => cambiarEntrega(est, 'pendiente')}>Otra oportunidad</button>
            <button type="button" style={boton} disabled={guardando === est.id} onClick={() => cambiarEntrega(est, 'excusa')}>Excusa</button>
          </div>
        ))}
      </div>
      {grupos.sinEvaluar.length > 0 && (
        <div style={{ marginTop:8, color:'#6b7280' }}>Sin evaluar (pendiente o excusa): {grupos.sinEvaluar.length}</div>
      )}
    </div>
  )
}

export default function ActividadesUnidadPanel({ plan }) {
  const [actividades, setActividades] = useState([])
  const [avisos, setAvisos] = useState([])
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [abierta, setAbierta] = useState('')
  const [evaluando, setEvaluando] = useState('')
  const conPlanMaestro = Boolean(unidadDePlan(plan)?.planMaestro?.fases?.length)
  const cursoId = plan?.cursoId || plan?.capaCurricular?.cursoId || ''

  useEffect(() => {
    let vigente = true
    setActividades([]); setAvisos([]); setError('')
    if (!plan?.id || !conPlanMaestro) return undefined
    obtenerActividadesPorPlanificacion(plan.id)
      .then((lista) => { if (vigente) setActividades(lista) })
      .catch((e) => { if (vigente) setError(`No se pudieron leer las actividades: ${e.message}`) })
    return () => { vigente = false }
  }, [plan?.id, conPlanMaestro])

  if (!plan?.id || !conPlanMaestro) return null

  const crear = async () => {
    setOcupado(true); setError('')
    try {
      const r = await guardarActividadesDePlan(plan)
      setActividades(r.actividades)
      setAvisos(r.avisos)
    } catch (e) {
      setError(`No se crearon las actividades: ${e.message}`)
    } finally {
      setOcupado(false)
    }
  }

  const cambiar = async (actividad, cambios) => {
    setError('')
    try {
      await actualizarActividad(actividad.id, cambios)
      setActividades((lista) => lista.map((a) => (a.id === actividad.id ? { ...a, ...cambios } : a)))
    } catch (e) {
      setError(`No se guardó el cambio: ${e.message}`)
    }
  }

  const excluir = async (actividad) => {
    setError(''); setAvisos([])
    const excluida = !actividad.excluidaDeNota
    try {
      const r = await cambiarExclusionDeNota(actividad, excluida)
      setActividades((lista) => lista.map((a) => (a.id === actividad.id ? { ...a, excluidaDeNota: excluida } : a)))
      setAvisos(r.avisos)
    } catch (e) {
      setError(`No se cambió la exclusión: ${e.message}`)
    }
  }

  const cambiarEntrega = (actividadId, estId, entrega) =>
    setActividades((lista) => lista.map((a) => (a.id === actividadId ? { ...a, entregas: { ...a.entregas, [estId]: entrega } } : a)))

  return (
    <details open style={caja}>
      <summary style={{ cursor:'pointer', fontWeight:800, color:'#1f2937', fontSize:14 }}>
        📋 Actividades de la unidad {actividades.length > 0 && `(${actividades.filter((a) => a.activa !== false).length} activas de ${actividades.length})`}
      </summary>
      {error && <div role="alert" style={{ marginTop:10, color:'#b91c1c', fontWeight:700 }}>⚠️ {error}</div>}
      {avisos.map((aviso) => <div key={aviso} style={{ marginTop:8, color:'#92400e', fontWeight:600 }}>⚠️ {aviso}</div>)}
      {!actividades.length && (
        <div style={{ marginTop:10, display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
          <span style={{ color:'#4b5563' }}>Este plan aún no tiene sus actividades (una por entrega de fase).</span>
          <button type="button" style={boton} disabled={ocupado || !cursoId} onClick={crear}>
            {ocupado ? 'Creando…' : 'Crear actividades del plan'}
          </button>
          {!cursoId && <span style={{ color:'#b91c1c' }}>El plan no está atado a un curso.</span>}
        </div>
      )}
      <ol style={{ margin:'10px 0 0', paddingLeft:18, display:'grid', gap:10 }}>
        {actividades.map((a) => {
          const r = resumenEntregas(a.entregas)
          const activa = a.activa !== false
          return (
            <li key={a.id} style={{ opacity: activa ? 1 : 0.55 }}>
              <div style={{ fontWeight:800, color:'#1f2937' }}>Fase {a.faseNumero} · {a.faseNombre}</div>
              <div>Entrega: {a.entrega?.texto}{a.entrega?.secciones?.length ? ` — secciones: ${a.entrega.secciones.join(', ')}` : ''}</div>
              <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap', marginTop:4, color:'#4b5563' }}>
                <span>Clase {a.numeroClase}{a.claseTitulo ? ` «${a.claseTitulo}»` : ''}</span>
                <label>
                  Fecha{' '}
                  <input type="date" value={fechaDeActividad(a)} disabled={!activa}
                    onChange={(ev) => cambiar(a, { fechaAjustada: ev.target.value || null })} />
                </label>
                {a.fechaAjustada && <span>(prevista {a.fechaPrevista || 'sin fecha'})</span>}
                <span>Indicadores: {a.indicadorIds?.length ? a.indicadorIds.join(', ') : 'ninguno'}</span>
                <span>{!a.instrumentoId ? 'Sin rúbrica: no cuenta en la nota' : a.excluidaDeNota ? 'Rúbrica del Anexo A · excluida de la nota' : 'Rúbrica del Anexo A'}</span>
                <span>{r.entrego} entregaron · {r.no_entrego} no · {r.excusa} excusa · {r.pendiente} pendiente{r.pendiente === 1 ? '' : 's'}</span>
                <button type="button" style={boton} disabled={!activa} aria-expanded={abierta === a.id}
                  onClick={() => setAbierta(abierta === a.id ? '' : a.id)}>
                  {abierta === a.id ? 'Cerrar entregas' : 'Entregas'}
                </button>
                {a.instrumentoId && (
                  <button type="button" style={boton} disabled={!activa} aria-expanded={evaluando === a.id}
                    onClick={() => setEvaluando(evaluando === a.id ? '' : a.id)}>
                    {evaluando === a.id ? 'Cerrar evaluación' : 'Evaluar'}
                  </button>
                )}
                {a.instrumentoId && (
                  <button type="button" style={boton} onClick={() => excluir(a)}>
                    {a.excluidaDeNota ? 'Incluir en la nota' : 'Excluir de la nota'}
                  </button>
                )}
                <button type="button" style={boton} onClick={() => cambiar(a, { activa: !activa })}>
                  {activa ? 'Desactivar' : 'Reactivar'}
                </button>
              </div>
              {activa && abierta === a.id && (
                <EntregasActividad actividad={a} onCambio={(estId, entrega) => cambiarEntrega(a.id, estId, entrega)} />
              )}
              {activa && evaluando === a.id && (
                <EvaluarActividad actividad={a} onCambioEntrega={(estId, entrega) => cambiarEntrega(a.id, estId, entrega)} />
              )}
            </li>
          )
        })}
      </ol>
    </details>
  )
}
