"use client";

import { useMemo, useState } from "react";
import {
  WORKFLOW_STATES,
  getNextWorkflowStates,
  getWorkflowStateLabel,
  type WorkflowState,
} from "@/lib/workflow";

type Props = {
  reference: string;
  currentState: string;
};

function parseWorkflowState(value: string): WorkflowState | null {
  return (WORKFLOW_STATES as readonly string[]).includes(value)
    ? (value as WorkflowState)
    : null;
}

export default function OrderWorkflowPanel({ reference, currentState }: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [notifyClient, setNotifyClient] = useState(true);

  const parsedCurrent = parseWorkflowState(currentState);
  const nextStates = useMemo(() => {
    if (!parsedCurrent) return [];
    return getNextWorkflowStates(parsedCurrent);
  }, [parsedCurrent]);

  const [nextState, setNextState] = useState<WorkflowState | "">(
    nextStates.length > 0 ? nextStates[0] : ""
  );

  const canNotifyClient = nextState === "PRESUPUESTO_ENVIADO" || nextState === "PENDIENTE_PAGO";

  async function submitTransition() {
    if (!nextState) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/orders/${reference}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: nextState,
          reason: reason.trim() || null,
          notifyClient: canNotifyClient ? notifyClient : false,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "No se pudo actualizar el workflow.");
      }
      const fromLabel = getWorkflowStateLabel(data.from || currentState);
      const toLabel = getWorkflowStateLabel(data.to || nextState);
      setMessage(data.changed ? `Transición aplicada: ${fromLabel} -> ${toLabel}.` : "Sin cambios.");
    } catch (err: any) {
      setMessage(err?.message || "Error actualizando workflow.");
    } finally {
      setLoading(false);
    }
  }

  if (!parsedCurrent) {
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-300">Workflow operativo</p>
        <p className="mt-2 text-sm text-slate-400">No hay estado de workflow reconocido para este pedido.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-300">Workflow operativo</p>
      <p className="mt-2 text-xs text-slate-400">
        Estado actual: <span className="font-semibold text-slate-200">{getWorkflowStateLabel(parsedCurrent)}</span>
      </p>
      {nextStates.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">No hay transiciones pendientes.</p>
      ) : (
        <div className="mt-3 space-y-2">
          <select
            value={nextState}
            onChange={(e) => setNextState(e.target.value as WorkflowState)}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-xs text-slate-100"
          >
            {nextStates.map((state) => (
              <option key={state} value={state}>
                {getWorkflowStateLabel(state)}
              </option>
            ))}
          </select>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo operativo de la transición"
            className="h-16 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-xs text-slate-100"
          />
          {canNotifyClient && (
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={notifyClient}
                onChange={(e) => setNotifyClient(e.target.checked)}
                className="rounded border-slate-500"
              />
              Notificar al cliente con enlace de pago
            </label>
          )}
          <button
            type="button"
            onClick={submitTransition}
            disabled={loading || !nextState}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            {loading ? "Guardando..." : "Aplicar transición"}
          </button>
        </div>
      )}
      {message && <p className="mt-2 text-xs font-semibold text-slate-200">{message}</p>}
    </div>
  );
}

