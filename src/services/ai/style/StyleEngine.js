/**
 * StyleEngine — Motor de estilo pedagógico.
 *
 * Extrae patrones pedagógicos de planificaciones existentes y los usa
 * como plantilla para generar nuevas planificaciones con el mismo estilo
 * pero diferente tema.
 *
 * Colección: ke_estilos/{templateId}
 */

import { db } from "../../../firebase.js";
import { getAuth } from "firebase/auth";
import {
  collection, doc, addDoc, getDoc, getDocs,
  setDoc, serverTimestamp,
} from "firebase/firestore";
import { COLLECTIONS, STATES, STYLE_VISIBILITY } from "../knowledge/KnowledgeTypes.js";
import { AIService } from "../AIService.js";

const SYSTEM_ESTILO =
  "Eres DocenteOS, experto en análisis de estilos pedagógicos del sistema educativo dominicano. " +
  "Analiza la planificación y extrae su estructura, patrones y estilo pedagógico. " +
  "Responde ÚNICAMENTE con un objeto JSON válido sin texto adicional.";

function _uid() {
  return getAuth().currentUser?.uid ?? null;
}

// ── API pública ────────────────────────────────────────────────────────────────

/**
 * Extrae el estilo pedagógico de un texto de planificación y lo guarda en Firestore.
 *
 * @param {string} planificacionTexto - Texto completo de la planificación a analizar
 * @param {Object} metadata
 * @param {string} metadata.uid            - UID del docente propietario
 * @param {string} metadata.nombre         - Nombre descriptivo de la plantilla
 * @param {string} metadata.asignatura
 * @param {string} metadata.grado
 * @param {string} metadata.temaOriginal
 * @returns {Promise<{ templateId: string, estilo: Object }>}
 */
export async function extractStyle(planificacionTexto, metadata = {}) {
  const prompt =
    "Analiza esta planificación docente y extrae su estructura pedagógica.\n\n" +
    "PLANIFICACIÓN:\n" +
    planificacionTexto +
    "\n\nDevuelve ÚNICAMENTE este JSON con los valores extraídos:\n" +
    JSON.stringify({
      estructuraDetectada:    "describe la estructura general (ej: 4 semanas, 4 días, 3 momentos)",
      patronesRedaccion:      "describe el estilo de redacción usado",
      patronesActividades:    "tipos de actividades que se repiten",
      patronesEvaluacion:     "cómo evalúa el docente",
      patronesMetacognicion:  "cómo cierra las sesiones o unidades",
      semanasDetectadas:      0,
      momentosDetectados:     ["Inicio", "Desarrollo", "Cierre"],
    });

  // Llamada síncrona a IA — acumulamos la respuesta completa antes de parsear
  let textoCompleto = "";
  let errorIA = null;

  await new Promise((resolve) => {
    AIService.generate({
      module: "style-extractor",
      prompt,
      system:    SYSTEM_ESTILO,
      maxTokens: 800,
      onChunk:   (chunk) => { textoCompleto += chunk; },
      onFinish:  () => resolve(),
      onError:   (err) => { errorIA = err; resolve(); },
    });
  });

  if (errorIA) throw new Error(`[StyleEngine] Error en IA al extraer estilo: ${errorIA}`);

  let estilo;
  try {
    const json = textoCompleto.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "");
    estilo = JSON.parse(json);
  } catch {
    // Si la IA no devolvió JSON válido, construir un objeto mínimo
    estilo = {
      estructuraDetectada:   textoCompleto.slice(0, 200),
      patronesRedaccion:     "",
      patronesActividades:   "",
      patronesEvaluacion:    "",
      patronesMetacognicion: "",
      semanasDetectadas:     0,
      momentosDetectados:    [],
    };
  }

  if (!db) return { templateId: null, estilo };

  const uid = metadata.uid ?? _uid();

  const payload = {
    uid,
    nombre:       metadata.nombre      ?? "Plantilla sin nombre",
    asignatura:   metadata.asignatura  ?? null,
    grado:        metadata.grado       ?? null,
    temaOriginal: metadata.temaOriginal ?? null,
    estilo,
    estado:       STATES.PENDING,
    visibilidad:  STYLE_VISIBILITY.PRIVATE,
    creadoEn:     serverTimestamp(),
    actualizadoEn: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, COLLECTIONS.KE_ESTILOS), payload);

  if (import.meta.env.DEV) {
    console.debug("[StyleEngine] extractStyle guardado", { templateId: ref.id, uid });
  }

  return { templateId: ref.id, estilo };
}

/**
 * Genera una nueva planificación replicando el estilo de una plantilla con un tema nuevo.
 *
 * NO copia texto — replica el patrón pedagógico (estructura, momentos, tipos de actividades).
 *
 * @param {string} templateId - ID de la plantilla en ke_estilos
 * @param {string} nuevoTema  - Tema para la nueva planificación
 * @param {Object} metadata
 * @param {string}   [metadata.grado]
 * @param {string}   [metadata.asignatura]
 * @param {Function} metadata.onChunk
 * @param {Function} metadata.onFinish
 * @param {Function} metadata.onError
 */
export async function replicarConEstilo(templateId, nuevoTema, metadata = {}) {
  const { onChunk, onFinish, onError } = metadata;

  if (!db) {
    onError?.("[StyleEngine] Firestore no disponible");
    return;
  }

  const snap = await getDoc(doc(db, COLLECTIONS.KE_ESTILOS, templateId));
  if (!snap.exists()) {
    onError?.(`[StyleEngine] Plantilla no encontrada: ${templateId}`);
    return;
  }

  const { estilo, asignatura, grado } = snap.data();

  const prompt =
    "Genera una planificación docente NUEVA para el tema indicado, " +
    "replicando EXACTAMENTE el patrón pedagógico de la plantilla (no el contenido).\n\n" +
    "TEMA NUEVO: " + nuevoTema + "\n" +
    (metadata.grado       ?? grado       ? `GRADO: ${metadata.grado ?? grado}\n`             : "") +
    (metadata.asignatura  ?? asignatura  ? `ASIGNATURA: ${metadata.asignatura ?? asignatura}\n` : "") +
    "\nPATRÓN PEDAGÓGICO A REPLICAR:\n" +
    `- Estructura: ${estilo.estructuraDetectada ?? ""}\n` +
    `- Estilo de redacción: ${estilo.patronesRedaccion ?? ""}\n` +
    `- Tipos de actividades: ${estilo.patronesActividades ?? ""}\n` +
    `- Evaluación: ${estilo.patronesEvaluacion ?? ""}\n` +
    `- Metacognición / cierre: ${estilo.patronesMetacognicion ?? ""}\n` +
    `- Semanas: ${estilo.semanasDetectadas ?? ""}\n` +
    `- Momentos: ${(estilo.momentosDetectados ?? []).join(", ")}\n\n` +
    "IMPORTANTE: No copies texto de la planificación original. " +
    "Genera contenido completamente nuevo para el tema indicado, " +
    "respetando la estructura y el estilo pedagógico.";

  const system =
    "Eres DocenteOS, asistente pedagógico especializado en el Diseño Curricular Dominicano (MINERD). " +
    "Genera planificaciones que repliquen el estilo pedagógico indicado con contenido totalmente nuevo. " +
    "Responde siempre en español. Sé concreto y práctico para docentes de aula.";

  await AIService.generate({
    module:    "style-replicar",
    prompt,
    system,
    maxTokens: 3000,
    onChunk:   onChunk  ?? (() => {}),
    onFinish:  onFinish ?? (() => {}),
    onError:   onError  ?? (() => {}),
  });
}

/**
 * Combina el estilo pedagógico de múltiples plantillas para generar una planificación híbrida.
 *
 * @param {string[]} templateIds - IDs de plantillas en ke_estilos
 * @param {string}   nuevoTema
 * @param {Object}   metadata
 * @param {string}   [metadata.grado]
 * @param {string}   [metadata.asignatura]
 * @param {Function} metadata.onChunk
 * @param {Function} metadata.onFinish
 * @param {Function} metadata.onError
 */
export async function combinarEstilos(templateIds, nuevoTema, metadata = {}) {
  const { onChunk, onFinish, onError } = metadata;

  if (!db) {
    onError?.("[StyleEngine] Firestore no disponible");
    return;
  }

  if (!templateIds?.length) {
    onError?.("[StyleEngine] No se proporcionaron plantillas para combinar");
    return;
  }

  // Cargar todas las plantillas en paralelo, ignorar las que no existan
  const snaps = await Promise.all(
    templateIds.map(id => getDoc(doc(db, COLLECTIONS.KE_ESTILOS, id)))
  );

  const plantillas = snaps
    .filter(s => s.exists())
    .map((s, i) => ({ id: templateIds[i], ...s.data() }));

  if (!plantillas.length) {
    onError?.("[StyleEngine] Ninguna de las plantillas existe");
    return;
  }

  const resumenPlantillas = plantillas.map((p, i) =>
    `PLANTILLA ${i + 1} (${p.nombre ?? p.id}):\n` +
    `- Estructura: ${p.estilo?.estructuraDetectada ?? ""}\n` +
    `- Actividades: ${p.estilo?.patronesActividades ?? ""}\n` +
    `- Evaluación: ${p.estilo?.patronesEvaluacion ?? ""}\n` +
    `- Cierre: ${p.estilo?.patronesMetacognicion ?? ""}`
  ).join("\n\n");

  const prompt =
    "Genera una planificación docente NUEVA que combine lo mejor de los estilos pedagógicos indicados.\n\n" +
    "TEMA: " + nuevoTema + "\n" +
    (metadata.grado      ? `GRADO: ${metadata.grado}\n`       : "") +
    (metadata.asignatura ? `ASIGNATURA: ${metadata.asignatura}\n` : "") +
    "\nESTILOS A COMBINAR:\n" +
    resumenPlantillas +
    "\n\nSelecciona los mejores elementos de cada plantilla y crea una planificación coherente " +
    "con contenido completamente nuevo para el tema indicado. Responde en español.";

  const system =
    "Eres DocenteOS, asistente pedagógico especializado en el Diseño Curricular Dominicano (MINERD). " +
    "Combinas estilos pedagógicos para crear planificaciones enriquecidas. " +
    "Responde siempre en español.";

  await AIService.generate({
    module:    "style-combinar",
    prompt,
    system,
    maxTokens: 3000,
    onChunk:   onChunk  ?? (() => {}),
    onFinish:  onFinish ?? (() => {}),
    onError:   onError  ?? (() => {}),
  });
}
