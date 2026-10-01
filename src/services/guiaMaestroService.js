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

export const buildPromptGuiaSemana = ({ unidad, fase, numeroPrimeraClase }) => {
  const m = unidad.metadatos || {};
  const area = _texto(m.area || m.asignatura);
  const idioma = ES_IDIOMA(area);
  const dias = _arr(fase.dias);
  const clases = dias.map((dia, i) => resumirClaseParaPrompt(dia, numeroPrimeraClase + i));

  return [
    `UNIDAD: "${_texto(m.titulo)}" — ${area} — ${_texto(m.grado)} — Producto final: "${_texto(m.productoFinal)}".`,
    m.contextoComunitario ? `Contexto/zona: ${_texto(m.contextoComunitario)}.` : '',
    '',
    'Desarrolla la GUÍA DE AULA de estas clases de la planificación aprobada. Conserva su',
    'número, título base, foco e intención; NO cambies la secuencia. Para cada clase entrega',
    'una ficha COMPLETA con sus recursos (el docente no debe inventar nada).',
    idioma ? 'Los textos modelo dados son el punto de partida; desarróllalos y añade lo que falte (actividad previa, preguntas, respuestas).' : '',
    '',
    'CLASES DE ESTA SEMANA (fuente fiel, en JSON):',
    JSON.stringify(clases),
    '',
    `Devuelve un JSON: {"clases":[ ${esquemaFichaTexto(idioma)} ]} con una ficha por clase, en orden.`,
    'Cada ficha: Inicio 10 + Desarrollo 25 + Cierre 10, con pasos cuyos minutos sumen cada total.',
    'Prohibido devolver pasos vagos o recursos solo nombrados. JSON puro, sin markdown.',
  ].filter(Boolean).join('\n');
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
    const pasos = _arr(mom.pasos);
    if (!pasos.length) { motivos.push(`${mom.nombre}: sin pasos`); continue; }
    const esperado = MOMENTOS_MINUTOS[mom.nombre] || 0;
    const suma = pasos.reduce((acc, p) => acc + (Number.parseInt(p.minutos, 10) || 0), 0);
    sumaTotal += suma;
    // Tolerancia ±1 por redondeos de reparto.
    if (esperado && Math.abs(suma - esperado) > 1) {
      motivos.push(`${mom.nombre}: los pasos suman ${suma}′ (debía ser ${esperado}′)`);
    }
    for (const p of pasos) {
      if (!_texto(p.docenteHace) && !_texto(p.docenteDice)) {
        motivos.push(`${mom.nombre}: un paso sin acción ni instrucción (vago)`);
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

// Intenta servir TODAS las clases de la semana desde el Banco de Guías (verbatim,
// por huella exacta). Solo cuenta si están TODAS: así el batching por semana se
// mantiene (o toda la semana del banco, o toda la semana por IA). El gate del
// banco está apagado por defecto → devuelve null sin tocar red, y el generador
// sigue con IA. Fail-closed: cualquier error se trata como "no servible".
const servirSemanaDelBanco = async ({ unidad, fase, numeroPrimeraClase, area }) => {
  const m = unidad.metadatos || {};
  const dias = _arr(fase.dias);
  const tema = _texto(m.titulo);
  const grado = _texto(m.grado);
  try {
    const fichas = [];
    for (let i = 0; i < dias.length; i += 1) {
      const numeroClase = numeroPrimeraClase + i;
      const huella = construirHuellaDesde({
        area, grado, tema, numeroClase, focoLinguistico: _texto(dias[i].focoLinguistico),
      });
      const ficha = await servirFichaPorHuella(huella.clave);
      if (!ficha) return null; // falta al menos una → la semana la hace la IA
      fichas.push({ ...ficha, numeroClase, _origen: 'banco' });
    }
    return fichas.length === dias.length ? fichas : null;
  } catch {
    return null;
  }
};

// ─── Generación de una semana (banco → IA, con 1 reintento) ───────────────────

const generarSemana = async ({ unidad, fase, numeroPrimeraClase, area, nivel }) => {
  const idioma = ES_IDIOMA(area);

  // 1) Banco de Guías: si cubre la semana completa, se sirve verbatim (0 IA).
  const delBanco = await servirSemanaDelBanco({ unidad, fase, numeroPrimeraClase, area });
  if (delBanco) return { ok: true, fichas: delBanco, origen: 'banco' };

  // 2) IA: genera la semana completa.
  const system = buildSystemPromptGuia(area, nivel);
  const prompt = buildPromptGuiaSemana({ unidad, fase, numeroPrimeraClase });
  const esperadas = _arr(fase.dias).length;

  let ultimoMotivo = '';
  for (let intento = 0; intento < 2; intento += 1) {
    const { text, stopReason } = await generarGuiaSemanaRaw(prompt, system);
    const parsed = extraerJSON(text, stopReason);
    if (!parsed.ok) { ultimoMotivo = parsed.motivo || 'JSON inválido'; continue; }
    const clases = _arr(parsed.data?.clases);
    if (clases.length !== esperadas) {
      ultimoMotivo = `la IA devolvió ${clases.length} fichas; se esperaban ${esperadas}`;
      continue;
    }
    const fichas = [];
    let hayFallo = false;
    for (let i = 0; i < clases.length; i += 1) {
      const ficha = { ...clases[i], numeroClase: numeroPrimeraClase + i };
      const v = validarFichaGuia(ficha, { idioma });
      if (!v.ok) { hayFallo = true; ultimoMotivo = `clase ${ficha.numeroClase}: ${v.motivos.join('; ')}`; break; }
      fichas.push(ficha);
    }
    if (!hayFallo) return { ok: true, fichas };
  }
  return { ok: false, motivo: ultimoMotivo };
};

// ─── API pública: generar la Guía completa por lotes, con progreso ────────────
// onProgreso?: ({ fase, totalFases, clasesListas, totalClases }) => void

export const generarGuiaMaestro = async (unidad, { onProgreso } = {}) => {
  if (!unidad) throw new Error('Sin unidad para generar la guía.');
  const m = unidad.metadatos || {};
  const area = _texto(m.area || m.asignatura);
  const nivel = _texto(m.nivel);
  const fases = _arr(unidad.fasesSemanales);
  if (!fases.length) throw new Error('La unidad no tiene fases con clases.');

  const totalClases = fases.reduce((acc, f) => acc + _arr(f.dias).length, 0);
  const fichasPorClase = new Map();
  let numero = 1;
  let clasesListas = 0;

  for (let fi = 0; fi < fases.length; fi += 1) {
    const fase = fases[fi];
    const nDias = _arr(fase.dias).length;
    if (!nDias) continue;
    onProgreso?.({ fase: fi + 1, totalFases: fases.length, clasesListas, totalClases });
    const res = await generarSemana({ unidad, fase, numeroPrimeraClase: numero, area, nivel });
    if (!res.ok) {
      throw new Error(`No se pudo generar la guía de la semana ${fi + 1}: ${res.motivo}`);
    }
    res.fichas.forEach((ficha) => fichasPorClase.set(ficha.numeroClase, ficha));
    numero += nDias;
    clasesListas += nDias;
    onProgreso?.({ fase: fi + 1, totalFases: fases.length, clasesListas, totalClases });
  }

  return {
    schemaVersion: '1.0',
    generadaEn: new Date().toISOString(),
    metadatos: {
      titulo: _texto(m.titulo), area, grado: _texto(m.grado), seccion: _texto(m.seccion),
      productoFinal: _texto(m.productoFinal), nivel,
    },
    // Fichas ordenadas por número de clase.
    fichas: [...fichasPorClase.values()].sort((a, b) => a.numeroClase - b.numeroClase),
  };
};
