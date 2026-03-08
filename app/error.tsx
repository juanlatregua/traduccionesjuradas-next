"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[error-boundary]", error);
  }, [error]);

  return (
    <section className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="font-baskerville text-3xl font-bold text-bleu sm:text-4xl">
        Algo ha salido mal
      </h1>
      <p className="mt-3 text-graphite">
        Ha ocurrido un error inesperado. Puedes intentarlo de nuevo o volver al
        inicio.
      </p>

      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <button
          onClick={reset}
          className="rounded-2xl bg-bleu px-5 py-2.5 text-sm font-semibold text-white hover:bg-bleu-dark"
        >
          Intentar de nuevo
        </button>
        <Link
          href="/"
          className="rounded-2xl border border-cream px-5 py-2.5 text-sm font-semibold text-sepia hover:bg-cream"
        >
          Ir al inicio
        </Link>
      </div>
    </section>
  );
}
