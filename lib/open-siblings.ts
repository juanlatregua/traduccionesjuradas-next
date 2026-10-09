// lib/open-siblings.ts — «Abierto reciente»: la MISMA persona con otra cosa abierta
// (lead de la puerta, presupuesto sin pagar, solicitud viva en lavori, conversación
// del buzón) en los últimos días. Lógica PURA (sin BD ni alias) para node --test;
// la lectura de BD vive en lib/open-siblings-db.ts.
//
// Medido el 9-oct-2026 (60 días): 69 casos de la misma persona con ≥2 flujos en 72 h,
// 7 con dos solicitudes a lavori y 11 con dos presupuestos enviados.
//
// Reglas: coincidencia por EMAIL = misma persona (bloquea lo automático). Coincidencia
// solo por TELÉFONO con email distinto = «posible»: se avisa, NUNCA se fusiona ni se
// bloquea (enseñaría o frenaría a otra persona).

import { emailKey, phoneKey } from "./client-identity.ts";

export type OpenKind = "lead" | "quote" | "lpr" | "inbox";

export type OpenItem = {
  kind: OpenKind;
  ref: string;
  id: string;
  at: Date;
  /** puerta | whatsapp | email | presupuesto | lavori */
  chan: string;
  /** "IT>ES" o null si no se sabe */
  par: string | null;
  email: string | null;
  phone: string | null;
  /** Enlace de staff para continuar ahí. */
  url: string;
};

export type OpenSibling = OpenItem & { via: "email" | "phone"; samePar: boolean };

const PAR_UNKNOWN = /\?|UNKNOWN|^$/i;

/** Dos pares son compatibles si alguno no se conoce o son iguales. */
export function parsCompatible(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = String(a || "").toUpperCase().replace("->", ">");
  const y = String(b || "").toUpperCase().replace("->", ">");
  if (PAR_UNKNOWN.test(x) || PAR_UNKNOWN.test(y)) return true;
  return x === y;
}

export function matchOpenSiblings(
  me: { email?: string | null; phone?: string | null; par?: string | null },
  items: OpenItem[],
  opts: { now?: Date; days?: number } = {}
): OpenSibling[] {
  const email = emailKey(me.email);
  const phone = phoneKey(me.phone);
  const now = (opts.now ?? new Date()).getTime();
  const since = now - (opts.days ?? 7) * 86_400_000;
  const out: OpenSibling[] = [];
  for (const it of items) {
    if (it.at.getTime() < since) continue;
    const ie = emailKey(it.email);
    const ip = phoneKey(it.phone);
    let via: "email" | "phone" | null = null;
    if (email && ie && ie === email) via = "email";
    else if (phone && ip && ip === phone) via = "phone";
    if (!via) continue;
    out.push({ ...it, via, samePar: parsCompatible(me.par, it.par) });
  }
  return out.sort((a, b) => b.at.getTime() - a.at.getTime());
}

/** Lo que frena lo automático: solicitud o presupuesto abierto, mismo par, mismo EMAIL. */
export function blockingSibling(sibs: OpenSibling[]): OpenSibling | null {
  return sibs.find((s) => s.via === "email" && s.samePar && (s.kind === "lpr" || s.kind === "quote")) ?? null;
}

const CHAN_ES: Record<string, string> = {
  puerta: "puerta",
  whatsapp: "WhatsApp",
  email: "email",
  presupuesto: "presupuesto",
  lavori: "lavori",
};

export function hace(at: Date, now: Date = new Date()): string {
  const min = Math.max(0, Math.round((now.getTime() - at.getTime()) / 60_000));
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} días`;
}

/** «2026-00219 (presupuesto, hace 2 h)». */
export function describeSibling(s: OpenSibling, now: Date = new Date()): string {
  return `${s.ref} (${CHAN_ES[s.chan] || s.chan}, ${hace(s.at, now)}${s.via === "phone" ? ", mismo teléfono y OTRO email" : ""})`;
}
