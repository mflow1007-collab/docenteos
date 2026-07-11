import {
  collection, addDoc, getDocs, getDoc, doc, updateDoc, deleteDoc,
  serverTimestamp, query, where, orderBy, limit, writeBatch,
} from 'firebase/firestore';
import {
  ref as storageRef, uploadBytes, getDownloadURL,
} from 'firebase/storage';
import { db, auth, storage } from '../firebase.js';
import {
  SCHEMA_VERSION_CANONICA,
  PLACEHOLDERS_PROHIBIDOS,
  localizarPlaceholdersProhibidos,
  validateCurricularDoc,
} from './curricularSchema.js';

// Re-export para compatibilidad: la fuente única del contrato es curricularSchema.js
export { PLACEHOLDERS_PROHIBIDOS, localizarPlaceholdersProhibidos, validateCurricularDoc };

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
  'Ciencias Sociales':         ['Ciencias Sociales', 'Geografía', 'Historia', 'Moral y Cívica'],
  'Ciencias de la Naturaleza': ['Ciencias de la Naturaleza', 'Biología', 'Química', 'Física'],
};

// Mapeo asignatura → área (para búsquedas inversas)
export const BC_AREA_BY_SUBJECT = {
  'Inglés':                  'Lenguas Extranjeras',
  'Francés':                 'Lenguas Extranjeras',
  'Ciencias Sociales':       'Ciencias Sociales',
  'Geografía':               'Ciencias Sociales',
  'Historia':                'Ciencias Sociales',
  'Moral y Cívica':          'Ciencias Sociales',
  'Ciencias de la Naturaleza':'Ciencias de la Naturaleza',
  'Biología':                'Ciencias de la Naturaleza',
  'Química':                 'Ciencias de la Naturaleza',
  'Física':                  'Ciencias de la Naturaleza',
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
  'malla_curricular', 'registro_minerd', 'competencias', 'indicadores', 'contenidos', 'otro',
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

// Guards de fuente↔contenido. Devuelve null cuando las fuentes no se pueden
// leer (reglas, red): null = "sin información de guards" → NO se filtra y
// NUNCA se bloquea al docente por esta capa (la clave estricta de resolución
// nivel+grado+subject+contentType sigue aplicando siempre).
const getActiveMallaSourceGuards = async () => {
  if (!db) return null;
  try {
    const snap = await getDocs(query(
      collection(db, COL),
      where('active', '==', true),
      limit(500),
    ));
    const guards = { sourceIds: new Set(), contentIds: new Set(), contentToSource: new Map() };
    snap.docs.forEach((d) => {
      const source = { id: d.id, ...d.data() };
      const sourceType = normCascade(source.contentType || source.structuredPayload?.contentType || '');
      const isMalla = sourceType === 'malla curricular' || Boolean(source.curricularContentId);
      if (!isMalla) return;
      guards.sourceIds.add(source.id);
      if (source.curricularContentId) {
        const contentId = String(source.curricularContentId);
        guards.contentIds.add(contentId);
        guards.contentToSource.set(contentId, source.id);
      }
    });
    return guards;
  } catch (err) {
    console.warn('[bancoConocimiento] guards ilegibles (no se filtra por fuente):', err?.code || err?.message);
    return null;
  }
};

// Exportada para tests. Regla: el contenido es visible si (a) una fuente
// activa lo referencia por curricularContentId (backlink), o (b) HUÉRFANO
// RESCATADO: su propio sourceId apunta a una fuente-malla activa (docs
// creados antes de que existiera el backlink). guards null → no filtrar.
//
// FAIL-OPEN por diseño: este guard es una capa de HIGIENE (ocultar mallas
// cuya fuente fue archivada), NO un candado de seguridad. Una malla que está
// active:true y no está vinculada a NINGUNA fuente archivada es utilizable —
// jamás se oculta una malla activa por un backlink imperfecto (bloquear al
// docente por plomería interna contradice "nunca bloquear"). Solo se filtra
// cuando la evidencia es CLARA: el backlink apunta a una fuente distinta de
// la activa esperada.
export const hasActiveMallaSource = (docItem = {}, guards) => {
  if (!guards) return true;
  const id = String(docItem.id || '');
  const sourceId = String(docItem.sourceId || '');
  // (a) Backlink desde una fuente activa: visible (salvo conflicto explícito).
  if (id && guards.contentIds.has(id)) {
    const expectedSourceId = guards.contentToSource.get(id);
    return !expectedSourceId || !sourceId || sourceId === expectedSourceId;
  }
  // (b) Huérfano rescatado: su sourceId apunta a una fuente-malla activa.
  if (sourceId && guards.sourceIds.has(sourceId)) return true;
  // (c) La malla apunta a una fuente que NO está activa (fue archivada) →
  // ocultar: es la higiene que este guard existe para hacer.
  if (sourceId && !guards.sourceIds.has(sourceId)) return false;
  // (d) Malla activa SIN sourceId (o sin fuente registrada): no hay evidencia
  // de que esté archivada → fail-open, es utilizable. Cubre mallas creadas por
  // conversión de PDF cuyo backlink de fuente no se registró en los guards.
  return true;
};

export const getAvailableCurricularScopes = async () => {
  if (!db) return [];
  try {
    const guards = await getActiveMallaSourceGuards();
    const snap = await getDocs(query(
      collection(db, 'curricularContent'),
      where('active', '==', true),
      limit(500),
    ));
    const map = new Map();
    snap.docs.forEach((d) => {
      const data = { id: d.id, ...d.data() };
      const payload = data.payload || {};
      const contentType = data.contentType || payload.contentType || '';
      if (normCascade(contentType) !== 'malla curricular') return;
      if (!hasActiveMallaSource(data, guards)) return;
      const item = {
        id: data.id,
        sourceId: data.sourceId || '',
        level: cleanText(data.level || payload.level || payload.nivel),
        cycle: cleanText(data.cycle || payload.cycle || payload.ciclo),
        grade: cleanText(data.grade || payload.grade || payload.grado),
        area: cleanText(data.area || payload.area),
        subject: cleanText(data.subject || payload.subject || payload.asignatura),
        contentType: 'malla_curricular',
      };
      if (!item.level || !item.grade || !item.area || !item.subject) return;
      const key = [item.level, item.grade, item.area, item.subject].map(normCascade).join('|');
      if (!map.has(key)) map.set(key, item);
    });
    return [...map.values()].sort((a, b) =>
      `${a.level} ${a.grade} ${a.area} ${a.subject}`.localeCompare(`${b.level} ${b.grade} ${b.area} ${b.subject}`, 'es')
    );
  } catch (err) {
    console.error('[bancoConocimiento] getAvailableCurricularScopes:', err);
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

const CASCADE_DELETABLE_CONTENT_TYPES = new Set([
  'malla curricular',
  'competencias',
  'indicadores',
  'contenidos',
  'enriquecimiento tema',
]);

const normCascade = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ');

const sameCurricularScope = (a = {}, b = {}) => (
  normCascade(a.level || a.nivel) === normCascade(b.level || b.nivel) &&
  normCascade(a.grade || a.grado) === normCascade(b.grade || b.grado) &&
  normCascade(a.area) === normCascade(b.area) &&
  normCascade(a.subject || a.asignatura) === normCascade(b.subject || b.asignatura)
);

const shouldCascadeCurricular = (item = {}) => {
  const type = normCascade(item.contentType || item.payload?.contentType || '');
  const sourceType = normCascade(item.sourceType || '');
  return CASCADE_DELETABLE_CONTENT_TYPES.has(type)
    || sourceType === 'diseno curricular'
    || Boolean(item.curricularContentId);
};

// Regla DocenteOS "nunca destructivo": la cascada ARCHIVA (active:false +
// status archived), no borra físicamente. Todo lector del flujo filtra
// active==true, así que el efecto operativo es idéntico — pero reversible
// desde la consola si se archivó una fuente equivocada.
const archiveRefsInBatches = async (refs = [], razon = 'cascade') => {
  const unique = [];
  const seen = new Set();
  refs.forEach((ref) => {
    if (!ref?.path || seen.has(ref.path)) return;
    seen.add(ref.path);
    unique.push(ref);
  });

  const marca = {
    active: false,
    status: 'archived',
    archivedAt: serverTimestamp(),
    archivedBy: currentUser()?.uid || null,
    archiveReason: razon,
  };
  for (let i = 0; i < unique.length; i += 450) {
    const batch = writeBatch(db);
    unique.slice(i, i + 450).forEach((ref) => batch.update(ref, marca));
    await batch.commit();
  }
  return unique.length;
};

export const deleteKnowledgeSource = async (id) => {
  if (!db || !id) throw new Error('Parámetros inválidos');
  const sourceRef = doc(db, COL, id);
  const sourceSnap = await getDoc(sourceRef);
  if (!sourceSnap.exists()) {
    return { deletedSources: 0, deletedCurricularContent: 0 };
  }

  const source = { id: sourceSnap.id, ...sourceSnap.data() };
  const refsSources = [sourceRef];
  const refsCurricular = [];

  if (source.curricularContentId) {
    refsCurricular.push(doc(db, 'curricularContent', String(source.curricularContentId)));
  }

  // Siempre archiva el contenido que nació de esta fuente.
  const ownContentSnap = await getDocs(query(
    collection(db, 'curricularContent'),
    where('sourceId', '==', id),
    limit(200),
  ));
  ownContentSnap.docs.forEach((d) => refsCurricular.push(d.ref));

  // Para mallas curriculares: ARCHIVAR todo el alcance exacto
  // nivel+grado+area+asignatura. Evita mallas fantasma si se cargó un JSON
  // equivocado, sin destruir datos (reversible poniendo active:true).
  if (shouldCascadeCurricular(source) && source.level && source.grade && source.area && source.subject) {
    const [sourcesByGrade, contentByGrade] = await Promise.all([
      getDocs(query(collection(db, COL), where('grade', '==', source.grade), limit(300))),
      getDocs(query(collection(db, 'curricularContent'), where('grade', '==', source.grade), limit(300))),
    ]);

    sourcesByGrade.docs.forEach((d) => {
      const data = { id: d.id, ...d.data() };
      if (sameCurricularScope(data, source) && shouldCascadeCurricular(data)) {
        refsSources.push(d.ref);
      }
    });

    contentByGrade.docs.forEach((d) => {
      const data = { id: d.id, ...d.data() };
      const payload = data.payload || {};
      const scope = {
        level: data.level || payload.level || payload.nivel,
        grade: data.grade || payload.grade || payload.grado,
        area: data.area || payload.area,
        subject: data.subject || payload.subject || payload.asignatura,
      };
      const type = data.contentType || payload.contentType;
      const derivedFromSelected = [source.curricularContentId, source.id]
        .filter(Boolean)
        .map(String)
        .includes(String(payload.derivedFrom || data.derivedFrom || ''));

      if ((sameCurricularScope(scope, source) && shouldCascadeCurricular({ ...data, contentType: type }))
        || derivedFromSelected) {
        refsCurricular.push(d.ref);
      }
    });
  }

  const deletedSources = await archiveRefsInBatches(refsSources, `archivo de fuente ${id}`);
  const deletedCurricularContent = await archiveRefsInBatches(refsCurricular, `cascada de fuente ${id}`);
  // Nombres de retorno conservados por compatibilidad: son ARCHIVADOS
  return { deletedSources, deletedCurricularContent };
};

// Borrado DEFINITIVO (no reversible): elimina la fuente y su curricularContent
// de Firestore. Para cuando el admin quiere reemplazar una malla y NO dejar
// residuos archivados que confundan. Distinto de deleteKnowledgeSource (que
// archiva). Solo la fuente elegida y su contenido propio — sin cascada.
export const purgeKnowledgeSource = async (id) => {
  if (!db || !id) throw new Error('Parámetros inválidos');
  const sourceRef = doc(db, COL, id);
  const sourceSnap = await getDoc(sourceRef);
  if (!sourceSnap.exists()) return { deletedSources: 0, deletedCurricularContent: 0 };
  const source = { id: sourceSnap.id, ...sourceSnap.data() };

  const contentRefs = [];
  if (source.curricularContentId) {
    contentRefs.push(doc(db, 'curricularContent', String(source.curricularContentId)));
  }
  // También el contenido que nació de esta fuente (por si el backlink faltó)
  try {
    const own = await getDocs(query(
      collection(db, 'curricularContent'),
      where('sourceId', '==', id),
      limit(200),
    ));
    own.docs.forEach((d) => contentRefs.push(d.ref));
  } catch { /* no-fatal */ }

  let deletedCurricularContent = 0;
  const vistos = new Set();
  for (const ref of contentRefs) {
    if (vistos.has(ref.path)) continue;
    vistos.add(ref.path);
    try { await deleteDoc(ref); deletedCurricularContent += 1; } catch { /* ignora */ }
  }
  await deleteDoc(sourceRef);
  return { deletedSources: 1, deletedCurricularContent };
};

// ─── Contenido curricular estructurado (JSON) ─────────────────────────────────

// Fix auditoría 2026-07-04: 700 KB (antes 900 KB). La normalización duplica
// arrays (indicadores/temas/contenidos.items), así que el doc final en
// curricularContent puede crecer ~30-40% — 900 KB rozaba el límite de 1 MB.
const JSON_MAX_BYTES = 700 * 1024;
const JSON_REQUIRED = ['schemaVersion', 'level', 'grade', 'area', 'subject', 'contentType'];
const PACKAGE_MODULE_ALIASES = {
  metadata: 'metadata',
  competencias: 'competencias',
  indicadores: 'indicadores',
  contenidos: 'contenidos',
  temas: 'temas',
  vocabulario: 'vocabulario',
  gramatica: 'gramatica',
  gramática: 'gramatica',
  funciones_comunicativas: 'funcionesComunicativas',
  funcionescomunicativas: 'funcionesComunicativas',
  estrategias: 'estrategias',
  evidencias: 'evidencias',
  instrumentos: 'instrumentos',
  evaluacion: 'evaluacion',
  evaluación: 'evaluacion',
  planificacion: 'planificacion',
  planificación: 'planificacion',
  calendario: 'calendario',
  relaciones: 'relaciones',
};

const asArray = (value) => Array.isArray(value) ? value : [];

const cleanText = (value) => String(value || '').trim();

const firstArray = (...values) => values.find(Array.isArray) || [];

const uniqueCleanTexts = (items = []) => {
  const seen = new Set();
  return items.map(cleanText).filter((item) => {
    if (!item) return false;
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const toModuleKey = (fileName = '') => {
  const base = String(fileName).split('/').pop().replace(/\.json$/i, '');
  const normalized = base.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return PACKAGE_MODULE_ALIASES[normalized] || normalized;
};

const getModuleArray = (module, key) => {
  if (Array.isArray(module)) return module;
  if (!module || typeof module !== 'object') return [];
  return firstArray(module[key], module.items, module.data, module.payload);
};

const flattenStringItems = (items, nestedKeys = []) => asArray(items).flatMap((item) => {
  if (typeof item === 'string') return [cleanText(item)].filter(Boolean);
  if (!item || typeof item !== 'object') return [];
  for (const key of nestedKeys) {
    if (Array.isArray(item[key])) return flattenStringItems(item[key], nestedKeys);
  }
  return [cleanText(item.nombre || item.descripcion || item.texto || item.estructura || item.funcion)]
    .filter(Boolean);
});

const flattenVocabulario = (items) => flattenStringItems(items, ['palabras', 'vocabulario', 'items']);

const flattenFrases = (items) => flattenStringItems(items, ['frases', 'expresiones', 'items']);

const flattenGramatica = (items) => asArray(items).flatMap((item) => {
  if (typeof item === 'string') return [item];
  if (!item || typeof item !== 'object') return [];
  if (Array.isArray(item.estructuras)) return flattenGramatica(item.estructuras);
  if (Array.isArray(item.gramatica)) return flattenGramatica(item.gramatica);
  return cleanText(item.estructura || item.nombre || item.descripcion || item.texto);
}).filter(Boolean);

const flattenFunciones = (items) => flattenStringItems(items, ['funciones', 'funcionesComunicativas', 'items']);

// Fix auditoría 2026-07-04: contar SOLO campos reales del registro. Antes
// también sumaba instrumentosSugeridos/evidenciasEsperadas (datos de malla),
// con lo que un "registro" sin datos de registro podía marcar verde.
const contarRegistroMinerd = (registro = {}) => [
  ...asArray(registro?.campos),
  ...asArray(registro?.momentosEvaluacion),
  ...asArray(registro?.tiposEvidencia),
  ...asArray(registro?.criterios),
  ...asArray(registro?.calificaciones),
  ...asArray(registro?.asistencia),
  ...asArray(registro?.observaciones),
].length;

const normalizeContenidoModulo = (contenidos = {}) => {
  const conceptuales = firstArray(
    contenidos.conceptuales,
    contenidos.conceptos,
    contenidos?.contenidos?.conceptuales,
  ).map(cleanText).filter(Boolean);
  const procedimentales = firstArray(
    contenidos.procedimentales,
    contenidos.procedimientos,
    contenidos?.contenidos?.procedimentales,
  ).map(cleanText).filter(Boolean);
  const actitudinales = firstArray(
    contenidos.actitudinales,
    contenidos.actitudes,
    contenidos.actitudesValores,
    contenidos?.contenidos?.actitudesValores,
    contenidos?.contenidos?.actitudinales,
  ).map(cleanText).filter(Boolean);

  return { conceptuales, procedimentales, actitudinales };
};

export const construirPaqueteCurricularJson = (archivos = []) => {
  const modules = {};
  const errores = [];

  for (const archivo of archivos) {
    const name = archivo?.name || '';
    const key = toModuleKey(name);
    if (!key) continue;
    if (modules[key]) {
      errores.push(`Módulo duplicado: ${name}`);
      continue;
    }
    modules[key] = archivo.json;
  }

  if (!modules.metadata) {
    errores.push('Falta metadata.json: sin ese archivo no se puede detectar nivel, grado, área ni asignatura.');
  }

  const metadata = modules.metadata?.metadata || modules.metadata || {};
  const competencias = getModuleArray(modules.competencias, 'competencias');
  const indicadores = getModuleArray(modules.indicadores, 'indicadores');
  const temas = getModuleArray(modules.temas, 'temas');
  const vocabulario = flattenVocabulario(getModuleArray(modules.vocabulario, 'vocabulario'));
  const gramatica = flattenGramatica(getModuleArray(modules.gramatica, 'gramatica'));
  const funcionesComunicativas = flattenFunciones(getModuleArray(modules.funcionesComunicativas, 'funcionesComunicativas'));
  const estrategias = getModuleArray(modules.estrategias, 'estrategias');
  const evidencias = getModuleArray(modules.evidencias, 'evidencias');
  const instrumentos = getModuleArray(modules.instrumentos, 'instrumentos');
  const relaciones = modules.relaciones || {};
  const contenidosModulo = normalizeContenidoModulo(modules.contenidos);
  const contenidosGenerales = {
    conceptuales: contenidosModulo.conceptuales.length
      ? contenidosModulo.conceptuales
      : [...vocabulario, ...gramatica],
    procedimentales: contenidosModulo.procedimentales.length
      ? contenidosModulo.procedimentales
      : funcionesComunicativas,
    actitudinales: contenidosModulo.actitudinales,
  };

  const paquete = {
    // Respeta la versión que declare el material; si no trae, la CANÓNICA.
    // Jamás estampar una versión inventada (el default '2.0' aquí fue el
    // origen de los docs v2.0 que el generador no sabía leer).
    schemaVersion: cleanText(metadata.schemaVersion || metadata.schema_version || SCHEMA_VERSION_CANONICA),
    level: cleanText(metadata.level || metadata.nivel),
    cycle: cleanText(metadata.cycle || metadata.ciclo),
    grade: cleanText(metadata.grade || metadata.grado),
    area: cleanText(metadata.area),
    subject: cleanText(metadata.subject || metadata.asignatura),
    asignatura: cleanText(metadata.asignatura || metadata.subject),
    contentType: 'malla_curricular',
    nivelMCERL: cleanText(metadata.mcerl || metadata.nivelMCERL || metadata.nivelDominio),
    versionCurriculo: cleanText(metadata.versionCurriculo || metadata.version || metadata.revision),
    fuente: metadata.fuente || metadata.ministerio || 'MINERD',
    competencias,
    indicadoresLogro: indicadores,
    indicadores,
    temas,
    temasCurriculares: temas,
    contenidosGenerales,
    contenidos: {
      conceptos: {
        temas,
        vocabulario,
        gramatica,
        items: contenidosGenerales.conceptuales,
      },
      procedimientos: {
        funcionales: funcionesComunicativas.length ? funcionesComunicativas : contenidosGenerales.procedimentales,
        items: contenidosGenerales.procedimentales,
      },
      actitudinales: contenidosGenerales.actitudinales,
    },
    estrategiasSugeridas: estrategias,
    evidenciasEsperadas: evidencias,
    instrumentosSugeridos: instrumentos,
    evaluacion: modules.evaluacion || null,
    planificacion: modules.planificacion || null,
    calendario: modules.calendario || null,
    relaciones,
    paquete: {
      tipo: 'schema2_modular',
      modulos: Object.keys(modules).sort(),
      archivos: archivos.map(a => a.name).filter(Boolean).sort(),
      errores,
    },
  };

  return paquete;
};

const normalizeContentLists = (contenidos = {}) => ({
  conceptuales: asArray(contenidos.conceptuales).map(cleanText).filter(Boolean),
  procedimentales: asArray(contenidos.procedimentales).map(cleanText).filter(Boolean),
  actitudinales: asArray(contenidos.actitudinales).map(cleanText).filter(Boolean),
  actitudesValores: asArray(contenidos.actitudesValores || contenidos.actitudinales).map(cleanText).filter(Boolean),
});

const normalizeIndicator = (indicator, comp = {}, index = 0) => {
  if (typeof indicator === 'string') {
    return {
      id: `${comp.id || 'IL'}-${index + 1}`,
      descripcion: cleanText(indicator),
      texto: cleanText(indicator),
      competenciaId: comp.id || null,
      competenciaFundamental: comp.competenciaFundamental || comp.fundamental || null,
    };
  }

  const descripcion = cleanText(indicator?.descripcion || indicator?.texto || indicator?.description);
  return {
    ...indicator,
    id: cleanText(indicator?.id) || `${comp.id || 'IL'}-${index + 1}`,
    descripcion,
    texto: cleanText(indicator?.texto || descripcion),
    competenciaId: indicator?.competenciaId || comp.id || null,
    competenciaFundamental: indicator?.competenciaFundamental || comp.competenciaFundamental || comp.fundamental || null,
  };
};

const normalizeCompetencia = (comp = {}) => {
  const descripcion = cleanText(comp.descripcion || comp.especificaGrado || comp.especifica || comp.description);
  return {
    ...comp,
    id: cleanText(comp.id),
    descripcion,
    especifica: cleanText(comp.especifica || descripcion),
    especificaGrado: cleanText(comp.especificaGrado || comp.especifica || descripcion),
    competenciaFundamental: cleanText(comp.competenciaFundamental || comp.fundamental),
    indicadoresLogro: asArray(comp.indicadoresLogro || comp.indicadores)
      .map((ind, index) => normalizeIndicator(ind, comp, index))
      .filter(ind => ind.descripcion || ind.texto),
    contenidos: normalizeContentLists(comp.contenidos),
  };
};

const normalizeAporteCompetencia = (aporte = {}) => {
  const porGrado = aporte.competenciasEspecificasPorGrado || aporte.competenciasPorGrado || {};
  const buscarGrado = (grado) => {
    const objetivo = cleanText(grado).toLowerCase();
    const aliases = {
      '1ro': ['1ro', 'primero', 'primer'],
      '2do': ['2do', 'segundo'],
      '3ro': ['3ro', 'tercero', 'tercer'],
      '4to': ['4to', 'cuarto'],
      '5to': ['5to', 'quinto'],
      '6to': ['6to', 'sexto'],
    }[objetivo] || [objetivo];
    const match = Object.entries(porGrado).find(([key]) => {
      const k = cleanText(key).toLowerCase();
      return aliases.some(alias => k.includes(alias));
    });
    return cleanText(match?.[1]);
  };
  return {
    competenciaFundamental: cleanText(aporte.competenciaFundamental || aporte.fundamental),
    competenciaEspecificaCiclo: cleanText(aporte.competenciaEspecificaCiclo || aporte.especificaCiclo),
    competenciasEspecificasPorGrado: {
      '1ro': buscarGrado('1ro'),
      '2do': buscarGrado('2do'),
      '3ro': buscarGrado('3ro'),
      '4to': buscarGrado('4to'),
      '5to': buscarGrado('5to'),
      '6to': buscarGrado('6to'),
    },
    criteriosEvaluacion: uniqueCleanTexts(flattenStringItems(aporte.criteriosEvaluacion || aporte.criterios || [])),
  };
};

const normalizeEjeTransversal = (eje = {}) => {
  if (typeof eje === 'string') {
    return { eje: '', descripcion: cleanText(eje), grado: '', origen: 'conexion_ejes_transversales' };
  }
  return {
    ...eje,
    eje: cleanText(eje.eje || eje.nombre || eje.titulo),
    descripcion: cleanText(eje.descripcion || eje.texto || eje.contenido),
    grado: cleanText(eje.grado),
    origen: cleanText(eje.origen || 'conexion_ejes_transversales'),
  };
};

const normalizeContenidoPorTema = (bloque = {}) => {
  const texto = (value) => cleanText(
    typeof value === 'string'
      ? value
      : value?.descripcion || value?.texto || value?.nombre || value?.titulo || value?.valor || value?.estructura || value?.funcion
  );
  const lista = (value) => {
    const items = Array.isArray(value) ? value : (value ? [value] : []);
    return uniqueCleanTexts(items.map(texto).filter(Boolean));
  };
  const conceptos = bloque?.conceptos || {};
  const procedimientos = bloque?.procedimientos || {};
  const tema = cleanText(bloque?.tema || conceptos?.tema || conceptos?.nombre);
  return {
    tema,
    conceptos: {
      temas: lista(conceptos.temas?.length ? conceptos.temas : (tema ? [tema] : [])),
      vocabulario: lista(conceptos.vocabulario),
      gramatica: lista(conceptos.gramatica || conceptos.gramática),
      frases: lista(conceptos.frases || conceptos.expresiones),
      sociolinguisticos: lista(
        conceptos.sociolinguisticos || conceptos.sociolingüísticos || conceptos.socioculturales || conceptos.sociolinguisticosSocioculturales
      ),
    },
    procedimientos: {
      funcionales: lista(procedimientos.funcionales),
      discursivos: lista(procedimientos.discursivos),
      comprensionOralEscrita: lista(
        procedimientos.comprensionOralEscrita || procedimientos.comprensiónOralEscrita || procedimientos.comprension || procedimientos.comprensión
      ),
      produccionOral: lista(procedimientos.produccionOral || procedimientos.producciónOral),
      produccionEscrita: lista(procedimientos.produccionEscrita || procedimientos.producciónEscrita),
      items: lista(procedimientos.items),
    },
    actitudinales: lista(bloque.actitudinales || bloque.actitudesValores),
    actitudesValores: lista(bloque.actitudesValores || bloque.actitudinales),
  };
};

export const normalizeCurricularJson = (raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;

  const payload = raw.payload && typeof raw.payload === 'object' && !Array.isArray(raw.payload)
    ? raw.payload
    : {};
  const metadata = raw.metadata || payload.metadata || {};
  const source = Object.keys(payload).length ? payload : raw.curriculoOficial || raw;
  const sourceMetadata = source.metadata || metadata;
  const contenidosFuente = source.contenidos || raw.contenidos || {};
  const contenidosPorTema = asArray(
    source.contenidosPorTema || raw.contenidosPorTema || contenidosFuente.contenidosPorTema
  ).map(normalizeContenidoPorTema)
    .filter(bloque => bloque.tema);
  const temasDesdeBloques = contenidosPorTema.map(bloque => bloque.tema).filter(Boolean);
  const vocabularioDesdeBloques = contenidosPorTema.flatMap(bloque => bloque.conceptos.vocabulario || []);
  const frasesDesdeBloques = contenidosPorTema.flatMap(bloque => bloque.conceptos.frases || []);
  const gramaticaDesdeBloques = contenidosPorTema.flatMap(bloque => bloque.conceptos.gramatica || []);
  const sociolinguisticosDesdeBloques = contenidosPorTema.flatMap(bloque => bloque.conceptos.sociolinguisticos || []);
  const funcionalesDesdeBloques = contenidosPorTema.flatMap(bloque => bloque.procedimientos.funcionales || []);
  const discursivosDesdeBloques = contenidosPorTema.flatMap(bloque => bloque.procedimientos.discursivos || []);
  const comprensionDesdeBloques = contenidosPorTema.flatMap(bloque => bloque.procedimientos.comprensionOralEscrita || []);
  const produccionOralDesdeBloques = contenidosPorTema.flatMap(bloque => bloque.procedimientos.produccionOral || []);
  const produccionEscritaDesdeBloques = contenidosPorTema.flatMap(bloque => bloque.procedimientos.produccionEscrita || []);
  const procedimientosItemsDesdeBloques = contenidosPorTema.flatMap(bloque => bloque.procedimientos.items || []);
  const actitudesDesdeBloques = contenidosPorTema.flatMap(bloque => [
    ...(bloque.actitudinales || []),
    ...(bloque.actitudesValores || []),
  ]);
  const vocabularioFuente = flattenVocabulario(firstArray(
    source.vocabulario,
    raw.vocabulario,
    contenidosFuente?.conceptos?.vocabulario,
    vocabularioDesdeBloques,
  ));
  const frasesFuente = flattenFrases(firstArray(
    source.frases,
    source.expresiones,
    raw.frases,
    raw.expresiones,
    contenidosFuente?.conceptos?.frases,
    contenidosFuente?.conceptos?.expresiones,
    frasesDesdeBloques,
  ));
  const gramaticaFuente = flattenGramatica(firstArray(
    source.gramatica,
    source.gramática,
    raw.gramatica,
    raw.gramática,
    contenidosFuente?.conceptos?.gramatica,
    gramaticaDesdeBloques,
  ));
  const funcionesFuente = flattenFunciones(firstArray(
    source.funcionesComunicativas,
    source.funciones_comunicativas,
    raw.funcionesComunicativas,
    raw.funciones_comunicativas,
    contenidosFuente?.procedimientos?.funcionales,
    funcionalesDesdeBloques,
  ));
  const contenidosBase = normalizeContentLists(source.contenidosGenerales || raw.contenidosGenerales || {});
  const temasConceptualesFuente = flattenStringItems(firstArray(
    source.temas,
    source.temasCurriculares,
    raw.temas,
    raw.temasCurriculares,
    contenidosFuente?.conceptos?.temas,
    temasDesdeBloques,
  ));
  const contenidosGenerales = {
    conceptuales: uniqueCleanTexts([
      ...contenidosBase.conceptuales,
      ...temasConceptualesFuente,
      ...frasesFuente,
      ...vocabularioFuente,
      ...gramaticaFuente,
      ...sociolinguisticosDesdeBloques,
    ]),
    procedimentales: contenidosBase.procedimentales.length
      ? contenidosBase.procedimentales
      : uniqueCleanTexts([
          ...funcionesFuente,
          ...discursivosDesdeBloques,
          ...comprensionDesdeBloques,
          ...produccionOralDesdeBloques,
          ...produccionEscritaDesdeBloques,
          ...procedimientosItemsDesdeBloques,
        ]),
    actitudinales: uniqueCleanTexts([
      ...contenidosBase.actitudinales,
      ...contenidosBase.actitudesValores,
      ...actitudesDesdeBloques,
    ]),
    actitudesValores: uniqueCleanTexts([
      ...contenidosBase.actitudinales,
      ...contenidosBase.actitudesValores,
      ...actitudesDesdeBloques,
    ]),
  };
  const competencias = asArray(source.competencias || raw.competencias).map(normalizeCompetencia);
  const aportesCompetenciasFundamentales = asArray(
    source.aportesCompetenciasFundamentales || raw.aportesCompetenciasFundamentales
  ).map(normalizeAporteCompetencia)
    .filter(aporte => aporte.competenciaFundamental || aporte.competenciaEspecificaCiclo);
  const ejesTransversales = asArray(
    source.ejesTransversales || raw.ejesTransversales
  ).map(normalizeEjeTransversal)
    .filter(eje => eje.eje || eje.descripcion);
  const indicadoresDesdeCompetencias = competencias.flatMap(comp =>
    asArray(comp.indicadoresLogro).map(ind => ({
      ...ind,
      competenciaId: ind.competenciaId || comp.id || null,
      competenciaDescripcion: comp.descripcion || null,
      competenciaFundamental: ind.competenciaFundamental || comp.competenciaFundamental || comp.fundamental || null,
    }))
  );
  const indicadoresPlanos = asArray(source.indicadoresLogro || source.indicadores || raw.indicadoresLogro || raw.indicadores)
    .map((ind, index) => normalizeIndicator(ind, {}, index))
    .filter(ind => ind.descripcion || ind.texto);
  const indicadoresLogro = indicadoresPlanos.length ? indicadoresPlanos : indicadoresDesdeCompetencias;
  const temasFuente = firstArray(
    source.temas,
    source.temasCurriculares,
    raw.temas,
    raw.temasCurriculares,
    contenidosFuente?.conceptos?.temas,
    temasDesdeBloques,
  );
  const temasBase = temasFuente.length ? temasFuente : contenidosGenerales.conceptuales;
  const temas = temasBase.map((tema) =>
    typeof tema === 'string' ? cleanText(tema) : tema
  ).filter(Boolean);
  const registroMINERD = source.registroMINERD || raw.registroMINERD || source.registro || raw.registro || null;
  const tipoDeclarado = cleanText(raw.contentType || source.contentType || 'malla_curricular');
  const debeSerRegistro = tipoDeclarado === 'malla_curricular'
    && contarRegistroMinerd(registroMINERD) > 0
    && !indicadoresLogro.length
    && !temasFuente.length;
  const contentType = debeSerRegistro ? 'registro_minerd' : tipoDeclarado;

  const conceptosFuente = contenidosFuente?.conceptos || {};
  const procedimientosFuente = contenidosFuente?.procedimientos || {};
  const contenidosNormalizados = {
    ...contenidosFuente,
    conceptos: {
      ...conceptosFuente,
      temas: asArray(conceptosFuente.temas).length ? conceptosFuente.temas : temas,
      frases: frasesFuente.length
        ? frasesFuente
        : firstArray(conceptosFuente.frases, conceptosFuente.expresiones),
      vocabulario: vocabularioFuente.length
        ? vocabularioFuente
        : asArray(conceptosFuente.vocabulario),
      gramatica: gramaticaFuente.length
        ? gramaticaFuente
        : asArray(conceptosFuente.gramatica),
      items: asArray(conceptosFuente.items).length
        ? conceptosFuente.items
        : contenidosGenerales.conceptuales,
    },
    procedimientos: {
      ...procedimientosFuente,
      funcionales: funcionesFuente.length
        ? funcionesFuente
        : asArray(procedimientosFuente.funcionales),
      items: asArray(procedimientosFuente.items).length
        ? procedimientosFuente.items
        : contenidosGenerales.procedimentales,
    },
    actitudinales: firstArray(contenidosFuente.actitudinales, contenidosFuente.actitudesValores).length
      ? firstArray(contenidosFuente.actitudinales, contenidosFuente.actitudesValores)
      : contenidosGenerales.actitudinales,
    actitudesValores: firstArray(contenidosFuente.actitudesValores, contenidosFuente.actitudinales).length
      ? firstArray(contenidosFuente.actitudesValores, contenidosFuente.actitudinales)
      : contenidosGenerales.actitudesValores,
  };

  return {
    ...raw,
    schemaVersion: cleanText(raw.schemaVersion || source.schemaVersion || raw.version || source.version || '1.0'),
    level: cleanText(raw.level || raw.nivel || source.level || source.nivel || sourceMetadata.level || sourceMetadata.nivel),
    cycle: cleanText(raw.cycle || raw.ciclo || source.cycle || source.ciclo || sourceMetadata.cycle || sourceMetadata.ciclo),
    grade: cleanText(raw.grade || raw.grado || source.grade || source.grado || sourceMetadata.grade || sourceMetadata.grado),
    area: cleanText(raw.area || source.area || sourceMetadata.area),
    subject: cleanText(raw.subject || raw.asignatura || source.subject || source.asignatura || sourceMetadata.subject || sourceMetadata.asignatura || raw.area || source.area),
    asignatura: cleanText(raw.asignatura || raw.subject || source.asignatura || source.subject || sourceMetadata.asignatura || sourceMetadata.subject || raw.area || source.area),
    contentType,
    title: cleanText(raw.title || raw.titulo || source.title || source.titulo),
    description: cleanText(raw.description || raw.descripcion || source.description || source.descripcion),
    nivelMCERL: cleanText(raw.nivelMCERL || raw.nivelDominio || source.nivelMCERL || source.nivelDominio || sourceMetadata.mcerl || sourceMetadata.nivelMCERL),
    competenciasFundamentales: uniqueCleanTexts([
      ...asArray(source.competenciasFundamentales),
      ...asArray(raw.competenciasFundamentales),
      ...aportesCompetenciasFundamentales.map(aporte => aporte.competenciaFundamental).filter(Boolean),
    ]),
    marcoPedagogico: source.marcoPedagogico || raw.marcoPedagogico || null,
    aportesCompetenciasFundamentales,
    ejesTransversales,
    ejeTematicoTransversal: firstArray(
      source.ejeTematicoTransversal,
      source.ejeTemáticoTransversal,
      raw.ejeTematicoTransversal,
      raw.ejeTemáticoTransversal,
      ejesTransversales.map(eje => [eje.eje, eje.descripcion].filter(Boolean).join(': ')),
    ),
    competencias,
    indicadoresLogro,
    indicadores: indicadoresLogro,
    temas,
    temasCurriculares: temas,
    contenidosGenerales,
    contenidos: contenidosNormalizados,
    contenidosPorTema,
    vocabulario: vocabularioFuente,
    frases: frasesFuente,
    gramatica: gramaticaFuente,
    funcionesComunicativas: funcionesFuente,
    registroMINERD: contentType === 'registro_minerd' ? registroMINERD : null,
    auditoriaLiteralPdf: source.auditoriaLiteralPdf || raw.auditoriaLiteralPdf || null,
    textoLiteralMalla: source.textoLiteralMalla || raw.textoLiteralMalla || '',
    textoLiteralContextoAreaCiclo: source.textoLiteralContextoAreaCiclo || raw.textoLiteralContextoAreaCiclo || '',
    textoLiteralSeleccionado: source.textoLiteralSeleccionado || raw.textoLiteralSeleccionado || '',
    paginasLiterales: asArray(source.paginasLiterales || raw.paginasLiterales),
    contenidosRaw: source.contenidosRaw || raw.contenidosRaw || source.textoLiteralMalla || raw.textoLiteralMalla || '',
  };
};

export const analizarJsonCurricular = (parsed) => {
  const esRegistro = parsed?.contentType === 'registro_minerd';
  const conceptuales = [
    ...asArray(parsed?.contenidosGenerales?.conceptuales),
    ...asArray(parsed?.contenidos?.conceptos?.temas),
    ...asArray(parsed?.contenidos?.conceptos?.frases),
    ...asArray(parsed?.contenidos?.conceptos?.vocabulario),
    ...asArray(parsed?.contenidos?.conceptos?.gramatica),
    ...asArray(parsed?.contenidos?.conceptos?.items),
  ];
  const procedimentales = [
    ...asArray(parsed?.contenidosGenerales?.procedimentales),
    ...asArray(parsed?.contenidos?.procedimientos?.funcionales),
    ...asArray(parsed?.contenidos?.procedimientos?.items),
  ];
  const actitudinales = [
    ...asArray(parsed?.contenidosGenerales?.actitudinales),
    ...asArray(parsed?.contenidosGenerales?.actitudesValores),
    ...asArray(parsed?.contenidos?.actitudinales),
    ...asArray(parsed?.contenidos?.actitudesValores),
    ...asArray(parsed?.contenidos?.actitudes),
  ];
  const indicadores = asArray(parsed?.indicadoresLogro).length
    ? asArray(parsed.indicadoresLogro)
    : asArray(parsed?.indicadores);
  const temas = asArray(parsed?.temas).length ? asArray(parsed.temas) : asArray(parsed?.temasCurriculares);
  const ejeTematicoTransversal = asArray(parsed?.ejeTematicoTransversal || parsed?.ejeTemáticoTransversal);
  const aportesCompetenciasFundamentales = asArray(parsed?.aportesCompetenciasFundamentales);
  const ejesTransversales = asArray(parsed?.ejesTransversales);
  const criteriosEvaluacion = [
    ...aportesCompetenciasFundamentales.flatMap(aporte => asArray(aporte?.criteriosEvaluacion)),
    ...asArray(parsed?.criteriosEvaluacion),
  ];
  const tieneRaw = Boolean(cleanText(parsed?.contenidosRaw));
  const registroMINERD = parsed?.registroMINERD || parsed?.registro || {};
  const conteoRegistro = esRegistro ? contarRegistroMinerd(registroMINERD) : 0;

  const requisitos = esRegistro ? [
    { id: 'metadata', label: 'Identificación del registro', count: JSON_REQUIRED.filter(k => parsed?.[k]).length, required: JSON_REQUIRED.length },
    { id: 'registro', label: 'Datos del Registro MINERD', count: conteoRegistro, required: 1 },
  ].map(item => ({ ...item, ok: item.count >= item.required })) : [
    { id: 'metadata', label: 'Identificación curricular', count: JSON_REQUIRED.filter(k => parsed?.[k]).length, required: JSON_REQUIRED.length },
    { id: 'competencias', label: 'Competencias', count: asArray(parsed?.competencias).length, required: 1 },
    { id: 'indicadores', label: 'Indicadores de logro', count: indicadores.length, required: 1 },
    { id: 'temas', label: 'Temas oficiales', count: temas.length, required: 1 },
    { id: 'conceptuales', label: 'Contenidos conceptuales', count: conceptuales.length, required: 1 },
    { id: 'procedimentales', label: 'Contenidos procedimentales', count: procedimentales.length, required: 1 },
  ].map(item => ({ ...item, ok: item.count >= item.required }));

  const faltantes = requisitos.filter(item => !item.ok).map(item => item.label);
  const advertencias = [];
  if (parsed?.paquete?.errores?.length) advertencias.push(...parsed.paquete.errores);
  if (tieneRaw && (!conceptuales.length || !procedimentales.length)) {
    advertencias.push('Trae contenidosRaw, pero todavía no están separados en contenidos estructurados.');
  }

  return {
    tipoDetectado: esRegistro
      ? `Registro MINERD de ${parsed?.subject || 'asignatura'} ${parsed?.grade || ''}`.trim()
      : parsed?.contentType === 'malla_curricular'
      ? `Malla curricular de ${parsed?.subject || 'asignatura'} ${parsed?.grade || ''}`.trim()
      : parsed?.contentType || 'JSON curricular',
    listoParaGenerador: faltantes.length === 0,
    faltantes,
    advertencias,
    requisitos,
    conteos: {
      competencias: asArray(parsed?.competencias).length,
      indicadores: indicadores.length,
      temas: temas.length,
      conceptuales: conceptuales.length,
      procedimentales: procedimentales.length,
      actitudinales: actitudinales.length,
      modulos: asArray(parsed?.paquete?.modulos).length,
      ejeTematicoTransversal: ejeTematicoTransversal.length,
      ejesTransversales: ejesTransversales.length,
      aportesCompetenciasFundamentales: aportesCompetenciasFundamentales.length,
      criteriosEvaluacion: criteriosEvaluacion.length,
      marcoPedagogico: parsed?.marcoPedagogico ? 1 : 0,
      registroMINERD: conteoRegistro,
    },
  };
};

// ─── Guard de subida ─────────────────────────────────────────────────────────
// La higiene de placeholders y el contrato canónico viven en curricularSchema.js
// (fuente única). Aquí solo se aplican: capa ESTRICTA — lo que viola el
// contrato no entra al Banco.

export const validateJsonSobre = (text) => {
  if (!text || !text.trim()) return { ok: false, error: 'El JSON no puede estar vacío.' };
  if (text.length > JSON_MAX_BYTES) {
    return { ok: false, error: `El JSON supera 700 KB (${(text.length / 1024).toFixed(0)} KB). Divídelo en archivos más pequeños antes de cargar.` };
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `JSON no válido: ${e.message}` };
  }
  parsed = normalizeCurricularJson(parsed);
  const analysis = analizarJsonCurricular(parsed);
  const missing = JSON_REQUIRED.filter(k => parsed[k] === undefined || parsed[k] === null || parsed[k] === '');
  if (missing.length > 0) {
    return {
      ok: false,
      parsed,
      analysis,
      error: `Campos obligatorios faltantes en el JSON curricular: ${missing.join(', ')}. ` +
        `Se acepta el formato DocenteOS o el formato MINERD con nivel, grado, area y asignatura.`,
    };
  }

  if (!analysis.listoParaGenerador) {
    const esRegistro = parsed.contentType === 'registro_minerd';
    return {
      ok: false,
      parsed,
      analysis,
      error: esRegistro
        ? `El registro fue leído, pero aún no trae datos suficientes: ${analysis.faltantes.join(', ')}.`
        : `El JSON fue leído, pero aún no tiene todo lo que solicita el generador: ${analysis.faltantes.join(', ')}.`,
    };
  }

  // Contrato canónico (curricularSchema.js): placeholders, schemaVersion,
  // competencias/indicadores asociables, contenidos por columna — con ruta exacta.
  const contrato = validateCurricularDoc(parsed);
  if (!contrato.ok) {
    const detalle = contrato.violaciones.slice(0, 6).map((h) => `${h.ruta} → ${h.mensaje}`).join(' · ');
    return {
      ok: false,
      parsed,
      analysis,
      violaciones: contrato.violaciones,
      error: `El JSON no cumple el contrato curricular (${contrato.violaciones.length} violación${contrato.violaciones.length === 1 ? '' : 'es'}): ${detalle}` +
        `${contrato.violaciones.length > 6 ? ` (+${contrato.violaciones.length - 6} más)` : ''}. Corrígelo (o usa Potente IA) y vuelve a cargarlo.`,
    };
  }

  return { ok: true, parsed, analysis, violaciones: [] };
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

/**
 * Resumen ligero del payload para el doc de la fuente (knowledgeSources).
 * Fix auditoría 2026-07-04: guardar el payload completo DOS veces (fuente +
 * curricularContent) acercaba los documentos al límite de 1 MB de Firestore.
 * El payload completo vive solo en curricularContent; la fuente guarda conteos.
 */
export const resumenPayloadCurricular = (parsed) => {
  const analysis = analizarJsonCurricular(parsed);
  return {
    tipoDetectado: analysis.tipoDetectado,
    listoParaGenerador: analysis.listoParaGenerador,
    conteos: analysis.conteos,
    temas: asArray(parsed?.temas)
      .slice(0, 30)
      .map(t => (typeof t === 'string' ? t : cleanText(t?.titulo || t?.nombre)))
      .filter(Boolean),
  };
};

export const attachJsonToSource = async (sourceId, jsonText) => {
  if (!db || !sourceId) throw new Error('Parámetros inválidos');
  const validation = validateJsonSobre(jsonText);
  if (!validation.ok) throw new Error(validation.error);

  const esRegistro = validation.parsed.contentType === 'registro_minerd';
  let contentId = null;
  if (!esRegistro) {
    // Cada guardado crea un curricularContent NUEVO (addDoc). Antes de crear el
    // nuevo, DESACTIVAR los anteriores de esta misma fuente: si no, quedan varios
    // docs active:true con el mismo sourceId y el generador (getCurricular-
    // ContentForUnit) puede leer el VIEJO — el usuario ve "el JSON no se
    // actualiza" aunque su guardado sí subió. Fix reemplazo de malla desde Potente IA.
    try {
      const previos = await getDocs(query(
        collection(db, 'curricularContent'),
        where('sourceId', '==', sourceId),
        limit(200),
      ));
      await Promise.all(previos.docs
        .filter((d) => d.data()?.active !== false)
        .map((d) => updateDoc(d.ref, { active: false, supersededAt: serverTimestamp() }).catch(() => {})));
    } catch { /* si falla la desactivación, seguimos: el nuevo será el más reciente */ }

    contentId = await createCurricularContent({ sourceId, parsed: validation.parsed });
  }

  await updateDoc(doc(db, COL, sourceId), {
    contentFormat: 'structured',
    processingStatus: 'structured',
    schemaVersion: validation.parsed.schemaVersion,
    contentType: validation.parsed.contentType,
    curricularContentId: contentId,
    payloadResumen: resumenPayloadCurricular(validation.parsed),
    // Los registros MINERD no van a curricularContent: la fuente es su único
    // almacenamiento, por eso conservan el payload completo (son pequeños).
    ...(esRegistro ? { structuredPayload: validation.parsed } : {}),
    extractionMethod: 'manual',
    updatedAt: serverTimestamp(),
  });

  return contentId;
};

// ─── Coincidencia de grado escolar (scope del banco ↔ catálogo de la UI) ─────
// Los docs traen variantes reales ("1er", "Secundario") que no coinciden por
// etiqueta exacta con el catálogo ("1ro Secundaria"). Se compara por NÚMERO de
// grado + nivel normalizado; sin número (Kínder...), por texto normalizado.
// Exportada para tests.

export const esMismoGradoEscolar = (scope = {}, gradoLabel = '', nivelLabel = '') => {
  const nivelScope = bcNormalizarNivel(scope.level || scope.nivel || '') || bcNivelDesdeGrado(scope.grade || scope.grado || '');
  const nivelSel = bcNormalizarNivel(nivelLabel) || bcNivelDesdeGrado(gradoLabel);
  if (!nivelScope || !nivelSel || nivelScope !== nivelSel) return false;
  const gradoScope = String(scope.grade || scope.grado || '');
  const numScope = (gradoScope.match(/\d+/) || [''])[0];
  const numSel = (String(gradoLabel).match(/\d+/) || [''])[0];
  if (numScope && numSel) return numScope === numSel;
  return bcNormGrade(gradoScope) === bcNormGrade(gradoLabel);
};

// ─── Temas oficiales de la malla (FUENTE ÚNICA del selector y del motor) ─────
// SOLO los temas oficiales del MINERD: payload.temas → payload.temasCurriculares
// → payload.contenidos.conceptos.temas (fallbacks SECUENCIALES, nunca mezcla).
// Los contenidos (estructuras gramaticales, vocabulario, items) JAMÁS se
// ofrecen como temas.

const _textoTema = (t) => {
  if (typeof t === 'string') return t.trim();
  if (!t || typeof t !== 'object') return '';
  return String(t.nombre || t.tema || t.titulo || t.title || '').trim();
};

export const temasOficialesDeMalla = (docOrPayload) => {
  const payload = docOrPayload?.payload || docOrPayload || {};
  const fuentes = [
    payload.temas,
    payload.temasCurriculares,
    payload.contenidos?.conceptos?.temas,
  ];
  for (const fuente of fuentes) {
    if (Array.isArray(fuente) && fuente.length) {
      const temas = [...new Set(fuente.map(_textoTema).filter(Boolean))];
      if (temas.length) return temas;
    }
  }
  return [];
};

// ─── Consulta de malla curricular para el motor generador ─────────────────────
//
// CLAVE DE RESOLUCIÓN ESTRICTA: (level, grade, subject, contentType) — los
// cuatro, siempre. La normalización de grado ("1ro Secundaria" → "1ro") NO
// puede cruzar niveles: pedir 1ro de PRIMARIA jamás resuelve la malla de 1ro
// de SECUNDARIA. Sin malla del nivel solicitado → null → candado caso (a).

const bcNorm = (s) => (s || '').toLowerCase().trim()
  .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
  .replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ñ/g, 'n');

// "5to Secundaria" → "5to", "6to Primaria" → "6to"
const bcNormGrade = (g) => bcNorm(g)
  .replace(/\s+(primaria|secundaria|inicial|bachillerato)\b.*/g, '').trim();

// "Secundario"/"Secundaria"/"secundaria" → "secundaria" (idem primaria/inicial)
const bcNormalizarNivel = (v) => {
  const n = bcNorm(v);
  if (n.includes('secundari')) return 'secundaria';
  if (n.includes('primari')) return 'primaria';
  if (n.includes('inicial') || n.includes('preprimari')) return 'inicial';
  return n;
};

// Fallback: extraer el nivel cuando viene dentro del grado ("1ro Secundaria")
const bcNivelDesdeGrado = (g) => {
  const n = bcNorm(g);
  if (n.includes('secundari')) return 'secundaria';
  if (n.includes('primari')) return 'primaria';
  if (n.includes('inicial') || n.includes('kinder') || n.includes('preprimari')) return 'inicial';
  return '';
};

/**
 * Selector PURO de malla (testeable sin Firestore): entre docs candidatos ya
 * filtrados por subject/area, elige el que coincide en contentType
 * (malla_curricular), NIVEL y grado. Clave incompleta o sin coincidencia
 * de nivel → null (fail closed: el candado detiene, nunca hereda otro nivel).
 */
export const seleccionarMallaParaUnidad = (docs, { nivel = '', grado = '' } = {}) => {
  const ng = bcNormGrade(grado);
  // El nivel EMBEBIDO en el grado que eligió el docente ("1ro Primaria") MANDA
  // sobre el parámetro nivel, que puede llegar rancio desde un formulario cuyo
  // campo Nivel no se sincronizó (bypass real detectado en el Asesor).
  const nn = bcNivelDesdeGrado(grado) || bcNormalizarNivel(nivel);
  if (!ng || !nn) return null;
  return (docs || []).find((d) => {
    const tipo = bcNorm(d.contentType || d.payload?.contentType || 'malla_curricular');
    if (tipo !== 'malla_curricular') return false;
    const nivelDoc = bcNormalizarNivel(d.level || d.payload?.level || d.payload?.nivel);
    if (!nivelDoc || nivelDoc !== nn) return false;
    return bcNormGrade(d.grade) === ng;
  }) || null;
};

// ─── Capa 2 opcional: enriquecimiento_tema (tema oficial → subconjunto) ──────
// Doc curricularContent con contentType "enriquecimiento_tema" cuyo
// payload.derivedFrom apunta al id/contentId de la malla. Dato derivado y
// OPCIONAL: si no existe o la consulta falla, se devuelve null y el flujo
// sigue con el nivel-grado completo (nunca bloquea).

const buscarEnriquecimientoTema = async (mallaDoc) => {
  if (!db || !mallaDoc?.id) return null;
  try {
    const snap = await getDocs(query(
      collection(db, 'curricularContent'),
      where('contentType', '==', 'enriquecimiento_tema'),
      limit(20),
    ));
    const objetivos = new Set(
      [mallaDoc.id, mallaDoc.contentId, mallaDoc.payload?.contentId]
        .filter(Boolean).map((v) => String(v).trim())
    );
    const encontrado = (snap?.docs || [])
      .map((d) => ({ id: d.id, ...d.data() }))
      .find((d) => d.active !== false
        && objetivos.has(String(d.payload?.derivedFrom || d.derivedFrom || '').trim()));
    return encontrado || null;
  } catch {
    return null; // Capa 2 opcional — su fallo jamás detiene la generación
  }
};

export const getCurricularContentForUnit = async (subject, grade, nivel = '') => {
  if (!db || !subject) return null;

  const norm = bcNorm;

  try {
    const guards = await getActiveMallaSourceGuards();
    // Fix auditoría 2026-07-04: primero consultas dirigidas por subject/area
    // exactos (docs con payloads grandes — el escaneo de 200 docs completos en
    // cada generación era caro). El escaneo amplio queda solo como fallback
    // para docs con subject/area escritos distinto.
    const consultas = [
      query(collection(db, 'curricularContent'), where('active', '==', true), where('subject', '==', subject), limit(20)),
    ];
    const areaDeSubject = BC_AREA_BY_SUBJECT[subject];
    if (areaDeSubject) {
      consultas.push(query(collection(db, 'curricularContent'), where('active', '==', true), where('area', '==', areaDeSubject), limit(20)));
    }
    const resultados = await Promise.all(consultas.map(q => getDocs(q).catch(() => null)));
    const vistos = new Map();
    for (const res of resultados) {
      res?.docs?.forEach(d => { if (!vistos.has(d.id)) vistos.set(d.id, d); });
    }
    let docsSnap = [...vistos.values()];

    if (!docsSnap.length) {
      const snap = await getDocs(query(
        collection(db, 'curricularContent'),
        where('active', '==', true),
        limit(200),
      ));
      if (snap.empty) return null;
      docsSnap = snap.docs;
    }

    const ns  = norm(subject);
    const npa = norm(BC_AREA_BY_SUBJECT[subject] || '');

    const docs = docsSnap.map(d => {
      const data = { id: d.id, ...d.data() };
      const payload = normalizeCurricularJson(data.payload || data);
      return {
        ...data,
        schemaVersion: data.schemaVersion || payload.schemaVersion,
        level: data.level || payload.level,
        cycle: data.cycle || payload.cycle,
        grade: data.grade || payload.grade,
        area: data.area || payload.area,
        subject: data.subject || payload.subject,
        contentType: data.contentType || payload.contentType,
        payload,
      };
    });

    const candidates = docs.filter(d => {
      if (!hasActiveMallaSource(d, guards)) return false;
      const ds = norm(d.subject || d.payload?.subject || d.payload?.asignatura);
      const da = norm(d.area || d.payload?.area);
      return ds === ns || da === ns || ds === npa || da === npa;
    });
    if (!candidates.length) return null;

    // Regla estricta DocenteOS: la planificación solo puede usar la malla del
    // NIVEL y grado seleccionados (clave completa: level+grade+subject+
    // contentType). No se cae a otro grado ni a otro nivel de la misma área.
    const malla = seleccionarMallaParaUnidad(candidates, { nivel, grado: grade });
    if (!malla) return null;

    // Capa TOLERANTE del contrato: el lector NO bloquea docs históricos, pero
    // deja ADVERTENCIA con ruta exacta para corregirlos en Potente IA. Los
    // candados del generador siguen deteniendo lo que no se puede generar.
    const contrato = validateCurricularDoc(malla);
    if (!contrato.ok) {
      console.warn(
        `[curricularContent] Malla ${malla.id} (schemaVersion=${malla.schemaVersion || '?'}) ` +
        `viola el contrato curricular en ${contrato.violaciones.length} punto(s) — corrígela en Potente IA:`,
        contrato.violaciones.map((h) => `${h.ruta}: ${h.mensaje}`),
      );
    }

    // Capa 2 opcional: enriquecimiento_tema derivado de ESTA malla
    // (payload.derivedFrom === id/contentId). Su ausencia nunca bloquea.
    malla.enriquecimientoTema = await buscarEnriquecimientoTema(malla);
    return malla;
  } catch (err) {
    if (err?.code === 'permission-denied') {
      // Re-throw: el caller debe mostrar este mensaje exacto, no degradar a "malla vacía"
      throw new Error(
        'Sin acceso al contenido curricular — verifica las reglas de Firestore ' +
        '(curricularContent: allow read: if request.auth != null;). ' +
        'Firebase Console → Firestore → Rules → pega firestore.rules → Publish.',
        { cause: err },
      );
    }
    console.error('[curricularContent] getCurricularContentForUnit:', err);
    return null;
  }
};
