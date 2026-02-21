// lib/email.ts
import sgMail from "@sendgrid/mail";
import fs from "fs";
import path from "path";

type UploadedFile = {
  name: string;
  type: string;
  size: number;
  contentBase64: string; // base64 SIN prefijo "data:..."
};

export async function sendPresupuestoEmail(data: any, files: UploadedFile[]) {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) throw new Error("Missing SENDGRID_API_KEY");

  const to = process.env.PRESUPUESTO_TO;
  if (!to) throw new Error("Missing PRESUPUESTO_TO");

  const from = process.env.SENDGRID_FROM;
  if (!from) throw new Error("Missing SENDGRID_FROM");

  sgMail.setApiKey(apiKey);

  const subject = `Nueva solicitud de presupuesto - ${
    data?.nombre || "Sin nombre"
  }`;

  const text = `Nombre: ${data?.nombre || "-"}
Email: ${data?.email || "-"}
Teléfono: ${data?.telefono || "-"}
Idioma origen: ${data?.idiomaOrigen || "-"}
Idioma destino: ${data?.idiomaDestino || "-"}
Documento: ${data?.tipoDocumento || "-"}
Plazo: ${data?.plazo || "-"}
Adjuntos: ${files.length}
`;

  const html = `
    <h2>Nueva solicitud de presupuesto</h2>
    <p><strong>Nombre:</strong> ${data?.nombre || "-"}</p>
    <p><strong>Email:</strong> ${data?.email || "-"}</p>
    <p><strong>Teléfono:</strong> ${data?.telefono || "-"}</p>
    <p><strong>Idioma origen:</strong> ${data?.idiomaOrigen || "-"}</p>
    <p><strong>Idioma destino:</strong> ${data?.idiomaDestino || "-"}</p>
    <p><strong>Documento:</strong> ${data?.tipoDocumento || "-"}</p>
    <p><strong>Plazo:</strong> ${data?.plazo || "-"}</p>
    <p><strong>Adjuntos:</strong> ${files.length}</p>
  `;

  await sgMail.send({
    to,
    from: { email: from, name: "Traducciones Juradas" },
    replyTo: data?.email,
    subject,
    text,
    html,
    attachments: files.map((f) => ({
      filename: f.name,
      type: f.type,
      content: f.contentBase64,
      disposition: "attachment",
    })),
  });
}

export async function sendPresupuestoConfirmationEmail(data: any) {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) throw new Error("Missing SENDGRID_API_KEY");

  const from = process.env.SENDGRID_FROM;
  if (!from) throw new Error("Missing SENDGRID_FROM");

  const toUser = data?.email;
  if (!toUser) return; // nada que enviar
  const bccInternal = process.env.PRESUPUESTO_TO;

  sgMail.setApiKey(apiKey);

  const subject = "Hemos recibido tu solicitud de presupuesto";

  const whatsapp = "https://wa.me/34951333614?text=Hola%20necesito%20un%20presupuesto";
  const signatureText = `Juan Silva Moreno
Jefe de proyectos · Traductor jurado de francés (Nº3850)
HBTJ Consultores Lingüísticos S.L. · CIF B93712784
Calle Esperanto, 9 · 29007 Málaga
Tel: +34 951 333 614

NOTA LEGAL –
Este documento se dirige exclusivamente a su destinatario y puede contener información confidencial sometida a secreto profesional. Si no es el destinatario autorizado, su uso o divulgación está prohibido; por favor comuníquelo y destrúyalo. Las comunicaciones por email pueden ser modificadas o interceptadas; el remitente no asume responsabilidad por errores u omisiones.

Protección de datos:
Los datos se incorporan a un fichero responsabilidad de HBTJ Consultores Lingüísticos S.L. para gestionar su encargo y comunicaciones. Puede ejercer acceso, rectificación, supresión y oposición en Calle Esperanto, 9 · 29007 Málaga o en hola@traduccionesjuradas.net.`;

  const signatureHtml = `
    <p style="margin:12px 0 4px 0;"><strong>Juan Silva Moreno</strong><br/>
    Jefe de proyectos · Traductor jurado de francés (Nº3850)<br/>
    HBTJ Consultores Lingüísticos S.L. · CIF B93712784<br/>
    Calle Esperanto, 9 · 29007 Málaga<br/>
    Tel: <a href="tel:+34951333614">+34 951 333 614</a></p>
    <p style="font-size:12px; color:#6b7280; margin:8px 0 0 0;"><strong>NOTA LEGAL</strong> – Este documento se dirige exclusivamente a su destinatario y puede contener información confidencial sometida a secreto profesional. Si no es el destinatario autorizado, su uso o divulgación está prohibido; por favor comuníquelo y destrúyalo. Las comunicaciones por email pueden ser modificadas o interceptadas; el remitente no asume responsabilidad por errores u omisiones.</p>
    <p style="font-size:12px; color:#6b7280; margin:6px 0 0 0;"><strong>Protección de datos:</strong> Los datos se incorporan a un fichero responsabilidad de HBTJ Consultores Lingüísticos S.L. para gestionar su encargo y comunicaciones. Puede ejercer derechos de acceso, rectificación, supresión y oposición en Calle Esperanto, 9 · 29007 Málaga o en <a href="mailto:hola@traduccionesjuradas.net">hola@traduccionesjuradas.net</a>.</p>
  `;

  const text = `Hola ${data?.nombre || ""},

Hemos recibido tu solicitud de traducción jurada.
- Idioma origen: ${data?.idiomaOrigen || "-"}
- Idioma destino: ${data?.idiomaDestino || "-"}
- Documento: ${data?.tipoDocumento || "-"}
- Plazo indicado: ${data?.plazo || "-"}

Atendemos de 09:00 a 19:00 CET y solemos responder en <30 minutos dentro de ese horario.
Si es urgente, escríbenos por WhatsApp: ${whatsapp}

Tus archivos se usan solo para preparar el presupuesto y se eliminan en 30 días o antes si lo pides.

Gracias,
Equipo de TraduccionesJuradas.net

--
${signatureText}`;

  const html = `
    <div style="margin-bottom:12px;">
      <img src="cid:logo-tj" alt="TraduccionesJuradas.net" style="height:46px; max-width:180px;" />
    </div>
    <h2>Hemos recibido tu solicitud</h2>
    <p>Hola ${data?.nombre || ""},</p>
    <p>Este es un resumen de lo que nos enviaste:</p>
    <ul>
      <li><strong>Idioma origen:</strong> ${data?.idiomaOrigen || "-"}</li>
      <li><strong>Idioma destino:</strong> ${data?.idiomaDestino || "-"}</li>
      <li><strong>Documento:</strong> ${data?.tipoDocumento || "-"}</li>
      <li><strong>Plazo indicado:</strong> ${data?.plazo || "-"}</li>
    </ul>
    <p>Horario de respuesta: <strong>09:00 a 19:00 CET</strong>. Respondemos normalmente en &lt; 30 minutos dentro de ese horario.</p>
    <p>Si es urgente, contáctanos por <a href="${whatsapp}">WhatsApp</a>.</p>
    <p>Tus archivos se usan solo para preparar el presupuesto y se eliminan en 30 días (o antes si lo pides).</p>
    <p>Gracias por confiar en nosotros.<br/>Equipo de traduccionesjuradas.net</p>
    <div style="margin:12px 0;">
      <img src="cid:sello-ministerio" alt="Traductores jurados nombrados por el Ministerio" style="max-width:220px; height:auto;" />
    </div>
    <hr style="margin:12px 0; border:0; border-top:1px solid #e5e7eb;" />
    ${signatureHtml}
  `;

  // Inline attachments (opcional si existen en /public)
  const attachments: any[] = [];
  const logoPath = path.join(process.cwd(), "public", "logo-tj-app.svg");
  const sealPath = path.join(process.cwd(), "public", "sello-ministerio.jpg");

  try {
    const logoContent = fs.readFileSync(logoPath).toString("base64");
    attachments.push({
      filename: "logo-tj-app.svg",
      type: "image/svg+xml",
      content: logoContent,
      disposition: "inline",
      content_id: "logo-tj",
    });
  } catch (e) {
    // opcional: si no existe, no adjuntamos
  }

  try {
    const sealContent = fs.readFileSync(sealPath).toString("base64");
    attachments.push({
      filename: "sello-ministerio.jpg",
      type: "image/jpeg",
      content: sealContent,
      disposition: "inline",
      content_id: "sello-ministerio",
    });
  } catch (e) {
    // opcional
  }

  await sgMail.send({
    from: { email: from, name: "Traducciones Juradas" },
    personalizations: [
      {
        to: [{ email: toUser }],
        ...(bccInternal ? { bcc: [{ email: bccInternal }] } : {}),
      },
    ],
    subject,
    text,
    html,
    attachments,
  });
}

export async function sendTranslationReadyEmail(data: {
  toEmail: string;
  reference: string;
  downloadUrl: string;
}) {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) throw new Error("Missing SENDGRID_API_KEY");

  const from = process.env.SENDGRID_FROM;
  if (!from) throw new Error("Missing SENDGRID_FROM");

  sgMail.setApiKey(apiKey);

  const subject = `Tu traduccion jurada esta lista (${data.reference})`;
  const text = `Hola,

Tu traduccion jurada ya esta disponible.
Referencia: ${data.reference}
Descarga: ${data.downloadUrl}

Si tienes cualquier duda, responde a este correo.
`;

  const html = `
    <h2>Tu traduccion jurada esta lista</h2>
    <p>Referencia: <strong>${data.reference}</strong></p>
    <p>Puedes descargar tu archivo desde este enlace:</p>
    <p><a href="${data.downloadUrl}">${data.downloadUrl}</a></p>
    <p style="font-size:13px; color:#6b7280;">Tambien puedes consultar el estado en <a href="https://www.traduccionesjuradas.net/consulta">traduccionesjuradas.net/consulta</a>.</p>
    <p>Si necesitas factura o envio en papel, responde a este correo.</p>
  `;

  await sgMail.send({
    to: data.toEmail,
    from: { email: from, name: "Traducciones Juradas" },
    subject,
    text,
    html,
  });
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
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) throw new Error("Missing SENDGRID_API_KEY");

  const from = process.env.SENDGRID_FROM;
  if (!from) throw new Error("Missing SENDGRID_FROM");

  const to = process.env.PRESUPUESTO_TO;
  if (!to) throw new Error("Missing PRESUPUESTO_TO");

  sgMail.setApiKey(apiKey);

  const amount = (data.amountCents / 100).toFixed(2);
  const subject = `Solicitud de factura - ${data.reference}`;

  const text = `Solicitud de factura para pedido ${data.reference}

Pedido: ${data.title}
Importe: ${amount} EUR
Cliente: ${data.clientEmail}

Datos fiscales:
- Nombre fiscal: ${data.billing.fiscalName}
- NIF/CIF: ${data.billing.nif}
- Direccion: ${data.billing.address}
- Ciudad: ${data.billing.city}
- Codigo postal: ${data.billing.postalCode}
- Pais: ${data.billing.country}
- Email factura: ${data.billing.email}
`;

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

  await sgMail.send({
    to,
    from: { email: from, name: "Traducciones Juradas" },
    subject,
    text,
    html,
  });
}

export async function sendOrderCreatedEmail(data: {
  toEmail: string;
  clientName?: string;
  reference: string;
  title: string;
  amountCents: number;
  paymentUrl: string;
}) {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) throw new Error("Missing SENDGRID_API_KEY");

  const from = process.env.SENDGRID_FROM;
  if (!from) throw new Error("Missing SENDGRID_FROM");

  sgMail.setApiKey(apiKey);

  const amount = (data.amountCents / 100).toFixed(2);
  const name = data.clientName || "";
  const subject = `Pedido ${data.reference} creado - Traducciones Juradas`;

  const text = `Hola ${name},

Hemos registrado tu pedido correctamente.

Referencia: ${data.reference}
Concepto: ${data.title}
Importe: ${amount} EUR

Puedes realizar el pago en: ${data.paymentUrl}

Si ya has cerrado la ventana, puedes consultar el estado de tu pedido en: https://www.traduccionesjuradas.net/consulta

Gracias,
Equipo de TraduccionesJuradas.net`;

  const html = `
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

  await sgMail.send({
    to: data.toEmail,
    from: { email: from, name: "Traducciones Juradas" },
    subject,
    text,
    html,
  });
}

export async function sendPaymentConfirmedEmail(data: {
  toEmail: string;
  reference: string;
  title: string;
  amountCents: number;
  method: string;
}) {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) throw new Error("Missing SENDGRID_API_KEY");

  const from = process.env.SENDGRID_FROM;
  if (!from) throw new Error("Missing SENDGRID_FROM");

  sgMail.setApiKey(apiKey);

  const amount = (data.amountCents / 100).toFixed(2);
  const methodLabels: Record<string, string> = {
    REDSYS: "Tarjeta bancaria",
    PAYPAL: "PayPal",
    BIZUM: "Bizum",
    TRANSFER: "Transferencia bancaria",
    STRIPE: "Tarjeta (Stripe)",
  };
  const methodLabel = methodLabels[data.method] || data.method;
  const subject = `Pago confirmado - Pedido ${data.reference}`;

  const text = `Hola,

Hemos recibido tu pago correctamente.

Referencia: ${data.reference}
Concepto: ${data.title}
Importe: ${amount} EUR
Metodo: ${methodLabel}

Puedes seguir el estado de tu pedido en: https://www.traduccionesjuradas.net/consulta

Te avisaremos cuando tu traduccion este lista.

Gracias,
Equipo de TraduccionesJuradas.net`;

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

  await sgMail.send({
    to: data.toEmail,
    from: { email: from, name: "Traducciones Juradas" },
    subject,
    text,
    html,
  });
}

export async function sendNewOrderStaffEmail(data: {
  reference: string;
  title: string;
  amountCents: number;
  clientEmail: string;
  langPair?: string;
}) {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) throw new Error("Missing SENDGRID_API_KEY");

  const from = process.env.SENDGRID_FROM;
  if (!from) throw new Error("Missing SENDGRID_FROM");

  const to = process.env.PRESUPUESTO_TO;
  if (!to) throw new Error("Missing PRESUPUESTO_TO");

  sgMail.setApiKey(apiKey);

  const amount = (data.amountCents / 100).toFixed(2);
  const subject = `Nuevo pedido ${data.reference} - ${amount} EUR`;

  const text = `Nuevo pedido creado desde la web.

Referencia: ${data.reference}
Concepto: ${data.title}
Idiomas: ${data.langPair || "-"}
Importe: ${amount} EUR
Cliente: ${data.clientEmail}

Ver en zona traductor: https://www.traduccionesjuradas.net/zona-traductor`;

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

  await sgMail.send({
    to,
    from: { email: from, name: "Traducciones Juradas" },
    subject,
    text,
    html,
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
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) throw new Error("Missing SENDGRID_API_KEY");

  const from = process.env.SENDGRID_FROM;
  if (!from) throw new Error("Missing SENDGRID_FROM");

  const to = process.env.PRESUPUESTO_TO;
  if (!to) throw new Error("Missing PRESUPUESTO_TO");

  sgMail.setApiKey(apiKey);

  const amount = (data.amountCents / 100).toFixed(2);
  const subject = `Comprobante subido - ${data.reference}`;

  const text = `El cliente ha subido un comprobante de pago.

Referencia: ${data.reference}
Concepto: ${data.title}
Importe: ${amount} EUR
Cliente: ${data.clientEmail}
Archivo: ${data.fileName || "comprobante"}
URL: ${data.proofUrl}

Ver en zona traductor: https://www.traduccionesjuradas.net/zona-traductor`;

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

  await sgMail.send({
    to,
    from: { email: from, name: "Traducciones Juradas" },
    subject,
    text,
    html,
  });
}

export async function sendPaymentProofReceivedClientEmail(data: {
  toEmail: string;
  reference: string;
}) {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) throw new Error("Missing SENDGRID_API_KEY");

  const from = process.env.SENDGRID_FROM;
  if (!from) throw new Error("Missing SENDGRID_FROM");

  sgMail.setApiKey(apiKey);

  const subject = `Comprobante recibido - Pedido ${data.reference}`;
  const text = `Hola,

Hemos recibido tu comprobante de pago para el pedido ${data.reference}.
Nuestro equipo lo revisara y confirmara el pago en breve.

Puedes consultar el estado en:
https://www.traduccionesjuradas.net/consulta
`;

  const html = `
    <h2>Comprobante recibido</h2>
    <p>Hemos recibido tu comprobante de pago para el pedido <strong>${data.reference}</strong>.</p>
    <p>Lo revisaremos y te confirmaremos el pago en cuanto se valide.</p>
    <p><a href="https://www.traduccionesjuradas.net/consulta" style="display:inline-block; background:#059669; color:#fff; padding:10px 24px; border-radius:8px; text-decoration:none; font-weight:600;">Consultar estado</a></p>
  `;

  await sgMail.send({
    to: data.toEmail,
    from: { email: from, name: "Traducciones Juradas" },
    subject,
    text,
    html,
  });
}

export async function sendTranslationEtaEmail(data: {
  toEmail: string;
  reference: string;
  etaDateLabel: string;
}) {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) throw new Error("Missing SENDGRID_API_KEY");

  const from = process.env.SENDGRID_FROM;
  if (!from) throw new Error("Missing SENDGRID_FROM");

  sgMail.setApiKey(apiKey);

  const subject = `Traduccion en curso - ETA ${data.reference}`;
  const text = `Hola,

Tu pedido ${data.reference} ya esta en proceso de traduccion.
Fecha estimada de entrega: ${data.etaDateLabel}

Te avisaremos en cuanto la traduccion este lista.
`;

  const html = `
    <h2>Tu traduccion esta en proceso</h2>
    <p>Pedido <strong>${data.reference}</strong>.</p>
    <p>Fecha estimada de entrega: <strong>${data.etaDateLabel}</strong>.</p>
    <p>Te avisaremos cuando el archivo final este disponible.</p>
  `;

  await sgMail.send({
    to: data.toEmail,
    from: { email: from, name: "Traducciones Juradas" },
    subject,
    text,
    html,
  });
}

export async function sendStaffOtpEmail(data: { toEmail: string; code: string }) {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) throw new Error("Missing SENDGRID_API_KEY");

  const from = process.env.SENDGRID_FROM;
  if (!from) throw new Error("Missing SENDGRID_FROM");

  sgMail.setApiKey(apiKey);

  const subject = "Codigo de acceso - Zona traductor";
  const text = `Tu codigo de acceso es: ${data.code}

Caduca en 10 minutos.
Si no has solicitado este acceso, ignora este mensaje.`;

  const html = `
    <h2>Codigo de acceso</h2>
    <p>Tu codigo para entrar en la zona traductor es:</p>
    <p style="font-size:24px; font-weight:700; letter-spacing:2px;">${data.code}</p>
    <p>Caduca en 10 minutos.</p>
  `;

  await sgMail.send({
    to: data.toEmail,
    from: { email: from, name: "Traducciones Juradas" },
    subject,
    text,
    html,
  });
}
