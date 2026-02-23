import { NextResponse } from "next/server";
import { getAllOrdersForStaff } from "@/lib/orders";
import { requireStaffAccess } from "@/lib/staff-auth";
import { getFinanceSnapshot } from "@/lib/finance";
import { getWorkflowState } from "@/lib/workflow";

export const runtime = "nodejs";

type PeriodKey = "total" | "hoy" | "7d" | "mes" | "mes-anterior" | "custom";
type DateBaseKey = "created" | "paid";

type DateRange = {
  key: PeriodKey;
  from: Date | null;
  to: Date | null;
};

function normalizePeriod(value?: string | null): PeriodKey {
  if (value === "hoy" || value === "7d" || value === "mes" || value === "mes-anterior" || value === "custom") {
    return value;
  }
  return "total";
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

function getDateRange(periodRaw?: string | null, fromRaw?: string | null, toRaw?: string | null): DateRange {
  const now = new Date();
  const key = normalizePeriod(periodRaw);

  if (key === "hoy") {
    return { key, from: startOfDay(now), to: endOfDay(now) };
  }
  if (key === "7d") {
    return {
      key,
      from: startOfDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)),
      to: endOfDay(now),
    };
  }
  if (key === "mes") {
    return { key, from: startOfMonth(now), to: endOfDay(now) };
  }
  if (key === "mes-anterior") {
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { key, from: startOfMonth(prevMonth), to: endOfMonth(prevMonth) };
  }
  if (key === "custom") {
    const fromDate = parseDateInput(fromRaw);
    const toDate = parseDateInput(toRaw);
    return {
      key,
      from: fromDate ? startOfDay(fromDate) : null,
      to: toDate ? endOfDay(toDate) : null,
    };
  }

  return { key: "total", from: null, to: null };
}

function isWithinDateRange(date: Date, range: DateRange) {
  const time = date.getTime();
  if (range.from && time < range.from.getTime()) return false;
  if (range.to && time > range.to.getTime()) return false;
  return true;
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

function getAcquisitionSource(order: any): "WHATSAPP" | "WEB" {
  const events = order.events || [];
  if (events.some((e: any) => e.type === "wa.lead_received")) return "WHATSAPP";
  const acquisitionEvent = events.find((e: any) => e.type === "order.acquisition");
  const source = String((acquisitionEvent?.payload as any)?.source || "").toUpperCase();
  return source === "WHATSAPP" ? "WHATSAPP" : "WEB";
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
    !["VALIDATED", "PAID"].includes(order.financeSnapshot.supplierInvoiceStatus)
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
    const dateRange = getDateRange(
      url.searchParams.get("periodo"),
      url.searchParams.get("desde"),
      url.searchParams.get("hasta")
    );
    const dateBase = normalizeDateBase(url.searchParams.get("base"));

    const allOrders = await getAllOrdersForStaff();
    const allOrdersWithFinance = allOrders.map((order) => ({
      ...order,
      financeSnapshot: getFinanceSnapshot(order),
      workflowState: getWorkflowState(order),
      acquisitionSource: getAcquisitionSource(order),
      ...getArchiveState(order),
    }));

    const periodOrders = allOrdersWithFinance.filter((order) => {
      const baseDate = getOrderDateForBase(order, dateBase);
      if (!baseDate) return false;
      return isWithinDateRange(baseDate, dateRange);
    });

    const scopedOrders = q ? periodOrders.filter((order) => matchesSearch(order, q)) : periodOrders;

    const filteredOrders = scopedOrders.filter((order) => {
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
