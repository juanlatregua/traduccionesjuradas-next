"use client";

// Apartado "Excluidos de facturación / pendientes de conciliar": pedidos que el
// staff ha apartado del libro oficial con un motivo. Reversible (devolver).

import { useState } from "react";

type Row = {
  reference: string;
  clientName: string | null;
  clientEmail: string;
  amountCents: number;
  paidAt: string | null;
  reason: string | null;
};

function eur(c: number) {
  return `${(c / 100).toFixed(2)} €`;
}

export default function ExcludedOrdersPanel({ rows }: { rows: Row[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  if (rows.length === 0) return null;

  async function reinclude(ref: string) {
    setBusy(ref);
    try {
      const res = await fetch(`/api/orders/${ref}/billing-exclude`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ excluded: false }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || "Error");
      window.location.reload();
    } catch {
      setBusy(null);
    }
  }

  const total = rows.reduce((s, r) => s + r.amountCents, 0);

  return (
    <div className="mt-6 rounded-xl border border-[#D5DAE1] bg-white p-4">
      <h2 className="text-sm font-semibold text-[#1A2E4A]">Excluidos de facturación · pendientes de conciliar</h2>
      <p className="mt-1 text-xs text-[#52606D]">
        {rows.length} pedido(s) · {eur(total)}. Fuera del libro oficial por su motivo. Reversible.
      </p>
      <div className="mt-3 overflow-x-auto rounded-lg border border-[#D5DAE1]">
        <table className="w-full text-sm text-[#1F2933]">
          <thead className="bg-[#F6F7F9] text-left text-xs uppercase tracking-wide text-[#52606D]">
            <tr>
              <th className="px-3 py-2">Pedido</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2 text-right">Importe</th>
              <th className="px-3 py-2">Motivo</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D5DAE1]">
            {rows.map((r) => (
              <tr key={r.reference}>
                <td className="px-3 py-2 font-mono text-[#1F2933]">{r.reference}</td>
                <td className="px-3 py-2">{r.clientName || r.clientEmail}</td>
                <td className="px-3 py-2 text-right tabular-nums">{eur(r.amountCents)}</td>
                <td className="px-3 py-2">
                  <span className="rounded bg-[#F6F7F9] px-1.5 py-0.5 text-[11px] text-[#1F2933]">{r.reason || "—"}</span>
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => reinclude(r.reference)}
                    disabled={busy === r.reference}
                    className="rounded border border-[#D5DAE1] px-2 py-1 text-xs text-[#1F2933] hover:bg-[#F6F7F9] disabled:opacity-50"
                  >
                    {busy === r.reference ? "…" : "Devolver a facturación"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
