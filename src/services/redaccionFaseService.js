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

import { ROLES_CON_CONTENIDO } from "../data/rolesFasesEstrategias.js";
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
export const VERBOS_IDIOMA = {
  responde: ["Escuchan", "Leen", "Identifican", "Señalan", "Responden"],
  produce: ["Escriben", "Redactan", "Describen", "Narran", "Presentan"],
  interactua: ["Conversan", "Preguntan", "Entrevistan", "Representan", "Intercambian"],
};
// Gestión de la clase (decisión de César, Etapa 7): permitidos, no cuentan para el nivel.
export const VERBOS_GESTION = ["Socializan", "Comparten", "Revisan", "Corrigen", "Practican"];
const NIVELES = ["preformal", "receptivo", "resolutivo", "autonomo", "estrategico"];
// Nivel mínimo esperado por papel de fase (progresión 4.4); su falta solo se avisa.
export const NIVEL_MINIMO_POR_ROL = {
  apertura: "receptivo", conocimiento: "receptivo", modelado: "resolutivo",
  aplicacion: "resolutivo", evaluacion: "autonomo", socializacion: "autonomo",
};
// Los verbos se comparan sin guiones: «Co-evalúan» = «Coevalúan», «Cocrean» = «Co-crean».
const sinGuion = (verbo) => String(verbo ?? "").replace(/[-\u2010\u2011]/g, "");
const NIVEL_DE_VERBO = new Map(NIVELES.flatMap((n) => VERBOS_POR_NIVEL[n].map((v) => [sinGuion(v), n])));
const VERBOS_GESTION_SIN_GUION = new Set(VERBOS_GESTION.map(sinGuion));
const VERBOS_IDIOMA_SIN_GUION = new Set(Object.values(VERBOS_IDIOMA).flat().map(sinGuion));
const MIN_PALABRAS_DESARROLLO = 18;
// Organización del trabajo: va en el paréntesis que sigue al verbo (4.4).
const ORGANIZACION_RE = /\b(en|por) (parejas|pares|tr[ií]os|equipos?|grupos?|peque[nñ]os grupos|plenaria)\b/i;

const primeraPalabra = (texto) => (String(texto ?? "").trim().split(/[\s(,.:;]+/)[0] || "");
/** Nivel de la taxonomía del verbo inicial (null si es de idioma, gestión o desconocido). */
export const nivelVerbo = (texto) => NIVEL_DE_VERBO.get(sinGuion(primeraPalabra(texto))) || null;

/**
 * Regla 4.4 sobre una actividad del Desarrollo o del Cierre. Devuelve el
 * motivo del rechazo, o "" si cumple. El Inicio canónico (saludo,
 * «Retroalimentación de…», «Recuperación de…») no pasa por aquí.
 */
export const motivoRedaccionActividad = (texto, { esIdioma = false } = {}) => {
  const t = String(texto ?? "").trim();
  const verbo = primeraPalabra(t);
  const clave = sinGuion(verbo);
  const permitido = NIVEL_DE_VERBO.has(clave) || VERBOS_GESTION_SIN_GUION.has(clave)
    || (esIdioma && VERBOS_IDIOMA_SIN_GUION.has(clave));
  if (!permitido) return `«${verbo}» no está en la lista de verbos (taxonomía del Referente${esIdioma ? ", verbos de idioma" : ""} o gestión de la clase)`;
  const parentesis = t.match(/^\S+\s*\(([^)]*)\)/);
  const resto = parentesis ? t.slice(parentesis[0].length) : t.slice(verbo.length);
  if (ORGANIZACION_RE.test(resto)) return `la organización («${resto.match(ORGANIZACION_RE)[0]}») va entre paréntesis justo después del verbo: "${verbo} (en parejas) …"`;
  return "";
};

/** Palabras de una actividad; la síntesis (25-35) solo se avisa (decisión de César, Etapa 7). */
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
export const construirContratoFase = ({ plan, indice, estructura }) => {
  const fase = plan?.fases?.[indice];
  if (!fase) throw error(`el plan maestro no tiene la fase ${indice + 1}.`);
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
    seccionesPorClase: repartirSeccionesClases(fase.entrega.secciones, fase.sesiones),
    secciones: [...(plan.secciones || [])],
    producto: plan.producto,
    estrategia: plan.estrategia.nombre,
    indicadores,
    conContenido,
    semilla,
    mallaUnidad: conContenido ? mallaUnidad : [],
    trabajado: conContenido ? [] : [...new Set(trabajado)],
    esApertura: (fase.roles || []).every((r) => r === "apertura"),
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

/** Códigos que la IA puede usar en "indicadoresTrabajados" en esta fase. */
export const indicadoresPermitidosFase = (contrato) => contrato.indicadores.map((i) => i.id);

const semillaPlana = (contrato) => CATEGORIAS_SEMILLA.flatMap((cat) => contrato.semilla[cat]);

/**
 * Valida un lote de clases contra el contrato de su fase. `startDia` es la
 * posición de la primera clase del lote dentro de la fase (1 = primera).
 * Lanza el primer error encontrado (mismo estilo que validateBatch).
 */
export const validarLoteContrato = (data, contrato, count, startDia = 1, opciones = {}) => {
  const semilla = semillaPlana(contrato);
  const secciones = contrato.secciones;
  const motivos44 = [];
  for (let idx = 0; idx < count; idx += 1) {
    const clase = data?.clases?.[idx];
    const etiqueta = `Contrato: clase ${idx + 1}`;
    motivos44.push(...motivosRedaccionClase(clase, `clase ${idx + 1}`, opciones));
    const suyas = listaTextos(clase?.seccionesProducto);
    if (secciones.length) {
      if (!suyas.length) throw new Error(`${etiqueta} sin "seccionesProducto" (la sección del producto que avanza).`);
      const ajena = suyas.find((s) => !secciones.some((x) => normalizar(x) === normalizar(s)));
      if (ajena) throw new Error(`${etiqueta} — "${ajena}" no es una sección del producto (${secciones.join(" · ")}).`);
      const asignadas = contrato.seccionesPorClase?.[startDia + idx - 1] || [];
      const faltan = asignadas.filter((a) => !suyas.some((s) => normalizar(s) === normalizar(a)));
      if (faltan.length) throw new Error(`${etiqueta} no avanza ${faltan.join(", ")}, que el plan le asigna.`);
      const aporte = String(clase?.aporteProducto || "");
      if (!suyas.some((s) => coincide(aporte, s) || normalizar(aporte).includes(normalizar(s)))) {
        throw new Error(`${etiqueta} — "aporteProducto" debe nombrar la sección que avanza (${suyas.join(" · ")}), no el contenido.`);
      }
    }
    const ampliacion = Array.isArray(clase?.ampliacion) ? clase.ampliacion : [];
    if (!contrato.conContenido) {
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
      ampliacion.forEach((a, k) => {
        if (!String(a?.texto || "").trim()) throw new Error(`${etiqueta} — ampliación ${k + 1} sin texto.`);
        if (!TIPOS_AMPLIACION.includes(a?.tipo)) throw new Error(`${etiqueta} — ampliación ${k + 1} con tipo "${a?.tipo}" (usa ${TIPOS_AMPLIACION.join(", ")}).`);
        if (secciones.length && !secciones.some((x) => normalizar(x) === normalizar(a?.seccion))) {
          throw new Error(`${etiqueta} — ampliación "${a.texto}" sin sección del producto que la justifique.`);
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
    }
    if (startDia + idx === contrato.sesiones && !String(clase?.entregaFase || "").trim()) {
      throw new Error(`${etiqueta} es la última de la fase y no declara "entregaFase" (${contrato.entrega.texto}).`);
    }
  }
  if (motivos44.length) throw new Error(`Redacción 4.4 (${motivos44.length}): ${motivos44.join("; ")}.`);
};

/** Validación de la fase completa: cada fase deja su entrega y avanza sus secciones. */
export const validarFaseCompleta = (clases, contrato) => {
  if (!Array.isArray(clases) || clases.length < contrato.sesiones) {
    throw new Error(`Contrato: la fase ${contrato.numero} tiene ${clases?.length ?? 0} de ${contrato.sesiones} clases.`);
  }
  const avanzadas = new Set(clases.flatMap((c) => listaTextos(c?.seccionesProducto)).map(normalizar));
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
      const conTema = actividades.filter((a) => a.includes(tema)).length;
      if (conTema > 1) avisos.push(`${ref}: el tema «${tema}» se repite en ${conTema} actividades`);
      if (actividades.some((a) => a.includes(`sobre ${tema}`))) avisos.push(`${ref}: una actividad dice «sobre ${tema}»; exprésalo con elementos concretos`);
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
    if (cortas) avisos.push(`${ref}: ${cortas} actividad(es) del Desarrollo con menos de ${MIN_PALABRAS_DESARROLLO} palabras; la síntesis lleva 25-35`);
    (dia.momentos || []).flatMap((m) => m.actividades || []).forEach((a) => {
      const cursivas = String(a).match(/(^|[^\w])_(?!\s)[^_]+?_(?!\w)/g) || [];
      if (cursivas.length > 2) avisos.push(`${ref}: una actividad cita ${cursivas.length} expresiones; van 1 o 2 en cursiva con puntos suspensivos`);
    });
  }));
  return { errores, avisos };
};
