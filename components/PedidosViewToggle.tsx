"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Cards vs Tabla: dos LECTURAS del mismo dataset ya filtrado, no dos pantallas.
// Cards = triage diario (agrupado por urgencia). Tabla = vista pro (bulk + CSV).
export default function PedidosViewToggle({ vista }: { vista: "cards" | "tabla" }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setVista(next: "cards" | "tabla") {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "cards") params.delete("vista");
    else params.set("vista", next);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const opts: { key: "cards" | "tabla"; label: string }[] = [
    { key: "cards", label: "Tarjetas" },
    { key: "tabla", label: "Tabla" },
  ];

  return (
    <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900/60 p-0.5">
      {opts.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => setVista(o.key)}
          aria-pressed={vista === o.key}
          className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
            vista === o.key ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
