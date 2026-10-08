import test from "node:test";
import assert from "node:assert/strict";
import { runInvoiceOnly } from "../../lib/delivery-invoice-only.ts";
import { pendingLavoriEntregas, splitReviewedFiles, unreviewedNotice, unsentLavoriUrls, reviewedFileUrls, translatorFileUrls, unreviewedForSend, unreviewedUrls } from "../../lib/delivery-files.ts";
import { INVOICE_NUMBER_PLACEHOLDER } from "../../lib/delivery-message.ts";

const input = { reference: "26_95DA0E", lang: "es" as const, clientName: "Marta", reviewUrl: "https://g.page/r/x" };

function fakeDeps(attachment: { name: string } | null) {
  const calls: string[] = [];
  const sent: { subject: string; text: string; attachment: unknown }[] = [];
  return {
    calls,
    sent,
    deps: {
      prepare: async () => {
        calls.push("prepare");
        return {};
      },
      attach: async () => {
        calls.push("attach");
        return attachment;
      },
      record: async () => {
        calls.push("record");
      },
      send: (e: { subject: string; text: string; attachment: unknown }) => {
        calls.push("send");
        sent.push(e);
      },
    },
  };
}

test("solo factura: emite/prepara, adjunta la factura y envía; sin transición ni SMS entre las dependencias", async () => {
  const { deps, calls, sent } = fakeDeps({ name: "26_097.pdf" });
  const r = await runInvoiceOnly(deps, input);
  assert.deepEqual(r, { ok: true, invoiceNumber: "26_097", warnings: [] });
  assert.deepEqual(calls, ["prepare", "attach", "record", "send"]);
  assert.equal(sent[0].subject, "Factura 26_097 — pedido 26_95DA0E");
  assert.match(sent[0].text, /^Buenos días, Marta:\n\nLe adjunto la factura 26_097 del pedido 26_95DA0E\./);
  assert.match(sent[0].text, /g\.page\/r\/x/);
  assert.match(sent[0].text, /Juan Silva — TraduccionesJuradas\.net$/);
  assert.equal((sent[0].attachment as { name: string }).name, "26_097.pdf");
});

test("solo factura: el hueco «(nº al emitir)» del mensaje y del asunto se sustituye por el número real", async () => {
  const { deps, sent } = fakeDeps({ name: "26_097.pdf" });
  await runInvoiceOnly(deps, {
    ...input,
    message: `Le adjunto la factura ${INVOICE_NUMBER_PLACEHOLDER} del pedido 26_95DA0E.`,
    subject: `Factura ${INVOICE_NUMBER_PLACEHOLDER} — pedido 26_95DA0E`,
  });
  assert.equal(sent[0].text, "Le adjunto la factura 26_097 del pedido 26_95DA0E.");
  assert.equal(sent[0].subject, "Factura 26_097 — pedido 26_95DA0E");
});

test("solo factura sin factura posible: no envía ni registra y lo explica", async () => {
  const { deps, calls } = fakeDeps(null);
  deps.prepare = async () => ({ warning: "Pedido pagado por Bizum: no se emite factura automática." });
  const r = await runInvoiceOnly(deps, input);
  assert.equal(r.ok, false);
  assert.match((r as { error: string }).error, /No hay factura que enviar\. Pedido pagado por Bizum/);
  assert.deepEqual(calls, ["attach"]);
});

test("archivos del traductor sin revisar se rechazan; revisados o de staff pasan", () => {
  const lav = "https://x/orders/26_1/entregas-lavori/1791300000000-traduccion.pdf";
  const own = "https://x/orders/26_1/propia.pdf";
  const events = [
    { type: "lavori.entrega_subida", payload: { attachmentUrl: "https://x/otra-lavori.pdf" }, createdAt: "2026-10-08T09:00:00Z" },
  ];
  const translator = translatorFileUrls(events, ["https://x/subida-traductor.pdf"]);
  const none = reviewedFileUrls(events);
  assert.deepEqual(unreviewedUrls([lav, own, "https://x/otra-lavori.pdf", "https://x/subida-traductor.pdf"], translator, none), [
    lav,
    "https://x/otra-lavori.pdf",
    "https://x/subida-traductor.pdf",
  ]);
  const reviewEvents = [
    { type: "delivery.file_reviewed", payload: { url: lav, reviewed: true }, createdAt: "2026-10-08T09:10:00Z" },
    { type: "delivery.file_reviewed", payload: { url: "https://x/otra-lavori.pdf", reviewed: true }, createdAt: "2026-10-08T09:11:00Z" },
    { type: "delivery.file_reviewed", payload: { url: "https://x/otra-lavori.pdf", reviewed: false }, createdAt: "2026-10-08T09:12:00Z" },
  ];
  const reviewed = reviewedFileUrls(reviewEvents);
  assert.deepEqual(unreviewedUrls([lav, own, "https://x/otra-lavori.pdf"], translator, reviewed), ["https://x/otra-lavori.pdf"]);
});

test("una entrega de lavori llega «Sin revisar», el POST la rechaza y la acepta revisada, y queda procesada", () => {
  const url = "https://x/orders/26_1/entregas-lavori/1791300000000-traduccion.pdf";
  const lavori = { type: "lavori.entrega_subida", payload: { attachmentUrl: url, nombre: "traduccion.pdf", contentType: "application/pdf" }, createdAt: "2026-10-08T09:00:00Z" };
  // llega pendiente (aún no está en deliveryFilesJson) y sin revisar
  const pending = pendingLavoriEntregas([lavori], []);
  assert.deepEqual(pending, [{ url, name: "traduccion.pdf", mimeType: "application/pdf" }]);
  assert.deepEqual(unreviewedForSend(pending.map((p) => p.url), [lavori]), [url]);
  // revisada: pasa
  const reviewed = { type: "delivery.file_reviewed", payload: { url, reviewed: true }, createdAt: "2026-10-08T09:05:00Z" };
  assert.deepEqual(unreviewedForSend([url], [lavori, reviewed]), []);
  // tras enviarla queda en deliveryFilesJson: procesada, ya no pendiente
  assert.deepEqual(pendingLavoriEntregas([lavori, reviewed], [{ url, filename: "traduccion.pdf" }]), []);
  // los archivos del staff nunca piden revisión
  assert.deepEqual(unreviewedForSend(["https://x/orders/26_1/propia.pdf"], [lavori]), []);
});

test("solo factura sin factura posible: el error no arrastra «se ha enviado sin factura»", async () => {
  const { deps } = fakeDeps(null);
  deps.prepare = async () => ({ warning: "Hay un borrador en Facturas: emítelo allí. Se ha enviado sin factura." });
  const r = await runInvoiceOnly(deps, input);
  assert.equal((r as { error: string }).error, "No hay factura que enviar. Hay un borrador en Facturas: emítelo allí.");
});

test("la subida del traductor por /entrega (translator.delivered) exige revisión", () => {
  const url = "https://x/translator-deliveries/26_1/1791300000000-traduccion-AbCdEfGhIjKlMnOpQrStUvWxYz0123.pdf";
  const delivered = { type: "translator.delivered", payload: { fileUrl: url, filename: "t.pdf" }, createdAt: "2026-10-08T09:00:00Z" };
  assert.deepEqual(unreviewedForSend([url], [delivered]), [url]);
  assert.deepEqual(unreviewedForSend([url], []), [url]); // también por la ruta, sin el evento
  const reviewed = { type: "delivery.file_reviewed", payload: { url, reviewed: true }, createdAt: "2026-10-08T09:05:00Z" };
  assert.deepEqual(unreviewedForSend([url], [delivered, reviewed]), []);
});

test("el reply de la bandeja y el mensaje libre no adjuntan lo no revisado", () => {
  const lav = { url: "https://x/orders/26_1/entregas-lavori/1791300000000-a.pdf", filename: "a.pdf" };
  const own = { url: "https://x/orders/26_1/propia.pdf", filename: "propia.pdf" };
  const ok = { url: "https://x/orders/26_1/entregas-lavori/1791300000001-b.pdf", filename: "b.pdf" };
  const events = [{ type: "delivery.file_reviewed", payload: { url: ok.url, reviewed: true }, createdAt: "2026-10-08T09:05:00Z" }];
  const r = splitReviewedFiles([lav, own, ok], events);
  assert.deepEqual(r.allowed.map((f) => f.filename), ["propia.pdf", "b.pdf"]);
  assert.deepEqual(r.blocked.map((f) => f.filename), ["a.pdf"]);
  assert.match(unreviewedNotice(r.blocked.length), /1 archivo\(s\) sin revisar no se han adjuntado: revísalos en Entregar al cliente/);
});

test("lavori: procesada si hubo un envío posterior; sin enviar no sale marcada en reenvíos", () => {
  const url = "https://x/orders/26_1/entregas-lavori/1791300000000-a.pdf";
  const ev = { type: "lavori.entrega_subida", payload: { attachmentUrl: url, nombre: "a.pdf" }, createdAt: "2026-10-08T09:00:00Z" };
  const sent = { type: "notification.delivery_ready.sent", payload: {}, createdAt: "2026-10-08T10:00:00Z" };
  assert.equal(pendingLavoriEntregas([ev], []).length, 1);
  assert.equal(pendingLavoriEntregas([ev, sent], []).length, 0);
  assert.deepEqual(unsentLavoriUrls([ev], [{ url }]), [url]);
  assert.deepEqual(unsentLavoriUrls([ev, sent], [{ url }]), []);
});
