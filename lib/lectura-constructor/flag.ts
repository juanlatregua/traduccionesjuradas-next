/** LECTURA_CONSTRUCTOR=on opens the new constructor screen and its endpoints; anything else leaves production as it was. */
export function lecturaConstructorOn(env: Record<string, string | undefined> = process.env): boolean {
  return (env.LECTURA_CONSTRUCTOR || "").trim().toLowerCase() === "on";
}

/** The route refuses to read without an explicit ceiling: it must match the memory configured for the function. */
export function explicitRssCeilingMb(env: Record<string, string | undefined> = process.env): number | null {
  const n = Number(env.LECTURA_RSS_CEILING_MB);
  return Number.isFinite(n) && n >= 256 ? Math.floor(n) : null;
}
