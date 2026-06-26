// lib/email.ts
import fs from "fs";
import path from "path";
import { WHATSAPP_DISPLAY, buildWhatsAppLinkFromText, SITE_BASE_URL } from "@/lib/contact";
import { sendMail } from "@/lib/azure-mail";
import type { MailAttachment } from "@/lib/azure-mail";

export type PresupuestoPayload = {
  documentos: Array<{
    tipo: string;
    tipoLabel: string;
    combinacion: string;
    palabras: number;
    precioEstimado: number;
    archivoNombre?: string;
    sinPrecio?: boolean;
    precioFijo?: boolean;
  }>;
  contacto: {
    email: string;
    telefono?: string;
    fechaLimite?: string;
    notas?: string;
  };
  metadata: {
    idioma: string;
    paginaOrigen: string;
    timestamp: string;
  };
  referencia?: string;
  orderReference?: string;
  quoteId?: string;
  website?: string;
};

const BRAND_HOME_URL = "https://www.traduccionesjuradas.net";
const BRAND_LOGO_URL = `${BRAND_HOME_URL}/brand/logo-horizontal.svg`;

export function wrapClientEmailHtml(content: string) {
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
          TraduccionesJuradas.net · Málaga ·
          <a href="mailto:hola@traduccionesjuradas.net" style="color:#0f6b66; text-decoration:none;">hola@traduccionesjuradas.net</a>
          · <a href="tel:+34951333614" style="color:#0f6b66; text-decoration:none;">951 333 614</a>
        </p>
      </div>
    </div>
  `;
}

export async function sendPresupuestoEmail(payload: PresupuestoPayload) {
  const to = process.env.PRESUPUESTO_TO;
  if (!to) throw new Error("Missing PRESUPUESTO_TO");

  const total = payload.documentos.reduce((s, d) => s + d.precioEstimado, 0).toFixed(2);
  const subject = `Solicitud estimador ${payload.referencia} — ${payload.contacto.email}`;

  const docsHtmlRows = payload.documentos
    .map(
      (d) =>
        `<tr><td style="padding:4px 8px; border:1px solid #e2e8f0;">${d.tipoLabel}</td><td style="padding:4px 8px; border:1px solid #e2e8f0;">${d.combinacion}</td><td style="padding:4px 8px; border:1px solid #e2e8f0; text-align:right;">~${d.palabras}</td><td style="padding:4px 8px; border:1px solid #e2e8f0; text-align:right;">~${d.precioEstimado.toFixed(2)} EUR</td></tr>`
    )
    .join("");

  const baseUrl = "https://www.traduccionesjuradas.net";
  const quoteLink = payload.quoteId
    ? `<p><a href="${baseUrl}/admin/quotes/${payload.quoteId}" style="display:inline-block; background:#0891b2; color:#fff; padding:10px 24px; border-radius:8px; text-decoration:none; font-weight:600;">Revisar presupuesto y enviar</a></p>`
    : `<p><a href="${baseUrl}/zona-traductor" style="display:inline-block; background:#0891b2; color:#fff; padding:10px 24px; border-radius:8px; text-decoration:none; font-weight:600;">Abrir zona operativa</a></p>`;

  const html = `
    <h2>Solicitud desde estimador — ${payload.referencia}</h2>
    <p><strong>Email:</strong> ${payload.contacto.email}</p>
    <p><strong>Teléfono:</strong> ${payload.contacto.telefono || "-"}</p>
    <p><strong>Fecha límite:</strong> ${payload.contacto.fechaLimite || "-"}</p>
    <p><strong>Idioma:</strong> ${payload.metadata.idioma} · <strong>Página:</strong> ${payload.metadata.paginaOrigen}</p>
    <table style="border-collapse:collapse; margin:12px 0; font-size:14px;">
      <tr style="background:#f1f5f9;"><th style="padding:4px 8px; border:1px solid #e2e8f0; text-align:left;">Tipo</th><th style="padding:4px 8px; border:1px solid #e2e8f0;">Combinación</th><th style="padding:4px 8px; border:1px solid #e2e8f0;">Palabras</th><th style="padding:4px 8px; border:1px solid #e2e8f0;">Precio est.</th></tr>
      ${docsHtmlRows}
    </table>
    <p><strong>Total estimado:</strong> ~${total} EUR</p>
    <p><strong>Notas:</strong> ${payload.contacto.notas || "-"}</p>
    ${quoteLink}
  `;

  await sendMail({
    to,
    replyTo: payload.contacto.email,
    subject,
    html,
  });
}

export async function sendPresupuestoConfirmationEmail(payload: PresupuestoPayload) {
  const toUser = payload.contacto.email;
  if (!toUser) return;
  const bccInternal = process.env.PRESUPUESTO_TO;

  const subject = `Solicitud ${payload.referencia} recibida — Traducciones Juradas`;
  const total = payload.documentos.reduce((s, d) => s + d.precioEstimado, 0).toFixed(2);
  const whatsapp = buildWhatsAppLinkFromText("Hola necesito un presupuesto");

  const docsHtmlRows = payload.documentos
    .map(
      (d) =>
        `<tr><td style="padding:4px 8px; border:1px solid #e2e8f0;">${d.tipoLabel}</td><td style="padding:4px 8px; border:1px solid #e2e8f0;">${d.combinacion}</td><td style="padding:4px 8px; border:1px solid #e2e8f0; text-align:right;">~${d.palabras}</td><td style="padding:4px 8px; border:1px solid #e2e8f0; text-align:right;">~${d.precioEstimado.toFixed(2)} EUR</td></tr>`
    )
    .join("");

  const signatureHtml = `
    <p style="margin:12px 0 4px 0;"><strong>Juan Silva Moreno</strong><br/>
    Jefe de proyectos · Traductor jurado de francés (Nº3850)<br/>
    HBTJ Consultores Lingüísticos S.L. · CIF B93712784<br/>
    Calle Esperanto, 9 · 29007 Málaga<br/>
    Tel: <a href="tel:+34951333614">${WHATSAPP_DISPLAY}</a></p>
    <p style="font-size:12px; color:#6b7280; margin:8px 0 0 0;"><strong>NOTA LEGAL</strong> – Este documento se dirige exclusivamente a su destinatario y puede contener información confidencial sometida a secreto profesional. Si no es el destinatario autorizado, su uso o divulgación está prohibido; por favor comuníquelo y destrúyalo. Las comunicaciones por email pueden ser modificadas o interceptadas; el remitente no asume responsabilidad por errores u omisiones.</p>
    <p style="font-size:12px; color:#6b7280; margin:6px 0 0 0;"><strong>Protección de datos:</strong> Los datos se incorporan a un fichero responsabilidad de HBTJ Consultores Lingüísticos S.L. para gestionar su encargo y comunicaciones. Puede ejercer derechos de acceso, rectificación, supresión y oposición en Calle Esperanto, 9 · 29007 Málaga o en <a href="mailto:hola@traduccionesjuradas.net">hola@traduccionesjuradas.net</a>.</p>
  `;

  const html = `
    <div style="margin-bottom:12px;">
      <img src="cid:logo-tj" alt="TraduccionesJuradas.net" style="height:46px; max-width:180px;" />
    </div>
    <h2>Solicitud ${payload.referencia} recibida</h2>
    <p>Hola,</p>
    <p>Hemos recibido tu solicitud. Este es el resumen:</p>
    <table style="border-collapse:collapse; margin:12px 0; font-size:14px;">
      <tr style="background:#f1f5f9;"><th style="padding:4px 8px; border:1px solid #e2e8f0; text-align:left;">Tipo</th><th style="padding:4px 8px; border:1px solid #e2e8f0;">Combinación</th><th style="padding:4px 8px; border:1px solid #e2e8f0;">Palabras</th><th style="padding:4px 8px; border:1px solid #e2e8f0;">Precio est.</th></tr>
      ${docsHtmlRows}
    </table>
    <p><strong>Total estimado:</strong> ~${total} EUR <span style="color:#6b7280;">(IVA incluido · precio final tras revisión)</span></p>
    <p>Horario de respuesta: <strong>09:00 a 19:00 CET</strong>. Respondemos normalmente en menos de 2 horas laborables.</p>
    <p>Si es urgente, contáctanos por <a href="${whatsapp}">WhatsApp</a>.</p>
    <p><a href="https://www.traduccionesjuradas.net/consulta" style="display:inline-block; background:#0f766e; color:#fff; padding:10px 24px; border-radius:8px; text-decoration:none; font-weight:600; margin:8px 0;">Consultar estado de mi solicitud</a></p>
    <p>Gracias por confiar en nosotros.<br/>Equipo de traduccionesjuradas.net</p>
    <div style="margin:12px 0;">
      <img src="cid:sello-ministerio" alt="Traductores jurados nombrados por el Ministerio" style="max-width:220px; height:auto;" />
    </div>
    <hr style="margin:12px 0; border:0; border-top:1px solid #e5e7eb;" />
    ${signatureHtml}
  `;

  // Inline attachments
  const attachments: MailAttachment[] = [];
  const logoPath = path.join(process.cwd(), "public", "brand", "logo-horizontal.svg");
  const sealPath = path.join(process.cwd(), "public", "sello-ministerio.jpg");

  try {
    const logoContent = fs.readFileSync(logoPath).toString("base64");
    attachments.push({
      name: "logo-horizontal.svg",
      contentType: "image/svg+xml",
      contentBytes: logoContent,
      isInline: true,
      contentId: "logo-tj",
    });
  } catch (_e) {
    // optional
  }

  try {
    const sealContent = fs.readFileSync(sealPath).toString("base64");
    attachments.push({
      name: "sello-ministerio.jpg",
      contentType: "image/jpeg",
      contentBytes: sealContent,
      isInline: true,
      contentId: "sello-ministerio",
    });
  } catch (_e) {
    // optional
  }

  await sendMail({
    to: toUser,
    bcc: bccInternal ? [bccInternal] : undefined,
    subject,
    html,
    attachments: attachments.length > 0 ? attachments : undefined,
  });
}

// Compone (sin enviar) el email de "traducción lista". Separado del envío para
// poder registrar de forma SÍNCRONA en OrderEvent el contenido EXACTO que se
// manda al cliente: en serverless el envío de fondo puede no completarse, y el
// registro de "qué se envió" no debe depender de él.
export function buildTranslationReadyEmail(data: {
  reference: string;
  downloadUrl: string;
  statusUrl?: string;
  lang?: "es" | "fr";
  translationAttached?: boolean;
  invoiceAttached?: boolean;
}): { subject: string; html: string } {
  const fr = data.lang === "fr";
  // Ficha de Google de HBTJ (CID de la URL de Maps). El env puede sobreescribirlo
  // (p.ej. con el enlace corto g.page/r/.../review para reseña de un clic), pero
  // solo si es una URL http válida; si no, se usa el fallback fiable.
  const envReview = (process.env.NEXT_PUBLIC_GOOGLE_REVIEWS_URL_TJ || "").trim();
  const reviewUrl = envReview.startsWith("http")
    ? envReview
    : "https://www.google.com/maps?cid=1858671208989418611";

  // Enlace de reseña directo y prominente.
  const reviewBlock = reviewUrl
    ? (fr
        ? `<p style="margin-top:20px;">Merci de laisser un commentaire sur notre travail, cela nous aide énormément :</p>
           <p><a href="${reviewUrl}" style="display:inline-block; background:#059669; color:#fff; padding:11px 26px; border-radius:8px; text-decoration:none; font-weight:600;">⭐ Laisser un avis Google</a></p>`
        : `<p style="margin-top:20px;">Gracias por dejar un comentario sobre nuestro trabajo, nos ayuda muchísimo:</p>
           <p><a href="${reviewUrl}" style="display:inline-block; background:#059669; color:#fff; padding:11px 26px; border-radius:8px; text-decoration:none; font-weight:600;">⭐ Dejar una reseña en Google</a></p>`)
    : "";

  const attachLine = data.translationAttached
    ? (fr
        ? `<p><strong>Vous trouverez votre traduction assermentée en pièce jointe${data.invoiceAttached ? ", ainsi que votre facture" : ""}.</strong></p>`
        : `<p><strong>Adjuntamos tu traducción jurada${data.invoiceAttached ? " y tu factura" : ""} en este correo.</strong></p>`)
    : "";

  const backupLink = data.translationAttached
    ? (fr
        ? `<p style="font-size:13px; color:#6b7280;">Lien de téléchargement (sauvegarde) : <a href="${data.downloadUrl}">${data.downloadUrl}</a></p>`
        : `<p style="font-size:13px; color:#6b7280;">Enlace de descarga (por si acaso): <a href="${data.downloadUrl}">${data.downloadUrl}</a></p>`)
    : (fr
        ? `<p>Vous pouvez télécharger votre fichier ici : <a href="${data.downloadUrl}">${data.downloadUrl}</a></p>`
        : `<p>Puedes descargar tu archivo desde este enlace: <a href="${data.downloadUrl}">${data.downloadUrl}</a></p>`);

  const statusLine = data.statusUrl
    ? (fr
        ? `<p style="font-size:13px; color:#6b7280;">Vous pouvez aussi <a href="${data.statusUrl}">suivre l'état de votre commande</a>.</p>`
        : `<p style="font-size:13px; color:#6b7280;">También puedes <a href="${data.statusUrl}">ver el estado de tu pedido</a>.</p>`)
    : "";

  const invoiceNote = data.invoiceAttached
    ? ""
    : (fr
        ? `<p>Si vous avez besoin d'une facture ou d'un envoi papier, répondez à cet e-mail.</p>`
        : `<p>Si necesitas factura o envío en papel, responde a este correo.</p>`);

  const html = fr
    ? `
      <h2>Votre traduction assermentée est prête</h2>
      <p>Référence : <strong>${data.reference}</strong></p>
      ${attachLine}
      ${backupLink}
      ${statusLine}
      ${invoiceNote}
      ${reviewBlock}
    `
    : `
      <h2>Tu traducción jurada está lista</h2>
      <p>Referencia: <strong>${data.reference}</strong></p>
      ${attachLine}
      ${backupLink}
      ${statusLine}
      ${invoiceNote}
      ${reviewBlock}
    `;

  const subject = fr
    ? `Votre traduction assermentée est prête (${data.reference})`
    : `Tu traducción jurada está lista (${data.reference})`;
  return { subject, html: wrapClientEmailHtml(html) };
}

export async function sendTranslationReadyEmail(data: {
  toEmail: string;
  reference: string;
  downloadUrl: string;
  statusUrl?: string;
  lang?: "es" | "fr";
  attachments?: MailAttachment[];
  translationAttached?: boolean;
  invoiceAttached?: boolean;
}): Promise<{ subject: string; html: string }> {
  const composed = buildTranslationReadyEmail(data);
  await sendMail({
    to: data.toEmail,
    subject: composed.subject,
    html: composed.html,
    attachments: data.attachments && data.attachments.length > 0 ? data.attachments : undefined,
  });
  return composed;
}

export async function sendInvoiceRequestEmail(data: {
  reference: string;
  title: string;
  amountCents: number;
  clientEmail: string;
  billing: {
    fiscalName: string;
    nif: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
    email: string;
  };
}) {
  const to = process.env.PRESUPUESTO_TO;
  if (!to) throw new Error("Missing PRESUPUESTO_TO");

  const amount = (data.amountCents / 100).toFixed(2);
  const subject = `Solicitud de factura - ${data.reference}`;

  const html = `
    <h2>Solicitud de factura</h2>
    <p><strong>Pedido:</strong> ${data.reference} - ${data.title}</p>
    <p><strong>Importe:</strong> ${amount} EUR</p>
    <p><strong>Cliente:</strong> ${data.clientEmail}</p>
    <h3>Datos fiscales</h3>
    <ul>
      <li><strong>Nombre fiscal:</strong> ${data.billing.fiscalName}</li>
      <li><strong>NIF/CIF:</strong> ${data.billing.nif}</li>
      <li><strong>Direccion:</strong> ${data.billing.address}</li>
      <li><strong>Ciudad:</strong> ${data.billing.city}</li>
      <li><strong>Codigo postal:</strong> ${data.billing.postalCode}</li>
      <li><strong>Pais:</strong> ${data.billing.country}</li>
      <li><strong>Email factura:</strong> ${data.billing.email}</li>
    </ul>
  `;

  await sendMail({ to, subject, html });
}

export async function sendOrderCreatedEmail(data: {
  toEmail: string;
  clientName?: string;
  reference: string;
  title: string;
  amountCents: number;
  paymentUrl: string;
  lang?: "es" | "fr";
}): Promise<{ messageId: string | null; subject: string }> {
  const amount = (data.amountCents / 100).toFixed(2);
  const name = data.clientName || "";
  const fr = data.lang === "fr";

  const subject = fr
    ? `Commande ${data.reference} enregistrée - Traductions Assermentées`
    : `Pedido ${data.reference} creado - Traducciones Juradas`;

  const html = fr
    ? `
    <h2>Commande enregistrée</h2>
    <p>Bonjour ${name},</p>
    <p>Nous avons bien enregistré votre commande. Voici le récapitulatif :</p>
    <table style="border-collapse:collapse; margin:12px 0;">
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Référence</td><td>${data.reference}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Objet</td><td>${data.title}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Montant</td><td>${amount} EUR</td></tr>
    </table>
    <p><a href="${data.paymentUrl}" style="display:inline-block; background:#059669; color:#fff; padding:10px 24px; border-radius:8px; text-decoration:none; font-weight:600;">Procéder au paiement</a></p>
    <p style="font-size:13px; color:#6b7280;">Vous pouvez aussi consulter l'état de votre commande sur <a href="https://www.traduccionesjuradas.net/consulta">traduccionesjuradas.net/consulta</a> avec votre référence et votre e-mail.</p>
    <p>Merci de votre confiance.<br/>L'équipe de traduccionesjuradas.net</p>
  `
    : `
    <h2>Pedido registrado</h2>
    <p>Hola ${name},</p>
    <p>Hemos registrado tu pedido correctamente. Aqui tienes el resumen:</p>
    <table style="border-collapse:collapse; margin:12px 0;">
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Referencia</td><td>${data.reference}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Concepto</td><td>${data.title}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Importe</td><td>${amount} EUR</td></tr>
    </table>
    <p><a href="${data.paymentUrl}" style="display:inline-block; background:#059669; color:#fff; padding:10px 24px; border-radius:8px; text-decoration:none; font-weight:600;">Ir al pago</a></p>
    <p style="font-size:13px; color:#6b7280;">Tambien puedes consultar el estado de tu pedido en <a href="https://www.traduccionesjuradas.net/consulta">traduccionesjuradas.net/consulta</a> con tu referencia y email.</p>
    <p>Gracias por confiar en nosotros.<br/>Equipo de traduccionesjuradas.net</p>
  `;

  await sendMail({
    to: data.toEmail,
    subject,
    html: wrapClientEmailHtml(html),
  });

  // Graph API does not return a message ID
  return { messageId: null, subject };
}

export async function sendPaymentConfirmedEmail(data: {
  toEmail: string;
  reference: string;
  title: string;
  amountCents: number;
  method: string;
  lang?: "es" | "fr";
}) {
  const amount = (data.amountCents / 100).toFixed(2);
  const fr = data.lang === "fr";
  const methodLabels: Record<string, Record<string, string>> = {
    es: { REDSYS: "Tarjeta bancaria", PAYPAL: "PayPal", BIZUM: "Bizum", TRANSFER: "Transferencia bancaria", STRIPE: "Tarjeta (Stripe)" },
    fr: { REDSYS: "Carte bancaire", PAYPAL: "PayPal", BIZUM: "Bizum", TRANSFER: "Virement bancaire", STRIPE: "Carte (Stripe)" },
  };
  const methodLabel = methodLabels[fr ? "fr" : "es"][data.method] || data.method;

  if (fr) {
    const html = `
      <h2>Paiement confirmé</h2>
      <p>Nous avons bien reçu votre paiement.</p>
      <table style="border-collapse:collapse; margin:12px 0;">
        <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Référence</td><td>${data.reference}</td></tr>
        <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Objet</td><td>${data.title}</td></tr>
        <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Montant</td><td>${amount} EUR</td></tr>
        <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Mode de paiement</td><td>${methodLabel}</td></tr>
      </table>
      <p><a href="https://www.traduccionesjuradas.net/consulta" style="display:inline-block; background:#059669; color:#fff; padding:10px 24px; border-radius:8px; text-decoration:none; font-weight:600;">Suivre l'état de ma commande</a></p>
      <p style="font-size:13px; color:#6b7280;">Utilisez votre référence <strong>${data.reference}</strong> et votre e-mail pour suivre l'état.</p>
      <p>Nous vous préviendrons dès que votre traduction sera prête.</p>
      <p>Merci de votre confiance.<br/>L'équipe de traduccionesjuradas.net</p>
    `;
    await sendMail({ to: data.toEmail, subject: `Paiement confirmé - Commande ${data.reference}`, html: wrapClientEmailHtml(html) });
    return;
  }

  const html = `
    <h2>Pago confirmado</h2>
    <p>Hemos recibido tu pago correctamente.</p>
    <table style="border-collapse:collapse; margin:12px 0;">
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Referencia</td><td>${data.reference}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Concepto</td><td>${data.title}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Importe</td><td>${amount} EUR</td></tr>
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Metodo</td><td>${methodLabel}</td></tr>
    </table>
    <p><a href="https://www.traduccionesjuradas.net/consulta" style="display:inline-block; background:#059669; color:#fff; padding:10px 24px; border-radius:8px; text-decoration:none; font-weight:600;">Consultar estado de mi pedido</a></p>
    <p style="font-size:13px; color:#6b7280;">Usa tu referencia <strong>${data.reference}</strong> y tu email para consultar el estado.</p>
    <p>Te avisaremos cuando tu traduccion este lista.</p>
    <p>Gracias por confiar en nosotros.<br/>Equipo de traduccionesjuradas.net</p>
  `;

  await sendMail({
    to: data.toEmail,
    subject: `Pago confirmado - Pedido ${data.reference}`,
    html: wrapClientEmailHtml(html),
  });
}

export async function sendShipmentNotificationEmail(data: {
  toEmail: string;
  reference: string;
  trackingNumber: string;
  courier?: string | null;
  lang?: "es" | "fr";
}) {
  const fr = data.lang === "fr";
  const courier = (data.courier || "").trim();
  const tracking = data.trackingNumber.trim();

  if (fr) {
    const html = `
      <h2>Votre traduction assermentée est en route</h2>
      <p>Nous avons expédié votre traduction assermentée en papier.</p>
      <table style="border-collapse:collapse; margin:12px 0;">
        <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Commande</td><td>${data.reference}</td></tr>
        ${courier ? `<tr><td style="padding:4px 12px 4px 0; font-weight:600;">Transporteur</td><td>${courier}</td></tr>` : ""}
        <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Numéro de suivi</td><td><strong>${tracking}</strong></td></tr>
      </table>
      <p style="font-size:13px; color:#6b7280;">Vous pouvez suivre l'envoi avec ce numéro auprès du transporteur.</p>
      <p>Merci de votre confiance.<br/>L'équipe de traduccionesjuradas.net</p>
    `;
    await sendMail({ to: data.toEmail, subject: `Votre traduction est en route - Commande ${data.reference}`, html: wrapClientEmailHtml(html) });
    return;
  }

  const html = `
    <h2>Tu traducción jurada va de camino</h2>
    <p>Hemos enviado tu traducción jurada en papel por mensajería.</p>
    <table style="border-collapse:collapse; margin:12px 0;">
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Pedido</td><td>${data.reference}</td></tr>
      ${courier ? `<tr><td style="padding:4px 12px 4px 0; font-weight:600;">Transportista</td><td>${courier}</td></tr>` : ""}
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Nº de seguimiento</td><td><strong>${tracking}</strong></td></tr>
    </table>
    <p style="font-size:13px; color:#6b7280;">Puedes seguir el envío con este número en la web del transportista.</p>
    <p>Gracias por confiar en nosotros.<br/>Equipo de traduccionesjuradas.net</p>
  `;

  await sendMail({
    to: data.toEmail,
    subject: `Tu traducción va de camino - Pedido ${data.reference}`,
    html: wrapClientEmailHtml(html),
  });
}

export async function sendClientAccessLinkEmail(data: { toEmail: string; url: string }) {
  const html = `
    <h2>Tu acceso a la zona de cliente</h2>
    <p>Pulsa el botón para entrar a tu zona, donde tienes <strong>presupuestos, pedidos, facturas y descargas</strong> en un solo sitio.</p>
    <p style="margin:16px 0;"><a href="${data.url}" style="display:inline-block; background:#0f766e; color:#fff; padding:10px 24px; border-radius:8px; text-decoration:none; font-weight:600;">Entrar en mi zona de cliente</a></p>
    <p style="font-size:13px; color:#6b7280;">El enlace es personal e intransferible y caduca en 30 días. Si no lo solicitaste, ignora este correo.</p>
  `;
  await sendMail({
    to: data.toEmail,
    subject: "Tu acceso a la zona de cliente — Traducciones Juradas",
    html: wrapClientEmailHtml(html),
  });
}

export async function sendNewOrderStaffEmail(data: {
  reference: string;
  title: string;
  amountCents: number;
  clientEmail: string;
  langPair?: string;
}) {
  const to = process.env.PRESUPUESTO_TO;
  if (!to) throw new Error("Missing PRESUPUESTO_TO");

  const amount = (data.amountCents / 100).toFixed(2);
  const subject = `Nuevo pedido ${data.reference} - ${amount} EUR`;

  const html = `
    <h2>Nuevo pedido</h2>
    <table style="border-collapse:collapse; margin:12px 0;">
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Referencia</td><td>${data.reference}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Concepto</td><td>${data.title}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Idiomas</td><td>${data.langPair || "-"}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Importe</td><td>${amount} EUR</td></tr>
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Cliente</td><td>${data.clientEmail}</td></tr>
    </table>
    <p><a href="https://www.traduccionesjuradas.net/zona-traductor" style="display:inline-block; background:#0891b2; color:#fff; padding:10px 24px; border-radius:8px; text-decoration:none; font-weight:600;">Ver zona traductor</a></p>
  `;

  await sendMail({ to, subject, html });
}

export async function sendOrderReviewRoutingEmail(data: {
  reference: string;
  title: string;
  amountCents: number;
  clientEmail: string;
  langPair?: string | null;
  flowProfile: string;
  reviewers: string[];
  pmEmail?: string | null;
  urgencyNotes?: string | null;
  reviewReason?: string | null;
  quoteId?: string;
}) {
  const toRecipients = data.reviewers.filter(Boolean);
  if (toRecipients.length === 0) {
    throw new Error("Missing review recipients");
  }

  const amount = (data.amountCents / 100).toFixed(2);
  const baseUrl = "https://www.traduccionesjuradas.net";
  const hasQuote = Boolean(data.quoteId);
  const subject = hasQuote
    ? `Nuevo pedido ${data.reference} — Presupuesto listo para revisar`
    : `Revision interna requerida - ${data.reference}`;
  const ctaUrl = hasQuote
    ? `${baseUrl}/admin/quotes/${data.quoteId}`
    : `${baseUrl}/zona-traductor`;
  const ctaLabel = hasQuote ? "Revisar presupuesto y enviar" : "Abrir zona operativa";

  const quoteHtml = hasQuote
    ? `<p style="margin:12px 0; padding:10px; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:8px; font-size:14px; color:#065f46;">Se ha generado un presupuesto automatico. Revisalo y haz clic en <strong>Enviar</strong>.</p>`
    : "";
  const html = `
    <h2>Pedido en revisión interna</h2>
    <table style="border-collapse:collapse; margin:12px 0;">
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Referencia</td><td>${data.reference}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Cliente</td><td>${data.clientEmail}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Concepto</td><td>${data.title}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Idiomas</td><td>${data.langPair || "-"}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Importe estimado</td><td>${amount} EUR</td></tr>
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Flujo</td><td>${data.flowProfile}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Motivo</td><td>${data.reviewReason || "Revision operativa previa al cobro"}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Urgencia</td><td>${data.urgencyNotes || "—"}</td></tr>
    </table>
    ${quoteHtml}
    <p><a href="${ctaUrl}" style="display:inline-block; background:#0891b2; color:#fff; padding:10px 24px; border-radius:8px; text-decoration:none; font-weight:600;">${ctaLabel}</a></p>
  `;

  await sendMail({
    to: toRecipients,
    cc: data.pmEmail ? [data.pmEmail] : undefined,
    subject,
    html,
  });
}

export async function sendOrderUnderReviewClientEmail(data: {
  toEmail: string;
  clientName?: string;
  reference: string;
  title: string;
  amountCents: number;
}) {
  const amount = (data.amountCents / 100).toFixed(2);
  const subject = `Pedido ${data.reference} en revisión interna`;
  const name = data.clientName || "";

  const html = `
    <h2>Pedido recibido</h2>
    <p>Hola ${name},</p>
    <p>Hemos recibido tu pedido y ahora mismo está en <strong>revisión interna</strong> antes de habilitar el pago.</p>
    <table style="border-collapse:collapse; margin:12px 0;">
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Referencia</td><td>${data.reference}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Concepto</td><td>${data.title}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Importe estimado</td><td>${amount} EUR</td></tr>
    </table>
    <p>Te avisaremos por email en cuanto esté listo para pago.</p>
    <p><a href="https://www.traduccionesjuradas.net/consulta" style="display:inline-block; background:#0f766e; color:#fff; padding:10px 24px; border-radius:8px; text-decoration:none; font-weight:600;">Consultar estado</a></p>
  `;

  await sendMail({
    to: data.toEmail,
    subject,
    html: wrapClientEmailHtml(html),
  });
}

export async function sendPaymentProofUploadedStaffEmail(data: {
  reference: string;
  title: string;
  amountCents: number;
  clientEmail: string;
  proofUrl: string;
  fileName?: string;
}) {
  const to = process.env.PRESUPUESTO_TO;
  if (!to) throw new Error("Missing PRESUPUESTO_TO");

  const amount = (data.amountCents / 100).toFixed(2);
  const subject = `Comprobante subido - ${data.reference}`;

  const html = `
    <h2>Comprobante de pago recibido</h2>
    <table style="border-collapse:collapse; margin:12px 0;">
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Referencia</td><td>${data.reference}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Concepto</td><td>${data.title}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Importe</td><td>${amount} EUR</td></tr>
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Cliente</td><td>${data.clientEmail}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Archivo</td><td>${data.fileName || "comprobante"}</td></tr>
    </table>
    <p><a href="${data.proofUrl}">Abrir comprobante</a></p>
    <p><a href="https://www.traduccionesjuradas.net/zona-traductor" style="display:inline-block; background:#0891b2; color:#fff; padding:10px 24px; border-radius:8px; text-decoration:none; font-weight:600;">Ver zona traductor</a></p>
  `;

  await sendMail({ to, subject, html });
}

export async function sendTranslatorDeliveredStaffEmail(data: {
  reference: string;
  clientName: string | null;
  filename: string;
  fileUrl: string;
}) {
  const to = process.env.PRESUPUESTO_TO;
  if (!to) throw new Error("Missing PRESUPUESTO_TO");

  const subject = `Traduccion recibida del traductor - ${data.reference}`;
  const workspaceUrl = `https://www.traduccionesjuradas.net/zona-traductor/workspace/${data.reference}`;

  const html = `
    <h2>El traductor entregó la traducción</h2>
    <p>Pendiente de que la <strong>verifiques y la envíes al cliente</strong>.</p>
    <table style="border-collapse:collapse; margin:12px 0;">
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Referencia</td><td>${data.reference}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Cliente</td><td>${data.clientName || "—"}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Archivo</td><td>${data.filename}</td></tr>
    </table>
    <p><a href="${data.fileUrl}">Descargar la traducción</a></p>
    <p><a href="${workspaceUrl}" style="display:inline-block; background:#0891b2; color:#fff; padding:10px 24px; border-radius:8px; text-decoration:none; font-weight:600;">Verificar y enviar al cliente</a></p>
  `;

  await sendMail({ to, subject, html });
}

export async function sendPaymentProofReceivedClientEmail(data: {
  toEmail: string;
  reference: string;
}) {
  const subject = `Comprobante recibido - Pedido ${data.reference}`;

  const html = `
    <h2>Comprobante recibido</h2>
    <p>Hemos recibido tu comprobante de pago para el pedido <strong>${data.reference}</strong>.</p>
    <p>Lo revisaremos y te confirmaremos el pago en cuanto se valide.</p>
    <p><a href="https://www.traduccionesjuradas.net/consulta" style="display:inline-block; background:#059669; color:#fff; padding:10px 24px; border-radius:8px; text-decoration:none; font-weight:600;">Consultar estado</a></p>
  `;

  await sendMail({
    to: data.toEmail,
    subject,
    html: wrapClientEmailHtml(html),
  });
}

export async function sendTranslationEtaEmail(data: {
  toEmail: string;
  reference: string;
  etaDateLabel: string;
  statusUrl?: string;
  lang?: "es" | "fr";
}) {
  const fr = data.lang === "fr";

  if (fr) {
    const statusLine = data.statusUrl
      ? `<p style="font-size:13px; color:#6b7280;">Vous pouvez <a href="${data.statusUrl}">suivre l'état de votre commande</a> à tout moment.</p>`
      : "";
    const html = `
      <h2>Votre traduction est en cours</h2>
      <p>Commande <strong>${data.reference}</strong>.</p>
      <p>Date de livraison estimée : <strong>${data.etaDateLabel}</strong>.</p>
      <p>Nous vous préviendrons dès que le fichier final sera disponible.</p>
      ${statusLine}
    `;
    await sendMail({ to: data.toEmail, subject: `Traduction en cours - livraison estimée ${data.reference}`, html: wrapClientEmailHtml(html) });
    return;
  }

  const statusLine = data.statusUrl
    ? `<p style="font-size:13px; color:#6b7280;">Puedes <a href="${data.statusUrl}">consultar el estado de tu pedido</a> en cualquier momento.</p>`
    : "";

  const html = `
    <h2>Tu traduccion esta en proceso</h2>
    <p>Pedido <strong>${data.reference}</strong>.</p>
    <p>Fecha estimada de entrega: <strong>${data.etaDateLabel}</strong>.</p>
    <p>Te avisaremos cuando el archivo final este disponible.</p>
    ${statusLine}
  `;

  await sendMail({
    to: data.toEmail,
    subject: `Traduccion en curso - ETA ${data.reference}`,
    html: wrapClientEmailHtml(html),
  });
}

export async function sendTranslationStartedAssignedEmail(data: {
  toEmail: string;
  reference: string;
  translatorName: string;
  translatorSwornNumber?: string | null;
  etaDateLabel?: string | null;
  lang?: "es" | "fr";
}) {
  const fr = data.lang === "fr";

  if (fr) {
    const etaLine = data.etaDateLabel
      ? `Date de livraison estimée : ${data.etaDateLabel}`
      : "La date de livraison estimée sera confirmée sous peu.";
    const html = `
      <h2>Votre traduction est en cours</h2>
      <p>Commande <strong>${data.reference}</strong>.</p>
      <p>${etaLine}</p>
      <p><a href="https://www.traduccionesjuradas.net/consulta" style="display:inline-block; background:#0f766e; color:#fff; padding:10px 24px; border-radius:8px; text-decoration:none; font-weight:600;">Suivre l'état</a></p>
    `;
    await sendMail({ to: data.toEmail, subject: `Votre traduction est en cours (${data.reference})`, html: wrapClientEmailHtml(html) });
    return;
  }

  const etaLine = data.etaDateLabel
    ? `Fecha estimada de entrega: ${data.etaDateLabel}`
    : "La fecha estimada de entrega se confirmara en breve.";

  const html = `
    <h2>Tu traduccion ya esta en proceso</h2>
    <p>Pedido <strong>${data.reference}</strong>.</p>
    <p>${etaLine}</p>
    <p><a href="https://www.traduccionesjuradas.net/consulta" style="display:inline-block; background:#0f766e; color:#fff; padding:10px 24px; border-radius:8px; text-decoration:none; font-weight:600;">Consultar estado</a></p>
  `;

  await sendMail({
    to: data.toEmail,
    subject: `Tu traduccion ya esta en proceso (${data.reference})`,
    html: wrapClientEmailHtml(html),
  });
}

export async function sendDocumentResubmissionRequestEmail(data: {
  toEmail: string;
  reference: string;
  reason?: string | null;
  uploadUrl: string;
}) {
  const reason = (data.reason || "").trim();
  const reasonLine = reason
    ? `Motivo detectado por revision: ${reason}`
    : "Motivo detectado por revision: el archivo no es suficientemente legible para traducir con seguridad.";

  const subject = `Necesitamos reenviar el documento - Pedido ${data.reference}`;

  const html = `
    <h2>Necesitamos que reenvies el documento</h2>
    <p>Para continuar con tu pedido <strong>${data.reference}</strong>, necesitamos que vuelvas a subir el documento original con mejor calidad.</p>
    <p><strong>${reasonLine}</strong></p>
    <p>
      <a href="${data.uploadUrl}" style="display:inline-block; background:#0f766e; color:#fff; padding:10px 24px; border-radius:8px; text-decoration:none; font-weight:600;">
        Subir documento de nuevo
      </a>
    </p>
    <p style="font-size:13px; color:#6b7280;">
      Formatos recomendados: PDF o imagen nitida (JPG/PNG), con todo el texto visible.
    </p>
  `;

  await sendMail({
    to: data.toEmail,
    subject,
    html: wrapClientEmailHtml(html),
  });
}

// Mensaje LIBRE del staff al cliente (p.ej. pedir info sobre el documento).
// Texto escrito por Juan en el panel; respeta es/fr y enlaza a la página del pedido.
export async function sendClientMessageEmail(data: {
  toEmail: string;
  reference: string;
  message: string;
  statusUrl: string;
  lang?: "es" | "fr";
}) {
  const fr = data.lang === "fr";
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  const bodyHtml = esc(data.message).replace(/\r?\n/g, "<br>");

  const subject = fr
    ? `Message concernant votre commande ${data.reference}`
    : `Mensaje sobre tu pedido ${data.reference}`;
  const heading = fr ? "Nous avons un message au sujet de votre commande" : "Tenemos un mensaje sobre tu pedido";
  const intro = fr
    ? `Au sujet de votre commande <strong>${data.reference}</strong> :`
    : `Sobre tu pedido <strong>${data.reference}</strong>:`;
  const cta = fr ? "Voir ma commande" : "Ver mi pedido";
  const replyLine = fr
    ? "Vous pouvez répondre directement à cet e-mail."
    : "Puedes responder directamente a este correo.";

  const html = `
    <h2>${heading}</h2>
    <p>${intro}</p>
    <div style="margin:12px 0; padding:12px 16px; border-left:3px solid #0891b2; background:#f0f9ff; color:#0f172a;">${bodyHtml}</div>
    <p>
      <a href="${data.statusUrl}" style="display:inline-block; background:#0891b2; color:#fff; padding:10px 24px; border-radius:8px; text-decoration:none; font-weight:600;">${cta}</a>
    </p>
    <p style="font-size:13px; color:#6b7280;">${replyLine}</p>
  `;

  await sendMail({
    to: data.toEmail,
    subject,
    html: wrapClientEmailHtml(html),
  });
}

export async function sendStaffOtpEmail(data: { toEmail: string; code: string }) {
  const subject = "Codigo de acceso - Zona traductor";

  const html = `
    <h2>Codigo de acceso</h2>
    <p>Tu codigo para entrar en la zona traductor es:</p>
    <p style="font-size:24px; font-weight:700; letter-spacing:2px;">${data.code}</p>
    <p>Caduca en 10 minutos.</p>
  `;

  await sendMail({
    to: data.toEmail,
    subject,
    html,
  });
}

export async function sendProjectManagerFinanceUpdateEmail(data: {
  reference: string;
  clientEmail: string;
  supplierName?: string | null;
  supplierType?: "AUTONOMO" | "EMPRESA" | string | null;
  billingMode?: "PER_ORDER" | "MONTHLY_BATCH" | string | null;
  invoiceNumber?: string | null;
  totalCents?: number | null;
}) {
  const to = process.env.PM_NOTIFICATION_TO || process.env.PRESUPUESTO_TO;
  if (!to) throw new Error("Missing PM_NOTIFICATION_TO or PRESUPUESTO_TO");

  const amount = Number.isFinite(Number(data.totalCents))
    ? `${(Number(data.totalCents) / 100).toFixed(2)} EUR`
    : "N/D";
  const supplierTypeLabel =
    data.supplierType === "AUTONOMO" ? "Autonomo" : data.supplierType === "EMPRESA" ? "Empresa" : "N/D";
  const billingModeLabel =
    data.billingMode === "MONTHLY_BATCH" ? "Lote mensual" : data.billingMode === "PER_ORDER" ? "Por pedido" : "N/D";

  const subject = `Pago proveedor confirmado - ${data.reference}`;

  const html = `
    <h2>Pago a proveedor confirmado</h2>
    <p>Se ha marcado como <strong>PAGADA</strong> la factura del proveedor.</p>
    <table style="border-collapse:collapse; margin:12px 0;">
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Pedido</td><td>${data.reference}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Cliente</td><td>${data.clientEmail}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Proveedor</td><td>${data.supplierName || "N/D"}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Tipo proveedor</td><td>${supplierTypeLabel}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Modalidad factura</td><td>${billingModeLabel}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Factura</td><td>${data.invoiceNumber || "N/D"}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Importe</td><td>${amount}</td></tr>
    </table>
    <p><a href="https://www.traduccionesjuradas.net/zona-traductor" style="display:inline-block; background:#0891b2; color:#fff; padding:10px 24px; border-radius:8px; text-decoration:none; font-weight:600;">Abrir zona traductor</a></p>
  `;

  await sendMail({ to, subject, html });
}

export async function sendLeadReminderEmail(data: {
  toEmail: string;
  clientName?: string | null;
}) {
  const name = data.clientName || "";
  const presupuestoUrl = `${SITE_BASE_URL}/presupuesto-instantaneo`;
  const subject = "Tu presupuesto de traduccion jurada sigue disponible";

  const html = `
    <h2>Tu presupuesto sigue disponible</h2>
    <p>Hola ${name},</p>
    <p>Hace unos dias subiste un documento para obtener un presupuesto de traduccion jurada y no llegaste a completar el pedido.</p>
    <p>Tu presupuesto sigue disponible. Puedes retomarlo en cualquier momento:</p>
    <p><a href="${presupuestoUrl}" style="display:inline-block; background:#059669; color:#fff; padding:10px 24px; border-radius:8px; text-decoration:none; font-weight:600;">Retomar presupuesto</a></p>
    <p style="font-size:13px; color:#6b7280;">Si ya no lo necesitas, simplemente ignora este correo.</p>
    <p>Gracias por confiar en nosotros.<br/>Equipo de traduccionesjuradas.net</p>
  `;

  await sendMail({
    to: data.toEmail,
    subject,
    html: wrapClientEmailHtml(html),
  });
}

export async function sendPaymentReminderEmail(data: {
  toEmail: string;
  reference: string;
  title: string;
  amountCents: number;
  paymentUrl: string;
}) {
  const amount = (data.amountCents / 100).toFixed(2);
  const subject = `Pedido ${data.reference} pendiente de pago`;

  const html = `
    <h2>Pedido pendiente de pago</h2>
    <p>Tu pedido <strong>${data.reference}</strong> esta pendiente de pago.</p>
    <table style="border-collapse:collapse; margin:12px 0;">
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Referencia</td><td>${data.reference}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Concepto</td><td>${data.title}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Importe</td><td>${amount} EUR</td></tr>
    </table>
    <p><a href="${data.paymentUrl}" style="display:inline-block; background:#059669; color:#fff; padding:10px 24px; border-radius:8px; text-decoration:none; font-weight:600;">Completar pago</a></p>
    <p style="font-size:13px; color:#6b7280;">Si ya has realizado el pago, ignora este mensaje.</p>
    <p>Gracias por confiar en nosotros.<br/>Equipo de traduccionesjuradas.net</p>
  `;

  await sendMail({
    to: data.toEmail,
    subject,
    html: wrapClientEmailHtml(html),
  });
}

function alertRecipient() {
  const to =
    process.env.ALERT_EMAIL ||
    process.env.PRESUPUESTO_TO ||
    process.env.EMAIL_FROM ||
    "";
  if (!to) {
    // Nunca debe quedar sin destino: una alerta perdida en silencio fue parte
    // del incidente del webhook roto 2,5 meses. Si esto se loguea, faltan envs.
    console.error(
      "[alertRecipient] CRÍTICO: no hay ALERT_EMAIL / PRESUPUESTO_TO / EMAIL_FROM — la alerta se perderá."
    );
  }
  return to;
}

export async function sendPaymentReconciliationAlertEmail(data: {
  discrepancies: Array<{
    reference: string | null;
    clientEmail: string | null;
    amount: string;
    stripeSessionId: string;
    createdAt: string;
  }>;
}) {
  const to = alertRecipient();
  if (!to) throw new Error("Missing ALERT_EMAIL / PRESUPUESTO_TO");

  const count = data.discrepancies.length;
  const subject = `[Alerta] ${count} pago(s) en Stripe sin pedido en la BD`;

  const rows = data.discrepancies
    .map(
      (d) => `
      <tr>
        <td style="padding:4px 12px 4px 0;">${d.reference || "(sin referencia)"}</td>
        <td style="padding:4px 12px 4px 0;">${d.clientEmail || "-"}</td>
        <td style="padding:4px 12px 4px 0;">${d.amount}</td>
        <td style="padding:4px 12px 4px 0;">${d.createdAt}</td>
        <td style="padding:4px 12px 4px 0; font-family:monospace; font-size:12px;">${d.stripeSessionId}</td>
      </tr>`,
    )
    .join("");

  const html = `
    <h2>Pagos cobrados sin pedido reconciliado</h2>
    <p>El cron de reconciliacion ha detectado ${count} pago(s) confirmado(s) en Stripe sin un pedido en estado PAID en la base de datos. Revisa cada uno:</p>
    <table style="border-collapse:collapse; margin:12px 0; font-size:14px;">
      <tr style="text-align:left; border-bottom:1px solid #e2e8f0;">
        <th style="padding:4px 12px 4px 0;">Referencia</th>
        <th style="padding:4px 12px 4px 0;">Cliente</th>
        <th style="padding:4px 12px 4px 0;">Importe</th>
        <th style="padding:4px 12px 4px 0;">Fecha</th>
        <th style="padding:4px 12px 4px 0;">Stripe session</th>
      </tr>
      ${rows}
    </table>
    <p style="font-size:13px; color:#6b7280;">Si esto se repite, revisa que el endpoint de webhook de Stripe apunte a /api/payment/stripe/webhook.</p>
  `;

  await sendMail({ to, subject, html });
}

export async function sendWebhookFailureAlertEmail(data: {
  reason: string;
  detail?: string;
  source?: string;
}) {
  const to = alertRecipient();
  if (!to) throw new Error("Missing ALERT_EMAIL / PRESUPUESTO_TO");

  const subject = `[Alerta] Fallo en el webhook de pago de Stripe`;
  const html = `
    <h2>El webhook de pago ha fallado</h2>
    <table style="border-collapse:collapse; margin:12px 0;">
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Motivo</td><td>${data.reason}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; font-weight:600;">Origen</td><td>${data.source || "-"}</td></tr>
      ${data.detail ? `<tr><td style="padding:4px 12px 4px 0; font-weight:600;">Detalle</td><td>${data.detail}</td></tr>` : ""}
    </table>
    <p style="font-size:13px; color:#6b7280;">Un pago puede haber quedado sin procesar. El cron de reconciliacion lo detectara igualmente, pero conviene revisarlo cuanto antes.</p>
  `;

  await sendMail({ to, subject, html });
}

export async function sendReviewRequestEmail(data: {
  toEmail: string;
  reference: string;
  reviewUrl: string;
}) {
  const subject = `Tu opinion nos ayuda (${data.reference})`;

  const html = `
    <h2>Tu opinion nos ayuda</h2>
    <p>Gracias por confiar en TraduccionesJuradas.net para tu traduccion jurada.</p>
    <p>Si estas satisfecho con el servicio, nos ayudaria mucho tu valoracion en Google:</p>
    <p><a href="${data.reviewUrl}" style="display:inline-block; background:#059669; color:#fff; padding:10px 24px; border-radius:8px; text-decoration:none; font-weight:600;">Dejar valoracion en Google</a></p>
    <p style="font-size:13px; color:#6b7280;">Gracias por tu tiempo.<br/>Equipo de traduccionesjuradas.net</p>
  `;

  await sendMail({
    to: data.toEmail,
    subject,
    html: wrapClientEmailHtml(html),
  });
}
