// Recupera el texto de una guía cuyo PDF trae letras mal codificadas.
//
//   swift scripts/ocr_guia.swift GUIA.pdf OCR.json
//   node scripts/recuperar_texto_guia.mjs GUIA.pdf OCR.json SALIDA.json \
//     [--referencia OTRA_EDICION.pdf] [--correcciones CORR.json] [--ocr 102,115]
//
// SALIDA.json lleva el texto por página, la huella del PDF y el informe de cambios.
// No se versiona: el texto de las guías no debe quedar en el repositorio.
// CORR.json: [{ "pagina": 34, "de": "texto exacto", "a": "texto correcto" }]
import { readFileSync, writeFileSync } from "fs";
import { leerPaginas, huellaPdf } from "./lib/leerPdf.mjs";
import { construirContexto, construirVocabulario, decodificarControl, recuperarPagina } from "./lib/recuperarTexto.mjs";

const [rutaPdf, rutaOcr, rutaSalida, ...args] = process.argv.slice(2);
const valorDe = (f) => (args.includes(f) ? args[args.indexOf(f) + 1] : undefined);
if (!rutaSalida) {
  console.error("Uso: node scripts/recuperar_texto_guia.mjs GUIA.pdf OCR.json SALIDA.json [--referencia PDF] [--correcciones JSON] [--ocr 1,2]");
  process.exit(1);
}
const paginas = (await leerPaginas(rutaPdf)).map(decodificarControl);
const ocr = JSON.parse(readFileSync(rutaOcr, "utf8"));
if (ocr.length !== paginas.length) {
  console.error(`❌ El OCR tiene ${ocr.length} páginas y el PDF ${paginas.length}.`);
  process.exit(1);
}
const referencia = valorDe("--referencia") ? await leerPaginas(valorDe("--referencia")) : [];
const correcciones = valorDe("--correcciones") ? JSON.parse(readFileSync(valorDe("--correcciones"), "utf8")) : [];
const conOcr = new Set((valorDe("--ocr") || "").split(",").filter(Boolean).map(Number));

const voc = construirVocabulario(paginas, ocr, referencia);
const contexto = construirContexto(referencia);
const sinUsar = [];
const resultado = paginas.map((t, i) => {
  const r = recuperarPagina(t, ocr[i], voc, { contexto, usarOcr: conOcr.has(i + 1) });
  for (const c of correcciones.filter((x) => x.pagina === i + 1)) {
    if (!r.texto.includes(c.de)) { sinUsar.push(c); continue; }
    r.texto = r.texto.split(c.de).join(c.a);
    r.cambios.push({ de: c.de, a: c.a, por: "revisión" });
    r.dudosas = r.dudosas.filter((d) => {
      const palabra = d.pdf || d.ocr;
      return !c.de.includes(palabra) && !palabra.includes(c.de);
    });
  }
  return r;
});
if (sinUsar.length) {
  console.error("❌ Correcciones que no aparecen en su página:", JSON.stringify(sinUsar));
  process.exit(1);
}
const informe = resultado.map((r, i) => ({ pagina: i + 1, modo: r.modo, cambios: r.cambios, dudosas: r.dudosas }));
const total = (k) => informe.reduce((n, p) => n + p[k].length, 0);
writeFileSync(rutaSalida, JSON.stringify({ huella: huellaPdf(rutaPdf), paginas: resultado.map((r) => r.texto), informe }, null, 1));
console.log(`Páginas: ${informe.length}. Cambios: ${total("cambios")}. Dudosas sin resolver: ${total("dudosas")}.`);
informe.forEach((p) => p.dudosas.forEach((d) => console.log(`  p. ${p.pagina}: ${JSON.stringify(d)}`)));
