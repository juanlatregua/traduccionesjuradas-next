"use client";

// components/AdminInboxPanel.tsx
//
// Bandeja de entrada del buzón en el admin: emails de clientes sincronizados
// desde Graph, casados con presupuesto/pedido, con borrador de respuesta IA
// editable y envío en el mismo hilo. La respuesta NUNCA sale sin que el staff
// la revise y pulse enviar.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type InboxRow = {
  id: string;
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
  draftSubject: string | null;
  draftBody: string | null;
  replySubject: string | null;
  replyBody: string | null;
  repliedAt: string | null;
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

  async function sendReply() {
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
        body: JSON.stringify({ subject, body }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "No se pudo enviar.");
      onUpdate(row.id, {
        status: "REPLIED",
        replySubject: subject,
        replyBody: body,
        repliedAt: new Date().toISOString(),
      });
      setFeedback({ ok: true, text: "✓ Respuesta enviada en el mismo hilo." });
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
        <span className="text-sm font-semibold text-slate-900">
          {row.fromName || row.fromEmail}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{row.subject}</span>
        <span className="text-xs text-slate-400">
          {new Date(row.receivedAt).toLocaleString("es-ES")}
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-slate-100 px-4 py-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500">
              De: <strong className="text-slate-800">{row.fromEmail}</strong>
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
          </div>

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

              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Asunto de la respuesta"
                className={inputCls}
              />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                maxLength={8000}
                placeholder="Escribe la respuesta o genera un borrador con IA y edítalo aquí."
                className={`${inputCls} resize-y`}
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={sendReply}
                  disabled={sending || !body.trim()}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {sending ? "Enviando…" : `Enviar respuesta a ${row.fromEmail}`}
                </button>
                <span className="text-xs text-slate-500">
                  Se envía desde el buzón del negocio, en el mismo hilo, con la firma habitual.
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

export default function AdminInboxPanel({
  initialRows,
  vista,
  counts,
}: {
  initialRows: InboxRow[];
  vista: string;
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
      setSyncMsg(
        data.imported > 0
          ? `✓ ${data.imported} email(s) nuevo(s) importado(s).`
          : "✓ Buzón al día, sin emails nuevos de clientes."
      );
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
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          {VISTAS.map((v) => (
            <Link
              key={v.key}
              href={`/admin/inbox?vista=${v.key}`}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                vista === v.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {v.label}
              {countLabel[v.key] != null ? ` (${countLabel[v.key]})` : ""}
            </Link>
          ))}
        </div>
      </div>

      {syncMsg && <p className="text-sm font-medium text-slate-700">{syncMsg}</p>}

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
