import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  runTransaction,
  increment,
  onSnapshot,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { esUsuarioDocenteOS } from "./utils/permisos.js";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const isFirebaseConfigured =
  Boolean(firebaseConfig.apiKey) &&
  Boolean(firebaseConfig.authDomain) &&
  Boolean(firebaseConfig.projectId) &&
  Boolean(firebaseConfig.appId) &&
  !String(firebaseConfig.apiKey).toLowerCase().includes("your_") &&
  !String(firebaseConfig.apiKey).toLowerCase().includes("replace");

let db = null;
let auth = null;

if (isFirebaseConfigured) {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
} else {
  console.warn("[DocenteOS] Firebase no configurado. Variables recibidas:", {
    apiKey:            Boolean(firebaseConfig.apiKey),
    authDomain:        Boolean(firebaseConfig.authDomain),
    projectId:         Boolean(firebaseConfig.projectId),
    storageBucket:     Boolean(firebaseConfig.storageBucket),
    messagingSenderId: Boolean(firebaseConfig.messagingSenderId),
    appId:             Boolean(firebaseConfig.appId),
  });
}

export { db, auth };

const buildMetaBase = (uid) => ({
  ownerUid: uid,
  createdBy: uid,
});

const getCurrentUserOrThrow = () => {
  if (!isFirebaseConfigured || !auth || !db) {
    throw new Error("Firebase no configurado");
  }
  const user = auth.currentUser;
  if (!user) throw new Error("Usuario no autenticado");
  return user;
};

// Función para guardar planificación en Firestore
export const guardarPlanificacion = async (planificacion) => {
  try {
    const user = getCurrentUserOrThrow();

    const docRef = await addDoc(collection(db, "planificaciones"), {
      curso: planificacion.curso,
      periodo: planificacion.periodo,
      tema: planificacion.tema,
      competencia: planificacion.competencia,
      resultado: planificacion.resultado,
      usuario: user.uid,
      usuarioEmail: user.email,
      ...buildMetaBase(user.uid),
      fecha: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    console.log("Planificación guardada con ID:", docRef.id);
    return { id: docRef.id, success: true };
  } catch (error) {
    console.error("Error al guardar planificación:", error);
    throw error;
  }
};

// Función para obtener planificaciones del usuario
export const obtenerPlanificaciones = async () => {
  try {
    const user = getCurrentUserOrThrow();

    const planificaciones = [];
    const q = query(
      collection(db, "planificaciones"),
      where("usuario", "==", user.uid)
    );
    const querySnapshot = await getDocs(q);

    querySnapshot.forEach((doc) => {
      planificaciones.push({ id: doc.id, ...doc.data() });
    });

    return planificaciones;
  } catch (error) {
    console.error("Error al obtener planificaciones:", error);
    throw error;
  }
};

const HORARIOS_KEY = "docenteos_horarios_cursos";
const PLANIFICACIONES_KEY = "docenteos_planificaciones_guardadas";

const obtenerHorariosLocales = () => {
  try {
    const guardado = localStorage.getItem(HORARIOS_KEY);
    return guardado ? JSON.parse(guardado) : {};
  } catch {
    return {};
  }
};

const guardarHorariosLocales = (horarios) => {
  localStorage.setItem(HORARIOS_KEY, JSON.stringify(horarios));
};

const obtenerPlanificacionesLocales = () => {
  try {
    const guardado = localStorage.getItem(PLANIFICACIONES_KEY);
    return guardado ? JSON.parse(guardado) : [];
  } catch {
    return [];
  }
};

const guardarPlanificacionesLocales = (planificaciones) => {
  localStorage.setItem(PLANIFICACIONES_KEY, JSON.stringify(planificaciones));
};

const eliminarPlanificacionesLocalesPorUsuario = (userId) => {
  const existentes = obtenerPlanificacionesLocales();
  const filtradas = existentes.filter((item) => item.usuario !== userId);
  const eliminadas = existentes.length - filtradas.length;
  guardarPlanificacionesLocales(filtradas);
  return eliminadas;
};

export const guardarHorarioCurso = async ({ cursoId, horario }) => {
  if (!cursoId) throw new Error("cursoId es obligatorio");

  try {
    if (isFirebaseConfigured && auth && db && auth.currentUser) {
      const user = auth.currentUser;
      const ref = doc(db, "horariosCursos", `${user.uid}_${cursoId}`);
      const previo = await getDoc(ref);
      const payload = {
        cursoId,
        usuario: user.uid,
        horario,
        updatedAt: serverTimestamp(),
        actualizadoEn: serverTimestamp(),
      };
      if (previo.exists()) {
        await updateDoc(ref, payload);
      } else {
        await setDoc(
          ref,
          {
            ...payload,
            ...buildMetaBase(user.uid),
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
      return { success: true, mode: "firebase" };
    }

    const locales = obtenerHorariosLocales();
    locales[cursoId] = horario;
    guardarHorariosLocales(locales);
    return { success: true, mode: "local" };
  } catch (error) {
    console.error("Error al guardar horario:", error);
    throw error;
  }
};

export const obtenerHorarioCurso = async (cursoId) => {
  if (!cursoId) throw new Error("cursoId es obligatorio");

  try {
    if (isFirebaseConfigured && auth && db && auth.currentUser) {
      const user = auth.currentUser;
      const ref = doc(db, "horariosCursos", `${user.uid}_${cursoId}`);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        return snap.data()?.horario || null;
      }
    }

    const locales = obtenerHorariosLocales();
    return locales[cursoId] || null;
  } catch (error) {
    console.error("Error al obtener horario:", error);
    throw error;
  }
};

export const guardarPlanificacionDetallada = async (planificacion) => {
  if (!planificacion) throw new Error("La planificación es obligatoria");

  const createdAt = new Date().toISOString();
  const meta = planificacion.metadatos || {};
  const curso = [meta.grado, meta.seccion].filter(Boolean).join(" ").trim() || meta.curso || "Curso no definido";
  const area = meta.area || planificacion?.datosGenerales?.area || "Área no definida";

  try {
    if (isFirebaseConfigured && auth && db && auth.currentUser) {
      const user = auth.currentUser;
      const docRef = await addDoc(collection(db, "planificaciones"), {
        curso,
        area,
        periodo: meta.periodo || "Período no definido",
        tema: meta.tema || "Tema no definido",
        competencia: meta.competenciaSeleccionada || "Competencia no definida",
        contenido: planificacion,
        usuario: user.uid,
        usuarioEmail: user.email,
        ...buildMetaBase(user.uid),
        fecha: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return { success: true, mode: "firebase", id: docRef.id };
    }

    const userId = auth?.currentUser?.uid || "local-anon";
    const existentes = obtenerPlanificacionesLocales();
    const nuevoRegistro = {
      id: `local_${Date.now()}`,
      usuario: userId,
      usuarioEmail: auth?.currentUser?.email || "local@offline",
      curso,
      area,
      periodo: meta.periodo || "Período no definido",
      tema: meta.tema || "Tema no definido",
      competencia: meta.competenciaSeleccionada || "Competencia no definida",
      contenido: planificacion,
      createdAt,
    };

    guardarPlanificacionesLocales([nuevoRegistro, ...existentes]);
    return { success: true, mode: "local", id: nuevoRegistro.id };
  } catch (error) {
    console.error("Error al guardar planificación detallada:", error);
    throw error;
  }
};

export const obtenerPlanificacionesDetalladas = async () => {
  try {
    if (isFirebaseConfigured && auth && db && auth.currentUser) {
      const user = auth.currentUser;
      const q = query(
        collection(db, "planificaciones"),
        where("usuario", "==", user.uid)
      );
      const querySnapshot = await getDocs(q);
      const planificaciones = [];

      querySnapshot.forEach((registro) => {
        planificaciones.push({ id: registro.id, ...registro.data() });
      });

      planificaciones.sort((a, b) =>
        String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
      );

      return { success: true, mode: "firebase", data: planificaciones };
    }

    const userId = auth?.currentUser?.uid || "local-anon";
    const planificacionesLocales = obtenerPlanificacionesLocales().filter(
      (item) => item.usuario === userId
    );

    return { success: true, mode: "local", data: planificacionesLocales };
  } catch (error) {
    console.error("Error al obtener planificaciones detalladas:", error);
    throw error;
  }
};

export const eliminarPlanificacionDetallada = async (planificacionId) => {
  if (!planificacionId) throw new Error("El id de planificación es obligatorio");

  try {
    if (isFirebaseConfigured && auth && db && auth.currentUser) {
      const user = auth.currentUser;
      const ref = doc(db, "planificaciones", String(planificacionId));
      const snap = await getDoc(ref);
      if (!snap.exists()) return { success: true, mode: "firebase", id: planificacionId };
      if (snap.data()?.usuario !== user.uid) {
        throw new Error("No tienes permiso para eliminar esta planificación");
      }
      await deleteDoc(ref);
      return { success: true, mode: "firebase", id: planificacionId };
    }

    const userId = auth?.currentUser?.uid || "local-anon";
    const existentes = obtenerPlanificacionesLocales();
    const filtradas = existentes.filter(
      (item) => !(String(item.id) === String(planificacionId) && item.usuario === userId)
    );

    guardarPlanificacionesLocales(filtradas);
    return { success: true, mode: "local", id: planificacionId };
  } catch (error) {
    console.error("Error al eliminar planificación detallada:", error);
    throw error;
  }
};

// ─── Registro de Calificaciones (Secundaria) ────────────────────────────────

const REGISTRO_KEY = "docenteos_registros_calificaciones";

const obtenerRegistrosLocales = () => {
  try {
    const guardado = localStorage.getItem(REGISTRO_KEY);
    return guardado ? JSON.parse(guardado) : {};
  } catch {
    return {};
  }
};

const guardarRegistrosLocales = (registros) => {
  localStorage.setItem(REGISTRO_KEY, JSON.stringify(registros));
};

export const guardarRegistroCalificaciones = async ({
  cursoId,
  area,
  grado,
  seccion,
  anioEscolar,
  nivel = "secundaria",
  notasEstudiantes,
  asistencia,
  observaciones,
}) => {
  if (!cursoId) throw new Error("cursoId es obligatorio");

  const updatedAt = new Date().toISOString();
  const payload = { cursoId, area, grado, seccion, anioEscolar, nivel, notasEstudiantes, asistencia, observaciones, updatedAt };

  try {
    if (isFirebaseConfigured && auth && db && auth.currentUser) {
      const user = auth.currentUser;
      const ref = doc(db, "registrosCalificaciones", `${user.uid}_${cursoId}`);
      const previo = await getDoc(ref);
      const dataParcial = {
        ...payload,
        usuario: user.uid,
        usuarioEmail: user.email,
        updatedAt: serverTimestamp(),
        actualizadoEn: serverTimestamp(),
      };
      if (previo.exists()) {
        await updateDoc(ref, dataParcial);
      } else {
        await setDoc(
          ref,
          {
            ...dataParcial,
            ...buildMetaBase(user.uid),
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
      return { success: true, mode: "firebase" };
    }

    const locales = obtenerRegistrosLocales();
    locales[cursoId] = payload;
    guardarRegistrosLocales(locales);
    return { success: true, mode: "local" };
  } catch (error) {
    console.error("Error al guardar registro de calificaciones:", error);
    throw error;
  }
};

export const obtenerRegistroCalificaciones = async (cursoId) => {
  if (!cursoId) throw new Error("cursoId es obligatorio");

  try {
    if (isFirebaseConfigured && auth && db && auth.currentUser) {
      const user = auth.currentUser;
      const ref = doc(db, "registrosCalificaciones", `${user.uid}_${cursoId}`);
      const snap = await getDoc(ref);
      if (snap.exists()) return { success: true, mode: "firebase", data: snap.data() };
      return { success: true, mode: "firebase", data: null };
    }

    const locales = obtenerRegistrosLocales();
    return { success: true, mode: "local", data: locales[cursoId] || null };
  } catch (error) {
    console.error("Error al obtener registro de calificaciones:", error);
    throw error;
  }
};

export const eliminarTodasPlanificacionesDetalladas = async (alcance = "source") => {
  const userId = auth?.currentUser?.uid || "local-anon";
  const puedeFirebase = Boolean(isFirebaseConfigured && auth && db && auth.currentUser);

  const hacerFirebase = alcance === "firebase" || alcance === "all" || (alcance === "source" && puedeFirebase);
  const hacerLocal = alcance === "local" || alcance === "all" || (alcance === "source" && !puedeFirebase);

  let eliminadasFirebase = 0;
  let eliminadasLocal = 0;

  try {
    if (hacerFirebase) {
      if (!puedeFirebase) {
        throw new Error("No hay sesión activa en Firebase para borrar historial remoto");
      }

      const q = query(
        collection(db, "planificaciones"),
        where("usuario", "==", auth.currentUser.uid)
      );
      const querySnapshot = await getDocs(q);

      const tareas = [];
      querySnapshot.forEach((registro) => {
        tareas.push(deleteDoc(doc(db, "planificaciones", registro.id)));
      });

      await Promise.all(tareas);
      eliminadasFirebase = tareas.length;
    }

    if (hacerLocal) {
      eliminadasLocal = eliminarPlanificacionesLocalesPorUsuario(userId);
    }

    return {
      success: true,
      mode: alcance,
      eliminadasFirebase,
      eliminadasLocal,
      eliminadasTotales: eliminadasFirebase + eliminadasLocal,
    };
  } catch (error) {
    console.error("Error al eliminar todas las planificaciones:", error);
    throw error;
  }
};

// ─── Cursos por usuario ──────────────────────────────────────────────────────

const CURSOS_KEY = "docenteos_cursos_v2";

const obtenerCursosLocales = () => {
  try {
    const g = localStorage.getItem(CURSOS_KEY);
    return g ? JSON.parse(g) : [];
  } catch { return []; }
};

const guardarCursosLocales = (cursos) => {
  try { localStorage.setItem(CURSOS_KEY, JSON.stringify(cursos)); }
  catch { /* fallback silencioso para storage no disponible */ }
};

export const guardarCurso = async (curso) => {
  if (!curso?.id) throw new Error("El curso requiere un id");
  try {
    if (isFirebaseConfigured && auth && db && auth.currentUser) {
      const uid = auth.currentUser.uid;
      const ref = doc(db, "usuarios", uid, "cursos", String(curso.id));
      const previo = await getDoc(ref);
      const dataParcial = {
        ...curso,
        uid,
        fechaActualizacion: serverTimestamp(),
        updatedAt: serverTimestamp(),
        actualizadoEn: serverTimestamp(),
      };
      if (previo.exists()) {
        await updateDoc(ref, dataParcial);
      } else {
        await setDoc(
          ref,
          {
            ...dataParcial,
            ...buildMetaBase(uid),
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
      return { success: true, mode: "firebase" };
    }
    const locales = obtenerCursosLocales();
    const idx = locales.findIndex((c) => c.id === curso.id);
    if (idx >= 0) locales[idx] = { ...curso, fechaActualizacion: new Date().toISOString() };
    else locales.unshift({ ...curso, fechaActualizacion: new Date().toISOString() });
    guardarCursosLocales(locales);
    return { success: true, mode: "local" };
  } catch (error) {
    console.error("Error al guardar curso:", error);
    throw error;
  }
};

export const obtenerCursos = async () => {
  try {
    if (isFirebaseConfigured && auth && db && auth.currentUser) {
      const uid = auth.currentUser.uid;
      const snap = await getDocs(collection(db, "usuarios", uid, "cursos"));
      const cursos = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
      return { success: true, mode: "firebase", data: cursos };
    }
    return { success: true, mode: "local", data: obtenerCursosLocales() };
  } catch (error) {
    console.error("Error al obtener cursos:", error);
    return { success: false, mode: "local", data: obtenerCursosLocales() };
  }
};

export const eliminarCurso = async (cursoId) => {
  if (!cursoId) throw new Error("cursoId es obligatorio");
  try {
    if (isFirebaseConfigured && auth && db && auth.currentUser) {
      const uid = auth.currentUser.uid;
      await deleteDoc(doc(db, "usuarios", uid, "cursos", String(cursoId)));
      return { success: true, mode: "firebase" };
    }
    guardarCursosLocales(obtenerCursosLocales().filter((c) => c.id !== cursoId));
    return { success: true, mode: "local" };
  } catch (error) {
    console.error("Error al eliminar curso:", error);
    throw error;
  }
};

// ─── Instrumentos por usuario ────────────────────────────────────────────────

const INSTRUMENTOS_KEY = "docenteos_instrumentos_v2";

const obtenerInstrumentosLocales = () => {
  try {
    const v2 = localStorage.getItem(INSTRUMENTOS_KEY);
    if (v2) return JSON.parse(v2);
    const v1 = localStorage.getItem("docenteos_instrumentos_v1");
    return v1 ? JSON.parse(v1) : [];
  } catch { return []; }
};

export const guardarInstrumentoFirestore = async (instrumento) => {
  if (!instrumento?.id) throw new Error("El instrumento requiere un id");
  try {
    if (isFirebaseConfigured && auth && db && auth.currentUser) {
      const uid = auth.currentUser.uid;
      const ref = doc(db, "usuarios", uid, "instrumentos", String(instrumento.id));
      const previo = await getDoc(ref);
      const dataParcial = {
        ...instrumento,
        uid,
        fechaActualizacion: serverTimestamp(),
        updatedAt: serverTimestamp(),
        actualizadoEn: serverTimestamp(),
      };
      if (previo.exists()) {
        await updateDoc(ref, dataParcial);
      } else {
        await setDoc(
          ref,
          {
            ...dataParcial,
            ...buildMetaBase(uid),
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
      return { success: true, mode: "firebase" };
    }
    const locales = obtenerInstrumentosLocales();
    const idx = locales.findIndex((i) => i.id === instrumento.id);
    if (idx >= 0) locales[idx] = instrumento;
    else locales.unshift(instrumento);
    localStorage.setItem(INSTRUMENTOS_KEY, JSON.stringify(locales));
    return { success: true, mode: "local" };
  } catch (error) {
    console.error("Error al guardar instrumento:", error);
    throw error;
  }
};

export const obtenerInstrumentosFirestore = async () => {
  try {
    if (isFirebaseConfigured && auth && db && auth.currentUser) {
      const uid = auth.currentUser.uid;
      const snap = await getDocs(collection(db, "usuarios", uid, "instrumentos"));
      const instrumentos = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
      return { success: true, mode: "firebase", data: instrumentos };
    }
    return { success: true, mode: "local", data: obtenerInstrumentosLocales() };
  } catch (error) {
    console.error("Error al obtener instrumentos:", error);
    return { success: false, mode: "local", data: obtenerInstrumentosLocales() };
  }
};

export const eliminarInstrumentoFirestore = async (id) => {
  if (!id) throw new Error("id es obligatorio");
  try {
    if (isFirebaseConfigured && auth && db && auth.currentUser) {
      const uid = auth.currentUser.uid;
      await deleteDoc(doc(db, "usuarios", uid, "instrumentos", String(id)));
      return { success: true, mode: "firebase" };
    }
    const locales = obtenerInstrumentosLocales().filter((i) => i.id !== id);
    localStorage.setItem(INSTRUMENTOS_KEY, JSON.stringify(locales));
    return { success: true, mode: "local" };
  } catch (error) {
    console.error("Error al eliminar instrumento:", error);
    throw error;
  }
};

// ─── Persistencia definitiva por usuario (preferencias/estado IA/auditoría) ─

const PREFERENCIAS_KEY = "docenteos_preferencias_v1";

const obtenerPreferenciasLocales = () => {
  try {
    const raw = localStorage.getItem(PREFERENCIAS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const guardarPreferenciasLocales = (data) => {
  try {
    localStorage.setItem(PREFERENCIAS_KEY, JSON.stringify(data));
  } catch {
    // noop
  }
};

export const guardarPreferenciaUsuario = async ({ clave, valor }) => {
  if (!clave) throw new Error("La clave de preferencia es obligatoria");

  try {
    if (isFirebaseConfigured && auth && db && auth.currentUser) {
      const uid = auth.currentUser.uid;
      const ref = doc(db, "usuarios", uid, "preferencias", String(clave));
      const previo = await getDoc(ref);
      const dataParcial = {
        clave,
        valor,
        updatedAt: serverTimestamp(),
        actualizadoEn: serverTimestamp(),
      };
      if (previo.exists()) {
        await updateDoc(ref, dataParcial);
      } else {
        await setDoc(
          ref,
          {
            ...dataParcial,
            ...buildMetaBase(uid),
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
      return { success: true, mode: "firebase" };
    }

    const locales = obtenerPreferenciasLocales();
    locales[clave] = valor;
    guardarPreferenciasLocales(locales);
    return { success: true, mode: "local" };
  } catch (error) {
    console.error("Error al guardar preferencia de usuario:", error);
    throw error;
  }
};

export const obtenerPreferenciaUsuario = async (clave) => {
  if (!clave) throw new Error("La clave de preferencia es obligatoria");

  try {
    if (isFirebaseConfigured && auth && db && auth.currentUser) {
      const uid = auth.currentUser.uid;
      const ref = doc(db, "usuarios", uid, "preferencias", String(clave));
      const snap = await getDoc(ref);
      return { success: true, mode: "firebase", data: snap.exists() ? snap.data()?.valor : null };
    }

    const locales = obtenerPreferenciasLocales();
    return { success: true, mode: "local", data: locales[clave] ?? null };
  } catch (error) {
    console.error("Error al obtener preferencia de usuario:", error);
    return { success: false, mode: "local", data: null };
  }
};

export const guardarEstadoDetalleEstudiante = async ({ estudianteId, payload }) => {
  if (!estudianteId) throw new Error("estudianteId es obligatorio");
  if (!payload || typeof payload !== "object") throw new Error("payload inválido");

  const claveLocal = `docenteos.detalle-estudiante.${estudianteId}`;

  try {
    if (isFirebaseConfigured && auth && db && auth.currentUser) {
      const uid = auth.currentUser.uid;
      const ref = doc(db, "usuarios", uid, "detalleEstudiantes", String(estudianteId));
      const previo = await getDoc(ref);
      const dataParcial = {
        estudianteId,
        estado: payload,
        updatedAt: serverTimestamp(),
        actualizadoEn: serverTimestamp(),
      };
      if (previo.exists()) {
        await updateDoc(ref, dataParcial);
      } else {
        await setDoc(
          ref,
          {
            ...dataParcial,
            ...buildMetaBase(uid),
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
      return { success: true, mode: "firebase" };
    }

    localStorage.setItem(claveLocal, JSON.stringify(payload));
    return { success: true, mode: "local" };
  } catch (error) {
    console.error("Error al guardar estado de detalle de estudiante:", error);
    throw error;
  }
};

export const obtenerEstadoDetalleEstudiante = async (estudianteId) => {
  if (!estudianteId) throw new Error("estudianteId es obligatorio");
  const claveLocal = `docenteos.detalle-estudiante.${estudianteId}`;

  try {
    if (isFirebaseConfigured && auth && db && auth.currentUser) {
      const uid = auth.currentUser.uid;
      const ref = doc(db, "usuarios", uid, "detalleEstudiantes", String(estudianteId));
      const snap = await getDoc(ref);
      return { success: true, mode: "firebase", data: snap.exists() ? snap.data()?.estado || null : null };
    }

    const raw = localStorage.getItem(claveLocal);
    return { success: true, mode: "local", data: raw ? JSON.parse(raw) : null };
  } catch (error) {
    console.error("Error al obtener estado de detalle de estudiante:", error);
    return { success: false, mode: "local", data: null };
  }
};

export const registrarEventoIA = async ({ modulo, accion, prompt, respuesta, tokens, estado = "exito", meta = {} }) => {
  try {
    if (!(isFirebaseConfigured && auth && db && auth.currentUser)) {
      return { success: true, mode: "local" };
    }
    const user = auth.currentUser;
    await addDoc(collection(db, "historialIA"), {
      usuario: user.email || "",
      usuarioUid: user.uid,
      modulo: modulo || "ia",
      accion: accion || "interaccion",
      prompt: prompt || "",
      respuesta: respuesta || "",
      tokens: Number(tokens) || 0,
      estado,
      meta,
      ...buildMetaBase(user.uid),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      fecha: serverTimestamp(),
    });
    return { success: true, mode: "firebase" };
  } catch (error) {
    console.error("Error al registrar historial IA:", error);
    return { success: false, mode: "firebase" };
  }
};

export const registrarEventoAuditoria = async ({ tipo, evento, modulo, detalle = {} }) => {
  try {
    if (!(isFirebaseConfigured && auth && db && auth.currentUser)) {
      return { success: true, mode: "local" };
    }
    const user = auth.currentUser;
    await addDoc(collection(db, "auditoria"), {
      tipo: tipo || "acceso",
      evento: evento || "evento",
      modulo: modulo || "sistema",
      detalle,
      usuario: user.email || "",
      usuarioUid: user.uid,
      ...buildMetaBase(user.uid),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      fecha: serverTimestamp(),
    });
    return { success: true, mode: "firebase" };
  } catch (error) {
    console.error("Error al registrar auditoría:", error);
    return { success: false, mode: "firebase" };
  }
};

// ─── Política de temas de planificación (Activo / Secundario) ──────────────

// Compatibilidad histórica — el chequeo real usa esUsuarioDocenteOS (dominio @docenteos.com)
const ADMIN_SIN_RESTRICCION = "admin@docenteos.com";

export const normalizarTema = (titulo = "") => {
  return String(titulo || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
};

const resolverCreditosDisponibles = (usuarioData = {}) => {
  const candidatos = [
    usuarioData?.creditosPlanificacionDisponibles,
    usuarioData?.creditosDisponibles,
    usuarioData?.creditos,
    usuarioData?.usoMensual?.creditosDisponibles,
  ];

  const numero = candidatos.find((valor) => Number.isFinite(Number(valor)));
  return Number.isFinite(Number(numero)) ? Number(numero) : 0;
};

const tieneSuscripcionIlimitada = (usuarioData = {}) => {
  const texto = String(
    usuarioData?.suscripcion?.plan ||
    usuarioData?.suscripcion ||
    ""
  ).toLowerCase();

  return ["ilimit", "premium", "pro", "admin"].some((token) => texto.includes(token));
};

const temaKey = (titulo) => {
  const base = normalizarTema(titulo);
  return base || "sin-tema";
};

const refHistorialTema = (uid, titulo) =>
  doc(db, "usuarios", uid, "historialTemas", temaKey(titulo));

const upsertHistorialTema = async ({ uid, titulo, estado = "activo", activo = true, incrementarEdiciones = false }) => {
  if (!uid || !titulo) return;

  const ref = refHistorialTema(uid, titulo);
  const snap = await getDoc(ref);
  const payloadBase = {
    titulo,
    fechaUltimaEdicion: serverTimestamp(),
    estado,
    activo,
    actualizadoEn: serverTimestamp(),
  };

  if (snap.exists()) {
    await updateDoc(ref, {
      ...payloadBase,
      ...(incrementarEdiciones ? { cantidadEdiciones: increment(1) } : {}),
    });
    return;
  }

  await setDoc(
    ref,
    {
      titulo,
      fechaInicio: serverTimestamp(),
      fechaUltimaEdicion: serverTimestamp(),
      cantidadEdiciones: incrementarEdiciones ? 1 : 0,
      cantidadPDF: 0,
      cantidadInstrumentos: 0,
      estado,
      activo,
      createdAt: serverTimestamp(),
      actualizadoEn: serverTimestamp(),
    },
    { merge: true }
  );
};

const desactivarTemaEnHistorial = async ({ uid, titulo, estado = "archivado" }) => {
  if (!uid || !titulo) return;
  const ref = refHistorialTema(uid, titulo);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  await updateDoc(ref, {
    activo: false,
    estado,
    fechaUltimaEdicion: serverTimestamp(),
    actualizadoEn: serverTimestamp(),
  });
};

const crearTemaFirestore = (titulo, slot = "activo") => ({
  titulo,
  tituloNormalizado: normalizarTema(titulo),
  creado: serverTimestamp(),
  ultimaEdicion: serverTimestamp(),
  estado: slot,
});

const actualizarTemaFirestore = (titulo, slot = "activo") => ({
  titulo,
  tituloNormalizado: normalizarTema(titulo),
  ultimaEdicion: serverTimestamp(),
  estado: slot,
});

export const obtenerEstadoTemasPlanificacion = async () => {
  try {
    const user = getCurrentUserOrThrow();
    const userRef = doc(db, "usuarios", user.uid);
    const snap = await getDoc(userRef);
    const data = snap.exists() ? snap.data() : {};
    return {
      success: true,
      data: {
        temaActivo: data?.temaActivo || null,
        temaSecundario: data?.temaSecundario || null,
        suscripcion: data?.suscripcion ?? "Pendiente de completar",
        usoMensual: data?.usoMensual ?? "Pendiente de completar",
        creditosDisponibles: resolverCreditosDisponibles(data),
      },
    };
  } catch (error) {
    console.error("Error al obtener estado de temas:", error);
    return {
      success: false,
      data: {
        temaActivo: null,
        temaSecundario: null,
        suscripcion: "Pendiente de completar",
        usoMensual: "Pendiente de completar",
        creditosDisponibles: 0,
      },
    };
  }
};

export const suscribirseEstadoTemasPlanificacion = (onChange, onError) => {
  try {
    const user = getCurrentUserOrThrow();
    const ref = doc(db, "usuarios", user.uid);

    return onSnapshot(
      ref,
      (snap) => {
        const data = snap.exists() ? snap.data() : {};
        onChange?.({
          temaActivo: data?.temaActivo || null,
          temaSecundario: data?.temaSecundario || null,
          suscripcion: data?.suscripcion ?? "Pendiente de completar",
          usoMensual: data?.usoMensual ?? "Pendiente de completar",
          creditosDisponibles: resolverCreditosDisponibles(data),
        });
      },
      (error) => {
        console.error("Error en suscripción de temas:", error);
        onError?.(error);
      }
    );
  } catch (error) {
    console.error("No se pudo abrir suscripción de temas:", error);
    return () => {};
  }
};

export const verificarTemaAntesDeGenerar = async ({ tituloTema }) => {
  if (!tituloTema || !String(tituloTema).trim()) {
    return {
      success: false,
      permitido: false,
      motivo: "tema_requerido",
      mensaje: "Debes indicar un tema para continuar.",
    };
  }

  try {
    const user = getCurrentUserOrThrow();
    const ref = doc(db, "usuarios", user.uid);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : {};

    const normalizado = normalizarTema(tituloTema);
    const activoNorm = normalizarTema(data?.temaActivo?.titulo || data?.temaActivo || "");
    const secundarioNorm = normalizarTema(data?.temaSecundario?.titulo || data?.temaSecundario || "");

    const isAdmin = esUsuarioDocenteOS(user.email);
    const creditos = resolverCreditosDisponibles(data);
    const ilimitado = tieneSuscripcionIlimitada(data);

    if (normalizado && normalizado === activoNorm) {
      return { success: true, permitido: true, tipoCoincidencia: "activo", requiereCredito: false };
    }

    if (normalizado && normalizado === secundarioNorm) {
      return { success: true, permitido: true, tipoCoincidencia: "secundario", requiereCredito: false };
    }

    if (!activoNorm || !secundarioNorm) {
      return { success: true, permitido: true, tipoCoincidencia: "nuevo", requiereCredito: false };
    }

    if (isAdmin || ilimitado || creditos > 0) {
      return {
        success: true,
        permitido: true,
        tipoCoincidencia: "nuevo",
        requiereCredito: true,
        puedeCrearNuevoTema: true,
        creditosDisponibles: creditos,
      };
    }

    return {
      success: true,
      permitido: false,
      motivo: "tercer_tema_sin_credito",
      mensaje:
        "Ya tienes dos temas activos. Puedes seguir editándolos sin límites. Para iniciar un nuevo tema debes usar un nuevo crédito o disponer de una suscripción compatible.",
      temas: {
        temaActivo: data?.temaActivo || null,
        temaSecundario: data?.temaSecundario || null,
      },
      puedeCrearNuevoTema: false,
      creditosDisponibles: creditos,
    };
  } catch (error) {
    console.error("Error al verificar tema:", error);
    if (!isFirebaseConfigured || !auth) {
      return {
        success: false,
        permitido: false,
        motivo: "firebase_no_disponible",
        mensaje: "El servicio no está disponible. Verifica tu conexión e intenta de nuevo.",
      };
    }
    // Error de red transitorio — permitir para no bloquear al docente innecesariamente
    return { success: false, permitido: true, tipoCoincidencia: "desconocido", requiereCredito: false };
  }
};

export const registrarUsoTemaPlanificacion = async ({
  tituloTema,
  forzarNuevoTema = false,
  contexto = "edicion",
}) => {
  if (!tituloTema || !String(tituloTema).trim()) {
    throw new Error("El tema es obligatorio");
  }

  const user = getCurrentUserOrThrow();
  const userRef = doc(db, "usuarios", user.uid);
  const titulo = String(tituloTema).trim();
  const normalizado = normalizarTema(titulo);
  const isAdmin = esUsuarioDocenteOS(user.email);

  const resultado = await runTransaction(db, async (tx) => {
    const userSnap = await tx.get(userRef);
    const userData = userSnap.exists() ? userSnap.data() : {};

    const temaActivo = userData?.temaActivo || null;
    const temaSecundario = userData?.temaSecundario || null;
    const activoNorm = normalizarTema(temaActivo?.titulo || temaActivo || "");
    const secundarioNorm = normalizarTema(temaSecundario?.titulo || temaSecundario || "");

    const creditos = resolverCreditosDisponibles(userData);
    const ilimitado = tieneSuscripcionIlimitada(userData);
    const puedeNuevoTema = isAdmin || ilimitado || creditos > 0;

    if (normalizado === activoNorm) {
      tx.update(userRef, {
        temaActivo: {
          ...temaActivo,
          ...actualizarTemaFirestore(titulo, "activo"),
        },
        actualizadoEn: serverTimestamp(),
      });
      return { slot: "activo", consumioCredito: false, reemplazo: false };
    }

    if (normalizado === secundarioNorm) {
      tx.update(userRef, {
        temaSecundario: {
          ...temaSecundario,
          ...actualizarTemaFirestore(titulo, "secundario"),
        },
        actualizadoEn: serverTimestamp(),
      });
      return { slot: "secundario", consumioCredito: false, reemplazo: false };
    }

    if (!activoNorm) {
      tx.set(
        userRef,
        {
          temaActivo: crearTemaFirestore(titulo, "activo"),
          actualizadoEn: serverTimestamp(),
        },
        { merge: true }
      );
      return { slot: "activo", consumioCredito: false, reemplazo: false };
    }

    if (!secundarioNorm) {
      tx.set(
        userRef,
        {
          temaSecundario: crearTemaFirestore(titulo, "secundario"),
          actualizadoEn: serverTimestamp(),
        },
        { merge: true }
      );
      return { slot: "secundario", consumioCredito: false, reemplazo: false };
    }

    if (!forzarNuevoTema) {
      throw new Error("Ya tienes dos temas activos. Para crear un tercer tema debes usar un nuevo crédito.");
    }

    if (!puedeNuevoTema) {
      throw new Error("No hay créditos ni suscripción habilitada para crear un nuevo tema.");
    }

    const nuevoActivo = crearTemaFirestore(titulo, "activo");
    const nuevoSecundario = {
      ...(temaActivo || {}),
      ...actualizarTemaFirestore(temaActivo?.titulo || "", "secundario"),
    };

    const patch = {
      temaActivo: nuevoActivo,
      temaSecundario: nuevoSecundario,
      actualizadoEn: serverTimestamp(),
    };

    // Compatibilidad con esquemas históricos de créditos.
    if (!isAdmin && !ilimitado) {
      if (Number.isFinite(Number(userData?.creditosPlanificacionDisponibles))) {
        patch.creditosPlanificacionDisponibles = Math.max(0, Number(userData.creditosPlanificacionDisponibles) - 1);
      } else if (Number.isFinite(Number(userData?.creditosDisponibles))) {
        patch.creditosDisponibles = Math.max(0, Number(userData.creditosDisponibles) - 1);
      } else if (Number.isFinite(Number(userData?.creditos))) {
        patch.creditos = Math.max(0, Number(userData.creditos) - 1);
      }
    }

    tx.set(userRef, patch, { merge: true });

    return {
      slot: "activo",
      consumioCredito: !isAdmin && !ilimitado,
      reemplazo: true,
      temaReemplazado: temaSecundario?.titulo || null,
      temaMovidoSecundario: temaActivo?.titulo || null,
    };
  });

  // Historial fuera de transacción para mantener compatibilidad con incrementos.
  await upsertHistorialTema({
    uid: user.uid,
    titulo,
    estado: "activo",
    activo: true,
    incrementarEdiciones: contexto === "edicion" || contexto === "generacion",
  });

  if (resultado?.reemplazo && resultado?.temaReemplazado) {
    await desactivarTemaEnHistorial({ uid: user.uid, titulo: resultado.temaReemplazado, estado: "historial" });
  }

  if (resultado?.reemplazo && resultado?.temaMovidoSecundario) {
    await upsertHistorialTema({
      uid: user.uid,
      titulo: resultado.temaMovidoSecundario,
      estado: "secundario",
      activo: true,
      incrementarEdiciones: false,
    });
  }

  await registrarEventoAuditoria({
    tipo: "planificacion",
    evento: "uso_tema_planificacion",
    modulo: "planificacion",
    detalle: {
      tema: titulo,
      slot: resultado?.slot || "activo",
      contexto,
      consumioCredito: Boolean(resultado?.consumioCredito),
    },
  });

  return { success: true, ...resultado };
};

export const registrarUsoPDFTema = async ({ tituloTema }) => {
  if (!tituloTema) return { success: true };
  try {
    const user = getCurrentUserOrThrow();
    const ref = refHistorialTema(user.uid, tituloTema);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        cantidadPDF: increment(1),
        fechaUltimaEdicion: serverTimestamp(),
        actualizadoEn: serverTimestamp(),
      });
    } else {
      await setDoc(
        ref,
        {
          titulo: tituloTema,
          fechaInicio: serverTimestamp(),
          fechaUltimaEdicion: serverTimestamp(),
          cantidadEdiciones: 0,
          cantidadPDF: 1,
          cantidadInstrumentos: 0,
          estado: "activo",
          activo: true,
          actualizadoEn: serverTimestamp(),
        },
        { merge: true }
      );
    }
    return { success: true };
  } catch (error) {
    console.error("Error al registrar uso PDF por tema:", error);
    return { success: false };
  }
};

export const registrarUsoInstrumentoTema = async ({ tituloTema }) => {
  if (!tituloTema) return { success: true };
  try {
    const user = getCurrentUserOrThrow();
    const ref = refHistorialTema(user.uid, tituloTema);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        cantidadInstrumentos: increment(1),
        fechaUltimaEdicion: serverTimestamp(),
        actualizadoEn: serverTimestamp(),
      });
    } else {
      await setDoc(
        ref,
        {
          titulo: tituloTema,
          fechaInicio: serverTimestamp(),
          fechaUltimaEdicion: serverTimestamp(),
          cantidadEdiciones: 0,
          cantidadPDF: 0,
          cantidadInstrumentos: 1,
          estado: "activo",
          activo: true,
          actualizadoEn: serverTimestamp(),
        },
        { merge: true }
      );
    }
    return { success: true };
  } catch (error) {
    console.error("Error al registrar uso de instrumentos por tema:", error);
    return { success: false };
  }
};