"use client";

import { useEffect, useRef, useState } from "react";
import {
  DOCUMENT_CATEGORIES,
  getEstimatedPrice,
  type LanguageConfig,
} from "@/lib/language-config";

type Step = 1 | 2 | 3;

type Props = {
  config: LanguageConfig;
};

export default function LanguageOfferPanel({ config }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [direction, setDirection] = useState(config.defaultPair);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [wordCount, setWordCount] = useState<number | null>(null);
  const [wordText, setWordText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [guestEmail, setGuestEmail] = useState("");
  const [urgencyNotes, setUrgencyNotes] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [estimationMeta, setEstimationMeta] = useState<Record<string, unknown> | null>(null);

  const idempotencyRef = useRef<string | null>(null);
  const [tracking, setTracking] = useState<{
    sourceRaw?: string;
    sourceChannel?: string;
    sourceAgent?: string;
    sourceCampaign?: string;
    sourceMedium?: string;
    sourceLanding?: string;
  }>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const srcRaw = (params.get("src") || params.get("utm_source") || "").trim().toLowerCase();
    const sourceChannel =
      srcRaw === "wa" || srcRaw === "whatsapp" || srcRaw.startsWith("whatsapp")
        ? "WHATSAPP"
        : undefined;
    setTracking({
      sourceRaw: srcRaw || undefined,
      sourceChannel,
      sourceAgent: (params.get("agent") || "").trim() || undefined,
      sourceCampaign: (params.get("campaign") || params.get("utm_campaign") || "").trim() || undefined,
      sourceMedium: (params.get("utm_medium") || "").trim() || undefined,
      sourceLanding: `${window.location.pathname}${window.location.search}`,
    });
  }, []);

  const estimate = wordCount != null ? getEstimatedPrice(direction, wordCount) : null;
  const guestEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim());

  const countWordsFromText = () => {
    const text = wordText.trim();
    if (!text) return;
    const words = text.split(/\s+/).filter(Boolean).length;
    setWordCount(words);
  };

  const estimateFromFile = async (f: File) => {
    setEstimating(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("langPair", direction);
      const res = await fetch("/api/estimador", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo analizar el archivo.");
      setWordCount(data.words || 0);
      setEstimationMeta({
        words: data.words,
        rate: data.rate,
        estimatedByPages: data.estimatedByPages,
        pageCount: data.pageCount,
        marginPct: data.marginPct,
        extractionMethod: data.extractionMethod,
        confidence: data.ai?.confidence,
        documentType: data.ai?.documentType,
        hasApostille: data.ai?.hasApostille,
        warnings: data.ai?.warnings,
      });
      setFile(f);
    } catch (err: any) {
      setError(err?.message || "No se pudo extraer el texto del archivo.");
    } finally {
      setEstimating(false);
    }
  };

  const goToStep2 = () => {
    if (!selectedCategory) {
      setError("Selecciona un tipo de documento.");
      return;
    }
    if (wordCount == null || wordCount < 1) {
      setError("Indica el numero de palabras o sube un archivo para estimarlas.");
      return;
    }
    setError(null);
    setStep(2);
  };

  const goToStep3 = () => {
    if (!file) {
      setError("Sube el documento original para continuar.");
      return;
    }
    setError(null);
    setStep(3);
  };

  const submitOrder = async () => {
    if (!guestEmailValid) {
      setError("Indica un email valido para continuar.");
      return;
    }
    setCheckoutLoading(true);
    setError(null);
    setNotice(null);
    try {
      const categoryLabel = DOCUMENT_CATEGORIES.find((c) => c.id === selectedCategory)?.label || selectedCategory;
      const title = `Traduccion jurada de ${config.name}: ${categoryLabel}`;

      if (!idempotencyRef.current) {
        idempotencyRef.current = `lang:${config.langCode}:${Date.now()}:${Math.random().toString(16).slice(2, 10)}`;
      }
      const idempotencyKey = idempotencyRef.current;

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          amountCents: estimate?.totalCents || 0,
          currency: "eur",
          title,
          source: "language-panel",
          langPair: direction,
          words: wordCount,
          pagesLabel: `${wordCount} palabras`,
          containsWordCountItem: true,
          reviewRequired: true,
          reviewReason: `Pedido de ${config.name} - precio estimado pendiente de confirmacion.`,
          urgencyNotes: urgencyNotes.trim() || undefined,
          estimationMeta: estimationMeta || undefined,
          sourceChannel: tracking.sourceChannel,
          sourceAgent: tracking.sourceAgent,
          sourceCampaign: tracking.sourceCampaign,
          sourceMedium: tracking.sourceMedium,
          sourceLanding: tracking.sourceLanding,
          guestEmail: guestEmail.trim().toLowerCase(),
          idempotencyKey,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok || !data?.order?.reference) {
        throw new Error(data?.error || "No se pudo crear el pedido.");
      }
      const orderReference = data.order.reference as string;

      if (file) {
        setNotice("Subiendo documento adjunto...");
        const fd = new FormData();
        fd.append("file", file);
        fd.append("clientEmail", guestEmail.trim().toLowerCase());
        const uploadRes = await fetch(`/api/orders/${orderReference}/documents`, {
          method: "POST",
          body: fd,
        });
        if (!uploadRes.ok) {
          const uploadData = await uploadRes.json().catch(() => ({}));
          throw new Error((uploadData as any)?.error || "No se pudo subir el documento.");
        }
      }

      setNotice("Pedido creado. Redirigiendo...");
      const params = new URLSearchParams();
      if (tracking.sourceRaw) params.set("src", tracking.sourceRaw);
      if (tracking.sourceAgent) params.set("agent", tracking.sourceAgent);

      if (data.nextStep === "WAIT_REVIEW") {
        params.set("ref", orderReference);
        params.set("amount", String(estimate?.totalCents || 0));
        params.set("title", title);
        window.location.assign(`/pedido-recibido?${params.toString()}`);
      } else {
        const qs = params.toString();
        window.location.assign(`/area-cliente/pedido/${orderReference}/pagar${qs ? `?${qs}` : ""}`);
      }
    } catch (err: any) {
      setNotice(null);
      setError(err?.message || "No se pudo crear el pedido.");
      idempotencyRef.current = null;
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        <span className={step >= 1 ? "text-emerald-700" : ""}>1. Documento</span>
        <span className="text-slate-300">/</span>
        <span className={step >= 2 ? "text-emerald-700" : ""}>2. Archivo</span>
        <span className="text-slate-300">/</span>
        <span className={step >= 3 ? "text-emerald-700" : ""}>3. Enviar</span>
      </div>

      {notice && (
        <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">
          {notice}
        </div>
      )}
      {error && (
        <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>
      )}

      {/* ═══ STEP 1: Select document + count words ═══ */}
      {step === 1 && (
        <div className="mt-5 space-y-5">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Traduccion jurada de {config.name}
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Selecciona el tipo de documento y calcula el precio estimado.
            </p>
          </div>

          {/* Direction */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Combinacion
            </label>
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => setDirection(config.defaultPair)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
                  direction === config.defaultPair
                    ? "bg-emerald-600 text-white"
                    : "border border-slate-200 text-slate-700"
                }`}
              >
                {config.nameEn} → Espanol
              </button>
              <button
                type="button"
                onClick={() => setDirection(config.reversePair)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
                  direction === config.reversePair
                    ? "bg-emerald-600 text-white"
                    : "border border-slate-200 text-slate-700"
                }`}
              >
                Espanol → {config.nameEn}
              </button>
            </div>
          </div>

          {/* Document category */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Tipo de documento
            </label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {DOCUMENT_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => { setSelectedCategory(cat.id); setError(null); }}
                  className={`rounded-xl border px-3 py-2 text-left text-sm ${
                    selectedCategory === cat.id
                      ? "border-emerald-300 bg-emerald-50 font-semibold text-emerald-800"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <p className="font-semibold">{cat.label}</p>
                  <p className="text-xs text-slate-500">{cat.examples}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Word count */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Numero de palabras
            </label>
            <p className="mt-1 text-xs text-slate-500">
              Sube un archivo PDF/DOCX para contar automaticamente, o introduce el numero a mano.
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              <label className="cursor-pointer rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                {estimating ? "Analizando..." : "Subir archivo para contar"}
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setFile(f);
                      void estimateFromFile(f);
                    }
                    e.target.value = "";
                  }}
                />
              </label>
              <input
                type="number"
                min={1}
                placeholder="O escribe las palabras"
                value={wordCount ?? ""}
                onChange={(e) => { setWordCount(e.target.value ? parseInt(e.target.value, 10) : null); setEstimationMeta(null); }}
                className="w-40 rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            {file && (
              <p className="mt-1 text-xs text-slate-500">Archivo: {file.name}</p>
            )}
          </div>

          {/* Estimate preview */}
          {estimate && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Precio estimado
              </p>
              <p className="mt-1 text-2xl font-bold text-emerald-900">
                ~{estimate.total.toFixed(2)} EUR
              </p>
              <p className="mt-1 text-xs text-emerald-700">
                {wordCount} palabras × {estimate.rate.toFixed(2)} EUR/palabra + 10% margen.
                El precio definitivo se confirma tras revisar el documento.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={goToStep2}
            disabled={!selectedCategory || wordCount == null}
            className="rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Continuar
          </button>
        </div>
      )}

      {/* ═══ STEP 2: Upload original document ═══ */}
      {step === 2 && (
        <div className="mt-5 space-y-5">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Sube el documento original</h3>
            <p className="mt-1 text-sm text-slate-600">
              Adjunta el PDF o imagen del documento a traducir.
            </p>
          </div>

          {estimate && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <span className="font-semibold text-slate-700">Estimado:</span>{" "}
              <span className="font-bold text-emerald-700">~{estimate.total.toFixed(2)} EUR</span>
              <span className="text-slate-500"> · {wordCount} palabras</span>
            </div>
          )}

          {file ? (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
              <span className="flex-1 truncate font-semibold text-emerald-800">{file.name}</span>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="text-xs font-semibold text-red-600 hover:text-red-800"
              >
                Cambiar
              </button>
            </div>
          ) : (
            <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center hover:border-emerald-400">
              <p className="text-sm font-semibold text-slate-700">Haz clic o arrastra un archivo</p>
              <p className="mt-1 text-xs text-slate-500">PDF, JPG, PNG (max 12 MB)</p>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null);
                  setError(null);
                }}
              />
            </label>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Atras
            </button>
            <button
              type="button"
              onClick={goToStep3}
              disabled={!file}
              className="rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Continuar al checkout
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 3: Email + submit ═══ */}
      {step === 3 && (
        <div className="mt-5 space-y-5">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Confirmar y enviar</h3>
            <p className="mt-1 text-sm text-slate-600">
              Revisaremos tu documento y te enviaremos el presupuesto definitivo por email.
              Podras pagar una vez confirmado el precio.
            </p>
          </div>

          {estimate && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Resumen
              </p>
              <p className="mt-1 text-sm text-slate-800">
                {DOCUMENT_CATEGORIES.find((c) => c.id === selectedCategory)?.label} ·{" "}
                {direction.toUpperCase()} · {wordCount} palabras
              </p>
              <p className="mt-1 text-lg font-bold text-emerald-900">
                Precio estimado: ~{estimate.total.toFixed(2)} EUR
              </p>
              <p className="mt-0.5 text-xs text-emerald-700">
                El precio final se confirma tras revision.
              </p>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Tu email
            </label>
            <input
              type="email"
              placeholder="tu@email.com"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Notas de urgencia (opcional)
            </label>
            <textarea
              placeholder="Si necesitas la traduccion para una fecha concreta, indicalo aqui..."
              value={urgencyNotes}
              onChange={(e) => setUrgencyNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Atras
            </button>
            <button
              type="button"
              onClick={submitOrder}
              disabled={checkoutLoading || !guestEmailValid}
              className="rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {checkoutLoading ? "Enviando..." : "Enviar pedido"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
