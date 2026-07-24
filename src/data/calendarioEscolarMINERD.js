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
    estado: "oficial", // afiche oficial del MINERD (aportado por el dueño, 2026-07-16)
    fuente: "Calendario Escolar oficial MINERD 2026-2027 (afiche; CNE 10-jun-2026). 190 días laborables.",
    docentes:    { inicio: "2026-08-03", fin: "2027-06-25", semanas: 45 },
    estudiantes: { inicio: "2026-08-24", fin: "2027-06-18", semanas: 40, diasLaborables: 190 },
    bancoTiempo: "2 semanas calendario de recuperación de docencia",
    // Feriados nacionales del AFICHE OFICIAL (los "movidos" ya vienen movidos)
    feriados: [
      { fecha: "2026-08-16", nombre: "Día de la Restauración" },
      { fecha: "2026-09-24", nombre: "Nuestra Señora de las Mercedes" },
      { fecha: "2026-11-09", nombre: "Día de la Constitución (movido)" },
      { fecha: "2026-12-25", nombre: "Navidad" },
      { fecha: "2027-01-01", nombre: "Año Nuevo" },
      { fecha: "2027-01-04", nombre: "Santos Reyes (movido)" },
      { fecha: "2027-01-21", nombre: "Nuestra Señora de la Altagracia" },
      { fecha: "2027-01-25", nombre: "Natalicio de Juan Pablo Duarte (movido)" },
      { fecha: "2027-02-27", nombre: "Independencia Nacional" },
      { fecha: "2027-03-26", nombre: "Viernes Santo" },
      { fecha: "2027-05-03", nombre: "Día del Trabajo (movido)" },
      { fecha: "2027-05-27", nombre: "Corpus Christi" },
    ],
    // Recesos escolares: el afiche NO los marca — siguen estimados por patrón
    // histórico hasta ver la resolución/PDF con los recesos explícitos
    recesos: [
      { inicio: "2026-12-21", fin: "2027-01-06", nombre: "Receso navideño", estimado: true },
      { inicio: "2027-03-22", fin: "2027-03-26", nombre: "Semana Santa", estimado: true },
    ],
    // Efemérides con CARGA TEMÁTICA: fechas conmemorativas que un docente puede
    // aprovechar como hilo de una unidad. NO son días no lectivos (no bloquean
    // docencia); son ganchos pedagógicos. Cada una declara:
    //   - areas: en qué materias tiene sentido (vacío = todas)
    //   - tema:  clave de tema afín (coincide con AFINIDAD_TEMATICA del asesor)
    //   - gancho: frase corta para la sugerencia en pantalla
    // Solo se sugiere si la efeméride CAE dentro del rango de la unidad, para que
    // el tema se trabaje completo sin interrumpirlo a media unidad.
    efemerides: [
      { fecha: "2026-09-15", nombre: "Semana de la Educación Física / Día del Deporte", areas: ["Educación Física", "Inglés", "Lengua Española"], tema: "actividades de la vida diaria", gancho: "trabajar rutinas, deporte y hábitos saludables (sport & healthy habits)" },
      { fecha: "2026-10-16", nombre: "Día Mundial de la Alimentación", areas: ["Ciencias Naturales", "Inglés", "Lengua Española"], tema: "actividades de la vida diaria", gancho: "trabajar alimentación, comidas y hábitos saludables (food & healthy habits)" },
      { fecha: "2026-11-20", nombre: "Día Universal del Niño", areas: ["Formación Integral Humana y Religiosa", "Lengua Española", "Inglés"], tema: "identificacion personal", gancho: "trabajar derechos, identidad y familia (rights, self & family)" },
      { fecha: "2026-12-10", nombre: "Día de los Derechos Humanos", areas: ["Ciencias Sociales", "Formación Integral Humana y Religiosa", "Lengua Española"], tema: "convivencia y ciudadania", gancho: "trabajar convivencia, derechos y deberes (rights & citizenship)" },
      { fecha: "2027-02-21", nombre: "Día Internacional de la Lengua Materna", areas: ["Lengua Española", "Inglés"], tema: "lengua y comunicacion", gancho: "trabajar lengua, comunicación e identidad cultural" },
      { fecha: "2027-02-27", nombre: "Independencia Nacional", areas: ["Ciencias Sociales", "Lengua Española", "Formación Integral Humana y Religiosa"], tema: "convivencia y ciudadania", gancho: "trabajar patria, ciudadanía e identidad nacional" },
      { fecha: "2027-03-08", nombre: "Día Internacional de la Mujer", areas: ["Ciencias Sociales", "Lengua Española", "Inglés"], tema: "identificacion personal", gancho: "trabajar identidad, roles y familia (self, roles & family)" },
      { fecha: "2027-04-22", nombre: "Día de la Tierra", areas: ["Ciencias Naturales", "Inglés", "Lengua Española"], tema: "medio ambiente", gancho: "trabajar medio ambiente y hábitos sostenibles (environment)" },
      { fecha: "2027-04-23", nombre: "Día Mundial del Libro y del Idioma", areas: ["Lengua Española", "Inglés"], tema: "lengua y comunicacion", gancho: "trabajar lectura, lengua y comunicación" },
      { fecha: "2027-05-15", nombre: "Día Internacional de la Familia", areas: ["Formación Integral Humana y Religiosa", "Lengua Española", "Inglés"], tema: "identificacion personal", gancho: "trabajar familia, relaciones y vida diaria (family & relationships)" },
    ],
    // Entregas de Reportes de Evaluación por nivel (afiche oficial)
    reportesEvaluacion: {
      Inicial:    [{ periodo: "P1", fecha: "2026-12-15" }, { periodo: "P2", fecha: "2027-03-31" }, { periodo: "P3", fecha: "2027-06-22" }],
      Primaria:   [{ periodo: "P1", fecha: "2026-10-30" }, { periodo: "P2", fecha: "2027-01-29" }, { periodo: "P3", fecha: "2027-03-29" }, { periodo: "P4", fecha: "2027-06-11" }],
      Secundaria: [{ periodo: "P1", fecha: "2026-10-30" }, { periodo: "P2", fecha: "2027-01-29" }, { periodo: "P3", fecha: "2027-03-29" }, { periodo: "P4", fecha: "2027-06-01" }],
    },
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

const _fechaLarga = (iso) =>
  new Date(`${_iso(iso)}T12:00:00`).toLocaleDateString("es-DO", { day: "numeric", month: "long", year: "numeric" });

/**
 * ¿Hay DOCENCIA (clases con estudiantes) en la fecha?
 *   { docencia: true }                          → día de clases
 *   { docencia: true, desconocido: true }       → sin calendario cargado (fail-open)
 *   { docencia: false, tipo, motivo, estimado } → finde/feriado/receso/verano/pre-docencia
 */
export const estadoDocencia = (fechaISO) => {
  const f = _iso(fechaISO);
  if (!f) return { docencia: false, tipo: "invalida", motivo: "Fecha inválida" };
  const noLectivo = diaNoLectivo(f);
  if (noLectivo) {
    return {
      docencia: false, tipo: noLectivo.tipo, estimado: noLectivo.estimado,
      motivo: noLectivo.tipo === "fin-de-semana" ? `Fin de semana (${noLectivo.nombre.toLowerCase()})` : noLectivo.nombre,
    };
  }
  const cal = calendarioParaFecha(f);
  if (cal) {
    if (f < cal.estudiantes.inicio) {
      return { docencia: false, tipo: "pre-docencia", motivo: `Semana docente sin estudiantes — la docencia ${cal.anio} inicia el ${_fechaLarga(cal.estudiantes.inicio)}` };
    }
    if (f > cal.estudiantes.fin) {
      return { docencia: false, tipo: "post-docencia", motivo: `La docencia ${cal.anio} concluyó el ${_fechaLarga(cal.estudiantes.fin)}` };
    }
    return { docencia: true };
  }
  // Fuera de todo calendario: es receso anual SOLO si estamos en la ventana
  // de verano previa al próximo año conocido (≤90 días antes de su inicio).
  // Una fecha lejana sin calendario cargado no se declara "sin docencia".
  const proximo = Object.entries(CALENDARIOS_ESCOLARES)
    .filter(([, c]) => c.docentes.inicio > f)
    .sort(([, a], [, b]) => a.docentes.inicio.localeCompare(b.docentes.inicio))[0];
  if (proximo) {
    const diasHasta = (new Date(`${proximo[1].docentes.inicio}T12:00:00`) - new Date(`${f}T12:00:00`)) / 86400000;
    if (diasHasta <= 90) {
      return { docencia: false, tipo: "receso-anual", motivo: `Sin docencia — el año escolar ${proximo[0]} inicia el ${_fechaLarga(proximo[1].estudiantes.inicio)}` };
    }
  }
  return { docencia: true, desconocido: true }; // sin datos: jamás bloquear al docente
};

/** Últimos n días DE DOCENCIA anteriores a la fecha (excluida). Ventana: 30 días. */
export const diasDocenciaPrevios = (fechaISO, n = 7) => {
  const out = [];
  const d = new Date(`${_iso(fechaISO)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return out;
  for (let i = 0; i < 30 && out.length < n; i++) {
    d.setDate(d.getDate() - 1);
    const c = d.toISOString().slice(0, 10);
    const e = estadoDocencia(c);
    if (e.docencia === true && !e.desconocido) out.push(c);
  }
  return out;
};

/**
 * Próxima entrega de Reportes de Evaluación para el nivel (afiche oficial).
 * Busca en TODOS los años cargados la primera entrega >= fecha — así funciona
 * también en verano, apuntando al P1 del año entrante. PURO.
 * @returns {{ periodo, fecha, diasRestantes, anio, nivel }|null}
 */
export const proximaEntregaReportes = (nivel = "", fechaISO = new Date().toISOString().slice(0, 10)) => {
  const f = _iso(fechaISO);
  if (!f) return null;
  const txt = String(nivel || "").toLowerCase();
  const nivelKey = txt.includes("secundaria") ? "Secundaria"
    : txt.includes("primaria") ? "Primaria"
    : (txt.includes("inicial") || txt.includes("kinder") || txt.includes("preprimario")) ? "Inicial"
    : "";
  if (!nivelKey) return null;
  let mejor = null;
  for (const [anio, cal] of Object.entries(CALENDARIOS_ESCOLARES)) {
    for (const entrega of (cal.reportesEvaluacion?.[nivelKey] || [])) {
      if (entrega.fecha >= f && (!mejor || entrega.fecha < mejor.fecha)) {
        mejor = { ...entrega, anio };
      }
    }
  }
  if (!mejor) return null;
  const diasRestantes = Math.round(
    (new Date(`${mejor.fecha}T12:00:00`) - new Date(`${f}T12:00:00`)) / 86400000
  );
  return { periodo: mejor.periodo, fecha: mejor.fecha, diasRestantes, anio: mejor.anio, nivel: nivelKey };
};

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

const _normArea = (s) => String(s || "")
  .toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

/** Suma días de calendario a una fecha ISO → nueva fecha ISO (o "" si inválida). */
const _sumarDias = (fechaISO, dias) => {
  const f = _iso(fechaISO);
  const d = new Date(`${f}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
};

/**
 * Efemérides con carga temática que CAEN dentro del rango de una unidad.
 *
 * El docente elige fecha de inicio + duración + área; esto calcula el rango
 * (inicio → inicio + semanas) y devuelve las efemérides que quedan DENTRO y
 * aplican al área. Como el tema conmemorativo pasa a ser el hilo de TODA la
 * unidad (no la interrumpe), solo cuenta si la fecha cae en el rango.
 *
 * Resultado ordenado por cercanía al inicio: si dos fechas cruzan, la primera
 * es la sugerencia natural (deja terminar el tema sin que la segunda choque).
 * Es material para SUGERIR — nunca impone.
 *
 * @param {string} inicioISO  fecha de inicio de la unidad
 * @param {number} semanas    duración (default 6, el tope del asesor)
 * @param {string} area       materia (vacío = no filtra por área)
 * @returns {{ fecha, nombre, tema, gancho, areas, diasDesdeInicio }[]}
 */
export const efemeridesEnRango = (inicioISO, semanas = 6, area = "") => {
  const inicio = _iso(inicioISO);
  if (!inicio) return [];
  const nSem = Number.isFinite(+semanas) && +semanas > 0 ? Math.min(8, +semanas) : 6;
  const fin = _sumarDias(inicio, nSem * 7);
  if (!fin) return [];

  const cal = calendarioParaFecha(inicio) || calendarioParaFecha(fin);
  const efemerides = Array.isArray(cal?.efemerides) ? cal.efemerides : [];
  const areaKey = _normArea(area);

  return efemerides
    .filter((e) => {
      const f = _iso(e?.fecha);
      if (!f || f < inicio || f > fin) return false; // debe caer DENTRO del rango
      if (!areaKey) return true; // sin área → todas las del rango
      const areas = (Array.isArray(e?.areas) ? e.areas : []).map(_normArea);
      return areas.length === 0 || areas.includes(areaKey);
    })
    .map((e) => ({
      ...e,
      diasDesdeInicio: Math.round(
        (new Date(`${_iso(e.fecha)}T12:00:00`) - new Date(`${inicio}T12:00:00`)) / 86400000
      ),
    }))
    .sort((a, b) => a.diasDesdeInicio - b.diasDesdeInicio);
};
