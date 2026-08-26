"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AgendaItem = {
  reference: string;
  title: string;
  dueDate: string | Date | null;
  deliveryState: string;
  assignedTo: string | null;
  translatorDeliveredAt?: string | null;
  deliveryType?: string | null;
  langPair?: string | null;
};

type Props = {
  items: AgendaItem[];
};

function ymd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Estado que ve Juan en la tarjeta. La agenda solo recibe pedidos PAGADOS, así que
// "Presupuesto" (deliveryState inicial) aquí significaba "pagado y sin empezar".
function labelState(row: AgendaItem) {
  if (row.translatorDeliveredAt) {
    const when = new Date(row.translatorDeliveredAt).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
    const paso = row.deliveryType === "paper" ? "falta enviar el papel" : "falta entregar al cliente";
    return `Traducido${row.assignedTo ? ` por ${row.assignedTo}` : ""} el ${when} · ${paso}`;
  }
  if (row.deliveryState === "EN_PROCESO") return `En proceso${row.assignedTo ? ` · ${row.assignedTo}` : ""}`;
  const fr = /(^|[^a-z])fr([^a-z]|$)/.test(String(row.langPair || "").toLowerCase());
  return row.assignedTo ? `Pagado · asignado a ${row.assignedTo}` : fr ? "Pagado · pendiente (tuyo)" : "Pagado · sin traductor";
}

export default function TranslatorAgenda({ items }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const withDueDate = items
    .filter((x) => !!x.dueDate && x.deliveryState !== "TRADUCIDO")
    .map((x) => ({ ...x, dueDate: new Date(x.dueDate as string | Date) }))
    .sort((a, b) => Number(a.dueDate) - Number(b.dueDate));

  const grouped = new Map<string, typeof withDueDate>();
  for (const it of withDueDate) {
    const key = ymd(it.dueDate);
    const prev = grouped.get(key) || [];
    prev.push(it);
    grouped.set(key, prev);
  }

  // "Entregado" desde la agenda, por si se olvidó marcarlo en la ficha (Juan 26-ago).
  // Va por el chokepoint de workflow (TRADUCIDO_ENTREGADO → DELIVERED): el SMS de
  // "lista, descárgala" solo sale si hay entregable, así que no promete nada falso.
  async function markDelivered(row: AgendaItem) {
    const ok = window.confirm(`¿Marcar ${row.reference} como ENTREGADO al cliente?\n\nNo envía la traducción: solo cierra el pedido como entregado (para cuando ya se entregó por otra vía o se olvidó marcar).`);
    if (!ok) return;
    setBusy(row.reference);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(row.reference)}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: "TRADUCIDO_ENTREGADO", reason: "Marcado como entregado desde la agenda de plazos." }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) throw new Error(data?.error || "No se pudo marcar como entregado.");
      router.refresh();
    } catch (err: any) {
      setError(`${row.reference}: ${err?.message || "No se pudo marcar como entregado."}`);
    } finally {
      setBusy(null);
    }
  }

  if (grouped.size === 0) {
    return (
      <section className="mx-auto mt-6 max-w-6xl rounded-3xl border border-slate-700 bg-slate-900/80 p-6 shadow-xl sm:p-8">
        <h2 className="text-lg font-semibold text-white">Agenda de plazos</h2>
        <p className="mt-3 text-sm text-slate-400">No hay entregas con fecha prevista.</p>
      </section>
    );
  }

  const today = ymd(new Date());

  return (
    <section className="mx-auto mt-6 max-w-6xl rounded-3xl border border-slate-700 bg-slate-900/80 p-6 shadow-xl sm:p-8">
      <h2 className="text-lg font-semibold text-white">Agenda de plazos</h2>
      <p className="mt-1 text-xs text-slate-400">Pedidos pagados con fecha de entrega. «Entregado» cierra el pedido sin enviar nada.</p>
      {error && <p className="mt-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</p>}
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from(grouped.entries()).map(([day, rows]) => {
          const late = day < today;
          const isToday = day === today;
          return (
            <div key={day} className={`rounded-2xl border p-4 ${late ? "border-rose-500/50 bg-rose-950/20" : isToday ? "border-amber-400/50 bg-amber-950/10" : "border-slate-700 bg-slate-950/70"}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide ${late ? "text-rose-300" : isToday ? "text-amber-300" : "text-cyan-300"}`}>
                {new Date(day).toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}
                {late ? " · VENCIDO" : isToday ? " · HOY" : ""}
              </p>
              <ul className="mt-3 space-y-2">
                {rows.map((row) => (
                  <li key={row.reference} className="rounded-xl border border-slate-700 bg-slate-900/70 p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <a href={`/zona-traductor/pedido/${encodeURIComponent(row.reference)}`} className="font-mono text-xs font-bold text-cyan-300 hover:underline">
                          {row.reference}
                        </a>
                        <p className="mt-0.5 truncate text-sm text-slate-200">{row.title}</p>
                        <p className={`mt-0.5 text-[11px] ${row.translatorDeliveredAt ? "text-emerald-300" : "text-slate-400"}`}>{labelState(row)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => markDelivered(row)}
                        disabled={busy === row.reference}
                        title="Marcar como entregado al cliente (no envía nada)"
                        className="shrink-0 rounded-md border border-emerald-500/40 px-2 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
                      >
                        {busy === row.reference ? "…" : "Entregado"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
