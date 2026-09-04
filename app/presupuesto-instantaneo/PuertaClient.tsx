"use client";

// app/presupuesto-instantaneo/PuertaClient.tsx — La puerta (v2 · Fase 1)
// Entrada de documentos + fecha límite → diagnóstico completo → puente al
// checkout. Es el funnel canónico desde el Bloque 1.4.

import { useState, useCallback, useEffect } from "react";
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
  CheckCircle2,
} from "lucide-react";
import type { DocumentAnalysisResult } from "@/lib/ai/analyze-document";
import type { Quote } from "@/lib/pricing-engine/calculator";
import { calculatePrice } from "@/lib/pricing-engine/calculator";
import { buildDiagnosis, type Diagnosis } from "@/lib/diagnosis";
import DiagnosisCard from "@/components/puerta/DiagnosisCard";
import DeadlineCountdown from "@/components/puerta/DeadlineCountdown";
import { puertaT, type PuertaLang } from "@/lib/i18n/puerta";
import { PUERTA_LANG_CODES, isDeclaredPairValid } from "@/lib/puerta-languages";

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
  defaultSourceLang = null,
}: {
  // Página de idioma (p.ej. /traductor-jurado-frances): el idioma del documento
  // viene dado y el destino por defecto es español.
  defaultSourceLang?: string | null;
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
  const [requestState, setRequestState] = useState<"idle" | "sending" | "done">("idle");
  const [requestDoneMsg, setRequestDoneMsg] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  // Consentimiento SEPARADO del de la subida (que solo cubre tratar los
  // documentos). Sin él no se guarda el email ni se envía nada: LSSI art. 21.1.
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [contactSaved, setContactSaved] = useState(false);
  // Par de idiomas DECLARADO antes de subir (Juan, 4-sep-2026: "no se puede
  // subir nada sin antes poner email, lenguas"). Los originales en español
  // llegaban como es→unknown y el presupuesto se quedaba a medias.
  const presetSrc = defaultSourceLang && PUERTA_LANG_CODES.includes(defaultSourceLang as any) ? defaultSourceLang : "";
  const [srcLang, setSrcLang] = useState<string>(presetSrc);
  const [tgtLang, setTgtLang] = useState<string>(presetSrc && presetSrc !== "es" ? "es" : "");
  const pickSource = (code: string) => {
    setSrcLang(code);
    // Documento en otro idioma → casi siempre se necesita en español.
    if (code && code !== "es" && (!tgtLang || tgtLang === code)) setTgtLang("es");
    if (code === "es" && tgtLang === "es") setTgtLang("");
  };
  const pairValid = isDeclaredPairValid(srcLang, tgtLang);
  const samePair = Boolean(srcLang && tgtLang && srcLang === tgtLang);
  const [savingContact, setSavingContact] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [deliveryType, setDeliveryType] = useState<"pdf" | "paper">("pdf");
  const [ship, setShip] = useState({ name: "", address: "", city: "", province: "", postalCode: "" });

  const PAPER_SURCHARGE = 12; // € (sin IVA; el total ya lo lleva con su IVA)
  const shippingValid =
    deliveryType === "pdf" ||
    (ship.name.trim() &&
      ship.address.trim() &&
      ship.city.trim() &&
      ship.province.trim() &&
      /^\d{4,10}$/.test(ship.postalCode.trim()));

  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const entryReady = emailValid && marketingConsent && pairValid;

  const contactValid =
    emailValid &&
    phone.replace(/\D/g, "").length >= 7 &&
    !!shippingValid;

  const neededBy = parseDateInput(neededByInput);
  const todayInput = new Date().toISOString().split("T")[0];

  const handleUploadComplete = useCallback(
    (docId: string, token: string, fileSize?: number, fileName?: string) => {
      setCurrentDocId(docId);
      setSessionToken(token);
      setCurrentFileSize(fileSize || 0);
      setCurrentFileName(fileName || "Documento");
      // El email y el consentimiento ya viajaron en el registro del documento.
      setContactSaved(true);
      setStep("analyzing");
    },
    []
  );

  // El análisis puede terminar antes de que el usuario acabe de teclear el
  // email. En vez de saltar al diagnóstico y perder el lead, se guarda el
  // resultado en espera y se revela al confirmar el contacto (o directamente,
  // si ya lo confirmó mientras giraba el spinner).
  const [pending, setPending] = useState<DocEntry | null>(null);

  const revealDocument = useCallback((entry: DocEntry) => {
    setDocuments((prev) => [...prev, entry]);
    setPending(null);
    setStep("diagnosis");
  }, []);

  // El resultado SIEMPRE se aparca en `pending`; quien decide revelarlo es el
  // efecto de abajo. DocumentAnalysis lanza su fetch en un efecto con deps
  // [documentId] (components/ia/DocumentAnalysis.tsx:151), así que se queda con
  // el callback del PRIMER render: si aquí se leyera `contactSaved`, el valor
  // sería el de entonces (false) aunque el usuario ya hubiera dado el email
  // mientras giraba el spinner — y el resultado se quedaba aparcado para
  // siempre con el formulario ya oculto: pantalla vacía.
  const handleAnalysisComplete = useCallback(
    (analysis: DocumentAnalysisResult, quote: Quote) => {
      if (!currentDocId) return;
      setPending({
        id: currentDocId,
        fileName: currentFileName,
        analysis,
        quote,
        diagnosis: buildDiagnosis(analysis, quote, lang),
      });
    },
    [currentDocId, currentFileName, lang]
  );

  // Hay resultado y hay contacto: se revela, llegue en el orden que llegue.
  useEffect(() => {
    if (pending && contactSaved) revealDocument(pending);
  }, [pending, contactSaved, revealDocument]);

  const handleSaveContact = useCallback(async () => {
    if (!emailValid || !marketingConsent || !sessionToken) return;
    setSavingContact(true);
    setContactError(null);
    try {
      const res = await fetch("/api/documents/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionToken,
          clientEmail: email.trim(),
          marketingConsent: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "");
      setContactSaved(true);
      // Si el análisis ya terminó mientras tecleaba, revélalo ahora.
      if (pending) revealDocument(pending);
    } catch {
      // No bloquear el presupuesto por un fallo de guardado: el usuario ya hizo
      // su parte y el documento está analizado. Se revela igual.
      setContactError(t.checkoutErrorDefault);
      setContactSaved(true);
      if (pending) revealDocument(pending);
    } finally {
      setSavingContact(false);
    }
  }, [emailValid, marketingConsent, sessionToken, email, pending, revealDocument, t]);

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
    setRequestState("idle");
    setCheckoutError(null);
    setPending(null);
    // Y SE SUELTA LA SESIÓN. Vaciar solo la lista del cliente dejaba vivo el
    // sessionToken, y la solicitud de presupuesto pide TODOS los documentos de
    // esa sesión (api/puerta/request-quote): quien pulsaba «empezar de nuevo» y
    // subía otro documento mandaba también el que había descartado. El registro
    // crea un token nuevo cuando no se le pasa ninguno (documents/register:52).
    setSessionToken(null);
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

  // Solicitud de presupuesto humano (24-ago): idiomas sin precio instantáneo,
  // documentos de riesgo y tickets altos. Avisa a staff y acusa al cliente.
  const handleRequestQuote = useCallback(async () => {
    setRequestState("sending");
    setCheckoutError(null);
    try {
      const res = await fetch("/api/puerta/request-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionToken,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          lang,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setRequestState("idle");
        setCheckoutError(data.error || t.checkoutErrorDefault);
        return;
      }
      if (data.quote?.sent) {
        // Agente de precios: el presupuesto ya salió con precio cerrado.
        setRequestDoneMsg(t.requestQuoteDoneAuto);
      } else if (data.lavori?.sent && data.lavori.lang) {
        let langName = String(data.lavori.langName || data.lavori.lang);
        try {
          langName = new Intl.DisplayNames([lang], { type: "language" }).of(data.lavori.lang) || langName;
        } catch {}
        setRequestDoneMsg(t.requestQuoteDoneLavori.replace("{lang}", langName));
      } else {
        setRequestDoneMsg(null);
      }
      setRequestState("done");
    } catch {
      setRequestState("idle");
      setCheckoutError(t.checkoutErrorDefault);
    }
  }, [sessionToken, email, phone, lang, t]);

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
          deliveryType,
          shipping: deliveryType === "paper" ? ship : undefined,
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
  }, [documents, purpose, email, phone, lang, sessionToken, deliveryType, ship, t]);

  const docsTotal = documents.reduce((sum, d) => sum + d.diagnosis.price.total, 0);
  // El recargo de papel (12 € + IVA) se muestra aquí; el servidor lo recalcula.
  const paperTotal = deliveryType === "paper" ? PAPER_SURCHARGE * 1.21 : 0;
  const total = docsTotal + paperTotal;
  // Documento de riesgo (fiscal/multi-copia): bloquea el pago igual que un idioma
  // no soportado, pero NO es "falta idioma" → su mensaje lo da la DiagnosisCard.
  const hasRiskyDoc = documents.some((d) => d.diagnosis.priceRisky);
  const pendingTargetLanguage = documents.some(
    (d) => !d.diagnosis.priceRisky && d.diagnosis.askTargetLanguage
  );
  // Escaparate 24-ago: idioma sin precio instantáneo (todo salvo fr) → sin
  // checkout; el CTA pasa a "Solicitar presupuesto" (lo cotiza el traductor).
  const hasHumanQuoteDoc = documents.some(
    (d) => !d.diagnosis.priceRisky && !d.diagnosis.askTargetLanguage && !d.diagnosis.publicAutoPriceable
  );
  const humanQuoteFlow = hasHumanQuoteDoc || hasRiskyDoc;
  const blockCheckout = pendingTargetLanguage || humanQuoteFlow;
  // Ticket alto (>70 € netos): el autopago no convierte ahí (auditoría 24-ago:
  // cero pagos por encima); se ofrece ADEMÁS la confirmación del traductor.
  const bigTicket = !blockCheckout && docsTotal / 1.21 > 70;

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

          {/* Bloque OBLIGATORIO antes de subir (4-sep-2026). Antes la entrada
              era libre y el email se pedía en el spinner: llegaban presupuestos
              sin destino (es→unknown) y había que llamar para preguntarlo. */}
          <div className="rounded-xl border border-bleu/15 bg-card p-5 shadow-paper">
            <p className="flex items-center gap-2 text-sm font-semibold text-encre">
              <Mail className="h-4 w-4 text-bleu" />
              {t.entryTitle}
            </p>
            <p className="mt-1 text-xs text-graphite">{t.entryHelp}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-medium text-graphite">
                {t.entryEmailLabel}
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.emailPlaceholder}
                  className="mt-1 w-full rounded-lg border border-graphite/20 bg-white px-3 py-2 text-sm text-encre outline-none focus:border-bleu focus:ring-1 focus:ring-bleu/20"
                />
              </label>
              <label className="text-xs font-medium text-graphite">
                {t.entrySourceLabel}
                <select
                  value={srcLang}
                  onChange={(e) => pickSource(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-graphite/20 bg-white px-3 py-2 text-sm text-encre outline-none focus:border-bleu focus:ring-1 focus:ring-bleu/20"
                >
                  <option value="">{t.entryPickLang}</option>
                  {PUERTA_LANG_CODES.map((c) => (
                    <option key={c} value={c}>{t.langNames[c] || c}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-graphite">
                {t.entryTargetLabel}
                <select
                  value={tgtLang}
                  onChange={(e) => setTgtLang(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-graphite/20 bg-white px-3 py-2 text-sm text-encre outline-none focus:border-bleu focus:ring-1 focus:ring-bleu/20"
                >
                  <option value="">{t.entryPickLang}</option>
                  {PUERTA_LANG_CODES.map((c) => (
                    <option key={c} value={c}>{t.langNames[c] || c}</option>
                  ))}
                </select>
              </label>
            </div>
            {samePair && <p className="mt-2 text-xs text-rouge">{t.entrySamePair}</p>}
            <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-graphite">
              <input
                type="checkbox"
                checked={marketingConsent}
                onChange={(e) => setMarketingConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-graphite/30"
              />
              <span>{t.marketingConsent}</span>
            </label>
          </div>

          <DocumentUploader
            onUploadComplete={handleUploadComplete}
            sessionToken={sessionToken}
            onSessionToken={setSessionToken}
            gdprConsent={gdprConsent}
            onGdprConsentChange={setGdprConsent}
            source={source}
            lang={lang}
            disabled={!entryReady}
            disabledReason={t.entryLocked}
            clientEmail={email.trim()}
            marketingConsent={marketingConsent}
            sourceLanguage={srcLang}
            targetLanguage={tgtLang}
            gate="puerta"
          />
          {!entryReady && <p className="text-xs text-graphite">{t.entryLocked}</p>}
        </>
      )}

      {/* ─── Analizando ─── */}
      {step === "analyzing" && currentDocId && (
        <div className="space-y-5">
          {/* Mientras no haya resultado en espera, el spinner sigue vivo. Cuando
              lo hay pero falta el contacto, se anuncia que está listo: el
              momento de máxima motivación para dar el email. */}
          {!pending && (
            <DocumentAnalysis
              documentId={currentDocId}
              sessionToken={sessionToken}
              fileSize={currentFileSize}
              onAnalysisComplete={handleAnalysisComplete}
              onError={handleError}
            />
          )}

          {/* Red de seguridad: con resultado en espera Y contacto dado, este
              paso no pinta ni spinner ni formulario y quedaría VACÍO durante el
              frame que tarda el efecto en revelar. Nunca una pantalla en blanco. */}
          {pending && contactSaved && (
            <div className="flex items-center gap-2 rounded-xl border border-bleu/15 bg-card p-5 text-sm text-graphite shadow-paper">
              <Loader2 className="h-4 w-4 animate-spin text-bleu" />
              {t.spinnerEmailReady}
            </div>
          )}

          {/* El componente se desmonta al llegar el resultado (arriba), pero su
              petición ya terminó: no se cancela nada. */}
          {!contactSaved && (
            <div className="rounded-xl border border-bleu/15 bg-card p-5 shadow-paper">
              {pending && (
                <p className="mb-2 text-sm font-semibold text-bleu">{t.spinnerEmailReady}</p>
              )}
              <label
                htmlFor="spinner-email"
                className="flex items-center gap-2 text-sm font-semibold text-encre"
              >
                <Mail className="h-4 w-4 text-bleu" />
                {t.spinnerEmailTitle}
              </label>
              <p className="mt-1 text-xs text-graphite">{t.spinnerEmailHelp}</p>
              <input
                id="spinner-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.emailPlaceholder}
                className="mt-3 w-full rounded-lg border border-graphite/20 bg-white px-3 py-2 text-sm text-encre outline-none focus:border-bleu focus:ring-1 focus:ring-bleu/20 sm:max-w-sm"
              />

              {/* Casilla separada y NO premarcada: el consentimiento de la
                  subida solo cubre tratar los documentos, no enviar correo. */}
              <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-graphite">
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(e) => setMarketingConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-graphite/30"
                />
                <span>{t.marketingConsent}</span>
              </label>

              <button
                type="button"
                onClick={handleSaveContact}
                disabled={!emailValid || !marketingConsent || savingContact}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-bleu px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-bleu/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingContact && <Loader2 className="h-4 w-4 animate-spin" />}
                {t.spinnerSeeQuote}
              </button>
              {emailValid && !marketingConsent && (
                <p className="mt-2 text-xs text-graphite">{t.marketingRequired}</p>
              )}
              {contactError && <p className="mt-2 text-xs text-graphite">{contactError}</p>}
            </div>
          )}
        </div>
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

          {documents.length > 1 && !humanQuoteFlow && (
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

            {/* Tipo de entrega: PDF (gratis) o papel certificado (+12 €) */}
            <div className="mt-3">
              <p className="text-xs font-semibold text-encre">¿Cómo quieres la traducción?</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setDeliveryType("pdf")}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${deliveryType === "pdf" ? "border-bleu bg-bleu/5 text-encre" : "border-graphite/20 text-graphite hover:bg-cream"}`}
                >
                  <span className="font-semibold">PDF firmado</span>
                  <span className="block text-xs">Válido oficialmente · gratis</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryType("paper")}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${deliveryType === "paper" ? "border-bleu bg-bleu/5 text-encre" : "border-graphite/20 text-graphite hover:bg-cream"}`}
                >
                  <span className="font-semibold">En papel a tu casa</span>
                  <span className="block text-xs">Copia sellada por correo · +12 €</span>
                </button>
              </div>

              {deliveryType === "paper" && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <input className="rounded-lg border border-graphite/20 bg-white px-3 py-2 text-sm text-encre outline-none focus:border-bleu sm:col-span-2" placeholder="Nombre y apellidos" autoComplete="name" value={ship.name} onChange={(e) => setShip((s) => ({ ...s, name: e.target.value }))} />
                  <input className="rounded-lg border border-graphite/20 bg-white px-3 py-2 text-sm text-encre outline-none focus:border-bleu sm:col-span-2" placeholder="Dirección (calle, número, piso)" autoComplete="street-address" value={ship.address} onChange={(e) => setShip((s) => ({ ...s, address: e.target.value }))} />
                  <input className="rounded-lg border border-graphite/20 bg-white px-3 py-2 text-sm text-encre outline-none focus:border-bleu" placeholder="Ciudad" autoComplete="address-level2" value={ship.city} onChange={(e) => setShip((s) => ({ ...s, city: e.target.value }))} />
                  <input className="rounded-lg border border-graphite/20 bg-white px-3 py-2 text-sm text-encre outline-none focus:border-bleu" placeholder="Provincia" autoComplete="address-level1" value={ship.province} onChange={(e) => setShip((s) => ({ ...s, province: e.target.value }))} />
                  <input className="rounded-lg border border-graphite/20 bg-white px-3 py-2 text-sm text-encre outline-none focus:border-bleu" placeholder="Código postal" inputMode="numeric" autoComplete="postal-code" value={ship.postalCode} onChange={(e) => setShip((s) => ({ ...s, postalCode: e.target.value }))} />
                </div>
              )}
            </div>

            {deliveryType === "paper" && (
              <div className="mt-3 flex items-center justify-between rounded-lg border border-bleu/15 bg-cream px-4 py-2 text-sm">
                <span className="text-graphite">Total con envío en papel</span>
                <span className="font-baskerville text-lg font-bold text-bleu">{total.toFixed(2)} €</span>
              </div>
            )}

            {humanQuoteFlow ? (
              requestState === "done" ? (
                <p className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-vert/30 bg-vert/5 px-5 py-3 text-center text-sm font-medium text-vert">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {requestDoneMsg || t.requestQuoteDone}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestQuote}
                  disabled={requestState === "sending" || pendingTargetLanguage}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-bleu px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-bleu/90 disabled:opacity-50"
                >
                  {requestState === "sending" && <Loader2 className="h-4 w-4 animate-spin" />}
                  {requestState === "sending" ? t.requestQuoteSending : t.requestQuoteCta}
                </button>
              )
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={checkingOut || blockCheckout || !contactValid}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-bleu px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-bleu/90 disabled:opacity-50"
                >
                  {checkingOut && <Loader2 className="h-4 w-4 animate-spin" />}
                  {checkingOut ? t.preparingPay : t.continuePay}
                </button>
                {bigTicket &&
                  (requestState === "done" ? (
                    <p className="mt-2 flex items-center justify-center gap-2 text-center text-xs font-medium text-vert">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      {requestDoneMsg || t.requestQuoteDone}
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRequestQuote}
                      disabled={requestState === "sending"}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-bleu/20 px-5 py-2.5 text-sm font-medium text-bleu transition-colors hover:bg-bleu/5 disabled:opacity-50"
                    >
                      {requestState === "sending" && <Loader2 className="h-4 w-4 animate-spin" />}
                      {requestState === "sending" ? t.requestQuoteSending : t.preferHuman}
                    </button>
                  ))}
              </>
            )}
            {pendingTargetLanguage && (
              <p className="mt-2 text-center text-xs text-graphite">{t.hintTargetLang}</p>
            )}
            {!blockCheckout && !contactValid && (
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
          {/* El documento YA está en nuestra BD: que el fallo de la IA no pierda
              el lead (25-ago, Maider: la IA cayó por cuenta y ella se fue a por
              el email). Reusa el carril "Solicitar presupuesto" de la puerta. */}
          {sessionToken && (
            <div className="mx-auto mt-5 max-w-md rounded-lg border border-bleu/15 bg-cream/40 p-4 text-left">
              {requestState === "done" ? (
                <p className="text-sm font-medium text-vert">{requestDoneMsg || t.requestQuoteDone}</p>
              ) : (
                <>
                  <p className="text-sm text-encre">{t.errorAskHuman}</p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t.emailPlaceholder}
                      className="flex-1 rounded-lg border border-bleu/20 bg-white px-3 py-2 text-sm text-encre outline-none focus:border-bleu"
                    />
                    <button
                      type="button"
                      disabled={!emailValid || requestState === "sending"}
                      onClick={handleRequestQuote}
                      className="rounded-lg bg-bleu px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-bleu/90 disabled:opacity-50"
                    >
                      {requestState === "sending" ? t.requestQuoteSending : t.requestQuoteCta}
                    </button>
                  </div>
                  {checkoutError && <p className="mt-2 text-xs text-rouge">{checkoutError}</p>}
                </>
              )}
            </div>
          )}
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
