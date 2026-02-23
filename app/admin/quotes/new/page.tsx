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

export default async function AdminQuoteNewPage() {
  await requireAdminPageAccess("/admin/quotes/new");

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <AdminQuoteCreateForm />
    </main>
  );
}
