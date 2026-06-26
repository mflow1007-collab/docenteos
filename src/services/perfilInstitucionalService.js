import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase.js'

/**
 * Lee el perfilInstitucional de un usuario desde Firestore.
 * Devuelve null si no existe o si Firebase no está configurado.
 */
export async function obtenerPerfilInstitucional(uid) {
  if (!db || !uid) return null
  try {
    const snap = await getDoc(doc(db, 'usuarios', uid))
    return snap.data()?.perfilInstitucional ?? null
  } catch (err) {
    console.error('[perfilInstitucionalService] Error al obtener perfil:', err)
    return null
  }
}

/**
 * Guarda o actualiza el perfilInstitucional en Firestore.
 * Usa merge para no pisar otros campos del documento de usuario.
 */
export async function guardarPerfilInstitucional(uid, datos) {
  if (!db || !uid) throw new Error('Sin conexión o usuario no identificado.')
  if (!auth?.currentUser || auth.currentUser.uid !== uid) {
    throw new Error('No autorizado para actualizar este perfil.')
  }
  await setDoc(
    doc(db, 'usuarios', uid),
    {
      perfilInstitucional: {
        ...datos,
        perfilCompletado: true,
        actualizadoEn: serverTimestamp(),
      },
      perfilInstitucionalCompleto: true,
      perfilActualizadoEn: serverTimestamp(),
    },
    { merge: true }
  )
}

/**
 * Convierte el perfilInstitucional almacenado en un objeto plano
 * listo para inyectar en cualquier formulario de planificación.
 *
 * Maneja tanto la estructura legacy (campos simples) como la actual
 * (arrays: nivelesDocente, ciclos, nivelesCentro).
 */
export function normalizarPerfilParaFormulario(perfil) {
  if (!perfil) return {}

  // Nivel: preferir nivelesDocente[], caer en nivel string
  const nivelesDocente = Array.isArray(perfil.nivelesDocente)
    ? perfil.nivelesDocente
    : perfil.nivel
      ? [perfil.nivel]
      : []

  const nivelPrimario = nivelesDocente[0] ?? ''

  // Ciclo: strips level prefix ("Primaria - Primer Ciclo..." → "Primer Ciclo...")
  const ciclosArr = Array.isArray(perfil.ciclos)
    ? perfil.ciclos
    : perfil.ciclo
      ? [perfil.ciclo]
      : []

  const cicloPrimario = ciclosArr[0]
    ? ciclosArr[0].replace(/^[^-]+ - /, '')
    : ''

  return {
    nombreDocente:   perfil.nombreDocente   ?? '',
    regional:        perfil.regional        ?? '',
    distrito:        perfil.distrito        ?? '',
    centro:          perfil.centroEducativo  ?? '',   // mapeo centroEducativo → centro
    codigoCentro:    perfil.codigoCentro    ?? '',
    nivel:           nivelPrimario,
    nivelesDocente,
    modalidad:       perfil.modalidad       ?? '',
    ciclo:           cicloPrimario,
    ciclos:          ciclosArr,
    jornada:         perfil.jornadaEscolar  ?? '',
    periodo:         perfil.periodoEscolar  ?? '',
  }
}
