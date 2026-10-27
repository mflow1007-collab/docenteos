/**
 * ejemplo-plan-maestro.mjs — Imprime un plan maestro de ejemplo (Etapa 2) para
 * revisarlo: Inglés 2do, "Escuela y educación" + "Vivienda, entorno y ciudad",
 * ABProyecto, 4 semanas × 4 días × 1 hora. No escribe nada.
 *
 * Ejecutar: node scripts/ejemplo-plan-maestro.mjs [--json]
 */
import { readFileSync } from "node:fs";
import { construirPlanMaestro } from "../src/services/planMaestroService.js";
import { _extraerContenidosMallaCorpus } from "../src/services/unidadAprendizajeService.js";
import { INDICADORES_INGLES_2DO_ESTRUCTURADOS, recomponerIndicador } from "../src/data/indicadoresIngles2doEstructurados.js";

const malla = JSON.parse(readFileSync(new URL("../src/data/curriculo/mallas/malla_ingles_2do_secundaria_2023.json", import.meta.url), "utf8"));
const contenidosDe = (tema) => {
  const c = _extraerContenidosMallaCorpus(malla, tema);
  return { tema, vocabulario: c.vocabulario, gramatica: c.gramatica, expresiones: c.expresiones, funcionales: c.funcionales };
};

const plan = construirPlanMaestro({
  estrategia: "proyectos",
  horario: { semanas: 4, diasClase: ["Lunes", "Martes", "Miércoles", "Jueves"], horasPorDia: 1 },
  producto: "una guía de la escuela para estudiantes nuevos",
  indicadoresEstructurados: INDICADORES_INGLES_2DO_ESTRUCTURADOS,
  competenciasElegidas: ["ING-2-C01", "ING-2-C03"],
  aspectosElegidos: { "ING-2-I09": [["información", "ayuda"], ["actividades cotidianas"]] },
  contenidosPorTema: [contenidosDe("Escuela y educación"), contenidosDe("Vivienda, entorno y ciudad")],
  ajustes: { unir: [[1, 2]] },
});

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(plan, null, 2));
} else {
  const texto = new Map(INDICADORES_INGLES_2DO_ESTRUCTURADOS.map((i) => [i.id, recomponerIndicador(i)]));
  const L = [];
  L.push(`# Plan maestro — ${plan.estrategia.nombre}`);
  L.push(`Producto: ${plan.producto}`);
  L.push(`Temas: ${plan.temas.join(" · ")}`);
  L.push(`Horario: ${plan.horario.semanas} semanas × ${plan.horario.diasClase.length} días × ${plan.horario.horasPorDia} h = ${plan.horario.totalSesiones} sesiones`);
  L.push(`Competencias elegidas: ${plan.competencias.filter((c) => c.elegida).map((c) => c.id).join(", ")}`);
  plan.fases.forEach((f) => {
    L.push("");
    L.push(`## Fase ${f.numero}. ${f.nombre} — ${f.sesiones} sesión(es) (${f.rangoSesiones.desde}-${f.rangoSesiones.hasta})`);
    L.push(`Papel: ${f.roles.join(" + ")} · Entrega: ${f.entrega.texto}`);
    f.indicadores.forEach((i) => {
      const asp = i.aspectosElegidos.some((l) => l.length) ? ` [aspectos: ${i.aspectosElegidos.map((l) => l.join(", ") || "—").join(" | ")}]` : "";
      L.push(`- ${i.id} (${i.accion})${asp}: ${texto.get(i.id)}`);
    });
    for (const [cat, items] of Object.entries(f.contenidos)) {
      if (!items.length) continue;
      L.push(`  ${cat} (${items.length}):`);
      items.forEach((x) => L.push(`    · ${x.texto}  [${x.temas.join(" · ")}]`));
    }
  });
  if (plan.avisos.length) { L.push(""); L.push("Avisos:"); plan.avisos.forEach((a) => L.push(`- ${a}`)); }
  console.log(L.join("\n"));
}
