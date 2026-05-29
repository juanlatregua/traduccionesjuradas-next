"use client";

import { useEffect, useState } from "react";
import { useUiLang } from "@/lib/i18n/use-ui-lang";

const STORAGE_KEY = "tj_cookie_consent";

const CB = {
  es: {
    text: "Utilizamos cookies técnicas para el correcto funcionamiento de la web y, en su caso, herramientas de análisis anónimo de uso. Puedes obtener más información en nuestra",
    privacy: "política de privacidad",
    and: "y en la",
    cookies: "política de cookies",
    onlyNeeded: "Solo necesarias",
    accept: "Aceptar",
  },
  fr: {
    text: "Nous utilisons des cookies techniques pour le bon fonctionnement du site et, le cas échéant, des outils d'analyse anonyme. Plus d'informations dans notre",
    privacy: "politique de confidentialité",
    and: "et dans la",
    cookies: "politique de cookies",
    onlyNeeded: "Uniquement nécessaires",
    accept: "Accepter",
  },
} as const;

export function CookieBanner() {
  const c = CB[useUiLang()];
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (!value) {
      setVisible(true);
      document.body.classList.add("cookie-banner-visible");
    }
  }, []);

  const dismiss = (consent: "accepted" | "essential") => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, consent);
    }
    document.body.classList.remove("cookie-banner-visible");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-cream bg-card/95 px-4 py-3 text-xs text-sepia shadow-[0_-4px_12px_rgba(28,25,23,0.1)]">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-3xl">
          {c.text}{" "}
          <a
            href="/privacidad"
            className="font-semibold text-bleu hover:underline"
          >
            {c.privacy}
          </a>{" "}
          {c.and}{" "}
          <a
            href="/politica-de-cookies"
            className="font-semibold text-bleu hover:underline"
          >
            {c.cookies}
          </a>
          .
        </p>
        <div className="mt-1 flex gap-2 sm:mt-0">
          <button
            onClick={() => dismiss("essential")}
            className="rounded-2xl border border-cream bg-card px-4 py-2 text-[11px] font-semibold text-sepia hover:bg-cream"
          >
            {c.onlyNeeded}
          </button>
          <button
            onClick={() => dismiss("accepted")}
            className="rounded-2xl bg-bleu px-4 py-2 text-[11px] font-semibold text-parchment hover:bg-bleu-dark"
          >
            {c.accept}
          </button>
        </div>
      </div>
    </div>
  );
}
