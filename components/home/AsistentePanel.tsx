"use client";

// components/home/AsistentePanel.tsx — «Escríbenos qué necesitas» (maqueta
// 22-sep). Al escribir la pregunta o pulsar un chip, el propio panel pasa a ser
// la conversación, ANCLADA en la página (Juan, 24-sep: «más pro» que el
// flotante, que tapaba la subida). Misma lógica que el widget flotante
// (components/chat/useChat.ts + ChatConversation): puerta de email +
// consentimiento dentro del panel, la pregunta sale sola al pasarla, y el
// servidor sigue exigiendo ambos. El chat solo habla es/fr (CHAT_LANGS): en
// los demás idiomas este panel es el de WhatsApp.

import { useEffect, useState } from "react";
import { MessageCircle, ArrowRight, RotateCcw } from "lucide-react";
import { HOME_HERO, CHAT_LANGS } from "@/lib/i18n/home-hero";
import type { Locale } from "@/lib/i18n/locales";
import type { ChatLang } from "@/lib/chat/ui-strings";
import { useChat } from "@/components/chat/useChat";
import ChatConversation from "@/components/chat/ChatConversation";
import { whatsAppHref, WHATSAPP_PRETTY } from "@/components/home/WhatsAppCta";

const CARD = "flex flex-col gap-4 rounded-2xl border border-cream bg-white p-5 shadow-paper sm:p-7";

export default function AsistentePanel({ lang }: { lang: Locale }) {
  if (!CHAT_LANGS.includes(lang)) return <WhatsAppPanel lang={lang} />;
  return <AsistenteChat lang={lang === "fr" ? "fr" : "es"} />;
}

function WhatsAppPanel({ lang }: { lang: Locale }) {
  const w = HOME_HERO.whatsappPanel;
  return (
    <section aria-labelledby="asistente-title" className={CARD}>
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

function AsistenteChat({ lang }: { lang: ChatLang }) {
  const t = HOME_HERO.asistente;
  const chat = useChat(lang);
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<"ask" | "chat">("ask");

  // Conversación restaurada de esta pestaña (recarga): se enseña directamente.
  useEffect(() => {
    if (chat.messages.length > 1) setMode("chat");
  }, [chat.messages.length]);

  const ask = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setMode("chat");
    chat.ask(clean);
    setQuestion("");
  };

  const restart = () => {
    chat.clearConversation();
    setMode("ask");
  };

  if (mode === "chat") {
    return (
      <section aria-labelledby="asistente-title" className="flex flex-col overflow-hidden rounded-2xl border border-cream bg-white shadow-paper">
        <div className="flex items-center justify-between gap-3 border-b border-cream bg-encre px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 font-baskerville text-sm font-bold text-or-light" aria-hidden="true">
              TJ
            </span>
            <div className="flex flex-col">
              <h2 id="asistente-title" className="text-sm font-semibold text-parchment">{chat.t.headerTitle}</h2>
              <span className="flex items-center gap-1 text-xs text-parchment/70">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                {chat.t.online}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={restart}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-parchment/80 transition-colors hover:bg-white/10 hover:text-parchment"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            {chat.t.newConversation}
          </button>
        </div>
        <ChatConversation chat={chat} variant="embedded" />
      </section>
    );
  }

  return (
    <section aria-labelledby="asistente-title" className={CARD}>
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
