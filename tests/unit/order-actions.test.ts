import test from "node:test";
import assert from "node:assert/strict";
import type { FinanceSnapshot } from "../../lib/finance.ts";
import {
  buildOrderTrackedLinks,
  getNextBestAction,
  getOrderActionStage,
  getOrderGates,
} from "../../lib/order-actions.ts";

function financeSnapshot(overrides: Partial<FinanceSnapshot> = {}): FinanceSnapshot {
  return {
    reconciliationStatus: "PENDING",
    reconciliationDiffCents: null,
    reconciliationToleranceCents: 300,
    reconciliationExpectedAmountCents: null,
    reconciliationReceivedAmountCents: null,
    reconciliationGatewayFeeCents: null,
    reconciledAt: null,
    supplierInvoiceStatus: "PENDING_REQUEST",
    supplierInvoiceBillingMode: "PER_ORDER",
    supplierType: "UNKNOWN",
    supplierName: null,
    supplierInvoiceNumber: null,
    supplierInvoiceTotalCents: null,
    supplierIrpfRetentionPct: null,
    supplierInvoiceDueDate: null,
    marginCents: null,
    marginPct: null,
    marginSupplierCostCents: null,
    marginOtherCostCents: null,
    marginGatewayFeeCents: null,
    marginThresholdPct: 10,
    requiresMarginApproval: false,
    marginApprovalStatus: "NOT_REQUIRED",
    hasFinanceCloseEvent: false,
    accountingCutoffDate: new Date().toISOString(),
    accountingCutoffPassed: false,
    isFinanciallyCloseable: false,
    warnings: [],
    ...overrides,
  };
}

test("buildOrderTrackedLinks añade src=wa y referencia", () => {
  const links = buildOrderTrackedLinks("26_TEST01");
  assert.match(links.paymentUrl, /src=wa/);
  assert.match(links.paymentUrl, /ref=26_TEST01/);
  assert.match(links.statusUrl, /src=wa/);
  assert.match(links.statusUrl, /ref=26_TEST01/);
});

test("closeReady queda bloqueado sin notificación de entrega al cliente", () => {
  const order = {
    reference: "26_TEST02",
    workflowState: "TRADUCIDO_ENTREGADO",
    paymentStatus: "PAID",
    assignedTo: "Juan Silva",
    deliveryState: "TRADUCIDO",
    quoteSnapshotJson: {
      lines: [{ documentName: "Certificado", amountCents: 5000 }],
      totalCents: 5000,
    },
    quotePreviewFileKey: "quotes/26_TEST02.pdf",
    finalDeliveryFileKey: "orders/26_TEST02/final.pdf",
    events: [],
  };

  const finance = financeSnapshot({
    reconciliationStatus: "RECONCILED",
    supplierInvoiceStatus: "BOOKED",
    marginCents: 1200,
    marginPct: 24,
  });

  const gates = getOrderGates(order, finance);
  assert.equal(gates.quoteReady, true);
  assert.equal(gates.paymentValidated, true);
  assert.equal(gates.productionReady, true);
  assert.equal(gates.deliveryReady, true);
  assert.equal(gates.deliveredReady, false);
  assert.equal(gates.closeReady, false);
});

test("quoteReady exige snapshot + preview; snapshot solo no basta", () => {
  const order = {
    reference: "26_TEST02B",
    workflowState: "PENDIENTE_REVISION",
    paymentStatus: "PENDING",
    quoteSnapshotJson: {
      lines: [{ documentName: "Documento sin preview", amountCents: 2000 }],
      totalCents: 2000,
    },
    events: [{ type: "quote.documents.updated" }],
  };

  const gates = getOrderGates(order, financeSnapshot());
  assert.equal(gates.quoteReady, false);
});

test("closeReady pasa cuando finanzas y notificación están completas", () => {
  const order = {
    reference: "26_TEST03",
    workflowState: "TRADUCIDO_ENTREGADO",
    paymentStatus: "PAID",
    assignedTo: "Juan Silva",
    deliveryState: "TRADUCIDO",
    quoteSnapshotJson: {
      lines: [{ documentName: "Certificado", amountCents: 5000 }],
      totalCents: 5000,
    },
    quotePreviewFileKey: "quotes/26_TEST03.pdf",
    finalDeliveryFileKey: "orders/26_TEST03/final.pdf",
    events: [
      {
        type: "notification.delivery_ready.sent",
        payload: { toEmail: "cliente@example.com" },
      },
    ],
  };

  const finance = financeSnapshot({
    reconciliationStatus: "RECONCILED",
    supplierInvoiceStatus: "BOOKED",
    marginCents: 1200,
    marginPct: 24,
  });

  const stage = getOrderActionStage(order, finance);
  const gates = getOrderGates(order, finance);
  const action = getNextBestAction(order, finance);

  assert.equal(stage, "DELIVERED");
  assert.equal(gates.closeReady, true);
  assert.equal(action.tab, "control");
});

test("tras pago validado sin asignación, la acción recomendada es asignar traductor", () => {
  const order = {
    reference: "26_TEST04",
    workflowState: "PAGO_VALIDADO",
    paymentStatus: "PAID",
    assignedTo: null,
    deliveryState: "PRESUPUESTO",
    quoteSnapshotJson: {
      lines: [{ documentName: "Titulo universitario", amountCents: 7500 }],
      totalCents: 7500,
    },
    quotePreviewFileKey: "quotes/26_TEST04.pdf",
    events: [{ type: "payment.proof_uploaded" }],
  };

  const finance = financeSnapshot();
  const action = getNextBestAction(order, finance);

  assert.equal(action.tab, "asignar");
  assert.equal(action.label, "Asignar traductor");
});
