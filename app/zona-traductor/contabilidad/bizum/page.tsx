import type { Metadata } from "next";
import Link from "next/link";
import ContabilidadSubNav from "@/components/ContabilidadSubNav";
import ExcludedOrdersPanel from "@/components/ExcludedOrdersPanel";
import { authZonaTraductorOrRedirect } from "@/lib/zona-traductor-data";
import { listBizumLedger } from "@/lib/bizum-ledger";

export const metadata: Metadata = {
  title: "Zona traductor — Bizum (fuera de contabilidad)",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const eur = (c: number) => `${(c / 100).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-ES") : "—");
const DELIVERY: Record<string, string> = {
  PRESUPUESTO: "sin empezar",
  EN_PROCESO: "en proceso",
  TRADUCIDO: "traducido",
  ENTREGADO: "entregado",
};

export default async function BizumPage() {
  await authZonaTraductorOrRedirect();
  const ledger = await listBizumLedger();
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisQ = Math.ceil((now.getMonth() + 1) / 3);
  const current = ledger.groups.find((g) => g.year === thisYear && g.quarter === thisQ);

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <ContabilidadSubNav />
        <h1 className="text-2xl font-semibold text-white">Bizum · fuera de contabilidad</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Cobros por Bizum: no llevan factura y no entran en el libro, el 303, la conciliación bancaria ni los periodos
          (regla 21-ago-2026). Aquí queda su relación completa con los pedidos, por trimestre, para que no se pierda nada.
          Un pedido Bizum con factura ya emitida se queda en contabilidad y aquí solo se señala.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Total cobrado por Bizum</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{eur(ledger.totalCents)}</p>
            <p className="text-xs text-slate-500">{ledger.count} pedido{ledger.count === 1 ? "" : "s"}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Este trimestre · {thisYear} T{thisQ}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{eur(current?.totalCents ?? 0)}</p>
            <p className="text-xs text-slate-500">{current?.rows.filter((r) => r.paymentStatus === "PAID").length ?? 0} pedidos</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Por año</p>
            <ul className="mt-1 space-y-0.5 text-sm text-slate-200">
              {ledger.byYear.map((y) => (
                <li key={y.year} className="flex justify-between tabular-nums">
                  <span>{y.year}</span>
                  <span>
                    {eur(y.totalCents)} <span className="text-slate-500">· {y.count}</span>
                  </span>
                </li>
              ))}
              {ledger.byYear.length === 0 && <li className="text-slate-500">—</li>}
            </ul>
          </div>
        </div>

        {ledger.groups.length === 0 ? (
          <p className="mt-8 text-sm text-slate-400">Todavía no hay cobros por Bizum.</p>
        ) : (
          ledger.groups.map((g) => (
            <section key={g.label} className="mt-8">
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-lg font-semibold text-white">{g.label}</h2>
                <span className="text-sm tabular-nums text-slate-300">
                  {g.rows.filter((r) => r.paymentStatus === "PAID").length} pedidos · <strong className="text-white">{eur(g.totalCents)}</strong>
                </span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-sm text-slate-200">
                  <thead className="bg-slate-900/80 text-left text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Cobro</th>
                      <th className="px-3 py-2">Pedido</th>
                      <th className="px-3 py-2">Cliente</th>
                      <th className="px-3 py-2">Presupuesto</th>
                      <th className="px-3 py-2">Entrega</th>
                      <th className="px-3 py-2 text-right">Importe</th>
                      <th className="px-3 py-2">Situación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {g.rows.map((r) => (
                      <tr key={r.reference} className={r.paymentStatus === "REFUNDED" ? "opacity-60" : ""}>
                        <td className="px-3 py-2 tabular-nums">{fecha(r.paidAt)}</td>
                        <td className="px-3 py-2">
                          <Link href={`/zona-traductor/pedido/${r.reference}`} className="font-mono text-cyan-400 hover:text-cyan-300">
                            {r.reference}
                          </Link>
                          {r.langPair ? <span className="ml-2 text-xs text-slate-500">{r.langPair}</span> : null}
                        </td>
                        <td className="px-3 py-2">
                          <div>{r.clientName || r.clientEmail}</div>
                          {r.clientName ? <div className="text-xs text-slate-500">{r.clientEmail}</div> : null}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-300">{r.quoteNumber || "—"}</td>
                        <td className="px-3 py-2 text-xs">{DELIVERY[r.deliveryState] || r.deliveryState.toLowerCase()}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {r.paymentStatus === "REFUNDED" ? <span className="text-rose-300">devuelto</span> : eur(r.amountCents)}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {r.invoiceNumber ? (
                            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-200">factura {r.invoiceNumber} · en contabilidad</span>
                          ) : (
                            <span className="rounded bg-slate-500/20 px-1.5 py-0.5 text-slate-300">fuera de contabilidad{r.excludedReason && !/bizum/i.test(r.excludedReason) ? ` · ${r.excludedReason}` : ""}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))
        )}

        {ledger.otherExcluded.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-semibold text-white">Otros pedidos apartados (no Bizum)</h2>
            <p className="mt-1 text-sm text-slate-400">Apartados a mano de la contabilidad con su motivo. Reversibles.</p>
            <ExcludedOrdersPanel
              rows={ledger.otherExcluded.map((r) => ({
                reference: r.reference,
                clientName: r.clientName,
                clientEmail: r.clientEmail,
                amountCents: r.amountCents,
                paidAt: r.paidAt,
                reason: r.excludedReason,
              }))}
            />
          </section>
        )}
      </div>
    </div>
  );
}
