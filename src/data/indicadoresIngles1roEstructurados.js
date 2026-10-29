/**
 * indicadoresIngles1roEstructurados — Los 21 indicadores de logro de Inglés 1ro
 * de Secundaria partidos en tronco / aspectos / cierre (misma estructura que
 * indicadoresIngles2doEstructurados.js, regla 4.3).
 * Fuente: Adecuación Curricular Nivel Secundario (MINERD, 2023),
 * transcrita en src/data/curriculo/curriculo-lenguas-extranjeras-secundaria-2023.json.
 *
 * Segmentación PROPUESTA por DocenteOS, pendiente de la aprobación de César.
 * - `enlaces` guarda la puntuación LITERAL entre aspectos.
 * - Indicadores sin lista de aspectos: todo el texto en `tronco`, `listas: []`.
 * - `accion` sale de la posición en la tríada de la competencia
 *   (1.º responde · 2.º produce · 3.º interactúa), aunque el verbo sea otro.
 * - ING-1-I21: el " 138" final de la fuente es el número de página y no se copia.
 *
 * Módulo PURO. Lo consume vistaPreviaPlanMaestroService.js.
 * Verificación: scripts/test-datos-oficiales.mjs
 */

export const FUENTE_INDICADORES_INGLES_1RO = "Adecuación Curricular Nivel Secundario (MINERD, 2023)";

const completo = (id, competenciaId, accion, texto) => ({
  id, competenciaId, accion, tronco: texto, listas: [], entre: [], cierre: "",
});

export const INDICADORES_INGLES_1RO_ESTRUCTURADOS = [
  {
    id: "ING-1-I01", competenciaId: "ING-1-C01", accion: "responde",
    tronco: "Responde de forma adecuada a preguntas e indicaciones, a partir de la escucha o lectura de textos claros, breves y sencillos, donde se describen ",
    listas: [{
      aspectos: ["el entorno inmediato", "información personal propia y de otras personas", "actividades cotidianas", "preferencias personales"],
      enlaces: [", ", ", ", " y "],
    }],
    entre: [],
    cierre: ".",
  },
  {
    id: "ING-1-I02", competenciaId: "ING-1-C01", accion: "produce",
    tronco: "Se expresa en inglés mediante una serie de frases y oraciones breves y sencillas enlazadas por conectores comunes para compartir ",
    listas: [
      { aspectos: ["información", "puntos de vista", "ideas"], enlaces: [", ", " e "] },
      { aspectos: ["entorno próximo", "actividades cotidianas"], enlaces: [" y "] },
    ],
    entre: [" referentes al "],
    cierre: ", aunque con pausas y reformulaciones en lo oral y con posibles errores básicos en lo escrito.",
  },
  {
    id: "ING-1-I03", competenciaId: "ING-1-C01", accion: "interactua",
    tronco: "Interactúa de forma oral y escrita utilizando una serie de frases y oraciones breves y sencillas y con diversidad de vocabulario básico referente a ",
    listas: [{
      aspectos: ["información personal", "actividades cotidianas", "el entorno inmediato"],
      enlaces: [", ", " y "],
    }],
    entre: [],
    cierre: ", pero con suficiente claridad para ser comprendido con un poco de esfuerzo.",
  },
  completo("ING-1-I04", "ING-1-C02", "responde",
    "Responde a preguntas e indicaciones utilizando el pensamiento lógico verbal, creativo y crítico para comprender la información contenida en mensajes orales y escritos referentes a necesidades concretas y temas cotidianos."),
  completo("ING-1-I05", "ING-1-C02", "produce",
    "Se expresa en inglés a través de frases y oraciones con creatividad y mediante una estructura lógica básica, enlazadas por conectores comunes, con pausas y reformulaciones en lo oral y con posibles errores básicos en lo escrito."),
  completo("ING-1-I06", "ING-1-C02", "interactua",
    "Interactúa de forma oral y escrita siguiendo la lógica de la interacción y el contexto inmediato, expresándose mediante frases y oraciones breves y sencillas con creatividad y pensamiento reflexivo."),
  {
    id: "ING-1-I07", competenciaId: "ING-1-C03", accion: "responde",
    tronco: "Responde acorde a preguntas e indicaciones a partir de información sencilla contenida en textos orales o escritos sobre situaciones y problemas ",
    listas: [{
      aspectos: ["cotidianos", "del entorno próximo"],
      enlaces: [" o "],
    }],
    entre: [],
    cierre: ".",
  },
  {
    id: "ING-1-I08", competenciaId: "ING-1-C03", accion: "produce",
    tronco: "Se expresa de forma oral y escrita, utilizando expresiones breves y sencillas para describir de forma clara: ",
    listas: [{
      aspectos: ["ideas", "elementos", "personas", "acciones"],
      enlaces: [", ", ", ", " y "],
    }],
    entre: [],
    cierre: " relativas a problemas o situaciones de su entorno inmediato.",
  },
  {
    id: "ING-1-I09", competenciaId: "ING-1-C03", accion: "interactua",
    tronco: "Interactúa en intercambios comunicativos breves y sencillos, identificando problemas y situaciones variadas de ",
    listas: [{
      aspectos: ["sus actividades cotidianas", "su entorno inmediato"],
      enlaces: [" y de "],
    }],
    entre: [],
    cierre: ", planteando opciones justas para enfrentar la situación, con expresiones breves y sencillas.",
  },
  completo("ING-1-I10", "ING-1-C04", "responde",
    "Participa de forma activa, con escucha atenta y respetuosa en las interacciones formativas e informativas que realiza, identificando aspectos de la identidad social y cultural propia y de otros países, con actitud de aceptación y asertividad."),
  completo("ING-1-I11", "ING-1-C04", "produce",
    "Expresa preferencias y puntos de vista de forma oral o escrita, con actitud y conducta respetuosa, cortés y asertiva, teniendo en cuenta las diferencias individuales y la cultura propia y de otras personas."),
  {
    id: "ING-1-I12", competenciaId: "ING-1-C04", accion: "interactua",
    tronco: "Interactúa en un plano de cortesía, asertividad y respeto tomando en cuenta las diferencias individuales y la identidad social y cultural propia y de otras personas relativas a ",
    listas: [{
      aspectos: ["rasgos físicos", "formas de interactuar", "preferencias", "puntualidad", "celebraciones", "clima"],
      enlaces: [", ", ", ", ", ", ", ", " y "],
    }],
    entre: [],
    cierre: ".",
  },
  completo("ING-1-I13", "ING-1-C05", "responde",
    "Responde de forma adecuada a preguntas e indicaciones a partir de la escucha o lectura de textos breves y de vocabulario y expresiones básicas y sencillas sobre asuntos científicos y tecnológicos compartidos de forma presencial o virtual."),
  {
    id: "ING-1-I14", competenciaId: "ING-1-C05", accion: "produce",
    tronco: "Identifica y describe aspectos científicos y tecnológicos relativos a sus actividades cotidianas y entorno inmediato, tales como ",
    listas: [{
      aspectos: ["anatomía de las personas", "elementos tecnológicos y de la naturaleza"],
      enlaces: [" y "],
    }],
    entre: [],
    cierre: " utilizando frases y oraciones breves y sencillas orales y escritas.",
  },
  {
    id: "ING-1-I15", competenciaId: "ING-1-C05", accion: "interactua",
    tronco: "Interactúa en forma oral o escrita por diferentes medios físicos y electrónicos, para intercambiar información, ideas y opiniones sobre ",
    listas: [{
      aspectos: ["aspectos científicos y tecnológicos del entorno inmediato", "actividades cotidianas", "la descripción de las personas"],
      enlaces: [", ", " y "],
    }],
    entre: [],
    cierre: ".",
  },
  {
    id: "ING-1-I16", competenciaId: "ING-1-C06", accion: "responde",
    tronco: "Responde de forma favorable a la preservación del medio ambiente y la salud ante preguntas e indicaciones sobre información de ",
    listas: [{
      aspectos: ["las personas", "el entorno", "sus actividades cotidianas"],
      enlaces: [", ", " y "],
    }],
    entre: [],
    cierre: ".",
  },
  completo("ING-1-I17", "ING-1-C06", "produce",
    "Ofrece información, opiniones e instrucciones sobre acciones que impactan positivamente el medio ambiente y la salud."),
  {
    id: "ING-1-I18", competenciaId: "ING-1-C06", accion: "interactua",
    tronco: "Interactúa para compartir información ",
    listas: [{
      aspectos: ["personal", "de su entorno inmediato", "de actividades cotidianas"],
      enlaces: [", ", " y "],
    }],
    entre: [],
    cierre: ", mostrando preferencia por aquellas que impactan positivamente la salud y el medioambiente.",
  },
  {
    id: "ING-1-I19", competenciaId: "ING-1-C07", accion: "responde",
    tronco: "Identifica respetuosamente a las personas por su apariencia y forma de ser, preferencias sobre ",
    listas: [{
      aspectos: ["actividades cotidianas", "lugares"],
      enlaces: [" y "],
    }],
    entre: [],
    cierre: ", en un plano de cortesía, aceptación y asertividad ante sí mismo y los demás.",
  },
  {
    id: "ING-1-I20", competenciaId: "ING-1-C07", accion: "produce",
    tronco: "Comparte información sobre su identidad personal y preferencias sobre ",
    listas: [{
      aspectos: ["lugares", "actividades cotidianas"],
      enlaces: [" y "],
    }],
    entre: [],
    cierre: " con humildad, cortesía, asertividad y respeto.",
  },
  completo("ING-1-I21", "ING-1-C07", "interactua",
    "Interactúa con cortesía asertividad y respeto, en intercambios orales y escritos de información, opiniones e instrucciones."),
];
