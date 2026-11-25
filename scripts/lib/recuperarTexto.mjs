// Lógica PURA para recuperar el texto de una guía cuyo PDF trae letras mal
// codificadas. Compara palabra por palabra el texto del PDF con un OCR de la misma
// página y solo cambia las palabras que nadie reconoce. Lo que no puede resolver
// queda en `dudosas` para revisión humana: nada se corrige en silencio.

const MARCA_IMPRENTA = /\.ind[bd]\b/;

export const clave = (p) => String(p).normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

export const lineasUtiles = (texto) => String(texto || "")
  .replace(/ﬁ\s*/g, "fi").replace(/ﬂ\s*/g, "fl")
  .split("\n").filter((l) => !MARCA_IMPRENTA.test(l));

const palabras = (texto) => lineasUtiles(texto).flatMap((l) => l.split(/\s+/)).filter(Boolean);

/**
 * Signos y cifras que el PDF guarda desplazados 0x1c posiciones ("\\x1e" es ":",
 * "\\x13" es "/"). Las páginas con "\\x03" usan otra codificación y no se tocan.
 */
export const decodificarControl = (texto) => (/\u0003/.test(texto) ? texto : String(texto)
  .replace(/[\u0004-\u0008\u000b-\u001f]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x1c))
  .replace(/\u0088/g, "•").replace(/\u009e/g, "º").replace(/\u007f/g, "ú"));

/** Palabras confirmadas por PDF y OCR en una misma página, más las de referencia. */
export const construirVocabulario = (paginasPdf, paginasOcr, referencias = []) => {
  const voc = new Set(referencias.flatMap((t) => palabras(t).map(clave)));
  paginasPdf.forEach((t, i) => {
    const ocr = new Set(palabras(paginasOcr[i]).map(clave));
    palabras(t).map(clave).forEach((k) => { if (ocr.has(k)) voc.add(k); });
  });
  return voc;
};

// Símbolos pegados a una letra ("%hora", "=orO", "¿,ay"): señal de letra mal codificada.
const SIMBOLO_PEGADO = /[\u0000-\u001f\u007f]|[%$=+;\\\]^{}|<>]\p{L}|^[¿¡"“«(]*,\p{L}/u;

const conocida = (p, voc) => {
  if (/^\(?https?:/.test(p)) return true;
  const k = clave(p);
  return !SIMBOLO_PEGADO.test(p) && (!k || /^\d+$/.test(k) || voc.has(k));
};

/** Pares de palabras seguidas en los textos de referencia. */
export const construirContexto = (referencias = []) => {
  const pares = new Set();
  for (const t of referencias) {
    const ks = palabras(t).map(clave).filter(Boolean);
    for (let i = 1; i < ks.length; i += 1) pares.add(`${ks[i - 1]} ${ks[i]}`);
  }
  return pares;
};

/** Subsecuencia común más larga de claves: pares [i, j]. */
const alinear = (a, b) => {
  const n = a.length, m = b.length;
  const t = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      t[i][j] = a[i] && a[i] === b[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
    }
  }
  const pares = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] && a[i] === b[j]) { pares.push([i, j]); i += 1; j += 1; }
    else if (t[i + 1][j] >= t[i][j + 1]) i += 1;
    else j += 1;
  }
  return pares;
};

/** Parecido 0..1 por distancia de edición. */
export const parecido = (x, y) => {
  if (!x || !y) return 0;
  let fila = Array.from({ length: y.length + 1 }, (_, k) => k);
  for (let i = 1; i <= x.length; i += 1) {
    const nueva = [i];
    for (let j = 1; j <= y.length; j += 1) {
      nueva[j] = Math.min(fila[j] + 1, nueva[j - 1] + 1, fila[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    }
    fila = nueva;
  }
  return 1 - fila[y.length] / Math.max(x.length, y.length);
};

// En el OCR el pie llega partido: el número de página suelto y la línea de la colección.
const sinPieOcr = (lineas) => {
  const pie = lineas.findIndex((l) => /^(\d+ )?.+ • .+ del Nivel \S+$/.test(l.trim()));
  if (pie < 0) return lineas;
  return lineas.filter((l, i) => i !== pie && !(i === pie - 1 && /^\d{1,3}$/.test(l.trim())));
};

/** Recupera una página. @returns {{ texto, cambios, dudosas, modo }} */
export const recuperarPagina = (textoPdf, textoOcr, voc, { contexto: pares2 = new Set(), usarOcr = false } = {}) => {
  const lineas = lineasUtiles(textoPdf);
  const toks = lineas.flatMap((l, linea) => l.split(/\s+/).filter(Boolean).map((p) => ({ p, linea })));
  const ocr = palabras(textoOcr);
  const malas = toks.filter((t) => !conocida(t.p, voc)).length;
  if (usarOcr || (toks.length >= 10 && malas / toks.length > 0.4)) {
    const dudosas = ocr.filter((p) => !conocida(p, voc)).map((p) => ({ pdf: "", ocr: p }));
    return { texto: sinPieOcr(lineasUtiles(textoOcr)).join("\n"), cambios: [{ de: "(página completa)", a: "(OCR)" }], dudosas, modo: "ocr" };
  }
  const pares = alinear(toks.map((t) => clave(t.p)), ocr.map(clave));
  const cambios = [], dudosas = [];
  const usados = new Set(pares.map(([, j]) => j));
  const contexto = (i) => toks.slice(Math.max(0, i - 3), i + 4).map((t) => t.p).join(" ");
  const limites = [[-1, -1], ...pares, [toks.length, ocr.length]];
  for (let k = 1; k < limites.length; k += 1) {
    const [i0, j0] = limites[k - 1], [i1, j1] = limites[k];
    const seg = [];
    for (let i = i0 + 1; i < i1; i += 1) seg.push(i);
    const jsSeg = [];
    for (let j = j0 + 1; j < j1; j += 1) jsSeg.push(j);
    const cand = jsSeg.map((j) => ocr[j]);
    if (!seg.some((i) => !conocida(toks[i].p, voc))) {
      // Ambas existen pero difieren: solo gana el OCR si la referencia lo respalda.
      if (seg.length !== cand.length || seg.length > 3) continue;
      seg.forEach((i, x) => {
        const antes = clave(toks[i - 1]?.p ?? ""), despues = clave(toks[i + 1]?.p ?? "");
        const apoyo = (p) => Number(pares2.has(`${antes} ${clave(p)}`)) + Number(pares2.has(`${clave(p)} ${despues}`));
        if (/^\d+$/.test(clave(toks[i].p)) && /^\d+$/.test(clave(cand[x]))) return;
        if (conocida(cand[x], voc) && apoyo(cand[x]) > apoyo(toks[i].p)) {
          cambios.push({ de: toks[i].p, a: cand[x], por: "contexto" });
          toks[i].p = cand[x];
          usados.add(jsSeg[x]);
        }
      });
      continue;
    }
    if (seg.length === cand.length && cand.every((p) => conocida(p, voc))) {
      seg.forEach((i, x) => {
        if (conocida(toks[i].p, voc)) return;
        cambios.push({ de: toks[i].p, a: cand[x] });
        toks[i].p = cand[x];
        usados.add(jsSeg[x]);
      });
      continue;
    }
    // No se pierde un número de lista ("3.") que el OCR no leyó.
    while (seg.length > 1 && /^\d+\.$/.test(toks[seg[0]].p) && seg.length > cand.length) seg.shift();
    const largoPdf = seg.map((i) => clave(toks[i].p)).join("").length;
    const largoOcr = cand.map(clave).join("").length;
    if (cand.length && cand.every((p) => conocida(p, voc)) && Math.abs(largoPdf - largoOcr) <= Math.max(3, largoOcr * 0.25)) {
      cambios.push({ de: seg.map((i) => toks[i].p).join(" "), a: cand.join(" ") });
      seg.forEach((i, x) => { toks[i].p = x ? "" : cand.join(" "); });
      jsSeg.forEach((j) => usados.add(j));
      continue;
    }
    for (const i of seg) {
      if (conocida(toks[i].p, voc)) continue;
      const k0 = clave(toks[i].p);
      const mejor = ocr.map((p, j) => [parecido(k0, clave(p)), j])
        .filter(([, j]) => !usados.has(j) && conocida(ocr[j], voc) && clave(ocr[j]).length > 1)
        .sort((x, y) => y[0] - x[0])[0];
      if (mejor && mejor[0] >= 0.6) {
        cambios.push({ de: toks[i].p, a: ocr[mejor[1]] });
        toks[i].p = ocr[mejor[1]];
        usados.add(mejor[1]);
      } else {
        dudosas.push({ pdf: toks[i].p, ocr: cand.join(" ").slice(0, 80), contexto: contexto(i) });
      }
    }
  }
  const salida = lineas.map(() => []);
  toks.forEach((t) => { if (t.p) salida[t.linea].push(t.p); });
  return { texto: salida.map((l) => l.join(" ")).join("\n"), cambios, dudosas, modo: cambios.length ? "palabras" : "pdf" };
};
