import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";

import { auth } from "./firebase";

export const register = (email, pass) =>
  createUserWithEmailAndPassword(auth, email, pass);

export const login = (email, pass) =>
  signInWithEmailAndPassword(auth, email, pass);

export const cerrarSesion = () => {
  // Limpiar datos del docente antes de cerrar sesión (dispositivos compartidos)
  Object.keys(localStorage)
    .filter((k) => k.startsWith("docenteos_"))
    .forEach((k) => localStorage.removeItem(k));
  return signOut(auth);
};