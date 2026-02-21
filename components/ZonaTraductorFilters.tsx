"use client";

import { useRouter } from "next/navigation";

type FilterKey = "todos" | "pagados-sin-asignar" | "en-proceso" | "sla-riesgo" | "pendientes-pago" | "traducidos";

const LABELS: Record<FilterKey, string> = {
  todos: "Todos",
  "pagados-sin-asignar": "Pagados sin asignar",
  "en-proceso": "En proceso",
  "sla-riesgo": "SLA en riesgo",
  "pendientes-pago": "Pend. pago",
  traducidos: "Traducidos",
};

type Props = {
  current: string;
  counts: Record<string, number>;
};

export default function ZonaTraductorFilters({ current, counts }: Props) {
  const router = useRouter();

  function navigate(key: string) {
    const url = key === "todos" ? "/zona-traductor" : `/zona-traductor?filtro=${key}`;
    router.push(url);
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {(Object.keys(LABELS) as FilterKey[]).map((key) => {
        const isActive = current === key;
        const count = counts[key] ?? 0;
        const isSlaRisk = key === "sla-riesgo" && count > 0;
        return (
          <button
            key={key}
            type="button"
            onClick={() => navigate(key)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              isActive
                ? "bg-cyan-600 text-white"
                : isSlaRisk
                  ? "border border-red-500 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                  : "border border-slate-600 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {LABELS[key]} ({count})
          </button>
        );
      })}
    </div>
  );
}
