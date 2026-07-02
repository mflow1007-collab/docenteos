import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import {
  guardarCurso as guardarCursoFS,
  obtenerCursos,
  eliminarCurso as eliminarCursoFS,
  guardarPreferenciaUsuario,
  obtenerPreferenciaUsuario,
  obtenerRegistroCalificaciones,
} from "./firebase";
import { cerrarSesion } from "./auth";
import { useAuth } from "./context/AuthContext.jsx";
import AdminBar from "./components/AdminBar.jsx";
import SubscriptionBanner from "./components/SubscriptionBanner.jsx";
import { esUsuarioDocenteOS, cargoTieneModulo } from "./utils/permisos.js";
import { useLocation, useNavigate } from "react-router-dom";
import { enriquecerCursoInicial, aplicarRegistroACurso } from "./utils/cursoUtils.js";
import { SidebarGrupo, SidebarItem } from "./components/AppSidebar.jsx";
import Inicio from "./components/Inicio.jsx";
import Cursos from "./components/Cursos.jsx";
import DetalleCurso from "./components/DetalleCurso.jsx";
import CoachIA from "./components/CoachIA.jsx";

const PlanificacionPage       = lazy(() => import("./pages/PlanificacionPage"));
const InstrumentosPage        = lazy(() => import("./pages/InstrumentosPage"));
const RegistroPage            = lazy(() => import("./pages/RegistroCalificacionesPage"));
const BibliotecaPage          = lazy(() => import("./pages/BibliotecaPage"));
const LibroAbiertoPage        = lazy(() => import("./pages/LibroAbiertoPage"));
const CurricularPage          = lazy(() => import("./pages/CurricularPage"));
const RegistrosEducandoPage   = lazy(() => import("./pages/RegistrosEducandoPage"));
const CurriculumImportPage    = lazy(() => import("./pages/CurriculumImportPage"));
const CentroIAPage            = lazy(() => import("./pages/CentroIAPage"));
const SubscriptionPage        = lazy(() => import("./pages/SubscriptionPage"));
const AsistentePersonalPage   = lazy(() => import("./pages/AsistentePersonalPage"));
const ReportesPage            = lazy(() => import("./pages/ReportesPage"));
const ConfiguracionPage       = lazy(() => import("./pages/ConfiguracionPage"));
const EstudiantesPage         = lazy(() => import("./pages/EstudiantesPage"));
const ModoAulaPage            = lazy(() => import("./pages/ModoAulaPage"));
const EstudianteDetallePage   = lazy(() => import("./pages/EstudianteDetallePage"));

export default function App() {
  return <AppInner />
}

function AppInner() {
  const { formulario, user, rol } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  // Derive current page from URL — no state needed
  const pagina = pathname.replace(/^\//, '') || 'inicio'
  const navegar = (id) => navigate('/' + (id === 'inicio' ? '' : id))

  const esDocenteOS = esUsuarioDocenteOS(user?.email)
  const esAdmin = esDocenteOS

  const [cerrando,    setCerrando]    = useState(false)
  const [errorCierre, setErrorCierre] = useState('')

  const handleCerrarSesion = async () => {
    setErrorCierre('')
    setCerrando(true)
    try {
      await cerrarSesion()
    } catch {
      setErrorCierre('No fue posible cerrar sesión. Intente nuevamente.')
      setCerrando(false)
    }
  }

  // Derivados del perfil para sidebar y topbar
  const nombreDocente   = formulario.nombreDocente || ''
  const primerNombre    = nombreDocente.split(' ')[0] || 'Docente'
  const inicialesAvatar = nombreDocente.trim()
    ? nombreDocente.trim().split(/\s+/).slice(0, 2).map(p => p[0].toUpperCase()).join('')
    : 'DO'

  const [planificacionPreCargada, setPlanificacionPreCargada] = useState(null);
  const [cursosLoaded, setCursosLoaded] = useState(false);
  const [cursos, setCursos] = useState(() => {
    try {
      const guardados = localStorage.getItem("docenteos_cursos_v2");
      if (!guardados) return [];
      const parseados = JSON.parse(guardados);
      return Array.isArray(parseados)
        ? parseados.map((curso, indice) => enriquecerCursoInicial(curso, indice))
        : [];
    } catch {
      return [];
    }
  });
  const [cursoSeleccionadoId, setCursoSeleccionadoId] = useState(null);
  const [cursoAEditar, setCursoAEditar] = useState(null);
  const [tabDetalleInicial, setTabDetalleInicial] = useState("Resumen");
  const [detalleEstudianteTab, setDetalleEstudianteTab] = useState("Resumen");
  const [estudianteDetalle, setEstudianteDetalle] = useState(null);
  const [navegacionLista, setNavegacionLista] = useState(false);
  const inicializoNavegacion = useRef(false);

  const abrirDetalleCurso = (curso) => {
    if (!curso) return;
    const fechaAcceso = new Date().toISOString();
    setCursos((prev) => prev.map((item) => (item.id === curso.id ? { ...item, ultimoAcceso: fechaAcceso } : item)));
    setCursoSeleccionadoId(curso.id);
    setTabDetalleInicial("Resumen");
    navegar("detalle-curso");
  };

  const solicitarEdicionCurso = (curso) => {
    setCursoAEditar(curso);
    navegar("cursos");
  };

  const crearCurso = (nuevoCurso) => {
    setCursos((prev) => [nuevoCurso, ...prev]);
    guardarCursoFS(nuevoCurso).catch((err) => console.error("[App] Error al guardar curso:", err));
  };

  const abrirHorarioCurso = (cursoId) => {
    setCursoSeleccionadoId(cursoId);
    setTabDetalleInicial("Horario");
    navegar("detalle-curso");
  };

  const actualizarCurso = (cursoActualizado) => {
    setCursos((prev) => prev.map((curso) => (curso.id === cursoActualizado.id ? cursoActualizado : curso)));
    if (cursoSeleccionadoId === cursoActualizado.id) {
      setCursoSeleccionadoId(cursoActualizado.id);
    }
    guardarCursoFS(cursoActualizado).catch((err) => console.error("[App] Error al actualizar curso:", err));
  };

  const eliminarCurso = (idCurso) => {
    setCursos((prev) => prev.filter((curso) => curso.id !== idCurso));
    if (cursoSeleccionadoId === idCurso) {
      navegar("cursos");
      setCursoSeleccionadoId(null);
    }
    eliminarCursoFS(idCurso).catch((err) => console.error("[App] Error al eliminar curso:", err));
  };

  const abrirDetalleEstudiante = (estudiante) => {
    if (!estudiante) return;
    setEstudianteDetalle(estudiante);
    navegar("detalle-estudiante");
  };

  const volverAEstudiantes = () => {
    navegar("estudiantes");
  };

  const cursoSeleccionado =
    cursos.find((curso) => curso.id === cursoSeleccionadoId) || null;
  const cursoRegistro = cursoSeleccionado || cursos[0] || null;

  const sincronizarCursosConRegistros = useCallback(async (listaCursos) => {
    return Promise.all(
      listaCursos.map(async (curso) => {
        try {
          const resultado = await obtenerRegistroCalificaciones(curso.id);
          return aplicarRegistroACurso(curso, resultado.data);
        } catch (err) {
          console.error("[App] Error al sincronizar curso con registro:", err);
          return curso;
        }
      })
    );
  }, []);

  useEffect(() => {
    let activo = true;
    const cargarNavegacion = async () => {
      try {
        const preferencia = await obtenerPreferenciaUsuario("navegacion");
        if (!activo) return;

        const parsearNavegacion = (data) => {
          if (!data || typeof data !== "object") return null;
          return {
            pagina: typeof data.pagina === "string" ? data.pagina : "inicio",
            detalleEstudianteTab: typeof data.detalleEstudianteTab === "string" ? data.detalleEstudianteTab : "Resumen",
            estudianteDetalle: data.estudianteDetalle && typeof data.estudianteDetalle === "object"
              ? data.estudianteDetalle
              : null,
          };
        };

        const restaurarPagina = (datos) => {
          if (!datos?.pagina || datos.pagina === 'inicio') return;
          // Only redirect if on root — deep links take priority
          if (pathname === '/' || pathname === '') {
            navegar(datos.pagina);
          }
        };
        const remoto = parsearNavegacion(preferencia?.data);
        if (remoto) {
          restaurarPagina(remoto);
          setDetalleEstudianteTab(remoto.detalleEstudianteTab);
          setEstudianteDetalle(remoto.estudianteDetalle);
        } else {
          try {
            const guardada = localStorage.getItem("docenteos_navegacion");
            const local = guardada ? parsearNavegacion(JSON.parse(guardada)) : null;
            if (local) {
              restaurarPagina(local);
              setDetalleEstudianteTab(local.detalleEstudianteTab);
              setEstudianteDetalle(local.estudianteDetalle);
            }
          } catch {
            // Sin datos previos locales.
          }
        }
      } catch {
        // Mantener estado por defecto.
      } finally {
        if (activo) {
          inicializoNavegacion.current = true;
          setNavegacionLista(true);
        }
      }
    };

    cargarNavegacion();
    return () => {
      activo = false;
    };
  }, [user?.uid]);

  const [errorCarga, setErrorCarga] = useState(null);

  // Cargar cursos desde Firestore al montar
  useEffect(() => {
    let activo = true;
    const cargar = async () => {
      try {
        const resultado = await obtenerCursos();
        if (!activo) return;
        if (resultado.success && resultado.data.length > 0) {
          const base = resultado.data.map((c, i) => enriquecerCursoInicial(c, i));
          const enriquecidos = await sincronizarCursosConRegistros(base);
          if (!activo) return;
          setCursos(enriquecidos);
          localStorage.setItem("docenteos_cursos_v2", JSON.stringify(enriquecidos));
        }
      } catch (err) {
        console.error("[App] Error al cargar cursos:", err);
        if (activo) setErrorCarga("No fue posible sincronizar con el servidor. Estás viendo la última versión guardada en tu dispositivo.");
      } finally {
        if (activo) setCursosLoaded(true);
      }
    };
    cargar();
    return () => { activo = false; };
  }, [sincronizarCursosConRegistros]);

  // Cache local de cursos (solo después de cargar de Firestore para no sobrescribir)
  useEffect(() => {
    if (cursosLoaded) {
      localStorage.setItem("docenteos_cursos_v2", JSON.stringify(cursos));
    }
  }, [cursos, cursosLoaded]);

  useEffect(() => {
    if (pagina === "detalle-estudiante" && !estudianteDetalle) {
      navegar("estudiantes");
    }
  }, [pagina, estudianteDetalle]);

  useEffect(() => {
    if (!inicializoNavegacion.current || !navegacionLista) return;
    const payload = {
      pagina,
      estudianteDetalle: pagina === "detalle-estudiante" ? estudianteDetalle : null,
      detalleEstudianteTab: pagina === "detalle-estudiante" ? detalleEstudianteTab : "Resumen",
    };

    localStorage.setItem("docenteos_navegacion", JSON.stringify(payload));
    guardarPreferenciaUsuario({ clave: "navegacion", valor: payload }).catch((err) => {
      console.error("[App] Error al guardar navegación:", err);
    });
  }, [pagina, estudianteDetalle, detalleEstudianteTab, navegacionLista]);

  const [seccionIA,        setSeccionIA]        = useState("bienvenida");
  const [grupoExpandido,   setGrupoExpandido]   = useState(() => {
    if (["cursos","detalle-curso","planificacion","instrumentos","mi-registro","registro","libro-abierto","biblioteca","curricular","formatos-minerd","registros-minerd","reportes"].includes(pagina)) return "docencia";
    if (["estudiantes","detalle-estudiante"].includes(pagina)) return "estudiantes";
    if (pagina === "ia" || pagina === "curriculo") return "inteligencia";
    if (["suscripcion","configuracion","asistente-personal"].includes(pagina)) return "configuracion";
    return "inicio";
  });
  const [menuAbierto,      setMenuAbierto]       = useState(false);

  const cerrarMenu = () => setMenuAbierto(false);

  // Determina qué grupo sidebar debe estar abierto según la página activa
  const grupoDePageID = (id) => {
    if (id === "inicio")                                        return "inicio";
    if (["modo-aula","cursos","detalle-curso","planificacion","instrumentos","mi-registro","registro","libro-abierto","biblioteca","curricular","formatos-minerd","registros-minerd","reportes"].includes(id)) return "docencia";
    if (["estudiantes","detalle-estudiante"].includes(id))      return "estudiantes";
    if (id === "ia" || id === "curriculo")                      return "inteligencia";
    if (id === "suscripcion" || id === "configuracion")         return "configuracion";
    return grupoExpandido;
  };

  // Secciones del módulo Inteligencia que mapean a CentroIAPage
  const IA_SECCIONES = [
    { id: "laboratorio",  icon: "🤖", label: "Asistente IA"            },
    { id: "planificar",   icon: "📋", label: "Planificación Inteligente"},
    { id: "prompts",      icon: "📚", label: "Biblioteca Inteligente"   },
    { id: "materiales",   icon: "🛠️", label: "Generador de Recursos"    },
    { id: "mi-ia",        icon: "✨", label: "Mi IA"                   },
    { id: "academia",     icon: "🎓", label: "Academia"                 },
    { id: "personal",     icon: "🧠", label: "Entrenar mi IA"          },
  ];

  const refrescarCursosDesdeRegistros = useCallback(() => {
    if (!cursosLoaded || !cursos.length) return;

    sincronizarCursosConRegistros(cursos)
      .then((sincronizados) => setCursos(sincronizados))
      .catch((err) => console.error("[App] Error al refrescar cursos desde registros:", err));
  }, [cursos, cursosLoaded, sincronizarCursosConRegistros]);

  const irA = (id) => {
    if (["inicio", "cursos", "estudiantes"].includes(id)) {
      refrescarCursosDesdeRegistros();
    }
    navegar(id);
    setGrupoExpandido(grupoDePageID(id));
    cerrarMenu();
  };

  const irASeccionIA = (seccionId) => {
    setSeccionIA(seccionId);
    navegar("ia");
    setGrupoExpandido("inteligencia");
    cerrarMenu();
  };

  const irAdmin = (seccion) => {
    navigate(`/admin${seccion ? `/${seccion}` : ''}`)
  }

  const abrirPlanificacionDesdeHistorial = (item) => {
    setPlanificacionPreCargada({ contenido: item.contenido, accion: "abrir" });
    navegar("planificacion");
    cerrarMenu();
  };

  const duplicarPlanificacionDesdeHistorial = (item) => {
    setPlanificacionPreCargada({ contenido: item.contenido, accion: "duplicar" });
    navegar("planificacion");
    cerrarMenu();
  };

  return (
    <div className={`app${esAdmin ? ' has-adminbar' : ''}`}>
      {/* Barra de administración (solo @docenteos.com) */}
      <AdminBar onIrAdmin={irAdmin} esAdmin={esAdmin} />

      {/* Overlay mobile */}
      {menuAbierto && (
        <div className="sidebar-overlay" onClick={cerrarMenu} />
      )}

      <aside className={`sidebar${menuAbierto ? " open" : ""}`}>
        {/* Brand */}
        <div className="sidebar-header">
          <div className="brand">
            🎓 <span>Docente<span>OS</span></span>
          </div>
        </div>

        {/* Nav */}
        <nav>

          {/* ── 1. INICIO ─────────────────────────────────────────── */}
          <SidebarGrupo
            label="Inicio"
            abierto={grupoExpandido === "inicio"}
            onToggle={() => { irA("inicio"); }}
            activo={grupoExpandido === "inicio"}
          >
            <SidebarItem id="inicio" label="🏠 Inicio" pagina={pagina} onClick={() => irA("inicio")} />
          </SidebarGrupo>

          {/* ── 2. DOCENCIA ───────────────────────────────────────── */}
          <SidebarGrupo
            label="Docencia"
            abierto={grupoExpandido === "docencia"}
            onToggle={() => setGrupoExpandido(g => g === "docencia" ? "inicio" : "docencia")}
            activo={grupoDePageID(pagina) === "docencia"}
          >
            <SidebarItem id="modo-aula"              label="🏫 Modo Aula"          pagina={pagina} onClick={() => irA("modo-aula")} />
            {cargoTieneModulo(rol, "cursos")       && <SidebarItem id="cursos"        label="📘 Cursos"            pagina={pagina} onClick={() => irA("cursos")} />}
            <SidebarItem id="planificacion"          label="📝 Planificación"     pagina={pagina} onClick={() => irA("planificacion")} />
            {cargoTieneModulo(rol, "instrumentos") && <SidebarItem id="instrumentos"  label="📋 Instrumentos"      pagina={pagina} onClick={() => irA("instrumentos")} />}
            <SidebarItem id="mi-registro"            label="📓 Mi Registro"       pagina={pagina} onClick={() => irA("mi-registro")} />
            <SidebarItem id="libro-abierto"          label="📚 Libro Abierto"     pagina={pagina} onClick={() => irA("libro-abierto")} />
            <SidebarItem id="curricular"             label="📖 Diseño Curricular" pagina={pagina} onClick={() => irA("curricular")} />
            <SidebarItem id="formatos-minerd"        label="📒 Registro del MINERD" pagina={pagina} onClick={() => irA("formatos-minerd")} />
            <SidebarItem id="biblioteca"             label="🗂️ Biblioteca General" pagina={pagina} onClick={() => irA("biblioteca")} />
            <SidebarItem id="reportes"               label="📊 Reportes"          pagina={pagina} onClick={() => irA("reportes")} />
          </SidebarGrupo>

          {/* ── 3. ESTUDIANTES ────────────────────────────────────── */}
          <SidebarGrupo
            label="Estudiantes"
            abierto={grupoExpandido === "estudiantes"}
            onToggle={() => setGrupoExpandido(g => g === "estudiantes" ? "inicio" : "estudiantes")}
            activo={grupoDePageID(pagina) === "estudiantes"}
          >
            <SidebarItem id="estudiantes" label="👥 Estudiantes" pagina={pagina} onClick={() => irA("estudiantes")} />
          </SidebarGrupo>

          {/* ── 4. INTELIGENCIA (solo @docenteos.com) ─────────────── */}
          {esDocenteOS && (
            <SidebarGrupo
              label="Inteligencia"
              abierto={grupoExpandido === "inteligencia"}
              onToggle={() => setGrupoExpandido(g => g === "inteligencia" ? "inicio" : "inteligencia")}
              activo={grupoDePageID(pagina) === "inteligencia"}
            >
              {IA_SECCIONES.map((s) => (
                <button
                  key={s.id}
                  className={`ia-sub-btn${pagina === "ia" && seccionIA === s.id ? " active" : ""}`}
                  onClick={() => irASeccionIA(s.id)}
                >
                  <span className="ia-sub-icon">{s.icon}</span>
                  <span>{s.label}</span>
                </button>
              ))}
              {esDocenteOS && (
                <SidebarItem id="curriculo" label="📖 Currículo" pagina={pagina} onClick={() => irA("curriculo")} />
              )}
            </SidebarGrupo>
          )}

          {/* ── 5. ADMINISTRACIÓN (solo @docenteos.com via AdminBar) ─ */}
          {esDocenteOS && (
            <SidebarGrupo
              label="Administración"
              abierto={grupoExpandido === "admin"}
              onToggle={() => setGrupoExpandido(g => g === "admin" ? "inicio" : "admin")}
              activo={false}
            >
              {[
                ["usuarios",        "👤 Usuarios"],
                ["centros",         "🏫 Centros"],
                ["curriculo",       "📖 Currículo"],
                ["monitor-fuentes", "🌐 Monitor MINERD"],
                ["prompts",         "💬 Prompts IA"],
                ["agentes",         "🤖 Agentes"],
                ["topics",          "📌 Topics"],
                ["insights",        "💡 Insights"],
                ["firebase",        "🔥 Firebase"],
                ["configuracion",   "⚙️ Config Admin"],
              ].map(([sec, label]) => (
                <button key={sec} className="ia-sub-btn" onClick={() => irAdmin(sec)}>
                  <span>{label}</span>
                </button>
              ))}
            </SidebarGrupo>
          )}

          {/* ── 6. CONFIGURACIÓN ─────────────────────────────────── */}
          <SidebarGrupo
            label="Configuración"
            abierto={grupoExpandido === "configuracion"}
            onToggle={() => setGrupoExpandido(g => g === "configuracion" ? "inicio" : "configuracion")}
            activo={grupoDePageID(pagina) === "configuracion"}
          >
            <SidebarItem id="asistente-personal" label="🤖 Asistente Personal" pagina={pagina} onClick={() => irA("asistente-personal")} />
            <SidebarItem id="suscripcion"  label="💳 Mi Suscripción"  pagina={pagina} onClick={() => irA("suscripcion")} />
            <SidebarItem id="configuracion" label="⚙️ Preferencias"   pagina={pagina} onClick={() => irA("configuracion")} />
          </SidebarGrupo>

        </nav>

        {/* Footer */}
        <div className="sidebar-bottom">
          <div className="profile">
            <div className="avatar">{inicialesAvatar}</div>
            <div>
              <strong>{primerNombre}</strong>
              <p>{formulario.nivel ? `Docente · ${formulario.nivel}` : 'Docente'}</p>
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
        <header className={`topbar${pagina === "modo-aula" ? " topbar-modo-aula" : ""}`}>
          {pagina === "modo-aula" ? (
            <>
              <div className="modo-aula-top-title">
                <button
                  className="hamburger"
                  onClick={() => setMenuAbierto((v) => !v)}
                  aria-label="Abrir menú"
                >
                  ☰
                </button>
                <div className="modo-aula-top-icon">🏫</div>
                <div>
                  <h1>Modo Aula</h1>
                  <p>Todo lo que necesitas para tu clase, en un solo lugar</p>
                </div>
              </div>
              <div className="modo-aula-top-actions">
                <button type="button" className="modo-aula-course-chip">
                  🎓 {cursoRegistro?.grado || formulario?.nivel || "Curso activo"}
                </button>
                <button type="button" className="modo-aula-bell" aria-label="Notificaciones">
                  🔔 <span>3</span>
                </button>
                <button type="button" className="modo-aula-exit" onClick={() => irA("inicio")}>
                  Salir del aula
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                className="hamburger"
                onClick={() => setMenuAbierto((v) => !v)}
                aria-label="Abrir menú"
              >
                ☰
              </button>
              <div className="user">
                <div className="avatar small">{inicialesAvatar}</div>
                <strong>{primerNombre}</strong>
              </div>
            </>
          )}
        </header>

        <SubscriptionBanner />
        {errorCarga && (
          <div className="app-error-banner" role="alert">
            <span>⚠️ {errorCarga}</span>
            <button type="button" onClick={() => setErrorCarga(null)}>×</button>
          </div>
        )}
        <section className={`content${pagina === "modo-aula" ? " content-modo-aula" : ""}`}>
          <Suspense fallback={<div className="card">Cargando módulo...</div>}>
          {pagina === "inicio" && navegacionLista && (
            <Inicio
              cursos={cursos}
              onNuevaPlanificacion={() => { setPlanificacionPreCargada(null); navegar("planificacion"); }}
              onIrA={(destino) => navegar(destino)}
              onIrASeccionIA={irASeccionIA}
              onAbrirCurso={(cursoId) => {
                const curso = cursos.find((item) => item.id === cursoId);
                if (curso) abrirDetalleCurso(curso);
              }}
              onAbrirHistorial={abrirPlanificacionDesdeHistorial}
              onDuplicarHistorial={duplicarPlanificacionDesdeHistorial}
            />
          )}
          {pagina === "modo-aula" && (
            <ModoAulaPage
              cursos={cursos}
              cursoActivo={cursoRegistro}
              onIrA={(destino) => navegar(destino)}
            />
          )}
          {pagina === "planificacion" && (
            <PlanificacionPage
              planificacionPreCargada={planificacionPreCargada}
              onConsumirPreCargada={() => setPlanificacionPreCargada(null)}
            />
          )}
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
              onVolver={() => navegar("cursos")}
              onEditarCurso={solicitarEdicionCurso}
              onActualizarCurso={actualizarCurso}
              onEliminarCurso={eliminarCurso}
              initialTab={tabDetalleInicial}
              onIrA={(destino) => navegar(destino)}
            />
          )}
          {pagina === "estudiantes" && (
            <EstudiantesPage
              cursos={cursos}
              onAbrirCurso={abrirDetalleCurso}
              onAbrirPerfil={abrirDetalleEstudiante}
              onActualizarCurso={actualizarCurso}
              onCrearCurso={crearCurso}
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
          {pagina === "instrumentos" && (
            <InstrumentosPage
              cursos={cursos}
              cursoActivo={cursoRegistro}
              onIrA={(destino) => navegar(destino)}
            />
          )}
          {pagina === "curricular" && <CurricularPage onIrA={(destino) => navegar(destino)} />}
          {pagina === "libro-abierto" && <LibroAbiertoPage onIrA={(destino) => navegar(destino)} />}
          {pagina === "biblioteca" && <BibliotecaPage onIrA={(destino) => navegar(destino)} />}
          {(pagina === "mi-registro" || pagina === "registro") && (
            <RegistroPage
              onVolver={() => navegar("inicio")}
              curso={cursoRegistro}
              estudiante={estudianteDetalle}
              estudiantesCurso={cursoRegistro?.estudiantesDetalle || []}
              cursoAutomatico={!cursoSeleccionado && cursos.length > 1}
              onAbrirPerfil={abrirDetalleEstudiante}
              onActualizarCurso={actualizarCurso}
            />
          )}
          {(pagina === "formatos-minerd" || pagina === "registros-minerd") && (
            <RegistrosEducandoPage onIrA={(destino) => navegar(destino)} />
          )}
          {pagina === "reportes" && <ReportesPage cursos={cursos} />}
          {pagina === "ia"       && esDocenteOS && <CentroIAPage seccion={seccionIA} />}
          {pagina === "curriculo" && esDocenteOS && <CurriculumImportPage />}
          {pagina === "suscripcion" && <SubscriptionPage />}
          {pagina === "asistente-personal" && (
            <AsistentePersonalPage
              userId={user?.uid}
              planPersonal={formulario?.plan_personal === true}
            />
          )}
          {pagina === "configuracion" && <ConfiguracionPage />}
          </Suspense>
        </section>
      </main>
      <CoachIA pagina={pagina} formulario={formulario} />
    </div>
  );
}
