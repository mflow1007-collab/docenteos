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
import { loadGatewayConfig }                    from './ai/AIService.js';
import { logUsage }                             from './ai/usage.js';

const MODULE_NAME  = 'planificacion';
const BATCH_SIZE   = 2;
const MAX_TOKENS   = 9000;   // por lote (contrato incluye evidencias/metacognición/recursos); escala a 12000 si hay truncamiento
const RETRY_TOKENS = 16000;

// Para JSON curricular estricto conviene priorizar proveedores con salida
// estructurada estable. NVIDIA queda disponible, pero no como primera opción
// para Phase A aunque el admin lo tenga arriba para tareas conversacionales.
const PHASE_A_PROVIDER_ORDER = ['openai', 'anthropic', 'gemini', 'nvidia', 'abacus'];

// Exemplars de estilo: MÁXIMO uno por concepto (saludo, retroalimentación,
// producción). Se listan aparte porque también alimentan la validación
// anti-copia: un Desarrollo que calque un exemplar del prompt se rechaza.
export const EXEMPLARS_ESTILO = [
  'Responden al saludo e indicaciones iniciales. (Good morning! How are you today? Are you ready for the class?)',
  'Retroalimentación del vocabulario trabajado en la clase anterior. (Do you remember the last class? What words do you remember about daily routines?)',
  'Elaboran un mapa de ideas sobre las actividades que consideran más importantes dentro de su rutina diaria. Socializan sus respuestas explicando brevemente por qué esas actividades son importantes para su vida.',
];

const SYSTEM_PROMPT =
  'Eres un planificador curricular experto del formato oficial MINERD. ' +
  'Redactas cada actividad iniciando con un VERBO en tercera persona plural del presente ' +
  '(Responden, Observan, Escuchan, Elaboran, Socializan, Practican, Identifican, Comparan, Guardan...) ' +
  'y NUNCA inicias con "Los estudiantes", "El docente", "La docente", "Se", "Ticket", "Reflexión" ni nombres de recursos. ' +
  'El inglés va incrustado entre paréntesis dentro de la actividad. ' +
  'Estilo oficial de referencia (referencia de VOZ, jamás los copies como actividades): ' +
  EXEMPLARS_ESTILO.map((e) => `"${e}"`).join(' · ') + ' ' +
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

async function callGatewayCollect(prompt, system, maxTokens = MAX_TOKENS, providerOrder = PHASE_A_PROVIDER_ORDER) {
  const user = getAuth().currentUser;
  if (!user) throw new Error('Usuario no autenticado');

  let idToken;
  try { idToken = await user.getIdToken(false); } catch { idToken = null; }

  // Config del admin (prioridad, modelos y APAGADOS): la generación de
  // unidades respeta el mismo interruptor de proveedores que el resto
  let gwConfig = {};
  try { gwConfig = await loadGatewayConfig(); } catch { /* no-fatal */ }

  const response = await fetch('/api/ai/generate', {
    method: 'POST',
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
      modelOverrides: gwConfig.models || undefined,
      providersDisabled: Array.isArray(gwConfig.disabled) ? gwConfig.disabled : undefined,
    }),
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
  const NO_VERBOS = /^(se|el|la|lo|le|de|una?|su|sus)$/i;
  if (primera.length >= 4 && /^[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]+$/.test(primera)
    && /[aeáéo]$/.test(primera) && !/n$/.test(primera) && !NO_VERBOS.test(primera)
    && !ARRANQUES_PROHIBIDOS.test(t) && !ARRANQUES_NOMINALES.test(t)) {
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
];

const APORTE_GENERICO = [
  'avance del producto', 'avance del proyecto', 'trabajo en el proyecto',
  'trabajo en el producto', 'aporte al producto', 'aporte al proyecto',
  'continúan el producto', 'avanzan en el producto',
];

const CLT_GENERICO = [
  'actividad', 'práctica', 'ejercicio', 'dinámica', 'juego',
  'trabajo en grupo', 'trabajo colaborativo', 'trabajo en parejas',
];

const EVIDENCIA_NO_EVALUABLE = [
  'participación activa en el saludo', 'participación en el saludo',
  'atención y reacción al saludo', 'interacción activa con el saludo',
  'respuestas al saludo', 'interés mostrado en el video',
  'participación activa en la clase', 'atención a la explicación',
];

// Evidencias DESAGREGADAS (documento modelo): {conocimientos, desempeno,
// producto} — al menos una clave con contenido; el Desarrollo exige desempeño
// o producto; nada de "participación activa en el saludo".
const CLAVES_EVIDENCIA = ['conocimientos', 'desempeno', 'producto'];
function validarEvidenciasMomento(ev, esDesarrollo, etiqueta) {
  if (!ev || typeof ev !== 'object' || Array.isArray(ev)) {
    throw new Error(`R4: ${etiqueta} — "evidencias" debe ser objeto {conocimientos/desempeno/producto} con arrays, no lista plana`);
  }
  const presentes = CLAVES_EVIDENCIA.filter(
    (k) => Array.isArray(ev[k]) && ev[k].filter((x) => String(x || '').trim()).length,
  );
  if (!presentes.length) {
    throw new Error(`R4: ${etiqueta} — evidencias sin ninguna clave con contenido`);
  }
  if (esDesarrollo && !presentes.includes('desempeno') && !presentes.includes('producto')) {
    throw new Error(`R4: ${etiqueta} — el Desarrollo exige evidencias de desempeño o de producto`);
  }
  for (const k of presentes) {
    for (const e of ev[k]) {
      const vaga = EVIDENCIA_NO_EVALUABLE.find((b) => _normTextoFoco(e).includes(_normTextoFoco(b)));
      if (vaga) throw new Error(`R4: ${etiqueta} — evidencia no evaluable ("${vaga}"): describe un desempeño o producto observable`);
    }
  }
}

const textoDesarrollo = (clase) =>
  ((clase?.momentos || []).find((m) => m.nombre === 'Desarrollo')?.actividades || []).join(' ');

export function validateBatch(data, durMin, count, focoGram = [], opts = {}) {
  const memoria = Array.isArray(opts.memoria) ? opts.memoria : [];

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

  for (let idx = 0; idx < count; idx++) {
    const clase = data.clases[idx];
    if (!Array.isArray(clase?.momentos) || clase.momentos.length !== 3) {
      throw new Error(`R1: clase ${idx + 1} debe tener 3 momentos`);
    }
    if (!Array.isArray(clase.indicadoresTrabajados)) {
      throw new Error(`R1: clase ${idx + 1} sin indicadoresTrabajados[] (usa los códigos de la especificación)`);
    }
    if (!textoNoVacio(clase.titulo)) {
      throw new Error(`R1: clase ${idx + 1} sin titulo`);
    }
    if (!textoNoVacio(clase.intencionPedagogica)) {
      throw new Error(`R1: clase ${idx + 1} sin intencionPedagogica`);
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
    if (!/\bmediante\b/i.test(intencion)) {
      throw new Error(`R9: clase ${idx + 1} — la intención no dice el CÓMO ("mediante [actividades concretas del día]")`);
    }
    // El CON QUÉ (el instrumento lingüístico): se acepta cualquier conector
    // equivalente natural, no solo el gerundio "utilizando". Rechazar "con la
    // estructura…"/"a través del vocabulario…" era un falso positivo por rigidez
    // léxica — lo que importa es que el instrumento esté DECLARADO, no la palabra.
    const declaraInstrumento = /\b(utilizando|usando|empleando|aplicando)\b/i.test(intencion)
      || /\b(a través de|por medio de|mediante el uso de|con (la|el|las|los)\s)/i.test(intencion);
    if (!declaraInstrumento) {
      throw new Error(`R9: clase ${idx + 1} — la intención no dice el CON QUÉ (el instrumento: "utilizando [estructura/vocabulario del día]", "con la estructura…", "a través del vocabulario…")`);
    }
    const vaga = FRASES_VAGAS_INTENCION.find((f) => _normTextoFoco(intencion).includes(_normTextoFoco(f)));
    if (vaga) {
      throw new Error(`R9: clase ${idx + 1} — intención vaga ("${vaga}"): nombra el contenido y las actividades REALES del día`);
    }

    // Foco lingüístico anclado al plan gramatical del bloque: el encabezado
    // del día debe declarar una estructura OFICIAL del foco, no una etiqueta
    // inventada. (Bloque introductorio sin foco → sin restricción.)
    if (focoGram.length) {
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
    if (cltEnLote.has(cltNombreNorm)) {
      throw new Error(`R12: clase ${idx + 1} repite la técnica "${clt.nombre}" de la clase ${cltEnLote.get(cltNombreNorm)} del mismo lote`);
    }
    cltEnLote.set(cltNombreNorm, idx + 1);
    // La técnica debe aparecer en ALGUNA actividad del Desarrollo (no
    // necesariamente la primera ni literal en la misma posición): tolerante a
    // que la IA la parafrasee alrededor, pero exige que esté presente.
    const actsDesarrollo = (clase.momentos.find((m) => m.nombre === 'Desarrollo')?.actividades || []);
    if (!actsDesarrollo.some((a) => _normTextoFoco(a).includes(cltNombreNorm))) {
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
      validarEvidenciasMomento(m.evidencias, m.nombre === 'Desarrollo', `clase ${idx + 1} momento "${m.nombre}"`);
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
  return gramaticaArray.slice(start, start + perWeek);
}

// ─── Prompt de lote ───────────────────────────────────────────────────────────

function buildBatchPrompt(spec, semanaNum, startDia, count, durMin, numSemanas, memoria, pedirNombreProducto = false) {
  const tInicio     = durMin <= 50 ? 10 : 15;
  const tCierre     = durMin <= 50 ? 5  : 10;
  const tDesarrollo = durMin - tInicio - tCierre;

  const vocab      = spec.contenidosClaves?.vocabulario?.slice(0, 16).join(', ') || '';
  const funcs      = spec.contenidosClaves?.funcionales?.slice(0, 8).join('; ')  || '';
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
  const exprs      = spec.contenidosClaves?.expresiones?.slice(0, 6).join('; ') || '';
  const idiomaMeta = spec.esIdioma
    ? `en ${spec.idiomaNombre || 'inglés'} sencillo (nivel del estudiante)`
    : 'en español';

  const endDia  = startDia + count - 1;
  const rango   = count === 1 ? `Clase ${startDia}` : `Clases ${startDia}-${endDia}`;
  const esPrimeraClaseUnidad = semanaNum === 1 && startDia === 1;

  // 3A — producto final NOMBRADO: el primer lote lo propone; los siguientes
  // lo reciben fijado y cada clase deposita un aporte concreto a ese producto
  const productoLinea = spec.productoFinalNombre
    ? `- PRODUCTO FINAL DE LA UNIDAD: «${spec.productoFinalNombre}» — cada "aporteProducto" alimenta ESTE producto.`
    : (pedirNombreProducto
      ? `- PRODUCTO FINAL: propón "productoFinalNombre" — nombre PROPIO y concreto derivado del tema y los discursivos de la malla (ej. tema Vivienda + croquis → "My House Map & Tour"). PROHIBIDO el genérico "Presentación/producción final sobre el tema".`
      : (spec.productoFinal ? `- PRODUCTO FINAL DE LA UNIDAD: ${spec.productoFinal}` : ''));
  const contextoLinea = spec.contextoComunitario
    ? `- CONTEXTO COMUNITARIO REAL (palabras del docente — úsalo en situaciones y actividades; NO inventes otros datos locales): ${spec.contextoComunitario}`
    : '';

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
- Funciones comunicativas (PROCEDIMENTALES afines al tema — trabájalas TODAS a lo largo de la unidad, distribuidas entre las clases; no las omitas): ${funcs}
${productoLinea ? `${productoLinea}\n` : ''}${contextoLinea ? `${contextoLinea}\n` : ''}${exprs ? `- Expresiones oficiales del tema (incrústalas en las situaciones comunicativas): ${exprs}\n` : ''}${formatearMemoria(memoria)}
TAREA: Genera exactamente ${count} clase(s) — ${rango} de la Semana ${semanaNum}.
Clases con PROGRESIÓN PEDAGÓGICA, DISTINTAS de las ya programadas.
El foco gramatical asignado debe trabajarse explícitamente en el Desarrollo.

REGLAS:
1. Solo JSON puro, sin texto ni markdown.
2. Desarrollos distintos entre sí y distintos a los ya listados arriba.
3. Tiempos: Inicio=${tInicio} min, Desarrollo=${tDesarrollo} min, Cierre=${tCierre} min.
4. VOZ OBLIGATORIA: toda actividad inicia con VERBO en tercera persona plural del presente ("Responden...", "Observan...", "Elaboran...", "Socializan..."). PROHIBIDO iniciar con "Los estudiantes", "El docente", "La docente" o "Se". El inglés va incrustado entre paréntesis dentro de la actividad. Los depósitos al portafolio se nombran explícitos ("Guardan la producción escrita como Entrada N del Portafolio.").
5. Desarrollo: 4 o 5 actividades concretas y progresivas, según la complejidad del foco: modelado o explicación guiada → práctica guiada → práctica colaborativa → producción individual o grupal → retroalimentación breve si aplica. Cierre: 3 o 4 actividades, según el cierre natural de la clase: socialización de producciones → reflexión sobre un aspecto específico → organización del artefacto en el portafolio → pregunta/ticket final.
${reglaInicio}
7. CADA momento (incluido Inicio) incluye: "evidencias" DESAGREGADAS como objeto {"conocimientos":[...], "desempeno":[...], "producto":[...]} — al menos una clave con contenido; el Desarrollo SIEMPRE con desempeno o producto. Cada evidencia es observable y evaluable ("Construye oraciones en presente simple sobre su rutina", "Cinco oraciones escritas sobre su horario"); PROHIBIDAS las no evaluables ("Participación activa en el saludo", "Atención a la explicación"). Además "metacognicion" (2 preguntas de reflexión para el estudiante, ${idiomaMeta}) y "recursos" (2-4 recursos didácticos concretos de ESE momento, en español). Nada puede quedar vacío.
8. CADA clase incluye "indicadoresTrabajados": los códigos de los indicadores de la especificación que esa clase trabaja realmente (mínimo 1).
9. CADA clase incluye "titulo" (título llamativo de la clase, puede incluir inglés) e "intencionPedagogica" DIRECTA Y OBJETIVA con el formato oficial: "Desde el inicio hasta el final de la clase, los estudiantes [qué harán con el CONTENIDO ESPECÍFICO del día — nómbralo] mediante [las actividades concretas de ESTA clase], utilizando [la estructura gramatical o el vocabulario del día — o su equivalente "con la estructura…", "a través del vocabulario…"], [evidencia de logro observable]." PROHIBIDO el relleno vago SIN nombrar el contenido: "mediante una serie de actividades", "diversas actividades" — si dices "vocabulario", nombra CUÁL ("vocabulario de las partes de la casa: kitchen, bedroom") — nombra siempre el contenido real (ej.: "describirán sus hábitos saludables y la frecuencia con la que realizan actividades cotidianas mediante comprensión oral, interacción y producción escrita, utilizando presente simple y adverbios de frecuencia").
10. CADA clase incluye encabezado pedagógico: "tituloSemana" (título descriptivo de la semana según la progresión), "focoLinguistico" (copia EXACTA de UNA estructura del FOCO GRAMATICAL indicado arriba, incluidos sus ejemplos entre paréntesis; si es Semana 1: "Apropiación de la unidad / producto / evaluación") y "estrategiasDia" (2-3 estrategias coherentes separadas por " • "). Semana 1 debe apropiarse de la unidad: clase 1 presenta situación/tema/saberes previos y clase 2 presenta producto final, criterios/evaluación y portafolio. Desde semana 2, avanza por vocabulario, expresiones, gramática y producción usando la malla, y la intención pedagógica de cada clase nombra su foco del día.
11. CADA clase incluye "aporteProducto": el artefacto CONCRETO Y NOMBRADO que esa clase deposita al producto final (ej. "Inventario del espacio favorito con posesivos", "Weekly schedule con horarios en inglés"). PROHIBIDO "avance del producto", "trabajo en el proyecto".${pedirNombreProducto ? ' El LOTE incluye además "productoFinalNombre" (ver arriba).' : ''}
12. CADA clase incluye "actividadCLT": {"nombre": técnica metodológica del Desarrollo (Listen and Act / Listen and Solve / Listen and Compare / Information Gap / Role Play con roles / Interview en parejas / Frequency Walk / Gallery Walk / Describe and Draw / TPR / Speaking Circle...), "mecanica": cómo funciona en 1-2 líneas}. La PRIMERA actividad del Desarrollo la nombra explícitamente ("Participan en Listen and Solve: escuchan… y resuelven…"). No repitas una técnica ya usada en la unidad; en otra fase solo con mecánica DISTINTA. Patrón sugerido del Desarrollo: listening con propósito O misión comunicativa → producción → verificación entre pares.
13. NO copies los ejemplos de estilo del sistema como actividades: son referencia de VOZ. Cada actividad es específica del contenido de ESTA clase.
14. El LOTE incluye "adaptacionesSemana": {"acceso", "metodologicas", "evaluacion"} — adecuaciones NEAE LIGADAS AL FOCO de la semana (ej. semana de 3ra persona → "banco de verbos en tercera persona visible") — y "observacionesSemana": qué observar/registrar esta semana según su foco. Nunca genéricas.

{"outputSchemaVersion":"1.3","semana":${semanaNum},${pedirNombreProducto ? '"productoFinalNombre":"...",' : ''}"adaptacionesSemana":{"acceso":"...","metodologicas":"...","evaluacion":"..."},"observacionesSemana":"...","clases":[{"dia":${startDia},"tituloSemana":"...","titulo":"...","focoLinguistico":"...","estrategiasDia":"Indagación dialógica • Exploración guiada • Aprendizaje colaborativo","intencionPedagogica":"Desde el inicio hasta el final de la clase, los estudiantes...","indicadoresTrabajados":["..."],"actividadCLT":{"nombre":"...","mecanica":"..."},"aporteProducto":"...","saludoInicial":"Good morning! ...","retroalimentacionPrevia":"Retroalimentación de... (...?)","saberesPrevios":"Recuperación o exploración de saberes previos sobre...","actividadEnganche":"Observan...","momentos":[{"nombre":"Inicio","tiempo":"${tInicio} min","evidencias":{"conocimientos":["..."],"desempeno":["..."]},"metacognicion":["...","..."],"recursos":["...","..."]},{"nombre":"Desarrollo","tiempo":"${tDesarrollo} min","actividades":["Participan en [técnica]: ...","...","...","...","..."],"evidencias":{"desempeno":["...","..."],"producto":["..."]},"metacognicion":["...","..."],"recursos":["...","..."]},{"nombre":"Cierre","tiempo":"${tCierre} min","actividades":["...","...","..."],"evidencias":{"desempeno":["..."],"producto":["..."]},"metacognicion":["...","..."],"recursos":["...","..."]}]}]}`;
}

// ─── Generación de un lote (2 intentos por lote) ─────────────────────────────

async function generateWeekBatch(spec, semanaNum, startDia, count, durMin, numSemanas, memoria, contextoLog) {
  // El foco del bloque es el MISMO que recibió el prompt: la validación exige
  // que cada focoLinguistico del día sea una estructura oficial de este set.
  const focoGram = getFocoGramatical(spec.contenidosClaves?.gramatica, semanaNum, numSemanas);
  let maxTokens = MAX_TOKENS;
  let prefix    = '';
  let lastError = null;
  let lastProvider = 'desconocido';
  let lastModel    = 'desconocido';
  let lastRaw      = '';

  // El primer lote de la unidad propone el nombre propio del producto final;
  // una vez fijado en la spec, todos los lotes siguientes lo reciben.
  const pedirNombreProducto = semanaNum === 1 && startDia === 1 && !spec.productoFinalNombre;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const prompt = prefix + buildBatchPrompt(spec, semanaNum, startDia, count, durMin, numSemanas, memoria, pedirNombreProducto);
      const t0 = Date.now();
      const { text: raw, provider, model, usage } = await callGatewayCollect(prompt, SYSTEM_PROMPT, maxTokens);
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
        tokensIn:  usage?.in  || Math.ceil((prompt.length + SYSTEM_PROMPT.length) / 4),
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
        if (result.motivo.includes('TRUNCADO')) maxTokens = RETRY_TOKENS;
        else prefix = JSON_REMINDER;
        continue;
      }

      normalizarVozBatch(result.data);
      validateBatch(result.data, durMin, count, focoGram, {
        memoria,
        exigirNombreProducto: pedirNombreProducto,
        semanaNum,
      });

      // 3A — fijar el nombre del producto propuesto por el primer lote
      if (pedirNombreProducto && result.data.productoFinalNombre) {
        spec.productoFinalNombre = String(result.data.productoFinalNombre).trim();
      }
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

const esFalloRecuperablePorTamano = (err) =>
  /JSON TRUNCADO|respuesta truncada|malformad|Unexpected end/i.test(String(err?.message || err || ''));

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

// ─── generateWeekPlan — exportación principal ─────────────────────────────────

export const generateWeekPlan = async (
  spec, semanaNum, durMin, numClases, numSemanas = 4,
  memoriaAcumulada = [], onProgress = null,
) => {
  const batches    = Math.ceil(numClases / BATCH_SIZE);
  const allClases  = [];
  let adaptacionesSemana = null;   // NEAE ligadas al foco (contrato R14)
  let observacionesSemana = '';

  for (let b = 0; b < batches; b++) {
    const startDia   = b * BATCH_SIZE + 1;
    const count      = Math.min(BATCH_SIZE, numClases - b * BATCH_SIZE);
    const endDia     = startDia + count - 1;
    const contextoLog = `S${semanaNum}/C${startDia}-${endDia}`;

    onProgress?.(startDia, endDia);

    let nuevasClases = [];
    let memoriaActualizada = false;
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
    } catch (err) {
      if (count <= 1 || !esFalloRecuperablePorTamano(err)) throw err;
      console.warn(`[FaseA] ${contextoLog}: lote truncado; reintentando clase por clase.`);
      for (let dia = startDia; dia <= endDia; dia++) {
        onProgress?.(dia, dia);
        const singleData = await generateWeekBatch(
          spec, semanaNum, dia, 1, durMin, numSemanas, memoriaAcumulada, `S${semanaNum}/C${dia}`,
        );
        const clase = singleData.clases?.[0];
        nuevasClases.push({ ...clase, dia });
        agregarClasesAMemoria([{ ...clase, dia }], semanaNum, memoriaAcumulada);
        if (!adaptacionesSemana && singleData.adaptacionesSemana) {
          adaptacionesSemana = singleData.adaptacionesSemana;
          observacionesSemana = String(singleData.observacionesSemana || '').trim();
        }
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
  validateWeekPlan(combined, durMin, numClases);
  return combined;
};

// ─── buildEspecificacionCurricular — exportada para uso externo ───────────────

export const buildEspecificacionCurricular = ({
  mallaPayload, titulo, allInds, allComps, mallaContenidos, area, grado,
  producto = '', contextoComunitario = '',
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
