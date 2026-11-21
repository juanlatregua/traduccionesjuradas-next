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
    <div className="inline-flex rounded-lg border border-[#D5DAE1] bg-[#fff] p-0.5">
      {opts.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => setVista(o.key)}
          aria-pressed={vista === o.key}
          className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
            vista === o.key ? "bg-[#F6F7F9] text-[#1A2E4A]" : "text-[#52606D] hover:text-[#1F2933]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
