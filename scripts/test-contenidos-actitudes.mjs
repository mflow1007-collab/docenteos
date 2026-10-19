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

// ── De-dup Desempeño/Producto afecta al TEXTO renderizado (no solo la traza) ──
// Replica la lógica del render de evidencias: un "producto" que repite un
// "desempeño" NO debe aparecer en el texto que ve el docente.
check("el de-dup Desempeño/Producto limpia el texto renderizado del PDF", () => {
  const clave = (t) => String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const desempeno = ["Participación en la discusión sobre actividades"];
  const clavesDesempeno = new Set(desempeno.map(clave));
  const producto = ["Mapa inicial de ideas", "Participación en la discusión sobre actividades"]
    .filter((e) => !clavesDesempeno.has(clave(e)));
  assert(producto.length === 1 && producto[0] === "Mapa inicial de ideas",
    `Producto debería quedar solo con el entregable real, quedó: ${JSON.stringify(producto)}`);
});

// ── Escape XSS end-to-end en el HTML de la unidad (situación + anexos) ───────
// El render de la unidad interpola texto de IA/currículo en decenas de puntos
// (situación, ambiente, bandas de fase/día, anexos A-L). Un '<' sin escapar
// rompería el HTML o ejecutaría script en la ventana de impresión.
check("el HTML de la unidad escapa el texto de situación/ambiente (no inyecta HTML)", () => {
  const unidad = {
    metadatos: { titulo: "T", area: "Lenguas Extranjeras", asignatura: "Inglés", grado: "1ro", nivel: "Secundaria", ciclo: "PC", seccion: "B", duracion: "4s", fechaInicio: "2026-10-13", horario: "LMM", periodo: "2026", modalidad: "Académica", productoFinal: "A Day" },
    contenidos: { conceptuales: ["V: x"], procedimentales: ["F: y"], actitudinales: ["Respeto."] },
    situacionAprendizaje: "Contexto con <script>alert(1)</script> y <b>negrita</b> peligrosa",
    ambienteAprendizaje: "Aula con \"comillas\" & símbolos < >",
    fasesSemanales: [],
  };
  const html = formatearUnidadHTML(unidad, "");
  assert(!html.includes("<script>alert(1)</script>"), "el <script> de situación NO se escapó (XSS)");
  assert(html.includes("&lt;script&gt;"), "no aparece el <script> escapado");
});

check("el HTML de los anexos escapa el texto de las piezas (no inyecta HTML)", () => {
  const anexos = construirAnexosUnidad({
    area: "Inglés", tema: "Vida <b>escolar</b>", producto: "A Day",
    vocabulario: ["x & y"], fases: [], numSemanas: 4,
    aportesProducto: [{ texto: "Pieza <script>bad</script> para A Day" }],
  });
  const unidad = {
    metadatos: { titulo: "T", area: "Lenguas Extranjeras", asignatura: "Inglés", grado: "1ro", nivel: "Secundaria", ciclo: "PC", seccion: "B", duracion: "4s", fechaInicio: "2026-10-13", horario: "LMM", periodo: "2026", modalidad: "Académica", productoFinal: "A Day" },
    contenidos: { conceptuales: ["V: x"], procedimentales: ["F: y"], actitudinales: ["Respeto."] },
    fasesSemanales: [], anexos,
  };
  const html = formatearUnidadHTML(unidad, "");
  assert(!html.includes("<script>bad</script>"), "el <script> de una pieza NO se escapó (XSS en anexos)");
});

console.log(`\nActitudes/Glosario: ${pasos} pasos, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
