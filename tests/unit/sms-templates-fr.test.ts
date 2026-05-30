import test from "node:test";
import assert from "node:assert/strict";
import {
  smsPagoConfirmado,
  smsEnProceso,
  smsTraduccionLista,
  formatDeliveryPlazo,
} from "../../lib/sms-templates.ts";

test("los 3 hitos en FR cuando lang=fr", () => {
  assert.match(smsPagoConfirmado({ ref: "TJ-1", plazo: "20 mai", url: "u", lang: "fr" }), /Paiement confirmé/);
  assert.match(smsEnProceso({ ref: "TJ-1", url: "u", lang: "fr" }), /en cours/);
  assert.match(smsTraduccionLista({ ref: "TJ-1", url: "u", lang: "fr" }), /est prête/);
});

test("por defecto (sin lang) siguen en español", () => {
  assert.match(smsPagoConfirmado({ ref: "TJ-1", plazo: "x", url: "u" }), /Pago confirmado/);
  assert.match(smsEnProceso({ ref: "TJ-1", url: "u" }), /en proceso/);
  assert.match(smsTraduccionLista({ ref: "TJ-1", url: "u" }), /esta lista/);
});

test("formatDeliveryPlazo: fallback localizado sin fecha", () => {
  assert.equal(formatDeliveryPlazo(null, "fr"), "3-5 jours ouvrés");
  assert.equal(formatDeliveryPlazo(null, "es"), "3-5 días laborables");
});

test("formatDeliveryPlazo: fecha en locale FR vs ES", () => {
  const d = new Date("2026-05-20T10:00:00.000Z");
  assert.match(formatDeliveryPlazo(d, "fr"), /mai/);
  assert.match(formatDeliveryPlazo(d, "es"), /mayo/);
});
