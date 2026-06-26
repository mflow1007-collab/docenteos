import { useEffect, useState } from 'react'
import {
  collection, onSnapshot, doc, updateDoc, deleteDoc,
  query, orderBy,
} from 'firebase/firestore'
import { db } from '../../firebase.js'
import { ETIQUETAS_CARGO, ETIQUETAS_ESTADO } from '../../utils/permisos.js'

const BADGE_CLASE = {
  activo:    'badge-activo',
  pendiente: 'badge-pendiente',
  inactivo:  'badge-inactivo',
  suspendido:'badge-suspendido',
  rechazado: 'badge-rechazado',
}

const ESTADOS_FILTRO = ['todos', 'pendiente', 'activo', 'inactivo', 'suspendido', 'rechazado']

export default function AdminUsuarios() {
  const [usuarios,     setUsuarios]     = useState([])
  const [cargando,     setCargando]     = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [busqueda,     setBusqueda]     = useState('')
  const [perfilVisto,  setPerfilVisto]  = useState(null)   // usuario para modal de perfil
  const [rolModal,     setRolModal]     = useState(null)   // usuario para modal de cambio de rol
  const [nuevoRol,     setNuevoRol]     = useState('')
  const [confirmar,    setConfirmar]    = useState(null)   // { uid, accion: 'eliminar' }

  useEffect(() => {
    let q
    try {
      q = query(collection(db, 'usuarios'), orderBy('fechaCreacion', 'desc'))
    } catch {
      q = collection(db, 'usuarios')
    }
    const unsub = onSnapshot(q,
      (snap) => { setUsuarios(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setCargando(false) },
      ()     => { setCargando(false) }
    )
    return unsub
  }, [])

  const cambiarEstado = async (uid, nuevoEstado) => {
    try { await updateDoc(doc(db, 'usuarios', uid), { estado: nuevoEstado }) }
    catch (err) { console.error('[AdminUsuarios] cambiarEstado:', err) }
  }

  const aplicarRol = async () => {
    if (!rolModal || !nuevoRol) return
    try {
      await updateDoc(doc(db, 'usuarios', rolModal.id), { rol: nuevoRol })
      setRolModal(null)
    } catch (err) { console.error('[AdminUsuarios] cambiarRol:', err) }
  }

  const eliminarUsuario = async (uid) => {
    try { await deleteDoc(doc(db, 'usuarios', uid)) }
    catch (err) { console.error('[AdminUsuarios] eliminar:', err) }
    setConfirmar(null)
  }

  const lista = usuarios.filter((u) => {
    const q = busqueda.toLowerCase()
    const ok = !q ||
      u.nombre?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.perfilInstitucional?.centro?.toLowerCase().includes(q)
    const est = filtroEstado === 'todos' || u.estado === filtroEstado
    return ok && est
  })

  const fmtFecha = (ts) => {
    if (!ts?.toDate) return '—'
    return ts.toDate().toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div className="admin-page-header-text">
          <h2>Usuarios registrados</h2>
          <p>{usuarios.length} usuarios en la plataforma · mostrando {lista.length}</p>
        </div>
      </div>

      <div className="admin-toolbar">
        <input
          className="admin-search"
          placeholder="Buscar por nombre, correo o centro…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <div className="admin-filter-btns">
          {ESTADOS_FILTRO.map((e) => (
            <button
              key={e}
              className={`admin-filter-btn${filtroEstado === e ? ' active' : ''}`}
              onClick={() => setFiltroEstado(e)}
            >
              {e === 'todos' ? 'Todos' : (ETIQUETAS_ESTADO[e] || e)}
            </button>
          ))}
        </div>
      </div>

      {cargando ? (
        <div className="admin-loading"><div className="admin-spinner" />Cargando usuarios…</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Cargo</th>
                <th>Centro</th>
                <th>Estado</th>
                <th>Registro</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr><td colSpan={7} className="admin-table-empty">No hay usuarios que coincidan.</td></tr>
              ) : lista.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.nombre || '—'}</strong></td>
                  <td><small>{u.email}</small></td>
                  <td><small>{ETIQUETAS_CARGO[u.rol] || u.rol || '—'}</small></td>
                  <td><small>{u.perfilInstitucional?.centro || u.centro || '—'}</small></td>
                  <td>
                    <span className={`admin-badge ${BADGE_CLASE[u.estado] || ''}`}>
                      {ETIQUETAS_ESTADO[u.estado] || u.estado || '—'}
                    </span>
                  </td>
                  <td><small>{fmtFecha(u.fechaCreacion)}</small></td>
                  <td>
                    <div className="admin-row-actions">
                      <button
                        className="admin-btn-sm blue"
                        onClick={() => setPerfilVisto(u)}
                      >Ver</button>
                      <button
                        className="admin-btn-sm ghost"
                        onClick={() => { setRolModal(u); setNuevoRol(u.rol || 'docente') }}
                      >Rol</button>
                      {u.estado !== 'activo'     && <button className="admin-btn-sm green"  onClick={() => cambiarEstado(u.id, 'activo')}>Activar</button>}
                      {u.estado !== 'pendiente'  && <button className="admin-btn-sm yellow" onClick={() => cambiarEstado(u.id, 'pendiente')}>Pendiente</button>}
                      {u.estado !== 'suspendido' && <button className="admin-btn-sm red"    onClick={() => cambiarEstado(u.id, 'suspendido')}>Suspender</button>}
                      {u.estado !== 'rechazado'  && <button className="admin-btn-sm red"    onClick={() => cambiarEstado(u.id, 'rechazado')}>Rechazar</button>}
                      <button className="admin-btn-sm red" onClick={() => setConfirmar({ uid: u.id, nombre: u.nombre || u.email })}>
                        🗑
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: perfil completo */}
      {perfilVisto && (
        <div className="admin-modal-overlay" onClick={() => setPerfilVisto(null)}>
          <div className="admin-modal admin-modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>Perfil de {perfilVisto.nombre || perfilVisto.email}</h3>
              <button className="admin-modal-close" onClick={() => setPerfilVisto(null)}>✕</button>
            </div>
            <div className="admin-modal-body">
              <div className="admin-profile-grid">
                <div className="admin-profile-field">
                  <label>Correo electrónico</label>
                  <span>{perfilVisto.email || '—'}</span>
                </div>
                <div className="admin-profile-field">
                  <label>Estado</label>
                  <span>
                    <span className={`admin-badge ${BADGE_CLASE[perfilVisto.estado] || ''}`}>
                      {perfilVisto.estado || '—'}
                    </span>
                  </span>
                </div>
                <div className="admin-profile-field">
                  <label>Nombre completo</label>
                  <span>{perfilVisto.perfilInstitucional?.nombreDocente || perfilVisto.nombre || '—'}</span>
                </div>
                <div className="admin-profile-field">
                  <label>Cédula</label>
                  <span>{perfilVisto.perfilInstitucional?.cedula || '—'}</span>
                </div>
                <div className="admin-profile-field">
                  <label>Centro educativo</label>
                  <span>{perfilVisto.perfilInstitucional?.centro || '—'}</span>
                </div>
                <div className="admin-profile-field">
                  <label>Código del centro</label>
                  <span>{perfilVisto.perfilInstitucional?.codigoCentro || '—'}</span>
                </div>
                <div className="admin-profile-field">
                  <label>Cargo</label>
                  <span>{ETIQUETAS_CARGO[perfilVisto.rol] || perfilVisto.rol || '—'}</span>
                </div>
                <div className="admin-profile-field">
                  <label>Regional</label>
                  <span>{perfilVisto.perfilInstitucional?.regional || '—'}</span>
                </div>
                <div className="admin-profile-field">
                  <label>Distrito</label>
                  <span>{perfilVisto.perfilInstitucional?.distrito || '—'}</span>
                </div>
                <div className="admin-profile-field">
                  <label>Nivel educativo</label>
                  <span>{perfilVisto.perfilInstitucional?.nivel || '—'}</span>
                </div>
                <div className="admin-profile-field">
                  <label>Periodo escolar</label>
                  <span>{perfilVisto.perfilInstitucional?.periodo || '—'}</span>
                </div>
                <div className="admin-profile-field">
                  <label>Fecha de registro</label>
                  <span>{fmtFecha(perfilVisto.fechaCreacion)}</span>
                </div>
              </div>
            </div>
            <div className="admin-modal-footer">
              <button className="admin-btn admin-btn-secondary" onClick={() => setPerfilVisto(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: cambiar rol */}
      {rolModal && (
        <div className="admin-modal-overlay" onClick={() => setRolModal(null)}>
          <div className="admin-modal admin-modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>Cambiar rol de {rolModal.nombre || rolModal.email}</h3>
              <button className="admin-modal-close" onClick={() => setRolModal(null)}>✕</button>
            </div>
            <div className="admin-modal-body">
              <div className="admin-form-group">
                <label className="admin-form-label">Rol / Cargo</label>
                <select
                  className="admin-form-select"
                  value={nuevoRol}
                  onChange={(e) => setNuevoRol(e.target.value)}
                >
                  {Object.entries(ETIQUETAS_CARGO).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="admin-modal-footer">
              <button className="admin-btn admin-btn-secondary" onClick={() => setRolModal(null)}>Cancelar</button>
              <button className="admin-btn admin-btn-primary" onClick={aplicarRol}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: confirmar eliminación */}
      {confirmar && (
        <div className="admin-modal-overlay" onClick={() => setConfirmar(null)}>
          <div className="admin-modal admin-modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>Eliminar usuario</h3>
              <button className="admin-modal-close" onClick={() => setConfirmar(null)}>✕</button>
            </div>
            <div className="admin-modal-body">
              <span className="admin-confirm-icon">⚠️</span>
              <p className="admin-confirm-text">¿Eliminar a <strong>{confirmar.nombre}</strong>?</p>
              <p className="admin-confirm-sub">Esta acción elimina el perfil de Firestore. El acceso de Firebase Auth no se ve afectado aquí.</p>
            </div>
            <div className="admin-modal-footer">
              <button className="admin-btn admin-btn-secondary" onClick={() => setConfirmar(null)}>Cancelar</button>
              <button className="admin-btn admin-btn-danger" onClick={() => eliminarUsuario(confirmar.uid)}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
