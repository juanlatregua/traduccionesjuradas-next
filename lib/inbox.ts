// Bandeja de entrada — sincroniza el buzón (Graph) a la tabla InboundEmail y
// casa cada email con Customer/Quote/Order por dirección. El match es
// best-effort: guía al staff, no bloquea nada.

import { createHash } from "node:crypto";
import { put } from "@vercel/blob";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMailboxAddress } from "@/lib/azure-mail";
import {
  listInboxMessages,
  getInboxMessage,
  listInboxAttachments,
  getInboxAttachmentBytes,
  listSentMessages,
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

export async function matchClientContext(fromEmail: string, fromPhone?: string | null): Promise<{
  customerId: string | null;
  quoteId: string | null;
  orderReference: string | null;
}> {
  const email = fromEmail.toLowerCase();
  // Teléfono (WhatsApp): los números se guardan con formatos variados
  // ("+34 600 123 456", "600123456"); casamos por los 9 últimos dígitos.
  const digits = (fromPhone || "").replace(/\D/g, "");
  const last9 = digits.length >= 9 ? digits.slice(-9) : null;
  const phoneOr = (field: string) =>
    last9 ? [{ [field]: { endsWith: last9 } }, { [field]: { contains: last9 } }] : [];
  const [customer, quote, order] = await Promise.all([
    prisma.customer.findFirst({
      where: { OR: [{ email: { equals: email, mode: "insensitive" } }, ...phoneOr("phone")] },
      select: { id: true },
    }),
    prisma.quote.findFirst({
      where: {
        deletedAt: null,
        OR: [{ customerEmail: { equals: email, mode: "insensitive" } }, ...phoneOr("customerPhone")],
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
    prisma.order.findFirst({
      where: { OR: [{ clientEmail: { equals: email, mode: "insensitive" } }, ...phoneOr("clientPhone")] },
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
  repliedExternally: number;
  attachmentsBackfilled: number;
};

export type InboundMedia = { url: string; contentType: string; name: string; size: number };

const INBOX_ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;
const INBOX_ATTACHMENT_BACKFILL_PER_SYNC = 15;

/**
 * Adjuntos reales de un email (sin inline: firmas, logos) → nuestro Blob, en la
 * misma forma que las medias de WhatsApp (`mediaJson`). Así la fila de la
 * bandeja los enseña, el borrador IA los ve y "Montar presupuesto" los reutiliza
 * sin volver a bajarlos de Graph.
 */
async function ingestEmailAttachments(graphId: string): Promise<InboundMedia[]> {
  const attachments = await listInboxAttachments(graphId);
  const usable = attachments.filter((a) => {
    if (a.isInline || a.size <= 0 || a.size > INBOX_ATTACHMENT_MAX_BYTES) return false;
    if (a.contentType.startsWith("image/") && a.size < EXPEDIENTE_MIN_IMAGE_BYTES) return false; // firma/logo sin marcar inline
    return true;
  });
  const media: InboundMedia[] = [];
  for (const a of usable.slice(0, EXPEDIENTE_MAX_DOCS)) {
    const buf = await getInboxAttachmentBytes(graphId, a.id);
    const safeName = a.name.replace(/[^\w.\- ]+/g, "_").slice(0, 120);
    const blob = await put(`inbox/${Date.now()}-${safeName}`, buf, {
      access: "public",
      contentType: a.contentType,
    });
    media.push({ url: blob.url, contentType: a.contentType, name: a.name.slice(0, 255), size: buf.length });
  }
  return media;
}

/**
 * Emails ya sincronizados ANTES de que la bandeja mirase adjuntos (mediaJson
 * null): se completan poco a poco en cada sincronización. Un email sin adjuntos
 * queda con [] para no volver a consultarlo; si Graph ya no tiene el mensaje
 * (404) también se cierra con [].
 */
async function backfillEmailAttachments(): Promise<number> {
  const rows = await prisma.inboundEmail.findMany({
    where: {
      channel: "EMAIL",
      mediaJson: { equals: Prisma.AnyNull },
      NOT: { graphId: { startsWith: "manual:" } },
      receivedAt: { gte: new Date(Date.now() - FIRST_SYNC_WINDOW_MS) },
    },
    orderBy: { receivedAt: "desc" },
    take: INBOX_ATTACHMENT_BACKFILL_PER_SYNC,
    select: { id: true, graphId: true },
  });
  let done = 0;
  for (const row of rows) {
    try {
      const media = await ingestEmailAttachments(row.graphId);
      await prisma.inboundEmail.update({ where: { id: row.id }, data: { mediaJson: media } });
      done++;
    } catch (err: any) {
      console.error("[inbox] attachment backfill failed", row.id, err);
      if (/Graph \w+ 404/.test(String(err?.message || ""))) {
        await prisma.inboundEmail.update({ where: { id: row.id }, data: { mediaJson: [] } }).catch(() => {});
      }
    }
  }
  return done;
}

/**
 * Respuestas hechas FUERA de la bandeja (Outlook, móvil): si en Enviados hay
 * un mensaje del mismo hilo (conversationId) posterior al email pendiente y
 * dirigido a su remitente, el email pasa a REPLIED solo. Best-effort.
 */
async function markRepliedFromSentItems(): Promise<number> {
  const pending = await prisma.inboundEmail.findMany({
    where: { channel: "EMAIL", status: { in: ["NEW", "DRAFTED"] }, conversationId: { not: null } },
    select: { id: true, conversationId: true, fromEmail: true, receivedAt: true },
    orderBy: { receivedAt: "asc" },
    take: 200,
  });
  if (pending.length === 0) return 0;
  const since = new Date(Math.max(pending[0].receivedAt.getTime(), Date.now() - FIRST_SYNC_WINDOW_MS));
  let sent;
  try {
    sent = await listSentMessages({ since, top: 200 });
  } catch (err) {
    console.error("[inbox] sent items fetch failed", err);
    return 0;
  }
  let marked = 0;
  for (const p of pending) {
    const reply = sent.find(
      (m) =>
        m.conversationId === p.conversationId &&
        m.sentAt.getTime() > p.receivedAt.getTime() &&
        (m.toEmails.length === 0 || m.toEmails.includes(p.fromEmail.toLowerCase()))
    );
    if (!reply) continue;
    await prisma.inboundEmail.update({
      where: { id: p.id },
      data: {
        status: "REPLIED",
        replySubject: reply.subject || null,
        replyBody: reply.bodyPreview || null,
        repliedAt: reply.sentAt,
        repliedBy: "buzón (fuera de la bandeja)",
      },
    });
    marked++;
  }
  return marked;
}

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

    // Adjuntos: si falla, la fila se crea igual con mediaJson null y el
    // backfill lo reintenta en la siguiente sincronización.
    let media: InboundMedia[] | null = null;
    try {
      media = await ingestEmailAttachments(msg.graphId);
    } catch (err) {
      console.error("[inbox] attachments fetch failed", msg.graphId, err);
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
        ...(media ? { mediaJson: media } : {}),
        receivedAt: msg.receivedAt,
        customerId: match.customerId,
        quoteId: match.quoteId,
        orderReference: match.orderReference,
      },
    });
    imported++;
  }

  const repliedExternally = await markRepliedFromSentItems();
  const attachmentsBackfilled = await backfillEmailAttachments();
  return { imported, skipped, scanned: messages.length, repliedExternally, attachmentsBackfilled };
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
  channel?: "EMAIL" | "WHATSAPP";
  fromEmail: string;
  fromName: string | null;
  fromPhone?: string | null;
  mediaJson?: unknown;
}): Promise<InboundExpedienteResult> {
  const ref = expedienteRefForInbound(inbound.id);
  const sessionToken = `exp:${ref}`;

  const existing = await prisma.documentAnalysis.count({ where: { sessionToken } });
  if (existing > 0) return { ref, docs: existing, skipped: [], reused: true };

  // Medias ya en nuestro Blob: WhatsApp (las bajó el webhook) o email cuya
  // sincronización ya ingirió los adjuntos (mediaJson). Solo los emails viejos
  // sin mediaJson bajan de Graph aquí.
  const media = Array.isArray(inbound.mediaJson) ? (inbound.mediaJson as any[]) : [];
  if (inbound.channel === "WHATSAPP" || media.length > 0) {
    const skippedWa: string[] = [];
    const rowsWa = media
      .filter((m) => {
        const ct = String(m?.contentType || "").toLowerCase();
        if (!EXPEDIENTE_ALLOWED_TYPES.has(ct)) {
          skippedWa.push(`${m?.name || "archivo"} (${ct || "?"})`);
          return false;
        }
        return Boolean(m?.url);
      })
      .slice(0, EXPEDIENTE_MAX_DOCS)
      .map((m) => ({
        fileName: String(m.name || "documento").slice(0, 255),
        fileUrl: String(m.url),
        fileSize: Number(m.size) || 0,
        mimeType: String(m.contentType).toLowerCase(),
      }));
    if (rowsWa.length === 0) return { ref: null, docs: 0, skipped: skippedWa, reused: false };
    await prisma.documentAnalysis.createMany({
      data: rowsWa.map((d) => ({
        ...d,
        sessionToken,
        clientName: inbound.fromName,
        clientEmail: inbound.fromEmail,
        clientPhone: inbound.fromPhone || null,
        gdprConsent: true,
        gdprConsentAt: new Date(),
        status: "UPLOADED" as const,
      })),
    });
    return { ref, docs: rowsWa.length, skipped: skippedWa, reused: false };
  }

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
  fromPhone?: string | null;
  customerId: string | null;
  quoteId: string | null;
  orderReference: string | null;
}>(inbound: T): Promise<T> {
  if (inbound.quoteId && inbound.orderReference) return inbound;
  const match = await matchClientContext(inbound.fromEmail, inbound.fromPhone);
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
