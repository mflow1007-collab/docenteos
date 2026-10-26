/**
 * test-datos-oficiales.mjs — Etapa 1 (docs/DISENO_CORAZON_DOCENTEOS.md, sección 6).
 *
 * Compara carácter a carácter:
 * 1. Cada estrategia y cada fase de estrategiasFasesGuia2025.js con la
 *    transcripción de la tabla de la Guía 2025, p. 22 (abajo). La Guía es un PDF
 *    escaneado sin capa de texto: esta transcripción se revisa a ojo contra la
 *    página impresa; la prueba evita que los datos se aparten de ella.
 * 2. Cada indicador de Inglés 2do recompuesto (tronco + todos los aspectos con
 *    sus enlaces + cierre) con el texto de la Adecuación Curricular 2023
 *    (curriculo-lenguas-extranjeras-secundaria-2023.json) y con la malla
 *    importable de 2do.
 *
 * Ejecutar: node scripts/test-datos-oficiales.mjs
 */
import { readFileSync } from "node:fs";
import { ESTRATEGIAS_FASES_GUIA_2025 } from "../src/data/estrategiasFasesGuia2025.js";
import { INDICADORES_INGLES_2DO_ESTRUCTURADOS, recomponerIndicador } from "../src/data/indicadoresIngles2doEstructurados.js";

let pasos = 0, fallos = 0;
const check = (n, fn) => { try { fn(); pasos += 1; console.log(`  ✓ ${n}`); } catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); } };
const assert = (c, m) => { if (!c) throw new Error(m); };
const igual = (a, b, m) => assert(a === b, `${m}\n      esperado: ${JSON.stringify(b)}\n      obtenido: ${JSON.stringify(a)}`);

// Guía 2025, p. 22 — una columna por bloque: nombre de la estrategia y sus
// fases, una por línea, en el orden impreso (los cortes de línea de la
// maquetación unidos con un espacio).
const GUIA_P22 = `
Indagación dialógica
Recogida de conocimientos previos
Validación de las fuentes
Análisis y organización de la información
Diseño y construcción
Presentación de resultados
Evaluación

Inserción de los docentes y estudiantes en el entorno
Recolección de información previa
Elaboración de instrumentos de recolección
Visita-recolección de los datos
Descripción y reflexión
Análisis de los datos e información
Socialización del conocimiento
Elaboración de propuestas
Aplicación de los conocimientos
Evaluación y reconocimiento del proceso

Aprendizaje Basado en Proyecto
Visión compartida
Análisis de saberes previos.
Gestión del conocimiento
Metodología y ejemplificación
Aplicación
Evaluación
Socialización y cierre

Aprendizaje Basado en Problemas (ABP)
Selección y análisis del problema
Definición del problema
Formulación de objetivos
Análisis e investigación
Reestructuración del problema
Aprendizaje individual
Puesta en común

Estudio de caso
Conocimiento o saberes previos del caso
Indagación o estudio del caso
Socialización del caso
Elaboración de conclusiones
Evaluación

Exploración de conocimientos previos
Presentación de la situación de aprendizaje
Recogida de saberes recuperados
Socialización reflexiva y crítica
Introducción del nuevo conocimiento
Evaluación

Expositiva de conocimientos elaborados
Recogida de conocimientos previos.
Búsqueda y análisis.
Producción de la exposición
Exposición de producciones
Reflexión metacognitiva
Sistematización
Evaluación
`.trim().split("\n\n").map((bloque) => {
  const [nombre, ...fases] = bloque.split("\n");
  return { nombre, fases };
});

console.log("Estrategias y fases (Guía 2025, p. 22):");

check("7 estrategias, en el orden impreso", () => {
  igual(ESTRATEGIAS_FASES_GUIA_2025.length, 7, "número de estrategias");
  GUIA_P22.forEach((g, i) => igual(ESTRATEGIAS_FASES_GUIA_2025[i].nombre, g.nombre, `estrategia ${i + 1}`));
});

check("claves únicas", () => {
  const claves = ESTRATEGIAS_FASES_GUIA_2025.map((e) => e.clave);
  igual(new Set(claves).size, claves.length, "claves repetidas");
});

GUIA_P22.forEach((g, i) => {
  check(`${g.nombre}: ${g.fases.length} fases literales`, () => {
    const datos = ESTRATEGIAS_FASES_GUIA_2025[i];
    igual(datos.fases.length, g.fases.length, "número de fases");
    g.fases.forEach((f, j) => igual(datos.fases[j], f, `fase ${j + 1}`));
  });
});

console.log("Indicadores de Inglés 2do (Adecuación Curricular 2023):");

const curriculo = JSON.parse(readFileSync(new URL("../src/data/curriculo/curriculo-lenguas-extranjeras-secundaria-2023.json", import.meta.url), "utf8"));
const oficiales = curriculo.idiomas.ingles.ciclos
  .flatMap((c) => c.mallas_curriculares)
  .find((m) => m.grado.startsWith("2"))
  .indicadores_de_logro;
const malla = JSON.parse(readFileSync(new URL("../src/data/curriculo/mallas/malla_ingles_2do_secundaria_2023.json", import.meta.url), "utf8"));

// Única diferencia admitida: el número de página " 144" pegado al final de
// ING-2-I21 en la fuente. Si se corrige en la fuente, también pasa.
const sinErrata = (id, texto) => (id === "ING-2-I21" ? texto.replace(/ 144$/, "") : texto);

check("21 indicadores, 3 por competencia, con la acción de su posición en la tríada", () => {
  igual(INDICADORES_INGLES_2DO_ESTRUCTURADOS.length, 21, "número de indicadores");
  igual(oficiales.length, 21, "número de indicadores en la fuente");
  const acciones = ["responde", "produce", "interactua"];
  INDICADORES_INGLES_2DO_ESTRUCTURADOS.forEach((ind, i) => {
    igual(ind.id, `ING-2-I${String(i + 1).padStart(2, "0")}`, "id");
    igual(ind.competenciaId, `ING-2-C${String(Math.floor(i / 3) + 1).padStart(2, "0")}`, `${ind.id} competencia`);
    igual(ind.accion, acciones[i % 3], `${ind.id} acción`);
  });
});

check("estructura coherente: enlaces = aspectos − 1, un 'entre' por cada lista menos la última", () => {
  for (const ind of INDICADORES_INGLES_2DO_ESTRUCTURADOS) {
    igual(ind.entre.length, Math.max(ind.listas.length - 1, 0), `${ind.id} entre`);
    for (const l of ind.listas) {
      assert(l.aspectos.length >= 2, `${ind.id}: una lista necesita al menos 2 aspectos`);
      igual(l.enlaces.length, l.aspectos.length - 1, `${ind.id} enlaces`);
      assert(l.aspectos.every((a) => a && a.trim() === a), `${ind.id}: aspecto vacío o con espacios sobrantes`);
    }
  }
});

INDICADORES_INGLES_2DO_ESTRUCTURADOS.forEach((ind, i) => {
  const tipo = ind.listas.length ? `${ind.listas.map((l) => l.aspectos.length).join(" + ")} aspectos` : "completo";
  check(`${ind.id} recompuesto = texto oficial (${tipo})`, () => {
    const texto = recomponerIndicador(ind);
    igual(texto, sinErrata(ind.id, oficiales[i]), "Adecuación Curricular");
    const deMalla = malla.indicadoresLogro.find((x) => x.id === ind.id);
    assert(deMalla, `${ind.id} no está en la malla importable`);
    igual(texto, sinErrata(ind.id, deMalla.descripcion), "malla importable");
  });
});

console.log(`\n${pasos} pasos, ${fallos} fallos`);
if (fallos > 0) process.exit(1);
