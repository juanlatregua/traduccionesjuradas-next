import test from "node:test";
import assert from "node:assert/strict";
import { assertWorkflowTransitionPreconditions } from "../../lib/workflow-guards.ts";

test("transicion invalida: bloquea PAGO_VALIDADO sin pago confirmado", () => {
  assert.throws(
    () =>
      assertWorkflowTransitionPreconditions({
        to: "PAGO_VALIDADO",
        paymentStatus: "PENDING",
      }),
    /PAGO_VALIDADO sin pago confirmado/
  );
});

test("permite PAGO_VALIDADO cuando paymentStatus ya es PAID", () => {
  assert.doesNotThrow(() =>
    assertWorkflowTransitionPreconditions({
      to: "PAGO_VALIDADO",
      paymentStatus: "PAID",
    })
  );
});
