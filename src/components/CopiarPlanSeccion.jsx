// Etapa 3 — «Usar este plan con 2do B»: copia enlazada del plan de otra sección.
// No gasta cupo ni IA. El docente confirma la fecha de inicio y los días de clase.
import { useState } from 'react'
import { copiarPlanParaCurso } from '../services/planificacionDataService.js'
import { diasDelPlan, errorDeDias } from '../services/planCurso.js'

const SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const campo = { padding:'6px 8px', borderRadius:8, border:'1px solid #c4b5fd', fontSize:13, background:'#fff' }
const metaDe = (plan) => plan?.contenido?.unidad?.metadatos || plan?.contenido?.metadatos || {}

function FormularioCopia({ plan, curso, onCopiado }) {
  const originales = diasDelPlan(plan)
  const [fechaInicio, setFechaInicio] = useState(metaDe(plan).fechaInicio || '')
  const [dias, setDias] = useState(originales)
  const [copiando, setCopiando] = useState(false)
  const [error, setError] = useState('')
  const errorDias = errorDeDias(originales, dias)
  const meta = metaDe(plan)

  const copiar = async () => {
    setCopiando(true); setError('')
    try {
      onCopiado(await copiarPlanParaCurso(plan, curso, { fechaInicio, dias }))
    } catch (e) {
      setError(`No se creó la copia: ${e.message}`)
      setCopiando(false)
    }
  }

  return (
    <div style={{ padding:'12px 14px', border:'1px solid #ddd6fe', borderRadius:10, background:'#faf5ff', textAlign:'left', display:'grid', gap:10 }}>
      <strong style={{ fontSize:14, color:'#1f2937' }}>{meta.titulo || meta.tema || 'Planificación'} · sección {meta.seccion || '—'}</strong>
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'end', fontSize:12, color:'#4c1d95', fontWeight:700 }}>
        <label style={{ display:'grid', gap:4 }}>
          Inicio en {curso.nombre}
          <input type="date" value={fechaInicio} disabled={copiando} onChange={(e) => setFechaInicio(e.target.value)} style={campo} />
        </label>
        {originales.map((original, i) => (
          <label key={original} style={{ display:'grid', gap:4 }}>
            Clase del {original.toLowerCase()}
            <select value={dias[i]} disabled={copiando} onChange={(e) => setDias((d) => d.map((v, n) => (n === i ? e.target.value : v)))} style={campo}>
              {[...new Set([original, ...SEMANA])].map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
        ))}
      </div>
      {(errorDias || error) && <div role="alert" style={{ color:'#b91c1c', fontWeight:700, fontSize:12.5 }}>⚠️ {errorDias || error}</div>}
      <button type="button" onClick={copiar} disabled={copiando || Boolean(errorDias)} style={{
        justifySelf:'start', border:0, borderRadius:10, padding:'10px 16px', fontSize:13, fontWeight:800, color:'#fff',
        background: copiando || errorDias ? '#a78bfa' : '#6d28d9', cursor: copiando || errorDias ? 'default' : 'pointer',
      }}>
        {copiando ? 'Creando la copia…' : `Usar este plan con ${curso.nombre}`}
      </button>
    </div>
  )
}

export default function CopiarPlanSeccion({ planes = [], curso, onCopiado }) {
  if (!curso || !planes.length) return null
  return (
    <section style={{ display:'grid', gap:10 }}>
      <p style={{ margin:0, fontSize:13, color:'#475569', lineHeight:1.6 }}>
        Puedes usar el plan de otra sección. Se crea una copia para {curso.nombre} con sus propias fechas, instrumentos,
        actividades y notas. No gasta cupo ni IA. El texto no se reescribe: revisa si nombra la otra sección.
      </p>
      {planes.map((plan) => <FormularioCopia key={plan.id} plan={plan} curso={curso} onCopiado={onCopiado} />)}
    </section>
  )
}
