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
};
