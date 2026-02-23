import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  decimalToNumber,
  hashValue,
  isQuotePayableStatus,
  normalizeQuoteStatus,
  QUOTE_STATUS_LABELS,
  type QuoteStatus,
} from "@/lib/quotes";
import QuotePublicPayButton from "@/components/QuotePublicPayButton";
import { checkRateLimit } from "@/lib/rate-limit";

type Props = {
  params: { token: string };
  searchParams: {
    paid?: string;
    canceled?: string;
  };
};

export const metadata: Metadata = {
  title: "Presupuesto",
  robots: {
    index: false,
    follow: false,
  },
};

function formatMoney(value: number) {
  return `${value.toFixed(2)} EUR`;
}

function resolveIp() {
  const h = headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") || "unknown";
}

async function trackOpen(quote: { id: string; status: string }) {
  const ip = resolveIp();
  const ua = headers().get("user-agent") || null;
  const salt = process.env.NEXTAUTH_SECRET || "quote-open";
  const ipHash = hashValue(`${ip}:${salt}`);
  const now = new Date();

  await prisma.accessEvent.create({
    data: {
      quoteId: quote.id,
      type: "OPENED",
      at: now,
      userAgent: ua,
      ipHash,
    },
  });

  if (quote.status === "SENT") {
    await prisma.quote.update({
      where: { id: quote.id },
      data: {
        status: "OPENED",
        openedAt: now,
      },
    });
  }
}

export default async function PublicQuotePage({ params, searchParams }: Props) {
  const ip = resolveIp();
  const rl = checkRateLimit({
    key: `quote-public:${params.token}:${ip}`,
    limit: 90,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <section className="mx-auto max-w-2xl rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          Has superado el límite de consultas para este enlace. Espera unos minutos e inténtalo de nuevo.
        </section>
      </main>
    );
  }

  const quote = await prisma.quote.findUnique({
    where: { publicToken: params.token },
    include: {
      lines: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!quote) {
    notFound();
  }

  if (quote.tokenExpiresAt && quote.tokenExpiresAt < new Date()) {
    await prisma.quote.update({
      where: { id: quote.id },
      data: { status: "EXPIRED" },
    });
  }

  await trackOpen({
    id: quote.id,
    status: quote.status,
  }).catch((err) => console.error("[q/token] open tracking failed", err));

  const refreshed = await prisma.quote.findUnique({
    where: { id: quote.id },
    include: {
      lines: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!refreshed) notFound();

  const status = normalizeQuoteStatus(refreshed.status);
  const isPayable = isQuotePayableStatus(status);
  const subtotal = decimalToNumber(refreshed.subtotal);
  const discountAmount = decimalToNumber(refreshed.discountAmount);
  const shippingAmount = decimalToNumber(refreshed.shippingAmount);
  const vatAmount = decimalToNumber(refreshed.vatAmount);
  const total = decimalToNumber(refreshed.total);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <section className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Presupuesto {refreshed.quoteNumber}
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Traducción jurada</h1>
        <p className="mt-1 text-sm text-slate-600">
          Estado: <strong>{QUOTE_STATUS_LABELS[status as QuoteStatus]}</strong> · Validez hasta{" "}
          <strong>{refreshed.validUntil.toLocaleDateString("es-ES")}</strong>
        </p>

        {searchParams?.paid === "1" && (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Pago recibido correctamente. Te hemos enviado confirmación por email.
          </p>
        )}
        {searchParams?.canceled === "1" && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Pago cancelado. Puedes intentarlo de nuevo cuando quieras.
          </p>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-4 rounded-2xl border border-slate-200 p-4">
            <h2 className="text-lg font-semibold text-slate-900">Detalle</h2>
            <p className="text-sm text-slate-700">
              Cliente: <strong>{refreshed.customerName}</strong> ({refreshed.customerEmail})
            </p>
            <p className="text-sm text-slate-700">
              Idiomas: <strong>{refreshed.sourceLang}</strong> → <strong>{refreshed.targetLang}</strong>
            </p>
            <p className="text-sm text-slate-700">
              Entrega:{" "}
              <strong>
                {refreshed.deliveryType === "PAPER_SHIP" ? "Papel con envío 24/48h" : "PDF digital firmado"}
              </strong>
            </p>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Descripción</th>
                    <th className="px-3 py-2 text-right">Cant.</th>
                    <th className="px-3 py-2 text-right">Precio</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {refreshed.lines.map((line) => (
                    <tr key={line.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">{line.description}</td>
                      <td className="px-3 py-2 text-right">{decimalToNumber(line.quantity)}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(decimalToNumber(line.unitPrice))}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(decimalToNumber(line.lineTotal))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="space-y-3 rounded-2xl border border-slate-200 p-4">
            <h2 className="text-base font-semibold text-slate-900">Resumen</h2>
            <p className="flex items-center justify-between text-sm text-slate-700">
              <span>Subtotal</span>
              <strong>{formatMoney(subtotal)}</strong>
            </p>
            <p className="flex items-center justify-between text-sm text-slate-700">
              <span>Descuento</span>
              <strong>- {formatMoney(discountAmount)}</strong>
            </p>
            <p className="flex items-center justify-between text-sm text-slate-700">
              <span>Envío</span>
              <strong>{formatMoney(shippingAmount)}</strong>
            </p>
            <p className="flex items-center justify-between text-sm text-slate-700">
              <span>IVA</span>
              <strong>{formatMoney(vatAmount)}</strong>
            </p>
            <p className="flex items-center justify-between border-t border-slate-200 pt-2 text-base text-slate-900">
              <span>Total</span>
              <strong>{formatMoney(total)}</strong>
            </p>
            {refreshed.deliveryType === "PAPER_SHIP" && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                El envío en papel (12 € + IVA) está incluido en el total.
              </p>
            )}
            <QuotePublicPayButton token={params.token} isPayable={isPayable} />
          </aside>
        </div>

        <section className="mt-6 rounded-2xl border border-slate-200 p-4">
          <h2 className="text-base font-semibold text-slate-900">PDF del presupuesto</h2>
          {refreshed.pdfUrl ? (
            <div className="mt-3 space-y-3">
              <iframe
                src={refreshed.pdfUrl}
                title="PDF presupuesto"
                className="h-72 w-full rounded-xl border border-slate-200"
              />
              <a
                href={refreshed.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex rounded-lg border border-emerald-500/40 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
              >
                Abrir / descargar PDF completo
              </a>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-600">
              El PDF final se mostrará en cuanto el presupuesto sea confirmado por el equipo.
            </p>
          )}
        </section>
      </section>
    </main>
  );
}
