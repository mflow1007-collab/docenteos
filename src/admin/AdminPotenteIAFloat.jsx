import { useState } from 'react'
import { collection, getCountFromServer } from 'firebase/firestore'
import { db } from '../firebase.js'
import { AIService } from '../services/ai/AIService.js'

const BANCOS = [
  'knowledgeSources', 'curricularContent', 'curriculos',
  'bp_temas', 'bp_actividades', 'bp_instrumentos', 'bp_recursos', 'bp_neae',
  'bic_planes', 'bic_actividades', 'bic_instrumentos',
  'ke_agentes', 'ke_topics', 'ke_estilos',
  'aiLogs', 'aiCache', 'planificaciones',
]

const SYSTEM = `Eres Potente IA, operador administrativo senior de DocenteOS.
Ayudas a auditar bancos, diagnosticar errores, preparar acciones manuales y decidir próximos pasos.
No inventes datos curriculares. No recomiendes tocar templates si el problema es de datos o flujo.
Responde con diagnóstico, acción recomendada y validación.`

const CHAT_PROVIDER_ORDER = ['openai', 'anthropic', 'gemini', 'nvidia', 'abacus']

async function resumenBancos() {
  if (!db) return 'Firestore no disponible.'
  const datos = await Promise.all(BANCOS.map(async (id) => {
    try {
      const snap = await getCountFromServer(collection(db, id))
      return `${id}: ${snap.data().count}`
    } catch (err) {
      return `${id}: sin acceso (${err.message})`
    }
  }))
  return datos.join('\n')
}

export default function AdminPotenteIAFloat({ pagina = 'home', onAbrirPanel }) {
  const [abierto, setAbierto] = useState(false)
  const [modoPanel, setModoPanel] = useState('chat')
  const [input, setInput] = useState('')
  const [salida, setSalida] = useState('')
  const [archivo, setArchivo] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [incluyeBancos, setIncluyeBancos] = useState(true)
  const [chatInput, setChatInput] = useState('')
  const [chatCargando, setChatCargando] = useState(false)
  const [chatMensajes, setChatMensajes] = useState([
    {
      rol: 'assistant',
      texto: 'Estoy aquí. Puedes hablarme normal: revisar una malla, pensar un flujo, detectar por qué algo sale raro o preparar una acción manual.',
    },
  ])

  const enviar = async () => {
    const texto = input.trim()
    if (!texto || cargando) return
    setCargando(true)
    setSalida('')
    try {
      const bancos = incluyeBancos ? await resumenBancos() : 'No solicitado.'
      let archivoTexto = ''
      if (archivo) {
        archivoTexto = await archivo.text().catch(() => '')
      }
      const prompt = `
SECCIÓN ADMIN ACTUAL: ${pagina}

MONITOREO DE BANCOS:
${bancos}

ARCHIVO ADJUNTO:
${archivo ? `Nombre: ${archivo.name}\n${archivoTexto.slice(0, 10000)}` : 'Sin archivo.'}

SOLICITUD:
${texto}
`
      let acumulado = ''
      await AIService.generate({
        module: 'admin-potente-ia',
        system: SYSTEM,
        prompt,
        maxTokens: 3500,
        providerOrder: CHAT_PROVIDER_ORDER,
        onChunk: (chunk) => {
          acumulado += chunk
          setSalida(acumulado)
        },
        onFinish: () => {},
        onError: (msg) => { throw new Error(msg) },
      })
    } catch (err) {
      setSalida(`No se pudo completar: ${err.message || err}`)
    } finally {
      setCargando(false)
    }
  }

  const enviarChat = async () => {
    const texto = chatInput.trim()
    if (!texto || chatCargando) return

    const mensajeUsuario = { rol: 'user', texto }
    const historialBase = [...chatMensajes, mensajeUsuario].slice(-12)
    setChatMensajes(historialBase)
    setChatInput('')
    setChatCargando(true)

    try {
      const bancos = incluyeBancos ? await resumenBancos() : 'No solicitado.'
      const historial = historialBase
        .map((m) => `${m.rol === 'user' ? 'Administrador' : 'Potente IA'}: ${m.texto}`)
        .join('\n\n')

      const prompt = `
MODO: conversación administrativa rápida.
SECCIÓN ADMIN ACTUAL: ${pagina}

MONITOREO DE BANCOS:
${bancos}

HISTORIAL RECIENTE:
${historial}

ÚLTIMO MENSAJE DEL ADMINISTRADOR:
${texto}

Responde de forma conversacional, directa y útil. Si el usuario pide hacer algo riesgoso, primero explica el riesgo.
Si faltan datos curriculares oficiales, dilo claramente. No inventes competencias, indicadores ni contenidos.
`
      let acumulado = ''
      let tieneRespuesta = false
      await AIService.generate({
        module: 'admin-potente-ia',
        system: `${SYSTEM}
También puedes actuar como compañero de conversación técnica: breve, claro, honesto y orientado a decisiones.`,
        prompt,
        maxTokens: 2200,
        providerOrder: CHAT_PROVIDER_ORDER,
        onChunk: (chunk) => {
          acumulado += chunk
          setChatMensajes((prev) => {
            const next = [...prev]
            if (tieneRespuesta && next[next.length - 1]?.rol === 'assistant') {
              next[next.length - 1] = { rol: 'assistant', texto: acumulado, streaming: true }
            } else {
              tieneRespuesta = true
              next.push({ rol: 'assistant', texto: acumulado, streaming: true })
            }
            return next
          })
        },
        onFinish: (textoFinal) => {
          const final = textoFinal || acumulado
          setChatMensajes((prev) => {
            const next = [...prev]
            if (next[next.length - 1]?.rol === 'assistant') {
              next[next.length - 1] = { rol: 'assistant', texto: final, streaming: false }
            }
            return next
          })
        },
        onError: (msg) => { throw new Error(msg) },
      })
    } catch (err) {
      setChatMensajes((prev) => [...prev, { rol: 'error', texto: `No pude responder: ${err.message || err}` }])
    } finally {
      setChatCargando(false)
    }
  }

  const leerUltimaRespuesta = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    const ultima = [...chatMensajes].reverse().find((m) => m.rol === 'assistant' && m.texto)
    if (!ultima) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(ultima.texto)
    utterance.lang = 'es-DO'
    utterance.rate = 0.98
    window.speechSynthesis.speak(utterance)
  }

  const detenerVoz = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        style={{
          position: 'fixed',
          right: 24,
          bottom: 24,
          zIndex: 60,
          border: 0,
          borderRadius: 999,
          padding: '12px 16px',
          background: 'linear-gradient(135deg,#2563eb,#7c3aed)',
          color: '#fff',
          fontWeight: 900,
          boxShadow: '0 14px 34px rgba(37,99,235,.35)',
          cursor: 'pointer',
        }}
      >
        Potente IA
      </button>

      {abierto && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(2,6,23,.48)' }} onClick={() => setAbierto(false)} />
      )}

      <aside
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          width: 420,
          maxWidth: '96vw',
          zIndex: 80,
          background: '#0f172a',
          borderLeft: '1px solid #334155',
          boxShadow: '-16px 0 42px rgba(0,0,0,.32)',
          transform: abierto ? 'translateX(0)' : 'translateX(105%)',
          transition: 'transform .22s ease',
          display: 'flex',
          flexDirection: 'column',
          color: '#e2e8f0',
        }}
      >
        <div style={{ padding: 16, borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <strong style={{ display: 'block', fontSize: 16 }}>Potente IA</strong>
            <small style={{ color: '#94a3b8' }}>Operador administrativo · {pagina}</small>
          </div>
          <button type="button" onClick={() => setAbierto(false)} style={{ border: 0, background: 'transparent', color: '#94a3b8', fontSize: 24, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ padding: 12, borderBottom: '1px solid #334155', display: 'flex', gap: 8 }}>
          {[
            ['chat', 'Chat'],
            ['trabajo', 'Trabajo'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setModoPanel(id)}
              style={{
                flex: 1,
                border: '1px solid #334155',
                borderRadius: 8,
                padding: '9px 10px',
                background: modoPanel === id ? '#2563eb' : '#111827',
                color: '#e2e8f0',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {modoPanel === 'trabajo' ? (
          <>
            <div style={{ padding: 14, display: 'grid', gap: 10, borderBottom: '1px solid #334155' }}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={5}
                placeholder="Dime qué quieres auditar, revisar o preparar..."
                style={{ resize: 'vertical', borderRadius: 8, border: '1px solid #334155', background: '#111827', color: '#e2e8f0', padding: 10, fontFamily: 'inherit' }}
              />
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#cbd5e1', fontSize: 13 }}>
                <input type="checkbox" checked={incluyeBancos} onChange={(e) => setIncluyeBancos(e.target.checked)} />
                Incluir monitoreo de bancos
              </label>
              <input
                type="file"
                onChange={(e) => setArchivo(e.target.files?.[0] || null)}
                style={{ color: '#cbd5e1', fontSize: 12 }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={enviar}
                  disabled={cargando || input.trim().length < 4}
                  style={{ flex: 1, border: 0, borderRadius: 8, padding: '10px 12px', background: '#2563eb', color: '#fff', fontWeight: 800, cursor: 'pointer', opacity: cargando ? .7 : 1 }}
                >
                  {cargando ? 'Trabajando...' : 'Ejecutar'}
                </button>
                <button
                  type="button"
                  onClick={onAbrirPanel}
                  style={{ border: '1px solid #334155', borderRadius: 8, padding: '10px 12px', background: '#1e293b', color: '#e2e8f0', fontWeight: 700, cursor: 'pointer' }}
                >
                  Panel
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: 16, whiteSpace: 'pre-wrap', lineHeight: 1.55, fontSize: 14 }}>
              {salida || 'Aquí aparecerá la respuesta. Puedes trabajar desde cualquier parte del administrador.'}
            </div>
          </>
        ) : (
          <>
            <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'grid', gap: 12, alignContent: 'start' }}>
              {chatMensajes.map((mensaje, index) => {
                const esUsuario = mensaje.rol === 'user'
                const esError = mensaje.rol === 'error'
                return (
                  <div
                    key={`${mensaje.rol}-${index}`}
                    style={{
                      justifySelf: esUsuario ? 'end' : 'start',
                      maxWidth: '88%',
                      borderRadius: 10,
                      padding: '10px 12px',
                      background: esError ? '#7f1d1d' : esUsuario ? '#2563eb' : '#1e293b',
                      color: '#f8fafc',
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.5,
                      fontSize: 14,
                      border: esUsuario ? '1px solid #3b82f6' : '1px solid #334155',
                    }}
                  >
                    {mensaje.texto}
                    {mensaje.streaming ? ' ▌' : ''}
                  </div>
                )
              })}
            </div>

            <div style={{ padding: 14, borderTop: '1px solid #334155', display: 'grid', gap: 10 }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#cbd5e1', fontSize: 13 }}>
                <input type="checkbox" checked={incluyeBancos} onChange={(e) => setIncluyeBancos(e.target.checked)} />
                Conversar con monitoreo de bancos
              </label>
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') enviarChat()
                }}
                rows={3}
                placeholder="Escríbeme como en este chat..."
                style={{ resize: 'vertical', borderRadius: 8, border: '1px solid #334155', background: '#111827', color: '#e2e8f0', padding: 10, fontFamily: 'inherit' }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8 }}>
                <button
                  type="button"
                  onClick={enviarChat}
                  disabled={chatCargando || chatInput.trim().length < 2}
                  style={{ border: 0, borderRadius: 8, padding: '10px 12px', background: '#2563eb', color: '#fff', fontWeight: 800, cursor: 'pointer', opacity: chatCargando ? .7 : 1 }}
                >
                  {chatCargando ? 'Pensando...' : 'Enviar'}
                </button>
                <button
                  type="button"
                  onClick={leerUltimaRespuesta}
                  style={{ border: '1px solid #334155', borderRadius: 8, padding: '10px 12px', background: '#1e293b', color: '#e2e8f0', fontWeight: 700, cursor: 'pointer' }}
                >
                  Leer
                </button>
                <button
                  type="button"
                  onClick={detenerVoz}
                  style={{ border: '1px solid #334155', borderRadius: 8, padding: '10px 12px', background: '#111827', color: '#e2e8f0', fontWeight: 700, cursor: 'pointer' }}
                >
                  Parar
                </button>
              </div>
              <button
                type="button"
                onClick={onAbrirPanel}
                style={{ border: '1px solid #334155', borderRadius: 8, padding: '10px 12px', background: '#1e293b', color: '#e2e8f0', fontWeight: 700, cursor: 'pointer' }}
              >
                Abrir panel completo
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  )
}
