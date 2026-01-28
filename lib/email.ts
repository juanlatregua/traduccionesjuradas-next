// lib/email.ts
import sgMail from "@sendgrid/mail";

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
Equipo de TraduccionesJuradas.net`;

  const html = `
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
  `;

  await sgMail.send({
    to: toUser,
    from: { email: from, name: "Traducciones Juradas" },
    subject,
    text,
    html,
  });
}
