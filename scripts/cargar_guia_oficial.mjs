// Carga una guía oficial del MINERD al banco `secuenciasOficiales`.
//
// Vista previa (no escribe nada):
//   node scripts/cargar_guia_oficial.mjs MANIFIESTO.json GUIA.pdf [--salida vista.json]
//
// Escritura en la base de datos (pide la contraseña en la terminal):
//   node scripts/cargar_guia_oficial.mjs MANIFIESTO.json GUIA.pdf --escribir TU_EMAIL [--reemplazar]
//
// Opciones:
//   --texto RECUPERADO.json   texto de recuperar_texto_guia.mjs, si el PDF está dañado
//   --archivar-anterior       archiva la edición que el manifiesto indica en "reemplazaA"
//
// Todo se escribe en un solo lote: o entra la guía completa (y se archiva la anterior)
// o no cambia nada. Sin --reemplazar, se niega a tocar una guía que ya exista. Si el PDF no coincide
// con el manifiesto, se detiene y no escribe nada.
import { readFileSync, writeFileSync } from "fs";
import { leerPaginas, huellaPdf } from "./lib/leerPdf.mjs";
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
const rutaTexto = valorDe("--texto");
const archivarAnterior = args.includes("--archivar-anterior");

if (!rutaManifiesto || !rutaPdf || (args.includes("--escribir") && !email)) {
  console.error("Uso: node scripts/cargar_guia_oficial.mjs MANIFIESTO.json GUIA.pdf [--salida f.json] [--texto f.json] [--escribir EMAIL] [--reemplazar] [--archivar-anterior]");
  process.exit(1);
}

// Lee la contraseña sin mostrarla. Enter con la línea vacía avisa y vuelve a pedirla.
const pedirClave = (etiqueta) => new Promise((resolve) => {
  const { stdin, stdout } = process;
  if (!stdin.isTTY) {
    console.error("❌ La contraseña se escribe en una terminal interactiva.");
    process.exit(1);
  }
  let clave = "";
  stdin.setRawMode(true); // antes del aviso, para que nada se vea
  stdout.write(etiqueta);
  stdin.setEncoding("utf8");
  const leer = (trozo) => {
    for (const c of trozo.replace(/\u001b\[[0-9;]*[A-Za-z~]/g, "")) {
      if (c === "\u0003") { stdout.write("\nCancelado: no se escribió nada.\n"); process.exit(130); }
      else if (c === "\r" || c === "\n") {
        if (!clave) { stdout.write(`\nLa contraseña está vacía.\n${etiqueta}`); continue; }
        stdin.off("data", leer);
        stdin.setRawMode(false);
        stdin.pause();
        stdout.write("\n");
        resolve(clave);
        return;
      } else if (c === "\u007f" || c === "\b") clave = clave.slice(0, -1);
      else if (c === "\u0015") clave = "";
      else if (c >= " ") clave += c;
    }
  };
  stdin.on("data", leer);
  stdin.resume();
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
const detener = (mensaje) => {
  console.error(`❌ ${mensaje}`);
  process.exit(1);
};
const leerTexto = async () => {
  if (!rutaTexto) {
    if (manifiesto.requiereTextoRecuperado) detener("El texto de este PDF está dañado: usa --texto con el texto recuperado.");
    return leerPaginas(rutaPdf);
  }
  const { huella, paginas, informe } = JSON.parse(readFileSync(rutaTexto, "utf8"));
  if (huella !== huellaPdf(rutaPdf)) detener("El texto recuperado no corresponde a este PDF.");
  const usadas = new Set((manifiesto.secuencias || []).flatMap((s, i, lista) => {
    const fin = s.paginaFin ?? (lista[i + 1] ? lista[i + 1].paginaInicio - 1 : paginas.length);
    return Array.from({ length: fin - s.paginaInicio + 1 }, (_, k) => s.paginaInicio + k);
  }));
  const dudosas = informe.filter((p) => usadas.has(p.pagina)).reduce((n, p) => n + p.dudosas.length, 0);
  if (dudosas) detener(`El texto recuperado tiene ${dudosas} palabras dudosas sin resolver.`);
  return paginas;
};
const { idGuia, documentos, errores } = dividirGuia(await leerTexto(), manifiesto);

console.log(`\nGuía: ${manifiesto.guia?.titulo}`);
console.log(`Ubicación: ${manifiesto.nivel} > ${manifiesto.grado} > ${manifiesto.area} (${manifiesto.asignatura})`);
console.log(`Id: ${idGuia}\n`);
for (const { datos } of documentos) {
  console.log(`${String(datos.numero).padStart(2)}. ${datos.titulo}${datos.grupo ? ` [${datos.grupo}]` : ""} (pp. ${datos.paginaInicio}-${datos.paginaFin})`);
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
console.log(`\nRevisión del PDF: ${documentos.length} secuencias, sin errores.`);
if (manifiesto.reemplazaA) console.log(`Reemplaza a: ${manifiesto.reemplazaA}`);
if (!email) {
  console.log("Vista previa: no se escribió nada.");
  process.exit(0);
}
console.log("Todavía no se ha escrito nada. Falta iniciar sesión.");

cargarEnv(".env");
cargarEnv(".env.local");
const { initializeApp } = await import("firebase/app");
const { getAuth, signInWithEmailAndPassword } = await import("firebase/auth");
const {
  collection, doc, getDoc, getDocs, getFirestore, query, serverTimestamp, where, writeBatch,
} = await import("firebase/firestore");
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
  if (existentes.some((d) => d.exists())) detener("Esta guía ya existe. Usa --reemplazar si quieres sobrescribirla.");
}
let anteriores = [];
if (manifiesto.reemplazaA) {
  const snap = await getDocs(query(collection(db, col), where("guia.id", "==", manifiesto.reemplazaA)));
  const deOtroAlcance = snap.docs.filter((d) => ["nivel", "grado", "area", "asignatura"].some((k) => d.get(k) !== manifiesto[k]));
  if (deOtroAlcance.length) detener("La edición anterior es de otro nivel, grado, área o asignatura.");
  anteriores = snap.docs.filter((d) => d.get("estado") !== "archivada");
  if (anteriores.length && !archivarAnterior) detener(`La edición ${manifiesto.reemplazaA} sigue vigente. Usa --archivar-anterior para archivarla.`);
}
if (archivarAnterior && !manifiesto.reemplazaA) detener("El manifiesto no indica qué edición archivar.");

const lote = writeBatch(db);
for (const { id, datos } of documentos) {
  lote.set(doc(db, col, id), { ...datos, cargadoPor: email, cargadoEn: serverTimestamp() });
}
for (const d of anteriores) {
  lote.update(d.ref, { estado: "archivada", archivadaPor: email, archivadaEn: serverTimestamp(), reemplazadaPor: idGuia });
}
try {
  await lote.commit();
} catch (e) {
  detener(`No se escribió nada: ${e.code || e.message}`);
}
documentos.forEach(({ id }) => console.log(`  ✓ ${id}`));
anteriores.forEach((d) => console.log(`  archivada: ${d.id}`));
console.log(`\n✅ CARGADA: ${documentos.length} secuencias escritas en ${col}. Archivadas: ${anteriores.length}.`);
process.exit(0);
