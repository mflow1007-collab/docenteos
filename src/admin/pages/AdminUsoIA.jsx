import { useState, useEffect, useCallback } from 'react';
import {
  collection, query, orderBy, limit, getDocs, doc, getDoc,
} from 'firebase/firestore';
import { db } from '../../firebase.js';

// ─── Mapeo de módulos a etiquetas legibles ────────────────────────────────────

const MODULOS = {
  planificacion:          { label: 'Planificación',    icono: '📝', grupo: 'docencia' },
  'planificacion-ia':     { label: 'Planificación IA', icono: '🪄', grupo: 'docencia' },
  instrumentos:           { label: 'Instrumentos',     icono: '📋', grupo: 'docencia' },
  registro:               { label: 'Registro',         icono: '📓', grupo: 'docencia' },
  'registro-apoyo':       { label: 'Apoyo NEAE',       icono: '🤝', grupo: 'docencia' },
  reportes:               { label: 'Reportes',         icono: '📊', grupo: 'docencia' },
  chat:                   { label: 'Chat IA',          icono: '💬', grupo: 'docencia' },
  'centro-ia':            { label: 'Centro IA',        icono: '🧠', grupo: 'docencia' },
  'auditoria-ia':         { label: 'Auditoría IA',     icono: '🔍', grupo: 'docencia' },
  auditoria:              { label: 'Auditoría',        icono: '🔍', grupo: 'docencia' },
  'style-extractor':      { label: 'Estilo IA',        icono: '🎨', grupo: 'docencia' },
  'style-replicar':       { label: 'Replicar estilo',  icono: '🎨', grupo: 'docencia' },
  'style-combinar':       { label: 'Combinar estilos', icono: '🎨', grupo: 'docencia' },
  curriculo:              { label: 'Currículo',        icono: '📚', grupo: 'docencia' },
  'chat-personal':        { label: 'Asist. Personal',  icono: '🤖', grupo: 'personal' },
  cache:                  { label: 'Cache',            icono: '⚡', grupo: 'sistema' },
  unknown:                { label: 'Otro',             icono: '⚙️', grupo: 'sistema' },
};

function metaModulo(mod) {
  return MODULOS[mod] || { label: mod, icono: '⚙️', grupo: 'sistema' };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCosto(v) {
  const n = parseFloat(v) || 0;
  if (n < 0.001) return '<$0.001';
  return `$${n.toFixed(3)}`;
}

function formatTs(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function nivelUso(tokens) {
  if (tokens > 200_000) return { label: 'Muy alto', color: '#7c3aed', bg: '#faf5ff' };
  if (tokens >  80_000) return { label: 'Alto',     color: '#2563eb', bg: '#eff6ff' };
  if (tokens >  20_000) return { label: 'Medio',    color: '#059669', bg: '#dcfce7' };
  if (tokens >   2_000) return { label: 'Bajo',     color: '#d97706', bg: '#fef9c3' };
  return                       { label: 'Mínimo',   color: '#94a3b8', bg: '#f1f5f9' };
}

// ─── Tarjeta de docente ───────────────────────────────────────────────────────

function DocenteCard({ docente }) {
  const [expandido, setExpandido] = useState(false);
  const nivel = nivelUso(docente.tokensTotal);

  // Módulos de docencia ordenados por tokens (excluir personal y sistema)
  const modulosDocencia = Object.entries(docente.porModulo)
    .filter(([mod]) => metaModulo(mod).grupo === 'docencia')
    .sort((a, b) => b[1].tokens - a[1].tokens);

  const moduloTop = modulosDocencia[0];

  return (
    <div style={{
      border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px 20px',
      marginBottom: 10, background: '#fff',
      borderLeft: `4px solid ${nivel.color}`,
    }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>

        {/* Rango visual */}
        <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 48 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 999,
            background: nivel.bg, color: nivel.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 800, border: `2px solid ${nivel.color}`,
          }}>
            #{docente.rango}
          </div>
          <div style={{ fontSize: 10, color: nivel.color, fontWeight: 700, marginTop: 3 }}>
            {nivel.label}
          </div>
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: '#1e293b' }}>
                {docente.nombre || 'Sin nombre'}
              </p>
              <p style={{ margin: '1px 0 0', fontSize: 12, color: '#64748b' }}>{docente.email || '—'}</p>
            </div>
            {/* Costo total */}
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: nivel.color, lineHeight: 1 }}>
                {formatCosto(docente.costoTotal)}
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>{docente.tokensTotal.toLocaleString()} tokens</div>
            </div>
          </div>

          {/* Stats rápidas */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
            {[
              { label: 'Llamadas IA',   valor: docente.llamadas },
              { label: 'Desde caché',   valor: docente.desdeCache },
              { label: 'Módulo top',    valor: moduloTop ? `${metaModulo(moduloTop[0]).icono} ${metaModulo(moduloTop[0]).label}` : '—' },
              { label: 'Último uso',    valor: formatTs(docente.ultimaFecha) },
            ].map(({ label, valor }) => (
              <div key={label} style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{valor}</div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Chips de módulos usados */}
          {modulosDocencia.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {modulosDocencia.slice(0, 6).map(([mod, data]) => {
                const meta = metaModulo(mod);
                return (
                  <span key={mod} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    background: '#f8fafc', border: '1px solid #e2e8f0',
                    borderRadius: 8, padding: '3px 9px', fontSize: 12,
                  }}>
                    {meta.icono} <strong>{data.llamadas}</strong>
                    <span style={{ color: '#64748b' }}>{meta.label}</span>
                    <span style={{ color: '#94a3b8', fontSize: 10 }}>({(data.tokens / 1000).toFixed(1)}k)</span>
                  </span>
                );
              })}
              {modulosDocencia.length > 6 && (
                <span style={{ fontSize: 12, color: '#94a3b8', padding: '3px 6px' }}>
                  +{modulosDocencia.length - 6} más
                </span>
              )}
            </div>
          )}
        </div>

        {/* Expandir */}
        {modulosDocencia.length > 0 && (
          <button
            onClick={() => setExpandido(!expandido)}
            style={{
              background: 'none', border: '1px solid #e2e8f0', borderRadius: 8,
              padding: '4px 10px', fontSize: 11, color: '#64748b', cursor: 'pointer', flexShrink: 0,
            }}
          >
            {expandido ? '▲' : '▼ Detalle'}
          </button>
        )}
      </div>

      {/* Detalle expandido */}
      {expandido && (
        <div style={{ marginTop: 14, borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
          <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: '#64748b' }}>
            Uso por módulo — todos los tiempos
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
            {modulosDocencia.map(([mod, data]) => {
              const meta = metaModulo(mod);
              const pctTokens = docente.tokensTotal > 0 ? Math.round((data.tokens / docente.tokensTotal) * 100) : 0;
              return (
                <div key={mod} style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{meta.icono} {meta.label}</span>
                    <span style={{ fontSize: 11, color: '#64748b' }}>{pctTokens}%</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
                    {data.llamadas} llamadas · {(data.tokens / 1000).toFixed(1)}k tokens · {formatCosto(data.costo)}
                  </div>
                  <div style={{ background: '#e2e8f0', borderRadius: 999, height: 4 }}>
                    <div style={{ width: `${pctTokens}%`, background: nivel.color, height: '100%', borderRadius: 999 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

const RANGOS_LOG = [
  { value: 500,  label: 'Últimos 500 logs' },
  { value: 1000, label: 'Últimos 1000 logs' },
  { value: 2000, label: 'Últimos 2000 logs' },
  { value: 5000, label: 'Últimos 5000 logs' },
];

const ORDENAR = [
  { value: 'costo',    label: '💰 Mayor costo' },
  { value: 'tokens',   label: '⚡ Más tokens' },
  { value: 'llamadas', label: '📞 Más llamadas' },
  { value: 'nombre',   label: '🔤 Nombre A→Z' },
];

export default function AdminUsoIA() {
  const [docentes, setDocentes]   = useState([]);
  const [cargando, setCargando]   = useState(true);
  const [error, setError]         = useState('');
  const [rangoLogs, setRangoLogs] = useState(1000);
  const [busqueda, setBusqueda]   = useState('');
  const [ordenar, setOrdenar]     = useState('costo');
  const [soloDocencia, setSoloDocencia] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      // 1. Leer aiLogs ordenados por fecha desc
      const q = query(
        collection(db, 'aiLogs'),
        orderBy('fecha', 'desc'),
        limit(rangoLogs),
      );
      const snap = await getDocs(q);
      const logs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // 2. Agrupar por uid
      const porUid = {};
      for (const log of logs) {
        const uid = log.uid;
        if (!uid) continue;
        if (!porUid[uid]) {
          porUid[uid] = {
            uid,
            llamadas:     0,
            desdeCache:   0,
            tokensTotal:  0,
            costoTotal:   0,
            ultimaFecha:  null,
            porModulo:    {},
          };
        }
        const u = porUid[uid];
        u.llamadas++;
        if (log.cache) u.desdeCache++;
        const tokens = (log.tokensEntrada || 0) + (log.tokensSalida || 0);
        const costo  = parseFloat(log.costoEstimado) || 0;
        u.tokensTotal += tokens;
        u.costoTotal  += costo;
        if (!u.ultimaFecha && log.fecha) u.ultimaFecha = log.fecha;

        const mod = log.modulo || 'unknown';
        if (!u.porModulo[mod]) u.porModulo[mod] = { llamadas: 0, tokens: 0, costo: 0 };
        u.porModulo[mod].llamadas++;
        u.porModulo[mod].tokens += tokens;
        u.porModulo[mod].costo  += costo;
      }

      // 3. Cargar nombres de usuarios
      const uids     = Object.keys(porUid);
      const nombrePorUid = {};
      await Promise.all(
        uids.map(async (uid) => {
          try {
            const snap = await getDoc(doc(db, 'usuarios', uid));
            if (snap.exists()) nombrePorUid[uid] = snap.data();
          } catch (_) {}
        })
      );

      // 4. Construir lista final
      const lista = uids.map((uid) => ({
        ...porUid[uid],
        nombre: nombrePorUid[uid]?.nombre || null,
        email:  nombrePorUid[uid]?.email  || null,
        rol:    nombrePorUid[uid]?.rol     || 'docente',
      }));

      setDocentes(lista);
    } catch (e) {
      setError('Error cargando: ' + (e.message || e));
    } finally {
      setCargando(false);
    }
  }, [rangoLogs]);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Filtrar ──────────────────────────────────────────────────────────────────

  const filtrados = docentes
    .filter((d) => {
      // Excluir si soloDocencia y solo tiene módulo personal
      if (soloDocencia) {
        const tieneDocencia = Object.keys(d.porModulo).some(
          (mod) => metaModulo(mod).grupo === 'docencia'
        );
        if (!tieneDocencia) return false;
      }
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase();
        return (
          (d.nombre || '').toLowerCase().includes(q) ||
          (d.email  || '').toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (ordenar === 'costo')    return b.costoTotal   - a.costoTotal;
      if (ordenar === 'tokens')   return b.tokensTotal  - a.tokensTotal;
      if (ordenar === 'llamadas') return b.llamadas     - a.llamadas;
      if (ordenar === 'nombre')   return (a.nombre || 'zzz').localeCompare(b.nombre || 'zzz');
      return 0;
    })
    .map((d, i) => ({ ...d, rango: i + 1 }));

  // ── KPIs globales ─────────────────────────────────────────────────────────────

  const totalTokens  = docentes.reduce((s, d) => s + d.tokensTotal, 0);
  const totalCosto   = docentes.reduce((s, d) => s + d.costoTotal,  0);
  const totalUsuarios = docentes.length;

  // Módulo más usado globalmente
  const moduloGlobal = {};
  docentes.forEach((d) => {
    Object.entries(d.porModulo).forEach(([mod, data]) => {
      if (metaModulo(mod).grupo !== 'docencia') return;
      if (!moduloGlobal[mod]) moduloGlobal[mod] = 0;
      moduloGlobal[mod] += data.tokens;
    });
  });
  const moduloTopGlobal = Object.entries(moduloGlobal).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h2>Uso de IA — Docencia</h2>
          <p>Ranking de docentes por consumo de tokens en planificación, instrumentos, chat y todos los módulos IA.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            value={rangoLogs}
            onChange={(e) => setRangoLogs(Number(e.target.value))}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
          >
            {RANGOS_LOG.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button className="admin-btn" onClick={cargar} disabled={cargando}>
            {cargando ? 'Cargando…' : '↺ Actualizar'}
          </button>
        </div>
      </div>

      {/* KPIs globales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 22 }}>
        {[
          { label: 'Docentes con uso IA',      valor: totalUsuarios,                            color: '#2563eb' },
          { label: 'Tokens totales analizados', valor: `${(totalTokens / 1000).toFixed(1)}k`,  color: '#7c3aed' },
          { label: 'Costo IA total estimado',   valor: `$${totalCosto.toFixed(3)}`,             color: '#d97706' },
          { label: 'Módulo más usado',          valor: moduloTopGlobal ? `${metaModulo(moduloTopGlobal[0]).icono} ${metaModulo(moduloTopGlobal[0]).label}` : '—', color: '#059669' },
        ].map(({ label, valor, color }) => (
          <div key={label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px', borderTop: `3px solid ${color}` }}>
            <div style={{ fontSize: 20, fontWeight: 800, color }}>{valor}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Buscar por nombre o correo…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{ flex: '1 1 240px', padding: '7px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
        />
        <select value={ordenar} onChange={(e) => setOrdenar(e.target.value)} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}>
          {ORDENAR.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748b', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <input
            type="checkbox"
            checked={soloDocencia}
            onChange={(e) => setSoloDocencia(e.target.checked)}
          />
          Solo módulos docentes
        </label>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', color: '#dc2626', marginBottom: 16, fontSize: 14 }}>
          ⚠️ {error}
        </div>
      )}

      {cargando ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
          <p>Analizando logs de IA…</p>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="admin-placeholder">
          <span className="admin-placeholder-icon">📊</span>
          <h3>Sin datos aún</h3>
          <p>Los registros aparecen aquí cuando los docentes usan cualquier función IA de la plataforma.</p>
        </div>
      ) : (
        <>
          {filtrados.map((d) => (
            <DocenteCard key={d.uid} docente={d} />
          ))}
          <p style={{ color: '#94a3b8', fontSize: 12, textAlign: 'right', marginTop: 8 }}>
            {filtrados.length} docentes · basado en los últimos {rangoLogs} logs de <code>aiLogs</code>
          </p>
        </>
      )}
    </div>
  );
}
