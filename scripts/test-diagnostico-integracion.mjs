/**
 * test-diagnostico-integracion.mjs — Fase 4: puente diagnóstico → planificación.
 * Verifica la lógica pura: de los resultados de un diagnóstico salen los
 * indicadores DÉBILES (los que el grupo domina menos), que el generador marca
 * "(REFORZAR)". Sin localStorage ni navegador.
 */
import { indicadoresDebilesDeDiagnostico, mezclarIndicadoresDebiles } from "../src/services/diagnosticoIntegrationService.js";

let pasos = 0, fallos = 0;
const check = (n, fn) => { try { fn(); pasos += 1; console.log(`  ✓ ${n}`); } catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); } };
const assert = (c, m) => { if (!c) throw new Error(m); };

// Diagnóstico de ejemplo: 3 aprendizajes, 4 estudiantes. A1 es fuerte (todos
// logrado), A2 es DÉBIL (mayoría requiere apoyo), A3 tiene brecha persistente.
const diagnostico = {
  estudiantes: [{ id: "e1" }, { id: "e2" }, { id: "e3" }, { id: "e4" }],
  aprendizajes: ["Infiere información del texto", "Resuelve ecuaciones de primer grado", "Comunica su procedimiento"],
  items: [
    { aprendizaje: "Infiere información del texto", indicador: "IL-1 Infiere información explícita e implícita" },
    { aprendizaje: "Resuelve ecuaciones de primer grado", indicador: "IM-3 Resuelve ecuaciones lineales" },
    { aprendizaje: "Comunica su procedimiento", indicador: "IM-5 Comunica y justifica procedimientos" },
  ],
  resultados: {
    e1: ["logrado", "requiere_apoyo", "en_proceso"],
    e2: ["avanzado", "en_proceso", "requiere_apoyo"],
    e3: ["logrado", "requiere_apoyo", "logrado"],
    e4: ["logrado", "requiere_apoyo", "requiere_apoyo"],
  },
  mediaciones: {
    e1: ["autonomo", "apoyo_constante", "con_pista"],
    e2: ["autonomo", "sin_evidencia", "apoyo_constante"],
    e3: ["autonomo", "apoyo_constante", "autonomo"],
    e4: ["autonomo", "sin_evidencia", "apoyo_constante"],
  },
};

console.log("Puente diagnóstico → indicadores débiles:");
check("A2 (ecuaciones, mayoría requiere apoyo) sale como débil", () => {
  const debiles = indicadoresDebilesDeDiagnostico(diagnostico);
  assert(debiles.some((d) => /ecuaciones lineales/.test(d)), "no detectó A2 como débil: " + debiles.join(" | "));
});
check("A1 (todos logrado) NO sale como débil", () => {
  const debiles = indicadoresDebilesDeDiagnostico(diagnostico);
  assert(!debiles.some((d) => /Infiere información/.test(d)), "marcó débil un aprendizaje fuerte");
});
check("devuelve la DESCRIPCIÓN del indicador (no el texto del aprendizaje) cuando el ítem la trae", () => {
  const debiles = indicadoresDebilesDeDiagnostico(diagnostico);
  assert(debiles.some((d) => /^IM-3/.test(d)), "no usó el indicador del ítem: " + debiles.join(" | "));
});
check("diagnóstico vacío → [] (fail-closed)", () => {
  assert(indicadoresDebilesDeDiagnostico({}).length === 0, "no devolvió vacío");
  assert(indicadoresDebilesDeDiagnostico({ aprendizajes: ["x"], estudiantes: [] }).length === 0, "sin estudiantes debería ser vacío");
});
check("umbral configurable: con umbral alto, menos débiles", () => {
  const laxo = indicadoresDebilesDeDiagnostico(diagnostico, { umbralApoyo: 25 });
  const estricto = indicadoresDebilesDeDiagnostico(diagnostico, { umbralApoyo: 90 });
  assert(laxo.length >= estricto.length, "el umbral no filtra");
});

console.log("Mezcla de fuentes:");
check("mezcla diagnóstico + evaluaciones sin duplicar, diagnóstico primero", () => {
  const r = mezclarIndicadoresDebiles(["IM-3 ecuaciones", "IL-1 inferir"], ["IM-3 ecuaciones", "IC-2 otra"]);
  assert(r.length === 3, "no deduplicó: " + r.join(" | "));
  assert(r[0] === "IM-3 ecuaciones", "no priorizó el diagnóstico");
});
check("mezcla tolera vacíos", () => {
  assert(mezclarIndicadoresDebiles([], []).length === 0, "vacío+vacío no es vacío");
  assert(mezclarIndicadoresDebiles(["a"], []).length === 1, "pierde el único");
});

console.log(`\n${pasos} ✓ · ${fallos} ✗`);
if (fallos > 0) process.exit(1);
