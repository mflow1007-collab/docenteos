/**
 * Colores del registro oficial en las tarjetas de curso (src/utils/coloresRegistro.js).
 *
 * Ejecutar:  node scripts/test-colores-registro.mjs
 */
import { CREMA_REGISTRO, coloresRegistro } from "../src/utils/coloresRegistro.js";

let pasos = 0, fallos = 0;
const check = (n, fn) => { try { fn(); pasos += 1; console.log(`  ✓ ${n}`); } catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); } };
const assert = (c, m) => { if (!c) throw new Error(m); };

const luz = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  .map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
  .reduce((s, x, i) => s + x * [0.2126, 0.7152, 0.0722][i], 0);
const contraste = (a, b) => (Math.max(luz(a), luz(b)) + 0.05) / (Math.min(luz(a), luz(b)) + 0.05);
const curso = (nombre, nivel = "Secundaria") => ({ nombre, nivel });
const GRADOS = ["1ro", "2do", "3ro", "4to", "5to", "6to"];

console.log("\nColores del registro en los cursos\n");

check("los seis grados de Secundaria tienen su color y son distintos", () => {
  const colores = GRADOS.map((g) => coloresRegistro(curso(`${g} Secundaria A`)));
  assert(colores.every(Boolean), "falta un grado");
  assert(new Set(colores.map((c) => c.fuerte)).size === 6, "colores repetidos");
});

check("el nombre y el icono se leen (contraste 4.5 o más)", () => {
  GRADOS.forEach((g) => {
    const { fuerte, suave } = coloresRegistro(curso(`${g} Secundaria A`));
    [["crema", CREMA_REGISTRO], ["blanco", "#ffffff"]].forEach(([n, fondo]) =>
      assert(contraste(fuerte, fondo) >= 4.5, `${g} sobre ${n}: ${contraste(fuerte, fondo).toFixed(2)}`));
    assert(contraste("#0f172a", suave) >= 4.5, `${g}: texto oscuro sobre el fondo`);
  });
});

check("sin color confirmado se queda como estaba", () => {
  [curso("2do Primaria A", "Primaria"), curso("2do Secundaria A", ""), curso("Segundo A"), curso("12 A"), {}, null]
    .forEach((c) => assert(coloresRegistro(c) === null, JSON.stringify(c)));
});

console.log(`\n${pasos} correctas, ${fallos} fallidas\n`);
if (fallos) process.exit(1);
