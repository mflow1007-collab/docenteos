/**
 * Caché en memoria del Banco Pedagógico Firestore.
 * Se precalienta justo antes de generar una planificación.
 * Las funciones síncronas de generación lo consultan antes del banco estático.
 */

import { buscarActividadesBP } from './bancoPedagogicoService.js';

let _actividades = [];

/**
 * Carga actividades oficiales del Banco Pedagógico para un área y grado.
 * Llámalo antes de generarUnidadAprendizaje / generarPlanificacion.
 */
export async function precargarBP(area, grado) {
  try {
    _actividades = await buscarActividadesBP({ area, grados: grado ? [grado] : [] });
  } catch {
    _actividades = [];
  }
}

/**
 * Retorna las instrucciones de una actividad oficial para el momento pedido,
 * rotando por diaNum para dar variedad. Retorna null si no hay coincidencia.
 */
export function obtenerBPActs(area, momento, diaNum = 0) {
  const matches = _actividades.filter(
    (a) => a.area === area && a.momento === momento
  );
  if (!matches.length) return null;
  const item = matches[diaNum % matches.length];
  const instrucciones = item.instrucciones;
  if (!Array.isArray(instrucciones) || instrucciones.length === 0) return null;
  return instrucciones;
}

export function limpiarCacheBP() {
  _actividades = [];
}
