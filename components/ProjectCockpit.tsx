"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Item = {
  id: string;
  fileName: string;
  documentType: string | null;
  sourceLang: string | null;
  targetLang: string | null;
  words: number | null;
  quotedCents: number | null;
  prodStatus: string;
  assignedTo: string | null;
  deliveredFileUrl: string | null;
};
type Data = {
  reference: string;
  client: string;
  clientEmail: string | null;
  langPair: string;
  amountCents: number;
  paymentStatus: string;
  state: string;
  stateLabel: string;
  moves: { to: string; label: string }[];
  dueLabel: string | null;
  title: string;
  assignedTo: string | null;
  supplierCostCents: number;
  marginCents: number;
  marginPct: number | null;
  invoice: { number: string; totalCents: number } | null;
  quote: { quoteNumber: string; publicToken: string; status: string } | null;
  items: Item[];
  timeline: { type: string; message: string | null; at: string }[];
};

function eur(c: number) {
  return `${(c / 100).toFixed(2)} €`;
}

const NEXT_STATUS: Record<string, string> = { PENDING: "IN_TRANSLATION", IN_TRANSLATION: "DELIVERED", DELIVERED: "PENDING" };
const STATUS_UI: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Pendiente", cls: "bg-slate-600/40 text-slate-300" },
  IN_TRANSLATION: { label: "En proceso", cls: "bg-amber-500/20 text-amber-300" },
  DELIVERED: { label: "Entregado", cls: "bg-emerald-500/20 text-emerald-300" },
};

export default function ProjectCockpit({ data }: { data: Data }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>(data.items);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const done = items.filter((i) => i.prodStatus === "DELIVERED").length;
  const total = items.length;

  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(null), 3000);
  }

  async function patchItem(id: string, body: any) {
    const res = await fetch(`/api/orders/${data.reference}/document-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    if (!res.ok || !d.ok) throw new Error(d.error || "Error");
    return d.item as Item;
  }

  async function cycleStatus(item: Item) {
    const to = NEXT_STATUS[item.prodStatus] || "PENDING";
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, prodStatus: to } : i)));
    try {
      await patchItem(item.id, { prodStatus: to });
    } catch {
      setItems(data.items);
      flash("No se pudo actualizar el documento.");
    }
  }

  async function saveAssignee(item: Item, value: string) {
    if (value === (item.assignedTo || "")) return;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, assignedTo: value || null } : i)));
    try {
      await patchItem(item.id, { assignedTo: value });
    } catch {
      flash("No se pudo guardar el colaborador.");
    }
  }

  async function advance() {
    const next = data.moves[0];
    if (!next) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${data.reference}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: next.to, reason: "Avance desde cockpit" }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || "No se pudo avanzar.");
      flash(`Estado → ${next.label}`);
      router.refresh();
    } catch (e: any) {
      flash(e?.message || "No se pudo avanzar.");
    } finally {
      setBusy(false);
    }
  }

  async function emitInvoice() {
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${data.reference}/invoice/issue`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || "No se pudo emitir.");
      flash(`Factura ${d.invoice.number} emitida.`);
      router.refresh();
    } catch (e: any) {
      flash(e?.message || "No se pudo emitir la factura.");
    } finally {
      setBusy(false);
    }
  }

  const card = "rounded-xl border border-slate-700 bg-slate-900/40 p-4";

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 text-slate-200">
      <a href="/zona-traductor/tablero" className="text-sm text-cyan-400 hover:text-cyan-300">← Tablero</a>

      {/* Cabecera */}
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">{data.client}</h1>
          <p className="mt-1 text-sm text-slate-400">
            <span className="font-mono">{data.reference}</span>
            {data.langPair && <> · {data.langPair}</>} · {data.title}
          </p>
        </div>
        <div className="text-right">
          <span className="rounded-full bg-cyan-500/15 px-3 py-1 text-sm font-semibold text-cyan-300">{data.stateLabel}</span>
          <p className="mt-1 text-2xl font-bold text-white tabular-nums">{eur(data.amountCents)}</p>
          {data.dueLabel && <p className="text-xs text-slate-400">vence {data.dueLabel}</p>}
        </div>
      </div>

      {/* Finanzas + acciones */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className={card}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Finanzas</p>
          <div className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-slate-400">Ingreso</span><span className="tabular-nums">{eur(data.amountCents)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Coste colaborador</span><span className="tabular-nums">{eur(data.supplierCostCents)}</span></div>
            <div className="flex justify-between border-t border-slate-700 pt-1 font-semibold">
              <span>Margen</span>
              <span className={`tabular-nums ${data.marginCents < 0 ? "text-rose-400" : "text-emerald-400"}`}>
                {eur(data.marginCents)}{data.marginPct != null ? ` (${data.marginPct}%)` : ""}
              </span>
            </div>
            <div className="flex justify-between"><span className="text-slate-400">Cobro</span><span>{data.paymentStatus === "PAID" ? "✓ cobrado" : "pendiente"}</span></div>
          </div>
        </div>

        <div className={card}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Acciones</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {data.moves[0] && (
              <button type="button" onClick={advance} disabled={busy} className="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50">
                Avanzar → {data.moves[0].label}
              </button>
            )}
            <a href={`/zona-traductor/workspace/${data.reference}`} className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800">Editor de traducción</a>
            {data.invoice ? (
              <a href={`/api/orders/${data.reference}/invoice-pdf`} className="rounded-lg border border-emerald-600 px-3 py-1.5 text-sm font-semibold text-emerald-300 hover:bg-emerald-600/20">🧾 {data.invoice.number} (PDF)</a>
            ) : (
              <button type="button" onClick={emitInvoice} disabled={busy} className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50">Emitir factura</button>
            )}
            {data.quote && (
              <a href={`/admin/quotes`} className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800">Presupuesto {data.quote.quoteNumber}</a>
            )}
          </div>
        </div>
      </div>

      {/* Documentos */}
      <div className={`mt-4 ${card}`}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Documentos</p>
          {total > 0 && (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-700">
                <div className="h-full bg-emerald-500" style={{ width: `${Math.round((done / total) * 100)}%` }} />
              </div>
              <span className="text-xs tabular-nums text-slate-400">{done}/{total}</span>
            </div>
          )}
        </div>

        {total === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Este pedido no tiene documentos desglosados. (Los expedientes creados desde presupuesto sí los traen.)</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-800">
            {items.map((it) => {
              const ui = STATUS_UI[it.prodStatus] || STATUS_UI.PENDING;
              return (
                <li key={it.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => cycleStatus(it)}
                    title="Cambiar estado"
                    className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${ui.cls}`}
                  >
                    {ui.label}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white" title={it.fileName}>{it.documentType || it.fileName}</p>
                    <p className="text-xs text-slate-500">
                      {[it.sourceLang && it.targetLang ? `${it.sourceLang}-${it.targetLang}` : "", it.words ? `${it.words} pal.` : "", it.quotedCents ? eur(it.quotedCents) : ""].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <input
                    defaultValue={it.assignedTo || ""}
                    onBlur={(e) => saveAssignee(it, e.target.value.trim())}
                    placeholder="colaborador"
                    className="w-32 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                  />
                  {it.deliveredFileUrl && (
                    <a href={it.deliveredFileUrl} className="text-xs text-cyan-400 hover:text-cyan-300">archivo</a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Timeline */}
      <div className={`mt-4 ${card}`}>
        <p className="text-sm font-semibold text-white">Historial</p>
        <ul className="mt-2 space-y-1.5">
          {data.timeline.slice(0, 12).map((e, i) => (
            <li key={i} className="flex gap-3 text-xs">
              <span className="shrink-0 text-slate-500">{e.at}</span>
              <span className="text-slate-300">{e.message || e.type}</span>
            </li>
          ))}
        </ul>
      </div>

      {msg && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm text-slate-100 shadow-xl">{msg}</div>
      )}
    </div>
  );
}
