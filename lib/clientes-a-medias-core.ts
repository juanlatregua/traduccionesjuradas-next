// Informe horario «clientes a medias» (orden de Juan, 21-nov-2026: el cliente decide en ~3 h;
// sin presupuesto en esa ventana se pierde). Selección y render PUROS; la consulta y el envío
// viven en lib/clientes-a-medias.ts. Interruptor CLIENTES_A_MEDIAS_INFORME=on (exacto).
import { normEmail } from "./vigia-persona.ts";
import { isExcludedLeadEmail } from "./lead-sla-core.ts";
import { hasPaidOrder, type PaidOrderLike } from "./paid-orders.ts";
import { clientDraft, langEs, mailtoDraft, noPresupuestable, type NoPresupuestable } from "./no-presupuestable.ts";
import { madridParts } from "./panel-period.ts";

export const INFORME_WINDOW_HOURS = 6;
export const DECISION_MIN = 180;
export const INFORME_FROM_HOUR = 8;
export const INFORME_UNTIL_HOUR = 21; // última pasada a las 21:00 Madrid
const SITE = "https://www.traduccionesjuradas.net";

export const informeOn = (env: Record<string, string | undefined> = process.env) => env.CLIENTES_A_MEDIAS_INFORME === "on";

export const madridHour = (now: Date) => madridParts(now).h;
/** El cron corre en UTC (0 6-20 * * *): solo las pasadas de 08:00 a 21:00 Madrid informan. */
export const informeHourOk = (now: Date) => {
  const h = madridHour(now);
  return h >= INFORME_FROM_HOUR && h <= INFORME_UNTIL_HOUR;
};

export type PuertaDocRow = {
  sessionToken: string;
  createdAt: Date;
  clientEmail: string | null;
  clientName: string | null;
  clientPhone: string | null;
  sourceLanguage: string | null;
  targetLanguage: string | null;
  estimatedWords: number | null;
  quoteAmount: number | null;
  status: string;
  casoId: string | null;
  fileHash: string | null;
};

export type EntradaInforme = {
  id: string;
  estado: string;
  createdAt: Date;
  email: string | null;
  emailVerified: boolean;
  phone9: string | null;
  nombre: string | null;
  sourceLang: string | null;
  targetLang: string | null;
  casoId: string | null;
  files: number;
  leida: boolean;
  fileHash: string | null;
};

export type InformeQuote = {
  id: string;
  quoteNumber: string;
  sentAt: Date | null;
  createdAt: Date;
  customerEmail: string | null;
  expedienteRef: string | null;
  casoId: string | null;
};

export type HeldDraft = { quoteId: string; quoteNumber: string; reasons: string[] };

export type InformeInput = {
  now: Date;
  docs: PuertaDocRow[];
  entradas: EntradaInforme[];
  quotes: InformeQuote[];
  paidOrders: PaidOrderLike[];
  staffEmails?: string[];
  held?: HeldDraft[];
};

export type InformeItem = {
  key: string;
  kind: "puerta" | "entrada";
  firstAt: Date;
  minutes: number;
  minutesLeft: number;
  files: number;
  email: string | null;
  name: string | null;
  phone: string | null;
  pair: string;
  words: number | null;
  price: number | null;
  draft: { id: string; quoteNumber: string; held: string[] | null } | null;
  link: string;
  noPresupuestable: NoPresupuestable | null;
};

const ANALYZED = new Set(["ANALYZED", "QUOTE_GENERATED", "PAYMENT_PENDING", "ANALYSIS_FAILED"]);
const pairOf = (a: string | null | undefined, b: string | null | undefined) => `${a || "?"}→${b || "?"}`;

export function selectClientesAMedias(input: InformeInput): InformeItem[] {
  const { now } = input;
  const since = now.getTime() - INFORME_WINDOW_HOURS * 36e5;
  const staff = input.staffEmails || [];
  const held = new Map((input.held || []).map((h) => [h.quoteId, h.reasons]));

  const base: (Omit<InformeItem, "draft" | "minutes" | "minutesLeft"> & { refs: string[]; casoId: string | null; hashes: (string | null)[] })[] = [];

  const bySession = new Map<string, PuertaDocRow[]>();
  for (const d of input.docs) bySession.set(d.sessionToken, [...(bySession.get(d.sessionToken) || []), d]);
  for (const [token, rows] of bySession) {
    const firstAt = new Date(Math.min(...rows.map((r) => r.createdAt.getTime())));
    if (firstAt.getTime() < since) continue;
    const email = rows.map((r) => r.clientEmail).find(Boolean) || null;
    if (isExcludedLeadEmail(email, staff)) continue;
    const words = rows.every((r) => r.estimatedWords == null) ? null : rows.reduce((s, r) => s + (r.estimatedWords || 0), 0);
    const prices = rows.map((r) => r.quoteAmount).filter((x): x is number => x != null);
    const src = rows.map((r) => r.sourceLanguage).find(Boolean) || null;
    const tgt = rows.map((r) => r.targetLanguage).find(Boolean) || null;
    const analyzed = rows.every((r) => ANALYZED.has(r.status));
    base.push({
      key: `s:${token}`,
      kind: "puerta",
      firstAt,
      files: rows.length,
      email: email ? normEmail(email) : null,
      name: rows.map((r) => r.clientName).find(Boolean) || null,
      phone: rows.map((r) => r.clientPhone).find(Boolean) || null,
      pair: pairOf(src, tgt),
      words,
      price: prices.length ? Math.round(prices.reduce((s, p) => s + p, 0) * 100) / 100 : null,
      link: `${SITE}/zona-traductor/presupuesto?session=${encodeURIComponent(token)}`,
      noPresupuestable: noPresupuestable({ sourceLanguage: src, targetLanguage: tgt, estimatedWords: words, analyzed }),
      refs: [`puerta:${token}`, `puerta:exp:${token}`],
      casoId: rows.map((r) => r.casoId).find(Boolean) || null,
      hashes: rows.map((r) => r.fileHash),
    });
  }

  for (const e of input.entradas) {
    if (e.estado === "prueba" || e.createdAt.getTime() < since) continue;
    if (isExcludedLeadEmail(e.email, staff)) continue;
    const session = `entrada:${e.id}`;
    base.push({
      key: `e:${e.id}`,
      kind: "entrada",
      firstAt: e.createdAt,
      files: e.files,
      email: e.email ? normEmail(e.email) : null,
      name: e.nombre,
      phone: e.phone9,
      pair: pairOf(e.sourceLang, e.targetLang),
      words: null,
      price: null,
      link: e.casoId ? `${SITE}/zona-traductor/lectura?caso=${encodeURIComponent(e.casoId)}` : `${SITE}/zona-traductor/lectura?session=${encodeURIComponent(session)}`,
      noPresupuestable: noPresupuestable({ sourceLanguage: e.sourceLang, targetLanguage: e.targetLang, noJurado: e.estado === "sin_jurado", hasFiles: e.files > 0 }),
      refs: [session],
      casoId: e.casoId,
      hashes: [e.fileHash],
    });
  }

  const out: InformeItem[] = [];
  for (const b of base) {
    const mine = (q: InformeQuote) =>
      (!!q.expedienteRef && b.refs.includes(q.expedienteRef)) || (!!b.casoId && q.casoId === b.casoId) || (!!b.email && normEmail(q.customerEmail) === b.email);
    const recent = (q: InformeQuote) => (q.sentAt || q.createdAt).getTime() >= b.firstAt.getTime() - 2 * 36e5;
    const ours = input.quotes.filter((q) => mine(q) && recent(q));
    if (ours.some((q) => q.sentAt)) continue;
    if ((b.email || b.phone) && hasPaidOrder({ email: b.email, phone: b.phone, at: b.firstAt, hashes: b.hashes }, input.paidOrders)) continue;
    const d = ours.filter((q) => !q.sentAt).sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime())[0];
    const minutes = Math.max(0, Math.floor((now.getTime() - b.firstAt.getTime()) / 60000));
    const { refs, casoId, hashes, ...item } = b;
    out.push({ ...item, minutes, minutesLeft: DECISION_MIN - minutes, draft: d ? { id: d.id, quoteNumber: d.quoteNumber, held: held.get(d.id) ?? null } : null });
  }
  return out.sort((a, b) => b.minutes - a.minutes);
}

/** Estado de una fila para decidir si hay algo NUEVO que contar. */
export function itemState(i: InformeItem): string {
  const phase = i.minutes >= DECISION_MIN ? "3h" : i.minutes >= 150 ? "2h30" : i.minutes >= 60 ? "1h" : "0";
  const what = i.noPresupuestable ? `np-${i.noPresupuestable.code}` : i.draft ? (i.draft.held ? "retenido" : "borrador") : i.email || i.phone ? "lead" : "anonimo";
  return `${i.key}|${what}|${phase}`;
}

/** Estados no contados aún hoy. Vacío = no se envía nada. */
export function newStates(items: InformeItem[], alreadySent: Iterable<string>): string[] {
  const seen = new Set(alreadySent);
  return items.map(itemState).filter((s) => !seen.has(s));
}

export type DayCounter = { entradas: number; leads: number; subidasSinEmail: number; enviados: number; pagados: number };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const hhmm = (d: Date) => new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
const left = (m: number) => (m > 0 ? `quedan ${m} min de las 3 h` : `PASADAS las 3 h (hace ${-m} min)`);

function progress(i: InformeItem): string {
  const steps = [`${i.files} archivo${i.files === 1 ? "" : "s"}`, i.email ? `email ${i.email}` : i.phone ? `tel. ${i.phone}` : "SIN email", `par ${i.pair}`];
  if (i.words != null) steps.push(`${i.words} pal.`);
  if (i.price != null) steps.push(`precio visto ${i.price.toFixed(2).replace(".", ",")} €`);
  return steps.join(" · ");
}

export function renderInforme(items: InformeItem[], day: DayCounter, fresh: Set<string>): { subject: string; html: string; sms: string } {
  const normal = items.filter((i) => !i.noPresupuestable);
  const np = items.filter((i) => i.noPresupuestable);
  const late = normal.filter((i) => i.minutesLeft <= 30).length;
  const nuevo = (i: InformeItem) => (fresh.has(itemState(i)) ? ' <b style="color:#1d4ed8">NUEVO</b>' : "");
  const row = (i: InformeItem) => {
    const who = esc(i.name || i.email || i.phone || "Anónimo");
    const draft = i.draft
      ? `<br><a href="${SITE}/zona-traductor/presupuestos/${esc(i.draft.id)}">Borrador ${esc(i.draft.quoteNumber)}</a>${i.draft.held ? ` — no sale solo: ${esc(i.draft.held.join("; "))}` : " — revisa y envía"}`
      : "";
    const np = i.noPresupuestable;
    const d = np ? mailtoDraft(i.email, clientDraft(np, i.name)) : null;
    const falta = np ? `<br><b style="color:#b45309">Falta: ${esc(np.falta)}</b>${d ? ` · <a href="${esc(d)}">Borrador al cliente (no enviado)</a>` : " · sin email: pedirlo por teléfono"}` : "";
    return `<li style="margin-bottom:10px"><b>${who}</b>${nuevo(i)} — llegó ${hhmm(i.firstAt)} (${i.kind}) · <b${i.minutesLeft <= 30 ? ' style="color:#b91c1c"' : ""}>${left(i.minutesLeft)}</b><br>${esc(progress(i))}${draft}${falta}<br><a href="${esc(i.link)}">Hacer presupuesto</a></li>`;
  };
  const counter = `<p><b>Hoy:</b> ${day.entradas} entradas/sesiones (${day.leads} con contacto, ${day.subidasSinEmail} subidas sin email) · ${day.enviados} presupuestos enviados · ${day.pagados} pedidos pagados</p>`;
  const html =
    counter +
    `<h3>Sin presupuesto (últimas ${INFORME_WINDOW_HOURS} h): ${normal.length}</h3>` +
    (normal.length ? `<ul style="padding-left:18px">${normal.map(row).join("")}</ul>` : "<p>Ninguno.</p>") +
    (np.length ? `<h3>No presupuestables: ${np.length}</h3><p>Falta un dato del cliente: el borrador está listo, nadie lo ha enviado.</p><ul style="padding-left:18px">${np.map(row).join("")}</ul>` : "");
  const subject = `${late ? "URGENTE · " : ""}Clientes a medias: ${normal.length} sin presupuesto${np.length ? ` · ${np.length} no presupuestable${np.length > 1 ? "s" : ""}` : ""} · hoy ${day.pagados} pagado${day.pagados === 1 ? "" : "s"}`;
  const oldest = normal[0];
  const sms = `${late ? "URGENTE · " : ""}Clientes a medias: ${normal.length} sin presupuesto${oldest ? ` (el más antiguo ${oldest.minutes} min, ${oldest.minutesLeft > 0 ? `quedan ${oldest.minutesLeft}` : "pasadas las 3 h"})` : ""}${np.length ? `, ${np.length} no presupuestable(s): ${np.slice(0, 2).map((i) => langEs(i.pair.split("→")[0]) + " " + i.noPresupuestable!.code).join("; ")}` : ""}. Hoy ${day.enviados} enviados/${day.pagados} pagados. Detalle en el email.`.slice(0, 300);
  return { subject, html, sms };
}
