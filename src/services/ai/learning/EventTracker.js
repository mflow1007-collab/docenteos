import { db } from "../../../firebase.js";
import { getAuth } from "firebase/auth";
import {
  collection, addDoc, serverTimestamp,
} from "firebase/firestore";
import { COLLECTIONS } from "../knowledge/KnowledgeTypes.js";

const SESSION_KEY = "le_sessionId";

function _getSessionId() {
  let sid = sessionStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

async function _writeEvent(tipo, params = {}) {
  if (!db) return;

  const uid = getAuth().currentUser?.uid ?? "anon";
  const {
    agentId   = null,
    area      = null,
    asignatura = null,
    grado     = null,
    tema      = null,
    metadata  = {},
  } = params;

  const payload = {
    tipo,
    agentId,
    area,
    asignatura,
    grado,
    tema,
    userId:    uid,
    sessionId: _getSessionId(),
    metadata,
    timestamp: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, COLLECTIONS.LE_EVENTOS), payload);

  if (import.meta.env.DEV) {
    console.debug(`[EventTracker] ${tipo} → ${ref.id}`, { agentId, area, asignatura, grado, tema });
  }
}

export const EventTracker = {
  track(tipo, params = {}) {
    _writeEvent(tipo, params).catch(() => {});
  },
};
