export const crearHorarioPrimaria = () => [
  { id: `h-${Date.now()}-1`, tipo: "clase", nombre: "1ra Hora", inicio: "08:15", fin: "09:00" },
  { id: `h-${Date.now()}-2`, tipo: "clase", nombre: "2da Hora", inicio: "09:00", fin: "09:45" },
  { id: `h-${Date.now()}-3`, tipo: "clase", nombre: "3ra Hora", inicio: "09:45", fin: "10:30" },
  { id: `h-${Date.now()}-4`, tipo: "recreo", nombre: "Recreo", inicio: "10:30", fin: "11:00" },
  { id: `h-${Date.now()}-5`, tipo: "clase", nombre: "4ta Hora", inicio: "11:00", fin: "11:45" },
  { id: `h-${Date.now()}-6`, tipo: "almuerzo", nombre: "Almuerzo", inicio: "11:45", fin: "12:45" },
  { id: `h-${Date.now()}-7`, tipo: "clase", nombre: "5ta Hora", inicio: "12:45", fin: "13:30" },
  { id: `h-${Date.now()}-8`, tipo: "clase", nombre: "6ta Hora", inicio: "13:30", fin: "14:15" },
  { id: `h-${Date.now()}-9`, tipo: "recreo", nombre: "Recreo", inicio: "14:15", fin: "14:30" },
  { id: `h-${Date.now()}-10`, tipo: "clase", nombre: "7ma Hora", inicio: "14:30", fin: "15:15" },
  { id: `h-${Date.now()}-11`, tipo: "clase", nombre: "8va Hora", inicio: "15:15", fin: "16:00" },
];

export const crearHorarioSecundaria = () => [
  { id: `h-${Date.now()}-1`, tipo: "clase", nombre: "1ra Hora", inicio: "08:00", fin: "08:50" },
  { id: `h-${Date.now()}-2`, tipo: "clase", nombre: "2da Hora", inicio: "08:50", fin: "09:40" },
  { id: `h-${Date.now()}-3`, tipo: "clase", nombre: "3ra Hora", inicio: "09:40", fin: "10:30" },
  { id: `h-${Date.now()}-4`, tipo: "recreo", nombre: "Recreo", inicio: "10:30", fin: "11:00" },
  { id: `h-${Date.now()}-5`, tipo: "clase", nombre: "4ta Hora", inicio: "11:00", fin: "11:50" },
  { id: `h-${Date.now()}-6`, tipo: "almuerzo", nombre: "Almuerzo", inicio: "11:50", fin: "12:50" },
  { id: `h-${Date.now()}-7`, tipo: "clase", nombre: "5ta Hora", inicio: "12:50", fin: "13:40" },
  { id: `h-${Date.now()}-8`, tipo: "clase", nombre: "6ta Hora", inicio: "13:40", fin: "14:30" },
  { id: `h-${Date.now()}-9`, tipo: "recreo", nombre: "Recreo", inicio: "14:30", fin: "14:45" },
  { id: `h-${Date.now()}-10`, tipo: "clase", nombre: "7ma Hora", inicio: "14:45", fin: "15:35" },
  { id: `h-${Date.now()}-11`, tipo: "clase", nombre: "8va Hora", inicio: "15:35", fin: "16:25" },
];

export const crearHorarioPredeterminado = crearHorarioPrimaria;

export const crearHorarioPorJornada = (jornadaTipo, nivel) => {
  if (jornadaTipo === "Secundaria") return crearHorarioSecundaria();
  if (jornadaTipo === "Personalizada") {
    return nivel === "Secundaria" ? crearHorarioSecundaria() : crearHorarioPrimaria();
  }
  return crearHorarioPrimaria();
};

export const normalizarHorarioCurso = (horario) => {
  if (!Array.isArray(horario) || horario.length === 0) {
    return crearHorarioPrimaria();
  }

  return horario.map((bloque, indice) => ({
    id: bloque.id || `h-${Date.now()}-${indice + 1}`,
    tipo: bloque.tipo || "clase",
    nombre: bloque.nombre || `Bloque ${indice + 1}`,
    inicio: bloque.inicio || "08:00",
    fin: bloque.fin || "08:45",
  }));
};

const aMinutos = (hora) => {
  const [h, m] = String(hora || "00:00").split(":").map((n) => Number(n));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
};

export const calcularResumenHorario = (horario, duracion) => {
  const normalizado = normalizarHorarioCurso(horario);
  const bloquesClase = normalizado.filter((b) => b.tipo === "clase");
  const minutosPorDia = bloquesClase.reduce((acum, bloque) => {
    const minutos = Math.max(0, aMinutos(bloque.fin) - aMinutos(bloque.inicio));
    return acum + minutos;
  }, 0);

  const semanas = Number(String(duracion || "").match(/\d+/)?.[0] || 1);
  const encuentrosPorSemana = bloquesClase.length * 5;
  const encuentrosEstimados = bloquesClase.length * semanas;
  const tiempoTotalMinutos = minutosPorDia * semanas;
  const duracionBloques = bloquesClase.map((bloque) => ({
    nombre: bloque.nombre,
    minutos: Math.max(0, aMinutos(bloque.fin) - aMinutos(bloque.inicio)),
  }));

  return {
    bloquesClasePorDia: bloquesClase.length,
    encuentrosPorSemana,
    encuentrosEstimados,
    tiempoTotalMinutos,
    duracionBloques,
  };
};
