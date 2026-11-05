/**
 * tareasPorTipoTrabajo — Tareas que el mapa de clases reparte por tipo de sección
 * (Etapa 1 del esqueleto «mapa de clases», lista aprobada por César el 2026-11-04).
 *
 * Esto NO es texto oficial: es banco pedagógico de DocenteOS. Tipos, minutos y
 * reglas de reparto son criterio propio. Se apoya en:
 * - modelo antes de producir: Referente por proyecto 2022, p. 27;
 * - comentar y mejorar antes de la entrega final: Referente 2022, p. 27; Guía 2025, p. 27;
 * - reflexión individual al cerrar: Adecuación 2023, p. 26;
 * - producto único con entregas parciales y sin actividades de más: Referente 2022, pp. 30-31;
 * - tipos de evidencia y condiciones: Guía 2025, pp. 26 y 29.
 *
 * `minutos` = [mínimo, normal] del Desarrollo. El normal reproduce la unidad de
 * referencia (Alimentación, 6 semanas); el mínimo es una estimación sin medir.
 * `demuestra`: C comprender · P producir · I interactuar · null = apoyo sin indicador propio.
 * `faseInsercion` = tipo de fase en Inserción; `rol` = papel de fase en las demás
 * estrategias; `etapa` agrupa en la versión breve (C recoger · P producir · M mejorar).
 *
 * Módulo PURO. Lo consume mapaClasesService.js. Todavía no llega al prompt ni a los anexos.
 */

const tarea = (clave, nombre, minutos, demuestra, evidencia, condicion, organizacion, entrega, faseInsercion, rol, etapa, didacticos, extra = {}) => ({
  clave, nombre, minutos, demuestra, evidencia, condicion, organizacion, entrega,
  faseInsercion, rol, etapa, recursos: { humanos: "Docente y estudiantes", didacticos, tecnologicos: "No requerido" },
  ...extra,
});

// «orientar» se añade aquí y no en TIPOS_TRABAJO: esa lista alimenta la generación
// actual y cambiarla queda para la etapa que conecte el mapa.
export const TAREAS_POR_TIPO = {
  visitar: [
    tarea("visitar_modelo", "identificar preguntas con un modelo", [15, 30], "C", "conocimiento", "escrita", "parejas", "Lista de datos por recoger", "preparar_instrumentos", "conocimiento", "C", "Entrevista modelo impresa"),
    tarea("visitar_guion", "escribir el guion", [15, 30], "P", "producto", "escrita", "grupos, una pregunta firmada por estudiante", "Guion de entrevista y orden de turnos", "preparar_instrumentos", "conocimiento", "C", "Lista de datos, tiras de papel", { individual: true }),
    tarea("visitar_entrevistar", "entrevistar", [15, 30], "I", "desempeno", "oral", "grupos por turnos, una pregunta por estudiante", "Tabla común con respuestas y datos", "visitar", "conocimiento", "C", "Guion, tabla común en cartulina", { usaModalidad: true, recogeDatos: true }),
    tarea("visitar_registrar", "registrar por escrito", [10, 30], "P", "producto", "escrita", "grupos", "Registro escrito de la entrevista", "describir", "modelado", "P", "Tabla común, cuaderno"),
    tarea("visitar_segunda", "segunda entrevista", [20, 20], "I", "desempeno", "oral", "grupos", "Datos que faltaban en la tabla común", "visitar", "conocimiento", "C", "Tabla común", { ampliacion: true, usaModalidad: true }),
  ],
  describir: [
    tarea("describir_modelo", "analizar un modelo", [4, 8], null, "conocimiento", "escrita", "parejas", "Frase modelo anotada", "describir", "conocimiento", "C", "Pieza modelo"),
    tarea("describir_redactar", "redactar y firmar la pieza", [11, 22], "P", "producto", "escrita", "individual dentro del grupo", "Pieza redactada (borrador)", "describir", "modelado", "P", "Datos de la tabla, papel, colores", { individual: true }),
  ],
  analizar: [
    tarea("analizar_ordenar", "ordenar datos con un modelo", [15, 30], "C", "conocimiento", "escrita", "grupos", "Datos ordenados", "analizar", "conocimiento", "C", "Pieza modelo, tabla común"),
    tarea("analizar_borrador", "redactar el borrador y comprobar sus datos", [15, 30], "P", "producto", "escrita", "grupos, una entrada firmada por estudiante", "Borrador con datos de fuente", "analizar", "modelado", "P", "Datos ordenados, diccionario, papel", { individual: true }),
    tarea("analizar_verificar", "verificar con otra fuente", [15, 15], "C", "conocimiento", "escrita", "parejas", "Datos verificados", "analizar", "modelado", "P", "Borrador, fuente adicional", { ampliacion: true }),
  ],
  proponer: [
    tarea("proponer_comparar", "comparar con un texto", [15, 30], "C", "conocimiento", "escrita", "parejas", "Tabla de comparación", "analizar", "conocimiento", "C", "Texto impreso"),
    tarea("proponer_elegir", "elegir y justificar", [7, 14], "I", "desempeno", "oral", "grupos, cada estudiante propone", "Elección justificada", "proponer", "modelado", "P", "Tabla de comparación"),
    tarea("proponer_elaborar", "elaborar la pieza", [8, 16], "P", "producto", "escrita", "grupos", "Pieza propuesta (borrador)", "proponer", "modelado", "P", "Tarjetas, papel"),
  ],
  aplicar: [
    tarea("aplicar_modelo", "analizar un modelo", [6, 12], "C", "conocimiento", "oral", "parejas", "Frases identificadas", "aplicar", "conocimiento", "C", "Modelo impreso"),
    tarea("aplicar_escribir", "escribir", [9, 18], "P", "producto", "escrita", "parejas", "Pieza escrita (borrador)", "aplicar", "modelado", "P", "Piezas anteriores, papel"),
    tarea("aplicar_ensayar", "ensayar", [10, 20], "I", "desempeno", "oral", "parejas que rotan", "Ensayo observado", "aplicar", "aplicacion", "M", "Pieza escrita"),
    tarea("aplicar_anotar", "anotar la mejora", [5, 10], "I", "desempeno", "escrita", "parejas", "Observaciones del ensayo", "aplicar", "aplicacion", "M", "Pieza escrita"),
    tarea("aplicar_segundo", "segundo ensayo", [15, 15], "I", "desempeno", "oral", "parejas que rotan", "Segundo ensayo observado", "aplicar", "aplicacion", "M", "Pieza escrita", { ampliacion: true }),
    tarea("aplicar_corregir", "corregir", [6, 12], "P", "producto", "escrita", "parejas", "Versión final de la sección", "aplicar", "aplicacion", "M", "Pieza escrita, observaciones", { cierraSeccion: true }),
  ],
  // ⚠ socializar y orientar: la unidad de referencia no los usa; sin probar en un plan completo.
  socializar: [
    tarea("socializar_reunir", "reunir lo hecho", [5, 15], "C", "conocimiento", "escrita", "grupos", "Ideas reunidas", "socializar", "conocimiento", "C", "Piezas anteriores"),
    tarea("socializar_redactar", "redactar el mensaje", [15, 25], "P", "producto", "escrita", "grupos", "Mensaje (borrador)", "socializar", "modelado", "P", "Ideas reunidas, papel"),
    tarea("socializar_leer", "leerlo a otro grupo", [10, 20], "I", "desempeno", "oral", "dos grupos en intercambio", "Comentarios del otro grupo", "socializar", "aplicacion", "M", "Mensaje"),
  ],
  orientar: [
    tarea("orientar_recorrido", "recorrido o mapa", [10, 20], "C", "conocimiento", "escrita", "grupos", "Recorrido o mapa", "analizar", "conocimiento", "C", "Plano, papel"),
    tarea("orientar_instrucciones", "instrucciones", [15, 30], "P", "producto", "escrita", "grupos", "Instrucciones (borrador)", "analizar", "modelado", "P", "Recorrido o mapa"),
    tarea("orientar_probar", "prueba con un compañero", [10, 15], "I", "desempeno", "oral", "parejas", "Observaciones de la prueba", "analizar", "aplicacion", "M", "Instrucciones"),
  ],
};

// Reunidas: comentar por estaciones y corregir abarcan varias secciones a la vez.
export const SECCIONES_POR_COMENTAR = 3;
export const SECCIONES_POR_CORREGIR = 3;
export const TAREA_COMENTAR = tarea("comentar", "comentar por estaciones", [15, 30], "I", "desempeno", "oral", "estaciones por grupo", "Comentarios por sección", "socializar", "aplicacion", "M", "Piezas de las secciones, ficha de comentarios");
export const TAREA_CORREGIR = tarea("corregir", "corregir, probar y verificar datos", [15, 30], "P", "producto", "escrita", "grupo editor de cada sección", "Versión final de las secciones", null, "aplicacion", "M", "Piezas, comentarios, tabla común", { cierraSeccion: true });

// Una vez en la unidad, en este orden.
export const TAREAS_UNIDAD = {
  acordar: tarea("acordar", "acordar el plan y hacer el diagnóstico", [30, 30], "C", "conocimiento", "oral y escrita", "plenaria y grupos", "Acuerdo y plan; grupos editores; diagnóstico", "recoger", "apertura", "C", "Pieza modelo, hoja de diagnóstico, cartel"),
  glosario: tarea("glosario", "glosario", [15, 15], "P", "producto", "escrita", "grupos", "Glosario de la guía", "aplicar", "aplicacion", "M", "Piezas de las secciones", { ampliacion: true }),
  integrar: tarea("integrar", "reunir las secciones y revisar el conjunto", [9, 18], "P", "producto", "escrita", "grupos editores", "Producto completo", "aplicar", "aplicacion", "M", "Todas las secciones"),
  presentar: tarea("presentar", "presentar a la audiencia", [15, 30], ["P", "I"], "desempeno", "oral", "grupos editores ante la audiencia", "Presentación y comentarios de la audiencia", "aplicar", "socializacion", "M", "Producto completo, tarjetas de comentarios", { llegaAudiencia: true, sumativa: true }),
  // Cuando el producto se prueba con la audiencia (p. ej. pedidos con un menú), presentar y
  // probar son dos tareas con sus minutos: pedirlo dentro de una sola no siempre se cumplía.
  presentarSecciones: tarea("presentar", "presentar a la audiencia", [8, 15], "P", "desempeno", "oral", "grupos editores ante la audiencia", "Presentación a la audiencia", "aplicar", "socializacion", "M", "Producto completo", { llegaAudiencia: true, sumativa: true, hace: "Presentan TODAS las secciones del producto a la audiencia, nombrándola. Aquí no se corrige y no hay comentarios previos." }),
  probarConAudiencia: tarea("probar_audiencia", "probar el producto con la audiencia", [7, 15], "I", "desempeno", "oral", "parejas o grupos con la audiencia", "Prueba con la audiencia y comentarios en tarjetas", "aplicar", "socializacion", "M", "Producto completo, tarjetas de comentarios", { sumativa: true }),
  audienciaSecundaria: tarea("audiencia_secundaria", "audiencia secundaria", [15, 15], "I", "desempeno", "oral", "parejas", "Comentarios de la audiencia secundaria", "aplicar", "socializacion", "M", "Producto completo", { ampliacion: true }),
  evaluarProceso: tarea("evaluar_proceso", "autoevaluación, coevaluación y reflexión individual", [8, 15], null, "desempeno", "escrita", "parejas e individual", "Autoevaluación, coevaluación y reflexión individual", "evaluar", "evaluacion", "M", "Fichas de autoevaluación y coevaluación", { individual: true }),
  evaluarComentarios: tarea("evaluar_comentarios", "comprender los comentarios y corregir", [9, 15], "C", "conocimiento", "escrita", "individual y grupos editores", "Respuestas firmadas y versión revisada", "evaluar", "evaluacion", "M", "Tarjetas de comentarios, producto", { individual: true, sumativa: true }),
};

// Sección cuyo tipo aprobado aún no está en la semilla: cambiarla en la semilla
// alteraría la generación actual, así que el mapa lo resuelve por su cuenta.
export const TIPO_APROBADO_POR_SECCION = { "School Directions": "orientar" };

// Qué hace cada tarea y qué no, para que la clase no invada a otra, y una señal para
// avisar al administrador si la redacción se aleja (primera prueba real, 2026-11-04).
export const DETALLE_TAREA = {
  acordar: { hace: "Presentan la situación, acuerdan producto, audiencia, grupos y rúbrica, y aplican el diagnóstico: escuchan oraciones y marcan imágenes, leen un menú o texto breve, escriben dos oraciones y responden una pregunta en parejas. No se redactan preguntas ni piezas.", senal: "acuerd|diagn|plan" },
  visitar_modelo: { hace: "Escuchan o leen una entrevista modelo e identifican qué pregunta da cada dato. Aún no escriben el guion ni entrevistan.", senal: "identific|modelo", soloComprender: true },
  visitar_guion: { hace: "Escriben el guion con una pregunta firmada por cada estudiante y fijan los turnos. No entrevistan todavía.", senal: "guion|pregunta", firma: "Cada estudiante firma su pregunta." },
  visitar_entrevistar: { hace: "Entrevistan según la modalidad, por turnos, con una pregunta por estudiante; todos anotan en la tabla común y al final comprueban que no falte ningún dato.", senal: "entrevist" },
  visitar_registrar: { hace: "Redactan desde las notas de la tabla un registro de la entrevista. Se llama registro, no transcripción: nadie grabó.", senal: "regist|redact" },
  visitar_segunda: { hace: "Hacen una segunda ronda de preguntas solo sobre los datos que faltan en la tabla.", senal: "entrevist|pregunt" },
  describir_modelo: { hace: "Analizan una pieza modelo y anotan cómo se hace. Es apoyo breve.", senal: "analiz|observ|identific|modelo" },
  describir_redactar: { hace: "Cada estudiante redacta y firma su pieza con los datos recibidos.", senal: "redact|escrib|elabor", firma: "Cada estudiante firma su pieza." },
  analizar_ordenar: { hace: "Ordenan los datos recibidos y analizan un modelo para decidir el formato. Aún no redactan la pieza.", senal: "orden|clasific|organiz", soloComprender: true },
  analizar_borrador: { hace: "Redactan el borrador con los datos ordenados, cada estudiante firma una entrada, y comprueban cada dato contra su fuente.", senal: "borrador|redact|escrib", firma: "Cada estudiante firma su entrada." },
  analizar_verificar: { hace: "Verifican con otra fuente solo los datos dudosos.", senal: "verific|comprob" },
  proponer_comparar: { hace: "Leen un texto breve y comparan en una tabla con lo que ya tienen. Aún no escriben la pieza.", senal: "compar", soloComprender: true },
  proponer_elegir: { hace: "Discuten qué proponer y justifican su elección con la tabla.", senal: "elig|justific|discut|debat|propon" },
  proponer_elaborar: { hace: "Elaboran la pieza con lo elegido, con su razón y su alternativa.", senal: "elabor|redact|escrib" },
  aplicar_modelo: { hace: "Analizan un modelo e identifican sus frases. Es la parte de comprensión de esta tarea.", senal: "modelo|identific|escuch|analiz" },
  aplicar_escribir: { hace: "Escriben la pieza usando lo identificado y las piezas ya hechas.", senal: "escrib|redact" },
  aplicar_ensayar: { hace: "Ensayan con la pieza y el producto reales, en los dos papeles.", senal: "ensay|represent|practic" },
  aplicar_anotar: { hace: "Anotan qué falló y qué cambiar. Aún no corrigen.", senal: "anot|observ|registr|coment" },
  aplicar_segundo: { hace: "Repiten el ensayo probando lo que anotaron.", senal: "ensay|represent|practic" },
  aplicar_corregir: { hace: "Corrigen la pieza con lo anotado en el ensayo y la dejan final.", senal: "corrig|ajust|mejor" },
  socializar_reunir: { hace: "Reúnen lo que ya tienen de las otras secciones.", senal: "reun|revis|seleccion" },
  socializar_redactar: { hace: "Redactan el mensaje con lo reunido.", senal: "redact|escrib" },
  socializar_leer: { hace: "Lo leen a otro grupo y anotan qué no se entendió.", senal: "le[ae]n|compart|present" },
  orientar_recorrido: { hace: "Hacen el recorrido o el mapa con los lugares reales.", senal: "recorr|map|plano" },
  orientar_instrucciones: { hace: "Escriben las instrucciones paso a paso desde el recorrido.", senal: "instruc|escrib|redact" },
  orientar_probar: { hace: "Un compañero sigue las instrucciones y anotan dónde se pierde.", senal: "prueb|sig|compañero" },
  comentar: { hace: "Solo comentan y registran dos fortalezas y una mejora por pieza. La corrección va después.", senal: "coment|recorr|fortalez" },
  corregir: { hace: "El grupo editor corrige con los comentarios, verifica los datos contra su fuente y pasa a limpio.", senal: "corrig|verific|mejor" },
  glosario: { hace: "Reúnen el vocabulario clave de la guía con su traducción.", senal: "glosario|vocabulario" },
  integrar: { hace: "Reúnen todas las secciones en un solo producto y revisan que los datos coincidan. No se reescribe ni se presenta a nadie todavía.", senal: "reun|integr|compil|junt|ensambl|un[ei]n?\\b" },
  presentar: { califica: "la presentación", hace: "Presentan TODAS las secciones del producto a la audiencia y lo ponen a prueba con ella (si es un menú y una guía para pedir, hacen pedidos reales con el menú). Luego recogen sus comentarios en tarjetas. Aquí no se corrige y no hay comentarios previos.", senal: "present" },
  probar_audiencia: { califica: "la prueba con la audiencia", hace: "Ponen a prueba el producto con la audiencia: si es un menú y una guía para pedir, hacen pedidos reales con el menú. Luego recogen sus comentarios en tarjetas.", senal: "pedid|pedir|orden|order|prueb" },
  audiencia_secundaria: { hace: "Prueban el producto con la audiencia secundaria y recogen sus comentarios.", senal: "present|prueb|muestr" },
  evaluar_comentarios: { califica: "las respuestas individuales", formativo: ["la corrección"], hace: "Leen los comentarios de la audiencia, responden por escrito qué piden cambiar y corrigen el producto completo, que queda listo para entregar a la audiencia. Las respuestas son la evidencia de comprensión.", senal: "comentari", firma: "Cada estudiante firma sus respuestas." },
  evaluar_proceso: { formativo: ["la autoevaluación", "la coevaluación", "la reflexión"], hace: "Completan autoevaluación y coevaluación, y cada estudiante escribe su reflexión.", senal: "autoeval|coeval|reflex" },
};

// Inventario de datos (César, 2026-11-04): lo que cada sección necesita y lo que recoge,
// para que ninguna pieza exija un dato sin origen. Banco pedagógico. Las secciones
// fuera de esta lista (temas sin semilla) no se comprueban.
export const INVENTARIO_POR_SECCION = {
  // Alimentación
  "Interviews with Owners": { evidencia: "Registro escrito de la entrevista", recoge: ["platos", "ingredientes", "precios", "horario", "clientes"] },
  "Our Local Food": { evidencia: "Fichas de platos", necesita: ["platos", "ingredientes"] },
  "Bilingual Menus": { evidencia: "Menú bilingüe", necesita: ["platos", "precios"] },
  "Healthy Choices": { evidencia: "Etiquetas «Healthy pick»", necesita: ["platos", "ingredientes"] },
  "Ordering Food": { evidencia: "Guía para pedir", necesita: ["platos", "precios"], pruebaConAudiencia: "pedid|pedir|orden|order|can i have|i ll have|i'll have" },
  // Escuela y educación
  "Important Places": { evidencia: "Fichas de lugares", recoge: ["lugares", "función del lugar", "personas"] },
  "School Directions": { evidencia: "Plano con rutas e indicaciones", necesita: ["lugares"], recoge: ["rutas"] },
  "Asking for Help": { evidencia: "Tarjeta de bolsillo", necesita: ["lugares", "personas"] },
  "School Success Tips": { evidencia: "Póster «Top tips»", necesita: ["lugares"] },
  "Welcome": { evidencia: "Carta de bienvenida", necesita: ["lugares"] },
  "Final Recommendation": { evidencia: "Párrafo de cierre" },
  // Actividades de la vida diaria
  "Our Daily Routines": { evidencia: "Línea de tiempo del día", recoge: ["horario"] },
  "What We Found": { evidencia: "Gráfico de resultados", necesita: ["horario"], recoge: ["horas de sueño", "llegadas tarde"] },
  "Problems and Causes": { evidencia: "Tabla problema → causa", necesita: ["horas de sueño", "llegadas tarde"] },
  "Our Healthy Schedule": { evidencia: "Horario semanal", necesita: ["horario"] },
  "Tips for Families": { evidencia: "Folleto de consejos", necesita: ["horario"] },
};
// Cómo se reconoce cada dato en el texto de la clase (sin tildes).
export const MARCAS_DATO = {
  platos: "plato|dish|menu|sell|serve", ingredientes: "ingredient|made (with|of)|lleva",
  precios: "precio|price|how much|cost", horario: "horario|hour|open|schedule|time|wake|get up",
  clientes: "client|customer", lugares: "lugar|place|library|cafeteria|office",
  "función del lugar": "para que|what .* for|funcion|sirve", personas: "persona|who|quien|teacher|principal",
  rutas: "ruta|turn|left|right|next to|recorrido", "horas de sueño": "sueno|sleep|horas", "llegadas tarde": "tarde|late",
};

// Dónde tiene uso cada contenido de la malla (César, 2026-11-05): la tarea que lo necesita,
// por orden de preferencia. Lista vacía o sin esas tareas en el mapa: queda sin lugar, no
// se fuerza. Banco pedagógico; se reconoce por el texto de la malla, nunca se copia a ella.
// Lo que no aparece aquí sigue el reparto general.
export const USO_DE_CONTENIDOS = [
  [/voz pasiva/, ["describir_redactar", "analizar_borrador"]],
  [/how much|how many/, ["visitar_guion", "aplicar_escribir"]],
  [/presente simple de los verbos be, have, want/, ["visitar_guion", "aplicar_modelo"]],
  [/^will para/, ["aplicar_escribir", "aplicar_ensayar"]],
  [/^funcional: comprar/, ["aplicar_modelo", "aplicar_escribir"]],
  [/^funcional: expresar deseo|want, hope y wish/, ["proponer_elegir", "visitar_guion"]],
  [/^condicional/, ["proponer_elaborar", "proponer_elegir"]],
  [/^funcional: pedir y dar consejos|imperativo para dar consejos|^let.s para|^should para|^why don/, ["proponer_elegir", "proponer_elaborar", "socializar_redactar"]],
  [/^comidas y bebidas/, ["acordar", "describir_redactar"]],
  [/^numeros cardinales/, ["analizar_borrador", "visitar_entrevistar"]],
  [/^numeros ordinales/, ["orientar_instrucciones"]],
  [/^lugares:/, ["orientar_recorrido", "orientar_instrucciones"]],
  [/^formas de interaccion/, ["socializar_redactar"]],
  [/^fechas/, []],
  [/^hora:/, ["visitar_entrevistar", "aplicar_ensayar"]],
  [/^cortesia|^you.re welcome|^captar la atencion|^pedir que repitan|^mostrar interes/, ["visitar_entrevistar", "probar_audiencia", "orientar_probar"]],
  [/^interrumpir|^pedir y dar la palabra|^mostrar acuerdo/, ["comentar", "proponer_elegir"]],
  [/^disculparse/, ["aplicar_ensayar", "probar_audiencia"]],
  [/^dudar/, ["proponer_elegir", "aplicar_ensayar"]],
  [/^mostrar indiferencia/, []],
  [/^deseos/, ["probar_audiencia", "proponer_elegir"]],
];

// Alcance de la semilla cuando la fuente es un solo dueño invitado (ficha de la unidad).
export const ALCANCE_POR_SEMILLA = {
  "ing2-alimentacion-menu": {
    conInvitado: {
      productoDescripcion: "el menú bilingüe y las recomendaciones del comedor participante",
      audiencia: "el dueño del comedor participante y los visitantes",
      audienciaDetalle: {
        principal: "el dueño del comedor participante",
        secundarias: [{ quien: "los visitantes", funcion: "consultan el menú para saber qué piden" }],
      },
      // Lo que la semilla dice para varios comedores o una entrevista que pudiera ser simulada.
      piezasSecciones: {
        "Interviews with Owners": "la entrevista al dueño invitado (preguntas y respuestas anotadas)",
        "Bilingual Menus": "el menú bilingüe del comedor participante (plato, descripción, precio)",
      },
      invitado: "dueño invitado",
      visitante: "otro docente que hace de visitante",
    },
  },
};
