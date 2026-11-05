/**
 * redaccionFaseService — Contrato y validación de la redacción por fase
 * (Etapa 5 de docs/DISENO_CORAZON_DOCENTEOS.md, capa 4 y 5 de la arquitectura).
 *
 * El plan maestro (planMaestroService.js) decide la estructura; la IA redacta
 * UNA fase cada vez con un contrato: propósito, entrega, secciones que avanza,
 * contenidos semilla e indicadores. Reglas aprobadas por César el 2026-10-29:
 * - 4.6: la malla es la semilla (cada fase con contenido trabaja al menos uno);
 *   la IA amplía alrededor del tema y del producto y lo añadido va marcado como
 *   ampliación de DocenteOS. Sin semilla no hay ampliación (fail-closed).
 *   Etapa 6+ (César, 2026-10-29): la semilla es el mínimo, no el límite — la
 *   clase puede usar además otros contenidos de la malla de la unidad, y el
 *   foco puede enriquecerse más allá de lo declarado.
 * - Las fases sin contenido (apertura, evaluación, socialización) no reciben
 *   semilla nueva: retoman lo ya trabajado, sin ampliación ni foco obligatorio.
 * - 4.7: las piezas se nombran por la sección del producto que avanzan.
 * - La vista previa es obligatoria donde existe (asignaturas con indicadores
 *   estructurados); en las demás se genera como antes, con aviso visible.
 *
 * Módulo PURO (sin IA ni Firebase). Lo consumen unidadAprendizajeService.js
 * (contrato) y phaseAService.js (validación de cada lote). La comprobación de
 * la vista previa vive en vistaPreviaPlanMaestroService.js.
 * Verificación: scripts/test-redaccion-fase.mjs
 */

import { aporteDeFila, pasosConFrases } from "./mapaClasesService.js";
import { MARCAS_DATO, INVENTARIO_POR_SECCION } from "../data/tareasPorTipoTrabajo.js";
import { ROLES_CON_CONTENIDO, TIPO_TRABAJO_FASES_POR_ESTRATEGIA, MODALIDADES_VISITA, MODALIDAD_VISITA_POR_DEFECTO } from "../data/rolesFasesEstrategias.js";
import { ESTRATEGIAS_FASES_GUIA_2025 } from "../data/estrategiasFasesGuia2025.js";
import { recomponerIndicador } from "../data/indicadoresIngles2doEstructurados.js";

// Propósito de cada papel de fase. Interpretación de DocenteOS (no es texto
// oficial), coherente con la Guía 1.2.9 y los papeles aprobados en la Etapa 2.
export const PROPOSITO_POR_ROL = {
  apertura: "Presentar la situación y el producto, recoger los saberes previos y acordar con el grupo el plan del producto. No se introduce contenido nuevo.",
  conocimiento: "Gestionar el conocimiento: comprenden (escuchan y leen) los contenidos que el producto necesita y reúnen los insumos de sus secciones.",
  modelado: "Modelar y ejemplificar: observan cómo se construye cada sección con los contenidos de la fase y producen el borrador.",
  aplicacion: "Aplicar: usan los contenidos en interacción real para completar y probar el producto hasta su versión final.",
  evaluacion: "Evaluar: revisan el producto con los criterios acordados (auto y coevaluación) y lo mejoran. No se introduce contenido nuevo.",
  socializacion: "Socializar y cerrar: presentan el producto a su audiencia y reflexionan sobre lo aprendido. No se introduce contenido nuevo.",
};

// Qué hacen los estudiantes en cada fase de la Guía (p. 22) de las estrategias
// de la Etapa 6+; va antes del propósito del papel, que dice el estado del
// producto. Interpretación de DocenteOS, aprobada por César el 2026-10-29.
// ABProyecto y ABProblemas usan solo el propósito del papel.
export const PROPOSITO_POR_FASE_GUIA = {
  indagacion_dialogica: {
    "Recogida de conocimientos previos": "Recogen lo que ya saben sobre la pregunta de indagación y acuerdan qué necesitan averiguar.",
    "Validación de las fuentes": "Consultan fuentes (textos, audios, personas) y comprueban si son fiables y útiles para la pregunta.",
    "Análisis y organización de la información": "Analizan la información de las fuentes y la organizan en esquemas, tablas o fichas.",
    "Diseño y construcción": "Diseñan y construyen el producto con la información organizada.",
    "Presentación de resultados": "Presentan los resultados de la indagación y responden las preguntas del público.",
    "Evaluación": "Evalúan el producto y el proceso de indagación con los criterios acordados.",
  },
  insercion_entorno: {
    "Recolección de información previa": "Recogen lo que ya saben del entorno que van a visitar y planifican la visita.",
    "Elaboración de instrumentos de recolección": "Elaboran los instrumentos para recoger datos (preguntas de entrevista, encuesta, lista de observación).",
    "Visita-recolección de los datos": "Visitan el entorno y recogen los datos con sus instrumentos.",
    "Descripción y reflexión": "Describen lo observado y reflexionan sobre lo que encontraron.",
    "Análisis de los datos e información": "Analizan los datos recogidos y sacan sus hallazgos.",
    "Socialización del conocimiento": "Comparten y discuten los hallazgos con sus compañeros.",
    "Elaboración de propuestas": "Elaboran propuestas para el entorno a partir de los hallazgos.",
    "Aplicación de los conocimientos": "Ponen en práctica las propuestas ante su audiencia.",
    "Evaluación y reconocimiento del proceso": "Evalúan el producto y reconocen lo aprendido en el proceso.",
  },
  estudio_caso: {
    "Conocimiento o saberes previos del caso": "Conocen el caso y recogen lo que ya saben de él.",
    "Indagación o estudio del caso": "Estudian el caso: lo leen o escuchan y buscan los datos que necesitan para analizarlo.",
    "Socialización del caso": "Cada equipo presenta al grupo su análisis del caso.",
    "Elaboración de conclusiones": "Discuten y negocian conclusiones comunes sobre el caso.",
    "Evaluación": "Evalúan las conclusiones y el proceso con los criterios acordados.",
  },
  conocimientos_previos: {
    "Presentación de la situación de aprendizaje": "Conocen la situación de aprendizaje y el producto.",
    "Recogida de saberes recuperados": "Recuperan lo que ya saben del tema y lo registran.",
    "Socialización reflexiva y crítica": "Comparten y contrastan sus saberes y señalan qué les falta aprender.",
    "Introducción del nuevo conocimiento": "Incorporan el nuevo conocimiento a lo que ya sabían.",
    "Evaluación": "Evalúan el producto y lo que cambió entre lo que sabían y lo que aprendieron.",
  },
  expositiva: {
    "Recogida de conocimientos previos.": "Recogen lo que ya saben del tema de la exposición.",
    "Búsqueda y análisis.": "Buscan y analizan información para la exposición.",
    "Producción de la exposición": "Preparan la exposición y su apoyo (cartel, diapositivas o guion).",
    "Exposición de producciones": "Exponen sus producciones y responden las preguntas del público.",
    "Reflexión metacognitiva": "Reflexionan sobre cómo aprendieron y cómo expusieron.",
    "Sistematización": "Sistematizan lo aprendido en una síntesis.",
    "Evaluación": "Evalúan la exposición y el proceso con los criterios acordados.",
  },
};

// Regla 4.4 — verbos de las actividades (Referente pp. 36-37, taxonomía
// socioformativa), en 3.ª persona plural.
export const VERBOS_POR_NIVEL = {
  preformal: ["Abordan", "Atienden", "Codifican", "Enumeran", "Enuncian", "Exploran", "Memorizan", "Nombran", "Observan", "Reaccionan", "Repiten", "Rotulan", "Señalan", "Siguen"],
  receptivo: ["Buscan", "Citan", "Definen", "Describen", "Determinan", "Identifican", "Indagan", "Reconocen", "Recuperan", "Registran", "Relatan", "Reproducen", "Resumen", "Organizan", "Seleccionan", "Subrayan"],
  resolutivo: ["Aplican", "Caracterizan", "Categorizan", "Comparan", "Comprenden", "Comprueban", "Diagnostican", "Diferencian", "Ejecutan", "Elaboran", "Emplean", "Implementan", "Interpretan", "Planifican", "Resuelven", "Sistematizan", "Verifican"],
  autonomo: ["Analizan", "Aportan", "Argumentan", "Autoevalúan", "Coevalúan", "Comentan", "Contextualizan", "Critican", "Ejemplifican", "Evalúan", "Explican", "Formulan", "Infieren", "Integran", "Mejoran", "Reflexionan", "Relacionan", "Retroalimentan", "Valoran"],
  estrategico: ["Adaptan", "Asesoran", "Ayudan", "Co-crean", "Componen", "Crean", "Generan", "Innovan", "Juzgan", "Lideran", "Predicen", "Proponen", "Proyectan", "Reconstruyen", "Transfieren", "Transforman", "Vinculan"],
};
// Verbos de idioma por acción del indicador (añadido de DocenteOS, no del Referente).
// Exponen, Graban, Reescriben y Debaten: decisión de César (2026-11-01, Etapa D),
// eran verbos legítimos que el validador rechazaba y se pagaban de nuevo.
export const VERBOS_IDIOMA = {
  responde: ["Escuchan", "Leen", "Identifican", "Señalan", "Responden"],
  produce: ["Escriben", "Redactan", "Describen", "Narran", "Presentan", "Exponen", "Graban", "Reescriben"],
  interactua: ["Conversan", "Preguntan", "Entrevistan", "Representan", "Intercambian", "Debaten"],
};
// Gestión de la clase (decisión de César, Etapa 7): permitidos, no cuentan para el nivel.
// Guardan, Archivan y Entregan: decisión de César (2026-11-01, Etapa D).
// Ensayan, Reúnen y Discuten: decisión de César (2026-11-05).
export const VERBOS_GESTION = ["Socializan", "Comparten", "Revisan", "Corrigen", "Practican", "Guardan", "Archivan", "Entregan", "Ensayan", "Reúnen", "Discuten"];
const NIVELES = ["preformal", "receptivo", "resolutivo", "autonomo", "estrategico"];
// Nivel mínimo esperado por papel de fase (progresión 4.4); su falta solo se avisa.
export const NIVEL_MINIMO_POR_ROL = {
  apertura: "receptivo", conocimiento: "receptivo", modelado: "resolutivo",
  aplicacion: "resolutivo", evaluacion: "autonomo", socializacion: "autonomo",
};
// Los verbos se comparan sin guiones, tildes ni mayúsculas: «Co-evalúan» =
// «Coevalúan» = «Coevaluan», «Cocrean» = «Co-crean». La lista no cambia; solo
// deja de rechazar el mismo verbo escrito sin tilde (Etapa D: 6 rechazos pagados).
const claveVerbo = (verbo) => String(verbo ?? "").replace(/[-\u2010\u2011]/g, "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const NIVEL_DE_VERBO = new Map(NIVELES.flatMap((n) => VERBOS_POR_NIVEL[n].map((v) => [claveVerbo(v), n])));
const VERBOS_GESTION_CLAVE = new Set(VERBOS_GESTION.map(claveVerbo));
const VERBOS_IDIOMA_CLAVE = new Set(Object.values(VERBOS_IDIOMA).flat().map(claveVerbo));
const MIN_PALABRAS_DESARROLLO = 18;
// Organización del trabajo: va en el paréntesis que sigue al verbo (4.4).
const ORGANIZACION_RE = /\b(en|por) (parejas|pares|tr[ií]os|equipos?|grupos?|peque[nñ]os grupos|plenaria)\b/i;

const primeraPalabra = (texto) => (String(texto ?? "").trim().split(/[\s(,.:;]+/)[0] || "");
/** Nivel de la taxonomía del verbo inicial (null si es de idioma, gestión o desconocido). */
export const nivelVerbo = (texto) => NIVEL_DE_VERBO.get(claveVerbo(primeraPalabra(texto))) || null;

/**
 * Regla 4.4 sobre una actividad del Desarrollo o del Cierre. Devuelve el
 * motivo del aviso, o "" si cumple. El Inicio canónico (saludo,
 * «Retroalimentación de…», «Recuperación de…») no pasa por aquí.
 */
export const motivoRedaccionActividad = (texto, { esIdioma = false } = {}) => {
  const t = String(texto ?? "").trim();
  const verbo = primeraPalabra(t);
  const clave = claveVerbo(verbo);
  const permitido = NIVEL_DE_VERBO.has(clave) || VERBOS_GESTION_CLAVE.has(clave)
    || (esIdioma && VERBOS_IDIOMA_CLAVE.has(clave));
  if (!permitido) return `«${verbo}» no está en la lista de verbos (taxonomía del Referente${esIdioma ? ", verbos de idioma" : ""} o gestión de la clase)`;
  const parentesis = t.match(/^\S+\s*\(([^)]*)\)/);
  const resto = parentesis ? t.slice(parentesis[0].length) : t.slice(verbo.length);
  // Decisión de César (2026-11-02): si el paréntesis ya nombra la organización,
  // la actividad puede cambiar de agrupación después («Comparten (en parejas)
  // … y luego en plenaria»). Era el rechazo pagado más frecuente.
  const organizacionEnParentesis = Boolean(parentesis) && ORGANIZACION_RE.test(parentesis[1]);
  if (!organizacionEnParentesis && ORGANIZACION_RE.test(resto)) return `la organización («${resto.match(ORGANIZACION_RE)[0]}») va entre paréntesis justo después del verbo: "${verbo} (en parejas) …"`;
  return "";
};

/** Palabras de una actividad; la síntesis (25-35) solo se avisa (decisión de César, Etapa 7). */
// ¿`texto` contiene `frase` como palabras completas? Ambos ya normalizados.
export const contienePalabras = (texto, frase) => {
  const escapada = String(frase ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return Boolean(escapada) && new RegExp(`(^|[^a-z0-9ñ])${escapada}([^a-z0-9ñ]|$)`).test(String(texto ?? ""));
};

export const palabrasActividad = (texto) => String(texto ?? "").trim().split(/\s+/).filter(Boolean).length;

/**
 * Regla 4.4 sobre una clase: cada actividad del Desarrollo y del Cierre, y un
 * Cierre de nivel Autónomo o Estratégico. Devuelve TODOS los motivos, para que
 * el reintento los corrija a la vez.
 */
export const motivosRedaccionClase = (clase, etiqueta, opciones = {}) => {
  const motivos = [];
  for (const m of clase?.momentos || []) {
    if (m?.nombre !== "Desarrollo" && m?.nombre !== "Cierre") continue;
    // Los pasos del banco los aprobó César: no pasan por la lista de verbos.
    if (m.nombre === "Desarrollo" && clase?.secuenciaAplicada) continue;
    (m.actividades || []).forEach((act, k) => {
      const motivo = motivoRedaccionActividad(act, opciones);
      if (motivo) motivos.push(`${etiqueta} — ${m.nombre}, actividad ${k + 1}: ${motivo}`);
    });
    if (m.nombre === "Cierre" && !(m.actividades || []).some((a) => ["autonomo", "estrategico"].includes(nivelVerbo(a)))) {
      motivos.push(`${etiqueta} — el Cierre necesita al menos un verbo Autónomo o Estratégico (Coevalúan, Retroalimentan, Mejoran, Reflexionan…)`);
    }
  }
  return motivos;
};

export const TIPOS_AMPLIACION = ["vocabulario", "gramatica", "expresion", "funcion"];

// Tiempos y estructuras que se reconocen en inglés (ampliación de la IA) y en
// español (malla oficial). Orden: de lo más específico a lo más general, para
// que «present perfect continuous» no se lea como «present perfect».
const ESTRUCTURAS_GRAMATICA = [
  ["presente_perfecto_continuo", /present perfect (continuous|progressive)|presente perfecto (continuo|progresivo)/],
  ["pasado_perfecto_continuo", /past perfect (continuous|progressive)|pasado perfecto (continuo|progresivo)|pluscuamperfecto continuo/],
  ["pasado_perfecto", /past perfect|pasado perfecto|pluscuamperfecto/],
  ["futuro_perfecto", /future perfect|futuro perfecto/],
  ["presente_perfecto", /present perfect|presente perfecto/],
  ["pasado_continuo", /past (continuous|progressive)|pasado (continuo|progresivo)/],
  ["presente_continuo", /present (continuous|progressive)|presente (continuo|progresivo)/],
  ["pasado_simple", /(past simple|simple past)|pasado simple/],
  ["presente_simple", /(present simple|simple present)|presente simple/],
  ["voz_pasiva", /passive voice|voz pasiva/],
  ["estilo_indirecto", /reported speech|indirect speech|estilo indirecto/],
  ["tercer_condicional", /third conditional|tercer condicional/],
  ["segundo_condicional", /second conditional|segundo condicional/],
];
const quitarTildes = (t) => String(t ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
/** Estructura gramatical conocida de un texto (inglés o español), o null. */
export const estructuraGramatical = (texto) => {
  const t = quitarTildes(texto);
  const hit = ESTRUCTURAS_GRAMATICA.find(([, re]) => re.test(t));
  return hit ? hit[0] : null;
};
/** Estructuras que nombra la gramática de la malla del grado. */
export const estructurasDeMalla = (textosGramatica = []) =>
  [...new Set(textosGramatica.flatMap((g) => {
    const t = quitarTildes(typeof g === "object" ? g?.estructura || g?.texto || "" : g);
    return ESTRUCTURAS_GRAMATICA.filter(([, re]) => re.test(t)).map(([clave]) => clave);
  }))];
const CATEGORIAS_SEMILLA = ["vocabulario", "gramatica", "expresiones", "funcionales"];

const error = (msg) => new Error(`Redacción por fase: ${msg}`);
const normalizar = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9ñ' ]+/g, " ").replace(/\s+/g, " ").trim();
// Las etiquetas de categoría ("Vocabulario:", "Gramática:") no cuentan como coincidencia.
const sinEtiqueta = (s) => String(s ?? "").replace(/^\s*(vocabulario|gram[aá]tica|expresi[oó]n(es)?|funci[oó]n(es)?|funcionales?)\s*:\s*/i, "");
const coincide = (a, b) => {
  const na = normalizar(sinEtiqueta(a));
  const nb = normalizar(sinEtiqueta(b));
  return Boolean(na && nb && (na.includes(nb) || nb.includes(na)));
};
const listaTextos = (v) => (Array.isArray(v) ? v.map((x) => String(x ?? "").trim()).filter(Boolean) : []);

/**
 * Secciones que declara una clase. El prompt nombraba varias unidas con « · »
 * y el modelo a veces copia ese texto como un solo elemento: se separa solo si
 * no es ya una sección y TODAS sus partes son secciones del producto. Si alguna
 * parte no lo es, queda entera y el contrato la rechaza como antes.
 */
export const seccionesDeClase = (valor, secciones = []) => {
  const conocidas = new Map(secciones.map((x) => [normalizar(x), x]));
  return listaTextos(valor).flatMap((s) => {
    if (conocidas.has(normalizar(s)) || !s.includes("·")) return [s];
    const partes = s.split("·").map((x) => x.trim()).filter(Boolean);
    return partes.length > 1 && partes.every((x) => conocidas.has(normalizar(x)))
      ? partes.map((x) => conocidas.get(normalizar(x)))
      : [s];
  });
};

// Indicador recortado (4.3): tronco + aspectos marcados + cierre. Una lista sin
// marcar se conserva completa. Forma aprobada por César (Etapa 6, 2026-10-29):
// los aspectos se unen con ", " y " y " como en la malla; la "y" pasa a "e"
// ante sonido /i/ ("actividades cotidianas e intereses"), no ante "hie"/"hia".
const pideE = (palabra) => /^h?[ií](?![aeiouáéíóú])/i.test(String(palabra || "").trim());
const enlacesDe = (marcados) => marcados.map((_, j) => {
  const n = marcados.length;
  if (j === n - 1) return "";
  if (j === n - 2) return pideE(marcados[j + 1]) ? " e " : " y ";
  return ", ";
});
export const recortarIndicador = (ind, aspectosElegidos = []) => recomponerIndicador({
  ...ind,
  listas: ind.listas.map((lista, l) => {
    const marcados = aspectosElegidos[l] || [];
    return marcados.length ? { aspectos: marcados, enlaces: enlacesDe(marcados) } : lista;
  }),
});

/**
 * Indicador COMPLETO partido en trozos para la plantilla (4.3): cada aspecto
 * marcado lleva `elegido: true`; el resto del texto, `false`. Unidos, los
 * trozos dan el texto oficial (recomponerIndicador).
 */
export const segmentarIndicador = (ind, aspectosElegidos = []) => {
  const trozos = [{ texto: ind.tronco, elegido: false }];
  ind.listas.forEach((lista, l) => {
    const marcados = new Set(aspectosElegidos[l] || []);
    lista.aspectos.forEach((a, j) => {
      trozos.push({ texto: a, elegido: marcados.has(a) });
      trozos.push({ texto: lista.enlaces[j] ?? "", elegido: false });
    });
    trozos.push({ texto: ind.entre[l] ?? "", elegido: false });
  });
  trozos.push({ texto: ind.cierre, elegido: false });
  // Junta los trozos contiguos del mismo tipo y quita los vacíos.
  return trozos.filter((t) => t.texto).reduce((acc, t) => {
    const ultimo = acc[acc.length - 1];
    if (ultimo && ultimo.elegido === t.elegido) ultimo.texto += t.texto;
    else acc.push({ ...t });
    return acc;
  }, []);
};

/**
 * Contrato de la fase `indice` del plan.
 * Las fases sin indicadores propios retoman los de la unidad.
 */
export const construirContratoFase = ({ plan, indice, estructura, audiencia = "", modalidadVisita = "", filasMapa = null, filasUnidad = null }) => {
  const fase = plan?.fases?.[indice];
  if (!fase) throw error(`el plan maestro no tiene la fase ${indice + 1}.`);
  // Fase de tipo «aplicar» (hoy solo Inserción): el grupo lo hace ante la
  // audiencia real de la situación (César, 2026-11-03). Sin audiencia, nada.
  const mapaTipos = TIPO_TRABAJO_FASES_POR_ESTRATEGIA[plan.estrategia?.clave];
  const fasesLiterales = ESTRATEGIAS_FASES_GUIA_2025.find((e) => e.clave === plan.estrategia?.clave)?.fases || [];
  const esDeTipo = (tipo) => Boolean(mapaTipos) && (fase.fasesGuia || []).some((n) => mapaTipos[fasesLiterales.indexOf(n)] === tipo);
  const audienciaLimpia = String(audiencia || "").trim();
  const audienciaReal = esDeTipo("aplicar") ? audienciaLimpia : "";
  // Fase de tipo «evaluar»: se pide el registro de comentarios de esa audiencia.
  const audienciaRegistro = esDeTipo("evaluar") ? audienciaLimpia : "";
  const visita = esDeTipo("visitar")
    ? MODALIDADES_VISITA.find((m) => m.clave === (modalidadVisita || MODALIDAD_VISITA_POR_DEFECTO))
    : null;
  // Fase de tipo «analizar»: las secciones de «proponer» arrancan aquí su
  // borrador como secundarias; alguna actividad debe trabajarlas (César, 2026-11-04).
  const seccionesQueArrancan = esDeTipo("analizar")
    ? (fase.entrega?.secciones || []).filter((s) => plan.tiposTrabajoSecciones?.[s] === "proponer")
    : [];
  const porId = new Map((estructura?.indicadores || []).map((ind) => [ind.id, ind]));
  const aIndicador = (ind, retoma) => {
    const base = porId.get(ind.id);
    if (!base) throw error(`el indicador ${ind.id} no está en los indicadores estructurados.`);
    return { id: ind.id, accion: ind.accion, texto: recortarIndicador(base, ind.aspectosElegidos), retoma };
  };
  const propios = fase.indicadores || [];
  const deLaUnidad = plan.fases.flatMap((f) => f.indicadores || []);
  if (!propios.length && !deLaUnidad.length) throw error("el plan maestro no tiene indicadores elegidos.");
  const indicadores = propios.length
    ? propios.map((ind) => aIndicador(ind, false))
    : deLaUnidad.map((ind) => aIndicador(ind, true));

  const conContenido = (fase.roles || []).some((r) => ROLES_CON_CONTENIDO.includes(r));
  const semilla = Object.fromEntries(CATEGORIAS_SEMILLA.map((cat) => [
    cat, (fase.contenidos?.[cat] || []).map((c) => String(c?.texto ?? c ?? "").trim()).filter(Boolean),
  ]));
  const totalSemilla = CATEGORIAS_SEMILLA.reduce((s, cat) => s + semilla[cat].length, 0);
  if (conContenido && !totalSemilla) {
    throw error(`la fase ${indice + 1} «${fase.nombre}» no recibe contenidos de la malla (sin semilla no hay ampliación). Revisa los contenidos del tema en la malla oficial.`);
  }
  // Todos los contenidos de la malla de la unidad: la clase puede usarlos
  // además de la semilla de su fase.
  const mallaUnidad = [...new Set(plan.fases.flatMap((f) => CATEGORIAS_SEMILLA.flatMap((cat) =>
    (f.contenidos?.[cat] || []).map((c) => String(c?.texto ?? c ?? "").trim()))).filter(Boolean))];
  // Lo trabajado en las fases anteriores: base de las fases sin contenido.
  const trabajado = plan.fases.slice(0, indice)
    .flatMap((f) => CATEGORIAS_SEMILLA.flatMap((cat) => (f.contenidos?.[cat] || []).map((c) => c.texto)));

  return {
    numero: indice + 1,
    total: plan.fases.length,
    nombre: fase.nombre,
    fasesGuia: [...(fase.fasesGuia || [])],
    roles: [...(fase.roles || [])],
    proposito: [...new Set([
      ...(fase.fasesGuia || []).map((n) => PROPOSITO_POR_FASE_GUIA[plan.estrategia?.clave]?.[n]),
      ...(fase.roles || []).map((r) => PROPOSITO_POR_ROL[r]),
    ].filter(Boolean))].join(" "),
    sesiones: fase.sesiones,
    rangoSesiones: { ...fase.rangoSesiones },
    entrega: { estado: fase.entrega.estado, texto: fase.entrega.texto, secciones: [...fase.entrega.secciones] },
    // Con mapa de clases, cada fila ya dice sus secciones y el código escribe el aporte.
    seccionesPorClase: filasMapa
      ? filasMapa.map((f) => (f.flexible ? [...(plan.secciones || [])] : [...f.secciones]))
      : repartirSeccionesClases(fase.entrega.secciones, fase.sesiones),
    seccionPrincipalPorClase: filasMapa ? filasMapa.map(() => "") : seccionesPrincipalesUnidad(plan)[indice],
    ...(filasMapa ? { mapaClases: filasMapa, filasUnidad: filasUnidad || filasMapa } : {}),
    secciones: [...(plan.secciones || [])],
    propositosSecciones: { ...(plan.propositosSecciones || {}) },
    piezasSecciones: { ...(plan.piezasSecciones || {}) },
    partenDeSecciones: Object.fromEntries(Object.entries(plan.partenDeSecciones || {}).map(([s, de]) => [s, [...de]])),
    producto: plan.producto,
    estrategia: plan.estrategia.nombre,
    indicadores,
    conContenido,
    semilla,
    mallaUnidad: conContenido ? mallaUnidad : [],
    trabajado: conContenido ? [] : [...new Set(trabajado)],
    esApertura: (fase.roles || []).every((r) => r === "apertura"),
    audienciaReal,
    audienciaRegistro,
    seccionesQueArrancan: filasMapa ? [] : seccionesQueArrancan,
    ...(visita ? { modalidadVisita: visita.clave, instruccionVisita: visita.instruccion } : {}),
  };
};

/**
 * Secciones que avanza cada clase de la fase (la estructura la decide el
 * código, no la IA): las de la entrega, repartidas en orden entre las
 * sesiones; si hay más sesiones que secciones, cada sección ocupa varias
 * clases seguidas.
 */
export const repartirSeccionesClases = (secciones, sesiones) => {
  if (!secciones.length) return Array.from({ length: sesiones }, () => []);
  if (sesiones >= secciones.length) {
    return Array.from({ length: sesiones }, (_, k) => [secciones[Math.floor((k * secciones.length) / sesiones)]]);
  }
  return Array.from({ length: sesiones }, (_, k) =>
    secciones.slice(Math.floor((k * secciones.length) / sesiones), Math.floor(((k + 1) * secciones.length) / sesiones)));
};

/**
 * Sección PRINCIPAL de cada clase, mirando toda la unidad (aprobado por César,
 * 2026-11-03): con una clase por fase, la clase recibía varias secciones y su
 * aporte nombraba solo una, así que una sección («Healthy Choices») nunca se
 * trabajó.
 * - Solo se fija en las clases que avanzan una PARTE de las secciones; en las
 *   que avanzan todas (acuerdo y plan, insumos, revisión) el aporte nombra la
 *   que de verdad trabaja (antes la rotación a ciegas etiquetaba mal la clase 1).
 * - Primero se empareja cada sección con una clase distinta (caminos de
 *   aumento), para que ninguna quede sin clase propia si el reparto lo permite.
 *   El emparejamiento va primero en las clases de BORRADOR y VERSIÓN FINAL y
 *   después en las demás: en la prueba del 2026-11-03, dos secciones quedaron
 *   solo en «insumos recopilados», sin borrador ni versión final.
 *   Las clases que sobran toman la que menos veces ha sido principal (empate:
 *   la que menos en el mismo estado; luego el orden del producto).
 * Devuelve, por fase, la principal de cada clase ("" = sin principal fija).
 */
export const seccionesPrincipalesUnidad = (plan) => {
  const orden = plan?.secciones || [];
  const ranuras = [];
  const resultado = (plan?.fases || []).map((fase) => {
    const estado = fase.entrega?.estado || "";
    return repartirSeccionesClases(fase.entrega?.secciones || [], fase.sesiones).map((asignadas) => {
      const parcial = asignadas.length > 0 && asignadas.length < orden.length;
      if (parcial) ranuras.push({ asignadas, estado, principal: "" });
      return parcial ? ranuras[ranuras.length - 1] : null;
    });
  });

  // Emparejamiento sección → clase (Kuhn): máximo de secciones con clase propia,
  // primero entre las clases de borrador y versión final.
  const esDeContenido = (estado) => /borrador|versi[oó]n final/i.test(estado);
  const duenaDe = new Map();
  const buscar = (seccion, vistas, admite) => {
    // Cada sección prefiere la clase donde va primero (donde nace su tipo de
    // trabajo): en una clase donde es secundaria, no le quita la principal a otra.
    const candidatas = ranuras.map((_, r) => r)
      .filter((r) => ranuras[r].asignadas.includes(seccion))
      .sort((a, b) => ranuras[a].asignadas.indexOf(seccion) - ranuras[b].asignadas.indexOf(seccion));
    for (const r of candidatas) {
      if (vistas.has(r) || !admite(ranuras[r])) continue;
      vistas.add(r);
      if (!duenaDe.has(r) || buscar(duenaDe.get(r), vistas, admite)) {
        duenaDe.set(r, seccion);
        return true;
      }
    }
    return false;
  };
  orden.forEach((seccion) => buscar(seccion, new Set(), (ranura) => esDeContenido(ranura.estado)));
  const conClase = new Set(duenaDe.values());
  orden.filter((seccion) => !conClase.has(seccion))
    .forEach((seccion) => buscar(seccion, new Set(), (ranura) => !esDeContenido(ranura.estado)));

  const usos = new Map();
  const cuenta = (clave) => usos.get(clave) || 0;
  const usar = (ranura, seccion) => {
    ranura.principal = seccion;
    usos.set(seccion, cuenta(seccion) + 1);
    usos.set(`${ranura.estado}|${seccion}`, cuenta(`${ranura.estado}|${seccion}`) + 1);
  };
  duenaDe.forEach((seccion, r) => usar(ranuras[r], seccion));
  ranuras.forEach((ranura) => {
    if (ranura.principal) return;
    usar(ranura, [...ranura.asignadas].sort((x, y) =>
      cuenta(x) - cuenta(y)
      || cuenta(`${ranura.estado}|${x}`) - cuenta(`${ranura.estado}|${y}`)
      || orden.indexOf(x) - orden.indexOf(y))[0]);
  });
  return resultado.map((clases) => clases.map((ranura) => ranura?.principal || ""));
};

/**
 * Hilo positivo (Etapa S4 de docs/DISENO_SECUENCIA_POR_FASES.md, aprobada por
 * César el 2026-11-03): de qué piezas ya entregadas parte cada clase del lote.
 * Fuentes = las secciones de las que parte su principal + la propia principal;
 * de cada una, la ÚLTIMA pieza de la memoria («Sección «X» (estado): pieza»).
 * Fuente sin pieza entregada → se omite; clase sin fuentes → sin línea; sin
 * «parte de» (unidades sin semilla) → "".
 */
export const hiloPartenDe = ({ contrato, memoria = [], startDia = 1, count = 1 }) => {
  const partenDe = contrato?.partenDeSecciones || {};
  if (!Object.keys(partenDe).length) return "";
  const ultimaPieza = new Map();
  (memoria || []).forEach((m) => {
    const texto = String(m?.aporteProducto || "").trim();
    const seccion = texto.match(/^Secci[oó]n «([^»]+)»/)?.[1];
    if (seccion) ultimaPieza.set(normalizar(seccion), { texto, semana: m.semana });
  });
  const lineas = [];
  for (let k = startDia; k < startDia + count; k += 1) {
    const principal = contrato.seccionPrincipalPorClase?.[k - 1];
    if (!principal) continue;
    const piezas = [...new Set([...(partenDe[principal] || []), principal])]
      .map((s) => ultimaPieza.get(normalizar(s))).filter(Boolean)
      .map((p) => `${p.texto}${p.semana ? ` [semana ${p.semana}]` : ""}`);
    if (piezas.length) lineas.push(`Clase ${k} (principal «${principal}»): parte de ${piezas.join(" · ")}`);
  }
  return lineas.length
    ? `HILO DE LA UNIDAD — de qué parte cada clase (usa estas piezas como insumo dentro de las actividades; tómalas, no las repitas):\n${lineas.join("\n")}`
    : "";
};

/** Códigos que la IA puede usar en "indicadoresTrabajados" en esta fase. */
export const indicadoresPermitidosFase = (contrato) => contrato.indicadores.map((i) => i.id);

const semillaPlana = (contrato) => CATEGORIAS_SEMILLA.flatMap((cat) => contrato.semilla[cat]);

// Audiencia real (César, 2026-11-03): raíces de sus palabras («los dueños de los
// comedores» → dueno, comedor), para reconocerla en singular o plural.
const PALABRAS_VACIAS_AUDIENCIA = new Set(["otras", "otros", "todos", "todas"]);
const raicesAudiencia = (audiencia) => normalizar(audiencia).split(" ")
  .filter((p) => p.length >= 5 && !PALABRAS_VACIAS_AUDIENCIA.has(p))
  .map((p) => p.slice(0, Math.max(5, p.length - 2)));
// Lo simulado no cuenta: un juego de roles «con un dueño» sigue siendo en el aula.
const ACTIVIDAD_SIMULADA_RE = /role play|juego de roles|simul|represent|como clientes/;
/** ¿La actividad se hace ante la audiencia real (no solo la menciona)? */
export const actividadAnteAudiencia = (actividad, audiencia) => {
  const texto = normalizar(actividad);
  if (ACTIVIDAD_SIMULADA_RE.test(texto)) return false;
  return raicesAudiencia(audiencia).some((raiz) => new RegExp(
    `\\b(?:(?:a|al|ante|con|para)|(?:retroalimentacion|comentarios|opinion|opiniones|sugerencias) de)\\s+(?:(?:los|las|el|la|un|una|unos|unas|sus|cada|algun|algunos|algunas)\\s+)?(?:[a-z]+\\s+)?${raiz}`,
  ).test(texto));
};
/** ¿Las entrevistas de estas clases siguen la modalidad de la visita? "" si cumplen. */
export const motivoModalidadVisita = (clases = [], modalidad = "") => {
  const visita = MODALIDADES_VISITA.find((m) => m.clave === modalidad);
  if (!visita) return "";
  const entrevistas = clases.flatMap((c) => textosActividades(c)).filter((a) => /^entrevistan\b/i.test(String(a).trim()));
  const incumple = visita.sinEntrevistaEnClase
    ? entrevistas.length > 0
    : entrevistas.length > 0 && !entrevistas.some((a) => visita.reLoHace.test(normalizar(a)));
  return incumple ? `la actividad de entrevista no sigue la modalidad de la visita («${visita.nombre}»)` : "";
};

const textosActividades = (clase) => (clase?.momentos || [])
  .filter((m) => m?.nombre === "Desarrollo" || m?.nombre === "Cierre")
  .flatMap((m) => m.actividades || []);

/**
 * Clase con secuencia del banco: los pasos los escribe el código, con las frases de la IA.
 * Va antes de normalizar la voz, que une los objetos de actividad en una frase.
 */
export const aplicarSecuencias = (data, contrato, startDia = 1) => {
  (contrato?.mapaClases ? data?.clases || [] : []).forEach((clase, i) => {
    const fila = contrato.mapaClases[startDia + i - 1];
    const desarrollo = fila?.secuencia && (clase?.momentos || []).find((m) => m?.nombre === "Desarrollo");
    if (!desarrollo || clase.secuenciaAplicada) return;
    desarrollo.actividades = pasosConFrases(fila.secuencia, Array.isArray(desarrollo.actividades) ? desarrollo.actividades : []);
    clase.tareaIdsDesarrollo = fila.secuencia.map((x) => `T${x.tarea + 1}`);
    clase.minutosSecuencia = fila.secuencia.map((x) => x.minutos);
    clase.secuenciaAplicada = true;
  });
  return data;
};

/**
 * Mapa de clases: lo fijo de cada clase lo pone el código, no la IA (secciones,
 * indicadores, aporte al producto y entrega de la fase).
 */
export const aplicarFilasMapa = (data, contrato, startDia = 1) => {
  (contrato?.mapaClases ? data?.clases || [] : []).forEach((clase, i) => {
    const fila = contrato.mapaClases[startDia + i - 1];
    if (!clase || !fila) return;
    clase.seccionesProducto = [...(contrato.seccionesPorClase?.[startDia + i - 1] || [])];
    clase.indicadoresTrabajados = fila.indicadores.slice(0, 3);
    clase.aporteProducto = aporteDeFila(fila, contrato.producto, contrato.secciones);
    clase.entregaFase = startDia + i === contrato.sesiones ? contrato.entrega.texto : "";
    // El tipo de cada evidencia del Desarrollo lo dice la tarea, no la normalización.
    const desarrollo = (clase.momentos || []).find((m) => m?.nombre === "Desarrollo");
    if (desarrollo?.evidencias && fila.tareas.length) {
      const e = desarrollo.evidencias;
      const textos = [...(e.conocimientos || []), ...(e.desempeno || []), ...(e.producto || [])].slice(0, 3);
      const nuevas = { conocimientos: [], desempeno: [], producto: [] };
      textos.forEach((texto, k) => {
        // Con tareaId, el tipo es el de la tarea de esa actividad; sin él, por posición.
        const deActividad = fila.tareas[Number(String(clase.tareaIdsDesarrollo?.[k] || "").slice(1)) - 1];
        const tipo = (deActividad || fila.tareas[Math.min(k, fila.tareas.length - 1)]).evidencia;
        nuevas[tipo === "conocimiento" ? "conocimientos" : tipo].push(texto);
      });
      desarrollo.evidencias = nuevas;
    }
  });
  return data;
};

// Marcas de un contenido de la malla: sus ejemplos («…: bread, salad») o, sin ellos, su nombre.
const marcasDeContenido = (contenido) => {
  const texto = sinEtiqueta(contenido).replace(/^funcional:\s*/i, "");
  const dos = texto.indexOf(":");
  const partes = (dos >= 0 ? texto.slice(dos + 1) : texto).split(/[,;.?!…]+/);
  return [...partes, dos >= 0 ? texto.slice(0, dos) : ""].map(normalizar).filter((m) => m.length > 2);
};

/**
 * Contenidos de la fila que no se ven en la clase: ni sus ejemplos ni su nombre
 * aparecen, ni la frase que declaró la IA está en el texto. En la primera prueba
 * real la IA parafraseaba la frase y una regla literal rechazaba todos los lotes
 * (César, 2026-11-04): por eso es un aviso, no un rechazo.
 */
export const contenidosSinUsar = (clase, fila) => {
  const texto = normalizar([
    ...textosActividades(clase).map((a) => (typeof a === "string" ? a : Object.values(a || {}).join(" "))),
    ...(clase?.textoModelo?.lineas || []),
    clase?.saberesPrevios, clase?.actividadEnganche, clase?.retroalimentacionPrevia,
  ].join(" "));
  const declarados = Array.isArray(clase?.contenidosEnClase) ? clase.contenidosEnClase : [];
  return (fila?.contenidos || []).map((c) => c.texto).filter((contenido) => {
    if (marcasDeContenido(contenido).some((m) => texto.includes(m))) return false;
    const frase = normalizar(declarados.find((d) => coincide(d?.contenido, contenido))?.frase);
    return !frase || !texto.includes(frase);
  });
};

const textoComoCadena = (a) => (typeof a === "string" ? a : Object.values(a || {}).join(" "));

/** Actividad que hace grabar a los estudiantes o usa sus celulares (decisión de César, 2026-11-04). */
export const grabacionProhibida = (clase) => textosActividades(clase).map(textoComoCadena)
  .find((a) => {
    const t = normalizar(a);
    if (/\b(sin grabar|no graban|no se graba)\b/.test(t)) return false;
    return /\bgrab(a|an|ar|ado|ada|acion|aciones)\b/.test(t) || /\b(celular|celulares|movil|moviles)\b/.test(t);
  }) || "";

/** Datos del inventario que la clase debía recoger y no se ven. Solo la entrevista y su guion rechazan. */
export const datosSinRecoger = (clase, fila) => {
  if (!fila?.tareas?.some((t) => ["visitar_guion", "visitar_entrevistar"].includes(t.clave))) return [];
  const texto = normalizar([
    ...textosActividades(clase).map(textoComoCadena),
    ...(clase?.textoModelo?.lineas || []),
  ].join(" "));
  return (fila.datosRecoge || []).filter((d) => MARCAS_DATO[d] && !new RegExp(MARCAS_DATO[d]).test(texto));
};

/**
 * Lo que sí rechaza el lote porque rompe la cadena de la unidad (César, 2026-11-04):
 * diagnóstico sin aplicar, presentación sin probar el producto, comentarios sin
 * leer y datos que nadie recogió. El resto de la fidelidad solo avisa.
 */
export const obligacionIncumplida = (clase, fila) => {
  if (!fila || fila.flexible) return "";
  const actividades = ((clase?.momentos || []).find((m) => m?.nombre === "Desarrollo")?.actividades || []).map(textoComoCadena);
  const normales = actividades.map(normalizar);
  const texto = normales.join(" ");
  const claves = fila.tareas.map((t) => t.clave);
  if (claves.includes("acordar") && !(/\bescuch/.test(texto) && /\bescrib/.test(texto))) {
    return "el diagnóstico no se aplica: una actividad escucha y marca, y otra escribe dos oraciones.";
  }
  if (claves.includes("probar_audiencia")) {
    const prueba = fila.secciones.map((s) => INVENTARIO_POR_SECCION[s]?.pruebaConAudiencia).find(Boolean);
    if (prueba && !new RegExp(prueba).test(texto)) return "la clase no usa el producto con la audiencia: una actividad lo pone a prueba con ella.";
  }
  if (claves.includes("evaluar_comentarios") && !normales.some((a) => /^(leen|responden|analizan|identifican)\b/.test(a) && /comentari/.test(a))) {
    return "nadie lee los comentarios de la audiencia: una actividad empieza por leerlos y responder por escrito qué piden cambiar.";
  }
  if (fila.secciones.some((s) => INVENTARIO_POR_SECCION[s])) {
    const dato = actividades.find((a) => /\b(calorias?|proteinas?|porcentaje|vegetarian[oa]?s?|vegan[oa]?s?)\b/.test(normalizar(a)));
    if (dato) return `usa un dato que ninguna clase recogió: "${dato.slice(0, 80)}". Quítalo o escribe «falta dato».`;
  }
  return "";
};

const TOPE_LIBRETA = 14;

/**
 * Lo concreto que dejó una clase aceptada, para las siguientes: frases en inglés y su
 * estructura. Sin cifras: los datos reales los dice la fuente, no un texto modelo.
 */
export const hechosDeClase = (clase) => {
  const actividades = ((clase?.momentos || []).find((m) => m?.nombre === "Desarrollo")?.actividades || []).map(textoComoCadena);
  const enCursiva = actividades.flatMap((a) => [...String(a).matchAll(/_([^_]{3,70})_/g)].map((m) => m[1].trim()));
  const modelo = (clase?.textoModelo?.lineas || []).map((l) => String(l).trim());
  const frases = [...new Set([...enCursiva, ...modelo])].filter((f) => f && !/\d/.test(f)).slice(0, 5);
  return { frases, estructura: String(clase?.focoLinguistico || "").trim().slice(0, 90) };
};

/** Libreta: lo ya decidido en la unidad, para no contradecirlo ni inventarlo de nuevo. */
export const libretaDeHechos = (memoria = []) => {
  const lineas = memoria.filter((m) => m?.hechos && (m.hechos.frases?.length || m.hechos.estructura)).slice(-TOPE_LIBRETA)
    .map((m) => `- ${m.aporteProducto ? `${String(m.aporteProducto).slice(0, 80)} — ` : ""}${m.hechos.estructura}${m.hechos.frases?.length ? ` · frases: ${m.hechos.frases.join(" / ")}` : ""}`);
  return lineas.length
    ? `LO QUE YA SE DECIDIÓ EN LA UNIDAD. Úsalo tal cual; no lo contradigas ni lo inventes de nuevo. Los precios y datos reales los da la fuente de la clase, no estos ejemplos.\n${lineas.join("\n")}`
    : "";
};

// Tareas de otra clase que no deben adelantarse (por el verbo que abre la actividad).
const TAREAS_RECONOCIBLES = [
  { clave: "visitar_entrevistar", verbo: /^entrevistan\b/ },
  { clave: "presentar", verbo: /^presentan\b/ },
  { clave: "integrar", verbo: /^(reunen|integran|compilan)\b/ },
  { clave: "evaluar_proceso", verbo: /^(autoevaluan|coevaluan)\b/ },
];

/**
 * Revisión de la unidad entera contra el mapa: lo que un lote aislado no puede ver.
 * Solo informa al administrador; no regenera nada.
 */
export const revisarUnidadConMapa = (dias = [], filas = []) => {
  const avisos = [];
  const palabras = (t) => normalizar(t).split(" ").filter((p) => p.length > 4);
  const vistas = new Map();
  dias.forEach((dia, i) => {
    const fila = filas[i];
    if (!fila || fila.flexible) return;
    const actividades = ((dia?.momentos || []).find((m) => m?.nombre === "Desarrollo")?.actividades || []).map(textoComoCadena);
    const texto = normalizar(actividades.join(" "));
    // ¿Usa lo que recibe?
    // El acuerdo de la clase 1 es el punto de partida general: ninguna clase tiene por qué nombrarlo.
    fila.recibe.filter((r) => r.clase && !/^acuerdo y plan/i.test(r.texto)).forEach((r) => {
      const claves = palabras(String(r.texto).split(":")[0]);
      if (claves.length && !claves.some((p) => texto.includes(p.slice(0, 5)))) avisos.push(`clase ${fila.clase}: no se ve que use «${r.texto}» de la clase ${r.clase}`);
    });
    // ¿Hace la tarea de otra clase?
    TAREAS_RECONOCIBLES.forEach(({ clave, verbo }) => {
      const suya = fila.tareas.some((t) => t.clave === clave);
      const existe = filas.some((f) => f.tareas.some((t) => t.clave === clave));
      if (!suya && existe && actividades.some((a) => verbo.test(normalizar(a)))) avisos.push(`clase ${fila.clase}: adelanta o repite «${clave}», que el mapa pone en otra clase`);
    });
    // ¿Repite una actividad casi igual?
    actividades.forEach((a) => {
      const clave = normalizar(a).split(" ").slice(0, 12).join(" ");
      if (vistas.has(clave) && vistas.get(clave) !== fila.clase) avisos.push(`clase ${fila.clase}: repite una actividad de la clase ${vistas.get(clave)}`);
      else vistas.set(clave, fila.clase);
    });
  });
  return [...new Set(avisos)];
};

/** Correspondencia entre las actividades del Desarrollo y las tareas de la fila. Solo avisa. */
export const motivosTareaId = (clase, fila) => {
  if (!fila || fila.flexible || !fila.tareas?.length || fila.secuencia) return [];
  const ids = Array.isArray(clase?.tareaIdsDesarrollo) ? clase.tareaIdsDesarrollo : [];
  const actividades = (clase?.momentos || []).find((m) => m?.nombre === "Desarrollo")?.actividades || [];
  if (!ids.length || ids.length !== actividades.length || ids.some((id) => !id)) return ["alguna actividad del Desarrollo no trae \"tareaId\""];
  const validos = fila.tareas.map((_, k) => `T${k + 1}`);
  const motivos = [];
  const ajeno = ids.find((id) => !validos.includes(id));
  if (ajeno) motivos.push(`usa un "tareaId" que no existe en la fila: ${ajeno}`);
  const cuenta = (id) => ids.filter((x) => x === id).length;
  validos.forEach((id, k) => {
    if (!cuenta(id)) motivos.push(`la tarea «${fila.tareas[k].nombre}» no tiene actividad`);
  });
  return motivos;
};

/** Texto de la clase que no debe llegar al docente: el administrador lo ve como aviso. */
export const motivosTextoClase = (clase, fila = null) => {
  const motivos = [];
  const modelo = (clase?.textoModelo?.lineas || []).map(String);
  const conFaltaDato = modelo.find((l) => /falta dato/i.test(l));
  if (conFaltaDato) motivos.push(`el texto modelo dice «falta dato»: "${conFaltaDato.slice(0, 70)}"`);
  const textos = [
    ...modelo,
    ...(clase?.momentos || []).flatMap((m) => m?.actividades || []).map(textoComoCadena),
    ...(Array.isArray(clase?.ampliacion) ? clase.ampliacion : []).map((a) => String(a?.texto || "")),
  ];
  const moneda = textos.find((t) => /(?<!RD)\$|\bd[oó]lar(es)?\b|\bdollars?\b/i.test(t));
  if (moneda) motivos.push(`precio fuera de pesos dominicanos: "${moneda.slice(0, 70)}"`);
  if (fila?.secciones?.some((s) => INVENTARIO_POR_SECCION[s]?.necesita?.includes("lugares"))) {
    const lugar = textos.find((t) => /\b(cafeteria|gym|gymnasium|art room|second floor|auditorium)\b/i.test(t));
    if (lugar) motivos.push(`nombra un lugar que no consta en la tabla común: "${lugar.slice(0, 70)}"`);
  }
  const equipo = textos.find((t) => /\b(videos?|proyector(es)?|parlantes?|bocinas?|grabad[oa]s?|digital(es)?)\b/i.test(t));
  if (equipo) motivos.push(`nombra un equipo que el mapa no prevé: "${equipo.slice(0, 70)}"`);
  return motivos;
};

/** Dónde se aleja la clase de su fila: lo ve el administrador, no el docente. */
export const motivosFidelidad = (clase, fila) => {
  const motivos = [];
  if (!fila || fila.flexible) return motivos;
  const actividades = ((clase?.momentos || []).find((m) => m?.nombre === "Desarrollo")?.actividades || []).map(textoComoCadena);
  const texto = normalizar(actividades.join(" "));
  fila.tareas.forEach((t) => {
    if (t.senal && !t.paralelo && !new RegExp(t.senal).test(texto)) motivos.push(`no se ve la tarea «${t.nombre}» que pide el mapa`);
  });
  if (fila.tareas.every((t) => t.soloComprender) && actividades.some((a) => /^(escriben|redactan|elaboran)\b/.test(normalizar(a)))) {
    motivos.push("escribe una pieza en una clase de comprender, adelantando otra tarea");
  }
  const dato = actividades.find((a) => /\b(calorias?|proteinas?|porcentaje)\b|\b\d+ pesos\b/.test(normalizar(a)) || /\d\s*%/.test(a));
  if (dato) motivos.push(`usa un dato sin fuente recibida: "${dato.slice(0, 80)}"`);
  return motivos;
};

/**
 * Valida un lote de clases contra el contrato de su fase. `startDia` es la
 * posición de la primera clase del lote dentro de la fase (1 = primera).
 * Lanza el primer error encontrado (mismo estilo que validateBatch).
 * La redacción 4.4 del Desarrollo y del Cierre es flexible (decisión de César,
 * 2026-11-03): no rechaza; devuelve sus motivos por clase (índice del lote)
 * para avisar al administrador.
 * Con mapa de clases (César, 2026-11-04), un fallo de redacción se reintenta una vez
 * (`esRedaccionMapa` en el error) y, con `opciones.redaccionConAviso`, se entrega con aviso.
 */
export const validarLoteContrato = (data, contrato, count, startDia = 1, opciones = {}) => {
  const semilla = semillaPlana(contrato);
  const secciones = contrato.secciones;
  const motivos44 = [];
  const fallaRedaccion = (idx, mensaje) => {
    if (opciones.redaccionConAviso) { motivos44[idx]?.push(`clase ${idx + 1} — ${mensaje}`); return; }
    throw Object.assign(new Error(`Contrato: clase ${idx + 1} — ${mensaje}`), { esRedaccionMapa: true });
  };
  for (let idx = 0; idx < count; idx += 1) {
    const clase = data?.clases?.[idx];
    const etiqueta = `Contrato: clase ${idx + 1}`;
    motivos44.push(motivosRedaccionClase(clase, `clase ${idx + 1}`, opciones));
    const suyas = seccionesDeClase(clase?.seccionesProducto, secciones);
    if (secciones.length) {
      if (!suyas.length) throw new Error(`${etiqueta} sin "seccionesProducto" (la sección del producto que avanza).`);
      const ajena = suyas.find((s) => !secciones.some((x) => normalizar(x) === normalizar(s)));
      if (ajena) throw new Error(`${etiqueta} — "${ajena}" no es una sección del producto (${secciones.join(" · ")}).`);
      const asignadas = contrato.seccionesPorClase?.[startDia + idx - 1] || [];
      const faltan = asignadas.filter((a) => !suyas.some((s) => normalizar(s) === normalizar(a)));
      if (faltan.length) throw new Error(`${etiqueta} no avanza ${faltan.join(", ")}, que el plan le asigna.`);
      const aporte = String(clase?.aporteProducto || "");
      const principal = contrato.seccionPrincipalPorClase?.[startDia + idx - 1] || "";
      if (principal) {
        if (!(coincide(aporte, principal) || normalizar(aporte).includes(normalizar(principal)))) {
          throw new Error(`${etiqueta} — "aporteProducto" debe nombrar su sección principal «${principal}»: la pieza de esta clase es de esa sección.`);
        }
      } else if (!suyas.some((s) => coincide(aporte, s) || normalizar(aporte).includes(normalizar(s)))
        // Clase que avanza TODAS las secciones (acuerdo y plan, revisión): su
        // pieza es del producto entero; nombrar una sección la contaba de más
        // en el Anexo H (auditoría de «Alimentación», 2026-11-03).
        && !(asignadas.length === secciones.length && contrato.producto && normalizar(aporte).includes(normalizar(contrato.producto)))) {
        throw new Error(`${etiqueta} — "aporteProducto" debe nombrar la sección que avanza (${suyas.join(" · ")}), no el contenido.`);
      }
    }
    const ampliacion = Array.isArray(clase?.ampliacion) ? clase.ampliacion : [];
    const filaMapa = contrato.mapaClases?.[startDia + idx - 1];
    const revisarAmpliacionYFoco = () => {
      ampliacion.forEach((a, k) => {
        if (!String(a?.texto || "").trim()) throw new Error(`${etiqueta} — ampliación ${k + 1} sin texto.`);
        if (!TIPOS_AMPLIACION.includes(a?.tipo)) throw new Error(`${etiqueta} — ampliación ${k + 1} con tipo "${a?.tipo}" (usa ${TIPOS_AMPLIACION.join(", ")}).`);
        if (secciones.length && !secciones.some((x) => normalizar(x) === normalizar(a?.seccion))) {
          throw new Error(`${etiqueta} — ampliación "${a.texto}" sin sección del producto que la justifique.`);
        }
        // Auditoría 2026-11-02 (aprobado por César): la gramática que añade
        // DocenteOS tiene que estar en la malla del grado. Solo se juzgan las
        // estructuras reconocibles; lo que no se reconoce no se bloquea.
        const estructura = a?.tipo === "gramatica" ? estructuraGramatical(a.texto) : null;
        if (estructura && contrato.estructurasGrado?.length && !contrato.estructurasGrado.includes(estructura)) {
          throw new Error(`${etiqueta} — la ampliación gramatical "${a.texto}" no está en la malla de este grado; usa una estructura del grado o no la añadas.`);
        }
      });
      // Foco ajustado a 4.6 (Etapa 6+): la IA puede enriquecerlo más allá de
      // la semilla y de lo declarado; solo se prohíbe que el contenido sea el
      // protagonista.
      const foco = String(clase?.focoLinguistico || "");
      if (!foco.trim()) throw new Error(`${etiqueta} sin "focoLinguistico".`);
      // 4.6: el contenido nunca es el protagonista del día — el foco no puede
      // ser una etiqueta de la malla ni una palabra suelta de la semilla.
      if (/^\s*(vocabulario|gram[aá]tica|expresi[oó]n(es)?|funci[oó]n(es)?|funcionales?)\s*:/i.test(foco)
        || semilla.some((s) => normalizar(sinEtiqueta(s)) === normalizar(sinEtiqueta(foco)))) {
        throw new Error(`${etiqueta} — "focoLinguistico" no puede ser una etiqueta de la malla ni una palabra de la semilla: nombra lo que la sección necesita comunicar.`);
      }
    };
    if (filaMapa) {
      const sinUsar = contenidosSinUsar(clase, filaMapa);
      if (sinUsar.length) motivos44[idx].push(`clase ${idx + 1} — no se ven estos contenidos del mapa: ${sinUsar.join(" · ")}`);
      const grabacion = grabacionProhibida(clase);
      if (grabacion) fallaRedaccion(idx, `nadie graba con celulares de estudiantes: "${grabacion.slice(0, 90)}". Quita la grabación; lo oral se observa o se anota.`);
      const incumplida = obligacionIncumplida(clase, filaMapa);
      if (incumplida) fallaRedaccion(idx, incumplida);
      const sinDatos = datosSinRecoger(clase, filaMapa);
      if (sinDatos.length) fallaRedaccion(idx, `esta clase debe recoger estos datos y no aparecen en sus actividades ni en su texto modelo: ${sinDatos.join(", ")}. Las piezas siguientes los necesitan.`);
      // Estructura del día fuera de la malla: solo se avisa, y solo si se reconoce.
      const estructuraDia = estructuraGramatical(clase?.focoLinguistico);
      if (contrato.estructurasGrado?.length && estructuraDia && !contrato.estructurasGrado.includes(estructuraDia)) motivos44[idx].push(`clase ${idx + 1} — la estructura del día (${estructuraDia}) no está en la malla del grado`);
      if (contrato.estructurasGrado?.length && !contrato.estructurasGrado.includes("comparativo")) {
        const conThan = [clase?.focoLinguistico, ...(clase?.textoModelo?.lineas || []), ...textosActividades(clase).map(textoComoCadena)].find((t) => /\bthan\b/i.test(String(t || "")));
        if (conThan) motivos44[idx].push(`clase ${idx + 1} — usa un comparativo fuera de la malla del grado: "${String(conThan).slice(0, 70)}"`);
      }
      [...motivosFidelidad(clase, filaMapa), ...motivosTextoClase(clase, filaMapa), ...motivosTareaId(clase, filaMapa)].forEach((m) => motivos44[idx].push(`clase ${idx + 1} — ${m}`));
      if (!contrato.conContenido && ampliacion.length) throw new Error(`${etiqueta} — esta fase no introduce contenido nuevo: "ampliacion" debe ir vacía.`);
      revisarAmpliacionYFoco();
    } else if (!contrato.conContenido) {
      if (ampliacion.length) throw new Error(`${etiqueta} — esta fase no introduce contenido nuevo: "ampliacion" debe ir vacía.`);
    } else {
      const usada = listaTextos(clase?.semillaUsada);
      if (!usada.length) throw new Error(`${etiqueta} sin "semillaUsada" (al menos un contenido de la malla de esta fase).`);
      // Etapa 6+: la semilla de la fase es obligatoria; otros contenidos de la
      // malla de la unidad también valen en "semillaUsada".
      if (!usada.some((u) => semilla.some((s) => coincide(u, s)))) {
        throw new Error(`${etiqueta} — "semillaUsada" no incluye ningún contenido de la semilla de esta fase (${semilla.slice(0, 4).join(" · ")}).`);
      }
      const malla = [...semilla, ...(contrato.mallaUnidad || [])];
      const fuera = usada.find((u) => !malla.some((s) => coincide(u, s)));
      if (fuera) throw new Error(`${etiqueta} — "${fuera}" no es un contenido de la malla de la unidad; lo añadido va en "ampliacion".`);
      revisarAmpliacionYFoco();
    }
    if (startDia + idx === contrato.sesiones && !String(clase?.entregaFase || "").trim()) {
      throw new Error(`${etiqueta} es la última de la fase y no declara "entregaFase" (${contrato.entrega.texto}).`);
    }
  }
  // Al cerrar la fase: la de aplicación ocurre ante la audiencia real (rechaza)
  // y la de evaluación deja el registro de sus comentarios (avisa).
  if (startDia + count - 1 >= contrato.sesiones) {
    const clasesLote = (data?.clases || []).slice(0, count);
    const sinTrabajar = (contrato.seccionesQueArrancan || []).filter((s) => !clasesLote
      .some((c) => textosActividades(c).some((a) => normalizar(a).includes(normalizar(s)))));
    if (sinTrabajar.length) {
      throw new Error(`Contrato: esta fase deja el primer borrador de ${sinTrabajar.join(", ")} y ninguna actividad lo trabaja: una actividad del Desarrollo o del Cierre lo hace y nombra la sección ("Seleccionan (en equipos) una primera versión para «${sinTrabajar[0]}»…").`);
    }
    if (contrato.audienciaReal
      && !clasesLote.some((c) => textosActividades(c).some((a) => actividadAnteAudiencia(a, contrato.audienciaReal)))) {
      const mensaje = `la fase de aplicación no ocurre ante su audiencia real (${contrato.audienciaReal}): una actividad del Desarrollo o del Cierre, que no sea simulada, presenta o entrega la pieza a esa audiencia ("Presentan (en equipos) … a un dueño invitado").`;
      if (contrato.mapaClases) fallaRedaccion(count - 1, mensaje);
      else throw new Error(`Contrato: ${mensaje}`);
    }
    // La modalidad de la visita se avisa: lo que no cumple es Desarrollo flexible.
    const motivoVisita = motivoModalidadVisita(clasesLote, contrato.modalidadVisita);
    if (motivoVisita && motivos44.length) motivos44[motivos44.length - 1].push(`clase ${count} — ${motivoVisita}`);
    if (contrato.audienciaRegistro) {
      const raices = raicesAudiencia(contrato.audienciaRegistro);
      // Mira evidencias y actividades: «Leen las tarjetas con los comentarios del dueño» cuenta.
      const registrada = clasesLote.some((c) => (c?.momentos || []).some((m) => {
        const evidencias = normalizar(JSON.stringify([m?.evidencias || {}, m?.actividades || []]));
        return /comentarios|retroalimentacion|opiniones/.test(evidencias) && raices.some((r) => evidencias.includes(r));
      }));
      if (!registrada && motivos44.length) {
        motivos44[motivos44.length - 1].push(`clase ${count} — ninguna evidencia registra los comentarios de la audiencia real (${contrato.audienciaRegistro})`);
      }
    }
  }
  return motivos44;
};

/** Validación de la fase completa: cada fase deja su entrega y avanza sus secciones. */
export const validarFaseCompleta = (clases, contrato) => {
  if (!Array.isArray(clases) || clases.length < contrato.sesiones) {
    throw new Error(`Contrato: la fase ${contrato.numero} tiene ${clases?.length ?? 0} de ${contrato.sesiones} clases.`);
  }
  const avanzadas = new Set(clases.flatMap((c) => seccionesDeClase(c?.seccionesProducto, contrato.secciones)).map(normalizar));
  const faltan = contrato.entrega.secciones.filter((s) => !avanzadas.has(normalizar(s)));
  if (faltan.length) {
    throw new Error(`Contrato: la fase ${contrato.numero} no avanza ${faltan.join(", ")}, que su entrega (${contrato.entrega.estado}) debe dejar.`);
  }
  if (!String(clases[contrato.sesiones - 1]?.entregaFase || "").trim()) {
    throw new Error(`Contrato: la fase ${contrato.numero} no deja su entrega (${contrato.entrega.texto}).`);
  }
  // Etapa 6: cada indicador PROPIO de la fase lo trabaja al menos una clase
  // (los retomados de la unidad no se exigen). Si falta, se rehace la fase.
  const codigo = (x) => String(x?.codigoOficial || x?.codigo || x?.id || x || "").replace(/[[\]\s]/g, "").toUpperCase();
  const declarados = new Set(clases.flatMap((c) => (Array.isArray(c?.indicadoresTrabajados) ? c.indicadoresTrabajados : []).map(codigo)));
  const propios = contrato.indicadores.filter((i) => !i.retoma).map((i) => i.id);
  const sinClase = propios.filter((id) => !declarados.has(codigo(id)));
  if (sinClase.length) {
    throw new Error(`Contrato: en la fase ${contrato.numero} ninguna clase declara ${sinClase.join(", ")} en "indicadoresTrabajados"; entre las clases de la fase deben aparecer todos sus indicadores (${propios.join(", ")}).`);
  }
};

/** Ampliación de DocenteOS de toda la unidad (capa separada, nunca curricularContent). */
export const recogerAmpliacion = (fases = []) => fases.flatMap((f) => (f.dias || []).flatMap((d) =>
  (d.ampliacion || []).map((a) => ({ ...a, fase: f.numero, clase: d.numeroGlobal || null, origen: "DocenteOS" }))));

/**
 * Vocabulario de ampliación que de verdad se usa en las clases (auditoría
 * 2026-11-02: «sports car driving» llegaba al glosario sin aparecer en ninguna
 * actividad). Se quedan solo los términos que aparecen en el texto de alguna
 * clase; los demás tipos no se tocan. Sin texto de clases, no se filtra.
 */
export const ampliacionUsadaEnClases = (ampliacion = [], fases = []) => {
  const textoClases = quitarTildes(fases.flatMap((f) => f.dias || [])
    .map(({ ampliacion: _a, semillaUsada: _s, ...dia }) => JSON.stringify(dia)).join(" "));
  if (!textoClases.trim()) return ampliacion;
  return ampliacion.flatMap((a) => {
    if (a?.tipo !== "vocabulario") return [a];
    const usados = String(a.texto || "").replace(/_/g, "").split(/\s*[,/;]\s*/)
      .map((t) => t.trim()).filter((t) => t && textoClases.includes(quitarTildes(t)));
    return usados.length ? [{ ...a, texto: usados.join(", ") }] : [];
  });
};

/**
 * Validador global (capa 5, Etapa 6) de una unidad redactada con plan maestro.
 * - errores (bloquean): un indicador declarado en el plan sin ninguna clase de
 *   su fase que lo trabaje; una fase sin su entrega o sin las secciones que
 *   esa entrega debe avanzar.
 * - avisos (visibles, no bloquean; regla 4.4): el nombre del producto o el
 *   tema repetido en más de una actividad de la misma clase, o una actividad
 *   que dice "sobre {tema}".
 */
export const validarUnidadPlanMaestro = (unidad) => {
  const errores = [];
  const avisos = [];
  const plan = unidad?.planMaestro;
  if (!plan?.fases?.length) return { errores, avisos };
  const fases = unidad.fasesSemanales || [];
  const codigo = (x) => String(x?.codigoOficial || x?.codigo || x?.id || x || "").replace(/[[\]\s]/g, "").toUpperCase();

  plan.fases.forEach((fasePlan, i) => {
    const fase = fases[i];
    const nombre = `fase ${i + 1} «${fasePlan.nombre}»`;
    if (!fase) { errores.push(`${nombre} no está en la unidad`); return; }
    const dias = fase.dias || [];
    const trabajados = new Set(dias.flatMap((d) => (d.indicadoresTrabajados || []).map(codigo)).filter(Boolean));
    (fasePlan.indicadores || []).forEach((ind) => {
      if (!trabajados.has(codigo(ind.id))) errores.push(`${nombre}: el indicador ${ind.id} no tiene ninguna actividad que lo trabaje`);
    });
    if (!String(dias[dias.length - 1]?.entregaFase || "").trim()) {
      errores.push(`${nombre} no deja su entrega (${fasePlan.entrega?.texto || "sin texto"})`);
    }
    const avanzadas = new Set(dias.flatMap((d) => listaTextos(d.seccionesProducto)).map(normalizar));
    const faltan = (fasePlan.entrega?.secciones || []).filter((s) => !avanzadas.has(normalizar(s)));
    if (faltan.length) errores.push(`${nombre} no avanza ${faltan.join(", ")}`);
  });

  const producto = normalizar(unidad?.metadatos?.productoFinal || plan.producto);
  const temas = [...new Set([...(plan.temas || []), unidad?.metadatos?.titulo].map(normalizar).filter(Boolean))];
  fases.forEach((fase) => (fase.dias || []).forEach((dia) => {
    const ref = `clase ${dia.numeroGlobal || dia.numero}`;
    const actividades = (dia.momentos || []).flatMap((m) => m.actividades || []).map((a) => normalizar(a));
    const conProducto = producto ? actividades.filter((a) => a.includes(producto)).length : 0;
    if (conProducto > 1) avisos.push(`${ref}: el nombre del producto se repite en ${conProducto} actividades (se nombra una vez por clase)`);
    temas.forEach((tema) => {
      // Palabra completa: «retroalimentación» contenía «alimentación» y el aviso
      // saltaba en casi todas las clases (prueba «Alimentación», 2026-11-03).
      const conTema = actividades.filter((a) => contienePalabras(a, tema)).length;
      if (conTema > 1) avisos.push(`${ref}: el tema «${tema}» se repite en ${conTema} actividades`);
      if (actividades.some((a) => contienePalabras(a, `sobre ${tema}`))) avisos.push(`${ref}: una actividad dice «sobre ${tema}»; exprésalo con elementos concretos`);
    });
  }));
  // Regla 4.4 (avisos): progresión de verbos por papel de fase y expresiones
  // en cursiva (1 o 2, terminadas en puntos suspensivos).
  plan.fases.forEach((fasePlan, i) => {
    const minimo = Math.max(...(fasePlan.roles || []).map((r) => NIVELES.indexOf(NIVEL_MINIMO_POR_ROL[r] || "preformal")), 0);
    const niveles = (fases[i]?.dias || []).flatMap((d) => (d.momentos || []).flatMap((m) => m.actividades || []))
      .map(nivelVerbo).filter(Boolean).map((n) => NIVELES.indexOf(n));
    if (niveles.length && Math.max(...niveles) < minimo) {
      avisos.push(`fase ${i + 1} «${fasePlan.nombre}»: ningún verbo llega al nivel ${NIVELES[minimo]} que pide su papel (regla 4.4)`);
    }
  });
  fases.forEach((fase) => (fase.dias || []).forEach((dia) => {
    const ref = `clase ${dia.numeroGlobal || dia.numero}`;
    const desarrollo = (dia.momentos || []).find((m) => m.nombre === "Desarrollo")?.actividades || [];
    const cortas = desarrollo.filter((a) => palabrasActividad(a) < MIN_PALABRAS_DESARROLLO).length;
    // Con mapa de clases, el Desarrollo son pasos cortos a propósito (César, 2026-11-05).
    if (cortas && !dia.tareasMapa?.length) avisos.push(`${ref}: ${cortas} actividad(es) del Desarrollo con menos de ${MIN_PALABRAS_DESARROLLO} palabras; la síntesis lleva 25-35`);
    (dia.momentos || []).flatMap((m) => m.actividades || []).forEach((a) => {
      const cursivas = String(a).match(/(^|[^\w])_(?!\s)[^_]+?_(?!\w)/g) || [];
      if (cursivas.length > 2) avisos.push(`${ref}: una actividad cita ${cursivas.length} expresiones; van 1 o 2 en cursiva con puntos suspensivos`);
    });
  }));
  return { errores, avisos };
};
