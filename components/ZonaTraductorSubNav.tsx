"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type SubTab = { href: string; label: string; badge?: number };

// Sub-navegación de una etapa (Presupuestos, Contabilidad). Las pestañas que se
// retiraron de la barra principal viven aquí: siguen siendo las MISMAS páginas,
// solo dejan de competir por sitio en el menú de primer nivel.
export default function ZonaTraductorSubNav({ tabs }: { tabs: SubTab[] }) {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex flex-wrap items-center gap-1 border-b border-[#D5DAE1] pb-2">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
              active ? "border border-[#1A2E4A] bg-[#1A2E4A] text-white" : "border border-[#D5DAE1] bg-white text-[#52606D] hover:bg-[#F6F7F9] hover:text-[#1A2E4A]"
            }`}
          >
            {tab.label}
            {tab.badge ? (
              <span className="ml-2 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#F0E2B8] px-1 text-[10px] font-bold text-[#4A3A0B]">
                {tab.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
