"use client";

import { type FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type FilterKey =
  | "todos"
  | "pagados-sin-asignar"
  | "pendientes-revision"
  | "en-proceso"
  | "sla-riesgo"
  | "pendientes-pago"
  | "traducidos"
  | "riesgo-financiero"
  | "margen-aprobacion"
  | "lote-pendiente";

const LABELS: Record<FilterKey, string> = {
  todos: "Todos",
  "pagados-sin-asignar": "Pagados sin asignar",
  "pendientes-revision": "Pend. revisión",
  "en-proceso": "En proceso",
  "sla-riesgo": "SLA en riesgo",
  "pendientes-pago": "Pend. pago",
  traducidos: "Traducidos",
  "riesgo-financiero": "Riesgo financiero",
  "margen-aprobacion": "Aprobacion margen",
  "lote-pendiente": "Lote pendiente",
};

type Props = {
  current: string;
  counts: Record<string, number>;
  query?: string;
};

export default function ZonaTraductorFilters({ current, counts, query }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(query || "");

  const cleanedSearch = useMemo(() => search.trim(), [search]);

  function buildUrl(filterKey: string, q: string) {
    const params = new URLSearchParams();
    if (filterKey !== "todos") params.set("filtro", filterKey);
    if (q) params.set("q", q);
    const qs = params.toString();
    return qs ? `/zona-traductor?${qs}` : "/zona-traductor";
  }

  function navigate(filterKey: string) {
    router.push(buildUrl(filterKey, cleanedSearch));
  }

  function submitSearch(e: FormEvent) {
    e.preventDefault();
    router.push(buildUrl(current || "todos", cleanedSearch));
  }

  function clearSearch() {
    setSearch("");
    router.push(buildUrl(current || "todos", ""));
  }

  return (
    <div className="mt-4 space-y-3">
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
    </div>
  );
}
