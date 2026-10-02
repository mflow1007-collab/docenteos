/**
 * test-guia-maestro.mjs — verifica el generador y el render de la Guía del Maestro
 * sin navegador ni IA: prueba la lógica pura (validarFichaGuia, buildPromptGuiaClase,
 * formatearGuiaMaestroHTML) contra fichas de ejemplo.
 */
import { validarFichaGuia, normalizarFichaGuia, buildPromptGuiaClase, buildSystemPromptGuia, MOMENTOS_MINUTOS } from '../src/services/guiaMaestroService.js';
import { formatearGuiaMaestroHTML } from '../src/services/unidadAprendizajeService.js';

let pasos = 0, fallos = 0;
const check = (nombre, fn) => {
  try { fn(); pasos += 1; console.log(`  ✓ ${nombre}`); }
  catch (e) { fallos += 1; console.log(`  ✗ ${nombre}: ${e.message}`); }
};
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

// Ficha válida de referencia (listening, 10+25+10 = 45').
const fichaOK = () => ({
  numeroClase: 2,
  titulo: 'Comprender una presentación sencilla',
  proposito: 'Identificar nombre, edad y comunidad al escuchar.',
  aporteProducto: 'Dos oraciones del perfil',
  prepara: ['pizarra', 'ficha'],
  recursos: [{ tipo: 'ficha', titulo: 'LISTEN', lineas: ['Name: ___', 'Age: ___'] }],
  momentos: [
    { nombre: 'Inicio', minutos: 10, pasos: [
      { minutos: 4, docenteHace: 'Saluda', docenteDice: 'Good morning!', organizacion: 'plenaria' },
      { minutos: 6, docenteHace: 'Señala la ficha', docenteDice: 'What do we listen for?', organizacion: 'plenaria' },
    ] },
    { nombre: 'Desarrollo', minutos: 25, pasos: [
      { minutos: 10, docenteHace: 'Lee el guion', docenteDice: 'Listen.', organizacion: 'individual' },
      { minutos: 15, docenteHace: 'Completan', docenteDice: 'Complete.', organizacion: 'parejas' },
    ] },
    { nombre: 'Cierre', minutos: 10, pasos: [
      { minutos: 10, docenteHace: 'Comparten', docenteDice: 'Read.', organizacion: 'plenaria' },
    ] },
  ],
  destreza: {
    tipo: 'listening', titulo: 'Meet Luis',
    guion: ['Hello! My name is Luis.', 'I am twelve years old.'],
    ejercicio: { enunciado: 'Completa', items: ['Name: ___', 'Age: ___'] },
    respuestasEsperadas: ['Luis', '12'],
  },
  gramatica: { forma: 'I am … years old', explicacionBreve: 'edad = I am + número + years old' },
  apoyos: ['opciones para marcar'],
  errores: [{ error: 'I have twelve years', correccion: 'I am twelve years old' }],
  sinLuz: null,
  evaluacion: { evidencia: 'dos oraciones', instrumento: 'comprobación', comprobacion: 'escribe la edad al oír el modelo' },
});

console.log('Validación de fichas:');
check('una ficha completa (10+25+10) pasa la validación', () => {
  const v = validarFichaGuia(fichaOK(), { idioma: true });
  assert(v.ok, v.motivos.join('; '));
});
check('los minutos canónicos son Inicio 10 / Desarrollo 25 / Cierre 10', () => {
  assert(MOMENTOS_MINUTOS.Inicio === 10 && MOMENTOS_MINUTOS.Desarrollo === 25 && MOMENTOS_MINUTOS.Cierre === 10, 'reparto incorrecto');
});
check('un momento cuyos pasos NO suman su total → falla', () => {
  const f = fichaOK();
  f.momentos[1].pasos = [{ minutos: 5, docenteHace: 'x', docenteDice: 'y' }]; // Desarrollo = 5, no 25
  const v = validarFichaGuia(f, { idioma: true });
  assert(!v.ok && v.motivos.some((m) => /Desarrollo/.test(m)), 'no detectó la suma incorrecta');
});
check('falta un momento (Cierre) → falla', () => {
  const f = fichaOK();
  f.momentos = f.momentos.slice(0, 2);
  const v = validarFichaGuia(f, { idioma: true });
  assert(!v.ok && v.motivos.some((m) => /Cierre/.test(m)), 'no detectó el momento faltante');
});
check('paso vago (sin acción ni instrucción) → falla', () => {
  const f = fichaOK();
  f.momentos[0].pasos.push({ minutos: 0, organizacion: 'plenaria' });
  // Reajusta para que la suma no enmascare el fallo del paso vago.
  const v = validarFichaGuia(f, { idioma: true });
  assert(!v.ok && v.motivos.some((m) => /vago/.test(m)), 'no detectó el paso vago');
});
check('reading/listening con ejercicio pero SIN respuestas → falla', () => {
  const f = fichaOK();
  f.destreza.respuestasEsperadas = [];
  const v = validarFichaGuia(f, { idioma: true });
  assert(!v.ok && v.motivos.some((m) => /respuestas/.test(m)), 'no exigió respuestas esperadas');
});
check('listening SIN guion completo → falla', () => {
  const f = fichaOK();
  f.destreza.guion = [];
  const v = validarFichaGuia(f, { idioma: true });
  assert(!v.ok && v.motivos.some((m) => /guion|texto/.test(m)), 'no exigió el guion');
});
check('sin criterio de comprobación → falla', () => {
  const f = fichaOK();
  f.evaluacion.comprobacion = '';
  const v = validarFichaGuia(f, { idioma: true });
  assert(!v.ok && v.motivos.some((m) => /comprobaci/.test(m)), 'no exigió el criterio de comprobación');
});

console.log('Normalización de variantes de la IA (regresión del error real):');
check('momentos como OBJETO {inicio,desarrollo,cierre} → array canónico que valida', () => {
  const bruta = {
    titulo: 'Clase', proposito: 'p',
    momentos: {
      inicio: { pasos: [{ minutos: 10, docenteHace: 'a', docenteDice: 'b' }] },
      desarrollo: { pasos: [{ minutos: 25, docenteHace: 'c', docenteDice: 'd' }] },
      cierre: { pasos: [{ minutos: 10, docenteHace: 'e', docenteDice: 'f' }] },
    },
    destreza: { tipo: 'ninguna' }, evaluacion: { comprobacion: 'ok' },
  };
  const f = normalizarFichaGuia(bruta, 2);
  assert(Array.isArray(f.momentos) && f.momentos.length === 3, 'no convirtió el objeto en array');
  assert(f.momentos.map((m) => m.nombre).join(',') === 'Inicio,Desarrollo,Cierre', 'nombres canónicos mal: ' + f.momentos.map((m) => m.nombre));
  const v = validarFichaGuia(f, { idioma: false });
  assert(v.ok, 'no valida tras normalizar: ' + v.motivos.join('; '));
});
check('claves alternativas (momento/tiempo/actividades) → normaliza y valida', () => {
  const bruta = {
    titulo: 'Clase', proposito: 'p',
    momentos: [
      { momento: 'Inicio', tiempo: '10 min', actividades: [{ min: 10, accion: 'a', instruccion: 'b' }] },
      { momento: 'Desarrollo', actividades: [{ min: 25, accion: 'c' }] },
      { momento: 'Cierre', actividades: [{ min: 10, accion: 'e' }] },
    ],
    destreza: { tipo: 'ninguna' }, evaluacion: { comprobacion: 'ok' },
  };
  const f = normalizarFichaGuia(bruta, 3);
  const v = validarFichaGuia(f, { idioma: false });
  assert(v.ok, 'no valida tras normalizar claves alternativas: ' + v.motivos.join('; '));
});
check('un momento sin nombre reconocible NO reporta "undefined"', () => {
  const f = { titulo: 'x', proposito: 'p', momentos: [{ pasos: [] }], evaluacion: { comprobacion: 'ok' } };
  const v = validarFichaGuia(f, { idioma: false });
  assert(!v.motivos.some((m) => /undefined/.test(m)), 'aún dice undefined: ' + v.motivos.join('; '));
});

console.log('Prompt por clase:');
check('el prompt de una clase incluye la fuente fiel y pide UNA ficha', () => {
  const unidad = {
    metadatos: { titulo: 'People Around Me', area: 'Inglés', grado: '1ro Secundaria', productoFinal: 'Perfil personal', nivel: 'A1' },
    fasesSemanales: [{ dias: [{ titulo: 'Clase A', focoLinguistico: 'presentarse', intencionPedagogica: 'avanza', momentos: [] }] }],
  };
  const p = buildPromptGuiaClase({ unidad, dia: unidad.fasesSemanales[0].dias[0], numeroClase: 1 });
  assert(/People Around Me/.test(p), 'no incluye el título de la unidad');
  assert(/CLASE \(fuente fiel/.test(p), 'no incluye la fuente fiel de la clase');
  assert(/EXACTAMENTE una ficha/.test(p), 'no pide exactamente una ficha');
  assert(/"clases"/.test(p), 'no pide el JSON con clases');
  const sys = buildSystemPromptGuia('Inglés', 'A1');
  assert(/NO afirmes que existe un audio grabado|GUION/.test(sys), 'el system prompt no prohíbe inventar audio');
});

console.log('Render HTML de la guía generada:');
const guia = {
  metadatos: { titulo: 'People Around Me', area: 'Inglés', grado: '1ro Secundaria', seccion: 'A', productoFinal: 'Perfil personal', nivel: 'A1' },
  fichas: [fichaOK()],
};
const html = formatearGuiaMaestroHTML(guia, '');
check('el documento muestra la clase, el guion completo y las respuestas', () => {
  assert(html.includes('CLASE 2'), 'falta el número de clase');
  assert(html.includes('Hello! My name is Luis.'), 'falta el guion del listening');
  assert(html.includes('Respuestas esperadas'), 'falta el bloque de respuestas');
  assert(html.includes('Luis · 12'), 'faltan las respuestas concretas');
});
check('avisa que el listening es un guion para leer (no audio grabado)', () => {
  assert(/No hay audio grabado/.test(html), 'no avisa que es guion para leer en voz alta');
});
check('muestra gramática funcional, apoyos, errores y comprobación', () => {
  assert(html.includes('Gramática funcional'), 'falta gramática');
  assert(html.includes('Apoyos'), 'faltan apoyos');
  assert(html.includes('I have twelve years'), 'falta el error previsible');
  assert(html.includes('Comprobar el aprendizaje'), 'falta la evaluación');
});
check('no serializa objetos como texto ("[object Object]")', () => {
  assert(!html.includes('[object Object]'), 'hay un objeto mal serializado en el HTML');
});
check('una guía vacía rinde un aviso en vez de romper', () => {
  const vacio = formatearGuiaMaestroHTML({ metadatos: {}, fichas: [] }, '');
  assert(vacio.includes('aún no tiene clases generadas'), 'no muestra aviso de guía vacía');
});

console.log(`\n${pasos} ✓ · ${fallos} ✗`);
if (fallos > 0) process.exit(1);
