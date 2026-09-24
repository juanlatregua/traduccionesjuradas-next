"use client";

// components/home/AsistentePanel.tsx — «Escríbenos qué necesitas» (maqueta
// 22-sep). No es otro chat: abre el asistente que ya existe (ChatWidget, con su
// puerta de email + consentimiento y su límite diario) con la pregunta escrita.

import { useState } from "react";
import { MessageCircle, ArrowRight } from "lucide-react";
import { openChatWith } from "@/lib/chat/open-chat";

const CHIPS: { label: string; short: string; question: string }[] = [
  {
    label: "Nacionalidad española",
    short: "Nacionalidad",
    question: "Estoy con la nacionalidad española. ¿Qué documentos necesito traducir y cuánto cuesta?",
  },
  {
    label: "Homologar un título",
    short: "Homologar título",
    question: "Quiero homologar un título extranjero en España. ¿Qué tengo que traducir?",
  },
  {
    label: "Reagrupación familiar",
    short: "Reagrupación",
    question: "Estoy con una reagrupación familiar. ¿Qué documentos deben llevar traducción jurada?",
  },
  {
    label: "Me ha llegado una carta oficial",
    short: "Carta oficial",
    question: "Me ha llegado una carta oficial en otro idioma y no sé qué me piden. ¿Me ayudáis?",
  },
];

export default function AsistentePanel() {
  const [question, setQuestion] = useState("");

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
            Escríbenos qué necesitas
          </h2>
          <p className="text-sm text-graphite">Te guiamos paso a paso, como en WhatsApp</p>
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
          Tu trámite o tu duda
        </label>
        <div className="flex gap-2">
          <input
            id="home-question"
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ej.: nacionalidad, tengo el acta de nacimiento en árabe"
            autoComplete="off"
            maxLength={500}
            className="h-12 min-w-0 flex-1 rounded-xl border border-graphite/25 bg-parchment px-4 text-base text-sepia outline-none placeholder:text-graphite/60 focus:border-bleu focus:ring-1 focus:ring-bleu/20 sm:h-14 sm:text-[17px]"
          />
          <button
            type="submit"
            disabled={!question.trim()}
            aria-label="Preguntar al asistente"
            className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-encre px-4 text-base font-bold text-white transition-colors hover:bg-bleu-dark disabled:cursor-not-allowed disabled:opacity-50 sm:h-14 sm:px-6"
          >
            <span className="hidden sm:inline">Preguntar</span>
            <ArrowRight className="h-5 w-5 sm:hidden" aria-hidden="true" />
          </button>
        </div>
      </form>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Trámites frecuentes">
        {CHIPS.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => ask(c.question)}
            className="rounded-full border border-cream bg-parchment px-3.5 py-2 text-sm text-sepia transition-colors hover:border-or hover:bg-or-light/50"
          >
            <span className="sm:hidden">{c.short}</span>
            <span className="hidden sm:inline">{c.label}</span>
          </button>
        ))}
      </div>

      <p className="hidden text-sm leading-relaxed text-graphite sm:block">
        El asistente te dice qué documentos hacen falta y con qué validez. Para el precio, sube el documento aquí al lado.
      </p>
    </section>
  );
}
