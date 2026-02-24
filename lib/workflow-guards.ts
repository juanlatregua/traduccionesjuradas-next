import type { WorkflowState } from "@/lib/workflow";

export function assertWorkflowTransitionPreconditions(params: {
  to: WorkflowState;
  paymentStatus: string;
}) {
  if (params.to === "PAGO_VALIDADO" && params.paymentStatus !== "PAID") {
    throw new Error("No se puede marcar PAGO_VALIDADO sin pago confirmado.");
  }
}
