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

export const TIPOS_AMPLIACION = ["vocabulario", "gramatica", "expresion", "funcion"];
const CATEGORIAS_SEMILLA = ["vocabulario", "gramatica", "expresiones", "funcionales"];

const error = (msg) => new Error(`Redacción por fase: ${msg}`);
const normalizar = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9ñ' ]+/g, " ").replace(/\s+/g, " ").trim();
// Las etiquetas de categoría ("Vocabulario:", "Gramática:") no cuentan como coincidencia.
const STOP = new Set(["para", "with", "from", "that", "this", "your", "como", "sobre", "entre", "the", "and", "una", "unos", "unas", "los", "las", "del", "con", "por", "que",
  "vocabulario", "gramatica", "expresion", "expresiones", "funcion", "funciones", "funcional", "funcionales", "estructura", "estructuras"]);
const sinEtiqueta = (s) => String(s ?? "").replace(/^\s*(vocabulario|gram[aá]tica|expresi[oó]n(es)?|funci[oó]n(es)?|funcionales?)\s*:\s*/i, "");
const palabras = (s) => normalizar(sinEtiqueta(s)).split(" ").filter((w) => w.length >= 4 && !STOP.has(w));
const coincide = (a, b) => {
  const na = normalizar(sinEtiqueta(a));
  const nb = normalizar(sinEtiqueta(b));
  return Boolean(na && nb && (na.includes(nb) || nb.includes(na)));
};
const compartePalabra = (a, b) => {
  const pb = new Set(palabras(b));
  return palabras(a).some((w) => pb.has(w));
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
  // Lo trabajado en las fases anteriores: base de las fases sin contenido.
  const trabajado = plan.fases.slice(0, indice)
    .flatMap((f) => CATEGORIAS_SEMILLA.flatMap((cat) => (f.contenidos?.[cat] || []).map((c) => c.texto)));

  return {
    numero: indice + 1,
    total: plan.fases.length,
    nombre: fase.nombre,
    fasesGuia: [...(fase.fasesGuia || [])],
    roles: [...(fase.roles || [])],
    proposito: [...new Set((fase.roles || []).map((r) => PROPOSITO_POR_ROL[r]).filter(Boolean))].join(" "),
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
export const validarLoteContrato = (data, contrato, count, startDia = 1) => {
  const semilla = semillaPlana(contrato);
  const secciones = contrato.secciones;
  for (let idx = 0; idx < count; idx += 1) {
    const clase = data?.clases?.[idx];
    const etiqueta = `Contrato: clase ${idx + 1}`;
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
      const fuera = usada.find((u) => !semilla.some((s) => coincide(u, s)));
      if (fuera) throw new Error(`${etiqueta} — "${fuera}" no es un contenido de la malla de esta fase; lo añadido va en "ampliacion".`);
      ampliacion.forEach((a, k) => {
        if (!String(a?.texto || "").trim()) throw new Error(`${etiqueta} — ampliación ${k + 1} sin texto.`);
        if (!TIPOS_AMPLIACION.includes(a?.tipo)) throw new Error(`${etiqueta} — ampliación ${k + 1} con tipo "${a?.tipo}" (usa ${TIPOS_AMPLIACION.join(", ")}).`);
        if (secciones.length && !secciones.some((x) => normalizar(x) === normalizar(a?.seccion))) {
          throw new Error(`${etiqueta} — ampliación "${a.texto}" sin sección del producto que la justifique.`);
        }
      });
      // Foco ajustado a 4.6: la semilla o lo añadido para el producto, no
      // necesariamente una estructura literal de la malla.
      const foco = String(clase?.focoLinguistico || "");
      // 4.6: el contenido nunca es el protagonista del día — el foco no puede
      // ser una etiqueta de la malla ni una palabra suelta de la semilla.
      if (/^\s*(vocabulario|gram[aá]tica|expresi[oó]n(es)?|funci[oó]n(es)?|funcionales?)\s*:/i.test(foco)
        || semilla.some((s) => normalizar(sinEtiqueta(s)) === normalizar(sinEtiqueta(foco)))) {
        throw new Error(`${etiqueta} — "focoLinguistico" no puede ser una etiqueta de la malla ni una palabra de la semilla: nombra lo que la sección necesita comunicar.`);
      }
      const base = [...usada, ...ampliacion.map((a) => a.texto)];
      if (!base.some((b) => coincide(foco, b) || compartePalabra(foco, b))) {
        throw new Error(`${etiqueta} — "focoLinguistico" («${foco.slice(0, 90)}») no corresponde a la semilla usada ni a la ampliación declarada (${base.slice(0, 4).join(" · ").slice(0, 160)}): incluye en el foco uno de esos textos exactos.`);
      }
    }
    if (startDia + idx === contrato.sesiones && !String(clase?.entregaFase || "").trim()) {
      throw new Error(`${etiqueta} es la última de la fase y no declara "entregaFase" (${contrato.entrega.texto}).`);
    }
  }
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
  return { errores, avisos };
};
