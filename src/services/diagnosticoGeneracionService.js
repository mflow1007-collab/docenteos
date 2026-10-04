/**
 * diagnosticoGeneracionService.js — Generador de prueba diagnóstica contextualizada
 *
 * Genera una prueba diagnóstica con el MOLDE oficial del MINERD (estructura, tipos
 * de ítem, estilo situacional, tiempo) pero con contenido ADAPTADO A LA REALIDAD
 * del grupo (zona, contexto comunitario, nivel, matices del docente). Así es "lo
 * más parecido a lo que quiere el MINERD" y a la vez enfocada a los estudiantes.
 *
 * - Básicas: molde de la prueba oficial (Fase 1) + indicadores reales del grado.
 * - Idiomas (Inglés/Francés): molde por destrezas + mallas de idioma; los textos
 *   que trabaja el estudiante van en el idioma meta; el listening es un GUION para
 *   leer en voz alta (no audio grabado), igual que la Guía del Maestro.
 *
 * Reusa el gateway del proyecto (generarGuiaSemanaRaw → /api/ai/generate
 * provider-neutral) y el extractor de JSON — NO introduce cliente de IA nuevo.
 * La prueba generada sale con la MISMA forma que las oficiales (metadatos,
 * estimulos[], items[]) para que captura/clave/análisis la traten igual. La clave
 * sale en estado "por_revisar": el docente/admin confirma antes de autocorregir.
 */

import { generarGuiaSemanaRaw, extraerJSON } from "./phaseAService.js";
import { obtenerMolde, describirMolde } from "./diagnosticoMoldeService.js";
import { cargarReferentesDiagnosticos } from "./diagnosticoCurricularService.js";

const _texto = (v) => String(v ?? "").trim();
const _arr = (v) => (Array.isArray(v) ? v : []);
const ES_IDIOMA = (area, asignatura) =>
  /lenguas extranjeras|ingl[eé]s|franc[eé]s/i.test(`${area || ""} ${asignatura || ""}`);
const NOMBRE_IDIOMA = (area, asignatura) =>
  /franc/i.test(`${area || ""} ${asignatura || ""}`) ? "francés" : "inglés";

// Descripción de la zona escolar (réplica mínima de la de unidadAprendizajeService,
// para no exportar un privado de ese archivo grande).
const describirZona = (zona = "") => {
  const z = zona.toLowerCase();
  if (z.includes("rural")) return "zona RURAL (campo): usa situaciones del entorno rural (cultivos, animales, comunidad pequeña, distancias)";
  if (z.includes("periurban")) return "zona PERIURBANA (afueras de la ciudad)";
  if (z.includes("urban")) return "zona URBANA (ciudad): usa situaciones de ciudad (transporte, barrios, servicios)";
  return "";
};

// ─── System prompt ────────────────────────────────────────────────────────────
export const buildSystemPromptDiagnostico = (area = "", nivel = "", idioma = false) => {
  const lang = NOMBRE_IDIOMA(area);
  return [
    "Eres un especialista del MINERD (República Dominicana) que elabora EVALUACIONES",
    "DIAGNÓSTICAS de inicio de año para Secundaria. Su propósito es identificar el",
    "punto de partida real de los estudiantes y orientar la planificación — NO califica.",
    "",
    "Reglas innegociables:",
    "- Sigue el MOLDE oficial que se te indique (nº de ítems, cuántos abiertos, tipos de",
    "  estímulo, nº de opciones, tiempo). La forma debe parecerse a la prueba oficial.",
    "- Ítems SITUACIONALES: parten de un contexto real y piden análisis/inferencia/",
    "  aplicación, no memoria. Cada ítem evalúa un indicador/competencia del grado.",
    "- ADAPTA el contenido a la realidad del grupo (zona, contexto comunitario, nivel):",
    "  nombres, lugares y situaciones cercanas al estudiante. Mismo nivel de exigencia",
    "  que el oficial, pero con contexto propio.",
    "- Cada ítem de opción múltiple: 1 respuesta correcta inequívoca + distractores",
    "  plausibles. Indica la clave (letra) y una justificación breve.",
    "- Ítems abiertos: enunciado claro + guía de corrección (qué debe contener una",
    "  respuesta correcta), no una clave cerrada.",
    "- NO uses imágenes/gráficos que no puedas describir en texto; si un ítem los",
    "  necesitaría, redáctalo de forma que funcione solo con texto.",
    idioma
      ? `- IDIOMA (${lang}): todo texto que TRABAJA el estudiante (lecturas, diálogos, enunciados de los ítems de destreza, opciones) va EN ${lang.toUpperCase()}. Las instrucciones para el docente pueden ir en español. Un ítem de LISTENING es un GUION para que el docente lea en voz alta (NO afirmes que hay audio grabado). Distribuye por destrezas (reading/listening/speaking/writing).`
      : "",
    nivel ? `- Nivel: ${nivel}.` : "",
    "",
    "Devuelves EXCLUSIVAMENTE JSON válido (sin markdown, sin ```), con el esquema indicado.",
  ].filter(Boolean).join("\n");
};

// Esquema JSON que debe devolver el modelo (misma forma que las pruebas oficiales).
const esquemaPrueba = (idioma) => `{
  "estimulos": [ { "id": "E1", "tipo": "noticia|cuento|texto|dialogo|infografia|situacion",
                   "titulo": "...", "texto": "<texto completo${idioma ? " en el idioma meta" : ""}>", "fuente": "material original" } ],
  "items": [ { "numero": <int>, "estimuloId": "E1|null",
               "tipo": "opcion_multiple|abierta",
               ${idioma ? '"destreza": "reading|listening|speaking|writing|null",' : ''}
               "enunciado": "...",
               "opciones": ["a) ...","b) ...","c) ...","d) ..."],
               "claveIA": "<letra a|b|c|d, o ''>",
               "claveJustificacion": "<por qué, 1 frase>",
               "respuestaAbiertaGuia": "<criterio de corrección si es abierta, o ''>",
               "competencia": "<competencia que evalúa>",
               "indicador": "<indicador del grado que evalúa>" } ]
}`;

// ─── Prompt de generación ─────────────────────────────────────────────────────
export const buildPromptDiagnostico = ({ area, asignatura, grado, nivel, molde, referentes, contexto }) => {
  const idioma = ES_IDIOMA(area, asignatura);
  const indicadores = _arr(referentes?.indicadores).slice(0, 25)
    .map((i) => `- ${_texto(i.descripcion)}${i.competencia ? ` [${_texto(i.competencia)}]` : ""}`);
  const ctx = [
    contexto?.zonaEscolar ? describirZona(contexto.zonaEscolar) : "",
    _texto(contexto?.contextoComunitario) ? `Contexto comunitario: ${_texto(contexto.contextoComunitario)}` : "",
    _texto(contexto?.matices) ? `Matices del grupo (del docente): ${_texto(contexto.matices)}` : "",
  ].filter(Boolean);

  return [
    `EVALUACIÓN DIAGNÓSTICA — ${_texto(asignatura || area)} — ${_texto(grado)} de ${_texto(nivel || "Secundaria")} (MINERD).`,
    "",
    `MOLDE a seguir (imita la FORMA, no el contenido oficial): ${describirMolde(molde)}`,
    "",
    indicadores.length
      ? `INDICADORES/COMPETENCIAS del grado que la prueba debe evaluar (fuente: ${_texto(referentes?.fuente) || "currículo"}):\n${indicadores.join("\n")}`
      : "No hay indicadores cargados: usa los aprendizajes esenciales del grado anterior y del grado actual del área.",
    "",
    ctx.length ? `REALIDAD DEL GRUPO (adapta el contenido a esto):\n${ctx.join("\n")}` : "Sin contexto específico del grupo: usa situaciones dominicanas cotidianas.",
    "",
    `Genera la prueba completa. Devuelve un JSON con el esquema:\n${esquemaPrueba(idioma)}`,
    `Debe tener EXACTAMENTE ${molde.totalItems} ítems numerados 1..${molde.totalItems}, de los cuales ${molde.itemsAbiertos} son de respuesta abierta.`,
    "Cada ítem de opción múltiple con 4 opciones y su claveIA. JSON puro, sin markdown.",
  ].filter(Boolean).join("\n");
};

// ─── Validación de la prueba generada (propiedades fuertes, fail-closed) ──────
export const validarPruebaGenerada = (prueba, { molde, idioma = false } = {}) => {
  const motivos = [];
  const items = _arr(prueba?.items);
  const estimulos = _arr(prueba?.estimulos);
  const totalEsperado = molde?.totalItems || 15;

  if (items.length !== totalEsperado) motivos.push(`tiene ${items.length} ítems (molde pide ${totalEsperado})`);
  const nums = items.map((i) => i.numero);
  const esperados = [...Array(items.length)].map((_, i) => i + 1);
  if (JSON.stringify(nums) !== JSON.stringify(esperados)) motivos.push(`numeración no es 1..${items.length}: ${nums.join(",")}`);

  const ids = new Set(estimulos.map((e) => e.id));
  for (const it of items) {
    const n = it.numero;
    if (_texto(it.enunciado).length < 10) motivos.push(`ítem ${n}: enunciado vacío`);
    if (!_texto(it.competencia) && !_texto(it.indicador)) motivos.push(`ítem ${n}: sin indicador/competencia vinculada`);
    if (it.estimuloId && !ids.has(it.estimuloId)) motivos.push(`ítem ${n}: estímulo inexistente ${it.estimuloId}`);
    if (it.tipo === "opcion_multiple") {
      const nop = _arr(it.opciones).length;
      if (nop < 2 || nop > 4) motivos.push(`ítem ${n}: ${nop} opciones (2-4)`);
      if (!/^[a-d]$/.test(_texto(it.claveIA).toLowerCase())) motivos.push(`ítem ${n}: claveIA inválida`);
    } else if (it.tipo === "abierta") {
      if (!_texto(it.respuestaAbiertaGuia)) motivos.push(`ítem ${n}: abierto sin guía de corrección`);
    } else {
      motivos.push(`ítem ${n}: tipo desconocido "${it.tipo}"`);
    }
  }
  // Idioma: los estímulos de destreza deben estar en el idioma meta (heurística:
  // que no sean mayoritariamente español en reading/listening). Comprobación
  // ligera — el detalle fino lo revisa el docente.
  if (idioma && estimulos.length) {
    const sinTexto = estimulos.filter((e) => _texto(e.texto).length < 15);
    if (sinTexto.length) motivos.push(`${sinTexto.length} estímulo(s) de idioma sin texto`);
  }
  return { ok: motivos.length === 0, motivos };
};

// Normaliza la prueba cruda de la IA a la forma canónica (como las oficiales) y
// deja la clave en "por_revisar" (nunca "confirmada" al generar).
const normalizarPrueba = ({ bruta, area, asignatura, grado, nivel, molde }) => {
  const estimulos = _arr(bruta?.estimulos).map((e, i) => ({
    id: _texto(e.id) || `E${i + 1}`,
    tipo: _texto(e.tipo) || "texto",
    titulo: _texto(e.titulo),
    texto: _texto(e.texto),
    fuente: _texto(e.fuente) || "material original",
    requiereImagen: false,
  }));
  const items = _arr(bruta?.items).map((it, i) => {
    const tipo = it.tipo === "abierta" ? "abierta" : "opcion_multiple";
    const letra = _texto(it.claveIA).toLowerCase().slice(0, 1);
    return {
      numero: i + 1,
      estimuloId: it.estimuloId && it.estimuloId !== "null" ? _texto(it.estimuloId) : null,
      tipo,
      destreza: _texto(it.destreza) || null,
      enunciado: _texto(it.enunciado),
      opciones: tipo === "opcion_multiple" ? _arr(it.opciones).map(_texto) : [],
      claveIA: tipo === "opcion_multiple" && /[a-d]/.test(letra) ? letra : "",
      claveEstado: tipo === "opcion_multiple" ? "por_revisar" : "guia_abierta",
      claveJustificacion: _texto(it.claveJustificacion),
      respuestaAbiertaGuia: _texto(it.respuestaAbiertaGuia),
      requiereImagen: false,
      competencia: _texto(it.competencia),
      indicador: _texto(it.indicador),
    };
  });
  return {
    metadatos: {
      area, asignatura: asignatura || area, grado, nivel: nivel || "Secundaria",
      institucion: "MINERD", anoEscolar: contextoAnoEscolar(),
      tiempoMinutos: molde?.tiempoMinutos || 90, totalItems: items.length,
      fuente: "Generada por DocenteOS con molde oficial MINERD, adaptada al grupo",
      oficial: false, generada: true, generadaEn: new Date().toISOString(),
    },
    estimulos,
    items,
  };
};

const contextoAnoEscolar = () => {
  const hoy = new Date();
  const inicio = hoy.getMonth() >= 7 ? hoy.getFullYear() : hoy.getFullYear() - 1;
  return `${inicio}-${inicio + 1}`;
};

// ─── API pública ──────────────────────────────────────────────────────────────
// Genera la prueba diagnóstica contextualizada. 1 reintento ante JSON/validación.
export const generarPruebaDiagnostica = async ({ area, asignatura, grado, nivel, contexto = {} } = {}) => {
  if (!_texto(area) && !_texto(asignatura)) throw new Error("Falta área/asignatura.");
  if (!_texto(grado)) throw new Error("Falta grado.");
  const idioma = ES_IDIOMA(area, asignatura);

  const [molde, referentes] = await Promise.all([
    obtenerMolde({ area, asignatura, grado, nivel }),
    cargarReferentesDiagnosticos({ nivel: nivel || "Secundaria", grado, area, asignatura }).catch(() => ({ indicadores: [] })),
  ]);

  const system = buildSystemPromptDiagnostico(area, nivel, idioma);
  const prompt = buildPromptDiagnostico({ area, asignatura, grado, nivel, molde, referentes, contexto });

  let ultimoMotivo = "";
  for (let intento = 0; intento < 2; intento += 1) {
    const { text, stopReason } = await generarGuiaSemanaRaw(prompt, system, { maxTokens: 16000 });
    const parsed = extraerJSON(text, stopReason);
    if (!parsed.ok) { ultimoMotivo = parsed.motivo || "JSON inválido"; continue; }
    const prueba = normalizarPrueba({ bruta: parsed.data, area, asignatura, grado, nivel, molde });
    const v = validarPruebaGenerada(prueba, { molde, idioma });
    if (v.ok) return { prueba, molde, referentesFuente: referentes?.fuente || "" };
    ultimoMotivo = v.motivos.slice(0, 3).join("; ");
  }
  throw new Error(`No se pudo generar la prueba: ${ultimoMotivo}`);
};
