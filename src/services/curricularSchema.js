/**
 * curricularSchema.js — CONTRATO CANÓNICO del corpus curricular
 *
 * Define la forma que TODO doc de curricularContent debe cumplir para que el
 * generador funcione sin adivinar. Módulo PURO (sin Firebase) y testeable.
 *
 * Capas de aplicación (aclaración del fail-open):
 *   1. SUBIDA (validateJsonSobre → validateCurricularDoc): estricta. Un JSON
 *      que viola el contrato NO entra al Banco. Aquí se arregla, no después.
 *   2. LECTURA (getCurricularContentForUnit): tolerante CON ADVERTENCIA.
 *      Los docs históricos se leen; las violaciones se loggean con ruta para
 *      corregirlos en Potente IA. Los CANDADOS específicos del generador
 *      (indicadores asociables, contenidos por columna) detienen lo que de
 *      verdad no se puede generar — nunca se rellena con inventos.
 *   3. GUARDS de fuente (hasActiveMallaSource): fail-open SOLO ante error de
 *      lectura de fuentes (guards=null → no filtrar); la clave estricta de
 *      resolución (level+grade+subject+contentType) aplica SIEMPRE.
 *
 * schemaVersion: la canónica es "1.3". NUNCA se auto-incrementa: una versión
 * mayor desconocida es una VIOLACIÓN (origen del bug v2.0: el ensamblador de
 * paquetes y las plantillas del Admin estampaban "2.0" por defecto).
 */

export const SCHEMA_VERSION_CANONICA = "1.3";
export const SCHEMA_VERSIONES_LEGIBLES = ["1.0", "1.1", "1.2", "1.3", "1.3-local"];

// ─── Higiene de placeholders (fuente única — el Banco la re-exporta) ─────────

export const PLACEHOLDERS_PROHIBIDOS = [
  'Vocabulario clave relacionado con',
  'Estructuras gramaticales básicas',
  'diversidad cultural anglosajona',
  'Conceptos fundamentales de ',
  'Definiciones de ',
];

export const localizarPlaceholdersProhibidos = (valor, rutaBase = '') => {
  const hallazgos = [];
  const visitar = (v, ruta) => {
    if (typeof v === 'string') {
      for (const p of PLACEHOLDERS_PROHIBIDOS) {
        if (v.includes(p)) hallazgos.push({ ruta: ruta || '(raíz)', cadena: p });
      }
      return;
    }
    if (Array.isArray(v)) {
      v.forEach((item, i) => visitar(item, `${ruta}[${i}]`));
      return;
    }
    if (v && typeof v === 'object') {
      for (const [k, val] of Object.entries(v)) visitar(val, ruta ? `${ruta}.${k}` : k);
    }
  };
  visitar(valor, rutaBase);
  return hallazgos;
};

// ─── Validación del contrato ──────────────────────────────────────────────────

const texto = (v) => String(v ?? '').trim();
const esArrayLleno = (v) => Array.isArray(v) && v.length > 0;

/**
 * Valida un doc/payload curricular contra el contrato canónico.
 * @returns {{ ok: boolean, violaciones: [{ ruta, mensaje }] }}
 */
export const validateCurricularDoc = (docOrPayload) => {
  const payload = docOrPayload?.payload || docOrPayload || {};
  const violaciones = [];
  const v = (ruta, mensaje) => violaciones.push({ ruta, mensaje });

  // Identidad del doc
  for (const campo of ['level', 'grade', 'area', 'subject']) {
    if (!texto(payload[campo] || docOrPayload?.[campo])) v(campo, 'obligatorio y vacío');
  }
  const version = texto(payload.schemaVersion || docOrPayload?.schemaVersion);
  if (!version) {
    v('schemaVersion', 'obligatorio');
  } else if (!SCHEMA_VERSIONES_LEGIBLES.includes(version)) {
    v('schemaVersion', `versión desconocida "${version}" — la canónica es ${SCHEMA_VERSION_CANONICA}; nunca auto-incrementar`);
  }

  const contentType = texto(payload.contentType || docOrPayload?.contentType) || 'malla_curricular';
  if (contentType === 'enriquecimiento_tema') {
    if (!texto(payload.derivedFrom)) v('payload.derivedFrom', 'obligatorio: id/contentId de la malla de origen');
    if (!esArrayLleno(payload.temas)) v('payload.temas', 'obligatorio: entradas por temaOficial');
    return { ok: violaciones.length === 0, violaciones };
  }
  if (contentType !== 'malla_curricular') {
    // registro_minerd y otros tipos no son malla — solo identidad + placeholders
    for (const h of localizarPlaceholdersProhibidos(payload)) {
      v(h.ruta, `placeholder prohibido: "${h.cadena}"`);
    }
    return { ok: violaciones.length === 0, violaciones };
  }

  // Temas oficiales
  const temas = esArrayLleno(payload.temas) ? payload.temas
    : esArrayLleno(payload.temasCurriculares) ? payload.temasCurriculares
    : payload.contenidos?.conceptos?.temas;
  if (!esArrayLleno(temas)) v('temas', 'la malla debe traer los temas oficiales del grado');

  // Competencias con específica y CF
  const comps = Array.isArray(payload.competencias) ? payload.competencias : [];
  if (!comps.length) v('competencias', 'obligatorio: las competencias específicas del grado');
  // El código (ING-1-C01) es OPCIONAL: el diseño MINERD oficial identifica las
  // competencias por su NOMBRE (Comunicativa, Ética y Ciudadana…), no por un
  // código; el código lo deriva el sistema desde el nombre cuando el PDF no lo
  // trae. Lo obligatorio es que la competencia tenga TEXTO (nombre/específica).
  const idsComps = new Set();
  comps.forEach((c, i) => {
    const id = texto(c?.id || c?.codigo);
    const nombre = texto(c?.competenciaFundamental || c?.fundamental || c?.nombre);
    if (id) idsComps.add(id);
    else if (nombre) idsComps.add(nombre); // el nombre sirve de clave de vínculo
    if (!texto(c?.especificaGrado || c?.especifica || c?.descripcion) && !nombre) {
      v(`competencias[${i}]`, 'competencia sin nombre ni texto de específica (fila basura de conversión)');
    }
  });

  // Indicadores: anidados en su competencia O planos con competenciaId válido
  const anidadosTotal = comps.reduce(
    (n, c) => n + ((c?.indicadoresLogro || c?.indicadores || []).length || 0), 0);
  const planos = Array.isArray(payload.indicadoresLogro) ? payload.indicadoresLogro
    : Array.isArray(payload.indicadores) ? payload.indicadores : [];
  if (!anidadosTotal && !planos.length) {
    v('indicadoresLogro', 'la malla debe traer indicadores de logro');
  }
  // Indicadores PLANOS: solo se exige vínculo si NO hay anidados (los anidados
  // ya cuelgan de su competencia). Un indicador string suelto no bloquea la
  // malla mientras exista texto — el generador lo reparte por división exacta;
  // el candado de "sin indicadores asociables" vive aguas abajo, no aquí.
  if (!anidadosTotal) {
    planos.forEach((ind, j) => {
      const desc = typeof ind === 'string' ? ind : texto(ind?.descripcion || ind?.texto);
      if (!desc) {
        v(`indicadoresLogro[${j}]`, 'indicador sin descripción');
        return;
      }
      // Si trae competenciaId, debe apuntar a una competencia existente
      const compId = typeof ind === 'string' ? '' : texto(ind?.competenciaId || ind?.competencia);
      if (compId && idsComps.size && !idsComps.has(compId)) {
        v(`indicadoresLogro[${j}].competenciaId`, `apunta a "${compId}" que no existe en competencias[]`);
      }
    });
  }

  // Cardinalidad canónica del registro oficial MINERD de SECUNDARIA:
  // exactamente 7 competencias con específica y 21 indicadores con descripción
  // (3 por competencia). Un conteo distinto delata filas basura o pérdidas de
  // conversión — es la puerta por la que entró el doc corrupto v2.0.
  // SOLO aplica a Secundaria: la malla oficial de Primaria agrupa las 7 CF en
  // filas combinadas ("Ética y Ciudadana; Desarrollo Personal…" = 1 fila) y sus
  // indicadores son un bloque por grado sin cardinalidad fija — exigir 7/21
  // ahí rechazaría el documento oficial de la Adecuación 2023.
  const nivelDoc = texto(payload.level || docOrPayload?.level).toLowerCase();
  const exigeCardinalidadSecundaria = nivelDoc.startsWith('secundar');
  const compsConEspecifica = comps.filter(
    (c) => texto(c?.especificaGrado || c?.especifica || c?.descripcion)).length;
  if (exigeCardinalidadSecundaria && (comps.length !== 7 || compsConEspecifica !== 7)) {
    const detalle = comps.length !== 7
      ? comps.length
      : `${comps.length}, solo ${compsConEspecifica} con específica`;
    v('competencias', `el registro oficial tiene 7 competencias; este doc trae ${detalle} — revisar filas basura de conversión`);
  }
  const descInd = (ind) => texto(typeof ind === 'string' ? ind : ind?.descripcion || ind?.texto);
  // Los anidados mandan cuando existen (los planos pueden ser un espejo del
  // mismo registro) — mismo criterio de precedencia que el chequeo de vínculo.
  const indsTotal = anidadosTotal || planos.length;
  const indsConDesc = anidadosTotal
    ? comps.reduce((n, c) => n + (c?.indicadoresLogro || c?.indicadores || []).filter(descInd).length, 0)
    : planos.filter(descInd).length;
  if (exigeCardinalidadSecundaria && (indsTotal !== 21 || indsConDesc !== 21)) {
    const detalle = indsTotal !== 21
      ? indsTotal
      : `${indsTotal}, solo ${indsConDesc} con descripción`;
    v('indicadoresLogro', `el registro oficial tiene 21 indicadores; este doc trae ${detalle} — revisar filas basura de conversión`);
  }
  // Fuera de Secundaria la exigencia honesta es de PRESENCIA: los chequeos de
  // arriba ya obligan competencias e indicadores no vacíos y sin filas basura.

  // Contenidos estructurados (fuente de CONTENIDOS del documento)
  const conceptos = payload.contenidos?.conceptos;
  if (!conceptos) {
    v('contenidos.conceptos', 'obligatorio: vocabulario y gramática oficiales');
  } else {
    if (!esArrayLleno(conceptos.vocabulario)) v('contenidos.conceptos.vocabulario', 'sin vocabulario oficial');
    if (!esArrayLleno(conceptos.gramatica)) v('contenidos.conceptos.gramatica', 'sin estructuras gramaticales oficiales');
  }
  if (!esArrayLleno(payload.contenidos?.procedimientos?.funcionales)
    && !esArrayLleno(payload.contenidosGenerales?.procedimentales)) {
    v('contenidos.procedimientos.funcionales', 'sin contenidos procedimentales');
  }
  if (!esArrayLleno(payload.contenidos?.actitudinales)
    && !esArrayLleno(payload.contenidosGenerales?.actitudinales)) {
    v('contenidos.actitudinales', 'sin contenidos actitudinales');
  }

  // Placeholders prohibidos en cualquier parte del payload
  for (const h of localizarPlaceholdersProhibidos(payload)) {
    v(h.ruta, `placeholder prohibido: "${h.cadena}"`);
  }

  return { ok: violaciones.length === 0, violaciones };
};
