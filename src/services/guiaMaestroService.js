/**
 * guiaMaestroService.js — Generador de la Guía del Maestro
 *
 * QUÉ ES: la Guía del Maestro DESARROLLA la planificación aprobada en un guion
 * de aula paso por paso. La planificación dice QUÉ se trabaja; la guía dice CÓMO
 * enseñarlo y entrega los RECURSOS para hacerlo (lecturas, guiones de escucha,
 * ejercicios con respuestas, tarjetas, fichas, apoyos, instrumentos).
 *
 * CÓMO: por cada clase de la unidad genera una FICHA de aula con IA, en LOTES de
 * una semana (una llamada por semana — evita truncado en unidades largas y da
 * progreso). Reusa el gateway de proveedores de phaseAService (generarGuiaSemanaRaw):
 * misma auth, misma config de admin, mismo timeout y streaming.
 *
 * FIDELIDAD: conserva competencias, funciones, contenidos, fases, nº de clases,
 * evidencias y producto de la planificación. Desarrolla sus actividades sin
 * cambiar la secuencia. No inventa audios grabados: entrega el GUION para leer
 * en voz alta.
 *
 * NO sustituye la planificación ni su distribución de clases. El ejemplo del
 * libro/prompt es referencia de NIVEL de desarrollo, no contenido a copiar.
 */

import { generarGuiaSemanaRaw, extraerJSON } from './phaseAService.js';
import { construirHuellaDesde, servirFichaPorHuella } from './bancoGuiasService.js';

const _texto = (v) => String(v ?? '').trim();
const _arr = (v) => (Array.isArray(v) ? v : []);
const ES_IDIOMA = (area) => /lenguas extranjeras|ingles|frances|ingl[eé]s|franc[eé]s/i.test(String(area || ''));
const NOMBRE_IDIOMA = (area) => (/franc/i.test(String(area || '')) ? 'francés' : 'inglés');

// Reparto canónico de los 45 min por momento (contrato de la planificación).
export const MOMENTOS_MINUTOS = { Inicio: 10, Desarrollo: 25, Cierre: 10 };
const TOTAL_MINUTOS = 45;

// ─── System prompt ────────────────────────────────────────────────────────────

export const buildSystemPromptGuia = (area = '', nivel = '') => {
  const idioma = ES_IDIOMA(area);
  const lang = NOMBRE_IDIOMA(area);
  return [
    'Eres un formador de docentes del MINERD (República Dominicana). Escribes GUÍAS DE AULA',
    'que un docente —incluso con poca experiencia— puede abrir y dar clase paso a paso SIN',
    'tener que inventar lecturas, diálogos, ejercicios, tarjetas, instrucciones ni respuestas.',
    '',
    'La planificación ya existe y dice QUÉ trabajar. Tu trabajo es desarrollar CÓMO enseñarlo',
    'y ENTREGAR los recursos. Reglas innegociables:',
    '- Desarrollo paso por paso REAL: en cada paso di qué hace el docente, qué DICE (instrucción',
    `  concreta${idioma ? ` en ${lang}` : ''}${idioma ? ', con aclaración en español cuando haga falta' : ''}),`,
    '  qué muestra/modela, qué hacen los estudiantes, cómo se organizan, qué resultado se espera',
    '  y cómo se revisa. Prohibido lo vago ("analizan ejemplos", "practican el vocabulario").',
    idioma
      ? `- IDIOMA: todo texto que TRABAJA el estudiante (guiones, diálogos, lecturas, tarjetas, fichas, ejemplos, fichas de respuesta) va EN ${lang.toUpperCase()}. Las orientaciones para el docente pueden ir en español. Jamás pongas en español un texto que el estudiante debe leer, escuchar o completar en ${lang}.`
      : '',
    idioma
      ? `- READING (lectura real): NO es lo mismo que un listening leído en voz alta. Una actividad de reading incluye SIEMPRE: (a) texto completo en ${lang} adecuado al nivel, (b) tarea ANTES de leer, (c) tarea de comprensión GLOBAL, (d) preguntas de información ESPECÍFICA, (e) respuestas esperadas, (f) actividad POSTERIOR que conecte la lectura con la producción del estudiante. Si reutilizas un texto ya usado como listening, cambia las tareas y su propósito. No fuerces las 4 destrezas en cada clase: distribúyelas con finalidad comunicativa a lo largo de la secuencia.`
      : '',
    idioma
      ? `- LISTENING: GUION completo en ${lang} para leer en voz alta (NO afirmes que existe audio grabado ni video; si la planificación menciona un video no verificado, sustitúyelo por un guion incluido aquí y ajusta las instrucciones). Propósito de cada escucha (global → datos → verificación) + ficha + respuestas.`
      : '',
    idioma
      ? `- SPEAKING: diálogo modelo + expresiones de apoyo + roles/info por participante + criterios de observación. WRITING: texto modelo + plantilla + pasos para planificar/escribir/revisar + lista de cotejo + ejemplo de una mejora.`
      : '- Recursos COMPLETOS: textos, ejercicios con respuestas, fichas y materiales reproducibles de esa área, no solo nombrarlos.',
    '- MATERIALES COMPLETOS: si la clase menciona tarjetas, fichas, imágenes, textos, modelos, listas',
    '  de cotejo o rúbricas, INCLUYE su contenido completo y listo para usar (ponlo en "recursos").',
    '  No basta "muestra imágenes"/"entrega tarjetas"/"distribuye la rúbrica": pon las tarjetas',
    '  concretas, la ficha, los criterios y los ejemplos. Si no puedes incluir una imagen, da una',
    '  alternativa que el docente pueda DIBUJAR o representar en la pizarra (descríbela).',
    idioma
      ? `- GRAMÁTICA FUNCIONAL DENTRO DEL PASO A PASO: no la dejes como apartado suelto. En el DESARROLLO, un paso debe (1) mostrar la expresión en el texto/diálogo, (2) ayudar a observar cómo funciona, (3) dar explicación BREVE con ejemplo, (4) comprobar la comprensión, (5) pedir usarla en una tarea comunicativa. Ejemplos de forma→uso: "My name is…" (decir el nombre); "I am… years old" (edad); "I like…" (gustos). Explicaciones precisas y cortas. (El objeto "gramatica" resume esa forma; pero el trabajo real ocurre en los pasos.)`
      : '- Los conceptos se presentan aplicados a una tarea, no como lista de definiciones.',
    '- Tres momentos SIEMPRE: Inicio 10 min, Desarrollo 25 min, Cierre 10 min. Los pasos (incluida la',
    '  explicación gramatical y las transiciones) DEBEN caber en esos tiempos y sumar cada total.',
    '- INSTRUMENTOS DE EVALUACIÓN COMPLETOS (en "recursos", no solo nombrados): lista_cotejo = criterios',
    '  observables + columnas "Sí"/"Todavía no"; rubrica = criterios + niveles de desempeño + descriptores',
    '  concretos; autoevaluacion = afirmaciones comprensibles para el estudiante. Evalúa lo realmente',
    '  practicado (información comunicada, vocabulario, estructuras, comprensión del mensaje).',
    '- EVIDENCIAS VERIFICABLES: nada de "estudiantes motivados" o "observar la atención". Di qué evidencia',
    '  concreta se observa: p. ej. responde "What is your name?" con "My name is…"; identifica nombre y',
    '  edad del personaje; escribe tres frases de presentación con el modelo. Distingue respuesta EXACTA',
    '  de comprensión vs. ejemplo posible de producción personal.',
    '- CLAVES COHERENTES: cada pregunta debe poder responderse con el material dado y la respuesta debe',
    '  coincidir exactamente. Si hay dos personajes, la ficha separa sus datos (o usa uno solo). No pidas',
    '  un dato (p. ej. "Hobby") que el texto no aporta: añade la pregunta/respuesta o elimina el campo.',
    '- Apoyos ESPECÍFICOS por clase (frase incompleta, banco de palabras, repetir el guion, respuesta',
    '  oral, menos ítems, modelo visible) — nunca una frase genérica repetida.',
    '- Errores previsibles de ESA tarea y cómo atenderlos en el acto.',
    '- Alternativa sin luz/internet SOLO cuando la actividad usa un recurso que la necesita.',
    '- CIERRE: incluye una pregunta de METACOGNICIÓN concreta (qué aprendí / qué puedo decir ahora /',
    '  qué me falta), no una fórmula vacía.',
    '- PROGRESIÓN real entre clases: cada clase AVANZA una pieza (comprender → practicar → elaborar →',
    '  ampliar → revisar → compartir). No repitas con cambios de nombre. En la FASE FINAL se INTEGRA lo',
    '  aprendido: NO se introduce contenido nuevo ni se reinicia el producto. Si en una clase ya se',
    '  redactó un borrador, la siguiente lo MEJORA/ensaya — no pide "primer borrador" otra vez.',
    idioma ? `- Los textos creados son materiales didácticos ORIGINALES tuyos; no los atribuyas al MINERD ni a otra fuente.` : '',
    nivel ? `- Nivel del grupo: ${nivel}. Usa instrucciones lingüísticamente accesibles a ese nivel.` : '',
    '- Edición: sin puntos duplicados, inglés correcto en las instrucciones del estudiante.',
    '',
    'Devuelves EXCLUSIVAMENTE JSON válido (sin markdown, sin ```), con el esquema que se te indique.',
  ].filter(Boolean).join('\n');
};

// ─── Contrato JSON de la ficha (el modelo debe devolver esto por clase) ───────

const esquemaFichaTexto = (idioma) => `{
  "numeroClase": <int>,
  "titulo": "<título específico de la clase>",
  "proposito": "<propósito claro y observable>",
  "aporteProducto": "<aporte concreto al producto/aprendizaje>",
  "prepara": ["<material que el docente prepara antes>", "..."],
  "recursos": [
    { "tipo": "ficha|texto|tarjetas|lista_cotejo|rubrica|autoevaluacion|plantilla|tabla",
      "titulo": "<nombre del recurso>",
      "lineas": ["<línea reproducible>", "..."],
      "tabla": [["col A","col B"], ["...","..."]],
      "criterios": ["<criterio observable>", "..."],
      "niveles": ["<nivel 1 + descriptor>", "<nivel 2 + descriptor>", "..."] }
  ],
  "momentos": [
    { "nombre": "Inicio", "minutos": 10, "pasos": [
      { "minutos": <int>, "docenteHace": "<acción>", "docenteDice": "<instrucción textual${idioma ? ' en el idioma' : ''}>",
        "aclaracionEs": "<aclaración en español o ''>", "muestra": "<qué modela o ''>",
        "estudiantesHacen": "<qué hacen>", "organizacion": "individual|parejas|grupos|plenaria",
        "resultadoEsperado": "<qué se espera>", "comoRevisa": "<cómo se revisa/retroalimenta>" } ] },
    { "nombre": "Desarrollo", "minutos": 25, "pasos": [ ... ] },
    { "nombre": "Cierre", "minutos": 10, "pasos": [ ... ] }
  ],
  "destreza": {
    "tipo": "${idioma ? 'reading|listening|speaking|writing|ninguna' : 'ninguna'}",
    "titulo": "<título del recurso de destreza o ''>",
    "guion": ["<texto/diálogo/lectura COMPLETO en el idioma, línea a línea>", "..."],
    "instruccionesDocente": "<cómo leerlo/usarlo>",
    "antesDeLeer": "<tarea previa: reading (obligatorio)>",
    "comprensionGlobal": "<tarea de comprensión global: reading>",
    "propositoEscuchas": ["global","datos","verificacion"],
    "ejercicio": { "enunciado": "<consigna de información específica>", "items": ["<ítem/campo a completar>", "..."] },
    "respuestasEsperadas": ["<respuesta exacta>", "..."],
    "despuesDeLeer": "<actividad posterior que conecta con la PRODUCCIÓN del estudiante: reading (obligatorio)>"
  },
  ${idioma ? `"gramatica": { "forma": "<estructura del día>", "observacion": "<cómo observarla en el modelo>", "explicacionBreve": "<explicación corta>", "practicaAplicada": "<práctica>" },` : '"gramatica": null,'}
  "apoyos": ["<apoyo específico para quien lo necesite>", "..."],
  "errores": [ { "error": "<error previsible>", "correccion": "<cómo atenderlo en el acto>" } ],
  "sinLuz": "<alternativa concreta o null si no aplica>",
  "evaluacion": { "evidencia": "<qué se guarda>", "instrumento": "<instrumento breve>", "comprobacion": "<criterio observable de logro>" }
}`;

// Resume una clase de la planificación para dársela al modelo como fuente fiel.
const resumirClaseParaPrompt = (dia, numeroClase) => {
  const momentos = _arr(dia.momentos).map((m) => ({
    nombre: m.nombre,
    tiempo: m.tiempo,
    actividades: _arr(m.actividades).map((a) => _texto(String(a).replace(/\*\*|__?/g, ''))),
  }));
  const tm = dia.textoModelo;
  return {
    numeroClase,
    titulo: _texto(dia.titulo),
    focoLinguistico: _texto(dia.focoLinguistico),
    intencionPedagogica: _texto(dia.intencionPedagogica),
    aporteProducto: _texto(dia.aporteProducto),
    indicadoresTrabajados: _arr(dia.indicadoresTrabajados).map(_texto),
    criteriosExito: _arr(dia.criteriosExito).map(_texto),
    textoModelo: tm && _arr(tm.lineas).length ? { titulo: _texto(tm.titulo), lineas: _arr(tm.lineas).map(_texto) } : null,
    momentos,
  };
};

// UNA clase por llamada: las fichas de la Guía son muy densas (lectura/guion +
// respuestas + 3 momentos paso a paso); generar varias de golpe desborda el
// timeout del gateway (ABORTO_POR_TIEMPO con JSON incompleto). Una clase por
// llamada es rápida, no aborta, y da progreso granular (clase N/total).
export const buildPromptGuiaClase = ({ unidad, dia, numeroClase }) => {
  const m = unidad.metadatos || {};
  const area = _texto(m.area || m.asignatura);
  const idioma = ES_IDIOMA(area);
  const clase = resumirClaseParaPrompt(dia, numeroClase);

  return [
    `UNIDAD: "${_texto(m.titulo)}" — ${area} — ${_texto(m.grado)} — Producto final: "${_texto(m.productoFinal)}".`,
    m.contextoComunitario ? `Contexto/zona: ${_texto(m.contextoComunitario)}.` : '',
    '',
    'Desarrolla la GUÍA DE AULA de UNA clase de la planificación aprobada. Conserva su',
    'número, título base, foco e intención; NO cambies la secuencia. Entrega una ficha',
    'COMPLETA con sus recursos (el docente no debe inventar nada).',
    idioma ? 'El texto modelo dado es el punto de partida; desarróllalo y añade lo que falte (actividad previa, preguntas, respuestas).' : '',
    '',
    'CLASE (fuente fiel, en JSON):',
    JSON.stringify(clase),
    '',
    `Devuelve un JSON: {"clases":[ ${esquemaFichaTexto(idioma)} ]} con EXACTAMENTE una ficha (esta clase).`,
    'La ficha: Inicio 10 + Desarrollo 25 + Cierre 10, con pasos cuyos minutos sumen cada total.',
    '"momentos" DEBE ser un ARRAY de 3 objetos, cada uno con "nombre" ("Inicio"/"Desarrollo"/"Cierre") y "pasos" (array). No uses un objeto con claves inicio/desarrollo/cierre.',
    'Prohibido devolver pasos vagos o recursos solo nombrados. JSON puro, sin markdown.',
  ].filter(Boolean).join('\n');
};

// ─── Normalización de la ficha de la IA ───────────────────────────────────────
// El modelo no siempre respeta las claves exactas. Antes de validar, se toleran
// variantes razonables y se mapean al esquema canónico: momentos puede venir como
// objeto {inicio,desarrollo,cierre} o como array; el nombre bajo nombre/momento/
// fase/etapa; los pasos bajo pasos/actividades/steps; minutos bajo minutos/tiempo/min.

const _num = (v) => {
  const n = Number.parseInt(String(v ?? '').replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
};

const CANON_MOMENTO = (raw = '') => {
  const t = String(raw).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (t.includes('inicio') || t.includes('apertura') || t.includes('start')) return 'Inicio';
  if (t.includes('desarrollo') || t.includes('development') || t.includes('centro')) return 'Desarrollo';
  if (t.includes('cierre') || t.includes('closing') || t.includes('final')) return 'Cierre';
  return raw ? String(raw) : '';
};

const normalizarPaso = (p = {}) => {
  if (typeof p === 'string') return { minutos: 0, docenteHace: p };
  return {
    minutos: _num(p.minutos ?? p.tiempo ?? p.min ?? p.duracion),
    docenteHace: _texto(p.docenteHace ?? p.accion ?? p.hace ?? p.docente ?? ''),
    docenteDice: _texto(p.docenteDice ?? p.dice ?? p.instruccion ?? p.frase ?? ''),
    aclaracionEs: _texto(p.aclaracionEs ?? p.aclaracion ?? ''),
    muestra: _texto(p.muestra ?? p.modela ?? ''),
    estudiantesHacen: _texto(p.estudiantesHacen ?? p.estudiantes ?? p.alumnos ?? ''),
    organizacion: _texto(p.organizacion ?? p.agrupamiento ?? ''),
    resultadoEsperado: _texto(p.resultadoEsperado ?? p.resultado ?? p.esperado ?? ''),
    comoRevisa: _texto(p.comoRevisa ?? p.revisa ?? p.retroalimentacion ?? ''),
  };
};

const normalizarMomento = (mom = {}, nombreSugerido = '') => {
  const nombre = CANON_MOMENTO(mom.nombre ?? mom.momento ?? mom.fase ?? mom.etapa ?? nombreSugerido);
  const pasosRaw = _arr(mom.pasos ?? mom.actividades ?? mom.steps ?? mom.acciones);
  return { nombre, minutos: _num(mom.minutos ?? mom.tiempo ?? MOMENTOS_MINUTOS[nombre]), pasos: pasosRaw.map(normalizarPaso) };
};

export const normalizarFichaGuia = (bruta = {}, numeroClase) => {
  if (!bruta || typeof bruta !== 'object') return bruta;
  // momentos: objeto {inicio,desarrollo,cierre} → array; array → se respeta.
  let momentos = bruta.momentos ?? bruta.secuencia ?? bruta.desarrollo;
  if (momentos && !Array.isArray(momentos) && typeof momentos === 'object') {
    const orden = ['inicio', 'desarrollo', 'cierre'];
    momentos = orden
      .filter((k) => momentos[k])
      .map((k) => normalizarMomento(momentos[k], k));
  } else {
    momentos = _arr(momentos).map((m) => normalizarMomento(m));
  }
  return {
    ...bruta,
    numeroClase: numeroClase ?? bruta.numeroClase,
    titulo: _texto(bruta.titulo ?? bruta.title ?? bruta.nombre),
    proposito: _texto(bruta.proposito ?? bruta.objetivo ?? bruta.proposit ?? bruta.purpose),
    momentos,
  };
};

// ─── Validación de una ficha (propiedades fuertes) ────────────────────────────

export const validarFichaGuia = (ficha, { idioma = false } = {}) => {
  const motivos = [];
  if (!ficha || typeof ficha !== 'object') return { ok: false, motivos: ['ficha no es objeto'] };
  if (!_texto(ficha.titulo)) motivos.push('sin título');
  if (!_texto(ficha.proposito)) motivos.push('sin propósito');

  const momentos = _arr(ficha.momentos);
  const nombres = momentos.map((x) => x.nombre);
  for (const req of ['Inicio', 'Desarrollo', 'Cierre']) {
    if (!nombres.includes(req)) motivos.push(`falta el momento ${req}`);
  }
  let sumaTotal = 0;
  for (const mom of momentos) {
    const etiqueta = _texto(mom.nombre) || 'momento sin nombre';
    const pasos = _arr(mom.pasos);
    if (!pasos.length) { motivos.push(`${etiqueta}: sin pasos`); continue; }
    const esperado = MOMENTOS_MINUTOS[mom.nombre] || 0;
    const suma = pasos.reduce((acc, p) => acc + (Number.parseInt(p.minutos, 10) || 0), 0);
    sumaTotal += suma;
    // Tolerancia ±1 por redondeos de reparto.
    if (esperado && Math.abs(suma - esperado) > 1) {
      motivos.push(`${etiqueta}: los pasos suman ${suma}′ (debía ser ${esperado}′)`);
    }
    for (const p of pasos) {
      if (!_texto(p.docenteHace) && !_texto(p.docenteDice)) {
        motivos.push(`${etiqueta}: un paso sin acción ni instrucción (vago)`);
        break;
      }
    }
  }
  if (sumaTotal && Math.abs(sumaTotal - TOTAL_MINUTOS) > 2) {
    motivos.push(`la clase suma ${sumaTotal}′ (debía ser ${TOTAL_MINUTOS}′)`);
  }

  // Recursos completos según el tipo de destreza (solo idiomas).
  const d = ficha.destreza || {};
  const tipo = _texto(d.tipo);
  if (idioma && (tipo === 'reading' || tipo === 'listening')) {
    if (!_arr(d.guion).length) motivos.push(`destreza ${tipo} sin guion/texto completo`);
    const items = _arr(d.ejercicio?.items);
    const resp = _arr(d.respuestasEsperadas);
    if (items.length && !resp.length) motivos.push(`destreza ${tipo}: ejercicio sin respuestas esperadas`);
    // Clave coherente: no puede haber MÁS respuestas que ítems (desajuste clave/ficha).
    if (items.length && resp.length && resp.length > items.length) {
      motivos.push(`destreza ${tipo}: ${resp.length} respuestas para ${items.length} ítems (clave no cuadra)`);
    }
  }
  // Reading REAL: exige sus partes propias (lo que lo distingue de un listening).
  if (idioma && tipo === 'reading') {
    if (!_texto(d.antesDeLeer)) motivos.push('reading sin tarea ANTES de leer');
    if (!_texto(d.comprensionGlobal)) motivos.push('reading sin tarea de comprensión global');
    if (!_texto(d.despuesDeLeer)) motivos.push('reading sin actividad posterior hacia la producción');
  }
  if (idioma && tipo === 'speaking' && !_arr(d.guion).length) {
    motivos.push('destreza speaking sin diálogo modelo');
  }

  // Instrumentos de evaluación: si se incluye uno, debe traer contenido real
  // (no solo el nombre). Lista de cotejo/rúbrica = criterios; rúbrica además = niveles.
  for (const r of _arr(ficha.recursos)) {
    const t = _texto(r.tipo);
    const tieneCriterios = _arr(r.criterios).length || _arr(r.lineas).length || _arr(r.tabla).length;
    if ((t === 'lista_cotejo' || t === 'rubrica') && !tieneCriterios) {
      motivos.push(`el recurso "${_texto(r.titulo) || t}" no trae criterios (instrumento vacío)`);
    }
    if (t === 'rubrica' && !_arr(r.niveles).length && !_arr(r.tabla).length) {
      motivos.push(`la rúbrica "${_texto(r.titulo) || ''}" no trae niveles de desempeño`);
    }
    if (t === 'autoevaluacion' && !tieneCriterios) {
      motivos.push('la autoevaluación no trae afirmaciones/preguntas');
    }
  }

  // Evaluación observable y NO vaga.
  const comprobacion = _texto(ficha.evaluacion?.comprobacion);
  if (!ficha.evaluacion || !comprobacion) {
    motivos.push('sin criterio de comprobación en la evaluación');
  } else if (/motivad|atenci[oó]n|participaci[oó]n activa|inter[eé]s|entusiasm/i.test(comprobacion)) {
    motivos.push('la comprobación es vaga (mide actitud, no aprendizaje observable)');
  }

  return { ok: motivos.length === 0, motivos };
};

// Intenta servir UNA clase desde el Banco de Guías (verbatim, por huella exacta).
// Gate apagado por defecto → null sin tocar red. Fail-closed: cualquier error =
// "no servible" y la clase la genera la IA.
const servirClaseDelBanco = async ({ dia, numeroClase, area, grado, tema }) => {
  try {
    const huella = construirHuellaDesde({
      area, grado, tema, numeroClase, focoLinguistico: _texto(dia.focoLinguistico),
    });
    const ficha = await servirFichaPorHuella(huella.clave);
    return ficha ? { ...ficha, numeroClase, _origen: 'banco' } : null;
  } catch {
    return null;
  }
};

// ─── Generación de UNA clase (banco → IA, con 1 reintento) ────────────────────
// Una clase por llamada: evita el ABORTO_POR_TIEMPO que provocaba generar la
// semana entera (fichas demasiado densas para una sola llamada de 90s).

const generarClase = async ({ unidad, dia, numeroClase, area, nivel, grado, tema }) => {
  const idioma = ES_IDIOMA(area);

  // 1) Banco de Guías: si la ficha está servible, verbatim (0 IA).
  const delBanco = await servirClaseDelBanco({ dia, numeroClase, area, grado, tema });
  if (delBanco) return { ok: true, ficha: delBanco, origen: 'banco' };

  // 2) IA: genera solo esta clase.
  const system = buildSystemPromptGuia(area, nivel);
  const prompt = buildPromptGuiaClase({ unidad, dia, numeroClase });

  let ultimoMotivo = '';
  for (let intento = 0; intento < 2; intento += 1) {
    const { text, stopReason } = await generarGuiaSemanaRaw(prompt, system);
    const parsed = extraerJSON(text, stopReason);
    if (!parsed.ok) { ultimoMotivo = parsed.motivo || 'JSON inválido'; continue; }
    // Acepta {clases:[ficha]}, {ficha:{...}} o la ficha suelta, por robustez.
    const clases = _arr(parsed.data?.clases);
    const bruta = clases.length ? clases[0] : (parsed.data?.ficha || parsed.data);
    // Normaliza variantes de formato de la IA antes de validar (momentos como
    // objeto, claves alternativas, pasos bajo "actividades", etc.).
    const ficha = normalizarFichaGuia(bruta, numeroClase);
    const v = validarFichaGuia(ficha, { idioma });
    if (v.ok) return { ok: true, ficha, origen: 'ia' };
    ultimoMotivo = v.motivos.join('; ');
  }
  return { ok: false, motivo: ultimoMotivo };
};

// ─── API pública: generar la Guía completa clase por clase, con progreso ──────
// onProgreso?: ({ clasesListas, totalClases, numeroClase }) => void

export const generarGuiaMaestro = async (unidad, { onProgreso } = {}) => {
  if (!unidad) throw new Error('Sin unidad para generar la guía.');
  const m = unidad.metadatos || {};
  const area = _texto(m.area || m.asignatura);
  const nivel = _texto(m.nivel);
  const grado = _texto(m.grado);
  const tema = _texto(m.titulo);
  const fases = _arr(unidad.fasesSemanales);
  if (!fases.length) throw new Error('La unidad no tiene fases con clases.');

  // Aplana todas las clases en orden, numerándolas 1..N (como el render/huella).
  const clasesPlan = [];
  for (const fase of fases) {
    for (const dia of _arr(fase.dias)) clasesPlan.push(dia);
  }
  const totalClases = clasesPlan.length;
  if (!totalClases) throw new Error('La unidad no tiene clases.');

  const fichas = [];
  for (let i = 0; i < clasesPlan.length; i += 1) {
    const numeroClase = i + 1;
    onProgreso?.({ clasesListas: i, totalClases, numeroClase });
    const res = await generarClase({ unidad, dia: clasesPlan[i], numeroClase, area, nivel, grado, tema });
    if (!res.ok) {
      throw new Error(`No se pudo generar la guía de la clase ${numeroClase}: ${res.motivo}`);
    }
    fichas.push(res.ficha);
  }
  onProgreso?.({ clasesListas: totalClases, totalClases, numeroClase: totalClases });

  return {
    schemaVersion: '1.0',
    generadaEn: new Date().toISOString(),
    metadatos: {
      titulo: tema, area, grado, seccion: _texto(m.seccion),
      productoFinal: _texto(m.productoFinal), nivel,
    },
    fichas: fichas.sort((a, b) => a.numeroClase - b.numeroClase),
  };
};
