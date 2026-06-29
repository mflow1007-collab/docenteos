/**
 * Banco Pedagógico DocenteOS — Servicio Firestore
 * Colecciones: bp_temas, bp_actividades, bp_instrumentos, bp_recursos, bp_neae
 * Estados: draft → pending → approved → official → obsolete
 */

import {
  collection, doc, addDoc, updateDoc, getDocs, getDoc,
  query, where, orderBy, limit, serverTimestamp, deleteDoc,
} from 'firebase/firestore';
import { db } from '../firebase.js';

export const BP_ESTADOS = ['draft', 'pending', 'approved', 'official', 'obsolete'];
export const BP_AREAS = [
  'Lenguas Extranjeras', 'Lengua Española', 'Matemática',
  'Ciencias de la Naturaleza', 'Ciencias Sociales',
  'Educación Artística', 'Educación Física',
  'Formación Integral Humana y Religiosa',
];
export const BP_NIVELES = ['Inicial', 'Primaria', 'Secundaria'];
export const BP_GRADOS = [
  'Pre-Kínder', 'Kínder', 'Preprimario',
  '1ro Primaria', '2do Primaria', '3ro Primaria',
  '4to Primaria', '5to Primaria', '6to Primaria',
  '1ro Secundaria', '2do Secundaria', '3ro Secundaria',
  '4to Secundaria', '5to Secundaria', '6to Secundaria',
];
export const BP_TIPOS_ACTIVIDAD = [
  'Listening', 'Speaking', 'Reading', 'Writing',
  'Grammar', 'Vocabulary', 'Proyecto', 'Juego', 'Role Play',
  'Investigación', 'Debate', 'Exposición', 'Otro',
];
export const BP_MOMENTOS = ['Inicio', 'Desarrollo', 'Cierre'];
export const BP_TIPOS_INSTRUMENTO = [
  'Rúbrica analítica', 'Lista de cotejo', 'Escala de valoración',
  'Registro anecdótico', 'Prueba escrita', 'Coevaluación', 'Autoevaluación',
];
export const BP_TIPOS_RECURSO = [
  'Video', 'Audio', 'Flashcards', 'Worksheet', 'Reading text',
  'Presentación digital', 'Juego interactivo', 'Imagen/Lámina', 'Otro',
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

const col = (nombre) => collection(db, nombre);

const toArray = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

const metaCrear = (userId) => ({
  estado: 'draft',
  creadoPor: userId || 'admin',
  creadoEn: serverTimestamp(),
  actualizadoEn: serverTimestamp(),
  aprobadoPor: null,
  aprobadoEn: null,
});

const metaActualizar = () => ({ actualizadoEn: serverTimestamp() });

// ─── bp_temas ──────────────────────────────────────────────────────────────────

export const getTemas = async ({ estado = null, area = null } = {}) => {
  try {
    let q = query(col('bp_temas'), orderBy('actualizadoEn', 'desc'), limit(200));
    const snap = await getDocs(q);
    let items = toArray(snap);
    if (estado) items = items.filter((t) => t.estado === estado);
    if (area)   items = items.filter((t) => t.area === area);
    return items;
  } catch {
    return [];
  }
};

export const createTema = async (data, userId) => {
  const ref = await addDoc(col('bp_temas'), {
    titulo: '',
    descripcion: '',
    area: '',
    niveles: [],
    grados: [],
    temasRelacionados: [],
    ...data,
    ...metaCrear(userId),
  });
  return ref.id;
};

export const updateTema = async (id, data) => {
  await updateDoc(doc(db, 'bp_temas', id), { ...data, ...metaActualizar() });
};

// ─── bp_actividades ────────────────────────────────────────────────────────────

export const getActividades = async ({ estado = null, area = null, tipo = null, momento = null } = {}) => {
  try {
    const q = query(col('bp_actividades'), orderBy('actualizadoEn', 'desc'), limit(300));
    const snap = await getDocs(q);
    let items = toArray(snap);
    if (estado)   items = items.filter((a) => a.estado === estado);
    if (area)     items = items.filter((a) => a.area === area);
    if (tipo)     items = items.filter((a) => a.tipo === tipo);
    if (momento)  items = items.filter((a) => a.momento === momento);
    return items;
  } catch {
    return [];
  }
};

export const createActividad = async (data, userId) => {
  const ref = await addDoc(col('bp_actividades'), {
    titulo: '',
    tipo: '',
    momento: 'Desarrollo',
    instrucciones: [],
    area: '',
    grados: [],
    temas: [],
    competencia: '',
    habilidades: [],
    duracion: 15,
    estrategia: '',
    versionDe: null,
    usosTotal: 0,
    valoracion: 0,
    ...data,
    ...metaCrear(userId),
  });
  return ref.id;
};

export const updateActividad = async (id, data) => {
  await updateDoc(doc(db, 'bp_actividades', id), { ...data, ...metaActualizar() });
};

// ─── bp_instrumentos ───────────────────────────────────────────────────────────

export const getInstrumentos = async ({ estado = null, area = null } = {}) => {
  try {
    const q = query(col('bp_instrumentos'), orderBy('actualizadoEn', 'desc'), limit(200));
    const snap = await getDocs(q);
    let items = toArray(snap);
    if (estado) items = items.filter((i) => i.estado === estado);
    if (area)   items = items.filter((i) => i.area === area);
    return items;
  } catch {
    return [];
  }
};

export const createInstrumento = async (data, userId) => {
  const ref = await addDoc(col('bp_instrumentos'), {
    titulo: '',
    tipo: '',
    area: '',
    grados: [],
    temas: [],
    contenido: '',
    criterios: [],
    ...data,
    ...metaCrear(userId),
  });
  return ref.id;
};

export const updateInstrumento = async (id, data) => {
  await updateDoc(doc(db, 'bp_instrumentos', id), { ...data, ...metaActualizar() });
};

// ─── bp_recursos ───────────────────────────────────────────────────────────────

export const getRecursos = async ({ estado = null, area = null } = {}) => {
  try {
    const q = query(col('bp_recursos'), orderBy('actualizadoEn', 'desc'), limit(200));
    const snap = await getDocs(q);
    let items = toArray(snap);
    if (estado) items = items.filter((r) => r.estado === estado);
    if (area)   items = items.filter((r) => r.area === area);
    return items;
  } catch {
    return [];
  }
};

export const createRecurso = async (data, userId) => {
  const ref = await addDoc(col('bp_recursos'), {
    titulo: '',
    tipo: '',
    descripcion: '',
    area: '',
    grados: [],
    temas: [],
    url: '',
    ...data,
    ...metaCrear(userId),
  });
  return ref.id;
};

export const updateRecurso = async (id, data) => {
  await updateDoc(doc(db, 'bp_recursos', id), { ...data, ...metaActualizar() });
};

// ─── bp_neae ───────────────────────────────────────────────────────────────────

export const getNeae = async ({ estado = null, area = null } = {}) => {
  try {
    const q = query(col('bp_neae'), orderBy('actualizadoEn', 'desc'), limit(200));
    const snap = await getDocs(q);
    let items = toArray(snap);
    if (estado) items = items.filter((n) => n.estado === estado);
    if (area)   items = items.filter((n) => n.area === area);
    return items;
  } catch {
    return [];
  }
};

export const createNeae = async (data, userId) => {
  const ref = await addDoc(col('bp_neae'), {
    titulo: '',
    perfil: '',
    area: '',
    grados: [],
    temas: [],
    adaptacionAcceso: '',
    adaptacionMetodologica: '',
    adaptacionEvaluacion: '',
    ...data,
    ...metaCrear(userId),
  });
  return ref.id;
};

export const updateNeae = async (id, data) => {
  await updateDoc(doc(db, 'bp_neae', id), { ...data, ...metaActualizar() });
};

// ─── Estado (compartido para todas las colecciones) ───────────────────────────

export const cambiarEstado = async (coleccion, id, nuevoEstado, adminId) => {
  const extra = ['approved', 'official'].includes(nuevoEstado)
    ? { aprobadoPor: adminId || 'admin', aprobadoEn: serverTimestamp() }
    : {};
  await updateDoc(doc(db, coleccion, id), {
    estado: nuevoEstado,
    ...extra,
    ...metaActualizar(),
  });
};

export const eliminarBP = async (coleccion, id) => {
  await deleteDoc(doc(db, coleccion, id));
};

// ─── Consulta para el BIC (buscar actividades oficiales por tema/área/grado) ──

export const buscarActividadesBP = async ({ area, grados = [], temas = [], momento = null } = {}) => {
  try {
    const q = query(
      col('bp_actividades'),
      where('estado', '==', 'official'),
      where('area', '==', area),
      limit(50)
    );
    const snap = await getDocs(q);
    let items = toArray(snap);
    if (grados.length)  items = items.filter((a) => a.grados?.some((g) => grados.includes(g)));
    if (temas.length)   items = items.filter((a) => a.temas?.some((t) => temas.includes(t)));
    if (momento)        items = items.filter((a) => a.momento === momento);
    return items;
  } catch {
    return [];
  }
};
