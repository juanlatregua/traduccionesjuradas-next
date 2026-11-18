import { assertNonNegativeCents, type Cents } from "./money.ts";

/** A quote leaves on its own only up to 300 € VAT included. */
export const AUTO_SEND_CAP_WITH_VAT_CENTS: Cents = 30000;

export function withinAutoSendCap(totalWithVatCents: Cents): boolean {
  return assertNonNegativeCents(totalWithVatCents, "total con IVA") <= AUTO_SEND_CAP_WITH_VAT_CENTS;
}
