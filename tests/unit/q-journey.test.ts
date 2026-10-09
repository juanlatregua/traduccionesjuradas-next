import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
// @ts-ignore — registerHooks is a newer Node API not yet in @types/node
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import {
  BILLING_RATE,
  billingLocked,
  blobHostFromToken,
  completionBlockReason,
  completionQuota,
  COMPLETION_MAX_BYTES,
  COMPLETION_MAX_FILES,
  COMPLETION_RATE,
  billingFromAnalyses,
  completionBlobPrefix,
  isPendingCompletion,
  parseCompletionFiles,
  payPhase,
  pickBillingPrefill,
  validateBilling,
  validateCompletionFiles,
} from "../../lib/q-journey.ts";
import { isSimplifiedInvoice, needsNif } from "../../lib/delivery-billing.ts";

registerHooks({
  resolve(specifier: string, context: unknown, nextResolve: Function) {
    if (specifier === "@/lib/prisma") {
      return nextResolve(pathToFileURL(path.resolve(process.cwd(), "lib/prisma.ts")).href, context);
    }
    return nextResolve(specifier, context);
  },
});

const QID = "11111111-2222-3333-4444-555555555555";
const blobUrl = (name: string, id = QID) =>
  `https://abc123.public.blob.vercel-storage.com/${completionBlobPrefix(id)}1700000000-${name}`;

/* ------------------------------ subida: validación ------------------------------ */

test("subida: ninguno, demasiados, tipo y tamaño", () => {
  assert.deepEqual(validateCompletionFiles([]), { ok: false, code: "none" });
  const many = Array.from({ length: COMPLETION_MAX_FILES + 1 }, (_, i) => ({ name: `a${i}.pdf`, size: 10 }));
  assert.deepEqual(validateCompletionFiles(many), { ok: false, code: "count" });
  assert.deepEqual(validateCompletionFiles([{ name: "virus.exe", size: 10 }]), { ok: false, code: "type" });
  assert.deepEqual(validateCompletionFiles([{ name: "doc.docx", size: 10 }]), { ok: false, code: "type" });
  assert.deepEqual(validateCompletionFiles([{ name: "grande.pdf", size: COMPLETION_MAX_BYTES + 1 }]), { ok: false, code: "size" });
  assert.deepEqual(validateCompletionFiles([{ name: "vacio.pdf", size: 0 }]), { ok: false, code: "size" });
  assert.deepEqual(
    validateCompletionFiles([
      { name: "a.PDF", size: 1000 },
      { name: "b.jpeg", size: COMPLETION_MAX_BYTES },
      { name: "c.heic", size: 5 },
    ]),
    { ok: true }
  );
});

test("endpoint: solo URLs de Blob bajo la carpeta de ESTE presupuesto", () => {
  const ok = parseCompletionFiles([{ url: blobUrl("dni.pdf"), name: "dni.pdf", size: 1234 }], QID);
  assert.equal(ok.ok, true);
  // carpeta de otro presupuesto
  assert.deepEqual(parseCompletionFiles([{ url: blobUrl("dni.pdf", "otro"), name: "x.pdf", size: 5 }], QID), { ok: false, code: "url" });
  // host ajeno
  assert.deepEqual(parseCompletionFiles([{ url: `https://evil.example/${completionBlobPrefix(QID)}x.pdf`, name: "x.pdf", size: 5 }], QID), { ok: false, code: "url" });
  // http plano
  assert.deepEqual(
    parseCompletionFiles([{ url: blobUrl("x.pdf").replace("https", "http"), name: "x.pdf", size: 5 }], QID),
    { ok: false, code: "url" }
  );
  // la extensión se valida sobre la URL guardada, no sobre el nombre declarado
  assert.deepEqual(parseCompletionFiles([{ url: blobUrl("x.exe"), name: "x.pdf", size: 5 }], QID), { ok: false, code: "type" });
  assert.deepEqual(parseCompletionFiles([{ url: blobUrl("x.pdf"), name: "x.pdf", size: COMPLETION_MAX_BYTES + 1 }], QID), { ok: false, code: "size" });
  assert.deepEqual(parseCompletionFiles("nada", QID), { ok: false, code: "none" });
  assert.deepEqual(parseCompletionFiles([], QID), { ok: false, code: "none" });
});

test("rate limit del envío: el sexto intento seguido se frena; el límite es por enlace e IP", async () => {
  const prev = process.env.RATE_LIMIT_STORE;
  process.env.RATE_LIMIT_STORE = "memory";
  try {
    const { checkRateLimit } = await import("../../lib/rate-limit.ts");
    const key = `quote-complete:tok-${Math.random().toString(16).slice(2)}:1.2.3.4`;
    for (let i = 0; i < COMPLETION_RATE.limit; i++) {
      assert.equal((await checkRateLimit({ key, ...COMPLETION_RATE })).ok, true);
    }
    const blocked = await checkRateLimit({ key, ...COMPLETION_RATE });
    assert.equal(blocked.ok, false);
    // otra IP no comparte cupo
    assert.equal((await checkRateLimit({ key: key.replace("1.2.3.4", "5.6.7.8"), ...COMPLETION_RATE })).ok, true);
    assert.ok(COMPLETION_RATE.limit <= 10 && BILLING_RATE.limit > 0);
  } finally {
    process.env.RATE_LIMIT_STORE = prev;
  }
});

test("pendiente de completar: hasta que se reenvía el presupuesto", () => {
  const sent = new Date("2026-10-01T10:00:00Z");
  const after = new Date("2026-10-02T10:00:00Z");
  assert.equal(isPendingCompletion([], sent), false);
  assert.equal(isPendingCompletion([after], sent), true);
  assert.equal(isPendingCompletion([new Date("2026-09-30T00:00:00Z")], sent), false);
  assert.equal(isPendingCompletion([after], null), true);
});

/* ------------------------------ facturación ------------------------------ */

test("simplificada sin NIF y ≤400 €; >400 € pide NIF", () => {
  assert.equal(isSimplifiedInvoice("", 40000), true);
  assert.equal(needsNif("", 40001), true);
  assert.deepEqual(validateBilling({ fiscalName: "Ana" }, 40000).ok, true);
  assert.deepEqual(validateBilling({ fiscalName: "Ana", nif: "  " }, 40001), { ok: false, code: "nif_required" });
  assert.deepEqual(validateBilling({ fiscalName: "" }, 100), { ok: false, code: "name" });
  // con NIF la factura es completa: dirección, CP y ciudad
  assert.deepEqual(validateBilling({ fiscalName: "Ana", nif: "12345678z" }, 100), { ok: false, code: "address" });
  const full = validateBilling(
    { fiscalName: " Ana ", nif: "12345678z", address: "Calle 1", city: "Málaga", postalCode: "29001" },
    90000
  );
  assert.equal(full.ok, true);
  if (full.ok) {
    assert.equal(full.value.nif, "12345678Z");
    assert.equal(full.value.fiscalName, "Ana");
    assert.equal(full.value.country, "España");
  }
});

test("prefill: guardado > BillingData > Customer > documento > vacío", () => {
  const billing = { fiscalName: "Ana SL", nif: "B1", address: "Calle 1", city: "Málaga", postalCode: "29001", country: "España", email: "a@x.es" };
  const customer = { fiscalName: "Cliente SA", nif: "A2", city: "Sevilla" };
  const analyses = [{ extracted_data: { names: ["JUAN PÉREZ"], addresses: ["Calle Mayor 3, 29001 Málaga"] } }];

  const saved = pickBillingPrefill({ saved: { fiscalName: "Guardado", nif: "" }, orderBilling: billing, customer, clientEmail: "a@x.es", analyses });
  assert.equal(saved.source, "saved");
  assert.equal(saved.fields.fiscalName, "Guardado");

  assert.equal(pickBillingPrefill({ orderBilling: billing, customer, clientEmail: "a@x.es", analyses }).source, "billing");

  const fromCustomer = pickBillingPrefill({ customer, clientEmail: "a@x.es", analyses });
  assert.equal(fromCustomer.source, "customer");
  assert.equal(fromCustomer.fields.nif, "A2");

  const fromDoc = pickBillingPrefill({ clientEmail: "a@x.es", analyses });
  assert.equal(fromDoc.source, "document");
  // el nombre leído NO rellena el campo: va aparte, como sugerencia
  assert.equal(fromDoc.fields.fiscalName, "");
  assert.equal(fromDoc.fields.address, "");
  assert.equal(fromDoc.suggestion?.fiscalName, "JUAN PÉREZ");
  assert.deepEqual([fromDoc.suggestion?.address, fromDoc.suggestion?.postalCode, fromDoc.suggestion?.city], ["Calle Mayor 3", "29001", "Málaga"]);

  const empty = pickBillingPrefill({ clientEmail: "a@x.es" });
  assert.equal(empty.source, "empty");
  assert.equal(empty.fields.fiscalName, "");
  assert.equal(empty.fields.country, "España");
});

test("prefill: el Customer de un email @whatsapp.local nunca se usa", () => {
  const customer = { fiscalName: "Otro Cliente", nif: "A2" };
  const r = pickBillingPrefill({ customer, clientEmail: "34600111222@whatsapp.local", analyses: [{ extracted_data: { names: ["María"] } }] });
  assert.equal(r.source, "document");
  assert.equal(r.fields.fiscalName, "");
  assert.equal(r.suggestion?.fiscalName, "María");
  assert.equal(pickBillingPrefill({ customer, clientEmail: "34600111222@whatsapp.local" }).source, "empty");
});

test("lectura de documentos: nombres siempre; direcciones solo si existen", () => {
  assert.equal(billingFromAnalyses([]), null);
  assert.equal(billingFromAnalyses([{ extracted_data: { names: [], dates: [] } }]), null);
  assert.deepEqual(billingFromAnalyses([{ extracted_data: { names: ["", "Luis"] } }]), { fiscalName: "Luis" });
  const obj = billingFromAnalyses([{ extracted_data: { names: ["Eva"], addresses: [{ street: "Rue 5", postalCode: "75001", city: "Paris", country: "Francia" }] } }]);
  assert.deepEqual(obj, { fiscalName: "Eva", address: "Rue 5", postalCode: "75001", city: "Paris", country: "Francia" });
  assert.equal(billingFromAnalyses([null, "x", {}]), null);
});

/* ------------------------------ candados y topes ------------------------------ */

test("billing: bloqueado solo con pago, factura emitida viva o pedido que ya tiene BillingData", () => {
  const base = { paidAt: null, orderPaidAt: null, orderHasBilling: false, invoiceIssued: false };
  assert.equal(billingLocked(base), false);
  // pedido sin pagar y sin BillingData («Ya he transferido», crédito): acepta los datos
  assert.equal(billingLocked({ ...base }), false);
  assert.equal(billingLocked({ ...base, paidAt: new Date() }), true);
  assert.equal(billingLocked({ ...base, orderPaidAt: new Date() }), true);
  assert.equal(billingLocked({ ...base, orderHasBilling: true }), true);
  assert.equal(billingLocked({ ...base, invoiceIssued: true }), true);
});

test("host de Blob: el de NUESTRA tienda, deducido del token", () => {
  assert.equal(blobHostFromToken("vercel_blob_rw_AbC123xyz_secretoSECRETO"), "abc123xyz.public.blob.vercel-storage.com");
  assert.equal(blobHostFromToken(""), null);
  assert.equal(blobHostFromToken("otra_cosa"), null);
  const host = "abc123xyz.public.blob.vercel-storage.com";
  const own = `https://${host}/${completionBlobPrefix(QID)}1-a.pdf`;
  const other = `https://zzz999.public.blob.vercel-storage.com/${completionBlobPrefix(QID)}1-a.pdf`;
  assert.equal(parseCompletionFiles([{ url: own, name: "a.pdf", size: 5 }], QID, host).ok, true);
  assert.deepEqual(parseCompletionFiles([{ url: other, name: "a.pdf", size: 5 }], QID, host), { ok: false, code: "url" });
});

test("presupuesto que no admite documentos: borrado, caducado, no pagable o pagado", () => {
  const future = new Date(Date.now() + 86400000);
  const past = new Date(Date.now() - 86400000);
  const ok = { validUntil: future, status: "SENT" };
  assert.equal(completionBlockReason(ok), null);
  assert.equal(completionBlockReason({ ...ok, status: "ACCEPTED" }), null);
  assert.equal(completionBlockReason({ ...ok, deletedAt: new Date() }), "deleted");
  assert.equal(completionBlockReason({ ...ok, validUntil: past }), "expired");
  assert.equal(completionBlockReason({ ...ok, status: "EXPIRED" }), "status");
  assert.equal(completionBlockReason({ ...ok, status: "CANCELLED" }), "status");
  assert.equal(completionBlockReason({ ...ok, status: "DRAFT" }), "status");
  assert.equal(completionBlockReason({ ...ok, paidAt: new Date() }), "paid");
  assert.equal(completionBlockReason({ ...ok, status: "PAID" }), "paid");
});

test("tope por presupuesto: 3 envíos al día y 10 archivos en total", () => {
  const now = new Date("2026-10-08T12:00:00Z");
  const h = (hoursAgo: number, fileCount = 1) => ({ at: new Date(now.getTime() - hoursAgo * 3600000), fileCount });
  assert.equal(completionQuota([], 10, now), null);
  assert.equal(completionQuota([], 11, now), "total");
  assert.equal(completionQuota([h(1), h(2)], 1, now), null);
  assert.equal(completionQuota([h(1), h(2), h(3)], 1, now), "daily");
  // los de hace más de 24 h no cuentan para el día, sí para el total
  assert.equal(completionQuota([h(30), h(40), h(50)], 1, now), null);
  assert.equal(completionQuota([h(30, 5), h(40, 5)], 1, now), "total");
});

test("payPhase: ?paid=1 sin paidAt es confirming, nunca paid", () => {
  const d = new Date();
  assert.equal(payPhase({ paidAt: null, paidParam: true, balance: 0, balancePaidAt: null }), "confirming");
  assert.equal(payPhase({ paidAt: null, paidParam: false, balance: 0, balancePaidAt: null }), "open");
  assert.equal(payPhase({ paidAt: d, paidParam: false, balance: 0, balancePaidAt: null }), "paid");
});

test("payPhase: dos plazos con el segundo pendiente es partial", () => {
  const d = new Date();
  assert.equal(payPhase({ paidAt: d, paidParam: true, balance: 60, balancePaidAt: null }), "partial");
  assert.equal(payPhase({ paidAt: d, paidParam: true, balance: 60, balancePaidAt: d }), "paid");
});
