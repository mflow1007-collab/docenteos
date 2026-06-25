import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { guardarHorarioCurso, guardarPlanificacion } from "./firebase";
import { cerrarSesion } from "./auth";
import PlanificacionPage from "./pages/PlanificacionPage";
import InstrumentosPage from "./pages/InstrumentosPage";
import RegistroPage from "./RegistroPage";
import CurriculumImportPage from "./pages/CurriculumImportPage";
import { crearHorarioPorJornada, crearHorarioPredeterminado, normalizarHorarioCurso } from "./utils/horarioCurso";

const initialCursos = [
  {
    id: "curso-1",
    nombre: "2do Secundaria A",
    area: "Matemática",
    nivel: "Secundaria",
    estudiantes: 32,
    promedio: 84,
    pendientes: 1,
    proximaClase: "Hoy 08:00",
    icono: "∑",
    acento: "#2563eb",
    temaActual: "Funciones lineales",
    historialPromedio: [72, 74, 76, 78, 79, 81, 83, 84],
    flujo: [
      { etapa: "Planificación", estado: "completado", detalle: "Unidad 4 lista" },
      { etapa: "Actividad", estado: "completado", detalle: "3 actividades" },
      { etapa: "Instrumento", estado: "en-curso", detalle: "Rúbrica en uso" },
      { etapa: "Evaluación", estado: "pendiente", detalle: "1 por aplicar" },
      { etapa: "Registro", estado: "pendiente", detalle: "—" },
      { etapa: "Reporte", estado: "pendiente", detalle: "—" },
    ],
    enRiesgo: [
      { nombre: "Fernanda Lozano", promedio: 64 },
      { nombre: "Gabriel Ortiz", promedio: 58 },
    ],
    resumenRapido: { instrumentos: 3, evaluaciones: 12, enRiesgo: 2 },
    destacados: [
      { nombre: "Katherin Romero", promedio: 92, estado: "Al día" },
      { nombre: "Carlos Méndez", promedio: 88, estado: "Al día" },
      { nombre: "Diana Suárez", promedio: 81, estado: "Regular" },
    ],
    instrumentosRecientes: [
      { nombre: "Rúbrica", contexto: "Funciones lineales", estado: "En uso" },
      { nombre: "Lista de cotejo", contexto: "Tarea 3", estado: "Lista" },
      { nombre: "Examen Unidad 4", contexto: "", estado: "Borrador" },
    ],
  },
  {
    id: "curso-2",
    nombre: "1ro Secundaria B",
    area: "Lengua",
    nivel: "Secundaria",
    estudiantes: 28,
    promedio: 78,
    pendientes: 0,
    proximaClase: "Hoy 10:00",
    icono: "A",
    acento: "#7c3aed",
    temaActual: "Texto argumentativo",
    historialPromedio: [70, 71, 72, 73, 74, 76, 77, 78],
    flujo: [
      { etapa: "Planificación", estado: "completado", detalle: "Secuencia lista" },
      { etapa: "Actividad", estado: "completado", detalle: "2 actividades" },
      { etapa: "Instrumento", estado: "en-curso", detalle: "Lista de cotejo" },
      { etapa: "Evaluación", estado: "pendiente", detalle: "Sin pendientes" },
      { etapa: "Registro", estado: "pendiente", detalle: "—" },
      { etapa: "Reporte", estado: "pendiente", detalle: "—" },
    ],
    enRiesgo: [{ nombre: "María Almonte", promedio: 66 }],
    resumenRapido: { instrumentos: 2, evaluaciones: 9, enRiesgo: 1 },
    destacados: [
      { nombre: "Luis Santana", promedio: 90, estado: "Al día" },
      { nombre: "Rosa Pichardo", promedio: 86, estado: "Al día" },
    ],
    instrumentosRecientes: [
      { nombre: "Lista de cotejo", contexto: "Debate", estado: "En uso" },
      { nombre: "Rúbrica", contexto: "Ensayo", estado: "Lista" },
    ],
  },
  {
    id: "curso-3",
    nombre: "6to Primaria",
    area: "Ciencias Nat.",
    nivel: "Primaria",
    estudiantes: 25,
    promedio: 91,
    pendientes: 2,
    proximaClase: "Hoy 13:00",
    icono: "⚗",
    acento: "#16a34a",
    temaActual: "Ecosistemas",
    historialPromedio: [83, 84, 85, 86, 87, 89, 90, 91],
    flujo: [
      { etapa: "Planificación", estado: "completado", detalle: "Unidad 3 lista" },
      { etapa: "Actividad", estado: "completado", detalle: "4 actividades" },
      { etapa: "Instrumento", estado: "en-curso", detalle: "Rúbrica de proyecto" },
      { etapa: "Evaluación", estado: "pendiente", detalle: "2 por aplicar" },
      { etapa: "Registro", estado: "pendiente", detalle: "—" },
      { etapa: "Reporte", estado: "pendiente", detalle: "—" },
    ],
    enRiesgo: [{ nombre: "Pedro Ruiz", promedio: 67 }],
    resumenRapido: { instrumentos: 4, evaluaciones: 11, enRiesgo: 1 },
    destacados: [
      { nombre: "Noemí Díaz", promedio: 95, estado: "Al día" },
      { nombre: "Diego Peralta", promedio: 89, estado: "Al día" },
    ],
    instrumentosRecientes: [
      { nombre: "Rúbrica", contexto: "Proyecto ecosistema", estado: "En uso" },
      { nombre: "Lista de cotejo", contexto: "Práctica 2", estado: "Lista" },
    ],
  },
  {
    id: "curso-4",
    nombre: "3ro Secundaria A",
    area: "Física",
    nivel: "Secundaria",
    estudiantes: 30,
    promedio: 69,
    pendientes: 3,
    proximaClase: "Mañana 09:00",
    icono: "Φ",
    acento: "#ef4444",
    temaActual: "Movimiento rectilíneo",
    historialPromedio: [64, 65, 66, 66, 67, 68, 69, 69],
    flujo: [
      { etapa: "Planificación", estado: "completado", detalle: "Unidad en revisión" },
      { etapa: "Actividad", estado: "completado", detalle: "2 actividades" },
      { etapa: "Instrumento", estado: "en-curso", detalle: "Examen diagnóstico" },
      { etapa: "Evaluación", estado: "pendiente", detalle: "3 por aplicar" },
      { etapa: "Registro", estado: "pendiente", detalle: "—" },
      { etapa: "Reporte", estado: "pendiente", detalle: "—" },
    ],
    enRiesgo: [
      { nombre: "Samuel Torres", promedio: 55 },
      { nombre: "Ruth Encarnación", promedio: 61 },
      { nombre: "Brayan Gómez", promedio: 63 },
    ],
    resumenRapido: { instrumentos: 3, evaluaciones: 10, enRiesgo: 3 },
    destacados: [
      { nombre: "Camila Rojas", promedio: 87, estado: "Al día" },
      { nombre: "Javier Ureña", promedio: 82, estado: "Regular" },
    ],
    instrumentosRecientes: [
      { nombre: "Examen", contexto: "Movimiento rectilíneo", estado: "Borrador" },
      { nombre: "Rúbrica", contexto: "Laboratorio", estado: "En uso" },
    ],
  },
  {
    id: "curso-5",
    nombre: "5to Primaria",
    area: "Matemática",
    nivel: "Primaria",
    estudiantes: 24,
    promedio: 88,
    pendientes: 0,
    proximaClase: "Lun 08:00",
    icono: "π",
    acento: "#0ea5e9",
    temaActual: "Fracciones",
    historialPromedio: [81, 82, 83, 84, 85, 86, 87, 88],
    flujo: [
      { etapa: "Planificación", estado: "completado", detalle: "Unidad 2 lista" },
      { etapa: "Actividad", estado: "completado", detalle: "3 actividades" },
      { etapa: "Instrumento", estado: "en-curso", detalle: "Lista de cotejo" },
      { etapa: "Evaluación", estado: "pendiente", detalle: "Sin pendientes" },
      { etapa: "Registro", estado: "pendiente", detalle: "—" },
      { etapa: "Reporte", estado: "pendiente", detalle: "—" },
    ],
    enRiesgo: [],
    resumenRapido: { instrumentos: 2, evaluaciones: 8, enRiesgo: 0 },
    destacados: [
      { nombre: "Elena Arias", promedio: 93, estado: "Al día" },
      { nombre: "Miguel Rijo", promedio: 89, estado: "Al día" },
    ],
    instrumentosRecientes: [
      { nombre: "Lista de cotejo", contexto: "Fracciones", estado: "En uso" },
    ],
  },
  {
    id: "curso-6",
    nombre: "4to Secundaria C",
    area: "Historia",
    nivel: "Secundaria",
    estudiantes: 27,
    promedio: 73,
    pendientes: 1,
    proximaClase: "Lun 11:00",
    icono: "⌛",
    acento: "#f59e0b",
    temaActual: "Independencia dominicana",
    historialPromedio: [69, 69, 70, 71, 71, 72, 72, 73],
    flujo: [
      { etapa: "Planificación", estado: "completado", detalle: "Unidad 5 lista" },
      { etapa: "Actividad", estado: "completado", detalle: "2 actividades" },
      { etapa: "Instrumento", estado: "en-curso", detalle: "Rúbrica de exposición" },
      { etapa: "Evaluación", estado: "pendiente", detalle: "1 por aplicar" },
      { etapa: "Registro", estado: "pendiente", detalle: "—" },
      { etapa: "Reporte", estado: "pendiente", detalle: "—" },
    ],
    enRiesgo: [{ nombre: "Karen Mejía", promedio: 62 }],
    resumenRapido: { instrumentos: 3, evaluaciones: 11, enRiesgo: 1 },
    destacados: [
      { nombre: "Pedro Linares", promedio: 90, estado: "Al día" },
      { nombre: "Jade Núñez", promedio: 84, estado: "Regular" },
    ],
    instrumentosRecientes: [
      { nombre: "Rúbrica", contexto: "Exposición", estado: "En uso" },
      { nombre: "Examen corto", contexto: "Unidad 4", estado: "Lista" },
    ],
  },
];

function generarNombreEstudiante(curso, indice) {
  return `${curso.nombre} - Estudiante ${String(indice + 1).padStart(2, "0")}`;
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

const cursosIniciales = initialCursos.map((curso, indice) => enriquecerCursoInicial(curso, indice));

export default function App() {
  const [cerrando,    setCerrando]    = useState(false)
  const [errorCierre, setErrorCierre] = useState('')

  const handleCerrarSesion = async () => {
    setErrorCierre('')
    setCerrando(true)
    try {
      await cerrarSesion()
      // onAuthStateChanged en main.jsx redirige a /login automáticamente
    } catch {
      setErrorCierre('No fue posible cerrar sesión. Intente nuevamente.')
      setCerrando(false)
    }
  }

  const [pagina, setPagina] = useState(() => {
    try {
      const guardada = localStorage.getItem("docenteos_navegacion");
      if (!guardada) return "inicio";
      const parseada = JSON.parse(guardada);
      return typeof parseada?.pagina === "string" ? parseada.pagina : "inicio";
    } catch {
      return "inicio";
    }
  });
  const [cursos, setCursos] = useState(() => {
    try {
      const guardados = localStorage.getItem("docenteos_cursos");
      if (!guardados) return cursosIniciales;
      const parseados = JSON.parse(guardados);
      return Array.isArray(parseados)
        ? parseados.map((curso, indice) => enriquecerCursoInicial(curso, indice))
        : cursosIniciales;
    } catch {
      return cursosIniciales;
    }
  });
  const [cursoSeleccionadoId, setCursoSeleccionadoId] = useState(null);
  const [cursoAEditar, setCursoAEditar] = useState(null);
  const [tabDetalleInicial, setTabDetalleInicial] = useState("Resumen");
  const [detalleEstudianteTab, setDetalleEstudianteTab] = useState(() => {
    try {
      const guardada = localStorage.getItem("docenteos_navegacion");
      if (!guardada) return "Resumen";
      const parseada = JSON.parse(guardada);
      return typeof parseada?.detalleEstudianteTab === "string" ? parseada.detalleEstudianteTab : "Resumen";
    } catch {
      return "Resumen";
    }
  });
  const [estudianteDetalle, setEstudianteDetalle] = useState(() => {
    try {
      const guardada = localStorage.getItem("docenteos_navegacion");
      if (!guardada) return null;
      const parseada = JSON.parse(guardada);
      return parseada?.estudianteDetalle && typeof parseada.estudianteDetalle === "object"
        ? parseada.estudianteDetalle
        : null;
    } catch {
      return null;
    }
  });

  const abrirDetalleCurso = (curso) => {
    if (!curso) return;
    const fechaAcceso = new Date().toISOString();
    setCursos((prev) => prev.map((item) => (item.id === curso.id ? { ...item, ultimoAcceso: fechaAcceso } : item)));
    setCursoSeleccionadoId(curso.id);
    setTabDetalleInicial("Resumen");
    setPagina("detalle-curso");
  };

  const solicitarEdicionCurso = (curso) => {
    setCursoAEditar(curso);
    setPagina("cursos");
  };

  const crearCurso = (nuevoCurso) => {
    setCursos((prev) => [nuevoCurso, ...prev]);
  };

  const abrirHorarioCurso = (cursoId) => {
    setCursoSeleccionadoId(cursoId);
    setTabDetalleInicial("Horario");
    setPagina("detalle-curso");
  };

  const actualizarCurso = (cursoActualizado) => {
    setCursos((prev) => prev.map((curso) => (curso.id === cursoActualizado.id ? cursoActualizado : curso)));
    if (cursoSeleccionadoId === cursoActualizado.id) {
      setCursoSeleccionadoId(cursoActualizado.id);
    }
  };

  const eliminarCurso = (idCurso) => {
    setCursos((prev) => prev.filter((curso) => curso.id !== idCurso));
    if (cursoSeleccionadoId === idCurso) {
      setPagina("cursos");
      setCursoSeleccionadoId(null);
    }
  };

  const abrirDetalleEstudiante = (estudiante) => {
    if (!estudiante) return;
    setEstudianteDetalle(estudiante);
    setPagina("detalle-estudiante");
  };

  const volverAEstudiantes = () => {
    setPagina("estudiantes");
  };

  const cursoSeleccionado =
    cursos.find((curso) => curso.id === cursoSeleccionadoId) || null;

  useEffect(() => {
    localStorage.setItem("docenteos_cursos", JSON.stringify(cursos));
  }, [cursos]);

  useEffect(() => {
    if (pagina === "detalle-estudiante" && !estudianteDetalle) {
      setPagina("estudiantes");
    }
  }, [pagina, estudianteDetalle]);

  useEffect(() => {
    const payload = {
      pagina,
      estudianteDetalle: pagina === "detalle-estudiante" ? estudianteDetalle : null,
      detalleEstudianteTab: pagina === "detalle-estudiante" ? detalleEstudianteTab : "Resumen",
    };
    localStorage.setItem("docenteos_navegacion", JSON.stringify(payload));
  }, [pagina, estudianteDetalle, detalleEstudianteTab]);

  const menu = [
    ["inicio", "🏠 Inicio"],
    ["planificacion", "📝 Planificación"],
    ["cursos", "📘 Cursos"],
    ["estudiantes", "👥 Estudiantes"],
    ["instrumentos", "📋 Instrumentos"],
    ["registro", "📝 Registro"],
    ["reportes", "📊 Reportes"],
    ["ia", "✨ IA"],
    ["curriculo", "📖 Currículo"],
    ["configuracion", "⚙️ Configuración"],
  ];

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          🎓 <span>Docente<span>OS</span></span>
        </div>

        <nav>
          {menu.map(([id, label]) => (
            <button
              key={id}
              className={pagina === id ? "active" : ""}
              onClick={() => setPagina(id)}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="profile">
            <div className="avatar">CM</div>
            <div>
              <strong>César</strong>
              <p>Docente</p>
            </div>
          </div>
          <button
            className="sidebar-logout-btn"
            onClick={handleCerrarSesion}
            disabled={cerrando}
            aria-label="Cerrar sesión"
          >
            <span aria-hidden="true">🚪</span>
            {cerrando ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </button>
          {errorCierre && (
            <p className="sidebar-logout-error" role="alert">{errorCierre}</p>
          )}
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <input placeholder="Buscar curso..." />
          <div className="user">
            🔔 <span className="badge">3</span>
            <div className="avatar small">CM</div>
            <strong>César</strong>
          </div>
        </header>

        <section className="content">
          {pagina === "inicio" && (
            <Inicio
              cursos={cursos}
              onNuevaPlanificacion={() => setPagina("planificacion")}
              onIrA={(destino) => setPagina(destino)}
              onAbrirCurso={(cursoId) => {
                const curso = cursos.find((item) => item.id === cursoId);
                if (curso) abrirDetalleCurso(curso);
              }}
            />
          )}
          {pagina === "planificacion" && <PlanificacionPage />}
          {pagina === "cursos" && (
            <Cursos
              cursos={cursos}
              onVerCurso={abrirDetalleCurso}
              onCrearCurso={crearCurso}
              onActualizarCurso={actualizarCurso}
              onEliminarCurso={eliminarCurso}
              cursoParaEditar={cursoAEditar}
              onConsumirEdicionCurso={() => setCursoAEditar(null)}
              onConfigurarHorario={abrirHorarioCurso}
            />
          )}
          {pagina === "detalle-curso" && (
            <DetalleCurso
              key={`${cursoSeleccionado?.id || "curso"}-${tabDetalleInicial}`}
              curso={cursoSeleccionado}
              onVolver={() => setPagina("cursos")}
              onEditarCurso={solicitarEdicionCurso}
              onActualizarCurso={actualizarCurso}
              onEliminarCurso={eliminarCurso}
              initialTab={tabDetalleInicial}
            />
          )}
          {pagina === "estudiantes" && (
            <EstudiantesPage
              cursos={cursos}
              onAbrirCurso={abrirDetalleCurso}
              onAbrirPerfil={abrirDetalleEstudiante}
            />
          )}
          {pagina === "detalle-estudiante" && estudianteDetalle && (
            <EstudianteDetallePage
              estudiante={estudianteDetalle}
              onVolver={volverAEstudiantes}
              initialTab={detalleEstudianteTab}
              onTabChange={setDetalleEstudianteTab}
            />
          )}
          {pagina === "instrumentos" && <InstrumentosPage cursos={cursos} onIrA={(destino) => setPagina(destino)} />}
          {pagina === "registro" && (
            <RegistroPage
              onVolver={() => setPagina("inicio")}
              curso={cursoSeleccionado}
              estudiante={estudianteDetalle}
              estudiantesCurso={cursoSeleccionado?.estudiantesDetalle || []}
              planificaciones={[]}
              evaluaciones={[]}
            />
          )}
          {pagina === "reportes" && <Pagina titulo="Reportes" texto="Aquí veremos desempeño, riesgos, indicadores y alertas." />}
          {pagina === "ia" && <IAPro />}
          {pagina === "curriculo" && <CurriculumImportPage />}
          {pagina === "configuracion" && <Pagina titulo="Configuración" texto="Perfil docente, centro educativo y preferencias." />}
        </section>
      </main>
    </div>
  );
}

function Inicio({
  cursos = [],
  onNuevaPlanificacion = () => {},
  onIrA = () => {},
  onAbrirCurso = () => {},
}) {
  const nombreCentro = "Centro Educativo Héctor Francisco López";
  const distritoEducativo = "Distrito Educativo 02-06";
  const anioEscolar = "Año Escolar 2026-2027";

  const obtenerMarcaAcceso = (curso) => {
    const marca = curso?.ultimoAcceso || curso?.fechaUltimoAcceso || curso?.ultimoUso;
    const timestamp = Date.parse(marca || "");
    return Number.isNaN(timestamp) ? 0 : timestamp;
  };

  const obtenerMarcaActividad = (curso) => {
    const marcaActividad = curso?.ultimaActividad || curso?.fechaUltimaActividad || curso?.updatedAt || curso?.fechaActualizacion;
    const timestampActividad = Date.parse(marcaActividad || "");

    if (!Number.isNaN(timestampActividad)) {
      return timestampActividad;
    }

    const evaluaciones = curso?.resumenRapido?.evaluaciones || 0;
    const instrumentos = curso?.instrumentosRecientes?.length || 0;
    const flujo = curso?.flujo?.length || 0;
    return evaluaciones * 1000 + instrumentos * 100 + flujo * 10 + (curso?.pendientes || 0);
  };

  const esCursoActivo = (curso) => (curso?.temaActual || "").trim().length > 0;

  const puntajeUsoCurso = (curso) => {
    const evaluaciones = curso?.resumenRapido?.evaluaciones || 0;
    const instrumentos = curso?.instrumentosRecientes?.length || 0;
    const estudiantes = curso?.estudiantes || 0;
    return evaluaciones * 8 + instrumentos * 6 + estudiantes + (curso?.promedio || 0);
  };

  const cursosPorUsoReciente = [...cursos].sort((a, b) => {
    const diferenciaAcceso = obtenerMarcaAcceso(b) - obtenerMarcaAcceso(a);
    if (diferenciaAcceso !== 0) return diferenciaAcceso;

    const diferenciaActividad = obtenerMarcaActividad(b) - obtenerMarcaActividad(a);
    if (diferenciaActividad !== 0) return diferenciaActividad;

    const diferenciaActivos = Number(esCursoActivo(b)) - Number(esCursoActivo(a));
    if (diferenciaActivos !== 0) return diferenciaActivos;

    const diferenciaUso = puntajeUsoCurso(b) - puntajeUsoCurso(a);
    if (diferenciaUso !== 0) return diferenciaUso;

    return (b.pendientes || 0) - (a.pendientes || 0);
  });

  const cursosPorPendientes = [...cursos].sort((a, b) => (b.pendientes || 0) - (a.pendientes || 0));
  const misCursos = cursosPorUsoReciente.slice(0, 4);
  const totalPendientes = cursos.reduce((acum, curso) => acum + (curso.pendientes || 0), 0);
  const estudiantesEnRiesgo = cursos.reduce((acum, curso) => acum + (curso.enRiesgo?.length || 0), 0);
  const promedioGlobal = cursos.length > 0
    ? Math.round(cursos.reduce((acum, curso) => acum + (curso.promedio || 0), 0) / cursos.length)
    : 0;
  const totalEstudiantes = cursos.reduce((acum, curso) => acum + (curso.estudiantes || 0), 0);
  const secuenciasActivas = cursos.filter((curso) => (curso.temaActual || "").trim().length > 0).length;
  const instrumentosCreados = cursos.reduce((acum, curso) => acum + (curso.instrumentosRecientes?.length || 0), 0);
  const evaluacionesCompletadas = Math.max(
    0,
    cursos.reduce((acum, curso) => acum + ((curso.resumenRapido?.evaluaciones || 0) - (curso.pendientes || 0)), 0)
  );
  const cursoReferenciaProxima = cursos.find((curso) => curso.nombre === "1ro Secundaria B");
  const proximaClaseBase = cursosPorUsoReciente[0]?.proximaClase || "Sin clases programadas";
  const proximaClaseConPeriodo = /\b(AM|PM)\b/i.test(proximaClaseBase)
    ? proximaClaseBase
    : proximaClaseBase.replace(/(\d{1,2}:\d{2})/, "$1 AM");
  const proximaClaseNormalizada = proximaClaseConPeriodo.replace(/\b0(\d:\d{2}\s?(?:AM|PM))/i, "$1");
  const proximaClase = cursoReferenciaProxima ? "Hoy 8:00 AM" : proximaClaseNormalizada;
  const cursoProximaClase = cursoReferenciaProxima?.nombre || cursosPorUsoReciente[0]?.nombre || "Sin curso asignado";

  const estadoCurso = (curso) => {
    const riesgoCurso = curso.enRiesgo?.length || 0;
    const pendientes = curso.pendientes || 0;

    if (riesgoCurso >= 3 || (riesgoCurso >= 2 && pendientes >= 2)) {
      return { etiqueta: "Requiere atención", clase: "estado-riesgo" };
    }

    if (riesgoCurso >= 1 || pendientes > 0) {
      return { etiqueta: "Pendiente", clase: "estado-pendiente" };
    }

    return { etiqueta: "Al día", clase: "estado-ok" };
  };

  const estadoVisualCurso = (curso) => {
    const estadoBase = estadoCurso(curso);
    if (estadoBase.clase === "estado-riesgo") return { ...estadoBase, icono: "riesgo" };
    if (estadoBase.clase === "estado-pendiente") return { ...estadoBase, icono: "pendiente" };
    return { ...estadoBase, icono: "ok" };
  };

  const ultimoAccesoTexto = (curso) => {
    const marca = curso?.ultimoAcceso || curso?.fechaUltimoAcceso || curso?.ultimoUso;
    const timestamp = Date.parse(marca || "");

    if (Number.isNaN(timestamp)) {
      return marca && typeof marca === "string" ? marca : "Sin registro";
    }

    const fecha = new Date(timestamp);
    const hoy = new Date();
    const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime();
    const inicioAyer = inicioHoy - 24 * 60 * 60 * 1000;

    if (timestamp >= inicioHoy) return "Hoy";
    if (timestamp >= inicioAyer) return "Ayer";

    return fecha.toLocaleDateString("es-DO", { day: "2-digit", month: "short" });
  };

  const claseMateria = (area = "") => {
    const texto = area.toLowerCase();
    if (texto.includes("mat")) return "materia-matematica";
    if (texto.includes("leng")) return "materia-lengua";
    if (texto.includes("fís") || texto.includes("fis")) return "materia-fisica";
    if (texto.includes("ciencias") || texto.includes("nat")) return "materia-ciencias";
    if (texto.includes("hist")) return "materia-historia";
    return "materia-default";
  };

  const totalPlanificacionesPendientes = cursosPorPendientes.filter((curso) => (curso.pendientes || 0) > 0).length;
  const totalInstrumentosSinCompletar = cursos.filter((curso) => (curso.instrumentosRecientes?.length || 0) === 0).length;

  const pendientesResumen = [
    {
      id: "planificaciones",
      titulo: "Planificaciones pendientes",
      valor: totalPlanificacionesPendientes,
      estado: totalPlanificacionesPendientes > 0 ? "pendiente" : "ok",
      tono: "planificaciones",
      icono: "📄",
      etiquetaEstado: "Prioridad media",
      accion: () => onIrA("planificacion"),
    },
    {
      id: "evaluaciones",
      titulo: "Evaluaciones pendientes",
      valor: totalPendientes,
      estado: totalPendientes > 3 ? "riesgo" : totalPendientes > 0 ? "pendiente" : "ok",
      tono: "evaluaciones",
      icono: "🧾",
      etiquetaEstado: "Acción requerida",
      accion: () => onIrA("registro"),
    },
    {
      id: "instrumentos",
      titulo: "Instrumentos sin completar",
      valor: totalInstrumentosSinCompletar,
      estado: totalInstrumentosSinCompletar > 0 ? "pendiente" : "ok",
      tono: "instrumentos",
      icono: "🧪",
      etiquetaEstado: "Al día",
      accion: () => onIrA("instrumentos"),
    },
    {
      id: "riesgo",
      titulo: "Estudiantes en riesgo",
      valor: estudiantesEnRiesgo,
      estado: estudiantesEnRiesgo > 0 ? "riesgo" : "ok",
      tono: "riesgo",
      icono: "🚨",
      etiquetaEstado: "Atención inmediata",
      accion: () => onIrA("reportes"),
    },
  ];

  const historialReciente = useMemo(() => {
    try {
      const guardadas = JSON.parse(localStorage.getItem("docenteos_planificaciones_guardadas") || "[]");
      if (!Array.isArray(guardadas)) return [];

      return [...guardadas]
        .reverse()
        .slice(0, 5)
        .map((item, indice) => {
          const grado = item?.grado || item?.curso || "Curso";
          const seccion = item?.seccion ? ` ${item.seccion}` : "";
          const area = item?.area || "Área";
          const tipo = item?.tipoPlanificacion || "Planificación";
          const fecha = item?.fechaGuardado || item?.fecha || item?.createdAt || "Reciente";
          return {
            id: item?.id || `${grado}-${area}-${indice}`,
            titulo: `${grado}${seccion} · ${area}`,
            detalle: tipo,
            fecha: typeof fecha === "string" ? fecha : "Reciente",
          };
        });
    } catch {
      return [];
    }
  }, []);

  return (
    <div className="inicio-saas-shell">
      <div className="inicio-saludo-pro">
        <h1>👋 Buenos días, César</h1>
        <p>Aquí tienes un resumen de tu actividad académica.</p>
      </div>

      <section className="inicio-hero-pro">
        <div className="inicio-hero-copy-pro">
          <div className="inicio-hero-centro-wrap" aria-label={nombreCentro}>
            <h2 className="inicio-hero-centro" aria-hidden="true">
              <span>{nombreCentro}</span>
              <span aria-hidden="true">{nombreCentro}</span>
            </h2>
          </div>
          <p>🏛 {distritoEducativo}</p>
          <p>📅 {anioEscolar}</p>

          <article className="inicio-hero-plan-pro">
            <strong>➕ Nueva Planificación</strong>
            <p>
              Crear secuencias didácticas, unidades de aprendizaje y planificaciones
              alineadas al currículo por competencias del MINERD.
            </p>
            <button type="button" onClick={onNuevaPlanificacion}>Iniciar ahora -&gt;</button>
          </article>
        </div>

        <div className="inicio-hero-side-pro">
          <div className="inicio-kpis-grid-pro fila-uno" aria-label="Indicadores principales">
            <article className="inicio-kpi-card-pro">
              <span className="inicio-kpi-icon-pro" aria-hidden="true">👥</span>
              <strong>{totalEstudiantes}</strong>
              <small>Estudiantes</small>
            </article>
            <article className="inicio-kpi-card-pro">
              <span className="inicio-kpi-icon-pro" aria-hidden="true">📚</span>
              <strong>{secuenciasActivas}</strong>
              <small>Cursos activos</small>
            </article>
            <article className="inicio-kpi-card-pro">
              <span className="inicio-kpi-icon-pro" aria-hidden="true">📄</span>
              <strong>{instrumentosCreados}</strong>
              <small>Instrumentos</small>
            </article>
          </div>

          <div className="inicio-kpis-grid-pro fila-dos" aria-label="Indicadores de atención y agenda">
            <article className="inicio-kpi-card-pro riesgo">
              <span className="inicio-kpi-icon-pro" aria-hidden="true">⚠️</span>
              <strong>{estudiantesEnRiesgo}</strong>
              <small>Estudiantes en riesgo</small>
            </article>
            <article className="inicio-kpi-card-pro proxima-clase">
              <span className="inicio-kpi-icon-pro" aria-hidden="true">📅</span>
              <strong>{proximaClase}</strong>
              <small>Próxima clase</small>
              <em>{cursoProximaClase}</em>
            </article>
          </div>
        </div>
      </section>

      <section className="panel inicio-cursos-panel-pro">
        <div className="inicio-bloque-header-pro">
          <h2>📘 Mis cursos</h2>
        </div>
        <div className="inicio-cursos-grid-pro">
          {misCursos.length > 0 ? (
            misCursos.map((curso) => {
              const estado = estadoVisualCurso(curso);
              const pendientes = curso.pendientes || 0;
              const riesgo = curso.enRiesgo?.length || 0;
              const ultimoAcceso = ultimoAccesoTexto(curso);
              const avance = Math.max(0, Math.min(100, Math.round(curso.promedio || 0)));
              const claseAvance = avance >= 75 ? "avance-alto" : avance >= 50 ? "avance-medio" : "avance-bajo";
              const claseAcceso = ultimoAcceso === "Hoy" ? "hoy" : ultimoAcceso === "Ayer" ? "ayer" : "fecha";

              return (
                <article key={curso.id} className={`inicio-curso-card-pro ${estado.clase}`}>
                  <div className="inicio-curso-header-pro">
                    <div className="inicio-curso-head-left-pro">
                      <strong>{curso.nombre}</strong>
                      <span className={`inicio-materia-badge ${claseMateria(curso.area)}`}>{curso.area}</span>
                    </div>
                    <span className={`mis-curso-estado-badge ${estado.clase}`}>
                      <span aria-hidden="true" className="estado-dot" />
                      {estado.etiqueta}
                    </span>
                  </div>

                  <div className="inicio-curso-access-pro">
                    <span>Último acceso</span>
                    <strong className={claseAcceso}>{ultimoAcceso}</strong>
                  </div>

                  <div className="inicio-curso-insights-pro">
                    <div className={`inicio-curso-donut-wrap-pro ${claseAvance}`}>
                      <div className="inicio-curso-donut-pro" style={{ "--progress": `${avance}%` }}>
                        <span>{avance}%</span>
                      </div>
                      <small>Avance del grado</small>
                    </div>

                    <div className="inicio-curso-indicadores-pro">
                      <article className="inicio-indicador-mini-pro pendiente">
                        <strong>{pendientes}</strong>
                        <span>{pendientes === 1 ? "pendiente" : "pendientes"}</span>
                      </article>
                      <article className="inicio-indicador-mini-pro riesgo">
                        <strong>{riesgo}</strong>
                        <span>en riesgo</span>
                      </article>
                    </div>
                  </div>

                  <div className="inicio-curso-bottom-pro">
                    <button type="button" className="inicio-curso-open-btn-pro" onClick={() => onAbrirCurso(curso.id)}>Abrir curso -&gt;</button>
                  </div>
                </article>
              );
            })
          ) : (
            <p className="texto-secundario">No hay cursos activos.</p>
          )}
        </div>
        <div className="inicio-cursos-footer-pro">
          <button type="button" className="inicio-link-pro" onClick={() => onIrA("cursos")}>Ver todos los cursos -&gt;</button>
        </div>
      </section>

      <section className="panel inicio-pendientes-panel-pro">
        <div className="inicio-control-header-pro">
          <h2>📊 Centro de Control Pedagógico</h2>
          <p>Resumen inteligente de las tareas que requieren atención.</p>
        </div>

        <div className="inicio-pendientes-grid-pro">
          {pendientesResumen.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`inicio-pendiente-card-pro ${item.estado} ${item.tono}`}
              onClick={item.accion}
            >
              <span className="inicio-pendiente-icono-pro" aria-hidden="true">{item.icono}</span>
              <p>{item.valor}</p>
              <strong>{item.titulo}</strong>
              <small className="inicio-pendiente-estado-pro">● {item.etiquetaEstado}</small>
            </button>
          ))}
        </div>

        <article className="inicio-resumen-ai-pro">
          <h3>🤖 Resumen DOCENTEOS AI</h3>
          <p>
            Hoy tienes {totalPlanificacionesPendientes} planificaciones pendientes, {totalPendientes} evaluaciones por registrar y {estudiantesEnRiesgo} estudiantes que requieren seguimiento.
          </p>
          <button type="button" onClick={() => onIrA("ia")}>Ver recomendaciones</button>
        </article>
      </section>

      <section className="panel indicadores-pedagogicos">
        <h2>📊 Indicadores pedagógicos</h2>
        <div className="indicadores-grid indicadores-iconicos">
          <article className="indicador-card">
            <small>🎯 Competencias cubiertas</small>
            <strong>{Math.max(0, Math.min(100, promedioGlobal + 6))}%</strong>
            <span>Seguimiento curricular</span>
          </article>
          <article className="indicador-card">
            <small>📈 Promedio global</small>
            <strong>{promedioGlobal}%</strong>
            <span>Rendimiento general</span>
          </article>
          <article className="indicador-card">
            <small>⚠️ Estudiantes en riesgo</small>
            <strong>{estudiantesEnRiesgo}</strong>
            <span>Atención prioritaria</span>
          </article>
          <article className="indicador-card">
            <small>📚 Secuencias activas</small>
            <strong>{secuenciasActivas}</strong>
            <span>Planificación vigente</span>
          </article>
          <article className="indicador-card">
            <small>📝 Instrumentos creados</small>
            <strong>{instrumentosCreados}</strong>
            <span>Herramientas de evaluación</span>
          </article>
          <article className="indicador-card">
            <small>🏆 Evaluaciones completadas</small>
            <strong>{evaluacionesCompletadas}</strong>
            <span>Cierre evaluativo</span>
          </article>
        </div>
      </section>

      <section className="panel assistant-actions">
        <h2>⚡ Acciones rápidas</h2>
        <div className="actions">
          <Action icon="➕" title="Nuevo Curso" text="Crear curso" onClick={() => onIrA("cursos")} />
          <Action icon="🧠" title="Planificación IA" text="Generar MINERD" onClick={onNuevaPlanificacion} className="action-priority" />
          <Action icon="📋" title="Nuevo Instrumento" text="Crear instrumento" onClick={() => onIrA("instrumentos")} />
          <Action icon="✅" title="Registrar Evaluación" text="Registrar notas" onClick={() => onIrA("registro")} />
          <Action icon="📊" title="Reportes" text="Ver indicadores" onClick={() => onIrA("reportes")} />
          <Action icon="📄" title="Registro de Grado" text="Gestionar registro" onClick={() => onIrA("registro")} />
        </div>
      </section>

      <section className="panel assistant-historial">
        <h2>🕘 Historial reciente</h2>
        <div className="assistant-lista-simple">
          {historialReciente.length > 0 ? (
            historialReciente.map((item) => (
              <article key={item.id} className="assistant-list-item historial-item">
                <strong>{item.titulo}</strong>
                <p>{item.detalle}</p>
                <em>{item.fecha}</em>
                <div className="historial-item-acciones">
                  <button type="button" onClick={onNuevaPlanificacion}>Abrir</button>
                  <button type="button" onClick={onNuevaPlanificacion}>Duplicar</button>
                </div>
              </article>
            ))
          ) : (
            <p className="texto-secundario">Aún no hay planificaciones guardadas.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function Cursos({ cursos, onVerCurso, onCrearCurso, onActualizarCurso, onEliminarCurso, cursoParaEditar, onConsumirEdicionCurso, onConfigurarHorario }) {
  const [filtro, setFiltro] = useState("Todos");
  const [vista, setVista] = useState("Tarjetas");
  const [mostrarModalCurso, setMostrarModalCurso] = useState(Boolean(cursoParaEditar));
  const [cursoEnEdicion, setCursoEnEdicion] = useState(cursoParaEditar);
  const [menuAbiertoId, setMenuAbiertoId] = useState(null);
  const asignaturasBase = ["Inglés", "Francés"];
  const gradosPorNivel = {
    Primaria: ["1ro Primaria", "2do Primaria", "3ro Primaria", "4to Primaria", "5to Primaria", "6to Primaria"],
    Secundaria: ["1ro Secundaria", "2do Secundaria", "3ro Secundaria", "4to Secundaria", "5to Secundaria", "6to Secundaria"],
  };

  const crearFormCurso = (curso = null) => {
    const nivel = curso?.nivel || "Secundaria";
    return {
      nivel,
      jornadaTipo: curso?.jornadaTipo || nivel,
      grado: curso?.nombre?.split(" ").slice(0, 2).join(" ") || gradosPorNivel[nivel][0],
      area: curso?.area || asignaturasBase[0],
      seccion: curso?.seccion || (curso?.nombre?.split(" ").slice(-1)[0] || "A"),
      estudiantes: String(curso?.estudiantes || ""),
      configurarHorario: false,
    };
  };

  const [formCurso, setFormCurso] = useState(() => crearFormCurso(cursoParaEditar));

  useEffect(() => {
    if (cursoParaEditar) {
      setCursoEnEdicion(cursoParaEditar);
      setFormCurso(crearFormCurso(cursoParaEditar));
      setMostrarModalCurso(true);
    }
  }, [cursoParaEditar]);

  const totalEstudiantes = cursos.reduce((acum, curso) => acum + (curso.estudiantes || 0), 0);

  const cursosFiltrados = useMemo(() => {
    if (filtro === "Todos") return cursos;
    return cursos.filter((curso) => curso.nivel === filtro);
  }, [cursos, filtro]);

  const abrirNuevoCurso = () => {
    setCursoEnEdicion(null);
    setFormCurso(crearFormCurso(null));
    setMostrarModalCurso(true);
  };

  const abrirEdicionCurso = (curso) => {
    setCursoEnEdicion(curso);
    setFormCurso(crearFormCurso(curso));
    setMostrarModalCurso(true);
    setMenuAbiertoId(null);
  };

  const cerrarModalCurso = () => {
    setMostrarModalCurso(false);
    setCursoEnEdicion(null);
    onConsumirEdicionCurso();
  };

  const guardarCurso = () => {
    if (!formCurso.nivel || !formCurso.grado || !formCurso.area || !formCurso.seccion || !formCurso.estudiantes) return;

    const nombre = `${formCurso.grado} ${formCurso.seccion}`;
    const baseCurso = cursoEnEdicion || {};
    const estudiantes = Number(formCurso.estudiantes);
    const promedioBase = baseCurso.promedio ?? (formCurso.area === "Inglés" ? 84 : 80);
    const promedio = cursoEnEdicion ? promedioBase : Math.max(60, Math.min(96, formCurso.area === "Inglés" ? 84 : 82));
    const estudiantesDetalle = cursoEnEdicion
      ? generarEstudiantesDetalle({
          ...baseCurso,
          nombre,
          nivel: formCurso.nivel,
          area: formCurso.area,
          promedio,
          estudiantes,
          destacados: baseCurso.destacados || [],
          enRiesgo: baseCurso.enRiesgo || [],
        })
      : baseCurso.estudiantesDetalle?.length
        ? baseCurso.estudiantesDetalle
        : generarEstudiantesDetalle({
            ...(baseCurso || {}),
            nombre,
            nivel: formCurso.nivel,
            area: formCurso.area,
            promedio,
            estudiantes,
            destacados: baseCurso.destacados || [],
            enRiesgo: baseCurso.enRiesgo || [],
          });

    const nuevoCurso = {
      ...baseCurso,
      id: cursoEnEdicion?.id || `curso-${Date.now()}`,
      nombre,
      area: formCurso.area,
      nivel: formCurso.nivel,
      jornadaTipo: formCurso.jornadaTipo,
      seccion: formCurso.seccion,
      estudiantes,
      promedio,
      pendientes: baseCurso.pendientes ?? 0,
      proximaClase: baseCurso.proximaClase || "Hoy 08:00",
      icono: formCurso.area === "Inglés" ? "A" : "F",
      acento: baseCurso.acento || "#2563eb",
      temaActual: baseCurso.temaActual || "Tema por definir",
      historialPromedio: baseCurso.historialPromedio || [72, 74, 76, 78, 79, 81, 83, 84],
      flujo: baseCurso.flujo || [],
      enRiesgo: baseCurso.enRiesgo || [],
      resumenRapido: baseCurso.resumenRapido || { instrumentos: 0, evaluaciones: 0, enRiesgo: 0 },
      destacados: baseCurso.destacados || [],
      instrumentosRecientes: baseCurso.instrumentosRecientes || [],
      proximasAcciones: baseCurso.proximasAcciones || ["Configurar planificación", "Crear instrumento", "Registrar primera clase"],
      estudiantesDetalle,
      horario: normalizarHorarioCurso(
        cursoEnEdicion
          ? baseCurso.horario || crearHorarioPorJornada(formCurso.jornadaTipo, formCurso.nivel)
          : crearHorarioPorJornada(formCurso.jornadaTipo, formCurso.nivel)
      ),
    };

    const cursoFinal = enriquecerCursoInicial(nuevoCurso);
    if (cursoEnEdicion) {
      onActualizarCurso(cursoFinal);
    } else {
      onCrearCurso(cursoFinal);
      if (formCurso.configurarHorario) {
        onConfigurarHorario(cursoFinal.id);
      }
    }

    cerrarModalCurso();
  };

  const colorPromedio = (promedio) => {
    if (promedio >= 85) return "promedio-alto";
    if (promedio < 75) return "promedio-riesgo";
    return "promedio-medio";
  };

  const colorBordePromedio = (promedio) => {
    if (promedio >= 85) return "#16a34a";
    if (promedio < 75) return "#ef4444";
    return "#2563eb";
  };

  const tonoIconoCurso = (promedio) => {
    if (promedio >= 85) return "icono-promedio-alto";
    if (promedio < 75) return "icono-promedio-riesgo";
    return "icono-promedio-medio";
  };

  const claseCargaEstudiantes = (cantidad) => {
    if (cantidad >= 30) return "alta";
    if (cantidad >= 25) return "media";
    return "baja";
  };

  const asignaturasDisponibles =
    cursoEnEdicion && cursoEnEdicion.area && !asignaturasBase.includes(cursoEnEdicion.area)
      ? [cursoEnEdicion.area, ...asignaturasBase]
      : asignaturasBase;

  return (
    <div className="cursos-dashboard">
      <div className="cursos-header">
        <div>
          <h1>Cursos</h1>
          <p>{cursos.length} cursos activos · {totalEstudiantes} estudiantes en total</p>
        </div>
        <button className="btn-nuevo-curso" onClick={abrirNuevoCurso}>
          + Nuevo Curso
        </button>
      </div>

      <div className="cursos-toolbar">
        <div className="filtros-cursos">
          {["Todos", "Primaria", "Secundaria"].map((opcion) => (
            <button key={opcion} className={filtro === opcion ? "activo" : ""} onClick={() => setFiltro(opcion)}>
              {opcion}
            </button>
          ))}
        </div>

        <div className="selector-vista">
          {["Tarjetas", "Lista"].map((opcion) => (
            <button key={opcion} className={vista === opcion ? "activo" : ""} onClick={() => setVista(opcion)}>
              {opcion}
            </button>
          ))}
        </div>
      </div>

      <div key={vista} className={`cursos-grid vista-animada ${vista === "Lista" ? "lista" : "tarjetas"}`}>
        {cursosFiltrados.map((curso) => (
          <article className="curso-saas-card" key={curso.id} style={{ borderTopColor: colorBordePromedio(curso.promedio) }}>
            <div className="curso-card-main">
              <div className="curso-identidad">
                <span className={`curso-icono ${tonoIconoCurso(curso.promedio)}`}>
                  {curso.icono}
                </span>
                <div>
                  <h2>{curso.nombre}</h2>
                  <p className="curso-area">{curso.area}</p>
                </div>
              </div>

              <span className={`badge-nivel ${curso.nivel === "Primaria" ? "primaria" : "secundaria"}`}>
                {curso.nivel}
              </span>
            </div>

            <div className="curso-metricas">
              <div className={`curso-estudiantes-hero ${claseCargaEstudiantes(curso.estudiantes)}`}>
                <span>Estudiantes</span>
                <strong>{curso.estudiantes}</strong>
                <div className={`curso-miniindicador ${claseCargaEstudiantes(curso.estudiantes)}`} aria-hidden="true">
                  <span style={{ width: `${Math.min(100, Math.max(18, curso.estudiantes * 3))}%` }} />
                </div>
              </div>
              <div className={`curso-promedio-hero ${colorPromedio(curso.promedio)}`}>
                <span>Promedio</span>
                <strong className={colorPromedio(curso.promedio)}>{curso.promedio}%</strong>
              </div>
              <div><span>Pendientes</span><strong className="pendientes">{curso.pendientes}</strong></div>
              <div className={`curso-proxima-clase-hero ${curso.proximaClase.includes("Hoy") ? "hoy" : curso.proximaClase.includes("Mañana") ? "manana" : ""}`}>
                <span>Próxima clase</span>
                <strong>{curso.proximaClase}</strong>
              </div>
            </div>

            <div className="curso-card-footer">
              <div className="acciones-mini">
                <button onClick={() => onVerCurso(curso)}>Estudiantes</button>
                <button onClick={() => onVerCurso(curso)}>Instrumentos</button>
                <button onClick={() => onVerCurso(curso)}>Registro</button>
                <button onClick={() => onVerCurso(curso)}>Ver curso</button>
              </div>
              <div className="curso-menu-wrap">
                <button className="curso-menu-btn" onClick={() => setMenuAbiertoId(menuAbiertoId === curso.id ? null : curso.id)} aria-label={`Opciones de ${curso.nombre}`}>
                  ⋮
                </button>
                {menuAbiertoId === curso.id && (
                  <div className="curso-menu-popup">
                    <button onClick={() => abrirEdicionCurso(curso)}>✏️ Editar curso</button>
                    <button
                      className="danger-mini"
                      onClick={() => {
                        const confirmar = window.confirm("¿Está seguro que desea eliminar este curso?");
                        if (confirmar) onEliminarCurso(curso.id);
                        setMenuAbiertoId(null);
                      }}
                    >
                      🗑️ Eliminar curso
                    </button>
                  </div>
                )}
                <button className="flecha-curso" aria-label={`Abrir ${curso.nombre}`} onClick={() => onVerCurso(curso)}>
                  →
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {mostrarModalCurso && (
        <div className="modal-overlay" onClick={cerrarModalCurso}>
          <div className="modal-curso" onClick={(e) => e.stopPropagation()}>
            <h2>{cursoEnEdicion ? "Editar Curso" : "Nuevo Curso"}</h2>
            <div className="modal-form-grid">
              <label>
                Nivel
                <select
                  value={formCurso.nivel}
                  onChange={(e) => {
                    const nextNivel = e.target.value;
                    setFormCurso((prev) => ({
                      ...prev,
                      nivel: nextNivel,
                      jornadaTipo: prev.jornadaTipo === "Personalizada" ? "Personalizada" : nextNivel,
                      grado: gradosPorNivel[nextNivel][0],
                    }));
                  }}
                >
                  <option value="Primaria">Primaria</option>
                  <option value="Secundaria">Secundaria</option>
                </select>
              </label>

              <label>
                Tipo de Jornada
                <div className="jornada-radio-group">
                  {[
                    { value: "Primaria", label: "Primaria (45 minutos)" },
                    { value: "Secundaria", label: "Secundaria (50 minutos)" },
                    { value: "Personalizada", label: "Personalizada" },
                  ].map((opcion) => (
                    <label key={opcion.value} className="jornada-radio-option">
                      <input
                        type="radio"
                        name="jornadaTipo"
                        value={opcion.value}
                        checked={formCurso.jornadaTipo === opcion.value}
                        onChange={(e) => setFormCurso((prev) => ({ ...prev, jornadaTipo: e.target.value }))}
                      />
                      {opcion.label}
                    </label>
                  ))}
                </div>
              </label>

              <label>
                Grado
                <select value={formCurso.grado} onChange={(e) => setFormCurso((prev) => ({ ...prev, grado: e.target.value }))}>
                  {gradosPorNivel[formCurso.nivel].map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>

              <label>
                Asignatura
                <select value={formCurso.area} onChange={(e) => setFormCurso((prev) => ({ ...prev, area: e.target.value }))}>
                  {asignaturasDisponibles.map((asignatura) => (
                    <option key={asignatura} value={asignatura}>
                      {asignatura}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Sección
                <select value={formCurso.seccion} onChange={(e) => setFormCurso((prev) => ({ ...prev, seccion: e.target.value }))}>
                  {["A", "B", "C", "D"].map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>

              <label>
                Cantidad de estudiantes
                <input
                  type="number"
                  min="1"
                  value={formCurso.estudiantes}
                  onChange={(e) => setFormCurso((prev) => ({ ...prev, estudiantes: e.target.value }))}
                  placeholder="Ej: 28"
                />
              </label>

              <label className="modal-check-row">
                <input
                  type="checkbox"
                  checked={Boolean(formCurso.configurarHorario)}
                  onChange={(e) => setFormCurso((prev) => ({ ...prev, configurarHorario: e.target.checked }))}
                />
                Configurar horario
              </label>
            </div>

            <div className="modal-actions">
              <button className="modal-cancel" onClick={cerrarModalCurso}>Cancelar</button>
              <button className="modal-save" onClick={guardarCurso} disabled={!formCurso.nivel || !formCurso.grado || !formCurso.area || !formCurso.seccion || !formCurso.estudiantes}>
                Guardar curso
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetalleCurso({ curso, onVolver, onEditarCurso, onActualizarCurso, onEliminarCurso, initialTab = "Resumen" }) {
  const claveDiaHorario = `docenteos_detalle_dia_horario_${curso?.id || "curso-fallback"}`;
  const [tabActiva, setTabActiva] = useState(initialTab);
  const [busquedaEstudiante, setBusquedaEstudiante] = useState("");
  const [mostrarMenuCurso, setMostrarMenuCurso] = useState(false);
  const [mostrarModalHorarioClase, setMostrarModalHorarioClase] = useState(false);
  const [mensajeHorario, setMensajeHorario] = useState(null);

  const data = curso || {
    id: "curso-fallback",
    nombre: "2do Secundaria A",
    area: "Matemática",
    nivel: "Secundaria",
    temaActual: "Funciones lineales",
    estudiantes: 32,
    promedio: 84,
    proximaClase: "Hoy · 08:00",
    icono: "🎓",
    historialPromedio: [72, 74, 76, 78, 79, 81, 83, 84],
    flujo: [
      { etapa: "Planificación", estado: "completado", detalle: "Unidad 4 lista" },
      { etapa: "Actividad", estado: "completado", detalle: "3 actividades" },
      { etapa: "Instrumento", estado: "en-curso", detalle: "Rúbrica en uso" },
      { etapa: "Evaluación", estado: "pendiente", detalle: "1 por aplicar" },
      { etapa: "Registro", estado: "pendiente", detalle: "—" },
      { etapa: "Reporte", estado: "pendiente", detalle: "—" },
    ],
    enRiesgo: [
      { nombre: "Fernanda Lozano", promedio: 64 },
      { nombre: "Gabriel Ortiz", promedio: 58 },
    ],
    resumenRapido: { instrumentos: 3, evaluaciones: 12, enRiesgo: 2 },
    destacados: [
      { nombre: "Katherin Romero", promedio: 92, estado: "Al día" },
      { nombre: "Carlos Méndez", promedio: 88, estado: "Al día" },
      { nombre: "Diana Suárez", promedio: 81, estado: "Regular" },
      { nombre: "Eduardo Paniagua", promedio: 79, estado: "Regular" },
    ],
    instrumentosRecientes: [
      { nombre: "Rúbrica", contexto: "Funciones lineales", estado: "En uso" },
      { nombre: "Lista de cotejo", contexto: "Tarea 3", estado: "Lista" },
      { nombre: "Examen Unidad 4", contexto: "", estado: "Borrador" },
    ],
    proximasAcciones: ["Aplicar evaluación", "Registrar notas", "Generar reporte"],
  };

  const [horarioCurso, setHorarioCurso] = useState(() =>
    normalizarHorarioCurso(data.horario || crearHorarioPredeterminado())
  );

  const diasSemana = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
  const bloquesBase = [
    { etiqueta: "1ra Hora", tipo: "clase" },
    { etiqueta: "2da Hora", tipo: "clase" },
    { etiqueta: "3ra Hora", tipo: "clase" },
    { etiqueta: "Recreo", tipo: "recreo" },
    { etiqueta: "4ta Hora", tipo: "clase" },
    { etiqueta: "Almuerzo", tipo: "almuerzo" },
    { etiqueta: "5ta Hora", tipo: "clase" },
    { etiqueta: "6ta Hora", tipo: "clase" },
    { etiqueta: "Recreo", tipo: "recreo" },
    { etiqueta: "7ma Hora", tipo: "clase" },
    { etiqueta: "8va Hora", tipo: "clase" },
  ];

  const aMinutos = (hora) => {
    const [h, m] = String(hora || "00:00").split(":").map(Number);
    return (h * 60) + m;
  };

  const aHora24 = (minutos) => {
    const h = String(Math.floor(minutos / 60)).padStart(2, "0");
    const m = String(minutos % 60).padStart(2, "0");
    return `${h}:${m}`;
  };

  const aHora12 = (hora) => {
    const [hStr, mStr] = String(hora || "00:00").split(":");
    const h = Number(hStr);
    const periodo = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${mStr} ${periodo}`;
  };

  const construirHorarioClasePredeterminado = (nivel, cursoNombre, areaNombre, horarioBase = []) => {
    const duracionClase = nivel === "Secundaria" ? 50 : 45;
    let cursor = 8 * 60;
    const cursoTexto = `${cursoNombre} · ${areaNombre}`;

    return bloquesBase.map((bloque, idx) => {
      const base = horarioBase[idx];
      const duracion = bloque.tipo === "clase" ? duracionClase : bloque.tipo === "recreo" ? 15 : 40;
      const inicio = base?.inicio || aHora24(cursor);
      const fin = base?.fin || aHora24(cursor + duracion);
      cursor += duracion;

      return {
        id: `hc-${idx + 1}`,
        dia: "Lunes",
        horaAcademica: bloque.etiqueta,
        tipo: base?.tipo || bloque.tipo,
        inicio,
        fin,
        curso: cursoTexto,
        aula: `Aula ${101 + idx}`,
      };
    });
  };

  const [horarioClaseEditable, setHorarioClaseEditable] = useState(() =>
    Array.isArray(data.horarioClase) && data.horarioClase.length > 0
      ? data.horarioClase
      : construirHorarioClasePredeterminado(data.nivel, data.nombre, data.area, normalizarHorarioCurso(data.horario || []))
  );
  const [diaVistaHorario, setDiaVistaHorario] = useState(() => {
    try {
      return localStorage.getItem(claveDiaHorario) || "";
    } catch {
      return "";
    }
  });

  const actualizarFilaHorarioClase = (idFila, campo, valor) => {
    setHorarioClaseEditable((prev) => prev.map((fila) => (fila.id === idFila ? { ...fila, [campo]: valor } : fila)));
  };

  const aplicarPresetHorarioClase = (nivelPreset) => {
    setHorarioClaseEditable(
      construirHorarioClasePredeterminado(nivelPreset, data.nombre, data.area, normalizarHorarioCurso(data.horario || []))
    );
  };

  const guardarHorarioClaseModal = () => {
    const nuevoHorarioCurso = normalizarHorarioCurso(
      horarioClaseEditable.map((fila, idx) => ({
        id: `h-${idx + 1}`,
        tipo: fila.tipo || "clase",
        nombre: fila.horaAcademica || `Bloque ${idx + 1}`,
        inicio: fila.inicio,
        fin: fila.fin,
      }))
    );

    setHorarioCurso(nuevoHorarioCurso);
    onActualizarCurso(
      enriquecerCursoInicial({
        ...data,
        horario: nuevoHorarioCurso,
        horarioClase: horarioClaseEditable,
      })
    );
    setMostrarModalHorarioClase(false);
    setMensajeHorario({ tipo: "success", texto: "Horario de clase actualizado localmente" });
  };

  const hoy = new Date();
  const indiceDia = hoy.getDay();
  const diaActual = diasSemana[indiceDia === 0 ? 6 : indiceDia - 1];
  const diaSeleccionado = diaVistaHorario || diaActual;
  const esDiaActualSeleccionado = diaSeleccionado === diaActual;
  const minutosActuales = (hoy.getHours() * 60) + hoy.getMinutes();
  const clasesDia = horarioClaseEditable
    .filter((fila) => fila.tipo === "clase" && fila.dia === diaSeleccionado)
    .sort((a, b) => aMinutos(a.inicio) - aMinutos(b.inicio));
  const clasesBase = clasesDia.length > 0
    ? clasesDia
    : horarioClaseEditable.filter((fila) => fila.tipo === "clase").sort((a, b) => aMinutos(a.inicio) - aMinutos(b.inicio));
  const indiceClaseActual = esDiaActualSeleccionado
    ? clasesBase.findIndex((fila) => minutosActuales >= aMinutos(fila.inicio) && minutosActuales < aMinutos(fila.fin))
    : -1;
  const indiceProxima = esDiaActualSeleccionado
    ? clasesBase.findIndex((fila) => aMinutos(fila.inicio) > minutosActuales)
    : 0;
  const clasePrincipal = indiceClaseActual >= 0
    ? clasesBase[indiceClaseActual]
    : clasesBase[indiceProxima >= 0 ? indiceProxima : 0];
  const claseSiguiente = indiceClaseActual >= 0
    ? clasesBase[indiceClaseActual + 1]
    : clasesBase[(indiceProxima >= 0 ? indiceProxima : 0) + 1];
  const estadoClasePrincipal = indiceClaseActual >= 0 ? "Ahora" : "Próxima clase";

  useEffect(() => {
    try {
      if (diaVistaHorario) {
        localStorage.setItem(claveDiaHorario, diaVistaHorario);
      }
    } catch {
      // Si localStorage falla, no interrumpimos la UX.
    }
  }, [claveDiaHorario, diaVistaHorario]);

  const estudiantesDetalle = data.estudiantesDetalle || [];
  const totalEstudiantes = data.estudiantes || estudiantesDetalle.length || 0;
  const conteosGrado = estudiantesDetalle.reduce(
    (acum, estudiante) => {
      if (estudiante.promedio >= 90) acum.excelente += 1;
      else if (estudiante.promedio >= 70) acum.bueno += 1;
      else if (estudiante.promedio >= 60) acum.regular += 1;
      else acum.riesgo += 1;
      return acum;
    },
    { excelente: 0, bueno: 0, regular: 0, riesgo: 0 }
  );

  const promedioGeneral =
    estudiantesDetalle.length > 0
      ? Math.round(estudiantesDetalle.reduce((acum, estudiante) => acum + estudiante.promedio, 0) / estudiantesDetalle.length)
      : data.promedio;
  const metaGrado = 80;
  const radio = 88;
  const circunferencia = 2 * Math.PI * radio;
  const segmentos = [
    { key: "excelente", label: "Excelente (90-100)", value: conteosGrado.excelente, color: "#16a34a" },
    { key: "bueno", label: "Bueno (70-89)", value: conteosGrado.bueno, color: "#2563eb" },
    { key: "regular", label: "Regular (60-69)", value: conteosGrado.regular, color: "#f59e0b" },
    { key: "riesgo", label: "En riesgo (<60)", value: conteosGrado.riesgo, color: "#ef4444" },
  ];
  const totalSegmentos = segmentos.reduce((acum, segmento) => acum + segmento.value, 0) || 1;
  let offset = 0;
  const segmentosRender = segmentos.map((segmento) => {
    const porcentaje = (segmento.value / totalSegmentos) * 100;
    const dash = `${(circunferencia * porcentaje) / 100} ${circunferencia}`;
    const currentOffset = offset;
    offset -= (circunferencia * porcentaje) / 100;
    return { ...segmento, dash, offset: currentOffset };
  });

  const tabs = ["Resumen", "Estudiantes", "Instrumentos", "Registro", "Horario"];

  const estudiantesTab =
    data.estudiantesDetalle || [
      ...data.destacados.map((est) => ({ nombre: est.nombre, promedio: est.promedio, estado: est.estado, asistencia: "95%" })),
      ...data.enRiesgo.map((est) => ({ nombre: est.nombre, promedio: est.promedio, estado: "En riesgo", asistencia: "82%" })),
    ];

  const estudiantesFiltrados = estudiantesTab.filter((est) =>
    est.nombre.toLowerCase().includes(busquedaEstudiante.trim().toLowerCase())
  );

  const instrumentosTab =
    data.instrumentosDetalle ||
    data.instrumentosRecientes.map((inst, idx) => ({
      nombre: inst.nombre,
      descripcion: inst.contexto || "Curso completo",
      tipo: idx % 2 === 0 ? "Rúbrica" : "Lista de cotejo",
      estado: inst.estado,
    }));

  const registroTab =
    data.registroDetalle || [
      { fecha: "Hoy", accion: "Observaciones de clase", estado: "Pendiente" },
      { fecha: "Ayer", accion: "Carga de calificaciones", estado: "Completado" },
      { fecha: "Lun", accion: "Retroalimentación individual", estado: "En proceso" },
    ];

  const editarBloqueHorario = (idBloque, campo, valor) => {
    setHorarioCurso((prev) => prev.map((bloque) => (bloque.id === idBloque ? { ...bloque, [campo]: valor } : bloque)));
  };

  const agregarBloqueHorario = (tipo) => {
    const cantidadClases = horarioCurso.filter((b) => b.tipo === "clase").length;
    const nuevo = {
      id: `h-${Date.now()}`,
      tipo,
      nombre:
        tipo === "clase"
          ? `${cantidadClases + 1}ra Hora`
          : tipo === "recreo"
            ? "Recreo"
            : "Almuerzo",
      inicio: "08:00",
      fin: "08:45",
    };
    setHorarioCurso((prev) => [...prev, nuevo]);
  };

  const eliminarBloqueHorario = (idBloque) => {
    setHorarioCurso((prev) => prev.filter((bloque) => bloque.id !== idBloque));
  };

  const guardarHorario = async () => {
    const horarioNormalizado = normalizarHorarioCurso(horarioCurso);
    const actualizado = enriquecerCursoInicial({ ...data, horario: horarioNormalizado });
    onActualizarCurso(actualizado);

    try {
      const resultado = await guardarHorarioCurso({ cursoId: data.id, horario: horarioNormalizado });
      setMensajeHorario({ tipo: "success", texto: resultado.mode === "firebase" ? "Horario guardado en Firebase" : "Horario guardado localmente" });
    } catch {
      setMensajeHorario({ tipo: "error", texto: "No se pudo guardar el horario" });
    }
  };

  return (
    <div className="detalle-curso-page">
      <button className="volver-cursos-btn" onClick={onVolver}>
        ← Cursos
      </button>

      <section className="detalle-header-card">
        <div className="detalle-identidad">
          <div className="detalle-icono-grande">🎓</div>
          <div>
            <h1>{data.nombre}</h1>
            <div className="detalle-meta-head">
              <span className="detalle-area-badge">{data.area}</span>
              <span>{data.nivel}</span>
              <span>Tema actual: {data.temaActual}</span>
            </div>
          </div>
        </div>

        <div className="detalle-stats-head">
          <div><span>Estudiantes</span><strong>{data.estudiantes}</strong></div>
          <div><span>Promedio</span><strong>{data.promedio}%</strong></div>
          <div><span>Próxima clase</span><strong>{data.proximaClase}</strong></div>
        </div>

        <div className="detalle-curso-opciones">
          <button className="detalle-opciones-btn" onClick={() => setMostrarMenuCurso((v) => !v)}>
            Opciones del curso ▾
          </button>
          {mostrarMenuCurso && (
            <div className="detalle-opciones-menu">
              <button onClick={() => onEditarCurso(data)}>Editar curso</button>
              <button
                className="danger"
                onClick={() => {
                  const confirmar = window.confirm("¿Está seguro que desea eliminar este curso?");
                  if (confirmar) onEliminarCurso(data.id);
                }}
              >
                Eliminar curso
              </button>
            </div>
          )}
        </div>
      </section>

      <div className="detalle-tabs">
        {tabs.map((tab) => (
          <button key={tab} className={tabActiva === tab ? "activo" : ""} onClick={() => setTabActiva(tab)}>
            {tab}
          </button>
        ))}
      </div>

      {tabActiva === "Resumen" && (
        <div className="detalle-grid">
          <section className="detalle-card span-2">
            <h2>Flujo de este curso</h2>
            <ul className="flujo-lista">
              {data.flujo.map((item) => (
                <li key={item.etapa}>
                  <span className={item.estado === "pendiente" ? "gris" : item.estado === "en-curso" ? "azul" : ""}>
                    {item.estado === "completado" ? "✅" : item.estado === "en-curso" ? "🔵" : "⚪"}
                  </span>
                  <strong>{item.etapa}</strong>
                  <em>{item.detalle}</em>
                </li>
              ))}
            </ul>
            <button className="continuar-btn">Continuar: aplicar evaluación</button>
          </section>

          <section className="detalle-card horario-clase-card">
            <div className="horario-clase-header">
              <h2>🕒 Horario de clase</h2>
            </div>

            <div className="horario-dia-switch">
              {diasSemana.map((dia) => (
                <button
                  key={dia}
                  className={diaSeleccionado === dia ? "activo" : ""}
                  onClick={() => setDiaVistaHorario(dia)}
                >
                  {dia.slice(0, 3)}
                </button>
              ))}
            </div>

            <div className={`horario-clase-panel ${indiceClaseActual >= 0 ? "activo-ahora" : ""}`}>
              <span className="horario-pill ahora">{estadoClasePrincipal}</span>
              {clasePrincipal ? (
                <>
                  <p className="horario-linea-fuerte">{clasePrincipal.horaAcademica} · {aHora12(clasePrincipal.inicio)} - {aHora12(clasePrincipal.fin)}</p>
                  <p className="horario-linea-suave">{clasePrincipal.curso || `${data.nombre} · ${data.area}`}</p>
                  <p className="horario-linea-suave">{clasePrincipal.aula || "Aula por definir"}</p>
                </>
              ) : (
                <p className="horario-linea-suave">No hay clases configuradas para hoy.</p>
              )}
            </div>

            <div className="horario-clase-panel secundario">
              <span className="horario-pill siguiente">Siguiente curso</span>
              {claseSiguiente ? (
                <>
                  <p className="horario-linea-fuerte">{claseSiguiente.horaAcademica} · {aHora12(claseSiguiente.inicio)} - {aHora12(claseSiguiente.fin)}</p>
                  <p className="horario-linea-suave">{claseSiguiente.curso || `${data.nombre} · ${data.area}`}</p>
                  <p className="horario-linea-suave">{claseSiguiente.aula || "Aula por definir"}</p>
                </>
              ) : (
                <p className="horario-linea-suave">No hay otra clase después.</p>
              )}
            </div>

            <button className="configurar-horario-btn" onClick={() => setMostrarModalHorarioClase(true)}>
              Configurar horario
            </button>
          </section>

          <section className="detalle-card span-2 chart-card donut-card">
            <h2>📊 Resumen General del Grado</h2>
            <div className="chart-legend">
              {segmentosRender.map((segmento) => (
                <span key={segmento.key}><i style={{ background: segmento.color }} /> {segmento.label}</span>
              ))}
            </div>
            <div className="donut-wrap">
              <div className="donut-chart" role="img" aria-label="Resumen general del grado">
                <svg viewBox="0 0 240 240">
                  <defs>
                    <filter id="donutShadow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#0f172a" floodOpacity="0.12" />
                    </filter>
                  </defs>
                  <circle cx="120" cy="120" r={radio} className="donut-base" />
                  {segmentosRender.map((segmento) => (
                    <circle
                      key={segmento.key}
                      cx="120"
                      cy="120"
                      r={radio}
                      className={`donut-segment donut-${segmento.key}`}
                      stroke={segmento.color}
                      strokeDasharray={segmento.dash}
                      strokeDashoffset={segmento.offset}
                    />
                  ))}
                  <circle cx="120" cy="120" r="56" className="donut-center" filter="url(#donutShadow)" />
                  <text x="120" y="114" textAnchor="middle" className="donut-total">{totalEstudiantes}</text>
                  <text x="120" y="136" textAnchor="middle" className="donut-subtitle">Estudiantes</text>
                </svg>
              </div>
              <div className="donut-summary">
                <div>
                  <span>Promedio general del curso</span>
                  <strong>{promedioGeneral}%</strong>
                </div>
                <div>
                  <span>Meta del grado</span>
                  <strong>{metaGrado}%</strong>
                </div>
              </div>
            </div>
          </section>

          <section className="detalle-card">
            <h2>En riesgo</h2>
            <ul className="lista-simple">
              {data.enRiesgo.length === 0 && <li><span>Sin estudiantes en riesgo</span><strong>—</strong></li>}
              {data.enRiesgo.map((est) => (
                <li key={est.nombre}><span>{est.nombre}</span><strong>{est.promedio}%</strong></li>
              ))}
            </ul>
          </section>

          <section className="detalle-card ia-card">
            <h2>Asistente IA</h2>
            <p>Genera retroalimentación para los {data.enRiesgo.length} estudiantes en riesgo a partir de su registro.</p>
            <button className="ia-support-btn">Sugerir apoyo</button>
          </section>

          <section className="detalle-card span-2">
            <h2>Resumen rápido del curso</h2>
            <div className="resumen-kpis">
              <div><strong>{data.estudiantes}</strong><span>Estudiantes</span></div>
              <div><strong>{data.resumenRapido.instrumentos}</strong><span>Instrumentos</span></div>
              <div><strong>{data.resumenRapido.evaluaciones}</strong><span>Evaluaciones</span></div>
              <div><strong>{data.resumenRapido.enRiesgo}</strong><span>En riesgo</span></div>
            </div>
          </section>

          <section className="detalle-card">
            <h2>Estudiantes destacados</h2>
            <ul className="lista-estado">
              {data.destacados.map((est) => (
                <li key={est.nombre}><span>{est.nombre}</span><em>{est.promedio}%</em><strong>{est.estado}</strong></li>
              ))}
            </ul>
          </section>

          <section className="detalle-card">
            <h2>Instrumentos recientes</h2>
            <ul className="lista-simple">
              {data.instrumentosRecientes.map((inst) => (
                <li key={`${inst.nombre}-${inst.contexto}`}>
                  <span>{inst.contexto ? `${inst.nombre} — ${inst.contexto}` : inst.nombre}</span>
                  <strong>{inst.estado}</strong>
                </li>
              ))}
            </ul>
          </section>

          <section className="detalle-card span-2">
            <h2>Próximas acciones</h2>
            <div className="acciones-proximas">
              {data.proximasAcciones.map((accion) => (
                <button key={accion}>{accion}</button>
              ))}
            </div>
          </section>
        </div>
      )}

            {tabActiva === "Estudiantes" && (
              <section className="detalle-card">
                <h2>Estudiantes</h2>
                <input
                  className="detalle-search"
                  type="text"
                  placeholder="Buscar estudiante por nombre..."
                  value={busquedaEstudiante}
                  onChange={(e) => setBusquedaEstudiante(e.target.value)}
                />
                <div className="detalle-tab-grid">
                  {estudiantesFiltrados.length === 0 && (
                    <article className="detalle-item-row">
                      <div>
                        <strong>No se encontraron estudiantes</strong>
                        <p>Intenta con otro nombre.</p>
                      </div>
                    </article>
                  )}
                  {estudiantesFiltrados.map((est) => (
                    <article key={est.nombre} className="detalle-item-row">
                      <div>
                        <strong>{est.nombre}</strong>
                        <p>Asistencia: {est.asistencia}</p>
                      </div>
                      <div className="detalle-item-right">
                        <span className="detalle-score">{est.promedio}%</span>
                        <span className={`chip-estado ${est.estado === "Al día" ? "ok" : est.estado === "Regular" ? "mid" : "risk"}`}>
                          {est.estado}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {tabActiva === "Instrumentos" && (
              <section className="detalle-card">
                <h2>Instrumentos</h2>
                <div className="detalle-tab-grid">
                  {instrumentosTab.map((inst) => (
                    <article key={`${inst.nombre}-${inst.descripcion}`} className="detalle-item-row">
                      <div>
                        <strong>{inst.nombre}</strong>
                        <p>{inst.descripcion}</p>
                      </div>
                      <div className="detalle-item-right">
                        <span className="chip-tipo">{inst.tipo}</span>
                        <span className={`chip-estado ${inst.estado === "En uso" ? "ok" : inst.estado === "Lista" ? "mid" : "risk"}`}>
                          {inst.estado}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {tabActiva === "Registro" && (
              <section className="detalle-card">
                <h2>Registro</h2>
                <div className="detalle-tab-grid">
                  {registroTab.map((item) => (
                    <article key={`${item.fecha}-${item.accion}`} className="detalle-item-row">
                      <div>
                        <strong>{item.accion}</strong>
                        <p>{item.fecha}</p>
                      </div>
                      <div className="detalle-item-right">
                        <span className={`chip-estado ${item.estado === "Completado" ? "ok" : item.estado === "En proceso" ? "mid" : "risk"}`}>
                          {item.estado}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {tabActiva === "Horario" && (
              <section className="detalle-card span-2 horario-card">
                <h2>🕒 Horario del Curso</h2>

                <div className="horario-toolbar">
                  <button onClick={() => agregarBloqueHorario("clase")}>+ Agregar bloque</button>
                  <button onClick={() => agregarBloqueHorario("recreo")}>+ Agregar recreo</button>
                  <button onClick={() => agregarBloqueHorario("almuerzo")}>+ Agregar almuerzo</button>
                </div>

                <div className="horario-lista">
                  {horarioCurso.map((bloque) => (
                    <article key={bloque.id} className="horario-item">
                      <input
                        className="horario-nombre"
                        value={bloque.nombre}
                        onChange={(e) => editarBloqueHorario(bloque.id, "nombre", e.target.value)}
                      />
                      <div className="horario-horas">
                        <input
                          type="time"
                          value={bloque.inicio}
                          onChange={(e) => editarBloqueHorario(bloque.id, "inicio", e.target.value)}
                        />
                        <span>—</span>
                        <input
                          type="time"
                          value={bloque.fin}
                          onChange={(e) => editarBloqueHorario(bloque.id, "fin", e.target.value)}
                        />
                      </div>
                      <span className={`horario-tipo ${bloque.tipo}`}>{bloque.tipo}</span>
                      <button className="danger-mini" onClick={() => eliminarBloqueHorario(bloque.id)}>
                        🗑 Eliminar
                      </button>
                    </article>
                  ))}
                </div>

                <div className="horario-footer">
                  <button className="modal-save" onClick={guardarHorario}>Guardar horario</button>
                  {mensajeHorario && <span className={`horario-msg ${mensajeHorario.tipo}`}>{mensajeHorario.texto}</span>}
                </div>
              </section>
            )}

      {mostrarModalHorarioClase && (
        <div className="modal-overlay" onClick={() => setMostrarModalHorarioClase(false)}>
          <div className="modal-curso modal-horario-clase" onClick={(e) => e.stopPropagation()}>
            <h2>🕒 Configurar horario</h2>
            <div className="preset-horario-row">
              <span>Horario predeterminado:</span>
              <button type="button" onClick={() => aplicarPresetHorarioClase("Primaria")}>Primaria (45 min)</button>
              <button type="button" onClick={() => aplicarPresetHorarioClase("Secundaria")}>Secundaria (50 min)</button>
            </div>

            <div className="horario-config-lista">
              {horarioClaseEditable.map((fila) => (
                <article key={fila.id} className="horario-config-item">
                  <select value={fila.dia} onChange={(e) => actualizarFilaHorarioClase(fila.id, "dia", e.target.value)}>
                    {diasSemana.map((dia) => (
                      <option key={dia} value={dia}>{dia}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={fila.horaAcademica}
                    onChange={(e) => actualizarFilaHorarioClase(fila.id, "horaAcademica", e.target.value)}
                    placeholder="Hora académica"
                  />
                  <input type="time" value={fila.inicio} onChange={(e) => actualizarFilaHorarioClase(fila.id, "inicio", e.target.value)} />
                  <input type="time" value={fila.fin} onChange={(e) => actualizarFilaHorarioClase(fila.id, "fin", e.target.value)} />
                  <input
                    type="text"
                    value={fila.curso}
                    onChange={(e) => actualizarFilaHorarioClase(fila.id, "curso", e.target.value)}
                    placeholder="Curso"
                  />
                  <input
                    type="text"
                    value={fila.aula}
                    onChange={(e) => actualizarFilaHorarioClase(fila.id, "aula", e.target.value)}
                    placeholder="Aula"
                  />
                </article>
              ))}
            </div>

            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setMostrarModalHorarioClase(false)}>Cancelar</button>
              <button className="modal-save" onClick={guardarHorarioClaseModal}>Guardar horario</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Class({ time, course, room }) {
  return (
    <div className="class-row">
      <span>{time}</span>
      <strong>{course}</strong>
      <em>{room}</em>
    </div>
  );
}

function Alert({ title, text }) {
  return (
    <div className="alert">
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

function Action({ icon, title, text, onClick, className = "" }) {
  return (
    <button type="button" className={`action ${className}`.trim()} onClick={onClick}>
      <div>{icon}</div>
      <strong>{title}</strong>
      <p>{text}</p>
    </button>
  );
}

function Pagina({ titulo, texto }) {
  return (
    <>
      <h1>{titulo}</h1>
      <div className="panel">
        <p>{texto}</p>
      </div>
    </>
  );
}

function Card({ icon, number, label, color }) {
  return (
    <div className="card">
      <div className={`icon ${color}`}>{icon}</div>
      <div>
        <h3>{number}</h3>
        <p>{label}</p>
      </div>
    </div>
  );
}

function EstudiantesPage({ cursos = [], onAbrirCurso = () => {}, onAbrirPerfil = () => {} }) {
  const [vistaEstudiantes, setVistaEstudiantes] = useState("Por Período");
  const [busqueda, setBusqueda] = useState("");
  const [fGrado, setFGrado] = useState("Todos");
  const [fSeccion, setFSeccion] = useState("Todas");
  const [fArea, setFArea] = useState("Todas");
  const [fEstado, setFEstado] = useState("Todos");
  const [fNivelRiesgo, setFNivelRiesgo] = useState("Todos");
  const [seleccionadoId, setSeleccionadoId] = useState(null);
  const [tabDetalle, setTabDetalle] = useState("Resumen");

  const estadoPorPromedio = (prom) => {
    if (prom >= 90) return { key: "excelente", label: "Excelente", clase: "exito" };
    if (prom >= 80) return { key: "estable", label: "Estable", clase: "seguimiento" };
    if (prom >= 65) return { key: "seguimiento", label: "En seguimiento", clase: "desarrollo" };
    return { key: "riesgo", label: "En riesgo", clase: "riesgo" };
  };

  const estudiantes = useMemo(() => {
    return cursos.flatMap((curso) => {
      const base = curso.estudiantesDetalle?.length ? curso.estudiantesDetalle : generarEstudiantesDetalle(curso);
      return base.map((estudiante, indice) => {
        const promedio = Number(estudiante.promedio ?? 0);
        const estado = estadoPorPromedio(promedio);
        const asistencia = Math.max(76, Math.min(99, Math.round(88 + (promedio - 70) * 0.25)));
        const nivelRiesgo = promedio < 60 ? "Alto" : promedio < 70 ? "Medio" : "Bajo";
        const dia = String((indice % 28) + 1).padStart(2, "0");
        return {
          id: `${curso.id}-${indice}-${estudiante.nombre}`,
          nombre: estudiante.nombre,
          avatar: estudiante.nombre
            .split(" ")
            .map((p) => p[0])
            .slice(0, 2)
            .join("")
            .toUpperCase(),
          promedio,
          asistencia,
          estado,
          nivelRiesgo,
          cursoId: curso.id,
          cursoNombre: curso.nombre,
          area: curso.area || "General",
          grado: curso.grado || curso.nombre.split(" ").slice(0, 2).join(" "),
          seccion: curso.seccion || (curso.nombre.match(/[A-Z]$/)?.[0] || "A"),
          edad: 11 + ((indice + 2) % 7),
          fechaNacimiento: `${dia}/0${(indice % 8) + 1}/201${indice % 7}`,
          tutor: `Tutor de ${estudiante.nombre.split(" ")[0]}`,
          telefono: `809-55${(indice % 9) + 1}-1${String(100 + indice).slice(-3)}`,
          ultimaEvaluacion: `${dia} junio 2026`,
          tendencia: promedio >= 88 ? "Mejorando" : promedio >= 70 ? "Estables" : "Bajando",
          tendenciaValor: promedio >= 88 ? 4 : promedio >= 70 ? 1 : -3,
        };
      });
    });
  }, [cursos]);

  const gradoOpts = useMemo(() => ["Todos", ...new Set(estudiantes.map((e) => e.grado))], [estudiantes]);
  const seccionOpts = useMemo(() => ["Todas", ...new Set(estudiantes.map((e) => e.seccion))], [estudiantes]);
  const areaOpts = useMemo(() => ["Todas", ...new Set(estudiantes.map((e) => e.area))], [estudiantes]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return estudiantes.filter((e) => {
      const okTexto =
        !q ||
        e.nombre.toLowerCase().includes(q) ||
        e.cursoNombre.toLowerCase().includes(q) ||
        e.area.toLowerCase().includes(q);
      const okGrado = fGrado === "Todos" || e.grado === fGrado;
      const okSeccion = fSeccion === "Todas" || e.seccion === fSeccion;
      const okArea = fArea === "Todas" || e.area === fArea;
      const okEstado = fEstado === "Todos" || e.estado.key === fEstado;
      const okNivelRiesgo = fNivelRiesgo === "Todos" || e.nivelRiesgo === fNivelRiesgo;
      return okTexto && okGrado && okSeccion && okArea && okEstado && okNivelRiesgo;
    });
  }, [busqueda, estudiantes, fGrado, fSeccion, fArea, fEstado, fNivelRiesgo]);

  const seleccionado = filtrados.find((e) => e.id === seleccionadoId) || filtrados[0] || null;

  const resumen = useMemo(() => {
    const total = filtrados.length || 1;
    const enRiesgo = filtrados.filter((e) => e.estado.key === "riesgo").length;
    const excelentes = filtrados.filter((e) => e.estado.key === "excelente").length;
    const promGeneral = Math.round(filtrados.reduce((a, e) => a + e.promedio, 0) / total);
    const asistenciaProm = Math.round(filtrados.reduce((a, e) => a + e.asistencia, 0) / total);
    const mejorando = filtrados.filter((e) => e.tendencia === "Mejorando").length;
    const estables = filtrados.filter((e) => e.tendencia === "Estables").length;
    const bajando = filtrados.filter((e) => e.tendencia === "Bajando").length;
    return { total: filtrados.length, enRiesgo, excelentes, promGeneral, asistenciaProm, mejorando, estables, bajando };
  }, [filtrados]);

  const limpiar = () => {
    setBusqueda("");
    setFGrado("Todos");
    setFSeccion("Todas");
    setFArea("Todas");
    setFEstado("Todos");
    setFNivelRiesgo("Todos");
  };

  const topRiesgo = [...filtrados]
    .filter((e) => e.estado.key === "riesgo")
    .sort((a, b) => a.promedio - b.promedio)
    .slice(0, 5);
  const topDestacados = [...filtrados]
    .filter((e) => e.estado.key === "excelente")
    .sort((a, b) => b.promedio - a.promedio)
    .slice(0, 5);

  const totalTrend = Math.max(1, resumen.mejorando + resumen.estables + resumen.bajando);
  const porcentaje = (n) => Math.round((n / totalTrend) * 100);

  const periodos = [
    {
      nombre: "Período 1",
      rango: "Enero - Marzo",
      promedio: Math.round(filtrados.reduce((a, e) => a + Math.max(45, e.promedio - 8), 0) / Math.max(1, filtrados.length)),
      competencias: 12,
      indicadores: 8,
      instrumentos: 5,
      enRiesgo: filtrados.filter((e) => Math.max(45, e.promedio - 8) < 60).length,
    },
    {
      nombre: "Período 2",
      rango: "Abril - Junio",
      promedio: Math.round(filtrados.reduce((a, e) => a + e.promedio, 0) / Math.max(1, filtrados.length)),
      competencias: 14,
      indicadores: 10,
      instrumentos: 6,
      enRiesgo: filtrados.filter((e) => e.promedio < 60).length,
    },
    {
      nombre: "Período 3",
      rango: "Julio - Septiembre",
      promedio: Math.round(filtrados.reduce((a, e) => a + Math.min(99, e.promedio + 2), 0) / Math.max(1, filtrados.length)),
      competencias: 15,
      indicadores: 11,
      instrumentos: 6,
      enRiesgo: filtrados.filter((e) => Math.min(99, e.promedio + 2) < 60).length,
    },
    {
      nombre: "Período 4",
      rango: "Octubre - Diciembre",
      promedio: Math.round(filtrados.reduce((a, e) => a + Math.min(99, e.promedio + 5), 0) / Math.max(1, filtrados.length)),
      competencias: 16,
      indicadores: 12,
      instrumentos: 7,
      enRiesgo: filtrados.filter((e) => Math.min(99, e.promedio + 5) < 60).length,
    },
  ];

  return (
    <div className="estudiantes-page">
      <section className="estudiantes-card estudiantes-header-card">
        <div className="estudiantes-card-head">
          <div><h2>🎓 Gestión de Estudiantes</h2><p>Centro de inteligencia estudiantil</p></div>
          <div className="estudiantes-vista-tabs">
            {["General", "Por Período", "Por Mes"].map((vista) => (
              <button
                key={vista}
                type="button"
                className={vistaEstudiantes === vista ? "" : "secundario"}
                onClick={() => setVistaEstudiantes(vista)}
              >
                {vista}
              </button>
            ))}
          </div>
        </div>
      </section>

      {vistaEstudiantes === "Por Período" && (
        <section className="estudiantes-periodos-container">
          <article className="estudiantes-card periodos-header">
            <div className="periodos-header-content">
              <div>
                <h2>📊 Análisis por Períodos Académicos</h2>
                <p>Seguimiento del rendimiento en cada período del año escolar MINERD</p>
              </div>
            </div>
          </article>
          <div className="estudiantes-periodos-grid">
            {periodos.map((periodo, idx) => (
              <article key={idx} className="estudiantes-card periodo-card">
                <div className="periodo-card-head">
                  <h3>{periodo.nombre}</h3>
                  <small>{periodo.rango}</small>
                </div>
                <div className="periodo-metricas">
                  <div className="periodo-metrica">
                    <span>Promedio General</span>
                    <strong className={periodo.promedio >= 80 ? "exito" : periodo.promedio >= 65 ? "desarrollo" : "riesgo"}>{periodo.promedio}%</strong>
                  </div>
                  <div className="periodo-metrica">
                    <span>Competencias Trabajadas</span>
                    <strong>{periodo.competencias}</strong>
                  </div>
                  <div className="periodo-metrica">
                    <span>Indicadores Logrados</span>
                    <strong>{periodo.indicadores}</strong>
                  </div>
                  <div className="periodo-metrica">
                    <span>Instrumentos Aplicados</span>
                    <strong>{periodo.instrumentos}</strong>
                  </div>
                </div>
                <div className="periodo-riesgo">
                  <span>⚠️ Estudiantes en riesgo: <strong>{periodo.enRiesgo}</strong></span>
                </div>
                <button type="button" className="estudiantes-secondary">Ver detalle del período →</button>
              </article>
            ))}
          </div>
        </section>
      )}

      {(vistaEstudiantes === "General" || vistaEstudiantes === "Por Mes") && (
        <>
      <section className="estudiantes-card estudiantes-header-card">

        <div className="estudiantes-kpis-grid">
          <article className="estudiantes-kpi-card azul kpi-total">
            <div className="estudiantes-kpi-head"><span className="estudiantes-kpi-icon" aria-hidden="true">👥</span></div>
            <strong>{resumen.total}</strong>
            <span>Total estudiantes</span>
            <p>100% del centro</p>
          </article>
          <article className="estudiantes-kpi-card riesgo kpi-riesgo">
            <div className="estudiantes-kpi-head"><span className="estudiantes-kpi-icon" aria-hidden="true">🚨</span></div>
            <strong>{resumen.enRiesgo}</strong>
            <span>En riesgo</span>
            <p>{resumen.total ? ((resumen.enRiesgo / resumen.total) * 100).toFixed(1) : "0.0"}% del total</p>
          </article>
          <article className="estudiantes-kpi-card exito kpi-excelente">
            <div className="estudiantes-kpi-head"><span className="estudiantes-kpi-icon" aria-hidden="true">⭐</span></div>
            <strong>{resumen.excelentes}</strong>
            <span>Excelente desempeño</span>
            <p>{resumen.total ? ((resumen.excelentes / resumen.total) * 100).toFixed(1) : "0.0"}% del total</p>
          </article>
          <article className="estudiantes-kpi-card kpi-promedio">
            <div className="estudiantes-kpi-head"><span className="estudiantes-kpi-icon" aria-hidden="true">📊</span></div>
            <strong>{resumen.promGeneral}%</strong>
            <span>Promedio general</span>
            <p>+4% vs período anterior</p>
          </article>
          <article className="estudiantes-kpi-card kpi-asistencia">
            <div className="estudiantes-kpi-head"><span className="estudiantes-kpi-icon" aria-hidden="true">📅</span></div>
            <strong>{resumen.asistenciaProm}%</strong>
            <span>Asistencia promedio</span>
            <p>{resumen.asistenciaProm >= 92 ? "Excelente" : "En seguimiento"}</p>
          </article>
        </div>
      </section>

      <section className="estudiantes-card">
        <div className="estudiantes-filtros-grid estudiantes-filtros-grid-pro">
          <label><span>Grado</span><select value={fGrado} onChange={(e) => setFGrado(e.target.value)}>{gradoOpts.map((g) => <option key={g} value={g}>{g}</option>)}</select></label>
          <label><span>Sección</span><select value={fSeccion} onChange={(e) => setFSeccion(e.target.value)}>{seccionOpts.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
          <label><span>Área</span><select value={fArea} onChange={(e) => setFArea(e.target.value)}>{areaOpts.map((a) => <option key={a} value={a}>{a}</option>)}</select></label>
          <label><span>Estado académico</span><select value={fEstado} onChange={(e) => setFEstado(e.target.value)}><option value="Todos">Todos</option><option value="excelente">Excelente</option><option value="estable">Estable</option><option value="seguimiento">En seguimiento</option><option value="riesgo">En riesgo</option></select></label>
          <label><span>Nivel de riesgo</span><select value={fNivelRiesgo} onChange={(e) => setFNivelRiesgo(e.target.value)}><option value="Todos">Todos</option><option value="Alto">Alto</option><option value="Medio">Medio</option><option value="Bajo">Bajo</option></select></label>
          <label><span>Buscar estudiante</span><input type="search" placeholder="Nombre, curso o área" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} /></label>
          <div className="estudiantes-filtro-actions"><button type="button" className="secundario" onClick={limpiar}>🧹 Limpiar filtros</button></div>
        </div>
      </section>

      <section className="estudiantes-dual-grid estudiantes-triple-grid">
        <article className="estudiantes-card">
          <div className="estudiantes-card-head"><div><h2>Estudiantes en Riesgo</h2><p>Seguimiento prioritario</p></div><span className="estudiantes-chip">{topRiesgo.length}</span></div>
          <div className="estudiantes-lista-alertas">
            {topRiesgo.map((e) => (
              <div key={e.id} className="estudiantes-alerta-item" onClick={() => onAbrirPerfil(e)} style={{ cursor: 'pointer' }}>
                <div className="estudiante-alert-main">
                  <span className="estudiante-avatar-inline">{e.avatar}</span>
                  <div><strong>{e.nombre}</strong><p>{e.cursoNombre}</p></div>
                </div>
                <div className="estudiantes-alerta-score red"><strong>{e.promedio}%</strong><span className={`nivel-riesgo-chip ${e.nivelRiesgo.toLowerCase()}`}>{e.nivelRiesgo}</span></div>
              </div>
            ))}
          </div>
          <button type="button" className="estudiantes-secondary">Ver todos los estudiantes en riesgo</button>
        </article>

        <article className="estudiantes-card">
          <div className="estudiantes-card-head"><div><h2>Estudiantes Destacados</h2><p>Alto rendimiento sostenido</p></div><span className="estudiantes-chip">{topDestacados.length}</span></div>
          <div className="estudiantes-lista-destacados">
            {topDestacados.map((e) => (
              <div key={e.id} className="estudiantes-destacado-item" onClick={() => onAbrirPerfil(e)} style={{ cursor: 'pointer' }}>
                <div className="estudiante-alert-main">
                  <span className="estudiante-avatar-inline">{e.avatar}</span>
                  <div><strong>{e.nombre}</strong><p>{e.cursoNombre}</p></div>
                </div>
                <div className="estudiantes-alerta-score green"><strong>{e.promedio}%</strong><span>{e.promedio >= 95 ? "Sobresaliente" : "Excelente"}</span></div>
              </div>
            ))}
          </div>
          <button type="button" className="estudiantes-secondary">Ver todos los destacados</button>
        </article>

        <article className="estudiantes-card estudiantes-chart-card">
          <div className="estudiantes-card-head"><div><h2>Seguimiento Académico</h2><p>Tendencia del rendimiento</p></div></div>
          <div className="donut-wrap">
            <svg viewBox="0 0 120 120" width="150" height="150" aria-hidden="true">
              <circle cx="60" cy="60" r="44" fill="none" stroke="#e2e8f0" strokeWidth="14" />
              <circle cx="60" cy="60" r="44" fill="none" stroke="#22c55e" strokeWidth="14" strokeDasharray={`${(276 * porcentaje(resumen.mejorando)) / 100} 276`} strokeDashoffset="0" transform="rotate(-90 60 60)" />
              <circle cx="60" cy="60" r="44" fill="none" stroke="#2563eb" strokeWidth="14" strokeDasharray={`${(276 * porcentaje(resumen.estables)) / 100} 276`} strokeDashoffset={`-${(276 * porcentaje(resumen.mejorando)) / 100}`} transform="rotate(-90 60 60)" />
              <circle cx="60" cy="60" r="44" fill="none" stroke="#f59e0b" strokeWidth="14" strokeDasharray={`${(276 * porcentaje(resumen.bajando)) / 100} 276`} strokeDashoffset={`-${(276 * (porcentaje(resumen.mejorando) + porcentaje(resumen.estables))) / 100}`} transform="rotate(-90 60 60)" />
            </svg>
            <div className="donut-summary"><strong>{resumen.total}</strong><p>Estudiantes</p></div>
          </div>
          <div className="donut-legend donut-legend-pro">
            <span className="tabla-chip exito">🟢 Mejorando {porcentaje(resumen.mejorando)}%</span>
            <span className="tabla-chip seguimiento">🔵 Estables {porcentaje(resumen.estables)}%</span>
            <span className="tabla-chip desarrollo">🟠 Bajando rendimiento {porcentaje(resumen.bajando)}%</span>
          </div>
          <button type="button" className="estudiantes-secondary">Ver análisis completo</button>
        </article>
      </section>

      <section className="estudiantes-shell">
        <div className="estudiantes-main">
          <article className="estudiantes-card">
            <div className="estudiantes-card-head">
              <div><h2>Lista de estudiantes ({filtrados.length})</h2></div>
              <div className="estudiantes-row-actions estudiantes-row-actions-top">
                <button type="button" className="secundario">📤 Exportar</button>
                <button type="button">➕ Agregar estudiante</button>
              </div>
            </div>

            <div className="estudiantes-tabla-wrap">
              <table className="estudiantes-table">
                <thead>
                  <tr>
                    <th><input type="checkbox" aria-label="Seleccionar todos" /></th>
                    <th>Foto</th>
                    <th>Nombre</th>
                    <th>Curso</th>
                    <th>Promedio</th>
                    <th>Asistencia</th>
                    <th>Estado</th>
                    <th>Última evaluación</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((e) => {
                    const activo = seleccionado?.id === e.id;
                    const cursoRelacionado = cursos.find((c) => c.id === e.cursoId);
                    return (
                      <tr key={e.id} className={activo ? "activo" : ""} onClick={() => setSeleccionadoId(e.id)}>
                        <td><input type="checkbox" aria-label={`Seleccionar ${e.nombre}`} /></td>
                        <td><span className="estudiante-avatar-inline foto">{e.avatar}</span></td>
                        <td><strong>{e.nombre}</strong><small>{e.area}</small></td>
                        <td>{e.cursoNombre}</td>
                        <td><div className="promedio-cell"><span className="estudiantes-table-score">{e.promedio}%</span><em className={e.tendenciaValor >= 0 ? "trend-up" : "trend-down"}>{e.tendenciaValor >= 0 ? "⬆" : "⬇"} {Math.abs(e.tendenciaValor)} pts</em></div></td>
                        <td>{e.asistencia}%</td>
                        <td><span className={`tabla-chip ${e.estado.clase}`}>{e.estado.label}</span></td>
                        <td><small>{e.ultimaEvaluacion}</small></td>
                        <td>
                          <div className="estudiantes-row-actions">
                            <button type="button" className="secundario" onClick={(ev) => { ev.stopPropagation(); onAbrirPerfil(e); }}>👁 Ver</button>
                            <button type="button" className="secundario" onClick={(ev) => ev.stopPropagation()}>📊 Analizar</button>
                            <button type="button" className="secundario" onClick={(ev) => ev.stopPropagation()}>📝 Evaluar</button>
                            <button type="button" className="secundario" onClick={(ev) => ev.stopPropagation()}>⋯ Más</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </article>
        </div>

        <aside className="estudiantes-panel">
          {seleccionado && (
            <article className="estudiantes-card estudiantes-panel-card">
              <section className="panel-estudiante">
                <div className="panel-identidad">
                  <div className="panel-avatar grande">{seleccionado.avatar}</div>
                  <div>
                    <strong>{seleccionado.nombre}</strong>
                    <p>{seleccionado.cursoNombre}</p>
                    <span className={`tabla-chip ${seleccionado.estado.clase}`}>{seleccionado.estado.label}</span>
                  </div>
                </div>

                <div className="panel-metricas">
                  <div><span>Edad</span><strong>{seleccionado.edad}</strong></div>
                  <div><span>Asistencia</span><strong>{seleccionado.asistencia}%</strong></div>
                  <div><span>Promedio</span><strong>{seleccionado.promedio}%</strong></div>
                </div>

                <div className="panel-bloque">
                  <h3>Datos de contacto</h3>
                  <ul>
                    <li>Fecha de nacimiento: {seleccionado.fechaNacimiento}</li>
                    <li>Madre / tutor: {seleccionado.tutor}</li>
                    <li>Teléfono: {seleccionado.telefono}</li>
                  </ul>
                </div>

                <div className="estudiantes-row-actions tabs-pro">
                  {["Resumen", "Rendimiento", "Evaluaciones"].map((tab) => (
                    <button key={tab} type="button" className={tabDetalle === tab ? "" : "secundario"} onClick={() => setTabDetalle(tab)}>{tab}</button>
                  ))}
                </div>

                {tabDetalle === "Resumen" && (
                  <div className="panel-bloque resumen-pro">
                    <h3>Resumen</h3>
                    <div className="panel-resumen-grid">
                      <div><span>Promedio general</span><strong>{seleccionado.promedio}%</strong></div>
                      <div><span>Asistencia</span><strong>{seleccionado.asistencia}%</strong></div>
                      <div><span>Faltas</span><strong>{Math.max(0, 12 - Math.round(seleccionado.asistencia / 10))}</strong></div>
                    </div>
                    <div className="mini-evolucion-chart" aria-hidden="true"><span style={{ height: "36%" }} /><span style={{ height: "54%" }} /><span style={{ height: "42%" }} /><span style={{ height: "68%" }} /><span style={{ height: "58%" }} /></div>
                  </div>
                )}

                {tabDetalle === "Rendimiento" && (
                  <div className="panel-bloque">
                    <h3>Rendimiento</h3>
                    <div className="panel-mini-lista">
                      <div><span>C1</span><strong>{Math.max(45, seleccionado.promedio - 8)}%</strong></div>
                      <div><span>C2</span><strong>{Math.max(50, seleccionado.promedio - 4)}%</strong></div>
                      <div><span>C3</span><strong>{seleccionado.promedio}%</strong></div>
                      <div><span>C4</span><strong>{Math.min(99, seleccionado.promedio + 2)}%</strong></div>
                      <div><span>C5</span><strong>{Math.min(99, seleccionado.promedio + 5)}%</strong></div>
                    </div>
                  </div>
                )}

                {tabDetalle === "Evaluaciones" && (
                  <div className="panel-bloque">
                    <h3>Evaluaciones</h3>
                    <ul>
                      <li>Prueba corta: {Math.max(45, seleccionado.promedio - 6)}%</li>
                      <li>Proyecto: {Math.min(99, seleccionado.promedio + 3)}%</li>
                      <li>Rúbrica oral: {Math.max(50, seleccionado.promedio - 2)}%</li>
                    </ul>
                  </div>
                )}
              </section>

              <section className="panel-acciones">
                <article className="panel-alertas ia-alert-card">
                  <h3>Alertas IA</h3>
                  <ul className="alertas-lista">
                    <li>"El estudiante ha disminuido 12 puntos en las últimas evaluaciones."</li>
                    <li>"Se recomienda intervención pedagógica."</li>
                  </ul>
                  <button type="button" className="secundario ia-recomendaciones-btn">Ver recomendaciones</button>
                </article>
                <button type="button" className="ancho-completo">✨ Generar Informe Individual IA</button>
                <p className="ia-informe-caption">Genera fortalezas, debilidades, acuerdos y recomendaciones para la familia.</p>
              </section>
            </article>
          )}
        </aside>
      </section>
        </>
      )}
    </div>
  );
}

function EstudianteDetallePage({ estudiante, onVolver = () => {}, initialTab = "Resumen", onTabChange = () => {} }) {
  const tabs = ["Resumen", "Rendimiento", "Evaluaciones", "Asistencia", "Intervenciones", "Informe IA"];
  const [tabActiva, setTabActiva] = useState(initialTab);
  const [periodoActual, setPeriodoActual] = useState(2);
  const [estadoPlan, setEstadoPlan] = useState("Pendiente de iniciar");
  const [ultimoEnvio, setUltimoEnvio] = useState(null);
  const [mensajeAccion, setMensajeAccion] = useState("");
  const [storageListo, setStorageListo] = useState(false);
  const [modalEvaluacionAbierto, setModalEvaluacionAbierto] = useState(false);
  const [formEvaluacion, setFormEvaluacion] = useState({
    actividad: "",
    area: "Matematica",
    calificacion: "",
    estado: "En progreso",
    observacion: "",
  });

  const nombreBase = estudiante?.nombre || "Juan Perez Rodriguez";
  const nombre = nombreBase === "Ana Belén Reyes" ? "Katherin Romero" : nombreBase;
  const estado = estudiante?.estado?.label || "En riesgo";
  const curso = estudiante?.cursoNombre || "2do Secundaria A";
  const edad = estudiante?.edad || 15;
  const fechaNacimiento = estudiante?.fechaNacimiento || "03/04/2011";
  const tutorBase = estudiante?.tutor || "Katherin Romero";
  const tutor = tutorBase
    .replaceAll("Ana Belén Reyes", "Katherin Romero")
    .replaceAll("Ana Rodriguez", "Katherin Romero")
    .replaceAll("Tutor de Ana", "Tutor de Katherin");
  const telefono = estudiante?.telefono || "829-123-4567";
  const promedio = estudiante?.promedio || 58;
  const asistencia = estudiante?.asistencia || 82;
  const faltas = Math.max(0, 100 - asistencia);
  const ultimaEvaluacion = estudiante?.ultimaEvaluacion || "18 junio 2026";
  const tendencia = promedio < 65 ? "Bajando rendimiento" : "Mejorando";

  const evolucion = [
    { mes: "Ene", valor: 72 },
    { mes: "Feb", valor: 74 },
    { mes: "Mar", valor: 68 },
    { mes: "Abr", valor: 63 },
    { mes: "May", valor: 60 },
    { mes: "Jun", valor: 58 },
  ];

  const areas = [
    { area: "Matematica", valor: 58 },
    { area: "Lengua", valor: 65 },
    { area: "Ciencias", valor: 70 },
    { area: "Ingles", valor: 62 },
  ];

  const evaluacionesBase = [
    { fecha: "18 jun 2026", actividad: "Prueba unidad 3", area: "Matematica", calificacion: "58%", estado: "Bajo", observacion: "Requiere refuerzo" },
    { fecha: "12 jun 2026", actividad: "Tarea practica", area: "Lengua", calificacion: "65%", estado: "Regular", observacion: "Mejorar entrega" },
    { fecha: "05 jun 2026", actividad: "Participacion", area: "Ingles", calificacion: "62%", estado: "Regular", observacion: "Necesita seguimiento" },
  ];

  const planApoyoBase = [
    "Refuerzo en Matematica 2 veces por semana.",
    "Actividades cortas de recuperacion.",
    "Seguimiento de asistencia.",
    "Conversacion con madre/tutor.",
    "Evaluacion diagnostica en 15 dias.",
  ];

  const periodosEstudiante = [
    { numero: 1, nombre: "Período 1", rango: "Ene-Mar", promedio: Math.max(45, promedio - 8), competencias: 12, indicadores: 18 },
    { numero: 2, nombre: "Período 2", rango: "Abr-Jun", promedio: Math.max(50, promedio - 4), competencias: 16, indicadores: 32 },
    { numero: 3, nombre: "Período 3", rango: "Jul-Sep", promedio: promedio, competencias: 18, indicadores: 42 },
    { numero: 4, nombre: "Período 4", rango: "Oct-Dic", promedio: null, competencias: null, indicadores: null },
  ];
  const periodoSeleccionado = periodosEstudiante[periodoActual] || periodosEstudiante[2];

  const informeIaBase = "El estudiante presenta una combinacion de fortalezas en Ciencias y oportunidades de mejora en Matematica. Se recomienda andamiaje por objetivos semanales y acompanamiento familiar continuo.";
  const [evaluaciones, setEvaluaciones] = useState(evaluacionesBase);
  const [planApoyo, setPlanApoyo] = useState(planApoyoBase);
  const [informeIa, setInformeIa] = useState(informeIaBase);

  const totalCirc = 276;
  const pctAsis = asistencia;
  const pctFaltas = 100 - asistencia;
  const dashAsis = (totalCirc * pctAsis) / 100;
  const dashFaltas = (totalCirc * pctFaltas) / 100;
  const tienePromedioPeriodo = periodoSeleccionado.promedio !== null;
  const pctPeriodo = tienePromedioPeriodo ? periodoSeleccionado.promedio : 0;
  const dashPeriodo = (totalCirc * pctPeriodo) / 100;
  const storageKey = useMemo(() => {
    const identificador = `${nombre}-${curso}`.replace(/\s+/g, "-").toLowerCase();
    return `docenteos.detalle-estudiante.${identificador}`;
  }, [nombre, curso]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setStorageListo(false);
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setTabActiva("Resumen");
        setEstadoPlan("Pendiente de iniciar");
        setUltimoEnvio(null);
        setMensajeAccion("");
        setEvaluaciones(evaluacionesBase);
        setPlanApoyo(planApoyoBase);
        setInformeIa(informeIaBase);
        setStorageListo(true);
        return;
      }
      const parsed = JSON.parse(raw);
      setTabActiva(parsed.tabActiva || "Resumen");
      setEstadoPlan(parsed.estadoPlan || "Pendiente de iniciar");
      setUltimoEnvio(parsed.ultimoEnvio || null);
      setMensajeAccion(parsed.mensajeAccion || "");
      setEvaluaciones(Array.isArray(parsed.evaluaciones) ? parsed.evaluaciones : evaluacionesBase);
      setPlanApoyo(Array.isArray(parsed.planApoyo) ? parsed.planApoyo : planApoyoBase);
      setInformeIa(parsed.informeIa || informeIaBase);
      setStorageListo(true);
    } catch {
      setTabActiva("Resumen");
      setEstadoPlan("Pendiente de iniciar");
      setUltimoEnvio(null);
      setMensajeAccion("");
      setEvaluaciones(evaluacionesBase);
      setPlanApoyo(planApoyoBase);
      setInformeIa(informeIaBase);
      setStorageListo(true);
    }
  }, [storageKey]);

  useEffect(() => {
    setTabActiva(initialTab || "Resumen");
  }, [initialTab]);

  useEffect(() => {
    onTabChange(tabActiva);
  }, [tabActiva, onTabChange]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!storageListo) return;
    const payload = {
      tabActiva,
      estadoPlan,
      ultimoEnvio,
      mensajeAccion,
      evaluaciones,
      planApoyo,
      informeIa,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [storageKey, storageListo, tabActiva, estadoPlan, ultimoEnvio, mensajeAccion, evaluaciones, planApoyo, informeIa]);

  const manejarGenerarInformeIA = () => {
    const hoy = new Date();
    const fecha = hoy.toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" });
    setInformeIa(
      `${nombre} muestra un perfil de aprendizaje con promedio ${promedio}% y asistencia ${asistencia}%. Priorizar refuerzo en Matematica y actividades de transferencia en Ingles. Informe actualizado ${fecha}.`
    );
    setTabActiva("Informe IA");
    setMensajeAccion("Informe IA generado y actualizado en la pestaña correspondiente.");
  };

  const manejarCrearPlanApoyo = () => {
    setEstadoPlan("Activo");
    setPlanApoyo((prev) => {
      if (prev.some((p) => p.includes("Sesion de tutoria personalizada"))) return prev;
      return [...prev, "Sesion de tutoria personalizada los viernes."];
    });
    setTabActiva("Intervenciones");
    setMensajeAccion("Plan de apoyo activado con nueva accion de tutoria.");
  };

  const abrirModalRegistroEvaluacion = () => {
    setFormEvaluacion({
      actividad: "",
      area: "Matematica",
      calificacion: `${Math.max(50, Math.min(100, promedio + 4))}`,
      estado: "En progreso",
      observacion: "",
    });
    setModalEvaluacionAbierto(true);
  };

  const cerrarModalRegistroEvaluacion = () => {
    setModalEvaluacionAbierto(false);
  };

  const manejarRegistrarEvaluacion = (ev) => {
    ev.preventDefault();
    const actividad = formEvaluacion.actividad.trim();
    const nota = Number(formEvaluacion.calificacion);
    if (!actividad) {
      setMensajeAccion("Completa el nombre de la actividad para registrar la evaluacion.");
      return;
    }
    if (Number.isNaN(nota) || nota < 0 || nota > 100) {
      setMensajeAccion("La calificacion debe estar entre 0 y 100.");
      return;
    }
    const nueva = {
      fecha: new Date().toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" }),
      actividad,
      area: formEvaluacion.area,
      calificacion: `${Math.round(nota)}%`,
      estado: formEvaluacion.estado,
      observacion: formEvaluacion.observacion.trim() || "Registro manual desde dashboard",
    };
    setEvaluaciones((prev) => [nueva, ...prev].slice(0, 6));
    setTabActiva("Evaluaciones");
    setMensajeAccion("Nueva evaluacion registrada correctamente.");
    setModalEvaluacionAbierto(false);
  };

  const manejarEnviarReporte = () => {
    const envio = new Date().toLocaleString("es-DO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    setUltimoEnvio(envio);
    setMensajeAccion(`Reporte enviado a familia (${tutor}) el ${envio}.`);
  };

  const contenidoTab = {
    "Resumen": (
      <div className="detalle-tab-panel-grid">
        <article>
          <h4>Panorama actual</h4>
          <p>
            Rendimiento actual de {promedio}% con una asistencia de {asistencia}%. El foco inmediato es consolidar habitos de estudio
            y reducir inasistencias durante el proximo mes.
          </p>
        </article>
        <article>
          <h4>Objetivo de 30 dias</h4>
          <p>Incrementar el promedio a {Math.min(100, promedio + 6)}% y mantener asistencia por encima de 92%.</p>
        </article>
      </div>
    ),
    "Rendimiento": (
      <div className="detalle-tab-lista">
        <p>Matematica: reforzar operaciones y resolucion de problemas.</p>
        <p>Lengua: mejorar argumentacion en textos cortos.</p>
        <p>Ciencias: mantener desempeno con proyectos practicos.</p>
        <p>Ingles: fortalecer comprension lectora con ejercicios guiados.</p>
      </div>
    ),
    "Evaluaciones": (
      <div className="detalle-tab-lista">
        {evaluaciones.slice(0, 3).map((ev, idx) => (
          <p key={idx}>{ev.fecha} · {ev.actividad} · {ev.calificacion}</p>
        ))}
      </div>
    ),
    "Asistencia": (
      <div className="detalle-tab-lista">
        <p>Asistencia acumulada: {asistencia}%</p>
        <p>Faltas estimadas: {faltas}%</p>
        <p>Patron detectado: ausencias concentradas en inicio de semana.</p>
      </div>
    ),
    "Intervenciones": (
      <div className="detalle-tab-lista">
        {planApoyo.map((linea, idx) => (
          <p key={idx}>• {linea}</p>
        ))}
      </div>
    ),
    "Informe IA": (
      <div className="detalle-tab-lista">
        <p>{informeIa}</p>
        {ultimoEnvio && <p>Ultimo envio familiar: {ultimoEnvio}</p>}
      </div>
    ),
  };

  return (
    <div className="detalle-estudiante-page">
      <section className="detalle-header-card">
        <button type="button" className="detalle-volver-btn" onClick={onVolver}>
          ← Volver a la lista
        </button>
        <h1>Perfil del Estudiante</h1>
        <p>Seguimiento academico individual</p>
      </section>

      <section className="detalle-main-grid">
        <article className="detalle-card detalle-identidad">
          <div className="detalle-avatar-grande">{(nombre.split(" ")[0][0] || "J") + (nombre.split(" ")[1]?.[0] || "P")}</div>
          <div>
            <h2>{nombre}</h2>
            <span className={"detalle-badge " + (estado.toLowerCase().includes("riesgo") ? "riesgo" : "ok")}>{estado}</span>
            <ul>
              <li>Curso: {curso}</li>
              <li>Edad: {edad} anos</li>
              <li>Fecha de nacimiento: {fechaNacimiento}</li>
              <li>Madre / Tutor: {tutor}</li>
              <li>Telefono: {telefono}</li>
            </ul>
          </div>
        </article>

        <article className="detalle-card detalle-card-compacta detalle-card-periodo detalle-kpis">
          <h3>Notas del período</h3>
          <p className="detalle-periodo-chip">{periodoSeleccionado.nombre}</p>
          <div className="detalle-periodo-metricas">
            <div>
              <span>Promedio actual</span>
              <strong>{periodoSeleccionado.promedio !== null ? `${periodoSeleccionado.promedio}%` : "Sin datos"}</strong>
            </div>
            <div>
              <span>Competencias logradas</span>
              <strong>{periodoSeleccionado.competencias !== null ? `${periodoSeleccionado.competencias} / 20` : "Sin datos"}</strong>
            </div>
            <div>
              <span>Indicadores de logros alcanzados</span>
              <strong>{periodoSeleccionado.indicadores !== null ? `${periodoSeleccionado.indicadores} / 50` : "Sin datos"}</strong>
            </div>
          </div>
        </article>

      </section>

      <section className="detalle-chart-grid">
        <article className="detalle-card detalle-chart-principal">
          <div className="detalle-chart-header">
            <h3>Evolucion del promedio</h3>
          </div>
          <div className="detalle-line-chart">
            {evolucion.map((p) => (
              <div key={p.mes} className="detalle-line-col">
                <span style={{ height: `${p.valor}%` }} />
                <strong>{p.valor}</strong>
                <small>{p.mes}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="detalle-card detalle-card-compacta detalle-card-periodo detalle-card-periodo-actual">
          <h3>Periodo actual</h3>
          <div className="periodo-navegacion detalle-periodo-navegacion-card">
            <button type="button" onClick={() => setPeriodoActual(Math.max(0, periodoActual - 1))} disabled={periodoActual === 0}>◀</button>
            <span>{periodoSeleccionado.nombre}</span>
            <button type="button" onClick={() => setPeriodoActual(Math.min(3, periodoActual + 1))} disabled={periodoActual === 3}>▶</button>
          </div>
          <div className="detalle-donut-wrap detalle-donut-wrap-compacto detalle-donut-periodo">
            <div className="detalle-donut-centro-wrap">
              <svg viewBox="0 0 120 120" width="132" height="132" aria-hidden="true">
                <circle cx="60" cy="60" r="44" fill="none" stroke="#e2e8f0" strokeWidth="14" />
                <circle cx="60" cy="60" r="44" fill="none" stroke="#2563eb" strokeWidth="14" strokeDasharray={`${dashPeriodo} ${totalCirc}`} strokeDashoffset="0" transform="rotate(-90 60 60)" />
              </svg>
              <div className="detalle-donut-centro-texto">
                <strong>{tienePromedioPeriodo ? `${periodoSeleccionado.promedio}%` : "0%"}</strong>
                <span>Promedio</span>
              </div>
            </div>
            <p>{tienePromedioPeriodo ? "Promedio del período actual" : "Sin evaluaciones registradas"}</p>
          </div>
        </article>

        <article className="detalle-card detalle-card-compacta detalle-card-asistencia">
          <h3>Asistencia vs faltas</h3>
          <div className="detalle-donut-wrap detalle-donut-wrap-compacto">
            <svg viewBox="0 0 120 120" width="132" height="132" aria-hidden="true">
              <circle cx="60" cy="60" r="44" fill="none" stroke="#e2e8f0" strokeWidth="14" />
              <circle cx="60" cy="60" r="44" fill="none" stroke="#2563eb" strokeWidth="14" strokeDasharray={`${dashAsis} ${totalCirc}`} strokeDashoffset="0" transform="rotate(-90 60 60)" />
              <circle cx="60" cy="60" r="44" fill="none" stroke="#ef4444" strokeWidth="14" strokeDasharray={`${dashFaltas} ${totalCirc}`} strokeDashoffset={`-${dashAsis}`} transform="rotate(-90 60 60)" />
            </svg>
            <div>
              <p>Asistencia: {asistencia}%</p>
              <p>Faltas: {faltas}%</p>
            </div>
          </div>
        </article>

        <article className="detalle-card detalle-card-compacta detalle-card-rendimiento">
          <h3>Rendimiento por area</h3>
          <div className="detalle-bars">
            {areas.map((a) => (
              <div key={a.area}>
                <span>{a.area}</span>
                <div className="detalle-bar-track"><i style={{ width: `${a.valor}%` }} /></div>
                <strong>{a.valor}%</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="detalle-tabs-card">
        <div className="detalle-tabs">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              className={tabActiva === tab ? "activo" : ""}
              onClick={() => setTabActiva(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="detalle-tab-panel">{contenidoTab[tabActiva]}</div>
      </section>

      <section className="detalle-card">
        <h3>Evaluaciones recientes</h3>
        <div className="detalle-table-wrap">
          <table className="detalle-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Actividad</th>
                <th>Area</th>
                <th>Calificacion</th>
                <th>Estado</th>
                <th>Observacion</th>
              </tr>
            </thead>
            <tbody>
              {evaluaciones.map((ev, idx) => (
                <tr key={idx}>
                  <td>{ev.fecha}</td>
                  <td>{ev.actividad}</td>
                  <td>{ev.area}</td>
                  <td>{ev.calificacion}</td>
                  <td>{ev.estado}</td>
                  <td>{ev.observacion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="detalle-card detalle-ia-alerta">
        <h3>🤖 Alertas DOCENTEOS AI</h3>
        <p>
          {nombre} ha disminuido 14 puntos en su promedio durante los ultimos 3 meses.
          Presenta baja asistencia y rendimiento irregular en Matematica e Ingles.
        </p>
        <p>
          Recomendacion: Aplicar plan de refuerzo individual, seguimiento semanal y comunicacion con la familia.
        </p>
        <button type="button" className="secundario">Ver recomendaciones</button>
      </section>

      <section className="detalle-card">
        <h3>Plan de apoyo</h3>
        <ul className="detalle-plan-lista">
          {planApoyo.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
        <p className="detalle-plan-estado">Estado: {estadoPlan}</p>
        <button type="button" onClick={manejarCrearPlanApoyo}>Crear plan de intervencion</button>
      </section>

      {mensajeAccion && <section className="detalle-card detalle-feedback"><p>{mensajeAccion}</p></section>}

      {modalEvaluacionAbierto && (
        <section className="detalle-modal-overlay" role="dialog" aria-modal="true">
          <article className="detalle-modal-card">
            <header>
              <h3>Registrar evaluacion</h3>
              <button type="button" className="detalle-modal-cerrar" onClick={cerrarModalRegistroEvaluacion}>×</button>
            </header>
            <form className="detalle-modal-form" onSubmit={manejarRegistrarEvaluacion}>
              <label>
                Actividad
                <input
                  type="text"
                  value={formEvaluacion.actividad}
                  onChange={(e) => setFormEvaluacion((prev) => ({ ...prev, actividad: e.target.value }))}
                  placeholder="Ej: Prueba de fracciones"
                />
              </label>
              <label>
                Area
                <select
                  value={formEvaluacion.area}
                  onChange={(e) => setFormEvaluacion((prev) => ({ ...prev, area: e.target.value }))}
                >
                  <option>Matematica</option>
                  <option>Lengua</option>
                  <option>Ciencias</option>
                  <option>Ingles</option>
                </select>
              </label>
              <label>
                Calificacion (0-100)
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formEvaluacion.calificacion}
                  onChange={(e) => setFormEvaluacion((prev) => ({ ...prev, calificacion: e.target.value }))}
                />
              </label>
              <label>
                Estado
                <select
                  value={formEvaluacion.estado}
                  onChange={(e) => setFormEvaluacion((prev) => ({ ...prev, estado: e.target.value }))}
                >
                  <option>Excelente</option>
                  <option>Regular</option>
                  <option>En progreso</option>
                  <option>Bajo</option>
                </select>
              </label>
              <label className="detalle-modal-col-full">
                Observacion
                <textarea
                  rows="3"
                  value={formEvaluacion.observacion}
                  onChange={(e) => setFormEvaluacion((prev) => ({ ...prev, observacion: e.target.value }))}
                  placeholder="Notas para seguimiento"
                />
              </label>
              <div className="detalle-modal-acciones detalle-modal-col-full">
                <button type="button" className="secundario" onClick={cerrarModalRegistroEvaluacion}>Cancelar</button>
                <button type="submit">Guardar evaluacion</button>
              </div>
            </form>
          </article>
        </section>
      )}

      <section className="detalle-acciones-principales">
        <button type="button" onClick={manejarGenerarInformeIA}>Generar Informe Individual IA</button>
        <button type="button" onClick={manejarCrearPlanApoyo}>Crear Plan de Apoyo</button>
        <button type="button" onClick={abrirModalRegistroEvaluacion}>Registrar Evaluacion</button>
        <button type="button" onClick={manejarEnviarReporte}>Enviar Reporte a Familia</button>
      </section>
    </div>
  );
}

function IAPro() {
  const [entrada, setEntrada] = useState("");
  const [planificacionIa, setPlanificacionIa] = useState(null);
  const [generando, setGenerando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  // Analizador de entrada: "2do Secundaria Francés - Relaciones Humanas"
  const analizarEntrada = (texto) => {
    const partes = texto.split("-");
    if (partes.length < 2) return null;

    const gradoMateria = partes[0].trim(); // "2do Secundaria Francés"
    const tema = partes[1].trim(); // "Relaciones Humanas"

    // Extraer grado, nivel y materia
    const esGradomatch = gradoMateria.match(/^(\d+(?:er|do|ro|to))\s+(Primaria|Secundaria)\s*(?:-\s*)?(.+)?/i);
    if (!esGradomatch) return null;

    const grado = esGradomatch[1];
    const nivel = esGradomatch[2];
    const materia = esGradomatch[3] || "General";

    return { grado, nivel, materia, tema };
  };

  // IA Avanzada que genera planificación completa
  const generarPlanificacionCompleta = (analisis) => {
    const { grado, nivel, materia, tema } = analisis;

    // Competencia específica según materia
    const competencias = {
      "Inglés": `Comprende y se expresa en inglés de forma oral y escrita sobre ${tema}.`,
      "Francés": `Comprende y se expresa en francés de forma oral y escrita sobre ${tema}.`,
      "Literatura": `Analiza y produce textos literarios relacionados con ${tema}.`,
      "Matemática": `Resuelve problemas aplicando conceptos de ${tema}.`,
      "Ciencias": `Explica fenómenos científicos relacionados con ${tema}.`,
      "default": `Comprende y aplica conceptos de ${tema} en contextos reales.`,
    };

    const competencia = competencias[materia] || competencias.default;

    // Indicadores específicos
    const indicadores = [
      `Identifica y explica conceptos clave sobre ${tema}`,
      `Comunica ideas claras y coherentes sobre ${tema}`,
      `Aplica ${tema} en situaciones de la vida cotidiana`,
      `Trabaja colaborativamente en actividades sobre ${tema}`,
      `Reflexiona sobre su propio proceso de aprendizaje`,
    ];

    // Contenidos desglosados
    const contenidos = {
      conceptuales: [
        `Conceptos fundamentales de ${tema}`,
        `Características principales de ${tema}`,
        `Relaciones y conexiones con otros temas`,
      ],
      procedimentales: [
        `Identificación de elementos relacionados con ${tema}`,
        `Análisis y comparación de información`,
        `Producción de textos o materiales sobre ${tema}`,
      ],
      actitudinales: [
        `Interés por aprender sobre ${tema}`,
        `Respeto por diversas perspectivas`,
        `Compromiso con la calidad del trabajo`,
      ],
    };

    // Estrategias pedagógicas
    const estrategias = [
      `Enseñanza basada en proyectos: proyecto integrador sobre ${tema}`,
      `Aprendizaje cooperativo: trabajo en equipos de ${grado.includes("Primaria") ? "4-5" : "3-4"} estudiantes`,
      `Pensamiento crítico: análisis y reflexión sobre ${tema}`,
      `Diferenciación: actividades adaptadas al ritmo de aprendizaje`,
    ];

    // Actividades sugeridas
    const tieneIdioma = materia.includes("Inglés") || materia.includes("Francés");
    const actividades = [
      tieneIdioma
        ? `Presentación y debate oral sobre ${tema}`
        : `Presentación interactiva: introducción al tema`,
      `Lectura y análisis crítico de materiales sobre ${tema}`,
      `Actividad colaborativa: creación de material sobre ${tema}`,
      `Proyecto final: presentación multimedia o exposición`,
      `Metacognición: reflexión sobre lo aprendido`,
    ];

    // Evidencias de aprendizaje
    const evidencias = [
      `Participación en discusiones y debates`,
      `Trabajos escritos o proyectos sobre ${tema}`,
      `Presentación oral de ideas y conclusiones`,
      `Autoevaluación reflexiva del proceso`,
    ];

    // Instrumentos de evaluación
    const instrumentos = [
      {
        tipo: "Rúbrica analítica",
        criterios:
          "Conocimiento, comunicación, aplicación, colaboración",
      },
      {
        tipo: "Lista de cotejo",
        criterios: "Participación, entrega de trabajos, calidad",
      },
      {
        tipo: "Evaluación por pares",
        criterios: "Retroalimentación constructiva entre compañeros",
      },
      {
        tipo: "Autoevaluación",
        criterios: "Reflexión sobre fortalezas y áreas de mejora",
      },
    ];

    // Adecuación curricular (para estudiantes con NEE)
    const adecuacion = {
      objetivo: `Adaptar ${tema} a ritmo y estilo de aprendizaje individual`,
      estrategias: [
        "Reducción de complejidad sin perder esencia",
        "Apoyo visual y multisensorial",
        "Evaluación flexible y diversificada",
        "Tutoría individualizada según necesidad",
      ],
    };

    // Metacognición
    const metacognicion = [
      "¿Qué sabía al inicio sobre este tema?",
      "¿Qué estrategias usé para aprender?",
      "¿Qué dificultades encontré?",
      "¿Cómo superé esos obstáculos?",
      "¿Qué aprendí sobre mí mismo como aprendiz?",
      "¿Cómo aplicaré esto en el futuro?",
    ];

    // Plan B tecnológico (alternativa sin internet)
    const planB = {
      descripcion: `Alternativa sin tecnología para ${tema}`,
      actividades: [
        "Materiales impresos: guías y lecturas",
        "Actividades manuales: carteles, maquetas, dibujos",
        "Juegos educativos sin dispositivos",
        "Presentaciones orales sin proyector",
        "Trabajos colaborativos presenciales",
      ],
    };

    return {
      competencia,
      indicadores,
      contenidos,
      estrategias,
      actividades,
      evidencias,
      instrumentos,
      adecuacion,
      metacognicion,
      planB,
      info: { grado, nivel, materia, tema },
    };
  };

  const manejarGenerar = async () => {
    if (!entrada.trim()) {
      setMensaje({ tipo: "error", texto: "Por favor escribe un tema" });
      return;
    }

    const analisis = analizarEntrada(entrada);
    if (!analisis) {
      setMensaje({
        tipo: "error",
        texto:
          'Formato incorrecto. Usa: "2do Secundaria Francés - Tema"',
      });
      return;
    }

    setGenerando(true);
    setMensaje(null);

    // Simular delay de generación (en producción sería API a backend IA)
    setTimeout(() => {
      const resultado = generarPlanificacionCompleta(analisis);
      setPlanificacionIa(resultado);
      setGenerando(false);
    }, 800);
  };

  const guardarEnFirebase = async () => {
    if (!planificacionIa) return;

    setGuardando(true);
    try {
      await guardarPlanificacion({
        curso: `${planificacionIa.info.grado} ${planificacionIa.info.nivel} - ${planificacionIa.info.materia}`,
        periodo: "Flexible",
        tema: planificacionIa.info.tema,
        competencia: planificacionIa.competencia,
        resultado: planificacionIa,
      });

      setMensaje({
        tipo: "success",
        texto: "✅ Planificación guardada en tu biblioteca",
      });
      setTimeout(() => setMensaje(null), 3000);
    } catch {
      setMensaje({
        tipo: "error",
        texto: "⚠️ Debes iniciar sesión para guardar",
      });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <h1>🚀 DocenteOS AI PRO</h1>
      <p style={{ color: "#64748b", marginBottom: "24px" }}>
        Planificación completa con IA en una línea. Genera en segundos lo que
        tomaría horas.
      </p>

      <div className="ia-pro-container">
        <div className="ia-input-card">
          <h2>📝 Escribe tu idea</h2>
          <p style={{ color: "#64748b", marginBottom: "16px" }}>
            Ejemplo: "2do Secundaria Francés - Relaciones Humanas"
          </p>

          <input
            type="text"
            placeholder="2do Secundaria Inglés - Viajes y Turismo"
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter") manejarGenerar();
            }}
            className="ia-input"
          />

          <button
            className="generate-btn-pro"
            onClick={manejarGenerar}
            disabled={generando || !entrada.trim()}
          >
            {generando ? "⏳ Generando..." : "✨ Generar planificación"}
          </button>

          {mensaje && (
            <div className={`mensaje ${mensaje.tipo}`}>
              {mensaje.texto}
            </div>
          )}
        </div>

        {planificacionIa && (
          <div className="ia-resultado">
            <div className="resultado-header">
              <h2>🎓 {planificacionIa.info.grado} {planificacionIa.info.nivel} - {planificacionIa.info.materia}</h2>
              <p className="tema-titulo">📚 Tema: {planificacionIa.info.tema}</p>
            </div>

            {/* Competencia */}
            <div className="seccion-ia">
              <h3>🎯 Competencia</h3>
              <p>{planificacionIa.competencia}</p>
            </div>

            {/* Indicadores */}
            <div className="seccion-ia">
              <h3>📊 Indicadores de Logro</h3>
              <ul>
                {planificacionIa.indicadores.map((ind, idx) => (
                  <li key={idx}>{ind}</li>
                ))}
              </ul>
            </div>

            {/* Contenidos */}
            <div className="seccion-ia">
              <h3>📚 Contenidos</h3>
              <div className="contenidos-grid">
                <div className="contenido-tipo">
                  <h4>Conceptuales</h4>
                  <ul>
                    {planificacionIa.contenidos.conceptuales.map((c, idx) => (
                      <li key={idx}>{c}</li>
                    ))}
                  </ul>
                </div>
                <div className="contenido-tipo">
                  <h4>Procedimentales</h4>
                  <ul>
                    {planificacionIa.contenidos.procedimentales.map((c, idx) => (
                      <li key={idx}>{c}</li>
                    ))}
                  </ul>
                </div>
                <div className="contenido-tipo">
                  <h4>Actitudinales</h4>
                  <ul>
                    {planificacionIa.contenidos.actitudinales.map((c, idx) => (
                      <li key={idx}>{c}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Estrategias */}
            <div className="seccion-ia">
              <h3>💡 Estrategias Pedagógicas</h3>
              <ul>
                {planificacionIa.estrategias.map((est, idx) => (
                  <li key={idx}>{est}</li>
                ))}
              </ul>
            </div>

            {/* Actividades */}
            <div className="seccion-ia">
              <h3>🎨 Actividades</h3>
              <ul>
                {planificacionIa.actividades.map((act, idx) => (
                  <li key={idx}>{act}</li>
                ))}
              </ul>
            </div>

            {/* Evidencias */}
            <div className="seccion-ia">
              <h3>✅ Evidencias de Aprendizaje</h3>
              <ul>
                {planificacionIa.evidencias.map((ev, idx) => (
                  <li key={idx}>{ev}</li>
                ))}
              </ul>
            </div>

            {/* Instrumentos */}
            <div className="seccion-ia">
              <h3>📋 Instrumentos de Evaluación</h3>
              <div className="instrumentos-grid">
                {planificacionIa.instrumentos.map((inst, idx) => (
                  <div key={idx} className="instrumento-card">
                    <h4>{inst.tipo}</h4>
                    <p>{inst.criterios}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Adecuación Curricular */}
            <div className="seccion-ia">
              <h3>♿ Adecuación Curricular (NEE)</h3>
              <p>
                <strong>Objetivo:</strong> {planificacionIa.adecuacion.objetivo}
              </p>
              <ul>
                {planificacionIa.adecuacion.estrategias.map((est, idx) => (
                  <li key={idx}>{est}</li>
                ))}
              </ul>
            </div>

            {/* Metacognición */}
            <div className="seccion-ia">
              <h3>🧠 Metacognición</h3>
              <p style={{ marginBottom: "12px" }}>
                Preguntas para que el estudiante reflexione:
              </p>
              <ul>
                {planificacionIa.metacognicion.map((preg, idx) => (
                  <li key={idx}>{preg}</li>
                ))}
              </ul>
            </div>

            {/* Plan B Tecnológico */}
            <div className="seccion-ia">
              <h3>🔌 Plan B Tecnológico</h3>
              <p>
                <strong>{planificacionIa.planB.descripcion}</strong>
              </p>
              <ul>
                {planificacionIa.planB.actividades.map((act, idx) => (
                  <li key={idx}>{act}</li>
                ))}
              </ul>
            </div>

            {/* Botones de acción */}
            <div className="acciones-ia-pro">
              <button
                className="save-btn"
                onClick={guardarEnFirebase}
                disabled={guardando}
              >
                {guardando ? "⏳ Guardando..." : "💾 Guardar en mi biblioteca"}
              </button>
              <button
                className="export-btn"
                onClick={() => alert("PDF próximamente disponible")}
              >
                📥 Descargar PDF
              </button>
              <button
                className="reset-btn"
                onClick={() => {
                  setPlanificacionIa(null);
                  setEntrada("");
                }}
              >
                ↻ Nueva planificación
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}