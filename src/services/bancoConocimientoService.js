import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
  serverTimestamp, query, where, orderBy, limit,
} from 'firebase/firestore';
import {
  ref as storageRef, uploadBytes, getDownloadURL,
} from 'firebase/storage';
import { db, auth, storage } from '../firebase.js';

// ─── Constantes ───────────────────────────────────────────────────────────────

export const BC_SOURCE_TYPES = {
  diseno_curricular:      'Diseño Curricular',
  adecuacion_curricular:  'Adecuación Curricular',
  registro_minerd:        'Registro MINERD',
  guia_oficial:           'Guía Oficial',
  documento_institucional:'Documento Institucional',
  banco_pedagogico:       'Banco Pedagógico',
  otro:                   'Otro',
};

export const BC_BANK_TYPES = {
  oficial:    'Oficial',
  pedagogico: 'Pedagógico',
};

export const BC_LEVELS = ['Inicial', 'Primaria', 'Secundaria'];

export const BC_GRADES = ['1ro', '2do', '3ro', '4to', '5to', '6to'];

export const BC_AREAS = [
  'Lengua Española', 'Matemática', 'Ciencias Sociales',
  'Ciencias de la Naturaleza', 'Lenguas Extranjeras',
  'Educación Artística', 'Educación Física',
  'Formación Integral Humana y Religiosa', 'Otra',
];

// Áreas con múltiples asignaturas — muestra selector de asignatura en el formulario
export const BC_SUBJECTS_BY_AREA = {
  'Lenguas Extranjeras':       ['Inglés', 'Francés'],
  'Ciencias Sociales':         ['Historia', 'Geografía'],
  'Ciencias de la Naturaleza': ['Biología', 'Química', 'Física'],
};

// Mapeo asignatura → área (para búsquedas inversas)
export const BC_AREA_BY_SUBJECT = {
  'Inglés':    'Lenguas Extranjeras',
  'Francés':   'Lenguas Extranjeras',
  'Historia':  'Ciencias Sociales',
  'Geografía': 'Ciencias Sociales',
  'Biología':  'Ciencias de la Naturaleza',
  'Química':   'Ciencias de la Naturaleza',
  'Física':    'Ciencias de la Naturaleza',
};

export const BC_ORIGIN_TYPES = {
  pdf:    'PDF',
  url:    'Enlace',
  manual: 'Manual',
  json:   'JSON estructurado',
};

export const BC_CONTENT_FORMATS = {
  unstructured: { label: 'Referencia',   color: '#f1f5f9', text: '#64748b' },
  structured:   { label: 'Estructurado', color: '#dcfce7', text: '#15803d' },
};

export const BC_CONTENT_TYPES = [
  'malla_curricular', 'competencias', 'indicadores', 'contenidos', 'otro',
];

export const BC_STATUSES = {
  pending:    { label: 'Pendiente',  color: '#fef9c3', text: '#a16207' },
  processing: { label: 'Procesando', color: '#e0f2fe', text: '#0369a1' },
  reviewed:   { label: 'Revisado',   color: '#ede9fe', text: '#6d28d9' },
  approved:   { label: 'Aprobado',   color: '#dbeafe', text: '#1d4ed8' },
  published:  { label: 'Publicado',  color: '#dcfce7', text: '#15803d' },
  rejected:   { label: 'Rechazado',  color: '#fee2e2', text: '#dc2626' },
  archived:   { label: 'Archivado',  color: '#f1f5f9', text: '#64748b' },
};

const COL = 'knowledgeSources';

const currentUser = () => auth?.currentUser;

// ─── Upload PDF a Storage ─────────────────────────────────────────────────────

export const uploadKnowledgePDF = async (file) => {
  if (!storage || !file) throw new Error('Storage no disponible o archivo vacío');
  const user = currentUser();
  if (!user) throw new Error('Usuario no autenticado');

  const safeName = file.name.replace(/[^a-z0-9._-]/gi, '_');
  const path = `bancoConocimiento/pdfs/${Date.now()}_${safeName}`;
  const ref = storageRef(storage, path);
  await uploadBytes(ref, file);
  const url = await getDownloadURL(ref);
  return { url, fileName: file.name, fileSize: file.size, path };
};

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export const createKnowledgeSource = async (data) => {
  if (!db) throw new Error('Firestore no disponible');
  const user = currentUser();
  if (!user) throw new Error('Usuario no autenticado');

  const docRef = await addDoc(collection(db, COL), {
    ...data,
    status: data.status || 'pending',
    processingStatus: data.processingStatus || 'not_started',
    version: '1.0',
    active: true,
    uploadedBy: user.uid,
    uploadedByEmail: user.email,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const getKnowledgeSources = async (filters = {}) => {
  if (!db) return [];
  try {
    const constraints = [];
    if (filters.status)  constraints.push(where('status', '==', filters.status));
    if (filters.level)   constraints.push(where('level',  '==', filters.level));
    if (filters.grade)   constraints.push(where('grade',  '==', filters.grade));
    if (filters.area)    constraints.push(where('area',   '==', filters.area));
    if (filters.bankType) constraints.push(where('bankType', '==', filters.bankType));

    let snap;
    try {
      snap = await getDocs(query(
        collection(db, COL),
        ...constraints,
        orderBy('createdAt', 'desc'),
        limit(200),
      ));
    } catch {
      snap = await getDocs(query(collection(db, COL), ...constraints, limit(200)));
    }
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('[bancoConocimiento] getKnowledgeSources:', err);
    return [];
  }
};

export const updateKnowledgeSource = async (id, data) => {
  if (!db || !id) throw new Error('Parámetros inválidos');
  await updateDoc(doc(db, COL, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

export const updateKnowledgeSourceStatus = async (id, status) => {
  if (!db || !id || !status) throw new Error('Parámetros inválidos');
  await updateDoc(doc(db, COL, id), {
    status,
    updatedAt: serverTimestamp(),
  });
};

export const deleteKnowledgeSource = async (id) => {
  if (!db || !id) throw new Error('Parámetros inválidos');
  await deleteDoc(doc(db, COL, id));
};

// ─── Contenido curricular estructurado (JSON) ─────────────────────────────────

const JSON_MAX_BYTES = 900 * 1024;
const JSON_REQUIRED = ['schemaVersion', 'level', 'grade', 'area', 'subject', 'contentType'];

export const validateJsonSobre = (text) => {
  if (!text || !text.trim()) return { ok: false, error: 'El JSON no puede estar vacío.' };
  if (text.length > JSON_MAX_BYTES) {
    return { ok: false, error: `El JSON supera 900 KB (${(text.length / 1024).toFixed(0)} KB). Divídelo en archivos más pequeños antes de cargar.` };
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `JSON no válido: ${e.message}` };
  }
  const missing = JSON_REQUIRED.filter(k => parsed[k] === undefined || parsed[k] === null || parsed[k] === '');
  if (missing.length > 0) {
    return { ok: false, error: `Campos obligatorios faltantes en el sobre: ${missing.join(', ')}` };
  }
  return { ok: true, parsed };
};

export const createCurricularContent = async ({ sourceId, parsed, extractionMethod = 'manual' }) => {
  if (!db) throw new Error('Firestore no disponible');
  const user = currentUser();
  if (!user) throw new Error('Usuario no autenticado');

  const ref = await addDoc(collection(db, 'curricularContent'), {
    sourceId,
    schemaVersion: parsed.schemaVersion,
    level: parsed.level,
    cycle: parsed.cycle || null,
    grade: parsed.grade,
    area: parsed.area,
    subject: parsed.subject,
    contentType: parsed.contentType,
    payload: parsed,
    extractionMethod,
    status: 'draft',
    active: true,
    uploadedBy: user.uid,
    uploadedByEmail: user.email,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
};

export const attachJsonToSource = async (sourceId, jsonText) => {
  if (!db || !sourceId) throw new Error('Parámetros inválidos');
  const validation = validateJsonSobre(jsonText);
  if (!validation.ok) throw new Error(validation.error);

  const contentId = await createCurricularContent({ sourceId, parsed: validation.parsed });

  await updateDoc(doc(db, COL, sourceId), {
    contentFormat: 'structured',
    processingStatus: 'structured',
    schemaVersion: validation.parsed.schemaVersion,
    extractionMethod: 'manual',
    updatedAt: serverTimestamp(),
  });

  return contentId;
};

// ─── Consulta de malla curricular para el motor generador ─────────────────────

export const getCurricularContentForUnit = async (subject, grade) => {
  if (!db || !subject) return null;

  const norm = (s) => (s || '').toLowerCase().trim()
    .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
    .replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ñ/g, 'n');

  // "5to Secundaria" → "5to", "6to Primaria" → "6to"
  const normGrade = (g) => norm(g)
    .replace(/\s+(primaria|secundaria|inicial|bachillerato)\b.*/g, '').trim();

  try {
    const snap = await getDocs(query(
      collection(db, 'curricularContent'),
      where('active', '==', true),
      limit(200),
    ));
    if (snap.empty) return null;

    const ns  = norm(subject);
    const ng  = normGrade(grade);
    const npa = norm(BC_AREA_BY_SUBJECT[subject] || '');

    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const candidates = docs.filter(d => {
      const ds = norm(d.subject);
      const da = norm(d.area);
      return ds === ns || da === ns || ds === npa || da === npa;
    });
    if (!candidates.length) return null;

    return candidates.find(d => normGrade(d.grade) === ng) || candidates[0];
  } catch (err) {
    if (err?.code === 'permission-denied') {
      console.error(
        '[curricularContent] Permiso denegado — publica las reglas de Firestore: ' +
        'Firebase Console → Firestore → Rules → pega firestore.rules → Publish.',
        err,
      );
    } else {
      console.error('[curricularContent] getCurricularContentForUnit:', err);
    }
    return null;
  }
};
