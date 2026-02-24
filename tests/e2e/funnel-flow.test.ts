import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveFunnelPathForStep,
  resolveCheckoutEntryStep,
  resolveGuestStep,
  resolveGoogleCallbackStep,
} from "../../lib/funnel-routing.ts";

test("Escenario 1: start -> upload -> review -> checkout invitado", () => {
  const uploadStep = resolveGuestStep({ selectedCount: 1, uploadedCount: 0 });
  assert.equal(uploadStep, "UPLOAD");
  assert.equal(resolveFunnelPathForStep(uploadStep), "/traductor-jurado-frances?step=upload");

  const checkoutStep = resolveGuestStep({ selectedCount: 1, uploadedCount: 1 });
  assert.equal(checkoutStep, "CHECKOUT");
  assert.equal(resolveFunnelPathForStep(checkoutStep), "/traductor-jurado-frances?step=checkout");
});

test("Escenario 2: login Google en checkout conserva paso", () => {
  const restored = resolveGoogleCallbackStep({
    selectedCount: 2,
    uploadedCount: 2,
    lastKnownStep: "CHECKOUT",
  });
  assert.equal(restored, "CHECKOUT");
  assert.equal(resolveFunnelPathForStep(restored), "/traductor-jurado-frances?step=checkout");
});

test("Escenario 3: /checkout directo sin sesión redirige a /start", () => {
  const resolved = resolveCheckoutEntryStep({
    hasSession: false,
    selectedCount: 0,
    uploadedCount: 0,
  });
  assert.equal(resolved, "SELECT");
  assert.equal(resolveFunnelPathForStep(resolved), "/traductor-jurado-frances");
});
