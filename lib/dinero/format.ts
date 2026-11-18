import { assertCents, type Cents } from "./money.ts";

/** «1.234,56» — es-ES by hand (Intl es-ES leaves 4-digit amounts ungrouped). */
export function formatEurosPlain(cents: Cents): string {
  assertCents(cents);
  const abs = Math.abs(cents);
  const euros = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${cents < 0 ? "-" : ""}${euros},${String(abs % 100).padStart(2, "0")}`;
}

/** «1.234,56 €» */
export function formatEuros(cents: Cents): string {
  return `${formatEurosPlain(cents)} €`;
}
