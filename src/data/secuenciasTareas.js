/**
 * secuenciasTareas — Secuencias humanas por tipo de tarea (César, 2026-11-05).
 * Banco pedagógico de DocenteOS, no currículo oficial. Fuente: la unidad de Alimentación
 * a mano (v3), generalizada.
 *
 * Clave: la tarea (o `probar_audiencia:tipo`). Cada versión son pasos cortos, con el
 * docente visible. Si la clase tiene una sola tarea, salen todos; si comparte clase,
 * solo los esenciales (`e`). Solo el último paso de cada tarea lleva producto y destino.
 * `m` = peso en minutos dentro de la tarea.
 * Huecos: {invitado}, {audiencia}, {producto}, {tema}, {asunto}, {fuente}, {datos}, {entrega} los pone el código;
 * {frases} los pone la IA. `pista` dice qué necesita ese hueco; `usa` reconoce, entre los
 * contenidos de la fila, las expresiones de la malla que le sirven.
 *
 * Módulo PURO. Lo consume mapaClasesService.js.
 */
const p = (m, texto, pista = "", usa = null, e = false) => ({ m, texto, pista, usa, e });
const pe = (m, texto, pista = "", usa = null) => p(m, texto, pista, usa, true);

export const SECUENCIAS_POR_TAREA = {
  acordar: [
    [
      pe(5, "Conocen (en plenaria) la unidad: el docente explica qué problema van a resolver, a quién le servirá {producto} y qué harán en cada etapa."),
      pe(5, "Acuerdan (en plenaria) cómo se evaluará con la rúbrica y forman un grupo editor por sección: cartel del acuerdo y lista de grupos; se guardan en la carpeta del producto."),
      pe(7, "Escuchan (individual, dos veces, leídas por el docente) cinco oraciones ({frases}) y marcan en la hoja la imagen que corresponde.", "oraciones sencillas del tema"),
      pe(7, "Leen (en parejas) un texto breve sobre {asunto} y responden qué dice, mientras el docente circula y observa."),
      pe(6, "Escriben (individual) dos oraciones sobre {asunto} y responden en voz alta una pregunta a su pareja ({frases}): hoja de diagnóstico; la recoge el docente.", "una pregunta sencilla del tema"),
    ],
    [
      pe(6, "Conversan (en plenaria) con el docente sobre qué problema van a resolver, a quién le servirá {producto} y qué harán en cada etapa."),
      pe(4, "Revisan (en plenaria) la rúbrica, acuerdan cómo se evaluará y eligen la sección de cada grupo editor: cartel del acuerdo y lista de grupos."),
      pe(6, "Escuchan (individual) al docente leer cinco oraciones ({frases}) y marcan la imagen de cada una.", "oraciones sencillas del tema"),
      pe(7, "Leen (en parejas) un texto breve sobre {asunto} y subrayan lo que entienden, mientras el docente anota quién necesita apoyo."),
      pe(7, "Escriben (individual) dos oraciones y luego se hacen una pregunta en parejas ({frases}), y el docente escucha a varias: hoja de diagnóstico; la recoge el docente.", "una pregunta sencilla del tema"),
    ],
  ],
  visitar_entrevistar: [
    [
      p(4, "Repasan (en grupos) su turno y la pregunta que firmó cada estudiante, mientras el docente recuerda cómo pedir la palabra (_Excuse me…_, _May I ask…?_)."),
      p(4, "Escuchan (en plenaria) a {invitado} presentarse y anotan en la tabla común lo que ya dice."),
      pe(12, "Entrevistan (por turnos, una pregunta por estudiante) a {invitado} sobre {datos} ({frases}), mientras el docente marca la lista de cotejo.", "preguntar por esos datos"),
      p(6, "Preguntan (por turnos) lo que falta y reaccionan a lo que oyen (_Really?_, _That’s great!_, _I see_), y el docente ayuda a quien se traba."),
      pe(4, "Comprueban (en grupos, con {invitado}) que no falte ningún dato y piden aclarar lo que no entendieron: tabla común completa; queda en la carpeta de la sección."),
    ],
    [
      p(3, "Reciben (en plenaria) a {invitado} y le explican para qué sirve {producto}."),
      p(5, "Ensayan (en parejas) su pregunta en voz baja, y el docente pasa corrigiendo la pronunciación ({frases}).", "preguntar por los datos del guion"),
      pe(13, "Entrevistan (en grupos, por turnos): cada estudiante hace su propia pregunta del guion a {invitado} sobre {datos} ({frases}), y los demás anotan en la tabla común.", "preguntar por esos datos"),
      p(5, "Preguntan (en grupos) lo que quedó sin responder, mientras el docente señala en la tabla los huecos."),
      pe(4, "Comprueban (en plenaria) la tabla con {invitado} y le agradecen ({frases}): tabla común completa; queda en la carpeta de la sección.", "agradecer", /cortesia|you.re welcome/),
    ],
  ],
  presentar: [
    [
      p(4, "Reciben (en plenaria) a {audiencia} y le dicen para qué hicieron {producto}."),
      pe(8, "Presentan (en grupos editores, cada grupo su sección) {producto} ante la audiencia, mientras el docente observa con la rúbrica."),
      p(4, "Muestran (en grupos editores) una página o pieza concreta de cada sección ({frases}).", "explicar para qué sirve"),
      pe(7, "Explican (en grupos editores) cómo se usa y responden preguntas de la audiencia ({frases}): presentación oral observada con la rúbrica.", "explicar para qué sirve"),
    ],
    [
      p(3, "Saludan (en plenaria) a {audiencia} y aclaran quién hace de visitante, si lo hay."),
      pe(9, "Muestran (en grupos editores) una a una todas las secciones de {producto} a la audiencia, explicando para qué sirve cada una ({frases}).", "explicar para qué sirve"),
      p(4, "Señalan (en grupos editores) en {producto} dónde encontrar cada dato, y el docente anota lo que observa."),
      pe(6, "Responden (en grupos editores) lo que la audiencia pregunte, mientras el docente completa la rúbrica: presentación oral observada."),
    ],
  ],
  // La prueba depende del producto (PRUEBA_POR_SECCION): siempre es usarlo con la audiencia.
  "probar_audiencia:pedido": [
    [
      p(3, "Eligen (en parejas) qué plato pedirán y repasan cómo pedirlo ({frases}).", "pedir un plato"),
      pe(9, "Hacen (en parejas, por turnos) pedidos reales con el menú a {audiencia} (_I’ll have…, please_, _Pardon? Could you repeat that?_), y el docente marca la lista de cotejo de cada estudiante."),
      p(2, "Cambian (en parejas) de papel y piden otro plato, mientras el docente sigue observando."),
      pe(6, "Recogen (en plenaria) en tarjetas lo que la audiencia cambiaría y lo que le sirvió (_I like…_, _I wish…_): tarjetas en la carpeta del producto."),
    ],
    [
      p(3, "Ubican (en parejas) en el menú lo que van a pedir, y el docente aclara dudas."),
      pe(10, "Usan (en parejas) el menú para hacerle un pedido a {audiencia} y aclarar lo que no entiendan (_I’ll have…, please_, _Pardon? Could you repeat that?_), y el docente observa a cada pareja con la lista de cotejo."),
      p(2, "Repiten (en parejas) el pedido con otro plato de la guía ({frases}).", "pedir un plato"),
      pe(5, "Anotan (en plenaria) en tarjetas los comentarios de la audiencia (_I like…_, _I wish…_): tarjetas en la carpeta del producto."),
    ],
  ],
  "probar_audiencia:guia": [
    [
      p(3, "Eligen (en parejas) el lugar al que van a llevar a su invitado y repasan cómo indicar el camino ({frases}).", "indicar un lugar"),
      pe(9, "Guían (en parejas) a {audiencia} usando {producto}, de un lugar a otro ({frases}), y el docente marca la lista de cotejo de cada pareja.", "indicar el camino y ofrecer ayuda"),
      p(2, "Cambian (en parejas) de papel con otro lugar, mientras el docente sigue observando."),
      pe(6, "Recogen (en plenaria) en tarjetas lo que la audiencia no entendió y lo que le sirvió (_I like…_, _I wish…_): tarjetas en la carpeta del producto."),
    ],
    [
      p(3, "Ubican (en parejas) en {producto} el lugar que van a mostrar, y el docente aclara dudas."),
      pe(10, "Acompañan (en parejas) a {audiencia} por el centro con {producto} en la mano e indican el camino ({frases}), y el docente observa a cada pareja con la lista de cotejo.", "indicar el camino y ofrecer ayuda"),
      p(2, "Responden (en parejas) lo que pregunte la audiencia en el recorrido ({frases}).", "ofrecer ayuda"),
      pe(5, "Anotan (en plenaria) en tarjetas los comentarios de la audiencia (_I like…_, _I wish…_): tarjetas en la carpeta del producto."),
    ],
  ],
  "probar_audiencia:explicar": [
    [
      p(3, "Eligen (en parejas) la parte de {producto} que van a explicar y a quién."),
      pe(9, "Explican (en parejas) a {audiencia} una parte concreta de {producto} con un ejemplo y responden sus dudas (_This part shows…_, _Could you repeat that?_), y el docente marca la lista de cotejo de cada pareja."),
      p(2, "Cambian (en parejas) de papel, mientras el docente sigue observando."),
      pe(6, "Recogen (en plenaria) en tarjetas lo que la audiencia cambiaría y lo que le sirvió (_I like…_, _I wish…_): tarjetas en la carpeta del producto."),
    ],
    [
      p(3, "Repasan (en parejas) qué parte de {producto} van a explicar y con qué ejemplo."),
      pe(10, "Muestran (en parejas) a {audiencia} cómo usar una parte de {producto} y responden sus dudas (_This part shows…_, _Pardon?_), y el docente observa a cada pareja con la lista de cotejo."),
      p(2, "Preguntan (en parejas) a la audiencia qué parte le serviría en casa."),
      pe(5, "Anotan (en plenaria) en tarjetas los comentarios de la audiencia (_I like…_, _I wish…_): tarjetas en la carpeta del producto."),
    ],
  ],
  indagar_disenar: [
    [
      p(3, "Repasan (en plenaria) qué datos necesita {producto}, mientras el docente muestra una pregunta modelo (_How often do you…?_)."),
      pe(7, "Redactan (en grupos) una encuesta breve de 4 o 5 preguntas sobre {asunto} (_How often do you…?_, _What time do you…?_), sin espacio para nombres."),
      p(2, "Prueban (en parejas) las preguntas con otro grupo y cambian las que no se entienden."),
      pe(3, "Firman (individual) la pregunta que aportó cada uno, no las respuestas: encuesta lista; queda en la carpeta."),
    ],
    [
      p(3, "Conversan (en plenaria) sobre qué hay que preguntar para saber {asunto}, y el docente anota los datos en la pizarra."),
      pe(7, "Escriben (en grupos) las preguntas de la encuesta, una por dato (_How often do you…?_, _Do you always…?_), sin espacio para nombres."),
      p(2, "Comparan (en grupos) sus preguntas con las de otro grupo y dejan 4 o 5."),
      pe(3, "Firman (individual) la pregunta que aportó cada uno, no las respuestas: encuesta lista; queda en la carpeta."),
    ],
  ],
  indagar_aplicar: [
    [
      p(2, "Reparten (en parejas) a quién preguntará cada uno, mientras el docente recuerda que las respuestas no llevan nombre."),
      pe(7, "Aplican (en parejas, por turnos) la encuesta a sus compañeros (_How often do you…?_, _I never…_, _I always…_), sin anotar nombres."),
      p(2, "Reúnen (en grupos) las hojas de respuestas sin nombre."),
      pe(4, "Cuentan (en grupos) las respuestas y las resumen en cifras del grupo, nunca por nombre (_8 of 30 students…_): tabla común de resultados; queda en la carpeta."),
    ],
    [
      p(2, "Ensayan (en parejas) cómo hacer las preguntas, mientras el docente aclara que nadie anota nombres."),
      pe(7, "Preguntan (en parejas, por turnos) a sus compañeros con la encuesta y marcan cada respuesta (_I sometimes…_, _I never…_), sin anotar nombres."),
      p(2, "Juntan (en grupos) las respuestas de todas las parejas."),
      pe(4, "Resumen (en grupos) los resultados en cifras del grupo, nunca por nombre (_8 of 30 students…_): tabla común de resultados; queda en la carpeta."),
    ],
  ],
  indagar_contrastar: [
    [
      p(3, "Leen (en parejas) {fuente}, impresa por el docente, y subrayan el dato principal."),
      pe(4, "Comprueban (en grupos) si la fuente es fiable: quién la escribió, de cuándo es y para quién."),
      pe(5, "Comparan (en grupos) sus resultados con la fuente (_The source says…, but our group…_)."),
      pe(3, "Anotan (en grupos) qué coincide y qué no: tabla de contraste; queda en la carpeta."),
    ],
    [
      p(3, "Escuchan (en plenaria) {fuente}, leída por el docente, y anotan el dato principal."),
      pe(4, "Verifican (en grupos) si la fuente es fiable: quién la escribió, de cuándo es y a quién se dirige."),
      pe(5, "Contrastan (en grupos) esa fuente con su tabla de resultados (_The source says…, but our group…_)."),
      pe(3, "Registran (en grupos) qué coincide y qué no: tabla de contraste; queda en la carpeta."),
    ],
  ],
  "probar_audiencia:general": [
    [
      p(3, "Eligen (en parejas) la parte de {producto} que van a usar con la audiencia."),
      pe(9, "Explican (en parejas) a {audiencia} para qué sirve una parte concreta de {producto} y responden sus dudas (_This part shows…_, _Could you repeat that?_), y el docente marca la lista de cotejo de cada pareja."),
      p(2, "Cambian (en parejas) de papel, mientras el docente sigue observando."),
      pe(6, "Recogen (en plenaria) en tarjetas lo que la audiencia cambiaría y lo que le sirvió (_I like…_, _I wish…_): tarjetas en la carpeta del producto."),
    ],
    [
      p(3, "Repasan (en parejas) qué van a mostrar y cómo lo van a decir ({frases}).", "explicar el producto"),
      pe(10, "Prueban (en parejas) {producto} con {audiencia} y aclaran lo que no entiendan (_Pardon?_, _Could you repeat that?_), y el docente observa a cada pareja con la lista de cotejo."),
      p(2, "Preguntan (en parejas) a la audiencia qué le sirvió más."),
      pe(5, "Anotan (en plenaria) en tarjetas los comentarios de la audiencia (_I like…_, _I wish…_): tarjetas en la carpeta del producto."),
    ],
  ],
  evaluar_comentarios: [
    [
      pe(4, "Leen (individual) las tarjetas con los comentarios de la audiencia, mientras el docente aclara las palabras que no entienden."),
      p(2, "Subrayan (individual) en cada tarjeta lo que se pide cambiar."),
      p(2, "Conversan (en parejas) sobre qué comentario les pareció más útil ({frases}).", "dar su opinión"),
      pe(5, "Responden (individual) por escrito qué piden cambiar y por qué ({frases}): respuestas firmadas; son la evidencia de comprensión.", "decir qué cambio se pide"),
    ],
    [
      pe(5, "Leen (en grupos) las tarjetas con los comentarios de la audiencia y conversan sobre qué piden, mientras el docente pasa por los grupos."),
      p(2, "Separan (en grupos) las tarjetas en lo que sirvió y lo que hay que cambiar."),
      p(2, "Preguntan (en plenaria) al docente lo que no entendieron de las tarjetas."),
      pe(5, "Escriben (individual, cada quien por su cuenta) qué cambio se pide y por qué ({frases}): respuestas firmadas; son la evidencia de comprensión.", "decir qué cambio se pide"),
    ],
  ],
  corregir_final: [
    [
      p(2, "Reparten (en grupos editores) qué sección corrige cada quien."),
      pe(6, "Corrigen (en grupos editores) en {producto} lo que pidió la audiencia: versión revisada, lista para entregar{entrega}."),
      p(3, "Comprueban (en grupos editores) que los datos sigan coincidiendo con su fuente, y el docente revisa una muestra."),
      p(2, "Pasan (en grupos editores) a limpio lo corregido."),
    ],
    [
      p(2, "Ubican (en grupos editores) en {producto} lo que hay que cambiar."),
      pe(5, "Corrigen (en grupos editores) lo que pidió la audiencia: versión revisada, lista para entregar{entrega}."),
      p(3, "Leen (en grupos editores) en voz alta lo corregido, y el docente señala lo que falte."),
      p(2, "Revisan (en grupos editores) que no quede ningún cambio pendiente."),
    ],
  ],
  evaluar_proceso: [
    [
      p(3, "Conocen (en plenaria) cómo completar las fichas, y el docente modela un ejemplo."),
      pe(8, "Evalúan (en parejas) su proceso con las fichas de autoevaluación y coevaluación: fichas en el portafolio."),
      p(3, "Comentan (en parejas) una fortaleza y una mejora de su compañero ({frases}).", "dar una opinión"),
      pe(7, "Escriben (individual) su reflexión sobre qué aprendieron y qué harían distinto: reflexión firmada en el portafolio."),
    ],
    [
      p(3, "Recuerdan (en plenaria) con el docente lo que hicieron en la unidad."),
      pe(8, "Completan (en parejas) las fichas de autoevaluación y coevaluación, y el docente recoge las dudas: fichas en el portafolio."),
      p(3, "Conversan (en parejas) sobre qué fue lo más difícil ({frases}).", "dar una opinión"),
      pe(7, "Reflexionan (individual) por escrito sobre qué cambió en {producto} y qué aprendieron: reflexión firmada en el portafolio."),
    ],
  ],
};
