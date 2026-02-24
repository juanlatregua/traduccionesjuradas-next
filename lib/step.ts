import type { SessionStep } from "@prisma/client";

export const STEP_ORDER: SessionStep[] = [
  "START",
  "UPLOAD",
  "REVIEW",
  "CHECKOUT",
  "CONFIRMATION",
];

const STEP_ROUTE: Record<SessionStep, string> = {
  START: "/start",
  UPLOAD: "/upload",
  REVIEW: "/review",
  CHECKOUT: "/checkout",
  CONFIRMATION: "/confirmation",
};

export function routeForStep(step: SessionStep) {
  return STEP_ROUTE[step] || "/start";
}

export function canAccess(sessionStep: SessionStep, routeStep: SessionStep) {
  return sessionStep === routeStep;
}

export function stepIndex(step: SessionStep) {
  return STEP_ORDER.indexOf(step);
}

