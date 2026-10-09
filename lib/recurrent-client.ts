// lib/recurrent-client.ts — ¿este contacto ya nos ha pagado antes? Lógica PURA
// (sin BD ni alias) para probarla con node --test. El acceso a BD vive en
// lib/recurrent-client-db.ts.
//
// Regla (orden de Juan, 9-oct-2026): coincidencia por EMAIL = recurrente, y solo
// entonces se heredan los datos de facturación. Coincidencia solo por TELÉFONO
// (email distinto) = «posible recurrente» para staff: nunca se fusionan datos
// automáticamente (enseñaría la ficha fiscal de alguien a otra persona).

import { emailKey, phoneKey } from "./client-identity.ts";

export type PaidOrderRow = {
  reference: string;
  clientEmail: string | null;
  clientPhone: string | null;
  amountCents: number;
  paidAt: Date | null;
  createdAt: Date;
};

export type RecurrentMatch =
  | { kind: "none" }
  | {
      kind: "recurrent" | "possible";
      /** Email con el que figura el historial (en «possible», el OTRO email). */
      email: string;
      orders: number;
      lastAt: Date;
      lastAmountCents: number;
      lastReference: string;
    };

function when(o: PaidOrderRow): Date {
  return o.paidAt ?? o.createdAt;
}

function summarize(kind: "recurrent" | "possible", rows: PaidOrderRow[]): RecurrentMatch {
  const last = rows.reduce((a, b) => (when(b) > when(a) ? b : a));
  return {
    kind,
    email: emailKey(last.clientEmail),
    orders: rows.length,
    lastAt: when(last),
    lastAmountCents: last.amountCents,
    lastReference: last.reference,
  };
}

export function classifyRecurrent(input: { email?: string | null; phone?: string | null }, paidOrders: PaidOrderRow[]): RecurrentMatch {
  const email = emailKey(input.email);
  const phone = phoneKey(input.phone);
  if (email) {
    const byEmail = paidOrders.filter((o) => emailKey(o.clientEmail) === email);
    if (byEmail.length) return summarize("recurrent", byEmail);
  }
  if (phone) {
    const byPhone = paidOrders.filter((o) => phoneKey(o.clientPhone) === phone && emailKey(o.clientEmail) !== email);
    if (byPhone.length) return summarize("possible", byPhone);
  }
  return { kind: "none" };
}

const fmtDate = (d: Date) =>
  d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Madrid" });

/** Texto de la marca para staff (builder, ficha, avisos). */
export function recurrentLabel(m: RecurrentMatch): string {
  if (m.kind === "none") return "";
  const base = `${m.orders} pedido${m.orders === 1 ? "" : "s"} · último ${fmtDate(m.lastAt)} · ${(m.lastAmountCents / 100).toFixed(2)} €`;
  return m.kind === "recurrent"
    ? `Cliente recurrente · ${base}`
    : `Posible recurrente (mismo teléfono, otro email: ${m.email}) · ${base}`;
}

/** Línea para el email de confirmación del cliente. Solo si coincide por email. */
export function recurrentClientLine(m: RecurrentMatch, lang: "es" | "fr"): string {
  if (m.kind !== "recurrent") return "";
  return lang === "fr"
    ? "Nous avons rattaché cette demande à votre historique chez nous ; vos données de facturation sont déjà renseignées."
    : "Hemos unido esta solicitud a tu historial con nosotros; tus datos de facturación ya están puestos.";
}

/** Línea de confianza del email de confirmación. Sin cifra de reseñas, se omite esa parte. */
export function trustLine(lang: "es" | "fr", reviews?: number | null): string {
  const reviewsPart = reviews && reviews > 0 ? ` · ${reviews} ${lang === "fr" ? "avis sur Google" : "reseñas en Google"}` : "";
  return `${lang === "fr" ? "Traducteur assermenté MAEC nº 3850" : "Traductor jurado MAEC nº 3850"}${reviewsPart}`;
}
