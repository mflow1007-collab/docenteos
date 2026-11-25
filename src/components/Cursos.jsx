import { useState, useEffect, useCallback, useMemo } from "react";
import { enriquecerCursoInicial } from "../utils/cursoUtils.js";
import { agregarNombresAlCurso, revisarListaEstudiantes } from "../utils/listaEstudiantes.js";
import { guardarNuevosConAviso } from "../utils/guardarNuevosConAviso.js";
import { guardarEstudianteEnSubcoleccion } from "../services/estudiantesService.js";
import { construirGrupoAcademicoId } from "../services/gruposAcademicosService.js";
import LectorFotoLista from "./LectorFotoLista.jsx";
import { normalizarHorarioCurso, crearHorarioPorJornada } from "../utils/horarioCurso.js";
import { proximaClase } from "../utils/horarioSemanal.js";
import { coloresRegistro, CREMA_REGISTRO } from "../utils/coloresRegistro.js";
import HorarioSemanal from "./HorarioSemanal.jsx";

const CURSOS_ASIGNATURAS_BASE = ["Inglés", "Francés"];
const CURSOS_GRADOS_POR_NIVEL = {
  Primaria: ["1ro Primaria", "2do Primaria", "3ro Primaria", "4to Primaria", "5to Primaria", "6to Primaria"],
  Secundaria: ["1ro Secundaria", "2do Secundaria", "3ro Secundaria", "4to Secundaria", "5to Secundaria", "6to Secundaria"],
};

// Colores de la portada del registro oficial de ese grado
const estiloRegistro = (curso) => {
  const colores = coloresRegistro(curso);
  return colores ? { "--registro-crema": CREMA_REGISTRO, "--registro-fuerte": colores.fuerte, "--registro-suave": colores.suave } : {};
};

function Cursos({ cursos, onGuardarHorarios, onVerCurso, onCrearCurso, onActualizarCurso, onEliminarCurso, cursoParaEditar, onConsumirEdicionCurso, onConfigurarHorario }) {
  const [filtro, setFiltro] = useState("Todos");
  const [vista, setVista] = useState("Tarjetas");
  const [mostrarHorario, setMostrarHorario] = useState(false);
  const [mostrarModalCurso, setMostrarModalCurso] = useState(Boolean(cursoParaEditar));
  const [cursoEnEdicion, setCursoEnEdicion] = useState(cursoParaEditar);
  const [menuAbiertoId, setMenuAbiertoId] = useState(null);
  const [nombresFoto, setNombresFoto] = useState([]);
  const [fotoError, setFotoError] = useState(null);
  const [fotoEstado, setFotoEstado] = useState("vacio");
  const asignaturasBase = CURSOS_ASIGNATURAS_BASE;
  const gradosPorNivel = CURSOS_GRADOS_POR_NIVEL;

  const crearFormCurso = useCallback((curso = null) => {
    const nivel = curso?.nivel || "Secundaria";
    const duracionClaseMinutos =
      nivel === "Primaria"
        ? 45
        : (curso?.duracionClaseMinutos || (curso?.jornadaTipo === "Secundaria" ? 50 : 50));
    return {
      nivel,
      duracionClaseMinutos,
      jornadaTipo: nivel === "Primaria" ? "Primaria" : duracionClaseMinutos === 45 ? "Primaria" : "Secundaria",
      grado: curso?.nombre?.split(" ").slice(0, 2).join(" ") || CURSOS_GRADOS_POR_NIVEL[nivel][0],
      area: curso?.area || CURSOS_ASIGNATURAS_BASE[0],
      seccion: curso?.seccion || (curso?.nombre?.split(" ").slice(-1)[0] || "A"),
      estudiantes: String(curso?.estudiantes || ""),
      configurarHorario: false,
    };
  }, []);

  const [formCurso, setFormCurso] = useState(() => crearFormCurso(cursoParaEditar));

  useEffect(() => {
    if (cursoParaEditar) {
      setCursoEnEdicion(cursoParaEditar);
      setFormCurso(crearFormCurso(cursoParaEditar));
      setMostrarModalCurso(true);
    }
  }, [cursoParaEditar, crearFormCurso]);

  const clasePorCurso = Object.fromEntries(cursos.map((curso) => [curso.id, proximaClase([curso])]));
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
    setNombresFoto([]);
    setFotoError(null);
    setFotoEstado("vacio");
    onConsumirEdicionCurso();
  };

  // Otro curso del mismo grado y sección ya tiene lista oficial: el nuevo la
  // hereda del grupo. Una foto la reemplazaría con IDs distintos.
  const grupoFormulario = construirGrupoAcademicoId({ nivel: formCurso.nivel, nombre: `${formCurso.grado} ${formCurso.seccion}`, seccion: formCurso.seccion });
  const cursoConLista = cursoEnEdicion ? null : cursos.find((curso) =>
    curso.estudiantesDetalle?.length && curso.matriculaOficial && construirGrupoAcademicoId(curso) === grupoFormulario);
  const nombresLista = cursoEnEdicion || cursoConLista ? [] : nombresFoto.map((n) => n.nombre.trim()).filter(Boolean);
  const cantidadEstudiantes = nombresLista.length || formCurso.estudiantes;
  const fotoEnCurso = !cursoEnEdicion && !cursoConLista && ["preparando", "analizando"].includes(fotoEstado);
  const formularioIncompleto = !formCurso.nivel || !formCurso.grado || !formCurso.area || !formCurso.seccion || !cantidadEstudiantes || fotoEnCurso;

  const guardarCurso = () => {
    if (formularioIncompleto) return;

    const nombre = `${formCurso.grado} ${formCurso.seccion}`;
    const baseCurso = cursoEnEdicion || {};
    const estudiantes = Number(cantidadEstudiantes);
    const duracionClaseMinutos = formCurso.nivel === "Primaria" ? 45 : (formCurso.duracionClaseMinutos || 50);
    const jornadaTipo = formCurso.nivel === "Primaria" ? "Primaria" : duracionClaseMinutos === 45 ? "Primaria" : "Secundaria";
    // Sin notas no hay promedio, y sin lista no hay estudiantes: nada se inventa.
    const promedio = baseCurso.promedio ?? null;
    const estudiantesDetalle = baseCurso.estudiantesDetalle || [];

    const nuevoCurso = {
      ...baseCurso,
      id: cursoEnEdicion?.id || `curso-${Date.now()}`,
      nombre,
      area: formCurso.area,
      nivel: formCurso.nivel,
      jornadaTipo,
      duracionClaseMinutos,
      seccion: formCurso.seccion,
      estudiantes,
      promedio,
      pendientes: baseCurso.pendientes ?? 0,
      proximaClase: baseCurso.proximaClase || "",
      icono: formCurso.area === "Inglés" ? "A" : "F",
      acento: baseCurso.acento || "#2563eb",
      temaActual: baseCurso.temaActual || "Tema por definir",
      historialPromedio: baseCurso.historialPromedio || [],
      flujo: baseCurso.flujo || [],
      enRiesgo: baseCurso.enRiesgo || [],
      resumenRapido: baseCurso.resumenRapido || { instrumentos: 0, evaluaciones: 0, enRiesgo: 0 },
      destacados: baseCurso.destacados || [],
      instrumentosRecientes: baseCurso.instrumentosRecientes || [],
      proximasAcciones: baseCurso.proximasAcciones || ["Configurar planificación", "Crear instrumento", "Registrar primera clase"],
      estudiantesDetalle,
      estudiantesFuente: baseCurso.estudiantesFuente || (baseCurso.matriculaOficial ? "oficial" : ""),
      matriculaOficial: baseCurso.matriculaOficial || false,
      horario: normalizarHorarioCurso(
        cursoEnEdicion
          ? baseCurso.horario || crearHorarioPorJornada(jornadaTipo, formCurso.nivel)
          : crearHorarioPorJornada(jornadaTipo, formCurso.nivel)
      ),
    };

    const { curso: cursoConNombres, nuevos } = nombresLista.length
      ? agregarNombresAlCurso(nuevoCurso, nombresLista)
      : { curso: nuevoCurso, nuevos: [] };
    const cursoFinal = enriquecerCursoInicial(cursoConNombres);
    if (cursoEnEdicion) {
      onActualizarCurso(cursoFinal);
    } else {
      onCrearCurso(cursoFinal);
      guardarNuevosConAviso(cursoFinal.id, nuevos, guardarEstudianteEnSubcoleccion);
      if (formCurso.configurarHorario) {
        onConfigurarHorario(cursoFinal.id);
      }
    }

    cerrarModalCurso();
  };

  const colorPromedio = (promedio) => {
    if (!Number.isFinite(promedio)) return "promedio-medio"; // sin notas todavía
    if (promedio >= 85) return "promedio-alto";
    if (promedio < 75) return "promedio-riesgo";
    return "promedio-medio";
  };

  const colorBordePromedio = (promedio) => {
    if (!Number.isFinite(promedio)) return "#94a3b8";
    if (promedio >= 85) return "#16a34a";
    if (promedio < 75) return "#ef4444";
    return "#2563eb";
  };

  const tonoIconoCurso = (promedio) => {
    if (!Number.isFinite(promedio)) return "icono-promedio-medio";
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
        <div className="hs-acciones-cursos">
          <button className="hs-boton-horario" aria-expanded={mostrarHorario} onClick={() => setMostrarHorario((v) => !v)}>
            🕒 {mostrarHorario ? "Ocultar mi horario" : "Mi horario"}
          </button>
          <button className="btn-nuevo-curso" onClick={abrirNuevoCurso}>
            + Nuevo Curso
          </button>
        </div>
      </div>

      {mostrarHorario && (
        <section className="hs-panel">
          <h2>Mi horario</h2>
          <HorarioSemanal cursos={cursos} onGuardar={onGuardarHorarios} />
        </section>
      )}

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
          <article className={`curso-saas-card${coloresRegistro(curso) ? " con-registro" : ""}`} key={curso.id} style={{ borderTopColor: colorBordePromedio(curso.promedio), ...estiloRegistro(curso) }}>
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
                <strong className={colorPromedio(curso.promedio)}>{Number.isFinite(curso.promedio) ? `${curso.promedio}%` : "—"}</strong>
              </div>
              <div><span>Pendientes</span><strong className="pendientes">{curso.pendientes}</strong></div>
              <div className={`curso-proxima-clase-hero ${clasePorCurso[curso.id]?.cuando === "Hoy" ? "hoy" : clasePorCurso[curso.id]?.cuando === "Mañana" ? "manana" : ""}`}>
                <span>Próxima clase</span>
                <strong>{clasePorCurso[curso.id]?.texto || "Sin horario"}</strong>
              </div>
            </div>

            {revisarListaEstudiantes(curso).mensaje && (
              <div className="curso-auto-aviso">
                <span>⚠️ {revisarListaEstudiantes(curso).mensaje}</span>
              </div>
            )}

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
          <div className="modal-curso" style={{ maxHeight: "calc(100vh - 40px)", overflowY: "auto", boxSizing: "border-box" }} onClick={(e) => e.stopPropagation()}>
            <h2>{cursoEnEdicion ? "Editar Curso" : "Nuevo Curso"}</h2>
            <div className="modal-form-grid">
              <label>
                Nivel
                <select
                  value={formCurso.nivel}
                  onChange={(e) => {
                    const nextNivel = e.target.value;
                    const nextDuracion = nextNivel === "Primaria" ? 45 : 50;
                    setFormCurso((prev) => ({
                      ...prev,
                      nivel: nextNivel,
                      duracionClaseMinutos: nextDuracion,
                      jornadaTipo: nextNivel === "Primaria" ? "Primaria" : "Secundaria",
                      grado: gradosPorNivel[nextNivel][0],
                    }));
                  }}
                >
                  <option value="Primaria">Primaria</option>
                  <option value="Secundaria">Secundaria</option>
                </select>
              </label>

              {formCurso.nivel === "Secundaria" ? (
                <label>
                  Duración de clase
                  <div className="jornada-radio-group">
                    {[
                      { value: 45, label: "45 minutos" },
                      { value: 50, label: "50 minutos" },
                    ].map((opcion) => (
                      <label key={opcion.value} className="jornada-radio-option">
                        <input
                          type="radio"
                          name="duracionClaseMinutos"
                          value={opcion.value}
                          checked={formCurso.duracionClaseMinutos === opcion.value}
                          onChange={() =>
                            setFormCurso((prev) => ({
                              ...prev,
                              duracionClaseMinutos: opcion.value,
                              jornadaTipo: opcion.value === 45 ? "Primaria" : "Secundaria",
                            }))
                          }
                        />
                        {opcion.label}
                      </label>
                    ))}
                  </div>
                </label>
              ) : (
                <label>
                  Duración de clase
                  <p className="duracion-fija-nota">45 minutos (Primaria)</p>
                </label>
              )}

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
                  value={cantidadEstudiantes}
                  readOnly={nombresLista.length > 0}
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

            {!cursoEnEdicion && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
                <span className="ma-label">Lista de estudiantes (opcional)</span>
                {cursoConLista ? (
                  <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>
                    {formCurso.grado} {formCurso.seccion} ya tiene una lista de {cursoConLista.estudiantesDetalle.length} estudiantes en {cursoConLista.area}. Este curso la recibirá al guardarse.
                  </p>
                ) : (
                  <>
                    <LectorFotoLista nombres={nombresFoto} onNombres={setNombresFoto} error={fotoError} onError={setFotoError} onEstado={setFotoEstado} />
                    {fotoEstado === "foto" && (
                      <p style={{ margin: 0, fontSize: 12, color: "#92400e" }}>La foto todavía no se ha analizado: si guardas ahora, el curso quedará sin lista.</p>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="modal-actions">
              <button className="modal-cancel" onClick={cerrarModalCurso}>Cancelar</button>
              <button className="modal-save" onClick={guardarCurso} disabled={formularioIncompleto}>
                Guardar curso
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Cursos;
