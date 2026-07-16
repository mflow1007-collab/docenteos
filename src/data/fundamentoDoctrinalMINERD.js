/**
 * fundamentoDoctrinalMINERD — Doctrina del Diseño Curricular por NIVEL (B1).
 *
 * Módulo PURO (testeable en Node). Es el FALLBACK hardcodeado del fundamento
 * que cada mente de DocenteOS interioriza desde su rol (el Asesor orienta,
 * el Motor compone, las validaciones supervisan). La versión editable sin
 * deploy vive en Firestore: config/fundamento-doctrinal (un campo por nivel);
 * fundamentoDoctrinalService resuelve override → este fallback.
 *
 * REGLA DE ORO (transversal, nunca se edita fuera): el fundamento da el
 * ENFOQUE del nivel; el CONTENIDO (competencias, indicadores, vocabulario,
 * conceptos) sale SIEMPRE de la malla oficial — ninguna mente lo inventa.
 */

// Común a todos los niveles: el marco del Diseño Curricular dominicano
export const FUNDAMENTO_BASE =
  'MARCO CURRICULAR MINERD (República Dominicana): currículo por COMPETENCIAS con enfoque ' +
  'histórico-cultural y socio-crítico. Las 7 Competencias Fundamentales (Ética y Ciudadana; ' +
  'Comunicativa; Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Científica y ' +
  'Tecnológica; Ambiental y de la Salud; Desarrollo Personal y Espiritual) se desarrollan a través ' +
  'de las competencias específicas de cada área y grado. El aprendizaje es SIGNIFICATIVO y ' +
  'FUNCIONAL: parte de situaciones reales del contexto del estudiante, integra conceptos, ' +
  'procedimientos, actitudes y valores, y se evidencia en producciones concretas. La evaluación es ' +
  'CONTINUA, FORMATIVA y PARTICIPATIVA (auto, co y heteroevaluación), con criterios derivados de ' +
  'los indicadores de logro oficiales — nunca de contenido inventado.';

export const FUNDAMENTO_POR_NIVEL = {
  Inicial: 'NIVEL INICIAL (0-6 años; Preprimario obligatorio): el JUEGO es la estrategia ' +
    'pedagógica por excelencia — toda experiencia de aprendizaje se organiza como juego, ' +
    'exploración y expresión, nunca como clase magistral. Se atiende el desarrollo INTEGRAL ' +
    '(motor, socioemocional, cognitivo, comunicativo) mediante rutinas estables, ambientes ' +
    'letrados y experiencias concretas con material manipulable. El docente es mediador afectivo: ' +
    'modela el lenguaje, acompaña sin apurar y vincula a la FAMILIA como primer agente educativo. ' +
    'La evaluación es exclusivamente por OBSERVACIÓN (registro anecdótico, listas de cotejo de ' +
    'desarrollo), sin calificaciones numéricas ni pruebas escritas.',

  Primaria: 'NIVEL PRIMARIO (6-12 años, dos ciclos): en el Primer Ciclo (1ro-3ro) la prioridad ' +
    'nacional es la ALFABETIZACIÓN inicial (lectoescritura y matemática básica); en el Segundo ' +
    'Ciclo (4to-6to) se consolidan la comprensión, la producción escrita y el razonamiento. El ' +
    'estudiante aprende de lo CONCRETO a lo abstracto: manipulación, juego reglado, dramatización ' +
    'y trabajo cooperativo antes que definición formal. El docente (generalista, tutor de aula) ' +
    'integra áreas alrededor de situaciones de la vida cotidiana y de la comunidad. La evaluación ' +
    'formativa con retroalimentación INMEDIATA y descriptiva prevalece sobre la nota; los ' +
    'registros de asistencia y acompañamiento son generales del día, no por asignatura.',

  Secundaria: 'NIVEL SECUNDARIO (12-18 años, dos ciclos: 1ro-3ro común; 4to-6to por modalidades): ' +
    'el adolescente desarrolla pensamiento ABSTRACTO, argumentación y autonomía — las actividades ' +
    'exigen producción intelectual propia (analizar, debatir, proyectar), no repetición. Cada ' +
    'docente enseña SU área con las competencias específicas del grado y articula con el proyecto ' +
    'de vida del estudiante; la contextualización a la comunidad y el PRODUCTO final tangible dan ' +
    'sentido al trabajo por unidades. La evaluación por competencias usa criterios e indicadores ' +
    'oficiales con instrumentos variados (rúbricas, portafolio, pruebas situadas); la calificación ' +
    'mínima de logro es 70 y cada docente registra la asistencia de su propia clase.',
};

/** Nivel canónico desde texto libre ("1ro Secundaria", "Kínder"…) → clave o "". */
export const nivelCanonico = (nivel = "") => {
  const t = String(nivel || "").toLowerCase();
  if (t.includes("secundaria") || t.includes("secundario")) return "Secundaria";
  if (t.includes("primaria") || t.includes("primario")) return "Primaria";
  if (t.includes("inicial") || t.includes("kinder") || t.includes("kínder") || t.includes("preprimario") || t.includes("pre-kinder")) return "Inicial";
  return "";
};

/**
 * Fundamento COMPLETO (base + nivel) desde el fallback local. PURO.
 * Sin nivel reconocible devuelve base + Secundaria (nivel más usado hoy),
 * marcándolo: el llamador puede decidir si mostrar la advertencia.
 */
export const fundamentoLocal = (nivel = "") => {
  const clave = nivelCanonico(nivel) || "Secundaria";
  return {
    nivel: clave,
    nivelAsumido: !nivelCanonico(nivel),
    texto: `${FUNDAMENTO_BASE}\n\n${FUNDAMENTO_POR_NIVEL[clave]}`,
    fuente: "local",
  };
};
