// lib/sms-templates.ts — Plantillas SMS (max ~160 chars para 1 SMS)

export function smsPresupuestoListo(data: {
  ref: string;
  precio: string;
  url: string;
}): string {
  return `TraduccionesJuradas.net: Presupuesto ${data.ref} listo: ${data.precio}€. Acepta y paga: ${data.url}`;
}

export function smsTraduccionLista(data: {
  ref: string;
  url: string;
}): string {
  return `TraduccionesJuradas.net: Tu traduccion ${data.ref} esta lista. Descargala: ${data.url}`;
}

export function smsRecordatorioPago(data: {
  ref: string;
  precio: string;
  url: string;
}): string {
  return `TraduccionesJuradas.net: Tu presupuesto ${data.ref} (${data.precio}€) caduca pronto. Paga: ${data.url}`;
}

export function smsPagoConfirmado(data: {
  ref: string;
  plazo: string;
  url: string;
}): string {
  return `TraduccionesJuradas.net: Pago confirmado ${data.ref}. Entrega: ${data.plazo}. Sigue el estado: ${data.url}`;
}

export function smsEnProceso(data: { ref: string; url: string }): string {
  return `TraduccionesJuradas.net: Tu traduccion ${data.ref} ya esta en proceso. Sigue el estado: ${data.url}`;
}

export function smsReviewRequest(data: { url: string }): string {
  return `TraduccionesJuradas.net: Nos encantaria tu opinion. Dejanos una valoracion en Google: ${data.url}`;
}
