/**
 * test-gateway-config.mjs — Etapa S+ de la hoja de ruta (paso S+.3).
 *
 * Fija que /api/ai/generate decide modelos y proveedores en el SERVIDOR desde
 * config/ia-gateway, sin red ni credenciales reales: el token se firma con una
 * clave RSA de prueba y fetch se sustituye por un doble que responde por Google
 * (JWK), Firestore REST y los proveedores de IA.
 *
 *  - El modelo que llega al proveedor es el de la config; `modelOverrides` del
 *    cliente se ignora.
 *  - Un proveedor apagado por el admin no se usa aunque el cliente lo pida;
 *    las pistas del cliente solo acotan o reordenan.
 *  - Módulo de composición (planificacion): variante débil → allowlist.
 *  - Sin correo verificado → 403 (salvo la cuenta admin exacta).
 *  - Si no se puede leer la config → 503 visible; si no existe → defaults.
 *
 * Ejecutar: node scripts/test-gateway-config.mjs
 */
process.env.FIREBASE_PROJECT_ID = "docenteos-test";
process.env.OPENAI_API_KEY = "sk-openai-prueba";
process.env.ANTHROPIC_API_KEY = "sk-ant-prueba";
process.env.GEMINI_API_KEY = "gemini-prueba";
delete process.env.GOOGLE_API_KEY;
delete process.env.ABACUS_API_KEY;
delete process.env.NVIDIA_API_KEY;

const { default: handler, invalidarConfigGateway, getProviderQueue, resolverModelo } =
  await import("../api/ai/generate.js");

let pasos = 0, fallos = 0;
const check = async (n, fn) => {
  try { await fn(); pasos += 1; console.log(`  ✓ ${n}`); }
  catch (e) { fallos += 1; console.log(`  ✗ ${n}: ${e.message}`); }
};
const igual = (a, b, msg = "") => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} esperado ${JSON.stringify(b)}, llegó ${JSON.stringify(a)}`);
};

// ── Token de Firebase firmado con una clave de prueba ────────────────────────
const KID = "kid-prueba";
const { publicKey, privateKey } = await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  true, ["sign", "verify"],
);
const jwkPublica = { ...(await crypto.subtle.exportKey("jwk", publicKey)), kid: KID, alg: "RS256", use: "sig" };
const b64url = (bytes) => Buffer.from(bytes).toString("base64url");
async function token({ email = "docente@ejemplo.com", verificado = true } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", kid: KID, typ: "JWT" }));
  const payload = b64url(JSON.stringify({
    iss: `https://securetoken.google.com/${process.env.FIREBASE_PROJECT_ID}`,
    aud: process.env.FIREBASE_PROJECT_ID, sub: "uid-prueba", iat: now, exp: now + 3600,
    email, email_verified: verificado,
  }));
  const firma = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(`${header}.${payload}`));
  return `${header}.${payload}.${b64url(new Uint8Array(firma))}`;
}

// ── Doble de fetch ───────────────────────────────────────────────────────────
// configDoc: objeto de campos tipados de Firestore, null = 404, número = HTTP de error
let configDoc = null;
let llamadas = [];
const firestoreString = (s) => ({ stringValue: s });
const firestoreArray = (xs) => ({ arrayValue: { values: xs.map(firestoreString) } });
const firestoreMap = (o) => ({ mapValue: { fields: Object.fromEntries(Object.entries(o).map(([k, v]) => [k, firestoreString(v)])) } });

const sse = (lineas) => new Response(lineas.map((l) => `data: ${l}\n\n`).join(""), { status: 200, headers: { "Content-Type": "text/event-stream" } });

globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.includes("securetoken@system.gserviceaccount.com")) {
    return new Response(JSON.stringify({ keys: [jwkPublica] }), { status: 200 });
  }
  if (u.startsWith("https://firestore.googleapis.com/")) {
    llamadas.push({ tipo: "firestore", url: u, auth: init.headers?.Authorization });
    if (configDoc === null) return new Response("{}", { status: 404 });
    if (typeof configDoc === "number") return new Response("{}", { status: configDoc });
    return new Response(JSON.stringify({ fields: configDoc }), { status: 200 });
  }
  const body = init.body ? JSON.parse(init.body) : {};
  if (u === "https://api.anthropic.com/v1/messages") {
    llamadas.push({ tipo: "proveedor", provider: "anthropic", model: body.model });
    return sse([
      JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: "hola" } }),
      JSON.stringify({ type: "message_delta", delta: { stop_reason: "end_turn" } }),
    ]);
  }
  const provider = u.startsWith("https://api.openai.com") ? "openai"
    : u.startsWith("https://generativelanguage.googleapis.com") ? "gemini" : "otro";
  llamadas.push({ tipo: "proveedor", provider, model: body.model });
  return sse([JSON.stringify({ choices: [{ delta: { content: "hola" }, finish_reason: "stop" }] }), "[DONE]"]);
};

async function generar(body, { tok } = {}) {
  invalidarConfigGateway();
  llamadas = [];
  const req = new Request("https://docenteos.test/api/ai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok ?? await token()}` },
    body: JSON.stringify({ module: "general", prompt: "Hola", ...body }),
  });
  const res = await handler(req);
  if (res.ok) await res.text(); // consume el stream para que se registre todo
  const proveedores = llamadas.filter((l) => l.tipo === "proveedor");
  return { res, proveedores, primera: proveedores[0] };
}

const CONFIG_ADMIN = {
  priority: firestoreArray(["anthropic", "openai", "gemini"]),
  models: firestoreMap({ anthropic: "claude-sonnet-5", openai: "gpt-4o-mini", gemini: "gemini-2.5-flash" }),
  disabled: firestoreArray(["gemini"]),
};

console.log("\nModelos: los decide el servidor");
await check("modelOverrides del cliente se ignora (llega el modelo de la config)", async () => {
  configDoc = CONFIG_ADMIN;
  const { res, primera } = await generar({ modelOverrides: { anthropic: "claude-opus-carisimo" } });
  igual(res.status, 200, "status");
  igual(primera, { tipo: "proveedor", provider: "anthropic", model: "claude-sonnet-5" });
});
await check("la config se lee con el token del usuario", async () => {
  configDoc = CONFIG_ADMIN;
  const tok = await token();
  await generar({}, { tok });
  const lectura = llamadas.find((l) => l.tipo === "firestore");
  if (!lectura) throw new Error("no se leyó Firestore");
  igual(lectura.auth, `Bearer ${tok}`, "Authorization");
  if (!lectura.url.endsWith("/documents/config/ia-gateway")) throw new Error(`URL inesperada: ${lectura.url}`);
});
await check("modelo antiguo de la config se normaliza (claude-sonnet-4-6 → claude-sonnet-5)", async () => {
  configDoc = { models: firestoreMap({ anthropic: "claude-sonnet-4-6" }), priority: firestoreArray(["anthropic"]) };
  const { primera } = await generar({});
  igual(primera.model, "claude-sonnet-5");
});
await check("planificacion: variante débil del admin → modelo fuerte de la allowlist", async () => {
  configDoc = CONFIG_ADMIN;
  const { primera } = await generar({ module: "planificacion", providerOrder: ["openai"], strictProvider: true });
  igual(primera, { tipo: "proveedor", provider: "openai", model: "gpt-4o" });
});
await check("resolverModelo: sin modelo apto de composición → null", () => {
  igual(resolverModelo("nvidia", "planificacion", {}), null);
});

console.log("\nProveedores: el cliente solo acota o reordena");
await check("apagado por el admin no se usa aunque el cliente lo pida en estricto", async () => {
  configDoc = CONFIG_ADMIN;
  const { res, proveedores } = await generar({ providerOrder: ["gemini"], strictProvider: true });
  igual(res.status, 503, "status");
  igual(proveedores.length, 0, "llamadas a proveedores");
});
await check("providersDisabled del cliente no enciende uno apagado (lista vacía)", async () => {
  configDoc = CONFIG_ADMIN;
  const { proveedores } = await generar({ providersDisabled: [], providerOrder: ["gemini", "openai"] });
  igual(proveedores[0].provider, "openai");
});
await check("el cliente puede reordenar entre habilitados", async () => {
  configDoc = CONFIG_ADMIN;
  const { primera } = await generar({ providerOrder: ["openai"] });
  igual(primera.provider, "openai");
});
await check("cola: prioridad del admin, sin apagados ni proveedores sin clave", () => {
  igual(getProviderQueue({ priority: ["gemini", "anthropic"], disabled: ["gemini"] }, "general"),
    ["anthropic", "openai"]);
});
await check("cola: el cliente puede apagar más (p. ej. sin crédito)", () => {
  igual(getProviderQueue({ priority: ["anthropic", "openai"] }, "general", { providersDisabled: ["anthropic"] }),
    ["openai", "gemini"]);
});
await check("cola: preferredProvider no se salta la prioridad del admin", () => {
  igual(getProviderQueue({ priority: ["anthropic", "openai"] }, "general", { preferredProvider: "gemini" })[0],
    "anthropic");
});
await check("cola: preferredProvider manda solo si el admin no fijó prioridad", () => {
  igual(getProviderQueue({}, "general", { preferredProvider: "gemini" })[0], "gemini");
});
await check("cola: proveedores desconocidos del cliente se descartan", () => {
  igual(getProviderQueue({}, "general", { providerOrder: ["proveedor-falso"], strictProvider: true }), []);
});

console.log("\nCorreo verificado");
await check("sin correo verificado → 403 y no se llama a ningún proveedor", async () => {
  configDoc = CONFIG_ADMIN;
  const { res, proveedores } = await generar({}, { tok: await token({ verificado: false }) });
  igual(res.status, 403, "status");
  igual(proveedores.length, 0, "llamadas a proveedores");
});
await check("cuenta admin exacta sin verificar → atendida", async () => {
  configDoc = CONFIG_ADMIN;
  const { res } = await generar({}, { tok: await token({ email: "admin@docenteos.com", verificado: false }) });
  igual(res.status, 200, "status");
});

console.log("\nLectura de la config (fail-closed)");
await check("Firestore responde 403 → 503 visible y sin proveedores", async () => {
  configDoc = 403;
  const { res, proveedores } = await generar({});
  igual(res.status, 503, "status");
  igual(proveedores.length, 0, "llamadas a proveedores");
  const { error } = JSON.parse(await res.text());
  if (!/configuración/i.test(error || "")) throw new Error(`mensaje inesperado: ${error}`);
});
await check("documento inexistente → defaults del servidor", async () => {
  configDoc = null;
  const { res, primera } = await generar({});
  igual(res.status, 200, "status");
  igual(primera, { tipo: "proveedor", provider: "openai", model: "gpt-4o" });
});

console.log(`\n${pasos} ✓ · ${fallos} ✗`);
process.exit(fallos ? 1 : 0);
