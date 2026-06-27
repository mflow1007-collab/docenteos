import { useState, useEffect, useCallback, useRef } from 'react'
import { collection, getDocs, query, where, orderBy, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase.js'
import { AGENT_IDS, COLLECTIONS, STATES, MEMORY_TYPES, MEMORY_SOURCES } from '../../services/ai/knowledge/KnowledgeTypes.js'
import {
  crearMemoria, aprobarMemoria, desactivarMemoria,
  archivarMemoria, editarMemoria, obtenerMemorias,
} from '../../services/ai/memory/AgentMemoryService.js'
import { AIService } from '../../services/ai/AIService.js'
import { getPendingInsights, resolveInsight, analyzePatterns } from '../../services/ai/learning/InsightAnalyzer.js'
import { getEstilos, aprobarPlantilla, rechazarPlantilla, cambiarVisibilidad } from '../../services/ai/style/StyleQuery.js'
import { sembrarDatosIniciales, hayDatosSembrados } from '../../services/ai/knowledge/seedData.js'
import {
  getCasosExito, aprobarCasoExito, rechazarCasoExito,
  editarCasoExito, marcarGlobal,
} from '../../services/ai/CasosExitoService.js'
import { cicloOptimizacion } from '../../services/ai/agents/AgenteOptimizador.js'
import './AdminEntrenamientoIA.css'

// ── Nombres de agentes ────────────────────────────────────────────────────────
const AGENT_NAMES = {
  [AGENT_IDS.AUDITOR]:               'Auditor Pedagógico',
  [AGENT_IDS.PLANIFICADOR]:          'Planificador',
  [AGENT_IDS.MEJORADOR_ACTIVIDADES]: 'Mejorador de Actividades',
  [AGENT_IDS.GENERADOR_INSTRUMENTOS]:'Generador de Instrumentos',
  [AGENT_IDS.GENERADOR_REPORTES]:    'Generador de Reportes',
  [AGENT_IDS.CHAT_DOCENTE]:          'Chat Docente',
}

const ALL_AGENTS = Object.values(AGENT_IDS)

const TABS = [
  { id: 'agentes',      label: 'Agentes' },
  { id: 'topics',       label: 'Topics' },
  { id: 'insights',     label: 'Insights' },
  { id: 'casos-exito',  label: 'Casos de Éxito' },
  { id: 'estilos',      label: 'Estilos' },
  { id: 'bic',          label: 'BIC' },
]

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtTs = (ts) => {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' })
}

const truncate = (str, n = 100) =>
  str && str.length > n ? str.slice(0, n) + '…' : (str || '')

// ── Badge helpers ─────────────────────────────────────────────────────────────
function MemoryTypeBadge({ tipo }) {
  return <span className={`aeia-badge aeia-badge--${tipo || 'regla'}`}>{tipo || '—'}</span>
}

function MemoryStateBadge({ estado }) {
  return <span className={`aeia-badge aeia-badge--${estado || 'pendiente'}`}>{estado || '—'}</span>
}

// ── Formulario vacío ──────────────────────────────────────────────────────────
const EMPTY_FORM = {
  tipo:                 MEMORY_TYPES.REGLA,
  contenido:            '',
  prioridad:            5,
  areaAplicable:        '',
  asignaturaAplicable:  '',
  temaAplicable:        '',
}

// ── Modal: Nueva / Editar memoria ─────────────────────────────────────────────
function ModalMemoria({ agentId, agentName, memoriaEditar, onSaved, onClose }) {
  const [form,    setForm]    = useState(
    memoriaEditar
      ? {
          tipo:                 memoriaEditar.tipo                ?? MEMORY_TYPES.REGLA,
          contenido:            memoriaEditar.contenido           ?? '',
          prioridad:            memoriaEditar.prioridad           ?? 5,
          areaAplicable:        memoriaEditar.areaAplicable       ?? '',
          asignaturaAplicable:  memoriaEditar.asignaturaAplicable ?? '',
          temaAplicable:        memoriaEditar.temaAplicable       ?? '',
        }
      : { ...EMPTY_FORM }
  )
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState(null)

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const handleGuardar = async () => {
    if (!form.contenido.trim()) { setError('El contenido es obligatorio.'); return }
    setSaving(true)
    setError(null)
    try {
      if (memoriaEditar) {
        await editarMemoria(agentId, memoriaEditar.id, {
          tipo:                form.tipo,
          contenido:           form.contenido.trim(),
          prioridad:           Number(form.prioridad),
          areaAplicable:       form.areaAplicable       || null,
          asignaturaAplicable: form.asignaturaAplicable || null,
          temaAplicable:       form.temaAplicable       || null,
        })
      } else {
        await crearMemoria(agentId, {
          tipo:                form.tipo,
          contenido:           form.contenido.trim(),
          prioridad:           Number(form.prioridad),
          areaAplicable:       form.areaAplicable       || null,
          asignaturaAplicable: form.asignaturaAplicable || null,
          temaAplicable:       form.temaAplicable       || null,
          fuente:              'admin',
        })
      }
      onSaved()
    } catch (e) {
      if (import.meta.env.DEV) console.debug('[AdminEntrenamientoIA] guardar memoria:', e)
      setError('Error al guardar. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="admin-modal">
        <div className="admin-modal-header">
          <h3>{memoriaEditar ? 'Editar memoria' : 'Nueva memoria'} — {agentName}</h3>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal-body">
          <div className="aeia-modal-form">
            <div className="admin-form-group">
              <label className="admin-form-label">Tipo</label>
              <select
                className="admin-form-select"
                value={form.tipo}
                onChange={e => set('tipo', e.target.value)}
              >
                {Object.values(MEMORY_TYPES).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Contenido</label>
              <textarea
                className="admin-form-textarea"
                rows={4}
                placeholder="Describe la regla, criterio o preferencia para este agente..."
                value={form.contenido}
                onChange={e => set('contenido', e.target.value)}
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Prioridad (1–10)</label>
              <input
                type="number"
                min={1}
                max={10}
                className="admin-form-input"
                value={form.prioridad}
                onChange={e => set('prioridad', e.target.value)}
              />
              <span className="admin-form-hint">10 = mayor prioridad al inyectar en el prompt</span>
            </div>

            <div className="admin-form-grid">
              <div className="admin-form-group">
                <label className="admin-form-label">Área (opcional)</label>
                <input
                  type="text"
                  className="admin-form-input"
                  placeholder="Ej: Ciencias de la Naturaleza"
                  value={form.areaAplicable}
                  onChange={e => set('areaAplicable', e.target.value)}
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Asignatura (opcional)</label>
                <input
                  type="text"
                  className="admin-form-input"
                  placeholder="Ej: Matemática"
                  value={form.asignaturaAplicable}
                  onChange={e => set('asignaturaAplicable', e.target.value)}
                />
              </div>
              <div className="admin-form-group full">
                <label className="admin-form-label">Tema (opcional)</label>
                <input
                  type="text"
                  className="admin-form-input"
                  placeholder="Ej: Fracciones"
                  value={form.temaAplicable}
                  onChange={e => set('temaAplicable', e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="admin-alert error">{error}</div>
            )}
          </div>
        </div>
        <div className="admin-modal-footer">
          <button className="admin-btn admin-btn-primary" onClick={handleGuardar} disabled={saving}>
            {saving ? 'Guardando…' : memoriaEditar ? 'Guardar cambios' : 'Crear memoria'}
          </button>
          <button className="admin-btn admin-btn-secondary" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// ── Lista de memorias de un agente ────────────────────────────────────────────
function MemoriasAgente({ agentId, agentName, onClose }) {
  const [memorias,   setMemorias]  = useState([])
  const [loading,    setLoading]   = useState(true)
  const [msg,        setMsg]       = useState(null)
  const [modalNueva, setModalNueva]= useState(false)
  const [editando,   setEditando]  = useState(null)
  const [procesando, setProcesando]= useState({})

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const data = await obtenerMemorias(agentId)
      setMemorias(data)
    } catch (e) {
      if (import.meta.env.DEV) console.debug('[AdminEntrenamientoIA] cargar memorias:', e)
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => { cargar() }, [cargar])

  const flash = (text, ok = true) => {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 3000)
  }

  const accion = async (fn, label, memId) => {
    setProcesando(p => ({ ...p, [memId]: true }))
    try {
      await fn()
      flash(`${label} correctamente.`)
      await cargar()
    } catch {
      flash(`Error al ${label.toLowerCase()}.`, false)
    } finally {
      setProcesando(p => ({ ...p, [memId]: false }))
    }
  }

  const activas  = memorias.filter(m => m.estado === STATES.ACTIVE).length
  const pending  = memorias.filter(m => m.estado === STATES.PENDING).length

  return (
    <div className="aeia-memory-panel">
      <div className="aeia-memory-panel-header">
        <div>
          <h3 className="aeia-memory-panel-title">{agentName}</h3>
          <span style={{ fontSize: 12, color: 'var(--adm-dim)' }}>
            {activas} activas · {pending} pendientes · {memorias.length} total
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="admin-btn admin-btn-primary"
            onClick={() => setModalNueva(true)}
          >
            + Nueva memoria
          </button>
          <button className="admin-btn admin-btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>

      {msg && (
        <div className={`admin-alert ${msg.ok ? 'success' : 'error'}`} style={{ marginBottom: 12 }}>
          {msg.text}
        </div>
      )}

      {loading ? (
        <div className="admin-loading"><div className="admin-spinner" />Cargando memorias…</div>
      ) : memorias.length === 0 ? (
        <div className="admin-empty">
          <span className="admin-empty-icon">🧠</span>
          <h3>Sin memorias</h3>
          <p>Este agente no tiene memorias todavía. Crea la primera con el botón de arriba.</p>
        </div>
      ) : (
        <div className="aeia-memory-list">
          {memorias.map(mem => (
            <div key={mem.id} className="aeia-memory-item">
              <div className="aeia-memory-item-top">
                <div className="aeia-memory-content">
                  {truncate(mem.contenido, 160)}
                </div>
                <div className="aeia-memory-badges">
                  <MemoryTypeBadge tipo={mem.tipo} />
                  <MemoryStateBadge estado={mem.estado} />
                </div>
              </div>

              {(mem.areaAplicable || mem.asignaturaAplicable || mem.temaAplicable) && (
                <div className="aeia-memory-scope">
                  {[mem.areaAplicable, mem.asignaturaAplicable, mem.temaAplicable]
                    .filter(Boolean).join(' › ')}
                </div>
              )}

              <div className="aeia-memory-actions">
                {mem.estado === STATES.PENDING && (
                  <button
                    className="admin-btn-sm green"
                    disabled={procesando[mem.id]}
                    onClick={() => accion(() => aprobarMemoria(agentId, mem.id), 'Aprobado', mem.id)}
                  >
                    Aprobar
                  </button>
                )}
                {mem.estado === STATES.ACTIVE && (
                  <button
                    className="admin-btn-sm yellow"
                    disabled={procesando[mem.id]}
                    onClick={() => accion(() => desactivarMemoria(agentId, mem.id), 'Desactivado', mem.id)}
                  >
                    Desactivar
                  </button>
                )}
                <button
                  className="admin-btn-sm ghost"
                  disabled={procesando[mem.id]}
                  onClick={() => setEditando(mem)}
                >
                  Editar
                </button>
                <button
                  className="admin-btn-sm red"
                  disabled={procesando[mem.id]}
                  onClick={() => accion(() => archivarMemoria(agentId, mem.id), 'Archivado', mem.id)}
                >
                  Archivar
                </button>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--adm-dim)' }}>
                  p:{mem.prioridad ?? 5}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalNueva && (
        <ModalMemoria
          agentId={agentId}
          agentName={agentName}
          onSaved={() => { setModalNueva(false); cargar() }}
          onClose={() => setModalNueva(false)}
        />
      )}

      {editando && (
        <ModalMemoria
          agentId={agentId}
          agentName={agentName}
          memoriaEditar={editando}
          onSaved={() => { setEditando(null); cargar() }}
          onClose={() => setEditando(null)}
        />
      )}
    </div>
  )
}

// ── Hook: resumen de memorias por agente ──────────────────────────────────────
function useAgentSummaries() {
  const [summaries, setSummaries] = useState({})
  const [loading,   setLoading]   = useState(true)

  const cargar = useCallback(async () => {
    if (!db) { setLoading(false); return }
    setLoading(true)
    try {
      const results = await Promise.all(
        ALL_AGENTS.map(async agentId => {
          const mems = await obtenerMemorias(agentId)
          return {
            agentId,
            total:    mems.length,
            activas:  mems.filter(m => m.estado === STATES.ACTIVE).length,
            pending:  mems.filter(m => m.estado === STATES.PENDING).length,
          }
        })
      )
      const map = {}
      results.forEach(r => { map[r.agentId] = r })
      setSummaries(map)
    } catch (e) {
      if (import.meta.env.DEV) console.debug('[AdminEntrenamientoIA] useAgentSummaries:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])
  return { summaries, loading, reload: cargar }
}

// ── Tab: Agentes ──────────────────────────────────────────────────────────────
function TabAgentes() {
  const { summaries, loading, reload } = useAgentSummaries()
  const [selectedAgent, setSelectedAgent] = useState(null)

  const toggleAgent = (agentId) => {
    setSelectedAgent(prev => prev === agentId ? null : agentId)
  }

  return (
    <div className="aim-tab-body">
      <div className="aim-section-head">
        <h3>Memorias por agente</h3>
        <span className="aim-section-hint">
          Solo las memorias "activo" se inyectan en los prompts de producción
        </span>
        <button className="aim-btn aim-btn-ghost" onClick={reload} style={{ marginLeft: 'auto' }}>
          ↻ Actualizar
        </button>
      </div>

      {loading ? (
        <div className="admin-loading"><div className="admin-spinner" />Cargando agentes…</div>
      ) : (
        <div className="aeia-agent-grid">
          {ALL_AGENTS.map(agentId => {
            const s    = summaries[agentId] || { total: 0, activas: 0, pending: 0 }
            const name = AGENT_NAMES[agentId] || agentId
            const isSel = selectedAgent === agentId

            return (
              <div
                key={agentId}
                className={`aeia-agent-card${isSel ? ' aeia-agent-card--selected' : ''}`}
              >
                <div className="aeia-agent-card-header">
                  <span className="aeia-agent-name">{name}</span>
                  {s.pending > 0 && (
                    <span className="aeia-tab-badge">{s.pending}</span>
                  )}
                </div>

                <div className="aeia-agent-stats">
                  <div className="aeia-agent-stat">
                    <span className="aeia-agent-stat-val">{s.activas}</span>
                    <span className="aeia-agent-stat-label">activas</span>
                  </div>
                  <div className="aeia-agent-stat">
                    <span className={`aeia-agent-stat-val${s.pending > 0 ? ' aeia-agent-stat-val--warn' : ''}`}>
                      {s.pending}
                    </span>
                    <span className="aeia-agent-stat-label">pendientes</span>
                  </div>
                  <div className="aeia-agent-stat">
                    <span className="aeia-agent-stat-val">{s.total}</span>
                    <span className="aeia-agent-stat-label">total</span>
                  </div>
                </div>

                <button
                  className={`aim-btn ${isSel ? 'aim-btn-ghost' : 'aim-btn-primary'}`}
                  onClick={() => toggleAgent(agentId)}
                >
                  {isSel ? 'Cerrar' : 'Ver memorias'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {selectedAgent && (
        <MemoriasAgente
          key={selectedAgent}
          agentId={selectedAgent}
          agentName={AGENT_NAMES[selectedAgent] || selectedAgent}
          onClose={() => { setSelectedAgent(null); reload() }}
        />
      )}
    </div>
  )
}

// ── Hook: Topics ──────────────────────────────────────────────────────────────
function useTopics() {
  const [topics,  setTopics]  = useState([])
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    if (!db) { setLoading(false); return }
    setLoading(true)
    try {
      const snap = await getDocs(
        query(collection(db, COLLECTIONS.KE_TOPICS), orderBy('temaNormalizado'))
      )
      setTopics(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (e) {
      if (import.meta.env.DEV) console.debug('[AdminEntrenamientoIA] useTopics:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])
  return { topics, loading, reload: cargar }
}

// ── Modal: Nuevo Topic ────────────────────────────────────────────────────────
function ModalNuevoTopic({ onSaved, onClose }) {
  const [form,   setForm]   = useState({ temaNormalizado: '', asignatura: '', estado: STATES.ACTIVE })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))

  const handleGuardar = async () => {
    if (!form.temaNormalizado.trim()) { setError('El tema es obligatorio.'); return }
    setSaving(true)
    setError(null)
    try {
      const id = form.temaNormalizado.trim().toLowerCase().replace(/\s+/g, '_')
      await setDoc(doc(db, COLLECTIONS.KE_TOPICS, id), {
        temaNormalizado: form.temaNormalizado.trim().toLowerCase(),
        asignatura:      form.asignatura.trim() || null,
        estado:          form.estado,
        reglas:          [],
        creadoEn:        serverTimestamp(),
      }, { merge: true })
      onSaved()
    } catch {
      setError('Error al guardar el topic.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="admin-modal admin-modal-sm">
        <div className="admin-modal-header">
          <h3>Nuevo topic</h3>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal-body">
          <div className="aeia-modal-form">
            <div className="admin-form-group">
              <label className="admin-form-label">Tema normalizado</label>
              <input
                type="text"
                className="admin-form-input"
                placeholder="Ej: fracciones"
                value={form.temaNormalizado}
                onChange={e => set('temaNormalizado', e.target.value)}
              />
              <span className="admin-form-hint">Se usará como ID en Firestore (en minúsculas)</span>
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Asignatura</label>
              <input
                type="text"
                className="admin-form-input"
                placeholder="Ej: Matemática"
                value={form.asignatura}
                onChange={e => set('asignatura', e.target.value)}
              />
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Estado inicial</label>
              <select
                className="admin-form-select"
                value={form.estado}
                onChange={e => set('estado', e.target.value)}
              >
                <option value={STATES.ACTIVE}>activo</option>
                <option value={STATES.INACTIVE}>inactivo</option>
              </select>
            </div>
            {error && <div className="admin-alert error">{error}</div>}
          </div>
        </div>
        <div className="admin-modal-footer">
          <button className="admin-btn admin-btn-primary" onClick={handleGuardar} disabled={saving}>
            {saving ? 'Guardando…' : 'Crear topic'}
          </button>
          <button className="admin-btn admin-btn-secondary" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// ── TopicTrainingPanel ────────────────────────────────────────────────────────
function TopicTrainingPanel({ topic, onClose }) {
  const [subtab,       setSubtab]       = useState('regla')
  const [memorias,     setMemorias]     = useState([])
  const [loadingMems,  setLoadingMems]  = useState(true)
  const [msg,          setMsg]          = useState(null)
  const [form,         setForm]         = useState({
    tipo: MEMORY_TYPES.REGLA, contenido: '', prioridad: 7, aprobarYa: false,
  })
  const [guardando,    setGuardando]    = useState(false)
  const [pregunta,     setPregunta]     = useState('')
  const [respuestaIA,  setRespuestaIA]  = useState('')
  const [consultando,  setConsultando]  = useState(false)
  const [guardandoIA,  setGuardandoIA]  = useState(false)
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const flash = (text, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 3500) }

  const cargarMemorias = useCallback(async () => {
    setLoadingMems(true)
    try {
      const data = await obtenerMemorias(AGENT_IDS.PLANIFICADOR, { topicId: topic.id })
      setMemorias(data)
    } catch {}
    finally { setLoadingMems(false) }
  }, [topic.id])

  useEffect(() => { cargarMemorias() }, [cargarMemorias])

  const guardarRegla = async () => {
    if (!form.contenido.trim()) { flash('El contenido es obligatorio.', false); return }
    setGuardando(true)
    try {
      await crearMemoria(AGENT_IDS.PLANIFICADOR, {
        tipo:                form.tipo,
        contenido:           form.contenido.trim(),
        prioridad:           Number(form.prioridad),
        topicId:             topic.id,
        temaAplicable:       topic.temaNormalizado,
        asignaturaAplicable: topic.asignatura || null,
        fuente:              MEMORY_SOURCES.ADMIN,
        estado:              form.aprobarYa ? STATES.ACTIVE : STATES.PENDING,
      })
      flash(`Memoria ${form.aprobarYa ? 'creada y aprobada' : 'creada como pendiente'}.`)
      setF('contenido', '')
      await cargarMemorias()
    } catch { flash('Error al guardar la memoria.', false) }
    finally { setGuardando(false) }
  }

  const consultarIA = () => {
    if (!pregunta.trim()) return
    setConsultando(true)
    setRespuestaIA('')

    const memCtx = memorias
      .filter(m => m.estado === STATES.ACTIVE)
      .map(m => `- [${m.tipo}] ${m.contenido}`)
      .join('\n') || '(ninguna todavía)'

    const topicCtx = [
      `Tema: ${topic.temaNormalizado}`,
      topic.asignatura && `Asignatura: ${topic.asignatura}`,
      Array.isArray(topic.reglas) && topic.reglas.length > 0 && `Reglas del topic: ${topic.reglas.join(', ')}`,
    ].filter(Boolean).join('\n')

    AIService.generate({
      module: 'auditoria',
      system: `Eres un especialista en educación dominicana (MINERD). Ayudas al administrador de DocenteOS a definir instrucciones precisas para el agente Planificador. Tus sugerencias deben ser concretas, accionables y alineadas con el currículo MINERD.`,
      prompt: `Contexto del topic:\n${topicCtx}\n\nMemorias activas para este topic:\n${memCtx}\n\nPregunta del administrador:\n${pregunta}`,
      maxTokens: 500,
      onChunk:  t => setRespuestaIA(prev => prev + t),
      onFinish: () => setConsultando(false),
      onError:  () => { flash('Error al consultar la IA.', false); setConsultando(false) },
    })
  }

  const guardarRespuestaIA = async () => {
    if (!respuestaIA.trim()) return
    setGuardandoIA(true)
    try {
      await crearMemoria(AGENT_IDS.PLANIFICADOR, {
        tipo:                MEMORY_TYPES.RECOMENDACION,
        contenido:           respuestaIA.trim(),
        prioridad:           6,
        topicId:             topic.id,
        temaAplicable:       topic.temaNormalizado,
        asignaturaAplicable: topic.asignatura || null,
        fuente:              MEMORY_SOURCES.ADMIN,
        estado:              STATES.PENDING,
      })
      flash('Respuesta guardada como memoria pendiente.')
      setRespuestaIA('')
      setPregunta('')
      await cargarMemorias()
    } catch { flash('Error al guardar.', false) }
    finally { setGuardandoIA(false) }
  }

  return (
    <div className="aeia-training-panel">
      <div className="aeia-training-panel-header">
        <div>
          <h4 className="aeia-training-panel-title">
            🧠 Entrenar topic: <strong>{topic.temaNormalizado}</strong>
            {topic.asignatura && (
              <span style={{ fontWeight: 400, color: 'var(--adm-muted)', fontSize: 13 }}>
                {' · '}{topic.asignatura}
              </span>
            )}
          </h4>
          <span style={{ fontSize: 11, color: 'var(--adm-dim)' }}>
            {loadingMems ? '…' : `${memorias.length} memori${memorias.length !== 1 ? 'as' : 'a'}`} asociada{memorias.length !== 1 ? 's' : ''} a este topic
          </span>
        </div>
        <button className="admin-btn admin-btn-secondary" onClick={onClose}>✕ Cerrar</button>
      </div>

      {msg && (
        <div className={`admin-alert ${msg.ok ? 'success' : 'error'}`} style={{ margin: '8px 0' }}>
          {msg.text}
        </div>
      )}

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
        <button
          className={`aim-tab-btn${subtab === 'regla' ? ' aim-tab-btn--active' : ''}`}
          style={{ fontSize: 12 }}
          onClick={() => setSubtab('regla')}
        >
          ✍️ Agregar regla
        </button>
        <button
          className={`aim-tab-btn${subtab === 'ia' ? ' aim-tab-btn--active' : ''}`}
          style={{ fontSize: 12 }}
          onClick={() => setSubtab('ia')}
        >
          💬 Consultar IA
        </button>
      </div>

      {/* Memorias existentes (colapsable) */}
      {memorias.length > 0 && (
        <details style={{ marginBottom: 14 }}>
          <summary style={{ fontSize: 11, color: 'var(--adm-dim)', cursor: 'pointer', userSelect: 'none' }}>
            Ver {memorias.length} memori{memorias.length !== 1 ? 'as' : 'a'} existente{memorias.length !== 1 ? 's' : ''}
          </summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
            {memorias.map(m => (
              <div key={m.id} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 12 }}>
                <MemoryTypeBadge tipo={m.tipo} />
                <MemoryStateBadge estado={m.estado} />
                <span style={{ flex: 1, color: 'var(--adm-muted)' }}>{truncate(m.contenido, 100)}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Agregar regla */}
      {subtab === 'regla' && (
        <div className="aeia-modal-form">
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="admin-form-group" style={{ flex: 1 }}>
              <label className="admin-form-label">Tipo</label>
              <select
                className="admin-form-select"
                value={form.tipo}
                onChange={e => setF('tipo', e.target.value)}
              >
                {Object.values(MEMORY_TYPES).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="admin-form-group" style={{ width: 80 }}>
              <label className="admin-form-label">Prioridad</label>
              <input
                type="number" min={1} max={10}
                className="admin-form-input"
                value={form.prioridad}
                onChange={e => setF('prioridad', e.target.value)}
              />
            </div>
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Instrucción</label>
            <textarea
              className="admin-form-textarea"
              rows={3}
              placeholder={`Escribe la instrucción para el Planificador cuando trabaje con "${topic.temaNormalizado}"…`}
              value={form.contenido}
              onChange={e => setF('contenido', e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--adm-muted)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.aprobarYa}
                onChange={e => setF('aprobarYa', e.target.checked)}
              />
              Aprobar inmediatamente (estado: activo)
            </label>
            <button
              className="admin-btn admin-btn-primary"
              onClick={guardarRegla}
              disabled={guardando || !form.contenido.trim()}
              style={{ marginLeft: 'auto' }}
            >
              {guardando ? 'Guardando…' : 'Guardar memoria'}
            </button>
          </div>
        </div>
      )}

      {/* Consultar IA */}
      {subtab === 'ia' && (
        <div className="aeia-modal-form">
          <div className="admin-form-group">
            <label className="admin-form-label">Pregunta al agente</label>
            <textarea
              className="admin-form-textarea"
              rows={2}
              placeholder={`¿Qué instrucciones debería tener el Planificador para el tema "${topic.temaNormalizado}"?`}
              value={pregunta}
              onChange={e => setPregunta(e.target.value)}
              disabled={consultando}
            />
          </div>

          <button
            className="admin-btn admin-btn-primary"
            onClick={consultarIA}
            disabled={consultando || !pregunta.trim()}
          >
            {consultando ? '⏳ Consultando…' : '💬 Consultar IA'}
          </button>

          {(respuestaIA || consultando) && (
            <div>
              <label className="admin-form-label" style={{ marginBottom: 6, display: 'block' }}>
                Respuesta del agente
              </label>
              <div className="aeia-training-ia-response">
                {respuestaIA || <span style={{ color: 'var(--adm-dim)' }}>Generando…</span>}
              </div>
              {respuestaIA && !consultando && (
                <button
                  className="admin-btn admin-btn-primary"
                  onClick={guardarRespuestaIA}
                  disabled={guardandoIA}
                  style={{ marginTop: 10 }}
                >
                  {guardandoIA ? 'Guardando…' : '💾 Guardar como memoria pendiente'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tab: Topics ───────────────────────────────────────────────────────────────
function TabTopics() {
  const { topics, loading, reload } = useTopics()
  const [modalNuevo,      setModalNuevo]      = useState(false)
  const [msg,             setMsg]             = useState(null)
  const [procesando,      setProcesando]      = useState({})
  const [topicEntrenando, setTopicEntrenando] = useState(null)

  const flash = (text, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 3000) }

  const toggleEstado = async (topic) => {
    const nuevoEstado = topic.estado === STATES.ACTIVE ? STATES.INACTIVE : STATES.ACTIVE
    setProcesando(p => ({ ...p, [topic.id]: true }))
    try {
      await setDoc(doc(db, COLLECTIONS.KE_TOPICS, topic.id), {
        estado: nuevoEstado, actualizadoEn: serverTimestamp(),
      }, { merge: true })
      flash(`Topic "${topic.temaNormalizado}" actualizado.`)
      await reload()
    } catch {
      flash('Error al actualizar el topic.', false)
    } finally {
      setProcesando(p => ({ ...p, [topic.id]: false }))
    }
  }

  return (
    <div className="aim-tab-body">
      <div className="aeia-topics-toolbar">
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--adm-text)' }}>
          Topics del Knowledge Engine
        </h3>
        <button className="admin-btn admin-btn-primary" onClick={() => setModalNuevo(true)}>
          + Nuevo topic
        </button>
        <button className="aim-btn aim-btn-ghost" onClick={reload} style={{ marginLeft: 'auto' }}>
          ↻ Actualizar
        </button>
      </div>

      {msg && <div className={`admin-alert ${msg.ok ? 'success' : 'error'}`}>{msg.text}</div>}

      {loading ? (
        <div className="admin-loading"><div className="admin-spinner" />Cargando topics…</div>
      ) : topics.length === 0 ? (
        <div className="admin-empty">
          <span className="admin-empty-icon">📋</span>
          <h3>Sin topics</h3>
          <p>No hay topics registrados todavía. Crea el primero.</p>
        </div>
      ) : (
        <div className="aim-table-wrap">
          <table className="aim-table">
            <thead>
              <tr>
                <th>Tema</th>
                <th>Asignatura</th>
                <th>Estado</th>
                <th>Reglas</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {topics.map(topic => (
                <tr
                  key={topic.id}
                  style={topicEntrenando?.id === topic.id
                    ? { background: 'var(--adm-surface3)' } : {}}
                >
                  <td><strong style={{ color: 'var(--adm-text)' }}>{topic.temaNormalizado}</strong></td>
                  <td style={{ color: 'var(--adm-muted)' }}>{topic.asignatura || '—'}</td>
                  <td>
                    <span className={`aeia-badge aeia-badge--${topic.estado || 'inactivo'}`}>
                      {topic.estado || '—'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', color: 'var(--adm-muted)' }}>
                    {Array.isArray(topic.reglas) ? topic.reglas.length : '—'}
                  </td>
                  <td>
                    <div className="admin-row-actions">
                      <button
                        className="aim-btn aim-btn-primary"
                        style={{ fontSize: 11, padding: '4px 10px' }}
                        onClick={() => setTopicEntrenando(
                          topicEntrenando?.id === topic.id ? null : topic
                        )}
                      >
                        {topicEntrenando?.id === topic.id ? '✕ Cerrar' : '🧠 Entrenar'}
                      </button>
                      <button
                        className={`admin-btn-sm ${topic.estado === STATES.ACTIVE ? 'yellow' : 'green'}`}
                        disabled={procesando[topic.id]}
                        onClick={() => toggleEstado(topic)}
                      >
                        {topic.estado === STATES.ACTIVE ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {topicEntrenando && (
        <TopicTrainingPanel
          key={topicEntrenando.id}
          topic={topicEntrenando}
          onClose={() => setTopicEntrenando(null)}
        />
      )}

      {modalNuevo && (
        <ModalNuevoTopic
          onSaved={() => { setModalNuevo(false); reload() }}
          onClose={() => setModalNuevo(false)}
        />
      )}
    </div>
  )
}

// ── Hook: Insights pendientes ──────────────────────────────────────────────────
function useInsights() {
  const [insights, setInsights] = useState([])
  const [loading,  setLoading]  = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getPendingInsights()
      setInsights(data)
    } catch (e) {
      if (import.meta.env.DEV) console.debug('[AdminEntrenamientoIA] useInsights:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])
  return { insights, loading, reload: cargar }
}

// ── Tab: Insights ─────────────────────────────────────────────────────────────
function TabInsights() {
  const { insights, loading, reload } = useInsights()
  const [msg,          setMsg]          = useState(null)
  const [procesando,   setProcesando]   = useState({})
  const [analizando,   setAnalizando]   = useState(false)

  const flash = (text, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 4000) }

  const resolver = async (insightId, decision) => {
    setProcesando(p => ({ ...p, [insightId]: true }))
    try {
      await resolveInsight(insightId, decision)
      flash(`Insight ${decision === 'aprobado' ? 'aprobado y convertido en memoria' : 'rechazado'} correctamente.`)
      await reload()
    } catch {
      flash('Error al procesar el insight.', false)
    } finally {
      setProcesando(p => ({ ...p, [insightId]: false }))
    }
  }

  const ejecutarAnalisis = async () => {
    setAnalizando(true)
    try {
      const ids = await analyzePatterns({ limite: 200 })
      if (ids.length > 0) {
        flash(`Análisis completado: ${ids.length} nuevo${ids.length > 1 ? 's' : ''} insight${ids.length > 1 ? 's' : ''} generado${ids.length > 1 ? 's' : ''}.`)
      } else {
        flash('Análisis completado. Sin nuevos patrones detectados.', true)
      }
      await reload()
    } catch {
      flash('Error al ejecutar el análisis.', false)
    } finally {
      setAnalizando(false)
    }
  }

  return (
    <div className="aim-tab-body">
      <div className="aim-section-head">
        <h3>Insights pendientes de revisión</h3>
        <span className="aim-section-hint">
          El Learning Engine detecta patrones y genera sugerencias para el administrador.
          Al aprobar un insight, se convierte automáticamente en una memoria activa.
        </span>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button
            className="aim-btn aim-btn-primary"
            onClick={ejecutarAnalisis}
            disabled={analizando}
            title="Analiza los últimos 200 eventos y genera nuevos insights si detecta patrones"
          >
            {analizando ? '⏳ Analizando...' : '🔍 Analizar patrones'}
          </button>
          <button className="aim-btn aim-btn-ghost" onClick={reload}>↻ Actualizar</button>
        </div>
      </div>

      {msg && <div className={`admin-alert ${msg.ok ? 'success' : 'error'}`}>{msg.text}</div>}

      {loading ? (
        <div className="admin-loading"><div className="admin-spinner" />Cargando insights…</div>
      ) : insights.length === 0 ? (
        <div className="admin-empty">
          <span className="admin-empty-icon">✅</span>
          <h3>Sin insights pendientes</h3>
          <p>No hay sugerencias del Learning Engine esperando revisión.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {insights.map(insight => (
            <div key={insight.id} className="aeia-insight-card">
              <div className="aeia-insight-top">
                <div className="aeia-insight-desc">{insight.descripcion || '—'}</div>
                <span className="aeia-badge aeia-badge--pendiente">pendiente</span>
              </div>

              {insight.accionSugerida && (
                <div style={{ fontSize: 12, color: 'var(--adm-info)', fontStyle: 'italic' }}>
                  Acción sugerida: {insight.accionSugerida}
                </div>
              )}

              <div className="aeia-insight-meta">
                {insight.umbralPct && (
                  <span>Patrón: <strong style={{ color: 'var(--adm-text)' }}>{insight.umbralPct}%</strong></span>
                )}
                {insight.tipo      && <span>Tipo: {insight.tipo}</span>}
                {insight.asignatura && <span>Asignatura: {insight.asignatura}</span>}
                {insight.grado      && <span>Grado: {insight.grado}</span>}
                {insight.creadoEn   && <span>Detectado: {fmtTs(insight.creadoEn)}</span>}
                {insight.evidencias && <span>Evidencias: {insight.evidencias.length}</span>}
                {insight.convertidoEnMemoria && (
                  <span style={{ color: 'var(--adm-success)', fontWeight: 700 }}>✓ Convertido en memoria</span>
                )}
              </div>

              <div className="aeia-insight-actions">
                <button
                  className="admin-btn-sm green"
                  disabled={procesando[insight.id]}
                  onClick={() => resolver(insight.id, 'aprobado')}
                >
                  Aprobar → Memoria
                </button>
                <button
                  className="admin-btn-sm red"
                  disabled={procesando[insight.id]}
                  onClick={() => resolver(insight.id, 'rechazado')}
                >
                  Rechazar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tab: Casos de Éxito ────────────────────────────────────────────────────────
function TabCasosExito() {
  const [casos,      setCasos]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [msg,        setMsg]        = useState(null)
  const [procesando, setProcesando] = useState({})
  const [editandoId, setEditandoId] = useState(null)
  const [editDesc,   setEditDesc]   = useState('')

  // Filtros
  const [filtroEstado,     setFiltroEstado]     = useState('')
  const [filtroArea,       setFiltroArea]       = useState('')
  const [filtroAsignatura, setFiltroAsignatura] = useState('')
  const [filtroGrado,      setFiltroGrado]      = useState('')

  const flash = (text, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 3500) }

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const filtros = {}
      if (filtroEstado)     filtros.estado     = filtroEstado
      if (filtroArea)       filtros.area       = filtroArea
      if (filtroAsignatura) filtros.asignatura = filtroAsignatura
      if (filtroGrado)      filtros.grado      = filtroGrado
      const data = await getCasosExito(filtros)
      setCasos(data)
    } catch {
      flash('Error al cargar casos de éxito.', false)
    } finally {
      setLoading(false)
    }
  }, [filtroEstado, filtroArea, filtroAsignatura, filtroGrado])

  useEffect(() => { cargar() }, [cargar])

  const accion = async (id, fn, msgOk) => {
    setProcesando(p => ({ ...p, [id]: true }))
    try { await fn(id); flash(msgOk); await cargar() }
    catch { flash('Error al procesar.', false) }
    finally { setProcesando(p => ({ ...p, [id]: false })) }
  }

  const guardarEdicion = async (id) => {
    setProcesando(p => ({ ...p, [id]: true }))
    try {
      await editarCasoExito(id, { descripcion: editDesc })
      flash('Descripción actualizada.')
      setEditandoId(null)
      await cargar()
    } catch { flash('Error al editar.', false) }
    finally { setProcesando(p => ({ ...p, [id]: false })) }
  }

  const pendientes = casos.filter(c => c.estado === 'pendiente').length

  return (
    <div className="aim-tab-body">
      <div className="aim-section-head">
        <div>
          <h3>Casos de Éxito {pendientes > 0 && <span className="aeia-tab-badge">{pendientes}</span>}</h3>
          <span className="aim-section-hint">
            Planificaciones marcadas por docentes como ejemplos de calidad. Apruébalos para que el Knowledge Engine los use.
          </span>
        </div>
        <button className="aim-btn aim-btn-ghost" onClick={cargar} style={{ marginLeft: 'auto' }}>↻ Actualizar</button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <select className="aim-select-sm" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="activo">Activo</option>
          <option value="rechazado">Rechazado</option>
        </select>
        <input className="aim-input-sm" placeholder="Área…"       value={filtroArea}       onChange={e => setFiltroArea(e.target.value)} />
        <input className="aim-input-sm" placeholder="Asignatura…" value={filtroAsignatura} onChange={e => setFiltroAsignatura(e.target.value)} />
        <input className="aim-input-sm" placeholder="Grado…"      value={filtroGrado}      onChange={e => setFiltroGrado(e.target.value)} />
      </div>

      {msg && <div className={`admin-alert ${msg.ok ? 'success' : 'error'}`}>{msg.text}</div>}

      {loading ? (
        <div className="admin-loading"><div className="admin-spinner" />Cargando…</div>
      ) : casos.length === 0 ? (
        <div className="admin-empty">
          <span className="admin-empty-icon">⭐</span>
          <h3>Sin casos de éxito</h3>
          <p>Los docentes pueden marcar planificaciones como casos de éxito desde la pantalla de resultados.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {casos.map(caso => (
            <div key={caso.id} className="aeia-insight-card">
              <div className="aeia-insight-top">
                <div style={{ flex: 1 }}>
                  {editandoId === caso.id ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        className="aim-input-sm"
                        style={{ flex: 1 }}
                        value={editDesc}
                        onChange={e => setEditDesc(e.target.value)}
                      />
                      <button className="admin-btn-sm green" disabled={procesando[caso.id]} onClick={() => guardarEdicion(caso.id)}>Guardar</button>
                      <button className="admin-btn-sm" onClick={() => setEditandoId(null)}>Cancelar</button>
                    </div>
                  ) : (
                    <div className="aeia-insight-desc">{caso.descripcion || '—'}</div>
                  )}
                </div>
                <span className={`aeia-badge aeia-badge--${caso.estado || 'pendiente'}`}>{caso.estado || '—'}</span>
              </div>

              <div className="aeia-insight-meta">
                {caso.area       && <span>Área: {caso.area}</span>}
                {caso.grado      && <span>Grado: {caso.grado}</span>}
                {caso.tema       && <span>Tema: {truncate(caso.tema, 40)}</span>}
                {caso.tipoPlanificacion && <span>Tipo: {caso.tipoPlanificacion}</span>}
                {caso.calificacion != null && <span>Calif: {caso.calificacion}/10</span>}
                {caso.vecesUsado != null  && <span>Usado: {caso.vecesUsado}×</span>}
                {caso.visibilidad === 'global' && <span style={{ color: 'var(--adm-accent)', fontWeight: 700 }}>Global</span>}
                {caso.creadoEn   && <span>{fmtTs(caso.creadoEn)}</span>}
              </div>

              <div className="aeia-insight-actions" style={{ flexWrap: 'wrap' }}>
                {caso.estado === 'pendiente' && (
                  <button className="admin-btn-sm green" disabled={procesando[caso.id]} onClick={() => accion(caso.id, aprobarCasoExito, 'Caso aprobado.')}>
                    Aprobar
                  </button>
                )}
                {caso.estado !== 'rechazado' && (
                  <button className="admin-btn-sm red" disabled={procesando[caso.id]} onClick={() => accion(caso.id, rechazarCasoExito, 'Caso rechazado.')}>
                    Rechazar
                  </button>
                )}
                {caso.estado === 'activo' && caso.visibilidad !== 'global' && (
                  <button className="admin-btn-sm" disabled={procesando[caso.id]} onClick={() => accion(caso.id, marcarGlobal, 'Marcado como global.')}>
                    Marcar global
                  </button>
                )}
                {editandoId !== caso.id && (
                  <button className="admin-btn-sm" onClick={() => { setEditandoId(caso.id); setEditDesc(caso.descripcion || '') }}>
                    Editar desc.
                  </button>
                )}
              </div>

              {caso.output && (
                <details style={{ marginTop: 4 }}>
                  <summary style={{ fontSize: 11, color: 'var(--adm-dim)', cursor: 'pointer' }}>Ver planificación origen</summary>
                  <pre style={{ fontSize: 11, color: 'var(--adm-muted)', whiteSpace: 'pre-wrap', marginTop: 6, maxHeight: 200, overflow: 'auto', background: 'var(--adm-surface3)', padding: 8, borderRadius: 6 }}>
                    {caso.output}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tab: Estilos ──────────────────────────────────────────────────────────────
const VIS_LABEL = {
  privada:            'Privada',
  centro:             'Centro',
  pendiente_revision: 'Pendiente revisión',
  global:             'Global',
}
const VIS_NEXT = {
  privada: 'centro',
  centro:  'global',
  global:  'privada',
}

function TabEstilos() {
  const [estilos,    setEstilos]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [msg,        setMsg]        = useState(null)
  const [procesando, setProcesando] = useState({})

  // Filtros
  const [filtroEstado,     setFiltroEstado]     = useState('')
  const [filtroAsignatura, setFiltroAsignatura] = useState('')
  const [filtroGrado,      setFiltroGrado]      = useState('')

  const flash = (text, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 3500) }

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const filtros = {}
      if (filtroEstado)     filtros.estado     = filtroEstado
      if (filtroAsignatura) filtros.asignatura = filtroAsignatura
      if (filtroGrado)      filtros.grado      = filtroGrado
      setEstilos(await getEstilos(filtros))
    } catch {
      flash('Error al cargar estilos.', false)
    } finally {
      setLoading(false)
    }
  }, [filtroEstado, filtroAsignatura, filtroGrado])

  useEffect(() => { cargar() }, [cargar])

  const accion = async (id, fn, msgOk) => {
    setProcesando(p => ({ ...p, [id]: true }))
    try { await fn(id); flash(msgOk); await cargar() }
    catch { flash('Error al procesar.', false) }
    finally { setProcesando(p => ({ ...p, [id]: false })) }
  }

  const toggleVisibilidad = async (estilo) => {
    const siguiente = VIS_NEXT[estilo.visibilidad] ?? 'centro'
    setProcesando(p => ({ ...p, [estilo.id]: true }))
    try {
      await cambiarVisibilidad(estilo.id, siguiente)
      flash(`Visibilidad → ${VIS_LABEL[siguiente] ?? siguiente}`)
      await cargar()
    } catch { flash('Error al cambiar visibilidad.', false) }
    finally { setProcesando(p => ({ ...p, [estilo.id]: false })) }
  }

  const pendientes = estilos.filter(e => e.estado === 'pendiente').length

  return (
    <div className="aim-tab-body">
      <div className="aim-section-head">
        <div>
          <h3>Estilos pedagógicos {pendientes > 0 && <span className="aeia-tab-badge">{pendientes}</span>}</h3>
          <span className="aim-section-hint">
            Plantillas de estilo extraídas de planificaciones reales.
            Aprueba y cambia visibilidad a "Global" para que el Knowledge Engine las use.
          </span>
        </div>
        <button className="aim-btn aim-btn-ghost" onClick={cargar} style={{ marginLeft: 'auto' }}>↻ Actualizar</button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <select className="aim-select-sm" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="activo">Activo</option>
          <option value="inactivo">Inactivo</option>
        </select>
        <input className="aim-input-sm" placeholder="Asignatura…" value={filtroAsignatura} onChange={e => setFiltroAsignatura(e.target.value)} />
        <input className="aim-input-sm" placeholder="Grado…"      value={filtroGrado}      onChange={e => setFiltroGrado(e.target.value)} />
      </div>

      {msg && <div className={`admin-alert ${msg.ok ? 'success' : 'error'}`}>{msg.text}</div>}

      {loading ? (
        <div className="admin-loading"><div className="admin-spinner" />Cargando…</div>
      ) : estilos.length === 0 ? (
        <div className="admin-empty">
          <span className="admin-empty-icon">🎨</span>
          <h3>Sin estilos guardados</h3>
          <p>Los docentes pueden guardar el estilo de sus planificaciones con el botón "Guardar como mi estilo".</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {estilos.map(estilo => (
            <div key={estilo.id} className="aeia-insight-card">
              <div className="aeia-insight-top">
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: 13, color: 'var(--adm-text)' }}>{estilo.nombre || '—'}</strong>
                  {estilo.estilo?.estructuraDetectada && (
                    <div style={{ fontSize: 12, color: 'var(--adm-muted)', marginTop: 3 }}>
                      {truncate(estilo.estilo.estructuraDetectada, 120)}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                  <span className={`aeia-badge aeia-badge--${estilo.estado || 'pendiente'}`}>
                    {estilo.estado || '—'}
                  </span>
                  <span className="aeia-badge aeia-badge--criterio">
                    {VIS_LABEL[estilo.visibilidad] ?? estilo.visibilidad ?? '—'}
                  </span>
                </div>
              </div>

              <div className="aeia-insight-meta">
                {estilo.asignatura && <span>Asignatura: {estilo.asignatura}</span>}
                {estilo.grado      && <span>Grado: {estilo.grado}</span>}
                {estilo.temaOriginal && <span>Tema: {truncate(estilo.temaOriginal, 40)}</span>}
                {estilo.creadoEn   && <span>{fmtTs(estilo.creadoEn)}</span>}
                {estilo.estilo?.semanasDetectadas > 0 && (
                  <span>{estilo.estilo.semanasDetectadas} semanas</span>
                )}
              </div>

              {estilo.estilo?.patronesActividades && (
                <div style={{ fontSize: 11, color: 'var(--adm-dim)', fontStyle: 'italic' }}>
                  Actividades: {truncate(estilo.estilo.patronesActividades, 100)}
                </div>
              )}

              <div className="aeia-insight-actions" style={{ flexWrap: 'wrap' }}>
                {estilo.estado === 'pendiente' && (
                  <button
                    className="admin-btn-sm green"
                    disabled={procesando[estilo.id]}
                    onClick={() => accion(estilo.id, aprobarPlantilla, 'Estilo aprobado como global.')}
                  >
                    Aprobar → Global
                  </button>
                )}
                {estilo.estado === 'activo' && (
                  <button
                    className="admin-btn-sm"
                    disabled={procesando[estilo.id]}
                    onClick={() => toggleVisibilidad(estilo)}
                  >
                    Visibilidad: {VIS_LABEL[estilo.visibilidad] ?? '—'} →
                  </button>
                )}
                {estilo.estado !== 'inactivo' && (
                  <button
                    className="admin-btn-sm red"
                    disabled={procesando[estilo.id]}
                    onClick={() => accion(estilo.id, rechazarPlantilla, 'Estilo rechazado.')}
                  >
                    Rechazar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tab: BIC ──────────────────────────────────────────────────────────────────
const BIC_TIPOS = [
  { id: 'planes',       label: '📋 Planes',       desc: 'Planificaciones semanales y unidades' },
  { id: 'actividades',  label: '⚡ Actividades',   desc: 'Actividades pedagógicas individuales' },
  { id: 'instrumentos', label: '📊 Instrumentos',  desc: 'Rúbricas, listas de cotejo y escalas' },
]

function TabBIC() {
  const [tipo,       setTipo]       = useState('planes')
  const [grado,      setGrado]      = useState('')
  const [area,       setArea]       = useState('')
  const [corriendo,  setCorriendo]  = useState(false)
  const [resultado,  setResultado]  = useState(null)
  const [error,      setError]      = useState(null)
  const [historial,  setHistorial]  = useState([])

  const ejecutar = async () => {
    setCorriendo(true)
    setResultado(null)
    setError(null)
    const inicio = Date.now()
    try {
      const res = await cicloOptimizacion(tipo, {
        grado: grado.trim() || undefined,
        area:  area.trim()  || undefined,
      })
      const duracionMs = Date.now() - inicio
      const entrada = { tipo, grado: grado || '—', area: area || '—', ...res, duracionMs, ts: new Date().toLocaleTimeString('es-DO') }
      setResultado(entrada)
      setHistorial(h => [entrada, ...h].slice(0, 10))
    } catch (e) {
      setError(e?.message || 'Error desconocido en el ciclo de optimización.')
    } finally {
      setCorriendo(false)
    }
  }

  return (
    <div className="aim-tab-body">
      <div className="aim-section-head">
        <div>
          <h3>Banco Inteligente de Conocimiento — Optimización</h3>
          <span className="aim-section-hint">
            Detecta duplicados (similitud ≥ 95%), fusiona los mejores y archiva ítems de baja calidad sin uso.
            Opera sobre Firestore directamente — no destructivo en ítems con vecesUsada &gt; 0.
          </span>
        </div>
      </div>

      {/* Configuración */}
      <div className="aeia-bic-config">
        <div>
          <label className="admin-form-label">Tipo de contenido</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
            {BIC_TIPOS.map(t => (
              <button
                key={t.id}
                className={`aeia-bic-tipo-btn${tipo === t.id ? ' aeia-bic-tipo-btn--active' : ''}`}
                onClick={() => setTipo(t.id)}
                disabled={corriendo}
              >
                {t.label}
                <span className="aeia-bic-tipo-desc">{t.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 14 }}>
          <div className="admin-form-group" style={{ margin: 0 }}>
            <label className="admin-form-label">Filtrar por grado (opcional)</label>
            <input
              className="admin-form-input"
              style={{ width: 140 }}
              placeholder="Ej: 3er grado"
              value={grado}
              onChange={e => setGrado(e.target.value)}
              disabled={corriendo}
            />
          </div>
          <div className="admin-form-group" style={{ margin: 0 }}>
            <label className="admin-form-label">Filtrar por área (opcional)</label>
            <input
              className="admin-form-input"
              style={{ width: 180 }}
              placeholder="Ej: Matemática"
              value={area}
              onChange={e => setArea(e.target.value)}
              disabled={corriendo}
            />
          </div>
          <button
            className="admin-btn admin-btn-primary"
            onClick={ejecutar}
            disabled={corriendo}
            style={{ height: 36 }}
          >
            {corriendo ? '⏳ Optimizando…' : '⚙️ Ejecutar optimización'}
          </button>
        </div>
      </div>

      {/* Resultado del último ciclo */}
      {corriendo && (
        <div className="aeia-bic-running">
          <div className="admin-spinner" />
          <span>Analizando {tipo}… esto puede tomar unos segundos.</span>
        </div>
      )}

      {error && (
        <div className="admin-alert error" style={{ marginTop: 14 }}>{error}</div>
      )}

      {resultado && !corriendo && (
        <div className="aeia-bic-result">
          <div className="aeia-bic-result-title">Resultado — {resultado.tipo} · {resultado.ts}</div>
          <div className="aeia-bic-result-grid">
            <div className="aeia-bic-stat">
              <span className="aeia-bic-stat-val">{resultado.procesados}</span>
              <span className="aeia-bic-stat-label">ítems analizados</span>
            </div>
            <div className="aeia-bic-stat">
              <span className="aeia-bic-stat-val" style={{ color: 'var(--adm-accent)' }}>{resultado.fusionados}</span>
              <span className="aeia-bic-stat-label">fusionados</span>
            </div>
            <div className="aeia-bic-stat">
              <span className="aeia-bic-stat-val" style={{ color: 'var(--adm-warning)' }}>{resultado.archivados}</span>
              <span className="aeia-bic-stat-label">archivados</span>
            </div>
            <div className="aeia-bic-stat">
              <span className="aeia-bic-stat-val" style={{ color: 'var(--adm-dim)' }}>
                {resultado.duracionMs < 1000 ? `${resultado.duracionMs}ms` : `${(resultado.duracionMs / 1000).toFixed(1)}s`}
              </span>
              <span className="aeia-bic-stat-label">duración</span>
            </div>
          </div>
          {resultado.fusionados === 0 && resultado.archivados === 0 && (
            <div style={{ marginTop: 10, fontSize: 13, color: 'var(--adm-dim)', fontStyle: 'italic' }}>
              Sin duplicados ni ítems obsoletos detectados en {resultado.tipo}.
            </div>
          )}
        </div>
      )}

      {/* Historial de ciclos */}
      {historial.length > 1 && (
        <div style={{ marginTop: 20 }}>
          <div className="admin-form-label" style={{ marginBottom: 8 }}>Historial de ciclos (sesión actual)</div>
          <div className="aim-table-wrap">
            <table className="aim-table">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Tipo</th>
                  <th>Grado</th>
                  <th>Área</th>
                  <th>Analizados</th>
                  <th>Fusionados</th>
                  <th>Archivados</th>
                  <th>Duración</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((h, i) => (
                  <tr key={i}>
                    <td style={{ color: 'var(--adm-dim)', fontSize: 12 }}>{h.ts}</td>
                    <td><span className="aeia-badge aeia-badge--criterio">{h.tipo}</span></td>
                    <td style={{ color: 'var(--adm-muted)' }}>{h.grado}</td>
                    <td style={{ color: 'var(--adm-muted)' }}>{h.area}</td>
                    <td style={{ textAlign: 'center' }}>{h.procesados}</td>
                    <td style={{ textAlign: 'center', color: 'var(--adm-accent)' }}>{h.fusionados}</td>
                    <td style={{ textAlign: 'center', color: 'var(--adm-warning)' }}>{h.archivados}</td>
                    <td style={{ color: 'var(--adm-dim)', fontSize: 12 }}>
                      {h.duracionMs < 1000 ? `${h.duracionMs}ms` : `${(h.duracionMs / 1000).toFixed(1)}s`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Botón de siembra de datos iniciales ───────────────────────────────────────
function SeedButton() {
  const [estado, setEstado] = useState('idle') // idle | checking | seeding | done | ya_tiene
  const [resultado, setResultado] = useState(null)

  const sembrar = useCallback(async () => {
    setEstado('checking')
    try {
      const tieneData = await hayDatosSembrados()
      if (tieneData) { setEstado('ya_tiene'); return }
      setEstado('seeding')
      const res = await sembrarDatosIniciales()
      setResultado(res)
      setEstado('done')
    } catch (err) {
      console.error('[SeedButton]', err)
      setEstado('idle')
    }
  }, [])

  if (estado === 'done') {
    return (
      <div className="aeia-seed-result">
        Sembrado: {resultado?.topics} topics · {resultado?.memorias} memorias del Auditor
      </div>
    )
  }
  if (estado === 'ya_tiene') {
    return <div className="aeia-seed-result">Ya hay datos sembrados en Firestore.</div>
  }

  return (
    <button
      className="aeia-seed-btn"
      onClick={sembrar}
      disabled={estado !== 'idle'}
    >
      {estado === 'idle'     && '🌱 Sembrar datos iniciales'}
      {estado === 'checking' && 'Verificando...'}
      {estado === 'seeding'  && 'Sembrando...'}
    </button>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function AdminEntrenamientoIA() {
  const [tab, setTab] = useState('agentes')

  const { insights: insightsPending } = useInsights()
  const pendingCount = insightsPending.length

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div className="admin-page-header-text">
          <h2>Entrenamiento IA</h2>
          <p>Gestiona memorias, topics y el aprendizaje continuo de los agentes de DocenteOS.</p>
        </div>
        <SeedButton />
      </div>

      <div className="aim-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`aim-tab-btn${tab === t.id ? ' aim-tab-btn--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === 'insights' && pendingCount > 0 && (
              <span className="aeia-tab-badge">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'agentes'     && <TabAgentes />}
      {tab === 'topics'      && <TabTopics />}
      {tab === 'insights'    && <TabInsights />}
      {tab === 'casos-exito' && <TabCasosExito />}
      {tab === 'estilos'     && <TabEstilos />}
      {tab === 'bic'         && <TabBIC />}
    </div>
  )
}
