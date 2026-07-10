/**
 * bancoAprendizajeService.js — Banco de Secuencias de Aprendizaje
 *
 * QUÉ ES: memoria de secuencias didácticas YA generadas y validadas, ancladas
 * a la malla oficial por referencias exactas. Reutilizar lo bueno, nunca
 * inventar lo que falta.
 *
 * QUÉ NO ES (PROHIBIDO): este banco JAMÁS genera, completa ni parafrasea
 * contenido. Solo almacena VERBATIM lo que produjo el flujo malla+IA validado
 * y lo sirve tal cual — si una referencia curricular ya no existe en la malla
 * activa, la secuencia NO se sirve y queda marcada para revisión.
 *
 * ESTADO: diseñado y verificable AHORA; el SERVICIO al generador queda detrás
 * de un gate APAGADO por defecto (config/banco-aprendizaje.enabled=false).
 * Encenderlo es decisión del admin cuando la cobertura validada lo amerite.
 *
 * Ciclo de vida de una secuencia: cosechada → validada → (retirada)
 *   - cosechada: guardada con consentimiento del docente (opt-in) al guardar
 *     su unidad. NO se sirve todavía.
 *   - validada: el admin la revisó; servible SOLO si el gate está encendido
 *     y verificarRefsContraMalla pasa contra la malla ACTIVA en el momento
 *     de servir.
 *   - retirada: fuera de circulación (nunca se borra — archivado reversible).
 */

import {
  collection, addDoc, doc, getDoc, getDocs, updateDoc,
  serverTimestamp, query, where, limit,
} from 'firebase/firestore';
import { db, auth } from '../firebase.js';

export const BA_COLLECTION = 'bancoAprendizaje';
export const BA_CONFIG_DOC = 'config/banco-aprendizaje';
export const BA_ESTADOS = ['cosechada', 'validada', 'retirada'];

const _norm = (s) => String(s ?? '')
  .toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const _texto = (v) => String(v ?? '').trim();
const _arr = (v) => (Array.isArray(v) ? v : []);

// ─── Esquema de la secuencia cosechada ───────────────────────────────────────
// curricularRefs es OBLIGATORIO: una secuencia sin anclas exactas a la malla
// no es cosechable. Todo lo demás es copia verbatim del output validado.

export const construirSecuenciaCosechada = ({
  unidad,           // unidad generada (con especificacionCurricular y semanas)
  mallaId,          // id del doc curricularContent usado en la generación
  mallaContentId = '',
  docenteUid = '',
  docenteEmail = '',
}) => {
  const spec = unidad?.especificacionCurricular;
  if (!spec) throw new Error('La unidad no trae especificacionCurricular — no es cosechable.');
  if (!_texto(mallaId)) throw new Error('mallaId obligatorio: la secuencia debe anclarse a la malla que la produjo.');

  const codigosIndicadores = _arr(spec.indicadores).map((i) => _texto(i.codigoOficial || i.id)).filter(Boolean);
  const codigosCompetencias = _arr(spec.ces).map((c) => _texto(c.codigoOficial || c.id)).filter(Boolean);
  if (!_texto(spec.temaOficial) || !codigosIndicadores.length) {
    throw new Error('Secuencia sin temaOficial o sin códigos de indicadores — no es cosechable.');
  }

  return {
    schemaVersion: '1.0',
    estado: 'cosechada',
    // Anclas exactas a la malla oficial (verificadas al servir, no solo al guardar)
    curricularRefs: {
      mallaId: _texto(mallaId),
      mallaContentId: _texto(mallaContentId),
      temaOficial: _texto(spec.temaOficial),
      codigosCompetencias,
      codigosIndicadores,
      estructurasGramaticales: _arr(spec.contenidosClaves?.gramatica).map(_texto).filter(Boolean),
      vocabularioCategorias: _arr(unidad.vocabularioCategorias).map(_texto).filter(Boolean),
    },
    contexto: {
      area: _texto(spec.area),
      grado: _texto(spec.grado),
      nivel: _texto(unidad.nivel || unidad.nivelEducativo),
      nivelMCERL: _texto(spec.nivelMCERL),
    },
    // Copia VERBATIM de la secuencia validada — este banco no redacta nada
    secuencia: unidad.semanas || unidad.weekPlans || [],
    procedencia: {
      unidadId: _texto(unidad.id),
      titulo: _texto(unidad.titulo || unidad.nombre),
      docenteUid: _texto(docenteUid),
      docenteEmail: _texto(docenteEmail),
      cosechadaEn: new Date().toISOString(),
      outputSchemaVersion: _texto(spec.outputSchemaVersion),
    },
    revision: { requerida: false, motivos: [] },
    active: true,
  };
};

// ─── Verificación contra la malla ACTIVA ─────────────────────────────────────
// Igualdad EXACTA de cadena/código, sin fuzzy ni "se parece". Una sola
// referencia inexistente basta para NO servir la secuencia y marcarla para
// revisión. Función PURA — testeable sin Firestore.

export const verificarRefsContraMalla = (curricularRefs, malla) => {
  const motivos = [];
  const refs = curricularRefs || {};
  const payload = malla?.payload || malla || {};

  if (!malla) {
    return { ok: false, servible: false, motivos: ['Sin malla activa contra la cual verificar.'] };
  }

  // 1. La secuencia debe venir de ESTA malla (id o contentId exactos)
  const mallaIds = [_texto(malla.id), _texto(malla.contentId), _texto(payload.contentId)].filter(Boolean);
  const refMalla = [_texto(refs.mallaId), _texto(refs.mallaContentId)].filter(Boolean);
  if (!refMalla.some((r) => mallaIds.includes(r))) {
    motivos.push(`curricularRefs.mallaId "${refs.mallaId || '—'}" no corresponde a la malla activa (${mallaIds.join(' / ') || 'sin id'}).`);
  }

  // 2. Tema oficial: debe existir en los temas de la malla (normalizado, no fuzzy)
  const temasMalla = (_arr(payload.temas).length ? _arr(payload.temas)
    : _arr(payload.temasCurriculares).length ? _arr(payload.temasCurriculares)
    : _arr(payload.contenidos?.conceptos?.temas))
    .map((t) => _norm(typeof t === 'string' ? t : t?.tema || t?.nombre || t?.temaOficial));
  if (!temasMalla.includes(_norm(refs.temaOficial))) {
    motivos.push(`temaOficial "${refs.temaOficial}" no existe en la malla activa.`);
  }

  // 3. Códigos de indicadores: cada uno debe existir tal cual
  const idsIndicadores = new Set();
  _arr(payload.competencias).forEach((c) => {
    _arr(c?.indicadoresLogro || c?.indicadores).forEach((i) => {
      const id = _texto(typeof i === 'string' ? '' : i?.id || i?.codigo);
      if (id) idsIndicadores.add(id);
    });
  });
  _arr(payload.indicadoresLogro || payload.indicadores).forEach((i) => {
    const id = _texto(typeof i === 'string' ? '' : i?.id || i?.codigo);
    if (id) idsIndicadores.add(id);
  });
  for (const cod of _arr(refs.codigosIndicadores)) {
    if (!idsIndicadores.has(_texto(cod))) {
      motivos.push(`Indicador "${cod}" ya no existe en la malla activa.`);
    }
  }

  // 4. Estructuras gramaticales: igualdad exacta de cadena
  const estructurasMalla = new Set(
    _arr(payload.contenidos?.conceptos?.gramatica)
      .map((g) => _texto(typeof g === 'string' ? g : g?.estructura))
      .filter(Boolean),
  );
  for (const est of _arr(refs.estructurasGramaticales)) {
    if (!estructurasMalla.has(_texto(est))) {
      motivos.push(`Estructura gramatical "${est}" ya no existe en la malla activa.`);
    }
  }

  // 5. Categorías de vocabulario referenciadas deben existir
  const categoriasMalla = new Set(
    _arr(payload.contenidos?.conceptos?.vocabulario)
      .map((v) => _norm(typeof v === 'string' ? '' : v?.categoria))
      .filter(Boolean),
  );
  for (const cat of _arr(refs.vocabularioCategorias)) {
    if (!categoriasMalla.has(_norm(cat))) {
      motivos.push(`Categoría de vocabulario "${cat}" ya no existe en la malla activa.`);
    }
  }

  const ok = motivos.length === 0;
  return { ok, servible: ok, motivos };
};

// ─── Gate (APAGADO por defecto) ──────────────────────────────────────────────

export const getBancoAprendizajeGate = async () => {
  const apagado = { enabled: false, umbralCobertura: 0 };
  if (!db) return apagado;
  try {
    const snap = await getDoc(doc(db, BA_CONFIG_DOC));
    if (!snap.exists()) return apagado; // sin config = apagado, sin excepciones
    const data = snap.data() || {};
    return {
      enabled: data.enabled === true, // solo true explícito enciende
      umbralCobertura: Number(data.umbralCobertura) || 0,
    };
  } catch {
    return apagado; // error de lectura = apagado (fail-closed: no servir)
  }
};

// ─── Cosecha (opt-in del docente al guardar su unidad) ───────────────────────

export const cosecharSecuenciaDeUnidad = async ({ unidad, mallaId, mallaContentId, consentimiento = false }) => {
  if (consentimiento !== true) return null; // opt-in explícito, jamás por defecto
  if (!db) return null;
  const user = auth?.currentUser;
  if (!user) return null;

  const secuencia = construirSecuenciaCosechada({
    unidad, mallaId, mallaContentId,
    docenteUid: user.uid, docenteEmail: user.email || '',
  });
  const ref = await addDoc(collection(db, BA_COLLECTION), {
    ...secuencia,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
};

// ─── Servicio al generador (FUTURO — hoy siempre corto por el gate) ──────────
// Devuelve SOLO secuencias 'validada' cuyas refs pasan contra la malla activa.
// Las que fallan la verificación se marcan para revisión y NO se sirven.

export const servirSecuenciasValidadas = async ({ malla, temaOficial }) => {
  const gate = await getBancoAprendizajeGate();
  if (!gate.enabled) return []; // apagado por defecto — el generador ni se entera
  if (!db || !malla) return [];

  try {
    const snap = await getDocs(query(
      collection(db, BA_COLLECTION),
      where('active', '==', true),
      where('estado', '==', 'validada'),
      where('curricularRefs.temaOficial', '==', _texto(temaOficial)),
      limit(10),
    ));
    const servibles = [];
    for (const d of snap.docs) {
      const data = { id: d.id, ...d.data() };
      const veredicto = verificarRefsContraMalla(data.curricularRefs, malla);
      if (veredicto.servible) {
        servibles.push(data);
      } else {
        // Referencia rota → NO se sirve + marca de revisión (nunca se borra)
        await updateDoc(doc(db, BA_COLLECTION, d.id), {
          'revision.requerida': true,
          'revision.motivos': veredicto.motivos,
          'revision.marcadaEn': serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      }
    }
    return servibles;
  } catch (err) {
    console.error('[bancoAprendizaje] servirSecuenciasValidadas:', err);
    return []; // fail-closed: ante duda, el generador sigue con malla+IA
  }
};
