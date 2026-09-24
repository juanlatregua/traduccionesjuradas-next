"use client";

import { track } from "@vercel/analytics";
import { MessageCircle } from "lucide-react";
import { buildPresupuestoWhatsAppLink, buildWhatsAppLinkFromText } from "@/lib/contact";
import { HOME_HERO } from "@/lib/i18n/home-hero";
import { puertaT } from "@/lib/i18n/puerta";
import { LOCALE_HOME, type Locale } from "@/lib/i18n/locales";

// ES: plantilla de presupuesto de lib/contact (con atribución de página). Resto:
// el saludo de la puerta en su idioma + la misma atribución.
export function whatsAppHref(lang: Locale) {
  const page = LOCALE_HOME[lang];
  return lang === "es"
    ? buildPresupuestoWhatsAppLink({ page })
    : buildWhatsAppLinkFromText(`${puertaT[lang].whatsappPrefill}\n(web: ${page})`);
}

export default function WhatsAppCta({ lang }: { lang: Locale }) {
  const t = HOME_HERO.whatsapp;
  return (
    <a
      href={whatsAppHref(lang)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track("whatsapp_click", { page: LOCALE_HOME[lang], source: "hero" })}
      className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-vert px-5 py-4 text-left text-white shadow-sm transition-colors hover:bg-vert/90 sm:w-auto sm:rounded-full sm:py-3.5 sm:text-center"
    >
      <MessageCircle className="h-6 w-6 shrink-0" aria-hidden="true" />
      <span className="flex flex-col sm:block">
        <span className="text-base font-bold sm:text-[17px]">
          {t.prefer[lang]} {t.writeShort[lang]}
        </span>
        <span className="text-sm text-white/85 sm:ml-1">{t.sameDay[lang]}</span>
      </span>
    </a>
  );
}
