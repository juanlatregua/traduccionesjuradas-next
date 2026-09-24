"use client";

// components/ia/LectorRequerimientos.tsx — Orquesta el lector de requerimientos:
// subir carta (DocumentUploader, reusado) → POST /api/requirements/analyze →
// RequirementsResult. Maneja loading, error y estado degradado (cap lleno).

import { useState } from "react";
import { Loader2, AlertCircle, MessageCircle, RefreshCw } from "lucide-react";
import DocumentUploader from "@/components/ia/DocumentUploader";
import RequirementsResult from "@/components/ia/RequirementsResult";
import { lectorT } from "@/lib/i18n/lector";
import type { Locale } from "@/lib/i18n/locales";
import type { RequirementsExtraction } from "@/lib/ai/requirements";

type Status = "idle" | "analyzing" | "done" | "error" | "cap";

export default function LectorRequerimientos({ lang }: { lang: Locale }) {
  const t = lectorT[lang];
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [gdprConsent, setGdprConsent] = useState(false);
  // Puerta (Juan, 24-sep): email antes de subir; el servidor (register +
  // requirements/analyze) lo exige también.
  const [email, setEmail] = useState("");
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const [status, setStatus] = useState<Status>("idle");
  const [requirements, setRequirements] = useState<RequirementsExtraction | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);

  async function handleUploadComplete(docId: string, token: string) {
    setSessionToken(token);
    setStatus("analyzing");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/requirements/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: docId, sessionToken: token, lang }),
      });
      const data = await res.json();
      if (data.ok) {
        setRequirements(data.requirements);
        setStatus("done");
      } else if (data.capReached) {
        setWhatsappUrl(data.whatsappUrl || null);
        setStatus("cap");
      } else {
        setErrorMsg(data.error || null);
        setWhatsappUrl(data.whatsappUrl || null);
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  function reset() {
    setStatus("idle");
    setRequirements(null);
    setErrorMsg(null);
    setWhatsappUrl(null);
  }

  if (status === "done" && requirements) {
    return <RequirementsResult requirements={requirements} lang={lang} onReset={reset} />;
  }

  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-cream bg-card p-5 shadow-paper sm:p-7">
      <h2 className="font-baskerville text-xl font-bold text-encre">{t.uploadHeading}</h2>

      {status === "idle" && (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-bleu/15 bg-parchment p-4">
            <label htmlFor="lector-email" className="text-sm font-semibold text-encre">
              {t.emailLabel}
            </label>
            <p className="mt-1 text-xs text-graphite">{t.emailHelp}</p>
            <input
              id="lector-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@correo.com"
              className="mt-2 w-full rounded-lg border border-graphite/20 bg-white px-3 py-2 text-sm text-encre outline-none focus:border-bleu focus:ring-1 focus:ring-bleu/20 sm:max-w-sm"
            />
          </div>
          <DocumentUploader
            lang={lang}
            sessionToken={sessionToken}
            onSessionToken={setSessionToken}
            gdprConsent={gdprConsent}
            onGdprConsentChange={setGdprConsent}
            onUploadComplete={(docId, token) => handleUploadComplete(docId, token)}
            source="lector"
            clientEmail={emailValid ? email.trim().toLowerCase() : null}
            disabled={!emailValid}
            disabledReason={t.emailLocked}
          />
          {!emailValid && <p className="text-xs text-graphite">{t.emailLocked}</p>}
        </div>
      )}

      {status === "analyzing" && (
        <div className="mt-6 flex flex-col items-center gap-3 py-10 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-bleu" />
          <p className="font-baskerville text-lg text-bleu">{t.analyzing}</p>
        </div>
      )}

      {status === "cap" && (
        <div className="mt-6 rounded-xl border border-or/40 bg-or-light/30 p-5 text-center">
          <p className="font-baskerville text-lg font-bold text-encre">{t.capTitle}</p>
          <p className="mt-1 text-sm text-sepia">{t.capBody}</p>
          <a
            href={whatsappUrl || "https://wa.me/34951333614"}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-or px-5 py-2.5 text-sm font-semibold text-encre transition hover:bg-or-dark hover:text-white"
          >
            <MessageCircle className="h-4 w-4" />
            {t.whatsappCta}
          </a>
        </div>
      )}

      {status === "error" && (
        <div className="mt-6 rounded-xl border border-rouge/25 bg-rouge/5 p-5 text-center">
          <AlertCircle className="mx-auto h-7 w-7 text-rouge" />
          <p className="mt-2 font-baskerville text-lg font-bold text-encre">{t.errorTitle}</p>
          {errorMsg && <p className="mt-1 text-sm text-sepia">{errorMsg}</p>}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-xl border border-bleu/30 px-4 py-2 text-sm font-semibold text-bleu transition hover:bg-bleu/5"
            >
              <RefreshCw className="h-4 w-4" />
              {t.retry}
            </button>
            <a
              href={whatsappUrl || "https://wa.me/34951333614"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-or px-4 py-2 text-sm font-semibold text-encre transition hover:bg-or-dark hover:text-white"
            >
              <MessageCircle className="h-4 w-4" />
              {t.whatsappCta}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
