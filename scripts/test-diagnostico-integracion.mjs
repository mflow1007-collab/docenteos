/**
 * test-diagnostico-integracion.mjs — Fase 4: puente diagnóstico → planificación.
 * Verifica la lógica pura: de los resultados de un diagnóstico salen los
 * indicadores DÉBILES (los que el grupo domina menos), que el generador marca
 * "(REFORZAR)". Sin navegador.
 */
// Shim mínimo de localStorage: la lectura al generar cae a lo local sin sesión.
const _ls = new Map();
globalThis.localStorage = { getItem: (k) => (_ls.has(k) ? _ls.get(k) : null), setItem: (k, v) => _ls.set(k, String(v)), removeItem: (k) => _ls.delete(k), clear: () => _ls.clear() };

const { indicadoresDebilesDeDiagnostico, mezclarIndicadoresDebiles, seleccionarDiagnostico, resolverDebilesContraMalla, datosDiagnosticoParaGenerar } = await import("../src/services/diagnosticoIntegrationService.js");
const { guardarDiagnostico } = await import("../src/services/diagnosticoService.js");
const { nivelDeclarado } = await import("../src/services/hiloPedagogico.js");

let pasos = 0, fallos = 0;
const check = (n, fn) => { try { fn(); pasos += 1; console.log(`  ✓ ${n}`); } catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); } };
const assert = (c, m) => { if (!c) throw new Error(m); };

// Diagnóstico de ejemplo: 3 aprendizajes, 4 estudiantes. A1 es fuerte (todos
// logrado), A2 es DÉBIL (mayoría requiere apoyo), A3 tiene brecha persistente.
const diagnostico = {
  estudiantes: [{ id: "e1" }, { id: "e2" }, { id: "e3" }, { id: "e4" }],
  aprendizajes: ["Infiere información del texto", "Resuelve ecuaciones de primer grado", "Comunica su procedimiento"],
  items: [
    { aprendizaje: "Infiere información del texto", indicador: "IL-1 Infiere información explícita e implícita" },
    { aprendizaje: "Resuelve ecuaciones de primer grado", indicador: "IM-3 Resuelve ecuaciones lineales", indicadorId: "IM-3" },
    { aprendizaje: "Comunica su procedimiento", indicador: "IM-5 Comunica y justifica procedimientos" },
  ],
  resultados: {
    e1: ["logrado", "requiere_apoyo", "en_proceso"],
    e2: ["avanzado", "en_proceso", "requiere_apoyo"],
    e3: ["logrado", "requiere_apoyo", "logrado"],
    e4: ["logrado", "requiere_apoyo", "requiere_apoyo"],
  },
  mediaciones: {
    e1: ["autonomo", "apoyo_constante", "con_pista"],
    e2: ["autonomo", "sin_evidencia", "apoyo_constante"],
    e3: ["autonomo", "apoyo_constante", "autonomo"],
    e4: ["autonomo", "sin_evidencia", "apoyo_constante"],
  },
};

console.log("Puente diagnóstico → indicadores débiles:");
check("A2 (ecuaciones, mayoría requiere apoyo) sale como débil", () => {
  const debiles = indicadoresDebilesDeDiagnostico(diagnostico);
  assert(debiles.some((d) => /ecuaciones lineales/.test(d.descripcion)), "no detectó A2 como débil: " + JSON.stringify(debiles));
});
check("A1 (todos logrado) NO sale como débil", () => {
  const debiles = indicadoresDebilesDeDiagnostico(diagnostico);
  assert(!debiles.some((d) => /Infiere información/.test(d.descripcion)), "marcó débil un aprendizaje fuerte");
});
check("R1: devuelve código y descripción por separado", () => {
  const debiles = indicadoresDebilesDeDiagnostico(diagnostico);
  const a2 = debiles.find((d) => d.codigo === "IM-3");
  assert(a2 && a2.descripcion === "IM-3 Resuelve ecuaciones lineales", "no separó código y descripción: " + JSON.stringify(debiles));
});
check("R1: un ítem sin indicadorId no inventa código", () => {
  const debiles = indicadoresDebilesDeDiagnostico(diagnostico);
  const a3 = debiles.find((d) => /Comunica y justifica/.test(d.descripcion));
  assert(a3 && a3.codigo === "", "el código debía quedar vacío: " + JSON.stringify(a3));
});
check("diagnóstico vacío → [] (fail-closed)", () => {
  assert(indicadoresDebilesDeDiagnostico({}).length === 0, "no devolvió vacío");
  assert(indicadoresDebilesDeDiagnostico({ aprendizajes: ["x"], estudiantes: [] }).length === 0, "sin estudiantes debería ser vacío");
});
check("umbral configurable: con umbral alto, menos débiles", () => {
  const laxo = indicadoresDebilesDeDiagnostico(diagnostico, { umbralApoyo: 25 });
  const estricto = indicadoresDebilesDeDiagnostico(diagnostico, { umbralApoyo: 90 });
  assert(laxo.length >= estricto.length, "el umbral no filtra");
});

console.log("Mezcla de fuentes:");
check("mezcla diagnóstico + evaluaciones sin duplicar, diagnóstico primero", () => {
  const r = mezclarIndicadoresDebiles(["IM-3 ecuaciones", "IL-1 inferir"], ["IM-3 ecuaciones", "IC-2 otra"]);
  assert(r.length === 3, "no deduplicó: " + r.join(" | "));
  assert(r[0] === "IM-3 ecuaciones", "no priorizó el diagnóstico");
});
check("mezcla tolera vacíos", () => {
  assert(mezclarIndicadoresDebiles([], []).length === 0, "vacío+vacío no es vacío");
  assert(mezclarIndicadoresDebiles(["a"], []).length === 1, "pierde el único");
});

console.log("Búsqueda por nivel + grado + asignatura:");
const conResultados = { resultados: { e1: ["logrado"] } };
const diag = (extra) => ({ ...conResultados, asignatura: "Inglés", ...extra });
check("nivelDeclarado no deduce el nivel del grado", () => {
  assert(nivelDeclarado({ grado: "1ro" }) === "", "dedujo el nivel de «1ro»");
  assert(nivelDeclarado({ grado: "2do Secundaria A" }) === "Secundaria", "no leyó el nivel escrito");
  assert(nivelDeclarado({ nivel: "Primaria", grado: "1ro Secundaria" }) === "Primaria", "el campo nivel manda");
});
check("R3: «1ro» de Primaria no casa con «1ro» de Secundaria", () => {
  const lista = [diag({ id: "p", grado: "1ro", nivel: "Primaria", actualizadoEn: "2026-11-02" }), diag({ id: "s", grado: "1ro", nivel: "Secundaria", actualizadoEn: "2026-11-01" })];
  assert(seleccionarDiagnostico(lista, { nivel: "Secundaria", grado: "1ro", asignatura: "Inglés" }).diagnostico?.id === "s", "tomó el de otro nivel");
});
check("R3: el grado y la asignatura se comparan por igualdad", () => {
  const lista = [diag({ id: "x", grado: "2do Secundaria", nivel: "Secundaria" })];
  assert(seleccionarDiagnostico(lista, { nivel: "Secundaria", grado: "2do", asignatura: "Inglés" }).diagnostico?.id === "x", "«2do Secundaria» es «2do»");
  assert(!seleccionarDiagnostico(lista, { nivel: "Secundaria", grado: "2", asignatura: "Inglés" }).diagnostico, "«2» no debe casar con «2do»");
  assert(!seleccionarDiagnostico(lista, { nivel: "Secundaria", grado: "2do", asignatura: "Inglés Técnico" }).diagnostico, "asignatura por inclusión");
});
check("diagnóstico viejo: el nivel se lee de su curso; sin nivel, no se usa y se cuenta", () => {
  const viejo = diag({ id: "v", cursoId: "c1", grado: "2do" });
  const con = seleccionarDiagnostico([viejo], { nivel: "Secundaria", grado: "2do", asignatura: "Inglés" }, [{ id: "c1", nivel: "Secundaria" }]);
  assert(con.diagnostico?.id === "v", "no leyó el nivel del curso");
  const sin = seleccionarDiagnostico([viejo], { nivel: "Secundaria", grado: "2do", asignatura: "Inglés" }, []);
  assert(!sin.diagnostico && sin.sinNivel === 1, "debía quedar sin dato: " + JSON.stringify(sin));
});
check("curso sin campo grado: el grado se lee de su nombre", () => {
  const sinGrado = diag({ id: "n", cursoId: "c9", grado: "" });
  const r = seleccionarDiagnostico([sinGrado], { nivel: "Secundaria", grado: "2do Secundaria", asignatura: "Inglés" }, [{ id: "c9", nombre: "2do Secundaria A", nivel: "Secundaria" }]);
  assert(r.diagnostico?.id === "n", JSON.stringify(r));
});
check("sin nivel en la generación → sin dato; borrador sin resultados no cuenta", () => {
  assert(!seleccionarDiagnostico([diag({ grado: "2do", nivel: "Secundaria" })], { grado: "2do", asignatura: "Inglés" }).diagnostico, "buscó sin nivel");
  assert(!seleccionarDiagnostico([{ asignatura: "Inglés", grado: "2do", nivel: "Secundaria", resultados: {} }], { nivel: "Secundaria", grado: "2do", asignatura: "Inglés" }).diagnostico, "usó un borrador");
});
check("varias secciones: usa la más reciente y nombra las otras", () => {
  const lista = [
    diag({ id: "a", cursoId: "a", cursoNombre: "2do A", grado: "2do", nivel: "Secundaria", actualizadoEn: "2026-11-01" }),
    diag({ id: "b", cursoId: "b", cursoNombre: "2do B", grado: "2do", nivel: "Secundaria", actualizadoEn: "2026-11-03" }),
  ];
  const r = seleccionarDiagnostico(lista, { nivel: "Secundaria", grado: "2do", asignatura: "Inglés" });
  assert(r.diagnostico?.id === "b" && r.otrasSecciones.join() === "2do A", JSON.stringify(r));
});

console.log("Códigos contra la malla:");
const malla = [{ id: "ING-2-I01", descripcion: "Responde a preguntas." }, { codigo: "ING-2-I02", descripcion: "Produce textos breves" }];
check("código de la malla pasa; ref-oficial se resuelve por descripción; lo demás solo se muestra", () => {
  const r = resolverDebilesContraMalla([
    { codigo: "ING-2-I01", descripcion: "Responde a preguntas." },
    { codigo: "ref-oficial-2", descripcion: "produce textos breves." },
    { codigo: "ref-local-9", descripcion: "Otra cosa" },
    { codigo: "", descripcion: "Aprendizaje libre" },
  ], malla);
  assert(r.codigos.join() === "ING-2-I01,ING-2-I02", "códigos: " + r.codigos.join());
  assert(r.descripciones.length === 4 && r.descripciones.includes("Otra cosa"), "descripciones: " + r.descripciones.join(" | "));
});

console.log("Lectura al generar (sin sesión → local):");
const generar = { nivel: "Secundaria", grado: "2do", asignatura: "Inglés" };
localStorage.clear();
const sinDato = await datosDiagnosticoParaGenerar(generar);
check("sin diagnóstico: «sin dato» visible para el admin, sin lanzar", () => {
  assert(sinDato.debiles.length === 0 && sinDato.avisos.some((a) => /sin dato/.test(a)), JSON.stringify(sinDato));
});
guardarDiagnostico({ ...diagnostico, id: "d1", grado: "2do", nivel: "Secundaria", asignatura: "Inglés", cursoId: "c1", cursoNombre: "2do A" });
const conDato = await datosDiagnosticoParaGenerar(generar);
check("con diagnóstico: devuelve los débiles con código y sin aviso", () => {
  assert(conDato.debiles.some((d) => d.codigo === "IM-3") && conDato.avisos.length === 0, JSON.stringify(conDato));
});
const otroNivel = await datosDiagnosticoParaGenerar({ ...generar, nivel: "Primaria" });
check("el mismo grado en otro nivel: sin dato", () => {
  assert(otroNivel.debiles.length === 0 && otroNivel.avisos.some((a) => /sin dato/.test(a)), JSON.stringify(otroNivel));
});

console.log(`\n${pasos} ✓ · ${fallos} ✗`);
if (fallos > 0) process.exit(1);
