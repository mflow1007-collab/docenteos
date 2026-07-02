/**
 * Phase A — AI Gateway para generación de clases
 *
 * Una llamada por semana → N clases con Inicio/Desarrollo/Cierre.
 *
 * Estrategia de reintento (3 intentos máximo):
 *   Intento 1 : prompt normal, maxTokens=8000
 *   Intento 2 : adaptado según motivo del fallo
 *     - truncado      → maxTokens=12000
 *     - texto sin JSON → añade recordatorio al prompt
 *   Intento 3 : si sigue truncado → split en 2 mitades; si otro error → stop
 *
 * PROHIBIDO: fallback a templates JS.
 * Fallo persistido en aiLogs/ con etiqueta "fase_a_parse_error".
 */

import { getAuth }                              from 'firebase/auth';
import { collection, addDoc, serverTimestamp }  from 'firebase/firestore';
import { db }                                   from '../firebase.js';

const MODULE_NAME = 'planificacion';   // activa response_format en gateway OpenAI

const SYSTEM_PROMPT =
  'Eres un planificador curricular experto. ' +
  'Respondes ÚNICAMENTE con JSON válido, sin texto adicional ni bloques markdown.';

const JSON_REMINDER =
  'RECUERDA: responde ÚNICAMENTE el objeto JSON, sin texto antes ni después, sin markdown.\n\n';

// ─── Registro de errores de parseo en aiLogs/ ─────────────────────────────────

async function logParseError({ semanaNum, attempt, motivo, raw, provider, model }) {
  try {
    const uid = getAuth().currentUser?.uid || null;
    await addDoc(collection(db, 'aiLogs'), {
      uid,
      fecha:           serverTimestamp(),
      modulo:          MODULE_NAME,
      proveedor:       provider || 'desconocido',
      modelo:          model    || 'desconocido',
      etiqueta:        'fase_a_parse_error',
      semana:          semanaNum,
      intento:         attempt,
      motivo,
      rawInicio:       (raw || '').slice(0, 500),
      rawFin:          (raw || '').slice(-500),
      tokensEntrada:   0,
      tokensSalida:    Math.ceil((raw || '').length / 4),
      costoEstimado:   '0.000000',
      tiempoRespuesta: 0,
      cache:           false,
      error:           motivo,
    });
  } catch {
    // no-fatal
  }
}

// ─── SSE collector ────────────────────────────────────────────────────────────

async function callGatewayCollect(prompt, system, maxTokens = 8000) {
  const user = getAuth().currentUser;
  if (!user) throw new Error('Usuario no autenticado');

  let idToken;
  try { idToken = await user.getIdToken(false); } catch { idToken = null; }

  const response = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify({ module: MODULE_NAME, prompt, system, maxTokens }),
  });

  if (!response.ok) {
    let msg = `HTTP ${response.status}`;
    try { const b = await response.json(); msg = b.error || msg; } catch {}
    throw new Error(msg);
  }

  const usedProvider = response.headers.get('X-AI-Provider') || 'desconocido';
  const usedModel    = response.headers.get('X-AI-Model')    || 'desconocido';

  const reader  = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text   = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (raw === '[DONE]') continue;
      try {
        const parsed = JSON.parse(raw);
        if (parsed.text) text += parsed.text;
      } catch {}
    }
  }

  return { text, provider: usedProvider, model: usedModel };
}

// ─── Extractor robusto de JSON ────────────────────────────────────────────────

function extraerJSON(raw) {
  if (!raw || !raw.trim()) {
    return { ok: false, motivo: 'respuesta vacía', raw };
  }
  let s = raw.trim();

  // (a) quitar cercas markdown si existen
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');

  // (b) intento directo
  try { return { ok: true, data: JSON.parse(s) }; } catch {}

  // (c) extraer desde el primer { hasta el último }
  const i = s.indexOf('{');
  const j = s.lastIndexOf('}');
  if (i !== -1 && j > i) {
    try { return { ok: true, data: JSON.parse(s.slice(i, j + 1)) }; } catch {}
  }

  // (d) diagnóstico específico
  const abre   = (s.match(/{/g)  || []).length;
  const cierra = (s.match(/}/g)  || []).length;
  const motivo = (i === -1)
    ? 'el modelo respondió texto sin JSON'
    : (abre > cierra)
      ? `JSON TRUNCADO (${abre} llaves abren, ${cierra} cierran) — subir maxTokens`
      : 'JSON malformado';

  return { ok: false, motivo, raw };
}

// ─── Validaciones R1 / R2 / R7 ───────────────────────────────────────────────

function jaccardSimilarity(a, b) {
  if (!a || !b) return 0;
  const setA = new Set(a.toLowerCase().split(/\s+/));
  const setB = new Set(b.toLowerCase().split(/\s+/));
  const inter = [...setA].filter(w => setB.has(w)).length;
  return inter / Math.max(setA.size, setB.size, 1);
}

function validateWeekPlan(data, durMin, numClases) {
  if (!data?.clases || !Array.isArray(data.clases)) throw new Error('R1: falta clases[]');
  if (data.clases.length < numClases) {
    throw new Error(`R1: se esperaban ${numClases} clases, llegaron ${data.clases.length}`);
  }

  const tInicio     = durMin <= 50 ? 10 : 15;
  const tCierre     = durMin <= 50 ? 5  : 10;
  const tDesarrollo = durMin - tInicio - tCierre;
  const tiemposEsperados = { Inicio: tInicio, Desarrollo: tDesarrollo, Cierre: tCierre };

  const desarrollos = [];

  for (let idx = 0; idx < numClases; idx++) {
    const clase = data.clases[idx];
    if (!Array.isArray(clase?.momentos) || clase.momentos.length !== 3) {
      throw new Error(`R1: clase ${idx + 1} debe tener exactamente 3 momentos`);
    }

    let totalMin = 0;
    for (const m of clase.momentos) {
      if (!Array.isArray(m.actividades) || m.actividades.length === 0) {
        throw new Error(`R1: clase ${idx + 1} momento "${m.nombre}" sin actividades`);
      }
      const esperado = tiemposEsperados[m.nombre];
      if (esperado !== undefined) {
        m.tiempo = `${esperado} min`;
        totalMin += esperado;
      } else {
        totalMin += parseInt(m.tiempo) || 0;
      }
      if (m.nombre === 'Desarrollo') desarrollos.push(m.actividades.join(' '));
    }

    if (totalMin !== durMin) {
      throw new Error(`R7: clase ${idx + 1} suma ${totalMin} min ≠ ${durMin} min`);
    }
  }

  for (let idx = 0; idx < desarrollos.length - 1; idx++) {
    const sim = jaccardSimilarity(desarrollos[idx], desarrollos[idx + 1]);
    if (sim > 0.6) {
      throw new Error(
        `R2: Desarrollo clase ${idx + 1} y ${idx + 2} demasiado similares (${(sim * 100).toFixed(0)}%)`,
      );
    }
  }
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildWeekPrompt(spec, semanaNum, numClases, durMin, numSemanas, startDia = 1) {
  const tInicio     = durMin <= 50 ? 10 : 15;
  const tCierre     = durMin <= 50 ? 5  : 10;
  const tDesarrollo = durMin - tInicio - tCierre;

  const vocab   = spec.contenidosClaves?.vocabulario?.slice(0, 16).join(', ') || '';
  const gram    = spec.contenidosClaves?.gramatica?.slice(0, 4).join('; ')    || '';
  const funcs   = spec.contenidosClaves?.funcionales?.slice(0, 3).join('; ')  || '';
  const indText = (spec.indicadores || []).slice(0, 3)
    .map(i => i.descripcion || i.texto || '').filter(Boolean).join(' | ');
  const ceText  = (spec.ces || []).slice(0, 2)
    .map(c => c.descripcion || '').filter(Boolean).join(' | ');

  const rangoClases = numClases === 1
    ? `Clase ${startDia}`
    : `Clases ${startDia} a ${startDia + numClases - 1}`;

  return `Eres un planificador curricular experto del sistema educativo dominicano (MINERD).

TEMA: "${spec.temaOficial}"
ÁREA: ${spec.area} | GRADO: ${spec.grado} | SEMANA: ${semanaNum} de ${numSemanas} (${rangoClases})

ESPECIFICACIÓN CURRICULAR OFICIAL:
- Competencias: ${ceText || '(ver indicadores)'}
- Indicadores: ${indText}
- Vocabulario: ${vocab}
- Gramática: ${gram}
- Funciones: ${funcs}

TAREA: Genera exactamente ${numClases} clases con PROGRESIÓN PEDAGÓGICA.

REGLAS:
1. Devuelve SOLO JSON puro — sin texto, sin cercas markdown.
2. Desarrollos DISTINTOS entre clases (contenido diferente, no reformulaciones).
3. Tiempos: Inicio=${tInicio} min, Desarrollo=${tDesarrollo} min, Cierre=${tCierre} min.
4. Mínimo 2 actividades concretas por momento.

JSON EXACTO (sin nada más):
{"outputSchemaVersion":"1.0","semana":${semanaNum},"clases":[{"dia":${startDia},"titulo":"...","momentos":[{"nombre":"Inicio","tiempo":"${tInicio} min","actividades":["...","..."]},{"nombre":"Desarrollo","tiempo":"${tDesarrollo} min","actividades":["...","..."]},{"nombre":"Cierre","tiempo":"${tCierre} min","actividades":["...","..."]}]}]}`;
}

// ─── Generación en modo split (2 mitades) ─────────────────────────────────────

async function generateWeekPlanSplit(spec, semanaNum, durMin, numClases, numSemanas, maxTokens) {
  const half1 = Math.ceil(numClases / 2);
  const half2 = numClases - half1;

  const makeHalf = async (count, startDia) => {
    const prompt = buildWeekPrompt(spec, semanaNum, count, durMin, numSemanas, startDia);
    const { text: raw, provider, model } = await callGatewayCollect(prompt, SYSTEM_PROMPT, maxTokens);
    const result = extraerJSON(raw);
    if (!result.ok) throw new Error(`Split día ${startDia}: ${result.motivo}`);
    return result.data;
  };

  const d1 = await makeHalf(half1, 1);
  const d2 = await makeHalf(half2, half1 + 1);

  // Renumerar dias de la segunda mitad y fusionar
  const clasesD2 = (d2.clases || []).slice(0, half2).map((c, i) => ({
    ...c, dia: half1 + 1 + i,
  }));

  const merged = { ...d1, clases: [...(d1.clases || []).slice(0, half1), ...clasesD2] };
  validateWeekPlan(merged, durMin, numClases);
  return merged;
}

// ─── generateWeekPlan — exportación principal ─────────────────────────────────

export const generateWeekPlan = async (spec, semanaNum, durMin, numClases, numSemanas = 4) => {
  let maxTokens  = 8000;
  let prefix     = '';
  let splitMode  = false;
  let lastError  = null;
  let lastProvider = 'desconocido';
  let lastModel    = 'desconocido';
  let lastRaw      = '';

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      // ── Modo split: dos llamadas con la mitad de clases cada una ──────────
      if (splitMode) {
        return await generateWeekPlanSplit(spec, semanaNum, durMin, numClases, numSemanas, maxTokens);
      }

      const { text: raw, provider, model } = await callGatewayCollect(
        prefix + buildWeekPrompt(spec, semanaNum, numClases, durMin, numSemanas),
        SYSTEM_PROMPT,
        maxTokens,
      );
      lastProvider = provider;
      lastModel    = model;
      lastRaw      = raw;

      const result = extraerJSON(raw);

      if (!result.ok) {
        // Log permanente del fallo
        await logParseError({ semanaNum, attempt, motivo: result.motivo, raw, provider, model });
        console.error(
          `[FaseA] intento ${attempt} — ${result.motivo}`,
          { inicio: raw.slice(0, 300), fin: raw.slice(-300) },
        );

        lastError = new Error(result.motivo);

        // Adaptar estrategia para el siguiente intento
        if (result.motivo.includes('TRUNCADO')) {
          if (attempt === 1) {
            maxTokens = 12000;                     // intento 2: más tokens
          } else {
            splitMode = true;                      // intento 3: partir en mitades
          }
        } else {
          // texto sin JSON o malformado → añadir recordatorio
          prefix = JSON_REMINDER;
        }
        continue;
      }

      validateWeekPlan(result.data, durMin, numClases);
      return result.data;

    } catch (err) {
      lastError    = err;
      lastRaw      = lastRaw || '';
      console.error(`[FaseA] intento ${attempt} (${lastProvider}/${lastModel}):`, err.message);
      await logParseError({
        semanaNum, attempt,
        motivo:   err.message,
        raw:      lastRaw,
        provider: lastProvider,
        model:    lastModel,
      });
    }
  }

  // Error final con diagnóstico completo
  throw new Error(
    `Error generando Semana ${semanaNum} tras 3 intentos ` +
    `[${lastProvider} / ${lastModel}]. ` +
    `Motivo: ${lastError?.message}. ` +
    `Raw inicio: "${lastRaw.slice(0, 200)}" … fin: "${lastRaw.slice(-200)}"`,
  );
};

// ─── buildEspecificacionCurricular — exportada para uso externo ───────────────

export const buildEspecificacionCurricular = ({
  mallaPayload, titulo, allInds, allComps, mallaContenidos, area, grado,
}) => {
  const ces = (allComps || []).slice(0, 4).map(c => ({
    id:            c.id || '',
    codigoOficial: c.id || '',
    descripcion:   c.especificaGrado || c.especifica || '',
  })).filter(c => c.descripcion);

  const indicadores = (allInds || []).slice(0, 9).map(ind => ({
    id:            ind.id || '',
    codigoOficial: ind.id || '',
    descripcion:   ind.descripcion || ind.texto || '',
    aspecto:       '',
  })).filter(i => i.descripcion);

  return {
    temaOficial: titulo,
    area,
    grado,
    nivelMCERL:  mallaPayload?.nivelMCERL || null,
    ces,
    indicadores,
    contenidosClaves: {
      vocabulario: mallaContenidos?.vocabulario?.slice(0, 20) || [],
      gramatica:   mallaContenidos?.gramatica?.slice(0, 6)   || [],
      funcionales: mallaContenidos?.funcionales?.slice(0, 5) || [],
    },
    outputSchemaVersion: '1.0',
  };
};
