import { guardarDiagnosticoFirebase, listarDiagnosticosFirebase, firebaseDisponible } from "./diagnosticoFirebaseService.js";

const STORAGE_KEY = "docenteos_diagnosticos_v1";

export const NIVELES_DIAGNOSTICO = [
  { id: "requiere_apoyo", label: "En proceso (25%)", valor: 1, informe: "elemental" },
  { id: "en_proceso", label: "Básico (50%)", valor: 2, informe: "aceptable" },
  { id: "logrado", label: "Satisfactorio (75%)", valor: 3, informe: "satisfactorio" },
  { id: "avanzado", label: "Excelente (100%)", valor: 4, informe: "satisfactorio" },
];

export const MEDIACIONES_DIAGNOSTICO = [
  { id: "autonomo", label: "Lo realizó de forma autónoma" },
  { id: "con_pista", label: "Lo recuperó con una pista" },
  { id: "con_ejemplo", label: "Lo realizó después de un ejemplo" },
  { id: "apoyo_constante", label: "Necesitó apoyo constante" },
  { id: "sin_evidencia", label: "Todavía no lo evidencia" },
];

export const aprendizajesIniciales = (area = "") => {
  const nombre = String(area || "el área").trim();
  return [
    `Recupera saberes esenciales del grado anterior en ${nombre}`,
    "Comprende y explica ideas usando el vocabulario básico",
    "Aplica lo aprendido para resolver una situación cercana",
    "Comunica su proceso y justifica sus respuestas",
  ];
};

const nombreNivelInforme = { elemental: "Elemental", aceptable: "Aceptable", satisfactorio: "Satisfactorio" };

const _txt = (v) => String(v ?? "").trim();
// Nombre legible del área/asignatura para redactar en prosa, sin inventar.
const nombreArea = ({ area, asignatura } = {}) => _txt(asignatura) || _txt(area) || "el área";
// ¿El área es un idioma? Solo entonces aplican menciones a listening/speaking.
const esIdioma = ({ area, asignatura } = {}) => /ingl|fran|lengua/i.test(`${area} ${asignatura}`);
// Frase de zona escolar en palabras del informe (sin suponer si está vacía).
const fraseZona = (zona) => {
  const z = _txt(zona).toLowerCase();
  if (z.includes("rural")) return "en una zona rural";
  if (z.includes("periurban")) return "en una zona periurbana";
  if (z.includes("urban")) return "en una zona urbana";
  return "";
};

// Redacta el análisis en prosa del grupo. NO es genérico: incorpora el área y
// asignatura del docente, la zona escolar, el contexto comunitario que él
// escribió y las brechas reales detectadas. Estilo del informe MINERD (p. 7-10).
export const redactarAnalisisGrado = ({ grado = "este grado", porEstudiante, area, asignatura, zonaEscolar, contextoComunitario, brechas = [] } = {}) => {
  const { niveles, porcentajes, evaluados } = porEstudiante || { niveles: {}, porcentajes: {}, evaluados: 0 };
  const materia = nombreArea({ area, asignatura });
  if (!evaluados) return `Aún no hay registros suficientes para describir el desempeño del grupo en ${materia}.`;
  const orden = ["elemental", "aceptable", "satisfactorio"];
  const predominante = orden.slice().sort((a, b) => (porcentajes[b] || 0) - (porcentajes[a] || 0))[0];
  const detalle = orden
    .map((nivel) => `${porcentajes[nivel] || 0}% en ${nombreNivelInforme[nivel].toLowerCase()} (${niveles[nivel] || 0})`)
    .join(", ");
  const zona = fraseZona(zonaEscolar);
  const marco = `En ${grado}${zona ? ` (${zona})` : ""}, sobre ${evaluados} estudiante(s) evaluado(s) en ${materia}, la distribución fue: ${detalle}. Predomina el nivel ${nombreNivelInforme[predominante]}.`;
  let lectura;
  if (predominante === "elemental") {
    lectura = `Esto refleja una etapa inicial del aprendizaje en ${materia}, que constituye la línea de base para construir las competencias de forma gradual.`;
  } else if (predominante === "aceptable") {
    lectura = `La mayoría se ubica en un nivel intermedio de dominio en ${materia}, consolidando aprendizajes previos, aunque todavía se requiere afianzar la autonomía.`;
  } else {
    lectura = `Una proporción importante evidencia dominio de las competencias esperadas en ${materia}, lo que permite abrir espacios de profundización sin descuidar a quienes aún requieren apoyo.`;
  }
  // Brecha prioritaria concreta de ESTE grupo (la de mayor % de apoyo).
  const prioritaria = [...brechas].sort((a, b) => (b.porcentajeApoyo || 0) - (a.porcentajeApoyo || 0))[0];
  const foco = prioritaria && prioritaria.porcentajeApoyo >= 30
    ? ` El aprendizaje que más requiere atención es «${prioritaria.aprendizaje}» (${prioritaria.porcentajeApoyo}% necesita apoyo).`
    : "";
  const comunidad = _txt(contextoComunitario)
    ? ` Se tendrá en cuenta el contexto del grupo: ${_txt(contextoComunitario)}.`
    : "";
  return `${marco} ${lectura}${foco}${comunidad}`;
};

// Indicadores de logro derivados de la línea de base real y del ÁREA del
// docente (no fijados a inglés). El 4.º indicador se adapta a idioma / otras áreas.
export const construirIndicadoresLogro = ({ porEstudiante, area, asignatura } = {}) => {
  const { porcentajes = {} } = porEstudiante || {};
  const elemental = porcentajes.elemental || 0;
  const satisfactorio = porcentajes.satisfactorio || 0;
  const materia = nombreArea({ area, asignatura });
  const cuartoIndicador = esIdioma({ area, asignatura })
    ? { indicador: "Lograr que los estudiantes produzcan frases completas, de forma oral y escrita", lineaBase: "Por evaluar", meta: "100% de los estudiantes" }
    : { indicador: `Lograr que los estudiantes expliquen con autonomía sus aprendizajes en ${materia}`, lineaBase: "Por evaluar", meta: "100% de los estudiantes" };
  return [
    {
      indicador: "Incrementar la proporción de estudiantes en nivel satisfactorio",
      lineaBase: `${satisfactorio}%`,
      meta: `${Math.min(satisfactorio + 20, 100)}% (+20 puntos)`,
    },
    {
      indicador: "Reducir la proporción de estudiantes en nivel elemental",
      lineaBase: `${elemental}%`,
      meta: `${Math.max(elemental - 15, 0)}% (-15 puntos)`,
    },
    {
      indicador: "Incorporar recursos TIC en al menos una actividad semanal",
      lineaBase: "Por iniciar",
      meta: "100% de las semanas",
    },
    cuartoIndicador,
  ];
};

// Cronograma anual derivado del ÁREA y de los resultados reales. Para idiomas
// usa el vocabulario comunicativo (listening/speaking); para otras áreas, un
// lenguaje general. Las metas numéricas salen de la línea de base del grupo.
export const construirCronograma = ({ area, asignatura, porEstudiante } = {}) => {
  const { porcentajes = {} } = porEstudiante || {};
  const aceptableMeta = Math.min((porcentajes.aceptable || 0) + (porcentajes.elemental || 0) >= 60 ? 60 : (porcentajes.aceptable || 0) + 20, 100);
  const materia = nombreArea({ area, asignatura });
  if (esIdioma({ area, asignatura })) {
    return [
      { periodo: "Semana 1", acciones: "Diagnóstico inicial y reforzamiento de vocabulario y frases simples.", esperado: "Nivelación básica y motivación inicial." },
      { periodo: "1er período", acciones: "Consolidar estructuras simples, listening y speaking con apoyos visuales y TIC.", esperado: `${aceptableMeta}% de estudiantes en nivel aceptable.` },
      { periodo: "2do período", acciones: "Introducir tiempos verbales y proyectos grupales con producción oral y escrita.", esperado: "Incremento del 15% en nivel satisfactorio." },
      { periodo: "3er y 4to período", acciones: "Desarrollar producciones complejas (ensayos, presentaciones digitales).", esperado: "20% asciende de elemental a aceptable/satisfactorio." },
    ];
  }
  return [
    { periodo: "Semana 1", acciones: `Diagnóstico inicial y activación de saberes previos en ${materia}.`, esperado: "Nivelación básica y motivación inicial." },
    { periodo: "1er período", acciones: `Consolidar los aprendizajes esenciales de ${materia} con apoyos visuales, trabajo guiado y TIC.`, esperado: `${aceptableMeta}% de estudiantes en nivel aceptable.` },
    { periodo: "2do período", acciones: `Ampliar hacia situaciones nuevas de ${materia} con proyectos y producción propia.`, esperado: "Incremento del 15% en nivel satisfactorio." },
    { periodo: "3er y 4to período", acciones: "Desarrollar producciones complejas (análisis, presentaciones, proyectos integradores).", esperado: "20% asciende de elemental a aceptable/satisfactorio." },
  ];
};

const leerTodo = () => {
  try {
    const datos = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(datos) ? datos : [];
  } catch {
    return [];
  }
};

const escribirTodo = (todos) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(todos)); } catch { /* cuota llena: Firestore sigue siendo la copia durable */ }
};

export const listarDiagnosticos = () => leerTodo();

// Guarda en el cache local (síncrono, para lectura inmediata) y, si hay sesión
// Firebase, replica a Firestore en segundo plano (fuente de verdad durable
// entre dispositivos). La escritura remota es fire-and-forget: un fallo de red
// no bloquea ni pierde el trabajo, que ya quedó en localStorage.
export const guardarDiagnostico = (diagnostico) => {
  const todos = leerTodo();
  const ahora = new Date().toISOString();
  const registro = {
    ...diagnostico,
    id: diagnostico.id || `diag-${Date.now()}`,
    creadoEn: diagnostico.creadoEn || ahora,
    actualizadoEn: ahora,
  };
  const indice = todos.findIndex((item) => item.id === registro.id);
  if (indice >= 0) todos[indice] = registro;
  else todos.unshift(registro);
  escribirTodo(todos);
  guardarDiagnosticoFirebase(registro).catch(() => { /* fail-soft: el dato ya está en localStorage */ });
  return registro;
};

export const obtenerDiagnosticoCurso = (cursoId, anoEscolar) =>
  leerTodo().find((item) => String(item.cursoId) === String(cursoId) && item.anoEscolar === anoEscolar) || null;

// Trae los diagnósticos de Firestore y los fusiona en el cache local, para que
// el docente vea su trabajo en cualquier dispositivo. En conflicto por mismo id,
// gana el de fecha de actualización más reciente. Llamar al abrir el módulo.
// Devuelve el listado fusionado. No-op silencioso si no hay sesión Firebase.
export const sincronizarDiagnosticos = async () => {
  if (!firebaseDisponible()) return leerTodo();
  let remotos;
  try { remotos = await listarDiagnosticosFirebase(); } catch { return leerTodo(); }
  const locales = leerTodo();
  const porId = new Map();
  for (const item of [...locales, ...remotos]) {
    if (!item?.id) continue;
    const previo = porId.get(item.id);
    if (!previo || (item.actualizadoEn || "") > (previo.actualizadoEn || "")) porId.set(item.id, item);
  }
  const fusionados = [...porId.values()].sort((a, b) => (b.actualizadoEn || "").localeCompare(a.actualizadoEn || ""));
  escribirTodo(fusionados);
  return fusionados;
};

export const resumirDiagnostico = ({ estudiantes = [], aprendizajes = [], resultados = {}, mediaciones = {} }) => {
  const conteo = Object.fromEntries(NIVELES_DIAGNOSTICO.map((nivel) => [nivel.id, 0]));
  const nivelesInforme = { elemental: 0, aceptable: 0, satisfactorio: 0 };
  const brechas = aprendizajes.map((aprendizaje, indice) => {
    const valores = estudiantes
      .map((estudiante) => resultados[estudiante.id]?.[indice])
      .filter(Boolean);
    valores.forEach((valor) => {
      if (conteo[valor] !== undefined) conteo[valor] += 1;
      const consolidado = NIVELES_DIAGNOSTICO.find((nivel) => nivel.id === valor)?.informe;
      if (consolidado) nivelesInforme[consolidado] += 1;
    });
    const conApoyo = valores.filter((valor) => valor === "requiere_apoyo" || valor === "en_proceso").length;
    const recuperadosConAyuda = estudiantes.filter((estudiante) => {
      const nivel = resultados[estudiante.id]?.[indice];
      const mediacion = mediaciones[estudiante.id]?.[indice];
      return (nivel === "logrado" || nivel === "avanzado") && (mediacion === "con_pista" || mediacion === "con_ejemplo");
    }).length;
    const brechaPersistente = estudiantes.filter((estudiante) => {
      const nivel = resultados[estudiante.id]?.[indice];
      const mediacion = mediaciones[estudiante.id]?.[indice];
      return (nivel === "requiere_apoyo" || nivel === "en_proceso") && (mediacion === "apoyo_constante" || mediacion === "sin_evidencia");
    }).length;
    return {
      aprendizaje,
      evaluados: valores.length,
      conApoyo,
      recuperadosConAyuda,
      brechaPersistente,
      porcentajeApoyo: valores.length ? Math.round((conApoyo / valores.length) * 100) : 0,
    };
  }).sort((a, b) => b.porcentajeApoyo - a.porcentajeApoyo);
  const totalCeldas = Object.values(conteo).reduce((suma, valor) => suma + valor, 0);
  const estudiantesCompletos = estudiantes.filter((estudiante) =>
    aprendizajes.length > 0 && aprendizajes.every((_, indice) => resultados[estudiante.id]?.[indice])
  ).length;
  const porcentajesInforme = Object.fromEntries(Object.entries(nivelesInforme).map(([nivel, cantidad]) => [
    nivel,
    totalCeldas ? Math.round((cantidad / totalCeldas) * 100) : 0,
  ]));
  // Vista "por estudiante" (formato MINERD): cada estudiante cae en un solo
  // nivel según el promedio de sus desempeños, no por cada celda. Los umbrales
  // coinciden con los agrupamientos flexibles de la página de análisis.
  const porEstudiante = consolidarPorEstudiante({ estudiantes, aprendizajes, resultados });
  return { conteo, nivelesInforme, porcentajesInforme, porEstudiante, brechas, totalCeldas, estudiantesCompletos };
}

// Clasifica a cada estudiante en un único nivel de desempeño (elemental /
// aceptable / satisfactorio) a partir del promedio de sus niveles observados.
// Es la consolidación que usa el informe oficial del MINERD, donde el total de
// la tabla es la cantidad de estudiantes y no la de desempeños registrados.
export const consolidarPorEstudiante = ({ estudiantes = [], aprendizajes = [], resultados = {} }) => {
  const niveles = { elemental: 0, aceptable: 0, satisfactorio: 0 };
  let evaluados = 0;
  estudiantes.forEach((estudiante) => {
    const valores = aprendizajes
      .map((_, indice) => resultados[estudiante.id]?.[indice])
      .filter(Boolean)
      .map((id) => NIVELES_DIAGNOSTICO.find((nivel) => nivel.id === id)?.valor || 0);
    if (!valores.length) return;
    evaluados += 1;
    const promedio = valores.reduce((suma, valor) => suma + valor, 0) / valores.length;
    if (promedio < 1.75) niveles.elemental += 1;
    else if (promedio < 2.75) niveles.aceptable += 1;
    else niveles.satisfactorio += 1;
  });
  const porcentajes = Object.fromEntries(Object.entries(niveles).map(([nivel, cantidad]) => [
    nivel,
    evaluados ? Math.round((cantidad / evaluados) * 100) : 0,
  ]));
  return { niveles, porcentajes, evaluados };
};;
