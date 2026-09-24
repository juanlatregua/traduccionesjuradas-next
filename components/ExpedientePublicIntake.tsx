"use client";

import { useCallback, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { Upload, FileText, X, Loader2, CheckCircle2, AlertTriangle, Mail } from "lucide-react";
import { expedienteT } from "@/lib/i18n/expediente";
import { puertaT } from "@/lib/i18n/puerta";
import type { Locale } from "@/lib/i18n/locales";
import { PUERTA_LANG_CODES, isDeclaredPairValid } from "@/lib/puerta-languages";

// Intake PÚBLICO de expediente (4+ documentos): el cliente sube varios archivos
// de golpe, deja sus datos y nos llega a la zona. No hay precio instantáneo:
// preparamos el presupuesto y se lo enviamos por email.
//
// Puerta (misma regla que la puerta de un documento, orden de Juan 4-sep):
// nombre + email + par de idiomas + consentimiento ANTES de que se active la
// zona de subida. Los expedientes los trabaja Juan a mano: el envío avisa a
// staff, sin presupuesto automático.

type FileRow = {
  localId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  status: "uploading" | "ready" | "error";
  blobUrl?: string;
  error?: string;
};

const MAX_FILE_SIZE = 500 * 1024 * 1024;
const MAX_DOCS = 300;
const PARALLEL = 4; // subidas simultáneas: 60+ a la vez atascaban el navegador (móvil)
const ACCEPTED = ".pdf,.jpg,.jpeg,.png,.heic,.tiff,.tif,.webp,.zip";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function ExpedientePublicIntake({
  initialName = "",
  initialEmail = "",
  initialPhone = "",
  lang = "es",
  source = null,
}: {
  initialName?: string;
  initialEmail?: string;
  initialPhone?: string;
  lang?: Locale;
  // Atribución del funnel (p. ej. "whatsapp"); el servidor aplica su lista blanca.
  source?: string | null;
} = {}) {
  const t = expedienteT[lang];
  const p = puertaT[lang];
  const [rows, setRows] = useState<FileRow[]>([]);
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [notes, setNotes] = useState("");
  const [srcLang, setSrcLang] = useState("");
  const [tgtLang, setTgtLang] = useState("");
  const [gdpr, setGdpr] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ ref: string; token: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pickSource = (code: string) => {
    setSrcLang(code);
    if (code && code !== "es" && (!tgtLang || tgtLang === code)) setTgtLang("es");
    if (code === "es" && tgtLang === "es") setTgtLang("");
  };
  const pairValid = isDeclaredPairValid(srcLang, tgtLang);
  const samePair = Boolean(srcLang && tgtLang && srcLang === tgtLang);
  const emailValid = EMAIL_RE.test(email.trim());
  const gateReady = Boolean(name.trim()) && emailValid && pairValid && gdpr;

  const patch = useCallback((id: string, data: Partial<FileRow>) => {
    setRows((prev) => prev.map((r) => (r.localId === id ? { ...r, ...data } : r)));
  }, []);

  const uploadOne = useCallback(
    async (row: FileRow, file: File) => {
      try {
        const safe = file.name.replace(/[^\w.\- ]+/g, "_").slice(0, 120);
        const blob = await upload(`expedientes/${Date.now()}-${safe}`, file, {
          access: "public",
          handleUploadUrl: "/api/documents/upload",
          // El consentimiento real, no un true fijo: sin casilla (o sin email)
          // el servidor rechaza la subida.
          clientPayload: JSON.stringify({ gdprConsent: gdpr, kind: "expediente", email: email.trim() }),
          // Ficheros grandes por partes: si se corta un trozo se reintenta ese, no todo.
          multipart: file.size > 20 * 1024 * 1024,
        });
        patch(row.localId, { status: "ready", blobUrl: blob.url });
      } catch {
        patch(row.localId, { status: "error", error: t.failed });
      }
    },
    [patch, gdpr, email, t]
  );

  // Cola: como mucho PARALLEL subidas a la vez; el resto espera su turno.
  const filesRef = useRef(new Map<string, File>());
  const queueRef = useRef<FileRow[]>([]);
  const activeRef = useRef(0);
  const pump = useCallback(() => {
    while (activeRef.current < PARALLEL && queueRef.current.length > 0) {
      const row = queueRef.current.shift()!;
      const file = filesRef.current.get(row.localId);
      if (!file) continue;
      activeRef.current++;
      uploadOne(row, file).finally(() => {
        activeRef.current--;
        pump();
      });
    }
  }, [uploadOne]);
  const enqueue = useCallback(
    (row: FileRow) => {
      queueRef.current.push(row);
      pump();
    },
    [pump]
  );

  const handleFiles = useCallback(
    (fileList: FileList) => {
      setError(null);
      // El guard va aquí, no solo en el CSS: un drag&drop o el teclado abren el
      // diálogo aunque la zona esté atenuada.
      if (!gateReady) {
        setError(t.locked);
        return;
      }
      const files = Array.from(fileList).filter((f) => {
        if (f.size > MAX_FILE_SIZE) {
          setError(t.tooLarge(f.name));
          return false;
        }
        return true;
      });
      const space = MAX_DOCS - rows.length;
      if (space <= 0) {
        setError(t.maxDocs(MAX_DOCS));
        return;
      }
      const accepted = files.slice(0, space);
      const newRows: FileRow[] = accepted.map((f) => ({
        localId: uid(),
        fileName: f.name,
        fileSize: f.size,
        mimeType: f.type,
        status: "uploading",
      }));
      setRows((prev) => [...prev, ...newRows]);
      newRows.forEach((row, i) => {
        filesRef.current.set(row.localId, accepted[i]);
        enqueue(row);
      });
    },
    [rows.length, enqueue, gateReady, t]
  );

  const retry = useCallback(
    (row: FileRow) => {
      if (!filesRef.current.get(row.localId)) return;
      patch(row.localId, { status: "uploading", error: undefined });
      enqueue(row);
    },
    [patch, enqueue]
  );

  const ready = rows.filter((r) => r.status === "ready");
  const busy = rows.some((r) => r.status === "uploading");
  const canSubmit = !submitting && !busy && ready.length > 0 && gateReady;

  const handleSubmit = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/expediente/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: name.trim(),
          clientEmail: email.trim(),
          clientPhone: phone.trim() || undefined,
          notes: notes.trim() || undefined,
          gdprConsent: gdpr,
          sourceLanguage: srcLang,
          targetLanguage: tgtLang,
          source: source || undefined,
          lang,
          documents: ready.map((r) => ({
            blobUrl: r.blobUrl,
            fileName: r.fileName,
            fileSize: r.fileSize,
            mimeType: r.mimeType,
          })),
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || t.sendFail);
        setSubmitting(false);
        return;
      }
      setDone({ ref: data.ref, token: data.token });
    } catch {
      setError(t.connFail);
      setSubmitting(false);
    }
  }, [name, email, phone, notes, gdpr, srcLang, tgtLang, source, lang, ready, t]);

  if (done) {
    return (
      <div className="rounded-2xl border border-bleu/20 bg-card p-8 text-center shadow-paper">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden="true" />
        <h2 className="mt-4 font-baskerville text-2xl text-bleu">{t.doneTitle}</h2>
        <p className="mt-2 text-graphite">
          {t.doneRef} <strong>{done.ref}</strong>. {t.doneEmail} <strong>{email}</strong>. {t.doneNext}
        </p>
        <a
          href={`/expediente/${done.token}`}
          className="mt-6 inline-block rounded-xl bg-bleu px-6 py-3 font-semibold text-white hover:bg-bleu-light"
        >
          {t.doneCta}
        </a>
      </div>
    );
  }

  const field =
    "w-full rounded-lg border border-graphite/30 bg-card px-3 py-2.5 text-encre outline-none focus:border-bleu focus:ring-1 focus:ring-bleu/20";

  return (
    <div className="space-y-6">
      {/* Puerta: datos + idiomas + consentimiento ANTES de subir */}
      <div className="rounded-xl border border-bleu/15 bg-card p-5 shadow-paper">
        <p className="flex items-center gap-2 text-sm font-semibold text-encre">
          <Mail className="h-4 w-4 text-bleu" aria-hidden="true" />
          {t.gateTitle}
        </p>
        <p className="mt-1 text-xs text-graphite">{t.gateHelp}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input className={field} placeholder={t.name} aria-label={t.name} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={field} placeholder={t.email} aria-label={t.email} type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <label className="text-xs font-medium text-graphite">
            {p.entrySourceLabel}
            <select value={srcLang} onChange={(e) => pickSource(e.target.value)} className={`${field} mt-1`}>
              <option value="">{p.entryPickLang}</option>
              {PUERTA_LANG_CODES.map((c) => (
                <option key={c} value={c}>{p.langNames[c] || c}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-graphite">
            {p.entryTargetLabel}
            <select value={tgtLang} onChange={(e) => setTgtLang(e.target.value)} className={`${field} mt-1`}>
              <option value="">{p.entryPickLang}</option>
              {PUERTA_LANG_CODES.map((c) => (
                <option key={c} value={c}>{p.langNames[c] || c}</option>
              ))}
            </select>
          </label>
          <input className={field} placeholder={t.phone} aria-label={t.phone} type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <input className={field} placeholder={t.notes} aria-label={t.notes} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        {samePair && <p className="mt-2 text-xs text-rouge">{p.entrySamePair}</p>}
        <label className="mt-3 flex cursor-pointer items-start gap-3 text-xs text-graphite">
          <input type="checkbox" checked={gdpr} onChange={(e) => setGdpr(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 rounded border-graphite/40 text-bleu" />
          <span>
            {t.gdpr}{" "}
            <a href="/privacidad" target="_blank" className="text-bleu underline">{t.privacy}</a>.
          </span>
        </label>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (gateReady) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => {
          if (!gateReady) {
            setError(t.locked);
            return;
          }
          inputRef.current?.click();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (gateReady) inputRef.current?.click();
            else setError(t.locked);
          }
        }}
        className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 transition-all ${
          dragOver ? "border-bleu bg-bleu/[0.04]" : "border-bleu/30 bg-card"
        } ${gateReady ? "cursor-pointer hover:border-bleu/60" : "cursor-not-allowed opacity-50"}`}
        role="button"
        tabIndex={0}
        aria-label={t.dropAria}
        aria-disabled={!gateReady}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-bleu/10">
          <Upload className="h-6 w-6 text-bleu" aria-hidden="true" />
        </div>
        <p className="font-baskerville text-lg text-bleu">{t.dropTitle}</p>
        <p className="text-center text-sm text-graphite">{t.dropHint}</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {!gateReady && <p className="text-xs text-graphite">{t.locked}</p>}

      {/* Lista de archivos */}
      {rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.localId} className="flex items-center gap-3 rounded-lg border border-cream bg-card px-3 py-2">
              <FileText className="h-4 w-4 shrink-0 text-bleu" aria-hidden="true" />
              <span className="flex-1 truncate text-sm text-encre" title={r.fileName}>{r.fileName}</span>
              {r.status === "uploading" && <Loader2 className="h-4 w-4 animate-spin text-bleu" aria-label={t.uploading} />}
              {r.status === "ready" && <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label={t.ready} />}
              {r.status === "error" && (
                <>
                  <AlertTriangle className="h-4 w-4 text-rouge" aria-label={t.failed} />
                  <button type="button" onClick={() => retry(r)} className="min-h-11 text-xs font-semibold text-bleu hover:underline">
                    {t.retry}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setRows((prev) => prev.filter((x) => x.localId !== r.localId))}
                className="flex h-11 w-11 items-center justify-center rounded-full text-graphite hover:bg-cream"
                aria-label={`${t.remove} ${r.fileName}`}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p role="alert" className="rounded-lg border border-rouge/20 bg-rouge/5 px-4 py-3 text-sm text-rouge">{error}</p>}

      <button
        type="button"
        disabled={!canSubmit}
        onClick={handleSubmit}
        className="w-full rounded-xl bg-bleu px-6 py-3.5 font-semibold text-white hover:bg-bleu-light disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
      >
        {submitting ? t.submitSending : busy ? t.submitUploading : t.submit(ready.length)}
      </button>
    </div>
  );
}
