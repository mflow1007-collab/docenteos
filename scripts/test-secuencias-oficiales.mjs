/**
 * test-secuencias-oficiales.mjs — verifica la lógica PURA del banco de secuencias
 * oficiales sin Firestore: alcance exacto (sin deducir nivel), división de la guía
 * según su índice y fallo explícito cuando el PDF no coincide con el manifiesto.
 */
import { readFileSync } from 'fs';
import {
  SO_AREAS, SO_ASIGNATURAS_POR_AREA, SO_GRADOS,
  agruparPorArea, asignaturasConVariasVigentes, construirIdGuia, detectarTextoDanado, dividirGuia, limpiarTextoPagina, validarAlcance,
} from '../src/services/secuenciasOficialesModelo.js';
import {
  construirContexto, construirVocabulario, decodificarControl, recuperarPagina,
} from './lib/recuperarTexto.mjs';
import { BC_AREAS, BC_GRADES, BC_SUBJECTS_BY_AREA } from '../src/services/bancoConocimientoService.js';

let pasos = 0, fallos = 0;
const check = (nombre, fn) => {
  try { fn(); pasos += 1; console.log(`  ✓ ${nombre}`); }
  catch (e) { fallos += 1; console.log(`  ✗ ${nombre}: ${e.message}`); }
};
const assert = (c, m) => { if (!c) throw new Error(m); };

const alcance = { nivel: 'Primaria', grado: '4to', area: 'Lengua Española', asignatura: 'Lengua Española' };
const guia = { titulo: 'Guía', anio: 2022, urlFuente: 'https://ejemplo.test/guia.pdf' };

console.log('Alcance exacto');
check('acepta un alcance completo', () => assert(validarAlcance(alcance).length === 0, 'rechazó un alcance válido'));
check('sin nivel falla: no se deduce del grado', () => assert(validarAlcance({ ...alcance, nivel: '' }).length > 0, 'aceptó sin nivel'));
check('no normaliza variantes del nivel', () => assert(validarAlcance({ ...alcance, nivel: 'Primario' }).length > 0, 'aceptó "Primario"'));
check('no normaliza variantes del grado', () => assert(validarAlcance({ ...alcance, grado: '4' }).length > 0, 'aceptó "4"'));
check('una asignatura debe pertenecer a su área', () => {
  assert(validarAlcance({ ...alcance, area: 'Lenguas Extranjeras', asignatura: 'Inglés' }).length === 0, 'rechazó Inglés');
  assert(validarAlcance({ ...alcance, area: 'Lenguas Extranjeras', asignatura: 'Matemática' }).length > 0, 'aceptó Matemática');
  assert(validarAlcance({ ...alcance, asignatura: 'Inglés' }).length > 0, 'aceptó Inglés en Lengua Española');
});
check('4to de Primaria y 4to de Secundaria tienen ids distintos', () => {
  const a = construirIdGuia({ ...alcance, guia });
  const b = construirIdGuia({ ...alcance, nivel: 'Secundaria', guia });
  assert(a !== b, 'mismo id');
});
check('Inglés y Francés tienen ids distintos', () => {
  const base = { ...alcance, area: 'Lenguas Extranjeras', guia };
  assert(construirIdGuia({ ...base, asignatura: 'Inglés' }) !== construirIdGuia({ ...base, asignatura: 'Francés' }), 'mismo id');
});
check('las áreas y asignaturas coinciden con el Banco de Conocimiento', () => {
  assert(SO_AREAS.every((a) => BC_AREAS.includes(a)), 'área desconocida');
  assert(JSON.stringify(SO_GRADOS) === JSON.stringify(BC_GRADES), 'grados distintos');
  assert(JSON.stringify(SO_ASIGNATURAS_POR_AREA) === JSON.stringify(BC_SUBJECTS_BY_AREA), 'asignaturas distintas');
});

console.log('División de la guía');
const paginas = [
  'Secuencia\nDidáctica 1\nIntroducción uno',
  'Comprensión oral\nTexto oral.',
  'Más texto oral.\nProducción escrita\nTexto escrito.\nAnexo\nTexto anexo.',
  'Secuencia\nDidáctica 2\nIntroducción dos',
  'Gramática textual\nTexto de gramática.',
];
const manifiesto = {
  ...alcance, guia,
  secuencias: [
    { numero: 1, titulo: 'Uno', paginaInicio: 1, partes: [
      { nombre: 'Comprensión oral', pagina: 2 },
      { nombre: 'Producción escrita', pagina: 3 },
      { nombre: 'Anexo', pagina: 3 },
    ] },
    { numero: 2, titulo: 'Dos', paginaInicio: 4, partes: [{ nombre: 'Gramática textual', pagina: 5 }] },
  ],
};
const res = dividirGuia(paginas, manifiesto);
check('divide sin errores', () => assert(res.errores.length === 0 && res.documentos.length === 2, res.errores.join('; ')));
check('una parte continúa hasta el encabezado siguiente', () => {
  const texto = res.documentos[0].datos.partes[0].texto;
  assert(texto.includes('Más texto oral') && !texto.includes('Texto escrito'), texto);
});
check('dos partes en la misma página quedan separadas', () => {
  const [, escrita, anexo] = res.documentos[0].datos.partes;
  assert(escrita.texto === 'Texto escrito.', escrita.texto);
  assert(anexo.texto === 'Texto anexo.', anexo.texto);
});
check('la secuencia no invade a la siguiente', () => {
  assert(res.documentos[0].datos.paginaFin === 3, 'paginaFin incorrecta');
  assert(!res.documentos[0].datos.partes[2].texto.includes('Introducción dos'), 'invadió');
});
check('cada secuencia conserva alcance y origen', () => {
  const d = res.documentos[1].datos;
  assert(d.nivel === 'Primaria' && d.grado === '4to' && d.area === 'Lengua Española', 'alcance perdido');
  assert(d.guia.urlFuente === guia.urlFuente && d.guia.id === res.idGuia, 'origen perdido');
});
check('los ids son estables entre cargas', () => {
  assert(dividirGuia(paginas, manifiesto).documentos[0].id === res.documentos[0].id, 'id inestable');
});
check('corrige ligaduras sin cambiar la redacción', () => {
  assert(limpiarTextoPagina('Pontiﬁ  cia  Universidad') === 'Pontificia Universidad', 'ligadura');
});

check('quita el pie de página y su pestaña', () => {
  const a = limpiarTextoPagina('Texto real.\nSecuencia Didáctica #1 • La conversación 13\nComprensión oral');
  const b = limpiarTextoPagina('Texto real.\n66 Lengua Española • Cuarto Grado del Nivel Primario\nAnexo');
  assert(a === 'Texto real.' && b === 'Texto real.', `${a} | ${b}`);
});
check('conserva el contenido que aparece después del pie', () => {
  const t = limpiarTextoPagina('Antes.\nSecuencia Didáctica #4 • La receta 69\nComprensión oral\nMantequilla de aguacate\nIngredientes');
  assert(t === 'Antes.\nMantequilla de aguacate\nIngredientes', t);
});
check('quita un pie partido en dos líneas', () => {
  assert(limpiarTextoPagina('A.\nSecuencia\nDidáctica #2 • La carta 25\nComprensión oral\nB.') === 'A.\nB.', 'pie partido');
  assert(limpiarTextoPagina('A.\nSecuencia Didáctica #2 • La carta\n45\nB.') === 'A.\nB.', 'número suelto');
});
check('conserva un encabezado que no viene tras un pie', () => {
  assert(limpiarTextoPagina('Comprensión oral\nTexto') === 'Comprensión oral\nTexto', 'quitó el encabezado');
});

console.log('Falla si el PDF no coincide');
const conPagina = (cambio) => ({
  ...manifiesto,
  secuencias: manifiesto.secuencias.map((s, i) => (i === 0 ? { ...s, ...cambio } : s)),
});
check('portada ausente', () => assert(dividirGuia(paginas, conPagina({ paginaInicio: 2 })).errores.length > 0, 'no falló'));
check('encabezado ausente', () => {
  const partes = [{ nombre: 'Comprensión escrita', pagina: 2 }];
  assert(dividirGuia(paginas, conPagina({ partes })).errores.length > 0, 'no falló');
});
check('partes fuera de orden', () => {
  const partes = [{ nombre: 'Producción escrita', pagina: 3 }, { nombre: 'Comprensión oral', pagina: 2 }];
  assert(dividirGuia(paginas, conPagina({ partes })).errores.length > 0, 'no falló');
});
check('alcance inválido no produce documentos', () => {
  const r = dividirGuia(paginas, { ...manifiesto, nivel: '' });
  assert(r.errores.length > 0 && r.documentos.length === 0, 'produjo documentos');
});
check('sin enlace de origen no se carga', () => {
  assert(dividirGuia(paginas, { ...manifiesto, guia: { titulo: 'x', anio: 2022 } }).errores.length > 0, 'no falló');
});

check('página final declarada: no invade lo que sigue', () => {
  const r = dividirGuia(paginas, conPagina({ paginaFin: 2, partes: [{ nombre: 'Comprensión oral', pagina: 2 }] }));
  assert(r.errores.length === 0 && r.documentos[0].datos.paginaFin === 2, r.errores.join('; '));
  assert(dividirGuia(paginas, conPagina({ paginaFin: 4 })).errores.length > 0, 'aceptó invadir la siguiente');
});
check('grupo inválido o incompleto', () => {
  assert(dividirGuia(paginas, conPagina({ grupo: 'otro' })).errores.length > 0, 'aceptó otro');
  assert(dividirGuia(paginas, conPagina({ grupo: 'principal' })).errores.length > 0, 'aceptó una secuencia sin grupo');
});
check('texto dañado impide la carga', () => {
  const malas = paginas.map((t) => t.replace('Texto escrito.', 'La mamá de 2ancy.'));
  assert(dividirGuia(malas, manifiesto).errores.some((e) => e.includes('dañadas')), 'no falló');
});

console.log('Texto dañado');
check('reconoce los daños vistos en la edición 2025', () => {
  ['2ancy', '7ecuencia', 'gqnero', '%djetivos', 'ðnal', 'nLņa', 'preguntas\u001e', 'x.indb'].forEach((p) => assert(detectarTextoDanado(p).length === 1, p));
});
check('no marca texto sano', () => {
  ['1ro de abril', '2da. y 3era.', '¿Qué género?', 'pingüino', 'https://x.test/a=b%c', '4.º A', '50 %', 'Álex'].forEach((p) => assert(detectarTextoDanado(p).length === 0, p));
});
check('decodifica signos desplazados y respeta la otra codificación', () => {
  assert(decodificarControl('a\u001e b\u0013c \u00072') === 'a: b/c #2', decodificarControl('a\u001e b\u0013c \u00072'));
  assert(decodificarControl('x\u0003y\u001e') === 'x\u0003y\u001e', 'tocó la otra codificación');
});
check('recupera solo la palabra dañada', () => {
  const pdf = 'La mamá de 2ancy llega hoy a la casa'; const ocr = 'La mama de Nancy llega hoy a la casa';
  const r = recuperarPagina(pdf, ocr, construirVocabulario([pdf], [ocr], ['Nancy mamá']));
  assert(r.texto === 'La mamá de Nancy llega hoy a la casa', r.texto);
  assert(r.cambios.length === 1 && r.dudosas.length === 0, 'informe');
});
check('lo que no sabe resolver queda como dudoso y sin tocar', () => {
  const pdf = 'La mamá de ;ínifer llega hoy'; const ocr = 'La mamá de Xzq llega hoy';
  const r = recuperarPagina(pdf, ocr, construirVocabulario([pdf], [ocr]));
  assert(r.texto === pdf && r.dudosas.length === 1, JSON.stringify(r));
});
check('entre dos palabras válidas solo cambia si la referencia lo respalda', () => {
  const pdf = 'cuida as plantas del patio'; const ocr = 'cuida las plantas del patio'; const ref = ['as de oros', 'cuida las plantas'];
  const voc = construirVocabulario([pdf], [ocr], ref);
  assert(recuperarPagina(pdf, ocr, voc, { contexto: construirContexto(ref) }).texto === ocr, 'no usó el contexto');
  assert(recuperarPagina(pdf, ocr, voc).texto === pdf, 'cambió sin respaldo');
});

console.log('Ediciones');
check('la edición archivada no cuenta como vigente; dos vigentes se avisan', () => {
  const doc = (anio, estado) => ({ ...alcance, id: `x${anio}`, numero: 1, estado, guia: { id: `g${anio}` } });
  const lista = (a, b) => agruparPorArea([doc(2022, a), doc(2025, b)])['Lengua Española'];
  assert(asignaturasConVariasVigentes(lista('archivada', 'vigente')).length === 0, 'avisó de más');
  assert(asignaturasConVariasVigentes(lista(undefined, 'vigente')).join() === 'Lengua Española', 'no avisó');
});
check('Inglés y Francés pueden estar vigentes a la vez', () => {
  assert(asignaturasConVariasVigentes([{ asignatura: 'Inglés' }, { asignatura: 'Francés' }]).length === 0, 'confundió asignaturas');
});

console.log('Organización por área');
check('muestra todas las áreas, vacías incluidas, y ordena las secuencias', () => {
  const docs = res.documentos.map(({ id, datos }) => ({ id, ...datos })).reverse();
  const areas = agruparPorArea(docs);
  assert(Object.keys(areas).length === SO_AREAS.length, 'faltan áreas');
  assert(areas['Matemática'].length === 0, 'Matemática debería estar vacía');
  assert(areas['Lengua Española'][0].secuencias[0].numero === 1, 'orden incorrecto');
});

console.log('Manifiesto de 4to de Primaria');
const m4to = JSON.parse(readFileSync(new URL('./guias-oficiales/primaria-4to-lengua-espanola-2022.json', import.meta.url), 'utf8'));
check('alcance válido, 10 secuencias en orden', () => {
  assert(validarAlcance(m4to).length === 0, 'alcance inválido');
  assert(m4to.secuencias.map((s) => s.numero).join() === '1,2,3,4,5,6,7,8,9,10', 'numeración');
  assert(m4to.secuencias.every((s, i, a) => !i || a[i - 1].paginaInicio < s.paginaInicio), 'páginas fuera de orden');
});

console.log('Manifiesto 2025 de 4to de Primaria');
const m25 = JSON.parse(readFileSync(new URL('./guias-oficiales/primaria-4to-lengua-espanola-2025.json', import.meta.url), 'utf8'));
check('6 principales, 4 anexos y reemplaza a la edición 2022', () => {
  assert(validarAlcance(m25).length === 0, 'alcance inválido');
  assert(m25.secuencias.map((s) => s.grupo[0]).join('') === 'ppppppaaaa', 'grupos');
  assert(m25.reemplazaA === construirIdGuia(m4to) && construirIdGuia(m25) !== m25.reemplazaA, 'reemplazo');
  assert(m25.requiereTextoRecuperado === true, 'debe exigir texto recuperado');
});

console.log(`\n${pasos} ok, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
