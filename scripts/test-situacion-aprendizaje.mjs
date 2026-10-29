/**
 * test-situacion-aprendizaje.mjs — Etapa 4 (docs/DISENO_CORAZON_DOCENTEOS.md, sección 6).
 *
 * Validador de los 5 elementos (Guía 1.2.2), la misma situación compuesta con
 * las 7 estrategias, la recomendación de estrategia (Guía 1.2.4), la
 * realineación al cambiar de estrategia y las secciones del producto (4.7),
 * también dentro del plan maestro con la malla REAL de Inglés 2do.
 *
 * Ejecutar: node scripts/test-situacion-aprendizaje.mjs
 */
import { readFileSync } from "node:fs";
import {
  MAX_CARACTERES_SITUACION, lugaresDelCentro, propuestasParaTemas, situacionVacia, situacionDesdeSemilla, elementosSituacion,
  componerSituacion, validarSituacion, recomendarEstrategia, compararRealineacion, alinearSiNoHay, usarSemilla,
  aceptarRealineacion, fijarCampoSituacion, alternarCompetenciaLlegada, validarSecciones, agregarSeccion,
  renombrarSeccion, quitarSeccion, moverSeccion,
} from "../src/services/situacionAprendizajeService.js";
import {
  PLAN_MAESTRO_INICIAL, calcularVistaPrevia, elegirEstrategia, alternarCompetencia, fijarPartes,
} from "../src/services/vistaPreviaPlanMaestroService.js";
import { SITUACIONES_SEMILLA_INGLES_2DO as SEMILLAS } from "../src/data/situacionesSemillaIngles2do.js";
import { ESTRATEGIAS_FASES_GUIA_2025 } from "../src/data/estrategiasFasesGuia2025.js";
import { INDICADORES_INGLES_2DO_ESTRUCTURADOS as IND } from "../src/data/indicadoresIngles2doEstructurados.js";

let pasos = 0, fallos = 0;
const check = (n, fn) => { try { fn(); pasos += 1; console.log(`  ✓ ${n}`); } catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); } };
const assert = (c, m) => { if (!c) throw new Error(m); };
const igual = (a, b, m) => assert(JSON.stringify(a) === JSON.stringify(b), `${m}\n      esperado: ${JSON.stringify(b)}\n      obtenido: ${JSON.stringify(a)}`);

const malla = JSON.parse(readFileSync(new URL("../src/data/curriculo/mallas/malla_ingles_2do_secundaria_2023.json", import.meta.url), "utf8"));
const porClave = (c) => SEMILLAS.find((s) => s.id === c);
const escuela = porClave("ing2-escuela-guia");
const conSemilla = (semilla, estrategia) => ({ situacion: situacionDesdeSemilla(semilla), producto: semilla.producto.nombre, estrategia });

console.log("\n[Situación de aprendizaje — Etapa 4]");

check("las situaciones semilla son de temas oficiales de Inglés 2do", () => {
  const temas = malla.contenidosPorTema.map((b) => b.tema);
  SEMILLAS.forEach((s) => assert(temas.includes(s.tema), `"${s.tema}" no está en contenidosPorTema`));
  igual(propuestasParaTemas(["Escuela y educación", "Vivienda, entorno y ciudad"]).map((s) => s.id), ["ing2-escuela-guia"], "propuestas");
  igual(propuestasParaTemas(["Bienes y servicios"]), [], "tema sin propuestas");
});

check("lugar: nombre del centro con su artículo; comunidad aparte; sin dato, genérico", () => {
  igual(lugaresDelCentro("Centro Hector Francisco Lopez - Hato Nuevo"), { centro: "el Centro Hector Francisco Lopez", comunidad: "Hato Nuevo" }, "centro y comunidad");
  igual(lugaresDelCentro("Escuela Básica Los Pinos"), { centro: "la Escuela Básica Los Pinos", comunidad: "la comunidad" }, "sin comunidad");
  igual(lugaresDelCentro("Juan Pablo Duarte-Villa Mella"), { centro: "el centro Juan Pablo Duarte", comunidad: "Villa Mella" }, "nombre sin tipo");
  igual(lugaresDelCentro(""), { centro: "el centro", comunidad: "la comunidad" }, "vacío");
});

check("regla de César: dentro del centro se nombra el centro; fuera, la comunidad", () => {
  SEMILLAS.forEach((s) => {
    const fuera = s.rasgos.contexto === "comunidad";
    assert(s.contexto.includes(fuera ? "{comunidad}" : "{centro}"), `${s.id}: falta su lugar`);
    assert(!s.contexto.includes(fuera ? "{centro}" : "{comunidad}"), `${s.id}: lugar equivocado`);
  });
  const centro = "Centro Hector Francisco Lopez - Hato Nuevo";
  igual(situacionDesdeSemilla(escuela, { centro }).contexto, "Cada año, el Centro Hector Francisco Lopez recibe a estudiantes de nuevo ingreso y a visitantes, algunos de ellos de habla inglesa.", "escuela");
  igual(situacionDesdeSemilla(porClave("ing2-alimentacion-menu"), { centro }).contexto, "Los comedores y colmados de Hato Nuevo reciben a turistas y voluntarios extranjeros.", "alimentación");
  igual(usarSemilla(PLAN_MAESTRO_INICIAL, escuela, { centro }).situacion.contexto, situacionDesdeSemilla(escuela, { centro }).contexto, "usarSemilla pasa el centro");
  SEMILLAS.forEach((s) => assert(!/[{}]/.test(componerSituacion({ situacion: situacionDesdeSemilla(s, { centro }), producto: s.producto.nombre, estrategia: "problemas" })), `${s.id}: quedó un hueco`));
});

check("cada semilla × las 7 estrategias: 5 elementos, sin errores, máx. 800 caracteres", () => {
  SEMILLAS.forEach((s) => ESTRATEGIAS_FASES_GUIA_2025.forEach((e) => {
    const { texto, errores } = validarSituacion(conSemilla(s, e.clave));
    igual(errores, [], `${s.id} con ${e.clave}`);
    assert(texto.length <= MAX_CARACTERES_SITUACION, `${s.id} con ${e.clave}: ${texto.length} caracteres`);
    const el = elementosSituacion(conSemilla(s, e.clave));
    Object.entries(el).forEach(([k, v]) => assert(v, `${s.id} con ${e.clave}: falta ${k}`));
    [situacionDesdeSemilla(s).contexto, s.problema, e.nombre, s.producto.nombre, s.puntoDeLlegada.replace(/\.$/, "")]
      .forEach((parte) => assert(texto.includes(parte), `${s.id} con ${e.clave}: el texto no trae "${parte}"`));
  }));
});

check("la misma situación cambia rol y alcance del producto según la estrategia", () => {
  const textos = ESTRATEGIAS_FASES_GUIA_2025.map((e) => componerSituacion(conSemilla(escuela, e.clave)));
  igual(new Set(textos).size, 7, "7 textos distintos");
  assert(textos[ESTRATEGIAS_FASES_GUIA_2025.findIndex((e) => e.clave === "problemas")].includes("como propuesta"), "ABProblemas deja una propuesta");
  assert(textos[ESTRATEGIAS_FASES_GUIA_2025.findIndex((e) => e.clave === "proyectos")].includes("que pondrán en uso"), "ABProyecto pone en uso el producto");
});

check("recomendación: escuela → ABProyecto; alternativas ABProblemas e Inserción", () => {
  const r = recomendarEstrategia(escuela.rasgos);
  igual(r.recomendada.clave, "proyectos", "recomendada");
  igual(r.alternativas.map((a) => a.clave), ["problemas", "insercion_entorno"], "alternativas");
  assert(r.recomendada.porque.length === 4, "explica los 4 criterios");
  assert(/Guía 1\.2\.4/.test(r.recomendada.sentido), "cita la Guía");
});

check("recomendación: rutinas → ABProblemas", () => {
  const r = recomendarEstrategia(porClave("ing2-rutinas-plan").rasgos);
  igual(r.recomendada.clave, "problemas", "recomendada");
  igual(r.alternativas.length, 2, "dos alternativas");
});

check("recomendación: alimentación → Inserción (todavía sin fases); la mejor disponible es ABProyecto", () => {
  const r = recomendarEstrategia(porClave("ing2-alimentacion-menu").rasgos);
  igual(r.recomendada.clave, "insercion_entorno", "recomendada");
  igual(r.recomendada.disponible, false, "no disponible");
  igual(r.mejorDisponible.clave, "proyectos", "mejor disponible");
  igual(r.alternativas.map((a) => a.clave), ["proyectos", "problemas"], "alternativas");
});

check("sin criterios completos no hay recomendación (error visible)", () => {
  let msg = "";
  try { recomendarEstrategia({ naturaleza: "necesidad" }); } catch (e) { msg = e.message; }
  assert(/contexto, producto y su alcance, punto de llegada/.test(msg), `mensaje: ${msg}`);
});

check("validador: situación vacía, problema «no saben inglés», sin competencia, demasiado larga", () => {
  igual(validarSituacion({ situacion: null, producto: "", estrategia: "" }).errores.length, 1, "sin situación");
  const vacia = validarSituacion({ situacion: situacionVacia(), producto: "", estrategia: "proyectos" }).errores;
  ["problema", "contexto", "nombre del producto", "qué es el producto", "a quién va dirigido", "punto de llegada", "competencia"]
    .forEach((t) => assert(vacia.some((e) => e.includes(t)), `falta el error de "${t}"`));
  ["Los estudiantes no saben inglés.", "Presentan dificultades para pedir ayuda en inglés.", "No hablan bien el idioma."].forEach((p) => {
    const sit = { ...situacionDesdeSemilla(escuela), problema: p };
    assert(validarSituacion({ situacion: sit, producto: "X", estrategia: "proyectos" }).errores.some((e) => /no saben el idioma/.test(e)), `no detecta "${p}"`);
  });
  const sinComp = { ...situacionDesdeSemilla(escuela), competenciasLlegada: [] };
  assert(validarSituacion({ situacion: sinComp, producto: "X", estrategia: "proyectos" }).errores.some((e) => /competencia/.test(e)), "competencia");
  const larga = { ...situacionDesdeSemilla(escuela), contexto: "a".repeat(400) };
  assert(validarSituacion({ situacion: larga, producto: "X", estrategia: "proyectos" }).errores.some((e) => /máximo es 800/.test(e)), "largo");
});

check("realineación: cambiar de estrategia muestra antes/después y bloquea hasta aceptar", () => {
  let pm = usarSemilla(elegirEstrategia(PLAN_MAESTRO_INICIAL, "proyectos"), escuela);
  igual(pm.situacion.estrategiaAlineada, "proyectos", "alineada al usar la semilla");
  igual(pm.secciones, escuela.secciones, "secciones de la semilla");
  pm = fijarCampoSituacion(pm, "rolPropio", "asumen el rol de anfitriones del centro y elaboran");
  pm = alinearSiNoHay(elegirEstrategia(pm, "problemas"));
  const prod = escuela.producto.nombre;
  const r = compararRealineacion({ situacion: pm.situacion, producto: prod, estrategia: pm.estrategia });
  assert(r && r.antes.includes("Proyecto") && r.antes.includes("anfitriones"), "antes: ABProyecto con el rol propio");
  assert(r.despues.includes("Problemas") && !r.despues.includes("anfitriones") && r.despues.includes("como propuesta"), "después: ABProblemas realineado");
  assert(validarSituacion({ situacion: pm.situacion, producto: prod, estrategia: pm.estrategia }).errores.some((e) => /cambiaste la estrategia/.test(e)), "pendiente");
  const aceptado = aceptarRealineacion(pm);
  igual(compararRealineacion({ situacion: aceptado.situacion, producto: prod, estrategia: aceptado.estrategia }), null, "sin diferencia tras aceptar");
  igual(validarSituacion({ situacion: aceptado.situacion, producto: prod, estrategia: aceptado.estrategia }).errores, [], "válida tras aceptar");
  const vuelta = alinearSiNoHay(elegirEstrategia(pm, pm.situacion.estrategiaAlineada));
  igual(compararRealineacion({ situacion: vuelta.situacion, producto: prod, estrategia: vuelta.estrategia }), null, "volver a la anterior");
  assert(componerSituacion({ situacion: vuelta.situacion, producto: prod, estrategia: "proyectos" }).includes("anfitriones"), "conserva el rol propio al volver");
});

check("sin estrategia previa, la primera elección alinea sin preguntar", () => {
  let pm = usarSemilla(PLAN_MAESTRO_INICIAL, escuela);
  igual(pm.situacion.estrategiaAlineada, null, "sin alinear");
  pm = alinearSiNoHay(elegirEstrategia(pm, "problemas"));
  igual(pm.situacion.estrategiaAlineada, "problemas", "alineada");
});

check("competencias del punto de llegada en orden fijo", () => {
  let pm = usarSemilla(PLAN_MAESTRO_INICIAL, escuela);
  pm = alternarCompetenciaLlegada(pm, "ambiental_salud");
  igual(pm.situacion.competenciasLlegada, ["etica_ciudadana", "desarrollo_personal", "ambiental_salud"], "añadir");
  pm = alternarCompetenciaLlegada(pm, "etica_ciudadana");
  igual(pm.situacion.competenciasLlegada, ["desarrollo_personal", "ambiental_salud"], "quitar");
});

check("secciones: añadir, renombrar, mover, quitar y validar", () => {
  let pm = { ...PLAN_MAESTRO_INICIAL, secciones: ["Welcome", "Important Places"] };
  pm = agregarSeccion(pm);
  igual(validarSecciones(pm.secciones), ["hay una sección sin nombre."], "vacía");
  pm = renombrarSeccion(pm, 2, "Welcome");
  igual(validarSecciones(pm.secciones), ["secciones repetidas: Welcome."], "repetida");
  pm = renombrarSeccion(pm, 2, "Asking for Help");
  pm = moverSeccion(pm, 2, -1);
  igual(pm.secciones, ["Welcome", "Asking for Help", "Important Places"], "mover");
  igual(moverSeccion(pm, 0, -1), pm, "no sale del borde");
  pm = quitarSeccion(quitarSeccion(pm, 0), 0);
  igual(validarSecciones(pm.secciones), ["el producto necesita al menos 2 secciones."], "mínimo 2");
});

const datosUnidad = (pm) => ({
  titulo: "Escuela y educación", temasSeleccionados: [],
  numSemanas: 4, diasClase: ["Lunes", "Martes", "Miércoles", "Jueves"], horasPorDia: 1,
  productoFinalTexto: escuela.producto.nombre, planMaestro: pm,
});
const pmBase = alternarCompetencia(usarSemilla(elegirEstrategia(PLAN_MAESTRO_INICIAL, "proyectos"), escuela), "ING-2-C01", IND);

check("plan maestro: cada entrega avanza todas las secciones", () => {
  const { plan, error } = calcularVistaPrevia({ datos: datosUnidad(pmBase), mallaPayload: malla });
  assert(!error, error);
  igual(plan.secciones, escuela.secciones, "secciones del plan");
  plan.fases.forEach((f) => igual(f.entrega.secciones, escuela.secciones, `fase ${f.numero}`));
});

check("plan maestro: los avances de una fase subdividida se reparten las secciones", () => {
  const { plan, error } = calcularVistaPrevia({ datos: datosUnidad(fijarPartes(pmBase, 5, 2)), mallaPayload: malla });
  assert(!error, error);
  const aplicacion = plan.fases.filter((f) => f.fasesGuia.includes("Aplicación"));
  igual(aplicacion.map((f) => f.entrega.secciones), [escuela.secciones.slice(0, 3), escuela.secciones.slice(3)], "avances 1 y 2");
  igual(plan.fases[0].entrega.secciones, escuela.secciones, "apertura: todas");
});

check("plan maestro: sección repetida → error visible", () => {
  const { error } = calcularVistaPrevia({ datos: datosUnidad({ ...pmBase, secciones: ["Welcome", "Welcome"] }), mallaPayload: malla });
  assert(/la sección "Welcome" está repetida/.test(error || ""), `error: ${error}`);
});

console.log(`\n${pasos} ✓ · ${fallos} ✗`);
if (fallos) process.exit(1);
