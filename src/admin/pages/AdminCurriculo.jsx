import { useEffect, useState } from 'react'
import { collection, getDocs, doc, updateDoc, query, orderBy } from 'firebase/firestore'
import { db } from '../../firebase.js'

export default function AdminCurriculo() {
  const [curriculums, setCurriculums] = useState([])
  const [cargando, setCargando]       = useState(true)
  const [busqueda, setBusqueda]       = useState('')
  const [detalle,  setDetalle]        = useState(null)
  const [guardando, setGuardando]     = useState(false)

  const cargar = async () => {
    setCargando(true)
    try {
      let snap
      try {
        snap = await getDocs(query(collection(db, 'curriculos'), orderBy('nombre', 'asc')))
      } catch {
        snap = await getDocs(collection(db, 'curriculos'))
      }
      setCurriculums(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    } catch (err) {
      console.error('[AdminCurriculo]', err)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const toggleOficial = async (c) => {
    setGuardando(c.id)
    try {
      await updateDoc(doc(db, 'curriculos', c.id), { oficial: !c.oficial })
      setCurriculums((prev) => prev.map((x) => x.id === c.id ? { ...x, oficial: !x.oficial } : x))
    } catch (err) { console.error('[AdminCurriculo] toggle:', err) }
    finally { setGuardando(false) }
  }

  const toggleActivo = async (c) => {
    setGuardando(c.id)
    try {
      await updateDoc(doc(db, 'curriculos', c.id), { activo: !c.activo })
      setCurriculums((prev) => prev.map((x) => x.id === c.id ? { ...x, activo: !x.activo } : x))
    } catch (err) { console.error('[AdminCurriculo] toggleActivo:', err) }
    finally { setGuardando(false) }
  }

  const lista = curriculums.filter((c) => {
    const q = busqueda.toLowerCase()
    return !q ||
      c.nombre?.toLowerCase().includes(q) ||
      c.nivel?.toLowerCase().includes(q) ||
      c.modalidad?.toLowerCase().includes(q)
  })

  const exportarJSON = (c) => {
    const blob = new Blob([JSON.stringify(c, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `curriculo_${c.id}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div className="admin-page-header-text">
          <h2>Currículo MINERD</h2>
          <p>{curriculums.length} entradas de diseño curricular en Firestore.</p>
        </div>
        <button className="admin-btn admin-btn-secondary" onClick={cargar}>↻ Actualizar</button>
      </div>

      <div className="admin-toolbar">
        <input
          className="admin-search"
          placeholder="Buscar por nombre, nivel, modalidad…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {cargando ? (
        <div className="admin-loading"><div className="admin-spinner" />Cargando currículo…</div>
      ) : lista.length === 0 ? (
        <div className="admin-empty">
          <span className="admin-empty-icon">📚</span>
          <h3>Sin currículo importado</h3>
          <p>Usa la sección de importación del currículo para cargar el Diseño Curricular MINERD a Firestore.</p>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nombre / ID</th>
                <th>Nivel</th>
                <th>Modalidad</th>
                <th>Grado</th>
                <th>Oficial</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.nombre || c.id}</strong>
                    <br /><small style={{ color: 'var(--adm-dim)', fontFamily: 'monospace' }}>{c.id}</small>
                  </td>
                  <td><small>{c.nivel || '—'}</small></td>
                  <td><small>{c.modalidad || '—'}</small></td>
                  <td><small>{c.grado || '—'}</small></td>
                  <td>
                    <span className={`admin-badge ${c.oficial ? 'badge-oficial' : 'badge-borrador'}`}>
                      {c.oficial ? 'Oficial' : 'Borrador'}
                    </span>
                  </td>
                  <td>
                    <span className={`admin-badge ${c.activo !== false ? 'badge-activo' : 'badge-inactivo'}`}>
                      {c.activo !== false ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <div className="admin-row-actions">
                      <button className="admin-btn-sm blue"   onClick={() => setDetalle(c)}>Ver JSON</button>
                      <button
                        className={`admin-btn-sm ${c.oficial ? 'yellow' : 'green'}`}
                        onClick={() => toggleOficial(c)}
                        disabled={guardando === c.id}
                      >
                        {c.oficial ? 'Quitar oficial' : 'Marcar oficial'}
                      </button>
                      <button
                        className="admin-btn-sm ghost"
                        onClick={() => toggleActivo(c)}
                        disabled={guardando === c.id}
                      >
                        {c.activo !== false ? 'Desactivar' : 'Activar'}
                      </button>
                      <button className="admin-btn-sm ghost" onClick={() => exportarJSON(c)}>⬇ JSON</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detalle && (
        <div className="admin-modal-overlay" onClick={() => setDetalle(null)}>
          <div className="admin-modal admin-modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>Detalle: {detalle.nombre || detalle.id}</h3>
              <button className="admin-modal-close" onClick={() => setDetalle(null)}>✕</button>
            </div>
            <div className="admin-modal-body">
              <div className="admin-prompt-preview">
                {JSON.stringify(detalle, null, 2)}
              </div>
            </div>
            <div className="admin-modal-footer">
              <button className="admin-btn admin-btn-secondary" onClick={() => exportarJSON(detalle)}>⬇ Exportar JSON</button>
              <button className="admin-btn admin-btn-secondary" onClick={() => setDetalle(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
