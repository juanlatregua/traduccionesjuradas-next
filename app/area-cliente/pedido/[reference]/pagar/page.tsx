"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import PayPalButton from "@/components/PayPalButton";
import CopyField from "@/components/CopyField";

type OrderInfo = {
  reference: string;
  title: string;
  amountCents: number;
  currency?: string;
  paymentStatus: string;
  status?: string;
  paymentBlocked?: boolean;
  hasSourceDocument?: boolean;
  workflowState?: string;
  items?: Array<{
    description: string;
    quantity: number;
    amountCents: number;
  }>;
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

type PaymentTab = "tarjeta" | "paypal" | "bizum" | "transferencia";

type PaymentCapabilities = {
  cardEnabled: boolean;
  cardProvider: "stripe" | "redsys" | null;
  paypalEnabled: boolean;
  manualProofUploadEnabled: boolean;
};

const MANUAL_PAYMENT = {
  bizumPhone: process.env.NEXT_PUBLIC_BIZUM_IDENTIFIER || "+34 607 356 273",
  accountHolder: process.env.NEXT_PUBLIC_TRANSFER_ACCOUNT_HOLDER || "HBTJ Consultores Lingüísticos S.L.",
  iban: process.env.NEXT_PUBLIC_TRANSFER_IBAN || "ES66 0182 3370 67 0201616991",
  bic: process.env.NEXT_PUBLIC_TRANSFER_BIC || "BBVAESMM",
  paypalLink: process.env.NEXT_PUBLIC_PAYPAL_MANUAL_LINK || "",
  paypalAccount: process.env.NEXT_PUBLIC_PAYPAL_ACCOUNT || "hola@traduccionesjuradas.net",
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
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const [cardLoading, setCardLoading] = useState(false);
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
  const sourceInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch("/api/payment/capabilities")
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok && data.capabilities) {
          const caps = data.capabilities as PaymentCapabilities;
          setCapabilities(caps);
          setTab((prev) => {
            if (prev === "tarjeta" && !caps.cardEnabled) return "bizum";
            if (prev !== "tarjeta" && caps.cardEnabled) return "tarjeta";
            return prev;
          });
        }
      })
      .catch(() => {
        // Keep optimistic defaults if capabilities endpoint fails.
      });
  }, []);

  useEffect(() => {
    if (!copyToast) return;
    const timeout = window.setTimeout(() => setCopyToast(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [copyToast]);

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
          setSourceUploaded(Boolean(data.order?.hasSourceDocument) || docs.length > 0);
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

  const hasSourceDocument = useMemo(
    () => sourceUploaded || sourceDocuments.length > 0,
    [sourceDocuments, sourceUploaded]
  );
  const paymentBlockedBySource = !hasSourceDocument;
  const acceptsProofUpload =
    hasSourceDocument && (tab === "bizum" || tab === "transferencia" || (tab === "paypal" && !capabilities.paypalEnabled));

  const handleCopied = useCallback((label: string) => {
    setCopyToast(`Copiado: ${label}`);
  }, []);

  const handlePayPalSuccess = useCallback(() => {
    window.location.assign(`/pago/exito?ref=${encodeURIComponent(reference)}`);
  }, [reference]);

  const handleCardCheckout = useCallback(async () => {
    if (paymentBlockedBySource) {
      setUploadError("Sube el documento original antes de continuar al pago.");
      sourceInputRef.current?.focus();
      return;
    }
    setCardLoading(true);
    setUploadError(null);
    try {
      const res = await fetch("/api/payment/card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "No se pudo iniciar el pago con tarjeta.");
      }
      if (data.kind === "redsys_form") {
        const form = document.createElement("form");
        form.method = "POST";
        form.action = data.gatewayUrl;
        const fields: Record<string, string> = {
          Ds_SignatureVersion: data.signatureVersion,
          Ds_MerchantParameters: data.merchantParameters,
          Ds_Signature: data.signature,
        };
        for (const [key, value] of Object.entries(fields)) {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = key;
          input.value = value;
          form.appendChild(input);
        }
        document.body.appendChild(form);
        form.submit();
        return;
      }
      if (data.url) {
        window.location.assign(String(data.url));
        return;
      }
      throw new Error("No se recibió URL de pago.");
    } catch (err: any) {
      setUploadError(err?.message || "No se pudo iniciar el pago con tarjeta.");
    } finally {
      setCardLoading(false);
    }
  }, [paymentBlockedBySource, reference]);

  function formatMoney(cents: number) {
    return `${(cents / 100).toFixed(2)} EUR`;
  }

  function renderSourceDocumentsPreview(theme: "default" | "success" = "default") {
    const isSuccess = theme === "success";
    const titleCls = isSuccess ? "text-bleu" : "text-encre";
    const hintCls = isSuccess ? "text-bleu" : "text-sepia";
    const accentBorder = isSuccess ? "border-cream bg-cream/60" : "border-cream bg-parchment";
    const buttonCls = isSuccess
      ? "bg-bleu-dark hover:bg-bleu-dark"
      : "bg-encre hover:bg-bleu-dark";

    return (
      <div className={`mt-7 rounded-2xl border p-4 ${isSuccess ? "border-cream bg-card" : "border-cream bg-parchment"}`}>
        <p className={`text-sm font-semibold ${titleCls}`}>Revisa tu documento</p>
        {hasSourceDocument ? (
          <p className={`mt-1 text-xs ${hintCls}`}>
            {sourceDocuments.length > 0
              ? `Ya hemos recibido ${sourceDocuments.length} documento(s). Revisa miniatura y abre el archivo para confirmar que es correcto.`
              : "Ya consta al menos un documento en el pedido. Puedes subir otro si necesitas reemplazarlo."}
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
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-cream bg-card">
                    {isImageDocument(doc) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={doc.fileUrl} alt={doc.fileName} className="h-full w-full object-cover" />
                    ) : isPdfDocument(doc) ? (
                      <object data={doc.fileUrl} type="application/pdf" className="h-full w-full">
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-graphite">PDF</div>
                      </object>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-graphite">DOC</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-encre">{doc.fileName}</p>
                    {doc.uploadedAt && (
                      <p className="mt-0.5 text-[11px] text-graphite">
                        {new Date(doc.uploadedAt).toLocaleString("es-ES")}
                      </p>
                    )}
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex text-[11px] font-semibold text-bleu hover:underline"
                    >
                      Abrir documento
                    </a>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 rounded-xl border border-dashed border-cream bg-card p-3">
          <p className="text-xs font-semibold text-sepia">
              {hasSourceDocument
                ? "Subir o reemplazar documento"
                : "Subir documento original (obligatorio para pagar)"}
          </p>
          {sourceUploaded && (
            <p className="mt-1 text-[11px] font-semibold text-bleu">
              Documento fuente registrado correctamente.
            </p>
          )}
          <input
            ref={sourceInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.txt"
            onChange={(e) => {
              setSourceFile(e.target.files?.[0] || null);
              setSourceUploadError(null);
            }}
            className={`mt-2 block w-full text-sm text-sepia file:mr-3 file:rounded-xl file:border-0 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white ${buttonCls}`}
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
    if (paymentBlockedBySource) {
      setUploadError("Debes subir primero el documento original para poder enviar el comprobante.");
      sourceInputRef.current?.focus();
      return;
    }
    if (!capabilities.manualProofUploadEnabled) {
      setUploadError("La subida automática de justificantes está temporalmente no disponible.");
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
      setSourceUploadError("La subida automática de documentos está temporalmente no disponible.");
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
        <p className="text-sm text-sepia">Cargando datos del pedido...</p>
      </main>
    );
  }

  if (error && !order) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <section className="rounded-3xl border border-red-200 bg-card p-6 shadow-sm sm:p-8">
          <p className="text-sm text-red-600">{error}</p>
          <Link href="/" className="mt-3 inline-block text-sm font-semibold text-bleu hover:underline">
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
        <section className="rounded-3xl border border-cream bg-card p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold text-bleu">Este pedido ya está pagado.</p>
          <Link href={`/pago/exito?ref=${encodeURIComponent(order.reference)}`} className="mt-3 inline-block text-sm font-semibold text-bleu hover:underline">
            Ver confirmación de pago
          </Link>
          <br />
          <Link href="/consulta" className="mt-2 inline-block text-sm font-semibold text-bleu hover:underline">
            Consultar estado del pedido
          </Link>
        </section>
      </main>
    );
  }

  if (order.paymentBlocked || ["BORRADOR", "PENDIENTE_REVISION"].includes(String(order.workflowState || ""))) {
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
        <section className="rounded-3xl border border-cream bg-cream p-6 shadow-sm sm:p-8">
          <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-cream">
            <svg className="h-7 w-7 text-bleu" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-bleu">Pago registrado</h2>
          <p className="mt-2 text-sm text-bleu">
            Hemos recibido tu comprobante para el pedido <span className="font-mono font-semibold">{reference}</span> y ya ha quedado marcado como pagado.
          </p>
          <p className="mt-1 text-sm text-bleu">
            Te hemos enviado la confirmación por email y puedes seguir el avance desde tu área de cliente.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/consulta"
              className="rounded-2xl bg-bleu-dark px-5 py-2.5 text-sm font-semibold text-white hover:bg-bleu-dark"
            >
              Consultar estado del pedido
            </Link>
            <Link
              href="/"
              className="text-sm font-semibold text-bleu hover:underline"
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
      <section className="rounded-3xl border border-cream bg-card p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
          Pagar pedido
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-encre">
          {order.title}
        </h1>
        <p className="mt-1 text-sm text-sepia">
          Referencia: <span className="font-mono">{order.reference}</span> · Importe:{" "}
          <span className="font-semibold">{formatMoney(order.amountCents)}</span>
        </p>
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          Flujo recomendado: revisa tu documento, elige método de pago y confirma el justificante si aplica.
        </p>
        {paymentBlockedBySource && (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
            Para continuar al pago primero debes subir al menos un documento original.
          </p>
        )}

        {renderSourceDocumentsPreview("default")}

        {/* Tabs */}
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab("tarjeta")}
            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
              tab === "tarjeta"
                ? "bg-blue-700 text-white"
                : "border border-cream text-sepia hover:bg-cream"
            }`}
          >
            Tarjeta
          </button>
          <button
            type="button"
            onClick={() => setTab("paypal")}
            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
              tab === "paypal"
                ? "bg-blue-700 text-white"
                : "border border-cream text-sepia hover:bg-cream"
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
                : "border border-cream text-sepia hover:bg-cream"
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
                : "border border-cream text-sepia hover:bg-cream"
            }`}
          >
            Transferencia
          </button>
        </div>

        {tab === "tarjeta" && (
          <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-5">
            <p className="text-sm font-semibold text-blue-900">Pago con tarjeta</p>
            {capabilities.cardEnabled ? (
              <>
                <p className="mt-1 text-xs text-blue-700">
                  El pago se procesa de forma segura y la confirmación se refleja automáticamente.
                </p>
                <button
                  type="button"
                  onClick={handleCardCheckout}
                  disabled={cardLoading || paymentBlockedBySource}
                  className="mt-3 rounded-2xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {cardLoading ? "Redirigiendo..." : "Pagar con tarjeta ahora"}
                </button>
              </>
            ) : (
              <p className="mt-1 text-xs text-blue-700">
                Tarjeta no disponible en este entorno. Usa Bizum, transferencia o PayPal manual.
              </p>
            )}
          </div>
        )}

        {tab === "paypal" && (
          <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-5">
            <p className="text-sm font-semibold text-blue-900">Pago con PayPal</p>
            {capabilities.paypalEnabled ? (
              <>
                <p className="mt-1 text-xs text-blue-700">
                  Completa el pago en PayPal. Al confirmar, te llevamos automáticamente a la confirmación.
                </p>
                {paymentBlockedBySource ? (
                  <p className="mt-3 text-xs font-semibold text-red-700">
                    Sube primero el documento original para habilitar PayPal.
                  </p>
                ) : (
                  <div className="mt-4 max-w-sm">
                    <PayPalButton reference={reference} onSuccess={handlePayPalSuccess} />
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="mt-1 text-xs text-blue-700">
                  PayPal no está automatizado en este entorno.
                  {" "}Puedes pagar por Bizum/transferencia o usar PayPal manual y subir justificante.
                </p>
                <div className="mt-3 space-y-2">
                  {MANUAL_PAYMENT.paypalLink ? (
                    <CopyField
                      label="Enlace PayPal"
                      value={MANUAL_PAYMENT.paypalLink}
                      actionLabel="Abrir"
                      actionHref={MANUAL_PAYMENT.paypalLink}
                      onCopied={handleCopied}
                    />
                  ) : (
                    <CopyField
                      label="Cuenta PayPal"
                      value={MANUAL_PAYMENT.paypalAccount}
                      onCopied={handleCopied}
                    />
                  )}
                  <CopyField label="Concepto" value={order.reference} onCopied={handleCopied} />
                </div>
              </>
            )}
          </div>
        )}

        {/* Bizum */}
        {tab === "bizum" && (
          <div className="mt-6">
            <p className="text-sm text-sepia">
              Realiza un Bizum con los siguientes datos:
            </p>
            <div className="mt-4 space-y-2 rounded-2xl border border-cream bg-parchment p-4">
              <CopyField label="Bizum" value={MANUAL_PAYMENT.bizumPhone} onCopied={handleCopied} />
              <CopyField label="Concepto" value={order.reference} onCopied={handleCopied} />
              <CopyField label="Importe" value={formatMoney(order.amountCents)} mono={false} onCopied={handleCopied} />
            </div>
            <p className="mt-3 text-xs text-graphite">
              Incluye la referencia <span className="font-mono font-semibold">{order.reference}</span> en el concepto.
            </p>
          </div>
        )}

        {/* Transferencia */}
        {tab === "transferencia" && (
          <div className="mt-6">
            <p className="text-sm text-sepia">
              Realiza una transferencia bancaria con los siguientes datos:
            </p>
            <div className="mt-4 space-y-2 rounded-2xl border border-cream bg-parchment p-4">
              <CopyField label="Beneficiario" value={MANUAL_PAYMENT.accountHolder} mono={false} onCopied={handleCopied} />
              <CopyField label="IBAN" value={MANUAL_PAYMENT.iban} onCopied={handleCopied} />
              <CopyField label="BIC/SWIFT" value={MANUAL_PAYMENT.bic} onCopied={handleCopied} />
              <CopyField label="Concepto" value={order.reference} onCopied={handleCopied} />
              <CopyField label="Importe" value={formatMoney(order.amountCents)} mono={false} onCopied={handleCopied} />
            </div>
            <p className="mt-3 text-xs text-graphite">
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
                ? "Sube el justificante de PayPal para registrar el pago automáticamente."
                : "Sube una captura del Bizum o el justificante de la transferencia para registrar el pago automáticamente."}
            </p>
            <div className="mt-4">
              <label htmlFor="proofEmail" className="mb-1 block text-xs font-semibold text-blue-800">
                Email del pedido (recomendado si no has iniciado sesión)
              </label>
              <input
                id="proofEmail"
                type="email"
                value={proofEmail}
                onChange={(e) => setProofEmail(e.target.value)}
                placeholder="tu@email.com"
                className="mb-3 block w-full rounded-xl border border-blue-200 bg-card px-3 py-2 text-sm text-sepia"
                disabled={!capabilities.manualProofUploadEnabled}
              />
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null);
                  setUploadError(null);
                }}
                className="block w-full text-sm text-sepia file:mr-3 file:rounded-xl file:border-0 file:bg-blue-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-200 disabled:opacity-60"
                disabled={!capabilities.manualProofUploadEnabled || paymentBlockedBySource}
              />
            </div>
            {uploadError && <p className="mt-2 text-xs text-red-600">{uploadError}</p>}
            {!capabilities.manualProofUploadEnabled && (
              <p className="mt-2 text-xs font-semibold text-amber-800">
                La subida automática de justificantes está temporalmente no disponible.
              </p>
            )}
            {paymentBlockedBySource && (
              <p className="mt-2 text-xs font-semibold text-amber-800">
                Sube primero el documento original para habilitar el envío del comprobante.
              </p>
            )}
            <button
              type="button"
              onClick={handleUploadProof}
              disabled={!file || uploading || !capabilities.manualProofUploadEnabled || paymentBlockedBySource}
              className="mt-4 rounded-2xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {uploading ? "Enviando..." : "Enviar comprobante"}
            </button>
          </div>
        )}

        <div className="mt-6">
          <Link href="/" className="text-sm font-semibold text-bleu hover:underline">
            Volver al inicio
          </Link>
        </div>
      </section>
      {copyToast && (
        <p className="fixed bottom-4 left-1/2 z-[220] -translate-x-1/2 rounded-full bg-encre px-3 py-1 text-xs font-semibold text-white">
          {copyToast}
        </p>
      )}
    </main>
  );
}
