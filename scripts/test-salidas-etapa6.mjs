/**
 * test-salidas-etapa6.mjs — Etapa 6 (docs/DISENO_CORAZON_DOCENTEOS.md, sección 6).
 *
 * Con los indicadores estructurados de Inglés 2do: recorte del indicador para
 * el registro (unión ", … y", "y" → "e" ante sonido /i/), trozos del
 * indicador completo para la plantilla, aspecto del registro y validador
 * global de la unidad con plan maestro (capa 5).
 *
 * Ejecutar: node scripts/test-salidas-etapa6.mjs
 */
import {
  recortarIndicador, segmentarIndicador, validarUnidadPlanMaestro, validarFaseCompleta,
} from "../src/services/redaccionFaseService.js";
import { generarAspectosDesdeCapa } from "../src/services/hiloPedagogico.js";
import { INDICADORES_INGLES_2DO_ESTRUCTURADOS as IND, recomponerIndicador } from "../src/data/indicadoresIngles2doEstructurados.js";

let pasos = 0, fallos = 0;
const check = (n, fn) => { try { fn(); pasos += 1; console.log(`  ✓ ${n}`); } catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); } };
const assert = (c, m) => { if (!c) throw new Error(m); };
const igual = (a, b, m) => assert(JSON.stringify(a) === JSON.stringify(b), `${m}\n      esperado: ${JSON.stringify(b)}\n      obtenido: ${JSON.stringify(a)}`);
const ind = (id) => IND.find((i) => i.id === id);

console.log("Etapa 6 — salidas:");

check("recorte: aspectos unidos con ', … y' y cierre conservado", () => {
  igual(recortarIndicador(ind("ING-2-I01"), [["su entorno inmediato", "actividades cotidianas", "planes"]]),
    "Responde de forma adecuada a preguntas e indicaciones, a partir de la escucha o lectura de textos breves y sencillos que contienen información sobre su entorno inmediato, actividades cotidianas y planes.",
    "I01");
});

check("recorte: 'y' → 'e' ante sonido /i/, no ante 'hie'; dos listas con su enlace literal", () => {
  igual(recortarIndicador(ind("ING-2-I09"), [["ayuda"], ["actividades cotidianas", "intereses"]]),
    "Interactúa de forma oral y escrita para solicitar o proveer ayuda sobre situaciones y problemas relativos a actividades cotidianas e intereses, utilizando con claridad frases y oraciones breves y sencillas.",
    "I09");
  const falso = { tronco: "T ", listas: [{ aspectos: ["hielo", "agua"], enlaces: [" y ", ""] }], entre: [], cierre: "." };
  igual(recortarIndicador(falso, [["agua", "hielo"]]), "T agua y hielo.", "hie no pide 'e'");
  igual(recortarIndicador(falso, [["agua", "historia"]]), "T agua e historia.", "hi pide 'e'");
});

check("trozos: unidos dan el indicador oficial y marcan solo lo elegido", () => {
  for (const base of IND) {
    const marcados = base.listas.map((l) => l.aspectos.slice(0, 1));
    const trozos = segmentarIndicador(base, marcados);
    igual(trozos.map((t) => t.texto).join(""), recomponerIndicador(base), `${base.id} completo`);
    igual(trozos.filter((t) => t.elegido).map((t) => t.texto), marcados.flat(), `${base.id} elegidos`);
  }
  igual(segmentarIndicador(ind("ING-2-I05"), []), [{ texto: recomponerIndicador(ind("ING-2-I05")), elegido: false }], "sin aspectos: un trozo");
});

check("registro: el aspecto es el recorte; sin recorte, la versión corta de antes", () => {
  const capa = { indicadoresSeleccionados: [
    { id: "ING-2-I01", descripcion: recomponerIndicador(ind("ING-2-I01")), aspecto: "Responde … sobre su entorno inmediato." },
    { id: "ING-2-I02", descripcion: recomponerIndicador(ind("ING-2-I02")) },
  ] };
  const [a, b] = generarAspectosDesdeCapa(capa, { planificacionId: "p1", cursoId: "c1", ahora: "x" });
  igual(a.aspectoVisible, "Responde … sobre su entorno inmediato.", "con recorte");
  igual(a.textoIndicadorOriginal, recomponerIndicador(ind("ING-2-I01")), "texto completo conservado");
  assert(b.aspectoVisible.startsWith("Produce textos breves") && b.aspectoVisible.length <= 72, "sin recorte, acortado");
});

// Unidad mínima con plan maestro: 2 fases, cada una con su entrega.
const clase = (n, extra = {}) => ({
  numeroGlobal: n,
  indicadoresTrabajados: [],
  seccionesProducto: [],
  entregaFase: "",
  momentos: [{ nombre: "Desarrollo", actividades: ["Leen un aviso de la biblioteca.", "Escriben indicaciones para llegar a la cafetería."] }],
  ...extra,
});
const unidadBase = () => ({
  metadatos: { titulo: "Escuela y educación", productoFinal: "Our School Survival Guide" },
  planMaestro: {
    producto: "una guía de la escuela", temas: ["Escuela y educación"],
    fases: [
      { nombre: "Gestión del conocimiento", entrega: { estado: "Insumos recopilados", texto: "Insumos", secciones: ["Welcome"] }, indicadores: [{ id: "ING-2-I01", aspectosElegidos: [[]] }] },
      { nombre: "Aplicación", entrega: { estado: "Versión final", texto: "Versión final", secciones: ["Important Places"] }, indicadores: [] },
    ],
  },
  fasesSemanales: [
    { numero: 1, dias: [clase(1, { indicadoresTrabajados: ["ING-2-I01"], seccionesProducto: ["Welcome"], entregaFase: "Insumos de Welcome" })] },
    { numero: 2, dias: [clase(2, { seccionesProducto: ["Important Places"], entregaFase: "Versión final" })] },
  ],
});

check("validador global: unidad completa → sin errores ni avisos; sin plan → nada", () => {
  igual(validarUnidadPlanMaestro(unidadBase()), { errores: [], avisos: [] }, "completa");
  igual(validarUnidadPlanMaestro({ fasesSemanales: [] }), { errores: [], avisos: [] }, "sin plan");
});

check("validador global: indicador sin actividad, fase sin entrega o sin sus secciones → error", () => {
  const u = unidadBase();
  u.fasesSemanales[0].dias[0].indicadoresTrabajados = [];
  u.fasesSemanales[1].dias[0].entregaFase = "";
  u.fasesSemanales[1].dias[0].seccionesProducto = [];
  const { errores } = validarUnidadPlanMaestro(u);
  assert(errores.some((e) => /ING-2-I01 no tiene ninguna actividad/.test(e)), "indicador");
  assert(errores.some((e) => /fase 2 .* no deja su entrega/.test(e)), "entrega");
  assert(errores.some((e) => /no avanza Important Places/.test(e)), "secciones");
});

check("validador global: producto o tema repetido entre actividades y 'sobre {tema}' → aviso", () => {
  const u = unidadBase();
  u.fasesSemanales[0].dias[0].momentos = [
    { nombre: "Desarrollo", actividades: ["Leen la sección Welcome de Our School Survival Guide.", "Escriben en Our School Survival Guide.", "Conversan sobre escuela y educación."] },
  ];
  const { errores, avisos } = validarUnidadPlanMaestro(u);
  igual(errores, [], "sin errores");
  assert(avisos.some((a) => /clase 1: el nombre del producto se repite en 2/.test(a)), "producto");
  assert(avisos.some((a) => /sobre escuela y educacion/.test(a)), "sobre tema");
});

check("fase completa: cada indicador propio lo declara alguna clase; los retomados no se exigen", () => {
  const contrato = {
    numero: 4, sesiones: 1, entrega: { estado: "Borrador", texto: "Borrador", secciones: [] },
    indicadores: [{ id: "ING-2-I02", retoma: false }, { id: "ING-2-I05", retoma: false }],
  };
  const clases = [{ seccionesProducto: [], entregaFase: "Borrador", indicadoresTrabajados: ["ING-2-I05"] }];
  let msg = "";
  try { validarFaseCompleta(clases, contrato); } catch (e) { msg = e.message; }
  assert(/fase 4 ninguna clase declara ING-2-I02/.test(msg), `mensaje: ${msg}`);
  clases[0].indicadoresTrabajados.push("ING-2-I02");
  validarFaseCompleta(clases, contrato);
  validarFaseCompleta([{ entregaFase: "x", indicadoresTrabajados: [] }],
    { ...contrato, indicadores: [{ id: "ING-2-I01", retoma: true }] });
});

console.log(`\n${pasos} ✓ · ${fallos} ✗`);
if (fallos) process.exit(1);
