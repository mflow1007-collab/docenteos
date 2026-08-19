import { useEffect, useMemo, useState } from "react";
import {
  NIVELES_DIAGNOSTICO,
  MEDIACIONES_DIAGNOSTICO,
  aprendizajesIniciales,
  guardarDiagnostico,
  obtenerDiagnosticoCurso,
  resumirDiagnostico,
} from "../services/diagnosticoService.js";
import {
  MODALIDADES_DIAGNOSTICO,
  PRESETS_FORMATO,
  aplicarComposicionPrueba,
  generarPruebaMezclada,
  auditarDisenoDiagnostico,
  crearItemVacio,
  generarBancoDiagnostico,
  obtenerNaturalezaArea,
} from "../services/diagnosticoBlueprintService.js";
import { getAreas, getAsignaturas } from "../planning/areaAsignaturaMap.js";
import { cargarReferentesDiagnosticos, vincularItemsAIndicadores, resolverContextoCurricular } from "../services/diagnosticoCurricularService.js";
import "./DiagnosticoPage.css";
import "./DiagnosticoInforme.css";
import "./DiagnosticoConstructor.css";

const anoEscolarActual = () => {
  const hoy = new Date();
  const inicio = hoy.getMonth() >= 7 ? hoy.getFullYear() : hoy.getFullYear() - 1;
  return `${inicio}-${inicio + 1}`;
};

const idEstudiante = (estudiante, indice) => String(estudiante.id || estudiante.uid || `${indice}-${estudiante.nombre}`);
const accionRecuperacion = (dimension = "", area = "") => {
  const clave = dimension.toLowerCase();
  if (clave.includes("oral") || clave.includes("escucha")) return "Modelado breve, audios o instrucciones pausadas, repetición con propósito y respuesta apoyada en imágenes; retirar los apoyos gradualmente.";
  if (clave.includes("lectora") || clave.includes("escrita")) return "Lectura o escritura guiada en fragmentos cortos, banco de palabras, organizador visual y práctica gradual con retroalimentación inmediata.";
  if (clave.includes("numérico") || clave.includes("procedimiento")) return "Manipulativos y representaciones visuales, ejemplo resuelto en voz alta, práctica por pasos y problemas breves del contexto cotidiano.";
  if (clave.includes("problema") || clave.includes("razonamiento")) return "Situaciones cercanas, identificación de datos, representación gráfica, comparación de estrategias y explicación oral del procedimiento.";
  if (clave.includes("motr") || clave.includes("coordin")) return "Demostración lenta, estaciones de práctica, reducción inicial de complejidad y repetición con retroalimentación descriptiva.";
  if (clave.includes("observ") || clave.includes("indag")) return "Experiencia concreta, registro visual de observaciones, preguntas guiadas y explicación apoyada en evidencias.";
  return `Activación con ejemplo cercano, modelado, práctica guiada y nueva evidencia breve de ${area || "el área"}.`;
};
const etiquetaFormato = { seleccion_multiple: "Selección múltiple", verdadero_falso: "Verdadero/Falso", completar: "Completar", pareado: "Pareado" };
const ItemObjetivo = ({ item }) => {
  if (item.formatoRespuesta === "seleccion_multiple") return <div className="diag-opciones">{(item.opciones || []).map((opcion, indice) => <label key={opcion}><input type="radio" name={`respuesta-${item.id}`}/><b>{String.fromCharCode(65 + indice)}.</b> {opcion}</label>)}</div>;
  if (item.formatoRespuesta === "verdadero_falso") return <div className="diag-vf"><p>{item.afirmacion || item.consigna}</p><label><input type="radio" name={`respuesta-${item.id}`}/> Verdadero</label><label><input type="radio" name={`respuesta-${item.id}`}/> Falso</label></div>;
  if (item.formatoRespuesta === "completar") return <div className="diag-completar"><p>Banco de palabras: {(item.bancoPalabras || []).join(" · ")}</p><span>Respuesta: ____________________________________</span></div>;
  if (item.formatoRespuesta === "pareado") return <table className="diag-pareado"><tbody>{(item.pares || []).map((par, indice) => <tr key={`${par.izquierda}-${indice}`}><td>{indice + 1}. {par.izquierda}</td><td>_____</td><td>{String.fromCharCode(65 + indice)}. {par.derecha}</td></tr>)}</tbody></table>;
  return <div className="diag-espacio-respuesta">Respuesta / evidencia:</div>;
};

export default function DiagnosticoPage({ cursos = [], cursoActivo = null, perfil = {}, onIrA = () => {}, onCrearPlanificacion = () => {} }) {
  const [cursoId, setCursoId] = useState(cursoActivo?.id || cursos[0]?.id || "");
  const [anoEscolar, setAnoEscolar] = useState(anoEscolarActual());
  const [paso, setPaso] = useState(1);
  const [diagnosticoId, setDiagnosticoId] = useState(null);
  const [aprendizajes, setAprendizajes] = useState([]);
  const [resultados, setResultados] = useState({});
  const [mediaciones, setMediaciones] = useState({});
  const [observaciones, setObservaciones] = useState("");
  const [guardado, setGuardado] = useState("");
  const [modalidad, setModalidad] = useState("guiado");
  const [area, setArea] = useState(perfil?.areaPrincipal || cursoActivo?.area || "");
  const [asignatura, setAsignatura] = useState(perfil?.asignaturaPrincipal || "");
  const [items, setItems] = useState([]);
  const [contexto, setContexto] = useState({ duracion: "45", recursos: "Pizarra, hojas impresas y recursos visuales", caracteristicas: "", aplicacion: "Mixta" });
  const [referentes, setReferentes] = useState({ indicadores: [], fuente: "", oficial: false, anterior: null });
  const [cargandoReferentes, setCargandoReferentes] = useState(false);
  const [paqueteAbierto, setPaqueteAbierto] = useState(false);
  const [filtroTema, setFiltroTema] = useState("Todos");
  const [busquedaItem, setBusquedaItem] = useState("");
  const [presetFormato, setPresetFormato] = useState("mixto");
  const [formatoPersonalizado, setFormatoPersonalizado] = useState({ seleccion_multiple: 80, verdadero_falso: 10, completar: 5, pareado: 5 });

  const curso = cursos.find((item) => String(item.id) === String(cursoId)) || null;
  const estudiantes = useMemo(() => (curso?.estudiantesDetalle || []).map((item, indice) => ({
    ...item,
    id: idEstudiante(item, indice),
  })), [curso]);
  const asignaturas = useMemo(() => getAsignaturas(area), [area]);
  const naturaleza = useMemo(() => obtenerNaturalezaArea(area, asignatura), [area, asignatura]);
  const auditoria = useMemo(() => auditarDisenoDiagnostico(items, naturaleza), [items, naturaleza]);
  const itemsSeleccionados = useMemo(() => items.filter((item) => item.seleccionado), [items]);
  const temasDisponibles = useMemo(() => ["Todos", ...new Set(items.map((item) => item.tema).filter(Boolean))], [items]);
  const itemsVisibles = useMemo(() => {
    const consulta = busquedaItem.trim().toLowerCase();
    return items.filter((item) => (filtroTema === "Todos" || item.tema === filtroTema) && (!consulta || [item.tema, item.aprendizaje, item.consigna, item.dimension].some((texto) => String(texto || "").toLowerCase().includes(consulta))));
  }, [items, filtroTema, busquedaItem]);

  useEffect(() => {
    if (!cursoId) return;
    const existente = obtenerDiagnosticoCurso(cursoId, anoEscolar);
    setDiagnosticoId(existente?.id || null);
    setAprendizajes(existente?.aprendizajes?.length ? existente.aprendizajes : aprendizajesIniciales(curso?.area));
    setResultados(existente?.resultados || {});
    setMediaciones(existente?.mediaciones || {});
    setObservaciones(existente?.observaciones || "");
    // Resolución de contexto ÚNICA (misma lógica que la planificación): área
    // MINERD real + asignatura canónica, venga el curso como venga. Si hay un
    // diagnóstico guardado, su área/asignatura mandan.
    const ctx = resolverContextoCurricular(
      { ...curso, area: existente?.area || curso?.area },
      { ...perfil, asignaturaPrincipal: existente?.asignatura || perfil?.asignaturaPrincipal }
    );
    const areaInicial = ctx.area;
    const asignaturaInicial = ctx.asignatura;
    setArea(areaInicial);
    setAsignatura(asignaturaInicial);
    setModalidad(existente?.modalidad || "guiado");
    setContexto(existente?.contexto || { duracion: "45", recursos: "Pizarra, hojas impresas y recursos visuales", caracteristicas: "", aplicacion: "Mixta" });
    const bancoGuardado = existente?.items?.length ? existente.items : null;
    const francesConContenidoIngles = asignaturaInicial === "Francés" && bancoGuardado?.some((item) => /\b(hello|what|school|name)\b/i.test(item.consigna || ""));
    setItems(bancoGuardado && !francesConContenidoIngles ? bancoGuardado : generarBancoDiagnostico({ area: areaInicial, asignatura: asignaturaInicial }));
    setPaso(existente?.estado === "completado" ? 3 : 1);
    setGuardado("");
  }, [cursoId, anoEscolar, curso?.area, perfil?.areaPrincipal, perfil?.asignaturaPrincipal]);

  useEffect(() => {
    let activo = true;
    if (!curso?.grado) return undefined;
    // Contexto canónico desde una sola función (grado/nivel/área/asignatura),
    // igual que la planificación. Prioriza el área/asignatura ya elegidos en el
    // formulario; si no, los deriva del curso/perfil.
    const ctx = resolverContextoCurricular(
      { ...curso, area: area || curso?.area },
      { ...perfil, asignaturaPrincipal: asignatura || perfil?.asignaturaPrincipal }
    );
    if (!ctx.valido) {
      setReferentes({ indicadores: [], fuente: "", oficial: false, anterior: null, diagnostico: { busco: { materia: ctx.materia, grado: ctx.grado, nivel: ctx.nivel }, motivo: "sin_contexto", detalle: `Falta ${ctx.faltan.join(" y ")} para buscar la malla.` } });
      return undefined;
    }
    setCargandoReferentes(true);
    cargarReferentesDiagnosticos({ nivel: ctx.nivel, grado: ctx.grado, area: ctx.area, asignatura: ctx.asignatura })
      .then((datos) => {
        if (!activo) return;
        setReferentes(datos);
        if (datos.indicadores.length) setItems((actuales) => vincularItemsAIndicadores(actuales, datos.indicadores));
      })
      .finally(() => { if (activo) setCargandoReferentes(false); });
    return () => { activo = false; };
  }, [curso?.grado, curso?.nivel, curso?.area, area, asignatura, perfil?.areaPrincipal, perfil?.asignaturaPrincipal]);

  const resumen = useMemo(
    () => resumirDiagnostico({ estudiantes, aprendizajes, resultados, mediaciones }),
    [estudiantes, aprendizajes, resultados, mediaciones]
  );
  const progreso = estudiantes.length ? Math.round((resumen.estudiantesCompletos / estudiantes.length) * 100) : 0;
  const resumenDimensiones = useMemo(() => naturaleza.dimensiones.map((dimension) => {
    const aprendizajesDimension = new Set(itemsSeleccionados.filter((item) => item.dimension === dimension).map((item) => item.aprendizaje));
    const indices = aprendizajes.map((aprendizaje, indice) => aprendizajesDimension.has(aprendizaje) ? indice : -1).filter((indice) => indice >= 0);
    const valores = estudiantes.flatMap((estudiante) => indices.map((indice) => resultados[estudiante.id]?.[indice]).filter(Boolean));
    const satisfactorios = valores.filter((nivel) => nivel === "logrado" || nivel === "avanzado").length;
    const apoyo = valores.filter((nivel) => nivel === "requiere_apoyo" || nivel === "en_proceso").length;
    return { dimension, evidencias: valores.length, satisfactorios, apoyo, porcentaje: valores.length ? Math.round((satisfactorios / valores.length) * 100) : 0 };
  }), [naturaleza, itemsSeleccionados, aprendizajes, estudiantes, resultados]);
  const perfilesGrupo = useMemo(() => {
    const grupos = { recuperacion: 0, consolidacion: 0, esperado: 0, profundizacion: 0, pendientes: 0 };
    estudiantes.forEach((estudiante) => {
      const valores = aprendizajes.map((_, indice) => resultados[estudiante.id]?.[indice]).filter(Boolean);
      if (!valores.length) { grupos.pendientes += 1; return; }
      const promedio = valores.reduce((suma, nivel) => suma + (NIVELES_DIAGNOSTICO.find((item) => item.id === nivel)?.valor || 0), 0) / valores.length;
      if (promedio < 1.75) grupos.recuperacion += 1;
      else if (promedio < 2.75) grupos.consolidacion += 1;
      else if (promedio < 3.5) grupos.esperado += 1;
      else grupos.profundizacion += 1;
    });
    return grupos;
  }, [estudiantes, aprendizajes, resultados]);
  const perfilesEstudiantes = useMemo(() => estudiantes.map((estudiante) => {
    const valores = aprendizajes.map((_, indice) => resultados[estudiante.id]?.[indice]).filter(Boolean);
    const promedio = valores.length ? valores.reduce((suma, nivel) => suma + (NIVELES_DIAGNOSTICO.find((item) => item.id === nivel)?.valor || 0), 0) / valores.length : 0;
    const persistentes = aprendizajes.filter((_, indice) => ["requiere_apoyo", "en_proceso"].includes(resultados[estudiante.id]?.[indice]) && ["apoyo_constante", "sin_evidencia"].includes(mediaciones[estudiante.id]?.[indice])).length;
    const grupo = !valores.length ? "Pendiente" : promedio < 1.75 ? "Recuperación" : promedio < 2.75 ? "Consolidación" : promedio < 3.5 ? "Nivel esperado" : "Profundización";
    return { ...estudiante, promedio, persistentes, grupo };
  }), [estudiantes, aprendizajes, resultados, mediaciones]);
  const graficaGrupos = useMemo(() => {
    const total = Math.max(estudiantes.length, 1);
    const p1 = (perfilesGrupo.recuperacion / total) * 100;
    const p2 = p1 + (perfilesGrupo.consolidacion / total) * 100;
    const p3 = p2 + (perfilesGrupo.esperado / total) * 100;
    return `conic-gradient(#e11d48 0 ${p1}%, #f59e0b ${p1}% ${p2}%, #16a34a ${p2}% ${p3}%, #2563eb ${p3}% 100%)`;
  }, [perfilesGrupo, estudiantes.length]);

  const marcar = (estudianteId, aprendizajeIndex, nivel) => setResultados((actuales) => ({
    ...actuales,
    [estudianteId]: { ...(actuales[estudianteId] || {}), [aprendizajeIndex]: nivel },
  }));
  const marcarMediacion = (estudianteId, aprendizajeIndex, mediacion) => setMediaciones((actuales) => ({
    ...actuales,
    [estudianteId]: { ...(actuales[estudianteId] || {}), [aprendizajeIndex]: mediacion },
  }));
  const regenerarBanco = (areaNueva = area, asignaturaNueva = asignatura) => {
    setItems(modalidad === "desde_cero" ? [crearItemVacio(obtenerNaturalezaArea(areaNueva, asignaturaNueva))] : generarBancoDiagnostico({ area: areaNueva, asignatura: asignaturaNueva }));
    setResultados({});
    setMediaciones({});
  };
  const actualizarItem = (id, cambios) => setItems((actuales) => actuales.map((item) => item.id === id ? { ...item, ...cambios } : item));
  const quitarItem = (id) => setItems((actuales) => actuales.filter((item) => item.id !== id));
  const seleccionarVisibles = (seleccionado) => {
    const ids = new Set(itemsVisibles.map((item) => item.id));
    setItems((actuales) => actuales.map((item) => ids.has(item.id) ? { ...item, seleccionado } : item));
  };
  const aplicarFormatoPrueba = () => {
    const preset = PRESETS_FORMATO.find((item) => item.id === presetFormato) || PRESETS_FORMATO[0];
    const porcentajes = presetFormato === "personalizado" ? formatoPersonalizado : preset.porcentajes;
    setItems((actuales) => aplicarComposicionPrueba(actuales, { total: 20, porcentajes }));
    setGuardado("Composición aplicada: 20 ítems escritos; los desempeños orales quedan como complemento.");
  };
  const generarMezclaAutomatica = () => {
    const preset = PRESETS_FORMATO.find((item) => item.id === presetFormato) || PRESETS_FORMATO[0];
    const porcentajes = presetFormato === "personalizado" ? formatoPersonalizado : preset.porcentajes;
    setItems((actuales) => generarPruebaMezclada(actuales, { total: 20, porcentajes }));
    setFiltroTema("Todos");
    setBusquedaItem("");
    setGuardado("Nueva prueba generada: 20 ítems mezclados y 2 desempeños orales complementarios.");
  };
  const prepararAplicacion = () => {
    const seleccionados = items.filter((item) => item.seleccionado && item.aprendizaje.trim());
    const unicos = [...new Set(seleccionados.map((item) => item.aprendizaje.trim()))];
    setAprendizajes(unicos);
    persistir("borrador", unicos);
    setPaso(2);
  };

  const persistir = (estado = "borrador", aprendizajesForzados = null) => {
    const limpio = (aprendizajesForzados || aprendizajes).map((item) => item.trim()).filter(Boolean);
    const registro = guardarDiagnostico({
      id: diagnosticoId,
      cursoId,
      cursoNombre: curso?.nombre || "Curso",
      area,
      asignatura,
      grado: curso?.grado || "",
      seccion: curso?.seccion || "",
      anoEscolar,
      aprendizajes: limpio,
      resultados,
      mediaciones,
      observaciones,
      modalidad,
      contexto,
      items,
      referenteCurricular: referentes,
      estado,
    });
    setDiagnosticoId(registro.id);
    setAprendizajes(limpio);
    setGuardado(estado === "completado" ? "Diagnóstico completado y listo para planificar." : "Borrador guardado.");
    if (estado === "completado") setPaso(3);
  };

  const crearPlan = () => {
    const prioritarias = resumen.brechas.filter((item) => item.porcentajeApoyo >= 30).slice(0, 3);
    onCrearPlanificacion({
      curso: { ...curso, area, asignatura },
      anoEscolar,
      aprendizajes,
      observaciones,
      resumen,
      prioritarias: prioritarias.length ? prioritarias : resumen.brechas.slice(0, 2),
    });
  };

  const imprimirInforme = () => window.print();
  const nombreNivel = { elemental: "Elemental", aceptable: "Aceptable", satisfactorio: "Satisfactorio" };
  const nivelPredominante = Object.entries(resumen.porcentajesInforme || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || "elemental";
  const prioridadesInforme = resumen.brechas.filter((item) => item.porcentajeApoyo >= 30).slice(0, 4);

  if (!cursos.length) return (
    <div className="diagnostico-vacio">
      <span>🧭</span><h1>Evaluación diagnóstica</h1>
      <p>Primero crea un curso y registra su matrícula para comenzar el diagnóstico.</p>
    </div>
  );

  return (
    <div className="diagnostico-page">
      <section className="diagnostico-hero">
        <div><p className="diag-kicker">Inicio del año escolar</p><h1>Evaluación diagnóstica</h1><p>Identifica los saberes de entrada del grupo y convierte las brechas en decisiones de planificación.</p></div>
        <div className="diag-contexto">
          <label>Curso<select value={cursoId} onChange={(e) => setCursoId(e.target.value)}>{cursos.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
          <label>Año escolar<input value={anoEscolar} onChange={(e) => setAnoEscolar(e.target.value)} /></label>
        </div>
      </section>

      <nav className="diag-pasos" aria-label="Progreso de la evaluación diagnóstica">
        {["Preparar", "Aplicar", "Analizar", "Informe final"].map((label, index) => <button key={label} className={paso === index + 1 ? "activo" : ""} onClick={() => setPaso(index + 1)}><b>{index + 1}</b><span>{label}</span></button>)}
      </nav>
      {guardado && <div className="diag-alerta" role="status">✓ {guardado}</div>}

      {paso === 1 && <section className="diag-panel">
        <div className="diag-panel-head"><div><h2>Construye un diagnóstico apropiado</h2><p>DocenteOS respeta la naturaleza del área y tú decides qué corresponde a este grupo.</p></div></div>
        <div className="diag-acciones-rapidas"><div><strong>Instrumento actual</strong><span>{itemsSeleccionados.filter((item) => item.componente !== "desempeno").length} ítems escritos · {itemsSeleccionados.filter((item) => item.componente === "desempeno").length} desempeños</span></div><button type="button" className="diag-mezclar" onClick={generarMezclaAutomatica}>⤨ Generar y mezclar 20</button><button type="button" className="diag-ver-arriba" disabled={!itemsSeleccionados.length} onClick={() => setPaqueteAbierto(true)}>👁 Ver instrumento</button></div>
        <div className="diag-modalidades">{MODALIDADES_DIAGNOSTICO.map((opcion) => <button key={opcion.id} className={modalidad === opcion.id ? "activo" : ""} onClick={() => { setModalidad(opcion.id); setItems(opcion.id === "desde_cero" ? [crearItemVacio(naturaleza)] : generarBancoDiagnostico({ area, asignatura })); }}><span>{opcion.icono}</span><strong>{opcion.nombre}{opcion.recomendado && <em>Recomendado</em>}</strong><small>{opcion.descripcion}</small></button>)}</div>
        <div className="diag-config-grid">
          {perfil?.areaPrincipal ? <div className="diag-area-perfil"><span>Tu área</span><strong>{perfil.areaPrincipal}</strong><small>{perfil.asignaturaPrincipal || "Asignatura pendiente"}</small><button type="button" onClick={() => onIrA("configuracion")}>Cambiar en mi perfil</button></div> : <label>Área<select value={area} onChange={(e) => { const valor = e.target.value; const primera = getAsignaturas(valor)[0] || ""; setArea(valor); setAsignatura(primera); regenerarBanco(valor, primera); }}><option value="">Seleccionar área</option>{getAreas().map((item) => <option key={item}>{item}</option>)}</select></label>}
          {!perfil?.asignaturaPrincipal && <label>Asignatura<select value={asignatura} onChange={(e) => { setAsignatura(e.target.value); regenerarBanco(area, e.target.value); }}><option value="">Seleccionar asignatura</option>{asignaturas.map((item) => <option key={item}>{item}</option>)}</select></label>}
          <label>Aplicación<select value={contexto.aplicacion} onChange={(e) => setContexto({ ...contexto, aplicacion: e.target.value })}><option>Mixta</option><option>Oral</option><option>Escrita</option><option>Práctica</option></select></label>
          <label>Duración<input type="number" min="15" max="120" value={contexto.duracion} onChange={(e) => setContexto({ ...contexto, duracion: e.target.value })} /><small>minutos</small></label>
        </div>
        <div className="diag-config-ancha"><label>Recursos realmente disponibles<input value={contexto.recursos} onChange={(e) => setContexto({ ...contexto, recursos: e.target.value })} /></label><label>Características del grupo<textarea rows="2" value={contexto.caracteristicas} onChange={(e) => setContexto({ ...contexto, caracteristicas: e.target.value })} placeholder="Ej.: grupo heterogéneo, dos estudiantes requieren instrucciones leídas…" /></label></div>
        <section className="diag-formato-config"><div><h3>Composición de la prueba escrita</h3><p>Las actividades orales o prácticas se valoran aparte mediante rúbrica.</p></div><div className="diag-presets-formato">{PRESETS_FORMATO.map((preset) => <button type="button" key={preset.id} className={presetFormato === preset.id ? "activo" : ""} onClick={() => setPresetFormato(preset.id)}><strong>{preset.nombre}</strong><small>{preset.descripcion}</small></button>)}</div>{presetFormato === "personalizado" && <div className="diag-porcentajes">{Object.entries(formatoPersonalizado).map(([formato, porcentaje]) => <label key={formato}>{etiquetaFormato[formato]}<input type="number" min="0" max="100" value={porcentaje} onChange={(e) => setFormatoPersonalizado((actual) => ({ ...actual, [formato]: Number(e.target.value) }))}/><span>%</span></label>)}</div>}<button type="button" className="diag-aplicar-formato" onClick={aplicarFormatoPrueba}>Aplicar composición a 20 ítems</button></section>
        <div className="diag-cobertura"><div><strong>{auditoria.total}</strong><span>ítems seleccionados</span></div>{Object.entries(auditoria.porDificultad).map(([nivel, cantidad]) => <div key={nivel}><strong>{cantidad}</strong><span>{nivel}</span></div>)}</div>
        <div className={`diag-curriculo-status ${referentes.oficial ? "oficial" : "revision"}`}><div><strong>{cargandoReferentes ? "Consultando currículo…" : referentes.oficial ? `${referentes.indicadores.length} indicadores de la malla oficial` : "Sin malla oficial vinculada"}</strong>
          {/* Fail-loud: cuando no hay malla oficial, decir EXACTAMENTE qué buscó y por qué no la encontró (en pantalla, sin consola). */}
          {!cargandoReferentes && !referentes.oficial && referentes.diagnostico ? (
            <p>{referentes.diagnostico.detalle || referentes.fuente}
              {referentes.diagnostico.busco ? <><br/>🔎 Buscó: <b>{referentes.diagnostico.busco.materia || "—"}</b> · <b>{referentes.diagnostico.busco.grado || "—"}</b> · <b>{referentes.diagnostico.busco.nivel || "—"}</b> — motivo: <b>{referentes.diagnostico.motivo || "—"}</b></> : null}
            </p>
          ) : (
            <p>{referentes.anterior ? `Referencia de saberes de entrada: ${referentes.anterior.etiqueta}. ` : ""}{referentes.fuente}</p>
          )}</div>{!referentes.oficial && <span>Revisar antes de aplicar</span>}</div>
        <div className="diag-item-head"><div><h3>Banco de ítems</h3><p>{items.length} actividades disponibles · elige solamente las apropiadas para tus estudiantes.</p></div><button className="diag-secundario" onClick={() => setItems((actuales) => [...actuales, crearItemVacio(naturaleza)])}>+ Crear ítem</button></div>
        <div className="diag-filtros-items"><input type="search" value={busquedaItem} onChange={(e) => setBusquedaItem(e.target.value)} placeholder="Buscar aprendizaje, consigna o habilidad…"/><select value={filtroTema} onChange={(e) => setFiltroTema(e.target.value)}>{temasDisponibles.map((tema) => <option key={tema}>{tema}</option>)}</select><button type="button" onClick={() => seleccionarVisibles(true)}>Seleccionar visibles</button><button type="button" onClick={() => seleccionarVisibles(false)}>Quitar visibles</button></div>
        <div className="diag-temas-chips">{temasDisponibles.map((tema) => <button type="button" key={tema} className={filtroTema === tema ? "activo" : ""} onClick={() => setFiltroTema(tema)}>{tema}{tema !== "Todos" && <small>{items.filter((item) => item.tema === tema).length}</small>}</button>)}</div>
        <div className="diag-items">{itemsVisibles.map((item) => { const indice = items.findIndex((registro) => registro.id === item.id); return <article className={`diag-item ${item.seleccionado ? "seleccionado" : ""}`} key={item.id}>
          <label className="diag-item-check"><input type="checkbox" checked={item.seleccionado} onChange={(e) => actualizarItem(item.id, { seleccionado: e.target.checked })} /><b>{indice + 1}</b></label>
          <div className="diag-item-body"><div className="diag-item-meta"><select value={item.dimension} onChange={(e) => actualizarItem(item.id, { dimension: e.target.value })}>{naturaleza.dimensiones.map((dimension) => <option key={dimension}>{dimension}</option>)}</select><select value={item.formatoRespuesta || "desempeno"} onChange={(e) => actualizarItem(item.id, { formatoRespuesta: e.target.value })}><option value="desempeno">Desempeño</option>{Object.entries(etiquetaFormato).map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}</select><select value={item.dificultad} onChange={(e) => actualizarItem(item.id, { dificultad: e.target.value })}><option>Activación</option><option>Esencial</option><option>Profundización</option></select></div><label className="diag-item-field"><span>Aprendizaje observado</span><input className="diag-item-aprendizaje" value={item.aprendizaje} onChange={(e) => actualizarItem(item.id, { aprendizaje: e.target.value })} placeholder="Aprendizaje que observará" /></label><label className="diag-item-field"><span>Actividad o consigna exacta</span><textarea rows="3" value={item.consigna} onChange={(e) => actualizarItem(item.id, { consigna: e.target.value })} placeholder="Escribe exactamente qué hará el estudiante" /></label><label className="diag-item-field"><span>Indicador curricular del grado</span><select className="diag-indicador-select" value={item.indicadorId || ""} onChange={(e) => { const indicador = referentes.indicadores.find((ind) => ind.id === e.target.value); actualizarItem(item.id, { indicadorId: indicador?.id || "", indicador: indicador?.descripcion || "", competencia: indicador?.competencia || "" }); }}><option value="">Sin referente curricular</option>{referentes.indicadores.map((indicador) => <option key={indicador.id} value={indicador.id}>{indicador.descripcion}</option>)}</select></label><div className="diag-item-details"><label className="diag-item-field"><span>Materiales</span><input value={item.materiales || ""} onChange={(e) => actualizarItem(item.id, { materiales: e.target.value })} placeholder="Recursos necesarios" /></label><label className="diag-item-field"><span>Apoyo permitido</span><input value={item.apoyo} onChange={(e) => actualizarItem(item.id, { apoyo: e.target.value })} placeholder="Apoyo permitido" /></label></div><label className="diag-item-field"><span>Respuesta o evidencia esperada</span><input value={item.respuestaEsperada || ""} onChange={(e) => actualizarItem(item.id, { respuestaEsperada: e.target.value })} placeholder="Qué debería demostrar" /></label><label className="diag-item-field"><span>Criterios observables</span><input value={item.criterios || ""} onChange={(e) => actualizarItem(item.id, { criterios: e.target.value })} placeholder="Qué observarás para determinar el nivel" /></label></div>
          <button className="diag-item-remove" onClick={() => quitarItem(item.id)} aria-label="Eliminar ítem">×</button>
        </article>})}</div>
        <div className={`diag-auditoria ${auditoria.alertas.length ? "advertencia" : "correcto"}`}><strong>{auditoria.alertas.length ? "Revisa la cobertura" : "Diseño equilibrado"}</strong>{auditoria.alertas.length ? <ul>{auditoria.alertas.map((alerta) => <li key={alerta}>{alerta}</li>)}</ul> : <p>La evaluación incluye activación y evidencia de todas las dimensiones del área.</p>}</div>
        <div className="diag-nota"><strong>Regla de interpretación</strong><p>Una respuesta aislada no se considerará una deficiencia. El registro permitirá distinguir desempeño autónomo, desempeño con apoyo y dificultad persistente.</p></div>
        <div className="diag-actions"><button className="diag-secundario" onClick={() => persistir("borrador")}>Guardar borrador</button><button className="diag-secundario" disabled={!itemsSeleccionados.length} onClick={() => setPaqueteAbierto(true)}>Vista previa del instrumento</button><button className="diag-primario" disabled={!items.some((item) => item.seleccionado && item.aprendizaje.trim())} onClick={prepararAplicacion}>Preparar aplicación →</button></div>
      </section>}

      {paso === 2 && <section className="diag-panel">
        <div className="diag-panel-head"><div><h2>Registro por estudiante</h2><p>{resumen.estudiantesCompletos} de {estudiantes.length} estudiantes completados · {progreso}%</p></div><div className="diag-progress"><i style={{ width: `${progreso}%` }} /></div></div>
        <details className="diag-guia-aplicacion"><summary>Ver guía de aplicación · {itemsSeleccionados.length} actividades</summary><div>{itemsSeleccionados.map((item, indice) => <article key={item.id}><b>{indice + 1}. {item.dimension} · {item.dificultad}</b><p>{item.consigna}</p><small><strong>Apoyo permitido:</strong> {item.apoyo || "Sin apoyo definido"}</small></article>)}</div></details>
        {!estudiantes.length ? <div className="diag-sin-matricula"><strong>Este curso no tiene estudiantes registrados.</strong><p>Agrega la matrícula desde Estudiantes para poder aplicar el diagnóstico.</p></div> : <div className="diag-tabla-wrap"><table className="diag-tabla"><thead><tr><th>Estudiante</th>{aprendizajes.map((item, indice) => <th key={indice} title={item}>A{indice + 1}<small>{item}</small></th>)}</tr></thead><tbody>{estudiantes.map((estudiante) => <tr key={estudiante.id}><th>{estudiante.nombre}</th>{aprendizajes.map((_, indice) => <td key={indice}><select aria-label={`${estudiante.nombre}, aprendizaje ${indice + 1}`} value={resultados[estudiante.id]?.[indice] || ""} onChange={(e) => marcar(estudiante.id, indice, e.target.value)} className={resultados[estudiante.id]?.[indice] || "pendiente"}><option value="">Nivel observado</option>{NIVELES_DIAGNOSTICO.map((nivel) => <option key={nivel.id} value={nivel.id}>{nivel.label}</option>)}</select><select className="diag-mediacion" aria-label={`Apoyo utilizado por ${estudiante.nombre}, aprendizaje ${indice + 1}`} value={mediaciones[estudiante.id]?.[indice] || ""} onChange={(e) => marcarMediacion(estudiante.id, indice, e.target.value)}><option value="">¿Cómo lo realizó?</option>{MEDIACIONES_DIAGNOSTICO.map((opcion) => <option key={opcion.id} value={opcion.id}>{opcion.label}</option>)}</select></td>)}</tr>)}</tbody></table></div>}
        <label className="diag-observaciones">Observaciones generales<textarea rows="3" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Intereses del grupo, condiciones de aplicación, barreras observadas…" /></label>
        <div className="diag-actions"><button className="diag-secundario" onClick={() => persistir("borrador")}>Guardar y continuar luego</button><button className="diag-primario" disabled={!resumen.totalCeldas} onClick={() => persistir("completado")}>Ver resultados →</button></div>
      </section>}

      {paso === 3 && <section className="diag-panel">
        <div className="diag-panel-head"><div><h2>Punto de partida del grupo</h2><p>Las prioridades se ordenan por la proporción de estudiantes que requiere apoyo.</p></div><span className="diag-estado">Diagnóstico {progreso === 100 ? "completo" : `${progreso}% registrado`}</span></div>
        <div className="diag-resumen-grid">{NIVELES_DIAGNOSTICO.map((nivel) => <article key={nivel.id} className={`diag-stat ${nivel.id}`}><strong>{resumen.conteo[nivel.id]}</strong><span>{nivel.label}</span></article>)}</div>
        <div className="diag-niveles-informe"><h3>Niveles consolidados para el informe</h3>{Object.entries(resumen.porcentajesInforme).map(([nivel, porcentaje]) => <div key={nivel}><span>{nombreNivel[nivel]}</span><i><b style={{ width: `${porcentaje}%` }} /></i><strong>{porcentaje}%</strong></div>)}</div>
        <div className="diag-graficos-grid"><section><h3>Dominio por dimensión</h3><div className="diag-barras-dimension">{resumenDimensiones.map((item) => <div key={item.dimension}><header><span>{item.dimension}</span><strong>{item.porcentaje}%</strong></header><i><b style={{ width: `${item.porcentaje}%` }} /></i><small>{item.satisfactorios} evidencias satisfactorias · {item.apoyo} requieren apoyo</small></div>)}</div></section><section><h3>Grupos flexibles sugeridos</h3><div className="diag-dona" style={{ background: graficaGrupos }}><strong>{estudiantes.length}</strong><span>estudiantes</span></div><div className="diag-leyenda-grupos"><span><i className="rec" />Recuperación <b>{perfilesGrupo.recuperacion}</b></span><span><i className="con" />Consolidación <b>{perfilesGrupo.consolidacion}</b></span><span><i className="esp" />Nivel esperado <b>{perfilesGrupo.esperado}</b></span><span><i className="pro" />Profundización <b>{perfilesGrupo.profundizacion}</b></span></div></section></div>
        <section className="diag-estudiantes-prioridad"><div><h3>Estudiantes que necesitan seguimiento</h3><p>No es una etiqueta permanente: el grupo cambia según las nuevas evidencias.</p></div><div>{perfilesEstudiantes.filter((item) => item.grupo === "Recuperación" || item.persistentes > 0).map((item) => <article key={item.id}><span>{item.nombre.split(" ").map((parte) => parte[0]).slice(0,2).join("")}</span><div><strong>{item.nombre}</strong><small>{item.grupo} · {item.persistentes} dificultades persistentes</small></div></article>)}</div></section>
        <div className="diag-analisis"><div><h3>Brechas prioritarias</h3>{resumen.brechas.map((item, indice) => <article className="diag-brecha" key={item.aprendizaje}><span>{indice + 1}</span><div><strong>{item.aprendizaje}</strong><p>{item.conApoyo} requieren refuerzo · {item.recuperadosConAyuda} lo recuperaron con ayuda · {item.brechaPersistente} muestran dificultad persistente</p></div><b>{item.porcentajeApoyo}%</b></article>)}</div><aside><h3>Decisiones sugeridas</h3><ul><li>Da una activación breve a quienes recuperaron el aprendizaje con una pista o ejemplo.</li><li>Prioriza apoyo sistemático para las dificultades que persistieron aun con mediación.</li><li>Forma grupos flexibles según necesidad, no grupos fijos.</li><li>Ofrece profundización sin penalizar a quienes todavía no alcanzan ese reto.</li></ul></aside></div>
        <div className="diag-actions"><button className="diag-secundario" onClick={() => setPaso(2)}>Editar resultados</button><button className="diag-secundario" onClick={() => setPaso(4)}>Generar informe</button><button className="diag-primario" onClick={crearPlan}>Crear planificación desde el diagnóstico →</button></div>
      </section>}

      {paso === 4 && <section className="diag-informe-wrap">
        <div className="diag-informe-toolbar"><button className="diag-secundario" onClick={() => setPaso(3)}>← Volver al análisis</button><button className="diag-primario" onClick={imprimirInforme}>Imprimir / guardar PDF</button></div>
        <article className="diag-informe">
          <header><p>Distrito Educativo {perfil?.distrito || "________________"}</p><h1>{perfil?.centroEducativo || perfil?.centro || "Centro Educativo"}</h1><h2>Informe de Evaluación Diagnóstica</h2><p>Año escolar {anoEscolar}</p></header>
          <table className="diag-ficha"><tbody><tr><th>Área</th><td>{[area, asignatura].filter(Boolean).join(" · ") || "Área curricular"}</td><th>Docente</th><td>{perfil?.nombreDocente || "________________"}</td></tr><tr><th>Grado y sección</th><td>{[curso?.grado, curso?.seccion].filter(Boolean).join(" ") || curso?.nombre}</td><th>Estudiantes evaluados</th><td>{resumen.estudiantesCompletos} de {estudiantes.length}</td></tr></tbody></table>
          <h3>1. Propósito y contexto de aplicación</h3><p>La evaluación diagnóstica se aplicó al inicio del año escolar con el propósito de identificar los saberes previos, las destrezas adquiridas y las necesidades de aprendizaje de los estudiantes. Sus resultados orientan la planificación docente, el acompañamiento pedagógico y la selección de estrategias diferenciadas.</p><p>Se valoraron {aprendizajes.length} aprendizajes esenciales mediante actividades de recuperación de saberes, observación y producción. Los resultados no se emplean como calificación final, sino como punto de partida para la enseñanza.</p>
          <h3>2. Aprendizajes evaluados</h3><ol>{aprendizajes.map((item) => <li key={item}>{item}</li>)}</ol>
          <h3>3. Resultados generales</h3><table><thead><tr><th>Nivel de desempeño</th><th>Registros</th><th>Porcentaje</th></tr></thead><tbody>{Object.entries(resumen.nivelesInforme).map(([nivel, cantidad]) => <tr key={nivel}><td>{nombreNivel[nivel]}</td><td>{cantidad}</td><td>{resumen.porcentajesInforme[nivel]}%</td></tr>)}</tbody></table>
          <div className="diag-grafica-informe">{Object.entries(resumen.porcentajesInforme).map(([nivel, porcentaje]) => <div key={nivel}><b style={{ height: `${Math.max(porcentaje, 3)}%` }}><span>{porcentaje}%</span></b><small>{nombreNivel[nivel]}</small></div>)}</div>
          <h4>Resultados por dimensión</h4><table><thead><tr><th>Dimensión</th><th>Evidencias</th><th>Satisfactorias</th><th>Requieren apoyo</th><th>Dominio</th></tr></thead><tbody>{resumenDimensiones.map((item) => <tr key={item.dimension}><td>{item.dimension}</td><td>{item.evidencias}</td><td>{item.satisfactorios}</td><td>{item.apoyo}</td><td>{item.porcentaje}%</td></tr>)}</tbody></table>
          <div className="diag-barras-informe">{resumenDimensiones.map((item) => <div key={item.dimension}><span>{item.dimension}</span><i><b style={{ width: `${item.porcentaje}%` }} /></i><strong>{item.porcentaje}%</strong></div>)}</div>
          <h4>Agrupamientos iniciales sugeridos</h4><table><thead><tr><th>Recuperación</th><th>Consolidación</th><th>Nivel esperado</th><th>Profundización</th></tr></thead><tbody><tr><td>{perfilesGrupo.recuperacion}</td><td>{perfilesGrupo.consolidacion}</td><td>{perfilesGrupo.esperado}</td><td>{perfilesGrupo.profundizacion}</td></tr></tbody></table>
          <p><strong>Estudiantes para seguimiento prioritario:</strong> {perfilesEstudiantes.filter((item) => item.grupo === "Recuperación" || item.persistentes > 0).map((item) => item.nombre).join(", ") || "No se identificaron estudiantes con dificultad persistente en los registros disponibles."}</p>
          <p>Los resultados evidencian un predominio del nivel <strong>{nombreNivel[nivelPredominante]}</strong>, con un {resumen.porcentajesInforme[nivelPredominante]}% de los desempeños registrados. {resumen.porcentajesInforme.elemental > 20 ? "La proporción ubicada en el nivel Elemental requiere una respuesta pedagógica prioritaria y sostenida." : "El grupo presenta una base favorable, aunque permanecen aprendizajes que deben reforzarse."}</p>
          <h3>4. Fortalezas y aspectos a reforzar</h3><h4>Fortalezas</h4><ul>{resumen.brechas.filter((item) => item.porcentajeApoyo < 30).slice(0, 4).map((item) => <li key={item.aprendizaje}>{item.aprendizaje}: la mayoría evidencia un desempeño satisfactorio.</li>)}</ul><h4>Aspectos prioritarios</h4><ul>{prioridadesInforme.map((item) => <li key={item.aprendizaje}>{item.aprendizaje}: {item.porcentajeApoyo}% requiere apoyo o consolidación.</li>)}</ul>{observaciones && <><h4>Observaciones de la aplicación</h4><p>{observaciones}</p></>}
          <h3>5. Plan de acción</h3><table><thead><tr><th>Necesidad identificada</th><th>Acciones pedagógicas</th><th>Seguimiento</th></tr></thead><tbody>{(prioridadesInforme.length ? prioridadesInforme : resumen.brechas.slice(0, 2)).map((item) => { const dimension = itemsSeleccionados.find((actividad) => actividad.aprendizaje === item.aprendizaje)?.dimension || ""; return <tr key={item.aprendizaje}><td>{item.aprendizaje}<br/><small>{dimension}</small></td><td>{accionRecuperacion(dimension, area)}</td><td>Registro semanal de mediación y nueva evidencia al finalizar la secuencia de nivelación.</td></tr> })}</tbody></table>
          <h4>Acuerdos de seguimiento</h4><ul><li>Desarrollar una secuencia inicial de nivelación centrada en las brechas prioritarias.</li><li>Organizar agrupamientos flexibles y revisar su composición según los avances.</li><li>Aplicar evaluación formativa periódica con retroalimentación oportuna.</li><li>Registrar avances y ajustar la planificación al finalizar el primer período.</li></ul>
          <h3>6. Conclusión</h3><p>Los resultados constituyen el punto de partida para una planificación pertinente y diferenciada. Se priorizará el fortalecimiento de los aprendizajes señalados, manteniendo oportunidades de profundización para los estudiantes con desempeño satisfactorio o excelente.</p>
          <footer><div>____________________________<br/>Firma del docente</div><div>____________________________<br/>Coordinación pedagógica</div></footer>
        </article>
      </section>}
      {paqueteAbierto && <div className="diag-paquete-capa" role="dialog" aria-modal="true" aria-label="Paquete de evaluación diagnóstica"><div className="diag-paquete-toolbar"><button className="diag-secundario" onClick={() => setPaqueteAbierto(false)}>← Seguir editando</button><button className="diag-primario" onClick={() => window.print()}>Imprimir paquete</button></div><div className="diag-paquete">
        <section className="diag-documento diag-prueba"><header><p>{perfil?.centroEducativo || perfil?.centro || "Centro Educativo"}</p><h1>Evaluación Diagnóstica · {asignatura || area}</h1><p>{curso?.nombre} · Año escolar {anoEscolar}</p></header><div className="diag-datos-estudiante"><span>Nombre: ______________________________</span><span>Fecha: ______________</span></div><div className="diag-instrucciones"><strong>Antes de comenzar</strong><p>Esta actividad nos ayudará a saber qué recuerdas y cómo podemos apoyarte. No es una nota. Lee o escucha con calma y pregunta si no comprendes una instrucción.</p></div>{itemsSeleccionados.filter((item) => item.componente !== "desempeno").map((item, indice) => <article className="diag-pregunta" key={item.id}><div><b>{indice + 1}.</b><span>{item.dimension} · {etiquetaFormato[item.formatoRespuesta] || item.tipo}</span></div><p>{item.consignaObjetiva || item.consigna}</p><ItemObjetivo item={item}/></article>)}</section>
        <section className="diag-documento diag-guia-docente"><header><h1>Guía de aplicación y clave docente</h1><p>{curso?.nombre} · {asignatura || area} · {contexto.duracion} minutos</p></header><div className="diag-instrucciones"><strong>Condiciones</strong><p>{contexto.aplicacion} · Recursos: {contexto.recursos}. {contexto.caracteristicas && `Contexto del grupo: ${contexto.caracteristicas}`}</p></div>{itemsSeleccionados.map((item, indice) => <article className="diag-clave" key={item.id}><h3>{indice + 1}. {item.aprendizaje}</h3><p><strong>Formato:</strong> {item.componente === "desempeno" ? "Desempeño complementario" : etiquetaFormato[item.formatoRespuesta] || item.tipo}</p><p><strong>Consigna:</strong> {item.consignaObjetiva || item.consigna}</p><p><strong>Clave:</strong> {item.respuestaCorrecta || item.respuestaEsperada || "Valorar con rúbrica"}</p><p><strong>Materiales:</strong> {item.materiales || "Hoja del estudiante y lápiz."}</p><p><strong>Evidencia esperada:</strong> {item.respuestaEsperada || "Respuesta coherente con el aprendizaje observado."}</p><p><strong>Criterios observables:</strong> {item.criterios || "Comprensión, aplicación y comunicación del aprendizaje."}</p><p><strong>Apoyo permitido:</strong> {item.apoyo || "Aclarar la instrucción sin revelar la respuesta."}</p><p><strong>Indicador:</strong> {item.indicador || "Pendiente de vinculación curricular"}</p></article>)}</section>
        <section className="diag-documento diag-rubrica"><header><h1>Rúbrica diagnóstica común</h1><p>Valorar cada aprendizaje junto con la mediación que necesitó el estudiante.</p></header><table><thead><tr><th>Nivel</th><th>Descriptor</th><th>Uso diagnóstico</th></tr></thead><tbody><tr><th>Excelente · 100%</th><td>Resuelve o produce con autonomía, claridad y capacidad de explicar.</td><td>Profundización</td></tr><tr><th>Satisfactorio · 75%</th><td>Evidencia el aprendizaje esencial con pocos errores o apoyos menores.</td><td>Nivel esperado</td></tr><tr><th>Básico · 50%</th><td>Evidencia parcialmente el aprendizaje; mejora con pista o ejemplo.</td><td>Activación y consolidación</td></tr><tr><th>En proceso · 25%</th><td>Necesita apoyo constante o todavía no logra aportar evidencia suficiente.</td><td>Recuperación prioritaria</td></tr></tbody></table><h3>Registro de mediación</h3><ul>{MEDIACIONES_DIAGNOSTICO.map((opcion) => <li key={opcion.id}>□ {opcion.label}</li>)}</ul></section>
      </div></div>}
    </div>
  );
}
