import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BC_SOURCE_TYPES, BC_BANK_TYPES, BC_LEVELS, BC_GRADES, BC_AREAS,
  BC_SUBJECTS_BY_AREA,
  BC_ORIGIN_TYPES, BC_STATUSES, BC_CONTENT_FORMATS,
  getKnowledgeSources, createKnowledgeSource, updateKnowledgeSource,
  updateKnowledgeSourceStatus, deleteKnowledgeSource, uploadKnowledgePDF,
  validateJsonSobre, createCurricularContent, attachJsonToSource,
} from '../../services/bancoConocimientoService.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtFecha = (ts) => {
  if (!ts) return '—';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtBytes = (n) => {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

const FORM_EMPTY = {
  title: '', description: '',
  sourceType: 'diseno_curricular', bankType: 'oficial',
  level: '', grade: '', area: '', subject: '',
  originType: 'pdf',
  fileUrl: '', fileName: '', fileSize: 0,
  url: '', manualContent: '',
  jsonText: '',
  isOfficial: true,
  status: 'pending',
};

const STATUS_FLOW = {
  pending:    ['processing', 'rejected', 'archived'],
  processing: ['reviewed',  'rejected', 'archived'],
  reviewed:   ['approved',  'rejected', 'archived'],
  approved:   ['published', 'rejected', 'archived'],
  published:  ['archived'],
  rejected:   ['pending',   'archived'],
  archived:   ['pending'],
};

// ─── Badges ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const s = BC_STATUSES[status] || { label: status, color: '#f1f5f9', text: '#64748b' };
  return (
    <span style={{
      background: s.color, color: s.text,
      borderRadius: 6, padding: '2px 10px',
      fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  );
}

function ContentFormatBadge({ contentFormat }) {
  const cf = contentFormat || 'unstructured';
  const s = BC_CONTENT_FORMATS[cf] || BC_CONTENT_FORMATS.unstructured;
  return (
    <span style={{
      background: s.color, color: s.text,
      borderRadius: 6, padding: '2px 8px',
      fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  );
}

function OriginBadge({ type }) {
  const icons  = { pdf: '📄', url: '🔗', manual: '✏️', json: '{ }' };
  const labels = { pdf: 'PDF', url: 'Enlace', manual: 'Manual', json: 'JSON' };
  return (
    <span style={{ fontSize: 12, color: '#64748b', fontFamily: type === 'json' ? 'monospace' : 'inherit' }}>
      {icons[type] || '?'} {labels[type] || type}
    </span>
  );
}

// ─── Preview de JSON validado ─────────────────────────────────────────────────

function JsonPreviewBox({ result }) {
  if (!result) return null;
  if (!result.ok) {
    return (
      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginTop: 8 }}>
        <div style={{ fontWeight: 700, color: '#dc2626', fontSize: 12, marginBottom: 4 }}>JSON inválido</div>
        <div style={{ fontSize: 12, color: '#7f1d1d' }}>{result.error}</div>
      </div>
    );
  }
  const { parsed } = result;
  const filas = [
    ['schemaVersion', 'Versión schema'],
    ['level',         'Nivel'],
    ['cycle',         'Ciclo'],
    ['grade',         'Grado'],
    ['area',          'Área'],
    ['subject',       'Asignatura'],
    ['contentType',   'Tipo de contenido'],
  ];
  return (
    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 14px', marginTop: 8 }}>
      <div style={{ fontWeight: 700, color: '#15803d', fontSize: 12, marginBottom: 8 }}>
        JSON válido — declaración del sobre
      </div>
      <table style={{ fontSize: 12, borderCollapse: 'collapse', width: '100%' }}>
        <tbody>
          {filas.map(([key, label]) => parsed[key] != null && (
            <tr key={key}>
              <td style={{ color: '#64748b', paddingRight: 12, paddingBottom: 3, whiteSpace: 'nowrap' }}>{label}</td>
              <td style={{ fontWeight: 600, color: '#1e293b', fontFamily: 'monospace' }}>{String(parsed[key])}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 8, fontSize: 11, color: '#64748b' }}>
        Tamaño del payload: ~{(JSON.stringify(parsed).length / 1024).toFixed(1)} KB
      </div>
    </div>
  );
}

// ─── Panel Adjuntar JSON (para fuentes existentes) ────────────────────────────

function AdjuntarJsonPanel({ fuente, onConfirmar, onCancelar, guardando }) {
  const [jsonText, setJsonText]       = useState('');
  const [preview, setPreview]         = useState(null);
  const [errFile, setErrFile]         = useState('');

  const validar = () => {
    const res = validateJsonSobre(jsonText);
    setPreview(res);
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.json')) { setErrFile('Solo archivos .json'); return; }
    setErrFile('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      setJsonText(text);
      setPreview(validateJsonSobre(text));
    };
    reader.readAsText(file);
  };

  const puedeConfirmar = preview?.ok === true;

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Fuente destino</div>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{fuente.title || '(sin título)'}</div>
        <div style={{ fontSize: 11, color: '#64748b' }}>{BC_SOURCE_TYPES[fuente.sourceType]} · {fuente.level} {fuente.grade}</div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
          Cargar archivo .json
        </label>
        <input type="file" accept=".json" onChange={handleFile} style={{ fontSize: 13 }} />
        {errFile && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#dc2626' }}>{errFile}</p>}
      </div>

      <div style={{ marginBottom: 10 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
          O pegar JSON directamente
        </label>
        <textarea
          value={jsonText}
          onChange={e => { setJsonText(e.target.value); setPreview(null); }}
          placeholder={'{\n  "schemaVersion": "1.0",\n  "level": "Secundaria",\n  ...\n}'}
          style={{
            width: '100%', minHeight: 160, padding: '8px 10px',
            borderRadius: 8, border: '1px solid #e2e8f0',
            fontSize: 12, fontFamily: 'monospace', resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <button
        type="button"
        onClick={validar}
        disabled={!jsonText.trim()}
        style={{
          padding: '7px 16px', borderRadius: 8, border: '1px solid #94a3b8',
          background: '#f8fafc', fontSize: 13, cursor: 'pointer', marginBottom: 4,
          opacity: !jsonText.trim() ? 0.5 : 1,
        }}>
        Validar JSON
      </button>

      <JsonPreviewBox result={preview} />

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
        <button type="button" onClick={onCancelar}
          style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
          Cancelar
        </button>
        <button
          type="button"
          disabled={!puedeConfirmar || guardando}
          onClick={() => onConfirmar(jsonText)}
          style={{
            padding: '8px 20px', borderRadius: 8,
            background: puedeConfirmar ? '#15803d' : '#94a3b8',
            color: '#fff', border: 'none', cursor: puedeConfirmar ? 'pointer' : 'default',
            fontWeight: 700, fontSize: 13, opacity: guardando ? 0.6 : 1,
          }}>
          {guardando ? 'Vinculando…' : 'Confirmar y vincular'}
        </button>
      </div>
    </div>
  );
}

// ─── Formulario de fuente ─────────────────────────────────────────────────────

function FuenteForm({ inicial, onGuardar, onCancelar, guardando }) {
  const [form, setForm]               = useState(inicial || FORM_EMPTY);
  const [subiendo, setSubiendo]       = useState(false);
  const [errSubida, setErrSubida]     = useState('');
  const [jsonPreview, setJsonPreview] = useState(null);
  const jsonTextRef                   = useRef(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { setErrSubida('Solo se permiten archivos PDF.'); return; }
    if (file.size > 30 * 1024 * 1024) { setErrSubida('El archivo no puede superar 30 MB.'); return; }
    setErrSubida('');
    setSubiendo(true);
    try {
      const res = await uploadKnowledgePDF(file);
      setForm(f => ({ ...f, fileUrl: res.url, fileName: res.fileName, fileSize: res.fileSize }));
    } catch (err) {
      setErrSubida(`Error al subir: ${err.message}`);
    } finally {
      setSubiendo(false);
    }
  };

  const handleJsonFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.json')) { setErrSubida('Solo archivos .json'); return; }
    setErrSubida('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      if (jsonTextRef.current) jsonTextRef.current.value = text;
      setJsonPreview(validateJsonSobre(text));
    };
    reader.readAsText(file);
  };

  const handleValidarJson = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const text = jsonTextRef.current?.value || '';
    setJsonPreview(validateJsonSobre(text));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    if (form.originType === 'json') {
      const text = jsonTextRef.current?.value || '';
      const res = jsonPreview?.ok ? jsonPreview : validateJsonSobre(text);
      if (!res.ok) { setJsonPreview(res); return; }
      onGuardar({ ...form, _jsonParsed: res.parsed });
    } else {
      onGuardar(form);
    }
  };

  const campo = {
    label: (txt, req) => (
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
        {txt}{req && <span style={{ color: '#dc2626' }}> *</span>}
      </label>
    ),
    input: (props) => (
      <input {...props} style={{
        width: '100%', padding: '8px 10px', borderRadius: 8,
        border: '1px solid #e2e8f0', fontSize: 13, boxSizing: 'border-box',
        ...props.style,
      }} />
    ),
    select: (props, children) => (
      <select {...props} style={{
        width: '100%', padding: '8px 10px', borderRadius: 8,
        border: '1px solid #e2e8f0', fontSize: 13, background: '#fff',
        ...props.style,
      }}>
        {children}
      </select>
    ),
    textarea: (props) => (
      <textarea {...props} style={{
        width: '100%', padding: '8px 10px', borderRadius: 8,
        border: '1px solid #e2e8f0', fontSize: 13, resize: 'vertical',
        minHeight: 80, boxSizing: 'border-box', ...props.style,
      }} />
    ),
  };

  const row2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 };
  const grup = { marginBottom: 14 };

  const canSubmit = !guardando && !subiendo;

  return (
    <form onSubmit={handleSubmit}>
      {/* Título */}
      <div style={grup}>
        {campo.label('Título', true)}
        {campo.input({
          value: form.title,
          onChange: e => set('title', e.target.value),
          placeholder: 'Ej. Diseño Curricular Inglés 2do Secundaria',
          required: true,
        })}
      </div>

      {/* Descripción */}
      <div style={grup}>
        {campo.label('Descripción')}
        {campo.textarea({
          value: form.description,
          onChange: e => set('description', e.target.value),
          placeholder: 'Descripción breve de la fuente...',
          rows: 2,
        })}
      </div>

      {/* Tipo fuente + tipo banco */}
      <div style={{ ...row2, ...grup }}>
        <div>
          {campo.label('Tipo de fuente', true)}
          {campo.select(
            { value: form.sourceType, onChange: e => set('sourceType', e.target.value) },
            Object.entries(BC_SOURCE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)
          )}
        </div>
        <div>
          {campo.label('Banco', true)}
          {campo.select(
            { value: form.bankType, onChange: e => set('bankType', e.target.value) },
            Object.entries(BC_BANK_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)
          )}
        </div>
      </div>

      {/* Nivel + Grado */}
      <div style={{ ...row2, ...grup }}>
        <div>
          {campo.label('Nivel')}
          {campo.select(
            { value: form.level, onChange: e => set('level', e.target.value) },
            [<option key="" value="">— Todos —</option>,
             ...BC_LEVELS.map(v => <option key={v} value={v}>{v}</option>)]
          )}
        </div>
        <div>
          {campo.label('Grado')}
          {campo.select(
            { value: form.grade, onChange: e => set('grade', e.target.value) },
            [<option key="" value="">— Todos —</option>,
             ...BC_GRADES.map(v => <option key={v} value={v}>{v}</option>)]
          )}
        </div>
      </div>

      {/* Área + Asignatura */}
      <div style={{ ...row2, ...grup }}>
        <div>
          {campo.label('Área')}
          {campo.select(
            { value: form.area, onChange: e => { set('area', e.target.value); set('subject', ''); } },
            [<option key="" value="">— Seleccionar —</option>,
             ...BC_AREAS.map(v => <option key={v} value={v}>{v}</option>)]
          )}
        </div>
        <div>
          {campo.label('Asignatura')}
          {BC_SUBJECTS_BY_AREA[form.area]
            ? campo.select(
                { value: form.subject, onChange: e => set('subject', e.target.value) },
                [<option key="" value="">— Seleccionar —</option>,
                 ...BC_SUBJECTS_BY_AREA[form.area].map(v => <option key={v} value={v}>{v}</option>)]
              )
            : campo.input({
                value: form.subject,
                onChange: e => set('subject', e.target.value),
                placeholder: 'Ej. Lengua Española I',
              })
          }
        </div>
      </div>

      {/* Tipo de origen */}
      <div style={grup}>
        {campo.label('Origen del contenido', true)}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 4 }}>
          {Object.entries(BC_ORIGIN_TYPES).map(([k, v]) => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
              <input type="radio" name="originType" value={k}
                checked={form.originType === k}
                onChange={() => { set('originType', k); setJsonPreview(null); }} />
              {v}
            </label>
          ))}
        </div>
      </div>

      {/* Campo dinámico según origen */}
      {form.originType === 'pdf' && (
        <div style={grup}>
          {campo.label('Archivo PDF')}
          {form.fileUrl ? (
            <div style={{
              background: '#f0fdf4', border: '1px solid #bbf7d0',
              borderRadius: 8, padding: '10px 14px',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 20 }}>📄</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{form.fileName}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{fmtBytes(form.fileSize)}</div>
              </div>
              <button type="button" onClick={() => setForm(f => ({ ...f, fileUrl: '', fileName: '', fileSize: 0 }))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 16 }}>
                ✕
              </button>
            </div>
          ) : (
            <>
              <input type="file" accept=".pdf" onChange={handleFile}
                style={{ display: 'block', fontSize: 13 }} disabled={subiendo} />
              {subiendo && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#0369a1' }}>Subiendo PDF...</p>}
              {errSubida && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#dc2626' }}>{errSubida}</p>}
            </>
          )}
        </div>
      )}

      {form.originType === 'url' && (
        <div style={grup}>
          {campo.label('URL del documento', true)}
          {campo.input({
            type: 'url',
            value: form.url,
            onChange: e => set('url', e.target.value),
            placeholder: 'https://minerd.gob.do/...',
          })}
        </div>
      )}

      {form.originType === 'manual' && (
        <div style={grup}>
          {campo.label('Contenido manual')}
          {campo.textarea({
            value: form.manualContent,
            onChange: e => set('manualContent', e.target.value),
            placeholder: 'Escribe o pega el contenido aquí...',
            rows: 5,
          })}
        </div>
      )}

      {form.originType === 'json' && (
        <div style={grup}>
          {campo.label('JSON estructurado', true)}
          <div style={{ marginBottom: 8 }}>
            <input type="file" accept=".json" onChange={handleJsonFile} style={{ fontSize: 13 }} />
            {errSubida && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#dc2626' }}>{errSubida}</p>}
          </div>
          <div style={{ marginBottom: 6, fontSize: 12, color: '#94a3b8' }}>O pegar el JSON directamente:</div>
          <textarea
            ref={jsonTextRef}
            defaultValue=""
            onChange={() => setJsonPreview(null)}
            placeholder={'{\n  "schemaVersion": "1.0",\n  "level": "Secundaria",\n  "grade": "2do",\n  "area": "Inglés",\n  "subject": "Inglés II",\n  "contentType": "malla_curricular",\n  ...\n}'}
            rows={8}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 8,
              border: '1px solid #334155',
              fontSize: 12, fontFamily: 'monospace',
              resize: 'vertical', boxSizing: 'border-box',
              color: '#f1f5f9', background: '#1e293b',
            }}
          />
          <button
            type="button"
            onClick={handleValidarJson}
            style={{
              marginTop: 8, padding: '8px 18px', borderRadius: 8,
              border: '1px solid #6366f1', background: '#6366f1', color: '#fff',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>
            Validar JSON
          </button>
          <JsonPreviewBox result={jsonPreview} />
          {jsonPreview === null && (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#94a3b8' }}>
              Pega o carga el JSON y luego haz clic en "Validar JSON".
            </p>
          )}
        </div>
      )}

      {/* Oficial */}
      <div style={{ ...grup, display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" id="isOfficial"
          checked={form.isOfficial}
          onChange={e => set('isOfficial', e.target.checked)} />
        <label htmlFor="isOfficial" style={{ fontSize: 13, cursor: 'pointer' }}>
          Marcar como fuente oficial MINERD
        </label>
      </div>

      {/* Acciones */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
        <button type="button" onClick={onCancelar}
          style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
          Cancelar
        </button>
        <button type="submit" disabled={!canSubmit}
          style={{ padding: '8px 20px', borderRadius: 8, background: '#1d4ed8', color: '#fff', border: 'none', cursor: canSubmit ? 'pointer' : 'default', fontWeight: 600, fontSize: 13, opacity: canSubmit ? 1 : 0.5 }}>
          {guardando ? 'Guardando…' : 'Guardar fuente'}
        </button>
      </div>
    </form>
  );
}

// ─── Fila de la tabla ─────────────────────────────────────────────────────────

function FuenteRow({ f, onEdit, onStatusChange, onDelete, onAdjuntarJson }) {
  const siguientes = STATUS_FLOW[f.status] || [];
  const esEstructurada = (f.contentFormat || 'unstructured') === 'structured';
  const puedeAdjuntar  = f.originType !== 'json' && !esEstructurada;

  return (
    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
      <td style={{ padding: '10px 12px', maxWidth: 220 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{f.title || '(sin título)'}</div>
        <div style={{ fontSize: 11, color: '#64748b' }}>
          {BC_SOURCE_TYPES[f.sourceType] || f.sourceType}
          {f.isOfficial && <span style={{ marginLeft: 6, background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>MINERD</span>}
        </div>
      </td>
      <td style={{ padding: '10px 12px', fontSize: 12, color: '#374151' }}>
        <div>{f.level || '—'}</div>
        <div style={{ color: '#64748b' }}>{f.grade || ''}</div>
      </td>
      <td style={{ padding: '10px 12px', fontSize: 12, color: '#374151' }}>{f.area || '—'}</td>
      <td style={{ padding: '10px 12px' }}>
        <span style={{
          background: f.bankType === 'oficial' ? '#eff6ff' : '#faf5ff',
          color: f.bankType === 'oficial' ? '#1d4ed8' : '#7c3aed',
          padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
        }}>
          {BC_BANK_TYPES[f.bankType] || f.bankType}
        </span>
      </td>
      <td style={{ padding: '10px 12px' }}><OriginBadge type={f.originType} /></td>
      <td style={{ padding: '10px 12px' }}><ContentFormatBadge contentFormat={f.contentFormat} /></td>
      <td style={{ padding: '10px 12px' }}><StatusBadge status={f.status} /></td>
      <td style={{ padding: '10px 12px', fontSize: 11, color: '#64748b' }}>{fmtFecha(f.createdAt)}</td>
      <td style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', position: 'relative' }}>
          <button onClick={() => onEdit(f)}
            style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 12, cursor: 'pointer' }}>
            Editar
          </button>

          {puedeAdjuntar && (
            <button onClick={() => onAdjuntarJson(f)}
              style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#15803d', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
              + JSON
            </button>
          )}

          {siguientes.length > 0 && (
            <select
              value=""
              onChange={e => { if (e.target.value) onStatusChange(f.id, e.target.value); }}
              style={{
                padding: '4px 8px', borderRadius: 6, border: '1px solid #e2e8f0',
                background: '#f8fafc', color: '#374151', fontSize: 12, cursor: 'pointer',
              }}
            >
              <option value="">Estado ▾</option>
              {siguientes.map(s => (
                <option key={s} value={s}>{BC_STATUSES[s]?.label || s}</option>
              ))}
            </select>
          )}

          <button onClick={() => { if (window.confirm('¿Eliminar esta fuente?')) onDelete(f.id); }}
            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #fee2e2', background: '#fff', color: '#dc2626', fontSize: 12, cursor: 'pointer' }}>
            ✕
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

const TABS = [
  { id: 'todas',      label: 'Todas' },
  { id: 'pendientes', label: 'Pendientes' },
  { id: 'publicadas', label: 'Publicadas' },
  { id: 'archivadas', label: 'Archivadas' },
];

const TAB_STATUSES = {
  todas:      null,
  pendientes: ['pending', 'processing', 'reviewed'],
  publicadas: ['approved', 'published'],
  archivadas: ['archived', 'rejected'],
};

export default function AdminBancoConocimiento() {
  const [fuentes, setFuentes]       = useState([]);
  const [cargando, setCargando]     = useState(true);
  const [tab, setTab]               = useState('todas');
  const [modal, setModal]           = useState(null); // null | 'crear' | 'editar' | 'adjuntar-json'
  const [editando, setEditando]     = useState(null);
  const [adjuntandoA, setAdjuntandoA] = useState(null);
  const [guardando, setGuardando]   = useState(false);
  const [error, setError]           = useState('');
  const [filtros, setFiltros]       = useState({ nivel: '', grado: '', area: '', bankType: '', contentFormat: '' });

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const data = await getKnowledgeSources();
      setFuentes(data);
    } catch (err) {
      setError('Error al cargar fuentes: ' + err.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const fuentesFiltradas = fuentes.filter(f => {
    const tabStatuses = TAB_STATUSES[tab];
    if (tabStatuses && !tabStatuses.includes(f.status)) return false;
    if (filtros.nivel         && f.level    !== filtros.nivel)                               return false;
    if (filtros.grado         && f.grade    !== filtros.grado)                               return false;
    if (filtros.area          && f.area     !== filtros.area)                                return false;
    if (filtros.bankType      && f.bankType !== filtros.bankType)                            return false;
    if (filtros.contentFormat && (f.contentFormat || 'unstructured') !== filtros.contentFormat) return false;
    return true;
  });

  const handleGuardar = async (form) => {
    setGuardando(true);
    setError('');
    try {
      if (modal === 'crear') {
        if (form.originType === 'json' && form._jsonParsed) {
          const { _jsonParsed, ...sourceData } = form;
          const sourceId = await createKnowledgeSource({
            ...sourceData,
            contentFormat: 'structured',
            processingStatus: 'structured',
            schemaVersion: _jsonParsed.schemaVersion,
            extractionMethod: 'manual',
          });
          await createCurricularContent({ sourceId, parsed: _jsonParsed });
        } else {
          await createKnowledgeSource({ ...form, contentFormat: 'unstructured' });
        }
      } else if (modal === 'editar' && editando) {
        await updateKnowledgeSource(editando.id, form);
      }
      await cargar();
      setModal(null);
      setEditando(null);
    } catch (err) {
      setError('Error al guardar: ' + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleAdjuntarJson = async (jsonText) => {
    if (!adjuntandoA) return;
    setGuardando(true);
    setError('');
    try {
      await attachJsonToSource(adjuntandoA.id, jsonText);
      await cargar();
      setModal(null);
      setAdjuntandoA(null);
    } catch (err) {
      setError('Error al vincular JSON: ' + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await updateKnowledgeSourceStatus(id, status);
      setFuentes(prev => prev.map(f => f.id === id ? { ...f, status } : f));
    } catch (err) {
      setError('Error al cambiar estado: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteKnowledgeSource(id);
      setFuentes(prev => prev.filter(f => f.id !== id));
    } catch (err) {
      setError('Error al eliminar: ' + err.message);
    }
  };

  const abrirEditar = (f) => { setEditando(f); setModal('editar'); };

  const abrirAdjuntarJson = (f) => { setAdjuntandoA(f); setModal('adjuntar-json'); };

  const cerrarModal = () => { setModal(null); setEditando(null); setAdjuntandoA(null); };

  const conteo = (tabId) => {
    const s = TAB_STATUSES[tabId];
    if (!s) return fuentes.length;
    return fuentes.filter(f => s.includes(f.status)).length;
  };

  const hayFiltros = Object.values(filtros).some(Boolean);
  const sel = { borderRadius: 8, border: '1px solid #e2e8f0', padding: '7px 10px', fontSize: 13, background: '#fff' };

  const tituloModal = {
    'crear':        'Nueva fuente',
    'editar':       'Editar fuente',
    'adjuntar-json': 'Adjuntar JSON estructurado',
  };

  return (
    <div style={{ padding: '0 0 40px', color: '#1e293b' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Banco de Conocimiento</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Gestiona las fuentes oficiales y pedagógicas que alimentan DocenteOS
          </p>
        </div>
        <button
          onClick={() => { setEditando(null); setModal('crear'); }}
          style={{
            background: '#1d4ed8', color: '#fff', border: 'none',
            borderRadius: 9, padding: '10px 20px', fontWeight: 700,
            fontSize: 14, cursor: 'pointer',
          }}>
          + Nueva fuente
        </button>
      </div>

      {/* Tarjetas resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total fuentes',   value: fuentes.length,                                                icon: '📚', color: '#eff6ff', border: '#bfdbfe' },
          { label: 'Pendientes',      value: conteo('pendientes'),                                          icon: '⏳', color: '#fef9c3', border: '#fde68a' },
          { label: 'Estructuradas',   value: fuentes.filter(f => f.contentFormat === 'structured').length,  icon: '{ }', color: '#dcfce7', border: '#bbf7d0' },
          { label: 'Oficiales',       value: fuentes.filter(f => f.isOfficial).length,                      icon: '🏛️', color: '#ede9fe', border: '#c4b5fd' },
        ].map(({ label, value, icon, color, border }) => (
          <div key={label} style={{ background: color, border: `1px solid ${border}`, borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ fontSize: 22, fontFamily: icon === '{ }' ? 'monospace' : 'inherit' }}>{icon}</div>
            <div style={{ fontSize: 26, fontWeight: 800, margin: '4px 0 2px' }}>{value}</div>
            <div style={{ fontSize: 12, color: '#374151' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
          {error}
          <button onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>✕</button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '2px solid #e2e8f0' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '8px 16px', background: 'none', border: 'none',
              borderBottom: tab === t.id ? '2px solid #1d4ed8' : '2px solid transparent',
              marginBottom: -2, color: tab === t.id ? '#1d4ed8' : '#64748b',
              fontWeight: tab === t.id ? 700 : 400, cursor: 'pointer', fontSize: 13,
            }}>
            {t.label}
            <span style={{
              marginLeft: 6, background: tab === t.id ? '#dbeafe' : '#f1f5f9',
              color: tab === t.id ? '#1d4ed8' : '#94a3b8',
              borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700,
            }}>
              {conteo(t.id)}
            </span>
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <select value={filtros.nivel} onChange={e => setFiltros(f => ({ ...f, nivel: e.target.value }))} style={sel}>
          <option value="">Todos los niveles</option>
          {BC_LEVELS.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <select value={filtros.grado} onChange={e => setFiltros(f => ({ ...f, grado: e.target.value }))} style={sel}>
          <option value="">Todos los grados</option>
          {BC_GRADES.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <select value={filtros.area} onChange={e => setFiltros(f => ({ ...f, area: e.target.value }))} style={sel}>
          <option value="">Todas las áreas</option>
          {BC_AREAS.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <select value={filtros.bankType} onChange={e => setFiltros(f => ({ ...f, bankType: e.target.value }))} style={sel}>
          <option value="">Oficial y Pedagógico</option>
          {Object.entries(BC_BANK_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filtros.contentFormat} onChange={e => setFiltros(f => ({ ...f, contentFormat: e.target.value }))} style={sel}>
          <option value="">Referencia y Estructurado</option>
          {Object.entries(BC_CONTENT_FORMATS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {hayFiltros && (
          <button onClick={() => setFiltros({ nivel: '', grado: '', area: '', bankType: '', contentFormat: '' })}
            style={{ ...sel, background: '#fee2e2', border: '1px solid #fecaca', color: '#dc2626', cursor: 'pointer' }}>
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Tabla */}
      {cargando ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#64748b', fontSize: 14 }}>Cargando fuentes…</div>
      ) : fuentesFiltradas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>No hay fuentes registradas</div>
          <div style={{ fontSize: 13 }}>Comienza agregando una nueva fuente con el botón de arriba</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #e2e8f0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                {['Fuente', 'Nivel / Grado', 'Área', 'Banco', 'Origen', 'Formato', 'Estado', 'Fecha', 'Acciones'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fuentesFiltradas.map(f => (
                <FuenteRow
                  key={f.id}
                  f={f}
                  onEdit={abrirEditar}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                  onAdjuntarJson={abrirAdjuntarJson}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal lateral */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)' }} onClick={cerrarModal} />
          <div style={{
            position: 'relative', zIndex: 1,
            width: '100%', maxWidth: modal === 'adjuntar-json' ? 480 : 520,
            background: '#fff', overflowY: 'auto',
            padding: 28, boxShadow: '-4px 0 24px rgba(0,0,0,.15)',
            color: '#1e293b',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{tituloModal[modal]}</h3>
              <button onClick={cerrarModal} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            {(modal === 'crear' || modal === 'editar') && (
              <FuenteForm
                inicial={editando || FORM_EMPTY}
                onGuardar={handleGuardar}
                onCancelar={cerrarModal}
                guardando={guardando}
              />
            )}

            {modal === 'adjuntar-json' && adjuntandoA && (
              <AdjuntarJsonPanel
                fuente={adjuntandoA}
                onConfirmar={handleAdjuntarJson}
                onCancelar={cerrarModal}
                guardando={guardando}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
