"use client";

import { useRef, useState } from "react";

type Channel = "whatsapp" | "email" | "web" | "telefono";

type CreatedQuickOrder = {
  reference: string;
  paymentUrl: string;
  zonaTraductorPath: string;
  consultaPath: string;
  quickQuotePath: string;
  emailSent: boolean;
  emailSubject?: string | null;
  emailMessageId?: string | null;
};

function toInternalPath(raw: string, fallback: string) {
  const value = String(raw || "").trim();
  if (!value) return fallback;
  if (value.startsWith("/")) return value;
  try {
    const parsed = new URL(value);
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export default function PMQuickCreatePanel() {
  const [clientEmail, setClientEmail] = useState("");
  const [clientName, setClientName] = useState("");
  const [title, setTitle] = useState("");
  const [amountEur, setAmountEur] = useState("");
  const [langPair, setLangPair] = useState("fr-es");
  const [pagesLabel, setPagesLabel] = useState("");
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [urgencyNotes, setUrgencyNotes] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const sourceFileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedQuickOrder | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const idempotencyFingerprintRef = useRef<string | null>(null);

  async function copyPaymentUrl() {
    if (!created?.paymentUrl) return;
    try {
      await navigator.clipboard.writeText(created.paymentUrl);
      setMessage("Enlace de pago copiado.");
    } catch {
      setMessage("No se pudo copiar automaticamente. Copia el enlace manualmente.");
    }
  }

  async function submit() {
    setLoading(true);
    setMessage(null);
    setCreated(null);
    try {
      const amount = Number(String(amountEur || "").replace(",", "."));
      const idempotencyFingerprint = JSON.stringify({
        clientEmail: clientEmail.trim().toLowerCase(),
        clientName: clientName.trim(),
        title: title.trim(),
        amountEur: Number.isFinite(amount) ? amount.toFixed(2) : "NaN",
        langPair: langPair || "",
        pagesLabel: pagesLabel.trim(),
        channel,
      });
      if (idempotencyFingerprintRef.current !== idempotencyFingerprint) {
        idempotencyFingerprintRef.current = idempotencyFingerprint;
        idempotencyKeyRef.current = `pm:${Date.now()}:${Math.random().toString(16).slice(2, 10)}`;
      }
      const idempotencyKey = idempotencyKeyRef.current as string;

      const res = await fetch("/api/orders/pm-create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          clientEmail: clientEmail.trim().toLowerCase(),
          clientName: clientName.trim() || undefined,
          title: title.trim(),
          amountEur: amount,
          langPair: langPair || undefined,
          pagesLabel: pagesLabel.trim() || undefined,
          sourceChannel: channel,
          urgencyNotes: urgencyNotes.trim() || undefined,
          sendEmail,
          idempotencyKey,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "No se pudo crear el pedido.");
      }
      const reference = String(data.order?.reference || "");
      const paymentUrl = String(data.paymentUrl || "");
      const zonaTraductorPath = toInternalPath(
        String(data.zonaTraductorUrl || ""),
        `/zona-traductor?q=${encodeURIComponent(reference)}`
      );
      const consultaPath = toInternalPath(
        String(data.consultaUrl || ""),
        `/consulta?ref=${encodeURIComponent(reference)}&email=${encodeURIComponent(
          clientEmail.trim().toLowerCase()
        )}`
      );
      const quickQuotePath = toInternalPath(
        String(data.quickQuoteUrl || ""),
        `/admin/quotes/new?customerEmail=${encodeURIComponent(
          clientEmail.trim().toLowerCase()
        )}&customerName=${encodeURIComponent(clientName.trim())}&lineDescription=${encodeURIComponent(
          title.trim()
        )}&lineAmount=${encodeURIComponent(String(amount.toFixed(2)))}&langPair=${encodeURIComponent(
          langPair || ""
        )}`
      );
      setCreated({
        reference,
        paymentUrl,
        zonaTraductorPath,
        consultaPath,
        quickQuotePath,
        emailSent: Boolean(data.emailSent),
        emailSubject: data.emailSubject ? String(data.emailSubject) : null,
        emailMessageId: data.emailMessageId ? String(data.emailMessageId) : null,
      });
      // Upload source document if provided
      if (sourceFile && reference) {
        setUploadingDoc(true);
        try {
          const formData = new FormData();
          formData.append("file", sourceFile);
          const docRes = await fetch(`/api/orders/${reference}/documents`, {
            method: "POST",
            body: formData,
          });
          const docData = await docRes.json();
          if (!docRes.ok || !docData.ok) {
            setMessage(`Pedido creado, pero error al subir documento: ${docData.error || "Error desconocido"}`);
            setUploadingDoc(false);
            return;
          }
        } catch {
          setMessage("Pedido creado, pero error de red al subir documento.");
          setUploadingDoc(false);
          return;
        }
        setUploadingDoc(false);
      }

      const warning = data.warning ? ` ${String(data.warning)}` : "";
      const docMsg = sourceFile ? " Documento fuente adjuntado." : "";
      setMessage(`Pedido creado y listo para pago.${docMsg}${warning}`);
    } catch (err: any) {
      setMessage(err?.message || "No se pudo crear el pedido.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto mt-6 max-w-6xl rounded-3xl border border-cyan-500/30 bg-cyan-500/5 p-6 shadow-xl sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
        Alta rápida PM
      </p>
      <h2 className="mt-2 text-lg font-semibold text-white">
        Crear pedido desde WhatsApp/Email y enviar enlace de pago
      </h2>
      <p className="mt-1 text-xs text-slate-300">
        Uso recomendado para leads que entran directos a {`juansilva@traduccionesjuradas.net`} o por WhatsApp.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <input
          type="email"
          value={clientEmail}
          onChange={(e) => setClientEmail(e.target.value)}
          placeholder="Email cliente *"
          className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
        />
        <input
          type="text"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="Nombre cliente (opcional)"
          className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
        />
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titulo/servicio *"
          className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
        />
        <input
          type="number"
          min={1}
          step="0.01"
          value={amountEur}
          onChange={(e) => setAmountEur(e.target.value)}
          placeholder="Importe EUR *"
          className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
        />
        <select
          value={langPair}
          onChange={(e) => setLangPair(e.target.value)}
          className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        >
          <option value="fr-es">fr-es</option>
          <option value="es-fr">es-fr</option>
          <option value="en-es">en-es</option>
          <option value="de-es">de-es</option>
          <option value="it-es">it-es</option>
          <option value="pt-es">pt-es</option>
          <option value="ca-es">ca-es</option>
          <option value="">Sin especificar</option>
        </select>
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value as Channel)}
          className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        >
          <option value="whatsapp">Origen WhatsApp</option>
          <option value="email">Origen Email</option>
          <option value="telefono">Origen Teléfono</option>
          <option value="web">Origen Web</option>
        </select>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <input
          type="text"
          value={pagesLabel}
          onChange={(e) => setPagesLabel(e.target.value)}
          placeholder="Alcance/paginas (opcional)"
          className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
        />
        <input
          type="text"
          value={urgencyNotes}
          onChange={(e) => setUrgencyNotes(e.target.value)}
          placeholder="Notas urgencia (opcional)"
          className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
        />
      </div>

      {/* Source document upload */}
      <div className="mt-3 rounded-xl border border-dashed border-slate-600 bg-slate-950/50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-300">
          Documento original (opcional)
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Adjunta el PDF/imagen del documento a traducir. Se subirá al crear el pedido.
        </p>
        <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-teal-500/40 px-3 py-2 text-xs font-semibold text-teal-300 hover:bg-teal-500/10">
          {sourceFile ? sourceFile.name : "Seleccionar archivo"}
          <input
            ref={sourceFileRef}
            type="file"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
            onChange={(e) => setSourceFile(e.target.files?.[0] || null)}
            className="hidden"
          />
        </label>
        {sourceFile && (
          <button
            type="button"
            onClick={() => {
              setSourceFile(null);
              if (sourceFileRef.current) sourceFileRef.current.value = "";
            }}
            className="ml-2 text-xs text-slate-400 hover:text-red-300"
          >
            Quitar
          </button>
        )}
      </div>

      <label className="mt-3 inline-flex items-center gap-2 text-xs text-slate-300">
        <input
          type="checkbox"
          checked={sendEmail}
          onChange={(e) => setSendEmail(e.target.checked)}
          className="h-4 w-4 rounded border-slate-500 bg-slate-950 text-cyan-500"
        />
        Enviar email automático al cliente con enlace de pago
      </label>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={loading}
          className="rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-600 disabled:opacity-60"
        >
          {loading && !uploadingDoc ? "Creando..." : uploadingDoc ? "Subiendo documento..." : "Crear pedido y habilitar pago"}
        </button>
        {created?.paymentUrl && (
          <>
            <button
              type="button"
              onClick={copyPaymentUrl}
              className="rounded-xl border border-cyan-500/40 px-4 py-2 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/10"
            >
              Copiar enlace pago
            </button>
            <a
              href={created.paymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
            >
              Abrir enlace
            </a>
          </>
        )}
      </div>

      {created && (
        <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-xs text-slate-200">
          <p>
            Referencia creada:{" "}
            <span className="font-mono font-semibold text-cyan-300">{created.reference}</span>
          </p>
          <p className="mt-1">
            Email al cliente:{" "}
            <span className={created.emailSent ? "font-semibold text-emerald-300" : "font-semibold text-amber-300"}>
              {created.emailSent ? "Enviado" : "Pendiente / fallo de envío"}
            </span>
          </p>
          {created.emailSubject && (
            <p className="mt-1 text-slate-300">Asunto: {created.emailSubject}</p>
          )}
          {created.emailMessageId && (
            <p className="mt-1 text-slate-400">ID proveedor: {created.emailMessageId}</p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={`/zona-traductor/workspace/${created.reference}`}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-500"
            >
              Ir al workspace
            </a>
            <a
              href={created.zonaTraductorPath}
              className="rounded-lg border border-slate-600 px-3 py-1.5 font-semibold text-slate-200 hover:bg-slate-800"
            >
              Ver pedido en zona traductor
            </a>
            <a
              href={created.consultaPath}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-slate-600 px-3 py-1.5 font-semibold text-slate-200 hover:bg-slate-800"
            >
              Ver consulta cliente
            </a>
            <a
              href={created.quickQuotePath}
              className="rounded-lg border border-cyan-500/50 px-3 py-1.5 font-semibold text-cyan-300 hover:bg-cyan-500/10"
            >
              Crear presupuesto con preview
            </a>
          </div>
        </div>
      )}
      {message && <p className="mt-2 text-xs font-semibold text-slate-200">{message}</p>}
    </section>
  );
}
