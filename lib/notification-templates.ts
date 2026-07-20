export type NotificationTemplateKey =
  | "wa_payment_request"
  | "wa_status_update"
  | "wa_delivery_ready"
  | "wa_review_request"
  | "wa_bizum_payment"
  | "email_payment_request"
  | "email_status_update"
  | "email_delivery_ready"
  | "email_review_request";

type BuildTemplateInput = {
  key: NotificationTemplateKey;
  reference: string;
  paymentUrl?: string;
  statusUrl?: string;
  downloadUrl?: string;
  clientName?: string;
  reviewUrl?: string;
  amountEur?: string;
};

function safeName(name?: string) {
  const trimmed = String(name || "").trim();
  return trimmed || "cliente";
}

export function buildNotificationTemplate(input: BuildTemplateInput) {
  const name = safeName(input.clientName);

  switch (input.key) {
    case "wa_payment_request":
      return `Hola ${name}, para avanzar con tu pedido ${input.reference} puedes completar el pago aqui: ${input.paymentUrl}\nCuando lo hagas, sube el justificante en la misma pagina.`;
    case "wa_status_update":
      return `Hola ${name}, puedes consultar el estado de tu pedido ${input.reference} aqui: ${input.statusUrl}`;
    case "wa_delivery_ready":
      return input.downloadUrl
        ? `Hola ${name}, tu traduccion jurada del pedido ${input.reference} ya esta lista. Puedes descargarla aqui: ${input.downloadUrl}`
        : `Hola ${name}, tu traduccion jurada del pedido ${input.reference} ya esta lista. Indicanos si prefieres recibirla por email en este momento.`;
    case "email_payment_request":
      return `Pedido ${input.reference}: para confirmar y pagar tu encargo usa este enlace seguro: ${input.paymentUrl}`;
    case "email_status_update":
      return `Pedido ${input.reference}: estado actualizado. Puedes consultar el seguimiento aqui: ${input.statusUrl}`;
    case "email_delivery_ready":
      return input.downloadUrl
        ? `Pedido ${input.reference}: traduccion jurada lista para descarga en ${input.downloadUrl}`
        : `Pedido ${input.reference}: traduccion jurada lista. Falta enlace de descarga final.`;
    case "wa_bizum_payment":
      return `Hola ${name}, tu pedido ${input.reference}: ${input.amountEur || ""} (IVA incl.). Puedes pagarlo por Bizum al 607 356 273 (TraduccionesJuradas). Avísame cuando lo hagas y empiezo. ¡Gracias!`;
    case "wa_review_request":
      return `Hola ${name}, gracias por confiar en nosotros para tu traduccion jurada. Si el servicio te ha sido util, nos ayudaria mucho tu valoracion: ${input.reviewUrl || ""}`;
    case "email_review_request":
      return `Hola ${name}, gracias por confiar en TraduccionesJuradas.net. Si estas satisfecho con el servicio, nos ayudaria mucho tu valoracion en Google: ${input.reviewUrl || ""}`;
    default:
      return "";
  }
}

// Mensaje de reenvío de la entrega (WhatsApp/email): traducciones + reseña.
// Vivía inline en la ficha de pedido; aquí para que toda plantilla tenga una casa.
export function buildDeliveryResendMessage(input: {
  reference: string;
  files: { name: string; url?: string }[];
  reviewUrl: string;
}) {
  if (input.files.length === 0) return "";
  return [
    `Hola, tu traducción jurada (pedido ${input.reference}) ya está lista.`,
    input.files.map((f) => `• ${f.name}: ${f.url || ""}`).join("\n"),
    `Si todo está correcto, nos ayudaría muchísimo tu reseña en Google: ${input.reviewUrl}`,
    "¡Gracias!",
  ].join("\n\n");
}
