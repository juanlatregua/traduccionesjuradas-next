"use client";

// app/presupuesto-instantaneo/PuertaClient.tsx — La puerta (v2 · Fase 1)
// Entrada de documentos + fecha límite → diagnóstico completo → puente al
// checkout. Es el funnel canónico desde el Bloque 1.4.

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  CalendarClock,
  Plus,
  RotateCcw,
  MessageCircle,
  Loader2,
  AlertTriangle,
  Mail,
  Phone,
} from "lucide-react";
import type { DocumentAnalysisResult } from "@/lib/ai/analyze-document";
import type { Quote } from "@/lib/pricing-engine/calculator";
import { calculatePrice } from "@/lib/pricing-engine/calculator";
import { buildDiagnosis, type Diagnosis } from "@/lib/diagnosis";
import DiagnosisCard from "@/components/puerta/DiagnosisCard";
import DeadlineCountdown from "@/components/puerta/DeadlineCountdown";
import { puertaT, type PuertaLang } from "@/lib/i18n/puerta";

const DocumentUploader = dynamic(
  () => import("@/components/ia/DocumentUploader"),
  { ssr: false }
);
const DocumentAnalysis = dynamic(
  () => import("@/components/ia/DocumentAnalysis"),
  { ssr: false }
);

type Step = "entry" | "analyzing" | "diagnosis" | "error";

type DocEntry = {
  id: string;
  fileName: string;
  analysis: DocumentAnalysisResult;
  quote: Quote;
  diagnosis: Diagnosis;
};

function parseDateInput(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export default function PuertaClient({
  purpose,
  source,
  lang = "es",
}: {
  purpose: string | null;
  source?: string | null;
  lang?: PuertaLang;
}) {
  const t = puertaT[lang];
  const waUrl = `https://wa.me/34951333614?text=${encodeURIComponent(t.whatsappPrefill)}`;
  const [step, setStep] = useState<Step>("entry");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [gdprConsent, setGdprConsent] = useState(false);
  const [neededByInput, setNeededByInput] = useState("");
  const [documents, setDocuments] = useState<DocEntry[]>([]);
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [currentFileSize, setCurrentFileSize] = useState(0);
  const [currentFileName, setCurrentFileName] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const contactValid =
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) &&
    phone.replace(/\D/g, "").length >= 7;

  const neededBy = parseDateInput(neededByInput);
  const todayInput = new Date().toISOString().split("T")[0];

  const handleUploadComplete = useCallback(
    (docId: string, token: string, fileSize?: number, fileName?: string) => {
      setCurrentDocId(docId);
      setSessionToken(token);
      setCurrentFileSize(fileSize || 0);
      setCurrentFileName(fileName || "Documento");
      setStep("analyzing");
    },
    []
  );

  const handleAnalysisComplete = useCallback(
    (analysis: DocumentAnalysisResult, quote: Quote) => {
      if (!currentDocId) return;
      setDocuments((prev) => [
        ...prev,
        {
          id: currentDocId,
          fileName: currentFileName,
          analysis,
          quote,
          diagnosis: buildDiagnosis(analysis, quote, lang),
        },
      ]);
      setStep("diagnosis");
    },
    [currentDocId, currentFileName, lang]
  );

  const handleError = useCallback((error: string) => {
    setErrorMessage(error);
    setStep("error");
  }, []);

  const handleAddAnother = useCallback(() => {
    setCurrentDocId(null);
    setStep("entry");
  }, []);

  const handleReset = useCallback(() => {
    setStep("entry");
    setDocuments([]);
    setCurrentDocId(null);
    setErrorMessage(null);
  }, []);

  // Original en español: al elegir idioma de destino, recalcular precio y
  // reconstruir el diagnóstico de ese documento.
  const handlePickTargetLanguage = useCallback(
    (docId: string, target: string, targetName: string) => {
      setDocuments((prev) =>
        prev.map((doc) => {
          if (doc.id !== docId) return doc;
          const analysis: DocumentAnalysisResult = {
            ...doc.analysis,
            language: {
              ...doc.analysis.language,
              target,
              target_name: targetName,
            },
          };
          const quote = calculatePrice(analysis);
          return {
            ...doc,
            analysis,
            quote,
            diagnosis: buildDiagnosis(analysis, quote, lang),
          };
        })
      );
    },
    [lang]
  );

  // El puente: crea la OrderSession checkout-ready y redirige al checkout.
  const handleCheckout = useCallback(async () => {
    setCheckingOut(true);
    setCheckoutError(null);
    try {
      const res = await fetch("/api/puerta/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: purpose || undefined,
          email: email.trim(),
          phone: phone.trim(),
          sessionToken,
          lang,
          documents: documents.map((d) => ({
            id: d.id,
            targetLanguage: d.analysis.language.target,
          })),
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setCheckoutError(data.error || t.checkoutErrorDefault);
        setCheckingOut(false);
        return;
      }
      window.location.href = "/checkout";
    } catch {
      setCheckoutError(t.checkoutErrorDefault);
      setCheckingOut(false);
    }
  }, [documents, purpose, email, phone, lang, sessionToken, t]);

  const total = documents.reduce((sum, d) => sum + d.diagnosis.price.total, 0);
  const pendingTargetLanguage = documents.some(
    (d) => d.diagnosis.delivery.hours === null
  );

  return (
    <div className="space-y-6">
      {/* ─── Entrada ─── */}
      {step === "entry" && (
        <>
          {documents.length === 0 && <DeadlineCountdown lang={lang} />}

          {documents.length === 0 && (
            <div className="rounded-xl border border-bleu/15 bg-card p-5 shadow-paper">
              <label
                htmlFor="needed-by"
                className="flex items-center gap-2 text-sm font-semibold text-encre"
              >
                <CalendarClock className="h-4 w-4 text-bleu" />
                {t.neededByLabel}
              </label>
              <p className="mt-1 text-xs text-graphite">{t.neededByHelp}</p>
              <input
                id="needed-by"
                type="date"
                min={todayInput}
                value={neededByInput}
                onChange={(e) => setNeededByInput(e.target.value)}
                className="mt-3 rounded-lg border border-graphite/20 bg-white px-3 py-2 text-sm text-encre outline-none focus:border-bleu focus:ring-1 focus:ring-bleu/20"
              />
            </div>
          )}

          <DocumentUploader
            onUploadComplete={handleUploadComplete}
            sessionToken={sessionToken}
            onSessionToken={setSessionToken}
            gdprConsent={gdprConsent}
            onGdprConsentChange={setGdprConsent}
            source={source}
            lang={lang}
          />
        </>
      )}

      {/* ─── Analizando ─── */}
      {step === "analyzing" && currentDocId && (
        <DocumentAnalysis
          documentId={currentDocId}
          sessionToken={sessionToken}
          fileSize={currentFileSize}
          onAnalysisComplete={handleAnalysisComplete}
          onError={handleError}
        />
      )}

      {/* ─── Diagnóstico ─── */}
      {step === "diagnosis" && documents.length > 0 && (
        <div className="space-y-5">
          {neededBy && (
            <p className="text-sm text-graphite">
              {t.neededForPrefix}{" "}
              <span className="font-medium text-encre">
                {neededBy.toLocaleDateString(t.locale, {
                  day: "numeric",
                  month: "long",
                })}
              </span>
              .
            </p>
          )}

          {documents.map((doc) => (
            <DiagnosisCard
              key={doc.id}
              diagnosis={doc.diagnosis}
              fileName={doc.fileName}
              confidence={doc.analysis.document_type.confidence}
              neededBy={neededBy}
              lang={lang}
              onPickTargetLanguage={(code, name) =>
                handlePickTargetLanguage(doc.id, code, name)
              }
            />
          ))}

          {documents.length > 1 && (
            <div className="flex items-center justify-between rounded-xl border border-bleu/15 bg-cream px-5 py-4">
              <span className="text-sm font-medium text-encre">
                {t.totalLabel(documents.length)}
              </span>
              <span className="font-baskerville text-2xl font-bold text-bleu">
                {total.toFixed(2)} €
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleAddAnother}
              className="inline-flex items-center gap-1.5 rounded-lg border border-bleu/20 px-4 py-2.5 text-sm font-medium text-bleu transition-colors hover:bg-bleu/5"
            >
              <Plus className="h-4 w-4" />
              {t.addAnother}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 text-sm text-graphite transition-colors hover:text-bleu"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t.startOver}
            </button>
          </div>

          {/* Puente al checkout */}
          <div className="rounded-xl border border-bleu/15 bg-card p-5 shadow-paper">
            <p className="text-sm font-semibold text-encre">{t.contactTitle}</p>
            <p className="mt-1 text-xs text-graphite">{t.contactHelp}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded-lg border border-graphite/20 bg-white px-3 py-2 focus-within:border-bleu focus-within:ring-1 focus-within:ring-bleu/20">
                <Mail className="h-4 w-4 shrink-0 text-bleu" />
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder={t.emailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent text-sm text-encre outline-none"
                />
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-graphite/20 bg-white px-3 py-2 focus-within:border-bleu focus-within:ring-1 focus-within:ring-bleu/20">
                <Phone className="h-4 w-4 shrink-0 text-bleu" />
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder={t.phonePlaceholder}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-transparent text-sm text-encre outline-none"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={handleCheckout}
              disabled={checkingOut || pendingTargetLanguage || !contactValid}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-bleu px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-bleu/90 disabled:opacity-50"
            >
              {checkingOut && <Loader2 className="h-4 w-4 animate-spin" />}
              {checkingOut ? t.preparingPay : t.continuePay}
            </button>
            {pendingTargetLanguage && (
              <p className="mt-2 text-center text-xs text-graphite">{t.hintTargetLang}</p>
            )}
            {!pendingTargetLanguage && !contactValid && (
              <p className="mt-2 text-center text-xs text-graphite">{t.hintContact}</p>
            )}
            {checkoutError && (
              <p className="mt-2 flex items-start justify-center gap-1.5 text-center text-xs text-rouge">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {checkoutError}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ─── Error ─── */}
      {step === "error" && (
        <div className="rounded-xl border border-rouge/20 bg-card p-6 text-center shadow-paper">
          <p className="font-baskerville text-xl text-rouge">{t.errorTitle}</p>
          <p className="mt-2 text-sm text-graphite">
            {errorMessage || t.errorDefault}
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-lg border border-bleu/20 px-5 py-2.5 text-sm font-medium text-bleu transition-colors hover:bg-bleu/5"
            >
              <RotateCcw className="h-4 w-4" />
              {t.retry}
            </button>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-vert px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-vert/90"
            >
              <MessageCircle className="h-4 w-4" />
              {t.contactWhatsApp}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
