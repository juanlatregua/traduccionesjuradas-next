"use client";

import { useState } from "react";

type Props = {
  reference: string;
  isArchived: boolean;
};

export default function OrderLifecyclePanel({ reference, isArchived }: Props) {
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

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-rose-300">Control del pedido</p>
      <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-xs text-slate-300">
        <p>
          Estado de archivo:{" "}
          <span className={isArchived ? "font-semibold text-amber-300" : "font-semibold text-emerald-300"}>
            {isArchived ? "Archivado" : "Activo"}
          </span>
        </p>
        <p className="mt-1 text-[11px] text-slate-400">
          Archivar oculta el pedido de la operativa habitual. Eliminar lo borra de forma permanente.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={toggleArchive}
          disabled={loading}
          className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-60"
        >
          {loading ? "Guardando..." : isArchived ? "Restaurar pedido" : "Archivar pedido"}
        </button>
        <button
          type="button"
          onClick={deleteOrder}
          disabled={loading}
          className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-60"
        >
          {loading ? "Eliminando..." : "Eliminar definitivamente"}
        </button>
      </div>

      {message && <p className="text-xs font-semibold text-slate-100">{message}</p>}
    </div>
  );
}

