import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionOrRedirect } from "@/lib/session";

export const metadata: Metadata = {
  title: "Confirmación de pago | Traducción jurada",
  robots: { index: false, follow: false },
};

type ConfirmationPageProps = {
  searchParams?: {
    paid?: string;
  };
};

export default async function ConfirmationPage({ searchParams }: ConfirmationPageProps) {
  const session = await getSessionOrRedirect();
  const hasCompletedMarker = searchParams?.paid === "1";

  if (!session.isPaid && !hasCompletedMarker) {
    redirect("/checkout");
  }

  return (
    <section className="rounded-3xl border border-cream bg-card p-5 shadow-sm sm:p-7">
      {session.isPaid ? (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-bleu">Pago confirmado</p>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-encre sm:text-2xl">
            Pedido recibido correctamente
          </h2>
          <p className="mt-2 text-sm text-sepia">
            Referencia <span className="font-mono font-semibold">{session.reference}</span>. Te notificaremos los
            siguientes hitos en el área cliente.
          </p>
        </>
      ) : (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Verificación en curso</p>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-encre sm:text-2xl">
            Estamos validando tu pago
          </h2>
          <p className="mt-2 text-sm text-sepia">
            Hemos recibido la vuelta del checkout y estamos esperando confirmación final del proveedor.
          </p>
        </>
      )}

      <div className="mt-5 flex flex-wrap gap-3 text-sm">
        <Link href="/checkout" className="rounded-2xl border border-cream px-4 py-2 font-semibold text-sepia hover:bg-cream">
          Volver a checkout
        </Link>
        <Link href="/area-cliente" className="rounded-2xl bg-bleu px-4 py-2 font-semibold text-white hover:bg-bleu-dark">
          Ir a área cliente
        </Link>
      </div>
    </section>
  );
}

