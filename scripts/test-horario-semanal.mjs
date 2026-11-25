/**
 * Horario por selección (src/utils/horarioSemanal.js).
 *
 * Ejecutar:  node scripts/test-horario-semanal.mjs
 *
 * Caso de César: 2.º de Secundaria, lunes 3.ª Inglés, martes 6.ª Francés y
 * jueves 3.ª Inglés. NO cubre la escritura en Firestore ni la pantalla.
 */

import {
  aplicarHorariosACursos, cambiosPorGuardar, claseDeAhora, clasesDelDia, construirBorrador, cursosEnHora,
  horasDelCurso, leerHorarioAnterior, leerHorarioSemanal, proximaClase, tocarHora,
} from "../src/utils/horarioSemanal.js";
import { enriquecerCursoInicial } from "../src/utils/cursoUtils.js";

let pasos = 0, fallos = 0;
const check = (n, fn) => { try { fn(); pasos += 1; console.log(`  ✓ ${n}`); } catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); } };
const assert = (c, m) => { if (!c) throw new Error(m); };
const igual = (a, b, m = "") => assert(JSON.stringify(a) === JSON.stringify(b), `${m}\n      esperado: ${JSON.stringify(b)}\n      obtenido: ${JSON.stringify(a)}`);

const curso = (id, area, extra = {}) =>
  enriquecerCursoInicial({ id, nombre: "2do Secundaria A", area, nivel: "Secundaria", estudiantes: 0, ...extra });
const ingles = curso("ing", "Inglés");
const frances = curso("fra", "Francés");

const marcar = (cursos, toques) => {
  const ediciones = {};
  toques.forEach(([id, dia, hora, opciones]) => {
    Object.assign(ediciones, tocarHora(construirBorrador(cursos, ediciones), id, dia, hora, opciones).cambios);
  });
  return construirBorrador(cursos, ediciones);
};
const guardados = (cursos, borrador) => cursos.map((c) => {
  const cambio = cambiosPorGuardar(cursos, borrador).find((x) => x.cursoId === c.id);
  return cambio ? { ...c, horarioSemanal: cambio.horarioSemanal } : c;
});

// Semana de prueba: lunes 23 a viernes 27 de noviembre de 2026 (hora local)
const momento = (diaMes, h, m) => new Date(2026, 10, diaMes, h, m);

console.log("\nHorario por selección\n");

const base = [ingles, frances];
const borradorCaso = marcar(base, [["ing", "Lunes", 3], ["fra", "Martes", 6], ["ing", "Jueves", 3]]);
const caso = guardados(base, borradorCaso);

check("caso de ejemplo: cada materia del mismo grado con sus días y horas", () => {
  igual(caso[0].horarioSemanal, [{ dia: "Lunes", hora: 3 }, { dia: "Jueves", hora: 3 }]);
  igual(caso[1].horarioSemanal, [{ dia: "Martes", hora: 6 }]);
});

check("cada hora muestra su materia", () => {
  igual(clasesDelDia(caso, "Lunes").map((c) => [c.hora, c.materia, c.inicio]), [[3, "Inglés", "09:40"]]);
  igual(clasesDelDia(caso, "Martes").map((c) => [c.hora, c.materia, c.inicio]), [[6, "Francés", "13:40"]]);
  igual(clasesDelDia(caso, "Miércoles"), []);
});

check("ahora: martes 1:45 p. m. es Francés; a la misma hora el lunes, nada", () => {
  igual(claseDeAhora(caso, momento(24, 13, 45))?.materia, "Francés");
  igual(claseDeAhora(caso, momento(23, 13, 45)), null);
});

check("próxima: respeta el día, también en fin de semana", () => {
  const p = (d, h, m) => { const x = proximaClase(caso, momento(d, h, m)); return [x?.cuando, x?.hora, x?.materia]; };
  igual(p(23, 8, 0), ["Hoy", 3, "Inglés"]);
  igual(p(23, 18, 0), ["Mañana", 6, "Francés"]);
  igual(p(24, 14, 0), ["Jueves", 3, "Inglés"]);
  igual(p(27, 18, 0), ["Lunes", 3, "Inglés"]);
  igual(p(22, 9, 0), ["Mañana", 3, "Inglés"], "domingo");
});

check("próxima de un solo curso, con una única hora ya pasada hoy: la semana que viene", () => {
  igual(proximaClase([caso[1]], momento(24, 14, 0))?.cuando, "El próximo martes");
});

check("sin horario marcado no se inventa una hora", () => {
  igual(proximaClase(base, momento(23, 8, 0)), null);
  igual(claseDeAhora(base, momento(23, 8, 30)), null);
});

check("tocar una hora propia la quita", () => {
  igual(marcar(caso, [["ing", "Lunes", 3]]).ing, [{ dia: "Jueves", hora: 3 }]);
});

check("hora de otra materia: avisa y no cambia nada hasta confirmar", () => {
  const b = construirBorrador(caso);
  igual(tocarHora(b, "fra", "Lunes", 3), { cambios: {}, choque: ["ing"] });
  const r = marcar(caso, [["fra", "Lunes", 3, { reemplazar: true }]]);
  igual(cursosEnHora(r, "Lunes", 3), ["fra"]);
  igual(r.ing, [{ dia: "Jueves", hora: 3 }]);
});

check("solo se guarda lo que cambió", () => {
  igual(cambiosPorGuardar(caso, construirBorrador(caso)), []);
  igual(cambiosPorGuardar(caso, marcar(caso, [["fra", "Viernes", 1]])).map((c) => c.cursoId), ["fra"]);
});

check("guardar cambia solo horarioSemanal y solo en el curso tocado", () => {
  const r = aplicarHorariosACursos(caso, [{ cursoId: "fra", horarioSemanal: [{ dia: "Viernes", hora: 1 }] }]);
  assert(r[0] === caso[0], "Inglés intacto");
  igual({ ...r[1], horarioSemanal: 0 }, { ...caso[1], horarioSemanal: 0 }, "Francés: el resto igual");
  igual(r[1].horarioSemanal, [{ dia: "Viernes", hora: 1 }]);
});

check("quitar todas las horas se guarda como lista vacía y no resucita el horario anterior", () => {
  const viejo = curso("v", "Inglés", { horarioClase: [{ id: "hc-3", tipo: "clase", dia: "Jueves", horaAcademica: "3ra Hora" }] });
  const sin = guardados([viejo], marcar([viejo], [["v", "Jueves", 3]]))[0];
  igual(sin.horarioSemanal, []);
  igual(leerHorarioSemanal(sin), []);
});

// Forma real que escribía DetalleCurso.construirHorarioClasePredeterminado
const filasAnteriores = ["1ra Hora", "2da Hora", "3ra Hora", "Recreo", "4ta Hora", "Almuerzo", "5ta Hora", "6ta Hora", "Recreo", "7ma Hora", "8va Hora"]
  .map((horaAcademica, i) => ({
    id: `hc-${i + 1}`, dia: "Lunes", horaAcademica, tipo: i === 3 || i === 8 ? "recreo" : i === 5 ? "almuerzo" : "clase",
    inicio: "08:00", fin: "08:50", curso: "2do Secundaria A · Inglés", aula: `Aula ${101 + i}`,
  }));
const conFila = (i, cambio) => filasAnteriores.map((f, k) => (k === i ? { ...f, ...cambio } : f));

check("horario anterior: lo que vino por defecto (todo en lunes) no cuenta", () => {
  igual(leerHorarioAnterior(curso("a", "Inglés", { horarioClase: filasAnteriores })), { marcas: [], sinUbicar: [] });
});

check("horario anterior: las filas cambiadas por el docente se siguen leyendo", () => {
  const a = curso("a", "Inglés", { horarioClase: conFila(2, { dia: "Jueves" }) });
  igual(leerHorarioSemanal(a), [{ dia: "Jueves", hora: 3 }]);
  igual(cambiosPorGuardar([a], construirBorrador([a])), [{ cursoId: "a", horarioSemanal: [{ dia: "Jueves", hora: 3 }] }], "al guardar se confirman");
  const b = curso("b", "Inglés", { horarioClase: conFila(0, { aula: "Laboratorio" }) });
  igual(leerHorarioSemanal(b), [{ dia: "Lunes", hora: 1 }]);
});

check("horario anterior: texto de otra materia u otro grado no se adivina", () => {
  const otra = curso("a", "Inglés", { horarioClase: conFila(7, { dia: "Martes", cursoAsignatura: "2do A francés" }) });
  igual(leerHorarioAnterior(otra), { marcas: [], sinUbicar: ["Martes · 6ta Hora · 2do A francés"] });
  const grado = curso("a", "Inglés", { horarioClase: conFila(7, { cursoAsignatura: "3ro A ingles" }) });
  igual(leerHorarioAnterior(grado).marcas, []);
  const propia = curso("a", "Inglés", { horarioClase: conFila(7, { cursoAsignatura: "2do a ingles" }) });
  igual(leerHorarioSemanal(propia), [{ dia: "Lunes", hora: 6 }]);
});

check("leer no toca los campos guardados del horario anterior", () => {
  const a = curso("a", "Inglés", { horarioClase: conFila(2, { dia: "Jueves" }) });
  const antes = JSON.stringify(a);
  construirBorrador([a]); proximaClase([a]); marcar([a], [["a", "Lunes", 1]]);
  igual(JSON.stringify(a), antes);
});

check("horas del timbre: usa el número del nombre y, si se repite, la posición", () => {
  igual(horasDelCurso(ingles).map((h) => h.hora), [1, 2, 3, 4, 5, 6, 7, 8]);
  const tarde = { nombre: "x", horario: [{ nombre: "5ta Hora", tipo: "clase", inicio: "13:00", fin: "13:45" }, { nombre: "6ta Hora", tipo: "clase", inicio: "13:45", fin: "14:30" }] };
  igual(horasDelCurso(tarde).map((h) => h.hora), [5, 6]);
  const roto = { nombre: "x", horario: [{ nombre: "1ra", tipo: "clase", inicio: "08:00" }, { nombre: "1ra", tipo: "clase", inicio: "09:00" }, { nombre: "", tipo: "clase", inicio: "10:00" }] };
  igual(horasDelCurso(roto).map((h) => h.hora), [1, 2, 3]);
});

check("curso sin timbre guardado usa el de su nivel", () => {
  igual(horasDelCurso({ nivel: "Secundaria" })[2].inicio, "09:40");
  igual(horasDelCurso({ nivel: "Primaria" })[2].inicio, "09:45");
});

check("datos dañados en horarioSemanal se ignoran", () => {
  igual(leerHorarioSemanal({ horarioSemanal: [null, { dia: "Domingo", hora: 1 }, { dia: "Lunes", hora: "3" }, { dia: "Lunes", hora: 3 }, { dia: "Martes", hora: 0 }] }), [{ dia: "Lunes", hora: 3 }]);
});

console.log(`\n${pasos} correctas, ${fallos} fallidas\n`);
if (fallos) process.exit(1);
