/**
 * naturalezaAreasMINERD.js
 *
 * BRÚJULA DE DISEÑO por área — el "personaje experto" del generador.
 *
 * Fuente: Adecuación Curricular Nivel Secundario 2023 (págs. 9-10, enfoque
 * disciplinar de cada área) + Referente de Planificación por Proyecto (2022).
 *
 * Cada área del currículo dominicano construye conocimiento de forma DISTINTA.
 * Solo Lenguas Extranjeras progresa por estructura gramatical; las demás áreas
 * tienen su propia secuencia disciplinar, sus verbos, sus procesos cognitivos y
 * sus productos característicos. Este módulo es la FUENTE ÚNICA que consumen:
 *   - el generador LLM (phaseAService.buildBatchPrompt) para orientar el prompt,
 *   - el generador determinístico (unidadAprendizajeService) para el fallback.
 *
 * Módulo PURO (sin dependencias). Resolución por asignatura → área → default.
 */

// Enfoque disciplinar y procesos propios de cada área (documento oficial).
export const NATURALEZA_AREA = {
  "Lengua Española": {
    enfoque: "Textual, funcional y comunicativo: usar la lengua para comunicar, con el TEXTO como eje vertebrador.",
    // Verbos/procesos propios del área (para orientar la redacción de actividades)
    procesos: ["comprenden textos", "analizan el propósito y la estructura del género", "planifican", "redactan un borrador", "revisan y mejoran", "editan y publican para un lector real"],
    // Mecánicas nombradas típicas del área (no de idioma)
    tecnicas: ["Análisis de texto modelo", "Taller de escritura", "Círculo de lectores", "Debate", "Producción textual guiada", "Revisión entre pares"],
    productos: ["texto producido", "borrador revisado", "análisis del texto modelo", "producción textual publicada"],
    focoEtiqueta: "Tipo de texto / función comunicativa",
  },
  "Matemática": {
    enfoque: "Resolución de problemas: la matemática como herramienta para la vida, herramienta intelectual y de conexión con otras ciencias.",
    procesos: ["analizan una situación-problema del contexto", "representan con material concreto, gráficos o tablas", "aplican el procedimiento", "argumentan cada paso", "comparan estrategias de solución", "verifican y comunican resultados"],
    tecnicas: ["Resolución de problemas en parejas", "Estaciones de problemas", "Modelación matemática", "Reto de estimación", "Galería de estrategias", "Defensa del procedimiento"],
    productos: ["procedimiento resuelto y verificado", "representación matemática", "comparación de estrategias", "modelo de una situación real"],
    focoEtiqueta: "Concepto o procedimiento matemático",
  },
  "Ciencias Sociales": {
    enfoque: "La sociedad como conjunto de relaciones sociales; la persona en la sociedad, con las fuentes y la ciudadanía como centro.",
    procesos: ["analizan un problema o proceso social", "leen y contrastan fuentes (texto, mapa, imagen, dato)", "establecen relaciones de causa y consecuencia", "localizan en el tiempo y el espacio", "argumentan una postura con evidencias", "proponen una acción ciudadana"],
    tecnicas: ["Análisis de fuentes", "Estudio de caso", "Debate estructurado", "Línea de tiempo colaborativa", "Cartografía / mapeo", "Mesa redonda", "Proyecto de investigación social"],
    productos: ["análisis de fuentes", "organizador de causas y consecuencias", "argumento ciudadano fundamentado", "línea de tiempo o mapa temático"],
    focoEtiqueta: "Concepto, hecho o proceso social",
  },
  "Ciencias de la Naturaleza": {
    enfoque: "Indagación científica: explicar problemas y fenómenos de la naturaleza mediante el razonamiento lógico y el método científico.",
    procesos: ["observan un fenómeno", "formulan una pregunta investigable y una hipótesis", "diseñan o ejecutan una exploración o experimento", "miden, registran y organizan datos", "analizan evidencias", "elaboran una explicación y la comunican"],
    tecnicas: ["Laboratorio guiado", "Indagación / experimento", "Estación de observación", "Feria científica", "Modelo o maqueta", "Registro de datos", "Estudio de caso científico"],
    productos: ["registro de observación y datos", "explicación con evidencias", "informe de indagación", "modelo o maqueta explicativa"],
    focoEtiqueta: "Fenómeno, concepto o procedimiento científico",
  },
  "Educación Artística": {
    enfoque: "Expresión artística y apreciación estética como competencias para la vida.",
    procesos: ["aprecian una obra o referente", "exploran materiales, técnicas y lenguajes artísticos", "crean una producción propia", "expresan ideas, emociones e identidad", "revisan con criterios estéticos", "exhiben e interpretan su obra"],
    tecnicas: ["Apreciación de referente", "Taller de exploración técnica", "Creación guiada", "Galería o exhibición", "Bitácora creativa", "Puesta en escena"],
    productos: ["pieza artística en proceso", "bitácora creativa", "producción artística final", "interpretación o puesta en escena"],
    focoEtiqueta: "Técnica, lenguaje o elemento estético",
  },
  "Educación Física": {
    enfoque: "El cuerpo y el movimiento como ejes de la acción educativa, desde un enfoque holístico de salud, colaboración y autocuidado.",
    procesos: ["realizan una activación corporal", "observan la demostración técnica", "ejecutan y practican la habilidad motriz", "aplican reglas y estrategias en un juego o reto", "cooperan con sus compañeros", "reflexionan sobre el esfuerzo y los hábitos saludables"],
    tecnicas: ["Activación corporal", "Circuito motriz", "Juego cooperativo", "Reto o desafío motor", "Práctica en parejas con pauta", "Torneo interno"],
    productos: ["ejecución motriz observada", "reto motor cooperativo", "registro de progreso físico", "reflexión de salud y desempeño"],
    focoEtiqueta: "Habilidad motriz o hábito saludable",
  },
  "Formación Integral Humana y Religiosa": {
    enfoque: "Desarrollo integral de la persona en sus dimensiones antropológica, axiológica, religiosa y trascendente.",
    procesos: ["comparten una experiencia humana cercana", "dialogan de forma reflexiva sobre un caso o texto de valor", "analizan los valores y dilemas en juego", "relacionan principios con la vida", "reconocen la dignidad humana", "asumen un compromiso personal o comunitario"],
    tecnicas: ["Diálogo reflexivo", "Análisis de caso de vida", "Cine-foro", "Sociodrama de valores", "Círculo de reflexión", "Proyecto solidario"],
    productos: ["reflexión escrita", "diálogo argumentado", "compromiso personal o comunitario observable"],
    focoEtiqueta: "Valor, dilema o dimensión humana",
  },
};

// Perfil por defecto para áreas no listadas (o mallas atípicas).
export const NATURALEZA_DEFAULT = {
  enfoque: "Aprendizaje significativo por competencias, contextualizado y orientado a evidencias y a la resolución de problemas del contexto.",
  procesos: ["exploran una situación del contexto", "activan saberes previos", "construyen el aprendizaje central con ejemplos", "aplican lo aprendido en una tarea", "revisan con criterios compartidos", "socializan su producción"],
  tecnicas: ["Estudio de caso", "Aprendizaje basado en problemas", "Proyecto", "Estaciones de trabajo", "Galería de aprendizaje", "Debate"],
  productos: ["producción del proceso", "evidencia de aplicación", "avance del producto"],
  focoEtiqueta: "Concepto o procedimiento central",
};

const _norm = (s = "") =>
  String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/**
 * Resuelve la naturaleza disciplinar por asignatura → área → default.
 * Lenguas Extranjeras (Inglés/Francés) NO usa esta tabla: su naturaleza
 * comunicativa la maneja el flag esIdioma en el generador. Este módulo cubre
 * el resto de las áreas.
 */
export const resolverNaturalezaArea = (area = "", asignatura = "") => {
  const clave = _norm(`${asignatura} ${area}`);
  if (/matematica/.test(clave)) return NATURALEZA_AREA["Matemática"];
  if (/naturaleza|biolog|quimic|fisica y|ciencias de la/.test(clave)) return NATURALEZA_AREA["Ciencias de la Naturaleza"];
  if (/sociales|historia|geograf|ciudadan|filosof/.test(clave)) return NATURALEZA_AREA["Ciencias Sociales"];
  if (/lengua espanola|espanol|lengua materna/.test(clave)) return NATURALEZA_AREA["Lengua Española"];
  if (/artistica|\barte\b|musica|plastica|teatro|danza|escenica|visual/.test(clave)) return NATURALEZA_AREA["Educación Artística"];
  if (/educacion fisica|deporte|motriz/.test(clave)) return NATURALEZA_AREA["Educación Física"];
  if (/religiosa|humana|integral|valores|\betica\b|espiritual/.test(clave)) return NATURALEZA_AREA["Formación Integral Humana y Religiosa"];
  return NATURALEZA_DEFAULT;
};

export default { NATURALEZA_AREA, NATURALEZA_DEFAULT, resolverNaturalezaArea };
