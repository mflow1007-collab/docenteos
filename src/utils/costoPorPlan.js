/**
 * Etapa D — costo de IA por plan (unidad / secuencia).
 *
 * Cada lote de la unidad lleva el permiso del cupo de la Etapa E
 * ({ planId, clave }); aiLogs guarda ese planId en cada registro. Como el mismo
 * planId se reutiliza al regenerar el plan, agrupar por planId da el costo real
 * de un plan con sus reintentos y reanudaciones. Funciones puras (sin Firebase).
 */

/** Campos de aiLogs que atan un registro a su plan. Sin cupo → sin campos. */
export function camposCupo(cupo) {
  const planId = typeof cupo?.planId === "string" ? cupo.planId.slice(0, 80) : "";
  if (!planId) return {};
  const clave = typeof cupo?.clave === "string" ? cupo.clave.slice(0, 200) : "";
  return clave ? { planId, claveCupo: clave } : { planId };
}

const aMs = (fecha) => {
  if (!fecha) return 0;
  if (typeof fecha.toMillis === "function") return fecha.toMillis();
  if (typeof fecha.toDate === "function") return fecha.toDate().getTime();
  const t = new Date(fecha).getTime();
  return Number.isFinite(t) ? t : 0;
};

const costoDe = (log) => parseFloat(log.costoEstimado) || 0;

/** Llamada facturada: sin etiqueta de diagnóstico, sin error y fuera de caché. */
const esLlamadaPagada = (log) => !log.etiqueta && !log.error && !log.cache;

const mediana = (ordenados) => {
  const n = ordenados.length;
  if (!n) return 0;
  const m = Math.floor(n / 2);
  return n % 2 ? ordenados[m] : (ordenados[m - 1] + ordenados[m]) / 2;
};

/**
 * Agrupa registros de aiLogs por planId.
 * @returns {{ planes: Object[], resumen: Object|null, sinPlan: { llamadas: number, costo: number } }}
 *   planes: uno por planId, del más reciente al más antiguo.
 *   resumen: mínimo / mediana / media / máximo del costo por plan (null sin planes).
 *   sinPlan: llamadas pagadas del módulo "planificacion" sin planId (registros
 *   anteriores a esta medición o generaciones sin cupo).
 */
export function costoPorPlan(logs = []) {
  const porPlan = new Map();
  const sinPlan = { llamadas: 0, costo: 0 };

  for (const log of logs) {
    if (!log) continue;
    if (!log.planId) {
      if (log.modulo === "planificacion" && esLlamadaPagada(log)) {
        sinPlan.llamadas += 1;
        sinPlan.costo += costoDe(log);
      }
      continue;
    }
    let p = porPlan.get(log.planId);
    if (!p) {
      p = {
        planId: log.planId,
        claveCupo: log.claveCupo || "",
        llamadas: 0,
        rechazadas: 0,
        fasesFallidas: 0,
        tokensEntrada: 0,
        tokensSalida: 0,
        costo: 0,
        inicio: Infinity,
        fin: 0,
      };
      porPlan.set(log.planId, p);
    }
    if (!p.claveCupo && log.claveCupo) p.claveCupo = log.claveCupo;
    const t = aMs(log.fecha);
    if (t) {
      p.inicio = Math.min(p.inicio, t);
      p.fin = Math.max(p.fin, t);
    }
    if (esLlamadaPagada(log)) {
      p.llamadas += 1;
      p.tokensEntrada += log.tokensEntrada || 0;
      p.tokensSalida += log.tokensSalida || 0;
      p.costo += costoDe(log);
    } else if (log.etiqueta === "fase_a_parse_error" && (log.tokensSalida || 0) > 0) {
      // Respuesta que se pagó y luego rechazó un validador (se reintenta)
      p.rechazadas += 1;
    } else if (log.etiqueta === "fase_redaccion_fallida") {
      p.fasesFallidas += 1;
    }
  }

  const planes = [...porPlan.values()]
    .map((p) => ({ ...p, inicio: Number.isFinite(p.inicio) ? p.inicio : 0 }))
    .sort((a, b) => b.inicio - a.inicio);

  const costos = planes.filter((p) => p.llamadas > 0).map((p) => p.costo).sort((a, b) => a - b);
  const resumen = costos.length
    ? {
        planes: costos.length,
        minimo: costos[0],
        mediana: mediana(costos),
        media: costos.reduce((s, c) => s + c, 0) / costos.length,
        maximo: costos[costos.length - 1],
      }
    : null;

  return { planes, resumen, sinPlan };
}
