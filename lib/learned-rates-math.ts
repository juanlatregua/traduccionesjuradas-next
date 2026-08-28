// lib/learned-rates-math.ts — La aritmética del tarifario aprendido, SIN
// dependencias: ni Prisma, ni alias, ni nada de servidor. Vive aparte para que
// las reglas que deciden dinero sean comprobables con `node --test` y para que
// cliente y servidor usen exactamente los mismos números.
// Mismo espíritu que lib/quote-math.ts.

export const LEARNED_MARGIN_PCT = 12; // margen sobre coste del jurado (horquilla Juan 10-15 %)
export const DOC_FLOOR_CENTS = 4000; // 40 € netos mínimo por documento (regla Juan 26-ago)
export const WORD_UNIT_MIN_WORDS = 1000; // desde aquí (y más de 2 páginas) la tarifa se aprende por 1000 palabras
export const SIZE_TOLERANCE = 0.3; // ±30 % de tamaño para reutilizar una tarifa por documento
export const AUTO_QUOTE_MAX_CENTS = 60000; // por encima de 600 € netos, siempre humano

// Suelo de margen del presupuesto automático. Regla de Juan (28-ago-2026):
// «nunca puedo perder». Por debajo de esto NO sale solo: va a mano. Se pone en
// el mínimo de su horquilla (10-15 %) para no frenar lo que ya funciona, pero
// impide de raíz el caso que dispara la regla: una tarifa con el coste mal
// puesto emitiendo y ENVIANDO al cliente un precio que deja la casa a cero.
export const MIN_AUTO_MARGIN_PCT = 10;

/** Regla Juan 26-ago: los certificados (1-2 páginas) no se cuentan por palabra. */
export function unitFor(words: number | null | undefined, pages?: number | null): "doc" | "kword" {
  if (pages && pages <= 2) return "doc";
  return words && words >= WORD_UNIT_MIN_WORDS ? "kword" : "doc";
}

export function roundUp50(cents: number) {
  return Math.ceil(cents / 50) * 50;
}

/** Precio neto al cliente y coste del jurado para un documento con su tarifa. */
export function priceDocWithRate(
  rate: { unit: string; costCents: number; clientCents: number | null },
  words: number | null
) {
  const perUnitClient = rate.clientCents ?? Math.round(rate.costCents * (1 + LEARNED_MARGIN_PCT / 100));
  if (rate.unit === "kword") {
    const w = Math.max(1, words || 0);
    const client = Math.max(DOC_FLOOR_CENTS, roundUp50((w * perUnitClient) / 1000));
    const cost = Math.round((w * rate.costCents) / 1000);
    return { clientCents: client, costCents: cost };
  }
  return { clientCents: Math.max(DOC_FLOOR_CENTS, roundUp50(perUnitClient)), costCents: rate.costCents };
}

/** Margen en % sobre el coste. 0 si no hay coste (una tarifa sin coste real no tarifica sola). */
export function marginPctOf(clientCents: number, costCents: number) {
  return costCents > 0 ? ((clientCents - costCents) / costCents) * 100 : 0;
}

/** La regla, en una función: ¿puede este documento salir solo? */
export function canAutoQuote(clientCents: number, costCents: number) {
  const margen = clientCents - costCents;
  return margen > 0 && marginPctOf(clientCents, costCents) >= MIN_AUTO_MARGIN_PCT;
}
