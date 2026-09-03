import type { WorkflowState } from "@/lib/workflow";

export function assertWorkflowTransitionPreconditions(params: {
  to: WorkflowState;
  paymentStatus: string;
  // Carril de crédito (2-sep-2026): "asegurado" = factura EMITIDA con
  // vencimiento (lib/credit-terms.isOrderSecured). Vale como "cobrado" para
  // trabajar y entregar. Si el caller no lo pasa, sigue exigiendo PAID.
  secured?: boolean;
  translatedFileUrl?: string | null;
  delivered?: boolean;
  deliveredOutsideApp?: boolean;
}) {
  const paidOrSecured = params.paymentStatus === "PAID" || params.secured === true;
  if (params.to === "PAGO_VALIDADO" && !paidOrSecured) {
    throw new Error("No se puede marcar PAGO_VALIDADO sin pago confirmado ni crédito autorizado.");
  }
  // No se puede marcar ENTREGADO sin entregable: o bien el caller lo afirma
  // (la entrega pasa delivered:true justo antes de persistir el fichero), o ya
  // hay un fichero en translatedFileUrl (mover la tarjeta en el Kanban). Cierra
  // el hueco de marcar entregado sin traducción desde CUALQUIER estado origen
  // (incluida la nueva arista PAGO_VALIDADO -> TRADUCIDO_ENTREGADO).
  // Excepcion: la entrega ya ocurrio FUERA de la app (Juan la mando por su
  // correo, en mano o en papel) y solo se esta registrando el hecho. No hay
  // fichero que adjuntar y no se promete descarga: el caller pasa
  // deliveredOutsideApp y NO delivered, asi que milestoneSmsFor devuelve null.
  if (
    params.to === "TRADUCIDO_ENTREGADO" &&
    !params.delivered &&
    !params.deliveredOutsideApp &&
    !params.translatedFileUrl
  ) {
    throw new Error("Para marcar como entregado debes adjuntar al menos un archivo.");
  }
  // Regla de negocio: no entregar sin cobrar. Hoy el grafo ya lo impone
  // (solo se llega desde PAGO_VALIDADO/EN_TRADUCCION), pero este guard es la
  // defensa en profundidad: cualquier arista o caller futuro choca aquí.
  if (params.to === "TRADUCIDO_ENTREGADO" && !paidOrSecured) {
    throw new Error("No se puede marcar como entregado un pedido sin pago confirmado ni crédito autorizado.");
  }
}
