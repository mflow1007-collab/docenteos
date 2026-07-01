import { db } from '../firebase.js'
import {
  doc, getDoc, setDoc, updateDoc, getDocs,
  query, collection, where,
  serverTimestamp, arrayUnion,
} from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

/**
 * Lee un centro por su codigoCentro (MINERD).
 * @returns {Object|null}
 */
export async function obtenerCentro(centroId) {
  if (!db || !centroId) return null
  try {
    const snap = await getDoc(doc(db, 'centros', String(centroId)))
    return snap.exists() ? { id: snap.id, ...snap.data() } : null
  } catch (err) {
    console.error('[centroService] obtenerCentro:', err)
    return null
  }
}

/**
 * Crea o actualiza el documento del centro en la colección `centros/`.
 * Agrega automáticamente el uid del usuario actual al array `docentes`.
 * Es idempotente: no borra datos existentes gracias a merge + arrayUnion.
 */
export async function crearOActualizarCentro({
  centroId,
  nombre,
  regional,
  distrito,
  municipio,
  modalidad,
}) {
  if (!db || !centroId) return
  const uid = getAuth().currentUser?.uid || null
  const ref = doc(db, 'centros', String(centroId))

  try {
    const snap = await getDoc(ref)

    if (snap.exists()) {
      const patch = { actualizadoEn: serverTimestamp() }
      if (nombre)    patch.nombre    = nombre
      if (regional)  patch.regional  = regional
      if (distrito)  patch.distrito  = distrito
      if (municipio) patch.municipio = municipio
      if (modalidad) patch.modalidad = modalidad
      if (uid)       patch.docentes  = arrayUnion(uid)
      await updateDoc(ref, patch)
    } else {
      await setDoc(ref, {
        id:           String(centroId),
        nombre:       nombre    || '',
        regional:     regional  || '',
        distrito:     distrito  || '',
        municipio:    municipio || '',
        modalidad:    modalidad || '',
        docentes:     uid ? [uid] : [],
        creadoEn:     serverTimestamp(),
        actualizadoEn: serverTimestamp(),
      }, { merge: true })
    }
  } catch (err) {
    console.error('[centroService] crearOActualizarCentro:', err)
  }
}

/**
 * Devuelve todos los usuarios que tienen centroId == centroId.
 * Requiere índice compuesto en Firestore: usuarios.centroId ASC.
 * @returns {Array}
 */
export async function listarDocentesDeCentro(centroId) {
  if (!db || !centroId) return []
  try {
    const snap = await getDocs(
      query(collection(db, 'usuarios'), where('centroId', '==', String(centroId)))
    )
    return snap.docs.map((d) => ({ uid: d.id, ...d.data() }))
  } catch (err) {
    console.error('[centroService] listarDocentesDeCentro:', err)
    return []
  }
}
