/**
 * Servicio: Generador de Unidad de Aprendizaje — formato MINERD
 */

import { resolverClave } from "../planning/areaAsignaturaMap.js";
import { obtenerActividadesBanco, withTema } from "../planning/bancoPedagogico.js";
import { inyectarExpresiones } from "../planning/bancoExpresionesIdiomas.js";
import { obtenerBPActs } from "./bpCache.js";
import { getCurricularContentForUnit } from "./bancoConocimientoService.js";
import { buildEspecificacionCurricular, generateWeekPlan } from "./phaseAService.js";

// ─── Constantes ───────────────────────────────────────────────────────────────

const NOMBRES_FASES = [
  "Presentación de la Situación de Aprendizaje y apropiación de la unidad",
  "Desarrollo y exploración de los aprendizajes",
  "Profundización y aplicación de los aprendizajes",
  "Integración y consolidación de los saberes",
  "Síntesis y evaluación de los aprendizajes",
  "Cierre, socialización y evaluación sumativa",
];

const ESTRATEGIAS_POR_AREA = {
  "Inglés": "Enfoque Comunicativo (Communicative Language Teaching)",
  "Lengua Española": "Enfoque Comunicativo Funcional y Lectoescritura",
  "Matemática": "Resolución de Problemas y Aprendizaje Colaborativo",
  "Ciencias de la Naturaleza": "Indagación Científica y Aprendizaje Basado en Preguntas",
  "Ciencias Sociales": "Aprendizaje Basado en Proyectos y Análisis Crítico",
  "Educación Artística": "Aprendizaje Experiencial y Expresión Creativa",
  "Educación Física": "Aprendizaje Cooperativo y Desarrollo Motor",
  "Formación Integral Humana y Religiosa": "Diálogo de Saberes y Reflexión Ética",
  "Francés": "Enfoque Comunicativo y Aprendizaje Significativo",
};

const COMPETENCIAS_FUND_POR_AREA = {
  "Inglés":                               ["Comunicativa", "Científica y Tecnológica"],
  "Lengua Española":                      ["Comunicativa", "Pensamiento Lógico, Creativo y Crítico"],
  "Matemática":                           ["Pensamiento Lógico, Creativo y Crítico", "Resolución de Problemas"],
  "Ciencias de la Naturaleza":            ["Científica y Tecnológica", "Ambiental y de la Salud"],
  "Ciencias Sociales":                    ["Ética y Ciudadana", "Ambiental y de la Salud"],
  "Educación Física":                     ["Desarrollo Personal y Espiritual", "Ambiental y de la Salud"],
  "Educación Artística":                  ["Comunicativa", "Desarrollo Personal y Espiritual"],
  "Formación Integral Humana y Religiosa":["Desarrollo Personal y Espiritual", "Ética y Ciudadana"],
  "Francés":                              ["Comunicativa", "Científica y Tecnológica"],
};

// ─── Helpers de contenido por área ────────────────────────────────────────────

const getEstrategia = (area) =>
  ESTRATEGIAS_POR_AREA[area] || "Aprendizaje Colaborativo e Indagación Dialógica";

// getSituacion (plantilla corta legacy) fue reemplazada por
// construirSituacionNarrativa — situación al estilo del documento modelo.

const getAmbiente = (area) => {
  const a = {
    "Inglés": "Aula de clases acondicionada con rincón de lectura en inglés, proyector, parlantes y materiales audiovisuales. Entorno comunitario para actividades de uso del idioma.",
    "Matemática": "Aula de clases con espacio para trabajo colaborativo, área de materiales manipulativos y acceso a herramientas de cálculo. Contextos reales del entorno para aplicación de conceptos.",
    "Ciencias de la Naturaleza": "Aula de clases adaptada como laboratorio básico, espacio exterior (patio/jardín) para observación y experimentación. Acceso a materiales naturales del entorno.",
  };
  return a[area] || "Aula de clases organizada para trabajo colaborativo e individual. Entorno comunitario y familiar para extensión de los aprendizajes.";
};

const getEjesTematicos = (area) => {
  const ejes = {
    "Inglés": ["Alfabetización Imprescindible", "Ciudadanía y Convivencia"],
    "Matemática": ["Alfabetización Imprescindible", "Desarrollo Sostenible"],
    "Ciencias de la Naturaleza": ["Desarrollo Sostenible", "Ciudadanía y Convivencia"],
    "Ciencias Sociales": ["Ciudadanía y Convivencia", "Desarrollo Sostenible"],
    "Educación Física": ["Salud y Bienestar", "Ciudadanía y Convivencia"],
    "Lengua Española": ["Alfabetización Imprescindible", "Ciudadanía y Convivencia"],
  };
  return ejes[area] || ["Alfabetización Imprescindible", "Ciudadanía y Convivencia"];
};

// ─── Template modelo (PDF "My Life and Daily Routines") ──────────────────────
// Secciones agregadas 2026-07-04 siguiendo el documento modelo del docente:
// ejes contextualizados, situación de aprendizaje narrativa, nota institucional,
// checkpoint formativo y anexos A-L. Todo template determinista parametrizado.

const ES_IDIOMA = (area) => area === "Inglés" || area === "Francés";
const NOMBRE_IDIOMA = (area) => (area === "Francés" ? "francés" : "inglés");

// Descripciones de ejes transversales contextualizadas al tema y al área
const construirEjesContextualizados = (ejes, { area, tema }) => {
  const idioma = ES_IDIOMA(area);
  const medio = idioma ? `en el idioma ${NOMBRE_IDIOMA(area)}` : `desde el área de ${area}`;
  const plantillas = {
    "Alfabetización Imprescindible": `Comprensión y expresión, ${medio} de forma oral y escrita, de ideas y saberes relacionados con "${tema}", fortaleciendo las habilidades comunicativas esenciales para aprender a lo largo de toda la vida y desenvolverse en situaciones reales del entorno escolar, familiar y comunitario.`,
    "Ciudadanía y Convivencia": `Comunicación e interacción ${medio} en intercambios sobre "${tema}" con cortesía, asertividad y respeto, reconociendo las diferencias individuales, asumiendo responsabilidades compartidas y promoviendo una sana convivencia en el hogar, la escuela y la comunidad.`,
    "Desarrollo Sostenible": `Interacción ${medio} con el propósito de vincular "${tema}" con el uso responsable de los recursos, la organización del tiempo y de los espacios, y decisiones cotidianas que aportan al bienestar propio, de la comunidad y del medio ambiente.`,
    "Salud y Bienestar": `Comunicación ${medio} con el propósito de relacionar "${tema}" con hábitos que impactan positivamente la salud física y emocional: alimentación balanceada, descanso adecuado, higiene, actividad física y manejo responsable del tiempo, valorando el bienestar como parte esencial de la vida del estudiante.`,
  };
  return (ejes || []).map((nombre) => ({
    nombre,
    descripcion: plantillas[nombre] || `Desarrollo del eje "${nombre}" a través de las experiencias de aprendizaje de la unidad "${tema}".`,
  }));
};

// Situación de aprendizaje narrativa al estilo del documento modelo:
// contexto del centro/comunidad → realidad observada → necesidad auténtica →
// estrategia y recorrido → producto final progresivo.
const construirSituacionNarrativa = ({
  area, tema, grado, ciclo, nivel, centro, estrategia, producto,
}) => {
  // "Centro Hector Francisco Lopez - Hato Nuevo" → comunidad "Hato Nuevo"
  const comunidad = String(centro || "").includes("-")
    ? String(centro).split("-").pop().trim()
    : "";
  const ubicacion = centro
    ? ` de ${centro}${comunidad ? `, en la comunidad de ${comunidad},` : ""}`
    : "";
  const quienes = `Los estudiantes de ${grado || "este grado"} del ${ciclo || "ciclo"} del Nivel ${nivel || "Secundario"}${ubicacion} viven realidades cotidianas marcadas por jornadas escolares intensas, responsabilidades en el hogar, actividades recreativas y momentos de convivencia familiar y comunitaria.`;

  if (ES_IDIOMA(area)) {
    const idioma = NOMBRE_IDIOMA(area);
    return `${quienes} En el aula, sin embargo, se observa que a muchos estudiantes les resulta difícil comprender y expresar en ${idioma} ideas relacionadas con "${tema}", a pesar de que forman parte de su vida diaria. Ante esta realidad, surge la necesidad auténtica de aprender a comunicarse sobre "${tema}" en ${idioma}, tanto para reflexionar sobre su propia experiencia como para compartirla con compañeros, familiares y otras personas. Mediante la estrategia de ${estrategia}, los estudiantes explorarán el vocabulario y las estructuras propias del tema; compararán sus experiencias con las de sus compañeros; y participarán en situaciones comunicativas reales de escucha, habla, lectura y escritura (listening, speaking, reading y writing) centradas en "${tema}". Como producto final, elaborarán de manera progresiva ${producto} A lo largo de la unidad, cada clase aportará una evidencia a ese producto, fortaleciendo su competencia comunicativa en ${idioma}, su autonomía, su responsabilidad personal y su vínculo con la realidad de su comunidad.`;
  }

  return `${quienes} En el aula, sin embargo, se observa que muchos estudiantes conocen "${tema}" desde la experiencia cotidiana, pero les resulta difícil explicarlo, representarlo y aplicarlo con las herramientas propias de ${area}. Ante esta realidad, surge la necesidad auténtica de comprender "${tema}" para interpretar situaciones del entorno y actuar sobre ellas. Mediante la estrategia de ${estrategia}, los estudiantes explorarán los conceptos centrales del tema, los aplicarán en situaciones concretas de su contexto y socializarán sus hallazgos con el grupo. Como producto final, elaborarán de manera progresiva ${producto} A lo largo de la unidad, cada clase aportará una evidencia a ese producto, fortaleciendo sus competencias, su autonomía y su compromiso con la realidad de su comunidad.`;
};

// Nota institucional de organización temporal (versión parametrizada del modelo)
const construirNotaInstitucional = ({ clasesPorSemana, durMin, producto }) => `Conforme al enfoque de atención a la diversidad, evaluación formativa y aprendizaje centrado en el estudiante establecido en el Diseño Curricular del Nivel Secundario del MINERD, la presente unidad organiza su tiempo en torno a un núcleo esencial de ${clasesPorSemana} clase(s) semanal(es) de ${durMin} minutos, complementado por sesiones pedagógicas flexibles que fortalecen la calidad, la pertinencia y la equidad de los aprendizajes. Dichas sesiones no representan una sobreplanificación ni un error en la distribución temporal, sino una decisión metodológica intencional orientada a responder a la diversidad del aula.
Las sesiones flexibles permiten responder a los hallazgos de la evaluación diagnóstica de inicio, habilitar procesos de recuperación pedagógica, nivelación y ampliación según los ritmos de aprendizaje, dar seguimiento continuo a los indicadores de logro y acompañar la construcción progresiva del producto final (${producto.replace(/\.$/, "")}) antes de su valoración sumativa, además de absorber los ajustes propios del calendario escolar y las dinámicas institucionales sin afectar la secuencia didáctica.
Nota: ante fallas de electricidad, internet o equipos, las actividades que usan TV, proyector o audio se realizan con las alternativas físicas del Anexo L — Plan B tecnológico (imágenes impresas, flashcards, lectura en voz alta y dramatización).`;

// Checkpoint formativo de mitad de unidad (modelo: Semana 3)
const construirCheckpointFormativo = ({ tema, producto, numSemanas }) => ({
  semana: Math.ceil((numSemanas || 4) / 2),
  indicador: `El estudiante comprende y comunica los aprendizajes centrales de "${tema}" trabajados hasta la mitad de la unidad, de forma oral y escrita.`,
  evidencia: `Producciones del portafolio de las primeras semanas y primer avance del producto final (${String(producto).replace(/\.$/, "")}).`,
  accion: "Para quienes aún no logran el indicador: reforzar con frases y ejemplos modelo, práctica guiada en parejas y revisión acompañada del avance del producto antes de la siguiente fase.",
});

// ─── Modelo curricular superior ──────────────────────────────────────────────
// Antes de entrar a las fases, DocenteOS arma una antesala curricular desde la
// malla oficial: ejes, competencias, contenidos y progresión. No copia un PDF;
// usa el patrón del documento modelo para decidir cómo consultar la malla.

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === "") return [];
  return [value];
};

const textoPlano = (value) => {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  return String(
    value.descripcion ||
    value.texto ||
    value.nombre ||
    value.titulo ||
    value.tema ||
    value.estructura ||
    value.funcion ||
    value.valor ||
    ""
  ).trim();
};

const textosUnicos = (items = []) => {
  const seen = new Set();
  const out = [];
  for (const raw of toArray(items)) {
    const texto = textoPlano(raw);
    const key = texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (!texto || seen.has(key)) continue;
    seen.add(key);
    out.push(texto);
  }
  return out;
};

const extraerEjemplos = (items = []) => toArray(items).flatMap((item) => {
  if (typeof item === "string") return [item];
  if (!item || typeof item !== "object") return [];
  if (Array.isArray(item.ejemplos)) return item.ejemplos;
  if (Array.isArray(item.items)) return item.items;
  return [textoPlano(item)].filter(Boolean);
});

const construirBloquesContenidoMalla = (payload = {}) => {
  const conceptos = payload.contenidos?.conceptos || {};
  const procedimientos = payload.contenidos?.procedimientos || {};
  const generales = payload.contenidosGenerales || {};
  const actitudes = textosUnicos([
    ...toArray(generales.actitudinales),
    ...toArray(generales.actitudesValores),
    ...toArray(payload.contenidos?.actitudinales),
    ...toArray(payload.contenidos?.actitudesValores),
  ]);

  return {
    temas: textosUnicos([
      ...toArray(payload.temas),
      ...toArray(payload.temasCurriculares),
      ...toArray(conceptos.temas),
    ]),
    frases: textosUnicos([
      ...extraerEjemplos(conceptos.frases),
      ...extraerEjemplos(conceptos.expresiones),
      ...toArray(payload.frases),
      ...toArray(payload.expresiones),
    ]),
    vocabulario: textosUnicos([
      ...extraerEjemplos(conceptos.vocabulario),
      ...extraerEjemplos(payload.vocabulario),
    ]),
    gramatica: textosUnicos([
      ...toArray(conceptos.gramatica),
      ...toArray(conceptos.gramática),
      ...toArray(payload.gramatica),
      ...toArray(payload.gramática),
    ]),
    procedimientosFuncionales: textosUnicos([
      ...toArray(procedimientos.funcionales),
      ...toArray(procedimientos.items),
      ...toArray(generales.procedimentales),
      ...toArray(payload.funcionesComunicativas),
    ]),
    procedimientosDiscursivos: textosUnicos([
      ...toArray(procedimientos.discursivos),
      ...toArray(procedimientos.discurso),
      ...toArray(procedimientos.comprension),
      ...toArray(procedimientos.produccion),
    ]),
    actitudesValores: actitudes,
    conceptuales: textosUnicos([
      ...toArray(generales.conceptuales),
      ...toArray(conceptos.items),
      ...toArray(conceptos.temas),
      ...extraerEjemplos(conceptos.frases),
      ...extraerEjemplos(conceptos.vocabulario),
      ...toArray(conceptos.gramatica),
    ]),
  };
};

const agruparIndicadoresPorCompetencia = (allComps = [], allInds = []) => {
  const indicadoresPlanos = toArray(allInds);
  return toArray(allComps).map((comp, index) => {
    const compId = comp.id || comp.codigo || "";
    const propios = toArray(comp.indicadoresLogro || comp.indicadores);
    const relacionados = propios.length
      ? propios
      : indicadoresPlanos.filter((ind) =>
          compId && String(ind.competenciaId || ind.competencia || "").trim() === String(compId).trim()
        );
    return {
      competenciaFundamental: textoPlano(comp.competenciaFundamental || comp.fundamental) || "",
      especifica: textoPlano(comp.especificaGrado || comp.especifica || comp.descripcion || comp.description),
      indicadores: textosUnicos(relacionados),
      orden: index + 1,
    };
  }).filter((item) => item.especifica || item.indicadores.length);
};

const construirProgresionCurricularSuperior = ({ payload = {}, titulo, producto, allComps = [], allInds = [] }) => {
  const bloques = construirBloquesContenidoMalla(payload);
  const temasBase = bloques.temas.length ? bloques.temas : textosUnicos([titulo]);
  const funciones = bloques.procedimientosFuncionales;
  const actitudes = bloques.actitudesValores;
  const indicadores = textosUnicos(allInds);

  return temasBase.map((tema, index) => ({
    tema,
    focoConceptual: textosUnicos([
      bloques.vocabulario[index],
      bloques.frases[index],
      bloques.gramatica[index],
      bloques.conceptuales[index],
    ]).slice(0, 4),
    procedimientos: textosUnicos([
      funciones[index],
      funciones[index + temasBase.length],
      bloques.procedimientosDiscursivos[index],
    ]).slice(0, 4),
    actitudesValores: textosUnicos([
      actitudes[index],
      actitudes[index + temasBase.length],
    ]).slice(0, 3),
    evidenciasEsperadas: textosUnicos([
      indicadores[index],
      `Producción oral o escrita vinculada a "${tema}" como aporte progresivo al producto final (${String(producto).replace(/\.$/, "")}).`,
    ]).slice(0, 3),
    competenciasRelacionadas: agruparIndicadoresPorCompetencia(allComps, allInds)
      .filter((_, i) => i === index || i % Math.max(1, temasBase.length) === index)
      .slice(0, 2)
      .map((c) => c.competenciaFundamental || `Competencia ${c.orden}`),
  }));
};

const construirModeloCurricularSuperior = ({
  payload = {}, titulo, area, estrategia, producto, ejes = [], allComps = [], allInds = [],
}) => {
  const bloques = construirBloquesContenidoMalla(payload);
  const competencias = agruparIndicadoresPorCompetencia(allComps, allInds);
  const ejesOficiales = toArray(payload.ejesTransversales).length
    ? toArray(payload.ejesTransversales).map((eje) => ({
        nombre: textoPlano(eje.eje || eje.nombre || eje.titulo) || "Eje transversal",
        descripcion: textoPlano(eje.descripcion || eje.texto || eje.contenido) || textoPlano(eje),
      })).filter((eje) => eje.nombre || eje.descripcion)
    : construirEjesContextualizados(ejes, { area, tema: titulo });

  return {
    fuente: payload.fuente || payload.ministerio || "MINERD",
    versionCurriculo: payload.versionCurriculo || payload.version || payload.schemaVersion || "",
    nivelMCERL: payload.nivelMCERL || payload.nivelDominio || "",
    estrategia,
    productoFinal: producto,
    ejes: ejesOficiales,
    competencias,
    contenidos: {
      temas: bloques.temas,
      frases: bloques.frases,
      vocabulario: bloques.vocabulario,
      gramatica: bloques.gramatica,
      procedimientosFuncionales: bloques.procedimientosFuncionales,
      procedimientosDiscursivos: bloques.procedimientosDiscursivos,
      actitudesValores: bloques.actitudesValores,
    },
    contenidosSintesis: {
      conceptuales: textosUnicos([
        ...bloques.temas,
        ...bloques.frases,
        ...bloques.vocabulario,
        ...bloques.gramatica,
        ...bloques.conceptuales,
      ]),
      procedimentales: textosUnicos([
        ...bloques.procedimientosFuncionales,
        ...bloques.procedimientosDiscursivos,
      ]),
      actitudinales: bloques.actitudesValores,
    },
    progresion: construirProgresionCurricularSuperior({ payload, titulo, producto, allComps, allInds }),
  };
};

// ─── Anexos A-L (parametrizados según el documento modelo) ───────────────────

const construirAnexosUnidad = ({ area, tema, producto, vocabulario = [], fases = [], numSemanas = 4 }) => {
  const idioma = ES_IDIOMA(area);
  const nombreIdioma = NOMBRE_IDIOMA(area);
  const productoCorto = String(producto).replace(/\.$/, "");

  const rubricaProducto = [
    { criterio: `Contenido (${tema})`, n4: "Desarrolla el tema de forma completa, con detalles y orden.", n3: "Desarrolla la mayoría de los elementos del tema.", n2: "Desarrolla algunos elementos de forma básica.", n1: "Menciona pocos elementos sin orden." },
    { criterio: idioma ? `Uso del ${nombreIdioma} (gramática)` : "Uso del lenguaje del área", n4: "Usa las estructuras y el vocabulario trabajados correctamente.", n3: "Usa las estructuras con errores menores.", n2: "Usa las estructuras con errores frecuentes.", n1: "Construcción de ideas muy limitada." },
    { criterio: "Integración de los contenidos de la unidad", n4: "Integra todos los bloques de la unidad con recomendaciones propias.", n3: "Integra la mayoría de los bloques trabajados.", n2: "Integra los contenidos de forma parcial.", n1: "No integra los contenidos de la unidad." },
    { criterio: "Diseño y organización", n4: "Producto claro y ordenado, con título, secciones e imágenes.", n3: "Producto ordenado con título y secciones.", n2: "Producto con organización parcial.", n1: "Producto desordenado o incompleto." },
    { criterio: "Presentación oral", n4: "Presenta con fluidez, volumen y contacto visual.", n3: "Presenta con claridad y pocos titubeos.", n2: "Presenta con apoyo y pausas frecuentes.", n1: "Presenta con mucha dificultad." },
    { criterio: "Riqueza de vocabulario", n4: "Usa vocabulario variado y preciso de la unidad.", n3: "Usa vocabulario adecuado con alguna repetición.", n2: "Usa vocabulario básico y repetitivo.", n1: "Vocabulario muy limitado." },
    { criterio: "Claridad comunicativa", n4: "El mensaje se entiende sin esfuerzo; las ideas fluyen con orden.", n3: "El mensaje se entiende con poco esfuerzo.", n2: "El mensaje se entiende con esfuerzo del interlocutor.", n1: "El mensaje es difícil de entender." },
    { criterio: "Interacción (responde preguntas)", n4: "Responde con seguridad y amplía sus respuestas.", n3: "Responde correctamente las preguntas.", n2: "Responde con apoyo o respuestas muy breves.", n1: "No logra responder." },
    { criterio: "Creatividad y presentación visual", n4: "Producto original y atractivo; integra imágenes propias y diseño cuidado.", n3: "Producto atractivo con imágenes pertinentes.", n2: "Producto con elementos visuales básicos.", n1: "Producto sin recursos visuales." },
    ...(idioma ? [{ criterio: "Pronunciación e inteligibilidad", n4: "Pronuncia de forma clara y comprensible durante toda la presentación.", n3: "Pronuncia de forma comprensible con errores menores.", n2: "La pronunciación dificulta a veces la comprensión.", n1: "La pronunciación dificulta mucho la comprensión." }] : []),
  ];

  const listaCotejoOral = idioma ? [
    `Saluda y responde preguntas iniciales en ${nombreIdioma}.`,
    `Describe los contenidos de "${tema}" usando las estructuras trabajadas.`,
    "Usa el vocabulario y las expresiones de la unidad.",
    "Formula y responde preguntas sobre el tema.",
    "Da recomendaciones o sugerencias relacionadas con el tema.",
    "Interactúa con cortesía y respeto con sus compañeros.",
  ] : [
    "Participa activamente en las actividades de la clase.",
    `Explica con sus palabras los contenidos centrales de "${tema}".`,
    "Usa el vocabulario técnico del área con propiedad.",
    "Formula y responde preguntas sobre el tema.",
    "Relaciona el tema con situaciones de su entorno.",
    "Interactúa con cortesía y respeto con sus compañeros.",
  ];

  const registroAnecdotico = {
    columnas: ["Fecha", "Estudiante", "Situación observada", "Interpretación / Acción de mejora"],
    ejemplo: [
      "(ejemplo)",
      "Estudiante A",
      `Durante la actividad en parejas explicó el tema con seguridad, pero omitió pasos clave de "${tema}".`,
      "Comprende la idea general; reforzar con práctica guiada breve y verificar en la próxima clase.",
    ],
  };

  const autoevaluacion = idioma ? [
    `...describe "${tema}" in ${area === "Francés" ? "French" : "English"}.`,
    "...use the unit vocabulary and structures.",
    "...ask and answer questions about the topic.",
    "...give advice or suggestions about the topic.",
    `...present my ${productoCorto.toLowerCase().includes("poster") ? "poster" : "final product"} to my classmates.`,
  ] : [
    `...explicar los conceptos centrales de "${tema}".`,
    "...usar el vocabulario del área correctamente.",
    "...aplicar lo aprendido en situaciones de mi entorno.",
    "...trabajar en equipo y valorar los aportes de mis compañeros.",
    "...presentar mi producto final al grupo.",
  ];

  const glosario = (vocabulario || []).slice(0, 16).map((termino) => ({
    termino: String(termino),
    traduccion: "",
  }));

  const sentenceStarters = idioma ? [
    { funcion: "Describir / Informar", starter: "This is... / It has... / There is / There are..." },
    { funcion: "Hablar de mi experiencia", starter: "I usually... / In my case... / Every day, I..." },
    { funcion: "Preguntar", starter: "What...? / When...? / How often...? / Can you...?" },
    { funcion: "Sugerir", starter: "Let's... / We should... / How about...?" },
    { funcion: "Ofrecer ayuda", starter: "Can I help you...? / I can... / Let me help you..." },
    { funcion: "Secuenciar ideas", starter: "First... / Then... / After that... / Finally..." },
  ] : [
    { funcion: "Describir / Informar", starter: "Se trata de... / Está formado por... / Observamos que..." },
    { funcion: "Explicar", starter: "Esto ocurre porque... / La razón es... / Por lo tanto..." },
    { funcion: "Preguntar", starter: "¿Qué...? / ¿Cuándo...? / ¿Por qué...? / ¿Cómo...?" },
    { funcion: "Proponer", starter: "Podríamos... / Sugiero que... / Una alternativa es..." },
    { funcion: "Comparar", starter: "A diferencia de... / Ambos... / Mientras que..." },
    { funcion: "Concluir", starter: "En resumen... / Aprendimos que... / Lo más importante fue..." },
  ];

  const rangoSemanas = (fase) => {
    const semanas = [...new Set((fase.dias || []).map((d) => d.semana).filter(Boolean))];
    if (!semanas.length) return "";
    const min = Math.min(...semanas);
    const max = Math.max(...semanas);
    return min === max ? `Semana ${min}` : `Semanas ${min}-${max}`;
  };
  const checklistProducto = [
    ...(fases || []).map((fase) => ({
      paso: `Aporte de la Fase ${fase.numero}: ${fase.nombre}`,
      semana: rangoSemanas(fase),
    })),
    { paso: `Presentación final: ${productoCorto}`, semana: `Semana ${numSemanas}` },
  ];

  const organizadorProducto = [
    { seccion: "Título", incluye: `Mi nombre y el título del producto (${productoCorto}).` },
    ...(fases || []).map((fase) => ({
      seccion: `Fase ${fase.numero} — ${fase.nombre}`,
      incluye: "Las evidencias y oraciones clave elaboradas en esta fase.",
    })),
    { seccion: "Cierre", incluye: "Una reflexión o recomendación final relacionada con el tema." },
  ];

  const diagnostica = idioma ? [
    { habilidad: "Listening (Escuchar)", tarea: `El docente lee o reproduce oraciones sencillas sobre "${tema}"; el estudiante marca en imágenes lo que escucha.`, criterio: "Identifica 4-5 elementos = listo; 2-3 = en proceso; 0-1 = requiere apoyo intensivo de vocabulario." },
    { habilidad: "Speaking (Hablar)", tarea: `El estudiante responde oralmente preguntas básicas sobre "${tema}".`, criterio: "Responde con oraciones completas = listo; con palabras sueltas = en proceso; no responde en el idioma = requiere apoyo." },
    { habilidad: "Reading (Leer)", tarea: `El estudiante lee un texto breve (3-4 oraciones) sobre "${tema}" y responde dos preguntas de comprensión.`, criterio: "Responde ambas correctamente = listo; una = en proceso; ninguna = requiere apoyo lector." },
    { habilidad: "Writing (Escribir)", tarea: `El estudiante escribe tres oraciones sobre "${tema}" usando las estructuras básicas.`, criterio: "Tres oraciones con estructura clara = listo; una o dos con errores = en proceso; no logra estructurar = requiere apoyo." },
  ] : [
    { habilidad: "Comprensión oral", tarea: `El docente presenta una situación breve sobre "${tema}"; el estudiante identifica las ideas principales.`, criterio: "Identifica las ideas centrales = listo; parcialmente = en proceso; no las identifica = requiere apoyo." },
    { habilidad: "Expresión oral", tarea: `El estudiante explica con sus palabras lo que sabe de "${tema}".`, criterio: "Explica con claridad = listo; con apoyo = en proceso; no logra explicar = requiere apoyo." },
    { habilidad: "Lectura", tarea: `El estudiante lee un texto breve del área y responde dos preguntas de comprensión.`, criterio: "Responde ambas = listo; una = en proceso; ninguna = requiere apoyo lector." },
    { habilidad: "Producción escrita", tarea: `El estudiante escribe tres ideas sobre "${tema}".`, criterio: "Tres ideas claras = listo; una o dos = en proceso; ninguna = requiere apoyo." },
  ];

  const neaePorPerfil = [
    { perfil: "Ritmo de aprendizaje más lento", acceso: "Dar más tiempo, fragmentar las tareas en pasos cortos, usar frases modelo y apoyos visuales.", evaluacion: "Reducir el número de producciones exigidas, permitir banco de palabras y valorar el avance personal." },
    { perfil: "Dificultad en la lectura", acceso: "Leer las consignas en voz alta, usar textos breves con imágenes y resaltar palabras clave.", evaluacion: "Permitir respuestas orales o con imágenes; evaluar la comprensión sin penalizar la velocidad lectora." },
    { perfil: "Dificultad de atención", acceso: "Ubicar cerca del docente, dar instrucciones cortas una a la vez y alternar actividades.", evaluacion: "Evaluar en tramos cortos, verificar comprensión con preguntas directas y permitir pausas." },
    { perfil: "Dificultad en la expresión oral", acceso: "Practicar con frases modelo y diálogos guiados; permitir ensayo previo en parejas y apoyos visuales.", evaluacion: "Valorar la intención comunicativa más que la perfección; permitir grabaciones." },
    { perfil: "Estudiantes avanzados", acceso: "Asignar retos adicionales, rol de tutor par y tareas de creación.", evaluacion: "Evaluar con criterios de mayor complejidad: riqueza de vocabulario, creatividad e interacción ampliada." },
  ];

  const planB = [
    { recurso: "TV / proyector (imágenes y videos)", alternativa: "Imágenes impresas, flashcards y dibujos en la pizarra." },
    { recurso: "Audio / bocinas (escucha con propósito)", alternativa: "El docente lee el texto en voz alta; los estudiantes dramatizan o leen diálogos en parejas." },
    { recurso: "Presentación digital / diapositivas", alternativa: "Carteles, papelógrafos o esquemas en la pizarra preparados con anticipación." },
    { recurso: "Dispositivos para grabar presentaciones", alternativa: "Presentación en vivo ante el grupo y coevaluación con rúbrica impresa." },
    { recurso: "Videos modelo", alternativa: "Lectura de un texto modelo impreso o demostración actuada por el docente." },
  ];

  return {
    rubricaProducto,
    listaCotejoOral,
    registroAnecdotico,
    twoStars: true,
    autoevaluacion,
    glosario,
    sentenceStarters,
    checklistProducto,
    organizadorProducto,
    diagnostica,
    neaePorPerfil,
    planB,
  };
};

// ─── Generador de momentos por día ────────────────────────────────────────────

// ─── Banco temático para Inglés — Retroalimentación y Recuperación narrativa ──

const _BANCO_TEMAS_INGLES = [
  {
    test: /rutina|routine|daily life|vida diaria|daily routine|my life|actividades diarias/i,
    preguntas: [
      ["What time do you wake up?", "What do you do before going to school?"],
      ["What do you do after school?", "What time do you have lunch?"],
      ["What do you do in the evenings?", "What time do you go to bed?"],
      ["What do you do on weekends?", "Do you have a morning routine?"],
    ],
    vocabulario: [
      "wake up, brush teeth, have breakfast, go to school",
      "have lunch, do homework, have dinner, go to bed",
      "morning, afternoon, evening, always, usually, sometimes",
      "daily activities, parts of the day, time expressions, daily schedule",
    ],
    temaHoy: [
      "actividades cotidianas y vocabulario de rutinas diarias",
      "actividades diarias y partes del día",
      "expresiones de tiempo y la rutina del hogar",
      "la rutina completa y los elementos del producto final",
    ],
    temaAnterior: [
      "las actividades cotidianas exploradas en la clase anterior",
      "el vocabulario de rutinas y las actividades de la mañana",
      "las expresiones de tiempo y la rutina escolar",
      "las actividades del hogar y los fines de semana",
    ],
  },
  {
    test: /greet|salud|introduc|hello|hi\b|presentation|presentaci/i,
    preguntas: [
      ["How are you today?", "What's your name?"],
      ["Where are you from?", "How old are you?"],
      ["What do you like to do?", "Do you have brothers or sisters?"],
      ["What is your favorite subject?", "What do you want to be when you grow up?"],
    ],
    vocabulario: [
      "hello, good morning, my name is, nice to meet you",
      "I'm from, I'm _ years old, I live in",
      "I like, I don't like, my favorite is, pleased to meet you",
      "greetings, introductions, personal information, formal and informal expressions",
    ],
    temaHoy: [
      "saludos y presentaciones básicas en inglés",
      "información personal y expresiones de presentación",
      "descripciones personales y preferencias",
      "presentaciones formales e informales en inglés",
    ],
    temaAnterior: [
      "los saludos y expresiones básicas de presentación",
      "el vocabulario de información personal",
      "las descripciones y preferencias personales",
      "las presentaciones formales e informales",
    ],
  },
  {
    test: /famil|family|relatives|mi familia/i,
    preguntas: [
      ["How many people are in your family?", "Who is in your family?"],
      ["What does your mother or father do?", "How old is your grandmother?"],
      ["What do you do together as a family?", "Who lives in your house?"],
      ["What is your family like?", "What traditions does your family have?"],
    ],
    vocabulario: [
      "mother, father, brother, sister, grandmother, grandfather",
      "aunt, uncle, cousin, family members, relatives",
      "tall, short, young, old, kind, funny, hard-working",
      "family activities, traditions, household chores, roles",
    ],
    temaHoy: [
      "los miembros de la familia y el vocabulario familiar en inglés",
      "descripciones físicas y de personalidad de los familiares",
      "las actividades familiares y las rutinas del hogar",
      "la familia y las relaciones interpersonales",
    ],
    temaAnterior: [
      "el vocabulario básico de los miembros de la familia",
      "los nombres y roles de los familiares",
      "las descripciones de los miembros de la familia",
      "las actividades y rutinas familiares",
    ],
  },
  {
    test: /food|comida|nutrition|nutrici|healthy|saludable|eat|comer|meal|aliment/i,
    preguntas: [
      ["What did you have for breakfast today?", "What is your favorite food?"],
      ["What do you eat for lunch?", "Do you like vegetables?"],
      ["What is a healthy meal?", "How often do you eat fruit?"],
      ["What food is popular in your community?", "What are the benefits of healthy eating?"],
    ],
    vocabulario: [
      "fruit, vegetables, bread, rice, chicken, water, juice",
      "breakfast, lunch, dinner, snack, meal",
      "delicious, healthy, sweet, salty, fresh, tasty",
      "nutrition, balanced diet, food groups, healthy habits",
    ],
    temaHoy: [
      "el vocabulario de alimentos y comidas del día",
      "los grupos alimenticios y los hábitos saludables",
      "las preferencias alimenticias y las descripciones de comidas",
      "la nutrición y la alimentación equilibrada",
    ],
    temaAnterior: [
      "el vocabulario básico de alimentos y comidas",
      "los alimentos y las comidas del día",
      "los hábitos alimenticios y los grupos de alimentos",
      "las preferencias y descripciones de comidas",
    ],
  },
  {
    test: /weather|clima|season|estaci|temperature|temperatura/i,
    preguntas: [
      ["What's the weather like today?", "What is your favorite season?"],
      ["What do you wear when it rains?", "What do you do on a sunny day?"],
      ["How does the weather affect what you do?", "What is the weather usually like in your town?"],
      ["What season is it now?", "How has the weather changed recently?"],
    ],
    vocabulario: [
      "sunny, rainy, cloudy, windy, hot, cold, warm",
      "spring, summer, autumn, winter, season",
      "umbrella, raincoat, sweater, sunscreen, boots",
      "temperature, forecast, climate, natural events",
    ],
    temaHoy: [
      "el vocabulario del tiempo y las condiciones climáticas",
      "las estaciones del año y las actividades relacionadas",
      "las descripciones del tiempo y su impacto en la vida diaria",
      "el clima, el medio ambiente y los cambios estacionales",
    ],
    temaAnterior: [
      "el vocabulario básico del tiempo y las condiciones climáticas",
      "los tipos de tiempo y el vocabulario de las estaciones",
      "las estaciones y las actividades según el clima",
      "las condiciones climáticas y su impacto cotidiano",
    ],
  },
  {
    test: /body|cuerpo|body parts|partes del cuerpo/i,
    preguntas: [
      ["Can you name five parts of the body in English?", "What do you use your hands for?"],
      ["What do you do to keep your body healthy?", "How many times a day do you brush your teeth?"],
      ["What do you do when you feel sick?", "Why is it important to exercise?"],
      ["How do you take care of your body?", "What healthy habits do you practice every day?"],
    ],
    vocabulario: [
      "head, shoulders, arms, legs, hands, feet, eyes, nose, mouth",
      "healthy, sick, exercise, rest, hygiene, nutrition",
      "doctor, medicine, hospital, feelings, symptoms",
      "body systems, health habits, physical activity, well-being",
    ],
    temaHoy: [
      "las partes del cuerpo y el vocabulario de salud en inglés",
      "los hábitos de higiene y el cuidado personal",
      "la salud, el ejercicio y los hábitos saludables",
      "el cuerpo humano y la salud integral",
    ],
    temaAnterior: [
      "el vocabulario básico de las partes del cuerpo",
      "las partes del cuerpo y los hábitos de higiene",
      "los hábitos saludables y el cuidado físico",
      "la salud y los hábitos de vida saludable",
    ],
  },
  {
    test: /school|escuela|community|comunidad|classroom|aula|places|lugares/i,
    preguntas: [
      ["What is your school like?", "What is your favorite subject?"],
      ["What places are in your community?", "Where do you go after school?"],
      ["What do you like most about your school?", "What is special about your community?"],
      ["How do people help each other in your community?", "What places are important in your town?"],
    ],
    vocabulario: [
      "classroom, teacher, student, school, subjects, schedule",
      "library, cafeteria, gym, playground, office, hall",
      "community, neighborhood, park, market, church, town",
      "places, buildings, community helpers, local services",
    ],
    temaHoy: [
      "el vocabulario de la escuela y las aulas en inglés",
      "los lugares de la comunidad y su descripción",
      "la escuela, la comunidad y los servicios locales",
      "la comunidad y las personas que la conforman",
    ],
    temaAnterior: [
      "el vocabulario básico de la escuela y las materias",
      "los lugares de la escuela y la comunidad cercana",
      "los lugares y las personas de la comunidad",
      "la escuela y la comunidad local",
    ],
  },
];

const _getBancoTemaIngles = (tema) => {
  for (const banco of _BANCO_TEMAS_INGLES) {
    if (banco.test.test(tema)) return banco;
  }
  return null;
};

const _getActsInicioIngles = (tema, fasePos, diaNum, mc = {}) => {
  const vSlice = (n) => mc.vocabulario?.slice(n, n + 4).join(', ') || `vocabulario de "${tema}"`;

  if (fasePos === 0 && diaNum === 0) {
    return [
      `**Responden** al saludo e indicaciones iniciales. _("Good morning, everyone! How are you today? Are you ready to start our new unit?")_`,
      `**Observan** imágenes o recursos relacionados con "${tema}" y **expresan** en inglés palabras o frases que ya **conocen**. **Organizan** el vocabulario en la pizarra como banco inicial de la unidad.`,
      `**Recuperan** saberes previos: _¿qué palabras en inglés conocen relacionadas con "${tema}"?_ Vocabulario esperado: _${vSlice(0)}_.`,
      `**Escuchan** la intención pedagógica de la unidad, el producto final y el propósito de aprender sobre "${tema}".`,
    ];
  }

  return [
    `**Responden** al saludo e indicaciones iniciales en inglés. _("Good morning! How are you today?")_`,
    `**Retroalimentan** la sesión anterior sobre "${tema}" respondiendo preguntas orales breves: _¿qué palabras o estructuras recuerdan?_`,
    `**Recuperan** saberes previos activando vocabulario relacionado con "${tema}". Vocabulario de activación: _${vSlice(fasePos * 4)}_.`,
    `**Escuchan** la intención pedagógica y el propósito de la clase de hoy.`,
  ];
};

const getActsInicio = (area, tema, fasePos, diaNum, mc = {}) => {
  if (area === "Inglés") return _getActsInicioIngles(tema, fasePos, diaNum, mc);

  const variantes = {
    "Inglés": [
      // Variante 0 — Fase 1 (Presentación): LISTENING + SPEAKING diagnóstico
      [
        `**Responden** al saludo e indicaciones iniciales en inglés. _({expr_saludo})_`,
        `**Escuchan** un audio corto o diálogo sobre "${tema}". **Identifican** el tema general, palabras que **reconocen** y expresiones claves. _({expr_comprension_listening})_`,
        `**Recuperan** saberes previos oralmente: **responden** libremente las preguntas sobre "${tema}". _(What do you already know about ${tema}? Have you seen or used this before?)_`,
        `**Expresan** en inglés qué **saben** y qué **quisieran** aprender sobre "${tema}" usando palabras simples, frases o gestos. _(I know... / I think... / I want to learn...)_`,
        `**Escuchan** el objetivo comunicativo de la sesión y el tipo de producción que **realizarán** al finalizar.`,
      ],
      // Variante 1 — Fase 2 (Desarrollo): READING + GRAMMAR awareness
      [
        `**Responden** al saludo e indicaciones iniciales en inglés y **retroalimentan** la sesión anterior sobre "${tema}". _({expr_saludo})_`,
        `**Leen** un texto corto relacionado con "${tema}". **Identifican**: _palabras conocidas, palabras nuevas e idea principal_. _({expr_comprension_reading})_`,
        `**Analizan** las estructuras gramaticales presentes en el texto de "${tema}". _({expr_gramatica})_`,
        `**Relacionan** las estructuras del texto con situaciones reales del entorno. **Formulan** 1–2 oraciones propias usando el patrón identificado sobre "${tema}".`,
        `**Escuchan** el objetivo gramatical-comunicativo del día y se **preparan** para la práctica de la sesión.`,
      ],
      // Variante 2 — Fase 3 (Profundización): WRITING + VOCABULARY + Speaking
      [
        `**Responden** al saludo e indicaciones iniciales en inglés. _({expr_saludo})_`,
        `**Demuestran** vocabulario de "${tema}" en un reto de activación rápida. _({expr_vocabulario})_`,
        `**Revisan** y **amplían** el vocabulario de "${tema}": **registran** palabras nuevas con definición en contexto y las **usan** en oraciones propias orales y escritas.`,
        `**Escriben** individualmente 3–5 oraciones o un párrafo corto sobre "${tema}" **aplicando** estructuras y vocabulario trabajados. **Utilizan** modelos como referencia.`,
        `**Comparten** su producción con un compañero para revisión rápida y se **preparan** para la actividad de escritura o producción oral principal de la sesión. _({expr_parejas})_`,
      ],
    ],
    "Matemática": [
      [
        `**Responden** al saludo e indicaciones iniciales.`,
        `**Retroalimentan** la clase anterior **compartiendo** en parejas las respuestas de la tarea asignada.`,
        `**Recuperan** o **exploran** saberes previos: **resuelven** 2–3 ejercicios rápidos de cálculo mental vinculados a "${tema}".`,
        `**Observan** un problema de la vida real relacionado con "${tema}" y **expresan** sus ideas iniciales oralmente.`,
        `**Escuchan** la intención pedagógica y el propósito de la sesión.`,
      ],
      [
        `**Responden** al saludo e indicaciones iniciales y **revisan** brevemente la tarea anterior.`,
        `**Retroalimentan** los aprendizajes previos **respondiendo** preguntas: _¿Qué recuerdan de ${tema}? ¿Dónde lo han visto en la vida cotidiana?_`,
        `**Recuperan** saberes previos **participando** en una dinámica de activación: _reto matemático, adivinanza numérica o situación gráfica vinculada a "${tema}"_.`,
        `**Expresan** sus observaciones e hipótesis iniciales sobre el contenido del día de manera oral.`,
        `**Escuchan** el objetivo del día y la relevancia de "${tema}" en situaciones cotidianas.`,
      ],
      [
        `**Responden** al saludo e indicaciones iniciales.`,
        `**Retroalimentan** la clase anterior: tres voluntarios **comparten** algo aprendido sobre el tema trabajado previamente.`,
        `**Recuperan** saberes previos **explorando** una situación desafiante. _¿Qué sabemos sobre ${tema}? ¿Cómo lo podemos aplicar?_`,
        `**Expresan** sus ideas, razonamientos y estrategias previas ante el problema o situación planteada.`,
        `**Registran** el objetivo del día en su cuaderno y **escuchan** la intención pedagógica de la sesión.`,
      ],
    ],
    "Lengua Española": [
      [
        `**Responden** al saludo e indicaciones iniciales.`,
        `**Retroalimentan** la clase anterior **compartiendo** ideas o producciones relacionadas con "${tema}".`,
        `**Recuperan** o **exploran** saberes previos: **observan** un texto, imagen o situación comunicativa y **expresan** lo que **saben** sobre "${tema}".`,
        `**Expresan** oralmente sus experiencias e ideas **relacionando** el contenido con situaciones de su entorno cotidiano.`,
        `**Escuchan** la intención pedagógica y el propósito de la clase.`,
      ],
      [
        `**Responden** al saludo e indicaciones iniciales y **revisan** brevemente la tarea anterior.`,
        `**Retroalimentan** los aprendizajes previos **respondiendo** preguntas sobre "${tema}".`,
        `**Recuperan** saberes previos **participando** en una dinámica de activación: _lluvia de ideas, asociación de palabras o lectura de una oración motivadora_.`,
        `**Expresan** sus ideas y predicciones sobre el contenido del día de manera oral y/o escrita.`,
        `**Escuchan** el objetivo de la sesión y **registran** la intención pedagógica en su cuaderno.`,
      ],
      [
        `**Responden** al saludo e indicaciones iniciales.`,
        `**Retroalimentan** la clase anterior: voluntarios **comparten** algo que **aprendieron** o **produjeron** relacionado con "${tema}".`,
        `**Recuperan** saberes previos **explorando** un recurso textual o visual y **expresan** sus observaciones.`,
        `**Expresan** con sus propias palabras qué **saben** sobre "${tema}" y **formulan** preguntas sobre lo que **desean** aprender.`,
        `**Escuchan** la intención pedagógica y el propósito de la sesión.`,
      ],
    ],
  };

  if (variantes[area]) {
    const acts = variantes[area][fasePos % variantes[area].length];
    // Inglés y Francés: inyectar expresiones del banco para variación diaria
    if (area === "Inglés") return inyectarExpresiones(acts, diaNum, "en");
    if (area === "Francés") return inyectarExpresiones(acts, diaNum, "fr");
    return acts;
  }

  // Banco Pedagógico Firestore (oficial) tiene prioridad
  const bpActsInicio = obtenerBPActs(area, "Inicio", diaNum);
  if (bpActsInicio) return withTema(bpActsInicio, tema);

  // Banco especializado estático como fallback
  const bankActs = obtenerActividadesBanco(area, "Inicio", fasePos, diaNum);
  if (bankActs) return withTema(bankActs, tema);

  // Fallback genérico
  const generic = [
    [
      `**Responden** al saludo e indicaciones iniciales.`,
      `**Recuperan** saberes previos **explorando** una situación o pregunta diagnóstica sobre "${tema}" para **identificar** lo que **saben** y lo que necesitan aprender.`,
      `**Expresan** y **clasifican** sus conocimientos previos sobre "${tema}": _¿Qué sé? / ¿Qué creo? / ¿Qué no sé?_`,
      `**Formulan** preguntas o hipótesis iniciales que **guiarán** su aprendizaje durante la sesión.`,
      `**Escuchan** la intención pedagógica y el propósito de aprendizaje de la sesión.`,
    ],
    [
      `**Responden** al saludo e indicaciones iniciales.`,
      `**Retroalimentan** los aprendizajes **construidos** en la sesión anterior sobre "${tema}" y los **conectan** con el nuevo contenido del día.`,
      `**Participan** en una dinámica de activación y se **preparan** para la construcción de nuevos conocimientos sobre "${tema}".`,
      `**Formulan** hipótesis o predicciones sobre el contenido del día y se **preparan** para verificarlas durante el desarrollo.`,
      `**Escuchan** el objetivo del día y la conexión con la situación de aprendizaje de la unidad.`,
    ],
    [
      `**Responden** al saludo e indicaciones iniciales.`,
      `**Demuestran** sus aprendizajes sobre "${tema}" **respondiendo** preguntas de nivel aplicado: _¿Cómo usarías esto? ¿Dónde lo ves en la vida real?_`,
      `**Relacionan** lo aprendido en fases anteriores con el desafío de aplicación que **abordarán** hoy en "${tema}".`,
      `**Establecen** sus metas de desempeño para la sesión: _¿Qué quiero lograr hoy? ¿Cómo sabré que lo logré?_`,
      `**Escuchan** y **registran** la intención pedagógica y el propósito de la sesión.`,
    ],
  ];
  return generic[fasePos % generic.length];
};

const _getActsDesarrolloIngles = (tema, fasePos, diaNum, mc = {}) => {
  const vSlice = (n, k = 4) => mc.vocabulario?.slice(n, n + k).join(', ') || `vocabulario de "${tema}"`;
  const gram0  = mc.gramatica?.[0] || `estructuras gramaticales de "${tema}"`;

  // Fase 0 — Presentación: vocabulario + speaking oral
  if (fasePos === 0) {
    const v0 = vSlice(0);
    return [
      `**Observan** vocabulario clave de "${tema}" con imágenes o recursos visuales. **Repiten** cada palabra en coro y luego individualmente, cuidando pronunciación.`,
      `**Practican** en parejas señalando y describiendo en inglés lo que ven: _Point and say what you see. Describe it in English._ Vocabulario: _${v0}_.`,
      `**Realizan** actividad de asociación: _relacionan el vocabulario de "${tema}" con imágenes o descripciones_. **Verifican** con el compañero y **corrigen** errores juntos.`,
      `**Elaboran** 3–5 oraciones completas sobre "${tema}" siguiendo el modelo presentado. Vocabulario trabajado: _${v0}_.`,
    ];
  }

  // Fase 1 — Desarrollo: lectura + gramática en contexto
  if (fasePos === 1) {
    const v1 = vSlice(4);
    return [
      `**Leen** un texto corto sobre "${tema}" y **responden** preguntas de comprensión: _literal, inferencial e interpretativo_.`,
      `**Analizan** la estructura gramatical del texto relacionado con "${tema}": _identifican el patrón, lo nombran y explican su función_. Estructura trabajada: _${gram0}_.`,
      `**Practican** en ejercicios contextualizados: _completan oraciones, transforman ejemplos y construyen 3–5 oraciones propias sobre "${tema}"_. Vocabulario de apoyo: _${v1}_.`,
      `**Comparten** respuestas en parejas. **Reciben** retroalimentación sobre precisión gramatical de manera positiva y formativa.`,
    ];
  }

  // Fase 2 — Profundización: escritura + revisión por pares
  const v2 = vSlice(8);
  return [
    `**Amplían** el vocabulario de "${tema}": _expresiones nuevas y colocaciones_. **Registran** en glosario personal: _definición en inglés + oración de ejemplo_. Vocabulario: _${v2}_.`,
    `**Redactan** un párrafo o diálogo sobre "${tema}" usando el vocabulario y las estructuras trabajadas.`,
    `**Intercambian** su producción para revisión por pares _(peer editing)_: _vocabulario, gramática y claridad_. **Anotan** dos aspectos positivos y una sugerencia de mejora.`,
    `**Comparten** oralmente un fragmento de su producción sobre "${tema}". **Reciben** retroalimentación formativa.`,
  ];
};

const getActsDesarrollo = (area, tema, fasePos, diaNum, mc = {}) => {
  if (area === "Inglés") return _getActsDesarrolloIngles(tema, fasePos, diaNum, mc);

  const variantes = {
    "Inglés": [
      // Variante 0 — Fase 1 (Presentación): LISTENING + SPEAKING
      [
        `**Realizan** comprensión auditiva con propósito definido: _{expr_listening_nombre}_ sobre "${tema}". _({expr_listening_tarea})_ Progresión de tres escuchas: _(1) tema general, (2) palabras clave, (3) detalles específicos)_.`,
        `**Responden** preguntas orales de comprensión auditiva sobre "${tema}". **Usan** oraciones completas y el vocabulario escuchado. _({expr_comprension_listening})_`,
        `**Practican** la pronunciación del vocabulario clave de "${tema}": **repiten** en coro y luego individualmente, cuidando entonación y acento. _({expr_pronunciacion})_`,
        `**Realizan** speaking en parejas: un estudiante **pregunta** usando vocabulario del audio, el otro **responde**. _({expr_parejas})_ **Reciben** retroalimentación sobre pronunciación y fluidez.`,
      ],
      // Variante 1 — Fase 2 (Desarrollo): READING + GRAMMAR in context
      [
        `**Leen** un texto de "${tema}" y **realizan** comprensión lectora en tres niveles: _literal (¿qué dice?), inferencial (¿qué significa?) e interpretativo (¿qué opinas?)_. _({expr_comprension_reading})_`,
        `**Analizan** las estructuras gramaticales del texto de "${tema}": **identifican** el patrón, lo **nombran** y **explican** su función. _({expr_gramatica})_`,
        `**Practican** la gramática de "${tema}" en ejercicios contextualizados: **completan** diálogos, **transforman** oraciones y **construyen** ejemplos propios. _({expr_instruccion})_`,
        `**Comparten** sus respuestas con el grupo. **Reciben** retroalimentación sobre precisión gramatical y comprensión lectora. _({expr_retroalimentacion})_`,
      ],
      // Variante 2 — Fase 3 (Profundización): WRITING + VOCABULARY + Speaking
      [
        `**Amplían** el vocabulario de "${tema}": _sinónimos, expresiones idiomáticas y colocaciones_. **Registran** en su glosario: _definición en inglés + oración de ejemplo_. _({expr_vocabulario})_`,
        `**Redactan** sobre "${tema}": _párrafo, diálogo, historia o email_ usando vocabulario y estructuras aprendidas. **Aplican** reglas ortográficas del inglés. _({expr_writing})_`,
        `**Intercambian** su producción para revisión por pares _(peer editing)_: **verifican** vocabulario, gramática, coherencia y claridad. **Devuelven** con 2 elogios y 1 sugerencia de mejora. _({expr_parejas})_`,
        `**Comparten** oralmente un fragmento de su producción ante el grupo. **Reciben** retroalimentación sobre la expresión escrita y oral. _({expr_retroalimentacion})_`,
      ],
    ],
    "Matemática": [
      [
        `**Observan** ejemplos paso a paso de "${tema}" y **analizan** el procedimiento e **identifican** los pasos esenciales.`,
        `**Resuelven** ejercicios guiados individualmente. **Reciben** retroalimentación inmediata sobre su comprensión.`,
        `**Trabajan** en parejas **resolviendo** 3–4 problemas aplicados sobre "${tema}". **Explican** oralmente su procedimiento al compañero _(think-aloud)_.`,
        `**Socializan** las respuestas con el grupo. **Aclaran** errores comunes y **refuerzan** el procedimiento correcto. **Registran** en su cuaderno el proceso y los ejemplos claves.`,
      ],
      [
        `**Analizan** el nuevo concepto de "${tema}" mediante material concreto, representación gráfica o situación real. **Identifican** sus características y propiedades.`,
        `**Exploran** y **practican** en estaciones de aprendizaje donde **aplican** diferentes aspectos de "${tema}". **Argumentan** oralmente sus estrategias ante sus compañeros.`,
        `**Resuelven** en grupos un problema desafiante sobre "${tema}" **eligiendo** la estrategia más adecuada. **Representan** el proceso de manera gráfica y/o numérica.`,
        `**Ponen** en común los resultados. **Sistematizan** los aprendizajes y **registran** el procedimiento, propiedades y ejemplos del día en el cuaderno.`,
      ],
      [
        `**Observan** situaciones problemáticas con diferentes niveles de complejidad sobre "${tema}" y **seleccionan** la estrategia más adecuada para **resolverlas**.`,
        `**Resuelven** individualmente y luego **comparan** sus respuestas y estrategias en pequeños grupos. **Identifican** semejanzas y diferencias entre los procedimientos utilizados.`,
        `**Representan** el mismo problema de dos maneras diferentes: _gráfica, numérica o concreta_. **Analizan** y **comparan** las estrategias de sus compañeros.`,
        `**Identifican** y **registran** la propiedad o regla matemática aplicada en "${tema}". **Consolidan** los aprendizajes **destacando** los procedimientos más eficientes.`,
      ],
    ],
    "Lengua Española": [
      [
        `**Observan** y **leen** el texto o recurso principal relacionado con "${tema}". **Identifican** sus características, estructura y elementos lingüísticos claves.`,
        `**Analizan** los elementos gramaticales, ortográficos y textuales relacionados con "${tema}" mediante ejemplos concretos. **Diferencian** usos y **aplican** reglas en contexto.`,
        `**Describen** oralmente y **producen** un texto escrito relacionado con "${tema}" siguiendo el modelo. **Realizan** trabajo colaborativo en parejas o grupos.`,
        `**Socializan** sus producciones con el grupo. **Reciben** retroalimentación de sus compañeros. **Revisan** y **corrigen** aspectos de coherencia, cohesión y ortografía.`,
      ],
      [
        `**Observan** un texto modelo relacionado con "${tema}" y **analizan** su estructura, propósito comunicativo y características lingüísticas. **Relacionan** el contenido con situaciones de la vida real.`,
        `**Analizan** y **practican** los elementos gramaticales u ortográficos vinculados a "${tema}" mediante ejercicios guiados y ejemplos del contexto cotidiano.`,
        `**Producen** un texto oral y/o escrito sobre "${tema}" **aplicando** los elementos trabajados. **Utilizan** organizadores gráficos, esquemas o borradores como apoyo al proceso de escritura.`,
        `**Comparten** sus producciones con el grupo. **Interactúan** dando y recibiendo retroalimentación constructiva. **Revisan** y **mejoran** sus textos **incorporando** las sugerencias recibidas.`,
      ],
      [
        `**Leen** y **analizan** un texto relacionado con "${tema}" **respondiendo** preguntas de comprensión: _literal, inferencial y crítica_. **Identifican** vocabulario nuevo y lo **registran** en su cuaderno.`,
        `**Analizan** y **aplican** las normas gramaticales u ortográficas relacionadas con "${tema}" mediante situaciones comunicativas reales y ejemplos del entorno.`,
        `**Producen** textos orales y escritos relacionados con "${tema}" en parejas o grupos. **Aplican** el vocabulario y las normas trabajadas durante la sesión.`,
        `**Presentan** y **socializan** sus producciones. **Integran** la retroalimentación recibida para corregir y mejorar sus textos. **Sistematizan** los aprendizajes claves.`,
      ],
    ],
  };

  if (variantes[area]) {
    const acts = variantes[area][fasePos % variantes[area].length];
    if (area === "Inglés") return inyectarExpresiones(acts, diaNum, "en");
    if (area === "Francés") return inyectarExpresiones(acts, diaNum, "fr");
    return acts;
  }

  // Banco Pedagógico Firestore (oficial) tiene prioridad
  const bpActsDesarrollo = obtenerBPActs(area, "Desarrollo", diaNum);
  if (bpActsDesarrollo) return withTema(bpActsDesarrollo, tema);

  // Banco especializado estático como fallback
  const bankActs = obtenerActividadesBanco(area, "Desarrollo", fasePos, diaNum);
  if (bankActs) return withTema(bankActs, tema);

  // Fallback genérico
  const generic = [
    [
      `**Observan** el recurso principal de "${tema}" e **identifican** sus características. **Expresan** sus primeras observaciones e hipótesis sobre el contenido.`,
      `**Exploran** el contenido de "${tema}" mediante actividades guiadas: **practican** el modelo presentado y **responden** preguntas de verificación en cada paso.`,
      `**Construyen** en grupos una representación o explicación inicial de "${tema}": _mapa, esquema, modelo o descripción con sus propias palabras_.`,
      `**Socializan** sus representaciones. **Sistematizan** los aprendizajes y **corrigen** concepciones erróneas. **Registran** en el cuaderno.`,
    ],
    [
      `**Analizan** el contenido de "${tema}" con mayor profundidad: _causas, relaciones, propiedades, procedimientos o estructuras_. **Diferencian** conceptos claves.`,
      `**Practican** en parejas o grupos **aplicando** lo analizado sobre "${tema}" en ejercicios o situaciones guiadas. **Reciben** retroalimentación de manera continua.`,
      `**Trabajan** colaborativamente **resolviendo** una situación más compleja de "${tema}". **Argumentan** sus decisiones y estrategias de forma oral y escrita.`,
      `**Ponen** en común resultados. **Consolidan** los aprendizajes esenciales, **aclaran** dudas y **conectan** con el objetivo de la sesión.`,
    ],
    [
      `**Aplican** los conocimientos **construidos** sobre "${tema}" en situaciones de mayor complejidad o en contextos diferentes.`,
      `**Producen** de forma autónoma o en grupos una solución, texto, representación o argumento relacionado con "${tema}" **aplicando** criterios de calidad.`,
      `**Evalúan** críticamente su producción o la de un compañero: _¿Cumple los criterios? ¿Es correcto? ¿Qué mejoraría?_`,
      `**Reciben** retroalimentación sobre sus producciones **destacando** logros y aspectos de mejora. **Integran** las sugerencias en una versión final.`,
    ],
  ];
  return generic[fasePos % generic.length];
};

const _getActsCierreIngles = (tema, fasePos, diaNum, mc = {}) => {
  const vSlice = (n) => mc.vocabulario?.slice(n, n + 4).join(', ') || `vocabulario de "${tema}"`;

  // Fase 0 — Presentación: síntesis de vocabulario + exit ticket
  if (fasePos === 0) {
    const v0 = vSlice(0);
    return [
      `**Nombran** en voz alta las palabras de "${tema}" que **recuerdan** de la sesión. **Reciben** retroalimentación sobre pronunciación de manera positiva.`,
      `**Reflexionan** sobre lo aprendido. _("What words about ${tema} did you learn today?")_`,
      `**Completan** un exit ticket individual: _escriben o dibujan 3 elementos de "${tema}" que aprendieron hoy_. Vocabulario: _${v0}_.`,
      `**Escuchan** la tarea para el hogar relacionada con "${tema}" y la conexión con la próxima sesión.`,
    ];
  }

  // Fase 1 — Desarrollo: word wall + síntesis gramatical + tarea
  if (fasePos === 1) {
    const v1 = vSlice(4);
    return [
      `**Construyen** colectivamente un _Word Wall_ con vocabulario, expresiones y estructuras de "${tema}" trabajadas en la sesión.`,
      `**Reflexionan** sobre lo aprendido. _("What grammar structure did we practice? Can you give an example about ${tema}?")_`,
      `**Completan** un exit ticket: _3 oraciones sobre "${tema}" usando la estructura trabajada_. Vocabulario de apoyo: _${v1}_.`,
      `**Escuchan** la orientación de la tarea relacionada con "${tema}" y la próxima sesión.`,
    ];
  }

  // Fase 2 — Profundización: compartir producción + autoevaluación + portafolio
  return [
    `**Leen** en voz alta un fragmento de su producción sobre "${tema}" ante el grupo o en parejas. **Reciben** retroalimentación positiva y constructiva.`,
    `**Autoevalúan** su producción. _("Is my vocabulary appropriate for ${tema}? Are my sentences correct and clear?")_`,
    `**Incorporan** correcciones finales y **archivan** en su portafolio como evidencia de avance en "${tema}".`,
    `**Celebran** el progreso. _("Excellent work today! You're making great progress with ${tema}. See you next class!")_`,
  ];
};

const getActsCierre = (area, tema, fasePos, diaNum, mc = {}) => {
  if (area === "Inglés") return _getActsCierreIngles(tema, fasePos, diaNum, mc);

  const variantes = {
    "Inglés": [
      // Variante 0 — Fase 1 (Presentación): reflexión LISTENING + primer vocabulario
      [
        `**Comparten** oralmente 3 palabras o expresiones de "${tema}" que **recuerdan** del audio o diálogo de la sesión. _(What words did you catch? What was the main topic?)_`,
        `**Reflexionan** sobre su comprensión auditiva: _(Was it easy or hard to understand? What helped you? What will you practice at home?)_`,
        `**Reciben** retroalimentación sobre pronunciación y vocabulario. **Anotan** 3–5 palabras clave de "${tema}" con su significado en el cuaderno.`,
        `**Completan** un exit ticket individual antes de cerrar: _{({expr_exit_ticket})}_`,
        `**Despiden** la sesión motivacionalmente en inglés. _({expr_despedida})_`,
      ],
      // Variante 1 — Fase 2 (Desarrollo): síntesis READING + GRAMMAR
      [
        `**Construyen** colectivamente en la pizarra un _Word Wall_ con palabras, expresiones y estructuras clave de "${tema}" aprendidas en la sesión.`,
        `**Completan** un exit ticket individual sobre lectura y gramática del día: _{({expr_exit_ticket})}_`,
        `**Reflexionan** sobre su proceso de lectura y gramática: _({expr_comprension_reading})_`,
        `**Reciben** orientación sobre la tarea relacionada con reading o grammar de "${tema}". **Escuchan** la conexión con la próxima sesión. _({expr_despedida})_`,
      ],
      // Variante 2 — Fase 3 (Profundización): síntesis WRITING + producción
      [
        `**Leen** en voz alta un fragmento de su producción escrita sobre "${tema}" ante el grupo o en parejas. **Practican** pronunciación, entonación y confianza oral.`,
        `**Autoevalúan** su producción escrita: _(Is the vocabulary appropriate? Are the structures correct? Is it clear and well-organized?)_`,
        `**Completan** un exit ticket sobre su proceso de escritura: _{({expr_exit_ticket})}_`,
        `**Integran** las correcciones del peer editing en una versión mejorada de su texto sobre "${tema}".`,
        `**Despiden** la sesión **celebrando** el progreso en escritura en inglés. _({expr_despedida})_`,
      ],
    ],
    "Matemática": [
      [
        `**Resuelven** individualmente 1–2 ejercicios de síntesis sobre "${tema}" como ticket de salida para verificar la comprensión.`,
        `**Comparten** y **verifican** sus respuestas con el grupo. **Identifican** errores y los **corrigen** de manera colaborativa.`,
        `**Reflexionan** sobre el aprendizaje del día **respondiendo**: _¿Qué aprendí? ¿Qué me resultó difícil? ¿Dónde puedo aplicar esto en mi vida cotidiana?_`,
        `**Reciben** orientación sobre la tarea para el hogar y **escuchan** el próximo contenido de la unidad.`,
      ],
      [
        `**Responden** preguntas de verificación oral sobre "${tema}".`,
        `**Expresan** con sus propias palabras el procedimiento o concepto aprendido. Tres voluntarios **explican** a sus compañeros cómo **resolver** un ejercicio de "${tema}".`,
        `**Integran** la retroalimentación recibida durante la sesión y **corrigen** los errores identificados en sus producciones.`,
        `**Reciben** y **anotan** la tarea para el hogar. **Escuchan** la conexión del próximo contenido con lo aprendido hoy.`,
      ],
      [
        `**Sintetizan** oralmente los aprendizajes claves de la sesión sobre "${tema}": _propiedades, procedimientos y ejemplos_.`,
        `**Completan** en el cuaderno un resumen o esquema de "${tema}" con los conceptos más importantes aprendidos.`,
        `**Reflexionan** sobre su desempeño y **establecen** metas personales de mejora para la próxima sesión.`,
        `**Reciben** orientación sobre la tarea, **expresan** sus dudas finales y **escuchan** el próximo contenido de la unidad.`,
      ],
    ],
    "Lengua Española": [
      [
        `**Comparten** información sobre "${tema}" y **responden** preguntas de reflexión sobre los textos o contenidos trabajados.`,
        `**Expresan** opiniones breves sobre la utilidad del contenido aprendido y **reconocen** cómo **aplicarlo** en situaciones comunicativas reales de su entorno.`,
        `**Integran** la retroalimentación recibida sobre sus producciones orales y escritas para **corregir** aspectos de coherencia, cohesión y ortografía.`,
        `**Reciben** orientación sobre la tarea para el hogar y **escuchan** el próximo contenido de la unidad.`,
      ],
      [
        `**Leen** en voz alta sus producciones finales del día y **comparten** con el grupo lo aprendido sobre "${tema}".`,
        `**Reflexionan** sobre el proceso de aprendizaje: _¿Qué aprendí hoy? ¿Qué me resultó difícil? ¿Cómo puedo mejorar mi expresión oral y escrita?_`,
        `**Integran** la retroalimentación recibida y **realizan** correcciones finales en sus producciones escritas.`,
        `**Reciben** la orientación de la tarea para el hogar y **escuchan** el próximo contenido de la unidad.`,
      ],
      [
        `**Sintetizan** oralmente los aprendizajes claves de la sesión sobre "${tema}" **destacando** vocabulario, normas y elementos textuales trabajados.`,
        `**Expresan** en voz alta su producción final del día y **reciben** comentarios positivos del grupo.`,
        `**Reflexionan** sobre su desempeño comunicativo y **establecen** compromisos personales de mejora.`,
        `**Reciben** orientación sobre la tarea para el hogar y **escuchan** la conexión del próximo contenido con lo aprendido hoy.`,
      ],
    ],
  };

  if (variantes[area]) {
    const acts = variantes[area][fasePos % variantes[area].length];
    if (area === "Inglés") return inyectarExpresiones(acts, diaNum, "en");
    if (area === "Francés") return inyectarExpresiones(acts, diaNum, "fr");
    return acts;
  }

  // Banco Pedagógico Firestore (oficial) tiene prioridad
  const bpActsCierre = obtenerBPActs(area, "Cierre", diaNum);
  if (bpActsCierre) return withTema(bpActsCierre, tema);

  // Banco especializado estático como fallback
  const bankActs = obtenerActividadesBanco(area, "Cierre", fasePos, diaNum);
  if (bankActs) return withTema(bankActs, tema);

  // Fallback genérico
  const generic = [
    [
      `**Completan** el organizador _"Antes pensaba... Ahora sé que..."_ sobre "${tema}". **Comparan** sus hipótesis iniciales con lo que **descubrieron**.`,
      `**Reflexionan** en voz alta: _¿Confirmé mis hipótesis iniciales sobre ${tema}? ¿Qué me sorprendió? ¿Qué nueva pregunta me genera?_`,
      `**Integran** la retroalimentación recibida y **corrigen** concepciones erróneas que surgieron durante la exploración.`,
      `**Reciben** orientación sobre la tarea para el hogar y **escuchan** el próximo contenido de la unidad.`,
    ],
    [
      `**Sintetizan** los aprendizajes del día **elaborando** con sus propias palabras una explicación de "${tema}": _concepto, proceso, regla o estructura_.`,
      `**Reflexionan** sobre su proceso: _¿Qué estrategia me funcionó mejor para aprender ${tema}? ¿Qué cambiaría para la próxima vez?_`,
      `Tres voluntarios **comparten** su síntesis o una producción del día. El grupo **complementa** y **retroalimenta** de manera constructiva.`,
      `**Reciben** la orientación de la tarea, la **anotan** en el cuaderno y **escuchan** la conexión con el próximo contenido.`,
    ],
    [
      `**Autoevalúan** su producción o desempeño del día usando los criterios de calidad establecidos para "${tema}".`,
      `**Reflexionan** sobre su nivel de dominio actual: _¿Puedo aplicar ${tema} de manera autónoma? ¿Qué necesito seguir practicando?_`,
      `**Establecen** un compromiso personal de práctica o profundización relacionado con "${tema}" para el hogar o la próxima sesión.`,
      `**Celebran** el avance del grupo, **reciben** orientación de la tarea y **escuchan** el próximo contenido de la unidad.`,
    ],
  ];
  return generic[fasePos % generic.length];
};

const getEvidencias = (area, momento, _fasePos) => {
  const e = {
    // Inicio: solo Conocimiento + Desempeño (no hay producto, es activación oral)
    Inicio: {
      "Inglés": "**Conocimiento:**\n• Identifica palabras y expresiones básicas en inglés.\n• Relaciona el vocabulario con situaciones cotidianas conocidas.\n**Desempeño:**\n• Participa oralmente respondiendo preguntas de activación en inglés.\n• Expresa ideas con vocabulario conocido.",
      "Matemática": "**Conocimiento:**\n• Recuerda conceptos y procedimientos previos relacionados con el tema.\n• Relaciona el nuevo contenido con aprendizajes anteriores.\n**Desempeño:**\n• Resuelve ejercicios de activación de manera oral o escrita.\n• Expresa hipótesis e ideas iniciales sobre el contenido del día.",
      default: "**Conocimiento:**\n• Demuestra saberes previos relacionados con el contenido.\n• Expresa ideas y preguntas sobre el tema con claridad.\n**Desempeño:**\n• Participa en la dinámica de activación de manera activa.\n• Expresa hipótesis o predicciones iniciales de forma oral o escrita.",
    },
    // Desarrollo: los tres (hay producción concreta en la sesión)
    Desarrollo: {
      "Inglés": "**Conocimiento:**\n• Comprende el vocabulario y las estructuras gramaticales trabajadas.\n• Reconoce el uso de las estructuras en contextos comunicativos.\n**Desempeño:**\n• Usa vocabulario y estructuras gramaticales en contexto oral y escrito.\n• Produce oraciones y diálogos cortos de manera autónoma.\n**Producto:**\n• Oraciones escritas, diálogos o párrafos producidos durante la sesión.",
      "Matemática": "**Conocimiento:**\n• Comprende el procedimiento o concepto matemático trabajado.\n• Identifica propiedades y relaciones clave del tema.\n**Desempeño:**\n• Resuelve ejercicios y problemas aplicando el procedimiento correcto.\n• Explica sus estrategias de resolución de manera clara.\n**Producto:**\n• Ejercicios resueltos y registrados en el cuaderno con procedimiento completo.",
      default: "**Conocimiento:**\n• Comprende los conceptos y contenidos trabajados durante la sesión.\n• Establece relaciones entre el nuevo contenido y sus saberes previos.\n**Desempeño:**\n• Aplica los conocimientos en actividades prácticas y colaborativas.\n• Participa activamente en las actividades de construcción del aprendizaje.\n**Producto:**\n• Producciones escritas, representaciones o ejercicios realizados en la sesión.",
    },
    // Cierre: los tres (exit ticket, tarea o síntesis son productos concretos)
    Cierre: {
      "Inglés": "**Conocimiento:**\n• Resume lo aprendido con sus propias palabras en inglés.\n• Identifica sus avances y áreas de mejora en el idioma.\n**Desempeño:**\n• Completa el exit ticket de manera autónoma.\n• Reflexiona sobre su proceso de aprendizaje en inglés.\n**Producto:**\n• Exit ticket completado / Tarea para el hogar asignada.",
      "Matemática": "**Conocimiento:**\n• Expresa con sus propias palabras el concepto o procedimiento aprendido.\n• Identifica dónde puede aplicar el tema en situaciones cotidianas.\n**Desempeño:**\n• Verifica la corrección de sus respuestas y corrige errores identificados.\n• Reflexiona sobre su nivel de comprensión del tema.\n**Producto:**\n• Ticket de salida / Resumen o esquema del tema en el cuaderno.",
      default: "**Conocimiento:**\n• Expresa los aprendizajes alcanzados durante la sesión.\n• Relaciona el contenido trabajado con situaciones de su contexto real.\n**Desempeño:**\n• Reflexiona sobre su proceso de aprendizaje de manera crítica.\n• Identifica avances personales y aspectos a reforzar.\n**Producto:**\n• Ticket de salida / Tarea para el hogar / Síntesis registrada en el cuaderno.",
    },
  };
  const byMom = e[momento] || e.Inicio;
  return byMom[area] || byMom.default;
};

// ─── Evaluación por momento: asignación DETERMINÍSTICA (no es tarea de la IA) ─
// Tabla de reglas momento+fase. El Resumen de Evaluación del día se deriva de
// esta MISMA tabla (ver generarDia) para que documento y resumen coincidan.
//   Inicio     → Diagnóstica / heteroevaluación / observación directa / lista de cotejo
//   Desarrollo → Formativa (Sumativa en la fase final)
//   Cierre     → Formativa / autoevaluación-coevaluación

const TABLA_EVALUACION = {
  Inicio: {
    tipo: "Diagnóstica",
    agente: "Heteroevaluación",
    tecnica: "Observación directa",
    instrumento: "Lista de cotejo",
  },
  Desarrollo: {
    tipo: "Formativa",
    agente: "Heteroevaluación",
    tecnica: "Observación directa y revisión del trabajo",
    instrumento: "Rúbrica analítica",
  },
  DesarrolloFaseFinal: {
    tipo: "Sumativa",
    agente: "Heteroevaluación",
    tecnica: "Revisión de producciones y observación",
    instrumento: "Rúbrica analítica",
  },
  Cierre: {
    tipo: "Formativa",
    agente: "Autoevaluación / Coevaluación",
    tecnica: "Reflexión oral / Ticket de salida",
    instrumento: "Escala de valoración",
  },
};

const getEvaluacion = (momento, esFaseFinal = false) => {
  if (momento === "Desarrollo" && esFaseFinal) return TABLA_EVALUACION.DesarrolloFaseFinal;
  return TABLA_EVALUACION[momento] || TABLA_EVALUACION.Inicio;
};

const getMetacognicion = (momento, area, tema) => {
  const metas = {
    Inicio: [
      `¿Qué sé sobre ${tema}? ¿Qué quisiera aprender hoy?`,
      "¿Cómo me siento al comenzar esta clase? ¿Estoy preparado para aprender?",
    ],
    Desarrollo: [
      `¿Qué estrategias estoy usando para aprender sobre ${tema}?`,
      "¿Qué parte del contenido me resulta más difícil? ¿Por qué?",
      "¿Cómo estoy participando en las actividades colaborativas?",
    ],
    Cierre: [
      `¿Qué aprendí hoy sobre ${tema}? ¿Cómo lo puedo aplicar?`,
      "¿Qué fue lo más interesante de la clase? ¿Qué aún necesito practicar?",
      "¿Cómo puedo mejorar mi aprendizaje en la próxima clase?",
    ],
  };
  return metas[momento] || metas.Cierre;
};

// ─── Recursos derivados de actividades ─────────────────────────────────────────

const derivarRecursos = (actividades, area, _faseNum) => {
  const txt = actividades.join(" ").toLowerCase();
  const tiene = (re) => re.test(txt);

  const did = new Set();
  const tec = new Set(["Pizarrón y marcadores"]);

  // Tecnológicos según actividades
  if (tiene(/video|clip|film|audiovisual/)) {
    tec.add("Proyector"); tec.add("Video / clip audiovisual"); tec.add("Parlantes");
  }
  if (tiene(/audio|podcast|grabaci[oó]n|comprens[ioó]n auditiva/) && !tiene(/video/)) {
    tec.add("Grabación de audio"); tec.add("Parlantes");
  }
  if (tiene(/presentaci[oó]n digital|diapositiv|canva|powerpoin/)) {
    tec.add("Proyector"); tec.add("Presentación digital");
  }
  if (tiene(/internet|plataforma|liveworksheet|kahoot|digital/)) {
    tec.add("Computadora o tableta"); tec.add("Acceso a internet");
  }
  if (tiene(/proyect/) && tec.size === 1) tec.add("Proyector");

  // Didácticos según actividades
  if (tiene(/role.play|tarjeta de rol|situaci[oó]n comunicativa/)) {
    did.add("Tarjetas de roles"); did.add("Guías de conversación");
  }
  if (tiene(/flashcard|vocabulario/)) did.add("Flashcards de vocabulario");
  if (tiene(/organizador|mapa conceptual|esquema/)) did.add("Organizadores gráficos");
  if (tiene(/plantilla|hoja de trabajo|ficha/)) did.add("Hojas de trabajo / Plantillas");
  if (tiene(/texto|lectura|p[aá]rrafo/)) did.add("Texto de lectura");
  if (tiene(/imagen|foto|l[aá]mina|ilustraci[oó]n/)) did.add("Imágenes / Láminas temáticas");
  if (tiene(/plano|dise[nñ]o|maqueta/)) { did.add("Planos / Imágenes de referencia"); did.add("Cartulinas y marcadores"); }
  if (tiene(/cartel|papelógrafo|mural/)) { did.add("Papelógrafo / Carteles"); did.add("Marcadores de colores"); }
  if (tiene(/portafolio|carpeta/)) did.add("Carpeta de portafolio");
  if (tiene(/r[uú]brica|criterio de evaluaci[oó]n/)) did.add("Rúbrica de evaluación");
  if (tiene(/aut[oe]evaluaci[oó]n|coevaluaci[oó]n/)) did.add("Instrumento de autoevaluación / coevaluación");
  if (tiene(/exposici[oó]n|presentaci[oó]n (oral|final)/)) did.add("Rúbrica de exposición oral");
  if (tiene(/redact|escrib|prod[uú]cc[ioó]n escrita/)) did.add("Guías de redacción / Plantillas de escritura");
  if (tiene(/manipulativo|regleta|geoplano|ficha/)) did.add("Material manipulativo (regletas, fichas)");
  if (tiene(/calculadora/)) did.add("Calculadora");
  if (tiene(/libro|texto de clase/)) did.add("Libro de texto del área");

  // Recursos base por área si detectamos poco
  if (did.size < 2) {
    const base = {
      "Inglés": ["Cuaderno de inglés", "Tarjetas de vocabulario"],
      "Matemática": ["Cuaderno de matemática", "Material manipulativo"],
      "Lengua Española": ["Cuaderno de lengua española", "Texto de lectura"],
      "Ciencias de la Naturaleza": ["Cuaderno de ciencias", "Láminas científicas"],
      "Ciencias Sociales": ["Cuaderno de sociales", "Mapas e imágenes históricas"],
    }[area] || ["Cuaderno de clase", "Material de apoyo del área"];
    base.forEach((r) => did.add(r));
  }
  did.add("Cuaderno de clase");

  return {
    humanos: "Docente y estudiantes",
    didacticos: [...did].slice(0, 5).join(", "),
    tecnologicos: [...tec].slice(0, 4).join(", "),
  };
};

// ─── Posibles dificultades del área por fase ──────────────────────────────────

const POSIBLES_DIFICULTADES = {
  "Inglés": [
    "Timidez al hablar: usar Think-Pair-Share antes de exposición al grupo. Vocabulario escaso: proveer Word Wall y tarjetas individuales. Uso del español: señal visual 'English Zone' y reformular en inglés sin penalizar.",
    "Dificultades gramaticales: inducción antes de dar la regla. Bloqueo en la lectura: estrategia de lectura para la idea general en primera pasada. Pronunciación: modelar, repetir en coro, no corregir en público.",
    "Bloqueo al escribir: usar organizadores gráficos. Miedo al error oral: normalizar el error. Ritmos distintos: actividad de extensión para quienes terminan antes.",
    "Ansiedad ante la evaluación final: repasar criterios con anticipación y practicar la exposición en parejas. Presentación incompleta: permitir apoyo visual (poster, tarjetas) durante la exposición.",
  ],
  "Francés": [
    "Timidez al hablar: usar Think-Pair-Share. Vocabulario escaso: proveer banco de palabras visual. Interferencia del español: reformular en francés sin penalizar.",
    "Dificultades gramaticales: inducción antes de dar la regla. Bloqueo en la lectura: estrategia de lectura global antes del detalle.",
    "Bloqueo al escribir: usar organizadores. Miedo al error: normalizar el error como aprendizaje.",
    "Ansiedad ante la evaluación: repasar criterios con anticipación. Permitir apoyo visual durante la exposición.",
  ],
  "Matemática": [
    "Ansiedad matemática: comenzar con situaciones concretas, normalizar el error. Vacíos previos: diagnóstico e intervención inmediata. Lectura del enunciado: modelar comprensión del problema antes del cálculo.",
    "Errores de procedimiento: exigir mostrar el proceso completo. Abstracción prematura: usar material concreto antes de lo algebraico. Copia sin comprensión: implementar 'piensa primero, luego verifica'.",
    "Dificultad para elegir estrategia: protocolo ¿Qué me piden? / ¿Qué datos tengo? / ¿Qué estrategia conozco? Respuestas sin justificación: modelar el lenguaje matemático argumentativo.",
    "Presentación incompleta: revisar con lista de cotejo antes de la entrega. Errores no detectados: revisión por pares usando los criterios de la rúbrica.",
  ],
  "Ciencias de la Naturaleza": [
    "Vocabulario científico desconocido: construir glosario desde la primera clase. Dificultad para formular hipótesis: modelar 'Si... entonces... porque...'. Creencias previas incorrectas: validar sin ridiculizar, guiar hacia la evidencia.",
    "Procedimiento experimental: practicar en grupo antes individualmente. Registro incompleto: usar plantilla estructurada. Conexión teoría-práctica: señalar explícitamente en qué momento del experimento se ve el concepto.",
    "Explicaciones no científicas: usar protocolo CER (Afirmación-Evidencia-Razonamiento). Vocabulario impreciso: retroalimentar inmediatamente con el término correcto.",
    "Timidez en presentación: practicar en grupos pequeños antes del grupo completo. Informe incompleto: revisar con rúbrica antes de la entrega.",
  ],
  "Lengua Española": [
    "Dificultad para expresarse oralmente: vocabulario previo a la actividad oral. Lectura superficial: modelar estrategias de lectura activa. Resistencia a escribir: comenzar con producciones muy breves y andamiadas.",
    "Errores ortográficos: implementar 'revisar antes de entregar'. Textos sin cohesión: modelar conectores. Vocabulario limitado: banco de palabras del área y diccionario disponible.",
    "Pérdida del hilo temático: organizador gráfico previo a la escritura. Oral con muletillas: practicar en parejas antes del grupo. Resistencia a la revisión: co-revisión como práctica positiva.",
    "Ansiedad ante la producción final: repasar criterios y permitir borradores previos. Presentación oral insegura: permitir apoyo escrito visible durante la exposición.",
  ],
  "Ciencias Sociales": [
    "Confusión de fechas y nombres: usar líneas de tiempo y mapas visuales. Fuentes primarias/secundarias: modelar con ejemplos del contexto dominicano. Presentismo: contextualizar históricamente antes del análisis.",
    "Argumentos sin evidencia: modelar afirmación+evidencia+razonamiento. Confusión causa/consecuencia: usar flujogramas de causalidad. Dificultad con fuentes críticas: protocolo HAPP.",
    "Ensayo sin posición propia: modelar diferencia entre describir y argumentar. Fuentes digitales no confiables: enseñar criterios de evaluación de fuentes. Dificultad para conectar historia con presente: preguntas puente.",
    "Proyecto incompleto: revisar con rúbrica antes de la presentación. Exposición sin fundamentos: practicar responder preguntas del auditorio en simulacro previo.",
  ],
};

const getPosiblesDificultades = (area, faseIdx) => {
  const banco = POSIBLES_DIFICULTADES[area];
  if (!banco) return "Identificar dificultades individuales en el diagnóstico y ajustar el nivel de andamiaje. Proveer actividades diferenciadas por nivel de desempeño.";
  return banco[Math.min(faseIdx, banco.length - 1)] ?? banco[0];
};

// ─── Aporte al producto final por clase ──────────────────────────────────────

const APORTES_POR_AREA = {
  "Inglés":    [`Banco de vocabulario personal (5-8 palabras clave con pronunciación y ejemplo).`, `Borrador de 3 oraciones usando el patrón gramatical trabajado.`, `Párrafo inicial revisado por pares con conectores de secuencia.`, `Sección de vocabulario del producto: términos ilustrados y definidos.`, `Sección de recomendaciones o análisis usando la estructura modal trabajada.`, `Borrador completo del producto escrito revisado con correcciones incorporadas.`],
  "Francés":   [`Banco de vocabulaire personnel (5-8 mots-clés avec prononciation et exemple).`, `Brouillon de 3 phrases en utilisant la structure grammaticale travaillée.`, `Premier paragraphe révisé avec connecteurs de séquence.`, `Section vocabulaire du produit: termes illustrés et définis.`, `Section recommandations ou analyse avec la structure modale travaillée.`, `Brouillon complet du produit écrit révisé.`],
  "Matemática": [`Glosario matemático: 5 términos de "{tema}" con definición, propiedad y ejemplo.`, `Resolución de 3 ejercicios modelo con procedimiento completo y verificación.`, `Sección de procedimiento: problema resuelto con representación gráfica/numérica/algebraica.`, `Colección de 5 problemas aplicados resueltos con justificación matemática.`, `Análisis de errores: 2 errores comunes en "{tema}", causa y corrección.`, `Borrador completo del producto matemático con procedimientos verificados.`],
  "Ciencias de la Naturaleza": [`Glosario científico: 5 conceptos de "{tema}" con definición e imagen.`, `Hipótesis de investigación formulada con justificación científica.`, `Protocolo de indagación: materiales, procedimiento y tabla de registro.`, `Datos registrados e interpretación inicial de los resultados de la indagación.`, `Sección de conclusiones: explicación CER sobre "{tema}".`, `Borrador completo del informe científico con todas sus secciones.`],
  "Lengua Española": [`Mapa de ideas o esquema previo a la escritura del texto.`, `Primer párrafo del texto redactado con las normas gramaticales trabajadas.`, `Borrador del texto con estructura completa (introducción, desarrollo, cierre).`, `Versión revisada con correcciones de vocabulario, gramática y ortografía.`, `Texto completamente revisado y listo para su versión final.`, `Presentación oral preparada: notas de exposición y estructura del discurso.`],
  "Ciencias Sociales": [`Mapa de actores/períodos: representación visual del contexto de "{tema}".`, `Análisis de fuente primaria o secundaria sobre "{tema}" con protocolo completo.`, `Línea de tiempo o mapa histórico/geográfico con explicación de los hitos.`, `Sección argumentativa del proyecto: tesis con evidencias sobre "{tema}".`, `Borrador completo de la investigación o ensayo con fuentes citadas.`, `Presentación visual del proyecto preparada para la exposición.`],
};

const getAporteProducto = (area, faseIdx, diaNum, totalDias, tema) => {
  if (faseIdx === 0) {
    return diaNum >= totalDias
      ? `Diagnóstico completo de saberes previos sobre "${tema}". El docente registra fortalezas y vacíos para ajustar la secuencia didáctica.`
      : `Los estudiantes conocen el propósito de la unidad, el producto final esperado y la situación de aprendizaje de "${tema}".`;
  }
  if (faseIdx === 3) {
    if (diaNum >= totalDias) return `Presentación y evaluación del producto final de "${tema}". Autoevaluación y coevaluación. Cierre de la unidad.`;
    if (diaNum === totalDias - 1) return `Versión final del producto de "${tema}" revisada y lista para presentar. Ensayo de la exposición oral incorporando correcciones finales.`;
    return `Avance concreto del producto final de "${tema}": organización, estructuración y producción de componentes según criterios de calidad.`;
  }
  const aportes = (APORTES_POR_AREA[area] || [
    `Banco de conceptos clave de "${tema}" en el cuaderno.`,
    `Primer borrador de la producción sobre "${tema}".`,
    `Sección principal del producto final completada.`,
    `Revisión y mejora del producto sobre "${tema}".`,
    `Borrador completo del producto.`,
    `Versión final del producto lista para presentar.`,
  ]).map((a) => a.replace(/\{tema\}/g, tema));
  const pos = (diaNum - 1) / Math.max(totalDias, 1);
  return aportes[Math.min(Math.floor(pos * aportes.length), aportes.length - 1)];
};

// ─── Actividades específicas para Fase 4 (Integración / Producto final) ─────────

const getActsFase4Inicio = (area, tema, diaNum, totalDias) => {
  const esUltimo = diaNum >= totalDias;
  if (esUltimo) {
    return [
      `**Responden** al saludo e indicaciones iniciales. **Revisan** brevemente el portafolio o las producciones elaboradas a lo largo de la unidad sobre "${tema}".`,
      `**Retroalimentan** el proceso completo de la unidad **respondiendo** preguntas de reflexión global: _¿Qué aprendí? ¿Cómo crecí? ¿Qué mejoré durante esta unidad?_`,
      `**Observan** la rúbrica o los criterios de evaluación final y se **preparan** para la evaluación sumativa y/o la exposición del producto final.`,
      `**Escuchan** la agenda del encuentro de cierre y la intención pedagógica del día.`,
    ];
  }
  return [
    `**Responden** al saludo e indicaciones iniciales. **Revisan** brevemente los avances del producto final y los criterios de calidad establecidos.`,
    `**Retroalimentan** el trabajo de la sesión anterior: _¿qué quedó pendiente? ¿qué necesitan mejorar o completar hoy?_`,
    `**Observan** ejemplos de producciones de calidad relacionadas con "${tema}" y los criterios que las **caracterizan**.`,
    `**Escuchan** la intención pedagógica del encuentro y **organizan** el trabajo del día para optimizar el tiempo disponible.`,
  ];
};

const getActsFase4Desarrollo = (area, tema, diaNum, totalDias) => {
  const esUltimo = diaNum >= totalDias;
  const esPenultimo = diaNum === totalDias - 1;
  if (esUltimo) {
    return [
      `**Presentan** su producto final ante el grupo **aplicando** los criterios de calidad trabajados durante la unidad. **Demuestran** dominio de los contenidos y competencias desarrolladas sobre "${tema}".`,
      `**Coevalúan** las producciones de sus compañeros utilizando la rúbrica o los criterios de evaluación acordados. **Ofrecen** retroalimentación constructiva y respetuosa.`,
      `**Completan** el instrumento de autoevaluación **reflexionando** honestamente sobre su desempeño, participación y aprendizaje a lo largo de la unidad.`,
      `**Integran** la retroalimentación recibida de sus compañeros y la **registran** como aprendizaje para futuras producciones.`,
    ];
  }
  if (esPenultimo) {
    return [
      `**Refinan** y **completan** el producto final de la unidad sobre "${tema}" **incorporando** las sugerencias y correcciones recibidas en sesiones anteriores.`,
      `**Ensayan** su presentación oral (si aplica) **practicando** con un compañero o grupo pequeño. **Aplican** criterios de claridad, fluidez y organización del discurso.`,
      `**Revisan** la calidad visual y lingüística del producto final **asegurándose** de que cumple con los criterios establecidos en la rúbrica.`,
      `**Reciben** retroalimentación formativa final y **realizan** los ajustes necesarios antes de la presentación o entrega definitiva.`,
    ];
  }
  return [
    `**Desarrollan** el producto final de la unidad sobre "${tema}" **trabajando** colaborativamente. **Aplican** los contenidos conceptuales, procedimentales y actitudinales **construidos** durante las fases anteriores.`,
    `**Organizan**, **estructuran** y **producen** los elementos del producto final siguiendo los criterios de calidad y el formato establecido.`,
    `**Reciben** retroalimentación formativa mientras **trabajan** y **realizan** ajustes progresivos en su producción.`,
    `**Avanzan** en la preparación de la presentación o exposición del producto, **distribuyendo** responsabilidades y **ensayando** si aplica.`,
  ];
};

const getActsFase4Cierre = (area, tema, diaNum, totalDias) => {
  const esUltimo = diaNum >= totalDias;
  if (esUltimo) {
    return [
      `Comparten sus reflexiones finales sobre el aprendizaje construido durante toda la unidad: _¿Qué fue lo más significativo? ¿Cómo cambiaron mis ideas sobre "${tema}"?_`,
      `Expresan reconocimiento por el trabajo propio y el de sus compañeros. Identifican los logros colectivos e individuales más importantes de la unidad.`,
      `Integran los aprendizajes de la unidad reconociendo cómo los contenidos y habilidades desarrolladas sobre "${tema}" se aplican en su vida cotidiana y futura.`,
      `Despiden la unidad de aprendizaje de manera motivacional. El docente felicita al grupo y anuncia los próximos aprendizajes.`,
    ];
  }
  return [
    `Comparten brevemente el avance del producto final del día e identifican qué les falta completar para el encuentro siguiente.`,
    `Reflexionan sobre la calidad de su producción: _¿Cumple con los criterios establecidos? ¿Qué debo mejorar antes de la entrega final?_`,
    `Integran la retroalimentación recibida durante el encuentro y establecen compromisos concretos de mejora para la próxima sesión.`,
    `Reciben orientación sobre lo que deben traer o preparar para el próximo encuentro relacionado con el producto final.`,
  ];
};

// ─── Distribución de fases basada en complejidad pedagógica ──────────────────
//
// Las fases dependen de: complejidad del tema, competencias, indicadores,
// horas disponibles, nivel y ritmo esperado. No son porcentajes fijos.
//
// Pesos por nivel de complejidad:
//   baja:    más tiempo en Integración (producto sencillo, síntesis rápida)
//   media:   equilibrio entre Desarrollo y las demás fases
//   alta:    más tiempo en Desarrollo y Profundización (conocimiento complejo)
//   muyAlta: máximo en Desarrollo + Profundización (múltiples habilidades, análisis)

const PESOS_FASE = {
  baja:    { f2: 0.38, f3: 0.22, f4: 0.40 },
  media:   { f2: 0.44, f3: 0.26, f4: 0.30 },
  alta:    { f2: 0.46, f3: 0.30, f4: 0.24 },
  muyAlta: { f2: 0.46, f3: 0.34, f4: 0.20 },
};

const calcularDistribucion = (total, productoFinal = "", nivelComplejidad = "media") => {
  const tieneProductoComplejo = /exposici[oó]n|proyecto|portafolio|presentaci[oó]n|obra|debate|experimento|mural|informe|podcast|video\b/i.test(productoFinal);

  // Fase 1 siempre corta — solo diagnóstico y activación inicial
  const f1 = total <= 5 ? 1 : 2;
  const rem = total - f1;

  const peso = PESOS_FASE[nivelComplejidad] || PESOS_FASE.media;
  const f4Bonus = tieneProductoComplejo ? 0.06 : 0;

  let f2 = Math.max(2, Math.round(rem * peso.f2));
  let f4 = Math.max(2, Math.round(rem * (peso.f4 + f4Bonus)));
  let f3 = Math.max(2, rem - f2 - f4);

  // Corregir desbordamiento
  const suma = f2 + f3 + f4;
  if (suma > rem) f2 -= (suma - rem);
  if (suma < rem) f4 += (rem - suma);

  // Si hay producto complejo, f4 debe ser ≥ f3
  if (tieneProductoComplejo && f4 < f3) {
    const mueve = Math.ceil((f3 - f4) / 2);
    if (f3 - mueve >= 2) { f3 -= mueve; f4 += mueve; }
  }

  return [Math.max(1, f1), Math.max(2, f2), Math.max(2, f3), Math.max(2, f4)];
};

// ─── Progresión pedagógica de 11 etapas — MINERD ─────────────────────────────
//
// Cada clase debe representar un avance real. Las 11 etapas se distribuyen
// en las 4 fases de la unidad:
//   Fase 1 (Presentación):   Diagnóstico · Activación · Exploración
//   Fase 2 (Desarrollo):     Construcción · Práctica guiada · Consolidación
//   Fase 3 (Profundización): Aplicación · Producción
//   Fase 4 (Integración):    Integración · Evaluación · Metacognición

const ETAPAS_POR_FASE = [
  ["Diagnóstico", "Activación", "Exploración"],
  ["Construcción", "Práctica guiada", "Consolidación"],
  ["Aplicación", "Producción"],
  ["Integración", "Evaluación", "Metacognición"],
];

const getEtapaProgresion = (faseIdx, numDia, totalDias) => {
  const etapas = ETAPAS_POR_FASE[faseIdx] || ETAPAS_POR_FASE[1];
  const pos = Math.min(
    Math.floor(((numDia - 1) / Math.max(totalDias, 1)) * etapas.length),
    etapas.length - 1
  );
  return etapas[pos];
};

// ─── Títulos e intenciones pedagógicas por fase ───────────────────────────────

const TITULOS_FASE = [
  ["Diagnóstico y motivación: presentación de la situación de aprendizaje", "Exploración de saberes previos y apropiación de la unidad de aprendizaje"],
  ["Introducción de conceptos y vocabulario clave", "Comprensión y análisis del contenido", "Práctica guiada y trabajo colaborativo", "Profundización y consolidación de aprendizajes", "Ampliación y transferencia de contenidos"],
  ["Aplicación de aprendizajes en contextos reales", "Producción colaborativa y transferencia", "Desarrollo inicial del producto final", "Producción oral y escrita con autonomía"],
  ["Desarrollo y organización del producto final", "Refinamiento y preparación de la presentación", "Socialización y exposición de producciones", "Evaluación integral, metacognición y cierre de la unidad"],
];

const INTENCIONES_FASE = [
  [
    (tema) => `Diagnosticar los conocimientos previos de los estudiantes sobre "${tema}", presentar la situación de aprendizaje y generar motivación e interés genuino por los nuevos aprendizajes.`,
    (_tema) => `Profundizar en la exploración de saberes previos, presentar la estructura de la unidad y conectar el contenido con el contexto real y el producto final esperado.`,
  ],
  [
    (tema) => `Introducir los conceptos y vocabulario esenciales de "${tema}", estableciendo una base conceptual sólida mediante ejemplos del entorno cotidiano.`,
    (tema) => `Desarrollar la comprensión de "${tema}" mediante análisis de ejemplos, diferenciación de conceptos y práctica de estructuras en contexto real.`,
    (tema) => `Fortalecer la comprensión de "${tema}" mediante práctica guiada, trabajo colaborativo y retroalimentación formativa oportuna.`,
    (tema) => `Profundizar en el dominio de "${tema}" mediante actividades de mayor complejidad que promuevan el pensamiento crítico y la transferencia.`,
    (tema) => `Consolidar los aprendizajes de "${tema}" integrando contenidos conceptuales, procedimentales y actitudinales en situaciones auténticas.`,
  ],
  [
    (tema) => `Aplicar los aprendizajes sobre "${tema}" en situaciones comunicativas o contextos reales, promoviendo la producción con autonomía creciente.`,
    (tema) => `Desarrollar producciones colaborativas que evidencien la comprensión y aplicación de "${tema}" en situaciones significativas del entorno.`,
    (tema) => `Iniciar el desarrollo del producto final integrando los aprendizajes construidos durante las fases anteriores sobre "${tema}".`,
    (tema) => `Perfeccionar las producciones sobre "${tema}", incorporando la retroalimentación recibida y aplicando criterios de calidad establecidos.`,
  ],
  [
    (tema) => `Desarrollar y organizar el producto final que evidencie el dominio de los aprendizajes de la unidad sobre "${tema}".`,
    (_tema) => `Refinar el producto final e incorporar las correcciones necesarias para alcanzar los criterios de calidad de la exposición o entrega.`,
    (_tema) => `Socializar y exponer el producto final ante el grupo, desarrollando habilidades de comunicación y recibiendo retroalimentación de pares y docente.`,
    (_tema) => `Evaluar integralmente los aprendizajes construidos, promover la metacognición y celebrar los logros alcanzados a lo largo de la unidad.`,
  ],
];

// ─── Banco de títulos específicos por día — Inglés ───────────────────────────
//
// Cada entrada del banco tiene 4 arrays (fase0–fase3) con títulos progresivos
// que reflejan el contenido real de cada clase: gramática, habilidad y tema.
// Si el tema no coincide, se usa el título genérico de TITULOS_FASE como fallback.

const _BANCO_TITULOS_DIA = [
  {
    test: /rutina|routine|daily life|vida diaria|daily routine|my life|actividades diarias/i,
    fase0: [
      "Diagnóstico: saberes previos sobre Daily Routines",
      "Vocabulario de entrada: Daily Activities y partes del día",
    ],
    fase1: [
      "Vocabulario: Daily Activities — acciones cotidianas en inglés",
      "Present Simple afirmativo: I wake up / I have breakfast / I go to school",
      "Expresiones de tiempo: in the morning, at noon, in the evening, at night",
      "Lectura: A Student's Daily Routine (comprensión literal e inferencial)",
      "Present Simple negativo: I don't wake up late / I don't have lunch at home",
      "Escucha activa: My Classmate's Routine — Listening Comprehension",
      "Preguntas: Do you...? / What time do you...? (Yes/No & Wh-questions)",
      "Adverbios de frecuencia: always, usually, sometimes, never",
      "Tercera persona singular: She wakes up / He goes to school (verb + -s)",
      "Escritura guiada: Describing Someone Else's Daily Routine",
      "Revisión integrada: gramática, vocabulario y práctica oral",
    ],
    fase2: [
      "Producción oral: Presenting My Daily Routine to the class",
      "Escritura: My Daily Routine Paragraph — borrador inicial",
      "Revisión por pares y mejora del párrafo / Peer Editing Session",
      "Producto final: Daily Routine Infographic / Poster",
    ],
    fase3: [
      "Organización y redacción del producto final",
      "Refinamiento: correcciones e incorporación de retroalimentación",
      "Ensayo de presentación oral / Rehearsing the Presentation",
      "Exposición final y autoevaluación / coevaluación",
      "Metacognición y cierre de la unidad",
    ],
  },
  {
    test: /greet|salud|introduc|hello|hi\b|presentation|presentaci/i,
    fase0: [
      "Diagnóstico: ¿Qué expresiones de saludo conoces en inglés?",
      "Vocabulario de entrada: Greetings and Basic Expressions",
    ],
    fase1: [
      "Saludos y expresiones básicas: Hello! / Good morning! / How are you?",
      "Información personal: My name is... / I'm from... / I'm ___ years old",
      "Escucha: Introduction Dialogues — Listening Comprehension",
      "Preguntas personales: What's your name? / Where are you from?",
      "Descripción personal: I like / I don't like / My favorite is...",
      "Diálogos formales e informales: Nice to meet you / Pleased to meet you",
      "Speaking: Pair Introductions — diálogo de presentación en parejas",
      "Escritura: About Me — párrafo de presentación personal",
    ],
    fase2: [
      "Producción oral: Self-Introduction Presentation",
      "Escritura: My Personal Profile — borrador y revisión",
      "Revisión por pares / Peer Editing Session",
      "Producto final: Identity Card / Personal Poster",
    ],
    fase3: [
      "Organización y redacción del producto final: perfil personal",
      "Refinamiento y ensayo de la presentación",
      "Exposición del producto final ante el grupo",
      "Metacognición y cierre de la unidad",
    ],
  },
  {
    test: /famil|family|relatives|mi familia/i,
    fase0: [
      "Diagnóstico: Family Vocabulary — ¿Qué miembros de la familia conoces?",
      "Vocabulario de entrada: Family Members y relaciones familiares",
    ],
    fase1: [
      "Vocabulario: Family Members — mother, father, sister, brother, grandparents",
      "Adjetivos posesivos: my, your, his, her, our, their",
      "Descripción física: tall, short, young, old, kind, funny, hard-working",
      "Lectura: My Family (comprensión literal e inferencial)",
      "Present Simple con familia: My mother works / My father likes...",
      "Actividades familiares: What do you do together as a family?",
      "Escucha: A Family Day — Listening Activity",
      "Escritura: My Family — párrafo descriptivo",
    ],
    fase2: [
      "Producción oral: Presenting My Family to the class",
      "Escritura: My Family Tree Description — borrador y revisión",
      "Revisión por pares / Peer Editing Session",
      "Producto final: Family Album / Family Poster",
    ],
    fase3: [
      "Organización y redacción del producto final: álbum familiar",
      "Refinamiento y ensayo de la presentación",
      "Exposición del producto final ante el grupo",
      "Metacognición y cierre de la unidad",
    ],
  },
  {
    test: /food|comida|nutrition|nutrici|healthy|saludable|eat|comer|meal|aliment/i,
    fase0: [
      "Diagnóstico: Food Vocabulary — ¿Qué alimentos conoces en inglés?",
      "Vocabulario de entrada: Foods, Meals and Healthy Habits",
    ],
    fase1: [
      "Vocabulario: Foods and Meals — breakfast, lunch, dinner, snack",
      "Grupos alimenticios: Food Groups and Nutrition Basics",
      "Expresiones de gusto: I like / I don't like / I love / I hate + food",
      "Lectura: A Healthy Menu (comprensión lectora)",
      "Adjetivos descriptivos: delicious, healthy, sweet, salty, fresh, tasty",
      "Preguntas: What do you eat for breakfast? / Do you like vegetables?",
      "Escucha: My Favorite Foods — Listening Activity",
      "Escritura: My Healthy Menu — menú saludable descriptivo",
    ],
    fase2: [
      "Producción oral: Describing My Favorite Meal",
      "Escritura: A Healthy Menu / Recipe — borrador y revisión",
      "Revisión por pares / Peer Editing Session",
      "Producto final: Nutrition Poster / Recipe Book",
    ],
    fase3: [
      "Organización y redacción del producto final: menú o libro de recetas",
      "Refinamiento y ensayo de la presentación",
      "Exposición del producto final ante el grupo",
      "Metacognición y cierre de la unidad",
    ],
  },
  {
    test: /weather|clima|season|estaci|temperature|temperatura/i,
    fase0: [
      "Diagnóstico: Weather Vocabulary — ¿Cómo describes el tiempo en inglés?",
      "Vocabulario de entrada: Weather Conditions and Seasons",
    ],
    fase1: [
      "Vocabulario del tiempo: sunny, rainy, cloudy, windy, hot, cold, warm",
      "Las estaciones: spring, summer, autumn/fall, winter y sus actividades",
      "Gramática: It's + adjective (It's sunny today / It rains a lot in...)",
      "Lectura: Weather Around the World (comprensión lectora)",
      "Ropa según el clima: What do you wear when it's cold/rainy/hot?",
      "Preguntas: What's the weather like? / How's the weather today?",
      "Escucha: The Weather Forecast — Listening Activity",
      "Escritura: Weather in My Community — descripción climática",
    ],
    fase2: [
      "Producción oral: My Weather Report Presentation",
      "Escritura: A Day in My Town — borrador y revisión",
      "Revisión por pares / Peer Editing Session",
      "Producto final: Weather Poster / Climate Report",
    ],
    fase3: [
      "Organización y redacción del producto final: reporte climático",
      "Refinamiento y ensayo de la presentación",
      "Exposición del producto final ante el grupo",
      "Metacognición y cierre de la unidad",
    ],
  },
  {
    test: /body|cuerpo|body parts|partes del cuerpo/i,
    fase0: [
      "Diagnóstico: Body Parts Vocabulary — ¿Qué partes del cuerpo conoces?",
      "Vocabulario de entrada: The Human Body and Health Habits",
    ],
    fase1: [
      "Vocabulario: Body Parts — head, arms, legs, hands, feet, eyes, nose, mouth",
      "Hábitos saludables: exercise, rest, nutrition, hygiene, sleep",
      "Imperativo para instrucciones: Touch your head! / Clap your hands!",
      "Lectura: Healthy Habits (comprensión lectora)",
      "Adjetivos de salud: healthy, sick, tired, strong, weak, fit",
      "Preguntas de salud: How do you feel today? / What's the matter?",
      "Escucha: At the Doctor's Office — Listening Activity",
      "Escritura: My Healthy Habits — descripción personal",
    ],
    fase2: [
      "Producción oral: My Body and Healthy Habits Presentation",
      "Escritura: A Health Flyer — borrador y revisión",
      "Revisión por pares / Peer Editing Session",
      "Producto final: Health Poster / Body Map",
    ],
    fase3: [
      "Organización y redacción del producto final: póster de salud",
      "Refinamiento y ensayo de la presentación",
      "Exposición del producto final ante el grupo",
      "Metacognición y cierre de la unidad",
    ],
  },
  {
    test: /school|escuela|community|comunidad|classroom|aula|places|lugares/i,
    fase0: [
      "Diagnóstico: School and Community Places — ¿Qué lugares conoces?",
      "Vocabulario de entrada: School Places and Community Vocabulary",
    ],
    fase1: [
      "Vocabulario escolar: classroom, library, cafeteria, gym, office, hall",
      "Preposiciones de lugar: in, on, at, next to, behind, in front of",
      "Lugares de la comunidad: park, market, church, hospital, store, bank",
      "Lectura: My School and Community (comprensión lectora)",
      "Gramática: There is / There are — describing places",
      "Preguntas: Where is the...? / Is there a...? / How do I get to...?",
      "Escucha: A Tour of the Community — Listening Activity",
      "Escritura: My Community — descripción del entorno",
    ],
    fase2: [
      "Producción oral: A Tour of My School Presentation",
      "Escritura: My Community Map — borrador y descripción",
      "Revisión por pares / Peer Editing Session",
      "Producto final: Community Map / School Guide",
    ],
    fase3: [
      "Organización y redacción del producto final: mapa o guía",
      "Refinamiento y ensayo de la presentación",
      "Exposición del producto final ante el grupo",
      "Metacognición y cierre de la unidad",
    ],
  },
];

// ─── Títulos específicos por día para otras áreas (no idiomas) ───────────────
//
// Progresiones pedagógicas por fase, independientes del tema específico.
// Más descriptivas que los títulos genéricos de TITULOS_FASE.

const _TITULOS_AREA = {
  "Matemática": {
    fase0: [
      "Diagnóstico: saberes previos y exploración de la situación",
      "Presentación de la situación de aprendizaje y motivación inicial",
    ],
    fase1: [
      "Introducción de conceptos: definiciones, propiedades y notación",
      "Representación: modelos concretos, gráficos y simbólicos",
      "Procedimiento guiado: análisis paso a paso con ejemplos",
      "Práctica colaborativa: ejercicios en parejas y grupos",
      "Ejercitación: resolución de problemas con complejidad progresiva",
      "Aplicación: resolución en situaciones contextualizadas",
      "Consolidación: conexión con otros conceptos matemáticos",
    ],
    fase2: [
      "Aplicación avanzada: problemas de mayor complejidad",
      "Producción: construcción del producto matemático",
      "Revisión por pares y mejora de producciones",
      "Preparación y refinamiento del producto final",
    ],
    fase3: [
      "Organización y presentación del producto matemático",
      "Refinamiento: ajustes finales e incorporación de sugerencias",
      "Exposición del producto ante el grupo",
      "Autoevaluación, metacognición y cierre de la unidad",
    ],
  },
  "Lengua Española": {
    fase0: [
      "Diagnóstico: saberes previos sobre el tipo de texto y el tema",
      "Exploración: presentación de la situación comunicativa",
    ],
    fase1: [
      "Lectura del texto modelo: estructura, propósito y características",
      "Gramática en contexto: análisis de los elementos lingüísticos clave",
      "Vocabulario: palabras y expresiones del área y del tipo de texto",
      "Práctica oral: participación en situaciones comunicativas",
      "Comprensión lectora: niveles literal, inferencial y crítico",
      "Producción escrita guiada: borrador con andamiaje",
      "Revisión gramatical y ortográfica: corrección y mejora del borrador",
    ],
    fase2: [
      "Producción oral: exposición, debate o presentación",
      "Escritura con mayor autonomía: segunda versión del texto",
      "Revisión por pares y mejora con retroalimentación",
      "Preparación y refinamiento de la producción final",
    ],
    fase3: [
      "Organización y presentación de la producción final",
      "Refinamiento: correcciones e incorporación de sugerencias",
      "Exposición oral del texto o producción ante el grupo",
      "Metacognición y cierre: reflexión sobre el proceso comunicativo",
    ],
  },
  "Ciencias de la Naturaleza": {
    fase0: [
      "Diagnóstico: saberes previos y formulación de hipótesis iniciales",
      "Exploración: presentación del fenómeno o problema científico",
    ],
    fase1: [
      "Observación sistemática: registro de datos y primeras evidencias",
      "Vocabulario científico: términos y conceptos clave del tema",
      "Investigación guiada: indagación con metodología científica",
      "Experimentación: práctica de laboratorio o exploración de campo",
      "Análisis de datos: interpretación y discusión de resultados",
      "Conexión: relación con otros fenómenos naturales y el entorno",
      "Explicación científica: síntesis con evidencia (Afirmación-Evidencia-Razonamiento)",
    ],
    fase2: [
      "Producción: elaboración del informe o producto científico",
      "Revisión: análisis crítico y mejora de conclusiones",
      "Preparación del producto científico final",
      "Presentación y defensa preliminar de hallazgos",
    ],
    fase3: [
      "Organización del informe o proyecto científico final",
      "Refinamiento: correcciones e incorporación de retroalimentación",
      "Exposición científica: presentación de hallazgos al grupo",
      "Metacognición, transferencia y cierre de la unidad",
    ],
  },
  "Ciencias Sociales": {
    fase0: [
      "Diagnóstico: saberes previos y exploración de fuentes iniciales",
      "Presentación del contexto histórico-social y preguntas de investigación",
    ],
    fase1: [
      "Análisis de fuentes primarias y secundarias sobre el tema",
      "Organización: línea de tiempo, mapa conceptual o cuadro comparativo",
      "Relaciones de causalidad: causas y consecuencias del proceso",
      "Perspectivas: análisis desde diferentes actores y contextos",
      "Argumentación: posición fundamentada en evidencia",
      "Conexión: relación del tema con el contexto nacional y comunitario",
      "Síntesis histórico-social: consolidación de los aprendizajes",
    ],
    fase2: [
      "Producción: ensayo argumentativo o proyecto de investigación",
      "Revisión y enriquecimiento de la producción",
      "Preparación visual y oral del producto final",
      "Presentación preliminar y retroalimentación",
    ],
    fase3: [
      "Organización del producto investigativo final",
      "Refinamiento: correcciones e incorporación de sugerencias",
      "Exposición ante el grupo: defensa con argumentos y evidencia",
      "Metacognición ciudadana y cierre de la unidad",
    ],
  },
  "Educación Artística": {
    fase0: [
      "Diagnóstico: exploración de saberes previos y apreciación inicial",
      "Presentación: contextualización del tema artístico y motivación",
    ],
    fase1: [
      "Elementos del lenguaje artístico: conceptos y vocabulario clave",
      "Apreciación: análisis de obras y producciones de referencia",
      "Exploración técnica: experimentación con materiales y herramientas",
      "Práctica guiada: ejercicios de técnica con andamiaje",
      "Expresión creativa: producción personal con intención artística",
      "Reflexión estética: análisis de producciones propias y ajenas",
      "Consolidación técnica y conceptual del lenguaje artístico",
    ],
    fase2: [
      "Producción: desarrollo de la obra o proyecto artístico",
      "Revisión: crítica constructiva y mejora de la producción",
      "Preparación de la exposición o presentación final",
      "Refinamiento y acabado de la obra final",
    ],
    fase3: [
      "Organización y montaje de la exposición o presentación",
      "Presentación del producto artístico ante el grupo",
      "Reflexión estética y autoevaluación del proceso creativo",
      "Metacognición y cierre: ¿qué aprendí como artista?",
    ],
  },
  "Educación Física": {
    fase0: [
      "Diagnóstico: evaluación de condición física y saberes previos",
      "Presentación: exploración de las capacidades motrices del tema",
    ],
    fase1: [
      "Calentamiento específico: activación motriz vinculada al tema",
      "Aprendizaje técnico: demostración y práctica de habilidades",
      "Práctica guiada: ejercicios con retroalimentación inmediata",
      "Trabajo colaborativo: actividades en parejas y grupos",
      "Aplicación en juego: transferencia a situaciones de juego real",
      "Táctica y estrategia: comprensión del juego y toma de decisiones",
      "Consolidación: práctica autónoma y retroalimentación formativa",
    ],
    fase2: [
      "Aplicación en situaciones complejas: mini-torneos o pruebas",
      "Producción del proyecto de actividad física o reglamento",
      "Revisión y mejora de habilidades con retroalimentación de pares",
      "Preparación del evento deportivo o demostración final",
    ],
    fase3: [
      "Demostración de habilidades: práctica final evaluada",
      "Evento deportivo o exposición del proyecto físico",
      "Autoevaluación: valoración del progreso físico personal",
      "Metacognición y cierre: hábitos de vida activa y salud",
    ],
  },
  "Formación Integral Humana y Religiosa": {
    fase0: [
      "Diagnóstico: reflexión inicial sobre el tema de vida",
      "Exploración: presentación del dilema o situación ética",
    ],
    fase1: [
      "Diálogo de saberes: experiencias personales y comunitarias",
      "Análisis ético: principios, valores y dilemas morales",
      "Perspectivas religiosas y filosóficas sobre el tema",
      "Reflexión crítica: implicaciones para la vida cotidiana",
      "Acción solidaria: propuestas de transformación comunitaria",
      "Espiritualidad y sentido: dimensión trascendente del tema",
      "Consolidación: síntesis ética y compromiso personal",
    ],
    fase2: [
      "Producción: proyecto de servicio, reflexión escrita o debate",
      "Revisión y enriquecimiento de la propuesta ética",
      "Preparación de la presentación o acción comunitaria",
      "Ensayo: práctica de la presentación o propuesta final",
    ],
    fase3: [
      "Presentación del proyecto ético o de servicio comunitario",
      "Reflexión grupal: impacto del aprendizaje en la vida personal",
      "Celebración y reconocimiento de los compromisos asumidos",
      "Metacognición y cierre: ¿cómo me transformó este aprendizaje?",
    ],
  },
};

const _getTituloEspecificoDia = (area, tema, faseIdx, numDia) => {
  const faseKey = ["fase0", "fase1", "fase2", "fase3"][faseIdx];

  // Para Inglés: buscar en banco temático primero
  if (area === "Inglés") {
    const banco = _BANCO_TITULOS_DIA.find((b) => b.test.test(tema));
    if (banco) {
      const titulos = banco[faseKey];
      if (titulos?.length > 0) return titulos[Math.min(numDia - 1, titulos.length - 1)];
    }
    // Fallback genérico para Inglés sin tema reconocido
    const genericoIngles = {
      fase0: ["Diagnóstico: saberes previos en inglés — Prior Knowledge Assessment", "Vocabulario de entrada: palabras clave de la unidad"],
      fase1: ["Vocabulario: palabras y expresiones clave en inglés", "Gramática en contexto: estructura y uso", "Lectura: comprensión literal e inferencial", "Escucha activa: Listening Comprehension", "Producción oral: Speaking Practice", "Escritura guiada: producción escrita con modelo", "Revisión y consolidación: gramática, vocabulario y habilidades"],
      fase2: ["Producción oral: presentación en inglés", "Escritura: borrador del producto final", "Revisión por pares / Peer Editing Session", "Producto final: producción comunicativa integrada"],
      fase3: ["Organización y redacción del producto final", "Refinamiento e incorporación de retroalimentación", "Exposición final en inglés", "Metacognición y cierre de la unidad"],
    };
    const tit = genericoIngles[faseKey];
    if (tit?.length > 0) return tit[Math.min(numDia - 1, tit.length - 1)];
    return null;
  }

  // Para otras áreas: usar banco por área
  const bancoArea = _TITULOS_AREA[area];
  if (!bancoArea) return null;
  const titulos = bancoArea[faseKey];
  if (!titulos?.length) return null;
  return titulos[Math.min(numDia - 1, titulos.length - 1)];
};

// ─── Generador principal de días y fases ─────────────────────────────────────

const generarDia = (numDia, area, tema, faseIdx, totalDiasFase, _productoFinal = "", mc = {}, durMin = 45) => {
  // Título e intención según fase y posición del día
  const titulosF = TITULOS_FASE[faseIdx] || TITULOS_FASE[1];
  const tituloGenerico = titulosF[Math.min(numDia - 1, titulosF.length - 1)];
  const tituloEspecifico = _getTituloEspecificoDia(area, tema, faseIdx, numDia);
  const titulo = tituloEspecifico || tituloGenerico;
  const intencionesF = INTENCIONES_FASE[faseIdx] || INTENCIONES_FASE[1];
  const intencionFn = intencionesF[Math.min(numDia - 1, intencionesF.length - 1)];
  const intencionPedagogica = intencionFn(tema);

  // Selección de actividades según fase (fase 4 usa generadores propios)
  const diaIdx = numDia - 1;
  const actsInicio   = faseIdx === 3 ? getActsFase4Inicio(area, tema, numDia, totalDiasFase)     : getActsInicio(area, tema, faseIdx, diaIdx, mc);
  const actsDesarrollo = faseIdx === 3 ? getActsFase4Desarrollo(area, tema, numDia, totalDiasFase) : getActsDesarrollo(area, tema, faseIdx, diaIdx, mc);
  const actsCierre   = faseIdx === 3 ? getActsFase4Cierre(area, tema, numDia, totalDiasFase)     : getActsCierre(area, tema, faseIdx, diaIdx, mc);

  // Evaluación determinística por momento+fase (TABLA_EVALUACION)
  const esFaseFinal = faseIdx === 3;

  // Evidencias de Fase 4 (más específicas)
  const evidF4 = {
    Inicio:    "Disposición y organización:\n• Muestra claridad sobre los criterios de calidad del producto final.\n• Organiza el trabajo del día con autonomía y propósito.",
    Desarrollo: "Producto final:\n• Desarrolla o perfecciona el producto final con calidad y coherencia.\n• Aplica los aprendizajes de la unidad en una producción auténtica.\n• Demuestra dominio de los contenidos trabajados.",
    Cierre:    "Metacognición y evaluación:\n• Autoevalúa su desempeño con criterio y honestidad.\n• Coevalúa las producciones de sus compañeros de manera constructiva.\n• Reflexiona sobre el proceso y los logros alcanzados en la unidad.",
  };

  // R7: tiempos proporcionales a la duración real de clase
  // 45 min → 10/30/5 · 60 min → 10/40/10 · 90 min → 15/65/10
  const tInicio     = durMin <= 50 ? 10 : 15;
  const tCierre     = durMin <= 50 ? 5  : 10;
  const tDesarrollo = durMin - tInicio - tCierre;

  const mkMomento = (nombre, tiempo, acts) => ({
    nombre,
    tiempo,
    actividades: acts,
    evidencias: faseIdx === 3 ? evidF4[nombre] : getEvidencias(area, nombre, faseIdx),
    evaluacion: getEvaluacion(nombre, esFaseFinal),
    recursos: derivarRecursos(acts, area, faseIdx + 1),
    metacognicion: getMetacognicion(nombre, area, tema),
  });

  const etapaProgresion = getEtapaProgresion(faseIdx, numDia, totalDiasFase);
  // criteriosExito se deriva de las evidencias reales de la IA en el merge
  const criteriosExito = [];
  const aporteProducto = getAporteProducto(area, faseIdx, numDia, totalDiasFase, tema);

  return {
    numero: numDia,
    titulo,
    etapaProgresion,
    criteriosExito,
    aporteProducto,
    intencionPedagogica,
    momentos: [
      mkMomento("Inicio",     `${tInicio} min`,     actsInicio),
      mkMomento("Desarrollo", `${tDesarrollo} min`, actsDesarrollo),
      mkMomento("Cierre",     `${tCierre} min`,     actsCierre),
    ],
    adaptacionesNEAE: {
      acceso: "Ubicar a los estudiantes con NEAE cerca del docente y la pizarra. Proveer materiales con letra ampliada si aplica.",
      metodologicas: "Simplificar instrucciones, permitir tiempo adicional y ofrecer materiales concretos y visuales como apoyo.",
      evaluacion: "Evaluar los mismos criterios adaptando el nivel de complejidad y el tipo de respuesta esperado.",
    },
    // Derivado de TABLA_EVALUACION (misma fuente que la columna Evaluación de
    // cada momento) — documento y resumen siempre consistentes.
    resumenEvaluacion: (() => {
      const evaluaciones = ["Inicio", "Desarrollo", "Cierre"].map((mom) => getEvaluacion(mom, esFaseFinal));
      return {
        tecnicas: [...new Set(evaluaciones.map((e) => e.tecnica))],
        instrumentos: [...new Set(evaluaciones.map((e) => e.instrumento))],
        criterioPuntuacion: "El docente selecciona los instrumentos que aplicará ese día y define la puntuación según la complejidad del tema.",
        observaciones: esFaseFinal
          ? "Registrar los logros del producto final, el nivel de participación en la exposición y el desempeño en la auto y coevaluación."
          : "Registrar el desempeño general del grupo e identificar estudiantes que requieren atención diferenciada o refuerzo.",
      };
    })(),
  };
};

const DIAS_ORDEN = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

const generarFases = (numSemanas, schedule, area, tema, estrategia, productoFinal = "", contexto = {}, mallaContenidos = {}) => {
  const { diasClase, horasPorDia, duracionHoraClase } = schedule;
  const horasSemanales = diasClase.length * horasPorDia;
  const totalHorasClase = numSemanas * horasSemanales;

  // Calcular complejidad del tema para distribuir las fases de forma pedagógicamente apropiada
  const compx = analizarComplejidad({
    area,
    titulo: tema,
    productoFinal,
    grado: contexto.grado || "",
    nivel: contexto.nivel || "Secundaria",
  });
  const distribucion = calcularDistribucion(totalHorasClase, productoFinal, compx.nivelClave);

  const fases = distribucion.map((numHoras, faseIdx) => ({
    numero: faseIdx + 1,
    nombre: NOMBRES_FASES[faseIdx],
    estrategia,
    indicadoresAvance: [], // derivados de los indicadores trabajados reales en el merge
    posiblesDificultades: getPosiblesDificultades(area, faseIdx),
    dias: Array.from({ length: numHoras }, (_, d) =>
      generarDia(d + 1, area, tema, faseIdx, numHoras, productoFinal, mallaContenidos, duracionHoraClase)
    ),
  }));

  // Generar ranuras de calendario: semana → día → hora
  const slots = [];
  for (let sem = 1; sem <= numSemanas; sem++) {
    for (const diaCalendario of diasClase) {
      for (let hora = 1; hora <= horasPorDia; hora++) {
        slots.push({ semana: sem, diaCalendario, hora });
      }
    }
  }

  // Asignar ranura y número global de clase a cada día
  let slotIdx = 0;
  let claseGlobal = 0;
  fases.forEach((fase) => {
    fase.dias.forEach((dia) => {
      dia.numeroGlobal = ++claseGlobal;
      if (slotIdx < slots.length) {
        const s = slots[slotIdx++];
        dia.semana = s.semana;
        dia.diaCalendario = s.diaCalendario;
        dia.hora = s.hora;
        dia.mostrarHora = horasPorDia > 1;
        dia.duracionMin = duracionHoraClase;
      }
    });
  });

  return fases;
};

// ─── Análisis de complejidad curricular ──────────────────────────────────────

const _justificaciones = {
  baja: (tema) =>
    `El tema "${tema}" se centra en vocabulario y conceptos básicos que pueden desarrollarse en pocas sesiones con práctica repetida y contextos cotidianos. Los indicadores de logro pueden alcanzarse sin extender la unidad más allá de lo necesario, evitando redundancias pedagógicas.`,
  media: (tema) =>
    `El tema "${tema}" requiere trabajar vocabulario específico, estructuras procedimentales y producción oral/escrita. La complejidad curricular permite desarrollar las competencias e indicadores en un rango intermedio de encuentros sin generar actividades repetitivas.`,
  alta: (tema) =>
    `El tema "${tema}" integra múltiples habilidades (comprensión, producción, análisis crítico) y requiere un proceso progresivo para alcanzar los indicadores de logro. Un mayor número de encuentros garantiza una progresión sólida sin apresurar el proceso de aprendizaje.`,
  muyAlta: (tema) =>
    `El tema "${tema}" integra lectura, escritura, producción oral, investigación, pensamiento crítico, vocabulario especializado y presentación de productos complejos. Requiere una unidad extensa para garantizar el dominio real de las competencias sin sacrificar la calidad de los aprendizajes.`,
};

export const analizarComplejidad = ({ area = "", grado = "", nivel = "", titulo = "", productoFinal = "" }) => {
  const tema = titulo.trim();
  const txt = `${tema} ${productoFinal}`.toLowerCase();
  let score = 0;

  // ── Palabras clave del tema ──
  const temaSimple = /^(colors?|numbers?|greetings?|body parts?|parts of the house|classroom|family|pets|clothes|food|days|months|seasons|shapes|toys|weather|animals|colores?|números?|saludos?|partes del cuerpo|partes de la casa|familia|animales|ropa|comidas?|d[ií]as|meses|estaciones|figuras|juguetes|tiempo)\b/i.test(tema);
  const temaMuyComplejo = /proyecto integrador|investigaci[oó]n cient[ií]fica|producci[oó]n multimedia|portafolio integrado|integrated project|science.*technology|technology.*communication|ciencia.*tecnolog|tecnolog.*comunicaci[oó]n/i.test(txt);
  const temaComplejo = /tecnolog[ií]a|comunicaci[oó]n|ciencia|sociedad|cultura|historia|econom[ií]a|medio ambiente|salud|derechos|investigaci[oó]n|technology|communication|science|society|culture|history|economy|environment|health|rights|diversity|sustainability|globalizaci[oó]n|globalization/i.test(txt);

  if (temaMuyComplejo) score += 70;
  else if (temaComplejo) score += 45;
  else if (temaSimple) score += 8;
  else score += 22;

  // ── Longitud del título ──
  const palabras = tema.split(/\s+/).length;
  if (palabras >= 5) score += 18;
  else if (palabras >= 3) score += 10;
  else if (palabras >= 2) score += 5;

  // ── Grado / nivel ──
  if (/secundaria|secondary/i.test(nivel) || /[5-6]to|[5-6]th/i.test(grado)) score += 15;
  else if (/[3-4]ro|[3-4]th/i.test(grado)) score += 8;
  else if (/[1-2]ro|[1-2]st|[1-2]nd/i.test(grado)) score += 3;

  // ── Producto final ──
  if (/exposici[oó]n|proyecto|portafolio|investigaci[oó]n|obra|debate|experimento|mural|informe|podcast|video|book report|science fair|presentaci[oó]n (oral|final)/i.test(productoFinal)) score += 20;
  else if (/lista|tarjeta|ficha|oraci[oó]n|dibujo|p[aá]rrafo breve|cuadro sencillo/i.test(productoFinal)) score -= 8;
  else if (productoFinal) score += 8;

  // ── Área ──
  if (/ciencias sociales|historia|educaci[oó]n f[ií]sica/i.test(area)) score += 5;
  if (/ciencias de la naturaleza|matem[aá]tica/i.test(area)) score += 8;

  score = Math.max(0, Math.min(100, score));

  const CFG = {
    baja:    { emoji: "🟢", etiqueta: "Baja",     semanasMin: 1, semanasMax: 2, semanas: 2, encuentros: "4 – 8"   },
    media:   { emoji: "🟡", etiqueta: "Media",    semanasMin: 3, semanasMax: 4, semanas: 4, encuentros: "12 – 16" },
    alta:    { emoji: "🟠", etiqueta: "Alta",     semanasMin: 5, semanasMax: 6, semanas: 5, encuentros: "20 – 24" },
    muyAlta: { emoji: "🔴", etiqueta: "Muy alta", semanasMin: 7, semanasMax: 8, semanas: 7, encuentros: "28 – 32" },
  };

  const nivelClave = score < 26 ? "baja" : score < 56 ? "media" : score < 76 ? "alta" : "muyAlta";
  const cfg = CFG[nivelClave];

  return {
    nivelClave,
    emoji:             cfg.emoji,
    etiqueta:          cfg.etiqueta,
    semanasMin:        cfg.semanasMin,
    semanasMax:        cfg.semanasMax,
    semanasRecomendadas: cfg.semanas,
    encuentrosRango:   cfg.encuentros,
    justificacion:     _justificaciones[nivelClave](tema || "el tema seleccionado"),
    score,
  };
};

// ─── Motor Especializado v1 — Helpers curriculares ───────────────────────────

// Corpus: payload.temas es array de strings; también acepta array de objetos con .titulo/.nombre
const _resolverTemaMalla = (tituloDocente, temas) => {
  if (!Array.isArray(temas) || !temas.length) return null;
  const getText = (t) => (typeof t === 'string' ? t : (t.titulo || t.nombre || t.topico || ''));
  const lower   = (tituloDocente || '').toLowerCase();
  let match = temas.find(t => getText(t).toLowerCase() === lower);
  if (!match) {
    match = temas.find(t => lower.includes(getText(t).toLowerCase()) && getText(t))
         || temas.find(t => getText(t).toLowerCase().includes(lower) && lower.length > 3);
  }
  if (!match) {
    const words = lower.split(/\s+/).filter(w => w.length > 3);
    let bestScore = 0;
    for (const t of temas) {
      const score = words.filter(w => getText(t).toLowerCase().includes(w)).length;
      if (score > bestScore) { bestScore = score; match = t; }
    }
  }
  // Siempre devuelve el texto del tema (string), no el objeto
  return match ? getText(match) : getText(temas[0]);
};

// Filtra ítems del corpus por tema (campo tema/topico) cuando el corpus
// segmenta; si ninguno coincide o no hay segmentación, devuelve todos.
const _filtrarPorTema = (items, temaFiltro) => {
  if (!Array.isArray(items) || !items.length || !temaFiltro) return items || [];
  const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const objetivo = norm(temaFiltro);
  const conTema = items.filter((it) => it && typeof it === 'object' && (it.tema || it.topico));
  if (!conTema.length) return items;
  const delTema = conTema.filter((it) => {
    const t = norm(it.tema || it.topico);
    return t === objetivo || t.includes(objetivo) || objetivo.includes(t);
  });
  return delTema.length ? delTema : items;
};

// Lee del payload de nivel-grado del corpus: contenidos.conceptos + contenidos.procedimientos
const _extraerContenidosMallaCorpus = (mallaPayload, temaFiltro = '') => {
  const c = mallaPayload?.contenidos?.conceptos    || {};
  const p = mallaPayload?.contenidos?.procedimientos || {};

  // v1.3 grade-level paths — subconjunto del tema cuando el corpus lo segmenta
  // (ítems con campo tema/topico); si no segmenta, nivel-grado completo
  // (sigue siendo malla oficial, nunca plantilla)
  const vocabRaw  = _filtrarPorTema(Array.isArray(c.vocabulario) ? c.vocabulario : [], temaFiltro);
  let vocabulario = vocabRaw.flatMap(v =>
    Array.isArray(v.ejemplos) ? v.ejemplos : (typeof v === 'string' ? [v] : [])
  );
  const gramRaw = _filtrarPorTema(Array.isArray(c.gramatica) ? c.gramatica : [], temaFiltro);
  let gramatica = gramRaw.map(g => g.estructura || (typeof g === 'string' ? g : '')).filter(Boolean);
  const exprRaw   = _filtrarPorTema(Array.isArray(c.expresiones) ? c.expresiones : [], temaFiltro);
  const expresiones = exprRaw.flatMap(e =>
    Array.isArray(e.ejemplos) ? e.ejemplos : (typeof e === 'string' ? [e] : [])
  );
  let funcionales = _filtrarPorTema(Array.isArray(p.funcionales) ? p.funcionales : [], temaFiltro)
    .map((f) => (typeof f === 'string' ? f : (f.descripcion || f.texto || f.funcion || '')))
    .filter(Boolean);

  // v1.1 fallback: per-tema arrays (vocabulario/gramatica/funcionales at temas[i] level)
  if (!vocabulario.length && Array.isArray(mallaPayload.temas)) {
    const temaObj = mallaPayload.temas.find(t => typeof t === 'object' && t !== null);
    if (temaObj) {
      vocabulario = Array.isArray(temaObj.vocabulario) ? temaObj.vocabulario : [];
      if (!gramatica.length) gramatica = Array.isArray(temaObj.gramatica) ? temaObj.gramatica : [];
      if (!funcionales.length) funcionales = Array.isArray(temaObj.funcionales) ? temaObj.funcionales : [];
    }
  }

  const conceptuales    = [...vocabulario.slice(0, 6), ...gramatica.slice(0, 3)].filter(Boolean);
  const procedimentales = funcionales.slice(0, 6).filter(Boolean);

  return { vocabulario, gramatica, expresiones, funcionales, conceptuales, procedimentales };
};

// ─── Phase A: genera fases con IA y reemplaza momentos JS ────────────────────
//
// Llama generarFases() para obtener estructura + calendario, luego para cada
// semana llama la IA (1 llamada → N clases) y sobreescribe los momentos.
// SIN FALLBACK: si la IA falla tras los reintentos, la excepción sube al caller.

const _generarFasesConIA = async (
  numSemanas, schedule, area, tema, estrategia, productoFinal,
  contexto, mallaContenidos,
  mallaPayload, allInds, allComps, durMin, grado,
  onProgress = null,
) => {
  const fases = generarFases(numSemanas, schedule, area, tema, estrategia, productoFinal, contexto, mallaContenidos);

  const spec = buildEspecificacionCurricular({
    mallaPayload, titulo: tema, allInds, allComps, mallaContenidos, area, grado,
  });

  const memoriaAcumulada = [];
  const totalClases = fases.reduce((sum, f) => sum + f.dias.length, 0);
  let globalOffset = 0;

  for (const fase of fases) {
    const numClases = fase.dias.length;

    const progressWrapper = onProgress
      ? (startDia, endDia) => {
          const globalStart = globalOffset + startDia;
          const globalEnd   = globalOffset + endDia;
          onProgress(`Componiendo clases ${globalStart}–${globalEnd} de ${totalClases}...`);
        }
      : null;

    // Si la IA falla tras los reintentos por lote, generateWeekPlan lanza y la
    // generación SE DETIENE con el error visible (mensaje + reintento manual).
    // VETADO degradar a plantillas: el docente nunca debe recibir una unidad
    // genérica creyendo que es curricular.
    // FUTURO: cuando exista el Banco de Secuencias, el respaldo legítimo es
    // servir una secuencia cosechada y validada — nunca plantillas.
    const weekPlan = await generateWeekPlan(
      spec, fase.numero, durMin, numClases, numSemanas,
      memoriaAcumulada, progressWrapper,
    );

    weekPlan.clases.slice(0, numClases).forEach((aiClase, i) => {
      const dia = fase.dias[i];
      if (!dia) {
        throw new Error(`R3: clase IA ${i + 1} de la semana ${fase.numero} sin día calendario correspondiente`);
      }

      if (aiClase.titulo) dia.tituloIA = aiClase.titulo;

      // MERGE: la estructura base (generarDia) aporta SOLO forma (momentos,
      // tiempos, calendario). TODO el contenido semántico del momento viene
      // del contrato de la IA: actividades, evidencias, metacognición y
      // recursos didácticos. La evaluación es determinística (TABLA_EVALUACION)
      // y no se toca. Si falta cualquier campo del contrato, se DETIENE:
      // dejar contenido de plantilla sería degradar a genérico en silencio.
      aiClase.momentos.slice(0, 3).forEach((aiMom, mi) => {
        const orig = dia.momentos?.[mi];
        if (!orig) {
          throw new Error(`R3: semana ${fase.numero}, clase ${dia.dia || i + 1} — momento ${mi + 1} inexistente en la estructura base`);
        }
        const etiqueta = `semana ${fase.numero}, clase ${dia.dia || i + 1}, "${orig.nombre || `momento ${mi + 1}`}"`;
        const listaOk = (v) => Array.isArray(v) && v.filter((x) => String(x || "").trim()).length > 0;
        if (!listaOk(aiMom.actividades)) throw new Error(`R3: ${etiqueta} — la IA no aportó actividades (plantillas vetadas como respaldo)`);
        if (!listaOk(aiMom.evidencias)) throw new Error(`R3: ${etiqueta} — la IA no aportó evidencias (plantillas vetadas como respaldo)`);
        if (!listaOk(aiMom.metacognicion)) throw new Error(`R3: ${etiqueta} — la IA no aportó metacognición (plantillas vetadas como respaldo)`);
        if (!listaOk(aiMom.recursos)) throw new Error(`R3: ${etiqueta} — la IA no aportó recursos (plantillas vetadas como respaldo)`);

        orig.actividades = aiMom.actividades;
        if (aiMom.tiempo) orig.tiempo = aiMom.tiempo;
        orig.evidencias = aiMom.evidencias.map((e) => `• ${String(e).trim()}`).join("\n");
        orig.metacognicion = aiMom.metacognicion;
        orig.recursos = {
          humanos: "Docente y estudiantes",
          didacticos: aiMom.recursos.map((r) => String(r).trim()).filter(Boolean).join(", "),
          // Tecnológicos: derivación determinística desde las actividades reales de la IA
          tecnologicos: derivarRecursos(aiMom.actividades, area, fase.numero).tecnologicos,
        };
      });

      // "Hoy tendrás éxito si…": derivado de las evidencias reales de la clase
      // (Desarrollo + Cierre), no de un checklist fijo idéntico entre clases.
      const evidenciasClase = [
        ...(aiClase.momentos[1]?.evidencias || []).slice(0, 3),
        ...(aiClase.momentos[2]?.evidencias || []).slice(0, 1),
      ].map((e) => String(e).trim()).filter(Boolean);
      if (evidenciasClase.length) {
        dia.criteriosExito = evidenciasClase.map((e) => `☐ ${e.replace(/\.$/, "")}.`);
      }

      // R3: contrato — todos los campos del render deben estar presentes post-merge
      for (const mom of dia.momentos || []) {
        if (!mom.evaluacion?.tipo)
          throw new Error(`R3: "${mom.nombre}" falta evaluacion.tipo — revisar TABLA_EVALUACION`);
        if (!mom.evidencias)
          throw new Error(`R3: "${mom.nombre}" falta evidencias — revisar contrato de phaseA`);
        if (!mom.recursos?.didacticos)
          throw new Error(`R3: "${mom.nombre}" falta recursos — revisar contrato de phaseA`);
        if (!Array.isArray(mom.metacognicion) || !mom.metacognicion.length)
          throw new Error(`R3: "${mom.nombre}" falta metacognicion — revisar contrato de phaseA`);
      }
    });

    // Indicadores de avance de la fase: derivados de los indicadores que las
    // clases de la fase REALMENTE trabajaron (códigos reportados por la IA),
    // resueltos contra la especificación oficial. Fallback: los indicadores
    // oficiales de la malla (nunca checklist de plantilla).
    const normCodigo = (c) => String(c || "").replace(/[[\]\s]/g, "").toUpperCase();
    const codigosTrabajados = new Set(
      weekPlan.clases.flatMap((c) => (Array.isArray(c.indicadoresTrabajados) ? c.indicadoresTrabajados : []))
        .map(normCodigo).filter(Boolean)
    );
    const indicadoresFase = (spec.indicadores || [])
      .filter((ind) => codigosTrabajados.has(normCodigo(ind.codigoOficial || ind.id)))
      .map((ind) => ind.descripcion)
      .filter(Boolean);
    fase.indicadoresAvance = indicadoresFase.length
      ? indicadoresFase
      : (spec.indicadores || []).slice(0, 4).map((ind) => ind.descripcion).filter(Boolean);

    globalOffset += numClases;
  }

  return fases;
};

// ─── Exportación principal ────────────────────────────────────────────────────

export const generarUnidadAprendizaje = async (datos) => {
  const {
    grado = "", seccion = "", area = "", asignatura = "",
    titulo = "", numSemanas = 4,
    diasClase = [], horasPorDia = 1, duracionHoraClase = 45,
    estrategiaTexto = "", situacionTexto = "", productoFinalTexto = "",
    nombreDocente = "", cedula = "", regional = "", distrito = "",
    centro = "", codigoCentro = "", nivel = "Secundaria", ciclo = "Primer Ciclo",
    modalidad = "Académica", periodo = "", fechaInicio = "",
    asignaturasVinculadasTexto = "",
    jornada = "Extendida",
    competenciasFundamentalesSeleccionadas = [],
    temasSeleccionados = [],
    // Rótulo del documento: "Unidad de Aprendizaje" o "Secuencia Didáctica"
    // (mismo esquema MINERD; solo cambia la etiqueta)
    tipoPlanificacion = "Unidad de Aprendizaje",
    onProgress = null,
  } = datos;

  // Normalizar horario
  const diasClaseEf = DIAS_ORDEN.filter((d) => (diasClase || []).includes(d));
  const diasClaseFinal = diasClaseEf.length > 0 ? diasClaseEf : ["Lunes", "Martes", "Miércoles"];
  const horasPorDiaEf = Math.max(1, horasPorDia || 1);
  const durMinEf = (nivel === "Primaria" || nivel === "Inicial") ? 45 : (duracionHoraClase || 45);
  const horasSemanales = diasClaseFinal.length * horasPorDiaEf;
  const schedule = { diasClase: diasClaseFinal, horasPorDia: horasPorDiaEf, duracionHoraClase: durMinEf };

  // Usa la asignatura si tiene entrada en los diccionarios; si no, usa el área como fallback
  const claveContenido = resolverClave(asignatura, area, ESTRATEGIAS_POR_AREA);
  const asignaturaEf = asignatura || area;
  const estrategiaEf = estrategiaTexto || getEstrategia(claveContenido);
  const ambiente = getAmbiente(claveContenido);
  const producto = productoFinalTexto || `Presentación/producción final sobre "${titulo}" que evidencie el dominio de los aprendizajes de la unidad.`;
  // Situación de aprendizaje narrativa (estilo del documento modelo): contexto
  // del centro → realidad observada → necesidad auténtica → estrategia →
  // producto final progresivo. El texto del docente siempre tiene prioridad.
  const situacion = situacionTexto || construirSituacionNarrativa({
    area: claveContenido, tema: titulo, grado, ciclo, nivel, centro,
    estrategia: estrategiaEf, producto,
  });
  const ejes = getEjesTematicos(claveContenido);
  const compFundBase = COMPETENCIAS_FUND_POR_AREA[claveContenido] || ["Comunicativa", "Pensamiento Lógico, Creativo y Crítico"];
  const compFundEf = competenciasFundamentalesSeleccionadas.length > 0
    ? competenciasFundamentalesSeleccionadas
    : compFundBase;

  // Motor Especializado v1: bloquear generación sin malla curricular oficial
  // Caso (a) doc no existe → null → error "No hay malla"
  // Caso (b) permission-denied → getCurricularContentForUnit lanza → re-throw aquí
  // Caso (c) payload incompleto → error "Malla incompleta"
  let curricularDoc;
  try {
    curricularDoc = await getCurricularContentForUnit(claveContenido, grado);
  } catch (permErr) {
    throw new Error(`Sin acceso al contenido curricular — ${permErr.message}`, { cause: permErr });
  }
  if (!curricularDoc) {
    throw new Error(
      `No hay malla curricular cargada para ${claveContenido} — ${grado}. ` +
      `Ve a Administración → Banco de Conocimiento y sube el JSON de la malla.`
    );
  }
  const mallaPayload    = curricularDoc.payload || {};

  // Índices planos del corpus (payload level) — deben existir antes de chequeo (c)
  const allComps = Array.isArray(mallaPayload.competencias) ? mallaPayload.competencias : [];
  const allInds  = Array.isArray(mallaPayload.indicadoresLogro)
    ? mallaPayload.indicadoresLogro
    : Array.isArray(mallaPayload.indicadores) ? mallaPayload.indicadores : [];

  if (!allComps.length && !allInds.length) {
    throw new Error(
      `Malla curricular incompleta para ${claveContenido} — ${grado}: ` +
      `falta competencias e indicadoresLogro en el payload. ` +
      `Re-importa el JSON curricular desde el Banco de Conocimiento.`
    );
  }

  // Corpus: payload.temas es string[] con los temas oficiales del grado
  const temasOficiales  = Array.isArray(mallaPayload.temas)
    ? mallaPayload.temas
    : Array.isArray(mallaPayload.contenidos?.conceptos?.temas)
      ? mallaPayload.contenidos.conceptos.temas
      : [];
  // Resuelve el título del docente contra los temas oficiales → devuelve string
  const temaMallaStr   = _resolverTemaMalla(titulo, temasOficiales);

  // Extrae vocabulario, gramática y funcionales del corpus, filtrados al tema
  // de la unidad cuando el corpus segmenta por tema
  const mallaContenidos = _extraerContenidosMallaCorpus(mallaPayload, temaMallaStr || titulo);
  const modeloCurricularSuperior = construirModeloCurricularSuperior({
    payload: mallaPayload,
    titulo: temaMallaStr || titulo,
    area: claveContenido,
    estrategia: estrategiaEf,
    producto,
    ejes,
    allComps,
    allInds,
  });

  // CONTENIDOS del documento: subconjunto del corpus resuelto para el tema
  // (vocabulario con palabras reales, gramática con ejemplos oficiales,
  // funcionales y actitudes de la malla). Fallback: síntesis nivel-grado del
  // mismo corpus — nunca strings de plantilla.
  const contenidos = (() => {
    const sintesis = modeloCurricularSuperior.contenidosSintesis || {};
    const conceptualesTema = textosUnicos([
      ...(mallaContenidos.vocabulario || []).slice(0, 12),
      ...(mallaContenidos.gramatica || []).slice(0, 5),
      ...(mallaContenidos.expresiones || []).slice(0, 5),
    ]);
    const procedimentalesTema = textosUnicos(mallaContenidos.funcionales || []).slice(0, 8);
    const conceptuales = conceptualesTema.length ? conceptualesTema : textosUnicos(sintesis.conceptuales);
    const procedimentales = procedimentalesTema.length ? procedimentalesTema : textosUnicos(sintesis.procedimentales);
    const actitudinales = textosUnicos(sintesis.actitudinales);
    return {
      conceptuales,
      procedimentales: procedimentales.length
        ? procedimentales
        : [`Uso de los contenidos de "${titulo}" en situaciones comunicativas`, "Trabajo colaborativo e individual", "Producción oral y escrita"],
      actitudinales: actitudinales.length ? actitudinales : [
        "Disposición activa para participar en las actividades de aprendizaje.",
        "Respeto y valoración de las producciones de los compañeros.",
        "Perseverancia ante los desafíos del aprendizaje.",
        "Responsabilidad en el cumplimiento de las tareas asignadas.",
      ],
    };
  })();

  const unidadResult = {
    tipoPlanificacion,
    curricularContentId: curricularDoc?.id || null,
    // IDs de todos los indicadores de la malla (base curricular de la unidad)
    curricularRefs: allInds.map(i => i.id).filter(Boolean),
    metadatos: {
      titulo, grado, seccion, area, asignatura: asignaturaEf,
      nivel, ciclo, modalidad, jornada,
      duracion: `${numSemanas} semanas / ${numSemanas * horasSemanales} horas clase (${durMinEf} min c/u)`,
      horario: `${diasClaseFinal.join(", ")} · ${horasPorDiaEf} hora${horasPorDiaEf > 1 ? "s" : ""}/día · ${horasSemanales} horas/semana`,
      periodo, fechaInicio, nombreDocente, cedula, regional, distrito,
      centro, codigoCentro,
      asignaturasVinculadas: asignaturasVinculadasTexto
        ? asignaturasVinculadasTexto.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      productoFinal: producto,
      // Temas curriculares que el docente eligió integrar en la unidad
      // (vacío = trabaja solo el tema del título)
      temasIntegrados: Array.isArray(temasSeleccionados) ? temasSeleccionados : [],
    },
    ejesTematicos: ejes,
    situacionAprendizaje: situacion,
    ambienteAprendizaje: ambiente,
    modeloCurricularSuperior,
    competencias: (() => {
      // ÚNICA FUENTE: malla oficial en curricularContent (ya garantizada arriba).
      // fundamentales: nombres de CFs del área — COMPETENCIAS_FUND_POR_AREA siempre tiene valores
      // específica: especificaGrado (v1.3) o especifica (v1.1) de cada competencia del corpus
      // indicadores: indicadoresLogro[].descripcion (v1.3) o indicadores[].texto (v1.1)
      const fundamentales = compFundEf; // ya garantizado no vacío por COMPETENCIAS_FUND_POR_AREA
      const especificas = allComps
        .map(c => c.especificaGrado || c.especifica || c.descripcion || '')
        .filter(Boolean);
      const indicadores = allInds
        .slice(0, 9)
        .map(i => i.descripcion || i.texto || '')
        .filter(Boolean);
      return {
        fundamentales,
        especifica: especificas.slice(0, 2).join(' | ') || '',
        nivelMCERL: mallaPayload.nivelMCERL || null,
        indicadores,
      };
    })(),
    // Componente curricular POR COMPETENCIA (estructura oficial de la
    // Adecuación, como el documento modelo): cada Competencia Fundamental con
    // su Competencia Específica del ciclo y SUS indicadores, sin aplanar.
    // El campo `competencias` de arriba se conserva por compatibilidad con
    // unidades ya guardadas y otros consumidores.
    competenciasDetalle: allComps.map((comp, i) => ({
      // Código oficial de la competencia específica (ej. CE-LEI-1) — del corpus
      codigo: comp.id || comp.codigo || "",
      competenciaFundamental: comp.competenciaFundamental || comp.fundamental || compFundEf[i] || compFundEf[i % compFundEf.length] || "",
      especifica: comp.especificaGrado || comp.especifica || comp.descripcion || "",
      // Indicadores con su código oficial (ej. IL-LEI-1-1). El formatter acepta
      // también strings (unidades guardadas antes de este cambio).
      indicadores: (Array.isArray(comp.indicadoresLogro) ? comp.indicadoresLogro : [])
        .map((ind) => ({
          codigo: ind.id || ind.codigo || "",
          descripcion: ind.descripcion || ind.texto || "",
        }))
        .filter((ind) => ind.descripcion),
    })).filter((c) => c.especifica),
    contenidos,
    fasesSemanales: await _generarFasesConIA(
      numSemanas, schedule, claveContenido, titulo, estrategiaEf, producto,
      { grado, nivel }, mallaContenidos,
      mallaPayload, allInds, allComps, durMinEf, grado,
      onProgress,
    ),
    especificacionCurricular: buildEspecificacionCurricular({
      mallaPayload, titulo, allInds, allComps, mallaContenidos, area: claveContenido, grado,
    }),
  };

  // ── Secciones del documento modelo (2026-07-04) ────────────────────────────
  // Ejes contextualizados, nota institucional, checkpoint de mitad de unidad y
  // anexos A-L. Se añaden como campos nuevos: las unidades ya guardadas sin
  // estos campos siguen renderizando igual (el formateador los trata como
  // opcionales).
  unidadResult.ejesTematicosDetalle = construirEjesContextualizados(ejes, {
    area: claveContenido, tema: titulo,
  });
  unidadResult.notaInstitucional = construirNotaInstitucional({
    clasesPorSemana: diasClaseFinal.length,
    durMin: durMinEf,
    producto,
  });
  unidadResult.checkpointFormativo = construirCheckpointFormativo({
    tema: titulo, producto, numSemanas,
  });
  unidadResult.anexos = construirAnexosUnidad({
    area: claveContenido,
    tema: titulo,
    producto,
    vocabulario: mallaContenidos.vocabulario || [],
    fases: unidadResult.fasesSemanales || [],
    numSemanas,
  });

  // R1 FINAL sobre el DOCUMENTO RENDERIZADO completo (no solo el JSON de la
  // IA): atrapa cualquier placeholder o campo vacío que entre por código
  // residual antes de entregar la unidad al docente.
  const htmlRenderizado = formatearUnidadHTML(unidadResult);
  validarUnidadRenderizada(unidadResult, htmlRenderizado);

  return unidadResult;
};

// ─── R1 final: validación del documento renderizado ──────────────────────────
// El esquema MINERD no admite campos vacíos ni placeholders. Esta validación
// recorre la unidad Y el HTML renderizado; cualquier hueco detiene la entrega.

const PLACEHOLDERS_PROHIBIDOS = [
  "Vocabulario clave relacionado con",
  "Estructuras gramaticales básicas",
  "diversidad cultural anglosajona",
  "Conceptos fundamentales de ",
  "Definiciones de ",
];

export const validarUnidadRenderizada = (unidad, html = "") => {
  const errores = [];
  const vacio = (v) => !String(v ?? "").trim();

  if (vacio(unidad?.situacionAprendizaje)) errores.push("SITUACIÓN DE APRENDIZAJE vacía");
  if (vacio(unidad?.ambienteAprendizaje)) errores.push("AMBIENTE DE APRENDIZAJE vacío");

  for (const col of ["conceptuales", "procedimentales", "actitudinales"]) {
    if (!unidad?.contenidos?.[col]?.length) errores.push(`CONTENIDOS ${col} vacíos`);
  }

  const detalle = Array.isArray(unidad?.competenciasDetalle) ? unidad.competenciasDetalle : [];
  if (!detalle.length) errores.push("tabla de competencias e indicadores vacía");
  detalle.forEach((c, i) => {
    if (vacio(c.especifica)) errores.push(`competencia ${i + 1} sin específica`);
    if (!c.indicadores?.length) errores.push(`competencia ${i + 1} sin indicadores`);
  });

  (unidad?.fasesSemanales || []).forEach((fase) => {
    if (!fase.indicadoresAvance?.length) errores.push(`fase ${fase.numero} sin indicadores de avance`);
    (fase.dias || []).forEach((dia) => {
      const ref = `fase ${fase.numero}, clase ${dia.numeroGlobal || dia.numero}`;
      if (vacio(dia.titulo)) errores.push(`${ref}: sin título`);
      if (!dia.criteriosExito?.length) errores.push(`${ref}: sin criterios de éxito`);
      (dia.momentos || []).forEach((mom) => {
        const mref = `${ref}, ${mom.nombre}`;
        if (!mom.actividades?.filter((a) => !vacio(a)).length) errores.push(`${mref}: sin actividades`);
        if (vacio(mom.evidencias)) errores.push(`${mref}: sin evidencias`);
        if (!mom.metacognicion?.filter((q) => !vacio(q)).length) errores.push(`${mref}: sin metacognición`);
        for (const campo of ["tipo", "agente", "tecnica", "instrumento"]) {
          if (vacio(mom.evaluacion?.[campo])) errores.push(`${mref}: evaluación sin ${campo}`);
        }
        if (vacio(mom.recursos?.humanos)) errores.push(`${mref}: sin recursos humanos`);
        if (vacio(mom.recursos?.didacticos)) errores.push(`${mref}: sin recursos didácticos`);
      });
    });
  });

  const contenidoCompleto = `${JSON.stringify(unidad)}\n${html}`;
  for (const p of PLACEHOLDERS_PROHIBIDOS) {
    if (contenidoCompleto.includes(p)) errores.push(`placeholder legacy detectado: "${p}"`);
  }
  if (/<li>\s*<\/li>/.test(html)) errores.push("ítem de lista vacío en el documento renderizado");
  if (/>\s*undefined\s*</.test(html)) errores.push('texto "undefined" en el documento renderizado');

  if (errores.length) {
    const muestra = errores.slice(0, 8).join("; ");
    const extra = errores.length > 8 ? ` (+${errores.length - 8} más)` : "";
    throw new Error(`R1: documento renderizado incompleto — ${muestra}${extra}`);
  }
  return true;
};

// ─── Formateador HTML para PDF ────────────────────────────────────────────────

export const formatearUnidadHTML = (unidad, logoUrl = "") => {
  if (!unidad) return "";
  const m = unidad.metadatos || {};

  const estilos = `
    body { font-family: 'Book Antiqua', Palatino, 'Palatino Linotype', serif; font-size: 12pt; line-height: 1.15; color: #111; margin: 0; }
    p { margin: 0 0 3pt; }
    .page { width: 100%; max-width: 1120px; margin: 0 auto; padding: 20px; box-sizing: border-box; }
    .header-minerd { text-align: center; margin-bottom: 14px; padding-bottom: 14px; border-bottom: 2px solid #1e3a8a; }
    .header-minerd img { display: block; margin: 0 auto 10px; width: 220px; max-width: 65mm; height: auto; }
    h1 { font-size: 16pt; font-weight: bold; text-align: center; color: #1e3a8a; margin: 0 0 3pt; }
    .sub { font-size: 14pt; font-weight: bold; text-align: center; color: #1d4ed8; margin: 0; }
    .datos-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    .datos-table td { border: 1px solid #93c5fd; padding: 4px 8px; font-size: 12pt; }
    .datos-table .lbl { background: #dbeafe; font-weight: bold; width: 160px; font-size: 11pt; }
    .section-head { background: #1d4ed8; color: white; padding: 5px 10px; font-weight: bold; font-size: 11pt; margin: 10px 0 0; }
    .contenidos { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0; margin-bottom: 12px; }
    .cont-col { border: 1px solid #93c5fd; }
    .cont-head { background: #bfdbfe; padding: 4px 8px; font-weight: bold; font-size: 11pt; }
    .cont-list { padding: 4px 8px 4px 18px; margin: 0; font-size: 12pt; }
    .curriculo-meta { font-size: 10.5pt; color: #334155; margin: 3px 0 8px; }
    .modelo-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    .modelo-table th { background: #1d4ed8; color: white; border: 1px solid #1e40af; padding: 5px 6px; font-size: 10.5pt; text-align: left; }
    .modelo-table td { border: 1px solid #93c5fd; padding: 5px 6px; font-size: 10.5pt; vertical-align: top; }
    .modelo-table ul { margin: 0 0 0 16px; padding: 0; }
    .modelo-table li { margin-bottom: 2pt; }
    .modelo-subhead { background: #dbeafe; color: #1e3a8a; font-weight: bold; padding: 4px 8px; border: 1px solid #93c5fd; font-size: 11pt; }
    .fase-band { background: #1e3a5f; color: white; padding: 6px 10px; font-weight: bold; font-size: 11pt; margin-top: 18px; }
    .est-band { background: #2563eb; color: white; padding: 4px 10px; font-size: 10pt; }
    .semana-band { background: #3b82f6; color: white; padding: 5px 10px; font-weight: bold; font-size: 11pt; margin-top: 12px; }
    .intencion-band { background: #eff6ff; border: 1px solid #93c5fd; padding: 5px 10px; font-size: 12pt; margin-bottom: 6px; }
    .dia-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    .dia-table th { background: #1d4ed8; color: white; padding: 5px; font-size: 11pt; font-weight: bold; border: 1px solid #1e40af; text-align: left; }
    .dia-table td { border: 1px solid #93c5fd; padding: 4px 6px; font-size: 12pt; vertical-align: top; }
    .checkpoint-table { width: 100%; border-collapse: collapse; margin: 8px 0 12px; }
    .checkpoint-table th { background: #b45309; color: white; padding: 5px; font-size: 11pt; border: 1px solid #92400e; text-align: left; }
    .checkpoint-table td { border: 1px solid #fcd34d; background: #fffbeb; padding: 4px 6px; font-size: 11pt; vertical-align: top; }
    .anexos { break-before: page; page-break-before: always; }
    .anexos h2 { font-size: 15pt; color: #1e3a8a; margin: 14px 0 4pt; }
    .anexos h3 { font-size: 12pt; color: #1d4ed8; margin: 12px 0 4pt; }
    .anexos .nota { font-style: italic; font-size: 10.5pt; color: #334155; margin-bottom: 8px; }
    .rubrica { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    .rubrica th { background: #1d4ed8; color: white; border: 1px solid #1e40af; padding: 4px 5px; font-size: 10pt; text-align: left; }
    .rubrica td { border: 1px solid #94a3b8; padding: 4px 5px; font-size: 10pt; vertical-align: top; }
    .td-momento { background: #f0f9ff; font-weight: bold; text-align: center; width: 65px; }
    .td-tiempo { text-align: center; width: 55px; }
    .td-meta { background: #d1fae5; font-style: italic; }
    .meta-lbl { font-weight: bold; font-style: normal; color: #065f46; }
    .neae-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0; margin-bottom: 8px; }
    .neae-col { border: 1px solid #e2e8f0; }
    .neae-head { background: #f1f5f9; padding: 3px 8px; font-weight: bold; font-size: 11pt; }
    .neae-body { padding: 3px 8px; font-size: 10pt; }
    .texto-seccion { border: 1px solid #93c5fd; padding: 8px 10px; font-size: 12pt; font-weight: normal; line-height: 1.3; text-align: justify; height: auto; min-height: 40px; margin-bottom: 8px; }
    @page { size: A4 landscape; margin: 12mm; }
    @media print {
      .page { padding: 0; max-width: 100%; }
      .header-minerd { break-after: avoid; page-break-after: avoid; }
      button { display: none !important; }
      [style*="position:fixed"] { display: none !important; }
      thead { display: table-header-group; }
      thead tr { break-inside: avoid; page-break-inside: avoid; }
      tbody tr { break-inside: auto; page-break-inside: auto; }
      .dia-table { break-inside: auto; page-break-inside: auto; margin-bottom: 6px; }
      .semana-band { break-after: avoid; page-break-after: avoid; }
      .intencion-band { break-after: avoid; page-break-after: avoid; }
      .fase-band { break-before: auto; page-break-before: auto; break-after: avoid; page-break-after: avoid; }
      .section-head { break-after: avoid; page-break-after: avoid; }
      .neae-grid { break-inside: auto; page-break-inside: auto; }
      .neae-col { break-inside: auto; page-break-inside: auto; }
    }
  `;

  const modeloSuperior = unidad.modeloCurricularSuperior || {};
  const listaHtml = (items = [], max = 0) => {
    const arr = max ? (items || []).slice(0, max) : (items || []);
    return arr.length
      ? `<ul>${arr.map((item) => `<li>${item}</li>`).join("")}</ul>`
      : "<em>No registrado en la malla.</em>";
  };

  const ejesSuperiorHtml = Array.isArray(modeloSuperior.ejes) && modeloSuperior.ejes.length ? `
    <div class="section-head">EJE TEMÁTICO TRANSVERSAL Y CONEXIONES CURRICULARES</div>
    <table class="modelo-table">
      ${modeloSuperior.ejes.map((eje) => `
        <tr>
          <td style="width:24%;background:#f8fafc"><strong>${eje.nombre}</strong></td>
          <td>${eje.descripcion}</td>
        </tr>`).join("")}
    </table>` : "";

  const progresionHtml = Array.isArray(modeloSuperior.progresion) && modeloSuperior.progresion.length ? `
    <div class="section-head">PROGRESIÓN CURRICULAR DE LA UNIDAD</div>
    <table class="modelo-table">
      <thead>
        <tr>
          <th style="width:17%">Tema oficial</th>
          <th style="width:23%">Conceptos: temas, frases, vocabulario y gramática</th>
          <th style="width:23%">Procedimientos / funciones comunicativas</th>
          <th style="width:17%">Actitudes y valores</th>
          <th>Evidencias esperadas</th>
        </tr>
      </thead>
      <tbody>
        ${modeloSuperior.progresion.map((bloque) => `
          <tr>
            <td><strong>${bloque.tema}</strong>${bloque.competenciasRelacionadas?.length ? `<br><em>${bloque.competenciasRelacionadas.join(", ")}</em>` : ""}</td>
            <td>${listaHtml(bloque.focoConceptual)}</td>
            <td>${listaHtml(bloque.procedimientos)}</td>
            <td>${listaHtml(bloque.actitudesValores)}</td>
            <td>${listaHtml(bloque.evidenciasEsperadas)}</td>
          </tr>`).join("")}
      </tbody>
    </table>` : "";

  const fasesHtml = (unidad.fasesSemanales || []).map((fase) => {
    const diasHtml = (fase.dias || []).map((dia) => {
      const momentosHtml = (dia.momentos || []).map((mom) => {
        const actsHtml = (mom.actividades || []).map((a, i) => {
          const html = a
            .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
            .replace(/_([^_]+)_/g, "<em>$1</em>");
          return `<p style="margin:2px 0"><strong>${i + 1})</strong> ${html}</p>`;
        }).join("");
        const evalHtml = `<strong>Tipo:</strong> ${mom.evaluacion?.tipo}.<br><strong>Agente:</strong> ${mom.evaluacion?.agente}.<br><strong>Técnica:</strong> ${mom.evaluacion?.tecnica}.<br><strong>Instrumento:</strong> ${mom.evaluacion?.instrumento}.`;
        const recursos = mom.recursos || {};
        const recursosHtml = `<strong>Humanos:</strong> ${recursos.humanos}<br><strong>Didácticos:</strong> ${recursos.didacticos}<br><strong>Tecnológicos:</strong> ${recursos.tecnologicos}`;
        const metaHtml = (mom.metacognicion || []).join(" · ");
        return `
          <tr>
            <td class="td-momento" rowspan="2">${mom.nombre}</td>
            <td class="td-tiempo" rowspan="2">${mom.tiempo}</td>
            <td rowspan="2">${actsHtml}</td>
            <td style="white-space:pre-line">${(mom.evidencias || "").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/_([^_]+)_/g, "<em>$1</em>")}</td>
            <td>${evalHtml}</td>
            <td rowspan="2">${recursosHtml}</td>
          </tr>
          <tr>
            <td colspan="2" class="td-meta"><span class="meta-lbl">Metacognición: </span>${metaHtml}</td>
          </tr>`;
      }).join("");

      return `
        <div class="semana-band">FASE ${fase.numero} — CLASE ${dia.numeroGlobal} (Sem. ${dia.semana}, ${dia.diaCalendario}${dia.mostrarHora ? " H" + dia.hora : ""}): "${dia.titulo}"</div>
        <div class="intencion-band"><strong>Intención pedagógica del día:</strong> ${dia.intencionPedagogica}</div>
        <table class="dia-table">
          <colgroup>
            <col style="width:65px">
            <col style="width:50px">
            <col>
            <col style="width:15%">
            <col style="width:15%">
            <col style="width:13%">
          </colgroup>
          <thead>
            <tr>
              <th>Momento</th>
              <th>Tiempo</th>
              <th>Actividades</th>
              <th>Evidencias</th>
              <th>Evaluación</th>
              <th>Recursos</th>
            </tr>
          </thead>
          <tbody>${momentosHtml}</tbody>
        </table>`;
    }).join("");

    const neaeHtml = (fase.dias[0]?.adaptacionesNEAE) ? `
      <div class="section-head">ADAPTACIONES (NEAE — si aplica)</div>
      <div class="neae-grid">
        <div class="neae-col"><div class="neae-head">De acceso</div><div class="neae-body">${fase.dias[0].adaptacionesNEAE.acceso}</div></div>
        <div class="neae-col"><div class="neae-head">Metodológicas</div><div class="neae-body">${fase.dias[0].adaptacionesNEAE.metodologicas}</div></div>
        <div class="neae-col"><div class="neae-head">De evaluación</div><div class="neae-body">${fase.dias[0].adaptacionesNEAE.evaluacion}</div></div>
      </div>` : "";

    const resEv = fase.dias[0]?.resumenEvaluacion;
    const resumenHtml = resEv ? `
      <div class="section-head">RESUMEN DE EVALUACIÓN Y OBSERVACIONES</div>
      <div class="neae-grid">
        <div class="neae-col"><div class="neae-head">Técnicas</div><div class="neae-body">${(resEv.tecnicas || []).join(", ")}</div></div>
        <div class="neae-col"><div class="neae-head">Instrumentos</div><div class="neae-body">${(resEv.instrumentos || []).join(", ")}</div></div>
        <div class="neae-col"><div class="neae-head">Observaciones</div><div class="neae-body">${resEv.observaciones}</div></div>
      </div>` : "";

    // Checkpoint formativo de mitad de unidad: se inserta al cerrar la fase
    // que contiene la semana señalada (documento modelo: Semana 3)
    const cp = unidad.checkpointFormativo;
    const semanasFase = (fase.dias || []).map((d) => d.semana).filter(Boolean);
    const contieneCheckpoint = cp && semanasFase.length
      && Math.min(...semanasFase) <= cp.semana && cp.semana <= Math.max(...semanasFase);
    const checkpointHtml = contieneCheckpoint ? `
      <div class="section-head" style="background:#b45309">SEMANA ${cp.semana} — CHECKPOINT FORMATIVO (Mitad de la unidad)</div>
      <table class="checkpoint-table">
        <tr><th style="width:32%">Indicador de avance</th><th style="width:34%">¿Cómo se evidencia?</th><th>Acción de mejora</th></tr>
        <tr><td>${cp.indicador}</td><td>${cp.evidencia}</td><td>${cp.accion}</td></tr>
      </table>` : "";

    return `
      <div class="fase-band">FASE ${fase.numero} — ${fase.nombre}</div>
      <div class="est-band">Estrategia de enseñanza y de aprendizaje: ${fase.estrategia}</div>
      ${diasHtml}
      ${neaeHtml}
      ${resumenHtml}
      ${checkpointHtml}`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>${unidad.tipoPlanificacion || "Unidad de Aprendizaje"} — ${m.titulo}</title>
<style>${estilos}</style></head>
<body><div class="page">
  <div class="header-minerd">
    ${logoUrl ? `<img src="${logoUrl}" alt="Logo MINERD" onerror="this.style.display='none'">` : ""}
    <h1>MINISTERIO DE EDUCACIÓN DE LA REPÚBLICA DOMINICANA</h1>
    <div class="sub">PLANIFICACIÓN: ${(unidad.tipoPlanificacion || "Unidad de Aprendizaje").toUpperCase()}</div>
  </div>

  <div class="section-head">DATOS GENERALES</div>
  <table class="datos-table">
    <tr><td class="lbl">Nombre del docente</td><td>${m.nombreDocente}</td><td class="lbl">Cédula</td><td>${m.cedula}</td></tr>
    <tr><td class="lbl">Regional</td><td>${m.regional}</td><td class="lbl">Distrito</td><td>${m.distrito}</td></tr>
    <tr><td class="lbl">Centro Educativo</td><td>${m.centro}</td><td class="lbl">Código</td><td>${m.codigoCentro}</td></tr>
    <tr><td class="lbl">Nivel / Ciclo</td><td>${m.nivel} / ${m.ciclo}</td><td class="lbl">Modalidad</td><td>${m.modalidad}</td></tr>
    ${m.jornada ? `<tr><td class="lbl">Jornada</td><td colspan="3">${m.jornada === "Extendida" ? "Jornada Extendida (40h/sem.)" : m.jornada === "Regular" ? "Jornada Regular (30h/sem.)" : "Jornada de Transición (25h/sem.)"}</td></tr>` : ""}
    <tr><td class="lbl">Grado y Sección</td><td>${m.grado} ${m.seccion}</td><td class="lbl">Período</td><td>${m.periodo}</td></tr>
    <tr><td class="lbl">Área</td><td>${m.area}</td><td class="lbl">Asignatura</td><td>${m.asignatura}</td></tr>
    <tr><td class="lbl">Título de la Unidad</td><td colspan="3"><strong>${m.titulo}</strong></td></tr>
    <tr><td class="lbl">Duración</td><td>${m.duracion}</td><td class="lbl">Fecha inicio</td><td>${m.fechaInicio}</td></tr>
    <tr><td class="lbl">Horario</td><td colspan="3">${m.horario || ""}</td></tr>
    <tr><td class="lbl">Asignaturas vinculadas</td><td colspan="3">${(m.asignaturasVinculadas || []).join(", ") || "N/A"}</td></tr>
    <tr><td class="lbl">Producto final</td><td colspan="3">${m.productoFinal}</td></tr>
  </table>

  ${ejesSuperiorHtml}

  <div class="section-head">SITUACIÓN DE APRENDIZAJE</div>
  <div class="texto-seccion">${unidad.situacionAprendizaje}</div>
  <div class="section-head">AMBIENTE DE APRENDIZAJE</div>
  <div class="texto-seccion">${unidad.ambienteAprendizaje}</div>
  ${unidad.notaInstitucional ? `
  <div class="section-head">NOTA INSTITUCIONAL DE ORGANIZACIÓN TEMPORAL</div>
  <div class="texto-seccion">${String(unidad.notaInstitucional).split("\n").map((parrafo) => `<p style="margin-bottom:6pt">${parrafo}</p>`).join("")}</div>` : ""}

  <div class="section-head">COMPONENTE CURRICULAR — Asignatura: ${m.asignatura}</div>
  ${modeloSuperior.fuente || modeloSuperior.versionCurriculo || modeloSuperior.nivelMCERL ? `
    <p class="curriculo-meta">
      Fuente curricular: ${modeloSuperior.fuente || "MINERD"}
      ${modeloSuperior.versionCurriculo ? ` · Versión: ${modeloSuperior.versionCurriculo}` : ""}
      ${modeloSuperior.nivelMCERL ? ` · Nivel MCERL: ${modeloSuperior.nivelMCERL}` : ""}
    </p>` : ""}
  ${(() => {
    // Estructura oficial por competencia (documento modelo): CF + específica
    // del ciclo + SUS indicadores. Fallback: formato aplanado legacy.
    const detalle = Array.isArray(unidad.competenciasDetalle) ? unidad.competenciasDetalle : [];
    if (detalle.length) {
      const nivelMCERL = unidad.competencias?.nivelMCERL
        ? `<p style="margin:0 0 6pt"><em>Nivel de dominio MCERL: ${unidad.competencias.nivelMCERL}</em></p>`
        : '';
      // Indicador puede ser string (unidades guardadas legacy) u objeto
      // { codigo, descripcion } con el código oficial de la malla (IL-…)
      const indicadorHtml = (ind) => {
        if (typeof ind === 'string') return ind;
        const cod = ind?.codigo ? `<strong>${ind.codigo}</strong> — ` : '';
        return `${cod}${ind?.descripcion || ''}`;
      };
      const filas = detalle.map((c) => `
        <tr>
          <td style="width:34%;vertical-align:top;padding:6px 8px;background:#f8fafc">
            <strong>${c.competenciaFundamental || 'Competencia'}</strong>
            ${c.codigo ? `<br><strong style="font-size:10.5pt;color:#1e3a8a">${c.codigo}</strong>` : ''}
            ${c.especifica ? `<br><em style="font-size:11pt">${c.especifica}</em>` : ''}
          </td>
          <td style="vertical-align:top;padding:6px 8px">
            ${c.indicadores?.length
              ? `<ul style="margin:0 0 0 16px;padding:0">${c.indicadores.map((ind) => `<li style="margin-bottom:3pt">${indicadorHtml(ind)}</li>`).join('')}</ul>`
              : '<em>Sin indicadores en la malla para esta competencia.</em>'}
          </td>
        </tr>`).join('');
      return `${nivelMCERL}<table class="datos-table" style="margin-bottom:12px">
        <tr><td class="lbl" style="width:34%;text-align:center">Competencias</td><td class="lbl" style="text-align:center">Indicadores de Logro</td></tr>
        ${filas}
      </table>`;
    }
    const comp = unidad.competencias || {};
    const funds = Array.isArray(comp.fundamentales) ? comp.fundamentales : [];
    const especifica = comp.especifica || '';
    const indicadores = Array.isArray(comp.indicadores) ? comp.indicadores : [];
    const nivelMCERL = comp.nivelMCERL ? `<br><em>Nivel MCERL: ${comp.nivelMCERL}</em>` : '';
    if (!funds.length && !especifica) return '';
    const rowspan = funds.length || 1;
    const fundRows = funds.map((f, i) => i === 0
      ? `<tr>
          <td class="lbl" style="vertical-align:middle">${f}</td>
          <td rowspan="${rowspan}" style="padding:6px 10px;vertical-align:top">
            ${especifica ? `<strong>Competencia Específica:</strong> ${especifica}${nivelMCERL}<br><br>` : ''}
            ${indicadores.length ? `<strong>Indicadores de Logro:</strong><ul style="margin:4px 0 0 18px;padding:0">${indicadores.map(ind => `<li style="margin-bottom:3px">${ind}</li>`).join('')}</ul>` : ''}
          </td>
        </tr>`
      : `<tr><td class="lbl" style="vertical-align:middle">${f}</td></tr>`
    ).join('');
    return `<table class="datos-table" style="margin-bottom:12px">${fundRows}</table>`;
  })()}

  <div class="section-head">CONTENIDOS</div>
  <div class="contenidos">
    <div class="cont-col"><div class="cont-head">Conceptuales</div><ul class="cont-list">${(unidad.contenidos?.conceptuales || []).map((c) => `<li>${c}</li>`).join("")}</ul></div>
    <div class="cont-col"><div class="cont-head">Procedimentales</div><ul class="cont-list">${(unidad.contenidos?.procedimentales || []).map((c) => `<li>${c}</li>`).join("")}</ul></div>
    <div class="cont-col"><div class="cont-head">Actitudinales</div><ul class="cont-list">${(unidad.contenidos?.actitudinales || []).map((c) => `<li>${c}</li>`).join("")}</ul></div>
  </div>

  ${progresionHtml}

  ${fasesHtml}

  ${(() => {
    const ax = unidad.anexos;
    if (!ax) return "";
    const filaVacia = (n, cols) => Array.from({ length: n }, () => `<tr>${"<td>&nbsp;</td>".repeat(cols)}</tr>`).join("");
    return `
  <section class="anexos">
    <h2>ANEXOS</h2>
    <p class="nota">Instrumentos de evaluación y apoyos para el aprendizaje de la unidad ${m.titulo}.</p>

    <h3>ANEXO A — Rúbrica analítica del producto final</h3>
    <table class="rubrica">
      <tr><th>Criterio</th><th>Nivel 4 — Excelente</th><th>Nivel 3 — Satisfactorio</th><th>Nivel 2 — En proceso</th><th>Nivel 1 — Inicial</th></tr>
      ${(ax.rubricaProducto || []).map((r) => `<tr><td><strong>${r.criterio}</strong></td><td>${r.n4}</td><td>${r.n3}</td><td>${r.n2}</td><td>${r.n1}</td></tr>`).join("")}
    </table>

    <h3>ANEXO B — Lista de cotejo para la producción oral</h3>
    <table class="rubrica">
      <tr><th>Indicador observable</th><th style="width:12%">Sí</th><th style="width:14%">En proceso</th><th style="width:12%">No</th></tr>
      ${(ax.listaCotejoOral || []).map((i) => `<tr><td>${i}</td><td></td><td></td><td></td></tr>`).join("")}
    </table>

    <h3>ANEXO C — Registro anecdótico</h3>
    <table class="rubrica">
      <tr>${(ax.registroAnecdotico?.columnas || []).map((c) => `<th>${c}</th>`).join("")}</tr>
      ${ax.registroAnecdotico?.ejemplo ? `<tr>${ax.registroAnecdotico.ejemplo.map((c) => `<td style="font-style:italic">${c}</td>`).join("")}</tr>` : ""}
      ${filaVacia(3, (ax.registroAnecdotico?.columnas || []).length || 4)}
    </table>

    <h3>ANEXO D — Ficha de coevaluación: Two Stars and a Wish</h3>
    <table class="rubrica">
      <tr><td style="width:55%">Evalúo a mi compañero/a:</td><td>____________________</td></tr>
      <tr><td>⭐ Star 1 — Algo que hizo muy bien:</td><td>____________________</td></tr>
      <tr><td>⭐ Star 2 — Otra cosa que hizo muy bien:</td><td>____________________</td></tr>
      <tr><td>🌠 A Wish — Algo que puede mejorar:</td><td>____________________</td></tr>
    </table>

    <h3>ANEXO E — Ficha de autoevaluación: My Learning Journey</h3>
    <table class="rubrica">
      <tr><th>Now I can...</th><th style="width:10%">Yes</th><th style="width:10%">Almost</th><th style="width:10%">Not yet</th></tr>
      ${(ax.autoevaluacion || []).map((i) => `<tr><td>${i}</td><td></td><td></td><td></td></tr>`).join("")}
      <tr><td><strong>My personal goal for next time:</strong></td><td colspan="3"></td></tr>
    </table>

    ${ax.glosario?.length ? `
    <h3>ANEXO F — Glosario de la unidad</h3>
    <p class="nota">La columna Español se completa con los estudiantes durante la unidad.</p>
    <table class="rubrica">
      <tr><th>Término</th><th>Español</th><th>Término</th><th>Español</th></tr>
      ${Array.from({ length: Math.ceil(ax.glosario.length / 2) }, (_, i) => {
        const a = ax.glosario[i * 2];
        const b = ax.glosario[i * 2 + 1];
        return `<tr><td>${a?.termino || ""}</td><td>${a?.traduccion || ""}</td><td>${b?.termino || ""}</td><td>${b?.traduccion || ""}</td></tr>`;
      }).join("")}
    </table>` : ""}

    <h3>ANEXO G — Frases de apoyo (Sentence starters)</h3>
    <table class="rubrica">
      <tr><th style="width:35%">Función comunicativa</th><th>Frase de apoyo</th></tr>
      ${(ax.sentenceStarters || []).map((s) => `<tr><td>${s.funcion}</td><td>${s.starter}</td></tr>`).join("")}
    </table>

    <h3>ANEXO H — Checklist de progreso del producto final</h3>
    <table class="rubrica">
      <tr><th>Paso del producto final</th><th style="width:20%">Semana</th><th style="width:8%">✔</th></tr>
      ${(ax.checklistProducto || []).map((c) => `<tr><td>${c.paso}</td><td>${c.semana}</td><td></td></tr>`).join("")}
    </table>

    <h3>ANEXO I — Organizador gráfico del producto final</h3>
    <table class="rubrica">
      <tr><th style="width:28%">Sección</th><th style="width:42%">¿Qué incluyo aquí?</th><th>Mis oraciones / notas</th></tr>
      ${(ax.organizadorProducto || []).map((o) => `<tr><td>${o.seccion}</td><td>${o.incluye}</td><td></td></tr>`).join("")}
    </table>

    <h3>ANEXO J — Evaluación diagnóstica inicial</h3>
    <p class="nota">Aplicar al inicio de la unidad. No lleva calificación; orienta la planificación y las adaptaciones.</p>
    <table class="rubrica">
      <tr><th style="width:22%">Habilidad</th><th>Tarea</th><th>Criterio de interpretación</th></tr>
      ${(ax.diagnostica || []).map((d) => `<tr><td><strong>${d.habilidad}</strong></td><td>${d.tarea}</td><td>${d.criterio}</td></tr>`).join("")}
    </table>

    <h3>ANEXO K — Adaptaciones para estudiantes con NEAE, por perfil</h3>
    <table class="rubrica">
      <tr><th style="width:25%">Perfil del estudiante</th><th>Adaptaciones de acceso y metodológicas</th><th>Adaptaciones de evaluación</th></tr>
      ${(ax.neaePorPerfil || []).map((p) => `<tr><td><strong>${p.perfil}</strong></td><td>${p.acceso}</td><td>${p.evaluacion}</td></tr>`).join("")}
    </table>

    <h3>ANEXO L — Plan B tecnológico (continuidad sin recursos digitales)</h3>
    <p class="nota">Cuando falle la electricidad, el internet o el equipo, la clase continúa con estas alternativas físicas. Ninguna actividad depende exclusivamente de la tecnología.</p>
    <table class="rubrica">
      <tr><th style="width:45%">Recurso tecnológico previsto</th><th>Alternativa física (Plan B)</th></tr>
      ${(ax.planB || []).map((p) => `<tr><td>${p.recurso}</td><td>${p.alternativa}</td></tr>`).join("")}
    </table>
  </section>`;
  })()}
</div>
<div style="position:fixed;bottom:20px;right:20px;z-index:999;display:flex;gap:8px">
  <button onclick="window.print()" style="background:#1d4ed8;color:white;border:none;padding:10px 20px;border-radius:6px;font-size:13px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3)">🖨️ Guardar como PDF</button>
  <button onclick="window.close()" style="background:#64748b;color:white;border:none;padding:10px 16px;border-radius:6px;font-size:13px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3)">✕ Cerrar</button>
</div>
</body></html>`;
};
