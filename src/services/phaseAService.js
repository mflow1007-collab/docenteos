/**
 * Phase A — Generación de clases por lotes de 2
 *
 * La semana se genera en LOTES DE 2 CLASES por llamada:
 *   - 4 clases/semana = 2 lotes; 5 clases = 3 lotes (2+2+1)
 *   - ~3-4K tokens de salida por lote → TTFT <10s incluso con NVIDIA
 *   - Cada lote lleva MEMORIA de todo lo generado para anti-duplicación
 *   - Reintentos: rota proveedores y conserva los lotes buenos
 *   - R1+R7 se validan por lote; R2 se valida sobre la semana fusionada
 *
 * PROHIBIDO: fallback a templates JS.
 */

import { getAuth }                              from 'firebase/auth';
import { collection, addDoc, serverTimestamp }  from 'firebase/firestore';
import { db }                                   from '../firebase.js';
import { invalidateGatewayConfig, loadGatewayConfig } from './ai/AIService.js';
import { logUsage }                             from './ai/usage.js';
import {
  construirArquitecturaUnidadMINERD,
  resolverFocosCurriculares,
  resumirArquitecturaParaPrompt,
} from './curriculumBrainService.js';
import { nivelCanonico } from '../data/fundamentoDoctrinalMINERD.js';
import { ESTRATEGIAS_OFICIALES_TEXTO } from '../data/estrategiasOficialesMINERD.js';
import { resolverNaturalezaArea } from '../data/naturalezaAreasMINERD.js';
import { getFundamentoDoctrinal } from './fundamentoDoctrinalService.js';

const MODULE_NAME  = 'planificacion';
const BATCH_SIZE   = 2;
const MAX_TOKENS   = 12000;  // por lote (contrato incluye evidencias/metacognición/recursos por momento × clases; modelos verbosos se truncaban a 9000)
const RETRY_TOKENS = 20000;  // reintento tras truncamiento — techo generoso para modelos verbosos (deepseek, etc.)
const SINGLE_CLASS_MAX_TOKENS = 7000;
const SINGLE_CLASS_RETRY_TOKENS = 12000;
const CHECKPOINT_PREFIX = 'docenteos_phase_a_checkpoint_v4';
const CHECKPOINT_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_INDICADORES_TRABAJO_UNIDAD = 6;
const PHASE_A_FETCH_TIMEOUT_MS = 90_000;

// CAPACIDAD PRIMERO. La composición de clases exige modelos de capacidad alta:
// los flash/mini/lite devuelven JSON válido pero OMITEN clases[] (cumplen los
// campos fáciles del lote y esquivan el trabajo de componer) — caso real
// S3/C2 con gemini-2.5-flash tras 10 intentos (2026-07-15). La política
// anterior de "costo primero con gpt-4o-mini forzado" queda revertida para
// este módulo: el validador rechaza la basura, pero reintentar contra un
// modelo que no puede componer solo quema llamadas.
const PHASE_A_PROVIDER_ORDER = ['openai', 'anthropic', 'gemini', 'abacus'];

// Allowlist de COMPOSICIÓN: el modelo fuerte de cada proveedor. Un proveedor
// sin entrada aquí NO participa en la composición Fase A.
const MODELOS_COMPOSICION = {
  openai:    'gpt-4o',
  gemini:    'gemini-2.5-pro',
  anthropic: 'claude-sonnet-5',
  abacus:    'gpt-4o',
};

// Denylist explícita: si el admin configuró una variante débil para un
// proveedor, para ESTE módulo se ignora y se usa el de la allowlist.
const MODELO_DEBIL_RE = /flash|mini|lite|nano|tiny|small|haiku/i;
const PROVIDER_BUDGET_ERROR_RE =
  /no remaining credits|credit balance|credits? to use|current quota|exceeded.*quota|quota exceeded|rate[- ]?limit|billing|purchase credits|insufficient[_ -]?quota|HTTP 429|\b429\b/i;
const PROVIDER_BUDGET_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const providerBudgetCooldowns = new Map();

const isProviderBudgetError = (errOrMsg) => {
  const msg = String(errOrMsg?.message || errOrMsg || "");
  return PROVIDER_BUDGET_ERROR_RE.test(msg) || Number(errOrMsg?.status) === 429;
};

const getBudgetCooldownProviders = () => {
  const now = Date.now();
  for (const [provider, until] of providerBudgetCooldowns.entries()) {
    if (!until || until <= now) providerBudgetCooldowns.delete(provider);
  }
  return [...providerBudgetCooldowns.keys()];
};

const cooldownProviderForBudget = (provider, reason = "") => {
  if (!provider || provider === "desconocido") return;
  providerBudgetCooldowns.set(provider, Date.now() + PROVIDER_BUDGET_COOLDOWN_MS);
  console.warn(`[FaseA] Proveedor ${provider} bloqueado temporalmente por crédito/cuota: ${String(reason).slice(0, 240)}`);
};

// Modelo apto para composición: el del admin si es fuerte; si es débil o no
// hay, el de la allowlist; null = proveedor no apto (se salta al siguiente).
function modeloComposicion(provider, adminModels = {}) {
  const admin = String(adminModels?.[provider] || '').trim();
  if (admin && !MODELO_DEBIL_RE.test(admin)) return admin;
  return MODELOS_COMPOSICION[provider] || null;
}

// Exemplars de estilo: MÁXIMO uno por concepto (saludo, retroalimentación,
// producción). Se listan aparte porque también alimentan la validación
// anti-copia: un Desarrollo que calque un exemplar del prompt se rechaza.
export const EXEMPLARS_ESTILO = [
  'Responden al saludo e indicaciones iniciales. (Good morning! How are you today? Are you ready for the class?)',
  'Retroalimentación del vocabulario trabajado en la clase anterior. (Do you remember the last class? What words do you remember about daily routines?)',
  'Elaboran un mapa de ideas sobre las actividades que consideran más importantes dentro de su rutina diaria. Socializan sus respuestas explicando brevemente por qué esas actividades son importantes para su vida.',
];

// B3 — etiqueta del nivel para los prompts ("Secundario"/"Primario"/"Inicial").
// Antes el system decía "Nivel Secundario" hardcodeado y mentía para
// Primaria/Inicial; el nivel real llega en spec.nivel desde la malla.
const NIVEL_LABEL = { Secundaria: 'Secundario', Primaria: 'Primario', Inicial: 'Inicial' };
export const nivelLabelPrompt = (nivel = '') =>
  NIVEL_LABEL[nivelCanonico(nivel)] || 'Secundario';

export const buildSystemPromptFaseA = (nivel = '') =>
  // PERSONAJE EXPERTO (transversal a TODAS las asignaturas del MINERD, no solo
  // idiomas). El estándar de calidad es el de un docente dominicano excelente:
  // planificaciones ricas, contextualizadas a la comunidad, con un producto
  // final tangible al que cada clase aporta una pieza, actividades con misión
  // nombrada y evidencias observables. El CONTENIDO (vocabulario, fórmulas,
  // conceptos) lo aporta SIEMPRE la malla del área — nunca lo inventa el rol.
  `Eres un docente dominicano experto del Nivel ${nivelLabelPrompt(nivel)} que planifica con la calidad y el detalle ` +
  'del mejor docente del MINERD, para CUALQUIER asignatura (Lengua Española, Matemática, Ciencias ' +
  'Sociales, Ciencias de la Naturaleza, Lenguas Extranjeras, Educación Artística, Física, Formación ' +
  'Integral Humana y Religiosa). Tu sello: contextualizas a la realidad de la comunidad del docente; ' +
  'construyes un PRODUCTO FINAL tangible al que cada clase aporta una pieza concreta; cada Desarrollo ' +
  'tiene una MISIÓN con nombre propio memorable apropiada a la asignatura; las evidencias son ' +
  'observables y evaluables; y la metacognición hace pensar al estudiante. ' +
  'Redactas cada actividad iniciando con un VERBO en tercera persona plural del presente ' +
  '(Responden, Observan, Escuchan, Elaboran, Socializan, Practican, Identifican, Comparan, Guardan...). ' +
  'PROHIBIDO iniciar con sustantivos o etiquetas como "Ticket", "Reflexión", "Evaluación", "Lectura", "Presentación", "Trabajo colaborativo", ' +
  '"Los estudiantes", "El docente", "La docente" o "Se" — escribe directamente el verbo de acción. ' +
  'Excepciones canónicas del formato MINERD que SÍ pueden iniciar sin verbo: "Retroalimentación de…" y "Recuperación de saberes previos…". ' +
  'Si la asignatura es de idioma, el término en el idioma va incrustado entre paréntesis dentro de la actividad. ' +
  'Estilo oficial de referencia (referencia de VOZ, jamás los copies como actividades): ' +
  EXEMPLARS_ESTILO.map((e) => `"${e}"`).join(' · ') + ' ' +
  'Respondes ÚNICAMENTE con JSON válido, sin texto adicional ni bloques markdown.';

const JSON_REMINDER =
  'RECUERDA: responde ÚNICAMENTE el objeto JSON, sin texto antes ni después, sin markdown.\n\n';

// Neutro a propósito: el reintento puede caer en OTRO proveedor distinto al
// que omitió clases[], así que no afirma "tu respuesta anterior".
const buildMissingClassesRepairPrefix = ({ semanaNum, startDia, count }) =>
  `ATENCIÓN: un intento anterior devolvió JSON válido pero SIN "clases[]" — eso INVALIDA el lote.
Es OBLIGATORIO devolver un objeto con:
- "outputSchemaVersion": "1.3"
- "semana": ${semanaNum}
- "adaptacionesSemana"
- "observacionesSemana"
- "clases": arreglo con EXACTAMENTE ${count} clase(s), desde el día ${startDia}

NO devuelvas solo adaptaciones u observaciones. Si falta "clases[]", el lote falla.
Responde únicamente JSON puro con "clases[]" completo.\n\n`;

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

async function resolvePhaseAProviderOrder() {
  try {
    invalidateGatewayConfig();
    const gwConfig = await loadGatewayConfig();
    const disabled = [
      ...(Array.isArray(gwConfig.disabled) ? gwConfig.disabled : []),
      ...getBudgetCooldownProviders(),
    ];
    const priority = Array.isArray(gwConfig.priority) && gwConfig.priority.length
      ? gwConfig.priority
      : PHASE_A_PROVIDER_ORDER;
    const ordered = [
      ...priority,
      ...PHASE_A_PROVIDER_ORDER.filter((p) => !priority.includes(p)),
    ].filter((p, i, arr) => p && arr.indexOf(p) === i)
      // Proveedores apagados por el admin: jamás se usan, ni como fallback.
      .filter((p) => !disabled.includes(p))
      // Solo proveedores con modelo APTO para composición (allowlist)
      .filter((p) => modeloComposicion(p, gwConfig.models));
    // Fase A no usa NVIDIA: en composiciones largas se queda agotando tiempo.
    // Debe haber OpenAI, Anthropic, Gemini o Abacus configurado.
    return ordered.filter((p) => p !== 'nvidia');
  } catch {
    return PHASE_A_PROVIDER_ORDER.filter((p) => MODELOS_COMPOSICION[p]);
  }
}

async function callGatewayCollect(
  prompt,
  system,
  maxTokens = MAX_TOKENS,
  providerOrder = PHASE_A_PROVIDER_ORDER,
  providersDisabledExtra = [],
  strictProvider = false,
) {
  const user = getAuth().currentUser;
  if (!user) throw new Error('Usuario no autenticado');

  let idToken;
  try { idToken = await user.getIdToken(false); } catch { idToken = null; }

  // Config del admin (prioridad, modelos y APAGADOS): la generación de
  // unidades respeta el mismo interruptor de proveedores que el resto
  let gwConfig = {};
  try {
    invalidateGatewayConfig();
    gwConfig = await loadGatewayConfig();
  } catch { /* no-fatal */ }
  const adminDisabled = [
    ...(Array.isArray(gwConfig.disabled) ? gwConfig.disabled : []),
    ...getBudgetCooldownProviders(),
  ];
  if (strictProvider) {
    const requested = Array.isArray(providerOrder) ? providerOrder.filter(Boolean) : [];
    const blocked = requested.filter((p) => adminDisabled.includes(p));
    if (requested.length && blocked.length === requested.length) {
      const err = new Error(`Proveedor desactivado por el administrador: ${blocked.join(", ")}`);
      err.provider = blocked[0] || "desconocido";
      throw err;
    }
  }

  // Modelo fuerte por proveedor para ESTE módulo; los proveedores sin modelo
  // apto quedan además deshabilitados por si el gateway intenta caer en ellos
  const modelosAptos = {};
  const sinModeloApto = [];
  for (const p of (providerOrder || [])) {
    const m = modeloComposicion(p, gwConfig.models);
    if (m) modelosAptos[p] = m;
    else sinModeloApto.push(p);
  }

  const providersDisabled = [
    // Apagados por el admin: jamás se usan, ni como fallback. Fase A puede
    // quedarse sin proveedor si el administrador apaga todos los aptos; eso es
    // preferible a llamar un proveedor explícitamente desactivado.
    ...adminDisabled,
    ...(Array.isArray(providersDisabledExtra) ? providersDisabledExtra : []),
    ...sinModeloApto,
  ].filter((v, i, arr) => v && arr.indexOf(v) === i);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PHASE_A_FETCH_TIMEOUT_MS);
  let response;
  try {
    response = await fetch('/api/ai/generate', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify({
        module: MODULE_NAME,
        prompt,
        system,
        maxTokens,
        providerOrder,
        modelOverrides: modelosAptos,
        providersDisabled: providersDisabled.length ? providersDisabled : undefined,
        strictProvider,
        requireNonEmpty: true,
      }),
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      const error = new Error(`tiempo de espera agotado (${Math.round(PHASE_A_FETCH_TIMEOUT_MS / 1000)}s)`, { cause: err });
      error.provider = providerOrder?.[0] || 'desconocido';
      error.model = modelosAptos?.[error.provider] || 'desconocido';
      error.timeout = true;
      throw error;
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    let msg = `HTTP ${response.status}`;
    try { const b = await response.json(); msg = b.error || msg; } catch {}
    const error = new Error(msg);
    error.provider = response.headers.get('X-AI-Provider') || providerOrder?.[0] || 'desconocido';
    error.model = response.headers.get('X-AI-Model') || 'desconocido';
    error.status = response.status;
    throw error;
  }

  const usedProvider = response.headers.get('X-AI-Provider') || 'desconocido';
  const usedModel    = response.headers.get('X-AI-Model')    || 'desconocido';

  const reader  = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text   = '';
  let usage  = null;

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
        if (parsed.usage) usage = parsed.usage; // tokens EXACTOS del proveedor
      } catch {}
    }
  }

  return { text, provider: usedProvider, model: usedModel, usage };
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
// Stopwords en español e inglés + términos pedagógicos/temáticos estructurales
// que aparecen en TODAS las clases del mismo tema y causarían falsos positivos
// (ej. "present", "simple", "daily", "routine" en cualquier clase de inglés).
const JACCARD_STOPWORDS = new Set([
  // español funcional
  'a','al','ante','con','de','del','desde','e','el','en','entre','es','esa','ese',
  'eso','esta','este','esto','hacia','hasta','la','las','le','les','lo','los','más',
  'me','mi','mis','muy','ni','no','nos','o','para','pero','por','que','se','si',
  'sin','su','sus','también','te','tu','tus','un','una','unas','uno','unos','y',
  'ya','yo',
  // inglés funcional
  'a','an','and','are','as','at','be','been','being','but','by','do','does','for',
  'from','has','have','he','her','his','how','i','if','in','is','it','its','me',
  'my','not','of','on','or','our','s','she','so','that','the','their','them',
  'they','this','to','us','was','we','were','what','when','which','who','will',
  'with','you','your',
  // pedagógicos estructurales (aparecen en toda clase del mismo tema)
  'actividad','actividades','clase','clases','día','dias','estudiantes','docente',
  'momento','momentos','inicio','desarrollo','cierre','semana','unidad','tema',
  'present','simple','daily','routine','routines','time','activities','students',
  'class','lesson','learning','work','use','using','make','can','my','their',
]);

function jaccardSimilarity(a, b) {
  if (!a || !b) return 0;
  const tokenizar = (t) => t.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !JACCARD_STOPWORDS.has(w));
  const tA = tokenizar(a);
  const tB = tokenizar(b);
  if (!tA.length || !tB.length) return 0;
  const setA = new Set(tA);
  const setB = new Set(tB);
  const inter = [...setA].filter(w => setB.has(w)).length;
  return inter / Math.max(setA.size, setB.size, 1);
}

// ─── Contrato de estilo MINERD: voz de las actividades ────────────────────────
// Toda actividad inicia con VERBO en tercera persona plural del presente
// ("Responden...", "Observan...", "Elaboran..."). Prohibido iniciar con
// "Los...", "El docente", "La docente" o "Se ". Excepciones canónicas del
// formato oficial: "Retroalimentación..." y "Recuperación...".

const ARRANQUES_PROHIBIDOS = /^(los\s|el\s+docente|la\s+docente|se\s)/i;
const ARRANQUES_NOMINALES = /^(ticket|exit\s+ticket|reflexi[oó]n|metacognici[oó]n|socializaci[oó]n|portafolio|evaluaci[oó]n|pregunta|recurso|hoja|ficha|pizarra|pr[aá]ctica|modelado|producci[oó]n|lectura|escritura|trabajo|din[aá]mica|juego|di[aá]logo|conversaci[oó]n|presentaci[oó]n|retroalimentaci[oó]n\s+breve)\b/i;
const VERBOS_VOZ_MINERD = [
  'Responden', 'Observan', 'Escuchan', 'Elaboran', 'Socializan',
  'Practican', 'Identifican', 'Comparan', 'Guardan', 'Completan',
  'Registran', 'Reflexionan', 'Relacionan', 'Organizan', 'Presentan',
  'Leen', 'Escriben', 'Dibujan', 'Clasifican', 'Formulan',
];

export function validarVozActividad(texto) {
  const t = String(texto || '').trim();
  if (!t) return { ok: false, motivo: 'actividad vacía' };
  if (ARRANQUES_PROHIBIDOS.test(t)) {
    return { ok: false, motivo: `arranque prohibido ("Los/El docente/La docente/Se"): "${t.slice(0, 40)}…"` };
  }
  const primera = (t.split(/\s+/)[0] || '').replace(/[.,:;!¡¿?]+$/, '');
  const esCanonica = primera === 'Retroalimentación' || primera === 'Recuperación';
  if (!esCanonica && ARRANQUES_NOMINALES.test(t)) {
    return { ok: false, motivo: `inicia con sustantivo o recurso, no con acción observable: "${primera}"` };
  }
  const esVerboPluralPresente = /^[A-ZÁÉÍÓÚÜÑ]/.test(primera) && /n$/.test(primera);
  if (!esVerboPluralPresente && !esCanonica) {
    return { ok: false, motivo: `no inicia con verbo en tercera persona plural del presente: "${primera}"` };
  }
  return { ok: true };
}

export function normalizarVozActividadMINERD(texto) {
  const original = String(texto || '').trim();
  if (!original) return original;
  if (validarVozActividad(original).ok) return original;

  const limpiar = (value) => String(value || '')
    .replace(/^\s*[-•\d.)]+\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
  const capitalizar = (value) => {
    const t = limpiar(value);
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
  };

  let t = limpiar(original);

  const reemplazosDirectos = [
    [/^los\s+estudiantes\s+(responden|observan|escuchan|elaboran|socializan|practican|identifican|comparan|guardan|completan|registran|reflexionan|relacionan|organizan|presentan|leen|escriben|dibujan|clasifican|formulan)\b/i, '$1'],
    [/^ticket(?:\s+de\s+salida|\s+final)?\b[:：-]?\s*/i, 'Completan un ticket de salida '],
    [/^exit\s+ticket\b[:：-]?\s*/i, 'Completan un ticket de salida '],
    [/^pregunta(?:\s+final)?\b[:：-]?\s*/i, 'Responden una pregunta final '],
    [/^reflexi[oó]n\b[:：-]?\s*/i, 'Reflexionan '],
    [/^metacognici[oó]n\b[:：-]?\s*/i, 'Reflexionan '],
    [/^socializaci[oó]n\b[:：-]?\s*/i, 'Socializan '],
    [/^puesta\s+en\s+com[uú]n\b[:：-]?\s*/i, 'Socializan '],
    [/^portafolio\b[:：-]?\s*/i, 'Guardan la evidencia en el portafolio '],
    [/^evaluaci[oó]n\b[:：-]?\s*/i, 'Completan una evaluación formativa '],
    [/^pr[aá]ctica(?:\s+guiada|\s+colaborativa|\s+individual)?\b[:：-]?\s*/i, 'Practican '],
    [/^modelado\b[:：-]?\s*/i, 'Observan un modelado '],
    [/^producci[oó]n(?:\s+oral|\s+escrita)?\b[:：-]?\s*/i, 'Elaboran una producción '],
    [/^lectura\b[:：-]?\s*/i, 'Leen '],
    [/^escritura\b[:：-]?\s*/i, 'Escriben '],
    [/^trabajo\s+colaborativo\b[:：-]?\s*/i, 'Trabajan colaborativamente '],
    [/^din[aá]mica\b[:：-]?\s*/i, 'Participan en una dinámica '],
    [/^juego\b[:：-]?\s*/i, 'Participan en un juego '],
    [/^di[aá]logo\b[:：-]?\s*/i, 'Dialogan '],
    [/^conversaci[oó]n\b[:：-]?\s*/i, 'Conversan '],
    [/^presentaci[oó]n\b[:：-]?\s*/i, 'Presentan '],
    [/^retroalimentaci[oó]n\s+breve\b[:：-]?\s*/i, 'Socializan una retroalimentación breve '],
  ];

  for (const [regex, replacement] of reemplazosDirectos) {
    if (regex.test(t)) {
      t = t.replace(regex, replacement);
      return capitalizar(t);
    }
  }

  if (/^(el|la)\s+docente\s+(presenta|modela|explica|muestra|orienta|gu[ií]a|lee|proyecta)\b/i.test(t)) {
    return capitalizar(t.replace(/^(el|la)\s+docente\s+(presenta|modela|explica|muestra|orienta|gu[ií]a|lee|proyecta)\b/i, 'Observan'));
  }

  const primera = (t.split(/\s+/)[0] || '').replace(/[.,:;!¡¿?]+$/, '');
  if (VERBOS_VOZ_MINERD.includes(primera)) return t;

  // Verbo en SINGULAR o imperativo ("Etiqueta", "Observa", "Escribe", "Completa"):
  // el caso más común que se le escapa a la IA. Se pluraliza a 3ª persona plural
  // agregando/ajustando la desinencia -n, que es lo único que exige la voz MINERD.
  // -a/-e/-o → +n (Etiqueta→Etiquetan, Escribe→Escriben, Dibujo→Dibujan);
  // -á/-é acentuada (imperativo raro) → base + n. Solo si arranca en mayúscula y
  // no cae en arranques prohibidos/nominales (ya filtrados arriba).
  // Palabras funcionales que terminan en vocal pero NO son verbos: nunca
  // pluralizar (Se/El/La ya son arranques prohibidos; De/Le/Se/Lo evitan
  // falsos "Sen/Len"). Exigimos además un verbo de ≥4 letras.
  const NO_VERBOS = /^(se|el|la|lo|le|de|una?|su|sus|los|las|sus|dos|tres)$/i;
  const arranqueVerbal = /^[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]+$/.test(primera)
    && !NO_VERBOS.test(primera) && !ARRANQUES_PROHIBIDOS.test(t) && !ARRANQUES_NOMINALES.test(t);
  // Caso A: 2ª persona singular ("Guardas", "Escribes", "Completas") → -an/-en.
  // Se quita la -s final y se pluraliza el verbo resultante. Va PRIMERO porque
  // termina en -s (no en vocal) y el caso B no lo capturaría.
  if (primera.length >= 5 && arranqueVerbal && /[aeáé]s$/.test(primera)) {
    const base = primera.replace(/s$/, '').replace(/á$/, 'a').replace(/é$/, 'e');
    const resto = t.slice(primera.length).replace(/^[.,:;!¡¿?]+/, '');
    return capitalizar(base + 'n' + resto);
  }
  // Caso B: singular/imperativo terminado en vocal ("Etiqueta", "Escribe") → +n.
  if (primera.length >= 4 && arranqueVerbal
    && /[aeáéo]$/.test(primera) && !/n$/.test(primera)) {
    const pluralizado = primera.replace(/á$/, 'a').replace(/é$/, 'e') + 'n';
    const resto = t.slice(primera.length).replace(/^[.,:;!¡¿?]+/, '');
    return capitalizar(pluralizado + resto);
  }

  return original;
}

function normalizarVozBatch(data) {
  if (!data?.clases || !Array.isArray(data.clases)) return data;
  for (const clase of data.clases) {
    for (const campo of ['retroalimentacionPrevia', 'saberesPrevios', 'actividadEnganche']) {
      if (clase?.[campo]) clase[campo] = normalizarVozActividadMINERD(clase[campo]);
    }
    for (const momento of (clase?.momentos || [])) {
      if (Array.isArray(momento.actividades)) {
        momento.actividades = momento.actividades.map(normalizarVozActividadMINERD);
      }
      momento.evidencias = normalizarEvidenciasMomento(momento.evidencias, momento.nombre, momento.actividades || []);
    }
  }
  return data;
}

// ─── Validación por lote (R1 + R7 + voz, sin R2) ─────────────────────────────
// Contrato completo por momento: evidencias + metacognicion + recursos
// (actividades solo en Desarrollo y Cierre: el Inicio se arma en código con
// las 5 posiciones canónicas). Por clase: saludoInicial,
// retroalimentacionPrevia, saberesPrevios, actividadEnganche e
// indicadoresTrabajados. La ausencia de cualquiera o una violación de voz =
// rechazo del lote (consume reintento). NUNCA render vacío ni plantilla.

// ─── Intención directa + foco anclado (documento modelo del docente) ─────────

// Relleno REALMENTE vago: "mediante una serie de actividades" sin nombrar
// cuáles. NO se listan términos que suelen ir acompañados de contenido
// concreto ("vocabulario específico de las partes de la casa" es válido);
// esos generaban falsos positivos que detenían lotes buenos.
const FRASES_VAGAS_INTENCION = [
  'una serie de actividades',
  'diversas actividades',
  'diferentes actividades',
  'varias actividades',
  'actividades variadas',
];

const _normTextoFoco = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

// "Presente simple para hablar sobre rutinas (I wake up…)" → "Presente simple"
export const nombreCortoEstructura = (estructura) =>
  String(estructura || '').split(/\s+para\s+|\(/)[0].replace(/[:.]+$/, '').trim();

// ─── Producto nombrado, aportes, técnica CLT y evidencias evaluables ─────────

const PRODUCTO_GENERICO = [
  'presentación final', 'producción final', 'producto final sobre',
  'presentación/producción', 'que evidencie el dominio',
  'producto integrador', 'producto integrador sobre', 'evidencia final sobre',
];

const PRODUCT_RULES_BY_TOPIC = [
  {
    test: /parts?\s+of\s+the\s+house|partes?\s+de\s+la\s+casa|house\s+parts|rooms?\s+of\s+the\s+house|habitaciones?|vivienda/i,
    required: /house|home|room|bedroom|kitchen|living room|bathroom|floor plan|tour|casa|hogar|habitaci[oó]n|plano|maqueta|recorrido/i,
    forbidden: /city|cities|ciudad|barrio|neighborhood|community guide|dream city/i,
    hint: 'Para "parts of the house", el producto debe ser de casa/hogar/habitaciones/plano/recorrido, no de ciudad.',
  },
  {
    test: /daily routine|daily routines|rutina|rutinas|vida diaria/i,
    required: /routine|routines|schedule|poster|daily|habits|h[aá]bitos|rutina|horario|agenda/i,
    forbidden: /house map|city guide|weather|food menu/i,
    hint: 'Para rutinas diarias, el producto debe ser poster/agenda/horario/rutina/hábitos.',
  },
];

const productRuleForTopic = (tema = '') =>
  PRODUCT_RULES_BY_TOPIC.find((rule) => rule.test.test(String(tema || ''))) || null;

const APORTE_GENERICO = [
  'avance del producto', 'avance del proyecto', 'trabajo en el proyecto',
  'trabajo en el producto', 'aporte al producto', 'aporte al proyecto',
  'continúan el producto', 'avanzan en el producto',
  // La UBICACIÓN no es el artefacto: "Entrada N del Portafolio" describe DÓNDE
  // se guarda, no QUÉ se entregó. El aporte debe nombrar el entregable.
  'entrada del portafolio', 'entrada al portafolio',
  'entrada 1 del portafolio', 'entrada 2 del portafolio', 'entrada 3 del portafolio',
  'entrada 4 del portafolio', 'entrada 5 del portafolio', 'entrada 6 del portafolio',
  'entrada 7 del portafolio', 'entrada 8 del portafolio',
];

// Términos DESNUDOS que no son una técnica accionable por sí solos. Son
// genuinamente vagos en CUALQUIER asignatura cuando aparecen SOLOS ("Actividad",
// "Juego", "Trabajo en grupo"). NO se listan aquí los MARCOS metodológicos
// (ABP, Aprendizaje Cooperativo…) porque en asignaturas NO-idioma (Matemática,
// Ciencias, Sociales) esos marcos SÍ son la técnica legítima del MINERD cuando
// se nombran con una misión concreta ("Aprendizaje Cooperativo: Rompecabezas
// del ecosistema"). El calificador específico se exige aparte (ver R12).
const CLT_GENERICO = [
  'actividad', 'práctica', 'ejercicio', 'dinámica', 'juego',
  'trabajo en grupo', 'trabajo colaborativo', 'trabajo en parejas',
];

// Marcos metodológicos AMPLIOS: válidos como técnica SOLO si el nombre añade un
// calificador específico (una misión, un contenido, una variante nombrada). El
// marco DESNUDO ("Aprendizaje Basado en Proyectos", sin más) no es accionable;
// "ABP: Maqueta del acueducto comunitario" sí lo es. Regla transversal a todas
// las asignaturas — no reprueba a Matemática/Ciencias por usar su marco real.
const CLT_MARCO_AMPLIO = [
  'project-based learning', 'aprendizaje basado en proyectos', 'abp',
  'aprendizaje colaborativo', 'aprendizaje cooperativo', 'aprendizaje cooperativo',
  'communicative approach', 'enfoque comunicativo', 'task-based learning',
  'aprendizaje basado en problemas',
];

const EVIDENCIA_NO_EVALUABLE = [
  'participación activa en el saludo', 'participación en el saludo',
  'atención y reacción al saludo', 'interacción activa con el saludo',
  'respuestas al saludo', 'interés mostrado en el video',
  'participación activa en la clase', 'atención a la explicación',
];

// Evidencias proporcionales al trabajo real: se conservan más evidencias solo
// cuando las actividades producen artefactos o desempeños observables.
const CLAVES_EVIDENCIA = ['conocimientos', 'desempeno', 'producto'];
function validarEvidenciasMomento(ev, nombreMomento, etiqueta) {
  if (!ev || typeof ev !== 'object' || Array.isArray(ev)) {
    throw new Error(`R4: ${etiqueta} — "evidencias" debe ser objeto {conocimientos/desempeno/producto} con arrays, no lista plana`);
  }
  const contar = (k) => Array.isArray(ev[k])
    ? ev[k].filter((x) => String(x || '').trim()).length
    : 0;
  const nombre = _normTextoFoco(nombreMomento);
  const c = contar('conocimientos');
  const d = contar('desempeno');
  const p = contar('producto');

  if (nombre.includes('inicio') && (c < 1 || c > 1 || d !== 0 || p !== 0)) {
    throw new Error(`R4: ${etiqueta} — Inicio debe traer 1 evidencia diagnóstica de conocimientos`);
  }
  if (nombre.includes('desarrollo') && (c !== 0 || d + p < 1 || d + p > 3)) {
    throw new Error(`R4: ${etiqueta} — Desarrollo debe traer de 1 a 3 evidencias derivadas de sus actividades`);
  }
  if (nombre.includes('cierre') && (c !== 0 || d > 1 || p < 1 || d + p > 2)) {
    throw new Error(`R4: ${etiqueta} — Cierre debe traer 1 o 2 evidencias de cierre vinculadas al producto/reflexión`);
  }
  const presentes = CLAVES_EVIDENCIA.filter((k) => contar(k));
  for (const k of presentes) {
    for (const e of ev[k]) {
      const vaga = EVIDENCIA_NO_EVALUABLE.find((b) => _normTextoFoco(e).includes(_normTextoFoco(b)));
      if (vaga) throw new Error(`R4: ${etiqueta} — evidencia no evaluable ("${vaga}"): describe un desempeño o producto observable`);
    }
  }
}

const textoDesarrollo = (clase) =>
  ((clase?.momentos || []).find((m) => m.nombre === 'Desarrollo')?.actividades || []).join(' ');

const textoClaseCompleta = (clase) => [
  clase?.tituloSemana,
  clase?.titulo,
  clase?.focoLinguistico,
  clase?.intencionPedagogica,
  clase?.aporteProducto,
  clase?.actividadCLT?.nombre,
  clase?.actividadCLT?.mecanica,
  clase?.saludoInicial,
  clase?.retroalimentacionPrevia,
  clase?.saberesPrevios,
  clase?.actividadEnganche,
  ...((clase?.momentos || []).flatMap((m) => [
    ...(m?.actividades || []),
    ...(m?.evidencias?.conocimientos || []),
    ...(m?.evidencias?.desempeno || []),
    ...(m?.evidencias?.producto || []),
    ...(m?.metacognicion || []),
  ])),
].filter(Boolean).join(' ');

const normalizarCodigo = (codigo) =>
  String(codigo || '').replaceAll('[', '').replaceAll(']', '').replace(/\s/g, '').toUpperCase().trim();

const primeraEvidencia = (...grupos) => {
  for (const grupo of grupos) {
    const lista = Array.isArray(grupo) ? grupo : [];
    const item = lista.map((x) => String(x || '').replace(/\s+/g, ' ').trim()).find(Boolean);
    if (item) return item;
  }
  return '';
};

const PRODUCTO_ACTIVIDAD_RE = /\b(elaboran|construyen|redactan|escriben|completan|diseñan|crean|producen|preparan|presentan|guardan|entregan|socializan|registran|clasifican|organizan|resuelven|dibujan|arman|llenan)\b/i;
const DESEMPENO_ACTIVIDAD_RE = /\b(participan|practican|simulan|dialogan|leen|escuchan|identifican|comparan|explican|analizan|observan|responden|intercambian|dramatizan)\b/i;

const tomarEvidencias = (lista, max, fallback = []) => {
  const out = [];
  const seen = new Set();
  const fuentes = [...(Array.isArray(lista) ? lista : []), ...(Array.isArray(fallback) ? fallback : [])];
  for (const item of fuentes) {
    const texto = String(item || '').replace(/\s+/g, ' ').trim();
    const key = _normTextoFoco(texto);
    if (!texto || seen.has(key)) continue;
    seen.add(key);
    out.push(texto);
    if (out.length >= max) break;
  }
  return out;
};

function normalizarEvidenciasMomento(ev, nombreMomento = '', actividades = []) {
  const base = ev && typeof ev === 'object' && !Array.isArray(ev) ? ev : {};
  const conocimientos = Array.isArray(base.conocimientos) ? base.conocimientos : [];
  const desempeno = Array.isArray(base.desempeno) ? base.desempeno : [];
  const producto = Array.isArray(base.producto) ? base.producto : [];
  const nombre = _normTextoFoco(nombreMomento);
  const acts = Array.isArray(actividades) ? actividades.map((a) => String(a || '')) : [];
  const actividadesProducto = acts.filter((a) => PRODUCTO_ACTIVIDAD_RE.test(a)).length;
  const actividadesDesempeno = acts.filter((a) => DESEMPENO_ACTIVIDAD_RE.test(a)).length;

  if (nombre.includes('inicio')) {
    return {
      conocimientos: [primeraEvidencia(conocimientos, desempeno, producto)].filter(Boolean),
      desempeno: [],
      producto: [],
    };
  }
  if (nombre.includes('desarrollo')) {
    const maxTotal = Math.min(3, Math.max(1, actividadesProducto + actividadesDesempeno));
    const maxProducto = actividadesProducto >= 2 ? 2 : actividadesProducto === 1 ? 1 : 0;
    const productos = tomarEvidencias(producto, Math.min(maxProducto || 1, maxTotal), [desempeno, conocimientos].flat());
    const espacioDesempeno = Math.max(0, maxTotal - productos.length);
    const desempenos = tomarEvidencias(desempeno, Math.min(espacioDesempeno || 1, maxTotal), [conocimientos, producto].flat());
    return {
      conocimientos: [],
      desempeno: desempenos,
      producto: productos,
    };
  }
  if (nombre.includes('cierre')) {
    const maxCierre = actividadesProducto >= 2 ? 2 : 1;
    return {
      conocimientos: [],
      desempeno: [],
      producto: tomarEvidencias(producto, maxCierre, [desempeno, conocimientos].flat()),
    };
  }
  return {
    conocimientos: conocimientos.slice(0, 1),
    desempeno: desempeno.slice(0, 1),
    producto: producto.slice(0, 1),
  };
}

const textosUnicos = (items = []) => {
  const out = [];
  const seen = new Set();
  (Array.isArray(items) ? items : [items]).forEach((item) => {
    const texto = String(item || '').replace(/\s+/g, ' ').trim();
    const key = _normTextoFoco(texto);
    if (texto && !seen.has(key)) {
      seen.add(key);
      out.push(texto);
    }
  });
  return out;
};

export function validateBatch(data, durMin, count, focoGram = [], opts = {}) {
  const memoria = Array.isArray(opts.memoria) ? opts.memoria : [];
  const indicadoresPermitidos = new Set(
    (Array.isArray(opts.indicadoresPermitidos) ? opts.indicadoresPermitidos : [])
      .map(normalizarCodigo)
      .filter(Boolean),
  );

  // 3A — nombre propio del producto final (solo el primer lote de la unidad)
  if (opts.exigirNombreProducto) {
    const nombreProd = String(data?.productoFinalNombre || '').trim();
    if (!nombreProd) {
      throw new Error('R11: falta "productoFinalNombre" — el primer lote propone el nombre propio del producto final');
    }
    const generico = PRODUCTO_GENERICO.find((g) => _normTextoFoco(nombreProd).includes(_normTextoFoco(g)));
    if (generico || nombreProd.length > 80) {
      throw new Error(`R11: productoFinalNombre genérico o excesivo ("${nombreProd.slice(0, 60)}…") — nombre propio y concreto (ej. "My House Map & Tour")`);
    }
    const reglaProducto = productRuleForTopic(opts.temaOficial);
    if (reglaProducto && (reglaProducto.forbidden.test(nombreProd) || !reglaProducto.required.test(nombreProd))) {
      throw new Error(`R11: productoFinalNombre desconectado del tema ("${nombreProd}") — ${reglaProducto.hint}`);
    }
  }

  // 4 — Adaptaciones NEAE y observaciones DEL BLOQUE, ligadas al foco. Sin
  // fallback genérico: si faltan, el lote se rechaza y se regenera.
  const ad = data?.adaptacionesSemana;
  for (const k of ['acceso', 'metodologicas', 'evaluacion']) {
    if (!String(ad?.[k] || '').trim()) {
      throw new Error(`R14: falta adaptacionesSemana.${k} (adecuaciones NEAE ligadas al foco de la semana)`);
    }
  }
  if (!String(data?.observacionesSemana || '').trim()) {
    throw new Error('R14: falta observacionesSemana (qué observar/registrar esta semana según su foco)');
  }
  if (!data?.clases || !Array.isArray(data.clases)) throw new Error('R1: falta clases[]');
  if (data.clases.length < count) throw new Error(`R1: se esperaban ${count} clases, llegaron ${data.clases.length}`);

  const tInicio     = durMin <= 50 ? 10 : 15;
  const tCierre     = durMin <= 50 ? 5  : 10;
  const tDesarrollo = durMin - tInicio - tCierre;
  const tiempos = { Inicio: tInicio, Desarrollo: tDesarrollo, Cierre: tCierre };

  const listaNoVacia = (v) => Array.isArray(v) && v.filter((x) => String(x || '').trim()).length > 0;
  const textoNoVacio = (v) => String(v || '').trim().length > 0;
  const cltEnLote = new Map(); // técnica → clase que la usó (no repetir en el mismo lote)
  const temaTrabajo = _normTextoFoco(opts.temaTrabajoSemana || opts.temaOficial || '');
  const temasActivos = (Array.isArray(opts.temasActivos) ? opts.temasActivos : [])
    .map((t) => String(t || '').trim())
    .filter(Boolean);
  const temasFueraDeSemana = temasActivos
    .filter((t) => {
      const norm = _normTextoFoco(t);
      return norm && temaTrabajo && norm !== temaTrabajo && !norm.includes(temaTrabajo) && !temaTrabajo.includes(norm);
    })
    .filter((t, i, arr) => arr.findIndex((x) => _normTextoFoco(x) === _normTextoFoco(t)) === i);

  for (let idx = 0; idx < count; idx++) {
    const clase = data.clases[idx];
    if (!Array.isArray(clase?.momentos) || clase.momentos.length !== 3) {
      throw new Error(`R1: clase ${idx + 1} debe tener 3 momentos`);
    }
    if (!Array.isArray(clase.indicadoresTrabajados)) {
      throw new Error(`R1: clase ${idx + 1} sin indicadoresTrabajados[] (usa los códigos de la especificación)`);
    }
    const codigosIndicadores = clase.indicadoresTrabajados.map(normalizarCodigo).filter(Boolean);
    if (codigosIndicadores.length < 1 || codigosIndicadores.length > 3) {
      throw new Error(`R1: clase ${idx + 1} debe usar de 1 a 3 indicadores precargados, recibió ${codigosIndicadores.length}`);
    }
    if (indicadoresPermitidos.size) {
      const inventados = codigosIndicadores.filter((codigo) => !indicadoresPermitidos.has(codigo));
      if (inventados.length) {
        throw new Error(`R1: clase ${idx + 1} usa indicadores no precargados (${inventados.join(', ')}). La IA no puede inventar currículo.`);
      }
    }
    if (!textoNoVacio(clase.titulo)) {
      throw new Error(`R1: clase ${idx + 1} sin titulo`);
    }
    if (!textoNoVacio(clase.intencionPedagogica)) {
      throw new Error(`R1: clase ${idx + 1} sin intencionPedagogica`);
    }
    if (temaTrabajo && temasFueraDeSemana.length) {
      const textoClase = _normTextoFoco(textoClaseCompleta(clase));
      const contaminante = temasFueraDeSemana.find((t) => textoClase.includes(_normTextoFoco(t)));
      if (contaminante) {
        throw new Error(`R15: clase ${idx + 1} mezcla el tema "${contaminante}" dentro de la semana de "${opts.temaTrabajoSemana || opts.temaOficial}".`);
      }
    }
    for (const campo of ['tituloSemana', 'focoLinguistico', 'estrategiasDia']) {
      if (!textoNoVacio(clase[campo])) {
        throw new Error(`R1: clase ${idx + 1} sin ${campo} (encabezado pedagógico semanal/día)`);
      }
    }

    // R9 — intención pedagógica DIRECTA Y OBJETIVA (documento modelo):
    // formato oficial + el CÓMO ("mediante") + el CON QUÉ ("utilizando/usando")
    // + sin relleno vago. El contenido del día debe nombrarse, no aludirse.
    const intencion = String(clase.intencionPedagogica || '').trim();
    if (!/^Desde el inicio hasta el final de la clase/i.test(intencion)) {
      throw new Error(`R9: clase ${idx + 1} — la intención no usa el formato oficial ("Desde el inicio hasta el final de la clase, los estudiantes…")`);
    }
    // El CÓMO (las actividades concretas): se acepta cualquier conector
    // equivalente natural. AUDITADO contra el modelo real del docente: se añaden
    // verbos de acción declarativos ("comprendiendo", "demostrando",
    // "relacionando"…) — el modelo escribe intenciones válidas como "aprenderán
    // a decir la hora… comprendiendo la importancia de…" sin "mediante".
    const declaraComo = /\bmediante\b/i.test(intencion)
      || /\b(a través de|por medio de|realizando|participando en|desarrollando|con actividades de)\b/i.test(intencion)
      || /\b(comprendiendo|demostrando|relacionando|observando|interactuando|explorando|reconociendo|valorando)\b/i.test(intencion);
    if (!declaraComo) {
      throw new Error(`R9: clase ${idx + 1} — la intención no dice el CÓMO (las actividades: "mediante [actividades del día]", "a través de…", "realizando…")`);
    }
    // El CON QUÉ (el instrumento/contenido): recomendado pero NO obligatorio. El
    // modelo real del docente escribe intenciones válidas centradas en la función
    // comunicativa ("aprenderán a decir la hora… comprendiendo la importancia…")
    // sin nombrar la estructura, porque las ACTIVIDADES ya implican el instrumento.
    // Solo se exige el CON QUÉ cuando la intención NO declara suficiente contenido:
    // es decir, si ya declara el CÓMO con actividades concretas, basta. Se bloquea
    // únicamente la intención genuinamente vacía (sin cómo ni con qué), que la
    // rama del CÓMO de arriba ya atrapa. Regla transversal a todas las asignaturas.
    // (Sin throw aquí: el CON QUÉ se refuerza en el PROMPT, no como bloqueo duro,
    // para no reprobar el estilo válido del modelo.)
    const vaga = FRASES_VAGAS_INTENCION.find((f) => _normTextoFoco(intencion).includes(_normTextoFoco(f)));
    if (vaga) {
      throw new Error(`R9: clase ${idx + 1} — intención vaga ("${vaga}"): nombra el contenido y las actividades REALES del día`);
    }

    // FASE 1 = APROPIACIÓN: eximida del foco gramatical y de R12 (técnica CLT
    // rica). Estas clases presentan la unidad, no practican estructura, así que
    // forzarles una técnica comunicativa (Listen and Act, Role Play…) o una
    // estructura gramatical en el foco era la causa de que aparecieran mecánicas
    // ricas en la fase de apropiación. El resto de reglas (voz, evidencias,
    // intención, indicadores…) SÍ aplican, así que validamos esas antes de saltar.
    const diasApropiacion = opts.diasApropiacion instanceof Set ? opts.diasApropiacion : new Set();
    const esApropiacion = diasApropiacion.has(Number(clase.dia));

    // Foco lingüístico anclado al plan gramatical del bloque: el encabezado
    // del día debe declarar una estructura OFICIAL del foco, no una etiqueta
    // inventada. (Bloque introductorio sin foco o clase de apropiación → sin
    // restricción.)
    if (focoGram.length && !esApropiacion) {
      const nombres = focoGram.map(nombreCortoEstructura).filter((n) => n.length >= 4);
      if (nombres.length) {
        const focoDia = _normTextoFoco(clase.focoLinguistico);
        if (!nombres.some((n) => focoDia.includes(_normTextoFoco(n)))) {
          throw new Error(
            `Foco: clase ${idx + 1} — focoLinguistico "${String(clase.focoLinguistico).slice(0, 60)}…" no corresponde a ninguna estructura del foco del bloque (${nombres.join(' · ')})`,
          );
        }
      }
    }

    if (esApropiacion) {
      // Apropiación: no exigimos actividadCLT ni foco gramatical. Saltamos el
      // resto de checks de técnica de la clase.
      continue;
    }

    // 3B — técnica metodológica NOMBRADA (el "sabor" del documento modelo):
    // Listen and Act/Solve/Compare, Information Gap, Role Play, Gallery Walk,
    // Interview Stations, Frequency Walk, Speaking Circle, Describe and Draw…
    const clt = clase.actividadCLT;
    if (!clt || !textoNoVacio(clt.nombre) || !textoNoVacio(clt.mecanica)) {
      throw new Error(`R12: clase ${idx + 1} sin actividadCLT {nombre, mecanica} (técnica metodológica del Desarrollo)`);
    }
    const cltNombreNorm = _normTextoFoco(clt.nombre);
    if (CLT_GENERICO.map(_normTextoFoco).includes(cltNombreNorm)) {
      throw new Error(`R12: clase ${idx + 1} — "${clt.nombre}" no es un nombre metodológico (usa Listen and Solve, Information Gap, Role Play, Gallery Walk…)`);
    }
    // Marco amplio (ABP, Aprendizaje Cooperativo…): válido SOLO con calificador
    // específico. Desnudo = igual a un marco de la lista, sin misión/contenido
    // añadido → se rechaza; con misión ("ABP: Maqueta del acueducto") → pasa.
    const marcoDesnudo = CLT_MARCO_AMPLIO.map(_normTextoFoco).find((m) => {
      if (cltNombreNorm === m) return true;
      // "abp" / "enfoque comunicativo" al inicio sin nada distintivo detrás
      const resto = cltNombreNorm.replace(m, '').replace(/[:\-–—()]/g, ' ').trim();
      return cltNombreNorm.startsWith(m) && resto.length < 4;
    });
    if (marcoDesnudo) {
      throw new Error(`R12: clase ${idx + 1} — "${clt.nombre}" es un marco amplio sin misión concreta. Nómbralo con su misión del día (ej. "Aprendizaje Cooperativo: Rompecabezas del ecosistema", "ABP: Maqueta del acueducto")`);
    }
    if (cltEnLote.has(cltNombreNorm)) {
      throw new Error(`R12: clase ${idx + 1} repite la técnica "${clt.nombre}" de la clase ${cltEnLote.get(cltNombreNorm)} del mismo lote`);
    }
    cltEnLote.set(cltNombreNorm, idx + 1);
    // La técnica debe aparecer en ALGUNA actividad del Desarrollo (no
    // necesariamente la primera ni literal en la misma posición): tolerante a
    // que la IA la parafrasee alrededor, pero exige que esté presente. Para
    // nombres multi-palabra (ej. "Project-Based Learning", "Information Gap")
    // basta con que aparezca el TÉRMINO DISTINTIVO (la palabra más larga del
    // nombre), no la frase completa — la IA suele traducir/parafrasear el resto.
    const actsDesarrollo = (clase.momentos.find((m) => m.nombre === 'Desarrollo')?.actividades || []);
    const desarrolloNorm = actsDesarrollo.map(_normTextoFoco);
    // Palabras distintivas del nombre (≥4 letras). La IA suele parafrasear o
    // traducir alrededor de la misión (Room Presentation → "presentan su
    // cuarto"), así que basta con que aparezca la RAÍZ (primeros 5 caracteres)
    // de CUALQUIER palabra distintiva del nombre — no la frase literal ni las
    // comillas exactas. Antes se exigía la palabra más larga completa y daba
    // falsos positivos cuando esa palabra se traducía (presentation→presentación).
    const palabrasCLT = cltNombreNorm.split(/\s+/).filter((w) => w.length >= 4);
    const raices = palabrasCLT.map((w) => w.slice(0, 5)).filter(Boolean);
    const cltPresente = desarrolloNorm.some((a) => a.includes(cltNombreNorm))
      || raices.some((r) => desarrolloNorm.some((a) => a.includes(r)));
    if (!cltPresente) {
      throw new Error(`R12: clase ${idx + 1} — el Desarrollo no nombra su técnica "${clt.nombre}" en ninguna actividad ("Participan en ${clt.nombre}: …")`);
    }

    // 3A — aporte concreto y NOMBRADO al producto final
    const aporte = String(clase.aporteProducto || '').trim();
    if (!aporte) {
      throw new Error(`R11: clase ${idx + 1} sin aporteProducto (el artefacto que esta clase deposita al producto final)`);
    }
    const aporteVago = APORTE_GENERICO.find((g) => _normTextoFoco(aporte).includes(_normTextoFoco(g)));
    if (aporteVago) {
      throw new Error(`R11: clase ${idx + 1} — aporteProducto genérico ("${aporteVago}"): nombra el artefacto concreto (ej. "Inventario del espacio favorito con posesivos")`);
    }

    // 3C — anti-repetición GLOBAL: contra TODAS las clases previas de la
    // unidad (memoria acumulada), no solo las adyacentes del lote
    const nuevoDesarrollo = textoDesarrollo(clase);
    for (const prev of memoria) {
      if (prev.desarrolloTexto) {
        const sim = jaccardSimilarity(nuevoDesarrollo, prev.desarrolloTexto);
        if (sim > 0.6) {
          throw new Error(`R2: clase ${idx + 1} repite el Desarrollo de S${prev.semana}/C${prev.dia} "${prev.titulo}" (${(sim * 100).toFixed(0)}%)`);
        }
      }
      if (prev.actividadCLT && _normTextoFoco(prev.actividadCLT) === cltNombreNorm) {
        const mismoBloque = prev.semana === (data.semana ?? opts.semanaNum);
        const mecanicaSimilar = prev.mecanicaCLT
          ? jaccardSimilarity(String(clt.mecanica), String(prev.mecanicaCLT)) > 0.6
          : true;
        if (mismoBloque || mecanicaSimilar) {
          throw new Error(
            `R12: clase ${idx + 1} — técnica "${clt.nombre}" ya usada en S${prev.semana}/C${prev.dia}` +
            `${mismoBloque ? ' (mismo bloque)' : ' con mecánica similar'} — usa otra técnica o cambia la mecánica`,
          );
        }
      }
    }

    // 3C — anti-copia de los exemplars del propio prompt (falla F4)
    for (const m of clase.momentos) {
      for (const act of (m.actividades || [])) {
        for (const ex of EXEMPLARS_ESTILO) {
          if (jaccardSimilarity(String(act), ex) > 0.7) {
            throw new Error(`R2: clase ${idx + 1} — actividad copiada del ejemplo del prompt ("${String(act).slice(0, 50)}…")`);
          }
        }
      }
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
        const minActividades = m.nombre === 'Desarrollo' ? 4 : 3;
        if ((m.actividades || []).filter((x) => String(x || '').trim()).length < minActividades) {
          throw new Error(`R1: clase ${idx + 1} momento "${m.nombre}" debe tener mínimo ${minActividades} actividades`);
        }
        for (const act of m.actividades) {
          const voz = validarVozActividad(act);
          if (!voz.ok) throw new Error(`Voz: clase ${idx + 1} "${m.nombre}" — ${voz.motivo}`);
        }
      }
      validarEvidenciasMomento(m.evidencias, m.nombre, `clase ${idx + 1} momento "${m.nombre}"`);
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
    `- [S${e.semana}/C${e.dia} "${e.titulo}"${e.actividadCLT ? ` · Técnica: ${e.actividadCLT}` : ''}]: ${e.desarrolloResumen}`,
  );
  const tecnicas = [...new Set(memoria.map((e) => e.actividadCLT).filter(Boolean))];
  const tecnicasTx = tecnicas.length
    ? `\nTÉCNICAS YA USADAS (no repetirlas; en otra fase solo con mecánica DISTINTA): ${tecnicas.join(' · ')}`
    : '';
  return `\nACTIVIDADES YA PROGRAMADAS EN ESTA UNIDAD (no repetir las mismas):\n${lines.join('\n')}${tecnicasTx}\n`;
}

// ─── Plan gramatical pre-repartido ────────────────────────────────────────────
// EL CÓDIGO decide el orden según la progresión del nivel; la IA compone
// alrededor de los focos asignados, no decide el orden.
//   Sem 1: SOLO vocabulario e introducción al tema — ninguna estructura
//          compleja (los comparativos y similares NUNCA en semana 1).
//   Sem 2+: las estructuras de la malla, en su orden oficial, repartidas
//          proporcionalmente entre las semanas restantes.

export function getFocoGramatical(gramaticaArray, semanaNum, numSemanas) {
  if (!gramaticaArray?.length) return [];
  if (semanaNum === 1) return []; // sem 1: solo vocabulario/intro
  const semanasConGramatica = Math.max(numSemanas - 1, 1);
  const perWeek = Math.ceil(gramaticaArray.length / semanasConGramatica);
  const start   = (semanaNum - 2) * perWeek;
  const foco = gramaticaArray.slice(start, start + perWeek);
  // Si a esta semana no le tocó estructura NUEVA (hay más semanas que
  // estructuras), NO caer en "solo vocabulario": reciclar una estructura ya
  // vista para APLICARLA a vocabulario nuevo — como el documento modelo, donde
  // las últimas semanas reaplican presente simple a muebles/historia en vez de
  // repetir "describir la casa". Evita el estancamiento temático.
  if (!foco.length && gramaticaArray.length) {
    const idxReciclado = (semanaNum - 2) % gramaticaArray.length;
    return [gramaticaArray[idxReciclado]];
  }
  return foco;
}

// ─── Prompt de lote ───────────────────────────────────────────────────────────

function buildBatchPrompt(spec, semanaNum, startDia, count, durMin, numSemanas, memoria, pedirNombreProducto = false) {
  const tInicio     = durMin <= 50 ? 10 : 15;
  const tCierre     = durMin <= 50 ? 5  : 10;
  const tDesarrollo = durMin - tInicio - tCierre;

  const vocab      = spec.contenidosClaves?.vocabulario?.slice(0, 16).join(', ') || '';
  const funcs      = spec.contenidosClaves?.funcionales?.slice(0, 8).join('; ')  || '';
  // Indicadores precargados por DocenteOS desde la malla. La IA NO decide la
  // malla ni reconstruye currículo: solo copia códigos de esta lista al crear
  // la secuencia didáctica.
  // Malla COMPLETA de 21 indicadores con marcado visual:
  //   **[IL-N] texto** = trabajado en ESTA secuencia (la IA elige de estos)
  //   ~~[IL-N] texto~~ = ya trabajado en unidad anterior (puede reutilizar si el tema lo exige)
  //   [IL-N] texto     = no aplica a esta secuencia
  // Descripción recortada a ~90 chars para contener tokens.
  const recorta = (t) => { const s = String(t || '').trim(); return s.length > 90 ? s.slice(0, 90).replace(/\s+\S*$/, '') + '…' : s; };
  const codigosTrabajo   = new Set((spec.indicadoresTrabajo || []).map(i => i.codigoOficial || i.id || '').filter(Boolean));
  const codigosAnteriores = new Set((spec.indicadoresTrabajadosAntes || []).map(normalizarCodigo).filter(Boolean));
  // Fase 9 — cierre del ciclo: indicadores con logro real bajo el umbral en
  // las evaluaciones del curso. El marcado (REFORZAR) pide volver a trabajarlos.
  const codigosDebiles = new Set((spec.indicadoresDebiles || []).map(normalizarCodigo).filter(Boolean));
  const todosIndicadores  = spec.indicadores?.length ? spec.indicadores : (spec.indicadoresTrabajo || []);
  const indText = todosIndicadores
    .map(i => {
      const cod  = i.codigoOficial || i.id || 's/c';
      const desc = recorta(i.descripcion || i.texto);
      if (!desc) return null;
      const refuerzo = codigosDebiles.has(normalizarCodigo(cod)) ? ' (REFORZAR)' : '';
      const linea = `[${cod}] ${desc}${refuerzo}`;
      if (codigosTrabajo.has(cod))              return `**${linea}**`;
      if (codigosAnteriores.has(normalizarCodigo(cod))) return `~~${linea}~~`;
      return linea;
    })
    .filter(Boolean)
    .join('\n');
  const ceText     = (spec.ces || [])
    .map(c => `${c.fundamental ? c.fundamental + ' — ' : ''}${c.descripcion || ''}`.trim())
    .filter(Boolean).join(' | ');
  const focoCurricular = resolverFocosCurriculares({
    arquitectura: spec.arquitecturaCurricular,
    contenidosClaves: spec.contenidosClaves,
    semanaNum,
    diaGlobal: startDia,
    numSemanas,
  });
  const focoCurricularTx = focoCurricular.detalles?.length
    ? focoCurricular.detalles.join('; ')
    : 'Apropiación de la unidad, situación de aprendizaje, producto y evaluación';
  const exprs      = spec.contenidosClaves?.expresiones?.slice(0, 6).join('; ') || '';
  const idiomaMeta = spec.esIdioma
    ? `en ${spec.idiomaNombre || 'inglés'} sencillo (nivel del estudiante)`
    : 'en español';
  const arquitecturaTx = resumirArquitecturaParaPrompt(spec.arquitecturaCurricular);

  const endDia  = startDia + count - 1;
  const rango   = count === 1 ? `Clase ${startDia}` : `Clases ${startDia}-${endDia}`;
  const esPrimeraClaseUnidad = semanaNum === 1 && startDia === 1;

  // 3A — producto final NOMBRADO: el primer lote lo propone; los siguientes
  // lo reciben fijado y cada clase deposita un aporte concreto a ese producto
  const productoLinea = spec.productoFinalNombre
    ? `- PRODUCTO FINAL DE LA UNIDAD: «${spec.productoFinalNombre}». Imagina que el producto es un rompecabezas: cada "aporteProducto" es UNA PIEZA nombrada que, sumada a las demás clases, ENSAMBLA ese producto. Al final de la unidad, las piezas juntas DEBEN DAR el producto completo. Ejemplo: si el producto es "My House Map & Tour", las piezas podrían ser → C1: "Vocabulary card set de rooms", C2: "Floor plan del hogar con etiquetas", C3: "Description card de cada room", C4: "Script del House Tour", C5: "Poster de presentación". PROHIBIDO repetir piezas o dar aportes que no conecten visiblemente con el producto final.`
    : (pedirNombreProducto
      ? `- PRODUCTO FINAL: propón "productoFinalNombre" — nombre PROPIO y concreto derivado del TEMA EXACTO DEL DOCENTE ("${spec.temaOficial}"), no del tema amplio de la malla. Si el título dice "parts of the house", el producto debe ser de house/home/rooms/floor plan/house tour (ej. "My House Map & Tour" o "My Dream House Poster"), NO "city guide" ni "neighborhood guide" salvo que el docente haya pedido ciudad. PROHIBIDO el genérico "Presentación/producción final sobre el tema". Luego cada clase aporta UNA PIEZA que, sumada, ensambla ese producto.`
      : (spec.productoFinal ? `- PRODUCTO FINAL DE LA UNIDAD: ${spec.productoFinal} — cada "aporteProducto" es una pieza nombrada que ensambla este producto.` : ''));
  const contextoLinea = spec.contextoComunitario
    ? `- CONTEXTO COMUNITARIO REAL (palabras del docente — úsalo en situaciones y actividades; NO inventes otros datos locales): ${spec.contextoComunitario}`
    : '';
  const secuenciaBase = Array.isArray(spec.secuenciaBase)
    ? spec.secuenciaBase.slice(startDia - 1, startDia - 1 + count)
    : [];
  const secuenciaBaseTx = secuenciaBase.length
    ? JSON.stringify(secuenciaBase.map((c, i) => ({
      dia: startDia + i,
      fase: c.fase,
      tituloSemana: c.tituloSemana,
      titulo: c.titulo,
      foco: c.focoLinguistico,
      secuencia: c.secuenciaPedagogica,
      intencionPedagogica: c.intencionPedagogica,
      aporteProducto: c.aporteProducto,
      indicadoresTrabajados: c.indicadoresTrabajados,
      inicio: {
        saludoInicial: c.saludoInicial,
        retroalimentacionPrevia: c.retroalimentacionPrevia,
        saberesPrevios: c.saberesPrevios,
        actividadEnganche: c.actividadEnganche,
      },
      desarrolloBase: c.momentos?.find((m) => m.nombre === 'Desarrollo')?.actividades || [],
      cierreBase: c.momentos?.find((m) => m.nombre === 'Cierre')?.actividades || [],
    })), null, 2)
    : '';

  // Punto 5 — patrón del Desarrollo. El MODELO (Daily Routines) es el estándar
  // de calidad, pero solo el ramo de idiomas usa "Listening con propósito". Para
  // el resto de asignaturas se enuncia el MISMO patrón pedagógico (activación →
  // construcción → misión nombrada → socialización con aporte) sin vocabulario
  // de idioma. La MISIÓN con nombre propio y el aporte al producto son
  // transversales — son el "sabor" del modelo que sí aplica a todas las áreas.
  // Naturaleza disciplinar del área (documento oficial págs. 9-10). Solo áreas
  // NO-idioma: cada área construye conocimiento a su manera (Matemática razona
  // y verifica, Ciencias indaga, Sociales analiza fuentes…). Es la BRÚJULA que
  // evita el molde comunicativo de Lenguas Extranjeras en las demás áreas.
  const naturaleza = spec.esIdioma ? null : resolverNaturalezaArea(spec.area, spec.asignatura);
  const patronDesarrollo = spec.esIdioma
    ? `5. Desarrollo: 4 actividades concretas y progresivas con ESTE patrón:
   (a) LISTENING CON PROPÓSITO NOMBRADO: una actividad de escucha con nombre propio según la tarea — "Listen and Act" (mímica), "Listen and Decide" (True/False), "Listen and Compare", "Listen and Solve", "Listen and Complete", "Listen and Create", "Listen and Organize", "Listen and Choose", "Listen and Evaluate". Nombra la actividad y di QUÉ hace el estudiante al escuchar.
   (b) DESCUBRIMIENTO de la estructura del día con ejemplos contextualizados reales EN CURSIVA y entre paréntesis, markdown _..._ (ej.: _(I wake up at 6:00. She studies in the afternoon.)_). Tienes libertad de dar oraciones de ejemplo completas para modelar el uso.
   (c) MISIÓN/PRODUCCIÓN con NOMBRE PROPIO (ej.: "My Day, Your Day", "Family Interview", "Chore Chart", "Weekend Mini-Map", "My Daily Vlog", "Who does what?") — el estudiante crea un artefacto concreto.
   (d) SOCIALIZACIÓN con APORTE AL PRODUCTO: comparten y el artefacto se guarda para el producto final.`
    : `5. Desarrollo: 4 actividades concretas y progresivas FIELES A LA NATURALEZA DE ${spec.area.toUpperCase()}.
   ENFOQUE DEL ÁREA (respétalo, NO uses el molde de idiomas — nada de "Listen and…", "pronunciación" ni "en el idioma trabajado"): ${naturaleza.enfoque}
   La secuencia disciplinar propia del área es: ${naturaleza.procesos.join(" → ")}. Las 4 actividades del Desarrollo deben recorrer esa lógica, adaptada al foco curricular del día:
   (a) ACTIVACIÓN/ENTRADA propia del área: ${naturaleza.procesos[0]}${naturaleza.procesos[1] ? " y " + naturaleza.procesos[1] : ""} — con un propósito NOMBRADO (qué debe descubrir, resolver, comparar o explicar). Di QUÉ hace el estudiante.
   (b) CONSTRUCCIÓN del concepto/procedimiento del día con ejemplos reales de la malla (modelado + práctica guiada). Nombra el contenido específico, no lo aludas.
   (c) MISIÓN/PRODUCCIÓN con NOMBRE PROPIO memorable ligado al tema y al área, usando una mecánica propia (${naturaleza.tecnicas.slice(0, 4).join(", ")}) — el estudiante crea un artefacto o resuelve un reto concreto del tipo: ${naturaleza.productos.join(", ")}.
   (d) SOCIALIZACIÓN con APORTE AL PRODUCTO: comparten, verifican entre pares y el artefacto se guarda para el producto final.`;

  // Instrucciones sensibles al idioma. En asignaturas de idioma el término va en
  // el idioma meta EN CURSIVA y entre paréntesis, con LIBERTAD de dar oraciones
  // de ejemplo (regla del docente: en las actividades tienes margen para modelar
  // el uso real con oraciones completas, aunque la estructura no esté en la
  // malla — la malla es un ejemplo; la coherencia de la secuencia manda AQUÍ,
  // no en la tabla de contenidos). Cursiva markdown: _texto_ → el render la pinta.
  const notaIdioma  = spec.esIdioma ? ` El término en ${spec.idiomaNombre || 'el idioma'} va EN CURSIVA y entre paréntesis dentro de la actividad, usando markdown de subrayado (ej.: _(This is the kitchen.)_ , _(I wake up at 7:00. She studies in the afternoon.)_). Tienes LIBERTAD de escribir oraciones de ejemplo completas y contextualizadas para modelar el uso real, aunque la estructura no aparezca literal en la malla.` : '';
  const saludoNota  = spec.esIdioma ? 'saludo en el idioma meta, variado por clase' : 'saludo variado por clase';
  const saludoEjem  = spec.esIdioma ? '"Good morning! ..."' : '"¡Buenos días! ..."';
  const preguntaLoc = spec.esIdioma ? 'EN EL IDIOMA META entre paréntesis' : 'entre paréntesis';
  // Técnicas metodológicas ejemplo según asignatura (idioma vs. general).
  const tecnicasEjem = spec.esIdioma
    ? 'Listen and Act / Listen and Solve / Information Gap / Role Play con roles / Interview en parejas / Gallery Walk / Describe and Draw / Speaking Circle...'
    : `${naturaleza.tecnicas.join(' / ')}...`;
  // El CON QUÉ de la intención: en idioma es la estructura gramatical; en otras
  // áreas es el concepto/procedimiento del día. Redacción neutra por defecto.
  const conQueEjem = spec.esIdioma
    ? '"utilizando [la estructura o el vocabulario del día]"'
    : '"utilizando [el concepto, procedimiento o recurso del día]"';
  const rutaTx = spec.rutaCurricular?.distribucion?.length
    ? spec.rutaCurricular.distribucion
      .map((b) => `Semana ${b.semanaInicio}${b.semanaInicio !== b.semanaFin ? `-${b.semanaFin}` : ''}: ${b.tema}`)
      .join(' | ')
    : '';
  const temasActivosTx = Array.isArray(spec.temasActivos) && spec.temasActivos.length
    ? spec.temasActivos.join(' + ')
    : spec.temaOficial;
  const otrosTemasRuta = (Array.isArray(spec.temasActivos) ? spec.temasActivos : [])
    .map((t) => String(t || '').trim())
    .filter((t) => t && _normTextoFoco(t) !== _normTextoFoco(spec.temaTrabajoSemana || spec.temaOficial));
  const reglaTemaTrabajo = spec.temaTrabajoSemana
    ? `\nTEMA DE TRABAJO DE ESTA SEMANA: "${spec.temaTrabajoSemana}". Usa este tema como contenido central de TODAS las clases del lote. ${otrosTemasRuta.length ? `NO metas como contenido central estos otros temas de la ruta: ${otrosTemasRuta.join(' · ')}. Pueden existir en la ruta general, pero NO deben aparecer en actividades, evidencias ni saberes previos de esta semana.` : ''}`
    : '';
  const reglaTemasCombinados = spec.rutaCurricular?.esCombinada
    ? `\nREGLA DE TEMAS COMBINADOS: esta unidad integra ${temasActivosTx}. NO hagas clases sueltas por tema. La situacion de aprendizaje y el producto final son el camino unico: cada clase debe explicar para que sirve el tema de esa semana dentro del producto final. Las actividades del Desarrollo y del Cierre deben nombrar la pieza del producto que se construye, revisa o guarda.`
    : '';

  const reglaInicio = esPrimeraClaseUnidad
    ? `6. CADA clase incluye las piezas del Inicio: "saludoInicial" (solo el ${saludoNota}: ${saludoEjem}), "retroalimentacionPrevia", "saberesPrevios" y "actividadEnganche" (actividad de observación/enganche del día, en la voz obligatoria). Para la PRIMERA clase de la unidad no hay clase anterior: "retroalimentacionPrevia" inicia con "Retroalimentación de experiencias relacionadas con..." (exploración diagnóstica del tema con preguntas ${preguntaLoc}) y "saberesPrevios" (inicia con "Recuperación o exploración de saberes previos sobre...") puede versar sobre el tema o sobre cómo serán evaluados en la unidad. NO repitas saludo ni retroalimentación dentro de los momentos.`
    : `6. CADA clase incluye las piezas del Inicio: "saludoInicial" (solo el ${saludoNota}: ${saludoEjem}), "retroalimentacionPrevia" (oración completa que inicia con "Retroalimentación de..." recordando lo trabajado en la clase anterior — usa las actividades ya programadas listadas arriba — con preguntas de recuerdo ${preguntaLoc}), "saberesPrevios" (oración completa que inicia con "Recuperación o exploración de saberes previos sobre..." el contenido de ESTE día) y "actividadEnganche" (actividad de observación/enganche del día, en la voz obligatoria). NO repitas saludo ni retroalimentación dentro de los momentos.`;

  return `Eres un DOCENTE dominicano experto del Nivel ${nivelLabelPrompt(spec.nivel)} planificando TU propia clase de ${spec.area} para el grado ${spec.grado}. Planificas con la riqueza y el detalle del mejor docente del MINERD: producto final tangible al que cada clase aporta una pieza, misiones con nombre propio, contextualización a la comunidad y evidencias observables. El estándar de calidad es transversal a TODAS las asignaturas; el CONTENIDO específico (vocabulario, conceptos, procedimientos) sale SIEMPRE de la malla oficial que se te entrega abajo — nunca lo inventas.

TEMA: "${spec.temaOficial}"
ÁREA: ${spec.area} | GRADO: ${spec.grado} | SEMANA: ${semanaNum} de ${numSemanas} (${rango})
${rutaTx ? `RUTA CURRICULAR DE LA UNIDAD: ${rutaTx}\n` : ''}
${reglaTemaTrabajo}
${reglaTemasCombinados}

ESPECIFICACIÓN CURRICULAR:
- Competencias del grado: ${ceText || '(ver indicadores)'}
- Indicadores PRECARGADOS por DocenteOS para esta secuencia (copia SOLO estos códigos en "indicadoresTrabajados"; no inventes ni uses indicadores fuera de esta lista):
${indText}
- Conceptos/vocabulario disponible: ${vocab}
- FOCO ${spec.esIdioma ? 'LINGÜÍSTICO' : 'CURRICULAR'} DEL BLOQUE (${spec.esIdioma ? 'estructura gramatical, vocabulario o función comunicativa que trabaja el Desarrollo — úsala como eje de las actividades y del campo "focoLinguistico"' : 'concepto, procedimiento o criterio central de la malla que trabaja el Desarrollo — úsalo como eje de las actividades y del campo "focoLinguistico"'}): ${focoCurricularTx}
- Procedimientos/funciones afines al tema — trabájalos a lo largo de la unidad, distribuidos entre las clases, sin omitirlos cuando apliquen: ${funcs}
${arquitecturaTx ? `${arquitecturaTx}\n` : ''}
${productoLinea ? `${productoLinea}\n` : ''}${contextoLinea ? `${contextoLinea}\n` : ''}${exprs ? `- Expresiones oficiales del tema (incrústalas en las situaciones comunicativas): ${exprs}\n` : ''}${formatearMemoria(memoria)}
${secuenciaBaseTx ? `SECUENCIA BASE DOCENTEOS (NO ES DECORACIÓN): esta ruta ya fue armada desde la malla oficial y la situación de aprendizaje. Tu trabajo NO es inventar otra planificación desde cero: ENRIQUECE estas clases, conserva su fase, foco, aporte al producto e indicadores, y mejora actividades/evidencias/metacognición con más precisión docente.\n${secuenciaBaseTx}\n` : ''}
TAREA: Enriquece y devuelve exactamente ${count} clase(s) — ${rango} de la Semana ${semanaNum}.
Clases con PROGRESIÓN PEDAGÓGICA, DISTINTAS de las ya programadas, pero fieles a la SECUENCIA BASE DOCENTEOS cuando esté presente.
El foco curricular asignado debe trabajarse explícitamente en el Desarrollo; no sustituyas el tema ni el producto por otro.
SALIDA OBLIGATORIA: el JSON DEBE incluir la clave "clases" como arreglo con EXACTAMENTE ${count} clase(s). No basta con devolver adaptacionesSemana u observacionesSemana.

REGLAS:
1. Solo JSON puro, sin texto ni markdown.
2. Desarrollos distintos entre sí y distintos a los ya listados arriba.
3. Tiempos: Inicio=${tInicio} min, Desarrollo=${tDesarrollo} min, Cierre=${tCierre} min.
4. VOZ OBLIGATORIA: toda actividad inicia con VERBO en tercera persona plural del presente ("Responden...", "Observan...", "Elaboran...", "Socializan..."). PROHIBIDO iniciar con sustantivos o etiquetas — escribe directamente el verbo de acción: NO "Ticket de salida: completan…" → SÍ "Completan un ticket de salida…"; NO "Reflexión: responden…" → SÍ "Reflexionan sobre…"; NO "Evaluación:" → SÍ "Completan una evaluación…". TAMBIÉN PROHIBIDO: "Los estudiantes", "El docente", "La docente", "Se".${notaIdioma} Excepciones canónicas que SÍ inician sin verbo: "Retroalimentación de…" y "Recuperación de saberes previos…". Los depósitos al portafolio se nombran explícitos ("Guardan la producción escrita como Entrada N del Portafolio.").
${patronDesarrollo}
   Cierre: 3 actividades — socialización de lo producido → reflexión sobre UN aspecto específico del aprendizaje del día → guardar el artefacto en el portafolio o exit ticket con una producción nueva ("Guardan … en el portafolio para el producto final."). PROHIBIDO cerrar con frases genéricas como "reflexionan sobre lo aprendido"; nombra el contenido exacto y el aporte al producto.
${reglaInicio}
7. EVIDENCIAS SEGÚN LAS ACTIVIDADES, NO POR CUOTA FIJA: cada momento incluye "evidencias" como {"conocimientos":[...], "desempeno":[...], "producto":[...]}, pero solo se registran evidencias que nacen de actividades observables. Inicio: 1 evidencia diagnóstica de conocimientos si activa saberes o comprensión inicial. Desarrollo: de 1 a 3 evidencias según lo que realmente hacen; si una actividad dice elaboran/completan/redactan/presentan/guardan, debe existir evidencia de producto; si practican/simulan/dialogan/analizan, evidencia de desempeño. Cierre: 1 o 2 evidencias vinculadas al producto, ticket de salida o reflexión final. Cada evidencia debe nombrar el contenido exacto o la pieza del producto; PROHIBIDAS las no evaluables ("Participación activa en el saludo", "Atención a la explicación") y las listas largas. Además "metacognicion" (2 preguntas de reflexión para el estudiante, ${idiomaMeta}) y "recursos" (2-4 recursos didácticos concretos de ESE momento, en español). Nada puede quedar vacío.
8. CADA clase incluye "indicadoresTrabajados": elige de 1 a 3 CÓDIGOS EXACTOS de los indicadores marcados en **negrita** arriba (son los que corresponden a este tema). Los ~~tachados~~ ya fueron trabajados en una unidad anterior — solo úsalos si el contenido del día los requiere directamente. Los marcados (REFORZAR) fueron trabajados pero el curso NO los logró en las evaluaciones reales: cuando el contenido del día lo permita, retómalos con actividades NUEVAS (no repitas las anteriores) y dales prioridad al elegir. Los sin marcado no aplican a esta secuencia. PROHIBIDO inventar códigos o usar indicadores fuera de la malla.
9. CADA clase incluye "titulo" (título llamativo de la clase) e "intencionPedagogica" DIRECTA Y OBJETIVA con el formato oficial: "Desde el inicio hasta el final de la clase, los estudiantes [qué harán con el CONTENIDO ESPECÍFICO del día — nómbralo] mediante [las actividades concretas de ESTA clase], ${conQueEjem} — o su equivalente "con…", "a través de…", "comprendiendo…", [evidencia de logro observable]." PROHIBIDO el relleno vago SIN nombrar el contenido: "mediante una serie de actividades", "diversas actividades" — nombra siempre el contenido real de la malla (ej. idioma: "describirán sus hábitos y su frecuencia mediante comprensión oral y producción escrita, utilizando presente simple y adverbios de frecuencia"; ej. otra área: "clasificarán los tipos de ecosistemas de su comunidad mediante observación y comparación de casos, utilizando los criterios de biodiversidad y clima").
10. CADA clase incluye encabezado pedagógico:
   • "tituloSemana": título que refleja la FASE de la unidad y AVANZA semana a semana ("Exploración y descripción" → "Profundización" → "Integración y producto final"); no repitas el mismo en semanas distintas.
   • "focoLinguistico": ${spec.esIdioma ? 'la ESTRUCTURA GRAMATICAL, vocabulario o función comunicativa que trabaja esta clase (copia o adapta UNO del FOCO LINGÜÍSTICO DEL BLOQUE indicado arriba); incluye ejemplos entre paréntesis en cursiva cuando aplique (ej. "Present Simple: routines _(I wake up at 6.)_"). Si es Semana 1: "Apropiación de la unidad / producto / evaluación".' : 'el CONCEPTO, PROCEDIMIENTO o CRITERIO central de la malla que trabaja esta clase (copia o adapta UNO del FOCO CURRICULAR DEL BLOQUE indicado arriba). NO uses vocabulario de idioma aquí. Si es Semana 1: "Apropiación de la unidad / producto / evaluación".'}
   • "estrategiasDia": 2-3 estrategias pedagógicas coherentes separadas por " • ". PREFIERE las estrategias OFICIALES del Diseño Curricular (puedes precisarlas con la misión del día): ${ESTRATEGIAS_OFICIALES_TEXTO}.
   FASE 1 = APROPIACIÓN (toda clase con "fase": 1 en la SECUENCIA BASE — sin importar qué foco tenga): estas clases PRESENTAN la unidad, NO practican estructura gramatical. REGLA DURA: para las clases de "fase": 1, IGNORA cualquier estructura gramatical del foco y trátalas como apropiación pura. Sus actividades son SOLO: presentar la situación de aprendizaje, el tema y los saberes previos; presentar el producto final y su rúbrica; analizar los criterios de evaluación; acordar las normas de trabajo; aplicar un diagnóstico inicial; elaborar un mapa/plan inicial de ideas. Su duración VARÍA según la complejidad del tema (1 o 2 clases). PROHIBIDO en "fase": 1: mecánicas de práctica de estructura como "Listen and Act", "Role Play", "Frequency Walk", "Interview Stations", "Find Someone Who", "Information Gap", "My Routine Snapshot" o cualquier misión que haga PRODUCIR oraciones con una estructura gramatical. En "fase": 1 el Desarrollo se limita a: escuchar la presentación de la unidad, observar ejemplos del producto/rúbrica, registrar vocabulario que YA conocen (diagnóstico), elaborar un mapa de ideas inicial, acordar normas. Las mecánicas comunicativas ricas empiezan RECIÉN en "fase": 2. Desde la Fase 2: avanza por contenidos de la malla (conceptuales → procedimentales → producción) con las mecánicas comunicativas ricas; la intención pedagógica nombra el foco del día.
11. CADA clase incluye "aporteProducto": la PIEZA NOMBRADA que esa clase ensambla al producto final. Regla de coherencia: si juntas todos los "aporteProducto" de la unidad, el resultado DEBE SER el producto final — como las páginas de un libro o las partes de una maqueta. Cada pieza debe ser DISTINTA y VISIBLE: describe el artefacto entregable con nombre propio (ej. idioma: "Vocabulary card set de rooms and furniture", "Floor plan del hogar con etiquetas en inglés", "Script del House Tour"; ej. otra área: "Ficha comparativa de dos ecosistemas", "Croquis del acueducto con medidas reales"). PROHIBIDO: "Entrada 3 del Portafolio", "avance del producto", "trabajo en el proyecto", "participación en la clase".${spec.esIdioma ? ' El nombre del artefacto puede incluir términos en el idioma meta.' : ''}${pedirNombreProducto ? ' El LOTE incluye además "productoFinalNombre" (ver arriba).' : ''}
12. CADA clase incluye "actividadCLT": {"nombre": técnica metodológica CONCRETA del Desarrollo (${tecnicasEjem}), "mecanica": cómo funciona en 1-2 líneas}. La PRIMERA actividad del Desarrollo la nombra explícitamente ("Participan en [técnica]: …"). Usa una técnica ACCIONABLE. Un marco amplio ("Aprendizaje Basado en Proyectos", "Aprendizaje Cooperativo", "ABP") vale SOLO si lo nombras con su MISIÓN concreta del día ("Aprendizaje Cooperativo: Rompecabezas del ecosistema", "ABP: Maqueta del acueducto"), nunca desnudo. Cuando la clase tenga una MISIÓN, dale un NOMBRE PROPIO memorable entre comillas, ligado al tema del día: "Participan en 'Feria de fracciones del barrio': …". No repitas una técnica ni un nombre de misión ya usados en la unidad; en otra fase solo con mecánica DISTINTA. Patrón sugerido del Desarrollo: activación con propósito O misión nombrada → producción → verificación entre pares.
13. NO copies los ejemplos de estilo del sistema como actividades: son referencia de VOZ. Cada actividad es específica del contenido de ESTA clase.
14. El LOTE incluye "adaptacionesSemana": {"acceso": "...", "metodologicas": "...", "evaluacion": "..."} y "observacionesSemana": "...". Las tres adecuaciones y la observación deben NOMBAR el foco de la semana — nunca genéricas ("proveer instrucciones claras", "dar más tiempo"). Fórmula: [estrategia concreta] + [ligada al foco del contenido]. Ejemplos por tipo de foco:
   • Idioma / vocabulario (ej. "partes de la casa"): acceso → "Banco visual de imágenes etiquetadas de rooms y furniture disponible en el pupitre"; metodologicas → "Tarjetas de vocabulario casa-imagen para actividades de matching y categorización"; evaluacion → "Señalar la imagen correspondiente en vez de escribir el término".
   • Idioma / estructura gramatical (ej. "there is / there are"): acceso → "Póster de aula con la estructura there is/there are + ejemplos del salón"; metodologicas → "Oraciones modelo en tiras para ordenar antes de producir"; evaluacion → "Completar oraciones con banco de palabras en vez de producción libre".
   • Matemática (ej. "fracciones"): acceso → "Material concreto: círculos fraccionarios y regletas disponibles durante toda la clase"; metodologicas → "Resolución paso a paso con organizador gráfico numerado para el procedimiento"; evaluacion → "Resolver 2 ejercicios con material concreto en lugar de los 5 del grupo".
   • Ciencias / conceptual (ej. "ecosistemas"): acceso → "Ficha-guía con imágenes y definición clave de ecosistema en el pupitre"; metodologicas → "Organizador de doble columna: características → ejemplos del entorno"; evaluacion → "Identificar y marcar con círculo los elementos en una imagen, no describir por escrito".
   • observacionesSemana: qué observará el docente ESPECÍFICAMENTE esta semana (ej. "Observar si el estudiante identifica correctamente rooms vs furniture al hacer el matching; anotar cuáles confunde para reforzar en la próxima sesión").

{"outputSchemaVersion":"1.3","semana":${semanaNum},${pedirNombreProducto ? '"productoFinalNombre":"...",' : ''}"adaptacionesSemana":{"acceso":"...","metodologicas":"...","evaluacion":"..."},"observacionesSemana":"...","clases":[{"dia":${startDia},"tituloSemana":"...","titulo":"...","focoLinguistico":"...","estrategiasDia":"Indagación dialógica • Exploración guiada • Aprendizaje colaborativo","intencionPedagogica":"Desde el inicio hasta el final de la clase, los estudiantes...","indicadoresTrabajados":["..."],"actividadCLT":{"nombre":"...","mecanica":"..."},"aporteProducto":"...","saludoInicial":${spec.esIdioma ? '"Good morning! ..."' : '"¡Buenos días! ..."'},"retroalimentacionPrevia":"Retroalimentación de... (...?)","saberesPrevios":"Recuperación o exploración de saberes previos sobre...","actividadEnganche":"Observan...","momentos":[{"nombre":"Inicio","tiempo":"${tInicio} min","evidencias":{"conocimientos":["..."],"desempeno":[],"producto":[]},"metacognicion":["...","..."],"recursos":["...","..."]},{"nombre":"Desarrollo","tiempo":"${tDesarrollo} min","actividades":["Participan en [técnica]: ...","...","...","...","..."],"evidencias":{"conocimientos":[],"desempeno":["..."],"producto":["..."]},"metacognicion":["...","..."],"recursos":["...","..."]},{"nombre":"Cierre","tiempo":"${tCierre} min","actividades":["...","...","..."],"evidencias":{"conocimientos":[],"desempeno":[],"producto":["..."]},"metacognicion":["...","..."],"recursos":["...","..."]}]}]}`;
}

// ─── Generación de un lote con rotación de proveedores ───────────────────────

async function generateWeekBatch(spec, semanaNum, startDia, count, durMin, numSemanas, memoria, contextoLog) {
  // En idiomas se mantiene el candado duro de estructuras. En las demas areas
  // el foco curricular puede ser procedimiento/concepto/evidencia, por lo que
  // se valida por contrato general y no por igualdad gramatical.
  const focoGram = spec.esIdioma ? getFocoGramatical(spec.contenidosClaves?.gramatica, semanaNum, numSemanas) : [];
  let maxTokens = count === 1 ? SINGLE_CLASS_MAX_TOKENS : MAX_TOKENS;
  let prefix    = '';
  let lastError = null;
  let lastProvider = 'desconocido';
  let lastModel    = 'desconocido';
  let lastRaw      = '';
  let lastTruncationError = null;
  let attemptsUsed = 0;

  // El primer lote de la unidad propone el nombre propio del producto final;
  // una vez fijado en la spec, todos los lotes siguientes lo reciben.
  const pedirNombreProducto = semanaNum === 1 && startDia === 1 && !spec.productoFinalNombre;

  // ESCALERA de composición: máximo 2 intentos por modelo, sin segunda vuelta.
  // JSON estructuralmente incompleto (falta clases[] o llegan menos de las
  // esperadas) descarta al modelo de inmediato: ya demostró no poder componer.
  // Proveedor sin servicio (sin clave, apagado, 503) también se descarta sin
  // quemarle el segundo intento.
  let truncadoPrevio = false;
  const providerOrderBase = await resolvePhaseAProviderOrder();
  const sinProveedorComposicion = providerOrderBase.length === 0;
  const MAX_INTENTOS_POR_PROVEEDOR = 1;
  // Peldaños reales de la escalera: máximo 3 modelos CON SERVICIO (los
  // proveedores sin clave/apagados no consumen peldaño). Con 4 proveedores
  // aptos, un tope de 4+ dejaría el límite sin efecto.
  const MAX_MODELOS_CON_SERVICIO = 2;
  const fallosPorProveedor = new Map();
  const proveedoresProbados = new Set(); // con al menos un intento REAL (no sin-servicio)
  const anotarFallo = (p) => fallosPorProveedor.set(p, (fallosPorProveedor.get(p) || 0) + 1);
  const descartarProveedor = (p) => fallosPorProveedor.set(p, MAX_INTENTOS_POR_PROVEEDOR);
  const maxAttempts = Math.max(2, providerOrderBase.length * MAX_INTENTOS_POR_PROVEEDOR);

  // B3 — FUNDAMENTO DOCTRINAL por nivel antepuesto al rol del compositor.
  // Cacheado (5 min) → una lectura por unidad; apagable sin deploy con
  // config/fundamento-doctrinal.activo=false; su fallo NUNCA detiene la
  // generación (cae al system base).
  let systemFaseA = buildSystemPromptFaseA(spec.nivel);
  try {
    const fund = await getFundamentoDoctrinal(spec.nivel);
    if (fund?.texto && fund.activo !== false) {
      systemFaseA = `${fund.texto}\n\n${systemFaseA}`;
    }
  } catch { /* sin fundamento, system base */ }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    attemptsUsed = attempt;
    const proveedoresActivos = providerOrderBase.filter(
      (p) => (fallosPorProveedor.get(p) || 0) < MAX_INTENTOS_POR_PROVEEDOR
        && (proveedoresProbados.size < MAX_MODELOS_CON_SERVICIO || proveedoresProbados.has(p)));
    if (!proveedoresActivos.length) break; // escalera agotada — detener, no reciclar
    const providerIntento = proveedoresActivos[0];
    const proveedoresDescartados = providerOrderBase.filter(
      (p) => (fallosPorProveedor.get(p) || 0) >= MAX_INTENTOS_POR_PROVEEDOR);
    try {
      const prompt = prefix + buildBatchPrompt(spec, semanaNum, startDia, count, durMin, numSemanas, memoria, pedirNombreProducto);
      const t0 = Date.now();
      lastRaw = '';
      lastProvider = providerIntento || 'desconocido';
      lastModel = 'desconocido';
      const { text: raw, provider, model, usage } = await callGatewayCollect(
        prompt,
        systemFaseA,
        maxTokens,
        [providerIntento],
        proveedoresDescartados,
        true,
      );
      lastProvider = provider;
      lastModel    = model;
      lastRaw      = raw;

      // Registro de USO en aiLogs — tokens EXACTOS del proveedor cuando
      // llegan; estimación chars/4 si no (antes solo se registraban errores
      // de parseo y la generación de unidades quedaba fuera del dashboard)
      logUsage({
        module: MODULE_NAME,
        provider,
        model,
        tokensIn:  usage?.in  || Math.ceil((prompt.length + systemFaseA.length) / 4),
        tokensOut: usage?.out || Math.ceil((raw || '').length / 4),
        ms: Date.now() - t0,
        exact: Boolean(usage),
      });

      const result = extraerJSON(raw);
      if (!result.ok) {
        await logParseError({ contexto: contextoLog, attempt, motivo: result.motivo, raw, provider, model });
        console.error(`[FaseA] ${contextoLog} intento ${attempt}: ${result.motivo}`,
          { inicio: raw.slice(0, 300), fin: raw.slice(-300) });
        lastError = new Error(result.motivo);
        if (result.motivo.includes('TRUNCADO')) {
          maxTokens = count === 1 ? SINGLE_CLASS_RETRY_TOKENS : RETRY_TOKENS;
          truncadoPrevio = true;
          lastTruncationError = lastError;
        }
        else { prefix = JSON_REMINDER; truncadoPrevio = false; }
        const fp = provider && provider !== 'desconocido' ? provider : providerIntento;
        proveedoresProbados.add(fp);
        anotarFallo(fp);
        continue;
      }

      const omitioClases = !Array.isArray(result.data?.clases);
      const soloMetaSemanal = omitioClases
        && (result.data?.adaptacionesSemana || result.data?.observacionesSemana);
      if (soloMetaSemanal) {
        const motivo = 'R1: falta clases[]; el modelo devolvió solo metadata semanal';
        await logParseError({ contexto: contextoLog, attempt, motivo, raw, provider, model });
        console.error(`[FaseA] ${contextoLog} intento ${attempt}: ${motivo}`,
          { inicio: raw.slice(0, 300), fin: raw.slice(-300) });
        lastError = new Error(motivo);
        prefix = buildMissingClassesRepairPrefix({ semanaNum, startDia, count });
        truncadoPrevio = false;
        const fp = provider && provider !== 'desconocido' ? provider : providerIntento;
        proveedoresProbados.add(fp);
        anotarFallo(fp);
        continue;
      }

      normalizarVozBatch(result.data);
      const indicadoresPermitidos = [
        ...(spec.indicadoresTrabajo?.length ? spec.indicadoresTrabajo : spec.indicadores || [])
          .map((ind) => ind.codigoOficial || ind.id || ind.codigo),
        ...(spec.indicadoresTrabajadosAntes || []).map(normalizarCodigo),
        ...(spec.indicadoresDebiles || []).map(normalizarCodigo),
      ].filter(Boolean);
      validateBatch(result.data, durMin, count, focoGram, {
        memoria,
        exigirNombreProducto: pedirNombreProducto,
        temaOficial: spec.temaOficial,
        temaTrabajoSemana: spec.temaTrabajoSemana,
        temasActivos: spec.temasActivos,
        semanaNum,
        indicadoresPermitidos,
        // Días de APROPIACIÓN (Fase 1): eximidos de exigir técnica CLT rica (R12)
        // y de tener que trabajar una estructura gramatical — son de presentación
        // de la unidad, no de práctica.
        diasApropiacion: new Set(
          (Array.isArray(spec.secuenciaBase) ? spec.secuenciaBase : [])
            .filter((c) => Number(c?.fase) === 1)
            .map((c) => Number(c?.dia))
            .filter((n) => Number.isFinite(n)),
        ),
      });

      // 3A — fijar el nombre del producto propuesto por el primer lote
      if (pedirNombreProducto && result.data.productoFinalNombre) {
        spec.productoFinalNombre = String(result.data.productoFinalNombre).trim();
      }
      return result.data;

    } catch (err) {
      const msg = String(err?.message || err || '');
      if (truncadoPrevio && lastTruncationError && /No hay ningún servicio de Inteligencia Artificial|Todos los proveedores|503|tiempo de espera/i.test(msg)) {
        lastError = new Error(`${lastTruncationError.message}. Reintento no disponible: ${msg}`);
      } else {
        lastError = err;
      }
      const failedProvider = (err?.provider && err.provider !== 'desconocido')
        ? err.provider
        : (lastProvider !== 'desconocido' ? lastProvider : providerIntento);
      lastProvider = failedProvider;
      if (err?.model) lastModel = err.model;

      // Estructuralmente incompleto (R1: sin clases[] o menos de las esperadas):
      // el modelo respondió JSON válido pero no compuso — descartarlo ya.
      const estructuralIncompleto = /falta clases\[\]|se esperaban \d+ clases/.test(msg);
      // Sin servicio: sin clave, apagado, cola vacía, 503 o timeout — descartar
      // directo y seguir con otro proveedor fuerte disponible.
      const presupuestoAgotado = isProviderBudgetError(err);
      if (presupuestoAgotado) cooldownProviderForBudget(failedProvider, msg);
      const sinServicio = presupuestoAgotado
        || /No hay ningún servicio de Inteligencia Artificial|Todos los proveedores|Cola vacía|503|tiempo de espera|desactivad|apagado/i.test(msg)
        || err?.timeout === true;
      if (!sinServicio) proveedoresProbados.add(failedProvider);
      if (estructuralIncompleto || sinServicio) descartarProveedor(failedProvider);
      else anotarFallo(failedProvider);
      console.error(`[FaseA] ${contextoLog} intento ${attempt} (${lastProvider}/${lastModel}):`, err.message);
      await logParseError({
        contexto: contextoLog, attempt, motivo: err.message,
        raw: lastRaw, provider: lastProvider, model: lastModel,
      });
    }
  }

  // Escalera agotada → DETENER, nunca degradar a plantillas en silencio.
  // El detalle técnico completo de cada intento ya quedó en aiLogs.
  // FUTURO: cuando exista el Banco de Secuencias, el respaldo legítimo es
  // servir una secuencia cosechada y validada — nunca plantillas.
  const consejo = sinProveedorComposicion
    ? ' No hay proveedor apto para composición de planificaciones; activa o corrige OpenAI, Anthropic, Gemini o Abacus en Administración → Motor de IA.'
    : '';
  throw new Error(
    `Ningún modelo disponible pudo componer la semana ${semanaNum} (${contextoLog}) — ` +
    `revisa la configuración de proveedores de IA en Administración.${consejo} ` +
    `Detalle: ${attemptsUsed} intentos, último ${lastProvider}/${lastModel} — ${lastError?.message}`,
  );
}

const esFalloRecuperablePorTamano = (err) =>
  /JSON TRUNCADO|respuesta truncada|malformad|Unexpected end|respuesta vacía/i.test(String(err?.message || err || ''))
  && !isProviderBudgetError(err);

function agregarClasesAMemoria(clases = [], semanaNum, memoriaAcumulada) {
  clases.forEach(c => {
    const actividades = c.momentos?.find(m => m.nombre === 'Desarrollo')?.actividades || [];
    memoriaAcumulada.push({
      semana: semanaNum,
      dia:    c.dia,
      titulo: c.titulo || `Clase ${c.dia}`,
      desarrolloResumen: actividades[0] || '',
      // Texto COMPLETO y técnica para la anti-repetición GLOBAL (3C): cada
      // lote nuevo se valida contra todo lo ya generado, no solo lo adyacente
      desarrolloTexto: actividades.join(' '),
      actividadCLT: c.actividadCLT?.nombre || '',
      mecanicaCLT: c.actividadCLT?.mecanica || '',
      aporteProducto: c.aporteProducto || '',
    });
  });
}

function storageDisponible() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function hashString(input = '') {
  let h = 2166136261;
  const s = String(input || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function checkpointBaseKey(spec, semanaNum, durMin, numClases, numSemanas) {
  const firma = {
    schema: spec.outputSchemaVersion || '1.3',
    tema: spec.temaOficial,
    temaTrabajoSemana: spec.temaTrabajoSemana,
    temasSemana: spec.temasSemana,
    area: spec.area,
    grado: spec.grado,
    nivelMCERL: spec.nivelMCERL,
    productoFinal: spec.productoFinal,
    productoFinalNombre: spec.productoFinalNombre,
    contextoComunitario: spec.contextoComunitario,
    semanaNum,
    durMin,
    numClases,
    numSemanas,
    contenidosClaves: spec.contenidosClaves,
    indicadores: (spec.indicadores || []).map((i) => [i.id, i.descripcion, i.competenciaId]),
    indicadoresTrabajo: (spec.indicadoresTrabajo || []).map((i) => [i.id, i.descripcion, i.competenciaId]),
  };
  return `${CHECKPOINT_PREFIX}:${hashString(JSON.stringify(firma))}`;
}

function checkpointKey(baseKey, startDia, count) {
  return `${baseKey}:C${startDia}-${startDia + count - 1}`;
}

function leerCheckpoint(key) {
  if (!storageDisponible()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.createdAt || Date.now() - parsed.createdAt > CHECKPOINT_TTL_MS) {
      window.localStorage.removeItem(key);
      return null;
    }
    return parsed.data || null;
  } catch {
    return null;
  }
}

function guardarCheckpoint(key, data) {
  if (!storageDisponible() || !data) return;
  try {
    window.localStorage.setItem(key, JSON.stringify({
      createdAt: Date.now(),
      data,
    }));
  } catch {
    // No fatal: si el navegador no puede guardar, la generación sigue normal.
  }
}

function esBatchCacheValido(data, durMin, count, focoGram, opts) {
  if (!data || !Array.isArray(data.clases)) return false;
  try {
    validateBatch(data, durMin, count, focoGram, opts);
    return true;
  } catch {
    return false;
  }
}

const _normCurricular = (t) => String(t || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

function _textoIndicadorRef(item) {
  if (typeof item === 'string') return item;
  if (!item || typeof item !== 'object') return '';
  return item.id || item.codigo || item.codigoOficial || item.indicadorId || item.descripcion || item.texto || '';
}

function _recolectarRefsIndicadores(node, out = []) {
  if (!node) return out;
  if (Array.isArray(node)) {
    node.forEach((item) => _recolectarRefsIndicadores(item, out));
    return out;
  }
  if (typeof node === 'string') {
    out.push(node);
    return out;
  }
  if (typeof node !== 'object') return out;
  const campos = [
    'indicadores', 'indicadoresLogro', 'indicadoresRelacionados',
    'indicadorIds', 'indicadoresIds', 'indicadoresTrabajados',
  ];
  campos.forEach((campo) => {
    if (node[campo]) _recolectarRefsIndicadores(node[campo], out);
  });
  const ref = _textoIndicadorRef(node);
  if (ref) out.push(ref);
  return out;
}

function _bloquesTemaCurricular(mallaPayload, titulo) {
  const objetivo = _normCurricular(titulo);
  if (!objetivo) return [];
  const objetivos = objetivo
    .split(/\s+(?:\+|\/|\|)\s+|\s*·\s*/i)
    .map((t) => t.trim())
    .filter((t) => t.length > 2);
  const objetivosFinales = objetivos.length ? objetivos : [objetivo];
  const coincide = (bloque) => {
    const nombre = _normCurricular(
      bloque?.tema || bloque?.temaOficial || bloque?.nombre || bloque?.topico || bloque?.conceptos?.temas?.[0],
    );
    return nombre && objetivosFinales.some((obj) => nombre === obj || nombre.includes(obj) || obj.includes(nombre));
  };
  return [
    ...(Array.isArray(mallaPayload?.temas) ? mallaPayload.temas.filter((t) => t && typeof t === 'object' && coincide(t)) : []),
    ...(Array.isArray(mallaPayload?.contenidosPorTema) ? mallaPayload.contenidosPorTema.filter(coincide) : []),
  ];
}

function _tokensCurriculares(texto) {
  const stop = new Set([
    'de', 'del', 'la', 'las', 'el', 'los', 'y', 'o', 'u', 'en', 'con', 'para', 'por', 'a', 'al',
    'the', 'and', 'or', 'of', 'to', 'in', 'at', 'on', 'my', 'our', 'your', 'is', 'are',
    'tema', 'unidad', 'actividad', 'actividades', 'informacion', 'expresar', 'solicitar', 'ofrecer',
  ]);
  return _normCurricular(texto)
    .split(/[^a-z0-9]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !stop.has(t));
}

function _textoAfinidadBloque(bloques = []) {
  const piezas = [];
  const visitar = (node, profundidad = 0) => {
    if (!node || profundidad > 4) return;
    if (typeof node === 'string' || typeof node === 'number') {
      piezas.push(String(node));
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item) => visitar(item, profundidad + 1));
      return;
    }
    if (typeof node !== 'object') return;
    [
      'tema', 'temaOficial', 'nombre', 'topico', 'descripcion',
      'conceptos', 'conceptuales', 'procedimientos', 'procedimentales',
      'actitudes', 'actitudinales', 'vocabulario', 'gramatica',
      'funcionesComunicativas', 'frases', 'situaciones',
    ].forEach((campo) => visitar(node[campo], profundidad + 1));
  };
  bloques.forEach((bloque) => visitar(bloque));
  return textosUnicos(piezas).join(' ');
}

function _limitarYOrdenarIndicadoresTrabajo(items = [], max = MAX_INDICADORES_TRABAJO_UNIDAD) {
  const vistos = new Set();
  const unicos = [];
  items.forEach((item) => {
    const codigo = normalizarCodigo(item?.codigoOficial || item?.id || item?.codigo || item?.descripcion);
    if (!codigo || vistos.has(codigo)) return;
    vistos.add(codigo);
    unicos.push(item);
  });
  if (unicos.length <= max) return unicos;

  const porCompetencia = new Map();
  unicos.forEach((item) => {
    const comp = String(item?.competenciaId || item?.competencia || 'sin_competencia').trim() || 'sin_competencia';
    if (!porCompetencia.has(comp)) porCompetencia.set(comp, []);
    porCompetencia.get(comp).push(item);
  });

  const salida = [];
  let ronda = 0;
  while (salida.length < max) {
    let agrego = false;
    for (const grupo of porCompetencia.values()) {
      if (grupo[ronda] && salida.length < max) {
        salida.push(grupo[ronda]);
        agrego = true;
      }
    }
    if (!agrego) break;
    ronda += 1;
  }
  return salida;
}

function _seleccionarIndicadoresPorAfinidad({ indicadores = [], titulo = '', bloques = [] }) {
  const textoTema = `${titulo} ${_textoAfinidadBloque(bloques)}`;
  const tokensTema = new Set(_tokensCurriculares(textoTema));
  if (!tokensTema.size) return _limitarYOrdenarIndicadoresTrabajo(indicadores);

  const puntuados = indicadores
    .map((ind, index) => {
      const textoInd = `${ind?.descripcion || ind?.texto || ''} ${ind?.aspecto || ''}`;
      const tokensInd = new Set(_tokensCurriculares(textoInd));
      let score = 0;
      tokensInd.forEach((token) => {
        if (tokensTema.has(token)) score += 2;
      });
      const desc = _normCurricular(textoInd);
      const tema = _normCurricular(textoTema);
      if (desc && tema && (tema.includes(desc) || desc.includes(tema))) score += 6;
      return { ind, score, index };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const base = puntuados.length ? puntuados.map((item) => item.ind) : indicadores;
  return _limitarYOrdenarIndicadoresTrabajo(base);
}

function seleccionarIndicadoresTrabajo({ mallaPayload, titulo, indicadores }) {
  const bloques = _bloquesTemaCurricular(mallaPayload, titulo);
  const refs = textosUnicos(bloques.flatMap((bloque) => _recolectarRefsIndicadores(bloque)));
  if (!refs.length) {
    return {
      indicadoresTrabajo: _seleccionarIndicadoresPorAfinidad({ indicadores, titulo, bloques }),
      fuente: 'afinidad_tema_sin_relacion_explicita',
    };
  }
  const refsNorm = refs.map((r) => ({
    codigo: normalizarCodigo(r),
    texto: _normCurricular(r),
  })).filter((r) => r.codigo || r.texto);
  const seleccionados = indicadores.filter((ind) => {
    const codigo = normalizarCodigo(ind.codigoOficial || ind.id);
    const desc = _normCurricular(ind.descripcion || ind.texto);
    return refsNorm.some((ref) =>
      (ref.codigo && codigo && ref.codigo === codigo)
      || (ref.texto && desc && (ref.texto === desc || desc.includes(ref.texto) || ref.texto.includes(desc)))
    );
  });
  if (seleccionados.length) {
    return {
      indicadoresTrabajo: _limitarYOrdenarIndicadoresTrabajo(seleccionados),
      fuente: seleccionados.length > MAX_INDICADORES_TRABAJO_UNIDAD ? 'malla_relacion_tema_capada' : 'malla_relacion_tema',
    };
  }
  return {
    indicadoresTrabajo: _seleccionarIndicadoresPorAfinidad({ indicadores, titulo, bloques }),
    fuente: 'afinidad_tema_relacion_no_resuelta',
  };
}

// ─── generateWeekPlan — exportación principal ─────────────────────────────────

export const generateWeekPlan = async (
  spec, semanaNum, durMin, numClases, numSemanas = 4,
  memoriaAcumulada = [], onProgress = null,
) => {
  const batches    = Math.ceil(numClases / BATCH_SIZE);
  const allClases  = [];
  let adaptacionesSemana = null;   // NEAE ligadas al foco (contrato R14)
  let observacionesSemana = '';
  const focoGram = spec.esIdioma ? getFocoGramatical(spec.contenidosClaves?.gramatica, semanaNum, numSemanas) : [];
  const indicadoresPermitidos = [
    ...(spec.indicadoresTrabajo?.length ? spec.indicadoresTrabajo : spec.indicadores || [])
      .map((ind) => ind.codigoOficial || ind.id || ind.codigo),
    ...(spec.indicadoresTrabajadosAntes || []).map(normalizarCodigo),
    ...(spec.indicadoresDebiles || []).map(normalizarCodigo),
  ].filter(Boolean);
  const optsValidacionTema = {
    temaOficial: spec.temaOficial,
    temaTrabajoSemana: spec.temaTrabajoSemana,
    temasActivos: spec.temasActivos,
  };
  const baseCheckpointKey = checkpointBaseKey(spec, semanaNum, durMin, numClases, numSemanas);

  for (let b = 0; b < batches; b++) {
    const startDia   = b * BATCH_SIZE + 1;
    const count      = Math.min(BATCH_SIZE, numClases - b * BATCH_SIZE);
    const endDia     = startDia + count - 1;
    const contextoLog = `S${semanaNum}/C${startDia}-${endDia}`;

    onProgress?.(startDia, endDia);

    let nuevasClases = [];
    let memoriaActualizada = false;
    const batchKey = checkpointKey(baseCheckpointKey, startDia, count);
    const cachedBatch = leerCheckpoint(batchKey);
    if (esBatchCacheValido(cachedBatch, durMin, count, focoGram, {
      memoria: memoriaAcumulada,
      indicadoresPermitidos,
      ...optsValidacionTema,
      exigirNombreProducto: semanaNum === 1 && startDia === 1 && !spec.productoFinalNombre,
      semanaNum,
    })) {
      nuevasClases = cachedBatch.clases.slice(0, count).map((c, i) => ({ ...c, dia: startDia + i }));
      if (!adaptacionesSemana && cachedBatch.adaptacionesSemana) {
        adaptacionesSemana = cachedBatch.adaptacionesSemana;
        observacionesSemana = String(cachedBatch.observacionesSemana || '').trim();
      }
      if (!spec.productoFinalNombre && cachedBatch.productoFinalNombre) {
        spec.productoFinalNombre = String(cachedBatch.productoFinalNombre || '').trim();
      }
      allClases.push(...nuevasClases);
      agregarClasesAMemoria(nuevasClases, semanaNum, memoriaAcumulada);
      continue;
    }

    const singleKeys = Array.from({ length: count }, (_, i) => {
      const dia = startDia + i;
      return { dia, key: checkpointKey(baseCheckpointKey, dia, 1), data: leerCheckpoint(checkpointKey(baseCheckpointKey, dia, 1)) };
    });
    const hayCacheParcial = count > 1 && singleKeys.some((item) => item.data);
    if (hayCacheParcial) {
      for (const item of singleKeys) {
        onProgress?.(item.dia, item.dia);
        if (esBatchCacheValido(item.data, durMin, 1, focoGram, { memoria: memoriaAcumulada, indicadoresPermitidos, ...optsValidacionTema, exigirNombreProducto: false, semanaNum })) {
          const claseCache = { ...item.data.clases?.[0], dia: item.dia };
          nuevasClases.push(claseCache);
          agregarClasesAMemoria([claseCache], semanaNum, memoriaAcumulada);
          if (!adaptacionesSemana && item.data.adaptacionesSemana) {
            adaptacionesSemana = item.data.adaptacionesSemana;
            observacionesSemana = String(item.data.observacionesSemana || '').trim();
          }
          continue;
        }
        const singleData = await generateWeekBatch(
          spec, semanaNum, item.dia, 1, durMin, numSemanas, memoriaAcumulada, `S${semanaNum}/C${item.dia}`,
        );
        const clase = { ...singleData.clases?.[0], dia: item.dia };
        nuevasClases.push(clase);
        agregarClasesAMemoria([clase], semanaNum, memoriaAcumulada);
        if (!adaptacionesSemana && singleData.adaptacionesSemana) {
          adaptacionesSemana = singleData.adaptacionesSemana;
          observacionesSemana = String(singleData.observacionesSemana || '').trim();
        }
        guardarCheckpoint(item.key, {
          ...singleData,
          clases: [clase],
          productoFinalNombre: spec.productoFinalNombre || singleData.productoFinalNombre || '',
        });
      }
      allClases.push(...nuevasClases);
      continue;
    }

    try {
      const batchData = await generateWeekBatch(
        spec, semanaNum, startDia, count, durMin, numSemanas, memoriaAcumulada, contextoLog,
      );
      nuevasClases = batchData.clases.slice(0, count).map((c, i) => ({
        ...c, dia: startDia + i,
      }));
      if (!adaptacionesSemana && batchData.adaptacionesSemana) {
        adaptacionesSemana = batchData.adaptacionesSemana;
        observacionesSemana = String(batchData.observacionesSemana || '').trim();
      }
      guardarCheckpoint(batchKey, {
        ...batchData,
        clases: nuevasClases,
        productoFinalNombre: spec.productoFinalNombre || batchData.productoFinalNombre || '',
      });
    } catch (err) {
      if (count <= 1 || !esFalloRecuperablePorTamano(err)) throw err;
      console.warn(`[FaseA] ${contextoLog}: lote truncado; reintentando clase por clase.`);
      for (let dia = startDia; dia <= endDia; dia++) {
        onProgress?.(dia, dia);
        const singleKey = checkpointKey(baseCheckpointKey, dia, 1);
        const cachedSingle = leerCheckpoint(singleKey);
        if (esBatchCacheValido(cachedSingle, durMin, 1, focoGram, { memoria: memoriaAcumulada, indicadoresPermitidos, ...optsValidacionTema, exigirNombreProducto: false, semanaNum })) {
          const claseCache = { ...cachedSingle.clases?.[0], dia };
          nuevasClases.push(claseCache);
          agregarClasesAMemoria([claseCache], semanaNum, memoriaAcumulada);
          if (!adaptacionesSemana && cachedSingle.adaptacionesSemana) {
            adaptacionesSemana = cachedSingle.adaptacionesSemana;
            observacionesSemana = String(cachedSingle.observacionesSemana || '').trim();
          }
          continue;
        }
        const singleData = await generateWeekBatch(
          spec, semanaNum, dia, 1, durMin, numSemanas, memoriaAcumulada, `S${semanaNum}/C${dia}`,
        );
        const clase = singleData.clases?.[0];
        const claseNormalizada = { ...clase, dia };
        nuevasClases.push(claseNormalizada);
        agregarClasesAMemoria([claseNormalizada], semanaNum, memoriaAcumulada);
        if (!adaptacionesSemana && singleData.adaptacionesSemana) {
          adaptacionesSemana = singleData.adaptacionesSemana;
          observacionesSemana = String(singleData.observacionesSemana || '').trim();
        }
        guardarCheckpoint(singleKey, {
          ...singleData,
          clases: [claseNormalizada],
          productoFinalNombre: spec.productoFinalNombre || singleData.productoFinalNombre || '',
        });
      }
      memoriaActualizada = true;
    }

    allClases.push(...nuevasClases);
    if (nuevasClases.length && !memoriaActualizada) {
      agregarClasesAMemoria(nuevasClases, semanaNum, memoriaAcumulada);
    }
  }

  const combined = {
    outputSchemaVersion: '1.3',
    semana: semanaNum,
    clases: allClases,
    adaptacionesSemana,
    observacionesSemana,
    productoFinalNombre: spec.productoFinalNombre || '',
  };
  try {
    validateWeekPlan(combined, durMin, numClases);
  } catch (err) {
    // Único camino de fallo fuera del bucle de reintentos (lotes ya aceptados,
    // incluso de caché): sin registro aquí, el triaje en aiLogs queda ciego.
    await logParseError({
      contexto: `S${semanaNum}/semana-combinada`,
      attempt:  0,
      motivo:   err.message,
      raw:      '',
      provider: 'combinado',
      model:    'combinado',
    });
    throw new Error(`S${semanaNum} (validación de semana combinada): ${err.message}`, { cause: err });
  }
  return combined;
};

// ─── buildEspecificacionCurricular — exportada para uso externo ───────────────

export const buildEspecificacionCurricular = ({
  mallaPayload, titulo, allInds, allComps, mallaContenidos, area, grado,
  producto = '', contextoComunitario = '',
}) => {
  // TODAS las competencias del grado (el registro oficial trae 7 con nombre y
  // específica). Antes se recortaba a 4 y la IA no veía el panorama completo
  // para asociar indicadores auténticamente al tema.
  const ces = (allComps || []).map(c => ({
    id:            c.id || c.codigo || '',
    codigoOficial: c.id || c.codigo || '',
    fundamental:   c.competenciaFundamental || c.fundamental || '',
    descripcion:   c.especificaGrado || c.especifica || c.descripcion || '',
  })).filter(c => c.descripcion || c.fundamental);

  // TODOS los indicadores del grado (el registro oficial trae 21: 3 por
  // competencia). La IA debe VER los 21 para elegir cuáles trabaja el tema —
  // ese es el "cerebro" que decide qué se resalta. Antes veía solo 9 y no podía
  // proponer con criterio real. Se conserva la competencia de cada indicador
  // para que el reparto y el resaltado sean fieles al registro.
  //
  // Numeración CORRIDA IL-1…IL-21: el registro oficial numera consecutivo, no
  // reiniciando por competencia. Si la malla trae "IL-N" REPETIDO (error de
  // conversión), la IA vería códigos duplicados y no podría elegir con criterio;
  // por eso se renumera corrido por posición global. Un código único no-IL
  // (genuino) se respeta. Debe coincidir con construirCompetenciasDetalle.
  const _esCodigoRegistroIL = (cod) => /^il[-\s]?\d+$/i.test(String(cod || '').trim());
  const indicadores = (allInds || [])
    .map(ind => ({
      _codOriginal:  ind.id || ind.codigo || '',
      descripcion:   ind.descripcion || ind.texto || '',
      competenciaId: ind.competenciaId || ind.competencia || '',
      aspecto:       '',
    }))
    .filter(i => i.descripcion)
    .map((ind, gi) => {
      const conservar = ind._codOriginal && !_esCodigoRegistroIL(ind._codOriginal);
      const cod = conservar ? ind._codOriginal : `IL-${gi + 1}`;
      return { id: cod, codigoOficial: cod, descripcion: ind.descripcion, competenciaId: ind.competenciaId, aspecto: '' };
    });
  const seleccionIndicadores = seleccionarIndicadoresTrabajo({ mallaPayload, titulo, indicadores });

  const esIdioma = area === 'Inglés' || area === 'Francés';
  const arquitecturaCurricular = construirArquitecturaUnidadMINERD({
    mallaPayload,
    titulo,
    area,
    asignatura: mallaPayload?.asignatura || mallaPayload?.metadata?.asignatura || area,
    grado,
    ciclo: mallaPayload?.ciclo || mallaPayload?.metadata?.ciclo || '',
    nivel: mallaPayload?.nivel || mallaPayload?.metadata?.nivel || '',
    producto,
    contextoComunitario,
    mallaContenidos,
    competencias: allComps || [],
    indicadores,
    indicadoresTrabajo: seleccionIndicadores.indicadoresTrabajo,
    estrategia: mallaPayload?.estrategiasSugeridas?.[0]?.nombre || mallaPayload?.estrategiasSugeridas?.[0] || '',
  });

  return {
    temaOficial: titulo,
    area,
    grado,
    nivelMCERL:  mallaPayload?.nivelMCERL || null,
    esIdioma,
    idiomaNombre: esIdioma ? (area === 'Francés' ? 'francés' : 'inglés') : null,
    ces,
    indicadores,
    indicadoresTrabajo: seleccionIndicadores.indicadoresTrabajo,
    indicadoresTrabajoFuente: seleccionIndicadores.fuente,
    arquitecturaCurricular,
    contenidosClaves: {
      vocabulario: mallaContenidos?.vocabulario?.slice(0, 20) || [],
      gramatica:   mallaContenidos?.gramatica?.slice(0, 6)   || [],
      // Procedimentales/funcionales AFINES al tema: todos los que trajo la
      // malla (hasta 10), no un recorte que pierda contenidos oficiales
      funcionales: mallaContenidos?.funcionales?.slice(0, 10) || [],
      // Expresiones oficiales del tema (Capa 2) — la IA las incrusta en las
      // situaciones comunicativas
      expresiones: mallaContenidos?.expresiones?.slice(0, 6) || [],
    },
    // 3A/5 — producto del docente (base para el nombre propio que propone la
    // IA en el primer lote) y contexto comunitario en SUS palabras (opcional)
    productoFinal: String(producto || '').trim(),
    productoFinalNombre: '',
    contextoComunitario: String(contextoComunitario || '').trim(),
    outputSchemaVersion: '1.3',
  };
};
