/**
 * subscriptionService — Gestión de suscripciones y pagos de DocenteOS.
 *
 * Toda escritura a Firestore usa merge:true para no borrar datos existentes.
 * Solo administradores pueden activar / suspender / registrar pagos.
 */

import { db } from "../firebase.js";
import {
  doc, getDoc, collection, addDoc, getDocs,
  orderBy, query, serverTimestamp, updateDoc, Timestamp,
} from "firebase/firestore";

// ─── Constantes ───────────────────────────────────────────────────────────────

export const SUBSCRIPTION_STATUSES = {
  trial:           { label: "Prueba gratuita", color: "blue"   },
  active:          { label: "Activo",           color: "green"  },
  pending_payment: { label: "Pendiente de pago",color: "amber"  },
  grace_period:    { label: "Período de gracia",color: "orange" },
  suspended:       { label: "Suspendido",        color: "red"    },
  cancelled:       { label: "Cancelado",         color: "gray"   },
};

export const STATUS_LABEL = (s) => SUBSCRIPTION_STATUSES[s]?.label ?? s ?? "—";
export const STATUS_COLOR = (s) => SUBSCRIPTION_STATUSES[s]?.color ?? "gray";

export const PLANS = {
  beta:      "Beta",
  trial:     "Prueba gratuita",
  basic:     "Básico",
  pro:       "Pro",
  premium:   "Premium",
  unlimited: "Ilimitado",
};

export const PAYMENT_METHODS = ["transferencia", "tarjeta", "efectivo", "manual", "otro"];

// ─── Helpers de fecha ─────────────────────────────────────────────────────────

export function daysRemaining(ts) {
  if (!ts) return null;
  const end = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.ceil((end - new Date()) / (1000 * 60 * 60 * 24));
  return diff;
}

export function addDaysToNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return Timestamp.fromDate(d);
}

export function fmtDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("es-DO", { year: "numeric", month: "short", day: "numeric" });
}

// ─── Verificación de vencimiento (corre en frontend, sin server) ──────────────

/**
 * Revisa si el usuario debería cambiar de estado por vencimiento.
 * Retorna el nuevo estado o null si no hay cambio.
 */
export function computeExpirationStatus(userData) {
  const status  = userData?.subscriptionStatus;
  if (!status || status === "trial" || status === "cancelled" || status === "pending_payment") return null;

  const now     = new Date();
  const endAt   = userData?.subscriptionEndAt?.toDate?.();
  const graceAt = userData?.graceEndsAt?.toDate?.();

  if (!endAt) return null;

  if (status === "active" && now > endAt) {
    if (graceAt && now <= graceAt) return "grace_period";
    return "suspended";
  }
  if (status === "grace_period" && graceAt && now > graceAt) return "suspended";

  return null; // sin cambio
}

/**
 * Si el estado calculado difiere del almacenado, actualiza Firestore.
 */
export async function checkAndSyncExpiration(uid, userData) {
  if (!db || !uid) return;
  const nextStatus = computeExpirationStatus(userData);
  if (!nextStatus) return;

  const patch = { subscriptionStatus: nextStatus };
  if (nextStatus === "suspended") patch.suspendedAt = serverTimestamp();

  try {
    await updateDoc(doc(db, "usuarios", uid), patch);
  } catch (e) {
    console.error("[subscriptionService] checkAndSyncExpiration:", e);
  }
}

// ─── Acciones de administrador ────────────────────────────────────────────────

/**
 * Activa la cuenta del usuario.
 * @param {string} uid
 * @param {Date|null} endDate  — fecha de vencimiento (null = ilimitado)
 * @param {string} adminUid
 */
export async function activateUser(uid, endDate, adminUid) {
  const patch = {
    subscriptionStatus: "active",
    suspendedAt: null,
    activatedBy: adminUid,
    activatedAt: serverTimestamp(),
  };
  if (endDate) {
    patch.subscriptionEndAt   = Timestamp.fromDate(endDate);
    patch.nextPaymentDueAt    = Timestamp.fromDate(endDate);
  }
  await updateDoc(doc(db, "usuarios", uid), patch);
}

export async function setPendingPayment(uid, adminUid) {
  await updateDoc(doc(db, "usuarios", uid), {
    subscriptionStatus: "pending_payment",
    updatedBy: adminUid,
    updatedAt: serverTimestamp(),
  });
}

export async function suspendUser(uid, adminUid, reason = "") {
  await updateDoc(doc(db, "usuarios", uid), {
    subscriptionStatus: "suspended",
    suspendedAt: serverTimestamp(),
    suspendedBy: adminUid,
    suspendReason: reason,
  });
}

export async function cancelUser(uid, adminUid) {
  await updateDoc(doc(db, "usuarios", uid), {
    subscriptionStatus: "cancelled",
    cancelledAt: serverTimestamp(),
    cancelledBy: adminUid,
  });
}

export async function setGracePeriod(uid, days, adminUid) {
  await updateDoc(doc(db, "usuarios", uid), {
    subscriptionStatus: "grace_period",
    gracePeriodDays: days,
    graceEndsAt: addDaysToNow(days),
    updatedBy: adminUid,
    updatedAt: serverTimestamp(),
  });
}

export async function renewSubscription(uid, days, adminUid) {
  const endDate = addDaysToNow(days);
  await updateDoc(doc(db, "usuarios", uid), {
    subscriptionStatus: "active",
    subscriptionEndAt: endDate,
    nextPaymentDueAt: endDate,
    suspendedAt: null,
    activatedBy: adminUid,
    activatedAt: serverTimestamp(),
  });
}

// ─── Registro de pago (admin) ─────────────────────────────────────────────────

/**
 * Registra un pago manual y activa la suscripción del usuario.
 */
export async function registerPayment(uid, payment, adminUid) {
  const {
    amount, currency = "DOP", method = "manual",
    reference = "", paidAt, periodDays = 30, note = "",
  } = payment;

  const paidDate = paidAt ? new Date(paidAt) : new Date();
  const endDate  = new Date(paidDate);
  endDate.setDate(endDate.getDate() + periodDays);

  const paymentData = {
    uid,
    amount: Number(amount),
    currency,
    method,
    reference,
    paidAt:        Timestamp.fromDate(paidDate),
    periodStart:   Timestamp.fromDate(paidDate),
    periodEnd:     Timestamp.fromDate(endDate),
    periodDays,
    registeredBy:  adminUid,
    createdAt:     serverTimestamp(),
    note,
  };

  // 1. Guardar en colección payments/
  const payRef = await addDoc(collection(db, "payments"), paymentData);

  // 2. Guardar en subcollección del usuario
  await addDoc(collection(db, "usuarios", uid, "paymentHistory"), {
    ...paymentData,
    paymentId: payRef.id,
  });

  // 3. Actualizar estado del usuario
  await updateDoc(doc(db, "usuarios", uid), {
    subscriptionStatus: "active",
    lastPaymentAt:      Timestamp.fromDate(paidDate),
    nextPaymentDueAt:   Timestamp.fromDate(endDate),
    subscriptionEndAt:  Timestamp.fromDate(endDate),
    suspendedAt: null,
    activatedBy: adminUid,
    activatedAt: serverTimestamp(),
  });

  return payRef.id;
}

// ─── Historial de pagos ───────────────────────────────────────────────────────

export async function getPaymentHistory(uid) {
  if (!db || !uid) return [];
  try {
    const snap = await getDocs(
      query(collection(db, "usuarios", uid, "paymentHistory"), orderBy("createdAt", "desc"))
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

// ─── Reporte de pago (usuario) ───────────────────────────────────────────────

export async function reportPaymentByUser(uid, report) {
  const {
    method = "transferencia", amount, currency = "DOP",
    paidAt, reference = "", note = "", comprobante = "",
  } = report;

  await addDoc(collection(db, "paymentReports"), {
    uid,
    method, amount: Number(amount), currency,
    paidAt: paidAt ? Timestamp.fromDate(new Date(paidAt)) : serverTimestamp(),
    reference, note, comprobante,
    status: "pending_review",
    createdAt: serverTimestamp(),
  });
}

// ─── Inicializar suscripción beta ─────────────────────────────────────────────

export async function initBetaSubscription(uid) {
  const trialEnd = addDaysToNow(90); // 90 días de beta
  await updateDoc(doc(db, "usuarios", uid), {
    subscriptionStatus: "trial",
    plan: "beta",
    paymentMethod: "manual",
    trialEndsAt: trialEnd,
    subscriptionStartAt: serverTimestamp(),
  });
}
