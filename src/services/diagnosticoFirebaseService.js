/**
 * diagnosticoFirebaseService.js — Persistencia del diagnóstico en Firestore.
 *
 * Fuente de verdad en la nube: subcolección usuarios/{uid}/diagnosticos.
 * Da durabilidad entre dispositivos (antes solo localStorage, que se pierde al
 * cambiar de navegador o limpiar la caché). El servicio de alto nivel
 * (diagnosticoService.js) mantiene un cache local que se sincroniza desde aquí,
 * para que las lecturas síncronas (p. ej. el puente a planificación) sigan
 * funcionando sin reescribir toda la cadena como async.
 *
 * Si Firebase no está configurado o no hay sesión, todas las funciones degradan
 * a no-op / [] y el módulo sigue operando solo con localStorage (fail-soft).
 */
import { collection, doc, setDoc, getDocs, deleteDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase.js";

const uid = () => auth?.currentUser?.uid ?? null;
export const firebaseDisponible = () => Boolean(db && uid());

// Guarda (crea o actualiza) un diagnóstico. merge:true no pisa campos previos.
export async function guardarDiagnosticoFirebase(diagnostico) {
  if (!firebaseDisponible() || !diagnostico?.id) return null;
  await setDoc(
    doc(db, "usuarios", uid(), "diagnosticos", diagnostico.id),
    { ...diagnostico, updatedAtServer: serverTimestamp() },
    { merge: true }
  );
  return diagnostico.id;
}

// Lee todos los diagnósticos del docente autenticado.
export async function listarDiagnosticosFirebase() {
  if (!firebaseDisponible()) return [];
  const snap = await getDocs(collection(db, "usuarios", uid(), "diagnosticos"));
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
}

// Elimina un diagnóstico.
export async function eliminarDiagnosticoFirebase(diagId) {
  if (!firebaseDisponible() || !diagId) return;
  await deleteDoc(doc(db, "usuarios", uid(), "diagnosticos", diagId));
}
