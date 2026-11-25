/**
 * listaEstudiantes.js — ¿la lista del curso es real? (Etapa 1, 2026-11-25)
 *
 * La app ya no inventa estudiantes. Pero antes guardaba cursos con nombres de
 * ejemplo (perfil inicial y cursos creados sin lista), a veces mezclados con
 * reales y marcados «oficial». Aquí solo se DETECTAN y se avisa: nunca se
 * borra nada; quitar un estudiante es decisión del docente.
 *
 * Un nombre solo no basta (puede existir una Ana García de verdad): cuenta si
 * el curso quedó marcado «demo», o si al menos MINIMO nombres están en la misma
 * posición exacta en que los ponía el generador.
 */

// Orden exacto de los dos generadores retirados. Solo para detectar, nunca para crear.
const GENERADOR_CURSOS = [
  "Ana García","Carlos Pérez","María López","José Rodríguez","Carmen Martínez",
  "Luis Santos","Rosa Reyes","Pedro Díaz","Isabel Fernández","Miguel Moreno",
  "Lucía Jiménez","Andrés Torres","Sofía Ruiz","Diego Vargas","Paula Romero",
  "Valentina Cruz","Ricardo Flores","Daniela Mendoza","Alejandro Herrera","Natalia Suárez",
  "Fernando Medina","Laura Guerrero","Sebastián Molina","Camila Morales","Emilio Vega",
  "Diana Ramos","Ernesto Silva","Paola Cortés","Manuel Ortega","Elena Castillo",
];
const GENERADOR_PERFIL = [
  "María García", "Juan Pérez", "Carmen López", "José Rodríguez",
  "Ana Martínez", "Luis Santos", "Rosa Reyes", "Pedro Díaz",
  "Isabel Fernández", "Carlos Moreno", "Lucía Jiménez", "Miguel Torres",
  "Sofía Ruiz", "Andrés Vargas", "Paula Romero", "Diego Castillo",
  "Valentina Cruz", "Ricardo Flores", "Daniela Mendoza", "Alejandro Herrera",
  "Natalia Suárez", "Fernando Medina", "Laura Guerrero", "Sebastián Molina",
  "Camila Morales", "Emilio Vega", "Diana Ramos", "Ernesto Silva",
  "Paola Cortés", "Manuel Ortega",
];
const MINIMO = 3;

const nombreDe = (e) => String(typeof e === "string" ? e : e?.nombre || e?.nombreCompleto || e?.name || "").trim();

/** Nombres que coinciden, en su posición, con un generador retirado. PURO. */
export const nombresDeEjemplo = (lista = []) => {
  const nombres = (Array.isArray(lista) ? lista : []).map(nombreDe);
  const porGenerador = [GENERADOR_CURSOS, GENERADOR_PERFIL]
    .map((generador) => nombres.filter((nombre, i) => nombre && nombre === generador[i % generador.length]));
  const mejor = porGenerador.sort((a, b) => b.length - a.length)[0];
  return mejor.length >= MINIMO ? mejor : [];
};

/**
 * Estado de la lista del curso. PURO.
 * @returns {{ estado: "vacia"|"ejemplo"|"mezclada"|"real", ejemplos: string[], mensaje: string }}
 */
export const revisarListaEstudiantes = (curso = {}) => {
  const lista = Array.isArray(curso?.estudiantesDetalle) ? curso.estudiantesDetalle : [];
  if (!lista.length) {
    return { estado: "vacia", ejemplos: [], mensaje: "Este curso todavía no tiene lista de estudiantes. Cárgala para pasar lista, evaluar y registrar notas." };
  }
  const ejemplos = nombresDeEjemplo(lista);
  if (!ejemplos.length && curso?.estudiantesFuente !== "demo") return { estado: "real", ejemplos: [], mensaje: "" };
  if (ejemplos.length && ejemplos.length < lista.length) {
    return { estado: "mezclada", ejemplos, mensaje: `Esta lista parece tener ${ejemplos.length} estudiantes de ejemplo mezclados con otros. Revísala antes de pasar lista o poner notas.` };
  }
  return { estado: "ejemplo", ejemplos: ejemplos.length ? ejemplos : lista.map(nombreDe), mensaje: "Esta lista parece ser de ejemplo: los estudiantes no son reales. Revísala antes de pasar lista o poner notas." };
};

const nuevoId = () => `est-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/**
 * Añade nombres reales (lista pegada o foto) a la lista del curso, con ID
 * permanente. Conserva los que ya estaban. PURO salvo el ID.
 * @returns {{ curso: object, nuevos: object[] }}
 */
export const agregarNombresAlCurso = (curso, nombres = [], crearId = nuevoId) => {
  const nuevos = nombres.map((n) => String(n || "").trim()).filter(Boolean)
    .map((nombre) => ({ id: crearId(), nombre, promedio: null }));
  const detalle = [...(curso.estudiantesDetalle || []), ...nuevos];
  return {
    nuevos,
    curso: { ...curso, estudiantesDetalle: detalle, estudiantes: detalle.length, estudiantesFuente: "oficial", matriculaOficial: true },
  };
};
