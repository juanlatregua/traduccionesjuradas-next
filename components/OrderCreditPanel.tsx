"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Carril de COBRO APLAZADO en la ficha del pedido (Juan, 2-sep-2026): un botón
// con el motivo ya escrito, revisar y pulsar. Habla con
// POST /api/orders/[reference]/credit (ADMIN/PM, confirm:true obligatorio).

type Props = {
  reference: string;
  clientName: string;
  amountCents: number;
  creditDays: number; // días pactados en la ficha del cliente (30 por defecto)
  creditEnabled: boolean;
  credit: { invoiceNumber: string | null; dueDate: string; paidAt: string | null; daysToDue: number | null } | null;
};

function isoPlusDays(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + Math.max(1, Math.min(90, days)));
  return d.toISOString().slice(0, 10);
}

export default function OrderCreditPanel({ reference, clientName, amountCents, creditDays, creditEnabled, credit }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [reason, setReason] = useState(
    `Cliente de crédito: se trabaja y se entrega, cobro a ${creditDays} días contra factura.`
  );
  const [dueDate, setDueDate] = useState(isoPlusDays(creditDays));

  async function call(action: "authorize" | "revoke") {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(reference)}/credit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason, dueDate: action === "authorize" ? dueDate : undefined, confirm: true }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "No se pudo completar.");
      setMsg({
        kind: "ok",
        text:
          action === "authorize"
            ? `Autorizado: factura ${data.invoiceNumber || "(sin nº)"}, vence ${new Date(data.dueDate).toLocaleDateString("es-ES")}. Ya puedes traducir y entregar.`
            : "Autorización retirada. La factura sigue emitida (es un documento fiscal).",
      });
      setOpen(false);
      router.refresh();
    } catch (err: any) {
      setMsg({ kind: "error", text: err?.message || "No se pudo completar." });
    } finally {
      setBusy(false);
    }
  }

  const eur = (amountCents / 100).toFixed(2);

  if (credit && !credit.paidAt) {
    const overdue = credit.daysToDue !== null && credit.daysToDue < 0;
    return (
      <div className={`rounded-xl border p-3 ${overdue ? "border-red-500/40 bg-red-500/10" : "border-violet-500/40 bg-violet-500/10"}`}>
        <p className={`text-xs font-semibold ${overdue ? "text-red-300" : "text-violet-300"}`}>
          {overdue ? "Crédito VENCIDO" : "A crédito · sin cobrar"}
        </p>
        <p className="mt-1 text-sm text-slate-200">
          Factura {credit.invoiceNumber || "(sin nº)"} · {eur} EUR · vence {new Date(credit.dueDate).toLocaleDateString("es-ES")}
          {credit.daysToDue !== null && (
            <span className="text-slate-400"> ({credit.daysToDue >= 0 ? `faltan ${credit.daysToDue} días` : `hace ${-credit.daysToDue} días`})</span>
          )}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Se puede traducir y entregar. Cuando entre el dinero: «Marcar cobrado» aquí mismo y conciliar a mano.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => call("revoke")}
            disabled={busy}
            className="rounded-lg border border-slate-600 px-2 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            Retirar autorización
          </button>
          {msg && <span className={`text-xs ${msg.kind === "ok" ? "text-emerald-300" : "text-red-400"}`}>{msg.text}</span>}
        </div>
      </div>
    );
  }

  if (!creditEnabled) {
    return (
      <p className="text-xs text-slate-500">
        ¿Trabajar y entregar antes de cobrar? Marca a {clientName} como cliente de crédito en su ficha (Clientes → Editar ficha).
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3">
      {!open ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={busy}
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
          >
            Autorizar a crédito (trabajar y entregar antes de cobrar)
          </button>
          <span className="text-xs text-slate-400">Emite la factura de {eur} EUR con vencimiento a {creditDays} días.</span>
          {msg && <span className={`text-xs ${msg.kind === "ok" ? "text-emerald-300" : "text-red-400"}`}>{msg.text}</span>}
        </div>
      ) : (
        <div className="space-y-2">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Motivo (queda en el registro del pedido)
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm normal-case tracking-normal text-slate-200 focus:border-violet-500 focus:outline-none"
            />
          </label>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Vencimiento
            <input
              type="date"
              value={dueDate}
              min={isoPlusDays(1)}
              max={isoPlusDays(90)}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 focus:border-violet-500 focus:outline-none"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => call("authorize")}
              disabled={busy || reason.trim().length < 10}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {busy ? "Autorizando…" : `Emitir factura de ${eur} EUR y autorizar`}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-400 hover:text-slate-200">
              Cancelar
            </button>
            {msg && <span className={`text-xs ${msg.kind === "ok" ? "text-emerald-300" : "text-red-400"}`}>{msg.text}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
