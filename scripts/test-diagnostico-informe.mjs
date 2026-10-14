/**
 * test-diagnostico-informe.mjs — Informe diagnóstico: consolidación y secciones.
 * Verifica la lógica pura del informe: (1) conteo "por estudiante" tipo MINERD,
 * (2) análisis en prosa por grado, (3) indicadores de logro con metas.
 * Sin localStorage ni navegador.
 */
import {
  resumirDiagnostico,
  consolidarPorEstudiante,
  redactarAnalisisGrado,
  construirIndicadoresLogro,
  construirCronograma,
  guardarDiagnostico,
  listarDiagnosticos,
  obtenerDiagnosticoCurso,
  sincronizarDiagnosticos,
} from "../src/services/diagnosticoService.js";

// Shim mínimo de localStorage para probar la persistencia local en Node.
// (En Node, Firebase no está disponible → sincronizarDiagnosticos solo fusiona
// lo local, que es justo la lógica con riesgo que queremos verificar.)
globalThis.localStorage = (() => {
  let store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; },
  };
})();

let pasos = 0, fallos = 0;
const check = async (n, fn) => { try { await fn(); pasos += 1; console.log(`  ✓ ${n}`); } catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); } };
const assert = (c, m) => { if (!c) throw new Error(m); };

// 4 estudiantes, 2 aprendizajes. e1 alto, e2 medio, e3 bajo, e4 bajo.
// Niveles: requiere_apoyo=1, en_proceso=2, logrado=3, avanzado=4.
const estudiantes = [{ id: "e1" }, { id: "e2" }, { id: "e3" }, { id: "e4" }];
const aprendizajes = ["A1", "A2"];
const resultados = {
  e1: ["avanzado", "logrado"],        // promedio 3.5 -> satisfactorio
  e2: ["logrado", "en_proceso"],      // promedio 2.5 -> aceptable
  e3: ["requiere_apoyo", "en_proceso"], // promedio 1.5 -> elemental
  e4: ["requiere_apoyo", "requiere_apoyo"], // promedio 1.0 -> elemental
};

await check("consolidarPorEstudiante clasifica cada alumno en un solo nivel", () => {
  const c = consolidarPorEstudiante({ estudiantes, aprendizajes, resultados });
  assert(c.evaluados === 4, `evaluados=${c.evaluados}`);
  assert(c.niveles.satisfactorio === 1, `satisfactorio=${c.niveles.satisfactorio}`);
  assert(c.niveles.aceptable === 1, `aceptable=${c.niveles.aceptable}`);
  assert(c.niveles.elemental === 2, `elemental=${c.niveles.elemental}`);
});

await check("porcentajes por estudiante suman 100 y usan el total de estudiantes", () => {
  const c = consolidarPorEstudiante({ estudiantes, aprendizajes, resultados });
  const suma = c.porcentajes.elemental + c.porcentajes.aceptable + c.porcentajes.satisfactorio;
  assert(suma === 100, `suma=${suma}`);
  assert(c.porcentajes.elemental === 50, `elemental%=${c.porcentajes.elemental}`);
});

await check("estudiantes sin registros no se cuentan como evaluados", () => {
  const c = consolidarPorEstudiante({
    estudiantes: [...estudiantes, { id: "e5" }],
    aprendizajes,
    resultados, // e5 sin datos
  });
  assert(c.evaluados === 4, `evaluados=${c.evaluados}`);
});

await check("resumirDiagnostico expone porEstudiante además de nivelesInforme", () => {
  const r = resumirDiagnostico({ estudiantes, aprendizajes, resultados });
  assert(r.porEstudiante && r.porEstudiante.evaluados === 4, "porEstudiante ausente");
  // El conteo por desempeño (celdas) es distinto al conteo por estudiante.
  assert(r.totalCeldas === 8, `totalCeldas=${r.totalCeldas}`);
});

await check("redactarAnalisisGrado no es genérico: usa grado, área, zona y contexto del maestro", () => {
  const r = resumirDiagnostico({ estudiantes, aprendizajes, resultados });
  const texto = redactarAnalisisGrado({
    grado: "6to A", porEstudiante: r.porEstudiante,
    area: "Matemática", asignatura: "Matemática",
    zonaEscolar: "rural", contextoComunitario: "comunidad agrícola, les gusta el béisbol",
    brechas: r.brechas,
  });
  assert(texto.includes("6to A"), "no menciona el grado");
  assert(texto.includes("Matemática"), "no menciona el área del maestro");
  assert(texto.toLowerCase().includes("rural"), "no refleja la zona escolar");
  assert(texto.includes("béisbol"), "no incorpora el contexto comunitario del docente");
  assert(texto.includes("Elemental"), "no detecta el nivel predominante");
});

await check("redactarAnalisisGrado tolera grupo sin registros", () => {
  const vacio = consolidarPorEstudiante({ estudiantes: [], aprendizajes: [], resultados: {} });
  const texto = redactarAnalisisGrado({ grado: "1ro B", porEstudiante: vacio, area: "Lengua Española" });
  assert(texto.toLowerCase().includes("suficiente"), "no advierte falta de datos");
});

await check("construirIndicadoresLogro deriva metas desde la línea de base", () => {
  const r = resumirDiagnostico({ estudiantes, aprendizajes, resultados });
  const ind = construirIndicadoresLogro({ porEstudiante: r.porEstudiante, area: "Matemática" });
  assert(ind.length === 4, `indicadores=${ind.length}`);
  const satisf = ind[0];
  assert(satisf.lineaBase === `${r.porEstudiante.porcentajes.satisfactorio}%`, "línea base incorrecta");
  assert(satisf.meta.includes("+20"), "meta sin +20");
});

await check("indicadores y cronograma se adaptan al área (idioma vs no idioma)", () => {
  const r = resumirDiagnostico({ estudiantes, aprendizajes, resultados });
  const indMate = construirIndicadoresLogro({ porEstudiante: r.porEstudiante, area: "Matemática" });
  const indIngles = construirIndicadoresLogro({ porEstudiante: r.porEstudiante, area: "Lenguas Extranjeras", asignatura: "Inglés" });
  assert(!indMate[3].indicador.toLowerCase().includes("oral"), "Matemática no debería hablar de producción oral/escrita de frases");
  assert(indIngles[3].indicador.toLowerCase().includes("oral"), "Inglés sí debería mencionar producción oral");
  const cronoMate = construirCronograma({ area: "Matemática", porEstudiante: r.porEstudiante });
  assert(!cronoMate.some((f) => /listening|speaking/i.test(f.acciones)), "Matemática no debe mencionar listening/speaking");
  const cronoIngles = construirCronograma({ area: "Inglés", asignatura: "Inglés", porEstudiante: r.porEstudiante });
  assert(cronoIngles.some((f) => /listening|speaking/i.test(f.acciones)), "Inglés sí usa listening/speaking");
});

await check("construirCronograma devuelve 4 períodos con columnas completas", () => {
  const r = resumirDiagnostico({ estudiantes, aprendizajes, resultados });
  const crono = construirCronograma({ area: "Ciencias Sociales", porEstudiante: r.porEstudiante });
  assert(crono.length === 4, `períodos=${crono.length}`);
  crono.forEach((f) => assert(f.periodo && f.acciones && f.esperado, "fila incompleta"));
});

// ── Persistencia local + sincronización (Firebase no disponible en Node) ──────
await check("guardarDiagnostico asigna id/fechas y se puede recuperar por curso+año", () => {
  localStorage.clear();
  const reg = guardarDiagnostico({ cursoId: "c1", anoEscolar: "2026-2027", resultados: {} });
  assert(reg.id, "no asignó id");
  assert(reg.creadoEn && reg.actualizadoEn, "no asignó fechas");
  const hallado = obtenerDiagnosticoCurso("c1", "2026-2027");
  assert(hallado && hallado.id === reg.id, "no se recupera por curso+año");
});

await check("sincronizarDiagnosticos sin Firebase devuelve lo local (no-op seguro)", async () => {
  localStorage.clear();
  guardarDiagnostico({ id: "d1", cursoId: "c1", anoEscolar: "2026-2027" });
  const fusionados = await sincronizarDiagnosticos();
  assert(Array.isArray(fusionados), "no devuelve arreglo");
  assert(fusionados.some((d) => d.id === "d1"), "perdió el diagnóstico local");
  assert(listarDiagnosticos().length === 1, "el cache local cambió indebidamente");
});

// Se ejecutan los checks async al final para que su salida quede ordenada.
await check("async: sincronización conserva el trabajo local", async () => {
  localStorage.clear();
  guardarDiagnostico({ id: "dx", cursoId: "cx", anoEscolar: "2026-2027", resultados: { e1: ["logrado"] } });
  await sincronizarDiagnosticos();
  const r = obtenerDiagnosticoCurso("cx", "2026-2027");
  assert(r && r.resultados?.e1?.[0] === "logrado", "se perdieron los resultados tras sincronizar");
});

console.log(`\nInforme diagnóstico: ${pasos} pasos, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
