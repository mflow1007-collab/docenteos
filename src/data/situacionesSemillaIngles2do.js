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
 * situacionAprendizajeService.js). `secciones` = secciones del producto (4.7).
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
  },
];
