import { test } from "node:test";
import assert from "node:assert/strict";
import { billingDataMissing } from "../../lib/delivery-billing.ts";
import { appendBillingRequest, buildDeliveryText } from "../../lib/delivery-message.ts";

test("billingDataMissing: solo por encima de 400 € y sin documento o dirección", () => {
  assert.equal(billingDataMissing("", "", 40000), false);
  assert.equal(billingDataMissing("", "Rua X", 70293), true);
  assert.equal(billingDataMissing("107.062.616-31", "", 70293), true);
  assert.equal(billingDataMissing("107.062.616-31", "Rua X", 70293), false);
});

test("appendBillingRequest: el enlace va antes de la reseña y sin URL no cambia nada", () => {
  const base = buildDeliveryText({ lang: "es", name: "Sarah", reference: "26_X", reviewUrl: "https://g.co/r" });
  assert.equal(appendBillingRequest(base, "es", null), base);
  const out = appendBillingRequest(base, "es", "https://www.traduccionesjuradas.net/area-cliente/pedido/26_X").split("\n\n");
  const i = out.findIndex((p) => p.includes("area-cliente/pedido/26_X"));
  assert.ok(i > 0 && out[i].includes("pasaporte"));
  assert.ok(out[i + 1].includes("Google"));
});
