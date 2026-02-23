"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import PayPalButton from "@/components/PayPalButton";

type OrderInfo = {
  reference: string;
  title: string;
  amountCents: number;
  paymentStatus: string;
  workflowState?: string;
  sourceDocuments?: Array<{
    fileUrl: string;
    fileName: string;
    fileType?: string;
    uploadedAt?: string;
  }>;
};

type SourceDocument = {
  fileUrl: string;
  fileName: string;
  fileType?: string;
  uploadedAt?: string;
};

type PaymentTab = "paypal" | "bizum" | "transferencia";

type PaymentCapabilities = {
  cardEnabled: boolean;
  cardProvider: "stripe" | "redsys" | null;
  paypalEnabled: boolean;
  manualProofUploadEnabled: boolean;
};

const MANUAL_PAYMENT = {
  bizumPhone: "+34 607 356 273",
  accountHolder: "HBTJ Consultores Lingüísticos S.L.",
  iban: "ES66 0182 3370 67 0201616991",
  bic: "BBVAESMM",
};

function extractSourceDocumentsFromOrder(rawOrder: any): SourceDocument[] {
  const direct = Array.isArray(rawOrder?.sourceDocuments) ? rawOrder.sourceDocuments : [];
  if (direct.length > 0) {
    return direct
      .map((doc: any) => ({
        fileUrl: String(doc?.fileUrl || doc?.url || "").trim(),
        fileName: String(doc?.fileName || doc?.name || "Documento").trim(),
        fileType: doc?.fileType ? String(doc.fileType) : doc?.type ? String(doc.type) : undefined,
        uploadedAt: doc?.uploadedAt ? String(doc.uploadedAt) : undefined,
      }))
      .filter((doc: SourceDocument) => !!doc.fileUrl);
  }

  const events = Array.isArray(rawOrder?.events) ? rawOrder.events : [];
  return events
    .filter((event: any) => event?.type === "order.source_document_uploaded")
    .map((event: any) => {
      const payload = event?.payload || {};
      return {
        fileUrl: String(payload?.fileUrl || "").trim(),
        fileName: String(payload?.fileName || "Documento").trim(),
        fileType: payload?.fileType ? String(payload.fileType) : undefined,
        uploadedAt: payload?.uploadedAt
          ? String(payload.uploadedAt)
          : event?.createdAt
            ? String(event.createdAt)
            : undefined,
      };
    })
    .filter((doc: SourceDocument) => !!doc.fileUrl);
}

function isImageDocument(doc: SourceDocument) {
  const type = String(doc.fileType || "").toLowerCase();
  const name = doc.fileName.toLowerCase();
  return type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(name);
}

function isPdfDocument(doc: SourceDocument) {
  const type = String(doc.fileType || "").toLowerCase();
  const name = doc.fileName.toLowerCase();
  return type.includes("pdf") || name.endsWith(".pdf");
}

export default function PagarPage() {
  const params = useParams<{ reference: string }>();
  const reference = params.reference;

  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<PaymentTab>("bizum");
  const [capabilities, setCapabilities] = useState<PaymentCapabilities>({
    cardEnabled: false,
    cardProvider: null,
    paypalEnabled: false,
    manualProofUploadEnabled: true,
  });

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [proofSent, setProofSent] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [proofEmail, setProofEmail] = useState("");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceUploading, setSourceUploading] = useState(false);
  const [sourceUploadError, setSourceUploadError] = useState<string | null>(null);
  const [sourceUploaded, setSourceUploaded] = useState(false);
  const [sourceDocuments, setSourceDocuments] = useState<SourceDocument[]>([]);

  useEffect(() => {
    fetch("/api/payment/capabilities")
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok && data.capabilities) {
          setCapabilities(data.capabilities as PaymentCapabilities);
        }
      })
      .catch(() => {
        // Keep optimistic defaults if capabilities endpoint fails.
      });
  }, []);

  useEffect(() => {
    fetch(`/api/orders/${reference}`)
      .then((r) => {
        if (r.status === 401) return fetch(`/api/orders/${reference}/public`);
        return r;
      })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          const docs = extractSourceDocumentsFromOrder(data.order);
          setOrder(data.order);
          setSourceDocuments(docs);
          setSourceUploaded(docs.length > 0);
        } else {
          setError(data.error || "Pedido no encontrado.");
        }
      })
      .catch(() => setError("Error de conexion."))
      .finally(() => setLoading(false));
  }, [reference]);

  useEffect(() => {
    if (tab !== "bizum" && tab !== "transferencia" && tab !== "paypal") {
      setUploadError(null);
      setFile(null);
    }
  }, [tab]);

  const acceptsProofUpload = tab === "bizum" || tab === "transferencia" || tab === "paypal";

  const handlePayPalSuccess = useCallback(() => {
    window.location.assign(`/pago/exito?ref=${encodeURIComponent(reference)}`);
  }, [reference]);

  function formatMoney(cents: number) {
    return `${(cents / 100).toFixed(2)} EUR`;
  }

  function renderSourceDocumentsPreview(theme: "default" | "success" = "default") {
    const isSuccess = theme === "success";
    const titleCls = isSuccess ? "text-emerald-900" : "text-slate-900";
    const hintCls = isSuccess ? "text-emerald-700" : "text-slate-600";
    const accentBorder = isSuccess ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-slate-50";
    const buttonCls = isSuccess
      ? "bg-emerald-700 hover:bg-emerald-800"
      : "bg-slate-800 hover:bg-slate-700";

    return (
      <div className={`mt-7 rounded-2xl border p-4 ${isSuccess ? "border-emerald-200 bg-white" : "border-slate-200 bg-slate-50"}`}>
        <p className={`text-sm font-semibold ${titleCls}`}>Revisa tu documento</p>
        {sourceDocuments.length > 0 ? (
          <p className={`mt-1 text-xs ${hintCls}`}>
            Ya hemos recibido {sourceDocuments.length} documento(s). Revisa miniatura y abre el archivo para confirmar que es correcto.
          </p>
        ) : (
          <p className={`mt-1 text-xs ${hintCls}`}>
            Si ya lo enviaste por email o WhatsApp, no necesitas subirlo de nuevo.
            Solo adjúntalo aquí si quieres reemplazarlo o asegurarte de que aparece en el pedido.
          </p>
        )}

        {sourceDocuments.length > 0 && (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {sourceDocuments.map((doc, idx) => (
              <li key={`${doc.fileUrl}-${idx}`} className={`rounded-xl border p-2 ${accentBorder}`}>
                <div className="flex items-start gap-2">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
                    {isImageDocument(doc) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={doc.fileUrl} alt={doc.fileName} className="h-full w-full object-cover" />
                    ) : isPdfDocument(doc) ? (
                      <object data={doc.fileUrl} type="application/pdf" className="h-full w-full">
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-500">PDF</div>
                      </object>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-500">DOC</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-800">{doc.fileName}</p>
                    {doc.uploadedAt && (
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {new Date(doc.uploadedAt).toLocaleString("es-ES")}
                      </p>
                    )}
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex text-[11px] font-semibold text-emerald-700 hover:underline"
                    >
                      Abrir documento
                    </a>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-3">
          <p className="text-xs font-semibold text-slate-700">Subir o reemplazar documento (opcional)</p>
          {sourceUploaded && (
            <p className="mt-1 text-[11px] font-semibold text-emerald-700">
              Documento fuente registrado correctamente.
            </p>
          )}
          <input
            type="file"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.txt"
            onChange={(e) => {
              setSourceFile(e.target.files?.[0] || null);
              setSourceUploadError(null);
            }}
            className={`mt-2 block w-full text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white ${buttonCls}`}
            disabled={!capabilities.manualProofUploadEnabled}
          />
          {sourceUploadError && <p className="mt-2 text-xs text-red-600">{sourceUploadError}</p>}
          <button
            type="button"
            onClick={handleUploadSourceDocument}
            disabled={!sourceFile || sourceUploading || !capabilities.manualProofUploadEnabled}
            className={`mt-3 rounded-2xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-60 ${buttonCls}`}
          >
            {sourceUploading ? "Subiendo..." : "Guardar documento en el pedido"}
          </button>
        </div>
      </div>
    );
  }

  async function handleUploadProof() {
    if (!capabilities.manualProofUploadEnabled) {
      setUploadError("La subida automatica de justificantes esta temporalmente no disponible.");
      return;
    }
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const selectedMethod = tab === "transferencia" ? "TRANSFER" : tab === "paypal" ? "PAYPAL" : "BIZUM";
      formData.append("method", selectedMethod);
      if (proofEmail.trim()) {
        formData.append("clientEmail", proofEmail.trim().toLowerCase());
      }
      const res = await fetch(`/api/orders/${reference}/payment-proof`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Error al subir el comprobante.");
      }
      setProofSent(true);
    } catch (err: any) {
      setUploadError(err?.message || "Error al subir el comprobante.");
    } finally {
      setUploading(false);
    }
  }

  async function handleUploadSourceDocument() {
    if (!capabilities.manualProofUploadEnabled) {
      setSourceUploadError("La subida automatica de documentos esta temporalmente no disponible.");
      return;
    }
    if (!sourceFile) return;
    setSourceUploading(true);
    setSourceUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", sourceFile);
      if (proofEmail.trim()) {
        formData.append("clientEmail", proofEmail.trim().toLowerCase());
      }
      const res = await fetch(`/api/orders/${reference}/documents`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Error al subir el documento.");
      }
      const uploadedDoc = data?.document
        ? {
            fileUrl: String(data.document.fileUrl || "").trim(),
            fileName: String(data.document.fileName || "Documento").trim(),
            fileType: data.document.fileType ? String(data.document.fileType) : undefined,
            uploadedAt: data.document.uploadedAt ? String(data.document.uploadedAt) : undefined,
          }
        : null;
      if (uploadedDoc?.fileUrl) {
        setSourceDocuments((prev) => {
          const dedupe = prev.filter((doc) => doc.fileUrl !== uploadedDoc.fileUrl);
          return [uploadedDoc, ...dedupe];
        });
      }
      setSourceUploaded(true);
      setSourceFile(null);
    } catch (err: any) {
      setSourceUploadError(err?.message || "Error al subir el documento.");
    } finally {
      setSourceUploading(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-sm text-slate-600">Cargando datos del pedido...</p>
      </main>
    );
  }

  if (error && !order) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <section className="rounded-3xl border border-red-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm text-red-600">{error}</p>
          <Link href="/" className="mt-3 inline-block text-sm font-semibold text-emerald-700 hover:underline">
            Volver al inicio
          </Link>
        </section>
      </main>
    );
  }

  if (!order) return null;

  if (order.paymentStatus === "PAID") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <section className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold text-emerald-700">Este pedido ya esta pagado.</p>
          <Link href={`/pago/exito?ref=${encodeURIComponent(order.reference)}`} className="mt-3 inline-block text-sm font-semibold text-emerald-700 hover:underline">
            Ver confirmacion de pago
          </Link>
          <br />
          <Link href="/consulta" className="mt-2 inline-block text-sm font-semibold text-emerald-700 hover:underline">
            Consultar estado del pedido
          </Link>
        </section>
      </main>
    );
  }

  if (["BORRADOR", "PENDIENTE_REVISION"].includes(String(order.workflowState || ""))) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold text-amber-800">Pedido en revisión interna</p>
          <p className="mt-2 text-sm text-amber-700">
            Tu pedido <span className="font-mono">{order.reference}</span> se está validando antes de habilitar el pago.
            Te avisaremos por email cuando esté listo.
          </p>
          <Link href="/consulta" className="mt-4 inline-block text-sm font-semibold text-amber-800 underline">
            Consultar estado del pedido
          </Link>
        </section>
      </main>
    );
  }

  // After proof uploaded successfully
  if (proofSent) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm sm:p-8">
          <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <svg className="h-7 w-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-emerald-800">Pago registrado</h2>
          <p className="mt-2 text-sm text-emerald-700">
            Hemos recibido tu comprobante para el pedido <span className="font-mono font-semibold">{reference}</span> y ya ha quedado marcado como pagado.
          </p>
          <p className="mt-1 text-sm text-emerald-600">
            Te hemos enviado la confirmacion por email y puedes seguir el avance desde tu area cliente.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/consulta"
              className="rounded-2xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              Consultar estado del pedido
            </Link>
            <Link
              href="/"
              className="text-sm font-semibold text-emerald-700 hover:underline"
            >
              Volver al inicio
            </Link>
          </div>
          </div>

          {renderSourceDocumentsPreview("success")}
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
          Pagar pedido
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
          {order.title}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Referencia: <span className="font-mono">{order.reference}</span> · Importe:{" "}
          <span className="font-semibold">{formatMoney(order.amountCents)}</span>
        </p>
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          Selecciona Bizum, transferencia o PayPal y adjunta el justificante para que el pedido quede marcado como pagado automaticamente.
        </p>

        {renderSourceDocumentsPreview("default")}

        {/* Tabs */}
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab("paypal")}
            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
              tab === "paypal"
                ? "bg-blue-700 text-white"
                : "border border-slate-300 text-slate-700 hover:bg-slate-100"
            }`}
          >
            PayPal
          </button>
          <button
            type="button"
            onClick={() => setTab("bizum")}
            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
              tab === "bizum"
                ? "bg-blue-700 text-white"
                : "border border-slate-300 text-slate-700 hover:bg-slate-100"
            }`}
          >
            Bizum
          </button>
          <button
            type="button"
            onClick={() => setTab("transferencia")}
            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
              tab === "transferencia"
                ? "bg-blue-700 text-white"
                : "border border-slate-300 text-slate-700 hover:bg-slate-100"
            }`}
          >
            Transferencia
          </button>
        </div>

        {tab === "paypal" && (
          <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-5">
            <p className="text-sm font-semibold text-blue-900">Pago con PayPal</p>
            {capabilities.paypalEnabled ? (
              <>
                <p className="mt-1 text-xs text-blue-700">
                  Completa el pago en PayPal. Al confirmar, te llevamos automaticamente a la confirmacion.
                </p>
                <div className="mt-4 max-w-sm">
                  <PayPalButton reference={reference} onSuccess={handlePayPalSuccess} />
                </div>
              </>
            ) : (
              <>
                <p className="mt-1 text-xs text-blue-700">
                  PayPal no esta automatizado en este entorno.
                  {" "}
                  Puedes pagar por Bizum/transferencia o subir aqui el justificante de tu pago por PayPal para activar el pedido.
                </p>
                <p className="mt-3 rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs text-blue-800">
                  Concepto recomendado en PayPal: <span className="font-mono font-semibold">{order.reference}</span>
                </p>
              </>
            )}
          </div>
        )}

        {/* Bizum */}
        {tab === "bizum" && (
          <div className="mt-6">
            <p className="text-sm text-slate-700">
              Realiza un Bizum con los siguientes datos:
            </p>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              <p className="text-sm">
                <span className="font-semibold">Telefono:</span>{" "}
                <span className="font-mono">{MANUAL_PAYMENT.bizumPhone}</span>
              </p>
              <p className="text-sm">
                <span className="font-semibold">Concepto:</span>{" "}
                <span className="font-mono">{order.reference}</span>
              </p>
              <p className="text-sm">
                <span className="font-semibold">Importe:</span>{" "}
                <span className="font-mono">{formatMoney(order.amountCents)}</span>
              </p>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Incluye la referencia <span className="font-mono font-semibold">{order.reference}</span> en el concepto.
            </p>
          </div>
        )}

        {/* Transferencia */}
        {tab === "transferencia" && (
          <div className="mt-6">
            <p className="text-sm text-slate-700">
              Realiza una transferencia bancaria con los siguientes datos:
            </p>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              <p className="text-sm">
                <span className="font-semibold">Titular:</span> {MANUAL_PAYMENT.accountHolder}
              </p>
              <p className="text-sm">
                <span className="font-semibold">IBAN:</span>{" "}
                <span className="font-mono">{MANUAL_PAYMENT.iban}</span>
              </p>
              <p className="text-sm">
                <span className="font-semibold">BIC/SWIFT:</span>{" "}
                <span className="font-mono">{MANUAL_PAYMENT.bic}</span>
              </p>
              <p className="text-sm">
                <span className="font-semibold">Concepto:</span>{" "}
                <span className="font-mono">{order.reference}</span>
              </p>
              <p className="text-sm">
                <span className="font-semibold">Importe:</span>{" "}
                <span className="font-mono">{formatMoney(order.amountCents)}</span>
              </p>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Incluye la referencia <span className="font-mono font-semibold">{order.reference}</span> en el concepto.
            </p>
          </div>
        )}

        {/* Upload comprobante */}
        {acceptsProofUpload && (
          <div className="mt-8 rounded-2xl border border-blue-100 bg-blue-50 p-5">
            <h3 className="text-sm font-semibold text-blue-900">
              Adjunta tu comprobante de pago
            </h3>
            <p className="mt-1 text-xs text-blue-700">
              {tab === "paypal"
                ? "Sube el justificante de PayPal para registrar el pago automaticamente."
                : "Sube una captura del Bizum o el justificante de la transferencia para registrar el pago automaticamente."}
            </p>
            <div className="mt-4">
              <label htmlFor="proofEmail" className="mb-1 block text-xs font-semibold text-blue-800">
                Email del pedido (recomendado si no has iniciado sesion)
              </label>
              <input
                id="proofEmail"
                type="email"
                value={proofEmail}
                onChange={(e) => setProofEmail(e.target.value)}
                placeholder="tu@email.com"
                className="mb-3 block w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm text-slate-700"
                disabled={!capabilities.manualProofUploadEnabled}
              />
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null);
                  setUploadError(null);
                }}
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-blue-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-200 disabled:opacity-60"
                disabled={!capabilities.manualProofUploadEnabled}
              />
            </div>
            {uploadError && <p className="mt-2 text-xs text-red-600">{uploadError}</p>}
            {!capabilities.manualProofUploadEnabled && (
              <p className="mt-2 text-xs font-semibold text-amber-800">
                La subida automatica de justificantes esta temporalmente no disponible.
              </p>
            )}
            <button
              type="button"
              onClick={handleUploadProof}
              disabled={!file || uploading || !capabilities.manualProofUploadEnabled}
              className="mt-4 rounded-2xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {uploading ? "Enviando..." : "Enviar comprobante"}
            </button>
          </div>
        )}

        <div className="mt-6">
          <Link href="/" className="text-sm font-semibold text-emerald-700 hover:underline">
            Volver al inicio
          </Link>
        </div>
      </section>
    </main>
  );
}
