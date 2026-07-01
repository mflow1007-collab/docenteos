import { useState, useEffect } from "react";
import { obtenerPlanificacionesDetalladas } from "../firebase.js";
import { useAuth } from "../context/AuthContext.jsx";

// ── Helpers de presentación ───────────────────────────────────────────────────
function saludoHora() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

// ─── Sugerencias contextuales por área / tema ────────────────────────────────

const SUGERENCIAS_POR_AREA = {
  "Inglés": {
    "rutina|routine|daily": ["Home Safety", "Daily Routine at School", "Parts of the Day"],
    "house|home|furniture": ["Daily Routine", "Household Chores", "Family Members"],
    "family|familia": ["Daily Routine", "Descriptions", "Daily Activities"],
    "food|comida": ["Shopping", "Health and Nutrition", "Daily Routine"],
    "default": ["Greetings & Introductions", "Colors and Numbers", "My School"],
  },
  "Lengua Española": {
    "narrat|cuento|historia": ["Descripción de personajes", "Estructura del texto narrativo", "El diálogo literario"],
    "poem|poesía": ["Figuras literarias", "Texto lírico", "Métrica y rima"],
    "default": ["Tipos de texto", "Ortografía y gramática", "Comunicación oral"],
  },
  "Matemática": {
    "fracci": ["Números mixtos", "Operaciones con fracciones", "Proporcionalidad"],
    "geometr|figura": ["Perímetro y área", "Sólidos geométricos", "Ángulos"],
    "default": ["Resolución de problemas", "Estadística básica", "Números decimales"],
  },
  "Ciencias de la Naturaleza": {
    "célula|cuerpo": ["Sistemas del cuerpo humano", "Nutrición", "Salud y bienestar"],
    "ecosistem|medio": ["Cadenas alimenticias", "Biodiversidad dominicana", "Cambio climático"],
    "default": ["El método científico", "Materia y energía", "Seres vivos"],
  },
  "Ciencias Sociales": {
    "coloniz|histori": ["La República Dominicana", "Independencia Nacional", "Próceres dominicanos"],
    "democrac|ciudadan": ["Derechos y deberes", "Las instituciones del Estado", "Participación ciudadana"],
    "default": ["Geografía dominicana", "Economía básica", "Cultura e identidad"],
  },
};

const generarSugerenciasContextuales = (tema = "", area = "") => {
  const bancoArea = SUGERENCIAS_POR_AREA[area];
  if (!bancoArea) {
    return { temaBase: tema || "el tema actual", sugerencias: [] };
  }
  const temaLower = tema.toLowerCase();
  for (const [patron, sugs] of Object.entries(bancoArea)) {
    if (patron === "default") continue;
    if (patron.split("|").some((p) => temaLower.includes(p))) {
      return { temaBase: tema || area, sugerencias: sugs };
    }
  }
  return { temaBase: tema || area, sugerencias: bancoArea.default || [] };
};

function Inicio({
  cursos = [],
  onNuevaPlanificacion = () => {},
  onIrA = () => {},
  onIrASeccionIA = () => {},
  onAbrirCurso = () => {},
  onAbrirHistorial = () => {},
  onDuplicarHistorial = () => {},
}) {
  const { formulario, cargando } = useAuth();
  const [relojInicio, setRelojInicio] = useState(() => new Date());

  useEffect(() => {
    const intervalo = setInterval(() => setRelojInicio(new Date()), 60 * 1000);
    return () => clearInterval(intervalo);
  }, []);

  // Datos del Hero — dinámicos desde el perfil del docente
  const primerNombreDocente = formulario.nombreDocente
    ? formulario.nombreDocente.split(" ")[0]
    : "";
  const nombreCentro = formulario.centro || "Centro Educativo";
  const distritoEducativo = [formulario.regional, formulario.distrito]
    .filter(Boolean)
    .join(" · ") || "Distrito Educativo";
  const anioEscolar = formulario.periodo
    ? `Año Escolar ${formulario.periodo}`
    : "Período Escolar";

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
  const proximaClaseInfo = calcularProximaClaseFuncional(cursos, relojInicio);
  const proximaClase = proximaClaseInfo.valor;
  const cursoProximaClase = proximaClaseInfo.curso || cursosPorUsoReciente[0]?.nombre || "Sin curso asignado";
  const prioridadHero = estudiantesEnRiesgo > 0
    ? {
        titulo: "Prioridad de hoy",
        valor: estudiantesEnRiesgo,
        etiqueta: estudiantesEnRiesgo === 1 ? "estudiante en riesgo" : "estudiantes en riesgo",
        detalle: "Revisa asistencia, calificaciones recientes y apoyo pedagógico antes de cerrar la jornada.",
        accion: () => onIrA("reportes"),
        accionTexto: "Ver seguimiento",
        tono: "riesgo",
      }
    : totalPendientes > 0
      ? {
          titulo: "Prioridad de hoy",
          valor: totalPendientes,
          etiqueta: totalPendientes === 1 ? "evaluación pendiente" : "evaluaciones pendientes",
          detalle: "Completa los registros pendientes para mantener actualizado el seguimiento académico.",
          accion: () => onIrA("registro"),
          accionTexto: "Ir al registro",
          tono: "pendiente",
        }
      : {
          titulo: "Prioridad de hoy",
          valor: proximaClase,
          etiqueta: "próxima clase",
          detalle: cursoProximaClase,
          accion: () => onIrA("cursos"),
          accionTexto: "Ver curso",
          tono: "ok",
        };

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

  const normalizarHistorial = (items) =>
    (Array.isArray(items) ? items : []).map((item, indice) => {
      const contenido = item?.contenido || item;
      const meta = contenido?.metadatos || {};
      const grado = meta.grado || item?.grado || item?.curso || "Curso";
      const seccionValor = meta.seccion || item?.seccion || "";
      const seccion = seccionValor ? ` ${seccionValor}` : "";
      const area = meta.area || item?.area || "Área";
      const tipo = meta.tipoPlanificacion || contenido?.tipoPlanificacion || item?.tipoPlanificacion || "Planificación";
      const fecha = item?.fechaGuardado || item?.fecha || item?.createdAt || meta.fechaGeneracion || "Reciente";
      return {
        id: item?.id || `${grado}-${area}-${indice}`,
        titulo: `${grado}${seccion} · ${area}`,
        detalle: tipo,
        fecha: typeof fecha === "string" ? fecha : "Reciente",
        tema: meta.tema || meta.titulo || item?.titulo || item?.tema || "",
        area,
        contenido,
      };
    });

  const [historialReciente, setHistorialReciente] = useState(() => {
    try {
      const guardadas = JSON.parse(localStorage.getItem("docenteos_planificaciones_guardadas") || "[]");
      return Array.isArray(guardadas) ? normalizarHistorial(guardadas) : [];
    } catch { return []; }
  });

  useEffect(() => {
    obtenerPlanificacionesDetalladas().then((res) => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setHistorialReciente(normalizarHistorial(res.data));
      }
    }).catch(() => {});
  }, []);

  // Sugerencias contextuales basadas en el curso/tema más reciente
  const cursoActivo = cursosPorUsoReciente[0];
  const temaParaSugerencia = cursoActivo?.temaActual || historialReciente[0]?.tema || "";
  const areaParaSugerencia = cursoActivo?.area || historialReciente[0]?.area || "";
  const { temaBase, sugerencias } = generarSugerenciasContextuales(temaParaSugerencia, areaParaSugerencia);

  return (
    <div className="inicio-saas-shell">
      <div className="inicio-saludo-pro">
        <h1>
          👋 {saludoHora()}{primerNombreDocente ? `, ${primerNombreDocente}` : ""}
        </h1>
        <p>
          {cargando
            ? "Cargando tu información…"
            : "Aquí tienes un resumen de tu actividad académica."}
        </p>
      </div>

      <section className="inicio-hero-pro">
        <div className="inicio-hero-copy-pro">
          <div className="inicio-hero-centro-wrap" aria-label={nombreCentro}>
            <h2 className="inicio-hero-centro" aria-hidden="true">
              <span>{nombreCentro}</span>
              <span aria-hidden="true">{nombreCentro}</span>
            </h2>
          </div>
          {distritoEducativo && <p>🏛 {distritoEducativo}</p>}
          {formulario.periodo && <p>📅 {anioEscolar}</p>}
          {formulario.jornada && <p>🕐 Jornada {formulario.jornada}</p>}

          <article className="inicio-hero-plan-pro">
            <strong>➕ Nueva Planificación</strong>
            <p>
              Crear secuencias didácticas, unidades de aprendizaje y planificaciones
              alineadas al currículo por competencias del MINERD.
            </p>
            <button type="button" onClick={onNuevaPlanificacion}>Iniciar ahora -&gt;</button>
          </article>

          <article className={`inicio-hero-prioridad-pro ${prioridadHero.tono}`}>
            <div>
              <span>{prioridadHero.titulo}</span>
              <strong>{prioridadHero.valor}</strong>
              <small>{prioridadHero.etiqueta}</small>
            </div>
            <p>{prioridadHero.detalle}</p>
            <button type="button" onClick={prioridadHero.accion}>{prioridadHero.accionTexto}</button>
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
          </div>

          <div className="inicio-kpis-grid-pro fila-dos" aria-label="Indicadores de atención y agenda">
            <article className="inicio-kpi-card-pro">
              <span className="inicio-kpi-icon-pro" aria-hidden="true">📄</span>
              <strong>{instrumentosCreados}</strong>
              <small>Instrumentos</small>
            </article>
            <article className="inicio-kpi-card-pro mi-ia">
              <span className="inicio-mi-ia-badge">Listo para ayudarte</span>
              <div className="inicio-mi-ia-head">
                <span className="inicio-kpi-icon-pro" aria-hidden="true">✨</span>
                <strong>Mi IA</strong>
              </div>
              <small>Asistente docente</small>
              <em>Planifica, analiza y crea recursos para {cursoProximaClase}</em>
              <button type="button" onClick={() => onIrASeccionIA("laboratorio")}>Asistente IA</button>
            </article>
          </div>

          <div className="inicio-kpis-grid-pro fila-tres" aria-label="Indicadores de atención">
            <article className="inicio-kpi-card-pro riesgo">
              <span className="inicio-kpi-icon-pro" aria-hidden="true">⚠️</span>
              <strong>{estudiantesEnRiesgo}</strong>
              <small>Estudiantes en riesgo</small>
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

        <article className="inicio-sugerencias-ia">
          <div className="sugerencias-ia-header">
            <span className="sugerencias-ia-badge">🤖 IA</span>
            <h3>Sugerencias para tu próxima clase</h3>
          </div>
          {sugerencias.length > 0 ? (
            <>
              <p className="sugerencias-ia-tema">
                Estás trabajando <strong>"{temaBase}"</strong>. Podrías integrar:
              </p>
              <div className="sugerencias-ia-chips">
                {sugerencias.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="sugerencia-chip"
                    onClick={onNuevaPlanificacion}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <button type="button" className="sugerencias-ia-cta" onClick={onNuevaPlanificacion}>
                Generar planificación →
              </button>
            </>
          ) : (
            <>
              <p className="sugerencias-ia-tema">
                Hoy tienes <strong>{totalPlanificacionesPendientes}</strong> planificaciones pendientes y <strong>{estudiantesEnRiesgo}</strong> estudiantes que requieren seguimiento.
              </p>
              <button type="button" className="sugerencias-ia-cta" onClick={() => onIrA("ia")}>
                Ver recomendaciones →
              </button>
            </>
          )}
        </article>
      </section>

      <section className="panel indicadores-pedagogicos">
        <h2>📊 Indicadores pedagógicos</h2>
        <div className="indicadores-grid indicadores-iconicos">
          <article className="indicador-card">
            <small>📋 Cursos activos</small>
            <strong>{cursos.length}</strong>
            <span>Cursos en gestión</span>
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

      <section className="panel asistente-ia-panel">
        <div className="asistente-ia-header">
          <h2>🤖 Asistente IA</h2>
          <span className="asistente-ia-sub">¿Qué quieres hacer hoy?</span>
        </div>
        <div className="asistente-ia-grid">
          <button type="button" className="ai-action-btn ai-action-primary" onClick={onNuevaPlanificacion}>
            <span className="ai-action-icon">🪄</span>
            <strong>Generar planificación</strong>
            <small>Nueva planificación MINERD</small>
          </button>
          <button type="button" className="ai-action-btn" onClick={() => onIrASeccionIA("laboratorio")}>
            <span className="ai-action-icon">✨</span>
            <strong>Mejorar actividades</strong>
            <small>Optimiza tus actividades</small>
          </button>
          <button type="button" className="ai-action-btn" onClick={onNuevaPlanificacion}>
            <span className="ai-action-icon">📋</span>
            <strong>Revisar planificación</strong>
            <small>Revisa y ajusta planes</small>
          </button>
          <button type="button" className="ai-action-btn" onClick={() => onIrASeccionIA("materiales")}>
            <span className="ai-action-icon">📚</span>
            <strong>Sugerir recursos</strong>
            <small>Materiales y actividades</small>
          </button>
          <button type="button" className="ai-action-btn" onClick={() => onIrA("instrumentos")}>
            <span className="ai-action-icon">📝</span>
            <strong>Crear instrumento</strong>
            <small>Rúbricas y evaluaciones</small>
          </button>
          <button type="button" className="ai-action-btn" onClick={() => onIrA("reportes")}>
            <span className="ai-action-icon">📊</span>
            <strong>Generar informe</strong>
            <small>Reportes del grupo</small>
          </button>
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
                  <button type="button" onClick={() => onAbrirHistorial(item)}>Abrir</button>
                  <button type="button" onClick={() => onDuplicarHistorial(item)}>Duplicar</button>
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


export default Inicio;
