"use client";

// components/order-workspace/OrderManagementActions.tsx
//
// Acciones de GESTIÓN del pedido en la propia Landing (antes solo en el Cockpit):
// avanzar workflow, emitir factura (o ver su PDF), notificar envío postal,
// cobrar por WhatsApp/Bizum y enlace al presupuesto. Reusa los endpoints que ya
// existen; no inventa nada. Tras cada acción refresca la página (server data).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buildNotificationTemplate } from "@/lib/notification-templates";

function eur(c: number) {
  return `${(c / 100).toFixed(2)} €`;
}

export default function OrderManagementActions({
  reference,
  clientName,
  clientPhone,
  amountCents,
  paymentStatus,
  moves,
  invoice,
  quote,
}: {
  reference: string;
  clientName: string;
  clientPhone: string | null;
  amountCents: number;
  paymentStatus: string;
  moves: { to: string; label: string }[];
  invoice: { number: string | null } | null;
  quote: { id: string; quoteNumber: string } | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(null), 3500);
  }

  async function advance() {
    const next = moves[0];
    if (!next) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${reference}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: next.to, reason: "Avance desde el pedido" }),
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
      const res = await fetch(`/api/orders/${reference}/invoice/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || "No se pudo emitir.");
      flash(`Factura ${d.invoice?.number || ""} emitida.`);
      router.refresh();
    } catch (e: any) {
      flash(e?.message || "No se pudo emitir la factura.");
    } finally {
      setBusy(false);
    }
  }

  async function notifyShipment() {
    const trackingNumber = window.prompt("Nº de seguimiento de la mensajería:");
    if (!trackingNumber || !trackingNumber.trim()) return;
    const courier = window.prompt("Transportista (opcional: Correos, MRW, SEUR…):") || "";
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${reference}/notify-shipment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingNumber: trackingNumber.trim(), courier: courier.trim() }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || "No se pudo notificar el envío.");
      flash(`Envío notificado al cliente (seguimiento ${d.trackingNumber || trackingNumber.trim()}).`);
      router.refresh();
    } catch (e: any) {
      flash(e?.message || "No se pudo notificar el envío.");
    } finally {
      setBusy(false);
    }
  }

  const digits = String(clientPhone || "").replace(/\D/g, "");
  const phone = digits ? (digits.length === 9 ? `34${digits}` : digits) : "";
  const cobroText = buildNotificationTemplate({
    key: "wa_bizum_payment",
    reference,
    clientName,
    amountEur: eur(amountCents),
  });

  const btn = "rounded-lg px-3 py-1.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {moves[0] && (
        <button type="button" onClick={advance} disabled={busy} className={`${btn} bg-cyan-600 text-white hover:bg-cyan-500`}>
          Avanzar → {moves[0].label}
        </button>
      )}

      {paymentStatus !== "PAID" && phone && (
        <a
          href={`https://wa.me/${phone}?text=${encodeURIComponent(cobroText)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`${btn} bg-emerald-600 text-white hover:bg-emerald-500`}
        >
          Cobrar por WhatsApp (Bizum)
        </a>
      )}

      {invoice ? (
        <a
          href={`/api/orders/${reference}/invoice-pdf`}
          className={`${btn} border border-emerald-600 text-emerald-300 hover:bg-emerald-600/20`}
        >
          🧾 {invoice.number || "Factura"} (PDF)
        </a>
      ) : (
        <button type="button" onClick={emitInvoice} disabled={busy} className={`${btn} border border-slate-600 text-slate-200 hover:bg-slate-800`}>
          Emitir factura
        </button>
      )}

      {paymentStatus === "PAID" && (
        <button type="button" onClick={notifyShipment} disabled={busy} className={`${btn} border border-slate-600 text-slate-200 hover:bg-slate-800`}>
          📦 Notificar envío
        </button>
      )}

      {quote && (
        <a href={`/zona-traductor/presupuestos/${quote.id}`} className={`${btn} border border-slate-600 text-slate-200 hover:bg-slate-800`}>
          Presupuesto {quote.quoteNumber}
        </a>
      )}

      {msg && <span className="text-xs font-medium text-cyan-300">{msg}</span>}
    </div>
  );
}
