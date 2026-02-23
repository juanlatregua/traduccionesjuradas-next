/* Label helpers for order states — used by area-cliente pages */

export function getPaymentStateLabel(status: string) {
  if (status === "PAID") return "Pagado";
  if (status === "FAILED") return "Fallido";
  if (status === "REFUNDED") return "Reembolsado";
  return "Pendiente de pago";
}

export function getDeliveryStateLabel(state: string) {
  if (state === "EN_PROCESO") return "En proceso";
  if (state === "TRADUCIDO") return "Traducido";
  return "Presupuesto emitido";
}

export function getDeliveryTypeLabel(type: string) {
  return type === "envio" ? "Envio fisico" : "PDF firmado";
}

export function getWorkflowStateLabel(state?: string | null) {
  const map: Record<string, string> = {
    BORRADOR: "Borrador",
    PENDIENTE_REVISION: "Pendiente de revisión interna",
    PRESUPUESTO_ENVIADO: "Presupuesto enviado",
    PENDIENTE_PAGO: "Pendiente de pago",
    JUSTIFICANTE_SUBIDO: "Justificante subido",
    PAGO_VALIDADO: "Pago validado",
    EN_TRADUCCION: "En traducción",
    TRADUCIDO_ENTREGADO: "Traducido y entregado",
    CERRADO: "Cerrado",
  };
  return map[String(state || "")] || "Pendiente de pago";
}
