// lib/quote-manual-contact.ts — Constancia de un contacto MANUAL con el cliente de un presupuesto
// (email enviado a mano). Es un MessageLog REMINDER/SENT: el cron de recordatorios
// (app/api/quotes/reminders) lo cuenta como el 2º contacto y arranca desde él las 24 h del cierre.

import { prisma } from "@/lib/prisma";

export const MANUAL_CONTACT_PREFIX = "[contacto manual]";

export async function recordManualQuoteContact(opts: { quoteId: string; recipient: string; subject?: string | null; body?: string | null; at?: Date }) {
  const at = opts.at ?? new Date();
  return prisma.messageLog.create({
    data: {
      quoteId: opts.quoteId,
      channel: "EMAIL",
      type: "REMINDER",
      recipient: opts.recipient,
      subject: opts.subject || null,
      body: `${MANUAL_CONTACT_PREFIX} ${String(opts.body || "").slice(0, 2000)}`.trim(),
      sentAt: at,
      status: "SENT",
    },
  });
}
