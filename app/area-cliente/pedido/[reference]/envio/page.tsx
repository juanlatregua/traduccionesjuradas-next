import type { Metadata } from "next";
import { blobDownloadUrl } from "@/lib/blob-download-url";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { verifyOrderToken } from "@/lib/order-token";
import ShippingDataForm from "@/components/ShippingDataForm";

export const metadata: Metadata = {
  title: "Dirección de envío",
  robots: { index: false, follow: false },
};

type Props = {
  params: { reference: string };
  searchParams: { token?: string };
};

export default async function EnvioPage({ params, searchParams }: Props) {
  const token = String(searchParams?.token || "");
  const order = token && verifyOrderToken(params.reference, token)
    ? await prisma.order.findUnique({
        where: { reference: params.reference },
        select: {
          reference: true,
          title: true,
          deliveryType: true,
          shippedAt: true,
          trackingNumber: true,
          shippingCourier: true,
          trackingUrl: true,
          shippingProofUrl: true,
          clientName: true,
          clientPhone: true,
          shipping: true,
        },
      })
    : null;

  if (!order) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <section className="rounded-3xl border border-red-200 bg-card p-6 shadow-sm">
          <p className="text-sm text-red-600">Enlace no válido o caducado. Escríbenos a hola@traduccionesjuradas.net y te ayudamos.</p>
          <Link href="/" className="mt-3 inline-block text-sm font-semibold text-bleu hover:underline">
            Volver al inicio
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <section className="rounded-3xl border border-cream bg-card p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">Pedido {order.reference}</p>
        <h1 className="mt-2 text-2xl font-bold text-encre">Dirección de envío</h1>
        <p className="mt-1 text-sm text-sepia">{order.title}</p>

        <div className="mt-6">
          {order.deliveryType !== "paper" ? (
            <p className="text-sm text-sepia">Este pedido se entrega en PDF con firma digital: no necesita dirección de envío.</p>
          ) : order.shippedAt ? (
            <div className="space-y-2 text-sm text-sepia">
              <p>
                El envío ya ha salido el {order.shippedAt.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
                {order.shippingCourier ? ` por ${order.shippingCourier}` : ""}
                {order.trackingNumber ? <> · Nº de seguimiento <strong className="font-mono text-encre">{order.trackingNumber}</strong></> : null}.
              </p>
              {order.trackingUrl && (
                <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="mr-3 inline-block font-semibold text-bleu hover:underline">
                  Seguir el envío
                </a>
              )}
              {order.shippingProofUrl && (
                <a href={blobDownloadUrl(order.shippingProofUrl)} target="_blank" rel="noopener noreferrer" className="inline-block font-semibold text-bleu hover:underline">
                  Ver justificante del envío
                </a>
              )}
              <p>Si hay que cambiar algo, escríbenos a hola@traduccionesjuradas.net.</p>
            </div>
          ) : (
            <ShippingDataForm
              reference={order.reference}
              token={token}
              initial={
                order.shipping ?? { name: order.clientName || "", phone: order.clientPhone || "" }
              }
            />
          )}
        </div>
      </section>
    </main>
  );
}
