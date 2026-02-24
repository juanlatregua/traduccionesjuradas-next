import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ReviewActions from "@/components/funnel/ReviewActions";
import { getSessionOrRedirect } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Revisión del encargo | Traducción jurada",
  robots: { index: false, follow: false },
};

function money(cents: number, currency = "EUR") {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format((cents || 0) / 100);
}

export default async function ReviewPage() {
  const session = await getSessionOrRedirect("REVIEW");
  if (session.docs.length < 1) {
    await prisma.orderSession.update({
      where: { id: session.id },
      data: { step: "UPLOAD" },
    });
    redirect("/upload?reason=missing_doc");
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <h2 className="text-lg font-semibold text-slate-900">Paso 3. Revisión del pedido</h2>
      <p className="mt-2 text-sm text-slate-700">
        Revisa los documentos cargados y confirma para continuar al checkout.
      </p>

      <div className="mt-4 space-y-2">
        {session.docs.map((doc) => (
          <article key={doc.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-sm font-semibold text-slate-900">{doc.filename}</p>
            <p className="text-xs text-slate-600">
              {(doc.sizeBytes / 1024).toFixed(1)} KB · {doc.mimeType}
            </p>
            <a
              href={doc.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-emerald-700 hover:underline"
            >
              Ver documento
            </a>
          </article>
        ))}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Subtotal</p>
          <p className="text-sm font-semibold text-slate-900">{money(session.subtotalCents, session.currency)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">IVA</p>
          <p className="text-sm font-semibold text-slate-900">{money(session.vatCents, session.currency)}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Total</p>
          <p className="text-sm font-semibold text-emerald-900">{money(session.totalCents, session.currency)}</p>
        </div>
      </div>

      <ReviewActions canProceed={session.docs.length > 0} />
    </section>
  );
}
