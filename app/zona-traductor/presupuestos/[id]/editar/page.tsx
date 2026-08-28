import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import QuoteEditForm from "@/components/QuoteEditForm";
import ZonaTraductorSubNav from "@/components/ZonaTraductorSubNav";
import { authZonaTraductorOrRedirect, countExpedientesPendientes } from "@/lib/zona-traductor-data";
import { getQuoteByIdForAdmin } from "@/lib/quote-db";
import { serializeQuote } from "@/lib/quote-serializer";

export const metadata: Metadata = {
  title: "Zona traductor — Editar presupuesto",
  robots: { index: false, follow: false },
};

/** S1: editar el presupuesto sin salir de la cáscara oscura. Ver la ficha. */
export default async function PresupuestoEditarPage({ params }: { params: { id: string } }) {
  await authZonaTraductorOrRedirect();
  const expedientesPendientes = await countExpedientesPendientes();

  const quote = await getQuoteByIdForAdmin(params.id);
  if (!quote) notFound();
  const serialized = serializeQuote(quote);
  if (!serialized) notFound();
  const numero = (serialized as any).quoteNumber || "";

  return (
    <div className="min-h-screen bg-slate-950">
      <main className="mx-auto max-w-3xl px-4 py-8">
        <ZonaTraductorSubNav
          tabs={[
            { href: "/zona-traductor/presupuestos", label: "Carpeta" },
            { href: "/zona-traductor/expedientes", label: "Expedientes", badge: expedientesPendientes },
          ]}
        />
        <div className="mb-5 flex items-center gap-3">
          <Link
            href={`/zona-traductor/presupuestos/${params.id}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-300 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al presupuesto
          </Link>
          <span className="text-slate-600">·</span>
          <h1 className="font-mono text-sm font-bold text-cyan-300">{numero}</h1>
        </div>
        <div className="rounded-2xl bg-cream p-4 shadow-xl">
          <QuoteEditForm quote={serialized as any} />
        </div>
      </main>
    </div>
  );
}
