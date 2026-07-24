/**
 * combinadorActividadesService.js — El banco crea actividades NUEVAS sin IA
 *
 * VISIÓN DEL DUEÑO: cuando el banco tiene suficiente material (≥3 piezas afines),
 * ya no necesita IA para variar: RECOMBINA lo que tiene para crear una actividad
 * nueva y coherente. Cero créditos.
 *
 * IDEA CLAVE — toda actividad tiene dos partes separables:
 *   - MECÁNICA (el "cómo": Frequency Walk, Interview Stations, Advice Swap…):
 *     reutilizable con cualquier estructura/tema.
 *   - CONTENIDO (el "qué": la estructura gramatical + el tema que practica).
 * COMBINAR = tomar la mecánica de una actividad PROBADA del banco y aplicarla a
 * la estructura/tema que pide el día. Ej.: mecánica "Interview Stations" (vista
 * para rutinas) + estructura "Can/may/could" → "Permission Interview Stations".
 *
 * CASCADA (decidida con el dueño): banco directo → COMBINADOR → molde → IA.
 * El combinador solo entra si NO hubo match directo, para no desperdiciar una
 * actividad del banco que ya servía tal cual.
 *
 * UMBRAL ≥3 piezas afines: no combina con poca evidencia (idea original del
 * dueño, conservador). La actividad creada se marca para COSECHAR como
 * `cosechada` — el banco crece con su propio material y el dueño valida.
 * Ver [[project_banco_actividades_generador]] y [[feedback_firebase_produccion]].
 *
 * LÓGICA PURA (sin Firestore): recibe banco + objetivo, devuelve la actividad
 * combinada (o null). La cosecha la hace quien lo llame.
 */

import { TEMA_KEYWORDS } from './curriculumCombinacionService.js';

const _norm = (s) => String(s ?? '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

// Expande un tema a sus SINÓNIMOS del campo (rutinas, daily, habits…) para que
// "actividades de la vida diaria" reconozca piezas etiquetadas "rutinas". Sin
// esto el matching literal falla entre sinónimos y el combinador nunca dispara.
const _expandirTema = (tema) => {
  const base = new Set(_norm(tema).split(' ').filter((w) => w.length > 2));
  const n = _norm(tema);
  for (const [clave, sinonimos] of Object.entries(TEMA_KEYWORDS)) {
    const familia = [clave, ...sinonimos].map(_norm);
    // Si el tema coincide con la clave o con algún sinónimo, sumamos TODA la
    // familia de palabras a la base de afinidad.
    if (familia.some((f) => f && (n.includes(f) || f.includes(n)))) {
      familia.forEach((f) => f.split(' ').forEach((w) => { if (w.length > 2) base.add(w); }));
    }
  }
  return base;
};

const _tok = (s) => new Set(_norm(s).split(' ').filter((w) => w.length > 2));

const UMBRAL_PIEZAS_AFINES = 3; // ≥3 actividades del banco para poder combinar
const UMBRAL_SOLAPAMIENTO = 1;  // ≥1 señal de TEMA en común = mismo campo
const UMBRAL_TECNICAS_DISTINTAS = 2; // ≥2 mecánicas distintas = hay qué combinar

// Nombre corto y legible de la mecánica de una actividad: si el título trae una
// técnica reconocible (Interview Stations, Frequency Walk…), se usa; si no, se
// deriva del título limpio. Es lo que hace única a la actividad combinada.
const _nombreMecanica = (act) => {
  const t = String(act?.titulo || '').trim();
  // Quita el sufijo temático entre paréntesis: "Interview Stations (Family)" →
  // "Interview Stations".
  const base = t.replace(/\s*\([^)]*\)\s*$/, '').trim();
  return base || 'Activity';
};

// Señales de CONTENIDO de una actividad (estructura + tema): lo que el matcher
// usa para saber a qué sirve. La mecánica es lo que NO es contenido.
const _senalesContenido = (act) => new Set([
  ...(Array.isArray(act?.temas) ? act.temas : []).flatMap((t) => [..._tok(t)]),
  ...(Array.isArray(act?.habilidades) ? act.habilidades : []).flatMap((h) => [..._tok(h)]),
]);

/**
 * Descompone una actividad del banco en { mecanica, pasos, contenido }.
 * `pasos` son las instrucciones VERBATIM con su contenido específico; para
 * recombinar, el paso "central" (el de la técnica) se reescribe hacia la nueva
 * estructura/tema, y el andamiaje (escucha inicial, socialización final) se
 * conserva porque es agnóstico al contenido.
 */
export const descomponerActividad = (act) => ({
  id: act?.id || '',
  mecanica: _nombreMecanica(act),
  pasos: (Array.isArray(act?.instrucciones) ? act.instrucciones : []).map((s) => String(s || '').trim()).filter(Boolean),
  contenido: _senalesContenido(act),
  usosTotal: Number(act?.usosTotal || 0),
  valoracion: Number(act?.valoracion || 0),
  tipo: act?.tipo || 'Speaking',
  estrategia: act?.estrategia || '',
  competencia: act?.competencia || 'Comunicativa',
  duracion: Number(act?.duracion || 30),
});

// Puntúa qué tan "probada" es una mecánica: uso real + valoración del dueño.
// Una mecánica muy usada y bien valorada es mejor candidata a recombinar.
const _pesoProbada = (d) => Math.min(d.usosTotal, 5) * 1 + Math.min(d.valoracion, 5) * 0.6;

/**
 * Combina piezas del banco para crear una actividad NUEVA para un objetivo.
 * PURO: no toca Firestore.
 *
 * @param banco   actividades del área (official/approved/cosechada con instrucciones)
 * @param objetivo {estructura, temaSemana, funcion, area, grado}
 * @returns actividad combinada lista para usar/cosechar, o null si:
 *          - no hay ≥3 piezas afines (umbral no alcanzado)
 *          - ninguna mecánica es aplicable
 */
export const combinarActividad = (banco = [], objetivo = {}) => {
  const { estructura = '', temaSemana = '', funcion = '', area = '', grado = '' } = objetivo;
  // Afinidad = mismo campo pedagógico. Se mide por TEMA **o** por ESTRUCTURA:
  //   - por tema: piezas del mismo campo temático (rutinas, deporte…).
  //   - por estructura: piezas que practican la misma gramática (presente
  //     simple, adverbios de frecuencia…), aunque el tema esté rotulado con
  //     otras palabras. Esto es CLAVE: la semilla dice "rutinas" pero la unidad
  //     dice "actividades de la vida diaria" —sinónimos, cero solape literal—;
  //     sin el eje de estructura el combinador nunca dispararía entre ellas.
  // La mecánica combina bien cuando sirve a la MISMA estructura, así que este
  // eje es además el más correcto pedagógicamente.
  const señalesTema = _expandirTema(temaSemana); // incluye sinónimos del campo
  const señalesEstructura = _tok(estructura);
  const señalesObjetivo = new Set([...señalesEstructura, ...señalesTema, ..._tok(funcion)]);
  if (!señalesObjetivo.size) return null;

  const conMecanica = (Array.isArray(banco) ? banco : [])
    .filter((a) => Array.isArray(a?.instrucciones) && a.instrucciones.filter((x) => String(x || '').trim().length > 20).length >= 2)
    .map(descomponerActividad);

  // Piezas AFINES: comparten ≥UMBRAL señales de TEMA o de ESTRUCTURA con el
  // objetivo. Basta con uno de los dos ejes para ser "del mismo campo".
  const solapa = (contenido, base) => {
    let n = 0;
    base.forEach((s) => { if (contenido.has(s)) n += 1; });
    return n;
  };
  const afines = conMecanica.filter((d) =>
    solapa(d.contenido, señalesTema) >= UMBRAL_SOLAPAMIENTO ||
    solapa(d.contenido, señalesEstructura) >= UMBRAL_SOLAPAMIENTO
  );
  if (afines.length < UMBRAL_PIEZAS_AFINES) return null; // ← tu umbral ≥3

  // Elegimos la MECÁNICA más probada de entre las piezas afines: es la que mejor
  // funcionó en el banco. Su técnica se aplica a la estructura/tema del día.
  const mejor = afines.slice().sort((a, b) => _pesoProbada(b) - _pesoProbada(a))[0];

  // Deduplicar mecánicas por nombre: no queremos "combinar" dos copias de la
  // misma técnica; contamos técnicas DISTINTAS como señal de riqueza del banco.
  const tecnicasDistintas = new Set(afines.map((d) => _norm(d.mecanica)));
  if (tecnicasDistintas.size < UMBRAL_TECNICAS_DISTINTAS) return null; // sin variedad, nada que combinar

  // Síntesis: mecánica probada + estructura/tema del objetivo. El paso central
  // se reescribe hacia el objetivo; conservamos el andamiaje (escucha con
  // propósito al inicio, socialización al final) que es agnóstico al contenido.
  const focoTema = temaSemana || 'el tema de la unidad';
  const pasoCentral = `Aplican la mecánica "${mejor.mecanica}" para practicar ${estructura || 'la estructura del día'} sobre ${focoTema}: interactúan en parejas o grupos siguiendo esa dinámica y registran sus producciones.`;

  const instrucciones = [
    `Escuchan con propósito un texto breve sobre ${focoTema} y reconocen ${estructura || 'la estructura trabajada'} en contexto.`,
    pasoCentral,
    `Elaboran una producción propia incorporando ${estructura || 'la estructura del día'} y al menos tres palabras del vocabulario del tema. (Aporte al producto final.)`,
    `Socializan su producción con un compañero y aplican una mejora concreta ("una estrella y un deseo") antes de guardarla en el portafolio.`,
  ];

  const tituloNuevo = `${mejor.mecanica} — ${(estructura || focoTema).split(/[·(]/)[0].trim()}`.slice(0, 80);

  return {
    titulo: tituloNuevo,
    tipo: mejor.tipo,
    momento: 'Desarrollo',
    area,
    grados: grado ? [grado] : [],
    temas: [temaSemana, estructura].map((s) => String(s || '').trim()).filter(Boolean),
    habilidades: [estructura].map((s) => String(s || '').trim()).filter(Boolean),
    estrategia: mejor.estrategia || 'Combinación de mecánicas del banco',
    competencia: mejor.competencia,
    instrucciones,
    duracion: mejor.duracion,
    // Trazabilidad: de qué mecánica nació y con cuánta evidencia (para el dueño).
    _combinada: {
      mecanicaDe: mejor.id,
      piezasAfines: afines.length,
      tecnicasDistintas: tecnicasDistintas.size,
    },
  };
};

export const COMBINADOR_CONST = { UMBRAL_PIEZAS_AFINES, UMBRAL_SOLAPAMIENTO };
