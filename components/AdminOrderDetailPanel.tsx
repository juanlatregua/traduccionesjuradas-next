"use client";

import { useState } from "react";

type OrderDetail = {
  id: string;
  reference: string;
  clientEmail: string;
  clientName: string | null;
  title: string;
  langPair: string | null;
  amountCents: number;
  currency: string;
  status: string;
  paymentStatus: string;
  deliveryState: string;
  assignedTo: string | null;
  dueDate: string | null;
  createdAt: string;
  paidAt: string | null;
  events: { id: string; type: string; message: string; createdAt: string }[];
  billing: {
    fiscalName: string;
    nif: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
    email: string;
  } | null;
  shipping: {
    name: string;
    phone: string;
    address: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
  } | null;
};

const WORKFLOW_STATES = [
  "BORRADOR",
  "PENDIENTE_REVISION",
  "PRESUPUESTO_ENVIADO",
  "PENDIENTE_PAGO",
  "JUSTIFICANTE_SUBIDO",
  "PAGO_VALIDADO",
  "EN_TRADUCCION",
  "TRADUCIDO_ENTREGADO",
  "CERRADO",
] as const;

export function AdminOrderDetailPanel({ order }: { order: OrderDetail }) {
  const [assignedTo, setAssignedTo] = useState(order.assignedTo || "");
  const [dueDate, setDueDate] = useState(order.dueDate?.slice(0, 10) || "");
  const [workflowTo, setWorkflowTo] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function handleAssign() {
    setBusy("assign");
    setMessage("");
    try {
      const res = await fetch(`/api/orders/${order.reference}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedTo: assignedTo || null,
          dueDate: dueDate || null,
        }),
      });
      const json = await res.json();
      setMessage(json.ok ? "Asignacion actualizada." : json.error || "Error");
    } catch {
      setMessage("Error de red.");
    } finally {
      setBusy("");
    }
  }

  async function handleWorkflow() {
    if (!workflowTo) return;
    setBusy("workflow");
    setMessage("");
    try {
      const res = await fetch(`/api/orders/${order.reference}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: workflowTo }),
      });
      const json = await res.json();
      setMessage(json.ok ? `Workflow → ${json.to}` : json.error || "Error");
    } catch {
      setMessage("Error de red.");
    } finally {
      setBusy("");
    }
  }

  async function handleConfirmPayment(method: "BIZUM" | "TRANSFER") {
    setBusy("payment");
    setMessage("");
    try {
      const res = await fetch(`/api/orders/${order.reference}/confirm-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      });
      const json = await res.json();
      setMessage(json.ok ? "Pago confirmado." : json.error || "Error");
    } catch {
      setMessage("Error de red.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-6">
      {/* Order info */}
      <div className="grid gap-3 sm:grid-cols-2">
        <InfoRow label="Referencia" value={order.reference} />
        <InfoRow label="Cliente" value={`${order.clientName || "—"} · ${order.clientEmail}`} />
        <InfoRow label="Concepto" value={order.title} />
        <InfoRow label="Idiomas" value={order.langPair || "—"} />
        <InfoRow label="Importe" value={`${(order.amountCents / 100).toFixed(2)} EUR`} />
        <InfoRow label="Estado" value={order.status} />
        <InfoRow label="Pago" value={order.paymentStatus} />
        <InfoRow label="Entrega" value={order.deliveryState} />
        <InfoRow label="Asignado a" value={order.assignedTo || "—"} />
        <InfoRow label="Fecha creacion" value={new Date(order.createdAt).toLocaleString("es-ES")} />
        {order.paidAt && (
          <InfoRow label="Pagado" value={new Date(order.paidAt).toLocaleString("es-ES")} />
        )}
      </div>

      {/* Actions */}
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-bold text-slate-900">Acciones rapidas</h3>

        {message && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>
        )}

        {/* Assign translator */}
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="text-xs text-slate-600">Traductor</label>
            <input
              type="text"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="block w-48 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              placeholder="Nombre o email"
            />
          </div>
          <div>
            <label className="text-xs text-slate-600">Fecha limite</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="block rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <button
            onClick={handleAssign}
            disabled={!!busy}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {busy === "assign" ? "..." : "Asignar"}
          </button>
        </div>

        {/* Workflow transition */}
        <div className="flex items-end gap-2">
          <div>
            <label className="text-xs text-slate-600">Cambiar workflow</label>
            <select
              value={workflowTo}
              onChange={(e) => setWorkflowTo(e.target.value)}
              className="block rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">Seleccionar estado...</option>
              {WORKFLOW_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleWorkflow}
            disabled={!!busy || !workflowTo}
            className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
          >
            {busy === "workflow" ? "..." : "Transicionar"}
          </button>
        </div>

        {/* Confirm payment */}
        {order.paymentStatus === "PENDING" && (
          <div className="flex gap-2">
            <button
              onClick={() => handleConfirmPayment("BIZUM")}
              disabled={!!busy}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {busy === "payment" ? "..." : "Marcar pagado (Bizum)"}
            </button>
            <button
              onClick={() => handleConfirmPayment("TRANSFER")}
              disabled={!!busy}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {busy === "payment" ? "..." : "Marcar pagado (Transferencia)"}
            </button>
          </div>
        )}
      </div>

      {/* Billing / Shipping */}
      {order.billing && (
        <div className="rounded-2xl border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-900">Datos de facturacion</h3>
          <div className="mt-2 grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
            <InfoRow label="Nombre fiscal" value={order.billing.fiscalName} />
            <InfoRow label="NIF" value={order.billing.nif} />
            <InfoRow label="Direccion" value={order.billing.address} />
            <InfoRow label="Ciudad" value={`${order.billing.city} ${order.billing.postalCode}`} />
            <InfoRow label="Pais" value={order.billing.country} />
            <InfoRow label="Email" value={order.billing.email} />
          </div>
        </div>
      )}

      {order.shipping && (
        <div className="rounded-2xl border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-900">Datos de envio</h3>
          <div className="mt-2 grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
            <InfoRow label="Nombre" value={order.shipping.name} />
            <InfoRow label="Telefono" value={order.shipping.phone} />
            <InfoRow label="Direccion" value={order.shipping.address} />
            <InfoRow label="Ciudad" value={`${order.shipping.city} (${order.shipping.province})`} />
            <InfoRow label="CP" value={order.shipping.postalCode} />
            <InfoRow label="Pais" value={order.shipping.country} />
          </div>
        </div>
      )}

      {/* Event timeline */}
      <div className="rounded-2xl border border-slate-200 p-4">
        <h3 className="text-sm font-bold text-slate-900">Timeline de eventos</h3>
        {order.events.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Sin eventos registrados.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {order.events.map((evt) => (
              <li key={evt.id} className="flex gap-3 text-sm">
                <span className="shrink-0 text-xs text-slate-400">
                  {new Date(evt.createdAt).toLocaleString("es-ES")}
                </span>
                <span className="font-mono text-xs text-slate-500">{evt.type}</span>
                <span className="text-slate-700">{evt.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-xs font-semibold text-slate-500">{label}:</span>{" "}
      <span className="text-sm text-slate-900">{value}</span>
    </p>
  );
}
