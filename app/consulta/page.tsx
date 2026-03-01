import Link from "next/link";
import GuestOrderLookup from "@/components/GuestOrderLookup";

export default function ConsultaPage() {
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <section className="rounded-3xl border border-cream bg-card p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-encre">
          Consultar estado de tu pedido
        </h1>
        <p className="mt-2 text-sm text-sepia">
          Introduce la referencia de tu pedido y el email con el que lo creaste.
        </p>

        <div className="mt-6">
          <GuestOrderLookup />
        </div>

        <div className="mt-6">
          <Link href="/" className="text-sm font-semibold text-bleu hover:underline">
            Volver al inicio
          </Link>
        </div>
      </section>
    </main>
  );
}
