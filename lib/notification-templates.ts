export type NotificationTemplateKey =
  | "wa_payment_request"
  | "wa_status_update"
  | "wa_delivery_ready"
  | "email_payment_request"
  | "email_status_update"
  | "email_delivery_ready";

type BuildTemplateInput = {
  key: NotificationTemplateKey;
  reference: string;
  paymentUrl: string;
  statusUrl: string;
  downloadUrl?: string;
  clientName?: string;
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
    default:
      return "";
  }
}
