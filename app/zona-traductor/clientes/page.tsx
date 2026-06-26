import type { Metadata } from "next";
import { authZonaTraductorOrRedirect } from "@/lib/zona-traductor-data";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Zona traductor — Clientes",
  robots: { index: false, follow: false },
};

function eur(c: number) {
  return `${(c / 100).toFixed(2)} €`;
}

export default async function ClientesPage() {
  await authZonaTraductorOrRedirect();

  // Cliente = email (los pedidos enlazan por clientEmail). Agregamos en memoria.
  const orders = await prisma.order.findMany({
    select: { clientEmail: true, clientName: true, amountCents: true, paymentStatus: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  type Agg = { email: string; name: string; count: number; paidCents: number; last: Date };
  const map = new Map<string, Agg>();
  for (const o of orders) {
    const cur = map.get(o.clientEmail);
    if (cur) {
      cur.count++;
      if (o.paymentStatus === "PAID") cur.paidCents += o.amountCents;
      if (!cur.name && o.clientName) cur.name = o.clientName;
    } else {
      map.set(o.clientEmail, {
        email: o.clientEmail,
        name: o.clientName || "",
        count: 1,
        paidCents: o.paymentStatus === "PAID" ? o.amountCents : 0,
        last: o.createdAt,
      });
    }
  }
  const clients = Array.from(map.values()).sort((a, b) => b.last.getTime() - a.last.getTime());

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold text-white">Clientes</h1>
        <p className="mt-1 text-sm text-slate-400">
          {clients.length} clientes. Abre uno para ver su carpeta: documentos, traducciones, presupuestos y facturas.
        </p>
        <div className="mt-5 overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm text-slate-200">
            <thead className="bg-slate-800/60 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-2">Cliente</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2 text-right">Pedidos</th>
                <th className="px-4 py-2 text-right">Cobrado</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {clients.map((c) => (
                <tr key={c.email} className="hover:bg-slate-900/40">
                  <td className="px-4 py-2 font-medium text-white">{c.name || "—"}</td>
                  <td className="px-4 py-2 text-slate-400">{c.email}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{c.count}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{eur(c.paidCents)}</td>
                  <td className="px-4 py-2 text-right">
                    <a
                      href={`/zona-traductor/clientes/${encodeURIComponent(c.email)}`}
                      className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500"
                    >
                      Abrir carpeta →
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
