// scripts/dinero-replica.ts — Recalcula con lib/dinero el juego de oro (volcado sin datos personales)
// y compara al céntimo con lo guardado. Solo lee ficheros locales; escribe replica-r0.md al lado.
// Separa lo RECALCULADO con el módulo nuevo de la coherencia entre campos guardados (guardado contra guardado).
//   npx tsx scripts/dinero-replica.ts [directorio]   (por defecto /Users/nip/proyectos/tjnet-golden)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { centsFromEuros, formatEuros, parseVatRate, quoteTotals, invoiceTotalsFromLines, addVat, splitGross, marginOf, costFromStoredBase, UNKNOWN_COST, OWN_WORK, VAT_GENERAL_21, type Discount, type VatRegime } from "../lib/dinero/index.ts";

const dir = process.argv[2] || "/Users/nip/proyectos/tjnet-golden";
if (!existsSync(join(dir, "quotes.json"))) {
  console.log(`No hay juego de oro en ${dir} (falta quotes.json): nada que replicar.`);
  process.exit(0);
}
const load = (f: string): any[] => JSON.parse(readFileSync(join(dir, f), "utf8"));
const quotes = load("quotes.json");
const invoices = load("invoices.json");
const orders = load("orders.json");

type Kind = "recalculado" | "coherencia";
type Field = [field: string, stored: number, other: number, cause: string];
type Discrepancy = { kind: Kind; set: string; id: string; field: string; stored: number; other: number; cause: string };
const discrepancies: Discrepancy[] = [];
const sets = new Map<string, { kind: Kind; total: number; matched: number; comparisons: number }>();
const errors: string[] = [];
const notes: string[] = [];

function record(kind: Kind, set: string, id: string, fields: Field[]) {
  if (fields.length === 0) return;
  const s = sets.get(set) ?? { kind, total: 0, matched: 0, comparisons: 0 };
  sets.set(set, s);
  s.total++;
  s.comparisons += fields.length;
  const bad = fields.filter(([, a, b]) => a !== b);
  if (bad.length === 0) s.matched++;
  for (const [field, stored, other, cause] of bad) discrepancies.push({ kind, set, id, field, stored, other, cause });
}

// A stored 0 in this business is an operation «no sujeta» (client outside the EU / EU B2B).
const regimeOf = (vatRate: unknown): VatRegime => parseVatRate(vatRate, { zeroAs: "notSubject" });
const bp = (r: VatRegime) => (r.kind === "general" ? r.rateBp : 0);
const isVatHalf = (base: number, r: VatRegime) => bp(r) > 0 && (base * bp(r)) % 10000 === 5000;

// (a) quotes — RECALCULATED from lines + discount + shipping + rate
const quoteVatHalf = new Set<string>();
for (const q of quotes) {
  const id = q.quoteNumber || q.id;
  try {
    const regime = regimeOf(q.vatRate);
    const lines = q.lines.map((l: any) => ({ quantity: String(l.quantity), unitPriceCents: centsFromEuros(l.unitPrice) }));
    const discount: Discount =
      q.discountType === "PERCENT" ? { kind: "percent", percent: String(q.discountValue) }
      : q.discountType === "FIXED" ? { kind: "fixed", cents: centsFromEuros(q.discountValue) }
      : { kind: "none" };
    const shippingCents = q.deliveryType === "PAPER_SHIP" ? centsFromEuros(q.shippingBase) : 0;
    const res = quoteTotals({ lines, discount, shippingCents, regime });
    if (!res.ok) {
      errors.push(`presupuesto ${id}: ${res.error} (subtotal ${formatEuros(res.subtotal)}, descuento ${formatEuros(res.discount)})`);
      continue;
    }
    const t = res.totals;
    const st = {
      subtotal: centsFromEuros(q.subtotal), discount: centsFromEuros(q.discountAmount), shipping: centsFromEuros(q.shippingAmount),
      vat: centsFromEuros(q.vatAmount), total: centsFromEuros(q.total), balance: q.balanceAmount == null ? 0 : centsFromEuros(q.balanceAmount),
    };
    const fields: Field[] = [];
    q.lines.forEach((l: any, i: number) => fields.push([`lines[${i}].lineTotal`, centsFromEuros(l.lineTotal), t.lineTotals[i], "línea guardada ≠ cantidad × unitario"]));
    fields.push(["subtotal", st.subtotal, t.subtotal, "subtotal ≠ Σ líneas recalculadas"]);
    fields.push(["discountAmount", st.discount, t.discount, discount.kind === "percent" && Math.abs(t.discount - st.discount) === 1 ? "descuento %: media exacta, el viejo redondea en euros flotantes" : "descuento sin clasificar"]);
    fields.push(["shippingAmount", st.shipping, t.shipping, "envío guardado ≠ parámetro shippingBase"]);
    const storedTaxable = st.subtotal - st.discount + st.shipping;
    const vatCause =
      storedTaxable !== t.taxableBase ? "consecuencia de una base distinta"
      : isVatHalf(t.taxableBase, regime) && t.vat - st.vat === 1 ? "IVA: media exacta; el viejo redondea en euros flotantes (G3), la regla única sube"
      : "IVA sin clasificar";
    if (st.vat !== t.vat && vatCause.startsWith("IVA: media")) quoteVatHalf.add(q.id);
    fields.push(["vatAmount", st.vat, t.vat, vatCause]);
    // With installments the lines and `total` are the 1st installment; balanceAmount is stored apart, not derivable.
    if (st.balance > 0) notes.push(`Presupuesto a plazos ${id}: líneas y total = 1.er plazo (${formatEuros(st.total)}); 2.º plazo ${formatEuros(st.balance)} guardado aparte, no derivable de las líneas.`);
    fields.push(["total", st.total, t.total, vatCause === "IVA sin clasificar" ? "total sin clasificar" : `consecuencia: ${vatCause}`]);
    record("recalculado", "presupuestos", id, fields);
  } catch (e) {
    errors.push(`presupuesto ${id}: ${(e as Error).message}`);
  }
}

// (b) invoices
const quoteById = new Map(quotes.map((q: any) => [q.id, q]));
const orderById = new Map(orders.map((o: any) => [o.id, o]));
const invoiceByOrder = new Map<string, any>();
let issued = 0;
const inconsistent: string[] = [];
for (const inv of invoices) {
  const id = inv.number || inv.id;
  try {
    const regime = regimeOf(inv.vatRate);
    if (inv.lines.length > 0) {
      // A line without amount is a text-only row (heading/detail): it adds 0.
      const lineBases = inv.lines.map((l: any) => l.amountCents ?? 0);
      const r = invoiceTotalsFromLines(lineBases, regime, { allowNegative: inv.invoiceType?.startsWith("R") });
      record("recalculado", "facturas desde líneas (base, cuota, total)", id, [
        ["baseCents", inv.baseCents, r.base, "base ≠ Σ líneas"],
        ["vatCents", inv.vatCents, r.vat, "cuota ≠ regla única sobre Σ líneas"],
        ["totalCents", inv.totalCents, r.total, "total ≠ Σ líneas + cuota"],
      ]);
    }
    const fromBase = inv.baseCents < 0 ? invoiceTotalsFromLines([inv.baseCents], regime, { allowNegative: true }) : addVat(inv.baseCents, regime);
    const fromGross = inv.totalCents >= 0 ? splitGross(inv.totalCents, regime) : null;
    const order = inv.orderId ? orderById.get(inv.orderId) : null;
    const quote = order?.quoteId ? quoteById.get(order.quoteId) : null;
    let cause = "cuota sin clasificar";
    if (fromGross && fromGross.base === inv.baseCents) {
      cause = quote && quoteVatHalf.has(quote.id)
        ? `hereda el redondeo en coma flotante del presupuesto ${quote.quoteNumber} (IVA 1 c bajo); emitida desde el bruto (origin=${inv.origin}), splitGross solo conservó ese total`
        : `emitida desde el bruto cobrado (origin=${inv.origin}): conserva el total, la cuota no es base→cuota`;
    }
    record("recalculado", "facturas: cuota desde su base", id, [["vatCents", inv.vatCents, fromBase.vat, cause]]);
    record("coherencia", "facturas: total = base + cuota guardadas", id, [["totalCents", inv.totalCents, inv.baseCents + inv.vatCents, "total ≠ base + cuota guardadas"]]);
    if (inv.status === "ISSUED" && !inv.annulledAt && fromGross) {
      issued++;
      if (!fromGross.consistent) inconsistent.push(`${id} (${formatEuros(inv.totalCents)})`);
    }
    if (inv.orderId && (inv.invoiceType === "F1" || inv.invoiceType === "F2") && !inv.annulledAt) invoiceByOrder.set(inv.orderId, inv);
  } catch (e) {
    errors.push(`factura ${id}: ${(e as Error).message}`);
  }
}

// (c) orders: base RECALCULATED from the gross charge (Order has no VAT regime: 21 % assumed)
const marginClasses: Record<string, number> = {};
for (const o of orders) {
  const id = o.reference || o.id;
  try {
    const split = splitGross(o.amountCents, VAT_GENERAL_21);
    const inv = invoiceByOrder.get(o.id);
    if (inv && inv.vatRate === 0.21) {
      record("recalculado", "pedidos: base desde bruto vs base de su factura", id, [
        ["base", inv.baseCents, split.base, inv.totalCents !== o.amountCents ? "la factura no es del importe del pedido (agrupada, parcial o con otro total)" : "base de factura ≠ bruto/1,21"],
      ]);
    }
    const q = o.quoteId ? quoteById.get(o.quoteId) : null;
    if (q && !q.balanceAmount) record("coherencia", "pedidos: cobrado vs total guardado del presupuesto", id, [["amountCents", centsFromEuros(q.total), o.amountCents, "el pedido no cobró el total del presupuesto"]]);
    const items = (o.documentItems || []).filter((d: any) => d.quotedCents != null);
    if (items.length > 0 && items.length === o.documentItems.length) {
      const sum = items.reduce((a: number, d: any) => a + d.quotedCents, 0);
      const cause =
        sum === split.base ? "los documentos guardan el NETO aunque la columna es bruta (G8)"
        : Math.abs(sum - o.amountCents) <= items.length ? "×1,21 redondeado por documento: céntimos de ida y vuelta (G8)"
        : "los documentos no reflejan el cobro (precio rehecho, descuento, envío o documentos de más/menos)";
      record("coherencia", "pedidos: Σ documentos vs cobrado", id, [["Σ documentItems.quotedCents", o.amountCents, sum, cause]]);
    }
    const fr = String(o.langPair || "").toLowerCase().includes("fr");
    const cost = o.supplierCostCents != null ? costFromStoredBase(o.supplierCostCents) : fr ? OWN_WORK : UNKNOWN_COST;
    const m = marginOf(split.base, cost).class;
    marginClasses[m] = (marginClasses[m] || 0) + 1;
  } catch (e) {
    errors.push(`pedido ${id}: ${(e as Error).message}`);
  }
}

const out: string[] = [];
out.push(`# Réplica R0 — lib/dinero contra el juego de oro (${new Date().toISOString().slice(0, 10)})`, "");
out.push(`Fuente: ${dir}. Regla única de IVA: cuota = ⌊(base·tipo + 5000)/10000⌋ en céntimos. vatRate 0 leído como «no sujeto». Pedidos: sin régimen guardado, se asume 21 %.`, "");
for (const kind of ["recalculado", "coherencia"] as const) {
  out.push(kind === "recalculado" ? "## RECALCULADO con el módulo nuevo" : "## Coherencia entre campos guardados (guardado contra guardado; no mide el módulo)", "");
  out.push("| Conjunto | Registros | Comparaciones | Coinciden en todo | Con discrepancia |", "|---|---|---|---|---|");
  for (const [name, s] of sets) if (s.kind === kind) out.push(`| ${name} | ${s.total} | ${s.comparisons} | ${s.matched} | ${s.total - s.matched} |`);
  out.push("");
}
out.push(`Facturas emitidas (ISSUED, no anuladas): ${issued}; con \`splitGross(total).consistent === false\` (su bruto no da una cuota base→cuota coherente): ${inconsistent.length}${inconsistent.length ? ` — ${inconsistent.join(", ")}` : ""}.`, "");
out.push(`Margen de pedidos (ingreso = bruto/1,21; FR sin coste = trabajo propio; coste 0 = sin informar): ${Object.entries(marginClasses).map(([k, v]) => `${k} ${v}`).join(" · ")}`, "");
if (notes.length) out.push(...notes.map((n) => `- ${n}`), "");
if (errors.length) out.push("## Registros que el módulo rechaza", "", ...errors.map((e) => `- ${e}`), "");
const byCause = new Map<string, Discrepancy[]>();
for (const d of discrepancies) {
  const key = `${d.kind} · ${d.set} · ${d.cause}`;
  byCause.set(key, [...(byCause.get(key) || []), d]);
}
out.push("## Discrepancias por causa", "", "| Tipo · conjunto · causa | Nº |", "|---|---|");
for (const [cause, list] of [...byCause.entries()].sort((a, b) => a[0].localeCompare(b[0]))) out.push(`| ${cause} | ${list.length} |`);
out.push("", "## Todas las discrepancias", "", "| Tipo | Conjunto | id / número | Campo | Guardado | Recalculado / otro campo | Diferencia | Causa |", "|---|---|---|---|---|---|---|---|");
for (const d of discrepancies) out.push(`| ${d.kind} | ${d.set} | ${d.id} | ${d.field} | ${formatEuros(d.stored)} | ${formatEuros(d.other)} | ${formatEuros(d.other - d.stored)} | ${d.cause} |`);
const target = join(dir, "replica-r0.md");
writeFileSync(target, out.join("\n") + "\n");
console.log(out.slice(0, out.findIndex((l) => l.startsWith("## Discrepancias"))).join("\n"));
for (const [cause, list] of byCause) console.log(`  ${list.length} · ${cause}`);
console.log(`\nInforme: ${target}`);
