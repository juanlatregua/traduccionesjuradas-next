"use client";

import { usePathname } from "next/navigation";

const STEPS = [
  { href: "/presupuesto-instantaneo", label: "Diagnóstico" },
  { href: "/checkout", label: "Pago" },
  { href: "/confirmation", label: "Confirmación" },
];

export default function FunnelStepper() {
  const pathname = usePathname();
  const activeIndex = Math.max(
    0,
    STEPS.findIndex((step) => pathname === step.href)
  );

  return (
    <ol
      aria-label="Progreso del pedido"
      className="mt-4 grid grid-cols-3 gap-2 overflow-x-auto text-center text-[11px] font-semibold"
    >
      {STEPS.map((step, index) => {
        const active = index <= activeIndex;
        const isCurrent = index === activeIndex;
        return (
          <li
            key={step.href}
            aria-current={isCurrent ? "step" : undefined}
            className={`min-w-[3.5rem] rounded-xl border px-2 py-2 ${
              active
                ? "border-bleu bg-cream text-bleu"
                : "border-cream bg-white text-graphite"
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
