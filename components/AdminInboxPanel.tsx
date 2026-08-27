"use client";

// components/AdminInboxPanel.tsx
//
// Bandeja de entrada del buzón en el admin: emails de clientes sincronizados
// desde Graph, casados con presupuesto/pedido, con borrador de respuesta IA
// editable y envío en el mismo hilo. La respuesta NUNCA sale sin que el staff
// la revise y pulse enviar.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";

export type InboxRow = {
  id: string;
  channel: "EMAIL" | "WHATSAPP";
  isManual: boolean; // WhatsApp dado de alta a mano (sin sender API)
  fromPhone: string | null;
  media: { url: string; contentType: string; name: string; size: number }[];
  fromEmail: string;
  fromName: string | null;
  subject: string;
  bodyPreview: string;
  bodyText: string | null;
  receivedAt: string;
  status: string;
  customerId: string | null;
  quoteId: string | null;
  orderReference: string | null;
  /** Traducciones ya entregadas en el pedido casado: se adjuntan por defecto al responder. */
  deliveredFileCount?: number;
  draftSubject: string | null;
  draftBody: string | null;
  replySubject: string | null;
  replyBody: string | null;
  repliedAt: string | null;
  brief: {
    summary?: string;
    urgency?: string | null;
    provisional?: boolean;
    provisionalReason?: string | null;
    questions?: string[];
  } | null;
};

const STATUS_LABEL: Record<string, string> = {
  NEW: "Nuevo",
  DRAFTED: "Con borrador",
  REPLIED: "Respondido",
  ARCHIVED: "Archivado",
};

const STATUS_STYLE: Record<string, string> = {
  NEW: "bg-amber-100 text-amber-800",
  DRAFTED: "bg-sky-100 text-sky-800",
  REPLIED: "bg-emerald-100 text-emerald-800",
  ARCHIVED: "bg-slate-100 text-slate-500",
};

const VISTAS = [
  { key: "pendientes", label: "Pendientes" },
  { key: "respondidos", label: "Respondidos" },
  { key: "archivados", label: "Archivados" },
  { key: "todos", label: "Todos" },
] as const;

function EmailCard({
  row,
  onUpdate,
}: {
  row: InboxRow;
  onUpdate: (id: string, patch: Partial<InboxRow>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(row.draftSubject || `RE: ${row.subject}`);
  const [body, setBody] = useState(row.draftBody || "");
  const [attachFiles, setAttachFiles] = useState((row.deliveredFileCount || 0) > 0);
  const [instruction, setInstruction] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [building, setBuilding] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const replied = row.status === "REPLIED";

  async function generateDraft() {
    setDrafting(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/inbox/${row.id}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "No se pudo generar el borrador.");
      setSubject(data.draft.subject);
      setBody(data.draft.body);
      onUpdate(row.id, {
        draftSubject: data.draft.subject,
        draftBody: data.draft.body,
        status: data.status,
      });
      setFeedback({ ok: true, text: "✓ Borrador generado. Revísalo y edítalo antes de enviar." });
    } catch (err: any) {
      setFeedback({ ok: false, text: `✗ ${err?.message || "Error al generar."}` });
    } finally {
      setDrafting(false);
    }
  }

  async function sendReply(manual = false) {
    if (!body.trim()) {
      setFeedback({ ok: false, text: "✗ El mensaje está vacío." });
      return;
    }
    if (!window.confirm(`¿Enviar esta respuesta a ${row.fromEmail}?`)) return;
    setSending(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/inbox/${row.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, manual, attachFiles }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "No se pudo enviar.");
      onUpdate(row.id, {
        status: "REPLIED",
        replySubject: subject,
        replyBody: body,
        repliedAt: new Date().toISOString(),
      });
      const n = Number(data?.fileCount || 0);
      setFeedback({ ok: true, text: n > 0 ? `✓ Respuesta enviada en el mismo hilo con ${n} adjunto${n === 1 ? "" : "s"}.` : "✓ Respuesta enviada en el mismo hilo." });
    } catch (err: any) {
      setFeedback({ ok: false, text: `✗ ${err?.message || "Error al enviar."}` });
    } finally {
      setSending(false);
    }
  }

  async function toggleArchive() {
    setArchiving(true);
    try {
      const res = await fetch(`/api/admin/inbox/${row.id}/archive`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "No se pudo archivar.");
      onUpdate(row.id, { status: data.status });
    } catch (err: any) {
      setFeedback({ ok: false, text: `✗ ${err?.message || "Error al archivar."}` });
    } finally {
      setArchiving(false);
    }
  }

  // Email → builder: trae los adjuntos como expediente y abre el presupuesto
  // con el cliente y el propio email a la vista. Idempotente en el servidor.
  async function buildQuote() {
    setBuilding(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/inbox/${row.id}/expediente`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "No se pudo preparar el presupuesto.");
      const parts: string[] = [];
      if (data.ref) {
        parts.push(
          data.reused
            ? `Expediente ${data.ref} ya existía (${data.docs} doc.)`
            : `Expediente ${data.ref} con ${data.docs} documento${data.docs === 1 ? "" : "s"} del email`
        );
      } else {
        parts.push("El email no trae documentos utilizables: builder con el cliente prerrellenado");
      }
      if (Array.isArray(data.skipped) && data.skipped.length) {
        parts.push(`omitidos: ${data.skipped.join(", ")}`);
      }
      setFeedback({ ok: true, text: `✓ ${parts.join(" · ")}. Builder abierto en otra pestaña.` });
      window.open(data.url, "_blank", "noopener");
    } catch (err: any) {
      setFeedback({ ok: false, text: `✗ ${err?.message || "Error al preparar el presupuesto."}` });
    } finally {
      setBuilding(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400";

  return (
    <li className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left"
      >
        <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[row.status] || ""}`}>
          {STATUS_LABEL[row.status] || row.status}
        </span>
        {row.channel === "WHATSAPP" && (
          <span className="rounded-md bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800">WhatsApp</span>
        )}
        <span className="text-sm font-semibold text-slate-900">
          {row.fromName || (row.channel === "WHATSAPP" ? row.fromPhone : row.fromEmail)}
        </span>
        {row.media.length > 0 && (
          <span className="text-xs text-slate-500">📎 {row.media.length}</span>
        )}
        <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{row.subject}</span>
        <span className="text-xs text-slate-400">
          {new Date(row.receivedAt).toLocaleString("es-ES")}
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-slate-100 px-4 py-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500">
              De:{" "}
              <strong className="text-slate-800">
                {row.channel === "WHATSAPP" ? row.fromPhone || row.fromEmail : row.fromEmail}
              </strong>
            </span>
            {row.quoteId && (
              <Link
                href={`/admin/quotes/${row.quoteId}`}
                className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                Ver presupuesto →
              </Link>
            )}
            {row.orderReference && (
              <Link
                href={`/zona-traductor/pedido/${row.orderReference}`}
                className="rounded-md border border-indigo-300 bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-700 hover:bg-indigo-100"
              >
                Ver pedido {row.orderReference} →
              </Link>
            )}
            {!row.customerId && !row.quoteId && !row.orderReference && (
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-500">
                Sin ficha de cliente conocida
              </span>
            )}
            {!replied && (
              <button
                type="button"
                onClick={buildQuote}
                disabled={building}
                className="ml-auto rounded-md border border-sky-300 bg-sky-50 px-2 py-0.5 font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-50"
                title="Trae los adjuntos del email como expediente y abre el builder con el cliente y el email a la vista"
              >
                {building ? "Preparando…" : "Montar presupuesto desde este email →"}
              </button>
            )}
            <button
              type="button"
              onClick={toggleArchive}
              disabled={archiving}
              className={`${replied ? "ml-auto " : ""}rounded-md border border-slate-300 px-2 py-0.5 font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50`}
            >
              {row.status === "ARCHIVED" ? "Desarchivar" : "Archivar"}
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Mensaje del cliente
            </p>
            <p className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap text-sm text-slate-800">
              {row.bodyText || row.bodyPreview}
            </p>
            {row.media.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2 text-xs">
                {row.media.map((m, i) => (
                  <li key={i}>
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 font-medium text-slate-700 hover:bg-slate-100"
                    >
                      📎 {m.name} · {Math.max(1, Math.round(m.size / 1024))} KB
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {row.brief && (row.brief.summary || row.brief.provisional || (row.brief.questions || []).length > 0) && (
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
              <p className="font-semibold uppercase tracking-wide text-sky-700">Lectura IA del email</p>
              {row.brief.summary && <p className="mt-1">{row.brief.summary}</p>}
              <div className="mt-1 flex flex-wrap gap-1.5">
                {row.brief.urgency === "urgent" && (
                  <span className="rounded bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">Urgente</span>
                )}
                {row.brief.provisional && (
                  <span className="rounded bg-rose-100 px-2 py-0.5 font-semibold text-rose-800">Documento provisional</span>
                )}
              </div>
              {(row.brief.questions || []).length > 0 && (
                <ul className="mt-1 list-disc pl-5">
                  {(row.brief.questions || []).map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              )}
              <p className="mt-1 text-[11px] text-sky-700/80">El borrador IA ya incluye estas preguntas y salvedades.</p>
            </div>
          )}

          {replied && row.replyBody ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Respuesta enviada
                {row.repliedAt ? ` · ${new Date(row.repliedAt).toLocaleString("es-ES")}` : ""}
              </p>
              <p className="mt-1 text-xs text-emerald-800">{row.replySubject}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-emerald-900">{row.replyBody}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-0 flex-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Instrucción para la IA (opcional)
                  </label>
                  <input
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    placeholder="Ej.: confirma que el PDF firmado vale para el MIVAU y ofrece papel sin coste"
                    className={inputCls}
                  />
                </div>
                <button
                  type="button"
                  onClick={generateDraft}
                  disabled={drafting}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-60"
                >
                  {drafting ? "Generando…" : body ? "Regenerar borrador IA" : "Generar borrador IA"}
                </button>
              </div>

              {row.channel !== "WHATSAPP" && (
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Asunto de la respuesta"
                  className={inputCls}
                />
              )}
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                maxLength={8000}
                placeholder="Escribe la respuesta o genera un borrador con IA y edítalo aquí."
                className={`${inputCls} resize-y`}
              />
              {row.channel !== "WHATSAPP" && (row.deliveredFileCount || 0) > 0 && (
                <label className="flex items-center gap-2 text-sm text-slate-200">
                  <input type="checkbox" checked={attachFiles} onChange={(e) => setAttachFiles(e.target.checked)} />
                  Adjuntar las {row.deliveredFileCount} traducción{row.deliveredFileCount === 1 ? "" : "es"} entregada{row.deliveredFileCount === 1 ? "" : "s"} + factura (si está emitida)
                </label>
              )}
              {row.channel !== "WHATSAPP" && row.orderReference && !(row.deliveredFileCount || 0) && (
                <p className="text-xs text-amber-300">Este pedido aún no tiene traducción entregada: la respuesta saldrá sin PDF.</p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {row.channel === "WHATSAPP" && (
                  <button
                    type="button"
                    onClick={() => {
                      const digits = (row.fromPhone || "").replace(/\D/g, "");
                      window.open(`https://wa.me/${digits}?text=${encodeURIComponent(body)}`, "_blank", "noopener");
                      void sendReply(true);
                    }}
                    disabled={sending || !body.trim()}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Abre tu WhatsApp con el texto ya escrito (lo envías tú) y marca el mensaje como respondido"
                  >
                    Abrir en mi WhatsApp y marcar respondido
                  </button>
                )}
                {(row.channel !== "WHATSAPP" || !row.isManual) && (
                  <button
                    type="button"
                    onClick={() => void sendReply(false)}
                    disabled={sending || !body.trim()}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {sending
                      ? "Enviando…"
                      : row.channel === "WHATSAPP"
                        ? `Enviar por la API a ${row.fromPhone || ""}`
                        : `Enviar respuesta a ${row.fromEmail}`}
                  </button>
                )}
                <span className="text-xs text-slate-500">
                  {row.channel === "WHATSAPP"
                    ? row.isManual
                      ? "Dado de alta a mano: la respuesta sale desde tu WhatsApp (se abre con el texto) y aquí queda registrada."
                      : "La API envía desde el número del negocio solo dentro de las 24 h desde su último mensaje; si no, usa tu WhatsApp."
                    : "Se envía desde el buzón del negocio, en el mismo hilo, con la firma habitual."}
                </span>
              </div>
            </div>
          )}

          {feedback && (
            <p className={`text-xs font-medium ${feedback.ok ? "text-emerald-700" : "text-amber-700"}`}>
              {feedback.text}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

function ManualWhatsAppForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [buildQuote, setBuildQuote] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const inputCls =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400";

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const media: { url: string; contentType: string; name: string; size: number }[] = [];
      for (const f of files.slice(0, 20)) {
        const safeName = f.name.replace(/[^\w.\- ]+/g, "_").slice(0, 120);
        const blob = await upload(`inbox/whatsapp/manual/${Date.now()}-${safeName}`, f, {
          access: "public",
          handleUploadUrl: "/api/documents/upload",
          clientPayload: JSON.stringify({ gdprConsent: true }),
        });
        media.push({ url: blob.url, contentType: f.type || "application/octet-stream", name: f.name, size: f.size });
      }
      const res = await fetch("/api/admin/inbox/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, name, text, media }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "No se pudo dar de alta.");
      if (buildQuote && data.id) {
        // Encadena el presupuesto: expediente con los archivos + builder con el
        // WhatsApp a la vista (misma ruta que el boton de la fila).
        const r2 = await fetch(`/api/admin/inbox/${data.id}/expediente`, { method: "POST" });
        const d2 = await r2.json().catch(() => ({}));
        if (r2.ok && d2?.ok && d2.url) window.open(d2.url, "_blank", "noopener");
      }
      onDone();
    } catch (e: any) {
      setErr(e?.message || "Error al dar de alta el WhatsApp.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-green-200 bg-green-50/60 p-4">
      <p className="text-sm font-semibold text-green-900">WhatsApp recibido en el móvil → bandeja</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Teléfono del cliente (+34…)" className={inputCls} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre (opcional)" className={inputCls} />
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder="Pega aquí el texto del WhatsApp (puedes pegar varios mensajes seguidos)"
        className={`${inputCls} resize-y`}
      />
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="application/pdf,image/*"
          onChange={(e) => setFiles(Array.from(e.target.files || []))}
          className="text-slate-700"
        />
        {files.length > 0 && <span className="text-slate-600">{files.length} archivo(s)</span>}
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-700">
        <input type="checkbox" checked={buildQuote} onChange={(e) => setBuildQuote(e.target.checked)} />
        Montar presupuesto al dar de alta (abre el builder con los archivos y el WhatsApp a la vista)
      </label>
      {err && <p className="text-xs font-medium text-amber-700">✗ {err}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy || (!text.trim() && files.length === 0) || !phone.trim()}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
        >
          {busy ? "Guardando…" : "Dar de alta en la bandeja"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-white">
          Cancelar
        </button>
      </div>
    </div>
  );
}

export default function AdminInboxPanel({
  initialRows,
  vista,
  canal = "todos",
  counts,
}: {
  initialRows: InboxRow[];
  vista: string;
  canal?: "todos" | "email" | "whatsapp";
  counts: { pendientes: number; respondidos: number; archivados: number };
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  // Tras router.refresh() el servidor manda filas nuevas: useState no las recoge solo.
  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);

  function updateRow(id: string, patch: Partial<InboxRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function syncNow() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/admin/inbox/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "No se pudo sincronizar.");
      const bits = [
        data.imported > 0 ? `${data.imported} email(s) nuevo(s) importado(s)` : "buzón al día, sin emails nuevos de clientes",
        data.repliedExternally > 0 ? `${data.repliedExternally} marcado(s) como respondido(s) (contestados desde Outlook/móvil)` : null,
        data.attachmentsBackfilled > 0 ? `adjuntos recuperados en ${data.attachmentsBackfilled} email(s) anteriores` : null,
      ].filter(Boolean);
      setSyncMsg(`✓ ${bits.join(" · ")}.`);
      router.refresh();
    } catch (err: any) {
      setSyncMsg(`✗ ${err?.message || "Error al sincronizar."}`);
    } finally {
      setSyncing(false);
    }
  }

  const countLabel: Record<string, number | null> = {
    pendientes: counts.pendientes,
    respondidos: counts.respondidos,
    archivados: counts.archivados,
    todos: null,
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Bandeja de entrada</h1>
        <button
          type="button"
          onClick={syncNow}
          disabled={syncing}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          {syncing ? "Sincronizando…" : "Sincronizar buzón"}
        </button>
        <button
          type="button"
          onClick={() => setManualOpen((v) => !v)}
          className="rounded-xl border border-green-600 bg-green-50 px-4 py-2 text-sm font-semibold text-green-800 hover:bg-green-100"
          title="Trae a la bandeja un WhatsApp recibido en el móvil (texto + fotos/PDF)"
        >
          + WhatsApp a mano
        </button>
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          {VISTAS.map((v) => (
            <Link
              key={v.key}
              href={`/admin/inbox?vista=${v.key}${canal !== "todos" ? `&canal=${canal}` : ""}`}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                vista === v.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {v.label}
              {countLabel[v.key] != null ? ` (${countLabel[v.key]})` : ""}
            </Link>
          ))}
        </div>
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          {(
            [
              { key: "todos", label: "Todos" },
              { key: "email", label: "Email" },
              { key: "whatsapp", label: "WhatsApp" },
            ] as const
          ).map((c) => (
            <Link
              key={c.key}
              href={`/admin/inbox?vista=${vista}${c.key !== "todos" ? `&canal=${c.key}` : ""}`}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                canal === c.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {c.label}
            </Link>
          ))}
        </div>
      </div>

      {syncMsg && <p className="text-sm font-medium text-slate-700">{syncMsg}</p>}

      {manualOpen && (
        <ManualWhatsAppForm
          onDone={() => {
            setManualOpen(false);
            router.refresh();
          }}
          onCancel={() => setManualOpen(false)}
        />
      )}

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No hay emails en esta vista. Pulsa «Sincronizar buzón» para traer los últimos mensajes de
          clientes (se ignoran los del propio staff y los no-reply).
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <EmailCard key={row.id} row={row} onUpdate={updateRow} />
          ))}
        </ul>
      )}
    </section>
  );
}
