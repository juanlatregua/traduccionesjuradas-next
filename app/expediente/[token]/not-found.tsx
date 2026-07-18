import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Expediente no encontrado | Traducciones Juradas",
  robots: { index: false, follow: false },
};

export default function ExpedienteNotFound() {
  return (
    <main className="min-h-screen bg-parchment">
      <section className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-baskerville text-2xl text-encre">Expediente no encontrado</h1>
        <p className="mt-3 text-graphite">
          El enlace no es válido o ha caducado. Si crees que es un error, escríbenos por{" "}
          <a href="https://wa.me/34951333614" className="text-bleu underline">WhatsApp</a>.
        </p>
      </section>
    </main>
  );
}
