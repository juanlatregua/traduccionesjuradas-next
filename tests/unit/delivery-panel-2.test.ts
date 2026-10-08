import test from "node:test";
import assert from "node:assert/strict";
import { documentKey, splitDocumentVersions } from "../../lib/delivery-files.ts";
import { buildDeliveryText, greetingName, isEmailAlias } from "../../lib/delivery-message.ts";
import { invoiceStatusOf, needsNif, resolveBillingPrefill } from "../../lib/delivery-billing.ts";

const BASE = "https://abc.public.blob.vercel-storage.com/orders/26_0E3047/";
const withPrefix = `${BASE}1791380856919-1791369870139-tradjur_Reyes-signed-Kx9QmZpL3vTn8RcYw2HbJd.pdf`;
const plain = `${BASE}tradjur_Reyes-signed.pdf`;

test("mismo documento con prefijo de timestamp y sufijo de Blob: misma clave", () => {
  assert.equal(documentKey(withPrefix), "tradjur_reyes-signed");
  assert.equal(documentKey(plain), "tradjur_reyes-signed");
  assert.notEqual(documentKey(`${BASE}otro-documento.pdf`), documentKey(plain));
});

test("solo la versión principal se preselecciona; la otra pasa a anteriores", () => {
  const files = [{ url: plain }, { url: withPrefix }];
  const byPrimary = splitDocumentVersions(files, withPrefix);
  assert.deepEqual(byPrimary.current.map((f) => f.url), [withPrefix]);
  assert.deepEqual(byPrimary.previous.map((f) => f.url), [plain]);
  const byLast = splitDocumentVersions(files, null);
  assert.deepEqual(byLast.current.map((f) => f.url), [withPrefix]);
  const other = { url: `${BASE}anexo.pdf` };
  assert.equal(splitDocumentVersions([...files, other], withPrefix).current.length, 2);
});

test("saludo limpio: dos puntos, sin dobles espacios y sin alias de email", () => {
  const t = buildDeliveryText({ lang: "es", name: "  Alejandro ", reference: "R1", reviewUrl: "u" });
  assert.match(t, /^Buenos días, Alejandro:\n\n/);
  assert.equal(greetingName("Ana   María,", "x@y.es"), "Ana María");
  assert.equal(greetingName("alejandrosilvera7", "alejandrosilvera7@gmail.com"), "");
  assert.match(buildDeliveryText({ lang: "es", name: "", reference: "R1", reviewUrl: "u" }), /^Buenos días:\n/);
});

test("con factura emitida el mensaje lleva su número", () => {
  const status = invoiceStatusOf({
    billingExcluded: false,
    hasMonthlyInvoice: false,
    invoice: { number: "26_096", status: "ISSUED", docKind: "invoice" },
    nif: "",
    amountCents: 9000,
  });
  assert.deepEqual(status, { kind: "issued", number: "26_096" });
  const t = buildDeliveryText({ lang: "es", name: "Alejandro", reference: "R1", invoiceNumber: "26_096", reviewUrl: "u" });
  assert.match(t, /y la factura 26_096 del pedido R1/);
  assert.doesNotMatch(t, /emitir/);
});

test("alias de email no se escribe como nombre fiscal", () => {
  assert.equal(isEmailAlias("alejandrosilvera7", "AlejandroSilvera7@gmail.com"), true);
  assert.equal(isEmailAlias("Alejandro Silvera", "alejandrosilvera7@gmail.com"), false);
  const p = resolveBillingPrefill({ billing: null, customer: null, clientName: "alejandrosilvera7", clientEmail: "alejandrosilvera7@gmail.com" });
  assert.equal(p.fiscalName, "");
  const fromCustomer = resolveBillingPrefill({
    billing: { fiscalName: "alejandrosilvera7" },
    customer: { fiscalName: "Alejandro Silvera" },
    clientName: "alejandrosilvera7",
    clientEmail: "alejandrosilvera7@gmail.com",
  });
  assert.equal(fromCustomer.fiscalName, "Alejandro Silvera");
});

test("más de 400 € sin NIF exige NIF", () => {
  assert.equal(needsNif("", 40001), true);
  assert.equal(needsNif("  ", 90000), true);
  assert.equal(needsNif("", 40000), false);
  assert.equal(needsNif("B12345678", 90000), false);
});
