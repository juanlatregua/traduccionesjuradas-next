// Tarjeta al compartir /q/<token> por WhatsApp/SMS: solo número y total, nunca nombre ni documentos
// (la ve cualquiera con el enlace). Puro.

export type QuoteShareRow = {
  quoteNumber: string;
  status: string;
  pdfLang?: string | null;
  tokenExpiresAt?: Date | null;
  total?: number | null;
  balanceAmount?: number | null;
  vatRate?: number | null;
  deletedAt?: Date | null;
  supersededAt?: Date | null;
};

// Solo un presupuesto vivo y pendiente de pago enseña su importe.
const SHAREABLE_STATUSES = new Set(["SENT", "OPENED"]);

export type QuoteShare = { quoteNumber: string; amount: string; vatIncluded: boolean; lang: "es" | "fr" | "en" };

const COPY = {
  es: { title: (n: string, a: string) => `Tu presupuesto ${n} · ${a}`, description: "Paga en un minuto con tarjeta o Bizum", tag: "PRESUPUESTO", doc: "Presupuesto", vat: "IVA incluido", total: "Total" },
  fr: { title: (n: string, a: string) => `Votre devis ${n} · ${a}`, description: "Payez en une minute par carte ou Bizum", tag: "DEVIS", doc: "Devis", vat: "TVA incluse", total: "Total" },
  en: { title: (n: string, a: string) => `Your quote ${n} · ${a}`, description: "Pay in a minute by card or Bizum", tag: "QUOTE", doc: "Quote", vat: "VAT included", total: "Total" },
} as const;

export const GENERIC_SHARE = {
  title: "Traducciones Juradas",
  description: "Traducción jurada oficial · Málaga",
};

export function formatEur(eur: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(eur);
}

// null → imagen y textos genéricos de marca (token inválido, caducado, pagado, borrado, sustituido o sin precio).
export function quoteShare(row: QuoteShareRow | null, now: Date = new Date()): QuoteShare | null {
  if (!row) return null;
  if (!SHAREABLE_STATUSES.has(row.status) || row.deletedAt || row.supersededAt) return null;
  if (row.tokenExpiresAt && row.tokenExpiresAt < now) return null;
  const full = Number(row.total ?? 0) + Number(row.balanceAmount ?? 0);
  if (!(full > 0)) return null;
  const l = String(row.pdfLang || "").slice(0, 2).toLowerCase();
  return { quoteNumber: row.quoteNumber, amount: formatEur(full), vatIncluded: Number(row.vatRate ?? 0) > 0, lang: l === "fr" || l === "en" ? l : "es" };
}

export function quoteShareText(s: QuoteShare | null) {
  if (!s) return { ...GENERIC_SHARE, tag: null as string | null, amountNote: null as string | null, line: "Traducción jurada oficial" };
  const c = COPY[s.lang];
  return { title: c.title(s.quoteNumber, s.amount), description: c.description, tag: c.tag as string | null, amountNote: (s.vatIncluded ? c.vat : c.total) as string | null, line: `${c.doc} ${s.quoteNumber}` };
}
