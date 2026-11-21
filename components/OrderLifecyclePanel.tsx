"use client";

import { useState } from "react";
import type { OrderActionStage, OrderGates } from "@/lib/order-actions";

type Props = {
  reference: string;
  isArchived: boolean;
  canonicalStage: OrderActionStage;
  gates: OrderGates;
  canClose: boolean;
};

export default function OrderLifecyclePanel({
  reference,
  isArchived,
  canonicalStage,
  gates,
  canClose,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function postJson(url: string, body: Record<string, unknown>) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || "No se pudo ejecutar la acción.");
    }
    return data;
  }

  async function toggleArchive() {
    setLoading(true);
    setMessage(null);
    try {
      const nextArchived = !isArchived;
      await postJson(`/api/orders/${reference}/archive`, {
        archived: nextArchived,
      });
      setMessage(nextArchived ? "Pedido archivado." : "Pedido restaurado.");
      setTimeout(() => window.location.reload(), 700);
    } catch (err: any) {
      setMessage(err?.message || "No se pudo actualizar el archivo.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteOrder() {
    const confirmed = window.confirm(
      `Se eliminará el pedido ${reference} de forma permanente. Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    const typed = window.prompt(`Escribe la referencia exacta (${reference}) para confirmar:`);
    if ((typed || "").trim() !== reference) {
      setMessage("Confirmación cancelada: referencia incorrecta.");
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      await postJson(`/api/orders/${reference}/delete`, {
        confirmReference: reference,
      });
      setMessage("Pedido eliminado definitivamente.");
      setTimeout(() => window.location.assign("/zona-traductor"), 700);
    } catch (err: any) {
      setMessage(err?.message || "No se pudo eliminar el pedido.");
    } finally {
      setLoading(false);
    }
  }

  async function closeOrder() {
    setLoading(true);
    setMessage(null);
    try {
      await postJson(`/api/orders/${reference}/finance/close`, {});
      setMessage("Pedido cerrado correctamente.");
      setTimeout(() => window.location.reload(), 800);
    } catch (err: any) {
      setMessage(err?.message || "No se pudo cerrar el pedido.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#A12B2B]">Control del pedido</p>
      <div className="rounded-xl border border-[#D5DAE1] bg-[#F6F7F9] p-3 text-xs text-[#1F2933]">
        <p>
          Estado de archivo:{" "}
          <span className={isArchived ? "font-semibold text-[#7A5A10]" : "font-semibold text-[#1F6B45]"}>
            {isArchived ? "Archivado" : "Activo"}
          </span>
        </p>
        <p className="mt-1">
          Stage canónico: <span className="font-semibold text-[#1A2E4A]">{canonicalStage}</span>
        </p>
        <p className="mt-1 text-[11px] text-[#52606D]">
          Archivar oculta el pedido de la operativa habitual. Eliminar lo borra de forma permanente.
        </p>
        <ul className="mt-3 space-y-1 text-[11px]">
          <li className={gates.quoteReady ? "text-[#1F6B45]" : "text-[#7A5A10]"}>
            {gates.quoteReady ? "OK" : "PEND"} quote + preview
          </li>
          <li className={gates.paymentValidated ? "text-[#1F6B45]" : "text-[#7A5A10]"}>
            {gates.paymentValidated ? "OK" : "PEND"} pago validado
          </li>
          <li className={gates.productionReady ? "text-[#1F6B45]" : "text-[#7A5A10]"}>
            {gates.productionReady ? "OK" : "PEND"} asignación producción
          </li>
          <li className={gates.deliveryReady ? "text-[#1F6B45]" : "text-[#7A5A10]"}>
            {gates.deliveryReady ? "OK" : "PEND"} artefacto entrega final
          </li>
          <li className={gates.deliveredReady ? "text-[#1F6B45]" : "text-[#7A5A10]"}>
            {gates.deliveredReady ? "OK" : "PEND"} notificación cliente enviada
          </li>
          <li className={gates.closeReady ? "text-[#1F6B45]" : "text-[#7A5A10]"}>
            {gates.closeReady ? "OK" : "PEND"} cierre financiero y operativo
          </li>
        </ul>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <button
          type="button"
          onClick={closeOrder}
          disabled={loading || !canClose}
          className="rounded-lg bg-[#1A2E4A] px-3 py-2 text-xs font-semibold text-white hover:bg-[#243F66] disabled:opacity-60"
        >
          {loading ? "Cerrando..." : "Cerrar pedido"}
        </button>
        <button
          type="button"
          onClick={toggleArchive}
          disabled={loading}
          className="rounded-lg bg-[#7A5A10] px-3 py-2 text-xs font-semibold text-white hover:bg-[#654A0D] disabled:opacity-60"
        >
          {loading ? "Guardando..." : isArchived ? "Restaurar pedido" : "Archivar pedido"}
        </button>
        <button
          type="button"
          onClick={deleteOrder}
          disabled={loading}
          className="rounded-lg bg-[#A12B2B] px-3 py-2 text-xs font-semibold text-white hover:bg-[#8A2323] disabled:opacity-60"
        >
          {loading ? "Eliminando..." : "Eliminar definitivamente"}
        </button>
      </div>

      {message && <p className="text-xs font-semibold text-[#1F2933]">{message}</p>}
    </div>
  );
}
