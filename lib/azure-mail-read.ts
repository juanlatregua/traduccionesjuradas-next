// Azure Mail READ — lectura del buzón vía Microsoft Graph (client_credentials).
// Requiere el permiso de aplicación Mail.Read (además del Mail.Send ya usado
// para enviar) concedido en el App Registration de Azure AD. Si falta, Graph
// devuelve 403 ErrorAccessDenied y la sincronización lo reporta tal cual.

import { getGraphAccessToken, getMailboxAddress, isEmailConfigured } from "@/lib/azure-mail";

const GRAPH = "https://graph.microsoft.com/v1.0";

export interface InboxMessageSummary {
  graphId: string;
  internetMessageId: string | null;
  conversationId: string | null;
  fromEmail: string;
  fromName: string | null;
  subject: string;
  bodyPreview: string;
  receivedAt: Date;
}

export interface InboxMessageFull extends InboxMessageSummary {
  bodyContentType: "html" | "text";
  bodyContent: string;
}

export function isInboxConfigured(): boolean {
  return isEmailConfigured();
}

async function graphGet(path: string): Promise<any> {
  const token = await getGraphAccessToken();
  const res = await fetch(`${GRAPH}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Graph GET ${res.status}: ${body.slice(0, 500)}`);
  }
  return res.json();
}

function toSummary(m: any): InboxMessageSummary {
  return {
    graphId: String(m.id),
    internetMessageId: m.internetMessageId || null,
    conversationId: m.conversationId || null,
    fromEmail: String(m.from?.emailAddress?.address || "").toLowerCase(),
    fromName: m.from?.emailAddress?.name || null,
    subject: String(m.subject || "(sin asunto)"),
    bodyPreview: String(m.bodyPreview || ""),
    receivedAt: new Date(m.receivedDateTime),
  };
}

/** Lista los mensajes de la bandeja de entrada recibidos desde `since`. */
export async function listInboxMessages(opts: {
  since: Date;
  top?: number;
}): Promise<InboxMessageSummary[]> {
  const mailbox = getMailboxAddress();
  const top = Math.min(Math.max(opts.top || 50, 1), 100);
  const filter = encodeURIComponent(`receivedDateTime ge ${opts.since.toISOString()}`);
  const select = "id,subject,from,receivedDateTime,bodyPreview,conversationId,internetMessageId";
  const data = await graphGet(
    `/users/${encodeURIComponent(mailbox)}/mailFolders/inbox/messages?$top=${top}&$orderby=receivedDateTime desc&$filter=${filter}&$select=${select}`
  );
  const rows: any[] = Array.isArray(data.value) ? data.value : [];
  return rows.map(toSummary).filter((m) => m.fromEmail);
}

/** Mensaje completo (cuerpo incluido). */
export async function getInboxMessage(graphId: string): Promise<InboxMessageFull> {
  const mailbox = getMailboxAddress();
  const select =
    "id,subject,from,receivedDateTime,bodyPreview,conversationId,internetMessageId,body";
  const m = await graphGet(
    `/users/${encodeURIComponent(mailbox)}/messages/${encodeURIComponent(graphId)}?$select=${select}`
  );
  return {
    ...toSummary(m),
    bodyContentType: m.body?.contentType === "text" ? "text" : "html",
    bodyContent: String(m.body?.content || ""),
  };
}

/**
 * Responde a un mensaje del buzón manteniendo el hilo (RE: + In-Reply-To los
 * pone Graph). El cuerpo HTML sustituye al comment; queda en Enviados.
 */
export async function replyToInboxMessage(
  graphId: string,
  opts: { html: string; subject?: string }
): Promise<void> {
  const mailbox = getMailboxAddress();
  const token = await getGraphAccessToken();
  const payload: Record<string, unknown> = {
    message: {
      body: { contentType: "HTML", content: opts.html },
      ...(opts.subject ? { subject: opts.subject } : {}),
    },
  };
  const res = await fetch(
    `${GRAPH}/users/${encodeURIComponent(mailbox)}/messages/${encodeURIComponent(graphId)}/reply`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Graph reply ${res.status}: ${body.slice(0, 500)}`);
  }
}

export interface InboxAttachmentSummary {
  id: string;
  name: string;
  contentType: string;
  size: number;
  isInline: boolean;
}

/** Adjuntos de archivo de un mensaje (sin los inline: firmas, logos). */
export async function listInboxAttachments(graphId: string): Promise<InboxAttachmentSummary[]> {
  const mailbox = getMailboxAddress();
  const data = await graphGet(
    `/users/${encodeURIComponent(mailbox)}/messages/${encodeURIComponent(graphId)}/attachments?$select=id,name,contentType,size,isInline`
  );
  const rows: any[] = Array.isArray(data.value) ? data.value : [];
  return rows
    .filter((a) => a["@odata.type"] === "#microsoft.graph.fileAttachment")
    .map((a) => ({
      id: String(a.id),
      name: String(a.name || "adjunto"),
      contentType: String(a.contentType || "application/octet-stream").toLowerCase(),
      size: Number(a.size) || 0,
      isInline: Boolean(a.isInline),
    }));
}

/** Bytes de un adjunto (descarga directa, sin base64 en JSON). */
export async function getInboxAttachmentBytes(graphId: string, attachmentId: string): Promise<Buffer> {
  const mailbox = getMailboxAddress();
  const token = await getGraphAccessToken();
  const res = await fetch(
    `${GRAPH}/users/${encodeURIComponent(mailbox)}/messages/${encodeURIComponent(graphId)}/attachments/${encodeURIComponent(attachmentId)}/$value`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Graph attachment ${res.status}: ${body.slice(0, 300)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
