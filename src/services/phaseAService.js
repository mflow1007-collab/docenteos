/**
 * Phase A — Generación de clases por lotes de 2
 *
 * La semana se genera en LOTES DE 2 CLASES por llamada:
 *   - 4 clases/semana = 2 lotes; 5 clases = 3 lotes (2+2+1)
 *   - ~3-4K tokens de salida por lote → TTFT <10s incluso con NVIDIA
 *   - Cada lote lleva MEMORIA de todo lo generado para anti-duplicación
 *   - Reintentos: 2 intentos POR LOTE (lotes buenos no se descartan)
 *   - R1+R7 se validan por lote; R2 se valida sobre la semana fusionada
 *
 * PROHIBIDO: fallback a templates JS.
 */

import { getAuth }                              from 'firebase/auth';
import { collection, addDoc, serverTimestamp }  from 'firebase/firestore';
import { db }                                   from '../firebase.js';

const MODULE_NAME  = 'planificacion';
const BATCH_SIZE   = 2;
const MAX_TOKENS   = 5000;   // por lote; escala a 8000 si hay truncamiento

const SYSTEM_PROMPT =
  'Eres un planificador curricular experto. ' +
  'Respondes ÚNICAMENTE con JSON válido, sin texto adicional ni bloques markdown.';

const JSON_REMINDER =
  'RECUERDA: responde ÚNICAMENTE el objeto JSON, sin texto antes ni después, sin markdown.\n\n';

// ─── Registro de errores de parseo en aiLogs/ ─────────────────────────────────

async function logParseError({ contexto, attempt, motivo, raw, provider, model }) {
  try {
    const uid = getAuth().currentUser?.uid || null;
    await addDoc(collection(db, 'aiLogs'), {
      uid,
      fecha:           serverTimestamp(),
      modulo:          MODULE_NAME,
      proveedor:       provider || 'desconocido',
      modelo:          model    || 'desconocido',
      etiqueta:        'fase_a_parse_error',
      contexto,
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
  } catch { /* no-fatal */ }
}

// ─── SSE collector ────────────────────────────────────────────────────────────

async function callGatewayCollect(prompt, system, maxTokens = MAX_TOKENS) {
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
  if (!raw || !raw.trim()) return { ok: false, motivo: 'respuesta vacía', raw };
  let s = raw.trim();

  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  try { return { ok: true, data: JSON.parse(s) }; } catch {}

  const i = s.indexOf('{');
  const j = s.lastIndexOf('}');
  if (i !== -1 && j > i) {
    try { return { ok: true, data: JSON.parse(s.slice(i, j + 1)) }; } catch {}
  }

  const abre   = (s.match(/{/g)  || []).length;
  const cierra = (s.match(/}/g)  || []).length;
  const motivo = (i === -1)
    ? 'el modelo respondió texto sin JSON'
    : (abre > cierra)
      ? `JSON TRUNCADO (${abre} llaves abren, ${cierra} cierran) — subir maxTokens`
      : 'JSON malformado';

  return { ok: false, motivo, raw };
}

// ─── Jaccard para R2 ──────────────────────────────────────────────────────────

function jaccardSimilarity(a, b) {
  if (!a || !b) return 0;
  const setA = new Set(a.toLowerCase().split(/\s+/));
  const setB = new Set(b.toLowerCase().split(/\s+/));
  const inter = [...setA].filter(w => setB.has(w)).length;
  return inter / Math.max(setA.size, setB.size, 1);
}

// ─── Validación por lote (R1 + R7, sin R2) ───────────────────────────────────

function validateBatch(data, durMin, count) {
  if (!data?.clases || !Array.isArray(data.clases)) throw new Error('R1: falta clases[]');
  if (data.clases.length < count) throw new Error(`R1: se esperaban ${count} clases, llegaron ${data.clases.length}`);

  const tInicio     = durMin <= 50 ? 10 : 15;
  const tCierre     = durMin <= 50 ? 5  : 10;
  const tDesarrollo = durMin - tInicio - tCierre;
  const tiempos = { Inicio: tInicio, Desarrollo: tDesarrollo, Cierre: tCierre };

  for (let idx = 0; idx < count; idx++) {
    const clase = data.clases[idx];
    if (!Array.isArray(clase?.momentos) || clase.momentos.length !== 3) {
      throw new Error(`R1: clase ${idx + 1} debe tener 3 momentos`);
    }
    let totalMin = 0;
    for (const m of clase.momentos) {
      if (!Array.isArray(m.actividades) || m.actividades.length === 0) {
        throw new Error(`R1: clase ${idx + 1} momento "${m.nombre}" sin actividades`);
      }
      const esp = tiempos[m.nombre];
      if (esp !== undefined) { m.tiempo = `${esp} min`; totalMin += esp; }
      else totalMin += parseInt(m.tiempo) || 0;
    }
    if (totalMin !== durMin) throw new Error(`R7: clase ${idx + 1} suma ${totalMin} min ≠ ${durMin} min`);
  }
}

// ─── Validación semana completa (R1 + R7 + R2) ───────────────────────────────

function validateWeekPlan(data, durMin, numClases) {
  if (!data?.clases || data.clases.length < numClases) {
    throw new Error(`R1: semana incompleta (${data?.clases?.length ?? 0}/${numClases} clases)`);
  }
  const desarrollos = [];
  for (let idx = 0; idx < numClases; idx++) {
    const clase = data.clases[idx];
    for (const m of clase.momentos || []) {
      if (m.nombre === 'Desarrollo') desarrollos.push(m.actividades?.join(' ') || '');
    }
  }
  for (let idx = 0; idx < desarrollos.length - 1; idx++) {
    const sim = jaccardSimilarity(desarrollos[idx], desarrollos[idx + 1]);
    if (sim > 0.6) throw new Error(`R2: Desarrollo C${idx + 1} y C${idx + 2} demasiado similares (${(sim * 100).toFixed(0)}%)`);
  }
}

// ─── Memoria para anti-duplicación ───────────────────────────────────────────

function formatearMemoria(memoria) {
  if (!memoria.length) return '';
  const lines = memoria.map(e =>
    `- [S${e.semana}/C${e.dia} "${e.titulo}"]: ${e.desarrolloResumen}`,
  );
  return `\nACTIVIDADES YA PROGRAMADAS EN ESTA UNIDAD (no repetir las mismas):\n${lines.join('\n')}\n`;
}

// ─── Prompt de lote ───────────────────────────────────────────────────────────

function buildBatchPrompt(spec, semanaNum, startDia, count, durMin, numSemanas, memoria) {
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

  const endDia  = startDia + count - 1;
  const rango   = count === 1 ? `Clase ${startDia}` : `Clases ${startDia}-${endDia}`;

  return `Eres un planificador curricular experto del sistema educativo dominicano (MINERD).

TEMA: "${spec.temaOficial}"
ÁREA: ${spec.area} | GRADO: ${spec.grado} | SEMANA: ${semanaNum} de ${numSemanas} (${rango})

ESPECIFICACIÓN CURRICULAR:
- Competencias: ${ceText || '(ver indicadores)'}
- Indicadores: ${indText}
- Vocabulario: ${vocab}
- Gramática: ${gram}
- Funciones: ${funcs}
${formatearMemoria(memoria)}
TAREA: Genera exactamente ${count} clase(s) — ${rango} de la Semana ${semanaNum}.
Clases con PROGRESIÓN PEDAGÓGICA, DISTINTAS de las ya programadas.

REGLAS:
1. Solo JSON puro, sin texto ni markdown.
2. Desarrollos distintos entre sí y distintos a los ya listados arriba.
3. Tiempos: Inicio=${tInicio} min, Desarrollo=${tDesarrollo} min, Cierre=${tCierre} min.
4. Mínimo 2 actividades concretas por momento.

{"outputSchemaVersion":"1.0","semana":${semanaNum},"clases":[{"dia":${startDia},"titulo":"...","momentos":[{"nombre":"Inicio","tiempo":"${tInicio} min","actividades":["...","..."]},{"nombre":"Desarrollo","tiempo":"${tDesarrollo} min","actividades":["...","..."]},{"nombre":"Cierre","tiempo":"${tCierre} min","actividades":["...","..."]}]}]}`;
}

// ─── Generación de un lote (2 intentos por lote) ─────────────────────────────

async function generateWeekBatch(spec, semanaNum, startDia, count, durMin, numSemanas, memoria, contextoLog) {
  let maxTokens = MAX_TOKENS;
  let prefix    = '';
  let lastError = null;
  let lastProvider = 'desconocido';
  let lastModel    = 'desconocido';
  let lastRaw      = '';

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const prompt = prefix + buildBatchPrompt(spec, semanaNum, startDia, count, durMin, numSemanas, memoria);
      const { text: raw, provider, model } = await callGatewayCollect(prompt, SYSTEM_PROMPT, maxTokens);
      lastProvider = provider;
      lastModel    = model;
      lastRaw      = raw;

      const result = extraerJSON(raw);
      if (!result.ok) {
        await logParseError({ contexto: contextoLog, attempt, motivo: result.motivo, raw, provider, model });
        console.error(`[FaseA] ${contextoLog} intento ${attempt}: ${result.motivo}`,
          { inicio: raw.slice(0, 300), fin: raw.slice(-300) });
        lastError = new Error(result.motivo);
        if (result.motivo.includes('TRUNCADO')) maxTokens = 8000;
        else prefix = JSON_REMINDER;
        continue;
      }

      validateBatch(result.data, durMin, count);
      return result.data;

    } catch (err) {
      lastError = err;
      console.error(`[FaseA] ${contextoLog} intento ${attempt} (${lastProvider}/${lastModel}):`, err.message);
      await logParseError({
        contexto: contextoLog, attempt, motivo: err.message,
        raw: lastRaw, provider: lastProvider, model: lastModel,
      });
    }
  }

  throw new Error(
    `${contextoLog} falló tras 2 intentos [${lastProvider}/${lastModel}]. ` +
    `Motivo: ${lastError?.message}. ` +
    `Raw inicio: "${lastRaw.slice(0, 200)}" … fin: "${lastRaw.slice(-200)}"`,
  );
}

// ─── generateWeekPlan — exportación principal ─────────────────────────────────

export const generateWeekPlan = async (
  spec, semanaNum, durMin, numClases, numSemanas = 4,
  memoriaAcumulada = [], onProgress = null,
) => {
  const batches    = Math.ceil(numClases / BATCH_SIZE);
  const allClases  = [];

  for (let b = 0; b < batches; b++) {
    const startDia   = b * BATCH_SIZE + 1;
    const count      = Math.min(BATCH_SIZE, numClases - b * BATCH_SIZE);
    const endDia     = startDia + count - 1;
    const contextoLog = `S${semanaNum}/C${startDia}-${endDia}`;

    onProgress?.(startDia, endDia);

    const batchData = await generateWeekBatch(
      spec, semanaNum, startDia, count, durMin, numSemanas, memoriaAcumulada, contextoLog,
    );

    // Renumerar dias y agregar a la semana
    const nuevasClases = batchData.clases.slice(0, count).map((c, i) => ({
      ...c, dia: startDia + i,
    }));
    allClases.push(...nuevasClases);

    // Actualizar memoria para los lotes siguientes
    nuevasClases.forEach(c => {
      const desarrolloResumen =
        c.momentos?.find(m => m.nombre === 'Desarrollo')?.actividades?.[0] || '';
      memoriaAcumulada.push({
        semana: semanaNum,
        dia:    c.dia,
        titulo: c.titulo || `Clase ${c.dia}`,
        desarrolloResumen,
      });
    });
  }

  const combined = { outputSchemaVersion: '1.0', semana: semanaNum, clases: allClases };
  validateWeekPlan(combined, durMin, numClases);
  return combined;
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
