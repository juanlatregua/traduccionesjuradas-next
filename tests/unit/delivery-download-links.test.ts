import { test } from "node:test";
import assert from "node:assert/strict";
import { appendDownloadLinks, buildDeliveryText, deliveryTextToHtml, documentDisplayName } from "../../lib/delivery-message.ts";

test("documentDisplayName: quita cliente, número, «jurada firmada» y extensión", () => {
  assert.equal(
    documentDisplayName("Aliounen - 04 Boletín de notas semestre 6 (Licenciatura en Management y Economía Digital - jurada firmada.pdf"),
    "Boletín de notas semestre 6 (Licenciatura en Management y Economía Digital)"
  );
  assert.equal(documentDisplayName("Traduccion-jurada-26_C937DD-2.pdf"), "Traduccion-jurada-26_C937DD-2");
});

test("appendDownloadLinks: el nombre es el enlace y la URL larga no se ve", () => {
  const url = "https://x.public.blob.vercel-storage.com/orders/26_X/1-Bolet%C3%ADn-abc.pdf";
  const base = buildDeliveryText({ lang: "fr", name: "Alioune", reference: "26_X", reviewUrl: "https://g.co/r" });
  const text = appendDownloadLinks(base, "fr", [{ url, name: "Aliounen - 01 Boletín semestre 2 - jurada firmada.pdf" }]);
  assert.ok(text.includes("trop volumineux"));
  const html = deliveryTextToHtml(text);
  assert.ok(html.includes(`• <a href="${url}">Boletín semestre 2</a>`));
  assert.equal(html.split(url).length - 1, 1);
  assert.ok(html.includes('<a href="https://valide.redsara.es">https://valide.redsara.es</a>'));
  assert.equal(appendDownloadLinks(base, "fr", []), base);
});
