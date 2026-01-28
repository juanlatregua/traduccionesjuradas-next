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
    to: toUser,
    from: { email: from, name: "Traducciones Juradas" },
    subject,
    text,
    html,
    attachments,
  });
}
