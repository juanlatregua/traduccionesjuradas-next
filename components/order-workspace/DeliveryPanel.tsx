"use client";

// Panel único «Entregar al cliente»: archivos de la traducción, datos de
// facturación y mensaje, con un solo botón. Habla con POST /delivery (el carril
// de siempre): emite o corrige la factura y envía el email con todo adjunto.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadStaffFile } from "@/lib/staff-upload-client";
import { isTranslatorFile, splitDocumentVersions } from "@/lib/delivery-files";
import {
  NIF_REQUIRED_MESSAGE,
  invoiceStatusLabel,
  needsNif,
  invoiceStatusOf,
  type BillingFields,
} from "@/lib/delivery-billing";
import {
  AI_LANGUAGES,
  AI_REQUIRED_DATA_ERROR,
  INVOICE_NUMBER_PLACEHOLDER,
  buildDeliveryAiInstruction,
  buildDeliveryText,
  buildInvoiceOnlyText,
  invoiceOnlySubject,
  deliverySubject,
  missingRequiredData,
  requiredInvoiceNumber,
  translateInstruction,
  type DeliveryLang,
} from "@/lib/delivery-message";

type DeliveryFileRef = { name: string; url: string };

type Props = {
  reference: string;
  clientEmail: string;
  clientName: string | null;
  lang: DeliveryLang;
  reviewUrl: string;
  amountCents: number;
  files: DeliveryFileRef[];
  primaryFileUrl: string | null;
  replacedUrls: string[];
  translatorUrls: string[];
  reviewedUrls: string[];
  billing: BillingFields;
  billingExcluded: boolean;
  billingExcludedReason: string | null;
  hasMonthlyInvoice: boolean;
  invoice: { number: string | null; status: string; docKind: string; annulledAt: string | null } | null;
  paymentMethod: string | null;
  alreadyDelivered: boolean;
  lastSent: { sentAt: string; toEmail: string | null; invoiceNumber: string | null } | null;
  whatsappText: string;
};

const FIELDS: { key: keyof BillingFields; label: string; wide?: boolean }[] = [
  { key: "fiscalName", label: "Nombre fiscal", wide: true },
  { key: "nif", label: "NIF / VAT" },
  { key: "email", label: "Email" },
  { key: "address", label: "Dirección", wide: true },
  { key: "postalCode", label: "CP" },
  { key: "city", label: "Ciudad" },
  { key: "country", label: "País" },
];

const INPUT =
  "mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500";

export default function DeliveryPanel(props: Props) {
  const router = useRouter();
  const versions = useMemo(() => splitDocumentVersions(props.files, props.primaryFileUrl, props.replacedUrls), [props.files, props.primaryFileUrl, props.replacedUrls]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(versions.current.map((f) => f.url)));
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [reviewed, setReviewed] = useState<Set<string>>(() => new Set(props.reviewedUrls));
  const translatorSet = useMemo(() => new Set(props.translatorUrls), [props.translatorUrls]);
  const [billing, setBilling] = useState<BillingFields>(props.billing);
  const [message, setMessage] = useState<string | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [sentNow, setSentNow] = useState<{ invoiceNumber: string | null } | null>(null);
  const [copied, setCopied] = useState(false);

  const status = invoiceStatusOf({
    billingExcluded: props.billingExcluded,
    billingExcludedReason: props.billingExcludedReason,
    hasMonthlyInvoice: props.hasMonthlyInvoice,
    invoice: props.invoice,
    paymentMethod: props.paymentMethod,
    nif: billing.nif,
    amountCents: props.amountCents,
  });
  const correction = props.alreadyDelivered && newFiles.length > 0;
  const invoiceRef = status.kind === "issued" ? status.number : status.kind === "will_issue" ? INVOICE_NUMBER_PLACEHOLDER : null;

  const fileCount = selected.size + newFiles.length;
  const invoiceOnly = fileCount === 0 && invoiceRef !== null;

  const defaultMessage = useMemo(
    () =>
      invoiceOnly && invoiceRef
        ? buildInvoiceOnlyText({
            lang: props.lang,
            name: props.clientName,
            reference: props.reference,
            invoiceNumber: invoiceRef,
            reviewUrl: props.reviewUrl,
          })
        : buildDeliveryText({
            lang: props.lang,
            name: props.clientName,
            reference: props.reference,
            invoiceNumber: invoiceRef,
            correction,
            reviewUrl: props.reviewUrl,
          }),
    [props.lang, props.clientName, props.reference, props.reviewUrl, invoiceRef, correction, invoiceOnly]
  );
  const text = message ?? defaultMessage;
  const requiredInvoice = requiredInvoiceNumber(invoiceRef, correction);
  const defaultSubject =
    invoiceOnly && invoiceRef
      ? invoiceOnlySubject(props.lang, props.reference, invoiceRef)
      : deliverySubject(props.lang, props.reference, correction);
  const subjectText = subject ?? defaultSubject;
  useEffect(() => setSubject(null), [correction]);
  const pendingReview = Array.from(selected).filter((u) => isTranslatorFile(u, translatorSet) && !reviewed.has(u));
  const nifBlocked = status.kind === "will_issue" && needsNif(billing.nif, props.amountCents);
  const syntheticEmail = props.clientEmail.endsWith("@whatsapp.local");

  function toggle(url: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  async function markReviewed(url: string, value: boolean) {
    setReviewed((prev) => {
      const next = new Set(prev);
      if (value) next.add(url);
      else next.delete(url);
      return next;
    });
    try {
      const res = await fetch(`/api/orders/${props.reference}/delivery/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, reviewed: value }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setReviewed((prev) => {
        const next = new Set(prev);
        if (value) next.delete(url);
        else next.add(url);
        return next;
      });
      setFeedback({ ok: false, text: "No se pudo guardar la revisión; inténtalo de nuevo." });
    }
  }

  function addFiles(incoming: File[]) {
    setNewFiles((prev) => {
      const keyOf = (f: File) => `${f.name}:${f.size}:${f.lastModified}`;
      const seen = new Set(prev.map(keyOf));
      return [...prev, ...incoming.filter((f) => !seen.has(keyOf(f)))];
    });
  }

  async function send() {
    if (fileCount === 0 && !invoiceOnly) {
      setFeedback({ ok: false, text: `Marca o sube al menos un archivo (no hay factura que enviar: ${invoiceStatusLabel(status)}).` });
      return;
    }
    if (pendingReview.length > 0) {
      setFeedback({ ok: false, text: `Marca como revisados los ${pendingReview.length} archivo(s) del traductor antes de enviar.` });
      return;
    }
    if (nifBlocked) {
      setFeedback({ ok: false, text: NIF_REQUIRED_MESSAGE });
      return;
    }
    if (status.kind === "will_issue" && !status.simplified && !billing.fiscalName.trim()) {
      setFeedback({ ok: false, text: "Falta el nombre fiscal para emitir la factura." });
      return;
    }
    const invoiceWord = status.kind === "issued" ? status.number : status.kind === "will_issue" ? "se emitirá" : "sin factura";
    const names = [
      ...props.files.filter((f) => selected.has(f.url)).map((f) => f.name),
      ...newFiles.map((f) => f.name),
    ];
    const summary = invoiceOnly
      ? `Vas a enviar a ${props.clientEmail}: solo la factura ${invoiceWord}. ¿Enviar?`
      : `Vas a enviar a ${props.clientEmail}: ${names.length} traducción(es) [${names.join(", ")}] + factura ${invoiceWord}. ¿Enviar?`;
    if (!window.confirm(summary)) return;
    setSending(true);
    setFeedback(null);
    try {
      if (invoiceOnly) {
        const resInv = await fetch(`/api/orders/${props.reference}/delivery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            invoiceOnly: true,
            billing,
            message: message !== null ? message : undefined,
            subject: subject !== null ? subject : undefined,
          }),
        });
        const inv = await resInv.json().catch(() => null);
        if (!resInv.ok || !inv?.ok) throw new Error(inv?.error || `No se pudo enviar la factura (error ${resInv.status}).`);
        const invWarnings: string[] = Array.isArray(inv.warnings) ? inv.warnings : [];
        setMessage(null);
        setSubject(null);
        setSentNow({ invoiceNumber: inv.invoiceNumber || null });
        setFeedback({ ok: invWarnings.length === 0, text: [`Factura ${inv.invoiceNumber} enviada al cliente.`, ...invWarnings].join(" ") });
        router.refresh();
        return;
      }
      const uploaded = [];
      for (const f of newFiles) {
        const up = await uploadStaffFile(f, `orders/${props.reference}`);
        uploaded.push({ url: up.url, fileKey: up.pathname || null, filename: f.name, mimeType: f.type || null });
      }
      const res = await fetch(`/api/orders/${props.reference}/delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state: "TRADUCIDO",
          notifyClient: true,
          files: uploaded.length > 0 ? uploaded : undefined,
          fileUrls: Array.from(selected),
          billing,
          message: message !== null ? message : undefined,
          subject: subject !== null ? subject : undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || `No se pudo enviar (error ${res.status}).`);
      const warnings: string[] = Array.isArray(data.warnings) ? data.warnings : [];
      setNewFiles([]);
      setMessage(null);
      setSubject(null);
      setSentNow({ invoiceNumber: data.invoiceNumber || null });
      setFeedback({
        ok: warnings.length === 0,
        text: [
          data.correction ? "Corrección enviada al cliente." : "Enviado al cliente.",
          data.invoiceNumber ? `Factura ${data.invoiceNumber} adjunta.` : "Sin factura adjunta.",
          ...warnings,
        ].join(" "),
      });
      router.refresh();
    } catch (err: any) {
      setFeedback({ ok: false, text: err?.message || "Error al enviar." });
    } finally {
      setSending(false);
    }
  }

  // Ajuste IA: solo reescribe el textarea (y el asunto); el envío sigue siendo manual.
  async function adjustWithAi(instruction: string) {
    setAiLoading(true);
    setAiFeedback(null);
    try {
      const res = await fetch("/api/admin/email-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subjectText,
          body: text,
          instruction: buildDeliveryAiInstruction(instruction, {
            reference: props.reference,
            invoiceNumber: requiredInvoice,
            reviewUrl: props.reviewUrl,
          }),
          orderReference: props.reference,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "No se pudo generar el borrador.");
      const draftBody = String(data.draft?.body || "");
      const missing = missingRequiredData(draftBody, {
        reference: props.reference,
        invoiceNumber: requiredInvoice,
        reviewUrl: props.reviewUrl,
      });
      if (missing.length > 0) {
        setAiFeedback({ ok: false, text: `${AI_REQUIRED_DATA_ERROR} (${missing.join(", ")}).` });
        return;
      }
      setMessage(draftBody);
      if (data.draft?.subject) setSubject(String(data.draft.subject));
      setAiFeedback({ ok: true, text: "✓ Ajustado con IA. Revísalo antes de enviar." });
    } catch (err: any) {
      setAiFeedback({ ok: false, text: err?.message || "Error al ajustar con IA." });
    } finally {
      setAiLoading(false);
    }
  }

  async function copyWhatsapp() {
    try {
      await navigator.clipboard.writeText(props.whatsappText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFeedback({ ok: false, text: "No se pudo copiar; selecciona el texto a mano." });
    }
  }

  const sentInvoice = sentNow?.invoiceNumber ?? props.lastSent?.invoiceNumber ?? null;

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-slate-900/80 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">Entregar al cliente</p>

      {props.lastSent && (
        <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-slate-300">
          <p>
            Enviado a <b className="text-slate-100">{props.lastSent.toEmail || props.clientEmail}</b> ·{" "}
            {new Date(props.lastSent.sentAt).toLocaleString("es-ES")}
            {sentInvoice ? <> · factura adjunta <b className="text-slate-100">{sentInvoice}</b></> : sentNow ? " · sin factura" : null}
          </p>
          {props.whatsappText && (
            <button
              type="button"
              onClick={copyWhatsapp}
              className="mt-2 rounded-lg border border-emerald-500/40 px-3 py-1 font-semibold text-emerald-300 hover:bg-emerald-500/10"
            >
              {copied ? "Copiado" : "Copiar texto WhatsApp"}
            </button>
          )}
        </div>
      )}

      <div className="mt-4">
        <p className="text-sm font-semibold text-slate-100">1. Traducción</p>
        {props.files.length > 0 ? (
          <>
            <ul className="mt-2 space-y-1">
              {versions.current.map((f) => (
                <FileRow key={f.url} f={f} checked={selected.has(f.url)} onToggle={() => toggle(f.url)} needsReview={isTranslatorFile(f.url, translatorSet)} reviewed={reviewed.has(f.url)} onReview={(v) => markReviewed(f.url, v)} />
              ))}
            </ul>
            {versions.previous.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-200">
                  Versiones anteriores ({versions.previous.length})
                </summary>
                <ul className="mt-1 space-y-1">
                  {versions.previous.map((f) => (
                    <FileRow key={f.url} f={f} checked={selected.has(f.url)} onToggle={() => toggle(f.url)} needsReview={isTranslatorFile(f.url, translatorSet)} reviewed={reviewed.has(f.url)} onReview={(v) => markReviewed(f.url, v)} />
                  ))}
                </ul>
              </details>
            )}
          </>
        ) : (
          <p className="mt-1 text-xs text-slate-400">Aún no hay traducción subida: sube el archivo abajo.</p>
        )}
        <label className="mt-2 block text-xs text-slate-400">
          {props.files.length > 0 ? "Subir un archivo sustituto o adicional" : "Subir la traducción"}
          <input
            type="file"
            accept=".pdf,.doc,.docx,.zip"
            multiple
            onChange={(e) => {
              addFiles(Array.from(e.target.files || []));
              e.target.value = "";
            }}
            className="mt-1 block w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border file:border-emerald-500/50 file:bg-emerald-600/20 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-emerald-200"
          />
        </label>
        {newFiles.length > 0 && (
          <ul className="mt-2 space-y-1">
            {newFiles.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-lg bg-slate-800/60 px-2.5 py-1.5 text-xs text-slate-200">
                <span className="truncate">{f.name}</span>
                <button type="button" onClick={() => setNewFiles((p) => p.filter((_, j) => j !== i))} className="shrink-0 font-semibold text-red-300 hover:text-red-200">
                  quitar
                </button>
              </li>
            ))}
          </ul>
        )}
        {props.alreadyDelivered && newFiles.length > 0 && (
          <p className="mt-1 text-[11px] text-amber-300">Ya se entregó: lo que subas se envía como versión corregida.</p>
        )}
      </div>

      <div className="mt-5">
        <p className="text-sm font-semibold text-slate-100">2. Revisa datos de facturación</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <label key={f.key} className={`text-xs text-slate-400 ${f.wide ? "sm:col-span-2" : ""}`}>
              {f.label}
              <input
                value={billing[f.key]}
                placeholder={f.key === "fiscalName" ? "Nombre y apellidos o razón social" : undefined}
                onChange={(e) => setBilling((b) => ({ ...b, [f.key]: e.target.value }))}
                className={INPUT}
              />
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs font-semibold text-emerald-300">{invoiceStatusLabel(status)}</p>
        {nifBlocked && <p className="mt-1 text-xs font-semibold text-red-300">{NIF_REQUIRED_MESSAGE}</p>}
      </div>

      <div className="mt-5">
        <p className="text-sm font-semibold text-slate-100">3. Mensaje</p>
        {syntheticEmail && (
          <p className="mt-1 text-[11px] text-amber-300">
            Este cliente no tiene email real: el correo no le llegará. Usa «Copiar texto WhatsApp» tras enviar.
          </p>
        )}
        <label className="mt-2 block text-xs text-slate-400">
          Asunto
          <input value={subjectText} onChange={(e) => setSubject(e.target.value)} className={INPUT} />
        </label>
        <textarea
          value={text}
          onChange={(e) => setMessage(e.target.value)}
          rows={9}
          className={`${INPUT} font-sans`}
        />
        <div className="mt-2 rounded-lg border border-slate-700 bg-slate-950/60 p-2">
          <div className="flex flex-wrap gap-2">
            <input
              value={aiInstruction}
              onChange={(e) => setAiInstruction(e.target.value)}
              placeholder="Instrucción para la IA (opcional): más breve, menciona que el original va por correo…"
              className={`${INPUT} mt-0 min-w-[14rem] flex-1`}
            />
            <button
              type="button"
              disabled={aiLoading}
              onClick={() => adjustWithAi(aiInstruction)}
              className="rounded-lg border border-cyan-500/40 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-50"
            >
              {aiLoading ? "Ajustando…" : "Ajustar con IA"}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {AI_LANGUAGES.map((l) => (
              <button
                key={l}
                type="button"
                disabled={aiLoading}
                onClick={() => adjustWithAi(translateInstruction(l))}
                className="rounded-md border border-slate-600 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800 disabled:opacity-50"
              >
                {l}
              </button>
            ))}
          </div>
          {aiFeedback && (
            <p className={`mt-1.5 text-xs font-semibold ${aiFeedback.ok ? "text-emerald-300" : "text-red-300"}`}>{aiFeedback.text}</p>
          )}
        </div>
        {(message !== null || subject !== null) && (
          <button type="button" onClick={() => { setMessage(null); setSubject(null); setAiFeedback(null); }} className="mt-1 text-[11px] text-slate-400 hover:text-slate-200">
            Restaurar texto por defecto
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={send}
        disabled={sending || nifBlocked || pendingReview.length > 0}
        className="mt-5 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {sending ? "Enviando…" : invoiceOnly ? "Enviar factura" : correction ? "Enviar corrección" : props.lastSent ? "Reenviar" : "Enviar"}
      </button>
      {pendingReview.length > 0 && (
        <p className="mt-2 text-xs font-semibold text-amber-300">
          Revisa los archivos del traductor marcados (casilla «Revisada ✓») para poder enviar.
        </p>
      )}
      {feedback && (
        <p className={`mt-2 text-xs font-semibold ${feedback.ok ? "text-emerald-300" : "text-red-300"}`}>{feedback.text}</p>
      )}
    </div>
  );
}

function FileRow({
  f,
  checked,
  onToggle,
  needsReview,
  reviewed,
  onReview,
}: {
  f: DeliveryFileRef;
  checked: boolean;
  onToggle: () => void;
  needsReview: boolean;
  reviewed: boolean;
  onReview: (value: boolean) => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={onToggle} className="rounded border-slate-500" />
      <span className="truncate text-slate-200">{f.name}</span>
      <a href={f.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs text-cyan-400 hover:underline">
        ver
      </a>
      {needsReview && (
        <label className={`flex shrink-0 items-center gap-1 text-xs ${reviewed ? "text-emerald-300" : "text-amber-300"}`}>
          <input type="checkbox" checked={reviewed} onChange={(e) => onReview(e.target.checked)} className="rounded border-slate-500" />
          {reviewed ? "Revisada ✓" : "Sin revisar"}
        </label>
      )}
    </li>
  );
}
