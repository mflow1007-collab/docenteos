// F2 — «Actividades de la unidad» en Modo Aula: una por entrega de fase del
// plan maestro. El docente revisa, cambia la fecha o desactiva (reversible);
// no crea actividades fuera del plan (decisión 1 de César).
// F3: en cada actividad marca la entrega por estudiante (Entregó · No entregó ·
// Excusa; sin marca = Pendiente) con un enlace opcional como evidencia.
import { useEffect, useState } from 'react'
import { actualizarActividad, guardarActividadesDePlan, marcarEntrega, obtenerActividadesPorPlanificacion } from '../services/actividadesService.js'
import { alternarEstadoEntrega, ETIQUETAS_ENTREGA, fechaDeActividad, resumenEntregas, unidadDePlan } from '../services/actividadesPlan.js'

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

export default function ActividadesUnidadPanel({ plan }) {
  const [actividades, setActividades] = useState([])
  const [avisos, setAvisos] = useState([])
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [abierta, setAbierta] = useState('')
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
                <span>{a.instrumentoId ? 'Rúbrica del Anexo A' : 'Sin rúbrica: no cuenta en la nota'}</span>
                <span>{r.entrego} entregaron · {r.no_entrego} no · {r.excusa} excusa · {r.pendiente} pendiente{r.pendiente === 1 ? '' : 's'}</span>
                <button type="button" style={boton} disabled={!activa} aria-expanded={abierta === a.id}
                  onClick={() => setAbierta(abierta === a.id ? '' : a.id)}>
                  {abierta === a.id ? 'Cerrar entregas' : 'Entregas'}
                </button>
                <button type="button" style={boton} onClick={() => cambiar(a, { activa: !activa })}>
                  {activa ? 'Desactivar' : 'Reactivar'}
                </button>
              </div>
              {activa && abierta === a.id && (
                <EntregasActividad actividad={a} onCambio={(estId, entrega) => cambiarEntrega(a.id, estId, entrega)} />
              )}
            </li>
          )
        })}
      </ol>
    </details>
  )
}
