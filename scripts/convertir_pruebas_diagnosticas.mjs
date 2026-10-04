// Convierte docs/recursos/Pruebas_diagnosticas_primer_ciclo.json (texto extraído
// del PDF oficial del MINERD, por área→grado→páginas) a pruebas diagnósticas
// ESTRUCTURADAS del Banco de Pruebas Oficiales: un archivo por área+grado en
// src/data/diagnostico/pruebas-oficiales/, con estímulos e ítems separados.
//
// Uso:  node scripts/convertir_pruebas_diagnosticas.mjs [--out <dir>]
//   Sin --out escribe en src/data/diagnostico/pruebas-oficiales/
//
// NO toca red ni Firestore. Solo lee el JSON fuente y escribe archivos locales.
// La CLAVE de respuestas NO se deduce aquí (no hay en el PDF): queda claveEstado
// "sin_clave"; la deduce la IA bajo demanda (diagnosticoClaveService) y la
// confirma el admin antes de autocorregir.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FUENTE = join(ROOT, "docs/recursos/Pruebas_diagnosticas_primer_ciclo.json");
const outArg = process.argv.indexOf("--out");
const OUT = outArg > -1 ? process.argv[outArg + 1] : join(ROOT, "src/data/diagnostico/pruebas-oficiales");

const GRADO_SUFIJO = { 1: "1ro", 2: "2do", 3: "3ro", 4: "4to", 5: "5to", 6: "6to" };

// Limpieza defensiva de mojibake residual (el archivo viene en UTF-8 correcto,
// pero algunos símbolos del PDF quedan como secuencias sueltas).
const limpiar = (s = "") => String(s)
  .replace(/â€¦|â¦/g, "…")
  .replace(/â€"|â€“/g, "—")
  .replace(/â¢/g, "•")
  .replace(/â€œ|â€/g, '"')
  .replace(/Â¿/g, "¿").replace(/Â¡/g, "¡").replace(/Â/g, "")
  .replace(/­/g, "")          // soft hyphen
  .replace(/[ \t]+\n/g, "\n")
  .replace(/[ \t]{2,}/g, " ")
  .trim();

const slug = (s = "") => String(s).toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

// ─── Detección de ítems y opciones ───────────────────────────────────────────
// Un ítem real empieza con "N." o "N)" al inicio de línea (tras posibles espacios)
// y su número es el SIGUIENTE esperado en la secuencia 1..15. Así se descartan las
// numeraciones internas de un estímulo (p. ej. un informe con párrafos 1..5, o
// sub-opciones), que romperían el conteo.
const OPCION_RE = /^\s*([a-dA-D])[\)\.]\s+(.+)$/;
// Inicio de ítem N: "N." o "N)" — tolera una sub-parte "N.A)"/"N.B)" (algunos
// grados parten un ítem en un mini-estímulo "N.A)" + la pregunta "N.B)").
const inicioItemRe = (n) => new RegExp(`^\\s*${n}(?:[\\.\\)]|\\.[A-Da-d]\\)\\.?)\\s+`);

// Opciones EN LÍNEA (formato de Matemática/Naturaleza): "A) 20  B) 24  C) 28  D) 32".
// Devuelve ["a) 20","b) 24",...] si la línea contiene >=2 marcadores a)-d)/A)-D).
const partirOpcionesEnLinea = (linea) => {
  const marcadores = [...linea.matchAll(/([a-dA-D])[\)\.]\s+/g)];
  if (marcadores.length < 2) return null;
  // Verifica que las letras sean consecutivas empezando en a/A (evita falsos positivos).
  const letras = marcadores.map((m) => m[1].toLowerCase());
  const esperadas = ["a", "b", "c", "d"].slice(0, letras.length);
  if (letras.join("") !== esperadas.join("")) return null;
  const opciones = [];
  for (let i = 0; i < marcadores.length; i += 1) {
    const ini = marcadores[i].index + marcadores[i][0].length;
    const fin = i + 1 < marcadores.length ? marcadores[i + 1].index : linea.length;
    const txt = linea.slice(ini, fin).trim();
    if (txt) opciones.push(`${letras[i]}) ${limpiar(txt)}`);
  }
  return opciones.length >= 2 ? opciones : null;
};

// Instrucción numerada del preámbulo ("1. Lee cuidadosamente…", "2. Marca con
// una X…"): son líneas cortas que empiezan con verbo imperativo de instrucción,
// NO situaciones-problema. Se usan para NO confundirlas con el ítem 1 real.
const ES_INSTRUCCION_NUMERADA = (linea) =>
  /^\s*\d+[\.\)]\s+(Lee|Marca|Catorce|No utilices|Dispones|Selecciona|Responde|Observa las instrucciones)\b/i.test(linea);

// Marca de encabezado/instrucciones que NO es ítem ni estímulo útil (se omite del
// cuerpo de estímulos para no ensuciar). El resto del texto SÍ es estímulo.
const ES_RUIDO = (linea) => /^(Evaluación Diagnóstica|Viceministerio|Dirección de Educación|Departamento del|Área de|EVALUACIÓN DIAGNÓSTICA|Nombre del estudiante|Centro educativo|Sección:|No\. Orden|Regional:|Distrito:|Grado y Sección|Fecha:|DATOS DEL|¡Hola|Nos alegra|INSTRUCCIONES|Instrucciones|Lee (con atención|cuidadosamente|detenidamente)|Tiempo:|Importante:|Procura|En esta evaluación|A continuación|¡Mucho éxito|\d+\s*\/\s*\d+$|\d+ de \d+$)/i.test(linea.trim());

// Clasifica el estímulo por palabras de su encabezado.
const tipoEstimulo = (texto = "") => {
  const t = texto.toLowerCase();
  if (/noticia/.test(t)) return "noticia";
  if (/gu[ií]a tur[ií]stica/.test(t)) return "guia_turistica";
  if (/informe de lectura/.test(t)) return "informe";
  if (/cuento|fragmento del cuento|antolog/.test(t)) return "cuento";
  if (/d[eé]cima|poema|verso/.test(t)) return "poema";
  if (/art[ií]culo/.test(t)) return "articulo";
  if (/cr[oó]nica/.test(t)) return "cronica";
  if (/infograf/.test(t)) return "infografia";
  if (/mapa/.test(t)) return "mapa";
  if (/tabla|gr[aá]fico|gr[aá]fica/.test(t)) return "grafico";
  if (/di[aá]logo/.test(t)) return "dialogo";
  if (/constituci[oó]n|art[ií]culo \d/.test(t)) return "documento";
  return "texto";
};

// ─── Parser de una prueba (área+grado) ────────────────────────────────────────
function parsearPrueba(ev) {
  // Texto completo de las páginas de evaluación (une lo partido por página).
  const paginasEval = ev.paginas.filter((p) => p.tipo === "evaluacion");
  const lineas = paginasEval.flatMap((p) => String(p.texto).split("\n"));

  // Imágenes no transcritas (para advertir "esta prueba usa gráficos del PDF").
  const totalImagenes = ev.paginas.reduce((acc, p) => acc + (p.elementos_visuales_no_transcritos?.length || 0), 0);

  const items = [];
  const estimulos = [];
  let estimuloBuf = [];        // texto de estímulo acumulado antes del próximo ítem
  let itemActual = null;       // ítem en construcción (acumula enunciado multilínea)
  let esperado = 1;            // siguiente número de ítem esperado (1..N)
  let empezaronItems = false;  // true tras capturar el ítem 1 real

  const cerrarEstimulo = () => {
    const texto = limpiar(estimuloBuf.filter((l) => !ES_RUIDO(l)).join("\n"));
    estimuloBuf = [];
    if (texto.length < 40) return null;  // demasiado corto: no es un estímulo real
    const id = `E${estimulos.length + 1}`;
    estimulos.push({ id, tipo: tipoEstimulo(texto), texto, requiereImagen: false });
    return id;
  };

  const cerrarItem = () => {
    if (!itemActual) return;
    // Separa enunciado y opciones de las líneas acumuladas del ítem.
    const opciones = [];
    const enunciadoLineas = [];
    for (const l of itemActual.lineas) {
      const enLinea = partirOpcionesEnLinea(l);
      const m = l.match(OPCION_RE);
      if (enLinea) opciones.push(...enLinea);              // "A) .. B) .. C) .." en una línea
      else if (m) opciones.push(`${m[1].toLowerCase()}) ${limpiar(m[2])}`);  // una opción por línea
      else if (!ES_RUIDO(l)) enunciadoLineas.push(l);
    }
    let enunciado = limpiar(enunciadoLineas.join(" "));
    // Caso especial: ítem con una LISTA a)-d) dentro del enunciado + las opciones
    // reales a)-d) (p. ej. "acciones a)..d) / ¿cuáles? a) 1 y 2 b) 1 y 4..."). El
    // parser junta 8 opciones; nos quedamos con el ÚLTIMO grupo de 4 (las reales)
    // y devolvemos el primer grupo al enunciado como lista.
    if (opciones.length > 4) {
      const reales = opciones.slice(-4);
      const lista = opciones.slice(0, opciones.length - 4);
      enunciado = limpiar(`${enunciado}\n${lista.join("  ")}`);
      opciones.length = 0;
      opciones.push(...reales);
    }
    items.push({
      numero: itemActual.numero,
      estimuloId: itemActual.estimuloId || null,
      tipo: opciones.length >= 2 ? "opcion_multiple" : "abierta",
      enunciado,
      opciones: opciones.length >= 2 ? opciones : [],
      claveIA: "", claveEstado: "sin_clave",   // la deduce la IA; el admin confirma
      respuestaAbiertaGuia: "",
      requiereImagen: false,
      competencia: "", indicador: "",           // se vincula en Fase 3
    });
    itemActual = null;
  };

  for (const lineaRaw of lineas) {
    const linea = lineaRaw.replace(/\s+$/, "");
    if (!linea.trim()) { if (itemActual) itemActual.lineas.push(""); continue; }

    // Instrucción numerada del preámbulo: se descarta (no es ítem ni estímulo).
    if (!empezaronItems && ES_INSTRUCCION_NUMERADA(linea)) continue;

    // ¿Empieza el SIGUIENTE ítem esperado? (número monótono creciente)
    if (inicioItemRe(esperado).test(linea)) {
      // Sub-parte "N.A)" que es un mini-estímulo (p. ej. "11.A) Lee el siguiente
      // texto…"): NO es el ítem; acumúlala como estímulo y sigue esperando N
      // (la pregunta real vendrá como "N.B)").
      const sinNumero = linea.replace(inicioItemRe(esperado), "");
      const esSubEstimulo = /\.[Aa]\)/.test(linea) && /^(lee|observa|a partir|el siguiente|la siguiente|texto)/i.test(sinNumero.trim());
      if (esSubEstimulo) { estimuloBuf.push(sinNumero); continue; }
      if (esperado === 1) empezaronItems = true;
      // Antes del primer ítem, lo acumulado es estímulo. Entre ítems, el estímulo
      // nuevo (si lo hubo) ya se cerró al detectar su encabezado; aquí cerramos el
      // ítem previo.
      if (itemActual) cerrarItem();
      const estimuloId = estimuloBuf.length ? cerrarEstimulo() : (estimulos.length ? estimulos[estimulos.length - 1].id : null);
      itemActual = { numero: esperado, estimuloId, lineas: [linea.replace(inicioItemRe(esperado), "")] };
      esperado += 1;
      continue;
    }

    // Línea de opción del ítem actual (una por línea, o varias en línea).
    if (itemActual && (OPCION_RE.test(linea) || partirOpcionesEnLinea(linea))) { itemActual.lineas.push(linea); continue; }

    // Si no hay ítem abierto, todo es estímulo (texto base). Si hay ítem abierto y
    // la línea no es opción ni nuevo ítem, puede ser continuación del enunciado o
    // el inicio de un nuevo estímulo para el próximo bloque. Heurística: si parece
    // encabezado de estímulo ("Lee el siguiente", "Fragmento", "Texto:", etc.),
    // cerramos el ítem y empezamos a acumular estímulo.
    const esEncabezadoEstimulo = /^(lee |observa |a partir |fragmento|texto:|bloque|informe|cr[oó]nica|art[ií]culo|d[eé]cima|la |el )/i.test(linea.trim()) && linea.trim().length > 25;
    if (itemActual && esEncabezadoEstimulo && itemActual.lineas.some((l) => OPCION_RE.test(l))) {
      cerrarItem();
      estimuloBuf.push(linea);
    } else if (itemActual) {
      itemActual.lineas.push(linea);
    } else {
      estimuloBuf.push(linea);
    }
  }
  if (itemActual) cerrarItem();

  // Reparte la señal de imagen: si la prueba tiene imágenes no transcritas, marca
  // requiereImagen en los estímulos (no sabemos a qué ítem exacto, pero el docente
  // debe mirar el PDF). Conservador: marca a nivel de prueba en metadatos.
  const grado = GRADO_SUFIJO[ev.grado] || String(ev.grado);
  return {
    metadatos: {
      area: ev.area, grado, nivel: "Secundario", institucion: "MINERD",
      anoEscolar: "2026-2027", tiempoMinutos: 90, totalItems: items.length,
      fuente: "Pruebas diagnósticas de las áreas objeto de Pruebas Nacionales, primer ciclo",
      imagenesEnPDF: totalImagenes, oficial: true,
    },
    estimulos,
    items,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const fuente = JSON.parse(readFileSync(FUENTE, "utf8"));
mkdirSync(OUT, { recursive: true });

let okCount = 0;
const avisos = [];
for (const ev of fuente.evaluaciones) {
  const prueba = parsearPrueba(ev);
  const grado = prueba.metadatos.grado;
  const nombre = `prueba_${slug(ev.area)}_${grado}_secundaria.json`;
  writeFileSync(join(OUT, nombre), JSON.stringify(prueba, null, 2) + "\n", "utf8");

  const nItems = prueba.items.length;
  const nAbiertos = prueba.items.filter((i) => i.tipo === "abierta").length;
  const nEstim = prueba.estimulos.length;
  const estado = nItems >= 10 && nItems <= 16 ? "ok" : "REVISAR";
  if (estado === "ok") okCount += 1;
  else avisos.push(`${ev.area} ${grado}: ${nItems} ítems (esperado ~15) — revisar a mano`);
  console.log(`${estado === "ok" ? "✓" : "⚠"} ${nombre} — ${nItems} ítems (${nAbiertos} abiertos), ${nEstim} estímulos, ${prueba.metadatos.imagenesEnPDF} imágenes en PDF`);
}

console.log(`\n${okCount}/${fuente.evaluaciones.length} pruebas con conteo esperado.`);
if (avisos.length) { console.log("\nAVISOS:"); avisos.forEach((a) => console.log("  • " + a)); }
console.log(`\nSalida: ${OUT}`);
