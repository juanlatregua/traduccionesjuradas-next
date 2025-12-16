import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aviso legal | Traducciones Juradas",
  description:
    "Información legal y datos del titular del sitio web traduccionesjuradas.net: responsabilidad, condiciones de uso y datos de contacto.",
};

export default function AvisoLegalPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-sm text-slate-700">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Aviso legal
      </h1>

      <p className="mt-4">
        Aquí podrás incluir el texto legal correspondiente a la titularidad de
        la web, datos de contacto, condiciones de uso, etc.
      </p>
    </main>
  );
}

