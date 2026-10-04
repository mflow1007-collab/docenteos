/**
 * diagnosticoIntegrationService.js — Puente Diagnóstico → Planificación
 *
 * Cierra el bucle: convierte los RESULTADOS de un diagnóstico en la lista de
 * indicadores DÉBILES (los que el grupo domina menos), en el MISMO formato que
 * `obtenerIndicadoresDebiles` de avanceCurricularService (un array de códigos/
 * descripciones de indicador). El generador de unidades ya sabe marcar esos
 * indicadores como "(REFORZAR)" en el prompt de IA, así la planificación parte
 * del nivel real de los estudiantes — "a la realidad de los estudiantes".
 *
 * PURO y testeable: recibe el diagnóstico guardado (aprendizajes/items/resultados/
 * mediaciones) y devuelve los códigos. Reusa `resumirDiagnostico` (ya calcula las
 * brechas y la brecha persistente por aprendizaje). Fail-closed: ante datos
 * incompletos devuelve [] y el generador sigue sin refuerzos.
 */

import { resumirDiagnostico, obtenerDiagnosticoCurso, listarDiagnosticos } from "./diagnosticoService.js";

const _texto = (v) => String(v ?? "").trim();
const _arr = (v) => (Array.isArray(v) ? v : []);

// Umbral: un aprendizaje se considera DÉBIL si ≥ `umbralApoyo`% de las respuestas
// quedaron en "requiere apoyo / en proceso". Debe cruzar también una mínima
// cantidad de evidencias para no marcar débil algo evaluado a una sola persona.
const UMBRAL_APOYO = 50;

// Mapea cada aprendizaje (texto) al indicador/competencia del ítem que lo produjo.
// Los ítems generados por IA ponen el indicador en `item.aprendizaje`, así que el
// propio aprendizaje suele SER la descripción del indicador; pero si el ítem trae
// `indicador`/`competencia` explícitos, se prefieren esos.
const mapaAprendizajeAIndicador = (items = []) => {
  const mapa = new Map();
  for (const it of _arr(items)) {
    const clave = _texto(it.aprendizaje);
    if (!clave || mapa.has(clave)) continue;
    mapa.set(clave, {
      indicador: _texto(it.indicador) || clave,
      competencia: _texto(it.competencia),
      codigo: _texto(it.indicadorId) || _texto(it.indicador) || clave,
    });
  }
  return mapa;
};

// ─── API pura ─────────────────────────────────────────────────────────────────
// Devuelve los indicadores débiles de un diagnóstico, como array de descripciones
// (compatible con lo que espera el generador: strings que marca "(REFORZAR)").
export const indicadoresDebilesDeDiagnostico = (diagnostico = {}, { umbralApoyo = UMBRAL_APOYO } = {}) => {
  const estudiantes = _arr(diagnostico.estudiantes).length
    ? _arr(diagnostico.estudiantes)
    // Si no vienen los estudiantes, derivarlos de las claves de resultados.
    : Object.keys(diagnostico.resultados || {}).map((id) => ({ id }));
  const aprendizajes = _arr(diagnostico.aprendizajes);
  if (!aprendizajes.length || !estudiantes.length) return [];

  const resumen = resumirDiagnostico({
    estudiantes,
    aprendizajes,
    resultados: diagnostico.resultados || {},
    mediaciones: diagnostico.mediaciones || {},
  });
  const mapa = mapaAprendizajeAIndicador(diagnostico.items);

  // Brechas vienen ordenadas por % de apoyo desc. Débil = % apoyo ≥ umbral Y con
  // al menos una respuesta evaluada; damos prioridad a la brecha persistente.
  const debiles = _arr(resumen.brechas)
    .filter((b) => b.evaluados > 0 && (b.porcentajeApoyo >= umbralApoyo || b.brechaPersistente > 0))
    .map((b) => {
      const ref = mapa.get(_texto(b.aprendizaje));
      return ref?.indicador || _texto(b.aprendizaje);
    })
    .filter(Boolean);

  // Únicos, preservando el orden (más débil primero).
  return [...new Set(debiles)];
};

// ─── API con acceso al almacén ────────────────────────────────────────────────
// Busca el diagnóstico guardado del curso+año y devuelve sus indicadores débiles.
// Fail-closed: si no hay diagnóstico o falla, devuelve [].
export const indicadoresDebilesDesdeDiagnosticoGuardado = ({ cursoId, anoEscolar, umbralApoyo = UMBRAL_APOYO } = {}) => {
  try {
    if (!cursoId) return [];
    const diag = obtenerDiagnosticoCurso(cursoId, anoEscolar);
    if (!diag) return [];
    return indicadoresDebilesDeDiagnostico(diag, { umbralApoyo });
  } catch {
    return [];
  }
};

// Busca por GRADO + ASIGNATURA (no por cursoId) entre los diagnósticos guardados
// el más reciente que coincida, y devuelve sus indicadores débiles. Es lo que usa
// el generador de unidades, que trabaja con grado/asignatura (no con cursoId).
// Fail-closed: [] ante cualquier problema.
const norm = (s = "") => _texto(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
export const indicadoresDebilesPorGradoAsignatura = (grado = "", asignatura = "", { umbralApoyo = UMBRAL_APOYO } = {}) => {
  try {
    const g = norm(grado), a = norm(asignatura);
    if (!g || !a) return [];
    const candidatos = _arr(listarDiagnosticos())
      .filter((d) => norm(d.grado).includes(g) || g.includes(norm(d.grado)))
      .filter((d) => norm(d.asignatura).includes(a) || a.includes(norm(d.asignatura)) || norm(d.area).includes(a))
      .sort((x, y) => String(y.actualizadoEn || "").localeCompare(String(x.actualizadoEn || "")));
    const diag = candidatos[0];
    if (!diag) return [];
    return indicadoresDebilesDeDiagnostico(diag, { umbralApoyo });
  } catch {
    return [];
  }
};

// Mezcla indicadores débiles de dos fuentes (diagnóstico + evaluaciones previas),
// sin duplicados, priorizando los del diagnóstico (punto de partida del año).
export const mezclarIndicadoresDebiles = (desdeDiagnostico = [], desdeEvaluaciones = []) =>
  [...new Set([..._arr(desdeDiagnostico), ..._arr(desdeEvaluaciones)].map(_texto).filter(Boolean))];
