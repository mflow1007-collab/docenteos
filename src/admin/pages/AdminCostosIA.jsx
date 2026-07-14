import { useState, useEffect, useCallback } from 'react';
import { collection, query, orderBy, limit, getDocs, where, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase.js';

// ─── Config de proveedores ────────────────────────────────────────────────────

const PROVEEDORES = {
  anthropic: { nombre: 'Anthropic',  color: '#f97316', logo: '🟠' },
  openai:    { nombre: 'OpenAI',     color: '#10b981', logo: '⬛' },
  abacus:    { nombre: 'Abacus AI',  color: '#6366f1', logo: '🔷' },
  cache:     { nombre: 'Caché',      color: '#64748b', logo: '⚡' },
  unknown:   { nombre: 'Otro',       color: '#94a3b8', logo: '⚙️' },
};

const TARIFAS = {
  'claude-sonnet-5':           { in: 3.0,  out: 15.0 },
  'claude-fable-5':            { in: 0.8,  out: 4.0  },
  'claude-opus-4-8':           { in: 15.0, out: 75.0 },
  'claude-haiku-4-5-20251001': { in: 0.8,  out: 4.0  },
  'claude-sonnet-4-6':         { in: 3.0,  out: 15.0 },
  'gpt-4o':                    { in: 2.5,  out: 10.0 },
  'gpt-4o-mini':               { in: 0.15, out: 0.6  },
  'gpt-4.1':                   { in: 2.0,  out: 8.0  },
  'gpt-5':                     { in: 15.0, out: 60.0 },
  'route-llm':                 { in: 1.0,  out: 3.0  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function usd(n) {
  const v = Number(n) || 0;
  if (v === 0) return '$0.00';
  if (v < 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(2)}`;
}

function dayKey(ts) {
  if (!ts) return '?';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function dayLabel(key) {
  if (!key || key === '?') return '?';
  const [y, m, d] = key.split('-');
  return `${d}/${m}`;
}

function monthStart(offsetMeses = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() - offsetMeses);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
}

// ─── Barra horizontal ─────────────────────────────────────────────────────────

function BarraH({ label, valor, max, color, logo }) {
  const pct = max > 0 ? Math.round((valor / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 13, color: '#334155', fontWeight: 600 }}>{logo} {label}</span>
        <span style={{ fontSize: 14, fontWeight: 800, color }}>{usd(valor)}</span>
      </div>
      <div style={{ background: '#f1f5f9', borderRadius: 6, height: 8, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: 6, transition: 'width 0.4s ease' }} />
      </div>
      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{pct}% del total</div>
    </div>
  );
}

// ─── Gráfico de área diario (SVG) ─────────────────────────────────────────────

function GraficoDiario({ dias, proveedores }) {
  const WIDTH = 600;
  const HEIGHT = 120;
  const PAD = { top: 10, right: 10, bottom: 24, left: 44 };

  const costosPorDia = dias.map((d) =>
    proveedores.reduce((s, p) => s + (d.porProveedor[p] || 0), 0)
  );
  const maxCosto = Math.max(...costosPorDia, 0.001);

  if (dias.length < 2) {
    return <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 24 }}>Necesitas al menos 2 días de datos para mostrar la gráfica.</p>;
  }

  const xStep = (WIDTH - PAD.left - PAD.right) / (dias.length - 1);
  const yScale = (v) => PAD.top + (HEIGHT - PAD.top - PAD.bottom) * (1 - v / maxCosto);

  const puntos = costosPorDia.map((c, i) => ({
    x: PAD.left + i * xStep,
    y: yScale(c),
    costo: c,
    dia: dias[i].dia,
  }));

  const pathD = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L ${puntos[puntos.length - 1].x} ${HEIGHT - PAD.bottom} L ${PAD.left} ${HEIGHT - PAD.bottom} Z`;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
      {/* Líneas guía */}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const y = yScale(maxCosto * f);
        return (
          <g key={f}>
            <line x1={PAD.left} y1={y} x2={WIDTH - PAD.right} y2={y} stroke="#e2e8f0" strokeWidth={0.5} />
            <text x={PAD.left - 4} y={y + 4} fontSize={8} fill="#94a3b8" textAnchor="end">
              {usd(maxCosto * f)}
            </text>
          </g>
        );
      })}

      {/* Área rellena */}
      <path d={areaD} fill="#2563eb18" />
      {/* Línea principal */}
      <path d={pathD} fill="none" stroke="#2563eb" strokeWidth={2} strokeLinejoin="round" />

      {/* Puntos */}
      {puntos.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3} fill="#2563eb" />
          {/* Etiqueta de fecha cada N días */}
          {(i === 0 || i === puntos.length - 1 || i % Math.ceil(puntos.length / 6) === 0) && (
            <text x={p.x} y={HEIGHT - PAD.bottom + 12} fontSize={8} fill="#94a3b8" textAnchor="middle">
              {dayLabel(p.dia)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

const RANGOS = [
  { value: 'mes-actual',   label: 'Este mes' },
  { value: 'mes-anterior', label: 'Mes anterior' },
  { value: '30-dias',      label: 'Últimos 30 días' },
  { value: '90-dias',      label: 'Últimos 90 días' },
];

export default function AdminCostosIA() {
  const [datos, setDatos]     = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError]     = useState('');
  const [rango, setRango]     = useState('mes-actual');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      let desde;
      const ahora = new Date();

      if (rango === 'mes-actual') {
        desde = monthStart(0);
      } else if (rango === 'mes-anterior') {
        desde = monthStart(1);
      } else if (rango === '30-dias') {
        const d = new Date(ahora);
        d.setDate(d.getDate() - 30);
        d.setHours(0, 0, 0, 0);
        desde = Timestamp.fromDate(d);
      } else {
        const d = new Date(ahora);
        d.setDate(d.getDate() - 90);
        d.setHours(0, 0, 0, 0);
        desde = Timestamp.fromDate(d);
      }

      const q = query(
        collection(db, 'aiLogs'),
        where('fecha', '>=', desde),
        orderBy('fecha', 'asc'),
        limit(5000),
      );
      const snap = await getDocs(q);
      const logs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // ── Agregar por proveedor ──────────────────────────────────────────────
      const porProveedor = {};
      for (const log of logs) {
        const prov  = log.proveedor || 'unknown';
        const costo = parseFloat(log.costoEstimado) || 0;
        const tok   = (log.tokensEntrada || 0) + (log.tokensSalida || 0);
        if (!porProveedor[prov]) porProveedor[prov] = { costo: 0, tokens: 0, llamadas: 0, errores: 0 };
        porProveedor[prov].costo    += costo;
        porProveedor[prov].tokens   += tok;
        porProveedor[prov].llamadas++;
        if (log.error) porProveedor[prov].errores++;
      }

      // ── Agregar por modelo ────────────────────────────────────────────────
      const porModelo = {};
      for (const log of logs) {
        if (log.cache) continue;
        const mod   = log.modelo || 'unknown';
        const costo = parseFloat(log.costoEstimado) || 0;
        const tok   = (log.tokensEntrada || 0) + (log.tokensSalida || 0);
        if (!porModelo[mod]) porModelo[mod] = { costo: 0, tokens: 0, llamadas: 0 };
        porModelo[mod].costo    += costo;
        porModelo[mod].tokens   += tok;
        porModelo[mod].llamadas++;
      }

      // ── Agregar por día ───────────────────────────────────────────────────
      const porDiaMap = {};
      for (const log of logs) {
        const dia   = dayKey(log.fecha);
        const prov  = log.proveedor || 'unknown';
        const costo = parseFloat(log.costoEstimado) || 0;
        if (!porDiaMap[dia]) porDiaMap[dia] = { dia, porProveedor: {}, total: 0 };
        porDiaMap[dia].porProveedor[prov] = (porDiaMap[dia].porProveedor[prov] || 0) + costo;
        porDiaMap[dia].total += costo;
      }
      const porDia = Object.values(porDiaMap).sort((a, b) => a.dia.localeCompare(b.dia));

      // ── Totales globales ──────────────────────────────────────────────────
      const costoTotal  = logs.reduce((s, l) => s + (parseFloat(l.costoEstimado) || 0), 0);
      const tokensTotal = logs.reduce((s, l) => s + (l.tokensEntrada || 0) + (l.tokensSalida || 0), 0);
      const llamadas    = logs.filter((l) => !l.cache).length;
      const desdeCache  = logs.filter((l) => l.cache).length;

      // Proyección al mes (basado en días transcurridos)
      const diasTranscurridos = porDia.length || 1;
      const costoPorDia       = costoTotal / diasTranscurridos;
      const proyeccion30      = costoPorDia * 30;

      setDatos({
        porProveedor,
        porModelo,
        porDia,
        costoTotal,
        tokensTotal,
        llamadas,
        desdeCache,
        proyeccion30,
        totalLogs: logs.length,
      });
    } catch (e) {
      setError('Error cargando logs: ' + (e.message || e));
    } finally {
      setCargando(false);
    }
  }, [rango]);

  useEffect(() => { cargar(); }, [cargar]);

  // Siempre mostrar los 3 proveedores principales aunque tengan $0
  const PROVS_PRINCIPALES = ['anthropic', 'openai', 'abacus'];
  const proveedoresActivos = datos
    ? PROVS_PRINCIPALES.map((p) => [
        p,
        datos.porProveedor[p] || { costo: 0, tokens: 0, llamadas: 0, errores: 0 },
      ])
    : [];

  const maxCostoProv = proveedoresActivos[0]?.[1].costo || 1;

  const modelosTop = datos
    ? Object.entries(datos.porModelo).sort((a, b) => b[1].costo - a[1].costo)
    : [];

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h2>Costos de IA</h2>
          <p>Cuánto estás pagando por proveedor, por modelo y por día — en dólares reales.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            value={rango}
            onChange={(e) => setRango(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
          >
            {RANGOS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button className="admin-btn" onClick={cargar} disabled={cargando}>
            {cargando ? 'Cargando…' : '↺ Actualizar'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', color: '#dc2626', marginBottom: 16, fontSize: 14 }}>
          ⚠️ {error}
        </div>
      )}

      {cargando ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>💰</div>
          <p>Calculando costos…</p>
        </div>
      ) : !datos ? null : (
        <>
          {/* KPIs principales */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
            {[
              { label: 'Costo total del período', valor: usd(datos.costoTotal),     color: '#d97706', grande: true },
              { label: 'Proyección 30 días',       valor: usd(datos.proyeccion30),   color: '#2563eb' },
              { label: 'Tokens consumidos',         valor: `${(datos.tokensTotal / 1000).toFixed(1)}k`, color: '#7c3aed' },
              { label: 'Llamadas reales / caché',   valor: `${datos.llamadas} / ${datos.desdeCache}`,   color: '#059669' },
            ].map(({ label, valor, color, grande }) => (
              <div key={label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 18px', borderTop: `3px solid ${color}` }}>
                <div style={{ fontSize: grande ? 28 : 22, fontWeight: 800, color, lineHeight: 1 }}>{valor}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>{label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

            {/* Costo por proveedor */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 24px' }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
                💰 Gasto por proveedor
              </h3>
              {proveedoresActivos.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: 13 }}>Sin datos de proveedores en este período.</p>
              ) : (
                proveedoresActivos.map(([prov, data]) => {
                  const meta = PROVEEDORES[prov] || PROVEEDORES.unknown;
                  return (
                    <BarraH
                      key={prov}
                      label={meta.nombre}
                      logo={meta.logo}
                      valor={data.costo}
                      max={maxCostoProv}
                      color={meta.color}
                    />
                  );
                })
              )}

              {/* Caché separado */}
              {datos.porProveedor['cache'] && (
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 14, marginTop: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#64748b' }}>
                    <span>⚡ Respuestas desde caché</span>
                    <strong style={{ color: '#059669' }}>$0.00 (ahorro)</strong>
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                    {datos.porProveedor['cache'].llamadas} llamadas evitadas ≈ {usd(datos.porProveedor['cache'].llamadas * 0.006)} ahorrados
                  </div>
                </div>
              )}
            </div>

            {/* Costo por modelo */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 24px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
                🤖 Gasto por modelo
              </h3>
              {modelosTop.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: 13 }}>Sin datos.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                      <th style={{ textAlign: 'left', padding: '4px 0', color: '#64748b', fontWeight: 600 }}>Modelo</th>
                      <th style={{ textAlign: 'right', padding: '4px 0', color: '#64748b', fontWeight: 600 }}>Llamadas</th>
                      <th style={{ textAlign: 'right', padding: '4px 0', color: '#64748b', fontWeight: 600 }}>Tokens</th>
                      <th style={{ textAlign: 'right', padding: '4px 0', color: '#64748b', fontWeight: 600 }}>Costo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modelosTop.map(([modelo, data]) => (
                      <tr key={modelo} style={{ borderBottom: '1px solid #f8fafc' }}>
                        <td style={{ padding: '7px 0' }}>
                          <code style={{ fontSize: 11, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>{modelo}</code>
                        </td>
                        <td style={{ textAlign: 'right', padding: '7px 0', color: '#64748b' }}>{data.llamadas}</td>
                        <td style={{ textAlign: 'right', padding: '7px 0', color: '#64748b' }}>{(data.tokens / 1000).toFixed(1)}k</td>
                        <td style={{ textAlign: 'right', padding: '7px 0', fontWeight: 700, color: '#d97706' }}>{usd(data.costo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Gráfico diario */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1e293b' }}>📈 Gasto diario</h3>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>{datos.porDia.length} días con actividad</span>
            </div>
            <GraficoDiario dias={datos.porDia} proveedores={Object.keys(datos.porProveedor)} />
          </div>

          {/* Desglose diario — tabla */}
          {datos.porDia.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 24px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
                📅 Desglose día a día
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                      <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748b', fontWeight: 600 }}>Fecha</th>
                      {PROVS_PRINCIPALES.map((p) => (
                        <th key={p} style={{ textAlign: 'right', padding: '6px 8px', color: PROVEEDORES[p]?.color || '#64748b', fontWeight: 600 }}>
                          {PROVEEDORES[p]?.logo} {PROVEEDORES[p]?.nombre || p}
                        </th>
                      ))}
                      <th style={{ textAlign: 'right', padding: '6px 8px', color: '#1e293b', fontWeight: 700 }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...datos.porDia].reverse().map((dia) => (
                      <tr key={dia.dia} style={{ borderBottom: '1px solid #f8fafc' }}>
                        <td style={{ padding: '7px 8px', color: '#334155', fontWeight: 500 }}>
                          {dia.dia}
                        </td>
                        {PROVS_PRINCIPALES.map((p) => (
                          <td key={p} style={{ textAlign: 'right', padding: '7px 8px', color: dia.porProveedor[p] > 0 ? '#d97706' : '#cbd5e1' }}>
                            {dia.porProveedor[p] > 0 ? usd(dia.porProveedor[p]) : '—'}
                          </td>
                        ))}
                        <td style={{ textAlign: 'right', padding: '7px 8px', fontWeight: 700, color: '#1e293b' }}>
                          {usd(dia.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Total fila */}
                  <tfoot>
                    <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f8fafc' }}>
                      <td style={{ padding: '8px', fontWeight: 700, color: '#1e293b' }}>TOTAL</td>
                      {PROVS_PRINCIPALES.map((p) => (
                        <td key={p} style={{ textAlign: 'right', padding: '8px', fontWeight: 700, color: PROVEEDORES[p]?.color || '#64748b' }}>
                          {datos.porProveedor[p] ? usd(datos.porProveedor[p].costo) : '$0.00'}
                        </td>
                      ))}
                      <td style={{ textAlign: 'right', padding: '8px', fontWeight: 800, color: '#d97706', fontSize: 15 }}>
                        {usd(datos.costoTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Tarifas de referencia */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px 24px', marginTop: 20 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#64748b' }}>
              📋 Tarifas de referencia (por 1M tokens)
            </h3>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {Object.entries(TARIFAS).map(([modelo, rates]) => (
                <div key={modelo} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                  <code style={{ display: 'block', fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>{modelo}</code>
                  <span style={{ color: '#059669' }}>In: ${rates.in}</span>
                  <span style={{ color: '#94a3b8', margin: '0 6px' }}>·</span>
                  <span style={{ color: '#d97706' }}>Out: ${rates.out}</span>
                </div>
              ))}
            </div>
          </div>

          <p style={{ color: '#94a3b8', fontSize: 12, textAlign: 'right', marginTop: 12 }}>
            Basado en {datos.totalLogs} registros de <code>aiLogs</code> · Costos calculados con tarifas estimadas
          </p>
        </>
      )}
    </div>
  );
}
