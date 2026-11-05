/**
 * secuenciasTareas — Secuencias humanas de las clases críticas (piloto aprobado por
 * César el 2026-11-05). Banco pedagógico de DocenteOS, no currículo oficial.
 * Fuente: la unidad de Alimentación a mano (v3), generalizada.
 *
 * Clave: las tareas de la fila, en orden. Cada versión son 4 o 5 pasos cortos, con el
 * docente visible; solo el último paso de cada tarea lleva producto y destino.
 * `t` = índice de la tarea de la fila; `m` = minutos de referencia para esa tarea.
 * Huecos: {invitado}, {audiencia}, {producto}, {tema}, {datos} los pone el código;
 * {frases} los pone la IA. `pista` dice qué necesita ese hueco; `usa` reconoce, entre los
 * contenidos de la fila, las expresiones de la malla que le sirven (y se muestran en su lugar).
 *
 * Módulo PURO. Lo consume mapaClasesService.js.
 */
const p = (t, m, texto, pista = "", usa = null) => ({ t, m, texto, pista, usa });

export const SECUENCIAS_POR_TAREAS = {
  acordar: [
    [
      p(0, 5, "Acuerdan (en plenaria) qué hará {producto}, para quién y cómo se evaluará, mientras el docente lo anota en un cartel."),
      p(0, 5, "Forman (en grupos editores) un grupo por sección, y cada estudiante anota de cuál responde: lista de grupos; se guarda en la carpeta del producto."),
      p(0, 7, "Escuchan (individual, dos veces, leídas por el docente) cinco oraciones ({frases}) y marcan en la hoja la imagen que corresponde.", "oraciones sencillas del tema"),
      p(0, 7, "Leen (en parejas) un texto breve sobre {tema} y responden qué dice, mientras el docente circula y observa."),
      p(0, 6, "Escriben (individual) dos oraciones sobre {tema} y responden en voz alta una pregunta a su pareja ({frases}): hoja de diagnóstico; la recoge el docente.", "una pregunta sencilla del tema"),
    ],
    [
      p(0, 6, "Conversan (en plenaria) con el docente sobre lo que hará {producto} y a quién le servirá, y acuerdan cómo se evaluará."),
      p(0, 4, "Eligen (en grupos editores) la sección de cada grupo: lista de grupos en el cartel."),
      p(0, 6, "Escuchan (individual) al docente leer cinco oraciones ({frases}) y marcan la imagen de cada una.", "oraciones sencillas del tema"),
      p(0, 7, "Leen (en parejas) un texto breve sobre {tema} y subrayan lo que entienden, mientras el docente anota quién necesita apoyo."),
      p(0, 7, "Escriben (individual) dos oraciones y luego se hacen una pregunta en parejas ({frases}), y el docente escucha a varias: hoja de diagnóstico; la recoge el docente.", "una pregunta sencilla del tema"),
    ],
  ],
  visitar_entrevistar: [
    [
      p(0, 4, "Repasan (en grupos) su turno y la pregunta que firmó cada estudiante, mientras el docente recuerda cómo pedir la palabra ({frases}).", "pedir la palabra", /captar|interrumpir|cortesia/),
      p(0, 4, "Escuchan (en plenaria) a {invitado} presentarse y anotan en la tabla común lo que ya dice."),
      p(0, 12, "Entrevistan (por turnos, una pregunta por estudiante) a {invitado} sobre {datos} ({frases}), mientras el docente marca la lista de cotejo.", "preguntar por esos datos"),
      p(0, 6, "Preguntan (por turnos) lo que falta y reaccionan a lo que oyen ({frases}), y el docente ayuda a quien se traba.", "reaccionar con cortesía", /you.re welcome|pedir que repitan|interes/),
      p(0, 4, "Comprueban (en grupos, con {invitado}) que no falte ningún dato y piden aclarar lo que no entendieron: tabla común completa; queda en la carpeta de la sección."),
    ],
    [
      p(0, 3, "Reciben (en plenaria) a {invitado} y le explican para qué sirve {producto}."),
      p(0, 5, "Ensayan (en parejas) su pregunta en voz baja, y el docente pasa corrigiendo la pronunciación ({frases}).", "preguntar por los datos del guion"),
      p(0, 13, "Entrevistan (en grupos, por turnos): cada estudiante hace su propia pregunta del guion a {invitado} sobre {datos} ({frases}), y los demás anotan en la tabla común.", "preguntar por esos datos"),
      p(0, 5, "Preguntan (en grupos) lo que quedó sin responder, mientras el docente señala en la tabla los huecos."),
      p(0, 4, "Comprueban (en plenaria) la tabla con {invitado} y le agradecen ({frases}): tabla común completa; queda en la carpeta de la sección.", "agradecer", /cortesia|you.re welcome/),
    ],
  ],
  "presentar+probar_audiencia": [
    [
      p(0, 8, "Presentan (en grupos editores, cada grupo su sección) {producto} ante {audiencia}, mientras el docente observa con la rúbrica."),
      p(0, 7, "Explican (en grupos editores) cómo se usa y responden preguntas de {audiencia} ({frases}): presentación oral observada con la rúbrica.", "explicar para qué sirve"),
      p(1, 9, "Hacen (en parejas, por turnos) pedidos reales con el menú a {audiencia} ({frases}), y el docente marca la lista de cotejo de cada estudiante.", "pedir un plato y aclarar dudas"),
      p(1, 6, "Recogen (en plenaria) en tarjetas lo que {audiencia} cambiaría y lo que le sirvió ({frases}): tarjetas en la carpeta del producto.", "comentar y pedir mejoras", /deseos|hora/),
    ],
    [
      p(0, 9, "Muestran (en grupos editores) una a una todas las secciones de {producto} a {audiencia}, explicando para qué sirve cada una ({frases}).", "explicar para qué sirve"),
      p(0, 6, "Responden (en grupos editores) lo que {audiencia} pregunte, mientras el docente completa la rúbrica: presentación oral observada."),
      p(1, 10, "Usan (en parejas) el menú para hacerle un pedido a {audiencia} y aclarar lo que no entiendan ({frases}), y el docente observa a cada pareja con la lista de cotejo.", "pedir un plato y aclarar dudas"),
      p(1, 5, "Anotan (en plenaria) en tarjetas los comentarios de {audiencia} ({frases}): tarjetas en la carpeta del producto.", "comentar y pedir mejoras", /deseos|hora/),
    ],
  ],
  "evaluar_comentarios+evaluar_proceso": [
    [
      p(0, 4, "Leen (individual) las tarjetas con los comentarios de {audiencia}, mientras el docente aclara las palabras que no entienden."),
      p(0, 5, "Responden (individual) por escrito qué piden cambiar y por qué ({frases}): respuestas firmadas; son la evidencia de comprensión.", "decir qué cambio se pide"),
      p(0, 6, "Corrigen (en grupos editores) en {producto} lo que pidió {audiencia}: versión revisada, lista para entregar."),
      p(1, 8, "Evalúan (en parejas) su proceso con las fichas de autoevaluación y coevaluación: fichas en el portafolio."),
      p(1, 7, "Escriben (individual) su reflexión sobre qué aprendieron y qué harían distinto: reflexión firmada en el portafolio."),
    ],
    [
      p(0, 5, "Leen (en grupos) las tarjetas con los comentarios de {audiencia} y conversan sobre qué piden, mientras el docente pasa por los grupos."),
      p(0, 5, "Escriben (individual, cada quien por su cuenta) qué cambio se pide y por qué ({frases}): respuestas firmadas; son la evidencia de comprensión.", "decir qué cambio se pide"),
      p(0, 5, "Corrigen (en grupos editores) lo que pidió {audiencia}: versión revisada, lista para entregar."),
      p(1, 8, "Completan (en parejas) las fichas de autoevaluación y coevaluación, y el docente recoge las dudas: fichas en el portafolio."),
      p(1, 7, "Reflexionan (individual) por escrito sobre qué cambió en {producto} y qué aprendieron: reflexión firmada en el portafolio."),
    ],
  ],
};
