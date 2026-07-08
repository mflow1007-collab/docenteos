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
const MAX_TOKENS   = 6500;   // por lote (contrato incluye evidencias/metacognición/recursos); escala a 9000 si hay truncamiento

const SYSTEM_PROMPT =
  'Eres un planificador curricular experto del formato oficial MINERD. ' +
  'Redactas cada actividad iniciando con un VERBO en tercera persona plural del presente ' +
  '(Responden, Observan, Escuchan, Elaboran, Socializan, Practican, Identifican, Comparan, Guardan...) ' +
  'y NUNCA inicias con "Los estudiantes", "El docente", "La docente" ni "Se". ' +
  'El inglés va incrustado entre paréntesis dentro de la actividad. ' +
  'Estilo oficial de referencia: ' +
  '"Responden al saludo e indicaciones iniciales. (Good morning! How are you today? Are you ready for the class?)" · ' +
  '"Retroalimentación del vocabulario trabajado en la clase anterior. (Do you remember the last class? What words do you remember about daily routines?)" · ' +
  '"Elaboran un mapa de ideas sobre las actividades que consideran más importantes dentro de su rutina diaria. Socializan sus respuestas explicando brevemente por qué esas actividades son importantes para su vida." ' +
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

// ─── Contrato de estilo MINERD: voz de las actividades ────────────────────────
// Toda actividad inicia con VERBO en tercera persona plural del presente
// ("Responden...", "Observan...", "Elaboran..."). Prohibido iniciar con
// "Los...", "El docente", "La docente" o "Se ". Excepciones canónicas del
// formato oficial: "Retroalimentación..." y "Recuperación...".

const ARRANQUES_PROHIBIDOS = /^(los\s|el\s+docente|la\s+docente|se\s)/i;

export function validarVozActividad(texto) {
  const t = String(texto || '').trim();
  if (!t) return { ok: false, motivo: 'actividad vacía' };
  if (ARRANQUES_PROHIBIDOS.test(t)) {
    return { ok: false, motivo: `arranque prohibido ("Los/El docente/La docente/Se"): "${t.slice(0, 40)}…"` };
  }
  const primera = (t.split(/\s+/)[0] || '').replace(/[.,:;!¡¿?]+$/, '');
  const esVerboPluralPresente = /^[A-ZÁÉÍÓÚÜÑ]/.test(primera) && /n$/.test(primera);
  const esCanonica = primera === 'Retroalimentación' || primera === 'Recuperación';
  if (!esVerboPluralPresente && !esCanonica) {
    return { ok: false, motivo: `no inicia con verbo en tercera persona plural del presente: "${primera}"` };
  }
  return { ok: true };
}

// ─── Validación por lote (R1 + R7 + voz, sin R2) ─────────────────────────────
// Contrato completo por momento: evidencias + metacognicion + recursos
// (actividades solo en Desarrollo y Cierre: el Inicio se arma en código con
// las 5 posiciones canónicas). Por clase: saludoInicial,
// retroalimentacionPrevia, saberesPrevios, actividadEnganche e
// indicadoresTrabajados. La ausencia de cualquiera o una violación de voz =
// rechazo del lote (consume reintento). NUNCA render vacío ni plantilla.

function validateBatch(data, durMin, count) {
  if (!data?.clases || !Array.isArray(data.clases)) throw new Error('R1: falta clases[]');
  if (data.clases.length < count) throw new Error(`R1: se esperaban ${count} clases, llegaron ${data.clases.length}`);

  const tInicio     = durMin <= 50 ? 10 : 15;
  const tCierre     = durMin <= 50 ? 5  : 10;
  const tDesarrollo = durMin - tInicio - tCierre;
  const tiempos = { Inicio: tInicio, Desarrollo: tDesarrollo, Cierre: tCierre };

  const listaNoVacia = (v) => Array.isArray(v) && v.filter((x) => String(x || '').trim()).length > 0;
  const textoNoVacio = (v) => String(v || '').trim().length > 0;

  for (let idx = 0; idx < count; idx++) {
    const clase = data.clases[idx];
    if (!Array.isArray(clase?.momentos) || clase.momentos.length !== 3) {
      throw new Error(`R1: clase ${idx + 1} debe tener 3 momentos`);
    }
    if (!Array.isArray(clase.indicadoresTrabajados)) {
      throw new Error(`R1: clase ${idx + 1} sin indicadoresTrabajados[] (usa los códigos de la especificación)`);
    }

    // Piezas del Inicio canónico (el merge las coloca en posiciones fijas)
    for (const campo of ['saludoInicial', 'retroalimentacionPrevia', 'saberesPrevios', 'actividadEnganche']) {
      if (!textoNoVacio(clase[campo])) {
        throw new Error(`R1: clase ${idx + 1} sin ${campo} (contrato del Inicio canónico)`);
      }
    }
    // Voz obligatoria en las piezas redactadas como actividad
    for (const campo of ['retroalimentacionPrevia', 'saberesPrevios', 'actividadEnganche']) {
      const voz = validarVozActividad(clase[campo]);
      if (!voz.ok) throw new Error(`Voz: clase ${idx + 1} ${campo} — ${voz.motivo}`);
    }

    let totalMin = 0;
    for (const m of clase.momentos) {
      const esInicio = m.nombre === 'Inicio';
      if (!esInicio && !listaNoVacia(m.actividades)) {
        throw new Error(`R1: clase ${idx + 1} momento "${m.nombre}" sin actividades`);
      }
      if (!esInicio) {
        for (const act of m.actividades) {
          const voz = validarVozActividad(act);
          if (!voz.ok) throw new Error(`Voz: clase ${idx + 1} "${m.nombre}" — ${voz.motivo}`);
        }
      }
      if (!listaNoVacia(m.evidencias)) {
        throw new Error(`R1: clase ${idx + 1} momento "${m.nombre}" sin evidencias`);
      }
      if (!listaNoVacia(m.metacognicion)) {
        throw new Error(`R1: clase ${idx + 1} momento "${m.nombre}" sin metacognicion`);
      }
      if (!listaNoVacia(m.recursos)) {
        throw new Error(`R1: clase ${idx + 1} momento "${m.nombre}" sin recursos`);
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

// ─── Plan gramatical pre-repartido ────────────────────────────────────────────
// EL CÓDIGO decide el orden según la progresión del nivel; la IA compone
// alrededor de los focos asignados, no decide el orden.
//   Sem 1: SOLO vocabulario e introducción al tema — ninguna estructura
//          compleja (los comparativos y similares NUNCA en semana 1).
//   Sem 2+: las estructuras de la malla, en su orden oficial, repartidas
//          proporcionalmente entre las semanas restantes.

function getFocoGramatical(gramaticaArray, semanaNum, numSemanas) {
  if (!gramaticaArray?.length) return [];
  if (semanaNum === 1) return []; // sem 1: solo vocabulario/intro
  const semanasConGramatica = Math.max(numSemanas - 1, 1);
  const perWeek = Math.ceil(gramaticaArray.length / semanasConGramatica);
  const start   = (semanaNum - 2) * perWeek;
  return gramaticaArray.slice(start, start + perWeek);
}

// ─── Prompt de lote ───────────────────────────────────────────────────────────

function buildBatchPrompt(spec, semanaNum, startDia, count, durMin, numSemanas, memoria) {
  const tInicio     = durMin <= 50 ? 10 : 15;
  const tCierre     = durMin <= 50 ? 5  : 10;
  const tDesarrollo = durMin - tInicio - tCierre;

  const vocab      = spec.contenidosClaves?.vocabulario?.slice(0, 16).join(', ') || '';
  const funcs      = spec.contenidosClaves?.funcionales?.slice(0, 3).join('; ')  || '';
  // Indicadores CON código oficial: la IA reporta en indicadoresTrabajados
  // cuáles trabajó cada clase (usando exactamente esos códigos)
  const indText    = (spec.indicadores || []).slice(0, 3)
    .map(i => `[${i.codigoOficial || i.id || 's/c'}] ${i.descripcion || i.texto || ''}`)
    .filter(l => !l.endsWith('] ')).join(' | ');
  const ceText     = (spec.ces || []).slice(0, 2)
    .map(c => c.descripcion || '').filter(Boolean).join(' | ');
  const focoGram   = getFocoGramatical(spec.contenidosClaves?.gramatica, semanaNum, numSemanas);
  const focoGramTx = focoGram.length
    ? focoGram.join('; ')
    : 'SOLO vocabulario y expresiones del tema (semana introductoria: sin estructuras gramaticales nuevas)';
  const idiomaMeta = spec.esIdioma
    ? `en ${spec.idiomaNombre || 'inglés'} sencillo (nivel del estudiante)`
    : 'en español';

  const endDia  = startDia + count - 1;
  const rango   = count === 1 ? `Clase ${startDia}` : `Clases ${startDia}-${endDia}`;
  const esPrimeraClaseUnidad = semanaNum === 1 && startDia === 1;

  const reglaInicio = esPrimeraClaseUnidad
    ? `6. CADA clase incluye las piezas del Inicio: "saludoInicial" (solo el saludo en inglés, variado por clase: "Good morning! ..."), "retroalimentacionPrevia", "saberesPrevios" y "actividadEnganche" (actividad de observación/enganche del día, en la voz obligatoria). Para la PRIMERA clase de la unidad no hay clase anterior: "retroalimentacionPrevia" inicia con "Retroalimentación de experiencias relacionadas con..." (exploración diagnóstica del tema con preguntas EN INGLÉS entre paréntesis) y "saberesPrevios" (inicia con "Recuperación o exploración de saberes previos sobre...") puede versar sobre el tema o sobre cómo serán evaluados en la unidad. NO repitas saludo ni retroalimentación dentro de los momentos.`
    : `6. CADA clase incluye las piezas del Inicio: "saludoInicial" (solo el saludo en inglés, variado por clase: "Good morning! ..."), "retroalimentacionPrevia" (oración completa que inicia con "Retroalimentación de..." recordando lo trabajado en la clase anterior — usa las actividades ya programadas listadas arriba — con preguntas de recuerdo EN INGLÉS entre paréntesis), "saberesPrevios" (oración completa que inicia con "Recuperación o exploración de saberes previos sobre..." el contenido de ESTE día) y "actividadEnganche" (actividad de observación/enganche del día, en la voz obligatoria). NO repitas saludo ni retroalimentación dentro de los momentos.`;

  return `Eres un planificador curricular experto del sistema educativo dominicano (MINERD).

TEMA: "${spec.temaOficial}"
ÁREA: ${spec.area} | GRADO: ${spec.grado} | SEMANA: ${semanaNum} de ${numSemanas} (${rango})

ESPECIFICACIÓN CURRICULAR:
- Competencias: ${ceText || '(ver indicadores)'}
- Indicadores (con código): ${indText}
- Vocabulario disponible: ${vocab}
- FOCO GRAMATICAL ESTA SEMANA (usar en Desarrollo): ${focoGramTx}
- Funciones comunicativas: ${funcs}
${formatearMemoria(memoria)}
TAREA: Genera exactamente ${count} clase(s) — ${rango} de la Semana ${semanaNum}.
Clases con PROGRESIÓN PEDAGÓGICA, DISTINTAS de las ya programadas.
El foco gramatical asignado debe trabajarse explícitamente en el Desarrollo.

REGLAS:
1. Solo JSON puro, sin texto ni markdown.
2. Desarrollos distintos entre sí y distintos a los ya listados arriba.
3. Tiempos: Inicio=${tInicio} min, Desarrollo=${tDesarrollo} min, Cierre=${tCierre} min.
4. VOZ OBLIGATORIA: toda actividad inicia con VERBO en tercera persona plural del presente ("Responden...", "Observan...", "Elaboran...", "Socializan..."). PROHIBIDO iniciar con "Los estudiantes", "El docente", "La docente" o "Se". El inglés va incrustado entre paréntesis dentro de la actividad. Los depósitos al portafolio se nombran explícitos ("Guardan la producción escrita como Entrada N del Portafolio.").
5. Desarrollo: mínimo 2 actividades concretas. Cierre (patrón guía): Socializan las producciones del día → Reflexionan sobre un aspecto específico → Organizan y guardan el artefacto en el portafolio → Responden preguntas de reflexión.
${reglaInicio}
7. CADA momento (incluido Inicio) incluye: "evidencias" (2-3 evidencias observables y evaluables de ESE momento, en español), "metacognicion" (2 preguntas de reflexión para el estudiante, ${idiomaMeta}) y "recursos" (2-4 recursos didácticos concretos de ESE momento, en español). Nada puede quedar vacío.
8. CADA clase incluye "indicadoresTrabajados": los códigos de los indicadores de la especificación que esa clase trabaja realmente (mínimo 1).

{"outputSchemaVersion":"1.2","semana":${semanaNum},"clases":[{"dia":${startDia},"titulo":"...","indicadoresTrabajados":["..."],"saludoInicial":"Good morning! ...","retroalimentacionPrevia":"Retroalimentación de... (...?)","saberesPrevios":"Recuperación o exploración de saberes previos sobre...","actividadEnganche":"Observan...","momentos":[{"nombre":"Inicio","tiempo":"${tInicio} min","evidencias":["...","..."],"metacognicion":["...","..."],"recursos":["...","..."]},{"nombre":"Desarrollo","tiempo":"${tDesarrollo} min","actividades":["...","..."],"evidencias":["...","..."],"metacognicion":["...","..."],"recursos":["...","..."]},{"nombre":"Cierre","tiempo":"${tCierre} min","actividades":["...","...","..."],"evidencias":["...","..."],"metacognicion":["...","..."],"recursos":["...","..."]}]}]}`;
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
        if (result.motivo.includes('TRUNCADO')) maxTokens = 9000;
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

  // Reintentos agotados → DETENER, nunca degradar a plantillas en silencio.
  // FUTURO: cuando exista el Banco de Secuencias, el respaldo legítimo es
  // servir una secuencia cosechada y validada — nunca plantillas.
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

  const esIdioma = area === 'Inglés' || area === 'Francés';

  return {
    temaOficial: titulo,
    area,
    grado,
    nivelMCERL:  mallaPayload?.nivelMCERL || null,
    esIdioma,
    idiomaNombre: esIdioma ? (area === 'Francés' ? 'francés' : 'inglés') : null,
    ces,
    indicadores,
    contenidosClaves: {
      vocabulario: mallaContenidos?.vocabulario?.slice(0, 20) || [],
      gramatica:   mallaContenidos?.gramatica?.slice(0, 6)   || [],
      funcionales: mallaContenidos?.funcionales?.slice(0, 5) || [],
    },
    outputSchemaVersion: '1.2',
  };
};
