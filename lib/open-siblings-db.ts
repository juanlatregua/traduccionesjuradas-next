import { prisma } from "@/lib/prisma";
import { SITE_BASE_URL } from "@/lib/contact";
import { emailKey, phoneKey } from "@/lib/client-identity";
import { matchOpenSiblings, blockingSibling, type OpenItem, type OpenSibling } from "@/lib/open-siblings";
import { parFromLangs } from "@/lib/lavori-dup-guard";

const QUOTE_OPEN = ["DRAFT", "SENT", "OPENED", "ACCEPTED"] as const;
const LPR_OPEN = ["SENT", "PRICED", "ACCEPTED"];

export type FindOpenSiblingsOpts = {
  email?: string | null;
  phone?: string | null;
  par?: string | null;
  days?: number;
  /** Lo que ES esta misma gestión (no cuenta como hermano). */
  excludeSession?: string | null;
  excludeQuoteId?: string | null;
  excludeLprRef?: string | null;
  excludeInboxId?: string | null;
};

/**
 * Leads, presupuestos sin pagar, solicitudes vivas en lavori y conversaciones del buzón
 * ABIERTOS de esta persona en los últimos `days` (7). Nunca lanza: ante un fallo, [].
 */
export async function findOpenSiblings(opts: FindOpenSiblingsOpts): Promise<OpenSibling[]> {
  const email = emailKey(opts.email);
  const phone = phoneKey(opts.phone);
  if (!email && !phone) return [];
  const days = opts.days ?? 7;
  const since = new Date(Date.now() - days * 86_400_000);
  try {
    const exp = opts.excludeSession ? `puerta:${opts.excludeSession}` : null;
    const [quotes, lprs, docs, inbox] = await Promise.all([
      prisma.quote.findMany({
        where: { deletedAt: null, status: { in: [...QUOTE_OPEN] }, createdAt: { gte: since }, ...(opts.excludeQuoteId ? { id: { not: opts.excludeQuoteId } } : {}) },
        select: { id: true, quoteNumber: true, customerEmail: true, customerPhone: true, createdAt: true, sourceLang: true, targetLang: true, expedienteRef: true },
      }),
      prisma.lavoriPriceRequest.findMany({
        where: { status: { in: LPR_OPEN }, createdAt: { gte: since }, ...(opts.excludeLprRef ? { ref: { not: opts.excludeLprRef } } : {}) },
        select: { ref: true, id: true, par: true, customerHint: true, createdAt: true, expedienteRef: true, quoteId: true },
      }),
      prisma.documentAnalysis.findMany({
        where: {
          createdAt: { gte: since },
          orderId: null,
          sessionToken: { not: null },
          NOT: [{ sessionToken: { startsWith: "exp:" } }, { sessionToken: { startsWith: "staff:" } }, ...(opts.excludeSession ? [{ sessionToken: opts.excludeSession }] : [])],
        },
        select: { sessionToken: true, clientEmail: true, clientPhone: true, createdAt: true, source: true, sourceLanguage: true, targetLanguage: true },
      }),
      prisma.inboundEmail.findMany({
        where: { status: { in: ["NEW", "DRAFTED"] }, receivedAt: { gte: since }, ...(opts.excludeInboxId ? { id: { not: opts.excludeInboxId } } : {}) },
        select: { id: true, channel: true, fromEmail: true, fromPhone: true, receivedAt: true, subject: true },
      }),
    ]);

    const items: OpenItem[] = [];
    const flows = new Set<string>();
    for (const q of quotes) {
      if (exp && q.expedienteRef === exp) continue;
      if (q.expedienteRef) flows.add(q.expedienteRef);
      items.push({
        kind: "quote", ref: q.quoteNumber, id: q.id, at: q.createdAt, chan: "presupuesto",
        par: parFromLangs(q.sourceLang, q.targetLang), email: q.customerEmail, phone: q.customerPhone,
        url: `${SITE_BASE_URL}/zona-traductor/presupuestos/${q.id}`,
      });
    }
    for (const l of lprs) {
      if (exp && l.expedienteRef === exp) continue;
      if (l.expedienteRef) flows.add(l.expedienteRef);
      const parts = (l.customerHint || "").split(" · ").map((x) => x.trim());
      const em = parts.find((x) => x.includes("@")) || null;
      const ph = parts.find((x) => !x.includes("@") && x.replace(/\D/g, "").length >= 9) || null;
      items.push({
        kind: "lpr", ref: l.ref, id: l.id, at: l.createdAt, chan: "lavori", par: l.par, email: em, phone: ph,
        url: `${SITE_BASE_URL}/zona-traductor/presupuesto?lead=${encodeURIComponent(l.ref)}`,
      });
    }
    const sessions = new Map<string, OpenItem>();
    for (const d of docs) {
      const tok = d.sessionToken!;
      if (flows.has(`puerta:${tok}`)) continue;
      const cur = sessions.get(tok);
      if (!cur) {
        sessions.set(tok, {
          kind: "lead", ref: `puerta:${tok.slice(0, 8)}`, id: tok, at: d.createdAt, chan: d.source === "whatsapp" ? "whatsapp" : "puerta",
          par: parFromLangs(d.sourceLanguage === "unknown" ? null : d.sourceLanguage, d.targetLanguage === "unknown" ? null : d.targetLanguage),
          email: d.clientEmail, phone: d.clientPhone,
          url: `${SITE_BASE_URL}/zona-traductor/presupuesto?session=${encodeURIComponent(tok)}`,
        });
      } else {
        cur.email ||= d.clientEmail;
        cur.phone ||= d.clientPhone;
        if (d.createdAt < cur.at) cur.at = d.createdAt;
      }
    }
    items.push(...sessions.values());
    for (const m of inbox) {
      items.push({
        kind: "inbox", ref: m.subject.slice(0, 40) || "(sin asunto)", id: m.id, at: m.receivedAt,
        chan: m.channel === "WHATSAPP" ? "whatsapp" : "email", par: null, email: m.fromEmail, phone: m.fromPhone,
        url: `${SITE_BASE_URL}/zona-traductor/presupuesto?inbox=${encodeURIComponent(m.id)}`,
      });
    }
    return matchOpenSiblings({ email, phone, par: opts.par }, items, { days });
  } catch (err) {
    console.error("[open-siblings] fallo:", err);
    return [];
  }
}

export { blockingSibling };
