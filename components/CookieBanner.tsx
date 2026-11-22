"use client";

import { useEffect, useRef, useState } from "react";
import { useUiLang } from "@/lib/i18n/use-ui-lang";

const STORAGE_KEY = "tj_cookie_consent";

const CB = {
  es: {
    short: "Usamos cookies técnicas y de análisis anónimo.",
    text: "Utilizamos cookies técnicas para el correcto funcionamiento de la web y, en su caso, herramientas de análisis anónimo de uso. Puedes obtener más información en nuestra",
    privacy: "política de privacidad",
    and: "y en la",
    cookies: "política de cookies",
    onlyNeeded: "Solo necesarias",
    accept: "Aceptar",
  },
  fr: {
    short: "Nous utilisons des cookies techniques et d'analyse anonyme.",
    text: "Nous utilisons des cookies techniques pour le bon fonctionnement du site et, le cas échéant, des outils d'analyse anonyme. Plus d'informations dans notre",
    privacy: "politique de confidentialité",
    and: "et dans la",
    cookies: "politique de cookies",
    onlyNeeded: "Uniquement nécessaires",
    accept: "Accepter",
  },
  en: {
    short: "We use technical and anonymous analytics cookies.",
    text: "We use technical cookies for the website to work properly and, where applicable, anonymous usage analytics tools. You can find more information in our",
    privacy: "privacy policy",
    and: "and in our",
    cookies: "cookie policy",
    onlyNeeded: "Only essential",
    accept: "Accept",
  },
  de: {
    short: "Wir verwenden technische und anonyme Analyse-Cookies.",
    text: "Wir verwenden technische Cookies für das ordnungsgemäße Funktionieren der Website und gegebenenfalls Tools zur anonymen Nutzungsanalyse. Weitere Informationen finden Sie in unserer",
    privacy: "Datenschutzerklärung",
    and: "und in der",
    cookies: "Cookie-Richtlinie",
    onlyNeeded: "Nur notwendige",
    accept: "Akzeptieren",
  },
  pt: {
    short: "Utilizamos cookies técnicos e de análise anónima.",
    text: "Utilizamos cookies técnicos para o correto funcionamento do site e, quando aplicável, ferramentas de análise anónima de utilização. Pode obter mais informação na nossa",
    privacy: "política de privacidade",
    and: "e na",
    cookies: "política de cookies",
    onlyNeeded: "Apenas necessárias",
    accept: "Aceitar",
  },
} as const;

export function CookieBanner() {
  const c = CB[useUiLang()];
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (!value) {
      setVisible(true);
      document.body.classList.add("cookie-banner-visible");
    }
  }, []);

  // While it is shown the page keeps its own height free at the bottom, so it never covers the upload button.
  useEffect(() => {
    const el = ref.current;
    if (!visible || !el) return;
    const root = document.documentElement;
    const sync = () => root.style.setProperty("--cookie-h", `${el.offsetHeight}px`);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--cookie-h");
    };
  }, [visible]);

  const dismiss = (consent: "accepted" | "essential") => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, consent);
    }
    document.body.classList.remove("cookie-banner-visible");
    setVisible(false);
  };

  if (!visible) return null;

  const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bleu-light";
  return (
    <div ref={ref} role="region" aria-label="Cookies" className="fixed bottom-0 left-0 right-0 z-40 border-t border-cream bg-card/95 px-4 py-2 text-xs text-sepia shadow-[0_-4px_12px_rgba(28,25,23,0.1)] sm:py-3">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <p className="min-w-0 max-w-3xl">
          <span className="sm:hidden">{c.short}{" "}</span>
          <span className="hidden sm:inline">{c.text}{" "}
            <a href="/privacidad" className={`font-semibold text-bleu underline ${focus}`}>{c.privacy}</a>{" "}
            {c.and}{" "}
          </span>
          <a href="/politica-de-cookies" className={`font-semibold text-bleu underline ${focus}`}>{c.cookies}</a>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => dismiss("essential")}
            className={`min-h-11 rounded-2xl border border-cream bg-card px-3 text-xs font-semibold text-sepia hover:bg-cream sm:px-4 ${focus}`}
          >
            {c.onlyNeeded}
          </button>
          <button
            type="button"
            onClick={() => dismiss("accepted")}
            className={`min-h-11 rounded-2xl bg-bleu px-3 text-xs font-semibold text-parchment hover:bg-bleu-dark sm:px-4 ${focus}`}
          >
            {c.accept}
          </button>
        </div>
      </div>
    </div>
  );
}
