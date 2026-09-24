// components/home/HomeHero.tsx — Portada nueva (maqueta aprobada 22-sep, Juan
// 24-sep): el asistente y la subida juntos encima del pliegue, con la opción de
// expediente grande. Server component; lo interactivo vive en AsistentePanel y
// SubidaPanel. Sustituye al hero de HomeV2 solo en la portada ES (slot `hero`).

import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import AsistentePanel from "@/components/home/AsistentePanel";
import SubidaPanelFromParams, { SubidaPanel } from "@/components/home/SubidaPanel";
import WhatsAppCta from "@/components/home/WhatsAppCta";
import { HOME } from "@/lib/i18n/home";

const TRUST = [
  "Traductores jurados nombrados por el Ministerio de Asuntos Exteriores",
  "Pago seguro: tarjeta, Bizum o transferencia",
  "Entrega en PDF firmado o en papel",
];

export default function HomeHero() {
  return (
    <section id="hero" className="border-b border-cream bg-parchment">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-14">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 text-center sm:gap-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-or-dark sm:text-sm">
            Traducción jurada · 10 idiomas · validez oficial en España
          </p>
          <h1 className="font-baskerville text-[1.7rem] font-bold leading-tight text-encre sm:text-4xl lg:text-[3.1rem] lg:leading-[1.15]">
            Traducción jurada oficial: cuéntanos tu trámite o sube tu documento
          </h1>
          <p className="text-base leading-relaxed text-graphite sm:text-lg lg:text-xl">
            Te decimos qué necesitas traducir, con qué validez y cuánto cuesta. En francés, precio cerrado al momento;
            en los demás idiomas, un traductor jurado te lo presupuesta en el día.
          </p>
        </div>

        <div className="mt-6 grid items-start gap-4 sm:mt-9 sm:gap-7 lg:grid-cols-2">
          <AsistentePanel />
          <Suspense fallback={<SubidaPanel source={null} lang="es" />}>
            <SubidaPanelFromParams />
          </Suspense>
        </div>

        <div className="mt-6 flex items-center justify-center gap-4 sm:mt-9">
          <span className="hidden h-px w-24 bg-or/40 sm:block" aria-hidden="true" />
          <WhatsAppCta />
          <span className="hidden h-px w-24 bg-or/40 sm:block" aria-hidden="true" />
        </div>

        <ul className="mt-6 flex flex-col items-center gap-2 text-center text-sm text-graphite sm:mt-8 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-8">
          {TRUST.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <p className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-xs text-graphite">
          <span className="text-or-dark" aria-label="4,8 de 5">★★★★★</span>
          <b className="text-encre">{HOME.hero.ratingNote.es}</b>
          <span className="hidden h-3 w-px bg-bleu/15 sm:inline-block" aria-hidden="true" />
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-or-dark" aria-hidden="true" />
            {HOME.hero.credit.es}
          </span>
        </p>
      </div>
    </section>
  );
}
