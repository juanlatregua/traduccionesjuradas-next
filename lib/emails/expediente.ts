// lib/emails/expediente.ts — Emails del flujo de expediente (4+ documentos)
// Cliente: acuse de recibo con link de consulta.
// Staff: notificación con link para preparar el presupuesto en la zona.

import { sendMail } from "@/lib/azure-mail";
import { wrapClientEmailHtml } from "@/lib/email";

const BASE_URL = "https://www.traduccionesjuradas.net";

export async function sendExpedienteReceiptEmail(data: {
  clientEmail: string;
  clientName: string;
  ref: string;
  token: string;
  documentCount: number;
}) {
  const consultaUrl = `${BASE_URL}/expediente/${data.token}`;
  const html = wrapClientEmailHtml(`
    <h2 style="margin:0 0 10px 0; font-size:19px;">Hemos recibido tu expediente</h2>
    <p>Hola ${data.clientName || ""},</p>
    <p>Hemos recibido tu expediente <strong>${data.ref}</strong> con
    <strong>${data.documentCount} documento${data.documentCount === 1 ? "" : "s"}</strong>.
    Lo estamos revisando y te enviaremos un presupuesto detallado por email lo antes posible.</p>
    <p style="margin:18px 0;">
      <a href="${consultaUrl}" style="display:inline-block; background:#0891b2; color:#fff; padding:11px 26px; border-radius:8px; text-decoration:none; font-weight:600;">Consultar mi expediente</a>
    </p>
    <p style="font-size:13px; color:#475569;">Si necesitas algo urgente, escríbenos por WhatsApp al 951 333 614.</p>
  `);

  await sendMail({
    to: data.clientEmail,
    subject: `Hemos recibido tu expediente ${data.ref} — Traducciones Juradas`,
    html,
  });
}

export async function sendExpedienteStaffEmail(data: {
  ref: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string | null;
  documentCount: number;
  notes?: string | null;
}) {
  const to = process.env.PRESUPUESTO_TO;
  if (!to) {
    console.error("[expediente] Missing PRESUPUESTO_TO, no staff notification sent");
    return;
  }
  const presupuestoUrl = `${BASE_URL}/zona-traductor/presupuesto?exp=${encodeURIComponent(data.ref)}`;
  const html = `
    <h2>Nuevo expediente recibido — ${data.ref}</h2>
    <p><strong>Cliente:</strong> ${data.clientName} (${data.clientEmail})</p>
    <p><strong>Teléfono:</strong> ${data.clientPhone || "-"}</p>
    <p><strong>Documentos:</strong> ${data.documentCount}</p>
    <p><strong>Notas:</strong> ${data.notes || "-"}</p>
    <p style="margin-top:16px;">
      <a href="${presupuestoUrl}" style="display:inline-block; background:#0891b2; color:#fff; padding:10px 24px; border-radius:8px; text-decoration:none; font-weight:600;">Preparar presupuesto</a>
    </p>
  `;
  await sendMail({
    to,
    replyTo: data.clientEmail,
    subject: `Nuevo expediente ${data.ref} — ${data.documentCount} docs — ${data.clientEmail}`,
    html,
  });
}
