/**
 * ⚠️  ARCHIVO NO OFICIAL — NO USAR COMO FUENTE CURRICULAR
 *
 * Los textos de este archivo NO provienen del Diseño Curricular MINERD.
 * Son aproximaciones redactadas para uso interno de formato/estructura.
 *
 * Para competencias e indicadores OFICIALES, usa únicamente la malla
 * cargada en Firestore (curricularContent) a través de
 * getCurricularContentForUnit() en bancoConocimientoService.js.
 *
 * Este archivo puede usarse para:
 *   - Contenido de MUESTRA en vistas de desarrollo/preview
 *   - Pruebas unitarias de formato HTML/PDF
 * NUNCA para documentos pedagógicos reales.
 */

// ─── MATEMÁTICA ───────────────────────────────────────────────────────────────

const INDICADORES_MATEMATICA = {
  "1ro": {
    competenciaEspecifica:
      "Aplica operaciones con números reales y expresiones algebraicas básicas para resolver problemas del entorno, representar y comunicar relaciones matemáticas usando diferentes registros de representación.",
    indicadoresPorDimension: {
      conceptual: [
        "Identifica y clasifica los subconjuntos de los números reales y sus propiedades fundamentales.",
        "Reconoce las propiedades de las operaciones algebraicas básicas y la jerarquía de operaciones.",
        "Describe las características de las figuras geométricas planas y sus elementos.",
      ],
      procedimental: [
        "Realiza operaciones con números reales aplicando correctamente la jerarquía de operaciones.",
        "Resuelve ecuaciones e inecuaciones lineales con una incógnita, verificando la solución obtenida.",
        "Calcula perímetros, áreas y medidas angulares de figuras geométricas planas en contextos reales.",
      ],
      actitudinal: [
        "Valora la matemática como herramienta para comprender y resolver situaciones del entorno cotidiano.",
        "Muestra perseverancia y orden al enfrentar problemas matemáticos desafiantes.",
      ],
    },
  },
  "2do": {
    competenciaEspecifica:
      "Analiza y representa funciones y relaciones matemáticas, resuelve ecuaciones cuadráticas e interpreta datos estadísticos descriptivos para tomar decisiones informadas en situaciones contextualizadas del entorno.",
    indicadoresPorDimension: {
      conceptual: [
        "Identifica las características y propiedades de las funciones lineales y cuadráticas en el plano cartesiano.",
        "Explica los métodos de resolución de ecuaciones cuadráticas y sus condiciones de aplicación.",
        "Describe las medidas de tendencia central y dispersión estadística y su interpretación contextual.",
      ],
      procedimental: [
        "Representa gráficamente funciones lineales y cuadráticas interpretando el comportamiento de sus parámetros.",
        "Resuelve ecuaciones cuadráticas usando factorización, fórmula general y completación del cuadrado.",
        "Calcula e interpreta medidas estadísticas descriptivas (media, mediana, moda, rango) en situaciones reales.",
      ],
      actitudinal: [
        "Demuestra interés por relacionar los conceptos matemáticos con situaciones concretas del entorno.",
        "Trabaja colaborativamente en la resolución de problemas, valorando las estrategias diversas de los compañeros.",
      ],
    },
  },
  "3ro": {
    competenciaEspecifica:
      "Aplica conceptos de geometría analítica, trigonometría básica y probabilidad para modelar situaciones del entorno, argumentar procedimientos matemáticos y comunicar resultados con precisión y rigor.",
    indicadoresPorDimension: {
      conceptual: [
        "Identifica y clasifica las razones trigonométricas y sus relaciones en el triángulo rectángulo.",
        "Explica los elementos de la circunferencia y las cónicas básicas en el plano cartesiano.",
        "Describe los conceptos de probabilidad clásica, sus propiedades y sus condiciones de aplicación.",
      ],
      procedimental: [
        "Calcula razones trigonométricas y resuelve triángulos rectángulos aplicando el teorema de Pitágoras.",
        "Determina ecuaciones de rectas y circunferencias a partir de sus características y condiciones dadas.",
        "Calcula probabilidades de eventos simples y compuestos usando técnicas de conteo.",
      ],
      actitudinal: [
        "Valora la precisión y el rigor en el razonamiento matemático como base para argumentar y justificar resultados.",
        "Muestra apertura para explorar estrategias de resolución diversas y comunicarlas con claridad.",
      ],
    },
  },
  "4to": {
    competenciaEspecifica:
      "Comprende y aplica conceptos de álgebra avanzada, vectores y estadística inferencial básica para resolver situaciones complejas, argumentar matemáticamente y establecer conexiones entre representaciones y contextos.",
    indicadoresPorDimension: {
      conceptual: [
        "Define y clasifica los números complejos y describe sus operaciones en forma rectangular y polar.",
        "Explica las propiedades de los vectores en el plano y en el espacio y sus operaciones fundamentales.",
        "Describe los principios de la distribución normal y la inferencia estadística básica.",
      ],
      procedimental: [
        "Opera con números complejos en forma rectangular y polar, convirtiendo entre representaciones.",
        "Realiza operaciones con vectores: suma, resta, producto escalar y vectorial en situaciones aplicadas.",
        "Interpreta distribuciones de probabilidad y aplica inferencia estadística básica a datos reales.",
      ],
      actitudinal: [
        "Muestra disposición para analizar situaciones con pensamiento abstracto y rigor lógico-matemático.",
        "Valora la estadística como herramienta para la toma de decisiones fundamentadas en datos.",
      ],
    },
  },
  "5to": {
    competenciaEspecifica:
      "Aplica conceptos fundamentales del cálculo diferencial y el análisis de sucesiones y series para modelar, analizar y resolver situaciones de cambio y acumulación en contextos reales, científicos y tecnológicos.",
    indicadoresPorDimension: {
      conceptual: [
        "Define el concepto de límite y la continuidad de una función y sus condiciones de existencia.",
        "Explica el concepto de derivada como razón de cambio e interpreta su significado geométrico y contextual.",
        "Identifica y clasifica sucesiones y series aritméticas y geométricas, y determina su convergencia.",
      ],
      procedimental: [
        "Calcula límites de funciones usando técnicas algebraicas y aplica las reglas de derivación.",
        "Usa la derivada para determinar extremos, crecimiento, decrecimiento y concavidad de funciones.",
        "Calcula la suma de sucesiones y series en situaciones aplicadas del entorno real.",
      ],
      actitudinal: [
        "Valora el cálculo diferencial como herramienta para la modelación científica y el pensamiento analítico.",
        "Muestra perseverancia y creatividad al enfrentar problemas de análisis matemático complejo.",
      ],
    },
  },
  "6to": {
    competenciaEspecifica:
      "Integra conceptos del cálculo integral, matemática financiera y álgebra lineal para resolver situaciones complejas, modelar fenómenos y tomar decisiones informadas en contextos académicos y socioeconómicos.",
    indicadoresPorDimension: {
      conceptual: [
        "Explica el concepto de integral definida e indefinida, el Teorema Fundamental del Cálculo y sus aplicaciones.",
        "Describe los conceptos de matemática financiera: interés simple, compuesto, anualidades y amortización.",
        "Define matrices, determinantes y sistemas de ecuaciones y explica sus propiedades algebraicas.",
      ],
      procedimental: [
        "Calcula integrales indefinidas y definidas usando técnicas de integración directa y por sustitución.",
        "Resuelve problemas de interés compuesto, valor actual y futuro de anualidades en situaciones reales.",
        "Opera con matrices y resuelve sistemas de ecuaciones usando eliminación de Gauss y regla de Cramer.",
      ],
      actitudinal: [
        "Valora la matemática financiera como herramienta para la planificación económica y la toma de decisiones responsable.",
        "Demuestra rigor, autonomía y creatividad al resolver problemas matemáticos de alta complejidad.",
      ],
    },
  },
};

// ─── CIENCIAS DE LA NATURALEZA ────────────────────────────────────────────────

const INDICADORES_CIENCIAS = {
  "1ro": {
    competenciaEspecifica:
      "Indaga sobre los niveles de organización de la vida, los procesos celulares fundamentales y las interacciones en los ecosistemas, usando la metodología científica para formular explicaciones basadas en evidencia.",
    indicadoresPorDimension: {
      conceptual: [
        "Identifica los niveles de organización de la materia viva y las características comunes de los seres vivos.",
        "Describe la estructura y las funciones de la célula procariota y eucariota.",
        "Explica las relaciones entre los componentes bióticos y abióticos de un ecosistema.",
      ],
      procedimental: [
        "Formula hipótesis y diseña observaciones para investigar fenómenos biológicos del entorno.",
        "Utiliza el microscopio o representaciones para observar, registrar y describir estructuras celulares.",
        "Construye cadenas y redes tróficas a partir de la observación del entorno natural local.",
      ],
      actitudinal: [
        "Muestra respeto y cuidado por los seres vivos y la biodiversidad del entorno natural.",
        "Demuestra actitud indagadora y rigor en la observación y registro de datos científicos.",
      ],
    },
  },
  "2do": {
    competenciaEspecifica:
      "Analiza los procesos fisiológicos de los organismos multicelulares, los mecanismos de la herencia genética básica y su relación con la salud humana, usando la indagación científica para construir explicaciones fundamentadas.",
    indicadoresPorDimension: {
      conceptual: [
        "Describe los sistemas del cuerpo humano y las funciones de sus órganos principales.",
        "Explica los conceptos básicos de la herencia genética: genes, alelos, cromosomas y ADN.",
        "Identifica las principales enfermedades asociadas a los sistemas estudiados y sus mecanismos de prevención.",
      ],
      procedimental: [
        "Diseña y realiza observaciones o indagaciones sobre procesos fisiológicos básicos del organismo humano.",
        "Resuelve cruces genéticos sencillos (cuadros de Punnett) para determinar probabilidades de herencia.",
        "Analiza datos sobre salud poblacional e infiere relaciones entre hábitos y enfermedades.",
      ],
      actitudinal: [
        "Valora el cuidado de la salud personal y colectiva como responsabilidad ciudadana.",
        "Muestra curiosidad científica y actitud reflexiva frente a los fenómenos biológicos del cuerpo humano.",
      ],
    },
  },
  "3ro": {
    competenciaEspecifica:
      "Comprende y aplica los principios fundamentales de la química (estructura de la materia, enlace, reacciones) para explicar fenómenos del entorno, resolver problemas cuantitativos y valorar el impacto de la química en la vida cotidiana.",
    indicadoresPorDimension: {
      conceptual: [
        "Describe la estructura atómica, los modelos atómicos y la organización de la tabla periódica.",
        "Explica los tipos de enlace químico y su relación con las propiedades de las sustancias.",
        "Clasifica y describe los tipos de reacciones químicas y el concepto de estequiometría básica.",
      ],
      procedimental: [
        "Balancea ecuaciones químicas y realiza cálculos estequiométricos básicos aplicando la ley de conservación de la masa.",
        "Determina la estructura de Lewis de compuestos sencillos y predice su geometría molecular.",
        "Diseña y ejecuta experimentos sencillos para observar propiedades de la materia y tipos de reacciones.",
      ],
      actitudinal: [
        "Valora el uso responsable y seguro de sustancias químicas en el hogar, la salud y el ambiente.",
        "Demuestra rigurosidad en la medición, el registro de datos y la interpretación de resultados experimentales.",
      ],
    },
  },
  "4to": {
    competenciaEspecifica:
      "Analiza los principios de la mecánica clásica y la termodinámica para describir el movimiento, las fuerzas y las transformaciones de energía en sistemas reales, resolviendo problemas cuantitativos con base física sólida.",
    indicadoresPorDimension: {
      conceptual: [
        "Describe las leyes de Newton y los conceptos de fuerza, masa, aceleración y trabajo en el marco de la mecánica clásica.",
        "Explica los principios de conservación de la energía mecánica y el principio de trabajo y energía.",
        "Identifica las leyes de la termodinámica y su aplicación en procesos de transformación de energía.",
      ],
      procedimental: [
        "Resuelve problemas de cinemática y dinámica aplicando las leyes de Newton y los principios cinemáticos.",
        "Calcula trabajo, potencia, energía cinética y potencial en situaciones físicas del entorno.",
        "Aplica las leyes de la termodinámica para analizar ciclos de calor y rendimiento en sistemas reales.",
      ],
      actitudinal: [
        "Valora el pensamiento físico como herramienta para comprender el funcionamiento del mundo natural y tecnológico.",
        "Muestra rigor en la aplicación de principios físicos y actitud crítica frente a resultados experimentales.",
      ],
    },
  },
  "5to": {
    competenciaEspecifica:
      "Comprende y aplica los principios de la química orgánica, la bioquímica y el equilibrio químico para explicar fenómenos vitales e industriales, valorando el impacto de estas disciplinas en la salud y el ambiente.",
    indicadoresPorDimension: {
      conceptual: [
        "Identifica y clasifica los grupos funcionales de los compuestos orgánicos y sus propiedades.",
        "Describe las biomoléculas (carbohidratos, lípidos, proteínas, ácidos nucleicos) y su función en los seres vivos.",
        "Explica el concepto de equilibrio químico y el principio de Le Chatelier aplicado a reacciones industriales.",
      ],
      procedimental: [
        "Nombra y formula compuestos orgánicos sencillos aplicando las normas de la IUPAC.",
        "Analiza experimentos y datos sobre propiedades de biomoléculas para inferir su función biológica.",
        "Predice el desplazamiento del equilibrio en un sistema al variar temperatura, presión o concentración.",
      ],
      actitudinal: [
        "Valora la química orgánica como fundamento de la biotecnología, la medicina y la industria alimentaria.",
        "Muestra consciencia ambiental al analizar el impacto de compuestos orgánicos en el ecosistema.",
      ],
    },
  },
  "6to": {
    competenciaEspecifica:
      "Integra conceptos de física moderna, electricidad, ondas y astronomía para comprender los fenómenos del universo físico, resolver problemas cuantitativos avanzados y valorar el rol de la ciencia en el desarrollo tecnológico.",
    indicadoresPorDimension: {
      conceptual: [
        "Describe los principios básicos de la electricidad y el magnetismo y sus aplicaciones tecnológicas.",
        "Explica los fenómenos ondulatorios (luz, sonido) y sus propiedades fundamentales.",
        "Describe los principios de la física moderna: relatividad, física cuántica y estructura nuclear.",
      ],
      procedimental: [
        "Resuelve problemas de circuitos eléctricos básicos (serie, paralelo) aplicando las leyes de Ohm y Kirchhoff.",
        "Analiza fenómenos ondulatorios calculando frecuencia, longitud de onda y velocidad de propagación.",
        "Interpreta datos experimentales para verificar principios de física moderna y astronomía básica.",
      ],
      actitudinal: [
        "Valora el desarrollo científico y tecnológico como motor del progreso humano y la mejora de la calidad de vida.",
        "Demuestra pensamiento crítico y autonomía al enfrentar situaciones problemáticas de la física avanzada.",
      ],
    },
  },
};

// ─── LENGUA ESPAÑOLA ──────────────────────────────────────────────────────────

const INDICADORES_LENGUA = {
  "1ro": {
    competenciaEspecifica:
      "Comprende y produce textos orales y escritos de uso social básico (narrativos, descriptivos, instructivos), aplicando normas gramaticales y ortográficas fundamentales para comunicarse con claridad en situaciones cotidianas.",
    indicadoresPorDimension: {
      conceptual: [
        "Identifica las características estructurales y lingüísticas de los textos trabajados (tipo, propósito, destinatario).",
        "Reconoce las principales categorías gramaticales y sus funciones en el discurso oral y escrito.",
        "Describe las normas ortográficas básicas y los signos de puntuación fundamentales y sus usos.",
      ],
      procedimental: [
        "Lee con comprensión en los niveles literal e inferencial textos de diversa tipología.",
        "Produce textos escritos con cohesión, coherencia y adecuación a la situación comunicativa.",
        "Participa en intercambios orales aplicando normas de la comunicación y el discurso apropiado al contexto.",
      ],
      actitudinal: [
        "Valora la lengua española como instrumento de comunicación, identidad cultural y desarrollo personal.",
        "Muestra disposición para revisar y mejorar sus producciones orales y escritas.",
      ],
    },
  },
  "2do": {
    competenciaEspecifica:
      "Analiza y produce textos expositivos y argumentativos básicos, ampliando su competencia gramatical y ortográfica, y participando en situaciones de comunicación oral con progresiva autonomía y adecuación discursiva.",
    indicadoresPorDimension: {
      conceptual: [
        "Identifica la estructura argumentativa y expositiva del texto y sus recursos lingüísticos.",
        "Explica los principales procesos morfológicos (derivación, composición) y las funciones sintácticas básicas.",
        "Reconoce los mecanismos de cohesión textual (conectores, referencia, sustitución, elipsis).",
      ],
      procedimental: [
        "Lee y extrae información relevante de textos expositivos y argumentativos, identificando posición del autor.",
        "Produce textos argumentativos breves con tesis, argumentos y conclusión, usando conectores adecuados.",
        "Expone oralmente con claridad, organización y uso apropiado del registro comunicativo.",
      ],
      actitudinal: [
        "Demuestra actitud crítica y reflexiva frente a los textos y las situaciones comunicativas del entorno.",
        "Valora el debate argumentado como mecanismo de participación democrática y construcción de acuerdos.",
      ],
    },
  },
  "3ro": {
    competenciaEspecifica:
      "Comprende y produce textos literarios y no literarios de mayor complejidad, desarrollando el análisis crítico del discurso, la reflexión gramatical avanzada y la producción autónoma de géneros escritos formales.",
    indicadoresPorDimension: {
      conceptual: [
        "Identifica los recursos literarios, el género, la estructura y el contexto histórico de textos literarios.",
        "Describe las funciones del lenguaje y los registros comunicativos según la situación y el propósito.",
        "Explica las categorías sintácticas avanzadas: complementos verbales, cláusulas subordinadas y sus tipos.",
      ],
      procedimental: [
        "Analiza críticamente textos literarios y no literarios, identificando intención comunicativa y recursos del autor.",
        "Produce ensayos académicos breves con tesis fundamentada, argumentos desarrollados y referencias al texto.",
        "Participa en debates y foros orales estructurados, formulando y sosteniendo su posición con evidencia.",
      ],
      actitudinal: [
        "Valora la literatura como expresión de la cultura, la historia y la identidad del pueblo dominicano y universal.",
        "Muestra autonomía y rigor en la producción de textos escritos formales y académicos.",
      ],
    },
  },
  "4to": {
    competenciaEspecifica:
      "Analiza obras literarias representativas de distintas épocas y géneros, produce textos académicos formales y desarrolla estrategias de comunicación oral avanzada para participar en situaciones discursivas complejas.",
    indicadoresPorDimension: {
      conceptual: [
        "Identifica los movimientos literarios hispanoamericanos y sus características estéticas e históricas.",
        "Describe las convenciones del texto académico (cita, referencia, paráfrasis, estructura argumentativa).",
        "Explica los mecanismos de la comunicación oral formal: debate, conferencia, exposición y entrevista.",
      ],
      procedimental: [
        "Analiza obras literarias completas relacionando contenido, forma, contexto y significado.",
        "Produce textos académicos formales aplicando normas de citación y convenciones del discurso escrito.",
        "Expone y defiende ideas en situaciones de comunicación oral formal usando registro académico.",
      ],
      actitudinal: [
        "Valora la diversidad de perspectivas literarias e ideológicas como fuente de enriquecimiento intelectual.",
        "Demuestra responsabilidad y autonomía en la producción y revisión de textos académicos formales.",
      ],
    },
  },
  "5to": {
    competenciaEspecifica:
      "Comprende y produce textos argumentativos y académicos de alta complejidad, analiza el discurso desde una perspectiva lingüística y sociocultural, y participa con eficacia en situaciones comunicativas formales.",
    indicadoresPorDimension: {
      conceptual: [
        "Identifica los mecanismos de la argumentación compleja: falacias, estructuras discursivas y estrategias retóricas.",
        "Describe las variedades lingüísticas del español (dialectal, sociolectal, estilística) y su pertinencia contextual.",
        "Explica los fundamentos del análisis del discurso crítico y su aplicación a textos mediáticos y políticos.",
      ],
      procedimental: [
        "Analiza críticamente discursos de diversa procedencia identificando ideología, intención y recursos persuasivos.",
        "Produce textos argumentativos complejos con argumentación estructurada, evidencia y refutación.",
        "Planifica y ejecuta exposiciones orales académicas con dominio del tema, organización y gestión del tiempo.",
      ],
      actitudinal: [
        "Demuestra pensamiento crítico y ciudadano al analizar mensajes mediáticos y discursos de poder.",
        "Valora la diversidad lingüística del español como riqueza cultural y la defiende con argumentos.",
      ],
    },
  },
  "6to": {
    competenciaEspecifica:
      "Integra las competencias comunicativas para analizar, producir y presentar textos académicos y literarios de nivel preuniversitario, desarrollando un perfil comunicativo autónomo, crítico y culturalmente situado.",
    indicadoresPorDimension: {
      conceptual: [
        "Describe los principales corrientes de la crítica literaria y aplica al menos una en el análisis textual.",
        "Explica los géneros del discurso académico preuniversitario: reseña, ensayo, monografía y artículo.",
        "Identifica los principios de la lingüística textual: coherencia global, progresión temática e intertextualidad.",
      ],
      procedimental: [
        "Produce textos académicos preuniversitarios con aparato crítico, tesis propia y argumentación sustentada.",
        "Analiza obras literarias desde una perspectiva teórica fundamentada, relacionándolas con su contexto.",
        "Realiza exposiciones académicas formales con dominio del contenido, registro y estrategias discursivas.",
      ],
      actitudinal: [
        "Valora la comunicación escrita y oral como herramienta de participación ciudadana y desarrollo profesional.",
        "Demuestra autonomía intelectual, pensamiento crítico y responsabilidad en sus producciones académicas.",
      ],
    },
  },
};

// ─── CIENCIAS SOCIALES ────────────────────────────────────────────────────────

const INDICADORES_SOCIALES = {
  "1ro": {
    competenciaEspecifica:
      "Analiza el proceso histórico dominicano desde sus orígenes prehispánicos hasta la colonia, interpretando fuentes históricas y geográficas para comprender la construcción identitaria del pueblo dominicano.",
    indicadoresPorDimension: {
      conceptual: [
        "Describe las culturas prehispánicas del Caribe (taínas, ciguayos, macoríes) y sus modos de vida.",
        "Explica el proceso de colonización española, la encomienda y sus efectos sociales y demográficos.",
        "Identifica las principales características geográficas de la isla La Hispaniola y su influencia histórica.",
      ],
      procedimental: [
        "Analiza fuentes históricas primarias y secundarias para reconstruir el contexto prehispánico y colonial.",
        "Elabora líneas de tiempo y mapas históricos que representen procesos y transformaciones territoriales.",
        "Argumenta oralmente y por escrito sobre los efectos del colonialismo en la identidad dominicana.",
      ],
      actitudinal: [
        "Valora el patrimonio histórico y cultural dominicano como parte esencial de la identidad nacional.",
        "Muestra respeto por la diversidad cultural y étnica como fundamento de la sociedad dominicana.",
      ],
    },
  },
  "2do": {
    competenciaEspecifica:
      "Analiza el proceso de construcción de la nación dominicana desde la Independencia hasta finales del siglo XIX, interpretando fuentes históricas y desarrollando conciencia ciudadana sobre los valores fundacionales de la República.",
    indicadoresPorDimension: {
      conceptual: [
        "Describe el proceso de la independencia dominicana de 1844 y los factores internos y externos que la determinaron.",
        "Explica los principales períodos y figuras de la primera República y los conflictos políticos del siglo XIX.",
        "Identifica la geografía político-administrativa de la República Dominicana y sus características regionales.",
      ],
      procedimental: [
        "Analiza documentos históricos (Acta de Independencia, proclamas, cartas) para identificar valores fundacionales.",
        "Elabora ensayos o informes históricos comparando causas y consecuencias de los eventos del siglo XIX.",
        "Construye argumentos ciudadanos sobre la importancia de los valores republicanos en la vida democrática actual.",
      ],
      actitudinal: [
        "Valora los principios democráticos y los valores de la nación dominicana como herencia histórica y responsabilidad ciudadana.",
        "Demuestra sentido de identidad nacional e interés por los procesos históricos que configuraron el presente.",
      ],
    },
  },
  "3ro": {
    competenciaEspecifica:
      "Analiza la historia dominicana y universal del siglo XX, relaciona procesos económicos, políticos y sociales con el contexto geopolítico, y desarrolla pensamiento crítico sobre los problemas y retos de la sociedad contemporánea.",
    indicadoresPorDimension: {
      conceptual: [
        "Describe las características del período de la ocupación norteamericana (1916-1924) y la era de Trujillo.",
        "Explica los principales procesos de la historia universal del siglo XX: guerras mundiales, guerra fría, descolonización.",
        "Identifica los principales problemas socioeconómicos de la República Dominicana y sus causas estructurales.",
      ],
      procedimental: [
        "Analiza críticamente fuentes históricas sobre el siglo XX dominicano identificando perspectivas e intenciones.",
        "Elabora investigaciones sobre fenómenos históricos usando múltiples fuentes con rigor metodológico.",
        "Debate y argumenta sobre las causas y consecuencias de los procesos históricos del siglo XX.",
      ],
      actitudinal: [
        "Valora los derechos humanos y las libertades democráticas como conquistas históricas que deben preservarse.",
        "Muestra pensamiento crítico frente a los procesos políticos, económicos y sociales del pasado y el presente.",
      ],
    },
  },
  "4to": {
    competenciaEspecifica:
      "Comprende los fundamentos de la ciudadanía democrática, los derechos humanos, la Constitución dominicana y los mecanismos de participación para ejercer una ciudadanía activa, crítica y responsable.",
    indicadoresPorDimension: {
      conceptual: [
        "Describe los principios constitucionales de la República Dominicana y los derechos y deberes ciudadanos.",
        "Explica los mecanismos de participación democrática: sufragio, organizaciones civiles, iniciativa legislativa.",
        "Identifica los organismos internacionales de derechos humanos y sus instrumentos legales fundamentales.",
      ],
      procedimental: [
        "Analiza situaciones de la vida cotidiana aplicando los principios constitucionales y los derechos humanos.",
        "Evalúa el ejercicio de la ciudadanía en su comunidad identificando fortalezas y áreas de mejora.",
        "Produce propuestas ciudadanas concretas orientadas a resolver problemas comunitarios detectados.",
      ],
      actitudinal: [
        "Demuestra compromiso con los valores democráticos, la justicia social y los derechos humanos en su vida cotidiana.",
        "Muestra responsabilidad y participación activa en la vida escolar y comunitaria como práctica ciudadana.",
      ],
    },
  },
  "5to": {
    competenciaEspecifica:
      "Analiza los fundamentos de la economía dominicana e internacional, los procesos de globalización y los retos del desarrollo sostenible, para comprender las relaciones entre economía, sociedad y ambiente en el mundo contemporáneo.",
    indicadoresPorDimension: {
      conceptual: [
        "Describe los conceptos fundamentales de la economía: oferta, demanda, producción, distribución y consumo.",
        "Explica los efectos de la globalización en las economías nacionales y en la vida cotidiana de los dominicanos.",
        "Identifica los Objetivos de Desarrollo Sostenible (ODS) y su relevancia para la República Dominicana.",
      ],
      procedimental: [
        "Analiza datos económicos básicos (PIB, desempleo, inflación) e infiere sus consecuencias sociales.",
        "Evalúa críticamente el modelo económico dominicano identificando sus fortalezas, limitaciones e impactos.",
        "Produce argumentos fundamentados sobre los desafíos del desarrollo sostenible en la comunidad local.",
      ],
      actitudinal: [
        "Valora el consumo responsable y la justicia económica como dimensiones de la ciudadanía activa.",
        "Muestra consciencia ambiental y disposición para asumir compromisos con el desarrollo sostenible.",
      ],
    },
  },
  "6to": {
    competenciaEspecifica:
      "Integra perspectivas históricas, geográficas, sociológicas y económicas para analizar los grandes problemas del mundo contemporáneo, construir argumentos fundamentados y proyectar el futuro de la República Dominicana en el contexto global.",
    indicadoresPorDimension: {
      conceptual: [
        "Describe los principales conflictos geopolíticos contemporáneos y su repercusión en el orden mundial.",
        "Explica los fenómenos migratorios internacionales y su impacto social, cultural y económico.",
        "Identifica los retos de la democracia, la equidad y la sostenibilidad ambiental en el siglo XXI.",
      ],
      procedimental: [
        "Analiza críticamente fuentes de información sobre problemas globales, evaluando su confiabilidad.",
        "Produce investigaciones integradoras sobre problemas del mundo contemporáneo desde perspectiva multidisciplinar.",
        "Formula propuestas argumentadas sobre el rol de la República Dominicana frente a los retos globales.",
      ],
      actitudinal: [
        "Demuestra pensamiento global y ciudadanía activa comprometida con la democracia, la paz y la sostenibilidad.",
        "Valora la diversidad cultural como riqueza y rechaza toda forma de discriminación e intolerancia.",
      ],
    },
  },
};

// ─── EDUCACIÓN ARTÍSTICA ─────────────────────────────────────────────────────

const INDICADORES_ARTISTICA = {
  "1ro": {
    competenciaEspecifica:
      "Explora y expresa ideas, emociones y vivencias a través de lenguajes artísticos básicos (visual, musical, dramático, danza), desarrollando la sensibilidad estética y el pensamiento creativo.",
    indicadoresPorDimension: {
      conceptual: ["Identifica los elementos del lenguaje visual, musical o corporal trabajados en la unidad.", "Reconoce manifestaciones artísticas del patrimonio dominicano y latinoamericano."],
      procedimental: ["Produce creaciones artísticas usando técnicas básicas del lenguaje seleccionado.", "Aprecia y describe obras artísticas usando vocabulario básico del área."],
      actitudinal: ["Valora el arte como expresión de la identidad cultural y la creatividad humana.", "Muestra respeto y apertura ante las producciones artísticas propias y de sus compañeros."],
    },
  },
  "2do": { competenciaEspecifica: "Explora técnicas artísticas con mayor profundidad, aprecia el patrimonio cultural dominicano e hispanoamericano y produce creaciones que expresen su visión del mundo con intencionalidad comunicativa.", indicadoresPorDimension: { conceptual: ["Describe las características de los movimientos artísticos estudiados y sus contextos culturales.", "Identifica técnicas y materiales de los lenguajes artísticos trabajados."], procedimental: ["Aplica técnicas con mayor dominio en la producción artística propia.", "Analiza obras artísticas relacionándolas con su contexto histórico y cultural."], actitudinal: ["Valora la diversidad de expresiones artísticas como reflejo de culturas y cosmovisiones distintas.", "Muestra compromiso y cuidado en el proceso de producción artística."] } },
  "3ro": { competenciaEspecifica: "Analiza, interpreta y produce expresiones artísticas que integren el lenguaje técnico del área, el análisis estético y la contextualización cultural, desarrollando su identidad artística personal.", indicadoresPorDimension: { conceptual: ["Explica los elementos formales y expresivos de las obras artísticas estudiadas.", "Describe las corrientes artísticas dominicanas e hispanoamericanas y sus características."], procedimental: ["Produce obras artísticas con intención estética, originalidad y dominio técnico.", "Interpreta y argumenta sobre obras artísticas usando criterios estéticos fundamentados."], actitudinal: ["Valora el arte como medio de transformación social y expresión de la identidad personal y colectiva.", "Muestra respeto y valoración por el patrimonio artístico dominicano."] } },
  "4to": { competenciaEspecifica: "Desarrolla proyectos artísticos con mayor autonomía técnica y conceptual, relacionando el lenguaje artístico con el contexto sociocultural y fortaleciendo su capacidad de apreciación crítica.", indicadoresPorDimension: { conceptual: ["Analiza el lenguaje y los recursos técnicos de obras del arte universal y dominicano.", "Describe las relaciones entre arte, cultura, historia y sociedad en diferentes épocas."], procedimental: ["Desarrolla proyectos artísticos originales con dominio técnico y coherencia conceptual.", "Critica y analiza producciones artísticas con argumentos fundamentados en criterios estéticos."], actitudinal: ["Demuestra autonomía creativa y responsabilidad en el desarrollo de proyectos artísticos.", "Valora el arte como espacio de reflexión, crítica y transformación de la realidad social."] } },
  "5to": { competenciaEspecifica: "Integra técnicas artísticas avanzadas, el análisis crítico del arte contemporáneo y el desarrollo de proyectos complejos para consolidar una voz artística personal con sentido sociocultural.", indicadoresPorDimension: { conceptual: ["Describe las tendencias del arte contemporáneo y su relación con el arte dominicano actual.", "Analiza el arte como lenguaje de comunicación, denuncia y transformación social."], procedimental: ["Crea proyectos artísticos complejos que integran técnica, concepto e intención comunicativa.", "Evalúa críticamente su producción artística y la de sus compañeros usando criterios avanzados."], actitudinal: ["Valora el arte contemporáneo dominicano como expresión viva de la identidad y la diversidad cultural.", "Muestra compromiso con la preservación y la difusión del patrimonio artístico nacional."] } },
  "6to": { competenciaEspecifica: "Consolida su identidad artística a través de proyectos integradores que fusionen técnicas, lenguajes y perspectivas críticas, aportando desde el arte a la vida comunitaria y cultural.", indicadoresPorDimension: { conceptual: ["Explica las relaciones entre arte, tecnología, medios de comunicación y cultura digital.", "Describe el papel del artista y la institución cultural en la sociedad contemporánea dominicana."], procedimental: ["Desarrolla un proyecto artístico integrador que refleje su posición estética y social.", "Gestiona la difusión de su producción artística en espacios escolares o comunitarios."], actitudinal: ["Demuestra compromiso artístico, ciudadano y cultural en su producción y participación comunitaria.", "Valora el arte como contribución personal a la cultura y el bienestar de su comunidad."] } },
};

// ─── EDUCACIÓN FÍSICA ────────────────────────────────────────────────────────

const INDICADORES_FISICA = {
  "1ro": { competenciaEspecifica: "Desarrolla habilidades motrices básicas, la condición física y el trabajo en equipo a través de actividades físicas, juegos y deportes, valorando la actividad física como base del bienestar integral.", indicadoresPorDimension: { conceptual: ["Identifica los componentes básicos de la condición física (resistencia, fuerza, flexibilidad, velocidad).", "Reconoce las reglas básicas de los juegos y deportes practicados."], procedimental: ["Ejecuta habilidades motrices básicas (correr, saltar, lanzar, atrapar) con coordinación creciente.", "Participa en juegos cooperativos y deportivos aplicando las reglas acordadas."], actitudinal: ["Valora la actividad física regular como hábito saludable y fuente de bienestar.", "Demuestra respeto, fair play y colaboración en todas las actividades físicas."] } },
  "2do": { competenciaEspecifica: "Aplica habilidades motrices específicas en actividades deportivas y expresión corporal, desarrolla su condición física con autonomía creciente y practica hábitos de vida saludable.", indicadoresPorDimension: { conceptual: ["Describe las fases técnicas de los deportes practicados y su aplicación táctica básica.", "Identifica los principios básicos del entrenamiento físico y la recuperación."], procedimental: ["Ejecuta las técnicas básicas de los deportes seleccionados con progresiva precisión.", "Diseña y ejecuta rutinas de calentamiento y vuelta a la calma con criterio."], actitudinal: ["Muestra disciplina, esfuerzo y superación en el desarrollo de sus capacidades físicas.", "Valora la práctica deportiva como espacio de convivencia y desarrollo personal."] } },
  "3ro": { competenciaEspecifica: "Integra habilidades técnicas y tácticas en los deportes, desarrolla la condición física con plan personal y practica la expresión corporal como forma de comunicación y bienestar.", indicadoresPorDimension: { conceptual: ["Explica los principios tácticos básicos de los deportes colectivos e individuales practicados.", "Describe los efectos del ejercicio físico en los sistemas del cuerpo humano."], procedimental: ["Aplica estrategias tácticas básicas en situaciones de juego real o simulado.", "Ejecuta rutinas de acondicionamiento físico con técnica correcta y autonomía."], actitudinal: ["Valora la práctica regular de actividad física como derecho y responsabilidad personal y social.", "Demuestra liderazgo positivo, inclusión y respeto en las actividades físicas grupales."] } },
  "4to": { competenciaEspecifica: "Profundiza en la práctica deportiva y la condición física, desarrolla proyectos de vida activa y analiza la relación entre actividad física, salud y bienestar en el contexto sociocultural dominicano.", indicadoresPorDimension: { conceptual: ["Analiza los factores que influyen en el rendimiento deportivo: nutrición, descanso, entrenamiento.", "Describe manifestaciones culturales de actividad física dominicanas (deportes autóctonos, danza)."], procedimental: ["Diseña un plan personal de actividad física fundamentado en principios de entrenamiento.", "Evalúa su desempeño físico usando criterios objetivos y establece metas de mejora."], actitudinal: ["Valora la actividad física como proyecto de vida saludable y espacio de expresión cultural.", "Muestra responsabilidad y autonomía en la gestión de su condición física personal."] } },
  "5to": { competenciaEspecifica: "Consolida sus competencias deportivas y de condición física, desarrolla liderazgo en contextos de actividad física grupal y reflexiona críticamente sobre el rol del deporte en la sociedad.", indicadoresPorDimension: { conceptual: ["Describe el rol del deporte en la sociedad dominicana: impacto económico, cultural e identitario.", "Explica los principios de la planificación del entrenamiento deportivo a largo plazo."], procedimental: ["Lidera actividades deportivas o físicas demostrando competencia técnica y habilidades sociales.", "Analiza el desempeño del equipo e individual y propone mejoras argumentadas."], actitudinal: ["Demuestra compromiso con el juego limpio, la inclusión y la equidad en el deporte.", "Valora el esfuerzo y la superación como valores transferibles de la práctica deportiva a la vida."] } },
  "6to": { competenciaEspecifica: "Integra habilidades deportivas, de condición física y de liderazgo para diseñar y dirigir propuestas de actividad física comunitaria, proyectando la cultura del bienestar activo hacia su entorno.", indicadoresPorDimension: { conceptual: ["Describe los beneficios de la actividad física comunitaria y las políticas públicas de salud en RD.", "Explica los principios del diseño de programas de actividad física para diferentes poblaciones."], procedimental: ["Diseña y dirige actividades físicas o deportivas para grupos de su comunidad o escuela.", "Evalúa el impacto de proyectos de actividad física usando indicadores de bienestar."], actitudinal: ["Asume liderazgo responsable en la promoción de la cultura de vida activa en su comunidad.", "Valora el bienestar colectivo como meta del deporte y la actividad física más allá del rendimiento individual."] } },
};

// ─── Tabla de normalización de grado ─────────────────────────────────────────

const TABLA_GRADO = {
  "1ro": "1ro", "primero": "1ro", "1": "1ro", "1ro secundaria": "1ro",
  "2do": "2do", "segundo": "2do", "2": "2do", "2do secundaria": "2do",
  "3ro": "3ro", "tercero": "3ro", "3": "3ro", "3ro secundaria": "3ro",
  "4to": "4to", "cuarto": "4to",  "4": "4to", "4to secundaria": "4to",
  "5to": "5to", "quinto": "5to",  "5": "5to", "5to secundaria": "5to",
  "6to": "6to", "sexto": "6to",   "6": "6to", "6to secundaria": "6to",
};

const normalizarGrado = (grado = "") => {
  const tok = String(grado).toLowerCase().trim().split(/\s+/)[0];
  return TABLA_GRADO[tok] ?? "2do";
};

// ─── Selector de banco por área ────────────────────────────────────────────────

const BANCOS_POR_AREA = {
  "Matemática":              INDICADORES_MATEMATICA,
  "Ciencias de la Naturaleza": INDICADORES_CIENCIAS,
  "Lengua Española":         INDICADORES_LENGUA,
  "Ciencias Sociales":       INDICADORES_SOCIALES,
  "Educación Artística":     INDICADORES_ARTISTICA,
  "Educación Física":        INDICADORES_FISICA,
};

/**
 * Devuelve la competencia específica e indicadores de logro oficiales MINERD
 * para un área y grado del Nivel Secundario.
 *
 * @param {string} area   — nombre del área curricular
 * @param {string} grado  — grado en cualquier formato ("2do", "segundo", "2", etc.)
 * @returns {{ especifica: string, indicadores: string[] }}
 */
export const getCompetenciasArea = (area, grado) => {
  const banco = BANCOS_POR_AREA[area];
  if (!banco) return null;

  const gradoNorm = normalizarGrado(grado);
  const datos = banco[gradoNorm] ?? banco["2do"];
  const d = datos.indicadoresPorDimension;

  return {
    especifica: datos.competenciaEspecifica,
    indicadores: [
      d.conceptual[0],
      d.procedimental[0],
      d.procedimental[1] ?? d.procedimental[0],
      d.actitudinal[0],
    ],
  };
};
