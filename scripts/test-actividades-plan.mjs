/**
 * F2 — Actividades del plan: una por entrega de fase del plan maestro
 * (src/services/actividadesPlan.js).
 *
 * Ejecutar:  node scripts/test-actividades-plan.mjs
 *
 * Datos: plan maestro real de Inglés 2do (ABP, 4 semanas × 4 días, como
 * test-plan-maestro.mjs) y capa curricular construida con construirCapaCurricular.
 * Lo que NO cubre: la escritura en Firestore (actividadesService) ni la
 * pantalla de Modo Aula; se comprueban en el navegador.
 */

import { readFileSync } from "node:fs";
import { construirPlanMaestro } from "../src/services/planMaestroService.js";
import { _extraerContenidosMallaCorpus, planMaestroParaGuardar } from "../src/services/unidadAprendizajeService.js";
import { INDICADORES_INGLES_2DO_ESTRUCTURADOS } from "../src/data/indicadoresIngles2doEstructurados.js";
import { NIVELES_RUBRICA_GUIA } from "../src/data/descriptoresRubricaGuia2025.js";
import { construirCapaCurricular } from "../src/services/hiloPedagogico.js";
import {
  construirActividadesDesdePlan, fusionarActividad, clasesDeEntrega, fechaDeActividad, crearActividadId,
} from "../src/services/actividadesPlan.js";

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
  return { tema, vocabulario: c.vocabulario, gramatica: c.gramatica, expresiones: c.expresiones, funcionales: c.funcionales };
};
const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves"];
const planMaestro = construirPlanMaestro({
  estrategia: "proyectos",
  horario: { semanas: 4, diasClase: DIAS, horasPorDia: 1 },
  producto: "una guía de la escuela para estudiantes nuevos",
  indicadoresEstructurados: INDICADORES_INGLES_2DO_ESTRUCTURADOS,
  competenciasElegidas: ["ING-2-C01", "ING-2-C03"],
  contenidosPorTema: [contenidosDe("Escuela y educación")],
  secciones: ["Welcome", "Important Places", "School Rules"],
});

// Unidad como la guarda generarFasesPlanMaestro: diaCalendario = nombre del día.
let global = 0;
const fasesSemanales = planMaestro.fases.map((f, i) => ({
  numero: i + 1,
  nombre: f.nombre,
  dias: Array.from({ length: f.sesiones }, (_, d) => {
    const slot = global++;
    return {
      n: d + 1,
      numeroGlobal: slot + 1,
      semana: Math.floor(slot / DIAS.length) + 1,
      diaCalendario: DIAS[slot % DIAS.length],
      nombre: DIAS[slot % DIAS.length],
      titulo: `Clase ${slot + 1}`,
      momentos: [],
      entregaFase: d === f.sesiones - 1 ? `Entrega: ${f.entrega.texto}` : "",
    };
  }),
}));
const indicadoresPlan = planMaestro.fases.flatMap((f) => f.indicadores.map((ind) => ind.id));
const textoDe = (id) => INDICADORES_INGLES_2DO_ESTRUCTURADOS.find((ind) => ind.id === id)?.texto || `Indicador ${id}`;
const rubricaPlan = indicadoresPlan.map((id) => ({
  indicadorCodigo: id,
  indicador: textoDe(id),
  criterioReferencia: "",
  niveles: NIVELES_RUBRICA_GUIA.map((nivel) => ({ ...nivel, descriptor: `${nivel.nombre} en ${id}` })),
}));
const unidad = {
  metadatos: {
    tipoPlanificacion: "Unidad de Aprendizaje", grado: "2do Secundaria", seccion: "A",
    area: "Lenguas Extranjeras", asignatura: "Inglés", titulo: "Escuela y educación",
    tema: "Escuela y educación", fechaInicio: "2026-11-02", periodo: "Periodo 1",
    indicadoresOficiales: indicadoresPlan.map(textoDe),
  },
  planMaestro,
  fasesSemanales,
  anexos: { rubricaPlan },
};
const capaReal = construirCapaCurricular(unidad, { cursoId: "curso-2doA" });
// Los IDs oficiales de la malla (los que trae curricularContent en prod).
const capa = {
  ...capaReal,
  indicadoresSeleccionados: indicadoresPlan.map((id) => ({ id, descripcion: textoDe(id) })),
};
const estudiantes = [{ id: "est-ana", nombre: "Ana García" }, { id: "est-ricardo", nombre: "Ricardo Flores" }];
const armar = (extra = {}) => construirActividadesDesdePlan({
  planificacionId: "plan2doA", cursoId: "curso-2doA", capa, unidad, estudiantes, ahora: "2026-10-30T12:00:00.000Z", ...extra,
});

console.log("F2 — actividades desde el plan maestro");

check("una actividad por entrega de fase, con ID fijo", () => {
  const { actividades } = armar();
  igual(actividades.length, planMaestro.fases.length, "número de actividades");
  igual(actividades.map((a) => a.id), planMaestro.fases.map((_, i) => crearActividadId("plan2doA", i + 1)), "IDs");
  actividades.forEach((a, i) => {
    igual(a.entrega, planMaestro.fases[i].entrega, `entrega de la fase ${i + 1}`);
    assert(a.entregaRedactada.includes(planMaestro.fases[i].entrega.texto), `fase ${i + 1}: falta el texto redactado de la entrega`);
  });
});

check("la clase de entrega es la última de su fase y trae fecha ISO", () => {
  const { actividades } = armar();
  actividades.forEach((a, i) => {
    igual(a.numeroClase, planMaestro.fases[i].rangoSesiones.hasta, `clase de la fase ${i + 1}`);
    assert(/^\d{4}-\d{2}-\d{2}$/.test(a.fechaPrevista), `fase ${i + 1}: fecha "${a.fechaPrevista}"`);
  });
  // Clase 1 = lunes 2 nov 2026; la última (16) = jueves de la semana 4.
  igual(actividades[actividades.length - 1].fechaPrevista, "2026-11-26", "fecha de la entrega final");
});

check("indicadores de la fase y rúbrica del Anexo A con 100 puntos", () => {
  const { actividades, instrumentos } = armar();
  actividades.forEach((a, i) => igual(a.indicadorIds, planMaestro.fases[i].indicadores.map((ind) => ind.id), `indicadores fase ${i + 1}`));
  const conRubrica = actividades.filter((a) => a.instrumentoId);
  igual(instrumentos.length, conRubrica.length, "un instrumento por actividad con indicadores");
  instrumentos.forEach((ins) => {
    const act = actividades.find((a) => a.instrumentoId === ins.id);
    igual(ins.indicadorIds, act.indicadorIds, "el instrumento evalúa los indicadores de la fase");
    igual(ins.aspectoRegistroIds, act.indicadorIds.map((id) => `plan2doA_${id}`), "alimenta los aspectos por indicador");
    igual(ins.estructura.criterios.reduce((s, c) => s + c.puntajeMaximo, 0), 100, "la rúbrica suma 100");
    igual(ins.estructura.criterios[0].nivel4, `Estratégico en ${act.indicadorIds[0]}`, "descriptor del Anexo A");
    igual(ins.tipoInstrumento, "rubrica", "tipo");
  });
});

check("estudiantes del curso en pendiente", () => {
  const { actividades } = armar();
  actividades.forEach((a) => igual(a.entregas, {
    "est-ana": { estado: "pendiente", nombre: "Ana García" },
    "est-ricardo": { estado: "pendiente", nombre: "Ricardo Flores" },
  }, "entregas"));
});

check("fase sin indicadores (C1): sin instrumento y no cuenta en la nota", () => {
  const sinInd = { ...unidad, planMaestro: { ...planMaestro, fases: planMaestro.fases.map((f, i) => (i === 0 ? { ...f, indicadores: [] } : f)) } };
  const { actividades, instrumentos } = armar({ unidad: sinInd });
  igual(actividades[0].instrumentoId, "", "sin instrumento");
  igual(actividades[0].cuentaEnNota, false, "no cuenta en la nota");
  assert(!instrumentos.some((ins) => ins.actividadId === actividades[0].id), "no se creó rúbrica");
});

check("indicador sin fila en el Anexo A: aviso visible", () => {
  const conInd = planMaestro.fases.findIndex((f) => f.indicadores.length);
  const quitado = planMaestro.fases[conInd].indicadores[0].id;
  const { avisos } = armar({ unidad: { ...unidad, anexos: { rubricaPlan: rubricaPlan.filter((f) => f.indicadorCodigo !== quitado) } } });
  assert(avisos.some((a) => a.includes(quitado) && a.includes("Anexo A")), `sin aviso para ${quitado}: ${avisos.join(" | ")}`);
});

check("re-guardar no pisa fecha ajustada, desactivación ni entregas marcadas", () => {
  const [nueva] = armar({ estudiantes: [...estudiantes, { id: "est-nuevo", nombre: "Luis" }] }).actividades;
  const existente = {
    ...armar().actividades[0],
    fechaAjustada: "2026-11-10",
    activa: false,
    entregas: { "est-ana": { estado: "entrego", nombre: "Ana García" }, "est-ricardo": { estado: "pendiente", nombre: "Ricardo Flores" } },
    creadaEn: "2026-10-01T00:00:00.000Z",
  };
  const final = fusionarActividad(nueva, existente);
  igual(final.fechaAjustada, "2026-11-10", "fecha ajustada");
  igual(final.activa, false, "sigue desactivada");
  igual(final.entregas["est-ana"].estado, "entrego", "estado marcado");
  igual(final.entregas["est-nuevo"].estado, "pendiente", "estudiante nuevo entra pendiente");
  igual(final.creadaEn, "2026-10-01T00:00:00.000Z", "fecha de creación");
  igual(fechaDeActividad(final), "2026-11-10", "la fecha que vale es la del docente");
});

check("clases de entrega (B1): sin instrumento genérico", () => {
  const entregas = clasesDeEntrega(unidad, capa);
  igual(entregas.size, planMaestro.fases.length, "una clase por fase");
  const { actividades } = armar();
  actividades.forEach((a) => assert(entregas.has(a.numeroClase), `clase ${a.numeroClase} no está en las clases de entrega`));
  igual(clasesDeEntrega({ fasesSemanales }, capa).size, 0, "sin plan maestro no se salta ninguna clase");
});

check("fail-closed: sin plan maestro, sin curso o clases que no cuadran", () => {
  lanza(() => armar({ unidad: { ...unidad, planMaestro: null } }), /no tiene plan maestro/, "sin plan maestro");
  lanza(() => armar({ cursoId: "" }), /su curso/, "sin curso");
  lanza(() => armar({ capa: { ...capa, clases: capa.clases.slice(0, 5) } }), /no se encuentra en la clase/, "clases incompletas");
});

check("tamaño: 40 estudiantes caben de sobra en un documento", () => {
  const muchos = Array.from({ length: 40 }, (_, i) => ({ id: `est-${i}`, nombre: `Estudiante con nombre largo ${i}` }));
  const { actividades } = armar({ estudiantes: muchos });
  const mayor = Math.max(...actividades.map((a) => Buffer.byteLength(JSON.stringify(a))));
  assert(mayor < 20 * 1024, `actividad de ${mayor} bytes`);
});

check("la copia guardada del plan maestro no tiene listas anidadas (Firestore)", () => {
  const conAspectos = construirPlanMaestro({
    estrategia: "proyectos",
    horario: { semanas: 4, diasClase: DIAS, horasPorDia: 1 },
    producto: "una guía de la escuela para estudiantes nuevos",
    indicadoresEstructurados: INDICADORES_INGLES_2DO_ESTRUCTURADOS,
    competenciasElegidas: ["ING-2-C01"],
    aspectosElegidos: { "ING-2-I01": INDICADORES_INGLES_2DO_ESTRUCTURADOS[0].listas.map((l) => l.aspectos.slice(0, 1)) },
    contenidosPorTema: [contenidosDe("Escuela y educación")],
  });
  const anidadas = [];
  const ver = (x, ruta, enLista) => {
    if (Array.isArray(x)) { if (enLista) anidadas.push(ruta); else x.forEach((y, i) => ver(y, `${ruta}[${i}]`, true)); }
    else if (x && typeof x === "object") Object.entries(x).forEach(([k, v]) => ver(v, `${ruta}.${k}`, false));
  };
  ver(conAspectos, "plan", false);
  assert(anidadas.length, "el plan en memoria debía traer aspectosElegidos anidados");
  const guardado = planMaestroParaGuardar(conAspectos);
  anidadas.length = 0;
  ver(guardado, "plan", false);
  igual(anidadas, [], "listas anidadas en la copia guardada");
  const i01 = guardado.fases.flatMap((f) => f.indicadores).find((ind) => ind.id === "ING-2-I01");
  igual(i01.aspectosPorLista.map((l) => l.aspectos), conAspectos.fases.flatMap((f) => f.indicadores).find((ind) => ind.id === "ING-2-I01").aspectosElegidos, "aspectos conservados");
  igual(guardado.fases.map((f) => f.entrega), conAspectos.fases.map((f) => f.entrega), "entregas intactas");
  igual(planMaestroParaGuardar(guardado), guardado, "convertir dos veces no cambia nada");
});

console.log(`\n${pasos} pasos ok, ${fallos} fallos`);
if (fallos) process.exit(1);
