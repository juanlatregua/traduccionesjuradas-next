// scripts/dinero-replica.ts — Recalcula con lib/dinero el juego de oro (volcado sin datos personales)
// y compara al céntimo con lo guardado. Solo lee ficheros locales; escribe replica-r0.md al lado.
//   npx tsx scripts/dinero-replica.ts [directorio]   (por defecto /Users/nip/proyectos/tjnet-golden)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { centsFromEuros, formatEuros, parseVatRate, quoteTotals, invoiceTotalsFromLines, addVat, splitGross, marginOf, knownCost, UNKNOWN_COST, OWN_WORK, VAT_GENERAL_21, type Discount, type VatRegime } from "../lib/dinero/index.ts";

const dir = process.argv[2] || "/Users/nip/proyectos/tjnet-golden";
if (!existsSync(join(dir, "quotes.json"))) {
  console.log(`No hay juego de oro en ${dir} (falta quotes.json): nada que replicar.`);
  process.exit(0);
}
const load = (f: string): any[] => JSON.parse(readFileSync(join(dir, f), "utf8"));
const quotes = load("quotes.json");
const invoices = load("invoices.json");
const orders = load("orders.json");

type Discrepancy = { set: string; id: string; field: string; stored: number; recalculated: number; cause: string };
const discrepancies: Discrepancy[] = [];
const matched: Record<string, number> = {};
const total: Record<string, number> = {};
const errors: string[] = [];
const installmentQuotes: string[] = [];
const compared: Record<string, number> = {};

function record(set: string, id: string, fields: [string, number, number, string][]) {
  total[set] = (total[set] || 0) + 1;
  for (const [field] of fields) compared[`${set} · ${field.replace(/\[\d+\]/, "[i]")}`] = (compared[`${set} · ${field.replace(/\[\d+\]/, "[i]")}`] || 0) + 1;
  const bad = fields.filter(([, s, r]) => s !== r);
  if (bad.length === 0) matched[set] = (matched[set] || 0) + 1;
  for (const [field, stored, recalculated, cause] of bad) discrepancies.push({ set, id, field, stored, recalculated, cause });
}

function regimeOf(vatRate: unknown): VatRegime {
  // A stored 0 in this business is an operation «no sujeta» (client outside the EU / EU B2B).
  return parseVatRate(vatRate, { zeroAs: "notSubject" });
}
const bp = (r: VatRegime) => (r.kind === "general" ? r.rateBp : 0);
const isVatHalf = (base: number, r: VatRegime) => bp(r) > 0 && (base * bp(r)) % 10000 === 5000;

// (a) quotes
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
    const t = quoteTotals({ lines, discount, shippingCents, regime });
    const st = {
      subtotal: centsFromEuros(q.subtotal), discount: centsFromEuros(q.discountAmount), shipping: centsFromEuros(q.shippingAmount),
      vat: centsFromEuros(q.vatAmount), total: centsFromEuros(q.total), balance: q.balanceAmount == null ? 0 : centsFromEuros(q.balanceAmount),
    };
    const storedLines = q.lines.reduce((a: number, l: any) => a + centsFromEuros(l.lineTotal), 0);
    const fields: [string, number, number, string][] = [];
    q.lines.forEach((l: any, i: number) => fields.push([`lines[${i}].lineTotal`, centsFromEuros(l.lineTotal), t.lineTotals[i], "línea guardada ≠ cantidad × unitario"]));
    fields.push(["subtotal", st.subtotal, t.subtotal, storedLines === st.subtotal ? "subtotal ≠ Σ líneas recalculadas" : "subtotal guardado ≠ Σ de sus propias líneas (líneas cambiadas después)"]);
    let discountCause = "descuento sin clasificar";
    if (discount.kind === "percent" && Math.abs(t.discount - st.discount) === 1) discountCause = "descuento %: media exacta, el viejo redondea en euros flotantes";
    else if (discount.kind === "fixed" && st.discount > t.subtotal) discountCause = "descuento fijo mayor que el subtotal: el viejo se come el envío, el nuevo lo topa en el subtotal";
    else if (st.subtotal !== storedLines) discountCause = "consecuencia del subtotal guardado distinto";
    fields.push(["discountAmount", st.discount, t.discount, discountCause]);
    fields.push(["shippingAmount", st.shipping, t.shipping, "envío guardado ≠ parámetro shippingBase"]);
    const storedTaxable = st.subtotal - st.discount + st.shipping;
    const vatCause =
      storedTaxable !== t.taxableBase ? "consecuencia de una base distinta"
      : isVatHalf(t.taxableBase, regime) && t.vat - st.vat === 1 ? "IVA: media exacta; el viejo redondea en euros flotantes (G3), la regla única sube"
      : "IVA sin clasificar";
    fields.push(["vatAmount", st.vat, t.vat, vatCause]);
    // With installments the lines and `total` are the 1st installment; balanceAmount is stored apart, not derivable.
    if (st.balance > 0) installmentQuotes.push(`${id} (1.er plazo ${formatEuros(st.total)} + 2.º ${formatEuros(st.balance)})`);
    fields.push(["total", st.total, t.total, vatCause === "IVA sin clasificar" ? "total sin clasificar" : `consecuencia: ${vatCause}`]);
    record("presupuestos", id, fields);
  } catch (e) {
    errors.push(`presupuesto ${id}: ${(e as Error).message}`);
  }
}

// (b) invoices
const invoiceByOrder = new Map<string, any>();
for (const inv of invoices) {
  const id = inv.number || inv.id;
  try {
    const regime = regimeOf(inv.vatRate);
    const fields: [string, number, number, string][] = [];
    if (inv.lines.length > 0) {
      // A line without amount is a text-only row (heading/detail): it adds 0.
      const lineBases = inv.lines.map((l: any) => l.amountCents ?? 0);
      const fromLines = invoiceTotalsFromLines(lineBases, regime, { allowNegative: inv.invoiceType?.startsWith("R") });
      fields.push(["baseCents (desde líneas)", inv.baseCents, fromLines.base, "base ≠ Σ líneas"]);
    }
    const isNeg = inv.baseCents < 0;
    const fromBase = isNeg ? invoiceTotalsFromLines([inv.baseCents], regime, { allowNegative: true }) : addVat(inv.baseCents, regime);
    const fromGross = inv.totalCents >= 0 ? splitGross(inv.totalCents, regime) : null;
    const grossExplains = fromGross && fromGross.base === inv.baseCents;
    fields.push([
      "vatCents (base→cuota)", inv.vatCents, fromBase.vat,
      grossExplains ? `emitida desde el bruto cobrado (origin=${inv.origin}): conserva el total, base = total/1,21; no es base→cuota` : "cuota sin clasificar",
    ]);
    fields.push(["totalCents (base+cuota)", inv.totalCents, inv.baseCents + inv.vatCents, "total ≠ base + cuota guardadas"]);
    record("facturas", id, fields);
    if (inv.orderId && inv.invoiceType === "F1" || inv.orderId && inv.invoiceType === "F2") if (!inv.annulledAt) invoiceByOrder.set(inv.orderId, inv);
  } catch (e) {
    errors.push(`factura ${id}: ${(e as Error).message}`);
  }
}

// (c) orders: gross → base (Order has no VAT regime: the code assumes 21 %)
const quoteById = new Map(quotes.map((q: any) => [q.id, q]));
const marginClasses: Record<string, number> = {};
for (const o of orders) {
  const id = o.reference || o.id;
  try {
    const split = splitGross(o.amountCents, VAT_GENERAL_21);
    const fields: [string, number, number, string][] = [];
    const inv = invoiceByOrder.get(o.id);
    if (inv && inv.vatRate === 0.21) {
      fields.push(["base (factura del pedido)", inv.baseCents, split.base, inv.totalCents !== o.amountCents ? "la factura no es del importe del pedido (agrupada, parcial o con otro total)" : "base de factura ≠ bruto/1,21"]);
    }
    const q = o.quoteId ? quoteById.get(o.quoteId) : null;
    if (q && !q.balanceAmount) fields.push(["amountCents vs total del presupuesto", centsFromEuros(q.total), o.amountCents, "el pedido no cobró el total del presupuesto"]);
    record("pedidos", id, fields);
    // Data coherence, not arithmetic: OrderDocumentItem.quotedCents (gross per document) against what was charged.
    const items = (o.documentItems || []).filter((d: any) => d.quotedCents != null);
    if (items.length > 0 && items.length === o.documentItems.length) {
      const sum = items.reduce((a: number, d: any) => a + d.quotedCents, 0);
      const cause =
        sum === split.base ? "los documentos guardan el NETO aunque la columna es bruta (G8)"
        : Math.abs(sum - o.amountCents) <= items.length ? "×1,21 redondeado por documento: céntimos de ida y vuelta (G8)"
        : "los documentos no reflejan el cobro (precio rehecho, descuento, envío o documentos de más/menos)";
      record("pedidos-coherencia", id, [["Σ documentItems.quotedCents vs amountCents", o.amountCents, sum, cause]]);
    }
    const fr = String(o.langPair || "").toLowerCase().includes("fr");
    const cost = o.supplierCostCents != null ? knownCost(o.supplierCostCents) : fr ? OWN_WORK : UNKNOWN_COST;
    const m = marginOf(split.base, cost).class;
    marginClasses[m] = (marginClasses[m] || 0) + 1;
  } catch (e) {
    errors.push(`pedido ${id}: ${(e as Error).message}`);
  }
}

const byCause = new Map<string, Discrepancy[]>();
for (const d of discrepancies) byCause.set(`${d.set} · ${d.cause}`, [...(byCause.get(`${d.set} · ${d.cause}`) || []), d]);

const out: string[] = [];
out.push(`# Réplica R0 — lib/dinero contra el juego de oro (${new Date().toISOString().slice(0, 10)})`, "");
out.push(`Fuente: ${dir}. Regla única de IVA: cuota = ⌊(base·tipo + 5000)/10000⌋ en céntimos. vatRate 0 leído como «no sujeto». Pedidos: sin régimen guardado, se asume 21 %.`, "");
out.push("| Conjunto | Registros | Coinciden en todo | Con alguna discrepancia |", "|---|---|---|---|");
for (const set of ["presupuestos", "facturas", "pedidos", "pedidos-coherencia"]) out.push(`| ${set} | ${total[set] || 0} | ${matched[set] || 0} | ${(total[set] || 0) - (matched[set] || 0)} |`);
out.push("", `Margen de pedidos (ingreso = bruto/1,21; FR sin coste = trabajo propio): ${Object.entries(marginClasses).map(([k, v]) => `${k} ${v}`).join(" · ")}`, "");
out.push("«pedidos-coherencia» no mide el módulo: compara dos columnas guardadas (documentos vs cobro).", "");
out.push("## Comparaciones hechas", "", ...Object.entries(compared).map(([k, v]) => `- ${k}: ${v}`), "");
if (installmentQuotes.length) out.push(`Presupuestos a plazos (líneas y total = 1.er plazo; el 2.º se guarda aparte y no se deriva de las líneas): ${installmentQuotes.join("; ")}`, "");
if (errors.length) out.push("## Registros que el módulo rechaza", "", ...errors.map((e) => `- ${e}`), "");
out.push("## Discrepancias por causa", "", "| Causa | Nº |", "|---|---|");
for (const [cause, list] of [...byCause.entries()].sort((a, b) => b[1].length - a[1].length)) out.push(`| ${cause} | ${list.length} |`);
out.push("", "## Todas las discrepancias", "", "| Conjunto | id / número | Campo | Guardado | Recalculado | Diferencia | Causa |", "|---|---|---|---|---|---|---|");
for (const d of discrepancies) out.push(`| ${d.set} | ${d.id} | ${d.field} | ${formatEuros(d.stored)} | ${formatEuros(d.recalculated)} | ${formatEuros(d.recalculated - d.stored)} | ${d.cause} |`);
const target = join(dir, "replica-r0.md");
writeFileSync(target, out.join("\n") + "\n");
console.log(out.slice(0, 14).join("\n"));
console.log(`\n${discrepancies.length} discrepancias en ${byCause.size} causas; ${errors.length} rechazos. Informe: ${target}`);
for (const [cause, list] of byCause) console.log(`  ${list.length} · ${cause}`);
