import type { Metadata } from "next";
import { authZonaTraductorOrRedirect, loadBandejaState } from "@/lib/zona-traductor-data";
import { prisma } from "@/lib/prisma";
import ZonaTraductorNav from "@/components/ZonaTraductorNav";
import InvoiceIssuePanel from "@/components/InvoiceIssuePanel";
import { suggestNextInvoiceNumber } from "@/lib/client-invoice";

export const metadata: Metadata = {
  title: "Zona traductor — Facturas emitidas",
  robots: { index: false, follow: false },
};

function eur(cents: number) {
  return `${(cents / 100).toFixed(2)} €`;
}

export default async function ZonaTraductorFacturasPage({
  searchParams,
}: {
  searchParams: { year?: string };
}) {
  await authZonaTraductorOrRedirect();
  const bandeja = await loadBandejaState().catch(() => null);
  const accionables = bandeja?.pedidosAccionables ?? 0;

  const year = searchParams.year && /^\d{4}$/.test(searchParams.year) ? searchParams.year : null;
  const where = year ? { number: { startsWith: `FAC-${year}-` } } : undefined;

  const invoices = await prisma.clientInvoice.findMany({
    where,
    orderBy: { number: "desc" },
    include: { order: { select: { reference: true } } },
    take: 500,
  });

  const totals = invoices.reduce(
    (acc, i) => ({
      base: acc.base + i.baseCents,
      vat: acc.vat + i.vatCents,
      total: acc.total + i.totalCents,
    }),
    { base: 0, vat: 0, total: 0 }
  );

  const exportHref = `/api/admin/invoices/export${year ? `?year=${year}` : ""}`;
  const suggested = await suggestNextInvoiceNumber();

  return (
    <div className="min-h-screen bg-slate-950">
      <ZonaTraductorNav modoActivo="facturas" pedidosAccionables={accionables} />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">Facturas emitidas</h1>
            <p className="mt-1 text-sm text-slate-400">
              Facturas al cliente con numeración fiscal secuencial{year ? ` · ${year}` : ""}.
            </p>
          </div>
          <a
            href={exportHref}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500"
          >
            Descargar CSV (gestoría)
          </a>
        </div>

        <div className="mt-6">
          <InvoiceIssuePanel suggested={suggested} />
        </div>

        {invoices.length === 0 ? (
          <p className="mt-10 text-slate-500">No hay facturas emitidas todavía.</p>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-sm text-slate-200">
              <thead className="bg-slate-800/60 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-2">Número</th>
                  <th className="px-4 py-2">Fecha</th>
                  <th className="px-4 py-2">Pedido</th>
                  <th className="px-4 py-2">Cliente</th>
                  <th className="px-4 py-2">NIF</th>
                  <th className="px-4 py-2 text-right">Base</th>
                  <th className="px-4 py-2 text-right">IVA</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-4 py-3 font-mono text-cyan-300">{inv.number}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {inv.issuedAt.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-300">{inv.order?.reference || "—"}</td>
                    <td className="px-4 py-3">{inv.fiscalName}</td>
                    <td className="px-4 py-3 text-slate-400">{inv.nif}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{eur(inv.baseCents)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{eur(inv.vatCents)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">{eur(inv.totalCents)}</td>
                    <td className="px-4 py-3 text-right">
                      {inv.order?.reference ? (
                        <a
                          href={`/api/orders/${inv.order.reference}/invoice-pdf`}
                          className="rounded-lg border border-slate-600 px-2.5 py-1 text-xs font-semibold text-cyan-300 hover:bg-slate-800"
                        >
                          PDF
                        </a>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-700 bg-slate-800/40 font-semibold text-white">
                <tr>
                  <td className="px-4 py-3" colSpan={5}>
                    Total ({invoices.length} factura{invoices.length === 1 ? "" : "s"})
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{eur(totals.base)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{eur(totals.vat)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{eur(totals.total)}</td>
                  <td className="px-4 py-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
