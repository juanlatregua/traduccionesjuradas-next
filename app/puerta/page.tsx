import type { Metadata } from "next";
import PuertaClient from "./PuertaClient";

// Ruta nueva del funnel v2 (Bloque 1.2). En construcción: noindex hasta que
// el Bloque 1.4 la convierta en la canónica y redirija los enlaces entrantes.
export const metadata: Metadata = {
  title: "Tu traducción jurada, al instante",
  description:
    "Sube tu documento y recibe el diagnóstico completo: tipo, precio, plazo y validez en segundos.",
  robots: { index: false, follow: false },
};

export default function PuertaPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-10 text-center">
        <h1 className="font-baskerville text-3xl font-bold leading-tight text-bleu sm:text-4xl">
          Tu traducción jurada, al instante
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-lg text-graphite">
          Suelta tu documento y, en segundos, te decimos qué es, si necesita
          traducción jurada, cuánto cuesta, en cuánto tiempo y con qué validez.
        </p>
      </div>

      <PuertaClient />
    </section>
  );
}
