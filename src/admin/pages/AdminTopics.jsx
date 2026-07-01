import { useState, useEffect, useCallback } from 'react'
import {
  collection, getDocs, addDoc, deleteDoc, updateDoc,
  query, orderBy, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../firebase.js'
import { COLLECTIONS, STATES } from '../../services/ai/knowledge/KnowledgeTypes.js'

// ── Helpers ────────────────────────────────────────────────────────────────────

function normalizarTema(t) {
  return String(t || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, '_').trim()
}

const AREAS = [
  'Lengua Española', 'Matemáticas', 'Ciencias Sociales', 'Ciencias de la Naturaleza',
  'Inglés', 'Francés', 'Educación Física', 'Artes Visuales', 'Educación Artística',
  'Formación Integral, Humana y Religiosa', 'Tecnología e Informática',
]

const ESTADOS_FILTER = [
  { value: 'todos',          label: 'Todos' },
  { value: STATES.ACTIVE,    label: 'Activos' },
  { value: STATES.PENDING,   label: 'Pendientes' },
  { value: STATES.INACTIVE,  label: 'Inactivos' },
]

const ESTADO_BADGE = {
  [STATES.ACTIVE]:   { bg: '#dcfce7', color: '#166534', label: 'Activo' },
  [STATES.PENDING]:  { bg: '#fef9c3', color: '#854d0e', label: 'Pendiente' },
  [STATES.INACTIVE]: { bg: '#f1f5f9', color: '#475569', label: 'Inactivo' },
}

function Badge({ estado }) {
  const c = ESTADO_BADGE[estado] || { bg: '#f1f5f9', color: '#64748b', label: estado }
  return (
    <span style={{ background: c.bg, color: c.color, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
      {c.label}
    </span>
  )
}

const FORM_VACIO = {
  tema: '', asignatura: '', area: '', grado: '', nivel: '',
  reglas: '', vocabulario: '', gramatica: '', funcionesComunicativas: '', pronunciacion: '',
  estado: STATES.ACTIVE,
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function AdminTopics() {
  const [topics, setTopics]         = useState([])
  const [cargando, setCargando]     = useState(true)
  const [error, setError]           = useState('')
  const [filtroEstado, setFiltro]   = useState('todos')
  const [filtroArea, setFiltroArea] = useState('')
  const [busqueda, setBusqueda]     = useState('')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm]             = useState(FORM_VACIO)
  const [guardando, setGuardando]   = useState(false)
  const [editId, setEditId]         = useState(null)

  const cargar = useCallback(async () => {
    if (!db) { setCargando(false); return }
    setCargando(true); setError('')
    try {
      const q = query(collection(db, COLLECTIONS.KE_TOPICS), orderBy('tema', 'asc'))
      const snap = await getDocs(q)
      setTopics(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (e) {
      setError('Error cargando topics: ' + (e.message || e))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const abrirNuevo = () => {
    setForm(FORM_VACIO); setEditId(null); setMostrarForm(true)
  }

  const abrirEditar = (topic) => {
    setForm({
      tema:                  topic.tema || '',
      asignatura:            topic.asignatura || '',
      area:                  topic.area || '',
      grado:                 topic.grado || '',
      nivel:                 topic.nivel || '',
      reglas:                (topic.reglas || []).join('\n'),
      vocabulario:           (topic.vocabulario || []).join(', '),
      gramatica:             (topic.gramatica || []).join(', '),
      funcionesComunicativas:(topic.funcionesComunicativas || []).join(', '),
      pronunciacion:         topic.pronunciacion || '',
      estado:                topic.estado || STATES.ACTIVE,
    })
    setEditId(topic.id)
    setMostrarForm(true)
  }

  const guardar = async () => {
    if (!form.tema.trim()) return
    setGuardando(true)
    try {
      const linea = (s) => s.split('\n').map(x => x.trim()).filter(Boolean)
      const coma  = (s) => s.split(',').map(x => x.trim()).filter(Boolean)

      const payload = {
        tema:                  form.tema.trim(),
        temaNormalizado:       normalizarTema(form.tema),
        asignatura:            form.asignatura || null,
        area:                  form.area       || null,
        grado:                 form.grado      || null,
        nivel:                 form.nivel      || null,
        reglas:                linea(form.reglas),
        vocabulario:           coma(form.vocabulario),
        gramatica:             coma(form.gramatica),
        funcionesComunicativas:coma(form.funcionesComunicativas),
        pronunciacion:         form.pronunciacion || null,
        estado:                form.estado,
        updatedAt:             serverTimestamp(),
      }

      if (editId) {
        await updateDoc(doc(db, COLLECTIONS.KE_TOPICS, editId), payload)
      } else {
        await addDoc(collection(db, COLLECTIONS.KE_TOPICS), {
          ...payload,
          creadoEn: serverTimestamp(),
        })
      }
      setMostrarForm(false)
      await cargar()
    } catch (e) {
      setError('Error al guardar: ' + (e.message || e))
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (id) => {
    if (!window.confirm('¿Eliminar este topic? Esta acción no se puede deshacer.')) return
    try {
      await deleteDoc(doc(db, COLLECTIONS.KE_TOPICS, id))
      setTopics(prev => prev.filter(t => t.id !== id))
    } catch (e) {
      setError('Error al eliminar: ' + (e.message || e))
    }
  }

  const cambiarEstado = async (id, estado) => {
    try {
      await updateDoc(doc(db, COLLECTIONS.KE_TOPICS, id), { estado, updatedAt: serverTimestamp() })
      setTopics(prev => prev.map(t => t.id === id ? { ...t, estado } : t))
    } catch (e) {
      setError('Error: ' + (e.message || e))
    }
  }

  const visibles = topics.filter(t => {
    if (filtroEstado !== 'todos' && t.estado !== filtroEstado) return false
    if (filtroArea && t.area !== filtroArea) return false
    if (busqueda && !`${t.tema} ${t.asignatura} ${t.area}`.toLowerCase().includes(busqueda.toLowerCase())) return false
    return true
  })

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h2>Topics Pedagógicos</h2>
          <p>Conocimiento estructurado por tema que el Knowledge Engine inyecta en el contexto de planificación.</p>
        </div>
        <button className="admin-btn admin-btn-primary" onClick={abrirNuevo}>
          + Nuevo topic
        </button>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', color: '#dc2626', marginBottom: 16, fontSize: 14 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Buscar tema, asignatura…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, flex: '1 1 180px' }}
        />
        <select
          value={filtroEstado}
          onChange={e => setFiltro(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
        >
          {ESTADOS_FILTER.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          value={filtroArea}
          onChange={e => setFiltroArea(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
        >
          <option value="">Todas las áreas</option>
          {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <button className="admin-btn" onClick={cargar} disabled={cargando}>
          {cargando ? 'Cargando…' : '↺'}
        </button>
      </div>

      {/* Modal formulario */}
      {mostrarForm && (
        <div style={{
          position: 'fixed', inset: 0, background: '#00000055', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 560,
            maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px #0002',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                {editId ? 'Editar topic' : 'Nuevo topic'}
              </h3>
              <button onClick={() => setMostrarForm(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' }}>✕</button>
            </div>

            {[
              { key: 'tema',       label: 'Tema *',       ph: 'Ej: El texto narrativo' },
              { key: 'asignatura', label: 'Asignatura',   ph: 'Ej: Lengua Española' },
              { key: 'grado',      label: 'Grado',        ph: 'Ej: 4to' },
              { key: 'nivel',      label: 'Nivel',        ph: 'Ej: Primaria' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>{f.label}</label>
                <input
                  type="text"
                  value={form[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.ph}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
            ))}

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Área</label>
              <select
                value={form.area}
                onChange={e => setForm(p => ({ ...p, area: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
              >
                <option value="">— Sin área —</option>
                {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            {[
              { key: 'reglas',                label: 'Reglas / Criterios',         ph: 'Una regla por línea' },
              { key: 'vocabulario',           label: 'Vocabulario clave',          ph: 'Separado por comas' },
              { key: 'gramatica',             label: 'Gramática',                  ph: 'Separado por comas' },
              { key: 'funcionesComunicativas',label: 'Funciones comunicativas',    ph: 'Separado por comas' },
              { key: 'pronunciacion',         label: 'Pronunciación / notas',      ph: '' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>{f.label}</label>
                <textarea
                  value={form[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.ph}
                  rows={f.key === 'reglas' ? 3 : 2}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
            ))}

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Estado</label>
              <select
                value={form.estado}
                onChange={e => setForm(p => ({ ...p, estado: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
              >
                <option value={STATES.ACTIVE}>Activo</option>
                <option value={STATES.PENDING}>Pendiente</option>
                <option value={STATES.INACTIVE}>Inactivo</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="admin-btn admin-btn-secondary" onClick={() => setMostrarForm(false)}>Cancelar</button>
              <button className="admin-btn admin-btn-primary" onClick={guardar} disabled={guardando || !form.tema.trim()}>
                {guardando ? 'Guardando…' : (editId ? 'Actualizar' : 'Crear topic')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabla */}
      {cargando ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Cargando topics…</div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
            {visibles.length} topics{filtroEstado !== 'todos' || filtroArea || busqueda ? ' (filtrado)' : ''} de {topics.length} total
          </div>
          {visibles.length === 0 ? (
            <div className="admin-table-empty">Sin topics para estos filtros.</div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Tema</th>
                    <th>Área / Asignatura</th>
                    <th style={{ width: 80 }}>Grado</th>
                    <th style={{ width: 80 }}>Reglas</th>
                    <th style={{ width: 80 }}>Estado</th>
                    <th style={{ width: 160 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map(t => (
                    <tr key={t.id}>
                      <td>
                        <strong>{t.tema}</strong>
                        {t.vocabulario?.length > 0 && (
                          <small style={{ display: 'block' }}>Vocab: {t.vocabulario.slice(0, 3).join(', ')}{t.vocabulario.length > 3 ? '…' : ''}</small>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: 13 }}>{t.area || '—'}</div>
                        {t.asignatura && <small>{t.asignatura}</small>}
                      </td>
                      <td><small>{t.grado || '—'}</small></td>
                      <td style={{ textAlign: 'center', color: '#64748b' }}>{t.reglas?.length ?? 0}</td>
                      <td><Badge estado={t.estado} /></td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          <button className="admin-btn-sm blue" onClick={() => abrirEditar(t)}>Editar</button>
                          {t.estado !== STATES.ACTIVE && (
                            <button className="admin-btn-sm green" onClick={() => cambiarEstado(t.id, STATES.ACTIVE)}>Activar</button>
                          )}
                          {t.estado === STATES.ACTIVE && (
                            <button className="admin-btn-sm yellow" onClick={() => cambiarEstado(t.id, STATES.INACTIVE)}>Pausar</button>
                          )}
                          <button className="admin-btn-sm red" onClick={() => eliminar(t.id)}>Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
