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
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

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
  console.warn("Firebase no configurado: se ejecuta en modo local sin conexión.");
}

export { db, auth };

// Función para guardar planificación en Firestore
export const guardarPlanificacion = async (planificacion) => {
  try {
    if (!isFirebaseConfigured || !auth || !db) {
      throw new Error("Firebase no configurado");
    }

    const user = auth.currentUser;
    if (!user) {
      throw new Error("Usuario no autenticado");
    }

    const docRef = await addDoc(collection(db, "planificaciones"), {
      curso: planificacion.curso,
      periodo: planificacion.periodo,
      tema: planificacion.tema,
      competencia: planificacion.competencia,
      resultado: planificacion.resultado,
      usuario: user.uid,
      usuarioEmail: user.email,
      fecha: serverTimestamp(),
      createdAt: new Date().toISOString(),
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
    if (!isFirebaseConfigured || !auth || !db) {
      throw new Error("Firebase no configurado");
    }

    const user = auth.currentUser;
    if (!user) {
      throw new Error("Usuario no autenticado");
    }

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
      await setDoc(doc(db, "horariosCursos", `${user.uid}_${cursoId}`), {
        cursoId,
        usuario: user.uid,
        horario,
        updatedAt: serverTimestamp(),
      });
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
        fecha: serverTimestamp(),
        createdAt,
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
      await deleteDoc(doc(db, "planificaciones", String(planificacionId)));
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
      await setDoc(doc(db, "registrosCalificaciones", `${user.uid}_${cursoId}`), {
        ...payload,
        usuario: user.uid,
        usuarioEmail: user.email,
        updatedAt: serverTimestamp(),
      });
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