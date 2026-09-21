// lib/quote-paid-sync.ts — Al confirmar a mano el pago de un pedido que nace de
// un presupuesto, el presupuesto queda PAID (mismo patrón que mark-paid:
// QuotePayment + status PAID + paidAt). Si no, el enlace /q seguía cobrando.
// Puro: decide qué escribir; el llamador lo escribe.

const OPEN_STATUSES = new Set(["DRAFT", "SENT", "OPENED", "ACCEPTED"]);

export type QuotePaidPlan = {
  payment: { quoteId: string; provider: "BIZUM" | "TRANSFER"; amount: number; currency: string };
  update: { status: "PAID"; paidAt: Date };
};

export function planQuotePaidSync(
  quote: { id: string; status: string; paidAt: Date | null; totalEur: number; currency: string | null } | null,
  method: "BIZUM" | "TRANSFER",
  now: Date
): QuotePaidPlan | null {
  if (!quote || quote.paidAt || !OPEN_STATUSES.has(quote.status)) return null;
  return {
    payment: { quoteId: quote.id, provider: method, amount: quote.totalEur, currency: quote.currency || "EUR" },
    update: { status: "PAID", paidAt: now },
  };
}
