/**
 * html.js — Utilidades de escape para construir HTML de forma segura.
 *
 * Centraliza el escape que antes estaba duplicado (y desincronizado) en varios
 * servicios que generan documentos imprimibles. Escapa los cinco caracteres
 * sensibles de HTML, INCLUIDAS las comillas, para que sea seguro interpolar
 * tanto en el cuerpo del documento como dentro de atributos (p. ej. title="…").
 */

// Escapa un valor para interpolarlo en HTML sin riesgo de inyección (XSS).
// Cubre & < > " ' — las comillas evitan romper/escapar atributos.
export const escHtml = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Escapa recursivamente los valores string de un objeto/array, preservando la
// estructura. Útil para sanear bloques de metadatos antes de verterlos al HTML.
export const escProfundo = (v) =>
  Array.isArray(v)
    ? v.map(escProfundo)
    : v && typeof v === "object"
      ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, escProfundo(x)]))
      : typeof v === "string"
        ? escHtml(v)
        : v;

// Convierte `_texto_` a cursiva (<em>) SOLO cuando el guion bajo actúa como
// delimitador de énfasis, no como parte de una palabra. Así se preservan los
// códigos curriculares (ING_1_121), identificadores (snake_case) y URLs
// (a_b_c), que antes se rompían con la regex ingenua /_([^_]+)_/.
//   - Apertura: `_` tras inicio/espacio/puntuación y NO seguido de espacio.
//   - Cierre:   `_` NO precedido de espacio y NO seguido de carácter de palabra.
// Funciona con texto ya escapado y es idempotente (no re-envuelve <em> existentes).
export const cursivaMarkdownSegura = (texto) =>
  String(texto ?? "").replace(
    /(^|[^\w])_(?!\s)([^_]+?)(?<!\s)_(?!\w)/g,
    (_m, pre, inner) => `${pre}<em>${inner}</em>`
  );

// Convierte un markdown MUY limitado a HTML seguro: **negrita** → <strong> y
// _cursiva_ → <em>. SIEMPRE escapa primero, de modo que el texto del usuario/IA
// no puede inyectar etiquetas ni atributos; las ÚNICAS etiquetas que produce son
// <strong> y <em> (sin atributos). No interpreta enlaces [x](y), así que no hay
// vector para protocolos peligrosos como javascript:. Es la forma segura de dar
// formato ligero a texto no confiable.
export const markdownLigeroSeguro = (texto) =>
  cursivaMarkdownSegura(
    escHtml(texto).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  );
