// Convierte src/data/curriculo/curriculo-lenguas-extranjeras-secundaria-2023.json
// (estructura literal del PDF: idiomas → ciclos → mallas_curriculares por grado, con
// los criterios de evaluación aparte en aportes_a_las_competencias_fundamentales)
// al formato de MALLA del Banco de Conocimiento (validateJsonSobre), un archivo por
// grado, listo para importar por la vía LITERAL ("Leer JSON").
//
// Uso:  node scripts/convertir_curriculo_lenguas.mjs [--out <dir>]
//   Sin --out escribe en src/data/curriculo/mallas/
//
// NO toca red ni Firestore. Solo lee el JSON fuente y escribe archivos locales.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { construirContenidosPorTema } from "../src/data/repartoContenidoPorTema.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FUENTE = join(ROOT, "src/data/curriculo/curriculo-lenguas-extranjeras-secundaria-2023.json");
const outArg = process.argv.indexOf("--out");
const OUT = outArg > -1 ? process.argv[outArg + 1] : join(ROOT, "src/data/curriculo/mallas");

// "1er. Grado" → "1ro", etc. (el formato de grade que usa el Banco).
const GRADO_A_SUFIJO = {
  "1er. Grado": "1ro", "2do. Grado": "2do", "3er. Grado": "3ro",
  "4to. Grado": "4to", "5to. Grado": "5to", "6to. Grado": "6to",
};
// Clave de columna por grado dentro de aportes/competencias_especificas_por_grado.
const GRADO_A_COLUMNA = {
  "1ro": "Primero", "2do": "Segundo", "3ro": "Tercero",
  "4to": "Cuarto", "5to": "Quinto", "6to": "Sexto",
};
const CICLO_DE_GRADO = { "1ro": "Primer Ciclo", "2do": "Primer Ciclo", "3ro": "Primer Ciclo",
  "4to": "Segundo Ciclo", "5to": "Segundo Ciclo", "6to": "Segundo Ciclo" };
const PREFIJO_IDIOMA = { ingles: "ING", frances: "FRA" };
const SUBJECT = { ingles: "Ingles", frances: "Frances" };

// Reparto de contenido por TEMA: lógica compartida con el convertidor de PDF del
// Banco (src/data/repartoContenidoPorTema.js), única fuente de verdad del mapa de
// palabras clave por tema. Así el script y la web reparten idéntico.

// Normaliza para comparar competencias fundamentales pese a erratas del PDF
// ("Pensamiento Lógico, Crítico y Creativo" vs "...Creativo y Crítico",
//  "Ambientaly de la Salud", etc.).
const normCF = (s = "") => s.toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z]/g, "");
const claveCF = (cf = "") => {
  const n = normCF(cf);
  if (n.includes("comunicativa")) return "comunicativa";
  if (n.includes("pensamiento")) return "pensamiento";
  if (n.includes("resolucion")) return "resolucion";
  if (n.includes("etica")) return "etica";
  if (n.includes("cientifica")) return "cientifica";
  if (n.includes("ambiental")) return "ambiental";
  if (n.includes("desarrollo") || n.includes("personalyespiritual")) return "desarrollo";
  return n;
};

// Encabezados de sección del bloque "conceptos" del PDF. Cada sección corre desde
// su encabezado hasta el siguiente. Los encabezados se matchean como LÍNEA COMPLETA
// (con ":" y espacios finales opcionales) para NO confundir una entrada de
// vocabulario que empieza igual ("Expresiones de cortesía:", "Vocabulario básico:")
// con un encabezado de sección. Las únicas colas admitidas son las que el PDF pega
// de verdad al título: "Vocabulario y expresiones" (francés fusiona ambas bajo la
// clave `vocabulario`) y "Gramática Oraciones:" (variante del título de gramática).
const ENCABEZADOS_CONCEPTOS = [
  { clave: "temas", re: /^temas\s*:?\s*$/i },
  { clave: "vocabulario", re: /^vocabulario(\s+y\s+expresiones)?\s*:?\s*$/i },
  { clave: "expresiones", re: /^expresiones\s*:?\s*$/i },
  { clave: "gramatica", re: /^gram[aá]tica(\s+oraciones)?\s*:?\s*$/i },
];
// La maquetación del PDF a veces antepone una o dos viñetas al propio título de
// sección ("• Vocabulario y expresiones", "• •Actividades…"). Se quitan antes de
// testear si la línea es un encabezado, sin alterar la línea para la extracción.
const sinVinetasIniciales = (linea) => linea.replace(/^(?:•\s*)+/, "").trim();
const encabezadoDeLinea = (linea) => {
  const limpia = sinVinetasIniciales(linea);
  return ENCABEZADOS_CONCEPTOS.find((h) => h.re.test(limpia));
};

// ¿Una línea SIN viñeta inicia un ÍTEM nuevo, o continúa el anterior (ejemplo/texto
// partido por maquetación)? El PDF marca las estructuras gramaticales de dos formas:
//  · con etiqueta y dos puntos: "Artículos contractos :", "Conjugación:"
//  · con un sustantivo de categoría gramatical al frente: "Oraciones negativas…",
//    "Presente de indicativo…", "Futuro próximo…", "Imperativo…", "Preposiciones…"
// Las CONTINUACIONES son ejemplos en el idioma meta o fragmentos: empiezan en
// minúscula, en signo de puntuación, o con un pronombre/artículo francés de ejemplo.
const CATEGORIAS_GRAMATICA = /^(Oraci[oó]n|Oraciones|Presente|Pasado|Pret[eé]rito|Futuro|Imperativo|Condicional|Subjuntivo|Conjugaci[oó]n|Art[ií]culos?|Preposici|Adverbio|Adjetivo|Pronombre|Sustantivo|Verbos?|Conectores|Marcadores|Negativ|Interrogativ|Exclamativ|Imperativ|Afirmativ|Comparativ|Superlativ|Presentativo|Expresi[oó]n)/;
const EJEMPLO_FRANCES = /^(Je |Tu |Il |Elle |On |Nous |Vous |Ils |Elles |C['’]est|Qu['’]|Quel|Quelle|Comment|Combien|Pourquoi|Quand|Où|Prenez|Continuez|Cliquez|Traversez|Ouvre|Allumez|Maintenant|Demain|Aujourd|À |Au |Aux )/;
const pareceContinuacion = (linea) => {
  if (!linea) return true;
  const c = linea[0];
  if (c === c.toLowerCase() && c !== c.toUpperCase()) return true; // empieza minúscula
  if ("?!.,;)«»…".includes(c)) return true;                        // empieza en signo
  if (EJEMPLO_FRANCES.test(linea)) return true;                    // oración de ejemplo
  return false;
};
// Inicia ítem si tiene etiqueta con dos puntos, o empieza con categoría gramatical,
// y NO parece una continuación/ejemplo.
const iniciaItem = (linea) =>
  !pareceContinuacion(linea) && (/^[A-ZÀ-Ý][^:]{2,45}\s?:/.test(linea) || CATEGORIAS_GRAMATICA.test(linea));

// Ensambla las líneas de una sección en ítems, respetando la maquetación del PDF:
//  · viñeta "•"            → nuevo ítem
//  · sin viñeta + etiqueta → nuevo ítem (gramática en prosa)
//  · sin viñeta, no etiqueta → continuación del ítem anterior
// Si no hay ítem previo al que anexar, la línea arranca uno (no se pierde nada).
const empujarLinea = (items, linea) => {
  if (linea.startsWith("•")) {
    items.push(sinVinetasIniciales(linea));
  } else if (items.length && !iniciaItem(linea)) {
    items[items.length - 1] = `${items[items.length - 1]} ${linea}`.trim();
  } else {
    items.push(linea);
  }
};

// Red de seguridad HONESTA: toda la sección unida en un texto legible, uniendo las
// líneas partidas por maquetación. Nunca pierde ni corrompe contenido; sirve cuando
// la segmentación en ítems de un grado no sea perfecta.
const unirComoTexto = (items = []) => items.join(" ").replace(/\s+/g, " ").trim();

// Extrae una SECCIÓN del bloque "conceptos" (Temas, Vocabulario, Expresiones o
// Gramática): las líneas entre su encabezado y el siguiente encabezado conocido.
// El texto que venga PEGADO al encabezado ("Gramática Oraciones:") se conserva
// como primer elemento. Devuelve las viñetas limpias (sin el "• ").
const extraerSeccion = (conceptosLineas = [], claveSeccion) => {
  const objetivo = ENCABEZADOS_CONCEPTOS.find((h) => h.clave === claveSeccion);
  if (!objetivo) return [];
  const items = [];
  let dentro = false;
  for (const raw of conceptosLineas) {
    const linea = String(raw).trim();
    if (!linea) continue;
    const head = encabezadoDeLinea(linea);
    if (head && head.clave === claveSeccion) { dentro = true; continue; }
    if (!dentro) continue;
    if (head) break; // llegó otro encabezado conocido
    empujarLinea(items, linea);
  }
  return items.filter(Boolean);
};

// Reúne los indicadores de logro partidos por la maquetación del PDF: una línea
// que empieza en minúscula es continuación de la anterior (el PDF cortó la frase,
// típicamente en "…lógico-" / "verbal…"). Devuelve la lista con cada indicador
// completo en un solo elemento. Evita indicadores espurios ("verbal para…") y que
// el reparto en tríadas descarte los indicadores reales del final.
// Repara el fragmento huérfano "verbal para responder/comprender…" que aparece en
// el indicador COMPR de la competencia de Pensamiento Lógico-Verbal (inglés 6to,
// francés 2do y 4to): la conversión del PDF perdió su arranque ("…utilizando el
// pensamiento lógico-"), que quedó pegado al indicador anterior. Se antepone ese
// arranque literal, sin duplicar el verbo que el fragmento ya trae.
const repararFragmentoLogicoVerbal = (t) => {
  // El fragmento ya trae el verbo y el complemento ("verbal para responder/comprender
  // …"); solo le falta el arranque "…utilizando el pensamiento lógico-" que el PDF
  // dejó pegado al indicador anterior. Se antepone únicamente ese arranque para no
  // duplicar el verbo (así no queda "Responde … para responder …").
  if (/^verbal para (responder|comprender)\b/i.test(t)) {
    return `Utilizando el pensamiento lógico-${t}`;
  }
  return t;
};

const unirIndicadoresPartidos = (lineas = []) => {
  const unidos = [];
  for (const linea of lineas) {
    const t = String(linea).trim();
    if (!t) continue;
    const c = t[0];
    const empiezaMinuscula = c === c.toLowerCase() && c !== c.toUpperCase();
    const previo = unidos[unidos.length - 1] || "";
    // La continuación se une al anterior SOLO si este quedó cortado a media frase
    // (no termina en signo de cierre). Así "…elementos lógico" + "verbales básicos…"
    // se reúnen, pero una línea que empieza en minúscula tras un indicador ya
    // cerrado (termina en ".") NO se absorbe: es un indicador partido aparte.
    const previoCortado = previo && !/[.!?:;]$/.test(previo);
    if (empiezaMinuscula && previoCortado) {
      unidos[unidos.length - 1] = `${previo} ${t}`.trim();
    } else {
      unidos.push(repararFragmentoLogicoVerbal(t));
    }
  }
  return unidos;
};

// Los TEMAS oficiales son la sección "Temas". Algunos grados (p. ej. francés 6to)
// omiten el encabezado "Temas:" y arrancan directo con las viñetas de tema; en ese
// caso se toman las viñetas iniciales hasta el primer encabezado conocido.
const extraerTemas = (conceptosLineas = []) => {
  const porEncabezado = extraerSeccion(conceptosLineas, "temas");
  if (porEncabezado.length) return porEncabezado;
  const items = [];
  for (const raw of conceptosLineas) {
    const linea = String(raw).trim();
    if (!linea) continue;
    if (encabezadoDeLinea(linea)) break; // llegó "Vocabulario…"/"Gramática": fin de temas
    empujarLinea(items, linea);
  }
  return items.filter(Boolean);
};

const fuente = JSON.parse(readFileSync(FUENTE, "utf8"));
mkdirSync(OUT, { recursive: true });

const resumen = [];

for (const idiomaKey of ["ingles", "frances"]) {
  const idioma = fuente.idiomas[idiomaKey];
  const pref = PREFIJO_IDIOMA[idiomaKey];

  for (const ciclo of idioma.ciclos) {
    // Índice de criterios por competencia fundamental (vienen a nivel de CICLO).
    const criteriosPorCF = {};
    for (const aporte of ciclo.aportes_a_las_competencias_fundamentales || []) {
      criteriosPorCF[claveCF(aporte.competencia_fundamental)] =
        (aporte.criterios_de_evaluacion || []).filter(Boolean);
    }

    for (const malla of ciclo.mallas_curriculares || []) {
      const grade = GRADO_A_SUFIJO[malla.grado];
      if (!grade) { console.warn("grado no mapeado:", malla.grado); continue; }
      const nGrado = grade.replace(/\D/g, ""); // "1", "2"...

      const compsFuente = malla.competencias_especificas_del_grado || [];
      // La maquetación del PDF parte algunos indicadores en dos líneas: la segunda
      // empieza en minúscula (p. ej. "…pensamiento lógico-" / "verbal para responder…").
      // Se reunen esas continuaciones con su indicador para no generar indicadores
      // espurios ni perder los del final por el reparto en tríadas. (Sin esto,
      // inglés 5to/6to y francés 2do salían con 22-23 líneas, con basura a media frase.)
      const indicadores = unirIndicadoresPartidos(
        (malla.indicadores_de_logro || []).map((d) => String(d).trim()).filter(Boolean)
      );

      // El PDF trae ~21 indicadores por grado en el mismo orden de las 7 CF
      // (normalmente 3 por competencia: comprensión, producción, interacción). Se
      // reparten en bloques de 3 para anidarlos bajo su competencia.
      const competencias = compsFuente.map((comp, i) => {
        const cf = comp.competencia_fundamental;
        const ck = claveCF(cf);
        const idComp = `${pref}-${nGrado}-C${String(i + 1).padStart(2, "0")}`;
        const bloque = indicadores.slice(i * 3, i * 3 + 3);
        return {
          id: idComp,
          fundamental: cf,
          competenciaFundamental: cf,
          especificaGrado: comp.competencia_especifica_del_grado || "",
          descripcion: comp.competencia_especifica_del_grado || "",
          indicadoresLogro: bloque.map((desc, j) => ({
            id: `${pref}-${nGrado}-I${String(i * 3 + j + 1).padStart(2, "0")}`,
            descripcion: desc,
            competenciaId: idComp,
          })),
          criteriosEvaluacion: criteriosPorCF[ck] || [],
        };
      });

      // Listas raíz (compatibilidad con el contador de los 3 orígenes).
      const indicadoresLogroRaiz = competencias.flatMap((c) => c.indicadoresLogro);
      const criteriosRaiz = [...new Set(competencias.flatMap((c) => c.criteriosEvaluacion))];

      // Contenidos: se conservan las líneas literales del PDF (con sus saltos de
      // maquetación). El validador (validateJsonSobre) lee conceptuales/procedimentales
      // desde `contenidosGenerales`, los temas desde la raíz `temas`, y los
      // actitudinales desde `contenidos.actitudesValores`.
      const contenidos = malla.contenidos || {};
      const conceptosLineas = (contenidos.conceptos || []).map((s) => String(s).trim()).filter(Boolean);
      const procedLineas = (contenidos.procedimientos || []).map((s) => String(s).trim()).filter(Boolean);
      const actitudLineas = (contenidos.actitudes_y_valores || []).map((s) => String(s).trim()).filter(Boolean);
      // Temas oficiales: las viñetas del bloque "Temas" (hasta el sub-encabezado
      // "Vocabulario"). Son las líneas con viñeta antes de esa marca.
      const temas = extraerTemas(conceptosLineas);
      // Secciones conceptuales separadas (el contrato del Banco exige vocabulario
      // y gramática oficiales bajo contenidos.conceptos.{vocabulario,gramatica}).
      const vocabulario = extraerSeccion(conceptosLineas, "vocabulario");
      const expresiones = extraerSeccion(conceptosLineas, "expresiones");
      const gramatica = extraerSeccion(conceptosLineas, "gramatica");
      // Reparto por tema (lo que el generador de unidades necesita): cada tema con
      // su vocabulario/gramática por palabras clave; lo transversal va a todos.
      const contenidosPorTema = construirContenidosPorTema({
        temas, vocabulario, gramatica, expresiones,
        procedimientosFuncionales: procedLineas,
        actitudinales: actitudLineas,
      });

      const sobre = {
        schemaVersion: "1.3",
        level: "Secundaria",
        cycle: CICLO_DE_GRADO[grade],
        grade,
        area: "Lenguas Extranjeras",
        subject: SUBJECT[idiomaKey],
        contentType: "malla_curricular",
        contentId: `malla-${idiomaKey}-${grade}-secundaria-2023`,
        metadata: {
          fuente: "Adecuación Curricular Nivel Secundario MINERD 2023",
          paginas: malla.paginas_documento || null,
          mcer: (fuente.alineacion_mcer?.niveles_por_grado || [])
            .find((n) => n.grado === grade && n.nivel_y_ciclo?.includes("Secundario"))?.[idiomaKey] || null,
        },
        competenciasFundamentales: competencias.map((c) => c.competenciaFundamental),
        competencias,
        indicadoresLogro: indicadoresLogroRaiz,
        indicadores: indicadoresLogroRaiz,
        criteriosEvaluacion: criteriosRaiz,
        temas,
        // Contenido segmentado POR TEMA (lo exige el generador de unidades para
        // planificar cada tema con su propia gramática/vocabulario, sin mezclar).
        contenidosPorTema,
        // El validador lee conceptuales/procedimentales/actitudinales desde aquí.
        contenidosGenerales: {
          conceptuales: conceptosLineas,
          procedimentales: procedLineas,
          actitudinales: actitudLineas,
          actitudesValores: actitudLineas,
        },
        // Contrato del Banco (curricularSchema): conceptos SEPARADOS en vocabulario
        // y gramática oficiales. `*Texto` son la red de seguridad (todo el contenido
        // unido y legible, sin pérdida) por si la segmentación en ítems de un grado
        // no fuera perfecta; `lineas` son las líneas crudas del PDF para trazabilidad.
        contenidos: {
          conceptos: {
            vocabulario,
            gramatica,
            expresiones,
            vocabularioTexto: unirComoTexto(vocabulario),
            gramaticaTexto: unirComoTexto(gramatica),
            lineas: conceptosLineas,
          },
          procedimientos: procedLineas,
          actitudesValores: actitudLineas,
        },
      };

      const nombre = `malla_${idiomaKey}_${grade}_secundaria_2023.json`;
      writeFileSync(join(OUT, nombre), JSON.stringify(sobre, null, 2) + "\n");
      resumen.push({
        archivo: nombre,
        competencias: competencias.length,
        indicadores: indicadoresLogroRaiz.length,
        criterios: criteriosRaiz.length,
      });
    }
  }
}

console.log(`Escritas ${resumen.length} mallas en ${OUT}\n`);
console.table(resumen);

// ─── Módulo derivado compacto para el diagnóstico (Paso 3) ───────────────────
// Expone SOLO los indicadores oficiales por idioma+grado (no las mallas enteras),
// para que referenciaLocal del diagnóstico ofrezca los 21 indicadores reales
// como respaldo cuando la malla no está en Firestore. Se regenera con este script.
const indicadoresPorIdiomaGrado = {};
for (const idiomaKey of ["ingles", "frances"]) {
  const idioma = fuente.idiomas[idiomaKey];
  const subject = SUBJECT[idiomaKey];
  indicadoresPorIdiomaGrado[subject] = {};
  for (const ciclo of idioma.ciclos) {
    for (const malla of ciclo.mallas_curriculares || []) {
      const grade = GRADO_A_SUFIJO[malla.grado];
      if (!grade) continue;
      const comps = malla.competencias_especificas_del_grado || [];
      // Misma unión de indicadores partidos que en las mallas, para no exponer
      // fragmentos a media frase ni descontar indicadores del final.
      const indics = unirIndicadoresPartidos(
        (malla.indicadores_de_logro || []).map((d) => String(d).trim()).filter(Boolean)
      );
      // Empareja cada indicador con su competencia (bloques de 3).
      indicadoresPorIdiomaGrado[subject][grade] = indics.map((descripcion, i) => ({
        descripcion,
        competencia: comps[Math.floor(i / 3)]?.competencia_fundamental || "",
      }));
    }
  }
}
const modulo = `// GENERADO por scripts/convertir_curriculo_lenguas.mjs — no editar a mano.
// Indicadores de logro OFICIALES (MINERD 2023) por asignatura y grado, para el
// respaldo del diagnóstico cuando la malla no está en el Banco de Conocimiento.
// Fuente: src/data/curriculo/curriculo-lenguas-extranjeras-secundaria-2023.json

export const INDICADORES_OFICIALES_IDIOMAS = ${JSON.stringify(indicadoresPorIdiomaGrado, null, 2)};

const TABLA_GRADO = {
  "1ro": "1ro", primero: "1ro", first: "1ro", "1": "1ro",
  "2do": "2do", segundo: "2do", second: "2do", "2": "2do",
  "3ro": "3ro", tercero: "3ro", third: "3ro", "3": "3ro",
  "4to": "4to", cuarto: "4to", fourth: "4to", "4": "4to",
  "5to": "5to", quinto: "5to", fifth: "5to", "5": "5to",
  "6to": "6to", sexto: "6to", sixth: "6to", "6": "6to",
};
const normGrado = (g = "") => TABLA_GRADO[String(g).toLowerCase().trim().split(/\\s+/)[0]] || "";
const normAsig = (a = "") => /fran|french/i.test(a) ? "Frances" : "Ingles";

/** Devuelve los 21 indicadores oficiales del idioma+grado, o [] si no hay. */
export const getIndicadoresOficialesIdioma = (asignatura, grado) => {
  const g = normGrado(grado);
  const banco = INDICADORES_OFICIALES_IDIOMAS[normAsig(asignatura)] || {};
  return banco[g] || [];
};
`;
writeFileSync(join(ROOT, "src/data/indicadoresIdiomasOficiales.js"), modulo);
console.log("\nMódulo derivado: src/data/indicadoresIdiomasOficiales.js");
