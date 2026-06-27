/**
 * seedData — Datos iniciales del Knowledge Engine.
 *
 * Topics pedagógicos para Inglés (Lenguas Extranjeras) y
 * memorias iniciales para el Auditor Pedagógico.
 *
 * Ejecutar una sola vez desde el panel admin → Entrenamiento IA → "Sembrar datos".
 * No correr en producción si los datos ya existen.
 */

import { db } from "../../../firebase.js";
import { getAuth } from "firebase/auth";
import { collection, addDoc, serverTimestamp, getDocs, limit, query } from "firebase/firestore";
import { COLLECTIONS, STATES, MEMORY_TYPES, MEMORY_SOURCES } from "./KnowledgeTypes.js";

// ── Topics iniciales ───────────────────────────────────────────────────────────

const TOPICS_SEED = [
  {
    temaNormalizado:       "sport",
    area:                  "Lenguas Extranjeras",
    asignatura:            "Inglés",
    grado:                 null,
    reglas: [
      "Incluir los tres verbos de deporte: Play (deportes con pelota), Do (artes marciales/gimnasia), Go (deportes con -ing)",
      "Trabajar Can/Can't para expresar habilidades deportivas",
      "Incluir likes + ing para expresar preferencias",
      "Contextualizar con deportes conocidos en República Dominicana (béisbol, fútbol, baloncesto)",
    ],
    vocabulario: [
      "soccer", "basketball", "baseball", "volleyball", "tennis",
      "swimming", "running", "gym", "team", "score", "win", "lose", "practice",
    ],
    gramatica: [
      "Can / Can't",
      "Play / Do / Go + deporte",
      "like + verb-ing",
      "Simple Present (I play, she plays)",
    ],
    funcionesComunicativas: [
      "Invitar a alguien a jugar",
      "Expresar habilidades (I can swim / I can't play tennis)",
      "Hablar de preferencias deportivas",
      "Preguntar y responder sobre deportes favoritos",
    ],
    pronunciacion: "Énfasis en /s/ inicial (sport, swimming, soccer). Diferenciar /p/ de play vs /b/ de ball.",
    ejemplosActividades: [
      "Ruleta de deportes: estudiantes preguntan '¿Can you...?' y responden con Can/Can't",
      "Clasificación de deportes en columnas Play/Do/Go",
      "Diálogo breve: invitar a un compañero a jugar béisbol este fin de semana",
    ],
    productosSugeridos: [
      "Cartel de deportes favoritos del salón",
      "Diálogo grabado en video invitando a jugar",
      "Encuesta escrita: ¿Qué deporte practican tus compañeros?",
    ],
  },
  {
    temaNormalizado:       "food_and_drinks",
    area:                  "Lenguas Extranjeras",
    asignatura:            "Inglés",
    grado:                 null,
    reglas: [
      "Incluir vocabulario de comida dominicana además de internacional (mangú, habichuela, tostones)",
      "Trabajar There is / There are con alimentos en la nevera o tienda",
      "Incluir expresiones de cantidad: some, any, a lot of, a few",
      "Usar Would you like...? para ofrecer y pedir comida educadamente",
    ],
    vocabulario: [
      "rice", "beans", "chicken", "plantain", "juice", "water", "bread",
      "fruit", "vegetables", "milk", "egg", "fish", "soup", "salad",
      "breakfast", "lunch", "dinner", "hungry", "thirsty", "delicious",
    ],
    gramatica: [
      "There is / There are",
      "Some / Any / A lot of",
      "Would you like...? / Yes, please / No, thank you",
      "How much / How many",
      "Simple Present (I eat, she drinks)",
    ],
    funcionesComunicativas: [
      "Pedir y ofrecer comida y bebida",
      "Expresar gustos y preferencias alimenticias",
      "Describir el contenido del refrigerador o una tienda",
      "Hablar de hábitos alimenticios diarios",
    ],
    pronunciacion: "Diferenciar /iː/ de eat vs /ɪ/ de it. Pronunciación de vegetables y fruit.",
    ejemplosActividades: [
      "Menú del restaurante: estudiantes toman pedidos usando Would you like...?",
      "Refrigerador vacío: completar con tarjetas de alimentos usando There is/There are",
      "Encuesta de desayuno: ¿Qué comes normalmente por la mañana?",
    ],
    productosSugeridos: [
      "Menú de restaurante escrito en inglés con platos dominicanos",
      "Diálogo roleplay en una cafetería",
      "Receta simple escrita en inglés",
    ],
  },
  {
    temaNormalizado:       "family",
    area:                  "Lenguas Extranjeras",
    asignatura:            "Inglés",
    grado:                 null,
    reglas: [
      "Incluir árbol genealógico como actividad central",
      "Trabajar have/has para describir la familia",
      "Usar adjetivos posesivos (my, your, his, her, our, their)",
      "Describir características físicas y personalidad de familiares",
      "Considerar diversidad familiar dominicana (familias extendidas, abuelos presentes)",
    ],
    vocabulario: [
      "mother", "father", "brother", "sister", "grandmother", "grandfather",
      "uncle", "aunt", "cousin", "son", "daughter", "husband", "wife",
      "only child", "twins", "family tree",
    ],
    gramatica: [
      "Have / Has",
      "Is / Are",
      "Adjetivos posesivos: my, your, his, her, our, their",
      "Adjetivos descriptivos (tall, short, funny, kind)",
      "Simple Present",
    ],
    funcionesComunicativas: [
      "Presentar e introducir a los miembros de la familia",
      "Describir físicamente a un familiar",
      "Hablar sobre las relaciones familiares",
      "Preguntar y responder sobre la familia de otros",
    ],
    pronunciacion: "Diferenciar father /ˈfɑːðər/ de mother /ˈmʌðər/. Énfasis en sílabas de grandmother y grandfather.",
    ejemplosActividades: [
      "Árbol genealógico ilustrado con descripción escrita",
      "Juego de adivinanzas: describir un familiar sin decir el nombre",
      "Show and tell: traer foto de familia y presentarla en inglés",
    ],
    productosSugeridos: [
      "Árbol genealógico ilustrado con nombre y relación en inglés",
      "Párrafo descriptivo 'My Family'",
      "Presentación oral de un familiar especial",
    ],
  },
  {
    temaNormalizado:       "colors_and_clothing",
    area:                  "Lenguas Extranjeras",
    asignatura:            "Inglés",
    grado:                 null,
    reglas: [
      "Combinar colores y ropa en contexto real (describir lo que llevan puesto)",
      "Usar Is wearing / Are wearing para descripción presente",
      "Incluir vocabulario del uniforme escolar dominicano",
    ],
    vocabulario: [
      "red", "blue", "green", "yellow", "white", "black", "pink", "brown",
      "shirt", "pants", "skirt", "dress", "shoes", "socks", "uniform", "hat", "jacket",
    ],
    gramatica: [
      "Is/Are wearing",
      "What color is...?",
      "Adjetivos de color (posición antes del sustantivo en inglés)",
      "Simple Present",
    ],
    funcionesComunicativas: [
      "Describir la ropa que usa alguien",
      "Hablar sobre colores favoritos",
      "Identificar personas por su ropa",
    ],
    pronunciacion: "Pronunciación de colours: blue /bluː/, green /ɡriːn/, yellow /ˈjeloʊ/.",
    ejemplosActividades: [
      "¿Quién es? Adivinar un compañero describiendo su ropa",
      "Diseñar un outfit en papel y describir en inglés",
    ],
    productosSugeridos: [
      "Página de moda: diseño de ropa con descripciones en inglés",
      "Diálogo: describir lo que lleva un amigo",
    ],
  },
];

// ── Memorias iniciales para el Auditor Pedagógico ─────────────────────────────

const AUDITOR_MEMORIES_SEED = [
  {
    tipo:               MEMORY_TYPES.CRITERIO,
    contenido:          "Al auditar planificaciones de Inglés (Lenguas Extranjeras), verificar siempre que las actividades incluyen las cuatro habilidades del idioma: Listening, Speaking, Reading y Writing (LSRW).",
    areaAplicable:      "Lenguas Extranjeras",
    asignaturaAplicable:"Inglés",
    gradoAplicable:     null,
    temaAplicable:      null,
    prioridad:          9,
    fuente:             MEMORY_SOURCES.ADMIN,
  },
  {
    tipo:               MEMORY_TYPES.CRITERIO,
    contenido:          "Verificar que las planificaciones de Inglés especifican el nivel MCER correspondiente al grado (A1 para primero/segundo, A2 para tercero/cuarto, aproximación a B1 para quinto/sexto de secundaria). Las funciones comunicativas deben ser apropiadas para ese nivel.",
    areaAplicable:      "Lenguas Extranjeras",
    asignaturaAplicable:"Inglés",
    gradoAplicable:     null,
    temaAplicable:      null,
    prioridad:          9,
    fuente:             MEMORY_SOURCES.ADMIN,
  },
  {
    tipo:               MEMORY_TYPES.REGLA,
    contenido:          "Una planificación de Inglés debe incluir al menos una actividad de producción oral (Speaking) y una de producción escrita (Writing) por semana. Señalar como deficiencia si falta alguna de estas dos.",
    areaAplicable:      "Lenguas Extranjeras",
    asignaturaAplicable:"Inglés",
    gradoAplicable:     null,
    temaAplicable:      null,
    prioridad:          8,
    fuente:             MEMORY_SOURCES.ADMIN,
  },
  {
    tipo:               MEMORY_TYPES.CRITERIO,
    contenido:          "Verificar que la planificación incluye una situación de aprendizaje o contexto comunicativo real. El inglés debe enseñarse en contexto, no como listas de vocabulario aislado.",
    areaAplicable:      "Lenguas Extranjeras",
    asignaturaAplicable:null,
    gradoAplicable:     null,
    temaAplicable:      null,
    prioridad:          8,
    fuente:             MEMORY_SOURCES.ADMIN,
  },
  {
    tipo:               MEMORY_TYPES.REGLA,
    contenido:          "Toda planificación debe tener coherencia vertical: las actividades del momento de Desarrollo deben construir sobre el Inicio, y el Cierre debe consolidar lo trabajado. Señalar si hay saltos o desconexión entre momentos.",
    areaAplicable:      null,
    asignaturaAplicable:null,
    gradoAplicable:     null,
    temaAplicable:      null,
    prioridad:          7,
    fuente:             MEMORY_SOURCES.ADMIN,
  },
  {
    tipo:               MEMORY_TYPES.CRITERIO,
    contenido:          "Verificar que la metacognición (cierre reflexivo) no sea solo una pregunta genérica como '¿Qué aprendiste hoy?'. Debe ser específica al contenido trabajado y promover reflexión sobre el proceso de aprendizaje.",
    areaAplicable:      null,
    asignaturaAplicable:null,
    gradoAplicable:     null,
    temaAplicable:      null,
    prioridad:          6,
    fuente:             MEMORY_SOURCES.ADMIN,
  },
];

// ── Campos estadísticos y relacionales por defecto para ke_topics ─────────────
// Se mezclan en cada topic al sembrar y al crear nuevos topics desde el admin.
export const TOPIC_STATS_DEFAULTS = {
  competenciasRelacionadas:    [],
  indicadoresRelacionados:     [],
  contenidosRelacionados:      [],
  actividadesExitosasIds:      [],
  instrumentosRelacionadosIds: [],
  estrategiasFrecuentes:       [],
  erroresFrecuentes:           [],
  casosExitoIds:               [],
  casosDescartadosIds:         [],
  modelosEstiloIds:            [],
  auditoriasRelacionadasIds:   [],
  calificacionPromedio:        0,
  vecesUtilizado:              0,
  vecesRegenerado:             0,
  sugerenciasAceptadas:        0,
  sugerenciasRechazadas:       0,
  tokensAhorradosEstimados:    0,
};

// ── Función de siembra ────────────────────────────────────────────────────────

/**
 * Verifica si ya hay datos en ke_topics para evitar duplicados.
 */
export async function hayDatosSembrados() {
  if (!db) return false;
  try {
    const snap = await getDocs(query(collection(db, COLLECTIONS.KE_TOPICS), limit(1)));
    return !snap.empty;
  } catch {
    return false;
  }
}

/**
 * Siembra los topics y memorias iniciales en Firestore.
 * Solo debe llamarse una vez, desde el panel admin.
 *
 * @returns {Promise<{ topics: number, memorias: number }>}
 */
export async function sembrarDatosIniciales() {
  if (!db) throw new Error("[seedData] Firestore no disponible");

  const uid  = getAuth().currentUser?.uid ?? "seed";
  let topicsCreados  = 0;
  let memoriasCreadas = 0;

  // Sembrar topics (con campos estadísticos en cero)
  for (const topic of TOPICS_SEED) {
    await addDoc(collection(db, COLLECTIONS.KE_TOPICS), {
      ...TOPIC_STATS_DEFAULTS,
      ...topic,
      estado:             STATES.ACTIVE,
      creadoPor:          uid,
      fechaActualizacion: serverTimestamp(),
    });
    topicsCreados++;
  }

  // Sembrar memorias del Auditor (estado activo directamente — son reglas conocidas)
  const AUDITOR_ID = "auditor-pedagogico";
  for (const memoria of AUDITOR_MEMORIES_SEED) {
    await addDoc(
      collection(db, COLLECTIONS.KE_AGENTES, AUDITOR_ID, COLLECTIONS.KE_MEMORIA),
      {
        ...memoria,
        agentId:      AUDITOR_ID,
        estado:       STATES.ACTIVE,
        version:      1,
        creadoPor:    uid,
        creadoEn:     serverTimestamp(),
        actualizadoEn:serverTimestamp(),
      }
    );
    memoriasCreadas++;
  }

  if (import.meta.env.DEV) {
    console.debug(`[seedData] Sembrado: ${topicsCreados} topics, ${memoriasCreadas} memorias`);
  }

  return { topics: topicsCreados, memorias: memoriasCreadas };
}
