/**
 * AdminIA — Motor de Inteligencia Artificial
 * Panel de administración, monitoreo, auditoría y costos de todos los
 * proveedores de IA de DocenteOS.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  collection, getDocs, query, where, orderBy, limit,
  Timestamp, doc, setDoc, getDoc, deleteDoc, writeBatch,
} from 'firebase/firestore'
import { db } from '../../firebase.js'
import { AIConfig } from '../../services/ai/AIConfig.js'
import { invalidateGatewayConfig } from '../../services/ai/AIService.js'

// ─── Catálogo de proveedores ──────────────────────────────────────────────────
const PROVIDER_CATALOG = [
  {
    id: 'openai',     name: 'OpenAI',          model: 'gpt-4o',
    envVar: 'OPENAI_API_KEY',    logo: '⬛', type: 'active',
    desc: 'GPT-4o · API OpenAI estándar',
  },
  {
    id: 'abacus',     name: 'Abacus AI',        model: 'gpt-4o-mini',
    envVar: 'ABACUS_API_KEY',    logo: '🔷', type: 'active',
    desc: 'Compatible OpenAI · routing externo',
  },
  {
    id: 'anthropic',  name: 'Anthropic',         model: 'claude-sonnet-5',
    envVar: 'ANTHROPIC_API_KEY', logo: '🟠', type: 'active',
    desc: 'Claude Sonnet 5 · API nativa',
  },
  {
    id: 'nvidia',     name: 'NVIDIA NIM',        model: 'nvidia/nemotron-3-ultra-550b-a55b',
    envVar: 'NVIDIA_API_KEY',    logo: '🟩', type: 'active',
    desc: 'Nemotron 3 Ultra 550B · build.nvidia.com · Free Endpoint',
  },
  {
    id: 'gemini',     name: 'Google Gemini',     model: 'gemini-2.5-flash',
    envVar: 'GEMINI_API_KEY',    logo: '🔴', type: 'active',
    desc: 'Gemini 2.5 Flash · Google AI Studio · Endpoint OpenAI-compatible',
  },
  {
    id: 'openrouter', name: 'OpenRouter',        model: 'auto',
    envVar: 'OPENROUTER_API_KEY',logo: '⚡', type: 'soon',
    desc: 'Multi-modelo · 100+ modelos',
  },
  {
    id: 'groq',       name: 'Groq',              model: 'llama-3.3-70b',
    envVar: 'GROQ_API_KEY',      logo: '🟢', type: 'soon',
    desc: 'Ultra-rápido · LPU Inference',
  },
  {
    id: 'deepseek',   name: 'DeepSeek',          model: 'deepseek-v3',
    envVar: 'DEEPSEEK_API_KEY',  logo: '🔵', type: 'soon',
    desc: 'Costo bajo · Muy eficiente',
  },
  {
    id: 'azure',      name: 'Azure OpenAI',      model: 'gpt-4o',
    envVar: 'AZURE_OPENAI_KEY',  logo: '🔹', type: 'soon',
    desc: 'Microsoft Azure · Enterprise',
  },
  {
    id: 'custom',     name: 'Proveedor Custom',  model: 'custom',
    envVar: 'CUSTOM_AI_KEY',     logo: '⚙️', type: 'soon',
    desc: 'API compatible con OpenAI',
  },
]

const ACTIVE_PROVIDERS = PROVIDER_CATALOG.filter(p => p.type === 'active')

// ─── Modelos seleccionables por proveedor ─────────────────────────────────────
const MODEL_OPTIONS = {
  openai: [
    { value: 'gpt-4o',         label: 'GPT-4o (recomendado)' },
    { value: 'gpt-4o-mini',    label: 'GPT-4o Mini (económico)' },
    { value: 'gpt-4.1',        label: 'GPT-4.1' },
    { value: 'gpt-5',          label: 'GPT-5 (más capaz)' },
  ],
  abacus: [
    { value: 'gpt-4o-mini',    label: 'GPT-4o Mini vía Abacus (recomendado)' },
    { value: 'gpt-4o',         label: 'GPT-4o vía Abacus' },
    { value: 'gpt-4.1',        label: 'GPT-4.1 vía Abacus' },
    { value: 'gpt-4.1-mini',   label: 'GPT-4.1 Mini vía Abacus' },
    { value: 'claude-sonnet-4-6', label: 'Claude Sonnet vía Abacus, si está habilitado' },
    { value: 'gemini-2.5-flash',  label: 'Gemini Flash vía Abacus, si está habilitado' },
    { value: 'route-llm',      label: 'RouteLLM (si tu cuenta lo soporta)' },
  ],
  anthropic: [
    { value: 'claude-sonnet-5',            label: 'Claude Sonnet 5 (recomendado)' },
    { value: 'claude-fable-5',             label: 'Claude Fable 5 (rápido y capaz)' },
    { value: 'claude-opus-4-8',            label: 'Claude Opus 4.8 (más capaz)' },
    { value: 'claude-haiku-4-5-20251001',  label: 'Claude Haiku 4.5 (económico)' },
    { value: 'claude-sonnet-4-6',          label: 'Claude Sonnet 4.6 (legacy)' },
  ],
  gemini: [
    { value: 'gemini-2.5-flash',      label: 'Gemini 2.5 Flash (recomendado · rápido)' },
    { value: 'gemini-2.5-pro',        label: 'Gemini 2.5 Pro (más capaz)' },
    { value: 'gemini-2.0-flash',      label: 'Gemini 2.0 Flash (económico)' },
    { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite (ligero)' },
  ],
  nvidia: [
    { value: 'nvidia/nemotron-3-ultra-550b-a55b', label: 'Nemotron 3 Ultra 550B (flagship · recomendado)' },
    { value: 'moonshotai/kimi-k2.6',              label: 'Kimi K2.6 · Moonshot AI (1T params · agentic)' },
    { value: 'deepseek-ai/deepseek-v4-pro',       label: 'DeepSeek V4 Pro (1M contexto · razonamiento)' },
    { value: 'z-ai/glm5.1',                       label: 'GLM-5.1 · Z.ai (coding · agentic)' },
    { value: 'meta/llama-3.3-70b-instruct',       label: 'Llama 3.3 70B (rápido · eficiente)' },
    { value: 'meta/llama-3.1-8b-instruct',        label: 'Llama 3.1 8B (ligero · económico)' },
  ],
}

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt = {
  num: (n) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M`
             : n >= 1000    ? `${(n/1000).toFixed(1)}k`
             : String(Math.round(n || 0)),
  usd: (n) => `US$${Number(n || 0).toFixed(2)}`,
  ms:  (n) => n >= 1000 ? `${(n/1000).toFixed(1)}s` : `${Math.round(n || 0)}ms`,
  pct: (n, t) => t > 0 ? `${Math.round((n/t)*100)}%` : '0%',
  ts:  (ts) => {
    if (!ts) return '—'
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' })
  },
  key: (k) => k ? `${k.slice(0,4)}****${k.slice(-4)}` : '—',
}

// ─── Helpers de fecha ─────────────────────────────────────────────────────────
const todayStart = () => { const d = new Date(); d.setHours(0,0,0,0); return Timestamp.fromDate(d) }
const monthStart = () => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return Timestamp.fromDate(d) }

function processLogs(snap) {
  const logs  = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  const real  = logs.filter(l => !l.cache && !l.error)
  const hits  = logs.filter(l => l.cache).length
  const tokens = logs.reduce((s, l) => s + (l.tokensSalida||0) + (l.tokensEntrada||0), 0)
  const cost   = logs.reduce((s, l) => s + parseFloat(l.costoEstimado||0), 0)
  const saved  = hits * 0.006
  const avgMs  = real.length > 0
    ? real.reduce((s, l) => s + (l.tiempoRespuesta||0), 0) / real.length : 0
  const byProv = {}
  const byMod  = {}
  logs.forEach(l => {
    byProv[l.proveedor] = (byProv[l.proveedor]||0) + 1
    byMod[l.modulo]     = (byMod[l.modulo]    ||0) + 1
  })
  return { total: logs.length, hits, tokens, cost, saved, avgMs, byProv, byMod, logs }
}

/** Estadísticas desglosadas por proveedor (para las tarjetas). */
function computeProviderStats(logs) {
  const result = {}
  for (const log of (logs || [])) {
    const prov = log.proveedor || 'unknown'
    if (!result[prov]) result[prov] = { requests: 0, tokens: 0, errors: 0, cost: 0 }
    result[prov].requests++
    result[prov].tokens += (log.tokensEntrada || 0) + (log.tokensSalida || 0)
    if (log.error) result[prov].errors++
    result[prov].cost += parseFloat(log.costoEstimado || 0)
  }
  return result
}

// ─── Hook: Stats ──────────────────────────────────────────────────────────────
function useAIStats() {
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!db) { setLoading(false); return }
    setLoading(true)
    try {
      const [todaySnap, monthSnap] = await Promise.all([
        getDocs(query(collection(db,'aiLogs'), where('fecha','>=',todayStart()), orderBy('fecha','desc'))),
        getDocs(query(collection(db,'aiLogs'), where('fecha','>=',monthStart()), orderBy('fecha','desc'))),
      ])
      setStats({ today: processLogs(todaySnap), month: processLogs(monthSnap) })
    } catch(e) { console.error('[AdminIA] stats:', e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { reload() }, [reload])
  return { stats, loading, reload }
}

// ─── Hook: Historial ──────────────────────────────────────────────────────────
function useHistorial() {
  const [logs,    setLogs]    = useState([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!db) { setLoading(false); return }
    setLoading(true)
    try {
      const snap = await getDocs(
        query(collection(db,'aiLogs'), orderBy('fecha','desc'), limit(200))
      )
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch(e) { console.error('[AdminIA] historial:', e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { reload() }, [reload])
  return { logs, loading, reload }
}

// ─── Hook: Provider Priority + Models ────────────────────────────────────────
function useProviderPriority() {
  const DEF_MODELS = Object.fromEntries(ACTIVE_PROVIDERS.map(p => [p.id, p.model]))
  const [priority, setPriority] = useState(AIConfig.providerPriority || ACTIVE_PROVIDERS.map(p => p.id))
  const [models,   setModels]   = useState(DEF_MODELS)
  // Proveedores APAGADOS por el admin: jamás se usan, ni como fallback
  // (distinto de "mover al final", que solo baja la prioridad)
  const [apagados, setApagados] = useState([])
  const [saving,   setSaving]   = useState(false)

  useEffect(() => {
    if (!db) return
    getDoc(doc(db, 'config', 'ia-gateway'))
      .then(snap => {
        if (!snap.exists()) return
        const d = snap.data()
        if (d.priority) setPriority(d.priority)
        if (d.models)   setModels({ ...DEF_MODELS, ...d.models })
        if (Array.isArray(d.disabled)) setApagados(d.disabled)
      })
      .catch(() => {})
  }, [])

  const saveConfig = async (nextPriority, nextModels, nextApagados) => {
    if (!db) return
    setSaving(true)
    try {
      await setDoc(doc(db, 'config', 'ia-gateway'),
        { priority: nextPriority, models: nextModels, disabled: nextApagados }, { merge: true })
      // Invalidar cache local de AIService para que aplique inmediatamente
      invalidateGatewayConfig()
    } catch(e) { console.error('[AdminIA] saveConfig:', e) }
    finally { setSaving(false) }
  }

  const savePriority = (next) => { setPriority(next); saveConfig(next, models, apagados) }
  const saveModels   = (next) => { setModels(next);   saveConfig(priority, next, apagados) }
  const toggleApagado = (provId) => {
    const next = apagados.includes(provId)
      ? apagados.filter(p => p !== provId)
      : [...apagados, provId]
    setApagados(next)
    saveConfig(priority, models, next)
  }

  return { priority, savePriority, models, saveModels, saving, apagados, toggleApagado }
}

// ─── Hook: Cache stats ────────────────────────────────────────────────────────
function useCacheStats() {
  const [data,     setData]     = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [clearing, setClearing] = useState(false)

  const reload = useCallback(async () => {
    if (!db) { setLoading(false); return }
    setLoading(true)
    try {
      const snap    = await getDocs(collection(db, 'aiCache'))
      const entries = snap.docs.map(d => d.data())
      const tokensGuardados = entries.reduce((s,e) => s + Math.ceil((e.response||'').length / 4), 0)
      setData({ count: entries.length, tokensGuardados, entries: snap.docs })
    } catch(e) { console.error('[AdminIA] cache:', e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { reload() }, [reload])

  const clearAll = async () => {
    if (!db) return
    setClearing(true)
    try {
      const snap = await getDocs(collection(db, 'aiCache'))
      const batch = writeBatch(db)
      snap.docs.forEach(d => batch.delete(d.ref))
      await batch.commit()
      await reload()
    } catch(e) { console.error('[AdminIA] clearCache:', e) }
    finally { setClearing(false) }
  }

  return { data, loading, clearing, reload, clearAll }
}

// ─── Componentes menores ──────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, accent }) {
  return (
    <div className={`aim-stat${accent ? ` aim-stat--${accent}` : ''}`}>
      <div className="aim-stat-icon">{icon}</div>
      <div className="aim-stat-body">
        <div className="aim-stat-val">{value ?? '—'}</div>
        <div className="aim-stat-label">{label}</div>
        {sub && <div className="aim-stat-sub">{sub}</div>}
      </div>
    </div>
  )
}

function Dot({ color }) {
  const colors = { green: '#22c55e', amber: '#f59e0b', red: '#ef4444', gray: '#475569' }
  return (
    <span className="aim-dot" style={{
      background: colors[color] || colors.gray,
      boxShadow: color === 'green' ? `0 0 6px ${colors.green}` : 'none',
    }} />
  )
}

function Badge({ label, variant }) {
  return <span className={`aim-badge aim-badge--${variant||'default'}`}>{label}</span>
}

function MiniBarChart({ data, colorFn }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="aim-bar-chart">
      {data.map((d, i) => (
        <div key={i} className="aim-bar-group">
          <div className="aim-bar-track">
            <div
              className="aim-bar-fill"
              style={{ height: `${(d.value / max) * 100}%`, background: colorFn ? colorFn(d, i) : 'var(--adm-accent)' }}
            />
          </div>
          <span className="aim-bar-val">{d.value > 1000 ? fmt.num(d.value) : d.value}</span>
          <span className="aim-bar-label">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Modal: Editar modelo ─────────────────────────────────────────────────────
function ModalEditarModelo({ prov, currentModel, onSave, onClose }) {
  const baseOptions = MODEL_OPTIONS[prov.id] || [{ value: prov.model, label: prov.model }]
  const options = currentModel && !baseOptions.some(opt => opt.value === currentModel)
    ? [{ value: currentModel, label: `Modelo guardado: ${currentModel}` }, ...baseOptions]
    : baseOptions
  const [sel, setSel] = useState(currentModel || prov.model)
  const [customModel, setCustomModel] = useState('')

  return (
    <div className="admin-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="admin-modal admin-modal-sm">
        <div className="admin-modal-header">
          <h3>{prov.logo} Editar modelo — {prov.name}</h3>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal-body">
          <p style={{ fontSize: 13, color: 'var(--adm-dim)', marginBottom: 14 }}>
            El modelo seleccionado se guardará en Firestore y se aplicará a todas las solicitudes.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {options.map(opt => (
              <label
                key={opt.value}
                style={{
                  display: 'flex', gap: 10, alignItems: 'center',
                  padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                  background: sel === opt.value ? 'var(--adm-accent)22' : 'var(--adm-surface2)',
                  border: `1px solid ${sel === opt.value ? 'var(--adm-accent)' : 'var(--adm-border)'}`,
                }}
              >
                <input type="radio" style={{ accentColor: 'var(--adm-accent)' }} checked={sel === opt.value} onChange={() => setSel(opt.value)} />
                <span style={{ flex: 1, fontWeight: sel === opt.value ? 700 : 400 }}>{opt.label}</span>
                <code style={{ fontSize: 11, color: 'var(--adm-dim)' }}>{opt.value}</code>
              </label>
            ))}
          </div>
          <div style={{ marginTop: 14, padding: 12, border: '1px solid var(--adm-border)', borderRadius: 8, background: 'var(--adm-surface2)' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--adm-dim)', marginBottom: 6 }}>
              Modelo manual
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                placeholder="Ej. gpt-4o-mini, route-llm, modelo de tu cuenta..."
                style={{
                  flex: 1,
                  border: '1px solid var(--adm-border)',
                  borderRadius: 8,
                  padding: '9px 10px',
                  background: 'var(--adm-surface)',
                  color: 'var(--adm-text)',
                }}
              />
              <button
                type="button"
                className="aim-btn aim-btn-ghost"
                disabled={!customModel.trim()}
                onClick={() => setSel(customModel.trim())}
              >
                Usar
              </button>
            </div>
            <small style={{ display: 'block', color: 'var(--adm-dim)', marginTop: 6 }}>
              Útil si Abacus te habilita un modelo que no aparece en la lista.
            </small>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button className="admin-save-btn" onClick={() => onSave(sel)}>Guardar modelo</button>
            <button className="aim-btn aim-btn-ghost" onClick={onClose}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Resumen ─────────────────────────────────────────────────────────────
function TabResumen({
  providerStatus, statusLoading, stats, statsLoading, statsReload,
  testResults, testing, ultimaPrueba, handleTest,
  configuredCount, activeProvName,
  priority, models,
  onActivar, onDesactivar, onEditarModelo,
  apagados = [], onToggleApagado,
  activacionOk,
}) {
  const t = stats?.today
  const m = stats?.month
  const providerStats = computeProviderStats(t?.logs)

  return (
    <div className="aim-tab-body">
      {/* Banner de sistema */}
      <div className={`aim-banner${configuredCount > 0 ? '' : ' aim-banner--err'}`}>
        <Dot color={configuredCount > 0 ? 'green' : 'red'} />
        <strong>{configuredCount > 0 ? 'Sistema Operativo' : 'Sin proveedores configurados'}</strong>
        <span className="aim-sep">·</span>
        <span>Proveedor principal: <strong>{activeProvName || 'Ninguno'}</strong></span>
        <span className="aim-sep">·</span>
        <span>{configuredCount} / {ACTIVE_PROVIDERS.length} configurados</span>
        <span className="aim-sep">·</span>
        <span>Fallback automático activo</span>
        <button className="aim-refresh-btn" onClick={statsReload} title="Actualizar métricas">↻</button>
      </div>

      {/* KPI grid */}
      <div className="aim-stats-grid">
        <StatCard icon="📡" label="Solicitudes hoy"     value={statsLoading ? '—' : fmt.num(t?.total||0)}               accent="blue"  />
        <StatCard icon="🔤" label="Tokens consumidos"   value={statsLoading ? '—' : fmt.num(t?.tokens||0)}                             />
        <StatCard icon="⚡" label="Tiempo promedio"     value={statsLoading ? '—' : fmt.ms(t?.avgMs||0)}                              />
        <StatCard icon="🎯" label="Cache Hit"           value={statsLoading ? '—' : fmt.pct(t?.hits||0, t?.total||0)}   accent="green" />
        <StatCard icon="💰" label="Ahorro por caché"   value={statsLoading ? '—' : fmt.usd(t?.saved||0)}               accent="green" sub="hoy" />
        <StatCard icon="💳" label="Costo hoy"           value={statsLoading ? '—' : fmt.usd(t?.cost||0)}                accent="amber" />
        <StatCard icon="📅" label="Costo este mes"      value={statsLoading ? '—' : fmt.usd(m?.cost||0)}                accent="amber" />
        <StatCard icon="🔁" label="Solicitudes mes"    value={statsLoading ? '—' : fmt.num(m?.total||0)}                              />
      </div>

      {/* Provider cards */}
      <div className="aim-section-head">
        <h3>Estado de Proveedores</h3>
        <span className="aim-section-hint">Las API Keys viven solo en el servidor — nunca en el navegador</span>
      </div>
      <div className="aim-prov-grid">
        {ACTIVE_PROVIDERS.map((prov) => {
          const info       = providerStatus?.providers?.[prov.id] ?? null
          const configured = info?.configured ?? false
          const result     = testResults[prov.id]
          const isTesting  = testing[prov.id] ?? false
          const ts         = ultimaPrueba[prov.id]
          const ps         = providerStats[prov.id]
          const isPrimary  = priority[0] === prov.id
          const isLast     = priority[priority.length - 1] === prov.id
          const isApagado  = apagados.includes(prov.id)

          let dotColor = 'gray', statusLabel = 'No configurado'
          if (configured && !result)   { dotColor = 'amber'; statusLabel = 'Configurado' }
          if (result?.ok)              { dotColor = 'green'; statusLabel = 'Conectado' }
          if (result && !result.ok)    { dotColor = 'red';   statusLabel = result.error || 'Error' }
          if (isTesting)               { statusLabel = 'Probando…' }
          if (isApagado)               { dotColor = 'red';   statusLabel = 'Desactivado' }

          return (
            <div
              key={prov.id}
              className={`aim-prov-card${!configured ? ' aim-prov-card--off' : ''}${result?.ok && !isApagado ? ' aim-prov-card--ok' : ''}`}
              style={isApagado ? { opacity: 0.55, filter: 'grayscale(0.6)' } : undefined}
            >
              <div className="aim-prov-top">
                <div className="aim-prov-identity">
                  <span className="aim-prov-logo">{prov.logo}</span>
                  <div>
                    <div className="aim-prov-name">
                      <Dot color={dotColor} />
                      {prov.name}
                    </div>
                    <div className="aim-prov-desc">{prov.desc}</div>
                  </div>
                </div>
                <div className="aim-prov-badges">
                  {isApagado && <Badge label="Desactivado" variant="red" />}
                  {isPrimary && configured && !isApagado && <Badge label="Principal" variant="blue" />}
                </div>
              </div>

              <div className="aim-prov-rows">
                <div className="aim-prov-row">
                  <span>Modelo activo</span>
                  <code>{models?.[prov.id] || prov.model}</code>
                </div>
                <div className="aim-prov-row">
                  <span>API Key</span>
                  <strong style={{ color: statusLoading ? 'var(--adm-dim)' : configured ? 'var(--adm-success)' : 'var(--adm-danger)' }}>
                    {statusLoading ? '—' : configured ? '✓ Configurada' : '✗ Sin configurar'}
                  </strong>
                </div>
                <div className="aim-prov-row">
                  <span>Estado</span>
                  <span style={{ color: dotColor === 'green' ? 'var(--adm-success)' : dotColor === 'red' ? 'var(--adm-danger)' : dotColor === 'amber' ? 'var(--adm-warning)' : 'var(--adm-dim)' }}>
                    {statusLabel}
                  </span>
                </div>
                {result?.ok && <div className="aim-prov-row"><span>Latencia</span><span>{fmt.ms(result.responseTime)}</span></div>}
                {ts          && <div className="aim-prov-row"><span>Última prueba</span><span>{ts}</span></div>}

                {/* Stats de hoy */}
                {ps && ps.requests > 0 && (
                  <>
                    <div className="aim-prov-row"><span>Solicitudes (hoy)</span><span>{fmt.num(ps.requests)}</span></div>
                    <div className="aim-prov-row"><span>Tokens (hoy)</span><span>{fmt.num(ps.tokens)}</span></div>
                    {ps.errors > 0 && (
                      <div className="aim-prov-row">
                        <span>Errores</span>
                        <span style={{ color: 'var(--adm-danger)' }}>{ps.errors}</span>
                      </div>
                    )}
                    <div className="aim-prov-row">
                      <span>Costo estimado (hoy)</span>
                      <span style={{ color: 'var(--adm-warning)' }}>{fmt.usd(ps.cost)}</span>
                    </div>
                  </>
                )}
              </div>

              {activacionOk === prov.id && (
                <div className="aim-test-ok">✓ Proveedor activado correctamente</div>
              )}
              {result?.ok    && activacionOk !== prov.id && <div className="aim-test-ok">✓ Conexión verificada</div>}
              {result && !result.ok && (
                <div className="aim-test-fail">
                  <div>✗ {result.error}</div>
                  {result.detail && (
                    <small style={{ display: 'block', marginTop: 4, opacity: 0.85 }}>
                      Detalle: {result.detail}
                    </small>
                  )}
                  {Array.isArray(result.triedModels) && result.triedModels.length > 1 && (
                    <small style={{ display: 'block', marginTop: 4, opacity: 0.85 }}>
                      Modelos probados: {result.triedModels.join(', ')}
                    </small>
                  )}
                </div>
              )}

              <div className="aim-prov-actions" style={{ flexWrap: 'wrap' }}>
                <button
                  className="aim-btn aim-btn-ghost"
                  disabled={isTesting}
                  onClick={() => handleTest(prov.id)}
                  title="Probar conexión"
                >
                  {isTesting ? '…' : '🔌 Probar'}
                </button>
                <button
                  className={`aim-btn ${isPrimary ? 'aim-btn-ghost' : 'aim-btn-primary'}`}
                  disabled={isTesting || isPrimary || isApagado}
                  onClick={() => onActivar(prov.id)}
                  title={isApagado ? 'Actívalo primero (está desactivado)' : isPrimary ? 'Ya es el proveedor principal' : 'Ponerlo de primero en la cola'}
                  style={{ width: 'auto', fontSize: 12 }}
                >
                  {isPrimary && !isApagado ? '✓ Principal' : '★ Hacer principal'}
                </button>
                <button
                  className="aim-btn aim-btn-ghost"
                  onClick={() => onToggleApagado?.(prov.id)}
                  title={isApagado
                    ? 'Activar: vuelve a estar disponible para el sistema'
                    : 'Desactivar: NO se usará en ninguna generación, ni como fallback'}
                  style={{ fontSize: 12, color: isApagado ? 'var(--adm-success)' : 'var(--adm-danger)' }}
                >
                  {isApagado ? '🟢 Activar' : '🔴 Desactivar'}
                </button>
                <button
                  className="aim-btn aim-btn-ghost"
                  disabled={isLast || isApagado}
                  onClick={() => onDesactivar(prov.id)}
                  title="Bajar prioridad: mover al final de la cola de fallback (sigue disponible)"
                  style={{ fontSize: 12 }}
                >
                  ⬇ Al final
                </button>
                <button
                  className="aim-btn aim-btn-ghost"
                  onClick={() => onEditarModelo(prov)}
                  title="Cambiar modelo"
                  style={{ fontSize: 12 }}
                >
                  ⚙ Modelo
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Tab: Proveedores (catálogo completo + drag & drop) ───────────────────────
function TabProveedores({ providerStatus, statusLoading, priority, savePriority, saving, models, onActivar }) {
  const dragItem = useRef(null)
  const dragOver = useRef(null)
  const [dragId, setDragId] = useState(null)

  const handleDragStart = (id) => { dragItem.current = id; setDragId(id) }
  const handleDragEnter = (id) => { dragOver.current = id }
  const handleDrop      = () => {
    if (!dragItem.current || dragItem.current === dragOver.current) return
    const next = [...priority]
    const from = next.indexOf(dragItem.current)
    const to   = next.indexOf(dragOver.current)
    if (from < 0 || to < 0) return
    next.splice(from, 1)
    next.splice(to, 0, dragItem.current)
    savePriority(next)
    dragItem.current = null
    dragOver.current = null
    setDragId(null)
  }

  const ordered = [...priority]
    .map(id => ACTIVE_PROVIDERS.find(p => p.id === id))
    .filter(Boolean)

  return (
    <div className="aim-tab-body">
      <div className="aim-section-head">
        <h3>Orden de Prioridad</h3>
        <span className="aim-section-hint">
          {saving ? '⏳ Guardando…' : 'Arrastra para cambiar el orden · Se guarda automáticamente en Firestore'}
        </span>
      </div>
      <div className="aim-priority-list">
        {ordered.map((prov, i) => {
          const configured = providerStatus?.providers?.[prov.id]?.configured ?? false
          const isPrimary  = i === 0
          return (
            <div
              key={prov.id}
              className={`aim-priority-item${dragId === prov.id ? ' aim-priority-item--dragging' : ''}`}
              draggable
              onDragStart={() => handleDragStart(prov.id)}
              onDragEnter={() => handleDragEnter(prov.id)}
              onDragEnd={handleDrop}
              onDragOver={e => e.preventDefault()}
            >
              <span className="aim-priority-handle">⠿</span>
              <span className="aim-priority-num">{i + 1}</span>
              <span className="aim-priority-logo">{prov.logo}</span>
              <div className="aim-priority-info">
                <strong>{prov.name}</strong>
                <span>{models?.[prov.id] || prov.model}</span>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                {configured
                  ? <Badge label="Configurado" variant="green" />
                  : <Badge label="Sin API Key" variant="dim" />}
                {isPrimary && <Badge label="Principal" variant="blue" />}
                {!isPrimary && (
                  <button
                    className="aim-btn aim-btn-primary"
                    style={{ fontSize: 11, padding: '4px 10px', width: 'auto' }}
                    onClick={e => { e.stopPropagation(); onActivar(prov.id) }}
                    title="Activar como principal (testea y mueve al puesto #1)"
                  >
                    Activar
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="aim-section-head" style={{ marginTop: 32 }}>
        <h3>Catálogo de Proveedores</h3>
        <span className="aim-section-hint">Proveedores activos y próximos</span>
      </div>
      <div className="aim-catalog-grid">
        {PROVIDER_CATALOG.map(prov => {
          const configured = prov.type === 'active' && (providerStatus?.providers?.[prov.id]?.configured ?? false)
          const isSoon     = prov.type === 'soon'

          return (
            <div key={prov.id} className={`aim-catalog-card${isSoon ? ' aim-catalog-card--soon' : ''}`}>
              <div className="aim-catalog-logo">{prov.logo}</div>
              <div className="aim-catalog-info">
                <div className="aim-catalog-name">{prov.name}</div>
                <div className="aim-catalog-desc">{prov.desc}</div>
                <code className="aim-catalog-model">{prov.model}</code>
              </div>
              <div className="aim-catalog-status">
                {isSoon     ? <Badge label="Próximamente" variant="dim" />
                 : configured ? <Badge label="Activo" variant="green" />
                 : <Badge label="Sin Key" variant="amber" />}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Tab: Historial ───────────────────────────────────────────────────────────
function TabHistorial({ logs, loading, reload }) {
  const [filterProv,  setFilterProv]  = useState('todos')
  const [filterMod,   setFilterMod]   = useState('todos')
  const [filterCache, setFilterCache] = useState('todos')

  const allProvs = [...new Set(logs.map(l => l.proveedor).filter(Boolean))]
  const allMods  = [...new Set(logs.map(l => l.modulo).filter(Boolean))]

  const visible = logs.filter(l => {
    if (filterProv !== 'todos' && l.proveedor !== filterProv) return false
    if (filterMod  !== 'todos' && l.modulo    !== filterMod)  return false
    if (filterCache === 'cache' && !l.cache) return false
    if (filterCache === 'real'  &&  l.cache) return false
    return true
  })

  const COLORS = { openai: '#10b981', abacus: '#6366f1', anthropic: '#f97316', nvidia: '#76b900', gemini: '#ef4444', cache: '#64748b', unknown: '#475569' }

  return (
    <div className="aim-tab-body">
      <div className="aim-section-head">
        <h3>Historial de Solicitudes</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select className="aim-select" value={filterProv} onChange={e => setFilterProv(e.target.value)}>
            <option value="todos">Todos los proveedores</option>
            {allProvs.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="aim-select" value={filterMod} onChange={e => setFilterMod(e.target.value)}>
            <option value="todos">Todos los módulos</option>
            {allMods.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select className="aim-select" value={filterCache} onChange={e => setFilterCache(e.target.value)}>
            <option value="todos">Cache + Real</option>
            <option value="cache">Solo caché</option>
            <option value="real">Solo llamadas reales</option>
          </select>
          <button className="aim-btn aim-btn-ghost" onClick={reload}>↻ Actualizar</button>
        </div>
      </div>

      {loading ? (
        <div className="aim-empty">Cargando historial…</div>
      ) : visible.length === 0 ? (
        <div className="aim-empty">No hay registros con estos filtros.</div>
      ) : (
        <div className="aim-table-wrap">
          <table className="aim-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Proveedor</th>
                <th>Módulo</th>
                <th>Modelo</th>
                <th>Tokens</th>
                <th>Costo</th>
                <th>Tiempo</th>
                <th>Cache</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {visible.slice(0, 100).map(log => (
                <tr key={log.id} className={log.error ? 'aim-row-error' : ''}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: 11 }}>{fmt.ts(log.fecha)}</td>
                  <td>
                    <span className="aim-prov-pill" style={{ background: `${COLORS[log.proveedor]||COLORS.unknown}22`, color: COLORS[log.proveedor]||COLORS.unknown }}>
                      {log.proveedor || '—'}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--adm-muted)' }}>{log.modulo || '—'}</td>
                  <td><code style={{ fontSize: 11 }}>{log.modelo || '—'}</code></td>
                  <td style={{ textAlign: 'right' }}>{fmt.num((log.tokensEntrada||0)+(log.tokensSalida||0))}</td>
                  <td style={{ textAlign: 'right', color: 'var(--adm-warning)' }}>{fmt.usd(log.costoEstimado||0)}</td>
                  <td style={{ textAlign: 'right' }}>{log.tiempoRespuesta ? fmt.ms(log.tiempoRespuesta) : '—'}</td>
                  <td style={{ textAlign: 'center' }}>{log.cache ? <span style={{ color: 'var(--adm-success)' }}>✓</span> : '—'}</td>
                  <td>{log.error ? <span style={{ color: 'var(--adm-danger)', fontSize: 11 }}>Error</span> : <span style={{ color: 'var(--adm-success)', fontSize: 11 }}>OK</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length > 100 && (
            <div className="aim-table-note">Mostrando 100 de {visible.length} registros</div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Tab: Estadísticas ────────────────────────────────────────────────────────
function TabEstadisticas({ stats, loading }) {
  const t = stats?.today
  const m = stats?.month

  const provData = Object.entries(m?.byProv||{}).map(([k,v]) => ({ label: k, value: v })).sort((a,b) => b.value-a.value)
  const modData  = Object.entries(m?.byMod ||{}).map(([k,v]) => ({ label: k, value: v })).sort((a,b) => b.value-a.value).slice(0,6)

  const PROV_COLORS = { openai: '#10b981', abacus: '#6366f1', anthropic: '#f97316', nvidia: '#76b900', gemini: '#ef4444', cache: '#64748b' }
  const MOD_COLORS  = ['#6366f1','#10b981','#f59e0b','#3b82f6','#ec4899','#8b5cf6']

  const cacheHitPct = t?.total > 0 ? Math.round((t.hits / t.total) * 100) : 0

  // Stats detalladas por proveedor (mes)
  const provDetalle = computeProviderStats(m?.logs)

  return (
    <div className="aim-tab-body">
      {loading && <div className="aim-empty">Calculando estadísticas…</div>}
      {!loading && (
        <>
          <div className="aim-stats-grid">
            <StatCard icon="📊" label="Total solicitudes mes" value={fmt.num(m?.total||0)} />
            <StatCard icon="🔤" label="Tokens totales mes"    value={fmt.num(m?.tokens||0)} />
            <StatCard icon="💳" label="Costo total mes"       value={fmt.usd(m?.cost||0)}   accent="amber" />
            <StatCard icon="🎯" label="Cache Hit (hoy)"       value={`${cacheHitPct}%`}    accent="green" />
          </div>

          {/* Detalle por proveedor (mes) */}
          {Object.keys(provDetalle).length > 0 && (
            <>
              <div className="aim-section-head" style={{ marginTop: 8 }}>
                <h3>Detalle por proveedor (mes)</h3>
              </div>
              <div className="aim-table-wrap">
                <table className="aim-table">
                  <thead>
                    <tr>
                      <th>Proveedor</th>
                      <th style={{ textAlign:'right' }}>Solicitudes</th>
                      <th style={{ textAlign:'right' }}>Tokens</th>
                      <th style={{ textAlign:'right' }}>Errores</th>
                      <th style={{ textAlign:'right' }}>Costo est.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(provDetalle).map(([prov, ps]) => (
                      <tr key={prov}>
                        <td>{prov}</td>
                        <td style={{ textAlign:'right' }}>{fmt.num(ps.requests)}</td>
                        <td style={{ textAlign:'right' }}>{fmt.num(ps.tokens)}</td>
                        <td style={{ textAlign:'right', color: ps.errors > 0 ? 'var(--adm-danger)' : 'var(--adm-dim)' }}>{ps.errors}</td>
                        <td style={{ textAlign:'right', color:'var(--adm-warning)' }}>{fmt.usd(ps.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="aim-charts-row">
            <div className="aim-chart-card">
              <h4>Solicitudes por proveedor (mes)</h4>
              {provData.length === 0
                ? <div className="aim-empty" style={{ fontSize: 13 }}>Sin datos</div>
                : <MiniBarChart data={provData} colorFn={(d) => PROV_COLORS[d.label] || '#6366f1'} />
              }
            </div>
            <div className="aim-chart-card">
              <h4>Solicitudes por módulo (mes)</h4>
              {modData.length === 0
                ? <div className="aim-empty" style={{ fontSize: 13 }}>Sin datos</div>
                : <MiniBarChart data={modData} colorFn={(_, i) => MOD_COLORS[i % MOD_COLORS.length]} />
              }
            </div>
          </div>

          <div className="aim-chart-card" style={{ marginTop: 16 }}>
            <h4>Eficiencia del caché</h4>
            <div className="aim-cache-gauge">
              <div className="aim-cache-gauge-track">
                <div className="aim-cache-gauge-fill" style={{ width: `${cacheHitPct}%` }} />
              </div>
              <div className="aim-cache-gauge-labels">
                <span>0%</span>
                <span style={{ color: 'var(--adm-success)', fontWeight: 700 }}>{cacheHitPct}% hits</span>
                <span>100%</span>
              </div>
              <div className="aim-cache-gauge-legend">
                <span><span style={{ color:'var(--adm-success)'}}>■</span> Desde caché: {fmt.num(t?.hits||0)} · Ahorro: {fmt.usd(t?.saved||0)}</span>
                <span><span style={{ color:'var(--adm-accent)'}}>■</span> Llamadas reales: {fmt.num((t?.total||0) - (t?.hits||0))}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Tab: Caché ───────────────────────────────────────────────────────────────
function TabCache({ data, loading, clearing, reload, clearAll }) {
  const [confirm, setConfirm] = useState(false)

  return (
    <div className="aim-tab-body">
      <div className="aim-section-head">
        <h3>Panel de Caché</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="aim-btn aim-btn-ghost" onClick={reload}>↻ Actualizar</button>
          <button
            className="aim-btn aim-btn-danger"
            disabled={clearing || !data?.count}
            onClick={() => confirm ? (clearAll(), setConfirm(false)) : setConfirm(true)}
          >
            {clearing ? '…' : confirm ? '¿Confirmar limpieza?' : '🗑 Limpiar caché'}
          </button>
          {confirm && <button className="aim-btn aim-btn-ghost" onClick={() => setConfirm(false)}>Cancelar</button>}
        </div>
      </div>

      <div className="aim-stats-grid">
        <StatCard icon="📦" label="Entradas en caché"   value={loading ? '—' : fmt.num(data?.count||0)}          />
        <StatCard icon="🔤" label="Tokens almacenados"  value={loading ? '—' : fmt.num(data?.tokensGuardados||0)} />
        <StatCard icon="💰" label="Ahorro estimado"     value={loading ? '—' : fmt.usd((data?.count||0) * 0.006)} accent="green" />
        <StatCard icon="⚡" label="RTT evitados"        value={loading ? '—' : fmt.num(data?.count||0)}           accent="blue" />
      </div>

      <div className="admin-info-panel" style={{ marginTop: 24 }}>
        <h3>Cómo funciona el caché</h3>
        <ul className="admin-status-list">
          <li><span className="status-dot green"/>Cada respuesta de IA se guarda en Firestore (<code>aiCache/</code>) con TTL configurable por módulo</li>
          <li><span className="status-dot green"/>Si la misma pregunta se hace antes de que expire, se devuelve sin llamar al proveedor</li>
          <li><span className="status-dot green"/>Módulos con caché: auditoría-ia (7d), planificación (24h), instrumentos (24h), reportes (12h), currículo (30d)</li>
          <li><span className="status-dot green"/>Módulos sin caché: centro-ia, chat (prompts únicos del usuario)</li>
        </ul>
      </div>
    </div>
  )
}

// ─── Tab: Costos ──────────────────────────────────────────────────────────────
function TabCostos({ stats, loading }) {
  const t = stats?.today
  const m = stats?.month

  const RATES = {
    'claude-sonnet-5':           { in: 3.0,  out: 15.0 },
    'claude-fable-5':            { in: 0.80, out: 4.0  },
    'claude-opus-4-8':           { in: 15.0, out: 75.0 },
    'claude-haiku-4-5-20251001': { in: 0.8,  out: 4.0  },
    'claude-sonnet-4-6':         { in: 3.0,  out: 15.0 },
    'gpt-4o':                    { in: 2.5,  out: 10.0 },
    'gpt-4o-mini':               { in: 0.15, out: 0.6  },
    'gpt-4.1':                   { in: 2.0,  out: 8.0  },
    'gpt-5':                     { in: 15.0, out: 60.0 },
    'route-llm':                 { in: 1.0,  out: 3.0  },
  }

  const provCost = Object.entries(m?.byProv||{}).map(([prov, count]) => ({
    prov, count,
    cost: (m?.logs||[]).filter(l=>l.proveedor===prov).reduce((s,l)=>s+parseFloat(l.costoEstimado||0),0),
  }))

  const proyMes  = m?.total > 0 ? (m.cost / new Date().getDate()) * 30 : 0
  const proyAnio = proyMes * 12
  const ahorro   = (m?.hits||0) * 0.006

  return (
    <div className="aim-tab-body">
      <div className="aim-stats-grid">
        <StatCard icon="💳" label="Costo hoy"           value={loading ? '—' : fmt.usd(t?.cost||0)}   accent="amber" />
        <StatCard icon="📅" label="Costo este mes"       value={loading ? '—' : fmt.usd(m?.cost||0)}   accent="amber" />
        <StatCard icon="📈" label="Proyección 30 días"   value={loading ? '—' : fmt.usd(proyMes)}      />
        <StatCard icon="📊" label="Proyección anual"     value={loading ? '—' : fmt.usd(proyAnio)}     />
        <StatCard icon="💰" label="Ahorro por caché mes" value={loading ? '—' : fmt.usd(ahorro)}       accent="green" />
        <StatCard icon="🔤" label="Tokens mes"           value={loading ? '—' : fmt.num(m?.tokens||0)} />
      </div>

      <div className="aim-section-head" style={{ marginTop: 24 }}>
        <h3>Costo por proveedor (mes)</h3>
      </div>
      {loading ? <div className="aim-empty">Calculando…</div> : (
        <div className="aim-table-wrap">
          <table className="aim-table">
            <thead><tr><th>Proveedor</th><th>Solicitudes</th><th>Costo est.</th><th>% del total</th></tr></thead>
            <tbody>
              {provCost.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign:'center', color:'var(--adm-dim)' }}>Sin datos este mes</td></tr>
              )}
              {provCost.map(r => (
                <tr key={r.prov}>
                  <td>{r.prov}</td>
                  <td style={{ textAlign:'right' }}>{fmt.num(r.count)}</td>
                  <td style={{ textAlign:'right', color:'var(--adm-warning)' }}>{fmt.usd(r.cost)}</td>
                  <td style={{ textAlign:'right' }}>{m?.cost > 0 ? `${Math.round((r.cost/m.cost)*100)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="aim-section-head" style={{ marginTop: 24 }}>
        <h3>Tarifas de referencia</h3>
        <span className="aim-section-hint">Por 1M tokens · Referencial</span>
      </div>
      <div className="aim-table-wrap">
        <table className="aim-table">
          <thead><tr><th>Modelo</th><th>Entrada (1M tokens)</th><th>Salida (1M tokens)</th></tr></thead>
          <tbody>
            {Object.entries(RATES).map(([model, r]) => (
              <tr key={model}>
                <td><code>{model}</code></td>
                <td style={{ textAlign:'right' }}>US${r.in.toFixed(2)}</td>
                <td style={{ textAlign:'right' }}>US${r.out.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
const TABS = [
  { id: 'resumen',      label: 'Resumen'      },
  { id: 'proveedores',  label: 'Proveedores'  },
  { id: 'historial',    label: 'Historial'    },
  { id: 'estadisticas', label: 'Estadísticas' },
  { id: 'cache',        label: 'Caché'        },
  { id: 'costos',       label: 'Costos'       },
]

export default function AdminIA() {
  const [tab, setTab] = useState('resumen')

  // Provider status (env vars check)
  const [providerStatus, setProviderStatus] = useState(null)
  const [statusLoading,  setStatusLoading]  = useState(true)
  const [testResults,    setTestResults]    = useState({})
  const [testing,        setTesting]        = useState({})
  const [ultimaPrueba,   setUltimaPrueba]   = useState({})
  const [activacionOk,   setActivacionOk]   = useState(null) // id del proveedor activado recientemente
  const [modalModelo,    setModalModelo]    = useState(null) // prov object

  // Stats & history
  const { stats, loading: statsLoading, reload: statsReload } = useAIStats()
  const { logs,  loading: histLoading,  reload: histReload  } = useHistorial()
  const { data: cacheData, loading: cacheLoading, clearing, reload: cacheReload, clearAll } = useCacheStats()

  // Provider priority + models (Firestore config/ia-gateway)
  const { priority, savePriority, models, saveModels, saving, apagados, toggleApagado } = useProviderPriority()

  // Load provider status (env var check via /api/ai/status)
  useEffect(() => {
    fetch('/api/ai/status')
      .then(r => r.ok ? r.json() : null)
      .then(d => { setProviderStatus(d); setStatusLoading(false) })
      .catch(() => setStatusLoading(false))
  }, [])

  // ─── Probar conexión ───────────────────────────────────────────────────────
  const handleTest = async (providerId) => {
    setTesting(p => ({ ...p, [providerId]: true }))
    setTestResults(p => ({ ...p, [providerId]: null }))
    try {
      const res  = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId, model: models?.[providerId] }),
      })
      const data = await res.json()
      setTestResults(p => ({ ...p, [providerId]: data }))
      if (data.ok && data.model && data.model !== models?.[providerId]) {
        saveModels({ ...models, [providerId]: data.model })
      }
      setUltimaPrueba(p => ({ ...p, [providerId]: new Date().toLocaleTimeString('es-DO') }))
    } catch {
      setTestResults(p => ({ ...p, [providerId]: { ok: false, error: 'Error de conexión' } }))
    }
    setTesting(p => ({ ...p, [providerId]: false }))
  }

  // ─── Activar proveedor ─────────────────────────────────────────────────────
  // 1. Prueba la conexión real
  // 2. Si ok → mueve a posición #1 y guarda en Firestore
  // 3. Muestra confirmación durante 3s
  const activar = async (provId) => {
    setTesting(p => ({ ...p, [provId]: true }))
    setTestResults(p => ({ ...p, [provId]: null }))
    try {
      const res  = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: provId, model: models?.[provId] }),
      })
      const data = await res.json()
      setTestResults(p => ({ ...p, [provId]: data }))
      setUltimaPrueba(p => ({ ...p, [provId]: new Date().toLocaleTimeString('es-DO') }))

      if (data.ok) {
        if (data.model && data.model !== models?.[provId]) {
          saveModels({ ...models, [provId]: data.model })
        }
        const next = [provId, ...priority.filter(p => p !== provId)]
        savePriority(next)
        setActivacionOk(provId)
        setTimeout(() => setActivacionOk(null), 3500)
      }
    } catch {
      setTestResults(p => ({ ...p, [provId]: { ok: false, error: 'Error de conexión' } }))
    }
    setTesting(p => ({ ...p, [provId]: false }))
  }

  // ─── Desactivar proveedor (mover al final) ─────────────────────────────────
  const desactivar = (provId) => {
    const next = [...priority.filter(p => p !== provId), provId]
    savePriority(next)
  }

  // ─── Guardar modelo seleccionado ───────────────────────────────────────────
  const guardarModelo = (provId, model) => {
    saveModels({ ...models, [provId]: model })
    setModalModelo(null)
  }

  const configuredCount = providerStatus
    ? Object.values(providerStatus.providers||{}).filter(p => p.configured).length : 0
  const activeProv     = priority.find(id => !apagados.includes(id) && providerStatus?.providers?.[id]?.configured)
    || (!apagados.includes(providerStatus?.primaryProvider) ? providerStatus?.primaryProvider : null)
  const activeProvName = PROVIDER_CATALOG.find(p => p.id === activeProv)?.name || activeProv || '—'

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div className="admin-page-header-text">
          <h2>Motor de Inteligencia Artificial</h2>
          <p>
            Administra todos los proveedores de IA de DocenteOS. Las API Keys permanecen
            únicamente en el servidor y nunca son expuestas al navegador.
          </p>
        </div>
      </div>

      {/* Tab nav */}
      <div className="aim-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`aim-tab-btn${tab === t.id ? ' aim-tab-btn--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'resumen' && (
        <TabResumen
          providerStatus={providerStatus} statusLoading={statusLoading}
          stats={stats} statsLoading={statsLoading} statsReload={statsReload}
          testResults={testResults} testing={testing} ultimaPrueba={ultimaPrueba}
          handleTest={handleTest}
          configuredCount={configuredCount} activeProvName={activeProvName}
          priority={priority} models={models}
          onActivar={activar} onDesactivar={desactivar} onEditarModelo={setModalModelo}
          apagados={apagados} onToggleApagado={toggleApagado}
          activacionOk={activacionOk}
        />
      )}
      {tab === 'proveedores' && (
        <TabProveedores
          providerStatus={providerStatus} statusLoading={statusLoading}
          priority={priority} savePriority={savePriority} saving={saving}
          models={models} onActivar={activar}
        />
      )}
      {tab === 'historial'    && <TabHistorial logs={logs}  loading={histLoading}  reload={histReload}  />}
      {tab === 'estadisticas' && <TabEstadisticas stats={stats} loading={statsLoading} />}
      {tab === 'cache'        && <TabCache data={cacheData} loading={cacheLoading} clearing={clearing} reload={cacheReload} clearAll={clearAll} />}
      {tab === 'costos'       && <TabCostos stats={stats} loading={statsLoading} />}

      {/* Modal: editar modelo */}
      {modalModelo && (
        <ModalEditarModelo
          prov={modalModelo}
          currentModel={models[modalModelo.id]}
          onSave={(model) => guardarModelo(modalModelo.id, model)}
          onClose={() => setModalModelo(null)}
        />
      )}
    </div>
  )
}
