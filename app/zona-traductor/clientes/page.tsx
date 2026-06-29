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

  // Cliente = email. Un cliente puede existir solo con presupuesto o factura
  // (p. ej. Auream, B2B), sin pedido todavía → agregamos de las 4 fuentes.
  const [customers, orders, quotes, invoices] = await Promise.all([
    prisma.customer.findMany({
      select: { email: true, name: true, companyName: true, fiscalName: true, isBusiness: true },
      take: 5000,
    }),
    prisma.order.findMany({
      select: { clientEmail: true, clientName: true, amountCents: true, paymentStatus: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5000,
    }),
    prisma.quote.findMany({
      select: { customerEmail: true, customerName: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5000,
    }),
    prisma.clientInvoice.findMany({
      select: { email: true, fiscalName: true, clientName: true, status: true, paidAt: true, totalCents: true, orderId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5000,
    }),
  ]);

  type Agg = {
    email: string;
    name: string;
    isBusiness: boolean;
    orders: number;
    quotes: number;
    invoices: number;
    paidCents: number;
    last: Date;
  };
  const map = new Map<string, Agg>();
  const get = (emailRaw: string): Agg => {
    // Clave normalizada (minúsculas): el mismo cliente con distinta capitalización
    // del email no se parte en varias filas. El detalle cotejará case-insensitive.
    const email = (emailRaw || "").trim().toLowerCase();
    let a = map.get(email);
    if (!a) {
      a = { email, name: "", isBusiness: false, orders: 0, quotes: 0, invoices: 0, paidCents: 0, last: new Date(0) };
      map.set(email, a);
    }
    return a;
  };
  const bump = (a: Agg, d: Date) => {
    if (d.getTime() > a.last.getTime()) a.last = d;
  };

  // Agenda (Customer): asegura que todo cliente B2B/recurrente aparezca.
  for (const c of customers) {
    if (!c.email) continue;
    const a = get(c.email);
    a.name = a.name || c.companyName || c.name || c.fiscalName || "";
    a.isBusiness = a.isBusiness || !!c.isBusiness;
  }
  for (const o of orders) {
    const a = get(o.clientEmail);
    a.orders++;
    if (!a.name && o.clientName) a.name = o.clientName;
    if (o.paymentStatus === "PAID") a.paidCents += o.amountCents;
    bump(a, o.createdAt);
  }
  for (const q of quotes) {
    const a = get(q.customerEmail);
    a.quotes++;
    if (!a.name && q.customerName) a.name = q.customerName;
    bump(a, q.createdAt);
  }
  for (const inv of invoices) {
    if (!inv.email) continue;
    const a = get(inv.email);
    // "Facturas" = facturas sueltas emitidas (las ligadas a pedido se cuentan en Pedidos).
    if (inv.status === "ISSUED" && !inv.orderId) a.invoices++;
    // Cobrado por factura suelta (sin pedido) para no duplicar el ingreso del pedido.
    if (inv.status === "ISSUED" && inv.paidAt && !inv.orderId) a.paidCents += inv.totalCents;
    if (!a.name && (inv.clientName || inv.fiscalName)) a.name = inv.clientName || inv.fiscalName;
    bump(a, inv.createdAt);
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
                <th className="px-4 py-2 text-right">Presup.</th>
                <th className="px-4 py-2 text-right">Facturas</th>
                <th className="px-4 py-2 text-right">Cobrado</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {clients.map((c) => {
                const isWhatsapp = c.email.endsWith("@whatsapp.local");
                return (
                <tr key={c.email} className="hover:bg-slate-900/40">
                  <td className="px-4 py-2 font-medium text-white">
                    {c.name || "—"}
                    {c.isBusiness && (
                      <span className="ml-2 rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-200">B2B</span>
                    )}
                    {isWhatsapp && (
                      <span className="ml-2 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200">WhatsApp</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-400">{isWhatsapp ? "sin email (WhatsApp)" : c.email}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{c.orders}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{c.quotes}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{c.invoices}</td>
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
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
