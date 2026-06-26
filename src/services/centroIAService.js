/**
 * Servicio del Laboratorio IA — Centro IA Docente
 * Usa AIService.generate() → AI Gateway (api/ai/generate.js)
 * Las API keys viven en el servidor — nunca en el frontend.
 */

import { registrarEventoAuditoria, registrarEventoIA } from "../firebase";
import { AIService } from "./ai/AIService";

const SYSTEM_LAB = `Eres DocenteOS AI PRO, un asistente especializado en pedagogía dominicana.
Ayudas a docentes del sistema educativo de República Dominicana a planificar, diseñar materiales,
crear evaluaciones y mejorar su práctica educativa. Tus respuestas están alineadas con el currículo
del MINERD y el enfoque por competencias. Usas lenguaje claro, profesional y motivador.
Responde siempre en español.`;

export async function llamarIALab(prompt, { onChunk, onFinish, onError }) {
  await AIService.generate({
    module: "centro-ia",
    prompt,
    system: SYSTEM_LAB,
    onChunk,
    onFinish: async (respuesta) => {
      await registrarEventoIA({
        modulo: "centro-ia",
        accion: "consulta",
        prompt,
        respuesta,
        estado: "exito",
        meta: { longitudRespuesta: respuesta.length },
      });
      await registrarEventoAuditoria({
        tipo: "ia",
        evento: "ia_consulta_exitosa",
        modulo: "centro-ia",
        detalle: { longitudRespuesta: respuesta.length },
      });
      onFinish();
    },
    onError: async (msg) => {
      await registrarEventoIA({
        modulo: "centro-ia",
        accion: "consulta",
        prompt,
        respuesta: "",
        estado: "error",
        meta: { mensaje: msg },
      });
      await registrarEventoAuditoria({
        tipo: "ia",
        evento: "ia_error",
        modulo: "centro-ia",
        detalle: { mensaje: msg },
      });
      onError(msg);
    },
  });
}
