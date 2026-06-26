/**
 * Servicio del Laboratorio IA — Centro IA Docente
 * Llama a Claude API con un prompt libre y streaming de respuesta.
 * Reutiliza la misma API key de VITE_ANTHROPIC_API_KEY.
 */

import { registrarEventoAuditoria, registrarEventoIA } from "../firebase";

const SYSTEM_LAB = `Eres DocenteOS AI PRO, un asistente especializado en pedagogía dominicana.
Ayudas a docentes del sistema educativo de República Dominicana a planificar, diseñar materiales,
crear evaluaciones y mejorar su práctica educativa. Tus respuestas están alineadas con el currículo
del MINERD y el enfoque por competencias. Usas lenguaje claro, profesional y motivador.
Responde siempre en español.`;

export async function llamarIALab(prompt, { onChunk, onFinish, onError }) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  let respuestaAcumulada = ""

  if (!apiKey || apiKey === 'sk-ant-...') {
    await registrarEventoAuditoria({
      tipo: "ia",
      evento: "ia_api_key_no_configurada",
      modulo: "centro-ia",
      detalle: { tieneApiKey: false },
    })
    onError(
      'No hay API key de Anthropic configurada.\n\n' +
      'Agrega esta línea a tu archivo .env.local:\n' +
      'VITE_ANTHROPIC_API_KEY=sk-ant-tu-clave-aqui\n\n' +
      'Luego reinicia el servidor de desarrollo.',
    )
    return
  }

  let response
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-allow-browser': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        stream: true,
        system: SYSTEM_LAB,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
  } catch (err) {
    await registrarEventoAuditoria({
      tipo: "ia",
      evento: "ia_error_red",
      modulo: "centro-ia",
      detalle: { mensaje: err.message },
    })
    onError(`Error de red: ${err.message}`)
    return
  }

  if (!response.ok) {
    let msg = `Error ${response.status}`
    try {
      const body = await response.json()
      msg = body?.error?.message || msg
    } catch {
      // Mantener mensaje HTTP por defecto.
    }
    await registrarEventoIA({
      modulo: "centro-ia",
      accion: "consulta",
      prompt,
      respuesta: "",
      estado: "error",
      meta: { status: response.status, mensaje: msg },
    })
    await registrarEventoAuditoria({
      tipo: "ia",
      evento: "ia_http_error",
      modulo: "centro-ia",
      detalle: { status: response.status, mensaje: msg },
    })
    onError(msg)
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') { onFinish(); return }
        try {
          const parsed = JSON.parse(data)
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            respuestaAcumulada += parsed.delta.text
            onChunk(parsed.delta.text)
          }
          if (parsed.type === 'message_stop') {
            await registrarEventoIA({
              modulo: "centro-ia",
              accion: "consulta",
              prompt,
              respuesta: respuestaAcumulada,
              estado: "exito",
              meta: { fuente: "anthropic", longitudRespuesta: respuestaAcumulada.length },
            })
            await registrarEventoAuditoria({
              tipo: "ia",
              evento: "ia_consulta_exitosa",
              modulo: "centro-ia",
              detalle: { longitudRespuesta: respuestaAcumulada.length },
            })
            onFinish();
            return
          }
        } catch {
          // Ignorar eventos SSE no parseables.
        }
      }
    }
    await registrarEventoIA({
      modulo: "centro-ia",
      accion: "consulta",
      prompt,
      respuesta: respuestaAcumulada,
      estado: "exito",
      meta: { fuente: "anthropic", longitudRespuesta: respuestaAcumulada.length },
    })
    await registrarEventoAuditoria({
      tipo: "ia",
      evento: "ia_consulta_exitosa",
      modulo: "centro-ia",
      detalle: { longitudRespuesta: respuestaAcumulada.length },
    })
    onFinish()
  } catch (err) {
    await registrarEventoIA({
      modulo: "centro-ia",
      accion: "consulta",
      prompt,
      respuesta: respuestaAcumulada,
      estado: "error",
      meta: { mensaje: err.message },
    })
    await registrarEventoAuditoria({
      tipo: "ia",
      evento: "ia_error_stream",
      modulo: "centro-ia",
      detalle: { mensaje: err.message },
    })
    onError(`Error leyendo respuesta: ${err.message}`)
  }
}
