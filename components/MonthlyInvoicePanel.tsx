"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Facturas AGRUPADAS del mes de un cliente de crédito mensual (4-sep-2026,
// Marbella Translators). El borrador acumula pedidos durante el mes; aquí se
// emite al cerrar el mes (POST /api/invoices/[id]/issue → carril de crédito:
// número, vencimiento, Verifactu, rastro en cada pedido).

export type MonthlyInvoiceRow = {
  id: string;
  number: string | null;
  status: string;
  periodKey: string;
  label: string;
  closed: boolean;
  totalCents: number;
  dueDate: string | null;
  paidAt: string | null;
  issuedAt: string | null;
  annulled: boolean;
  orders: { reference: string; title: string | null; amountCents: number; deliveryState: string | null }[];
};

const eur = (c: number) => `${(c / 100).toFixed(2)} €`;
const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-ES") : "—");

export default function MonthlyInvoicePanel({ invoices, billingCycle }: { invoices: MonthlyInvoiceRow[]; billingCycle: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  if (invoices.length === 0 && billingCycle !== "MONTHLY") return null;

  async function issue(inv: MonthlyInvoiceRow) {
    if (!confirm(`Emitir la factura agrupada de ${inv.label} (${inv.orders.length} pedido(s), ${eur(inv.totalCents)})? Se numera y entra en Verifactu: no se podrá borrar.`)) return;
    setBusy(inv.id);
    setMsg(null);
    try {
      const res = await fetch(`/api/invoices/${inv.id}/issue`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "No se pudo emitir.");
      setMsg({ kind: "ok", text: `Emitida ${data.invoice?.number || ""} · vence ${fecha(data.monthly?.dueDate || null)}.` });
      router.refresh();
    } catch (err: any) {
      setMsg({ kind: "error", text: err?.message || "No se pudo emitir." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-violet-300">Facturas del mes (crédito agrupado)</h2>
      {invoices.length === 0 ? (
        <p className="mt-2 text-sm text-slate-400">
          Todavía no hay ninguna. Al pulsar «Trabajar a crédito» en un presupuesto o pedido de este cliente, el pedido entra en el borrador del mes en curso.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {invoices.map((inv) => {
            const draft = inv.status === "DRAFT";
            const overdue = !draft && !inv.paidAt && inv.dueDate && new Date(inv.dueDate) < new Date();
            return (
              <div key={inv.id} className={`rounded-xl border p-4 ${inv.annulled ? "border-slate-700 opacity-60" : draft ? (inv.closed ? "border-amber-500/50 bg-amber-500/5" : "border-slate-700") : overdue ? "border-red-500/40 bg-red-500/5" : "border-slate-700"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {inv.label} · {eur(inv.totalCents)} · {inv.orders.length} pedido(s)
                    </p>
                    <p className="text-xs text-slate-400">
                      {inv.annulled
                        ? `Anulada (${inv.number})`
                        : draft
                          ? inv.closed
                            ? "Borrador · el mes ya cerró: emitir"
                            : "Borrador · acumulando pedidos hasta fin de mes"
                          : `${inv.number} · emitida ${fecha(inv.issuedAt)} · vence ${fecha(inv.dueDate)} · ${inv.paidAt ? `cobrada ${fecha(inv.paidAt)}` : overdue ? "VENCIDA sin cobrar" : "sin cobrar"}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-600 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-800">
                      PDF
                    </a>
                    {draft && !inv.annulled && inv.orders.length > 0 && (
                      <button
                        type="button"
                        onClick={() => issue(inv)}
                        disabled={busy === inv.id}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 ${inv.closed ? "bg-amber-600 hover:bg-amber-500" : "bg-violet-600 hover:bg-violet-500"}`}
                      >
                        {busy === inv.id ? "Emitiendo…" : `Emitir factura de ${inv.label}`}
                      </button>
                    )}
                    {!draft && !inv.paidAt && !inv.annulled && (
                      <a href="/zona-traductor/facturas" className="text-xs text-cyan-400 hover:underline">
                        marcar cobrada
                      </a>
                    )}
                  </div>
                </div>
                <ul className="mt-2 divide-y divide-slate-800 text-xs">
                  {inv.orders.map((o) => (
                    <li key={o.reference} className="flex items-center justify-between gap-2 py-1.5">
                      <a href={`/zona-traductor/pedido/${o.reference}`} className="font-mono text-cyan-300 hover:underline">
                        {o.reference}
                      </a>
                      <span className="flex-1 truncate text-slate-300">{o.title || "Traducción jurada"}</span>
                      <span className="text-slate-500">{o.deliveryState || ""}</span>
                      <span className="text-slate-200">{eur(o.amountCents)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
      {msg && <p className={`mt-2 text-xs ${msg.kind === "ok" ? "text-emerald-300" : "text-red-400"}`}>{msg.text}</p>}
    </div>
  );
}
