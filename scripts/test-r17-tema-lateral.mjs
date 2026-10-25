/**
 * test-r17-tema-lateral.mjs — R17 (reorientación del tema LATERAL al producto).
 *
 * El PDF real "Escuela y educación 16" probó que la Fase 3 (tema lateral
 * "Actividades de la vida diaria") producía piezas por-tema ("lista de
 * recomendaciones sobre Actividades de la vida diaria", "take the metro") en vez
 * de aportes al producto, mientras la Fase 2 (tema central) sí los orientaba.
 *
 * CAUSA RAÍZ (corregida): el armado del día pasaba `temaCentral =
 * specActual.temaOficial`, pero en la spec de FASE ese temaOficial ES el tema de
 * la semana — en una fase de tema lateral, el tema lateral. Entonces
 * esTemaLateral(lateral, lateral) = false y la reorientación R2 (que ya existía)
 * NUNCA se disparaba. El fix pasa el TÍTULO real de la unidad como central.
 *
 * Este test fija esa regresión a nivel de la comparación `esTemaLateral` (la
 * pieza del día es un closure interno no exportable) y confirma, vía
 * validarCoherenciaProducto, que un aporte reorientado al producto NO dispara
 * alerta de desalineación.
 *
 * Ejecutar: node scripts/test-r17-tema-lateral.mjs
 */
import { esTemaLateral, validarCoherenciaProducto } from "../src/services/unidadAprendizajeService.js";

let pasos = 0, fallos = 0;
const check = (n, fn) => { try { fn(); pasos += 1; console.log(`  ✓ ${n}`); } catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); } };
const assert = (c, m) => { if (!c) throw new Error(m); };

const TITULO_UNIDAD = "Escuela y educación";
const TEMA_LATERAL = "Actividades de la vida diaria";
const PRODUCTO = "Our School Survival Guide — guía para orientar estudiantes nuevos";

console.log("R17 · el tema central correcto dispara la reorientación:");

check("BUG reproducido: central = tema lateral (el valor viejo) → NO lateral → NO reorienta", () => {
  // specActual.temaOficial en la spec de FASE era el propio tema lateral.
  const central_viejo = TEMA_LATERAL;
  assert(esTemaLateral(TEMA_LATERAL, central_viejo) === false,
    "con el central equivocado debería dar false (y por eso NO reorientaba)");
});

check("FIX: central = título de la unidad → SÍ lateral → SÍ reorienta", () => {
  // Con el fix, se pasa `tema` (el título de la unidad) como central.
  assert(esTemaLateral(TEMA_LATERAL, TITULO_UNIDAD) === true,
    "con el título de la unidad como central, el tema lateral debe detectarse");
});

check("tema central (no lateral) con el fix → sigue sin reorientar (no rompe Fase 2)", () => {
  // La fase del tema central NO debe reorientarse (ya está en el producto).
  assert(esTemaLateral(TITULO_UNIDAD, TITULO_UNIDAD) === false,
    "el tema central no debe tratarse como lateral");
});

check("inclusión tolerante: sub-tema contenido en el central → no lateral", () => {
  assert(esTemaLateral("educación", TITULO_UNIDAD) === false,
    "un sub-tema contenido en el central no es lateral");
});

console.log("\nR17 · el aporte reorientado al producto no dispara alerta de desalineación:");

check("aportes de tema lateral REORIENTADOS al producto → sin alerta de desalineación", () => {
  // Así quedan las piezas de Fase 3 tras el fix (reorientadas hacia el producto).
  const aportesReorientados = [
    { semana: 3, texto: `diálogo de peticiones y permisos sobre ${TITULO_UNIDAD} (aporte a Our School Survival Guide)` },
    { semana: 3, texto: `rutina (antes/durante/después) orientada a Our School Survival Guide, con adverbios de frecuencia` },
    { semana: 4, texto: `lista de recomendaciones sobre ${TITULO_UNIDAD} (aporte a Our School Survival Guide)` },
    { semana: 4, texto: `avance integrado del producto Our School Survival Guide` },
  ];
  const avisos = validarCoherenciaProducto({
    producto: PRODUCTO,
    temaCentral: TITULO_UNIDAD,
    aportesProducto: aportesReorientados,
    numSemanas: 5,
  });
  assert(!avisos.some((a) => /desalineaci/i.test(a)),
    `no debería alertar desalineación con aportes reorientados: ${JSON.stringify(avisos)}`);
});

console.log(`\nR17: ${pasos} pasos, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
