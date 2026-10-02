"use client";

import { useEffect, useRef, useState } from "react";
import { publicDict, type PublicLang } from "@/lib/quote-public-i18n";

type Props = {
  token: string;
  lang?: PublicLang;
  // ?paso=justificante: foco en el botón. No crea nada al cargar (los escáneres
  // de correo abren URLs): el cliente sigue pulsando.
  focus?: boolean;
};

// "Ya he pagado": crea la cáscara del pedido SIN cobro y lleva a su pantalla de
// pago, que tiene el formulario del justificante. Vale para Bizum y
// transferencia; lo valida el staff a mano. Va arriba de /q y no dentro de una
// pestaña: en móvil la columna de pago queda bajo la tabla y no se encontraba.
export default function QuoteProofCta({ token, lang = "es", focus = false }: Props) {
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

  return (
    <div className={`mt-4 rounded-xl border-2 border-bleu bg-bleu/5 p-4 ${focus ? "ring-4 ring-bleu/15" : ""}`}>
      <p className="text-sm font-semibold text-encre">{t.proofStepTitle}</p>
      <p className="mt-1 text-xs text-graphite">{t.proofStepHelp}</p>
      <button
        ref={buttonRef}
        type="button"
        onClick={declareTransfer}
        disabled={declaring}
        className="mt-3 w-full rounded-xl bg-bleu px-4 py-3 text-sm font-semibold text-white hover:bg-bleu-dark disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {declaring ? t.oneMoment : t.alreadyTransferredCta}
      </button>
      {message && <p className="mt-2 text-xs font-semibold text-red-700">{message}</p>}
    </div>
  );
}
