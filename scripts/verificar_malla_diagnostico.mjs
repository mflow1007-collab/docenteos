// Verifica, autenticado, qué mallas de Inglés/Lenguas están ACTIVAS en
// curricularContent y si el diagnóstico las encontraría. Solo lectura.
//
// Uso:  node scripts/verificar_malla_diagnostico.mjs TU_EMAIL TU_PASSWORD
//   (escribe email y password directamente en tu terminal; no los pegues en otro lado)
import { readFileSync } from "fs";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, getDocs, query, where, limit } from "firebase/firestore";

const cargarEnv = (archivo) => {
  try {
    for (const l of readFileSync(archivo, "utf8").split("\n")) {
      const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
};
cargarEnv("/Users/cesarbaez/docenteos/.env");
cargarEnv("/Users/cesarbaez/docenteos/.env.local");

const [, , email, password] = process.argv;
if (!email || !password) {
  console.error("Uso: node scripts/verificar_malla_diagnostico.mjs TU_EMAIL TU_PASSWORD");
  process.exit(1);
}

const cfg = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(cfg);
try {
  await signInWithEmailAndPassword(getAuth(app), email, password);
} catch (e) {
  console.error("❌ No se pudo iniciar sesión:", e.code || e.message);
  process.exit(1);
}
const db = getFirestore(app);

const contarInd = (p = {}) =>
  (p.competencias || []).reduce((n, c) => n + ((c.indicadoresLogro || c.indicadores || []).length), 0);

console.log("\n═══ Mallas ACTIVAS en curricularContent ═══");
const snap = await getDocs(query(collection(db, "curricularContent"), where("active", "==", true), limit(300)));
const filas = snap.docs.map((doc) => {
  const d = doc.data();
  const p = d.payload || {};
  return {
    id: doc.id.slice(0, 8),
    level: d.level || p.level || p.nivel || "—",
    grade: d.grade || p.grade || p.grado || "—",
    area: d.area || p.area || "—",
    subject: d.subject || p.subject || p.asignatura || "—",
    contentType: d.contentType || p.contentType || "—",
    indicadores: contarInd(p.competencias ? p : d),
  };
});
console.log(`Total activas: ${filas.length}`);
console.table(filas);

const ingles = filas.filter((f) => /ingl|lenguas/i.test(`${f.area} ${f.subject}`));
console.log(`\n── Inglés / Lenguas Extranjeras: ${ingles.length} ──`);
console.table(ingles);

const dosdo = ingles.find((f) => /2do|segundo/i.test(f.grade));
console.log("\n➡️  Malla de 2do Inglés activa:", dosdo ? `SÍ (grade="${dosdo.grade}", level="${dosdo.level}", ${dosdo.indicadores} indicadores)` : "NO ENCONTRADA");
const primero = ingles.find((f) => /1ro|primero/i.test(f.grade));
console.log("➡️  Malla de 1ro Inglés activa:", primero ? `SÍ (grade="${primero.grade}", ${primero.indicadores} indicadores)` : "NO");
process.exit(0);
