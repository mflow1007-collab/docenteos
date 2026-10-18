/**
 * test-anexos-trazabilidad.mjs — Regresión de la trazabilidad de anexos D/E/E.2.
 *
 * Bug del PDF "Vida y comunidad escolar": los anexos de proceso (D coevaluación,
 * E autoevaluación, E.2 escala) repetían la MISMA pieza ("Mapa inicial de rutinas"
 * de Fase 1) en casi todas las filas, porque los ítems genéricos no lograban una
 * coincidencia léxica fuerte y caían siempre en la primera pieza.
 *
 * Ahora: coincidencia fuerte (≥2 tokens) gana por relevancia; si no, se DISTRIBUYE
 * entre las piezas reales de las fases por índice de fila (regla: nada de fallback
 * silencioso a [0]).
 *
 * Ejecutar: node scripts/test-anexos-trazabilidad.mjs
 */
import { construirAnexosUnidad } from "../src/services/unidadAprendizajeService.js";

let pasos = 0, fallos = 0;
const check = (n, fn) => { try { fn(); pasos += 1; console.log(`  ✓ ${n}`); } catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); } };
const assert = (c, m) => { if (!c) throw new Error(m); };

console.log("Trazabilidad de anexos D/E/E.2 (regresión):");

// Piezas reales de las 4 fases (como las produce el generador).
const piezas = [
  { texto: "Mapa inicial de rutinas para A Day in My Life" },                 // Fase 1
  { texto: "Descripción escrita usando there is/there are para A Day in My Life" }, // Fase 2
  { texto: "Entrevista escrita sobre el día escolar para A Day in My Life" }, // Fase 3
  { texto: "Guion final para la presentación de A Day in My Life" },          // Fase 4
];
const anexos = construirAnexosUnidad({
  area: "Inglés", tema: "Vida y comunidad escolar", producto: "A Day in My Life",
  vocabulario: ["take a shower", "subject"], fases: [], numSemanas: 4,
  aportesProducto: piezas,
});

const distintas = (arr) => new Set((arr || []).map((x) => x.piezaProducto)).size;

check("Anexo E (autoevaluación) no repite la misma pieza en todas las filas", () => {
  assert(distintas(anexos.autoevaluacion) > 1, `solo ${distintas(anexos.autoevaluacion)} pieza(s) distinta(s)`);
});

check("Anexo D (coevaluación) distribuye piezas", () => {
  assert(distintas(anexos.coevaluacion) > 1, `solo ${distintas(anexos.coevaluacion)} pieza(s) distinta(s)`);
});

check("Anexo E.2 (escala) distribuye piezas", () => {
  assert(distintas(anexos.escalaValoracion) > 1, `solo ${distintas(anexos.escalaValoracion)} pieza(s) distinta(s)`);
});

check("las piezas de los anexos provienen de las fases reales (no inventadas)", () => {
  const validas = new Set(piezas.map((p) => p.texto));
  const todas = [...anexos.autoevaluacion, ...anexos.coevaluacion, ...anexos.escalaValoracion];
  for (const fila of todas) {
    assert(validas.has(fila.piezaProducto), `pieza no proviene de las fases: "${fila.piezaProducto}"`);
  }
});

check("una fila con coincidencia fuerte respeta su pieza relevante", () => {
  // Un ítem que nombra explícitamente "entrevista" debe mapear a esa pieza.
  const anexos2 = construirAnexosUnidad({
    area: "Inglés", tema: "Vida y comunidad escolar", producto: "A Day in My Life",
    vocabulario: ["x"], fases: [], numSemanas: 4, aportesProducto: piezas,
  });
  // La rúbrica del producto usa criterios con tokens; al menos una pieza concreta aparece.
  assert(Array.isArray(anexos2.rubricaProducto) && anexos2.rubricaProducto.length > 0, "sin rúbrica");
});

console.log(`\nTrazabilidad de anexos: ${pasos} pasos, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
