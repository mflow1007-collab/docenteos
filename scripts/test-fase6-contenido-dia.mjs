/**
 * test-fase6-contenido-dia.mjs — FASE 6 (del 3er PDF real "Escuela y educación 15").
 *
 * Tres arreglos verificados contra lo que el revisor marcó:
 *  P3 — la gramática del día se prioriza por afinidad al producto (Can/may/could,
 *       imperativo, preposiciones de lugar) en vez del "pasado simple" genérico.
 *  P2 — los aportes genéricos repetidos ("producción escrita con el contenido
 *       central del tema") se reescriben como SECCIÓN nombrada del producto a
 *       partir del foco real, no como "Borrador desarrollado 5 de…".
 *  P1 — (se verifica indirectamente: el aporte base ya no es el placeholder).
 *
 * Ejecutar: node scripts/test-fase6-contenido-dia.mjs
 */
import { priorizarYEnriquecerGramatica } from "../src/services/phaseAService.js";
import { asegurarAporteProductoUnico } from "../src/services/unidadAprendizajeService.js";

let pasos = 0, fallos = 0;
const check = (n, fn) => { try { fn(); pasos += 1; console.log(`  ✓ ${n}`); } catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); } };
const assert = (c, m) => { if (!c) throw new Error(m); };

// Gramática REAL de la malla 2do Inglés tema Escuela (orden de malla: narrar
// experiencias primero, orientación mucho después — el bug que arreglamos).
const GRAM_ESCUELA = [
  "Pasado simple al narrar hechos y experiencias: I lived in the US until I was seven.",
  "Presente perfecto para narrar hechos y experiencias: I've seen the flamingos.",
  "Pasado continuo para narrar hechos y experiencias: He was coughing last night.",
  "Can, may y could para sostener una conversación: May I speak to Rosa, please?",
  "Modo imperativo para dar consejos y sugerencias: Don't eat junk food.",
  "Should para pedir y dar consejos y sugerencias: You should drink more water.",
  "Preposiciones de lugar: in, on, at — The office is next to the library.",
];

console.log("FASE 6 · P3 — gramática priorizada por el producto:");

check("la gramática de ORIENTACIÓN (can/may/could) sube antes que 'pasado simple para narrar'", () => {
  const g = priorizarYEnriquecerGramatica({
    gramaticaMalla: GRAM_ESCUELA,
    producto: "Our School Survival Guide — guía para orientar estudiantes nuevos",
    tema: "Escuela y educación",
  });
  const iCan = g.findIndex((x) => /Can, may y could/i.test(x));
  const iPasado = g.findIndex((x) => /Pasado simple al narrar/i.test(x));
  assert(iCan !== -1, "perdió Can/may/could");
  // Si el pasado simple aparece, debe ir DESPUÉS de la gramática de orientación.
  if (iPasado !== -1) assert(iCan < iPasado, `Can (${iCan}) no quedó antes que Pasado (${iPasado})`);
});

check("imperativo y should (afines a orientar/aconsejar) entran en el top", () => {
  const g = priorizarYEnriquecerGramatica({
    gramaticaMalla: GRAM_ESCUELA,
    producto: "Our School Survival Guide", tema: "Escuela y educación", limite: 6,
  });
  assert(g.some((x) => /imperativo/i.test(x)), "no priorizó el imperativo");
  assert(g.some((x) => /Should/i.test(x)), "no priorizó should");
});

check("tema sin campo claro → gramática sin tocar (coherencia)", () => {
  const gram = ["Teorema de Pitágoras", "Ecuaciones de primer grado"];
  const g = priorizarYEnriquecerGramatica({ gramaticaMalla: gram, producto: "Informe", tema: "Álgebra" });
  assert(g.length === gram.length && g.every((x) => gram.includes(x)), "alteró un tema sin campo");
});

console.log("\nFASE 6 · P2 — aportes genéricos → sección nombrada del producto:");

check("aporte genérico repetido se reescribe como 'Sección «<foco>» de la guía'", () => {
  const usados = new Set(["produccion escrita con el contenido central del tema sobre escuela y educacion"]);
  const r = asegurarAporteProductoUnico({
    aporte: "producción escrita con el contenido central del tema sobre Escuela y educación",
    faseNumero: 2,
    foco: "Can, may y could para pedir ayuda: May I go to the library?",
    claseNumero: 5,
    usados,
  });
  assert(r.ajustado, "no se ajustó");
  assert(/^Sección «.+» de la guía/.test(r.texto), `no quedó como sección nombrada: ${r.texto}`);
  assert(/Can, may y could/i.test(r.texto), `no usó el foco real: ${r.texto}`);
  assert(!/Borrador desarrollado/i.test(r.texto), `siguió usando el prefijo fantasma: ${r.texto}`);
});

check("aporte NO genérico y único → se devuelve igual (sin tocar)", () => {
  const r = asegurarAporteProductoUnico({
    aporte: "Sección de ubicaciones de la escuela",
    faseNumero: 2, foco: "Preposiciones de lugar", claseNumero: 3, usados: new Set(),
  });
  assert(!r.ajustado, "ajustó un aporte que no debía");
  assert(r.texto === "Sección de ubicaciones de la escuela", `alteró el aporte: ${r.texto}`);
});

check("aporte genérico SIN foco real → cae al comportamiento de etapa (no rompe)", () => {
  const usados = new Set(["produccion escrita con el contenido central del tema"]);
  const r = asegurarAporteProductoUnico({
    aporte: "producción escrita con el contenido central del tema",
    faseNumero: 2, foco: "", claseNumero: 5, usados,
  });
  assert(r.ajustado, "no se ajustó");
  assert(r.texto.length > 0, "devolvió vacío");
});

console.log(`\nFASE 6: ${pasos} pasos, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
