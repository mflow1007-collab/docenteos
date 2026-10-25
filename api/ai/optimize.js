/**
 * POST /api/ai/optimize
 *
 * Endpoint de administración para ejecutar el ciclo de optimización del BIC.
 * Solo accesible por administradores DocenteOS (@docenteos.com).
 *
 * Body: { tipo: "planes"|"actividades"|"instrumentos", grado?, area? }
 * Response: { fusionados, archivados, procesados }
 *
 * NOTA: Este endpoint ejecuta operaciones pesadas de Firestore.
 * No usar en Edge Runtime — requiere Node.js runtime.
 */

import { verificarAdmin } from "../_firebaseAuth.js";

export const config = { runtime: "nodejs" };

const ALLOWED_TYPES = ["planes", "actividades", "instrumentos"];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido." });
  }

  // Token Firebase ID verificado en servidor y con permisos de administrador
  // (antes solo se comprobaba que el header empezara por "Bearer ").
  const acceso = await verificarAdmin(req.headers?.authorization);
  if (!acceso.ok) {
    return res.status(acceso.status).json({ error: acceso.error });
  }

  const { tipo = "planes", grado, area } = req.body ?? {};

  if (!ALLOWED_TYPES.includes(tipo)) {
    return res.status(400).json({ error: `Tipo inválido. Válidos: ${ALLOWED_TYPES.join(", ")}` });
  }

  try {
    // Importación dinámica para evitar inicializar Firebase Admin en cada request
    const { cicloOptimizacion } = await import("../../src/services/ai/agents/AgenteOptimizador.js");
    const resultado = await cicloOptimizacion(tipo, { grado, area });

    res.status(200).json({
      ok: true,
      tipo,
      ...resultado,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[optimize] Error:", err.message);
    res.status(500).json({ error: "Error en el ciclo de optimización.", detalle: err.message });
  }
}
