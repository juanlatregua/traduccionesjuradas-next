// lib/asesor-contable/dossier.ts — «Dossier» determinista del periodo para el
// asesor contable IA. PURO (sin BD): recibe filas ya cargadas y devuelve las
// cifras exactas + hallazgos con enlace. Claude solo ve ESTE objeto: nada de
// lo que diga puede salir de otro sitio (ver validate.ts).
//
// No cambia ni duplica las reglas fiscales de la casa: el periodo sale de
// fiscal-period.ts y la numeración sigue el formato AA_NNN de invoice-math.ts.

import { parseFiscalPeriod, type FiscalPeriod } from "../fiscal-period.ts";
import { madridParts } from "../period-grouping.ts";
import { aggregateFiscal } from "../fiscal-aggregation.ts";

export type RawInvoice = {
  id: string;
  number: string | null;
  brand: string;
  issuedAt: Date | null;
  createdAt: Date;
  baseCents: number;
  vatCents: number;
  totalCents: number;
  paidAt: Date | null;
  orderPaid: boolean; // el pedido enlazado consta PAID (cobro por pasarela)
  dueDate: Date | null;
  annulledAt: Date | null;
  rectifiesId: string | null;
  orderReference: string | null;
  fiscalName: string;
};

export type RawExpense = {
  id: string;
  date: Date;
  brand: string;
  supplier: string | null;
  supplierNif: string | null;
  supplierInvoiceNumber: string | null;
  concept: string;
  category: string | null;
  baseCents: number;
  vatCents: number;
  totalCents: number;
  ivaDeducible: boolean;
  taxTreatment: string;
  irpfCents: number;
  isAccrual: boolean;
  settledById: string | null;
  needsReview: boolean;
  attachmentUrl: string | null;
  orderReference: string | null;
};

export type RawOrder = {
  reference: string;
  paidAt: Date | null;
  createdAt: Date;
  amountCents: number; // total cobrado, con IVA
  paymentMethod: string | null;
  billingExcluded: boolean;
  billingExcludedReason: string | null;
  invoiceIssued: boolean; // tiene ClientInvoice ISSUED de factura (no anulada)
  monthlyInvoiceIssued: boolean; // su factura agrupada del mes está emitida
  supplierCostCents: number | null;
  assignedTo: string | null;
  langPair: string | null;
};

export type DossierInput = {
  period: FiscalPeriod;
  previousPeriod: FiscalPeriod | null;
  today: string; // YYYY-MM-DD (Madrid)
  /** Facturas EMITIDAS (docKind invoice) desde el inicio del año del periodo (y del periodo anterior) hasta el fin del periodo. */
  invoices: RawInvoice[];
  /** Facturas emitidas sin cobrar (paidAt null, no anuladas) hasta el fin del periodo. */
  openInvoices: RawInvoice[];
  /** Gastos del periodo anterior, del actual y ±7 días alrededor. */
  expenses: RawExpense[];
  /** Pedidos PAID con cobro en el periodo anterior o en el actual. */
  orders: RawOrder[];
};

export type Link = { label: string; url: string };
export type Hallazgo = {
  id: string;
  tipo: string;
  texto: string;
  /** Importes con IVA desglosado (total, base y cuota), o null si no aplica. */
  importes: { total_eur?: number; base_eur?: number; iva_eur?: number; margen_eur?: number } | null;
  enlaces: Link[];
};

const eur = (c: number) => Math.round(c) / 100;
const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);

const MADRID_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" });
export function madridDay(d: Date): string {
  return MADRID_DAY.format(d);
}

// ── Periodos ────────────────────────────────────────────────────────────────

export function periodFromTag(tag: string): FiscalPeriod | null {
  const q = /^(\d{4})-T([1-4])$/.exec(tag);
  if (q) return parseFiscalPeriod(new URL(`http://x/?year=${q[1]}&q=${q[2]}`));
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(tag);
  if (m) return parseFiscalPeriod(new URL(`http://x/?year=${m[1]}&m=${Number(m[2])}`));
  return null;
}

export function previousPeriodTag(tag: string): string | null {
  const q = /^(\d{4})-T([1-4])$/.exec(tag);
  if (q) {
    const y = Number(q[1]);
    const n = Number(q[2]);
    return n === 1 ? `${y - 1}-T4` : `${y}-T${n - 1}`;
  }
  const m = /^(\d{4})-(\d{2})$/.exec(tag);
  if (m) {
    const y = Number(m[1]);
    const n = Number(m[2]);
    return n === 1 ? `${y - 1}-12` : `${y}-${String(n - 1).padStart(2, "0")}`;
  }
  return null;
}

/** Opciones del selector: trimestre en curso, el anterior, sus meses y dos trimestres más atrás. */
export function periodOptions(now: Date): { value: string; label: string }[] {
  const { year, month } = madridParts(now);
  const cur = `${year}-T${Math.ceil(month / 3)}`;
  const prev = previousPeriodTag(cur)!;
  const older1 = previousPeriodTag(prev)!;
  const older2 = previousPeriodTag(older1)!;
  const label = (t: string) => periodFromTag(t)?.label ?? t;
  const out: { value: string; label: string }[] = [
    { value: cur, label: `${label(cur)} (en curso)` },
    { value: prev, label: `${label(prev)} (anterior)` },
  ];
  for (const tag of [cur, prev]) {
    const m = /^(\d{4})-T([1-4])$/.exec(tag)!;
    const y = Number(m[1]);
    const first = (Number(m[2]) - 1) * 3 + 1;
    for (const i of [2, 1, 0]) {
      const mo = first + i;
      if (y === year && mo > month) continue;
      const t = `${y}-${String(mo).padStart(2, "0")}`;
      out.push({ value: t, label: label(t) });
    }
  }
  out.push({ value: older1, label: label(older1) }, { value: older2, label: label(older2) });
  return out;
}

// ── Utilidades ──────────────────────────────────────────────────────────────

const inPeriod = (d: Date | null | undefined, p: FiscalPeriod) => !!d && d.getTime() >= p.gte.getTime() && d.getTime() < p.lt.getTime();
const invDate = (i: RawInvoice) => i.issuedAt ?? i.createdAt;
const ordDate = (o: RawOrder) => o.paidAt ?? o.createdAt;

function groupBy<T>(xs: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) {
    const k = key(x);
    const a = m.get(k);
    if (a) a.push(x);
    else m.set(k, [x]);
  }
  return m;
}

const orderLink = (ref: string): Link => ({ label: `Pedido ${ref}`, url: `/zona-traductor/pedido/${encodeURIComponent(ref)}` });
const invoiceLink = (i: RawInvoice): Link => ({ label: `Factura ${i.number ?? "borrador"}`, url: `/api/invoices/${i.id}/pdf` });
const expenseLink = (e: RawExpense): Link => ({
  label: `Gasto ${e.supplier ?? e.concept} (${madridDay(e.date)})`,
  url: e.attachmentUrl || "/zona-traductor/contabilidad#estructurales",
});

const MAX_PER_TYPE = 12;

/** Resultado de un periodo: ingresos facturados (base) − gastos reales (base, sin devengos). */
function resultado(input: Pick<DossierInput, "invoices" | "expenses">, p: FiscalPeriod) {
  const ing = sum(input.invoices.filter((i) => !i.annulledAt && inPeriod(invDate(i), p)), (i) => i.baseCents);
  const gas = sum(input.expenses.filter((e) => !e.isAccrual && !e.needsReview && inPeriod(e.date, p)), (e) => e.baseCents);
  return { ingresos_base_eur: eur(ing), gastos_base_eur: eur(gas), resultado_eur: eur(ing - gas) };
}

// Proveedor normalizado para detectar duplicados. La cuota de autónomos (TGSS)
// aparece a veces como «TGSS», «Seguridad Social» o dentro de una nómina en
// especie: todas colapsan en la misma clave.
const TGSS_RE = /tgss|tesorer[ií]a general|seguridad social|cuota de aut[oó]nomos/i;
export function supplierKey(e: Pick<RawExpense, "supplier" | "concept">): string | null {
  if (TGSS_RE.test(e.supplier || "") || TGSS_RE.test(e.concept || "")) return "tgss";
  const s = (e.supplier || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
  return s || null;
}

const DUP_DAYS = 7;

export function findDuplicateExpenses(expenses: RawExpense[], p: FiscalPeriod): [RawExpense, RawExpense][] {
  const real = expenses.filter((e) => !e.isAccrual && e.baseCents > 0);
  const out: [RawExpense, RawExpense][] = [];
  const byKey = groupBy(real, (e) => `${supplierKey(e) ?? `~${e.id}`}|${e.totalCents}`);
  for (const group of byKey.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id));
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i];
        const b = sorted[j];
        if (b.date.getTime() - a.date.getTime() > DUP_DAYS * 86_400_000) break;
        if (!inPeriod(a.date, p) && !inPeriod(b.date, p)) continue;
        // Dos números de factura de proveedor distintos = dos facturas distintas.
        const na = (a.supplierInvoiceNumber || "").trim();
        const nb = (b.supplierInvoiceNumber || "").trim();
        if (na && nb && na !== nb) continue;
        out.push([a, b]);
      }
    }
  }
  return out;
}

export function checkNumbering(invoices: RawInvoice[], yearYY: string) {
  const re = new RegExp(`^${yearYY}_(\\d{3,})$`);
  const rows = invoices
    .filter((i) => i.number && re.test(i.number))
    .map((i) => ({ inv: i, n: Number(re.exec(i.number!)![1]) }))
    .sort((a, b) => a.n - b.n);
  const fueraDeOrden: [RawInvoice, RawInvoice][] = [];
  const huecos: string[] = [];
  if (rows.length === 0) return { primera: null as string | null, ultima: null as string | null, huecos, fueraDeOrden };
  const have = new Set(rows.map((r) => r.n));
  const width = rows[0].inv.number!.split("_")[1].length;
  for (let n = rows[0].n; n <= rows[rows.length - 1].n; n++) {
    if (!have.has(n)) huecos.push(`${yearYY}_${String(n).padStart(width, "0")}`);
  }
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1].inv;
    const cur = rows[i].inv;
    if (madridDay(invDate(cur)) < madridDay(invDate(prev))) fueraDeOrden.push([prev, cur]);
  }
  return { primera: rows[0].inv.number, ultima: rows[rows.length - 1].inv.number, huecos, fueraDeOrden };
}

// ── Dossier ─────────────────────────────────────────────────────────────────

const OWN_BRANDS = new Set(["traduccionesjuradas", "holabonjour"]);
const isFrPair = (pair: string | null | undefined) => /(^|[^a-z])fr([^a-z]|$)/i.test(pair || "");
// Nóminas en especie y cuotas TGSS: no llevan justificante propio adjunto.
const isPayrollOrTgss = (e: Pick<RawExpense, "supplier" | "concept" | "category">) =>
  TGSS_RE.test(e.supplier || "") || TGSS_RE.test(e.concept || "") || /n[oó]min/i.test(`${e.category || ""} ${e.concept || ""}`);

const pct = (num: number, den: number): number | null => (den === 0 ? null : Math.round((num / den) * 1000) / 10);
/** Variación porcentual respecto al periodo anterior (null si el anterior es 0). */
const variation = (cur: number, prev: number): number | null => (prev === 0 ? null : Math.round(((cur - prev) / Math.abs(prev)) * 1000) / 10);

// Desglose siempre completo: total, base y cuota de IVA.
const amounts = (totalCents: number, baseCents: number) => ({ total_eur: eur(totalCents), base_eur: eur(baseCents), iva_eur: eur(totalCents - baseCents) });

export function buildDossier(input: DossierInput) {
  const { period: p } = input;
  const hallazgos: Hallazgo[] = [];
  const counters: Record<string, number> = {};
  // Los textos de los hallazgos van a la IA: solo números de factura/gasto/pedido,
  // categorías y tipos. Nunca nombres de clientes o colaboradores ni URLs.
  const add = (prefix: string, tipo: string, texto: string, a: Hallazgo["importes"], enlaces: Link[]) => {
    const n = (counters[prefix] = (counters[prefix] ?? 0) + 1);
    if (n > MAX_PER_TYPE) return;
    hallazgos.push({ id: `${prefix}${n}`, tipo, texto, importes: a, enlaces });
  };
  const fromGross = (cents: number) => amounts(cents, Math.round(cents / 1.21));

  // 1. Ingresos facturados por marca (las anuladas no cuentan; las rectificativas restan).
  const invPeriod = input.invoices.filter((i) => inPeriod(invDate(i), p));
  const vivas = invPeriod.filter((i) => !i.annulledAt);
  const ingBase = sum(vivas, (i) => i.baseCents);
  const porMarca = [...groupBy(vivas, (i) => i.brand || "traduccionesjuradas").entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([marca, xs]) => ({
      marca,
      facturas: xs.length,
      base_eur: eur(sum(xs, (i) => i.baseCents)),
      iva_eur: eur(sum(xs, (i) => i.vatCents)),
      total_eur: eur(sum(xs, (i) => i.totalCents)),
      peso_sobre_ingresos_pct: pct(sum(xs, (i) => i.baseCents), ingBase),
    }));
  for (const [marca, xs] of groupBy(vivas, (i) => i.brand || "traduccionesjuradas")) {
    if (OWN_BRANDS.has(marca)) continue;
    add("X", "ingreso_marca_atipica", `Ingresos de la marca «${marca}» (${xs.length} factura(s)): ¿a qué corresponden?`, amounts(sum(xs, (i) => i.totalCents), sum(xs, (i) => i.baseCents)), xs.map(invoiceLink));
  }

  // 2. Cobros sin factura (ni suelta ni agrupada del mes).
  const sinFactura = input.orders.filter((o) => inPeriod(ordDate(o), p) && o.amountCents > 0 && !o.invoiceIssued && !o.monthlyInvoiceIssued);
  const isBizum = (o: RawOrder) => String(o.paymentMethod || "").toUpperCase() === "BIZUM";
  const bizum = sinFactura.filter(isBizum);
  const apartados = sinFactura.filter((o) => !isBizum(o) && o.billingExcluded);
  const otros = sinFactura.filter((o) => !isBizum(o) && !o.billingExcluded);
  const byAmount = (xs: RawOrder[]) => [...xs].sort((a, b) => b.amountCents - a.amountCents || a.reference.localeCompare(b.reference));
  for (const o of byAmount(bizum)) add("B", "cobro_sin_factura_bizum", `Pedido ${o.reference} cobrado por Bizum el ${madridDay(ordDate(o))}, sin factura`, fromGross(o.amountCents), [orderLink(o.reference)]);
  for (const o of byAmount(apartados)) add("A", "cobro_apartado", `Pedido ${o.reference} apartado de la facturación`, fromGross(o.amountCents), [orderLink(o.reference)]);
  for (const o of byAmount(otros)) add("S", "cobro_sin_factura", `Pedido ${o.reference} cobrado el ${madridDay(ordDate(o))} (${o.paymentMethod ?? "método sin registrar"}) sin factura emitida`, fromGross(o.amountCents), [orderLink(o.reference)]);
  const grossGroup = (xs: RawOrder[]) => ({ pedidos: xs.length, ...amounts(sum(xs, (o) => o.amountCents), sum(xs, (o) => Math.round(o.amountCents / 1.21))) });

  // 3. Gastos reales. Fuera los devengos (se cuentan por su factura al liquidarse)
  // y, como en la página de Contabilidad, los «por revisar» (recurrentes sin
  // confirmar): esos van aparte, como hallazgo.
  const gastosPeriodo = input.expenses.filter((e) => inPeriod(e.date, p));
  const reales = gastosPeriodo.filter((e) => !e.isAccrual);
  const confirmados = reales.filter((e) => !e.needsReview);
  const devengos = gastosPeriodo.filter((e) => e.isAccrual);
  const gasBase = sum(confirmados, (e) => e.baseCents);
  const gGroup = (xs: RawExpense[]) => ({ gastos: xs.length, base_eur: eur(sum(xs, (e) => e.baseCents)), iva_eur: eur(sum(xs, (e) => e.vatCents)), total_eur: eur(sum(xs, (e) => e.totalCents)), peso_sobre_gastos_pct: pct(sum(xs, (e) => e.baseCents), gasBase) });
  const porCategoria = [...groupBy(confirmados, (e) => e.category || "sin categoría").entries()]
    .sort((a, b) => sum(b[1], (e) => e.baseCents) - sum(a[1], (e) => e.baseCents) || a[0].localeCompare(b[0]))
    .map(([categoria, xs]) => ({ categoria, ...gGroup(xs) }));
  const porMarcaGasto = [...groupBy(confirmados, (e) => e.brand || "traduccionesjuradas").entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([marca, xs]) => ({ marca, ...gGroup(xs) }));

  const liquidados = devengos.filter((d) => d.settledById);
  const pendientesDev = devengos.filter((d) => !d.settledById);
  for (const d of [...pendientesDev].sort((a, b) => b.baseCents - a.baseCents || a.id.localeCompare(b.id))) {
    add("P", "devengo_pendiente", `Devengo pendiente de la factura de un colaborador${d.orderReference ? ` (pedido ${d.orderReference})` : ""}, del ${madridDay(d.date)}`, amounts(d.totalCents, d.baseCents), d.orderReference ? [orderLink(d.orderReference)] : [expenseLink(d)]);
  }

  // 4. IVA y IRPF: MISMA fuente que la página de Contabilidad (aggregateFiscal).
  const { d303, d111 } = aggregateFiscal(vivas, reales);

  // 5. Facturas pendientes de cobro y vencidas.
  const abiertas = input.openInvoices.filter((i) => !i.annulledAt && !i.paidAt && !i.orderPaid && i.totalCents > 0 && invDate(i).getTime() < p.lt.getTime());
  const esVencida = (i: RawInvoice) => !!i.dueDate && madridDay(i.dueDate) < input.today;
  const vencidas = abiertas.filter(esVencida);
  const byTotal = (xs: RawInvoice[]) => [...xs].sort((a, b) => b.totalCents - a.totalCents || (a.number ?? "").localeCompare(b.number ?? ""));
  const invAmounts = (i: RawInvoice) => amounts(i.totalCents, i.baseCents);
  for (const i of byTotal(vencidas)) add("V", "factura_vencida", `Factura ${i.number}, vencida el ${madridDay(i.dueDate!)}`, invAmounts(i), [invoiceLink(i)]);
  for (const i of byTotal(abiertas.filter((x) => !esVencida(x)))) add("C", "factura_pendiente_cobro", `Factura ${i.number}, emitida el ${madridDay(invDate(i))}, sin cobro registrado`, invAmounts(i), [invoiceLink(i)]);
  const invGroup = (xs: RawInvoice[]) => ({ facturas: xs.length, base_eur: eur(sum(xs, (i) => i.baseCents)), iva_eur: eur(sum(xs, (i) => i.vatCents)), total_eur: eur(sum(xs, (i) => i.totalCents)) });

  // 6. Gastos que piden revisión.
  const necesitaRev = reales.filter((e) => e.needsReview);
  const sinAdjunto = confirmados.filter((e) => !e.attachmentUrl && !isPayrollOrTgss(e));
  const sinNif = confirmados.filter((e) => !e.supplierNif && e.baseCents > 0);
  const gastoTxt = (e: RawExpense) => `de ${e.category || "sin categoría"} del ${madridDay(e.date)}${e.supplierInvoiceNumber ? ` (factura ${e.supplierInvoiceNumber})` : ""}`;
  const eAmounts = (e: RawExpense) => amounts(e.totalCents, e.baseCents);
  for (const e of necesitaRev) add("R", "gasto_por_revisar", `Gasto ${gastoTxt(e)} marcado «por revisar» (no está en las cifras de gastos ni de IVA)`, eAmounts(e), [expenseLink(e)]);
  for (const e of sinAdjunto) add("J", "gasto_sin_adjunto", `Gasto ${gastoTxt(e)} sin justificante adjunto`, eAmounts(e), [expenseLink(e)]);
  for (const e of sinNif.filter((x) => x.attachmentUrl)) add("I", "gasto_sin_nif", `Gasto ${gastoTxt(e)} sin NIF del proveedor`, eAmounts(e), [expenseLink(e)]);

  // 7. Margen por pedido (cobrados en el periodo). Base = total / 1,21.
  // Los pedidos FR propios llevan coste 0 a propósito: no cuentan como «sin coste».
  const cobrados = input.orders.filter((o) => inPeriod(ordDate(o), p) && o.amountCents > 0);
  const netoPedido = (o: RawOrder) => Math.round(o.amountCents / 1.21);
  const sinCoste = cobrados.filter((o) => o.supplierCostCents === null && !isFrPair(o.langPair));
  const conCoste = cobrados.filter((o) => o.supplierCostCents !== null);
  const margenNoPos = conCoste.filter((o) => netoPedido(o) - (o.supplierCostCents ?? 0) <= 0 && !(isFrPair(o.langPair) && o.supplierCostCents === 0));
  for (const o of margenNoPos) add("M", "margen_no_positivo", `Pedido ${o.reference} con margen igual o menor que cero`, { ...fromGross(o.amountCents), margen_eur: eur(netoPedido(o) - (o.supplierCostCents ?? 0)) }, [orderLink(o.reference)]);
  for (const o of sinCoste) add("K", "pedido_sin_coste", `Pedido ${o.reference} cobrado sin coste de traducción registrado`, fromGross(o.amountCents), [orderLink(o.reference)]);

  // 8. Duplicados.
  const dups = findDuplicateExpenses(input.expenses, p);
  for (const [a, b] of dups) {
    add("D", "posible_duplicado", `Posible duplicado: gasto ${gastoTxt(a)} y gasto ${gastoTxt(b)}, mismo importe y proveedor con pocos días de diferencia`, eAmounts(a), [expenseLink(a), expenseLink(b)]);
  }

  // 9. Numeración de la serie del año del periodo (el orden de fechas, solo dentro del periodo).
  const yy = p.tag.slice(2, 4);
  const num = checkNumbering(input.invoices.filter((i) => i.number?.startsWith(`${yy}_`)), yy);
  const fueraDeOrden = num.fueraDeOrden.filter(([a, b]) => inPeriod(invDate(a), p) || inPeriod(invDate(b), p));
  for (const h of num.huecos) add("N", "hueco_numeracion", `Falta el número ${h} en la serie de facturas`, null, [{ label: "Facturas", url: "/zona-traductor/facturas" }]);
  for (const [a, b] of fueraDeOrden) add("O", "numeracion_fuera_de_orden", `La factura ${b.number} (${madridDay(invDate(b))}) tiene fecha anterior a la ${a.number} (${madridDay(invDate(a))})`, null, [invoiceLink(a), invoiceLink(b)]);

  const pendienteDevCents = sum(pendientesDev, (d) => d.baseCents);
  const res = resultado(input, p);
  const prevRes = input.previousPeriod ? resultado(input, input.previousPeriod) : null;
  const margenCoste = sum(conCoste, (o) => netoPedido(o) - (o.supplierCostCents ?? 0));

  return {
    periodo: {
      etiqueta: p.label,
      tag: p.tag,
      desde: madridDay(p.gte),
      hasta: madridDay(new Date(p.lt.getTime() - 12 * 3_600_000)),
      fecha_de_calculo: input.today,
    },
    resultado: {
      ...res,
      margen_sobre_ingresos_pct: pct(ingBase - gasBase, ingBase),
      devengos_pendientes_eur: eur(pendienteDevCents),
      resultado_con_devengos_pendientes_eur: eur(ingBase - gasBase - pendienteDevCents),
    },
    comparativa_periodo_anterior:
      input.previousPeriod && prevRes
        ? {
            etiqueta: input.previousPeriod.label,
            ...prevRes,
            variacion_ingresos_pct: variation(res.ingresos_base_eur, prevRes.ingresos_base_eur),
            variacion_gastos_pct: variation(res.gastos_base_eur, prevRes.gastos_base_eur),
          }
        : null,
    ingresos_facturados: {
      por_marca: porMarca,
      base_eur: eur(ingBase),
      iva_repercutido_eur: eur(sum(vivas, (i) => i.vatCents)),
      total_eur: eur(sum(vivas, (i) => i.totalCents)),
      facturas_anuladas_excluidas: invPeriod.length - vivas.length,
      rectificativas: vivas.filter((i) => i.rectifiesId).length,
    },
    cobros_sin_factura: {
      bizum: grossGroup(bizum),
      apartados_de_facturacion: grossGroup(apartados),
      otros: grossGroup(otros),
    },
    gastos: {
      base_eur: eur(gasBase),
      iva_eur: eur(sum(confirmados, (e) => e.vatCents)),
      total_eur: eur(sum(confirmados, (e) => e.totalCents)),
      gastos_registrados: confirmados.length,
      por_categoria: porCategoria,
      por_marca: porMarcaGasto,
    },
    gastos_por_revisar_aparte: {
      gastos: necesitaRev.length,
      base_eur: eur(sum(necesitaRev, (e) => e.baseCents)),
      iva_eur: eur(sum(necesitaRev, (e) => e.vatCents)),
      total_eur: eur(sum(necesitaRev, (e) => e.totalCents)),
      nota: "No están incluidos en gastos ni en el IVA soportado (igual que en la página de Contabilidad).",
    },
    devengos_de_colaboradores: {
      en_periodo: devengos.length,
      base_eur: eur(sum(devengos, (d) => d.baseCents)),
      liquidados: liquidados.length,
      liquidados_base_eur: eur(sum(liquidados, (d) => d.baseCents)),
      pendientes: pendientesDev.length,
      pendientes_base_eur: eur(pendienteDevCents),
      nota: "Los devengos NO están incluidos en gastos: un devengo liquidado ya cuenta por la factura del colaborador.",
    },
    iva_estimado: {
      repercutido_eur: eur(d303.ivaRepercutidoCents),
      soportado_deducible_eur: eur(d303.ivaSoportadoDeducibleCents),
      modelo_303_estimado_eur: eur(d303.resultadoCents),
      nota: "Mismo cálculo que la página de Contabilidad (incluye la inversión del sujeto pasivo). Positivo = a ingresar. Estimación: no sustituye a la gestoría.",
    },
    irpf_estimado: {
      base_retenciones_eur: eur(d111.baseRetencionesCents),
      retenido_eur: eur(d111.retencionesCents),
      perceptores: d111.numPerceptores,
      modelo_111_estimado_eur: eur(d111.retencionesCents),
    },
    cobros_pendientes: {
      ...invGroup(abiertas),
      vencidas: vencidas.length,
      vencidas_base_eur: eur(sum(vencidas, (i) => i.baseCents)),
      vencidas_iva_eur: eur(sum(vencidas, (i) => i.vatCents)),
      vencidas_total_eur: eur(sum(vencidas, (i) => i.totalCents)),
    },
    revision_de_gastos: {
      por_revisar: necesitaRev.length,
      sin_adjunto: sinAdjunto.length,
      sin_nif_proveedor: sinNif.length,
    },
    margen_por_pedido: {
      pedidos_cobrados: cobrados.length,
      sin_coste_registrado: sinCoste.length,
      sin_coste: amounts(sum(sinCoste, (o) => o.amountCents), sum(sinCoste, netoPedido)),
      margen_no_positivo: margenNoPos.length,
      margen_medio_pedidos_con_coste_pct: pct(margenCoste, sum(conCoste, netoPedido)),
    },
    posibles_duplicados: dups.length,
    numeracion: {
      serie: `${yy}_NNN`,
      primera: num.primera,
      ultima: num.ultima,
      huecos: num.huecos.length,
      fuera_de_orden: fueraDeOrden.length,
    },
    hallazgos,
    hallazgos_omitidos_por_limite: Object.values(counters).reduce((s, n) => s + Math.max(0, n - MAX_PER_TYPE), 0),
  };
}

export type Dossier = ReturnType<typeof buildDossier>;

/** Vista para la IA: sin enlaces (llevan nombres de clientes/colaboradores y URLs de Blob). */
export function dossierForModel(d: Dossier) {
  return { ...d, hallazgos: d.hallazgos.map(({ enlaces: _enlaces, ...h }) => h) };
}
