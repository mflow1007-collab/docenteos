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
check('minutos ligeramente desajustados (8 vs 10) se CUADRAN al normalizar, no se rechazan', () => {
  const bruta = {
    titulo: 'Clase', proposito: 'p', destreza: { tipo: 'ninguna' }, evaluacion: { comprobacion: 'ok' },
    momentos: [
      { nombre: 'Inicio', pasos: [{ minutos: 4, docenteHace: 'a' }, { minutos: 4, docenteHace: 'b' }] }, // 8, no 10
      { nombre: 'Desarrollo', pasos: [{ minutos: 12, docenteHace: 'c' }, { minutos: 12, docenteHace: 'd' }] }, // 24, no 25
      { nombre: 'Cierre', pasos: [{ minutos: 9, docenteHace: 'e' }] }, // 9, no 10
    ],
  };
  const f = normalizarFichaGuia(bruta, 1);
  const suma = (nombre) => f.momentos.find((m) => m.nombre === nombre).pasos.reduce((a, p) => a + p.minutos, 0);
  assert(suma('Inicio') === 10, 'Inicio no cuadró a 10: ' + suma('Inicio'));
  assert(suma('Desarrollo') === 25, 'Desarrollo no cuadró a 25: ' + suma('Desarrollo'));
  assert(suma('Cierre') === 10, 'Cierre no cuadró a 10: ' + suma('Cierre'));
  const v = validarFichaGuia(f, { idioma: false });
  assert(v.ok, 'una ficha con minutos cuadrados no debería fallar: ' + v.motivos.join('; '));
});
check('un momento SIN pasos → sí falla (patológico)', () => {
  const f = fichaOK();
  f.momentos[1].pasos = [];
  const v = validarFichaGuia(f, { idioma: true });
  assert(!v.ok && v.motivos.some((m) => /sin pasos/.test(m)), 'no detectó el momento sin pasos');
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

console.log('Reglas de calidad (feedback del usuario):');
check('reading SIN antes/global/después de leer → falla', () => {
  const f = fichaOK();
  f.destreza = { tipo: 'reading', titulo: 'Meet Ana', guion: ['Hello! My name is Ana.'], ejercicio: { enunciado: 'x', items: ['Name: ___'] }, respuestasEsperadas: ['Ana'] };
  const v = validarFichaGuia(f, { idioma: true });
  assert(!v.ok, 'debía fallar un reading sin sus partes');
  assert(v.motivos.some((m) => /ANTES de leer/.test(m)), 'no exige tarea previa');
  assert(v.motivos.some((m) => /comprensión global/.test(m)), 'no exige comprensión global');
  assert(v.motivos.some((m) => /posterior/.test(m)), 'no exige actividad posterior');
});
check('reading COMPLETO (6 partes) pasa', () => {
  const f = fichaOK();
  f.destreza = { tipo: 'reading', titulo: 'Meet Ana', guion: ['Hello! My name is Ana.', 'I am thirteen years old.'],
    antesDeLeer: '¿Qué datos crees que encontraremos?', comprensionGlobal: '¿De quién trata?',
    ejercicio: { enunciado: 'Completa', items: ['Name: ___', 'Age: ___'] }, respuestasEsperadas: ['Ana', '13'],
    despuesDeLeer: 'Escribe tu propia presentación con el modelo.' };
  const v = validarFichaGuia(f, { idioma: true });
  assert(v.ok, 'un reading completo no debería fallar: ' + v.motivos.join('; '));
});
check('clave con MÁS respuestas que ítems → falla (clave no cuadra)', () => {
  const f = fichaOK();
  f.destreza.ejercicio = { enunciado: 'x', items: ['Name: ___'] };
  f.destreza.respuestasEsperadas = ['Ana', '12', 'Santo Domingo'];
  const v = validarFichaGuia(f, { idioma: true });
  assert(!v.ok && v.motivos.some((m) => /clave no cuadra/.test(m)), 'no detectó el desajuste clave/ítems');
});
check('rúbrica sin niveles → falla; con criterios+niveles → pasa', () => {
  const f = fichaOK();
  f.recursos.push({ tipo: 'rubrica', titulo: 'Rúbrica de presentación', criterios: ['Comunica los datos'] });
  let v = validarFichaGuia(f, { idioma: true });
  assert(!v.ok && v.motivos.some((m) => /niveles/.test(m)), 'no exigió niveles en la rúbrica');
  f.recursos[f.recursos.length - 1].niveles = ['Logrado: comunica los 4 datos', 'En proceso: 2-3 datos', 'Inicial: con apoyo'];
  v = validarFichaGuia(f, { idioma: true });
  assert(v.ok, 'una rúbrica con criterios y niveles debería pasar: ' + v.motivos.join('; '));
});
check('lista de cotejo sin criterios → falla', () => {
  const f = fichaOK();
  f.recursos.push({ tipo: 'lista_cotejo', titulo: 'Cotejo' });
  const v = validarFichaGuia(f, { idioma: true });
  assert(!v.ok && v.motivos.some((m) => /criterios/.test(m)), 'no exigió criterios en el cotejo');
});
check('comprobación vaga ("estudiantes motivados") → falla', () => {
  const f = fichaOK();
  f.evaluacion.comprobacion = 'Estudiantes motivados y con buena atención.';
  const v = validarFichaGuia(f, { idioma: true });
  assert(!v.ok && v.motivos.some((m) => /vaga/.test(m)), 'no rechazó la comprobación vaga');
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
