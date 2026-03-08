import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdminPageAccess } from "@/lib/admin-page-access";
import { AdminNav } from "@/components/AdminNav";
import { decimalToNumber, QUOTE_STATUS_LABELS, type QuoteStatus } from "@/lib/quotes";

export const metadata: Metadata = {
  title: "Admin · Presupuestos",
  robots: {
    index: false,
    follow: false,
  },
};

function formatMoney(value: number) {
  return `${value.toFixed(2)} EUR`;
}

export default async function AdminQuotesListPage() {
  await requireAdminPageAccess("/admin/quotes");

  const quotes = await prisma.quote.findMany({
    orderBy: { createdAt: "desc" },
    take: 120,
    include: {
      lines: { orderBy: { createdAt: "asc" }, take: 2 },
    },
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <AdminNav />
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Backoffice</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Presupuestos</h1>
          </div>
          <Link
            href="/admin/quotes/new"
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Nuevo presupuesto
          </Link>
        </div>

        {quotes.length === 0 ? (
          <p className="mt-6 text-sm text-slate-600">Aún no hay presupuestos.</p>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-4 py-3">Nº</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Idiomas</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Validez</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((quote) => (
                  <tr key={quote.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-mono text-xs text-emerald-700">{quote.quoteNumber}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{quote.customerName}</p>
                      <p className="text-xs text-slate-500">{quote.customerEmail}</p>
                    </td>
                    <td className="px-4 py-3">
                      {quote.sourceLang} → {quote.targetLang}
                    </td>
                    <td className="px-4 py-3">
                      {QUOTE_STATUS_LABELS[(quote.status as QuoteStatus) || "DRAFT"]}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {formatMoney(decimalToNumber(quote.total))}
                    </td>
                    <td className="px-4 py-3">{quote.validUntil.toLocaleDateString("es-ES")}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/quotes/${quote.id}`}
                        className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
