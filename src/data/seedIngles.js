// ============================================================================
// DocenteOS — Esquema de entidades + seed del curso de Inglés
// Unidad de Aprendizaje: "My Life and Daily Routines"
// Curso: 2do Secundaria A · Inglés · Nivel A2.2 · Modo Planificación
// Docente: César Jonás Báez · C.E. Héctor Fco. López, Hato Nuevo (Distrito 02-06)
//
// Backend-agnóstico: este mismo árbol mapea a Firestore o a Supabase.
//   Firestore → colecciones: cursos, estudiantes, planificaciones,
//               instrumentos, columnasRegistro, notas
//               (subcolecciones: planificaciones/{id}/semanas/{n}/dias)
//   Supabase  → tablas con FK: cursos, estudiantes, planificaciones,
//               competencias, indicadores, semanas, dias, instrumentos,
//               criterios_rubrica, columnas_registro, notas
// ============================================================================

/* ---------------------------- CATÁLOGOS ---------------------------- */
export const MODO = { GUIA: "guia", PLANIFICACION: "planificacion" };

export const TIPO_EVAL = {
  DIAGNOSTICA: "diagnostica",
  FORMATIVA: "formativa",
  SUMATIVA: "sumativa",
};

export const AGENTE = {
  HETERO: "heteroevaluacion",
  AUTO: "autoevaluacion",
  CO: "coevaluacion",
};

export const TIPO_INSTRUMENTO = {
  RUBRICA: "Rúbrica analítica",
  LISTA_COTEJO: "Lista de cotejo",
  REGISTRO_ANECDOTICO: "Registro anecdótico",
  ESCALA: "Escala estimativa",
  COEVALUACION: "Coevaluación",
  AUTOEVALUACION: "Autoevaluación",
};

/* ---------------------------- CURSO ---------------------------- */
export const curso = {
  id: "ing-2a",
  nombre: "2do Secundaria A",
  area: "Inglés",
  grado: "2do",
  seccion: "A",
  nivel: "A2.2",
  modo: MODO.PLANIFICACION,
  centro: "C.E. Héctor Fco. López, Hato Nuevo",
  distrito: "02-06 San Juan Oeste",
  codigo: "03313",
  docente: "César Jonás Báez",
  anioEscolar: "2025-2026",
};

/* ---------------------------- ESTUDIANTES (placeholder) ---------------------------- */
export const estudiantes = [
  { id: 1, cursoId: "ing-2a", nombre: "Juan Pérez" },
  { id: 2, cursoId: "ing-2a", nombre: "María Rodríguez" },
  { id: 3, cursoId: "ing-2a", nombre: "Pedro Gómez" },
  { id: 4, cursoId: "ing-2a", nombre: "Ana Belén Reyes" },
  { id: 5, cursoId: "ing-2a", nombre: "Carlos Méndez" },
  { id: 6, cursoId: "ing-2a", nombre: "Fernanda Lozano" },
  { id: 7, cursoId: "ing-2a", nombre: "Gabriel Ortiz" },
  { id: 8, cursoId: "ing-2a", nombre: "Helena Vargas" },
];

/* ---------------------------- COMPETENCIAS + INDICADORES ---------------------------- */
export const competencias = [
  {
    id: "comp-comunicativa",
    nombre: "Comunicativa",
    descripcion: "Comprende y expresa, de forma oral y escrita, ideas, sentimientos y valores en distintas situaciones, para informar, dar instrucciones, describir y opinar sobre temas cotidianos.",
    indicadores: [
      "Responde a preguntas e indicaciones a partir de textos claros, breves y sencillos sobre el entorno, información personal y actividades cotidianas.",
      "Se expresa con frases y oraciones breves enlazadas por conectores comunes, con pausas y posibles errores básicos.",
      "Interactúa de forma oral y escrita con vocabulario básico sobre información personal y actividades cotidianas, con claridad suficiente.",
    ],
  },
  {
    id: "comp-pensamiento",
    nombre: "Pensamiento Lógico, Creativo y Crítico",
    descripcion: "Interactúa empleando razonamiento lógico-verbal y estrategias creativas y críticas para narrar experiencias, dar sugerencias y expresar planes.",
    indicadores: [
      "Responde usando pensamiento lógico-verbal para comprender mensajes orales y escritos sobre temas cotidianos.",
      "Se expresa con creatividad y estructura lógica básica enlazada por conectores comunes.",
      "Interactúa siguiendo la lógica del contexto inmediato con frases breves y reflexivas.",
    ],
  },
  {
    id: "comp-problemas",
    nombre: "Resolución de Problemas",
    descripcion: "Interactúa ante circunstancias y problemas comunes del entorno, solicitando u ofreciendo ayuda y dando consejos pertinentes.",
    indicadores: [
      "Responde a situaciones y problemas inmediatos y familiares.",
      "Comunica de forma clara problemas propios y de otros, solicitando ayuda, consejos y sugerencias.",
      "Interactúa identificando problemas cotidianos y planteando opciones para enfrentarlos.",
    ],
  },
  {
    id: "comp-etica",
    nombre: "Ética y Ciudadana",
    descripcion: "Se comunica con cortesía y respeto, reconociendo las diferencias individuales y la identidad social y cultural local y global.",
    indicadores: [
      "Responde con cortesía a partir de textos breves de vocabulario básico.",
      "Identifica y describe aspectos de sus actividades cotidianas y entorno inmediato.",
      "Interactúa por medios físicos y electrónicos respetando las normas de convivencia.",
    ],
  },
  {
    id: "comp-cientifica",
    nombre: "Científica y Tecnológica",
    descripcion: "Se comunica para solicitar y ofrecer ayuda, expresar interés y dar sugerencias sobre asuntos científicos y tecnológicos del entorno inmediato.",
    indicadores: [
      "Responde a partir de textos breves sobre asuntos científicos y tecnológicos.",
      "Identifica y describe elementos tecnológicos y de la naturaleza de su entorno.",
      "Interactúa para intercambiar información e ideas sobre el entorno inmediato.",
    ],
  },
  {
    id: "comp-personal",
    nombre: "Desarrollo Personal y Espiritual",
    descripcion: "Interactúa con cortesía, honestidad y respeto al referirse a sí mismo y a otros, al hacer sugerencias y describir experiencias y estados anímicos.",
    indicadores: [
      "Muestra empatía por los sentimientos y necesidades de las demás personas.",
      "Muestra disposición para ayudar, interactuando de forma colaborativa.",
      "Interactúa con cortesía, respeto y asertividad.",
    ],
  },
  {
    id: "comp-ambiental",
    nombre: "Ambiental y de la Salud",
    descripcion: "Muestra preferencia por opciones que impactan positivamente la salud y el medio ambiente al interactuar sobre sus actividades cotidianas.",
    indicadores: [
      "Responde de forma favorable a la preservación del medio ambiente y la salud.",
      "Ofrece información e instrucciones sobre acciones saludables y sostenibles.",
      "Interactúa mostrando preferencia por hábitos que cuidan la salud y el medioambiente.",
    ],
  },
];

/* ---------------------------- CONTENIDOS ---------------------------- */
export const contenidos = {
  conceptos: {
    vocabulario: [
      "Family members, classmates, teachers, friends",
      "Partes del día: morning, afternoon, evening, night",
      "Daily routines: wake up, brush teeth, have breakfast, go to school, study, play, have dinner, go to bed",
      "Healthy habits: exercise, sleep eight hours, drink water, eat fruits, wash hands",
      "Time: o'clock, half past, quarter past, quarter to; days of the week; school subjects",
    ],
    gramatica: [
      "Present simple (rutinas y 3ª persona -s/-es)",
      "Adverbios de frecuencia (always, usually, often, sometimes, never)",
      "WH-questions (What time / When / How often)",
      "Expresiones de tiempo (at + hora, in the morning, at night)",
      "Conectores de secuencia (first, then, after that, next, finally)",
      "Imperativo y 'should/shouldn't' para consejos",
    ],
  },
  procedimientos: [
    "Sostener conversaciones breves sobre rutinas propias y de otros",
    "Describir momentos del día y horarios escolares/familiares",
    "Comprender textos orales y escritos: agendas, audios, descripciones de un día típico",
    "Producir textos escritos: párrafos descriptivos, horarios, listas de hábitos, fichas del poster",
  ],
  actitudes: [
    "Motivación para aprender inglés",
    "Cortesía y asertividad en la comunicación",
    "Respeto por las diferencias en los modos de vida",
    "Uso juicioso del tiempo y hábitos saludables",
  ],
};

/* ---------------------------- PLANIFICACIÓN (Unidad) ---------------------------- */
export const planificacion = {
  id: "plan-daily-routines",
  cursoId: "ing-2a",
  titulo: "My Life and Daily Routines",
  area: "Inglés (Lengua Extranjera)",
  grado: "2do",
  seccion: "A",
  nivel: "A2.2",
  duracionSemanas: 6,
  estrategia: "Juego de Roles con Indagación Dialógica",
  ejeTransversal: "Desarrollo Sostenible",
  alfabetizaciones: ["Ciudadanía y convivencia", "Salud y bienestar"],
  asignaturasVinculadas: ["Ciencias Sociales", "Lengua Española", "Desarrollo Personal y Social", "Educación Artística"],
  productoFinal: "My Daily Routine Poster",
  nucleoClases: "4 clases semanales de 45 min + sesiones flexibles",
  ambienteAprendizaje: "Aula en estaciones: Listening, Speaking, Reading y Writing Corner",
  estado: "en_curso",
  periodo: "Periodo 3",
  competenciasIds: competencias.map((c) => c.id),
};

/* ---------------------------- SEMANAS / DÍAS / ACTIVIDADES ----------------------------
   Cada día referencia su instrumento (código del banco de Anexos) y la evidencia
   evaluable. Se incluyen `momentos` completos en 2 días de ejemplo (S1-D1 formativo
   y S6-D2 sumativo). El resto sigue la misma forma y se completa igual.
--------------------------------------------------------------------------------------- */
export const semanas = [
  {
    n: 1,
    titulo: "Conociendo mis rutinas y la organización de la unidad",
    dias: [
      {
        n: 1,
        titulo: "Welcome to My Daily Life",
        gramatica: "Vocabulario de rutinas y partes del día",
        estrategia: "Indagación dialógica",
        intencion: "Expresar ideas sobre rutinas y actividades cotidianas; recuperar saberes previos.",
        tipoEval: TIPO_EVAL.DIAGNOSTICA,
        instrumentos: ["B", "C"],
        evidencia: "Registro de palabras clave + mapa inicial de ideas",
        momentos: [
          {
            tipo: "Inicio",
            tiempo: "10 min",
            actividades: [
              "Responden al saludo e indicaciones iniciales.",
              "Observan imágenes de actividades cotidianas y las relacionan con su rutina.",
              "Retroalimentación con preguntas orales (What time do you wake up?).",
              "Recuperación de saberes previos sobre acciones diarias.",
            ],
            evaluacion: { tipo: TIPO_EVAL.DIAGNOSTICA, agente: AGENTE.HETERO, tecnica: "Observación directa", instrumento: "B" },
            recursos: { humanos: "Docente y estudiantes", didacticos: "Pizarra, imágenes, cuadernos", tecnologicos: "TV o proyector" },
            metacognicion: ["What do you already know about daily routines in English?"],
          },
          {
            tipo: "Desarrollo",
            tiempo: "30 min",
            actividades: [
              "Presentación de la unidad y del producto final (My Daily Routine Poster).",
              "Conversación guiada sobre acciones por momento del día.",
              "Registran palabras clave en el cuaderno.",
              "Elaboran un mapa de ideas y socializan.",
            ],
            evaluacion: { tipo: TIPO_EVAL.DIAGNOSTICA, agente: AGENTE.HETERO, tecnica: "Observación directa", instrumento: "B" },
            recursos: { humanos: "Docente y estudiantes", didacticos: "Cartulina, marcadores, imágenes", tecnologicos: "Diapositivas" },
            metacognicion: ["How do your daily routines connect with your health and family life?"],
          },
          {
            tipo: "Cierre",
            tiempo: "5 min",
            actividades: [
              "Reflexionan sobre la importancia de aprender inglés para describir su vida.",
              "Responden preguntas de reflexión.",
            ],
            evaluacion: { tipo: TIPO_EVAL.FORMATIVA, agente: AGENTE.AUTO, tecnica: "Preguntas reflexivas", instrumento: "C" },
            recursos: { humanos: "Docente y estudiantes", didacticos: "Cuadernos y pizarra" },
            metacognicion: ["Why is it important to have a healthy daily routine?"],
          },
        ],
      },
      {
        n: 2,
        titulo: "Understanding Our Unit, Product and Evaluation",
        gramatica: "Vocabulario inicial de rutinas",
        estrategia: "Indagación dialógica",
        intencion: "Comprender la organización de la unidad, el producto y los criterios de evaluación.",
        tipoEval: TIPO_EVAL.DIAGNOSTICA,
        instrumentos: ["B", "C"],
        evidencia: "Entrada 0 del Portafolio + producción escrita inicial",
      },
    ],
  },
  {
    n: 2,
    titulo: "Everyday Activities, Time and Habits",
    dias: [
      { n: 1, titulo: "Everyday Activities in My Life", gramatica: "Present simple (I wake up at…)", tipoEval: TIPO_EVAL.FORMATIVA, instrumentos: ["B"], evidencia: "Cinco oraciones sobre la rutina" },
      { n: 2, titulo: "Time Expressions and Parts of the Day", gramatica: "at/in + present simple", tipoEval: TIPO_EVAL.FORMATIVA, instrumentos: ["B"], evidencia: "Mini línea de tiempo + oraciones" },
      { n: 3, titulo: "Healthy Habits and Frequency Adverbs", gramatica: "Adverbios de frecuencia", tipoEval: TIPO_EVAL.FORMATIVA, instrumentos: ["B", "D"], evidencia: "Párrafo de hábitos saludables" },
      { n: 4, titulo: "School and Family Routines", gramatica: "WH-questions + 3ª persona -s", tipoEval: TIPO_EVAL.FORMATIVA, instrumentos: ["B"], evidencia: "Entrevista + 6 oraciones descriptivas" },
      { n: 5, titulo: "Integrating My Daily Routine: Mini-Presentation", gramatica: "Integración semana 2", tipoEval: TIPO_EVAL.FORMATIVA, instrumentos: ["B", "D"], evidencia: "Mini-presentación oral + Entrada 1 portafolio" },
    ],
  },
  {
    n: 3,
    titulo: "Time, Schedules and Organization of My Day",
    dias: [
      { n: 1, titulo: "What Time Is It? Telling Time and Daily Schedule", gramatica: "What time is it? It's… / At + hora", tipoEval: TIPO_EVAL.FORMATIVA, instrumentos: ["B", "A"], evidencia: "My Daily Schedule (1er borrador del poster)" },
      { n: 2, titulo: "My Weekly Schedule: Days and Class Subjects", gramatica: "On + día", tipoEval: TIPO_EVAL.FORMATIVA, instrumentos: ["A"], evidencia: "Weekly Schedule + 5 oraciones" },
      { n: 3, titulo: "Before, After and During: Sequencing Activities", gramatica: "Conectores de secuencia", tipoEval: TIPO_EVAL.FORMATIVA, instrumentos: ["A"], evidencia: "Párrafo descriptivo + imagen para el poster" },
      { n: 4, titulo: "Free Time and Weekend Routines", gramatica: "on weekends / on Saturdays", tipoEval: TIPO_EVAL.FORMATIVA, instrumentos: ["A"], evidencia: "Weekend Routine Mini-Map" },
      { n: 5, titulo: "My First Poster Draft", gramatica: "Integración semana 3", tipoEval: TIPO_EVAL.FORMATIVA, instrumentos: ["A", "C"], evidencia: "Primer borrador del My Daily Routine Poster" },
    ],
  },
  {
    n: 4,
    titulo: "My Family Routines",
    dias: [
      { n: 1, titulo: "My Family's Daily Routines", gramatica: "3ª persona singular + posesivos", tipoEval: TIPO_EVAL.FORMATIVA, instrumentos: ["B"], evidencia: "Cinco oraciones sobre la familia" },
      { n: 2, titulo: "Describing My Family Members", gramatica: "WH-questions 3ª persona", tipoEval: TIPO_EVAL.FORMATIVA, instrumentos: ["B", "A"], evidencia: "Family Interview (preguntas y respuestas)" },
      { n: 3, titulo: "Helping at Home: Chores and Responsibilities", gramatica: "Present simple + frecuencia", tipoEval: TIPO_EVAL.FORMATIVA, instrumentos: ["B", "A"], evidencia: "Chore Chart familiar" },
      { n: 4, titulo: "Comparing Family Routines and Healthy Habits", gramatica: "and/but + should", tipoEval: TIPO_EVAL.FORMATIVA, instrumentos: ["B", "A"], evidencia: "Párrafo comparativo + recomendación" },
      { n: 5, titulo: "Building My Family Routines Section", gramatica: "Integración semana 4", tipoEval: TIPO_EVAL.FORMATIVA, instrumentos: ["A", "C"], evidencia: "Sección 'My Family Routines' del poster" },
    ],
  },
  {
    n: 5,
    titulo: "Building and Improving My Daily Routine Poster",
    dias: [
      { n: 1, titulo: "Organizing My Poster: From Drafts to Plan", gramatica: "Integración de la unidad", tipoEval: TIPO_EVAL.FORMATIVA, instrumentos: ["A"], evidencia: "Poster Plan organizado por secciones" },
      { n: 2, titulo: "Writing My Daily Routine Paragraph", gramatica: "Present simple + conectores", tipoEval: TIPO_EVAL.FORMATIVA, instrumentos: ["A"], evidencia: "Párrafo central del poster" },
      { n: 3, titulo: "Giving Advice for a Healthier Routine", gramatica: "should / shouldn't", tipoEval: TIPO_EVAL.FORMATIVA, instrumentos: ["A"], evidencia: "Healthy Habits List" },
      { n: 4, titulo: "Designing My Poster: Layout, Images and Title", gramatica: "Integración", tipoEval: TIPO_EVAL.FORMATIVA, instrumentos: ["A"], evidencia: "Versión casi final del poster" },
      { n: 5, titulo: "Rehearsing My Poster Presentation", gramatica: "Present simple + should", tipoEval: TIPO_EVAL.FORMATIVA, instrumentos: ["A", "C"], evidencia: "Presentation Script ensayado" },
    ],
  },
  {
    n: 6,
    titulo: "Presenting and Reflecting on My Daily Routine",
    dias: [
      { n: 1, titulo: "Final Rehearsal: Preparing My Presentation", gramatica: "Integración de la unidad", tipoEval: TIPO_EVAL.FORMATIVA, instrumentos: ["A", "D"], evidencia: "Guion ajustado + ficha de pares" },
      {
        n: 2,
        titulo: "Poster Presentations (Part 1)",
        gramatica: "Integración oral",
        estrategia: "Socialización del producto final y coevaluación",
        intencion: "Presentar oralmente el My Daily Routine Poster comunicando con claridad la rutina diaria.",
        tipoEval: TIPO_EVAL.SUMATIVA,
        instrumentos: ["A", "D"],
        evidencia: "Presentación oral del poster (producto final socializado)",
        momentos: [
          {
            tipo: "Inicio",
            tiempo: "10 min",
            actividades: [
              "Recuerdan los criterios de una buena presentación.",
              "Revisan la rúbrica de coevaluación.",
            ],
            evaluacion: { tipo: TIPO_EVAL.DIAGNOSTICA, agente: AGENTE.HETERO, tecnica: "Observación directa", instrumento: "A" },
            recursos: { humanos: "Docente y estudiantes", didacticos: "Posters, rúbricas", tecnologicos: "TV o proyector" },
            metacognicion: ["What do I need to focus on while my classmates present?"],
          },
          {
            tipo: "Desarrollo",
            tiempo: "30 min",
            actividades: [
              "La primera mitad del grupo presenta su poster (≈2 min c/u, con cronómetro).",
              "El público completa la rúbrica de coevaluación (Listen and Evaluate).",
              "Tras cada presentación, un compañero hace una pregunta real y el presentador responde en inglés.",
            ],
            evaluacion: { tipo: TIPO_EVAL.SUMATIVA, agente: AGENTE.HETERO, tecnica: "Exposición oral", instrumento: "A" },
            recursos: { humanos: "Docente y estudiantes", didacticos: "Posters terminados y rúbricas", tecnologicos: "Proyector y grabación (opcional)" },
            metacognicion: ["What did I learn from my classmates' routines?"],
          },
          {
            tipo: "Cierre",
            tiempo: "5 min",
            actividades: [
              "Comparten qué presentación les pareció más interesante.",
              "Reflexionan sobre cómo se sintieron hablando en inglés.",
            ],
            evaluacion: { tipo: TIPO_EVAL.FORMATIVA, agente: AGENTE.CO, tecnica: "Preguntas reflexivas", instrumento: "C" },
            recursos: { humanos: "Docente y estudiantes", didacticos: "Rúbricas y portafolio" },
            metacognicion: ["How will I use English to talk about my life with other people?"],
          },
        ],
      },
      { n: 3, titulo: "Poster Presentations (Part 2) and Gallery Walk", gramatica: "Integración oral e interacción", tipoEval: TIPO_EVAL.SUMATIVA, instrumentos: ["A"], evidencia: "Presentación + Gallery Walk Passport" },
      { n: 4, titulo: "Role Play: A Day in My Life", gramatica: "Integración comunicativa", tipoEval: TIPO_EVAL.SUMATIVA, instrumentos: ["A"], evidencia: "Representación oral de una situación diaria" },
      { n: 5, titulo: "Reflecting and Celebrating My Learning", gramatica: "Cierre de la unidad", tipoEval: TIPO_EVAL.SUMATIVA, instrumentos: ["E", "A"], evidencia: "My Learning Journey + poster final exhibido" },
    ],
  },
];

/* ---------------------------- INSTRUMENTOS (Anexos A–E) ----------------------------
   Banco reutilizable de instrumentos de la planificación. Se referencian desde los
   días por su código (A–E) y desde las columnas del registro.
--------------------------------------------------------------------------------------- */
export const instrumentos = [
  {
    id: "A",
    cursoId: "ing-2a",
    planificacionId: "plan-daily-routines",
    nombre: "Rúbrica analítica — My Daily Routine Poster",
    tipo: TIPO_INSTRUMENTO.RUBRICA,
    origen: "Planificación",
    estado: "En uso",
    escala: { niveles: [4, 3, 2, 1], etiquetas: ["Excelente", "Satisfactorio", "En proceso", "Inicial"] },
    maxPorCriterio: 4,
    criterios: [
      { nombre: "Contenido (rutina diaria)", n4: "Rutina completa por momentos del día con horarios y detalles.", n3: "La mayoría de los momentos del día con horarios.", n2: "Algunos momentos con horarios básicos.", n1: "Pocas actividades sin orden ni horarios." },
      { nombre: "Uso del inglés (gramática)", n4: "Present simple, conectores y expresiones de tiempo correctos.", n3: "Present simple y conectores con errores menores.", n2: "Present simple con errores frecuentes.", n1: "Construcción de oraciones muy limitada." },
      { nombre: "Familia y hábitos saludables", n4: "Incluye rutinas familiares y hábitos con recomendaciones.", n3: "Rutinas familiares y al menos un hábito saludable.", n2: "Incluye familia o hábitos de forma parcial.", n1: "No incluye familia ni hábitos saludables." },
      { nombre: "Diseño y organización", n4: "Poster claro, ordenado, con título, secciones e imágenes.", n3: "Poster ordenado con título y secciones.", n2: "Organización parcial.", n1: "Poster desordenado o incompleto." },
      { nombre: "Presentación oral", n4: "Fluidez, volumen y contacto visual.", n3: "Claridad y pocos titubeos.", n2: "Apoyo y pausas frecuentes.", n1: "Mucha dificultad." },
      { nombre: "Riqueza de vocabulario", n4: "Vocabulario variado y preciso.", n3: "Adecuado con alguna repetición.", n2: "Básico y repetitivo.", n1: "Muy limitado." },
      { nombre: "Claridad comunicativa", n4: "El mensaje se entiende sin esfuerzo.", n3: "Se entiende con poco esfuerzo.", n2: "Se entiende con esfuerzo del interlocutor.", n1: "Difícil de entender." },
      { nombre: "Interacción oral (responde preguntas)", n4: "Responde con seguridad y amplía sus respuestas.", n3: "Responde correctamente.", n2: "Responde con apoyo o muy breve.", n1: "No logra responder en inglés." },
      { nombre: "Creatividad y presentación visual", n4: "Original y atractivo; imágenes propias y diseño cuidado.", n3: "Atractivo con imágenes pertinentes.", n2: "Elementos visuales básicos.", n1: "Sin recursos visuales." },
      { nombre: "Inglés funcional", n4: "Usa expresiones funcionales con naturalidad.", n3: "Usa varias correctamente.", n2: "Usa pocas.", n1: "No usa expresiones funcionales." },
      { nombre: "Pronunciación e inteligibilidad", n4: "Clara y comprensible durante toda la presentación.", n3: "Comprensible con errores menores.", n2: "Dificulta a veces la comprensión.", n1: "Dificulta mucho la comprensión." },
    ],
  },
  {
    id: "B",
    cursoId: "ing-2a",
    planificacionId: "plan-daily-routines",
    nombre: "Lista de cotejo — Producción oral",
    tipo: TIPO_INSTRUMENTO.LISTA_COTEJO,
    origen: "Planificación",
    estado: "En uso",
    escala: { opciones: ["Sí", "En proceso", "No"] },
    indicadores: [
      "Saluda y responde preguntas iniciales en inglés.",
      "Describe su rutina diaria usando el present simple.",
      "Usa expresiones de tiempo y adverbios de frecuencia.",
      "Formula y responde WH-questions sobre rutinas.",
      "Da recomendaciones de hábitos saludables (should).",
      "Interactúa con cortesía y respeto con sus compañeros.",
    ],
  },
  {
    id: "C",
    cursoId: "ing-2a",
    planificacionId: "plan-daily-routines",
    nombre: "Registro anecdótico",
    tipo: TIPO_INSTRUMENTO.REGISTRO_ANECDOTICO,
    origen: "Planificación",
    estado: "Lista",
    campos: ["fecha", "estudiante", "situacionObservada", "interpretacionAccion"],
  },
  {
    id: "D",
    cursoId: "ing-2a",
    planificacionId: "plan-daily-routines",
    nombre: "Coevaluación — Two Stars and a Wish",
    tipo: TIPO_INSTRUMENTO.COEVALUACION,
    origen: "Planificación",
    estado: "Lista",
    campos: ["star1", "star2", "wish"],
  },
  {
    id: "E",
    cursoId: "ing-2a",
    planificacionId: "plan-daily-routines",
    nombre: "Autoevaluación — My Learning Journey",
    tipo: TIPO_INSTRUMENTO.AUTOEVALUACION,
    origen: "Planificación",
    estado: "Lista",
    escala: { opciones: ["Yes", "Almost", "Not yet"] },
    items: [
      "I can describe my daily routine in English.",
      "I can tell the time and talk about my schedule.",
      "I can describe my family's routines.",
      "I can talk about healthy habits and give advice.",
      "I can present my poster to my classmates.",
    ],
    extra: "My personal goal for next time",
  },
];

/* ---------------------------- APOYOS (Anexos F–L, no calificables) ---------------------------- */
export const apoyos = [
  { id: "F", nombre: "Glosario bilingüe: Daily Routines and Healthy Habits", tipo: "glosario" },
  { id: "G", nombre: "Sentence starters (apoyos para hablar y escribir)", tipo: "andamiaje" },
  { id: "H", nombre: "My Poster Progress Checklist", tipo: "checklist" },
  { id: "I", nombre: "Organizador gráfico del poster: My Daily Routine", tipo: "organizador" },
  { id: "J", nombre: "Evaluación diagnóstica inicial (A2 — 4 habilidades)", tipo: "diagnostico" },
  { id: "K", nombre: "Adaptaciones para estudiantes con NEAE, por perfil", tipo: "adaptaciones" },
  { id: "L", nombre: "Plan B tecnológico (continuidad sin recursos digitales)", tipo: "contingencia" },
];

/* ---------------------------- REGISTRO (columnas evaluables) ----------------------------
   Solo las evidencias SUMATIVAS de la unidad se vuelven columnas de nota.
   Las formativas/diagnósticas alimentan observación, no calificación.
--------------------------------------------------------------------------------------- */
export const columnasRegistro = [
  { id: "col-poster", cursoId: "ing-2a", planificacionId: "plan-daily-routines", label: "Poster final", origen: "My Life and Daily Routines", instrumentoId: "A", tipo: TIPO_EVAL.SUMATIVA, max: 100 },
  { id: "col-oral", cursoId: "ing-2a", planificacionId: "plan-daily-routines", label: "Presentación oral", origen: "My Life and Daily Routines", instrumentoId: "B", tipo: TIPO_EVAL.SUMATIVA, max: 100 },
  { id: "col-roleplay", cursoId: "ing-2a", planificacionId: "plan-daily-routines", label: "Role Play", origen: "My Life and Daily Routines", instrumentoId: "A", tipo: TIPO_EVAL.SUMATIVA, max: 100 },
];

// Notas seed de ejemplo (las reales entran desde "Evaluar").
export const notas = {
  1: { "col-poster": 88, "col-oral": 84 },
  2: { "col-poster": 95, "col-oral": 92 },
  3: { "col-poster": 70, "col-oral": 66 },
  4: { "col-poster": 90, "col-oral": 88 },
  5: { "col-poster": 80, "col-oral": 78 },
  6: { "col-poster": 58, "col-oral": 55 },
  7: { "col-poster": 52, "col-oral": 60 },
  8: { "col-poster": 86, "col-oral": 90 },
};

/* ---------------------------- EXPORT AGRUPADO ---------------------------- */
export const seedIngles = {
  curso,
  estudiantes,
  planificacion,
  competencias,
  contenidos,
  semanas,
  instrumentos,
  apoyos,
  columnasRegistro,
  notas,
};

export default seedIngles;
