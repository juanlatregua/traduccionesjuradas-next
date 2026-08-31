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


// --- Guarda de margen de presupuestos de STAFF (31-ago-2026) ---------------
// Aritmetica pura y testable; el "es frances" llega como flag (lo decide
// isFrenchPair en lib/workflow, que el llamador compone en lib/quote-margin).

export type StaffQuoteLine = {
  quantity: number;
  unitPrice: number;
  supplierUnitCost?: number | null;
};

export type StaffMarginResult =
  | { ok: true }
  | { ok: false; priceCents: number; costCents: number; marginCents: number; marginPct: number };

export function evaluateLinesMargin(
  lines: StaffQuoteLine[],
  opts: { isFrench: boolean; discountCents?: number }
): StaffMarginResult {
  // Frances exento: Juan es el traductor, coste = precio por construccion y el
  // precio cerrado es la promesa publica ("prometemos precio cerrado en
  // frances. En el resto, no" — Juan, 31-ago-2026).
  if (opts.isFrench) return { ok: true };

  // Redondeo por LINEA, no por unidad: en lineas por palabra (quantity=palabras,
  // 0,095 EUR/palabra) redondear la unidad a centimos antes de multiplicar
  // inventa hasta un 5% de importe.
  const lineCents = (qty: number, unit: number | null | undefined) =>
    Math.round((Number(qty) || 1) * (Number(unit) || 0) * 100);
  // El descuento cuenta: el cliente paga subtotal - descuento, y el builder
  // AUTO-sugiere 5/10/15% por volumen — un margen del 10% con descuento del 10%
  // es margen CERO real.
  const priceCents = lines.reduce((a, l) => a + lineCents(l.quantity, l.unitPrice), 0) - Math.max(0, Math.round(opts.discountCents || 0));
  // Sin coste registrado en ninguna linea, pasa: la ausencia de dato no es
  // evidencia de perdida; el freno actua sobre lo que sabe.
  const hasCost = lines.some((l) => l.supplierUnitCost != null && Number(l.supplierUnitCost) > 0);
  if (!hasCost) return { ok: true };

  const costCents = lines.reduce((a, l) => a + lineCents(l.quantity, l.supplierUnitCost), 0);
  const marginCents = priceCents - costCents;
  const marginPct = marginPctOf(priceCents, costCents);
  if (marginCents > 0 && marginPct >= MIN_AUTO_MARGIN_PCT) return { ok: true };
  return { ok: false, priceCents, costCents, marginCents, marginPct };
}

// Verificacion de PROCEDENCIA del coste (Juan, 31-ago-2026: "lo mas importante
// es que [no] se pase un precio de otro idioma que no sea frances sin verificar
// el precio previo con el traductor en el canal"). La aritmetica del margen no
// puede ver un coste INVENTADO (el patron cliente/1,12 del tarifario del 28-ago
// pasa cualquier ratio): aqui se exige que el coste venga del canal — la
// solicitud que el jurado coticio en lavori — y que las lineas lo cubran.

export type ChannelPriceResult =
  | { ok: true }
  | { ok: false; reason: "sin_precio_en_canal" | "coste_bajo_canal"; channelPriceCents: number | null; costCents: number };

export function evaluateChannelPrice(opts: {
  isFrench: boolean;
  channelPriceCents: number | null;
  costCents: number;
}): ChannelPriceResult {
  if (opts.isFrench) return { ok: true };
  if (opts.channelPriceCents == null) {
    return { ok: false, reason: "sin_precio_en_canal", channelPriceCents: null, costCents: opts.costCents };
  }
  // Las lineas tienen que cubrir lo que pidio el jurado (+-1 cent de redondeo):
  // un coste por debajo del canal ensena un margen mejor del real.
  if (opts.costCents + 1 < opts.channelPriceCents) {
    return { ok: false, reason: "coste_bajo_canal", channelPriceCents: opts.channelPriceCents, costCents: opts.costCents };
  }
  return { ok: true };
}
