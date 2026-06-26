/**
 * SubscriptionPage — Vista del docente sobre su plan, estado y pagos.
 */

import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { getStatusMessage } from '../utils/featureGate.js'
import { reportPaymentByUser, PAYMENT_METHODS, fmtDate, daysRemaining } from '../services/subscriptionService.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_INFO = {
  trial:           { label: 'Período de prueba',  icon: '🧪', color: '#60a5fa' },
  active:          { label: 'Activo',              icon: '✅', color: '#4ade80' },
  pending_payment: { label: 'Pendiente de pago',   icon: '⚠️', color: '#fbbf24' },
  grace_period:    { label: 'Período de gracia',   icon: '⏳', color: '#fb923c' },
  suspended:       { label: 'Suspendido',           icon: '🔴', color: '#f87171' },
  cancelled:       { label: 'Cancelado',            icon: '🚫', color: '#94a3b8' },
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #1e293b' }}>
      <span style={{ fontSize:13, color:'#94a3b8' }}>{label}</span>
      <span style={{ fontSize:13, fontWeight:600, color:'#f1f5f9' }}>{value || '—'}</span>
    </div>
  )
}

// ─── Formulario de reporte de pago ────────────────────────────────────────────

function ReportarPagoForm({ uid, onExito }) {
  const [form, setForm] = useState({
    method: 'transferencia', amount: '', currency: 'DOP',
    paidAt: new Date().toISOString().slice(0, 10),
    reference: '', note: '',
  })
  const [enviando, setEnviando] = useState(false)
  const [error,    setError]    = useState('')
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const enviar = async () => {
    if (!form.amount || !form.reference) {
      setError('Por favor completa el monto y número de referencia.')
      return
    }
    setEnviando(true)
    setError('')
    try {
      await reportPaymentByUser(uid, form)
      onExito()
    } catch(e) {
      console.error(e)
      setError('Error al enviar el reporte. Intenta nuevamente.')
    } finally { setEnviando(false) }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <p style={{ fontSize:13, color:'#94a3b8', marginBottom:4 }}>
        Completa el formulario para notificar al administrador. Tu cuenta será activada una vez verificado el pago.
      </p>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <div>
          <label style={{ fontSize:12, color:'#94a3b8', display:'block', marginBottom:4 }}>Monto</label>
          <input
            type="number" className="admin-form-input"
            placeholder="Ej: 1500" value={form.amount}
            onChange={e => f('amount', e.target.value)}
          />
        </div>
        <div>
          <label style={{ fontSize:12, color:'#94a3b8', display:'block', marginBottom:4 }}>Moneda</label>
          <select className="admin-form-select" value={form.currency} onChange={e => f('currency', e.target.value)}>
            <option value="DOP">DOP</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>

      <div>
        <label style={{ fontSize:12, color:'#94a3b8', display:'block', marginBottom:4 }}>Método de pago</label>
        <select className="admin-form-select" value={form.method} onChange={e => f('method', e.target.value)}>
          {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div>
        <label style={{ fontSize:12, color:'#94a3b8', display:'block', marginBottom:4 }}>Fecha del pago</label>
        <input type="date" className="admin-form-input" value={form.paidAt} onChange={e => f('paidAt', e.target.value)} />
      </div>

      <div>
        <label style={{ fontSize:12, color:'#94a3b8', display:'block', marginBottom:4 }}>Número de referencia / comprobante *</label>
        <input
          className="admin-form-input"
          placeholder="Nro. de transferencia, recibo, etc."
          value={form.reference}
          onChange={e => f('reference', e.target.value)}
        />
      </div>

      <div>
        <label style={{ fontSize:12, color:'#94a3b8', display:'block', marginBottom:4 }}>Nota adicional (opcional)</label>
        <textarea
          className="admin-form-textarea" rows={2}
          value={form.note}
          onChange={e => f('note', e.target.value)}
        />
      </div>

      {error && <p style={{ color:'#f87171', fontSize:12 }}>{error}</p>}

      <button
        className="admin-save-btn"
        disabled={enviando}
        onClick={enviar}
        style={{ marginTop:4 }}
      >
        {enviando ? 'Enviando…' : '📤 Enviar reporte de pago'}
      </button>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function SubscriptionPage() {
  const { user, suscripcion } = useAuth()
  const [mostrarReporte, setMostrarReporte] = useState(false)
  const [reporteEnviado, setReporteEnviado] = useState(false)

  const sub = suscripcion || {}
  const info = STATUS_INFO[sub.status] || STATUS_INFO.trial
  const days = daysRemaining(sub.endAt)
  const mensaje = getStatusMessage(sub.status, sub.endAt, sub.graceEndsAt)

  const onExito = () => {
    setReporteEnviado(true)
    setMostrarReporte(false)
  }

  return (
    <div style={{ maxWidth: 580, margin: '0 auto', padding: '24px 16px' }}>

      {/* Encabezado de estado */}
      <div style={{
        background: '#0f172a',
        border: `1px solid ${info.color}44`,
        borderRadius: 12,
        padding: 24,
        marginBottom: 20,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
          <span style={{ fontSize: 28 }}>{info.icon}</span>
          <div>
            <div style={{ fontSize:18, fontWeight:700, color:'#f1f5f9' }}>Mi Suscripción</div>
            <div style={{ fontSize:13, color: info.color, fontWeight:600 }}>{info.label}</div>
          </div>
        </div>

        {mensaje && (
          <div style={{
            background: `${info.color}18`, border:`1px solid ${info.color}44`,
            borderRadius:8, padding:'10px 14px', fontSize:13, color:'#f1f5f9', lineHeight:1.5,
          }}>
            {mensaje}
          </div>
        )}
      </div>

      {/* Detalles */}
      <div style={{ background:'#0f172a', border:'1px solid #1e293b', borderRadius:12, padding:'4px 20px', marginBottom:20 }}>
        <InfoRow label="Plan" value={sub.plan ? sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1) : 'Beta'} />
        <InfoRow label="Método de pago" value={sub.paymentMethod} />
        <InfoRow label="Inicio de suscripción" value={fmtDate(sub.startAt)} />
        <InfoRow label="Vencimiento" value={fmtDate(sub.endAt)} />
        {days !== null && (
          <InfoRow
            label="Días restantes"
            value={
              <span style={{ color: days < 0 ? '#f87171' : days <= 7 ? '#fbbf24' : '#4ade80', fontWeight:700 }}>
                {days < 0 ? `Venció hace ${-days} días` : `${days} días`}
              </span>
            }
          />
        )}
        <InfoRow label="Último pago" value={fmtDate(sub.lastPaymentAt)} />
        <InfoRow label="Próximo pago" value={fmtDate(sub.nextPaymentDueAt)} />
        {sub.graceEndsAt && (
          <InfoRow label="Gracia hasta" value={fmtDate(sub.graceEndsAt)} />
        )}
      </div>

      {/* Reporte de pago */}
      <div style={{ background:'#0f172a', border:'1px solid #1e293b', borderRadius:12, padding:20 }}>
        <h3 style={{ margin:'0 0 12px', fontSize:15, color:'#f1f5f9' }}>📤 Reportar un pago</h3>

        {reporteEnviado ? (
          <div style={{
            background:'#14532d22', border:'1px solid #4ade8044',
            borderRadius:8, padding:'16px 20px', textAlign:'center',
          }}>
            <div style={{ fontSize:20, marginBottom:6 }}>✅</div>
            <div style={{ color:'#4ade80', fontWeight:700, marginBottom:4 }}>Reporte enviado correctamente</div>
            <div style={{ fontSize:12, color:'#94a3b8' }}>El administrador revisará tu pago y activará tu cuenta.</div>
          </div>
        ) : mostrarReporte ? (
          <>
            <ReportarPagoForm uid={user?.uid} onExito={onExito} />
            <button
              className="aim-btn aim-btn-ghost"
              style={{ marginTop:10, width:'100%' }}
              onClick={() => setMostrarReporte(false)}
            >
              Cancelar
            </button>
          </>
        ) : (
          <div>
            <p style={{ fontSize:13, color:'#94a3b8', marginBottom:12 }}>
              ¿Ya realizaste un pago? Repórtalo aquí y el administrador activará tu cuenta.
            </p>
            <button className="admin-save-btn" onClick={() => setMostrarReporte(true)}>
              Reportar pago realizado
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
