// lib/payment-labels.ts — Etiquetas de pago (cuenta / Bizum a elegir).
// Módulo SIN dependencias (client-safe): fuente única usada por el PDF, el
// mensaje de WhatsApp del envío y el panel de detalle del presupuesto.

export const PAYMENT_LABELS: Record<string, string> = {
  bbva: "por transferencia a BBVA: ES66 0182 3370 67 0201616991",
  openbank: "por transferencia a Openbank: ES33 0073 0100 5207 9242 5264",
  bizum607: "por Bizum al 607356273",
  bizum654: "por Bizum al 654069126",
  bizum: "por Bizum al 607356273 / 654069126",
  paypal: "por PayPal a hola@traduccionesjuradas.net",
};
