import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import QuoteEditForm from "@/components/QuoteEditForm";
import { requireAdminPageAccess } from "@/lib/admin-page-access";
import { getQuoteByIdForAdmin } from "@/lib/quote-db";
import { serializeQuote } from "@/lib/quote-serializer";

export const metadata: Metadata = {
  title: "Admin · Editar presupuesto",
  robots: { index: false, follow: false },
};

export default async function EditQuotePage({ params }: { params: { id: string } }) {
  await requireAdminPageAccess(`/admin/quotes/${params.id}/editar`);

  const quote = await getQuoteByIdForAdmin(params.id);
  if (!quote) notFound();
  const serialized = serializeQuote(quote);
  if (!serialized) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href={`/admin/quotes/${params.id}`} className="text-sm font-semibold text-emerald-700 hover:underline">
        ← Volver al presupuesto
      </Link>
      <h1 className="mt-3 text-2xl font-semibold text-slate-900">
        Editar presupuesto {(serialized as any).quoteNumber || ""}
      </h1>
      <QuoteEditForm quote={serialized as any} />
    </main>
  );
}
