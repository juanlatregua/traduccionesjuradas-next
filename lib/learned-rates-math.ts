// lib/learned-rates-math.ts — La aritmética del tarifario aprendido, SIN
// dependencias: ni Prisma, ni alias, ni nada de servidor. Vive aparte para que
// las reglas que deciden dinero sean comprobables con `node --test` y para que
// cliente y servidor usen exactamente los mismos números.
// Mismo espíritu que lib/quote-math.ts.

import { autoClientPriceCentsFromCost } from "./quote-math.ts";

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
  // Tarifa con precio cliente aprendido/aprobado (clientCents): se respeta. Sin él, el precio sale
  // de la regla única sobre el COSTE DEL DOCUMENTO (autoClientPriceFromCost, 9-oct-2026).
  if (rate.unit === "kword") {
    const w = Math.max(1, words || 0);
    const cost = Math.round((w * rate.costCents) / 1000);
    const client = rate.clientCents != null
      ? Math.max(DOC_FLOOR_CENTS, roundUp50((w * rate.clientCents) / 1000))
      : roundUp50(autoClientPriceCentsFromCost(cost, DOC_FLOOR_CENTS));
    return { clientCents: client, costCents: cost };
  }
  const client = rate.clientCents != null
    ? Math.max(DOC_FLOOR_CENTS, roundUp50(rate.clientCents))
    : roundUp50(autoClientPriceCentsFromCost(rate.costCents, DOC_FLOOR_CENTS));
  return { clientCents: client, costCents: rate.costCents };
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


// --- Política AUTÓNOMA del agente de precios (Juan, 9-oct-2026) ------------
// Los patrones repetidos se gestionan solos: CANDIDATE → APPROVED cuando hay
// evidencia suficiente y APPROVED → CANDIDATE cuando el coste se mueve o la
// tarifa envejece. Todo puro: la BD solo aporta muestras y eventos.

export const AUTO_WINDOW_DAYS = 90;
export const AUTO_MIN_SAMPLES = 3;
export const AUTO_MAX_DISPERSION = 0.15; // max/min − 1 del coste en la ventana
export const AUTO_MIN_SAMPLES_ACCEPTED = 2; // con un encargo aceptado/pagado entre ellas bastan 2
export const AUTO_COST_RISE = 0.15; // muestra de coste > 15 % por encima del aprobado → degrada
export const AUTO_COST_DROP = 0.15; // muestra de coste > 15 % por debajo del aprobado → degrada y avisa
// Idiomas con tarifa por página publicada (lib/pricing-engine/page-pricing.ts PAGE_PRICED_LANGS):
// su precio no sale del tarifario aprendido. Duplicado a propósito: este módulo no importa nada.
export const AUTO_EXCLUDED_LANGS = new Set(["fr", "de", "ru", "uk"]);
export const LEGACY_RISE_WINDOW_DAYS = 14; // sin marca de aprobación solo se mira lo reciente

export type PolicySample = {
  kind: string; // translator_price | seed | manual | client_paid | auto_quote | auto_approve | auto_degrade | manual_approve | manual_pause
  costCents: number | null;
  clientCents: number | null;
  at: Date;
  /** Muestra de un encargo realmente aceptado por un jurado, o de un presupuesto pagado. */
  accepted?: boolean;
};

export type PolicyRate = {
  lang: string;
  direction: string;
  docType: string;
  unit: string;
  costCents: number;
  clientCents: number | null;
  wordsRef: number | null;
  status: string;
  lastSampleAt: Date | null;
};

const COST_KINDS = new Set(["translator_price", "seed", "manual"]);
const MARK_KINDS = new Set(["auto_approve", "auto_degrade", "manual_approve", "manual_pause"]);
const DAY = 86_400_000;

const byTime = (a: PolicySample, b: PolicySample) => a.at.getTime() - b.at.getTime();

/** Muestras que prueban lo que cobra el jurado: SOLO su precio (translator_price). */
export function translatorSamplesIn(samples: PolicySample[], now: Date, days = AUTO_WINDOW_DAYS) {
  return costSamplesIn(samples, now, days).filter((s) => s.kind === "translator_price");
}

export function costSamplesIn(samples: PolicySample[], now: Date, days = AUTO_WINDOW_DAYS) {
  const since = now.getTime() - days * DAY;
  return samples.filter((s) => COST_KINDS.has(s.kind) && s.costCents != null && s.costCents > 0 && s.at.getTime() >= since).sort(byTime);
}

/** max/min − 1 del coste. Infinity si no hay datos. */
export function costDispersion(samples: PolicySample[]) {
  const costs = samples.map((s) => s.costCents!).filter((c) => c > 0);
  if (costs.length === 0) return Infinity;
  return Math.max(...costs) / Math.min(...costs) - 1;
}

/** Último evento de gestión (aprobar/degradar/pausar, a mano o automático) o ajuste manual de cifras. */
function lastManagementEvent(samples: PolicySample[]) {
  const ev = samples.filter((s) => MARK_KINDS.has(s.kind) || s.kind === "manual").sort(byTime);
  return ev.length ? ev[ev.length - 1] : null;
}

/** Gestionada por la política (la aprobó ella y nadie la ha tocado después). */
export function isAutoManaged(samples: PolicySample[]) {
  return lastManagementEvent(samples)?.kind === "auto_approve";
}

/** Juan la pausó a mano y no la ha vuelto a aprobar: la política no la resucita. */
export function isPausedByHand(samples: PolicySample[]) {
  return lastManagementEvent(samples)?.kind === "manual_pause";
}

/** Precio al cliente fijado a mano por Juan (último manual/semilla con precio), o null. */
export function handFixedClientCents(samples: PolicySample[]) {
  const fixed = samples.filter((s) => (s.kind === "manual" || s.kind === "seed") && s.clientCents != null && s.clientCents > 0).sort(byTime);
  return fixed.length ? fixed[fixed.length - 1].clientCents! : null;
}

export type AutoApproveVerdict =
  | { ok: true; costCents: number; clientCents: number | null; priceCents: number; marginPct: number; samples: number; dispersionPct: number }
  | { ok: false; reason: string; near?: boolean };

/** ¿Puede esta CANDIDATE aprobarse sola? `near` = le falta un solo requisito (candidata a un paso). */
export function evaluateAutoApprove(
  rate: PolicyRate,
  samples: PolicySample[],
  now: Date,
  isPriceableLang: (lang: string) => boolean
): AutoApproveVerdict {
  if (rate.status !== "CANDIDATE") return { ok: false, reason: `estado ${rate.status}` };
  if (AUTO_EXCLUDED_LANGS.has(rate.lang)) return { ok: false, reason: `${rate.lang}: precio propio (casa, tarifa por página o fuera de la auto-tarificación)` };
  if (rate.lang === "es" || !isPriceableLang(rate.lang)) return { ok: false, reason: `idioma ${rate.lang} no auto-presupuestable` };
  if (rate.unit !== "doc" && rate.unit !== "kword") return { ok: false, reason: `unidad ${rate.unit} no válida` };
  if (isPausedByHand(samples)) return { ok: false, reason: "pausada a mano por Juan" };

  // Solo cuentan como prueba de coste los precios que el jurado propuso (translator_price):
  // una semilla, un ajuste manual o un pago del cliente no demuestran lo que cobra.
  const cost = translatorSamplesIn(samples, now);
  const accepted = samples.some((s) => s.accepted);
  const dispersion = costDispersion(cost);
  const maxCost = cost.length ? Math.max(...cost.map((s) => s.costCents!)) : 0;
  const fails: string[] = [];
  const enough = cost.length >= AUTO_MIN_SAMPLES || (cost.length >= AUTO_MIN_SAMPLES_ACCEPTED && cost.some((s) => s.accepted));
  if (!enough) fails.push(`${cost.length}/${AUTO_MIN_SAMPLES} precios del jurado en ${AUTO_WINDOW_DAYS} d (bastan ${AUTO_MIN_SAMPLES_ACCEPTED} si uno es de un encargo aceptado/pagado)`);
  if (cost.length > 0 && dispersion > AUTO_MAX_DISPERSION) fails.push(`dispersión de coste ${(dispersion * 100).toFixed(0)} % (máx ${AUTO_MAX_DISPERSION * 100} %)`);
  // Nunca se aprueba con un coste por debajo del máximo que el jurado ha pedido: se frena y lo revisa Juan.
  if (maxCost > 0 && rate.costCents < maxCost) fails.push(`coste de la tarifa ${(rate.costCents / 100).toFixed(2)} € por debajo del máximo pedido por el jurado (${(maxCost / 100).toFixed(2)} €)`);
  if (!accepted) fails.push("sin encargo aceptado ni presupuesto pagado");

  const fixed = handFixedClientCents(samples);
  const words = rate.unit === "kword" ? rate.wordsRef || 1000 : null;
  const p = priceDocWithRate({ unit: rate.unit, costCents: rate.costCents, clientCents: fixed }, words);
  if (!(rate.costCents > 0) || p.clientCents <= p.costCents) fails.push("coste = precio o sin coste");
  else if (!canAutoQuote(p.clientCents, p.costCents)) fails.push(`margen ${marginPctOf(p.clientCents, p.costCents).toFixed(0)} % < ${MIN_AUTO_MARGIN_PCT} %`);

  if (fails.length > 0) {
    // «A un paso»: falla un solo requisito y, si es el de muestras, solo falta una.
    const near = fails.length === 1 && (enough || cost.length === AUTO_MIN_SAMPLES - 1);
    return { ok: false, reason: fails.join("; "), near };
  }
  return { ok: true, costCents: rate.costCents, clientCents: fixed, priceCents: p.clientCents, marginPct: marginPctOf(p.clientCents, p.costCents), samples: cost.length, dispersionPct: dispersion * 100 };
}

export type DegradeVerdict =
  | { degrade: false }
  | { degrade: true; cause: "coste_sube" | "coste_baja" | "sin_muestras"; handManaged: boolean; reason: string; fromCents?: number; toCents?: number };

/** ¿Debe una APPROVED volver a CANDIDATE? VETOED y CANDIDATE no se tocan. */
export function evaluateDegrade(rate: PolicyRate, samples: PolicySample[], now: Date): DegradeVerdict {
  if (rate.status !== "APPROVED") return { degrade: false };
  const handManaged = !isAutoManaged(samples);
  const marks = samples.filter((s) => s.kind === "auto_approve" || s.kind === "manual_approve").sort(byTime);
  const mark = marks.length ? marks[marks.length - 1] : null;
  const costAll = samples.filter((s) => COST_KINDS.has(s.kind) && s.costCents != null && s.costCents > 0).sort(byTime);

  // (a) un coste nuevo > 15 % sobre el aprobado.
  let ref: number | null = null;
  let fresh: PolicySample[] = [];
  if (mark && mark.costCents && mark.costCents > 0) {
    ref = mark.costCents;
    fresh = costAll.filter((s) => s.at.getTime() > mark.at.getTime());
  } else if (costAll.length >= 2) {
    // Aprobada antes de que hubiera marca: la referencia es la muestra anterior a la última.
    const last = costAll[costAll.length - 1];
    if (now.getTime() - last.at.getTime() <= LEGACY_RISE_WINDOW_DAYS * DAY) {
      ref = costAll[costAll.length - 2].costCents!;
      fresh = [last];
    }
  }
  if (ref) {
    const worst = fresh.reduce<PolicySample | null>((m, s) => (!m || s.costCents! > m.costCents! ? s : m), null);
    if (worst && worst.costCents! * 100 > ref * Math.round(100 + AUTO_COST_RISE * 100)) {
      return {
        degrade: true,
        cause: "coste_sube",
        handManaged,
        fromCents: ref,
        toCents: worst.costCents!,
        reason: `llegó un coste de ${(worst.costCents! / 100).toFixed(2)} € (+${((worst.costCents! / ref - 1) * 100).toFixed(0)} %) sobre el aprobado ${(ref / 100).toFixed(2)} €`,
      };
    }
  }

  // (a2) un coste nuevo > 15 % por debajo del aprobado: la tarifa ya no refleja lo que cobra el jurado.
  if (ref) {
    const low = fresh.reduce<PolicySample | null>((m, s) => (!m || s.costCents! < m.costCents! ? s : m), null);
    if (low && low.costCents! * 100 < ref * Math.round(100 - AUTO_COST_DROP * 100)) {
      return {
        degrade: true,
        cause: "coste_baja",
        handManaged,
        fromCents: ref,
        toCents: low.costCents!,
        reason: `llegó un coste de ${(low.costCents! / 100).toFixed(2)} € (${((low.costCents! / ref - 1) * 100).toFixed(0)} %) bajo el aprobado ${(ref / 100).toFixed(2)} €`,
      };
    }
  }

  // (b) 90 días sin muestras: solo las que gestiona la política (las de Juan no caducan).
  if (!handManaged) {
    const last = rate.lastSampleAt ? rate.lastSampleAt.getTime() : mark?.at.getTime() ?? 0;
    if (now.getTime() - last > AUTO_WINDOW_DAYS * DAY) {
      return { degrade: true, cause: "sin_muestras", handManaged, reason: `${AUTO_WINDOW_DAYS} días sin muestras` };
    }
  }
  return { degrade: false };
}

/** Conversión de una tarifa: presupuestos suyos enviados vs pagados. */
export function conversionOf(quotes: { sent: boolean; paid: boolean }[]) {
  const sent = quotes.filter((q) => q.sent).length;
  const paid = quotes.filter((q) => q.paid).length;
  return { sent, paid, pct: sent > 0 ? (paid / sent) * 100 : null };
}

/** Política autónoma apagada con LEARNED_RATES_AUTO=off (o LEARNED_RATES_LIVE=off). */
export function isAutoPolicyOn(env: Record<string, string | undefined>) {
  const off = (v: string | undefined) => String(v || "").toLowerCase() === "off";
  return !off(env.LEARNED_RATES_AUTO) && !off(env.LEARNED_RATES_LIVE);
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
