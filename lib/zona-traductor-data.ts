import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isStaffEmail } from "@/lib/staff-access";
import { readVerifiedOtpToken, STAFF_OTP_VERIFIED_COOKIE } from "@/lib/staff-otp";
import { prisma } from "@/lib/prisma";
import { getAllOrdersForStaff } from "@/lib/orders";
import { isOrderInBooks } from "@/lib/bizum-ledger";
import { getFinanceSnapshot } from "@/lib/finance";
import { getWorkflowState } from "@/lib/workflow";
import {
  buildOrderTrackedLinks,
  getDeliveryArtifactUrl,
  getNextBestAction,
  getOrderActionStage,
  getOrderGates,
} from "@/lib/order-actions";
import { isDueSoon, isOverdue } from "@/lib/order-utils";
import type { BandejaOrder } from "@/components/BandejaEntrada";

export type ControlSearchParams = {
  filtro?: string;
  q?: string;
  periodo?: string;
  desde?: string;
  hasta?: string;
  base?: string;
};

type PeriodKey = "total" | "hoy" | "7d" | "mes" | "mes-anterior" | "custom";
type DateBaseKey = "created" | "paid";

type DateRange = {
  key: PeriodKey;
  label: string;
  from: Date | null;
  to: Date | null;
  fromInput: string;
  toInput: string;
};

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function getAcquisitionSource(order: any): "WHATSAPP" | "WEB" {
  const events = order.events || [];
  if (events.some((e: any) => e.type === "wa.lead_received")) return "WHATSAPP";
  const acquisitionEvent = events.find((e: any) => e.type === "order.acquisition");
  const source = String((acquisitionEvent?.payload as any)?.source || "").toUpperCase();
  return source === "WHATSAPP" ? "WHATSAPP" : "WEB";
}

function getPaymentProofs(order: any) {
  return (order.events || [])
    .filter((e: any) => e.type === "payment.proof_uploaded")
    .map((e: any) => ({
      fileUrl: String((e.payload as any)?.fileUrl || ""),
      fileName: String((e.payload as any)?.fileName || "Comprobante"),
      uploadedAt: String((e.payload as any)?.uploadedAt || e.createdAt?.toISOString?.() || ""),
    }))
    .filter((p: any) => p.fileUrl);
}

function getSubmittedDocuments(order: any) {
  const events = order.events || [];
  const submitted = events.find((e: any) => e.type === "presupuesto.submitted");
  const submittedFiles = (() => {
    if (!submitted) return [];
    const payload = (submitted.payload as any) || {};
    const files = Array.isArray(payload.files) ? payload.files : [];
    const fallbackUploadedAt = submitted.createdAt?.toISOString?.() || null;
    return files.map((file: any) => ({
      name: String(file?.name || "Documento"),
      type: String(file?.type || "application/octet-stream"),
      size: Number(file?.size || 0),
      url: file?.url ? String(file.url) : undefined,
      uploadedAt: file?.uploadedAt ? String(file.uploadedAt) : fallbackUploadedAt || undefined,
    }));
  })();

  const sourceUploadFiles = events
    .filter((e: any) => e.type === "order.source_document_uploaded")
    .map((e: any) => {
      const payload = (e.payload as any) || {};
      return {
        name: String(payload.fileName || "Documento"),
        type: String(payload.fileType || "application/octet-stream"),
        size: Number(payload.fileSize || 0),
        url: payload.fileUrl ? String(payload.fileUrl) : undefined,
        uploadedAt: String(payload.uploadedAt || e.createdAt?.toISOString?.() || ""),
      };
    });

  const iaDocFiles = (order.documentAnalyses || []).map((da: any) => ({
    name: String(da.fileName || "Documento"),
    type: String(da.mimeType || "application/octet-stream"),
    size: Number(da.fileSize || 0),
    url: da.fileUrl ? String(da.fileUrl) : undefined,
    uploadedAt: da.createdAt?.toISOString?.() || undefined,
  }));

  const seen = new Set<string>();
  return [...sourceUploadFiles, ...submittedFiles, ...iaDocFiles]
    .filter((doc) => {
      const url = doc.url || "";
      if (!url) return true;
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    })
    .map((doc) => ({
      name: doc.name,
      type: doc.type,
      size: Number.isFinite(doc.size) ? doc.size : 0,
      url: doc.url,
      uploadedAt: doc.uploadedAt || undefined,
    }));
}

function getQuoteDraft(order: any) {
  const quoteEvent = (order.events || []).find((e: any) => e.type === "quote.documents.updated");
  if (!quoteEvent) return null;
  const payload = (quoteEvent.payload as any) || {};
  const rawLines = Array.isArray(payload.lines) ? payload.lines : [];
  const lines = rawLines
    .map((line: any) => ({
      documentName: String(line?.documentName || "").trim(),
      amountCents: Math.max(0, Math.round(Number(line?.amountCents || 0))),
      notes: line?.notes ? String(line.notes) : null,
    }))
    .filter((line: any) => !!line.documentName);
  const totalRaw = Number(payload.totalCents);
  return {
    lines,
    totalCents: Number.isFinite(totalRaw) ? Math.round(totalRaw) : null,
    updatedAt: quoteEvent.createdAt?.toISOString?.() || null,
  };
}

function getQuoteAuditTrail(order: any) {
  const auditTypes = new Set([
    "quote.documents.updated",
    "quote.sent_to_client",
    "quote.send_failed",
    "order.payment_link_sent",
    "order.payment_link_send_failed",
  ]);

  return (order.events || [])
    .filter((e: any) => auditTypes.has(e.type))
    .slice(0, 12)
    .map((event: any) => {
      const payload = (event.payload as any) || {};
      const rawLines = Array.isArray(payload.lines) ? payload.lines : [];
      const lines = rawLines
        .map((line: any) => ({
          documentName: String(line?.documentName || "").trim(),
          amountCents: Math.max(0, Math.round(Number(line?.amountCents || 0))),
          notes: line?.notes ? String(line.notes) : null,
        }))
        .filter((line: any) => !!line.documentName);

      const totalRaw = Number(payload.totalCents);
      return {
        type: String(event.type || ""),
        message: String(event.message || ""),
        createdAt: event.createdAt?.toISOString?.() || null,
        actorEmail: payload.actorEmail ? String(payload.actorEmail) : null,
        toEmail: payload.toEmail ? String(payload.toEmail) : null,
        paymentUrl: payload.paymentUrl ? String(payload.paymentUrl) : null,
        subject: payload.subject ? String(payload.subject) : null,
        error: payload.error ? String(payload.error) : null,
        provider: payload.provider ? String(payload.provider) : null,
        providerMessageId: payload.providerMessageId ? String(payload.providerMessageId) : null,
        totalCents: Number.isFinite(totalRaw) ? Math.round(totalRaw) : null,
        lines,
      };
    });
}

function getLatestDeliveryNotification(order: any) {
  const events = order.events || [];
  const evt = events.find(
    (event: any) =>
      event.type === "notification.delivery_ready.sent" ||
      event.type === "client.translation_ready_notified"
  );
  if (!evt) return null;
  const payload = (evt.payload as any) || {};
  return {
    type: String(evt.type || ""),
    sentAt: evt.createdAt?.toISOString?.() || null,
    toEmail: payload.toEmail ? String(payload.toEmail) : null,
    channel: payload.channel ? String(payload.channel) : null,
    downloadUrl: payload.downloadUrl ? String(payload.downloadUrl) : null,
  };
}

function getOrderArtifacts(order: any) {
  const deliveryUrl = getDeliveryArtifactUrl(order);
  return {
    quotePreviewFileKey: order.quotePreviewFileKey ? String(order.quotePreviewFileKey) : null,
    quotePreviewFileUrl: order.quotePreviewFileUrl ? String(order.quotePreviewFileUrl) : null,
    quoteSnapshotJson: order.quoteSnapshotJson || null,
    paymentProofFileKey: order.paymentProofFileKey ? String(order.paymentProofFileKey) : null,
    finalDeliveryFileKey: order.finalDeliveryFileKey ? String(order.finalDeliveryFileKey) : null,
    finalDeliveryFileUrl: deliveryUrl || null,
    finalFilename: order.finalFilename ? String(order.finalFilename) : null,
    finalMimeType: order.finalMimeType ? String(order.finalMimeType) : null,
  };
}

function hasFinancialRisk(order: any) {
  return !order.financeSnapshot.isFinanciallyCloseable || order.financeSnapshot.reconciliationStatus === "MISMATCH";
}

function requiresMarginApproval(order: any) {
  return order.financeSnapshot.requiresMarginApproval && order.financeSnapshot.marginApprovalStatus !== "APPROVED";
}

function hasMonthlyBatchPending(order: any) {
  return (
    order.financeSnapshot.supplierInvoiceBillingMode === "MONTHLY_BATCH" &&
    order.financeSnapshot.accountingCutoffPassed &&
    !["BOOKED", "PAID"].includes(order.financeSnapshot.supplierInvoiceStatus)
  );
}

function matchesSearch(order: any, q: string) {
  if (!q) return true;
  const haystack = [
    order.reference,
    order.title,
    order.clientEmail,
    order.assignedTo,
    order.langPair,
    order.acquisitionSource,
    order?.billing?.nif,
    order?.billing?.fiscalName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function topFinancialAlert(order: any) {
  const snapshot = order.financeSnapshot;
  if (snapshot.reconciliationStatus === "MISMATCH") return "Descuadre en conciliacion de cobro";
  if (snapshot.marginCents !== null && snapshot.marginCents < 0) return "Margen negativo";
  if (requiresMarginApproval(order)) return "Margen bajo pendiente de aprobacion";
  if (hasMonthlyBatchPending(order)) return "Factura de lote mensual vencida tras corte";
  if (!["BOOKED", "PAID"].includes(snapshot.supplierInvoiceStatus)) return "Factura proveedor pendiente de validar";
  if (snapshot.accountingCutoffPassed && !snapshot.hasFinanceCloseEvent) return "Pendiente cierre contable del periodo";
  return "Revisar estado financiero";
}

function normalizeDateBase(value?: string | null): DateBaseKey {
  return value === "paid" ? "paid" : "created";
}

function startOfDay(value: Date) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(value: Date) {
  const d = new Date(value);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth() + 1, 0, 23, 59, 59, 999);
}

function parseDateInput(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const parsed = new Date(`${raw}T00:00:00`);
  if (isNaN(parsed.getTime())) return null;
  return parsed;
}

function formatInputDate(date: Date | null) {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizePeriod(value?: string | null): PeriodKey {
  if (value === "hoy" || value === "7d" || value === "mes" || value === "mes-anterior" || value === "custom") {
    return value;
  }
  return "total";
}

function getDateRange(periodRaw?: string | null, fromRaw?: string | null, toRaw?: string | null): DateRange {
  const now = new Date();
  const key = normalizePeriod(periodRaw);

  if (key === "hoy") {
    return { key, label: "Hoy", from: startOfDay(now), to: endOfDay(now), fromInput: "", toInput: "" };
  }
  if (key === "7d") {
    const from = startOfDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
    return { key, label: "Ultimos 7 dias", from, to: endOfDay(now), fromInput: "", toInput: "" };
  }
  if (key === "mes") {
    return { key, label: "Mes actual", from: startOfMonth(now), to: endOfDay(now), fromInput: "", toInput: "" };
  }
  if (key === "mes-anterior") {
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const from = startOfMonth(prevMonth);
    const to = endOfMonth(prevMonth);
    return { key, label: "Mes anterior", from, to, fromInput: "", toInput: "" };
  }
  if (key === "custom") {
    const fromDate = parseDateInput(fromRaw);
    const toDate = parseDateInput(toRaw);
    const from = fromDate ? startOfDay(fromDate) : null;
    const to = toDate ? endOfDay(toDate) : null;
    const label =
      from && to
        ? `Rango ${formatDate(from)} - ${formatDate(to)}`
        : from
          ? `Desde ${formatDate(from)}`
          : to
            ? `Hasta ${formatDate(to)}`
            : "Rango personalizado";
    return { key, label, from, to, fromInput: formatInputDate(fromDate), toInput: formatInputDate(toDate) };
  }

  return { key: "total", label: "Total historico", from: null, to: null, fromInput: "", toInput: "" };
}

function isWithinDateRange(date: Date, range: DateRange) {
  const time = new Date(date).getTime();
  if (range.from && time < range.from.getTime()) return false;
  if (range.to && time > range.to.getTime()) return false;
  return true;
}

function getOrderDateForBase(order: any, base: DateBaseKey) {
  if (base === "paid") {
    return order.paidAt ? new Date(order.paidAt) : null;
  }
  return new Date(order.createdAt);
}

// Entrega del traductor ya recibida: evento del sobre de lavori (entrega_subida),
// asignación con deliveredAt o translatorDeliveredAt del pedido. Caso Stephan
// 26_DFAA55 (26-ago): Maria entregó el 18 y la agenda decía "En proceso · Maria".
export function getTranslatorDeliveredAt(order: any): string | null {
  const evt = (order.events || []).find((e: any) => e.type === "lavori.entrega_subida");
  const fromAssignment = (order.collaboratorAssignments || []).find((a: any) => a.deliveredAt)?.deliveredAt;
  const d = evt?.createdAt || fromAssignment || order.translatorDeliveredAt || null;
  return d ? new Date(d).toISOString() : null;
}

function getArchiveState(order: any) {
  const evt = (order.events || []).find(
    (e: any) => e.type === "order.archived" || e.type === "order.unarchived"
  );
  if (!evt) {
    return { isArchived: false, archivedAt: null as string | null };
  }
  const isArchived = evt.type === "order.archived";
  const archivedAt = evt.createdAt?.toISOString?.() || null;
  return { isArchived, archivedAt };
}

// cache() de React: el layout (badge del nav) y la página (lista) piden los
// mismos pedidos en el MISMO render. Sin esto, getAllOrdersForStaff —la query
// más pesada del backoffice: todos los pedidos con sus eventos, análisis y
// asignaciones— corría dos veces por pantalla y agotaba el pool de conexiones.
const loadEnrichedOrders = cache(async () => {
  const allOrders = await getAllOrdersForStaff();
  return allOrders.map((o) => {
    const financeSnapshot = getFinanceSnapshot(o);
    const workflowState = getWorkflowState(o);
    const orderWithState = { ...o, workflowState };
    return {
      ...o,
      financeSnapshot,
      workflowState,
      acquisitionSource: getAcquisitionSource(o),
      artifacts: getOrderArtifacts(o),
      deliveryNotification: getLatestDeliveryNotification(o),
      trackedLinks: buildOrderTrackedLinks(o.reference),
      canonicalStage: getOrderActionStage(orderWithState as any, financeSnapshot),
      gates: getOrderGates(orderWithState as any, financeSnapshot),
      nextBestAction: getNextBestAction(orderWithState as any, financeSnapshot),
      ...getArchiveState(o),
    };
  });
});

type EnrichedOrder = Awaited<ReturnType<typeof loadEnrichedOrders>>[number];

function toBandejaOrder(order: EnrichedOrder): BandejaOrder {
  return {
    reference: order.reference,
    clientName: order.clientName,
    clientEmail: order.clientEmail,
    title: order.title,
    langPair: order.langPair,
    paymentStatus: order.paymentStatus,
    deliveryState: order.deliveryState,
    workflowState: order.workflowState,
    isArchived: Boolean(order.isArchived),
    acquisitionSource: order.acquisitionSource,
    createdAt: order.createdAt.toISOString(),
    assignedTo: order.assignedTo,
    dueDate: order.dueDate ? new Date(order.dueDate).toISOString().split("T")[0] : null,
    translatorDeliveredAt: getTranslatorDeliveredAt(order),
    deliveryType: (order as any).deliveryType ?? null,
    amountCents: order.amountCents,
    paymentProofs: getPaymentProofs(order),
    documents: getSubmittedDocuments(order),
    quoteDraft: getQuoteDraft(order),
    quoteAuditTrail: getQuoteAuditTrail(order),
    financeSnapshot: order.financeSnapshot,
    artifacts: order.artifacts,
    deliveryNotification: order.deliveryNotification,
    trackedLinks: order.trackedLinks,
    collaboratorAssignments: ((order as any).collaboratorAssignments || []).map((a: any) => ({
      id: a.id,
      status: a.status,
      collaboratorId: a.collaboratorId,
      quotedPriceCents: a.quotedPriceCents,
      quotedDeadline: a.quotedDeadline ? new Date(a.quotedDeadline).toISOString() : null,
      collaboratorNotes: a.collaboratorNotes,
      rejectionReason: a.rejectionReason,
      revisionReason: a.revisionReason,
      deliveredFileUrl: a.deliveredFileUrl,
      deliveredFilename: a.deliveredFilename,
      deliveredAt: a.deliveredAt ? new Date(a.deliveredAt).toISOString() : null,
      isWinning: Boolean(a.isWinning),
      adminNotes: a.adminNotes,
      collaborator: {
        fullName: a.collaborator.fullName,
        email: a.collaborator.email,
      },
    })),
    draftFileUrl: order.draftFileUrl,
    draftFilename: order.draftFilename,
    draftGeneratedAt: order.draftGeneratedAt ? new Date(order.draftGeneratedAt).toISOString() : null,
    canonicalStage: order.canonicalStage,
    gates: order.gates,
    nextBestAction: order.nextBestAction,
    overdue: isOverdue(order.dueDate),
    dueSoon: isDueSoon(order.dueDate),
  };
}

function computePedidosAccionables(allActiveOrders: EnrichedOrder[]) {
  return allActiveOrders.filter(
    (o) =>
      (o.paymentStatus === "PAID" && o.deliveryState !== "TRADUCIDO") ||
      isOverdue(o.dueDate) ||
      isDueSoon(o.dueDate)
  ).length;
}

// ─── Public API ───

// Igual que authZonaTraductorOrRedirect pero SIN redirigir: devuelve null si no
// hay staff verificado. El layout la usa para no tocar la BD cuando no hay
// sesión (build, /verificar, visitante suelto): antes pagaba la query más cara
// del backoffice sin comprobar auth siquiera.
export const getZonaTraductorStaffEmail = cache(async (): Promise<string | null> => {
  const session = await getServerSession(authOptions);
  const sessionEmail = session?.user?.email?.trim().toLowerCase() || null;
  const verifiedCookie = cookies().get(STAFF_OTP_VERIFIED_COOKIE)?.value;
  const verified = readVerifiedOtpToken(verifiedCookie);
  const verifiedEmail = verified?.email && isStaffEmail(verified.email) ? verified.email : null;
  const sessionStaffEmail = sessionEmail && isStaffEmail(sessionEmail) ? sessionEmail : null;
  if (sessionStaffEmail && (!verifiedEmail || verifiedEmail !== sessionStaffEmail)) return null;
  return sessionStaffEmail || verifiedEmail;
});

export async function authZonaTraductorOrRedirect(): Promise<string> {
  const session = await getServerSession(authOptions);
  const sessionEmail = session?.user?.email?.trim().toLowerCase() || null;
  const verifiedCookie = cookies().get(STAFF_OTP_VERIFIED_COOKIE)?.value;
  const verified = readVerifiedOtpToken(verifiedCookie);
  const verifiedEmail = verified?.email && isStaffEmail(verified.email) ? verified.email : null;
  const sessionStaffEmail = sessionEmail && isStaffEmail(sessionEmail) ? sessionEmail : null;

  if (sessionStaffEmail) {
    if (!verifiedEmail || verifiedEmail !== sessionStaffEmail) {
      redirect("/zona-traductor/verificar");
    }
  }

  const email = sessionStaffEmail || verifiedEmail;
  if (!email) {
    redirect("/zona-traductor/verificar");
  }
  return email;
}

export async function loadBandejaState() {
  const enriched = await loadEnrichedOrders();
  const allActive = enriched.filter((o) => !o.isArchived);
  return {
    orders: allActive.map(toBandejaOrder),
    pedidosAccionables: computePedidosAccionables(allActive),
  };
}

// Expedientes entrantes que aún no tienen presupuesto: el trabajo real que
// espera en la sub-vista Expedientes. cache(): lo piden el badge del nav (en el
// layout) y la propia sub-vista dentro del mismo render.
export const countExpedientesPendientes = cache(async (): Promise<number> => {
  const [expedienteTokens, quotedRefs] = await Promise.all([
    prisma.documentAnalysis.findMany({
      where: { sessionToken: { startsWith: "exp:" } },
      distinct: ["sessionToken"],
      select: { sessionToken: true },
      take: 400,
    }),
    prisma.quote.findMany({
      where: { expedienteRef: { not: null }, deletedAt: null },
      distinct: ["expedienteRef"],
      select: { expedienteRef: true },
    }),
  ]);
  const alreadyQuoted = new Set(quotedRefs.map((q) => q.expedienteRef));
  return expedienteTokens.filter(
    (t) => t.sessionToken && !alreadyQuoted.has(t.sessionToken.replace(/^exp:/, ""))
  ).length;
});

// Badge de la pestaña Presupuestos: lo que espera trabajo del traductor =
// expedientes entrantes SIN presupuesto todavía + borradores sin enviar.
// Decisión de Juan: cuenta ambos (llegar al mismo sitio desde varios ángulos
// no es redundancia; lo redundante sería duplicar la implementación).
export const countPresupuestosAccionables = cache(async (): Promise<number> => {
  const [draftQuotes, pendingExpedientes] = await Promise.all([
    prisma.quote.count({ where: { status: "DRAFT", deletedAt: null } }),
    countExpedientesPendientes(),
  ]);
  return draftQuotes + pendingExpedientes;
});

export async function loadControlState(searchParams: ControlSearchParams) {
  const enriched = await loadEnrichedOrders();
  const dateRange = getDateRange(searchParams.periodo, searchParams.desde, searchParams.hasta);
  const dateBase = normalizeDateBase(searchParams.base);

  const filtro = searchParams.filtro || "todos";
  const qRaw = String(searchParams.q || "").trim();
  const q = qRaw.toLowerCase();

  const periodOrders = enriched.filter((order) => {
    const baseDate = getOrderDateForBase(order, dateBase);
    if (!baseDate) return false;
    return isWithinDateRange(baseDate, dateRange);
  });
  const scopedOrders = q ? periodOrders.filter((order) => matchesSearch(order, q)) : periodOrders;
  const activeScopedOrders = scopedOrders.filter((order) => !order.isArchived);

  const orders = scopedOrders.filter((order) => {
    if (filtro === "archivados") return order.isArchived;
    if (order.isArchived) return false;
    switch (filtro) {
      case "pagados-sin-asignar":
        return order.paymentStatus === "PAID" && !order.assignedTo && order.deliveryState !== "TRADUCIDO";
      case "pendientes-revision":
        return order.workflowState === "PENDIENTE_REVISION";
      case "origen-whatsapp":
        return order.acquisitionSource === "WHATSAPP";
      case "en-proceso":
        return order.deliveryState === "EN_PROCESO";
      case "sla-riesgo":
        return order.dueDate && (isDueSoon(order.dueDate) || isOverdue(order.dueDate)) && order.deliveryState !== "TRADUCIDO";
      case "pendientes-pago":
        return order.paymentStatus === "PENDING";
      case "traducidos":
        return order.deliveryState === "TRADUCIDO";
      case "riesgo-financiero":
        return hasFinancialRisk(order);
      case "margen-aprobacion":
        return requiresMarginApproval(order);
      case "lote-pendiente":
        return hasMonthlyBatchPending(order);
      default:
        return true;
    }
  });

  const counts = {
    todos: activeScopedOrders.length,
    "pagados-sin-asignar": activeScopedOrders.filter((o) => o.paymentStatus === "PAID" && !o.assignedTo && o.deliveryState !== "TRADUCIDO").length,
    "pendientes-revision": activeScopedOrders.filter((o) => o.workflowState === "PENDIENTE_REVISION").length,
    "origen-whatsapp": activeScopedOrders.filter((o) => o.acquisitionSource === "WHATSAPP").length,
    "en-proceso": activeScopedOrders.filter((o) => o.deliveryState === "EN_PROCESO").length,
    "sla-riesgo": activeScopedOrders.filter((o) => o.dueDate && (isDueSoon(o.dueDate) || isOverdue(o.dueDate)) && o.deliveryState !== "TRADUCIDO").length,
    "pendientes-pago": activeScopedOrders.filter((o) => o.paymentStatus === "PENDING").length,
    traducidos: activeScopedOrders.filter((o) => o.deliveryState === "TRADUCIDO").length,
    // Cifras financieras SIN Bizum ni apartados (regla Juan 27-ago-2026: «nada que sea Bizum»).
    "riesgo-financiero": activeScopedOrders.filter((o) => isOrderInBooks(o) && hasFinancialRisk(o)).length,
    "margen-aprobacion": activeScopedOrders.filter((o) => isOrderInBooks(o) && requiresMarginApproval(o)).length,
    "lote-pendiente": activeScopedOrders.filter((o) => isOrderInBooks(o) && hasMonthlyBatchPending(o)).length,
    archivados: scopedOrders.filter((o) => o.isArchived).length,
  };

  const paidCount = activeScopedOrders.filter((o) => o.paymentStatus === "PAID").length;
  const inProgressCount = activeScopedOrders.filter((o) => o.deliveryState === "EN_PROCESO").length;
  const pendingPayCount = activeScopedOrders.filter((o) => o.paymentStatus === "PENDING").length;
  const reviewPendingCount = counts["pendientes-revision"];
  const whatsappLeadCount = counts["origen-whatsapp"];
  const financialRiskCount = counts["riesgo-financiero"];
  const marginApprovalPendingCount = counts["margen-aprobacion"];
  const monthlyBatchPendingCount = counts["lote-pendiente"];
  const financeClosedCount = activeScopedOrders.filter((o) => o.financeSnapshot.hasFinanceCloseEvent).length;
  // Ingresos y margen: solo pedidos EN LIBROS (Bizum sin factura y apartados fuera).
  const booksOrders = activeScopedOrders.filter((o) => isOrderInBooks(o));
  const paidRevenueCents = booksOrders
    .filter((o) => o.paymentStatus === "PAID")
    .reduce((acc, order) => acc + order.amountCents, 0);
  const supplierPaymentPendingCount = booksOrders.filter(
    (o) => o.paymentStatus === "PAID" && o.financeSnapshot.supplierInvoiceStatus !== "PAID"
  ).length;

  const marginValues = booksOrders
    .map((o) => o.financeSnapshot.marginPct)
    .filter((v): v is number => typeof v === "number");
  const avgMarginPct = marginValues.length
    ? Number((marginValues.reduce((acc, v) => acc + v, 0) / marginValues.length).toFixed(2))
    : null;

  const criticalFinanceOrders = booksOrders
    .filter(
      (o) =>
        hasFinancialRisk(o) ||
        requiresMarginApproval(o) ||
        hasMonthlyBatchPending(o) ||
        (o.paymentStatus === "PAID" && o.financeSnapshot.accountingCutoffPassed && !o.financeSnapshot.hasFinanceCloseEvent)
    )
    .slice(0, 6);

  const allActive = enriched.filter((o) => !o.isArchived);
  const pedidosAccionables = computePedidosAccionables(allActive);

  return {
    orders,
    // Mismos pedidos filtrados, serializados para las tarjetas de triage: la
    // vista Cards y la vista Tabla comparten filtro y dataset (una sola carga).
    bandejaOrders: orders.map(toBandejaOrder),
    periodOrders,
    activeScopedOrders,
    counts,
    paidCount,
    inProgressCount,
    pendingPayCount,
    reviewPendingCount,
    whatsappLeadCount,
    financialRiskCount,
    marginApprovalPendingCount,
    monthlyBatchPendingCount,
    financeClosedCount,
    paidRevenueCents,
    supplierPaymentPendingCount,
    avgMarginPct,
    criticalFinanceOrders,
    dateRange,
    dateBase,
    filtro,
    qRaw,
    pedidosAccionables,
  };
}

// Helpers reexportables (puros) que las vistas necesitan en JSX
export {
  getAcquisitionSource,
  getArchiveState,
  getLatestDeliveryNotification,
  getOrderArtifacts,
  getPaymentProofs,
  getSubmittedDocuments,
  getQuoteDraft,
  getQuoteAuditTrail,
  hasFinancialRisk,
  requiresMarginApproval,
  hasMonthlyBatchPending,
  topFinancialAlert,
};
