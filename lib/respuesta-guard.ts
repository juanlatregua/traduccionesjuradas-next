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

/**
 * Identidad de una persona: lo suyo más lo que LIGAN los registros que tienen email Y teléfono a la
 * vez (presupuestos, pedidos, fichas, análisis, buzón). Un solo salto; no adivina por nombre.
 */
export function expandIdentity(seed: Pair, pairs: Pair[]): Identity {
  const s = normPair(seed);
  const id: Identity = { emails: new Set(s.e ? [s.e] : []), phones: new Set(s.ph ? [s.ph] : []) };
  const byEmail = new Map<string, Set<string>>();
  const byPhone = new Map<string, Set<string>>();
  const add = (m: Map<string, Set<string>>, k: string, v: string) => m.set(k, (m.get(k) || new Set()).add(v));
  for (const p of pairs) {
    const { e, ph } = normPair(p);
    if (!e || !ph) continue;
    add(byEmail, e, ph);
    add(byPhone, ph, e);
  }
  for (const e of [...id.emails]) {
    const ps = byEmail.get(e);
    if (ps && ps.size <= MAX_FANOUT) for (const ph of ps) if ((byPhone.get(ph)?.size ?? 0) <= MAX_FANOUT) id.phones.add(ph);
  }
  for (const ph of [...id.phones]) {
    const es = byPhone.get(ph);
    if (es && es.size <= MAX_FANOUT) for (const e of es) if ((byEmail.get(e)?.size ?? 0) <= MAX_FANOUT) id.emails.add(e);
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

const QUOTE_LIVE = new Set(["DRAFT", "SENT", "OPENED", "ACCEPTED", "PAID"]);
const ORDER_LIVE = new Set(["PAID","IN_PROGRESS", "DELIVERED"]);

/** El hecho que frena a la puerta: presupuesto vivo, pedido en curso o pagado en los últimos `days`. */
export function liveBlock(id: Identity, facts: LiveFact[], now: Date, days = LIVE_DAYS): LiveFact | null {
  const since = now.getTime() - days * 864e5;
  for (const f of facts) {
    if (!matchesIdentity(id, f)) continue;
    const at = Math.max(f.createdAt.getTime(), f.paidAt ? f.paidAt.getTime() : 0);
    if (at < since) continue;
    if (f.kind === "quote" ? QUOTE_LIVE.has(f.status) : ORDER_LIVE.has(f.status) || !!f.paidAt) return f;
  }
  return null;
}

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
