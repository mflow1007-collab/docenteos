/**
 * bancoGuiasService.js — Banco de Guías del Maestro
 *
 * QUÉ ES: memoria de FICHAS de clase (de la Guía del Maestro) ya generadas y
 * validadas. Espejo de bancoAprendizajeService: reutilizar lo bueno, nunca
 * inventar. Así, con el tiempo, la Guía depende cada vez menos de la IA — "las
 * primeras siempre con IA, luego dependiendo menos".
 *
 * QUÉ NO ES (PROHIBIDO): este banco JAMÁS genera, completa ni parafrasea una
 * ficha. Solo almacena VERBATIM lo que produjo el flujo de guía validado y lo
 * sirve tal cual cuando la HUELLA coincide EXACTAMENTE. Si no coincide, no se
 * sirve y la clase la genera la IA.
 *
 * HUELLA (identidad reutilizable de una ficha): área + grado + tema + tipo de
 * destreza + estructura/foco lingüístico. Coincidencia EXACTA (normalizada),
 * sin fuzzy. Dos clases con la misma huella son intercambiables: misma mecánica
 * y mismo contenido objetivo. Reutiliza sobre todo al RE-generar la misma
 * unidad/tema; para temas nuevos, la IA sigue trabajando.
 *
 * ESTADO: igual que el banco de secuencias — SERVICIO detrás de un gate APAGADO
 * por defecto (config/banco-guias.enabled=false). Encenderlo es decisión del
 * admin cuando haya cobertura validada. Cosecha opt-in del docente. Fail-closed:
 * ante cualquier duda o error, el generador sigue con IA.
 *
 * Ciclo de vida: cosechada → validada → retirada (nunca se borra).
 */

import {
  collection, addDoc, doc, getDoc, getDocs, updateDoc, setDoc,
  serverTimestamp, query, where, limit, orderBy,
} from 'firebase/firestore';
import { db, auth } from '../firebase.js';

export const BG_COLLECTION = 'bancoGuias';
export const BG_CONFIG_DOC = 'config/banco-guias';
export const BG_ESTADOS = ['cosechada', 'validada', 'retirada'];

const _norm = (s) => String(s ?? '')
  .toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')
  .trim();
const _texto = (v) => String(v ?? '').trim();
const _arr = (v) => (Array.isArray(v) ? v : []);

// ─── Huella: identidad reutilizable de una ficha ──────────────────────────────
// Función PURA (testeable sin Firestore). La huella debe ser DERIVABLE en los dos
// momentos y dar la MISMA clave:
//   - al COSECHAR (tenemos la ficha generada), y
//   - al SERVIR (solo tenemos la clase de la planificación, aún sin generar).
// Por eso se basa en lo COMÚN a ambos: área + grado + tema (título de la unidad)
// + nº de clase + foco lingüístico de la clase. Esto sirve el caso real de
// reutilización "verbatim por huella exacta": RE-generar la misma unidad/clase.
// No hace match semántico entre unidades distintas (eso sería adaptación, no verbatim).

export const construirHuellaDesde = ({ area = '', grado = '', tema = '', numeroClase = null, focoLinguistico = '' }) => {
  const h = {
    area: _norm(area),
    grado: _norm(grado),
    tema: _norm(tema),
    numeroClase: numeroClase == null ? '' : String(numeroClase),
    foco: _norm(focoLinguistico),
  };
  h.clave = [h.area, h.grado, h.tema, h.numeroClase, h.foco].join('|');
  return h;
};

// Huella de una ficha YA generada (para cosechar). meta = guia.metadatos.
export const construirHuellaFicha = (ficha = {}, meta = {}) =>
  construirHuellaDesde({
    area: meta.area || meta.asignatura,
    grado: meta.grado,
    tema: meta.titulo || meta.tema,
    numeroClase: ficha.numeroClase,
    focoLinguistico: ficha.focoLinguistico || ficha.gramatica?.forma || ficha.titulo,
  });

// ─── Esquema de la ficha cosechada ────────────────────────────────────────────
// La ficha se guarda VERBATIM. La huella es obligatoria: sin ella no es servible.

export const construirFichaCosechada = ({
  ficha, meta = {}, docenteUid = '', docenteEmail = '',
}) => {
  if (!ficha || typeof ficha !== 'object') throw new Error('Ficha inválida — no es cosechable.');
  const huella = construirHuellaFicha(ficha, meta);
  if (!huella.area || !huella.grado || !huella.tema) {
    throw new Error('La ficha no tiene área/grado/tema — no es cosechable.');
  }
  return {
    schemaVersion: '1.0',
    estado: 'cosechada',
    huella,
    ficha, // copia VERBATIM — este banco no redacta nada
    procedencia: {
      titulo: _texto(meta.titulo), area: _texto(meta.area || meta.asignatura), grado: _texto(meta.grado),
      numeroClase: ficha.numeroClase ?? null,
      docenteUid: _texto(docenteUid), docenteEmail: _texto(docenteEmail),
      cosechadaEn: new Date().toISOString(),
    },
    revision: { requerida: false, motivos: [] },
    active: true,
  };
};

// ─── Gate (APAGADO por defecto) ───────────────────────────────────────────────

export const getBancoGuiasGate = async () => {
  const apagado = { enabled: false };
  if (!db) return apagado;
  try {
    const snap = await getDoc(doc(db, BG_CONFIG_DOC));
    if (!snap.exists()) return apagado; // sin config = apagado
    const data = snap.data() || {};
    return { enabled: data.enabled === true }; // solo true explícito enciende
  } catch {
    return apagado; // error de lectura = apagado (fail-closed)
  }
};

// ─── Cosecha (opt-in del docente) ─────────────────────────────────────────────
// Guarda TODAS las fichas de una guía generada, con consentimiento explícito.
// Devuelve el nº de fichas cosechadas (0 si no hay consentimiento o no se puede).

export const cosecharGuia = async ({ guia, consentimiento = false }) => {
  if (consentimiento !== true) return 0; // opt-in explícito, jamás por defecto
  if (!db) return 0;
  const user = auth?.currentUser;
  if (!user) return 0;
  const fichas = _arr(guia?.fichas);
  const meta = guia?.metadatos || {};
  if (!fichas.length) return 0;

  let guardadas = 0;
  for (const ficha of fichas) {
    try {
      const doc0 = construirFichaCosechada({
        ficha, meta, docenteUid: user.uid, docenteEmail: user.email || '',
      });
      await addDoc(collection(db, BG_COLLECTION), {
        ...doc0, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      guardadas += 1;
    } catch { /* ficha no cosechable: se omite, no rompe el lote */ }
  }
  return guardadas;
};

// ─── Servicio al generador (gate apagado por defecto) ─────────────────────────
// Sirve una ficha 'validada' cuya huella coincide EXACTAMENTE con la pedida.
// Verbatim; sin fuzzy; fail-closed. Devuelve la ficha o null.

export const servirFichaPorHuella = async (huellaClave) => {
  const gate = await getBancoGuiasGate();
  if (!gate.enabled) return null; // apagado por defecto — el generador ni se entera
  if (!db || !_texto(huellaClave)) return null;
  try {
    const snap = await getDocs(query(
      collection(db, BG_COLLECTION),
      where('active', '==', true),
      where('estado', '==', 'validada'),
      where('huella.clave', '==', _texto(huellaClave)),
      limit(1),
    ));
    const d = snap.docs[0];
    if (!d) return null;
    const data = d.data() || {};
    return data.ficha || null;
  } catch (err) {
    console.error('[bancoGuias] servirFichaPorHuella:', err);
    return null; // fail-closed: ante duda, el generador sigue con IA
  }
};

// ─── Marcar una ficha servida que resultó rota (futuro: verificación) ─────────

export const marcarFichaRevision = async (docId, motivos = []) => {
  if (!db || !_texto(docId)) return;
  try {
    await updateDoc(doc(db, BG_COLLECTION, docId), {
      'revision.requerida': true,
      'revision.motivos': _arr(motivos),
      'revision.marcadaEn': serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch { /* no-fatal */ }
};

// ─── Administración (panel del admin) ─────────────────────────────────────────

// Lista fichas del banco para revisión (más recientes primero). Opcionalmente
// filtra por estado. No aplica el gate: el admin ve todo.
export const listarFichasBanco = async ({ estado = '', max = 200 } = {}) => {
  if (!db) return [];
  try {
    const filtros = [collection(db, BG_COLLECTION)];
    if (estado) filtros.push(where('estado', '==', estado));
    filtros.push(orderBy('createdAt', 'desc'), limit(max));
    const snap = await getDocs(query(...filtros));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('[bancoGuias] listarFichasBanco:', err);
    return [];
  }
};

// Cambia el estado de una ficha (cosechada → validada → retirada). Solo estados
// válidos. 'retirada' NO borra: deja el doc archivado y fuera de servicio.
export const cambiarEstadoFicha = async (docId, nuevoEstado) => {
  if (!db || !_texto(docId)) throw new Error('docId requerido');
  if (!BG_ESTADOS.includes(nuevoEstado)) throw new Error(`Estado inválido: ${nuevoEstado}`);
  await updateDoc(doc(db, BG_COLLECTION, docId), {
    estado: nuevoEstado,
    active: nuevoEstado !== 'retirada',
    updatedAt: serverTimestamp(),
  });
};

// Enciende/apaga el gate del servicio (config/banco-guias.enabled).
export const setBancoGuiasGate = async (enabled) => {
  if (!db) throw new Error('Sin base de datos');
  await setDoc(doc(db, BG_CONFIG_DOC), { enabled: enabled === true, updatedAt: serverTimestamp() }, { merge: true });
};
