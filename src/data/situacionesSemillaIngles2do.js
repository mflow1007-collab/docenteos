/**
 * situacionesSemillaIngles2do — Situaciones de aprendizaje simuladas que
 * DocenteOS propone para Inglés 2do de Secundaria (Etapa 4 de
 * docs/DISENO_CORAZON_DOCENTEOS.md, reglas 4.1 y 4.7).
 *
 * Esto NO es texto oficial: es banco pedagógico de DocenteOS, pendiente de la
 * aprobación de César. Cada situación trae sus elementos por separado (Guía
 * 1.2.2): problema, contexto, producto, punto de llegada; la estrategia y el
 * rol del estudiante los pone la estrategia que elija el docente. El problema
 * es una necesidad que el idioma ayuda a resolver, nunca "no saben inglés".
 * `rasgos` son las respuestas a los criterios de la Guía 1.2.4 con que
 * DocenteOS recomienda la estrategia (ver CRITERIOS_ESTRATEGIA en
 * situacionAprendizajeService.js). `secciones` = secciones del producto (4.7);
 * `propositos` = qué contiene cada una, por nombre (Etapa 1A de
 * docs/DISENO_APRENDIZAJE_DOCENTEOS.md): la IA lo recibe junto al nombre.
 * `piezas` = la pieza visible que cada sección deja en el producto (auditoría
 * de «Alimentación», 2026-11-03); el "aporteProducto" de la clase la avanza.
 * Lugar (regla de César, 2026-10-29): `{centro}` = el centro donde el docente
 * imparte docencia (dato del formulario); `{comunidad}` solo cuando la
 * situación ocurre fuera del centro (rasgos.contexto = "comunidad").
 *
 * Módulo PURO. Lo consume situacionAprendizajeService.js.
 */

export const SITUACIONES_SEMILLA_INGLES_2DO = [
  {
    id: "ing2-escuela-guia",
    tema: "Escuela y educación",
    contexto: "Cada año, {centro} recibe a estudiantes de nuevo ingreso y a visitantes, algunos de ellos de habla inglesa.",
    problema: "En los primeros días muchos se pierden: no saben dónde quedan la biblioteca, la dirección o la cafetería ni a quién pedir ayuda, y el centro no tiene ninguna orientación en inglés.",
    producto: {
      nombre: "Our School Survival Guide",
      descripcion: "una guía bilingüe de la escuela",
      audiencia: "los estudiantes de nuevo ingreso y los visitantes",
    },
    puntoDeLlegada: "Así fortalecen la empatía y el sentido de pertenencia, y asumen la responsabilidad de acoger y orientar a los demás.",
    competenciasLlegada: ["etica_ciudadana", "desarrollo_personal"],
    rasgos: { naturaleza: "necesidad", contexto: "escuela", alcance: "resuelve", llegada: "actuar" },
    secciones: ["Welcome", "Important Places", "School Directions", "Asking for Help", "School Success Tips", "Final Recommendation"],
    propositos: {
      "Welcome": "quiénes somos y para qué sirve la guía (presentación del centro al recién llegado)",
      "Important Places": "qué lugares tiene el centro y qué se hace en cada uno (biblioteca, dirección, cafetería…)",
      "School Directions": "cómo llegar a esos lugares desde la entrada (indicaciones paso a paso)",
      "Asking for Help": "a quién acudir y cómo pedir ayuda en inglés (frases y mini-diálogos)",
      "School Success Tips": "consejos para adaptarse y que les vaya bien (horario, normas, hábitos)",
      "Final Recommendation": "el mensaje de cierre del grupo al recién llegado (la recomendación principal)",
    },
    piezas: {
      "Welcome": "una carta de bienvenida breve, firmada por el grupo",
      "Important Places": "fichas de cada lugar (nombre en inglés, dibujo o foto, para qué sirve)",
      "School Directions": "el plano del centro con las rutas y las indicaciones escritas",
      "Asking for Help": "una tarjeta de bolsillo con frases para pedir ayuda y a quién acudir",
      "School Success Tips": "un póster «Top tips» con los consejos",
      "Final Recommendation": "un párrafo de cierre del grupo para el recién llegado",
    },
  },
  {
    id: "ing2-rutinas-plan",
    tema: "Actividades de la vida diaria",
    contexto: "En {centro}, varios estudiantes de 2do de Secundaria, además de estudiar, ayudan en la casa o en el negocio familiar.",
    problema: "Muchos llegan tarde, duermen poco o no terminan sus tareas, y no saben cómo organizar su día entre la escuela, la casa y esas responsabilidades.",
    producto: {
      nombre: "Our Healthy Routines Plan",
      descripcion: "un plan de rutinas y horarios para el curso",
      audiencia: "las familias y el consejo de curso",
    },
    puntoDeLlegada: "Así aprenden a cuidar su descanso y su tiempo, y a tomar decisiones responsables sobre su bienestar.",
    competenciasLlegada: ["desarrollo_personal", "ambiental_salud"],
    rasgos: { naturaleza: "problema_abierto", contexto: "escuela", alcance: "propone", llegada: "participar" },
    secciones: ["Our Daily Routines", "What We Found", "Problems and Causes", "Our Healthy Schedule", "Tips for Families"],
    propositos: {
      "Our Daily Routines": "cómo es hoy un día típico del grupo (rutinas y horarios reales)",
      "What We Found": "qué datos salieron al comparar las rutinas (encuesta: horas de sueño, llegadas tarde, tareas)",
      "Problems and Causes": "qué problemas se repiten y por qué ocurren (causas)",
      "Our Healthy Schedule": "el horario equilibrado que proponemos (escuela, casa, descanso)",
      "Tips for Families": "cómo pueden las familias apoyar ese horario (consejos dirigidos a ellas)",
    },
    piezas: {
      "Our Daily Routines": "la línea de tiempo de un día típico de cada estudiante",
      "What We Found": "un gráfico de barras con los resultados de la encuesta y frases que lo explican",
      "Problems and Causes": "una tabla problema → causa",
      "Our Healthy Schedule": "el horario semanal equilibrado",
      "Tips for Families": "un folleto de consejos para las familias",
    },
  },
  {
    id: "ing2-alimentacion-menu",
    tema: "Alimentación",
    contexto: "Los comedores y colmados de {comunidad} reciben a turistas y voluntarios extranjeros.",
    problema: "Esos negocios no tienen menús ni carteles en inglés: los visitantes no saben qué piden y los dueños pierden clientes.",
    producto: {
      nombre: "Our Community Food Guide",
      descripcion: "menús bilingües y recomendaciones para los comedores del barrio",
      audiencia: "los dueños de los comedores y los visitantes",
    },
    puntoDeLlegada: "Así valoran la comida de su comunidad, promueven una alimentación sana y se comprometen con el progreso de su entorno.",
    competenciasLlegada: ["etica_ciudadana", "ambiental_salud"],
    rasgos: { naturaleza: "necesidad", contexto: "comunidad", alcance: "propone", llegada: "actuar" },
    secciones: ["Our Local Food", "Interviews with Owners", "Bilingual Menus", "Healthy Choices", "Ordering Food"],
    propositos: {
      "Our Local Food": "qué platos y alimentos típicos ofrece el barrio (descripción de la comida local)",
      "Interviews with Owners": "qué cuentan los dueños sobre su negocio y sus clientes (preguntas y respuestas de la entrevista)",
      "Bilingual Menus": "los menús en español e inglés: nombre, descripción y precio de cada plato",
      "Healthy Choices": "qué platos y alimentos recomendamos y por qué (alternativas más sanas)",
      "Ordering Food": "cómo pedir esos platos en inglés (diálogos de pedido entre cliente y dueño)",
    },
    piezas: {
      "Our Local Food": "fichas de los platos típicos (nombre, ingredientes principales, dibujo o foto)",
      "Interviews with Owners": "entrevistas transcritas (preguntas y respuestas de cada dueño)",
      "Bilingual Menus": "el menú bilingüe de cada comedor (plato, descripción, precio)",
      "Healthy Choices": "etiquetas «Healthy pick» junto a los platos del menú, cada una con su razón y la alternativa más sana",
      "Ordering Food": "un diálogo de pedido modelo (cliente–dueño), listo para practicar",
    },
  },
];
