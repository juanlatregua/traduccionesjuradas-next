import Link from "next/link";
import GuestOrderLookup from "@/components/GuestOrderLookup";

export default function ConsultaPage() {
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Consultar estado de tu pedido
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Introduce la referencia de tu pedido y el email con el que lo creaste.
        </p>

        <div className="mt-6">
          <GuestOrderLookup />
        </div>

        <div className="mt-6">
          <Link href="/" className="text-sm font-semibold text-emerald-700 hover:underline">
            Volver al inicio
          </Link>
        </div>
      </section>
    </main>
  );
}
