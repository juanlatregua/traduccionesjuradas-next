export function eurosToCents(value: string | number | null | undefined): number | null {
  const raw = typeof value === "number" ? String(value) : String(value ?? "").trim();
  const n = raw === "" ? NaN : Number(raw);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export function paidAmountMatches(expectedCents: number, receivedCents: number | null | undefined): boolean {
  return (
    Number.isInteger(expectedCents) &&
    expectedCents > 0 &&
    typeof receivedCents === "number" &&
    receivedCents === expectedCents
  );
}
