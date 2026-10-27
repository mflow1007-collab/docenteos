/**
 * test-plan-maestro.mjs — Etapa 2 (docs/DISENO_CORAZON_DOCENTEOS.md, sección 6).
 *
 * Plan maestro con la malla REAL de Inglés 2do (contenidos resueltos con
 * _extraerContenidosMallaCorpus, igual que el generador) y los 21 indicadores
 * estructurados de la Etapa 1. Comprueba: total de sesiones = horario, cada
 * indicador en una fase acorde a su acción, temas mezclados, unir/subdividir,
 * sesiones fijadas por el docente y errores visibles (fail-closed).
 *
 * Ejecutar: node scripts/test-plan-maestro.mjs
 */
import { readFileSync } from "node:fs";
import { construirPlanMaestro } from "../src/services/planMaestroService.js";
import { _extraerContenidosMallaCorpus } from "../src/services/unidadAprendizajeService.js";
import { INDICADORES_INGLES_2DO_ESTRUCTURADOS } from "../src/data/indicadoresIngles2doEstructurados.js";
import { ESTRATEGIAS_FASES_GUIA_2025 } from "../src/data/estrategiasFasesGuia2025.js";
import { ROLES_FASES_POR_ESTRATEGIA, ROL_POR_ACCION, ROLES_FASE } from "../src/data/rolesFasesEstrategias.js";

let pasos = 0, fallos = 0;
const check = (n, fn) => { try { fn(); pasos += 1; console.log(`  ✓ ${n}`); } catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); } };
const assert = (c, m) => { if (!c) throw new Error(m); };
const igual = (a, b, m) => assert(JSON.stringify(a) === JSON.stringify(b), `${m}\n      esperado: ${JSON.stringify(b)}\n      obtenido: ${JSON.stringify(a)}`);
const lanza = (fn, patron, m) => {
  try { fn(); } catch (e) { assert(patron.test(e.message), `${m}: mensaje inesperado "${e.message}"`); return; }
  throw new Error(`${m}: no lanzó error`);
};

const malla = JSON.parse(readFileSync(new URL("../src/data/curriculo/mallas/malla_ingles_2do_secundaria_2023.json", import.meta.url), "utf8"));
const contenidosDe = (tema) => {
  const c = _extraerContenidosMallaCorpus(malla, tema);
  assert(c.fuenteContenido === "contenidosPorTema", `la malla no resolvió contenidosPorTema para "${tema}"`);
  return { tema, vocabulario: c.vocabulario, gramatica: c.gramatica, expresiones: c.expresiones, funcionales: c.funcionales };
};
const ESCUELA = "Escuela y educación";
const VIVIENDA = "Vivienda, entorno y ciudad";

const base = {
  estrategia: "proyectos",
  horario: { semanas: 4, diasClase: ["Lunes", "Martes", "Miércoles", "Jueves"], horasPorDia: 1 },
  producto: "una guía de la escuela para estudiantes nuevos",
  indicadoresEstructurados: INDICADORES_INGLES_2DO_ESTRUCTURADOS,
  competenciasElegidas: ["ING-2-C01", "ING-2-C03"],
  contenidosPorTema: [contenidosDe(ESCUELA), contenidosDe(VIVIENDA)],
};
const plan = (extra = {}) => construirPlanMaestro({ ...base, ...extra });
const sumaSesiones = (p) => p.fases.reduce((s, f) => s + f.sesiones, 0);

console.log("Datos de papeles de fase:");
check("cada estrategia con papeles tiene uno válido por fase literal", () => {
  for (const [clave, roles] of Object.entries(ROLES_FASES_POR_ESTRATEGIA)) {
    const e = ESTRATEGIAS_FASES_GUIA_2025.find((x) => x.clave === clave);
    assert(e, `${clave} no está en la Guía`);
    igual(roles.length, e.fases.length, `${clave}: papeles vs fases`);
    roles.forEach((r) => assert(ROLES_FASE.includes(r), `${clave}: papel desconocido ${r}`));
    Object.values(ROL_POR_ACCION).forEach((r) => assert(roles.includes(r), `${clave}: sin fase de ${r}`));
  }
});

console.log("Plan maestro — Inglés 2do, ABProyecto, 4 semanas × 4 días × 1 hora:");
const p = plan();
check("las 7 fases literales de la Guía, en orden", () => {
  igual(p.fases.map((f) => f.nombre), ESTRATEGIAS_FASES_GUIA_2025.find((e) => e.clave === "proyectos").fases.map((n) => n.replace(/\.$/, "")), "nombres");
});
check("total de sesiones = 16 y cuadra con el horario", () => {
  igual(p.horario.totalSesiones, 16, "total");
  igual(sumaSesiones(p), 16, "suma por fase");
});
check("reparto por peso: 2·2·3·3·4·1·1", () => igual(p.fases.map((f) => f.sesiones), [2, 2, 3, 3, 4, 1, 1], "sesiones"));
check("rangos de sesiones seguidos de 1 a 16", () => {
  let esperado = 1;
  p.fases.forEach((f) => { igual(f.rangoSesiones.desde, esperado, `fase ${f.numero}`); esperado = f.rangoSesiones.hasta + 1; });
  igual(esperado, 17, "fin");
});
check("cada indicador elegido en una fase acorde a su acción", () => {
  const ubicados = p.fases.flatMap((f) => f.indicadores.map((ind) => ({ ind, f })));
  igual(ubicados.map((u) => u.ind.id).sort(), ["ING-2-I01", "ING-2-I02", "ING-2-I03", "ING-2-I07", "ING-2-I08", "ING-2-I09"], "indicadores");
  ubicados.forEach(({ ind, f }) => assert(f.roles.includes(ROL_POR_ACCION[ind.accion]), `${ind.id} (${ind.accion}) en "${f.nombre}"`));
  const fase = (id) => ubicados.find((u) => u.ind.id === id).f.nombre;
  igual(fase("ING-2-I01"), "Gestión del conocimiento", "responde");
  igual(fase("ING-2-I02"), "Metodología y ejemplificación", "produce");
  igual(fase("ING-2-I03"), "Aplicación", "interactúa");
});
check("competencias: las 7 de la malla, solo C01 y C03 elegidas", () => {
  igual(p.competencias.length, 7, "competencias");
  igual(p.competencias.filter((c) => c.elegida).map((c) => c.id), ["ING-2-C01", "ING-2-C03"], "elegidas");
  igual(p.competencias.find((c) => c.id === "ING-2-C02").indicadores, [], "C02 sin indicadores");
});
check("sin aspectos marcados, quedan vacíos (sin sugerencia)", () => {
  const i09 = p.fases.flatMap((f) => f.indicadores).find((i) => i.id === "ING-2-I09");
  igual(i09.aspectosElegidos, [[], []], "I09 con dos listas");
});
check("una entrega del mismo producto por fase", () => {
  p.fases.forEach((f) => assert(f.entrega.texto.includes(base.producto), `fase ${f.numero}: ${f.entrega.texto}`));
  igual(p.fases.map((f) => f.entrega.estado), ["Acuerdo y plan", "Acuerdo y plan", "Insumos recopilados", "Borrador", "Versión final", "Versión revisada", "Presentación"], "estados");
  igual(p.fases[0].entrega.texto, `Acuerdo y plan de ${base.producto} (avance 1 de 2)`, "avance numerado");
});
check("contenidos solo en conocimiento, modelado y aplicación", () => {
  p.fases.forEach((f) => {
    const n = Object.values(f.contenidos).reduce((s, l) => s + l.length, 0);
    const debe = ["Gestión del conocimiento", "Metodología y ejemplificación", "Aplicación"].includes(f.nombre);
    assert(debe ? n > 0 : n === 0, `"${f.nombre}" tiene ${n} contenidos`);
  });
});
check("temas mezclados: el vocabulario de cada fase con contenido trae los dos temas", () => {
  p.fases.filter((f) => f.contenidos.vocabulario.length).forEach((f) => {
    const temas = new Set(f.contenidos.vocabulario.flatMap((v) => v.temas));
    assert(temas.has(ESCUELA) && temas.has(VIVIENDA), `"${f.nombre}": ${[...temas].join(" · ")}`);
  });
});
check("no se pierde ni se repite contenido de la malla", () => {
  for (const cat of ["vocabulario", "gramatica", "expresiones", "funcionales"]) {
    const esperado = new Set(base.contenidosPorTema.flatMap((c) => c[cat]));
    const repartido = p.fases.flatMap((f) => f.contenidos[cat].map((x) => x.texto));
    igual(repartido.length, new Set(repartido).size, `${cat}: repetidos`);
    igual(repartido.length, esperado.size, `${cat}: total`);
  }
});

console.log("Ajustes del docente:");
check("unir Visión compartida + Análisis de saberes previos", () => {
  const u = plan({ ajustes: { unir: [[1, 2]] } });
  igual(u.fases.length, 6, "fases");
  igual(u.fases[0].nombre, "Visión compartida y análisis de saberes previos", "nombre unido");
  igual(u.fases[0].fasesGuia, ["Visión compartida", "Análisis de saberes previos."], "literales");
  igual(sumaSesiones(u), 16, "total");
});
check("subdividir Aplicación en 2 partes; el indicador va a la primera", () => {
  const s = plan({ ajustes: { subdividir: { 5: 2 } } });
  igual(s.fases.length, 8, "fases");
  igual(s.fases.filter((f) => f.fasesGuia[0] === "Aplicación").map((f) => f.nombre), ["Aplicación (1/2)", "Aplicación (2/2)"], "partes");
  igual(sumaSesiones(s), 16, "total");
  const i03 = s.fases.find((f) => f.indicadores.some((i) => i.id === "ING-2-I03"));
  igual(i03.nombre, "Aplicación (1/2)", "I03");
});
check("sesiones fijadas por el docente que cuadran", () => {
  igual(plan({ ajustes: { sesionesPorFase: [1, 1, 4, 4, 4, 1, 1] } }).fases.map((f) => f.sesiones), [1, 1, 4, 4, 4, 1, 1], "sesiones");
});
check("aspectos marcados (literales) se conservan", () => {
  const a = plan({ aspectosElegidos: { "ING-2-I09": [["información", "ayuda"], ["actividades cotidianas"]] } });
  const i09 = a.fases.flatMap((f) => f.indicadores).find((i) => i.id === "ING-2-I09");
  igual(i09.aspectosElegidos, [["información", "ayuda"], ["actividades cotidianas"]], "I09");
});
check("ABProblemas: 7 fases, total cuadra, acciones en su fase", () => {
  const b = plan({ estrategia: "problemas", horario: { semanas: 3, diasClase: ["Lunes", "Miércoles"], horasPorDia: 2 } });
  igual(b.fases.length, 7, "fases");
  igual(sumaSesiones(b), 12, "total");
  b.fases.forEach((f) => f.indicadores.forEach((i) => assert(f.roles.includes(ROL_POR_ACCION[i.accion]), `${i.id} en "${f.nombre}"`)));
});

console.log("Errores visibles (fail-closed):");
check("estrategia sin papeles aprobados", () => lanza(() => plan({ estrategia: "estudio_caso" }), /papeles de fase aprobados/, "estudio_caso"));
check("estrategia que no está en la Guía", () => lanza(() => plan({ estrategia: "descubrimiento" }), /no está en la Guía/, "descubrimiento"));
check("menos sesiones que fases", () => lanza(() => plan({ horario: { semanas: 1, diasClase: ["Lunes", "Martes"], horasPorDia: 2 } }), /Une fases/, "4 < 7"));
check("sesiones fijadas que no suman el total", () => lanza(() => plan({ ajustes: { sesionesPorFase: [2, 2, 2, 2, 2, 2, 2] } }), /suman 14 y el horario da 16/, "14 ≠ 16"));
check("unión de fases no contiguas", () => lanza(() => plan({ ajustes: { unir: [[1, 3]] } }), /contiguas/, "1+3"));
check("subdividir una fase unida", () => lanza(() => plan({ ajustes: { unir: [[1, 2]], subdividir: { 2: 2 } } }), /unida/, "unida"));
check("aspecto que no es literal de la malla", () => lanza(() => plan({ aspectosElegidos: { "ING-2-I01": [["la escuela"]] } }), /no es un aspecto literal/, "aspecto"));
check("indicador de una competencia no elegida", () => lanza(() => plan({ indicadoresElegidos: ["ING-2-I04"] }), /no está elegida/, "I04"));
check("sin competencias elegidas", () => lanza(() => plan({ competenciasElegidas: [] }), /ninguna competencia/, "vacío"));
check("sin producto", () => lanza(() => plan({ producto: "  " }), /producto/, "producto"));
check("sin contenidos de la malla", () => lanza(() => plan({ contenidosPorTema: [] }), /contenidos de la malla/, "contenidos"));

console.log(`\n${pasos} pasos, ${fallos} fallos`);
if (fallos) process.exit(1);
