"use client";

import { type FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type FilterKey =
  | "todos"
  | "pagados-sin-asignar"
  | "pendientes-revision"
  | "origen-whatsapp"
  | "en-proceso"
  | "sla-riesgo"
  | "pendientes-pago"
  | "traducidos"
  | "riesgo-financiero"
  | "margen-aprobacion"
  | "lote-pendiente"
  | "archivados";

const LABELS: Record<FilterKey, string> = {
  todos: "Todos",
  "pagados-sin-asignar": "Pagados sin asignar",
  "pendientes-revision": "Pend. revisión",
  "origen-whatsapp": "Origen WhatsApp",
  "en-proceso": "En proceso",
  "sla-riesgo": "SLA en riesgo",
  "pendientes-pago": "Pend. pago",
  traducidos: "Traducidos",
  "riesgo-financiero": "Riesgo financiero",
  "margen-aprobacion": "Aprobacion margen",
  "lote-pendiente": "Lote pendiente",
  archivados: "Archivados",
};

type PeriodKey = "total" | "hoy" | "7d" | "mes" | "mes-anterior" | "custom";
type DateBaseKey = "created" | "paid";

const PERIOD_LABELS: Record<PeriodKey, string> = {
  total: "Total histórico",
  hoy: "Hoy",
  "7d": "Últimos 7 días",
  mes: "Mes actual",
  "mes-anterior": "Mes anterior",
  custom: "Rango personalizado",
};

function normalizePeriod(value?: string): PeriodKey {
  if (value === "hoy" || value === "7d" || value === "mes" || value === "mes-anterior" || value === "custom") {
    return value;
  }
  return "total";
}

function normalizeDateBase(value?: string): DateBaseKey {
  return value === "paid" ? "paid" : "created";
}

type Props = {
  current: string;
  counts: Record<string, number>;
  query?: string;
  period?: string;
  fromDate?: string;
  toDate?: string;
  dateBase?: string;
};

export default function ZonaTraductorFilters({
  current,
  counts,
  query,
  period,
  fromDate,
  toDate,
  dateBase,
}: Props) {
  const router = useRouter();
  // La vista activa (Tarjetas|Tabla) es ortogonal al filtro: filtrar no debe
  // sacarte de la lectura que estabas usando.
  const vista = useSearchParams().get("vista");
  const [search, setSearch] = useState(query || "");
  const [periodKey, setPeriodKey] = useState<PeriodKey>(normalizePeriod(period));
  const [from, setFrom] = useState(fromDate || "");
  const [to, setTo] = useState(toDate || "");
  const [base, setBase] = useState<DateBaseKey>(normalizeDateBase(dateBase));

  const cleanedSearch = useMemo(() => search.trim(), [search]);

  function buildUrl(
    filterKey: string,
    q: string,
    nextPeriod: PeriodKey,
    nextFrom: string,
    nextTo: string,
    nextBase: DateBaseKey
  ) {
    const params = new URLSearchParams();
    if (filterKey !== "todos") params.set("filtro", filterKey);
    if (q) params.set("q", q);
    if (nextBase !== "created") params.set("base", nextBase);
    if (nextPeriod !== "total") {
      params.set("periodo", nextPeriod);
      if (nextPeriod === "custom") {
        if (nextFrom) params.set("desde", nextFrom);
        if (nextTo) params.set("hasta", nextTo);
      }
    }
    if (vista) params.set("vista", vista);
    const qs = params.toString();
    return qs ? `/zona-traductor?${qs}` : "/zona-traductor";
  }

  function navigate(filterKey: string) {
    router.push(buildUrl(filterKey, cleanedSearch, periodKey, from, to, base));
  }

  function submitSearch(e: FormEvent) {
    e.preventDefault();
    router.push(buildUrl(current || "todos", cleanedSearch, periodKey, from, to, base));
  }

  function submitPeriod(e: FormEvent) {
    e.preventDefault();
    router.push(buildUrl(current || "todos", cleanedSearch, periodKey, from, to, base));
  }

  function clearSearch() {
    setSearch("");
    router.push(buildUrl(current || "todos", "", periodKey, from, to, base));
  }

  function resetView() {
    setSearch("");
    setPeriodKey("total");
    setFrom("");
    setTo("");
    setBase("created");
    router.push(vista ? `/zona-traductor?vista=${vista}` : "/zona-traductor");
  }

  function exportCsv() {
    const params = new URLSearchParams();
    if ((current || "todos") !== "todos") params.set("filtro", current || "todos");
    if (cleanedSearch) params.set("q", cleanedSearch);
    if (base !== "created") params.set("base", base);
    if (periodKey !== "total") {
      params.set("periodo", periodKey);
      if (periodKey === "custom") {
        if (from) params.set("desde", from);
        if (to) params.set("hasta", to);
      }
    }
    const qs = params.toString();
    const url = qs ? `/api/orders/export?${qs}` : "/api/orders/export";
    window.location.assign(url);
  }

  return (
    <div className="mt-4 space-y-3">
      <form onSubmit={submitPeriod} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/60 p-3">
        <select
          value={base}
          onChange={(e) => setBase(normalizeDateBase(e.target.value))}
          className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          aria-label="Base temporal estadística"
        >
          <option value="created">Base: fecha de pedido</option>
          <option value="paid">Base: fecha de cobro</option>
        </select>
        <select
          value={periodKey}
          onChange={(e) => setPeriodKey(normalizePeriod(e.target.value))}
          className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          aria-label="Periodo estadistico"
        >
          {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map((key) => (
            <option key={key} value={key}>
              {PERIOD_LABELS[key]}
            </option>
          ))}
        </select>

        {periodKey === "custom" && (
          <>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              aria-label="Desde"
            />
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              aria-label="Hasta"
            />
          </>
        )}

        <button
          type="submit"
          className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white hover:bg-indigo-500"
        >
          Aplicar periodo
        </button>
        <button
          type="button"
          onClick={exportCsv}
          className="rounded-xl border border-emerald-500/50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-300 hover:bg-emerald-500/10"
        >
          Exportar CSV
        </button>
      </form>

      <form onSubmit={submitSearch} className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por referencia, cliente, email, NIF o titulo"
          className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          aria-label="Buscar pedido"
        />
        <button
          type="submit"
          className="rounded-xl bg-cyan-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white hover:bg-cyan-500"
        >
          Buscar
        </button>
        <button
          type="button"
          onClick={clearSearch}
          className="rounded-xl border border-slate-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 hover:bg-slate-800"
        >
          Limpiar
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(LABELS) as FilterKey[]).map((key) => {
          const isActive = current === key;
          const count = counts[key] ?? 0;
          const isRisk =
            (key === "sla-riesgo" || key === "riesgo-financiero" || key === "margen-aprobacion" || key === "lote-pendiente") &&
            count > 0;
          return (
            <button
              key={key}
              type="button"
              onClick={() => navigate(key)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                isActive
                  ? "bg-cyan-600 text-white"
                  : isRisk
                    ? "border border-red-500 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                    : "border border-slate-600 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {LABELS[key]} ({count})
            </button>
          );
        })}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={resetView}
          className="rounded-xl border border-amber-500/50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-amber-300 hover:bg-amber-500/10"
        >
          Resetear vista
        </button>
      </div>
    </div>
  );
}
