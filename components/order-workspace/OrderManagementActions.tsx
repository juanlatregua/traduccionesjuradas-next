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
import { uploadStaffFile } from "@/lib/staff-upload-client";

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
  caseRef,
  caseSiblingsToShip,
  shipment,
}: {
  reference: string;
  clientName: string;
  clientPhone: string | null;
  amountCents: number;
  paymentStatus: string;
  moves: { to: string; label: string }[];
  invoice: { number: string | null } | null;
  quote: { id: string; quoteNumber: string } | null;
  // Trámite: hermanos de papel sin enviar que van EN EL MISMO SOBRE.
  caseRef: string | null;
  caseSiblingsToShip: string[];
  // Envío en papel ya notificado (para corregirlo o añadir el justificante después).
  shipment: { shippedAt: string | null; trackingNumber: string | null; courier: string | null; trackingUrl: string | null; proofUrl: string | null; proofName: string | null } | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [shipOpen, setShipOpen] = useState(false);
  const [ship, setShip] = useState({
    courier: shipment?.courier || "",
    trackingNumber: shipment?.trackingNumber || "",
    trackingUrl: shipment?.trackingUrl || "",
  });
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(null), 3500);
  }

  async function advance() {
    const next = moves[0];
    if (!next) return;
    const outside = next.to === "TRADUCIDO_ENTREGADO";
    if (
      outside &&
      !window.confirm(
        "Esto solo registra que ya se entregó por otra vía (no envía nada al cliente). Para enviar la traducción usa «Entregar al cliente». ¿Registrar?"
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${reference}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: next.to,
          reason: outside ? "Entregado por otra vía; marcado desde la ficha." : "Avance desde el pedido",
          ...(outside ? { deliveredOutsideApp: true } : {}),
        }),
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
    const trackingNumber = ship.trackingNumber.trim();
    if (!trackingNumber) {
      flash("Falta el número de seguimiento.");
      return;
    }
    // El sobre puede llevar varios pedidos del trámite: dilo ANTES de sellar,
    // porque sella los hermanos y manda un solo email al cliente.
    if (!shipment?.shippedAt && caseSiblingsToShip.length > 0) {
      const ok = window.confirm(
        `Este envío sella también ${caseSiblingsToShip.join(", ")} (mismo trámite ${caseRef}).\n\n` +
          `El cliente recibirá UN solo email con las ${caseSiblingsToShip.length + 1} referencias. ¿Sigo?`
      );
      if (!ok) return;
    }
    setBusy(true);
    try {
      const proof = proofFile ? await uploadStaffFile(proofFile, `shipments/${reference}`) : null;
      const res = await fetch(`/api/orders/${reference}/notify-shipment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackingNumber,
          courier: ship.courier.trim(),
          trackingUrl: ship.trackingUrl.trim(),
          ...(proof ? { proofUrl: proof.url, proofName: proof.name } : {}),
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || "No se pudo notificar el envío.");
      flash(
        `Envío notificado al cliente (seguimiento ${d.trackingNumber || trackingNumber})` +
          (d.references?.length > 1 ? ` · ${d.references.length} pedidos en el mismo sobre.` : ".")
      );
      setShipOpen(false);
      setProofFile(null);
      router.refresh();
    } catch (e: any) {
      flash(e?.message || "No se pudo notificar el envío.");
    } finally {
      setBusy(false);
    }
  }

  async function leaveCase() {
    if (!window.confirm(`Sacar ${reference} del trámite ${caseRef}? Los demás pedidos siguen agrupados.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${reference}/case`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ungroup: true }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || "No se pudo desagrupar.");
      flash(`${reference} ya no está en ningún trámite.`);
      router.refresh();
    } catch (e: any) {
      flash(e?.message || "No se pudo desagrupar.");
    } finally {
      setBusy(false);
    }
  }

  async function groupIntoCase() {
    const raw = window.prompt(
      caseRef
        ? `Trámite ${caseRef}. Referencias a añadir (separadas por comas):`
        : "Referencias del MISMO cliente que van en este trámite (separadas por comas):"
    );
    if (!raw || !raw.trim()) return;
    const references = raw.split(",").map((r) => r.trim()).filter(Boolean);
    if (references.length === 0) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${reference}/case`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ references }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || "No se pudo agrupar.");
      flash(`Trámite ${d.caseRef}: ${d.members.join(", ")}.`);
      router.refresh();
    } catch (e: any) {
      flash(e?.message || "No se pudo agrupar.");
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
        <button type="button" onClick={advance} disabled={busy} className={`${btn} bg-[#1A2E4A] text-white hover:bg-[#243F66]`}>
          Avanzar → {moves[0].label}
        </button>
      )}

      {paymentStatus !== "PAID" && phone && (
        <a
          href={`https://wa.me/${phone}?text=${encodeURIComponent(cobroText)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`${btn} bg-[#1F6B45] text-white hover:bg-[#185738]`}
        >
          Cobrar por WhatsApp (Bizum)
        </a>
      )}

      {invoice ? (
        <a
          href={`/api/orders/${reference}/invoice-pdf`}
          className={`${btn} border border-[#BFE0CC] text-[#1F6B45] hover:bg-[#EEF7F1]`}
        >
          🧾 {invoice.number || "Factura"} (PDF)
        </a>
      ) : (
        <button type="button" onClick={emitInvoice} disabled={busy} className={`${btn} border border-[#D5DAE1] text-[#1F2933] hover:bg-[#F6F7F9]`}>
          Emitir factura
        </button>
      )}

      {paymentStatus === "PAID" && (
        <button type="button" onClick={() => setShipOpen((v) => !v)} disabled={busy} className={`${btn} border border-[#D5DAE1] text-[#1F2933] hover:bg-[#F6F7F9]`}>
          📦 {shipment?.shippedAt ? "Envío notificado · corregir" : "Notificar envío"}
          {!shipment?.shippedAt && caseSiblingsToShip.length > 0 ? ` (${caseSiblingsToShip.length + 1} pedidos)` : ""}
        </button>
      )}

      {shipOpen && (
        <div className="basis-full rounded-xl border border-[#D5DAE1] bg-[#F6F7F9] p-3 text-sm">
          {shipment?.shippedAt && (
            <p className="mb-2 text-xs text-[#52606D]">
              Notificado el {new Date(shipment.shippedAt).toLocaleDateString("es-ES")}
              {shipment.proofUrl ? (
                <>
                  {" · "}
                  <a href={shipment.proofUrl} target="_blank" rel="noopener noreferrer" className="text-[#1A2E4A] hover:underline">
                    justificante actual{shipment.proofName ? ` (${shipment.proofName})` : ""}
                  </a>
                </>
              ) : (
                " · sin justificante"
              )}
              . Al guardar se vuelve a avisar al cliente.
            </p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-[#52606D]">
              Transportista
              <input list="couriers" value={ship.courier} onChange={(e) => setShip({ ...ship, courier: e.target.value })} className="mt-1 block w-full rounded-lg border border-[#D5DAE1] bg-[#fff] px-2 py-1.5 text-[#1F2933]" placeholder="Correos, MRW, SEUR…" />
              <datalist id="couriers">
                {["Correos", "Correos Express", "MRW", "SEUR", "GLS", "Nacex", "DHL", "UPS"].map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <label className="text-xs text-[#52606D]">
              Nº de seguimiento *
              <input value={ship.trackingNumber} onChange={(e) => setShip({ ...ship, trackingNumber: e.target.value })} className="mt-1 block w-full rounded-lg border border-[#D5DAE1] bg-[#fff] px-2 py-1.5 font-mono text-[#1F2933]" />
            </label>
            <label className="text-xs text-[#52606D] sm:col-span-2">
              Enlace de seguimiento (opcional)
              <input value={ship.trackingUrl} onChange={(e) => setShip({ ...ship, trackingUrl: e.target.value })} className="mt-1 block w-full rounded-lg border border-[#D5DAE1] bg-[#fff] px-2 py-1.5 text-[#1F2933]" placeholder="https://…" />
            </label>
            <label className="text-xs text-[#52606D] sm:col-span-2">
              Justificante del envío (foto o PDF del resguardo)
              <input type="file" accept="image/*,application/pdf" onChange={(e) => setProofFile(e.target.files?.[0] || null)} className="mt-1 block w-full text-[#1F2933]" />
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={notifyShipment} disabled={busy} className={`${btn} bg-[#1A2E4A] text-white hover:bg-[#243F66]`}>
              {busy ? "Enviando…" : "Guardar y avisar al cliente"}
            </button>
            <button type="button" onClick={() => setShipOpen(false)} disabled={busy} className={`${btn} border border-[#D5DAE1] text-[#1F2933] hover:bg-[#F6F7F9]`}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <button type="button" onClick={groupIntoCase} disabled={busy} className={`${btn} border border-[#D5DAE1] text-[#1F2933] hover:bg-[#F6F7F9]`}>
        {caseRef ? `🗂 Trámite ${caseRef}` : "🗂 Agrupar en un trámite"}
      </button>

      {caseRef && (
        <button type="button" onClick={leaveCase} disabled={busy} className={`${btn} border border-[#D5DAE1] text-[#52606D] hover:bg-[#F6F7F9]`}>
          Sacar del trámite
        </button>
      )}

      {quote && (
        <a href={`/zona-traductor/presupuestos/${quote.id}`} className={`${btn} border border-[#D5DAE1] text-[#1F2933] hover:bg-[#F6F7F9]`}>
          Presupuesto {quote.quoteNumber}
        </a>
      )}

      {msg && <span className="text-xs font-medium text-[#1A2E4A]">{msg}</span>}
    </div>
  );
}
