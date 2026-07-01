import { useState, useEffect, useRef, useCallback } from 'react';
import {
  cargarConversaciones, cargarMensajes, crearConversacion,
  enviarMensaje, cargarMemorias, borrarMemoria, getUsoMensual,
  LIMITE_MENSAJES_MES,
} from '../services/ai/personalChatService.js';
import './AsistentePersonalPage.css';

// ─── Componente de mensaje ────────────────────────────────────────────────────

function Mensaje({ msg, streaming }) {
  const esIA = msg.rol === 'assistant';
  return (
    <div className={`ap-msg ${esIA ? 'ap-msg-ia' : 'ap-msg-user'}`}>
      <div className="ap-msg-avatar">{esIA ? '🤖' : '👤'}</div>
      <div className="ap-msg-burbuja">
        {msg.contenido.split('\n').map((linea, i) => (
          <p key={i} style={{ margin: '0 0 4px' }}>{linea || ' '}</p>
        ))}
        {streaming && <span className="ap-cursor">▋</span>}
      </div>
    </div>
  );
}

// ─── Barra de uso ─────────────────────────────────────────────────────────────

function BarraUso({ uso }) {
  const pct = Math.min(100, Math.round(((uso?.mensajes || 0) / LIMITE_MENSAJES_MES) * 100));
  const color = pct >= 90 ? '#dc2626' : pct >= 70 ? '#d97706' : '#059669';
  return (
    <div className="ap-uso">
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 4 }}>
        <span>Mensajes este mes</span>
        <strong style={{ color }}>{uso?.mensajes || 0} / {LIMITE_MENSAJES_MES}</strong>
      </div>
      <div style={{ background: '#e2e8f0', borderRadius: 999, height: 5, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: 999, transition: 'width 0.3s' }} />
      </div>
      {uso?.costoEstimadoUSD > 0 && (
        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3, textAlign: 'right' }}>
          ~${uso.costoEstimadoUSD.toFixed(3)} estimado
        </div>
      )}
    </div>
  );
}

// ─── Panel de memorias ────────────────────────────────────────────────────────

function PanelMemorias({ userId, visible, onToggle }) {
  const [memorias, setMemorias]     = useState([]);
  const [cargando, setCargando]     = useState(false);

  useEffect(() => {
    if (!visible || !userId) return;
    setCargando(true);
    cargarMemorias(userId)
      .then(setMemorias)
      .finally(() => setCargando(false));
  }, [visible, userId]);

  const eliminar = async (id) => {
    await borrarMemoria(userId, id);
    setMemorias((prev) => prev.filter((m) => m.id !== id));
  };

  const colorCategoria = { personal: '#eff6ff', preferencia: '#faf5ff', profesional: '#f0fdf4' };
  const textCategoria  = { personal: '#1d4ed8', preferencia: '#7c3aed', profesional: '#15803d' };

  return (
    <div className="ap-memorias-panel">
      <button className="ap-memorias-toggle" onClick={onToggle}>
        🧠 Lo que recuerdo de ti
        <span className="ap-mem-count">{memorias.length || ''}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12 }}>{visible ? '▲' : '▼'}</span>
      </button>
      {visible && (
        <div className="ap-memorias-lista">
          {cargando ? (
            <p style={{ padding: '8px 12px', color: '#94a3b8', fontSize: 12 }}>Cargando…</p>
          ) : memorias.length === 0 ? (
            <p style={{ padding: '8px 12px', color: '#94a3b8', fontSize: 12 }}>
              Aún no tengo nada guardado. Mientras más conversemos, más aprendo sobre ti.
            </p>
          ) : (
            memorias.map((m) => (
              <div key={m.id} className="ap-memoria-item">
                <span style={{
                  background: colorCategoria[m.categoria] || '#f1f5f9',
                  color:      textCategoria[m.categoria]  || '#64748b',
                  borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700, marginRight: 6, flexShrink: 0,
                }}>
                  {m.categoria || 'personal'}
                </span>
                <span style={{ flex: 1, fontSize: 12, color: '#334155' }}>{m.hecho}</span>
                <button onClick={() => eliminar(m.id)} className="ap-mem-delete" title="Olvidar este dato">✕</button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AsistentePersonalPage({ userId, planPersonal }) {
  const [conversaciones, setConversaciones] = useState([]);
  const [chatActivo, setChatActivo]         = useState(null);
  const [mensajes, setMensajes]             = useState([]);
  const [inputTexto, setInputTexto]         = useState('');
  const [enviando, setEnviando]             = useState(false);
  const [streamingTexto, setStreamingTexto] = useState('');
  const [uso, setUso]                       = useState(null);
  const [memoriasVisible, setMemoriasVisible] = useState(false);
  const [cargandoConvs, setCargandoConvs]   = useState(true);
  const [errorMsg, setErrorMsg]             = useState('');

  const messagesEndRef = useRef(null);
  const textareaRef    = useRef(null);

  // Scroll al fondo
  const scrollDown = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollDown(); }, [mensajes, streamingTexto]);

  const abrirConversacion = useCallback(async (chatId) => {
    setChatActivo(chatId);
    const msgs = await cargarMensajes(userId, chatId);
    setMensajes(msgs);
    setErrorMsg('');
  }, [userId]);

  // Cargar conversaciones y uso al montar
  useEffect(() => {
    if (!userId) return;
    Promise.all([
      cargarConversaciones(userId),
      getUsoMensual(userId),
    ]).then(([convs, usoData]) => {
      setConversaciones(convs);
      setUso(usoData);
      // Abrir la primera conversación si existe
      if (convs.length > 0) abrirConversacion(convs[0].id);
    }).finally(() => setCargandoConvs(false));
  }, [userId, abrirConversacion]);

  const nuevaConversacion = async () => {
    const chatId = await crearConversacion(userId);
    const convs  = await cargarConversaciones(userId);
    setConversaciones(convs);
    setChatActivo(chatId);
    setMensajes([]);
    setErrorMsg('');
    textareaRef.current?.focus();
  };

  const enviar = async () => {
    const texto = inputTexto.trim();
    if (!texto || enviando || !chatActivo) return;

    setInputTexto('');
    setEnviando(true);
    setErrorMsg('');

    // Optimistic: mostrar mensaje del usuario
    const msgTemp = { id: 'temp-user', rol: 'user', contenido: texto };
    setMensajes((prev) => [...prev, msgTemp]);

    let streaming = '';
    const msgIA = { id: 'temp-ia', rol: 'assistant', contenido: '' };
    setMensajes((prev) => [...prev, msgIA]);

    const { ok } = await enviarMensaje(userId, chatActivo, texto, {
      onChunk:  (chunk) => {
        streaming += chunk;
        setStreamingTexto(streaming);
        setMensajes((prev) => [
          ...prev.slice(0, -1),
          { ...msgIA, contenido: streaming },
        ]);
      },
      onFinish: (final) => {
        setStreamingTexto('');
        setMensajes((prev) => [
          ...prev.slice(0, -1),
          { ...msgIA, id: 'final-ia', contenido: final },
        ]);
      },
      onError: (err) => {
        setErrorMsg(err);
        setMensajes((prev) => prev.filter((m) => m.id !== 'temp-ia'));
      },
    });

    if (ok) {
      // Refrescar uso
      getUsoMensual(userId).then(setUso);
      // Refrescar título de conversación
      cargarConversaciones(userId).then(setConversaciones);
    }

    setEnviando(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  };

  // ── Gate de plan ─────────────────────────────────────────────────────────────

  if (!planPersonal) {
    return (
      <div className="ap-gate">
        <div className="ap-gate-card">
          <div className="ap-gate-icon">🤖</div>
          <h2>Asistente Personal IA</h2>
          <p>Un asistente que habla contigo de cualquier tema — trabajo, vida personal, análisis, redacción — y que recuerda lo que le cuentas en cada conversación.</p>
          <ul className="ap-gate-features">
            <li>✅ 300 mensajes mensuales incluidos</li>
            <li>✅ Memoria persistente entre conversaciones</li>
            <li>✅ Sin límite de temas</li>
            <li>✅ Historial completo de conversaciones</li>
          </ul>
          <div className="ap-gate-precio">
            <span className="ap-gate-monto">$20</span>
            <span className="ap-gate-periodo">/mes adicional</span>
          </div>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>
            Solicita la activación a través de tu panel de suscripción o contacta al administrador.
          </p>
          <button className="ap-gate-btn" onClick={() => window.dispatchEvent(new CustomEvent('irA', { detail: 'suscripcion' }))}>
            Ver planes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ap-shell">

      {/* ── Sidebar izquierdo ── */}
      <aside className="ap-sidebar">
        <button className="ap-nueva-btn" onClick={nuevaConversacion}>
          ✏️ Nueva conversación
        </button>

        {/* Lista de conversaciones */}
        <div className="ap-convs-lista">
          {cargandoConvs ? (
            <p className="ap-sidebar-placeholder">Cargando…</p>
          ) : conversaciones.length === 0 ? (
            <p className="ap-sidebar-placeholder">Aún no hay conversaciones. Empieza una nueva.</p>
          ) : (
            conversaciones.map((c) => (
              <button
                key={c.id}
                className={`ap-conv-item${chatActivo === c.id ? ' active' : ''}`}
                onClick={() => abrirConversacion(c.id)}
              >
                <span className="ap-conv-icon">💬</span>
                <span className="ap-conv-titulo">{c.titulo || 'Conversación'}</span>
              </button>
            ))
          )}
        </div>

        {/* Memorias */}
        <PanelMemorias
          userId={userId}
          visible={memoriasVisible}
          onToggle={() => setMemoriasVisible((v) => !v)}
        />

        {/* Uso mensual */}
        <BarraUso uso={uso} />
      </aside>

      {/* ── Área de chat ── */}
      <main className="ap-main">
        {!chatActivo ? (
          <div className="ap-bienvenida">
            <div className="ap-bienvenida-icon">🤖</div>
            <h2>¿En qué te ayudo hoy?</h2>
            <p>Puedo ayudarte con cualquier cosa — trabajo, vida personal, análisis de documentos, redacción, planificación personal y más.</p>
            <button className="ap-nueva-btn-center" onClick={nuevaConversacion}>
              Iniciar conversación
            </button>
          </div>
        ) : (
          <>
            {/* Mensajes */}
            <div className="ap-mensajes">
              {mensajes.length === 0 && (
                <div className="ap-chat-vacio">
                  <p>Escribe algo para empezar. Recuerda que aprendo de cada conversación.</p>
                </div>
              )}
              {mensajes.map((msg, i) => (
                <Mensaje
                  key={msg.id || i}
                  msg={msg}
                  streaming={i === mensajes.length - 1 && enviando && msg.rol === 'assistant'}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Error */}
            {errorMsg && (
              <div className="ap-error">⚠️ {errorMsg}</div>
            )}

            {/* Input */}
            <div className="ap-input-area">
              <textarea
                ref={textareaRef}
                className="ap-textarea"
                value={inputTexto}
                onChange={(e) => setInputTexto(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe un mensaje… (Enter para enviar, Shift+Enter para nueva línea)"
                rows={2}
                disabled={enviando}
              />
              <button
                className="ap-send-btn"
                onClick={enviar}
                disabled={enviando || !inputTexto.trim()}
              >
                {enviando ? '…' : '↑'}
              </button>
            </div>
            <p className="ap-disclaimer">
              El asistente puede cometer errores. Verifica la información importante.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
