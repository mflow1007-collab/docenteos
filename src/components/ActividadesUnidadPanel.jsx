// F2 — «Actividades de la unidad» en Modo Aula: una por entrega de fase del
// plan maestro. El docente revisa, cambia la fecha o desactiva (reversible);
// no crea actividades fuera del plan (decisión 1 de César).
import { useEffect, useState } from 'react'
import { actualizarActividad, guardarActividadesDePlan, obtenerActividadesPorPlanificacion } from '../services/actividadesService.js'
import { fechaDeActividad, unidadDePlan } from '../services/actividadesPlan.js'

const caja = { margin:'16px 24px 0', padding:'14px 18px', background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, fontSize:13 }
const boton = { padding:'6px 12px', borderRadius:8, border:'1px solid #c4b5fd', background:'#f5f3ff', color:'#4c1d95', fontWeight:700, cursor:'pointer', fontSize:12 }

export default function ActividadesUnidadPanel({ plan }) {
  const [actividades, setActividades] = useState([])
  const [avisos, setAvisos] = useState([])
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
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
          const entregas = Object.values(a.entregas || {})
          const pendientes = entregas.filter((e) => e.estado === 'pendiente').length
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
                <span>{pendientes} pendiente{pendientes === 1 ? '' : 's'} de {entregas.length}</span>
                <button type="button" style={boton} onClick={() => cambiar(a, { activa: !activa })}>
                  {activa ? 'Desactivar' : 'Reactivar'}
                </button>
              </div>
            </li>
          )
        })}
      </ol>
    </details>
  )
}
