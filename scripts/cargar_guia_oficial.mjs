// Carga una guía oficial del MINERD al banco `secuenciasOficiales`.
//
// Vista previa (no escribe nada):
//   node scripts/cargar_guia_oficial.mjs MANIFIESTO.json GUIA.pdf [--salida vista.json]
//
// Escritura en la base de datos (pide la contraseña en la terminal):
//   node scripts/cargar_guia_oficial.mjs MANIFIESTO.json GUIA.pdf --escribir TU_EMAIL [--reemplazar]
//
// Sin --reemplazar, se niega a tocar una guía que ya exista. Si el PDF no coincide
// con el manifiesto, se detiene y no escribe nada.
import { readFileSync, writeFileSync } from "fs";
import { createInterface } from "readline";
import { dividirGuia } from "../src/services/secuenciasOficialesModelo.js";

const args = process.argv.slice(2);
const valorDe = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const [rutaManifiesto, rutaPdf] = args;
const salida = valorDe("--salida");
const email = valorDe("--escribir");
const reemplazar = args.includes("--reemplazar");

if (!rutaManifiesto || !rutaPdf || (args.includes("--escribir") && !email)) {
  console.error("Uso: node scripts/cargar_guia_oficial.mjs MANIFIESTO.json GUIA.pdf [--salida f.json] [--escribir EMAIL] [--reemplazar]");
  process.exit(1);
}

const leerPaginas = async (ruta) => {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await getDocument({ data: new Uint8Array(readFileSync(ruta)), verbosity: 0 }).promise;
  const paginas = [];
  for (let n = 1; n <= pdf.numPages; n += 1) {
    const { items } = await (await pdf.getPage(n)).getTextContent();
    paginas.push(items.map((it) => `${it.str}${it.hasEOL ? "\n" : ""}`).join(""));
  }
  return paginas;
};

const pedirClave = (etiqueta) => new Promise((resolve) => {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  rl.question(etiqueta, (clave) => { rl.close(); process.stdout.write("\n"); resolve(clave); });
  rl._writeToOutput = () => {};
});

const cargarEnv = (nombre) => {
  try {
    for (const l of readFileSync(new URL(`../${nombre}`, import.meta.url), "utf8").split("\n")) {
      const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
};

const manifiesto = JSON.parse(readFileSync(rutaManifiesto, "utf8"));
const { idGuia, documentos, errores } = dividirGuia(await leerPaginas(rutaPdf), manifiesto);

console.log(`\nGuía: ${manifiesto.guia?.titulo}`);
console.log(`Ubicación: ${manifiesto.nivel} > ${manifiesto.grado} > ${manifiesto.area} (${manifiesto.asignatura})`);
console.log(`Id: ${idGuia}\n`);
for (const { datos } of documentos) {
  console.log(`${String(datos.numero).padStart(2)}. ${datos.titulo} (pp. ${datos.paginaInicio}-${datos.paginaFin})`);
  console.log(`    introducción: ${datos.introduccion.length} caracteres`);
  for (const p of datos.partes) {
    console.log(`    ${p.nombre} (pp. ${p.paginaInicio}-${p.paginaFin}): ${p.texto.length} caracteres`);
  }
}
if (salida) {
  writeFileSync(salida, JSON.stringify(documentos, null, 2));
  console.log(`\nVista previa completa guardada en ${salida}`);
}
if (errores.length) {
  console.error(`\n❌ ${errores.length} errores; no se puede cargar:`);
  errores.forEach((e) => console.error(`   - ${e}`));
  process.exit(1);
}
console.log(`\n✅ ${documentos.length} secuencias listas, sin errores.`);
if (!email) {
  console.log("Vista previa: no se escribió nada.");
  process.exit(0);
}

cargarEnv(".env");
cargarEnv(".env.local");
const { initializeApp } = await import("firebase/app");
const { getAuth, signInWithEmailAndPassword } = await import("firebase/auth");
const { getFirestore, doc, getDoc, setDoc, serverTimestamp } = await import("firebase/firestore");
const app = initializeApp({
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
});
console.log(`Proyecto: ${process.env.VITE_FIREBASE_PROJECT_ID}`);
try {
  await signInWithEmailAndPassword(getAuth(app), email, await pedirClave("Contraseña: "));
} catch (e) {
  console.error("❌ No se pudo iniciar sesión:", e.code || e.message);
  process.exit(1);
}
const db = getFirestore(app);
const col = "secuenciasOficiales";

if (!reemplazar) {
  const existentes = await Promise.all(documentos.map(({ id }) => getDoc(doc(db, col, id))));
  if (existentes.some((d) => d.exists())) {
    console.error("❌ Esta guía ya existe. Usa --reemplazar si quieres sobrescribirla.");
    process.exit(1);
  }
}
for (const { id, datos } of documentos) {
  await setDoc(doc(db, col, id), { ...datos, cargadoPor: email, cargadoEn: serverTimestamp() });
  console.log(`  ✓ ${id}`);
}
console.log(`\n✅ ${documentos.length} secuencias escritas en ${col}.`);
process.exit(0);
