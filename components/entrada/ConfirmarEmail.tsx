"use client";

import { useEffect, useState } from "react";

// The one-time link is spent only when the person presses the button: mail scanners that open the page do not press it.
const T = {
  es: { idle: "Pulsa para confirmar tu email.", btn: "Confirmar mi email", wait: "Confirmando tu email…", ok: "Listo, tu email está confirmado. Vuelve a la pestaña donde estabas: sigue sola.", here: "Seguir aquí", bad: "Este enlace ya no vale (caduca a los 10 minutos y sirve una vez). Escribe el código en la web o pide otro." },
  fr: { idle: "Appuyez pour confirmer votre e-mail.", btn: "Confirmer mon e-mail", wait: "Confirmation de votre e-mail…", ok: "C'est fait, votre e-mail est confirmé. Revenez à l'onglet où vous étiez : il continue seul.", here: "Continuer ici", bad: "Ce lien n'est plus valable (10 minutes, une seule fois). Saisissez le code sur le site ou demandez-en un autre." },
  en: { idle: "Press to confirm your email.", btn: "Confirm my email", wait: "Confirming your email…", ok: "Done, your email is confirmed. Go back to the tab you were on: it carries on by itself.", here: "Continue here", bad: "This link is no longer valid (10 minutes, one use). Type the code on the website or ask for another." },
  de: { idle: "Tippen Sie, um Ihre E-Mail zu bestätigen.", btn: "E-Mail bestätigen", wait: "E-Mail wird bestätigt…", ok: "Erledigt, Ihre E-Mail ist bestätigt. Gehen Sie zurück zum vorherigen Tab: Er macht von selbst weiter.", here: "Hier weitermachen", bad: "Dieser Link ist nicht mehr gültig (10 Minuten, einmalig). Geben Sie den Code auf der Website ein oder fordern Sie einen neuen an." },
  pt: { idle: "Toque para confirmar seu e-mail.", btn: "Confirmar meu e-mail", wait: "Confirmando seu e-mail…", ok: "Pronto, seu e-mail está confirmado. Volte à aba onde estava: ela continua sozinha.", here: "Continuar aqui", bad: "Este link não vale mais (10 minutos, uma vez). Digite o código no site ou peça outro." },
} as const;

export default function ConfirmarEmail({ k }: { k: string }) {
  const [state, setState] = useState<"idle" | "wait" | "ok" | "bad">("idle");
  const [lang, setLang] = useState<keyof typeof T>("es");
  const t = T[lang] ?? T.es;
  const [sameBrowser, setSameBrowser] = useState(false);

  useEffect(() => {
    const l = navigator.language.slice(0, 2) as keyof typeof T;
    if (l in T) setLang(l);
    try {
      setSameBrowser(Boolean(localStorage.getItem("tj-entrada")));
    } catch {}
  }, []);

  function confirm() {
    if (state !== "idle") return;
    setState("wait");
    fetch("/api/entrada/confirmar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ k }) })
      .then((r) => setState(r.ok ? "ok" : "bad"))
      .catch(() => setState("bad"));
  }

  return (
    <div className="space-y-4 rounded-2xl bg-white p-6 shadow-sm" role="status" aria-live="polite">
      <p className="text-lg text-encre">{t[state]}</p>
      {state === "idle" && <button type="button" onClick={confirm} className="inline-block rounded-full bg-bleu px-5 py-2 font-semibold text-white">{t.btn}</button>}
      {state === "ok" && sameBrowser && (
        <a href="/presupuesto-instantaneo" className="inline-block rounded-full bg-bleu px-5 py-2 font-semibold text-white">{t.here}</a>
      )}
    </div>
  );
}
