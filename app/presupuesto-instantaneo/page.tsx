import type { Metadata } from "next";
import { PURPOSE_REGULARIZACION_2026 } from "@/lib/session-pricing";
import Link from "next/link";
import PuertaClient from "./PuertaClient";
import type { PuertaLang } from "@/lib/i18n/puerta";

// Presets de pricing activables por query param (?p=…). Solo regularización
// aplica precio de campaña; el resto van al pricing-engine normal.
const PURPOSE_PRESETS: Record<string, string> = {
  "regularizacion-2026": PURPOSE_REGULARIZACION_2026,
};

// Orígenes de captación válidos (atribución del funnel). No tocan el precio;
// solo etiquetan de dónde llega el lead (p. ej. el handoff del bloque uge-ce).
const KNOWN_SOURCES = new Set(["regularizacion-2026", "uge-ce", "lavori", "precios", "whatsapp"]);

// Enlace que Juan manda por WhatsApp (?p=whatsapp&l=fr): cabecera corta en el
// idioma del cliente y selector para cambiarlo; la puerta entera sigue ese idioma.
const PUERTA_LANGS: PuertaLang[] = ["es", "fr", "en", "de", "pt"];
const WHATSAPP_HEAD: Record<PuertaLang, { banner: string; title: string }> = {
  es: { banner: "Vienes de WhatsApp: sube aquí tus documentos y te contestamos por WhatsApp con el precio.", title: "Sube tus documentos" },
  fr: { banner: "Vous venez de WhatsApp : déposez ici vos documents et nous vous répondons sur WhatsApp avec le prix.", title: "Déposez vos documents" },
  en: { banner: "You came from WhatsApp: upload your documents here and we'll reply on WhatsApp with the price.", title: "Upload your documents" },
  de: { banner: "Sie kommen von WhatsApp: Laden Sie hier Ihre Dokumente hoch, wir antworten Ihnen per WhatsApp mit dem Preis.", title: "Laden Sie Ihre Dokumente hoch" },
  pt: { banner: "Vem do WhatsApp: envie aqui os seus documentos e respondemos pelo WhatsApp com o preço.", title: "Envie os seus documentos" },
};

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
  searchParams?: { p?: string; l?: string };
}) {
  const presetKey = searchParams?.p?.toLowerCase().trim();
  const purpose = (presetKey && PURPOSE_PRESETS[presetKey]) || null;
  const source = (presetKey && KNOWN_SOURCES.has(presetKey) && presetKey) || null;
  const langParam = searchParams?.l?.toLowerCase().trim() as PuertaLang | undefined;
  const lang: PuertaLang = langParam && PUERTA_LANGS.includes(langParam) ? langParam : "es";

  if (source === "whatsapp") {
    const head = WHATSAPP_HEAD[lang];
    return (
      <section lang={lang} className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <nav aria-label="Idioma" className="mb-5 flex flex-wrap justify-center gap-2">
          {PUERTA_LANGS.map((l) => (
            <Link
              key={l}
              href={`/presupuesto-instantaneo?p=whatsapp&l=${l}`}
              aria-current={l === lang ? "true" : undefined}
              className={`rounded-full border px-3.5 py-2 text-sm font-semibold uppercase ${
                l === lang ? "border-bleu bg-bleu text-white" : "border-bleu/20 bg-parchment text-bleu hover:border-or"
              }`}
            >
              {l}
            </Link>
          ))}
        </nav>
        <p className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-base text-emerald-900">{head.banner}</p>
        <h1 className="mb-6 font-baskerville text-2xl font-bold leading-tight text-bleu sm:text-3xl">{head.title}</h1>
        <PuertaClient purpose={purpose} source={source} lang={lang} />
      </section>
    );
  }

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
