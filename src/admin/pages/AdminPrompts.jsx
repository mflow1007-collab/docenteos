import { useEffect, useState } from 'react'
import {
  collection, onSnapshot, doc, getDoc, setDoc, deleteDoc,
  query, orderBy, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../firebase.js'
import { FUNDAMENTO_BASE, FUNDAMENTO_POR_NIVEL } from '../../data/fundamentoDoctrinalMINERD.js'
import { FUNDAMENTO_CONFIG_DOC, invalidarCacheFundamento } from '../../services/fundamentoDoctrinalService.js'

const CATEGORIAS = [
  'Planificación diaria', 'Evaluación', 'Retroalimentación', 'Comunicación',
  'Diagnóstico', 'Creatividad', 'Administración', 'Otro',
]

const FORM_VACIO = { nombre: '', categoria: '', prompt: '', usoPrevisto: '', estado: 'activo' }

// B2 — Fundamento doctrinal: campos del doc config/fundamento-doctrinal.
// Campo vacío = se usa el texto de fábrica (fallback local); el placeholder
// muestra ese texto para que el admin sepa exactamente qué está vigente.
const CAMPOS_FUNDAMENTO = [
  { clave: 'base', etiqueta: 'Marco común (todos los niveles)', defecto: FUNDAMENTO_BASE },
  { clave: 'Inicial', etiqueta: 'Nivel Inicial', defecto: FUNDAMENTO_POR_NIVEL.Inicial },
  { clave: 'Primaria', etiqueta: 'Nivel Primario', defecto: FUNDAMENTO_POR_NIVEL.Primaria },
  { clave: 'Secundaria', etiqueta: 'Nivel Secundario', defecto: FUNDAMENTO_POR_NIVEL.Secundaria },
]

export default function AdminPrompts() {
  const [prompts,   setPrompts]   = useState([])
  const [cargando,  setCargando]  = useState(true)
  const [busqueda,  setBusqueda]  = useState('')
  const [filtroCat, setFiltroCat] = useState('todos')
  const [modal,     setModal]     = useState(null)
  const [form,      setForm]      = useState(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error,     setError]     = useState('')
  const [confirmar, setConfirmar] = useState(null)
  const [preview,   setPreview]   = useState(null)

  useEffect(() => {
    let q
    try { q = query(collection(db, 'promptsIA'), orderBy('fechaCreacion', 'desc')) }
    catch { q = collection(db, 'promptsIA') }
    const unsub = onSnapshot(q,
      (snap) => { setPrompts(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setCargando(false) },
      ()     => { setCargando(false) }
    )
    return unsub
  }, [])

  // B2 — Fundamento doctrinal editable sin deploy (config/fundamento-doctrinal)
  const [fundamento, setFundamento] = useState({ base: '', Inicial: '', Primaria: '', Secundaria: '' })
  const [fundActivo, setFundActivo] = useState(true)
  const [fundAbierto, setFundAbierto] = useState(false)
  const [fundGuardando, setFundGuardando] = useState(false)
  const [fundMsg, setFundMsg] = useState('')
  useEffect(() => {
    let vivo = true
    getDoc(doc(db, 'config', FUNDAMENTO_CONFIG_DOC))
      .then((snap) => {
        if (!vivo || !snap.exists()) return
        const d = snap.data()
        setFundamento({
          base: d.base || '', Inicial: d.Inicial || '', Primaria: d.Primaria || '', Secundaria: d.Secundaria || '',
        })
        setFundActivo(d.activo !== false)
      })
      .catch(() => {})
    return () => { vivo = false }
  }, [])

  const guardarFundamento = async () => {
    setFundGuardando(true)
    setFundMsg('')
    try {
      await setDoc(doc(db, 'config', FUNDAMENTO_CONFIG_DOC), {
        base: fundamento.base.trim(),
        Inicial: fundamento.Inicial.trim(),
        Primaria: fundamento.Primaria.trim(),
        Secundaria: fundamento.Secundaria.trim(),
        activo: fundActivo,
        actualizadoEn: serverTimestamp(),
      }, { merge: true })
      invalidarCacheFundamento()
      setFundMsg('✓ Fundamento guardado. Rige en las próximas generaciones (caché de 5 min).')
    } catch (err) {
      setFundMsg(`❌ ${err.message}`)
    } finally {
      setFundGuardando(false)
    }
  }

  const abrirNuevo  = () => { setForm(FORM_VACIO); setError(''); setModal('nuevo') }
  const abrirEditar = (p) => { setForm({ ...FORM_VACIO, ...p }); setError(''); setModal(p) }

  const duplicar = async (p) => {
    const id = `prompt_${Date.now()}`
    const { ...rest } = p
    await setDoc(doc(db, 'promptsIA', id), {
      ...rest,
      nombre: `${p.nombre} (copia)`,
      estado: 'borrador',
      fechaCreacion: serverTimestamp(),
      actualizadoEn: serverTimestamp(),
    }, { merge: true }).catch((err) => console.error('[AdminPrompts] duplicar:', err))
  }

  const guardar = async () => {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio.'); return }
    if (!form.prompt.trim()) { setError('El prompt no puede estar vacío.'); return }
    setGuardando(true); setError('')
    try {
      const id = modal === 'nuevo' ? `prompt_${Date.now()}` : modal.id
      await setDoc(doc(db, 'promptsIA', id), {
        nombre:             form.nombre,
        categoria:          form.categoria || 'Otro',
        prompt:             form.prompt,
        usoPrevisto:        form.usoPrevisto,
        estado:             form.estado || 'activo',
        fechaActualizacion: serverTimestamp(),
        ...(modal === 'nuevo' ? { fechaCreacion: serverTimestamp() } : {}),
      }, { merge: true })
      setModal(null)
    } catch (err) { setError('Error al guardar: ' + err.message) }
    finally { setGuardando(false) }
  }

  const eliminar = async (id) => {
    try { await deleteDoc(doc(db, 'promptsIA', id)) }
    catch (err) { console.error('[AdminPrompts] eliminar:', err) }
    setConfirmar(null)
  }

  const toggleEstado = async (p) => {
    const nuevo = p.estado === 'activo' ? 'inactivo' : 'activo'
    try { await setDoc(doc(db, 'promptsIA', p.id), { estado: nuevo }, { merge: true }) }
    catch (err) { console.error('[AdminPrompts] toggle:', err) }
  }

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const filtrados = prompts.filter((p) => {
    const q = busqueda.toLowerCase()
    return (
      (!q || p.nombre?.toLowerCase().includes(q) || p.prompt?.toLowerCase().includes(q)) &&
      (filtroCat === 'todos' || p.categoria === filtroCat)
    )
  })

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div className="admin-page-header-text">
          <h2>Banco de Prompts IA</h2>
          <p>{prompts.length} prompts en el sistema.</p>
        </div>
        <button className="admin-btn admin-btn-primary" onClick={abrirNuevo}>+ Nuevo prompt</button>
      </div>

      {/* ── B2: Fundamento doctrinal por nivel (editable sin deploy) ── */}
      <div style={{ background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 12, marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setFundAbierto((v) => !v)}
          style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: 'transparent', border: 0, cursor: 'pointer', textAlign: 'left' }}
        >
          <span>
            <strong style={{ fontSize: 14, color: '#1e3a8a' }}>📜 Fundamento Doctrinal MINERD (por nivel)</strong>
            <small style={{ display: 'block', fontSize: 12, color: '#3b82f6', marginTop: 2 }}>
              La doctrina que cada componente de IA interioriza según el nivel. Campo vacío = texto de fábrica (se muestra de fondo).
            </small>
          </span>
          <span style={{ fontSize: 12, color: '#64748b' }}>{fundAbierto ? '▲ Cerrar' : '▼ Editar'}</span>
        </button>
        {fundAbierto && (
          <div style={{ padding: '0 18px 16px', display: 'grid', gap: 12 }}>
            {CAMPOS_FUNDAMENTO.map(({ clave, etiqueta, defecto }) => (
              <label key={clave} style={{ display: 'block' }}>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#1e3a8a', marginBottom: 4 }}>
                  {etiqueta} {fundamento[clave].trim() ? <em style={{ color: '#15803d' }}>(personalizado)</em> : <em style={{ color: '#94a3b8' }}>(texto de fábrica)</em>}
                </span>
                <textarea
                  value={fundamento[clave]}
                  onChange={(e) => setFundamento((f) => ({ ...f, [clave]: e.target.value }))}
                  placeholder={defecto}
                  rows={4}
                  style={{ width: '100%', fontSize: 12.5, lineHeight: 1.5, padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', resize: 'vertical', fontFamily: 'inherit' }}
                />
              </label>
            ))}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: fundActivo ? '#15803d' : '#b91c1c', cursor: 'pointer' }}>
              <input type="checkbox" checked={fundActivo} onChange={(e) => setFundActivo(e.target.checked)} />
              {fundActivo
                ? 'Inyección ACTIVA: todas las mentes de IA anteponen esta doctrina'
                : '⚠️ Inyección APAGADA: las mentes usan solo su rol base (interruptor de emergencia)'}
            </label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button className="admin-btn admin-btn-primary" onClick={guardarFundamento} disabled={fundGuardando}>
                {fundGuardando ? '⏳ Guardando…' : '💾 Guardar fundamento'}
              </button>
              {fundMsg && <small style={{ fontSize: 12, fontWeight: 600, color: fundMsg.startsWith('❌') ? '#dc2626' : '#15803d' }}>{fundMsg}</small>}
            </div>
          </div>
        )}
      </div>

      <div className="admin-toolbar">
        <input
          className="admin-search"
          placeholder="Buscar por nombre o contenido…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <div className="admin-filter-btns">
          {['todos', ...CATEGORIAS].map((c) => (
            <button
              key={c}
              className={`admin-filter-btn${filtroCat === c ? ' active' : ''}`}
              onClick={() => setFiltroCat(c)}
            >
              {c === 'todos' ? 'Todos' : c}
            </button>
          ))}
        </div>
      </div>

      {cargando ? (
        <div className="admin-loading"><div className="admin-spinner" />Cargando prompts…</div>
      ) : filtrados.length === 0 ? (
        <div className="admin-empty">
          <span className="admin-empty-icon">✨</span>
          <h3>Sin prompts registrados</h3>
          <p>Crea el primer prompt IA con el botón &quot;Nuevo prompt&quot;.</p>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Uso previsto</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.nombre}</strong>
                    <br />
                    <small style={{ color: 'var(--adm-dim)' }}>
                      {p.prompt?.slice(0, 60)}{p.prompt?.length > 60 ? '…' : ''}
                    </small>
                  </td>
                  <td><span className="admin-tag">{p.categoria || 'Otro'}</span></td>
                  <td><small>{p.usoPrevisto || '—'}</small></td>
                  <td>
                    <span className={`admin-badge ${p.estado === 'activo' ? 'badge-activo' : 'badge-inactivo'}`}>
                      {p.estado || 'activo'}
                    </span>
                  </td>
                  <td>
                    <div className="admin-row-actions">
                      <button className="admin-btn-sm blue"  onClick={() => setPreview(p)}>Ver</button>
                      <button className="admin-btn-sm ghost" onClick={() => abrirEditar(p)}>Editar</button>
                      <button className="admin-btn-sm ghost" onClick={() => duplicar(p)}>Duplicar</button>
                      <button className="admin-btn-sm yellow" onClick={() => toggleEstado(p)}>
                        {p.estado === 'activo' ? 'Desactivar' : 'Activar'}
                      </button>
                      <button className="admin-btn-sm red" onClick={() => setConfirmar(p.id)}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal crear/editar */}
      {modal !== null && (
        <div className="admin-modal-overlay" onClick={() => setModal(null)}>
          <div className="admin-modal admin-modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>{modal === 'nuevo' ? 'Nuevo prompt IA' : `Editar: ${modal.nombre}`}</h3>
              <button className="admin-modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="admin-modal-body">
              {error && <div className="admin-alert error">{error}</div>}
              <div className="admin-form-grid">
                <div className="admin-form-group">
                  <label className="admin-form-label">Nombre *</label>
                  <input className="admin-form-input" value={form.nombre} onChange={(e) => setField('nombre', e.target.value)} placeholder="Nombre descriptivo del prompt" />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Categoría</label>
                  <select className="admin-form-select" value={form.categoria} onChange={(e) => setField('categoria', e.target.value)}>
                    <option value="">Seleccionar…</option>
                    {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Uso previsto</label>
                  <input className="admin-form-input" value={form.usoPrevisto} onChange={(e) => setField('usoPrevisto', e.target.value)} placeholder="Ej: Generar plan de clase semanal" />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Estado</label>
                  <select className="admin-form-select" value={form.estado} onChange={(e) => setField('estado', e.target.value)}>
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                    <option value="borrador">Borrador</option>
                  </select>
                </div>
                <div className="admin-form-group full">
                  <label className="admin-form-label">Prompt *</label>
                  <textarea className="admin-form-textarea" rows={8} value={form.prompt} onChange={(e) => setField('prompt', e.target.value)} placeholder="Escribe el prompt completo aquí. Puedes usar variables como {grado}, {area}, {fecha}…" />
                </div>
              </div>
            </div>
            <div className="admin-modal-footer">
              <button className="admin-btn admin-btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="admin-btn admin-btn-primary" onClick={guardar} disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar prompt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: preview */}
      {preview && (
        <div className="admin-modal-overlay" onClick={() => setPreview(null)}>
          <div className="admin-modal admin-modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>{preview.nombre}</h3>
              <button className="admin-modal-close" onClick={() => setPreview(null)}>✕</button>
            </div>
            <div className="admin-modal-body">
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <span className="admin-tag">{preview.categoria || 'Otro'}</span>
                <span className={`admin-badge ${preview.estado === 'activo' ? 'badge-activo' : 'badge-inactivo'}`}>{preview.estado}</span>
              </div>
              {preview.usoPrevisto && (
                <p style={{ color: 'var(--adm-muted)', marginBottom: 12, fontSize: 13 }}>{preview.usoPrevisto}</p>
              )}
              <div className="admin-prompt-preview">{preview.prompt}</div>
            </div>
            <div className="admin-modal-footer">
              <button className="admin-btn admin-btn-secondary" onClick={() => { setPreview(null); abrirEditar(preview) }}>Editar</button>
              <button className="admin-btn admin-btn-secondary" onClick={() => setPreview(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar eliminación */}
      {confirmar && (
        <div className="admin-modal-overlay" onClick={() => setConfirmar(null)}>
          <div className="admin-modal admin-modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>Eliminar prompt</h3>
              <button className="admin-modal-close" onClick={() => setConfirmar(null)}>✕</button>
            </div>
            <div className="admin-modal-body">
              <span className="admin-confirm-icon">⚠️</span>
              <p className="admin-confirm-text">¿Eliminar este prompt?</p>
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
