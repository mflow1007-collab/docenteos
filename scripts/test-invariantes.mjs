/**
 * test-invariantes.mjs — Invariantes del motor (CLAUDE.md), en las dos unidades de referencia.
 *
 * Sin IA:     node scripts/test-invariantes.mjs
 * Con JSON:   node scripts/test-invariantes.mjs --alimentacion a.json --escuela e.json
 *             añade lo que escribe la IA, sobre la última generación de cada unidad.
 *
 * Cada invariante se mide como dice CLAUDE.md. Un fallo no se ajusta aquí para que pase:
 * se arregla el motor o se le pregunta a César. Código de salida 1 si algo falla.
 */
import { readFileSync } from "node:fs";
import {
  armarMapaClases, ponerSecuencias, conFichaDeUnidad, evaluacionDeFila, humanosDeFila, didacticosDeFila,
  focoDeFila, fallosQueDetienen, organizadorDesdeMapa, INICIO_PRIMERA_CLASE, TOPE_INDICADORES_POR_CLASE, inicioPresentacion,
} from "../src/services/mapaClasesService.js";
import { armarEntradaPlanMaestro, prellenarPlanMaestro, resolverIndicadoresEstructurados, competenciasDeMalla } from "../src/services/vistaPreviaPlanMaestroService.js";
import { ALCANCE_POR_SEMILLA, DETALLE_TAREA, LUGARES_NO_DECLARADOS } from "../src/data/tareasPorTipoTrabajo.js";
import { componerSituacion } from "../src/services/situacionAprendizajeService.js";

const malla = JSON.parse(readFileSync(new URL("../src/data/curriculo/mallas/malla_ingles_2do_secundaria_2023.json", import.meta.url), "utf8"));
const estructura = resolverIndicadoresEstructurados(malla);
const competencias = competenciasDeMalla(malla, estructura.indicadores);
const fuentePrompt = readFileSync(new URL("../src/services/phaseAService.js", import.meta.url), "utf8");
const fuenteGenerador = readFileSync(new URL("../src/services/unidadAprendizajeService.js", import.meta.url), "utf8");
const normal = (t) => String(t ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const EQUIPOS = /\b(videos?|proyector(es)?|retroproyector(es)?|parlantes?|bocinas?|computadoras?|laptops?|tablets?|celular(es)?|grabador(as|es)?)\b/i;

const unidad = (titulo, numSemanas) => {
  const base = { grado: "2do Secundaria", asignatura: "Inglés", centro: "Centro de prueba - Hato Nuevo", numSemanas, diasClase: ["l", "m", "x"], horasPorDia: 1, titulo };
  const datos = conFichaDeUnidad({ ...base, ...prellenarPlanMaestro({ datos: base, indicadores: estructura.indicadores, competencias }) });
  const { entrada } = armarEntradaPlanMaestro({ datos, mallaPayload: malla });
  const mapa = armarMapaClases(entrada);
  const s = datos.planMaestro.situacion;
  const alcance = ALCANCE_POR_SEMILLA[s.semillaId]?.conInvitado || null;
  ponerSecuencias(mapa, { producto: entrada.producto || s.productoDescripcion, tema: titulo, audiencia: s.audiencia, invitado: alcance?.invitadoConArticulo || alcance?.invitado || "", entrega: alcance?.entrega || "", semilla: titulo });
  return { titulo, datos, mapa, alcance, reales: mapa.filas.filter((f) => !f.flexible) };
};

const sumativas = (u) => u.reales.filter((f) => f.tareas.some((t) => t.sumativa));

// Sin IA: lo que decide el mapa.
const invariantesMapa = {
  "I-01": (u) => {
    if (/anterior|retroaliment/i.test(INICIO_PRIMERA_CLASE)) return `el Inicio de C1 mira atrás: ${INICIO_PRIMERA_CLASE}`;
    if (!/^Recuperación de experiencias/.test(INICIO_PRIMERA_CLASE)) return "el Inicio de C1 no recupera experiencias";
    return "";
  },
  "I-02": (u) => {
    const fallos = fallosQueDetienen(u.mapa).filter((m) => /no caben|solo muestra/.test(m));
    if (fallos.length) return fallos.join("; ");
    const pasada = u.reales.find((f) => f.indicadores.length > TOPE_INDICADORES_POR_CLASE);
    return pasada ? `C${pasada.clase} muestra ${pasada.indicadores.length}` : "";
  },
  "I-03": (u) => {
    const presentacion = u.reales.filter((f) => f.tareas.some((t) => t.clave === "presentar"));
    if (!presentacion.length) return "no hay clase de presentación";
    const sin = presentacion.filter((f) => !f.tareas.some((t) => t.clave === "probar_audiencia" && t.indicadores.length));
    return sin.length ? `sin usar el producto con la audiencia: ${sin.map((f) => `C${f.clase}`).join(", ")}` : "";
  },
  "I-04": (u) => {
    const problemas = [];
    u.reales.filter((f) => f.tareas.some((t) => t.clave === "presentar")).forEach((f) => {
      const agente = evaluacionDeFila(f).agente;
      if (normal(agente) !== "heteroevaluacion") problemas.push(`C${f.clase} agente: ${agente}`);
      if (f.tareas.some((t) => /corregir/.test(t.clave))) problemas.push(`C${f.clase} corrige en la presentación`);
    });
    u.reales.filter((f) => f.tareas.some((t) => t.clave === "evaluar_comentarios")).forEach((f) => {
      const claves = f.tareas.map((t) => t.clave);
      const e = evaluacionDeFila(f);
      if (!/^heteroevaluacion/.test(normal(e.agente))) problemas.push(`C${f.clase} agente: ${e.agente}`);
      if (f.secuencia && !f.secuencia.some((x) => /firmad/.test(x.texto))) problemas.push(`C${f.clase} respuesta sin firma`);
      ["corregir_final", "evaluar_proceso"].forEach((c) => { if (claves.includes(c) && claves.indexOf(c) < claves.indexOf("evaluar_comentarios")) problemas.push(`C${f.clase}: ${c} antes de responder`); });
      if (claves.length > 1 && !/formativa/i.test(e.tipo)) problemas.push(`C${f.clase} no separa lo formativo`);
    });
    const orden = u.reales.flatMap((f) => f.tareas.map((t) => t.clave));
    ["corregir_final", "evaluar_proceso"].forEach((c) => { if (orden.indexOf(c) < orden.indexOf("presentar")) problemas.push(`${c} antes de presentar`); });
    return problemas.join("; ");
  },
  "I-05": (u) => {
    const filas = organizadorDesdeMapa(u.mapa, { producto: "P" }).filter((o) => o.operaciones);
    const sinFinal = filas.filter((o) => !/versión final$/i.test(o.fases)).map((o) => o.seccion);
    const sinCiclo = filas.filter((o) => (o.operaciones || []).length < 2).map((o) => o.seccion);
    return [sinFinal.length && `sin versión final: ${sinFinal.join(", ")}`, sinCiclo.length && `sin ciclo: ${sinCiclo.join(", ")}`].filter(Boolean).join("; ");
  },
  "I-06": () => {
    const faltan = ["evaluacionDeFila(filaMapa)", "humanos: humanosDeFila(filaMapa", "desarrollo.evaluacion = { ...desarrollo.evaluacion, ...d.fijoDelMapa.evaluacion }"].filter((x) => !fuenteGenerador.includes(x));
    return faltan.length ? `el código ya no escribe: ${faltan.join(", ")}` : "";
  },
  "I-07": (u) => {
    const critica = { visitar_entrevistar: /una pregunta por estudiante|su propia pregunta/, probar_audiencia: /en parejas/ };
    const problemas = [];
    u.reales.forEach((f) => f.tareas.forEach((t) => {
      if (!critica[t.clave]) return;
      if (!f.secuencia) { problemas.push(`C${f.clase} ${t.clave} sin secuencia`); return; }
      if (!f.secuencia.some((x) => critica[t.clave].test(x.texto))) problemas.push(`C${f.clase} ${t.clave} sin su condición`);
    }));
    return problemas.join("; ");
  },
  "I-08": (u) => {
    const conEquipo = u.reales.filter((f) => EQUIPOS.test(didacticosDeFila(f)) || (f.secuencia || []).some((x) => EQUIPOS.test(x.texto)));
    return conEquipo.length ? `equipos en: ${conEquipo.map((f) => `C${f.clase}`).join(", ")}` : "";
  },
  "I-09": () => (/pesos dominicanos \(RD\$\), nunca en dólares/.test(fuentePrompt) ? "" : "el prompt no fija la moneda"),
  "I-10": () => (/"textoModelo" es un ejemplo ficticio/.test(fuentePrompt) ? "" : "el prompt no separa el modelo del producto"),
  "I-11": (u) => {
    const depende = u.mapa.secciones.some((s) => /Directions|Places/.test(s));
    if (!depende) return "";
    const problemas = [];
    const i = u.reales.findIndex((f) => f.tareas.some((t) => t.clave === "recorrer_lugares"));
    const previas = u.reales.slice(0, Math.max(0, i)).flatMap((f) => f.tareas.map((t) => t.clave));
    if (i < 0) problemas.push("no hay recorrido");
    else if (previas.some((c) => c !== "acordar")) problemas.push(`hay otras tareas antes del recorrido (C${i + 1})`);
    if (!/Model School/.test(fuentePrompt)) problemas.push("el prompt no declara el centro ficticio");
    return problemas.join("; ");
  },
  "I-12": (u) => {
    const problemas = [];
    const s = u.datos.planMaestro.situacion;
    const situacion = componerSituacion({ situacion: s, producto: u.datos.productoFinalTexto, estrategia: u.datos.planMaestro.estrategia });
    if (u.titulo === "Escuela y educación") {
      if (!/6\.º de primaria/.test(s.audiencia)) problemas.push(`audiencia: ${s.audiencia}`);
      if (!/6\.º de primaria/.test(situacion) || /nuevo ingreso/i.test(situacion)) problemas.push("la situación no dice la audiencia configurada");
    }
    if (LUGARES_NO_DECLARADOS.test(situacion) && u.titulo === "Escuela y educación") problemas.push("la situación nombra lugares");
    sumativas(u).forEach((f) => { if (/persona invitada/.test(humanosDeFila(f, u.alcance))) problemas.push(`C${f.clase}: «la persona invitada»`); });
    (u.reales.flatMap((f) => f.secuencia || [])).forEach((x) => { if (/persona invitada/.test(x.texto)) problemas.push("secuencia con «la persona invitada»"); });
    return [...new Set(problemas)].join("; ");
  },
  "I-14": (u) => {
    const inicio = inicioPresentacion(["Responden al saludo."], { producto: "P — descripción", secciones: u.mapa.secciones });
    if (inicio.length !== 5) return "el Inicio de C1 no conserva sus 5 posiciones";
    if (!/^Escuchan la intención pedagógica/.test(inicio[4]) || !/conocer la unidad/.test(inicio[4])) return "la intención no presenta la unidad";
    if (!/escuchan la situación de aprendizaje/.test(inicio[2]) || !/ejemplos del problema/.test(inicio[2]) || !/¿/.test(inicio[2])) return "no se lee la situación con ejemplos del problema";
    const texto = (u.reales[0].secuencia || []).map((x) => x.texto).join(" ");
    const falta = [[/qu[eé] problema/, "qué se trabaja"], [/qu[eé] har[aá]n en cada etapa/, "cómo se hará"], [/c[oó]mo se evaluar[aá]/, "cómo se evalúa"]].filter(([re]) => !re.test(texto)).map(([, n]) => n);
    if (falta.length) return `falta en el Desarrollo: ${falta.join(", ")}`;
    return /inicioPresentacion\(inicio\.actividades/.test(fuenteGenerador) ? "" : "el generador no lo aplica";
  },
  "I-15": (u) => {
    if (!/dia\.focoLinguistico = focoDeFila\(filaMapa\)/.test(fuenteGenerador)) return "el generador no la aplica";
    const vacias = u.reales.filter((f) => !focoDeFila(f)).map((f) => `C${f.clase}`);
    if (vacias.length) return `sin estructura: ${vacias.join(", ")}`;
    const mal = u.reales.filter((f) => f.tareas[0]?.clave === "presentar" && !/sección/.test(focoDeFila(f)) && !f.contenidos.some((c) => c.categoria === "gramatica")).map((f) => `C${f.clase}`);
    return mal.length ? `no corresponde a la tarea: ${mal.join(", ")}` : "";
  },
  "I-13": (u) => {
    const prometidas = u.reales.filter((f) => f.tareas.some((t) => DETALLE_TAREA[t.clave]?.firma));
    if (!prometidas.length) return "ninguna tarea promete firma";
    const sinFirma = prometidas.filter((f) => f.secuencia && !f.secuencia.some((x) => /firm/i.test(x.texto)));
    return sinFirma.length ? `secuencia sin firma: ${sinFirma.map((f) => `C${f.clase}`).join(", ")}` : "";
  },
};

// Con JSON: lo que escribe la IA en la última generación.
const invariantesJson = {
  "I-01": (g) => {
    const inicio = (g.dias[0]?.momentos || []).find((m) => m.nombre === "Inicio")?.actividades || [];
    return inicio.some((a) => /clase anterior|retroalimentaci[oó]n de/i.test(String(a))) ? "C1 mira a una clase anterior" : "";
  },
  "I-03": (g) => (g.textos.some((x) => /pedid|pedir|gu[ií]an|acompa[nñ]an|prueban|usan \(/i.test(x.t) && !/compa[nñ]er/i.test(x.t)) ? "" : "ninguna actividad usa el producto con la audiencia"),
  "I-04": (g, u) => {
    const clase = u.reales.find((f) => f.tareas.some((t) => t.clave === "presentar"))?.clase;
    const e = (g.dias[clase - 1]?.momentos || []).find((x) => x.nombre === "Desarrollo")?.evaluacion;
    return e && normal(e.agente) !== "heteroevaluacion" ? `C${clase}: ${e.agente}` : "";
  },
  "I-08": (g) => {
    const lista = g.textos.filter((x) => EQUIPOS.test(x.t)).map((x) => `C${x.c}: ${x.t.slice(0, 60)}`);
    const recursos = g.dias.flatMap((d, i) => (d.momentos || []).map((m) => ({ c: i + 1, r: `${m.recursos?.tecnologicos || ""} ${m.recursos?.didacticos || ""} ${(m.metacognicion || []).join(" ")}` }))).filter((x) => EQUIPOS.test(x.r)).map((x) => `C${x.c} recursos o metacognición: ${x.r.slice(0, 50)}`);
    return [...lista, ...recursos].slice(0, 4).join(" | ");
  },
  "I-09": (g) => g.textos.filter((x) => /(?<!RD)\$|\bd[oó]lar(es)?\b|\bdollars?\b/i.test(x.t)).map((x) => `C${x.c}: ${x.t.slice(0, 60)}`).slice(0, 3).join(" | "),
  "I-10": (g) => g.dias.flatMap((d, i) => (d.textoModelo?.lineas || []).filter((l) => /falta dato/i.test(l)).map(() => `C${i + 1}`)).join(", "),
  "I-11": (g, u) => {
    if (u.titulo !== "Escuela y educación") return "";
    const lista = g.producto.filter((x) => LUGARES_NO_DECLARADOS.test(x.t)).map((x) => `C${x.c}: ${x.t.slice(0, 60)}`);
    const sinDeclarar = g.dias.flatMap((d, i) => (d.textoModelo?.lineas?.length && !/model school/i.test(d.textoModelo.titulo || "") ? [`C${i + 1} modelo sin declarar`] : []));
    return [...lista, ...sinDeclarar].slice(0, 5).join(" | ");
  },
  "I-12": (g) => (JSON.stringify(g.dias).includes("persona invitada") ? "aparece «la persona invitada»" : ""),
  "I-14": (g) => {
    const de = (n) => ((g.dias[0]?.momentos || []).find((m) => m.nombre === n)?.actividades || []).join(" ");
    return /conocer la unidad/.test(de("Inicio")) && /escuchan la situación de aprendizaje/.test(de("Inicio")) && /ejemplos del problema/.test(de("Inicio")) && /qué problema/.test(de("Desarrollo")) && /en cada etapa/.test(de("Desarrollo")) && /cómo se evaluará/.test(de("Desarrollo")) ? "" : "C1 no presenta la unidad";
  },
  "I-13": (g, u) => {
    const prometidas = u.reales.filter((f) => f.tareas.some((t) => DETALLE_TAREA[t.clave]?.firma)).map((f) => f.clase);
    const faltan = prometidas.filter((c) => !JSON.stringify((g.dias[c - 1]?.momentos || []).find((m) => m.nombre === "Desarrollo")?.actividades || []).match(/firm/i));
    return faltan.length ? `sin firma: ${faltan.map((c) => `C${c}`).join(", ")}` : "";
  },
};

const leerGeneracion = (ruta) => {
  const u = JSON.parse(readFileSync(ruta, "utf8"));
  const dias = (u.fasesSemanales || []).flatMap((f) => f.dias || []);
  const textos = dias.flatMap((d, i) => [
    ...(d.momentos || []).flatMap((m) => (m.actividades || []).map(String)),
    ...(d.textoModelo?.lineas || []),
    ...(d.ampliacion || []).map((a) => a?.texto || ""),
  ].map((t) => ({ c: i + 1, t })));
  // Lo que alimenta el producto: estructura del día, actividades y ampliación, no los textos modelo.
  const producto = dias.flatMap((d, i) => [d.focoLinguistico || "", ...(d.momentos || []).flatMap((m) => (m.actividades || []).map(String)), ...(d.ampliacion || []).map((a) => a?.texto || "")].map((t) => ({ c: i + 1, t })));
  return { dias, textos, producto };
};

const argumento = (nombre) => { const i = process.argv.indexOf(nombre); return i >= 0 ? process.argv[i + 1] : ""; };
const unidades = [
  { u: unidad("Alimentación", 6), json: argumento("--alimentacion") || new URL("./fixtures/unidades/alimentacion-6-semanas-v7.json", import.meta.url).pathname },
  // Unidades de referencia: sin argumento, se revisan estas.
  { u: unidad("Escuela y educación", 4), json: argumento("--escuela") || new URL("./fixtures/unidades/escuela-4-semanas-v4.json", import.meta.url).pathname },
];

let fallos = 0;
const mostrar = (titulo, tabla, generaciones) => {
  console.log(`\n[${titulo}]`);
  Object.keys(tabla).forEach((id) => {
    const celdas = unidades.map(({ u }, k) => {
      if (generaciones && !generaciones[k]) return { txt: "–", msg: "" };
      const msg = String(tabla[id](generaciones ? generaciones[k] : u, u) || "");
      if (msg) fallos += 1;
      return { txt: msg ? "✗" : "✓", msg: msg ? `${u.titulo.split(" ")[0]}: ${msg}` : "" };
    });
    console.log(`${id}  ${celdas.map((c) => c.txt).join(" ")}  ${celdas.map((c) => c.msg).filter(Boolean).join(" // ")}`);
  });
};
console.log("Columnas: Alimentación 6 semanas | Escuela 4 semanas");
mostrar("Sin IA: lo que decide el código", invariantesMapa, null);
const generaciones = unidades.map(({ json }) => (json ? leerGeneracion(json) : null));
if (generaciones.some(Boolean)) mostrar("Última generación: lo que escribe la IA", invariantesJson, generaciones);
console.log(`\nFallos: ${fallos}`);
process.exit(fallos ? 1 : 0);
