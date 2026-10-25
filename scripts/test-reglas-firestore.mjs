/**
 * test-reglas-firestore.mjs — Etapa S+ de la hoja de ruta (paso S+.1).
 *
 * Fija con el emulador de Firestore que los bancos compartidos (bp_*, bic_*,
 * ke_estilos) solo admiten creaciones de docentes en su estado inicial y a su
 * propio nombre; promover (approved/official/activo/global) es del admin.
 * S+.2: aiCache es por docente (la clave empieza por su uid).
 * S+.4: aiCuotas solo la escribe el servidor; cada docente lee la suya.
 * Los payloads de "creación legítima" replican lo que escribe hoy el cliente
 * (metaCrear, KnowledgeBank.guardar, StyleEngine.extractStyle, VersionManager).
 *
 * Requiere Java (lo usa el emulador). Ejecutar: npm run test:rules
 * (envuelve este script en `firebase emulators:exec --only firestore`).
 */
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";

const PROJECT_ID = "demo-docenteos";
const DOCENTE = "docente-1";
const OTRO = "docente-2";

let pasos = 0, fallos = 0;
const check = async (n, fn) => {
  try { await fn(); pasos += 1; console.log(`  ✓ ${n}`); }
  catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); }
};

const env = await initializeTestEnvironment({
  projectId: PROJECT_ID,
  firestore: { rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8") },
});

const docente = env.authenticatedContext(DOCENTE, { email: "docente@ejemplo.com", email_verified: true }).firestore();
const admin = env.authenticatedContext("admin-1", { email: "admin@docenteos.com", email_verified: true }).firestore();
const anonimo = env.unauthenticatedContext().firestore();

let n = 0;
const nuevo = (db, col) => doc(db, col, `t${++n}`);

// ── Payloads que escribe hoy el cliente ──────────────────────────────────────
const bpBorrador = (uid = DOCENTE, extra = {}) => ({
  titulo: "Actividad", area: "Lenguas Extranjeras",
  estado: "draft", creadoPor: uid, creadoEn: new Date(), actualizadoEn: new Date(),
  aprobadoPor: null, aprobadoEn: null, ...extra,
});
const bicItem = (uid = DOCENTE, extra = {}) => ({
  nivel: "Secundario", grado: "2do", area: "Lenguas Extranjeras", tema: "School",
  contenido: { semanas: [1] }, fingerprint: "x", calidad: 71,
  vecesUsada: 0, vecesModificada: 0, eliminadoRapido: false, origen: "ia",
  creadoPor: uid, fechaCreacion: new Date(), fechaActualizacion: new Date(),
  archivado: false, ...extra,
});
const estilo = (uid = DOCENTE, extra = {}) => ({
  uid, nombre: "Plantilla", asignatura: "Inglés", grado: "2do", temaOriginal: null,
  estilo: {}, estado: "pendiente", visibilidad: "privada",
  creadoEn: new Date(), actualizadoEn: new Date(), ...extra,
});

const BP = ["bp_temas", "bp_actividades", "bp_instrumentos", "bp_recursos", "bp_neae"];
const BIC = ["bic_planes", "bic_actividades", "bic_instrumentos"];

console.log("\nbp_* (Banco Pedagógico)");
for (const col of BP) {
  await check(`${col}: docente crea borrador propio`, () =>
    assertSucceeds(setDoc(nuevo(docente, col), bpBorrador())));
  await check(`${col}: docente NO crea con estado approved`, () =>
    assertFails(setDoc(nuevo(docente, col), bpBorrador(DOCENTE, { estado: "approved" }))));
}
await check("bp_actividades: docente NO crea official", () =>
  assertFails(setDoc(nuevo(docente, "bp_actividades"), bpBorrador(DOCENTE, { estado: "official" }))));
await check("bp_actividades: docente NO crea sin estado", () => {
  const { estado, ...sinEstado } = bpBorrador();
  return assertFails(setDoc(nuevo(docente, "bp_actividades"), sinEstado));
});
await check("bp_actividades: docente NO crea a nombre de otro", () =>
  assertFails(setDoc(nuevo(docente, "bp_actividades"), bpBorrador(OTRO))));
await check("bp_actividades: anónimo NO crea", () =>
  assertFails(setDoc(nuevo(anonimo, "bp_actividades"), bpBorrador())));
await check("bp_actividades: admin crea official (semilla del modelo)", () =>
  assertSucceeds(setDoc(nuevo(admin, "bp_actividades"), bpBorrador("admin-1", { estado: "official" }))));

console.log("\nbic_* (Banco Inteligente de Conocimiento)");
for (const col of BIC) {
  await check(`${col}: docente crea ítem inicial propio`, () =>
    assertSucceeds(setDoc(nuevo(docente, col), bicItem())));
  await check(`${col}: docente NO infla calidad`, () =>
    assertFails(setDoc(nuevo(docente, col), bicItem(DOCENTE, { calidad: 95 }))));
}
await check("bic_planes: calidad inicial máxima (75) aceptada", () =>
  assertSucceeds(setDoc(nuevo(docente, "bic_planes"), bicItem(DOCENTE, { calidad: 75 }))));
await check("bic_planes: docente NO infla usos", () =>
  assertFails(setDoc(nuevo(docente, "bic_planes"), bicItem(DOCENTE, { vecesUsada: 50 }))));
await check("bic_planes: docente NO crea con calidad no entera", () =>
  assertFails(setDoc(nuevo(docente, "bic_planes"), bicItem(DOCENTE, { calidad: "95" }))));
await check("bic_planes: docente NO crea a nombre de otro", () =>
  assertFails(setDoc(nuevo(docente, "bic_planes"), bicItem(OTRO))));
await check("bic_versiones: docente crea versión propia", () =>
  assertSucceeds(setDoc(nuevo(docente, "bic_versiones"), { planId: "p", tipo: "planes", version: 2, cambios: [], motivoEstimado: "x", creadoPor: DOCENTE, fecha: new Date() })));
await check("bic_versiones: docente NO crea a nombre de otro", () =>
  assertFails(setDoc(nuevo(docente, "bic_versiones"), { planId: "p", creadoPor: OTRO })));
await check("bic_auditorias: docente crea auditoría propia", () =>
  assertSucceeds(setDoc(nuevo(docente, "bic_auditorias"), { planId: "p", resultado: {}, calidad: 70, auditadoPor: DOCENTE, fecha: new Date() })));
await check("bic_auditorias: docente NO crea a nombre de otro", () =>
  assertFails(setDoc(nuevo(docente, "bic_auditorias"), { planId: "p", auditadoPor: OTRO })));

console.log("\nke_estilos");
await check("docente crea estilo pendiente y privado", () =>
  assertSucceeds(setDoc(nuevo(docente, "ke_estilos"), estilo())));
await check("docente NO crea estilo activo", () =>
  assertFails(setDoc(nuevo(docente, "ke_estilos"), estilo(DOCENTE, { estado: "activo" }))));
await check("docente NO crea estilo global", () =>
  assertFails(setDoc(nuevo(docente, "ke_estilos"), estilo(DOCENTE, { visibilidad: "global" }))));
await check("docente NO crea estilo a nombre de otro", () =>
  assertFails(setDoc(nuevo(docente, "ke_estilos"), estilo(OTRO))));
await check("admin crea estilo activo global", () =>
  assertSucceeds(setDoc(nuevo(admin, "ke_estilos"), estilo("admin-1", { estado: "activo", visibilidad: "global" }))));

console.log("\nPromover sigue siendo solo del admin");
const refBp = nuevo(docente, "bp_actividades");
await check("docente crea borrador", () => assertSucceeds(setDoc(refBp, bpBorrador())));
await check("docente NO lo pasa a approved", () =>
  assertFails(updateDoc(refBp, { estado: "approved" })));
await check("admin lo pasa a approved", () =>
  assertSucceeds(updateDoc(doc(admin, "bp_actividades", refBp.id), { estado: "approved" })));

console.log("\naiCache (por docente)");
const cache = (uid, resto = "planificacion:abc.def") => `${uid}:${resto}`;
const entrada = { module: "planificacion", response: "ok", createdAt: new Date(), expiresAt: new Date(), ttlHours: 24 };
await check("docente escribe su propia entrada", () =>
  assertSucceeds(setDoc(doc(docente, "aiCache", cache(DOCENTE)), entrada)));
await check("docente lee su propia entrada", () =>
  assertSucceeds(getDoc(doc(docente, "aiCache", cache(DOCENTE)))));
await check("docente lee su clave semántica aún inexistente (miss)", () =>
  assertSucceeds(getDoc(doc(docente, "aiCache", cache(DOCENTE, "planificacion:sem:x.y")))));
await check("docente NO escribe en la caché de otro", () =>
  assertFails(setDoc(doc(docente, "aiCache", cache(OTRO)), entrada)));
await check("docente NO lee la caché de otro", () =>
  assertFails(getDoc(doc(docente, "aiCache", cache(OTRO)))));
await check("docente NO escribe claves sin uid (formato anterior)", () =>
  assertFails(setDoc(doc(docente, "aiCache", "planificacion:sem:x.y"), entrada)));
await check("docente NO usa su uid como prefijo parcial", () =>
  assertFails(setDoc(doc(docente, "aiCache", `${DOCENTE}x:planificacion:a.b`), entrada)));
await check("docente NO borra su entrada", () =>
  assertFails(deleteDoc(doc(docente, "aiCache", cache(DOCENTE)))));
await check("anónimo NO lee", () =>
  assertFails(getDoc(doc(anonimo, "aiCache", cache(DOCENTE)))));
await check("admin lista toda la caché", () =>
  assertSucceeds(getDocs(collection(admin, "aiCache"))));
await check("docente NO lista toda la caché", () =>
  assertFails(getDocs(collection(docente, "aiCache"))));
await check("admin purga una entrada", () =>
  assertSucceeds(deleteDoc(doc(admin, "aiCache", cache(DOCENTE)))));

console.log("\naiCuotas (solo la escribe el servidor)");
const cuotaId = (uid) => `${uid}_2026-10-25`;
await env.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), "aiCuotas", cuotaId(DOCENTE)), { uid: DOCENTE, fecha: "2026-10-25", usadas: 3 });
  await setDoc(doc(ctx.firestore(), "aiCuotas", cuotaId(OTRO)), { uid: OTRO, fecha: "2026-10-25", usadas: 9 });
});
await check("docente lee su propia cuota", () =>
  assertSucceeds(getDoc(doc(docente, "aiCuotas", cuotaId(DOCENTE)))));
await check("docente NO lee la cuota de otro", () =>
  assertFails(getDoc(doc(docente, "aiCuotas", cuotaId(OTRO)))));
await check("docente NO reinicia su contador", () =>
  assertFails(setDoc(doc(docente, "aiCuotas", cuotaId(DOCENTE)), { uid: DOCENTE, usadas: 0 })));
await check("docente NO crea un contador nuevo", () =>
  assertFails(setDoc(doc(docente, "aiCuotas", `${DOCENTE}_2026-10-26`), { uid: DOCENTE, usadas: 0 })));
await check("docente NO borra su contador", () =>
  assertFails(deleteDoc(doc(docente, "aiCuotas", cuotaId(DOCENTE)))));
await check("admin lee cualquier cuota", () =>
  assertSucceeds(getDoc(doc(admin, "aiCuotas", cuotaId(OTRO)))));
await check("admin tampoco escribe desde el cliente", () =>
  assertFails(setDoc(doc(admin, "aiCuotas", cuotaId(OTRO)), { uid: OTRO, usadas: 0 })));

console.log("\nSin cambios: bancoAprendizaje");
await check("docente crea secuencia cosechada propia", () =>
  assertSucceeds(setDoc(nuevo(docente, "bancoAprendizaje"), { estado: "cosechada", procedencia: { docenteUid: DOCENTE } })));
await check("docente NO crea secuencia validada", () =>
  assertFails(setDoc(nuevo(docente, "bancoAprendizaje"), { estado: "validada", procedencia: { docenteUid: DOCENTE } })));

await env.cleanup();
console.log(`\n${pasos} ok, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
