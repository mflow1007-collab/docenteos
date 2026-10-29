/**
 * situacionesSemillaIngles1ro — Situaciones de aprendizaje simuladas que
 * DocenteOS propone para Inglés 1ro de Secundaria (mismo formato que
 * situacionesSemillaIngles2do.js, reglas 4.1 y 4.7).
 *
 * Esto NO es texto oficial: es banco pedagógico de DocenteOS, PROPUESTO y
 * pendiente de la aprobación de César. Orientadas a lo que piden los
 * indicadores de 1ro: información personal, entorno inmediato, actividades
 * cotidianas y preferencias. El problema es una necesidad que el idioma ayuda
 * a resolver, nunca "no saben inglés". `{centro}` / `{comunidad}`: regla de
 * César del 2026-10-29 (ver el archivo de 2do).
 *
 * Módulo PURO. Lo consume situacionAprendizajeService.js.
 */

export const SITUACIONES_SEMILLA_INGLES_1RO = [
  {
    id: "ing1-escuela-bienvenida",
    tema: "Escuela y educación",
    contexto: "En 1ro de Secundaria, {centro} reúne a estudiantes de distintas escuelas primarias y recibe a voluntarios de habla inglesa.",
    problema: "Muchos no se conocen ni conocen los espacios y horarios del centro, y los voluntarios no saben quién es quién en el curso.",
    producto: {
      nombre: "Our Class Welcome Book",
      descripcion: "un libro bilingüe de presentación del curso y de la escuela",
      audiencia: "los compañeros del curso y los voluntarios que visitan el centro",
    },
    puntoDeLlegada: "Así se reconocen como grupo, se presentan con respeto y hacen sentir bienvenidos a los demás.",
    competenciasLlegada: ["etica_ciudadana", "desarrollo_personal"],
    rasgos: { naturaleza: "necesidad", contexto: "escuela", alcance: "resuelve", llegada: "actuar" },
    secciones: ["Who We Are", "Our School Places", "Our School Day", "Our Favorite Things", "Welcome Messages"],
  },
  {
    id: "ing1-rutinas-calendario",
    tema: "Actividades de la vida diaria",
    contexto: "En {centro}, los estudiantes de 1ro de Secundaria tienen horarios muy distintos fuera de clase: algunos ayudan en la casa, otros practican deporte o cuidan a hermanos menores.",
    problema: "El curso no logra organizar actividades comunes ni grupos de estudio porque nadie sabe qué hacen los demás ni cuándo tienen tiempo libre.",
    producto: {
      nombre: "Our Class Daily Life Calendar",
      descripcion: "un calendario bilingüe con las rutinas y el tiempo libre del curso",
      audiencia: "el curso y el profesor guía",
    },
    puntoDeLlegada: "Así aprenden a respetar el tiempo de los demás y a organizarse para cumplir compromisos comunes.",
    competenciasLlegada: ["desarrollo_personal", "etica_ciudadana"],
    rasgos: { naturaleza: "necesidad", contexto: "escuela", alcance: "resuelve", llegada: "participar" },
    secciones: ["My Morning", "My School Day", "My Afternoon", "Our Free Time", "Our Class Calendar"],
  },
  {
    id: "ing1-identificacion-perfiles",
    tema: "Identificación personal",
    contexto: "En {centro} comienza un intercambio de cartas con una escuela de un país de habla inglesa.",
    problema: "La escuela amiga pidió conocer al grupo antes de empezar y el curso no tiene ningún material que cuente quiénes son, qué les gusta ni cómo es el lugar donde viven.",
    producto: {
      nombre: "Our Pen Pal Profiles",
      descripcion: "perfiles personales bilingües para el intercambio de cartas",
      audiencia: "los estudiantes de la escuela amiga",
    },
    puntoDeLlegada: "Así valoran su identidad y su origen, y aprenden a presentarse con cortesía y respeto ante personas de otra cultura.",
    competenciasLlegada: ["etica_ciudadana", "desarrollo_personal"],
    rasgos: { naturaleza: "necesidad", contexto: "aula", alcance: "resuelve", llegada: "actuar" },
    secciones: ["About Me", "My Family", "My Likes and Dislikes", "My Community", "Questions for You"],
  },
];
