/**
 * Mini-test del hilo pedagógico (BLOQUE A, Fases 1-4)
 *
 *   planificación → capa curricular → aspectos del registro →
 *   instrumentos → resultados por estudiante → consolidación (reglas 10-12)
 *
 * Ejecutar:  node scripts/test-hilo-pedagogico.mjs
 *
 * Usa el núcleo puro real (src/services/hiloPedagogico.js) y el JSON real del
 * Diseño Curricular (scripts/fixtures/curriculum/secundaria/primer_ciclo/1ro/ingles.json).
 * La persistencia se simula con un FakeFirestore que reproduce el contrato de
 * los servicios (mismas rutas, mismos IDs deterministas, misma idempotencia).
 * Lo que NO cubre: reglas de seguridad ni red (requiere emulador — pendiente).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

import {
  construirCapaCurricular,
  generarAspectosDesdeCapa,
  construirInstrumentoDesdePlan,
  construirResultadoInstrumento,
  validarPonderacion,
  consolidarNotaEstudiante,
  aplicarRecalculoRegistro,
  crearAspectoId,
  // Bloque B
  derivarPuntajesAspectos,
  consolidarNotaAspecto,
  aplicarNotaEnCelda,
  obtenerClaseDeHoy,
  construirEvidenciaDesdeResultado,
  // Bloque A.5
  clasificarEvidencias,
} from "../src/services/hiloPedagogico.js";
import { adaptarCurriculoLocal } from "../src/services/curriculoAdapter.js";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const UID = "docente-test";
const CURSO_ID = "curso-1ro-a-ingles";

// ─── FakeFirestore: mismo contrato de rutas/IDs que los servicios reales ────
const store = new Map();
const setDocFake = (ruta, data, { merge = false } = {}) => {
  store.set(ruta, merge && store.has(ruta) ? { ...store.get(ruta), ...data } : { ...data });
};
const enColeccion = (prefijo) =>
  [...store.entries()].filter(([k]) => k.startsWith(prefijo)).map(([, v]) => v);

const rutaAspecto = (aspectoId) =>
  `usuarios/${UID}/cursos/${CURSO_ID}/registroAspectos/${aspectoId}`;
const rutaInstrumento = (id) => `usuarios/${UID}/instrumentos/${id}`;
const rutaResultado = (id) => `usuarios/${UID}/instrumentoResultados/${id}`;

// Réplica del algoritmo de registroService.generarAspectosRegistroDesdePlanificacion
const generarAspectosFake = (registroPlan) => {
  const planificacionId = registroPlan.id;
  const capa = registroPlan.capaCurricular;
  const candidatos = generarAspectosDesdeCapa(capa, { planificacionId, cursoId: CURSO_ID });
  const creados = [], existentes = [], protegidos = [];
  for (const aspecto of candidatos) {
    const previo = store.get(rutaAspecto(aspecto.aspectoId));
    if (previo) {
      (previo.modificadoManual ? protegidos : existentes).push(aspecto.aspectoId);
      continue;
    }
    setDocFake(rutaAspecto(aspecto.aspectoId), { ...aspecto, id: aspecto.aspectoId, uid: UID }, { merge: true });
    creados.push(aspecto.aspectoId);
  }
  return { creados, existentes, protegidos, aspectos: candidatos };
};

let pasos = 0;
const ok = (nombre) => { pasos += 1; console.log(`  ✓ ${nombre}`); };

// ─── 1. Currículo real + planificación "Parts of the House" ─────────────────
console.log("\n1) FASE 1 — Planificación → capa curricular (currículo MINERD real)");

const curriculo = {
  id: "secundaria__1ro__lenguas_extranjeras",
  ...JSON.parse(readFileSync(join(raiz, "scripts/fixtures/curriculum/secundaria/primer_ciclo/1ro/ingles.json"), "utf8")),
};
const compCOM = curriculo.competencias.find((c) => c.id === "CE-ING-1-COM");
assert.ok(compCOM, "El currículo real debe tener la competencia CE-ING-1-COM");

// Forma REAL de un plan semanal (planificacionService.generarPlanificacion),
// con los indicadores oficiales tal como los pega/selecciona el docente.
const plan = {
  metadatos: {
    tema: "Parts of the House",
    grado: "1ro",
    seccion: "A",
    area: "Inglés",
    asignatura: "Inglés",
    periodo: "Periodo 2",
    nivelEducativo: "Secundaria",
    duracionSemanas: 2,
    fechaInicio: "2026-09-07",
    competenciaSeleccionada: compCOM.descripcion,
    indicadoresOficiales: compCOM.indicadoresLogro.map((i) => i.descripcion),
    diasClase: ["Lunes", "Miércoles"],
    tipoPlanificacion: "Planificación Semanal",
  },
  datosGenerales: {
    tema: "Parts of the House",
    area: "Inglés",
    competencia: compCOM.descripcion,
    indicadoresOficiales: compCOM.indicadoresLogro.map((i) => i.descripcion),
    contenidos: { conceptuales: ["House vocabulary"], procedimentales: ["Describing rooms"], actitudinales: ["Respeto"] },
  },
  desarrolloSemanal: [1, 2].map((n) => ({
    n,
    fase: n === 1 ? "diagnostica" : "final",
    tipoEval: n === 1 ? "diagnostica" : "sumativa",
    titulo: `Semana ${n}`,
    dias: ["Lunes", "Miércoles"].map((nombre, di) => ({
      n: di + 1,
      nombre,
      tituloDia: `Clase ${di + 1} — Parts of the House`,
      intencionPedagogica: "Los estudiantes describen las partes de la casa…",
      momentos: [
        { tipo: "Inicio", tiempo: "10 min", actividades: ["Saludo", "Activación de saberes"], instrumento: "Lista de participación", metacognicion: ["¿Qué sé del tema?"] },
        { tipo: "Desarrollo", tiempo: "30 min", actividades: ["Vocabulario de la casa", "Práctica en parejas"], instrumento: "Rúbrica analítica" },
        { tipo: "Cierre", tiempo: "5 min", actividades: ["Síntesis colectiva"], instrumento: "Registro anecdótico", metacognicion: ["¿Qué aprendí?"] },
      ],
    })),
    evidenciasSemana: { productoElaborar: ["Maqueta o plano rotulado de la casa"] },
    materialesSemana: { impresos: ["Flashcards"], digitales: ["Proyector"], otros: [] },
    evaluacionSemana: { criterios: ["Describe habitaciones con vocabulario del tema"] },
    adecuacionesNEAE: { acceso: ["Instrucciones orales y escritas"], curricular: [], evaluacion: [] },
  })),
  estado: "generada",
};

const capa = construirCapaCurricular(plan, { curriculo, cursoId: CURSO_ID, docenteId: UID });

assert.equal(capa.curriculumSourceId, "secundaria__1ro__lenguas_extranjeras");
assert.equal(capa.cursoId, CURSO_ID);
assert.equal(capa.indicadoresSeleccionados.length, 3);
for (const ind of capa.indicadoresSeleccionados) {
  assert.match(ind.id, /^IL-ING-1-COM-\d$/, `indicador con ID oficial (recibido: ${ind.id})`);
  assert.equal(ind.origenId, "oficial");
  assert.equal(ind.competenciaId, "CE-ING-1-COM");
}
ok("3 indicadores del docente (texto) resueltos a IDs oficiales IL-ING-1-COM-*");

assert.equal(capa.competenciasSeleccionadas[0].id, "CE-ING-1-COM");
ok("competencia seleccionada vinculada a su ID oficial CE-ING-1-COM");

assert.equal(capa.clases.length, 4); // 2 semanas × 2 días
assert.equal(capa.clases[0].claseId, "clase-s1-d1");
assert.equal(capa.clases[3].claseId, "clase-s2-d2");
assert.equal(capa.clases[0].fechaSugerida, "2026-09-07"); // lunes de la semana 1
assert.equal(capa.clases[1].fechaSugerida, "2026-09-09"); // miércoles
assert.ok(capa.clases[0].actividades.inicio.length >= 2);
assert.equal(capa.clases[0].indicadorPrincipalId, "IL-ING-1-COM-1");
assert.equal(capa.clases[1].indicadorPrincipalId, "IL-ING-1-COM-2"); // rotación determinista
assert.deepEqual(capa.clases[0].evidenciasEsperadas, ["Maqueta o plano rotulado de la casa"]);
assert.ok(capa.clases[0].instrumentosPlaneados.includes("Rúbrica analítica"));
ok("4 clases normalizadas: claseId, fechaSugerida, momentos, evidencias, instrumentos, indicador principal");

// Indicador que NO está en el currículo → ID local estable (no se pierde el texto)
const capaLocal = construirCapaCurricular(
  { ...plan, metadatos: { ...plan.metadatos, indicadoresOficiales: ["Indicador inventado por el docente"] } },
  { curriculo, cursoId: CURSO_ID }
);
assert.match(capaLocal.indicadoresSeleccionados[0].id, /^IL-LOCAL-/);
assert.equal(capaLocal.indicadoresSeleccionados[0].origenId, "local");
const capaLocal2 = construirCapaCurricular(
  { ...plan, metadatos: { ...plan.metadatos, indicadoresOficiales: ["Indicador inventado por el docente"] } },
  { curriculo, cursoId: CURSO_ID }
);
assert.equal(capaLocal.indicadoresSeleccionados[0].id, capaLocal2.indicadoresSeleccionados[0].id);
ok("indicador sin match oficial → ID local ESTABLE (mismo texto, mismo ID)");

// Plan tipo Unidad de Aprendizaje (especificacionCurricular ya trae IDs)
const capaUnidad = construirCapaCurricular({
  tipoPlanificacion: "Unidad de Aprendizaje",
  metadatos: { titulo: "My House", grado: "1ro", area: "Inglés", periodo: "Periodo 2" },
  especificacionCurricular: {
    ces: [{ id: "CE-ING-1-COM", descripcion: compCOM.descripcion }],
    indicadores: compCOM.indicadoresLogro.map((i) => ({ id: i.id, descripcion: i.descripcion })),
  },
  fasesSemanales: [{ dias: [{ semana: 1, numeroGlobal: 1, titulo: "Clase 1", momentos: [{ nombre: "Inicio", actividades: ["Warm-up"] }] }] }],
}, { curriculo, cursoId: CURSO_ID });
assert.equal(capaUnidad.indicadoresSeleccionados[0].id, "IL-ING-1-COM-1");
assert.equal(capaUnidad.clases.length, 1);
ok("plan tipo Unidad de Aprendizaje también genera capa (IDs de especificacionCurricular)");

// ─── 2. FASE 2 — Aspectos del registro (idempotentes) ───────────────────────
console.log("\n2) FASE 2 — Indicadores → aspectos de Mi Registro");

const registroPlan = { id: "plan-parts-house-001", capaCurricular: capa };
const gen1 = generarAspectosFake(registroPlan);

assert.equal(gen1.creados.length, 3);
assert.equal(gen1.creados[0], "plan-parts-house-001_IL-ING-1-COM-1");
const aspecto1 = store.get(rutaAspecto(gen1.creados[0]));
assert.equal(aspecto1.textoIndicadorOriginal, compCOM.indicadoresLogro[0].descripcion);
assert.ok(aspecto1.aspectoVisible.length < aspecto1.textoIndicadorOriginal.length);
assert.equal(aspecto1.indicadorId, "IL-ING-1-COM-1");
assert.equal(aspecto1.planificacionId, "plan-parts-house-001");
assert.equal(aspecto1.origen, "planificacion");
ok(`aspecto guarda AMBOS textos — original (${aspecto1.textoIndicadorOriginal.length} chars) y visible: "${aspecto1.aspectoVisible}"`);

const suma = gen1.aspectos.reduce((s, a) => s + a.puntajeMaximo, 0);
assert.equal(suma, 100);
ok(`puntajes repartidos suman 100 (${gen1.aspectos.map((a) => a.puntajeMaximo).join("+")})`);

// Idempotencia: segunda ejecución no duplica
const gen2 = generarAspectosFake(registroPlan);
assert.equal(gen2.creados.length, 0);
assert.equal(gen2.existentes.length, 3);
assert.equal(enColeccion(`usuarios/${UID}/cursos/${CURSO_ID}/registroAspectos/`).length, 3);
ok("ejecutar la generación DOS veces no duplica aspectos (regla Fase 2.5)");

// Ajuste manual del docente protegido (regla 7)
setDocFake(rutaAspecto(gen1.creados[1]), { modificadoManual: true, puntajeMaximo: 40 }, { merge: true });
const gen3 = generarAspectosFake(registroPlan);
assert.equal(gen3.protegidos.length, 1);
assert.equal(store.get(rutaAspecto(gen1.creados[1])).puntajeMaximo, 40);
ok("aspecto con modificadoManual=true NO se sobreescribe al regenerar");

// ─── 3. FASE 3 — Instrumentos ligados a la planificación ────────────────────
console.log("\n3) FASE 3 — Instrumentos vinculados (Rúbrica 50 + Cotejo 25 + Escala 25)");

const definiciones = [
  { tipo: "rubrica", valorMaximo: 50, ponderacion: 50 },
  { tipo: "lista_cotejo", valorMaximo: 25, ponderacion: 25 },
  { tipo: "escala_estimativa", valorMaximo: 25, ponderacion: 25 },
];
const instrumentos = definiciones.map((definicion) =>
  construirInstrumentoDesdePlan({ planificacionId: registroPlan.id, capa, docenteId: UID, ...definicion })
);
instrumentos.forEach((ins) => setDocFake(rutaInstrumento(ins.id), { ...ins, uid: UID }, { merge: true }));

assert.equal(instrumentos[0].id, "ins-plan-parts-house-001-rubrica-global");
assert.deepEqual(instrumentos[0].indicadorIds, ["IL-ING-1-COM-1", "IL-ING-1-COM-2", "IL-ING-1-COM-3"]);
assert.deepEqual(
  instrumentos[0].aspectoRegistroIds,
  capa.indicadoresSeleccionados.map((i) => crearAspectoId(registroPlan.id, i.id))
);
assert.equal(instrumentos[0].tipo, "Rúbrica");            // etiqueta legacy (UI actual)
assert.equal(instrumentos[0].tipoInstrumento, "rubrica"); // tipo del hilo
assert.equal(instrumentos[0].planificacionId, registroPlan.id);
ok("instrumento sabe qué indicadores evalúa y qué aspectos del registro alimenta");

// Re-crear desde el plan → mismo ID (idempotente)
const rubricaBis = construirInstrumentoDesdePlan({ planificacionId: registroPlan.id, capa, tipo: "Rúbrica" });
assert.equal(rubricaBis.id, instrumentos[0].id);
ok("re-crear el instrumento desde el plan reutiliza el mismo ID (no duplica)");

// Instrumento de una clase específica
const insClase = construirInstrumentoDesdePlan({ planificacionId: registroPlan.id, capa, tipo: "registro_anecdotico", claseId: "clase-s1-d1" });
assert.equal(insClase.claseId, "clase-s1-d1");
assert.equal(insClase.id, "ins-plan-parts-house-001-registro_anecdotico-clase-s1-d1");
ok("instrumento puede ligarse a una clase específica o a la secuencia completa");

// Regla 10 — ponderación
const pondOk = validarPonderacion(instrumentos);
assert.equal(pondOk.total, 100);
assert.equal(pondOk.esCompleta, true);
assert.equal(pondOk.advertencia, null);
ok("Rúbrica 50 + Cotejo 25 + Escala 25 = 100 → sin advertencia");

const pondIncompleta = validarPonderacion(instrumentos.slice(0, 2));
assert.equal(pondIncompleta.advertencia, "Tus instrumentos suman 75/100");
assert.equal(pondIncompleta.instrumentosNormalizados[0].ponderacionNormalizada, 66.67);
ok(`ponderación incompleta → advertencia al docente: "${pondIncompleta.advertencia}" + normalización proporcional`);

// ─── 4. FASE 4 — Resultados por estudiante (Juan Pérez) ─────────────────────
console.log("\n4) FASE 4 — Resultados de evaluación por estudiante");

const evaluarJuan = (instrumento, puntaje, estado = "evaluado") => {
  const resultado = construirResultadoInstrumento({
    instrumento, estudianteId: "est-juan-perez-1", estudianteNombre: "Juan Pérez",
    puntajeObtenido: puntaje, estado, docenteId: UID,
  });
  setDocFake(rutaResultado(resultado.resultadoId), { ...resultado, uid: UID }, { merge: true });
  return resultado;
};

const r1 = evaluarJuan(instrumentos[0], 40); // Rúbrica 40/50
const r2 = evaluarJuan(instrumentos[1], 20); // Cotejo 20/25
const r3 = evaluarJuan(instrumentos[2], 22); // Escala 22/25

assert.equal(r1.resultadoId, "ins-plan-parts-house-001-rubrica-global__est-juan-perez-1");
assert.equal(r1.porcentaje, 80);
assert.equal(r1.nivelLogro, "En proceso");
assert.equal(r3.porcentaje, 88);
assert.deepEqual(r1.indicadorIds, instrumentos[0].indicadorIds);
assert.equal(r1.planificacionId, registroPlan.id);
assert.equal(enColeccion(`usuarios/${UID}/instrumentoResultados/`).length, 3);
ok("resultado por estudiante vinculado a curso, plan, instrumento, indicadores y aspectos");

// Re-evaluación sobreescribe (mismo ID), no duplica
evaluarJuan(instrumentos[0], 40);
assert.equal(enColeccion(`usuarios/${UID}/instrumentoResultados/`).length, 3);
ok("re-evaluar al mismo estudiante en el mismo instrumento NO duplica el resultado");

// Consolidación completa: 40 + 20 + 22 = 82
const consolidado = consolidarNotaEstudiante({ instrumentos, resultados: [r1, r2, r3] });
assert.equal(consolidado.valorCalculado, 82);
assert.equal(consolidado.esParcial, false);
assert.equal(consolidado.pendientes.length, 0);
ok("consolidación: Rúbrica 40/50 + Cotejo 20/25 + Escala 22/25 = 82/100 ✅ (caso Fase 14)");

// Regla 11 — evaluado solo en 2 de 3: nota parcial, el pendiente NO cuenta 0
const parcial = consolidarNotaEstudiante({ instrumentos, resultados: [r1, r2] });
assert.equal(parcial.valorCalculado, 80); // 60/75 sobre lo evaluado
assert.equal(parcial.esParcial, true);
assert.deepEqual(parcial.pendientes, [instrumentos[2].id]);
ok("estudiante evaluado en 2 de 3 → nota PARCIAL 80 (pendiente ≠ 0) con instrumento pendiente identificado");

// Regla 11 — "no entregó" marcado explícitamente sí cuenta como 0
const rNoEntrego = construirResultadoInstrumento({
  instrumento: instrumentos[2], estudianteId: "est-juan-perez-1", estado: "no_entrego",
});
assert.equal(rNoEntrego.puntajeObtenido, 0);
const conNoEntrega = consolidarNotaEstudiante({ instrumentos, resultados: [r1, r2, rNoEntrego] });
assert.equal(conNoEntrega.valorCalculado, 60);
assert.equal(conNoEntrega.esParcial, false);
ok("'no entregó' explícito cuenta como 0 → 60/100 (ya no es parcial)");

// Estado pendiente → sin puntaje, sin porcentaje
const rPendiente = construirResultadoInstrumento({
  instrumento: instrumentos[2], estudianteId: "est-maria-2", estado: "pendiente",
});
assert.equal(rPendiente.puntajeObtenido, null);
assert.equal(rPendiente.porcentaje, null);
ok("estado 'pendiente' guarda puntaje null (nunca 0 silencioso)");

// ─── 5. Regla 12 — Ajuste manual + recalculo ────────────────────────────────
console.log("\n5) REGLA 12 — Ajuste manual del docente vs. recálculo automático");

// Primer cálculo sin ajuste: valorFinal sigue al cálculo
let registro = aplicarRecalculoRegistro(null, consolidado);
assert.equal(registro.valorCalculado, 82);
assert.equal(registro.valorFinal, 82);
assert.equal(registro.ajusteManual, false);

// El docente sube a 85 con motivo
registro = {
  ...registro,
  valorFinal: 85,
  ajusteManual: true,
  motivoAjuste: "Se añadió participación oral observada en clase.",
};

// Llega un nuevo resultado → recálculo da 84: respetar 85, marcar desactualizado
const r3b = construirResultadoInstrumento({ instrumento: instrumentos[2], estudianteId: "est-juan-perez-1", puntajeObtenido: 24 });
const consolidado2 = consolidarNotaEstudiante({ instrumentos, resultados: [r1, r2, r3b] });
assert.equal(consolidado2.valorCalculado, 84);
registro = aplicarRecalculoRegistro(registro, consolidado2);
assert.equal(registro.valorFinal, 85);          // el ajuste manual SE RESPETA
assert.equal(registro.valorCalculado, 84);      // solo se actualiza el cálculo
assert.equal(registro.desactualizado, true);    // y se marca para notificar
assert.equal(registro.notificarDocente, true);
assert.equal(registro.motivoAjuste, "Se añadió participación oral observada en clase.");
ok("ajuste manual 85 se respeta; valorCalculado → 84 y registro marcado desactualizado + notificación");

// Si el nuevo cálculo coincide con el ajuste, deja de estar desactualizado
const r1b = construirResultadoInstrumento({ instrumento: instrumentos[0], estudianteId: "est-juan-perez-1", puntajeObtenido: 41 });
const consolidado3 = consolidarNotaEstudiante({ instrumentos, resultados: [r1b, r2, r3b] });
assert.equal(consolidado3.valorCalculado, 85);
registro = aplicarRecalculoRegistro(registro, consolidado3);
assert.equal(registro.desactualizado, false);
ok("si el recálculo alcanza el valor ajustado, se limpia la marca de desactualizado");

// ════════════════════════════ BLOQUE B (Fases 5-8) ═══════════════════════════

// ─── 6. Puntajes de aspectos derivados de la ponderación ─────────────────────
console.log("\n6) FASE 5 — Puntajes de aspectos derivados de la ponderación de instrumentos");

const aspectoIds = capa.indicadoresSeleccionados.map((i) => crearAspectoId(registroPlan.id, i.id));

// Los 3 instrumentos (50/25/25) alimentan los 3 aspectos → reparto uniforme
const puntajesUniformes = derivarPuntajesAspectos(instrumentos, aspectoIds);
assert.equal([...puntajesUniformes.values()].reduce((s, v) => s + v, 0), 100);
assert.deepEqual([...puntajesUniformes.values()].sort((a, b) => b - a), [34, 33, 33]);
ok("instrumentos que alimentan todos los aspectos → 34/33/33 (suma 100)");

// La rúbrica (50) alimenta SOLO el primer aspecto → ese aspecto pesa más
const rubricaFocalizada = { ...instrumentos[0], aspectoRegistroIds: [aspectoIds[0]] };
const puntajesFocalizados = derivarPuntajesAspectos([rubricaFocalizada, instrumentos[1], instrumentos[2]], aspectoIds);
assert.equal([...puntajesFocalizados.values()].reduce((s, v) => s + v, 0), 100);
assert.ok(puntajesFocalizados.get(aspectoIds[0]) > 60, `el aspecto de la rúbrica pesa más (${puntajesFocalizados.get(aspectoIds[0])})`);
ok(`instrumento focalizado en un aspecto desplaza el peso: ${[...puntajesFocalizados.values()].join("/")}`);

// ─── 7. FASE 5 — Mi Registro consolidado con regla 12 ────────────────────────
console.log("\n7) FASE 5 — resultado → nota por aspecto (regla 12 de punta a punta)");

// Réplica del algoritmo de registroService.actualizarRegistroDesdeResultadoInstrumento
const rutaNota = (notaId) => `usuarios/${UID}/cursos/${CURSO_ID}/registroNotas/${notaId}`;
const actualizarRegistroFake = (resultado, { instrumentos: insPlan, resultadosEstudiante }) => {
  const notas = [];
  for (const aspectoId of resultado.aspectoRegistroIds) {
    const aspectoDoc = store.get(rutaAspecto(aspectoId));
    if (!aspectoDoc) continue;
    const consolidadoAspecto = consolidarNotaAspecto({ aspecto: aspectoDoc, instrumentos: insPlan, resultados: resultadosEstudiante });
    if (consolidadoAspecto.valorCalculadoPuntos === null) continue;
    const notaId = `${resultado.estudianteId}_${aspectoId}`;
    const previo = store.get(rutaNota(notaId)) || null;
    const registroPrevio = previo ? {
      valorCalculado: previo.valorCalculado ?? null,
      valorFinal: previo.valorObtenido === "" || previo.valorObtenido === undefined ? null : Number(previo.valorObtenido),
      ajusteManual: Boolean(previo.ajusteManual),
      motivoAjuste: previo.motivoAjuste || "",
    } : null;
    const recalculado = aplicarRecalculoRegistro(registroPrevio, {
      valorCalculado: consolidadoAspecto.valorCalculadoPuntos,
      esParcial: consolidadoAspecto.esParcial,
      origenResultados: consolidadoAspecto.origenResultados,
    });
    const nota = {
      ...(previo || {}),
      notaId,
      estudianteId: resultado.estudianteId,
      aspectoId,
      valorCalculado: recalculado.valorCalculado,
      valorObtenido: recalculado.ajusteManual ? recalculado.valorFinal : recalculado.valorCalculado,
      esParcial: consolidadoAspecto.esParcial,
      ajusteManual: Boolean(recalculado.ajusteManual),
      desactualizado: Boolean(recalculado.desactualizado),
      origen: "instrumento",
    };
    setDocFake(rutaNota(notaId), nota, { merge: true });
    notas.push(nota);
  }
  return notas;
};

// Los aspectos usan puntajes uniformes (34/33/33)
const rJuan = [r1, r2, r3]; // 40/50 + 20/25 + 22/25 = 82%
let notasJuan = actualizarRegistroFake(r1, { instrumentos, resultadosEstudiante: rJuan });
assert.equal(notasJuan.length, 3);
// aspecto 1 (34 pts) al 82% → 28 pts
assert.equal(notasJuan[0].valorCalculado, Math.round(0.82 * 34));
assert.equal(notasJuan[0].valorObtenido, notasJuan[0].valorCalculado);
assert.equal(notasJuan[0].ajusteManual, false);
ok(`nota automática por aspecto: 82% de 34 pts = ${notasJuan[0].valorCalculado} (origen instrumento, sin ajuste)`);

// El docente ajusta manualmente el primer aspecto a 32 (como hace la UI del Registro)
setDocFake(rutaNota(notasJuan[0].notaId), {
  valorObtenido: 32, ajusteManual: true, motivoAjuste: "Participación oral", desactualizado: false,
}, { merge: true });

// Llega un nuevo resultado (rúbrica sube a 45/50 → 87%)
const r1c = construirResultadoInstrumento({ instrumento: instrumentos[0], estudianteId: "est-juan-perez-1", puntajeObtenido: 45 });
notasJuan = actualizarRegistroFake(r1c, { instrumentos, resultadosEstudiante: [r1c, r2, r3] });
const notaAjustada = store.get(rutaNota(`est-juan-perez-1_${aspectoIds[0]}`));
assert.equal(notaAjustada.valorObtenido, 32);        // ajuste RESPETADO
assert.equal(notaAjustada.ajusteManual, true);
assert.equal(notaAjustada.desactualizado, true);     // marcado para el docente
assert.equal(notaAjustada.valorCalculado, Math.round(0.87 * 34));
ok("nuevo resultado NO pisa el ajuste manual: valorObtenido 32 intacto, desactualizado=true, cálculo actualizado");

// El docente acepta el cálculo automático (botón "Aceptar" en el Registro)
const notaAceptada = { ...notaAjustada, valorObtenido: notaAjustada.valorCalculado, ajusteManual: false, motivoAjuste: "", desactualizado: false };
setDocFake(rutaNota(notaAjustada.notaId), notaAceptada, { merge: true });
assert.equal(store.get(rutaNota(notaAjustada.notaId)).valorObtenido, Math.round(0.87 * 34));
ok("'Aceptar cálculo' vuelve a enganchar la nota a la automatización");

// ─── 8. Regla 12 en las celdas del registro legacy (puentes parcheados) ──────
console.log("\n8) FASE 5 — celdas por competencia/período (sincronizarEvaluacionPedagogica / enviarNotaAlRegistro)");

// Celda vacía → la nota automática entra normal
let celda = aplicarNotaEnCelda({ p: "", rp: "" }, 82, { evaluacionId: "eval-x" });
assert.equal(celda.p, 82);
assert.equal(celda.fuente, "instrumentos");
assert.equal(celda.desactualizado, false);
ok("celda vacía → nota automática 82 con fuente=instrumentos");

// Celda escrita a mano por el docente (sin fuente) → NUNCA se pisa
celda = aplicarNotaEnCelda({ p: 90, rp: "" }, 82);
assert.equal(celda.p, 90);                    // el 90 manual queda intacto
assert.equal(celda.ajusteManual, true);
assert.equal(celda.valorCalculado, 82);
assert.equal(celda.desactualizado, true);
ok("celda manual (90) NO se pisa: valorCalculado=82 y desactualizado=true");

// Celda automática previa → sí se actualiza
celda = aplicarNotaEnCelda({ p: 75, fuente: "instrumentos" }, 82);
assert.equal(celda.p, 82);
assert.equal(celda.desactualizado, false);
ok("celda automática previa (75) sí se actualiza a 82");

// ─── 9. FASE 6 — Clase de hoy / próxima (Modo Aula, caso borde) ──────────────
console.log("\n9) FASE 6 — Modo Aula: clase de hoy o próxima pendiente (nunca vacío)");

// Fechas del plan: 2026-09-07, 09-09, 09-14, 09-16
let seleccion = obtenerClaseDeHoy(capa, "2026-09-09");
assert.equal(seleccion.esHoy, true);
assert.equal(seleccion.clase.claseId, "clase-s1-d2");
ok("miércoles 2026-09-09 → clase de HOY (clase-s1-d2)");

seleccion = obtenerClaseDeHoy(capa, "2026-09-10");
assert.equal(seleccion.esHoy, false);
assert.equal(seleccion.motivo, "proxima");
assert.equal(seleccion.clase.fechaSugerida, "2026-09-14");
ok("jueves sin clase → PRÓXIMA pendiente (lunes 2026-09-14) con aviso, no pantalla vacía");

seleccion = obtenerClaseDeHoy(capa, "2026-12-01");
assert.equal(seleccion.motivo, "ultima");
assert.equal(seleccion.clase.claseId, "clase-s2-d2");
ok("plan terminado → muestra la última clase con aviso");

seleccion = obtenerClaseDeHoy({ clases: [{ claseId: "c1", titulo: "X" }] });
assert.equal(seleccion.motivo, "sin-fechas");
assert.ok(seleccion.clase);
ok("plan sin fechas → primera clase con aviso");

// ─── 10. FASE 7+8 — Evaluar y registrar → evidencia vinculada ────────────────
console.log("\n10) FASES 7-8 — resultado → evidencia con vínculo completo");

const evidenciaJuan = construirEvidenciaDesdeResultado(r1c, {
  instrumento: instrumentos[0],
  claseTitulo: "Clase 1 — Parts of the House",
  docenteId: UID,
});
assert.equal(evidenciaJuan.evidenciaId, `evi-${r1c.resultadoId}`);
assert.equal(evidenciaJuan.estudianteId, "est-juan-perez-1");
assert.equal(evidenciaJuan.cursoId, CURSO_ID);
assert.equal(evidenciaJuan.planificacionId, registroPlan.id);
assert.equal(evidenciaJuan.instrumentoId, instrumentos[0].id);
assert.deepEqual(evidenciaJuan.indicadorIds, instrumentos[0].indicadorIds);
assert.equal(evidenciaJuan.aspectoId, aspectoIds[0]);
assert.equal(evidenciaJuan.tipo, "resultado_instrumento");
assert.equal(evidenciaJuan.calificacionAsociada, 45);
setDocFake(`usuarios/${UID}/evidenciasPedagogicas/${evidenciaJuan.evidenciaId}`, evidenciaJuan);
ok("evidencia vinculada a estudiante + curso + plan + indicadores + aspecto + instrumento (regla 8)");

// Re-evaluación → misma evidencia (ID determinista), no se duplica
const evidenciaBis = construirEvidenciaDesdeResultado(r1c, { instrumento: instrumentos[0] });
assert.equal(evidenciaBis.evidenciaId, evidenciaJuan.evidenciaId);
ok("re-evaluar actualiza la MISMA evidencia (no duplica el banco)");

// Resultado pendiente → sin evidencia
const evidenciaPendiente = construirEvidenciaDesdeResultado(rPendiente, {});
assert.equal(evidenciaPendiente, null);
ok("resultado 'pendiente' no genera evidencia");

// "No entregó" → evidencia descriptiva con 0
const evidenciaNoEntrego = construirEvidenciaDesdeResultado(rNoEntrego, { instrumento: instrumentos[2] });
assert.match(evidenciaNoEntrego.descripcion, /no entregó/);
assert.equal(evidenciaNoEntrego.calificacionAsociada, 0);
ok("'no entregó' genera evidencia explícita con calificación 0");

// ════════════════════════════ BLOQUE A.5 ═════════════════════════════════════

// ─── 11. A5.1 — Evidencias clasificadas MINERD ───────────────────────────────
console.log("\n11) A5.1 — Evidencias clasificadas { conocimiento, desempeno, producto }");

// El fixture solo trae productoElaborar → producto poblado, resto vacío,
// y evidenciasEsperadas (derivado) conserva el comportamiento del Bloque B.
assert.deepEqual(capa.clases[0].evidencias, {
  conocimiento: [],
  desempeno: [],
  producto: ["Maqueta o plano rotulado de la casa"],
});
assert.deepEqual(capa.clases[0].evidenciasEsperadas, ["Maqueta o plano rotulado de la casa"]);
ok("plan con solo productoElaborar → producto poblado, resto vacío (sin inventar), derivado intacto");

// Objeto completo de evidenciasSemana → clasificación por las 3 claves
const clasificadas = clasificarEvidencias({
  conocimientosPrevios: ["Vocabulario de la casa"],
  desempenoEsperado: ["Describe habitaciones oralmente"],
  productoElaborar: ["Plano rotulado"],
});
assert.deepEqual(clasificadas.evidencias.conocimiento, ["Vocabulario de la casa"]);
assert.deepEqual(clasificadas.evidencias.desempeno, ["Describe habitaciones oralmente"]);
assert.deepEqual(clasificadas.evidencias.producto, ["Plano rotulado"]);
assert.equal(clasificadas.evidenciasEsperadas.length, 3);
ok("conocimientosPrevios→conocimiento, desempenoEsperado→desempeno, productoElaborar→producto");

// Lista plana (planes viejos): NO se inventa clasificación
const planas = clasificarEvidencias(["Evidencia libre 1", "Evidencia libre 2"]);
assert.deepEqual(planas.evidencias, { conocimiento: [], desempeno: [], producto: [] });
assert.deepEqual(planas.evidenciasEsperadas, ["Evidencia libre 1", "Evidencia libre 2"]);
ok("lista plana → tres listas vacías; el derivado conserva los textos originales");

// Momentos nuevos con evidenciasDetalle completan lo que falta
const desdeMomentos = clasificarEvidencias(null, [
  { evidenciasDetalle: { conocimientos: ["Saberes previos"], desempeno: ["Participa"], producto: ["Ticket de salida"] } },
]);
assert.deepEqual(desdeMomentos.evidencias.conocimiento, ["Saberes previos"]);
assert.deepEqual(desdeMomentos.evidencias.producto, ["Ticket de salida"]);
ok("evidenciasDetalle de los momentos (generador nuevo) alimenta la clasificación");

// Globales clasificados en la evaluación planificada
assert.deepEqual(capa.evaluacionPlanificada.evidencias.producto, ["Maqueta o plano rotulado de la casa"]);
assert.ok(Array.isArray(capa.evaluacionPlanificada.evidenciasEsperadasGlobales));
ok("evaluacionPlanificada.evidencias globales clasificadas + derivado de compatibilidad");

// ─── 12. A5.3 — Adaptador currículo local → banco de conocimiento ────────────
console.log("\n12) A5.3 — adaptarCurriculoLocal (JSON local → sobre del banco)");

const sobre = adaptarCurriculoLocal(curriculo);
for (const campo of ["schemaVersion", "level", "grade", "area", "subject", "contentType"]) {
  assert.ok(sobre[campo], `sobre.${campo} presente`);
}
assert.equal(sobre.level, "Secundaria");
assert.equal(sobre.grade, "1ro");
assert.equal(sobre.subject, "Inglés");
assert.equal(sobre.contentType, "malla_curricular");
ok("sobre con los 6 campos obligatorios de validateJsonSobre");

assert.equal(sobre.competencias.length, 7);
assert.equal(sobre.competencias[0].id, "CE-ING-1-COM");        // ID oficial intacto
assert.equal(sobre.indicadoresLogro.length, 21);
assert.equal(sobre.indicadoresLogro[0].id, "IL-ING-1-COM-1");  // ID oficial intacto
assert.equal(sobre.indicadoresLogro[0].competenciaId, "CE-ING-1-COM");
assert.equal(sobre.temas.length, 14);
assert.ok(sobre.contenidos.conceptos.gramatica.length > 0);
assert.ok(sobre.contenidos.procedimientos.funcionales.length > 0);
assert.ok(sobre.origenLocal.contenidosGenerales.conceptuales.length > 0);
ok("7 CE + 21 IL con IDs oficiales intactos, índice plano con competenciaId, original preservado");

// ─── Resumen ─────────────────────────────────────────────────────────────────
console.log(`\n✅ ${pasos} verificaciones pasaron.`);
console.log("\nColecciones simuladas (mismas rutas que los servicios reales):");
console.log(`  usuarios/${UID}/cursos/${CURSO_ID}/registroAspectos → ${enColeccion(`usuarios/${UID}/cursos/${CURSO_ID}/registroAspectos/`).length} docs`);
console.log(`  usuarios/${UID}/instrumentos                        → ${enColeccion(`usuarios/${UID}/instrumentos/`).length} docs`);
console.log(`  usuarios/${UID}/instrumentoResultados               → ${enColeccion(`usuarios/${UID}/instrumentoResultados/`).length} docs`);
console.log(`  usuarios/${UID}/cursos/${CURSO_ID}/registroNotas    → ${enColeccion(`usuarios/${UID}/cursos/${CURSO_ID}/registroNotas/`).length} docs`);
console.log(`  usuarios/${UID}/evidenciasPedagogicas               → ${enColeccion(`usuarios/${UID}/evidenciasPedagogicas/`).length} docs`);
console.log("\nNO cubierto aquí (requiere emulador Firestore): reglas de seguridad y red.");
