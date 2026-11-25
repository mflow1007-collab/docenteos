import { normalizarHorarioCurso, crearHorarioPorJornada } from "./horarioCurso.js";
import { idEstudiante } from "./idEstudiante.js";

function enriquecerCursoInicial(curso, indice = 0) {
  const ahora = Date.now();
  const accesoSemilla = new Date(ahora - (indice * 24 * 60 * 60 * 1000)).toISOString();
  const estudiantesDetalle = Array.isArray(curso.estudiantesDetalle) ? curso.estudiantesDetalle : [];
  const jornadaTipo = curso.jornadaTipo || (curso.nivel === "Secundaria" ? "Secundaria" : "Primaria");
  const horario = normalizarHorarioCurso(curso.horario || crearHorarioPorJornada(jornadaTipo, curso.nivel));
  const resumenGrado = estudiantesDetalle.reduce(
    (acum, estudiante) => {
      if (estudiante.promedio >= 90) acum.excelente += 1;
      else if (estudiante.promedio >= 70) acum.bueno += 1;
      else if (estudiante.promedio >= 60) acum.regular += 1;
      else acum.riesgo += 1;
      return acum;
    },
    { excelente: 0, bueno: 0, regular: 0, riesgo: 0 }
  );

  return {
    ...curso,
    estudiantesDetalle,
    jornadaTipo,
    horario,
    resumenGrado,
    ultimoAcceso: curso.ultimoAcceso || curso.fechaUltimoAcceso || curso.ultimoUso || accesoSemilla,
  };
}

function aplicarRegistroACurso(curso, registro) {
  if (!registro) return curso;
  const estudiantesDetalle = (Array.isArray(curso.estudiantesDetalle) ? curso.estudiantesDetalle : []).map((estudiante, indice) => {
    // Mismo ID que usa el Registro (regla única); antes fallaba sin `id`
    const notas = registro.notasEstudiantes?.[idEstudiante(estudiante, indice)];
    if (!notas?.competencias) return estudiante;
    const finales = notas.competencias.flatMap((comp) =>
      (comp.periodos || []).map((periodo) => {
        const p = Number(periodo.p) || 0;
        const rp = Number(periodo.rp) || 0;
        return p >= 70 ? p : rp > 0 ? rp : p;
      })
    ).filter((valor) => valor > 0);
    if (!finales.length) return estudiante;
    return {
      ...estudiante,
      promedio: Math.round(finales.reduce((total, valor) => total + valor, 0) / finales.length),
    };
  });
  const promedios = estudiantesDetalle.map((est) => est.promedio).filter((valor) => typeof valor === "number" && !Number.isNaN(valor));
  const promedio = promedios.length
    ? Math.round(promedios.reduce((total, valor) => total + valor, 0) / promedios.length)
    : curso.promedio;

  return enriquecerCursoInicial({
    ...curso,
    estudiantesDetalle,
    estudiantes: estudiantesDetalle.length || curso.estudiantes,
    promedio,
    resumenRegistro: registro.resumenEvaluacionesInstrumentos || null,
  });
}

export { enriquecerCursoInicial, aplicarRegistroACurso };
