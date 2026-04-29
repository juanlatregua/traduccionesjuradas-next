import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isStaffEmail } from "@/lib/staff-access";
import { readVerifiedOtpToken, STAFF_OTP_VERIFIED_COOKIE } from "@/lib/staff-otp";
import { getAllOrdersForStaff } from "@/lib/orders";
import ZonaTraductorFilters from "@/components/ZonaTraductorFilters";
import OrderActionPanel from "@/components/OrderActionPanel";
import OrderTableWithBulkActions from "@/components/OrderTableWithBulkActions";
import TranslatorAgenda from "@/components/TranslatorAgenda";
import AutoRefresh from "@/components/AutoRefresh";
import { getFinanceSnapshot } from "@/lib/finance";
import { getWorkflowState, getWorkflowStateLabel } from "@/lib/workflow";
import { getTrackedConsultaUrl, getTrackedPresupuestoUrl } from "@/lib/contact";
import ZonaTraductorThemeToggle from "@/components/ZonaTraductorThemeToggle";
import PMQuickCreatePanel from "@/components/PMQuickCreatePanel";
import EstimationAccuracyCard from "@/components/EstimationAccuracyCard";
import ZonaTraductorNav from "@/components/ZonaTraductorNav";
import BandejaEntrada from "@/components/BandejaEntrada";
import type { BandejaOrder } from "@/components/BandejaEntrada";
import {
  buildOrderTrackedLinks,
  getDeliveryArtifactUrl,
  getNextBestAction,
  getOrderActionStage,
  getOrderGates,
} from "@/lib/order-actions";
import { isDueSoon, isOverdue } from "@/lib/order-utils";

export const metadata: Metadata = {
  title: "Zona traductor",
  description: "Gestion interna de pedidos para traductor y administracion.",
  robots: {
    index: false,
    follow: false,
  },
};

function formatMoney(cents: number) {
  return `${(cents / 100).toFixed(2)} EUR`;
}

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

  // Documents from IA analysis (presupuesto instantáneo)
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
    return {
      key,
      label: "Hoy",
      from: startOfDay(now),
      to: endOfDay(now),
      fromInput: "",
      toInput: "",
    };
  }

  if (key === "7d") {
    const from = startOfDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
    return {
      key,
      label: "Ultimos 7 dias",
      from,
      to: endOfDay(now),
      fromInput: "",
      toInput: "",
    };
  }

  if (key === "mes") {
    return {
      key,
      label: "Mes actual",
      from: startOfMonth(now),
      to: endOfDay(now),
      fromInput: "",
      toInput: "",
    };
  }

  if (key === "mes-anterior") {
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const from = startOfMonth(prevMonth);
    const to = endOfMonth(prevMonth);
    return {
      key,
      label: "Mes anterior",
      from,
      to,
      fromInput: "",
      toInput: "",
    };
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
    return {
      key,
      label,
      from,
      to,
      fromInput: formatInputDate(fromDate),
      toInput: formatInputDate(toDate),
    };
  }

  return {
    key: "total",
    label: "Total historico",
    from: null,
    to: null,
    fromInput: "",
    toInput: "",
  };
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

export default async function ZonaTraductorPage({
  searchParams,
}: {
  searchParams: {
    modo?: string;
    filtro?: string;
    q?: string;
    periodo?: string;
    desde?: string;
    hasta?: string;
    base?: string;
  };
}) {
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

  const modo: "bandeja" | "control" = searchParams.modo === "control" ? "control" : "bandeja";

  const allOrders = await getAllOrdersForStaff();
  const allOrdersWithFinance = allOrders.map((o) => {
    const financeSnapshot = getFinanceSnapshot(o);
    const workflowState = getWorkflowState(o);
    const orderWithState = {
      ...o,
      workflowState,
    };
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
  const dateRange = getDateRange(searchParams.periodo, searchParams.desde, searchParams.hasta);
  const dateBase = normalizeDateBase(searchParams.base);

  const filtro = searchParams.filtro || "todos";
  const qRaw = String(searchParams.q || "").trim();
  const q = qRaw.toLowerCase();

  const periodOrders = allOrdersWithFinance.filter((order) => {
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
      case "archivados":
        return order.isArchived;
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
    "riesgo-financiero": activeScopedOrders.filter((o) => hasFinancialRisk(o)).length,
    "margen-aprobacion": activeScopedOrders.filter((o) => requiresMarginApproval(o)).length,
    "lote-pendiente": activeScopedOrders.filter((o) => hasMonthlyBatchPending(o)).length,
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
  const paidRevenueCents = activeScopedOrders
    .filter((o) => o.paymentStatus === "PAID")
    .reduce((acc, order) => acc + order.amountCents, 0);
  const supplierPaymentPendingCount = activeScopedOrders.filter(
    (o) => o.paymentStatus === "PAID" && o.financeSnapshot.supplierInvoiceStatus !== "PAID"
  ).length;

  const marginValues = activeScopedOrders
    .map((o) => o.financeSnapshot.marginPct)
    .filter((v): v is number => typeof v === "number");
  const avgMarginPct = marginValues.length
    ? Number((marginValues.reduce((acc, v) => acc + v, 0) / marginValues.length).toFixed(2))
    : null;

  const criticalFinanceOrders = activeScopedOrders
    .filter(
      (o) =>
        hasFinancialRisk(o) ||
        requiresMarginApproval(o) ||
        hasMonthlyBatchPending(o) ||
        (o.paymentStatus === "PAID" && o.financeSnapshot.accountingCutoffPassed && !o.financeSnapshot.hasFinanceCloseEvent)
    )
    .slice(0, 6);

  // Bandeja: compute actionable count and order data
  const allActiveOrders = allOrdersWithFinance.filter((o) => !o.isArchived);
  const pedidosAccionables = allActiveOrders.filter(
    (o) =>
      (o.paymentStatus === "PAID" && o.deliveryState !== "TRADUCIDO") ||
      isOverdue(o.dueDate) ||
      isDueSoon(o.dueDate)
  ).length;

  function toBandejaOrder(order: typeof allOrdersWithFinance[number]): BandejaOrder {
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
      amountCents: order.amountCents,
      paymentProofs: getPaymentProofs(order),
      documents: getSubmittedDocuments(order),
      quoteDraft: getQuoteDraft(order),
      quoteAuditTrail: getQuoteAuditTrail(order),
      financeSnapshot: order.financeSnapshot,
      artifacts: order.artifacts,
      deliveryNotification: order.deliveryNotification,
      trackedLinks: order.trackedLinks,
      collaboratorAssignments: (order.collaboratorAssignments || []).map((a: any) => ({
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

  const bandejaOrders = allActiveOrders.map(toBandejaOrder);

  // Bandeja mode
  if (modo === "bandeja") {
    return (
      <div id="zona-traductor-root" className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800">
        <ZonaTraductorNav modoActivo="bandeja" pedidosAccionables={pedidosAccionables} />
        <AutoRefresh intervalMs={20000} idleMs={30000} />
        <BandejaEntrada orders={bandejaOrders} staffEmail={email} />
      </div>
    );
  }

  // Control mode
  return (
    <div id="zona-traductor-root" className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800">
      <ZonaTraductorNav modoActivo="control" pedidosAccionables={pedidosAccionables} />
    <main className="px-4 py-10">
      <AutoRefresh intervalMs={20000} idleMs={30000} />
      <section className="mx-auto max-w-6xl rounded-3xl border border-slate-700 bg-slate-900/80 p-6 shadow-xl sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">Zona traductor</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Gestion operativa + control economico
        </h1>
        <p className="mt-1 text-sm text-slate-400">Sesion: {email}</p>
        <ZonaTraductorThemeToggle />

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4 text-center">
            <p className="text-2xl font-bold text-white">{activeScopedOrders.length}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Total activos</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{paidCount}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-400/60">Pagados</p>
          </div>
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">{inProgressCount}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-blue-400/60">En proceso</p>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-center">
            <p className="text-2xl font-bold text-amber-400">{pendingPayCount}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-amber-400/60">Pend. pago</p>
          </div>
          <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-4 text-center">
            <p className="text-2xl font-bold text-orange-300">{reviewPendingCount}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-orange-300/70">Pend. revisión</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
            <p className="text-2xl font-bold text-emerald-300">{whatsappLeadCount}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-300/70">Origen WA</p>
          </div>
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-center">
            <p className="text-2xl font-bold text-red-400">{financialRiskCount}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-red-400/70">Riesgo financiero</p>
          </div>
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-center col-span-2 sm:col-span-1">
            <p className="text-sm font-bold text-cyan-300">{formatMoney(paidRevenueCents)}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-cyan-300/70">Ingresos cobrados</p>
          </div>
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 text-center">
            <p className="text-2xl font-bold text-rose-300">{supplierPaymentPendingCount}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-rose-300/70">Pagos prov. pend.</p>
          </div>
          <div className="rounded-2xl border border-lime-500/20 bg-lime-500/5 p-4 text-center">
            <p className="text-2xl font-bold text-lime-300">{financeClosedCount}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-lime-300/70">Cierres fin.</p>
          </div>
          <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4 text-center">
            <p className="text-2xl font-bold text-yellow-300">{marginApprovalPendingCount}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-yellow-300/70">Aprob. margen</p>
          </div>
          <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-4 text-center">
            <p className="text-2xl font-bold text-fuchsia-300">{monthlyBatchPendingCount}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-fuchsia-300/70">Lote vencido</p>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-xs text-slate-300">
          <p>
            Periodo activo:{" "}
            <span className="font-semibold text-slate-100">{dateRange.label}</span>
            {" · "}
            <span className="font-semibold text-slate-100">
              {dateBase === "paid" ? "Base fecha cobro" : "Base fecha pedido"}
            </span>
            {" · "}
            <span className="text-slate-400">Resetear vista no borra datos, solo limpia filtros y estadisticas.</span>
          </p>
          <p>
            Margen medio con datos:{" "}
            <span className="font-semibold text-slate-100">{avgMarginPct === null ? "—" : `${avgMarginPct}%`}</span>
          </p>
          <p className="mt-1 text-slate-400">
            Si un pedido cae por debajo del umbral de margen (10%), queda bloqueado para cierre hasta aprobar.
          </p>
          <p className="mt-2 text-slate-400">
            Flujo WhatsApp: usa{" "}
            <a
              href={getTrackedPresupuestoUrl("pm")}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-cyan-300 underline"
            >
              enlace presupuesto
            </a>{" "}
            y{" "}
            <a
              href={getTrackedConsultaUrl(undefined, "pm")}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-cyan-300 underline"
            >
              enlace consulta
            </a>{" "}
            para que el lead entre trazado como `src=wa`.
          </p>
        </div>
      </section>

      <PMQuickCreatePanel />

      <section className="mx-auto mt-6 max-w-6xl rounded-3xl border border-cyan-500/30 bg-cyan-500/5 p-6 shadow-xl sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">Presupuestos con preview</p>
        <h2 className="mt-2 text-lg font-semibold text-white">
          Crear, previsualizar y enviar presupuesto desde zona traductor
        </h2>
        <p className="mt-1 text-sm text-slate-300">
          Flujo recomendado para leads que te llegan por email o WhatsApp: primero previsualiza PDF y email, luego envía.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href="/admin/quotes/new"
            className="rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-600"
          >
            Nuevo presupuesto con preview
          </a>
          <a
            href="/admin/quotes"
            className="rounded-xl border border-cyan-500/40 px-4 py-2 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/10"
          >
            Ver todos los presupuestos
          </a>
        </div>
      </section>

      <EstimationAccuracyCard />

      {orders.length > 0 && (
        <section className="mx-auto mt-6 max-w-6xl space-y-3">
          <h2 className="text-lg font-semibold text-white">
            Acciones por pedido
            <span className="ml-2 text-sm font-normal text-slate-400">(pulsa para expandir)</span>
          </h2>
          {orders.map((order) => (
            <OrderActionPanel
              key={order.reference}
              reference={order.reference}
              clientName={order.clientName}
              clientEmail={order.clientEmail}
              title={order.title}
              langPair={order.langPair}
              paymentStatus={order.paymentStatus}
              deliveryState={order.deliveryState}
              workflowState={order.workflowState}
              acquisitionSource={order.acquisitionSource}
              assignedTo={order.assignedTo}
              dueDate={order.dueDate ? new Date(order.dueDate).toISOString().split("T")[0] : null}
              amountCents={order.amountCents}
              paymentProofs={getPaymentProofs(order)}
              documents={getSubmittedDocuments(order)}
              quoteDraft={getQuoteDraft(order)}
              quoteAuditTrail={getQuoteAuditTrail(order)}
              isArchived={Boolean(order.isArchived)}
              financeSnapshot={order.financeSnapshot}
              artifacts={order.artifacts}
              deliveryNotification={order.deliveryNotification}
              trackedLinks={order.trackedLinks}
              draftFileUrl={order.draftFileUrl}
              draftFilename={order.draftFilename}
              draftGeneratedAt={order.draftGeneratedAt ? new Date(order.draftGeneratedAt).toISOString() : null}
              collaboratorAssignments={(order.collaboratorAssignments || []).map((a: any) => ({
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
                adminNotes: a.adminNotes,
                collaborator: {
                  fullName: a.collaborator.fullName,
                  email: a.collaborator.email,
                },
              }))}
              canonicalStage={order.canonicalStage}
              gates={order.gates}
              nextBestAction={order.nextBestAction}
            />
          ))}
        </section>
      )}

      {criticalFinanceOrders.length > 0 && (
        <section className="mx-auto mt-6 max-w-6xl rounded-3xl border border-red-500/30 bg-red-500/5 p-6 shadow-xl sm:p-8">
          <h2 className="text-lg font-semibold text-red-200">Alertas criticas a resolver hoy</h2>
          <ul className="mt-3 space-y-2 text-sm text-red-100">
            {criticalFinanceOrders.map((order) => (
              <li key={order.reference} className="rounded-xl border border-red-500/20 bg-slate-900/50 px-3 py-2">
                <span className="font-mono text-xs font-bold text-cyan-300">{order.reference}</span>
                <span className="mx-2 text-slate-500">·</span>
                <span>{topFinancialAlert(order)}</span>
                <span className="mx-2 text-slate-500">·</span>
                <span className="text-slate-300">{order.clientEmail}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <TranslatorAgenda
        items={periodOrders.map((o) => ({
          reference: o.reference,
          title: o.title,
          dueDate: o.dueDate,
          deliveryState: o.deliveryState,
          assignedTo: o.assignedTo,
        }))}
      />

      <section className="mx-auto mt-6 max-w-6xl rounded-3xl border border-slate-700 bg-slate-900/80 p-6 shadow-xl sm:p-8">
        <h2 className="text-lg font-semibold text-white">
          Pedidos
          <span className="ml-2 text-sm font-normal text-slate-400">({orders.length})</span>
        </h2>

        <ZonaTraductorFilters
          current={filtro}
          counts={counts}
          query={qRaw}
          period={dateRange.key}
          fromDate={dateRange.fromInput}
          toDate={dateRange.toInput}
          dateBase={dateBase}
        />

        {orders.length === 0 ? (
          <p className="mt-6 text-center text-sm text-slate-500">No hay pedidos con este filtro.</p>
        ) : (
          <OrderTableWithBulkActions
            orders={orders.map((order) => {
              const paymentProofs = getPaymentProofs(order);
              const latestProof = paymentProofs[0];
              const quickQuoteParams = new URLSearchParams({
                customerEmail: order.clientEmail || "",
                customerName: order.clientName || "",
                lineDescription: order.title || "Traducción jurada",
                lineAmount: (Math.max(0, Number(order.amountCents || 0)) / 100).toFixed(2),
                langPair: order.langPair || "",
              });
              return {
                reference: order.reference,
                title: order.title,
                amountCents: order.amountCents,
                paymentStatus: order.paymentStatus,
                deliveryState: order.deliveryState,
                workflowState: order.workflowState,
                workflowStateLabel: getWorkflowStateLabel(order.workflowState),
                acquisitionSource: order.acquisitionSource,
                assignedTo: order.assignedTo,
                dueDate: order.dueDate ? new Date(order.dueDate).toISOString().split("T")[0] : null,
                dueSoon: isDueSoon(order.dueDate),
                overdue: isOverdue(order.dueDate),
                clientEmail: order.clientEmail,
                clientName: order.clientName,
                langPair: order.langPair,
                latestProofUrl: latestProof ? latestProof.fileUrl : null,
                financeRisk: hasFinancialRisk(order),
                financeTitle: order.financeSnapshot.warnings.length
                  ? order.financeSnapshot.warnings.join(" | ")
                  : "Sin alertas financieras",
                marginPct: order.financeSnapshot.marginPct,
                requiresMarginApproval: requiresMarginApproval(order),
                hasMonthlyBatchPending: hasMonthlyBatchPending(order),
                quickQuoteHref: `/admin/quotes/new?${quickQuoteParams.toString()}`,
                showConfirmPayment:
                  order.paymentStatus === "PENDING" &&
                  ["PENDIENTE_PAGO", "JUSTIFICANTE_SUBIDO", "PRESUPUESTO_ENVIADO"].includes(order.workflowState),
                hasWorkspaceAccess: order.paymentStatus === "PAID" && !!order.assignedTo,
              };
            })}
          />
        )}
      </section>
    </main>
    </div>
  );
}
