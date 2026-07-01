import { useState, useMemo, useRef } from "react";
import { AIService } from "../services/ai/AIService.js";
import { guardarEstudiantesEnSubcoleccion } from "../services/estudiantesService.js";
import { generarEstudiantesDetalle } from "../utils/cursoUtils.js";

function capitalizarNombre(str) {
  return str
    .split(" ")
    .map((w) => w.length > 0 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w)
    .join(" ");
}

function EstudiantesPage({ cursos = [], onAbrirPerfil = () => {}, onActualizarCurso = () => {}, onCrearCurso = () => {} }) {
  const [vistaEstudiantes, setVistaEstudiantes] = useState("Por Período");
  const [busqueda, setBusqueda] = useState("");
  const [fGrado, setFGrado] = useState("Todos");
  const [fSeccion, setFSeccion] = useState("Todas");
  const [fArea, setFArea] = useState("Todas");
  const [fEstado, setFEstado] = useState("Todos");
  const [fNivelRiesgo, setFNivelRiesgo] = useState("Todos");
  const [seleccionadoId, setSeleccionadoId] = useState(null);
  const [tabDetalle, setTabDetalle] = useState("Resumen");
  const [panelIaTexto, setPanelIaTexto] = useState("");
  const [panelIaAccion, setPanelIaAccion] = useState(null);
  const [estudiantesExtra, setEstudiantesExtra] = useState([]);
  const [modalAgregar, setModalAgregar] = useState(false);
  const [formNuevo, setFormNuevo] = useState({ nombre: "", cursoId: "", nombreCursoNuevo: "" });
  const [periodoExpandido, setPeriodoExpandido] = useState(null);
  const [panelIaGenerando, setPanelIaGenerando] = useState(false);
  const [panelIaError, setPanelIaError] = useState(null);
  const panelIaRef = useRef(null);
  const [registroCerrado, setRegistroCerrado] = useState(() => {
    try { return localStorage.getItem("docenteos_registro_cerrado") === "true"; } catch { return false; }
  });
  const [modoFoto, setModoFoto] = useState(false);
  const [modoLista, setModoLista] = useState(false);
  const [listaTexto, setListaTexto] = useState("");
  const [fotoPreview, setFotoPreview] = useState(null);
  const [fotoBase64, setFotoBase64] = useState(null);
  const [fotoMimeType, setFotoMimeType] = useState("image/jpeg");
  const [nombresEditados, setNombresEditados] = useState([]);
  const [analizandoFoto, setAnalizandoFoto] = useState(false);
  const [fotoError, setFotoError] = useState(null);

  const cerrarModalAgregar = () => {
    setModalAgregar(false);
    setModoFoto(false);
    setModoLista(false);
    setListaTexto("");
    setNombresEditados([]);
    setFotoPreview(null);
    setFotoBase64(null);
    setFotoError(null);
  };

  const estadoPorPromedio = (prom) => {
    if (prom === null || prom === undefined) return { key: "sin-datos", label: "Sin notas", clase: "sin-datos" };
    if (prom >= 90) return { key: "excelente", label: "Excelente", clase: "exito" };
    if (prom >= 80) return { key: "estable", label: "Estable", clase: "seguimiento" };
    if (prom >= 65) return { key: "seguimiento", label: "En seguimiento", clase: "desarrollo" };
    return { key: "riesgo", label: "En riesgo", clase: "riesgo" };
  };

  const estudiantes = useMemo(() => {
    const desdeCursos = cursos.flatMap((curso) => {
      const base = curso.estudiantesDetalle?.length ? curso.estudiantesDetalle : generarEstudiantesDetalle(curso);
      return base.map((estudiante, indice) => {
        const promedio = (estudiante.promedio !== null && estudiante.promedio !== undefined) ? Number(estudiante.promedio) : null;
        const estado = estadoPorPromedio(promedio);
        const asistencia = promedio !== null ? Math.max(76, Math.min(99, Math.round(88 + (promedio - 70) * 0.25))) : null;
        const nivelRiesgo = promedio === null ? "—" : promedio < 60 ? "Alto" : promedio < 70 ? "Medio" : "Bajo";
        const dia = String((indice % 28) + 1).padStart(2, "0");
        return {
          id: `${curso.id}-${indice}-${estudiante.nombre}`,
          nombre: estudiante.nombre,
          avatar: estudiante.nombre.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase(),
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
          tutor: ["María García","Rosa Martínez","Carmen Reyes","Juan Pérez","Ana Rodríguez","Luis Santos","Isabel López","Pedro Díaz"][indice % 8],
          telefono: `809-55${(indice % 9) + 1}-1${String(100 + indice).slice(-3)}`,
          ultimaEvaluacion: `${dia} junio 2026`,
          tendencia: promedio === null ? "—" : promedio >= 88 ? "Mejorando" : promedio >= 70 ? "Estables" : "Bajando",
          tendenciaValor: promedio === null ? null : promedio >= 88 ? 4 : promedio >= 70 ? 1 : -3,
        };
      });
    });
    return [...desdeCursos, ...estudiantesExtra];
  }, [cursos, estudiantesExtra]);

  const gradoOpts = useMemo(() => ["Todos", ...new Set(estudiantes.map((e) => e.grado))], [estudiantes]);
  const seccionOpts = useMemo(() => ["Todas", ...new Set(estudiantes.map((e) => e.seccion))], [estudiantes]);
  const areaOpts = useMemo(() => ["Todas", ...new Set(estudiantes.map((e) => e.area))], [estudiantes]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const base = estudiantes.filter((e) => {
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
    // Orden: regulares alfabético, tardíos al final en orden de ingreso
    return base.sort((a, b) => {
      if (a.tardio && !b.tardio) return 1;
      if (!a.tardio && b.tardio) return -1;
      if (!a.tardio && !b.tardio) return a.nombre.localeCompare(b.nombre, "es");
      return 0;
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

  const ejecutarIaEstudiante = async (accion, est) => {
    if (!est) return;
    setPanelIaTexto("");
    setPanelIaError(null);
    setPanelIaAccion(accion);
    setPanelIaGenerando(true);

    let ctx;
    try {
      ctx = await buildAIContext("sugerir_apoyo", {
        area:  est.area  || "",
        grado: est.grado || "",
        estudiantesEnRiesgo: [{
          nombre:             est.nombre,
          cf:                 est.promedio ?? 0,
          asistencia:         est.asistencia ?? null,
          observacion:        `Nivel de riesgo: ${est.nivelRiesgo || "—"}`,
          competenciasDebiles: [],
        }],
        promedioGrupo: est.promedio ?? null,
      });
    } catch {
      setPanelIaError("No se pudo construir el contexto IA.");
      setPanelIaGenerando(false);
      return;
    }

    const eventoTipo = accion === "informe"
      ? LEARNING_EVENTS.INFORME_ESTUDIANTE_GENERADO
      : LEARNING_EVENTS.IA_RECOMENDACION_GENERADA;

    AIService.generate({
      module:    "registro-apoyo",
      prompt:    ctx.prompt,
      system:    ctx.system,
      maxTokens: accion === "informe" ? 2000 : ctx.recommendedMaxTokens,
      onChunk: (chunk) => {
        setPanelIaTexto((prev) => prev + chunk);
        setTimeout(() => panelIaRef.current?.scrollTo({ top: panelIaRef.current.scrollHeight, behavior: "smooth" }), 50);
      },
      onFinish: () => {
        setPanelIaGenerando(false);
        EventTracker.track(eventoTipo, {
          agentId:  AGENT_IDS.GENERADOR_REPORTES,
          area:     est.area  || "",
          grado:    est.grado || "",
          accion,
        });
      },
      onError: (err) => { setPanelIaError(err); setPanelIaGenerando(false); },
    });
  };

  const limpiar = () => {
    setBusqueda("");
    setFGrado("Todos");
    setFSeccion("Todas");
    setFArea("Todas");
    setFEstado("Todos");
    setFNivelRiesgo("Todos");
  };

  const exportarCSV = () => {
    const cabecera = ["Nombre", "Grado", "Sección", "Área", "Curso", "Promedio (%)", "Asistencia (%)", "Estado", "Tendencia"];
    const filas = filtrados.map((e) => [
      e.nombre, e.grado, e.seccion, e.area, e.cursoNombre,
      e.promedio, e.asistencia, e.estado.label, e.tendencia,
    ]);
    const csv = [cabecera, ...filas].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `estudiantes_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const crearEstudianteExtra = (nombre, overrides = {}) => ({
    id: `extra-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    nombre,
    avatar: nombre.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase(),
    promedio: null,
    asistencia: null,
    estado: { label: "Sin notas", clase: "sin-datos" },
    nivelRiesgo: "—",
    cursoId: "",
    cursoNombre: "Sin asignar",
    area: "General",
    grado: "Sin definir",
    seccion: "A",
    edad: 13,
    fechaNacimiento: "—",
    tutor: "—",
    telefono: "—",
    ultimaEvaluacion: "—",
    tendencia: "—",
    tendenciaValor: 0,
    tardio: registroCerrado,
    ...overrides,
  });

  const agregarEstudiante = (e) => {
    e.preventDefault();
    const nombreFinal = capitalizarNombre(formNuevo.nombre.trim());
    if (!nombreFinal) return;

    const cursoExistente = cursos.find((c) => c.id === formNuevo.cursoId);

    if (cursoExistente) {
      // Agregar al curso existente y persistir en Firestore
      const nuevoEst = { id: `est-${Date.now()}`, nombre: nombreFinal, promedio: null };
      const detalle = [...(cursoExistente.estudiantesDetalle || []), nuevoEst];
      onActualizarCurso({ ...cursoExistente, estudiantesDetalle: detalle, estudiantes: detalle.length });
    } else if (formNuevo.cursoId === "_nuevo_" && formNuevo.nombreCursoNuevo.trim()) {
      // Crear curso nuevo con el estudiante incluido
      const nombreCurso = formNuevo.nombreCursoNuevo.trim();
      const nuevoCurso = enriquecerCursoInicial({
        id: `auto-${Date.now()}`,
        nombre: nombreCurso,
        grado: nombreCurso,
        nivel: nombreCurso.toLowerCase().includes("primaria") ? "Primaria" : "Secundaria",
        area: "General",
        seccion: "A",
        estudiantes: 1,
        promedio: 0,
        pendientes: 0,
        icono: nombreCurso[0]?.toUpperCase() || "C",
        acento: "#2563eb",
        temaActual: "Tema por definir",
        estudiantesDetalle: [{ id: `est-${Date.now()}`, nombre: nombreFinal, promedio: null }],
        esAutoGenerado: true,
        flujo: [], enRiesgo: [], destacados: [],
        historialPromedio: [],
        resumenRapido: { instrumentos: 0, evaluaciones: 0, enRiesgo: 0 },
        instrumentosRecientes: [],
        proximasAcciones: ["Configurar área/asignatura", "Registrar primera clase"],
      });
      onCrearCurso(nuevoCurso);
    } else {
      // Sin curso seleccionado: solo agregar a la lista local
      setEstudiantesExtra((prev) => [...prev, crearEstudianteExtra(nombreFinal)]);
    }

    setFormNuevo({ nombre: "", cursoId: "", nombreCursoNuevo: "" });
    setModalAgregar(false);
  };

  const handleFotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFotoMimeType(file.type || "image/jpeg");
    setFotoError(null);
    setNombresEditados([]);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataURL = ev.target.result;
      setFotoPreview(dataURL);
      setFotoBase64(dataURL.split(",")[1]);
    };
    reader.readAsDataURL(file);
  };

  const analizarFoto = () => {
    if (!fotoBase64) return;
    setAnalizandoFoto(true);
    setFotoError(null);
    let accumulated = "";
    AIService.generate({
      module: "vision-estudiantes",
      prompt: "Observa esta imagen de una lista de estudiantes y extrae todos los nombres. Devuelve SOLO un JSON array de strings con los nombres completos, sin texto adicional, sin markdown. Ejemplo: [\"Juan Pérez\",\"María López\",\"Carlos García\"]",
      imageBase64: fotoBase64,
      imageMediaType: fotoMimeType,
      onChunk: (chunk) => { accumulated += chunk; },
      onFinish: () => {
        try {
          const match = accumulated.match(/\[[\s\S]*?\]/);
          const nombres = match ? JSON.parse(match[0]) : [];
          setNombresEditados(nombres.filter(Boolean).map((n, i) => ({ id: i, nombre: n })));
          if (nombres.length === 0) setFotoError("No se encontraron nombres. Intenta con una imagen más clara.");
        } catch {
          setFotoError("No se pudo leer la lista. Intenta de nuevo o agrega manualmente.");
        }
        setAnalizandoFoto(false);
      },
      onError: (err) => { setFotoError(err); setAnalizandoFoto(false); },
    });
  };

  const confirmarNombresFoto = () => {
    const validos = nombresEditados.filter((n) => n.nombre.trim());
    setEstudiantesExtra((prev) => [
      ...prev,
      ...validos.map((item) => crearEstudianteExtra(item.nombre.trim())),
    ]);
    setModoFoto(false);
    setNombresEditados([]);
    setFotoPreview(null);
    setFotoBase64(null);
    setModalAgregar(false);
  };

  const confirmarNombresLista = () => {
    const nombres = listaTexto
      .split("\n")
      .map((l) => capitalizarNombre(l.trim()))
      .filter(Boolean);
    if (!nombres.length) return;

    const cursoExistente = cursos.find((c) => String(c.id) === String(formNuevo.cursoId));
    if (cursoExistente) {
      const nuevosEst = nombres.map((n) => ({
        id: `est-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        nombre: n,
        promedio: null,
      }));
      const detalle = [...(cursoExistente.estudiantesDetalle || []), ...nuevosEst];
      onActualizarCurso({ ...cursoExistente, estudiantesDetalle: detalle, estudiantes: detalle.length });
      guardarEstudiantesEnSubcoleccion(cursoExistente.id, nombres).catch(() => {});
    } else {
      setEstudiantesExtra((prev) => [...prev, ...nombres.map((n) => crearEstudianteExtra(n))]);
    }

    setListaTexto("");
    setModoLista(false);
    setFormNuevo({ nombre: "", cursoId: "", nombreCursoNuevo: "" });
    setModalAgregar(false);
  };

  const toggleRegistroCerrado = () => {
    const nuevoEstado = !registroCerrado;
    setRegistroCerrado(nuevoEstado);
    try { localStorage.setItem("docenteos_registro_cerrado", String(nuevoEstado)); } catch { /* */ }
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
  void totalTrend; // used by periodos calculations below
  const totalGrafico = Math.max(1, resumen.total);
  const restoGrafico = Math.max(0, resumen.total - resumen.enRiesgo - resumen.excelentes);
  const arcLen = (n) => (276 * n) / totalGrafico;

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
            <button
              type="button"
              className="est-btn-agregar"
              onClick={() => { setModoFoto(false); setModoLista(false); setModalAgregar(true); }}
            >
              ➕ Agregar estudiante
            </button>
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
                <button
                  type="button"
                  className="estudiantes-secondary"
                  onClick={() => setPeriodoExpandido(periodoExpandido === idx ? null : idx)}
                >
                  {periodoExpandido === idx ? "▲ Ocultar detalle" : "Ver detalle del período →"}
                </button>
                {periodoExpandido === idx && (
                  <div className="periodo-detalle-expandido">
                    <p><strong>Top estudiantes en riesgo — {periodo.nombre}:</strong></p>
                    {filtrados
                      .filter((e) => e.promedio < 65)
                      .sort((a, b) => a.promedio - b.promedio)
                      .slice(0, 5)
                      .map((e) => (
                        <div key={e.id} className="periodo-detalle-item" onClick={() => onAbrirPerfil(e)} style={{ cursor: "pointer" }}>
                          <span className="estudiante-avatar-inline">{e.avatar}</span>
                          <span>{e.nombre}</span>
                          <span className={`tabla-chip ${e.estado.clase}`}>{e.promedio}%</span>
                        </div>
                      ))}
                    {filtrados.filter((e) => e.promedio < 65).length === 0 && (
                      <p style={{ color: "#64748b", fontSize: "13px" }}>✅ Sin estudiantes en riesgo en este período.</p>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {(vistaEstudiantes === "General" || vistaEstudiantes === "Por Mes") && (
        <>

      {/* ── Banner del estudiante seleccionado ── */}
      {seleccionado && (
        <article className="est-banner">
          <div className="est-banner-identidad">
            <div className="est-banner-avatar">{seleccionado.avatar}</div>
            <div className="est-banner-info">
              <strong>{seleccionado.nombre}</strong>
              <span>{seleccionado.cursoNombre}</span>
              <span className={`tabla-chip ${seleccionado.estado.clase}`}>{seleccionado.estado.label}</span>
            </div>
          </div>
          <div className="est-banner-metricas">
            <div><span>Edad</span><b>{seleccionado.edad}</b></div>
            <div><span>Asistencia</span><b>{seleccionado.asistencia !== null ? `${seleccionado.asistencia}%` : "—"}</b></div>
            <div><span>Promedio</span><b>{seleccionado.promedio !== null ? `${seleccionado.promedio}%` : "—"}</b></div>
          </div>
          <div className="est-banner-contacto">
            <span>👨‍👩‍👧 {seleccionado.tutor}</span>
            <span>📞 {seleccionado.telefono}</span>
            <span>📅 Nac. {seleccionado.fechaNacimiento}</span>
          </div>
          <div className="est-banner-btns">
            <button type="button" className="secundario" onClick={() => onAbrirPerfil(seleccionado)}>👁 Ver perfil</button>
            <button
              type="button"
              className="secundario"
              disabled={panelIaGenerando}
              onClick={() => ejecutarIaEstudiante("informe", seleccionado)}
            >
              {panelIaGenerando && panelIaAccion === "informe" ? "⏳ Generando..." : "✨ Informe IA"}
            </button>
          </div>
        </article>
      )}

      {(panelIaTexto || panelIaGenerando) && (
        <div className="panel-ia-resultado est-banner-ia" ref={panelIaRef}>
          <div className="panel-ia-header">
            <span>{panelIaAccion === "informe" ? "Informe Individual IA" : "Recomendaciones IA"}</span>
            {panelIaGenerando && <span className="panel-ia-spinner">Generando...</span>}
            {!panelIaGenerando && (
              <button type="button" style={{ fontSize: "0.72rem", background: "none", border: "none", color: "#fff", cursor: "pointer", opacity: 0.7 }}
                onClick={() => { setPanelIaTexto(""); setPanelIaAccion(null); }}>✕</button>
            )}
          </div>
          <div className="panel-ia-content">
            {panelIaTexto.split("\n").map((line, i) => {
              if (line.startsWith("## ")) return <h4 key={i} className="plan-ia-h3" style={{ fontSize: "0.85rem" }}>{line.slice(3)}</h4>;
              if (line.startsWith("- ")) return <li key={i} className="plan-ia-li">{line.slice(2)}</li>;
              if (line.trim() === "") return <br key={i} />;
              return <p key={i} className="plan-ia-p">{line}</p>;
            })}
            {panelIaGenerando && <span className="plan-ia-cursor">▋</span>}
          </div>
        </div>
      )}

      {panelIaError && (
        <p style={{ color: "#dc2626", fontSize: "0.8rem", padding: "8px 14px" }}>⚠️ {panelIaError}</p>
      )}

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

      <section className="eg-triple-grid">

        {/* En Riesgo */}
        <article className="eg-card">
          <div className="eg-card-head">
            <div className="eg-card-title">
              <span className="eg-icon eg-icon-red">🚨</span>
              <div>
                <h3>Estudiantes en Riesgo</h3>
                <p>Seguimiento prioritario</p>
              </div>
            </div>
            <span className="eg-chip red">{topRiesgo.length}</span>
          </div>
          <div className="eg-list">
            {topRiesgo.length === 0 && <p className="eg-empty">✅ Sin estudiantes en riesgo.</p>}
            {topRiesgo.map((e) => (
              <div key={e.id} className="eg-row" onClick={() => onAbrirPerfil(e)}>
                <span className="eg-avatar red">{e.avatar}</span>
                <div className="eg-row-info">
                  <strong>{e.nombre}</strong>
                  <p>{e.cursoNombre}</p>
                </div>
                <div className="eg-score red">
                  <strong>{e.promedio}%</strong>
                  <span className={`nivel-riesgo-chip ${e.nivelRiesgo.toLowerCase()}`}>{e.nivelRiesgo}</span>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="eg-link" onClick={() => { setFEstado("riesgo"); }}>Ver todos los estudiantes en riesgo →</button>
        </article>

        {/* Destacados */}
        <article className="eg-card">
          <div className="eg-card-head">
            <div className="eg-card-title">
              <span className="eg-icon eg-icon-gold">⭐</span>
              <div>
                <h3>Estudiantes Destacados</h3>
                <p>Alto rendimiento sostenido</p>
              </div>
            </div>
            <span className="eg-chip gold">{topDestacados.length}</span>
          </div>
          <div className="eg-list">
            {topDestacados.length === 0 && <p className="eg-empty">Sin destacados todavía.</p>}
            {topDestacados.map((e) => (
              <div key={e.id} className="eg-row" onClick={() => onAbrirPerfil(e)}>
                <span className="eg-avatar gold">{e.avatar}</span>
                <div className="eg-row-info">
                  <strong>{e.nombre}</strong>
                  <p>{e.cursoNombre}</p>
                </div>
                <div className="eg-score gold">
                  <strong>{e.promedio}%</strong>
                  <span>{e.promedio >= 95 ? "Sobresaliente" : "Excelente"}</span>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="eg-link" onClick={() => { setFEstado("excelente"); }}>Ver todos los destacados →</button>
        </article>

        {/* Seguimiento Académico */}
        <article className="eg-card eg-card-donut">
          <div className="eg-card-head">
            <div className="eg-card-title">
              <span className="eg-icon eg-icon-blue">📊</span>
              <div>
                <h3>Seguimiento Académico</h3>
                <p>Distribución del grupo</p>
              </div>
            </div>
          </div>
          <div className="eg-donut-body">
            <div className="eg-donut-chart-wrap">
              <svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">
                <defs>
                  <linearGradient id="eg-grad-dest" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#818cf8" />
                    <stop offset="100%" stopColor="#3730a3" />
                  </linearGradient>
                  <linearGradient id="eg-grad-riesgo" x1="120" y1="0" x2="0" y2="120" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#fb7185" />
                    <stop offset="100%" stopColor="#9f1239" />
                  </linearGradient>
                  <filter id="eg-glow-dest" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                  <filter id="eg-glow-risk" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                {/* track */}
                <circle cx="60" cy="60" r="44" fill="none" stroke="#e8edf5" strokeWidth="12" />
                {/* destacados — azul/índigo */}
                <circle cx="60" cy="60" r="44" fill="none" stroke="url(#eg-grad-dest)" strokeWidth="12" strokeLinecap="round"
                  strokeDasharray={`${arcLen(resumen.excelentes)} 276`}
                  strokeDashoffset="0"
                  transform="rotate(-90 60 60)"
                  filter="url(#eg-glow-dest)"
                />
                {/* en progreso — gris neutro */}
                <circle cx="60" cy="60" r="44" fill="none" stroke="#c8d3e0" strokeWidth="12" strokeLinecap="round"
                  strokeDasharray={`${arcLen(restoGrafico)} 276`}
                  strokeDashoffset={`-${arcLen(resumen.excelentes)}`}
                  transform="rotate(-90 60 60)"
                />
                {/* en riesgo — rojo */}
                <circle cx="60" cy="60" r="44" fill="none" stroke="url(#eg-grad-riesgo)" strokeWidth="12" strokeLinecap="round"
                  strokeDasharray={`${arcLen(resumen.enRiesgo)} 276`}
                  strokeDashoffset={`-${arcLen(resumen.excelentes + restoGrafico)}`}
                  transform="rotate(-90 60 60)"
                  filter="url(#eg-glow-risk)"
                />
              </svg>
              <div className="eg-donut-center">
                <strong>{resumen.total}</strong>
                <span>total</span>
              </div>
            </div>
            <div className="eg-donut-legend">
              <div className="eg-legend-item eg-li-dest">
                <span />
                <div>
                  <b>{resumen.excelentes}</b>
                  <p>Destacados</p>
                </div>
              </div>
              <div className="eg-legend-item eg-li-neutral">
                <span />
                <div>
                  <b>{restoGrafico}</b>
                  <p>En progreso</p>
                </div>
              </div>
              <div className="eg-legend-item eg-li-risk">
                <span />
                <div>
                  <b>{resumen.enRiesgo}</b>
                  <p>En riesgo</p>
                </div>
              </div>
            </div>
          </div>
          <button type="button" className="eg-link" onClick={() => setVistaEstudiantes("Por Mes")}>Ver análisis completo →</button>
        </article>

      </section>

      <section className="estudiantes-shell">
        <div className="estudiantes-main">
          <article className="estudiantes-card">
            <div className="estudiantes-card-head">
              <div><h2>Lista de estudiantes ({filtrados.length})</h2></div>
              <div className="estudiantes-row-actions estudiantes-row-actions-top">
                <button type="button" className="secundario" onClick={exportarCSV}>📤 Exportar</button>
                <button
                  type="button"
                  className="secundario"
                  onClick={toggleRegistroCerrado}
                  title={registroCerrado ? "Registro oficial cerrado — los nuevos estudiantes quedan al final" : "Registro abierto — los nuevos estudiantes se ordenan alfabéticamente"}
                  style={{ color: registroCerrado ? "#dc2626" : "#059669", borderColor: registroCerrado ? "#dc2626" : "#059669" }}
                >
                  {registroCerrado ? "🔒 Registro cerrado" : "📋 Registro abierto"}
                </button>
                <button type="button" onClick={() => { setModoFoto(false); setModoLista(false); setModalAgregar(true); }}>➕ Agregar estudiante</button>
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
                    return (
                      <tr key={e.id} className={activo ? "activo" : ""} onClick={() => setSeleccionadoId(e.id)}>
                        <td><input type="checkbox" aria-label={`Seleccionar ${e.nombre}`} /></td>
                        <td><span className="estudiante-avatar-inline foto">{e.avatar}</span></td>
                        <td>
                          <strong>{e.nombre}</strong>
                          {e.tardio && <span style={{ fontSize: 10, background: "#fef3c7", color: "#92400e", borderRadius: 4, padding: "1px 5px", marginLeft: 6, verticalAlign: "middle" }}>Ingresó tarde</span>}
                          <small>{e.area}</small>
                        </td>
                        <td>{e.cursoNombre}</td>
                        <td><div className="promedio-cell">
                          {e.promedio !== null ? <><span className="estudiantes-table-score">{e.promedio}%</span><em className={e.tendenciaValor >= 0 ? "trend-up" : "trend-down"}>{e.tendenciaValor >= 0 ? "⬆" : "⬇"} {Math.abs(e.tendenciaValor)} pts</em></> : <span className="sin-nota-dash">—</span>}
                        </div></td>
                        <td>{e.asistencia !== null ? `${e.asistencia}%` : "—"}</td>
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

        <aside className="estudiantes-panel" style={{ display: "none" }}>
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
                  <h3>🤖 Alertas IA</h3>
                  <ul className="alertas-lista">
                    {seleccionado && seleccionado.promedio < 70 && (
                      <li>Promedio actual ({seleccionado.promedio}%) está por debajo del mínimo de aprobación.</li>
                    )}
                    {seleccionado && seleccionado.asistencia < 85 && (
                      <li>Asistencia ({seleccionado.asistencia}%) requiere seguimiento y comunicación familiar.</li>
                    )}
                    {seleccionado && seleccionado.nivelRiesgo === "Alto" && (
                      <li>Nivel de riesgo alto — se recomienda intervención pedagógica inmediata.</li>
                    )}
                  </ul>
                  <button
                    type="button"
                    className="secundario ia-recomendaciones-btn"
                    disabled={panelIaGenerando}
                    onClick={() => ejecutarIaEstudiante("recomendaciones", seleccionado)}
                  >
                    {panelIaGenerando && panelIaAccion === "recomendaciones" ? "⏳ Generando..." : "Ver recomendaciones IA"}
                  </button>
                </article>
                <button
                  type="button"
                  className="ancho-completo"
                  disabled={panelIaGenerando}
                  onClick={() => ejecutarIaEstudiante("informe", seleccionado)}
                >
                  {panelIaGenerando && panelIaAccion === "informe" ? "⏳ Generando informe..." : "✨ Generar Informe Individual IA"}
                </button>
                <p className="ia-informe-caption">Genera fortalezas, debilidades, acuerdos y recomendaciones para la familia.</p>

                {panelIaError && (
                  <p style={{ color: "#dc2626", fontSize: "0.8rem", marginTop: 8 }}>⚠️ {panelIaError}</p>
                )}
                {(panelIaTexto || panelIaGenerando) && (
                  <div className="panel-ia-resultado" ref={panelIaRef}>
                    <div className="panel-ia-header">
                      <span>{panelIaAccion === "informe" ? "Informe Individual IA" : "Recomendaciones IA"}</span>
                      {panelIaGenerando && <span className="panel-ia-spinner">Generando...</span>}
                      {!panelIaGenerando && (
                        <button type="button" style={{ fontSize: "0.72rem", background: "none", border: "none", color: "#fff", cursor: "pointer", opacity: 0.7 }}
                          onClick={() => { setPanelIaTexto(""); setPanelIaAccion(null); }}>✕</button>
                      )}
                    </div>
                    <div className="panel-ia-content">
                      {panelIaTexto.split("\n").map((line, i) => {
                        if (line.startsWith("## ")) return <h4 key={i} className="plan-ia-h3" style={{ fontSize: "0.85rem" }}>{line.slice(3)}</h4>;
                        if (line.startsWith("- ")) return <li key={i} className="plan-ia-li">{line.slice(2)}</li>;
                        if (line.trim() === "") return <br key={i} />;
                        return <p key={i} className="plan-ia-p">{line}</p>;
                      })}
                      {panelIaGenerando && <span className="plan-ia-cursor">▋</span>}
                    </div>
                  </div>
                )}
              </section>
            </article>
          )}
        </aside>
      </section>

      {modalAgregar && (
        <div className="ma-overlay" onClick={cerrarModalAgregar}>
          <div className="ma-card" onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="ma-header">
              <div className="ma-header-left">
                <div className="ma-header-icon">{modoFoto ? "📷" : modoLista ? "📋" : "👤"}</div>
                <div className="ma-header-text">
                  <h2>{modoFoto ? "Importar lista con IA" : modoLista ? "Pegar lista de nombres" : "Nuevo estudiante"}</h2>
                  <p>{modoFoto ? "Sube una foto — la IA lee los nombres" : modoLista ? "Pega los nombres, uno por línea" : "Completa los datos del estudiante"}</p>
                  {registroCerrado && <span className="ma-badge-cerrado">🔒 Registro cerrado — irá al final de la lista</span>}
                </div>
              </div>
              <button className="ma-close" onClick={cerrarModalAgregar}>✕</button>
            </div>

            {/* Tabs */}
            <div className="ma-tabs">
              <button type="button" className={`ma-tab ${!modoFoto && !modoLista ? "active" : "inactive"}`} onClick={() => { setModoFoto(false); setModoLista(false); }}>
                <span>✏️</span> Agregar uno
              </button>
              <button type="button" className={`ma-tab ${modoLista ? "active" : "inactive"}`} onClick={() => { setModoFoto(false); setModoLista(true); }}>
                <span>📋</span> Pegar lista
              </button>
              <button type="button" className={`ma-tab ${modoFoto ? "active" : "inactive"}`} onClick={() => { setModoFoto(true); setModoLista(false); setFotoError(null); }}>
                <span>📷</span> Foto con IA
              </button>
            </div>

            {/* Body */}
            <div className="ma-body">
              {modoLista ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div className="ma-field">
                    <label className="ma-label">Curso</label>
                    <select
                      className="ma-input"
                      value={formNuevo.cursoId}
                      onChange={(e) => setFormNuevo((p) => ({ ...p, cursoId: e.target.value }))}
                    >
                      <option value="">Sin asignar</option>
                      {cursos.map((c) => (
                        <option key={c.id} value={String(c.id)}>{c.nombre} · {c.area}</option>
                      ))}
                    </select>
                  </div>
                  <div className="ma-field">
                    <label className="ma-label">Lista de nombres <span style={{ fontWeight: 400, color: "#888" }}>(uno por línea)</span></label>
                    <textarea
                      className="ma-input"
                      rows={10}
                      placeholder={"Juan Pérez\nMaría García\nCarlos Díaz\n..."}
                      value={listaTexto}
                      onChange={(e) => setListaTexto(e.target.value)}
                      style={{ resize: "vertical", fontFamily: "inherit" }}
                    />
                  </div>
                  {listaTexto.trim() && (
                    <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
                      {listaTexto.split("\n").filter(l => l.trim()).length} nombre(s) detectado(s)
                    </p>
                  )}
                </div>
              ) : !modoFoto ? (
                <form id="ma-form-manual" onSubmit={agregarEstudiante}>
                  <div className="ma-field">
                    <label className="ma-label">Nombre completo</label>
                    <input
                      className="ma-input"
                      required
                      placeholder="Ej: Juan Carlos Pérez"
                      autoFocus
                      value={formNuevo.nombre}
                      onChange={(e) => setFormNuevo((p) => ({ ...p, nombre: e.target.value }))}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v) setFormNuevo((p) => ({ ...p, nombre: capitalizarNombre(v) }));
                      }}
                    />
                  </div>
                  <div className="ma-field">
                    <label className="ma-label">Curso</label>
                    <select
                      className="ma-input"
                      value={formNuevo.cursoId}
                      onChange={(e) => setFormNuevo((p) => ({ ...p, cursoId: e.target.value, nombreCursoNuevo: "" }))}
                    >
                      <option value="">— Selecciona un curso —</option>
                      {cursos.map((c) => (
                        <option key={c.id} value={c.id}>{c.nombre} · {c.area}</option>
                      ))}
                      <option value="_nuevo_">➕ Crear nuevo curso…</option>
                    </select>
                  </div>
                  {formNuevo.cursoId === "_nuevo_" && (
                    <div className="ma-field">
                      <label className="ma-label">Nombre del nuevo curso</label>
                      <input
                        className="ma-input"
                        placeholder="Ej: 1ro Secundaria A"
                        value={formNuevo.nombreCursoNuevo}
                        onChange={(e) => setFormNuevo((p) => ({ ...p, nombreCursoNuevo: e.target.value }))}
                      />
                    </div>
                  )}
                </form>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {!fotoPreview ? (
                    <label className="ma-upload-zone">
                      <input type="file" accept="image/*" onChange={handleFotoSelect} />
                      <div className="ma-upload-icon">📷</div>
                      <p className="ma-upload-title">Arrastra la foto aquí o haz clic</p>
                      <p className="ma-upload-desc">JPG, PNG, HEIC — hasta 20 MB</p>
                    </label>
                  ) : (
                    <>
                      <img src={fotoPreview} alt="Lista de estudiantes" className="ma-preview" />
                      <button
                        type="button"
                        style={{ fontSize: 12, background: "none", border: "none", color: "#64748b", cursor: "pointer", textDecoration: "underline", padding: 0, textAlign: "left" }}
                        onClick={() => { setFotoPreview(null); setFotoBase64(null); setNombresEditados([]); setFotoError(null); }}
                      >Cambiar imagen</button>
                    </>
                  )}

                  {fotoBase64 && nombresEditados.length === 0 && (
                    <button
                      type="button"
                      className={`ma-btn-ia${analizandoFoto ? " analyzing" : ""}`}
                      onClick={analizarFoto}
                      disabled={analizandoFoto}
                    >
                      {analizandoFoto ? (
                        <><span style={{ display: "inline-block", animation: "ma-spin 0.8s linear infinite" }}>⏳</span> Analizando imagen…</>
                      ) : (
                        <><span>✨</span> Analizar con IA</>
                      )}
                    </button>
                  )}

                  {fotoError && (
                    <div className="ma-error">
                      <span>⚠️</span> {fotoError}
                    </div>
                  )}

                  {nombresEditados.length > 0 && (
                    <div>
                      <div className="ma-names-header">
                        <span>Revisa y edita los nombres</span>
                        <span className="ma-names-count">{nombresEditados.filter((n) => n.nombre.trim()).length} estudiantes</span>
                      </div>
                      <div className="ma-names-list">
                        {nombresEditados.map((item, idx) => (
                          <div key={item.id} className="ma-name-row">
                            <span className="ma-name-num">{idx + 1}</span>
                            <input
                              className="ma-name-input"
                              value={item.nombre}
                              onChange={(e) => setNombresEditados((prev) => prev.map((n, i) => i === idx ? { ...n, nombre: e.target.value } : n))}
                              placeholder="Nombre completo…"
                            />
                            <button type="button" className="ma-name-del" onClick={() => setNombresEditados((prev) => prev.filter((_, i) => i !== idx))}>✕</button>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="ma-add-link"
                        onClick={() => setNombresEditados((prev) => [...prev, { id: Date.now(), nombre: "" }])}
                      >
                        <span>＋</span> Agregar nombre manualmente
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="ma-footer">
              {modoLista ? (
                <>
                  <button
                    type="button"
                    className="ma-btn-primary"
                    disabled={!listaTexto.trim()}
                    onClick={confirmarNombresLista}
                  >
                    ✅ Agregar {listaTexto.split("\n").filter(l => l.trim()).length} estudiante(s)
                  </button>
                  <button type="button" className="ma-btn-ghost" onClick={cerrarModalAgregar}>Cancelar</button>
                </>
              ) : !modoFoto ? (
                <>
                  <button type="submit" form="ma-form-manual" className="ma-btn-primary">
                    Guardar estudiante
                  </button>
                  <button type="button" className="ma-btn-ghost" onClick={cerrarModalAgregar}>
                    Cancelar
                  </button>
                </>
              ) : (
                <>
                  {nombresEditados.length > 0 && (
                    <button type="button" className="ma-btn-primary" onClick={confirmarNombresFoto}>
                      ✅ Agregar {nombresEditados.filter((n) => n.nombre.trim()).length} estudiantes
                    </button>
                  )}
                  <button type="button" className="ma-btn-ghost" onClick={cerrarModalAgregar}>
                    Cancelar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}


export default EstudiantesPage;
