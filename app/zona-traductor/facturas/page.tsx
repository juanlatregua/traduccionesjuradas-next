import type { Metadata } from "next";
import { authZonaTraductorOrRedirect } from "@/lib/zona-traductor-data";
import { prisma } from "@/lib/prisma";
import InvoiceManager, { type InvoiceRow } from "@/components/InvoiceManager";
import { suggestNextInvoiceNumber } from "@/lib/client-invoice";

export const metadata: Metadata = {
  title: "Zona traductor — Facturas",
  robots: { index: false, follow: false },
};

function eur(cents: number) {
  return `${(cents / 100).toFixed(2)} €`;
}

type Line = { description: string; detail?: string; amountCents: number };

export default async function ZonaTraductorFacturasPage() {
  await authZonaTraductorOrRedirect();

  const raw = await prisma.clientInvoice.findMany({
    orderBy: { createdAt: "desc" },
    include: { order: { select: { reference: true } } },
    take: 500,
  });

  const invoices: InvoiceRow[] = raw.map((i) => ({
    id: i.id,
    number: i.number,
    status: i.status,
    brand: i.brand,
    orderReference: i.order?.reference ?? null,
    clientName: i.clientName,
    poNumber: i.poNumber,
    fiscalName: i.fiscalName,
    nif: i.nif,
    address: i.address,
    city: i.city,
    postalCode: i.postalCode,
    country: i.country,
    email: i.email,
    concept: i.concept,
    langPair: i.langPair,
    lines: Array.isArray(i.lineItemsJson) ? (i.lineItemsJson as unknown as Line[]) : [],
    vatRate: i.vatRate,
    baseCents: i.baseCents,
    vatCents: i.vatCents,
    totalCents: i.totalCents,
    issuedAt: i.issuedAt ? i.issuedAt.toISOString() : null,
    createdAt: i.createdAt.toISOString(),
  }));

  const issued = raw.filter((i) => i.status === "ISSUED");
  const facturado = issued.reduce((s, i) => s + i.totalCents, 0);
  const suggested = await suggestNextInvoiceNumber();

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">Facturas</h1>
            <p className="mt-1 text-sm text-slate-400">
              {issued.length} emitida{issued.length === 1 ? "" : "s"} · {eur(facturado)} facturado. Próximo nº sugerido:{" "}
              <span className="font-mono text-cyan-300">{suggested}</span>
            </p>
          </div>
          <a
            href="/zona-traductor/contabilidad"
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
          >
            Ir a Contabilidad →
          </a>
        </div>

        <div className="mt-6">
          <InvoiceManager invoices={invoices} suggested={suggested} />
        </div>
      </div>
    </div>
  );
}
