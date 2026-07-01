import { useState, useRef, useEffect } from "react";
import { normalizarHorarioCurso, crearHorarioPredeterminado } from "../utils/horarioCurso.js";
import { guardarHorarioCurso, guardarPreferenciaUsuario, obtenerPreferenciaUsuario } from "../firebase.js";
import { AIService } from "../services/ai/AIService.js";
import { buildAIContext } from "../services/ai/ContextBuilder.js";
import { EventTracker } from "../services/ai/learning/EventTracker.js";
import { LEARNING_EVENTS, AGENT_IDS } from "../services/ai/knowledge/KnowledgeTypes.js";
import { enriquecerCursoInicial } from "../utils/cursoUtils.js";

function DetalleCurso({ curso, onVolver, onEditarCurso, onActualizarCurso, onEliminarCurso, initialTab = "Resumen", onIrA = () => {} }) {
  const claveDiaHorario = `docenteos_detalle_dia_horario_${curso?.id || "curso-fallback"}`;
  const [tabActiva, setTabActiva] = useState(initialTab);
  const [busquedaEstudiante, setBusquedaEstudiante] = useState("");
  const [mostrarMenuCurso, setMostrarMenuCurso] = useState(false);
  const [mostrarModalHorarioClase, setMostrarModalHorarioClase] = useState(false);
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

  const construirHorarioClasePredeterminado = (nivelODuracion, cursoNombre, areaNombre, horarioBase = []) => {
    const duracionClase = typeof nivelODuracion === "number" ? nivelODuracion : nivelODuracion === "Secundaria" ? 50 : 45;
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
      : construirHorarioClasePredeterminado(data.duracionClaseMinutos || data.nivel || 45, data.nombre, data.area, normalizarHorarioCurso(data.horario || []))
  );
  const [duracionModal, setDuracionModal] = useState(
    data.nivel === "Primaria" ? 45 : (data.duracionClaseMinutos || 50)
  );
  const [diaVistaHorario, setDiaVistaHorario] = useState("");
  const [diaHorarioListo, setDiaHorarioListo] = useState(false);

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
        nombre: fila.bloque || fila.horaAcademica || `Bloque ${idx + 1}`,
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
        duracionClaseMinutos: duracionModal,
      })
    );
    setMostrarModalHorarioClase(false);
    setMensajeHorario({ tipo: "success", texto: "Horario de clase actualizado" });
  };

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
                  <p className="horario-linea-fuerte">{clasePrincipal.bloque || clasePrincipal.horaAcademica} · {aHora12(clasePrincipal.inicio)} - {aHora12(clasePrincipal.fin)}</p>
                  <p className="horario-linea-suave">{clasePrincipal.cursoAsignatura || clasePrincipal.curso || `${data.nombre} · ${data.area}`}</p>
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
                  <p className="horario-linea-fuerte">{claseSiguiente.bloque || claseSiguiente.horaAcademica} · {aHora12(claseSiguiente.inicio)} - {aHora12(claseSiguiente.fin)}</p>
                  <p className="horario-linea-suave">{claseSiguiente.cursoAsignatura || claseSiguiente.curso || `${data.nombre} · ${data.area}`}</p>
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
          <div className="modal-horario-clase" onClick={(e) => e.stopPropagation()}>
            <div className="modal-horario-header">
              <h2>Configurar horario</h2>
              <div className="preset-horario-row">
                <span>Duración de clase:</span>
                {data.nivel === "Primaria" ? (
                  <span className="preset-duracion-fija">45 minutos</span>
                ) : (
                  <>
                    <button
                      type="button"
                      className={duracionModal === 45 ? "preset-activo" : ""}
                      onClick={() => { setDuracionModal(45); aplicarPresetHorarioClase(45); }}
                    >45 min</button>
                    <button
                      type="button"
                      className={duracionModal === 50 ? "preset-activo" : ""}
                      onClick={() => { setDuracionModal(50); aplicarPresetHorarioClase(50); }}
                    >50 min</button>
                  </>
                )}
              </div>
            </div>

            <div className="horario-config-header-cols">
              <span>Día</span>
              <span>Bloque</span>
              <span>Hora inicio</span>
              <span>Hora fin</span>
              <span>Curso / Asignatura</span>
              <span>Aula</span>
            </div>

            <div className="horario-config-lista">
              {horarioClaseEditable.map((fila) => (
                <article key={fila.id} className={`horario-config-item${fila.tipo !== "clase" ? " horario-config-item--break" : ""}`}>
                  <select value={fila.dia} onChange={(e) => actualizarFilaHorarioClase(fila.id, "dia", e.target.value)}>
                    {diasSemana.map((dia) => (
                      <option key={dia} value={dia}>{dia}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={fila.bloque || fila.horaAcademica || ""}
                    onChange={(e) => actualizarFilaHorarioClase(fila.id, "bloque", e.target.value)}
                    placeholder="Bloque"
                  />
                  <input type="time" value={fila.inicio} onChange={(e) => actualizarFilaHorarioClase(fila.id, "inicio", e.target.value)} />
                  <input type="time" value={fila.fin} onChange={(e) => actualizarFilaHorarioClase(fila.id, "fin", e.target.value)} />
                  <input
                    type="text"
                    value={fila.cursoAsignatura || fila.curso || ""}
                    onChange={(e) => actualizarFilaHorarioClase(fila.id, "cursoAsignatura", e.target.value)}
                    placeholder="Curso / Asignatura"
                    disabled={fila.tipo !== "clase"}
                  />
                  <input
                    type="text"
                    value={fila.aula || ""}
                    onChange={(e) => actualizarFilaHorarioClase(fila.id, "aula", e.target.value)}
                    placeholder="Aula"
                    disabled={fila.tipo !== "clase"}
                  />
                </article>
              ))}
            </div>

            <div className="modal-horario-footer">
              <button className="modal-cancel" onClick={() => setMostrarModalHorarioClase(false)}>Cancelar</button>
              <button className="modal-save" onClick={guardarHorarioClaseModal}>Guardar horario</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DetalleCurso;
