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

// Común a todos los niveles: el marco del Diseño Curricular dominicano.
// Lenguaje OFICIAL de la Adecuación Curricular (MINERD, 2023): la definición
// de competencia es textual (p.18); enfoques y evaluación, de las pp. 8 y 31-33.
export const FUNDAMENTO_BASE =
  'MARCO CURRICULAR MINERD (República Dominicana): currículo por COMPETENCIAS con la convergencia ' +
  'de tres enfoques: Histórico-Cultural, Socio-Crítico y de Competencias. Competencia es "la ' +
  'capacidad para actuar de manera eficaz y autónoma en contextos diversos movilizando de forma ' +
  'integrada conceptos, procedimientos, actitudes y valores" (Adecuación Curricular, 2023). Las 7 ' +
  'Competencias Fundamentales (Ética y Ciudadana; Comunicativa; Pensamiento Lógico, Creativo y ' +
  'Crítico; Resolución de Problemas; Científica y Tecnológica; Ambiental y de la Salud; Desarrollo ' +
  'Personal y Espiritual) son transversales y se concretan mediante las competencias específicas de ' +
  'cada área y grado. El aprendizaje es SIGNIFICATIVO y FUNCIONAL: parte de situaciones reales del ' +
  'contexto del estudiante, integra conceptos, procedimientos, actitudes y valores, y se evidencia ' +
  'en producciones concretas. La evaluación es CONTINUA y PARTICIPATIVA — diagnóstica, formativa y ' +
  'sumativa; auto, co y heteroevaluación — con criterios derivados de los indicadores de logro ' +
  'oficiales, y el error se trata como oportunidad constructiva de reflexión y metacognición. ' +
  'El CONTENIDO curricular sale siempre de la malla oficial — nunca se inventa.';

// FUENTES por nivel:
//   Secundaria → Adecuación Curricular Nivel Secundario (MINERD, agosto 2023),
//     aportada por el dueño el 2026-07-16 (pp. 11-17: naturaleza del nivel,
//     ciclos, dimensiones del adolescente, Nivel de Dominio III).
//   Primaria e Inicial → PROVISIONALES (redactados desde el marco general);
//     PENDIENTE afinarlos cuando el dueño aporte sus Adecuaciones oficiales.
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

  Secundaria: 'NIVEL SECUNDARIO (12-18 años, dos ciclos: 1ro-3ro común; 4to-6to por modalidades ' +
    'Académica, Técnico-Profesional y en Artes): se desarrolla el TERCER Nivel de Dominio de las ' +
    'Competencias Fundamentales. El adolescente construye pensamiento formal e hipotético-deductivo ' +
    '(ABSTRACTO): elabora sistemas y teorías, argumenta, contrasta variables y cuestiona — las ' +
    'actividades exigen producción intelectual propia (analizar, debatir, proyectar), no repetición. ' +
    'Su desarrollo abarca las dimensiones física, cognitiva, socio-afectiva y moral: busca autonomía ' +
    'y vínculo con pares, y necesita canalizar su actitud crítica en una cultura del cuestionamiento ' +
    'con espacios de reflexión y metacognición. Cada docente enseña SU área con las competencias ' +
    'específicas del grado y articula con el proyecto de vida del estudiante; la contextualización a ' +
    'la comunidad y el PRODUCTO final tangible dan sentido al trabajo por unidades. La evaluación por ' +
    'competencias usa criterios e indicadores oficiales con instrumentos variados (rúbricas, ' +
    'portafolio, pruebas situadas); la calificación mínima de logro es 70 y cada docente registra la ' +
    'asistencia de su propia clase.',
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
