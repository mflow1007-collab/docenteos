import { useState, useEffect, useCallback } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../firebase.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ETIQUETAS = {
  planificacion_aceptada:       'Planificación aceptada',
  planificacion_regenerada:     'Planificación regenerada',
  actividad_modificada:         'Actividad modificada',
  auditoria_aplicada:           'Auditoría aplicada',
  mejora_aceptada:              'Mejora aceptada',
  plantilla_usada:              'Plantilla usada',
  instrumento_aceptado:         'Instrumento aceptado',
  apoyo_generado:               'Apoyo generado',
  chat_consultado:              'Chat consultado',
  apoyo_curso_generado:         'Apoyo de curso',
  informe_estudiante_generado:  'Informe generado',
  ia_recomendacion_generada:    'Recomendación IA',
};

const COLORES = [
  '#2563eb', '#7c3aed', '#059669', '#d97706',
  '#dc2626', '#0891b2', '#be185d', '#65a30d',
];

function contarPor(eventos, campo) {
  const mapa = {};
  for (const e of eventos) {
    const val = e[campo];
    if (!val) continue;
    mapa[val] = (mapa[val] || 0) + 1;
  }
  return Object.entries(mapa)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
}

function formatTs(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function barWidth(valor, max) {
  return max > 0 ? Math.round((valor / max) * 100) : 0;
}

// ─── Componente de barra ──────────────────────────────────────────────────────

function BarraRanking({ label, valor, max, color = '#2563eb', total }) {
  const pct = barWidth(valor, max);
  const porcentaje = total > 0 ? Math.round((valor / total) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
        <span style={{ color: '#334155', fontWeight: 500, maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ color: '#64748b', fontWeight: 700 }}>{valor} <small style={{ fontWeight: 400 }}>({porcentaje}%)</small></span>
      </div>
      <div style={{ background: '#f1f5f9', borderRadius: 6, height: 8, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, background: color, borderRadius: 6, height: '100%', transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

// ─── Tarjeta de KPI ───────────────────────────────────────────────────────────

function KPI({ label, valor, sub, color = '#2563eb' }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
      padding: '18px 20px', borderTop: `4px solid ${color}`,
    }}>
      <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{valor}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginTop: 6 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ─── Panel colapsable ─────────────────────────────────────────────────────────

function Panel({ titulo, children }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 24px', marginBottom: 20 }}>
      <h3 style={{ margin: '0 0 18px', fontSize: 15, fontWeight: 700, color: '#1e293b' }}>{titulo}</h3>
      {children}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AdminEstadisticas() {
  const [eventos, setEventos]   = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError]       = useState('');
  const [rango, setRango]       = useState(500);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const q = query(collection(db, 'le_eventos'), orderBy('timestamp', 'desc'), limit(rango));
      const snap = await getDocs(q);
      setEventos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      setError('Error cargando eventos: ' + (e.message || e));
    } finally {
      setCargando(false);
    }
  }, [rango]);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Agregaciones ─────────────────────────────────────────────────────────────

  const total = eventos.length;

  const porTipo    = contarPor(eventos, 'tipo');
  const porArea    = contarPor(eventos, 'area');
  const porGrado   = contarPor(eventos, 'grado');
  const porTema    = contarPor(eventos, 'tema');
  const porAgente  = contarPor(eventos, 'agentId');

  const planificaciones = eventos.filter((e) =>
    e.tipo === 'planificacion_aceptada' || e.tipo === 'planificacion_regenerada'
  ).length;
  const instrumentos = eventos.filter((e) => e.tipo === 'instrumento_aceptado').length;
  const chats        = eventos.filter((e) => e.tipo === 'chat_consultado').length;
  const mejoras      = eventos.filter((e) => e.tipo === 'mejora_aceptada').length;

  // Días activos únicos
  const diasActivos = new Set(
    eventos.map((e) => {
      const ts = e.timestamp?.toDate ? e.timestamp.toDate() : new Date(e.timestamp || 0);
      return ts.toDateString();
    })
  ).size;

  // Usuarios únicos
  const usuariosUnicos = new Set(eventos.map((e) => e.userId).filter(Boolean)).size;

  // Fecha del primer evento
  const primerEvento = eventos.length > 0 ? eventos[eventos.length - 1] : null;
  const fechaInicio  = primerEvento ? formatTs(primerEvento.timestamp) : '—';

  const maxTipo   = porTipo[0]?.[1]  || 1;
  const maxArea   = porArea[0]?.[1]  || 1;
  const maxGrado  = porGrado[0]?.[1] || 1;
  const maxTema   = porTema[0]?.[1]  || 1;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h2>Estadísticas de Uso</h2>
          <p>Análisis de los últimos <strong>{rango}</strong> eventos registrados en <code>le_eventos</code> — desde {fechaInicio}.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select
            value={rango}
            onChange={(e) => setRango(Number(e.target.value))}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
          >
            <option value={100}>Últimos 100</option>
            <option value={300}>Últimos 300</option>
            <option value={500}>Últimos 500</option>
            <option value={1000}>Últimos 1000</option>
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
        <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>Calculando estadísticas…</div>
      ) : total === 0 ? (
        <div className="admin-placeholder">
          <span className="admin-placeholder-icon">📊</span>
          <h3>Sin eventos registrados</h3>
          <p>Los eventos aparecen aquí cuando los docentes usan la plataforma.</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
            <KPI label="Total eventos" valor={total} sub={`${diasActivos} días activos`} color="#2563eb" />
            <KPI label="Usuarios únicos" valor={usuariosUnicos} sub="con actividad registrada" color="#7c3aed" />
            <KPI label="Planificaciones" valor={planificaciones} sub="generadas y aceptadas" color="#059669" />
            <KPI label="Instrumentos" valor={instrumentos} sub="creados" color="#d97706" />
            <KPI label="Consultas IA" valor={chats} sub="en el laboratorio" color="#0891b2" />
            <KPI label="Mejoras aceptadas" valor={mejoras} sub="correcciones validadas" color="#be185d" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

            {/* Actividad por tipo */}
            <Panel titulo="⚡ Actividad por tipo de evento">
              {porTipo.map(([tipo, n], i) => (
                <BarraRanking
                  key={tipo}
                  label={ETIQUETAS[tipo] || tipo}
                  valor={n}
                  max={maxTipo}
                  total={total}
                  color={COLORES[i % COLORES.length]}
                />
              ))}
            </Panel>

            {/* Áreas más usadas */}
            <Panel titulo="📚 Áreas curriculares más activas">
              {porArea.length > 0 ? (
                porArea.map(([area, n], i) => (
                  <BarraRanking
                    key={area}
                    label={area}
                    valor={n}
                    max={maxArea}
                    total={total}
                    color={COLORES[i % COLORES.length]}
                  />
                ))
              ) : (
                <p style={{ color: '#94a3b8', fontSize: 13 }}>Sin datos de área en los eventos.</p>
              )}
            </Panel>

            {/* Grados más activos */}
            <Panel titulo="🎓 Grados con más actividad">
              {porGrado.length > 0 ? (
                porGrado.map(([grado, n], i) => (
                  <BarraRanking
                    key={grado}
                    label={grado}
                    valor={n}
                    max={maxGrado}
                    total={total}
                    color={COLORES[i % COLORES.length]}
                  />
                ))
              ) : (
                <p style={{ color: '#94a3b8', fontSize: 13 }}>Sin datos de grado en los eventos.</p>
              )}
            </Panel>

            {/* Temas más consultados */}
            <Panel titulo="🔍 Temas más consultados">
              {porTema.length > 0 ? (
                porTema.map(([tema, n], i) => (
                  <BarraRanking
                    key={tema}
                    label={tema}
                    valor={n}
                    max={maxTema}
                    total={total}
                    color={COLORES[i % COLORES.length]}
                  />
                ))
              ) : (
                <p style={{ color: '#94a3b8', fontSize: 13 }}>Sin datos de tema en los eventos.</p>
              )}
            </Panel>

            {/* Agentes más usados */}
            {porAgente.length > 0 && (
              <Panel titulo="🤖 Agentes IA más utilizados">
                {porAgente.map(([agente, n], i) => (
                  <BarraRanking
                    key={agente}
                    label={agente}
                    valor={n}
                    max={porAgente[0]?.[1] || 1}
                    total={total}
                    color={COLORES[i % COLORES.length]}
                  />
                ))}
              </Panel>
            )}

            {/* Resumen rápido */}
            <Panel titulo="📋 Resumen del período">
              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                <tbody>
                  {[
                    ['Total de eventos analizados', total],
                    ['Usuarios únicos activos', usuariosUnicos],
                    ['Días con actividad', diasActivos],
                    ['Promedio eventos/día activo', diasActivos > 0 ? Math.round(total / diasActivos) : '—'],
                    ['Evento más frecuente', ETIQUETAS[porTipo[0]?.[0]] || porTipo[0]?.[0] || '—'],
                    ['Área más activa', porArea[0]?.[0] || '—'],
                    ['Grado más activo', porGrado[0]?.[0] || '—'],
                    ['Tema más consultado', porTema[0]?.[0] ? `"${porTema[0][0]}"` : '—'],
                  ].map(([k, v]) => (
                    <tr key={k} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '7px 0', color: '#64748b' }}>{k}</td>
                      <td style={{ padding: '7px 0', fontWeight: 700, color: '#1e293b', textAlign: 'right' }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>

          </div>

          <p style={{ color: '#94a3b8', fontSize: 12, textAlign: 'right', marginTop: 8 }}>
            Mostrando {total} eventos más recientes de <code>le_eventos</code>
          </p>
        </>
      )}
    </div>
  );
}
