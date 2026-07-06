/**
 * planificacionSesionCache.js
 *
 * Cache en memoria de la sesión de la app (alcance de módulo).
 * Conserva los resultados generados cuando el docente navega a otro menú
 * y regresa a Planificación (el componente se desmonta y se vuelve a montar,
 * perdiendo su estado local).
 *
 * - Se pierde al recargar la página: lo permanente vive en el historial
 *   (Firestore) cuando el docente guarda.
 * - Debe limpiarse al cerrar sesión para no filtrar datos entre usuarios
 *   en el mismo navegador.
 */

const sesion = new Map();

export const leerSesion = (clave, porDefecto = null) =>
  sesion.has(clave) ? sesion.get(clave) : porDefecto;

export const guardarSesion = (clave, valor) => {
  if (valor === null || valor === undefined) sesion.delete(clave);
  else sesion.set(clave, valor);
};

export const limpiarSesionPlanificacion = () => sesion.clear();
