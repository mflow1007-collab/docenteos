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

export const cargarReferentesDiagnosticos = async ({ nivel, grado, area, asignatura }) => {
  const anterior = resolverGradoAnterior({ nivel, grado });

  // 1) Banco de Conocimiento (colección `curricularContent`): es donde el
  // docente importa las mallas hoy. Se prioriza sobre `diseñoCurricular` para
  // que el diagnóstico use la MISMA malla activa que el generador de planes.
  // getCurricularContentForUnit ya selecciona la malla activa del nivel+grado
  // exactos y normaliza el payload a competencias[].indicadoresLogro[].
  const materia = asignatura || area;
  if (materia) {
    try {
      const malla = await getCurricularContentForUnit(materia, anterior.grado, anterior.nivel);
      const indicadores = aplanarCurriculo(malla?.payload || malla);
      if (indicadores.length) return { anterior, indicadores, fuente: "Malla curricular importada (Banco de Conocimiento)", oficial: true };
    } catch { /* si el Banco no está disponible, seguimos con los demás orígenes */ }
  }

  // 2) Pipeline `diseñoCurricular` (importación curricular clásica).
  const candidatosArea = [...new Set([area, asignatura].filter(Boolean))];
  for (const nombreArea of candidatosArea) {
    const documento = await consultarCurriculo(anterior.nivel, anterior.grado, nombreArea);
    const indicadores = aplanarCurriculo(documento);
    if (indicadores.length) return { anterior, indicadores, fuente: "Malla curricular importada", oficial: true };
  }

  // 3) Referencia local de respaldo (requiere validación docente).
  return {
    anterior,
    indicadores: referenciaLocal(area, asignatura, anterior.grado, anterior.nivel),
    fuente: "Referencia curricular local; requiere validación docente",
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
