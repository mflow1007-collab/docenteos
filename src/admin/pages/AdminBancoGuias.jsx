import { useState, useEffect, useCallback } from 'react';
import {
  listarFichasBanco, cambiarEstadoFicha, getBancoGuiasGate, setBancoGuiasGate,
} from '../../services/bancoGuiasService.js';

// Panel de administración del Banco de Guías: revisa las fichas cosechadas,
// valídalas (cosechada → validada) para que el servicio pueda servirlas, retira
// las malas, y enciende/apaga el gate del servicio. El banco sirve fichas SOLO
// cuando el gate está encendido Y la ficha está 'validada'.

const ESTADO_META = {
  cosechada: { label: 'Cosechada', bg: '#fef9c3', text: '#a16207' },
  validada:  { label: 'Validada',  bg: '#dcfce7', text: '#15803d' },
  retirada:  { label: 'Retirada',  bg: '#f1f5f9', text: '#94a3b8' },
};

const TABS = [
  { id: 'cosechada', icon: '🟡', label: 'Por revisar' },
  { id: 'validada',  icon: '🟢', label: 'Validadas' },
  { id: 'retirada',  icon: '⚪', label: 'Retiradas' },
];

function formatTs(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function FichaCard({ item, onValidar, onRetirar, onRestaurar }) {
  const ficha = item.ficha || {};
  const h = item.huella || {};
  const meta = ESTADO_META[item.estado] || ESTADO_META.cosechada;
  const destreza = ficha.destreza?.tipo && ficha.destreza.tipo !== 'ninguna' ? ficha.destreza.tipo : null;

  return (
    <div style={{
      border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 18px', marginBottom: 10,
      background: item.estado === 'retirada' ? '#f8fafc' : '#fff',
      opacity: item.estado === 'retirada' ? 0.7 : 1,
      borderLeft: `4px solid ${meta.text}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            <span style={{ background: meta.bg, color: meta.text, borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>{meta.label}</span>
            {ficha.numeroClase != null && (
              <span style={{ background: '#eef2ff', color: '#3730a3', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>Clase {ficha.numeroClase}</span>
            )}
            {h.area && <span style={{ background: '#eff6ff', color: '#1d4ed8', borderRadius: 6, padding: '2px 8px', fontSize: 12 }}>{h.area}</span>}
            {h.grado && <span style={{ background: '#f0fdf4', color: '#15803d', borderRadius: 6, padding: '2px 8px', fontSize: 12 }}>{h.grado}</span>}
            {destreza && <span style={{ background: '#f0f9ff', color: '#0369a1', borderRadius: 6, padding: '2px 8px', fontSize: 12 }}>{destreza}</span>}
          </div>
          <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 14, color: '#1e293b' }}>
            {ficha.titulo || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Sin título</span>}
          </p>
          {ficha.proposito && <p style={{ margin: '0 0 4px', fontSize: 13, color: '#64748b' }}>{ficha.proposito}</p>}
          <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 12, color: '#94a3b8', flexWrap: 'wrap' }}>
            <span>🧩 {item.procedencia?.titulo || h.tema || '—'}</span>
            <span>📅 {formatTs(item.createdAt)}</span>
            {item.revision?.requerida && <span style={{ color: '#dc2626' }}>⚠ requiere revisión</span>}
          </div>
        </div>
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {item.estado === 'cosechada' && (
            <>
              <button onClick={() => onValidar(item.id)} style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✓ Validar</button>
              <button onClick={() => onRetirar(item.id)} style={{ background: 'none', color: '#94a3b8', border: '1px solid #e2e8f0', borderRadius: 8, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>Retirar</button>
            </>
          )}
          {item.estado === 'validada' && (
            <button onClick={() => onRetirar(item.id)} style={{ background: 'none', color: '#94a3b8', border: '1px solid #e2e8f0', borderRadius: 8, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>Retirar</button>
          )}
          {item.estado === 'retirada' && (
            <button onClick={() => onRestaurar(item.id)} style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #93c5fd', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>↩ A revisar</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminBancoGuias() {
  const [tab, setTab] = useState('cosechada');
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [gate, setGate] = useState(null); // null = desconocido
  const [guardandoGate, setGuardandoGate] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true); setError('');
    try {
      const [lista, g] = await Promise.all([
        listarFichasBanco({ estado: tab }),
        getBancoGuiasGate(),
      ]);
      setItems(lista);
      setGate(g.enabled);
    } catch (e) {
      setError('Error cargando: ' + (e.message || e));
    } finally {
      setCargando(false);
    }
  }, [tab]);

  useEffect(() => { cargar(); setBusqueda(''); }, [cargar]);

  const aplicar = async (id, estado) => {
    try {
      await cambiarEstadoFicha(id, estado);
      setItems((prev) => prev.filter((i) => i.id !== id)); // sale de la pestaña actual
    } catch (e) {
      setError('No se pudo cambiar el estado: ' + (e.message || e));
    }
  };

  const toggleGate = async () => {
    setGuardandoGate(true); setError('');
    try {
      await setBancoGuiasGate(!gate);
      setGate(!gate);
    } catch (e) {
      setError('No se pudo cambiar el gate: ' + (e.message || e));
    } finally {
      setGuardandoGate(false);
    }
  };

  const filtrados = items.filter((item) => {
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase();
    const f = item.ficha || {};
    const h = item.huella || {};
    return (f.titulo || '').toLowerCase().includes(q)
      || (h.tema || '').toLowerCase().includes(q)
      || (h.area || '').toLowerCase().includes(q)
      || (h.grado || '').toLowerCase().includes(q);
  });

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h2>Banco de Guías</h2>
          <p>Fichas de clase de la Guía del Maestro cosechadas de las unidades. Valida las buenas para que el servicio las reutilice y deje de gastar IA.</p>
        </div>
        <button className="admin-btn" onClick={cargar} disabled={cargando}>{cargando ? 'Cargando…' : '↺ Actualizar'}</button>
      </div>

      {/* Gate del servicio */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: gate ? '#f0fdf4' : '#fff7ed', border: `1px solid ${gate ? '#86efac' : '#fed7aa'}`,
        borderRadius: 10, padding: '12px 16px', marginBottom: 20,
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: gate ? '#15803d' : '#c2410c' }}>
            {gate ? '🟢 Servicio ENCENDIDO' : '🟠 Servicio APAGADO'}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            {gate
              ? 'La generación reutiliza fichas VALIDADAS por huella exacta antes de llamar a la IA.'
              : 'Mientras esté apagado, la Guía siempre se genera con IA. Enciéndelo cuando haya fichas validadas suficientes.'}
          </div>
        </div>
        <button
          onClick={toggleGate}
          disabled={guardandoGate || gate === null}
          style={{
            background: gate ? '#fee2e2' : '#dcfce7', color: gate ? '#dc2626' : '#15803d',
            border: `1px solid ${gate ? '#fca5a5' : '#86efac'}`, borderRadius: 8,
            padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}
        >
          {guardandoGate ? '…' : gate ? 'Apagar servicio' : 'Encender servicio'}
        </button>
      </div>

      {/* Tabs por estado */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #e2e8f0', marginBottom: 20 }}>
        {TABS.map(({ id, icon, label }) => (
          <button key={id} onClick={() => setTab(id)} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '8px 18px', fontSize: 14,
            fontWeight: tab === id ? 700 : 500, color: tab === id ? '#2563eb' : '#64748b',
            borderBottom: tab === id ? '3px solid #2563eb' : '3px solid transparent', marginBottom: -2, borderRadius: '8px 8px 0 0',
          }}>{icon} {label}</button>
        ))}
      </div>

      <input
        type="text" placeholder="Buscar por título, tema, área, grado…"
        value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
        style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, marginBottom: 18 }}
      />

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', color: '#dc2626', marginBottom: 16, fontSize: 14 }}>⚠️ {error}</div>
      )}

      {cargando ? (
        <p style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Cargando banco…</p>
      ) : filtrados.length === 0 ? (
        <div className="admin-placeholder">
          <span className="admin-placeholder-icon">📖</span>
          <h3>Sin fichas {tab === 'cosechada' ? 'por revisar' : tab === 'validada' ? 'validadas' : 'retiradas'}</h3>
          <p>El Banco de Guías se llena cuando los docentes generan la Guía del Maestro y guardan la unidad con consentimiento.</p>
        </div>
      ) : (
        <>
          {filtrados.map((item) => (
            <FichaCard
              key={item.id}
              item={item}
              onValidar={(id) => aplicar(id, 'validada')}
              onRetirar={(id) => aplicar(id, 'retirada')}
              onRestaurar={(id) => aplicar(id, 'cosechada')}
            />
          ))}
          <p style={{ color: '#94a3b8', fontSize: 12, textAlign: 'right', marginTop: 8 }}>{filtrados.length} de {items.length} fichas</p>
        </>
      )}
    </div>
  );
}
