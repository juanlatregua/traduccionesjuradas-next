import { wrapClientEmailHtml } from "@/lib/email";
import { SITE_BASE_URL } from "@/lib/contact";
import { sendMail } from "@/lib/azure-mail";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "info@traduccionesjuradas.net";

/* CARRIL VIEJO APAGADO (orden de Juan, 15-ago-2026). El motor NO escribe a un
   traductor: al jurado se le avisa desde hola@lavori.es y tj.net no aparece
   (canon del 10-ago). Estas funciones son del flujo manual anterior al puente y
   escribían desde hola@traduccionesjuradas.net — con Vanessa, Murariu y Morton,
   que son colaboradores aquí Y miembros del tablón, habrían salido con la marca
   equivocada. Verificado en BD antes de apagarlo: 6 assignments, todos de Juan
   Amor, todos por el camino automático, y CERO eventos de las rutas manuales:
   no se envió ni uno de estos correos en la vida.
   El mensaje no se pierde — va a staff con el enlace listo para pasárselo a
   mano, igual que el silencio de Juan Amor (02825c4). */
async function sendToCollaboratorViaStaff(opts: {
  collaboratorName: string;
  collaboratorEmail: string;
  subject: string;
  html: string;
}) {
  const aviso = `<p style="background:#fef3c7; padding:12px; border-radius:8px;">
    <strong>Este mensaje NO se ha enviado a ${escapeHtml(opts.collaboratorName)}</strong>
    (${escapeHtml(opts.collaboratorEmail)}). El motor no escribe a traductores: si es del
    tablón, el aviso sale de lavori; si no, pásaselo tú por tu canal. Debajo va tal cual.
  </p><hr>`;
  await sendMail({
    to: ADMIN_EMAIL,
    subject: `[no enviado a ${opts.collaboratorName}] ${opts.subject}`,
    html: aviso + opts.html,
  });
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function sanitizeUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) return trimmed;
  return "#";
}

type AssignmentEmailPayload = {
  collaboratorName: string;
  collaboratorEmail: string;
  orderReference: string;
  orderTitle: string;
  langPair: string | null;
  accessToken: string;
  adminNotes?: string | null;
  documents: Array<{ name: string; url: string }>;
};

export async function sendAssignmentToCollaborator(payload: AssignmentEmailPayload) {
  const encargoUrl = `${SITE_BASE_URL}/encargo/${payload.accessToken}`;
  const name = escapeHtml(payload.collaboratorName);
  const ref = escapeHtml(payload.orderReference);
  const title = escapeHtml(payload.orderTitle);
  const lang = payload.langPair ? escapeHtml(payload.langPair) : null;
  const notes = payload.adminNotes ? escapeHtml(payload.adminNotes) : null;
  const docList = payload.documents
    .map((d) => `<li><a href="${sanitizeUrl(d.url)}" style="color:#2563eb;">${escapeHtml(d.name)}</a></li>`)
    .join("");

  const html = `
    <p>Hola ${name},</p>
    <p>Tienes un nuevo encargo de traducción jurada.</p>
    <table style="border-collapse:collapse; margin:12px 0;">
      <tr><td style="padding:4px 12px 4px 0; color:#64748b;">Referencia</td><td style="font-weight:600;">${ref}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; color:#64748b;">Descripción</td><td>${title}</td></tr>
      ${lang ? `<tr><td style="padding:4px 12px 4px 0; color:#64748b;">Par de idiomas</td><td>${lang}</td></tr>` : ""}
    </table>
    ${notes ? `<p style="color:#64748b;"><em>Notas: ${notes}</em></p>` : ""}
    ${docList ? `<p><strong>Documentos del cliente:</strong></p><ul>${docList}</ul>` : ""}
    <p>Por favor, revisa los documentos y envía tu presupuesto (precio y plazo) a través del siguiente enlace:</p>
    <p style="margin:16px 0;">
      <a href="${encargoUrl}" style="display:inline-block; background:#2563eb; color:#fff; padding:10px 24px; border-radius:8px; text-decoration:none; font-weight:600;">
        Ver encargo y enviar presupuesto
      </a>
    </p>
    <p style="color:#94a3b8; font-size:13px;">Este enlace es personal e intransferible.</p>
  `;

  await sendToCollaboratorViaStaff({
    collaboratorName: payload.collaboratorName,
    collaboratorEmail: payload.collaboratorEmail,
    subject: `Nuevo encargo de traducción jurada (${ref})`,
    html: wrapClientEmailHtml(html),
  });
}

type QuoteNotificationPayload = {
  collaboratorName: string;
  orderReference: string;
  orderTitle: string;
  priceCents: number;
  deadline: string;
  collaboratorNotes?: string | null;
  assignmentId: string;
};

export async function sendQuoteNotificationToAdmin(payload: QuoteNotificationPayload) {
  const priceFormatted = (payload.priceCents / 100).toFixed(2);
  const name = escapeHtml(payload.collaboratorName);
  const ref = escapeHtml(payload.orderReference);
  const deadline = escapeHtml(payload.deadline);
  const notes = payload.collaboratorNotes ? escapeHtml(payload.collaboratorNotes) : null;
  const panelUrl = `${SITE_BASE_URL}/zona-traductor/pedido/${encodeURIComponent(payload.orderReference)}`;
  const html = `
    <p><strong>${name}</strong> ha enviado presupuesto para el pedido <strong>${ref}</strong>.</p>
    <table style="border-collapse:collapse; margin:12px 0;">
      <tr><td style="padding:4px 12px 4px 0; color:#64748b;">Precio</td><td style="font-weight:600;">${priceFormatted} €</td></tr>
      <tr><td style="padding:4px 12px 4px 0; color:#64748b;">Plazo</td><td>${deadline}</td></tr>
      ${notes ? `<tr><td style="padding:4px 12px 4px 0; color:#64748b;">Notas</td><td>${notes}</td></tr>` : ""}
    </table>
    <p><a href="${sanitizeUrl(panelUrl)}" style="display:inline-block; background:#0891b2; color:#fff; padding:10px 24px; border-radius:8px; text-decoration:none; font-weight:600;">Abrir panel y adjudicar</a></p>
  `;

  await sendMail({
    to: ADMIN_EMAIL,
    subject: `Presupuesto de ${name} para ${ref}: ${priceFormatted}€`,
    html: wrapClientEmailHtml(html),
  });
}

type RevisionRequestPayload = {
  collaboratorName: string;
  collaboratorEmail: string;
  orderReference: string;
  previousPriceCents: number;
  reason?: string | null;
  accessToken: string;
};

export async function sendRevisionRequestToCollaborator(payload: RevisionRequestPayload) {
  const encargoUrl = `${SITE_BASE_URL}/encargo/${payload.accessToken}`;
  const priceFormatted = (payload.previousPriceCents / 100).toFixed(2);
  const name = escapeHtml(payload.collaboratorName);
  const ref = escapeHtml(payload.orderReference);
  const html = `
    <p>Hola ${name},</p>
    <p>Hemos revisado tu presupuesto para el encargo <strong>${ref}</strong> y necesitamos que lo ajustes.</p>
    <table style="border-collapse:collapse; margin:12px 0;">
      <tr><td style="padding:4px 12px 4px 0; color:#64748b;">Precio anterior</td><td style="font-weight:600;">${priceFormatted} €</td></tr>
    </table>
    ${payload.reason ? `<p><strong>Comentario:</strong> ${escapeHtml(payload.reason)}</p>` : ""}
    <p>Por favor, revisa y envía un nuevo presupuesto a través del siguiente enlace:</p>
    <p style="margin:16px 0;">
      <a href="${encargoUrl}" style="display:inline-block; background:#d97706; color:#fff; padding:10px 24px; border-radius:8px; text-decoration:none; font-weight:600;">
        Revisar y enviar nuevo presupuesto
      </a>
    </p>
    <p style="color:#94a3b8; font-size:13px;">Este enlace es personal e intransferible.</p>
  `;

  await sendToCollaboratorViaStaff({
    collaboratorName: payload.collaboratorName,
    collaboratorEmail: payload.collaboratorEmail,
    subject: `Revisión de presupuesto solicitada (${ref})`,
    html: wrapClientEmailHtml(html),
  });
}

type AcceptanceEmailPayload = {
  collaboratorName: string;
  collaboratorEmail: string;
  orderReference: string;
  priceCents: number;
  accessToken: string;
  dueDate?: Date | string | null;
};

export async function sendAcceptanceToCollaborator(payload: AcceptanceEmailPayload) {
  const encargoUrl = `${SITE_BASE_URL}/encargo/${payload.accessToken}`;
  const priceFormatted = (payload.priceCents / 100).toFixed(2);
  const name = escapeHtml(payload.collaboratorName);
  const ref = escapeHtml(payload.orderReference);
  // Fecha de entrega comprometida: es la que el propio colaborador puso al
  // cotizar (quotedDeadline). Confirmar el encargo SIN la fecha dejaba al
  // traductor sin saber para cuándo se comprometió.
  const dueLabel = payload.dueDate
    ? new Date(payload.dueDate).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })
    : null;
  const dueRow = dueLabel
    ? `<tr><td style="padding:4px 12px 4px 0; color:#64748b;">Fecha de entrega</td><td style="font-weight:600;">${escapeHtml(dueLabel)}</td></tr>`
    : "";
  const html = `
    <p>Hola ${name},</p>
    <p>Tu presupuesto para el encargo <strong>${ref}</strong> ha sido <strong>aceptado</strong> y el cliente ha pagado. Queda confirmado.</p>
    <table style="border-collapse:collapse; margin:12px 0;">
      <tr><td style="padding:4px 12px 4px 0; color:#64748b;">Precio confirmado</td><td style="font-weight:600;">${priceFormatted} €</td></tr>
      ${dueRow}
    </table>
    <p>Cuando tengas la traducción terminada, súbela a través de este enlace:</p>
    <p style="margin:16px 0;">
      <a href="${encargoUrl}" style="display:inline-block; background:#16a34a; color:#fff; padding:10px 24px; border-radius:8px; text-decoration:none; font-weight:600;">
        Subir traducción terminada
      </a>
    </p>
    <p style="color:#94a3b8; font-size:13px;">Este enlace es personal e intransferible.</p>
  `;

  await sendToCollaboratorViaStaff({
    collaboratorName: payload.collaboratorName,
    collaboratorEmail: payload.collaboratorEmail,
    subject: `Encargo aceptado (${payload.orderReference})`,
    html: wrapClientEmailHtml(html),
  });
}

type RejectionEmailPayload = {
  collaboratorName: string;
  collaboratorEmail: string;
  orderReference: string;
  reason?: string | null;
};

export async function sendRejectionToCollaborator(payload: RejectionEmailPayload) {
  const name = escapeHtml(payload.collaboratorName);
  const ref = escapeHtml(payload.orderReference);
  const html = `
    <p>Hola ${name},</p>
    <p>Lamentablemente no hemos podido aceptar tu presupuesto para el encargo <strong>${ref}</strong>.</p>
    ${payload.reason ? `<p>Motivo: ${escapeHtml(payload.reason)}</p>` : ""}
    <p>Gracias por tu tiempo. Te contactaremos para futuros encargos.</p>
  `;

  await sendToCollaboratorViaStaff({
    collaboratorName: payload.collaboratorName,
    collaboratorEmail: payload.collaboratorEmail,
    subject: `Encargo ${payload.orderReference} — Presupuesto no aceptado`,
    html: wrapClientEmailHtml(html),
  });
}

type AutoAssignQuoteRequestPayload = {
  collaboratorName: string;
  collaboratorEmail: string;
  orderReference: string;
  orderTitle: string;
  langPair: string | null;
  accessToken: string;
  documents: Array<{ name: string; url: string }>;
};

export async function sendFriendlyQuoteRequest(payload: AutoAssignQuoteRequestPayload) {
  const encargoUrl = `${SITE_BASE_URL}/encargo/${payload.accessToken}`;
  const firstName = escapeHtml(payload.collaboratorName.split(" ")[0]);
  const ref = escapeHtml(payload.orderReference);
  const title = escapeHtml(payload.orderTitle);
  const lang = payload.langPair ? escapeHtml(payload.langPair) : null;
  const docList = payload.documents
    .map((d) => `<li><a href="${sanitizeUrl(d.url)}" style="color:#2563eb;">${escapeHtml(d.name)}</a></li>`)
    .join("");

  const html = `
    <p>¡Hola ${firstName}!</p>
    <p>Te paso un encargo nuevo${lang ? ` de <strong>${lang}</strong>` : ""}:</p>
    <ul style="margin:8px 0;">
      <li><strong>Ref:</strong> ${ref}</li>
      <li><strong>Descripción:</strong> ${title}</li>
    </ul>
    ${docList ? `<p>Documentos del cliente:</p><ul>${docList}</ul>` : ""}
    <p>¿Me puedes decir <strong>precio y plazo</strong>? Puedes responder a este email o usar el enlace de abajo.</p>
    <p style="margin:16px 0;">
      <a href="${encargoUrl}" style="display:inline-block; background:#2563eb; color:#fff; padding:10px 24px; border-radius:8px; text-decoration:none; font-weight:600;">
        Ver encargo y enviar presupuesto
      </a>
    </p>
    <p>¡Gracias!</p>
  `;

  await sendToCollaboratorViaStaff({
    collaboratorName: payload.collaboratorName,
    collaboratorEmail: payload.collaboratorEmail,
    subject: `Nuevo encargo ${lang || ""} (${ref})`,
    html: wrapClientEmailHtml(html),
  });
}

type DeliveryNotificationPayload = {
  collaboratorName: string;
  collaboratorEmail: string;
  orderReference: string;
  filename: string;
  fileUrl: string;
};

export async function sendDeliveryNotificationToAdmin(payload: DeliveryNotificationPayload) {
  const name = escapeHtml(payload.collaboratorName);
  const email = escapeHtml(payload.collaboratorEmail);
  const ref = escapeHtml(payload.orderReference);
  const filename = escapeHtml(payload.filename);
  const fileUrl = sanitizeUrl(payload.fileUrl);
  const workspaceUrl = `${SITE_BASE_URL}/zona-traductor/pedido/${payload.orderReference}`;
  const now = new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid" });
  const html = `
    <p><strong>${name}</strong> ha entregado la traducción del pedido <strong>${ref}</strong>.</p>
    <table style="border-collapse:collapse; margin:12px 0;">
      <tr><td style="padding:4px 12px 4px 0; color:#64748b;">Colaborador</td><td>${name} (${email})</td></tr>
      <tr><td style="padding:4px 12px 4px 0; color:#64748b;">Archivo</td><td>${filename}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; color:#64748b;">Fecha</td><td>${now}</td></tr>
    </table>
    <p style="margin:16px 0;">
      <a href="${workspaceUrl}" style="display:inline-block; background:#16a34a; color:#fff; padding:10px 24px; border-radius:8px; text-decoration:none; font-weight:600;">
        Abrir workspace
      </a>
      <a href="${fileUrl}" style="display:inline-block; margin-left:8px; background:#2563eb; color:#fff; padding:10px 24px; border-radius:8px; text-decoration:none; font-weight:600;">
        Descargar archivo
      </a>
    </p>
  `;

  await sendMail({
    to: ADMIN_EMAIL,
    subject: `\u2705 ${name} ha entregado \u2014 ${ref}`,
    html: wrapClientEmailHtml(html),
  });
}
