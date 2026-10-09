// lib/respuesta-guard.ts — lógica PURA (sin BD ni alias) de dos frenos a lo automático
// (caso Hella, 9-oct-2026):
//  1) la puerta no escribe a quien ya tiene un presupuesto vivo / un pedido pagado (30 días),
//     aunque el presupuesto esté por WhatsApp (email marcador) y la puerta tenga su email real;
//  2) el cierre suave y el 2º contacto no actúan si el cliente ha contestado después del
//     último contacto (y, si no se puede saber, no cierran).
// La lectura de BD y de Graph vive en lib/respuesta-guard-db.ts.

import { phoneKey, realEmailKey, isPlaceholderEmailKey } from "./client-identity.ts";

export type Pair = { email?: string | null; phone?: string | null };
export type Identity = { emails: Set<string>; phones: Set<string> };

/** Una clave con más de MAX_FANOUT contrapartes es un intermediario: no liga a nadie. */
export const MAX_FANOUT = 3;
export const LIVE_DAYS = 30;

/** Email-marcador (<dígitos>@whatsapp.local) → su teléfono; un teléfono suelto → su clave. */
function normPair(p: Pair): { e: string; ph: string } {
  const e = realEmailKey(p.email);
  const ph = phoneKey(p.phone) || (isPlaceholderEmailKey(p.email) ? phoneKey(String(p.email).split("@")[0]) : "");
  return { e, ph };
}

const OWN_DOMAINS = /@(traduccionesjuradas\.net|lavori\.es|holabonjour\.es)$/i;

/** Buzón propio / dominios del grupo: nunca identifican a un cliente. `extra` = EMAIL_FROM, staff… */
export function isOwnAddress(email: string | null | undefined, extra: (string | null | undefined)[] = []): boolean {
  const e = String(email || "").trim().toLowerCase();
  if (!e) return false;
  return OWN_DOMAINS.test(e) || extra.some((x) => String(x || "").trim().toLowerCase() === e);
}

export type Fanout = (kind: "email" | "phone", key: string) => number;

/**
 * Identidad de una persona: lo suyo más UN salto directo: el teléfono que acompaña a su email (o el email
 * que acompaña a su teléfono) en un mismo registro. Nunca email→teléfono→email. `fanout` cuenta (con
 * consulta propia, no sobre `pairs`) las contrapartes distintas de cada clave: más de MAX_FANOUT = intermediario.
 */
export function expandIdentity(seed: Pair, pairs: Pair[], opts: { isOwn?: (email: string) => boolean; fanout?: Fanout } = {}): Identity {
  const own = opts.isOwn ?? (() => false);
  const fan = opts.fanout ?? (() => 0);
  const s = normPair(seed);
  const e0 = s.e && !own(s.e) ? s.e : "";
  const id: Identity = { emails: new Set(e0 ? [e0] : []), phones: new Set(s.ph ? [s.ph] : []) };
  for (const p of pairs) {
    const { e, ph } = normPair(p);
    if (!e || !ph || own(e)) continue;
    if (e0 && e === e0 && fan("email", e) <= MAX_FANOUT && fan("phone", ph) <= MAX_FANOUT) id.phones.add(ph);
    if (s.ph && ph === s.ph && fan("phone", ph) <= MAX_FANOUT && fan("email", e) <= MAX_FANOUT) id.emails.add(e);
  }
  return id;
}

export const matchesIdentity = (id: Identity, p: Pair): boolean => {
  const { e, ph } = normPair(p);
  return (!!e && id.emails.has(e)) || (!!ph && id.phones.has(ph));
};

export type LiveFact = {
  kind: "quote" | "order";
  ref: string;
  status: string;
  paidAt?: Date | null;
  createdAt: Date;
  email?: string | null;
  phone?: string | null;
};

const QUOTE_LIVE = new Set(["DRAFT", "SENT", "OPENED", "ACCEPTED"]);

/**
 * Lo que frena a la puerta: presupuesto DRAFT/SENT/OPENED/ACCEPTED o pedido IN_PROGRESS de los últimos `days`,
 * o pedido PAID/DELIVERED creado DESPUÉS del lead (`leadAt`; el que pagó antes no frena un documento nuevo).
 */
export function liveBlock(id: Identity, facts: LiveFact[], now: Date, opts: { days?: number; leadAt?: Date } = {}): LiveFact | null {
  const since = now.getTime() - (opts.days ?? LIVE_DAYS) * 864e5;
  for (const f of facts) {
    if (!matchesIdentity(id, f) || f.createdAt.getTime() < since) continue;
    if (f.kind === "quote") {
      if (QUOTE_LIVE.has(f.status)) return f;
    } else if (f.status === "IN_PROGRESS") return f;
    else if ((f.status === "PAID" || f.status === "DELIVERED") && (!opts.leadAt || f.createdAt.getTime() > opts.leadAt.getTime())) return f;
  }
  return null;
}

/** Respuesta automática (no cuenta como que el cliente contestó). */
export const AUTO_REPLY_SUBJECT = /automatic reply|r[ée]ponse automatique|respuesta autom[aá]tica|out of office|abwesenheit|risposta automatica/i;
export const isAutoReplySubject = (subject: string | null | undefined) => AUTO_REPLY_SUBJECT.test(String(subject || ""));

export type Incoming = { from?: string | null; phone?: string | null; at: Date };

/** ¿Escribió esta persona (email o WhatsApp) después de `since`? */
export function repliedSince(id: Identity, msgs: Incoming[], since: Date): boolean {
  return msgs.some((m) => m.at.getTime() > since.getTime() && matchesIdentity(id, { email: m.from, phone: m.phone }));
}

export type ReplyGate = "proceed" | "hold_replied" | "hold_unknown";

/**
 * Antes de cerrar o recordar: si contestó → no se actúa (y se avisa a Juan); si no se pudo leer el
 * buzón → tampoco (cerrar a ciegas es lo que falló con Hella). Otras acciones pasan.
 */
export function replyGate(i: { action: string; replied: boolean; inboxOk: boolean }): ReplyGate {
  if (i.action !== "close" && i.action !== "remind_email") return "proceed";
  if (i.replied) return "hold_replied";
  if (!i.inboxOk) return "hold_unknown";
  return "proceed";
}
