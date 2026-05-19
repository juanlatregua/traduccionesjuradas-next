import type { Metadata } from "next";
import { PURPOSE_REGULARIZACION_2026 } from "@/lib/session-pricing";
import PuertaClient from "./PuertaClient";

// Presets de campaña activables por query param (?p=…).
const PURPOSE_PRESETS: Record<string, string> = {
  "regularizacion-2026": PURPOSE_REGULARIZACION_2026,
};

export const metadata: Metadata = {
  title: "Presupuesto instantáneo de traducción jurada",
  description:
    "Sube tu documento y, en segundos, te decimos qué es, si necesita traducción jurada, cuánto cuesta, en cuánto tiempo y con qué validez. Precio cerrado al instante.",
  alternates: {
    canonical: "https://www.traduccionesjuradas.net/presupuesto-instantaneo",
  },
  openGraph: {
    images: [
      {
        url: "/api/og?title=Presupuesto+instant%C3%A1neo&subtitle=Sube+tu+documento+y+recibe+precio+cerrado+en+segundos",
        width: 1200,
        height: 630,
        alt: "Presupuesto instantáneo de traducción jurada — TraduccionesJuradas.net",
      },
    ],
  },
};

export default function PresupuestoInstantaneoPage({
  searchParams,
}: {
  searchParams?: { p?: string };
}) {
  const presetKey = searchParams?.p?.toLowerCase().trim();
  const purpose = (presetKey && PURPOSE_PRESETS[presetKey]) || null;

  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-10 text-center">
        <h1 className="font-baskerville text-3xl font-bold leading-tight text-bleu sm:text-4xl">
          Presupuesto instantáneo
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-lg text-graphite">
          Suelta tu documento y, en segundos, te decimos qué es, si necesita
          traducción jurada, cuánto cuesta, en cuánto tiempo y con qué validez.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs text-graphite">
          <span className="flex items-center gap-1.5 rounded-full bg-cream px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-vert" />
            Traductor jurado N.º 3850
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-cream px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-bleu" />
            Análisis automático
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-cream px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-or" />
            Precio cerrado
          </span>
        </div>
      </div>

      <PuertaClient purpose={purpose} />
    </section>
  );
}
