// lib/emails/quote-followup.ts — Email follow-up tras presupuesto IA
import { sendMail } from "@/lib/azure-mail";
import { C, SERIF, SITE, emailButton, emailLayout } from "@/lib/email-layout";

const BRAND_HOME_URL = SITE;

function wrapHtml(content: string) {
  return emailLayout({ content });
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
  // Token de lib/puerta-resume-token: el botón reabre la puerta con ESTE documento.
  resumeToken?: string;
};

export async function sendQuoteFollowupEmail(data: QuoteFollowupData) {
  const ivaAmount = Math.round((data.totalPrice - data.price) * 100) / 100;
  const subject = `Tu presupuesto de traducción jurada — ${data.totalPrice.toFixed(2)} EUR`;

  const html = wrapHtml(`
    <h1 style="margin:0 0 16px 0; font-family:${SERIF}; font-weight:normal; font-size:28px; line-height:1.3; color:${C.navy};">Tu presupuesto está listo</h1>
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

    <div style="text-align:center; margin:20px 0; padding:20px; background:${C.white}; border:1px solid ${C.border}; border-radius:10px;">
      <p style="margin:0 0 4px 0; font-size:14px; color:#64748b;">Base imponible: ${data.price.toFixed(2)} &euro; &middot; IVA (21%): ${ivaAmount.toFixed(2)} &euro;</p>
      <p style="margin:0 0 4px 0; font-family:${SERIF}; font-size:32px; color:${C.navy};">${data.totalPrice.toFixed(2)} &euro;</p>
      <p style="margin:0; font-size:13px; color:#64748b;">IVA incluido &middot; Precio cerrado</p>
    </div>

    ${emailButton("Continuar con mi pedido", `${BRAND_HOME_URL}/presupuesto-instantaneo${data.resumeToken ? `?r=${encodeURIComponent(data.resumeToken)}` : ""}`)}

    <p style="font-size:13px; color:#64748b; margin-top:16px;">
      Si tienes cualquier duda, responde a este correo o escr&iacute;benos por
      <a href="https://wa.me/34951333614" style="color:${C.navy};">WhatsApp</a>.
    </p>

    <p>Gracias por confiar en nosotros.<br/>Equipo de traduccionesjuradas.net</p>
  `);

  await sendMail({
    to: data.email,
    subject,
    html,
  });
}
