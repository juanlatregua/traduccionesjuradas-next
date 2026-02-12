import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pago cancelado | Traducciones Juradas",
  description: "Has cancelado el pago. Puedes retomarlo cuando quieras.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PagoCanceladoPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <section className="rounded-3xl border border-amber-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
          Pago cancelado
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          No se ha completado el pago
        </h1>
        <p className="mt-3 text-sm text-slate-700">
          El pedido no se ha confirmado todavía. Puedes volver a la calculadora y reintentar el pago
          cuando quieras.
        </p>

        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <Link
            href="/"
            className="rounded-2xl bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800"
          >
            Volver a calcular y pagar
          </Link>
          <Link href="/presupuesto" className="font-semibold text-emerald-800 underline-offset-2 hover:underline">
            O pedir presupuesto cerrado
          </Link>
        </div>
      </section>
    </main>
  );
}
