const normalizar = (texto = "") => String(texto).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export const MODALIDADES_DIAGNOSTICO = [
  { id: "rapido", nombre: "Diagnóstico rápido", descripcion: "DocenteOS prepara una propuesta equilibrada y lista para revisar.", icono: "⚡" },
  { id: "guiado", nombre: "Diagnóstico guiado", descripcion: "Selecciona, reemplaza y ajusta los ítems sugeridos para tu grupo.", icono: "🧭", recomendado: true },
  { id: "desde_cero", nombre: "Desde cero", descripcion: "Construye una evaluación propia con acompañamiento curricular.", icono: "✏️" },
];

export const PRESETS_FORMATO = [
  { id: "mixto", nombre: "80 · 10 · 5 · 5", descripcion: "16 selección múltiple, 2 verdadero/falso, 1 completar y 1 pareado.", total: 20, porcentajes: { seleccion_multiple: 80, verdadero_falso: 10, completar: 5, pareado: 5 } },
  { id: "seleccion_multiple", nombre: "100% selección múltiple", descripcion: "20 preguntas objetivas con cuatro opciones.", total: 20, porcentajes: { seleccion_multiple: 100, verdadero_falso: 0, completar: 0, pareado: 0 } },
  { id: "personalizado", nombre: "Personalizada", descripcion: "El docente define la cantidad y distribución.", total: 20, porcentajes: { seleccion_multiple: 80, verdadero_falso: 10, completar: 5, pareado: 5 } },
];

export const calcularComposicionFormatos = (total = 20, porcentajes = PRESETS_FORMATO[0].porcentajes) => {
  const formatos = ["seleccion_multiple", "verdadero_falso", "completar", "pareado"];
  const sumaPorcentajes = formatos.reduce((suma, formato) => suma + Math.max(0, Number(porcentajes[formato]) || 0), 0) || 100;
  const calculados = formatos.map((formato) => {
    const exacto = (Math.max(0, Number(porcentajes[formato]) || 0) / sumaPorcentajes) * total;
    return { formato, cantidad: Math.floor(exacto), residuo: exacto - Math.floor(exacto) };
  });
  let restantes = total - calculados.reduce((suma, item) => suma + item.cantidad, 0);
  [...calculados].sort((a, b) => b.residuo - a.residuo).forEach((item) => { if (restantes > 0) { item.cantidad += 1; restantes -= 1; } });
  return Object.fromEntries(calculados.map((item) => [item.formato, item.cantidad]));
};

const TRADUCCIONES = {
  name:"nombre", age:"edad", live:"vivir", hello:"hola", mother:"madre", father:"padre", brother:"hermano", sister:"hermana", notebook:"cuaderno", pencil:"lápiz", book:"libro", teacher:"docente", "wake up":"levantarse", school:"escuela", homework:"tarea", afternoon:"tarde", fruit:"fruta", water:"agua", breakfast:"desayuno", healthy:"saludable", house:"casa", park:"parque", "next to":"al lado de", play:"jugar", volleyball:"voleibol", music:"música", saturday:"sábado", rainy:"lluvioso", cool:"fresco", jacket:"chaqueta", shoes:"zapatos", computer:"computadora", message:"mensaje", password:"contraseña", study:"estudiar", reuse:"reutilizar", clean:"limpio", environment:"medioambiente", yesterday:"ayer", visited:"visitó", cooked:"cocinó", watched:"vio", "going to":"ir a", next:"próximo", visit:"visitar",
  bonjour:"hola", prénom:"nombre", âge:"edad", habiter:"vivir", mère:"madre", père:"padre", frère:"hermano", sœur:"hermana", cahier:"cuaderno", crayon:"lápiz", livre:"libro", professeur:"docente", "se lever":"levantarse", école:"escuela", devoirs:"tareas", "après-midi":"tarde", fruits:"frutas", eau:"agua", "petit-déjeuner":"desayuno", santé:"salud", maison:"casa", parc:"parque", "à côté":"al lado", jouer:"jugar", volley:"voleibol", musique:"música", samedi:"sábado", pluie:"lluvia", frais:"fresco", veste:"chaqueta", chaussures:"zapatos", ordinateur:"computadora", "mot de passe":"contraseña", étudier:"estudiar", réutiliser:"reutilizar", propre:"limpio", environnement:"medioambiente", hier:"ayer", visiter:"visitar", préparer:"preparar", regarder:"mirar", aller:"ir", prochain:"próximo",
};

const rotarOpciones = (opciones, semilla = "") => {
  const giro = [...String(semilla)].reduce((suma, caracter) => suma + caracter.charCodeAt(0), 0) % opciones.length;
  return [...opciones.slice(giro), ...opciones.slice(0, giro)];
};

const escaparRegExp = (texto) => String(texto).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const contenidoPorFormato = (item, formato, contexto = {}) => {
  const palabras = Array.isArray(item.vocabulario) ? item.vocabulario.filter(Boolean) : [];
  const correcta = palabras[0] || item.respuestaEsperada || "Respuesta correcta";
  const distractores = (contexto.vocabulario || []).filter((palabra) => palabra !== correcta && !palabras.includes(palabra)).slice(0, 3);
  const opciones = rotarOpciones([correcta, ...distractores], item.id);
  while (opciones.length < 4) opciones.push(`Opción ${opciones.length + 1}`);
  if (formato === "seleccion_multiple") return {
    consignaObjetiva: `${item.textoBase ? `Lee o escucha: “${item.textoBase}” ` : ""}¿Cuál opción contiene una palabra relacionada correctamente con el texto o situación?`,
    opciones,
    respuestaCorrecta: correcta,
  };
  if (formato === "verdadero_falso") {
    const esVerdadero = contexto.indice % 2 === 0;
    const temaAlterno = contexto.temas?.find((tema) => tema !== item.tema) || "un tema diferente";
    return {
      consignaObjetiva: item.textoBase ? `Lee o escucha: “${item.textoBase}”` : item.consigna,
      afirmacion: esVerdadero ? `El texto presenta información relacionada con ${item.tema}.` : `El texto presenta principalmente información relacionada con ${temaAlterno}.`,
      respuestaCorrecta: esVerdadero ? "Verdadero" : "Falso",
    };
  }
  if (formato === "completar") {
    const base = item.textoBase || item.consigna;
    const textoIncompleto = correcta && new RegExp(escaparRegExp(correcta), "i").test(base) ? base.replace(new RegExp(escaparRegExp(correcta), "i"), "__________") : `${base} __________`;
    return { consignaObjetiva: `Completa correctamente: “${textoIncompleto}”`, bancoPalabras: rotarOpciones([correcta, ...distractores], `${item.id}-banco`), respuestaCorrecta: correcta };
  }
  const pares = palabras.slice(0, 4).map((palabra) => ({ izquierda: palabra, derecha: TRADUCCIONES[String(palabra).toLowerCase()] || `Significado de “${palabra}”` }));
  return { consignaObjetiva: "Relaciona cada palabra con su significado en español.", pares, respuestaCorrecta: pares.map((par) => `${par.izquierda} = ${par.derecha}`).join("; ") };
};

export const aplicarComposicionPrueba = (items = [], { total = 20, porcentajes } = {}) => {
  const elegibles = items.filter((item) => item.dimension !== "Producción oral");
  const preferidos = [...elegibles.filter((item) => item.seleccionado), ...elegibles.filter((item) => !item.seleccionado)].slice(0, total);
  const idsPrueba = new Set(preferidos.map((item) => item.id));
  const composicion = calcularComposicionFormatos(Math.min(total, preferidos.length), porcentajes);
  const secuencia = Object.entries(composicion).flatMap(([formato, cantidad]) => Array(cantidad).fill(formato));
  const contexto = { vocabulario: [...new Set(elegibles.flatMap((item) => item.vocabulario || []))], temas: [...new Set(elegibles.map((item) => item.tema).filter(Boolean))] };
  let indiceFormato = 0;
  return items.map((item) => {
    if (item.dimension === "Producción oral") return { ...item, componente: "desempeno", seleccionado: item.seleccionado };
    if (!idsPrueba.has(item.id)) return { ...item, componente: "prueba_escrita", seleccionado: false };
    const formatoRespuesta = secuencia[indiceFormato++] || "seleccion_multiple";
    return { ...item, componente: "prueba_escrita", seleccionado: true, formatoRespuesta, ...contenidoPorFormato(item, formatoRespuesta, { ...contexto, indice: indiceFormato - 1 }) };
  });
};

const mezclarLista = (lista = []) => {
  const salida = [...lista];
  for (let indice = salida.length - 1; indice > 0; indice -= 1) {
    const destino = Math.floor(Math.random() * (indice + 1));
    [salida[indice], salida[destino]] = [salida[destino], salida[indice]];
  }
  return salida;
};

export const generarPruebaMezclada = (items = [], { total = 20, porcentajes } = {}) => {
  const desempenos = items.filter((item) => item.dimension === "Producción oral");
  const escritos = items.filter((item) => item.dimension !== "Producción oral");
  const dimensiones = [...new Set(escritos.map((item) => item.dimension))];
  const grupos = dimensiones.map((dimension) => mezclarLista(escritos.filter((item) => item.dimension === dimension)));
  const elegidos = [];
  let vuelta = 0;
  while (elegidos.length < Math.min(total, escritos.length) && grupos.some((grupo) => grupo.length)) {
    const grupo = grupos[vuelta % grupos.length];
    if (grupo.length) elegidos.push(grupo.shift());
    vuelta += 1;
  }
  const ids = new Set(elegidos.map((item) => item.id));
  const preparados = [
    ...elegidos.map((item) => ({ ...item, seleccionado: true })),
    ...mezclarLista(desempenos).map((item, indice) => ({ ...item, seleccionado: indice < 2 })),
    ...escritos.filter((item) => !ids.has(item.id)).map((item) => ({ ...item, seleccionado: false })),
  ];
  return aplicarComposicionPrueba(preparados, { total, porcentajes });
};

const NATURALEZAS = [
  { claves: ["lenguas extranjeras", "ingles", "frances"], dimensiones: ["Comprensión oral", "Producción oral", "Comprensión escrita", "Producción escrita"], tipos: ["Escucha", "Conversación", "Lectura", "Producción"] },
  { claves: ["lengua espanola"], dimensiones: ["Comprensión oral", "Producción oral", "Comprensión lectora", "Producción escrita"], tipos: ["Escucha", "Conversación", "Lectura", "Producción"] },
  { claves: ["matematica"], dimensiones: ["Sentido numérico", "Procedimientos", "Resolución de problemas", "Razonamiento y comunicación"], tipos: ["Respuesta breve", "Ejercicio", "Situación problemática", "Explicación"] },
  { claves: ["ciencias de la naturaleza", "biologia", "quimica", "fisica"], dimensiones: ["Observación", "Comprensión científica", "Aplicación", "Indagación"], tipos: ["Observación", "Respuesta breve", "Situación", "Experiencia"] },
  { claves: ["ciencias sociales", "geografia", "historia", "moral y civica"], dimensiones: ["Tiempo y espacio", "Interpretación de fuentes", "Ciudadanía", "Pensamiento crítico"], tipos: ["Línea de tiempo", "Fuente visual", "Situación", "Explicación"] },
  { claves: ["educacion fisica"], dimensiones: ["Habilidades motrices", "Coordinación", "Hábitos saludables", "Cooperación"], tipos: ["Ejecución", "Circuito", "Conversación", "Observación"] },
  { claves: ["educacion artistica"], dimensiones: ["Percepción", "Expresión", "Creatividad", "Apreciación"], tipos: ["Observación", "Producción", "Creación", "Conversación"] },
  { claves: ["formacion integral", "religiosa"], dimensiones: ["Identidad", "Convivencia", "Valores", "Toma de decisiones"], tipos: ["Conversación", "Situación", "Reflexión", "Observación"] },
  { claves: ["tecnologia"], dimensiones: ["Uso funcional", "Pensamiento lógico", "Ciudadanía digital", "Creación"], tipos: ["Ejecución", "Secuencia", "Situación", "Producto"] },
];

const NATURALEZA_GENERAL = { dimensiones: ["Recuperación de saberes", "Comprensión", "Aplicación", "Comunicación"], tipos: ["Conversación", "Respuesta breve", "Situación", "Producción"] };

export const obtenerNaturalezaArea = (area = "", asignatura = "") => {
  const clave = normalizar(`${area} ${asignatura}`);
  return NATURALEZAS.find((item) => item.claves.some((token) => clave.includes(token))) || NATURALEZA_GENERAL;
};

const TEMAS_IDIOMAS = {
  "Inglés": [
    ["Saludos e información personal", "Hello. My name is Ana. I am twelve years old. I live in San Juan.", "What is your name? How old are you? Where do you live?", "name, age, live, hello"],
    ["Familia", "This is Luis. He lives with his mother, father and two sisters.", "Who is in your family? Describe one person.", "mother, father, brother, sister"],
    ["Aula y escuela", "Open your notebook, write the date and put the pencil next to the book.", "What objects are in your classroom? What is your favorite subject?", "notebook, pencil, book, teacher"],
    ["Rutina diaria", "Maria wakes up at 6:30, goes to school at 7:30 and does homework in the afternoon.", "What time do you wake up? What do you do after school?", "wake up, school, homework, afternoon"],
    ["Alimentos y salud", "Carlos eats fruit for breakfast and drinks water. He does not drink soda every day.", "What healthy food do you like? What do you drink?", "fruit, water, breakfast, healthy"],
    ["Casa y comunidad", "The pharmacy is next to the park. The school is across from the supermarket.", "Where is your house? Name two places in your community.", "house, park, school, next to"],
    ["Deportes y tiempo libre", "On Saturdays, Elena plays volleyball with her friends and listens to music at home.", "What sport or activity do you like? When do you practice it?", "play, volleyball, music, Saturday"],
    ["Clima y ropa", "Today it is rainy and cool. Pedro is wearing a blue jacket and black shoes.", "How is the weather today? What are you wearing?", "rainy, cool, jacket, shoes"],
    ["Tecnología", "I use a computer to study and send messages, but I do not share my password.", "How do you use technology? What information should remain private?", "computer, message, password, study"],
    ["Ambiente", "Our class reuses paper, saves water and keeps the schoolyard clean.", "What can you do to protect the environment?", "reuse, water, clean, environment"],
    ["Experiencias pasadas", "Yesterday, Laura visited her grandmother, cooked lunch and watched a movie.", "What did you do yesterday or last weekend?", "yesterday, visited, cooked, watched"],
    ["Planes futuros", "Next weekend, José is going to study, visit the museum and play with his cousins.", "What are you going to do next weekend?", "going to, next, visit, study"],
  ],
  "Francés": [
    ["Salutations et informations personnelles", "Bonjour. Je m’appelle Ana. J’ai douze ans. J’habite à San Juan.", "Comment tu t’appelles ? Quel âge as-tu ? Où habites-tu ?", "bonjour, prénom, âge, habiter"],
    ["La famille", "Voici Luis. Il habite avec sa mère, son père et ses deux sœurs.", "Qui est dans ta famille ? Décris une personne.", "mère, père, frère, sœur"],
    ["La classe et l’école", "Ouvre ton cahier, écris la date et mets le crayon à côté du livre.", "Quels objets sont dans ta classe ? Quelle est ta matière préférée ?", "cahier, crayon, livre, professeur"],
    ["La routine quotidienne", "Marie se lève à six heures et demie, va à l’école et fait ses devoirs l’après-midi.", "À quelle heure te lèves-tu ? Que fais-tu après l’école ?", "se lever, école, devoirs, après-midi"],
    ["Les aliments et la santé", "Carlos mange des fruits au petit-déjeuner et boit de l’eau. Il ne boit pas de soda tous les jours.", "Quel aliment sain aimes-tu ? Qu’est-ce que tu bois ?", "fruits, eau, petit-déjeuner, santé"],
    ["La maison et la communauté", "La pharmacie est à côté du parc. L’école est en face du supermarché.", "Où est ta maison ? Nomme deux lieux de ta communauté.", "maison, parc, école, à côté"],
    ["Les sports et les loisirs", "Le samedi, Elena joue au volley avec ses amis et écoute de la musique à la maison.", "Quel sport ou loisir aimes-tu ? Quand le pratiques-tu ?", "jouer, volley, musique, samedi"],
    ["Le climat et les vêtements", "Aujourd’hui, il pleut et il fait frais. Pedro porte une veste bleue et des chaussures noires.", "Quel temps fait-il aujourd’hui ? Qu’est-ce que tu portes ?", "pluie, frais, veste, chaussures"],
    ["La technologie", "J’utilise un ordinateur pour étudier et envoyer des messages, mais je ne partage pas mon mot de passe.", "Comment utilises-tu la technologie ? Quelle information doit rester privée ?", "ordinateur, message, mot de passe, étudier"],
    ["L’environnement", "Notre classe réutilise le papier, économise l’eau et garde la cour propre.", "Que peux-tu faire pour protéger l’environnement ?", "réutiliser, eau, propre, environnement"],
    ["Les expériences passées", "Hier, Laura a visité sa grand-mère, a préparé le déjeuner et a regardé un film.", "Qu’est-ce que tu as fait hier ou le week-end dernier ?", "hier, visiter, préparer, regarder"],
    ["Les projets futurs", "Le week-end prochain, José va étudier, visiter le musée et jouer avec ses cousins.", "Qu’est-ce que tu vas faire le week-end prochain ?", "aller, prochain, visiter, étudier"],
  ],
};

const construirBancoIdioma = (asignatura) => (TEMAS_IDIOMAS[asignatura] || TEMAS_IDIOMAS["Inglés"]).flatMap(([tema, texto, preguntas, vocabulario], temaIndex) => {
  const dificultad = temaIndex < 2 ? "Activación" : temaIndex < 9 ? "Esencial" : "Profundización";
  const recomendado = temaIndex < 2;
  const idioma = asignatura === "Francés" ? "francés" : "inglés";
  return [
    { dimension: "Comprensión oral", tipo: "Escucha", tema, dificultad, textoBase: texto, vocabulario: vocabulario.split(", "), aprendizaje: `Comprende información explícita sobre ${tema.toLowerCase()}`, consigna: `El docente lee dos veces: “${texto}”. El estudiante registra tres datos que comprendió o selecciona las imágenes correspondientes.`, apoyo: "Primera escucha completa; segunda escucha pausada. Puede usar imágenes, sin traducir el texto.", respuestaEsperada: "Identifica al menos dos datos explícitos del mensaje.", materiales: "Guion docente y tres o cuatro imágenes/opciones", criterios: "Reconoce vocabulario clave; localiza información explícita; responde de acuerdo con el mensaje.", seleccionado: recomendado },
    { dimension: "Producción oral", tipo: "Conversación", tema, dificultad, textoBase: texto, vocabulario: vocabulario.split(", "), componente: "desempeno", aprendizaje: `Intercambia información oral sobre ${tema.toLowerCase()}`, consigna: `Responde en ${idioma}: ${preguntas}`, apoyo: `Banco oral opcional: ${vocabulario}. Se aceptan pausas y autocorrecciones.`, respuestaEsperada: "Responde con palabras o frases comprensibles relacionadas con las preguntas.", materiales: "Tarjeta de conversación y apoyo visual opcional", criterios: "Comprende la pregunta; usa vocabulario pertinente; comunica una idea comprensible.", seleccionado: recomendado },
    { dimension: "Comprensión escrita", tipo: "Lectura", tema, dificultad, textoBase: texto, vocabulario: vocabulario.split(", "), aprendizaje: `Localiza e interpreta información sobre ${tema.toLowerCase()}`, consigna: `Lee: “${texto}”. Subraya cuatro palabras conocidas y responde tres preguntas: ¿quién?, ¿qué hace? y ¿qué dato adicional presenta el texto?`, apoyo: "Puede releer, subrayar y relacionar palabras con imágenes.", respuestaEsperada: "Localiza información explícita y reconoce vocabulario del tema.", materiales: "Texto impreso, lápiz e imágenes opcionales", criterios: "Ubica datos; relaciona vocabulario y contexto; responde coherentemente.", seleccionado: recomendado },
    { dimension: "Producción escrita", tipo: "Producción", tema, dificultad, textoBase: texto, vocabulario: vocabulario.split(", "), aprendizaje: `Produce frases breves sobre ${tema.toLowerCase()}`, consigna: `Usa estas palabras como apoyo: ${vocabulario}. Escribe de dos a cuatro frases propias relacionadas con el tema.`, apoyo: "Se permite banco de palabras y una frase modelo diferente.", respuestaEsperada: "Produce frases comprensibles con vocabulario pertinente al tema.", materiales: "Hoja pautada y banco de palabras", criterios: "Comunica información; organiza frases; utiliza vocabulario reconocible.", seleccionado: recomendado },
  ];
});

const construirGenericos = (naturaleza, area) => naturaleza.dimensiones.flatMap((dimension, indice) => {
  const tipo = naturaleza.tipos[indice] || "Actividad";
  return [
    [dimension, tipo, "Activación", `Recupera conocimientos familiares de ${dimension.toLowerCase()}`, `Realiza una actividad breve y cercana que permita recordar saberes de ${area || "esta área"}.`, "Incluye ejemplo, apoyo visual o material concreto."],
    [dimension, tipo, "Esencial", `Aplica el aprendizaje esencial de ${dimension.toLowerCase()}`, `Resuelve o produce una evidencia sencilla vinculada con ${dimension.toLowerCase()} en una situación cotidiana.`, "Permite aclarar la instrucción sin revelar la respuesta."],
  ];
});

export const generarBancoDiagnostico = ({ area = "", asignatura = "" } = {}) => {
  const naturaleza = obtenerNaturalezaArea(area, asignatura);
  const esIdioma = area === "Lenguas Extranjeras" || ["Inglés", "Francés"].includes(asignatura);
  if (esIdioma) return construirBancoIdioma(asignatura === "Francés" ? "Francés" : "Inglés").map((item, indice) => ({ ...item, id: `item-${normalizar(asignatura || "ingles")}-${indice + 1}` }));
  return construirGenericos(naturaleza, area).map(([dimension, tipo, dificultad, aprendizaje, consigna, apoyo], indice) => ({ id: `item-${normalizar(area).replace(/\s+/g, "-") || "general"}-${indice + 1}`, seleccionado: true, dimension, tipo, dificultad, aprendizaje, consigna, apoyo, tema: dimension, respuestaEsperada: "Evidencia el aprendizaje descrito con una respuesta comprensible y acorde con la consigna.", materiales: tipo === "Escucha" ? "Guion de lectura docente y apoyos visuales" : "Hoja del estudiante y lápiz", criterios: `Comprende la consigna; evidencia ${aprendizaje.toLowerCase()}; comunica una respuesta comprensible.` }));
};

export const auditarDisenoDiagnostico = (items = [], naturaleza = NATURALEZA_GENERAL) => {
  const seleccionados = items.filter((item) => item.seleccionado);
  const porDificultad = { Activación: 0, Esencial: 0, Profundización: 0 };
  seleccionados.forEach((item) => { porDificultad[item.dificultad] = (porDificultad[item.dificultad] || 0) + 1; });
  const dimensiones = naturaleza.dimensiones.map((nombre) => ({ nombre, cantidad: seleccionados.filter((item) => item.dimension === nombre).length }));
  const alertas = [];
  if (!seleccionados.length) alertas.push("Selecciona al menos un ítem para continuar.");
  if (seleccionados.length > 12) alertas.push("La evaluación puede resultar extensa para el regreso de vacaciones.");
  if (!porDificultad.Activación) alertas.push("Agrega al menos una actividad de activación sencilla.");
  dimensiones.filter((item) => item.cantidad === 0).forEach((item) => alertas.push(`Falta evidencia de ${item.nombre}.`));
  return { total: seleccionados.length, porDificultad, dimensiones, alertas };
};

export const crearItemVacio = (naturaleza = NATURALEZA_GENERAL) => ({
  id: `item-personal-${Date.now()}`,
  seleccionado: true,
  dimension: naturaleza.dimensiones[0],
  tipo: naturaleza.tipos[0],
  dificultad: "Activación",
  aprendizaje: "",
  consigna: "",
  apoyo: "",
  respuestaEsperada: "",
  materiales: "",
  criterios: "",
});
