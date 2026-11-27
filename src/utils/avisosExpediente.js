/**
 * E2d-2 (auditoría 2026-11-27): texto para el docente cuando la evaluación se
 * guardó pero el expediente de algunos estudiantes no. Volver a guardar es
 * seguro: el resultado y la evidencia tienen id determinista y el expediente
 * fusiona por id.
 */
export const mensajeAvisosExpediente = (avisos = []) => (avisos.length
  ? `⚠️ Evaluación guardada y Mi Registro actualizado, pero no se actualizó el expediente de ${avisos.map((a) => a.nombre).join(", ")}. Revisa la conexión y vuelve a guardar la evaluación de ${avisos.length === 1 ? "ese estudiante" : "esos estudiantes"}.`
  : "");
