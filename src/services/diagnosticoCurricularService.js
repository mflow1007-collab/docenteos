import { consultarCurriculo } from "./curriculumService.js";
import { getCurricularContentForUnit } from "./bancoConocimientoService.js";
import { getCompetenciasArea } from "../data/indicadoresAreasMINERD.js";
import { getCompetenciasIdiomas } from "../data/indicadoresIdiomas.js";

const ORDINALES = { primero: 1, segundo: 2, tercero: 3, cuarto: 4, quinto: 5, sexto: 6 };
const SUFIJOS = { 1: "1ro", 2: "2do", 3: "3ro", 4: "4to", 5: "5to", 6: "6to" };

const numeroGrado = (grado = "") => {
  const texto = String(grado).toLowerCase();
  const numero = Number(texto.match(/[1-6]/)?.[0]);
  if (numero) return numero;
  return Object.entries(ORDINALES).find(([nombre]) => texto.includes(nombre))?.[1] || 1;
};

export const resolverGradoAnterior = ({ nivel = "", grado = "" } = {}) => {
  const nivelTexto = String(nivel || grado).toLowerCase();
  const nivelActual = nivelTexto.includes("primaria") ? "Primaria" : nivelTexto.includes("inicial") ? "Inicial" : "Secundaria";
  const numero = numeroGrado(grado);
  if (nivelActual === "Secundaria" && numero === 1) return { nivel: "Primaria", grado: "6to", etiqueta: "6to de Primaria" };
  if (nivelActual === "Primaria" && numero === 1) return { nivel: "Inicial", grado: "Preprimario", etiqueta: "Preprimario" };
  return { nivel: nivelActual, grado: SUFIJOS[Math.max(1, numero - 1)], etiqueta: `${SUFIJOS[Math.max(1, numero - 1)]} de ${nivelActual}` };
};

const aplanarCurriculo = (documento) => (documento?.competencias || []).flatMap((competencia) =>
  (competencia.indicadoresLogro || competencia.indicadores || []).map((indicador, indice) => ({
    id: indicador.id || `${competencia.id || "comp"}-${indice + 1}`,
    descripcion: indicador.descripcion || indicador.texto || String(indicador),
    competenciaId: competencia.id || "",
    competencia: competencia.descripcion || competencia.especifica || "",
  }))
).filter((indicador) => indicador.descripcion);

const referenciaLocal = (area, asignatura, grado, nivel) => {
  // Estos bancos de respaldo están organizados para Secundaria. No se usan
  // para Primaria porque una referencia del nivel equivocado sería engañosa.
  if (nivel !== "Secundaria") return [];
  try {
    const datos = area === "Lenguas Extranjeras"
      ? getCompetenciasIdiomas(asignatura || "Inglés", grado)
      : getCompetenciasArea(area, grado);
    if (!datos) return [];
    return (datos.indicadores || []).map((descripcion, indice) => ({
      id: `ref-local-${indice + 1}`,
      descripcion,
      competencia: datos.especifica || "",
      competenciaId: "referencia-local",
    }));
  } catch {
    return [];
  }
};

// Nivel del grado ACTUAL (mismo criterio que la planificación: se infiere del
// texto del grado y, si no, del nivel recibido).
const nivelActual = ({ nivel = "", grado = "" } = {}) => {
  const t = `${grado} ${nivel}`.toLowerCase();
  if (t.includes("primaria")) return "Primaria";
  if (t.includes("inicial")) return "Inicial";
  return "Secundaria";
};
// Grado sin el sufijo de nivel ("2do Secundaria" → "2do"), como la planificación.
const gradoBase = (grado = "") => String(grado).replace(/\s*(secundaria|primaria|inicial)\s*/gi, "").trim();

export const cargarReferentesDiagnosticos = async ({ nivel, grado, area, asignatura }) => {
  // La práctica de recuperación mide contra la malla del GRADO ACTUAL (lo que se
  // va a enseñar este año), igual que el generador de planificaciones. El grado
  // anterior se conserva solo como etiqueta de referencia de saberes de entrada.
  const anterior = resolverGradoAnterior({ nivel, grado });
  const nivelG = nivelActual({ nivel, grado });
  const gradoG = gradoBase(grado);
  const materia = asignatura || area;

  // `diagnostico`: fail-LOUD. En vez de tragarse el fallo, registramos qué se
  // buscó y por qué no hubo malla, para mostrarlo en pantalla y que el docente
  // (o el dev) sepa exactamente qué pasó sin abrir la consola.
  const diagnostico = { busco: { materia, grado: gradoG, nivel: nivelG }, motivo: "", detalle: "" };

  // 1) Banco de Conocimiento (`curricularContent`): MISMA malla activa que usa
  // el generador de planes (getCurricularContentForUnit, clave level+grade+
  // subject exactos). Es la fuente estricta y real.
  if (materia && gradoG) {
    try {
      const malla = await getCurricularContentForUnit(materia, gradoG, nivelG);
      const indicadores = aplanarCurriculo(malla?.payload || malla);
      if (indicadores.length) return { anterior, indicadores, fuente: `Malla curricular oficial de ${gradoG} (Banco de Conocimiento)`, oficial: true, diagnostico: { ...diagnostico, motivo: "ok" } };
      diagnostico.motivo = malla ? "malla_sin_indicadores" : "malla_no_encontrada";
      diagnostico.detalle = malla
        ? `La malla de ${materia} ${gradoG} existe pero no tiene indicadores de logro.`
        : `No hay malla activa de ${materia} ${gradoG} (${nivelG}) en el Banco de Conocimiento.`;
    } catch (err) {
      diagnostico.motivo = /permission|insufficient|denied/i.test(String(err?.code || err?.message)) ? "sin_permiso" : "error_lectura";
      diagnostico.detalle = `No se pudo leer el Banco de Conocimiento: ${err?.code || err?.message}.`;
    }
  } else {
    diagnostico.motivo = "sin_contexto";
    diagnostico.detalle = "Falta asignatura o grado para buscar la malla.";
  }

  // 2) Pipeline `diseñoCurricular` (importación curricular clásica), mismo grado.
  const candidatosArea = [...new Set([area, asignatura].filter(Boolean))];
  for (const nombreArea of candidatosArea) {
    const documento = await consultarCurriculo(nivelG, gradoG, nombreArea);
    const indicadores = aplanarCurriculo(documento);
    if (indicadores.length) return { anterior, indicadores, fuente: `Malla curricular oficial de ${gradoG}`, oficial: true, diagnostico: { ...diagnostico, motivo: "ok_disenocurricular" } };
  }

  // 3) Referencia local de respaldo (requiere validación docente).
  return {
    anterior,
    indicadores: referenciaLocal(area, asignatura, gradoG, nivelG),
    fuente: "Referencia curricular local; requiere validación docente",
    diagnostico,
    oficial: false,
  };
};

const tokens = (texto = "") => String(texto).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter((token) => token.length > 4);

export const vincularItemsAIndicadores = (items = [], indicadores = []) => items.map((item, indice) => {
  if (item.indicadorId && indicadores.some((ind) => ind.id === item.indicadorId)) return item;
  const base = new Set(tokens(`${item.dimension} ${item.aprendizaje} ${item.consigna}`));
  const elegido = indicadores.map((indicador) => ({
    indicador,
    coincidencias: tokens(indicador.descripcion).filter((token) => base.has(token)).length,
  })).sort((a, b) => b.coincidencias - a.coincidencias)[0]?.indicador || indicadores[indice % indicadores.length];
  return elegido ? { ...item, indicadorId: elegido.id, indicador: elegido.descripcion, competencia: elegido.competencia } : item;
});
