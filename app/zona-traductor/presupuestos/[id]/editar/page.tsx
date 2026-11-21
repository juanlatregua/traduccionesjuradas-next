import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import QuoteEditForm from "@/components/QuoteEditForm";
import { authZonaTraductorOrRedirect } from "@/lib/zona-traductor-data";
import { getQuoteByIdForAdmin } from "@/lib/quote-db";
import { serializeQuote } from "@/lib/quote-serializer";
import { presupuestoPaginaUnicaOn } from "@/lib/quote-edit-hydrate";

export const metadata: Metadata = {
  title: "Zona traductor — Editar presupuesto",
  robots: { index: false, follow: false },
};

/** S1: editar el presupuesto sin salir de la cáscara oscura. Ver la ficha. */
export default async function PresupuestoEditarPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { nuevaLinea?: string };
}) {
  await authZonaTraductorOrRedirect();
  if (presupuestoPaginaUnicaOn()) {
    redirect(`/zona-traductor/presupuestos/${params.id}${searchParams.nuevaLinea === "1" ? "?nuevaLinea=1" : ""}#editar`);
  }

  const quote = await getQuoteByIdForAdmin(params.id);
  if (!quote) notFound();
  const serialized = serializeQuote(quote);
  if (!serialized) notFound();
  const numero = (serialized as any).quoteNumber || "";
  const frozen = !!quote.paymentFrozenAt;

  return (
    <div className="min-h-screen bg-[#F6F7F9]">
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-5 flex items-center gap-3">
          <Link
            href={`/zona-traductor/presupuestos/${params.id}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1F2933] hover:text-[#1A2E4A]"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al presupuesto
          </Link>
          <span className="text-[#52606D]">·</span>
          <h1 className="font-mono text-sm font-bold text-[#1A2E4A]">{numero}</h1>
        </div>
        <div className="rounded-[14px] border border-[#D5DAE1] bg-white p-4">
          <QuoteEditForm quote={serialized as any} nuevaLinea={searchParams.nuevaLinea === "1"} frozen={frozen} />
        </div>
      </main>
    </div>
  );
}
