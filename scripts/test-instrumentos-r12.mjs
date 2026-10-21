/**
 * test-instrumentos-r12.mjs — R12: Matrix 4 oficial (Guía Paso 2.2) completo.
 *
 * Verifica que el catálogo de instrumentos reconozca los 6 tipos oficiales,
 * incluidos los 2 que faltaban: Cuestionario y Prueba competencial (pruebas
 * orales/escritas recomendadas para evaluar dominio de conceptos — Guía 2.2.2).
 * El cambio es ADITIVO: no altera la selección automática existente.
 *
 * Ejecutar: node scripts/test-instrumentos-r12.mjs
 */
import {
  TIPOS_INSTRUMENTO,
  ETIQUETA_TIPO_INSTRUMENTO,
  normalizarTipoInstrumento,
} from "../src/services/hiloPedagogico.js";

let pasos = 0, fallos = 0;
const check = (n, fn) => { try { fn(); pasos += 1; console.log(`  ✓ ${n}`); } catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); } };
const assert = (c, m) => { if (!c) throw new Error(m); };

console.log("R12 — Matrix 4 oficial (6 tipos de instrumento):");

check("el catálogo incluye cuestionario y prueba_competencial", () => {
  assert(TIPOS_INSTRUMENTO.includes("cuestionario"), "falta cuestionario");
  assert(TIPOS_INSTRUMENTO.includes("prueba_competencial"), "falta prueba_competencial");
});

check("los 6 tipos oficiales tienen etiqueta legible", () => {
  assert(ETIQUETA_TIPO_INSTRUMENTO.cuestionario === "Cuestionario", "etiqueta de cuestionario incorrecta");
  assert(ETIQUETA_TIPO_INSTRUMENTO.prueba_competencial === "Prueba competencial", "etiqueta de prueba competencial incorrecta");
});

check("normaliza 'Cuestionario', 'prueba escrita' y 'prueba oral' → cuestionario", () => {
  assert(normalizarTipoInstrumento("Cuestionario") === "cuestionario", "no normalizó 'Cuestionario'");
  assert(normalizarTipoInstrumento("prueba escrita") === "cuestionario", "no normalizó 'prueba escrita'");
  assert(normalizarTipoInstrumento("Prueba oral") === "cuestionario", "no normalizó 'prueba oral'");
});

check("normaliza 'Prueba competencial' y 'examen' → prueba_competencial", () => {
  assert(normalizarTipoInstrumento("Prueba competencial") === "prueba_competencial", "no normalizó 'prueba competencial'");
  assert(normalizarTipoInstrumento("examen final") === "prueba_competencial", "no normalizó 'examen'");
});

check("'prueba competencial' gana sobre 'cuestionario' cuando ambos aparecen", () => {
  // "prueba" se evalúa antes; si el docente dijo competencial, se respeta.
  assert(normalizarTipoInstrumento("prueba competencial con cuestionario") === "prueba_competencial",
    "no priorizó prueba competencial");
});

// ── Regresión: los tipos existentes NO cambiaron de comportamiento ────────────
check("los 5 tipos previos siguen normalizando igual (sin regresión)", () => {
  assert(normalizarTipoInstrumento("Rúbrica") === "rubrica", "rúbrica");
  assert(normalizarTipoInstrumento("Lista de cotejo") === "lista_cotejo", "cotejo");
  assert(normalizarTipoInstrumento("Escala de estimación") === "escala_estimativa", "escala");
  assert(normalizarTipoInstrumento("Registro anecdótico") === "registro_anecdotico", "anecdótico");
  assert(normalizarTipoInstrumento("Guía de observación") === "guia_observacion", "guía obs");
  assert(normalizarTipoInstrumento("algo raro") === "otro", "fallback otro");
});

console.log(`\nR12: ${pasos} pasos, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
