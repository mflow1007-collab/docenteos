import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";

import { auth } from "./firebase";
import { limpiarSesionPlanificacion } from "./services/planificacionSesionCache.js";

export const register = (email, pass) =>
  createUserWithEmailAndPassword(auth, email, pass);

export const login = (email, pass) =>
  signInWithEmailAndPassword(auth, email, pass);

export const cerrarSesion = () => {
  // Limpiar datos del docente antes de cerrar sesión (dispositivos compartidos).
  // Prefijo "docenteos" SIN guion: cubre tanto docenteos_* como
  // docenteos.detalle-estudiante.* (datos personales de estudiantes que el
  // filtro anterior con "docenteos_" dejaba vivos tras el logout). "doe_"
  // cubre flags de UI (doe_entrenar_visto).
  Object.keys(localStorage)
    .filter((k) => k.startsWith("docenteos") || k.startsWith("doe_"))
    .forEach((k) => localStorage.removeItem(k));
  limpiarSesionPlanificacion();
  return signOut(auth);
};