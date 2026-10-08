import test from "node:test";
import assert from "node:assert/strict";
import {
  decideInvoiceAction,
  isRecentlyIssued,
  recipientLockReasonOf,
  invoiceStatusLabel,
  invoiceStatusOf,
  invoiceWasSent,
  isSimplifiedInvoice,
  recipientDiffers,
  resolveBillingPrefill,
} from "../../lib/delivery-billing.ts";
import { buildDeliveryText, buildDeliveryWhatsappText, resolveInvoicePlaceholder } from "../../lib/delivery-message.ts";

test("simplificada solo sin NIF y hasta 400 €", () => {
  assert.equal(isSimplifiedInvoice("", 12100), true);
  assert.equal(isSimplifiedInvoice("  ", 40000), true);
  assert.equal(isSimplifiedInvoice("", 40001), false);
  assert.equal(isSimplifiedInvoice("B12345678", 5000), false);
});

test("prefill: BillingData > Customer > nombre del pedido", () => {
  const billing = { fiscalName: "Ana SL", nif: "B1", address: "Calle 1", city: "Málaga", postalCode: "29001", country: "España", email: "f@x.es" };
  const customer = { fiscalName: "", companyName: "Cliente SA", nif: "A2", city: "Sevilla" };
  assert.equal(resolveBillingPrefill({ billing, customer, clientName: "Nombre", clientEmail: "c@x.es" }).fiscalName, "Ana SL");
  const fromCustomer = resolveBillingPrefill({ billing: null, customer, clientName: "Nombre", clientEmail: "c@x.es" });
  assert.equal(fromCustomer.fiscalName, "Cliente SA");
  assert.equal(fromCustomer.nif, "A2");
  assert.equal(fromCustomer.email, "c@x.es");
  const fromName = resolveBillingPrefill({ billing: null, customer: null, clientName: " Nombre ", clientEmail: "c@x.es" });
  assert.equal(fromName.fiscalName, "Nombre");
  assert.equal(fromName.nif, "");
  assert.equal(fromName.country, "España");
});

test("estado de la factura", () => {
  const base = { billingExcluded: false, hasMonthlyInvoice: false, nif: "", amountCents: 9000 };
  assert.equal(invoiceStatusLabel(invoiceStatusOf({ ...base })), "Se emitirá al enviar (simplificada)");
  assert.equal(invoiceStatusLabel(invoiceStatusOf({ ...base, nif: "B1" })), "Se emitirá al enviar (completa)");
  assert.equal(
    invoiceStatusLabel(invoiceStatusOf({ ...base, invoice: { number: "26_025", status: "ISSUED", docKind: "invoice" } })),
    "Factura 26_025 emitida: se adjunta"
  );
  assert.match(invoiceStatusLabel(invoiceStatusOf({ ...base, billingExcluded: true, billingExcludedReason: "cortesía" })), /Excluido de facturación \(cortesía\)/);
  assert.match(invoiceStatusLabel(invoiceStatusOf({ ...base, hasMonthlyInvoice: true })), /agrupada del mes/);
});

test("destinatario distinto y factura ya enviada", () => {
  const b = { fiscalName: "Ana SL", nif: "B1", address: "Calle 1", city: "Málaga", postalCode: "29001", country: "España", email: "" };
  assert.equal(recipientDiffers({ ...b, fiscalName: " ana  sl " }, b), false);
  assert.equal(recipientDiffers({ ...b, nif: "B2" }, b), true);
  const issued = new Date("2026-10-01T10:00:00Z");
  assert.equal(invoiceWasSent([], issued), false);
  assert.equal(invoiceWasSent([{ type: "notification.delivery_ready.sent", createdAt: new Date("2026-09-30T10:00:00Z") }], issued), false);
  assert.equal(invoiceWasSent([{ type: "notification.delivery_ready.sent", createdAt: new Date("2026-10-02T10:00:00Z") }], issued), true);
});

test("el texto de entrega nombra la factura solo si existe", () => {
  const base = { lang: "es" as const, name: "Marta", reference: "2026-00123", reviewUrl: "https://g.page/r/x" };
  const withInv = buildDeliveryText({ ...base, invoiceNumber: "26_025" });
  const without = buildDeliveryText(base);
  assert.match(withInv, /traducción jurada y la factura 26_025 del pedido 2026-00123/);
  assert.doesNotMatch(without, /factura/);
  assert.match(without, /^Buenos días, Marta:/);
  assert.match(without, /valoración en Google: https:\/\/g\.page\/r\/x/);
  assert.match(without, /Juan Silva — TraduccionesJuradas\.net$/);
  const corr = buildDeliveryText({ ...base, invoiceNumber: "26_025", correction: true });
  assert.match(corr, /traducción corregida del pedido 2026-00123/);
  assert.doesNotMatch(corr, /factura/);
  assert.match(buildDeliveryText({ ...base, lang: "fr", invoiceNumber: "26_025" }), /et la facture 26_025/);
});

test("texto de WhatsApp corto con enlace y reseña", () => {
  const t = buildDeliveryWhatsappText({
    name: "Marta",
    reference: "2026-00123",
    files: [{ name: "t.pdf", url: "https://b/t.pdf" }],
    reviewUrl: "https://g.page/r/x",
  });
  assert.match(t, /Aquí tiene la traducción jurada del pedido 2026-00123: https:\/\/b\/t\.pdf/);
  assert.match(t, /https:\/\/g\.page\/r\/x/);
  assert.equal(buildDeliveryWhatsappText({ reference: "x", files: [], reviewUrl: "u" }), "");
});

test("solo se emite si no hay ninguna factura", () => {
  const ok = { amountCents: 9000 };
  assert.equal(decideInvoiceAction({ ...ok }), "issue");
  assert.equal(decideInvoiceAction({ ...ok, existing: { status: "DRAFT", docKind: "invoice" } }), "draft");
  assert.equal(decideInvoiceAction({ ...ok, existing: { status: "ISSUED", docKind: "invoice" } }), "existing");
  assert.equal(decideInvoiceAction({ ...ok, existing: { status: "DRAFT", docKind: "quote" } }), "quote");
  assert.equal(decideInvoiceAction({ amountCents: 0 }), "zero");
  assert.equal(decideInvoiceAction({ ...ok, paymentMethod: "BIZUM" }), "bizum");
});

test("corrección de destinatario: bloqueos", () => {
  const now = new Date("2026-10-08T12:00:00Z");
  const base = { annulled: false, issuedAt: new Date("2026-10-07T12:00:00Z"), hasRectification: false, periodClosed: false, sentToClient: false, now };
  assert.equal(recipientLockReasonOf(base), null);
  assert.equal(recipientLockReasonOf({ ...base, recordSendStatus: "LOCAL" }), null);
  assert.match(recipientLockReasonOf({ ...base, annulled: true })!, /anulada/);
  assert.match(recipientLockReasonOf({ ...base, hasRectification: true })!, /rectificativa/);
  assert.match(recipientLockReasonOf({ ...base, periodClosed: true })!, /trimestre/);
  assert.match(recipientLockReasonOf({ ...base, recordSendStatus: "ACCEPTED" })!, /Hacienda/);
  assert.match(recipientLockReasonOf({ ...base, sentToClient: true })!, /enviar|envió/);
  assert.match(recipientLockReasonOf({ ...base, issuedAt: new Date("2026-10-01T12:00:00Z") })!, /72 h/);
  assert.equal(isRecentlyIssued(new Date("2026-10-06T13:00:00Z"), now), true);
});

test("cualquier notification.*.sent posterior cuenta como enviada", () => {
  const issued = new Date("2026-10-01T10:00:00Z");
  assert.equal(invoiceWasSent([{ type: "notification.inbox_reply.sent", createdAt: new Date("2026-10-02T10:00:00Z") }], issued), true);
  assert.equal(invoiceWasSent([{ type: "order.note", createdAt: new Date("2026-10-02T10:00:00Z") }], issued), false);
});

test("sin factura se quita la frase entera del mensaje", () => {
  const es = buildDeliveryText({ lang: "es", name: "Marta", reference: "R1", invoiceNumber: "(nº al emitir)", reviewUrl: "u" });
  assert.match(es, /y la factura \(nº al emitir\) del pedido/);
  const without = resolveInvoicePlaceholder(es, null);
  assert.match(without, /traducción jurada del pedido R1\./);
  assert.doesNotMatch(without, /factura|nº al emitir/);
  assert.match(resolveInvoicePlaceholder(es, "26_030"), /y la factura 26_030 del pedido/);
  const en = buildDeliveryText({ lang: "en", reference: "R1", invoiceNumber: "(nº al emitir)", reviewUrl: "u" });
  assert.doesNotMatch(resolveInvoicePlaceholder(en, null), /invoice|emitir/);
});

test("la etiqueta del panel anticipa lo que hará el servidor", () => {
  const base = { billingExcluded: false, hasMonthlyInvoice: false, nif: "", amountCents: 9000 };
  const label = (o: object) => invoiceStatusLabel(invoiceStatusOf({ ...base, ...o }));
  assert.match(label({ invoice: { number: null, status: "DRAFT", docKind: "invoice" } }), /borrador en Facturas: se envía sin factura/);
  assert.match(label({ amountCents: 0 }), /0 €: se envía sin factura/);
  assert.match(label({ paymentMethod: "BIZUM" }), /Pago Bizum: se envía sin factura/);
  const annulled = { number: "26_025", status: "ISSUED", docKind: "invoice", annulledAt: "2026-10-01" };
  assert.match(label({ invoice: annulled }), /anulada: se envía sin factura/);
  assert.equal(decideInvoiceAction({ amountCents: 9000, existing: annulled }), "annulled");
});
