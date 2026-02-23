import type { Metadata } from "next";
import AdminQuoteCreateForm from "@/components/AdminQuoteCreateForm";
import { requireAdminPageAccess } from "@/lib/admin-page-access";

export const metadata: Metadata = {
  title: "Admin · Nuevo presupuesto",
  robots: {
    index: false,
    follow: false,
  },
};

type Props = {
  searchParams?: {
    customerEmail?: string;
    customerName?: string;
    customerPhone?: string;
    sourceLang?: string;
    targetLang?: string;
    langPair?: string;
    lineDescription?: string;
    lineAmount?: string;
    deliveryType?: string;
  };
};

function sanitize(raw?: string | null) {
  return String(raw || "").trim();
}

function parseLangPair(raw?: string | null) {
  const value = sanitize(raw).toLowerCase();
  const [source, target] = value.split("-");
  if (source && target) {
    return { sourceLang: source, targetLang: target };
  }
  return { sourceLang: "", targetLang: "" };
}

export default async function AdminQuoteNewPage({ searchParams }: Props) {
  await requireAdminPageAccess("/admin/quotes/new");

  const pair = parseLangPair(searchParams?.langPair);
  const initialData = {
    customerEmail: sanitize(searchParams?.customerEmail),
    customerName: sanitize(searchParams?.customerName),
    customerPhone: sanitize(searchParams?.customerPhone),
    sourceLang: sanitize(searchParams?.sourceLang) || pair.sourceLang || "fr",
    targetLang: sanitize(searchParams?.targetLang) || pair.targetLang || "es",
    lineDescription: sanitize(searchParams?.lineDescription),
    lineAmount: sanitize(searchParams?.lineAmount),
    deliveryType:
      sanitize(searchParams?.deliveryType).toUpperCase() === "PAPER_SHIP" ? "PAPER_SHIP" : "DIGITAL_PDF",
  } as const;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <AdminQuoteCreateForm initialData={initialData} />
    </main>
  );
}
