/**
 * test-contrato-v13.mjs — contrato phaseA v1.3 (bloque final de calidad).
 *
 * Verifica lo que exige el documento modelo del docente:
 *   3A  producto final NOMBRADO + aporteProducto concreto por clase
 *   3B  actividadCLT {nombre, mecanica} nombrada y presente en el Desarrollo
 *   3C  anti-repetición GLOBAL de Desarrollos y técnicas + anti-copia de exemplars
 *   4   evidencias DESAGREGADAS {conocimientos/desempeno/producto} + NEAE por semana
 *
 * Ejecutar: node scripts/test-contrato-v13.mjs
 */

import { validateBatch, EXEMPLARS_ESTILO } from "../src/services/phaseAService.js";

let pasadas = 0, falladas = 0;
const check = (nombre, fn) => {
  try { fn(); console.log(`  ✓ ${nombre}`); pasadas++; }
  catch (e) { console.error(`  ✗ ${nombre}: ${e.message}`); falladas++; }
};
const esperaError = (fn, fragmento) => {
  try { fn(); } catch (e) {
    if (e.message.includes(fragmento)) return;
    throw new Error(`error inesperado: ${e.message}`);
  }
  throw new Error(`se esperaba error con "${fragmento}" y no se lanzó`);
};

const DUR = 45;

// Clase válida base (contrato v1.3). Helpers para mutar y probar rechazos.
const claseValida = (over = {}) => ({
  dia: 1,
  tituloSemana: "Rutinas cotidianas",
  titulo: "Everyday Activities in My Life",
  focoLinguistico: "Presente simple para hablar sobre rutinas diarias (I wake up at 6:00 a.m.)",
  estrategiasDia: "Indagación dialógica • Exploración guiada • Aprendizaje colaborativo",
  intencionPedagogica: "Desde el inicio hasta el final de la clase, los estudiantes describirán sus actividades cotidianas mediante observación e interacción oral, utilizando el presente simple, demostrando dominio del vocabulario.",
  indicadoresTrabajados: ["ING-1-I01"],
  actividadCLT: { nombre: "Listen and Solve", mecanica: "Escuchan a un estudiante describir su día y resuelven qué actividad va en cada momento." },
  aporteProducto: "Cinco oraciones sobre su rutina para el póster",
  saludoInicial: "Good morning! Are you ready to talk about your day?",
  retroalimentacionPrevia: "Retroalimentación del vocabulario trabajado en la clase anterior. (Do you remember the parts of the day?)",
  saberesPrevios: "Recuperación o exploración de saberes previos sobre las actividades diarias.",
  actividadEnganche: "Observan imágenes de un día típico e identifican acciones en inglés.",
  momentos: [
    {
      nombre: "Inicio", tiempo: "10 min",
      evidencias: { conocimientos: ["Nombra acciones de su rutina en inglés."] },
      metacognicion: ["What do I do every morning?", "Which words are new?"],
      recursos: ["Imágenes de rutinas", "Cuaderno"],
    },
    {
      nombre: "Desarrollo", tiempo: "30 min",
      actividades: [
        "Participan en Listen and Solve: escuchan una rutina y deciden a qué momento del día pertenece cada acción.",
        "Practican el presente simple con apoyo del docente formando oraciones sobre su día.",
        "Comparan sus oraciones en parejas y corrigen la conjugación.",
        "Elaboran cinco oraciones sobre su propia rutina diaria.",
        "Socializan sus oraciones y reciben retroalimentación breve.",
      ],
      evidencias: {
        desempeno: ["Construye oraciones en presente simple sobre su rutina.", "Identifica cinco verbos de acción."],
        producto: ["Cinco oraciones escritas sobre su rutina diaria."],
      },
      metacognicion: ["Which activity was easy to describe?", "What verb did I use most?"],
      recursos: ["Flashcards de verbos", "Cuaderno"],
    },
    {
      nombre: "Cierre", tiempo: "5 min",
      actividades: [
        "Socializan una de las oraciones elaboradas durante la clase.",
        "Reflexionan sobre cómo describir su rutina en inglés.",
        "Guardan la producción escrita como Entrada 1 del Portafolio.",
      ],
      evidencias: { desempeno: ["Comparte oralmente una oración de su rutina."] },
      metacognicion: ["What new sentence can I say today?", "How will I use this at home?"],
      recursos: ["Portafolio", "Pizarra"],
    },
  ],
  ...over,
});

const loteValido = (clasesOver = [{}], extra = {}) => ({
  outputSchemaVersion: "1.3",
  semana: 2,
  adaptacionesSemana: {
    acceso: "Banco de verbos visible y frases modelo (I wake up at…).",
    metodologicas: "Repetición oral guiada y trabajo en parejas para la producción escrita.",
    evaluacion: "Valorar la construcción con tiempo adicional y banco de palabras.",
  },
  observacionesSemana: "Registrar quién aún omite el verbo o la hora al describir su rutina.",
  clases: clasesOver.map((o) => claseValida(o)),
  ...extra,
});

const foco = ["Presente simple para hablar sobre rutinas diarias (I wake up at 6:00 a.m.)"];

console.log("Contrato v1.3 — base:");

check("un lote completo y bien formado pasa la validación", () => {
  validateBatch(loteValido(), DUR, 1, foco, { semanaNum: 2 });
});

// ── 3A: producto y aporte ──
console.log("\n3A — producto nombrado y aportes:");

check("primer lote exige productoFinalNombre propio (no genérico)", () => {
  const lote = loteValido();
  esperaError(() => validateBatch(lote, DUR, 1, foco, { semanaNum: 1, exigirNombreProducto: true }), "productoFinalNombre");
  lote.productoFinalNombre = "Presentación/producción final sobre parts of the house";
  esperaError(() => validateBatch(lote, DUR, 1, foco, { semanaNum: 1, exigirNombreProducto: true }), "genérico");
  lote.productoFinalNombre = "My House Map & Tour";
  validateBatch(lote, DUR, 1, foco, { semanaNum: 1, exigirNombreProducto: true });
});

check("aporteProducto genérico se rechaza", () => {
  esperaError(() => validateBatch(loteValido([{ aporteProducto: "Avance del producto" }]), DUR, 1, foco, { semanaNum: 2 }), "genérico");
  esperaError(() => validateBatch(loteValido([{ aporteProducto: "" }]), DUR, 1, foco, { semanaNum: 2 }), "sin aporteProducto");
});

// ── 3B: técnica metodológica ──
console.log("\n3B — actividad metodológica nombrada:");

check("falta actividadCLT → rechazo", () => {
  esperaError(() => validateBatch(loteValido([{ actividadCLT: null }]), DUR, 1, foco, { semanaNum: 2 }), "actividadCLT");
});

check("nombre metodológico genérico ('práctica') → rechazo", () => {
  const clase = claseValida({ actividadCLT: { nombre: "Práctica", mecanica: "hacen ejercicios" } });
  clase.momentos[1].actividades[0] = "Practican el presente simple con apoyo del docente formando oraciones.";
  esperaError(() => validateBatch(loteValido([clase]), DUR, 1, foco, { semanaNum: 2 }), "nombre metodológico");
});

check("la técnica debe nombrarse en ALGUNA actividad del Desarrollo", () => {
  const clase = claseValida();
  // Ninguna actividad menciona "Listen and Solve" → rechazo (tolerante a la
  // posición, pero la técnica debe estar presente en el Desarrollo)
  clase.momentos[1].actividades = [
    "Observan un modelo del docente sobre el presente simple.",
    "Practican formando oraciones con apoyo del docente.",
    "Comparan sus oraciones en parejas.",
    "Elaboran cinco oraciones sobre su rutina.",
  ];
  esperaError(() => validateBatch(loteValido([clase]), DUR, 1, foco, { semanaNum: 2 }), "no nombra su técnica");
});

check("la técnica puede ir en cualquier actividad, no solo la primera", () => {
  const clase = claseValida();
  clase.momentos[1].actividades = [
    "Observan un modelo del docente sobre el presente simple.",
    "Participan en Listen and Solve: escuchan y deciden a qué momento pertenece cada acción.",
    "Comparan sus respuestas en parejas.",
    "Elaboran cinco oraciones sobre su rutina.",
    "Socializan y reciben retroalimentación.",
  ];
  validateBatch(loteValido([clase]), DUR, 1, foco, { semanaNum: 2 }); // no debe lanzar
});

check("dos clases del lote con la misma técnica → rechazo", () => {
  const lote = loteValido([{}, {}]);
  esperaError(() => validateBatch(lote, DUR, 2, foco, { semanaNum: 2 }), "repite la técnica");
});

// ── 3C: anti-repetición global + anti-copia ──
console.log("\n3C — anti-repetición global y anti-copia de exemplars:");

check("Desarrollo idéntico a una clase previa de la unidad → rechazo (memoria global)", () => {
  const memoria = [{
    semana: 2, dia: 1, titulo: "Clase previa",
    desarrolloTexto: claseValida().momentos[1].actividades.join(" "),
    actividadCLT: "Information Gap", mecanicaCLT: "otra",
  }];
  esperaError(() => validateBatch(loteValido([{ dia: 3 }]), DUR, 1, foco, { memoria, semanaNum: 2 }), "repite el Desarrollo");
});

check("técnica repetida en el mismo bloque (semana) → rechazo aunque cambie mecánica", () => {
  const memoria = [{
    semana: 2, dia: 1, titulo: "Clase previa",
    desarrolloTexto: "Practican otra cosa completamente distinta con distintas palabras.",
    actividadCLT: "Listen and Solve", mecanicaCLT: "mecánica totalmente diferente aquí",
  }];
  esperaError(() => validateBatch(loteValido([{ dia: 3 }]), DUR, 1, foco, { memoria, semanaNum: 2 }), "mismo bloque");
});

check("misma técnica en OTRA fase con mecánica distinta → permitida", () => {
  const memoria = [{
    semana: 5, dia: 1, titulo: "Clase previa en otra fase",
    desarrolloTexto: "Actividades por completo diferentes con vocabulario ajeno y estructuras nuevas.",
    actividadCLT: "Listen and Solve",
    mecanicaCLT: "una mecánica por completo diferente sin relación con la actual jamás.",
  }];
  // semana del lote = 2, memoria = semana 5 → distinta fase; mecánica distinta
  const lote = loteValido([{ dia: 9 }]);
  lote.semana = 2;
  validateBatch(lote, DUR, 1, foco, { memoria, semanaNum: 2 });
});

check("actividad copiada de un exemplar del prompt → rechazo (falla F4)", () => {
  const clase = claseValida();
  clase.momentos[1].actividades[3] = EXEMPLARS_ESTILO[2]; // el mapa de ideas
  esperaError(() => validateBatch(loteValido([clase]), DUR, 1, foco, { semanaNum: 2 }), "copiada del ejemplo");
});

// ── 4: evidencias desagregadas + NEAE por semana ──
console.log("\n4 — evidencias desagregadas y NEAE por semana:");

check("evidencias como lista plana (v1.2) → rechazo", () => {
  const clase = claseValida();
  clase.momentos[1].evidencias = ["Construye oraciones", "Identifica verbos"];
  esperaError(() => validateBatch(loteValido([clase]), DUR, 1, foco, { semanaNum: 2 }), "lista plana");
});

check("Desarrollo sin desempeño ni producto → rechazo", () => {
  const clase = claseValida();
  clase.momentos[1].evidencias = { conocimientos: ["Reconoce el vocabulario"] };
  esperaError(() => validateBatch(loteValido([clase]), DUR, 1, foco, { semanaNum: 2 }), "desempeño o de producto");
});

check("evidencia no evaluable ('participación activa en el saludo') → rechazo", () => {
  const clase = claseValida();
  clase.momentos[0].evidencias = { desempeno: ["Participación activa en el saludo inicial."] };
  esperaError(() => validateBatch(loteValido([clase]), DUR, 1, foco, { semanaNum: 2 }), "no evaluable");
});

check("faltan adaptacionesSemana → rechazo (sin fallback genérico)", () => {
  const lote = loteValido();
  delete lote.adaptacionesSemana;
  esperaError(() => validateBatch(lote, DUR, 1, foco, { semanaNum: 2 }), "adaptacionesSemana");
});

check("falta observacionesSemana → rechazo", () => {
  const lote = loteValido();
  lote.observacionesSemana = "";
  esperaError(() => validateBatch(lote, DUR, 1, foco, { semanaNum: 2 }), "observacionesSemana");
});

console.log(`\n${pasadas} ✓ · ${falladas} ✗`);
if (falladas > 0) process.exit(1);
