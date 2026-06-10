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
  const content = escaped
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p style="margin:0 0 12px 0; font-family:Arial, sans-serif; font-size:15px; color:#0f172a;">${line}</p>`)
    .join("");
  return `
    <div style="background:#f8fafc; padding:24px 12px;">
      <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:22px;">
        <div style="margin-bottom:14px;">
          <a href="https://www.traduccionesjuradas.net" style="text-decoration:none;" target="_blank" rel="noopener noreferrer">
            <img src="https://www.traduccionesjuradas.net/brand/logo-horizontal.svg" alt="Traducciones Juradas" style="height:44px; width:auto; max-width:240px;" />
          </a>
        </div>
        ${content}
        <hr style="margin:18px 0 12px 0; border:0; border-top:1px solid #e2e8f0;" />
        <p style="margin:0; font-family:Arial, sans-serif; font-size:12px; color:#64748b;">
          TraduccionesJuradas.net · hola@traduccionesjuradas.net · 951 333 614
        </p>
      </div>
    </div>
  `;
}

export function buildPayLinkEmail(data: CommonData) {
  const subject = "Presupuesto traducción jurada – Instrucciones de pago";
  const body = `Estimado/a ${data.name},
Le enviamos el presupuesto correspondiente a su traducción jurada.
Puede revisarlo y realizar el pago de forma segura aquí: ${data.payUrl}
Formas de pago: Bizum / Transferencia / PayPal.
Si ha seleccionado envío en papel, los gastos de envío son 12 € + IVA (incluidos en el total).
Una vez confirmado el pago, comenzaremos la traducción de inmediato.
Si el PDF que nos envió no era totalmente legible, aquí le explicamos cómo escanear mejor la próxima vez: https://www.traduccionesjuradas.net/como-escanear-bien
Atentamente, Juan Silva – Traductor Jurado (MAEC).`;

  return { subject, body };
}

// Etiquetas de pago para el mensaje de WhatsApp (cuenta / Bizum a elegir).
export const PAYMENT_LABELS: Record<string, string> = {
  bbva: "por transferencia a BBVA: ES66 0182 3370 67 0201616991",
  openbank: "por transferencia a Openbank: ES33 0073 0100 5207 9242 5264",
  bizum607: "por Bizum al 607356273",
  bizum654: "por Bizum al 654069126",
  bizum: "por Bizum al 607356273 / 654069126",
  paypal: "por PayPal a hola@traduccionesjuradas.net",
};

export function buildWhatsAppPayText(data: {
  name: string;
  totalEur?: number;
  deliveryType?: "DIGITAL_PDF" | "PAPER_SHIP";
  plazo?: string | null;
  paymentMethods?: string[];
  payUrl?: string;
}) {
  const methods = (data.paymentMethods && data.paymentMethods.length > 0
    ? data.paymentMethods
    : ["bbva", "bizum607"]
  ).filter((m) => PAYMENT_LABELS[m]);
  const payLines = methods.map((m, i) => `${i + 1}️⃣ ${PAYMENT_LABELS[m]}`).join("\n");
  const entrega =
    data.deliveryType === "PAPER_SHIP"
      ? "📑 La traducción jurada es oficial y se envía en papel por mensajería."
      : "📑 La traducción jurada es oficial y se envía en PDF con firma digital.";
  return [
    `Hola ${data.name}, le paso el presupuesto de su traducción jurada:`,
    data.totalEur != null ? `💰 Coste: ${data.totalEur.toFixed(2)}€ (IVA incluido).` : "",
    data.plazo ? `🕙 Plazo: ${data.plazo}.` : "",
    entrega,
    `🤝 Para confirmar su encargo puede hacer el pago:`,
    payLines,
    `📥 Envíenos el justificante de pago para finalizar el encargo. ¡Gracias!`,
  ]
    .filter(Boolean)
    .join("\n");
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
  return `Hola ${data.name}, le escribo desde TraduccionesJuradas.net para recordarle que su presupuesto sigue pendiente de confirmación. Puede completarlo aquí: ${data.payUrl}. Quedo atento.`;
}
