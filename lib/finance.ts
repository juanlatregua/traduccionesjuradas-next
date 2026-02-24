type EventLike = {
  type: string;
  payload?: any;
  createdAt?: Date | string | null;
};

type OrderLike = {
  amountCents: number;
  paymentStatus: string;
  createdAt?: Date | string | null;
  events?: EventLike[];
};

function envInt(name: string, fallback: number) {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) ? Math.round(raw) : fallback;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export const FINANCE_RECONCILIATION_TOLERANCE_MIN_CENTS = 100; // 1 EUR
export const FINANCE_RECONCILIATION_TOLERANCE_MAX_CENTS = 500; // 5 EUR
export const DEFAULT_RECONCILIATION_TOLERANCE_CENTS = clamp(
  envInt("FINANCE_RECONCILIATION_TOLERANCE_CENTS", 300),
  FINANCE_RECONCILIATION_TOLERANCE_MIN_CENTS,
  FINANCE_RECONCILIATION_TOLERANCE_MAX_CENTS
);
export const MARGIN_APPROVAL_THRESHOLD_PCT = Math.max(
  0,
  envInt("FINANCE_MARGIN_APPROVAL_THRESHOLD_PCT", 10)
);
export const ACCOUNTING_CUTOFF_DAY = clamp(envInt("FINANCE_ACCOUNTING_CUTOFF_DAY", 25), 1, 28);

export type ReconciliationStatus = "PENDING" | "MATCHED" | "RECONCILED" | "MISMATCH";
export type SupplierInvoiceStatus =
  | "PENDING_REQUEST"
  | "REQUESTED"
  | "RECEIVED"
  | "BOOKED"
  | "PAID"
  | "UNKNOWN";
export type SupplierBillingMode = "PER_ORDER" | "MONTHLY_BATCH" | "UNKNOWN";
export type SupplierType = "AUTONOMO" | "EMPRESA" | "UNKNOWN";
export type MarginApprovalStatus = "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED";

export type FinanceSnapshot = {
  reconciliationStatus: ReconciliationStatus;
  reconciliationDiffCents: number | null;
  reconciliationToleranceCents: number;
  reconciliationExpectedAmountCents: number | null;
  reconciliationReceivedAmountCents: number | null;
  reconciliationGatewayFeeCents: number | null;
  reconciledAt: string | null;
  supplierInvoiceStatus: SupplierInvoiceStatus;
  supplierInvoiceBillingMode: SupplierBillingMode;
  supplierType: SupplierType;
  supplierName: string | null;
  supplierInvoiceNumber: string | null;
  supplierInvoiceTotalCents: number | null;
  supplierIrpfRetentionPct: number | null;
  supplierInvoiceDueDate: string | null;
  marginCents: number | null;
  marginPct: number | null;
  marginSupplierCostCents: number | null;
  marginOtherCostCents: number | null;
  marginGatewayFeeCents: number | null;
  marginThresholdPct: number;
  requiresMarginApproval: boolean;
  marginApprovalStatus: MarginApprovalStatus;
  hasFinanceCloseEvent: boolean;
  accountingCutoffDate: string | null;
  accountingCutoffPassed: boolean;
  isFinanciallyCloseable: boolean;
  warnings: string[];
};

function toDate(value: unknown) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  if (isNaN(d.getTime())) return null;
  return d;
}

function toIso(value: unknown) {
  const d = toDate(value);
  return d ? d.toISOString() : null;
}

function sortEventsDesc(events: EventLike[]) {
  return [...events].sort((a, b) => {
    const ta = new Date(a.createdAt || 0).getTime();
    const tb = new Date(b.createdAt || 0).getTime();
    return tb - ta;
  });
}

function latestEvent(events: EventLike[], type: string) {
  return sortEventsDesc(events).find((e) => e.type === type) || null;
}

function cents(value: unknown, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(n);
}

function safeSupplierStatus(raw: unknown): SupplierInvoiceStatus {
  const s = String(raw || "").toUpperCase();
  if (s === "VALIDATED") return "BOOKED";
  if (
    s === "PENDING_REQUEST" ||
    s === "REQUESTED" ||
    s === "RECEIVED" ||
    s === "BOOKED" ||
    s === "PAID"
  ) {
    return s;
  }
  return "UNKNOWN";
}

function safeSupplierBillingMode(raw: unknown): SupplierBillingMode {
  const s = String(raw || "").toUpperCase();
  if (s === "PER_ORDER" || s === "MONTHLY_BATCH") return s;
  return "UNKNOWN";
}

function safeSupplierType(raw: unknown): SupplierType {
  const s = String(raw || "").toUpperCase();
  if (s === "AUTONOMO" || s === "EMPRESA") return s;
  return "UNKNOWN";
}

function getCutoffForMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex, ACCOUNTING_CUTOFF_DAY, 23, 59, 59, 999);
}

function getNextAccountingCutoff(fromDate: Date) {
  const sameMonthCutoff = getCutoffForMonth(fromDate.getFullYear(), fromDate.getMonth());
  if (fromDate.getTime() <= sameMonthCutoff.getTime()) return sameMonthCutoff;
  return getCutoffForMonth(fromDate.getFullYear(), fromDate.getMonth() + 1);
}

function getReconciliationStatus(order: OrderLike) {
  const evt = latestEvent(order.events || [], "finance.reconciliation.updated");
  if (!evt) {
    return {
      status: "PENDING" as ReconciliationStatus,
      diffCents: null,
      toleranceCents: DEFAULT_RECONCILIATION_TOLERANCE_CENTS,
      expectedAmountCents: null as number | null,
      receivedAmountCents: null as number | null,
      gatewayFeeCents: null as number | null,
      reconciledAt: null,
      payload: null as any,
    };
  }

  const diffCents = cents(evt.payload?.diffCents, 0);
  const toleranceCents = clamp(
    cents(evt.payload?.toleranceCents, DEFAULT_RECONCILIATION_TOLERANCE_CENTS),
    FINANCE_RECONCILIATION_TOLERANCE_MIN_CENTS,
    FINANCE_RECONCILIATION_TOLERANCE_MAX_CENTS
  );
  const rawStatus = String(evt.payload?.status || "").toUpperCase();
  const status: ReconciliationStatus =
    rawStatus === "RECONCILED"
      ? "RECONCILED"
      : rawStatus === "MATCHED"
        ? "MATCHED"
        : "MISMATCH";
  return {
    status: status as ReconciliationStatus,
    diffCents,
    toleranceCents,
    expectedAmountCents: cents(evt.payload?.expectedAmountCents, 0),
    receivedAmountCents: cents(evt.payload?.receivedAmountCents, 0),
    gatewayFeeCents: cents(evt.payload?.gatewayFeeCents, 0),
    reconciledAt: toIso(evt.createdAt),
    payload: evt.payload || null,
  };
}

function getSupplierInvoiceStatus(order: OrderLike) {
  const evt = latestEvent(order.events || [], "finance.supplier_invoice.updated");
  if (!evt) {
    return {
      status: "PENDING_REQUEST" as SupplierInvoiceStatus,
      billingMode: "PER_ORDER" as SupplierBillingMode,
      supplierType: "UNKNOWN" as SupplierType,
      supplierName: null as string | null,
      invoiceNumber: null as string | null,
      totalCents: null as number | null,
      irpfRetentionPct: null as number | null,
      dueDate: null as string | null,
      payload: null as any,
    };
  }

  const status = safeSupplierStatus(evt.payload?.status);
  const rawBillingMode = safeSupplierBillingMode(evt.payload?.billingMode);
  const billingMode = rawBillingMode === "UNKNOWN" ? "PER_ORDER" : rawBillingMode;
  const supplierType = safeSupplierType(evt.payload?.supplierType);
  return {
    status,
    billingMode,
    supplierType,
    supplierName: evt.payload?.supplierName ? String(evt.payload?.supplierName) : null,
    invoiceNumber: evt.payload?.invoiceNumber ? String(evt.payload?.invoiceNumber) : null,
    totalCents: Number.isFinite(Number(evt.payload?.totalCents))
      ? cents(evt.payload?.totalCents, 0)
      : null,
    irpfRetentionPct: Number.isFinite(Number(evt.payload?.irpfRetentionPct))
      ? Number(Number(evt.payload?.irpfRetentionPct).toFixed(2))
      : null,
    dueDate: toIso(evt.payload?.dueDate),
    payload: evt.payload || null,
  };
}

function getMargin(order: OrderLike) {
  const evt = latestEvent(order.events || [], "finance.margin.snapshot");
  if (!evt) {
    return {
      marginCents: null as number | null,
      marginPct: null as number | null,
      supplierCostCents: null as number | null,
      otherCostCents: null as number | null,
      gatewayFeeCents: null as number | null,
      payload: null as any,
    };
  }

  const revenueCents = cents(evt.payload?.revenueCents, order.amountCents);
  const supplierCostCents = cents(evt.payload?.supplierCostCents, 0);
  const gatewayFeeCents = cents(evt.payload?.gatewayFeeCents, 0);
  const otherCostCents = cents(evt.payload?.otherCostCents, 0);
  const marginCents = revenueCents - supplierCostCents - gatewayFeeCents - otherCostCents;
  const marginPct = revenueCents > 0 ? Number(((marginCents / revenueCents) * 100).toFixed(2)) : null;

  return {
    marginCents,
    marginPct,
    supplierCostCents,
    otherCostCents,
    gatewayFeeCents,
    payload: evt.payload || null,
  };
}

function getMarginApprovalStatus(order: OrderLike, requiresMarginApproval: boolean): MarginApprovalStatus {
  if (!requiresMarginApproval) return "NOT_REQUIRED";
  const evt = latestEvent(order.events || [], "finance.margin.approval.updated");
  if (!evt) return "PENDING";
  const status = String(evt.payload?.status || "").toUpperCase();
  if (status === "APPROVED") return "APPROVED";
  if (status === "REJECTED") return "REJECTED";
  return "PENDING";
}

function hasFinanceCloseEvent(order: OrderLike) {
  return Boolean(latestEvent(order.events || [], "finance.closed"));
}

export function getFinanceSnapshot(order: OrderLike): FinanceSnapshot {
  const reconciliation = getReconciliationStatus(order);
  const supplierInvoice = getSupplierInvoiceStatus(order);
  const margin = getMargin(order);

  const requiresMarginApproval = margin.marginPct !== null && margin.marginPct < MARGIN_APPROVAL_THRESHOLD_PCT;
  const marginApprovalStatus = getMarginApprovalStatus(order, requiresMarginApproval);
  const financeClosed = hasFinanceCloseEvent(order);

  const orderCreatedAt = toDate(order.createdAt) || new Date();
  const accountingCutoff = getNextAccountingCutoff(orderCreatedAt);
  const accountingCutoffPassed = Date.now() > accountingCutoff.getTime();

  const warnings: string[] = [];
  if (order.paymentStatus !== "PAID") warnings.push("Pago no confirmado");
  if (!["MATCHED", "RECONCILED"].includes(reconciliation.status)) {
    warnings.push("Conciliacion pendiente o con descuadre");
  }

  const supplierBooked = ["BOOKED", "PAID"].includes(supplierInvoice.status);
  const isMonthlyBatch = supplierInvoice.billingMode === "MONTHLY_BATCH";
  const supplierInvoiceBlocksClose = isMonthlyBatch ? accountingCutoffPassed && !supplierBooked : !supplierBooked;
  if (supplierInvoiceBlocksClose) {
    warnings.push(
      isMonthlyBatch
        ? "Factura proveedor de lote mensual pendiente tras cierre (dia 25)."
        : "Factura proveedor pendiente de validar"
    );
  }

  if (margin.marginCents !== null && margin.marginCents < 0) warnings.push("Margen negativo");
  if (requiresMarginApproval && marginApprovalStatus !== "APPROVED") {
    warnings.push(`Margen por debajo del ${MARGIN_APPROVAL_THRESHOLD_PCT}% (requiere aprobacion).`);
  }
  if (order.paymentStatus === "PAID" && !financeClosed && accountingCutoffPassed) {
    warnings.push("Pendiente cierre contable del periodo (corte dia 25).");
  }

  const isFinanciallyCloseable =
    order.paymentStatus === "PAID" &&
    reconciliation.status === "RECONCILED" &&
    !supplierInvoiceBlocksClose &&
    (margin.marginCents === null || margin.marginCents >= 0) &&
    (!requiresMarginApproval || marginApprovalStatus === "APPROVED");

  return {
    reconciliationStatus: reconciliation.status,
    reconciliationDiffCents: reconciliation.diffCents,
    reconciliationToleranceCents: reconciliation.toleranceCents,
    reconciliationExpectedAmountCents: reconciliation.expectedAmountCents,
    reconciliationReceivedAmountCents: reconciliation.receivedAmountCents,
    reconciliationGatewayFeeCents: reconciliation.gatewayFeeCents,
    reconciledAt: reconciliation.reconciledAt,
    supplierInvoiceStatus: supplierInvoice.status,
    supplierInvoiceBillingMode: supplierInvoice.billingMode,
    supplierType: supplierInvoice.supplierType,
    supplierName: supplierInvoice.supplierName,
    supplierInvoiceNumber: supplierInvoice.invoiceNumber,
    supplierInvoiceTotalCents: supplierInvoice.totalCents,
    supplierIrpfRetentionPct: supplierInvoice.irpfRetentionPct,
    supplierInvoiceDueDate: supplierInvoice.dueDate,
    marginCents: margin.marginCents,
    marginPct: margin.marginPct,
    marginSupplierCostCents: margin.supplierCostCents,
    marginOtherCostCents: margin.otherCostCents,
    marginGatewayFeeCents: margin.gatewayFeeCents,
    marginThresholdPct: MARGIN_APPROVAL_THRESHOLD_PCT,
    requiresMarginApproval,
    marginApprovalStatus,
    hasFinanceCloseEvent: financeClosed,
    accountingCutoffDate: accountingCutoff.toISOString(),
    accountingCutoffPassed,
    isFinanciallyCloseable,
    warnings,
  };
}
