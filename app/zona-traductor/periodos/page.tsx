import type { Metadata } from "next";
import ContabilidadSubNav from "@/components/ContabilidadSubNav";
import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { authZonaTraductorOrRedirect } from "@/lib/zona-traductor-data";
import { prisma } from "@/lib/prisma";
import { decimalToNumber, moneyToCents, QUOTE_STATUS_LABELS, type QuoteStatus } from "@/lib/quotes";
import {
  groupByPeriod,
  availableYears,
  parsePeriodKey,
  matchesPeriod,
  formatPeriodLabel,
  formatEurCents,
  MADRID_TZ,
  type PeriodItem,
  type StateTotals,
} from "@/lib/period-grouping";

export const metadata: Metadata = {
  title: "Zona traductor — Periodos",
  description: "Contabilidad, presupuestos y pedidos agrupados por trimestre y mes.",
  robots: { index: false, follow: false },
};

type Vista = "ingresos" | "presupuestos" | "pedidos";
const VISTAS: { key: Vista; label: string }[] = [
  { key: "ingresos", label: "Ingresos (facturas)" },
  { key: "presupuestos", label: "Presupuestos" },
  { key: "pedidos", label: "Pedidos" },
];

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pend. pago",
  PAID: "Pagado",
  FAILED: "Fallido",
  REFUNDED: "Reembolsado",
};
const DELIVERY_STATE_LABELS: Record<string, string> = {
  PRESUPUESTO: "Presupuesto",
  EN_PROCESO: "En proceso",
  TRADUCIDO: "Traducido",
};
const INVOICE_STATE_LABELS: Record<string, string> = {
  COBRADA: "Cobrada",
  PENDIENTE: "Pend. cobro",
};

type Column = { label: string; align?: "right" };
type DetailRow = { date: Date | null; amountCents: number; state?: string | null; cells: ReactNode[] };

type Dataset = {
  items: PeriodItem[];
  rows: DetailRow[];
  columns: Column[];
  stateLabels: Record<string, string>;
  amountHeader: string; // qué mide la columna "Total" del resumen
};

function fmtDate(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: MADRID_TZ });
}

function s(raw?: string | string[]): string {
  return (Array.isArray(raw) ? raw[0] : raw || "").trim();
}

async function loadIngresos(): Promise<Dataset> {
  const raw = await prisma.clientInvoice.findMany({
    where: { status: "ISSUED", docKind: "invoice" },
    orderBy: { issuedAt: "desc" },
    take: 5000,
    select: {
      id: true,
      number: true,
      issuedAt: true,
      createdAt: true,
      fiscalName: true,
      baseCents: true,
      vatCents: true,
      totalCents: true,
      paidAt: true,
    },
  });
  const items: PeriodItem[] = raw.map((i) => ({
    date: i.issuedAt ?? i.createdAt,
    amountCents: i.totalCents,
    state: i.paidAt ? "COBRADA" : "PENDIENTE",
  }));
  const rows: DetailRow[] = raw.map((i) => {
    const date = i.issuedAt ?? i.createdAt;
    return {
      date,
      amountCents: i.totalCents,
      state: i.paidAt ? "COBRADA" : "PENDIENTE",
      cells: [
        <span key="num" className="font-mono text-cyan-300">{i.number || "—"}</span>,
        <span key="date" className="text-slate-400">{fmtDate(date)}</span>,
        <span key="client">{i.fiscalName}</span>,
        <span key="base" className="tabular-nums">{formatEurCents(i.baseCents)}</span>,
        <span key="vat" className="tabular-nums">{formatEurCents(i.vatCents)}</span>,
        <span key="total" className="tabular-nums font-semibold">{formatEurCents(i.totalCents)}</span>,
        <a
          key="pdf"
          href={`/api/invoices/${i.id}/pdf`}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-slate-600 px-2.5 py-1 text-xs font-semibold text-cyan-300 hover:bg-slate-800"
        >
          PDF
        </a>,
      ],
    };
  });
  return {
    items,
    rows,
    columns: [
      { label: "Número" },
      { label: "Fecha" },
      { label: "Cliente" },
      { label: "Base", align: "right" },
      { label: "IVA", align: "right" },
      { label: "Total", align: "right" },
      { label: "" },
    ],
    stateLabels: INVOICE_STATE_LABELS,
    amountHeader: "Facturado (con IVA)",
  };
}

async function loadPresupuestos(): Promise<Dataset> {
  const raw = await prisma.quote.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 5000,
    select: {
      id: true,
      quoteNumber: true,
      createdAt: true,
      status: true,
      customerName: true,
      customerEmail: true,
      sourceLang: true,
      targetLang: true,
      total: true,
    },
  });
  const items: PeriodItem[] = raw.map((q) => ({
    date: q.createdAt,
    amountCents: moneyToCents(decimalToNumber(q.total)),
    state: q.status,
  }));
  const rows: DetailRow[] = raw.map((q) => ({
    date: q.createdAt,
    amountCents: moneyToCents(decimalToNumber(q.total)),
    state: q.status,
    cells: [
      <a key="num" href={`/admin/quotes/${q.id}`} className="font-mono text-cyan-300 hover:text-cyan-200">
        {q.quoteNumber}
      </a>,
      <span key="date" className="text-slate-400">{fmtDate(q.createdAt)}</span>,
      <span key="client">
        <span className="block">{q.customerName}</span>
        <span className="block text-xs text-slate-500">{q.customerEmail}</span>
      </span>,
      <span key="langs" className="text-slate-400">
        {q.sourceLang} → {q.targetLang}
      </span>,
      <span key="state" className="text-slate-300">{QUOTE_STATUS_LABELS[(q.status as QuoteStatus) || "DRAFT"]}</span>,
      <span key="total" className="tabular-nums font-semibold">{formatEurCents(moneyToCents(decimalToNumber(q.total)))}</span>,
    ],
  }));
  return {
    items,
    rows,
    columns: [
      { label: "Nº" },
      { label: "Fecha" },
      { label: "Cliente" },
      { label: "Idiomas" },
      { label: "Estado" },
      { label: "Total", align: "right" },
    ],
    stateLabels: QUOTE_STATUS_LABELS,
    amountHeader: "Importe presupuestado",
  };
}

async function loadPedidos(base: "created" | "paid"): Promise<Dataset> {
  const raw = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 5000,
    select: {
      reference: true,
      clientName: true,
      clientEmail: true,
      langPair: true,
      amountCents: true,
      paymentStatus: true,
      deliveryState: true,
      createdAt: true,
      paidAt: true,
    },
  });
  const picked = raw
    .map((o) => ({ ...o, refDate: base === "paid" ? o.paidAt : o.createdAt }))
    .filter((o) => o.refDate != null);
  const items: PeriodItem[] = picked.map((o) => ({
    date: o.refDate,
    amountCents: o.amountCents,
    state: o.paymentStatus,
  }));
  const rows: DetailRow[] = picked.map((o) => ({
    date: o.refDate,
    amountCents: o.amountCents,
    state: o.paymentStatus,
    cells: [
      <Link key="ref" href={`/zona-traductor/pedido/${o.reference}`} className="font-mono text-cyan-300 hover:text-cyan-200">
        {o.reference}
      </Link>,
      <span key="date" className="text-slate-400">{fmtDate(o.refDate)}</span>,
      <span key="client">
        <span className="block">{o.clientName || "—"}</span>
        <span className="block text-xs text-slate-500">{o.clientEmail}</span>
      </span>,
      <span key="langs" className="text-slate-400">{o.langPair || "—"}</span>,
      <span key="pay" className="text-slate-300">{PAYMENT_STATUS_LABELS[o.paymentStatus] ?? o.paymentStatus}</span>,
      <span key="delivery" className="text-slate-300">{DELIVERY_STATE_LABELS[o.deliveryState] ?? o.deliveryState}</span>,
      <span key="amount" className="tabular-nums font-semibold">{formatEurCents(o.amountCents)}</span>,
    ],
  }));
  return {
    items,
    rows,
    columns: [
      { label: "Ref" },
      { label: "Fecha" },
      { label: "Cliente" },
      { label: "Idiomas" },
      { label: "Pago" },
      { label: "Entrega" },
      { label: "Importe", align: "right" },
    ],
    stateLabels: PAYMENT_STATUS_LABELS,
    amountHeader: base === "paid" ? "Cobrado (fecha cobro)" : "Importe (fecha pedido)",
  };
}

function StateBadges({ byState, labels }: { byState: StateTotals; labels: Record<string, string> }) {
  const entries = Object.entries(byState).sort((a, b) => b[1].count - a[1].count);
  if (entries.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {entries.map(([key, v]) => (
        <span key={key} className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
          {labels[key] ?? key}: {v.count}
        </span>
      ))}
    </div>
  );
}

export default async function ZonaTraductorPeriodosPage({
  searchParams,
}: {
  searchParams: { vista?: string; anio?: string; base?: string; periodo?: string; mes?: string };
}) {
  await authZonaTraductorOrRedirect();

  const vista: Vista = VISTAS.some((v) => v.key === s(searchParams.vista))
    ? (s(searchParams.vista) as Vista)
    : "ingresos";
  const base: "created" | "paid" = s(searchParams.base) === "paid" ? "paid" : "created";

  const dataset =
    vista === "presupuestos"
      ? await loadPresupuestos()
      : vista === "pedidos"
        ? await loadPedidos(base)
        : await loadIngresos();

  const years = availableYears(dataset.items);
  const groups = groupByPeriod(dataset.items);

  // Periodo de drill-down: ?mes=YYYY-MM tiene prioridad sobre ?periodo=YYYY-Qx|YYYY.
  const selectedKey = s(searchParams.mes) || s(searchParams.periodo);
  const parsed = parsePeriodKey(selectedKey);

  // Año visible: param explícito > año del periodo seleccionado > año más reciente.
  let selectedYear = years[0];
  const anioParam = Number(s(searchParams.anio));
  if (years.includes(anioParam)) selectedYear = anioParam;
  else if (parsed && years.includes(parsed.year)) selectedYear = parsed.year;

  const yearBucket = groups.find((g) => g.year === selectedYear) || null;

  const baseQs: Record<string, string | undefined> = {
    vista,
    anio: selectedYear != null ? String(selectedYear) : undefined,
    base: vista === "pedidos" ? base : undefined,
  };
  function href(extra: Record<string, string | undefined> = {}, override: Record<string, string | undefined> = {}) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...baseQs, ...extra, ...override })) {
      if (v != null && v !== "") p.set(k, v);
    }
    const qs = p.toString();
    return `/zona-traductor/periodos${qs ? `?${qs}` : ""}`;
  }

  const detailRows = parsed ? dataset.rows.filter((r) => matchesPeriod(r.date, parsed)) : [];
  const detailTotal = detailRows.reduce((acc, r) => acc + r.amountCents, 0);

  const tabClass = (active: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
      active ? "bg-cyan-700 text-white" : "border border-slate-600 text-slate-300 hover:bg-slate-800"
    }`;
  const pillClass = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm font-semibold ${
      active ? "bg-slate-100 text-slate-900" : "border border-slate-600 text-slate-300 hover:bg-slate-800"
    }`;

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <ContabilidadSubNav />
        <h1 className="text-2xl font-semibold text-white">Periodos · trimestres y meses</h1>
        <p className="mt-1 text-sm text-slate-400">
          Agrupa ingresos, presupuestos y pedidos por trimestre y mes (zona horaria Europe/Madrid). Útil para cierres
          trimestrales y la revisión mensual. Pulsa un periodo para ver el detalle.
        </p>

        {/* Selector de vista */}
        <div className="mt-5 flex flex-wrap gap-2">
          {VISTAS.map((v) => (
            <Link key={v.key} href={`/zona-traductor/periodos?vista=${v.key}`} className={tabClass(v.key === vista)}>
              {v.label}
            </Link>
          ))}
        </div>

        {/* Base de fecha (solo pedidos) */}
        {vista === "pedidos" && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>Agrupar por:</span>
            <Link href={href({}, { base: "created", periodo: undefined, mes: undefined })} className={pillClass(base === "created")}>
              Fecha pedido
            </Link>
            <Link href={href({}, { base: "paid", periodo: undefined, mes: undefined })} className={pillClass(base === "paid")}>
              Fecha cobro
            </Link>
          </div>
        )}

        {vista === "ingresos" && (
          <p className="mt-3 text-xs text-slate-500">
            ¿Buscas el IVA a liquidar y los borradores 303/111/130?{" "}
            <Link href="/zona-traductor/contabilidad" className="text-cyan-300 underline hover:text-cyan-200">
              Ir a Contabilidad general
            </Link>
            .
          </p>
        )}

        {years.length === 0 || !yearBucket ? (
          <p className="mt-8 text-sm text-slate-500">No hay datos para mostrar todavía.</p>
        ) : (
          <>
            {/* Selector de año */}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-slate-500">Año</span>
              {years.map((y) => (
                <Link key={y} href={href({ anio: String(y) }, { periodo: undefined, mes: undefined })} className={pillClass(y === selectedYear)}>
                  {y}
                </Link>
              ))}
            </div>

            {/* Resumen anual */}
            <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/50 p-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">{dataset.amountHeader} · {selectedYear}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{formatEurCents(yearBucket.totalCents)}</p>
                </div>
                <p className="text-sm text-slate-400">
                  {yearBucket.count} registro{yearBucket.count === 1 ? "" : "s"} en el año
                </p>
              </div>
              <StateBadges byState={yearBucket.byState} labels={dataset.stateLabels} />
            </div>

            {/* Resumen por trimestre y mes */}
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-700">
              <table className="w-full text-sm text-slate-200">
                <thead className="bg-slate-800/60 text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-2">Trimestre / Mes</th>
                    <th className="px-4 py-2 text-right">Nº</th>
                    <th className="px-4 py-2 text-right">{dataset.amountHeader}</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {yearBucket.quarters.map((q) => (
                    <Fragment key={q.key}>
                      <tr className={`bg-slate-900/40 ${selectedKey === q.key ? "ring-1 ring-inset ring-cyan-500/50" : ""}`}>
                        <td className="px-4 py-2">
                          <span className="font-semibold text-white">{q.label}</span>
                          <StateBadges byState={q.byState} labels={dataset.stateLabels} />
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">{q.count}</td>
                        <td className="px-4 py-2 text-right tabular-nums font-semibold text-white">{formatEurCents(q.totalCents)}</td>
                        <td className="px-4 py-2 text-right">
                          {q.count > 0 && (
                            <Link
                              href={href({}, { periodo: q.key, mes: undefined })}
                              className="rounded-lg border border-slate-600 px-2.5 py-1 text-xs font-semibold text-cyan-300 hover:bg-slate-800"
                            >
                              Ver detalle
                            </Link>
                          )}
                        </td>
                      </tr>
                      {q.months.map((m) => (
                        <tr key={m.key} className={selectedKey === m.key ? "bg-cyan-500/5" : ""}>
                          <td className="px-4 py-2 pl-8 text-slate-400">{m.label}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-slate-400">{m.count}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{m.count > 0 ? formatEurCents(m.totalCents) : "—"}</td>
                          <td className="px-4 py-2 text-right">
                            {m.count > 0 && (
                              <Link
                                href={href({}, { mes: m.key, periodo: undefined })}
                                className="text-xs font-semibold text-cyan-300 hover:text-cyan-200"
                              >
                                Ver
                              </Link>
                            )}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Detalle del periodo seleccionado */}
            {parsed && (
              <div className="mt-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                    Detalle · {formatPeriodLabel(parsed)}
                    <span className="ml-2 font-normal text-slate-500">
                      ({detailRows.length} · {formatEurCents(detailTotal)})
                    </span>
                  </h2>
                  <Link href={href({}, { periodo: undefined, mes: undefined })} className="text-xs text-slate-400 underline hover:text-slate-200">
                    × Quitar filtro
                  </Link>
                </div>
                {detailRows.length === 0 ? (
                  <p className="mt-2 text-slate-500">Sin registros en este periodo.</p>
                ) : (
                  <div className="mt-2 overflow-x-auto rounded-xl border border-slate-700">
                    <table className="w-full text-sm text-slate-200">
                      <thead className="bg-slate-800/60 text-left text-xs uppercase tracking-wide text-slate-400">
                        <tr>
                          {dataset.columns.map((c, idx) => (
                            <th key={idx} className={`px-4 py-2 ${c.align === "right" ? "text-right" : ""}`}>
                              {c.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {detailRows.map((r, ri) => (
                          <tr key={ri}>
                            {r.cells.map((cell, ci) => (
                              <td key={ci} className={`px-4 py-3 ${dataset.columns[ci]?.align === "right" ? "text-right" : ""}`}>
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
