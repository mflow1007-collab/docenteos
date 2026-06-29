import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  getTemas,        createTema,        updateTema,
  getActividades,  createActividad,   updateActividad,
  getInstrumentos, createInstrumento, updateInstrumento,
  getRecursos,     createRecurso,     updateRecurso,
  getNeae,         createNeae,        updateNeae,
  cambiarEstado,   eliminarBP,
  BP_ESTADOS, BP_AREAS, BP_GRADOS, BP_MOMENTOS,
  BP_TIPOS_ACTIVIDAD, BP_TIPOS_INSTRUMENTO, BP_TIPOS_RECURSO,
} from '../../services/bancoPedagogicoService.js';

// ─── Constantes ───────────────────────────────────────────────────────────────

const TABS = [
  { id: 'temas',        icon: '📌', label: 'Temas' },
  { id: 'actividades',  icon: '⚡', label: 'Actividades' },
  { id: 'instrumentos', icon: '📝', label: 'Instrumentos' },
  { id: 'recursos',     icon: '🎬', label: 'Recursos' },
  { id: 'neae',         icon: '♿', label: 'NEAE' },
];

const ESTADO_COLORES = {
  draft:    { bg: '#f1f5f9', text: '#64748b', label: 'Borrador' },
  pending:  { bg: '#fef9c3', text: '#a16207', label: 'Pendiente' },
  approved: { bg: '#dbeafe', text: '#1d4ed8', label: 'Aprobado' },
  official: { bg: '#dcfce7', text: '#15803d', label: 'Oficial' },
  obsolete: { bg: '#fee2e2', text: '#dc2626', label: 'Obsoleto' },
};

const FLUJO_ESTADOS = {
  draft:    ['pending'],
  pending:  ['approved', 'draft'],
  approved: ['official', 'pending'],
  official: ['obsolete'],
  obsolete: ['draft'],
};

// ─── Componentes pequeños ─────────────────────────────────────────────────────

function EstadoBadge({ estado }) {
  const c = ESTADO_COLORES[estado] || { bg: '#f1f5f9', text: '#64748b', label: estado };
  return (
    <span style={{
      background: c.bg, color: c.text,
      borderRadius: 6, padding: '2px 9px', fontSize: 12, fontWeight: 700,
      whiteSpace: 'nowrap',
    }}>
      {c.label}
    </span>
  );
}

function FiltroEstado({ valor, onChange }) {
  return (
    <select
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
    >
      <option value="">Todos los estados</option>
      {BP_ESTADOS.map((e) => (
        <option key={e} value={e}>{ESTADO_COLORES[e]?.label || e}</option>
      ))}
    </select>
  );
}

function FiltroArea({ valor, onChange }) {
  return (
    <select
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
    >
      <option value="">Todas las áreas</option>
      {BP_AREAS.map((a) => (
        <option key={a} value={a}>{a}</option>
      ))}
    </select>
  );
}

function BotonesAccionEstado({ coleccion, item, adminId, onCambio }) {
  const siguientes = FLUJO_ESTADOS[item.estado] || [];
  if (siguientes.length === 0) return null;
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {siguientes.map((sig) => {
        const c = ESTADO_COLORES[sig];
        return (
          <button
            key={sig}
            onClick={() => cambiarEstado(coleccion, item.id, sig, adminId).then(onCambio)}
            style={{
              background: c.bg, color: c.text, border: `1px solid ${c.text}40`,
              borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            → {c.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Modal genérico de creación / edición ─────────────────────────────────────

function Modal({ titulo, onClose, onGuardar, guardando, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.45)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, padding: 28, width: '100%',
        maxWidth: 640, maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{titulo}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}>✕</button>
        </div>
        {children}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24, borderTop: '1px solid #f1f5f9', paddingTop: 18 }}>
          <button onClick={onClose} className="admin-btn admin-btn-ghost" disabled={guardando}>Cancelar</button>
          <button onClick={onGuardar} className="admin-btn" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Campo de texto reutilizable ──────────────────────────────────────────────

const Field = ({ label, children }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 5 }}>{label}</label>
    {children}
  </div>
);

const Input = (props) => (
  <input
    {...props}
    style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' }}
  />
);

const Textarea = (props) => (
  <textarea
    {...props}
    rows={3}
    style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }}
  />
);

const Select = ({ value, onChange, options, placeholder }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' }}
  >
    <option value="">{placeholder || 'Seleccionar…'}</option>
    {options.map((o) => <option key={o} value={o}>{o}</option>)}
  </select>
);

function MultiCheck({ label, opciones, seleccionados, onChange }) {
  const toggle = (op) => {
    const next = seleccionados.includes(op)
      ? seleccionados.filter((x) => x !== op)
      : [...seleccionados, op];
    onChange(next);
  };
  return (
    <Field label={label}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {opciones.map((op) => (
          <label key={op} style={{
            display: 'flex', alignItems: 'center', gap: 5, fontSize: 13,
            background: seleccionados.includes(op) ? '#eff6ff' : '#f8fafc',
            border: `1px solid ${seleccionados.includes(op) ? '#3b82f6' : '#e2e8f0'}`,
            borderRadius: 8, padding: '4px 10px', cursor: 'pointer',
          }}>
            <input type="checkbox" checked={seleccionados.includes(op)} onChange={() => toggle(op)} style={{ display: 'none' }} />
            {op}
          </label>
        ))}
      </div>
    </Field>
  );
}

// ─── Tarjeta de ítem ─────────────────────────────────────────────────────────

function ItemCard({ item, coleccion, adminId, onEditar, onRefresh }) {
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);

  const handleEliminar = async () => {
    await eliminarBP(coleccion, item.id);
    onRefresh();
  };

  return (
    <div style={{
      border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 18px',
      marginBottom: 10, background: '#fff',
      borderLeft: `4px solid ${ESTADO_COLORES[item.estado]?.text || '#cbd5e1'}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <EstadoBadge estado={item.estado} />
            {item.area && <span style={{ fontSize: 12, color: '#475569', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '2px 8px' }}>{item.area}</span>}
            {item.tipo && <span style={{ fontSize: 12, color: '#7c3aed', background: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: 6, padding: '2px 8px' }}>{item.tipo}</span>}
            {item.momento && <span style={{ fontSize: 12, color: '#0369a1', background: '#e0f2fe', border: '1px solid #7dd3fc', borderRadius: 6, padding: '2px 8px' }}>{item.momento}</span>}
          </div>
          <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 14, color: '#1e293b' }}>
            {item.titulo || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Sin título</span>}
          </p>
          {item.descripcion && <p style={{ margin: '0 0 4px', fontSize: 13, color: '#64748b' }}>{item.descripcion}</p>}
          {item.grados?.length > 0 && (
            <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>Grados: {item.grados.join(', ')}</p>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => onEditar(item)} className="admin-btn admin-btn-ghost" style={{ fontSize: 12, padding: '4px 12px' }}>Editar</button>
            {!confirmarEliminar
              ? <button onClick={() => setConfirmarEliminar(true)} style={{ background: 'none', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>Eliminar</button>
              : (
                <span style={{ fontSize: 12 }}>
                  ¿Seguro?{' '}
                  <button onClick={handleEliminar} style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 12 }}>Sí</button>
                  {' '}
                  <button onClick={() => setConfirmarEliminar(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#64748b' }}>No</button>
                </span>
              )
            }
          </div>
          <BotonesAccionEstado coleccion={coleccion} item={item} adminId={adminId} onCambio={onRefresh} />
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Temas ───────────────────────────────────────────────────────────────

const TEMA_VACIO = { titulo: '', descripcion: '', area: '', niveles: [], grados: [] };

function TabTemas({ adminId }) {
  const [items, setItems]         = useState([]);
  const [cargando, setCargando]   = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroArea, setFiltroArea]     = useState('');
  const [modal, setModal]         = useState(null); // null | { ...item } | TEMA_VACIO
  const [form, setForm]           = useState(TEMA_VACIO);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    const data = await getTemas({ estado: filtroEstado || null, area: filtroArea || null });
    setItems(data);
    setCargando(false);
  }, [filtroEstado, filtroArea]);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirNuevo  = () => { setForm(TEMA_VACIO); setModal({}); };
  const abrirEditar = (item) => { setForm({ titulo: item.titulo || '', descripcion: item.descripcion || '', area: item.area || '', niveles: item.niveles || [], grados: item.grados || [] }); setModal(item); };

  const guardar = async () => {
    if (!form.titulo.trim()) return;
    setGuardando(true);
    try {
      if (modal.id) {
        await updateTema(modal.id, form);
      } else {
        await createTema(form, adminId);
      }
      setModal(null);
      cargar();
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <FiltroEstado valor={filtroEstado} onChange={setFiltroEstado} />
        <FiltroArea   valor={filtroArea}   onChange={setFiltroArea} />
        <button onClick={abrirNuevo} className="admin-btn" style={{ marginLeft: 'auto' }}>+ Nuevo tema</button>
      </div>

      {cargando ? (
        <p style={{ color: '#94a3b8', textAlign: 'center', padding: 32 }}>Cargando temas…</p>
      ) : items.length === 0 ? (
        <div className="admin-placeholder">
          <span className="admin-placeholder-icon">📌</span>
          <h3>Sin temas</h3>
          <p>Crea el primer tema pedagógico haciendo clic en "+ Nuevo tema".</p>
        </div>
      ) : (
        items.map((item) => (
          <ItemCard key={item.id} item={item} coleccion="bp_temas" adminId={adminId} onEditar={abrirEditar} onRefresh={cargar} />
        ))
      )}

      {modal !== null && (
        <Modal titulo={modal.id ? 'Editar tema' : 'Nuevo tema'} onClose={() => setModal(null)} onGuardar={guardar} guardando={guardando}>
          <Field label="Título *">
            <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ej. My Daily Routine" />
          </Field>
          <Field label="Descripción">
            <Textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Breve descripción del tema…" />
          </Field>
          <Field label="Área curricular">
            <Select value={form.area} onChange={(v) => setForm({ ...form, area: v })} options={BP_AREAS} placeholder="Seleccionar área…" />
          </Field>
          <MultiCheck label="Grados" opciones={BP_GRADOS} seleccionados={form.grados} onChange={(v) => setForm({ ...form, grados: v })} />
        </Modal>
      )}
    </div>
  );
}

// ─── Tab: Actividades ─────────────────────────────────────────────────────────

const ACT_VACIA = {
  titulo: '', tipo: '', momento: 'Desarrollo',
  instrucciones: '', area: '', grados: [], duracion: 15, estrategia: '',
};

function TabActividades({ adminId }) {
  const [items, setItems]               = useState([]);
  const [cargando, setCargando]         = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroArea, setFiltroArea]     = useState('');
  const [filtroTipo, setFiltroTipo]     = useState('');
  const [filtroMomento, setFiltroMomento] = useState('');
  const [modal, setModal]               = useState(null);
  const [form, setForm]                 = useState(ACT_VACIA);
  const [guardando, setGuardando]       = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    const data = await getActividades({
      estado: filtroEstado || null,
      area: filtroArea || null,
      tipo: filtroTipo || null,
      momento: filtroMomento || null,
    });
    setItems(data);
    setCargando(false);
  }, [filtroEstado, filtroArea, filtroTipo, filtroMomento]);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirNuevo = () => {
    setForm(ACT_VACIA);
    setModal({});
  };

  const abrirEditar = (item) => {
    setForm({
      titulo:       item.titulo       || '',
      tipo:         item.tipo         || '',
      momento:      item.momento      || 'Desarrollo',
      instrucciones: Array.isArray(item.instrucciones)
        ? item.instrucciones.join('\n')
        : (item.instrucciones || ''),
      area:         item.area         || '',
      grados:       item.grados       || [],
      duracion:     item.duracion     || 15,
      estrategia:   item.estrategia   || '',
    });
    setModal(item);
  };

  const guardar = async () => {
    if (!form.titulo.trim()) return;
    setGuardando(true);
    try {
      const instruccionesArr = form.instrucciones
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      const payload = { ...form, instrucciones: instruccionesArr, duracion: Number(form.duracion) || 15 };
      if (modal.id) {
        await updateActividad(modal.id, payload);
      } else {
        await createActividad(payload, adminId);
      }
      setModal(null);
      cargar();
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <FiltroEstado valor={filtroEstado} onChange={setFiltroEstado} />
        <FiltroArea   valor={filtroArea}   onChange={setFiltroArea} />
        <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}>
          <option value="">Todos los tipos</option>
          {BP_TIPOS_ACTIVIDAD.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filtroMomento} onChange={(e) => setFiltroMomento(e.target.value)} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}>
          <option value="">Todos los momentos</option>
          {BP_MOMENTOS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <button onClick={abrirNuevo} className="admin-btn" style={{ marginLeft: 'auto' }}>+ Nueva actividad</button>
      </div>

      {cargando ? (
        <p style={{ color: '#94a3b8', textAlign: 'center', padding: 32 }}>Cargando actividades…</p>
      ) : items.length === 0 ? (
        <div className="admin-placeholder">
          <span className="admin-placeholder-icon">⚡</span>
          <h3>Sin actividades</h3>
          <p>Añade la primera actividad pedagógica al banco.</p>
        </div>
      ) : (
        items.map((item) => (
          <ItemCard key={item.id} item={item} coleccion="bp_actividades" adminId={adminId} onEditar={abrirEditar} onRefresh={cargar} />
        ))
      )}

      {modal !== null && (
        <Modal titulo={modal.id ? 'Editar actividad' : 'Nueva actividad'} onClose={() => setModal(null)} onGuardar={guardar} guardando={guardando}>
          <Field label="Título *">
            <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ej. Retroalimentación de rutinas diarias" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Tipo">
              <Select value={form.tipo} onChange={(v) => setForm({ ...form, tipo: v })} options={BP_TIPOS_ACTIVIDAD} />
            </Field>
            <Field label="Momento">
              <Select value={form.momento} onChange={(v) => setForm({ ...form, momento: v })} options={BP_MOMENTOS} />
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Área curricular">
              <Select value={form.area} onChange={(v) => setForm({ ...form, area: v })} options={BP_AREAS} />
            </Field>
            <Field label="Duración (min)">
              <Input type="number" min={5} max={90} value={form.duracion} onChange={(e) => setForm({ ...form, duracion: e.target.value })} />
            </Field>
          </div>
          <Field label="Instrucciones (una por línea)">
            <Textarea
              rows={5}
              value={form.instrucciones}
              onChange={(e) => setForm({ ...form, instrucciones: e.target.value })}
              placeholder={"Línea 1 de la actividad\nLínea 2 de la actividad\n…"}
            />
          </Field>
          <Field label="Estrategia pedagógica">
            <Input value={form.estrategia} onChange={(e) => setForm({ ...form, estrategia: e.target.value })} placeholder="Ej. Role Play, Indagación Dialógica, ABP…" />
          </Field>
          <MultiCheck label="Grados" opciones={BP_GRADOS} seleccionados={form.grados} onChange={(v) => setForm({ ...form, grados: v })} />
        </Modal>
      )}
    </div>
  );
}

// ─── Tab: Instrumentos ────────────────────────────────────────────────────────

const INST_VACIO = { titulo: '', tipo: '', area: '', grados: [], contenido: '' };

function TabInstrumentos({ adminId }) {
  const [items, setItems]               = useState([]);
  const [cargando, setCargando]         = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroArea, setFiltroArea]     = useState('');
  const [modal, setModal]               = useState(null);
  const [form, setForm]                 = useState(INST_VACIO);
  const [guardando, setGuardando]       = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setItems(await getInstrumentos({ estado: filtroEstado || null, area: filtroArea || null }));
    setCargando(false);
  }, [filtroEstado, filtroArea]);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async () => {
    if (!form.titulo.trim()) return;
    setGuardando(true);
    try {
      if (modal.id) await updateInstrumento(modal.id, form);
      else          await createInstrumento(form, adminId);
      setModal(null);
      cargar();
    } finally { setGuardando(false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <FiltroEstado valor={filtroEstado} onChange={setFiltroEstado} />
        <FiltroArea   valor={filtroArea}   onChange={setFiltroArea} />
        <button onClick={() => { setForm(INST_VACIO); setModal({}); }} className="admin-btn" style={{ marginLeft: 'auto' }}>+ Nuevo instrumento</button>
      </div>
      {cargando ? <p style={{ color: '#94a3b8', textAlign: 'center', padding: 32 }}>Cargando…</p>
        : items.length === 0 ? (
          <div className="admin-placeholder"><span className="admin-placeholder-icon">📝</span><h3>Sin instrumentos</h3><p>Añade rúbricas, listas de cotejo y más.</p></div>
        ) : items.map((item) => (
          <ItemCard key={item.id} item={item} coleccion="bp_instrumentos" adminId={adminId}
            onEditar={(i) => { setForm({ titulo: i.titulo || '', tipo: i.tipo || '', area: i.area || '', grados: i.grados || [], contenido: i.contenido || '' }); setModal(i); }}
            onRefresh={cargar} />
        ))
      }
      {modal !== null && (
        <Modal titulo={modal.id ? 'Editar instrumento' : 'Nuevo instrumento'} onClose={() => setModal(null)} onGuardar={guardar} guardando={guardando}>
          <Field label="Título *"><Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ej. Rúbrica de Speaking - Daily Routines" /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Tipo"><Select value={form.tipo} onChange={(v) => setForm({ ...form, tipo: v })} options={BP_TIPOS_INSTRUMENTO} /></Field>
            <Field label="Área"><Select value={form.area} onChange={(v) => setForm({ ...form, area: v })} options={BP_AREAS} /></Field>
          </div>
          <Field label="Contenido / descripción">
            <Textarea rows={4} value={form.contenido} onChange={(e) => setForm({ ...form, contenido: e.target.value })} placeholder="Describe los criterios, niveles de logro…" />
          </Field>
          <MultiCheck label="Grados" opciones={BP_GRADOS} seleccionados={form.grados} onChange={(v) => setForm({ ...form, grados: v })} />
        </Modal>
      )}
    </div>
  );
}

// ─── Tab: Recursos ────────────────────────────────────────────────────────────

const REC_VACIO = { titulo: '', tipo: '', descripcion: '', area: '', grados: [], url: '' };

function TabRecursos({ adminId }) {
  const [items, setItems]               = useState([]);
  const [cargando, setCargando]         = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroArea, setFiltroArea]     = useState('');
  const [modal, setModal]               = useState(null);
  const [form, setForm]                 = useState(REC_VACIO);
  const [guardando, setGuardando]       = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setItems(await getRecursos({ estado: filtroEstado || null, area: filtroArea || null }));
    setCargando(false);
  }, [filtroEstado, filtroArea]);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async () => {
    if (!form.titulo.trim()) return;
    setGuardando(true);
    try {
      if (modal.id) await updateRecurso(modal.id, form);
      else          await createRecurso(form, adminId);
      setModal(null);
      cargar();
    } finally { setGuardando(false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <FiltroEstado valor={filtroEstado} onChange={setFiltroEstado} />
        <FiltroArea   valor={filtroArea}   onChange={setFiltroArea} />
        <button onClick={() => { setForm(REC_VACIO); setModal({}); }} className="admin-btn" style={{ marginLeft: 'auto' }}>+ Nuevo recurso</button>
      </div>
      {cargando ? <p style={{ color: '#94a3b8', textAlign: 'center', padding: 32 }}>Cargando…</p>
        : items.length === 0 ? (
          <div className="admin-placeholder"><span className="admin-placeholder-icon">🎬</span><h3>Sin recursos</h3><p>Agrega videos, audios, worksheets y más.</p></div>
        ) : items.map((item) => (
          <ItemCard key={item.id} item={item} coleccion="bp_recursos" adminId={adminId}
            onEditar={(i) => { setForm({ titulo: i.titulo || '', tipo: i.tipo || '', descripcion: i.descripcion || '', area: i.area || '', grados: i.grados || [], url: i.url || '' }); setModal(i); }}
            onRefresh={cargar} />
        ))
      }
      {modal !== null && (
        <Modal titulo={modal.id ? 'Editar recurso' : 'Nuevo recurso'} onClose={() => setModal(null)} onGuardar={guardar} guardando={guardando}>
          <Field label="Título *"><Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ej. Daily Routines Flashcards" /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Tipo"><Select value={form.tipo} onChange={(v) => setForm({ ...form, tipo: v })} options={BP_TIPOS_RECURSO} /></Field>
            <Field label="Área"><Select value={form.area} onChange={(v) => setForm({ ...form, area: v })} options={BP_AREAS} /></Field>
          </div>
          <Field label="URL del recurso">
            <Input type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" />
          </Field>
          <Field label="Descripción">
            <Textarea rows={3} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Cómo usar este recurso…" />
          </Field>
          <MultiCheck label="Grados" opciones={BP_GRADOS} seleccionados={form.grados} onChange={(v) => setForm({ ...form, grados: v })} />
        </Modal>
      )}
    </div>
  );
}

// ─── Tab: NEAE ────────────────────────────────────────────────────────────────

const NEAE_VACIO = {
  titulo: '', perfil: '', area: '', grados: [],
  adaptacionAcceso: '', adaptacionMetodologica: '', adaptacionEvaluacion: '',
};

function TabNeae({ adminId }) {
  const [items, setItems]               = useState([]);
  const [cargando, setCargando]         = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroArea, setFiltroArea]     = useState('');
  const [modal, setModal]               = useState(null);
  const [form, setForm]                 = useState(NEAE_VACIO);
  const [guardando, setGuardando]       = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setItems(await getNeae({ estado: filtroEstado || null, area: filtroArea || null }));
    setCargando(false);
  }, [filtroEstado, filtroArea]);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async () => {
    if (!form.titulo.trim()) return;
    setGuardando(true);
    try {
      if (modal.id) await updateNeae(modal.id, form);
      else          await createNeae(form, adminId);
      setModal(null);
      cargar();
    } finally { setGuardando(false); }
  };

  const abrirEditar = (i) => {
    setForm({
      titulo: i.titulo || '', perfil: i.perfil || '', area: i.area || '', grados: i.grados || [],
      adaptacionAcceso: i.adaptacionAcceso || '',
      adaptacionMetodologica: i.adaptacionMetodologica || '',
      adaptacionEvaluacion: i.adaptacionEvaluacion || '',
    });
    setModal(i);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <FiltroEstado valor={filtroEstado} onChange={setFiltroEstado} />
        <FiltroArea   valor={filtroArea}   onChange={setFiltroArea} />
        <button onClick={() => { setForm(NEAE_VACIO); setModal({}); }} className="admin-btn" style={{ marginLeft: 'auto' }}>+ Nueva adaptación</button>
      </div>
      {cargando ? <p style={{ color: '#94a3b8', textAlign: 'center', padding: 32 }}>Cargando…</p>
        : items.length === 0 ? (
          <div className="admin-placeholder"><span className="admin-placeholder-icon">♿</span><h3>Sin adaptaciones NEAE</h3><p>Registra adaptaciones para estudiantes con necesidades específicas.</p></div>
        ) : items.map((item) => (
          <ItemCard key={item.id} item={item} coleccion="bp_neae" adminId={adminId} onEditar={abrirEditar} onRefresh={cargar} />
        ))
      }
      {modal !== null && (
        <Modal titulo={modal.id ? 'Editar adaptación' : 'Nueva adaptación NEAE'} onClose={() => setModal(null)} onGuardar={guardar} guardando={guardando}>
          <Field label="Título *"><Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ej. Adaptación para estudiante con dislexia — Inglés" /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Perfil NEAE">
              <Input value={form.perfil} onChange={(e) => setForm({ ...form, perfil: e.target.value })} placeholder="Ej. Dislexia, TDAH, Hipoacusia…" />
            </Field>
            <Field label="Área"><Select value={form.area} onChange={(v) => setForm({ ...form, area: v })} options={BP_AREAS} /></Field>
          </div>
          <Field label="Adaptación de acceso">
            <Textarea rows={2} value={form.adaptacionAcceso} onChange={(e) => setForm({ ...form, adaptacionAcceso: e.target.value })} placeholder="Materiales, espacio físico, tecnología de apoyo…" />
          </Field>
          <Field label="Adaptación metodológica">
            <Textarea rows={2} value={form.adaptacionMetodologica} onChange={(e) => setForm({ ...form, adaptacionMetodologica: e.target.value })} placeholder="Estrategias, tiempos, agrupaciones…" />
          </Field>
          <Field label="Adaptación de evaluación">
            <Textarea rows={2} value={form.adaptacionEvaluacion} onChange={(e) => setForm({ ...form, adaptacionEvaluacion: e.target.value })} placeholder="Instrumentos alternativos, criterios ajustados…" />
          </Field>
          <MultiCheck label="Grados" opciones={BP_GRADOS} seleccionados={form.grados} onChange={(v) => setForm({ ...form, grados: v })} />
        </Modal>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AdminBancoPedagogico() {
  const { user } = useAuth();
  const [tab, setTab] = useState('temas');
  const adminId = user?.uid || 'admin';

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h2>Banco Pedagógico</h2>
          <p>Gestión centralizada de temas, actividades, instrumentos, recursos y adaptaciones NEAE.</p>
        </div>
      </div>

      {/* Pestañas */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '2px solid #e2e8f0', paddingBottom: 0 }}>
        {TABS.map(({ id, icon, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 18px', fontSize: 14, fontWeight: tab === id ? 700 : 500,
              color: tab === id ? '#2563eb' : '#64748b',
              borderBottom: tab === id ? '3px solid #2563eb' : '3px solid transparent',
              marginBottom: -2, borderRadius: '8px 8px 0 0',
              transition: 'color 0.15s',
            }}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* Contenido de cada pestaña */}
      {tab === 'temas'        && <TabTemas        adminId={adminId} />}
      {tab === 'actividades'  && <TabActividades  adminId={adminId} />}
      {tab === 'instrumentos' && <TabInstrumentos adminId={adminId} />}
      {tab === 'recursos'     && <TabRecursos     adminId={adminId} />}
      {tab === 'neae'         && <TabNeae         adminId={adminId} />}
    </div>
  );
}
