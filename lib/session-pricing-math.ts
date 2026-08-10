// Parte pura de la tarificación de sesión (sin Prisma, testeable con node --test).

const DEFAULT_VAT_RATE = 0.21;

// Envío en papel: recargo fijo (sin IVA) que se suma al subtotal y luego tributa.
export const PAPER_SHIPPING_CENTS = 1200; // 12 €

export type SessionPricingSnapshot = {
  subtotalCents: number;
  vatCents: number;
  totalCents: number;
  currency: string;
};

export class UnpricedSessionError extends Error {
  constructor(sessionId: string, unpricedCount: number) {
    super(
      `Sesión ${sessionId}: ${unpricedCount} documento(s) sin quotedCents — sin tarificación automática`
    );
    this.name = "UnpricedSessionError";
  }
}

function snapshotFromSubtotal(subtotalCents: number): SessionPricingSnapshot {
  const subtotal = Math.max(0, Math.round(subtotalCents));
  const vatCents = Math.round(subtotal * DEFAULT_VAT_RATE);
  return {
    subtotalCents: subtotal,
    vatCents,
    totalCents: subtotal + vatCents,
    currency: "EUR",
  };
}

// KILL-SWITCH de los 40 € planos (STORM 31-jul): si algún documento no trae su
// precio del pricing-engine, NO hay tarifa plana de rescate — devuelve null y
// el que llama debe mandar al cliente a presupuesto manual. El fallback
// anterior (docs × 40 €) cobraba a ciegas idiomas con mínimo 50 € (ar/nl/sv…)
// e ignoraba los precios reales de los documentos que sí lo tenían.
// Sin documentos tampoco hay nada que cobrar (ni el envío en papel).
export function snapshotFromDocs(
  quotedCents: Array<number | null>,
  shippingCents: number
): SessionPricingSnapshot | null {
  if (quotedCents.length === 0) return snapshotFromSubtotal(0);
  if (quotedCents.some((c) => c == null)) return null;
  return snapshotFromSubtotal(
    quotedCents.reduce((sum: number, c) => sum + (c || 0), 0) + shippingCents
  );
}
