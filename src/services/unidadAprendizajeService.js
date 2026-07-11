/**
 * Servicio: Generador de Unidad de Aprendizaje — formato MINERD
 */

import { resolverClave } from "../planning/areaAsignaturaMap.js";
import { getCurricularContentForUnit, temasOficialesDeMalla, localizarPlaceholdersProhibidos } from "./bancoConocimientoService.js";
import { buildEspecificacionCurricular, generateWeekPlan, validarVozActividad, getFocoGramatical } from "./phaseAService.js";

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
const construirCheckpointFormativo = ({ tema, producto, numSemanas, aportesHastaMitad = [] }) => {
  // Evidencia derivada de los aportes REALES al producto hasta la mitad de la
  // unidad (contrato de la IA), no de una frase de plantilla. Se inserta UNA
  // sola vez, en la mitad real (ver formatearUnidadHTML, que exige que la
  // semana del checkpoint caiga dentro del grupo calendario que la contiene).
  const aportes = aportesHastaMitad.filter(Boolean);
  const evidenciaAportes = aportes.length
    ? `Producciones del portafolio: ${aportes.slice(0, 4).map((a) => String(a).replace(/\.$/, "")).join("; ")}.`
    : `Producciones del portafolio de las primeras semanas y primer avance del producto final (${String(producto).replace(/\.$/, "")}).`;
  return {
    semana: Math.ceil((numSemanas || 4) / 2),
    indicador: `El estudiante comprende y comunica los aprendizajes centrales de "${tema}" trabajados hasta la mitad de la unidad, de forma oral y escrita.`,
    evidencia: evidenciaAportes,
    accion: "Para quienes aún no logran el indicador: reforzar con frases y ejemplos modelo, práctica guiada en parejas y revisión acompañada del avance del producto antes de la siguiente fase.",
  };
};

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

const construirAnexosUnidad = ({ area, tema, producto, vocabulario = [], fases = [], numSemanas = 4, aportesProducto = [] }) => {
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
  // Anexo H — checklist de progreso del producto: los aportes REALES que cada
  // clase depositó (contrato de la IA), mapeados por semana calendario. Si no
  // llegaron aportes (unidad legacy), se cae al mapeo por fase.
  const aportes = Array.isArray(aportesProducto) ? aportesProducto.filter((a) => a?.texto) : [];
  const checklistProducto = aportes.length
    ? [
        ...aportes.map((a) => ({
          paso: String(a.texto).replace(/\.$/, ""),
          semana: `Semana ${a.semana}`,
        })),
        { paso: `Presentación final: ${productoCorto}`, semana: `Semana ${numSemanas}` },
      ]
    : [
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

const generarDia = (numDia, area, tema, faseIdx, totalDiasFase, _productoFinal = "", _mc = {}, durMin = 45) => {
  // ESQUELETO PURO: el código aporta SOLO forma — momentos, tiempos y
  // evaluación determinística (TABLA_EVALUACION). TODO el contenido semántico
  // (título, intención, actividades, evidencias, metacognición, recursos)
  // llega del contrato validado de la IA en el merge; si falta, R3 DETIENE.
  const esFaseFinal = faseIdx === 3;

  // R7: tiempos proporcionales a la duración real de clase
  // 45 min → 10/30/5 · 60 min → 10/40/10 · 90 min → 15/65/10
  const tInicio     = durMin <= 50 ? 10 : 15;
  const tCierre     = durMin <= 50 ? 5  : 10;
  const tDesarrollo = durMin - tInicio - tCierre;

  const mkMomento = (nombre, tiempo) => ({
    nombre,
    tiempo,
    actividades: [],      // ← contrato IA (merge)
    evidencias: "",       // ← contrato IA (merge)
    evaluacion: getEvaluacion(nombre, esFaseFinal), // determinística (política aprobada)
    recursos: { humanos: "Docente y estudiantes", didacticos: "", tecnologicos: "" }, // ← contrato IA
    metacognicion: [],    // ← contrato IA (merge)
  });

  return {
    numero: numDia,
    titulo: "",              // ← contrato IA (merge)
    etapaProgresion: getEtapaProgresion(faseIdx, numDia, totalDiasFase),
    criteriosExito: [],      // ← derivados de las evidencias reales de la IA
    intencionPedagogica: "", // ← contrato IA (merge)
    momentos: [
      mkMomento("Inicio",     `${tInicio} min`),
      mkMomento("Desarrollo", `${tDesarrollo} min`),
      mkMomento("Cierre",     `${tCierre} min`),
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

  // Asignar ranura y número global de clase a cada día. Las FASES conservan
  // su tamaño pedagógico (una fase puede abarcar varias semanas); lo que se
  // etiqueta por calendario es el "Día N" DENTRO de su semana real, para que
  // ninguna banda diga "SEMANA X (8 días)" cuando el horario es de 4.
  let slotIdx = 0;
  let claseGlobal = 0;
  const clasesPorSemanaCal = {};
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
        clasesPorSemanaCal[s.semana] = (clasesPorSemanaCal[s.semana] || 0) + 1;
        dia.numeroEnSemana = clasesPorSemanaCal[s.semana];
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

const _resolverContenidoPorTema = (contenidosPorTema = [], temaFiltro = '') => {
  if (!Array.isArray(contenidosPorTema) || !contenidosPorTema.length || !temaFiltro) return null;
  const objetivo = _normTexto(temaFiltro);
  return contenidosPorTema.find((bloque) => {
    const tema = _normTexto(bloque?.tema || bloque?.conceptos?.temas?.[0]);
    return tema && (tema === objetivo || tema.includes(objetivo) || objetivo.includes(tema));
  }) || null;
};

// ─── Capa 2 opcional: enriquecimiento_tema (tema oficial → subconjunto) ──────
// Resuelve la entrada del tema en el doc de enriquecimiento (payload.temas[]
// con temaOficial). Exportada pura para tests. null = sin Capa 2 → el flujo
// sigue con el comportamiento actual (nivel-grado completo). Nunca bloquea.

const _normTexto = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

export const resolverTemaEnriquecido = (enriquecimientoDoc, temaOficial) => {
  const temas = enriquecimientoDoc?.payload?.temas || enriquecimientoDoc?.temas;
  if (!Array.isArray(temas) || !temas.length || !temaOficial) return null;
  const objetivo = _normTexto(temaOficial);
  return temas.find((t) => {
    const nombre = _normTexto(t?.temaOficial || t?.tema);
    return nombre && (nombre === objetivo || nombre.includes(objetivo) || objetivo.includes(nombre));
  }) || null;
};

// Filtro por pertenencia de 'categoria' a las categorías del tema enriquecido.
// null = no aplicable (sin categorías, corpus sin campo categoria o cero
// coincidencias) → el caller cae al comportamiento actual.
const _filtrarPorCategoria = (items, categorias) => {
  if (!Array.isArray(items) || !items.length || !categorias?.length) return null;
  const cats = new Set(categorias.map(_normTexto));
  const conCategoria = items.filter((it) => it && typeof it === 'object' && (it.categoria || it.nombre));
  if (!conCategoria.length) return null;
  const delTema = conCategoria.filter((it) => cats.has(_normTexto(it.categoria || it.nombre)));
  return delTema.length ? delTema : null;
};

// Filtro de gramática por IGUALDAD EXACTA de 'estructura' (el enriquecimiento
// se valida contra el corpus por cadena exacta). null = no aplicable.
const _filtrarPorEstructura = (items, estructuras) => {
  if (!Array.isArray(items) || !items.length || !estructuras?.length) return null;
  const set = new Set(estructuras.map((e) => String(e).trim()));
  const delTema = items.filter((g) => set.has(String(g?.estructura || g || '').trim()));
  return delTema.length ? delTema : null;
};

// Lee del payload de nivel-grado del corpus: contenidos.conceptos + contenidos.procedimientos
// (exportada para tests)
export const _extraerContenidosMallaCorpus = (mallaPayload, temaFiltro = '', temaEnriquecido = null) => {
  const bloqueTema = _resolverContenidoPorTema(mallaPayload?.contenidosPorTema, temaFiltro);
  if (bloqueTema) {
    const conceptos = bloqueTema.conceptos || {};
    const procedimientos = bloqueTema.procedimientos || {};
    const vocabulario = textosUnicos(conceptos.vocabulario || []);
    const gramatica = textosUnicos(conceptos.gramatica || conceptos.gramática || []);
    const expresiones = textosUnicos([
      ...(conceptos.frases || []),
      ...(conceptos.expresiones || []),
      ...(conceptos.sociolinguisticos || []),
    ]);
    const funcionales = textosUnicos([
      ...(procedimientos.funcionales || []),
      ...(procedimientos.discursivos || []),
      ...(procedimientos.comprensionOralEscrita || []),
      ...(procedimientos.produccionOral || []),
      ...(procedimientos.produccionEscrita || []),
      ...(procedimientos.items || []),
    ]);
    const actitudinales = textosUnicos([
      ...(bloqueTema.actitudinales || []),
      ...(bloqueTema.actitudesValores || []),
    ]);
    const conceptuales = textosUnicos([
      bloqueTema.tema,
      ...(conceptos.temas || []),
      ...vocabulario,
      ...gramatica,
      ...expresiones,
    ]);
    return {
      vocabulario,
      gramatica,
      expresiones,
      funcionales,
      actitudinales,
      conceptuales,
      procedimentales: funcionales,
      fuenteContenido: 'contenidosPorTema',
      temaContenido: bloqueTema.tema || temaFiltro,
    };
  }

  const c = mallaPayload?.contenidos?.conceptos    || {};
  const p = mallaPayload?.contenidos?.procedimientos || {};

  // Subconjunto del tema: primero la Capa 2 (enriquecimiento_tema: categorías
  // de vocabulario + estructuras exactas); si no aplica, la segmentación por
  // campo tema/topico; si tampoco, nivel-grado completo (siempre malla
  // oficial, nunca plantilla)
  const vocabRaw = _filtrarPorCategoria(c.vocabulario, temaEnriquecido?.vocabularioCategorias)
    ?? _filtrarPorTema(Array.isArray(c.vocabulario) ? c.vocabulario : [], temaFiltro);
  let vocabulario = vocabRaw.flatMap(v =>
    Array.isArray(v.ejemplos) ? v.ejemplos : (typeof v === 'string' ? [v] : [])
  );
  const gramRaw = _filtrarPorEstructura(c.gramatica, temaEnriquecido?.gramaticaEstructuras)
    ?? _filtrarPorTema(Array.isArray(c.gramatica) ? c.gramatica : [], temaFiltro);
  let gramatica = gramRaw.map(g => g.estructura || (typeof g === 'string' ? g : '')).filter(Boolean);
  const exprRaw = _filtrarPorCategoria(c.expresiones, temaEnriquecido?.expresiones)
    ?? _filtrarPorTema(Array.isArray(c.expresiones) ? c.expresiones : [], temaFiltro);
  let expresiones = exprRaw.flatMap(e =>
    Array.isArray(e.ejemplos) ? e.ejemplos : (typeof e === 'string' ? [e] : [])
  );
  // Expresiones/funcionales del tema enriquecido pasan directo (etiquetas
  // oficiales de la malla) cuando el corpus no permite filtrar por categoría
  if (!expresiones.length && temaEnriquecido?.expresiones?.length) {
    expresiones = temaEnriquecido.expresiones.map(String);
  }
  let funcionales = temaEnriquecido?.funcionales?.length
    ? temaEnriquecido.funcionales.map(String)
    : _filtrarPorTema(Array.isArray(p.funcionales) ? p.funcionales : [], temaFiltro)
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

// ─── Tabla curricular por competencia (códigos CE/IL del corpus) ─────────────
// Soporta AMBOS formatos del corpus: indicadores ANIDADOS en cada competencia
// (v1.3: comp.indicadoresLogro[]) e indicadores PLANOS con vínculo por
// competenciaId (v1.2: payload.indicadoresLogro[] con ind.competenciaId).
// Exportada pura para tests.

export const construirCompetenciasDetalle = (allComps = [], allInds = [], compFundEf = []) => {
  // Tolerante a AMBAS formas: objeto {id, descripcion|texto} y string plano
  // ("Responde de forma adecuada...") — corpus antiguos guardan strings
  const aIndicador = (ind) => {
    if (typeof ind === "string") {
      return { codigo: "", descripcion: ind.trim() };
    }
    return {
      codigo: ind?.id || ind?.codigo || "",
      descripcion: ind?.descripcion || ind?.texto || "",
    };
  };
  const normFund = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

  // Las conversiones a veces meten una competencia basura/vacía (ej. 8 filas
  // cuando la Adecuación tiene 7). Se filtran ANTES de repartir: los bloques
  // se calculan sobre las competencias VÁLIDAS (21/7 = 3 ✓, no 21/8 ✗).
  const compsConTexto = allComps.filter(
    (c) => String(c?.especificaGrado || c?.especifica || c?.descripcion || "").trim()
  );

  const indsPlanos = Array.isArray(allInds) ? allInds : [];
  const hayVinculo = indsPlanos.some((ind) => String(ind?.competenciaId || ind?.competencia || "").trim());

  // Si no hay competenciaId, solo repartimos por bloques cuando la división
  // es exacta. Si una conversión duplicó una Competencia Fundamental, se
  // elimina solo cuando eso hace exacta la división; no se inventan vínculos.
  let compsValidas = compsConTexto;
  if (!hayVinculo && indsPlanos.length && compsConTexto.length && indsPlanos.length % compsConTexto.length !== 0) {
    const vistas = new Set();
    const dedupePorFundamental = compsConTexto.filter((comp) => {
      const key = normFund(comp?.competenciaFundamental || comp?.fundamental || comp?.descripcion);
      if (!key) return true;
      if (vistas.has(key)) return false;
      vistas.add(key);
      return true;
    });
    if (dedupePorFundamental.length && indsPlanos.length % dedupePorFundamental.length === 0) {
      compsValidas = dedupePorFundamental;
    }
  }

  // Fallback 4: asociación por nombre de Competencia Fundamental cuando los
  // indicadores planos la traen (cada CF aparece una sola vez en la Adecuación)
  const hayFundEnInds = indsPlanos.some((ind) => normFund(ind?.competenciaFundamental));
  // Fallback 5 (bloques secuenciales): los corpus oficiales listan los
  // indicadores en el orden de sus competencias (I01-I03 → C01...). Solo si
  // la división sobre las competencias VÁLIDAS es exacta.
  const tamanoBloque = !hayVinculo && compsValidas.length && indsPlanos.length
    && indsPlanos.length % compsValidas.length === 0
    ? indsPlanos.length / compsValidas.length
    : 0;

  return compsValidas.map((comp, i) => {
    const anidados = Array.isArray(comp.indicadoresLogro) && comp.indicadoresLogro.length
      ? comp.indicadoresLogro
      : Array.isArray(comp.indicadores) && comp.indicadores.length
        ? comp.indicadores
        : [];
    const compId = String(comp.id || comp.codigo || "").trim();
    // Fallback v1.2: índice plano vinculado por competenciaId/competencia
    const vinculados = !anidados.length && compId
      ? indsPlanos.filter((ind) =>
          String(ind?.competenciaId || ind?.competencia || "").trim() === compId)
      : [];
    const compFund = comp.competenciaFundamental || comp.fundamental || "";
    const porFundamental = !anidados.length && !vinculados.length && hayFundEnInds && normFund(compFund)
      ? indsPlanos.filter((ind) => normFund(ind?.competenciaFundamental) === normFund(compFund))
      : [];
    const porBloque = !anidados.length && !vinculados.length && !porFundamental.length && tamanoBloque
      ? indsPlanos.slice(i * tamanoBloque, (i + 1) * tamanoBloque)
      : [];
    const fuente = anidados.length
      ? anidados
      : vinculados.length
        ? vinculados
        : porFundamental.length ? porFundamental : porBloque;
    return {
      // Código oficial de la competencia específica (ej. CE-LEI-1 / ING-1-C01)
      codigo: compId,
      competenciaFundamental: compFund || compFundEf[i] || compFundEf[i % compFundEf.length] || "",
      especifica: comp.especificaGrado || comp.especifica || comp.descripcion || "",
      // El formatter acepta también strings (unidades guardadas antes)
      indicadores: fuente.map(aIndicador).filter((ind) => ind.descripcion),
    };
  });
};

const normalizarCodigoIndicador = (codigo) =>
  String(codigo || "").replaceAll("[", "").replaceAll("]", "").replace(/\s/g, "").toUpperCase().trim();

const codigosIndicadoresTrabajados = (fasesSemanales = []) => {
  const codigos = new Set();
  for (const fase of fasesSemanales || []) {
    for (const dia of fase.dias || []) {
      for (const codigo of dia.indicadoresTrabajados || []) {
        const norm = normalizarCodigoIndicador(codigo);
        if (norm) codigos.add(norm);
      }
    }
  }
  return codigos;
};

const enriquecerIndicadoresCurriculares = (detalle = [], codigosActuales = new Set(), codigosPrevios = new Set()) =>
  (detalle || []).map((comp) => ({
    ...comp,
    indicadores: (comp.indicadores || []).map((ind) => {
      const item = typeof ind === "string"
        ? { codigo: "", descripcion: ind }
        : { ...ind };
      const codigoNorm = normalizarCodigoIndicador(item.codigo || item.id || item.codigoOficial);
      return {
        ...item,
        codigo: item.codigo || item.id || item.codigoOficial || "",
        descripcion: item.descripcion || item.texto || "",
        aplicaTemaActual: codigoNorm ? codigosActuales.has(codigoNorm) : false,
        trabajadoAntes: codigoNorm ? codigosPrevios.has(codigoNorm) : false,
      };
    }),
  }));

// ─── Inicio canónico del formato MINERD (5 posiciones fijas) ─────────────────
// El esqueleto lo pone el código; el contenido lo aporta el contrato de la IA
// (saludoInicial, retroalimentacionPrevia, saberesPrevios, actividadEnganche).
// La retroalimentación de la clase anterior vive AQUÍ (posición 2), no en el
// Cierre. Posición 5 fija del formato oficial.

export const construirInicioCanonico = (clase = {}) => {
  const saludo = String(clase.saludoInicial || "").trim().replace(/^\(+|\)+$/g, "");
  return [
    `Responden al saludo e indicaciones iniciales. (${saludo})`,
    String(clase.retroalimentacionPrevia || "").trim(),
    String(clase.saberesPrevios || "").trim(),
    String(clase.actividadEnganche || "").trim(),
    "Escuchan la intención pedagógica y el propósito de la clase.",
  ];
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
    producto: productoFinal,
    contextoComunitario: contexto.contextoComunitario || "",
  });
  // Producto escrito por el docente = nombre fijado; la IA no propone otro
  if (contexto.productoPropio) spec.productoFinalNombre = contexto.productoPropio;

  const memoriaAcumulada = [];
  const totalClases = fases.reduce((sum, f) => sum + f.dias.length, 0);
  let globalOffset = 0;

  for (const fase of fases) {
    const numClases = fase.dias.length;

    // Progreso narrado para el docente: semana, clases y el contenido que se
    // está redactando en ese momento (foco oficial de la semana)
    const progressWrapper = onProgress
      ? (startDia, endDia) => {
          const globalStart = globalOffset + startDia;
          const globalEnd   = globalOffset + endDia;
          const rango = globalStart === globalEnd
            ? `la clase ${globalStart}`
            : `las clases ${globalStart} y ${globalEnd}`;
          const foco = getFocoGramatical(spec.contenidosClaves?.gramatica, fase.numero, numSemanas);
          const focoCompleto = foco.length
            ? foco.join(" · ")
            : "vocabulario y expresiones del tema";
          const focoTx = focoCompleto.length > 90 ? `${focoCompleto.slice(0, 90)}…` : focoCompleto;
          onProgress(
            `✍️ Semana ${fase.numero} de ${numSemanas} — escribiendo ${rango} de ${totalClases} · Trabajando: ${focoTx}`
          );
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

      // Título e intención pedagógica: SOLO del contrato validado de la IA
      fase.tituloSemana = fase.tituloSemana || String(aiClase.tituloSemana || "").trim();
      dia.titulo = String(aiClase.titulo || "").trim();
      dia.tituloIA = dia.titulo;
      dia.tituloSemana = String(aiClase.tituloSemana || fase.tituloSemana || "").trim();
      dia.focoLinguistico = String(aiClase.focoLinguistico || "").trim();
      dia.estrategiasDia = String(aiClase.estrategiasDia || "").trim();
      dia.intencionPedagogica = String(aiClase.intencionPedagogica || "").trim();
      // 3A/3B — aporte concreto al producto y técnica metodológica del día
      dia.aporteProducto = String(aiClase.aporteProducto || "").trim();
      dia.actividadCLT = aiClase.actividadCLT
        ? {
            nombre: String(aiClase.actividadCLT.nombre || "").trim(),
            mecanica: String(aiClase.actividadCLT.mecanica || "").trim(),
          }
        : null;
      dia.indicadoresTrabajados = Array.isArray(aiClase.indicadoresTrabajados)
        ? aiClase.indicadoresTrabajados
        : [];

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
        const esInicio = mi === 0;
        const etiqueta = `semana ${fase.numero}, clase ${dia.dia || i + 1}, "${orig.nombre || `momento ${mi + 1}`}"`;
        const listaOk = (v) => Array.isArray(v) && v.filter((x) => String(x || "").trim()).length > 0;
        // Evidencias DESAGREGADAS {conocimientos/desempeno/producto} — al
        // menos una clave con contenido (contrato v1.3)
        const evidenciasOk = (ev) => ev && typeof ev === "object" && !Array.isArray(ev)
          && ["conocimientos", "desempeno", "producto"].some((k) => listaOk(ev[k]));
        if (!esInicio && !listaOk(aiMom.actividades)) throw new Error(`R3: ${etiqueta} — la IA no aportó actividades (plantillas vetadas como respaldo)`);
        if (!evidenciasOk(aiMom.evidencias)) throw new Error(`R3: ${etiqueta} — la IA no aportó evidencias desagregadas (plantillas vetadas como respaldo)`);
        if (!listaOk(aiMom.metacognicion)) throw new Error(`R3: ${etiqueta} — la IA no aportó metacognición (plantillas vetadas como respaldo)`);
        if (!listaOk(aiMom.recursos)) throw new Error(`R3: ${etiqueta} — la IA no aportó recursos (plantillas vetadas como respaldo)`);

        // Inicio canónico: 5 posiciones fijas armadas en código con el
        // contenido del contrato (saludo, retroalimentación de la clase
        // anterior, saberes previos, enganche, intención pedagógica).
        orig.actividades = esInicio ? construirInicioCanonico(aiClase) : aiMom.actividades;
        if (aiMom.tiempo) orig.tiempo = aiMom.tiempo;
        // Render desagregado DENTRO de la celda Evidencias existente
        // (contenido, no columnas nuevas): **Conocimientos:** / **Desempeño:**
        // / **Producto:** con numeración — como el documento modelo
        orig.evidencias = [
          ["conocimientos", "Conocimientos"],
          ["desempeno", "Desempeño"],
          ["producto", "Producto"],
        ].map(([clave, etiquetaEv]) => {
          const items = (aiMom.evidencias?.[clave] || []).map((e) => String(e).trim()).filter(Boolean);
          return items.length
            ? `**${etiquetaEv}:**\n${items.map((e, n) => `${n + 1}. ${e}`).join("\n")}`
            : "";
        }).filter(Boolean).join("\n");
        orig.metacognicion = aiMom.metacognicion;
        orig.recursos = {
          humanos: "Docente y estudiantes",
          didacticos: aiMom.recursos.map((r) => String(r).trim()).filter(Boolean).join(", "),
          // Tecnológicos: derivación determinística desde las actividades reales
          tecnologicos: derivarRecursos(orig.actividades, area, fase.numero).tecnologicos,
        };
      });

      // "Hoy tendrás éxito si…": derivado de las evidencias de DESEMPEÑO y
      // PRODUCTO reales de la clase (Desarrollo + Cierre), no de un checklist
      // fijo idéntico entre clases.
      const evDesempenoProducto = (ev) => [
        ...(ev?.desempeno || []),
        ...(ev?.producto || []),
      ];
      const evidenciasClase = [
        ...evDesempenoProducto(aiClase.momentos[1]?.evidencias).slice(0, 3),
        ...evDesempenoProducto(aiClase.momentos[2]?.evidencias).slice(0, 1),
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
    const normCodigo = (c) => String(c || "").replaceAll("[", "").replaceAll("]", "").replace(/\s/g, "").toUpperCase();
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

    // 4 — NEAE y observaciones del bloque LIGADAS AL FOCO (contrato R14):
    // sustituyen el bloque genérico repetido de la plantilla
    if (weekPlan.adaptacionesSemana) {
      fase.adaptacionesNEAE = {
        acceso: String(weekPlan.adaptacionesSemana.acceso || "").trim(),
        metodologicas: String(weekPlan.adaptacionesSemana.metodologicas || "").trim(),
        evaluacion: String(weekPlan.adaptacionesSemana.evaluacion || "").trim(),
      };
    }
    if (weekPlan.observacionesSemana) {
      fase.observacionesSemana = String(weekPlan.observacionesSemana).trim();
    }

    globalOffset += numClases;
  }

  return { fases, productoFinalNombre: spec.productoFinalNombre || "" };
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
    contextoComunitario = "",
    jornada = "Extendida",
    competenciasFundamentalesSeleccionadas = [],
    temasSeleccionados = [],
    indicadoresTrabajadosAntes = [],
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
  onProgress?.("🔍 Verificando la malla curricular oficial (MINERD) de tu grado...");
  let curricularDoc;
  try {
    // Clave estricta: (level, grade, subject, contentType) — primaria no hereda secundaria
    curricularDoc = await getCurricularContentForUnit(claveContenido, grado, nivel);
  } catch (permErr) {
    throw new Error(`Sin acceso al contenido curricular — ${permErr.message}`, { cause: permErr });
  }
  if (!curricularDoc) {
    throw new Error(
      `No hay malla curricular cargada para ${claveContenido} — ${String(grado).split(" ")[0] || grado} de ${nivel}. ` +
      `Ve a Administración → Banco de Conocimiento y sube el JSON de la malla de ese nivel.`
    );
  }
  const mallaPayload    = curricularDoc.payload || {};

  // Trazabilidad: qué doc de malla se cargó realmente (para triaje en consola)
  const versionMalla = curricularDoc.schemaVersion || mallaPayload.schemaVersion || "desconocida";
  console.info(
    `[Unidad] Malla cargada: id=${curricularDoc.id || "?"} · contentId=${curricularDoc.contentId || mallaPayload.contentId || "—"} ` +
    `· schemaVersion=${versionMalla} · level=${curricularDoc.level || "?"} · grade=${curricularDoc.grade || "?"} ` +
    `· temas=${temasOficialesDeMalla(mallaPayload).length} · enriquecimientoTema=${curricularDoc.enriquecimientoTema ? "sí" : "no"}`
  );

  // Índices planos del corpus (payload level) — deben existir antes de chequeo (c)
  const allComps = Array.isArray(mallaPayload.competencias) ? mallaPayload.competencias : [];
  const allInds  = Array.isArray(mallaPayload.indicadoresLogro)
    ? mallaPayload.indicadoresLogro
    : Array.isArray(mallaPayload.indicadores) ? mallaPayload.indicadores : [];

  if (!allComps.length && !allInds.length) {
    throw new Error(
      `Malla curricular incompleta o versión antigua (schemaVersion ${versionMalla}) para ${claveContenido} — ${grado}: ` +
      `falta competencias e indicadoresLogro en el payload. ` +
      `Recarga la versión vigente del JSON en el Banco de Conocimiento.`
    );
  }

  // Caso (c) ampliado: sin contenidos estructurados NO se rellena nada —
  // el fallback correcto es DETENER, nunca inventar contenido
  if (!mallaPayload.contenidos && !mallaPayload.contenidosGenerales) {
    throw new Error(
      `Malla incompleta o versión antigua (schemaVersion ${versionMalla}) para ${claveContenido} — ${grado}: ` +
      `el doc "${curricularDoc.id || "?"}" no trae payload.contenidos. ` +
      `Recarga la versión vigente del JSON en el Banco de Conocimiento.`
    );
  }

  // Candado temprano de asociación: si la tabla curricular va a quedar sin
  // indicadores, DETENER AQUÍ con diagnóstico completo — antes de gastar una
  // sola llamada de IA (el validador final quedaría como última defensa).
  const detalleTemprano = construirCompetenciasDetalle(allComps, allInds, compFundEf);
  if (detalleTemprano.length && !detalleTemprano.some((c) => c.indicadores.length)) {
    const conVinculo = allInds.filter((i) => String(i?.competenciaId || i?.competencia || "").trim()).length;
    const anidados = allComps.filter((c) => (c?.indicadoresLogro || c?.indicadores || []).length).length;
    const divisionExacta = allComps.length && allInds.length && allInds.length % allComps.length === 0;
    const listaComps = allComps.map((c, idx) =>
      `${idx + 1}:${String(c?.id || c?.codigo || "s/id")}·${String(c?.competenciaFundamental || c?.fundamental || "sin CF").slice(0, 26)}${String(c?.especificaGrado || c?.especifica || c?.descripcion || "").trim() ? "" : "·SIN ESPECÍFICA"}`
    ).join(" | ");
    throw new Error(
      `Malla sin indicadores asociables a sus competencias (schemaVersion ${versionMalla}, doc "${curricularDoc.id || "?"}"): ` +
      `${allComps.length} competencias (${anidados} con indicadores anidados), ${allInds.length} indicadores planos ` +
      `(${conVinculo} con competenciaId, división ${allInds.length}/${allComps.length} ${divisionExacta ? "exacta" : "INEXACTA"}). ` +
      `Competencias: [${listaComps}]. ` +
      `Corrige el JSON en Administración → Potente IA (sección indicadoresLogro) o recarga la versión vigente (v1.2+).`
    );
  }

  // FUENTE ÚNICA: mismos temas oficiales que consume el selector del Asesor
  const temasOficiales = temasOficialesDeMalla(mallaPayload);
  // Resuelve el título del docente contra los temas oficiales → devuelve string
  const temaMallaStr   = _resolverTemaMalla(titulo, temasOficiales);

  onProgress?.(`📚 Malla oficial verificada — preparando los contenidos de "${temaMallaStr || titulo}"...`);

  // Estrategia y ejes: OFICIALES de la malla cuando existen (el texto del
  // docente siempre manda; la etiqueta de área queda como último recurso)
  const estrategiaOficial = Array.isArray(mallaPayload.estrategiasSugeridas) && mallaPayload.estrategiasSugeridas.length
    ? String(mallaPayload.estrategiasSugeridas[0]?.nombre || mallaPayload.estrategiasSugeridas[0] || "").trim()
    : "";
  const estrategiaFinal = estrategiaTexto || estrategiaOficial || estrategiaEf;
  const ejesOficiales = Array.isArray(mallaPayload.ejesTransversales)
    ? mallaPayload.ejesTransversales
        .map((e) => String(e?.eje || e?.nombre || e?.titulo || (typeof e === "string" ? e : "")).trim())
        .filter(Boolean)
    : [];
  const ejesFinal = ejesOficiales.length ? ejesOficiales : ejes;

  // Capa 2 opcional: entrada del tema en el doc enriquecimiento_tema derivado
  // de esta malla (adjuntado por getCurricularContentForUnit); null = sin capa
  const temaEnriquecido = resolverTemaEnriquecido(
    curricularDoc.enriquecimientoTema,
    temaMallaStr || titulo,
  );

  // Extrae vocabulario, gramática y funcionales del corpus, filtrados al tema
  // de la unidad (Capa 2 por categorías/estructuras exactas; fallback:
  // segmentación por tema del corpus; fallback: nivel-grado completo)
  const mallaContenidos = _extraerContenidosMallaCorpus(mallaPayload, temaMallaStr || titulo, temaEnriquecido);

  // Cobertura temática VISIBLE para el docente: sin Capa 2 (enriquecimiento_
  // tema) ni bloque contenidosPorTema para este tema, la gramática y el
  // vocabulario salen del grado COMPLETO y la unidad puede arrastrar
  // estructuras de otros temas (ej. clima en una unidad de la casa). No
  // bloquea — la Capa 2 es opcional por diseño — pero se avisa, no se calla.
  const advertencias = [];
  if (!temaEnriquecido && mallaContenidos.fuenteContenido !== "contenidosPorTema") {
    const aviso =
      `El tema "${temaMallaStr || titulo}" no tiene contenidos propios en la malla del Banco ` +
      `(enriquecimiento_tema o contenidosPorTema): la gramática y el vocabulario provienen del grado completo, ` +
      `y la unidad puede incluir estructuras de otros temas. Carga el enriquecimiento de este tema en el Banco de Conocimiento para una unidad 100% enfocada.`;
    advertencias.push(aviso);
    console.warn(`[Unidad] ⚠️ ${aviso}`);
    onProgress?.(`⚠️ ${aviso}`);
  }

  const modeloCurricularSuperior = construirModeloCurricularSuperior({
    payload: mallaPayload,
    titulo: temaMallaStr || titulo,
    area: claveContenido,
    estrategia: estrategiaFinal,
    producto,
    ejes: ejesFinal,
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
    const actitudinalesTema = textosUnicos(mallaContenidos.actitudinales || []).slice(0, 8);
    const conceptuales = conceptualesTema.length ? conceptualesTema : textosUnicos(sintesis.conceptuales);
    const procedimentales = procedimentalesTema.length ? procedimentalesTema : textosUnicos(sintesis.procedimentales);
    const actitudinales = actitudinalesTema.length ? actitudinalesTema : textosUnicos(sintesis.actitudinales);
    // LA MALLA ES LA ÚNICA FUENTE: columna vacía = malla incompleta = DETENER
    // (nunca rellenar con texto genérico inventado)
    const faltantes = [
      !conceptuales.length && "conceptuales",
      !procedimentales.length && "procedimentales",
      !actitudinales.length && "actitudinales",
    ].filter(Boolean);
    if (faltantes.length) {
      throw new Error(
        `Malla incompleta (schemaVersion ${versionMalla}, doc "${curricularDoc.id || "?"}"): ` +
        `sin contenidos ${faltantes.join(", ")} para el tema. ` +
        `Corrige el JSON en Administración → Potente IA o recarga la versión vigente.`
      );
    }
    return { conceptuales, procedimentales, actitudinales };
  })();

  const { fases: fasesSemanalesGeneradas, productoFinalNombre } = await _generarFasesConIA(
    numSemanas, schedule, claveContenido, titulo, estrategiaFinal, producto,
    {
      grado, nivel,
      contextoComunitario,
      // Si el docente escribió su propio producto, ese nombre MANDA y la IA
      // no propone otro; el nombre generado solo sustituye el genérico.
      productoPropio: productoFinalTexto ? producto : "",
    },
    mallaContenidos,
    mallaPayload, allInds, allComps, durMinEf, grado,
    onProgress,
  );

  // 3A — producto final NOMBRADO: sustituye el rótulo genérico en todo el
  // documento (datos generales, situación, nota institucional y anexos)
  const productoNombrado = String(productoFinalNombre || "").trim() || producto;
  const situacionFinal = productoNombrado !== producto
    ? String(situacion).split(producto).join(productoNombrado)
    : situacion;

  const indicadoresActuales = codigosIndicadoresTrabajados(fasesSemanalesGeneradas);
  const indicadoresPrevios = new Set(
    (Array.isArray(indicadoresTrabajadosAntes) ? indicadoresTrabajadosAntes : [])
      .map(normalizarCodigoIndicador)
      .filter(Boolean)
  );
  const competenciasDetalleEnriquecidas = enriquecerIndicadoresCurriculares(
    detalleTemprano,
    indicadoresActuales,
    indicadoresPrevios,
  );

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
      productoFinal: productoNombrado,
      // Temas curriculares que el docente eligió integrar en la unidad
      // (vacío = trabaja solo el tema del título)
      temasIntegrados: Array.isArray(temasSeleccionados) ? temasSeleccionados : [],
    },
    ejesTematicos: ejesFinal,
    situacionAprendizaje: situacionFinal,
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
    competenciasDetalle: competenciasDetalleEnriquecidas,
    matrizCurricularInterna: {
      visibleParaDocente: false,
      temaOficial: temaMallaStr || titulo,
      indicadoresTrabajadosUnidad: Array.from(indicadoresActuales),
      indicadoresTrabajadosAntes: Array.from(indicadoresPrevios),
      competencias: competenciasDetalleEnriquecidas,
      progresionCurricular: modeloCurricularSuperior.progresion || [],
    },
    contenidos,
    fasesSemanales: fasesSemanalesGeneradas,
    especificacionCurricular: buildEspecificacionCurricular({
      mallaPayload, titulo, allInds, allComps, mallaContenidos, area: claveContenido, grado,
    }),
    // Trazabilidad: la malla EXACTA que produjo esta unidad. Ancla obligatoria
    // para la cosecha del Banco de Aprendizaje (verificarRefsContraMalla exige
    // igualdad de id/contentId contra la malla activa al servir).
    mallaRef: {
      id: curricularDoc.id || "",
      contentId: curricularDoc.contentId || mallaPayload.contentId || "",
      schemaVersion: versionMalla,
    },
    // Avisos de cobertura (ej. tema sin Capa 2): informativos, nunca bloquean
    advertencias,
  };

  // ── Secciones del documento modelo (2026-07-04) ────────────────────────────
  // Ejes contextualizados, nota institucional, checkpoint de mitad de unidad y
  // anexos A-L. Se añaden como campos nuevos: las unidades ya guardadas sin
  // estos campos siguen renderizando igual (el formateador los trata como
  // opcionales).
  onProgress?.("🎨 Armando tu documento MINERD (componente curricular, fases y anexos)...");

  unidadResult.ejesTematicosDetalle = construirEjesContextualizados(ejesFinal, {
    area: claveContenido, tema: titulo,
  });
  // 3A/6 — aportes REALES al producto (contrato de la IA) mapeados por semana
  // calendario: alimentan el checkpoint y el Anexo H, nunca plantilla
  const aportesProducto = (fasesSemanalesGeneradas || [])
    .flatMap((f) => f.dias || [])
    .filter((d) => d.aporteProducto)
    .map((d) => ({ semana: d.semana || 1, texto: d.aporteProducto }));

  unidadResult.notaInstitucional = construirNotaInstitucional({
    clasesPorSemana: diasClaseFinal.length,
    durMin: durMinEf,
    producto: productoNombrado,
  });
  unidadResult.checkpointFormativo = construirCheckpointFormativo({
    tema: titulo, producto: productoNombrado, numSemanas,
    aportesHastaMitad: aportesProducto
      .filter((a) => a.semana <= Math.ceil(numSemanas / 2))
      .map((a) => a.texto),
  });
  unidadResult.anexos = construirAnexosUnidad({
    area: claveContenido,
    tema: titulo,
    producto: productoNombrado,
    // 6 — glosario SOLO con el vocabulario del tema servido a la IA, nunca
    // la lista completa del grado
    vocabulario: (mallaContenidos.vocabulario || []).slice(0, 20),
    fases: unidadResult.fasesSemanales || [],
    numSemanas,
    aportesProducto,
  });

  // R1 FINAL sobre el DOCUMENTO RENDERIZADO completo (no solo el JSON de la
  // IA): atrapa cualquier placeholder o campo vacío que entre por código
  // residual antes de entregar la unidad al docente.
  onProgress?.("✅ Revisión final: verificando que ninguna sección quede vacía...");
  const htmlRenderizado = formatearUnidadHTML(unidadResult);
  validarUnidadRenderizada(unidadResult, htmlRenderizado);

  return unidadResult;
};

// ─── R1 final: validación del documento renderizado ──────────────────────────
// El esquema MINERD no admite campos vacíos ni placeholders. Esta validación
// recorre la unidad Y el HTML renderizado; cualquier hueco detiene la entrega.
// (La lista de placeholders y el localizador viven en bancoConocimientoService
// — misma higiene en la subida al Banco y en el render.)

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
  });
  // Indicadores: exige que la tabla tenga indicadores EN CONJUNTO. Una
  // competencia puntual sin indicadores en la malla se muestra con la nota
  // honesta del formatter ("Sin indicadores en la malla…"), no bloquea.
  if (detalle.length && !detalle.some((c) => c.indicadores?.length)) {
    errores.push("ninguna competencia tiene indicadores de logro (revisa el corpus del Banco de Conocimiento)");
  }

  (unidad?.fasesSemanales || []).forEach((fase) => {
    if (!fase.indicadoresAvance?.length) errores.push(`fase ${fase.numero} sin indicadores de avance`);
    (fase.dias || []).forEach((dia) => {
      const ref = `fase ${fase.numero}, clase ${dia.numeroGlobal || dia.numero}`;
      if (vacio(dia.titulo)) errores.push(`${ref}: sin título`);
      if (vacio(dia.intencionPedagogica)) errores.push(`${ref}: sin intención pedagógica`);
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

        // Contrato de estilo MINERD: voz verbo-inicial en toda actividad
        for (const act of mom.actividades || []) {
          const voz = validarVozActividad(act);
          if (!voz.ok) errores.push(`${mref}: voz — ${voz.motivo}`);
        }
      });

      // Inicio canónico del formato oficial: 5 posiciones fijas
      const actsInicio = (dia.momentos || [])[0]?.actividades || [];
      if (actsInicio.length !== 5) {
        errores.push(`${ref}: el Inicio no tiene las 5 posiciones canónicas (tiene ${actsInicio.length})`);
      } else {
        if (!String(actsInicio[0]).startsWith("Responden al saludo")) {
          errores.push(`${ref}: posición 1 del Inicio no es el saludo canónico`);
        }
        if (!String(actsInicio[4]).startsWith("Escuchan la intención pedagógica")) {
          errores.push(`${ref}: posición 5 del Inicio no es la intención pedagógica`);
        }
      }
    });
  });

  // Placeholders legacy: se buscan SOLO en las secciones que se RENDERIZAN y
  // que llena el código o el corpus. Ni el texto de la IA (lenguaje pedagógico
  // normal) ni datos internos no renderizados (contenidosSintesis del modelo
  // superior) pueden bloquear. El hallazgo reporta la RUTA exacta.
  const seccionesRenderizadas = {
    "CONTENIDOS": unidad?.contenidos,
    "situacionAprendizaje": unidad?.situacionAprendizaje,
    "ambienteAprendizaje": unidad?.ambienteAprendizaje,
    "notaInstitucional": unidad?.notaInstitucional,
    "ejesTematicosDetalle": unidad?.ejesTematicosDetalle,
    "anexos": unidad?.anexos,
    "modeloCurricularSuperior.ejes": unidad?.modeloCurricularSuperior?.ejes,
    "modeloCurricularSuperior.progresion": unidad?.modeloCurricularSuperior?.progresion,
    "competenciasDetalle": unidad?.competenciasDetalle,
  };
  for (const [ruta, valor] of Object.entries(seccionesRenderizadas)) {
    for (const hallazgo of localizarPlaceholdersProhibidos(valor, ruta)) {
      errores.push(`placeholder legacy en ${hallazgo.ruta}: "${hallazgo.cadena}" — depura esa línea del JSON en el Banco de Conocimiento`);
    }
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

  // La progresión curricular queda guardada en matrizCurricularInterna para
  // trazabilidad y auditoría. No se imprime al docente para no cargar el plan
  // con una tabla técnica que pertenece al motor curricular.
  const progresionHtml = "";

  // Estilo oficial: la primera palabra de cada actividad va en negrita
  // ("Responden...", "Retroalimentación...", "Recuperación..."). Es una
  // transformación de render: la IA entrega texto plano y las unidades ya
  // guardadas también se benefician. Si la actividad ya trae su propia
  // negrita inicial (markdown ** legacy), no se duplica.
  const negritaPrimeraPalabra = (texto) => {
    const t = String(texto || "");
    if (!t.trim() || t.trimStart().startsWith("**")) return t;
    return t.replace(/^(\s*)(\S+)/, (_m, esp, palabra) => `${esp}<strong>${palabra}</strong>`);
  };

  // El checkpoint de mitad se imprime UNA sola vez, aunque dos fases compartan
  // la semana de frontera (bug del duplicado del documento generado).
  let checkpointEmitido = false;

  const fasesHtml = (unidad.fasesSemanales || []).map((fase) => {
    // Una FASE puede abarcar varias semanas calendario (su tamaño es decisión
    // pedagógica). Para el documento, sus días se agrupan por la semana REAL
    // del horario: la fase de 8 clases con 4 clases/semana se muestra como
    // SEMANA 2 (4 días) + SEMANA 3 (4 días), nunca "SEMANA 2 (8 días)".
    const gruposSemana = [];
    (fase.dias || []).forEach((dia) => {
      const sem = dia.semana || fase.numero;
      let g = gruposSemana[gruposSemana.length - 1];
      if (!g || g.semana !== sem) {
        g = { semana: sem, dias: [] };
        gruposSemana.push(g);
      }
      g.dias.push(dia);
    });

    const diaHtml = (dia) => {
      const momentosHtml = (dia.momentos || []).map((mom) => {
        const actsHtml = (mom.actividades || []).map((a, i) => {
          const html = negritaPrimeraPalabra(a)
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

      const focoHtml = dia.focoLinguistico ? ` <span style="font-weight:400">· ${dia.focoLinguistico}</span>` : "";
      const estrategiaDiaHtml = dia.estrategiasDia
        ? `<div class="est-band">Estrategia de enseñanza y aprendizaje: ${dia.estrategiasDia}</div>`
        : "";
      return `
        <div class="semana-band">Día ${dia.numeroEnSemana || dia.dia || dia.numero || dia.numeroGlobal}: "${dia.titulo}"${focoHtml}</div>
        ${estrategiaDiaHtml}
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
    };

    // Banda por semana calendario dentro de la fase, con el título de semana
    // que aportó la IA (o el de la fase para unidades guardadas legacy)
    const diasHtml = gruposSemana.map((g) => {
      const tituloSem = String(g.dias[0]?.tituloSemana || fase.tituloSemana || "").trim();
      const banda = `<div class="semana-band">${m.titulo} — SEMANA ${g.semana} (${g.dias.length} día${g.dias.length === 1 ? "" : "s"})${tituloSem ? `: "${tituloSem}"` : ""}</div>`;
      return banda + g.dias.map(diaHtml).join("");
    }).join("");

    // ADAPTACIONES NEAE del bloque, LIGADAS AL FOCO (contrato R14). Fallback a
    // las del primer día para unidades guardadas legacy.
    const neae = fase.adaptacionesNEAE || fase.dias[0]?.adaptacionesNEAE;
    const neaeHtml = neae ? `
      <div class="section-head">ADAPTACIONES (NEAE — si aplica)</div>
      <div class="neae-grid">
        <div class="neae-col"><div class="neae-head">De acceso</div><div class="neae-body">${neae.acceso}</div></div>
        <div class="neae-col"><div class="neae-head">Metodológicas</div><div class="neae-body">${neae.metodologicas}</div></div>
        <div class="neae-col"><div class="neae-head">De evaluación</div><div class="neae-body">${neae.evaluacion}</div></div>
      </div>` : "";

    // RESUMEN: observaciones ligadas al foco de la semana (contrato R14),
    // con fallback al resumen legacy del primer día.
    const resEv = fase.dias[0]?.resumenEvaluacion;
    const obsSemana = String(fase.observacionesSemana || resEv?.observaciones || "").trim();
    const resumenHtml = (resEv || obsSemana) ? `
      <div class="section-head">RESUMEN DE EVALUACIÓN Y OBSERVACIONES</div>
      <div class="neae-grid">
        <div class="neae-col"><div class="neae-head">Técnicas</div><div class="neae-body">${(resEv?.tecnicas || []).join(", ") || "Observación directa, revisión de producciones y ticket de salida."}</div></div>
        <div class="neae-col"><div class="neae-head">Instrumentos</div><div class="neae-body">${(resEv?.instrumentos || []).join(", ") || "Lista de cotejo, rúbrica analítica, escala de valoración."}</div></div>
        <div class="neae-col"><div class="neae-head">Observaciones</div><div class="neae-body">${obsSemana}</div></div>
      </div>` : "";

    // Checkpoint formativo de mitad de unidad: UNA sola vez. Se emite en la
    // PRIMERA fase cuyo rango calendario contenga la semana señalada (el flag
    // evita el duplicado cuando dos fases comparten esa semana de frontera).
    const cp = unidad.checkpointFormativo;
    const semanasFase = (fase.dias || []).map((d) => d.semana).filter(Boolean);
    const contieneCheckpoint = cp && !checkpointEmitido && semanasFase.length
      && Math.min(...semanasFase) <= cp.semana && cp.semana <= Math.max(...semanasFase);
    if (contieneCheckpoint) checkpointEmitido = true;
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
        const estilo = [
          ind?.aplicaTemaActual ? 'font-weight:700' : '',
          ind?.trabajadoAntes ? 'text-decoration:line-through;opacity:.72' : '',
        ].filter(Boolean).join(';');
        const abrir = estilo ? `<span style="${estilo}">` : '';
        const cerrar = estilo ? '</span>' : '';
        const cod = ind?.codigo ? `<strong>${ind.codigo}</strong> — ` : '';
        return `${abrir}${cod}${ind?.descripcion || ''}${cerrar}`;
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
