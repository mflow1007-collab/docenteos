/**
 * indicadoresIngles2doEstructurados — Los 21 indicadores de logro de Inglés 2do
 * de Secundaria partidos en tronco / aspectos / cierre (Etapa 1 de
 * docs/DISENO_CORAZON_DOCENTEOS.md, regla 4.3).
 * Fuente: Adecuación Curricular Nivel Secundario (MINERD, 2023), pp. 139-144,
 * transcrita en src/data/curriculo/curriculo-lenguas-extranjeras-secundaria-2023.json.
 *
 * Texto completo = tronco + lista 1 (aspectos unidos por sus enlaces) + entre[0]
 *                  + lista 2 … + cierre.
 * - `enlaces` guarda la puntuación LITERAL entre aspectos (el original no es
 *   regular: I01 e I06 llevan ", y").
 * - Indicadores sin lista de aspectos: todo el texto en `tronco`, `listas: []`.
 * - `accion` sale de la posición en la tríada de la competencia
 *   (1.º responde · 2.º produce · 3.º interactúa), aunque el verbo sea otro.
 * - ING-2-I21: el " 144" final de la fuente es el número de página y no se copia.
 *
 * Módulo PURO. Todavía no lo consume nada.
 * Verificación: scripts/test-datos-oficiales.mjs
 */

export const FUENTE_INDICADORES_INGLES_2DO = "Adecuación Curricular Nivel Secundario (MINERD, 2023), pp. 139-144";

const completo = (id, competenciaId, accion, texto) => ({
  id, competenciaId, accion, tronco: texto, listas: [], entre: [], cierre: "",
});

export const INDICADORES_INGLES_2DO_ESTRUCTURADOS = [
  {
    id: "ING-2-I01", competenciaId: "ING-2-C01", accion: "responde",
    tronco: "Responde de forma adecuada a preguntas e indicaciones, a partir de la escucha o lectura de textos breves y sencillos que contienen información sobre ",
    listas: [{
      aspectos: ["su entorno inmediato", "actividades cotidianas", "estados de salud", "sentimientos", "intereses", "consejos", "planes", "sugerencias", "narraciones de experiencias"],
      enlaces: [", ", ", ", ", ", ", ", ", ", ", ", ", ", ", y "],
    }],
    entre: [],
    cierre: ".",
  },
  {
    id: "ING-2-I02", competenciaId: "ING-2-C01", accion: "produce",
    tronco: "Produce textos breves y sencillos mediante una serie de frases y oraciones enlazadas por conectores básicos para compartir informaciones personales y de su entorno inmediato, tales como ",
    listas: [{
      aspectos: ["experiencias", "estados de salud", "sentimientos", "planes", "consejos", "sugerencias"],
      enlaces: [", ", ", ", ", ", ", ", " y "],
    }],
    entre: [],
    cierre: ", con pausas y reformulaciones en lo oral y con algunos errores básicos en lo escrito.",
  },
  {
    id: "ING-2-I03", competenciaId: "ING-2-C01", accion: "interactua",
    tronco: "Interactúa en forma oral o escrita a través de una serie de frases y oraciones sencillas, enlazadas por conectores, con el propósito de ",
    listas: [{
      aspectos: ["informar sobre actividades cotidianas", "describir estados anímicos y físicos", "solicitar ayuda", "comprar", "expresar deseo o interés", "dar consejos y sugerencias", "expresar planes", "narrar experiencias"],
      enlaces: [", ", ", ", ", ", ", ", ", ", ", ", " y "],
    }],
    entre: [],
    cierre: ", aunque con algunos errores básicos.",
  },
  {
    id: "ING-2-I04", competenciaId: "ING-2-C02", accion: "responde",
    tronco: "Responde de forma adecuada a preguntas e indicaciones, a partir de textos orales y escritos breves y sencillos donde se presenta información variada y sugerencias sobre situaciones ",
    listas: [{
      aspectos: ["presentes", "futuras", "pasadas"],
      enlaces: [", ", " y "],
    }],
    entre: [],
    cierre: ", comprendiendo de forma reflexiva y creativa la secuencia y relación lógica de los elementos.",
  },
  completo("ING-2-I05", "ING-2-C02", "produce",
    "Produce textos orales y escritos breves y sencillos con claridad y creatividad, manteniendo una secuencia clara y ordenada de las ideas, mediante el uso de conectores lógicos básicos apropiados a la relación específica de las ideas, al tema y la situación."),
  {
    id: "ING-2-I06", competenciaId: "ING-2-C02", accion: "interactua",
    tronco: "Interactúa en forma oral o escrita a través de una serie de oraciones breves y sencillas ordenadas de una forma lógica y presentadas de forma creativa en diferentes tipos de texto donde comparte ",
    listas: [{
      aspectos: ["experiencias", "información", "planes", "sugerencias", "consejos"],
      enlaces: [", ", ", ", ", ", ", y "],
    }],
    entre: [],
    cierre: ".",
  },
  completo("ING-2-I07", "ING-2-C03", "responde",
    "Responde de forma adecuada a preguntas e indicaciones sobre situaciones y problemas de su entorno inmediato y temas que le son familiares, a partir de textos orales y escritos breves y sencillos."),
  {
    id: "ING-2-I08", competenciaId: "ING-2-C03", accion: "produce",
    tronco: "Se comunica mediante textos orales y escritos de forma clara y comprensible, para comunicar problemas inmediatos ",
    listas: [{
      aspectos: ["propios", "de otras personas", "del entorno cotidiano"],
      enlaces: [", ", " y "],
    }],
    entre: [],
    cierre: ", así como para proponer consejos y sugerencias pertinentes, utilizando frases y oraciones breves y sencillas.",
  },
  {
    id: "ING-2-I09", competenciaId: "ING-2-C03", accion: "interactua",
    tronco: "Interactúa de forma oral y escrita para solicitar o proveer ",
    listas: [
      {
        aspectos: ["información", "ayuda", "consejos", "sugerencias"],
        enlaces: [", ", ", ", " y "],
      },
      {
        aspectos: ["actividades cotidianas", "intereses", "estados de ánimo"],
        enlaces: [", ", " y "],
      },
    ],
    entre: [" sobre situaciones y problemas relativos a "],
    cierre: ", utilizando con claridad frases y oraciones breves y sencillas.",
  },
  {
    id: "ING-2-I10", competenciaId: "ING-2-C04", accion: "responde",
    tronco: "Reconoce las diferencias individuales y la identidad social y cultural propia y de otros países como ",
    listas: [{
      aspectos: ["gestos", "compras", "celebraciones", "actividades de tiempo libre", "puntualidad", "lugares de interés"],
      enlaces: [", ", ", ", ", ", ", ", " y "],
    }],
    entre: [],
    cierre: ".",
  },
  completo("ING-2-I11", "ING-2-C04", "produce",
    "Interactúa de forma breve y sencilla en el idioma inglés, con cortesía, asertividad y respeto."),
  completo("ING-2-I12", "ING-2-C04", "interactua",
    "Sostiene la conversación al interactuar en forma oral o escrita, utilizando frases y oraciones estratégicas para mantener la interacción de forma cortés y respetuosa a las diferencias de la cultura personal y de otras personas."),
  {
    id: "ING-2-I13", competenciaId: "ING-2-C05", accion: "responde",
    tronco: "Identifica información y la utiliza de forma adecuada para responder a preguntas e indicaciones sobre aspectos científicos y tecnológicos presentes en la descripción de ",
    listas: [{
      aspectos: ["actividades cotidianas", "experiencias", "sentimientos", "dolencias"],
      enlaces: [", ", ", ", " y "],
    }],
    entre: [],
    cierre: " propias y de otras personas.",
  },
  {
    id: "ING-2-I14", competenciaId: "ING-2-C05", accion: "produce",
    tronco: "Expresa ideas y sugerencias sobre aspectos de temas científicos, tecnológicos y de otra índole presentes en su entorno inmediato de interés personal para referirse a ",
    listas: [{
      aspectos: ["la salud", "estados de ánimo", "deseos", "experiencias pasadas"],
      enlaces: [", ", ", ", " y "],
    }],
    entre: [],
    cierre: ", utilizando oraciones comunes breves y sencillas.",
  },
  completo("ING-2-I15", "ING-2-C05", "interactua",
    "Interactúa sobre temas científicos, tecnológicos y de otra índole con el propósito de pedir y dar consejos y sugerencias, de forma presencial o virtual, utilizando vocabulario común con frases y oraciones breves y sencillas."),
  completo("ING-2-I16", "ING-2-C06", "responde",
    "Identifica las acciones que impactan positivamente la salud y el medio ambiente en las actividades cotidianas que se realizan en su entorno inmediato."),
  {
    id: "ING-2-I17", competenciaId: "ING-2-C06", accion: "produce",
    tronco: "Describe información del estado de su entorno inmediato, presentando consejos, sugerencias y planes para cuidar ",
    listas: [{
      aspectos: ["el medioambiente", "la salud propia y de otras personas"],
      enlaces: [", "],
    }],
    entre: [],
    cierre: ".",
  },
  completo("ING-2-I18", "ING-2-C06", "interactua",
    "Interactúa de forma adecuada en situaciones donde se promueve prácticas de hábitos saludables para las personas y amigables con el medioambiente."),
  completo("ING-2-I19", "ING-2-C07", "responde",
    "Muestra empatía por los sentimientos y necesidades de las demás personas."),
  completo("ING-2-I20", "ING-2-C07", "produce",
    "Muestra disposición para ayudar a las demás personas que lo necesitan, al interactuar con sus compañeros de forma colaborativa."),
  completo("ING-2-I21", "ING-2-C07", "interactua",
    "Interactúa con cortesía, respeto y asertividad al referirse a sí mismo y a otras personas."),
];

// Texto completo del indicador, tal como está en la malla oficial.
export const recomponerIndicador = ({ tronco, listas, entre, cierre }) =>
  tronco
  + listas.map((lista, i) =>
    lista.aspectos.map((a, j) => a + (lista.enlaces[j] ?? "")).join("") + (entre[i] ?? "")
  ).join("")
  + cierre;
