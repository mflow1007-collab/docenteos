// Reparto DETERMINISTA de contenido curricular por TEMA.
//
// El diseño MINERD trae el vocabulario y la gramática GLOBALES del grado (no por
// tema), pero el generador de unidades necesita `contenidosPorTema`: cada tema con
// su propio vocabulario/gramática, para planificar sin mezclar temas. Este módulo
// reparte por palabras clave — cada categoría de vocabulario ("Deportes:",
// "Alimentos:") y cada estructura gramatical se asigna al tema cuyas claves
// aparezcan en su texto. Determinista y reproducible (sin IA).
//
// Se comparte entre:
//  · scripts/convertir_curriculo_lenguas.mjs (mallas oficiales del repo)
//  · src/admin/pages/AdminBancoConocimiento.jsx (convertidor de PDF del Banco),
//    para garantizar contenidosPorTema aunque la IA no lo extraiga.

// Familias temáticas oficiales con sus palabras clave (en texto normalizado).
export const CLAVES_POR_TEMA = [
  { tema: "Identificación personal", claves: ["identificacion personal", "informacion personal", "nombre", "apellido", "nacionalidad", "edad", "estado civil", "presentar", "saludo", "despedida", "cortesia", "titulo", "apelativo", "pais", "continente", "numero", "fecha", "hora", "dia", "mes"] },
  { tema: "Relaciones humanas y sociales", claves: ["relaciones humana", "relaciones", "familia", "miembros de la familia", "emociones", "sentimiento", "estados de animo", "forma de ser", "formas de ser", "rasgos de caracter", "cualidades", "invitacion", "invitar", "opinar", "opinion", "reacciones"] },
  { tema: "Actividades de la vida diaria", claves: ["vida diaria", "vida cotidiana", "actividades cotidiana", "actividades diaria", "rutina", "quehaceres", "tareas del hogar", "momentos del dia", "agenda", "horario"] },
  { tema: "Vivienda, entorno y ciudad", claves: ["vivienda", "hogar", "casa", "mobiliario", "electrodomestico", "lugares de la vivienda", "lugares en la vivienda", "tipos de vivienda", "ciudad", "lugares en la ciudad", "establecimiento", "comercio", "direcciones", "vias", "senales", "monumento", "sitios de interes", "alojamiento", "objetos del hogar"] },
  { tema: "Escuela y educación", claves: ["escuela", "educacion", "estudios", "asignatura", "utiles escolares", "objetos del salon", "lugares en la escuela", "actividades escolares", "actividades en aula", "aula", "interactuar en el aula", "mandatos basicos"] },
  { tema: "Deporte, tiempo libre y recreación", claves: ["deporte", "tiempo libre", "recreacion", "ocio", "juego", "actividades recreativa", "actividades de recreacion", "actividades artistica", "musica", "genero musical", "generos musicales", "instrumento musical", "arte", "lugares de ocio"] },
  { tema: "Alimentación", claves: ["alimento", "alimentacion", "comida", "bebida", "menu", "restaurante", "receta", "preparacion de alimentos", "utensilios", "equipos y utensilios de cocina"] },
  { tema: "Salud y cuidados físicos", claves: ["salud", "cuidados fisico", "partes del cuerpo", "enfermedad", "dolencia", "sintoma", "medicamento", "medico", "especialidades medica", "procedimientos medico", "sensaciones fisica", "estados fisico", "dolor", "caracteristicas fisica", "rasgos fisico", "ropa", "accesorio", "talla", "tamano", "color"] },
  { tema: "Lengua y comunicación", claves: ["lengua y comunicacion", "lenguas y comunicacion", "comunicacion", "idioma", "medios de comunicacion", "genero literario", "elementos de una narracion", "reportar informacion", "relatar hechos"] },
  { tema: "Ciencia y tecnología", claves: ["ciencia", "tecnologia", "tecnologias", "equipos tecnologico", "uso de equipos", "derecho de autor", "medios de comunicacion", "equipos y materiales de oficina", "mobiliario del hogar y de la oficina"] },
  { tema: "Clima, condiciones atmosféricas y medioambiente", claves: ["clima", "condiciones atmosferica", "fenomeno", "medio ambiente", "medioambiente", "estaciones del ano", "temperatura", "accidentes geografico", "puntos cardinales", "unidades metrica", "medida"] },
  { tema: "Bienes y servicios", claves: ["bienes y servicios", "dinero", "formas de pago", "transaccion", "transporte", "medios de transporte", "profesion", "ocupacion", "trabajo", "comprar", "servicios de transporte", "civismo", "ciudadania", "problematicas sociales"] },
  { tema: "Viajes y turismo", claves: ["viaje", "viajes", "turismo", "lugares turistico", "acontecimiento", "celebracion", "ceremonia", "festividad", "tradicion", "evento", "eventos de la vida", "personajes celebre", "cultura", "actividades culturales", "manifestaciones artistica"] },
];

const normClave = (s = "") => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Palabras vacías que no aportan a la identidad del tema.
const STOP_TEMA = new Set(["y", "de", "la", "el", "los", "las", "en", "del", "e", "o", "a"]);
const palabrasTema = (s = "") => normClave(s).replace(/[^a-z\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP_TEMA.has(w));
// Dos temas son equivalentes si comparten al menos una palabra significativa con
// la misma raíz (prefijo de 5) — tolera plural/variantes ("lengua/lenguas",
// "medioambiente/medio ambiente").
const temasEquivalentes = (a, b) => {
  const pa = palabrasTema(a), pb = palabrasTema(b);
  if (!pa.length || !pb.length) return false;
  const raiz = (w) => w.slice(0, 5);
  const setA = new Set(pa.map(raiz));
  return pb.some((w) => setA.has(raiz(w)));
};

// Temas (de la lista oficial del grado) a los que pertenece un texto de contenido,
// por coincidencia de palabras clave. Puede ser más de uno (transversal). [] si nada.
const temasDeContenido = (texto, temasDelGrado) => {
  const t = normClave(texto);
  const encontrados = [];
  for (const { tema, claves } of CLAVES_POR_TEMA) {
    const temaDelGrado = temasDelGrado.find((tg) => temasEquivalentes(tg, tema));
    if (!temaDelGrado) continue; // la familia no aplica a este grado
    if (claves.some((k) => t.includes(k))) encontrados.push(temaDelGrado);
  }
  return [...new Set(encontrados)];
};

/**
 * Construye `contenidosPorTema`: un bloque por cada tema oficial del grado, con el
 * vocabulario/gramática/expresiones que le corresponden por palabras clave. El
 * contenido que no casa con ningún tema (transversal: saludos, números…) se añade a
 * TODOS los bloques para no perderlo y que cada tema sea usable. La unión de todos
 * los bloques contiene siempre TODO el contenido de entrada (cero pérdida).
 *
 * @returns Array de bloques con la forma que espera el generador de unidades:
 *   { tema, conceptos:{temas,vocabulario,gramatica,frases,sociolinguisticos},
 *     procedimientos:{funcionales,...}, actitudinales, actitudesValores }
 */
export const construirContenidosPorTema = ({
  temas = [], vocabulario = [], gramatica = [], expresiones = [],
  procedimientosFuncionales = [], actitudinales = [],
} = {}) => {
  if (!Array.isArray(temas) || !temas.length) return [];
  const bloques = temas.map((tema) => ({
    tema,
    conceptos: { temas: [tema], vocabulario: [], gramatica: [], frases: [], sociolinguisticos: [] },
    procedimientos: { funcionales: [...procedimientosFuncionales], discursivos: [], comprensionOralEscrita: [], produccionOral: [], produccionEscrita: [], items: [] },
    actitudinales: [...actitudinales],
    actitudesValores: [...actitudinales],
  }));
  const indicePorTema = new Map(temas.map((t, i) => [t, i]));
  const repartir = (items, campo) => {
    const comunes = [];
    for (const item of (items || [])) {
      if (!item) continue;
      const destinos = temasDeContenido(item, temas);
      if (destinos.length) {
        for (const d of destinos) {
          const idx = indicePorTema.get(d);
          if (idx != null) bloques[idx].conceptos[campo].push(item);
        }
      } else {
        comunes.push(item); // transversal → a todos
      }
    }
    for (const b of bloques) b.conceptos[campo].push(...comunes);
  };
  repartir(vocabulario, "vocabulario");
  repartir(gramatica, "gramatica");
  repartir(expresiones, "frases");
  return bloques;
};
