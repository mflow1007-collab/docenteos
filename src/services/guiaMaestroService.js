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
      ? `- Recursos COMPLETOS según la actividad: si hay Reading, el texto completo + actividad previa + consigna + preguntas CON respuestas esperadas. Si hay Listening, el GUION completo para leer en voz alta (NO afirmes que existe un audio grabado) + propósito de cada escucha + ficha + respuestas. Si hay Speaking, diálogo modelo + expresiones de apoyo + roles/info por participante + criterios de observación. Si hay Writing, texto modelo + plantilla + pasos para planificar/escribir/revisar + lista de cotejo + ejemplo de una mejora. Tarjetas/fichas/juegos: incluye su contenido y reglas, no solo el nombre.`
      : '- Recursos COMPLETOS: textos, ejercicios con respuestas, fichas y materiales reproducibles de esa área, no solo nombrarlos.',
    idioma
      ? `- Gramática FUNCIONAL: preséntala dentro de un texto/diálogo/situación, orienta a observar su uso, da una explicación BREVE y sigue con práctica aplicada. No la omitas por "implícita" ni la conviertas en exposición extensa de reglas.`
      : '- Los conceptos se presentan aplicados a una tarea, no como lista de definiciones.',
    '- Tres momentos SIEMPRE: Inicio 10 min, Desarrollo 25 min, Cierre 10 min. Dentro de cada',
    '  uno, pasos numerados con minutos que SUMEN su total.',
    '- Apoyos ESPECÍFICOS por clase (banco de palabras, opciones para marcar, modelo visible,',
    '  menos ítems, lectura acompañada) — nunca una frase genérica repetida.',
    '- Errores previsibles de ESA tarea y cómo atenderlos en el acto.',
    '- Alternativa sin luz/internet SOLO cuando la actividad usa un recurso que la necesita.',
    '- Evaluación observable: evidencia + instrumento breve + criterio de comprobación. Con',
    '  respuestas cuando la tarea tenga solución cerrada.',
    '- Progresión real entre clases: cada clase AVANZA una pieza (comprender → practicar →',
    '  elaborar → ampliar → revisar → compartir). No repitas con cambios de nombre.',
    idioma ? `- Los textos creados son materiales didácticos ORIGINALES tuyos; no los atribuyas al MINERD ni a otra fuente.` : '',
    nivel ? `- Nivel del grupo: ${nivel}. Usa instrucciones lingüísticamente accesibles a ese nivel.` : '',
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
    { "tipo": "ficha|texto|tarjetas|lista_cotejo|plantilla|tabla",
      "titulo": "<nombre del recurso>",
      "lineas": ["<línea reproducible>", "..."],
      "tabla": [["col A","col B"], ["...","..."]] }
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
    "guion": ["<texto/diálogo COMPLETO, línea a línea>", "..."],
    "instruccionesDocente": "<cómo leerlo/usarlo>",
    "propositoEscuchas": ["global","datos","verificacion"],
    "ejercicio": { "enunciado": "<consigna>", "items": ["<ítem/campo a completar>", "..."] },
    "respuestasEsperadas": ["<respuesta>", "..."]
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
  }
  if (idioma && tipo === 'speaking' && !_arr(d.guion).length) {
    motivos.push('destreza speaking sin diálogo modelo');
  }

  if (!ficha.evaluacion || !_texto(ficha.evaluacion.comprobacion)) {
    motivos.push('sin criterio de comprobación en la evaluación');
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
