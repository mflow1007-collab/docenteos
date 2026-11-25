/**
 * comprobar-unidad.mjs — Lista de comprobación de una unidad ya generada. Sin IA, sin red.
 * Sirve para saber si un punto se sostiene entre corridas, sin gastar en revisar PDFs.
 *
 * Uso: node scripts/comprobar-unidad.mjs unidad.json [otra.json …]
 * Código de salida 1 si algún punto falla en alguna unidad.
 *
 * Son señales de texto, no prueban calidad pedagógica: un punto en verde dice que
 * lo pedido aparece, no que esté bien hecho. Eso sigue siendo lectura humana.
 */
import { readFileSync } from "node:fs";

const normal = (t) => String(t ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const texto = (a) => (typeof a === "string" ? a : Object.values(a || {}).join(" "));
const AUDIENCIA = /\b(dueno|duenos|invitad[oa]s?|visitantes?|audiencia|estudiantes de|familias)\b/;

const momento = (d, nombre) => (d?.momentos || []).find((m) => m?.nombre === nombre) || {};
const actividades = (d, nombre) => (momento(d, nombre).actividades || []).map(texto);
const tipoEval = (d) => String(momento(d, "Desarrollo").evaluacion?.tipo || "");

export const comprobar = (u) => {
  const dias = (u.fasesSemanales || []).flatMap((f) => f.dias || []);
  const sum = dias.filter((d) => /^sumativa/i.test(tipoEval(d)));
  const des = (d) => actividades(d, "Desarrollo").map(normal);
  const todo = dias.flatMap((d, i) => ["Inicio", "Desarrollo", "Cierre"].flatMap((n) => actividades(d, n)).concat(d.textoModelo?.lineas || [], (d.ampliacion || []).map((a) => a?.texto || "")).map((t) => ({ c: i + 1, t })));
  const halla = (re) => todo.filter(({ t }) => re.test(t)).map(({ c, t }) => `C${c}: ${String(t).slice(0, 60)}`);
  const claseCon = (re) => dias.findIndex((d) => des(d).some((a) => re.test(a)));
  const lista = [];
  const punto = (nombre, ok, detalle = "") => lista.push({ nombre, ok: Boolean(ok), detalle: ok ? "" : detalle });

  const c1 = des(dias[0] || {});
  const c1t = c1.join(" ");
  punto("C1 acuerda el plan", /acuerd|acorda|plan|rubrica|grupos editores/.test(c1t) && /\b(acuerdan|definen|conocen|socializan|organizan|comparten)\b/.test(c1t), c1.map((a) => a.slice(0, 40)).join(" | "));
  punto("C1 diagnostica escuchando", /\bescuch/.test(c1t));
  punto("C1 diagnostica leyendo", /\ble[ea]n\b|en el menu|tarea de lectura/.test(c1t));
  punto("C1 diagnostica escribiendo", /\bescrib/.test(c1t));
  // Como en la referencia, la parte oral puede completarse hasta la clase 3.
  const inicioUnidad = dias.slice(0, 3).flatMap(des).join(" ");
  punto("El diagnóstico oral se hace en las primeras clases", /\bresponden\b.*(oral|pareja)|\bconversan|\bintercambi|parejas\).*pregunta|diagnostica oral/.test(inicioUnidad));
  punto("C1 no mira a una clase anterior", !/clase anterior/.test(normal(actividades(dias[0] || {}, "Inicio").join(" "))));

  const iEntrevista = claseCon(/^entrevistan\b/);
  const entrevista = iEntrevista >= 0 ? des(dias[iEntrevista]).join(" ") : "";
  if (iEntrevista >= 0) punto("Entrevista: una pregunta por estudiante", /(una pregunta por estudiante|cada estudiante)/.test(entrevista), `C${iEntrevista + 1}`);

  const iPresenta = dias.findIndex((d) => /^sumativa/i.test(tipoEval(d)) && des(d).some((a) => /^(presentan|muestran)\b/.test(a)));
  punto("Hay presentación en una clase sumativa", iPresenta >= 0);
  if (iPresenta >= 0) {
    const d = dias[iPresenta];
    const lineas = des(d);
    punto("La presentación nombra a la audiencia", lineas.some((a) => /^(presentan|muestran)\b/.test(a) && AUDIENCIA.test(a)), `C${iPresenta + 1}`);
    const hayMenu = /menu/.test(normal(u.planMaestro?.situacion?.productoDescripcion || JSON.stringify(u.planMaestro?.secciones || "")));
    if (hayMenu) {
      const k = lineas.findIndex((a) => /\b(pedid|pedir|pedido)/.test(a));
      punto("Hay pedidos con el menú en la sumativa", k >= 0, `C${iPresenta + 1}`);
      if (k >= 0) {
        punto("Los pedidos son con la audiencia, no con compañeros", AUDIENCIA.test(lineas[k]) && !/companer/.test(lineas[k]), lineas[k].slice(0, 80));
        const minutos = momento(d, "Desarrollo").minutosActividad?.[k];
        punto("Los pedidos tienen al menos 10 minutos", Number(minutos) >= 10, `${minutos} min`);
      }
    }
    punto("La sumativa de presentar es solo heteroevaluación", /^heteroevaluacion$/.test(normal(momento(d, "Desarrollo").evaluacion?.agente)), momento(d, "Desarrollo").evaluacion?.agente);
  }

  const ult = dias[dias.length - 1];
  const fin = des(ult || {});
  const finT = fin.join(" ");
  punto("Clase final: respuesta individual a los comentarios", fin.some((a) => /comentari|tarjeta/.test(a) && /(\(individual|cada estudiante (responde|escribe)|cada quien)/.test(a)), fin.map((a) => a.slice(0, 50)).join(" | "));
  punto("Clase final: corrigen el producto", /\bcorrigen\b/.test(finT));
  punto("Clase final: autoevaluación y coevaluación", /auto.?evalu/.test(finT) && /(co.?evalu|evaluan \(en parejas\))|coevaluacion/.test(finT));
  punto("Clase final: reflexión individual", /reflex/.test(finT));
  punto("Clase final: entrega, no vuelve a presentar", !/para (la )?presentacion/.test(finT));

  punto("Más de una evidencia firmada", dias.flatMap((d) => actividades(d, "Desarrollo")).filter((a) => /\bfirm/i.test(a)).length >= 3);
  const faltaDato = dias.flatMap((d, i) => (d.textoModelo?.lineas || []).filter((l) => /falta dato/i.test(l)).map(() => `C${i + 1}`));
  punto("Ningún texto modelo dice «falta dato»", !faltaDato.length, faltaDato.join(", "));
  const moneda = halla(/(?<!RD)\$|\bd[oó]lar(es)?\b|\bdollars?\b/i);
  punto("Precios en pesos", !moneda.length, moneda.slice(0, 3).join(" | "));
  const equipos = halla(/\b(videos?|proyector(es)?|retroproyector(es)?|parlantes?|bocinas?|grabad[oa]s?|digital(es)?|celular(es)?)\b/i)
    .filter((x) => !/\bsin grab/i.test(x));
  punto("Ninguna clase depende de equipos", !equipos.length, equipos.slice(0, 3).join(" | "));
  const than = halla(/\bthan\b/i);
  punto("Sin comparativos con «than» (fuera de la malla de Inglés 2do)", !than.length, than.slice(0, 3).join(" | "));
  const conTareas = dias.filter((d) => d.tareasMapa?.length);
  if (conTareas.length) {
    const fuera = conTareas.filter((d) => { const n = actividades(d, "Desarrollo").length; return n < 4 || n > 5; }).map((d) => `C${d.numeroGlobal}:${actividades(d, "Desarrollo").length}`);
    punto("El Desarrollo tiene entre 4 y 5 pasos", !fuera.length, fuera.join(", "));
  }
  const pasiva = halla(/\b(is|are) (made|sold|served|cooked)\b/i);
  punto("La voz pasiva aparece al menos dos veces", pasiva.length >= 2, `${pasiva.length}`);
  const crit = (u.competenciasDetalle || []).flatMap((c) => c.criterios || []).length;
  punto("21 criterios", crit === 21, String(crit));
  const kb = Buffer.byteLength(JSON.stringify(u)) / 1024;
  punto("Por debajo de 1 MiB", kb < 1024, `${Math.round(kb)} KB`);
  punto("Una sumativa como mínimo", sum.length >= 1);
  return lista;
};

const archivos = process.argv.slice(2);
if (archivos.length) {
  let fallos = 0;
  const hojas = archivos.map((f) => ({ f: f.split("/").pop(), r: comprobar(JSON.parse(readFileSync(f, "utf8"))) }));
  const nombres = [...new Set(hojas.flatMap((h) => h.r.map((p) => p.nombre)))];
  nombres.forEach((n) => {
    const celdas = hojas.map((h) => { const p = h.r.find((x) => x.nombre === n); if (!p) return "–"; if (!p.ok) fallos += 1; return p.ok ? "✓" : "✗"; });
    const det = hojas.map((h) => h.r.find((x) => x.nombre === n)?.detalle).filter(Boolean).join(" // ");
    console.log(`${celdas.join(" ")}  ${n}${det ? `  [${det.slice(0, 150)}]` : ""}`);
  });
  console.log(`\nArchivos: ${hojas.map((h) => h.f).join(", ")}\nFallos: ${fallos}`);
  process.exit(fallos ? 1 : 0);
}
