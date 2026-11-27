/**
 * Nota del Registro por aspecto (registroNotas). Módulo puro.
 * E2e (auditoría 2026-11-27): el payload se sacó de guardarRegistroNota
 * (src/firebase.js) para que la ruta de instrumentos use exactamente el mismo.
 */

// Payload de una nota del Registro (antes, en línea dentro de guardarRegistroNota).
export const construirPayloadNota = (nota) => {
  const notaId = String(nota.notaId || `${nota.estudianteId}_${nota.aspectoId}`);
  const puntajeMaximo = Number(nota.puntajeMaximo) || 0;
  const valorObtenido = nota.valorObtenido === "" || nota.valorObtenido === null || nota.valorObtenido === undefined
    ? ""
    : Number(nota.valorObtenido);
  const porcentaje = puntajeMaximo > 0 && valorObtenido !== "" ? Math.round((Number(valorObtenido) / puntajeMaximo) * 100) : null;
  return {
    ...nota,
    notaId,
    id: notaId,
    valorObtenido,
    puntajeMaximo,
    porcentaje,
    fechaActualizacion: new Date().toISOString(),
  };
};

const esNumero = (v) => v !== "" && v !== null && v !== undefined && Number.isFinite(Number(v));

// E2e — Regla 12: si el docente ajustó la nota a mano, el cálculo automático
// NUNCA pisa valorObtenido; solo actualiza valorCalculado y marca desactualizado.
// desactualizado solo se calcula si ambos valores son números válidos (sin NaN);
// si no se puede comparar, se conserva lo que había.
export const aplicarAjusteManual = (nueva, previa) => {
  if (!previa?.ajusteManual) return nueva;
  const desactualizado = esNumero(previa.valorObtenido) && esNumero(nueva.valorCalculado)
    ? Number(previa.valorObtenido) !== Number(nueva.valorCalculado)
    : Boolean(previa.desactualizado);
  return {
    ...nueva,
    valorObtenido: previa.valorObtenido,
    ajusteManual: true,
    motivoAjuste: previa.motivoAjuste || "",
    desactualizado,
  };
};
