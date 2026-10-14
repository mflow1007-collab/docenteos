/**
 * mfaService.js — Autenticación en dos pasos (MFA) por app autenticadora (TOTP).
 *
 * Segundo factor OPCIONAL: el docente lo activa desde su configuración. Usa el
 * estándar TOTP (Google Authenticator, Authy, Microsoft Authenticator) — gratis,
 * sin SMS, y más resistente que el SMS (no hay SIM swapping). Protege el inicio
 * de sesión incluso si alguien conoce la contraseña.
 *
 * REQUISITO DE CONSOLA (una sola vez): Firebase → Authentication → Sign-in
 * method → Advanced / Multi-factor → habilitar "Authenticator app (TOTP)".
 * Ver docs/SEGURIDAD.md.
 *
 * Todo fail-soft: si Firebase no está listo, las funciones lanzan un error claro
 * que la UI muestra, sin romper el resto de la app.
 */
import {
  multiFactor,
  TotpMultiFactorGenerator,
  TotpSecret,
  getMultiFactorResolver,
} from "firebase/auth";
import { auth } from "../firebase.js";

// ¿El usuario actual ya tiene un segundo factor inscrito?
export function tieneMFA(user = auth?.currentUser) {
  if (!user) return false;
  try { return multiFactor(user).enrolledFactors.length > 0; }
  catch { return false; }
}

// Paso 1 de enrolamiento: genera el secreto TOTP y la URI para el código QR.
// Devuelve { secret, qrUri, clave } — la UI muestra el QR (qrUri) y la clave
// manual. El usuario lo escanea en su app autenticadora.
export async function iniciarEnrolamientoTOTP({ nombreCuenta = "DocenteOS" } = {}) {
  const user = auth?.currentUser;
  if (!user) throw new Error("Debes haber iniciado sesión para activar el segundo factor.");
  const mfaSession = await multiFactor(user).getSession();
  const secret = await TotpMultiFactorGenerator.generateSecret(mfaSession);
  const qrUri = secret.generateQrCodeUrl(user.email || nombreCuenta, "DocenteOS");
  return { secret, qrUri, clave: secret.secretKey };
}

// Paso 2 de enrolamiento: el usuario escribe el código de 6 dígitos de su app;
// si es correcto, queda inscrito el segundo factor. `secret` viene del paso 1.
export async function confirmarEnrolamientoTOTP(secret, codigo, etiqueta = "App autenticadora") {
  const user = auth?.currentUser;
  if (!user) throw new Error("Sesión no disponible.");
  if (!(secret instanceof TotpSecret)) throw new Error("Primero genera el código QR.");
  const credencial = TotpMultiFactorGenerator.assertionForEnrollment(secret, String(codigo).trim());
  await multiFactor(user).enroll(credencial, etiqueta);
  return true;
}

// Quita el segundo factor (el usuario decide desactivarlo).
export async function desactivarMFA() {
  const user = auth?.currentUser;
  if (!user) throw new Error("Sesión no disponible.");
  const inscritos = multiFactor(user).enrolledFactors;
  if (!inscritos.length) return true;
  await multiFactor(user).unenroll(inscritos[0]);
  return true;
}

// Durante el login: cuando Firebase pide el segundo factor lanza un error
// 'auth/multi-factor-auth-required'. Esta función toma ESE error y el código que
// el usuario escribe, y completa el inicio de sesión. Devuelve el userCredential.
export async function resolverLoginMFA(errorMFA, codigo) {
  const resolver = getMultiFactorResolver(auth, errorMFA);
  const factorTotp = resolver.hints.find((h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID);
  if (!factorTotp) throw new Error("No hay un segundo factor TOTP registrado en esta cuenta.");
  const assertion = TotpMultiFactorGenerator.assertionForSignIn(factorTotp.uid, String(codigo).trim());
  return resolver.resolveSignIn(assertion);
}

// Detecta si un error de login es la solicitud de segundo factor.
export const requiereSegundoFactor = (err) => err?.code === "auth/multi-factor-auth-required";
