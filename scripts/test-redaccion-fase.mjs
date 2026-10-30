/**
 * test-redaccion-fase.mjs — Etapa 5 (docs/DISENO_CORAZON_DOCENTEOS.md, sección 6).
 *
 * Con la malla REAL de Inglés 2do: vista previa obligatoria antes de generar,
 * contrato por fase (propósito, entrega, secciones, semilla, indicadores),
 * validador del contrato (regla 4.6: semilla + ampliación marcada; 4.7: piezas
 * por sección) y validación de la fase completa (cada fase deja su entrega).
 *
 * Ejecutar: node scripts/test-redaccion-fase.mjs
 */
import { readFileSync } from "node:fs";
import {
  PLAN_MAESTRO_INICIAL, elegirEstrategia, alternarCompetencia, alternarAspecto,
  prepararPlanMaestroGeneracion, estadoPlanMaestroParaGenerar,
} from "../src/services/vistaPreviaPlanMaestroService.js";
import { usarSemilla, aceptarRealineacion } from "../src/services/situacionAprendizajeService.js";
import {
  construirContratoFase, indicadoresPermitidosFase, validarLoteContrato, validarFaseCompleta,
  recortarIndicador, recogerAmpliacion, repartirSeccionesClases,
  motivoRedaccionActividad, motivosRedaccionClase, validarUnidadPlanMaestro,
} from "../src/services/redaccionFaseService.js";
import { SITUACIONES_SEMILLA_INGLES_2DO as SEMILLAS } from "../src/data/situacionesSemillaIngles2do.js";
import { INDICADORES_INGLES_2DO_ESTRUCTURADOS as IND, recomponerIndicador } from "../src/data/indicadoresIngles2doEstructurados.js";

let pasos = 0, fallos = 0;
const check = (n, fn) => { try { fn(); pasos += 1; console.log(`  ✓ ${n}`); } catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); } };
const assert = (c, m) => { if (!c) throw new Error(m); };
const igual = (a, b, m) => assert(JSON.stringify(a) === JSON.stringify(b), `${m}\n      esperado: ${JSON.stringify(b)}\n      obtenido: ${JSON.stringify(a)}`);
const lanza = (fn, re, m) => {
  try { fn(); } catch (e) { assert(re.test(e.message), `${m}: mensaje inesperado «${e.message}»`); return; }
  throw new Error(`${m}: no lanzó`);
};

const malla = JSON.parse(readFileSync(new URL("../src/data/curriculo/mallas/malla_ingles_2do_secundaria_2023.json", import.meta.url), "utf8"));
const escuela = SEMILLAS.find((s) => s.id === "ing2-escuela-guia");
const horario = { semanas: 3, diasClase: ["Lunes", "Martes", "Miércoles", "Jueves"], horasPorDia: 1 };

let pm = elegirEstrategia(PLAN_MAESTRO_INICIAL, "proyectos");
pm = usarSemilla(pm, escuela, { centro: "Centro Hector Francisco Lopez - Hato Nuevo" });
pm = alternarCompetencia(pm, "ING-2-C01", IND);
pm = alternarAspecto(pm, IND.find((i) => i.id === "ING-2-I01"), 0, "su entorno inmediato");
const datos = {
  titulo: "Escuela y educación",
  temasSeleccionados: ["Escuela y educación"],
  productoFinalTexto: escuela.producto.nombre,
  planMaestro: pm,
};
const prep = prepararPlanMaestroGeneracion({ datos, mallaPayload: malla, horario });
const contratos = prep.plan.fases.map((_, i) => construirContratoFase({ plan: prep.plan, indice: i, estructura: prep.estructura }));
const idxConContenido = contratos.findIndex((c) => c.conContenido);
const cc = contratos[idxConContenido];

console.log("\n[Redacción por fase — Etapa 5]");

check("vista previa completa → plan de 7 fases y situación compuesta", () => {
  igual(prep.aplica, true, "aplica");
  igual(prep.plan.fases.length, 7, "fases ABProyecto");
  igual(prep.plan.horario.totalSesiones, 12, "sesiones = horario del generador");
  assert(prep.situacionTexto.includes("Centro Hector Francisco Lopez"), "situación con el centro");
});

check("vista previa obligatoria: sin estrategia, sin competencias o con situación incompleta → error visible", () => {
  lanza(() => prepararPlanMaestroGeneracion({ datos: { ...datos, planMaestro: PLAN_MAESTRO_INICIAL }, mallaPayload: malla, horario }), /Vista previa del plan maestro.*estrategia/, "sin estrategia");
  lanza(() => prepararPlanMaestroGeneracion({ datos: { ...datos, planMaestro: { ...pm, competenciasElegidas: [], indicadoresElegidos: [], aspectosElegidos: {} } }, mallaPayload: malla, horario }), /ninguna competencia/, "sin competencias");
  lanza(() => prepararPlanMaestroGeneracion({ datos: { ...datos, planMaestro: { ...pm, situacion: { ...pm.situacion, problema: "" } } }, mallaPayload: malla, horario }), /situación.*problema/, "situación incompleta");
  const estado = estadoPlanMaestroParaGenerar({ datos: { ...datos, planMaestro: PLAN_MAESTRO_INICIAL }, mallaPayload: malla, horario });
  igual([estado.aplica, estado.listo], [true, false], "estado para el botón");
});

check("asignatura sin indicadores estructurados → no aplica (genera como antes)", () => {
  const otra = { ...malla, indicadoresLogro: [{ id: "MAT-1-I01", descripcion: "x" }], indicadores: [] };
  igual(prepararPlanMaestroGeneracion({ datos, mallaPayload: otra, horario }), { aplica: false }, "no aplica");
  igual(estadoPlanMaestroParaGenerar({ datos, mallaPayload: otra, horario }), { aplica: false, listo: true, motivo: "" }, "botón libre");
});

check("contrato: propósito, entrega, secciones, estrategia y producto de cada fase", () => {
  contratos.forEach((c, i) => {
    assert(c.proposito, `fase ${i + 1} sin propósito`);
    igual(c.entrega, prep.plan.fases[i].entrega, `fase ${i + 1} entrega`);
    igual(c.secciones, escuela.secciones, `fase ${i + 1} secciones`);
    igual(c.estrategia, "Aprendizaje Basado en Proyecto", "estrategia");
    igual(c.producto, "Our School Survival Guide", "producto");
  });
  igual(contratos.map((c) => c.conContenido), [false, false, true, true, true, false, false], "fases con contenido");
  igual(contratos[0].esApertura, true, "visión compartida es apertura");
});

check("contrato: semilla de la malla solo en fases con contenido; las demás retoman lo trabajado", () => {
  contratos.forEach((c, i) => {
    igual(c.semilla.vocabulario, prep.plan.fases[i].contenidos.vocabulario.map((x) => x.texto), `fase ${i + 1} vocabulario literal`);
  });
  assert(contratos.filter((c) => c.conContenido).every((c) => Object.values(c.semilla).some((l) => l.length)), "fase con contenido sin semilla");
  assert(contratos[5].trabajado.length > 0, "evaluación retoma lo trabajado");
  igual(contratos[2].trabajado, [], "fase con contenido no lleva 'trabajado'");
});

check("contrato: indicadores de la fase, recortados; fases sin indicadores retoman los de la unidad", () => {
  const conPropios = contratos.filter((c) => c.indicadores.some((i) => !i.retoma));
  assert(conPropios.length >= 1, "ninguna fase con indicadores propios");
  const i01 = contratos.flatMap((c) => c.indicadores).find((i) => i.id === "ING-2-I01" && !i.retoma);
  assert(i01.texto.includes("su entorno inmediato") && !i01.texto.includes("estados de salud"), "I01 recortado a su aspecto");
  igual(indicadoresPermitidosFase(contratos[0]).sort(), ["ING-2-I01", "ING-2-I02", "ING-2-I03"], "apertura retoma los de C01");
  const i02 = IND.find((i) => i.id === "ING-2-I02");
  igual(recortarIndicador(i02, i02.listas.map(() => [])), recomponerIndicador(i02), "sin aspectos = completo");
});

check("sin semilla no hay ampliación: fase con contenido sin contenidos → error visible", () => {
  const plan = structuredClone(prep.plan);
  Object.keys(plan.fases[idxConContenido].contenidos).forEach((k) => { plan.fases[idxConContenido].contenidos[k] = []; });
  lanza(() => construirContratoFase({ plan, indice: idxConContenido, estructura: prep.estructura }), /sin semilla no hay ampliación/, "sin semilla");
});

// Clase que cumple el contrato de la fase de conocimiento.
const semilla1 = cc.semilla.vocabulario[0] || cc.semilla.gramatica[0];
const claseOk = (extra = {}) => ({
  focoLinguistico: `${semilla1} + It's next to the library`,
  aporteProducto: "Sección «Important Places»: mapa etiquetado de la escuela",
  seccionesProducto: cc.seccionesPorClase[0],
  semillaUsada: [semilla1],
  ampliacion: [{ texto: "It's next to the library", tipo: "expresion", seccion: "Important Places" }],
  ...extra,
});

// Clase k de la fase (0 = primera) con sus secciones asignadas.
const claseDe = (k, extra = {}) => claseOk({
  seccionesProducto: cc.seccionesPorClase[k],
  aporteProducto: `Sección «${cc.seccionesPorClase[k][0]}»: pieza de la clase ${k + 1}`,
  ...extra,
});

check("secciones por clase: las decide el plan, en orden y sin dejar ninguna", () => {
  const S = ["A", "B", "C", "D", "E", "F"];
  igual(repartirSeccionesClases(S, 2), [["A", "B", "C"], ["D", "E", "F"]], "2 sesiones");
  igual(repartirSeccionesClases(S, 1), [S], "1 sesión");
  igual(repartirSeccionesClases(["A", "B"], 4), [["A"], ["A"], ["B"], ["B"]], "más sesiones que secciones");
  igual(repartirSeccionesClases([], 2), [[], []], "sin secciones");
  contratos.forEach((c) => igual([...new Set(c.seccionesPorClase.flat())], c.entrega.secciones, `fase ${c.numero} cubre su entrega`));
});

check("validador del contrato: clase que cumple pasa", () => {
  validarLoteContrato({ clases: [claseOk()] }, cc, 1, 1);
});

check("validador: la pieza se nombra por la sección, no por el contenido (4.7)", () => {
  lanza(() => validarLoteContrato({ clases: [claseOk({ seccionesProducto: [] })] }, cc, 1, 1), /seccionesProducto/, "sin sección");
  lanza(() => validarLoteContrato({ clases: [claseOk({ seccionesProducto: ["Role cards"] })] }, cc, 1, 1), /no es una sección/, "sección ajena");
  lanza(() => validarLoteContrato({ clases: [claseOk({ seccionesProducto: ["Important Places"] })] }, cc, 1, 1), /que el plan le asigna/, "sección asignada sin avanzar");
  lanza(() => validarLoteContrato({ clases: [claseOk({ aporteProducto: "Role card set de seventh grade" })] }, cc, 1, 1), /debe nombrar la sección/, "pieza por contenido");
});

check("validador 4.6: semilla obligatoria, malla de la unidad permitida, ampliación marcada y foco enriquecible", () => {
  lanza(() => validarLoteContrato({ clases: [claseOk({ semillaUsada: [] })] }, cc, 1, 1), /semillaUsada/, "sin semilla");
  lanza(() => validarLoteContrato({ clases: [claseOk({ semillaUsada: [semilla1, "cafeteria upstairs"] })] }, cc, 1, 1), /no es un contenido de la malla/, "semilla inventada");
  lanza(() => validarLoteContrato({ clases: [claseOk({ ampliacion: [{ texto: "upstairs", tipo: "jerga", seccion: "Important Places" }] })] }, cc, 1, 1), /tipo/, "tipo de ampliación");
  lanza(() => validarLoteContrato({ clases: [claseOk({ ampliacion: [{ texto: "upstairs", tipo: "vocabulario", seccion: "" }] })] }, cc, 1, 1), /sin sección/, "ampliación sin sección");
  // Etapa 6+ (César): el foco puede enriquecerse más allá de lo declarado.
  validarLoteContrato({ clases: [claseOk({ focoLinguistico: "Dar consejos: should (_You should arrive early_…)" })] }, cc, 1, 1);
  // Etapa 6+: otros contenidos de la malla de la unidad valen junto a la semilla de la fase…
  const deOtraFase = cc.mallaUnidad.find((m) => !Object.values(cc.semilla).flat().includes(m));
  assert(deOtraFase, "la malla de la unidad trae contenidos de otras fases");
  validarLoteContrato({ clases: [claseOk({ semillaUsada: [semilla1, deOtraFase] })] }, cc, 1, 1);
  // …pero la semilla de la fase sigue siendo obligatoria.
  lanza(() => validarLoteContrato({ clases: [claseOk({ semillaUsada: [deOtraFase] })] }, cc, 1, 1), /semilla de esta fase/, "sin la semilla de la fase");
  // 4.6: el contenido no es el protagonista: ni etiqueta de la malla ni palabra suelta.
  lanza(() => validarLoteContrato({ clases: [claseOk({ focoLinguistico: `Vocabulario: ${semilla1}; It's next to the library` })] }, cc, 1, 1), /etiqueta de la malla/, "foco con etiqueta");
  lanza(() => validarLoteContrato({ clases: [claseOk({ focoLinguistico: semilla1 })] }, cc, 1, 1), /etiqueta de la malla/, "foco = palabra de la semilla");
  // Foco solo de la ampliación: vale (ya no se exige literal de la malla).
  validarLoteContrato({ clases: [claseOk({ focoLinguistico: "Prepositions of place: It's next to the library" })] }, cc, 1, 1);
});

check("validador: fases sin contenido no amplían ni exigen semilla", () => {
  const ap = contratos[0];
  validarLoteContrato({ clases: [claseOk({ semillaUsada: [], ampliacion: [], focoLinguistico: "Apropiación de la unidad" })] }, ap, 1, 2);
  lanza(() => validarLoteContrato({ clases: [claseOk({ semillaUsada: [] })] }, ap, 1, 2), /ampliacion" debe ir vacía/, "ampliación en apertura");
});

check("cada fase deja su entrega: la última clase la declara y se avanzan sus secciones", () => {
  const ultima = cc.sesiones;
  lanza(() => validarLoteContrato({ clases: [claseDe(ultima - 1)] }, cc, 1, ultima), /entregaFase/, "última sin entrega");
  const clases = Array.from({ length: cc.sesiones }, (_, k) => claseDe(k, {
    entregaFase: k === cc.sesiones - 1 ? cc.entrega.texto : "",
    indicadoresTrabajados: indicadoresPermitidosFase(cc),
  }));
  validarLoteContrato({ clases }, cc, cc.sesiones, 1);
  validarFaseCompleta(clases, cc);
  if (cc.entrega.secciones.length > 1) {
    const sinTodas = clases.map((c) => ({ ...c, seccionesProducto: [cc.entrega.secciones[0]] }));
    lanza(() => validarFaseCompleta(sinTodas, cc), /no avanza/, "secciones sin avanzar");
  }
  lanza(() => validarFaseCompleta(clases.slice(0, -1), cc), /clases/, "fase incompleta");
});

check("la ampliación se recoge aparte, marcada como de DocenteOS", () => {
  const fases = [{ numero: 3, dias: [{ numeroGlobal: 4, ampliacion: [{ texto: "upstairs", tipo: "vocabulario", seccion: "School Directions" }] }] }];
  igual(recogerAmpliacion(fases), [{ texto: "upstairs", tipo: "vocabulario", seccion: "School Directions", fase: 3, clase: 4, origen: "DocenteOS" }], "ampliación");
});

// Lote completo (contrato v1.3 + campos de la fase) para el validador de phaseA.
const loteFase = (over = {}) => ({
  outputSchemaVersion: "1.3",
  semana: cc.numero,
  adaptacionesSemana: {
    acceso: "Plano de la escuela con los lugares rotulados en inglés en el pupitre.",
    metodologicas: "Tarjetas con frases modelo para preguntar dónde queda cada lugar.",
    evaluacion: "Señalar el lugar en el plano en vez de escribir la indicación completa.",
  },
  observacionesSemana: "Registrar quién confunde los lugares de la escuela al rotular el plano.",
  clases: [{
    dia: 1,
    tituloSemana: cc.nombre,
    titulo: "Where Is the Library?",
    estrategiasDia: "Aprendizaje basado en proyecto • Aprendizaje colaborativo",
    intencionPedagogica: "Desde el inicio hasta el final de la clase, los estudiantes rotularán los lugares de la escuela mediante escucha y trabajo en parejas, utilizando el vocabulario de la escuela, completando un plano.",
    indicadoresTrabajados: [indicadoresPermitidosFase(cc)[0]],
    actividadCLT: { nombre: "Listen and Locate", mecanica: "Escuchan indicaciones y ubican cada lugar en el plano." },
    saludoInicial: "Good morning! Who knows where the library is?",
    retroalimentacionPrevia: "Retroalimentación del plan de la guía acordado en la clase anterior. (What sections does our guide have?)",
    saberesPrevios: "Recuperación de saberes previos sobre los lugares de la escuela.",
    actividadEnganche: "Observan fotos de lugares de la escuela y nombran los que conocen.",
    entregaFase: "",
    ...claseOk(),
    momentos: [
      { nombre: "Inicio", tiempo: "10 min", evidencias: { conocimientos: ["Nombra lugares de la escuela en inglés."] }, metacognicion: ["Which places do I know?", "Which words are new?"], recursos: ["Fotos de la escuela", "Pizarra"] },
      {
        nombre: "Desarrollo", tiempo: "30 min",
        actividades: [
          "Escuchan (en parejas, Listen and Locate) indicaciones grabadas y ubican la biblioteca, la cafetería y la dirección en el plano impreso, marcando cada lugar con su número.",
          "Identifican (en parejas) los lugares del plano con el vocabulario de la escuela (_library_, _principal's office_…) y escriben el rótulo en inglés junto a cada uno.",
          "Comparan sus planos con los de otra pareja y corrigen los rótulos con ayuda del banco de palabras pegado en la pizarra del aula.",
          "Elaboran (en equipos) el mapa etiquetado de la escuela para la sección de lugares importantes y lo entregan en una cartulina al final del Desarrollo.",
        ],
        evidencias: { desempeno: ["Ubica cinco lugares de la escuela al escuchar indicaciones."], producto: ["Mapa etiquetado de la escuela con cinco lugares."] },
        metacognicion: ["Which place was hard to find?", "How did my partner help me?"],
        recursos: ["Plano de la escuela", "Banco de palabras"],
      },
      {
        nombre: "Cierre", tiempo: "5 min",
        actividades: [
          "Socializan (en equipos) el mapa con otro equipo y explican dos lugares.",
          "Coevalúan (en parejas) la ortografía de los rótulos con la lista de cotejo.",
          "Mejoran los rótulos señalados y archivan el mapa en la carpeta de la sección.",
        ],
        evidencias: { producto: ["Mapa etiquetado guardado en la carpeta de la guía."] },
        metacognicion: ["What new place can I name?", "What will I improve?"],
        recursos: ["Carpeta de la guía", "Pizarra"],
      },
    ],
    ...over,
  }],
});

const { validateBatch } = await import("../src/services/phaseAService.js");
const optsFase = { semanaNum: cc.numero, indicadoresPermitidos: indicadoresPermitidosFase(cc), contratoFase: cc, startDia: 1, esIdioma: true };

check("phaseA: un lote que cumple el contrato pasa y el foco ya no se exige literal de la malla", () => {
  validateBatch(loteFase(), 45, 1, [], optsFase);
  validateBatch(loteFase({ focoLinguistico: "Prepositions of place: It's next to the library" }), 45, 1, [], optsFase);
});

check("phaseA: el contrato se aplica dentro del validador del lote", () => {
  lanza(() => validateBatch(loteFase({ aporteProducto: "Role card set de seventh grade" }), 45, 1, [], optsFase), /debe nombrar la sección/, "pieza por contenido");
  lanza(() => validateBatch(loteFase({ semillaUsada: [] }), 45, 1, [], optsFase), /semillaUsada/, "sin semilla");
  const otro = contratos.find((c, i) => i !== idxConContenido && c.indicadores.every((x) => x.id !== indicadoresPermitidosFase(cc)[0]));
  if (otro) lanza(() => validateBatch(loteFase(), 45, 1, [], { ...optsFase, indicadoresPermitidos: indicadoresPermitidosFase(otro) }), /no precargados/, "indicador de otra fase");
});

const { construirAnexosUnidad } = await import("../src/services/unidadAprendizajeService.js");
const fasesAnexo = [
  { numero: 3, nombre: "Gestión del conocimiento", dias: [{ aporteProducto: "Sección «Important Places»: mapa etiquetado de la escuela" }] },
  { numero: 5, nombre: "Aplicación", dias: [{ aporteProducto: "Sección «Important Places» (versión final): instrucciones bilingües." }, { aporteProducto: "Sección «Welcome» (versión final): saludo de bienvenida" }] },
];
const baseAnexos = { area: "Inglés", tema: "Escuela y educación", producto: "Our School Survival Guide", vocabulario: ["high school", "freshman"], fases: fasesAnexo };

check("Anexo F: malla primero y la ampliación después, marcada como DocenteOS y sin repetir", () => {
  const { glosario } = construirAnexosUnidad({
    ...baseAnexos,
    ampliacion: [
      { texto: "_library, cafeteria_, Freshman", tipo: "vocabulario", seccion: "Important Places" },
      { texto: "Excuse me, could you help me?", tipo: "expresion", seccion: "Asking for Help" },
      { texto: "can + verbo", tipo: "gramatica", seccion: "Asking for Help" },
    ],
  });
  igual(glosario.map((g) => [g.termino, g.origen]), [
    ["high school", "malla"], ["freshman", "malla"],
    ["library", "DocenteOS"], ["cafeteria", "DocenteOS"], ["Excuse me, could you help me?", "DocenteOS"],
  ], "glosario");
  igual(construirAnexosUnidad(baseAnexos).glosario.map((g) => g.origen), ["malla", "malla"], "sin ampliación, como antes");
});

check("Anexo I: con secciones, una fila por sección con sus piezas; sin secciones, por fases (motor anterior)", () => {
  const { organizadorProducto } = construirAnexosUnidad({ ...baseAnexos, secciones: ["Welcome", "Important Places", "Final Recommendation"] });
  igual(organizadorProducto.map((o) => o.seccion), ["Título", "Welcome", "Important Places", "Final Recommendation"], "filas");
  igual(organizadorProducto[2].incluye, "mapa etiquetado de la escuela; instrucciones bilingües.", "piezas de la sección");
  assert(/plan del producto/.test(organizadorProducto[3].incluye), "sección sin piezas");
  igual(construirAnexosUnidad(baseAnexos).organizadorProducto.map((o) => o.seccion), ["Título", "Fase 3 — Gestión del conocimiento", "Fase 5 — Aplicación", "Cierre"], "por fases");
});

// ─── Inglés 1ro: entra en la ruta del plan maestro ───────────────────────────
const { SITUACIONES_SEMILLA_INGLES_1RO: SEMILLAS1 } = await import("../src/data/situacionesSemillaIngles1ro.js");
const { INDICADORES_INGLES_1RO_ESTRUCTURADOS: IND1 } = await import("../src/data/indicadoresIngles1roEstructurados.js");
const { propuestasParaTemas, validarSituacion, situacionDesdeSemilla } = await import("../src/services/situacionAprendizajeService.js");
const { resolverIndicadoresEstructurados } = await import("../src/services/vistaPreviaPlanMaestroService.js");
const malla1 = JSON.parse(readFileSync(new URL("../src/data/curriculo/mallas/malla_ingles_1ro_secundaria_2023.json", import.meta.url), "utf8"));

check("Inglés 1ro: la malla se reconoce con su clave; cada grado propone sus situaciones", () => {
  igual(resolverIndicadoresEstructurados(malla1).clave, "ingles-1ro", "clave 1ro");
  igual(resolverIndicadoresEstructurados(malla).clave, "ingles-2do", "clave 2do");
  igual(propuestasParaTemas(["Escuela y educación"], "ingles-1ro").map((s) => s.id), ["ing1-escuela-bienvenida"], "1ro");
  igual(propuestasParaTemas(["Escuela y educación"], "ingles-2do").map((s) => s.id), ["ing2-escuela-guia"], "2do");
  igual(propuestasParaTemas(["Escuela y educación"], "frances-1ro"), [], "malla sin semillas");
});

check("Inglés 1ro: situaciones semilla de temas oficiales, válidas con ABProyecto y ABProblemas", () => {
  const temas = malla1.contenidosPorTema.map((b) => b.tema);
  SEMILLAS1.forEach((s) => {
    assert(temas.includes(s.tema), `"${s.tema}" no está en contenidosPorTema de 1ro`);
    ["proyectos", "problemas"].forEach((e) => {
      const { errores } = validarSituacion({ situacion: { ...situacionDesdeSemilla(s, { centro: "Centro Hector Francisco Lopez - Hato Nuevo" }), estrategiaAlineada: e }, producto: s.producto.nombre, estrategia: e });
      igual(errores, [], `${s.id} con ${e}`);
    });
  });
});

check("Inglés 1ro: vista previa → plan maestro → contrato de cada fase", () => {
  SEMILLAS1.forEach((s) => {
    let p = elegirEstrategia(PLAN_MAESTRO_INICIAL, "proyectos");
    p = usarSemilla(p, s, { centro: "Centro Hector Francisco Lopez - Hato Nuevo" });
    p = alternarCompetencia(p, "ING-1-C01", IND1);
    const r = prepararPlanMaestroGeneracion({
      datos: { titulo: s.tema, temasSeleccionados: [s.tema], productoFinalTexto: s.producto.nombre, planMaestro: p },
      mallaPayload: malla1, horario,
    });
    igual(r.aplica, true, `${s.id} aplica`);
    igual(r.plan.secciones, s.secciones, `${s.id} secciones`);
    const cs = r.plan.fases.map((_, i) => construirContratoFase({ plan: r.plan, indice: i, estructura: r.estructura }));
    assert(cs.filter((c) => c.conContenido).every((c) => Object.values(c.semilla).some((l) => l.length)), `${s.id}: fase con contenido sin semilla`);
    assert(cs.every((c) => c.indicadores.every((i) => i.id.startsWith("ING-1-"))), `${s.id}: indicadores de otro grado`);
  });
});

const { medirTamanoDocumento } = await import("../src/utils/tamanoDocumento.js");
check("la copia del plan maestro que se guarda con la unidad es pequeña (< 32 KB)", () => {
  const bytes = medirTamanoDocumento({ planMaestro: { ...prep.plan, situacion: pm.situacion } });
  assert(bytes < 32 * 1024, `ocupa ${bytes} bytes`);
});

check("Etapa 6+: el contrato suma el propósito de la fase de la Guía al del papel; ABProyecto sin cambios", () => {
  const prepCaso = prepararPlanMaestroGeneracion({ datos: { ...datos, planMaestro: aceptarRealineacion(elegirEstrategia(pm, "estudio_caso")) }, mallaPayload: malla, horario });
  const c3 = construirContratoFase({ plan: prepCaso.plan, indice: 2, estructura: prepCaso.estructura });
  igual(c3.nombre, "Socialización del caso", "fase");
  assert(c3.proposito.startsWith("Cada equipo presenta al grupo su análisis del caso."), c3.proposito);
  assert(c3.proposito.includes("producen el borrador"), "propósito del papel");
  igual(contratos[2].proposito.startsWith("Gestionar el conocimiento"), true, "ABProyecto solo con el papel");
});
check("Etapa 6+: las 5 estrategias nuevas arman un contrato por fase con la malla real", () => {
  // Rol propio corto: esta prueba mira los contratos, no el largo de la situación.
  const conRolCorto = (p) => ({ ...p, situacion: { ...p.situacion, rolPropio: "asumen el rol de autores de la guía" } });
  for (const clave of ["indagacion_dialogica", "insercion_entorno", "estudio_caso", "conocimientos_previos", "expositiva"]) {
    const pr = prepararPlanMaestroGeneracion({ datos: { ...datos, planMaestro: conRolCorto(aceptarRealineacion(elegirEstrategia(pm, clave))) }, mallaPayload: malla, horario });
    pr.plan.fases.forEach((_, i) => {
      const c = construirContratoFase({ plan: pr.plan, indice: i, estructura: pr.estructura });
      assert(c.proposito && c.entrega.texto, `${clave} fase ${i + 1}`);
    });
  }
});

// Etapa 7 — regla 4.4 (aprobada por César el 2026-10-29): verbo de la lista,
// organización entre paréntesis tras el verbo, síntesis en el Desarrollo y
// Cierre con un verbo Autónomo o Estratégico. El Inicio canónico no se toca.
const largo = "y escriben el rótulo en inglés junto a cada lugar del plano impreso de la escuela para la sección de lugares importantes.";
check("4.4: verbo de la lista (taxonomía, idioma solo en idiomas, gestión)", () => {
  assert(!motivoRedaccionActividad(`Elaboran (en equipos) el mapa ${largo}`), "taxonomía");
  assert(!motivoRedaccionActividad(`Escuchan (en parejas) un audio ${largo}`, { esIdioma: true }), "idioma");
  assert(/lista de verbos/.test(motivoRedaccionActividad(`Escuchan un audio ${largo}`)), "idioma fuera de idiomas");
  assert(!motivoRedaccionActividad("Socializan (en plenaria) el mapa."), "gestión");
  for (const v of ["Participan", "Realizan", "Guardan", "Reciben", "Acordan", "Recordandon", "Discutan"]) {
    assert(/lista de verbos/.test(motivoRedaccionActividad(`${v} en el Gallery Walk ${largo}`, { esIdioma: true })), v);
  }
});
check("4.4: la organización va en el paréntesis que sigue al verbo", () => {
  assert(/entre paréntesis/.test(motivoRedaccionActividad(`Elaboran ideas en grupo ${largo}`)), "en grupo suelto");
  assert(/entre paréntesis/.test(motivoRedaccionActividad(`Elaboran (Gallery Walk) ideas en parejas ${largo}`)), "fuera del paréntesis");
  assert(!motivoRedaccionActividad(`Representan (en parejas, juego de roles) la llegada ${largo}`, { esIdioma: true }), "dentro");
  assert(!motivoRedaccionActividad(`Escriben un párrafo de bienvenida ${largo}`, { esIdioma: true }), "individual sin paréntesis");
});
check("4.4: la síntesis no rechaza (decisión de César); el Cierre necesita un verbo Autónomo o Estratégico; el Inicio no se valida", () => {
  assert(!motivoRedaccionActividad("Elaboran (en equipos) el mapa de la escuela."), "corta no rechaza");
  const clase = (cierre) => ({ momentos: [
    { nombre: "Inicio", actividades: ["Retroalimentación de la clase anterior."] },
    { nombre: "Desarrollo", actividades: [`Elaboran (en equipos) el mapa ${largo}`] },
    { nombre: "Cierre", actividades: cierre },
  ] });
  igual(motivosRedaccionClase(clase(["Socializan el mapa.", "Coevalúan (en parejas) los rótulos."]), "clase 1"), [], "cierre válido");
  assert(/Autónomo o Estratégico/.test(motivosRedaccionClase(clase(["Socializan el mapa.", "Revisan los rótulos."]), "clase 1")[0] || ""), "cierre sin nivel");
  // Todos los motivos del lote van en un solo rechazo.
  lanza(() => validarLoteContrato({ clases: [claseOk(clase(["Guardan el mapa.", "Socializan ideas en grupo."]))] }, cc, 1, 1),
    /Redacción 4\.4 \(3\):.*Guardan.*en grupo.*Autónomo/, "tres motivos juntos");
});
check("4.4: avisos de progresión por papel y de exceso de expresiones", () => {
  const plan = { fases: [{ nombre: "Evaluación", roles: ["evaluacion"], indicadores: [], entrega: { secciones: [] } }] };
  const dia = (acts) => ({ numeroGlobal: 1, entregaFase: "x", momentos: [{ nombre: "Desarrollo", actividades: acts }] });
  const { avisos } = validarUnidadPlanMaestro({ planMaestro: plan, fasesSemanales: [{ dias: [dia(["Identifican (en parejas) _a_, _b_ y _c_ en el texto."])] }] });
  assert(avisos.some((a) => /nivel autonomo/.test(a)), "progresión");
  assert(avisos.some((a) => /menos de 18 palabras/.test(a)), "síntesis");
  assert(avisos.some((a) => /3 expresiones/.test(a)), "expresiones");
});

console.log(`\n${pasos} ✓ · ${fallos} ✗`);
if (fallos) process.exit(1);
