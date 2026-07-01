import { normalizarHorarioCurso, crearHorarioPorJornada } from "./horarioCurso.js";

const NOMBRES_DEMO = [
  "Ana García","Carlos Pérez","María López","José Rodríguez","Carmen Martínez",
  "Luis Santos","Rosa Reyes","Pedro Díaz","Isabel Fernández","Miguel Moreno",
  "Lucía Jiménez","Andrés Torres","Sofía Ruiz","Diego Vargas","Paula Romero",
  "Valentina Cruz","Ricardo Flores","Daniela Mendoza","Alejandro Herrera","Natalia Suárez",
  "Fernando Medina","Laura Guerrero","Sebastián Molina","Camila Morales","Emilio Vega",
  "Diana Ramos","Ernesto Silva","Paola Cortés","Manuel Ortega","Elena Castillo",
];

function generarNombreEstudiante(_curso, indice) {
  return NOMBRES_DEMO[indice % NOMBRES_DEMO.length];
}

function generarEstudiantesDetalle(curso) {
  const total = curso.estudiantes ?? 0;
  const promedio = curso.promedio ?? 0;
  const riesgoBase = curso.enRiesgo?.length ?? 0;
  const destacadosBase = curso.destacados?.filter((est) => est.promedio >= 90).length ?? 0;

  const conteoExcelente = Math.max(
    destacadosBase,
    Math.min(total, Math.round(total * (promedio >= 90 ? 0.42 : promedio >= 85 ? 0.3 : promedio >= 75 ? 0.18 : 0.1)))
  );
  const conteoBueno = Math.min(
    total - conteoExcelente,
    Math.max(0, Math.round(total * (promedio >= 90 ? 0.38 : promedio >= 80 ? 0.46 : 0.44)))
  );
  const conteoRegular = Math.max(0, Math.round(total * (promedio >= 80 ? 0.14 : promedio >= 70 ? 0.24 : 0.3)));
  const conteoRiesgo = Math.max(riesgoBase, total - conteoExcelente - conteoBueno - conteoRegular);

  const ajustarConteos = () => {
    const suma = conteoExcelente + conteoBueno + conteoRegular + conteoRiesgo;
    if (suma === total) return { excelente: conteoExcelente, bueno: conteoBueno, regular: conteoRegular, riesgo: conteoRiesgo };
    const diferencia = total - suma;
    return {
      excelente: conteoExcelente + (diferencia > 0 ? diferencia : 0),
      bueno: conteoBueno,
      regular: conteoRegular,
      riesgo: conteoRiesgo + (diferencia < 0 ? diferencia : 0),
    };
  };

  const conteos = ajustarConteos();
  const estudiantes = [];
  const destacados = curso.destacados ?? [];
  const enRiesgo = curso.enRiesgo ?? [];

  const tomarNombre = (listaBase, indice, fallbackIndice) => listaBase[indice]?.nombre || generarNombreEstudiante(curso, fallbackIndice);

  for (let indice = 0; indice < conteos.excelente; indice += 1) {
    const nombre = tomarNombre(destacados.filter((est) => est.promedio >= 90), indice, estudiantes.length);
    estudiantes.push({ nombre, promedio: 94 - (indice % 3) * 2 });
  }

  for (let indice = 0; indice < conteos.bueno; indice += 1) {
    const seleccionado = destacados.filter((est) => est.promedio < 90 && est.promedio >= 70);
    const nombre = tomarNombre(seleccionado, indice, estudiantes.length);
    estudiantes.push({ nombre, promedio: 82 - (indice % 4) });
  }

  for (let indice = 0; indice < conteos.regular; indice += 1) {
    const nombre = generarNombreEstudiante(curso, estudiantes.length);
    estudiantes.push({ nombre, promedio: 66 - (indice % 4) });
  }

  for (let indice = 0; indice < conteos.riesgo; indice += 1) {
    const nombre = enRiesgo[indice]?.nombre || generarNombreEstudiante(curso, estudiantes.length);
    estudiantes.push({ nombre, promedio: Math.max(48, 58 - indice) });
  }

  return estudiantes.slice(0, total);
}

function enriquecerCursoInicial(curso, indice = 0) {
  const ahora = Date.now();
  const accesoSemilla = new Date(ahora - (indice * 24 * 60 * 60 * 1000)).toISOString();
  const estudiantesDetalle = curso.estudiantesDetalle?.length ? curso.estudiantesDetalle : generarEstudiantesDetalle(curso);
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
  const estudiantesDetalle = (curso.estudiantesDetalle?.length ? curso.estudiantesDetalle : generarEstudiantesDetalle(curso)).map((estudiante) => {
    const notas = registro.notasEstudiantes?.[estudiante.id];
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

export { NOMBRES_DEMO, generarNombreEstudiante, generarEstudiantesDetalle, enriquecerCursoInicial, aplicarRegistroACurso };
