"use client";

// Desglose por documento de un pedido (migrado del Cockpit): por cada documento,
// ciclar estado de producción y asignar colaborador, con barra de progreso.
// Reusa PATCH /api/orders/[reference]/document-items/[itemId].

import { useState } from "react";

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
  fileUrl: string | null;
  deliveredFileUrl: string | null;
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

export default function OrderDocumentItems({ reference, items: initial }: { reference: string; items: Item[] }) {
  const [items, setItems] = useState<Item[]>(initial);
  const [msg, setMsg] = useState<string | null>(null);
  // Asignación POR documento: solo la usan los expedientes multi-colaborador
  // (p.ej. Auream). Plegada salvo que algún documento ya la tenga rellena.
  const [showAssignees, setShowAssignees] = useState(initial.some((i) => i.assignedTo));

  if (initial.length === 0) return null;

  const done = items.filter((i) => i.prodStatus === "DELIVERED").length;
  const total = items.length;

  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(null), 3000);
  }

  async function patchItem(id: string, body: any) {
    const res = await fetch(`/api/orders/${reference}/document-items/${id}`, {
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
      setItems(initial);
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

  return (
    <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-800/30 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-100">Desglose por documento</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowAssignees((v) => !v)}
            className="text-[11px] font-semibold text-slate-500 hover:text-slate-300"
            title="Asignar un colaborador distinto a cada documento (expedientes multi-colaborador)"
          >
            {showAssignees ? "ocultar asignación por documento" : "asignación por documento"}
          </button>
          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-700">
            <div className="h-full bg-emerald-500" style={{ width: `${Math.round((done / total) * 100)}%` }} />
          </div>
          <span className="text-xs tabular-nums text-slate-400">{done}/{total}</span>
        </div>
      </div>
      <ul className="mt-3 divide-y divide-slate-800">
        {items.map((it) => {
          const ui = STATUS_UI[it.prodStatus] || STATUS_UI.PENDING;
          return (
            <li key={it.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <button type="button" onClick={() => cycleStatus(it)} title="Cambiar estado" className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${ui.cls}`}>
                {ui.label}
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-white" title={it.fileName}>{it.documentType || it.fileName}</p>
                <p className="text-xs text-slate-500">
                  {[it.sourceLang && it.targetLang ? `${it.sourceLang}-${it.targetLang}` : "", it.words ? `${it.words} pal.` : "", it.quotedCents ? eur(it.quotedCents) : ""].filter(Boolean).join(" · ")}
                </p>
              </div>
              {showAssignees && (
                <input
                  defaultValue={it.assignedTo || ""}
                  onBlur={(e) => saveAssignee(it, e.target.value.trim())}
                  placeholder="colaborador"
                  className="w-32 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                />
              )}
              {it.fileUrl && (
                <a href={it.fileUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-md border border-slate-600 px-2 py-1 text-xs font-semibold text-cyan-300 hover:bg-slate-800">
                  📄 Original
                </a>
              )}
              {it.deliveredFileUrl && (
                <a href={it.deliveredFileUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs text-emerald-400 hover:text-emerald-300">
                  ✓ traducción
                </a>
              )}
            </li>
          );
        })}
      </ul>
      {msg && <p className="mt-2 text-xs text-cyan-300">{msg}</p>}
    </div>
  );
}
