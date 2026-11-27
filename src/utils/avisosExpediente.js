/**
 * E2d-2 / E2e (auditoría 2026-11-27): texto para el docente cuando la evaluación
 * se guardó pero algo secundario no llegó a la nube. El texto dice qué falló:
 * si fue la nota, NO puede decir "Mi Registro actualizado". Volver a guardar es
 * seguro: ids deterministas, fusión por id y la regla 12 en transacción.
 */
const DEL_REGISTRO = new Set(["nota", "aspecto"]);
const DEL_EXPEDIENTE = new Set(["expediente", "evidencia", "puente"]);

export const mensajeAvisosExpediente = (avisos = []) => {
  if (!avisos.length) return "";
  const nombres = avisos.map((a) => a.nombre).join(", ");
  const cuales = avisos.length === 1 ? "ese estudiante" : "esos estudiantes";
  const fallos = avisos.flatMap((a) => a.fallosNube || []);
  if (fallos.some((f) => DEL_REGISTRO.has(f))) {
    const partes = ["la nota en Mi Registro", fallos.some((f) => DEL_EXPEDIENTE.has(f)) && "el expediente"].filter(Boolean);
    return `⚠️ La evaluación se guardó, pero no se actualizó ${partes.join(" ni ")} de ${nombres}. Revisa la conexión y vuelve a guardar la evaluación de ${cuales}.`;
  }
  return `⚠️ Evaluación guardada y Mi Registro actualizado, pero no se actualizó el expediente de ${nombres}. Revisa la conexión y vuelve a guardar la evaluación de ${cuales}.`;
};
