import { formatDateEs } from "@/lib/quotes";
import { PAYMENT_LABELS } from "@/lib/payment-labels";

export { PAYMENT_LABELS };

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


const LANG_NAMES: Record<string, string> = {
  es: "español", fr: "francés", en: "inglés", de: "alemán", it: "italiano",
  pt: "portugués", ca: "catalán", nl: "neerlandés", sv: "sueco", no: "noruego",
  ar: "árabe", ro: "rumano",
};

export function buildWhatsAppPayText(data: {
  name: string;
  totalEur?: number;
  deliveryType?: "DIGITAL_PDF" | "PAPER_SHIP";
  plazo?: string | null;
  paymentMethods?: string[];
  sourceLang?: string;
  targetLang?: string;
  payUrl?: string;
}) {
  const methods = (data.paymentMethods && data.paymentMethods.length > 0
    ? data.paymentMethods
    : ["bbva", "bizum607"]
  ).filter((m) => PAYMENT_LABELS[m]);
  const payLines = methods.map((m, i) => `${i + 1}️⃣ ${PAYMENT_LABELS[m]}`).join("\n");

  const src = data.sourceLang ? LANG_NAMES[data.sourceLang] || data.sourceLang : "";
  const tgt = data.targetLang ? LANG_NAMES[data.targetLang] || data.targetLang : "";
  const par = src && tgt ? ` del ${src} al ${tgt}` : "";
  const costeLine =
    data.totalEur != null
      ? `- 💰 El coste de la traducción jurada${par} es de ${data.totalEur.toFixed(2)}€ (IVA incluido).`
      : "";
  const entrega =
    data.deliveryType === "PAPER_SHIP"
      ? "- 📑 La traducción jurada es oficial y se envía en papel por mensajería."
      : "- 📑 La traducción jurada es oficial y se envía en PDF con firma digital.";

  return [
    `Hola ${data.name} 👋`,
    costeLine,
    data.plazo ? `- 🕙 El plazo es de ${data.plazo}.` : "",
    entrega,
    `- 🤝 Para confirmar su encargo puede hacer el pago:`,
    payLines,
    `- 📥 Nos envía el justificante de pago para finalizar el encargo. ¡Gracias!`,
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
  // Los enlaces de motivo aterrizan en la página pública con el motivo preseleccionado;
  // el registro real exige confirmar con un botón (POST) — los escáneres de email
  // pre-abren enlaces y un GET que escribiera en BD llenaría esto de motivos falsos.
  const body = `Estimado/a ${data.name},
El presupuesto ${data.quoteNumber} ha expirado.
Si desea retomarlo, responda a este correo o use este enlace para solicitar actualización: ${data.payUrl}
Si decidió no seguir adelante, nos ayudaría mucho conocer el motivo (solo un clic):
· El precio: ${data.payUrl}?fb=PRICE
· El plazo: ${data.payUrl}?fb=DEADLINE
· Ya no lo necesito: ${data.payUrl}?fb=NO_LONGER_NEEDED
· Lo resolví con otro traductor: ${data.payUrl}?fb=SOLVED_ELSEWHERE
· Otro motivo: ${data.payUrl}?fb=OTHER
Atentamente, Juan Silva – Traductor Jurado (MAEC).`;
  return { subject, body };
}

export function buildWhatsAppReminderText(data: { name: string; payUrl: string }) {
  return `Hola ${data.name}, le escribo desde TraduccionesJuradas.net para recordarle que su presupuesto sigue pendiente de confirmación. Puede completarlo aquí: ${data.payUrl}. Quedo atento.`;
}

// ── Captación de leads con presupuesto que no llegó / no se revisó ────────────
// Mensaje humano (NO transaccional): ofrece que un traductor jurado revise el
// caso personalmente. Localizado es/fr/en según el idioma del cliente.

export type CaptureLang = "es" | "fr" | "en";

/** Resuelve el idioma del mensaje de captación: clientLocale del pedido, si no
 *  el idioma de origen del documento; fr→fr, es→es, cualquier otro→inglés. */
export function resolveCaptureLang(opts: {
  clientLocale?: string | null;
  sourceLang?: string | null;
}): CaptureLang {
  const v = opts.clientLocale || opts.sourceLang || "es";
  if (v === "fr") return "fr";
  if (v === "es") return "es";
  return "en";
}

/** Email de captación "un traductor analiza tu presupuesto". `payUrl` opcional:
 *  inclúyelo SOLO si el presupuesto se entregó de verdad (no enlaces un DRAFT
 *  con precios sin revisar). */
export function buildTranslatorReviewEmail(data: {
  name: string;
  lang?: CaptureLang;
  payUrl?: string | null;
}) {
  const lang = data.lang || "es";
  if (lang === "fr") {
    const link = data.payUrl ? ` ${data.payUrl}` : "";
    return {
      subject: "Votre devis de traduction assermentée — souhaitez-vous qu'on le revoie ensemble ?",
      body: `Bonjour ${data.name},
Nous avons préparé le devis de votre traduction assermentée, mais il semble que vous n'ayez pas pu le consulter.
Pour lever tout doute, un traducteur assermenté peut étudier votre dossier personnellement — document, délai et validité officielle auprès de l'organisme destinataire — sans engagement.
Répondez à ce courriel ou écrivez-nous sur WhatsApp et nous le voyons aujourd'hui même.${link}
Cordialement, Juan Silva — Traducteur assermenté (MAEC).`,
    };
  }
  if (lang === "en") {
    const link = data.payUrl ? ` ${data.payUrl}` : "";
    return {
      subject: "Your sworn translation quote — shall we review it together?",
      body: `Dear ${data.name},
We've prepared the quote for your sworn translation, but it looks like you haven't had a chance to review it.
To clear up any doubts, a sworn translator can review your case personally — document, turnaround time and official validity before the receiving authority — at no obligation.
Reply to this email or message us on WhatsApp and we'll look at it today.${link}
Best regards, Juan Silva — Sworn Translator (MAEC).`,
    };
  }
  const link = data.payUrl ? ` ${data.payUrl}` : "";
  return {
    subject: "Su presupuesto de traducción jurada — ¿lo revisamos juntos?",
    body: `Estimado/a ${data.name},
Hemos preparado el presupuesto de su traducción jurada, pero no nos consta que haya podido revisarlo.
Para que no se quede con dudas, un traductor jurado puede analizar su caso personalmente —documento, plazo y validez oficial ante el organismo de destino— sin compromiso.
Responda a este correo o escríbanos por WhatsApp y lo vemos hoy mismo.${link}
Atentamente, Juan Silva — Traductor Jurado (MAEC).`,
  };
}

/** Texto de WhatsApp equivalente (para leads sin email entregable). */
export function buildWhatsAppTranslatorReviewText(data: {
  name: string;
  lang?: CaptureLang;
  payUrl?: string | null;
}) {
  const lang = data.lang || "es";
  const link = data.payUrl ? ` ${data.payUrl}` : "";
  if (lang === "fr") {
    return `Bonjour ${data.name}, équipe de TraduccionesJuradas.net. Nous avons préparé votre devis de traduction assermentée mais il n'a pas été consulté. Souhaitez-vous qu'un traducteur assermenté étudie votre dossier personnellement ? Nous répondons aujourd'hui.${link}`;
  }
  if (lang === "en") {
    return `Hi ${data.name}, this is the TraduccionesJuradas.net team. We prepared your sworn translation quote but it looks like you haven't seen it. Would you like a sworn translator to review your case personally? We'll reply today.${link}`;
  }
  return `Hola ${data.name}, soy del equipo de TraduccionesJuradas.net. Preparamos su presupuesto de traducción jurada pero no nos consta que lo viera. ¿Quiere que un traductor jurado revise su caso personalmente? Le respondemos hoy.${link}`;
}
