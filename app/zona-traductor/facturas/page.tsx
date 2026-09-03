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
    docKind: i.docKind,
    brand: i.brand,
    orderReference: i.order?.reference ?? null,
    clientName: i.clientName,
    holderNames: i.holderNames,
    poNumber: i.poNumber,
    paidAt: i.paidAt ? i.paidAt.toISOString() : null,
    paymentProofUrl: i.paymentProofUrl,
    paymentProofName: i.paymentProofName,
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
    invoiceType: i.invoiceType,
    rectifiesNumber: i.rectifiesNumber,
    annulledAt: i.annulledAt ? i.annulledAt.toISOString() : null,
    issuedAt: i.issuedAt ? i.issuedAt.toISOString() : null,
    createdAt: i.createdAt.toISOString(),
  }));

  const issued = raw.filter((i) => i.status === "ISSUED");
  const facturado = issued.reduce((s, i) => s + i.totalCents, 0);
  const [suggested, suggestedQuote] = await Promise.all([
    suggestNextInvoiceNumber("invoice"),
    suggestNextInvoiceNumber("quote"),
  ]);

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">Facturas</h1>
            <p className="mt-1 text-sm text-slate-400">
              {issued.length} emitida{issued.length === 1 ? "" : "s"} · {eur(facturado)} facturado. Próximo nº sugerido:{" "}
              <span className="font-mono text-cyan-300">{suggested}</span> · presupuestos:{" "}
              <span className="font-mono text-violet-300">{suggestedQuote}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="/zona-traductor/facturas/declaracion-responsable"
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              title="Declaración responsable del sistema de facturación (RD 1007/2023) y estado de la cadena de registros"
            >
              VeriFactu · declaración
            </a>
            <a
              href="/zona-traductor/contabilidad"
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
            >
              Ir a Contabilidad →
            </a>
          </div>
        </div>

        <div className="mt-6">
          <InvoiceManager invoices={invoices} suggested={suggested} suggestedQuote={suggestedQuote} />
        </div>
      </div>
    </div>
  );
}
