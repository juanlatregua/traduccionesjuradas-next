"use client";

import { useEffect, useRef, useState } from "react";
import { publicDict, type PublicLang } from "@/lib/quote-public-i18n";

type Props = {
  token: string;
  lang?: PublicLang;
  // ?paso=justificante: foco en el botón. No crea nada al cargar (los escáneres
  // de correo abren URLs): el cliente sigue pulsando.
  focus?: boolean;
  // line: frase compacta bajo el resumen; button: botón secundario dentro de las pestañas Bizum/Transferencia.
  variant?: "line" | "button";
};

// "Ya he pagado": crea la cáscara del pedido SIN cobro y lleva a su pantalla de
// pago, que tiene el formulario del justificante. Vale para Bizum y
// transferencia; lo valida el staff a mano. Va arriba de /q (línea compacta) y
// también dentro de las pestañas Bizum y Transferencia.
export default function QuoteProofCta({ token, lang = "es", focus = false, variant = "line" }: Props) {
  const t = publicDict(lang);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [declaring, setDeclaring] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!focus) return;
    buttonRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    buttonRef.current?.focus({ preventScroll: true });
  }, [focus]);

  async function declareTransfer() {
    setDeclaring(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/quotes/public/${token}/declare-transfer`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data?.ok || !data?.url) {
        throw new Error(data?.error || t.errContinue);
      }
      window.location.href = data.url;
    } catch (err: any) {
      setMessage(err?.message || t.errContinue);
      setDeclaring(false);
    }
  }

  const errId = `proof-err-${variant}`;
  const err = message && (
    <p id={errId} role="alert" className="mt-1 text-xs font-semibold text-red-700">
      {message}
    </p>
  );

  if (variant === "button") {
    return (
      <div>
        <button
          type="button"
          onClick={declareTransfer}
          disabled={declaring}
          aria-describedby={message ? errId : undefined}
          className="min-h-[44px] w-full rounded-xl border border-bleu/40 bg-white px-4 py-2.5 text-sm font-semibold text-bleu hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bleu disabled:cursor-not-allowed disabled:opacity-60"
        >
          {declaring ? t.oneMoment : t.alreadyTransferredCta}
        </button>
        {err}
      </div>
    );
  }

  return (
    <div className={`mt-3 text-sm text-sepia ${focus ? "rounded-lg ring-4 ring-bleu/15" : ""}`}>
      {t.proofLinePre}{" "}
      <button
        ref={buttonRef}
        type="button"
        onClick={declareTransfer}
        disabled={declaring}
        aria-describedby={message ? errId : undefined}
        className="min-h-[44px] font-semibold text-bleu underline underline-offset-2 hover:text-bleu-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bleu disabled:opacity-60 sm:min-h-0"
      >
        {declaring ? t.oneMoment : t.proofLineLink}
      </button>
      {err}
    </div>
  );
}
