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

export const logout = () =>
  signOut(auth);

export const cerrarSesion = () =>
  signOut(auth);