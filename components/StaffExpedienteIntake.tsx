"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { Loader2, Upload, X, FileText, CheckCircle2, AlertTriangle } from "lucide-react";

// Intake de expediente para STAFF: soltar N PDFs → extraer datos con el pipeline
// barato (Haiku/texto o Sonnet/visión) → tabla editable → generar presupuesto.

type DocStatus = "uploading" | "analyzing" | "done" | "error" | "manual";

// Una línea es facturable (se puede incluir y ponerle precio) si está analizada,
// si dio error (precio a mano) o si es una línea manual sin documento.
function isPriceable(status: DocStatus): boolean {
  return status === "done" || status === "error" || status === "manual";
}

type DocRow = {
  localId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  status: DocStatus;
  error?: string;
  include: boolean;
  // datos extraídos
  documentTypeEs?: string;
  sourceLang?: string;
  sourceName?: string;
  targetLang?: string;
  targetName?: string;
  words?: number;
  pages?: number;
  mode?: "text" | "vision";
  unitPrice: number; // editable, pre-IVA
};

const LANGS: { code: string; name: string }[] = [
  { code: "es", name: "Español" },
  { code: "fr", name: "Francés" },
  { code: "en", name: "Inglés" },
  { code: "de", name: "Alemán" },
  { code: "it", name: "Italiano" },
  { code: "pt", name: "Portugués" },
  { code: "ca", name: "Catalán" },
  { code: "nl", name: "Neerlandés" },
  { code: "sv", name: "Sueco" },
  { code: "no", name: "Noruego" },
  { code: "ar", name: "Árabe" },
  { code: "ro", name: "Rumano" },
];

const CONCURRENCY = 3;
const ACCEPTED = ".pdf,.jpg,.jpeg,.png,.heic,.tiff,.tif,.webp";

function suggestVolumeDiscountPct(count: number): number {
  if (count >= 10) return 15;
  if (count >= 5) return 10;
  if (count >= 3) return 5;
  return 0;
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function runPool<T>(items: T[], worker: (item: T) => Promise<void>, limit: number) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      await worker(items[idx]);
    }
  });
  await Promise.all(runners);
}

type Props = {
  // Expediente entrante ya subido por el cliente: se analizan por documentId.
  initialDocs?: { documentId: string; fileName: string }[];
  initialCustomer?: { name?: string; email?: string; phone?: string };
  expedienteRef?: string | null;
};

export default function StaffExpedienteIntake({ initialDocs, initialCustomer, expedienteRef }: Props = {}) {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [customerName, setCustomerName] = useState(initialCustomer?.name || "");
  const [customerEmail, setCustomerEmail] = useState(initialCustomer?.email || "");
  const [customerPhone, setCustomerPhone] = useState(initialCustomer?.phone || "");
  const [sourceLang, setSourceLang] = useState("");
  const [targetLang, setTargetLang] = useState("");
  const [discountPct, setDiscountPct] = useState(0);
  const [discountTouched, setDiscountTouched] = useState(false);
  const [validityDays, setValidityDays] = useState(15);
  const [notesLegal, setNotesLegal] = useState("");
  const [marginPct, setMarginPct] = useState(30);
  const [deliveryType, setDeliveryType] = useState<"DIGITAL_PDF" | "PAPER_SHIP">("DIGITAL_PDF");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<string[]>(["bbva", "openbank", "bizum607"]);
  const [contactWhatsapp, setContactWhatsapp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const patch = useCallback((localId: string, data: Partial<DocRow>) => {
    setDocs((prev) => prev.map((d) => (d.localId === localId ? { ...d, ...data } : d)));
  }, []);

  const processFile = useCallback(
    async (row: DocRow, file: File) => {
      try {
        const safeName = file.name.replace(/[^\w.\- ]+/g, "_").slice(0, 120);
        const blob = await upload(`expedientes/${Date.now()}-${safeName}`, file, {
          access: "public",
          handleUploadUrl: "/api/documents/upload",
          clientPayload: JSON.stringify({ gdprConsent: true }),
        });

        patch(row.localId, { status: "analyzing" });

        const res = await fetch("/api/zona-traductor/expediente/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            blobUrl: blob.url,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type || "application/pdf",
          }),
        });
        const data = await res.json();
        if (!data.ok) {
          patch(row.localId, { status: "error", error: data.error || "Error al analizar." });
          return;
        }
        const d = data.document;
        patch(row.localId, {
          status: "done",
          documentTypeEs: d.documentTypeEs,
          sourceLang: d.sourceLang,
          sourceName: d.sourceName,
          targetLang: d.targetLang,
          targetName: d.targetName,
          words: d.words,
          pages: d.pages,
          mode: data.mode,
          unitPrice: Number(d.basePrice) || 0,
        });
        // Sugerir dirección global desde el primer documento analizado.
        setSourceLang((cur) => cur || d.sourceLang || "");
        setTargetLang((cur) => cur || d.targetLang || "");
      } catch (err: any) {
        patch(row.localId, { status: "error", error: "Error de conexión." });
      }
    },
    [patch]
  );

  const handleFiles = useCallback(
    async (fileList: FileList) => {
      const files = Array.from(fileList);
      if (!files.length) return;
      const rows: DocRow[] = files.map((f) => ({
        localId: uid(),
        fileName: f.name,
        fileSize: f.size,
        mimeType: f.type,
        status: "uploading",
        include: true,
        unitPrice: 0,
      }));
      setDocs((prev) => [...prev, ...rows]);
      if (!discountTouched) {
        setDiscountPct(suggestVolumeDiscountPct(docs.length + rows.length));
      }
      const pairs = rows.map((row, i) => ({ row, file: files[i] }));
      await runPool(pairs, ({ row, file }) => processFile(row, file), CONCURRENCY);
      // Re-sugerir descuento por volumen con los documentos finalizados.
      if (!discountTouched) {
        setDocs((cur) => {
          const includedDone = cur.filter((d) => d.include && d.status === "done").length;
          setDiscountPct(suggestVolumeDiscountPct(includedDone));
          return cur;
        });
      }
    },
    [docs.length, discountTouched, processFile]
  );

  // Preload: expediente entrante ya subido por el cliente → analizar por id.
  useEffect(() => {
    if (!initialDocs || initialDocs.length === 0) return;
    setDocs(
      initialDocs.map((d) => ({
        localId: d.documentId,
        fileName: d.fileName,
        fileSize: 0,
        mimeType: "application/pdf",
        status: "analyzing" as DocStatus,
        include: true,
        unitPrice: 0,
      }))
    );
    const analyzeExisting = async (d: { documentId: string }) => {
      try {
        const res = await fetch("/api/zona-traductor/expediente/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId: d.documentId }),
        });
        const data = await res.json();
        if (!data.ok) {
          patch(d.documentId, { status: "error", error: data.error || "Error al analizar." });
          return;
        }
        const doc = data.document;
        patch(d.documentId, {
          status: "done",
          documentTypeEs: doc.documentTypeEs,
          sourceLang: doc.sourceLang,
          sourceName: doc.sourceName,
          targetLang: doc.targetLang,
          targetName: doc.targetName,
          words: doc.words,
          pages: doc.pages,
          mode: data.mode,
          unitPrice: Number(doc.basePrice) || 0,
        });
        setSourceLang((cur) => cur || doc.sourceLang || "");
        setTargetLang((cur) => cur || doc.targetLang || "");
      } catch {
        patch(d.documentId, { status: "error", error: "Error de conexión." });
      }
    };
    runPool(initialDocs, analyzeExisting, CONCURRENCY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addManualLine = useCallback(() => {
    setDocs((prev) => [
      ...prev,
      {
        localId: uid(),
        fileName: "",
        fileSize: 0,
        mimeType: "",
        status: "manual" as DocStatus,
        include: true,
        unitPrice: 0,
      },
    ]);
  }, []);

  // El campo editable de cada línea es el COSTE del traductor (sin IVA).
  // El precio al cliente se deriva aplicando el margen.
  const clientPriceOf = useCallback(
    (cost: number) => Math.round((cost || 0) * (1 + marginPct / 100) * 100) / 100,
    [marginPct]
  );

  const togglePaymentMethod = useCallback((m: string) => {
    setPaymentMethods((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  }, []);

  const includedDocs = docs.filter((d) => d.include && isPriceable(d.status));
  const costTotal = useMemo(
    () => includedDocs.reduce((s, d) => s + (d.unitPrice || 0), 0),
    [includedDocs]
  );
  const subtotal = useMemo(
    () => includedDocs.reduce((s, d) => s + clientPriceOf(d.unitPrice), 0),
    [includedDocs, clientPriceOf]
  );
  const shipping = deliveryType === "PAPER_SHIP" ? 12 : 0;
  const discountAmount = Math.min(subtotal + shipping, (subtotal * discountPct) / 100);
  const taxable = Math.max(0, subtotal + shipping - discountAmount);
  const vat = taxable * 0.21;
  const total = taxable + vat;

  const busy = docs.some((d) => d.status === "uploading" || d.status === "analyzing");
  const hasEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail);
  const hasPhone = customerPhone.trim().length >= 6;
  const missing: string[] = [];
  if (includedDocs.length === 0) missing.push("una línea con precio");
  if (!customerName.trim()) missing.push("nombre del cliente");
  if (!hasEmail && !hasPhone) missing.push("email o teléfono del cliente");
  if (!sourceLang) missing.push("idioma origen");
  if (!targetLang) missing.push("idioma destino");
  const canSubmit = !submitting && !busy && missing.length === 0;

  const handleSubmit = useCallback(async () => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const lines = includedDocs.map((d) => {
        const baseName = d.documentTypeEs || d.fileName.trim() || "Línea";
        const dirSrc = d.sourceName || d.sourceLang || sourceLang;
        const dirTgt = d.targetName || d.targetLang || targetLang;
        const parts: string[] = [];
        if (dirSrc && dirTgt) parts.push(`${dirSrc}→${dirTgt}`);
        if (d.words) parts.push(`${d.words} palabras`);
        if (d.pages && d.pages > 1) parts.push(`${d.pages} págs`);
        return {
          description: parts.length ? `${baseName} (${parts.join(", ")})` : baseName,
          quantity: 1,
          unitPrice: clientPriceOf(d.unitPrice), // precio CLIENTE = coste × (1+margen)
          supplierUnitCost: d.unitPrice, // coste del traductor (interno)
        };
      });
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim(),
          customerPhone: customerPhone.trim() || undefined,
          sourceLang,
          targetLang,
          deliveryType,
          expedienteRef: expedienteRef || undefined,
          discountType: discountPct > 0 ? "PERCENT" : "NONE",
          discountValue: discountPct,
          vatRate: 0.21,
          validityDays,
          notesLegal: [deliveryNote.trim() ? `Plazo de entrega: ${deliveryNote.trim()}.` : "", notesLegal.trim()].filter(Boolean).join(" ") || undefined,
          marginPct,
          paymentMethods,
          contactWhatsapp: contactWhatsapp.trim() || undefined,
          lines,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setSubmitError(data.error || "No se pudo crear el presupuesto.");
        setSubmitting(false);
        return;
      }
      window.location.href = `/admin/quotes/${data.quote.id}`;
    } catch {
      setSubmitError("Error de conexión al crear el presupuesto.");
      setSubmitting(false);
    }
  }, [includedDocs, customerName, customerEmail, customerPhone, sourceLang, targetLang, discountPct, validityDays, notesLegal, expedienteRef, clientPriceOf, marginPct, paymentMethods, contactWhatsapp, deliveryType, deliveryNote]);

  return (
    <div className="space-y-6 text-slate-200">
      {/* Dropzone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-cyan-700/50 bg-slate-900/50 px-6 py-10 transition-colors hover:border-cyan-500"
        role="button"
        tabIndex={0}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cyan-500/10">
          <Upload className="h-6 w-6 text-cyan-400" />
        </div>
        <p className="font-semibold text-white">Arrastra los documentos del expediente</p>
        <p className="text-sm text-slate-400">PDF, foto o escaneo · varios a la vez · máx. 20 MB c/u</p>
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

      {/* Añadir una línea a mano (sin documento) */}
      <div>
        <button
          type="button"
          onClick={addManualLine}
          className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
        >
          + Añadir línea manual
        </button>
        <span className="ml-2 text-xs text-slate-500">Para presupuestar sin subir documento, o añadir conceptos sueltos.</span>
      </div>

      {/* Tabla de documentos */}
      {docs.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/60 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2"></th>
                <th className="px-3 py-2">Documento</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Dirección</th>
                <th className="px-3 py-2 text-right">Palabras</th>
                <th className="px-3 py-2 text-right">Coste traductor</th>
                <th className="px-3 py-2 text-right">Precio cliente</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {docs.map((d) => (
                <tr key={d.localId} className={d.include ? "" : "opacity-40"}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={d.include}
                      disabled={d.status === "uploading" || d.status === "analyzing"}
                      onChange={(e) => patch(d.localId, { include: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-600"
                    />
                  </td>
                  <td className="max-w-[220px] px-3 py-2">
                    {d.status === "manual" ? (
                      <input
                        type="text"
                        value={d.fileName}
                        onChange={(e) => patch(d.localId, { fileName: e.target.value })}
                        placeholder="Concepto de la línea"
                        className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-slate-500" />
                        <span className="truncate" title={d.fileName}>{d.fileName}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {d.status === "uploading" && (
                      <span className="flex items-center gap-1 text-slate-400"><Loader2 className="h-3 w-3 animate-spin" /> Subiendo…</span>
                    )}
                    {d.status === "analyzing" && (
                      <span className="flex items-center gap-1 text-cyan-400"><Loader2 className="h-3 w-3 animate-spin" /> Analizando…</span>
                    )}
                    {d.status === "error" && (
                      <span className="flex items-center gap-1 text-amber-400" title={d.error}><AlertTriangle className="h-3 w-3" /> Error · precio a mano</span>
                    )}
                    {d.status === "manual" && (
                      <span className="text-slate-400">Línea manual</span>
                    )}
                    {d.status === "done" && (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                        {d.documentTypeEs}
                        {d.mode === "text" && (
                          <span className="ml-1 rounded bg-emerald-500/15 px-1 text-[10px] text-emerald-300" title="Analizado por texto (barato)">texto</span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-300">
                    {d.status === "done" ? (
                      `${(d.sourceLang || sourceLang || "?").toUpperCase()}→${(d.targetLang || targetLang || "?").toUpperCase()}`
                    ) : d.status === "error" || d.status === "manual" ? (
                      <div className="flex items-center gap-1">
                        <select
                          value={d.sourceLang || ""}
                          onChange={(e) => patch(d.localId, { sourceLang: e.target.value || undefined })}
                          className="rounded border border-slate-600 bg-slate-900 px-1 py-1 text-xs"
                        >
                          <option value="">orig</option>
                          {LANGS.map((l) => <option key={l.code} value={l.code}>{l.code.toUpperCase()}</option>)}
                        </select>
                        <span>→</span>
                        <select
                          value={d.targetLang || ""}
                          onChange={(e) => patch(d.localId, { targetLang: e.target.value || undefined })}
                          className="rounded border border-slate-600 bg-slate-900 px-1 py-1 text-xs"
                        >
                          <option value="">dest</option>
                          {LANGS.map((l) => <option key={l.code} value={l.code}>{l.code.toUpperCase()}</option>)}
                        </select>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-300">
                    {d.status === "done" ? (
                      d.words ?? "—"
                    ) : d.status === "error" || d.status === "manual" ? (
                      <input
                        type="number"
                        min={0}
                        value={d.words ?? ""}
                        onChange={(e) => patch(d.localId, { words: e.target.value === "" ? undefined : Number(e.target.value) })}
                        placeholder="palabras"
                        className="w-20 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-right tabular-nums"
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isPriceable(d.status) ? (
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={d.unitPrice}
                        onChange={(e) => patch(d.localId, { unitPrice: Number(e.target.value) })}
                        className="w-24 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-right tabular-nums"
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-white">
                    {isPriceable(d.status) ? `${clientPriceOf(d.unitPrice).toFixed(2)} €` : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setDocs((prev) => prev.filter((x) => x.localId !== d.localId))}
                      className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                      aria-label="Quitar"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Datos del cliente + presupuesto */}
      {docs.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/40 p-4">
            <h3 className="text-sm font-semibold text-white">Cliente</h3>
            <input className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2" placeholder="Nombre del cliente" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            <input className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2" placeholder="Email" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
            <input className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2" placeholder="Teléfono (opcional)" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
          </div>

          <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/40 p-4">
            <h3 className="text-sm font-semibold text-white">Presupuesto</h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-slate-400">
                Idioma origen
                <select className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-2 py-2 text-slate-200" value={sourceLang} onChange={(e) => setSourceLang(e.target.value)}>
                  <option value="">—</option>
                  {LANGS.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
                </select>
              </label>
              <label className="text-xs text-slate-400">
                Idioma destino
                <select className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-2 py-2 text-slate-200" value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
                  <option value="">—</option>
                  {LANGS.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
                </select>
              </label>
              <label className="text-xs text-slate-400">
                Descuento volumen (%)
                <input type="number" min={0} max={100} value={discountPct} onChange={(e) => { setDiscountTouched(true); setDiscountPct(Number(e.target.value)); }} className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-2 py-2" />
              </label>
              <label className="text-xs text-slate-400">
                Validez (días)
                <input type="number" min={1} value={validityDays} onChange={(e) => setValidityDays(Number(e.target.value))} className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-2 py-2" />
              </label>
              <label className="text-xs text-slate-400">
                Tipo de entrega
                <select value={deliveryType} onChange={(e) => setDeliveryType(e.target.value as "DIGITAL_PDF" | "PAPER_SHIP")} className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-2 py-2 text-slate-200">
                  <option value="DIGITAL_PDF">PDF con certificado digital</option>
                  <option value="PAPER_SHIP">Envío en papel (+12 € + IVA)</option>
                </select>
              </label>
              <label className="text-xs text-slate-400">
                Plazo de entrega
                <input value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)} placeholder="ej. 3-4 días hábiles" className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-2 py-2" />
              </label>
            </div>
            {sourceLang && targetLang && docs.some((d) => d.status === "done" && (d.sourceLang !== sourceLang || d.targetLang !== targetLang)) && (
              <p className="text-xs text-amber-400">⚠ Hay documentos con dirección distinta a la del presupuesto. La dirección de cada doc va en su línea; el par del presupuesto es informativo.</p>
            )}

            {/* Margen sobre el coste del traductor (interno; el cliente solo ve su precio) */}
            <div className="border-t border-slate-700 pt-3">
              <label className="text-xs text-slate-400">Margen sobre coste del traductor (%)</label>
              <div className="mt-1 flex items-center gap-2">
                <input type="number" min={0} value={marginPct} onChange={(e) => setMarginPct(Math.max(0, Number(e.target.value)))} className="w-24 rounded border border-slate-600 bg-slate-900 px-2 py-2" />
                {[30, 40].map((m) => (
                  <button key={m} type="button" onClick={() => setMarginPct(m)} className={`rounded border px-2 py-1 text-xs ${marginPct === m ? "border-cyan-500 bg-cyan-600/20 text-cyan-200" : "border-slate-600 text-slate-300 hover:bg-slate-800"}`}>{m}%</button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">El cliente solo ve el precio final. Coste y margen quedan internos.</p>
            </div>

            {/* Formas de pago a mostrar en el PDF + WhatsApp del presupuesto */}
            <div className="border-t border-slate-700 pt-3">
              <label className="text-xs text-slate-400">Formas de pago en el presupuesto</label>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-300">
                {[
                  { id: "bbva", label: "BBVA" },
                  { id: "openbank", label: "Openbank" },
                  { id: "bizum607", label: "Bizum 607356273" },
                  { id: "bizum654", label: "Bizum 654069126" },
                  { id: "paypal", label: "PayPal" },
                ].map((m) => (
                  <label key={m.id} className="flex items-center gap-1">
                    <input type="checkbox" checked={paymentMethods.includes(m.id)} onChange={() => togglePaymentMethod(m.id)} />
                    {m.label}
                  </label>
                ))}
              </div>
              <input value={contactWhatsapp} onChange={(e) => setContactWhatsapp(e.target.value)} placeholder="WhatsApp para este presupuesto (opcional; por defecto 951 333 614)" className="mt-2 w-full rounded border border-slate-600 bg-slate-900 px-2 py-2 text-sm" />
            </div>
          </div>
        </div>
      )}

      {/* Totales + acción */}
      {includedDocs.length > 0 && (
        <div className="flex flex-col items-end gap-3 rounded-xl border border-slate-700 bg-slate-900/40 p-4">
          <div className="w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between text-slate-400"><span>Subtotal</span><span className="tabular-nums">{subtotal.toFixed(2)} €</span></div>
            {discountPct > 0 && <div className="flex justify-between text-emerald-400"><span>Descuento {discountPct}%</span><span className="tabular-nums">-{discountAmount.toFixed(2)} €</span></div>}
            {shipping > 0 && <div className="flex justify-between text-slate-400"><span>Envío papel</span><span className="tabular-nums">{shipping.toFixed(2)} €</span></div>}
            <div className="flex justify-between text-slate-400"><span>IVA 21%</span><span className="tabular-nums">{vat.toFixed(2)} €</span></div>
            <div className="flex justify-between border-t border-slate-700 pt-1 text-base font-semibold text-white"><span>Total</span><span className="tabular-nums">{total.toFixed(2)} €</span></div>
            <div className="mt-1 flex justify-between border-t border-dashed border-slate-700 pt-1 text-[11px] text-slate-500" title="Solo visible para ti, no aparece en el presupuesto del cliente">
              <span>Interno · coste {costTotal.toFixed(2)} € · margen {marginPct}%</span>
              <span className="tabular-nums">+{(subtotal - costTotal).toFixed(2)} €</span>
            </div>
          </div>
          {submitError && <p className="text-sm text-amber-400">{submitError}</p>}
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="rounded-xl bg-cyan-600 px-5 py-2.5 font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Creando…" : `Generar presupuesto (${includedDocs.length} doc${includedDocs.length > 1 ? "s" : ""})`}
          </button>
          {!canSubmit && !submitting && missing.length > 0 && (
            <p className="text-xs text-amber-400">Falta: {missing.join(", ")}.</p>
          )}
          <p className="text-xs text-slate-500">Se crea como borrador en /admin/quotes para revisar y enviar.</p>
        </div>
      )}
    </div>
  );
}
