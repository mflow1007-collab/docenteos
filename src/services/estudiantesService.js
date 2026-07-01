import {
  collection, doc, setDoc, getDocs, deleteDoc, serverTimestamp, query, where
} from "firebase/firestore"
import { auth, db } from "../firebase.js"

function uid() {
  return auth?.currentUser?.uid ?? null
}

/**
 * Guarda un estudiante en la subcollección usuarios/{uid}/estudiantes.
 * Usa merge:true — no pisa datos previos (notas, asistencia, etc.).
 */
export async function guardarEstudianteEnSubcoleccion(cursoId, nombre, id = null) {
  if (!db || !uid()) return null
  const estId = id || `est-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  await setDoc(
    doc(db, "usuarios", uid(), "estudiantes", estId),
    { id: estId, nombre, cursoId, promedio: null, asistencia: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
    { merge: true }
  )
  return estId
}

/**
 * Guarda varios estudiantes en lote. Devuelve los IDs creados.
 */
export async function guardarEstudiantesEnSubcoleccion(cursoId, nombres = []) {
  if (!db || !uid() || !nombres.length) return []
  const ids = []
  for (const nombre of nombres) {
    const id = await guardarEstudianteEnSubcoleccion(cursoId, nombre)
    if (id) ids.push(id)
  }
  return ids
}

/**
 * Lee todos los estudiantes de un curso desde la subcollección.
 * Retorna [] si Firebase no está configurado.
 */
export async function obtenerEstudiantesPorCurso(cursoId) {
  if (!db || !uid()) return []
  const snap = await getDocs(
    query(collection(db, "usuarios", uid(), "estudiantes"), where("cursoId", "==", cursoId))
  )
  return snap.docs.map(d => ({ ...d.data(), id: d.id }))
}

/**
 * Elimina un estudiante de la subcollección.
 */
export async function eliminarEstudianteDeSubcoleccion(estId) {
  if (!db || !uid() || !estId) return
  await deleteDoc(doc(db, "usuarios", uid(), "estudiantes", estId))
}
