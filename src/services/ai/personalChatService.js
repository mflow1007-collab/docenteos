/**
 * personalChatService — Asistente Personal con memoria persistente.
 *
 * Estructura Firestore:
 *   chat_personal/{userId}/conversaciones/{chatId}
 *     mensajes subcollection: { rol, contenido, timestamp }
 *   chat_personal/{userId}/uso/{YYYY-MM}
 *     { mensajes, tokensEstimados, costoEstimadoUSD, updatedAt }
 *   chat_memoria/{userId}/hechos/{hechoId}
 *     { hecho, categoria, activo, creadoEn }
 */

import {
  collection, doc, addDoc, setDoc, getDocs, getDoc,
  query, orderBy, limit, updateDoc, serverTimestamp, where,
} from 'firebase/firestore';
import { db } from '../../firebase.js';
import { AIService } from './AIService.js';

// ─── Constantes ───────────────────────────────────────────────────────────────

export const LIMITE_MENSAJES_MES = 300;
// Costo promedio estimado en USD por token (Haiku dominante, mezcla con Sonnet)
const COSTO_USD_POR_TOKEN = 0.000002;

// ─── Mes actual ───────────────────────────────────────────────────────────────

function mesActual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function estimarTokens(texto) {
  return Math.ceil((texto || '').length / 3.8);
}

// ─── Uso mensual ──────────────────────────────────────────────────────────────

export async function getUsoMensual(userId) {
  const mes  = mesActual();
  const ref  = doc(db, 'chat_personal', userId, 'uso', mes);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : { mensajes: 0, tokensEstimados: 0, costoEstimadoUSD: 0 };
}

async function incrementarUso(userId, tokensNuevos) {
  const mes = mesActual();
  const ref = doc(db, 'chat_personal', userId, 'uso', mes);
  const uso = await getUsoMensual(userId);
  await setDoc(ref, {
    mensajes:        (uso.mensajes        || 0) + 1,
    tokensEstimados: (uso.tokensEstimados || 0) + tokensNuevos,
    costoEstimadoUSD: ((uso.tokensEstimados || 0) + tokensNuevos) * COSTO_USD_POR_TOKEN,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// ─── Conversaciones ───────────────────────────────────────────────────────────

export async function crearConversacion(userId) {
  const ref = await addDoc(
    collection(db, 'chat_personal', userId, 'conversaciones'),
    {
      titulo:        'Nueva conversación',
      creadoEn:      serverTimestamp(),
      ultimoMensaje: serverTimestamp(),
    }
  );
  return ref.id;
}

export async function cargarConversaciones(userId) {
  const q    = query(
    collection(db, 'chat_personal', userId, 'conversaciones'),
    orderBy('ultimoMensaje', 'desc'),
    limit(30),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function cargarMensajes(userId, chatId) {
  const q    = query(
    collection(db, 'chat_personal', userId, 'conversaciones', chatId, 'mensajes'),
    orderBy('timestamp', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ─── Memorias ─────────────────────────────────────────────────────────────────

export async function cargarMemorias(userId) {
  const q    = query(
    collection(db, 'chat_memoria', userId, 'hechos'),
    where('activo', '==', true),
    orderBy('creadoEn', 'desc'),
    limit(40),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function borrarMemoria(userId, hechoId) {
  await updateDoc(doc(db, 'chat_memoria', userId, 'hechos', hechoId), { activo: false });
}

// ─── Enviar mensaje ───────────────────────────────────────────────────────────

/**
 * Envía un mensaje del usuario y obtiene respuesta de la IA.
 *
 * @returns {{ ok: boolean, error?: string }}
 */
export async function enviarMensaje(userId, chatId, textoUsuario, { onChunk, onFinish, onError }) {
  // 1. Verificar límite mensual
  const uso = await getUsoMensual(userId);
  if ((uso.mensajes || 0) >= LIMITE_MENSAJES_MES) {
    const msg = `Has alcanzado el límite de ${LIMITE_MENSAJES_MES} mensajes este mes. Tu plan se renueva el 1 del próximo mes.`;
    onError(msg);
    return { ok: false, error: msg };
  }

  // 2. Guardar mensaje del usuario en Firestore
  const colMsgs = collection(db, 'chat_personal', userId, 'conversaciones', chatId, 'mensajes');
  await addDoc(colMsgs, { rol: 'user', contenido: textoUsuario, timestamp: serverTimestamp() });

  // 3. Cargar historial (últimos 10) y memorias
  const [mensajes, memorias] = await Promise.all([
    cargarMensajes(userId, chatId),
    cargarMemorias(userId),
  ]);

  // 4. Construir system prompt con memorias inyectadas
  const bloqueMemoria = memorias.length > 0
    ? `\n\nLo que recuerdo de esta persona:\n${memorias.map((m) => `- ${m.hecho}`).join('\n')}`
    : '';

  const systemPrompt = `Eres un asistente personal inteligente y versátil. Puedes ayudar con cualquier tema: trabajo, vida personal, redacción, análisis, planificación, consultas, etc. No estás limitado a temas educativos.

Sé natural, directo y útil. Adapta tu tono al contexto de la conversación. Si el usuario es docente, puedes integrar ese contexto cuando sea relevante, pero no es obligatorio.${bloqueMemoria}`;

  // 5. Construir historial como texto (últimos 10 mensajes, sin el nuevo)
  const historialReciente = mensajes.slice(-11, -1); // -1 excluye el que acabamos de guardar
  const historialTexto = historialReciente
    .map((m) => `${m.rol === 'user' ? 'Usuario' : 'Asistente'}: ${m.contenido}`)
    .join('\n');

  const promptFinal = historialTexto
    ? `${historialTexto}\n\nUsuario: ${textoUsuario}`
    : textoUsuario;

  // 6. Llamar a la IA
  let respuestaCompleta = '';
  let iaError = null;

  await AIService.generate({
    module: 'chat-personal',
    prompt: promptFinal,
    system: systemPrompt,
    maxTokens: 2048,
    onChunk:  (chunk) => { respuestaCompleta += chunk; onChunk(chunk); },
    onFinish: (texto) => { respuestaCompleta = texto; },
    onError:  (msg)   => { iaError = msg; onError(msg); },
  });

  if (iaError) return { ok: false, error: iaError };

  // 7. Guardar respuesta de la IA
  await addDoc(colMsgs, { rol: 'assistant', contenido: respuestaCompleta, timestamp: serverTimestamp() });

  // 8. Actualizar título si es el primer mensaje
  if (mensajes.length <= 1) {
    const titulo = textoUsuario.slice(0, 60) + (textoUsuario.length > 60 ? '…' : '');
    await updateDoc(
      doc(db, 'chat_personal', userId, 'conversaciones', chatId),
      { titulo, ultimoMensaje: serverTimestamp() },
    );
  } else {
    await updateDoc(
      doc(db, 'chat_personal', userId, 'conversaciones', chatId),
      { ultimoMensaje: serverTimestamp() },
    );
  }

  // 9. Tracking de uso (tokens estimados = prompt + respuesta)
  const tokens = estimarTokens(promptFinal + systemPrompt) + estimarTokens(respuestaCompleta);
  await incrementarUso(userId, tokens);

  // 10. Extracción de memorias (async, no bloquea la UI)
  extraerMemoriasAsync(userId, textoUsuario, respuestaCompleta);

  onFinish(respuestaCompleta);
  return { ok: true };
}

// ─── Extracción automática de memorias ────────────────────────────────────────

async function extraerMemoriasAsync(userId, mensajeUsuario, respuestaIA) {
  try {
    // Solo extraemos si el mensaje del usuario tiene sustancia
    if (mensajeUsuario.length < 30) return;

    const prompt = `Analiza este intercambio de conversación y extrae SOLO hechos concretos y específicos sobre la persona (no sobre el tema que pregunta). Son hechos que vale la pena recordar para conversaciones futuras.

Intercambio:
Usuario: ${mensajeUsuario}
Asistente: ${respuestaIA.slice(0, 500)}

Responde ÚNICAMENTE con una lista JSON de hechos. Si no hay hechos personales relevantes, responde con [].
Formato exacto:
[{"hecho": "...", "categoria": "personal|preferencia|profesional"}]

Ejemplos de buenos hechos: "Vive en Santiago", "Prefiere respuestas cortas", "Trabaja como consultor además de docente", "Tiene 2 hijos adolescentes".
Ejemplos de malos hechos (no incluir): "Preguntó sobre contratos", "Quiere saber de marketing".`;

    let jsonTexto = '';
    await AIService.generate({
      module:   'chat-personal',
      prompt,
      maxTokens: 300,
      onChunk:  (c) => { jsonTexto += c; },
      onFinish: () => {},
      onError:  () => {},
    });

    // Parsear JSON
    const match = jsonTexto.match(/\[[\s\S]*\]/);
    if (!match) return;
    const hechos = JSON.parse(match[0]);
    if (!Array.isArray(hechos) || hechos.length === 0) return;

    // Guardar cada hecho nuevo
    const colHechos = collection(db, 'chat_memoria', userId, 'hechos');
    for (const h of hechos.slice(0, 3)) {
      if (h.hecho && h.hecho.length > 5) {
        await addDoc(colHechos, {
          hecho:     h.hecho,
          categoria: h.categoria || 'personal',
          activo:    true,
          creadoEn:  serverTimestamp(),
        });
      }
    }
  } catch (_) {
    // No fatal — la memoria es best-effort
  }
}
