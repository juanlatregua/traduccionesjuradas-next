import { formatDateEs } from "@/lib/quotes";

type CommonData = {
  name: string;
  payUrl: string;
};

export function renderSimpleEmailHtml(body: string) {
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p style="margin:0 0 12px 0; font-family:Arial, sans-serif; font-size:15px; color:#0f172a;">${line}</p>`)
    .join("");
}

export function buildPayLinkEmail(data: CommonData) {
  const subject = "Presupuesto traducción jurada – Instrucciones de pago";
  const body = `Estimado/a ${data.name},
Le enviamos el presupuesto correspondiente a su traducción jurada.
Puede revisarlo y realizar el pago de forma segura aquí: ${data.payUrl}
Formas de pago: Tarjeta / PayPal / Bizum.
Si ha seleccionado envío en papel, los gastos de envío son 12 € + IVA (incluidos en el total).
Una vez confirmado el pago, comenzaremos la traducción de inmediato.
Atentamente, Juan Silva – Traductor Jurado (MAEC).`;

  return { subject, body };
}

export function buildWhatsAppPayText(data: CommonData) {
  return `Hola ${data.name}, le envío el enlace para revisar y confirmar el presupuesto de su traducción jurada: ${data.payUrl}. Puede pagar con tarjeta, PayPal o Bizum. En cuanto el pago quede confirmado, comenzamos. – Juan Silva, Traductor Jurado.`;
}

export function buildPaidDigitalEmail(data: { name: string; etaDate: Date }) {
  const subject = "Pago recibido – Traducción jurada en formato digital";
  const body = `Estimado/a ${data.name},
Confirmamos recepción del pago ✅
Plazo estimado de entrega: ${formatDateEs(data.etaDate)}.
Le enviaremos la traducción jurada en PDF firmado digitalmente a este mismo email dentro del plazo indicado.
Atentamente, Juan Silva – Traductor Jurado (MAEC).`;
  return { subject, body };
}

export function buildPaidPaperEmail(data: { name: string; etaDate: Date }) {
  const subject = "Pago recibido – Envío de traducción jurada en papel";
  const body = `Estimado/a ${data.name},
Confirmamos recepción del pago ✅
Finalización estimada: ${formatDateEs(data.etaDate)}.
Envío: mensajería 24/48h una vez terminada la traducción.
El coste de envío (12 € + IVA) está incluido en el importe abonado.
Atentamente, Juan Silva – Traductor Jurado (MAEC).`;
  return { subject, body };
}

export function buildReminderEmail(data: {
  name: string;
  quoteNumber: string;
  sentDate: Date;
  payUrl: string;
}) {
  const subject = "Recordatorio: presupuesto pendiente de confirmación";
  const body = `Estimado/a ${data.name},
Le recordamos que el presupuesto ${data.quoteNumber} enviado el ${formatDateEs(data.sentDate)} sigue pendiente de confirmación.
Puede revisarlo y realizar el pago aquí: ${data.payUrl}
Quedo a su disposición. – Juan Silva`;
  return { subject, body };
}

export function buildExpiredEmail(data: { name: string; quoteNumber: string; payUrl: string }) {
  const subject = "Presupuesto expirado";
  const body = `Estimado/a ${data.name},
El presupuesto ${data.quoteNumber} ha expirado.
Si desea retomarlo, responda a este correo o use este enlace para solicitar actualización: ${data.payUrl}
Atentamente, Juan Silva – Traductor Jurado (MAEC).`;
  return { subject, body };
}

export function buildWhatsAppReminderText(data: { name: string; payUrl: string }) {
  return `Hola ${data.name}, le recuerdo que su presupuesto sigue pendiente de confirmación. Puede completarlo aquí: ${data.payUrl}. Quedo atento. – Juan Silva`;
}
