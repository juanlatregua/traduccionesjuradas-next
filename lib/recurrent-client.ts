// lib/recurrent-client.ts — ¿este contacto ya nos ha pagado antes? Lógica PURA
// (sin BD ni alias) para probarla con node --test. El acceso a BD vive en
// lib/recurrent-client-db.ts.
//
// Regla (orden de Juan, 9-oct-2026): coincidencia por EMAIL = recurrente, y solo
// entonces se heredan los datos de facturación. Coincidencia solo por TELÉFONO
// (email distinto) = «posible recurrente» para staff: nunca se fusionan datos
// automáticamente (enseñaría la ficha fiscal de alguien a otra persona).

import { realEmailKey as emailKey, phoneKey } from "./client-identity.ts";

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
    email: String(last.clientEmail || "").trim().toLowerCase(),
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
    const byPhone = paidOrders.filter((o) => phoneKey(o.clientPhone) === phone && (!email || emailKey(o.clientEmail) !== email));
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
    ? "Nous avons rattaché cette demande à votre historique chez nous."
    : "Hemos unido esta solicitud a tu historial con nosotros.";
}

/** Línea de confianza del email de confirmación. Sin cifra de reseñas, se omite esa parte. */
export function trustLine(lang: "es" | "fr", reviews?: number | null): string {
  const reviewsPart = reviews && reviews > 0 ? ` · ${reviews} ${lang === "fr" ? "avis sur Google" : "reseñas en Google"}` : "";
  return `${lang === "fr" ? "Traducteur assermenté MAEC nº 3850" : "Traductor jurado MAEC nº 3850"}${reviewsPart}`;
}

export type BillingRow = { fiscalName: string; nif: string; address: string; city: string; postalCode: string; country: string };

/** NIF/CIF de sociedad (empieza por A-H, J, N, P-S, U, V, W). DNI (dígito) y NIE (X, Y, Z) son personas. */
export function isCompanyNif(nif: string | null | undefined): boolean {
  return /^[A-HJNP-SUVW]/.test(String(nif || "").replace(/[\s.\-]/g, "").toUpperCase());
}

const holderKey = (b: BillingRow) => {
  const nif = String(b.nif || "").replace(/[\s.\-]/g, "").toUpperCase();
  if (nif) return `nif:${nif}`;
  return `name:${String(b.fiscalName || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`;
};

/**
 * Qué datos de facturación heredar del historial de UN email (más reciente primero).
 * Un solo titular particular (DNI/NIE) → se hereda el último; si es empresa, solo se marca. Más de un titular distinto (despacho vs
 * particular con el mismo correo: Nadal Fortuny) → NO se copia nada y se marca para staff.
 */
export function pickBillingToInherit(
  history: BillingRow[]
): { kind: "none" } | { kind: "multiple"; holders: number } | { kind: "company"; name: string } | { kind: "inherit"; billing: BillingRow } {
  const usable = history.filter((b) => String(b.fiscalName || "").trim());
  if (usable.length === 0) return { kind: "none" };
  const holders = new Set(usable.map(holderKey));
  if (holders.size > 1) return { kind: "multiple", holders: holders.size };
  // Titular único que es una EMPRESA: el cliente puede ser un empleado que pide a título
  // personal. No se copia solo; staff ve «posible titular».
  if (isCompanyNif(usable[0].nif)) return { kind: "company", name: usable[0].fiscalName };
  return { kind: "inherit", billing: usable[0] };
}
