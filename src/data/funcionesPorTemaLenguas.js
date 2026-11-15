// Reparto de la gramática y de las funciones POR FUNCIÓN COMUNICATIVA (opción B,
// aprobada por César el 2026-10-30), solo para las mallas que tienen tabla aquí.
//
// La malla MINERD trae la gramática del grado sin tema, pero cada estructura dice
// para qué sirve ("…para sostener una conversación", "…en contexto de compra").
// Cada función se reconoce por un patrón en la cabecera de la estructura (texto
// normalizado, antes de los dos puntos). Qué funciones trabaja cada tema NO viene
// en la malla: es una decisión de DocenteOS, aprobada por César.
// Las estructuras sin función explícita (pronombres, conectores, adverbios…) no se
// asignan a ningún tema: siguen en la lista completa del grado.
//
// Los nombres de las funciones son literales de la malla (Procedimientos ›
// Funcionales). Lo consume src/data/repartoContenidoPorTema.js.

export const FUNCIONES_POR_TEMA = {
  "ingles-2do": {
    funciones: [
      { nombre: "Sostener una conversación", patron: /sostener una conversacion/ },
      { nombre: "Intercambiar información sobre actividades cotidianas", patron: /actividades cotidianas/ },
      { nombre: "Describir estados anímicos y físicos", patron: /estados animicos y fisicos/ },
      { nombre: "Solicitar y ofrecer ayuda", patron: /ayuda/ },
      { nombre: "Comprar", patron: /compra/ },
      { nombre: "Expresar deseo o interés", patron: /deseo o interes/ },
      { nombre: "Pedir y dar consejos y sugerencias", patron: /consejos|sugerencias/ },
      { nombre: "Expresar planes y acordar un encuentro", patron: /planes|acordar (un )?encuentro/ },
      { nombre: "Narrar hechos y experiencias", patron: /narrar/ },
    ],
    temas: {
      "Relaciones humanas y sociales": ["Sostener una conversación", "Describir estados anímicos y físicos", "Expresar deseo o interés", "Narrar hechos y experiencias"],
      "Actividades de la vida diaria": ["Intercambiar información sobre actividades cotidianas", "Sostener una conversación", "Expresar planes y acordar un encuentro"],
      "Vivienda, entorno y ciudad": ["Solicitar y ofrecer ayuda", "Intercambiar información sobre actividades cotidianas", "Expresar planes y acordar un encuentro"],
      "Escuela y educación": ["Sostener una conversación", "Intercambiar información sobre actividades cotidianas", "Solicitar y ofrecer ayuda", "Pedir y dar consejos y sugerencias"],
      "Deporte, tiempo libre y recreación": ["Expresar deseo o interés", "Expresar planes y acordar un encuentro", "Narrar hechos y experiencias"],
      "Alimentación": ["Comprar", "Expresar deseo o interés", "Pedir y dar consejos y sugerencias"],
      "Salud y cuidados físicos": ["Describir estados anímicos y físicos", "Pedir y dar consejos y sugerencias", "Solicitar y ofrecer ayuda"],
      "Ciencia y tecnología": ["Sostener una conversación", "Solicitar y ofrecer ayuda", "Pedir y dar consejos y sugerencias"],
      "Lengua y comunicación": ["Sostener una conversación", "Narrar hechos y experiencias"],
      "Clima, condiciones atmosféricas y medioambiente": ["Pedir y dar consejos y sugerencias", "Expresar planes y acordar un encuentro", "Narrar hechos y experiencias"],
      "Bienes y servicios": ["Comprar", "Solicitar y ofrecer ayuda"],
      "Actividades sociales y culturales": ["Expresar planes y acordar un encuentro", "Narrar hechos y experiencias", "Expresar deseo o interés"],
      "Viajes y turismo": ["Expresar planes y acordar un encuentro", "Narrar hechos y experiencias", "Comprar"],
    },
  },
  // 1ro y 3ro: mismos temas que 2do; qué funciones trabaja cada tema es decisión de DocenteOS, aprobada por César
  // el 2026-11-11 (revisor g39: sin tabla, las etiquetas salían de funciones de otros temas).
  "ingles-1ro": {
    funciones: [
      { nombre: "Solicitar y ofrecer información personal", patron: /informacion personal/ },
      { nombre: "Expresar gustos y preferencias", patron: /gustos|preferencias/ },
      { nombre: "Dar y pedir indicaciones e instrucciones", patron: /indicaciones|instrucciones/ },
      { nombre: "Dar y pedir información sobre actividades cotidianas", patron: /actividades cotidianas/ },
      { nombre: "Describir a personas por su apariencia y su forma de ser", patron: /personas|apariencia/ },
      { nombre: "Describir y comparar lugares y objetos", patron: /describir lugares|lugares y objetos|comparar lugares/ },
      { nombre: "Dar y pedir información sobre las condiciones atmosféricas", patron: /condiciones atmosfericas/ },
      { nombre: "Expresar opiniones", patron: /opinion/ },
      { nombre: "Narrar experiencias personales, propias y de otras personas", patron: /narrar|experiencias/ },
      { nombre: "Invitar, aceptar o rechazar invitaciones", patron: /invit/ },
    ],
    temas: {
      "Identificación personal": ["Solicitar y ofrecer información personal", "Expresar gustos y preferencias", "Describir a personas por su apariencia y su forma de ser"],
      "Relaciones humanas y sociales": ["Describir a personas por su apariencia y su forma de ser", "Expresar opiniones", "Invitar, aceptar o rechazar invitaciones"],
      "Actividades de la vida diaria": ["Dar y pedir información sobre actividades cotidianas", "Solicitar y ofrecer información personal", "Expresar gustos y preferencias"],
      "Vivienda, entorno y ciudad": ["Describir y comparar lugares y objetos", "Dar y pedir indicaciones e instrucciones"],
      "Escuela y educación": ["Dar y pedir indicaciones e instrucciones", "Dar y pedir información sobre actividades cotidianas", "Describir y comparar lugares y objetos"],
      "Deporte, tiempo libre y recreación": ["Expresar gustos y preferencias", "Invitar, aceptar o rechazar invitaciones", "Narrar experiencias personales, propias y de otras personas"],
      "Alimentación": ["Expresar gustos y preferencias", "Expresar opiniones"],
      "Salud y cuidados físicos": ["Dar y pedir información sobre actividades cotidianas", "Dar y pedir indicaciones e instrucciones", "Expresar opiniones"],
      "Lengua y comunicación": ["Solicitar y ofrecer información personal", "Expresar opiniones"],
      "Ciencia y tecnología": ["Describir y comparar lugares y objetos", "Expresar opiniones"],
      "Clima, condiciones atmosféricas y medio ambiente": ["Dar y pedir información sobre las condiciones atmosféricas", "Expresar opiniones"],
      "Bienes y servicios": ["Describir y comparar lugares y objetos", "Expresar gustos y preferencias"],
      "Actividades sociales y culturales: Viajes y turismo": ["Narrar experiencias personales, propias y de otras personas", "Invitar, aceptar o rechazar invitaciones", "Describir y comparar lugares y objetos"],
    },
  },
  "ingles-3ro": {
    funciones: [
      { nombre: "Solicitar y ofrecer explicaciones y motivos", patron: /explicaciones|motivos/ },
      { nombre: "Expresar opiniones y sugerencias", patron: /opinion|sugerencia/ },
      { nombre: "Hacer prohibiciones y advertencias", patron: /prohibicion|advertencia/ },
      { nombre: "Solicitar y ofrecer indicaciones e instrucciones", patron: /indicaciones|instrucciones/ },
      { nombre: "Narrar historias y secuenciar eventos.", patron: /narrar|secuenciar/ },
      { nombre: "Hacer inferencias", patron: /inferencia/ },
      { nombre: "Hacer predicciones", patron: /prediccion/ },
      { nombre: "Hacer anuncios y dar noticias", patron: /anuncios|noticias/ },
      { nombre: "Comparar hechos y situaciones del pasado con el presente", patron: /comparar hechos|pasado con el presente/ },
    ],
    temas: {
      "Relaciones humanas y sociales": ["Expresar opiniones y sugerencias", "Narrar historias y secuenciar eventos.", "Solicitar y ofrecer explicaciones y motivos"],
      "Actividades de la vida diaria": ["Comparar hechos y situaciones del pasado con el presente", "Solicitar y ofrecer explicaciones y motivos", "Expresar opiniones y sugerencias"],
      "Vivienda, entorno y ciudad": ["Solicitar y ofrecer indicaciones e instrucciones", "Hacer prohibiciones y advertencias", "Comparar hechos y situaciones del pasado con el presente"],
      "Escuela y educación": ["Solicitar y ofrecer indicaciones e instrucciones", "Hacer prohibiciones y advertencias", "Solicitar y ofrecer explicaciones y motivos", "Expresar opiniones y sugerencias"],
      "Deporte, tiempo libre y recreación": ["Hacer anuncios y dar noticias", "Narrar historias y secuenciar eventos.", "Hacer predicciones"],
      "Alimentación": ["Solicitar y ofrecer indicaciones e instrucciones", "Expresar opiniones y sugerencias"],
      "Salud y cuidados físicos": ["Hacer prohibiciones y advertencias", "Expresar opiniones y sugerencias", "Solicitar y ofrecer explicaciones y motivos"],
      "Lengua y comunicación": ["Hacer anuncios y dar noticias", "Narrar historias y secuenciar eventos."],
      "Ciencia y tecnología": ["Solicitar y ofrecer explicaciones y motivos", "Hacer predicciones", "Hacer inferencias"],
      "Clima, condiciones atmosféricas y medioambiente": ["Hacer predicciones", "Hacer prohibiciones y advertencias", "Hacer inferencias"],
      "Bienes y servicios": ["Solicitar y ofrecer explicaciones y motivos", "Expresar opiniones y sugerencias"],
      "Actividades sociales y culturales: Viajes y turismo": ["Narrar historias y secuenciar eventos.", "Solicitar y ofrecer indicaciones e instrucciones", "Hacer anuncios y dar noticias"],
    },
  },
};
