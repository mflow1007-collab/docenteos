import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { obtenerCompetencias } from "../services/curriculumService.js";
import { normalizarAreaCurricular } from "../services/bancoCurricularLocal.js";
import {
  guardarEvidenciaEstudiante,
  guardarRegistroAspecto,
  guardarRegistroCalificaciones,
  guardarRegistroNota,
  obtenerEvidenciasCurso,
  obtenerRegistroAspectos,
  obtenerRegistroCalificaciones,
  obtenerRegistroNotas,
} from "../firebase";
import { escribirExpedienteDesdeRegistro } from "../services/expedienteEstudianteService.js";
import { useAuth } from "../context/AuthContext.jsx";
import { AIService } from "../services/ai/AIService.js";
import { buildAIContext } from "../services/ai/ContextBuilder.js";
import { EventTracker } from "../services/ai/learning/EventTracker.js";
import { LEARNING_EVENTS, AGENT_IDS } from "../services/ai/knowledge/KnowledgeTypes.js";
import "../RegistroPage.css";

const DIAS = ["L", "M", "I", "J", "V"];
const ESTADOS_ASISTENCIA = ["", "P", "A", "T", "E"];
const SEMANAS_ASISTENCIA = 6;

const MESES_ESCOLAR = [
  "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
];

const MESES_NUMERO = {
  Enero: 0,
  Febrero: 1,
  Marzo: 2,
  Abril: 3,
  Mayo: 4,
  Junio: 5,
  Agosto: 7,
  Septiembre: 8,
  Octubre: 9,
  Noviembre: 10,
  Diciembre: 11,
};

const REGISTRO_DRAFT_PREFIX = "docenteos_registro_borrador_v1";

// 6 semanas × 5 días laborables para cubrir todos los meses del calendario.
const crearMesVacio = () => Array.from({ length: SEMANAS_ASISTENCIA }, () => Array(5).fill(""));

const normalizarSemanasAsistencia = (semanas = []) =>
  Array.from({ length: SEMANAS_ASISTENCIA }, (_, semanaIdx) =>
    Array.from({ length: 5 }, (_, diaIdx) => semanas?.[semanaIdx]?.[diaIdx] ?? "")
  );

function obtenerAniosEscolares(anioEscolar) {
  const anios = String(anioEscolar || "").match(/\d{4}/g)?.map(Number) || [];
  const actual = new Date().getFullYear();
  if (anios.length >= 2) return [anios[0], anios[1]];
  if (anios.length === 1) return [anios[0], anios[0] + 1];
  return [actual, actual + 1];
}

function crearAnioEscolarPorDefecto() {
  const inicio = new Date().getFullYear();
  return `${inicio}-${inicio + 1}`;
}

function obtenerAnioParaMes(mes, anioEscolar) {
  const [inicio, fin] = obtenerAniosEscolares(anioEscolar);
  return ["Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"].includes(mes) ? inicio : fin;
}

function crearCalendarioMes(mes, anioEscolar) {
  const mesNumero = MESES_NUMERO[mes];
  if (mesNumero === undefined) return crearMesVacio().map((semana) => semana.map(() => null));

  const anio = obtenerAnioParaMes(mes, anioEscolar);
  const primerDia = new Date(anio, mesNumero, 1);
  const ultimoDia = new Date(anio, mesNumero + 1, 0).getDate();
  const desplazamientoLunes = (primerDia.getDay() + 6) % 7;

  return Array.from({ length: SEMANAS_ASISTENCIA }, (_, semanaIdx) =>
    DIAS.map((_, diaIdx) => {
      const diaMes = 1 - desplazamientoLunes + semanaIdx * 7 + diaIdx;
      return diaMes >= 1 && diaMes <= ultimoDia ? diaMes : null;
    })
  );
}

const crearAsistenciaParaEstudiantes = (estudiantes) =>
  estudiantes.map((est) => ({
    id: est.id,
    nombre: est.nombre,
    meses: Object.fromEntries(MESES_ESCOLAR.map((m) => [m, crearMesVacio()])),
  }));

const calcAsistenciaMes = (semanas, calendario = null) => {
  const flat = normalizarSemanasAsistencia(semanas).flatMap((semana, semanaIdx) =>
    semana.filter((_, diaIdx) => calendario?.[semanaIdx]?.[diaIdx] !== null)
  );
  const total    = flat.filter((x) => x !== "").length;
  const excusas  = flat.filter((x) => x === "E").length;
  // 2 excusas = 1 P
  const presentes = flat.filter((x) => x === "P").length + Math.floor(excusas / 2);
  const pct = total > 0 ? Math.round((presentes / total) * 100) : null;
  return { presentes, excusas, total, pct };
};

const estudiantesFallback = [
  { id: 1, nombre: "Juan Pérez" },
  { id: 2, nombre: "María Rodríguez" },
  { id: 3, nombre: "Pedro Gómez" },
  { id: 4, nombre: "Katherin Romero" },
  { id: 5, nombre: "Carlos Méndez" },
  { id: 6, nombre: "Fernanda Lozano" },
];

const competenciasFallback = [
  {
    nombre: "Competencia 1",
    periodos: [
      { p: 74, rp: 82 },
      { p: 78, rp: 85 },
      { p: 80, rp: 88 },
      { p: 84, rp: 90 },
    ],
  },
  {
    nombre: "Competencia 2",
    periodos: [
      { p: 68, rp: 76 },
      { p: 72, rp: 80 },
      { p: 76, rp: 83 },
      { p: 79, rp: 86 },
    ],
  },
  {
    nombre: "Competencia 3",
    periodos: [
      { p: 83, rp: 86 },
      { p: 86, rp: 88 },
      { p: 87, rp: 90 },
      { p: 90, rp: 92 },
    ],
  },
  {
    nombre: "Competencia 4",
    periodos: [
      { p: 58, rp: 66 },
      { p: 64, rp: 71 },
      { p: 69, rp: 77 },
      { p: 73, rp: 81 },
    ],
  },
];

function promedio(nums) {
  const valores = nums.filter((n) => typeof n === "number" && !Number.isNaN(n));
  if (!valores.length) return 0;
  return Math.round(valores.reduce((a, b) => a + b, 0) / valores.length);
}

function clasificarEstado(valor) {
  if (valor >= 70) return "Aprobado";
  if (valor >= 60) return "En recuperación";
  return "Reprobado";
}

function badgeClase(valor) {
  if (valor === "P") return "presente";
  if (valor === "A") return "ausente";
  if (valor === "T") return "tardanza";
  if (valor === "E") return "excusa";
  return "vacio";
}

// Códigos CE oficiales MINERD por asignatura — Nivel Secundario
const COMP_CODIGOS = {
  // Lenguas y comunicación
  "Lengua Española":         ["CLE-1","CLE-2","CLE-3","CLE-4","CLE-5"],
  "Inglés":                  ["CE-LEI1","CE-LEI2","CE-LEI3","CE-LEI4","CE-LEI5","CE-LEI6","CE-LEI7"],
  "Lenguas Extranjeras":     ["CE-LEI1","CE-LEI2","CE-LEI3","CE-LEI4","CE-LEI5","CE-LEI6","CE-LEI7"],
  "Francés":                 ["CE-LEF1","CE-LEF2","CE-LEF3","CE-LEF4","CE-LEF5"],
  // Matemáticas y ciencias exactas
  "Matemática":              ["CM-1","CM-2","CM-3","CM-4","CM-5"],
  "Matemáticas":             ["CM-1","CM-2","CM-3","CM-4","CM-5"],
  // Ciencias
  "Ciencias Naturales":      ["CCN-1","CCN-2","CCN-3","CCN-4","CCN-5"],
  "Ciencias de la Naturaleza":["CCN-1","CCN-2","CCN-3","CCN-4","CCN-5"],
  "Biología":                ["CBio-1","CBio-2","CBio-3","CBio-4"],
  "Química":                 ["CQui-1","CQui-2","CQui-3","CQui-4"],
  "Física":                  ["CFis-1","CFis-2","CFis-3","CFis-4"],
  // Sociales
  "Ciencias Sociales":       ["CCS-1","CCS-2","CCS-3","CCS-4","CCS-5"],
  "Historia":                ["CHis-1","CHis-2","CHis-3","CHis-4"],
  "Geografía":               ["CGeo-1","CGeo-2","CGeo-3","CGeo-4"],
  // Humanidades
  "Formación Humana":        ["CFH-1","CFH-2","CFH-3","CFH-4"],
  "Formación Humana y Religiosa": ["CFH-1","CFH-2","CFH-3","CFH-4"],
  "Filosofía":               ["CFil-1","CFil-2","CFil-3","CFil-4"],
  // Arte y cultura
  "Educación Artística":     ["CEA-1","CEA-2","CEA-3","CEA-4"],
  "Artes":                   ["CEA-1","CEA-2","CEA-3","CEA-4"],
  "Música":                  ["CMus-1","CMus-2","CMus-3","CMus-4"],
  // Tecnología
  "Tecnología":              ["CTAC-1","CTAC-2","CTAC-3","CTAC-4"],
  "Informática":             ["CTAC-1","CTAC-2","CTAC-3","CTAC-4"],
  "TAC":                     ["CTAC-1","CTAC-2","CTAC-3","CTAC-4"],
  // Educación física
  "Educación Física":        ["CEF-1","CEF-2","CEF-3","CEF-4"],
  // Técnico-vocacional
  "Emprendimiento":          ["CEmp-1","CEmp-2","CEmp-3","CEmp-4"],
};

// Descripciones oficiales MINERD de competencias por código
// Fuente: Diseño Curricular Nivel Secundario — educando.edu.do
const COMP_DESCRIPCIONES = {
  // Inglés / Lenguas Extranjeras
  "CE-LEI1": "Comprende y expresa ideas, sentimientos y valores culturales en distintas situaciones de comunicación orales y escritas relativas a necesidades concretas y temas cotidianos, utilizando el idioma inglés de forma breve y sencilla para compartir información propia y de otras personas, describir sus actividades cotidianas, el entorno inmediato, y sus puntos de vista.",
  "CE-LEI2": "Interactúa en el idioma inglés, empleando estrategias de desempeño, el razonamiento lógico-verbal y la expresión creativa y crítica con el propósito de comunicarse de forma clara y efectiva en distintas situaciones concretas de comunicación oral y escrita.",
  "CE-LEI3": "Se comunica en inglés oral y escrito de forma básica, pero comprensible, compartiendo información que permite identificar, describir y abordar problemas y situaciones comunes de su entorno inmediato.",
  "CE-LEI4": "Se comunica en intercambios breves y sencillos, participando en un plano de respeto y colaboración, e identificando algunas de las diferencias individuales y la identidad social y cultural propia y de otros países.",
  "CE-LEI5": "Interactúa en el idioma inglés compartiendo información, ideas y opiniones sobre aspectos científicos y tecnológicos de su entorno inmediato en distintas situaciones cotidianas de comunicación.",
  "CE-LEI6": "Muestra preferencias por actividades cotidianas y opciones que impactan de forma positiva la salud y el medioambiente en distintas situaciones de comunicación.",
  "CE-LEI7": "Se comunica en el idioma inglés, con cortesía, asertividad, actitud de respeto, honestidad y aceptación al expresarse sobre sí mismo y las demás personas en cuanto a preferencias, experiencias, características personales y actividades cotidianas.",
  // Lengua Española
  "CLE-1": "Comprende y produce textos orales y escritos de diferente tipo, propósito y registro, adaptando su comunicación a distintas situaciones sociales.",
  "CLE-2": "Usa el lenguaje para reflexionar, construir conocimiento y participar activamente en prácticas comunicativas de la vida cotidiana, académica y ciudadana.",
  "CLE-3": "Valora y disfruta la literatura como manifestación cultural, estética y expresión de la identidad.",
  "CLE-4": "Emplea las tecnologías de la información y la comunicación de forma crítica para leer, producir y difundir textos en distintos contextos.",
  "CLE-5": "Reflexiona sobre el funcionamiento de la lengua y usa sus conocimientos lingüísticos para comprender y producir textos con mayor eficacia.",
  // Matemática
  "CM-1": "Resuelve problemas mediante el uso de conceptos, procedimientos y estrategias matemáticas en contextos de la vida cotidiana y del entorno natural y social.",
  "CM-2": "Razona matemáticamente para formular conjeturas, elaborar argumentos y verificar resultados usando el pensamiento lógico y el rigor deductivo.",
  "CM-3": "Modela situaciones del mundo real utilizando representaciones matemáticas (algebraicas, gráficas, numéricas y verbales) para interpretar y predecir fenómenos.",
  "CM-4": "Comunica ideas y procesos matemáticos de manera precisa, usando el lenguaje matemático formal e informal en distintos contextos.",
  "CM-5": "Usa herramientas tecnológicas para explorar, visualizar y resolver problemas matemáticos con sentido crítico y actitud investigativa.",
  // Ciencias Naturales
  "CCN-1": "Comprende los procesos y fenómenos naturales a través de la observación, la experimentación y el análisis, aplicando los principios del método científico.",
  "CCN-2": "Relaciona los procesos biológicos, físicos y químicos con situaciones de la vida cotidiana para entender el funcionamiento de los sistemas naturales.",
  "CCN-3": "Valora la importancia del equilibrio medioambiental y propone soluciones para la conservación del entorno natural desde una perspectiva sostenible.",
  "CCN-4": "Usa la tecnología y los avances científicos de forma crítica y responsable para mejorar la calidad de vida y resolver problemas del entorno.",
  "CCN-5": "Participa activamente en proyectos de investigación científica sencillos, comunicando resultados con precisión y rigor.",
  // Ciencias Sociales
  "CCS-1": "Analiza los procesos históricos, geográficos, económicos y culturales de la sociedad dominicana y del mundo desde una perspectiva crítica y reflexiva.",
  "CCS-2": "Comprende la dinámica de las relaciones entre el ser humano, el territorio y el ambiente en distintas escalas espaciales y temporales.",
  "CCS-3": "Participa responsablemente como ciudadano en la vida democrática, respetando los derechos humanos y los valores cívicos.",
  "CCS-4": "Valora la diversidad cultural, étnica y social como riqueza humana para la convivencia y el desarrollo sostenible.",
  "CCS-5": "Usa fuentes históricas, cartográficas y estadísticas para construir conocimiento social de manera crítica y argumentada.",
  // Formación Humana
  "CFH-1": "Desarrolla su identidad personal desde valores éticos, espirituales y ciudadanos que le permiten vivir en armonía consigo mismo y con los demás.",
  "CFH-2": "Practica estilos de vida saludables, tomando decisiones responsables en su vida personal, familiar y social.",
  "CFH-3": "Valora la dimensión espiritual de la persona humana como fuente de sentido, esperanza y compromiso con el bien común.",
  "CFH-4": "Participa activamente en la construcción de una sociedad más justa, solidaria y democrática, desde los valores del Evangelio y la doctrina social.",
  // Educación Física
  "CEF-1": "Practica actividades físicas y deportivas con regularidad, desarrollando capacidades motrices, hábitos saludables y trabajo en equipo.",
  "CEF-2": "Comprende la relación entre actividad física, salud y bienestar, adoptando estilos de vida activos y saludables.",
  "CEF-3": "Respeta las normas, reglas y valores del juego limpio, expresando actitudes de cooperación, respeto y fair play.",
  "CEF-4": "Crea y disfruta de expresiones corporales, rítmicas y creativas como formas de comunicación y bienestar personal.",
};

function crearNotasVacias(cantidadCompetencias = 4) {
  return {
    competencias: Array.from({ length: Math.max(1, cantidadCompetencias) }, () => ({
      periodos: Array.from({ length: 4 }, () => ({ p: "", rp: "" })),
    })),
    ceCompletiva: "",
    ceExtraordinaria: "",
  };
}

function normalizarNotasCompetencias(notas, cantidadCompetencias = 4) {
  const base = notas || crearNotasVacias(cantidadCompetencias);
  return {
    ...base,
    competencias: Array.from({ length: Math.max(1, cantidadCompetencias) }, (_, ci) => {
      const comp = base.competencias?.[ci] || {};
      return {
        ...comp,
        periodos: Array.from({ length: 4 }, (_, pi) => comp.periodos?.[pi] || { p: "", rp: "" }),
      };
    }),
  };
}

function calcularResumenEstudiante(notas) {
  const compAvgs = notas.competencias.map((comp) => {
    const finals = comp.periodos.map((per) => {
      const p = Number(per.p) || 0;
      const rp = Number(per.rp) || 0;
      return p >= 70 ? p : rp > 0 ? rp : p;
    });
    const validos = finals.filter((v) => v > 0);
    if (!validos.length) return 0;
    return Math.round((validos.reduce((a, b) => a + b, 0) / validos.length) * 10) / 10;
  });

  const cfValidos = compAvgs.filter((v) => v > 0);
  const cfExacto = cfValidos.length
    ? Math.round((cfValidos.reduce((a, b) => a + b, 0) / cfValidos.length) * 100) / 100
    : 0;
  const cf = Math.round(cfExacto);

  const ceComp  = Number(notas.ceCompletiva)     || 0;
  const p50cf   = cf > 0     ? Math.round(cf * 0.5)     : 0;
  const p50cec  = ceComp > 0 ? Math.round(ceComp * 0.5) : 0;
  const ccf     = p50cf + p50cec;

  const ceExtra  = Number(notas.ceExtraordinaria) || 0;
  const p30cf    = cf > 0      ? Math.round(cf * 0.3)       : 0;
  const p70ceex  = ceExtra > 0 ? Math.round(ceExtra * 0.7)  : 0;
  const cexf     = p30cf + p70ceex;

  const necesitaComp  = cf > 0 && cf < 70;
  const necesitaExtra = necesitaComp && ccf > 0 && ccf < 70;

  let situacion = cf > 0 ? "Reprobado" : "—";
  let aprobado = false, reprobado = false;
  if      (cf >= 70)   { situacion = "Aprobado";       aprobado = true; }
  else if (ccf >= 70)  { situacion = "Completiva";     aprobado = true; }
  else if (cexf >= 70) { situacion = "Extraordinaria"; aprobado = true; }
  else if (cf > 0)     { reprobado = true; }

  return { compAvgs, cfExacto, cf, ccf, cexf, necesitaComp, necesitaExtra, situacion, aprobado, reprobado };
}

function slugEstudiante(nombre, indice) {
  return `est-${String(nombre || "sin-nombre")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "sin-nombre"}-${indice}`;
}

function normalizarEstudiantesRegistro(estudiantes = []) {
  return estudiantes.map((est, indice) => ({
    ...est,
    id: est.id ?? slugEstudiante(est.nombre, indice),
  }));
}

function calcularAsistenciaAcumulada(registro) {
  if (!registro?.meses) return null;
  const marcas = MESES_ESCOLAR.flatMap((m) => (registro.meses?.[m] ?? crearMesVacio()).flat());
  const total = marcas.filter((x) => x !== "").length;
  if (!total) return null;
  const excusas = marcas.filter((x) => x === "E").length;
  const presentes = marcas.filter((x) => x === "P").length + Math.floor(excusas / 2);
  return Math.round((presentes / total) * 100);
}

function getDraftKey(cursoId) {
  return `${REGISTRO_DRAFT_PREFIX}:${cursoId}`;
}

function RegistroPage({
  onVolver,
  curso,
  estudiantesCurso = [],
  estudiante = null,
  cursoAutomatico = false,
  onAbrirPerfil = null,
  onActualizarCurso = null,
}) {
  const { formulario } = useAuth();
  const cursoNombre = curso?.nombre || "Curso sin seleccionar";
  const centro = curso?.centro || formulario.centro || "Pendiente de completar";
  const grado = curso?.grado || "";
  const seccion = curso?.seccion || "";
  const area = curso?.area || "";
  const areaCurricular = normalizarAreaCurricular(curso?.asignatura || curso?.area || "");
  const docente = curso?.docente || formulario.nombreDocente || "Pendiente de completar";
  const mes = curso?.mes || new Date().toLocaleDateString("es-DO", { month: "long" });
  const periodo = curso?.periodo || "";
  const anioEscolar = curso?.anioEscolar || formulario.periodo || crearAnioEscolarPorDefecto();

  const estudiantes = useMemo(() => {
    const base = estudiantesCurso.length > 0
      ? estudiantesCurso
      : curso?.estudiantesDetalle?.length
        ? curso.estudiantesDetalle
        : curso?.estudiantes?.length
          ? curso.estudiantes
          : estudiantesFallback;
    return normalizarEstudiantesRegistro(base);
  }, [curso, estudiantesCurso]);

  const [tabActiva, setTabActiva] = useState("Resumen");
  const [periodoActivo] = useState("Periodo 1");
  const [mesActivo, setMesActivo] = useState("Agosto");
  const [asistencia, setAsistencia] = useState(
    crearAsistenciaParaEstudiantes(estudiantes)
  );
  const [competencias, setCompetencias] = useState(competenciasFallback);

  useEffect(() => {
    const nivel = curso?.nivel;
    const grado = curso?.grado || curso?.nombre?.split(" ").slice(0, 2).join(" ");
    const areaRaw = curso?.area || curso?.asignatura;
    if (!areaRaw) return;

    // Primero aplicar fallback estático desde COMP_CODIGOS + COMP_DESCRIPCIONES
    // para que el docente vea los códigos oficiales MINERD inmediatamente.
    const areaCanonica = normalizarAreaCurricular(areaRaw);
    const codigosFallback = COMP_CODIGOS[areaCanonica] || COMP_CODIGOS[areaRaw] || COMP_CODIGOS[areaRaw?.trim()] || [];
    if (codigosFallback.length) {
      setCompetencias(codigosFallback.map((cod) => ({
        id: cod,
        nombre: COMP_DESCRIPCIONES[cod] || cod,
        indicadoresLogro: [],
        contenidos: {},
      })));
    }

    // Luego actualizar desde Firestore si hay datos del currículo importado
    if (!nivel || !grado) return;
    obtenerCompetencias(nivel, grado, areaCanonica).then((comps) => {
      if (comps?.length) {
        setCompetencias(comps.map((c) => ({
          id: c.id,
          nombre: c.descripcion || COMP_DESCRIPCIONES[c.id] || c.id,
          indicadoresLogro: c.indicadoresLogro || [],
          contenidos: c.contenidos || {},
        })));
      }
    });
  }, [curso?.id, curso?.nivel, curso?.grado, curso?.area, curso?.asignatura, curso?.nombre]);
  const [observaciones, setObservaciones] = useState({});
  const [notasEstudiantes, setNotasEstudiantes] = useState({});
  const [evaluacionesInstrumentos, setEvaluacionesInstrumentos] = useState({});
  const [registroAspectos, setRegistroAspectos] = useState([]);
  const [registroNotas, setRegistroNotas] = useState({});
  const [evidenciasCurso, setEvidenciasCurso] = useState([]);
  const [estadoNotasAspectos, setEstadoNotasAspectos] = useState("idle");
  const notasPendientesRef = useRef({});
  const estudiantesModificadosRef = useRef(new Set());
  const [guardando, setGuardando] = useState(false);
  const [mensajeGuardado, setMensajeGuardado] = useState(null);

  // IA — Asistente pedagógico
  const [iaTexto, setIaTexto] = useState("");
  const [iaGenerando, setIaGenerando] = useState(false);
  const [iaError, setIaError] = useState(null);
  const iaRef = useRef(null);
  const registroCargadoRef = useRef(false);

  const cursoId = curso?.id || "registro-general";
  const draftKey = getDraftKey(cursoId);

  const aplicarRegistroGuardado = (data) => {
    if (!data) return;
    if (data.notasEstudiantes) setNotasEstudiantes(data.notasEstudiantes);
    if (data.asistencia) {
      setAsistencia(
        data.asistencia.map((est) => ({
          ...est,
          meses: Object.fromEntries(
            MESES_ESCOLAR.map((mes) => [mes, normalizarSemanasAsistencia(est.meses?.[mes])])
          ),
        }))
      );
    }
    if (data.observaciones)    setObservaciones(data.observaciones);
    if (data.evaluacionesInstrumentos) setEvaluacionesInstrumentos(data.evaluacionesInstrumentos);
  };

  const crearPayloadRegistro = useCallback(() => ({
    cursoId,
    area,
    grado,
    seccion,
    anioEscolar,
    nivel: "secundaria",
    notasEstudiantes,
    asistencia,
    observaciones,
    evaluacionesInstrumentos,
    updatedAt: new Date().toISOString(),
  }), [cursoId, area, grado, seccion, anioEscolar, notasEstudiantes, asistencia, observaciones, evaluacionesInstrumentos]);

  const guardarBorradorLocal = useCallback(() => {
    if (!cursoId) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify(crearPayloadRegistro()));
    } catch {
      // Si localStorage falla, el botón Guardar sigue intentando persistir.
    }
  }, [cursoId, draftKey, crearPayloadRegistro]);

  useEffect(() => {
    setAsistencia((prev) => {
      const prevPorId = new Map(prev.map((item) => [item.id, item]));
      return estudiantes.map((est) => ({
        ...(prevPorId.get(est.id) || {
          id: est.id,
          meses: Object.fromEntries(MESES_ESCOLAR.map((m) => [m, crearMesVacio()])),
        }),
        id: est.id,
        nombre: est.nombre,
        meses: Object.fromEntries(
          MESES_ESCOLAR.map((mes) => [
            mes,
            normalizarSemanasAsistencia(prevPorId.get(est.id)?.meses?.[mes]),
          ])
        ),
      }));
    });
  }, [estudiantes]);

  // Cargar registro guardado al abrir
  useEffect(() => {
    if (!cursoId) return;
    registroCargadoRef.current = false;

    try {
      const borrador = localStorage.getItem(draftKey);
      if (borrador) aplicarRegistroGuardado(JSON.parse(borrador));
    } catch {
      // El borrador local no debe bloquear el registro.
    }

    obtenerRegistroCalificaciones(cursoId)
      .then(({ data }) => {
        if (data) aplicarRegistroGuardado(data);
      })
      .catch(() => {})
      .finally(() => {
        registroCargadoRef.current = true;
      });
  }, [cursoId, draftKey]);

  useEffect(() => {
    if (!cursoId) return;
    let activo = true;

    Promise.all([
      obtenerRegistroAspectos(cursoId),
      obtenerRegistroNotas(cursoId),
      obtenerEvidenciasCurso(cursoId),
    ]).then(([aspectosRes, notasRes, evidenciasRes]) => {
      if (!activo) return;
      const aspectos = (aspectosRes.data || []).sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));
      const notas = Object.fromEntries((notasRes.data || []).map((nota) => [nota.notaId || `${nota.estudianteId}_${nota.aspectoId}`, nota]));
      setRegistroAspectos(aspectos);
      setRegistroNotas(notas);
      setEvidenciasCurso(evidenciasRes.data || []);
    }).catch(() => {
      if (activo) {
        setRegistroAspectos([]);
        setRegistroNotas({});
        setEvidenciasCurso([]);
      }
    });

    return () => {
      activo = false;
    };
  }, [cursoId]);

  useEffect(() => {
    const pendientes = Object.values(notasPendientesRef.current);
    if (!pendientes.length) return undefined;

    setEstadoNotasAspectos("saving");
    const timer = setTimeout(async () => {
      const lote = Object.values(notasPendientesRef.current);
      notasPendientesRef.current = {};
      try {
        await Promise.all(lote.map((nota) => guardarRegistroNota(nota)));
        setEstadoNotasAspectos("saved");
      } catch {
        lote.forEach((nota) => {
          notasPendientesRef.current[nota.notaId] = nota;
        });
        setEstadoNotasAspectos("error");
      }
    }, 900);

    return () => clearTimeout(timer);
  }, [registroNotas]);

  useEffect(() => {
    if (!cursoId || !registroCargadoRef.current) return;

    const timer = setTimeout(() => {
      const payload = crearPayloadRegistro();
      guardarBorradorLocal();
      guardarRegistroCalificaciones(payload).catch(() => {
        // El borrador local ya quedó protegido; el guardado remoto se reintentará con el siguiente cambio.
      });
    }, 700);

    return () => clearTimeout(timer);
  }, [cursoId, registroCargadoRef, crearPayloadRegistro, guardarBorradorLocal]);

  useEffect(() => {
    if (!cursoId || !registroCargadoRef.current) return;

    const flush = () => guardarBorradorLocal();
    window.addEventListener("beforeunload", flush);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);

    return () => {
      flush();
      window.removeEventListener("beforeunload", flush);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
    };
  }, [cursoId, registroCargadoRef, guardarBorradorLocal]);

  const codigosComp = useMemo(() => {
    const desdeCompetencias = competencias.map((comp) => comp.id).filter(Boolean);
    return desdeCompetencias.length > 0
      ? desdeCompetencias
      : (COMP_CODIGOS[areaCurricular] || COMP_CODIGOS[area] || ["CE-1","CE-2","CE-3","CE-4"]);
  }, [competencias, areaCurricular, area]);
  const cantidadCompetencias = codigosComp.length;
  const calendarioMesActivo = useMemo(
    () => crearCalendarioMes(mesActivo, anioEscolar),
    [mesActivo, anioEscolar]
  );

  const getNotasEstudiante = (id) => normalizarNotasCompetencias(notasEstudiantes[id], cantidadCompetencias);

  const actualizarNotaEstudiante = (estId, compIdx, periodoIdx, campo, valor) => {
    estudiantesModificadosRef.current.add(estId);
    setNotasEstudiantes((prev) => {
      const actual = normalizarNotasCompetencias(prev[estId], cantidadCompetencias);
      return {
        ...prev,
        [estId]: {
          ...actual,
          competencias: actual.competencias.map((comp, ci) =>
            ci !== compIdx ? comp : {
              ...comp,
              periodos: comp.periodos.map((per, pi) =>
                pi !== periodoIdx ? per : { ...per, [campo]: valor }
              ),
            }
          ),
        },
      };
    });
  };

  const actualizarExtraEstudiante = (estId, campo, valor) => {
    estudiantesModificadosRef.current.add(estId);
    setNotasEstudiantes((prev) => {
      const actual = normalizarNotasCompetencias(prev[estId], cantidadCompetencias);
      return { ...prev, [estId]: { ...actual, [campo]: valor } };
    });
  };

  const resumen = useMemo(() => {
    const asistenciaGeneral = promedio(
      asistencia.map((e) => {
        const todos = MESES_ESCOLAR.flatMap((m) => (e.meses?.[m] ?? crearMesVacio()).flat());
        const total    = todos.filter((x) => x !== "").length;
        const excusas  = todos.filter((x) => x === "E").length;
        const presentes = todos.filter((x) => x === "P").length + Math.floor(excusas / 2);
        return total > 0 ? Math.round((presentes / total) * 100) : null;
      }).filter((v) => v !== null)
    );

    const cfs = estudiantes.map((est) => {
      const notas = getNotasEstudiante(est.id);
      return calcularResumenEstudiante(notas).cf;
    }).filter((cf) => cf > 0);

    const promedioGrupo = cfs.length
      ? Math.round(cfs.reduce((a, b) => a + b, 0) / cfs.length)
      : 0;

    const aprobados      = cfs.filter((cf) => cf >= 70).length;
    const enRiesgo       = cfs.filter((cf) => cf > 0 && cf < 70).length;
    const conNotas       = cfs.length;

    return {
      asistenciaGeneral,
      promedioCompetencias: promedioGrupo,
      estadoGeneral: clasificarEstado(promedioGrupo),
      aprobados,
      enRiesgo,
      conNotas,
    };
  }, [asistencia, notasEstudiantes, estudiantes]);

  const actualizarAsistencia = (estudianteId, mes, semanaIdx, diaIdx, valor) => {
    setAsistencia((prev) =>
      prev.map((est) => {
        if (est.id !== estudianteId) return est;
        const nuevosMeses = { ...est.meses };
        nuevosMeses[mes] = est.meses[mes].map((sem, si) =>
          si !== semanaIdx ? sem : sem.map((d, di) => (di !== diaIdx ? d : valor))
        );
        return { ...est, meses: nuevosMeses };
      })
    );
  };

  const actualizarObservacion = (estudianteId, texto) => {
    setObservaciones((prev) => ({
      ...prev,
      [estudianteId]: texto,
    }));
  };

  const aspectosActivos = useMemo(
    () => registroAspectos.filter((aspecto) => (aspecto.estado || "activo") === "activo"),
    [registroAspectos]
  );

  const totalAspectosActivos = useMemo(
    () => aspectosActivos.reduce((total, aspecto) => total + (Number(aspecto.puntajeMaximo) || 0), 0),
    [aspectosActivos]
  );

  const mensajeDistribucionAspectos = useMemo(() => {
    if (totalAspectosActivos === 100) return { tipo: "ok", texto: "Distribución completa: 100 puntos" };
    if (totalAspectosActivos < 100) return { tipo: "warn", texto: `Faltan ${100 - totalAspectosActivos} puntos para completar 100` };
    return { tipo: "error", texto: "La suma de instrumentos supera los 100 puntos. Ajusta los valores." };
  }, [totalAspectosActivos]);

  const obtenerNotaAspecto = (estudianteId, aspectoId) =>
    registroNotas[`${estudianteId}_${aspectoId}`] || null;

  const calcularTotalInstrumental = (estudianteId) => {
    const notas = aspectosActivos.map((aspecto) => obtenerNotaAspecto(estudianteId, aspecto.aspectoId));
    const notasValidas = notas.filter((nota) => nota && nota.valorObtenido !== "" && nota.valorObtenido !== null && nota.valorObtenido !== undefined);
    const pendientes = aspectosActivos.length - notasValidas.length;
    const totalObtenido = notasValidas.reduce((total, nota) => total + (Number(nota.valorObtenido) || 0), 0);
    const totalMaximo = aspectosActivos.reduce((total, aspecto) => total + (Number(aspecto.puntajeMaximo) || 0), 0);
    const porcentaje = totalMaximo > 0 ? Math.round((totalObtenido / totalMaximo) * 100) : 0;
    return { totalObtenido, totalMaximo, porcentaje, pendientes };
  };

  const actualizarNotaAspecto = (estudiante, aspecto, valor) => {
    const notaId = `${estudiante.id}_${aspecto.aspectoId}`;
    const valorObtenido = valor === "" ? "" : Math.min(Number(aspecto.puntajeMaximo) || 0, Math.max(0, Number(valor) || 0));
    const nota = {
      notaId,
      cursoId,
      estudianteId: estudiante.id,
      aspectoId: aspecto.aspectoId,
      instrumentoId: aspecto.instrumentoId || "",
      valorObtenido,
      puntajeMaximo: Number(aspecto.puntajeMaximo) || 0,
      porcentaje: valorObtenido === "" || !Number(aspecto.puntajeMaximo) ? null : Math.round((Number(valorObtenido) / Number(aspecto.puntajeMaximo)) * 100),
      observacion: registroNotas[notaId]?.observacion || "",
      fechaActualizacion: new Date().toISOString(),
    };
    notasPendientesRef.current[notaId] = nota;
    setRegistroNotas((prev) => ({ ...prev, [notaId]: nota }));
  };

  const actualizarAspecto = (aspectoId, campo, valor) => {
    const siguiente = registroAspectos.map((aspecto) => (
      aspecto.aspectoId !== aspectoId
        ? aspecto
        : {
            ...aspecto,
            [campo]: campo === "puntajeMaximo" || campo === "orden" ? Number(valor) || 0 : valor,
            modificadoManual: true,
            fechaActualizacion: new Date().toISOString(),
          }
    ));
    setRegistroAspectos(siguiente);
    const aspecto = siguiente.find((item) => item.aspectoId === aspectoId);
    if (aspecto) guardarRegistroAspecto(aspecto).catch(() => {});
  };

  const crearAspectoManual = () => {
    const aspectoId = `manual-${Date.now()}`;
    const aspecto = {
      aspectoId,
      cursoId,
      planificacionId: "",
      instrumentoId: "",
      nombre: "Nuevo aspecto manual",
      tipoInstrumento: "manual",
      puntajeMaximo: 10,
      origen: "manual",
      indicadores: [],
      estado: "activo",
      editable: true,
      modificadoManual: true,
      orden: registroAspectos.length + 1,
      fechaCreacion: new Date().toISOString(),
      fechaActualizacion: new Date().toISOString(),
    };
    setRegistroAspectos((prev) => [...prev, aspecto]);
    guardarRegistroAspecto(aspecto).catch(() => {});
  };

  const crearEvidenciaDesdeNota = (estudiante, aspecto) => {
    const nota = obtenerNotaAspecto(estudiante.id, aspecto.aspectoId);
    if (!nota || nota.valorObtenido === "" || nota.valorObtenido === null || nota.valorObtenido === undefined) {
      setMensajeGuardado({ tipo: "error", texto: "Primero registra una calificación para crear la evidencia." });
      setTimeout(() => setMensajeGuardado(null), 3500);
      return;
    }
    const evidencia = {
      evidenciaId: `${cursoId}_${estudiante.id}_${aspecto.aspectoId}`,
      estudianteId: estudiante.id,
      cursoId,
      planificacionId: aspecto.planificacionId || "",
      instrumentoId: aspecto.instrumentoId || "",
      aspectoId: aspecto.aspectoId,
      titulo: aspecto.nombre,
      descripcion: `${estudiante.nombre} obtuvo ${nota.valorObtenido}/${aspecto.puntajeMaximo} en ${aspecto.nombre}.`,
      tipo: "otro",
      fecha: new Date().toISOString(),
      periodo: aspecto.periodo || periodo || "",
      unidad: "",
      tema: aspecto.nombre,
      indicadores: aspecto.indicadores || [],
      competencia: aspecto.competencia || "",
      calificacion: nota.valorObtenido,
      puntajeMaximo: aspecto.puntajeMaximo,
      observacionDocente: nota.observacion || "",
      origen: aspecto.origen === "instrumento" ? "instrumento" : "manual",
    };
    guardarEvidenciaEstudiante(evidencia)
      .then(({ data }) => {
        setEvidenciasCurso((prev) => [data, ...prev.filter((item) => item.evidenciaId !== data.evidenciaId)]);
        setMensajeGuardado({ tipo: "ok", texto: "Evidencia creada en el banco anual del estudiante." });
      })
      .catch(() => setMensajeGuardado({ tipo: "error", texto: "No fue posible crear la evidencia." }))
      .finally(() => setTimeout(() => setMensajeGuardado(null), 3500));
  };

  const renderBold = (text) => {
    const parts = text.split(/\*\*(.+?)\*\*/g);
    return parts.map((part, i) => i % 2 === 1 ? <strong key={i}>{part}</strong> : part);
  };

  const sugerirApoyoIA = async () => {
    setIaTexto("");
    setIaError(null);
    setIaGenerando(true);

    // Construir lista de estudiantes en riesgo (solo ellos — no todos)
    const estudiantesEnRiesgo = estudiantes
      .map((est) => {
        const notas = getNotasEstudiante(est.id);
        const r = calcularResumenEstudiante(notas);
        if (r.cf <= 0) return null;

        const estAsist = asistencia.find((a) => a.id === est.id);
        let pctAsist = null;
        if (estAsist) {
          const todos = MESES_ESCOLAR.flatMap((m) => (estAsist.meses?.[m] ?? crearMesVacio()).flat());
          const total = todos.filter((x) => x !== "").length;
          const excusas = todos.filter((x) => x === "E").length;
          const presentes = todos.filter((x) => x === "P").length + Math.floor(excusas / 2);
          pctAsist = total > 0 ? Math.round((presentes / total) * 100) : null;
        }

        const competenciasDebiles = r.compAvgs
          .map((avg, ci) => avg > 0 && avg < 70 ? codigosComp[ci] || `C${ci + 1}` : null)
          .filter(Boolean);

        return {
          nombre: est.nombre,
          cf: r.cf,
          situacion: r.situacion,
          competenciasDebiles,
          asistencia: pctAsist,
          observacion: observaciones[est.id] || null,
        };
      })
      .filter((e) => e !== null && e.cf < 70);

    const ctx = await buildAIContext("sugerir_apoyo", {
      area,
      grado: `${grado} ${seccion}`.trim(),
      docente,
      estudiantesEnRiesgo,
      promedioGrupo: resumen.promedioCompetencias > 0 ? resumen.promedioCompetencias : null,
      asistenciaGeneral: resumen.asistenciaGeneral > 0 ? resumen.asistenciaGeneral : null,
      codigosCompetencias: codigosComp,
    });

    AIService.generate({
      module: "registro-apoyo",
      prompt: ctx.prompt,
      system: ctx.system,
      maxTokens: ctx.recommendedMaxTokens,
      _contextMeta: ctx.meta,
      onChunk: (chunk) => {
        setIaTexto((prev) => prev + chunk);
        setTimeout(() => iaRef.current?.scrollTo({ top: iaRef.current.scrollHeight, behavior: "smooth" }), 50);
      },
      onFinish: () => {
        setIaGenerando(false);
        EventTracker.track(LEARNING_EVENTS.APOYO_GENERADO, {
          agentId:    AGENT_IDS.GENERADOR_REPORTES,
          area:       area       || null,
          asignatura: area       || null,
          grado:      grado      || null,
          tema:       null,
          metadata:   { estudiantesEnRiesgo: estudiantesEnRiesgo.length },
        });
      },
      onError: (err) => { setIaError(err); setIaGenerando(false); },
    });
  };

  const handleGuardar = async () => {
    setGuardando(true);
    setMensajeGuardado(null);
    try {
      await guardarRegistroCalificaciones({
        cursoId,
        area,
        grado,
        seccion,
        anioEscolar,
        nivel: "secundaria",
        notasEstudiantes,
        asistencia,
        observaciones,
        evaluacionesInstrumentos,
      });
      guardarBorradorLocal();
      // Escritura silenciosa al expediente — solo estudiantes con notas modificadas
      const modificados = [...estudiantesModificadosRef.current];
      estudiantesModificadosRef.current = new Set();
      escribirExpedienteDesdeRegistro({
        estudiantes,
        notasEstudiantes,
        asistencia,
        observaciones,
        cursoId,
        cursoNombre,
        area,
        grado,
        estudiantesModificados: modificados.length > 0 ? modificados : null,
      }).catch(() => {});
      if (curso && typeof onActualizarCurso === "function") {
        const estudiantesDetalle = estudiantes.map((est) => {
          const notas = getNotasEstudiante(est.id);
          const resumenEst = calcularResumenEstudiante(notas);
          const asistenciaEst = calcularAsistenciaAcumulada(asistencia.find((item) => item.id === est.id));
          return {
            ...est,
            promedio: resumenEst.cf > 0 ? resumenEst.cf : est.promedio ?? null,
            asistencia: asistenciaEst ?? est.asistencia ?? null,
            ultimaEvaluacion: new Date().toLocaleDateString("es-DO", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            }),
          };
        });
        const promediosValidos = estudiantesDetalle
          .map((est) => est.promedio)
          .filter((valor) => typeof valor === "number" && !Number.isNaN(valor));
        onActualizarCurso({
          ...curso,
          estudiantesDetalle,
          estudiantes: estudiantesDetalle.length,
          promedio: promediosValidos.length
            ? Math.round(promediosValidos.reduce((a, b) => a + b, 0) / promediosValidos.length)
            : curso.promedio,
        });
      }
      setMensajeGuardado({ tipo: "ok", texto: "✅ Registro guardado correctamente." });
    } catch {
      setMensajeGuardado({ tipo: "error", texto: "❌ Error al guardar. Intenta de nuevo." });
    } finally {
      setGuardando(false);
      setTimeout(() => setMensajeGuardado(null), 4000);
    }
  };

  const evaluacionesConsolidadas = useMemo(() =>
    Object.values(evaluacionesInstrumentos || {}).map((evaluacion) => ({
      ...evaluacion,
      instrumentosLista: Object.values(evaluacion.instrumentos || {}),
      estudiantesLista: Object.values(evaluacion.estudiantes || {}),
    })), [evaluacionesInstrumentos]);

  const exportarExcel = () => {
    const rows = [];
    rows.push([`Registro de Calificaciones — ${area} — ${cursoNombre} — ${anioEscolar}`]);
    rows.push([`Docente: ${docente}`, "", `Centro: ${centro}`]);
    rows.push([]);
    const periodoLabels = codigosComp.flatMap((cod) =>
      ["P1","RP1","P2","RP2","P3","RP3","P4","RP4"].map((p) => `${cod}·${p}`)
    );
    rows.push(["N°", "Estudiante", ...periodoLabels, ...codigosComp.map((_, idx) => `PC${idx + 1}`), "C.F.","Situación"]);
    estudiantes.forEach((est, idx) => {
      const notas = getNotasEstudiante(est.id);
      const { compAvgs, cfExacto, situacion } = calcularResumenEstudiante(notas);
      const celdas = notas.competencias.flatMap((comp) =>
        comp.periodos.flatMap((per) => [per.p ?? "", per.rp ?? ""])
      );
      rows.push([
        idx + 1, est.nombre, ...celdas,
        ...compAvgs.map((a) => (a > 0 ? a.toFixed(1) : "")),
        cfExacto > 0 ? cfExacto.toFixed(2) : "",
        situacion === "—" ? "" : situacion,
      ]);
    });
    const csv = rows
      .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Registro_${area}_${cursoNombre}_${anioEscolar}.csv`.replace(/\s+/g, "_");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportarPDF = () => {
    const compHeaders = codigosComp
      .map((cod, ci) => {
        const desc = competencias[ci]?.nombre || COMP_DESCRIPCIONES[cod] || cod
        const descCorta = desc.length > 80 ? desc.slice(0, 78) + "…" : desc
        return `<th colspan="8" class="comp-h c${ci + 1}-h">
          <div class="comp-cod">${cod}</div>
          <div class="comp-desc">${descCorta}</div>
        </th>`
      })
      .join("");
    const subHeaders = codigosComp
      .flatMap(() => ["P1","RP1","P2","RP2","P3","RP3","P4","RP4"].map((p) =>
        `<th class="tc ${p.startsWith("R") ? "rp" : "p"}">${p}</th>`
      ))
      .join("");
    const bodyHTML = estudiantes.map((est, idx) => {
      const notas = getNotasEstudiante(est.id);
      const { compAvgs, cfExacto, cf, situacion } = calcularResumenEstudiante(notas);
      const celdas = notas.competencias.flatMap((comp, ci) =>
        comp.periodos.flatMap((per) => {
          const pVal = Number(per.p) || 0;
          return [
            `<td class="tc c${ci + 1}">${per.p || ""}</td>`,
            `<td class="tc rp-cell c${ci + 1}">${pVal >= 70 ? "✓" : (per.rp || "")}</td>`,
          ];
        })
      ).join("");
      const avgCells = compAvgs
        .map((a, ci) => `<td class="tc p${ci + 1}avg">${a > 0 ? a.toFixed(1) : "—"}</td>`)
        .join("");
      const cfHTML = cfExacto > 0
        ? `<span class="cf-d">${cfExacto.toFixed(2)}</span><span class="cf-e ${cf >= 70 ? "ok" : "risk"}">${cf}</span>`
        : "—";
      const est2 = situacion === "—" ? "" : situacion;
      const eClass = situacion === "Aprobado" ? "ok" : situacion === "—" ? "" : "risk";
      return `<tr>
        <td class="tc num">${idx + 1}</td>
        <td class="tnombre">${est.nombre}</td>
        ${celdas}${avgCells}
        <td class="tc cf-cell">${cfHTML}</td>
        <td class="tc estado ${eClass}">${est2}</td>
      </tr>`;
    }).join("");

    const css = `
      *{box-sizing:border-box}
      body{font-family:Arial,sans-serif;font-size:8.5px;margin:12px;color:#111}
      h1{font-size:13px;margin:0 0 2px;color:#1d4ed8;font-weight:900}
      h2{font-size:10px;margin:0 0 2px;color:#374151;font-weight:400}
      .meta{display:flex;gap:18px;margin:5px 0 8px;font-size:8.5px;color:#64748b;flex-wrap:wrap}
      .asignatura-badge{display:inline-block;background:#1d4ed8;color:#fff;border-radius:4px;padding:2px 8px;font-size:9px;font-weight:700;margin-bottom:6px}
      table{border-collapse:collapse;width:100%}
      th,td{border:1px solid #9ca3af;padding:2px 3px}
      th{background:#1d4ed8;color:#fff;font-size:7.5px;text-align:center;vertical-align:middle}
      .comp-h{vertical-align:top;padding:4px 3px}
      .comp-cod{font-size:9px;font-weight:900;margin-bottom:2px}
      .comp-desc{font-size:6.5px;font-weight:400;line-height:1.3;text-align:left;opacity:.92}
      .c1-h{background:#1d4ed8}.c2-h{background:#7c3aed}
      .c3-h{background:#059669}.c4-h{background:#d97706}
      .c5-h{background:#b91c1c}.c6-h{background:#0891b2}.c7-h{background:#92400e}
      .tc{text-align:center}
      .tnombre{min-width:110px;font-weight:600;font-size:8px}
      .num{width:20px;text-align:center}
      .rp-cell{background:#fefce8}
      .p{background:#eff6ff}.rp{background:#fef9c3}
      .p1avg{color:#1d4ed8;font-weight:700}.p2avg{color:#7c3aed;font-weight:700}
      .p3avg{color:#059669;font-weight:700}.p4avg{color:#d97706;font-weight:700}
      .p5avg{color:#b91c1c;font-weight:700}.p6avg{color:#0891b2;font-weight:700}.p7avg{color:#92400e;font-weight:700}
      .cf-cell{background:#e0f2fe;text-align:center}
      .cf-d{display:block;font-size:6.5px;color:#64748b}
      .cf-e{display:block;font-size:10px;font-weight:900}
      .ok{color:#15803d}.risk{color:#be123c}
      .estado.ok{background:#dcfce7;font-weight:700}
      .estado.risk{background:#fee2e2;font-weight:700}
      @page{size:landscape;margin:10mm}
      @media print{body{margin:0}}
    `;

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
      <title>Registro · ${area} · ${cursoNombre}</title>
      <style>${css}</style></head><body>
      <div class="asignatura-badge">${area.toUpperCase()}</div>
      <h1>Registro de Calificaciones — ${grado} ${seccion}</h1>
      <h2>${centro}</h2>
      <div class="meta">
        <span><b>Asignatura:</b> ${area}</span>
        <span><b>Grado / Sección:</b> ${grado} ${seccion}</span>
        <span><b>Docente:</b> ${docente}</span>
        <span><b>Año escolar:</b> ${anioEscolar}</span>
        <span><b>Generado:</b> ${new Date().toLocaleDateString('es-DO',{day:'2-digit',month:'long',year:'numeric'})}</span>
      </div>
      <table><thead>
        <tr>
          <th rowspan="3" style="min-width:20px">N°</th>
          <th rowspan="3" style="min-width:120px">ESTUDIANTE</th>
          ${compHeaders}
          <th colspan="${codigosComp.length}" style="background:#0369a1">PROMEDIOS</th>
          <th rowspan="3" style="background:#0369a1">C.F.</th>
          <th rowspan="3" style="background:#374151">SITUACIÓN</th>
        </tr>
        <tr>${subHeaders}
          ${codigosComp.map((_, idx) => `<th class="tc p${idx + 1}avg">PC${idx + 1}</th>`).join("")}
        </tr>
        <tr>
          ${codigosComp.flatMap(() => ["P1","RP1","P2","RP2","P3","RP3","P4","RP4"]
            .map(p => `<th class="tc ${p.startsWith("R") ? "rp" : "p"}" style="font-size:7px">${p}</th>`)
          ).join("")}
          ${codigosComp.map(() => `<th style="font-size:6px;background:#0369a1"> </th>`).join("")}
        </tr>
      </thead><tbody>${bodyHTML}</tbody></table>
      <script>window.onload=()=>window.print()</script>
      </body></html>`;

    const win = window.open("", "_blank");
    if (!win) { alert("Permite ventanas emergentes para exportar el PDF."); return; }
    win.document.write(html);
    win.document.close();
  };

  return (
    <div className="registro-page">
      {cursoAutomatico && (
        <div style={{ background: "#FEF3C7", borderLeft: "4px solid #D97706", padding: "10px 16px", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          <span>⚠️</span>
          <span>Estás registrando en <strong>{cursoNombre}</strong> (primer curso). Para cambiar de curso, selecciónalo desde la sección <strong>Cursos</strong>.</span>
        </div>
      )}
      <section className="registro-hero">
        <div className="registro-hero-copy">
          <p className="registro-kicker">📋 Trabajando en este curso</p>
          <h1>Registro de {cursoNombre}</h1>
          <p className="registro-subtitle">
            {area} · {grado} {seccion} · {anioEscolar}
          </p>

          <div className="registro-hero-meta">
            <span>🏫 {centro}</span>
            <span>👤 {docente}</span>
            <span>📅 {mes} · Período {periodo}</span>
          </div>

          <div className="registro-hero-actions">
            <button type="button" className="rh-btn-secondary" onClick={onVolver}>← Volver</button>
            <button type="button" className="rh-btn-primary" onClick={handleGuardar} disabled={guardando}>
              {guardando ? "⏳ Guardando..." : "💾 Guardar"}
            </button>
            <button type="button" className="rh-btn-primary" onClick={exportarPDF}>📥 PDF</button>
            <button type="button" className="rh-btn-primary" onClick={exportarExcel}>📊 Excel</button>
            <button type="button" className="rh-btn-ghost" onClick={() => window.print()}>🖨 Imprimir</button>
          </div>
          {mensajeGuardado && (
            <div className={`registro-msg-guardado ${mensajeGuardado.tipo}`}>
              {mensajeGuardado.texto}
            </div>
          )}
        </div>

        <div className="registro-hero-kpis">
          <article className="registro-kpi-card">
            <span className="registro-kpi-icon" aria-hidden="true">📅</span>
            <strong>{resumen.asistenciaGeneral}%</strong>
            <small>Asistencia general</small>
          </article>
          <article className="registro-kpi-card">
            <span className="registro-kpi-icon" aria-hidden="true">📊</span>
            <strong>{resumen.promedioCompetencias}%</strong>
            <small>Promedio competencias</small>
          </article>
          <article className={`registro-kpi-card ${resumen.estadoGeneral === "Aprobado" ? "kpi-ok" : resumen.estadoGeneral === "En recuperación" ? "kpi-warn" : "kpi-risk"}`}>
            <span className="registro-kpi-icon" aria-hidden="true">
              {resumen.estadoGeneral === "Aprobado" ? "✅" : resumen.estadoGeneral === "En recuperación" ? "⚠️" : "🚨"}
            </span>
            <strong>{resumen.estadoGeneral}</strong>
            <small>Estado del grupo</small>
          </article>
          <article className="registro-kpi-card">
            <span className="registro-kpi-icon" aria-hidden="true">🗓</span>
            <strong>{periodoActivo.replace("Periodo ", "P")}</strong>
            <small>Período activo</small>
          </article>
        </div>
      </section>

      <section className="registro-tabs">
        {["Asistencia", "Competencias", "Indicadores", "Aspectos", "Instrumentos", "Evaluaciones", "Calificaciones", "Resumen"].map((tab) => (
          <button
            key={tab}
            type="button"
            className={tabActiva === tab ? "active" : ""}
            onClick={() => setTabActiva(tab)}
          >
            {tab}
          </button>
        ))}
      </section>

      {tabActiva === "Resumen" && (
        <section className="registro-panel">
          {/* ── Estadísticas del grupo ── */}
          <div className="rs-stats-row">
            <div className="rs-stat-card rs-stat-ok">
              <strong>{resumen.aprobados}</strong>
              <span>Aprobados</span>
            </div>
            <div className="rs-stat-card rs-stat-risk">
              <strong>{resumen.enRiesgo}</strong>
              <span>En riesgo / No aprobados</span>
            </div>
            <div className="rs-stat-card">
              <strong>{resumen.promedioCompetencias > 0 ? resumen.promedioCompetencias : "—"}</strong>
              <span>Promedio del grupo</span>
            </div>
            <div className="rs-stat-card">
              <strong>{resumen.asistenciaGeneral}%</strong>
              <span>Asistencia general</span>
            </div>
            <div className="rs-stat-card">
              <strong>{resumen.conNotas} / {estudiantes.length}</strong>
              <span>Con calificaciones</span>
            </div>
          </div>

          {/* ── Asistente IA ── */}
          <div className="rs-ia-bar">
            <button
              type="button"
              className="rh-btn-primary rs-ia-btn"
              onClick={sugerirApoyoIA}
              disabled={iaGenerando}
            >
              {iaGenerando ? "⏳ Analizando..." : "🤖 Sugerir apoyo (IA)"}
            </button>
            {(iaTexto || iaError) && !iaGenerando && (
              <button
                type="button"
                className="rh-btn-secondary"
                onClick={() => { setIaTexto(""); setIaError(null); }}
              >
                Limpiar análisis
              </button>
            )}
          </div>

          {iaError && (
            <div className="rs-ia-error">⚠️ {iaError}</div>
          )}

          {(iaTexto || iaGenerando) && (
            <div className="rs-ia-panel" ref={iaRef}>
              <div className="rs-ia-header">
                <span>🤖 Diagnóstico pedagógico IA</span>
                {iaGenerando && <span className="rs-ia-spinner">Generando análisis...</span>}
              </div>
              <div className="rs-ia-content">
                {iaTexto.split("\n").map((line, i) => {
                  if (line.startsWith("## ")) {
                    return <h3 key={i} className="rs-ia-h3">{line.slice(3)}</h3>;
                  }
                  if (line.startsWith("### ")) {
                    return <h4 key={i} className="rs-ia-h4">{line.slice(4)}</h4>;
                  }
                  if (line.startsWith("- ") || line.startsWith("* ")) {
                    return (
                      <li key={i} className="rs-ia-li">
                        {renderBold(line.slice(2))}
                      </li>
                    );
                  }
                  if (line.trim() === "") {
                    return <br key={i} />;
                  }
                  return <p key={i} className="rs-ia-p">{renderBold(line)}</p>;
                })}
                {iaGenerando && <span className="rs-ia-cursor">▋</span>}
              </div>
            </div>
          )}

          {/* ── Tabla resumen por estudiante ── */}
          <div className="registro-section-head" style={{ marginTop: "24px" }}>
            <h2>Resumen por estudiante</h2>
            <p>C.F. calculada a partir de las notas ingresadas en la pestaña Calificaciones.</p>
          </div>
          <div className="registro-table-scroll">
            <table className="registro-table rs-tabla-resumen">
              <thead>
                <tr>
                  <th className="sticky-col">N.º</th>
                  <th className="sticky-name">Estudiante</th>
                  {onAbrirPerfil && <th style={{ width: 36 }} />}
                  {codigosComp.map((_, ci) => <th key={`res-pc-${ci}`}>PC{ci + 1}</th>)}
                  <th>C.F.</th>
                  <th>Situación</th>
                  <th>Observación</th>
                </tr>
              </thead>
              <tbody>
                {estudiantes.map((est, idx) => {
                  const notas = getNotasEstudiante(est.id);
                  const r = calcularResumenEstudiante(notas);
                  const estadoKey = r.situacion.toLowerCase().replace(/\s/g, "-");
                  return (
                    <tr key={est.id}>
                      <td className="sticky-col">{idx + 1}</td>
                      <td className="sticky-name">{est.nombre}</td>
                      {onAbrirPerfil && (
                        <td style={{ padding: "0 4px", textAlign: "center" }}>
                          <button
                            type="button"
                            title="Ver expediente del estudiante"
                            onClick={() => onAbrirPerfil({ ...est, cursoNombre, cursoId })}
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 2, opacity: 0.7 }}
                          >
                            👤
                          </button>
                        </td>
                      )}
                      {r.compAvgs.map((avg, ci) => (
                        <td key={ci} className={avg >= 70 ? "rs-nota-ok" : avg > 0 ? "rs-nota-risk" : ""}>
                          {avg > 0 ? avg.toFixed(1) : "—"}
                        </td>
                      ))}
                      <td className="rs-cf-cell">
                        {r.cfExacto > 0 ? (
                          <span className="rg-cf-formula">
                            <span className="rg-cf-decimal">{r.cfExacto.toFixed(2)}</span>
                            <span className={`rg-cf-entero ${r.cf >= 70 ? "nota-ok" : "nota-riesgo"}`}>{r.cf}</span>
                          </span>
                        ) : "—"}
                      </td>
                      <td className={`rs-situacion rs-estado-${estadoKey}`}>{r.situacion}</td>
                      <td>
                        <input
                          type="text"
                          className="rs-obs-input"
                          placeholder="Observación..."
                          value={observaciones[est.id] || ""}
                          onChange={(e) => actualizarObservacion(est.id, e.target.value)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tabActiva === "Asistencia" && (
        <section className="registro-panel">
          {/* ── Selector de mes ── */}
          <div className="asist-meses-tabs">
            {MESES_ESCOLAR.map((mes) => {
              const calendarioMes = crearCalendarioMes(mes, anioEscolar);
              const totals = asistencia.map((e) =>
                calcAsistenciaMes(e.meses?.[mes] ?? crearMesVacio(), calendarioMes)
              );
              const hayDatos = totals.some((t) => t.total > 0);
              return (
                <button
                  key={mes}
                  type="button"
                  className={`asist-mes-btn${mesActivo === mes ? " active" : ""}${hayDatos ? " con-datos" : ""}`}
                  onClick={() => setMesActivo(mes)}
                >
                  {mes}
                </button>
              );
            })}
          </div>

          {/* ── Tabla del mes activo ── */}
          <div className="registro-table-scroll">
            <table className="registro-table asistencia-table asist-mes-tabla">
              <thead>
                <tr>
                  <th rowSpan={2} className="sticky-col">N.º</th>
                  <th rowSpan={2} className="sticky-name">Alumno/a</th>
                  {Array.from({ length: SEMANAS_ASISTENCIA }, (_, si) => (
                    <th key={si} colSpan={5} className={`semana semana-${si + 1}`}>
                      Semana {si + 1}
                    </th>
                  ))}
                  <th rowSpan={2} className="asist-th-total">TOTAL</th>
                  <th rowSpan={2} className="asist-th-pct">%</th>
                </tr>
                <tr>
                  {Array.from({ length: SEMANAS_ASISTENCIA }, (_, si) =>
                    DIAS.map((dia, di) => {
                      const diaMes = calendarioMesActivo[si]?.[di] || null;
                      return (
                        <th
                          key={`${si}-${dia}`}
                          className={`dia-header semana-${si + 1}${diaMes ? "" : " fuera-mes"}`}
                        >
                          <span>{dia}</span>
                          <small>{diaMes || ""}</small>
                        </th>
                      );
                    })
                  )}
                </tr>
              </thead>
              <tbody>
                {asistencia.map((est, idx) => {
                  const semanas = normalizarSemanasAsistencia(est.meses?.[mesActivo] ?? crearMesVacio());
                  const { presentes, total, pct } = calcAsistenciaMes(semanas, calendarioMesActivo);
                  return (
                    <tr key={est.id}>
                      <td className="sticky-col">{idx + 1}</td>
                      <td className="sticky-name">{est.nombre}</td>
                      {semanas.map((sem, si) =>
                        sem.map((val, di) => {
                          const diaMes = calendarioMesActivo[si]?.[di] || null;
                          return (
                            <td
                              key={`${est.id}-${si}-${di}`}
                              className={`asist-celda semana-${si + 1}${diaMes ? "" : " fuera-mes"}`}
                            >
                              <select
                                className={`asistencia-select ${badgeClase(diaMes ? val : "")}`}
                                value={diaMes ? val : ""}
                                disabled={!diaMes}
                                onChange={(e) => actualizarAsistencia(est.id, mesActivo, si, di, e.target.value)}
                              >
                                {ESTADOS_ASISTENCIA.map((s) => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                            </td>
                          );
                        })
                      )}
                      <td className="asist-td-total">{total > 0 ? presentes : "—"}</td>
                      <td className={`asist-td-pct${pct !== null ? (pct >= 85 ? " pct-ok" : pct >= 70 ? " pct-warn" : " pct-risk") : ""}`}>
                        {pct !== null ? pct : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="registro-leyenda">
            <span><i className="verde" />P · Presente</span>
            <span><i className="rojo" />A · Ausente</span>
            <span><i className="amarillo" />T · Tardanza</span>
            <span><i className="azul" />E · Excusa</span>
            <span style={{ color: "#94a3b8" }}>TOTAL y % · 2 excusas equivalen a 1 día presente</span>
          </div>
        </section>
      )}

      {tabActiva === "Competencias" && (
        <section className="registro-panel">
          <div className="registro-section-head">
            <h2>Promedios por competencia</h2>
            <p>Promedio del grupo en cada período por competencia específica — {area}.</p>
          </div>

          <div className="registro-table-scroll">
            <table className="registro-table rs-tabla-comp">
              <thead>
                <tr>
                  <th>Competencia</th>
                  <th>P1 (prom.)</th>
                  <th>P2 (prom.)</th>
                  <th>P3 (prom.)</th>
                  <th>P4 (prom.)</th>
                  <th>PC (prom. grupo)</th>
                </tr>
              </thead>
              <tbody>
                {codigosComp.map((codigo, ci) => {
                  // Promedio del grupo por período para esta competencia
                  const promsPorPeriodo = [0, 1, 2, 3].map((pi) => {
                    const vals = estudiantes.map((est) => {
                      const notas = getNotasEstudiante(est.id);
                      const per = notas.competencias[ci]?.periodos[pi];
                      if (!per) return 0;
                      const p  = Number(per.p)  || 0;
                      const rp = Number(per.rp) || 0;
                      return p >= 70 ? p : rp > 0 ? rp : p;
                    }).filter((v) => v > 0);
                    return vals.length
                      ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
                      : null;
                  });
                  const pcValidos = promsPorPeriodo.filter((v) => v !== null);
                  const pcProm = pcValidos.length
                    ? Math.round((pcValidos.reduce((a, b) => a + b, 0) / pcValidos.length) * 10) / 10
                    : null;
                  return (
                    <tr key={ci}>
                      <td className="rs-comp-label">
                        <span className={`rs-comp-badge rs-comp-badge-${ci + 1}`}>C{ci + 1}</span>
                        {codigo}
                      </td>
                      {promsPorPeriodo.map((v, pi) => (
                        <td key={pi} className={v !== null ? (v >= 70 ? "rs-nota-ok" : "rs-nota-risk") : ""}>
                          {v !== null ? v.toFixed(1) : "—"}
                        </td>
                      ))}
                      <td className={`rs-cf-cell ${pcProm !== null ? (pcProm >= 70 ? "rs-nota-ok" : "rs-nota-risk") : ""}`}>
                        <strong>{pcProm !== null ? pcProm.toFixed(1) : "—"}</strong>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="rs-nota-pie">
            * Los promedios se calculan sobre los estudiantes que ya tienen nota ingresada en la pestaña Calificaciones.
            P = nota del período · RP se usa cuando P &lt; 70.
          </p>
        </section>
      )}

      {tabActiva === "Indicadores" && (() => {
        const filas = estudiantes.map((est) => {
          const notas = getNotasEstudiante(est.id);
          return { est, ...calcularResumenEstudiante(notas) };
        });
        const conNotas   = filas.filter((f) => f.cf > 0);
        const aprobados  = conNotas.filter((f) => f.situacion === "Aprobado");
        const completiva = conNotas.filter((f) => f.situacion === "Completiva");
        const extraord   = conNotas.filter((f) => f.situacion === "Extraordinaria");
        const reprobados = conNotas.filter((f) => f.reprobado);
        const enRiesgo   = conNotas.filter((f) => f.cf > 0 && f.cf < 70 && f.situacion !== "Completiva" && f.situacion !== "Extraordinaria");

        return (
          <section className="registro-panel">
            <div className="registro-section-head">
              <h2>Situación del grupo</h2>
              <p>Seguimiento real basado en las calificaciones ingresadas · {conNotas.length} de {estudiantes.length} estudiantes con notas.</p>
            </div>

            <div className="rs-indicadores-grid">
              <article className="rs-ind-card rs-ind-ok">
                <strong>{aprobados.length}</strong>
                <span>Aprobados directamente</span>
                <small>C.F. ≥ 70</small>
              </article>
              <article className="rs-ind-card rs-ind-comp">
                <strong>{completiva.length}</strong>
                <span>Aprobaron completiva</span>
                <small>C.C.F. ≥ 70</small>
              </article>
              <article className="rs-ind-card rs-ind-extra">
                <strong>{extraord.length}</strong>
                <span>Aprobaron extraordinaria</span>
                <small>C.EX.F. ≥ 70</small>
              </article>
              <article className="rs-ind-card rs-ind-risk">
                <strong>{reprobados.length}</strong>
                <span>Reprobados</span>
                <small>No aprobaron ninguna instancia</small>
              </article>
            </div>

            {enRiesgo.length > 0 && (
              <div className="rs-en-riesgo">
                <h3>⚠️ Estudiantes en riesgo (C.F. &lt; 70)</h3>
                <div className="rs-riesgo-lista">
                  {enRiesgo.map(({ est, cf, ccf }) => (
                    <div key={est.id} className="rs-riesgo-item">
                      <span className="rs-riesgo-nombre">{est.nombre}</span>
                      <span className="rs-riesgo-cf">C.F. {cf}</span>
                      {ccf > 0 && <span className="rs-riesgo-ccf">C.C.F. {ccf}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {conNotas.length === 0 && (
              <p className="rs-nota-pie" style={{ marginTop: "24px" }}>
                Aún no hay notas ingresadas. Ve a la pestaña <strong>Calificaciones</strong> para comenzar a registrar.
              </p>
            )}
          </section>
        );
      })()}

      {tabActiva === "Aspectos" && (
        <section className="registro-panel">
          <div className="registro-section-head">
            <h2>Especificación Curricular Aplicada por Período</h2>
            <p>
              Se completa automáticamente desde tus planificaciones. Solo aparecen las competencias
              e indicadores que realmente trabajaste en cada período.
            </p>
          </div>

          {["P1", "P2", "P3", "P4"].map((per, idx) => (
            <div key={per} className="curriculo-periodo-bloque">
              <div className="curriculo-periodo-header">
                <span className="curriculo-periodo-chip">Período {idx + 1}</span>
                <span className="curriculo-periodo-titulo">Especificación Curricular Aplicada por Período</span>
              </div>
              <table className="curriculo-tabla">
                <thead>
                  <tr>
                    <th className="curriculo-th-ce">CE</th>
                    <th className="curriculo-th-il">Indicadores de Logro</th>
                    <th className="curriculo-th-cont">Contenidos Claves</th>
                  </tr>
                </thead>
                <tbody>
                  {competencias.some((comp) => comp.nombre || comp.indicadoresLogro?.length) ? (
                    competencias.map((comp, ci) => (
                      <tr key={`${per}-${comp.id || ci}`}>
                        <td className="curriculo-td-ce">
                          <strong>{codigosComp[ci] || comp.id || `CE-${ci + 1}`}</strong>
                        </td>
                        <td className="curriculo-td-il">
                          <strong>{comp.nombre || `Competencia ${ci + 1}`}</strong>
                          {comp.indicadoresLogro?.length > 0 ? (
                            <ul>
                              {comp.indicadoresLogro.map((indicador, idxIl) => (
                                <li key={`${per}-${ci}-${idxIl}`}>{indicador}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="curriculo-vacio">Sin indicadores cargados para esta competencia.</p>
                          )}
                        </td>
                        <td className="curriculo-td-cont">
                          {[
                            ...(comp.contenidos?.conceptuales || []),
                            ...(comp.contenidos?.procedimentales || []),
                            ...(comp.contenidos?.actitudinales || []),
                          ].slice(0, 5).map((contenido, idxCont) => (
                            <span key={`${per}-${ci}-cont-${idxCont}`}>{contenido}</span>
                          ))}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="curriculo-td-ce" />
                      <td className="curriculo-td-il">
                        <p className="curriculo-vacio">
                          Los indicadores se completarán automáticamente cuando registres planificaciones
                          con códigos CE e IL para este período.
                        </p>
                      </td>
                      <td className="curriculo-td-cont" />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ))}

          <p className="curriculo-nota">
            📌 El MINERD indica: <em>"Los aspectos esenciales de la planificación, su ejecución y evaluación
            ofrecen los insumos que se utilizarán para las precisiones curriculares."</em>
          </p>
        </section>
      )}

      {tabActiva === "Instrumentos" && (
        <section className="registro-panel">
          <div className="registro-section-head">
            <h2>Instrumentos y aspectos evaluables</h2>
            <p>Columnas automáticas creadas desde instrumentos, con edición manual y autoguardado de notas.</p>
          </div>

          <div className={`registro-distribucion ${mensajeDistribucionAspectos.tipo}`}>
            <strong>{mensajeDistribucionAspectos.texto}</strong>
            <span>Total activo: {totalAspectosActivos}/100 puntos</span>
            <span>Banco anual: {evidenciasCurso.length} evidencia(s)</span>
            <button type="button" className="mini-btn" onClick={crearAspectoManual}>Agregar aspecto manual</button>
            <small>
              {estadoNotasAspectos === "saving" && "Guardando..."}
              {estadoNotasAspectos === "saved" && "Guardado"}
              {estadoNotasAspectos === "error" && "Error al guardar"}
            </small>
          </div>

          {registroAspectos.length === 0 ? (
            <div className="registro-empty-state">
              <strong>No hay aspectos evaluables todavía.</strong>
              <p>Crea un instrumento desde Instrumentos o agrega un aspecto manual para iniciar el registro.</p>
            </div>
          ) : (
            <>
              <div className="registro-aspectos-editor">
                {registroAspectos.map((aspecto) => (
                  <article key={aspecto.aspectoId} className="registro-aspecto-card">
                    <span>{aspecto.origen === "instrumento" ? "Instrumento" : "Manual"}</span>
                    <input
                      value={aspecto.nombre || ""}
                      onChange={(e) => actualizarAspecto(aspecto.aspectoId, "nombre", e.target.value)}
                      aria-label="Nombre del aspecto"
                    />
                    <label>
                      Puntos
                      <input
                        type="number"
                        min="0"
                        value={aspecto.puntajeMaximo || 0}
                        onChange={(e) => actualizarAspecto(aspecto.aspectoId, "puntajeMaximo", e.target.value)}
                      />
                    </label>
                    <label>
                      Estado
                      <select value={aspecto.estado || "activo"} onChange={(e) => actualizarAspecto(aspecto.aspectoId, "estado", e.target.value)}>
                        <option value="activo">Activo</option>
                        <option value="inactivo">Inactivo</option>
                      </select>
                    </label>
                  </article>
                ))}
              </div>

              <div className="registro-table-scroll">
                <table className="registro-table registro-instrumentos-table">
                  <thead>
                    <tr>
                      <th className="sticky-name">Estudiante</th>
                      {aspectosActivos.map((aspecto) => (
                        <th key={aspecto.aspectoId}>
                          {aspecto.nombre}
                          <br />
                          <small>{aspecto.puntajeMaximo} pts</small>
                        </th>
                      ))}
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estudiantes.map((estudiante) => {
                      const total = calcularTotalInstrumental(estudiante.id);
                      return (
                        <tr key={estudiante.id}>
                          <td className="sticky-name">{estudiante.nombre}</td>
                          {aspectosActivos.map((aspecto) => {
                            const nota = obtenerNotaAspecto(estudiante.id, aspecto.aspectoId);
                            return (
                              <td key={aspecto.aspectoId}>
                                <div className="registro-nota-aspecto">
                                  <input
                                    type="number"
                                    min="0"
                                    max={aspecto.puntajeMaximo || 0}
                                    value={nota?.valorObtenido ?? ""}
                                    placeholder="Pendiente"
                                    onChange={(e) => actualizarNotaAspecto(estudiante, aspecto, e.target.value)}
                                  />
                                  <button type="button" onClick={() => crearEvidenciaDesdeNota(estudiante, aspecto)}>Evidencia</button>
                                </div>
                              </td>
                            );
                          })}
                          <td className={total.porcentaje >= 70 ? "rs-nota-ok" : total.porcentaje > 0 ? "rs-nota-risk" : ""}>
                            <strong>{total.totalObtenido}/{total.totalMaximo}</strong>
                            <br />
                            <small>{total.pendientes > 0 ? `${total.pendientes} pendiente(s)` : `${total.porcentaje}%`}</small>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      {tabActiva === "Evaluaciones" && (
        <section className="registro-panel">
          <div className="registro-section-head">
            <h2>Evaluaciones desde instrumentos</h2>
            <p>Consolidado automático desde rúbricas, listas de cotejo, escalas y otros instrumentos aplicados.</p>
          </div>

          {evaluacionesConsolidadas.length === 0 ? (
            <div className="registro-empty-state">
              <strong>Aún no hay evaluaciones sincronizadas.</strong>
              <p>Aplica un instrumento desde el módulo Instrumentos y esta tabla se actualizará automáticamente.</p>
            </div>
          ) : (
            evaluacionesConsolidadas.map((evaluacion) => (
              <div key={evaluacion.id} className="registro-evaluacion-card">
                <div className="registro-section-head compact">
                  <h3>{evaluacion.actividad || "Evaluación vinculada"}</h3>
                  <p>
                    {evaluacion.competencia || "Competencia"} · {evaluacion.periodo || "Período"} ·
                    Estrategia: {evaluacion.estrategia || "No especificada"}
                  </p>
                </div>
                <div className="registro-trazabilidad">
                  <span>Fuente: Planificación</span>
                  <span>Planificación: {evaluacion.referencias?.planificacionId || evaluacion.planificacionId || "sin referencia"}</span>
                  <span>{Object.keys(evaluacion.evidencias || {}).length} evidencias</span>
                </div>
                <div className="registro-indicadores-lista">
                  {(evaluacion.indicadores || []).map((indicador, index) => (
                    <span key={`${evaluacion.id}-ind-${index}`}>{indicador}</span>
                  ))}
                </div>
                <div className="registro-table-scroll">
                  <table className="registro-table">
                    <thead>
                      <tr>
                        <th className="sticky-name">Estudiante</th>
                        {evaluacion.instrumentosLista.map((instrumento) => (
                          <th key={instrumento.id}>{instrumento.tipo}<br /><small>{instrumento.valorMaximo} pts</small></th>
                        ))}
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evaluacion.estudiantesLista.map((estudiante) => (
                        <tr key={estudiante.id}>
                          <td className="sticky-name">{estudiante.nombre}</td>
                          {evaluacion.instrumentosLista.map((instrumento) => {
                            const aplicacion = estudiante.instrumentos?.[instrumento.id];
                            return (
                              <td key={instrumento.id} className={aplicacion ? "rs-nota-ok" : ""}>
                                {aplicacion ? `${aplicacion.puntosObtenidos}/${aplicacion.valorMaximo}` : "—"}
                              </td>
                            );
                          })}
                          <td className={estudiante.porcentaje >= 70 ? "rs-nota-ok" : estudiante.porcentaje > 0 ? "rs-nota-risk" : ""}>
                            <strong>{estudiante.totalObtenido || 0}/{estudiante.totalMaximo || evaluacion.valorTotal || 0}</strong>
                            <br />
                            <small>{estudiante.porcentaje || 0}%</small>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </section>
      )}

      {tabActiva === "Calificaciones" && (
  <section className="registro-panel rg-panel">
    <div className="registro-section-head">
      <h2>Calificaciones por Competencias</h2>
      <p>Registro Oficial MINERD — {area} · {cursoNombre}</p>
    </div>

    {/* ── Panel live de evaluación ── */}
    {resumen.conNotas > 0 && (
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
        padding: '10px 14px', marginBottom: 14,
        background: '#f8faff', border: '1px solid #e2e8f0', borderRadius: 10,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#8a96ab', marginRight: 4 }}>
          LIVE · {resumen.conNotas}/{estudiantes.length} con notas
        </div>
        {[
          { label: 'Logrado',    color: '#16a34a', bg: '#dcfce7', count: resumen.aprobados },
          { label: 'En proceso', color: '#d97706', bg: '#fef9c3', count: resumen.enRiesgo  },
          { label: 'Sin notas',  color: '#94a3b8', bg: '#f1f5f9', count: estudiantes.length - resumen.conNotas },
        ].map(({ label, color, bg, count }) => (
          <div key={label} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: bg, borderRadius: 20,
            padding: '3px 10px', fontSize: 12,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: color, display: 'inline-block',
            }} />
            <span style={{ fontWeight: 700, color }}>{count}</span>
            <span style={{ color: '#475569' }}>{label}</span>
          </div>
        ))}
        {resumen.promedioCompetencias > 0 && (
          <div style={{
            marginLeft: 'auto', fontSize: 12, color: '#475569',
          }}>
            Promedio: <strong style={{
              color: resumen.promedioCompetencias >= 70 ? '#16a34a' : '#dc2626',
            }}>{resumen.promedioCompetencias}</strong>
          </div>
        )}
      </div>
    )}

    <div className="rg-scroll-wrapper">
      <table className="rg-table">
        <thead>
          <tr>
            <th rowSpan={3} className="rg-th rg-th-fixed rg-th-num">N.º</th>
            <th rowSpan={3} className="rg-th rg-th-fixed rg-th-nombre">ESTUDIANTE</th>
            <th colSpan={cantidadCompetencias * 8} className="rg-th rg-th-section rg-section-comp">COMPETENCIAS ESPECÍFICAS</th>
            <th colSpan={cantidadCompetencias + 1}  className="rg-th rg-th-section rg-section-prom">PROMEDIO DE COMPETENCIAS ESPECÍFICAS</th>
            <th colSpan={4}  className="rg-th rg-th-section rg-section-completiva">CALIFICACIÓN COMPLETIVA</th>
            <th colSpan={4}  className="rg-th rg-th-section rg-section-extra">CALIFICACIÓN EXTRAORDINARIA</th>
            <th colSpan={2}  className="rg-th rg-th-section rg-section-especial">CALIFICACIONES ESPECIALES</th>
            <th colSpan={3}  className="rg-th rg-th-section rg-section-situacion">SITUACIÓN FINAL EN LA ASIGNATURA</th>
          </tr>
          <tr>
            {codigosComp.map((codigo, ci) => (
              <th key={`ch-${ci}`} colSpan={8} className={`rg-th rg-th-comp rg-comp-${ci + 1}`}>
                <span className="rg-comp-num">C{ci + 1}</span>
                <span className="rg-comp-code">{codigo}</span>
                <span className="rg-comp-name">{competencias[ci]?.nombre || `Competencia ${ci + 1}`}</span>
              </th>
            ))}
            {codigosComp.map((_, ci) => (
              <th key={`prom-head-${ci}`} className="rg-th rg-th-prom">C{ci + 1}</th>
            ))}
            <th className="rg-th rg-th-prom rg-th-cf-col">C.F.</th>
            <th className="rg-th rg-th-completiva">50% C.F.</th>
            <th className="rg-th rg-th-completiva">C.E.C.</th>
            <th className="rg-th rg-th-completiva">50% C.E.C.</th>
            <th className="rg-th rg-th-completiva rg-th-cf-col">C.C.F.</th>
            <th className="rg-th rg-th-extra">30% C.F.</th>
            <th className="rg-th rg-th-extra">C.E.EX.</th>
            <th className="rg-th rg-th-extra">70% C.E.EX.</th>
            <th className="rg-th rg-th-extra rg-th-cf-col">C.EX.F.</th>
            <th className="rg-th rg-th-especial">C.F.</th>
            <th className="rg-th rg-th-especial">C.E.</th>
            <th className="rg-th rg-th-situacion">A</th>
            <th className="rg-th rg-th-situacion">R</th>
            <th className="rg-th rg-th-situacion">Estado</th>
          </tr>
          <tr>
            {codigosComp.flatMap((_, ci) =>
              ["P1","RP1","P2","RP2","P3","RP3","P4","RP4"].map((p) => (
                <th key={`ph-${ci}-${p}`} className={`rg-th rg-th-periodo ${p.startsWith("RP") ? "rg-th-rp" : "rg-th-p"}`}>{p}</th>
              ))
            )}
            {Array.from({ length: 18 }, (_, i) => (
              <th key={`e-${i}`} className="rg-th rg-th-empty"> </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {estudiantes.map((est, rowIdx) => {
            const notas = getNotasEstudiante(est.id);
            const { compAvgs, cfExacto, cf, ccf, cexf, necesitaComp, necesitaExtra, situacion, aprobado, reprobado } =
              calcularResumenEstudiante(notas);

            const ceComp   = Number(notas.ceCompletiva)     || 0;
            const ceExtra  = Number(notas.ceExtraordinaria) || 0;
            const cfDisplay = cf >= 70 ? cf : ccf >= 70 ? ccf : cexf >= 70 ? cexf : cf || 0;
            const ceDisplay = cf >= 70 ? 0  : ccf >= 70 ? ceComp : cexf >= 70 ? ceExtra : 0;
            const p50cf    = cf > 0     ? Math.round(cf * 0.5)      : 0;
            const p50cec   = ceComp > 0 ? Math.round(ceComp * 0.5)  : 0;
            const p30cf    = cf > 0     ? Math.round(cf * 0.3)      : 0;
            const p70ceex  = ceExtra > 0 ? Math.round(ceExtra * 0.7) : 0;
            const estadoKey = situacion.toLowerCase().replace(/\s/g, "-");

            return (
              <tr key={est.id} className={rowIdx % 2 === 0 ? "rg-row-even" : "rg-row-odd"}>
                <td className="rg-td rg-td-fixed rg-td-num">{rowIdx + 1}</td>
                <td className="rg-td rg-td-fixed rg-td-nombre">{est.nombre}</td>

                {notas.competencias.flatMap((comp, ci) =>
                  comp.periodos.flatMap((per, pi) => {
                    const pVal = Number(per.p) || 0;
                    const rpOk = pVal >= 70;
                    return [
                      <td key={`${est.id}-c${ci}p${pi}-p`} className={`rg-td rg-td-nota rg-comp-bg-${ci+1}`}>
                        <input type="number" min="0" max="100" value={per.p}
                          onChange={(e) => actualizarNotaEstudiante(est.id, ci, pi, "p", e.target.value)}
                          className="rg-input-nota" />
                      </td>,
                      <td key={`${est.id}-c${ci}p${pi}-rp`} className={`rg-td rg-td-nota ${rpOk ? "rg-td-rp-ok" : "rg-td-rp-pend"} rg-comp-bg-${ci+1}`}>
                        {rpOk
                          ? <span className="rg-rp-ok">✓</span>
                          : <input type="number" min="0" max="100" value={per.rp}
                              onChange={(e) => actualizarNotaEstudiante(est.id, ci, pi, "rp", e.target.value)}
                              className="rg-input-nota rg-input-rp" />
                        }
                      </td>,
                    ];
                  })
                )}

                {compAvgs.map((avg, ci) => (
                  <td key={`avg-${ci}`} className="rg-td rg-td-prom">
                    <strong className={avg >= 70 ? "nota-ok" : avg > 0 ? "nota-riesgo" : ""}>
                      {avg > 0 ? avg.toFixed(1) : "—"}
                    </strong>
                  </td>
                ))}
                <td className="rg-td rg-td-cf-cell">
                  {cfExacto > 0 ? (
                    <span className="rg-cf-formula">
                      <span className="rg-cf-decimal">{cfExacto.toFixed(2)}</span>
                      <span className={`rg-cf-entero ${cf >= 70 ? "nota-ok" : "nota-riesgo"}`}>{cf}</span>
                    </span>
                  ) : "—"}
                </td>

                <td className="rg-td rg-td-completiva">{p50cf > 0 ? p50cf : "—"}</td>
                <td className="rg-td rg-td-completiva">
                  {necesitaComp
                    ? <input type="number" min="0" max="100" value={notas.ceCompletiva}
                        onChange={(e) => actualizarExtraEstudiante(est.id, "ceCompletiva", e.target.value)}
                        className="rg-input-nota rg-input-extra" placeholder="—" />
                    : <span className="rg-na">—</span>}
                </td>
                <td className="rg-td rg-td-completiva">{p50cec > 0 ? p50cec : "—"}</td>
                <td className="rg-td rg-td-completiva rg-td-cf-cell">
                  <strong className={ccf >= 70 ? "nota-ok" : ccf > 0 ? "nota-riesgo" : ""}>{ccf > 0 ? ccf : "—"}</strong>
                </td>

                <td className="rg-td rg-td-extra">{p30cf > 0 ? p30cf : "—"}</td>
                <td className="rg-td rg-td-extra">
                  {necesitaExtra
                    ? <input type="number" min="0" max="100" value={notas.ceExtraordinaria}
                        onChange={(e) => actualizarExtraEstudiante(est.id, "ceExtraordinaria", e.target.value)}
                        className="rg-input-nota rg-input-extra" placeholder="—" />
                    : <span className="rg-na">—</span>}
                </td>
                <td className="rg-td rg-td-extra">{p70ceex > 0 ? p70ceex : "—"}</td>
                <td className="rg-td rg-td-extra rg-td-cf-cell">
                  <strong className={cexf >= 70 ? "nota-ok" : cexf > 0 ? "nota-riesgo" : ""}>{cexf > 0 ? cexf : "—"}</strong>
                </td>

                <td className="rg-td rg-td-especial">{cfDisplay > 0 ? cfDisplay : "—"}</td>
                <td className="rg-td rg-td-especial">{ceDisplay > 0 ? ceDisplay : "—"}</td>

                <td className="rg-td rg-td-situacion rg-td-check">{aprobado  ? "✓" : ""}</td>
                <td className="rg-td rg-td-situacion rg-td-check">{reprobado ? "✗" : ""}</td>
                <td className={`rg-td rg-td-situacion rg-td-estado rg-estado-${estadoKey}`}>{situacion}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    <div className="rg-leyenda">
      <span><b>P</b> = Nota del período</span>
      <span><b>RP</b> = Recuperación · solo si P &lt; 70</span>
      <span><b>C.F.</b> = Calificación final</span>
      <span><b>C.E.C.</b> = Examen completivo (si C.F. &lt; 70)</span>
      <span><b>C.E.EX.</b> = Examen extraordinario (si C.C.F. &lt; 70)</span>
      <span><b>✓ en RP</b> = Período aprobado sin recuperación</span>
    </div>
  </section>
)}

    </div>
  );
}

export default RegistroPage;
