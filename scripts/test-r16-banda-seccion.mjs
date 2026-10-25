/**
 * test-r16-banda-seccion.mjs — R16 (narrativa de banda).
 *
 * La banda que separa cada semana ya NO se lee como un bloque de un tema
 * ("Escuela y educación — SEMANA 3"), sino como el avance hacia una SECCIÓN del
 * producto, con el tema sólo como apoyo cuando es LATERAL respecto al central.
 * Los temas se siguen combinando igual: esto es sólo el texto del separador.
 *
 * Qué se verifica:
 *  1) Con producto + tema lateral → aparece «Sección …» y «tema de apoyo: …».
 *  2) Con tema = central → aparece «Sección …» pero NO «tema de apoyo»
 *     (nombrar el central sería la lectura por-tema que queremos evitar).
 *  3) Sin producto → formato clásico (título de la unidad al frente, sin Sección).
 *  4) Siempre lleva «SEMANA N (X días)» y el rótulo de fase si existe.
 *  5) El escape se respeta: el llamador escapa; la función no re-escapa.
 *
 * Ejecutar: node scripts/test-r16-banda-seccion.mjs
 */
import { componerBandaSemana } from "../src/services/unidadAprendizajeService.js";

let pasos = 0, fallos = 0;
const check = (n, fn) => { try { fn(); pasos += 1; console.log(`  ✓ ${n}`); } catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); } };
const assert = (c, m) => { if (!c) throw new Error(m); };

console.log("R16 · la semana se presenta como SECCIÓN del producto:");

check("producto + tema LATERAL → «Sección …» y «tema de apoyo: …»", () => {
  const b = componerBandaSemana({
    semana: 3,
    nDias: 4,
    tituloSem: "Construcción guiada de los aprendizajes",
    temaApoyo: "Actividades de la vida diaria",
    producto: "Our School Survival Guide — guía para estudiantes nuevos",
    temaCentral: "Escuela y educación",
  });
  assert(/SEMANA 3 \(4 días\)/.test(b), `no respetó la cabecera de semana: ${b}`);
  assert(/Construcción guiada/.test(b), `perdió el rótulo de fase: ${b}`);
  assert(/Sección «Our School Survival Guide»/.test(b), `no nombró la sección del producto: ${b}`);
  assert(/tema de apoyo: Actividades de la vida diaria/.test(b), `no nombró el tema de apoyo lateral: ${b}`);
  // NO debe leerse como "Escuela y educación — SEMANA 3" (la lectura por-tema).
  assert(!/^Escuela y educación —/.test(b), `volvió a la narrativa por-tema: ${b}`);
});

check("tema = CENTRAL → «Sección …» pero SIN «tema de apoyo»", () => {
  const b = componerBandaSemana({
    semana: 1,
    nDias: 4,
    tituloSem: "Visión compartida de la unidad y apropiación del producto",
    temaApoyo: "Escuela y educación", // igual al central → no es apoyo lateral
    producto: "Our School Survival Guide",
    temaCentral: "Escuela y educación",
  });
  assert(/Sección «Our School Survival Guide»/.test(b), `no nombró la sección: ${b}`);
  assert(!/tema de apoyo/.test(b), `nombró el central como apoyo (redundante): ${b}`);
});

check("tema contenido en el central (no lateral) → SIN «tema de apoyo»", () => {
  const b = componerBandaSemana({
    semana: 2, nDias: 4, tituloSem: "Construcción guiada",
    temaApoyo: "educación", // contenido en "Escuela y educación" → esTemaLateral=false
    producto: "Healthy School Menu",
    temaCentral: "Escuela y educación",
  });
  assert(/Sección «Healthy School Menu»/.test(b), `no nombró la sección: ${b}`);
  assert(!/tema de apoyo/.test(b), `trató un sub-tema como apoyo lateral: ${b}`);
});

check("SIN producto → formato clásico (título al frente, sin «Sección»)", () => {
  const b = componerBandaSemana({
    semana: 2, nDias: 4,
    tituloSem: "Construcción guiada de los aprendizajes",
    temaApoyo: "Actividades de la vida diaria",
    producto: "",
    temaCentral: "Escuela y educación",
  });
  assert(/^Escuela y educación — SEMANA 2 \(4 días\)/.test(b), `no cayó al formato clásico: ${b}`);
  assert(!/Sección/.test(b), `inventó una sección sin producto: ${b}`);
  assert(!/tema de apoyo/.test(b), `añadió apoyo en el formato clásico: ${b}`);
});

check("un solo día → «1 día» (singular)", () => {
  const b = componerBandaSemana({ semana: 5, nDias: 1, producto: "Poster final", temaCentral: "Arte" });
  assert(/SEMANA 5 \(1 día\)/.test(b), `no usó el singular: ${b}`);
  assert(!/1 días/.test(b), `pluralizó mal: ${b}`);
});

check("sin rótulo de fase → cabecera sin el « · » colgante", () => {
  const b = componerBandaSemana({ semana: 2, nDias: 4, tituloSem: "", producto: "Menú", temaCentral: "Salud" });
  assert(/SEMANA 2 \(4 días\) — Sección «Menú»/.test(b), `formato inesperado sin fase: ${b}`);
  assert(!/\(4 días\) · —/.test(b), `dejó un separador colgante: ${b}`);
});

console.log("\nR16 · el escape lo hace el llamador (la función no re-escapa):");

check("la función NO re-escapa lo que ya recibe escapado", () => {
  // El render pasa m.* ya escapado por escProfundo. Simulamos esa entrada.
  const b = componerBandaSemana({
    semana: 1, nDias: 4, tituloSem: "Construcción",
    temaApoyo: "", producto: "Ciencia &amp; Tecnología Expo",
    temaCentral: "Ciencia &amp; Tecnología",
  });
  assert(/Sección «Ciencia &amp; Tecnología Expo»/.test(b), `re-escapó un valor ya escapado: ${b}`);
  assert(!/&amp;amp;/.test(b), `doble escape detectado: ${b}`);
});

console.log(`\nR16: ${pasos} pasos, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
