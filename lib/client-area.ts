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
