/**
 * MemoryQuery — Wrapper de conveniencia sobre KnowledgeEngine orientado al administrador.
 *
 * Para consultas orientadas a producción (inyección en prompts), usar KnowledgeEngine.query().
 * Este módulo es para el panel de administración.
 */

import { db } from "../../../firebase.js";
import {
  collection, getDocs, query, where, orderBy, limit,
} from "firebase/firestore";
import { COLLECTIONS, STATES, AGENT_IDS } from "../knowledge/KnowledgeTypes.js";
import * as KnowledgeEngine from "../knowledge/KnowledgeEngine.js";

// ── API pública ────────────────────────────────────────────────────────────────

/**
 * Retorna todas las memorias activas de un agente.
 *
 * @param {string} agentId
 * @returns {Promise<Object[]>}
 */
export async function getActiveMemoriesForAgent(agentId) {
  const result = await KnowledgeEngine.query({ agentId });
  return result.memories;
}

/**
 * Retorna memorias pendientes de aprobación para un agente.
 *
 * @param {string} agentId
 * @returns {Promise<Object[]>}
 */
export async function getPendingMemoriesForAgent(agentId) {
  if (!db) return [];

  try {
    const ref = collection(db, COLLECTIONS.KE_AGENTES, agentId, COLLECTIONS.KE_MEMORIA);
    const q = query(
      ref,
      where("estado", "==", STATES.PENDING),
      orderBy("creadoEn", "desc"),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

/**
 * Retorna un resumen del estado de memorias para todos los agentes conocidos.
 *
 * @returns {Promise<Array<{ agentId, totalActivas, totalPendientes, ultimaActualizacion }>>}
 */
export async function getAllAgentsStatus() {
  if (!db) return [];

  const agentIds = Object.values(AGENT_IDS);

  const results = await Promise.all(
    agentIds.map(async (agentId) => {
      try {
        const ref = collection(db, COLLECTIONS.KE_AGENTES, agentId, COLLECTIONS.KE_MEMORIA);

        const [activasSnap, pendientesSnap] = await Promise.all([
          getDocs(query(ref, where("estado", "==", STATES.ACTIVE),  limit(200))),
          getDocs(query(ref, where("estado", "==", STATES.PENDING), limit(200))),
        ]);

        // Última actualización: el doc con actualizadoEn más reciente entre activas y pendientes
        let ultimaActualizacion = null;
        const allDocs = [...activasSnap.docs, ...pendientesSnap.docs];
        for (const d of allDocs) {
          const ts = d.data().actualizadoEn?.toDate?.() ?? null;
          if (ts && (!ultimaActualizacion || ts > ultimaActualizacion)) {
            ultimaActualizacion = ts;
          }
        }

        return {
          agentId,
          totalActivas:    activasSnap.size,
          totalPendientes: pendientesSnap.size,
          ultimaActualizacion,
        };
      } catch {
        return {
          agentId,
          totalActivas:    0,
          totalPendientes: 0,
          ultimaActualizacion: null,
        };
      }
    })
  );

  return results;
}
