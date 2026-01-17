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
