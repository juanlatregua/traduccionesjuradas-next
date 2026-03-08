"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type OrderRow = {
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
  createdAt: string;
  paidAt: string | null;
  events: { payload: any; createdAt: string }[];
};

type ApiResponse = {
  ok: boolean;
  orders: OrderRow[];
  total: number;
  page: number;
  pages: number;
};

const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "PENDING_PAYMENT", label: "Pendiente pago" },
  { value: "PAID", label: "Pagado" },
  { value: "IN_PROGRESS", label: "En proceso" },
  { value: "DELIVERED", label: "Entregado" },
  { value: "CANCELLED", label: "Cancelado" },
];

const PAYMENT_OPTIONS = [
  { value: "", label: "Todos los pagos" },
  { value: "PENDING", label: "Pendiente" },
  { value: "PAID", label: "Pagado" },
  { value: "FAILED", label: "Fallido" },
  { value: "REFUNDED", label: "Reembolsado" },
];

const STATUS_COLORS: Record<string, string> = {
  PENDING_PAYMENT: "bg-amber-100 text-amber-800",
  PAID: "bg-emerald-100 text-emerald-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  DELIVERED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

const PAYMENT_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  PAID: "bg-emerald-100 text-emerald-800",
  FAILED: "bg-red-100 text-red-800",
  REFUNDED: "bg-purple-100 text-purple-800",
};

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${colorClass}`}>
      {label}
    </span>
  );
}

export function AdminOrdersList() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchOrders = useCallback(async (s: string, st: string, ps: string, p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (s) params.set("search", s);
      if (st) params.set("status", st);
      if (ps) params.set("paymentStatus", ps);
      params.set("page", String(p));
      const res = await fetch(`/api/admin/orders?${params}`);
      const json = await res.json();
      setData(json);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchOrders(search, status, paymentStatus, 1);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search, status, paymentStatus, fetchOrders]);

  useEffect(() => {
    fetchOrders(search, status, paymentStatus, page);
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Buscar por referencia, email o nombre..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-bleu focus:outline-none"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={paymentStatus}
          onChange={(e) => setPaymentStatus(e.target.value)}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        >
          {PAYMENT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {loading && !data ? (
        <p className="mt-6 text-sm text-slate-500">Cargando...</p>
      ) : !data?.orders?.length ? (
        <p className="mt-6 text-sm text-slate-600">No se encontraron pedidos.</p>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-4 py-3">Ref.</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Concepto</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Pago</th>
                  <th className="px-4 py-3 text-right">Importe</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((order) => {
                  const workflowState = order.events[0]?.payload
                    ? (order.events[0].payload as any)?.to
                    : null;
                  return (
                    <tr key={order.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-mono text-xs text-emerald-700">
                        {order.reference}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{order.clientName || "—"}</p>
                        <p className="text-xs text-slate-500">{order.clientEmail}</p>
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-slate-700">
                        {order.title}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          label={order.status}
                          colorClass={STATUS_COLORS[order.status] || "bg-slate-100 text-slate-700"}
                        />
                        {workflowState && (
                          <p className="mt-1 text-[10px] text-slate-500">{workflowState}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          label={order.paymentStatus}
                          colorClass={PAYMENT_COLORS[order.paymentStatus] || "bg-slate-100 text-slate-700"}
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {(order.amountCents / 100).toFixed(2)} EUR
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {new Date(order.createdAt).toLocaleDateString("es-ES")}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/orders/${order.reference}`}
                          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Abrir
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {data.pages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
              <p>
                Página {data.page} de {data.pages} ({data.total} pedidos)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                  disabled={page >= data.pages}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
