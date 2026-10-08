import { NextResponse } from "next/server";
import { getAllOrdersForStaff } from "@/lib/orders";
import { requireStaffAccess } from "@/lib/staff-auth";
import { getFinanceSnapshot } from "@/lib/finance";
import { getWorkflowState } from "@/lib/workflow";
import { inRange } from "@/lib/pedidos-kpis";
import { getAcquisitionSource, matchesOrderSlicers, parseSlicers } from "@/lib/panel-slicers";
import { matchesHeaderFilter } from "@/lib/pedidos-filters";
import { periodBounds, tablePeriod, type Period } from "@/lib/panel-period";

export const runtime = "nodejs";

type DateBaseKey = "created" | "paid";

function normalizeDateBase(value?: string | null): DateBaseKey {
  return value === "paid" ? "paid" : "created";
}

function isWithinPeriod(date: Date, period: Period | null) {
  if (!period) return true;
  const { from, to } = periodBounds(period);
  return inRange(date, from, to);
}

function isDueSoon(dueDate: Date | null) {
  if (!dueDate) return false;
  const now = new Date();
  const diff = new Date(dueDate).getTime() - now.getTime();
  return diff > 0 && diff < 2 * 24 * 60 * 60 * 1000;
}

function isOverdue(dueDate: Date | null) {
  if (!dueDate) return false;
  return new Date(dueDate).getTime() < Date.now();
}

function getArchiveState(order: any) {
  const evt = (order.events || []).find((e: any) => e.type === "order.archived" || e.type === "order.unarchived");
  if (!evt) return { isArchived: false };
  return { isArchived: evt.type === "order.archived" };
}

function getOrderDateForBase(order: any, base: DateBaseKey) {
  if (base === "paid") {
    return order.paidAt ? new Date(order.paidAt) : null;
  }
  return new Date(order.createdAt);
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

function formatMoney(cents: number) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function formatDateTime(date: Date | null) {
  if (!date) return "";
  return new Date(date).toLocaleString("es-ES", { timeZone: "Europe/Madrid" });
}

function csvEscape(value: unknown) {
  const raw = value === null || value === undefined ? "" : String(value);
  if (/[;"\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, "\"\"")}"`;
  }
  return raw;
}

function csvRow(values: unknown[]) {
  return values.map(csvEscape).join(";");
}

export async function GET(req: Request) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const filtro = String(url.searchParams.get("filtro") || "todos");
    const qRaw = String(url.searchParams.get("q") || "").trim();
    const q = qRaw.toLowerCase();
    // Sin `p` (o con búsqueda) se exporta todo el histórico, como la tabla.
    const period = tablePeriod(url.searchParams.get("p"), url.searchParams.get("d"), qRaw);
    const dateBase = normalizeDateBase(url.searchParams.get("base"));

    const allOrders = await getAllOrdersForStaff();
    const allOrdersWithFinance = allOrders.map((order) => ({
      ...order,
      financeSnapshot: getFinanceSnapshot(order),
      workflowState: getWorkflowState(order),
      acquisitionSource: getAcquisitionSource(order),
      ...getArchiveState(order),
    }));

    const slicers = parseSlicers((k) => url.searchParams.get(k));
    const periodOrders = allOrdersWithFinance.filter((order) => {
      if (!matchesOrderSlicers(order, slicers)) return false;
      const baseDate = getOrderDateForBase(order, dateBase);
      if (!baseDate) return false;
      return isWithinPeriod(baseDate, period);
    });

    const scopedOrders = q ? periodOrders.filter((order) => matchesSearch(order, q)) : periodOrders;

    const filteredOrders = scopedOrders.filter((order) => {
      if (filtro === "archivados") return order.isArchived;
      if (order.isArchived && filtro !== "cobrados") return false;

      const header = matchesHeaderFilter(order, filtro);
      if (header !== undefined) return header;

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

    const header = csvRow([
      "Referencia",
      "Titulo",
      "Cliente",
      "Idioma",
      "Canal",
      "Workflow",
      "Pago",
      "Entrega",
      "ImporteEUR",
      "Asignado",
      "FechaPedido",
      "FechaCobro",
      "FechaEntrega",
      "Archivado",
      "RiesgoFinanciero",
      "Conciliacion",
      "FacturaProveedor",
      "MargenPct",
      "MargenEUR",
      "AlertasFinancieras",
    ]);

    const lines = filteredOrders.map((order) => {
      const warnings = Array.isArray(order.financeSnapshot.warnings)
        ? order.financeSnapshot.warnings.join(" | ")
        : "";

      return csvRow([
        order.reference,
        order.title,
        order.clientEmail,
        order.langPair || "",
        order.acquisitionSource,
        order.workflowState,
        order.paymentStatus,
        order.deliveryState,
        formatMoney(order.amountCents),
        order.assignedTo || "",
        formatDateTime(order.createdAt ? new Date(order.createdAt) : null),
        formatDateTime(order.paidAt ? new Date(order.paidAt) : null),
        formatDateTime(order.dueDate ? new Date(order.dueDate) : null),
        order.isArchived ? "SI" : "NO",
        hasFinancialRisk(order) ? "SI" : "NO",
        order.financeSnapshot.reconciliationStatus,
        order.financeSnapshot.supplierInvoiceStatus,
        order.financeSnapshot.marginPct === null ? "" : order.financeSnapshot.marginPct,
        order.financeSnapshot.marginCents === null ? "" : formatMoney(order.financeSnapshot.marginCents),
        warnings,
      ]);
    });

    const csv = `\uFEFF${[header, ...lines].join("\n")}\n`;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="zona-traductor-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("[orders-export] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "No se pudo exportar CSV." },
      { status: 500 }
    );
  }
}
