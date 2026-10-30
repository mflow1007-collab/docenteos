/**
 * test-reanudacion-generacion.mjs — reanudación automática de la unidad:
 * hasta 2 vueltas extra solo con fallos reanudables; con créditos agotados u
 * otro error se detiene enseguida; tras la última vuelta llega el error original.
 *
 * Ejecutar: node scripts/test-reanudacion-generacion.mjs
 */
import { conReanudacion, VUELTAS_EXTRA, ESPERA_MS } from "../src/services/reanudacionGeneracion.js";

let pasos = 0, fallos = 0;
const check = async (nombre, fn) => {
  try { await fn(); pasos++; console.log(`  ✓ ${nombre}`); }
  catch (e) { fallos++; console.log(`  ✗ ${nombre}: ${e.message}`); }
};
const assert = (c, m) => { if (!c) throw new Error(m); };
const errorFase = (reanudable, fase = 5) => Object.assign(new Error(`fase ${fase}`), { reanudable, faseFallida: fase });
const sinEspera = { esperar: async () => {} };

await check("valores acordados: 2 vueltas extra y 30 s", () => {
  assert(VUELTAS_EXTRA === 2 && ESPERA_MS === 30_000, "constantes");
});

await check("una fase falla y la vuelta siguiente sale: devuelve el resultado y avisa", async () => {
  const avisos = []; const esperas = []; let llamadas = 0;
  const r = await conReanudacion(async () => { llamadas++; if (llamadas === 1) throw errorFase(true); return "unidad"; },
    { onAviso: (t) => avisos.push(t), esperar: async (ms) => { esperas.push(ms); } });
  assert(r === "unidad" && llamadas === 2, "debía salir en la vuelta 2");
  assert(esperas.join() === "30000", "espera de 30 s");
  assert(/La fase 5 no salió.*vuelta 2 de 3/.test(avisos[0]), `aviso: ${avisos[0]}`);
});

await check("tras 3 vueltas fallidas llega el error original", async () => {
  let llamadas = 0; const original = errorFase(true);
  let recibido = null;
  try { await conReanudacion(async () => { llamadas++; throw original; }, sinEspera); } catch (e) { recibido = e; }
  assert(llamadas === 3, `vueltas: ${llamadas}`);
  assert(recibido === original, "debía llegar el error original");
});

await check("créditos agotados (no reanudable): se detiene en la primera vuelta", async () => {
  let llamadas = 0;
  try { await conReanudacion(async () => { llamadas++; throw errorFase(false); }, sinEspera); } catch { /* esperado */ }
  assert(llamadas === 1, `vueltas: ${llamadas}`);
});

await check("otro error (malla, plan maestro…): no reintenta", async () => {
  let llamadas = 0;
  try { await conReanudacion(async () => { llamadas++; throw new Error("Malla incompleta"); }, sinEspera); } catch { /* esperado */ }
  assert(llamadas === 1, `vueltas: ${llamadas}`);
});

console.log(`\n${pasos} ✓ · ${fallos} ✗`);
if (fallos) process.exit(1);
