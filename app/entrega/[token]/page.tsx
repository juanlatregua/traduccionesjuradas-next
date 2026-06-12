import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getOrderByTranslatorToken } from "@/lib/translator-delivery";
import TranslatorDeliveryForm from "@/components/TranslatorDeliveryForm";

export const metadata: Metadata = {
  title: "Subir traducción",
  robots: { index: false, follow: false },
};

export default async function TranslatorDeliveryPage({
  params,
}: {
  params: { token: string };
}) {
  const order = await getOrderByTranslatorToken(params.token);
  if (!order) notFound();

  const alreadyDelivered = Boolean(order.translatorDeliveredAt);

  return (
    <main className="min-h-screen bg-parchment px-4 py-12">
      <div className="mx-auto max-w-lg rounded-2xl border border-bleu/15 bg-white p-6 shadow-paper sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">Entrega de traducción</p>
        <h1 className="mt-1 font-baskerville text-2xl text-encre">Pedido {order.reference}</h1>
        <p className="mt-1 text-sm text-graphite">
          {order.title || "Traducción jurada"} · {order.langPair || ""}
        </p>

        <div className="mt-5">
          {alreadyDelivered && (
            <p className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Ya se subió una traducción para este pedido. Si subes otra, sustituirá a la anterior.
            </p>
          )}
          <p className="mb-3 text-sm text-sepia">
            Adjunta tu traducción terminada. La revisaremos y la enviaremos al cliente.
          </p>
          <TranslatorDeliveryForm token={params.token} />
        </div>
      </div>
    </main>
  );
}
