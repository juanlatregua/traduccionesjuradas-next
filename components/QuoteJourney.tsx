"use client";

import { useRef, useState, type ReactNode } from "react";
import { upload } from "@vercel/blob/client";
import QuoteDocumentsViewer from "@/components/QuoteDocumentsViewer";
import { publicDict, type PublicDict, type PublicLang } from "@/lib/quote-public-i18n";
import {
  COMPLETION_EXTS,
  validateBilling,
  validateCompletionFiles,
  type BillingForm,
  type BillingSource,
} from "@/lib/q-journey";

type DocLine = {
  id: string;
  description: string;
  sourceFileUrl?: string | null;
  pageStart?: number | null;
  pageEnd?: number | null;
};

type Props = {
  token: string;
  lang: PublicLang;
  docLines: DocLine[];
  uploadPrefix: string;
  initialPending: boolean;
  initialBilling: BillingForm;
  billingSource: BillingSource;
  suggestion: Partial<BillingForm> | null;
  billingSaved: boolean;
  totalCents: number;
  // Paso 4: el bloque de pago de siempre, sin cambios.
  children: ReactNode;
};

const input =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-encre focus:border-bleu focus:outline-none focus:ring-2 focus:ring-bleu/20";

function StepTitle({ n, children }: { n: number; children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-lg font-semibold text-encre">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bleu text-sm font-bold text-white">{n}</span>
      {children}
    </h2>
  );
}

function missingMessage(code: string, t: PublicDict) {
  return code === "none" ? t.missErrNone : code === "count" ? t.missErrCount : code === "size" ? t.missErrSize : t.missErrType;
}

export default function QuoteJourney({
  token,
  lang,
  docLines,
  uploadPrefix,
  initialPending,
  initialBilling,
  billingSource,
  suggestion,
  billingSaved,
  totalCents,
  children,
}: Props) {
  const t = publicDict(lang);
  const [answer, setAnswer] = useState<"none" | "yes" | "missing">(billingSaved ? "yes" : "none");
  const [pending, setPending] = useState(initialPending);

  // «Falta algo»
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [missErr, setMissErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Facturación
  const [bill, setBill] = useState<BillingForm>(initialBilling);
  const [fromDoc, setFromDoc] = useState(false);
  const [showSuggestion, setShowSuggestion] = useState(!!suggestion?.fiscalName && billingSource === "document");
  const [saved, setSaved] = useState(billingSaved);
  const [saving, setSaving] = useState(false);
  const [billErr, setBillErr] = useState<string | null>(null);

  async function sendMissing() {
    setMissErr(null);
    const check = validateCompletionFiles(files.map((f) => ({ name: f.name, size: f.size })));
    if (!check.ok) return setMissErr(missingMessage(check.code, t));
    setSending(true);
    try {
      const uploaded: { url: string; name: string; size: number }[] = [];
      for (const f of files) {
        const safe = f.name.replace(/[^\w.\- ]+/g, "_").slice(0, 120);
        const blob = await upload(`${uploadPrefix}${Date.now()}-${safe}`, f, {
          access: "public",
          handleUploadUrl: "/api/documents/upload",
          clientPayload: JSON.stringify({ kind: "quote-completion", token }),
        });
        uploaded.push({ url: blob.url, name: f.name, size: f.size });
      }
      const res = await fetch(`/api/quotes/public/${token}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: uploaded, note }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error("send");
      setPending(true);
      setFiles([]);
      setNote("");
    } catch {
      setMissErr(t.missErrSend);
    } finally {
      setSending(false);
    }
  }

  function billMessage(code: string) {
    return code === "name" ? t.billNameRequired : code === "nif_required" ? t.billNifRequired : code === "address" ? t.billAddressRequired : t.billErr;
  }

  async function saveBilling() {
    setBillErr(null);
    const check = validateBilling(bill, totalCents);
    if (!check.ok) return setBillErr(billMessage(check.code));
    setSaving(true);
    try {
      const res = await fetch(`/api/quotes/public/${token}/billing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(check.value),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setBillErr(billMessage(String(data?.code || "")));
        return;
      }
      setBill(check.value);
      setSaved(true);
      setFromDoc(false);
    } catch {
      setBillErr(t.billErr);
    } finally {
      setSaving(false);
    }
  }

  const set = (k: keyof BillingForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setBill((b) => ({ ...b, [k]: e.target.value }));
    setSaved(false);
  };

  const hasDocs = docLines.some((l) => l.sourceFileUrl);
  const noNif = !bill.nif.trim();

  return (
    <div className="mt-6 space-y-6">
      {/* 1 · Tus documentos */}
      <section className="rounded-2xl border border-cream p-4">
        <StepTitle n={1}>{t.yourDocuments}</StepTitle>
        <div className="mt-3">
          {hasDocs && <QuoteDocumentsViewer lines={docLines} token={token} title={t.yourDocuments} lang={lang} variant="thumbs" />}
        </div>

        <div className="mt-4 rounded-xl border border-bleu/30 bg-cream/40 p-3">
          <p className="text-sm font-semibold text-encre">{t.docsAllThere}</p>
          <p className="mt-0.5 text-xs text-sepia">{t.docsAllThereHelp}</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => setAnswer("yes")}
              aria-pressed={answer === "yes"}
              className={`rounded-xl px-4 py-3 text-sm font-semibold ${answer === "yes" ? "bg-bleu text-white" : "border border-bleu/40 bg-white text-bleu hover:bg-cream"}`}
            >
              {t.docsYes}
            </button>
            <button
              type="button"
              onClick={() => setAnswer("missing")}
              aria-pressed={answer === "missing"}
              className={`rounded-xl px-4 py-3 text-sm font-semibold ${answer === "missing" ? "bg-bleu text-white" : "border border-bleu/40 bg-white text-bleu hover:bg-cream"}`}
            >
              {t.docsMissing}
            </button>
          </div>
          {answer === "yes" && <p className="mt-2 text-xs font-semibold text-emerald-700">{t.docsConfirmed}</p>}
        </div>

        {pending && (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{t.missDone}</p>
        )}

        {answer === "missing" && (
          <div className="mt-3 rounded-xl border border-cream p-3">
            <p className="text-sm font-semibold text-encre">{t.missTitle}</p>
            <p className="mt-0.5 text-xs text-sepia">{t.missHelp}</p>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept={COMPLETION_EXTS.map((e) => `.${e}`).join(",")}
              className="sr-only"
              onChange={(e) => {
                setFiles(Array.from(e.target.files || []));
                setMissErr(null);
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-3 w-full rounded-xl border border-bleu/40 bg-white px-4 py-3 text-sm font-semibold text-bleu hover:bg-cream sm:w-auto"
            >
              {t.missPick}
            </button>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-sepia">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="truncate">
                    {f.name} · {(f.size / 1024 / 1024).toFixed(1)} MB
                  </li>
                ))}
              </ul>
            )}
            <label className="mt-3 block text-sm font-semibold text-encre">
              {t.missNote}
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={1000}
                className={`${input} font-normal`}
              />
            </label>
            {missErr && <p className="mt-2 text-xs font-semibold text-red-700">{missErr}</p>}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={sendMissing}
                disabled={sending}
                className="rounded-xl bg-bleu px-4 py-3 text-sm font-semibold text-white hover:bg-bleu-dark disabled:opacity-60"
              >
                {sending ? t.missSending : t.missSend}
              </button>
              <button
                type="button"
                onClick={() => setAnswer("none")}
                disabled={sending}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-encre hover:bg-cream"
              >
                {t.missCancel}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 2 · Datos de facturación: el formulario se abre tras «Sí, está todo» */}
      {answer !== "yes" && (
        <section className="rounded-2xl border border-cream p-4 opacity-60">
          <StepTitle n={2}>{t.billTitle}</StepTitle>
        </section>
      )}
      {answer === "yes" && (
        <section className="rounded-2xl border border-cream p-4">
          <StepTitle n={2}>{t.billTitle}</StepTitle>
          <p className="mt-1 text-xs text-sepia">{t.billHelp}</p>
          {showSuggestion && suggestion?.fiscalName && (
            <p className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
              <span>
                {t.billSuggest} <strong>{suggestion.fiscalName}</strong>
              </span>
              <button
                type="button"
                onClick={() => {
                  setBill((b) => ({ ...b, ...Object.fromEntries(Object.entries(suggestion).filter(([, v]) => !!v)) }));
                  setSaved(false);
                  setFromDoc(true);
                  setShowSuggestion(false);
                }}
                className="rounded-md bg-bleu px-2 py-1 font-semibold text-white"
              >
                {t.billUse}
              </button>
            </p>
          )}
          {fromDoc && <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">{t.billFromDoc}</p>}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-encre sm:col-span-2">
              {t.billName}
              <input value={bill.fiscalName} onChange={set("fiscalName")} autoComplete="name" className={`${input} font-normal`} />
            </label>
            <label className="block text-sm font-semibold text-encre">
              {t.billNif}
              <input value={bill.nif} onChange={set("nif")} autoComplete="off" className={`${input} font-normal`} />
            </label>
            <label className="block text-sm font-semibold text-encre">
              {t.billCountry}
              <input value={bill.country} onChange={set("country")} autoComplete="country-name" className={`${input} font-normal`} />
            </label>
            <label className="block text-sm font-semibold text-encre sm:col-span-2">
              {t.billAddress}
              <input value={bill.address} onChange={set("address")} autoComplete="street-address" className={`${input} font-normal`} />
            </label>
            <label className="block text-sm font-semibold text-encre">
              {t.billPostal}
              <input value={bill.postalCode} onChange={set("postalCode")} autoComplete="postal-code" className={`${input} font-normal`} />
            </label>
            <label className="block text-sm font-semibold text-encre">
              {t.billCity}
              <input value={bill.city} onChange={set("city")} autoComplete="address-level2" className={`${input} font-normal`} />
            </label>
          </div>
          <p className="mt-2 text-xs text-sepia">{noNif ? (totalCents > 40000 ? t.billNifRequired : t.billSimplified) : ""}</p>
          {billErr && <p className="mt-2 text-xs font-semibold text-red-700">{billErr}</p>}
          {saved ? (
            <p className="mt-3 text-sm font-semibold text-emerald-700">{t.billSaved}</p>
          ) : (
            <button
              type="button"
              onClick={saveBilling}
              disabled={saving}
              className="mt-3 w-full rounded-xl bg-bleu px-4 py-3 text-sm font-semibold text-white hover:bg-bleu-dark disabled:opacity-60 sm:w-auto"
            >
              {saving ? t.billSaving : t.billSave}
            </button>
          )}
        </section>
      )}

      {/* 3 · Pagar */}
      <section>
        <StepTitle n={3}>{t.payStepTitle}</StepTitle>
        {pending && (
          <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">{t.missPendingWarn}</p>
        )}
        {children}
      </section>
    </div>
  );
}
