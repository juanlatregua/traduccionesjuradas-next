export type Cents = number;

export function assertCents(value: number, label = "importe"): Cents {
  if (!Number.isSafeInteger(value)) throw new RangeError(`${label}: ${value} no son céntimos enteros`);
  return value;
}

export function assertNonNegativeCents(value: number, label = "importe"): Cents {
  assertCents(value, label);
  if (value < 0) throw new RangeError(`${label}: ${value} es negativo`);
  return value;
}

type DecimalLike = { toString(): string };

const DECIMAL_RE = /^([+-])?(\d*)(?:\.(\d*))?$/;

/** Parses a decimal string/number into an integer scaled by 10^scale, half away from zero beyond `scale` digits. */
export function scaledIntFromDecimal(value: number | string | DecimalLike, scale: number, label = "valor"): number {
  let text: string;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new RangeError(`${label}: ${value} no es un número`);
    text = String(value);
    if (/e/i.test(text)) text = value.toFixed(20);
  } else {
    text = String(value ?? "").trim();
  }
  const m = DECIMAL_RE.exec(text);
  if (!m || (!m[2] && !m[3])) throw new RangeError(`${label}: «${text}» no es un decimal`);
  const negative = m[1] === "-";
  const intDigits = m[2] || "0";
  const frac = m[3] || "";
  const kept = frac.slice(0, scale).padEnd(scale, "0");
  const roundUp = frac.length > scale && frac.charCodeAt(scale) - 48 >= 5;
  const magnitude = Number(intDigits + kept) + (roundUp ? 1 : 0);
  if (!Number.isSafeInteger(magnitude)) throw new RangeError(`${label}: «${text}» fuera de rango`);
  return negative && magnitude !== 0 ? -magnitude : magnitude;
}

/** Boundary: Prisma Decimal / euro number → cents. 30.5 → 3050, "1.005" → 101. */
export function centsFromEuros(value: number | string | DecimalLike): Cents {
  return scaledIntFromDecimal(value, 2, "euros");
}

/** Boundary: cents → euro number (for Prisma Decimal writes). */
export function eurosFromCents(cents: Cents): number {
  assertCents(cents);
  return cents / 100;
}

/** Boundary: cents → exact decimal string "30.50" (safe for Prisma Decimal). */
export function euroStringFromCents(cents: Cents): string {
  assertCents(cents);
  const abs = Math.abs(cents);
  return `${cents < 0 ? "-" : ""}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export function sumCents(values: readonly Cents[]): Cents {
  let total = 0;
  for (const v of values) total += assertCents(v);
  return assertCents(total, "suma");
}

/** Integer division rounding half up (toward +∞ on the half); denominator > 0. */
export function divRoundHalfUp(numerator: number, denominator: number): number {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator <= 0) {
    throw new RangeError(`división inválida ${numerator}/${denominator}`);
  }
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}

/**
 * Splits `total` proportionally to non-negative integer `weights` (a 0 weight gets 0).
 * Each share rounds half up and the last positive weight absorbs the remainder,
 * so the parts always add up to `total`. For equal parts pass equal weights.
 */
export function spread(total: Cents, weights: readonly number[]): Cents[] {
  assertNonNegativeCents(total, "reparto");
  if (weights.length === 0) return [];
  for (const w of weights) if (!Number.isSafeInteger(w) || w < 0) throw new RangeError(`peso ${w} no es un entero ≥ 0`);
  const weightTotal = weights.reduce((a, w) => a + w, 0);
  if (weightTotal === 0) throw new RangeError("reparto: todos los pesos son 0");
  let last = weights.length - 1;
  while (weights[last] === 0) last--;
  const out: Cents[] = [];
  let assigned = 0;
  weights.forEach((w, i) => {
    if (i === last) return out.push(0);
    // Capped so the absorbing part can never go negative (e.g. 2 c among 4 equal parts).
    const share = Math.min(divRoundHalfUp(total * w, weightTotal), total - assigned);
    assigned += share;
    out.push(share);
  });
  out[last] = total - assigned;
  return out;
}

export function roundUpToEuro(cents: Cents): Cents {
  assertCents(cents);
  return Math.ceil(cents / 100) * 100;
}

export function roundDownToEuro(cents: Cents): Cents {
  assertCents(cents);
  return Math.floor(cents / 100) * 100;
}
