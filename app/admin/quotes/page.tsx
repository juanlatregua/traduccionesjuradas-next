import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdminPageAccess } from "@/lib/admin-page-access";
import { AdminNav } from "@/components/AdminNav";
import { decimalToNumber, QUOTE_STATUS_LABELS, type QuoteStatus } from "@/lib/quotes";
import QuoteRowActions from "@/components/QuoteRowActions";

export const metadata: Metadata = {
  title: "Admin · Presupuestos",
  robots: { index: false, follow: false },
};

function formatMoney(value: number) {
  return `${value.toFixed(2)} EUR`;
}

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(d: Date) {
  return `${MONTHS_ES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

type Props = { searchParams?: { view?: string; q?: string } };

export default async function AdminQuotesListPage({ searchParams }: Props) {
  await requireAdminPageAccess("/admin/quotes");

  const deleted = searchParams?.view === "deleted";
  const q = (searchParams?.q || "").trim();

  const where: any = { deletedAt: deleted ? { not: null } : null };
  if (q) {
    where.OR = [
      { customerName: { contains: q, mode: "insensitive" } },
      { customerEmail: { contains: q, mode: "insensitive" } },
      { quoteNumber: { contains: q, mode: "insensitive" } },
    ];
  }

  const quotes = await prisma.quote.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { lines: { orderBy: { createdAt: "asc" }, take: 2 } },
  });

  // Agrupar por mes (carpetas).
  const groups: { key: string; label: string; items: typeof quotes }[] = [];
  for (const quote of quotes) {
    const k = monthKey(quote.createdAt);
    let g = groups.find((x) => x.key === k);
    if (!g) {
      g = { key: k, label: monthLabel(quote.createdAt), items: [] };
      groups.push(g);
    }
    g.items.push(quote);
  }

  const tabClass = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm font-semibold ${active ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-50"}`;

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

        {/* Filtros: buscar por cliente + Activos/Eliminados */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <form method="GET" className="flex items-center gap-2">
            {deleted && <input type="hidden" name="view" value="deleted" />}
            <input
              name="q"
              defaultValue={q}
              placeholder="Buscar por cliente, email o nº…"
              className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
            <button type="submit" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700">
              Buscar
            </button>
            {q && (
              <Link href={deleted ? "/admin/quotes?view=deleted" : "/admin/quotes"} className="text-xs text-slate-500 underline">
                Limpiar
              </Link>
            )}
          </form>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/admin/quotes" className={tabClass(!deleted)}>Activos</Link>
            <Link href="/admin/quotes?view=deleted" className={tabClass(deleted)}>Eliminados</Link>
          </div>
        </div>

        {quotes.length === 0 ? (
          <p className="mt-6 text-sm text-slate-600">
            {deleted ? "No hay presupuestos eliminados." : q ? "Sin resultados para la búsqueda." : "Aún no hay presupuestos."}
          </p>
        ) : (
          <div className="mt-6 space-y-8">
            {groups.map((group) => (
              <div key={group.key}>
                <h2 className="mb-2 text-sm font-bold capitalize text-slate-700">
                  {group.label} <span className="font-normal text-slate-400">· {group.items.length}</span>
                </h2>
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 text-slate-600">
                      <tr>
                        <th className="px-4 py-3">Nº</th>
                        <th className="px-4 py-3">Cliente</th>
                        <th className="px-4 py-3">Idiomas</th>
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3 text-right">Total</th>
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((quote) => (
                        <tr key={quote.id} className="border-t border-slate-100">
                          <td className="px-4 py-3 font-mono text-xs text-emerald-700">{quote.quoteNumber}</td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-900">{quote.customerName}</p>
                            <p className="text-xs text-slate-500">{quote.customerEmail}</p>
                          </td>
                          <td className="px-4 py-3">
                            {quote.sourceLang} → {quote.targetLang}
                          </td>
                          <td className="px-4 py-3">{QUOTE_STATUS_LABELS[(quote.status as QuoteStatus) || "DRAFT"]}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {formatMoney(decimalToNumber(quote.total))}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">{quote.createdAt.toLocaleDateString("es-ES")}</td>
                          <td className="px-4 py-3">
                            <QuoteRowActions id={quote.id} status={quote.status} deleted={deleted} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
