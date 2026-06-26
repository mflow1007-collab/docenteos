/**
 * Banco Pedagógico Inteligente — DocenteOS
 *
 * Estructura: banco[area][momento] = [grupoFase0, grupoFase1, grupoFase2]
 * Cada grupoFase = array de sub-variantes para días distintos dentro de esa fase.
 *
 * Selector: faseIdx → grupoFase (garantiza progresión entre fases)
 *           diaNum  → sub-variante (garantiza variación entre clases de la misma fase)
 *
 * Etapas pedagógicas por grupo:
 *   grupo 0 (fase 0 — Presentación):  Diagnóstico · Exploración · Motivación
 *   grupo 1 (fase 1 — Desarrollo):    Construcción · Práctica guiada · Análisis
 *   grupo 2 (fase 2 — Profundización): Aplicación · Producción · Síntesis
 *   fase 3 (Integración): gestionada por las funciones fase4 del servicio
 *
 * Usa {tema} como placeholder; el servicio lo reemplaza con el tema real.
 */

// ─── CIENCIAS SOCIALES ────────────────────────────────────────────────────────

const CS_INICIO = [
  // ── Grupo 0: Diagnóstico y Exploración ───────────────────────────────────────
  [
    [
      `Responden al saludo e indicaciones del docente.`,
      `Observan una imagen, fotografía o mapa relacionado con "{tema}" y expresan qué ven, qué conocen y qué preguntas les genera.`,
      `Recuperan saberes previos: _¿Dónde han escuchado o visto algo relacionado con {tema}? ¿Qué saben sobre este tema?_`,
      `Clasifican sus ideas en "Lo que sé / Lo que creo / Lo que no sé" en una tabla sencilla en su cuaderno.`,
      `Escuchan la intención pedagógica y el propósito de aprendizaje de la sesión.`,
    ],
    [
      `Responden al saludo e indicaciones del docente.`,
      `Analizan una situación contextualizada del entorno dominicano relacionada con "{tema}" presentada por el docente (noticia breve, estadística o imagen).`,
      `Expresan sus primeras interpretaciones y reacciones ante la situación presentada: _¿Qué ocurrió? ¿Por qué creen que sucedió? ¿A quiénes afecta?_`,
      `Formulan al menos dos preguntas de investigación sobre "{tema}" que les gustaría responder durante la unidad.`,
      `Escuchan el propósito de la unidad y el producto final esperado relacionado con "{tema}".`,
    ],
  ],
  // ── Grupo 1: Construcción y Análisis ─────────────────────────────────────────
  [
    [
      `Responden al saludo e indicaciones del docente y revisan brevemente lo trabajado en la sesión anterior sobre "{tema}".`,
      `Analizan una fuente primaria (documento histórico, mapa, declaración, carta) relacionada con "{tema}". Identifican: quién la produce, cuándo, con qué propósito.`,
      `Comparan dos perspectivas diferentes sobre "{tema}" usando una tabla de análisis. Argumentan cuál evidencia es más confiable y por qué.`,
      `Construyen un organizador gráfico colectivo (línea de tiempo, mapa de actores o esquema de causas y consecuencias) sobre "{tema}".`,
      `Escuchan el propósito de la sesión y anotan la pregunta de investigación del día.`,
    ],
    [
      `Responden al saludo e indicaciones del docente.`,
      `Participan en una dinámica de activación: el docente presenta una afirmación provocadora sobre "{tema}" y los estudiantes toman posición (acuerdo/desacuerdo) con justificación oral breve.`,
      `Retroalimentan la clase anterior: voluntarios comparten un concepto, fecha clave o actor relevante de "{tema}" aprendido previamente.`,
      `Relacionan "{tema}" con situaciones de su entorno comunitario, regional o nacional y expresan sus conexiones con el contenido.`,
      `Anotan el propósito pedagógico de la sesión y las preguntas guía del día en su cuaderno.`,
    ],
  ],
  // ── Grupo 2: Aplicación y Producción ─────────────────────────────────────────
  [
    [
      `Responden al saludo e indicaciones del docente.`,
      `Presentan brevemente el avance de su producción sobre "{tema}" y reciben retroalimentación formativa del docente.`,
      `Identifican los criterios de calidad del producto esperado y evalúan su trabajo hasta el momento usando una lista de cotejo.`,
      `Formulan preguntas de aclaración y ajustan su plan de trabajo para la sesión.`,
      `Escuchan la intención pedagógica del día: maximizar el tiempo de producción con calidad y precisión conceptual.`,
    ],
    [
      `Responden al saludo e indicaciones del docente.`,
      `Participan en un debate breve (5 min) sobre un aspecto controversial de "{tema}" relacionado con la realidad dominicana actual.`,
      `Evalúan críticamente dos o más fuentes de información sobre "{tema}" determinando su validez, sesgo y utilidad para su producción final.`,
      `Revisan y fortalecen los argumentos y evidencias de su producción incorporando lo debatido en la activación.`,
      `Escuchan orientaciones finales del docente antes de la presentación o entrega de la producción.`,
    ],
  ],
];

const CS_DESARROLLO = [
  // ── Grupo 0: Exploración inicial ─────────────────────────────────────────────
  [
    [
      `Observan y analizan un video corto, documental o presentación multimedia sobre "{tema}". Identifican personajes clave, fechas, lugares y procesos.`,
      `Leen un texto informativo sobre "{tema}" y subrayan las ideas principales. Responden preguntas de comprensión literal e inferencial.`,
      `Construyen en grupos un mapa mental o esquema de conceptos sobre "{tema}" usando las ideas identificadas en el texto y el video.`,
      `Socializan sus mapas mentales: cada grupo comparte un elemento diferente. El docente complementa y aclara. Registran conclusiones en su cuaderno.`,
    ],
    [
      `Analizan una serie de imágenes históricas o geográficas relacionadas con "{tema}". Describen lo que observan y elaboran hipótesis sobre lo que representan.`,
      `Comparan con un compañero sus hipótesis e identifican semejanzas y diferencias en su interpretación. Justifican sus posiciones.`,
      `Leen una fuente de referencia que confirma, refuta o amplía sus hipótesis iniciales sobre "{tema}". Ajustan sus interpretaciones.`,
      `Elaboran en su cuaderno una reflexión escrita: _¿Cómo cambió mi comprensión inicial de {tema} después de analizar las fuentes?_`,
    ],
  ],
  // ── Grupo 1: Construcción y práctica ─────────────────────────────────────────
  [
    [
      `Analizan textos de diferentes perspectivas (cronista colonial, historiador moderno, fuente local) sobre "{tema}". Identifican: argumento central, evidencias y posibles sesgos.`,
      `Elaboran en grupos una línea de tiempo o cuadro comparativo que sintetice los procesos, actores y consecuencias de "{tema}".`,
      `Redactan individualmente un análisis escrito de dos párrafos: _¿Qué importancia tiene {tema} para la comprensión de la historia o sociedad dominicana?_`,
      `Comparten sus análisis en parejas, se retroalimentan y realizan ajustes. El docente circula y hace preguntas para profundizar el razonamiento crítico.`,
    ],
    [
      `Trabajan en grupos cooperativos: cada grupo recibe un aspecto diferente de "{tema}" para investigar y exponer (técnica de rompecabezas o grupo de expertos).`,
      `Elaboran una presentación, afiche o infografía que sintetice los hallazgos de su aspecto asignado de "{tema}".`,
      `Realizan la rotación de expertos: cada miembro explica a su nuevo grupo lo investigado y escucha los hallazgos de los demás.`,
      `Sintetizan colectivamente los aprendizajes en un esquema integrador. El docente sistematiza en la pizarra y aclara conceptos erróneos.`,
    ],
  ],
  // ── Grupo 2: Aplicación y debate ─────────────────────────────────────────────
  [
    [
      `Analizan un caso contemporáneo relacionado con "{tema}" en la realidad dominicana o latinoamericana. Identifican continuidades y rupturas con el pasado.`,
      `Redactan un argumento fundamentado (2 párrafos) respondiendo: _¿Qué lecciones nos deja {tema} para comprender el presente?_`,
      `Participan en un foro de ideas: comparten sus argumentos, escuchan posiciones diferentes y responden con contraargumentos respetuosos.`,
      `El docente sistematiza los argumentos más sólidos y señala los aspectos a mejorar. Los estudiantes revisan y fortalecen su producción escrita.`,
    ],
    [
      `Diseñan y elaboran el producto final o avance significativo de la unidad sobre "{tema}": ensayo, investigación, propuesta de acción, línea de tiempo elaborada o mural.`,
      `Aplican criterios de rigor histórico-social: fechas verificadas, fuentes citadas, argumentos sustentados en evidencias.`,
      `Reciben retroalimentación del docente sobre el avance de su producción y realizan correcciones o ampliaciones.`,
      `Ensayan la exposición oral de su trabajo (si aplica) practicando claridad, orden lógico y uso de vocabulario propio de las Ciencias Sociales.`,
    ],
  ],
];

const CS_CIERRE = [
  // ── Grupo 0 ──────────────────────────────────────────────────────────────────
  [
    [
      `Responden a las preguntas con que iniciaron la sesión: _¿Qué aprendí sobre {tema}? ¿Mis hipótesis iniciales eran correctas?_`,
      `Completan en su cuaderno el organizador "Antes pensaba... Ahora sé que..." sobre "{tema}".`,
      `Reciben orientación sobre la tarea para el hogar y el docente anuncia el próximo contenido de la unidad.`,
      `El docente anuncia la próxima sesión y cómo los aprendizajes de hoy serán la base para avanzar.`,
    ],
    [
      `Sintetizan oralmente tres ideas claves aprendidas sobre "{tema}": un hecho, una causa y una consecuencia.`,
      `Reflexionan: _¿Cómo influye {tema} en la realidad de mi comunidad o de la República Dominicana hoy?_`,
      `Reciben orientación sobre la tarea e identifican qué fuentes adicionales podrían consultar para profundizar en "{tema}".`,
      `El docente cierra con una pregunta abierta que conecta lo aprendido hoy con la próxima sesión.`,
    ],
  ],
  // ── Grupo 1 ──────────────────────────────────────────────────────────────────
  [
    [
      `Construyen en su cuaderno un resumen estructurado: actores, fechas, causas, consecuencias y significado histórico-social de "{tema}".`,
      `Reflexionan sobre la calidad de sus argumentos: _¿Usé evidencias suficientes? ¿Mi argumento es claro y coherente?_`,
      `Integran la retroalimentación del docente sobre el rigor conceptual y la precisión histórica de sus producciones.`,
      `Reciben orientación sobre la tarea y el docente conecta el contenido con la próxima sesión.`,
    ],
    [
      `Comparten en plenaria una conclusión que cambió su forma de pensar sobre "{tema}" durante la clase.`,
      `Evalúan críticamente su participación: _¿Contribuí con argumentos fundamentados? ¿Escuché y valoré las opiniones diferentes?_`,
      `Reciben retroalimentación del docente sobre su desempeño en el análisis y la argumentación.`,
      `El docente anuncia el próximo contenido y explica cómo "{tema}" se conecta con lo que viene.`,
    ],
  ],
  // ── Grupo 2 ──────────────────────────────────────────────────────────────────
  [
    [
      `Evalúan la calidad de su producción final usando los criterios establecidos: _¿Mis argumentos están sustentados? ¿Usé vocabulario especializado?_`,
      `Reflexionan sobre su crecimiento durante la unidad: _¿Qué aprendizajes sobre {tema} me ayudarán a entender mejor la sociedad dominicana?_`,
      `Expresan compromisos ciudadanos concretos relacionados con los valores y aprendizajes de "{tema}".`,
      `El docente cierra valorando el proceso de aprendizaje crítico del grupo y anuncia la próxima unidad.`,
    ],
    [
      `Autoevalúan su producción final usando la rúbrica establecida para "{tema}". Identifican fortalezas y aspectos a mejorar.`,
      `Coevalúan la producción de un compañero ofreciendo retroalimentación específica y constructiva sobre los criterios trabajados.`,
      `Reflexionan sobre su proceso de aprendizaje durante la fase: _¿Qué estrategia de análisis o producción me fue más útil?_`,
      `El docente sintetiza los logros colectivos de la unidad sobre "{tema}" y anuncia los próximos aprendizajes.`,
    ],
  ],
];

// ─── CIENCIAS DE LA NATURALEZA ────────────────────────────────────────────────

const CN_INICIO = [
  // ── Grupo 0: Diagnóstico e Indagación inicial ─────────────────────────────────
  [
    [
      `Responden al saludo e indicaciones del docente.`,
      `Observan un fenómeno natural, demostración sencilla u objeto relacionado con "{tema}" y expresan sus observaciones iniciales de manera oral.`,
      `Formulan hipótesis espontáneas: _¿Qué creen que causa este fenómeno? ¿Qué pasaría si...?_ Registran sus hipótesis en el cuaderno de ciencias.`,
      `Identifican qué saben, qué creen y qué necesitan investigar sobre "{tema}" usando un organizador KWL (Sé / Quiero saber / Aprendí).`,
      `Escuchan la pregunta de investigación de la sesión y la intención pedagógica del día.`,
    ],
    [
      `Responden al saludo e indicaciones del docente.`,
      `Analizan una imagen, gráfica o dato estadístico relacionado con "{tema}" y expresan qué observan, qué les llama la atención y qué preguntas les genera.`,
      `Retroalimentan conocimientos previos respondiendo preguntas orales: _¿Han observado este fenómeno en su entorno? ¿Cómo lo explicarían?_`,
      `Relacionan "{tema}" con situaciones de su vida cotidiana o su comunidad: contaminación, salud, alimentación, fenómenos naturales.`,
      `Escuchan la intención pedagógica y la metodología científica que seguirán durante la sesión.`,
    ],
  ],
  // ── Grupo 1: Exploración activa y Construcción ───────────────────────────────
  [
    [
      `Responden al saludo e indicaciones del docente.`,
      `Retroalimentan la clase anterior: _¿Qué hipótesis planteamos sobre {tema}? ¿Qué datos recopilamos? ¿Qué conclusiones preliminares tenemos?_`,
      `Observan un video, simulación o demostración más detallada sobre "{tema}" y anotan dudas, observaciones y nuevos hallazgos.`,
      `Diseñan en grupos la próxima etapa de su investigación: qué variables controlarán, qué datos registrarán, cómo verificarán sus hipótesis.`,
      `Escuchan orientaciones del docente sobre el protocolo de seguridad y el procedimiento de la actividad experimental.`,
    ],
    [
      `Responden al saludo e indicaciones del docente y revisan brevemente el avance de la investigación sobre "{tema}".`,
      `Analizan datos o resultados preliminares obtenidos en sesiones anteriores: buscan patrones, anomalías y tendencias.`,
      `Comparan sus resultados con fuentes científicas de referencia: ¿coinciden con lo esperado? ¿qué diferencias hay y por qué?`,
      `Reformulan o confirman sus hipótesis iniciales sobre "{tema}" con base en la evidencia recopilada.`,
      `Escuchan las orientaciones del docente y planifican los pasos de verificación para la sesión de hoy.`,
    ],
  ],
  // ── Grupo 2: Aplicación y Transferencia ──────────────────────────────────────
  [
    [
      `Responden al saludo e indicaciones del docente.`,
      `Presentan los resultados de su investigación sobre "{tema}" ante el grupo: hipótesis, procedimiento, datos y conclusiones.`,
      `Relacionan sus conclusiones con situaciones reales: impacto ambiental, salud pública, tecnología o vida cotidiana relacionada con "{tema}".`,
      `Evalúan críticamente su proceso de investigación: _¿Qué haría diferente? ¿Qué limitaciones tuvo nuestra metodología?_`,
      `Escuchan la síntesis del docente sobre los aprendizajes científicos más importantes de la unidad.`,
    ],
    [
      `Responden al saludo e indicaciones del docente.`,
      `Analizan un problema ambiental, de salud o tecnológico relacionado con "{tema}" presente en la realidad dominicana.`,
      `Proponen soluciones basadas en los principios científicos estudiados: evalúan viabilidad, costo, impacto y sostenibilidad.`,
      `Seleccionan la mejor solución propuesta y argumentan su elección usando evidencias científicas y criterios de bien común.`,
      `Escuchan la retroalimentación del docente sobre el pensamiento científico aplicado y la calidad de las propuestas.`,
    ],
  ],
];

const CN_DESARROLLO = [
  // ── Grupo 0: Exploración y Experimentación ───────────────────────────────────
  [
    [
      `Realizan una actividad de exploración guiada sobre "{tema}": observan, manipulan materiales, miden o registran datos siguiendo el protocolo del docente.`,
      `Registran sus observaciones en la tabla de datos del cuaderno de ciencias: variables, mediciones y fenómenos observados.`,
      `Leen un texto científico breve sobre "{tema}" y relacionan lo leído con las observaciones realizadas en la experimentación.`,
      `Construyen una explicación inicial del fenómeno de "{tema}" con sus propias palabras, apoyándose en los datos y el texto científico.`,
    ],
    [
      `Observan y analizan un video o presentación científica sobre "{tema}". Identifican el fenómeno, sus causas, condiciones y efectos.`,
      `Realizan un experimento sencillo sobre "{tema}" siguiendo el método científico: hipótesis → procedimiento → observación → análisis → conclusión.`,
      `Registran los resultados del experimento y los comparan con los de otros grupos. Identifican variables que pudieron haber afectado los resultados.`,
      `Construyen colectivamente una explicación científica consensuada del fenómeno de "{tema}". El docente sistematiza en la pizarra.`,
    ],
  ],
  // ── Grupo 1: Análisis y Construcción conceptual ──────────────────────────────
  [
    [
      `Analizan gráficas, tablas de datos o esquemas relacionados con "{tema}". Interpretan la información e identifican patrones, tendencias y relaciones.`,
      `Comparan los resultados de su experimento con datos de fuentes científicas confiables. Discuten las diferencias y sus posibles causas.`,
      `Elaboran un modelo o representación visual (diagrama, mapa conceptual, esquema de flujo) que explique el fenómeno de "{tema}".`,
      `Presentan su modelo al grupo, lo defienden con argumentos científicos y lo ajustan con la retroalimentación recibida.`,
    ],
    [
      `Investigan en fuentes adicionales aspectos de "{tema}" que quedaron sin responder en la experimentación: causas, variaciones, aplicaciones.`,
      `Redactan individualmente un informe científico breve de "{tema}": pregunta de investigación, hipótesis, procedimiento, resultados y conclusiones.`,
      `Intercambian informes con un compañero para revisión por pares: verifican la coherencia entre hipótesis, datos y conclusiones.`,
      `Integran las sugerencias recibidas y presentan la versión revisada al docente. El docente provee retroalimentación oral sobre el rigor científico.`,
    ],
  ],
  // ── Grupo 2: Aplicación y Propuesta ──────────────────────────────────────────
  [
    [
      `Aplican los conceptos de "{tema}" al análisis de un caso del entorno local o nacional: ¿cómo se manifiesta este fenómeno en nuestra comunidad?`,
      `Diseñan una propuesta de acción relacionada con "{tema}": campaña de concientización, proyecto de mejora ambiental o propuesta tecnológica.`,
      `Elaboran materiales de comunicación científica sobre "{tema}": infografía, tríptico, cartel o presentación para compartir con la comunidad escolar.`,
      `Exponen su propuesta y materiales ante el grupo. Reciben retroalimentación del docente y compañeros sobre la solidez científica y la viabilidad.`,
    ],
    [
      `Relacionan "{tema}" con avances tecnológicos contemporáneos: ¿cómo la ciencia ha permitido comprender o aprovechar este fenómeno?`,
      `Evalúan críticamente el impacto humano sobre "{tema}" desde perspectivas científica, ambiental y social.`,
      `Debaten sobre dilemas científico-éticos relacionados con "{tema}": _¿Cuáles son los límites que la ciencia debe respetar en este campo?_`,
      `Redactan una postura argumentada sobre el tema debatido. El docente cierra sistematizando los aportes más sólidos del debate.`,
    ],
  ],
];

const CN_CIERRE = [
  // ── Grupo 0 ──────────────────────────────────────────────────────────────────
  [
    [
      `Responden la pregunta de investigación inicial sobre "{tema}" usando los datos y observaciones recopilados durante la sesión.`,
      `Reflexionan sobre sus hipótesis: _¿Se confirmaron? ¿Se refutaron? ¿Qué nueva pregunta científica me genera este aprendizaje?_`,
      `Registran en su cuaderno las conclusiones del experimento o actividad y los conceptos científicos claves aprendidos.`,
      `Reciben orientación sobre la tarea y el docente conecta el fenómeno de "{tema}" con el próximo contenido de la unidad.`,
    ],
    [
      `Completan en su cuaderno el organizador KWL: la columna "Aprendí" sobre "{tema}" con los hallazgos científicos más importantes.`,
      `Reflexionan críticamente: _¿Qué responsabilidad tengo como ciudadano ante las implicaciones ambientales o sociales de {tema}?_`,
      `Integran la retroalimentación del docente sobre la calidad del registro científico y las conclusiones elaboradas.`,
      `Reciben orientación sobre la tarea y el docente anuncia el próximo contenido de la unidad.`,
    ],
  ],
  // ── Grupo 1 ──────────────────────────────────────────────────────────────────
  [
    [
      `Sintetizan los aprendizajes del día elaborando una definición propia de "{tema}" que integre los conceptos científicos trabajados.`,
      `Evalúan la calidad de su informe científico: _¿Son mis conclusiones coherentes con los datos? ¿Usé terminología científica correcta?_`,
      `Integran la retroalimentación del docente y compañero sobre el rigor científico de su informe o modelo.`,
      `Reciben orientación sobre la tarea y el docente anuncia el próximo paso en la investigación.`,
    ],
    [
      `Comparten oralmente el hallazgo más sorprendente o significativo que descubrieron hoy sobre "{tema}".`,
      `Reflexionan sobre el proceso de indagación: _¿Qué estrategia científica me resultó más efectiva? ¿Qué mejoraría en mi metodología?_`,
      `Establecen compromisos de observación científica para el hogar relacionados con "{tema}".`,
      `El docente cierra la sesión destacando la importancia del pensamiento científico para comprender el mundo y anuncia la próxima clase.`,
    ],
  ],
  // ── Grupo 2 ──────────────────────────────────────────────────────────────────
  [
    [
      `Evalúan la solidez científica de su propuesta o producción final sobre "{tema}": evidencias, terminología, coherencia.`,
      `Reflexionan sobre su crecimiento como científicos durante la unidad: _¿Cómo cambió mi forma de observar y explicar fenómenos naturales?_`,
      `Establecen compromisos concretos relacionados con la sostenibilidad ambiental o la salud vinculados a "{tema}".`,
      `El docente cierra valorando el pensamiento científico desarrollado y anuncia la próxima unidad o contenido.`,
    ],
    [
      `Autoevalúan su informe, propuesta o producción final usando los criterios de la rúbrica establecida para "{tema}".`,
      `Reflexionan sobre cómo los aprendizajes de "{tema}" conectan con otras asignaturas y con su vida cotidiana.`,
      `Comparten en plenaria una aplicación real o cotidiana del fenómeno estudiado que descubrieron durante la unidad.`,
      `El docente sintetiza los logros científicos del grupo y conecta el aprendizaje con el currículo de próximas unidades.`,
    ],
  ],
];

// ─── EDUCACIÓN FÍSICA ─────────────────────────────────────────────────────────

const EF_INICIO = [
  // ── Grupo 0: Motivación y calentamiento exploratorio ─────────────────────────
  [
    [
      `Se organizan en el espacio físico siguiendo indicaciones del docente. Realizan el saludo inicial y verifican vestimenta e implementos.`,
      `Realizan calentamiento general (5 min): trote suave, movilidad articular y estiramientos dinámicos preparando el cuerpo para la actividad de "{tema}".`,
      `Participan en un juego de iniciación lúdico que introduce las habilidades motrices básicas de "{tema}" de manera motivadora y cooperativa.`,
      `El docente explica el objetivo de la sesión, las normas de seguridad y el recorrido de actividades del día.`,
    ],
    [
      `Se organizan en el espacio con indicaciones del docente y realizan el calentamiento articular: cuello, hombros, caderas, rodillas, tobillos.`,
      `Responden preguntas de activación sobre "{tema}": _¿Qué habilidades físicas creen que se desarrollan en {tema}? ¿Lo han practicado antes?_`,
      `Demuestran espontáneamente una habilidad básica relacionada con "{tema}" y el docente retroalimenta los elementos técnicos observados.`,
      `Escuchan las indicaciones del docente sobre la progresión de actividades y los valores del fair play y la cooperación.`,
    ],
  ],
  // ── Grupo 1: Calentamiento específico y retroalimentación ────────────────────
  [
    [
      `Realizan calentamiento específico relacionado con las habilidades de "{tema}": ejercicios de coordinación, reacción o trabajo técnico preparatorio.`,
      `Retroalimentan la clase anterior: demuestran brevemente una técnica o habilidad trabajada previamente en "{tema}".`,
      `Participan en un juego de activación que simula las situaciones tácticas o técnicas que se trabajarán en la sesión.`,
      `Escuchan y repiten las orientaciones técnicas del docente sobre los elementos a mejorar en "{tema}" hoy.`,
    ],
    [
      `Realizan calentamiento progresivo: general → específico, ajustado a la demanda física y técnica de "{tema}".`,
      `Participan en una dinámica cooperativa de activación: juego de reacción, relevo o circuito que desarrolla atención y trabajo en equipo.`,
      `Retroalimentan: voluntarios demuestran la técnica correcta de un elemento de "{tema}" y el grupo identifica los puntos clave.`,
      `Se organizan en los grupos o estaciones de trabajo y escuchan las orientaciones del docente para la sesión.`,
    ],
  ],
  // ── Grupo 2: Activación orientada a la integración ───────────────────────────
  [
    [
      `Realizan calentamiento con balón, implemento o material de "{tema}": ejercicios técnicos específicos a ritmo progresivo.`,
      `Presentan brevemente el avance individual o grupal en "{tema}" y reciben retroalimentación del docente sobre aspectos técnicos a consolidar.`,
      `Realizan una actividad de activación competitiva y cooperativa que simula el escenario de la sesión principal.`,
      `Escuchan las orientaciones del docente sobre la evaluación de desempeño que se realizará durante la sesión.`,
    ],
    [
      `Realizan calentamiento mental y físico: visualización de la técnica de "{tema}" + calentamiento articular + ejercicio específico.`,
      `Participan en un juego de roles técnicos: cada estudiante tiene una función específica (base, defensa, árbitro, observador) en la actividad de activación.`,
      `Identifican colectivamente los aspectos técnicos y tácticos de "{tema}" que han mejorado durante la unidad.`,
      `Escuchan las orientaciones del docente sobre la sesión final o evaluación de desempeño en "{tema}".`,
    ],
  ],
];

const EF_DESARROLLO = [
  // ── Grupo 0: Exploración motriz ───────────────────────────────────────────────
  [
    [
      `Practican habilidades motrices básicas de "{tema}" individualmente siguiendo modelos demostrados por el docente. Reciben corrección inmediata.`,
      `Realizan ejercicios en parejas aplicando los elementos técnicos trabajados: uno ejecuta, el otro observa y retroalimenta usando criterios dados.`,
      `Participan en situaciones de juego simplificado relacionadas con "{tema}" con reglas adaptadas al nivel de aprendizaje del grupo.`,
      `Reflexionan en pausa activa: _¿Qué elemento técnico me cuesta más? ¿Cómo puedo mejorar mi desempeño en {tema}?_`,
    ],
    [
      `Observan una demostración del docente sobre la técnica correcta de "{tema}". Identifican y verbalizan los elementos técnicos clave.`,
      `Practican la técnica en progresión: ejercicios analíticos (partes del movimiento) → ejercicio global (movimiento completo).`,
      `Aplican la técnica en situaciones de juego reducido (2vs2, 3vs3) con las reglas adaptadas para "{tema}".`,
      `Evalúan su desempeño: el docente observa a grupos específicos y brinda retroalimentación personalizada. El grupo identifica logros colectivos.`,
    ],
  ],
  // ── Grupo 1: Práctica guiada y táctica ───────────────────────────────────────
  [
    [
      `Realizan estaciones de entrenamiento sobre "{tema}": cada estación trabaja un elemento técnico diferente. Rotan cada 5 minutos.`,
      `Aplican las habilidades de "{tema}" en situaciones de juego con reglas oficiales o modificadas según el nivel del grupo.`,
      `Asumen roles diferentes en la actividad (base, defensa, árbitro, capitán): analizan las decisiones tácticas desde cada posición.`,
      `El docente modera una pausa táctica: el grupo analiza jugadas, estrategias y situaciones del juego para mejorar el desempeño colectivo.`,
    ],
    [
      `Diseñan y ejecutan una estrategia de equipo para aplicar en la situación de juego o deporte relacionada con "{tema}".`,
      `Aplican la estrategia diseñada en una situación de competencia cooperativa o formal con reglas claras.`,
      `Evalúan colectivamente la efectividad de la estrategia: _¿Funcionó? ¿Por qué? ¿Qué ajustes necesitamos?_`,
      `Ajustan la estrategia e implementan una segunda ronda de juego incorporando los cambios acordados.`,
    ],
  ],
  // ── Grupo 2: Integración y evaluación del desempeño ──────────────────────────
  [
    [
      `Realizan un circuito de consolidación técnica de "{tema}" con niveles de dificultad progresiva. Los estudiantes autoseleccionan su nivel de desafío.`,
      `Participan en una competencia o demostración de habilidades donde aplican todo lo aprendido sobre "{tema}" durante la unidad.`,
      `Evalúan el desempeño individual y grupal usando criterios de observación establecidos. Identifican logros y aspectos a seguir practicando.`,
      `El docente retroalimenta el desempeño del grupo y destaca los avances más significativos en "{tema}" durante la unidad.`,
    ],
    [
      `Participan en un juego o deporte formal de "{tema}" aplicando técnica, táctica y valores trabajados durante la unidad.`,
      `Asumen responsabilidades de organización y arbitraje del juego: aplican las reglas con precisión y equidad.`,
      `Reflexionan sobre los valores deportivos evidenciados: respeto, cooperación, fair play y superación personal en "{tema}".`,
      `El docente cierra la actividad reconociendo públicamente los logros técnicos, tácticos y actitudinales del grupo.`,
    ],
  ],
];

const EF_CIERRE = [
  // ── Grupo 0 ──────────────────────────────────────────────────────────────────
  [
    [
      `Realizan enfriamiento (5 min): estiramientos estáticos de los grupos musculares trabajados en "{tema}". Respiración controlada.`,
      `Reflexionan sentados: _¿Qué habilidad pude practicar hoy en {tema}? ¿Qué elemento técnico me resultó más difícil?_`,
      `El docente brinda retroalimentación técnica sobre los aspectos observados y felicita el esfuerzo y la participación.`,
      `Reciben orientación sobre la próxima sesión y el docente destaca el valor del ejercicio físico para la salud y el bienestar.`,
    ],
    [
      `Realizan vuelta a la calma: estiramientos, hidratación y recogida ordenada del material utilizado.`,
      `Autoevalúan su desempeño del día usando una escala verbal (excelente / bueno / necesito mejorar) y justifican su respuesta.`,
      `Intercambian retroalimentación positiva: cada estudiante menciona algo positivo del desempeño de un compañero en "{tema}".`,
      `El docente cierra destacando los valores evidenciados y anuncia los contenidos de la próxima clase.`,
    ],
  ],
  // ── Grupo 1 ──────────────────────────────────────────────────────────────────
  [
    [
      `Realizan enfriamiento progresivo y estiramiento muscular específico de las zonas trabajadas en "{tema}".`,
      `Reflexionan sobre la táctica y las decisiones tomadas durante el juego: _¿Qué funcionó bien en nuestra estrategia? ¿Qué cambiaríamos?_`,
      `Establecen compromisos de práctica autónoma: _¿Qué elemento de {tema} practicaré por mi cuenta para mejorar?_`,
      `El docente felicita el esfuerzo colectivo, orienta la próxima sesión y recuerda la importancia de la práctica constante.`,
    ],
    [
      `Realizan vuelta a la calma guiada por un estudiante voluntario: estiramientos, respiración y relajación.`,
      `Reflexionan sobre el trabajo en equipo en "{tema}": _¿Cómo contribuí al éxito de mi equipo? ¿Cómo puedo ser mejor compañero?_`,
      `Reciben retroalimentación del docente sobre el desempeño táctico del grupo y los aspectos a fortalecer.`,
      `El docente conecta los valores deportivos de "{tema}" con valores de la vida cotidiana y anuncia la próxima clase.`,
    ],
  ],
  // ── Grupo 2 ──────────────────────────────────────────────────────────────────
  [
    [
      `Realizan la vuelta a la calma completa: enfriamiento físico, estiramiento y momento de reflexión en silencio.`,
      `Evalúan su desempeño en la competencia o demostración usando los criterios técnicos y actitudinales establecidos para "{tema}".`,
      `Comparten un aprendizaje significativo de la unidad sobre "{tema}": algo que descubrieron sobre sí mismos o sobre el deporte.`,
      `El docente cierra la unidad reconociendo el crecimiento individual y colectivo del grupo en "{tema}" y anuncia el próximo contenido.`,
    ],
    [
      `Realizan el ritual de cierre del deporte o actividad de "{tema}": apretón de manos, grito de equipo o saludo deportivo.`,
      `Reflexionan sobre los valores que vivieron durante la unidad de "{tema}": respeto, cooperación, superación y fair play.`,
      `Expresan compromisos personales de práctica deportiva y hábitos saludables relacionados con "{tema}" para la vida cotidiana.`,
      `El docente cierra con palabras de motivación, reconoce los logros del grupo y anuncia el próximo contenido curricular.`,
    ],
  ],
];

// ─── EDUCACIÓN ARTÍSTICA ──────────────────────────────────────────────────────

const EA_INICIO = [
  // ── Grupo 0: Sensibilización y exploración estética ──────────────────────────
  [
    [
      `Responden al saludo e indicaciones del docente en el espacio preparado para la actividad artística de "{tema}".`,
      `Participan en un ejercicio de sensibilización: observan obras relacionadas con "{tema}" en silencio durante 2 minutos y luego expresan libremente sus impresiones.`,
      `Exploran libremente los materiales disponibles para "{tema}": tocan, huelen, prueban, escuchan. Describen sus percepciones sensoriales.`,
      `Expresan qué emociones, colores, texturas o sonidos les evoca "{tema}" antes de comenzar la creación formal.`,
      `Escuchan la intención pedagógica y el desafío creativo de la sesión.`,
    ],
    [
      `Responden al saludo e indicaciones del docente y realizan un ejercicio breve de respiración y concentración creativa.`,
      `Observan obras de artistas dominicanos o universales relacionadas con "{tema}": _¿Qué técnica usaron? ¿Qué mensaje comunican? ¿Qué les transmite?_`,
      `Expresan asociaciones libres relacionadas con "{tema}": palabras, colores, formas, sonidos o movimientos que les surgen espontáneamente.`,
      `Formulan su intención artística personal: _¿Qué quiero expresar o comunicar a través de mi creación sobre {tema}?_`,
      `Escuchan el objetivo creativo de la sesión y los materiales que utilizarán.`,
    ],
  ],
  // ── Grupo 1: Análisis y exploración técnica ───────────────────────────────────
  [
    [
      `Responden al saludo e indicaciones del docente y revisan el avance de su producción artística sobre "{tema}".`,
      `Analizan obras de referencia con mayor profundidad: elementos del lenguaje artístico usados (composición, color, ritmo, textura, espacio).`,
      `Experimentan con variaciones técnicas de "{tema}": diferentes herramientas, soportes, gestos o combinaciones de materiales.`,
      `Seleccionan la técnica o combinación que mejor expresa su intención artística y la argumentan brevemente.`,
      `Escuchan orientaciones del docente sobre criterios estéticos y técnicos para la sesión de hoy.`,
    ],
    [
      `Realizan el saludo e indicaciones iniciales. El docente presenta el reto creativo del día sobre "{tema}".`,
      `Observan y comparan diferentes interpretaciones artísticas de "{tema}": ¿cómo cada artista expresa lo mismo de manera distinta?`,
      `Retroalimentan su producción anterior: voluntarios muestran su avance y el grupo ofrece retroalimentación apreciativa y constructiva.`,
      `Establecen sus metas creativas para la sesión: ¿qué aspecto técnico o expresivo de "{tema}" quieren mejorar o explorar hoy?`,
      `Escuchan criterios de valoración estética y técnica de la sesión.`,
    ],
  ],
  // ── Grupo 2: Producción final y apreciación ───────────────────────────────────
  [
    [
      `Responden al saludo e indicaciones del docente.`,
      `Evalúan la calidad de su producción final sobre "{tema}" usando los criterios estéticos y técnicos establecidos.`,
      `Realizan los ajustes finales: detalles técnicos, elementos expresivos, presentación y titulo de la obra.`,
      `Preparan la exposición de su producción: escriben una breve declaración artística que explique su intención creativa en "{tema}".`,
      `Escuchan las orientaciones del docente para la galería de aula o la presentación final.`,
    ],
    [
      `Responden al saludo e indicaciones del docente y realizan un ejercicio de apreciación colectiva de las producciones en proceso del grupo.`,
      `Relacionan su producción artística de "{tema}" con manifestaciones culturales dominicanas: pintores, músicos, artesanos o artistas plásticos nacionales.`,
      `Reflexionan sobre cómo el arte de "{tema}" conecta con la identidad cultural y el patrimonio de su comunidad.`,
      `Se preparan para presentar su producción destacando la influencia cultural e identitaria en sus decisiones artísticas.`,
      `Escuchan criterios de apreciación cultural para la presentación o galería de la sesión.`,
    ],
  ],
];

const EA_DESARROLLO = [
  // ── Grupo 0: Exploración y experimentación técnica ────────────────────────────
  [
    [
      `Exploran libremente la técnica o material de "{tema}" mediante ejercicios de calentamiento creativo: bocetos, garabatos, improvisaciones sonoras o motrices.`,
      `El docente modela la técnica artística de "{tema}" paso a paso. Los estudiantes observan e identifican los elementos clave de la técnica.`,
      `Realizan ejercicios de práctica técnica guiada sobre "{tema}": el docente circla, observa y ofrece orientación personalizada.`,
      `Inician su producción artística sobre "{tema}" explorando libremente. Comparten con un compañero sus primeras decisiones creativas.`,
    ],
    [
      `Analizan el lenguaje artístico de "{tema}": composición, color, línea, textura, ritmo, forma o espacio. El docente guía el análisis con preguntas.`,
      `Experimentan con variaciones de la técnica de "{tema}": diferentes presiones, velocidades, combinaciones o soportes.`,
      `Producen una muestra exploratoria de "{tema}" con la técnica seleccionada. Toman decisiones estéticas de forma progresivamente autónoma.`,
      `Comparten la muestra exploratoria con el grupo: explican sus decisiones creativas y reciben retroalimentación constructiva.`,
    ],
  ],
  // ── Grupo 1: Producción con criterios ─────────────────────────────────────────
  [
    [
      `Continúan y desarrollan su producción artística sobre "{tema}" aplicando los criterios técnicos y expresivos trabajados.`,
      `El docente realiza retroalimentación formativa individualizada: señala logros específicos y sugiere mejoras técnicas o expresivas.`,
      `Incorporan elementos de la cultura dominicana o latinoamericana en su producción artística sobre "{tema}".`,
      `Avanzan significativamente en su producción. Documentan su proceso creativo con notas o fotografías (si hay recursos disponibles).`,
    ],
    [
      `Observan obras de referencia cultural relacionadas con "{tema}" y seleccionan elementos técnicos o expresivos para incorporar en su producción.`,
      `Producen de forma sostenida su obra sobre "{tema}" tomando decisiones creativas cada vez más autónomas y fundamentadas.`,
      `Realizan una autoevaluación parcial: _¿Mi producción comunica lo que quiero expresar sobre {tema}? ¿Qué debo ajustar?_`,
      `Integran los ajustes necesarios y el docente verifica el avance general del grupo hacia los criterios de calidad establecidos.`,
    ],
  ],
  // ── Grupo 2: Producción final y exposición ────────────────────────────────────
  [
    [
      `Finalizan su producción artística sobre "{tema}" aplicando los últimos detalles técnicos y expresivos con cuidado y precisión.`,
      `Preparan la presentación oral de su obra: título, técnica utilizada, intención artística y conexión cultural de "{tema}".`,
      `Realizan la galería de aula o presentación formal: exhiben sus producciones y explican su proceso creativo al grupo.`,
      `El grupo aprecia las producciones usando criterios de valoración estética: técnica, expresividad, originalidad y mensaje de "{tema}".`,
    ],
    [
      `Interpretan y analizan las producciones del grupo usando el lenguaje artístico: _¿Qué técnica usó? ¿Qué comunica? ¿Qué es lo más expresivo?_`,
      `Comparan su producción final con el boceto o idea inicial: _¿Cómo evolucionó mi obra de "{tema}" durante el proceso creativo?_`,
      `Reflexionan sobre el significado cultural de las producciones del grupo: _¿Cómo refleja nuestra galería la identidad dominicana?_`,
      `El docente cierra la galería destacando los logros artísticos individuales y colectivos de la unidad sobre "{tema}".`,
    ],
  ],
];

const EA_CIERRE = [
  // ── Grupo 0 ──────────────────────────────────────────────────────────────────
  [
    [
      `Observan las producciones o muestras del día y expresan una palabra que describe cómo se sintieron durante el proceso creativo de "{tema}".`,
      `Reflexionan: _¿Qué técnica de {tema} descubrí hoy? ¿Qué elemento artístico quiero seguir explorando?_`,
      `Reciben orientación del docente sobre el proceso creativo observado y los criterios a desarrollar en la próxima sesión.`,
      `El docente anuncia el próximo desafío creativo y conecta el arte de "{tema}" con la cultura dominicana.`,
    ],
    [
      `Comparten una decisión creativa tomada durante la sesión sobre "{tema}" y explican el porqué de esa elección.`,
      `Reflexionan sobre la conexión entre arte y cotidianidad: _¿Dónde veo expresiones de {tema} en mi entorno?_`,
      `Reciben retroalimentación del docente sobre los logros técnicos y expresivos de la sesión.`,
      `El docente orienta la tarea (si aplica) y conecta el arte trabajado con la próxima experiencia creativa.`,
    ],
  ],
  // ── Grupo 1 ──────────────────────────────────────────────────────────────────
  [
    [
      `Autoevalúan su producción usando criterios: técnica, originalidad, expresividad y comunicación del mensaje de "{tema}".`,
      `Reflexionan sobre el proceso de aprendizaje: _¿Qué técnica de {tema} domino mejor ahora? ¿Qué sigo necesitando practicar?_`,
      `Integran la retroalimentación del docente sobre la calidad técnica y expresiva de su producción.`,
      `El docente felicita el trabajo creativo y orienta la continuación de la producción en la próxima sesión.`,
    ],
    [
      `Participan en una apreciación grupal: cada estudiante menciona el aspecto más logrado en la producción de un compañero sobre "{tema}".`,
      `Reflexionan sobre la diversidad de expresiones artísticas del grupo: _¿Por qué cada uno interpretó {tema} de manera diferente?_`,
      `Establecen compromisos de exploración artística personal: _¿Qué técnica o elemento de {tema} investigaré o practicaré por mi cuenta?_`,
      `El docente cierra destacando la importancia del arte como medio de expresión e identidad cultural.`,
    ],
  ],
  // ── Grupo 2 ──────────────────────────────────────────────────────────────────
  [
    [
      `Participan en la apreciación final de las producciones de la galería usando lenguaje artístico apropiado sobre "{tema}".`,
      `Reflexionan sobre su crecimiento artístico durante la unidad: _¿Cómo evolucionó mi forma de crear y expresar en {tema}?_`,
      `Expresan el significado personal de su obra y cómo refleja su identidad cultural o emocional.`,
      `El docente cierra la unidad artística celebrando las producciones del grupo y anunciando el próximo trabajo creativo.`,
    ],
    [
      `Redactan en su cuaderno una reflexión final sobre "{tema}": _¿Qué aprendí sobre la técnica? ¿Qué aprendí sobre mí como artista?_`,
      `Comparten su reflexión en parejas y escuchan la de su compañero. Identifican aprendizajes compartidos sobre "{tema}".`,
      `Reciben retroalimentación final del docente sobre su producción y proceso creativo durante la unidad.`,
      `El docente celebra el arte producido por el grupo y conecta "{tema}" con el patrimonio cultural dominicano y universal.`,
    ],
  ],
];

// ─── FORMACIÓN INTEGRAL HUMANA Y RELIGIOSA ────────────────────────────────────

const FIHR_INICIO = [
  // ── Grupo 0: Motivación y exploración de valores ─────────────────────────────
  [
    [
      `Responden al saludo e indicaciones del docente en un ambiente de confianza y respeto.`,
      `Observan una imagen, noticia o situación del entorno relacionada con "{tema}" y expresan sus primeras impresiones libremente.`,
      `Comparten experiencias personales relacionadas con "{tema}": _¿Han vivido o presenciado una situación así? ¿Cómo respondieron?_`,
      `Identifican los valores en juego en la situación presentada sobre "{tema}" y los relacionan con su vida cotidiana.`,
      `Escuchan la intención pedagógica y acuerdan normas de participación respetuosa para la sesión.`,
    ],
    [
      `Responden al saludo e indicaciones del docente y realizan un momento breve de reflexión personal (silencio o pregunta de introspección sobre "{tema}").`,
      `Analizan un relato, historia de vida o testimonio relacionado con "{tema}" que invite a la reflexión ética y humana.`,
      `Expresan qué sentimientos o pensamientos les generó la historia escuchada sobre "{tema}" con respeto y apertura.`,
      `Relacionan la historia con situaciones de su comunidad escolar o familiar donde se viven los valores de "{tema}".`,
      `Escuchan el objetivo de la sesión y la intención formativa del día.`,
    ],
  ],
  // ── Grupo 1: Reflexión crítica y construcción de valores ─────────────────────
  [
    [
      `Responden al saludo e indicaciones del docente.`,
      `Retroalimentan la sesión anterior: voluntarios comparten un compromiso personal o reflexión sobre "{tema}" que han intentado aplicar en su vida.`,
      `Analizan un dilema ético relacionado con "{tema}" desde diferentes perspectivas: personal, comunitaria, religiosa y ciudadana.`,
      `Elaboran en grupos pequeños una propuesta de respuesta al dilema que sea coherente con los valores de "{tema}" y los derechos humanos.`,
      `Escuchan el objetivo de la sesión y se preparan para el diálogo reflexivo del día.`,
    ],
    [
      `Responden al saludo e indicaciones del docente y participan en una dinámica de cohesión de grupo relacionada con los valores de "{tema}".`,
      `Estudian perspectivas filosóficas, religiosas o culturales sobre "{tema}". Identifican puntos de convergencia entre tradiciones diversas.`,
      `Debaten respetuosamente: _¿Cómo diferentes culturas o religiones abordan el valor de {tema}? ¿Qué tienen en común?_`,
      `Sintetizan los puntos de convergencia y diferencia en un organizador gráfico o mural de valores compartidos.`,
      `Escuchan orientaciones del docente sobre cómo aplicar los valores identificados en su vida cotidiana.`,
    ],
  ],
  // ── Grupo 2: Aplicación y compromiso personal ─────────────────────────────────
  [
    [
      `Responden al saludo e indicaciones del docente.`,
      `Presentan el avance de su proyecto o propuesta de acción relacionada con "{tema}".`,
      `Reciben retroalimentación del docente y compañeros sobre la coherencia entre los valores de "{tema}" y las acciones propuestas.`,
      `Ajustan su propuesta incorporando las observaciones recibidas y fortalecen sus argumentos éticos.`,
      `Escuchan orientaciones del docente sobre la presentación final o el momento de compromiso colectivo.`,
    ],
    [
      `Responden al saludo e indicaciones del docente y realizan una reflexión motivacional final relacionada con los valores de "{tema}".`,
      `Evalúan críticamente el impacto de sus acciones y propuestas sobre "{tema}" en su escuela y comunidad.`,
      `Relacionan "{tema}" con situaciones de justicia social, derechos humanos o bien común presentes en la realidad dominicana.`,
      `Proponen acciones concretas de transformación comunitaria inspiradas en los valores de "{tema}".`,
      `Escuchan la síntesis del docente sobre los aprendizajes más significativos de la unidad.`,
    ],
  ],
];

const FIHR_DESARROLLO = [
  // ── Grupo 0: Exploración y diálogo ────────────────────────────────────────────
  [
    [
      `Leen y analizan textos filosóficos, religiosos o literarios sobre "{tema}". Identifican los valores explícitos e implícitos presentes.`,
      `Dialogan en grupos pequeños sobre "{tema}" desde su experiencia personal: _¿Qué significa {tema} para mí? ¿Cómo lo vivo en mi familia y escuela?_`,
      `Elaboran una reflexión escrita, poema, oración o producción creativa que exprese su comprensión personal de "{tema}".`,
      `Socializan sus producciones en un clima de respeto y escucha activa. El docente valida y enriquece las reflexiones compartidas.`,
    ],
    [
      `Observan un video, documental o testimonio sobre cómo "{tema}" se vive o se viola en diferentes contextos del mundo.`,
      `Analizan casos de la realidad dominicana donde "{tema}" se manifiesta o se necesita fortalecer: familia, escuela, barrio, nación.`,
      `Elaboran un diagnóstico comunitario: _¿Dónde se vive {tema} en mi entorno? ¿Dónde se necesita fortalecer?_`,
      `Comparten su diagnóstico con el grupo. El docente facilita el diálogo y conecta los hallazgos con los valores universales relacionados con "{tema}".`,
    ],
  ],
  // ── Grupo 1: Análisis crítico y propuesta ─────────────────────────────────────
  [
    [
      `Analizan situaciones de injusticia, exclusión o conflicto relacionadas con "{tema}" desde una perspectiva ética y de derechos humanos.`,
      `Proponen respuestas éticas fundamentadas: _¿Qué principios o valores deben guiar las acciones ante esta situación de {tema}?_`,
      `Redactan un decálogo de compromisos personales o grupales relacionados con "{tema}" aplicables en su vida cotidiana.`,
      `Presentan y debaten sus propuestas de acción. El docente sistematiza los compromisos más significativos y los conecta con la responsabilidad ciudadana.`,
    ],
    [
      `Estudian modelos de liderazgo ético o servicio comunitario relacionados con "{tema}": personajes históricos, líderes religiosos o figuras de la cultura dominicana.`,
      `Analizan cómo estos modelos de vida expresan los valores de "{tema}" en sus acciones concretas.`,
      `Diseñan un proyecto de servicio comunitario o acción social inspirado en los valores de "{tema}" que puedan implementar en su escuela o barrio.`,
      `Presentan su proyecto al grupo y reciben retroalimentación sobre su viabilidad, impacto y coherencia con los valores de "{tema}".`,
    ],
  ],
  // ── Grupo 2: Integración y acción ─────────────────────────────────────────────
  [
    [
      `Implementan o presentan el proyecto de servicio o acción comunitaria relacionado con "{tema}".`,
      `Evalúan el impacto de su acción: _¿Logramos promover {tema}? ¿Qué obstáculos enfrentamos? ¿Cómo los superamos?_`,
      `Comparten los aprendizajes de la experiencia de servicio: lo que funcionó, lo que cambiarían y lo que esta experiencia les dejó personalmente.`,
      `El docente cierra sistematizando los valores vividos y el impacto comunitario del proyecto sobre "{tema}".`,
    ],
    [
      `Redactan un manifiesto ético o carta de compromisos colectivos relacionados con "{tema}" para su comunidad escolar.`,
      `Diseñan materiales de difusión sobre los valores de "{tema}": carteles, mensajes, dramatizaciones o afiches para la escuela.`,
      `Comparten los materiales con la comunidad escolar o los presentan en un momento significativo de cierre.`,
      `El docente cierra valorando el crecimiento personal, ético y espiritual del grupo durante la unidad sobre "{tema}".`,
    ],
  ],
];

const FIHR_CIERRE = [
  // ── Grupo 0 ──────────────────────────────────────────────────────────────────
  [
    [
      `Comparten una frase, palabra o imagen que representa lo que "{tema}" significa para ellos después de la sesión.`,
      `Reflexionan: _¿Qué cambiaría en mi vida si viviera plenamente el valor de {tema}? ¿Qué pequeño paso puedo dar mañana?_`,
      `Integran la retroalimentación del docente y establecen un compromiso personal concreto relacionado con "{tema}".`,
      `El docente cierra con una reflexión motivacional y anuncia la continuación de la exploración de "{tema}" en la próxima sesión.`,
    ],
    [
      `Completan la frase de metacognición: _"Antes pensaba que {tema}... Ahora entiendo que... Me comprometo a..."_`,
      `Reflexionan sobre cómo el valor de "{tema}" puede transformar las relaciones en su escuela, familia y comunidad.`,
      `Comparten un testimonio breve sobre una situación donde vivieron o necesitaron el valor de "{tema}" recientemente.`,
      `El docente cierra con palabras de valoración y anuncia la próxima sesión.`,
    ],
  ],
  // ── Grupo 1 ──────────────────────────────────────────────────────────────────
  [
    [
      `Evalúan la coherencia de sus compromisos y propuestas: _¿Son realizables? ¿Están fundamentados en los valores de {tema}?_`,
      `Reflexionan sobre el dilema ético trabajado: _¿Cuál sería mi decisión ahora con los aprendizajes de la sesión? ¿Por qué?_`,
      `Integran la retroalimentación del docente sobre la calidad ética y la fundamentación de sus propuestas sobre "{tema}".`,
      `El docente conecta los valores de "{tema}" con el próximo contenido de la unidad y anuncia la próxima sesión.`,
    ],
    [
      `Presentan públicamente su compromiso personal relacionado con "{tema}" ante el grupo (opcional: lo firman en un mural de compromisos).`,
      `Reflexionan sobre los modelos de vida analizados: _¿Qué rasgo de su manera de vivir {tema} me gustaría imitar?_`,
      `Reciben palabras de ánimo y reconocimiento del docente y compañeros sobre sus propuestas de acción.`,
      `El docente cierra la sesión con una oración, reflexión espiritual o momento de silencio según la diversidad del grupo.`,
    ],
  ],
  // ── Grupo 2 ──────────────────────────────────────────────────────────────────
  [
    [
      `Reflexionan sobre el impacto de la unidad en su vida: _¿Qué cambió en mi forma de pensar, sentir o actuar respecto a {tema}?_`,
      `Comparten públicamente un compromiso que se llevan de la unidad sobre "{tema}" para vivir en su hogar, escuela o comunidad.`,
      `Reciben el reconocimiento del grupo por su crecimiento personal y su contribución al bien común a través de "{tema}".`,
      `El docente cierra con palabras de valoración, una oración o una reflexión espiritual y anuncia el próximo aprendizaje.`,
    ],
    [
      `Participan en un ritual de cierre significativo relacionado con "{tema}": círculo de reflexión, compartir un valor o momento de gratitud colectiva.`,
      `Expresan en una palabra o símbolo cómo se sienten después de haber trabajado "{tema}" durante la unidad.`,
      `Elaboran una carta personal a sí mismos con los compromisos que asumen respecto a "{tema}" para los próximos meses.`,
      `El docente cierra celebrando el crecimiento personal y colectivo del grupo y anunciando la próxima unidad de aprendizaje.`,
    ],
  ],
];

// ─── INGLÉS ───────────────────────────────────────────────────────────────────

const EN_INICIO = [
  // ── Grupo 0: Orientación al producto y diagnóstico de vocabulario ─────────────
  [
    [
      `Observan ejemplos del producto final de la unidad relacionados con "{tema}" (posters, brochures, diálogos grabados, infografías). Analizan la rúbrica de evaluación: criterios de calidad, descriptores y aspectos que deberán desarrollar durante la unidad.`,
      `Observan imágenes relacionadas con "{tema}" e identifican vocabulario clave en inglés. Escuchan y practican la pronunciación guiada de verbos de acción y expresiones de uso frecuente _(listen and repeat: wake up, have breakfast, go to school / in the morning, at noon, at night)_.`,
      `Organizan el vocabulario de "{tema}" por categorías en sus cuadernos: verbos de acción, expresiones de tiempo, adjetivos descriptivos y frases útiles para comunicarse.`,
      `Guardan la producción escrita como **Entrada 0 del Portafolio**. Elaboran un bosquejo inicial del producto final: qué incluirán, cómo lo organizarán y qué vocabulario usarán.`,
    ],
    [
      `Observan producciones auténticas en inglés sobre "{tema}" (posts en redes, textos de libros de texto, videos cortos sin subtítulos). Identifican vocabulario que reconocen y vocabulario nuevo; comparten con el grupo: _What words do you already know?_`,
      `Escuchan una canción o audio breve en inglés relacionado con "{tema}". Identifican palabras clave y las comparten oralmente. Practican la pronunciación de las expresiones identificadas _(go to school, do homework, have dinner, go to bed)_.`,
      `Organizan en sus cuadernos las palabras y expresiones de "{tema}" por categorías propias elegidas por ellos mismos. Comparten su organización con un compañero y explican por qué agruparon así.`,
      `Guardan el vocabulario organizado como **Entrada 0 del Portafolio**. Elaboran un bosquejo inicial de cómo imaginan su producto final sobre "{tema}".`,
    ],
  ],
  // ── Grupo 1: Construcción lingüística y activación del conocimiento previo ────
  [
    [
      `Observan el producto final de la sesión anterior sobre "{tema}" y revisan la rúbrica de evaluación. Identifican qué criterios ya cumplen y cuáles deben seguir desarrollando.`,
      `Observan un video corto en inglés sobre "{tema}" sin subtítulos. Identifican vocabulario conocido, expresiones nuevas y estructuras gramaticales usadas por los hablantes _(I usually..., Every day I..., First I..., Then I...)_.`,
      `Organizan en sus cuadernos el vocabulario nuevo de "{tema}" por categorías: palabras que ya usan, palabras nuevas que quieren aprender, expresiones que necesitan practicar más.`,
      `Guardan el vocabulario organizado como **Entrada 1 del Portafolio**. Elaboran una primera versión escrita del producto con el vocabulario disponible hasta el momento.`,
    ],
    [
      `Observan imágenes y ejemplos de textos en inglés sobre "{tema}" y responden preguntas de activación: _What do you see? What English words can you use to describe this? Have you done this before?_`,
      `Escuchan un diálogo o conversación auténtica en inglés sobre "{tema}" (2 escuchas). Primera: ¿de qué se habla? Segunda: ¿qué vocabulario y estructuras usan? _(Do you usually...? Yes, I always... / No, I never...)_`,
      `Identifican y organizan en sus cuadernos las estrategias comunicativas del audio: cómo piden información, cómo describen, cómo expresan frecuencia o rutina sobre "{tema}".`,
      `Elaboran en parejas una producción oral o escrita inicial sobre "{tema}" usando las estrategias y vocabulario identificados. La guardan en el Portafolio como evidencia de su punto de partida.`,
    ],
  ],
  // ── Grupo 2: Revisión y orientación hacia la producción final ─────────────────
  [
    [
      `Observan su producción anterior de "{tema}" guardada en el Portafolio. La comparan con ejemplos de alta calidad usando la rúbrica de evaluación: ¿qué mejoraron? ¿qué les falta?`,
      `Identifican brechas de vocabulario en su producción de "{tema}": palabras que necesitan, estructuras que no dominan aún. Escuchan y practican las expresiones que les faltan _(I would like to..., In my opinion..., One example is...)_.`,
      `Organizan en sus cuadernos una lista de revisión personal para mejorar su producción de "{tema}": vocabulario pendiente, estructuras a practicar, criterios de la rúbrica que deben fortalecer.`,
      `Guardan la lista de revisión como **Entrada del Portafolio**. Elaboran el borrador mejorado del producto final incorporando los ajustes identificados.`,
    ],
    [
      `Observan producciones de compañeros sobre "{tema}" (con su permiso) y las comparan con la rúbrica de evaluación. Identifican fortalezas y aspectos de mejora de manera respetuosa y constructiva.`,
      `Escuchan y practican en parejas el vocabulario y las estructuras que más les cuesta usar en inglés sobre "{tema}". El docente rota por los grupos corrigiendo pronunciación y uso gramatical.`,
      `Identifican y organizan en sus cuadernos las correcciones más importantes recibidas sobre "{tema}": pronunciación, gramática, vocabulario y organización del texto o discurso.`,
      `Guardan las correcciones en el Portafolio. Elaboran el borrador final del producto sobre "{tema}" incorporando todas las mejoras identificadas durante la revisión entre pares.`,
    ],
  ],
];

const EN_DESARROLLO = [
  // ── Grupo 0: Listening + Speaking ─────────────────────────────────────────────
  [
    [
      `Escuchan un audio o diálogo en inglés sobre "{tema}" (3 escuchas progresivas). Primera: identifican el tema general. Segunda: anotan palabras y expresiones clave. Tercera: responden preguntas de detalle _(Who is speaking? What are they doing? When and where?)_.`,
      `Analizan las estructuras gramaticales del audio de "{tema}": tiempo verbal, orden de palabras, uso de adverbios de frecuencia _(always, usually, sometimes, never)_ y expresiones de tiempo _(at 7 a.m., every morning, on weekdays)_.`,
      `Practican en parejas la pronunciación del vocabulario de "{tema}": el docente corrige la entonación, el ritmo y los sonidos del inglés sin equivalente directo en español. _(Repeat after me — stress the first syllable: MORning, BREAKfast, SCHOol)_`,
      `Realizan un speaking en parejas usando el vocabulario y las estructuras del audio sobre "{tema}". _(Ask your partner: What do you usually do in the morning? Then switch — you have 3 minutes. Ready? Go!)_`,
    ],
    [
      `Observan un video corto auténtico en inglés sobre "{tema}" sin subtítulos. Identifican vocabulario, expresiones y estructuras en uso real. Anotan en sus cuadernos lo que escuchan y entienden.`,
      `Analizan con el docente el vocabulario y las estructuras del video sobre "{tema}": palabras clave, cognados útiles _(routine, activity, schedule)_ y expresiones comunicativas de uso frecuente en inglés.`,
      `Practican las estructuras de "{tema}" mediante ejercicios de sustitución controlada: el docente da el modelo y los estudiantes lo adaptan a su propia realidad _(I wake up at... / She goes to school at... / They usually...)_.`,
      `Elaboran un role-play o diálogo guiado sobre "{tema}" usando las estructuras del video como modelo. Lo presentan en parejas ante el grupo. _(Switch roles and try again — this time without looking at your notes!)_`,
    ],
  ],
  // ── Grupo 1: Reading + Vocabulary building ────────────────────────────────────
  [
    [
      `Leen un texto auténtico en inglés sobre "{tema}" (artículo, blog, descripción personal) e identifican: idea principal, vocabulario nuevo, estructuras gramaticales en uso y conectores del discurso _(first, then, after that, finally)_.`,
      `Analizan el vocabulario nuevo de "{tema}": pronunciación guiada, significado inferido desde el contexto, uso en oraciones propias. Elaboran un glosario visual en sus cuadernos: **palabra en inglés → imagen o definición en inglés → oración propia**.`,
      `Completan ejercicios de vocabulario contextualizados sobre "{tema}": completar frases con la palabra correcta, emparejar expresiones con imágenes, ordenar palabras para formar oraciones coherentes.`,
      `Leen párrafos sobre "{tema}" en voz alta en parejas. Practican la entonación, el ritmo y la pronunciación. El docente rota corrigiendo y modelando la lectura expresiva en inglés.`,
    ],
    [
      `Leen textos de diferente complejidad sobre "{tema}" y responden preguntas de comprensión literal _(What does the text say?)_, inferencial _(What can you conclude?)_ e interpretativa _(How does this connect to your life?)_.`,
      `Identifican patrones gramaticales en los textos de "{tema}": tiempos verbales, adverbios de frecuencia, preposiciones de tiempo y lugar, adjetivos calificativos. Los analizan en contexto real _(Look at this sentence — what grammar rule is being used? Can you find three more examples in the text?)_.`,
      `Elaboran en sus cuadernos un glosario visual ampliado de "{tema}" por categorías: **verbos de acción | expresiones de tiempo | adjetivos descriptivos | frases para comunicarse**. Ilustran o ejemplifican cada entrada.`,
      `Practican la lectura expresiva de textos de "{tema}" en voz alta. Graban o presentan ante un compañero. Reciben retroalimentación sobre pronunciación, entonación y comprensión del texto.`,
    ],
  ],
  // ── Grupo 2: Writing + Grammar in context ────────────────────────────────────
  [
    [
      `Observan y analizan una producción escrita modelo sobre "{tema}": identifican la estructura del texto, el vocabulario seleccionado, los conectores usados _(first, however, in conclusion)_ y el registro lingüístico apropiado para la audiencia.`,
      `Practican la estructura gramatical de "{tema}" en ejercicios contextualizados: transforman oraciones, completan textos con la forma verbal correcta y producen oraciones propias sobre su realidad _(Write your own sentence using this structure — make it true about your daily life!)_.`,
      `Redactan una producción escrita individual sobre "{tema}" (descripción, narración, diálogo o párrafo argumentativo) usando el vocabulario y las estructuras trabajadas. Se apoyan en el modelo analizado al inicio de la actividad.`,
      `Intercambian producciones con un compañero para revisión por pares: verifican vocabulario, estructuras gramaticales, ortografía y coherencia. Dan retroalimentación por escrito y la incorporan a su propia producción.`,
    ],
    [
      `Observan textos auténticos en inglés relacionados con "{tema}": mensajes, anuncios, etiquetas, publicaciones en redes sociales. Identifican cómo el inglés real difiere del inglés académico y qué vocabulario es más útil en contextos cotidianos.`,
      `Comparan el inglés con el español en el contexto de "{tema}": identifican cognados útiles _(routine → rutina, activity → actividad)_, falsos amigos y diferencias en el orden de palabras, la gramática y la pronunciación que deben atender.`,
      `Producen un texto escrito más elaborado sobre "{tema}": descripción personal, narración de rutinas, argumentación o conversación extendida usando estructuras del nivel y el vocabulario acumulado en el Portafolio.`,
      `Comparten su producción ante el grupo o en parejas. Reciben retroalimentación del docente y sus compañeros sobre precisión gramatical, selección de vocabulario, organización del texto y expresividad comunicativa.`,
    ],
  ],
];

const EN_CIERRE = [
  // ── Grupo 0 ──────────────────────────────────────────────────────────────────
  [
    [
      `Elaboran tres a cinco oraciones sencillas en inglés sobre "{tema}" usando el vocabulario trabajado durante la sesión. Las leen en voz alta al grupo o en parejas. _(Use the words from today: wake up, have breakfast, go to school, in the morning...)_`,
      `Guardan la producción escrita como **Entrada del Portafolio**. Reflexionan brevemente: _What did I learn today about {tema}? What was difficult? What do I want to keep practicing?_`,
      `Organizan en sus cuadernos el vocabulario nuevo de "{tema}" aprendido en la sesión: agregan palabras a sus categorías existentes y completan su glosario visual personal.`,
      `Reciben orientación sobre la tarea de práctica en casa relacionada con "{tema}". El docente conecta el contenido del día con la próxima sesión y motiva: _(Great work! Keep using English outside class — practice makes perfect!)_`,
    ],
    [
      `Completan un exit ticket en inglés sobre "{tema}": _(Today I learned... I practiced... I found it difficult to... Next class I want to...)_. Lo guardan en el Portafolio como evidencia de su reflexión metacognitiva.`,
      `Resumen oralmente el contenido de "{tema}": tres voluntarios comparten una oración o expresión aprendida y la usan en un ejemplo de su vida cotidiana dominicana.`,
      `Organizan en sus cuadernos el vocabulario de "{tema}": revisan las categorías del día y agregan cualquier palabra nueva que identificaron durante la sesión.`,
      `Reciben retroalimentación final del docente sobre su desempeño en las actividades de listening y speaking de "{tema}". _(You are improving every class! Don't stop practicing!)_`,
    ],
  ],
  // ── Grupo 1 ──────────────────────────────────────────────────────────────────
  [
    [
      `Construyen colectivamente en la pizarra un **vocabulary wall** de "{tema}": el docente escribe las palabras que los estudiantes van aportando. Lo fotografían o copian en sus cuadernos para usarlo en futuras sesiones.`,
      `Elaboran de tres a cinco oraciones sobre "{tema}" usando el vocabulario del vocabulary wall. Las leen en voz alta con atención a la pronunciación y la entonación. Reciben retroalimentación del docente.`,
      `Guardan las oraciones como **Entrada del Portafolio**. Reflexionan: _¿Qué estrategia me ayudó más a entender el inglés sobre {tema}? ¿Cómo puedo seguir practicando fuera de clase?_`,
      `Reciben orientación sobre la tarea de práctica en casa de "{tema}" y la conectan con el aprendizaje del día y el producto final de la unidad.`,
    ],
    [
      `Realizan una síntesis oral en parejas sobre "{tema}": uno hace preguntas y el otro responde usando el vocabulario y estructuras de la sesión. _(Ask your partner: Do you usually...? What time do you...? Switch roles after 2 minutes.)_`,
      `Elaboran un bosquejo actualizado del producto final sobre "{tema}" incorporando el vocabulario y las estructuras aprendidas en la sesión. Lo comparan con el bosquejo inicial del Portafolio para observar su avance.`,
      `Guardan el bosquejo actualizado en el **Portafolio**. Reflexionan: _¿Qué palabras o expresiones de {tema} puedo usar ya en una conversación real con un anglófono?_`,
      `Reciben retroalimentación positiva del docente y cierran la sesión con motivación. _(Excellent English practice today! Every word you learn brings you closer to fluency!)_`,
    ],
  ],
  // ── Grupo 2 ──────────────────────────────────────────────────────────────────
  [
    [
      `Presentan su producción escrita final o avanzada sobre "{tema}" ante el grupo o en parejas. Leen en voz alta con atención a la pronunciación, la entonación y la fluidez en inglés.`,
      `Autoevalúan su producción de "{tema}" usando la rúbrica de la unidad: vocabulario apropiado, estructuras gramaticales correctas, organización del texto y expresividad comunicativa. Identifican su próximo paso de mejora.`,
      `Guardan la autoevaluación y la producción como **Entrada Final del Portafolio**. Reflexionan: _¿Qué estructura gramatical de {tema} domino mejor ahora? ¿Qué evidencia tengo de mi progreso desde la Entrada 0?_`,
      `Reciben retroalimentación final del docente. El grupo celebra el avance comunicativo logrado durante la unidad. _(Amazing progress! You should be proud — look how much English you can use now about {tema}!)_`,
    ],
    [
      `Comparten su producción final de "{tema}" en pequeños grupos. Cada compañero da retroalimentación escrita usando la rúbrica: una fortaleza y una sugerencia de mejora. Incorporan las sugerencias a su versión final.`,
      `Reflexionan sobre su trayectoria de aprendizaje: comparan la Entrada 0 del Portafolio con su producción final de "{tema}". Identifican evidencias concretas de su progreso en vocabulario, gramática y producción comunicativa.`,
      `Guardan la versión final con la reflexión de cierre como **Entrada Final del Portafolio**. Organizan en sus cuadernos el vocabulario y las estructuras más importantes de "{tema}" para uso futuro.`,
      `Reflexionan sobre la utilidad del inglés: _¿En qué situaciones reales de mi vida puedo usar lo que aprendí sobre {tema}? ¿Dónde tengo oportunidades de practicar inglés en la República Dominicana?_`,
    ],
  ],
];

// ─── FRANCÉS ──────────────────────────────────────────────────────────────────

const FR_INICIO = [
  // ── Grupo 0: Orientación al producto y diagnóstico de vocabulario ─────────────
  [
    [
      `Observan ejemplos del producto final de la unidad relacionados con "{tema}" (affiches, brochures, dialogues enregistrés, infographies). Analizan la rúbrica de evaluación: criterios de calidad, descriptores y aspectos que deberán desarrollar durante la unidad.`,
      `Observan imágenes relacionadas con "{tema}" e identifican vocabulario clave en francés. Escuchan y practican la pronunciación guiada de verbos de acción y expresiones de uso frecuente _(écoutez et répétez: se réveiller, prendre le petit déjeuner, aller à l'école / le matin, à midi, le soir)_.`,
      `Organizan el vocabulario de "{tema}" por categorías en sus cuadernos: verbes d'action, expressions de temps, adjectifs descriptifs, phrases utiles pour communiquer.`,
      `Guardan la producción escrita como **Entrée 0 du Portfolio**. Elaboran un bosquejo inicial del producto final: qué incluirán, cómo lo organizarán y qué vocabulario en francés usarán.`,
    ],
    [
      `Observan producciones auténticas en francés sobre "{tema}" (articles, publications, vidéos courtes). Identifican vocabulario conocido y nuevo; lo comparten con el grupo: _Quels mots connaissez-vous déjà en français sur ce sujet?_`,
      `Escuchan una chanson o audio breve en francés relacionado con "{tema}". Identifican palabras clave y las comparten oralmente. Practican la pronunciación de las expresiones identificadas _(aller à l'école, faire ses devoirs, dîner en famille, se coucher tôt)_.`,
      `Organizan en sus cuadernos las palabras y expresiones de "{tema}" por categorías propias elegidas por ellos. Comparten su organización con un compañero y explican por qué agruparon así.`,
      `Guardan el vocabulario organizado como **Entrée 0 du Portfolio**. Elaboran un bosquejo inicial de cómo imaginan su producto final sobre "{tema}" en francés.`,
    ],
  ],
  // ── Grupo 1: Construcción lingüística y activación del conocimiento previo ────
  [
    [
      `Observan el producto de la sesión anterior sobre "{tema}" y revisan la rúbrica de evaluación. Identifican qué criterios ya cumplen y cuáles deben seguir desarrollando durante la unidad.`,
      `Observan una vidéo courte auténtica en francés sobre "{tema}". Identifican vocabulario conocido, expresiones nuevas y estructuras gramaticales usadas por los hablantes _(Je me lève à..., D'habitude je..., D'abord je..., Ensuite je...)_.`,
      `Organizan en sus cuadernos el vocabulario nuevo de "{tema}" por categorías: mots déjà connus, mots nouveaux à apprendre, expressions à pratiquer davantage.`,
      `Guardan el vocabulario organizado como **Entrée 1 du Portfolio**. Elaboran una primera versión escrita del producto con el vocabulario disponible hasta el momento.`,
    ],
    [
      `Observan imágenes y ejemplos de textos en francés sobre "{tema}" y responden preguntas de activación: _Qu'est-ce que vous voyez? Quels mots français pouvez-vous utiliser pour décrire ça? Avez-vous déjà vécu quelque chose de similaire?_`,
      `Escuchan un diálogo o conversación auténtica en francés sobre "{tema}" (2 escuchas). Primera: ¿de qué se habla? Segunda: ¿qué vocabulario y estructuras usan? _(Est-ce que tu... d'habitude? Oui, je toujours... / Non, je ne... jamais.)_`,
      `Identifican y organizan en sus cuadernos las estrategias comunicativas del audio: cómo piden información, cómo describen, cómo expresan frecuencia o rutina sobre "{tema}" en francés.`,
      `Elaboran en parejas una producción oral o escrita inicial sobre "{tema}" usando las estrategias y vocabulario identificados. La guardan en el Portfolio como evidencia del punto de partida.`,
    ],
  ],
  // ── Grupo 2: Revisión y orientación hacia la producción final ─────────────────
  [
    [
      `Observan su producción anterior de "{tema}" guardada en el Portfolio. La comparan con ejemplos de alta calidad usando la rúbrica de evaluación: _Qu'est-ce que j'ai amélioré? Qu'est-ce qu'il me reste à développer?_`,
      `Identifican brechas de vocabulario en su producción de "{tema}": palabras que necesitan, estructuras que no dominan aún. Escuchan y practican las expresiones que les faltan _(Je voudrais..., À mon avis..., Par exemple..., En résumé...)_.`,
      `Organizan en sus cuadernos una liste de révision personal para mejorar su producción de "{tema}": vocabulaire manquant, structures à pratiquer, critères de la rubrique à renforcer.`,
      `Guardan la liste de révision como **Entrée du Portfolio**. Elaboran el borrador mejorado del producto final incorporando los ajustes identificados.`,
    ],
    [
      `Observan producciones de compañeros sobre "{tema}" (con su permiso) y las comparan con la rúbrica de evaluación. Identifican fortalezas y aspectos de mejora de manera respetuosa: _Qu'est-ce qui est bien dans cette production? Qu'est-ce qu'on pourrait améliorer?_`,
      `Escuchan y practican en parejas el vocabulario y las estructuras que más les cuesta usar en francés sobre "{tema}". El docente rota por los grupos corrigiendo la pronunciación del francés _(attention à la liaison, au genre des mots, aux sons nasaux)_.`,
      `Identifican y organizan en sus cuadernos las correcciones más importantes recibidas sobre "{tema}": prononciation, grammaire, choix de vocabulaire, organisation du texte.`,
      `Guardan las correcciones en el Portfolio. Elaboran el borrador final del producto sobre "{tema}" incorporando todas las mejoras identificadas durante la révision entre pares.`,
    ],
  ],
];

const FR_DESARROLLO = [
  // ── Grupo 0: Écoute + Expression orale ────────────────────────────────────────
  [
    [
      `Escuchan un audio o diálogo en francés sobre "{tema}" (3 escuchas progresivas). Primera: identifican el tema general. Segunda: anotan palabras y expresiones clave. Tercera: responden preguntas de detalle _(Qui parle? Où? Qu'est-ce qu'ils font? Quand?)_.`,
      `Analizan las estructuras gramaticales del audio de "{tema}": tiempo verbal, lugar de los adjetivos, uso de adverbios de frecuencia _(toujours, souvent, parfois, jamais)_ y conectores _(d'abord, ensuite, puis, enfin)_.`,
      `Practican en parejas la pronunciación del vocabulario de "{tema}": el docente corrige la liaison, el género gramatical y los sonidos nasales del francés _(attention à la liaison: les enfants → lezenfants; les sons: un/une, en/an, on)_.`,
      `Realizan un échange oral en parejas usando el vocabulario y las estructuras del audio sobre "{tema}". _(Demandez à votre camarade: Qu'est-ce que tu fais d'habitude le matin? Répondez avec des détails. Ensuite, changez de rôle — 3 minutes!)_`,
    ],
    [
      `Observan una vidéo courte auténtica en francés sobre "{tema}". Identifican vocabulario, expresiones y estructuras en uso real. Anotan en sus cuadernos lo que escuchan y comprenden.`,
      `Analizan con el docente el vocabulario y las estructuras de la vidéo sobre "{tema}": mots clés, cognats utiles _(routine → routine, activité → activité, famille → famille)_ y expressions communicatives frecuentes en francés.`,
      `Practican las estructuras de "{tema}" mediante ejercicios de sustitución controlada: el docente da el modelo y los estudiantes lo adaptan a su propia realidad dominicana _(Je me réveille à... / Elle va à l'école à... / Ils mangent généralement...)_.`,
      `Elaboran un jeu de rôle o diálogo guiado sobre "{tema}" usando las estructuras de la vidéo como modelo. Lo presentan en parejas. _(Changez de rôle et recommencez — cette fois sans regarder vos notes!)_`,
    ],
  ],
  // ── Grupo 1: Lecture + Construction du vocabulaire ────────────────────────────
  [
    [
      `Leen un texto auténtico en francés sobre "{tema}" (article, blog, description personnelle) e identifican: idée principale, vocabulaire nouveau, structures grammaticales en uso y conectores del discurso _(premièrement, de plus, en revanche, finalement)_.`,
      `Analizan el vocabulario nuevo de "{tema}": pronunciación guiada, significado inferido desde el contexto, uso en oraciones propias. Elaboran un glosario visual en sus cuadernos: **mot en français → image ou définition en français → phrase originale**.`,
      `Completan ejercicios de vocabulario contextualizados sobre "{tema}": completar frases con la palabra correcta, emparejar expresiones con imágenes, ordenar palabras para formar oraciones en francés coherentes.`,
      `Leen párrafos sobre "{tema}" en voz alta en parejas. Practican la entonación, el ritmo y la pronunciación correcta del francés. El docente rota corrigiendo y modelando la lecture expressive.`,
    ],
    [
      `Leen textos de diferente complejidad sobre "{tema}" y responden preguntas de comprensión literal _(Qu'est-ce que le texte dit?)_, inferencial _(Qu'est-ce qu'on peut conclure?)_ e interpretativa _(Comment cela se connecte-t-il à votre vie?)_.`,
      `Identifican patrones gramaticales en los textos de "{tema}": temps verbaux, accord du genre et du nombre, place des adjectifs, prépositions de lieu et de temps. Los analizan en contexto real _(Regardez cette phrase — quelle règle grammaticale utilise-t-on? Trouvez trois autres exemples dans le texte.)_.`,
      `Elaboran en sus cuadernos un glosario visual ampliado de "{tema}" por categorías: **verbes d'action | expressions de temps | adjectifs qualificatifs | phrases pour communiquer**. Ilustran o ejemplifican cada entrada.`,
      `Practican la lecture expressive de textos de "{tema}" en voz alta. Presentan ante un compañero o graban su lectura. Reciben retroalimentación sobre pronunciación, entonación y compréhension du texte.`,
    ],
  ],
  // ── Grupo 2: Production écrite + Grammaire en contexte ───────────────────────
  [
    [
      `Observan y analizan una producción escrita modelo sobre "{tema}": identifican la structure du texte, el vocabulario seleccionado, los connecteurs utilisés _(d'abord, cependant, par conséquent, en conclusion)_ y el registro lingüístico apropiado para la audiencia.`,
      `Practican la estructura gramatical de "{tema}" en ejercicios contextualizados: transforman oraciones, completan textos con la forma verbal correcta y producen oraciones propias sobre su realidad _(Écrivez votre propre phrase avec cette structure — rendez-la vraie pour votre vie quotidienne!)_.`,
      `Redactan una producción escrita individual sobre "{tema}" (description, narration, dialogue ou paragraphe argumentatif) usando el vocabulario y las estructuras trabajadas. Se apoyan en el modelo analizado al inicio de la actividad.`,
      `Intercambian producciones con un compañero para révision par les pairs: verifican vocabulario, estructuras gramaticales, ortografía y coherencia. Dan retroalimentación por escrito y la incorporan a su propia producción.`,
    ],
    [
      `Observan textos auténticos en francés relacionados con "{tema}": articles de presse, messages, affiches, publications en réseaux sociaux. Identifican cómo el francés real difiere del francés académico y qué vocabulario es más útil en contextos cotidianos.`,
      `Comparan el francés con el español en el contexto de "{tema}": identifican cognats utiles _(routine → rutina, activité → actividad, famille → familia)_, faux amis y diferencias en el orden de palabras, el género gramatical y la pronunciación.`,
      `Producen un texto escrito más elaborado sobre "{tema}": description personnelle, narration de routines, argumentation ou conversation étendue usando las estructuras del nivel y el vocabulario acumulado en el Portfolio.`,
      `Comparten su producción ante el grupo o en parejas. Reciben retroalimentación del docente y sus compañeros sobre précision grammaticale, choix de vocabulaire, organisation du texte y expresividad comunicativa en francés.`,
    ],
  ],
];

const FR_CIERRE = [
  // ── Grupo 0 ──────────────────────────────────────────────────────────────────
  [
    [
      `Elaboran tres a cinco oraciones sencillas en francés sobre "{tema}" usando el vocabulario trabajado durante la sesión. Las leen en voz alta al grupo o en parejas. _(Utilisez les mots d'aujourd'hui: se réveiller, prendre le petit déjeuner, aller à l'école, le matin, le soir...)_`,
      `Guardan la producción escrita como **Entrée du Portfolio**. Reflexionan brevemente: _Qu'est-ce que j'ai appris aujourd'hui sur {tema}? Qu'est-ce qui était difficile? Qu'est-ce que je veux continuer à pratiquer?_`,
      `Organizan en sus cuadernos el vocabulario nuevo de "{tema}" aprendido en la sesión: agregan palabras a sus categorías existentes y completan su glosario visual personal con el vocabulario en francés.`,
      `Reciben orientación sobre la tarea de práctica en casa relacionada con "{tema}". El docente conecta el contenido del día con la próxima sesión y motiva: _(Très bien! Continuez à pratiquer le français — chaque mot appris est un pas vers la maîtrise!)_`,
    ],
    [
      `Completan un ticket de salida en francés sobre "{tema}": _(Aujourd'hui j'ai appris... J'ai pratiqué... J'ai eu du mal à... La prochaine fois je veux...)_. Lo guardan en el Portfolio como evidencia de reflexión metacognitiva.`,
      `Resumen oralmente el contenido de "{tema}": tres voluntarios comparten una oración o expresión aprendida durante la sesión y la usan en un ejemplo de su vida cotidiana dominicana.`,
      `Organizan en sus cuadernos el vocabulario de "{tema}": revisan las categorías del día y agregan cualquier mot nouveau que identificaron durante la sesión.`,
      `Reciben retroalimentación final del docente sobre su desempeño en las actividades de compréhension orale y expression orale de "{tema}". _(Vous progressez! Continuez à pratiquer le français tous les jours!)_`,
    ],
  ],
  // ── Grupo 1 ──────────────────────────────────────────────────────────────────
  [
    [
      `Construyen colectivamente en la pizarra un **mur de vocabulaire** de "{tema}": el docente escribe las palabras que los estudiantes van aportando. Lo fotografían o copian en sus cuadernos para usarlo como referencia en futuras sesiones.`,
      `Elaboran de tres a cinco oraciones sobre "{tema}" usando el vocabulario del mur de vocabulaire. Las leen en voz alta con atención a la pronunciación, la liaison y la entonación del francés. Reciben retroalimentación del docente.`,
      `Guardan las oraciones como **Entrée du Portfolio**. Reflexionan: _¿Qué estrategia me ayudó más a entender el francés sobre {tema}? ¿Cómo puedo seguir practicando fuera del aula?_`,
      `Reciben orientación sobre la tarea de práctica en casa de "{tema}" y la conectan con el aprendizaje del día y el producto final de la unidad.`,
    ],
    [
      `Realizan una synthèse orale en parejas sobre "{tema}": uno hace preguntas y el otro responde usando el vocabulario y estructuras de la sesión. _(Pose des questions à ton/ta camarade: Tu fais quoi d'habitude le matin? À quelle heure? Ensuite changez de rôle — 2 minutes chacun.)_`,
      `Elaboran un brouillon actualizado del producto final sobre "{tema}" incorporando el vocabulario y las estructuras aprendidas en la sesión. Lo comparan con el bosquejo inicial del Portfolio para observar su avance.`,
      `Guardan el brouillon actualizado en el **Portfolio**. Reflexionan: _¿Qué palabras o expresiones de {tema} en francés puedo usar ya en una conversación real con un francófono?_`,
      `Reciben retroalimentación positiva del docente y cierran la sesión con motivación. _(Excellent travail! Chaque session vous rapproche de la maîtrise du français. À bientôt!)_`,
    ],
  ],
  // ── Grupo 2 ──────────────────────────────────────────────────────────────────
  [
    [
      `Presentan su producción escrita final o avanzada sobre "{tema}" ante el grupo o en parejas. Leen en voz alta con atención a la pronunciación, la entonación y la fluidez en francés.`,
      `Autoevalúan su producción de "{tema}" usando la rúbrica de la unidad: vocabulaire approprié, structures grammaticales correctes, organisation du texte y expresividad comunicativa. Identifican su próximo paso de mejora.`,
      `Guardan la autoevaluación y la producción como **Entrée Finale du Portfolio**. Reflexionan: _¿Qué estructura gramatical de {tema} domino mejor ahora? ¿Qué evidencia tengo de mi progreso desde la Entrée 0?_`,
      `Reciben retroalimentación final del docente. El grupo celebra el avance comunicativo logrado durante la unidad. _(Magnifique! Regardez tout ce que vous pouvez dire en français maintenant sur {tema}! Vous devez être fiers de vous!)_`,
    ],
    [
      `Comparten su producción final de "{tema}" en pequeños grupos. Cada compañero da retroalimentación escrita usando la rúbrica: une force y une suggestion d'amélioration. Incorporan las sugerencias a su versión final.`,
      `Reflexionan sobre su trayectoria de aprendizaje: comparan la Entrée 0 del Portfolio con su producción final de "{tema}". Identifican evidencias concretas de su progreso en vocabulario, gramática y producción comunicativa en francés.`,
      `Guardan la versión final con la reflexión de cierre como **Entrée Finale du Portfolio**. Organizan en sus cuadernos el vocabulario y las estructuras más importantes de "{tema}" para uso futuro en el francés.`,
      `Reflexionan sobre la utilidad del francés: _¿En qué situaciones reales de mi vida puedo usar lo que aprendí sobre {tema} en francés? ¿Dónde tengo oportunidades de practicar el idioma en la República Dominicana y el mundo?_`,
    ],
  ],
];

// ─── Exportaciones ────────────────────────────────────────────────────────────

export const BANCOS_ESPECIALIZADOS = {
  "Ciencias Sociales":                     { Inicio: CS_INICIO,   Desarrollo: CS_DESARROLLO,   Cierre: CS_CIERRE   },
  "Ciencias de la Naturaleza":             { Inicio: CN_INICIO,   Desarrollo: CN_DESARROLLO,   Cierre: CN_CIERRE   },
  "Educación Física":                      { Inicio: EF_INICIO,   Desarrollo: EF_DESARROLLO,   Cierre: EF_CIERRE   },
  "Educación Artística":                   { Inicio: EA_INICIO,   Desarrollo: EA_DESARROLLO,   Cierre: EA_CIERRE   },
  "Formación Integral Humana y Religiosa": { Inicio: FIHR_INICIO, Desarrollo: FIHR_DESARROLLO, Cierre: FIHR_CIERRE },
  "Inglés":                                { Inicio: EN_INICIO,   Desarrollo: EN_DESARROLLO,   Cierre: EN_CIERRE   },
  "Francés":                               { Inicio: FR_INICIO,   Desarrollo: FR_DESARROLLO,   Cierre: FR_CIERRE   },
};

/**
 * Selecciona actividades del banco según área, momento, fase y día.
 *
 * faseIdx (0-2) → selecciona el GRUPO de la fase (garantiza progresión entre fases)
 * diaNum        → selecciona la SUB-VARIANTE dentro del grupo (variación entre clases)
 *
 * Así, todas las clases de la misma fase usan el mismo TIPO de actividades
 * (diagnóstico / construcción / aplicación), pero con contenido diferente cada día.
 */
export const obtenerActividadesBanco = (area, momento, faseIdx, diaNum) => {
  const banco = BANCOS_ESPECIALIZADOS[area];
  if (!banco) return null;
  const grupos = banco[momento];
  if (!grupos || grupos.length === 0) return null;

  // Primario: faseIdx determina el grupo pedagógico (0=diagnóstico, 1=construcción, 2=aplicación)
  const groupIdx = Math.min(faseIdx, grupos.length - 1);
  const subVariantes = grupos[groupIdx];
  if (!subVariantes || subVariantes.length === 0) return null;

  // Secundario: diaNum selecciona la sub-variante dentro del grupo
  return subVariantes[diaNum % subVariantes.length];
};

/**
 * Reemplaza el placeholder {tema} con el tema real en los textos del banco.
 */
export const withTema = (actividades, tema) =>
  actividades.map((a) => a.replace(/\{tema\}/g, tema));
