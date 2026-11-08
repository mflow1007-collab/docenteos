/**
 * diagnosticoIntegrationService.js — Puente Diagnóstico → Planificación
 *
 * Cierra el bucle: convierte los RESULTADOS de un diagnóstico en la lista de
 * indicadores DÉBILES (los que el grupo domina menos), con su CÓDIGO y su
 * DESCRIPCIÓN por separado. El generador marca "(REFORZAR)" por código y el Punto
 * de partida muestra la descripción, así la planificación parte del nivel real de
 * los estudiantes — "a la realidad de los estudiantes".
 *
 * La parte pura recibe el diagnóstico guardado (aprendizajes/items/resultados/
 * mediaciones). Reusa `resumirDiagnostico` (ya calcula las brechas y la brecha
 * persistente por aprendizaje). Fail-closed: ante datos incompletos devuelve [] y
 * el generador sigue sin refuerzos; al administrador se le avisa «sin dato».
 */

import { resumirDiagnostico, obtenerDiagnosticoCurso, listarDiagnosticos, sincronizarDiagnosticos } from "./diagnosticoService.js";
import { nivelDeclarado } from "./hiloPedagogico.js";
import { obtenerCursos } from "../firebase.js";

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
      // Vacío si el ítem no trae id. Puede no ser de la malla (ref-oficial-3):
      // lo comprueba resolverDebilesContraMalla.
      codigo: _texto(it.indicadorId),
    });
  }
  return mapa;
};

// ─── API pura ─────────────────────────────────────────────────────────────────
// Devuelve los indicadores débiles de un diagnóstico: [{ codigo, descripcion }],
// el más débil primero.
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
      return { codigo: ref?.codigo || "", descripcion: ref?.indicador || _texto(b.aprendizaje) };
    })
    .filter((d) => d.descripcion);

  // Únicos, preservando el orden (más débil primero).
  const vistos = new Set();
  return debiles.filter((d) => {
    const clave = d.codigo || d.descripcion;
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
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

// Elige el diagnóstico más reciente CON RESULTADOS de ese nivel + grado +
// asignatura (igualdad, nunca `includes`: «1ro» de Primaria no es «1ro» de
// Secundaria). El nivel se lee de lo declarado en el diagnóstico o en su curso;
// nunca se deduce del grado. El generador aún no tiene cursoId: con varias
// secciones usa la más reciente y lo dice (el perfil será por curso, D1). PURO.
const norm = (s = "") => _texto(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const gradoClave = (g = "") => norm(g).replace(/\b(secundari[ao]|primari[ao]|inicial)\b/g, " ").trim().split(/\s+/)[0] || "";
export const seleccionarDiagnostico = (diagnosticos = [], { nivel = "", grado = "", asignatura = "" } = {}, cursos = []) => {
  const nivelBuscado = nivelDeclarado({ nivel });
  const g = gradoClave(grado), a = norm(asignatura);
  if (!nivelBuscado || !g || !a) return { diagnostico: null, otrasSecciones: [], sinNivel: 0 };
  const cursoDe = (d) => _arr(cursos).find((c) => String(c?.id) === String(d?.cursoId)) || {};
  const delGradoAsignatura = _arr(diagnosticos)
    .filter((d) => Object.keys(d?.resultados || {}).length > 0)
    // Hay cursos sin campo `grado`: el grado va en su nombre («2do Secundaria A»).
    .filter((d) => gradoClave(d.grado || cursoDe(d).grado || cursoDe(d).nombre || d.cursoNombre) === g && norm(d.asignatura) === a);
  const nivelDe = (d) => nivelDeclarado({ nivel: d.nivel, grado: d.grado, nombre: d.cursoNombre })
    || nivelDeclarado({ nivel: cursoDe(d).nivel, grado: cursoDe(d).grado, nombre: cursoDe(d).nombre });
  const candidatos = delGradoAsignatura
    .filter((d) => nivelDe(d) === nivelBuscado)
    .sort((x, y) => String(y.actualizadoEn || "").localeCompare(String(x.actualizadoEn || "")));
  const diagnostico = candidatos[0] || null;
  const seccionDe = (d) => _texto(d.cursoNombre) || _texto(d.seccion);
  return {
    diagnostico,
    otrasSecciones: [...new Set(candidatos.slice(1).filter((d) => String(d.cursoId) !== String(diagnostico?.cursoId)).map(seccionDe).filter(Boolean))],
    sinNivel: delGradoAsignatura.filter((d) => !nivelDe(d)).length,
  };
};

// Lee Firestore al generar (no solo el localStorage de este dispositivo).
// Nunca lanza ni bloquea la generación: devuelve { debiles, avisos }; los avisos
// solo los ve el administrador.
export const datosDiagnosticoParaGenerar = async ({ nivel = "", grado = "", asignatura = "", umbralApoyo = UMBRAL_APOYO } = {}) => {
  const avisos = [];
  const buscado = [nivel, grado, asignatura].map(_texto).filter(Boolean).join(" · ");
  let diagnosticos;
  try {
    diagnosticos = await sincronizarDiagnosticos({ estricto: true });
  } catch (error) {
    avisos.push(`Diagnóstico: no se pudo leer Firestore (${_texto(error?.message) || "error"}); se usó solo lo guardado en este dispositivo.`);
    diagnosticos = listarDiagnosticos();
  }
  let cursos = [];
  try {
    cursos = _arr((await obtenerCursos())?.data);
  } catch { /* sin cursos: los diagnósticos viejos sin nivel salen en el aviso */ }
  try {
    const { diagnostico, otrasSecciones, sinNivel } = seleccionarDiagnostico(diagnosticos, { nivel, grado, asignatura }, cursos);
    if (sinNivel) avisos.push(`Diagnóstico: ${sinNivel} de ${buscado} sin nivel declarado (ni en su curso); no se usa.`);
    if (!diagnostico) {
      avisos.push(`Diagnóstico: sin dato para ${buscado || "esta unidad"}.`);
      return { debiles: [], avisos };
    }
    if (otrasSecciones.length) {
      avisos.push(`Diagnóstico: se usó el de ${_texto(diagnostico.cursoNombre) || _texto(diagnostico.seccion) || "la sección más reciente"}; también hay de ${otrasSecciones.join(", ")}.`);
    }
    return { debiles: indicadoresDebilesDeDiagnostico(diagnostico, { umbralApoyo }), avisos };
  } catch (error) {
    avisos.push(`Diagnóstico: sin dato para ${buscado || "esta unidad"} (${_texto(error?.message) || "error"}).`);
    return { debiles: [], avisos };
  }
};

// Separa lo que el prompt puede usar de lo que solo se muestra: un código entra
// en `codigos` solo si existe en la malla; si no (ref-oficial-3, id local), se
// busca por descripción exacta. Sin coincidencia, el indicador solo sale en el
// Punto de partida. PURO.
const claveCodigo = (c) => _texto(c).replace(/[[\]\s]/g, "").toUpperCase();
const claveDescripcion = (t) => norm(t).replace(/\s+/g, " ").replace(/[.;:]+$/, "");
export const resolverDebilesContraMalla = (debiles = [], indicadoresMalla = []) => {
  const planos = _arr(indicadoresMalla).map((i) => (typeof i === "string"
    ? { codigo: "", descripcion: i }
    : { codigo: i?.codigo || i?.id || i?.codigoOficial || "", descripcion: i?.descripcion || i?.texto || "" }));
  const codigosMalla = new Map(planos.filter((i) => i.codigo).map((i) => [claveCodigo(i.codigo), i.codigo]));
  const porDescripcion = new Map(planos.filter((i) => i.codigo && i.descripcion).map((i) => [claveDescripcion(i.descripcion), i.codigo]));
  const items = _arr(debiles).map((d) => (typeof d === "string" ? { codigo: "", descripcion: d } : d));
  return {
    codigos: [...new Set(items
      .map((d) => codigosMalla.get(claveCodigo(d?.codigo)) || porDescripcion.get(claveDescripcion(d?.descripcion)))
      .filter(Boolean))],
    descripciones: [...new Set(items.map((d) => _texto(d?.descripcion)).filter(Boolean))],
  };
};

// Mezcla indicadores débiles de dos fuentes (diagnóstico + evaluaciones previas),
// sin duplicados, priorizando los del diagnóstico (punto de partida del año).
export const mezclarIndicadoresDebiles = (desdeDiagnostico = [], desdeEvaluaciones = []) =>
  [...new Set([..._arr(desdeDiagnostico), ..._arr(desdeEvaluaciones)].map(_texto).filter(Boolean))];
