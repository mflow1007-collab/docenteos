import { useCallback, useEffect, useRef, useState } from 'react'
import { collection, query, orderBy, limit, getDocs, startAfter } from 'firebase/firestore'
import { db } from '../../firebase.js'

const PAGE_SIZE = 50

const COLORES_PROV = {
  anthropic: { bg: '#fff7ed', color: '#f97316' },
  openai:    { bg: '#f0fdf4', color: '#059669' },
  abacus:    { bg: '#eff6ff', color: '#2563eb' },
  cache:     { bg: '#f1f5f9', color: '#64748b' },
  unknown:   { bg: '#f8fafc', color: '#94a3b8' },
}

function fmt(ts) {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' })
}

function usd(v) {
  const n = parseFloat(v) || 0
  return n > 0 ? `$${n.toFixed(4)}` : '$0'
}

export default function AdminHistorialIA() {
  const [registros,  setRegistros]  = useState([])
  const [cargando,   setCargando]   = useState(true)
  const [hayMas,     setHayMas]     = useState(false)
  const [busqueda,   setBusqueda]   = useState('')
  const [filtroMod,  setFiltroMod]  = useState('todos')
  const [filtroProv, setFiltroProv] = useState('todos')
  const [error,      setError]      = useState('')

  const lastDocRef = useRef(null)

  const cargar = useCallback(async (siguiente = false) => {
    if (!siguiente) { setCargando(true); setError('') }
    try {
      const col = collection(db, 'aiLogs')
      const q = siguiente && lastDocRef.current
        ? query(col, orderBy('fecha', 'desc'), startAfter(lastDocRef.current), limit(PAGE_SIZE))
        : query(col, orderBy('fecha', 'desc'), limit(PAGE_SIZE))

      const snap = await getDocs(q)
      const nuevos = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      setRegistros((prev) => siguiente ? [...prev, ...nuevos] : nuevos)
      lastDocRef.current = snap.docs[snap.docs.length - 1] ?? null
      setHayMas(snap.docs.length === PAGE_SIZE)
    } catch (err) {
      setError('Error al cargar: ' + (err.message || err))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const modulos   = ['todos', ...new Set(registros.map((r) => r.modulo).filter(Boolean))].sort()
  const proveedores = ['todos', ...new Set(registros.map((r) => r.proveedor).filter(Boolean))].sort()

  const filtrados = registros.filter((r) => {
    if (filtroProv !== 'todos' && r.proveedor !== filtroProv) return false
    if (filtroMod  !== 'todos' && r.modulo    !== filtroMod)  return false
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      return (
        (r.uid      || '').toLowerCase().includes(q) ||
        (r.modulo   || '').toLowerCase().includes(q) ||
        (r.modelo   || '').toLowerCase().includes(q) ||
        (r.proveedor|| '').toLowerCase().includes(q)
      )
    }
    return true
  })

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div className="admin-page-header-text">
          <h2>Historial de IA</h2>
          <p>Todas las llamadas al AI Gateway — proveedor, modelo, tokens y costo por llamada.</p>
        </div>
        <button className="admin-btn admin-btn-secondary" onClick={() => { lastDocRef.current = null; cargar(false) }}>
          ↻ Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="admin-toolbar" style={{ flexWrap: 'wrap', gap: 8 }}>
        <input
          className="admin-search"
          placeholder="Buscar por UID, módulo o modelo…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <select
          value={filtroProv}
          onChange={(e) => setFiltroProv(e.target.value)}
          style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
        >
          {proveedores.map((p) => <option key={p} value={p}>{p === 'todos' ? 'Todos los proveedores' : p}</option>)}
        </select>
        <select
          value={filtroMod}
          onChange={(e) => setFiltroMod(e.target.value)}
          style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
        >
          {modulos.map((m) => <option key={m} value={m}>{m === 'todos' ? 'Todos los módulos' : m}</option>)}
        </select>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', color: '#dc2626', margin: '0 0 16px', fontSize: 14 }}>
          ⚠️ {error}
        </div>
      )}

      {cargando ? (
        <div className="admin-loading"><div className="admin-spinner" />Cargando historial…</div>
      ) : filtrados.length === 0 ? (
        <div className="admin-empty">
          <span className="admin-empty-icon">🕒</span>
          <h3>Sin registros</h3>
          <p>Las llamadas al AI Gateway se registran aquí automáticamente en <code>aiLogs</code>.</p>
        </div>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Proveedor</th>
                  <th>Modelo</th>
                  <th>Módulo</th>
                  <th style={{ textAlign: 'right' }}>Tokens</th>
                  <th style={{ textAlign: 'right' }}>Costo</th>
                  <th style={{ textAlign: 'right' }}>Tiempo</th>
                  <th>Cache</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((r) => {
                  const cp = COLORES_PROV[r.proveedor] || COLORES_PROV.unknown
                  const tokens = (r.tokensEntrada || 0) + (r.tokensSalida || 0)
                  const esError = !!r.error
                  const esCache = !!r.cache
                  return (
                    <tr key={r.id} style={esError ? { background: '#fef2f2' } : {}}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{fmt(r.fecha)}</td>
                      <td>
                        <span style={{ background: cp.bg, color: cp.color, borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>
                          {r.proveedor || '—'}
                        </span>
                      </td>
                      <td><code style={{ fontSize: 11 }}>{r.modelo || '—'}</code></td>
                      <td><span className="admin-tag">{r.modulo || '—'}</span></td>
                      <td style={{ textAlign: 'right', fontSize: 13 }}>
                        {tokens > 0 ? tokens.toLocaleString() : '—'}
                        {r.tokensEntrada > 0 && (
                          <div style={{ fontSize: 10, color: '#94a3b8' }}>
                            {r.tokensEntrada}↑ {r.tokensSalida || 0}↓
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: esCache ? '#94a3b8' : '#d97706', fontSize: 13 }}>
                        {esCache ? '—' : usd(r.costoEstimado)}
                      </td>
                      <td style={{ textAlign: 'right', fontSize: 12, color: '#64748b' }}>
                        {r.tiempoRespuesta ? `${(r.tiempoRespuesta / 1000).toFixed(1)}s` : '—'}
                      </td>
                      <td>
                        {esCache && <span style={{ background: '#f0fdf4', color: '#059669', borderRadius: 6, padding: '2px 7px', fontSize: 11, fontWeight: 700 }}>⚡ Cache</span>}
                      </td>
                      <td>
                        {esError
                          ? <span style={{ background: '#fef2f2', color: '#dc2626', borderRadius: 6, padding: '2px 7px', fontSize: 11, fontWeight: 700 }}>✗ Error</span>
                          : <span style={{ background: '#f0fdf4', color: '#059669', borderRadius: 6, padding: '2px 7px', fontSize: 11, fontWeight: 700 }}>✓ OK</span>
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>
              {filtrados.length} registros mostrados · fuente: <code>aiLogs</code>
            </p>
            {hayMas && (
              <button className="admin-btn admin-btn-secondary" onClick={() => cargar(true)}>
                Cargar más
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
