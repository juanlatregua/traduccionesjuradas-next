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
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      {session.isPaid ? (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Pago confirmado</p>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Pedido recibido correctamente
          </h2>
          <p className="mt-2 text-sm text-slate-700">
            Referencia <span className="font-mono font-semibold">{session.reference}</span>. Te notificaremos los
            siguientes hitos en el área cliente.
          </p>
        </>
      ) : (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Verificación en curso</p>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Estamos validando tu pago
          </h2>
          <p className="mt-2 text-sm text-slate-700">
            Hemos recibido la vuelta del checkout y estamos esperando confirmación final del proveedor.
          </p>
        </>
      )}

      <div className="mt-5 flex flex-wrap gap-3 text-sm">
        <Link href="/checkout" className="rounded-2xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100">
          Volver a checkout
        </Link>
        <Link href="/area-cliente" className="rounded-2xl bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700">
          Ir a área cliente
        </Link>
      </div>
    </section>
  );
}

