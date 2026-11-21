import type { Metadata } from "next";
import { PURPOSE_REGULARIZACION_2026 } from "@/lib/session-pricing";
import Link from "next/link";
import PuertaClient from "./PuertaClient";
import PuertaPortada from "@/components/entrada/PuertaPortada";
import AsistentePanel from "@/components/home/AsistentePanel";
import { HOME_HERO } from "@/lib/i18n/home-hero";
import { puertaV2On } from "@/lib/entrada/flag";
import { PUERTA_LANGS, WHATSAPP_HEAD, toPuertaLang } from "@/lib/i18n/whatsapp-arrival";

// Presets de pricing activables por query param (?p=…). Solo regularización
// aplica precio de campaña; el resto van al pricing-engine normal.
const PURPOSE_PRESETS: Record<string, string> = {
  "regularizacion-2026": PURPOSE_REGULARIZACION_2026,
};

// Orígenes de captación válidos (atribución del funnel). No tocan el precio;
// solo etiquetan de dónde llega el lead (p. ej. el handoff del bloque uge-ce).
const KNOWN_SOURCES = new Set(["regularizacion-2026", "uge-ce", "lavori", "precios", "whatsapp"]);

// Enlace que Juan manda por WhatsApp (?p=whatsapp&l=fr): cabecera corta en el
// idioma del cliente y selector para cambiarlo; la puerta entera sigue ese
// idioma. Textos en lib/i18n/whatsapp-arrival.ts (los comparte con la portada).

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
  searchParams?: { p?: string; l?: string; r?: string };
}) {
  const presetKey = searchParams?.p?.toLowerCase().trim();
  const purpose = (presetKey && PURPOSE_PRESETS[presetKey]) || null;
  const source = (presetKey && KNOWN_SOURCES.has(presetKey) && presetKey) || null;
  const lang = toPuertaLang(searchParams?.l);
  const resumeToken = searchParams?.r || null;

  // Un enlace de reanudación (?r=) es de una sesión de la puerta vieja: solo PuertaClient la sabe abrir.
  // ?p=regularizacion-2026 llega a la entrada como `source` y de ahí al presupuesto (lib/entrada/fr-auto).
  const v2 = puertaV2On() && !resumeToken;

  // PUERTA_V2=on: la misma puerta que la portada (subida = paso 1, asistente al lado), también para el enlace de WhatsApp.
  if (v2) {
    // ?l= (WhatsApp y el recordatorio de la entrada): la puerta en el idioma del cliente.
    const l = source === "whatsapp" || searchParams?.l ? lang : "es";
    return (
      <section lang={l} className="border-b border-cream bg-parchment">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:py-8">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="font-baskerville text-[1.4rem] font-bold leading-tight text-encre sm:text-[1.75rem] lg:text-[2.1rem]">
              {l === "es" ? "Cuéntanos qué necesitas traducir" : HOME_HERO.h1[l]}
            </h1>
            {l === "es" && (
              <p className="mx-auto mt-2 max-w-xl text-base text-graphite">
                Sube tus documentos, los revisamos juntos para que no falte nada y Juan te manda el presupuesto cerrado, normalmente en el día.
              </p>
            )}
          </div>
          <PuertaPortada key={l} lang={l} source={source} asistente={<AsistentePanel lang={l} />} idiomaNav={source === "whatsapp"} />
        </div>
      </section>
    );
  }

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
        <PuertaClient purpose={purpose} source={source} lang={lang} resumeToken={resumeToken} />
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

      <PuertaClient purpose={purpose} source={source} resumeToken={resumeToken} />
    </section>
  );
}
