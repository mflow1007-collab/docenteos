/**
 * SubscriptionBanner — aviso contextual cuando la suscripción requiere atención.
 * Renderiza null cuando el usuario está en estado trial o active.
 */

import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { needsAttention, getStatusMessage } from '../utils/featureGate.js'

export default function SubscriptionBanner() {
  const { suscripcion } = useAuth()
  const [cerrado, setCerrado] = useState(false)

  if (!suscripcion?.status) return null
  if (!needsAttention(suscripcion.status)) return null
  if (cerrado) return null

  const mensaje = getStatusMessage(suscripcion.status, suscripcion.endAt, suscripcion.graceEndsAt)
  if (!mensaje) return null

  const COLORES = {
    pending_payment: { bg: '#78350f22', border: '#f59e0b', icon: '⚠️' },
    grace_period:    { bg: '#7c2d1222', border: '#fb923c', icon: '⏳' },
    suspended:       { bg: '#7f1d1d22', border: '#ef4444', icon: '🔴' },
    cancelled:       { bg: '#1e293b',   border: '#64748b', icon: '🚫' },
  }
  const c = COLORES[suscripcion.status] || COLORES.cancelled

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 16px',
      background: c.bg,
      borderLeft: `3px solid ${c.border}`,
      fontSize: 13,
    }}>
      <span style={{ fontSize: 16 }}>{c.icon}</span>
      <span style={{ flex: 1, color: '#f1f5f9' }}>{mensaje}</span>
      <a
        href="/suscripcion"
        style={{ color: c.border, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', fontSize: 12 }}
      >
        Ver detalles →
      </a>
      <button
        onClick={() => setCerrado(true)}
        style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16, padding: 0 }}
      >
        ✕
      </button>
    </div>
  )
}
