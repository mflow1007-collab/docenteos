import { readFileSync } from "fs";
import { createHash } from "crypto";

export const leerPaginas = async (ruta) => {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await getDocument({ data: new Uint8Array(readFileSync(ruta)), verbosity: 0 }).promise;
  const paginas = [];
  for (let n = 1; n <= pdf.numPages; n += 1) {
    const { items } = await (await pdf.getPage(n)).getTextContent();
    paginas.push(items.map((it) => `${it.str}${it.hasEOL ? "\n" : ""}`).join(""));
  }
  return paginas;
};

export const huellaPdf = (ruta) => createHash("sha256").update(readFileSync(ruta)).digest("hex");
