export const WORKFLOW_STATES = [
  "BORRADOR",
  "PENDIENTE_REVISION",
  "PRESUPUESTO_ENVIADO",
  "PENDIENTE_PAGO",
  "JUSTIFICANTE_SUBIDO",
  "PAGO_VALIDADO",
  "EN_TRADUCCION",
  "TRADUCIDO_ENTREGADO",
  "CERRADO",
] as const;

export type WorkflowState = (typeof WORKFLOW_STATES)[number];

export type FlowProfile = "FR_A" | "FR_B" | "LANG_REVIEW" | "GENERAL";

export type WorkflowEventLike = {
  type: string;
  payload?: unknown;
  createdAt?: Date | string | null;
};

export type WorkflowOrderLike = {
  paymentStatus: string;
  deliveryState?: string | null;
  events?: WorkflowEventLike[];
};

const WORKFLOW_TRANSITIONS: Record<WorkflowState, WorkflowState[]> = {
  BORRADOR: ["PENDIENTE_REVISION", "PENDIENTE_PAGO"],
  PENDIENTE_REVISION: ["PRESUPUESTO_ENVIADO"],
  PRESUPUESTO_ENVIADO: ["PENDIENTE_PAGO"],
  PENDIENTE_PAGO: ["JUSTIFICANTE_SUBIDO", "PAGO_VALIDADO"],
  JUSTIFICANTE_SUBIDO: ["PAGO_VALIDADO"],
  PAGO_VALIDADO: ["EN_TRADUCCION"],
  EN_TRADUCCION: ["TRADUCIDO_ENTREGADO"],
  TRADUCIDO_ENTREGADO: ["CERRADO"],
  CERRADO: [],
};

function parseWorkflowState(value: unknown): WorkflowState | null {
  if (typeof value !== "string") return null;
  return (WORKFLOW_STATES as readonly string[]).includes(value)
    ? (value as WorkflowState)
    : null;
}

function sortEventsDesc(events: WorkflowEventLike[]) {
  return [...events].sort((a, b) => {
    const ta = new Date(a.createdAt || 0).getTime();
    const tb = new Date(b.createdAt || 0).getTime();
    return tb - ta;
  });
}

function latestWorkflowStateEvent(events: WorkflowEventLike[]) {
  return sortEventsDesc(events).find((event) => event.type === "workflow.state_changed") || null;
}

export function canTransitionWorkflow(from: WorkflowState, to: WorkflowState) {
  if (from === to) return true;
  return WORKFLOW_TRANSITIONS[from].includes(to);
}

export function getNextWorkflowStates(from: WorkflowState) {
  return WORKFLOW_TRANSITIONS[from];
}

export function getWorkflowState(order: WorkflowOrderLike): WorkflowState {
  const events = order.events || [];
  const workflowEvent = latestWorkflowStateEvent(events);
  const fromEvent = parseWorkflowState((workflowEvent?.payload as any)?.to);
  if (fromEvent) return fromEvent;

  if (order.deliveryState === "TRADUCIDO") return "TRADUCIDO_ENTREGADO";
  if (order.deliveryState === "EN_PROCESO") return "EN_TRADUCCION";
  if (order.paymentStatus === "PAID") return "PAGO_VALIDADO";
  const hasProof = events.some((event) => event.type === "payment.proof_uploaded");
  if (hasProof) return "JUSTIFICANTE_SUBIDO";
  return "PENDIENTE_PAGO";
}

export function getFlowProfile(events: WorkflowEventLike[]): FlowProfile {
  const flowEvent = sortEventsDesc(events).find((event) => event.type === "order.flow_profile") || null;
  const raw = String((flowEvent?.payload as any)?.profile || "").toUpperCase();
  if (raw === "FR_A" || raw === "FR_B" || raw === "LANG_REVIEW") return raw;
  return "GENERAL";
}

export function isFrenchPair(langPair?: string | null) {
  const normalized = String(langPair || "").trim().toLowerCase();
  return normalized === "fr-es" || normalized === "es-fr";
}

export function inferFlowProfile(input: {
  langPair?: string | null;
  hasMixedCart?: boolean;
  containsWordCountItem?: boolean;
}) {
  const langPair = String(input.langPair || "").trim().toLowerCase();
  const isFrench = isFrenchPair(langPair);
  if (isFrench && input.hasMixedCart) return "FR_B" as const;
  if (isFrench) return "FR_A" as const;

  const [from, to] = langPair.split("-");
  const nonFrenchReviewLanguages = new Set(["en", "de", "pt", "it", "ca"]);
  if (nonFrenchReviewLanguages.has(from) || nonFrenchReviewLanguages.has(to)) {
    return "LANG_REVIEW" as const;
  }

  if (input.containsWordCountItem) return "LANG_REVIEW" as const;
  return "GENERAL" as const;
}

export function requiresInternalReview(profile: FlowProfile) {
  return profile === "FR_B" || profile === "LANG_REVIEW";
}

/**
 * Decide qué SMS de hito corresponde a una transición de workflow (o ninguno).
 * Puro, para que cualquier camino que mueva el estado (Kanban, /assign,
 * /delivery, auto-asignación) avise al cliente desde un solo sitio. El hito
 * "lista" exige un entregable real (el caller /delivery lo señala con
 * `delivered`; el Kanban se valida por `translatedFileUrl` ya persistido) para
 * no prometer una descarga que no existe.
 */
export function milestoneSmsFor(
  to: WorkflowState,
  opts: { delivered?: boolean; translatedFileUrl?: string | null }
): "en_proceso" | "lista" | null {
  if (to === "EN_TRADUCCION") return "en_proceso";
  if (to === "TRADUCIDO_ENTREGADO") {
    const hasDeliverable = opts.delivered === true || Boolean(opts.translatedFileUrl);
    return hasDeliverable ? "lista" : null;
  }
  return null;
}

export function getWorkflowStateLabel(state: WorkflowState | string) {
  const labels: Record<WorkflowState, string> = {
    BORRADOR: "Borrador",
    PENDIENTE_REVISION: "Pendiente revisión",
    PRESUPUESTO_ENVIADO: "Presupuesto enviado",
    PENDIENTE_PAGO: "Pendiente pago",
    JUSTIFICANTE_SUBIDO: "Justificante subido",
    PAGO_VALIDADO: "Pago validado",
    EN_TRADUCCION: "En traducción",
    TRADUCIDO_ENTREGADO: "Traducido entregado",
    CERRADO: "Cerrado",
  };
  const parsed = parseWorkflowState(state);
  if (!parsed) return "Pendiente de pago";
  return labels[parsed];
}
