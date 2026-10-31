/**
 * F5 — Seguimiento del estudiante (src/services/seguimientoEstudiante.js).
 *
 * Ejecutar:  node scripts/test-seguimiento-estudiante.mjs
 *
 * Cubre la lógica pura: línea de tiempo única (sin duplicar entrega/resultado
 * de una actividad) y las 3 señales de «Necesita apoyo» (decisión 5) con su
 * motivo, más el aviso de fuente sin comprobar. Lo que NO cubre: las lecturas
 * de Firestore ni la ficha; se comprueban en el navegador.
 */

import {
  construirLineaDeTiempo, senalesNecesitaApoyo, restarDias, fechaDia,
} from "../src/services/seguimientoEstudiante.js";

let pasos = 0, fallos = 0;
const check = (n, fn) => { try { fn(); pasos += 1; console.log(`  ✓ ${n}`); } catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); } };
const assert = (c, m) => { if (!c) throw new Error(m); };
const igual = (a, b, m) => assert(JSON.stringify(a) === JSON.stringify(b), `${m}\n      esperado: ${JSON.stringify(b)}\n      obtenido: ${JSON.stringify(a)}`);

const HOY = "2026-11-20";
const EST = "est-ana";
const act = (n, estado, extra = {}) => ({
  id: `act-plan1-f${n}`, cursoId: "c1", faseNumero: n, faseNombre: `Fase ${n}`, activa: true,
  instrumentoId: n >= 3 && n <= 5 ? `ins-plan1-actividad-f${n}` : "",
  fechaPrevista: `2026-11-${String(10 + n).padStart(2, "0")}`,
  entregas: { [EST]: { estado, nombre: "Ana" } }, ...extra,
});
const resultado = (n, pct, estado = "evaluado") => ({
  instrumentoId: `ins-plan1-actividad-f${n}`, estudianteId: EST, estado, cursoId: "c1",
  puntajeObtenido: estado === "evaluado" ? pct : null, puntajeMaximo: 100,
  porcentaje: estado === "evaluado" ? pct : null, indicadorIds: ["ING-2-I01"],
});
const dia = (fecha, estado) => ({ fecha, marcas: { [EST]: estado, otro: "presente" } });

console.log("\nF5 — seguimiento del estudiante\n");

check("restarDias y fechaDia", () => {
  igual(restarDias(HOY, 13), "2026-11-07", "14 días contando hoy");
  igual(restarDias("2026-03-01", 1), "2026-02-28", "cruce de mes");
  igual(fechaDia("2026-11-03T14:00:00.000Z"), "2026-11-03", "ISO con hora");
  igual(fechaDia({ toDate: () => new Date(2026, 10, 4, 9) }), "2026-11-04", "Timestamp");
  igual(fechaDia(null), "", "vacío");
});

check("línea de tiempo: actividad con nota, sin duplicar sus evidencias", () => {
  const linea = construirLineaDeTiempo({
    actividades: [act(3, "entrego", { entregas: { [EST]: { estado: "entrego", enlace: "https://ej.com/a" } } })],
    resultados: [resultado(3, 85)],
    evidencias: [
      { id: "evi-act-act-plan1-f3__est-ana", tipo: "entrega_actividad", fecha: "2026-11-13" },
      { id: "evi-ins-plan1-actividad-f3__est-ana", tipo: "resultado_instrumento", instrumentoId: "ins-plan1-actividad-f3", fecha: "2026-11-14" },
      { id: "evi-otra", tipo: "resultado_instrumento", instrumentoId: "ins-legacy", titulo: "Lista de cotejo", descripcion: "obtuvo 70/100", fecha: "2026-11-02" },
    ],
    ids: [EST], hoy: HOY,
  });
  igual(linea.map((e) => e.tipo), ["actividad", "evidencia"], "1 actividad + 1 evidencia ajena");
  igual(linea[0].detalle, "Entregó · Nota 85/100", "estado y nota");
  igual(linea[0].enlace, "https://ej.com/a", "enlace de la entrega");
});

check("línea de tiempo: pendientes futuras fuera, anecdótico y asistencia dentro, orden reciente primero", () => {
  const linea = construirLineaDeTiempo({
    actividades: [act(1, "pendiente"), act(9, "pendiente"), act(4, "no_entrego", { excluidaDeNota: true })],
    evidencias: [{ id: "anec-1", tipo: "registro_anecdotico", fecha: "2026-11-18", hecho: "Ayudó a un compañero" }],
    asistencia: [dia("2026-11-17", "ausente"), dia("2026-11-16", "presente"), dia("2026-11-15", "tarde")],
    ids: [EST], hoy: HOY,
  });
  // act(1) = 11-11 y act(9) = 11-19: pendientes ya vencidas, salen; presente no sale
  igual(linea.map((e) => `${e.fecha} ${e.tipo}`), [
    "2026-11-19 actividad", "2026-11-18 anecdotico", "2026-11-17 asistencia",
    "2026-11-15 asistencia", "2026-11-14 actividad", "2026-11-11 actividad",
  ], "orden y filtros");
  const f4 = linea.find((e) => e.titulo.startsWith("Fase 4"));
  igual(f4.detalle, "No entregó · excluida de la nota", "marca de exclusión");
  igual(linea.find((e) => e.tipo === "anecdotico").detalle, "Ayudó a un compañero", "texto del hecho");
});

check("línea de tiempo: pendiente con fecha futura no sale", () => {
  const linea = construirLineaDeTiempo({ actividades: [act(3, "pendiente", { fechaPrevista: "2026-12-01" })], ids: [EST], hoy: HOY });
  igual(linea.length, 0, "omitida");
});

check("sin señales → no necesita apoyo", () => {
  const s = senalesNecesitaApoyo({ actividades: [act(3, "entrego")], resultados: [resultado(3, 85)], asistencia: [], ids: [EST], hoy: HOY });
  igual(s, { necesitaApoyo: false, motivos: [], sinComprobar: [] }, "limpio");
});

check("señal entregas: 2 «No entregó» sin resolver; un 0 puesto la resuelve", () => {
  const dos = senalesNecesitaApoyo({ actividades: [act(3, "no_entrego"), act(6, "no_entrego")], ids: [EST], hoy: HOY });
  assert(dos.necesitaApoyo, "debe alertar");
  igual(dos.motivos[0].texto, "2 actividades en «No entregó» sin resolver (fase 3, fase 6).", "motivo");
  const resuelta = senalesNecesitaApoyo({
    actividades: [act(3, "no_entrego"), act(6, "no_entrego")], resultados: [resultado(3, 0)], ids: [EST], hoy: HOY,
  });
  igual(resuelta.motivos.map((m) => m.senal), ["indicadores"], "el 0 resuelve la entrega (y baja el indicador)");
  const una = senalesNecesitaApoyo({ actividades: [act(3, "no_entrego"), act(4, "excusa")], ids: [EST], hoy: HOY });
  igual(una.necesitaApoyo, false, "1 no entregó + excusa no alerta");
});

check("señal indicadores: < 70 alerta, pendientes no cuentan", () => {
  const s = senalesNecesitaApoyo({ resultados: [resultado(3, 60), resultado(4, 0, "pendiente")], ids: [EST], hoy: HOY });
  igual(s.motivos, [{ senal: "indicadores", texto: "Indicador por debajo de 70: ING-2-I01 (60)." }], "motivo");
  const p = senalesNecesitaApoyo({ resultados: [resultado(4, 0, "pendiente")], ids: [EST], hoy: HOY });
  igual(p.necesitaApoyo, false, "pendiente no es nota baja");
  const otro = senalesNecesitaApoyo({ resultados: [{ ...resultado(3, 40), estudianteId: "otro" }], ids: [EST], hoy: HOY });
  igual(otro.necesitaApoyo, false, "resultados de otro estudiante no cuentan");
});

check("señal asistencia: ≥3 ausentes en 14 días; tardanza, excusa y días viejos no cuentan", () => {
  const s = senalesNecesitaApoyo({
    asistencia: [dia("2026-11-07", "ausente"), dia("2026-11-12", "ausente"), dia("2026-11-20", "ausente"),
      dia("2026-11-06", "ausente"), dia("2026-11-13", "tarde"), dia("2026-11-14", "excusa")],
    ids: [EST], hoy: HOY,
  });
  igual(s.motivos, [{ senal: "asistencia", texto: "3 ausencias sin excusa en las últimas 2 semanas (2026-11-07, 2026-11-12, 2026-11-20)." }], "motivo");
  const dosSolo = senalesNecesitaApoyo({ asistencia: [dia("2026-11-06", "ausente"), dia("2026-11-12", "ausente"), dia("2026-11-20", "ausente")], ids: [EST], hoy: HOY });
  igual(dosSolo.necesitaApoyo, false, "el 06-11 queda fuera de la ventana");
});

check("id legado del estudiante también cuenta", () => {
  const s = senalesNecesitaApoyo({
    actividades: [act(3, "no_entrego", { entregas: { "viejo-1": { estado: "no_entrego" } } }), act(4, "no_entrego")],
    ids: [EST, "viejo-1"], hoy: HOY,
  });
  igual(s.motivos[0]?.senal, "entregas", "las dos cuentan");
});

check("fuente que falla → sin comprobar, nunca «sin alerta» silenciosa", () => {
  const s = senalesNecesitaApoyo({ ids: [EST], hoy: HOY, errores: { resultados: true, asistencia: true } });
  igual(s.sinComprobar, ["entregas", "indicadores", "asistencia"], "las tres sin comprobar");
  igual(s.necesitaApoyo, false, "sin motivos inventados");
});

console.log(`\n${pasos} correctas, ${fallos} fallidas\n`);
if (fallos) process.exit(1);
