import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ReviewActions from "@/components/funnel/ReviewActions";
import { getSessionOrRedirect } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PURPOSE_REGULARIZACION_2026 } from "@/lib/session-pricing";

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

  const isRegularizacion2026 = session.purpose === PURPOSE_REGULARIZACION_2026;

  return (
    <section className="rounded-3xl border border-cream bg-card p-5 shadow-sm sm:p-7">
      <h2 className="text-lg font-semibold text-encre">Paso 3. Revisión del pedido</h2>
      <p className="mt-2 text-sm text-sepia">
        Revisa los documentos cargados y confirma para continuar al checkout.
      </p>

      {isRegularizacion2026 && (
        <div className="mt-4 rounded-2xl border border-bleu/30 bg-bleu/5 p-4 text-sm text-encre">
          <p className="font-semibold text-bleu">
            Tarifa especial regularización 2026 · 25 € / documento
          </p>
          <p className="mt-1 text-sepia">
            Aplicada automáticamente. Plazo del expediente: hasta el 30 de junio
            de 2026 (RD 316/2026). Entrega de la traducción jurada en PDF
            firmado digitalmente, 24h. Pago con Bizum, tarjeta, PayPal o
            transferencia.
          </p>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {session.docs.map((doc) => (
          <article key={doc.id} className="rounded-xl border border-cream bg-parchment px-3 py-2">
            <p className="text-sm font-semibold text-encre">{doc.filename}</p>
            <p className="text-xs text-sepia">
              {(doc.sizeBytes / 1024).toFixed(1)} KB · {doc.mimeType}
            </p>
            <a
              href={doc.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-bleu hover:underline"
            >
              Ver documento
            </a>
          </article>
        ))}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-cream bg-parchment p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-graphite">Subtotal</p>
          <p className="text-sm font-semibold text-encre">{money(session.subtotalCents, session.currency)}</p>
        </div>
        <div className="rounded-xl border border-cream bg-parchment p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-graphite">IVA</p>
          <p className="text-sm font-semibold text-encre">{money(session.vatCents, session.currency)}</p>
        </div>
        <div className="rounded-xl border border-cream bg-cream p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-bleu">Total</p>
          <p className="text-sm font-semibold text-bleu">{money(session.totalCents, session.currency)}</p>
        </div>
      </div>

      <ReviewActions canProceed={session.docs.length > 0} />
    </section>
  );
}
