"use client";

import { useCallback, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { Upload, FileText, X, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

// Intake PÚBLICO de expediente (4+ documentos): el cliente sube varios archivos
// de golpe, deja sus datos y nos llega a la zona. No hay precio instantáneo:
// preparamos el presupuesto y se lo enviamos por email.

type FileRow = {
  localId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  status: "uploading" | "ready" | "error";
  blobUrl?: string;
  error?: string;
};

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_DOCS = 40;
const ACCEPTED = ".pdf,.jpg,.jpeg,.png,.heic,.tiff,.tif,.webp";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function ExpedientePublicIntake({
  initialName = "",
  initialEmail = "",
  initialPhone = "",
}: {
  initialName?: string;
  initialEmail?: string;
  initialPhone?: string;
} = {}) {
  const [rows, setRows] = useState<FileRow[]>([]);
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [notes, setNotes] = useState("");
  const [gdpr, setGdpr] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ ref: string; token: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
          clientPayload: JSON.stringify({ gdprConsent: true }),
        });
        patch(row.localId, { status: "ready", blobUrl: blob.url });
      } catch {
        patch(row.localId, { status: "error", error: "No se pudo subir" });
      }
    },
    [patch]
  );

  const handleFiles = useCallback(
    (fileList: FileList) => {
      setError(null);
      const files = Array.from(fileList).filter((f) => {
        if (f.size > MAX_FILE_SIZE) {
          setError(`"${f.name}" supera los 20 MB y se ha omitido.`);
          return false;
        }
        return true;
      });
      const space = MAX_DOCS - rows.length;
      if (space <= 0) {
        setError(`Máximo ${MAX_DOCS} documentos por expediente.`);
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
      newRows.forEach((row, i) => uploadOne(row, accepted[i]));
    },
    [rows.length, uploadOne]
  );

  const ready = rows.filter((r) => r.status === "ready");
  const busy = rows.some((r) => r.status === "uploading");
  const canSubmit =
    !submitting && !busy && ready.length > 0 && name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && gdpr;

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
        setError(data.error || "No se pudo enviar el expediente.");
        setSubmitting(false);
        return;
      }
      setDone({ ref: data.ref, token: data.token });
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
      setSubmitting(false);
    }
  }, [name, email, phone, notes, gdpr, ready]);

  if (done) {
    return (
      <div className="rounded-2xl border border-bleu/20 bg-card p-8 text-center shadow-paper">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
        <h2 className="mt-4 font-baskerville text-2xl text-bleu">Expediente recibido</h2>
        <p className="mt-2 text-graphite">
          Referencia <strong>{done.ref}</strong>. Te hemos enviado un email de confirmación a{" "}
          <strong>{email}</strong>. Prepararemos tu presupuesto y te lo mandaremos por email.
        </p>
        <a
          href={`/expediente/${done.token}`}
          className="mt-6 inline-block rounded-xl bg-bleu px-6 py-3 font-semibold text-white hover:bg-bleu-light"
        >
          Consultar mi expediente
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 transition-all ${
          dragOver ? "border-bleu bg-bleu/[0.04]" : "border-bleu/30 bg-card hover:border-bleu/60"
        }`}
        role="button"
        tabIndex={0}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-bleu/10">
          <Upload className="h-6 w-6 text-bleu" />
        </div>
        <p className="font-baskerville text-lg text-bleu">Arrastra todos tus documentos</p>
        <p className="text-sm text-graphite">PDF, fotos o escaneos · varios a la vez · máx. 20 MB c/u</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* Lista de archivos */}
      {rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.localId} className="flex items-center gap-3 rounded-lg border border-cream bg-card px-3 py-2">
              <FileText className="h-4 w-4 shrink-0 text-bleu" />
              <span className="flex-1 truncate text-sm text-encre" title={r.fileName}>{r.fileName}</span>
              {r.status === "uploading" && <Loader2 className="h-4 w-4 animate-spin text-bleu" />}
              {r.status === "ready" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              {r.status === "error" && <AlertTriangle className="h-4 w-4 text-rouge" />}
              <button
                type="button"
                onClick={() => setRows((prev) => prev.filter((x) => x.localId !== r.localId))}
                className="rounded-full p-1 text-graphite hover:bg-cream"
                aria-label="Quitar"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Datos de contacto */}
      <div className="grid gap-3 sm:grid-cols-2">
        <input className="rounded-lg border border-graphite/30 bg-card px-3 py-2.5 text-encre" placeholder="Nombre y apellidos" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="rounded-lg border border-graphite/30 bg-card px-3 py-2.5 text-encre" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="rounded-lg border border-graphite/30 bg-card px-3 py-2.5 text-encre sm:col-span-1" placeholder="Teléfono (opcional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input className="rounded-lg border border-graphite/30 bg-card px-3 py-2.5 text-encre sm:col-span-1" placeholder="¿Para qué trámite? (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <label className="flex items-start gap-3 text-xs text-graphite">
        <input type="checkbox" checked={gdpr} onChange={(e) => setGdpr(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-graphite/40 text-bleu" />
        <span>
          Consiento el tratamiento de mis documentos para preparar un presupuesto de traducción jurada. Se eliminan
          automáticamente a los 30 días.{" "}
          <a href="/privacidad" target="_blank" className="text-bleu underline">Política de privacidad</a>.
        </span>
      </label>

      {error && <p className="rounded-lg border border-rouge/20 bg-rouge/5 px-4 py-3 text-sm text-rouge">{error}</p>}

      <button
        type="button"
        disabled={!canSubmit}
        onClick={handleSubmit}
        className="w-full rounded-xl bg-bleu px-6 py-3.5 font-semibold text-white hover:bg-bleu-light disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
      >
        {submitting ? "Enviando…" : busy ? "Subiendo documentos…" : `Enviar expediente (${ready.length} doc${ready.length === 1 ? "" : "s"})`}
      </button>
    </div>
  );
}
