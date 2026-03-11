import type { FinanceSnapshot } from "@/lib/finance";
import { buildSignedOrderUrl } from "@/lib/order-token";

export const ORDER_ACTION_STAGES = [
  "DRAFT",
  "QUOTE_READY",
  "SENT_TO_CLIENT",
  "PAYMENT_PENDING",
  "PAYMENT_VALIDATED",
  "IN_PRODUCTION",
  "DELIVERY_READY",
  "DELIVERED",
  "CLOSED",
] as const;

export type OrderActionStage = (typeof ORDER_ACTION_STAGES)[number];

type EventLike = {
  type?: string;
  payload?: unknown;
  createdAt?: string | Date | null;
};

type OrderLike = {
  reference: string;
  workflowState?: string | null;
  paymentStatus?: string | null;
  assignedTo?: string | null;
  deliveryState?: string | null;
  quoteSnapshotJson?: unknown;
  quotePreviewFileKey?: string | null;
  quotePreviewFileUrl?: string | null;
  paymentProofFileKey?: string | null;
  finalDeliveryFileKey?: string | null;
  finalDeliveryFileUrl?: string | null;
  translatedFileUrl?: string | null;
  events?: EventLike[];
};

export type OrderGates = {
  quoteReady: boolean;
  paymentValidated: boolean;
  productionReady: boolean;
  deliveryReady: boolean;
  deliveredReady: boolean;
  closeReady: boolean;
};

export type NextBestAction = {
  label: string;
  tab:
    | "presupuesto"
    | "documentos"
    | "comprobante"
    | "workflow"
    | "asignar"
    | "entrega"
    | "notificar"
    | "finanzas"
    | "control";
  reason: string;
};

function eventList(order: OrderLike) {
  return Array.isArray(order.events) ? order.events : [];
}

function hasEvent(order: OrderLike, type: string) {
  return eventList(order).some((event) => event?.type === type);
}

function hasAnyEvent(order: OrderLike, types: string[]) {
  const set = new Set(types);
  return eventList(order).some((event) => set.has(String(event?.type || "")));
}

export function buildOrderTrackedLinks(reference: string) {
  const paymentUrl = buildSignedOrderUrl(reference, "pagar", { src: "wa", ref: reference });
  const statusUrl = buildSignedOrderUrl(reference, "estado", { src: "wa" });
  return { paymentUrl, statusUrl };
}

export function getDeliveryArtifactUrl(order: OrderLike) {
  return (
    String(order.finalDeliveryFileUrl || "").trim() ||
    String(order.translatedFileUrl || "").trim() ||
    ""
  );
}

export function hasDeliveryArtifact(order: OrderLike) {
  return Boolean(String(order.finalDeliveryFileKey || "").trim() || getDeliveryArtifactUrl(order));
}

export function hasQuoteSnapshot(order: OrderLike) {
  const snapshot = order.quoteSnapshotJson as any;
  if (!snapshot || typeof snapshot !== "object") return false;
  const lines = Array.isArray(snapshot.lines) ? snapshot.lines : [];
  return lines.length > 0;
}

export function getOrderGates(order: OrderLike, finance: FinanceSnapshot): OrderGates {
  const hasQuotePreview = Boolean(
    String(order.quotePreviewFileKey || "").trim() ||
      String(order.quotePreviewFileUrl || "").trim()
  );
  const quoteReady =
    hasQuoteSnapshot(order) &&
    hasQuotePreview;

  const paymentValidated =
    String(order.paymentStatus || "").toUpperCase() === "PAID" ||
    Boolean(String(order.paymentProofFileKey || "").trim()) ||
    hasEvent(order, "payment.proof_uploaded");

  const productionReady = Boolean(String(order.assignedTo || "").trim());
  const deliveryReady = hasDeliveryArtifact(order);
  const deliveredReady = hasAnyEvent(order, [
    "notification.delivery_ready.sent",
    "client.translation_ready_notified",
  ]);

  const reconciliationOk = finance.reconciliationStatus === "RECONCILED";
  const supplierOk = ["BOOKED", "PAID"].includes(finance.supplierInvoiceStatus);
  const marginOk = finance.marginCents !== null;
  const deliveredConfirmed =
    deliveredReady &&
    (hasDeliveryArtifact(order) || String(order.deliveryState || "").toUpperCase() === "TRADUCIDO");

  const closeReady = reconciliationOk && supplierOk && marginOk && deliveredConfirmed;

  return {
    quoteReady,
    paymentValidated,
    productionReady,
    deliveryReady,
    deliveredReady,
    closeReady,
  };
}

export function getOrderActionStage(order: OrderLike, finance: FinanceSnapshot): OrderActionStage {
  const workflow = String(order.workflowState || "").toUpperCase();
  const gates = getOrderGates(order, finance);

  if (workflow === "CERRADO" || finance.hasFinanceCloseEvent) return "CLOSED";
  if (gates.deliveredReady) return "DELIVERED";
  if (gates.deliveryReady) return "DELIVERY_READY";
  if (workflow === "EN_TRADUCCION" || String(order.deliveryState || "").toUpperCase() === "EN_PROCESO") {
    return "IN_PRODUCTION";
  }
  if (gates.paymentValidated) return "PAYMENT_VALIDATED";
  if (workflow === "PENDIENTE_PAGO" || workflow === "JUSTIFICANTE_SUBIDO") return "PAYMENT_PENDING";
  if (workflow === "PRESUPUESTO_ENVIADO") return "SENT_TO_CLIENT";
  if (gates.quoteReady) return "QUOTE_READY";
  return "DRAFT";
}

export function getNextBestAction(order: OrderLike, finance: FinanceSnapshot): NextBestAction {
  const stage = getOrderActionStage(order, finance);
  const gates = getOrderGates(order, finance);

  if (stage === "DRAFT") {
    return {
      label: "Crear presupuesto",
      tab: "presupuesto",
      reason: "Falta presupuesto y preview para avanzar.",
    };
  }
  if (stage === "QUOTE_READY") {
    return {
      label: "Enviar presupuesto",
      tab: "presupuesto",
      reason: "El cliente aun no ha recibido el presupuesto final.",
    };
  }
  if (stage === "SENT_TO_CLIENT" || stage === "PAYMENT_PENDING") {
    return {
      label: "Enviar enlace de pago",
      tab: "notificar",
      reason: "Pendiente de cobro/confirmacion.",
    };
  }
  if (stage === "PAYMENT_VALIDATED" && !gates.productionReady) {
    return {
      label: "Asignar traductor",
      tab: "asignar",
      reason: "No se puede iniciar produccion sin asignacion.",
    };
  }
  if (stage === "PAYMENT_VALIDATED" || stage === "IN_PRODUCTION") {
    if (!gates.deliveryReady) {
      return {
        label: "Subir entrega final",
        tab: "entrega",
        reason: "Falta artefacto final para preparar notificacion.",
      };
    }
  }
  if (stage === "DELIVERY_READY") {
    return {
      label: "Notificar traduccion lista",
      tab: "notificar",
      reason: "El archivo final esta cargado, falta avisar al cliente.",
    };
  }
  if (stage === "DELIVERED" && !gates.closeReady) {
    return {
      label: "Conciliar y cerrar finanzas",
      tab: "finanzas",
      reason: "Falta completar gates economicos para cierre.",
    };
  }
  if (stage === "DELIVERED" && gates.closeReady) {
    return {
      label: "Cerrar pedido",
      tab: "control",
      reason: "Todo listo para cierre final.",
    };
  }

  return {
    label: "Pedido cerrado",
    tab: "control",
    reason: "No hay acciones pendientes.",
  };
}
