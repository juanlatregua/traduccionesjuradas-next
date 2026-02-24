import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveCheckoutEntryStep,
  resolveGuestStep,
  resolveGoogleCallbackStep,
} from "../../lib/funnel-routing.ts";
import { canAccess, routeForStep } from "../../lib/step.ts";

test("guest va a CHECKOUT cuando ya hay selección + documentos subidos", () => {
  const step = resolveGuestStep({ selectedCount: 2, uploadedCount: 2 });
  assert.equal(step, "CHECKOUT");
});

test("guest va a UPLOAD cuando no hay adjuntos aún", () => {
  const step = resolveGuestStep({ selectedCount: 1, uploadedCount: 0 });
  assert.equal(step, "UPLOAD");
});

test("login Google mantiene CHECKOUT si ya estaba listo", () => {
  const step = resolveGoogleCallbackStep({
    selectedCount: 2,
    uploadedCount: 2,
    lastKnownStep: "CHECKOUT",
  });
  assert.equal(step, "CHECKOUT");
});

test("abrir /checkout sin sesión redirige a SELECT", () => {
  const step = resolveCheckoutEntryStep({
    hasSession: false,
    selectedCount: 0,
    uploadedCount: 0,
  });
  assert.equal(step, "SELECT");
});

test("routeForStep mapea correctamente y canAccess bloquea pasos no actuales", () => {
  assert.equal(routeForStep("CHECKOUT"), "/checkout");
  assert.equal(canAccess("REVIEW", "REVIEW"), true);
  assert.equal(canAccess("REVIEW", "CHECKOUT"), false);
});

