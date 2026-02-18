import type { Metadata } from "next";
import Link from "next/link";
import { MAIL_LINK, WHATSAPP_LINK } from "@/lib/contact";
import { getOrderPublic } from "@/lib/orders";
import { getPaymentStateLabel } from "@/lib/client-area";

export const metadata: Metadata = {
  title: "Pago confirmado | Traducciones Juradas",
  description: "Pago confirmado correctamente. Te contactamos para iniciar tu traduccion jurada.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PagoExitoPage({
  searchParams,
}: {
  searchParams?: { ref?: string | string[] };
}) {
  const reference = Array.isArray(searchParams?.ref) ? searchParams?.ref[0] : searchParams?.ref;

  const order = reference
    ? await getOrderPublic(reference).catch(() => null)
    : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <section className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Pedido confirmado
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Pago recibido correctamente
        </h1>
        <p className="mt-3 text-sm text-slate-700">
          Hemos recibido tu pago. Nuestro equipo revisara la documentacion y te confirmara por email
          el inicio del encargo y el plazo final.
        </p>
        {reference && (
          <p className="mt-3 text-xs text-slate-500">
            Referencia de pedido: <span className="font-mono">{reference}</span>
          </p>
        )}
        {order && (
          <p className="mt-1 text-xs text-slate-500">
            Estado: <span className="font-semibold">{getPaymentStateLabel(order.paymentStatus)}</span>
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <Link
            href="/area-cliente"
            className="rounded-2xl bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800"
          >
            Ver area de cliente
          </Link>
          <a
            href={MAIL_LINK}
            className="rounded-2xl bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700"
          >
            Enviar documentacion por email
          </a>
          <a
            href={WHATSAPP_LINK}
            className="rounded-2xl border border-slate-300 px-4 py-2 font-semibold text-slate-800 hover:bg-slate-100"
          >
            Enviar por WhatsApp
          </a>
          <Link href="/" className="font-semibold text-emerald-800 underline-offset-2 hover:underline">
            Volver al inicio
          </Link>
        </div>
      </section>
    </main>
  );
}
