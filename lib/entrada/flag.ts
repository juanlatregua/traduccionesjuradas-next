/** PUERTA_V2=on opens the new web entrance and its endpoints; anything else leaves the public site as it was. */
export function puertaV2On(env: Record<string, string | undefined> = process.env): boolean {
  return (env.PUERTA_V2 || "").trim().toLowerCase() === "on";
}
