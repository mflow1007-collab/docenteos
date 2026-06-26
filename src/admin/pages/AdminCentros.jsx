import { useEffect, useState } from 'react'
import {
  collection, onSnapshot, doc, setDoc, deleteDoc,
  query, orderBy, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../firebase.js'

const CAMPOS_VACIO = {
  nombre: '', codigo: '', regional: '', distrito: '',
  nivel: '', modalidad: '', direccion: '', telefono: '',
  director: '', email: '', activo: true,
}

const NIVELES     = ['Inicial', 'Primario', 'Secundario', 'Técnico Profesional', 'Otro']
const MODALIDADES = ['Regular', 'Adultos', 'Especial', 'Técnico Vocacional', 'Virtual']

export default function AdminCentros() {
  const [centros,   setCentros]   = useState([])
  const [cargando,  setCargando]  = useState(true)
  const [busqueda,  setBusqueda]  = useState('')
  const [modal,     setModal]     = useState(null)   // null | 'nuevo' | { id, ...campos }
  const [form,      setForm]      = useState(CAMPOS_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [confirmar, setConfirmar] = useState(null)   // id a eliminar
  const [error,     setError]     = useState('')

  useEffect(() => {
    let q
    try { q = query(collection(db, 'centros'), orderBy('nombre', 'asc')) }
    catch { q = collection(db, 'centros') }
    const unsub = onSnapshot(q,
      (snap) => { setCentros(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setCargando(false) },
      ()     => { setCargando(false) }
    )
    return unsub
  }, [])

  const abrirNuevo = () => {
    setForm(CAMPOS_VACIO)
    setError('')
    setModal('nuevo')
  }

  const abrirEditar = (c) => {
    setForm({ ...CAMPOS_VACIO, ...c })
    setError('')
    setModal(c)
  }

  const guardar = async () => {
    if (!form.nombre.trim()) { setError('El nombre del centro es obligatorio.'); return }
    setGuardando(true)
    setError('')
    try {
      const id = modal === 'nuevo'
        ? `centro_${Date.now()}`
        : modal.id
      await setDoc(doc(db, 'centros', id), {
        ...form,
        fechaActualizacion: serverTimestamp(),
        ...(modal === 'nuevo' ? { fechaCreacion: serverTimestamp() } : {}),
      }, { merge: true })
      setModal(null)
    } catch (err) {
      setError('Error al guardar: ' + err.message)
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (id) => {
    try { await deleteDoc(doc(db, 'centros', id)) }
    catch (err) { console.error('[AdminCentros] eliminar:', err) }
    setConfirmar(null)
  }

  const toggleActivo = async (c) => {
    try { await setDoc(doc(db, 'centros', c.id), { activo: !c.activo }, { merge: true }) }
    catch (err) { console.error('[AdminCentros] toggle:', err) }
  }

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const lista = centros.filter((c) => {
    const q = busqueda.toLowerCase()
    return !q ||
      c.nombre?.toLowerCase().includes(q) ||
      c.codigo?.toLowerCase().includes(q) ||
      c.regional?.toLowerCase().includes(q) ||
      c.distrito?.toLowerCase().includes(q)
  })

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div className="admin-page-header-text">
          <h2>Centros Educativos</h2>
          <p>{centros.length} centros registrados</p>
        </div>
        <button className="admin-btn admin-btn-primary" onClick={abrirNuevo}>
          + Nuevo centro
        </button>
      </div>

      <div className="admin-toolbar">
        <input
          className="admin-search"
          placeholder="Buscar por nombre, código, regional…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {cargando ? (
        <div className="admin-loading"><div className="admin-spinner" />Cargando centros…</div>
      ) : lista.length === 0 ? (
        <div className="admin-empty">
          <span className="admin-empty-icon">🏫</span>
          <h3>Sin centros registrados</h3>
          <p>Crea el primer centro educativo con el botón &quot;Nuevo centro&quot;.</p>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Código</th>
                <th>Regional</th>
                <th>Distrito</th>
                <th>Nivel</th>
                <th>Modalidad</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.nombre}</strong><br /><small>{c.director || ''}</small></td>
                  <td><code style={{ fontSize: 11, background: 'var(--adm-bg)', padding: '2px 5px', borderRadius: 3, color: '#a5b4fc' }}>{c.codigo || '—'}</code></td>
                  <td><small>{c.regional || '—'}</small></td>
                  <td><small>{c.distrito || '—'}</small></td>
                  <td><small>{c.nivel || '—'}</small></td>
                  <td><small>{c.modalidad || '—'}</small></td>
                  <td>
                    <span className={`admin-badge ${c.activo !== false ? 'badge-activo' : 'badge-inactivo'}`}>
                      {c.activo !== false ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <div className="admin-row-actions">
                      <button className="admin-btn-sm blue"  onClick={() => abrirEditar(c)}>Editar</button>
                      <button className="admin-btn-sm yellow" onClick={() => toggleActivo(c)}>
                        {c.activo !== false ? 'Desactivar' : 'Activar'}
                      </button>
                      <button className="admin-btn-sm red" onClick={() => setConfirmar(c.id)}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal crear / editar */}
      {modal !== null && (
        <div className="admin-modal-overlay" onClick={() => setModal(null)}>
          <div className="admin-modal admin-modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>{modal === 'nuevo' ? 'Nuevo centro educativo' : `Editar: ${modal.nombre}`}</h3>
              <button className="admin-modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="admin-modal-body">
              {error && <div className="admin-alert error">{error}</div>}
              <div className="admin-form-grid">
                <div className="admin-form-group full">
                  <label className="admin-form-label">Nombre del centro *</label>
                  <input className="admin-form-input" value={form.nombre} onChange={(e) => setField('nombre', e.target.value)} placeholder="Ej: Escuela Básica Los Jardines" />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Código</label>
                  <input className="admin-form-input" value={form.codigo} onChange={(e) => setField('codigo', e.target.value)} placeholder="Ej: 01120" />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Teléfono</label>
                  <input className="admin-form-input" value={form.telefono} onChange={(e) => setField('telefono', e.target.value)} placeholder="809-000-0000" />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Regional</label>
                  <input className="admin-form-input" value={form.regional} onChange={(e) => setField('regional', e.target.value)} placeholder="Ej: 01-Santo Domingo" />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Distrito</label>
                  <input className="admin-form-input" value={form.distrito} onChange={(e) => setField('distrito', e.target.value)} placeholder="Ej: 01-01" />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Nivel</label>
                  <select className="admin-form-select" value={form.nivel} onChange={(e) => setField('nivel', e.target.value)}>
                    <option value="">Seleccionar…</option>
                    {NIVELES.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Modalidad</label>
                  <select className="admin-form-select" value={form.modalidad} onChange={(e) => setField('modalidad', e.target.value)}>
                    <option value="">Seleccionar…</option>
                    {MODALIDADES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Director / Directora</label>
                  <input className="admin-form-input" value={form.director} onChange={(e) => setField('director', e.target.value)} placeholder="Nombre del director" />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Correo institucional</label>
                  <input className="admin-form-input" type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="centro@minerd.gob.do" />
                </div>
                <div className="admin-form-group full">
                  <label className="admin-form-label">Dirección</label>
                  <input className="admin-form-input" value={form.direccion} onChange={(e) => setField('direccion', e.target.value)} placeholder="Calle, sector, municipio" />
                </div>
              </div>
            </div>
            <div className="admin-modal-footer">
              <button className="admin-btn admin-btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="admin-btn admin-btn-primary" onClick={guardar} disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar centro'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar eliminación */}
      {confirmar && (
        <div className="admin-modal-overlay" onClick={() => setConfirmar(null)}>
          <div className="admin-modal admin-modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>Eliminar centro</h3>
              <button className="admin-modal-close" onClick={() => setConfirmar(null)}>✕</button>
            </div>
            <div className="admin-modal-body">
              <span className="admin-confirm-icon">⚠️</span>
              <p className="admin-confirm-text">¿Eliminar este centro educativo?</p>
              <p className="admin-confirm-sub">Esta acción no se puede deshacer.</p>
            </div>
            <div className="admin-modal-footer">
              <button className="admin-btn admin-btn-secondary" onClick={() => setConfirmar(null)}>Cancelar</button>
              <button className="admin-btn admin-btn-danger" onClick={() => eliminar(confirmar)}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
