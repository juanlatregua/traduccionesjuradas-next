// lib/email.ts
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false, // STARTTLS (Office365, etc.)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendPresupuestoEmail(
  data: any,
  files: { name: string; buffer: ArrayBuffer; type: string }[]
) {
  const to = process.env.PRESUPUESTO_TO || process.env.SMTP_USER;

  await transporter.sendMail({
    from: `"Web Traducciones Juradas" <${process.env.SMTP_USER}>`,
    to,
    replyTo: data.email,
    subject: `Nueva solicitud de presupuesto - ${data.nombre}`,

    text: `Nombre: ${data.nombre}
Email: ${data.email}
Teléfono: ${data.telefono}
Idioma origen: ${data.idiomaOrigen}
Idioma destino: ${data.idiomaDestino}
Documento: ${data.tipoDocumento}
Plazo: ${data.plazo}
`,

    html: `
      <h2>Nueva solicitud de presupuesto</h2>
      <p><strong>Nombre:</strong> ${data.nombre}</p>
      <p><strong>Email:</strong> ${data.email}</p>
      <p><strong>Teléfono:</strong> ${data.telefono}</p>
      <p><strong>Idioma origen:</strong> ${data.idiomaOrigen}</p>
      <p><strong>Idioma destino:</strong> ${data.idiomaDestino}</p>
      <p><strong>Documento:</strong> ${data.tipoDocumento}</p>
      <p><strong>Plazo:</strong> ${data.plazo}</p>
    `,

    attachments: files.map((file) => ({
      filename: file.name,
      content: Buffer.from(file.buffer),
      contentType: file.type,
    })),
  });
}
