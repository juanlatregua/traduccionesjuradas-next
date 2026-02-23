export function isDuplicateStripeEventError(err: any) {
  return String(err?.code || "").toUpperCase() === "P2002";
}
