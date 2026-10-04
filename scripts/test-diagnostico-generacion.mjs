/**
 * test-diagnostico-generacion.mjs — Fase 2: generador de prueba diagnóstica
 * contextualizada. Prueba lógica pura sin IA ni navegador:
 *  - derivarMoldeDePrueba / describirMolde (diagnosticoMoldeService)
 *  - buildPromptDiagnostico / buildSystemPromptDiagnostico / validarPruebaGenerada
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { derivarMoldeDePrueba, describirMolde } from "../src/services/diagnosticoMoldeService.js";
import {
  buildPromptDiagnostico, buildSystemPromptDiagnostico, validarPruebaGenerada,
} from "../src/services/diagnosticoGeneracionService.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const prueba = (f) => JSON.parse(readFileSync(join(ROOT, "src/data/diagnostico/pruebas-oficiales", f), "utf8"));

let pasos = 0, fallos = 0;
const check = (n, fn) => { try { fn(); pasos += 1; console.log(`  ✓ ${n}`); } catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); } };
const assert = (c, m) => { if (!c) throw new Error(m); };

// Prueba generada VÁLIDA de referencia (forma canónica).
const pruebaOK = (overrides = {}) => ({
  metadatos: { area: "Lengua Española", grado: "1ro", totalItems: 3 },
  estimulos: [{ id: "E1", tipo: "noticia", titulo: "T", texto: "Un texto de estímulo suficientemente largo para validar.", fuente: "original" }],
  items: [
    { numero: 1, estimuloId: "E1", tipo: "opcion_multiple", enunciado: "¿Qué dice el texto sobre X?", opciones: ["a) uno", "b) dos", "c) tres", "d) cuatro"], claveIA: "b", claveEstado: "por_revisar", respuestaAbiertaGuia: "", competencia: "Comprensión", indicador: "Infiere información" },
    { numero: 2, estimuloId: "E1", tipo: "opcion_multiple", enunciado: "¿Cuál es la idea central?", opciones: ["a) uno", "b) dos", "c) tres", "d) cuatro"], claveIA: "c", claveEstado: "por_revisar", respuestaAbiertaGuia: "", competencia: "Comprensión", indicador: "Identifica idea central" },
    { numero: 3, estimuloId: null, tipo: "abierta", enunciado: "Explica con tus palabras.", opciones: [], claveIA: "", claveEstado: "guia_abierta", respuestaAbiertaGuia: "Debe mencionar la causa y una consecuencia.", competencia: "Producción", indicador: "Produce texto breve" },
  ],
  ...overrides,
});
const molde3 = { totalItems: 3, itemsAbiertos: 1, tiempoMinutos: 90, opcionesPorItem: 4, tiposEstimulo: ["noticia"], destrezas: null };

console.log("Molde (derivado de pruebas oficiales reales):");
check("deriva el molde de Lengua 1ro (15 ítems, estímulos con tipo)", () => {
  const m = derivarMoldeDePrueba(prueba("prueba_lengua_espanola_1ro_secundaria.json"));
  assert(m.totalItems === 15, `totalItems=${m.totalItems}`);
  assert(m.itemsAbiertos >= 1, "no detectó abiertos");
  assert(m.tiposEstimulo.length > 0, "sin tipos de estímulo");
  assert(m.opcionesPorItem >= 3 && m.opcionesPorItem <= 4, `opcionesPorItem=${m.opcionesPorItem}`);
});
check("describirMolde produce una receta en prosa", () => {
  const txt = describirMolde(molde3);
  assert(/3 ítems/.test(txt) && /90 minutos/.test(txt), "no describe ítems/tiempo");
});

console.log("System + prompt:");
check("system de idioma exige textos en el idioma meta y guion de listening", () => {
  const sys = buildSystemPromptDiagnostico("Lenguas Extranjeras", "Secundaria", true);
  assert(/EN INGL[EÉ]S|idioma meta/i.test(sys), "no exige idioma meta");
  assert(/GUION|audio grabado/i.test(sys), "no aclara el listening");
});
check("prompt incluye molde, indicadores y realidad del grupo", () => {
  const p = buildPromptDiagnostico({
    area: "Lengua Española", asignatura: "Lengua Española", grado: "1ro", nivel: "Secundaria",
    molde: molde3,
    referentes: { indicadores: [{ descripcion: "Infiere información explícita", competencia: "Comprensión" }], fuente: "Malla oficial" },
    contexto: { zonaEscolar: "rural", contextoComunitario: "pueblo pesquero", matices: "nivel inicial" },
  });
  assert(/MOLDE a seguir/.test(p), "sin molde");
  assert(/Infiere información explícita/.test(p), "sin indicadores");
  assert(/RURAL|pueblo pesquero|nivel inicial/i.test(p), "sin realidad del grupo");
  assert(/EXACTAMENTE 3 ítems/.test(p), "no fija el conteo del molde");
});

console.log("Validación de la prueba generada:");
check("una prueba generada válida pasa", () => {
  const v = validarPruebaGenerada(pruebaOK(), { molde: molde3, idioma: false });
  assert(v.ok, v.motivos.join("; "));
});
check("conteo de ítems distinto al molde → falla", () => {
  const p = pruebaOK(); p.items = p.items.slice(0, 2);
  const v = validarPruebaGenerada(p, { molde: molde3 });
  assert(!v.ok && v.motivos.some((m) => /molde pide 3/.test(m)), "no detectó el conteo");
});
check("ítem de opción múltiple sin claveIA → falla", () => {
  const p = pruebaOK(); p.items[0].claveIA = "";
  const v = validarPruebaGenerada(p, { molde: molde3 });
  assert(!v.ok && v.motivos.some((m) => /claveIA inválida/.test(m)), "no exigió claveIA");
});
check("ítem sin indicador/competencia → falla", () => {
  const p = pruebaOK(); p.items[0].competencia = ""; p.items[0].indicador = "";
  const v = validarPruebaGenerada(p, { molde: molde3 });
  assert(!v.ok && v.motivos.some((m) => /sin indicador/.test(m)), "no exigió indicador");
});
check("ítem abierto sin guía de corrección → falla", () => {
  const p = pruebaOK(); p.items[2].respuestaAbiertaGuia = "";
  const v = validarPruebaGenerada(p, { molde: molde3 });
  assert(!v.ok && v.motivos.some((m) => /sin guía/.test(m)), "no exigió guía abierta");
});
check("estímulo referenciado inexistente → falla", () => {
  const p = pruebaOK(); p.items[0].estimuloId = "E9";
  const v = validarPruebaGenerada(p, { molde: molde3 });
  assert(!v.ok && v.motivos.some((m) => /estímulo inexistente/.test(m)), "no detectó estímulo fantasma");
});

console.log(`\n${pasos} ✓ · ${fallos} ✗`);
if (fallos > 0) process.exit(1);
