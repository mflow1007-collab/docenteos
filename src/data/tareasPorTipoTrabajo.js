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
export const SECCIONES_POR_CORREGIR = 2;
export const TAREA_COMENTAR = tarea("comentar", "comentar por estaciones", [15, 30], "I", "desempeno", "oral", "estaciones por grupo", "Comentarios por sección", "socializar", "aplicacion", "M", "Piezas de las secciones, ficha de comentarios");
export const TAREA_CORREGIR = tarea("corregir", "corregir, probar y verificar datos", [15, 30], "P", "producto", "escrita", "grupo editor de cada sección", "Versión final de las secciones", null, "aplicacion", "M", "Piezas, comentarios, tabla común", { cierraSeccion: true });

// Una vez en la unidad, en este orden.
export const TAREAS_UNIDAD = {
  acordar: tarea("acordar", "acordar el plan y hacer el diagnóstico", [15, 30], "C", "conocimiento", "oral y escrita", "plenaria y grupos", "Acuerdo y plan; grupos editores; diagnóstico", "recoger", "apertura", "C", "Pieza modelo, hoja de diagnóstico, cartel"),
  glosario: tarea("glosario", "glosario", [15, 15], "P", "producto", "escrita", "grupos", "Glosario de la guía", "aplicar", "aplicacion", "M", "Piezas de las secciones", { ampliacion: true }),
  integrar: tarea("integrar", "reunir las secciones y revisar el conjunto", [9, 18], "P", "producto", "escrita", "grupos editores", "Producto completo", "aplicar", "aplicacion", "M", "Todas las secciones"),
  presentar: tarea("presentar", "presentar a la audiencia", [15, 30], ["P", "I"], "desempeno", "oral", "grupos editores ante la audiencia", "Presentación y comentarios de la audiencia", "aplicar", "socializacion", "M", "Producto completo, tarjetas de comentarios", { llegaAudiencia: true, sumativa: true }),
  audienciaSecundaria: tarea("audiencia_secundaria", "audiencia secundaria", [15, 15], "I", "desempeno", "oral", "parejas", "Comentarios de la audiencia secundaria", "aplicar", "socializacion", "M", "Producto completo", { ampliacion: true }),
  evaluarProceso: tarea("evaluar_proceso", "autoevaluación, coevaluación y reflexión individual", [8, 15], null, "desempeno", "escrita", "parejas e individual", "Autoevaluación, coevaluación y reflexión individual", "evaluar", "evaluacion", "M", "Fichas de autoevaluación y coevaluación", { individual: true }),
  evaluarComentarios: tarea("evaluar_comentarios", "comprender los comentarios y corregir", [9, 15], "C", "conocimiento", "escrita", "individual y grupos editores", "Respuestas firmadas y versión revisada", "evaluar", "evaluacion", "M", "Tarjetas de comentarios, producto", { individual: true, sumativa: true }),
};

// Sección cuyo tipo aprobado aún no está en la semilla: cambiarla en la semilla
// alteraría la generación actual, así que el mapa lo resuelve por su cuenta.
export const TIPO_APROBADO_POR_SECCION = { "School Directions": "orientar" };
