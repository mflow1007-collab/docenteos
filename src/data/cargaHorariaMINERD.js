/**
 * cargaHorariaMINERD — Distribución OFICIAL del tiempo por área (F1.2).
 *
 * Fuente: Adecuación Curricular Nivel Secundario (MINERD, 2023), pp. 46-49,
 * aportada por el dueño. Módulo PURO (testeable en Node). Uso: AVISO suave en
 * el formulario de unidad cuando las horas seleccionadas difieren de las
 * oficiales — nunca bloquea (los centros en transición ajustan su horario).
 *
 * PENDIENTE: cargas de Primaria e Inicial cuando el dueño aporte sus
 * Adecuaciones oficiales (este documento cubre solo Secundaria).
 */

// horas/semana por asignatura. JEE = 40h (idéntica en ambos ciclos);
// JR = 30h (difiere por ciclo); Transición = 25h (solo 1ro-2do en centros
// de Primaria durante la transición a JEE).
export const CARGA_HORARIA_SECUNDARIA = {
  "Extendida": {
    "Primer Ciclo":  { "Lengua Española": 6, "Inglés": 4, "Francés": 2, "Matemática": 7, "Ciencias Sociales": 5, "Ciencias de la Naturaleza": 6, "Formación Integral Humana y Religiosa": 2, "Educación Física": 2, "Educación Artística": 2, "Cursos Optativos": 4 },
    "Segundo Ciclo": { "Lengua Española": 6, "Inglés": 4, "Francés": 2, "Matemática": 7, "Ciencias Sociales": 5, "Ciencias de la Naturaleza": 6, "Formación Integral Humana y Religiosa": 2, "Educación Física": 2, "Educación Artística": 2, "Salidas Optativas": 4 },
  },
  "Regular": {
    "Primer Ciclo":  { "Lengua Española": 6, "Inglés": 3, "Francés": 2, "Matemática": 6, "Ciencias Sociales": 4, "Ciencias de la Naturaleza": 4, "Formación Integral Humana y Religiosa": 1, "Educación Física": 2, "Educación Artística": 2 },
    "Segundo Ciclo": { "Lengua Española": 5, "Inglés": 3, "Francés": 1, "Matemática": 5, "Ciencias Sociales": 4, "Ciencias de la Naturaleza": 4, "Formación Integral Humana y Religiosa": 1, "Educación Física": 1, "Educación Artística": 2, "Optativas": 4 },
  },
  "Transición": {
    // Solo 1ro y 2do (anteriores 7mo/8vo) en centros de Primaria
    "Primer Ciclo":  { "Lengua Española": 5, "Inglés": 2, "Francés": 2, "Matemática": 5, "Ciencias Sociales": 3, "Ciencias de la Naturaleza": 3, "Formación Integral Humana y Religiosa": 1, "Educación Física": 2, "Educación Artística": 2 },
  },
};

const _norm = (t = "") => String(t || "").toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

// Alias frecuentes del formulario/cursos → clave de la tabla oficial
const ALIAS_ASIGNATURA = [
  ["ingles", "Inglés"], ["frances", "Francés"], ["lengua espanola", "Lengua Española"],
  ["matematica", "Matemática"], ["ciencias sociales", "Ciencias Sociales"], ["sociales", "Ciencias Sociales"],
  ["ciencias de la naturaleza", "Ciencias de la Naturaleza"], ["naturales", "Ciencias de la Naturaleza"],
  ["formacion integral", "Formación Integral Humana y Religiosa"], ["fihr", "Formación Integral Humana y Religiosa"],
  ["educacion fisica", "Educación Física"], ["educacion artistica", "Educación Artística"], ["artistica", "Educación Artística"],
];

const cicloDeGrado = (grado = "") => {
  const g = _norm(grado);
  if (/(^|\D)(1|2|3)(ro|do|er)?(\D|$)/.test(g) || /primer/.test(g)) return "Primer Ciclo";
  if (/(^|\D)(4|5|6)(to)?(\D|$)/.test(g) || /segundo/.test(g)) return "Segundo Ciclo";
  return "";
};

/**
 * Horas OFICIALES de la asignatura en Secundaria para el grado y la jornada.
 * @returns {{ horas, jornada, ciclo, asignatura }|null} null si no aplica
 *          (nivel no Secundaria, asignatura fuera de tabla o jornada sin datos)
 */
export const horasOficialesSecundaria = (asignatura = "", grado = "", jornada = "Extendida") => {
  const nivelTxt = _norm(grado);
  // Solo Secundaria: sin adivinar para Primaria/Inicial (pendientes de fuente)
  if (nivelTxt && /(primaria|inicial|kinder|preprimario)/.test(nivelTxt)) return null;
  const a = _norm(asignatura);
  const clave = ALIAS_ASIGNATURA.find(([alias]) => a.includes(alias) || alias.includes(a))?.[1];
  if (!clave) return null;
  const jornadaKey = _norm(jornada).includes("regular") ? "Regular"
    : _norm(jornada).includes("transic") ? "Transición" : "Extendida";
  const ciclo = cicloDeGrado(grado) || "Primer Ciclo";
  const horas = CARGA_HORARIA_SECUNDARIA[jornadaKey]?.[ciclo]?.[clave];
  if (horas === undefined) return null;
  return { horas, jornada: jornadaKey, ciclo, asignatura: clave };
};
