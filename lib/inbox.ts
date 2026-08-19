// Bandeja de entrada — sincroniza el buzón (Graph) a la tabla InboundEmail y
// casa cada email con Customer/Quote/Order por dirección. El match es
// best-effort: guía al staff, no bloquea nada.

import { prisma } from "@/lib/prisma";
import { getMailboxAddress } from "@/lib/azure-mail";
import { listInboxMessages, getInboxMessage } from "@/lib/azure-mail-read";
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
  return /^(no-?reply|noreply|notifications?|mailer-daemon|postmaster)@/i.test(email);
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
