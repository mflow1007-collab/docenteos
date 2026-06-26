import { useEffect, useMemo, useRef, useState } from "react";
import { obtenerPlanificacionesDetalladas, guardarInstrumentoFirestore, obtenerInstrumentosFirestore, eliminarInstrumentoFirestore } from "../firebase";
import "./InstrumentosPage.css";

const TIPOS_INSTRUMENTO = [
  "Rúbrica",
  "Lista de cotejo",
  "Escala de estimación",
  "Registro anecdótico",
  "Guía de observación",
  "Prueba escrita",
  "Proyecto",
  "Exposición oral",
  "Debate",
  "Portafolio",
];

const ESTADOS = ["Borrador", "Activo", "En uso", "Archivado"];
const TIPOS_CON_BLOQUE = ["Rúbrica", "Lista de cotejo", "Escala de estimación"];

const ESTUDIANTES_FALLBACK = [
  "Juan Pérez",
  "María Rodríguez",
  "Pedro Gómez",
  "Katherin Romero",
  "Carlos Méndez",
  "Fernanda Lozano",
  "Gabriel Ortiz",
  "Diana Suárez",
  "Ruth Encarnación",
  "Brayan Gómez",
  "Camila Rojas",
  "Javier Ureña",
];

const crearCriterio = (index = 0) => ({
  id: `crit-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
  criterio: ["Pronunciación", "Fluidez", "Vocabulario", "Comprensión", "Participación"][index % 5],
  nivel4: "Logro sobresaliente",
  nivel3: "Logro adecuado",
  nivel2: "Logro básico",
  nivel1: "En proceso",
});

const crearIndicador = (index = 0) => ({
  id: `ind-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
  indicador: ["Participa con claridad", "Aplica el conocimiento", "Colabora con el grupo", "Sustenta su respuesta"][index % 4],
  si: true,
  no: false,
});

const crearEscala = (index = 0) => ({
  id: `esc-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
  indicador: ["Dominio del contenido", "Presentación visual", "Uso de recursos", "Organización"][index % 4],
  excelente: "Siempre y con precisión",
  bueno: "Casi siempre",
  regular: "Ocasionalmente",
  necesitaApoyo: "Requiere guía",
});

const crearEstructuraPorTipo = (tipo) => {
  if (tipo === "Lista de cotejo") return { indicadores: [crearIndicador(0), crearIndicador(1), crearIndicador(2)] };
  if (tipo === "Escala de estimación") return { indicadores: [crearEscala(0), crearEscala(1), crearEscala(2)] };
  return { criterios: [crearCriterio(0), crearCriterio(1), crearCriterio(2)] };
};

const crearDraft = (tipo = "Rúbrica", curriculo = null) => ({
  id: null,
  tipo,
  nombre: "",
  descripcion: "",
  estado: "Borrador",
  curriculoId: curriculo?.id || "",
  estructura: crearEstructuraPorTipo(tipo),
});

const guardarLocal = (clave, valor) => localStorage.setItem(clave, JSON.stringify(valor));

const cargarLocal = (clave, fallback) => {
  try {
    const guardado = localStorage.getItem(clave);
    return guardado ? JSON.parse(guardado) : fallback;
  } catch {
    return fallback;
  }
};

const normalizarPlanificacion = (item, index) => {
  const meta = item?.metadatos || {};
  const data = item?.datosGenerales || {};
  const indicadores = Array.isArray(meta.indicadoresOficiales)
    ? meta.indicadoresOficiales
    : Array.isArray(data.indicadoresOficiales)
      ? data.indicadoresOficiales
      : [];

  return {
    id: item?.id || `plan-${index}`,
    curso: meta.curso || [meta.grado, meta.seccion].filter(Boolean).join(" ") || item?.curso || "Curso",
    area: meta.area || data.area || item?.area || "Área",
    asignatura: data.area || meta.area || item?.area || "Asignatura",
    grado: meta.grado || item?.grado || "Grado",
    periodo: meta.periodo || item?.periodo || "Periodo 1",
    competencia: meta.competenciaSeleccionada || data.competencia || item?.competencia || "Competencia específica",
    indicador: indicadores[0] || item?.indicador || "Indicador de logro",
    indicadores,
    titulo: `${meta.grado || item?.curso || "Curso"} · ${meta.area || data.area || item?.area || "Área"}`,
  };
};

const leerTipo = (instrumento) => instrumento?.tipo || "Rúbrica";

const claseTipoInstrumento = (tipo = "") => {
  const slug = tipo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `tipo-${slug || "general"}`;
};

const crearValorInicial = (tipo, estructura) => {
  if (tipo === "Lista de cotejo") {
    return Object.fromEntries((estructura?.indicadores || []).map((item) => [item.id, true]));
  }
  if (tipo === "Escala de estimación") {
    return Object.fromEntries((estructura?.indicadores || []).map((item) => [item.id, "4"]));
  }
  if (TIPOS_CON_BLOQUE.includes(tipo)) {
    return Object.fromEntries((estructura?.criterios || []).map((item) => [item.id, 4]));
  }
  return { calificacion: "", observacion: "" };
};

function InstrumentosPage({ cursos = [], onIrA = () => {} }) {
  const [planificaciones, setPlanificaciones] = useState([]);
  const [cargandoPlanificaciones, setCargandoPlanificaciones] = useState(true);
  const [instrumentosCargados, setInstrumentosCargados] = useState(false);
  const [instrumentos, setInstrumentos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("Todos");
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [filtroPeriodo, setFiltroPeriodo] = useState("Todos");
  const [modal, setModal] = useState(null);
  const [draft, setDraft] = useState(() => crearDraft());
  const [curriculoId, setCurriculoId] = useState("");
  const [instrumentoAplicar, setInstrumentoAplicar] = useState(null);
  const [estudianteAplicar, setEstudianteAplicar] = useState(ESTUDIANTES_FALLBACK[0]);
  const [evaluacionAplicar, setEvaluacionAplicar] = useState({});
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiDraft, setAiDraft] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const busquedaRef = useRef(null);
  const statsRef = useRef(null);
  const bancoRef = useRef(null);

  useEffect(() => {
    let activo = true;

    (async () => {
      setCargandoPlanificaciones(true);
      try {
        const resultado = await obtenerPlanificacionesDetalladas();
        if (!activo) return;
        const lista = Array.isArray(resultado?.data) ? resultado.data.map(normalizarPlanificacion) : [];
        setPlanificaciones(lista);
      } catch {
        if (activo) setPlanificaciones([]);
      } finally {
        if (activo) setCargandoPlanificaciones(false);
      }
    })();

    return () => {
      activo = false;
    };
  }, []);

  const curriculosDisponibles = useMemo(() => {
    if (planificaciones.length) return planificaciones;

    const desdeCursos = (cursos || []).slice(0, 6).map((curso, index) => ({
      id: curso.id || `curso-${index}`,
      curso: curso.nombre || curso.name || `Curso ${index + 1}`,
      area: curso.area || "Área",
      asignatura: curso.area || "Asignatura",
      grado: curso.nivel || "Grado",
      periodo: "Periodo 1",
      competencia: curso.temaActual || "Competencia específica",
      indicador: curso.temaActual || "Indicador de logro",
      titulo: `${curso.nombre || `Curso ${index + 1}`} · ${curso.area || "Área"}`,
    }));

    if (desdeCursos.length) return desdeCursos;

    return [
      { id: "fb-1", curso: "2do Secundaria A", area: "Matemática", asignatura: "Matemática", grado: "2do Secundaria", periodo: "Periodo 1", competencia: "Resuelve problemas con funciones lineales", indicador: "Modela situaciones usando relaciones lineales", titulo: "2do Secundaria A · Matemática" },
      { id: "fb-2", curso: "1ro Secundaria B", area: "Lengua Española", asignatura: "Lengua Española", grado: "1ro Secundaria", periodo: "Periodo 2", competencia: "Produce textos argumentativos", indicador: "Sustenta ideas con argumentos", titulo: "1ro Secundaria B · Lengua Española" },
      { id: "fb-3", curso: "6to Primaria", area: "Ciencias de la Naturaleza", asignatura: "Ciencias de la Naturaleza", grado: "6to Primaria", periodo: "Periodo 3", competencia: "Explica fenómenos naturales", indicador: "Relaciona causas y efectos", titulo: "6to Primaria · Ciencias de la Naturaleza" },
    ];
  }, [cursos, planificaciones]);

  useEffect(() => {
    if (!curriculoId && curriculosDisponibles.length) {
      setCurriculoId(curriculosDisponibles[0].id);
    }
  }, [curriculoId, curriculosDisponibles]);

  const curriculoActivo = useMemo(
    () => curriculosDisponibles.find((item) => item.id === curriculoId) || curriculosDisponibles[0] || null,
    [curriculoId, curriculosDisponibles]
  );

  // Cargar instrumentos desde Firestore al montar
  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const resultado = await obtenerInstrumentosFirestore();
        if (!activo) return;
        if (resultado.success && resultado.data.length > 0) {
          setInstrumentos(resultado.data);
        } else {
          const local = cargarLocal("docenteos_instrumentos_v1", []);
          if (activo && local.length > 0) setInstrumentos(local);
        }
      } catch {
        if (activo) {
          const local = cargarLocal("docenteos_instrumentos_v1", []);
          setInstrumentos(local);
        }
      } finally {
        if (activo) setInstrumentosCargados(true);
      }
    })();
    return () => { activo = false; };
  }, []);

  // Cache local (solo después de cargar para no sobrescribir datos de Firestore)
  useEffect(() => {
    if (instrumentosCargados) {
      guardarLocal("docenteos_instrumentos_v2", instrumentos);
    }
  }, [instrumentos, instrumentosCargados]);

  const instrumentosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return instrumentos.filter((item) => {
      const coincideTexto = !texto || [item.nombre, item.descripcion, item.curso, item.area, item.asignatura, item.competencia, item.indicador, item.tipo]
        .filter(Boolean)
        .some((valor) => String(valor).toLowerCase().includes(texto));
      const coincideTipo = filtroTipo === "Todos" || item.tipo === filtroTipo;
      const coincideEstado = filtroEstado === "Todos" || item.estado === filtroEstado;
      const coincidePeriodo = filtroPeriodo === "Todos" || item.periodo === filtroPeriodo;
      return coincideTexto && coincideTipo && coincideEstado && coincidePeriodo;
    });
  }, [instrumentos, busqueda, filtroTipo, filtroEstado, filtroPeriodo]);

  const cantidadInstrumentos = instrumentosFiltrados.length;

  const estadisticas = useMemo(() => {
    const contarTipo = (tipo) => instrumentos.filter((item) => item.tipo === tipo).length;
    return {
      total: instrumentos.length,
      rubricas: contarTipo("Rúbrica"),
      cotejo: contarTipo("Lista de cotejo"),
      escala: contarTipo("Escala de estimación"),
      anecdotico: contarTipo("Registro anecdótico"),
      utilizados: instrumentos.filter((item) => (item.aplicaciones || []).length > 0 || item.usos > 0).length,
    };
  }, [instrumentos]);

  useEffect(() => {
    if (!modal) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") setModal(null);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modal]);

  const abrirNuevo = (tipo = "Rúbrica") => {
    setDraft(crearDraft(tipo, curriculoActivo));
    setCurriculoId(curriculoActivo?.id || curriculosDisponibles[0]?.id || "");
    setModal("crear");
  };

  const abrirEdicion = (instrumento) => {
    const curriculo = curriculosDisponibles.find((item) => item.id === instrumento.curriculoId) || curriculoActivo;
    setCurriculoId(curriculo?.id || curriculosDisponibles[0]?.id || "");
    setDraft({
      id: instrumento.id,
      tipo: instrumento.tipo,
      nombre: instrumento.nombre,
      descripcion: instrumento.descripcion,
      estado: instrumento.estado,
      curriculoId: curriculo?.id || "",
      estructura: instrumento.estructura || crearEstructuraPorTipo(instrumento.tipo),
    });
    setModal("editar");
  };

  const crearConIA = () => {
    const prompt = aiPrompt.trim() || "Debate sobre contaminación ambiental";
    const texto = prompt.toLowerCase();
    const base = crearDraft("Rúbrica", curriculoActivo);

    base.nombre = prompt;
    base.descripcion = `Instrumento generado por IA para ${prompt}.`;
    base.estructura = {
      criterios: [
        { ...crearCriterio(0), criterio: texto.includes("debate") ? "Argumentación" : "Comprensión" },
        { ...crearCriterio(1), criterio: texto.includes("ambient") ? "Relación con el contexto" : "Organización" },
        { ...crearCriterio(2), criterio: "Evidencia y sustento" },
        { ...crearCriterio(3), criterio: "Participación" },
      ],
    };

    setAiDraft(base);
    setModal("ia");
  };

  const guardarInstrumento = () => {
    const tipo = draft.tipo || "Rúbrica";
    const instrumento = {
      id: draft.id || `ins-${Date.now()}`,
      tipo,
      nombre: draft.nombre || `${tipo} - ${curriculoActivo?.competencia || "Nuevo instrumento"}`,
      descripcion: draft.descripcion || "Diseño listo para usar.",
      curso: curriculoActivo?.curso || "Curso",
      area: curriculoActivo?.area || "Área",
      asignatura: curriculoActivo?.asignatura || curriculoActivo?.area || "Asignatura",
      grado: curriculoActivo?.grado || "Grado",
      periodo: curriculoActivo?.periodo || "Periodo 1",
      competencia: curriculoActivo?.competencia || "Competencia específica",
      indicador: curriculoActivo?.indicador || "Indicador de logro",
      fechaCreacion: draft.fechaCreacion || new Date().toISOString(),
      estado: draft.estado || "Borrador",
      usos: draft.usos || 0,
      curriculoId: curriculoActivo?.id || draft.curriculoId || "",
      vinculacion: {
        area: curriculoActivo?.area || "",
        asignatura: curriculoActivo?.asignatura || "",
        grado: curriculoActivo?.grado || "",
        curso: curriculoActivo?.curso || "",
        competenciaEspecifica: curriculoActivo?.competencia || "",
        indicadorLogro: curriculoActivo?.indicador || "",
        periodo: curriculoActivo?.periodo || "",
      },
      estructura: draft.estructura || crearEstructuraPorTipo(tipo),
      registroIntegracion: {
        competenciaEvaluada: curriculoActivo?.competencia || "",
        indicadorEvaluado: curriculoActivo?.indicador || "",
        calificacionObtenida: null,
        fecha: null,
        periodo: curriculoActivo?.periodo || "",
      },
      aplicaciones: draft.aplicaciones || [],
    };

    setInstrumentos((prev) => {
      const existe = prev.some((item) => item.id === instrumento.id);
      return existe ? prev.map((item) => (item.id === instrumento.id ? instrumento : item)) : [instrumento, ...prev];
    });
    guardarInstrumentoFirestore(instrumento).catch((err) => console.error("[Instrumentos] Error al guardar:", err));
    setModal(null);
    setMensaje({ tipo: "success", texto: "Instrumento guardado y listo para usar." });
    setTimeout(() => setMensaje(null), 2000);
  };

  const duplicarInstrumento = (instrumento) => {
    const copia = {
      ...instrumento,
      id: `ins-${Date.now()}`,
      nombre: `${instrumento.nombre} (copia)`,
      estado: "Borrador",
      fechaCreacion: new Date().toISOString(),
      aplicaciones: [],
      usos: 0,
    };
    setInstrumentos((prev) => [copia, ...prev]);
    guardarInstrumentoFirestore(copia).catch((err) => console.error("[Instrumentos] Error al duplicar:", err));
  };

  const eliminarInstrumento = (id) => {
    setInstrumentos((prev) => prev.filter((item) => item.id !== id));
    eliminarInstrumentoFirestore(id).catch((err) => console.error("[Instrumentos] Error al eliminar:", err));
  };

  const abrirAplicacion = (instrumento) => {
    setInstrumentoAplicar(instrumento);
    setEstudianteAplicar(ESTUDIANTES_FALLBACK[0]);
    setEvaluacionAplicar(crearValorInicial(instrumento.tipo, instrumento.estructura));
    setModal("aplicar");
  };

  const calcularResultado = (instrumento, evaluacion) => {
    if (!instrumento) return 0;
    const tipo = leerTipo(instrumento);

    if (tipo === "Lista de cotejo") {
      const indicadores = instrumento.estructura?.indicadores || [];
      const positivos = indicadores.filter((item) => evaluacion[item.id]).length;
      return indicadores.length ? Math.round((positivos / indicadores.length) * 100) : 0;
    }

    if (tipo === "Escala de estimación") {
      const valores = Object.values(evaluacion).map(Number).filter((valor) => Number.isFinite(valor));
      return valores.length ? Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 25) : 0;
    }

    if (TIPOS_CON_BLOQUE.includes(tipo)) {
      const valores = Object.values(evaluacion).map(Number).filter((valor) => Number.isFinite(valor));
      return valores.length ? Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 25) : 0;
    }

    const calificacion = Number(evaluacion.calificacion || 0);
    return Number.isFinite(calificacion) ? calificacion : 0;
  };

  const guardarAplicacion = () => {
    if (!instrumentoAplicar) return;

    const calificacion = calcularResultado(instrumentoAplicar, evaluacionAplicar);
    const registro = {
      estudiante: estudianteAplicar,
      fecha: new Date().toISOString(),
      periodo: instrumentoAplicar.periodo,
      competenciaEvaluada: instrumentoAplicar.competencia,
      indicadorEvaluado: instrumentoAplicar.indicador,
      calificacionObtenida: calificacion,
      observacion: evaluacionAplicar.observacion || "",
      detalle: evaluacionAplicar,
    };

    setInstrumentos((prev) => {
      const actualizados = prev.map((item) => {
        if (item.id !== instrumentoAplicar.id) return item;
        return {
          ...item,
          usos: (item.usos || 0) + 1,
          estado: item.estado === "Borrador" ? "Activo" : item.estado,
          aplicaciones: [...(item.aplicaciones || []), registro],
          registroIntegracion: {
            competenciaEvaluada: item.competencia,
            indicadorEvaluado: item.indicador,
            calificacionObtenida: calificacion,
            fecha: registro.fecha,
            periodo: item.periodo,
          },
        };
      });
      const actualizado = actualizados.find((i) => i.id === instrumentoAplicar.id);
      if (actualizado) guardarInstrumentoFirestore(actualizado).catch((err) => console.error("[Instrumentos] Error al guardar aplicación:", err));
      return actualizados;
    });

    setModal(null);
    setMensaje({ tipo: "success", texto: "Aplicación registrada y preparada para Registro." });
    setTimeout(() => setMensaje(null), 2500);
  };

  const filasConstructor = useMemo(() => {
    if (draft.tipo === "Lista de cotejo") return draft.estructura?.indicadores || [];
    if (draft.tipo === "Escala de estimación") return draft.estructura?.indicadores || [];
    return draft.estructura?.criterios || [];
  }, [draft]);

  const aplicarFiltroRapido = (tipo) => {
    setFiltroTipo(tipo);
    bancoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const abrirNuevoConTipo = (tipo) => {
    abrirNuevo(tipo);
  };

  const modificarFila = (index, clave, valor) => {
    setDraft((prev) => {
      if (prev.tipo === "Lista de cotejo") {
        return {
          ...prev,
          estructura: {
            ...prev.estructura,
            indicadores: prev.estructura.indicadores.map((item, filaIndex) => (filaIndex === index ? { ...item, [clave]: valor } : item)),
          },
        };
      }

      if (prev.tipo === "Escala de estimación") {
        return {
          ...prev,
          estructura: {
            ...prev.estructura,
            indicadores: prev.estructura.indicadores.map((item, filaIndex) => (filaIndex === index ? { ...item, [clave]: valor } : item)),
          },
        };
      }

      return {
        ...prev,
        estructura: {
          ...prev.estructura,
          criterios: prev.estructura.criterios.map((item, filaIndex) => (filaIndex === index ? { ...item, [clave]: valor } : item)),
        },
      };
    });
  };

  const agregarFila = () => {
    setDraft((prev) => {
      if (prev.tipo === "Lista de cotejo") {
        const indicadores = prev.estructura?.indicadores || [];
        return { ...prev, estructura: { ...prev.estructura, indicadores: [...indicadores, crearIndicador(indicadores.length)] } };
      }

      if (prev.tipo === "Escala de estimación") {
        const indicadores = prev.estructura?.indicadores || [];
        return { ...prev, estructura: { ...prev.estructura, indicadores: [...indicadores, crearEscala(indicadores.length)] } };
      }

      const criterios = prev.estructura?.criterios || [];
      return { ...prev, estructura: { ...prev.estructura, criterios: [...criterios, crearCriterio(criterios.length)] } };
    });
  };

  const eliminarFila = (index) => {
    setDraft((prev) => {
      if (prev.tipo === "Lista de cotejo") {
        return {
          ...prev,
          estructura: {
            ...prev.estructura,
            indicadores: prev.estructura.indicadores.filter((_, filaIndex) => filaIndex !== index),
          },
        };
      }

      if (prev.tipo === "Escala de estimación") {
        return {
          ...prev,
          estructura: {
            ...prev.estructura,
            indicadores: prev.estructura.indicadores.filter((_, filaIndex) => filaIndex !== index),
          },
        };
      }

      return {
        ...prev,
        estructura: {
          ...prev.estructura,
          criterios: prev.estructura.criterios.filter((_, filaIndex) => filaIndex !== index),
        },
      };
    });
  };

  return (
    <div className="instrumentos-page">
      <section className="instrumentos-hero panel-soft">
        <div>
          <p className="instrumentos-kicker">DocenteOS · Instrumentos</p>
          <h1>📋 Banco de Instrumentos</h1>
          <p>
            Sistema profesional de evaluación alineado al currículo por competencias del MINERD, listo para conectar con Planificación, Registro e IA.
          </p>
        </div>

        <div className="instrumentos-hero-actions">
          <button className="primary-btn" onClick={() => abrirNuevo("Rúbrica")}>➕ Nuevo Instrumento</button>
          <button className="ghost-btn" onClick={() => busquedaRef.current?.focus()}>🔍 Buscar Instrumento</button>
          <button className="ghost-btn" onClick={() => {
            setFiltroTipo("Todos");
            setFiltroEstado("Todos");
            setFiltroPeriodo("Todos");
            statsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}>📂 Filtrar</button>
          <button className="ghost-btn" onClick={() => statsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>📊 Estadísticas</button>
        </div>
      </section>

      {mensaje && <div className={`instrumentos-alert ${mensaje.tipo}`}>{mensaje.texto}</div>}

      <section ref={statsRef} className="instrumentos-stats-grid">
        <article className="stat-card stat-total">
          <span>Total instrumentos</span>
          <strong>{estadisticas.total}</strong>
        </article>
        <article className="stat-card stat-blue">
          <span>Rúbricas</span>
          <strong>{estadisticas.rubricas}</strong>
        </article>
        <article className="stat-card stat-teal">
          <span>Listas de cotejo</span>
          <strong>{estadisticas.cotejo}</strong>
        </article>
        <article className="stat-card stat-amber">
          <span>Escalas de estimación</span>
          <strong>{estadisticas.escala}</strong>
        </article>
        <article className="stat-card stat-violet">
          <span>Registro anecdótico</span>
          <strong>{estadisticas.anecdotico}</strong>
        </article>
        <article className="stat-card stat-green">
          <span>Usados este período</span>
          <strong>{estadisticas.utilizados}</strong>
        </article>
      </section>

      <section className="instrumentos-grid">
        <article ref={bancoRef} className="instrumentos-panel panel-soft instrumentos-banco">
          <div className="panel-head-inline banco-head">
            <div className="banco-title-wrap">
              <span className="banco-kicker">Centro de evaluacion</span>
              <h2>Banco activo</h2>
              <p>{cargandoPlanificaciones ? "Cargando planificación curricular..." : `${instrumentosFiltrados.length} instrumentos disponibles`}</p>
            </div>
            <div className="panel-head-actions">
              <span className="banco-count-pill">{cantidadInstrumentos}</span>
              <button className="mini-btn mini-btn-accent" onClick={() => onIrA("planificacion")}>Ir a Planificación</button>
              <button className="mini-btn" onClick={() => onIrA("registro")}>Ir a Registro</button>
            </div>
          </div>

          <div className="instrumentos-filtros banco-filtros">
            <input ref={busquedaRef} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar instrumento, curso, competencia..." />
            <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
              <option value="Todos">Todos los tipos</option>
              {TIPOS_INSTRUMENTO.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
            </select>
            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
              <option value="Todos">Todos los estados</option>
              {ESTADOS.map((estado) => <option key={estado} value={estado}>{estado}</option>)}
            </select>
            <select value={filtroPeriodo} onChange={(e) => setFiltroPeriodo(e.target.value)}>
              <option value="Todos">Todos los períodos</option>
              {["Periodo 1", "Periodo 2", "Periodo 3", "Periodo 4"].map((periodo) => <option key={periodo} value={periodo}>{periodo}</option>)}
            </select>
          </div>

          <div className="instrumentos-quickchips">
            {TIPOS_INSTRUMENTO.map((tipo) => (
              <button key={tipo} className={`chip ${filtroTipo === tipo ? "active" : ""}`} onClick={() => aplicarFiltroRapido(tipo)}>{tipo}</button>
            ))}
          </div>

          <div className="instrumentos-lista">
            {instrumentosFiltrados.map((instrumento) => (
              <article key={instrumento.id} className={`instrumento-card ${claseTipoInstrumento(instrumento.tipo)}`}>
                <header>
                  <div>
                    <span className="tipo-pill">{instrumento.tipo}</span>
                    <h3>{instrumento.nombre}</h3>
                  </div>
                  <span className={`estado-pill ${String(instrumento.estado || "").toLowerCase().replace(/\s/g, "-")}`}>{instrumento.estado}</span>
                </header>

                <p>{instrumento.descripcion}</p>

                <div className="meta-lineas">
                  <span>{instrumento.grado}</span>
                  <span>{instrumento.area}</span>
                  <span>{instrumento.periodo}</span>
                </div>

                <div className="meta-curricular">
                  <div>
                    <small>Competencia</small>
                    <strong>{instrumento.competencia}</strong>
                  </div>
                  <div>
                    <small>Indicador</small>
                    <strong>{instrumento.indicador}</strong>
                  </div>
                </div>

                <div className="card-footer">
                  <span className="application-count">{(instrumento.aplicaciones || []).length} aplicaciones</span>
                  <div className="card-actions">
                    <button onClick={() => abrirAplicacion(instrumento)}>📝 Aplicar</button>
                    <button onClick={() => abrirEdicion(instrumento)}>Editar</button>
                    <button onClick={() => duplicarInstrumento(instrumento)}>Duplicar</button>
                    <button className="danger-btn" onClick={() => eliminarInstrumento(instrumento.id)}>Eliminar</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </article>

        <aside className="instrumentos-aside">
          <article className="instrumentos-panel panel-soft ai-card">
            <div className="panel-head-inline compact">
              <div>
                <h2>✨ Crear Instrumento con IA</h2>
                <p>Simulación generativa lista para convertir ideas en rúbricas o listas de cotejo.</p>
              </div>
            </div>
            <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder='Ej.: Debate sobre contaminación ambiental' />
            <div className="ai-actions">
              <button className="primary-btn" onClick={crearConIA}>Generar</button>
              <button className="ghost-btn" onClick={() => setAiDraft(null)}>Limpiar</button>
            </div>
            {aiDraft && (
              <div className="ai-preview">
                <span className="tipo-pill">Rúbrica generada</span>
                <h3>{aiDraft.nombre}</h3>
                <p>{aiDraft.descripcion}</p>
                <button className="primary-btn full" onClick={() => {
                  setDraft(aiDraft);
                  setCurriculoId(curriculoActivo?.id || curriculosDisponibles[0]?.id || "");
                  setModal("crear");
                }}>Abrir para guardar</button>
              </div>
            )}
          </article>

          <article className="instrumentos-panel panel-soft vinculo-card">
            <div className="panel-head-inline compact">
              <div>
                <h2>Vinculación curricular</h2>
                <p>Competencias e indicadores cargados desde planificaciones existentes.</p>
              </div>
            </div>
            <label className="select-wrap">
              <span>Planificación fuente</span>
              <select value={curriculoId} onChange={(e) => setCurriculoId(e.target.value)}>
                {curriculosDisponibles.map((curriculo) => <option key={curriculo.id} value={curriculo.id}>{curriculo.titulo}</option>)}
              </select>
            </label>
            <div className="vinculo-datos">
              <div><small>Área</small><strong>{curriculoActivo?.area || "—"}</strong></div>
              <div><small>Asignatura</small><strong>{curriculoActivo?.asignatura || "—"}</strong></div>
              <div><small>Grado</small><strong>{curriculoActivo?.grado || "—"}</strong></div>
              <div><small>Curso</small><strong>{curriculoActivo?.curso || "—"}</strong></div>
              <div><small>Competencia específica</small><strong>{curriculoActivo?.competencia || "—"}</strong></div>
              <div><small>Indicador de logro</small><strong>{curriculoActivo?.indicador || "—"}</strong></div>
              <div><small>Período</small><strong>{curriculoActivo?.periodo || "—"}</strong></div>
            </div>
          </article>
        </aside>
      </section>

      <section className="instrumentos-template-grid">
        {TIPOS_INSTRUMENTO.map((tipo) => (
          <article key={tipo} className={`template-card ${claseTipoInstrumento(tipo)}`}>
            <div className="template-top">
              <span>{tipo}</span>
              <button onClick={() => abrirNuevoConTipo(tipo)}>Usar plantilla</button>
            </div>
            <p>
              {tipo === "Rúbrica" && "Tabla editable de criterios y niveles para evaluar desempeño."}
              {tipo === "Lista de cotejo" && "Indicadores observables con porcentaje automático de logro."}
              {tipo === "Escala de estimación" && "Valoración por niveles con opciones dinámicas."}
              {tipo === "Registro anecdótico" && "Notas descriptivas para seguimiento cualitativo."}
              {tipo === "Guía de observación" && "Matriz de observación directa vinculada al currículo."}
              {tipo === "Prueba escrita" && "Instrumento formal con calificación y retroalimentación."}
              {tipo === "Proyecto" && "Evaluación por producto, proceso y evidencia."}
              {tipo === "Exposición oral" && "Observación del discurso, claridad y argumentación."}
              {tipo === "Debate" && "Argumentación, escucha activa y participación."}
              {tipo === "Portafolio" && "Compilación de evidencias y seguimiento longitudinal."}
            </p>
          </article>
        ))}
      </section>

      <section className="instrumentos-panel panel-soft integracion-panel">
        <div className="panel-head-inline">
          <div>
            <h2>Preparado para Registro</h2>
            <p>La estructura ya guarda competencia, indicador, calificación, fecha y período para conectar con Registro luego.</p>
          </div>
        </div>
        <div className="integracion-grid">
          {[
            ["Competencia evaluada", curriculoActivo?.competencia || "—"],
            ["Indicador evaluado", curriculoActivo?.indicador || "—"],
            ["Calificación obtenida", "—"],
            ["Fecha", new Date().toLocaleDateString("es-DO")],
            ["Período", curriculoActivo?.periodo || "—"],
          ].map(([label, value]) => (
            <article key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </div>
      </section>

      {modal === "crear" && (
        <div className="modal-overlay-instrumentos" role="dialog" aria-modal="true">
          <div className="modal-card-instrumentos">
            <header>
              <div>
                <p>Nuevo instrumento</p>
                <h2>{draft.tipo}</h2>
              </div>
              <button className="close-btn" onClick={() => setModal(null)}>×</button>
            </header>

            <div className="modal-main-grid">
              <div className="modal-form-col">
                <label>
                  Tipo de instrumento
                  <select value={draft.tipo} onChange={(e) => setDraft((prev) => ({ ...crearDraft(e.target.value, curriculoActivo), id: prev.id, tipo: e.target.value, curriculoId }))}>
                    {TIPOS_INSTRUMENTO.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
                  </select>
                </label>

                <label>
                  Nombre
                  <input value={draft.nombre} onChange={(e) => setDraft((prev) => ({ ...prev, nombre: e.target.value }))} placeholder="Escribe el nombre del instrumento" />
                </label>

                <label>
                  Descripción
                  <textarea value={draft.descripcion} onChange={(e) => setDraft((prev) => ({ ...prev, descripcion: e.target.value }))} placeholder="Describe qué evalúa y cómo se usará" />
                </label>

                <label>
                  Estado
                  <select value={draft.estado} onChange={(e) => setDraft((prev) => ({ ...prev, estado: e.target.value }))}>
                    {ESTADOS.map((estado) => <option key={estado} value={estado}>{estado}</option>)}
                  </select>
                </label>

                <label>
                  Vinculación curricular
                  <select value={curriculoId} onChange={(e) => setCurriculoId(e.target.value)}>
                    {curriculosDisponibles.map((curriculo) => <option key={curriculo.id} value={curriculo.id}>{curriculo.titulo}</option>)}
                  </select>
                </label>

                <div className="form-tags">
                  <span>{curriculoActivo?.area}</span>
                  <span>{curriculoActivo?.grado}</span>
                  <span>{curriculoActivo?.periodo}</span>
                  <span>{curriculoActivo?.competencia}</span>
                  <span>{curriculoActivo?.indicador}</span>
                </div>
              </div>

              <div className="modal-builder-col">
                <div className="builder-head">
                  <strong>Constructor visual</strong>
                  <span>{draft.tipo}</span>
                </div>

                {draft.tipo === "Rúbrica" && (
                  <table className="builder-table">
                    <thead>
                      <tr>
                        <th>Criterio</th>
                        <th>Nivel 4</th>
                        <th>Nivel 3</th>
                        <th>Nivel 2</th>
                        <th>Nivel 1</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filasConstructor.map((fila, index) => (
                        <tr key={fila.id}>
                          <td><input value={fila.criterio} onChange={(e) => modificarFila(index, "criterio", e.target.value)} /></td>
                          <td><input value={fila.nivel4} onChange={(e) => modificarFila(index, "nivel4", e.target.value)} /></td>
                          <td><input value={fila.nivel3} onChange={(e) => modificarFila(index, "nivel3", e.target.value)} /></td>
                          <td><input value={fila.nivel2} onChange={(e) => modificarFila(index, "nivel2", e.target.value)} /></td>
                          <td><input value={fila.nivel1} onChange={(e) => modificarFila(index, "nivel1", e.target.value)} /></td>
                          <td><button className="icon-btn" onClick={() => eliminarFila(index)}>🗑</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {draft.tipo === "Lista de cotejo" && (
                  <table className="builder-table simple">
                    <thead>
                      <tr>
                        <th>Indicador</th>
                        <th>Sí</th>
                        <th>No</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filasConstructor.map((fila, index) => (
                        <tr key={fila.id}>
                          <td><input value={fila.indicador} onChange={(e) => modificarFila(index, "indicador", e.target.value)} /></td>
                          <td><input type="checkbox" checked={fila.si} onChange={(e) => modificarFila(index, "si", e.target.checked)} /></td>
                          <td><input type="checkbox" checked={fila.no} onChange={(e) => modificarFila(index, "no", e.target.checked)} /></td>
                          <td><button className="icon-btn" onClick={() => eliminarFila(index)}>🗑</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {draft.tipo === "Escala de estimación" && (
                  <table className="builder-table simple escala">
                    <thead>
                      <tr>
                        <th>Indicador</th>
                        <th>Excelente</th>
                        <th>Bueno</th>
                        <th>Regular</th>
                        <th>Necesita apoyo</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filasConstructor.map((fila, index) => (
                        <tr key={fila.id}>
                          <td><input value={fila.indicador} onChange={(e) => modificarFila(index, "indicador", e.target.value)} /></td>
                          <td><input value={fila.excelente} onChange={(e) => modificarFila(index, "excelente", e.target.value)} /></td>
                          <td><input value={fila.bueno} onChange={(e) => modificarFila(index, "bueno", e.target.value)} /></td>
                          <td><input value={fila.regular} onChange={(e) => modificarFila(index, "regular", e.target.value)} /></td>
                          <td><input value={fila.necesitaApoyo} onChange={(e) => modificarFila(index, "necesitaApoyo", e.target.value)} /></td>
                          <td><button className="icon-btn" onClick={() => eliminarFila(index)}>🗑</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {!TIPOS_CON_BLOQUE.includes(draft.tipo) && (
                  <div className="generic-template">
                    <p>Plantilla lista para construir observaciones, evidencias y criterios de desempeño para este tipo de instrumento.</p>
                    <div className="template-tags">
                      <span>Área</span>
                      <span>Competencia</span>
                      <span>Indicador</span>
                      <span>Fecha</span>
                      <span>Período</span>
                    </div>
                  </div>
                )}

                <div className="builder-actions">
                  <button className="ghost-btn" onClick={agregarFila}>➕ Agregar</button>
                  <button className="primary-btn" onClick={guardarInstrumento}>Guardar instrumento</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {modal === "aplicar" && instrumentoAplicar && (
        <div className="modal-overlay-instrumentos" role="dialog" aria-modal="true">
          <div className="modal-card-instrumentos wide">
            <header>
              <div>
                <p>Aplicar instrumento</p>
                <h2>{instrumentoAplicar.nombre}</h2>
              </div>
              <button className="close-btn" onClick={() => setModal(null)}>×</button>
            </header>

            <div className="aplicar-grid">
              <aside className="estudiantes-panel">
                <h3>Estudiantes</h3>
                {ESTUDIANTES_FALLBACK.map((estudiante) => (
                  <button key={estudiante} className={estudianteAplicar === estudiante ? "estudiante-item active" : "estudiante-item"} onClick={() => setEstudianteAplicar(estudiante)}>
                    {estudiante}
                  </button>
                ))}
              </aside>

              <section className="evaluacion-panel">
                <div className="evaluacion-resumen">
                  <span>{instrumentoAplicar.tipo}</span>
                  <strong>{instrumentoAplicar.periodo}</strong>
                  <p>{instrumentoAplicar.competencia}</p>
                </div>

                <h3>{estudianteAplicar}</h3>

                {leerTipo(instrumentoAplicar) === "Lista de cotejo" && (
                  <div className="aplicar-items">
                    {(instrumentoAplicar.estructura?.indicadores || []).map((item) => (
                      <label key={item.id} className="aplicar-item">
                        <span>{item.indicador}</span>
                        <div>
                          <button className={evaluacionAplicar[item.id] === true ? "toggle active" : "toggle"} onClick={() => setEvaluacionAplicar((prev) => ({ ...prev, [item.id]: true }))}>Sí</button>
                          <button className={evaluacionAplicar[item.id] === false ? "toggle active" : "toggle"} onClick={() => setEvaluacionAplicar((prev) => ({ ...prev, [item.id]: false }))}>No</button>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                {leerTipo(instrumentoAplicar) === "Escala de estimación" && (
                  <div className="aplicar-items">
                    {(instrumentoAplicar.estructura?.indicadores || []).map((item) => (
                      <label key={item.id} className="aplicar-item escala">
                        <span>{item.indicador}</span>
                        <select value={evaluacionAplicar[item.id] || ""} onChange={(e) => setEvaluacionAplicar((prev) => ({ ...prev, [item.id]: e.target.value }))}>
                          <option value="">Seleccionar</option>
                          <option value="4">Excelente</option>
                          <option value="3">Bueno</option>
                          <option value="2">Regular</option>
                          <option value="1">Necesita apoyo</option>
                        </select>
                      </label>
                    ))}
                  </div>
                )}

                {leerTipo(instrumentoAplicar) === "Rúbrica" && (
                  <div className="aplicar-rubrica">
                    {(instrumentoAplicar.estructura?.criterios || []).map((criterio) => (
                      <article key={criterio.id} className="rubrica-row">
                        <div>
                          <strong>{criterio.criterio}</strong>
                        </div>
                        <div className="niveles">
                          {[4, 3, 2, 1].map((nivel) => (
                            <button key={nivel} className={Number(evaluacionAplicar[criterio.id]) === nivel ? "nivel active" : "nivel"} onClick={() => setEvaluacionAplicar((prev) => ({ ...prev, [criterio.id]: nivel }))}>
                              Nivel {nivel}
                            </button>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                )}

                {!TIPOS_CON_BLOQUE.includes(leerTipo(instrumentoAplicar)) && (
                  <div className="aplicar-textual">
                    <label>
                      Calificación / evidencia
                      <input type="number" min="0" max="100" value={evaluacionAplicar.calificacion || ""} onChange={(e) => setEvaluacionAplicar((prev) => ({ ...prev, calificacion: e.target.value }))} placeholder="0-100" />
                    </label>
                    <label>
                      Observación
                      <textarea value={evaluacionAplicar.observacion || ""} onChange={(e) => setEvaluacionAplicar((prev) => ({ ...prev, observacion: e.target.value }))} />
                    </label>
                  </div>
                )}

                <div className="evaluacion-actions">
                  <button className="ghost-btn" onClick={() => setModal(null)}>Cancelar</button>
                  <button className="primary-btn" onClick={guardarAplicacion}>Guardar resultado</button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {modal === "ia" && aiDraft && (
        <div className="modal-overlay-instrumentos" role="dialog" aria-modal="true">
          <div className="modal-card-instrumentos wide ai-generated">
            <header>
              <div>
                <p>Creado con IA</p>
                <h2>{aiDraft.nombre}</h2>
              </div>
              <button className="close-btn" onClick={() => setModal(null)}>×</button>
            </header>

            <div className="ai-generated-grid">
              <article>
                <h3>Competencias</h3>
                <p>{curriculoActivo?.competencia || "Competencia generada automáticamente."}</p>
              </article>
              <article>
                <h3>Indicadores</h3>
                <p>{curriculoActivo?.indicador || "Indicadores generados automáticamente."}</p>
              </article>
              <article>
                <h3>Criterios</h3>
                {(aiDraft.estructura?.criterios || []).map((criterio) => <div key={criterio.id}>{criterio.criterio}</div>)}
              </article>
              <article>
                <h3>Rúbrica completa</h3>
                {(aiDraft.estructura?.criterios || []).map((criterio) => (
                  <div key={criterio.id} className="ai-rubric-row">
                    <strong>{criterio.criterio}</strong>
                    <span>{criterio.nivel4}</span>
                    <span>{criterio.nivel3}</span>
                    <span>{criterio.nivel2}</span>
                    <span>{criterio.nivel1}</span>
                  </div>
                ))}
              </article>
            </div>

            <div className="evaluacion-actions">
              <button className="ghost-btn" onClick={() => setModal(null)}>Cerrar</button>
              <button className="primary-btn" onClick={() => {
                setDraft(aiDraft);
                setCurriculoId(curriculoActivo?.id || curriculosDisponibles[0]?.id || "");
                setModal("crear");
              }}>Abrir para guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InstrumentosPage;
