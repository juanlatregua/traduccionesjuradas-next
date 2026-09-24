"use client";

// components/home/AsistentePanel.tsx — «Escríbenos qué necesitas» (maqueta
// 22-sep). No es otro chat: abre el asistente que ya existe (ChatWidget, con su
// puerta de email + consentimiento y su límite diario) con la pregunta escrita.
// El chat solo habla es/fr (CHAT_LANGS): en los demás idiomas este panel es
// el de WhatsApp.

import { useState } from "react";
import { MessageCircle, ArrowRight } from "lucide-react";
import { openChatWith } from "@/lib/chat/open-chat";
import { HOME_HERO, CHAT_LANGS } from "@/lib/i18n/home-hero";
import type { Locale } from "@/lib/i18n/locales";
import { whatsAppHref, WHATSAPP_PRETTY } from "@/components/home/WhatsAppCta";

export default function AsistentePanel({ lang }: { lang: Locale }) {
  const t = HOME_HERO.asistente;
  const [question, setQuestion] = useState("");

  if (!CHAT_LANGS.includes(lang)) {
    const w = HOME_HERO.whatsappPanel;
    return (
      <section aria-labelledby="asistente-title" className="flex flex-col gap-4 rounded-2xl border border-cream bg-white p-5 shadow-paper sm:p-7">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-vert text-white" aria-hidden="true">
            <MessageCircle className="h-5 w-5" />
          </span>
          <div>
            <h2 id="asistente-title" className="font-baskerville text-xl font-bold text-encre sm:text-2xl">{w.title[lang]}</h2>
            <p className="text-sm text-graphite">{w.sub[lang]}</p>
          </div>
        </div>
        <p className="text-[15px] leading-relaxed text-sepia">{w.body[lang]}</p>
        <a
          href={whatsAppHref(lang)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-vert px-5 py-3.5 text-base font-bold text-white transition-colors hover:bg-vert/90"
        >
          <MessageCircle className="h-5 w-5" aria-hidden="true" />
          {w.cta[lang]} · {WHATSAPP_PRETTY}
        </a>
      </section>
    );
  }

  const ask = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    openChatWith(clean);
    setQuestion("");
  };

  return (
    <section
      aria-labelledby="asistente-title"
      className="flex flex-col gap-4 rounded-2xl border border-cream bg-white p-5 shadow-paper sm:p-7"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-encre text-or-light" aria-hidden="true">
          <MessageCircle className="h-5 w-5" />
        </span>
        <div>
          <h2 id="asistente-title" className="font-baskerville text-xl font-bold text-encre sm:text-2xl">
            {t.title[lang]}
          </h2>
          <p className="text-sm text-graphite">{t.sub[lang]}</p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="flex flex-col gap-2"
      >
        <label htmlFor="home-question" className="text-sm font-semibold text-sepia">
          {t.label[lang]}
        </label>
        <div className="flex gap-2">
          <input
            id="home-question"
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t.placeholder[lang]}
            autoComplete="off"
            maxLength={500}
            className="h-12 min-w-0 flex-1 rounded-xl border border-graphite/25 bg-parchment px-4 text-base text-sepia outline-none placeholder:text-graphite/60 focus:border-bleu focus:ring-1 focus:ring-bleu/20 sm:h-14 sm:text-[17px]"
          />
          <button
            type="submit"
            disabled={!question.trim()}
            aria-label={t.buttonAria[lang]}
            className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-encre px-4 text-base font-bold text-white transition-colors hover:bg-bleu-dark disabled:cursor-not-allowed disabled:opacity-50 sm:h-14 sm:px-6"
          >
            <span className="hidden sm:inline">{t.button[lang]}</span>
            <ArrowRight className="h-5 w-5 sm:hidden" aria-hidden="true" />
          </button>
        </div>
      </form>

      <div className="flex flex-wrap gap-2" role="group" aria-label={t.chipsAria[lang]}>
        {t.chips.map((c) => (
          <button
            key={c.label.es}
            type="button"
            onClick={() => ask(c.question[lang])}
            className="inline-flex min-h-11 items-center rounded-full border border-cream bg-parchment px-3.5 text-sm text-sepia transition-colors hover:border-or hover:bg-or-light/50"
          >
            <span className="sm:hidden">{c.short[lang]}</span>
            <span className="hidden sm:inline">{c.label[lang]}</span>
          </button>
        ))}
      </div>

      <p className="hidden text-sm leading-relaxed text-graphite sm:block">{t.foot[lang]}</p>
    </section>
  );
}
