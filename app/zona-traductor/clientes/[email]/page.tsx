import type { Metadata } from "next";
import { authZonaTraductorOrRedirect } from "@/lib/zona-traductor-data";
import { prisma } from "@/lib/prisma";
import { getWorkflowState, getWorkflowStateLabel } from "@/lib/workflow";

export const metadata: Metadata = {
  title: "Cliente — Zona traductor",
  robots: { index: false, follow: false },
};

function eur(c: number) {
  return `${(c / 100).toFixed(2)} €`;
}

type DocRef = { name: string; url: string };

function getSourceDocs(events: any[]): DocRef[] {
  const out: DocRef[] = [];
  for (const e of events) {
    const p = (e.payload as any) || {};
    if (e.type === "presupuesto.submitted" && Array.isArray(p.files)) {
      for (const f of p.files) if (f?.url) out.push({ name: String(f.name || "Documento"), url: String(f.url) });
    }
    if (e.type === "order.source_document_uploaded" && p.fileUrl) {
      out.push({ name: String(p.fileName || "Documento"), url: String(p.fileUrl) });
    }
  }
  const seen = new Set<string>();
  return out.filter((d) => (seen.has(d.url) ? false : (seen.add(d.url), true)));
}

function getDelivered(o: any): DocRef[] {
  const raw = Array.isArray(o.deliveryFilesJson) ? o.deliveryFilesJson : [];
  const list: DocRef[] = raw
    .filter((f: any) => f?.url)
    .map((f: any, i: number) => ({ name: String(f.filename || `Traducción ${i + 1}`), url: String(f.url) }));
  if (!list.length && (o.finalDeliveryFileUrl || o.translatedFileUrl)) {
    list.push({ name: o.finalFilename || "Traducción jurada", url: String(o.finalDeliveryFileUrl || o.translatedFileUrl) });
  }
  return list;
}

export default async function ClienteFolderPage({ params }: { params: { email: string } }) {
  await authZonaTraductorOrRedirect();
  const email = decodeURIComponent(params.email);

  const [customer, orders] = await Promise.all([
    prisma.customer.findUnique({ where: { email } }),
    prisma.order.findMany({
      where: { clientEmail: email },
      orderBy: { createdAt: "desc" },
      include: {
        events: { select: { type: true, payload: true, createdAt: true }, orderBy: { createdAt: "desc" } },
        clientInvoice: { select: { number: true, totalCents: true, status: true } },
        quote: { select: { quoteNumber: true } },
      },
    }),
  ]);

  const name = customer?.name || orders.find((o) => o.clientName)?.clientName || email;
  const totalPaid = orders.filter((o) => o.paymentStatus === "PAID").reduce((s, o) => s + o.amountCents, 0);
  const card = "rounded-2xl border border-slate-700 bg-slate-900/60 p-5";

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-8 sm:px-6">
        <div>
          <a href="/zona-traductor/clientes" className="text-xs font-semibold text-cyan-400 hover:underline">
            ← Clientes
          </a>
          <h1 className="mt-1 text-2xl font-semibold text-white">{name}</h1>
          <p className="text-sm text-slate-400">
            {email} · {orders.length} pedido(s) · {eur(totalPaid)} cobrado
          </p>
        </div>

        {customer && (customer.nif || customer.fiscalName || customer.address || customer.companyName) && (
          <div className={card}>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Datos fiscales</h2>
            <div className="mt-2 grid gap-1 text-sm text-slate-300 sm:grid-cols-2">
              {customer.fiscalName && <p>Nombre fiscal: <span className="text-slate-100">{customer.fiscalName}</span></p>}
              {customer.nif && <p>NIF: <span className="text-slate-100">{customer.nif}</span></p>}
              {customer.companyName && <p>Empresa: <span className="text-slate-100">{customer.companyName}</span></p>}
              {(customer.address || customer.city) && (
                <p>Dirección: <span className="text-slate-100">{[customer.address, customer.postalCode, customer.city].filter(Boolean).join(", ")}</span></p>
              )}
              {customer.isBusiness && (
                <p className="text-cyan-300">Cliente B2B{customer.autoConfirmPayment ? " · pago auto-confirmado" : ""}</p>
              )}
            </div>
          </div>
        )}

        <div className={card}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Pedidos · documentos · traducciones · facturas · presupuestos
          </h2>
          {orders.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">Sin pedidos.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {orders.map((o) => {
                const docs = getSourceDocs(o.events);
                const delivered = getDelivered(o);
                const state = getWorkflowState(o as any);
                return (
                  <div key={o.reference} className="rounded-xl border border-slate-700 bg-slate-800/30 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <a href={`/zona-traductor/pedido/${o.reference}`} className="font-mono text-sm font-semibold text-cyan-400 hover:underline">
                          {o.reference}
                        </a>
                        <span className="ml-2 text-xs text-slate-400">
                          {o.langPair || ""} · {eur(o.amountCents)} · {getWorkflowStateLabel(state)}
                        </span>
                      </div>
                      <a href={`/zona-traductor/pedido/${o.reference}`} className="rounded-lg border border-slate-600 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-800">
                        Abrir pedido →
                      </a>
                    </div>
                    <div className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
                      <div>
                        <p className="font-semibold text-slate-400">Originales</p>
                        {docs.length ? (
                          docs.map((d, i) => (
                            <a key={i} href={d.url} target="_blank" rel="noopener noreferrer" className="block truncate text-cyan-300 hover:underline" title={d.name}>
                              📄 {d.name}
                            </a>
                          ))
                        ) : (
                          <p className="text-slate-600">—</p>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-400">Traducciones</p>
                        {delivered.length ? (
                          delivered.map((d, i) => (
                            <a key={i} href={d.url} target="_blank" rel="noopener noreferrer" className="block truncate text-emerald-300 hover:underline" title={d.name}>
                              ✓ {d.name}
                            </a>
                          ))
                        ) : (
                          <p className="text-slate-600">—</p>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-400">Factura / presupuesto</p>
                        {o.clientInvoice?.status === "ISSUED" ? (
                          <a href={`/api/orders/${o.reference}/invoice-pdf`} className="block text-emerald-300 hover:underline">
                            🧾 {o.clientInvoice.number} (PDF)
                          </a>
                        ) : (
                          <p className="text-slate-600">sin factura</p>
                        )}
                        {o.quote && (
                          <a href="/admin/quotes" className="block text-slate-300 hover:underline">
                            Presupuesto {o.quote.quoteNumber}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
