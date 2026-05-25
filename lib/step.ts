import type { SessionStep } from "@prisma/client";

export const STEP_ORDER: SessionStep[] = [
  "START",
  "UPLOAD",
  "REVIEW",
  "CHECKOUT",
  "CONFIRMATION",
];

// START/UPLOAD/REVIEW colapsaron en la puerta (v2 Fase 1, Bloque 1.4).
const STEP_ROUTE: Record<SessionStep, string> = {
  START: "/presupuesto-instantaneo",
  UPLOAD: "/presupuesto-instantaneo",
  REVIEW: "/presupuesto-instantaneo",
  CHECKOUT: "/checkout",
  CONFIRMATION: "/confirmation",
};

export function routeForStep(step: SessionStep) {
  return STEP_ROUTE[step] || "/presupuesto-instantaneo";
}

export function canAccess(sessionStep: SessionStep, routeStep: SessionStep) {
  return sessionStep === routeStep;
}

export function stepIndex(step: SessionStep) {
  return STEP_ORDER.indexOf(step);
}

