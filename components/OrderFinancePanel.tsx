"use client";

import { useState } from "react";
import type { FinanceSnapshot } from "@/lib/finance";

type Props = {
  reference: string;
  amountCents: number;
  snapshot: FinanceSnapshot;
};

type SupplierStatus = "PENDING_REQUEST" | "RECEIVED" | "VALIDATED" | "PAID";
type BillingMode = "PER_ORDER" | "MONTHLY_BATCH";
type SupplierType = "AUTONOMO" | "EMPRESA";

function toMoney(cents: number | null) {
  if (cents === null) return "—";
  return `${(cents / 100).toFixed(2)} EUR`;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-ES");
}

function toDateInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export default function OrderFinancePanel({ reference, amountCents, snapshot }: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [receivedAmountCents, setReceivedAmountCents] = useState(
    String(snapshot.reconciliationReceivedAmountCents ?? amountCents)
  );
  const [gatewayFeeCents, setGatewayFeeCents] = useState(
    String(snapshot.reconciliationGatewayFeeCents ?? 0)
  );
  const [toleranceEur, setToleranceEur] = useState(
    ((snapshot.reconciliationToleranceCents || 300) / 100).toFixed(2)
  );
  const [settledAt, setSettledAt] = useState(toDateInput(snapshot.reconciledAt));

  const [supplierStatus, setSupplierStatus] = useState<SupplierStatus>(
    snapshot.supplierInvoiceStatus === "RECEIVED" ||
      snapshot.supplierInvoiceStatus === "VALIDATED" ||
      snapshot.supplierInvoiceStatus === "PAID"
      ? snapshot.supplierInvoiceStatus
      : "PENDING_REQUEST"
  );
  const [billingMode, setBillingMode] = useState<BillingMode>(
    snapshot.supplierInvoiceBillingMode === "MONTHLY_BATCH" ? "MONTHLY_BATCH" : "PER_ORDER"
  );
  const [supplierType, setSupplierType] = useState<SupplierType>(
    snapshot.supplierType === "EMPRESA" ? "EMPRESA" : "AUTONOMO"
  );
  const [supplierName, setSupplierName] = useState(snapshot.supplierName || "");
  const [invoiceNumber, setInvoiceNumber] = useState(snapshot.supplierInvoiceNumber || "");
  const [invoiceTotalCents, setInvoiceTotalCents] = useState(
    snapshot.supplierInvoiceTotalCents === null ? "" : String(snapshot.supplierInvoiceTotalCents)
  );
  const [invoiceDueDate, setInvoiceDueDate] = useState(toDateInput(snapshot.supplierInvoiceDueDate));
  const [irpfRetentionPct, setIrpfRetentionPct] = useState(
    snapshot.supplierIrpfRetentionPct !== null && snapshot.supplierIrpfRetentionPct !== undefined
      ? String(snapshot.supplierIrpfRetentionPct)
      : supplierType === "AUTONOMO"
        ? "15"
        : "0"
  );

  const [supplierCostCents, setSupplierCostCents] = useState(
    snapshot.marginSupplierCostCents === null ? "" : String(snapshot.marginSupplierCostCents)
  );
  const [otherCostCents, setOtherCostCents] = useState(
    String(snapshot.marginOtherCostCents ?? 0)
  );
  const [approvalNote, setApprovalNote] = useState("");

  async function postJson(url: string, body: Record<string, unknown>) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || "No se pudo guardar.");
    }
    return data;
  }

  async function saveReconciliation() {
    setLoading(true);
    setMessage(null);
    try {
      const data = await postJson(`/api/orders/${reference}/finance/reconciliation`, {
        expectedAmountCents: amountCents,
        receivedAmountCents: Number(receivedAmountCents),
        gatewayFeeCents: Number(gatewayFeeCents),
        toleranceCents: Math.round(Number(toleranceEur || 0) * 100),
        settledAt: settledAt || null,
      });
      setMessage(
        `Conciliacion guardada (${data.reconciliationStatus}, tolerancia ${(Number(data.toleranceCents || 0) / 100).toFixed(2)} EUR).`
      );
    } catch (err: any) {
      setMessage(err?.message || "Error guardando conciliacion.");
    } finally {
      setLoading(false);
    }
  }

  async function saveSupplierInvoice() {
    setLoading(true);
    setMessage(null);
    try {
      await postJson(`/api/orders/${reference}/finance/supplier-invoice`, {
        status: supplierStatus,
        billingMode,
        supplierType,
        supplierName: supplierName || null,
        invoiceNumber: invoiceNumber || null,
        totalCents: invoiceTotalCents ? Number(invoiceTotalCents) : null,
        dueDate: invoiceDueDate || null,
        irpfRetentionPct: supplierType === "AUTONOMO" ? Number(irpfRetentionPct || 0) : 0,
      });
      setMessage("Factura proveedor actualizada.");
    } catch (err: any) {
      setMessage(err?.message || "Error actualizando factura proveedor.");
    } finally {
      setLoading(false);
    }
  }

  async function saveMargin() {
    setLoading(true);
    setMessage(null);
    try {
      const data = await postJson(`/api/orders/${reference}/finance/margin`, {
        supplierCostCents: supplierCostCents ? Number(supplierCostCents) : 0,
        gatewayFeeCents: Number(gatewayFeeCents),
        otherCostCents: Number(otherCostCents),
      });
      setMessage(`Margen actualizado: ${toMoney(data.marginCents)} (${data.marginPct ?? 0}%).`);
    } catch (err: any) {
      setMessage(err?.message || "Error actualizando margen.");
    } finally {
      setLoading(false);
    }
  }

  async function updateMarginApproval(status: "APPROVED" | "REJECTED") {
    setLoading(true);
    setMessage(null);
    try {
      await postJson(`/api/orders/${reference}/finance/margin-approval`, {
        status,
        note: approvalNote || null,
      });
      setMessage(status === "APPROVED" ? "Margen bajo aprobado." : "Margen bajo rechazado.");
    } catch (err: any) {
      setMessage(err?.message || "No se pudo actualizar la aprobacion de margen.");
    } finally {
      setLoading(false);
    }
  }

  async function closeFinance() {
    setLoading(true);
    setMessage(null);
    try {
      const data = await postJson(`/api/orders/${reference}/finance/close`, {});
      setMessage(data?.alreadyClosed ? "El pedido ya estaba cerrado financieramente." : "Cierre financiero registrado.");
    } catch (err: any) {
      setMessage(err?.message || "No se pudo cerrar financieramente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-xs text-slate-300">
        <p>
          Reconciliacion:{" "}
          <span className="font-semibold text-slate-100">{snapshot.reconciliationStatus}</span>
          {snapshot.reconciliationDiffCents !== null && (
            <span className="ml-2">
              Descuadre: {toMoney(snapshot.reconciliationDiffCents)} (tol:{" "}
              {(snapshot.reconciliationToleranceCents / 100).toFixed(2)} EUR)
            </span>
          )}
        </p>
        <p className="mt-1">
          Factura proveedor:{" "}
          <span className="font-semibold text-slate-100">{snapshot.supplierInvoiceStatus}</span>
          <span className="ml-2 text-slate-400">
            ({snapshot.supplierInvoiceBillingMode === "MONTHLY_BATCH" ? "Lote mensual" : "Por pedido"})
          </span>
        </p>
        <p className="mt-1">
          Tipo proveedor:{" "}
          <span className="font-semibold text-slate-200">
            {snapshot.supplierType === "AUTONOMO"
              ? "Autonomo"
              : snapshot.supplierType === "EMPRESA"
                ? "Empresa"
                : "No definido"}
          </span>
        </p>
        <p className="mt-1">
          Margen actual:{" "}
          <span
            className={`font-semibold ${
              snapshot.marginCents !== null && snapshot.marginCents < 0 ? "text-red-300" : "text-emerald-300"
            }`}
          >
            {toMoney(snapshot.marginCents)}
          </span>
          {snapshot.marginPct !== null && <span className="ml-2">({snapshot.marginPct}%)</span>}
        </p>
        <p className="mt-1">
          Umbral minimo:{" "}
          <span className="font-semibold text-slate-200">{snapshot.marginThresholdPct}%</span> | Aprobacion margen:{" "}
          <span className="font-semibold text-slate-100">{snapshot.marginApprovalStatus}</span>
        </p>
        <p className="mt-1">
          Cierre contable (dia 25): <span className="font-semibold text-slate-100">{formatDate(snapshot.accountingCutoffDate)}</span>
          {snapshot.accountingCutoffPassed && <span className="ml-2 text-amber-300">periodo vencido</span>}
        </p>
        {snapshot.warnings.length > 0 && (
          <ul className="mt-2 space-y-1 text-[11px] text-amber-300">
            {snapshot.warnings.map((w) => (
              <li key={w}>• {w}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">Conciliacion cobro</p>
          <div className="mt-2 space-y-2">
            <input
              type="number"
              value={receivedAmountCents}
              onChange={(e) => setReceivedAmountCents(e.target.value)}
              placeholder="Importe recibido (centimos)"
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-xs text-slate-100"
            />
            <input
              type="number"
              value={gatewayFeeCents}
              onChange={(e) => setGatewayFeeCents(e.target.value)}
              placeholder="Comision pasarela (centimos)"
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-xs text-slate-100"
            />
            <input
              type="number"
              min={1}
              max={5}
              step={0.5}
              value={toleranceEur}
              onChange={(e) => setToleranceEur(e.target.value)}
              placeholder="Tolerancia descuadre (1-5 EUR)"
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-xs text-slate-100"
            />
            <input
              type="date"
              value={settledAt}
              onChange={(e) => setSettledAt(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-xs text-slate-100"
            />
            <button
              type="button"
              onClick={saveReconciliation}
              disabled={loading}
              className="w-full rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-60"
            >
              Guardar conciliacion
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Factura proveedor</p>
          <div className="mt-2 space-y-2">
            <select
              value={supplierStatus}
              onChange={(e) => setSupplierStatus(e.target.value as SupplierStatus)}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-xs text-slate-100"
            >
              <option value="PENDING_REQUEST">Pendiente de solicitar</option>
              <option value="RECEIVED">Recibida</option>
              <option value="VALIDATED">Validada</option>
              <option value="PAID">Pagada</option>
            </select>
            <select
              value={billingMode}
              onChange={(e) => setBillingMode(e.target.value as BillingMode)}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-xs text-slate-100"
            >
              <option value="PER_ORDER">Facturacion por pedido</option>
              <option value="MONTHLY_BATCH">Facturacion por lote mensual</option>
            </select>
            <select
              value={supplierType}
              onChange={(e) => {
                const next = e.target.value as SupplierType;
                setSupplierType(next);
                if (next === "EMPRESA") setIrpfRetentionPct("0");
              }}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-xs text-slate-100"
            >
              <option value="AUTONOMO">Proveedor autonomo (con IRPF)</option>
              <option value="EMPRESA">Proveedor empresa (sin IRPF)</option>
            </select>
            {supplierType === "AUTONOMO" && (
              <input
                type="number"
                value={irpfRetentionPct}
                onChange={(e) => setIrpfRetentionPct(e.target.value)}
                min={0}
                max={30}
                step={0.5}
                placeholder="% IRPF retenido"
                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-xs text-slate-100"
              />
            )}
            <input
              type="text"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="Proveedor / traductor"
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-xs text-slate-100"
            />
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="Numero de factura"
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-xs text-slate-100"
            />
            <input
              type="number"
              value={invoiceTotalCents}
              onChange={(e) => setInvoiceTotalCents(e.target.value)}
              placeholder="Total factura (centimos)"
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-xs text-slate-100"
            />
            <input
              type="date"
              value={invoiceDueDate}
              onChange={(e) => setInvoiceDueDate(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-xs text-slate-100"
            />
            <button
              type="button"
              onClick={saveSupplierInvoice}
              disabled={loading}
              className="w-full rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-60"
            >
              Guardar factura proveedor
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">Margen del pedido</p>
          <div className="mt-2 space-y-2">
            <input
              type="number"
              value={supplierCostCents}
              onChange={(e) => setSupplierCostCents(e.target.value)}
              placeholder="Coste proveedor (centimos)"
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-xs text-slate-100"
            />
            <input
              type="number"
              value={otherCostCents}
              onChange={(e) => setOtherCostCents(e.target.value)}
              placeholder="Otros costes (centimos)"
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-xs text-slate-100"
            />
            <button
              type="button"
              onClick={saveMargin}
              disabled={loading}
              className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              Calcular y guardar margen
            </button>
          </div>
          {snapshot.requiresMarginApproval && (
            <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2">
              <p className="text-[11px] text-amber-200">
                Margen por debajo del {snapshot.marginThresholdPct}%. Requiere aprobacion.
              </p>
              <textarea
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                placeholder="Nota de aprobacion/rechazo"
                className="mt-2 h-16 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-xs text-slate-100"
              />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => updateMarginApproval("APPROVED")}
                  disabled={loading}
                  className="rounded-lg bg-lime-600 px-3 py-2 text-xs font-semibold text-white hover:bg-lime-500 disabled:opacity-60"
                >
                  Aprobar margen
                </button>
                <button
                  type="button"
                  onClick={() => updateMarginApproval("REJECTED")}
                  disabled={loading}
                  className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-60"
                >
                  Rechazar margen
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-300">Cierre financiero</p>
          <p className="mt-2 text-xs text-slate-400">
            Sin aprobacion extra: al pagar proveedor se informa al Project Manager. El cierre exige conciliacion OK,
            factura requerida y margen valido.
          </p>
          <button
            type="button"
            onClick={closeFinance}
            disabled={loading}
            className="mt-3 w-full rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-60"
          >
            {snapshot.hasFinanceCloseEvent ? "Cierre ya registrado" : "Cerrar financieramente"}
          </button>
        </div>
      </div>

      {message && <p className="text-xs font-semibold text-slate-200">{message}</p>}
    </div>
  );
}
