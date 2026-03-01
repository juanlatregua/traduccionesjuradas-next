"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getWordRateForLangOrPair } from "@/lib/pricing";

type Lang = "fr" | "de" | "en" | "it" | "pt" | "nl" | "ca" | "sv" | "no";
type AnyLang = Lang | "es";
type LangPair = `${AnyLang}-${AnyLang}`;
type LangPairOption = LangPair | "";
type Urgency = "normal" | "urgente24";
type DocType = "certificado" | "academico" | "juridico" | "mercantil";
type CalcMode = "preset" | "file";

type DocumentPreset = {
  label: string;
  docType: DocType;
  langPair: LangPair;
  pagesLabel: string;
  fixedPrice: number;
  daysLabel?: string;
};

type AiAnalysis = {
  documentType: string;
  hasApostille: boolean;
  suggestedUrgency: "normal" | "urgente24";
  warnings: string[];
  confidence: number;
};

type EstimateResult = {
  total: number;
  base: number;
  words?: number;
  rate?: number;
  urgencyPct: number;
  marginPct: number;
  days: string;
  source: "preset" | "file";
  title?: string;
  presetPagesLabel?: string;
  ai?: AiAnalysis;
};

type CartItem = {
  id: string;
  title: string;
  langPair: string;
  words?: number;
  pagesLabel?: string;
  total: number;
  source: "preset" | "file";
};
const SAFETY_MARGIN_MULTIPLIER = 1.1;
const SAFETY_MARGIN_PCT = 10;

const DOC_TYPE_LABELS: Record<string, string> = {
  registro_civil: "Registro civil",
  academico: "Academico",
  juridico_notarial: "Juridico / Notarial",
  laboral: "Laboral",
  mercantil: "Mercantil",
  identidad: "Documento de identidad",
  otro: "Otro",
};

const LANG_LABEL: Record<Lang, string> = {
  fr: "Francés",
  de: "Alemán",
  en: "Inglés",
  it: "Italiano",
  pt: "Portugués",
  nl: "Neerlandés",
  ca: "Catalán",
  sv: "Sueco",
  no: "Noruego",
};

const BASE_LANG_OPTIONS = Object.keys(LANG_LABEL) as Lang[];
const DEFAULT_LANG_PAIR_OPTIONS: Array<{ value: LangPair; label: string }> = BASE_LANG_OPTIONS.flatMap(
  (code) => [
    { value: `${code}-es` as LangPair, label: `${LANG_LABEL[code]} -> Español` },
    { value: `es-${code}` as LangPair, label: `Español -> ${LANG_LABEL[code]}` },
  ]
);

const DOC_LABEL: Record<DocType, string> = {
  certificado: "Certificado",
  academico: "Académico",
  juridico: "Jurídico / notarial",
  mercantil: "Mercantil / empresarial",
};

const DOCUMENT_PRESETS: DocumentPreset[] = [
  { label: "Penales apostillado", docType: "certificado", langPair: "pt-es", pagesLabel: "2 páginas", fixedPrice: 75 },
  { label: "Expediente escolar", docType: "academico", langPair: "pt-es", pagesLabel: "3 páginas", fixedPrice: 210 },
  { label: "Certificado ético", docType: "certificado", langPair: "pt-es", pagesLabel: "1 página", fixedPrice: 45 },
  { label: "Certificado de matrimonio + apostilla", docType: "certificado", langPair: "pt-es", pagesLabel: "2 páginas", fixedPrice: 165 },
  { label: "Expediente + certificado + apostillado", docType: "academico", langPair: "pt-es", pagesLabel: "3 páginas", fixedPrice: 130 },
  { label: "Documento 1 hoja", docType: "certificado", langPair: "fr-es", pagesLabel: "1 hoja", fixedPrice: 40, daysLabel: "24 h" },
  { label: "Documento 1 hoja", docType: "certificado", langPair: "es-fr", pagesLabel: "1 hoja", fixedPrice: 40, daysLabel: "24 h" },
  { label: "Documento 2 hojas (1 apostilla)", docType: "certificado", langPair: "fr-es", pagesLabel: "2 hojas (1 apostilla)", fixedPrice: 50, daysLabel: "24 h" },
  { label: "Documento 2 hojas (1 apostilla)", docType: "certificado", langPair: "es-fr", pagesLabel: "2 hojas (1 apostilla)", fixedPrice: 50, daysLabel: "24 h" },
  { label: "Documento 2 hojas (sin apostilla)", docType: "certificado", langPair: "fr-es", pagesLabel: "2 hojas", fixedPrice: 60 },
  { label: "Documento 2 hojas (sin apostilla)", docType: "certificado", langPair: "es-fr", pagesLabel: "2 hojas", fixedPrice: 60 },
  { label: "Expediente + apostillado", docType: "academico", langPair: "de-es", pagesLabel: "2 páginas", fixedPrice: 170 },
  { label: "Certificado de matrimonio", docType: "certificado", langPair: "de-es", pagesLabel: "1 página", fixedPrice: 55 },
  { label: "Certificado literal de nacimiento", docType: "certificado", langPair: "es-en", pagesLabel: "3 páginas", fixedPrice: 75 },
  { label: "Título universitario + expediente", docType: "academico", langPair: "en-es", pagesLabel: "4 páginas (3 + 1)", fixedPrice: 215 },
  { label: "Certificado literal de nacimiento legalizado apostillado", docType: "certificado", langPair: "es-en", pagesLabel: "5 páginas", fixedPrice: 135 },
  { label: "Título universitario + expediente (catalán)", docType: "academico", langPair: "ca-es", pagesLabel: "2 páginas", fixedPrice: 130 },
  { label: "Certificado de honorabilidad enfermería", docType: "certificado", langPair: "it-es", pagesLabel: "3 páginas", fixedPrice: 90 },
  { label: "Registro parejas de hecho", docType: "certificado", langPair: "ca-es", pagesLabel: "3 páginas", fixedPrice: 180 },
  { label: "Expediente 2 páginas + 1 diploma + 2 certificados", docType: "academico", langPair: "it-es", pagesLabel: "5 páginas", fixedPrice: 220 },
];

const PRESET_LANG_OPTIONS = Array.from(
  new Map(
    DOCUMENT_PRESETS.map((p) => {
      const [from, to] = p.langPair.split("-") as [AnyLang, AnyLang];
      const fromLabel = from === "es" ? "Español" : LANG_LABEL[from as Lang];
      const toLabel = to === "es" ? "Español" : LANG_LABEL[to as Lang];
      return [p.langPair, { value: p.langPair, label: `${fromLabel} -> ${toLabel}` }];
    })
  ).values()
);

const LANG_PAIR_OPTIONS = Array.from(
  new Map([...DEFAULT_LANG_PAIR_OPTIONS, ...PRESET_LANG_OPTIONS].map((o) => [o.value, o])).values()
);

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function getEstimatedDays(doc: DocType, urgency: Urgency) {
  if (urgency === "urgente24") return "24 h (según disponibilidad)";
  return doc === "certificado" ? "24-48 h laborales" : "48-72 h laborales";
}

export default function PriceEstimator() {
  const [mode, setMode] = useState<CalcMode>("preset");
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<EstimateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [showGuestEmail, setShowGuestEmail] = useState(false);
  const [guestEmail, setGuestEmail] = useState("");
  const [urgencyNotes, setUrgencyNotes] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const createOrderIdempotencyRef = useRef<string | null>(null);
  const createOrderFingerprintRef = useRef<string | null>(null);

  const [presetLangPair, setPresetLangPair] = useState<LangPairOption>("");
  const [presetDocLabel, setPresetDocLabel] = useState("");

  const [fileLangPair, setFileLangPair] = useState<LangPairOption>("");
  const [fileDocType, setFileDocType] = useState<DocType>("academico");
  const [fileUrgency, setFileUrgency] = useState<Urgency>("normal");
  const [fileUpload, setFileUpload] = useState<File | null>(null);
  const [manualWords, setManualWords] = useState<number>(300);
  const [manualText, setManualText] = useState("");
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
    const sourceAgent = (params.get("agent") || "").trim() || undefined;
    const sourceCampaign =
      (params.get("campaign") || params.get("utm_campaign") || "").trim() || undefined;
    const sourceMedium = (params.get("utm_medium") || "").trim() || undefined;
    setTracking({
      sourceRaw: srcRaw || undefined,
      sourceChannel,
      sourceAgent,
      sourceCampaign,
      sourceMedium,
      sourceLanding: window.location.pathname + window.location.search,
    });
  }, []);

  const filteredPresets = useMemo(
    () =>
      presetLangPair
        ? DOCUMENT_PRESETS.filter((p) => p.langPair === presetLangPair)
        : [],
    [presetLangPair]
  );

  const selectedPreset = useMemo(
    () => filteredPresets.find((p) => p.label === presetDocLabel) || null,
    [filteredPresets, presetDocLabel]
  );

  useEffect(() => {
    if (mode !== "preset") return;
    if (!selectedPreset) {
      setResult((prev) => (prev?.source === "preset" ? null : prev));
      return;
    }
    setMessage(null);
    setResult({
      total: selectedPreset.fixedPrice,
      base: selectedPreset.fixedPrice,
      urgencyPct: 0,
      marginPct: 0,
      days: selectedPreset.daysLabel || getEstimatedDays(selectedPreset.docType, "normal"),
      source: "preset",
      title: selectedPreset.label,
      presetPagesLabel: selectedPreset.pagesLabel,
    });
  }, [mode, selectedPreset]);

  const calculateFile = async () => {
    if (!fileLangPair) {
      setMessage("Selecciona la combinación de idiomas.");
      return;
    }
    if (!fileUpload) {
      setMessage("Adjunta un archivo (PDF, DOCX o TXT) para calcular.");
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append("file", fileUpload);
      fd.append("lang", fileLangPair);
      fd.append("urgency", fileUrgency);

      const res = await fetch("/api/estimador", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo analizar el archivo.");

      setResult({
        total: Number(data.total || 0),
        base: Number(data.base || 0),
        words: clampInt(Number(data.words || 0), 0, 200000),
        rate: Number(data.rate || 0),
        urgencyPct: fileUrgency === "urgente24" ? 25 : 0,
        marginPct: Number(data.marginPct || SAFETY_MARGIN_PCT),
        days: getEstimatedDays(fileDocType, fileUrgency),
        source: "file",
        ai: data.ai || undefined,
      });
      setMessage(`Archivo analizado: ${data.words} palabras (${data.extractionMethod}).`);
    } catch (error: any) {
      setMessage(error?.message || "Error al calcular.");
    } finally {
      setLoading(false);
    }
  };

  const applyManualWords = () => {
    if (!fileLangPair) {
      setMessage("Selecciona la combinación de idiomas.");
      return;
    }
    const rate = getWordRateForLangOrPair(fileLangPair as string);
    const base = Math.round(manualWords * rate);
    const subtotal = Math.round(base * (fileUrgency === "urgente24" ? 1.25 : 1));
    const total = Math.round(subtotal * SAFETY_MARGIN_MULTIPLIER);
    setResult({
      total,
      base,
      words: manualWords,
      rate,
      urgencyPct: fileUrgency === "urgente24" ? 25 : 0,
      marginPct: SAFETY_MARGIN_PCT,
      days: getEstimatedDays(fileDocType, fileUrgency),
      source: "file",
    });
    setMessage("Estimación calculada manualmente.");
  };

  const addToCart = () => {
    if (!result) {
      setMessage("Calcula primero una estimación antes de añadir.");
      return;
    }
    const activeLangPair = (result.source === "preset" ? presetLangPair : fileLangPair) || "";
    const item: CartItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: result.title || (result.source === "preset" ? "Documento" : fileUpload?.name || "Documento"),
      langPair: activeLangPair,
      words: result.words,
      pagesLabel: result.presetPagesLabel,
      total: result.total,
      source: result.source,
    };
    setCart((prev) => [...prev, item]);
    setResult(null);
    setMessage(`"${item.title}" añadido al presupuesto.`);
    // Reset form for next document
    if (result.source === "preset") {
      setPresetDocLabel("");
    } else {
      setFileUpload(null);
    }
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.total, 0);

  const startCheckout = async (emailOverride?: string) => {
    // Determine what to pay: cart items or single result
    const hasCart = cart.length > 0;
    const payResult = hasCart ? null : result;
    const payTotal = hasCart ? cartTotal : result?.total;

    if (!payTotal || payTotal <= 0) {
      setMessage("Calcula primero una estimación o añade documentos al presupuesto.");
      return;
    }

    const activeLangPair = payResult
      ? (payResult.source === "preset" ? presetLangPair : fileLangPair)
      : (cart.length === 1 ? cart[0].langPair : undefined);
    const hasMixedCart = hasCart && new Set(cart.map((item) => item.source)).size > 1;
    const containsWordCountItem = hasCart
      ? cart.some((item) => item.source === "file" || typeof item.words === "number")
      : payResult?.source === "file" || typeof payResult?.words === "number";

    // Build title
    const title = hasCart
      ? (cart.length === 1
          ? cart[0].title
          : `${cart.length} documentos: ${cart.map((c) => c.title).join(", ").slice(0, 120)}`)
      : (payResult?.title || "Pedido de traducción jurada");

    setCheckoutLoading(true);
    try {
      const idempotencyFingerprint = JSON.stringify({
        total: Math.round(payTotal * 100),
        title,
        langPair: activeLangPair || "",
        email: (emailOverride || "").trim().toLowerCase(),
        source: hasCart ? "cart" : payResult?.source || "single",
        cartSize: cart.length,
      });
      if (createOrderFingerprintRef.current !== idempotencyFingerprint) {
        createOrderFingerprintRef.current = idempotencyFingerprint;
        createOrderIdempotencyRef.current = `est:${Date.now()}:${Math.random().toString(16).slice(2, 10)}`;
      }
      const idempotencyKey = createOrderIdempotencyRef.current as string;

      const payload: Record<string, unknown> = {
        amountCents: Math.round(payTotal * 100),
        currency: "eur",
        title,
        source: hasCart ? (cart.some((c) => c.source === "file") ? "file" : "preset") : payResult?.source,
        langPair: activeLangPair || undefined,
        words: hasCart ? cart.reduce((s, c) => s + (c.words || 0), 0) || undefined : payResult?.words,
        pagesLabel: hasCart
          ? cart.map((c) => c.pagesLabel).filter(Boolean).join(", ") || undefined
          : payResult?.presetPagesLabel,
        hasMixedCart,
        containsWordCountItem,
        urgencyNotes: urgencyNotes.trim() || undefined,
        sourceChannel: tracking.sourceChannel,
        sourceAgent: tracking.sourceAgent,
        sourceCampaign: tracking.sourceCampaign,
        sourceMedium: tracking.sourceMedium,
        sourceLanding: tracking.sourceLanding,
        idempotencyKey,
      };
      if (emailOverride) {
        payload.guestEmail = emailOverride;
      }

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": idempotencyKey,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        if (res.status === 401 && !emailOverride) {
          setShowGuestEmail(true);
          setCheckoutLoading(false);
          return;
        }
        throw new Error(data?.error || "No se pudo crear el pedido.");
      }
      const params = new URLSearchParams();
      if (tracking.sourceRaw) params.set("src", tracking.sourceRaw);
      if (tracking.sourceAgent) params.set("agent", tracking.sourceAgent);
      const qs = params.toString();
      const paymentUrl = `/area-cliente/pedido/${data.order.reference}/pagar${qs ? `?${qs}` : ""}`;
      window.location.assign(paymentUrl);
    } catch (error: any) {
      setMessage(error?.message || "No se pudo iniciar el pago.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <section className="mt-8 rounded-3xl border border-cream bg-card p-5 text-sm text-encre shadow-paper backdrop-blur sm:p-6">
      {message && (
        <div className="fixed inset-x-0 top-20 z-[210] mx-auto w-[92%] max-w-xl rounded-2xl border border-cream bg-card px-4 py-3 shadow-xl">
          <div className="flex items-start gap-3">
            <span
              className={`mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                message.toLowerCase().includes("no hemos podido extraer")
                  ? "bg-red-100 text-red-700"
                  : "bg-bleu/10 text-bleu"
              }`}
            >
              {message.toLowerCase().includes("no hemos podido extraer") ? "!" : "OK"}
            </span>
            <p className="flex-1 text-xs text-sepia">{message}</p>
            <button
              type="button"
              onClick={() => setMessage(null)}
              className="text-xs font-semibold text-graphite hover:text-sepia"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      <h2 className="text-lg font-semibold text-encre">Calculadora rápida de precio orientativo</h2>
      <p className="mt-1 text-sepia">
        Elige una de las dos rutas: tarifa fija por documento o cálculo automático por archivo.
      </p>

      <div className="mt-4 inline-flex rounded-2xl border border-cream bg-card p-1">
        <button
          type="button"
          onClick={() => setMode("preset")}
          className={`rounded-xl px-3 py-2 text-xs font-semibold ${
            mode === "preset" ? "bg-bleu text-white" : "text-sepia"
          }`}
        >
          Documentos habituales (precios orientativos)
        </button>
        <button
          type="button"
          onClick={() => setMode("file")}
          className={`rounded-xl px-3 py-2 text-xs font-semibold ${
            mode === "file" ? "bg-bleu text-white" : "text-sepia"
          }`}
        >
          Calcula tu presupuesto (Adjuntar archivo)
        </button>
      </div>

      {mode === "preset" ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 rounded-2xl border border-cream bg-card p-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-sepia">
              Combinación de idioma
            </span>
            <select
              className="rounded-2xl border border-cream bg-card px-3 py-2 text-sm"
              value={presetLangPair}
              onChange={(e) => {
                setPresetLangPair(e.target.value as LangPairOption);
                setPresetDocLabel("");
              }}
            >
              <option value="">Selecciona combinación</option>
              {LANG_PAIR_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 rounded-2xl border border-cream bg-card p-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-sepia">
              Documento con precio fijo
            </span>
            <select
              className="rounded-2xl border border-cream bg-card px-3 py-2 text-sm"
              value={presetDocLabel}
              onChange={(e) => setPresetDocLabel(e.target.value)}
              disabled={!presetLangPair}
            >
              <option value="">
                {presetLangPair ? "Selecciona documento" : "Primero selecciona idioma"}
              </option>
              {filteredPresets.map((p) => (
                <option key={p.label} value={p.label}>
                  {p.label} ({p.pagesLabel})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-graphite">
              Al elegir documento, el precio fijo se muestra automáticamente (recto/verso no cuenta como dos hojas).
            </p>
          </label>

          {presetLangPair && filteredPresets.length === 0 && (
            <div className="col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
              <p className="font-semibold text-amber-800">
                Aún no tenemos precios fijos para esta combinación.
              </p>
              <p className="mt-1 text-amber-700">
                Tarifa orientativa: <strong>{getWordRateForLangOrPair(presetLangPair).toFixed(2)} EUR/palabra</strong>.
                Usa la ruta &ldquo;Calcula tu presupuesto&rdquo; para una estimación por archivo, o contáctanos directamente.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 rounded-2xl border border-cream bg-card p-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-sepia">
              Combinación de idioma
            </span>
            <select
              className="rounded-2xl border border-cream bg-card px-3 py-2 text-sm"
              value={fileLangPair}
              onChange={(e) => setFileLangPair(e.target.value as LangPairOption)}
            >
              <option value="">Selecciona combinación</option>
              {LANG_PAIR_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {fileLangPair && (
              <p className="text-sm text-sepia">
                Tarifa para esta combinación: <strong className="text-bleu">{getWordRateForLangOrPair(fileLangPair).toFixed(2)} EUR/palabra</strong>
              </p>
            )}
          </label>

          <label className="flex flex-col gap-2 rounded-2xl border border-cream bg-card p-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-sepia">
              Familia de documento
            </span>
            <select
              className="rounded-2xl border border-cream bg-card px-3 py-2 text-sm"
              value={fileDocType}
              onChange={(e) => setFileDocType(e.target.value as DocType)}
            >
              {Object.entries(DOC_LABEL).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 rounded-2xl border border-cream bg-card p-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-sepia">Plazo</span>
            <select
              className="rounded-2xl border border-cream bg-card px-3 py-2 text-sm"
              value={fileUrgency}
              onChange={(e) => setFileUrgency(e.target.value as Urgency)}
            >
              <option value="normal">Normal</option>
              <option value="urgente24">Urgente 24 h (+25%)</option>
            </select>
          </label>

          <label className="flex flex-col gap-2 rounded-2xl border border-cream bg-card p-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-sepia">
              Adjuntar archivo
            </span>
            <input
              type="file"
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              onChange={(e) => setFileUpload(e.target.files?.[0] || null)}
              className="block w-full text-xs file:mr-3 file:rounded-xl file:border-0 file:bg-cream file:px-3 file:py-2 file:text-xs file:font-semibold file:text-sepia"
            />
            <p className="text-[11px] text-graphite">PDF, DOCX o TXT. Para PDF escaneado usamos OCR si está configurado.</p>
          </label>
        </div>
      )}

      {mode === "file" && (
        <div className="mt-4">
          <button
            type="button"
            onClick={calculateFile}
            disabled={loading}
            className="rounded-2xl bg-bleu px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Calculando..." : "Calcular precio"}
          </button>
        </div>
      )}

      {mode === "file" && (
        <details className="mt-4 rounded-2xl border border-cream bg-card p-4">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-sepia">
            Opcional: cálculo manual por palabras
          </summary>
          <div className="mt-3 space-y-2">
            <input
              type="number"
              min={1}
              max={200000}
              value={manualWords}
              onChange={(e) => setManualWords(clampInt(Number(e.target.value), 1, 200000))}
              className="w-full rounded-2xl border border-cream bg-card px-3 py-2 text-sm"
            />
            <textarea
              rows={4}
              value={manualText}
              onChange={(e) => {
                const txt = e.target.value;
                setManualText(txt);
                setManualWords(clampInt(countWords(txt), 1, 200000));
              }}
              className="w-full rounded-2xl border border-cream bg-card px-3 py-2 text-sm"
              placeholder="O pega aquí texto para contar palabras automáticamente."
            />
            <button
              type="button"
              onClick={applyManualWords}
              className="rounded-xl border border-cream px-3 py-1.5 text-xs font-semibold text-sepia"
            >
              Aplicar cálculo manual
            </button>
          </div>
        </details>
      )}

      <div className="mt-6 rounded-2xl border border-cream bg-card border-cream p-4 shadow-sm">
        <p className="text-sm font-semibold text-encre">Estimación orientativa</p>
        {!result ? (
          <p className="mt-2 text-sm text-sepia">
            {mode === "preset"
              ? "Selecciona idioma y documento para ver el precio fijo."
              : "Completa la ruta elegida y pulsa “Calcular precio”."}
          </p>
        ) : (
          <>
            <p className="mt-2 text-2xl font-bold tracking-tight text-bleu">{result.total} EUR</p>
            <p className="mt-1 text-xs text-sepia">
              Base: {result.base} EUR
              {result.urgencyPct > 0 ? ` + urgencia ${result.urgencyPct}%` : ""}
              {result.marginPct > 0 ? " (precio orientativo)" : ""}
            </p>
            {result.title && <p className="mt-1 text-xs text-sepia">Documento: {result.title}</p>}
            {result.source === "preset" && result.presetPagesLabel && (
              <p className="mt-1 text-xs font-semibold text-bleu">
                Precio fijo para {result.presetPagesLabel}: {result.total} EUR.
              </p>
            )}
            {result.source === "file" && typeof result.words === "number" && typeof result.rate === "number" && (
              <p className="mt-1 text-xs text-sepia">
                Cálculo por palabras: {result.words} x {result.rate.toFixed(3)} EUR/palabra.
              </p>
            )}
            <p className="text-sm text-sepia">
              Plazo estimado: <span className="font-semibold">{result.days}</span>.
            </p>
            {result.ai && (
              <div className="mt-3 space-y-1">
                <p className="text-xs text-sepia">
                  Tipo detectado: <span className="font-semibold">{DOC_TYPE_LABELS[result.ai.documentType] || result.ai.documentType}</span>
                  {result.ai.hasApostille && <span className="ml-2 rounded-lg bg-cream px-1.5 py-0.5 text-[11px] font-semibold text-bleu">Apostilla detectada</span>}
                </p>
                {result.ai.warnings.length > 0 && (
                  <ul className="space-y-0.5">
                    {result.ai.warnings.map((w, i) => (
                      <li key={i} className="text-xs font-medium text-amber-700">
                        {w}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <p className="mt-2 text-[13px] text-sepia">
              Simulacion orientativa. El precio exacto se confirma al revisar el documento final.
            </p>
          </>
        )}
        {showGuestEmail && (result || cart.length > 0) && (
          <div className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-900">
              Introduce tu email para recibir la confirmación y el enlace de pago:
            </p>
            <form
              className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                if (guestEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
                  startCheckout(guestEmail.trim().toLowerCase());
                } else {
                  setMessage("Introduce un email válido.");
                }
              }}
            >
              <input
                type="email"
                required
                placeholder="tu@email.com"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                className="flex-1 rounded-xl border border-cream bg-card px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={checkoutLoading}
                className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
              >
                {checkoutLoading ? "Creando pedido..." : "Continuar al pago"}
              </button>
            </form>
            <p className="mt-1.5 text-[11px] text-sepia">
              Solo usaremos tu email para este pedido. Sin registro ni contraseña.
            </p>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          {result && !showGuestEmail && (
            <>
              <button
                type="button"
                onClick={addToCart}
                className="inline-flex items-center gap-2 rounded-2xl border border-bleu/30 bg-cream px-4 py-2 font-semibold text-bleu shadow-sm hover:bg-cream"
              >
                Añadir al presupuesto
              </button>
              {cart.length === 0 && (
                <button
                  type="button"
                  onClick={() => startCheckout()}
                  disabled={checkoutLoading}
                  className="inline-flex items-center gap-2 rounded-2xl bg-blue-700 px-4 py-2 font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60"
                >
                  {checkoutLoading ? "Redirigiendo al pago..." : "Pagar y confirmar pedido"}
                </button>
              )}
            </>
          )}
          <Link
            href="/presupuesto"
            className="inline-flex items-center gap-2 rounded-2xl bg-bleu px-4 py-2 font-semibold text-white shadow-sm hover:bg-bleu-dark"
          >
            Pedir presupuesto cerrado
          </Link>
          <Link href="/preguntas-frecuentes" className="font-semibold text-bleu underline-offset-2 hover:underline">
            Ver dudas frecuentes
          </Link>
        </div>
      </div>
      <div className="mt-4 rounded-2xl border border-cream bg-card p-4">
        <label className="block text-xs font-semibold uppercase tracking-wide text-sepia">
          Observaciones de urgencia (opcional)
        </label>
        <textarea
          value={urgencyNotes}
          onChange={(e) => setUrgencyNotes(e.target.value)}
          className="mt-2 h-20 w-full rounded-2xl border border-cream bg-card px-3 py-2 text-sm"
          placeholder="Ejemplo: necesito entrega para cita el jueves por la mañana."
        />
      </div>
      {/* Cart summary */}
      {cart.length > 0 && (
        <div className="mt-6 rounded-2xl border border-cream bg-cream p-4 shadow-sm">
          <p className="text-sm font-semibold text-encre">
            Presupuesto ({cart.length} {cart.length === 1 ? "documento" : "documentos"})
          </p>
          <ul className="mt-2 divide-y divide-cream">
            {cart.map((item) => (
              <li key={item.id} className="flex items-center justify-between py-2 text-sm">
                <div className="flex-1">
                  <span className="font-medium text-encre">{item.title}</span>
                  {item.pagesLabel && (
                    <span className="ml-2 text-xs text-graphite">({item.pagesLabel})</span>
                  )}
                  {item.words && (
                    <span className="ml-2 text-xs text-graphite">{item.words} palabras</span>
                  )}
                </div>
                <span className="mx-3 font-semibold text-bleu">{item.total} EUR</span>
                <button
                  type="button"
                  onClick={() => removeFromCart(item.id)}
                  className="text-xs font-semibold text-red-600 hover:text-red-800"
                >
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between border-t border-bleu/30 pt-3">
            <p className="text-lg font-bold text-encre">Total: {cartTotal} EUR</p>
            {!showGuestEmail && (
              <button
                type="button"
                onClick={() => startCheckout()}
                disabled={checkoutLoading}
                className="rounded-2xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60"
              >
                {checkoutLoading ? "Redirigiendo al pago..." : "Pagar todo"}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
