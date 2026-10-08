import test from "node:test";
import assert from "node:assert/strict";
import { documentKey, splitDocumentVersions } from "../../lib/delivery-files.ts";
import {
  AI_REQUIRED_DATA_ERROR,
  buildDeliveryAiInstruction,
  buildDeliveryText,
  greetingName,
  isEmailAlias,
  missingRequiredData,
  requiredInvoiceNumber,
  translateInstruction,
} from "../../lib/delivery-message.ts";
import { invoiceStatusOf, needsNif, resolveBillingPrefill } from "../../lib/delivery-billing.ts";

const BASE = "https://abc.public.blob.vercel-storage.com/orders/26_0E3047/";
const withPrefix = `${BASE}1791380856919-1791369870139-tradjur_Reyes-signed-IznMGyiThu8Q528U9dbsyc6HhUS2iM.pdf`;
const plain = `${BASE}tradjur_Reyes-signed.pdf`;

test("mismo documento con prefijo de timestamp y sufijo de Blob: misma clave", () => {
  assert.equal(documentKey(withPrefix), "tradjur_reyes-signed");
  assert.equal(documentKey(plain), "tradjur_reyes-signed");
  assert.notEqual(documentKey(`${BASE}otro-documento.pdf`), documentKey(plain));
});

test("nombres reales que acaban en una palabra larga no se confunden", () => {
  const a = `${BASE}1791380856919-tradjur-antecedentespenalesmarruecos.pdf`;
  const b = `${BASE}1791380856919-tradjur-certificadodenacimiento.pdf`;
  assert.notEqual(documentKey(a), documentKey(b));
  assert.equal(documentKey(a), "tradjur-antecedentespenalesmarruecos");
  assert.equal(splitDocumentVersions([{ url: a }, { url: b }], b).current.length, 2);
});

test("26_0E3047: la copia anterior del principal queda plegada", () => {
  const files = [{ url: plain }, { url: withPrefix }];
  const r = splitDocumentVersions(files, withPrefix);
  assert.deepEqual(r.current.map((f) => f.url), [withPrefix]);
  assert.deepEqual(r.previous.map((f) => f.url), [plain]);
});

test("dos traduccion.pdf de lavori con distinto timestamp van los dos marcados", () => {
  const l1 = `${BASE.replace("orders/26_0E3047", "entregas-lavori")}1791300000000-traduccion.pdf`;
  const l2 = `${BASE.replace("orders/26_0E3047", "entregas-lavori")}1791380000000-traduccion.pdf`;
  assert.equal(splitDocumentVersions([{ url: l1 }, { url: l2 }], l2).current.length, 2);
  assert.equal(splitDocumentVersions([{ url: l1 }, { url: l2 }], null).current.length, 2);
  const o1 = `${BASE}1791300000000-traduccion.pdf`;
  const o2 = `${BASE}1791380000000-traduccion.pdf`;
  assert.equal(splitDocumentVersions([{ url: o1 }, { url: o2 }], null).current.length, 2);
});

test("un delivery.corrected que sustituye un archivo lo pliega", () => {
  const o1 = `${BASE}1791300000000-traduccion.pdf`;
  const o2 = `${BASE}1791380000000-traduccion.pdf`;
  const r = splitDocumentVersions([{ url: o1 }, { url: o2 }], null, [o1]);
  assert.deepEqual(r.previous.map((f) => f.url), [o1]);
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

test("la guarda de datos obligatorios de la IA", () => {
  const req = { reference: "2026-00123", invoiceNumber: "26_096", reviewUrl: "https://g.page/r/x" };
  const ok = buildDeliveryText({ lang: "es", name: "Ana", reference: req.reference, invoiceNumber: req.invoiceNumber, reviewUrl: req.reviewUrl });
  assert.deepEqual(missingRequiredData(ok, req), []);
  const fr = ok.replace("Buenos días", "Bonjour");
  assert.deepEqual(missingRequiredData(fr, req), []);
  assert.deepEqual(missingRequiredData(ok.replace("26_096", ""), req), ["número de factura"]);
  assert.deepEqual(missingRequiredData(ok.replace(req.reviewUrl, ""), req), ["enlace de reseña"]);
  assert.deepEqual(missingRequiredData(ok.replace("Juan Silva — TraduccionesJuradas.net", "Juan"), req), ["firma"]);
  assert.deepEqual(missingRequiredData(ok, { ...req, invoiceNumber: null }), []);
  assert.match(AI_REQUIRED_DATA_ERROR, /no se ha aplicado/);
  const instr = buildDeliveryAiInstruction(translateInstruction("Français"), req);
  assert.match(instr, /Traduce el mensaje a Français, mismo tono breve y cordial, usted\./);
  assert.match(instr, /2026-00123/);
  assert.match(instr, /26_096/);
  assert.match(instr, /g\.page\/r\/x/);
  assert.match(instr, /Juan Silva — TraduccionesJuradas\.net/);
});

test("corrección con factura 26_073: la guarda no exige número de factura", () => {
  assert.equal(requiredInvoiceNumber("26_073", true), null);
  assert.equal(requiredInvoiceNumber("(nº al emitir)", false), null);
  assert.equal(requiredInvoiceNumber("26_073", false), "26_073");
  const reviewUrl = "https://g.page/r/x";
  const text = buildDeliveryText({ lang: "es", name: "Ana", reference: "2026-00123", correction: true, reviewUrl });
  assert.deepEqual(
    missingRequiredData(text, { reference: "2026-00123", invoiceNumber: requiredInvoiceNumber("26_073", true), reviewUrl }),
    []
  );
  const instr = buildDeliveryAiInstruction("más breve", { reference: "2026-00123", invoiceNumber: null, reviewUrl });
  assert.match(instr, /No menciones ninguna factura/);
});
