import test from "node:test";
import assert from "node:assert/strict";
import { BRIDGE_MAX_FAILED_DELIVERIES, bridgeFailureAction, costAlertAlreadySent, shouldSendPaidConfirmation } from "../../lib/money-alerts-math.ts";

test("aviso sin coste: una vez por pedido y traductor", () => {
  const ev = [{ payload: { translator: "Juan Amor Fernández", origin: "auto" } }];
  assert.equal(costAlertAlreadySent([], "Juan Amor"), false);
  assert.equal(costAlertAlreadySent(ev, "Juan Amor Fernández"), true);
  assert.equal(costAlertAlreadySent(ev, "Juan Amor"), true, "mismo jurado con nombre corto");
  assert.equal(costAlertAlreadySent(ev, "Daniela Cleintuar"), false, "otro traductor = otro aviso");
  assert.equal(costAlertAlreadySent([{ payload: null }], "Daniela Cleintuar"), false);
});

test("pago confirmado: no se reenvía si ya salió uno al cliente", () => {
  assert.equal(shouldSendPaidConfirmation([]), true);
  assert.equal(shouldSendPaidConfirmation([{ status: "FAILED", recipient: "a@b.es" }]), true, "el que falló se reintenta");
  assert.equal(shouldSendPaidConfirmation([{ status: "NOTICE", recipient: "staff" }]), true, "los avisos a staff no cuentan");
  assert.equal(shouldSendPaidConfirmation([{ status: "SENT", recipient: "a@b.es" }]), false);
});

test("puente fallido: 500 para que Stripe reintente hasta N entregas, luego 200", () => {
  assert.equal(bridgeFailureAction(1), "retry");
  assert.equal(bridgeFailureAction(BRIDGE_MAX_FAILED_DELIVERIES - 1), "retry");
  assert.equal(bridgeFailureAction(BRIDGE_MAX_FAILED_DELIVERIES), "give_up");
  assert.equal(bridgeFailureAction(BRIDGE_MAX_FAILED_DELIVERIES + 3), "give_up");
});
