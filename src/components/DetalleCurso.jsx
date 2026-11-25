import { useState, useRef, useEffect } from "react";
import { normalizarHorarioCurso, crearHorarioPredeterminado } from "../utils/horarioCurso.js";
import { guardarHorarioCurso, guardarPreferenciaUsuario, obtenerPreferenciaUsuario } from "../firebase.js";
import { AIService } from "../services/ai/AIService.js";
import { buildAIContext } from "../services/ai/ContextBuilder.js";
import { EventTracker } from "../services/ai/learning/EventTracker.js";
import { LEARNING_EVENTS, AGENT_IDS } from "../services/ai/knowledge/KnowledgeTypes.js";
import { enriquecerCursoInicial } from "../utils/cursoUtils.js";
import { clasesDelDia, nombreHora, proximaClase } from "../utils/horarioSemanal.js";
import { fechaLocalISO } from "../services/hiloPedagogico.js";
import HorarioSemanal from "./HorarioSemanal.jsx";

function DetalleCurso({ curso, cursos = [], onGuardarHorarios, onVolver, onEditarCurso, onActualizarCurso, onEliminarCurso, initialTab = "Resumen", onIrA = () => {} }) {
  const claveDiaHorario = `docenteos_detalle_dia_horario_${curso?.id || "curso-fallback"}`;
  const [tabActiva, setTabActiva] = useState(initialTab);
  const [busquedaEstudiante, setBusquedaEstudiante] = useState("");
  const [mostrarMenuCurso, setMostrarMenuCurso] = useState(false);
  const [mensajeHorario, setMensajeHorario] = useState(null);
  const [iaApoyoTexto, setIaApoyoTexto] = useState("");
  const [iaApoyoGenerando, setIaApoyoGenerando] = useState(false);
  const [iaApoyoError, setIaApoyoError] = useState(null);
  const iaApoyoRef = useRef(null);

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
  const aMinutos = (hora) => {
    const [h, m] = String(hora || "00:00").split(":").map(Number);
    return (h * 60) + m;
  };

  const aHora12 = (hora) => {
    const [hStr, mStr] = String(hora || "00:00").split(":");
    const h = Number(hStr);
    const periodo = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${mStr} ${periodo}`;
  };

  const [diaVistaHorario, setDiaVistaHorario] = useState("");
  const [diaHorarioListo, setDiaHorarioListo] = useState(false);

  const sugerirApoyoCurso = async () => {
    setIaApoyoTexto("");
    setIaApoyoError(null);
    setIaApoyoGenerando(true);

    let ctx;
    try {
      ctx = await buildAIContext("sugerir_apoyo", {
        area:                data.area  || "",
        grado:               data.nivel || "Secundaria",
        estudiantesEnRiesgo: (data.enRiesgo || []).map((e) => ({
          nombre: e.nombre,
          cf:     e.promedio ?? 0,
        })),
        promedioGrupo: data.promedio ?? null,
      });
    } catch {
      setIaApoyoError("No se pudo construir el contexto IA.");
      setIaApoyoGenerando(false);
      return;
    }

    AIService.generate({
      module:    "registro-apoyo",
      prompt:    ctx.prompt,
      system:    ctx.system,
      maxTokens: ctx.recommendedMaxTokens,
      onChunk: (chunk) => {
        setIaApoyoTexto((prev) => prev + chunk);
        setTimeout(() => iaApoyoRef.current?.scrollTo({ top: iaApoyoRef.current.scrollHeight, behavior: "smooth" }), 50);
      },
      onFinish: () => {
        setIaApoyoGenerando(false);
        EventTracker.track(LEARNING_EVENTS.APOYO_CURSO_GENERADO, {
          agentId:    AGENT_IDS.GENERADOR_REPORTES,
          area:       data.area  || "",
          grado:      data.nivel || "",
          enRiesgo:   (data.enRiesgo || []).length,
        });
      },
      onError: (err) => { setIaApoyoError(err); setIaApoyoGenerando(false); },
    });
  };

  const hoy = new Date();
  const indiceDia = hoy.getDay();
  const diaActual = diasSemana[indiceDia - 1] || "";
  const diaSeleccionado = diaVistaHorario || diaActual || diasSemana[0];
  const esDiaActualSeleccionado = diaSeleccionado === diaActual;
  const minutosActuales = (hoy.getHours() * 60) + hoy.getMinutes();
  // Clases de este curso ese día (la materia sale del curso) y, para «Siguiente
  // curso», las de todos los cursos del docente.
  const fechaVista = { fecha: esDiaActualSeleccionado ? fechaLocalISO(hoy) : "" }; // suma las horas extra de hoy
  const clasesBase = clasesDelDia([data], diaSeleccionado, fechaVista);
  const clasesTodas = clasesDelDia(cursos, diaSeleccionado, fechaVista);
  const indiceClaseActual = esDiaActualSeleccionado
    ? clasesBase.findIndex((fila) => minutosActuales >= aMinutos(fila.inicio) && minutosActuales < aMinutos(fila.fin))
    : -1;
  const indiceProxima = esDiaActualSeleccionado
    ? clasesBase.findIndex((fila) => aMinutos(fila.inicio) > minutosActuales)
    : 0;
  const clasePrincipal = clasesBase[indiceClaseActual >= 0 ? indiceClaseActual : indiceProxima];
  const desde = clasePrincipal ? aMinutos(clasePrincipal.inicio) : esDiaActualSeleccionado ? minutosActuales : -1;
  const claseSiguiente = clasesTodas.find((fila) => aMinutos(fila.inicio) > desde);
  const estadoClasePrincipal = indiceClaseActual >= 0 ? "Ahora" : "Próxima clase";

  useEffect(() => {
    let activo = true;
    const cargarDiaHorario = async () => {
      try {
        const res = await obtenerPreferenciaUsuario(claveDiaHorario);
        if (!activo) return;
        if (typeof res?.data === "string" && res.data) {
          setDiaVistaHorario(res.data);
        } else {
          try {
            const valorLocal = localStorage.getItem(claveDiaHorario) || "";
            if (valorLocal) setDiaVistaHorario(valorLocal);
          } catch {
            // noop
          }
        }
      } finally {
        if (activo) setDiaHorarioListo(true);
      }
    };

    cargarDiaHorario();
    return () => {
      activo = false;
    };
  }, [claveDiaHorario]);

  useEffect(() => {
    if (!diaHorarioListo || !diaVistaHorario) return;
    try {
      localStorage.setItem(claveDiaHorario, diaVistaHorario);
    } catch {
      // Si localStorage falla, no interrumpimos la UX.
    }

    guardarPreferenciaUsuario({ clave: claveDiaHorario, valor: diaVistaHorario }).catch(() => {
      // Si falla remoto, mantenemos fallback local.
    });
  }, [claveDiaHorario, diaVistaHorario, diaHorarioListo]);

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

  const estudiantesConNota = estudiantesDetalle.filter((e) => e.promedio !== null && e.promedio !== undefined);
  const promedioGeneral =
    estudiantesConNota.length > 0
      ? Math.round(estudiantesConNota.reduce((acum, e) => acum + Number(e.promedio), 0) / estudiantesConNota.length)
      : (data.promedio || 0);
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
          <div><span>Próxima clase</span><strong>{proximaClase([data])?.texto || "Sin horario"}</strong></div>
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
            <button className="continuar-btn" onClick={() => setTabActiva("Instrumentos")}>Continuar: aplicar evaluación</button>
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
                  <p className="horario-linea-fuerte">{nombreHora(clasePrincipal.hora)} hora{clasePrincipal.inicio && ` · ${aHora12(clasePrincipal.inicio)} - ${aHora12(clasePrincipal.fin)}`}</p>
                  <p className="horario-linea-suave">{clasePrincipal.etiqueta}</p>
                </>
              ) : (
                <p className="horario-linea-suave">{esDiaActualSeleccionado && clasesBase.length > 0 ? "Este curso ya no tiene más clases hoy." : `Este curso no tiene clases marcadas el ${diaSeleccionado.toLowerCase()}.`}</p>
              )}
            </div>

            <div className="horario-clase-panel secundario">
              <span className="horario-pill siguiente">Siguiente curso</span>
              {claseSiguiente ? (
                <>
                  <p className="horario-linea-fuerte">{nombreHora(claseSiguiente.hora)} hora{claseSiguiente.inicio && ` · ${aHora12(claseSiguiente.inicio)} - ${aHora12(claseSiguiente.fin)}`}</p>
                  <p className="horario-linea-suave">{claseSiguiente.etiqueta}</p>
                </>
              ) : (
                <p className="horario-linea-suave">No hay otra clase después.</p>
              )}
            </div>

            <button className="configurar-horario-btn" onClick={() => setTabActiva("Horario")}>
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
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                className="ia-support-btn"
                onClick={sugerirApoyoCurso}
                disabled={iaApoyoGenerando}
              >
                {iaApoyoGenerando ? "⏳ Analizando..." : "🤖 Sugerir apoyo"}
              </button>
              {(iaApoyoTexto || iaApoyoError) && !iaApoyoGenerando && (
                <button
                  type="button"
                  className="ia-support-btn"
                  style={{ background: "#f1f5f9", color: "#64748b", fontSize: "0.78rem" }}
                  onClick={() => { setIaApoyoTexto(""); setIaApoyoError(null); }}
                >
                  ✕ Limpiar
                </button>
              )}
            </div>
            {iaApoyoError && (
              <p style={{ color: "#dc2626", fontSize: "0.82rem", marginTop: 8 }}>⚠️ {iaApoyoError}</p>
            )}
            {(iaApoyoTexto || iaApoyoGenerando) && (
              <div className="ia-apoyo-panel" ref={iaApoyoRef}>
                <div className="ia-apoyo-content">
                  {iaApoyoTexto.split("\n").map((line, i) => {
                    if (line.startsWith("## ")) return <h4 key={i} style={{ color: "#4f46e5", margin: "12px 0 4px", fontSize: "0.88rem", fontWeight: 800 }}>{line.slice(3)}</h4>;
                    if (line.startsWith("- ")) return <li key={i} style={{ marginLeft: 14, marginBottom: 2 }}>{line.slice(2)}</li>;
                    if (line.trim() === "") return <br key={i} />;
                    return <p key={i} style={{ margin: "2px 0" }}>{line}</p>;
                  })}
                  {iaApoyoGenerando && <span style={{ color: "#7c3aed", fontWeight: 900, animation: "plan-ia-blink 0.8s step-end infinite" }}>▋</span>}
                </div>
              </div>
            )}
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
              {data.proximasAcciones.map((accion) => {
                const mapaAcciones = {
                  "Configurar planificación": () => onIrA("planificacion"),
                  "Crear instrumento":        () => setTabActiva("Instrumentos"),
                  "Registrar primera clase":  () => setTabActiva("Horario"),
                  "Aplicar evaluación":       () => setTabActiva("Instrumentos"),
                  "Registrar notas":          () => setTabActiva("Registro"),
                  "Generar reporte":          () => setTabActiva("Registro"),
                };
                return (
                  <button key={accion} onClick={mapaAcciones[accion] || undefined}>{accion}</button>
                );
              })}
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
                <h2>🕒 Horario</h2>
                <HorarioSemanal cursos={cursos} cursoInicialId={data.id} onGuardar={onGuardarHorarios} />

                <details className="hs-timbre">
                <summary>Ajustar horas del centro</summary>
                <p>A qué hora empieza y termina cada hora clase de este curso.</p>
                <div className="horario-toolbar">
                  <button onClick={() => agregarBloqueHorario("clase")}>+ Agregar bloque</button>
                  <button onClick={() => agregarBloqueHorario("recreo")}>+ Agregar recreo</button>
                  <button onClick={() => agregarBloqueHorario("almuerzo")}>+ Agregar almuerzo</button>
                </div>

                <div className="horario-lista">
                  {horarioCurso.map((bloque) => (
                    <article key={bloque.id} className="horario-item">
                      <span className="horario-nombre">{bloque.nombre}</span>
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
                  <button className="modal-save" onClick={guardarHorario}>Guardar horas del centro</button>
                  {mensajeHorario && <span className={`horario-msg ${mensajeHorario.tipo}`}>{mensajeHorario.texto}</span>}
                </div>
                </details>
              </section>
            )}

    </div>
  );
}

export default DetalleCurso;
