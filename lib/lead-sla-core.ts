// Selección PURA de leads sin presupuesto enviado (regla de Juan, 22-oct-2026: precio
// competitivo en 3-4 h; pasadas 24 h ya no se avisa). La consulta
// y el envío viven en lib/lead-sla.ts.
import { buildPersonGraph, type GraphLead, type GraphOrder, type GraphQuote, type GraphSolicitud } from "./vigia-graph.ts";
import { normEmail, primaryKey } from "./vigia-persona.ts";

export const SLA_STAGE1_MIN = 60;
export const SLA_STAGE2_MIN = 150;
export const SLA_WINDOW_HOURS = 24;
export const SLA_SMS_FROM_HOUR = 8;
export const SLA_SMS_UNTIL_HOUR = 22;
const SITE = "https://www.traduccionesjuradas.net";
const TEST_EMAIL = /yopmail\.com$|mailinator\.com$|^prueba@|^test@/;

export type SlaDoc = GraphLead & { fileName: string | null; sourceLanguage: string | null; targetLanguage: string | null; estimatedWords: number | null; quoteAmount: number | string | null; createdAt: Date };
export type SlaInbound = { fromEmail: string; fromName: string | null; fromPhone: string | null; subject: string; receivedAt: Date; status: string; quoteId: string | null; repliedAt: Date | null; channel: string };
export type SlaSolicitud = GraphSolicitud & { status: string; priceCents: number | null; par: string; createdAt: Date };
export type SlaQuote = GraphQuote & { sentAt: Date | null; createdAt: Date };

export type SlaInput = {
  now: Date;
  docs: SlaDoc[];
  inbound: SlaInbound[];
  solicitudes: SlaSolicitud[];
  quotes: SlaQuote[];
  paidOrders: GraphOrder[];
  hashesOfQuote?: Map<string, string[]>;
  staffEmails?: string[];
};

export type SlaLead = {
  root: string;
  keyBase: string;
  altBases: string[];
  name: string | null;
  email: string | null;
  phone: string | null;
  pairs: string[];
  motor: number | null;
  firstAt: Date;
  minutes: number;
  stage: 1 | 2;
  via: string[];
  links: string[];
};

type Arrival = GraphLead & { at: Date; kind: "puerta" | "email" | "whatsapp" | "lavori"; name: string | null; email: string | null; phone: string | null; pair: string | null; fileKey: string | null; motor: number | null; link: string };

const WA_LOCAL = /^(\d{8,15})@whatsapp\.local$/;
const pairOf = (a: string | null | undefined, b: string | null | undefined) => `${a || "?"}→${b || "?"}`;

export const stageFor = (minutes: number): 0 | 1 | 2 => (minutes >= SLA_STAGE2_MIN ? 2 : minutes >= SLA_STAGE1_MIN ? 1 : 0);
export const dedupeId = (base: string, stage: number) => `lead-sla:${base}:${stage}`;

/** SMS solo de 08:00 a 22:00 hora de Madrid (el email sale siempre). */
export function smsAllowed(now: Date): boolean {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", hourCycle: "h23" }).format(now));
  return h >= SLA_SMS_FROM_HOUR && h < SLA_SMS_UNTIL_HOUR;
}

export function selectLeadSla(input: SlaInput): SlaLead[] {
  const { now, docs, inbound, solicitudes, quotes, paidOrders } = input;
  const staff = new Set((input.staffEmails || []).map(normEmail).filter(Boolean));
  const since = now.getTime() - SLA_WINDOW_HOURS * 36e5;
  const excluded = (email: string | null | undefined) => {
    const e = normEmail(email);
    return !!e && (TEST_EMAIL.test(e) || staff.has(e));
  };

  const arrivals: Arrival[] = [];
  const attendedKeys: GraphLead[] = [];
  for (const d of docs) {
    if (excluded(d.clientEmail)) continue;
    arrivals.push({
      clientEmail: d.clientEmail, clientName: d.clientName, clientPhone: d.clientPhone, sessionToken: d.sessionToken, fileHash: d.fileHash,
      at: d.createdAt, kind: "puerta", name: d.clientName, email: d.clientEmail ? normEmail(d.clientEmail) : null, phone: d.clientPhone,
      pair: pairOf(d.sourceLanguage, d.targetLanguage), fileKey: `${d.fileName}|${d.sourceLanguage}|${d.targetLanguage}|${d.estimatedWords}`,
      motor: d.quoteAmount == null ? null : Number(d.quoteAmount),
      link: `${SITE}/zona-traductor/presupuesto?session=${encodeURIComponent(d.sessionToken || "")}`,
    });
  }
  for (const m of inbound) {
    if (excluded(m.fromEmail)) continue;
    const lead: GraphLead = { clientEmail: m.fromEmail, clientName: m.fromName, clientPhone: m.fromPhone, sessionToken: null, fileHash: null };
    if (m.repliedAt || m.status === "REPLIED" || m.status === "ARCHIVED") { attendedKeys.push(lead); continue; }
    // El email del buzón no trae clasificación fiable (briefJson solo se genera a mano): solo WhatsApp.
    if (m.status !== "NEW" || m.quoteId || m.channel !== "WHATSAPP") continue;
    const wa = WA_LOCAL.exec(normEmail(m.fromEmail));
    arrivals.push({
      ...lead, at: m.receivedAt, kind: m.channel === "WHATSAPP" ? "whatsapp" : "email", name: m.fromName, email: wa ? null : normEmail(m.fromEmail),
      phone: m.fromPhone || (wa ? `+${wa[1]}` : null), pair: null, fileKey: null, motor: null, link: `${SITE}/admin/inbox`,
    });
  }
  for (const s of solicitudes) {
    if (s.status !== "SENT" || s.priceCents != null || s.createdAt.getTime() < since) continue;
    arrivals.push({
      clientEmail: null, clientName: null, clientPhone: null, sessionToken: null, fileHash: null,
      at: s.createdAt, kind: "lavori", name: s.customerHint, email: null, phone: null, pair: s.par, fileKey: null, motor: null,
      link: `${SITE}/zona-traductor/presupuesto?lead=${encodeURIComponent(s.ref)}`,
    });
  }

  // Las solicitudes entran al grafo por su customerHint/ref; las llegadas de lavori se resuelven con solKeys.
  const solArrivals = arrivals.filter((a) => a.kind === "lavori");
  const personArrivals = arrivals.filter((a) => a.kind !== "lavori");
  const g = buildPersonGraph({
    quotes,
    solicitudes,
    leadDocs: [...personArrivals, ...attendedKeys.map((l) => ({ ...l }))],
    paidOrders,
    hashesOfQuote: input.hashesOfQuote || new Map(),
  });

  const attendedRoots = new Set<string>(g.paidRoots);
  for (const l of attendedKeys) { const r = g.rootOf(g.leadKeys(l)); if (r) attendedRoots.add(r); }

  const byRoot = new Map<string, Arrival[]>();
  const push = (root: string | null, a: Arrival) => { if (root) byRoot.set(root, [...(byRoot.get(root) || []), a]); };
  for (const a of personArrivals) push(g.rootOf(g.leadKeys(a)), a);
  const pendingSols = solicitudes.filter((s) => s.status === "SENT" && s.priceCents == null && s.createdAt.getTime() >= since);
  pendingSols.forEach((s, i) => push(g.rootOf(g.solKeys(s)), solArrivals[i]));

  const out: SlaLead[] = [];
  for (const [root, items] of byRoot) {
    if (attendedRoots.has(root)) continue;
    if (items.every((a) => a.kind === "whatsapp") && (g.quotesOfRoot.get(root)?.length || g.solsOfRoot.get(root)?.length)) continue;
    const firstAt = new Date(Math.min(...items.map((a) => a.at.getTime())));
    // Un presupuesto enviado antes de que llegara la petición no la contesta.
    if ((g.quotesOfRoot.get(root) || []).some((q) => q.sentAt && q.sentAt.getTime() >= firstAt.getTime() - 2 * 36e5)) continue;
    if (firstAt.getTime() < since) continue;
    const minutes = Math.floor((now.getTime() - firstAt.getTime()) / 60000);
    const stage = stageFor(minutes);
    if (!stage) continue;
    if (stage === 1 && (g.quotesOfRoot.get(root) || []).some((q) => !q.sentAt && q.createdAt.getTime() >= firstAt.getTime())) continue;
    const keys = g.idx.keysOf(root);
    const keyBase = primaryKey([...keys].sort()) || root;
    const seen = new Set<string>();
    const docsOnce = items.filter((a) => { if (!a.fileKey) return false; if (seen.has(a.fileKey)) return false; seen.add(a.fileKey); return true; });
    const motors = docsOnce.map((a) => a.motor).filter((m): m is number => m != null);
    const sorted = items.slice().sort((a, b) => a.at.getTime() - b.at.getTime());
    out.push({
      root,
      keyBase,
      altBases: keys.filter((k) => (k.startsWith("e:") || k.startsWith("p:")) && k !== keyBase).slice(0, 10),
      name: sorted.map((a) => a.name).find((n) => !!n) || null,
      email: sorted.map((a) => a.email).find((n) => !!n) || null,
      phone: sorted.map((a) => a.phone).find((n) => !!n) || null,
      pairs: [...new Set(items.map((a) => a.pair).filter((p): p is string => !!p))],
      motor: motors.length ? motors.reduce((s, m) => s + m, 0) : null,
      firstAt,
      minutes,
      stage,
      via: [...new Set(items.map((a) => a.kind))],
      links: [...new Set(sorted.map((a) => a.link))],
    });
  }
  return out.sort((a, b) => b.minutes - a.minutes);
}
