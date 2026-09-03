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

// Carril de crédito (2-sep-2026): "asegurado" (factura emitida con vencimiento)
// vale como "cobrado" para trabajar y entregar. Sin secured, todo sigue igual.
test("credito: permite PAGO_VALIDADO y ENTREGADO con secured aunque no haya pago", () => {
  assert.doesNotThrow(() =>
    assertWorkflowTransitionPreconditions({ to: "PAGO_VALIDADO", paymentStatus: "PENDING", secured: true })
  );
  assert.doesNotThrow(() =>
    assertWorkflowTransitionPreconditions({ to: "TRADUCIDO_ENTREGADO", paymentStatus: "PENDING", secured: true, delivered: true })
  );
});

test("credito: secured:false no relaja nada", () => {
  assert.throws(
    () => assertWorkflowTransitionPreconditions({ to: "PAGO_VALIDADO", paymentStatus: "PENDING", secured: false }),
    /sin pago confirmado/
  );
  assert.throws(
    () => assertWorkflowTransitionPreconditions({ to: "TRADUCIDO_ENTREGADO", paymentStatus: "PENDING", secured: false, delivered: true }),
    /sin pago confirmado/
  );
});
