import { useState, useEffect, useCallback } from 'react';
import {
  collection, query, orderBy, limit, getDocs, doc,
  updateDoc, getDoc, getDocs as getDocsAlias,
} from 'firebase/firestore';
import { db } from '../../firebase.js';
import { LIMITE_MENSAJES_MES } from '../../services/ai/personalChatService.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mesActual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatTs(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function UsoBarra({ mensajes, color = '#2563eb' }) {
  const pct = Math.min(100, Math.round(((mensajes || 0) / LIMITE_MENSAJES_MES) * 100));
  const c   = pct >= 90 ? '#dc2626' : pct >= 70 ? '#d97706' : color;
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 2 }}>
        <span>{mensajes || 0} / {LIMITE_MENSAJES_MES} mensajes</span>
        <span style={{ color: c, fontWeight: 700 }}>{pct}%</span>
      </div>
      <div style={{ background: '#e2e8f0', borderRadius: 999, height: 5 }}>
        <div style={{ width: `${pct}%`, background: c, height: '100%', borderRadius: 999 }} />
      </div>
    </div>
  );
}

// ─── Tarjeta de usuario ───────────────────────────────────────────────────────

function UsuarioCard({ usuario, onTogglePlan }) {
  const tiene = usuario.plan_personal === true;
  const uso   = usuario.uso || {};

  return (
    <div style={{
      border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px 20px',
      marginBottom: 10, background: '#fff',
      borderLeft: `4px solid ${tiene ? '#059669' : '#e2e8f0'}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Cabecera */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 999,
              background: tiene ? '#dcfce7' : '#f1f5f9',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, flexShrink: 0,
            }}>
              {tiene ? '✅' : '👤'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#1e293b' }}>
                {usuario.nombre || 'Sin nombre'}
              </p>
              <p style={{ margin: '1px 0 0', fontSize: 12, color: '#64748b' }}>{usuario.email || '—'}</p>
            </div>
            <span style={{
              background: tiene ? '#dcfce7' : '#f1f5f9',
              color: tiene ? '#059669' : '#94a3b8',
              borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 700, flexShrink: 0,
            }}>
              {tiene ? 'Plan Personal activo' : 'Sin plan personal'}
            </span>
          </div>

          {/* Estadísticas de uso */}
          {tiene && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 10 }}>
              {[
                { label: 'Mensajes este mes', valor: uso.mensajes || 0 },
                { label: 'Tokens estimados',  valor: (uso.tokensEstimados || 0).toLocaleString() },
                { label: 'Costo estimado',    valor: `$${(uso.costoEstimadoUSD || 0).toFixed(3)}` },
                { label: 'Memorias guardadas', valor: usuario.memorias || 0 },
              ].map(({ label, valor }) => (
                <div key={label} style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>{valor}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Barra de uso */}
          {tiene && <UsoBarra mensajes={uso.mensajes} />}

          {/* Alerta de costo alto */}
          {tiene && (uso.costoEstimadoUSD || 0) > 8 && (
            <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 8, padding: '7px 11px', marginTop: 8, fontSize: 12, color: '#a16207' }}>
              ⚠️ Este usuario ha consumido ${(uso.costoEstimadoUSD || 0).toFixed(2)} este mes — por encima del umbral de $8. Considera contactarlo.
            </div>
          )}

          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
            {tiene
              ? `Plan activado: ${formatTs(usuario.plan_personal_desde)}`
              : `Registrado: ${formatTs(usuario.fechaCreacion)}`}
          </div>
        </div>

        {/* Acción */}
        <div style={{ flexShrink: 0 }}>
          <button
            onClick={() => onTogglePlan(usuario.id, !tiene)}
            style={{
              background: tiene ? '#fef2f2' : '#eff6ff',
              color:      tiene ? '#dc2626' : '#2563eb',
              border:     `1px solid ${tiene ? '#fca5a5' : '#93c5fd'}`,
              borderRadius: 8, padding: '6px 14px', fontSize: 12,
              fontWeight: 700, cursor: 'pointer',
            }}
          >
            {tiene ? '⛔ Desactivar' : '✅ Activar plan'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AdminAsistentePersonal() {
  const [usuarios, setUsuarios]   = useState([]);
  const [cargando, setCargando]   = useState(true);
  const [error, setError]         = useState('');
  const [busqueda, setBusqueda]   = useState('');
  const [filtro, setFiltro]       = useState('todos');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const mes = mesActual();

      // Cargar todos los usuarios
      const usrSnap = await getDocs(query(collection(db, 'usuarios'), orderBy('fechaCreacion', 'desc'), limit(300)));
      const lista   = usrSnap.docs.map((d) => ({ id: d.id, ...d.data(), uso: {}, memorias: 0 }));

      // Para cada usuario con plan_personal, cargar su uso del mes y memorias
      await Promise.all(
        lista
          .filter((u) => u.plan_personal)
          .map(async (u) => {
            try {
              const [usoSnap, memSnap] = await Promise.all([
                getDoc(doc(db, 'chat_personal', u.id, 'uso', mes)),
                getDocs(collection(db, 'chat_memoria', u.id, 'hechos')),
              ]);
              u.uso      = usoSnap.exists() ? usoSnap.data() : {};
              u.memorias = memSnap.size || 0;
            } catch (_) {}
          })
      );

      setUsuarios(lista);
    } catch (e) {
      setError('Error cargando: ' + (e.message || e));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const togglePlan = async (uid, activar) => {
    const datos = activar
      ? { plan_personal: true,  plan_personal_desde: new Date() }
      : { plan_personal: false };

    await updateDoc(doc(db, 'usuarios', uid), datos);
    setUsuarios((prev) => prev.map((u) =>
      u.id === uid ? { ...u, ...datos } : u
    ));
  };

  const filtrados = usuarios
    .filter((u) => {
      if (filtro === 'activos' && !u.plan_personal)  return false;
      if (filtro === 'sin-plan' && u.plan_personal)  return false;
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase();
        return (
          (u.nombre || '').toLowerCase().includes(q) ||
          (u.email  || '').toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      // Activos primero, luego por costo descendente
      if (a.plan_personal && !b.plan_personal) return -1;
      if (!a.plan_personal && b.plan_personal) return  1;
      return (b.uso?.costoEstimadoUSD || 0) - (a.uso?.costoEstimadoUSD || 0);
    });

  // KPIs
  const totalActivos      = usuarios.filter((u) => u.plan_personal).length;
  const costoTotalMes     = usuarios.reduce((s, u) => s + (u.uso?.costoEstimadoUSD || 0), 0);
  const ingresoEstimado   = totalActivos * 20;
  const margenEstimado    = ingresoEstimado - costoTotalMes;
  const alertasAlto       = usuarios.filter((u) => (u.uso?.costoEstimadoUSD || 0) > 8).length;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h2>Asistente Personal IA</h2>
          <p>Control de usuarios con plan personal activo, uso mensual y costos estimados.</p>
        </div>
        <button className="admin-btn" onClick={cargar} disabled={cargando}>
          {cargando ? 'Cargando…' : '↺ Actualizar'}
        </button>
      </div>

      {/* KPIs financieros */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 22 }}>
        {[
          { label: 'Usuarios activos',       valor: totalActivos,               color: '#059669' },
          { label: 'Ingreso estimado/mes',   valor: `$${ingresoEstimado}`,      color: '#2563eb' },
          { label: 'Costo IA este mes',      valor: `$${costoTotalMes.toFixed(2)}`, color: '#d97706' },
          { label: 'Margen estimado',        valor: `$${margenEstimado.toFixed(2)}`, color: margenEstimado > 0 ? '#059669' : '#dc2626' },
        ].map(({ label, valor, color }) => (
          <div key={label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px', borderTop: `3px solid ${color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color }}>{valor}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Alerta si hay usuarios costosos */}
      {alertasAlto > 0 && (
        <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 14, color: '#a16207' }}>
          ⚠️ <strong>{alertasAlto} usuario{alertasAlto > 1 ? 's' : ''}</strong> {alertasAlto > 1 ? 'han' : 'ha'} superado los $8 de costo estimado este mes.
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Buscar por nombre o correo…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{ flex: '1 1 240px', padding: '7px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
        />
        <select value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}>
          <option value="todos">Todos los usuarios</option>
          <option value="activos">Solo con plan personal</option>
          <option value="sin-plan">Sin plan personal</option>
        </select>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', color: '#dc2626', marginBottom: 16, fontSize: 14 }}>
          ⚠️ {error}
        </div>
      )}

      {cargando ? (
        <p style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Cargando usuarios…</p>
      ) : filtrados.length === 0 ? (
        <div className="admin-placeholder">
          <span className="admin-placeholder-icon">🤖</span>
          <h3>Sin resultados</h3>
          <p>Activa el Plan Personal en un usuario para que aparezca aquí.</p>
        </div>
      ) : (
        <>
          {filtrados.map((u) => (
            <UsuarioCard key={u.id} usuario={u} onTogglePlan={togglePlan} />
          ))}
          <p style={{ color: '#94a3b8', fontSize: 12, textAlign: 'right', marginTop: 8 }}>
            {filtrados.length} de {usuarios.length} usuarios
          </p>
        </>
      )}
    </div>
  );
}
