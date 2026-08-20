// Bandeja de entrada — sincroniza el buzón (Graph) a la tabla InboundEmail y
// casa cada email con Customer/Quote/Order por dirección. El match es
// best-effort: guía al staff, no bloquea nada.

import { createHash } from "node:crypto";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getMailboxAddress } from "@/lib/azure-mail";
import {
  listInboxMessages,
  getInboxMessage,
  listInboxAttachments,
  getInboxAttachmentBytes,
} from "@/lib/azure-mail-read";
import { isStaffEmail } from "@/lib/staff-access";

const FIRST_SYNC_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const RESYNC_OVERLAP_MS = 2 * 24 * 60 * 60 * 1000;

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Remitentes que no son clientes: el propio buzón, staff y no-reply. */
function isIgnoredSender(fromEmail: string): boolean {
  const email = fromEmail.toLowerCase();
  if (!email.includes("@")) return true;
  if (email === getMailboxAddress().toLowerCase()) return true;
  if (isStaffEmail(email)) return true;
  // microsoftexchange…@dominio-propio = avisos de rebote (NDR) de Exchange.
  return /^(no-?reply|noreply|notifications?|mailer-daemon|postmaster|microsoftexchange)/i.test(email);
}

export async function matchClientContext(fromEmail: string): Promise<{
  customerId: string | null;
  quoteId: string | null;
  orderReference: string | null;
}> {
  const email = fromEmail.toLowerCase();
  const [customer, quote, order] = await Promise.all([
    prisma.customer.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    }),
    prisma.quote.findFirst({
      where: { customerEmail: { equals: email, mode: "insensitive" }, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
    prisma.order.findFirst({
      where: { clientEmail: { equals: email, mode: "insensitive" } },
      orderBy: { createdAt: "desc" },
      select: { reference: true },
    }),
  ]);
  return {
    customerId: customer?.id || null,
    quoteId: quote?.id || null,
    orderReference: order?.reference || null,
  };
}

export type InboxSyncResult = {
  imported: number;
  skipped: number;
  scanned: number;
};

export async function syncInboxEmails(): Promise<InboxSyncResult> {
  const latest = await prisma.inboundEmail.findFirst({
    orderBy: { receivedAt: "desc" },
    select: { receivedAt: true },
  });
  const since = latest
    ? new Date(latest.receivedAt.getTime() - RESYNC_OVERLAP_MS)
    : new Date(Date.now() - FIRST_SYNC_WINDOW_MS);

  const messages = await listInboxMessages({ since, top: 50 });

  let imported = 0;
  let skipped = 0;
  for (const msg of messages) {
    if (isIgnoredSender(msg.fromEmail)) {
      skipped++;
      continue;
    }
    const exists = await prisma.inboundEmail.findUnique({
      where: { graphId: msg.graphId },
      select: { id: true },
    });
    if (exists) {
      skipped++;
      continue;
    }

    // Cuerpo completo solo para mensajes nuevos (una llamada Graph por email).
    let bodyText: string | null = null;
    try {
      const full = await getInboxMessage(msg.graphId);
      bodyText =
        full.bodyContentType === "text"
          ? full.bodyContent.trim()
          : htmlToPlainText(full.bodyContent);
    } catch (err) {
      console.error("[inbox] body fetch failed", msg.graphId, err);
    }

    const match = await matchClientContext(msg.fromEmail);
    await prisma.inboundEmail.create({
      data: {
        graphId: msg.graphId,
        internetMessageId: msg.internetMessageId,
        conversationId: msg.conversationId,
        fromEmail: msg.fromEmail,
        fromName: msg.fromName,
        subject: msg.subject,
        bodyPreview: msg.bodyPreview.slice(0, 500),
        bodyText: bodyText ? bodyText.slice(0, 20000) : null,
        receivedAt: msg.receivedAt,
        customerId: match.customerId,
        quoteId: match.quoteId,
        orderReference: match.orderReference,
      },
    });
    imported++;
  }

  return { imported, skipped, scanned: messages.length };
}

// ---------------------------------------------------------------------------
// Email → expediente del builder. Los adjuntos del mensaje bajan de Graph,
// suben a NUESTRO Blob y se registran como grupo exp:REF con los datos del
// remitente — exactamente lo que crea el intake público (/api/expediente/submit),
// así que /zona-traductor/presupuesto?exp=REF los analiza y tarifica igual.
// Sin IA aquí: el análisis se difiere al builder (coste solo cuando Juan actúa).

const EXPEDIENTE_ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/heic",
  "image/tiff",
  "image/webp",
]);
const EXPEDIENTE_MAX_FILE_BYTES = 20 * 1024 * 1024; // mismo tope que /api/documents/upload
const EXPEDIENTE_MIN_IMAGE_BYTES = 30 * 1024; // firmas/logos no marcados como inline
const EXPEDIENTE_MAX_DOCS = 40;

/** EXP-XXXXXX determinista a partir del email: repetir el botón no duplica. */
export function expedienteRefForInbound(inboundId: string): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const hash = createHash("sha256").update(`inbox:${inboundId}`).digest();
  let out = "";
  for (let i = 0; i < 6; i += 1) out += alphabet[hash[i] % alphabet.length];
  return `EXP-${out}`;
}

export type InboundExpedienteResult = {
  ref: string | null;
  docs: number;
  skipped: string[];
  reused: boolean;
};

export async function buildExpedienteFromInbound(inbound: {
  id: string;
  graphId: string;
  fromEmail: string;
  fromName: string | null;
}): Promise<InboundExpedienteResult> {
  const ref = expedienteRefForInbound(inbound.id);
  const sessionToken = `exp:${ref}`;

  const existing = await prisma.documentAnalysis.count({ where: { sessionToken } });
  if (existing > 0) return { ref, docs: existing, skipped: [], reused: true };

  const attachments = await listInboxAttachments(inbound.graphId);
  const skipped: string[] = [];
  const usable = attachments.filter((a) => {
    if (a.isInline) return false;
    const isImage = a.contentType.startsWith("image/");
    if (!EXPEDIENTE_ALLOWED_TYPES.has(a.contentType)) {
      skipped.push(`${a.name} (${a.contentType})`);
      return false;
    }
    if (a.size > EXPEDIENTE_MAX_FILE_BYTES) {
      skipped.push(`${a.name} (>20 MB)`);
      return false;
    }
    if (isImage && a.size < EXPEDIENTE_MIN_IMAGE_BYTES) return false; // firma/logo
    return true;
  });
  if (usable.length === 0) return { ref: null, docs: 0, skipped, reused: false };

  const rows: {
    fileName: string;
    fileUrl: string;
    fileSize: number;
    mimeType: string;
  }[] = [];
  for (const a of usable.slice(0, EXPEDIENTE_MAX_DOCS)) {
    const buf = await getInboxAttachmentBytes(inbound.graphId, a.id);
    const safeName = a.name.replace(/[^\w.\- ]+/g, "_").slice(0, 120);
    const blob = await put(`expedientes/${Date.now()}-${safeName}`, buf, {
      access: "public",
      contentType: a.contentType,
    });
    rows.push({ fileName: a.name.slice(0, 255), fileUrl: blob.url, fileSize: buf.length, mimeType: a.contentType });
  }

  await prisma.documentAnalysis.createMany({
    data: rows.map((d) => ({
      ...d,
      sessionToken,
      clientName: inbound.fromName,
      clientEmail: inbound.fromEmail,
      gdprConsent: true,
      gdprConsentAt: new Date(),
      status: "UPLOADED" as const,
    })),
  });
  return { ref, docs: rows.length, skipped, reused: false };
}

/**
 * Re-casa un email con cliente/presupuesto/pedido cuando al sincronizar no
 * había nada (el presupuesto se monta DESPUÉS de leer el email). Persiste el
 * match nuevo y devuelve el estado actual.
 */
export async function rematchInboundIfUnlinked<T extends {
  id: string;
  fromEmail: string;
  customerId: string | null;
  quoteId: string | null;
  orderReference: string | null;
}>(inbound: T): Promise<T> {
  if (inbound.quoteId && inbound.orderReference) return inbound;
  const match = await matchClientContext(inbound.fromEmail);
  const patch = {
    customerId: inbound.customerId || match.customerId,
    quoteId: inbound.quoteId || match.quoteId,
    orderReference: inbound.orderReference || match.orderReference,
  };
  if (
    patch.customerId === inbound.customerId &&
    patch.quoteId === inbound.quoteId &&
    patch.orderReference === inbound.orderReference
  ) {
    return inbound;
  }
  await prisma.inboundEmail.update({ where: { id: inbound.id }, data: patch });
  return { ...inbound, ...patch };
}
