/**
 * AdminSubscriptions — Panel de administración de suscripciones y pagos.
 */

import { useState, useEffect } from 'react'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '../../firebase.js'
import { useAuth } from '../../context/AuthContext.jsx'
import {
  SUBSCRIPTION_STATUSES, PLANS, PAYMENT_METHODS,
  STATUS_LABEL, daysRemaining, fmtDate,
  activateUser, setPendingPayment, suspendUser, cancelUser,
  setGracePeriod, renewSubscription, registerPayment,
  getPaymentHistory,
} from '../../services/subscriptionService.js'

// ─── Helpers visuales ──────────────────────────────────────────────────────────

const STATUS_BADGES = {
  trial:           { bg: '#1e3a5f', color: '#60a5fa' },
  active:          { bg: '#14532d', color: '#4ade80' },
  pending_payment: { bg: '#78350f', color: '#fbbf24' },
  grace_period:    { bg: '#7c2d12', color: '#fb923c' },
  suspended:       { bg: '#7f1d1d', color: '#f87171' },
  cancelled:       { bg: '#1e293b', color: '#94a3b8' },
}

function StatusBadge({ status }) {
  const s = STATUS_BADGES[status] || STATUS_BADGES.cancelled
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 7,
      fontSize: 11, fontWeight: 700, background: s.bg, color: s.color,
      border: `1px solid ${s.color}44`,
    }}>
      {STATUS_LABEL(status)}
    </span>
  )
}

function DaysChip({ endAt }) {
  const days = daysRemaining(endAt)
  if (days === null) return <span style={{ color: 'var(--adm-dim)' }}>—</span>
  const color = days < 0 ? 'var(--adm-danger)' : days <= 7 ? 'var(--adm-warning)' : 'var(--adm-success)'
  return <span style={{ color, fontWeight: 700 }}>{days < 0 ? `Vencido hace ${-days}d` : `${days} días`}</span>
}

// ─── Modal base ────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }) {
  return (
    <div className="admin-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="admin-modal">
        <div className="admin-modal-header">
          <h3>{title}</h3>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal-body">{children}</div>
      </div>
    </div>
  )
}

// ─── Modal: Registrar pago ────────────────────────────────────────────────────

function ModalPago({ usuario, onClose, adminUid }) {
  const [form, setForm] = useState({
    amount: '', currency: 'DOP', method: 'transferencia',
    reference: '', paidAt: new Date().toISOString().slice(0, 10),
    periodDays: 30, note: '',
  })
  const [saving, setSaving] = useState(false)
  const [done,   setDone]   = useState(false)
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const guardar = async () => {
    if (!form.amount) return
    setSaving(true)
    try {
      await registerPayment(usuario.id, form, adminUid)
      setDone(true)
      setTimeout(onClose, 1200)
    } catch(e) {
      console.error(e)
    } finally { setSaving(false) }
  }

  return (
    <Modal title={`Registrar pago — ${usuario.nombre || usuario.email}`} onClose={onClose}>
      {done ? (
        <div style={{ textAlign: 'center', color: 'var(--adm-success)', padding: 24, fontWeight: 700 }}>
          ✓ Pago registrado y cuenta activada
        </div>
      ) : (
        <div className="admin-form-grid cols-1" style={{ gap: 12 }}>
          <div className="admin-form-group">
            <label className="admin-form-label">Monto</label>
            <input type="number" className="admin-form-input" placeholder="Ej: 1500" value={form.amount} onChange={e => f('amount', e.target.value)} />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Moneda</label>
            <select className="admin-form-select" value={form.currency} onChange={e => f('currency', e.target.value)}>
              <option value="DOP">DOP — Peso dominicano</option>
              <option value="USD">USD — Dólar americano</option>
            </select>
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Método de pago</label>
            <select className="admin-form-select" value={form.method} onChange={e => f('method', e.target.value)}>
              {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Fecha de pago</label>
            <input type="date" className="admin-form-input" value={form.paidAt} onChange={e => f('paidAt', e.target.value)} />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Período cubierto (días)</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {[15, 30, 60, 90].map(d => (
                <button
                  key={d}
                  className="aim-btn aim-btn-ghost"
                  style={form.periodDays === d ? { borderColor: 'var(--adm-accent)', color: 'var(--adm-accent)' } : {}}
                  onClick={() => f('periodDays', d)}
                >
                  {d}d
                </button>
              ))}
              <input
                type="number" className="admin-form-input" style={{ width: 80 }}
                value={form.periodDays}
                onChange={e => f('periodDays', Number(e.target.value))}
              />
            </div>
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Referencia / comprobante</label>
            <input className="admin-form-input" placeholder="Nro. de transferencia, recibo…" value={form.reference} onChange={e => f('reference', e.target.value)} />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Nota del administrador</label>
            <textarea className="admin-form-textarea" rows={2} value={form.note} onChange={e => f('note', e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button className="admin-save-btn" disabled={saving || !form.amount} onClick={guardar}>
              {saving ? 'Guardando…' : '✓ Registrar pago y activar'}
            </button>
            <button className="aim-btn aim-btn-ghost" onClick={onClose}>Cancelar</button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ─── Modal: Cambiar estado ────────────────────────────────────────────────────

function ModalEstado({ usuario, onClose, adminUid }) {
  const [saving, setSaving] = useState(false)
  const [done,   setDone]   = useState(false)

  const cambiar = async (fn) => {
    setSaving(true)
    try { await fn(); setDone(true); setTimeout(onClose, 900) }
    catch(e) { console.error(e) }
    finally { setSaving(false) }
  }

  const ACCIONES = [
    { label: 'Activar',            color: 'var(--adm-success)', fn: () => activateUser(usuario.id, null, adminUid) },
    { label: 'Marcar pendiente',   color: 'var(--adm-warning)', fn: () => setPendingPayment(usuario.id, adminUid) },
    { label: 'Agregar gracia 3d',  color: 'var(--adm-warning)', fn: () => setGracePeriod(usuario.id, 3, adminUid) },
    { label: 'Renovar 30 días',    color: 'var(--adm-info)',    fn: () => renewSubscription(usuario.id, 30, adminUid) },
    { label: 'Renovar 15 días',    color: 'var(--adm-info)',    fn: () => renewSubscription(usuario.id, 15, adminUid) },
    { label: 'Suspender',          color: 'var(--adm-danger)',  fn: () => suspendUser(usuario.id, adminUid) },
    { label: 'Cancelar cuenta',    color: 'var(--adm-dim)',     fn: () => cancelUser(usuario.id, adminUid) },
  ]

  return (
    <Modal title={`Gestionar — ${usuario.nombre || usuario.email}`} onClose={onClose}>
      {done ? (
        <div style={{ textAlign:'center', color:'var(--adm-success)', padding: 24, fontWeight: 700 }}>✓ Estado actualizado</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap: 8 }}>
          <p style={{ fontSize: 13, color:'var(--adm-dim)', marginBottom: 8 }}>
            Estado actual: <StatusBadge status={usuario.subscriptionStatus} />
          </p>
          {ACCIONES.map(a => (
            <button
              key={a.label}
              className="aim-btn aim-btn-ghost"
              style={{ textAlign:'left', color: a.color, borderColor: `${a.color}44` }}
              disabled={saving}
              onClick={() => cambiar(a.fn)}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </Modal>
  )
}

// ─── Modal: Historial de pagos ────────────────────────────────────────────────

function ModalHistorial({ usuario, onClose }) {
  const [historial, setHistorial] = useState([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    getPaymentHistory(usuario.id)
      .then(h => { setHistorial(h); setLoading(false) })
      .catch(() => setLoading(false))
  }, [usuario.id])

  return (
    <Modal title={`Historial de pagos — ${usuario.nombre || usuario.email}`} onClose={onClose}>
      {loading ? (
        <div style={{ color:'var(--adm-dim)', padding:24, textAlign:'center' }}>Cargando…</div>
      ) : historial.length === 0 ? (
        <div style={{ color:'var(--adm-dim)', padding:24, textAlign:'center' }}>Sin pagos registrados.</div>
      ) : (
        <div className="aim-table-wrap">
          <table className="aim-table">
            <thead><tr><th>Fecha</th><th>Monto</th><th>Método</th><th>Período</th><th>Ref.</th></tr></thead>
            <tbody>
              {historial.map(p => (
                <tr key={p.id}>
                  <td style={{ fontSize:11, whiteSpace:'nowrap' }}>{fmtDate(p.paidAt)}</td>
                  <td style={{ textAlign:'right', color:'var(--adm-warning)' }}>{p.currency} {Number(p.amount||0).toLocaleString()}</td>
                  <td>{p.method || '—'}</td>
                  <td style={{ fontSize:11 }}>{fmtDate(p.periodStart)} → {fmtDate(p.periodEnd)}</td>
                  <td style={{ fontSize:11, color:'var(--adm-dim)' }}>{p.reference || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AdminSubscriptions() {
  const { user } = useAuth()
  const adminUid = user?.uid

  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [modal, setModal]   = useState(null)  // { tipo, usuario }

  useEffect(() => {
    if (!db) { setCargando(false); return }
    const q = query(collection(db, 'usuarios'), orderBy('fechaCreacion', 'desc'))
    const unsub = onSnapshot(q,
      snap => { setUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setCargando(false) },
      ()   => setCargando(false)
    )
    return unsub
  }, [])

  const visibles = usuarios.filter(u => {
    const texto = busqueda.toLowerCase()
    const matchBusq = !texto ||
      u.nombre?.toLowerCase().includes(texto) ||
      u.email?.toLowerCase().includes(texto) ||
      u.perfilInstitucional?.centroEducativo?.toLowerCase().includes(texto)
    const matchEstado = filtroEstado === 'todos' || u.subscriptionStatus === filtroEstado
    return matchBusq && matchEstado
  })

  const kpis = {
    total:    usuarios.length,
    active:   usuarios.filter(u => u.subscriptionStatus === 'active').length,
    trial:    usuarios.filter(u => u.subscriptionStatus === 'trial').length,
    pending:  usuarios.filter(u => u.subscriptionStatus === 'pending_payment').length,
    suspended:usuarios.filter(u => u.subscriptionStatus === 'suspended').length,
    expiring: usuarios.filter(u => {
      const d = daysRemaining(u.subscriptionEndAt)
      return d !== null && d >= 0 && d <= 7 && u.subscriptionStatus === 'active'
    }).length,
  }

  const abrirModal = (tipo, usuario) => setModal({ tipo, usuario })
  const cerrarModal = () => setModal(null)

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div className="admin-page-header-text">
          <h2>Pagos y Suscripciones</h2>
          <p>Gestión centralizada de estados, pagos manuales, renovaciones y auditoría de cuentas.</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="aim-stats-grid" style={{ marginBottom: 20 }}>
        <div className="aim-stat"><div className="aim-stat-icon">👥</div><div className="aim-stat-body"><div className="aim-stat-val">{kpis.total}</div><div className="aim-stat-label">Total usuarios</div></div></div>
        <div className="aim-stat aim-stat--green"><div className="aim-stat-icon">✅</div><div className="aim-stat-body"><div className="aim-stat-val">{kpis.active}</div><div className="aim-stat-label">Activos</div></div></div>
        <div className="aim-stat"><div className="aim-stat-icon">🧪</div><div className="aim-stat-body"><div className="aim-stat-val">{kpis.trial}</div><div className="aim-stat-label">En prueba (beta)</div></div></div>
        <div className="aim-stat aim-stat--amber"><div className="aim-stat-icon">⚠️</div><div className="aim-stat-body"><div className="aim-stat-val">{kpis.pending}</div><div className="aim-stat-label">Pendiente de pago</div></div></div>
        <div className="aim-stat aim-stat--blue"><div className="aim-stat-icon">⏳</div><div className="aim-stat-body"><div className="aim-stat-val">{kpis.expiring}</div><div className="aim-stat-label">Próximos a vencer</div></div></div>
        <div className="aim-stat" style={{ borderColor: 'var(--adm-danger)' }}><div className="aim-stat-icon">🔴</div><div className="aim-stat-body"><div className="aim-stat-val">{kpis.suspended}</div><div className="aim-stat-label">Suspendidos</div></div></div>
      </div>

      {/* Filtros */}
      <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
        <input
          className="admin-search-input"
          placeholder="Buscar por nombre, correo o centro…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={{ flex:1, minWidth:220 }}
        />
        <select className="aim-select" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="todos">Todos los estados</option>
          {Object.entries(SUBSCRIPTION_STATUSES).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Tabla */}
      {cargando ? (
        <div className="aim-empty">Cargando usuarios…</div>
      ) : (
        <div className="aim-table-wrap">
          <table className="aim-table">
            <thead>
              <tr>
                <th>Nombre / Correo</th>
                <th>Centro</th>
                <th>Plan</th>
                <th>Estado</th>
                <th>Vencimiento</th>
                <th>Días restantes</th>
                <th>Último pago</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibles.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign:'center', color:'var(--adm-dim)', padding:24 }}>Sin usuarios con estos filtros.</td></tr>
              )}
              {visibles.map(u => {
                const perfil = u.perfilInstitucional || {}
                return (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{u.nombre || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--adm-dim)' }}>{u.email || '—'}</div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--adm-muted)' }}>
                      {perfil.centroEducativo || perfil.centro || '—'}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {PLANS[u.plan] ?? u.plan ?? <span style={{ color:'var(--adm-dim)' }}>—</span>}
                    </td>
                    <td><StatusBadge status={u.subscriptionStatus} /></td>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(u.subscriptionEndAt)}</td>
                    <td><DaysChip endAt={u.subscriptionEndAt} /></td>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(u.lastPaymentAt)}</td>
                    <td>
                      <div style={{ display:'flex', gap:5 }}>
                        <button
                          className="aim-btn aim-btn-primary"
                          style={{ fontSize: 11, padding: '5px 10px', width: 'auto' }}
                          title="Registrar pago"
                          onClick={() => abrirModal('pago', u)}
                        >
                          💳 Pago
                        </button>
                        <button
                          className="aim-btn aim-btn-ghost"
                          style={{ fontSize: 11, padding: '5px 10px' }}
                          title="Gestionar estado"
                          onClick={() => abrirModal('estado', u)}
                        >
                          ⚙️
                        </button>
                        <button
                          className="aim-btn aim-btn-ghost"
                          style={{ fontSize: 11, padding: '5px 10px' }}
                          title="Ver historial de pagos"
                          onClick={() => abrirModal('historial', u)}
                        >
                          📋
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="aim-table-note">{visibles.length} de {usuarios.length} usuarios</div>
        </div>
      )}

      {modal?.tipo === 'pago'      && <ModalPago      usuario={modal.usuario} onClose={cerrarModal} adminUid={adminUid} />}
      {modal?.tipo === 'estado'    && <ModalEstado    usuario={modal.usuario} onClose={cerrarModal} adminUid={adminUid} />}
      {modal?.tipo === 'historial' && <ModalHistorial usuario={modal.usuario} onClose={cerrarModal} />}
    </div>
  )
}
