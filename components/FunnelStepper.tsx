"use client";

import { usePathname } from "next/navigation";

const STEPS = [
  { href: "/start", label: "Contexto" },
  { href: "/upload", label: "Documento" },
  { href: "/review", label: "Revision" },
  { href: "/checkout", label: "Pago" },
  { href: "/confirmation", label: "Confirmacion" },
];

export default function FunnelStepper() {
  const pathname = usePathname();
  const activeIndex = Math.max(
    0,
    STEPS.findIndex((step) => pathname === step.href)
  );

  return (
    <ol className="mt-4 grid grid-cols-5 gap-2 text-center text-[11px] font-semibold">
      {STEPS.map((step, index) => {
        const active = index <= activeIndex;
        return (
          <li
            key={step.href}
            className={`rounded-xl border px-2 py-2 ${
              active
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border-slate-200 bg-white text-slate-500"
            }`}
          >
            <span className="block">{index + 1}</span>
            <span className="block truncate">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

