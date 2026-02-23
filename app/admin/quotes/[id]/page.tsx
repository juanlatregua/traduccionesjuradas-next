import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import AdminQuoteDetailPanel from "@/components/AdminQuoteDetailPanel";
import { requireAdminPageAccess } from "@/lib/admin-page-access";
import { getQuoteByIdForAdmin } from "@/lib/quote-db";
import { serializeQuote } from "@/lib/quote-serializer";

export const metadata: Metadata = {
  title: "Admin · Detalle presupuesto",
  robots: {
    index: false,
    follow: false,
  },
};

type Props = {
  params: {
    id: string;
  };
};

export default async function AdminQuoteDetailPage({ params }: Props) {
  await requireAdminPageAccess(`/admin/quotes/${params.id}`);

  const quote = await getQuoteByIdForAdmin(params.id);
  if (!quote) notFound();

  const serialized = serializeQuote(quote);
  if (!serialized) notFound();

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-4">
        <Link href="/admin/quotes" className="text-sm font-semibold text-emerald-700 hover:underline">
          ← Volver a presupuestos
        </Link>
      </div>
      <AdminQuoteDetailPanel initialQuote={serialized as any} />
    </main>
  );
}
