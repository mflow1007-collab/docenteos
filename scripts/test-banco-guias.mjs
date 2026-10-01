/**
 * test-banco-guias.mjs — verifica la lógica PURA del Banco de Guías sin Firestore:
 * la huella es estable entre cosecha y servido, la igualdad es exacta (sin fuzzy),
 * y construirFichaCosechada exige área/grado/tema y guarda la ficha verbatim.
 */
import {
  construirHuellaDesde, construirHuellaFicha, construirFichaCosechada,
} from '../src/services/bancoGuiasService.js';

let pasos = 0, fallos = 0;
const check = (nombre, fn) => {
  try { fn(); pasos += 1; console.log(`  ✓ ${nombre}`); }
  catch (e) { fallos += 1; console.log(`  ✗ ${nombre}: ${e.message}`); }
};
const assert = (c, m) => { if (!c) throw new Error(m); };

const meta = { titulo: 'People Around Me', area: 'Inglés', grado: '1ro Secundaria' };
const ficha = { numeroClase: 2, titulo: 'Comprender una presentación', focoLinguistico: 'presentarse', destreza: { tipo: 'listening' } };

console.log('Huella: estable entre cosecha y servido');
check('la huella de la ficha (cosecha) == la huella derivada de la clase (servido)', () => {
  const hCosecha = construirHuellaFicha(ficha, meta);
  const hServido = construirHuellaDesde({ area: meta.area, grado: meta.grado, tema: meta.titulo, numeroClase: 2, focoLinguistico: 'presentarse' });
  assert(hCosecha.clave === hServido.clave, `claves distintas:\n  cosecha=${hCosecha.clave}\n  servido=${hServido.clave}`);
});
check('normaliza acentos y mayúsculas (Inglés == ingles)', () => {
  const a = construirHuellaDesde({ area: 'Inglés', grado: '1ro', tema: 'Perfil', numeroClase: 1, focoLinguistico: 'Saludar' });
  const b = construirHuellaDesde({ area: 'ingles', grado: '1ro', tema: 'perfil', numeroClase: 1, focoLinguistico: 'saludar' });
  assert(a.clave === b.clave, 'no normaliza acentos/mayúsculas');
});

console.log('Igualdad EXACTA (sin fuzzy)');
check('distinto número de clase → distinta huella', () => {
  const a = construirHuellaDesde({ area: 'Inglés', grado: '1ro', tema: 'Perfil', numeroClase: 1, focoLinguistico: 'saludar' });
  const b = construirHuellaDesde({ area: 'Inglés', grado: '1ro', tema: 'Perfil', numeroClase: 2, focoLinguistico: 'saludar' });
  assert(a.clave !== b.clave, 'colapsó clases distintas');
});
check('distinto tema → distinta huella (no sirve entre unidades distintas)', () => {
  const a = construirHuellaDesde({ area: 'Inglés', grado: '1ro', tema: 'Perfil', numeroClase: 1, focoLinguistico: 'saludar' });
  const b = construirHuellaDesde({ area: 'Inglés', grado: '1ro', tema: 'Mi familia', numeroClase: 1, focoLinguistico: 'saludar' });
  assert(a.clave !== b.clave, 'colapsó temas distintos');
});
check('distinto grado → distinta huella', () => {
  const a = construirHuellaDesde({ area: 'Inglés', grado: '1ro', tema: 'Perfil', numeroClase: 1, focoLinguistico: 'saludar' });
  const b = construirHuellaDesde({ area: 'Inglés', grado: '2do', tema: 'Perfil', numeroClase: 1, focoLinguistico: 'saludar' });
  assert(a.clave !== b.clave, 'colapsó grados distintos');
});
check('foco PARECIDO pero no idéntico → distinta huella (sin fuzzy)', () => {
  const a = construirHuellaDesde({ area: 'Inglés', grado: '1ro', tema: 'Perfil', numeroClase: 1, focoLinguistico: 'present simple' });
  const b = construirHuellaDesde({ area: 'Inglés', grado: '1ro', tema: 'Perfil', numeroClase: 1, focoLinguistico: 'present simple questions' });
  assert(a.clave !== b.clave, 'hizo match difuso entre focos parecidos');
});

console.log('construirFichaCosechada');
check('guarda la ficha verbatim + huella + estado cosechada', () => {
  const doc = construirFichaCosechada({ ficha, meta });
  assert(doc.estado === 'cosechada', 'estado incorrecto');
  assert(doc.ficha === ficha, 'no guarda la ficha verbatim (misma referencia)');
  assert(doc.huella?.clave, 'sin clave de huella');
  assert(doc.active === true && doc.revision.requerida === false, 'flags iniciales incorrectos');
});
check('sin área/grado/tema → NO es cosechable (lanza)', () => {
  let lanzo = false;
  try { construirFichaCosechada({ ficha, meta: { titulo: '', area: '', grado: '' } }); }
  catch { lanzo = true; }
  assert(lanzo, 'cosechó una ficha sin identidad');
});
check('ficha no-objeto → NO es cosechable (lanza)', () => {
  let lanzo = false;
  try { construirFichaCosechada({ ficha: null, meta }); } catch { lanzo = true; }
  assert(lanzo, 'cosechó una ficha nula');
});

console.log(`\n${pasos} ✓ · ${fallos} ✗`);
if (fallos > 0) process.exit(1);
