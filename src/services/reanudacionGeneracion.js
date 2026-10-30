/**
 * reanudacionGeneracion — si una fase de la unidad no sale, DocenteOS espera y
 * vuelve a lanzar la generación sola. Los lotes ya aceptados quedan en caché
 * (phaseAService, 12 h), así que cada vuelta solo rehace lo que falta.
 *
 * Reglas (acordadas con César, 2026-10-30):
 * - Hasta 2 vueltas extra (3 en total), con 30 s de espera entre vueltas.
 * - Solo errores marcados `reanudable` (fase fallida por proveedor o validador);
 *   con créditos agotados u otro error (malla, plan maestro…) se detiene igual.
 * - Tras la última vuelta, el error original llega al docente: nunca plantilla.
 */

export const VUELTAS_EXTRA = 2;
export const ESPERA_MS = 30_000;

const esperarMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {(vuelta: number) => Promise<any>} generar
 * @param {{vueltasExtra?: number, esperaMs?: number, onAviso?: (texto: string) => void, esperar?: (ms: number) => Promise<void>}} [opciones]
 */
export const conReanudacion = async (generar, {
  vueltasExtra = VUELTAS_EXTRA,
  esperaMs = ESPERA_MS,
  onAviso = null,
  esperar = esperarMs,
} = {}) => {
  for (let vuelta = 1; ; vuelta++) {
    try {
      return await generar(vuelta);
    } catch (err) {
      if (!err?.reanudable || vuelta > vueltasExtra) throw err;
      const fase = err.faseFallida ? `La fase ${err.faseFallida}` : "Una fase";
      onAviso?.(
        `🔁 ${fase} no salió. DocenteOS lo reintenta solo en ${Math.round(esperaMs / 1000)} s ` +
        `(vuelta ${vuelta + 1} de ${vueltasExtra + 1}); lo ya redactado no se repite.`
      );
      await esperar(esperaMs);
    }
  }
};
