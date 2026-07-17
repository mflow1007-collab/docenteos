/**
 * audit-cerebro.mjs — Autoauditoría del cerebro de DocenteOS (F3).
 *
 * Automatiza el barrido manual que destapó las colecciones sin regla, las
 * mentes sin doctrina y el localStorage que sobrevivía al logout. Corre en
 * `npm test`: si alguien agrega una colección sin regla, una mente de IA sin
 * fundamento o una clave fuera del prefijo de limpieza, el test lo grita
 * ANTES del commit. Análisis estático puro — sin Firebase ni red.
 *
 * Ejecutar: node scripts/audit-cerebro.mjs
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const problemas = [];
const avisos = [];

// ── Recorrido de src/ ─────────────────────────────────────────────────────────
const archivos = [];
const walk = (dir) => {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) walk(ruta);
    else if (/\.(js|jsx)$/.test(nombre)) archivos.push(ruta);
  }
};
walk(join(raiz, "src"));
const rel = (r) => relative(raiz, r);
const leer = (r) => readFileSync(r, "utf8");
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// ═══ CHECK 1 — Toda colección Firestore usada tiene regla ════════════════════
// El barrido que destapó `estudiantes` y otras 7 colecciones en deny silencioso.
const reglas = leer(join(raiz, "firestore.rules"));
const coleccionesUsadas = new Map(); // nombre → archivo de ejemplo
for (const archivo of archivos) {
  const s = leer(archivo);
  // Colecciones de primer nivel: collection(db, "X") / doc(db, "X", ...)
  for (const m of s.matchAll(/(?:collection|doc)\(db,\s*["'`]([^"'`$]+)["'`]/g)) {
    coleccionesUsadas.set(m[1], rel(archivo));
  }
  // Subcolecciones de usuarios: collection(db, "usuarios", uid, "SUB", ...)
  for (const m of s.matchAll(/(?:collection|doc)\(db,\s*["'`]usuarios["'`],[^,)]+,\s*["'`]([^"'`$]+)["'`]/g)) {
    coleccionesUsadas.set(`usuarios/*/${m[1]}`, rel(archivo));
  }
}
for (const [nombre, archivo] of [...coleccionesUsadas].sort()) {
  const top = nombre.startsWith("usuarios/*/") ? nombre.split("/")[2] : nombre;
  if (top === "usuarios") continue; // el doc raíz tiene su propio match
  if (!reglas.includes(`match /${top}/`)) {
    problemas.push(`C1 · Colección "${nombre}" (${archivo}) SIN regla en firestore.rules → deny silencioso en producción`);
  }
}

// ═══ CHECK 2 — Toda mente de IA pedagógica lleva doctrina ════════════════════
// Un archivo que llama a la IA con un system debe importar el fundamento
// (directo o vía ContextBuilder), o estar EXENTO con razón explícita.
const EXENTOS_DOCTRINA = new Map([
  ["src/services/ai/AIService.js", "gateway — no define mentes"],
  ["src/services/ai/personalChatService.js", "Asistente Personal: NO pedagógico por diseño"],
  ["src/services/ai/agents/AgenteAprendizaje.js", "meta-agente: analiza, no compone para el aula"],
  ["src/services/ai/agents/AgenteOptimizador.js", "meta-agente: cura el BIC"],
  ["src/services/ai/learning/InsightAnalyzer.js", "motor interno de aprendizaje"],
  ["src/services/ai/style/StyleEngine.js", "motor interno de estilo"],
  ["src/admin/pages/AdminPotenteIA.jsx", "operador administrativo, no pedagógico"],
  ["src/admin/AdminPotenteIAFloat.jsx", "operador administrativo, no pedagógico"],
  ["src/admin/pages/AdminEntrenamientoIA.jsx", "asistente del admin"],
  ["src/admin/pages/AdminBancoConocimiento.jsx", "convertidor curricular literal"],
]);
for (const archivo of archivos) {
  const s = leer(archivo);
  const llamaIA = /AIService\.generate\(|callGatewayCollect\(/.test(s) && /system/.test(s);
  if (!llamaIA) continue;
  const r = rel(archivo);
  if (EXENTOS_DOCTRINA.has(r)) continue;
  const conDoctrina = /conFundamento|getFundamentoDoctrinal|buildAIContext/.test(s);
  if (!conDoctrina) {
    problemas.push(`C2 · Mente de IA sin doctrina: ${r} llama a la IA con system propio y no importa el fundamento (ni ContextBuilder). Si es no-pedagógica, agrégala a EXENTOS_DOCTRINA con su razón.`);
  }
}

// ═══ CHECK 3 — localStorage dentro del prefijo que limpia el logout ══════════
// cerrarSesion() borra "docenteos*" y "doe_*": toda clave nueva fuera de esos
// prefijos sobrevive al logout en dispositivos compartidos.
for (const archivo of archivos) {
  const s = sinComentarios(leer(archivo));
  for (const m of s.matchAll(/localStorage\.setItem\(\s*["'`]([^"'`$]+)["'`]/g)) {
    const clave = m[1];
    if (!clave.startsWith("docenteos") && !clave.startsWith("doe_")) {
      problemas.push(`C3 · localStorage.setItem("${clave}") en ${rel(archivo)} fuera de los prefijos del logout (docenteos*/doe_*) — sobrevive en dispositivos compartidos`);
    }
  }
  // Claves construidas con constantes: verificar el prefijo de la constante
  for (const m of s.matchAll(/const\s+\w*(?:PREFIX|KEY)\w*\s*=\s*["'`]([^"'`$]+)["'`]/g)) {
    const clave = m[1];
    if (/storage|draft|borrador|checkpoint|sesion/i.test(m[0]) && !clave.startsWith("docenteos") && !clave.startsWith("doe_")) {
      avisos.push(`C3 · Posible prefijo de storage fuera del logout: "${clave}" en ${rel(archivo)}`);
    }
  }
}

// ═══ CHECK 4 — Ningún nivel educativo hardcodeado en los services ════════════
// El system del Motor mentía "Nivel Secundario" para Primaria/Inicial hasta
// B3; este check impide la regresión. La doctrina por nivel vive SOLO en
// src/data/fundamentoDoctrinalMINERD.js.
for (const archivo of archivos) {
  const r = rel(archivo);
  if (!r.startsWith("src/services/")) continue;
  const s = sinComentarios(leer(archivo));
  for (const nivel of ["Nivel Secundario", "Nivel Primario", "Nivel Inicial"]) {
    if (s.includes(nivel)) {
      problemas.push(`C4 · "${nivel}" hardcodeado en ${r} — el nivel debe salir de spec.nivel/nivelLabelPrompt, la doctrina vive en fundamentoDoctrinalMINERD.js`);
    }
  }
}

// ═══ Resumen ══════════════════════════════════════════════════════════════════
console.log(`\nAUDIT-CEREBRO · ${archivos.length} archivos · ${coleccionesUsadas.size} colecciones detectadas`);
for (const a of avisos) console.warn(`  ⚠ ${a}`);
if (problemas.length) {
  console.error(`\n✗ ${problemas.length} problema(s):`);
  for (const p of problemas) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log(`✅ Cerebro sano: colecciones con regla, mentes con doctrina, storage con prefijo, niveles sin hardcodear.\n`);
