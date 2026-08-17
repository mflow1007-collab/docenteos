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

const leerTodo = () => {
  try {
    const datos = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(datos) ? datos : [];
  } catch {
    return [];
  }
};

export const listarDiagnosticos = () => leerTodo();

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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  return registro;
};

export const obtenerDiagnosticoCurso = (cursoId, anoEscolar) =>
  leerTodo().find((item) => String(item.cursoId) === String(cursoId) && item.anoEscolar === anoEscolar) || null;

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
  return { conteo, nivelesInforme, porcentajesInforme, brechas, totalCeldas, estudiantesCompletos };
};
