import type { WorkflowState } from "@/lib/workflow";

export function assertWorkflowTransitionPreconditions(params: {
  to: WorkflowState;
  paymentStatus: string;
  translatedFileUrl?: string | null;
  delivered?: boolean;
}) {
  if (params.to === "PAGO_VALIDADO" && params.paymentStatus !== "PAID") {
    throw new Error("No se puede marcar PAGO_VALIDADO sin pago confirmado.");
  }
  // No se puede marcar ENTREGADO sin entregable: o bien el caller lo afirma
  // (la entrega pasa delivered:true justo antes de persistir el fichero), o ya
  // hay un fichero en translatedFileUrl (mover la tarjeta en el Kanban). Cierra
  // el hueco de marcar entregado sin traducción desde CUALQUIER estado origen
  // (incluida la nueva arista PAGO_VALIDADO -> TRADUCIDO_ENTREGADO).
  if (params.to === "TRADUCIDO_ENTREGADO" && !params.delivered && !params.translatedFileUrl) {
    throw new Error("Para marcar como entregado debes adjuntar al menos un archivo.");
  }
}
