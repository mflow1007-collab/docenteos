// Aviso único de «curso sin lista» o «lista de ejemplo», con acceso a Estudiantes.
export default function AvisoListaEstudiantes({ mensaje, style }) {
  if (!mensaje) return null
  return (
    <div role="alert" style={{
      margin:'0 0 12px', padding:'10px 16px', borderRadius:10, background:'#fffbeb', border:'1px solid #fcd34d',
      color:'#92400e', fontSize:13, fontWeight:700, display:'flex', gap:12, alignItems:'center', flexWrap:'wrap', ...style,
    }}>
      <span style={{ flex:'1 1 240px' }}>⚠️ {mensaje}</span>
      <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('irA', { detail: 'estudiantes' }))}
        style={{ border:'1px solid #f59e0b', background:'#fff', color:'#92400e', borderRadius:8, padding:'6px 12px', fontWeight:800, cursor:'pointer' }}>
        Ir a Estudiantes
      </button>
    </div>
  )
}
