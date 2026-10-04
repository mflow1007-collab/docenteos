/**
 * test-pruebas-diagnosticas.mjs — valida el Banco de Pruebas Oficiales (Fase 1):
 * que las 12 pruebas estructuradas estén bien formadas, sin mojibake, con ítems y
 * estímulos coherentes; y la lógica pura de diagnosticoClaveService.
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildPromptClave, aplicarClavesAPrueba } from "../src/services/diagnosticoClaveService.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "src/data/diagnostico/pruebas-oficiales");

let pasos = 0, fallos = 0;
const check = (nombre, fn) => {
  try { fn(); pasos += 1; console.log(`  ✓ ${nombre}`); }
  catch (e) { fallos += 1; console.log(`  ✗ ${nombre}: ${e.message}`); }
};
const assert = (c, m) => { if (!c) throw new Error(m); };

const archivos = readdirSync(DIR).filter((f) => f.endsWith(".json"));
const pruebas = archivos.map((f) => ({ f, d: JSON.parse(readFileSync(join(DIR, f), "utf8")) }));

console.log("Banco de Pruebas Oficiales (12 archivos):");
check("hay 12 pruebas (4 áreas × 3 grados)", () => {
  assert(pruebas.length === 12, `hay ${pruebas.length} pruebas, esperaba 12`);
});
check("áreas y grados esperados están todos", () => {
  const areas = new Set(pruebas.map((p) => p.d.metadatos.area));
  for (const a of ["Lengua Española", "Matemática", "Ciencias Sociales", "Ciencias de la Naturaleza"]) {
    assert(areas.has(a), `falta el área ${a}`);
  }
  const grados = new Set(pruebas.map((p) => p.d.metadatos.grado));
  for (const g of ["1ro", "2do", "3ro"]) assert(grados.has(g), `falta el grado ${g}`);
});

console.log("Cada prueba:");
for (const { f, d } of pruebas) {
  const nombre = f.replace("prueba_", "").replace(".json", "");
  check(`${nombre}: metadatos completos + 15 ítems`, () => {
    const m = d.metadatos || {};
    for (const k of ["area", "grado", "nivel", "institucion", "tiempoMinutos"]) {
      assert(m[k] !== undefined && m[k] !== "", `metadato ${k} vacío`);
    }
    assert(d.items.length === 15, `tiene ${d.items.length} ítems (esperaba 15)`);
  });
  check(`${nombre}: ítems bien formados y estímulos referenciados existen`, () => {
    const ids = new Set((d.estimulos || []).map((e) => e.id));
    const nums = d.items.map((i) => i.numero);
    assert(JSON.stringify(nums) === JSON.stringify([...Array(15)].map((_, i) => i + 1)),
      `numeración no es 1..15: ${nums.join(",")}`);
    for (const it of d.items) {
      assert(_texto(it.enunciado).length >= 10, `ítem ${it.numero} con enunciado vacío`);
      if (it.estimuloId) assert(ids.has(it.estimuloId), `ítem ${it.numero} referencia estímulo inexistente ${it.estimuloId}`);
      if (it.tipo === "opcion_multiple") {
        assert(it.opciones.length >= 2 && it.opciones.length <= 4,
          `ítem ${it.numero} con ${it.opciones.length} opciones`);
      }
      // Clave sin confirmar al generar: fail-closed.
      assert(it.claveEstado === "sin_clave", `ítem ${it.numero} no debería traer clave confirmada tras convertir`);
    }
  });
  check(`${nombre}: sin mojibake residual ni contaminación de instrucciones`, () => {
    const json = JSON.stringify(d);
    assert(!/Ã.|â€|â¢/.test(json), "hay mojibake residual (Ã / â€ / â¢)");
    const contaminados = d.items.filter((i) => /Catorce preguntas|Marca con una X|No utilices calculadora|Dispones de \d+ min/i.test(i.enunciado));
    assert(contaminados.length === 0, `ítems con texto de instrucciones: ${contaminados.map((i) => i.numero).join(",")}`);
  });
}

console.log("diagnosticoClaveService (lógica pura):");
const muestra = pruebas[0].d;
check("buildPromptClave incluye los ítems y pide JSON de claves", () => {
  const p = buildPromptClave(muestra);
  assert(/"claves"/.test(p), "no pide el JSON de claves");
  assert(p.includes(muestra.items[0].enunciado.slice(0, 20)), "no incluye los ítems");
});
check("aplicarClavesAPrueba marca por_revisar (nunca confirmada)", () => {
  const claves = muestra.items.map((i) => ({
    numero: i.numero, correcta: i.tipo === "opcion_multiple" ? "b" : "",
    justificacion: "x", guiaAbierta: i.tipo === "abierta" ? "criterio" : "", requiereImagen: false,
  }));
  const res = aplicarClavesAPrueba(muestra, claves);
  const multiples = res.items.filter((i) => i.tipo === "opcion_multiple");
  assert(multiples.every((i) => i.claveIA === "b" && i.claveEstado === "por_revisar"),
    "no marcó las múltiples como por_revisar con la clave de la IA");
  assert(!res.items.some((i) => i.claveEstado === "confirmada"),
    "ninguna clave debe quedar confirmada automáticamente");
});
check("requiereImagen → claveEstado requiere_imagen y sin clave", () => {
  const claves = [{ numero: muestra.items[0].numero, correcta: "", requiereImagen: true, justificacion: "usa un mapa" }];
  const res = aplicarClavesAPrueba(muestra, claves);
  const it = res.items.find((i) => i.numero === muestra.items[0].numero);
  assert(it.claveEstado === "requiere_imagen" && !it.claveIA, "no marcó requiere_imagen");
});

function _texto(v) { return String(v ?? "").trim(); }

console.log(`\n${pasos} ✓ · ${fallos} ✗`);
if (fallos > 0) process.exit(1);
