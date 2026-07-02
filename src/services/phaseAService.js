/**
 * Phase A — AI Gateway para generación de clases
 *
 * Reemplaza los generadores JS de actividades con llamadas reales a la IA.
 * Una llamada por semana → 4 clases con Inicio/Desarrollo/Cierre.
 *
 * Reglas:
 *   R1: Schema válido (clases[], momentos[], actividades[])
 *   R2: Actividades de Desarrollo difieren ≥60% entre clases de la misma semana
 *   R7: Suma de tiempos = durMin exactamente
 *
 * PROHIBIDO: Fallback a templates JS si la IA falla.
 *   → Retry 2x, luego error visible al usuario.
 */

import { getAuth } from 'firebase/auth';

const MAX_RETRIES = 2;

// ─── SSE collector — acumula el stream del gateway y retorna texto completo ──

async function callGatewayCollect(prompt, system) {
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
    body: JSON.stringify({
      module: 'planificacion_semana',
      prompt,
      system,
      maxTokens: 4096,
    }),
  });

  if (!response.ok) {
    let msg = `HTTP ${response.status}`;
    try { const b = await response.json(); msg = b.error || msg; } catch {}
    throw new Error(msg);
  }

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
      try { text += JSON.parse(raw).delta || ''; } catch {}
    }
  }
  return text;
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
  // R1: estructura
  if (!data?.clases || !Array.isArray(data.clases)) throw new Error('R1: falta clases[]');
  if (data.clases.length < numClases) {
    throw new Error(`R1: se esperaban ${numClases} clases, llegaron ${data.clases.length}`);
  }

  const tInicio     = durMin <= 50 ? 10 : 15;
  const tCierre     = durMin <= 50 ? 5  : 10;
  const tDesarrollo = durMin - tInicio - tCierre;
  const tiemposEsperados = {
    'Inicio':     tInicio,
    'Desarrollo': tDesarrollo,
    'Cierre':     tCierre,
  };

  const desarrollos = [];

  for (let i = 0; i < numClases; i++) {
    const clase = data.clases[i];
    if (!Array.isArray(clase?.momentos) || clase.momentos.length !== 3) {
      throw new Error(`R1: clase ${i + 1} debe tener exactamente 3 momentos`);
    }

    let totalMin = 0;
    for (const m of clase.momentos) {
      // R1: actividades no vacías
      if (!Array.isArray(m.actividades) || m.actividades.length === 0) {
        throw new Error(`R1: clase ${i + 1} momento "${m.nombre}" sin actividades`);
      }

      // Normalizar y corregir tiempos automáticamente si el nombre es correcto
      const esperado = tiemposEsperados[m.nombre];
      if (esperado !== undefined) {
        m.tiempo = `${esperado} min`;
        totalMin += esperado;
      } else {
        const parsed = parseInt(m.tiempo) || 0;
        totalMin += parsed;
      }

      if (m.nombre === 'Desarrollo') {
        desarrollos.push(m.actividades.join(' '));
      }
    }

    // R7: la corrección automática garantiza exactitud — pero verificamos igual
    if (totalMin !== durMin) {
      throw new Error(`R7: clase ${i + 1} suma ${totalMin} min ≠ ${durMin} min`);
    }
  }

  // R2: diversidad de Desarrollos (Jaccard < 0.6 entre pares consecutivos)
  for (let i = 0; i < desarrollos.length - 1; i++) {
    const sim = jaccardSimilarity(desarrollos[i], desarrollos[i + 1]);
    if (sim > 0.6) {
      throw new Error(
        `R2: Desarrollo clase ${i + 1} y ${i + 2} son demasiado similares (${(sim * 100).toFixed(0)}%)`,
      );
    }
  }
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildWeekPrompt(spec, semanaNum, numClases, durMin, numSemanas) {
  const tInicio     = durMin <= 50 ? 10 : 15;
  const tCierre     = durMin <= 50 ? 5  : 10;
  const tDesarrollo = durMin - tInicio - tCierre;

  const vocab   = spec.contenidosClaves?.vocabulario?.slice(0, 16).join(', ') || '';
  const gram    = spec.contenidosClaves?.gramatica?.slice(0, 4).join('; ')    || '';
  const funcs   = spec.contenidosClaves?.funcionales?.slice(0, 3).join('; ')  || '';
  const indText = (spec.indicadores || []).slice(0, 3).map(i => i.descripcion || i.texto || '').filter(Boolean).join(' | ');
  const ceText  = (spec.ces || []).slice(0, 2).map(c => c.descripcion || '').filter(Boolean).join(' | ');

  return `Eres un planificador curricular experto del sistema educativo dominicano (MINERD).

TEMA: "${spec.temaOficial}"
ÁREA: ${spec.area} | GRADO: ${spec.grado} | SEMANA: ${semanaNum} de ${numSemanas}

ESPECIFICACIÓN CURRICULAR OFICIAL:
- Competencias específicas: ${ceText || '(ver indicadores)'}
- Indicadores de logro: ${indText}
- Vocabulario clave: ${vocab}
- Estructuras gramaticales: ${gram}
- Funciones comunicativas: ${funcs}

TAREA: Genera exactamente ${numClases} clases para la Semana ${semanaNum}.
Cada clase debe mostrar PROGRESIÓN PEDAGÓGICA dentro de la semana.

REGLAS OBLIGATORIAS:
1. Devuelve SOLO JSON válido — sin texto antes ni después, sin bloques markdown.
2. Los Desarrollos de cada clase deben ser DISTINTOS entre sí (contenido diferente, no reformulaciones).
3. Tiempos fijos por momento: Inicio=${tInicio} min, Desarrollo=${tDesarrollo} min, Cierre=${tCierre} min.
4. Cada momento debe tener al menos 2 actividades concretas y accionables.
5. Usa vocabulario y estructuras del corpus indicado arriba.

FORMATO EXACTO:
{
  "outputSchemaVersion": "1.0",
  "semana": ${semanaNum},
  "clases": [
    {
      "dia": 1,
      "titulo": "título breve de la clase",
      "momentos": [
        { "nombre": "Inicio", "tiempo": "${tInicio} min", "actividades": ["actividad 1", "actividad 2"] },
        { "nombre": "Desarrollo", "tiempo": "${tDesarrollo} min", "actividades": ["actividad principal 1", "actividad principal 2"] },
        { "nombre": "Cierre", "tiempo": "${tCierre} min", "actividades": ["actividad de cierre 1", "actividad de cierre 2"] }
      ]
    }
  ]
}`;
}

// ─── buildEspecificacionCurricular — exportada para uso externo ───────────────

export const buildEspecificacionCurricular = ({
  mallaPayload, titulo, allInds, allComps, mallaContenidos, area, grado,
}) => {
  // Nivel MCERL si existe (para Inglés)
  const nivelMCERL = mallaPayload?.nivelMCERL || null;

  const ces = (allComps || []).slice(0, 4).map(c => ({
    id:           c.id || '',
    codigoOficial: c.id || '',
    descripcion:  c.especificaGrado || c.especifica || '',
  })).filter(c => c.descripcion);

  const indicadores = (allInds || []).slice(0, 9).map(ind => ({
    id:           ind.id || '',
    codigoOficial: ind.id || '',
    descripcion:  ind.descripcion || ind.texto || '',
    aspecto:      '',
  })).filter(i => i.descripcion);

  return {
    temaOficial: titulo,
    area,
    grado,
    nivelMCERL,
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

// ─── generateWeekPlan — exportación principal ─────────────────────────────────

export const generateWeekPlan = async (spec, semanaNum, durMin, numClases, numSemanas = 4) => {
  const system = 'Eres un planificador curricular experto. Respondes ÚNICAMENTE con JSON válido, sin explicaciones adicionales.';
  const prompt = buildWeekPrompt(spec, semanaNum, numClases, durMin, numSemanas);

  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      const raw = await callGatewayCollect(prompt, system);

      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('La IA no devolvió JSON en su respuesta');

      const data = JSON.parse(match[0]);
      validateWeekPlan(data, durMin, numClases);
      return data;
    } catch (err) {
      lastError = err;
      console.warn(`[PhaseA] Semana ${semanaNum}, intento ${attempt}/${MAX_RETRIES + 1}:`, err.message);
    }
  }

  throw new Error(
    `Error generando Semana ${semanaNum} tras ${MAX_RETRIES + 1} intentos. ` +
    `Último error: ${lastError?.message}. ` +
    `Verifica la configuración de IA en Administración o intenta de nuevo.`,
  );
};
