// lib/emails/quote-followup.ts — Email follow-up tras presupuesto IA
import { sendMail } from "@/lib/azure-mail";

const BRAND_HOME_URL = "https://www.traduccionesjuradas.net";
const BRAND_LOGO_URL = `${BRAND_HOME_URL}/brand/logo-horizontal.svg`;

function wrapHtml(content: string) {
  return `
    <div style="background:#f8fafc; padding:24px 12px;">
      <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:22px;">
        <div style="margin-bottom:14px;">
          <a href="${BRAND_HOME_URL}" style="text-decoration:none;" target="_blank" rel="noopener noreferrer">
            <img src="${BRAND_LOGO_URL}" alt="Traducciones Juradas" style="height:44px; width:auto; max-width:240px;" />
          </a>
        </div>
        <div style="font-family:Arial, sans-serif; color:#0f172a; font-size:15px; line-height:1.45;">
          ${content}
        </div>
        <hr style="margin:18px 0 12px 0; border:0; border-top:1px solid #e2e8f0;" />
        <p style="margin:0; font-family:Arial, sans-serif; font-size:12px; color:#64748b;">
          TraduccionesJuradas.net &middot; M&aacute;laga &middot;
          <a href="mailto:hola@traduccionesjuradas.net" style="color:#0f6b66; text-decoration:none;">hola@traduccionesjuradas.net</a>
          &middot; <a href="tel:+34951333614" style="color:#0f6b66; text-decoration:none;">951 333 614</a>
        </p>
      </div>
    </div>
  `;
}

export type QuoteFollowupData = {
  email: string;
  // Opcional: la puerta captura el email pero NO el nombre. Exigirlo mantenía
  // este email muerto justo para sus leads (el gate era `email && name`).
  name?: string | null;
  documentType: string;
  price: number;
  totalPrice: number;
  langPair: string;
  estimatedDays: string;
  apostilleSurcharge?: number;
};

export async function sendQuoteFollowupEmail(data: QuoteFollowupData) {
  const ivaAmount = Math.round((data.totalPrice - data.price) * 100) / 100;
  const subject = `Tu presupuesto de traducción jurada — ${data.totalPrice.toFixed(2)} EUR`;

  const html = wrapHtml(`
    <h2 style="margin:0 0 8px 0; font-size:20px; color:#0f172a;">Tu presupuesto está listo</h2>
    <p>${data.name?.trim() ? `Hola ${data.name.trim()},` : "Hola,"}</p>
    <p>Hemos analizado tu documento con IA y este es tu presupuesto:</p>

    <table style="border-collapse:collapse; margin:16px 0; width:100%;">
      <tr style="background:#f1f5f9;">
        <td style="padding:8px 12px; font-weight:600; border:1px solid #e2e8f0;">Documento</td>
        <td style="padding:8px 12px; border:1px solid #e2e8f0;">${data.documentType}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px; font-weight:600; border:1px solid #e2e8f0;">Combinación</td>
        <td style="padding:8px 12px; border:1px solid #e2e8f0;">${data.langPair}</td>
      </tr>
      <tr style="background:#f1f5f9;">
        <td style="padding:8px 12px; font-weight:600; border:1px solid #e2e8f0;">Plazo estimado</td>
        <td style="padding:8px 12px; border:1px solid #e2e8f0;">${data.estimatedDays}</td>
      </tr>
      ${data.apostilleSurcharge ? `<tr>
        <td style="padding:8px 12px; font-weight:600; border:1px solid #e2e8f0;">Apostilla de La Haya</td>
        <td style="padding:8px 12px; border:1px solid #e2e8f0;">${data.apostilleSurcharge.toFixed(2)} &euro; (incluido)</td>
      </tr>` : ""}
    </table>

    <div style="text-align:center; margin:20px 0; padding:20px; background:#f0fdfa; border:1px solid #99f6e4; border-radius:12px;">
      <p style="margin:0 0 4px 0; font-size:14px; color:#64748b;">Base imponible: ${data.price.toFixed(2)} &euro; &middot; IVA (21%): ${ivaAmount.toFixed(2)} &euro;</p>
      <p style="margin:0 0 4px 0; font-size:32px; font-weight:700; color:#0f766e;">${data.totalPrice.toFixed(2)} &euro;</p>
      <p style="margin:0; font-size:13px; color:#64748b;">IVA incluido &middot; Precio cerrado</p>
    </div>

    <p style="text-align:center;">
      <a href="${BRAND_HOME_URL}/presupuesto-instantaneo" style="display:inline-block; background:#0f766e; color:#ffffff; padding:12px 28px; border-radius:8px; text-decoration:none; font-weight:600; font-size:15px;">
        Continuar con mi pedido
      </a>
    </p>

    <p style="font-size:13px; color:#64748b; margin-top:16px;">
      Si tienes cualquier duda, responde a este correo o escr&iacute;benos por
      <a href="https://wa.me/34951333614" style="color:#0f766e; text-decoration:none;">WhatsApp</a>.
    </p>

    <p>Gracias por confiar en nosotros.<br/>Equipo de traduccionesjuradas.net</p>
  `);

  await sendMail({
    to: data.email,
    subject,
    html,
  });
}
