/**
 * test-seguridad-api.mjs — Etapa S de la hoja de ruta (auditoría 2026-10-25).
 *
 * Fija los arreglos de seguridad de /api sin red ni credenciales reales:
 *  S1) /api/fuentes/check ya no deja elegir qué variable de entorno se envía
 *      ni a qué dominio: solo LIBRO_ABIERTO_* y solo a libroabierto.minerd.gob.do.
 *  S1) Rechaza hosts internos (localhost, IPs privadas) — defensa contra SSRF.
 *  S1-S4 + libro-abierto) Ningún endpoint administrativo responde sin un token
 *      válido de administrador: sin token → 401, token basura → 401.
 *
 * Ejecutar: node scripts/test-seguridad-api.mjs
 */
import checkHandler, { buildAuthHeaders, esHostPublico } from "../api/fuentes/check.js";
import educandoHandler from "../api/materiales/educando.js";
import libroAbiertoHandler from "../api/materiales/libro-abierto.js";
import optimizeHandler from "../api/ai/optimize.js";
import aiTestHandler from "../api/ai/test.js";
import generateHandler from "../api/ai/generate.js";
import { verificarAdmin, isAdminUser } from "../api/_firebaseAuth.js";

let pasos = 0, fallos = 0;
const check = async (n, fn) => {
  try { await fn(); pasos += 1; console.log(`  ✓ ${n}`); }
  catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); }
};
const assert = (c, m) => { if (!c) throw new Error(m); };

// El token no es verificable sin red, pero el proyecto debe existir para que
// la verificación llegue a mirar el token (y lo rechace por malformado).
process.env.FIREBASE_PROJECT_ID = "docenteos-test";
process.env.ANTHROPIC_API_KEY = "sk-ant-NO-DEBE-SALIR";
process.env.LIBRO_ABIERTO_USER = "usuario-prueba";
process.env.LIBRO_ABIERTO_PASSWORD = "clave-prueba";

// Respuesta falsa estilo Node/Vercel: guarda el status y el cuerpo.
const resFalsa = () => {
  const r = { statusCode: 200, body: null, headers: {} };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  return r;
};
const reqNode = (headers = {}, body = {}) => ({ method: "POST", headers, body, query: {} });
const reqEdge = (headers = {}) => new Request("https://docenteos.test/api", {
  method: "POST",
  headers: { "Content-Type": "application/json", ...headers },
  body: JSON.stringify({ provider: "anthropic", prompt: "hola" }),
});

console.log("S1 · /api/fuentes/check no entrega secretos:");

await check("pedir ANTHROPIC_API_KEY como bearer hacia un dominio ajeno → error", () => {
  let lanzo = false;
  try { buildAuthHeaders({ type: "bearer", tokenEnv: "ANTHROPIC_API_KEY" }, "atacante.example"); }
  catch { lanzo = true; }
  assert(lanzo, "aceptó enviar ANTHROPIC_API_KEY");
});

await check("pedir ANTHROPIC_API_KEY incluso hacia el dominio oficial → error (no está en la lista)", () => {
  let lanzo = false;
  try { buildAuthHeaders({ type: "bearer", tokenEnv: "ANTHROPIC_API_KEY" }, "libroabierto.minerd.gob.do"); }
  catch { lanzo = true; }
  assert(lanzo, "aceptó una variable fuera de la lista permitida");
});

await check("credenciales de Libro Abierto hacia otro dominio → error", () => {
  let lanzo = false;
  try {
    buildAuthHeaders({ type: "basic", usernameEnv: "LIBRO_ABIERTO_USER", passwordEnv: "LIBRO_ABIERTO_PASSWORD" }, "atacante.example");
  } catch { lanzo = true; }
  assert(lanzo, "envió las credenciales de Libro Abierto a un dominio ajeno");
});

await check("credenciales de Libro Abierto hacia su dominio oficial → sí (con y sin www)", () => {
  for (const host of ["libroabierto.minerd.gob.do", "www.libroabierto.minerd.gob.do"]) {
    const h = buildAuthHeaders({ type: "basic", usernameEnv: "LIBRO_ABIERTO_USER", passwordEnv: "LIBRO_ABIERTO_PASSWORD" }, host);
    assert(/^Basic /.test(h.Authorization || ""), `no armó Basic Auth para ${host}`);
  }
});

await check("sin autenticación → sin cabeceras", () => {
  assert(Object.keys(buildAuthHeaders({ type: "none" }, "cualquiera.example")).length === 0, "añadió cabeceras");
});

console.log("\nS1 · defensa contra SSRF:");

await check("hosts internos rechazados", () => {
  for (const h of ["localhost", "127.0.0.1", "10.0.0.5", "192.168.1.1", "172.16.0.1", "169.254.169.254", "0.0.0.0", "::1", "[::1]", "api.internal", "printer.local"]) {
    assert(esHostPublico(h) === false, `aceptó ${h}`);
  }
});

await check("hosts públicos aceptados", () => {
  for (const h of ["www.ministeriodeeducacion.gob.do", "libroabierto.minerd.gob.do", "educando.edu.do", "8.8.8.8", "172.32.0.1"]) {
    assert(esHostPublico(h) === true, `rechazó ${h}`);
  }
});

console.log("\nS1-S4 · endpoints administrativos exigen token de admin:");

const nodeHandlers = [
  ["fuentes/check", checkHandler, { url: "https://atacante.example", auth: { type: "bearer", tokenEnv: "ANTHROPIC_API_KEY" } }],
  ["materiales/educando", educandoHandler, { url: "https://atacante.example" }],
  ["materiales/libro-abierto", libroAbiertoHandler, { auth: { usernameEnv: "ANTHROPIC_API_KEY" } }],
  ["ai/optimize", optimizeHandler, { tipo: "planes" }],
];

for (const [nombre, handler, body] of nodeHandlers) {
  await check(`${nombre}: sin token → 401`, async () => {
    const res = resFalsa();
    await handler(reqNode({}, body), res);
    assert(res.statusCode === 401, `respondió ${res.statusCode}`);
    assert(!JSON.stringify(res.body || "").includes("NO-DEBE-SALIR"), "filtró el secreto");
  });
  await check(`${nombre}: token basura → 401`, async () => {
    const res = resFalsa();
    await handler(reqNode({ authorization: "Bearer x" }, body), res);
    assert(res.statusCode === 401, `respondió ${res.statusCode}`);
  });
}

await check("ai/test: sin token → 401 (antes hacía una llamada pagada)", async () => {
  const r = await aiTestHandler(reqEdge());
  assert(r.status === 401, `respondió ${r.status}`);
});
await check("ai/test: token basura → 401", async () => {
  const r = await aiTestHandler(reqEdge({ Authorization: "Bearer x" }));
  assert(r.status === 401, `respondió ${r.status}`);
});
await check("ai/generate sigue exigiendo token tras usar el módulo compartido → 401", async () => {
  const r = await generateHandler(reqEdge());
  assert(r.status === 401, `respondió ${r.status}`);
});

console.log("\nMódulo compartido de verificación:");

await check("verificarAdmin sin header → 401; con token malformado → 401", async () => {
  assert((await verificarAdmin(undefined)).status === 401, "sin header no dio 401");
  assert((await verificarAdmin("Bearer a.b")).status === 401, "token malformado no dio 401");
});

await check("isAdminUser: misma regla que las reglas de Firestore", () => {
  assert(isAdminUser({ email: "admin@docenteos.com", emailVerified: false }), "admin principal no reconocido");
  assert(isAdminUser({ email: "otro@docenteos.com", emailVerified: true }), "dominio verificado no reconocido");
  assert(!isAdminUser({ email: "otro@docenteos.com", emailVerified: false }), "dominio SIN verificar aceptado");
  assert(!isAdminUser({ email: "docente@gmail.com", emailVerified: true }), "docente aceptado como admin");
});

console.log(`\nSeguridad API: ${pasos} pasos, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
