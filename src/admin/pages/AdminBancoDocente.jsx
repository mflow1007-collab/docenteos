import { useState, useEffect, useCallback } from 'react';
import {
  collection, query, orderBy, limit, getDocs, doc, getDoc,
} from 'firebase/firestore';
import { db } from '../../firebase.js';

// ─── Constantes ───────────────────────────────────────────────────────────────

const ETIQUETA_IA = {
  planificacion_aceptada:      { label: 'Plan aceptado',     icono: '✅', peso: 3 },
  planificacion_regenerada:    { label: 'Plan regenerado',   icono: '🔄', peso: 1 },
  mejora_aceptada:             { label: 'Mejora aceptada',   icono: '✨', peso: 2 },
  actividad_modificada:        { label: 'Act. modificada',   icono: '✏️', peso: 2 },
  instrumento_aceptado:        { label: 'Instrumento',       icono: '📝', peso: 2 },
  chat_consultado:             { label: 'Chat IA',           icono: '💬', peso: 1 },
  apoyo_generado:              { label: 'Apoyo NEAE',        icono: '🤝', peso: 2 },
  informe_estudiante_generado: { label: 'Informe',           icono: '📊', peso: 2 },
  ia_recomendacion_generada:   { label: 'Recomendación',    icono: '💡', peso: 1 },
  plantilla_usada:             { label: 'Plantilla',         icono: '📋', peso: 1 },
  auditoria_aplicada:          { label: 'Auditoría IA',      icono: '🔍', peso: 2 },
  apoyo_curso_generado:        { label: 'Apoyo de curso',    icono: '🎓', peso: 2 },
};

// Score de beneficio: suma de pesos de eventos de valor
function calcularScore(eventosPorTipo) {
  return Object.entries(eventosPorTipo).reduce((total, [tipo, count]) => {
    const peso = ETIQUETA_IA[tipo]?.peso || 0;
    return total + peso * count;
  }, 0);
}

function nivelBeneficio(score) {
  if (score >= 40) return { label: 'Alto',   color: '#059669', bg: '#dcfce7' };
  if (score >= 15) return { label: 'Medio',  color: '#d97706', bg: '#fef9c3' };
  if (score >= 3)  return { label: 'Bajo',   color: '#ea580c', bg: '#ffedd5' };
  return            { label: 'Sin uso', color: '#94a3b8', bg: '#f1f5f9' };
}

function formatTs(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Tarjeta de docente ───────────────────────────────────────────────────────

function DocenteCard({ docente }) {
  const [expandido, setExpandido] = useState(false);
  const nivel = nivelBeneficio(docente.score);
  const tiposUsados = Object.entries(docente.eventosPorTipo).sort((a, b) => b[1] - a[1]);
  const tienePerfil = docente.estrategias?.length > 0 || docente.areasPrincipales?.length > 0;

  return (
    <div style={{
      border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px 20px',
      marginBottom: 10, background: '#fff',
      borderLeft: `4px solid ${nivel.color}`,
    }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        {/* Avatar + nivel */}
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 999,
            background: nivel.bg, color: nivel.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 800, border: `2px solid ${nivel.color}`,
          }}>
            {docente.nombre ? docente.nombre.charAt(0).toUpperCase() : '?'}
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: nivel.color, marginTop: 3 }}>
            {nivel.label}
          </div>
        </div>

        {/* Info principal */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: '#1e293b' }}>
                {docente.nombre || 'Sin nombre'}
              </p>
              <p style={{ margin: '1px 0 0', fontSize: 12, color: '#64748b' }}>{docente.email || '—'}</p>
            </div>
            {/* Score */}
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: nivel.color, lineHeight: 1 }}>
                {docente.score}
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>puntos IA</div>
            </div>
          </div>

          {/* Contexto pedagógico */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {(docente.areasPrincipales || []).map((a) => (
              <span key={a} style={{ background: '#eff6ff', color: '#1d4ed8', borderRadius: 999, padding: '2px 9px', fontSize: 11, fontWeight: 600 }}>{a}</span>
            ))}
            {(docente.gradosPrincipales || []).map((g) => (
              <span key={g} style={{ background: '#f0fdf4', color: '#15803d', borderRadius: 999, padding: '2px 9px', fontSize: 11, fontWeight: 600 }}>{g}</span>
            ))}
            {!tienePerfil && (
              <span style={{ background: '#f1f5f9', color: '#94a3b8', borderRadius: 999, padding: '2px 9px', fontSize: 11 }}>Sin perfil IA</span>
            )}
          </div>

          {/* Funciones IA que usa */}
          {tiposUsados.length > 0 ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {tiposUsados.slice(0, 6).map(([tipo, count]) => {
                const meta = ETIQUETA_IA[tipo] || { icono: '⚙️', label: tipo };
                return (
                  <span key={tipo} style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: '#f8fafc', border: '1px solid #e2e8f0',
                    borderRadius: 8, padding: '3px 9px', fontSize: 12,
                  }}>
                    {meta.icono} <strong>{count}</strong> <span style={{ color: '#64748b' }}>{meta.label}</span>
                  </span>
                );
              })}
              {tiposUsados.length > 6 && (
                <span style={{ fontSize: 12, color: '#94a3b8', padding: '3px 6px' }}>
                  +{tiposUsados.length - 6} más
                </span>
              )}
            </div>
          ) : (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
              Ninguna función IA utilizada todavía.
            </p>
          )}

          {/* Meta: último evento, total */}
          <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: '#94a3b8' }}>
            <span>📌 {docente.totalEventos} eventos totales</span>
            {docente.ultimoEvento && <span>🕐 Último: {formatTs(docente.ultimoEvento)}</span>}
            {docente.estrategias?.length > 0 && (
              <span>🎯 {docente.estrategias.length} estrategia{docente.estrategias.length > 1 ? 's' : ''} detectada{docente.estrategias.length > 1 ? 's' : ''}</span>
            )}
          </div>
        </div>

        {/* Botón expandir */}
        {(docente.estrategias?.length > 0 || docente.memorias?.length > 0) && (
          <button
            onClick={() => setExpandido(!expandido)}
            style={{
              background: 'none', border: '1px solid #e2e8f0', borderRadius: 8,
              padding: '4px 10px', fontSize: 11, color: '#64748b', cursor: 'pointer', flexShrink: 0,
            }}
          >
            {expandido ? '▲' : '▼ Ver perfil'}
          </button>
        )}
      </div>

      {/* Panel expandido: perfil IA */}
      {expandido && (
        <div style={{ marginTop: 14, borderTop: '1px solid #f1f5f9', paddingTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {docente.estrategias?.length > 0 && (
            <div>
              <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: '#64748b' }}>Estrategias preferidas</p>
              {docente.estrategias.map((e) => (
                <span key={e} style={{ display: 'inline-block', background: '#faf5ff', color: '#7c3aed', borderRadius: 6, padding: '2px 8px', fontSize: 11, marginRight: 4, marginBottom: 4 }}>{e}</span>
              ))}
            </div>
          )}
          {docente.tiposRecursos?.length > 0 && (
            <div>
              <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: '#64748b' }}>Recursos preferidos</p>
              {docente.tiposRecursos.map((r) => (
                <span key={r} style={{ display: 'inline-block', background: '#fef9c3', color: '#a16207', borderRadius: 6, padding: '2px 8px', fontSize: 11, marginRight: 4, marginBottom: 4 }}>{r}</span>
              ))}
            </div>
          )}
          {docente.memorias?.slice(0, 5).map((m, i) => (
            <div key={i} style={{ gridColumn: '1 / -1', background: '#f8fafc', borderRadius: 8, padding: '7px 11px', fontSize: 12 }}>
              <span style={{ background: '#eff6ff', color: '#1d4ed8', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700, marginRight: 7 }}>
                {m.tipo || 'nota'}
              </span>
              {m.contenido || '—'}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

const ORDENAR_POR = [
  { value: 'score',   label: '⭐ Mayor beneficio IA' },
  { value: 'eventos', label: '📌 Más activos' },
  { value: 'nombre',  label: '🔤 Nombre A→Z' },
  { value: 'ultimo',  label: '🕐 Último acceso' },
];

const FILTRO_NIVEL = [
  { value: '',       label: 'Todos' },
  { value: 'Alto',   label: '🟢 Alto beneficio' },
  { value: 'Medio',  label: '🟡 Medio' },
  { value: 'Bajo',   label: '🟠 Bajo' },
  { value: 'Sin uso',label: '⚫ Sin uso IA' },
];

export default function AdminBancoDocente() {
  const [docentes, setDocentes]   = useState([]);
  const [cargando, setCargando]   = useState(true);
  const [error, setError]         = useState('');
  const [busqueda, setBusqueda]   = useState('');
  const [ordenar, setOrdenar]     = useState('score');
  const [filtroNivel, setFiltroNivel] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      // 1. Últimos 1000 eventos IA — agrupamos por userId
      const evQ = query(collection(db, 'le_eventos'), orderBy('timestamp', 'desc'), limit(1000));
      const evSnap = await getDocs(evQ);
      const eventos = evSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const porUsuario = {};
      for (const ev of eventos) {
        const uid = ev.userId;
        if (!uid) continue;
        if (!porUsuario[uid]) {
          porUsuario[uid] = { totalEventos: 0, eventosPorTipo: {}, ultimoEvento: null };
        }
        porUsuario[uid].totalEventos++;
        const tipo = ev.tipo || 'desconocido';
        porUsuario[uid].eventosPorTipo[tipo] = (porUsuario[uid].eventosPorTipo[tipo] || 0) + 1;
        if (!porUsuario[uid].ultimoEvento && ev.timestamp) {
          porUsuario[uid].ultimoEvento = ev.timestamp;
        }
      }

      // 2. Perfiles IA (ke_estilos) — preferencias detectadas
      const estSnap = await getDocs(collection(db, 'ke_estilos'));
      const estilosPorUid = {};
      estSnap.docs.forEach((d) => {
        const data = d.data();
        const uid  = data.userId || d.id;
        estilosPorUid[uid] = data;
      });

      // 3. Usuarios registrados — nombre y email
      const usrSnap = await getDocs(collection(db, 'usuarios'));
      const usuariosPorUid = {};
      usrSnap.docs.forEach((d) => {
        usuariosPorUid[d.id] = d.data();
      });

      // 4. Unir todo — incluir usuarios con eventos + usuarios registrados sin eventos
      const uids = new Set([
        ...Object.keys(porUsuario),
        ...usrSnap.docs.map((d) => d.id),
      ]);

      const lista = [];
      for (const uid of uids) {
        const usr    = usuariosPorUid[uid] || {};
        const evData = porUsuario[uid]     || { totalEventos: 0, eventosPorTipo: {}, ultimoEvento: null };
        const estilo = estilosPorUid[uid]  || {};

        // Memorias (opcional — solo si el agente existe)
        let memorias = [];
        try {
          const memQ = query(collection(doc(db, 'ke_agentes', uid), 'ke_memoria'), limit(10));
          const memSnap = await getDocs(memQ);
          memorias = memSnap.docs.map((d) => d.data());
        } catch (_) {}

        const score = calcularScore(evData.eventosPorTipo);

        lista.push({
          uid,
          nombre:            usr.nombre || usr.displayName || null,
          email:             usr.email  || null,
          rol:               usr.rol    || 'docente',
          totalEventos:      evData.totalEventos,
          eventosPorTipo:    evData.eventosPorTipo,
          ultimoEvento:      evData.ultimoEvento,
          score,
          estrategias:       estilo.estrategias       || [],
          tiposRecursos:     estilo.tiposRecursos     || [],
          areasPrincipales:  estilo.areasPrincipales  || [],
          gradosPrincipales: estilo.gradosPrincipales || [],
          memorias,
        });
      }

      setDocentes(lista);
    } catch (e) {
      setError('Error cargando: ' + (e.message || e));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Filtrar y ordenar ───────────────────────────────────────────────────────

  const filtrados = docentes
    .filter((d) => {
      if (filtroNivel) {
        const nv = nivelBeneficio(d.score).label;
        if (nv !== filtroNivel) return false;
      }
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase();
        return (
          (d.nombre || '').toLowerCase().includes(q) ||
          (d.email  || '').toLowerCase().includes(q) ||
          (d.areasPrincipales || []).some((a) => a.toLowerCase().includes(q))
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (ordenar === 'score')   return b.score - a.score;
      if (ordenar === 'eventos') return b.totalEventos - a.totalEventos;
      if (ordenar === 'nombre')  return (a.nombre || 'zzz').localeCompare(b.nombre || 'zzz');
      if (ordenar === 'ultimo') {
        const ta = a.ultimoEvento?.toDate ? a.ultimoEvento.toDate() : new Date(0);
        const tb = b.ultimoEvento?.toDate ? b.ultimoEvento.toDate() : new Date(0);
        return tb - ta;
      }
      return 0;
    });

  // ── KPIs ────────────────────────────────────────────────────────────────────

  const totalDocentes = docentes.length;
  const conBeneficioAlto  = docentes.filter((d) => nivelBeneficio(d.score).label === 'Alto').length;
  const sinUso            = docentes.filter((d) => d.totalEventos === 0).length;
  const scorePromedio     = docentes.length > 0
    ? Math.round(docentes.reduce((s, d) => s + d.score, 0) / docentes.length)
    : 0;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h2>Banco Docente</h2>
          <p>Qué docentes le sacan más provecho a la IA, qué funciones usan y quiénes necesitan atención.</p>
        </div>
        <button className="admin-btn" onClick={cargar} disabled={cargando}>
          {cargando ? 'Cargando…' : '↺ Actualizar'}
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 22 }}>
        {[
          { label: 'Docentes totales',      valor: totalDocentes,    color: '#2563eb' },
          { label: 'Alto beneficio IA',     valor: conBeneficioAlto, color: '#059669' },
          { label: 'Sin uso de IA',         valor: sinUso,           color: '#dc2626' },
          { label: 'Score promedio',        valor: scorePromedio,    color: '#7c3aed' },
        ].map(({ label, valor, color }) => (
          <div key={label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px', borderTop: `3px solid ${color}` }}>
            <div style={{ fontSize: 26, fontWeight: 800, color }}>{valor}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Buscar por nombre, correo o área…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{ flex: '1 1 240px', padding: '7px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
        />
        <select value={filtroNivel} onChange={(e) => setFiltroNivel(e.target.value)} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}>
          {FILTRO_NIVEL.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={ordenar} onChange={(e) => setOrdenar(e.target.value)} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}>
          {ORDENAR_POR.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', color: '#dc2626', marginBottom: 16, fontSize: 14 }}>
          ⚠️ {error}
        </div>
      )}

      {cargando ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>👥</div>
          <p>Analizando uso de la plataforma…</p>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="admin-placeholder">
          <span className="admin-placeholder-icon">👥</span>
          <h3>Sin resultados</h3>
          <p>Ajusta los filtros o espera a que los docentes comiencen a usar la plataforma.</p>
        </div>
      ) : (
        <>
          {filtrados.map((d) => (
            <DocenteCard key={d.uid} docente={d} />
          ))}
          <p style={{ color: '#94a3b8', fontSize: 12, textAlign: 'right', marginTop: 8 }}>
            {filtrados.length} de {docentes.length} docentes
          </p>
        </>
      )}
    </div>
  );
}
