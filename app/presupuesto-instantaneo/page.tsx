import type { Metadata } from "next";
import { PURPOSE_REGULARIZACION_2026 } from "@/lib/session-pricing";
import PuertaClient from "./PuertaClient";

// Presets de pricing activables por query param (?p=…). Solo regularización
// aplica precio de campaña; el resto van al pricing-engine normal.
const PURPOSE_PRESETS: Record<string, string> = {
  "regularizacion-2026": PURPOSE_REGULARIZACION_2026,
};

// Orígenes de captación válidos (atribución del funnel). No tocan el precio;
// solo etiquetan de dónde llega el lead (p. ej. el handoff del bloque uge-ce).
const KNOWN_SOURCES = new Set(["regularizacion-2026", "uge-ce", "lavori", "precios"]);

export const metadata: Metadata = {
  title: "Presupuesto de traducción jurada: al instante en francés, en el día en los demás idiomas",
  description:
    "Sube tu documento y, en segundos, te decimos qué es, si necesita traducción jurada y con qué validez. En francés, precio cerrado al momento; en los demás idiomas, un traductor jurado de tu lengua te manda el presupuesto, normalmente en el día.",
  alternates: {
    canonical: "https://www.traduccionesjuradas.net/presupuesto-instantaneo",
  },
  openGraph: {
    images: [
      {
        url: "/api/og?title=Presupuesto+de+traducci%C3%B3n+jurada&subtitle=Al+instante+en+franc%C3%A9s+%C2%B7+en+el+d%C3%ADa+en+los+dem%C3%A1s+idiomas",
        width: 1200,
        height: 630,
        alt: "Presupuesto de traducción jurada: al instante en francés, en el día en los demás idiomas — TraduccionesJuradas.net",
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
  const source = (presetKey && KNOWN_SOURCES.has(presetKey) && presetKey) || null;

  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-10 text-center">
        <h1 className="font-baskerville text-3xl font-bold leading-tight text-bleu sm:text-4xl">
          Presupuesto al instante en francés · en el día en los demás idiomas
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-lg text-graphite">
          Suelta tu documento y, en segundos, te decimos qué es, si necesita
          traducción jurada y con qué validez. En francés, el precio cerrado al
          momento; en los demás idiomas, un traductor jurado de tu lengua lo ve y
          te manda el presupuesto, normalmente en el día.
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
            Precio cerrado (francés)
          </span>
        </div>
      </div>

      <PuertaClient purpose={purpose} source={source} />
    </section>
  );
}
