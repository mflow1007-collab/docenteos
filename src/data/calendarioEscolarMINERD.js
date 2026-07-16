/**
 * calendarioEscolarMINERD — Calendario escolar oficial + feriados (HITO 3.2).
 *
 * Módulo PURO (sin Firebase, testeable en Node). Fuente única para que las
 * fechas de DocenteOS respeten el año lectivo real: el hilo pedagógico anota
 * las clases cuya fechaSugerida cae en día no lectivo (NO las mueve — esa
 * decisión es del docente).
 *
 * ACTUALIZACIÓN ANUAL: cuando el MINERD publique el PDF detallado del
 * calendario, se agrega/ajusta la entrada del año en CALENDARIOS_ESCOLARES
 * (los recesos marcados `estimado: true` se sustituyen por las fechas
 * oficiales y se cambia estado a "oficial-pdf"). Nada más que tocar.
 */

// ── Datos por año escolar ──────────────────────────────────────────────────────

export const CALENDARIOS_ESCOLARES = {
  "2026-2027": {
    estado: "aprobado-cne", // → "oficial-pdf" cuando el MINERD publique el PDF detallado
    fuente: "Aprobado por el Consejo Nacional de Educación el 10-jun-2026; fechas clave publicadas por MINERD/prensa (hoy.com.do 1090417)",
    docentes:    { inicio: "2026-08-03", fin: "2027-06-25", semanas: 45 },
    estudiantes: { inicio: "2026-08-24", fin: "2027-06-18", semanas: 40, diasLaborables: 190 },
    bancoTiempo: "2 semanas calendario de recuperación de docencia",
    // Feriados nacionales OBSERVADOS dentro del año lectivo (Ley 139-97:
    // 6-ene, 26-ene, 1-may, 16-ago y 6-nov se trasladan a lunes cuando caen
    // mar/mié → lunes anterior, jue/vie → lunes siguiente; el resto es fijo).
    feriados: [
      { fecha: "2026-09-24", nombre: "Nuestra Señora de las Mercedes" },
      { fecha: "2026-11-09", nombre: "Día de la Constitución (trasladado del 6-nov)" },
      { fecha: "2026-12-25", nombre: "Navidad" },
      { fecha: "2027-01-01", nombre: "Año Nuevo" },
      { fecha: "2027-01-04", nombre: "Día de Reyes (trasladado del 6-ene)" },
      { fecha: "2027-01-21", nombre: "Nuestra Señora de la Altagracia" },
      { fecha: "2027-01-25", nombre: "Día de Duarte (trasladado del 26-ene)" },
      { fecha: "2027-03-26", nombre: "Viernes Santo" },
      { fecha: "2027-05-27", nombre: "Corpus Christi" },
    ],
    // Recesos escolares: ESTIMADOS por patrón histórico hasta el PDF oficial
    recesos: [
      { inicio: "2026-12-21", fin: "2027-01-06", nombre: "Receso navideño", estimado: true },
      { inicio: "2027-03-22", fin: "2027-03-26", nombre: "Semana Santa", estimado: true },
    ],
  },
};

// ── Helpers puros ──────────────────────────────────────────────────────────────

const _iso = (v) => String(v || "").slice(0, 10);

/** Calendario cuyo año lectivo (rango docente) contiene la fecha. */
export const calendarioParaFecha = (fechaISO) => {
  const f = _iso(fechaISO);
  if (!f) return null;
  for (const [anio, cal] of Object.entries(CALENDARIOS_ESCOLARES)) {
    if (f >= cal.docentes.inicio && f <= cal.docentes.fin) return { anio, ...cal };
  }
  return null;
};

/**
 * ¿La fecha es día NO lectivo? → { nombre, tipo: "feriado"|"receso"|"fin-de-semana",
 * estimado } o null si es lectiva. Sin calendario cargado para esa fecha, solo
 * marca fines de semana (nunca inventa feriados).
 */
export const diaNoLectivo = (fechaISO) => {
  const f = _iso(fechaISO);
  if (!f) return null;
  const d = new Date(`${f}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const dow = d.getDay();
  if (dow === 0 || dow === 6) {
    return { nombre: dow === 0 ? "Domingo" : "Sábado", tipo: "fin-de-semana", estimado: false };
  }
  const cal = calendarioParaFecha(f);
  if (!cal) return null;
  const feriado = (cal.feriados || []).find((x) => x.fecha === f);
  if (feriado) return { nombre: feriado.nombre, tipo: "feriado", estimado: false };
  const receso = (cal.recesos || []).find((x) => f >= x.inicio && f <= x.fin);
  if (receso) return { nombre: receso.nombre, tipo: "receso", estimado: receso.estimado === true };
  return null;
};

export const esDiaLectivo = (fechaISO) => diaNoLectivo(fechaISO) === null;

/** Próximo día lectivo estrictamente posterior (tope de búsqueda: 30 días). */
export const proximoDiaLectivo = (fechaISO) => {
  const f = _iso(fechaISO);
  if (!f) return "";
  const d = new Date(`${f}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  for (let i = 0; i < 30; i++) {
    d.setDate(d.getDate() + 1);
    const candidata = d.toISOString().slice(0, 10);
    if (esDiaLectivo(candidata)) return candidata;
  }
  return "";
};
