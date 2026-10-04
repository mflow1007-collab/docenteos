/**
 * diagnosticoClaveService.js — Deducción de la CLAVE de respuestas por IA
 *
 * El PDF oficial del MINERD NO trae la clave de respuestas. Para poder autocorregir
 * la prueba, la IA deduce la opción correcta de cada ítem de opción múltiple (y una
 * guía de corrección para los abiertos). TODA clave deducida queda marcada
 * `claveEstado: "por_revisar"` — el admin/docente la confirma antes de que se use
 * para autocorregir (fail-closed: nada se corrige solo con una clave sin confirmar).
 *
 * Reusa el gateway de proveedores del proyecto (generarGuiaSemanaRaw → el mismo
 * /api/ai/generate provider-neutral que usa la planificación y la Guía del Maestro),
 * así respeta la config de proveedores/modelos del admin. No introduce un cliente
 * de IA nuevo.
 */

import { generarGuiaSemanaRaw, extraerJSON } from "./phaseAService.js";

const _texto = (v) => String(v ?? "").trim();
const _arr = (v) => (Array.isArray(v) ? v : []);

const SYSTEM = [
  "Eres un especialista del MINERD (República Dominicana) que elabora las claves de",
  "respuesta de evaluaciones diagnósticas de secundaria. Resuelves cada ítem con rigor:",
  "para los de opción múltiple, indicas la ÚNICA opción correcta (la letra); para los",
  "de respuesta abierta, das una guía de corrección breve (qué debe contener una",
  "respuesta correcta). Si un ítem depende de una imagen/gráfico que no está en el",
  "texto, lo indicas con \"requiereImagen\": true y NO inventas la respuesta.",
  "Devuelves EXCLUSIVAMENTE JSON válido, sin markdown.",
].join("\n");

// Construye el prompt de un lote de ítems (una prueba cabe en un lote; es corta).
export const buildPromptClave = (prueba) => {
  const m = prueba.metadatos || {};
  const estimulosPorId = Object.fromEntries(_arr(prueba.estimulos).map((e) => [e.id, e]));
  const items = _arr(prueba.items).map((it) => ({
    numero: it.numero,
    tipo: it.tipo,
    estimulo: it.estimuloId ? _texto(estimulosPorId[it.estimuloId]?.texto).slice(0, 1200) : "",
    enunciado: it.enunciado,
    opciones: _arr(it.opciones),
    requiereImagen: it.requiereImagen || false,
  }));
  return [
    `PRUEBA DIAGNÓSTICA — ${_texto(m.area)} — ${_texto(m.grado)} de Secundaria (MINERD).`,
    "Resuelve cada ítem. Usa el texto del estímulo cuando el ítem lo referencia.",
    "",
    "ÍTEMS (JSON):",
    JSON.stringify(items),
    "",
    "Devuelve un JSON:",
    '{"claves":[ { "numero": <int>,',
    '  "correcta": "<letra a|b|c|d, o \'\' si es abierta o requiere imagen>",',
    '  "justificacion": "<por qué, 1 frase>",',
    '  "guiaAbierta": "<criterio de corrección si es abierta, o \'\'>",',
    '  "requiereImagen": <bool> } ] } con una entrada por ítem, en orden.',
    "Si un ítem de opción múltiple no se puede resolver sin una imagen ausente, deja",
    '"correcta":"" y "requiereImagen":true. JSON puro, sin markdown.',
  ].join("\n");
};

// Aplica las claves deducidas a una prueba. NO confirma: deja claveEstado
// "por_revisar" para los que la IA resolvió, y "requiere_imagen" para los que
// dependen de una imagen ausente. Devuelve una COPIA de la prueba.
export const aplicarClavesAPrueba = (prueba, claves = []) => {
  const porNumero = new Map(_arr(claves).map((c) => [Number(c.numero), c]));
  const items = _arr(prueba.items).map((it) => {
    const c = porNumero.get(Number(it.numero));
    if (!c) return it;
    const letra = _texto(c.correcta).toLowerCase().slice(0, 1);
    const esMultiple = it.tipo === "opcion_multiple";
    if (c.requiereImagen) {
      return { ...it, requiereImagen: true, claveEstado: "requiere_imagen",
        claveJustificacion: _texto(c.justificacion) };
    }
    if (esMultiple && /[a-d]/.test(letra)) {
      return { ...it, claveIA: letra, claveEstado: "por_revisar",
        claveJustificacion: _texto(c.justificacion) };
    }
    // Abierta: guía de corrección, sin clave cerrada.
    return { ...it, respuestaAbiertaGuia: _texto(c.guiaAbierta) || it.respuestaAbiertaGuia,
      claveEstado: it.tipo === "abierta" ? "guia_abierta" : it.claveEstado };
  });
  return { ...prueba, items };
};

// ─── API pública: deduce la clave de una prueba con la IA ─────────────────────
// Devuelve la prueba con claves aplicadas (por_revisar). 1 reintento ante JSON malo.
export const deducirClaveDePrueba = async (prueba) => {
  if (!prueba || !_arr(prueba.items).length) throw new Error("Prueba sin ítems.");
  const prompt = buildPromptClave(prueba);
  let ultimoMotivo = "";
  for (let intento = 0; intento < 2; intento += 1) {
    const { text, stopReason } = await generarGuiaSemanaRaw(prompt, SYSTEM);
    const parsed = extraerJSON(text, stopReason);
    if (!parsed.ok) { ultimoMotivo = parsed.motivo || "JSON inválido"; continue; }
    const claves = _arr(parsed.data?.claves);
    if (!claves.length) { ultimoMotivo = "la IA no devolvió claves"; continue; }
    return aplicarClavesAPrueba(prueba, claves);
  }
  throw new Error(`No se pudo deducir la clave: ${ultimoMotivo}`);
};
