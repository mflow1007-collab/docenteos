/**
 * curriculoAdapter.js — A5.3: adaptador currículo local → banco de conocimiento
 *
 * PURO: sin Firebase ni I/O. Transforma los JSON locales del Diseño Curricular
 * (curriculum/**, formato: nivel/grado/area/asignatura/competencias/
 * temasCurriculares) al SOBRE que valida bancoConocimientoService
 * (validateJsonSobre → campos obligatorios: schemaVersion, level, grade,
 * area, subject, contentType) y cuyo payload consume el Motor Especializado
 * de Unidades (unidadAprendizajeService):
 *
 *   payload.competencias[]        → { id, especifica, descripcion, competenciaFundamental }
 *   payload.indicadoresLogro[]    → índice plano { id, descripcion, competenciaId }
 *   payload.temas[]               → string[] (temas oficiales del grado)
 *   payload.nivelMCERL            → nivel de dominio (A1, A2…)
 *   payload.contenidos.conceptos.gramatica[{ estructura }]      ← contenidosGenerales.conceptuales
 *   payload.contenidos.procedimientos.funcionales[]             ← contenidosGenerales.procedimentales
 *
 * NO modifica bancoConocimientoService ni los JSON locales. Los IDs oficiales
 * (CE-ING-1-COM, IL-ING-1-COM-1) pasan intactos. El JSON original completo
 * queda preservado bajo payload.origenLocal para trazabilidad.
 */

export const SCHEMA_VERSION_ADAPTADOR = "1.3-local";

/** Valida la forma mínima del JSON local antes de adaptar. */
export const validarCurriculoLocal = (jsonLocal) => {
  const faltantes = ["nivel", "grado", "area", "asignatura"]
    .filter((campo) => !jsonLocal?.[campo]);
  if (faltantes.length) {
    return { ok: false, error: `El JSON local no tiene los campos: ${faltantes.join(", ")}` };
  }
  if (!Array.isArray(jsonLocal.competencias) || !jsonLocal.competencias.length) {
    return { ok: false, error: "El JSON local no tiene competencias[]" };
  }
  return { ok: true };
};

/**
 * Transforma un JSON del currículo local al sobre del banco de conocimiento.
 * @param {object} jsonLocal  Contenido de curriculum/**.json
 * @returns sobre listo para validateJsonSobre / createCurricularContent
 * @throws si el JSON local no tiene la forma mínima
 */
export const adaptarCurriculoLocal = (jsonLocal) => {
  const validacion = validarCurriculoLocal(jsonLocal);
  if (!validacion.ok) throw new Error(validacion.error);

  const competencias = jsonLocal.competencias.map((comp) => ({
    id: comp.id || "",
    competenciaFundamental: comp.competenciaFundamental || "",
    // El motor lee especificaGrado || especifica || descripcion
    especifica: comp.descripcion || "",
    descripcion: comp.descripcion || "",
    indicadoresLogro: (comp.indicadoresLogro || []).map((ind) => ({
      id: ind.id || "",
      descripcion: ind.descripcion || ind.texto || "",
    })),
  }));

  // Índice plano de indicadores con vínculo a su competencia (IDs intactos)
  const indicadoresLogro = jsonLocal.competencias.flatMap((comp) =>
    (comp.indicadoresLogro || []).map((ind) => ({
      id: ind.id || "",
      descripcion: ind.descripcion || ind.texto || "",
      competenciaId: comp.id || "",
    }))
  ).filter((ind) => ind.descripcion);

  const generales = jsonLocal.contenidosGenerales || {};

  return {
    // — Sobre (campos obligatorios de validateJsonSobre) —
    schemaVersion: SCHEMA_VERSION_ADAPTADOR,
    level: jsonLocal.nivel,
    cycle: jsonLocal.ciclo || null,
    grade: jsonLocal.grado,
    area: jsonLocal.area,
    subject: jsonLocal.asignatura,
    contentType: "malla_curricular",

    // — Payload que consume el motor de unidades —
    nivelMCERL: jsonLocal.nivelDominio || null,
    competenciasFundamentales: jsonLocal.competenciasFundamentales || [],
    competencias,
    indicadoresLogro,
    temas: jsonLocal.temasCurriculares || [],
    criteriosCombinacionTematica: jsonLocal.criteriosCombinacionTematica || [],
    contenidos: {
      conceptos: {
        // En los JSON locales los conceptuales son estructuras gramaticales
        // ("Presente simple…"); se mapean como estructura sin re-redactar.
        gramatica: (generales.conceptuales || []).map((texto) => ({ estructura: texto })),
        vocabulario: [],
        expresiones: [],
      },
      procedimientos: {
        funcionales: generales.procedimentales || [],
      },
      actitudinales: generales.actitudinales || [],
    },
    orientacionesMetodologicas: jsonLocal.orientacionesMetodologicas || [],
    posiblesProductosFinales: jsonLocal.posiblesProductosFinales || [],

    // — Trazabilidad: original completo, sin tocar —
    origenLocal: {
      fuente: jsonLocal.fuente || "",
      version: jsonLocal.version || "",
      contenidosGenerales: generales,
    },
  };
};
