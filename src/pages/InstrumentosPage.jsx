import { useEffect, useMemo, useRef, useState } from "react";
import ModalConfirmacion from "../components/ModalConfirmacion.jsx";
import { obtenerCompetencias } from "../services/curriculumService.js";
import {
  obtenerPlanificacionesDetalladas,
  guardarInstrumentoFirestore,
  obtenerInstrumentosFirestore,
  eliminarInstrumentoFirestore,
  guardarRegistroAspectoDesdeInstrumento,
  enviarNotaAlRegistro,
} from "../firebase";
import { sincronizarEvaluacionPedagogica } from "../services/nucleoPedagogicoService.js";
import { evaluarYRegistrar } from "../services/modoAulaService.js";
import { AIService } from "../services/ai/AIService";
import { buildAIContext } from "../services/ai/ContextBuilder.js";
import { EventTracker } from "../services/ai/learning/EventTracker.js";
import { LEARNING_EVENTS, AGENT_IDS } from "../services/ai/knowledge/KnowledgeTypes.js";
import "./InstrumentosPage.css";

const TIPOS_IA_PRIORITARIOS = [
  "Rúbrica",
  "Lista de cotejo",
  "Escala de estimación",
  "Registro anecdótico",
  "Prueba escrita",
  "Autoevaluación",
  "Coevaluación",
];

const parseInstrumentJSON = (text, prompt, curriculo, crearDraftFn, crearCriterioFn, tipo = "Rúbrica") => {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const data = JSON.parse(match[0]);
    const tipoEfectivo = tipo || "Rúbrica";
    const base = crearDraftFn(tipoEfectivo, curriculo);
    base.nombre = (data.nombre || prompt).slice(0, 120);
    base.descripcion = (data.descripcion || `Instrumento generado para ${prompt}`).slice(0, 300);

    if ((tipoEfectivo === "Lista de cotejo" || tipoEfectivo === "Autoevaluación") && Array.isArray(data.indicadores)) {
      base.estructura = {
        indicadores: data.indicadores.slice(0, 10).map((ind, i) => ({
          id: `ind-${Date.now()}-${i}`,
          indicador: typeof ind === "string" ? ind : (ind.indicador || `Indicador ${i + 1}`),
          si: true,
          no: false,
        })),
      };
    } else if (tipoEfectivo === "Escala de estimación" && Array.isArray(data.indicadores)) {
      base.estructura = {
        indicadores: data.indicadores.slice(0, 10).map((ind, i) => ({
          id: `esc-${Date.now()}-${i}`,
          indicador: ind.indicador || `Indicador ${i + 1}`,
          excelente: ind.excelente || "Siempre y con precisión",
          bueno: ind.bueno || "Casi siempre",
          regular: ind.regular || "Ocasionalmente",
          necesitaApoyo: ind.necesitaApoyo || "Requiere guía",
        })),
      };
    } else if (Array.isArray(data.criterios) && data.criterios.length > 0) {
      base.estructura = {
        criterios: data.criterios.slice(0, 8).map((c, i) => ({
          ...crearCriterioFn(i),
          criterio: c.criterio || `Criterio ${i + 1}`,
          nivel4: c.nivel4 || "Logro sobresaliente",
          nivel3: c.nivel3 || "Logro adecuado",
          nivel2: c.nivel2 || "Logro básico",
          nivel1: c.nivel1 || "En proceso",
        })),
      };
    }
    return base;
  } catch {
    return null;
  }
};

const TIPOS_INSTRUMENTO = [
  "Rúbrica",
  "Lista de cotejo",
  "Escala de estimación",
  "Registro anecdótico",
  "Prueba escrita",
  "Autoevaluación",
  "Coevaluación",
  "Guía de observación",
  "Proyecto",
  "Exposición oral",
  "Debate",
  "Portafolio",
];

const ESTADOS = ["Borrador", "Activo", "En uso", "Archivado"];
const TIPOS_BINARIOS = ["Lista de cotejo", "Autoevaluación"];
const TIPOS_ESCALA = ["Escala de estimación"];
const TIPOS_CRITERIOS = ["Rúbrica", "Registro anecdótico", "Prueba escrita", "Coevaluación"];
const TIPOS_CON_BLOQUE = [...TIPOS_BINARIOS, ...TIPOS_ESCALA, ...TIPOS_CRITERIOS];
const VALOR_INSTRUMENTO = {
  "Rúbrica": 50,
  "Lista de cotejo": 25,
  "Escala de estimación": 25,
};

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
  puntajeMaximo: [15, 17, 18][index % 3],
  nivel4: "Logro sobresaliente",
  nivel3: "Logro adecuado",
  nivel2: "Logro básico",
  nivel1: "En proceso",
  puntajesNiveles: null,
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
  if (TIPOS_BINARIOS.includes(tipo)) return { indicadores: [crearIndicador(0), crearIndicador(1), crearIndicador(2)] };
  if (TIPOS_ESCALA.includes(tipo)) return { indicadores: [crearEscala(0), crearEscala(1), crearEscala(2)] };
  return { criterios: [crearCriterio(0), crearCriterio(1), crearCriterio(2)] };
};

const crearDraft = (tipo = "Rúbrica", curriculo = null) => ({
  id: null,
  tipo,
  nombre: "",
  descripcion: "",
  estado: "Borrador",
  curriculoId: curriculo?.id || "",
  competenciaIndex: 0,
  estructura: crearEstructuraPorTipo(tipo),
});

const NIVELES_RUBRICA_MINERD = [
  { key: "nivel1", label: "Receptivo", factor: 0.55 },
  { key: "nivel2", label: "Resolutivo", factor: 0.7 },
  { key: "nivel3", label: "Autónomo", factor: 0.85 },
  { key: "nivel4", label: "Estratégico", factor: 1 },
];

const TOTALES_RUBRICA_MINERD = [50, 75, 100];
const PESOS_BASE_RUBRICA_MINERD = [15, 17, 18];

const puntajesPorNivel = (puntajeMaximo) => Object.fromEntries(
  NIVELES_RUBRICA_MINERD.map((nivel) => [nivel.key, Number((puntajeMaximo * nivel.factor).toFixed(2))])
);

const distribuirPonderacionRubrica = (total = 50) => {
  const totalSeguro = Number(total) || 50;
  const baseTotal = PESOS_BASE_RUBRICA_MINERD.reduce((sum, valor) => sum + valor, 0);
  let acumulado = 0;
  return PESOS_BASE_RUBRICA_MINERD.map((peso, index) => {
    if (index === PESOS_BASE_RUBRICA_MINERD.length - 1) {
      return Number((totalSeguro - acumulado).toFixed(2));
    }
    const escalado = Number(((peso / baseTotal) * totalSeguro).toFixed(2));
    acumulado += escalado;
    return escalado;
  });
};

const nombreRubricaMINERD = (curriculo = null, total = 50) =>
  `Rúbrica MINERD ${total} pts — ${curriculo?.actividad || curriculo?.competencia || "Producto o desempeño"}`;

const descripcionRubricaMINERD = (total = 50) =>
  `Modelo de rúbrica por niveles Receptivo, Resolutivo, Autónomo y Estratégico, con ponderación total de ${total} puntos.`;

const crearRubricaModeloMINERD = (curriculo = null, total = 50) => {
  const ponderacion = distribuirPonderacionRubrica(total);
  const criterios = [
    {
      criterio: "Dominio del contenido y uso del vocabulario en situaciones comunicativas",
      puntajeMaximo: ponderacion[0],
      nivel1: "Reconoce vocabulario básico relacionado con el tema, pero presenta limitaciones para usarlo.",
      nivel2: "Responde preguntas simples usando frases cortas y vocabulario practicado.",
      nivel3: "Intercambia información sobre el tema con iniciativa, claridad y cierta fluidez.",
      nivel4: "Crea y maneja situaciones de interacción más complejas, mostrando creatividad y uso adecuado del idioma o contenido.",
    },
    {
      criterio: "Comprensión del tema, su utilidad e importancia en contextos reales",
      puntajeMaximo: ponderacion[1],
      nivel1: "Identifica ideas básicas del tema, aunque con errores frecuentes y poca claridad.",
      nivel2: "Explica aspectos sencillos del tema y los relaciona con ejemplos guiados.",
      nivel3: "Relaciona el tema con experiencias, contextos o intercambios culturales de manera comprensible.",
      nivel4: "Demuestra comprensión profunda del tema y lo aplica con pertinencia en situaciones reales o simuladas.",
    },
    {
      criterio: "Representación, producto o desempeño en diversos contextos",
      puntajeMaximo: ponderacion[2],
      nivel1: "Presenta una representación inicial del tema; el razonamiento o producto puede estar incompleto.",
      nivel2: "Responde o produce evidencias relacionadas con el tema y su uso en contextos conocidos.",
      nivel3: "Analiza situaciones donde el tema influye en la interacción, el producto o el desempeño esperado.",
      nivel4: "Diseña o presenta situaciones complejas que integran el tema, el contexto y la intención comunicativa o pedagógica.",
    },
  ].map((criterio, index) => ({
    ...crearCriterio(index),
    ...criterio,
    puntajesNiveles: puntajesPorNivel(criterio.puntajeMaximo),
  }));

  return {
    ...crearDraft("Rúbrica", curriculo),
    tipo: "Rúbrica",
    nombre: nombreRubricaMINERD(curriculo, total),
    descripcion: descripcionRubricaMINERD(total),
    valorMaximo: Number(total) || 50,
    estado: "Borrador",
    estructura: {
      modelo: "rubrica_minerd_ponderada",
      totalPuntos: Number(total) || 50,
      proporcionBase: PESOS_BASE_RUBRICA_MINERD,
      niveles: NIVELES_RUBRICA_MINERD,
      criterios,
    },
  };
};

const escalarRubricaMINERD = (draft, total, curriculo = null) => {
  const ponderacion = distribuirPonderacionRubrica(total);
  return {
    ...draft,
    nombre: draft?.estructura?.modelo === "rubrica_minerd_ponderada"
      ? nombreRubricaMINERD(curriculo, total)
      : draft.nombre,
    descripcion: draft?.estructura?.modelo === "rubrica_minerd_ponderada"
      ? descripcionRubricaMINERD(total)
      : draft.descripcion,
    valorMaximo: Number(total) || 50,
    estructura: {
      ...draft.estructura,
      modelo: draft?.estructura?.modelo || "rubrica_minerd_ponderada",
      totalPuntos: Number(total) || 50,
      proporcionBase: PESOS_BASE_RUBRICA_MINERD,
      niveles: draft?.estructura?.niveles || NIVELES_RUBRICA_MINERD,
      criterios: (draft?.estructura?.criterios || []).map((criterio, index) => {
        const puntajeMaximo = ponderacion[index] ?? 0;
        return {
          ...criterio,
          puntajeMaximo,
          puntajesNiveles: puntajesPorNivel(puntajeMaximo),
        };
      }),
    },
  };
};

const etiquetaNivel = (estructura, key, fallback) =>
  estructura?.niveles?.find((nivel) => nivel.key === key)?.label || fallback;

const guardarLocal = (clave, valor) => localStorage.setItem(clave, JSON.stringify(valor));

const cargarLocal = (clave, fallback) => {
  try {
    const guardado = localStorage.getItem(clave);
    return guardado ? JSON.parse(guardado) : fallback;
  } catch {
    return fallback;
  }
};

const cargarInstrumentosLocales = () => {
  const v2 = cargarLocal("docenteos_instrumentos_v2", []);
  if (Array.isArray(v2) && v2.length > 0) return v2;
  return cargarLocal("docenteos_instrumentos_v1", []);
};

const normalizarPlanificacion = (item, index) => {
  const contenido = item?.contenido || item || {};
  const meta = contenido?.metadatos || item?.metadatos || {};
  const data = contenido?.datosGenerales || item?.datosGenerales || {};
  const capa = item?.capaCurricular || contenido?.capaCurricular || {};
  const semanas = contenido?.semanas || contenido?.fasesSemanales || data?.semanas || [];
  const primeraFase = semanas[0] || {};
  const primeraActividad = primeraFase.actividades?.[0] || primeraFase.dias?.[0]?.momentos?.[0]?.actividades?.[0] || "";
  const productoEsperado = meta.productoEsperado
    || data.productoEsperado
    || primeraFase.productoEsperado
    || primeraActividad?.productoEsperado
    || primeraActividad?.producto
    || "";
  const evidenciasEsperadas = Array.isArray(meta.evidenciasEsperadas)
    ? meta.evidenciasEsperadas
    : Array.isArray(data.evidenciasEsperadas)
      ? data.evidenciasEsperadas
      : Array.isArray(primeraActividad?.evidencias)
        ? primeraActividad.evidencias
        : [];
  const indicadores = Array.isArray(meta.indicadoresOficiales)
    ? meta.indicadoresOficiales
    : Array.isArray(data.indicadoresOficiales)
      ? data.indicadoresOficiales
      : Array.isArray(capa.indicadoresSeleccionados)
        ? capa.indicadoresSeleccionados.map((ind) => ind.descripcion || ind.indicador || ind.id).filter(Boolean)
        : [];
  const competenciaCapa = Array.isArray(capa.competenciasSeleccionadas) && capa.competenciasSeleccionadas.length
    ? capa.competenciasSeleccionadas[0]?.descripcion || capa.competenciasSeleccionadas[0]?.nombre
    : "";

  return {
    id: item?.id || `plan-${index}`,
    curso: meta.curso || [meta.grado || capa.grado, meta.seccion || capa.seccion].filter(Boolean).join(" ") || item?.curso || "Curso",
    area: meta.area || data.area || capa.area || item?.area || "Área",
    asignatura: meta.asignatura || data.asignatura || capa.asignatura || data.area || meta.area || item?.area || "Asignatura",
    grado: meta.grado || capa.grado || item?.grado || "Grado",
    periodo: meta.periodo || capa.periodo || item?.periodo || "Periodo 1",
    competencia: meta.competenciaSeleccionada || data.competencia || competenciaCapa || item?.competencia || "Competencia específica",
    indicador: indicadores[0] || item?.indicador || "Indicador de logro",
    indicadores,
    indicadorIds: Array.isArray(capa.indicadoresSeleccionados) ? capa.indicadoresSeleccionados.map((ind) => ind.id).filter(Boolean) : [],
    aspectoRegistroIds: Array.isArray(capa.indicadoresSeleccionados) ? capa.indicadoresSeleccionados.map((ind) => [item?.id || `plan-${index}`, ind.id].filter(Boolean).join("_")).filter(Boolean) : [],
    capaCurricular: capa,
    planificacionId: item?.id || `plan-${index}`,
    cursoId: item?.cursoId || meta.cursoId || data.cursoId || capa.cursoId || "",
    seccion: meta.seccion || data.seccion || capa.seccion || item?.seccion || "",
    estrategia: meta.estrategiaTexto || data.estrategiaTexto || data.estrategia || primeraFase.estrategia || "Estrategia no especificada",
    actividad: typeof primeraActividad === "string"
      ? primeraActividad
      : primeraActividad?.titulo || primeraActividad?.nombre || primeraActividad?.descripcion || "Actividad no especificada",
    productoEsperado,
    evidenciasEsperadas,
    titulo: `${meta.grado || capa.grado || item?.curso || "Curso"} · ${meta.area || data.area || capa.area || item?.area || "Área"}`,
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

const nombreEstudiante = (estudiante) => {
  if (typeof estudiante === "string") return estudiante;
  return estudiante?.nombre || estudiante?.name || estudiante?.nombreCompleto || "Estudiante";
};

const normalizarCursoComoCurriculo = (curso, index = 0) => ({
  id: curso?.id || `curso-${index}`,
  cursoId: curso?.id || `curso-${index}`,
  curso: curso?.nombre || curso?.name || `Curso ${index + 1}`,
  area: curso?.area || "Área",
  asignatura: curso?.asignatura || curso?.area || "Asignatura",
  grado: curso?.grado || curso?.nivel || "Grado",
  seccion: curso?.seccion || "",
  periodo: curso?.periodo || "Periodo 1",
  competencia: curso?.temaActual || curso?.competencia || "Competencia específica",
  indicador: curso?.indicador || curso?.temaActual || "Indicador de logro",
  indicadores: curso?.indicadores?.length
    ? curso.indicadores
    : [curso?.indicador || curso?.temaActual].filter(Boolean),
  planificacionId: curso?.planificacionId || curso?.id || `curso-${index}`,
  estrategia: curso?.estrategia || "Estrategia no especificada",
  actividad: curso?.actividad || curso?.temaActual || "Actividad no especificada",
  productoEsperado: curso?.productoEsperado || "",
  evidenciasEsperadas: curso?.evidenciasEsperadas || [],
  titulo: `${curso?.nombre || curso?.name || `Curso ${index + 1}`} · ${curso?.area || "Área"}`,
});

const crearValorInicial = (tipo, estructura) => {
  if (TIPOS_BINARIOS.includes(tipo)) {
    return Object.fromEntries((estructura?.indicadores || []).map((item) => [item.id, true]));
  }
  if (TIPOS_ESCALA.includes(tipo)) {
    return Object.fromEntries((estructura?.indicadores || []).map((item) => [item.id, "4"]));
  }
  if (TIPOS_CON_BLOQUE.includes(tipo)) {
    return Object.fromEntries((estructura?.criterios || []).map((item) => [item.id, 4]));
  }
  return { calificacion: "", observacion: "" };
};

function InstrumentosPage({ cursos = [], cursoActivo = null, onIrA = () => {} }) {
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
  const [estudianteAplicar, setEstudianteAplicar] = useState("fb-1");
  const [evaluacionAplicar, setEvaluacionAplicar] = useState({});
  const [guardandoAplicacion, setGuardandoAplicacion] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiTipo, setAiTipo] = useState("Rúbrica");
  const [aiDraft, setAiDraft] = useState(null);
  const [aiGenerando, setAiGenerando] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const busquedaRef = useRef(null);
  const statsRef = useRef(null);
  const [competenciasCurso, setCompetenciasCurso] = useState([]);
  const [confirmEliminar, setConfirmEliminar] = useState(null); // { id, mensaje }

  useEffect(() => {
    const nivel = cursoActivo?.nivel;
    const grado = cursoActivo?.grado || cursoActivo?.nombre?.split(" ").slice(0, 2).join(" ");
    const area = cursoActivo?.area || cursoActivo?.asignatura;
    if (!nivel || !grado || !area) { setCompetenciasCurso([]); return; }
    obtenerCompetencias(nivel, grado, area).then((comps) => {
      setCompetenciasCurso(comps?.length ? comps : []);
    });
  }, [
    cursoActivo?.id,
    cursoActivo?.nivel,
    cursoActivo?.grado,
    cursoActivo?.nombre,
    cursoActivo?.area,
    cursoActivo?.asignatura,
  ]);
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
    const curriculoCursoActivo = cursoActivo ? normalizarCursoComoCurriculo(cursoActivo) : null;

    if (planificaciones.length) {
      if (!curriculoCursoActivo) return planificaciones;
      const referenciasCurso = [cursoActivo.id, cursoActivo.nombre, cursoActivo.name].filter(Boolean).map(String);
      const planificacionesDelCurso = planificaciones.filter((planificacion) => {
        const referenciasPlan = [
          planificacion.cursoId,
          planificacion.curso,
          planificacion.id,
        ].filter(Boolean).map(String);
        return referenciasCurso.some((ref) => referenciasPlan.includes(ref));
      });
      const idsIncluidos = new Set(planificacionesDelCurso.map((item) => item.id));
      return [
        ...(planificacionesDelCurso.length ? planificacionesDelCurso : [curriculoCursoActivo]),
        ...planificaciones.filter((item) => !idsIncluidos.has(item.id)),
      ];
    }

    const desdeCursos = (cursos || []).slice(0, 6).map(normalizarCursoComoCurriculo);

    if (desdeCursos.length) {
      if (!curriculoCursoActivo) return desdeCursos;
      return [
        curriculoCursoActivo,
        ...desdeCursos.filter((item) => item.id !== curriculoCursoActivo.id),
      ];
    }

    return [
      { id: "fb-1", curso: "2do Secundaria A", area: "Matemática", asignatura: "Matemática", grado: "2do Secundaria", periodo: "Periodo 1", competencia: "Resuelve problemas con funciones lineales", indicador: "Modela situaciones usando relaciones lineales", titulo: "2do Secundaria A · Matemática" },
      { id: "fb-2", curso: "1ro Secundaria B", area: "Lengua Española", asignatura: "Lengua Española", grado: "1ro Secundaria", periodo: "Periodo 2", competencia: "Produce textos argumentativos", indicador: "Sustenta ideas con argumentos", titulo: "1ro Secundaria B · Lengua Española" },
      { id: "fb-3", curso: "6to Primaria", area: "Ciencias de la Naturaleza", asignatura: "Ciencias de la Naturaleza", grado: "6to Primaria", periodo: "Periodo 3", competencia: "Explica fenómenos naturales", indicador: "Relaciona causas y efectos", titulo: "6to Primaria · Ciencias de la Naturaleza" },
    ];
  }, [cursoActivo, cursos, planificaciones]);

  useEffect(() => {
    const idCursoActivo = cursoActivo?.id ? String(cursoActivo.id) : "";
    if (idCursoActivo && curriculosDisponibles.some((item) => String(item.cursoId || item.id) === idCursoActivo)) {
      const curriculoDelCurso = curriculosDisponibles.find((item) => String(item.cursoId || item.id) === idCursoActivo);
      if (curriculoDelCurso?.id && curriculoId !== curriculoDelCurso.id) {
        setCurriculoId(curriculoDelCurso.id);
      }
      return;
    }
    if (!curriculoId && curriculosDisponibles.length) {
      setCurriculoId(curriculosDisponibles[0].id);
    }
  }, [cursoActivo, curriculoId, curriculosDisponibles]);

  const curriculoActivo = useMemo(
    () => curriculosDisponibles.find((item) => item.id === curriculoId) || curriculosDisponibles[0] || null,
    [curriculoId, curriculosDisponibles]
  );

  const obtenerCursoRelacionado = (referencia = curriculoActivo) => {
    if (!referencia) return null;
    const referencias = [
      referencia.cursoId,
      referencia.curriculoId,
      referencia.id,
      referencia.curso,
      referencia.nombre,
      referencia.grado,
    ].filter(Boolean).map(String);

    return cursos.find((curso) => {
      const nombres = [curso.id, curso.nombre, curso.name, curso.grado].filter(Boolean).map(String);
      const matchExacto = referencias.some((ref) => nombres.includes(ref));
      if (matchExacto) return true;
      const mismoGrado = referencia.grado && curso.grado && String(referencia.grado).toLowerCase() === String(curso.grado).toLowerCase();
      const mismaSeccion = !referencia.seccion || !curso.seccion || String(referencia.seccion).toLowerCase() === String(curso.seccion).toLowerCase();
      const mismaArea = !referencia.area || !curso.area || String(referencia.area).toLowerCase() === String(curso.area).toLowerCase();
      return mismoGrado && mismaSeccion && mismaArea;
    }) || null;
  };

  const obtenerEstudiantesPorInstrumento = (instrumento = null) => {
    const cursoRelacionado = obtenerCursoRelacionado(instrumento || curriculoActivo);

    const estudiantesCurso = cursoRelacionado?.estudiantesDetalle || cursoRelacionado?.estudiantesLista || cursoRelacionado?.estudiantesNombres || [];
    const estudiantesNormalizados = estudiantesCurso
      .map((estudiante, index) => ({
        id: estudiante?.id || `est-${index}`,
        nombre: nombreEstudiante(estudiante),
      }))
      .filter((estudiante) => estudiante.nombre);
    if (cursoRelacionado) return estudiantesNormalizados;
    return cursos.length > 0
      ? []
      : ESTUDIANTES_FALLBACK.map((nombre, index) => ({ id: `fb-${index + 1}`, nombre }));
  };

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
          const local = cargarInstrumentosLocales();
          if (activo && local.length > 0) setInstrumentos(local);
        }
      } catch {
        if (activo) {
          const local = cargarInstrumentosLocales();
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
      evaluacionId: instrumento.evaluacionId,
      valorMaximo: instrumento.valorMaximo || VALOR_INSTRUMENTO[instrumento.tipo] || 100,
      competenciaIndex: instrumento.competenciaIndex ?? 0,
      estructura: instrumento.estructura || crearEstructuraPorTipo(instrumento.tipo),
    });
    setModal("editar");
  };

  const crearConIAInterno = async (tipo, temaPrompt) => {
    setAiGenerando(true);
    setAiError(null);
    setAiDraft(null);
    let accumulated = "";

    // Usar ContextBuilder para contexto mínimo: solo tipo + tema + UNA competencia + UN indicador
    const ctx = await buildAIContext("generar_instrumento", {
      tipo,
      tema:        temaPrompt,
      area:        curriculoActivo?.area        || "",
      asignatura:  curriculoActivo?.asignatura  || curriculoActivo?.area || "",
      grado:       curriculoActivo?.grado       || "",
      competencia: curriculoActivo?.competencia || "",
      indicador:   curriculoActivo?.indicador   || "",
    });

    await AIService.generate({
      module: "instrumentos",
      prompt: ctx.prompt,
      system: ctx.system,
      maxTokens: ctx.recommendedMaxTokens,
      _contextMeta: ctx.meta,
      onChunk: (chunk) => { accumulated += chunk; },
      onFinish: () => {
        const parsed = parseInstrumentJSON(accumulated, temaPrompt, curriculoActivo, crearDraft, crearCriterio, tipo);
        if (parsed) {
          setAiDraft(parsed);
          setModal("ia");
        } else {
          const base = crearDraft(tipo, curriculoActivo);
          base.nombre = temaPrompt;
          base.descripcion = `Instrumento de evaluación para: ${temaPrompt}`;
          setAiDraft(base);
          setModal("ia");
        }
        setAiGenerando(false);
      },
      onError: (msg) => { setAiError(msg); setAiGenerando(false); },
    });
  };

  const crearConIA = () => {
    const tema = aiPrompt.trim() ||
      (curriculoActivo?.competencia ? `${curriculoActivo.competencia} — ${curriculoActivo.area || ""}` : "Evaluación de competencias");
    crearConIAInterno(aiTipo, tema);
  };

  const crearConIARapido = (tipo) => {
    const tema = curriculoActivo?.competencia
      ? `${curriculoActivo.competencia}${curriculoActivo.indicador ? ` — ${curriculoActivo.indicador}` : ""}`
      : aiPrompt.trim() || `${tipo} de evaluación`;
    setAiTipo(tipo);
    crearConIAInterno(tipo, tema);
  };

  const guardarInstrumento = () => {
    if (!draft.nombre?.trim()) {
      setMensaje({ tipo: "error", texto: "El instrumento debe tener un nombre antes de guardar." });
      setTimeout(() => setMensaje(null), 3000);
      return;
    }
    const tipo = draft.tipo || "Rúbrica";
    const cursoRelacionado = obtenerCursoRelacionado(curriculoActivo);
    const planificacionId = curriculoActivo?.planificacionId || curriculoActivo?.id || "";
    const evaluacionId = draft.evaluacionId || `eval-${planificacionId || curriculoActivo?.cursoId || curriculoActivo?.curso || "general"}-${curriculoActivo?.periodo || "periodo-1"}`;
    const instrumento = {
      id: draft.id || `ins-${Date.now()}`,
      evaluacionId,
      planificacionId,
      cursoId: cursoRelacionado?.id || curriculoActivo?.cursoId || curriculoActivo?.id || "registro-general",
      tipo,
      nombre: draft.nombre || `${tipo} - ${curriculoActivo?.competencia || "Nuevo instrumento"}`,
      descripcion: draft.descripcion || "Diseño listo para usar.",
      curso: curriculoActivo?.curso || "Curso",
      area: curriculoActivo?.area || "Área",
      asignatura: curriculoActivo?.asignatura || curriculoActivo?.area || "Asignatura",
      grado: curriculoActivo?.grado || "Grado",
      seccion: curriculoActivo?.seccion || cursoRelacionado?.seccion || "",
      periodo: curriculoActivo?.periodo || "Periodo 1",
      competencia: curriculoActivo?.competencia || "Competencia específica",
      indicador: curriculoActivo?.indicador || "Indicador de logro",
      indicadores: curriculoActivo?.indicadores?.length ? curriculoActivo.indicadores : [curriculoActivo?.indicador || "Indicador de logro"],
      indicadorIds: curriculoActivo?.indicadorIds || [],
      aspectoRegistroIds: curriculoActivo?.aspectoRegistroIds || [],
      claseId: draft.claseId || curriculoActivo?.claseId || "",
      estrategia: curriculoActivo?.estrategia || "Estrategia no especificada",
      actividad: curriculoActivo?.actividad || "Actividad no especificada",
      productoEsperado: curriculoActivo?.productoEsperado || "",
      evidenciasEsperadas: curriculoActivo?.evidenciasEsperadas || [],
      valorMaximo: draft.valorMaximo || VALOR_INSTRUMENTO[tipo] || 100,
      competenciaIndex: draft.competenciaIndex ?? 0,
      fechaCreacion: draft.fechaCreacion || new Date().toISOString(),
      estado: draft.estado || "Borrador",
      usos: draft.usos || 0,
      curriculoId: curriculoActivo?.id || draft.curriculoId || "",
      vinculacion: {
        area: curriculoActivo?.area || "",
        asignatura: curriculoActivo?.asignatura || "",
        grado: curriculoActivo?.grado || "",
        curso: curriculoActivo?.curso || "",
        cursoId: cursoRelacionado?.id || curriculoActivo?.cursoId || "",
        seccion: curriculoActivo?.seccion || cursoRelacionado?.seccion || "",
        planificacionId,
        competenciaEspecifica: curriculoActivo?.competencia || "",
        indicadorLogro: curriculoActivo?.indicador || "",
        indicadoresLogro: curriculoActivo?.indicadores?.length ? curriculoActivo.indicadores : [curriculoActivo?.indicador || ""].filter(Boolean),
        indicadorIds: curriculoActivo?.indicadorIds || [],
        aspectoRegistroIds: curriculoActivo?.aspectoRegistroIds || [],
        estrategia: curriculoActivo?.estrategia || "",
        actividad: curriculoActivo?.actividad || "",
        productoEsperado: curriculoActivo?.productoEsperado || "",
        evidenciasEsperadas: curriculoActivo?.evidenciasEsperadas || [],
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
    guardarRegistroAspectoDesdeInstrumento(instrumento).catch((err) => console.error("[Instrumentos] Error al crear aspecto:", err));
    EventTracker.track(LEARNING_EVENTS.INSTRUMENTO_ACEPTADO, {
      agentId: AGENT_IDS.GENERADOR_INSTRUMENTOS,
      area:       instrumento.area ?? null,
      asignatura: instrumento.asignatura ?? null,
      grado:      instrumento.grado ?? null,
      tema:       instrumento.nombre ?? null,
      metadata:   { tipoInstrumento: instrumento.tipo }
    });
    setModal(null);
    setMensaje({ tipo: "success", texto: "Instrumento guardado y conectado al Registro." });
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
    const instrumento = instrumentos.find((item) => item.id === id);
    const aplicaciones = instrumento?.aplicaciones?.length || instrumento?.usos || 0;
    if (aplicaciones > 0) {
      setConfirmEliminar({ id, mensaje: "Este instrumento tiene aplicaciones registradas. ¿Deseas eliminarlo de todos modos?" });
      return;
    }
    ejecutarEliminarInstrumento(id);
  };

  const ejecutarEliminarInstrumento = (id) => {
    setInstrumentos((prev) => prev.filter((item) => item.id !== id));
    eliminarInstrumentoFirestore(id).catch((err) => console.error("[Instrumentos] Error al eliminar:", err));
  };

  const abrirAplicacion = (instrumento) => {
    const estudiantesDisponibles = obtenerEstudiantesPorInstrumento(instrumento);
    setInstrumentoAplicar(instrumento);
    setEstudianteAplicar(estudiantesDisponibles[0]?.id || "fb-1");
    setEvaluacionAplicar(crearValorInicial(instrumento.tipo, instrumento.estructura));
    setModal("aplicar");
  };

  const calcularResultado = (instrumento, evaluacion) => {
    if (!instrumento) return 0;
    const tipo = leerTipo(instrumento);

    if (TIPOS_BINARIOS.includes(tipo)) {
      const indicadores = instrumento.estructura?.indicadores || [];
      const positivos = indicadores.filter((item) => evaluacion[item.id]).length;
      return indicadores.length ? Math.round((positivos / indicadores.length) * 100) : 0;
    }

    if (TIPOS_ESCALA.includes(tipo)) {
      const valores = Object.values(evaluacion).map(Number).filter((valor) => Number.isFinite(valor));
      return valores.length ? Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 25) : 0;
    }

    if (TIPOS_CRITERIOS.includes(tipo)) {
      const criterios = instrumento.estructura?.criterios || [];
      const tienePonderacion = criterios.some((criterio) => Number(criterio.puntajeMaximo) > 0 || criterio.puntajesNiveles);
      if (tienePonderacion) {
        const maximo = criterios.reduce((sum, criterio) => sum + (Number(criterio.puntajeMaximo) || 0), 0);
        const obtenido = criterios.reduce((sum, criterio) => {
          const nivel = Number(evaluacion[criterio.id]);
          if (!Number.isFinite(nivel)) return sum;
          const key = `nivel${nivel}`;
          const puntajeNivel = Number(criterio.puntajesNiveles?.[key]);
          if (Number.isFinite(puntajeNivel)) return sum + puntajeNivel;
          const puntajeMaximo = Number(criterio.puntajeMaximo) || 0;
          return sum + (puntajeMaximo * (nivel / 4));
        }, 0);
        return maximo ? Math.round((obtenido / maximo) * 100) : 0;
      }
      const valores = Object.values(evaluacion).map(Number).filter((valor) => Number.isFinite(valor));
      return valores.length ? Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 25) : 0;
    }

    const calificacion = Number(evaluacion.calificacion || 0);
    return Number.isFinite(calificacion) ? calificacion : 0;
  };

  const guardarAplicacion = async () => {
    if (!instrumentoAplicar || guardandoAplicacion) return;

    const estudianteSeleccionado = estudiantesAplicacion.find((estudiante) => estudiante.id === estudianteAplicar)
      || estudiantesAplicacion[0];
    if (!estudianteSeleccionado?.id) {
      setMensaje({ tipo: "error", texto: "Este curso no tiene estudiantes reales cargados para aplicar el instrumento." });
      setTimeout(() => setMensaje(null), 3000);
      return;
    }
    const porcentaje = calcularResultado(instrumentoAplicar, evaluacionAplicar);
    const valorMaximo = Number(instrumentoAplicar.valorMaximo) || VALOR_INSTRUMENTO[instrumentoAplicar.tipo] || 100;
    const calificacion = Math.round((porcentaje / 100) * valorMaximo);
    const registro = {
      estudianteId: estudianteSeleccionado.id,
      estudiante: estudianteSeleccionado.nombre,
      fecha: new Date().toISOString(),
      periodo: instrumentoAplicar.periodo,
      competenciaEvaluada: instrumentoAplicar.competencia,
      indicadorEvaluado: instrumentoAplicar.indicador,
      indicadoresEvaluados: instrumentoAplicar.indicadores || [instrumentoAplicar.indicador].filter(Boolean),
      calificacionObtenida: calificacion,
      porcentajeObtenido: porcentaje,
      puntosObtenidos: calificacion,
      valorMaximo,
      evaluacionId: instrumentoAplicar.evaluacionId,
      planificacionId: instrumentoAplicar.planificacionId,
      estrategia: instrumentoAplicar.estrategia || "",
      actividad: instrumentoAplicar.actividad || "",
      observacion: evaluacionAplicar.observacion || "",
      detalle: evaluacionAplicar,
    };

    const instrumentoActualizado = {
      ...instrumentoAplicar,
      usos: (instrumentoAplicar.usos || 0) + 1,
      estado: instrumentoAplicar.estado === "Borrador" ? "Activo" : instrumentoAplicar.estado,
      aplicaciones: [...(instrumentoAplicar.aplicaciones || []).filter((item) => item.estudianteId !== registro.estudianteId), registro],
      registroIntegracion: {
        competenciaEvaluada: instrumentoAplicar.competencia,
        indicadorEvaluado: instrumentoAplicar.indicador,
        indicadoresEvaluados: instrumentoAplicar.indicadores || [instrumentoAplicar.indicador].filter(Boolean),
        calificacionObtenida: calificacion,
        porcentajeObtenido: porcentaje,
        valorMaximo,
        fecha: registro.fecha,
        periodo: instrumentoAplicar.periodo,
      },
    };

    setGuardandoAplicacion(true);
    setInstrumentos((prev) => {
      return prev.map((item) => (item.id === instrumentoAplicar.id ? instrumentoActualizado : item));
    });
    try {
      await guardarInstrumentoFirestore(instrumentoActualizado);
      const instrumentoHilo = {
        ...instrumentoActualizado,
        indicadorIds: instrumentoActualizado.indicadorIds || instrumentoActualizado.vinculacion?.indicadorIds || [],
        aspectoRegistroIds: instrumentoActualizado.aspectoRegistroIds || instrumentoActualizado.vinculacion?.aspectoRegistroIds || [],
        valorMaximo,
      };
      const resultadoHilo = await evaluarYRegistrar({
        instrumento: instrumentoHilo,
        claseTitulo: instrumentoActualizado.actividad || instrumentoActualizado.nombre,
        aplicaciones: [{
          estudianteId: registro.estudianteId,
          estudianteNombre: registro.estudiante,
          puntajeObtenido: calificacion,
          estado: "evaluado",
          observacionDocente: registro.observacion,
        }],
      }).catch(async (error) => {
        console.warn("[Instrumentos] Hilo pedagógico no disponible, usando puente legacy:", error);
        await enviarNotaAlRegistro({
          cursoId:     instrumentoActualizado.cursoId || instrumentoActualizado.vinculacion?.cursoId || "",
          area:        instrumentoActualizado.area    || instrumentoActualizado.vinculacion?.area    || "",
          estId:       registro.estudianteId,
          estNombre:   registro.estudiante,
          competencia: instrumentoActualizado.competencia || instrumentoActualizado.vinculacion?.competenciaEspecifica || "",
          periodoStr:  instrumentoActualizado.periodo,
          nota:        registro.calificacionObtenida,
        });
        await sincronizarEvaluacionPedagogica({
          instrumento: instrumentoActualizado,
          aplicacion: registro,
          cursoId: instrumentoActualizado.cursoId || obtenerCursoRelacionado(instrumentoActualizado)?.id,
        });
        return { exitosos: [{ modo: "legacy" }], errores: [] };
      });
      if (resultadoHilo?.errores?.length) {
        setMensaje({ tipo: "error", texto: resultadoHilo.errores[0].mensaje });
      } else {
        setMensaje({ tipo: "success", texto: "Evaluación guardada, evidencia creada y Registro actualizado." });
      }
      setModal(null);
      setTimeout(() => setMensaje(null), 2500);
    } catch (error) {
      console.error("[Instrumentos] Error al guardar aplicación:", error);
      setMensaje({ tipo: "error", texto: `No se pudo guardar la evaluación: ${error.message || "revisa la conexión."}` });
      setTimeout(() => setMensaje(null), 3500);
    } finally {
      setGuardandoAplicacion(false);
    }
  };

  const filasConstructor = useMemo(() => {
    if (TIPOS_BINARIOS.includes(draft.tipo)) return draft.estructura?.indicadores || [];
    if (TIPOS_ESCALA.includes(draft.tipo)) return draft.estructura?.indicadores || [];
    return draft.estructura?.criterios || [];
  }, [draft]);

  const aplicarFiltroRapido = (tipo) => {
    setFiltroTipo(tipo);
    bancoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const abrirNuevoConTipo = (tipo) => {
    abrirNuevo(tipo);
  };

  const abrirModeloRubricaMINERD = () => {
    setDraft(crearRubricaModeloMINERD(curriculoActivo));
    setCurriculoId(curriculoActivo?.id || curriculosDisponibles[0]?.id || "");
    setModal("crear");
  };

  const cambiarTotalRubricaMINERD = (total) => {
    setDraft((prev) => escalarRubricaMINERD(prev, total, curriculoActivo));
  };

  const estudiantesAplicacion = instrumentoAplicar
    ? obtenerEstudiantesPorInstrumento(instrumentoAplicar)
    : ESTUDIANTES_FALLBACK.map((nombre, index) => ({ id: `fb-${index + 1}`, nombre }));

  const modificarFila = (index, clave, valor) => {
    setDraft((prev) => {
      if (TIPOS_BINARIOS.includes(prev.tipo)) {
        return {
          ...prev,
          estructura: {
            ...prev.estructura,
            indicadores: prev.estructura.indicadores.map((item, filaIndex) => (filaIndex === index ? { ...item, [clave]: valor } : item)),
          },
        };
      }

      if (TIPOS_ESCALA.includes(prev.tipo)) {
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
          criterios: prev.estructura.criterios.map((item, filaIndex) => {
            if (filaIndex !== index) return item;
            const actualizado = { ...item, [clave]: valor };
            if (clave === "puntajeMaximo") {
              const puntaje = Number(valor) || 0;
              actualizado.puntajesNiveles = puntajesPorNivel(puntaje);
            }
            return actualizado;
          }),
        },
      };
    });
  };

  const agregarFila = () => {
    setDraft((prev) => {
      if (TIPOS_BINARIOS.includes(prev.tipo)) {
        const indicadores = prev.estructura?.indicadores || [];
        return { ...prev, estructura: { ...prev.estructura, indicadores: [...indicadores, crearIndicador(indicadores.length)] } };
      }

      if (TIPOS_ESCALA.includes(prev.tipo)) {
        const indicadores = prev.estructura?.indicadores || [];
        return { ...prev, estructura: { ...prev.estructura, indicadores: [...indicadores, crearEscala(indicadores.length)] } };
      }

      const criterios = prev.estructura?.criterios || [];
      return { ...prev, estructura: { ...prev.estructura, criterios: [...criterios, crearCriterio(criterios.length)] } };
    });
  };

  const eliminarFila = (index) => {
    setDraft((prev) => {
      if (TIPOS_BINARIOS.includes(prev.tipo)) {
        return {
          ...prev,
          estructura: {
            ...prev.estructura,
            indicadores: prev.estructura.indicadores.filter((_, filaIndex) => filaIndex !== index),
          },
        };
      }

      if (TIPOS_ESCALA.includes(prev.tipo)) {
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

  const contextoTrabajo = curriculoActivo
    ? {
        curso: curriculoActivo.curso || "Curso sin definir",
        area: curriculoActivo.area || curriculoActivo.asignatura || "Área sin definir",
        periodo: curriculoActivo.periodo || "Período sin definir",
        competencia: curriculoActivo.competencia || "Competencia pendiente",
        actividad: curriculoActivo.actividad || "Actividad pendiente",
      }
    : null;

  return (
    <div className="instrumentos-page">
      <section className="instrumentos-hero panel-soft">
        <div>
          <p className="instrumentos-kicker">DocenteOS · Instrumentos</p>
          <h1>{contextoTrabajo ? contextoTrabajo.curso : "Selecciona una planificación"}</h1>
          {contextoTrabajo ? (
            <>
              <div className="instrumentos-contexto-activo">
                <span>{contextoTrabajo.area}</span>
                <span>{contextoTrabajo.periodo}</span>
                <span>{contextoTrabajo.actividad}</span>
              </div>
              <p>
                Instrumentos de evaluación conectados a la planificación activa. Competencia: {contextoTrabajo.competencia}
              </p>
            </>
          ) : (
            <p>
              Cargando el curso y la planificación de trabajo para conectar instrumentos, registro y evidencias.
            </p>
          )}
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
              <button className="mini-btn" onClick={() => onIrA("mi-registro")}>Ir a Mi Registro</button>
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
                <p>Un clic genera el instrumento usando la competencia e indicadores de la planificación activa.</p>
              </div>
            </div>

            {/* Creación rápida por tipo */}
            <div className="ai-tipos-rapidos">
              {TIPOS_IA_PRIORITARIOS.map((tipo) => (
                <button
                  key={tipo}
                  type="button"
                  className={`ai-tipo-btn${aiTipo === tipo ? " ai-tipo-activo" : ""}`}
                  onClick={() => crearConIARapido(tipo)}
                  disabled={aiGenerando}
                  title={`Crear ${tipo} con IA`}
                >
                  {aiGenerando && aiTipo === tipo ? "⏳" : "✨"} {tipo}
                </button>
              ))}
            </div>

            <div className="ai-sep-o">— o describe manualmente —</div>

            <div className="ai-tipo-selector">
              <select value={aiTipo} onChange={(e) => setAiTipo(e.target.value)} disabled={aiGenerando}>
                {TIPOS_INSTRUMENTO.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder='Ej.: Debate sobre contaminación ambiental' disabled={aiGenerando} />
            <div className="ai-actions">
              <button className="primary-btn" onClick={crearConIA} disabled={aiGenerando}>
                {aiGenerando ? "Generando…" : `Generar ${aiTipo}`}
              </button>
              <button className="ghost-btn" onClick={() => { setAiDraft(null); setAiError(null); }} disabled={aiGenerando}>Limpiar</button>
            </div>
            {aiError && (
              <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, background: "var(--color-error-bg, #fff0f0)", color: "var(--color-error, #c0392b)", fontSize: 13 }}>
                {aiError}
              </div>
            )}
            {aiDraft && (
              <div className="ai-preview">
                <span className="tipo-pill">{aiDraft.tipo} generada</span>
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
              <div className="template-actions">
                <button onClick={() => abrirNuevoConTipo(tipo)}>Usar plantilla</button>
                {tipo === "Rúbrica" && (
                  <button className="template-secondary-btn" onClick={abrirModeloRubricaMINERD}>
                    Modelo MINERD
                  </button>
                )}
              </div>
            </div>
            <p>
              {tipo === "Rúbrica" && "Tabla editable de criterios y niveles para evaluar desempeño."}
              {tipo === "Lista de cotejo" && "Indicadores observables con porcentaje automático de logro."}
              {tipo === "Escala de estimación" && "Valoración por niveles con opciones dinámicas."}
              {tipo === "Registro anecdótico" && "Notas descriptivas para seguimiento cualitativo."}
              {tipo === "Guía de observación" && "Matriz de observación directa vinculada al currículo."}
              {tipo === "Prueba escrita" && "Instrumento formal con calificación y retroalimentación."}
              {tipo === "Autoevaluación" && "El estudiante reflexiona y evalúa su propio proceso de aprendizaje."}
              {tipo === "Coevaluación" && "Evaluación entre pares con criterios observables compartidos."}
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
                <h2>Preparado para Mi Registro</h2>
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
                  Competencia del Registro que evalúa
                  <select
                    value={draft.competenciaIndex ?? 0}
                    onChange={(e) => setDraft((prev) => ({ ...prev, competenciaIndex: Number(e.target.value) }))}
                  >
                    {competenciasCurso.length > 0
                      ? competenciasCurso.map((c, i) => (
                          <option key={i} value={i}>{`C${i + 1} — ${c.descripcion || c.id || `Competencia ${i + 1}`}`}</option>
                        ))
                      : [0, 1, 2, 3].map((i) => (
                          <option key={i} value={i}>{`Competencia ${i + 1}`}</option>
                        ))
                    }
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

                {TIPOS_CRITERIOS.includes(draft.tipo) && draft.estructura?.modelo === "rubrica_minerd_ponderada" && (
                  <div className="rubrica-total-selector">
                    <div>
                      <strong>Ponderación total</strong>
                      <small>Escala el modelo base 15/17/18 sin cambiar su lógica.</small>
                    </div>
                    <div className="rubrica-total-options">
                      {TOTALES_RUBRICA_MINERD.map((total) => (
                        <button
                          key={total}
                          type="button"
                          className={Number(draft.valorMaximo) === total ? "active" : ""}
                          onClick={() => cambiarTotalRubricaMINERD(total)}
                        >
                          {total} pts
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {TIPOS_CRITERIOS.includes(draft.tipo) && (
                  <table className="builder-table">
                    <thead>
                      <tr>
                        <th>Criterio</th>
                        <th>Puntos</th>
                        <th>{etiquetaNivel(draft.estructura, "nivel4", "Nivel 4")}</th>
                        <th>{etiquetaNivel(draft.estructura, "nivel3", "Nivel 3")}</th>
                        <th>{etiquetaNivel(draft.estructura, "nivel2", "Nivel 2")}</th>
                        <th>{etiquetaNivel(draft.estructura, "nivel1", "Nivel 1")}</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filasConstructor.map((fila, index) => (
                        <tr key={fila.id}>
                          <td><input value={fila.criterio} onChange={(e) => modificarFila(index, "criterio", e.target.value)} /></td>
                          <td><input type="number" min="0" value={fila.puntajeMaximo || ""} onChange={(e) => modificarFila(index, "puntajeMaximo", e.target.value)} /></td>
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

                {TIPOS_BINARIOS.includes(draft.tipo) && (
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

                {TIPOS_ESCALA.includes(draft.tipo) && (
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
                {estudiantesAplicacion.length === 0 ? (
                  <p className="sin-estudiantes-instrumento">
                    Este curso no tiene estudiantes cargados. Agrega la matrícula del curso antes de aplicar el instrumento.
                  </p>
                ) : (
                  estudiantesAplicacion.map((estudiante) => (
                    <button key={estudiante.id} className={estudianteAplicar === estudiante.id ? "estudiante-item active" : "estudiante-item"} onClick={() => setEstudianteAplicar(estudiante.id)}>
                      {estudiante.nombre}
                    </button>
                  ))
                )}
              </aside>

              <section className="evaluacion-panel">
                <div className="evaluacion-resumen">
                  <span>{instrumentoAplicar.tipo}</span>
                  <strong>{instrumentoAplicar.periodo}</strong>
                  <p>{instrumentoAplicar.competencia}</p>
                </div>

                <h3>{estudiantesAplicacion.find((estudiante) => estudiante.id === estudianteAplicar)?.nombre || "Estudiante"}</h3>

                {TIPOS_BINARIOS.includes(leerTipo(instrumentoAplicar)) && (
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

                {TIPOS_ESCALA.includes(leerTipo(instrumentoAplicar)) && (
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

                {TIPOS_CRITERIOS.includes(leerTipo(instrumentoAplicar)) && (
                  <div className="aplicar-rubrica">
                    {(instrumentoAplicar.estructura?.criterios || []).map((criterio) => (
                      <article key={criterio.id} className="rubrica-row">
                        <div>
                          <strong>{criterio.criterio}</strong>
                          {Number(criterio.puntajeMaximo) > 0 && (
                            <small>{criterio.puntajeMaximo} pts</small>
                          )}
                        </div>
                        <div className="niveles">
                          {[4, 3, 2, 1].map((nivel) => (
                            <button key={nivel} className={Number(evaluacionAplicar[criterio.id]) === nivel ? "nivel active" : "nivel"} onClick={() => setEvaluacionAplicar((prev) => ({ ...prev, [criterio.id]: nivel }))}>
                              {etiquetaNivel(instrumentoAplicar.estructura, `nivel${nivel}`, `Nivel ${nivel}`)}
                              {criterio.puntajesNiveles?.[`nivel${nivel}`] ? ` · ${criterio.puntajesNiveles[`nivel${nivel}`]} pts` : ""}
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
                  <button className="primary-btn" onClick={guardarAplicacion} disabled={guardandoAplicacion || estudiantesAplicacion.length === 0}>
                    {guardandoAplicacion ? "Guardando..." : "Guardar resultado"}
                  </button>
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
                <h3>{TIPOS_BINARIOS.includes(aiDraft.tipo) || TIPOS_ESCALA.includes(aiDraft.tipo) ? "Indicadores" : "Criterios"}</h3>
                {(aiDraft.estructura?.criterios || []).map((criterio) => <div key={criterio.id}>{criterio.criterio}</div>)}
                {(aiDraft.estructura?.indicadores || []).map((indicador) => <div key={indicador.id}>{indicador.indicador}</div>)}
              </article>
              <article>
                <h3>Estructura completa</h3>
                {(aiDraft.estructura?.criterios || []).map((criterio) => (
                  <div key={criterio.id} className="ai-rubric-row">
                    <strong>{criterio.criterio}</strong>
                    <span>{criterio.nivel4}</span>
                    <span>{criterio.nivel3}</span>
                    <span>{criterio.nivel2}</span>
                    <span>{criterio.nivel1}</span>
                  </div>
                ))}
                {(aiDraft.estructura?.indicadores || []).map((indicador) => (
                  <div key={indicador.id} className="ai-rubric-row">
                    <strong>{indicador.indicador}</strong>
                    {TIPOS_ESCALA.includes(aiDraft.tipo) ? (
                      <>
                        <span>{indicador.excelente}</span>
                        <span>{indicador.bueno}</span>
                        <span>{indicador.regular}</span>
                        <span>{indicador.necesitaApoyo}</span>
                      </>
                    ) : (
                      <>
                        <span>Sí</span>
                        <span>No</span>
                      </>
                    )}
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

      {confirmEliminar && (
        <ModalConfirmacion
          mensaje={confirmEliminar.mensaje}
          onConfirmar={() => { ejecutarEliminarInstrumento(confirmEliminar.id); setConfirmEliminar(null); }}
          onCancelar={() => setConfirmEliminar(null)}
        />
      )}
    </div>
  );
}

export default InstrumentosPage;
