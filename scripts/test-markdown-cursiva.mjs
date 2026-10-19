/**
 * test-markdown-cursiva.mjs — Regresión del parser de cursiva Markdown.
 *
 * Bug corregido: la regex ingenua /_([^_]+)_/ convertía CUALQUIER par de guiones
 * bajos en <em>, rompiendo códigos curriculares (ING_1_121 → ING<em>1</em>121),
 * identificadores (snake_case) y URLs. El helper cursivaMarkdownSegura solo trata
 * `_` como énfasis cuando actúa de delimitador, no cuando es parte de una palabra.
 *
 * Verifica: casos de la incidencia, preservación de `_` en identificadores,
 * idempotencia (f(f(x)) === f(x)) y el pipeline completo markdownLigeroSeguro.
 *
 * Ejecutar: node scripts/test-markdown-cursiva.mjs
 */
import { cursivaMarkdownSegura, markdownLigeroSeguro } from "../src/utils/html.js";

let pasos = 0, fallos = 0;
const check = (n, fn) => { try { fn(); pasos += 1; console.log(`  ✓ ${n}`); } catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); } };
const eq = (got, exp, msg) => { if (got !== exp) throw new Error(`${msg || ""} — got ${JSON.stringify(got)}, exp ${JSON.stringify(exp)}`); };

console.log("Parser de cursiva Markdown (regresión):");

check("preserva códigos curriculares con guion bajo (ING_1_121)", () => {
  eq(cursivaMarkdownSegura("El indicador ING_1_121 aplica"), "El indicador ING_1_121 aplica");
});

check("preserva identificadores snake_case y URLs con _", () => {
  eq(cursivaMarkdownSegura("snake_case_var"), "snake_case_var");
  eq(cursivaMarkdownSegura("http://x/a_b_c"), "http://x/a_b_c");
});

check("convierte cursiva pegada a paréntesis/puntuación (casos de la incidencia)", () => {
  eq(cursivaMarkdownSegura("_(I eat breakfast at 8 a.m.)_)"), "<em>(I eat breakfast at 8 a.m.)</em>)");
  eq(cursivaMarkdownSegura("Yes, I do!_(What about English?)_"), "Yes, I do!<em>(What about English?)</em>");
});

check("convierte cursiva simple de una palabra", () => {
  eq(cursivaMarkdownSegura("una _palabra_ en cursiva"), "una <em>palabra</em> en cursiva");
});

check("no toca texto sin delimitadores de énfasis", () => {
  eq(cursivaMarkdownSegura("texto normal sin cursiva"), "texto normal sin cursiva");
});

check("es idempotente: f(f(x)) === f(x)", () => {
  const entrada = "_(Good morning!)_ y el código ING_1_121 junto a snake_case";
  const una = cursivaMarkdownSegura(entrada);
  const dos = cursivaMarkdownSegura(una);
  eq(dos, una, "no idempotente");
});

check("markdownLigeroSeguro: negrita + cursiva + escape, preservando códigos", () => {
  const out = markdownLigeroSeguro('**Responden** al saludo _(Good morning!)_ — ver ING_1_121');
  // Negrita convertida, cursiva convertida, código intacto, sin HTML inyectado
  if (!out.includes("<strong>Responden</strong>")) throw new Error("negrita no convertida");
  if (!out.includes("<em>(Good morning!)</em>")) throw new Error("cursiva no convertida");
  if (!out.includes("ING_1_121")) throw new Error("código roto");
});

check("markdownLigeroSeguro escapa HTML inyectado (no rompe la seguridad)", () => {
  const out = markdownLigeroSeguro("<script>alert(1)</script> _ok_");
  if (out.includes("<script>")) throw new Error("no escapó el <script>");
  if (!out.includes("&lt;script&gt;")) throw new Error("escape incorrecto");
});

console.log(`\nParser de cursiva: ${pasos} pasos, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
