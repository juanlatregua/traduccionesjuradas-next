"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "tj_cookie_consent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (!value) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const accept = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, "accepted");
    }
    setVisible(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-cream bg-card/95 px-4 py-3 text-xs text-sepia shadow-[0_-4px_12px_rgba(28,25,23,0.1)]">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-3xl">
          Utilizamos cookies técnicas para el correcto funcionamiento de la web
          y, en su caso, herramientas de análisis anónimo de uso. Puedes obtener
          más información en nuestra{" "}
          <a
            href="/privacidad"
            className="font-semibold text-bleu hover:underline"
          >
            política de privacidad
          </a>{" "}
          y en la{" "}
          <a
            href="/politica-de-cookies"
            className="font-semibold text-bleu hover:underline"
          >
            política de cookies
          </a>
          .
        </p>
        <button
          onClick={accept}
          className="mt-1 rounded-2xl bg-bleu px-4 py-2 text-[11px] font-semibold text-parchment hover:bg-bleu-dark sm:mt-0"
        >
          Aceptar
        </button>
      </div>
    </div>
  );
}
