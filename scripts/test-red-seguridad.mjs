/**
 * test-red-seguridad.mjs — Etapa 0+ de la hoja de ruta (A4 y A5).
 *
 *  - A4: el tamaño sigue la fórmula oficial de Firestore (el ejemplo de la
 *    documentación da 147 bytes); por encima del umbral seguro se lanza un error
 *    visible ("documento-demasiado-grande") y por debajo pasa. El guardado y la
 *    actualización (merge) miden el documento completo ANTES de escribir.
 *  - A5: cada caída de una fase a la base curricular queda en el resultado
 *    (`fasesBaseCurricular`) y en aiLogs (`logCaidaBaseCurricular`); el registro
 *    nunca rompe la generación (sin sesión no escribe y no lanza). La vista de
 *    la unidad muestra TODOS los avisos, no solo el primero.
 *
 * Ejecutar: node scripts/test-red-seguridad.mjs
 */
import { readFileSync } from "node:fs";
import { serverTimestamp } from "firebase/firestore";
import {
  LIMITE_DOCUMENTO_FIRESTORE,
  UMBRAL_SEGURO_DOCUMENTO,
  medirTamanoDocumento,
  fusionarComoFirestore,
  verificarTamanoDocumento,
} from "../src/utils/tamanoDocumento.js";

let pasos = 0, fallos = 0;
const check = async (n, fn) => {
  try { await fn(); pasos += 1; console.log(`  ✓ ${n}`); }
  catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); }
};
const igual = (a, b, msg = "") => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} esperado ${JSON.stringify(b)}, llegó ${JSON.stringify(a)}`);
};
const leer = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), "utf8");
// Cuerpo de una función `export const nombre = async (…) => { … }` hasta la siguiente exportación.
const cuerpoDe = (src, inicio) => {
  const i = src.indexOf(inicio);
  if (i < 0) throw new Error(`no se encontró ${inicio}`);
  const j = src.indexOf("\nexport ", i + inicio.length);
  return src.slice(i, j < 0 ? undefined : j);
};

// Documento sintético con el tamaño en bytes que se pida ({t: "aaa…"}).
const docDeBytes = (bytes) => ({ t: "a".repeat(bytes - medirTamanoDocumento({ t: "" })) });
const NOMBRE = medirTamanoDocumento({}) - 32; // planificaciones/<id de 20> + 16

console.log("A4 · tamaño del documento");

await check("reproduce el ejemplo oficial de Firestore (147 bytes)", () => {
  const tarea = { type: "Personal", done: false, priority: 1, description: "Learn Cloud Firestore" };
  igual(medirTamanoDocumento(tarea, { coleccion: "users/jeff/tasks", idDocumento: "my_task_id" }), 147);
});

await check("string = UTF-8 + 1 (la ñ cuenta 2); número 8; null y booleano 1", () => {
  igual(medirTamanoDocumento({ a: "n" }) - NOMBRE - 32, 2 + 2);
  igual(medirTamanoDocumento({ a: "ñ" }) - NOMBRE - 32, 2 + 3);
  igual(medirTamanoDocumento({ a: 3.5, b: null, c: true }) - NOMBRE - 32, 3 * 2 + 8 + 1 + 1);
});

await check("mapa anidado = nombres + valores (sin los 32 del documento); array = suma", () => {
  igual(medirTamanoDocumento({ m: { b: 1 } }) - NOMBRE - 32, 2 + (2 + 8));
  igual(medirTamanoDocumento({ l: ["ab", 1] }) - NOMBRE - 32, 2 + 3 + 8);
});

await check("fechas y serverTimestamp() cuentan 8; los undefined no cuentan", () => {
  igual(medirTamanoDocumento({ f: new Date(), s: serverTimestamp(), u: undefined }) - NOMBRE - 32, 2 + 8 + 2 + 8);
});

await check("merge: los mapas se fusionan y los arrays se reemplazan", () => {
  igual(
    fusionarComoFirestore({ contenido: { a: 1, b: { c: 2 } }, x: [1, 2] }, { contenido: { b: { d: 3 } }, x: [9] }),
    { contenido: { a: 1, b: { c: 2, d: 3 } }, x: [9] },
  );
});

await check("el umbral seguro queda por debajo de 1 MiB", () => {
  igual(LIMITE_DOCUMENTO_FIRESTORE, 1048576);
  if (!(UMBRAL_SEGURO_DOCUMENTO < LIMITE_DOCUMENTO_FIRESTORE)) throw new Error("umbral >= límite");
});

await check("una planificación pequeña pasa y devuelve los bytes", () => {
  const datos = { metadatos: { titulo: "Escuela y educación" }, fasesSemanales: [] };
  igual(verificarTamanoDocumento(datos), medirTamanoDocumento(datos));
});

await check("justo en el umbral pasa; un byte más falla", () => {
  igual(verificarTamanoDocumento(docDeBytes(UMBRAL_SEGURO_DOCUMENTO)), UMBRAL_SEGURO_DOCUMENTO);
  let error = null;
  try { verificarTamanoDocumento(docDeBytes(UMBRAL_SEGURO_DOCUMENTO + 1)); } catch (e) { error = e; }
  if (!error) throw new Error("no falló por encima del umbral");
  igual(error.code, "documento-demasiado-grande");
});

await check("un documento de 1.36 MB (el caso real) falla con mensaje visible y el tamaño", () => {
  let error = null;
  try { verificarTamanoDocumento(docDeBytes(1360000)); } catch (e) { error = e; }
  if (!error) throw new Error("no falló");
  igual(error.bytes, 1360000);
  for (const trozo of ["La planificación pesa", "1 MiB", "No se guardó", "PDF"]) {
    if (!error.message.includes(trozo)) throw new Error(`el mensaje no dice "${trozo}": ${error.message}`);
  }
});

await check("guardarPlanificacionDetallada mide el documento completo ANTES de addDoc", () => {
  const cuerpo = cuerpoDe(leer("src/firebase.js"), "export const guardarPlanificacionDetallada");
  const iMedir = cuerpo.indexOf("verificarTamanoDocumento(datosDoc)");
  const iEscribir = cuerpo.indexOf("addDoc(collection(db, \"planificaciones\"), datosDoc)");
  if (iMedir < 0 || iEscribir < 0 || iMedir > iEscribir) throw new Error("no mide antes de escribir");
});

await check("actualizarPlanificacionDetallada mide existente fusionado con el parche ANTES de setDoc", () => {
  const cuerpo = cuerpoDe(leer("src/firebase.js"), "export const actualizarPlanificacionDetallada");
  const iMedir = cuerpo.indexOf("verificarTamanoDocumento(fusionarComoFirestore(snap.data(), parche)");
  const iEscribir = cuerpo.indexOf("setDoc(");
  if (iMedir < 0 || iEscribir < 0 || iMedir > iEscribir) throw new Error("no mide el documento final antes de escribir");
});

await check("Modo Aula muestra los fallos de guardado (no solo en consola)", () => {
  const src = leer("src/pages/ModoAulaPage.jsx");
  if (!src.includes("setErrorRecursos(`El ajuste no se guardó")) throw new Error("recursos: fallo silencioso");
  if (!src.includes("La guía se generó pero no se guardó")) throw new Error("guía: fallo silencioso");
});

console.log("\nA5 · caídas a la base curricular");

await check("logCaidaBaseCurricular sin sesión no escribe ni lanza", async () => {
  const { logCaidaBaseCurricular } = await import("../src/services/ai/usage.js");
  igual(await logCaidaBaseCurricular({ semana: 3, fase: 3, motivo: "Foco: …" }), undefined);
});

await check("la base curricular registra la caída en el resultado y en aiLogs", () => {
  const src = leer("src/services/unidadAprendizajeService.js");
  const i = src.indexOf("const construirWeekPlanBaseCurricular");
  const cuerpo = src.slice(i, src.indexOf("const clasesBase", i));
  for (const trozo of ["advertenciasIA.push(", "fasesBaseCurricular.push(", "logCaidaBaseCurricular("]) {
    if (!cuerpo.includes(trozo)) throw new Error(`falta ${trozo}`);
  }
  if (cuerpo.includes("await logCaidaBaseCurricular")) throw new Error("el registro no debe bloquear la generación");
  if (!src.includes("advertencias: [...advertencias, ...advertenciasIA],\n    fasesBaseCurricular,")) {
    throw new Error("la unidad no expone fasesBaseCurricular");
  }
});

await check("la vista de la unidad muestra todos los avisos y las fases sin IA", () => {
  const src = leer("src/components/ResultadoUnidadAprendizaje.jsx");
  if (!src.includes("unidad.fasesBaseCurricular")) throw new Error("no lee fasesBaseCurricular");
  if (!src.includes("avisosGeneracion.map(")) throw new Error("no lista todos los avisos");
});

console.log(`\n${pasos} ✓ · ${fallos} ✗`);
process.exit(fallos ? 1 : 0);
