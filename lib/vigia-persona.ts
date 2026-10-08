// lib/vigia-persona.ts — lógica PURA (sin BD ni alias) del vigía por PERSONA.
// Una persona = email normalizado + teléfono (últimos 9 dígitos, también el de
// <digitos>@whatsapp.local) + sesión de la puerta + expediente + huella del
// documento. Todo lo que comparta una clave es la misma persona (8-oct-2026:
// Yannick salía «mandar solicitud» con presupuesto enviado; Paloma, dos filas).

export const DAY_MS = 864e5;
/** Tras un toque (WhatsApp, recordatorio, «ya lo traté») no se vuelve a avisar hasta pasar esto. */
export const CHASE_GAP_DAYS = 4;
/** Tras dos toques sin respuesta la acción pasa a «marcar No aceptado». */
export const MAX_TOUCHES = 2;
export const POSTPONE_DAYS = 7;
export const MARK_TRATADO = "vigia:tratado";
export const MARK_POSPONER = "vigia:posponer";

const TZ_OFFSET_MS = 2 * 3600e3;
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
/** 2-oct */
export const fmtDay = (d: Date | string) => {
  const x = new Date(new Date(d).getTime() + TZ_OFFSET_MS);
  return `${x.getUTCDate()}-${MONTHS[x.getUTCMonth()]}`;
};

/* ───────── Claves de persona ───────── */
export const normEmail = (e: string | null | undefined) => String(e || "").trim().toLowerCase();
export const phoneDigits9 = (p: string | null | undefined) => {
  const d = String(p || "").replace(/\D/g, "");
  return d.length >= 9 ? d.slice(-9) : "";
};
const WA_LOCAL = /^(\d{8,15})@whatsapp\.local$/;

export function personKeys(i: { emails?: (string | null | undefined)[]; phones?: (string | null | undefined)[]; sessions?: (string | null | undefined)[]; refs?: (string | null | undefined)[]; hashes?: (string | null | undefined)[]; quoteIds?: (string | null | undefined)[] }): string[] {
  const out = new Set<string>();
  for (const raw of i.emails || []) {
    const e = normEmail(raw);
    if (!e) continue;
    const wa = WA_LOCAL.exec(e);
    if (wa) { const p = phoneDigits9(wa[1]); if (p) out.add(`p:${p}`); } else out.add(`e:${e}`);
  }
  for (const p of i.phones || []) { const d = phoneDigits9(p); if (d) out.add(`p:${d}`); }
  for (const s of i.sessions || []) if (s) out.add(`s:${s}`);
  for (const r of i.refs || []) if (r) { out.add(`x:${r}`); if (r.startsWith("puerta:")) out.add(`s:${r.slice(7)}`); }
  for (const h of i.hashes || []) if (h) out.add(`h:${h}`);
  for (const q of i.quoteIds || []) if (q) out.add(`q:${q}`);
  return [...out];
}

/** Emails y teléfonos metidos en texto libre (LavoriPriceRequest.customerHint). */
export function textKeys(text: string | null | undefined): string[] {
  const t = String(text || "");
  const emails = t.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  const phones = (t.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, " ").match(/\+?\d[\d\s().-]{7,}\d/g) || []);
  return personKeys({ emails, phones });
}

/** Clave estable para las marcas «hecho»: teléfono > email > lo demás. */
export function primaryKey(keys: string[]): string | null {
  return keys.find((k) => k.startsWith("p:")) || keys.find((k) => k.startsWith("e:")) || keys.find((k) => k.startsWith("s:")) || keys[0] || null;
}

const MAX_EMAILS_PER_PHONE = 3; // más que eso = intermediario (Ahmed, un despacho): no une personas

export class PersonIndex {
  private parent = new Map<string, string>();
  constructor(items: { keys: string[]; name?: string | null }[]) {
    // Un teléfono compartido por muchos emails, o por 2 emails con distinto nombre, es un
    // intermediario (Ahmed, un despacho): no une personas.
    const emailsOfPhone = new Map<string, Set<string>>();
    const namesOfPhone = new Map<string, Set<string>>();
    for (const it of items) {
      const es = it.keys.filter((k) => k.startsWith("e:"));
      const nm = String(it.name || "").trim().toLowerCase();
      for (const k of it.keys) if (k.startsWith("p:")) {
        const s = emailsOfPhone.get(k) || new Set(); es.forEach((e) => s.add(e)); emailsOfPhone.set(k, s);
        if (nm && es.length) { const n = namesOfPhone.get(k) || new Set(); n.add(nm); namesOfPhone.set(k, n); }
      }
    }
    const banned = new Set([...emailsOfPhone].filter(([k, s]) => s.size > MAX_EMAILS_PER_PHONE || (s.size >= 2 && (namesOfPhone.get(k)?.size || 0) >= 2)).map(([k]) => k));
    for (const it of items) {
      const ks = it.keys.filter((k) => !banned.has(k));
      for (const k of ks) if (!this.parent.has(k)) this.parent.set(k, k);
      for (let i = 1; i < ks.length; i++) this.union(ks[0], ks[i]);
    }
  }
  private find(k: string): string {
    let r = k;
    while (this.parent.get(r) !== r) r = this.parent.get(r)!;
    let c = k;
    while (this.parent.get(c) !== r) { const n = this.parent.get(c)!; this.parent.set(c, r); c = n; }
    return r;
  }
  private union(a: string, b: string) { const ra = this.find(a), rb = this.find(b); if (ra !== rb) this.parent.set(rb, ra); }
  /** Id de persona de unas claves (la primera conocida), o null. */
  rootOf(keys: string[]): string | null {
    for (const k of keys) if (this.parent.has(k)) return this.find(k);
    return null;
  }
  keysOf(root: string): string[] {
    return [...this.parent.keys()].filter((k) => this.find(k) === root);
  }
}

/* ───────── Estado de seguimiento ───────── */
export type ContactLog = { channel: string; type: string; status: string; at: Date | string | null; body?: string | null };
export type ChaseMark = { kind: "tratado" | "posponer"; at: Date | string; mirrored?: boolean };

export type ChaseState = {
  hidden: boolean;
  reason: string | null;
  touches: number;
  lastContact: Date | null;
  line: string;
};

/** ¿Qué se le ha dicho ya a esta persona y cuándo se le puede volver a avisar? */
export function chaseState(logs: ContactLog[], marks: ChaseMark[], now: Date, opens = 0): ChaseState {
  const contacts: { at: Date; label: string }[] = [];
  let touches = 0;
  let postponedUntil: Date | null = null;
  const marksAll: ChaseMark[] = [...marks];
  for (const l of logs) {
    if (l.status !== "SENT" || !l.at || l.type === "PAID_CONFIRMATION") continue;
    const at = new Date(l.at);
    if (l.body?.startsWith(MARK_POSPONER)) { marksAll.push({ kind: "posponer", at, mirrored: true }); continue; }
    if (l.body?.startsWith(MARK_TRATADO)) { marksAll.push({ kind: "tratado", at, mirrored: true }); continue; }
    if (l.type === "REMINDER") { touches++; contacts.push({ at, label: `recordatorio ${fmtDay(at)}` }); }
    else if (l.type === "DRAFT_WHATSAPP" || l.channel === "WHATSAPP") { touches++; contacts.push({ at, label: `WhatsApp ${fmtDay(at)}` }); }
    else if (l.type === "PAY_LINK" || l.type === "RESEND_PAY_LINK") contacts.push({ at, label: `enviado ${fmtDay(at)}` });
    else contacts.push({ at, label: `${l.channel === "SMS" ? "SMS" : "email"} ${fmtDay(at)}` });
  }
  for (const m of marksAll) {
    const at = new Date(m.at);
    if (m.kind === "posponer") { const until = new Date(at.getTime() + POSTPONE_DAYS * DAY_MS); if (!postponedUntil || until > postponedUntil) postponedUntil = until; }
    else contacts.push({ at, label: `tratado ${fmtDay(at)}` });
  }
  contacts.sort((a, b) => a.at.getTime() - b.at.getTime());
  const last = contacts.length ? contacts[contacts.length - 1].at : null;
  let reason: string | null = null;
  if (postponedUntil && postponedUntil > now) reason = `pospuesto hasta ${fmtDay(postponedUntil)}`;
  else if (last && now.getTime() - last.getTime() < CHASE_GAP_DAYS * DAY_MS) reason = `tocado ${fmtDay(last)} (re-aviso a los ${CHASE_GAP_DAYS} d)`;
  const parts = [...new Set(contacts.map((c) => c.label))].slice(-3);
  if (opens > 0) parts.push(`abierto ${opens} ${opens === 1 ? "vez" : "veces"}`);
  return { hidden: !!reason, reason, touches, lastContact: last, line: parts.join(" · ") };
}

/* ───────── Consolidación: una fila por persona / pedido ───────── */
export type RawAction = {
  stake: number;
  urgencia: number;
  que: string;
  link: string;
  /** Agrupa: «o:REF» un pedido, «f:ID» una factura, o la persona. Sin clave = fila propia. */
  key?: string | null;
  /** 0 = pedido ya pagado (siempre antes), 1 = dinero en juego. */
  tier?: 0 | 1;
  persona?: { key: string; quoteId?: string | null } | null;
  estado?: string;
};
export type ActionRow = RawAction & { extras?: string[] };

export function consolidate(actions: RawAction[]): ActionRow[] {
  const rank = (a: RawAction) => (a.tier ?? 1) * 1e12 - (a.urgencia * 1e6 + a.stake);
  const groups = new Map<string, RawAction[]>();
  actions.forEach((a, i) => {
    const k = a.key || `solo:${i}`;
    groups.set(k, [...(groups.get(k) || []), a]);
  });
  const rows: ActionRow[] = [];
  for (const list of groups.values()) {
    list.sort((a, b) => rank(a) - rank(b));
    const head = list[0];
    const extras = list.slice(1).map((a) => a.que).filter((q, i, arr) => q !== head.que && arr.indexOf(q) === i);
    rows.push({
      ...head,
      stake: Math.max(...list.map((a) => a.stake)),
      tier: Math.min(...list.map((a) => a.tier ?? 1)) as 0 | 1,
      estado: list.find((a) => a.estado)?.estado,
      persona: list.find((a) => a.persona)?.persona ?? head.persona,
      extras: extras.length ? extras : undefined,
    });
  }
  return rows.sort((a, b) => rank(a) - rank(b));
}

/* ───────── Solicitudes duplicadas ───────── */
export const normPar = (p: string | null | undefined) => String(p || "").toLowerCase().replace(/[^a-z]+/g, ">");
type SolLite = { ref: string; par: string; status: string; quoteId?: string | null; createdAt: Date };
type QuoteLite = { par: string; createdAt: Date };

/** Para una solicitud de una persona: la hermana (mismo par) ya con precio o presupuesto, y el presupuesto
 * del mismo par posterior a ella. Si hay alguna, la solicitud SENT es un duplicado que se retira. */
export function duplicateOf<Q extends QuoteLite>(s: SolLite, sols: SolLite[], quotes: Q[]): { hermana: SolLite | null; quote: Q | null } {
  const hermana = sols.find((o) => o.ref !== s.ref && normPar(o.par) === normPar(s.par) && (o.status === "PRICED" || o.status === "ACCEPTED" || !!o.quoteId)) || null;
  const quote = quotes.find((x) => normPar(x.par) === normPar(s.par) && x.createdAt >= s.createdAt) || null;
  return { hermana, quote };
}

/** Emails de intermediario: el mismo email con varios expedientes o titulares distintos entre sus
 * presupuestos (Nuria, 00227/00228). No identifican a una persona: cada presupuesto va solo. */
export function intermediaryEmails(quotes: { email: string; expRef?: string | null; holder?: string | null }[]): Set<string> {
  const by = new Map<string, { refs: Set<string>; holders: Set<string> }>();
  for (const q of quotes) {
    const e = normEmail(q.email);
    if (!e) continue;
    const v = by.get(e) || { refs: new Set(), holders: new Set() };
    if (q.expRef) v.refs.add(q.expRef);
    if (q.holder && q.holder.trim()) v.holders.add(q.holder.trim().toLowerCase());
    by.set(e, v);
  }
  return new Set([...by].filter(([, v]) => v.refs.size >= 2 || v.holders.size >= 2).map(([e]) => e));
}
