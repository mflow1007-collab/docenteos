import { useState, useEffect, useCallback } from 'react';
import {
  collection, query, orderBy, limit, getDocs, updateDoc, doc, where,
} from 'firebase/firestore';
import { db } from '../../firebase.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'planes',       icon: '📄', label: 'Planificaciones' },
  { id: 'actividades',  icon: '⚡', label: 'Actividades' },
  { id: 'instrumentos', icon: '📝', label: 'Instrumentos' },
];

const COLECCIONES = {
  planes:       'bic_planes',
  actividades:  'bic_actividades',
  instrumentos: 'bic_instrumentos',
};

function calBadge(score) {
  if (!score && score !== 0) return { label: '—', bg: '#f1f5f9', text: '#94a3b8' };
  const n = Math.round(Number(score) * 100);
  if (n >= 80) return { label: `${n}%`, bg: '#dcfce7', text: '#15803d' };
  if (n >= 55) return { label: `${n}%`, bg: '#fef9c3', text: '#a16207' };
  return { label: `${n}%`, bg: '#fee2e2', text: '#dc2626' };
}

function formatTs(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function shortUid(uid) {
  if (!uid || uid === 'anon') return 'Anónimo';
  return uid.slice(0, 6) + '…';
}

// ─── Tarjeta de ítem BIC ──────────────────────────────────────────────────────

function BICCard({ item, coleccion, onArchivar, onRestaurar }) {
  const cal = calBadge(item.calidad);
  const archivado = item.archivado === true;

  return (
    <div style={{
      border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 18px',
      marginBottom: 10, background: archivado ? '#f8fafc' : '#fff',
      opacity: archivado ? 0.65 : 1,
      borderLeft: `4px solid ${cal.text}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Badges */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            <span style={{ background: cal.bg, color: cal.text, borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>
              🏅 {cal.label}
            </span>
            {item.area && (
              <span style={{ background: '#eff6ff', color: '#1d4ed8', borderRadius: 6, padding: '2px 8px', fontSize: 12 }}>{item.area}</span>
            )}
            {item.grado && (
              <span style={{ background: '#f0fdf4', color: '#15803d', borderRadius: 6, padding: '2px 8px', fontSize: 12 }}>{item.grado}</span>
            )}
            {item.nivel && (
              <span style={{ background: '#faf5ff', color: '#7c3aed', borderRadius: 6, padding: '2px 8px', fontSize: 12 }}>Nivel {item.nivel}</span>
            )}
            {archivado && (
              <span style={{ background: '#f1f5f9', color: '#94a3b8', borderRadius: 6, padding: '2px 8px', fontSize: 12 }}>Archivado</span>
            )}
          </div>

          {/* Título */}
          <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 14, color: '#1e293b' }}>
            {item.tema || item.titulo || item.nombre || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Sin título</span>}
          </p>
          {item.competencia && (
            <p style={{ margin: '0 0 4px', fontSize: 13, color: '#64748b' }}>{item.competencia}</p>
          )}

          {/* Meta */}
          <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 12, color: '#94a3b8' }}>
            <span>🔁 Usado {item.vecesUsada || 0}x</span>
            <span>✏️ Modificado {item.vecesModificada || 0}x</span>
            <span>👤 {shortUid(item.creadoPor)}</span>
            <span>📅 {formatTs(item.fechaCreacion)}</span>
          </div>
        </div>

        {/* Acciones */}
        <div style={{ flexShrink: 0 }}>
          {archivado ? (
            <button
              onClick={() => onRestaurar(coleccion, item.id)}
              style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #93c5fd', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              ↩ Restaurar
            </button>
          ) : (
            <button
              onClick={() => onArchivar(coleccion, item.id)}
              style={{ background: 'none', border: '1px solid #e2e8f0', color: '#94a3b8', borderRadius: 8, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}
            >
              Archivar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AdminBancoAprendizaje() {
  const [tab, setTab]           = useState('planes');
  const [items, setItems]       = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError]       = useState('');
  const [filtroArea, setFiltroArea]       = useState('');
  const [filtroArchivado, setFiltroArchivado] = useState('activos');
  const [busqueda, setBusqueda] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const coleccion = COLECCIONES[tab];
      const q = query(
        collection(db, coleccion),
        orderBy('calidad', 'desc'),
        limit(200),
      );
      const snap = await getDocs(q);
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      setError('Error cargando: ' + (e.message || e));
    } finally {
      setCargando(false);
    }
  }, [tab]);

  useEffect(() => { cargar(); setBusqueda(''); setFiltroArea(''); }, [cargar]);

  const archivar = async (col, id) => {
    await updateDoc(doc(db, col, id), { archivado: true });
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, archivado: true } : i));
  };

  const restaurar = async (col, id) => {
    await updateDoc(doc(db, col, id), { archivado: false });
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, archivado: false } : i));
  };

  // Filtros cliente
  const filtrados = items.filter((item) => {
    if (filtroArchivado === 'activos'   && item.archivado)  return false;
    if (filtroArchivado === 'archivados' && !item.archivado) return false;
    if (filtroArea && item.area !== filtroArea) return false;
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      return (
        (item.tema   || '').toLowerCase().includes(q) ||
        (item.titulo || '').toLowerCase().includes(q) ||
        (item.area   || '').toLowerCase().includes(q) ||
        (item.grado  || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const areas = [...new Set(items.map((i) => i.area).filter(Boolean))].sort();

  // KPIs
  const activos    = items.filter((i) => !i.archivado).length;
  const archivados = items.filter((i) => i.archivado).length;
  const promedioCalidad = items.length > 0
    ? Math.round(items.reduce((a, i) => a + (Number(i.calidad) || 0), 0) / items.length * 100)
    : 0;
  const masUsado = items.sort((a, b) => (b.vecesUsada || 0) - (a.vecesUsada || 0))[0];

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h2>Banco de Aprendizaje</h2>
          <p>Planificaciones, actividades e instrumentos generados por IA que el BIC reutiliza y mejora.</p>
        </div>
        <button className="admin-btn" onClick={cargar} disabled={cargando}>
          {cargando ? 'Cargando…' : '↺ Actualizar'}
        </button>
      </div>

      {/* KPIs rápidos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 22 }}>
        {[
          { label: 'Elementos activos', valor: activos, color: '#2563eb' },
          { label: 'Archivados', valor: archivados, color: '#94a3b8' },
          { label: 'Calidad promedio', valor: `${promedioCalidad}%`, color: promedioCalidad >= 70 ? '#059669' : '#d97706' },
          { label: 'Más reutilizado', valor: masUsado?.vecesUsada ? `${masUsado.vecesUsada}x` : '—', color: '#7c3aed' },
        ].map(({ label, valor, color }) => (
          <div key={label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px', borderTop: `3px solid ${color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color }}>{valor}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #e2e8f0', marginBottom: 20 }}>
        {TABS.map(({ id, icon, label }) => (
          <button key={id} onClick={() => setTab(id)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '8px 18px', fontSize: 14, fontWeight: tab === id ? 700 : 500,
            color: tab === id ? '#2563eb' : '#64748b',
            borderBottom: tab === id ? '3px solid #2563eb' : '3px solid transparent',
            marginBottom: -2, borderRadius: '8px 8px 0 0',
          }}>
            {icon} {label}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Buscar por tema, área, grado…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{ flex: '1 1 220px', padding: '7px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
        />
        <select value={filtroArea} onChange={(e) => setFiltroArea(e.target.value)} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}>
          <option value="">Todas las áreas</option>
          {areas.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filtroArchivado} onChange={(e) => setFiltroArchivado(e.target.value)} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}>
          <option value="activos">Solo activos</option>
          <option value="archivados">Solo archivados</option>
          <option value="todos">Todos</option>
        </select>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', color: '#dc2626', marginBottom: 16, fontSize: 14 }}>
          ⚠️ {error}
        </div>
      )}

      {cargando ? (
        <p style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Cargando banco…</p>
      ) : filtrados.length === 0 ? (
        <div className="admin-placeholder">
          <span className="admin-placeholder-icon">🧠</span>
          <h3>Sin elementos</h3>
          <p>El Banco de Aprendizaje se llena automáticamente cuando los docentes generan y aceptan planificaciones con IA.</p>
        </div>
      ) : (
        <>
          {filtrados.map((item) => (
            <BICCard
              key={item.id}
              item={item}
              coleccion={COLECCIONES[tab]}
              onArchivar={archivar}
              onRestaurar={restaurar}
            />
          ))}
          <p style={{ color: '#94a3b8', fontSize: 12, textAlign: 'right', marginTop: 8 }}>
            {filtrados.length} de {items.length} elementos
          </p>
        </>
      )}
    </div>
  );
}
