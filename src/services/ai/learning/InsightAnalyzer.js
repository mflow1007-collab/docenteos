import { db } from "../../../firebase.js";
import { getAuth } from "firebase/auth";
import {
  collection, addDoc, getDocs, doc, getDoc, updateDoc,
  query, orderBy, limit, where, serverTimestamp, getCountFromServer,
} from "firebase/firestore";
import { AIService } from "../AIService.js";
import {
  COLLECTIONS, INSIGHT_STATES, STATES, MEMORY_TYPES,
  MEMORY_SOURCES, AGENT_IDS,
} from "../knowledge/KnowledgeTypes.js";
import { crearMemoria } from "../memory/AgentMemoryService.js";

const SYSTEM_PROMPT =
  "Eres el Learning Engine de DocenteOS. Analizas patrones de uso para ayudar al administrador " +
  "a mejorar el sistema. Genera sugerencias claras, específicas y accionables. " +
  "Nunca actúes automáticamente — solo sugiere.";

// Porcentaje mínimo para considerar que hay un patrón significativo
const UMBRAL_PATRON = 0.70;
// Ocurrencias mínimas del mismo agrupamiento antes de analizar
const MIN_OCURRENCIAS = 5;

// ── Detección de patrones ──────────────────────────────────────────────────────

/**
 * Agrupa eventos por (tipo + asignatura + tema) y detecta combinaciones
 * cuya frecuencia relativa supera UMBRAL_PATRON.
 */
function _detectarPatrones(eventos) {
  const grupos = {};

  for (const ev of eventos) {
    const key = `${ev.tipo}||${(ev.asignatura || "").toLowerCase()}||${(ev.tema || "").toLowerCase()}`;
    if (!grupos[key]) {
      grupos[key] = {
        tipo:       ev.tipo,
        asignatura: ev.asignatura,
        tema:       ev.tema,
        area:       ev.area,
        grado:      ev.grado,
        eventIds:   [],
        count:      0,
      };
    }
    grupos[key].eventIds.push(ev.id);
    grupos[key].count++;
  }

  const total = eventos.length || 1;
  const patrones = [];

  for (const g of Object.values(grupos)) {
    if (g.count < MIN_OCURRENCIAS) continue;
    const pct = g.count / total;
    if (pct >= UMBRAL_PATRON) {
      patrones.push({ ...g, pct: Math.round(pct * 100) });
    }
  }

  return patrones;
}

function _tipoInsight(tipoEvento) {
  if (tipoEvento === "planificacion_regenerada") return "patron_regeneracion";
  if (tipoEvento === "actividad_modificada")     return "patron_modificacion";
  if (tipoEvento === "mejora_aceptada")          return "patron_exito";
  if (tipoEvento === "apoyo_generado")           return "patron_riesgo";
  if (tipoEvento === "instrumento_aceptado")     return "patron_instrumento";
  if (tipoEvento === "auditoria_aplicada")       return "patron_auditoria";
  if (tipoEvento === "plantilla_usada")          return "patron_plantilla";
  return "patron_detectado";
}

// ── API pública ────────────────────────────────────────────────────────────────

/**
 * Lee los últimos N eventos de le_eventos, detecta patrones y genera insights
 * para aquellos que superan el umbral configurado.
 *
 * @param {{ limite?: number }} opciones
 * @returns {Promise<string[]>} IDs de los insights creados
 */
export async function analyzePatterns({ limite = 200 } = {}) {
  if (!db) return [];

  let eventos;
  try {
    const q = query(
      collection(db, COLLECTIONS.LE_EVENTOS),
      orderBy("timestamp", "desc"),
      limit(limite)
    );
    const snap = await getDocs(q);
    eventos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    if (import.meta.env.DEV) console.debug("[InsightAnalyzer] error leyendo eventos:", err);
    return [];
  }

  if (eventos.length === 0) return [];

  const patrones = _detectarPatrones(eventos);
  const insightIds = [];

  // Cargar insights recientes para evitar duplicados (últimos 7 días)
  let insightsRecientes = [];
  try {
    const hace7dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const qRecientes = query(
      collection(db, COLLECTIONS.LE_INSIGHTS),
      where("creadoEn", ">=", hace7dias),
      orderBy("creadoEn", "desc"),
      limit(100)
    );
    const snapRecientes = await getDocs(qRecientes);
    insightsRecientes = snapRecientes.docs.map(d => d.data());
  } catch {
    // no-fatal: si falla la dedup, crear igual
  }

  for (const patron of patrones) {
    try {
      const tipoInsight = _tipoInsight(patron.tipo);

      // Saltar si ya existe un insight del mismo tipo + asignatura + tema reciente
      const duplicado = insightsRecientes.some(ins =>
        ins.tipo === tipoInsight &&
        ins.asignatura === (patron.asignatura ?? null) &&
        ins.tema === (patron.tema ?? null)
      );
      if (duplicado) continue;

      const descripcion = await generateInsightText(patron);
      const id = await saveInsight({
        tipo:            tipoInsight,
        descripcion,
        evidencias:      patron.eventIds,
        umbralPct:       patron.pct,
        accionSugerida:  _accionSugerida(patron),
        area:            patron.area       ?? null,
        asignatura:      patron.asignatura ?? null,
        grado:           patron.grado      ?? null,
        tema:            patron.tema       ?? null,
      });
      if (id) insightIds.push(id);
    } catch {
      // un patrón fallido no interrumpe los demás
    }
  }

  if (import.meta.env.DEV) {
    console.debug(`[InsightAnalyzer] analyzePatterns → ${insightIds.length} insights generados`);
  }

  return insightIds;
}

function _accionSugerida(patron) {
  const ctx = [patron.asignatura, patron.tema].filter(Boolean).join(" — ");
  if (patron.tipo === "planificacion_regenerada") {
    return `Actualizar plantilla de ${ctx}`;
  }
  if (patron.tipo === "actividad_modificada") {
    return `Revisar actividades generadas para ${ctx}`;
  }
  if (patron.tipo === "mejora_aceptada") {
    return `Promover como plantilla base el contenido de ${ctx}`;
  }
  if (patron.tipo === "apoyo_generado") {
    return `Revisar memorias del Generador de Reportes para ${patron.asignatura} — grado ${patron.grado}`;
  }
  if (patron.tipo === "instrumento_aceptado") {
    return `Convertir instrumento de ${ctx} en plantilla global`;
  }
  if (patron.tipo === "auditoria_aplicada") {
    return `Reforzar criterios de auditoría para ${ctx}`;
  }
  if (patron.tipo === "plantilla_usada") {
    return `Revisar y enriquecer la plantilla más usada en ${ctx}`;
  }
  return `Revisar contenido de ${ctx}`;
}

/**
 * Llama a la IA para redactar el texto del insight en lenguaje natural.
 *
 * @param {{ tipo, asignatura, tema, area, grado, pct, count }} patternData
 * @returns {Promise<string>}
 */
export function generateInsightText(patternData) {
  return new Promise(resolve => {
    let acumulado = "";

    const { tipo, asignatura, tema, area, grado, pct, count } = patternData;

    const accion = tipo === "planificacion_regenerada"
      ? "regeneran la planificación"
      : tipo === "actividad_modificada"
      ? "modifican las actividades generadas"
      : "aceptan las mejoras sugeridas";

    const contexto = [
      grado      && `grado ${grado}`,
      area       && `área ${area}`,
      asignatura && `asignatura ${asignatura}`,
      tema       && `tema "${tema}"`,
    ].filter(Boolean).join(", ");

    AIService.generate({
      module: "auditoria",
      system: SYSTEM_PROMPT,
      prompt: `Genera un insight para el administrador de DocenteOS basado en este patrón de uso:

- Evento observado: ${tipo}
- Contexto: ${contexto}
- Frecuencia: ${pct}% de los eventos recientes (${count} ocurrencias)
- Acción observada: los docentes ${accion}

Redacta el insight siguiendo este formato exacto:
"Detecté que el X% de los docentes [acción observada] cuando [contexto]. ¿Deseas [acción sugerida]?"

Sé específico, usa los datos reales proporcionados. Máximo 2 oraciones.`,
      maxTokens: 150,
      onChunk:  t => { acumulado += t; },
      onFinish: () => resolve(acumulado.trim()),
      onError:  () => resolve(
        `Detecté que el ${pct}% de los docentes ${accion} en ${contexto}. ¿Deseas revisar esta configuración?`
      ),
    });
  });
}

/**
 * Persiste un insight en le_insights con estado "pendiente".
 *
 * @param {{ tipo, descripcion, evidencias, umbralPct, accionSugerida }} insightData
 * @returns {Promise<string|null>} ID del documento creado
 */
export async function saveInsight(insightData) {
  if (!db) return null;

  try {
    const {
      tipo           = "patron_detectado",
      descripcion    = "",
      evidencias     = [],
      umbralPct      = 0,
      accionSugerida = "",
      area           = null,
      asignatura     = null,
      grado          = null,
      tema           = null,
      topicId        = null,
    } = insightData;

    const payload = {
      tipo,
      descripcion,
      evidencias,
      umbralPct,
      accionSugerida,
      area,
      asignatura,
      grado,
      tema,
      topicId,
      estado:               INSIGHT_STATES.PENDING,
      creadoEn:             serverTimestamp(),
      revisadoPor:          null,
      revisadoEn:           null,
      convertidoEnMemoria:  false,
      memoryId:             null,
    };

    const ref = await addDoc(collection(db, COLLECTIONS.LE_INSIGHTS), payload);

    if (import.meta.env.DEV) {
      console.debug(`[InsightAnalyzer] insight guardado → ${ref.id}`, { tipo, umbralPct });
    }

    return ref.id;
  } catch (err) {
    if (import.meta.env.DEV) console.debug("[InsightAnalyzer] error guardando insight:", err);
    return null;
  }
}

/**
 * Retorna todos los insights con estado "pendiente".
 * @returns {Promise<Object[]>}
 */
export async function getPendingInsights() {
  if (!db) return [];

  try {
    const q = query(
      collection(db, COLLECTIONS.LE_INSIGHTS),
      where("estado", "==", INSIGHT_STATES.PENDING),
      orderBy("creadoEn", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    if (import.meta.env.DEV) console.debug("[InsightAnalyzer] error leyendo insights pendientes:", err);
    return [];
  }
}

/**
 * Registra la decisión del administrador sobre un insight.
 *
 * Si decision === "aprobado":
 *   1. Lee el insight para obtener su contexto
 *   2. Crea una memoria activa en ke_agentes/{agentId}/ke_memoria
 *   3. Marca el insight con convertidoEnMemoria: true y memoryId
 *
 * @param {string} insightId
 * @param {"aprobado"|"rechazado"} decision
 * @param {string} [adminUid]
 */
export async function resolveInsight(insightId, decision, adminUid) {
  if (!db || !insightId) return;

  try {
    const uid      = adminUid ?? getAuth().currentUser?.uid ?? "anon";
    const estado   = decision === "aprobado" ? INSIGHT_STATES.APPROVED : INSIGHT_STATES.REJECTED;
    const insightRef = doc(db, COLLECTIONS.LE_INSIGHTS, insightId);

    const updateData = {
      estado,
      revisadoPor: uid,
      revisadoEn:  serverTimestamp(),
    };

    // ── Loop: insight aprobado → memoria activa en Knowledge Engine ────────
    if (decision === "aprobado") {
      const snap = await getDoc(insightRef);
      if (snap.exists()) {
        const insight  = snap.data();
        const memoryId = await _convertirEnMemoria(insight, insightId, uid);
        if (memoryId) {
          updateData.convertidoEnMemoria = true;
          updateData.memoryId            = memoryId;
        }
      }
    }

    await updateDoc(insightRef, updateData);

    if (import.meta.env.DEV) {
      console.debug(`[InsightAnalyzer] insight ${insightId} → ${estado}`, {
        convertido: updateData.convertidoEnMemoria ?? false,
      });
    }
  } catch (err) {
    if (import.meta.env.DEV) console.debug("[InsightAnalyzer] error resolviendo insight:", err);
  }
}

// ── Conversión insight → memoria ────────────────────────────────────────────

async function _convertirEnMemoria(insight, insightId, adminUid) {
  const contenido = [insight.descripcion, insight.accionSugerida]
    .filter(Boolean)
    .join(" → ");

  if (!contenido.trim()) return null;

  const agentId = _agentIdParaInsight(insight.tipo);

  try {
    const memoryId = await crearMemoria(agentId, {
      tipo:                 _tipoMemoriaParaInsight(insight.tipo),
      contenido,
      areaAplicable:        insight.area       ?? null,
      asignaturaAplicable:  insight.asignatura ?? null,
      gradoAplicable:       insight.grado      ?? null,
      temaAplicable:        insight.tema       ?? null,
      topicId:              insight.topicId    ?? null,
      prioridad:            _prioridadPorUmbral(insight.umbralPct),
      fuente:               MEMORY_SOURCES.LEARNING,
      estado:               STATES.ACTIVE, // admin ya aprobó — entra activa
      insightId,
      aprobadoPor:          adminUid,
      aprobadoEn:           serverTimestamp(),
      creadoPor:            adminUid,
    });

    if (import.meta.env.DEV) {
      console.debug(`[InsightAnalyzer] memoria creada → ${agentId}/${memoryId}`);
    }
    return memoryId;
  } catch (err) {
    if (import.meta.env.DEV) console.debug("[InsightAnalyzer] error creando memoria:", err);
    return null;
  }
}

function _agentIdParaInsight(tipo) {
  if (tipo === "patron_modificacion")  return AGENT_IDS.MEJORADOR_ACTIVIDADES;
  if (tipo === "patron_riesgo")        return AGENT_IDS.GENERADOR_REPORTES;
  if (tipo === "patron_exito")         return AGENT_IDS.AUDITOR;
  if (tipo === "patron_auditoria")     return AGENT_IDS.AUDITOR;
  if (tipo === "patron_instrumento")   return AGENT_IDS.GENERADOR_INSTRUMENTOS;
  return AGENT_IDS.PLANIFICADOR;
}

function _tipoMemoriaParaInsight(tipo) {
  if (tipo === "patron_regeneracion") return MEMORY_TYPES.REGLA;
  if (tipo === "patron_modificacion") return MEMORY_TYPES.RECOMENDACION;
  if (tipo === "patron_exito")        return MEMORY_TYPES.PATRON;
  if (tipo === "patron_riesgo")       return MEMORY_TYPES.RECOMENDACION;
  if (tipo === "patron_instrumento")  return MEMORY_TYPES.EJEMPLO;
  if (tipo === "patron_auditoria")    return MEMORY_TYPES.CRITERIO;
  if (tipo === "patron_plantilla")    return MEMORY_TYPES.PREFERENCIA;
  return MEMORY_TYPES.PATRON;
}

function _prioridadPorUmbral(umbralPct) {
  if (!umbralPct)       return 5;
  if (umbralPct >= 90)  return 9;
  if (umbralPct >= 80)  return 8;
  if (umbralPct >= 70)  return 7;
  return 6;
}

/**
 * Estadísticas de resumen del panel de insights.
 * @returns {Promise<{ total: number, pendientes: number, aprobados: number, rechazados: number }>}
 */
export async function getInsightStats() {
  if (!db) return { total: 0, pendientes: 0, aprobados: 0, rechazados: 0 };

  try {
    const col = collection(db, COLLECTIONS.LE_INSIGHTS);

    const [totalSnap, pendSnap, aprobSnap, rechSnap] = await Promise.all([
      getCountFromServer(query(col)),
      getCountFromServer(query(col, where("estado", "==", INSIGHT_STATES.PENDING))),
      getCountFromServer(query(col, where("estado", "==", INSIGHT_STATES.APPROVED))),
      getCountFromServer(query(col, where("estado", "==", INSIGHT_STATES.REJECTED))),
    ]);

    return {
      total:      totalSnap.data().count,
      pendientes: pendSnap.data().count,
      aprobados:  aprobSnap.data().count,
      rechazados: rechSnap.data().count,
    };
  } catch (err) {
    if (import.meta.env.DEV) console.debug("[InsightAnalyzer] error obteniendo stats:", err);
    return { total: 0, pendientes: 0, aprobados: 0, rechazados: 0 };
  }
}
