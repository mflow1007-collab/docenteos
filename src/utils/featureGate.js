/**
 * featureGate — Control de acceso a funciones según estado de suscripción.
 *
 * Uso:
 *   const { allowed, reason } = canUseFeature(subscriptionStatus, 'generatePlanning')
 *   if (!allowed) showMessage(reason)
 */

// Funcionalidades controladas
export const FEATURES = {
  generatePlanning:    "Generar planificación",
  generateInstruments: "Generar instrumentos con IA",
  aiAudit:             "Auditoría pedagógica IA",
  chatIA:              "Chat IA (Laboratorio)",
  exportPDF:           "Exportar PDF premium",
  registro:            "Registro de calificaciones",
  reportes:            "Reportes de desempeño",
};

// Mensajes de bloqueo por estado
const BLOCK_MESSAGES = {
  pending_payment:
    "Tu cuenta está pendiente de pago. Realiza el pago para activar todas las funciones de DocenteOS.",
  grace_period:
    "Tu suscripción ha vencido. Estás en período de gracia — renueva antes de que tu cuenta sea suspendida.",
  suspended:
    "Tu cuenta está suspendida por falta de pago. Para reactivar el servicio, realiza el pago o contacta al administrador.",
  cancelled:
    "Tu cuenta ha sido cancelada. Contacta al administrador para reactivar el servicio.",
};

// Funciones bloqueadas por estado
const BLOCKED_FEATURES = {
  // En prueba: acceso completo
  trial: [],
  // Activo: acceso completo
  active: [],
  // Pendiente de pago: bloquear generación y IA
  pending_payment: [
    "generatePlanning",
    "generateInstruments",
    "aiAudit",
    "chatIA",
    "exportPDF",
  ],
  // Período de gracia: puede seguir usando con aviso
  grace_period: [],
  // Suspendido: bloquear casi todo
  suspended: [
    "generatePlanning",
    "generateInstruments",
    "aiAudit",
    "chatIA",
    "exportPDF",
    "registro",
    "reportes",
  ],
  // Cancelado: igual que suspendido
  cancelled: [
    "generatePlanning",
    "generateInstruments",
    "aiAudit",
    "chatIA",
    "exportPDF",
    "registro",
    "reportes",
  ],
};

/**
 * Verifica si el usuario puede usar una función.
 *
 * @param {string|null} subscriptionStatus
 * @param {string} feature — clave de FEATURES
 * @returns {{ allowed: boolean, reason: string|null }}
 */
export function canUseFeature(subscriptionStatus, feature) {
  // Sin estado → permitir (usuarios sin suscripción configurada, admins, etc.)
  if (!subscriptionStatus) return { allowed: true, reason: null };

  const blocked = BLOCKED_FEATURES[subscriptionStatus] ?? [];
  if (!blocked.includes(feature)) return { allowed: true, reason: null };

  return {
    allowed: false,
    reason:  BLOCK_MESSAGES[subscriptionStatus] ?? "Tu cuenta no tiene acceso a esta función.",
  };
}

/**
 * Devuelve true si el usuario tiene una suscripción que requiere atención.
 */
export function needsAttention(subscriptionStatus) {
  return ["pending_payment", "grace_period", "suspended", "cancelled"].includes(subscriptionStatus);
}

/**
 * Devuelve el mensaje de aviso apropiado para el estado.
 */
export function getStatusMessage(subscriptionStatus, subscriptionEndAt, graceEndsAt) {
  const fmt = (ts) => {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("es-DO", { year: "numeric", month: "long", day: "numeric" });
  };

  switch (subscriptionStatus) {
    case "trial":
      return "Estás usando la versión beta de DocenteOS. Tu acceso de prueba es gratuito mientras dure la fase beta.";
    case "active":
      return subscriptionEndAt
        ? `Tu cuenta está activa hasta el ${fmt(subscriptionEndAt)}.`
        : "Tu cuenta está activa.";
    case "pending_payment":
      return "Tu cuenta está pendiente de pago. Realiza el pago para activar todas las funciones de DocenteOS.";
    case "grace_period":
      return `Tu suscripción venció el ${fmt(subscriptionEndAt)}. Tienes hasta el ${fmt(graceEndsAt)} para renovar antes de que tu cuenta sea suspendida.`;
    case "suspended":
      return "Tu cuenta está suspendida por falta de pago. Para reactivar el servicio, realiza el pago o contacta al administrador.";
    case "cancelled":
      return "Tu cuenta ha sido cancelada. Contacta al administrador para reactivar el servicio.";
    default:
      return null;
  }
}
