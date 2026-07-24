/**
 * Servicio: Generador de Unidad de Aprendizaje — formato MINERD
 */

import { resolverClave } from "../planning/areaAsignaturaMap.js";
import { getActividades } from "./bancoPedagogicoService.js";
import { combinarActividad } from "./combinadorActividadesService.js";
import { getCurricularContentForUnit, temasOficialesDeMalla, localizarPlaceholdersProhibidos } from "./bancoConocimientoService.js";
import { buildEspecificacionCurricular, generateWeekPlan, validarVozActividad, getFocoGramatical } from "./phaseAService.js";
import { resolverFocosCurriculares, obtenerPerfilPedagogicoArea } from "./curriculumBrainService.js";
import {
  distribuirTemasEnSemanas,
  obtenerTemaSemana,
  sugerirTemaOficial,
} from "./curriculumCombinacionService.js";

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
    "Inglés": "Aula ordinaria organizada en estaciones comunicativas (Listening Corner, Speaking Corner, Reading Corner y Writing Corner), ambientada con vocabulario visual, flashcards, carteles de estructuras, producciones del portafolio y recursos del contexto del estudiante. Se utilizan pizarra, cartulinas, imágenes impresas, audios cortos, videos modelo, proyector o TV cuando estén disponibles, manteniendo alternativas físicas para continuar la clase sin electricidad o internet. El hogar, la escuela y la comunidad sirven como contexto auténtico para escuchar, hablar, leer y escribir en inglés.",
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
    return `${quienes} En el aula, sin embargo, se observa que a muchos estudiantes les cuesta nombrar, describir y comparar en ${idioma} elementos cercanos de su vida diaria relacionados con "${tema}", aunque los reconocen en su hogar, la escuela y la comunidad. Esta dificultad limita su participación en conversaciones sencillas, descripciones orales, lecturas breves y producciones escritas sobre experiencias reales. Ante esta realidad, surge la necesidad auténtica de aprender a comunicarse sobre "${tema}" en ${idioma}, conectando el contenido con situaciones familiares, escolares y comunitarias. Mediante la estrategia de ${estrategia}, los estudiantes explorarán vocabulario, estructuras y funciones comunicativas del tema; escucharán modelos breves; practicarán diálogos, descripciones y producciones escritas; compararán sus experiencias con las de sus compañeros; y construirán evidencias progresivas en un portafolio. Como producto final, elaborarán de manera progresiva ${producto} Cada clase aportará una pieza concreta a ese producto, fortaleciendo su competencia comunicativa en ${idioma}, su autonomía, su responsabilidad personal y su capacidad de expresar su realidad con cortesía y claridad.`;
  }

  return `${quienes} En el aula, sin embargo, se observa que muchos estudiantes conocen "${tema}" desde la experiencia cotidiana, pero les resulta difícil explicarlo, representarlo y aplicarlo con las herramientas propias de ${area}. Ante esta realidad, surge la necesidad auténtica de comprender "${tema}" para interpretar situaciones del entorno y actuar sobre ellas. Mediante la estrategia de ${estrategia}, los estudiantes explorarán los conceptos centrales del tema, los aplicarán en situaciones concretas de su contexto y socializarán sus hallazgos con el grupo. Como producto final, elaborarán de manera progresiva ${producto} A lo largo de la unidad, cada clase aportará una evidencia a ese producto, fortaleciendo sus competencias, su autonomía y su compromiso con la realidad de su comunidad.`;
};

// Nota institucional de organización temporal (versión parametrizada del modelo)
const construirNotaInstitucional = ({ clasesPorSemana, durMin, producto, nivel = "" }) => `Conforme al enfoque de atención a la diversidad, evaluación formativa y aprendizaje centrado en el estudiante establecido en el Diseño Curricular del Nivel ${/primaria|primario/i.test(nivel) ? "Primario" : /inicial|kinder|preprimario/i.test(nivel) ? "Inicial" : "Secundario"} del MINERD, la presente unidad organiza su tiempo en torno a un núcleo esencial de ${clasesPorSemana} clase(s) semanal(es) de ${durMin} minutos, complementado por sesiones pedagógicas flexibles que fortalecen la calidad, la pertinencia y la equidad de los aprendizajes. Dichas sesiones no representan una sobreplanificación ni un error en la distribución temporal, sino una decisión metodológica intencional orientada a responder a la diversidad del aula.
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

const textoFuenteCurricular = (value) => {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  return [
    value.organismo || value.ministerio || value.entidad,
    value.documento || value.titulo || value.nombre,
    value.anio || value.year,
  ].map(textoPlano).filter(Boolean).join(" · ");
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

const normalizarClaveContenido = (texto = "") =>
  String(texto || "")
    .replace(/^\*\*(.*?)\*\*$/g, "$1")
    .replace(/^~~(.*?)~~$/g, "$1")
    .replace(/^(Vocabulario|Gram[aá]tica|Expresi[oó]n|Funcional|Discursivo):\s*/i, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const crearEstadoContenidosMalla = ({
  mallaPayload = {},
  contenidosActivos = {},
  temasActivos = [],
  contenidosTrabajadosAntes = {},
} = {}) => {
  const bloques = construirBloquesContenidoMalla(mallaPayload);
  const activosSet = new Set([
    ...textosUnicos(contenidosActivos.conceptuales || []),
    ...textosUnicos(contenidosActivos.procedimentales || []),
    ...textosUnicos(contenidosActivos.actitudinales || []),
    ...textosUnicos(contenidosActivos.vocabulario || []),
    ...textosUnicos(contenidosActivos.gramatica || []),
    ...textosUnicos(contenidosActivos.expresiones || []),
    ...textosUnicos(contenidosActivos.funcionales || []),
  ].map(normalizarClaveContenido).filter(Boolean));
  const previosSet = new Set([
    ...textosUnicos(contenidosTrabajadosAntes.conceptuales || []),
    ...textosUnicos(contenidosTrabajadosAntes.procedimentales || []),
    ...textosUnicos(contenidosTrabajadosAntes.actitudinales || []),
  ].map(normalizarClaveContenido).filter(Boolean));
  const marcar = (items = [], tipo = "") => textosUnicos(items).map((texto) => {
    const key = normalizarClaveContenido(texto);
    const estado = previosSet.has(key) ? "trabajadoAntes" : activosSet.has(key) ? "activo" : "disponible";
    return { tipo, texto, estado };
  });
  return {
    version: 1,
    fuente: "malla_curricular",
    temasActivos: textosUnicos(temasActivos),
    conceptuales: [
      ...marcar(bloques.vocabulario.map((v) => `Vocabulario: ${v}`), "vocabulario"),
      ...marcar(bloques.gramatica.map((g) => `Gramática: ${g}`), "gramatica"),
      ...marcar(bloques.frases.map((e) => `Expresión: ${e}`), "expresion"),
      ...marcar(bloques.conceptuales, "conceptual"),
    ],
    procedimentales: [
      ...marcar(bloques.procedimientosFuncionales.map((p) => `Funcional: ${p}`), "funcional"),
      ...marcar(bloques.procedimientosDiscursivos.map((p) => `Discursivo: ${p}`), "discursivo"),
    ],
    actitudinales: marcar(bloques.actitudesValores, "actitudinal"),
    reglaImpresion: "El PDF imprime solo los contenidos con estado activo; el resto queda como trazabilidad curricular.",
  };
};

const extraerEjemplos = (items = []) => toArray(items).flatMap((item) => {
  if (typeof item === "string") return [item];
  if (!item || typeof item !== "object") return [];
  if (Array.isArray(item.ejemplos)) return item.ejemplos;
  if (Array.isArray(item.items)) return item.items;
  return [textoPlano(item)].filter(Boolean);
});

const textosDeObjetoListas = (obj = {}) =>
  Object.values(obj || {}).flatMap((value) => toArray(value));

const tieneEtiquetaContenido = (texto = "") =>
  /^(Vocabulario|Gram[aá]tica|Expresi[oó]n|Funcional|Discursivo):\s*/i.test(String(texto || "").trim());

const etiquetarContenido = (tipo, texto) => {
  const limpio = textoPlano(texto);
  if (!limpio) return "";
  return tieneEtiquetaContenido(limpio) ? limpio : `${tipo}: ${limpio}`;
};

const construirBloquesContenidoMalla = (payload = {}) => {
  const conceptos = payload.contenidos?.conceptos || {};
  const procedimientos = payload.contenidos?.procedimientos || {};
  const generales = payload.contenidosGenerales || {};
  const estrategicos = procedimientos.estrategicos || {};
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
      ...toArray(procedimientos.sociolinguisticosYSocioculturales),
      ...toArray(payload.frases),
      ...toArray(payload.expresiones),
    ]),
    vocabulario: textosUnicos([
      ...extraerEjemplos(conceptos.vocabulario),
      ...extraerEjemplos(payload.vocabulario),
    ]),
    gramatica: textosUnicos([
      ...toArray(conceptos.gramatica).map((g) => typeof g === "object" ? g.estructura : g),
      ...toArray(conceptos.gramática).map((g) => typeof g === "object" ? g.estructura : g),
      ...toArray(payload.gramatica).map((g) => typeof g === "object" ? g.estructura : g),
      ...toArray(payload.gramática).map((g) => typeof g === "object" ? g.estructura : g),
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
      ...textosDeObjetoListas(estrategicos),
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
    fuente: textoFuenteCurricular(payload.fuente) || textoPlano(payload.ministerio) || "MINERD",
    versionCurriculo: textoPlano(payload.versionCurriculo || payload.version || payload.schemaVersion),
    nivelMCERL: textoPlano(payload.nivelMCERL || payload.nivelDominio),
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

  // ── Techo duro: la suma de las fases NUNCA puede exceder el total real de
  // horas de la unidad (numSemanas × horas/semana). El bug histórico: con 4
  // fases de mínimo 2h el piso sumaba 8h aunque el docente pidiera 6h (3 sem ×
  // 2h) → se generaba una SEMANA de más. La distribución se adapta al total.
  //
  // Cuando el total es corto no caben 4 fases con 2h cada una. Se decide el
  // número de fases por el presupuesto real y se reparte SIN pasarse:
  //   total ≤ 3  → 1 fase   (unidad mínima)
  //   total ≤ 5  → 2 fases  (activación + desarrollo/cierre)
  //   total ≤ 7  → 3 fases  (activación + desarrollo + integración)
  //   total ≥ 8  → 4 fases  (el diseño completo por pesos)
  const t = Math.max(1, Math.round(total));

  if (t <= 3) return [t];
  if (t <= 5) {
    // 2 fases: f1 corta (1), el resto al desarrollo
    const f1 = 1;
    return [f1, t - f1];
  }
  if (t <= 7) {
    // 3 fases sin exceder el total: f1=2, y reparte el resto entre f2 y f3
    const f1 = 2;
    const rem = t - f1;
    const f3 = Math.max(2, Math.round(rem * 0.45)); // integración/producto
    const f2 = Math.max(2, rem - f3);
    // Ajuste final para cuadrar EXACTO con el total
    const suma = f1 + f2 + f3;
    const diff = t - suma;
    return [f1, f2 + Math.max(0, diff), Math.max(1, f3 + Math.min(0, diff))];
  }

  // total ≥ 8 → diseño completo de 4 fases por pesos (comportamiento original)
  const f1 = 2;
  const rem = t - f1;
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

  // Nombres de fase adaptados al número real de fases: la PRIMERA siempre es
  // presentación/apropiación y la ÚLTIMA siempre integración/producto final,
  // sin importar cuántas fases haya (1 a 4). Con 4 se usan los 4 nombres
  // canónicos; con menos se colapsa manteniendo apertura y cierre coherentes.
  const nombreFase = (faseIdx, totalFases) => {
    if (totalFases === 1) return NOMBRES_FASES[0];
    if (faseIdx === 0) return NOMBRES_FASES[0];
    if (faseIdx === totalFases - 1) return NOMBRES_FASES[3]; // Integración y consolidación
    if (totalFases === 4) return NOMBRES_FASES[faseIdx];
    return NOMBRES_FASES[faseIdx === 1 ? 1 : 2]; // Desarrollo / Profundización
  };

  const fases = distribucion.map((numHoras, faseIdx) => ({
    numero: faseIdx + 1,
    nombre: nombreFase(faseIdx, distribucion.length),
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
  const lower   = _normTexto(tituloDocente);
  const sugerido = sugerirTemaOficial(tituloDocente, temas);
  if (sugerido?.tema) return sugerido.tema;
  let match = temas.find(t => _normTexto(getText(t)) === lower);
  if (!match) {
    match = temas.find(t => lower.includes(_normTexto(getText(t))) && getText(t))
         || temas.find(t => _normTexto(getText(t)).includes(lower) && lower.length > 3);
  }
  if (!match) {
    const words = lower.split(/\s+/).filter(w => w.length > 3);
    let bestScore = 0;
    for (const t of temas) {
      const score = words.filter(w => _normTexto(getText(t)).includes(w)).length;
      if (score > bestScore) { bestScore = score; match = t; }
    }
    if (bestScore === 0) match = null;
  }
  // Siempre devuelve el texto del tema (string), no el objeto
  return match ? getText(match) : null;
};

// Filtra ítems del corpus por tema (campo tema/topico) cuando el corpus
// segmenta; si ninguno coincide o no hay segmentación, devuelve todos.
// Filtra items por tema (tolerante: nunca deja vacío). Si los items llevan
// etiqueta de tema, devuelve los del tema; si no la llevan o ninguno casa,
// devuelve todos. La pertenencia real al tema se resuelve en la capa de marcado
// (negrita = del tema, tachado = ya trabajado), no descartando contenido aquí:
// el modelo LLAMA TODO el contenido del grado, como los 21 indicadores.
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
  const directo = contenidosPorTema.find((bloque) => {
    const tema = _normTexto(bloque?.tema || bloque?.conceptos?.temas?.[0]);
    return tema && (tema === objetivo || tema.includes(objetivo) || objetivo.includes(tema));
  });
  if (directo) return directo;

  const nombresBloques = contenidosPorTema
    .map((bloque) => bloque?.tema || bloque?.conceptos?.temas?.[0])
    .filter(Boolean);
  const sugerido = sugerirTemaOficial(temaFiltro, nombresBloques);
  if (sugerido?.tema) {
    const temaSugerido = _normTexto(sugerido.tema);
    return contenidosPorTema.find((bloque) => {
      const tema = _normTexto(bloque?.tema || bloque?.conceptos?.temas?.[0]);
      return tema && tema === temaSugerido;
    }) || null;
  }
  return null;
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
    const vocabulario = textosUnicos(extraerEjemplos(conceptos.vocabulario || []));
    // Detalle con ejemplos oficiales: el documento modelo imprime cada
    // estructura con sus ejemplos en cursiva ("Presente simple... (I wake up
    // at 6:00 a.m.)"). El corpus los trae en g.ejemplos y antes se descartaban.
    const gramaticaDetalle = toArray(conceptos.gramatica || conceptos.gramática)
      .map((g) => (g && typeof g === "object"
        ? { estructura: String(g.estructura || "").trim(), ejemplos: textosUnicos(toArray(g.ejemplos).map(String)) }
        : { estructura: String(g || "").trim(), ejemplos: [] }))
      .filter((g) => g.estructura);
    const gramatica = textosUnicos(gramaticaDetalle.map((g) => g.estructura));
    const expresiones = textosUnicos([
      ...extraerEjemplos(conceptos.frases || []),
      ...extraerEjemplos(conceptos.expresiones || []),
      ...(conceptos.sociolinguisticos || []),
      ...(procedimientos.sociolinguisticosYSocioculturales || []),
    ]);
    // Procedimentales del modelo MINERD: subdivididos en FUNCIONALES (lo que el
    // estudiante hace comunicativamente) y DISCURSIVOS (comprensión y producción
    // de textos). Se etiquetan por tipo para que el render los muestre separados
    // como las págs. 5-7 del modelo, en vez de una lista plana mezclada.
    const _func = textosUnicos(procedimientos.funcionales || []);
    const _disc = textosUnicos([
      ...(procedimientos.discursivos || []),
      ...(procedimientos.comprensionOralEscrita || []),
      ...(procedimientos.produccionOral || []),
      ...(procedimientos.produccionEscrita || []),
      ...textosDeObjetoListas(procedimientos.estrategicos || {}),
    ]);
    const _otros = textosUnicos(procedimientos.items || []);
    const funcionales = textosUnicos([
      ..._func.map((f) => etiquetarContenido("Funcional", f)),
      ..._disc.map((d) => etiquetarContenido("Discursivo", d)),
      ..._otros,
    ]);
    const actitudinales = textosUnicos([
      ...(bloqueTema.actitudinales || []),
      ...(bloqueTema.actitudesValores || []),
    ]);
    // Evidencias de aprendizaje del tema (4ta columna del documento modelo)
    const evidenciasAprendizaje = textosUnicos([
      ...toArray(bloqueTema.evidencias).map(String),
      ...toArray(bloqueTema.evidenciasAprendizaje).map(String),
      ...toArray(bloqueTema.evidenciasEsperadas).map(String),
    ].map((t) => t.trim()).filter(Boolean));
    const conceptuales = textosUnicos([
      ...vocabulario,
      ...gramatica,
      ...expresiones,
    ]);
    return {
      vocabulario,
      gramatica,
      gramaticaDetalle,
      expresiones,
      funcionales,
      actitudinales,
      evidenciasAprendizaje,
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
  // Se llama TODO el contenido del grado (como el modelo llama los 21
  // indicadores): el generador luego marca cuál pertenece a ESTE tema (negrita)
  // y el histórico marca lo ya trabajado (tachado). Por eso el filtro es
  // TOLERANTE: nunca deja vacío; la pertenencia al tema se resuelve en la capa
  // de marcado, no descartando contenido aquí.
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
  expresiones = textosUnicos([
    ...expresiones,
    ...(Array.isArray(p.sociolinguisticosYSocioculturales) ? p.sociolinguisticosYSocioculturales : []),
  ]);
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
  funcionales = textosUnicos([
    ...funcionales.map((item) => etiquetarContenido("Funcional", item)),
    ...textosDeObjetoListas(p.estrategicos || {}).map((item) => etiquetarContenido("Discursivo", item)),
  ]);

  // v1.1 fallback: per-tema arrays (vocabulario/gramatica/funcionales at temas[i]
  // level). Prefiere el bloque del tema que CORRESPONDE al temaFiltro; si no lo
  // encuentra, cae al primer tema (legado) — se llama todo el contenido y la
  // pertenencia se resuelve en la capa de marcado (negrita/tachado).
  if (!vocabulario.length && Array.isArray(mallaPayload.temas)) {
    const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    const objetivo = norm(temaFiltro);
    const delTema = objetivo && mallaPayload.temas.find((t) => {
      if (!t || typeof t !== 'object') return false;
      const nombre = norm(t.tema || t.temaOficial || t.topico);
      return nombre === objetivo || nombre.includes(objetivo) || objetivo.includes(nombre);
    });
    const temaObj = delTema || mallaPayload.temas.find((t) => typeof t === 'object' && t !== null);
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

const _unirContenidosTema = (contenidos = []) => {
  const unir = (campo) => textosUnicos(contenidos.flatMap((c) => c?.[campo] || []));
  const temas = textosUnicos(contenidos.map((c) => c?.temaContenido).filter(Boolean));
  return {
    vocabulario: unir("vocabulario"),
    gramatica: unir("gramatica"),
    expresiones: unir("expresiones"),
    funcionales: unir("funcionales"),
    actitudinales: unir("actitudinales"),
    conceptuales: unir("conceptuales"),
    procedimentales: unir("procedimentales"),
    fuenteContenido: contenidos.every((c) => c?.fuenteContenido === "contenidosPorTema")
      ? "contenidosPorTema"
      : "contenidosPorTema_multiple",
    temaContenido: temas.join(" · "),
    temasContenido: temas,
    contenidosPorTemaResueltos: contenidos,
  };
};

const _resolverTemaOficialSeguro = (tema, temasOficiales = []) =>
  _resolverTemaMalla(tema, temasOficiales) || String(tema || "").trim();

const construirRutaCurricularUnidad = ({
  titulo,
  temaBase,
  temasSeleccionados = [],
  temasOficiales = [],
  numSemanas = 1,
}) => {
  const base = _resolverTemaOficialSeguro(temaBase || titulo, temasOficiales);
  const seleccion = Array.isArray(temasSeleccionados) && temasSeleccionados.length
    ? temasSeleccionados
    : [base];
  const temas = textosUnicos(
    seleccion
      .map((tema) => _resolverTemaOficialSeguro(tema, temasOficiales))
      .filter(Boolean)
  );
  const temasFinales = temas.length ? temas : [base].filter(Boolean);
  const distribucion = distribuirTemasEnSemanas(temasFinales, Math.max(1, Number(numSemanas) || 1))
    .map((bloque, index) => ({
      ...bloque,
      orden: index + 1,
      proposito: index === 0
        ? "Apropiación, exploración inicial y vocabulario/conceptos base"
        : index === temasFinales.length - 1
          ? "Integración, aplicación y aporte al producto final"
          : "Desarrollo y profundización del tema curricular asignado",
    }));
  return {
    version: 1,
    temaBase: base,
    temas: temasFinales,
    esCombinada: temasFinales.length > 1,
    distribucion,
  };
};

const _temasDeSemanas = (rutaCurricular, semanas = []) => {
  const set = new Set();
  semanas.forEach((semana) => {
    const tema = obtenerTemaSemana(Number(semana), rutaCurricular?.distribucion);
    if (tema) set.add(tema);
  });
  return [...set];
};

const _esLenguasExtranjeras = (mallaPayload = {}) => {
  const texto = _normTexto([
    mallaPayload.area,
    mallaPayload.subject,
    mallaPayload.asignatura,
    mallaPayload.metadata?.area,
    mallaPayload.metadata?.asignatura,
  ].filter(Boolean).join(" "));
  return /lenguas extranjeras|ingles|frances|ingl[eé]s|franc[eé]s/.test(texto);
};

const _textoContenidoParaAfinidad = (contenido = {}) =>
  textosUnicos([
    ...(contenido.vocabulario || []),
    ...(contenido.gramatica || []),
    ...(contenido.expresiones || []),
    ...(contenido.funcionales || []),
    ...(contenido.conceptuales || []),
  ]).join(" ");

const _temaContenidoCoincide = (contenido = {}, tema = "") => {
  const actual = _normTexto(contenido.temaContenido || contenido.temaOficial || "");
  const esperado = _normTexto(tema);
  return Boolean(actual && esperado && (actual === esperado || actual.includes(esperado) || esperado.includes(actual)));
};

const _validarAfinidadContenidoTema = ({ mallaPayload, tema, contenido }) => {
  // Guard estructural para Lenguas Extranjeras: el currículo oficial puede
  // trabajar un tema con gramática, funciones y expresión sociocultural aunque
  // no traiga vocabulario explícito. Por eso primero validamos que el bloque
  // contenidosPorTema corresponda al tema oficial y que tenga contenido real.
  // Solo usamos el asesor léxico como respaldo cuando no hay correspondencia
  // estructural clara.
  if (!_esLenguasExtranjeras(mallaPayload)) return;
  const textoContenido = _textoContenidoParaAfinidad(contenido);
  if (textoContenido.length < 20) return;
  if (contenido?.fuenteContenido === "contenidosPorTema" && _temaContenidoCoincide(contenido, tema)) return;
  const senal = sugerirTemaOficial(textoContenido, [tema]);
  if (senal?.tema && _normTexto(senal.tema) === _normTexto(tema)) return;
  const muestras = textosUnicos([
    ...(contenido.vocabulario || []),
    ...(contenido.gramatica || []),
    ...(contenido.expresiones || []),
    ...(contenido.funcionales || []),
    ...(contenido.conceptuales || []),
  ]).slice(0, 6).join(", ");
  throw new Error(
    `El bloque contenidosPorTema de "${tema}" existe, pero sus contenidos no parecen pertenecer a ese tema. ` +
    `Ejemplos detectados: ${muestras || "sin contenido curricular claro"}. ` +
    `DocenteOS canceló la generación para evitar una planificación contaminada. Corrige ese bloque en Potente IA/Banco de Conocimiento.`
  );
};

const _resolverContenidoTemaEstricto = ({ mallaPayload, curricularDoc, tema }) => {
  const temaEnriquecido = resolverTemaEnriquecido(curricularDoc?.enriquecimientoTema, tema);
  const contenido = _extraerContenidosMallaCorpus(mallaPayload, tema, temaEnriquecido);
  if (!temaEnriquecido && contenido.fuenteContenido !== "contenidosPorTema") {
    throw new Error(
      `La malla no tiene contenidosPorTema confiables para "${tema}". ` +
      `DocenteOS canceló la generación para evitar mezclar contenidos globales del grado. ` +
      `Corrige el JSON en Administración → Potente IA/Banco de Conocimiento.`
    );
  }
  _validarAfinidadContenidoTema({ mallaPayload, tema, contenido });
  return {
    ...contenido,
    temaContenido: contenido.temaContenido || tema,
    temaOficial: tema,
    enriquecido: Boolean(temaEnriquecido),
  };
};

const _construirContenidosPorRuta = ({ mallaPayload, curricularDoc, rutaCurricular }) => {
  const porTema = new Map();
  for (const tema of rutaCurricular?.temas || []) {
    porTema.set(tema, _resolverContenidoTemaEstricto({ mallaPayload, curricularDoc, tema }));
  }
  const todos = [...porTema.values()];
  return {
    porTema,
    union: _unirContenidosTema(todos),
  };
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

  // Numeración GLOBAL corrida (IL-1…IL-21) — el registro OFICIAL del MINERD
  // numera los indicadores de forma consecutiva a lo largo de TODAS las
  // competencias, sin reiniciar en cada una (Comunicativa: IL-1/2/3,
  // Pensamiento: IL-4/5/6…). La malla NO es la fuente de esta numeración: aunque
  // traiga IL-1/2/3 REPETIDO por competencia (error común de conversión), aquí
  // se RENUMERA SIEMPRE corrido por posición global. El código propio de la
  // malla que se conserva es SOLO el de indicadores no-IL genuinamente únicos
  // (ver más abajo): un "IL-N" repetido se descarta y se reemplaza por el
  // corrido, para coincidir con el registro oficial.
  let contadorGlobal = 0;
  // Detecta si los códigos son del tipo "IL-N" (registro), que deben renumerarse
  // corridos, vs. códigos oficiales únicos de otra naturaleza que se respetan.
  const esCodigoRegistroIL = (cod) => /^il[-\s]?\d+$/i.test(String(cod || "").trim());
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
    const indicadores = fuente.map(aIndicador).filter((ind) => ind.descripcion)
      .map((ind) => {
        contadorGlobal += 1;
        // Si el código es un "IL-N" del registro (repetido por competencia) o no
        // hay código, se RENUMERA corrido con el contador global. Solo se respeta
        // un código propio de otra naturaleza (único, no del patrón IL-N).
        const codigoCorrido = `IL-${contadorGlobal}`;
        const conservarCodigo = ind.codigo && !esCodigoRegistroIL(ind.codigo);
        return { ...ind, codigo: conservarCodigo ? ind.codigo : codigoCorrido };
      });
    return {
      // Código oficial de la competencia específica (ej. CE-LEI-1 / ING-1-C01)
      codigo: compId,
      competenciaFundamental: compFund || compFundEf[i] || compFundEf[i % compFundEf.length] || "",
      especifica: comp.especificaGrado || comp.especifica || comp.descripcion || "",
      // El formatter acepta también strings (unidades guardadas antes)
      indicadores,
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
// Llama generarFases() para obtener estructura + calendario, luego intenta
// enriquecer cada bloque con IA. Si el proveedor falla, se entrega una base
// curricular determinística construida desde la malla oficial; no es plantilla
// genérica ni inventa contenidos fuera del banco.

const _generarFasesConIA = async (
  numSemanas, schedule, area, tema, estrategia, productoFinal,
  contexto, mallaContenidos,
  mallaPayload, allInds, allComps, durMin, grado,
  rutaCurricular = null,
  contenidosRuta = null,
  onProgress = null,
) => {
  const fases = generarFases(numSemanas, schedule, area, tema, estrategia, productoFinal, contexto, mallaContenidos);

  const specBase = buildEspecificacionCurricular({
    mallaPayload, titulo: tema, allInds, allComps, mallaContenidos, area, grado,
    producto: productoFinal,
    contextoComunitario: contexto.contextoComunitario || "",
  });
  specBase.rutaCurricular = rutaCurricular || null;
  specBase.temasActivos = rutaCurricular?.temas || [tema].filter(Boolean);
  // Producto escrito por el docente = nombre fijado; la IA no propone otro
  if (contexto.productoPropio) specBase.productoFinalNombre = contexto.productoPropio;

  const memoriaAcumulada = [];
  const advertenciasIA = [];
  const totalClases = fases.reduce((sum, f) => sum + f.dias.length, 0);
  let globalOffset = 0;
  let productoFinalNombreActual = specBase.productoFinalNombre || "";

  // Naturaleza del área (documento oficial MINERD, págs. 9-10): solo Lenguas
  // Extranjeras progresa por estructura gramatical y usa el molde comunicativo
  // (Listen and X, Speaking Circle…). Las demás áreas construyen sus actividades
  // desde SU secuencia disciplinar (PERFIL_AREA): Matemática=problema→procedimiento
  // →verificación, Ciencias=observación→hipótesis→experimento, etc.
  const esIdiomaArea = ES_IDIOMA(area) || Boolean(specBase.esIdioma);
  const perfilAreaUnidad = obtenerPerfilPedagogicoArea(area, contexto.asignatura || area);

  // ─── Banco Pedagógico: actividades con mecánica real (Frequency Walk,
  // Interview Stations, Gallery Walk…) validadas por el dueño contra su modelo.
  // Se lee UNA sola vez por unidad (cero créditos de IA) y se indexa en memoria
  // para que construirActividadesDia lo consulte sincrónicamente antes de caer
  // al molde determinista. Si el banco está vacío o falla, la unidad se genera
  // igual con el molde — el banco solo eleva la calidad, nunca la bloquea.
  let bancoActividadesArea = [];
  try {
    const [oficiales, aprobadas] = await Promise.all([
      getActividades({ area, estado: "official", momento: "Desarrollo" }),
      getActividades({ area, estado: "approved", momento: "Desarrollo" }),
    ]);
    // Prioriza official; completa con approved. Solo actividades con
    // instrucciones reales (mecánica), no fichas vacías.
    bancoActividadesArea = [...oficiales, ...aprobadas].filter(
      (a) => Array.isArray(a?.instrucciones) && a.instrucciones.filter((x) => String(x || "").trim()).length > 0
    );
  } catch {
    bancoActividadesArea = [];
  }

  // Acumulador de actividades que el COMBINADOR crea sin IA (mecánica probada +
  // estructura del día). Se recogen aquí para cosecharlas como `cosechada` tras
  // generar la unidad — el banco crece con su propio material (visión del dueño).
  // Dedup por título dentro de la unidad: una misma combinación no se repite.
  const combinacionesCreadas = [];
  const _combinadasVistas = new Set();

  fases.forEach((fase) => {
    fase.dias.forEach((dia) => {
      const temaSemana = obtenerTemaSemana(Number(dia.semana || 1), rutaCurricular?.distribucion);
      if (temaSemana) dia.temaCurricular = temaSemana;
    });
  });

  const tomarVentana = (items = [], indice = 0, cantidad = 2) => {
    const lista = (items || []).map((x) => String(x || "").trim()).filter(Boolean);
    if (!lista.length) return [];
    const start = (Math.max(indice, 0) * cantidad) % lista.length;
    return Array.from({ length: Math.min(cantidad, lista.length) }, (_, i) => lista[(start + i) % lista.length]);
  };

  // Recorte HONESTO: corta en límite de palabra y sin separadores colgando.
  // El corte a media palabra ("eva…", "Presen…") delataba texto de máquina
  // en títulos e intenciones del documento del docente (Roadmap 6 · G1).
  const recortar = (texto = "", max = 82) => {
    const limpio = String(texto || "").replace(/\s+/g, " ").trim();
    if (limpio.length <= max) return limpio;
    const corte = limpio.slice(0, max - 1);
    const espacio = corte.lastIndexOf(" ");
    const base = espacio > max * 0.6 ? corte.slice(0, espacio) : corte;
    return `${base.replace(/[\s·:;,.\-–—(]+$/, "")}…`;
  };

  // Los contenidos de la malla llegan con su etiqueta de columna
  // ("Gramática: X", "Funcional: Y"); al citarlos en prosa la etiqueta sobra.
  const limpiarEtiquetaContenido = (texto = "") =>
    String(texto || "").replace(/^\s*(gram[aá]tica|funcional|discursivo|expresi[oó]n|conceptual|procedimental|actitudinal)\s*:\s*/i, "").trim();

  const normalizarClaveDidactica = (texto = "") =>
    String(texto || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const esFocoInternoUnidad = (texto = "") =>
    /apropiacion de la unidad|situacion de aprendizaje|producto|evaluacion|criterios/.test(normalizarClaveDidactica(texto));

  // ─── G3b/G3c — motor de progresión y catálogo de actividades del modelo ────
  // El documento de referencia del dueño ("My Life and Daily Routines") avanza
  // UNA estructura protagonista por día, con una actividad nombrada distinta
  // cada clase (Listen and X + misión + producción + socialización) y una
  // pieza del producto ÚNICA derivada de esa estructura. Nada de rotar las
  // mismas 4 piezas ni repetir el mismo bloque gramatical 4 días seguidos.

  const resolverProtagonistaDia = ({ specActual = specBase, fase, indiceEnFase = 0, indiceGlobal = 0 }) => {
    const limpiar = (t) => limpiarEtiquetaContenido(String(t || "").trim());
    const gramaticaAll = textosUnicos((specActual.contenidosClaves?.gramatica || []).map(limpiar)).filter(Boolean);
    const expresionesAll = textosUnicos((specActual.contenidosClaves?.expresiones || []).map(limpiar)).filter(Boolean);
    const faseNum = fase?.numero || 1;
    const diasFase1 = fases?.[0]?.dias?.length || 0;

    // ÁREAS NO-IDIOMA: el protagonista del día es un PROCEDIMIENTO o CONCEPTO del
    // área (documento oficial pág. 21), no una estructura gramatical ni una
    // "expresión" de idioma. Avanza uno por día global sobre los contenidos.
    if (!esIdiomaArea) {
      const procedimientos = textosUnicos((specActual.contenidosClaves?.funcionales || []).map(limpiar)).filter(Boolean);
      const conceptos = textosUnicos((specActual.contenidosClaves?.vocabulario || []).map(limpiar)).filter(Boolean);
      const banco = procedimientos.length ? procedimientos : conceptos;
      if (banco.length) {
        const idx = faseNum === 1 ? indiceEnFase : Math.max(indiceGlobal - diasFase1, 0);
        const nuevo = idx < banco.length;
        return {
          texto: banco[idx % banco.length],
          etiqueta: procedimientos.length ? "Procedimiento" : "Concepto clave",
          tipo: faseNum === 1 ? "apropiacion" : (faseNum >= 4 ? "integracion" : (nuevo ? "contenido" : "reaplicacion")),
          esNueva: faseNum >= 2 && faseNum < 4 && nuevo,
        };
      }
      return { texto: "el contenido central del tema", etiqueta: "Foco", tipo: "contenido", esNueva: faseNum >= 2 };
    }

    if (faseNum === 1) {
      // Semana de apropiación: sin estructura nueva (como el modelo) — el foco
      // son las expresiones sociales de arranque y la comprensión de la unidad.
      const expresion = expresionesAll.length ? expresionesAll[indiceEnFase % expresionesAll.length] : "";
      return {
        texto: expresion || "presentación de la unidad y saberes previos",
        etiqueta: "Expresión",
        tipo: "apropiacion",
        esNueva: false,
      };
    }

    if (!gramaticaAll.length) {
      const expresion = expresionesAll.length ? expresionesAll[indiceGlobal % expresionesAll.length] : "";
      return { texto: expresion || "el contenido central del tema", etiqueta: "Foco", tipo: "contenido", esNueva: true };
    }

    const indiceContenido = Math.max(indiceGlobal - diasFase1, 0);
    if (faseNum >= 4) {
      // Fase final: integración de estructuras ya vistas rumbo al producto.
      const a = gramaticaAll[indiceContenido % gramaticaAll.length];
      const b = gramaticaAll[(indiceContenido + 1) % gramaticaAll.length];
      return {
        texto: b && b !== a ? `${a} · ${b}` : a,
        etiqueta: "Integración",
        tipo: "integracion",
        esNueva: false,
      };
    }
    if (indiceContenido < gramaticaAll.length) {
      // Progresión: a cada día de contenido le toca UNA estructura nueva.
      return { texto: gramaticaAll[indiceContenido], etiqueta: "Estructura gramatical", tipo: "estructura", esNueva: true };
    }
    // Más días que estructuras: se reaplica una estructura vista a vocabulario
    // nuevo (el modelo hace esto en sus últimas semanas) — nunca se estanca.
    return {
      texto: gramaticaAll[indiceContenido % gramaticaAll.length],
      etiqueta: "Estructura gramatical",
      tipo: "reaplicacion",
      esNueva: false,
    };
  };

  // Pieza del producto derivada de la estructura del día — la agenda nace del
  // día de horas, el párrafo del día de conectores, la entrevista del día de
  // preguntas… (Anexo H del modelo: cada semana aporta piezas distintas).
  const piezaDelDia = ({ protagonista, perfilDia, temaCorto, esUltimoDeSemana = false, faseNum = 2, indiceEnFase = 0 }) => {
    if (faseNum === 1) {
      return perfilDia.posicion === "inicio" || perfilDia.posicion === "unico"
        ? "mapa inicial de ideas sobre la unidad"
        : "plan inicial del producto (Entrada 0 del portafolio)";
    }
    if (faseNum >= 4) {
      if (perfilDia.posicion === "inicio") return "plan de organización de las evidencias del producto";
      if (perfilDia.posicion === "cierre") return "presentación final del producto y ficha de autoevaluación";
      // Días intermedios de la fase final: piezas DISTINTAS por día para no
      // duplicar filas en el Anexo H (el ensayo del producto tiene etapas: se
      // redacta primero, se ensaya con retroalimentación después).
      return indiceEnFase <= 1
        ? "guion de presentación redactado del producto"
        : "guion de presentación ensayado con retroalimentación";
    }
    if (esUltimoDeSemana) return `avance integrado del producto con las piezas de la semana sobre ${temaCorto}`;

    // ÁREAS NO-IDIOMA: la pieza del día es propia de la naturaleza del área,
    // no un diálogo/entrevista de idioma. Rota por indiceEnFase para no repetir.
    if (!esIdiomaArea) {
      const naturaleza = clasificarNaturalezaArea();
      const piezasPorArea = {
        matematica: [`procedimiento resuelto y verificado sobre ${temaCorto}`, `situación-problema resuelta con su representación sobre ${temaCorto}`, `comparación de estrategias de solución sobre ${temaCorto}`],
        ciencias_naturales: [`registro de observación y datos sobre ${temaCorto}`, `explicación con evidencias sobre ${temaCorto}`, `informe breve de indagación sobre ${temaCorto}`],
        ciencias_sociales: [`análisis de fuentes sobre ${temaCorto}`, `organizador de causas y consecuencias sobre ${temaCorto}`, `argumento ciudadano fundamentado sobre ${temaCorto}`],
        lengua_espanola: [`borrador revisado de texto sobre ${temaCorto}`, `análisis del texto modelo sobre ${temaCorto}`, `producción textual mejorada sobre ${temaCorto}`],
        artistica: [`pieza en proceso sobre ${temaCorto}`, `bitácora creativa sobre ${temaCorto}`, `producción artística sobre ${temaCorto}`],
        educacion_fisica: [`registro de ejecución motriz sobre ${temaCorto}`, `reto motor cooperativo sobre ${temaCorto}`, `reflexión de salud y desempeño sobre ${temaCorto}`],
        formacion_humana: [`reflexión escrita sobre ${temaCorto}`, `diálogo argumentado sobre ${temaCorto}`, `compromiso personal o comunitario sobre ${temaCorto}`],
        generica: [`producción del proceso sobre ${temaCorto}`, `evidencia de aplicación sobre ${temaCorto}`, `avance del producto sobre ${temaCorto}`],
      };
      const lista = piezasPorArea[naturaleza] || piezasPorArea.generica;
      return lista[Math.max(indiceEnFase, 0) % lista.length];
    }

    const t = normalizarClaveDidactica(protagonista?.texto || "");
    if (/conector|secuencia|first|then|finally/.test(t)) return `párrafo secuenciado sobre ${temaCorto}`;
    // Adverbios de TIEMPO (now, in the past, yet, already, still) ≠ adverbios de
    // FRECUENCIA (always, usually, never). Van ANTES para que "adverbio" no caiga
    // por error en la rama de frecuencia y el producto contradiga la estructura.
    if (/tiempo|now|in the past|\byet\b|already|still|adverbio de tiempo|time adverb/.test(t)) return `oraciones con adverbios de tiempo sobre ${temaCorto}`;
    if (/frecuencia|frequency|always|usually|often|sometimes|never/.test(t)) return `lista de hábitos con adverbios de frecuencia sobre ${temaCorto}`;
    if (/wh|question|pregunta|interrogativ/.test(t)) return `entrevista escrita con preguntas y respuestas sobre ${temaCorto}`;
    if (/hora|time|horario|reloj|fecha/.test(t)) return `agenda personal con horas sobre ${temaCorto}`;
    if (/tercera persona|posesiv|his|her|mine|yours/.test(t)) return `descripción de otra persona sobre ${temaCorto}`;
    if (/should|sugerencia|consejo|imperativ|recomendaci|why don/.test(t)) return `lista de recomendaciones sobre ${temaCorto}`;
    if (/pasado|was|were|narrar|experiencia/.test(t)) return `narración breve de una experiencia sobre ${temaCorto}`;
    if (/comparaci|contraste|but/.test(t)) return `cuadro comparativo sobre ${temaCorto}`;
    if (/want|hope|wish|deseo|interes/.test(t)) return `lista de deseos y planes sobre ${temaCorto}`;
    if (/cortesia|saludo|greeting|atencion|disculp|interrump|palabra|repitan/.test(t)) return `mini diálogo con expresiones de cortesía sobre ${temaCorto}`;
    if (/\bcan\b|\bmay\b|\bcould\b|permiso|permission|modal/.test(t)) return `diálogo de peticiones y permisos sobre ${temaCorto}`;
    if (/pronombre objeto|object pronoun|\bme\b|\bhim\b|\bthem\b/.test(t)) return `diálogo con pronombres objeto sobre ${temaCorto}`;
    if (/presente simple|conversacion|sostener/.test(t)) return `oraciones propias en contexto sobre ${temaCorto}`;
    // Fallback nombrado por estructura: días que reaplican estructuras distintas
    // producen piezas distintas (evita filas idénticas en el Anexo H).
    const estructuraCorta = String(protagonista?.texto || "").split(/[·(]/)[0].trim();
    return estructuraCorta
      ? `producción escrita con ${estructuraCorta} sobre ${temaCorto}`
      : `ficha aplicada sobre ${temaCorto}`;
  };

  // Catálogo de "Listening con propósito" — la variante cambia cada día.
  const LISTENING_VARIANTES = [
    { nombre: "Listen and Act", consigna: "representan con mímica o gestos lo que reconocen al escuchar" },
    { nombre: "Listen and Decide", consigna: "deciden si las oraciones son verdaderas o falsas según lo escuchado" },
    { nombre: "Listen and Solve", consigna: "resuelven una ficha-problema con la información escuchada" },
    { nombre: "Listen and Compare", consigna: "comparan lo escuchado con su propia experiencia marcando semejanzas y diferencias" },
    { nombre: "Listen and Organize", consigna: "ordenan tarjetas o imágenes según la secuencia que escuchan" },
    { nombre: "Listen and Complete", consigna: "completan un texto-hueco con las palabras y estructuras que faltan" },
    { nombre: "Listen and Choose", consigna: "eligen la opción que corresponde a cada situación escuchada" },
  ];

  // Catálogo de interacción comunicativa — rota para que cada clase tenga una
  // mecánica distinta (juego de roles, entrevista, information gap, estaciones…).
  // Todas inician con VERBO en tercera plural (regla de voz R1); el nombre de
  // la técnica va entre paréntesis, como el documento modelo.
  const INTERACCION_VARIANTES = [
    ({ funcion }) => `Representan en parejas (juego de roles) una situación real para ${funcion}, alternando los roles.`,
    ({ estructura }) => `Entrevistan a un compañero preguntando y respondiendo con ${estructura}, y registran dos respuestas completas.`,
    ({ temaSemana }) => `Completan una actividad de información incompleta (Information Gap): cada estudiante tiene la mitad de la información sobre ${temaSemana} y la obtiene preguntando, sin mostrar su hoja.`,
    ({ estructura }) => `Rotan por estaciones de trabajo en pequeños grupos, practicando ${estructura} con una tarea corta distinta en cada estación.`,
    ({ temaSemana }) => `Participan en un Speaking Circle: en círculo, cada estudiante aporta una oración sobre ${temaSemana} sin repetir la del compañero anterior.`,
    ({ funcion }) => `Preparan en equipos (misión colaborativa) un intercambio breve para ${funcion}, con un papel para cada miembro, y lo presentan al grupo.`,
  ];

  // MECÁNICA LIGADA A LA ESTRUCTURA (lógica de DocenteOS, no datos a mano):
  // cada estructura gramatical tiene una actividad comunicativa NATURAL. En vez
  // de rotar a ciegas (indiceGlobal % N), se elige por la estructura del día —
  // igual que piezaDelDia deriva el PRODUCTO. Así la mecánica prepara el
  // producto y no sale genérica ("estaciones" para WH-questions). Sirve para
  // CUALQUIER tema, porque depende de la estructura, no del tema. Si la
  // estructura no matchea aquí, cae a INTERACCION_VARIANTES (nunca peor que hoy).
  // ORDEN IMPORTA: las reglas específicas van ANTES que las amplias. Ej. "Why
  // don't/Why not" contiene "wh" y matchearía WH-questions; por eso sugerencias
  // va primero. Igual adverbios de tiempo antes que frecuencia (ambos "adverbio").
  const MECANICA_POR_ESTRUCTURA = [
    { re: /why don|why not|sugerencia|consejo|should|recomendaci/, fn: () => `En parejas intercambian consejos (Advice Swap): uno plantea una dificultad y el otro sugiere una solución; anotan las mejores sugerencias.` },
    { re: /\bcan\b|\bmay\b|\bcould\b|permiso|permission|modal/, fn: () => `Representan en parejas un juego de roles de peticiones y permisos, uno pide y el otro concede o niega con cortesía, alternando los roles.` },
    { re: /conector|causalidad|because|so\b|then|secuencia|first|finally/, fn: ({ estructura }) => `Explican en cadena, por turnos: cada estudiante conecta su idea con la del compañero anterior usando ${estructura} (causa y consecuencia).` },
    { re: /adverbio de tiempo|now|in the past|\byet\b|already|still/, fn: ({ estructura }) => `Comparan "antes y ahora" en parejas: se preguntan qué hacían antes y qué hacen ahora usando ${estructura}, y marcan las diferencias.` },
    { re: /frecuencia|frequency|always|usually|often|sometimes|never/, fn: () => `Recorren el aula (Find Someone Who): buscan compañeros que hagan ciertas acciones y anotan con qué frecuencia las realizan.` },
    { re: /comparaci|contraste|but\b|however/, fn: ({ temaSemana }) => `En parejas comparan sus experiencias sobre ${temaSemana} y completan un cuadro de semejanzas y diferencias.` },
    { re: /pasado|was|were|narrar|experiencia/, fn: () => `Narran por turnos una experiencia breve al compañero, que hace dos preguntas de seguimiento antes de intercambiar roles.` },
    { re: /interrogativ|question|\bwhat\b|\bwho\b|\bhow\b|\bwhen\b|\bwhere\b/, fn: ({ estructura }) => `Realizan una entrevista en parejas: uno pregunta con ${estructura} sobre el tema y registra las respuestas del otro; luego intercambian los roles.` },
    { re: /presente simple|conversacion|sostener/, fn: ({ temaSemana }) => `Completan una actividad de información incompleta (Information Gap): cada estudiante tiene la mitad de la información sobre ${temaSemana} y la obtiene preguntando, sin mostrar su hoja.` },
  ];
  const resolverMecanica = ({ estructura, funcion, temaSemana, indiceGlobal }) => {
    const clave = normalizarClaveDidactica(estructura || "");
    const match = MECANICA_POR_ESTRUCTURA.find((m) => m.re.test(clave));
    if (match) return match.fn({ estructura, funcion, temaSemana });
    // Fallback: rotación genérica (comportamiento previo, nunca peor).
    return INTERACCION_VARIANTES[indiceGlobal % INTERACCION_VARIANTES.length]({ funcion, estructura, temaSemana });
  };

  // ── Actividades para ÁREAS NO-IDIOMA ──────────────────────────────────────
  // Cada área construye el Desarrollo según SU naturaleza disciplinar (documento
  // oficial págs. 9-10). Los verbos y mecánicas son propios del área: Matemática
  // razona y verifica, Ciencias indaga y experimenta, Sociales analiza fuentes y
  // argumenta, etc. Nada de "Listen and X" ni "pronunciación". La MISMA brújula
  // orienta el camino LLM (data/naturalezaAreasMINERD.js → phaseAService); aquí
  // se materializa en el fallback determinístico con actividades ya redactadas.
  const clasificarNaturalezaArea = () => {
    const a = normalizarClaveDidactica(`${area} ${contexto.asignatura || ""}`);
    if (/matematica|matematicas/.test(a)) return "matematica";
    if (/naturaleza|biolog|quimic|fisica|ciencias de la/.test(a)) return "ciencias_naturales";
    if (/sociales|historia|geograf|ciudadan/.test(a)) return "ciencias_sociales";
    if (/lengua espanola|espanol|lengua materna/.test(a)) return "lengua_espanola";
    if (/artistica|arte|musica|plastica|teatro|danza/.test(a)) return "artistica";
    if (/fisica.*educacion|educacion fisica|deporte/.test(a)) return "educacion_fisica";
    if (/religiosa|humana|integral|valores|etica/.test(a)) return "formacion_humana";
    return "generica";
  };

  // Banco de "mecánicas de exploración/construcción" por naturaleza. Rota por
  // indiceGlobal para que cada día tenga una mecánica distinta.
  const MECANICAS_AREA = {
    matematica: [
      ({ foco, tema }) => `Analizan una situación-problema del contexto sobre ${tema} y explican qué datos conocen y qué deben hallar aplicando ${foco}.`,
      ({ foco }) => `Representan el problema con material concreto, gráficos o tablas antes de formalizar el procedimiento de ${foco}.`,
      ({ foco }) => `Resuelven en parejas un problema aplicando ${foco} y argumentan cada paso ante otra pareja (defensa del procedimiento).`,
      ({ tema }) => `Comparan dos estrategias de solución para un mismo problema sobre ${tema} y deciden cuál es más eficiente y por qué.`,
      ({ foco }) => `Verifican sus resultados con una estimación o un método alternativo y detectan posibles errores usando ${foco}.`,
    ],
    ciencias_naturales: [
      ({ tema }) => `Observan un fenómeno, imagen o material del entorno relacionado con ${tema} y registran lo que perciben.`,
      ({ foco }) => `Formulan una pregunta investigable y una hipótesis sobre ${foco}, anticipando qué esperan encontrar.`,
      ({ foco }) => `Realizan una exploración o experimento guiado sobre ${foco} y registran los datos en una tabla de observación.`,
      ({ tema }) => `Analizan los datos obtenidos sobre ${tema}, identifican patrones y contrastan con su hipótesis inicial.`,
      ({ foco }) => `Elaboran una explicación con evidencias sobre ${foco} y la comunican al grupo con un esquema o modelo.`,
    ],
    ciencias_sociales: [
      ({ tema }) => `Analizan un problema o situación social del contexto vinculado con ${tema} y expresan qué saben y qué les preocupa.`,
      ({ foco }) => `Leen y contrastan fuentes (texto, mapa, imagen o dato) sobre ${foco}, distinguiendo hechos de opiniones.`,
      ({ foco }) => `Establecen relaciones de causa y consecuencia sobre ${foco} en un organizador gráfico y las socializan.`,
      ({ tema }) => `Debaten posturas fundamentadas sobre ${tema}, escuchando y respondiendo con argumentos y evidencias.`,
      ({ tema }) => `Proponen una acción ciudadana concreta frente a ${tema} y explican a quién beneficia.`,
    ],
    lengua_espanola: [
      ({ tema }) => `Leen un texto modelo relacionado con ${tema} e identifican su propósito, estructura y rasgos del género.`,
      ({ foco }) => `Analizan cómo funciona ${foco} dentro del texto y anotan ejemplos que podrán reutilizar.`,
      ({ foco }) => `Planifican y redactan un borrador propio aplicando ${foco}, atendiendo al destinatario y al propósito.`,
      ({ tema }) => `Revisan en parejas su producción sobre ${tema} con una pauta y aplican al menos una mejora concreta.`,
      ({ tema }) => `Editan y publican su texto sobre ${tema} para un lector real y comparten la versión final.`,
    ],
    artistica: [
      ({ tema }) => `Aprecian una obra o referente relacionado con ${tema} y comentan qué recursos expresivos reconocen.`,
      ({ foco }) => `Exploran la técnica de ${foco} con ejercicios breves antes de la creación.`,
      ({ foco }) => `Crean de forma guiada una pieza propia aplicando ${foco} y registran sus decisiones en la bitácora.`,
      ({ tema }) => `Revisan su producción sobre ${tema} con criterios estéticos y aplican una mejora.`,
      ({ tema }) => `Exhiben o interpretan su obra sobre ${tema} y explican su intención al grupo.`,
    ],
    educacion_fisica: [
      ({ tema }) => `Realizan una activación corporal segura conectada con ${tema}.`,
      ({ foco }) => `Observan la demostración técnica de ${foco} e identifican sus puntos clave.`,
      ({ foco }) => `Practican ${foco} de forma guiada en parejas o tríos, corrigiéndose con una pauta simple.`,
      ({ tema }) => `Aplican lo practicado en un juego o reto motor cooperativo sobre ${tema}.`,
      ({ foco }) => `Reflexionan sobre el esfuerzo, la salud y el juego limpio al practicar ${foco}.`,
    ],
    formacion_humana: [
      ({ tema }) => `Comparten una experiencia humana cercana relacionada con ${tema} en un clima de respeto.`,
      ({ foco }) => `Dialogan de forma reflexiva sobre ${foco} a partir de un caso o texto de valor.`,
      ({ foco }) => `Analizan los valores en juego en la situación de ${foco} y contrastan puntos de vista.`,
      ({ tema }) => `Discierne en grupo qué actitud es más coherente frente a ${tema} y por qué.`,
      ({ foco }) => `Asumen un compromiso personal o comunitario concreto vinculado con ${foco}.`,
    ],
    generica: [
      ({ tema }) => `Exploran una situación del contexto relacionada con ${tema} y activan sus saberes previos.`,
      ({ foco }) => `Construyen de forma guiada el aprendizaje central sobre ${foco} con apoyo de ejemplos.`,
      ({ foco }) => `Aplican ${foco} en una tarea colaborativa y registran su proceso.`,
      ({ tema }) => `Revisan su avance sobre ${tema} con criterios compartidos y aplican una mejora.`,
      ({ tema }) => `Socializan su producción sobre ${tema} y reciben retroalimentación de sus pares.`,
    ],
  };

  const construirActividadesAreaNoIdioma = ({
    perfilDia, temaSemana, productoNombre, foco, vocabTxt,
    piezaProducto, faseNum, esUltimoDeSemana, indiceGlobal = 0,
  }) => {
    const tema = String(temaSemana).split(" · ")[0].trim();
    const banco = MECANICAS_AREA[clasificarNaturalezaArea()] || MECANICAS_AREA.generica;
    const mecanica = (offset = 0) => banco[(indiceGlobal + offset) % banco.length]({ foco, tema });

    if (faseNum === 1) {
      const esPrimerDia = perfilDia.posicion === "inicio" || perfilDia.posicion === "unico";
      if (esPrimerDia) {
        return [
          `Escuchan la presentación de la unidad: la situación de aprendizaje, los contenidos que trabajarán y el producto final que construirán (${productoNombre}).`,
          `Observan una situación o ejemplo del contexto relacionado con ${tema} y expresan qué reconocen de su propia experiencia.`,
          `Registran en el cuaderno los conceptos o términos clave que ya conocen sobre el tema (${vocabTxt}).`,
          `Elaboran ${piezaProducto} con las ideas que consideran más importantes y socializan por qué.`,
          `Participan en un diagnóstico breve respondiendo preguntas sencillas sobre el tema.`,
        ];
      }
      return [
        `Observan un ejemplo del producto final y analizan la rúbrica de ${productoNombre}, identificando los criterios con los que serán evaluados.`,
        `Revisan y organizan los conceptos o términos clave del tema (${vocabTxt}) en un organizador gráfico.`,
        `Elaboran ${piezaProducto} imaginando cómo será su producto terminado.`,
        `Acuerdan las normas de trabajo de la unidad y el plan de la semana.`,
      ];
    }

    if (faseNum >= 4) {
      if (perfilDia.posicion === "inicio") {
        return [
          `Revisan las piezas del portafolio elaboradas en la unidad y deciden cuáles integran a ${productoNombre}.`,
          `Arman en equipos ${piezaProducto}, decidiendo qué evidencia, dato o representación va en cada sección.`,
          `Comparten su plan con otro equipo y reciben una sugerencia concreta de mejora.`,
        ];
      }
      if (perfilDia.posicion === "cierre") {
        return [
          `Presentan ${productoNombre} ante el grupo en turnos breves y cronometrados.`,
          `Coevalúan a sus compañeros con la rúbrica y anotan una pregunta real para cada presentación.`,
          `Responden una pregunta del público al cierre de su presentación, fundamentando con lo aprendido.`,
          `Completan la ficha de autoevaluación de la unidad y registran una meta personal para la siguiente.`,
          `Exhiben los productos terminados en el aula como cierre de la unidad.`,
        ];
      }
      return [
        `Analizan un producto modelo y evalúan con una rúbrica sencilla qué lo hace claro y completo.`,
        `Preparan su presentación con introducción, desarrollo de las evidencias y un cierre con conclusión.`,
        `Ensayan en parejas: uno presenta y el otro completa una ficha "dos estrellas y un deseo".`,
        `Ajustan ${piezaProducto} con la retroalimentación recibida antes de la presentación final.`,
      ];
    }

    if (esUltimoDeSemana) {
      return [
        `Revisan las piezas elaboradas durante la semana e identifican conceptos y procedimientos que pueden integrar.`,
        `Organizan sus ideas y construyen ${piezaProducto}, conectando lo aprendido con ${productoNombre}.`,
        `Intercambian en grupos sugerencias sobre el avance de los compañeros y aplican una mejora concreta.`,
        `Preparan en pequeños grupos cómo presentarán su avance.`,
        `Completan una coevaluación breve destacando una fortaleza del trabajo de un compañero.`,
      ];
    }

    // Fases de construcción/aplicación: el Desarrollo sigue la secuencia
    // disciplinar del área (3 mecánicas distintas rotadas) + producción + cierre.
    return [
      mecanica(0),
      mecanica(2),
      mecanica(4),
      `Elaboran ${piezaProducto}, aplicando ${foco} y al menos tres conceptos o términos del tema (${vocabTxt}). (Aporte a ${productoNombre}.)`,
      `Socializan su producción con un compañero y aplican una mejora concreta ("una estrella y un deseo") antes de guardarla en el portafolio.`,
    ];
  };

  // ─── Selector del Banco Pedagógico ──────────────────────────────────────────
  // Elige del banco la actividad de mayor afinidad con el día (tema + estructura
  // + grado) para el momento Desarrollo. Determinista: mismo día → misma
  // elección. Evita repetir la misma actividad en días consecutivos con un
  // registro de usos por unidad. Si nada supera el umbral de afinidad, devuelve
  // null y el molde toma el control. NO parafrasea: sirve las instrucciones
  // VERBATIM del banco (validadas por el dueño), solo interpola el aporte al
  // producto al final para mantener el hilo del portafolio.
  const _bancoUsadas = new Set();
  const _tok = (s) => String(s || "")
    .toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/).filter((w) => w.length > 3);
  const elegirActividadBanco = ({ temaSemana, estructura, foco, indiceGlobal }) => {
    if (!bancoActividadesArea.length) return null;
    const señales = new Set([
      ..._tok(temaSemana), ..._tok(estructura), ..._tok(foco),
    ]);
    if (!señales.size) return null;
    const puntuar = (act) => {
      const campoActividad = [
        ...String(act.titulo || "").split(" "),
        ...(Array.isArray(act.temas) ? act.temas : []),
        ...(Array.isArray(act.habilidades) ? act.habilidades : []),
        String(act.estrategia || ""),
        String(act.competencia || ""),
      ].join(" ");
      const tokensAct = new Set(_tok(campoActividad));
      let score = 0;
      señales.forEach((s) => { if (tokensAct.has(s)) score += 1; });
      // Bono por valoración/uso previo (calidad probada), penaliza si ya se usó.
      score += Math.min(Number(act.valoracion || 0), 3) * 0.25;
      if (_bancoUsadas.has(act.id)) score -= 2;
      return score;
    };
    const ranking = bancoActividadesArea
      .map((act) => ({ act, score: puntuar(act) }))
      .filter((r) => r.score >= 2) // umbral: al menos 2 señales en común
      .sort((a, b) => b.score - a.score);
    if (!ranking.length) return null;
    // Desempate estable por indiceGlobal para variar entre días igualmente afines.
    const top = ranking.filter((r) => r.score === ranking[0].score);
    const elegida = top[indiceGlobal % top.length].act;
    _bancoUsadas.add(elegida.id);
    return elegida;
  };

  const construirActividadesDia = ({
    protagonista,
    perfilDia,
    temaSemana,
    productoNombre,
    vocabulario = [],
    funcionales = [],
    piezaProducto,
    indiceGlobal = 0,
    faseNum = 2,
    esUltimoDeSemana = false,
  }) => {
    const vocabTxt = vocabulario.length ? vocabulario.join(", ") : "palabras clave del tema";
    const estructura = protagonista?.texto || "la estructura comunicativa trabajada";
    const funcion = (funcionales[0] || "comunicarse en una situación cotidiana")
      .replace(/^(Funcional|Discursivo):\s*/i, "").toLowerCase();
    const lv = LISTENING_VARIANTES[indiceGlobal % LISTENING_VARIANTES.length];
    const interaccion = resolverMecanica({ estructura, funcion, temaSemana, indiceGlobal });

    // ÁREAS NO-IDIOMA: las actividades nacen de la SECUENCIA DISCIPLINAR del
    // área (documento oficial, págs. 9-10), no del molde comunicativo de
    // Lenguas Extranjeras. Nada de "Listen and X", "Speaking Circle" ni
    // "pronunciación" en Matemática, Ciencias, Sociales, etc.
    if (!esIdiomaArea) {
      return construirActividadesAreaNoIdioma({
        perfilDia, temaSemana, productoNombre, foco: estructura,
        vocabTxt, piezaProducto, faseNum, esUltimoDeSemana, indiceGlobal,
      });
    }

    if (faseNum === 1) {
      const esPrimerDia = perfilDia.posicion === "inicio" || perfilDia.posicion === "unico";
      if (esPrimerDia) {
        return [
          `Escuchan la presentación de la unidad: la situación de aprendizaje, los temas que trabajarán y el producto final que construirán (${productoNombre}).`,
          `Observan imágenes o ejemplos relacionados con ${temaSemana} y expresan oralmente qué reconocen de su propia experiencia.`,
          `Identifican y registran en el cuaderno palabras que ya conocen sobre el tema (${vocabTxt}).`,
          `Elaboran ${piezaProducto} con las actividades o ideas que consideran más importantes y socializan por qué.`,
          `Participan en un diagnóstico oral breve respondiendo preguntas sencillas sobre el tema.`,
        ];
      }
      return [
        `Observan ejemplos del producto final y analizan la rúbrica de ${productoNombre}, identificando los criterios con los que serán evaluados.`,
        `Escuchan y practican la pronunciación guiada del vocabulario inicial del tema (${vocabTxt}).`,
        `Organizan el vocabulario por categorías en sus cuadernos y elaboran de tres a cinco oraciones sencillas sobre ${temaSemana}.`,
        `Guardan su producción diagnóstica y elaboran ${piezaProducto} imaginando cómo será su producto terminado.`,
        `Socializan sus planes iniciales y acuerdan las normas de trabajo de la unidad.`,
      ];
    }

    if (faseNum >= 4) {
      if (perfilDia.posicion === "inicio") {
        return [
          `Escuchan con propósito (Listen and Organize) la descripción de un producto modelo y ordenan las secciones del suyo en el orden correcto.`,
          `Revisan las piezas del portafolio elaboradas en la unidad y deciden cuáles integran a ${productoNombre}.`,
          `Arman en equipos (misión colaborativa) ${piezaProducto}, decidiendo qué evidencia, texto o imagen va en cada sección.`,
          `Comparten su plan con otro equipo y reciben una sugerencia concreta de mejora.`,
        ];
      }
      if (perfilDia.posicion === "cierre") {
        return [
          `Presentan ${productoNombre} ante el grupo en turnos breves y cronometrados, para que todos alcancen su turno.`,
          `Participan en Listen and Evaluate mientras escuchan: completan la rúbrica de coevaluación y anotan una pregunta real para cada presentador.`,
          `Responden en el idioma trabajado una pregunta del público al cierre de su presentación.`,
          `Completan la ficha de autoevaluación de la unidad y registran una meta personal para la siguiente.`,
          `Exhiben los productos terminados en el aula como celebración del cierre (galería del producto).`,
        ];
      }
      return [
        `Observan con propósito (Listen and Evaluate) una presentación modelo y evalúan con una rúbrica sencilla qué la hace clara (volumen, orden, contacto visual).`,
        `Redactan su guion de presentación con introducción, secciones del producto y un cierre con recomendación.`,
        `Ensayan en parejas (Pair Rehearsal): uno presenta y el otro completa una ficha de retroalimentación "dos estrellas y un deseo".`,
        `Ajustan ${piezaProducto} con la retroalimentación recibida antes del segundo ensayo.`,
      ];
    }

    if (esUltimoDeSemana) {
      return [
        `Revisan las piezas elaboradas durante la semana e identifican vocabulario, estructuras y ejemplos que pueden integrar.`,
        `Organizan sus ideas y construyen ${piezaProducto}, conectando lo aprendido con ${productoNombre}.`,
        `Intercambian en grupos (Listen and Create) sugerencias sobre el avance de los compañeros y aplican una mejora concreta.`,
        `Practican en pequeños grupos cómo presentarán su avance, usando las estructuras de la semana.`,
        `Completan una coevaluación breve destacando una fortaleza del trabajo de un compañero.`,
      ];
    }

    // BANCO Y COMBINADOR: solo de Fase 2 en adelante. La Fase 1 es APROPIACIÓN de
    // la unidad (presentar situación, producto, rúbrica, acuerdos, diagnóstico) y
    // sus actividades genéricas SON las correctas — no llevan mecánica de práctica
    // de estructura. La Fase 1 ya retornó su molde arriba (faseNum===1); este
    // guard es un cinturón de seguridad por si algún cambio futuro la dejara
    // caer hasta aquí. Ídem faseNum>=4 (integración/producto ya retornaron).
    const puedeUsarBanco = faseNum >= 2 && faseNum < 4;

    // BANCO PEDAGÓGICO primero: si hay una actividad validada afín al día, se
    // usa su mecánica real (verbatim) en lugar del molde genérico. Se conserva
    // el andamiaje de escucha con propósito al inicio y el aporte al producto al
    // final, para no romper el hilo del portafolio ni la progresión de la unidad.
    const actBanco = puedeUsarBanco ? elegirActividadBanco({ temaSemana, estructura, foco: estructura, indiceGlobal }) : null;
    if (actBanco) {
      const pasos = actBanco.instrucciones
        .map((x) => String(x || "").trim())
        .filter(Boolean);
      return [
        `Escuchan con propósito (${lv.nombre}) un texto breve sobre ${temaSemana} y ${lv.consigna}.`,
        ...pasos,
        `Elaboran ${piezaProducto}, incorporando ${estructura} y al menos tres palabras del vocabulario trabajado. (Aporte a ${productoNombre}.)`,
        `Socializan su producción con un compañero y aplican una mejora concreta ("una estrella y un deseo") antes de guardarla en el portafolio.`,
      ];
    }

    // COMBINADOR (cascada: banco directo → COMBINADOR → molde): si no hubo match
    // directo pero el banco tiene ≥3 piezas afines por tema con mecánicas
    // distintas, se crea una actividad NUEVA sin IA recombinando una mecánica
    // probada con la estructura del día. Se acumula para cosecharla y validarla.
    const actCombinada = puedeUsarBanco ? combinarActividad(bancoActividadesArea, {
      estructura, temaSemana, funcion: (typeof funcion === "string" ? funcion : ""), area, grado,
    }) : null;
    if (actCombinada) {
      const claveComb = String(actCombinada.titulo || "").toLowerCase();
      if (!_combinadasVistas.has(claveComb)) {
        _combinadasVistas.add(claveComb);
        combinacionesCreadas.push(actCombinada);
      }
      const pasos = actCombinada.instrucciones.map((x) => String(x || "").trim()).filter(Boolean);
      return [
        `Escuchan con propósito (${lv.nombre}) un texto breve sobre ${temaSemana} y ${lv.consigna}.`,
        ...pasos.slice(1), // el paso 0 del combinado es andamiaje; ya lo pusimos con la variante del día
      ];
    }

    return [
      `Escuchan con propósito (${lv.nombre}) un texto breve sobre ${temaSemana} y ${lv.consigna}.`,
      protagonista?.esNueva
        ? `Descubren el uso de ${estructura} mediante ejemplos contextualizados y lo relacionan con el vocabulario del tema (${vocabTxt}).`
        : `Reaplican ${estructura} a vocabulario y situaciones nuevas del tema (${vocabTxt}), ampliando sus ejemplos anteriores.`,
      interaccion,
      `Elaboran ${piezaProducto}, incorporando ${estructura} y al menos tres palabras del vocabulario trabajado. (Aporte a ${productoNombre}.)`,
      `Socializan su producción con un compañero y aplican una mejora concreta ("una estrella y un deseo") antes de guardarla en el portafolio.`,
    ];
  };

  // G3d — metacognición VARIADA por día (banco rotativo; en el idioma meta
  // para Lenguas Extranjeras, como el documento modelo).
  const METACOG_BANK = specBase.esIdioma
    ? {
        inicio: [
          ["What do I already know about today's topic?", "What words do I need to review before practicing?"],
          ["What did I remember from the last class?", "What do I want to learn today?"],
          ["Which words were easy to recognize and which were harder?", "Why?"],
          ["What time of my day connects with today's topic?", "Why is this topic useful for me?"],
        ],
        desarrollo: [
          ["Which strategy helped me most during the practice?", "How do I know my work connects with the final product?"],
          ["What did I discover about using this structure?", "Which activity helped me understand it better?"],
          ["Was the listening activity easy or hard? Why?", "What helped me complete the mission?"],
          ["Which part of the activity did I enjoy most?", "How can I describe this better in English?"],
        ],
        cierre: [
          ["What new sentence can I say today that I could not say before?", "How can I use it outside the classroom?"],
          ["What did I learn today and what do I need to improve?", "How does this class help my final product?"],
          ["What was easy and what was difficult today?", "What will I practice at home?"],
          ["What did I learn from my classmates today?", "How will I use this in my real life?"],
        ],
      }
    : {
        inicio: [
          ["¿Qué recordé que me ayuda a comprender el tema de hoy?", "¿Qué necesito aclarar antes de pasar a la práctica?"],
          ["¿Qué sé ya sobre el tema de hoy?", "¿Qué me gustaría aprender en esta clase?"],
          ["¿Qué de la clase anterior me sirve hoy?", "¿Qué duda quiero resolver?"],
        ],
        desarrollo: [
          ["¿Qué estrategia me ayudó más durante la práctica?", "¿Cómo sé que mi avance responde al producto esperado?"],
          ["¿Qué descubrí al usar el contenido de hoy?", "¿Qué actividad me ayudó a comprenderlo mejor?"],
          ["¿Qué parte fue fácil y cuál difícil? ¿Por qué?", "¿Qué me ayudó a completar la misión?"],
        ],
        cierre: [
          ["¿Qué logré hoy y qué debo mejorar?", "¿Cómo aporta esta clase al producto final de la unidad?"],
          ["¿Qué puedo hacer hoy que no podía hacer antes?", "¿Cómo lo usaré fuera del aula?"],
          ["¿Qué aprendí de mis compañeros hoy?", "¿Qué voy a practicar en casa?"],
        ],
      };
  const metacogDia = (momento, indiceGlobal = 0) => {
    const banco = METACOG_BANK[momento] || METACOG_BANK.cierre;
    return banco[indiceGlobal % banco.length];
  };

  const resolverTopicoDia = (dia, indiceEnFase, specActual = specBase, protagonista = null) => {
    const indiceGlobal = Math.max((dia?.numeroGlobal || (globalOffset + indiceEnFase + 1)) - 1, 0);
    const semanaReal = Math.max(1, Math.min(numSemanas, dia?.semana || 1));
    const etapa = String(dia?.etapaProgresion || "").trim();

    // FUENTE ÚNICA DE VERDAD (fix título↔estructura): cuando el día tiene una
    // estructura gramatical protagonista, el foco del TÍTULO es ESA MISMA
    // estructura — la misma que alimenta focoLinguistico y piezaProducto.
    // Antes el título salía de resolverFocosCurriculares (reparto por bloque de
    // semana) y focoLinguistico de resolverProtagonistaDia (una por día global);
    // los dos repartos divergían y el título contradecía la estructura del día.
    if (protagonista?.texto
      && (protagonista.tipo === "estructura"
        || protagonista.tipo === "reaplicacion"
        || protagonista.tipo === "integracion")) {
      const estructura = limpiarEtiquetaContenido(protagonista.texto);
      const vocabProt = tomarVentana(specActual.contenidosClaves?.vocabulario, indiceGlobal, 2)
        .map(limpiarEtiquetaContenido).filter(Boolean);
      return recortar(
        vocabProt.length ? `${estructura} · vocabulario: ${vocabProt.slice(0, 2).join(", ")}` : estructura,
        90
      );
    }

    const focoCurricular = resolverFocosCurriculares({
      arquitectura: specActual.arquitecturaCurricular,
      contenidosClaves: specActual.contenidosClaves,
      semanaNum: semanaReal,
      diaGlobal: indiceGlobal + 1,
      numSemanas,
    });
    // G1 — el foco es SIEMPRE contenido curricular legible: sin etiquetas de
    // etapa interna ("Diagnóstico:", "Construcción:") ni claves del andamio
    // ("Apropiacion de la unidad / situacion de aprendizaje / …"). La etapa
    // del día ya la comunica el título del perfil didáctico.
    const focoPrincipal = limpiarEtiquetaContenido(focoCurricular?.principal || "");
    const detalleUnico = (focoCurricular?.detalles || [])
      .map((d) => limpiarEtiquetaContenido(d))
      .filter((d) => d
        && !esFocoInternoUnidad(d)
        && normalizarClaveDidactica(d) !== normalizarClaveDidactica(focoPrincipal))
      .slice(0, 1)
      .join("");
    if (focoPrincipal && !esFocoInternoUnidad(focoPrincipal)) {
      return recortar(detalleUnico ? `${focoPrincipal} · ${detalleUnico}` : focoPrincipal, 90);
    }
    const gramaticaSemana = getFocoGramatical(specActual.contenidosClaves?.gramatica, semanaReal, numSemanas)
      .map(limpiarEtiquetaContenido).filter(Boolean);
    const vocab = tomarVentana(specActual.contenidosClaves?.vocabulario, indiceGlobal, 3).map(limpiarEtiquetaContenido);
    const expresiones = tomarVentana(specActual.contenidosClaves?.expresiones, indiceGlobal, 1).map(limpiarEtiquetaContenido);
    const funcionales = tomarVentana(specActual.contenidosClaves?.funcionales, indiceGlobal, 1).map(limpiarEtiquetaContenido);
    const temaDia = String(dia?.temaCurricular || specActual.temaOficial || tema || "el tema de la unidad").trim();

    if (etapa && /presentaci[oó]n|exploraci[oó]n|diagn[oó]stico/i.test(etapa)) {
      return recortar(temaDia, 90);
    }

    if (gramaticaSemana.length) {
      return recortar(`${gramaticaSemana[0]}${vocab.length ? ` · vocabulario: ${vocab.slice(0, 2).join(", ")}` : ""}`, 90);
    }

    if (funcionales.length) {
      return recortar(`${funcionales[0]}${expresiones.length ? ` · ${expresiones[0]}` : ""}`, 90);
    }

    if (expresiones.length) {
      return recortar(`expresiones del tema (${expresiones[0]})`, 90);
    }

    if (vocab.length) {
      return recortar(`vocabulario del tema: ${vocab.join(", ")}`, 90);
    }

    return recortar(temaDia, 90);
  };

  const normCodigo = (c) => String(c || "").replaceAll("[", "").replaceAll("]", "").replace(/\s/g, "").toUpperCase();

  // G2 — indicadores del día: SOLO códigos reales de la malla (nada de
  // inventar "IL-n": un código falso envenena el resumen semanal, el semáforo
  // de Registro→Indicadores y las evidencias por indicador). Los indicadores
  // (REFORZAR) —trabajados antes pero no logrados— van primero en la rotación.
  const tomarIndicadoresBase = (specActual = specBase, indice = 0) => {
    // SOLO los indicadores seleccionados por afinidad al TEMA de la unidad
    // (indicadoresTrabajo, tope MAX_INDICADORES_TRABAJO_UNIDAD). NO se suman los
    // 21 de la malla completa (specActual.indicadores) — eso hacía que a lo largo
    // de las 16 clases se tocaran TODOS los indicadores y salieran todos en
    // negrita. La malla completa queda como fallback solo si el tema no precargó
    // ninguno, para no dejar la unidad sin indicadores.
    const trabajo = Array.isArray(specActual.indicadoresTrabajo) ? specActual.indicadoresTrabajo : [];
    const base = trabajo.length
      ? trabajo
      : (Array.isArray(specActual.indicadores) ? specActual.indicadores : []);
    const unicos = [];
    const vistos = new Set();
    for (const ind of base) {
      const codigo = String(ind?.codigoOficial || ind?.id || ind?.codigo || "").trim();
      const descripcion = String(ind?.descripcion || ind?.texto || "").trim();
      if (!codigo) continue; // sin código oficial no hay vínculo al hilo pedagógico
      const clave = normCodigo(codigo);
      if (!clave || vistos.has(clave)) continue;
      vistos.add(clave);
      unicos.push({ codigo, descripcion });
    }
    if (!unicos.length) return [];
    const debiles = new Set(
      (Array.isArray(specActual.indicadoresDebiles) ? specActual.indicadoresDebiles : [])
        .map((c) => normCodigo(typeof c === "string" ? c : c?.codigo || c?.id || ""))
        .filter(Boolean)
    );
    if (debiles.size) {
      unicos.sort((a, b) =>
        (debiles.has(normCodigo(b.codigo)) ? 1 : 0) - (debiles.has(normCodigo(a.codigo)) ? 1 : 0));
    }
    // tomarVentana opera sobre STRINGS (hace String(x)); pasarle objetos los
    // convertía en "[object Object]" y el resumen semanal quedaba en "—".
    // Rotamos sobre los códigos y reconstruimos el objeto con su descripción.
    const porCodigo = new Map(unicos.map((u) => [u.codigo, u]));
    return tomarVentana(unicos.map((u) => u.codigo), indice, Math.min(2, unicos.length))
      .map((codigo) => porCodigo.get(codigo))
      .filter(Boolean);
  };

  // G1 — evidencias con contenido REAL del día (tema y estructura), no el
  // texto del foco repetido en las tres celdas de la tabla.
  const construirEvidenciasBase = ({ foco, producto, momento = "Desarrollo", piezaProducto = "", temaCorto = "", estructura = "" }) => {
    const pieza = piezaProducto || "un avance de aprendizaje";
    const temaTxt = temaCorto || foco || "el tema del día";
    const productoTxt = producto || "el producto final";
    const nombre = String(momento || "").toLowerCase();
    // Las evidencias son texto de celda de párrafo (como el documento modelo del
    // dueño): se entregan COMPLETAS, sin truncar. Truncarlas producía cortes a
    // media palabra ("People Around Me: Social…") en el PDF del docente.
    if (nombre.includes("inicio")) {
      return {
        conocimientos: [
          `Reconoce ideas y vocabulario clave sobre ${temaTxt}.`,
        ],
        desempeno: [],
        producto: [],
      };
    }
    if (nombre.includes("cierre")) {
      return {
        conocimientos: [],
        desempeno: [],
        producto: [
          `Guarda o socializa ${pieza} como evidencia para ${productoTxt}.`,
        ],
      };
    }
    return {
      conocimientos: [],
      desempeno: [
        estructura
          ? `Aplica ${estructura} al comunicarse sobre ${temaTxt}.`
          : `Aplica el contenido del día en la práctica guiada sobre ${temaTxt}.`,
      ],
      producto: [
        `Entrega ${pieza} como avance para ${productoTxt}.`,
      ],
    };
  };

  const obtenerPerfilDidacticoDia = ({ fase, indiceEnFase, totalDias = 1, temaSemana, productoNombre }) => {
    const pos = totalDias <= 1 ? "unico" : indiceEnFase === 0 ? "inicio" : indiceEnFase === totalDias - 1 ? "cierre" : "desarrollo";
    const perfiles = [
      {
        etapa: "vision_compartida",
        tituloSemana: "Visión compartida de la unidad y apropiación del producto",
        proposito: "Sensibilizar frente a la situación de aprendizaje, acordar el producto final y activar saberes previos.",
        evidenciaCentral: "Diagnóstico inicial, acuerdos de trabajo y primera entrada del portafolio.",
        instrumentoSugerido: "Lista de cotejo diagnóstica",
        porPos: {
          inicio: "Bienvenida al tema y lectura de la realidad",
          desarrollo: "Comprensión de la unidad, criterios y portafolio",
          cierre: "Acuerdos de trabajo y diagnóstico inicial",
          unico: "Presentación de la situación, producto y criterios",
        },
        mision: "Mapa inicial de la unidad",
      },
      {
        etapa: "construccion_guiada",
        tituloSemana: "Construcción guiada de los aprendizajes",
        proposito: "Gestionar y construir los conocimientos necesarios para comprender el tema y avanzar hacia el producto.",
        evidenciaCentral: "Organizadores, prácticas guiadas y producciones parciales revisadas.",
        instrumentoSugerido: "Lista de cotejo formativa",
        porPos: {
          inicio: "Activación del contenido central",
          desarrollo: "Práctica guiada con ejemplos del contexto",
          cierre: "Consolidación del contenido trabajado",
          unico: "Construcción guiada del aprendizaje clave",
        },
        mision: "Taller de construcción del saber",
      },
      {
        etapa: "aplicacion_produccion",
        tituloSemana: "Aplicación, producción y comparación de aprendizajes",
        proposito: "Aplicar los aprendizajes en tareas reales o simuladas, producir piezas del producto y revisarlas con pares.",
        evidenciaCentral: "Producto parcial aplicado, coevaluación y mejora documentada.",
        instrumentoSugerido: "Rúbrica analítica",
        porPos: {
          inicio: "Aplicación del aprendizaje en una tarea comunicativa",
          desarrollo: "Producción colaborativa y revisión entre pares",
          cierre: "Mejora del producto con criterios compartidos",
          unico: "Aplicación del aprendizaje al producto",
        },
        mision: "Laboratorio de aplicación",
      },
      {
        etapa: "integracion_socializacion",
        tituloSemana: "Integración, socialización y producto final",
        proposito: "Integrar evidencias, mejorar el producto final, socializar aprendizajes y cerrar con metacognición.",
        evidenciaCentral: "Producto final socializado, reflexión metacognitiva y evidencias finales.",
        instrumentoSugerido: "Rúbrica sumativa y escala de valoración",
        porPos: {
          inicio: "Organización de evidencias del producto",
          desarrollo: "Ensayo, retroalimentación y mejora final",
          cierre: "Presentación, reflexión y cierre de la unidad",
          unico: "Integración y socialización del producto",
        },
        mision: "Galería del producto final",
      },
    ];
    const perfil = perfiles[Math.min(Math.max((fase?.numero || 1) - 1, 0), perfiles.length - 1)];
    const tituloDia = perfil.porPos[pos] || perfil.porPos.desarrollo;
    const pieza = pos === "cierre"
      ? `la versión revisada de ${productoNombre}`
      : pos === "inicio"
        ? `un borrador inicial sobre ${temaSemana}`
        : `una pieza de trabajo sobre ${temaSemana}`;
    return {
      tituloSemana: perfil.tituloSemana,
      tituloDia,
      mision: perfil.mision,
      pieza,
      etapa: perfil.etapa,
      posicion: pos,
      proposito: perfil.proposito,
      evidenciaCentral: perfil.evidenciaCentral,
      instrumentoSugerido: perfil.instrumentoSugerido,
      cierre: pos === "cierre"
        ? `Guardan ${pieza} como evidencia final en el portafolio.`
        : `Guardan ${pieza} en el portafolio para retomarla en la próxima clase.`,
    };
  };

  const construirClaseBaseCurricular = ({ dia, fase, indiceEnFase, specActual, semanaGeneracion }) => {
    const indiceGlobal = Math.max((dia?.numeroGlobal || (globalOffset + indiceEnFase + 1)) - 1, 0);
    // G3b — estructura protagonista del día (avanza clase a clase). Se resuelve
    // ANTES que el foco del título para que ambos usen la MISMA estructura.
    const protagonista = resolverProtagonistaDia({ specActual, fase, indiceEnFase, indiceGlobal });
    const foco = resolverTopicoDia(dia, indiceEnFase, specActual, protagonista);
    const temaSemana = dia?.temaCurricular
      || specActual.temaTrabajoSemana
      || (specActual.temasSemana || []).filter(Boolean)[0]
      || specActual.temaOficial
      || tema;
    const vocabulario = tomarVentana(specActual.contenidosClaves?.vocabulario, indiceGlobal, 3);
    const funcionales = tomarVentana(specActual.contenidosClaves?.funcionales, indiceGlobal, 2);
    const indicadores = tomarIndicadoresBase(specActual, indiceGlobal);
    const codigosIndicadores = indicadores.map((ind) => ind.codigo).filter(Boolean);
    const productoNombre = specActual.productoFinalNombre || productoFinal || "el producto final";
    const faseNum = fase?.numero || 1;
    const perfilDia = obtenerPerfilDidacticoDia({
      fase,
      indiceEnFase,
      totalDias: fase?.dias?.length || 1,
      temaSemana,
      productoNombre,
    });

    const protagonistaPrevio = indiceEnFase > 0
      ? resolverProtagonistaDia({ specActual, fase, indiceEnFase: indiceEnFase - 1, indiceGlobal: indiceGlobal - 1 })
      : null;

    // G3d — arco semanal: el último día de cada semana calendario (en fases de
    // contenido, con semana de 3+ días en esta fase) INTEGRA en vez de sumar
    // contenido nuevo.
    const diasMismaSemana = (fase?.dias || []).filter((d) => d?.semana === dia?.semana).length;
    const esUltimoDeSemana = faseNum >= 2 && faseNum <= 3
      && diasMismaSemana >= 3
      && (indiceEnFase === (fase?.dias?.length || 1) - 1 || fase?.dias?.[indiceEnFase + 1]?.semana !== dia?.semana);

    const temaCorto = String(temaSemana).split(" · ")[0].trim();
    const estructuraDia = protagonista.texto;
    const piezaProducto = piezaDelDia({ protagonista, perfilDia, temaCorto, esUltimoDeSemana, faseNum, indiceEnFase });
    const recursosBase = [
      "Pizarra y marcadores",
      area === "Inglés" ? "Tarjetas de vocabulario" : "Cuaderno del estudiante",
      vocabulario.length ? `Banco de palabras: ${vocabulario.join(", ")}` : "",
      protagonista.tipo === "estructura" || protagonista.tipo === "reaplicacion"
        ? `Ejemplos modelo: ${estructuraDia}` : "",
    ].filter(Boolean);
    const evidenciaInicio = construirEvidenciasBase({ foco, producto: productoNombre, momento: "Inicio", piezaProducto, temaCorto, estructura: estructuraDia });
    const evidenciaDesarrollo = construirEvidenciasBase({ foco, producto: productoNombre, momento: "Desarrollo", piezaProducto, temaCorto, estructura: estructuraDia });
    const evidenciaCierre = construirEvidenciasBase({ foco, producto: productoNombre, momento: "Cierre", piezaProducto, temaCorto, estructura: estructuraDia });

    const actividadesDesarrollo = construirActividadesDia({
      protagonista,
      perfilDia,
      temaSemana,
      productoNombre,
      vocabulario,
      funcionales,
      piezaProducto,
      indiceGlobal,
      faseNum,
      esUltimoDeSemana,
    });

    return {
      // Día GLOBAL (numeroGlobal) para que coincida con el "dia" que el prompt
      // pasa a la IA (startDia + i) y con el matching de fase en el validador.
      dia: dia?.numeroGlobal || dia?.dia || (globalOffset + indiceEnFase + 1),
      fase: fase?.numero || null,
      nombreFase: fase?.nombre || "",
      secuenciaPedagogica: {
        tipo: "unidad_aprendizaje",
        faseNumero: fase?.numero || null,
        faseNombre: fase?.nombre || "",
        etapa: perfilDia.etapa,
        posicionEnFase: perfilDia.posicion,
        proposito: perfilDia.proposito,
        productoParcial: piezaProducto,
        evidenciaCentral: perfilDia.evidenciaCentral,
        instrumentoSugerido: perfilDia.instrumentoSugerido,
      },
      // El título de semana es SOLO la frase descriptiva ("Exploración y
      // descripción de..."). El número de semana lo pone la banda calendario
      // (SEMANA N) al renderizar; incluirlo aquí producía "SEMANA 2: 'Semana 1:
      // …'" — número duplicado y, peor, desincronizado (dia.semana era relativo
      // a la fase y arrancaba en 1, contradiciendo la banda calendario).
      tituloSemana: recortar(perfilDia.tituloSemana, 70),
      // El título va en encabezado de tabla estrecho: se ABREVIA de forma limpia
      // (no con "…"). En días de integración el foco combina dos estructuras
      // (A · B · vocabulario…); se muestra solo la primera + "(integración)" para
      // que quepa sin cortar a media palabra como pasaba en Semana 4.
      titulo: (() => {
        const focoCorto = String(foco).split(" · ")[0].trim();
        if (esUltimoDeSemana || faseNum >= 4) {
          return `Integración de la semana: ${focoCorto} (integración)`;
        }
        const completo = `${perfilDia.tituloDia}: ${focoCorto}`;
        return completo.length <= 96 ? completo : `${perfilDia.tituloDia}: ${focoCorto}`;
      })(),
      // G3b — el encabezado del día muestra SU protagonista con la etiqueta
      // correcta (Estructura gramatical / Expresión / Integración), no la
      // primera estructura de la semana repetida en bloque.
      focoLinguistico: recortar(
        protagonista.etiqueta === "Estructura gramatical"
          ? estructuraDia
          : `${protagonista.etiqueta}: ${estructuraDia}`,
        140
      ),
      estrategiasDia: [estrategia, "práctica guiada", "socialización"].filter(Boolean).join(" · "),
      // La intención pedagógica es la banda de párrafo del día (documento modelo
      // del dueño): completa, sin truncar. El corte a 230 producía "…" en el PDF.
      intencionPedagogica: esUltimoDeSemana
        ? `Desde el inicio hasta el final de la clase, los estudiantes integran lo trabajado en la semana sobre ${temaCorto} y construyen ${piezaProducto} para ${productoNombre}.`
        : `Desde el inicio hasta el final de la clase, los estudiantes trabajan ${estructuraDia} aplicado a ${temaCorto}, con práctica guiada y producción propia, aportando ${piezaProducto} a ${productoNombre}.`,
      saludoInicial: area === "Inglés"
        ? "Good morning. Today we will use English to connect the class topic with our final product."
        : "Buenos días. Hoy conectaremos el tema de la clase con el producto final de la unidad.",
      // Retroalimentación ESPECÍFICA: nombra lo que se trabajó la clase
      // anterior (documento modelo: "What adverbs of frequency do you remember?")
      // Retroalimentación y enganche son texto de párrafo de celda (como en el
      // documento modelo): completos, sin truncar. El corte producía "…con
      // ejemplos…" y "…Presente simple para… y…" en las semanas de integración.
      retroalimentacionPrevia: protagonistaPrevio?.texto
        ? `Retroalimentación de la clase anterior: recuerdan ${protagonistaPrevio.texto} con ejemplos propios antes de avanzar.`
        : "Recuperan brevemente lo trabajado en la clase anterior y aclaran una duda frecuente antes de avanzar.",
      saberesPrevios: `Recuperación de saberes previos sobre ${temaSemana} mediante preguntas orales y ejemplos cercanos.`,
      actividadEnganche: `Observan una situación breve, imagen o ejemplo relacionado con ${foco} y predicen qué aprenderán.`,
      aporteProducto: recortar(
        piezaProducto.toLowerCase().includes(String(productoNombre).toLowerCase())
          ? piezaProducto
          : `${piezaProducto} para ${productoNombre}`,
        120
      ),
      actividadCLT: {
        nombre: recortar(`${perfilDia.mision}: ${piezaProducto}`, 70),
        mecanica: recortar(`Trabajo en parejas o equipos: comprenden el foco, elaboran ${piezaProducto}, la revisan con criterios y la socializan.`, 170),
      },
      indicadoresTrabajados: codigosIndicadores,
      momentos: [
        {
          nombre: "Inicio",
          tiempo: dia?.momentos?.[0]?.tiempo || "10 min",
          actividades: [],
          evidencias: evidenciaInicio,
          recursos: recursosBase,
          metacognicion: metacogDia("inicio", indiceGlobal),
        },
        {
          nombre: "Desarrollo",
          tiempo: dia?.momentos?.[1]?.tiempo || "30 min",
          actividades: actividadesDesarrollo,
          evidencias: evidenciaDesarrollo,
          recursos: [...recursosBase, "Guía breve de trabajo", "Instrumento de observación"],
          metacognicion: metacogDia("desarrollo", indiceGlobal),
        },
        {
          nombre: "Cierre",
          tiempo: dia?.momentos?.[2]?.tiempo || "5 min",
          actividades: [
            `Comparten una evidencia o aprendizaje logrado sobre ${estructuraDia}.`,
            `Registran una mejora concreta para la próxima clase o para ${productoNombre}.`,
            `Guardan ${piezaProducto} en el portafolio para retomarla o mejorarla en la próxima clase.`,
            "Completan un ticket de salida con una idea aprendida y una pregunta pendiente.",
          ],
          evidencias: evidenciaCierre,
          recursos: [...recursosBase, "Ticket de salida"],
          metacognicion: metacogDia("cierre", indiceGlobal),
        },
      ],
      _origenComposicion: "base_curricular",
    };
  };

  const construirWeekPlanBaseCurricular = ({ fase, specActual, semanaGeneracion, motivo }) => {
    const motivoLimpio = String(motivo || "").replace(/\s+/g, " ").trim();
    advertenciasIA.push(
      `Semana ${semanaGeneracion}, fase ${fase.numero}: la IA no completó esta parte; DocenteOS entregó una base curricular editable desde la malla oficial. ${motivoLimpio ? `Detalle: ${motivoLimpio.slice(0, 180)}` : ""}`.trim()
    );
    const clasesBase = Array.isArray(specActual.secuenciaBase) && specActual.secuenciaBase.length
      ? specActual.secuenciaBase
      : fase.dias.map((dia, i) => construirClaseBaseCurricular({
        dia,
        fase,
        indiceEnFase: i,
        specActual,
        semanaGeneracion,
      }));
    return {
      outputSchemaVersion: "1.3",
      semana: semanaGeneracion,
      clases: clasesBase,
      adaptacionesSemana: {
        acceso: "Presentar instrucciones por escrito y de forma oral, con apoyos visuales y ejemplos modelo disponibles durante la actividad.",
        metodologicas: "Dividir la tarea en pasos breves, verificar comprensión antes del trabajo autónomo y permitir apoyo de pares.",
        evaluacion: "Valorar el mismo indicador con evidencias orales, escritas o visuales según la necesidad del estudiante.",
      },
      observacionesSemana: "Observar si los estudiantes aplican correctamente las estructuras y el vocabulario trabajados durante las interacciones; anotar qué elementos necesitan refuerzo en la próxima sesión.",
      productoFinalNombre: specActual.productoFinalNombre || productoFinal || "",
      _origenComposicion: "base_curricular",
    };
  };

  for (const fase of fases) {
    const numClases = fase.dias.length;
    const semanasFase = [...new Set(fase.dias.map((d) => d.semana).filter(Boolean))];
    const temasFase = _temasDeSemanas(rutaCurricular, semanasFase);
    const semanaGeneracion = semanasFase[0] || fase.numero;
    const temaTrabajoSemana = obtenerTemaSemana(Number(semanaGeneracion || 1), rutaCurricular?.distribucion)
      || temasFase[0]
      || tema;
    const contenidosFase = temaTrabajoSemana && contenidosRuta?.porTema?.get(temaTrabajoSemana)
      ? contenidosRuta.porTema.get(temaTrabajoSemana)
      : temasFase.length && contenidosRuta?.porTema
        ? _unirContenidosTema(temasFase.map((t) => contenidosRuta.porTema.get(t)).filter(Boolean))
        : mallaContenidos;
    const tituloFaseCurricular = temaTrabajoSemana || (temasFase.length ? temasFase.join(" · ") : tema);
    const temasTrabajoFase = temaTrabajoSemana
      ? [temaTrabajoSemana]
      : temasFase;
    const specFase = buildEspecificacionCurricular({
      mallaPayload,
      titulo: tituloFaseCurricular,
      allInds,
      allComps,
      mallaContenidos: contenidosFase,
      area,
      grado,
      producto: productoFinal,
      contextoComunitario: contexto.contextoComunitario || "",
    });
    specFase.rutaCurricular = rutaCurricular;
    specFase.temaTrabajoSemana = temaTrabajoSemana;
    specFase.temasSemana = temasTrabajoFase;
    specFase.temasActivos = rutaCurricular?.temas || temasFase;
    specFase.productoFinalNombre = productoFinalNombreActual;
    if (contexto.productoPropio) specFase.productoFinalNombre = contexto.productoPropio;
    specFase.indicadoresTrabajadosAntes = Array.isArray(contexto.indicadoresTrabajadosAntes) ? contexto.indicadoresTrabajadosAntes : [];
    specFase.indicadoresDebiles = Array.isArray(contexto.indicadoresDebiles) ? contexto.indicadoresDebiles : [];
    specFase.secuenciaBase = fase.dias.map((dia, i) => construirClaseBaseCurricular({
      dia,
      fase,
      indiceEnFase: i,
      specActual: specFase,
      semanaGeneracion,
    }));

    // Progreso narrado para el docente: fase pedagógica, semana calendario y
    // tópico real por día según la malla/contenidos oficiales ya seleccionados.
    const progressWrapper = onProgress
      ? (startDia, endDia) => {
          const globalStart = globalOffset + startDia;
          const globalEnd   = globalOffset + endDia;
          const rango = globalStart === globalEnd
            ? `la clase ${globalStart}`
            : `las clases ${globalStart} y ${globalEnd}`;
          const diasLote = fase.dias.slice(startDia - 1, endDia);
          const semanasLote = [...new Set(diasLote.map((d) => d.semana).filter(Boolean))];
          const semanaTxt = semanasLote.length === 1
            ? `Semana ${semanasLote[0]} de ${numSemanas}`
            : `Semanas ${semanasLote.join(" y ")} de ${numSemanas}`;
          const topicos = diasLote.map((dia, idx) => {
            const idxEnFase = startDia - 1 + idx;
            const idxGlobal = Math.max((dia?.numeroGlobal || (globalOffset + idxEnFase + 1)) - 1, 0);
            const prot = resolverProtagonistaDia({ specActual: specFase, fase, indiceEnFase: idxEnFase, indiceGlobal: idxGlobal });
            const etiquetaDia = [
              `Día ${dia.numeroGlobal || globalStart + idx}`,
              dia.diaCalendario ? dia.diaCalendario : "",
            ].filter(Boolean).join(" · ");
            return `${etiquetaDia}: ${resolverTopicoDia(dia, idxEnFase, specFase, prot)}`;
          });
          onProgress(
            `✍️ ${semanaTxt} · Fase ${fase.numero}: ${fase.nombre} — escribiendo ${rango} de ${totalClases} · ${topicos.join(" | ")}`
          );
        }
      : null;

    let weekPlan;
    try {
      weekPlan = await generateWeekPlan(
        specFase, semanaGeneracion, durMin, numClases, numSemanas,
        memoriaAcumulada, progressWrapper,
      );
    } catch (err) {
      console.warn(`[UnidadIA] Fase ${fase.numero} semana ${semanaGeneracion}: usando base curricular por fallo IA.`, err);
      onProgress?.(
        `🧩 Semana ${semanaGeneracion}: la IA no completó esta fase; DocenteOS arma una base curricular desde la malla oficial para no dejarte sin planificación.`
      );
      weekPlan = construirWeekPlanBaseCurricular({
        fase,
        specActual: specFase,
        semanaGeneracion,
        motivo: err?.message || String(err || ""),
      });
    }
    productoFinalNombreActual = specFase.productoFinalNombre || weekPlan.productoFinalNombre || productoFinalNombreActual;

    weekPlan.clases.slice(0, numClases).forEach((aiClase, i) => {
      const dia = fase.dias[i];
      if (!dia) {
        throw new Error(`R3: clase IA ${i + 1} de la semana ${fase.numero} sin día calendario correspondiente`);
      }
      const anclaSecuencia = specFase.secuenciaBase?.[i] || null;

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
      dia.secuenciaPedagogica = anclaSecuencia?.secuenciaPedagogica || {
        tipo: "unidad_aprendizaje",
        faseNumero: fase.numero,
        faseNombre: fase.nombre,
      };
      dia.productoParcial = dia.secuenciaPedagogica.productoParcial || dia.aporteProducto;
      dia.evidenciaCentral = dia.secuenciaPedagogica.evidenciaCentral || "";
      dia.instrumentoSugeridoSecuencia = dia.secuenciaPedagogica.instrumentoSugerido || "";
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
        // Dato estructurado para el hilo pedagógico:
        // planificación → instrumentos → registro → evidencias. El texto
        // renderizado de arriba queda intacto para el template/PDF.
        orig.evidenciasDetalle = {
          conocimientos: (aiMom.evidencias?.conocimientos || []).map((e) => String(e).trim()).filter(Boolean),
          conocimiento: (aiMom.evidencias?.conocimientos || []).map((e) => String(e).trim()).filter(Boolean),
          desempeno: (aiMom.evidencias?.desempeno || []).map((e) => String(e).trim()).filter(Boolean),
          producto: (aiMom.evidencias?.producto || []).map((e) => String(e).trim()).filter(Boolean),
        };
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
    const codigosTrabajados = new Set(
      weekPlan.clases.flatMap((c) => (Array.isArray(c.indicadoresTrabajados) ? c.indicadoresTrabajados : []))
        .map(normCodigo).filter(Boolean)
    );
    // Cada indicador de la spec con su código IL-N corrido (posición global +1),
    // para que "Indicadores de avance" los muestre con código, como el registro.
    const conCodigoGlobal = (specFase.indicadores || []).map((ind, gi) => {
      const cod = String(ind.codigoOficial || ind.id || "").trim() || `IL-${gi + 1}`;
      return { cod, descripcion: ind.descripcion, codigoOficial: ind.codigoOficial, id: ind.id };
    });
    const indicadoresFase = conCodigoGlobal
      .filter((ind) => codigosTrabajados.has(normCodigo(ind.codigoOficial || ind.id)))
      .map((ind) => `${ind.cod} — ${ind.descripcion}`)
      .filter((s) => s.includes(" — ") && s.split(" — ")[1]);
    fase.indicadoresAvance = indicadoresFase.length
      ? indicadoresFase
      : conCodigoGlobal.slice(0, 4).map((ind) => `${ind.cod} — ${ind.descripcion}`).filter((s) => s.split(" — ")[1]);

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

  return { fases, productoFinalNombre: productoFinalNombreActual || "", advertenciasIA, combinacionesCreadas };
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
    indicadoresDebiles = [],
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
  const construirProductoBase = () => {
    const temaNorm = String(titulo || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const esIdioma = ES_IDIOMA(claveContenido) || ES_IDIOMA(asignaturaEf);
    if (esIdioma) {
      if (/people|persona|relaciones|social|famil|friend|amig|conviv|courtesy|cortesia|conversation|comunicacion/.test(temaNorm)) {
        return "People Around Me: Social Interaction Portfolio.";
      }
      if (/daily|routine|rutina|vida diaria|habito|schedule|horario/.test(temaNorm)) {
        return "My Daily Routine and Healthy Habits Portfolio.";
      }
      if (/house|home|casa|vivienda|entorno|city|ciudad|room|habitacion/.test(temaNorm)) {
        return "My Home and Community Tour Portfolio.";
      }
      return `My ${titulo || "Learning"} Portfolio.`;
    }
    return `Portafolio de evidencias aplicado a ${titulo || "la unidad"}.`;
  };
  const producto = productoFinalTexto || construirProductoBase();
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
  // v1.2 los trae PLANOS en payload.indicadoresLogro; v1.3 los trae ANIDADOS en
  // competencias[].indicadoresLogro. Sin este aplanado, el spec viaja sin
  // indicadores y la base curricular no puede asignar códigos por día (el
  // resumen semanal quedaba en "—" aunque el componente curricular sí los
  // mostraba, porque competenciasDetalle lee los anidados por su propia vía).
  const allIndsPlanos = Array.isArray(mallaPayload.indicadoresLogro) && mallaPayload.indicadoresLogro.length
    ? mallaPayload.indicadoresLogro
    : Array.isArray(mallaPayload.indicadores) && mallaPayload.indicadores.length
      ? mallaPayload.indicadores
      : [];
  const allInds = allIndsPlanos.length
    ? allIndsPlanos
    : allComps.flatMap((comp) =>
        (Array.isArray(comp.indicadoresLogro) ? comp.indicadoresLogro : (comp.indicadores || []))
          .map((ind) => (typeof ind === "string"
            ? { descripcion: ind, competenciaId: comp.id || comp.codigo || "" }
            : { ...ind, competenciaId: ind.competenciaId || comp.id || comp.codigo || "" })));

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
  if (temasOficiales.length && !temaMallaStr) {
    throw new Error(
      `El tema "${titulo}" no coincide con un tema oficial de la malla de ${claveContenido} — ${grado}. ` +
      `DocenteOS canceló la generación para evitar mezclar contenidos de otro tema. ` +
      `Selecciona un tema oficial desde el Asesor Pedagógico o corrige los temas de la malla en el Banco de Conocimiento.`
    );
  }

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

  const rutaCurricular = construirRutaCurricularUnidad({
    titulo,
    temaBase: temaMallaStr || titulo,
    temasSeleccionados,
    temasOficiales,
    numSemanas,
  });
  const contenidosRuta = _construirContenidosPorRuta({
    mallaPayload,
    curricularDoc,
    rutaCurricular,
  });
  const mallaContenidos = contenidosRuta.union;
  const advertencias = [];

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
    // La malla es la fuente oficial, pero el documento imprimible muestra SOLO
    // los contenidos activos de la ruta curricular seleccionada. Si se combinan
    // temas, la union de esos temas es la seleccion activa; el resto de la malla
    // queda como trazabilidad en matrizCurricularInterna.contenidosMalla.
    const vocab = textosUnicos(mallaContenidos.vocabulario || []);
    const gram  = textosUnicos(mallaContenidos.gramatica || []);
    const expr  = textosUnicos(mallaContenidos.expresiones || []);
    const conceptualesTema = textosUnicos([
      ...vocab.map((v) => `Vocabulario: ${v}`),
      ...gram.map((g) => `Gramática: ${g}`),
      ...expr.map((e) => `Expresión: ${e}`),
    ]);
    const procedimentalesTema = textosUnicos(mallaContenidos.funcionales || []);
    const actitudinalesTema = textosUnicos(mallaContenidos.actitudinales || []);
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
    // G3a — agrupación POR TEMA como el documento modelo (págs. 5-8): cada
    // tema con su Vocabulario, Gramática (ejemplos en cursiva), Funcionales,
    // Discursivos, Actitudes y Evidencias de aprendizaje. Las listas planas de
    // arriba se conservan para compatibilidad (validador y unidades guardadas).
    const porTema = (mallaContenidos.contenidosPorTemaResueltos || [])
      .filter((c) => c && (c.vocabulario?.length || c.gramatica?.length || c.funcionales?.length))
      .map((c) => ({
        tema: c.temaContenido || c.temaOficial || "",
        vocabulario: textosUnicos(c.vocabulario || []),
        gramaticaDetalle: Array.isArray(c.gramaticaDetalle) && c.gramaticaDetalle.length
          ? c.gramaticaDetalle
          : textosUnicos(c.gramatica || []).map((g) => ({ estructura: g, ejemplos: [] })),
        expresiones: textosUnicos(c.expresiones || []),
        funcionales: textosUnicos(c.funcionales || []),
        actitudinales: textosUnicos(c.actitudinales || []),
        evidenciasAprendizaje: textosUnicos(c.evidenciasAprendizaje || []),
      }));
    return {
      conceptuales,
      procedimentales,
      actitudinales,
      porTema,
      _seleccionPDF: true,
      _fuente: mallaContenidos.fuenteContenido || "contenidosPorTema",
      _temasActivos: textosUnicos(rutaCurricular.temas || mallaContenidos.temasContenido || []),
    };
  })();
  const contenidosMallaEstado = crearEstadoContenidosMalla({
    mallaPayload,
    contenidosActivos: {
      ...mallaContenidos,
      conceptuales: contenidos.conceptuales,
      procedimentales: contenidos.procedimentales,
      actitudinales: contenidos.actitudinales,
    },
    temasActivos: rutaCurricular.temas,
  });

  const { fases: fasesSemanalesGeneradas, productoFinalNombre, advertenciasIA = [], combinacionesCreadas = [] } = await _generarFasesConIA(
    numSemanas, schedule, claveContenido, titulo, estrategiaFinal, producto,
    {
      grado, nivel,
      contextoComunitario,
      // Si el docente escribió su propio producto, ese nombre MANDA y la IA
      // no propone otro; el nombre generado solo sustituye el genérico.
      productoPropio: productoFinalTexto ? producto : "",
      // Indicadores de unidades anteriores: alimentan el marcado ~~tachado~~
      // del prompt y la lista de permitidos del validador (R1)
      indicadoresTrabajadosAntes,
      // Fase 9 — logro real bajo el umbral: marcado (REFORZAR) en el prompt
      indicadoresDebiles,
    },
    mallaContenidos,
    mallaPayload, allInds, allComps, durMinEf, grado,
    rutaCurricular,
    contenidosRuta,
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
  const especificacionCurricularUnidad = buildEspecificacionCurricular({
    mallaPayload, titulo: rutaCurricular.temas.join(" · ") || titulo, allInds, allComps, mallaContenidos, area: claveContenido, grado,
  });

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
      temasIntegrados: rutaCurricular.temas,
      rutaCurricular,
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
      rutaCurricular,
      indicadoresTrabajadosUnidad: Array.from(indicadoresActuales),
      indicadoresTrabajadosAntes: Array.from(indicadoresPrevios),
      indicadoresPrecargadosTema: (especificacionCurricularUnidad.indicadoresTrabajo || []).map((ind) => ind.codigoOficial || ind.id || ind.codigo).filter(Boolean),
      fuenteIndicadoresPrecargados: especificacionCurricularUnidad.indicadoresTrabajoFuente || '',
      competencias: competenciasDetalleEnriquecidas,
      contenidosMalla: contenidosMallaEstado,
      contenidosSeleccionadosPDF: {
        conceptuales: contenidos.conceptuales,
        procedimentales: contenidos.procedimentales,
        actitudinales: contenidos.actitudinales,
      },
      progresionCurricular: modeloCurricularSuperior.progresion || [],
      arquitecturaCurricular: especificacionCurricularUnidad.arquitecturaCurricular || null,
    },
    contenidos,
    fasesSemanales: fasesSemanalesGeneradas,
    // Actividades que el COMBINADOR creó sin IA (mecánica probada + estructura
    // del día). Se cosechan como `cosechada` al guardar con opt-in, para que el
    // dueño las valide y el banco crezca con su propio material.
    combinacionesCreadas,
    especificacionCurricular: especificacionCurricularUnidad,
    // Trazabilidad: la malla EXACTA que produjo esta unidad. Ancla obligatoria
    // para la cosecha del Banco de Aprendizaje (verificarRefsContraMalla exige
    // igualdad de id/contentId contra la malla activa al servir).
    mallaRef: {
      id: curricularDoc.id || "",
      contentId: curricularDoc.contentId || mallaPayload.contentId || "",
      schemaVersion: versionMalla,
    },
    // Avisos de cobertura (ej. tema sin Capa 2) y de composición IA. Si un
    // proveedor falla, la unidad sigue entregándose con base curricular.
    advertencias: [...advertencias, ...advertenciasIA],
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
    nivel,
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
    .cont-table td { font-size: 10.5pt; }
    .cont-table .cont-list { font-size: 10.5pt; padding: 2px 4px 4px 16px; }
    .cont-sub { font-weight: bold; margin: 5px 0 1px; font-size: 10.5pt; }
    .cont-tema { margin-bottom: 3px; font-size: 10.5pt; }
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

      // El "apartado a trabajar" del día (estructura gramatical / foco lingüístico)
      // se muestra ETIQUETADO y destacado en el encabezado, como el documento
      // modelo: 'Día 4: "School and Family Routines" (Estructura gramatical:
      // WH-questions + tercera persona…)'. En Semana 1 el foco es la apropiación
      // de la unidad, no una estructura; ahí se muestra sin la etiqueta gramatical.
      const foco = dia.focoLinguistico || "";
      const esApropiacion = /apropiaci[oó]n|producto|evaluaci[oó]n/i.test(foco) && !/\(/.test(foco);
      // G4 — etiqueta fiel al protagonista del día: si el foco ya viene
      // etiquetado ("Expresión: Cortesía", "Integración: X · Y"), se usa ESA
      // etiqueta; "Estructura gramatical" solo cuando de verdad es gramática.
      const focoEtiquetado = foco.match(/^(Expresión|Integración|Foco)\s*:\s*(.*)$/s);
      const etiquetaFoco = focoEtiquetado
        ? focoEtiquetado[1]
        : ES_IDIOMA(m.asignatura || m.area) ? "Estructura gramatical" : "Foco curricular";
      const focoTexto = focoEtiquetado ? focoEtiquetado[2] : foco;
      const focoHtml = foco
        ? (esApropiacion
          ? ` <span style="font-weight:400">· ${foco}</span>`
          : ` <span style="font-weight:600;font-size:11pt">(${etiquetaFoco}: ${focoTexto})</span>`)
        : "";
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

    // RESUMEN SEMANAL (documento modelo): tabla al CIERRE de cada semana
    // calendario, compuesta determinísticamente de los días de esa semana.
    // La última semana de la fase carga además las observaciones (R14).
    const resumenSemanaHtml = (g, esUltimaDeFase) => {
      const dias = g.dias || [];
      const unicos = (arr) => [...new Set(arr.filter(Boolean))];
      const indicadores = unicos(dias.flatMap((d) => d.indicadoresTrabajados || []));
      const tipos = unicos(dias.flatMap((d) => (d.momentos || []).map((mm) => mm.evaluacion?.tipo)));
      const tecnicas = unicos(dias.flatMap((d) => (d.momentos || []).map((mm) => mm.evaluacion?.tecnica)));
      const instrumentos = unicos(dias.flatMap((d) => (d.momentos || []).map((mm) => mm.evaluacion?.instrumento)));
      const aportes = dias.map((d) => String(d.aporteProducto || "").trim()).filter(Boolean);
      if (!tipos.length && !indicadores.length) return ""; // unidad legacy sin datos por semana
      const obs = esUltimaDeFase
        ? String(fase.observacionesSemana || dias[0]?.resumenEvaluacion?.observaciones || "").trim()
        : "";
      return `
      <div class="section-head" style="background:#0e7490">RESUMEN DE EVALUACIÓN — SEMANA ${g.semana}</div>
      <table class="checkpoint-table">
        <tr><th style="width:20%">Indicadores trabajados</th><th style="width:16%">Tipos de evaluación</th><th style="width:22%">Técnicas</th><th style="width:18%">Instrumentos</th><th>Aportes al producto final</th></tr>
        <tr>
          <td>${indicadores.join(", ") || "—"}</td>
          <td>${tipos.join(", ") || "—"}</td>
          <td>${tecnicas.join("; ") || "—"}</td>
          <td>${instrumentos.join(", ") || "—"}</td>
          <td>${aportes.map((a) => `• ${a}`).join("<br>") || "—"}</td>
        </tr>
        ${obs ? `<tr><td colspan="5"><strong>Observaciones de la semana:</strong> ${obs}</td></tr>` : ""}
      </table>`;
    };
    const resumenesSemanas = gruposSemana.map((g, i) => resumenSemanaHtml(g, i === gruposSemana.length - 1));
    const hayResumenSemanal = resumenesSemanas.some(Boolean);

    // Banda por semana calendario dentro de la fase, con el título de semana
    // que aportó la IA (o el de la fase para unidades guardadas legacy)
    const diasHtml = gruposSemana.map((g, i) => {
      const tituloSem = String(g.dias[0]?.tituloSemana || fase.tituloSemana || "").trim();
      const banda = `<div class="semana-band">${m.titulo} — SEMANA ${g.semana} (${g.dias.length} día${g.dias.length === 1 ? "" : "s"})${tituloSem ? `: "${tituloSem}"` : ""}</div>`;
      return banda + g.dias.map(diaHtml).join("") + resumenesSemanas[i];
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

    // RESUMEN por fase: SOLO para unidades legacy sin datos por semana (las
    // nuevas emiten la tabla al cierre de cada semana calendario, arriba).
    const resEv = fase.dias[0]?.resumenEvaluacion;
    const obsSemana = String(fase.observacionesSemana || resEv?.observaciones || "").trim();
    const resumenHtml = (!hayResumenSemanal && (resEv || obsSemana)) ? `
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
      // Formato por estado del indicador (regla del documento modelo del dueño):
      //  · del TEMA a trabajar → NEGRITA completa (código + descripción)
      //  · YA trabajado antes  → TACHADO (constancia de lo cubierto)
      //  · no aplica           → texto NORMAL (código incluido, sin negrita)
      // La tabla siempre muestra los 21; solo cambia el formato de cada uno.
      const indicadorHtml = (ind) => {
        if (typeof ind === 'string') return ind;
        const estilo = [
          ind?.aplicaTemaActual ? 'font-weight:700' : '',
          ind?.trabajadoAntes ? 'text-decoration:line-through;opacity:.72' : '',
        ].filter(Boolean).join(';');
        const abrir = estilo ? `<span style="${estilo}">` : '';
        const cerrar = estilo ? '</span>' : '';
        // El código va en <strong> SOLO cuando el indicador es del tema; si no
        // aplica (ni trabaja ahora ni antes) va completamente en texto normal.
        const cod = ind?.codigo
          ? (ind?.aplicaTemaActual ? `<strong>${ind.codigo}</strong> — ` : `${ind.codigo} — `)
          : '';
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
  ${(() => {
    // G3a — agrupación POR TEMA (documento modelo, págs. 5-8): 4 columnas
    // (Conceptos / Procedimientos / Actitudes y valores / Evidencias de
    // aprendizaje), cada tema como bloque con sus subtítulos y la gramática
    // con ejemplos oficiales en cursiva. Fallback: columnas planas legacy
    // para unidades guardadas sin porTema.
    const grupos = unidad.contenidos?.porTema || [];
    if (!grupos.length) {
      return `<div class="contenidos">
    <div class="cont-col"><div class="cont-head">Conceptuales</div><ul class="cont-list">${(unidad.contenidos?.conceptuales || []).map((c) => {
        const m = String(c).match(/^(Vocabulario|Gramática|Expresión):\s*(.*)$/s);
        return m ? `<li><strong>${m[1]}:</strong> ${m[2]}</li>` : `<li>${c}</li>`;
      }).join("")}</ul></div>
    <div class="cont-col"><div class="cont-head">Procedimentales</div><ul class="cont-list">${(unidad.contenidos?.procedimentales || []).map((c) => {
        const m = String(c).match(/^(Funcional|Discursivo):\s*(.*)$/s);
        return m ? `<li><strong>${m[1]}:</strong> ${m[2]}</li>` : `<li>${c}</li>`;
      }).join("")}</ul></div>
    <div class="cont-col"><div class="cont-head">Actitudinales</div><ul class="cont-list">${(unidad.contenidos?.actitudinales || []).map((c) => `<li>${c}</li>`).join("")}</ul></div>
  </div>`;
    }
    const li = (t) => `<li>${t}</li>`;
    const separarProcedimientos = (funcionales = []) => {
      const func = [], disc = [], otros = [];
      for (const f of funcionales) {
        const m = String(f).match(/^(Funcional|Discursivo):\s*(.*)$/s);
        if (!m) { otros.push(f); continue; }
        (m[1] === "Funcional" ? func : disc).push(m[2]);
      }
      return { func, disc, otros };
    };
    const conceptosTema = (g) => [
      g.vocabulario.length ? `<div class="cont-sub">Vocabulario</div><ul class="cont-list">${g.vocabulario.map(li).join("")}</ul>` : "",
      g.gramaticaDetalle.length ? `<div class="cont-sub">Gramática</div><ul class="cont-list">${g.gramaticaDetalle.map((gd) =>
        `<li>${gd.estructura}${gd.ejemplos.length ? ` <em>(${gd.ejemplos.join(" ")})</em>` : ""}</li>`).join("")}</ul>` : "",
      g.expresiones.length ? `<div class="cont-sub">Sociolingüísticos y socioculturales</div><ul class="cont-list">${g.expresiones.map(li).join("")}</ul>` : "",
    ].filter(Boolean).join("");
    const procedimientosTema = (g) => {
      const { func, disc, otros } = separarProcedimientos(g.funcionales);
      return [
        func.length ? `<div class="cont-sub">Funcionales</div><ul class="cont-list">${func.map(li).join("")}</ul>` : "",
        disc.length ? `<div class="cont-sub">Discursivos</div><ul class="cont-list">${disc.map(li).join("")}</ul>` : "",
        otros.length ? `<ul class="cont-list">${otros.map(li).join("")}</ul>` : "",
      ].filter(Boolean).join("");
    };
    // Evidencias de aprendizaje: por tema si la malla las trae; si no, la
    // lista de actitudes globales de la unidad (como el documento modelo, que
    // las presenta en una sola celda para toda la tabla).
    const evidenciasGlobales = textosUnicos(grupos.flatMap((g) => g.evidenciasAprendizaje || []));
    const evidenciasCol = evidenciasGlobales.length ? evidenciasGlobales : (unidad.contenidos?.actitudinales || []);
    const filas = grupos.map((g, i) => `
      <tr>
        <td style="width:27%;vertical-align:top"><div class="cont-tema"><strong>Temas</strong><br><strong>${g.tema}</strong></div>${conceptosTema(g)}</td>
        <td style="width:27%;vertical-align:top"><div class="cont-tema"><strong>${g.tema}</strong></div>${procedimientosTema(g)}</td>
        <td style="width:26%;vertical-align:top"><div class="cont-tema"><strong>${g.tema}</strong></div><ul class="cont-list">${(g.actitudinales || []).map(li).join("")}</ul></td>
        ${i === 0 ? `<td style="width:20%;vertical-align:top" rowspan="${grupos.length}"><ul class="cont-list">${evidenciasCol.map(li).join("")}</ul></td>` : ""}
      </tr>`).join("");
    return `<table class="checkpoint-table cont-table">
      <tr><th style="width:27%">Conceptos</th><th style="width:27%">Procedimientos</th><th style="width:26%">Actitudes y valores</th><th>Evidencias de aprendizaje</th></tr>
      ${filas}
    </table>`;
  })()}

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
