// Envía el correo de restablecimiento de contraseña de Firebase.
// Solo necesita el email (NO la contraseña). Firebase manda un enlace al correo
// para que definas una nueva.
//
// Uso:  node scripts/resetear_password.mjs cesarjbaez@gmail.com
import { readFileSync } from "fs";
import { initializeApp } from "firebase/app";
import { getAuth, sendPasswordResetEmail } from "firebase/auth";

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

const email = process.argv[2];
if (!email) {
  console.error("Uso: node scripts/resetear_password.mjs TU_EMAIL");
  process.exit(1);
}

const app = initializeApp({
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
});

try {
  await sendPasswordResetEmail(getAuth(app), email);
  console.log(`✅ Correo de restablecimiento enviado a ${email}`);
  console.log("   Revisa tu bandeja de entrada (y spam). Abre el enlace y define una contraseña nueva.");
} catch (e) {
  console.error("❌ No se pudo enviar:", e.code || e.message);
  process.exit(1);
}
process.exit(0);
