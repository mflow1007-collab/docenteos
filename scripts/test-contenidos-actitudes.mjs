/**
 * test-contenidos-actitudes.mjs — Regresión de la Tabla de Contenidos.
 *
 * Bug detectado en el PDF "Vida y comunidad escolar" (1ro Sec. Inglés): la
 * columna "Actitudes y valores" mostraba viñetas huérfanas y frases partidas
 * porque la malla oficial trae las actitudes mal extraídas del PDF del MINERD:
 * con "• " embebido (→ doble viñeta) y oraciones cortadas en varios ítems
 * ("Cumplimiento de las normas de" + "seguridad.").
 *
 * normalizarActitudes quita la viñeta embebida y reúne las continuaciones,
 * de forma IDEMPOTENTE (una lista ya limpia no cambia).
 *
 * Ejecutar: node scripts/test-contenidos-actitudes.mjs
 */
import { normalizarActitudes, construirAnexosUnidad, formatearUnidadHTML } from "../src/services/unidadAprendizajeService.js";

let pasos = 0, fallos = 0;
const check = (n, fn) => { try { fn(); pasos += 1; console.log(`  ✓ ${n}`); } catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); } };
const assert = (c, m) => { if (!c) throw new Error(m); };

console.log("Tabla de Contenidos — Actitudes (regresión):");

// Datos REALES de la malla de 1ro de Secundaria (el caso del PDF).
const crudo = [
  "• Motivación para aprender inglés.",
  "• Cumplimiento de las normas de",
  "seguridad.",
  "• Respeto por las pertenencias de las",
  "demás personas.",
  "• Conciencia de que el valor de las",
  "personas trasciende las posesiones",
  "materiales.",
];

check("quita la viñeta embebida (no deja doble viñeta al renderizar)", () => {
  const r = normalizarActitudes(crudo);
  assert(r.every((x) => !/^[•\-*]/.test(x)), "quedó una viñeta embebida");
});

check("reúne las frases partidas en una sola actitud completa", () => {
  const r = normalizarActitudes(crudo);
  assert(r.includes("Cumplimiento de las normas de seguridad."), "no reunió 'normas de'+'seguridad'");
  assert(r.includes("Respeto por las pertenencias de las demás personas."), "no reunió 'pertenencias'+'demás personas'");
  assert(r.includes("Conciencia de que el valor de las personas trasciende las posesiones materiales."), "no reunió la actitud de 3 fragmentos");
});

check("reduce 8 fragmentos rotos a 4 actitudes completas", () => {
  const r = normalizarActitudes(crudo);
  assert(r.length === 4, `esperaba 4, obtuvo ${r.length}: ${JSON.stringify(r)}`);
});

check("es idempotente: f(f(x)) === f(x)", () => {
  const una = normalizarActitudes(crudo);
  const dos = normalizarActitudes(una);
  assert(JSON.stringify(una) === JSON.stringify(dos), "no idempotente");
});

check("una lista ya limpia no se modifica", () => {
  const limpio = ["Motivación para aprender inglés.", "Cuidado del medioambiente."];
  const r = normalizarActitudes(limpio);
  assert(JSON.stringify(r) === JSON.stringify(limpio), "modificó una lista ya limpia");
});

check("no rompe actitudes legítimas con puntuación interna", () => {
  // Una actitud que lleva puntos internos pero es una sola entrada con viñeta.
  const r = normalizarActitudes(["• Respeto por el tiempo propio y el de las demás personas."]);
  assert(r.length === 1 && r[0] === "Respeto por el tiempo propio y el de las demás personas.", `rompió: ${JSON.stringify(r)}`);
});

// ── Glosario (Anexo F) sincronizado con TODOS los temas trabajados ───────────
// Bug del PDF: el Anexo F solo traía vocabulario del primer tema ("Actividades
// de la vida diaria"); faltaba el de "Escuela y educación".
check("el glosario (Anexo F) incluye vocabulario de todos los temas, no solo el primero", () => {
  const anexos = construirAnexosUnidad({
    area: "Inglés", tema: "Vida y comunidad escolar", producto: "A Day in My Life",
    vocabulario: ["take a shower", "eat breakfast", "go to bed", "subject", "recess", "homework"],
    fases: [], numSemanas: 4,
  });
  const terminos = (anexos.glosario || []).map((g) => g.termino);
  assert(terminos.includes("take a shower"), "falta vocabulario del tema 1");
  assert(terminos.includes("subject") || terminos.includes("recess"), "falta vocabulario del tema 2 (escuela)");
});

// ── El HTML renderizado NO deja viñetas huérfanas (ambas ramas del render) ───
// Cubre el hueco detectado al revisar: la rama legacy de la tabla (unidad sin
// contenidos.porTema) debe normalizar las actitudes igual que la rama por tema.
check("el HTML real de la tabla de contenidos (rama legacy) no deja fragmentos rotos", () => {
  const unidad = {
    metadatos: { titulo: "Vida y comunidad escolar", area: "Lenguas Extranjeras", asignatura: "Inglés", grado: "1ro", nivel: "Secundaria", ciclo: "Primer Ciclo", seccion: "B", duracion: "4 semanas", fechaInicio: "2026-10-13", horario: "L-M-M", periodo: "2026-2027", modalidad: "Académica", productoFinal: "A Day in My Life" },
    contenidos: {
      conceptuales: ["Vocabulario: take a shower"],
      procedimentales: ["Funcional: Dar información"],
      // Actitudes CRUDAS del PDF (viñeta embebida + frases partidas)
      actitudinales: ["• Cumplimiento de las normas de", "seguridad.", "• Respeto por las pertenencias de las", "demás personas."],
    },
    fasesSemanales: [],
  };
  const html = formatearUnidadHTML(unidad, "");
  const lis = [...html.matchAll(/<li>([^<]*)<\/li>/g)].map((x) => x[1]).filter((x) => /norma|segurid|pertenenc|demás/.test(x));
  assert(lis.length > 0, "no se renderizaron las actitudes");
  const roto = lis.some((x) => /^(seguridad|demás)/.test(x.trim()) || /^[•\-*]/.test(x.trim()));
  assert(!roto, `fragmentos rotos en el HTML: ${JSON.stringify(lis)}`);
});

console.log(`\nActitudes/Glosario: ${pasos} pasos, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
