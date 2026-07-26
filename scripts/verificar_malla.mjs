#!/usr/bin/env node
/**
 * Verificación de una malla curricular ANTES de importarla.
 *
 * Uso:
 *   node scripts/verificar_malla.mjs <ruta-al-json>
 *
 * Comprueba lo mismo que se revisó para las mallas de Secundaria:
 *   - Ubicación de los criterios (aportes[i] vs competencias[i] vs raíz)
 *   - Total canónico (debe ser el número real, NO el doble)
 *   - Que el importador los cuente (conteos + requisito ok)
 *   - Campos raíz obligatorios (schemaVersion, level, grade, area, subject, contentType)
 *   - level / cycle presentes
 *   - avisosExtraccion (clave en Primaria: estructura no verificada contra el PDF)
 *   - conceptuales / procedimentales (si faltan, el guardado se bloquea)
 */
import { readFileSync } from 'node:fs';
import { extraerCriteriosEvaluacionCanonicos } from '../src/services/curriculumBrainService.js';
import { analizarJsonCurricular } from '../src/services/bancoConocimientoService.js';

const ruta = process.argv[2];
if (!ruta) {
  console.error('Uso: node scripts/verificar_malla.mjs <ruta-al-json>');
  process.exit(1);
}

const raw = JSON.parse(readFileSync(ruta, 'utf8'));
const payload = raw.payload || raw;

const ok = (b) => (b ? '✅' : '❌');
const num = (n) => (Array.isArray(n) ? n.length : n ? 1 : 0);

console.log(`\n══════════ ${ruta} ══════════\n`);

// --- Campos raíz obligatorios ---
const REQUERIDOS = ['schemaVersion', 'level', 'grade', 'area', 'subject', 'contentType'];
console.log('— Campos raíz obligatorios —');
REQUERIDOS.forEach((k) => console.log(`  ${ok(!!payload[k])} ${k}: ${payload[k] ?? '(vacío)'}`));
console.log(`  ${ok(!!payload.cycle)} cycle: ${payload.cycle ?? '(vacío)'}`);
console.log(`  · modalidad: ${payload.modalidad ?? '(n/a)'}`);

// --- Ubicación de los criterios ---
const topCE = num(payload.criteriosEvaluacion);
const compCE = (payload.competencias || []).reduce((s, c) => s + num(c.criteriosEvaluacion || c.criterios), 0);
const aporCE = (payload.aportesCompetenciasFundamentales || []).reduce(
  (s, a) => s + num(a.criteriosEvaluacion || a.criterios), 0);
console.log('\n— Ubicación de criterios —');
console.log(`  raíz (criteriosEvaluacion):            ${topCE}  ${topCE ? '⚠️ debería ir vacío' : '✅ vacío'}`);
console.log(`  aportes[i].criteriosEvaluacion:        ${aporCE}  ${aporCE ? '✅ (fuente correcta)' : '❌ vacío'}`);
console.log(`  competencias[i].criteriosEvaluacion:   ${compCE}  ${compCE ? 'ℹ️ (no cuenta en importador)' : ''}`);

// --- Total canónico ---
const canon = extraerCriteriosEvaluacionCanonicos(payload, {
  nivel: payload.level, grado: payload.grade, area: payload.area || payload.subject,
});
console.log('\n— Total canónico (generador) —');
console.log(`  extraerCriteriosEvaluacionCanonicos → ${canon.length}`);
console.log(`  (esperado: nº real de criterios, NO el doble — típico 21)`);

// --- Importador ---
const a = analizarJsonCurricular(payload);
const reqCE = (a.requisitos || []).find((r) => r.id === 'criteriosEvaluacion');
console.log('\n— Importador (analizarJsonCurricular) —');
console.log(`  conteos.criteriosEvaluacion:  ${a.conteos?.criteriosEvaluacion}`);
console.log(`  requisito criterios ok:       ${ok(!!reqCE?.ok)} (count ${reqCE?.count})`);
console.log(`  conceptuales:  ${a.conteos?.conceptuales}   procedimentales: ${a.conteos?.procedimentales}`);
console.log(`  faltantes (BLOQUEAN guardado): ${a.faltantes?.length ? '❌ ' + JSON.stringify(a.faltantes) : '✅ ninguno'}`);
console.log(`  listoParaGenerador: ${ok(!!a.listoParaGenerador)}`);
if (a.advertencias?.length) console.log(`  advertencias: ${JSON.stringify(a.advertencias)}`);

// --- avisosExtraccion (clave en Primaria) ---
const avisos = payload.avisosExtraccion || raw.avisosExtraccion;
console.log('\n— avisosExtraccion —');
if (!avisos || (Array.isArray(avisos) && !avisos.length)) {
  console.log('  ✅ vacío');
} else {
  console.log('  ⚠️ HAY AVISOS — revísalos uno por uno antes de importar:');
  (Array.isArray(avisos) ? avisos : [avisos]).forEach((x, i) =>
    console.log(`    [${i}] ${typeof x === 'string' ? x : JSON.stringify(x)}`));
}

// --- Veredicto ---
// Dos patrones válidos:
//   NUEVO (prompt corregido): criterios solo en aportes[i]; canónico = nº real (sin duplicar).
//   VIEJO (mallas ya en repo): raíz + competencias[i]; el importador cuenta bien pero
//     el canónico sale duplicado (42) — funciona, pero conviene migrar al patrón nuevo.
const fuentesPobladas = [topCE > 0, aporCE > 0, compCE > 0].filter(Boolean).length;
const duplicado = fuentesPobladas > 1; // más de un sitio con criterios → canónico inflado
const importaBien =
  REQUERIDOS.every((k) => payload[k]) && reqCE?.ok && !a.faltantes?.length;

let veredicto;
if (!importaBien) {
  veredicto = '❌ REVISAR — faltan campos raíz o el importador no cuenta los criterios';
} else if (duplicado) {
  veredicto = '⚠️ IMPORTA BIEN pero criterios DUPLICADOS (canónico inflado) — migrar al patrón "solo aportes[i]"';
} else {
  veredicto = '✅ LISTA PARA IMPORTAR (patrón limpio)';
}
console.log(`\n══════════ ${veredicto} ══════════\n`);
